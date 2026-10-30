import * as THREE from 'three';
import { SIZE, TILES, baseHeight, config, eyePos, footY, playerEntity, tileId, tileX, tileZ, vh } from '../core';
import type { Entity, TileId, World } from '../core';
import { Clouds } from './clouds';

export interface Pick {
  entityId?: number;
  tile?: TileId;
}

export interface ViewState {
  yaw: number;
  pitch: number;
}

const COLORS = {
  tree: 0x2f9e5b,
  trunk: 0x7a4b2a,
  boulder: 0x8b93a7,
  synthoid: 0x35d0e0,
  sentinel: 0xff5a4f,
  pedestal: 0x6b4fa3,
};

/** Anillo de terreno decorativo que continúa fuera del área jugable (en baldosas). */
const OUTER = 24;
/** Dirección hacia el sol: 26° sobre el horizonte, desde el sureste. Luz, sombras y disco del cielo usan la misma. */
const SUN_ELEVATION = (26 * Math.PI) / 180;
const SUN_AZIMUTH = Math.atan2(14, 22);
const SUN_DIR = new THREE.Vector3(
  Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH),
  Math.sin(SUN_ELEVATION),
  Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH),
);
const SUN_DISTANCE = 150; // el disco se coloca a esta distancia de la cámara (siempre «en el infinito»)
const WALL_BOTTOM = -4;
const WALL_TOP = 16;

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

/** Altura de vértice en cualquier punto: la real dentro del área, una extensión suave fuera. */
function makeHeightFn(w: World): (i: number, j: number) => number {
  const l = w.landscape;
  let sum = 0;
  for (const h of l.heights) sum += h;
  const mean = sum / l.heights.length;
  return (i, j) => {
    if (i >= 0 && j >= 0 && i < SIZE && j < SIZE) return vh(l, i, j);
    const ci = Math.min(SIZE - 1, Math.max(0, i));
    const cj = Math.min(SIZE - 1, Math.max(0, j));
    const d = Math.hypot(i - ci, j - cj);
    const t = Math.min(1, d / 22);
    const n = valueNoise(i / 7, j / 7, l.code) * 0.7 + valueNoise(i / 3, j / 3, l.code + 1) * 0.3 - 0.5;
    return Math.round(vh(l, ci, cj) * (1 - t) + mean * t + n * 8 * Math.min(1, d / 5));
  };
}

const WALL_VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Rejilla de energía con banda de escaneo; brilla más cuanto más cerca está el jugador.
const WALL_FRAG = `
varying vec3 vWorld;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uColor;
void main() {
  float u = vWorld.x + vWorld.z;
  float v = vWorld.y;
  vec2 coord = vec2(u, v);
  vec2 g = abs(fract(coord - 0.5) - 0.5) / max(fwidth(coord), vec2(0.0001));
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  // Lejos o en ángulo rasante la rejilla se funde en lugar de saturarse en moiré.
  vec2 fw = fwidth(coord);
  line *= 1.0 - smoothstep(0.5, 1.0, max(fw.x, fw.y));
  float band = 1.0 - abs(fract(v * 0.06 - uTime * 0.12) - 0.5) * 7.0;
  band = clamp(band, 0.0, 1.0);
  float fade = (1.0 - smoothstep(-2.0, 16.0, v)) * 0.55 + 0.12;
  float near = 1.0 - smoothstep(0.4, 9.0, distance(uCam, vWorld));
  float flicker = 0.88 + 0.12 * sin(uTime * 3.0 + u * 0.8);
  float a = (line * 0.5 + band * 0.3 + 0.07) * fade * flicker + near * (line * 0.6 + 0.18);
  gl_FragColor = vec4(uColor * (1.0 + near * 0.8), clamp(a, 0.0, 0.9));
  #include <colorspace_fragment>
}`;

export class Renderer {
  private readonly gl: THREE.WebGLRenderer;
  private wallMaterial: THREE.ShaderMaterial | null = null;
  private overviewY = 10;
  private readonly clouds = new Clouds();
  private readonly sunVisual = new THREE.Group();
  private readonly assets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material }>();
  private shadowsDirty = true;
  private lastOverview = false;
  private readonly ndc = new THREE.Vector2();
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
  private readonly raycaster = new THREE.Raycaster();
  private readonly world3d = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Group>();
  private terrain: THREE.Group | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private pedestalMesh: THREE.Mesh | null = null;
  private readonly hover: THREE.Mesh;
  private readonly sun: THREE.DirectionalLight;
  private ownId = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.add(this.world3d);
    this.scene.add(this.clouds.group);
    this.buildSunVisual();
    this.scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a4a3a, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -26;
    cam.right = 26;
    cam.top = 26;
    cam.bottom = -26;
    cam.near = 1;
    cam.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    const hg = new THREE.PlaneGeometry(0.96, 0.96);
    hg.rotateX(-Math.PI / 2);
    this.hover = new THREE.Mesh(
      hg,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.hover.visible = false;
    this.scene.add(this.hover);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setWorld(w: World): void {
    for (const m of this.meshes.values()) this.world3d.remove(m);
    this.meshes.clear();
    this.shadowsDirty = true;
    if (this.terrain) {
      this.world3d.remove(this.terrain);
      this.terrain.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }

    const hue = ((w.landscape.code * 47) % 360) / 360;
    const sky = new THREE.Color().setHSL((hue + 0.5) % 1, 0.45, 0.72);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 22, 70);

    this.terrain = new THREE.Group();
    const hAt = makeHeightFn(w);
    this.terrainMesh = this.buildTerrain(hAt, hue, true);
    this.terrain.add(this.terrainMesh);
    // El anillo exterior es solo decoración: no entra en el picking.
    this.terrain.add(this.buildTerrain(hAt, hue, false));
    this.terrain.add(this.buildWalls(hue));

    const l = w.landscape;
    let maxH = 0;
    for (const h of l.heights) if (h > maxH) maxH = h;
    this.overviewY = maxH + config.pedestalHeight + 3.5; // por debajo de la capa de nubes (empieza ≈ +7): sin cruzarlas, con todo el panorama
    this.clouds.reset(l.code, maxH + config.pedestalHeight, sky);
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 1, 0.94),
      new THREE.MeshStandardMaterial({ color: COLORS.pedestal, flatShading: true }),
    );
    ped.position.set(tileX(l.sentinelTile) + 0.5, baseHeight(l, l.sentinelTile) + 0.5, tileZ(l.sentinelTile) + 0.5);
    ped.castShadow = true;
    ped.receiveShadow = true;
    this.pedestalMesh = ped;
    this.terrain.add(ped);
    this.world3d.add(this.terrain);

    const c = SIZE / 2;
    this.sun.position.copy(SUN_DIR).multiplyScalar(70).add(new THREE.Vector3(c, 0, c));
    this.sun.target.position.set(c, 0, c);
  }

  /** Muros de energía en el perímetro del área jugable. */
  private buildWalls(hue: number): THREE.Mesh {
    const a = 0;
    const b = TILES;
    const y0 = WALL_BOTTOM;
    const y1 = WALL_TOP;
    const quad = (x0: number, z0: number, x1: number, z1: number): number[] => [
      x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0,
    ];
    const pos = [...quad(a, a, b, a), ...quad(b, a, b, b), ...quad(b, b, a, b), ...quad(a, b, a, a)];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const color = new THREE.Color().setHSL((hue + 0.5) % 1, 0.9, 0.62);
    this.wallMaterial = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending, // el aditivo se quemaba a blanco sobre el cielo claro
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uColor: { value: color },
      },
    });
    const m = new THREE.Mesh(g, this.wallMaterial);
    m.frustumCulled = false;
    return m;
  }

  /** Malla del área jugable (inner) o del anillo exterior decorativo (!inner). */
  private buildTerrain(hAt: (i: number, j: number) => number, hue: number, inner: boolean): THREE.Mesh {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const lo = inner ? 0 : -OUTER;
    const hi = inner ? TILES : TILES + OUTER;
    for (let z = lo; z < hi; z++) {
      for (let x = lo; x < hi; x++) {
        const isInner = x >= 0 && z >= 0 && x < TILES && z < TILES;
        if (isInner !== inner) continue;
        const h00 = hAt(x, z);
        const h10 = hAt(x + 1, z);
        const h01 = hAt(x, z + 1);
        const h11 = hAt(x + 1, z + 1);
        pos.push(x, h00, z, x, h01, z + 1, x + 1, h10, z, x + 1, h10, z, x, h01, z + 1, x + 1, h11, z + 1);
        const flat = h00 === h10 && h00 === h01 && h00 === h11;
        if (inner) {
          if (flat) c.setHSL(hue, 0.45, (x + z) % 2 === 0 ? 0.5 : 0.44);
          else c.setHSL((hue + 0.04) % 1, 0.35, 0.36);
        } else {
          // Exterior más apagado para que se lea como «fuera de juego».
          // Casi gris y oscuro: se lee como «no jugable» frente al verde saturado del área de juego.
          if (flat) c.setHSL(hue, 0.07, (x + z) % 2 === 0 ? 0.22 : 0.2);
          else c.setHSL(hue, 0.06, 0.15);
        }
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    m.receiveShadow = true;
    m.castShadow = inner; // el anillo exterior queda casi todo fuera del frustum de sombras
    return m;
  }

  private makeMesh(e: Entity): THREE.Group {
    const g = new THREE.Group();
    g.userData.entityId = e.id;
    // Geometrías y materiales compartidos por tipo (se crean una vez; nunca se liberan por entidad).
    const add = (make: () => THREE.BufferGeometry, color: number, y: number, emissive = 0): THREE.Mesh => {
      const key = `${e.kind}:${g.children.length}`;
      let a = this.assets.get(key);
      if (!a) {
        a = { geo: make(), mat: new THREE.MeshStandardMaterial({ color, flatShading: true, emissive }) };
        this.assets.set(key, a);
      }
      const m = new THREE.Mesh(a.geo, a.mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    switch (e.kind) {
      case 'tree':
        add(() => new THREE.CylinderGeometry(0.07, 0.1, 0.4, 6), COLORS.trunk, 0.2);
        add(() => new THREE.ConeGeometry(0.34, 0.9, 7), COLORS.tree, 0.8);
        break;
      case 'boulder':
        add(() => new THREE.BoxGeometry(0.9, 1, 0.9), COLORS.boulder, 0.5);
        break;
      case 'synthoid': {
        add(() => new THREE.CylinderGeometry(0.26, 0.32, 0.7, 8), COLORS.synthoid, 0.35, 0x063a40);
        add(() => new THREE.SphereGeometry(0.24, 10, 8), COLORS.synthoid, 0.92, 0x063a40);
        const visor = add(() => new THREE.BoxGeometry(0.28, 0.08, 0.1), 0x0b1d22, 0.95);
        visor.position.z = 0.2;
        break;
      }
      case 'sentinel': {
        add(() => new THREE.CylinderGeometry(0.18, 0.32, 1.0, 8), COLORS.sentinel, 0.5, 0x3a0d0a);
        add(() => new THREE.SphereGeometry(0.32, 12, 10), COLORS.sentinel, 1.35, 0x3a0d0a);
        const eye = add(() => new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, 1.4, 0xffffff);
        eye.position.z = 0.28;
        break;
      }
    }
    return g;
  }

  /** Animación independiente de la simulación (nubes); también corre bajo los menús. */
  update(dt: number): void {
    this.clouds.update(dt);
  }

  /** Disco solar low-poly con dos halos translúcidos; no le afectan niebla ni tone mapping. */
  private buildSunVisual(): void {
    const mk = (radius: number, color: number, opacity: number): THREE.Mesh => {
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius, 1),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false, toneMapped: false, depthWrite: false }),
      );
      m.renderOrder = -1; // detrás de todo lo demás
      return m;
    };
    this.sunVisual.add(mk(9, 0xfff6c8, 1), mk(14, 0xffe28a, 0.28), mk(22, 0xffc766, 0.12));
    this.scene.add(this.sunVisual);
  }

  /** `overview`: cámara girando en el centro del nivel (fondo del menú) en vez de la vista del jugador. */
  sync(w: World, view: ViewState, overview = false): void {
    const seen = new Set<number>();
    for (const e of w.entities.values()) {
      seen.add(e.id);
      let m = this.meshes.get(e.id);
      if (!m) {
        m = this.makeMesh(e);
        this.meshes.set(e.id, m);
        this.world3d.add(m);
        this.shadowsDirty = true;
      }
      m.position.set(tileX(e.tile) + 0.5, footY(w, e), tileZ(e.tile) + 0.5);
      m.rotation.y = e.yaw;
    }
    for (const [id, m] of this.meshes) {
      if (!seen.has(id)) {
        this.world3d.remove(m); // geometría y material son compartidos: no se liberan
        this.meshes.delete(id);
        this.shadowsDirty = true;
      }
    }

    const me = playerEntity(w);
    const ownId = me ? me.id : -1;
    if (ownId !== this.ownId || overview !== this.lastOverview) this.shadowsDirty = true; // cambia qué malla se oculta
    this.ownId = ownId;
    this.lastOverview = overview;
    for (const [id, m] of this.meshes) m.visible = overview || id !== this.ownId;

    if (this.shadowsDirty) {
      this.gl.shadowMap.needsUpdate = true; // el sol es fijo: el mapa de sombras solo se repinta si cambia la escena
      this.shadowsDirty = false;
    }

    const p = overview ? { x: TILES / 2, y: this.overviewY, z: TILES / 2 } : me ? eyePos(w, me) : null;
    if (p) {
      this.camera.position.set(p.x, p.y, p.z);
      const cp = Math.cos(view.pitch);
      this.camera.lookAt(
        p.x + Math.sin(view.yaw) * cp,
        p.y + Math.sin(view.pitch),
        p.z + Math.cos(view.yaw) * cp,
      );
    }
    this.sunVisual.position.copy(this.camera.position).addScaledVector(SUN_DIR, SUN_DISTANCE);
    if (this.wallMaterial) {
      this.wallMaterial.uniforms.uTime!.value = performance.now() / 1000;
      (this.wallMaterial.uniforms.uCam!.value as THREE.Vector3).copy(this.camera.position);
    }
  }

  pick(ndcX: number, ndcY: number): Pick {
    if (!this.terrainMesh || !this.pedestalMesh) return {};
    this.raycaster.setFromCamera(this.ndc.set(ndcX, ndcY), this.camera);
    const targets = this.pickTargets;
    targets.length = 0;
    targets.push(this.terrainMesh, this.pedestalMesh);
    for (const [id, m] of this.meshes) if (id !== this.ownId) targets.push(m);
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    if (!hit) return {};
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const id = o.userData.entityId as number | undefined;
      if (id !== undefined) return { entityId: id };
      o = o.parent;
    }
    if (hit.object === this.pedestalMesh) {
      // El pedestal pertenece a la baldosa del Centinela.
      return { tile: Math.floor(hit.point.z) * TILES + Math.floor(hit.point.x) };
    }
    const x = Math.min(TILES - 1, Math.max(0, Math.floor(hit.point.x)));
    const z = Math.min(TILES - 1, Math.max(0, Math.floor(hit.point.z)));
    return { tile: tileId(x, z) };
  }

  setHover(tile: TileId | null, y: number, ok: boolean): void {
    if (tile === null) {
      this.hover.visible = false;
      return;
    }
    this.hover.visible = true;
    this.hover.position.set(tileX(tile) + 0.5, y + 0.03, tileZ(tile) + 0.5);
    (this.hover.material as THREE.MeshBasicMaterial).color.set(ok ? 0xfff27a : 0xff6b6b);
  }

  draw(): void {
    this.gl.render(this.scene, this.camera);
  }
}
