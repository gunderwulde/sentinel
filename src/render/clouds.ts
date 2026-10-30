import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { rngNext, seedFromCode } from '../core';

/**
 * Nubes procedurales: solo decoración (no afectan a la simulación ni al picking).
 * Cada nube es una malla de marching cubes sobre un campo de metaballs, con flat shading y base plana
 * para encajar con el aspecto del juego. La nube entera se condensa desde el núcleo hacia fuera, se
 * mantiene y se disipa desde los bordes; mientras tanto deriva con el viento.
 */
const CLOUDS = 14;
const RES = 24; // resolución del campo: baja a propósito, las facetas son parte del estilo
const ISO = 80;
const SUB = 12;
const CENTER = 15.5;
const HALF = 48; // las nubes viven en un cuadrado de 96 u alrededor del centro del nivel
const WIND_SPEED = 0.7; // unidades/s: «un leve movimiento por el aire»
const BASE = -0.12; // plano de la base plana, en coordenadas del cubo de marching cubes (-1..1)

interface Cloud {
  x: number;
  y: number;
  z: number;
  speed: number;
  age: number;
  life: number;
  phase: number;
  size: number; // semianchura en unidades de mundo
  growth: number; // 0 = no existe, 1 = nube completa
  mesh: THREE.Mesh;
  uniform: { value: number };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Clouds {
  readonly group = new THREE.Group();
  readonly clouds: Cloud[] = [];
  /** Suma del tamaño de las nubes visibles: sube al condensarse y baja al disiparse. */
  coverage = 0;

  private readonly rng = { s: 1 };
  private readonly gen: MarchingCubes;
  private readonly top = new THREE.Color(0xffffff);
  private readonly under = new THREE.Color(0xd8dde8);
  private readonly emissive = new THREE.Color(0xffffff);
  private baseY = 14;
  private windX = 1;
  private windZ = 0;
  private time = 0;

  constructor() {
    this.gen = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 30000);
    this.gen.isolation = ISO;
    for (let i = 0; i < CLOUDS; i++) {
      const uniform = { value: 0 };
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.makeMaterial(uniform));
      mesh.castShadow = false; // el mapa de sombras es estático: las nubes no deben obligar a repintarlo
      mesh.receiveShadow = false;
      mesh.visible = false;
      this.group.add(mesh);
      this.clouds.push({ x: 0, y: 0, z: 0, speed: 0, age: 0, life: 1, phase: 0, size: 1, growth: 0, mesh, uniform });
    }
  }

  private makeMaterial(uniform: { value: number }): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    mat.emissive = this.emissive; // compartido: se actualiza una vez por paisaje
    mat.emissiveIntensity = 0.45;
    // Condensación/disipación de la nube entera: cada triángulo tiene un umbral (núcleo primero, bordes después);
    // se descartan los triángulos con umbral por encima del crecimiento, y la malla se encoge un poco al disiparse.
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrowth = uniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aThreshold;\nvarying float vThreshold;\nuniform float uGrowth;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvThreshold = aThreshold;\ntransformed *= 0.6 + 0.4 * uGrowth;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vThreshold;\nuniform float uGrowth;')
        .replace('void main() {', 'void main() {\n  if (vThreshold > uGrowth) discard;');
    };
    return mat;
  }

  /** Regenera el cielo de un paisaje: misma semilla, mismas nubes iniciales. */
  reset(code: number, maxTerrainHeight: number, sky: THREE.Color): void {
    this.rng.s = seedFromCode(code + 777);
    this.time = 0;
    this.baseY = maxTerrainHeight + 7; // siempre por encima de cimas y pedestal
    const angle = rngNext(this.rng) * Math.PI * 2;
    this.windX = Math.cos(angle);
    this.windZ = Math.sin(angle);

    // Mismos tonos que el cielo del nivel: blanco teñido arriba, algo más oscuro y frío abajo.
    this.top.copy(sky).lerp(new THREE.Color(0xffffff), 0.8);
    this.under.copy(sky).lerp(new THREE.Color(0xffffff), 0.55).multiplyScalar(0.92);
    this.emissive.copy(sky).lerp(new THREE.Color(0xffffff), 0.6);

    for (let i = 0; i < CLOUDS; i++) this.spawn(i, true);
    this.update(0);
  }

  private spawn(index: number, randomAge: boolean): void {
    const r = this.rng;
    const c = this.clouds[index]!;
    c.x = CENTER + (rngNext(r) - 0.5) * HALF * 2;
    c.z = CENTER + (rngNext(r) - 0.5) * HALF * 2;
    c.y = this.baseY + rngNext(r) * 8;
    c.speed = WIND_SPEED * (0.7 + rngNext(r) * 0.6);
    c.life = 45 + rngNext(r) * 45;
    c.age = randomAge ? rngNext(r) * c.life : 0;
    c.phase = rngNext(r) * Math.PI * 2;
    c.size = 7 + rngNext(r) * 6;
    c.mesh.rotation.y = rngNext(r) * Math.PI * 2;
    c.mesh.geometry.dispose();
    c.mesh.geometry = this.buildGeometry(c.size);
  }

  /** Metaballs agrupadas en un cúmulo aplanado → marching cubes → geometría plana con base recta. */
  private buildGeometry(size: number): THREE.BufferGeometry {
    const r = this.rng;
    const g = this.gen;
    g.reset();
    // Núcleo grande y alto: garantiza una malla y da el cuerpo del cúmulo.
    g.addBall(0.5, 0.56, 0.5, (ISO + SUB) * 0.17 * 0.17, SUB);
    // Cúpula: cuanto más cerca del centro, más alta y más gruesa la bola; los bordes bajan y se afinan.
    const balls = 7 + Math.floor(rngNext(r) * 5);
    const DMAX = 0.2;
    for (let k = 0; k < balls; k++) {
      const a = rngNext(r) * Math.PI * 2;
      const d = Math.sqrt(rngNext(r)) * DMAX;
      const centrality = 1 - d / DMAX;
      const R = (0.08 + rngNext(r) * 0.06) * (0.65 + 0.35 * centrality);
      g.addBall(
        0.5 + Math.cos(a) * d * 1.35, // algo alargado en horizontal
        0.5 + 0.02 + centrality * 0.15 * (0.4 + 0.6 * rngNext(r)),
        0.5 + Math.sin(a) * d,
        (ISO + SUB) * R * R,
        SUB,
      );
    }
    g.update();

    const triangles = Math.floor(g.count / 3);
    const pos = new Float32Array(triangles * 9);
    const col = new Float32Array(triangles * 9);
    const thr = new Float32Array(triangles * 3);
    const src = g.positionArray;
    const tmp = new THREE.Color();
    const sx = size;
    const sy = size * 0.8; // algo más ancho que alto, pero con cuerpo
    let o = 0;

    for (let t = 0; t < triangles; t++) {
      const p: number[] = [];
      for (let v = 0; v < 3; v++) {
        const i = (t * 3 + v) * 3;
        p.push(src[i]!, Math.max(src[i + 1]!, BASE), src[i + 2]!); // base plana
      }
      const cx = (p[0]! + p[3]! + p[6]!) / 3;
      const cy = (p[1]! + p[4]! + p[7]!) / 3;
      const cz = (p[2]! + p[5]! + p[8]!) / 3;

      // Orientación hacia fuera, medida contra el centro de la nube (no contra la normal del campo).
      const e1 = [p[3]! - p[0]!, p[4]! - p[1]!, p[5]! - p[2]!];
      const e2 = [p[6]! - p[0]!, p[7]! - p[1]!, p[8]! - p[2]!];
      const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
      const ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
      const nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
      if (nx * cx + ny * cy + nz * cz < 0) {
        for (let k = 0; k < 3; k++) {
          const tmpV = p[3 + k]!;
          p[3 + k] = p[6 + k]!;
          p[6 + k] = tmpV;
        }
      }

      // Núcleo primero, bordes después (más algo de ruido por triángulo).
      const threshold = 0.75 * Math.min(1, Math.hypot(cx, cy * 1.6, cz) / 0.75) + 0.25 * rngNext(r);
      for (let v = 0; v < 3; v++) {
        const base = v * 3;
        pos[o] = p[base]! * sx;
        pos[o + 1] = p[base + 1]! * sy;
        pos[o + 2] = p[base + 2]! * sx;
        tmp.copy(this.under).lerp(this.top, Math.min(1, Math.max(0, (p[base + 1]! - BASE) / 0.45)));
        col[o] = tmp.r;
        col[o + 1] = tmp.g;
        col[o + 2] = tmp.b;
        thr[t * 3 + v] = threshold;
        o += 3;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aThreshold', new THREE.BufferAttribute(thr, 1));
    geo.computeVertexNormals(); // requerido por el material; con flatShading el sombreado sale de las derivadas
    geo.computeBoundingSphere();
    return geo;
  }

  update(dt: number): void {
    this.time += dt;
    const gust = 1 + 0.25 * Math.sin(this.time * 0.05); // el viento sopla algo más o menos con el tiempo
    let coverage = 0;

    for (let i = 0; i < CLOUDS; i++) {
      const c = this.clouds[i]!;
      c.age += dt;
      if (c.age >= c.life) this.spawn(i, false); // se disipó del todo: nace otra en otro sitio
      c.x += this.windX * c.speed * gust * dt;
      c.z += this.windZ * c.speed * gust * dt;

      const t = c.age / c.life;
      c.growth = smooth(0, 0.3, t) * (1 - smooth(0.7, 1, t)); // condensa, mantiene, disipa
      c.uniform.value = c.growth;
      c.mesh.visible = c.growth > 0.001;
      c.mesh.position.set(c.x, c.y + Math.sin(this.time * 0.2 + c.phase) * 0.4, c.z);
      coverage += c.growth * c.size;
    }
    this.coverage = coverage;
  }
}
