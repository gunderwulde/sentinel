import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { rngNext, seedFromCode } from '../core';

/**
 * Nubes procedurales (solo decoración: no afectan a la simulación ni al picking).
 *
 * Una nube es una acumulación de HUMEDAD. Cada punto de humedad aporta al campo escalar del cielo con un
 * núcleo suave; la humedad de cada punto sube y baja con el tiempo, así que su estructura crece o se encoge
 * de forma continua, y al sumarse con la de los puntos vecinos las nubes se funden y se separan de forma
 * orgánica. Sobre ese campo se extrae la superficie con marching cubes: nunca se quitan caras, la nube
 * aparece cuando la humedad supera el umbral y desaparece cuando cae por debajo.
 */
const CELL = 1.5; // tamaño de celda del campo (u): el facetado bajo es parte del estilo
const NX = 64;
const NY = 12;
const NZ = 64;
const SY = NX; // zancadas del campo: idx = i + j*SY + k*SZ  (j = eje vertical)
const SZ = NX * NY;
const CENTER = 15.5;
const HALF = (NX * CELL) / 2; // 48 u a cada lado del centro del nivel
const LIMIT = 33; // los centros de nube no salen de ±33 u: el núcleo (≤ 15 u) cabe siempre en el campo
const ISO = 0.4; // humedad mínima para que exista superficie
const KERNEL_Y = 1.6; // achatamiento vertical del núcleo: las nubes son más anchas que altas
const WIND_SPEED = 0.3; // unidades/s: «un leve movimiento por el aire»
const STEP = 0.1; // s entre reconstrucciones del campo y la malla
const MAX_TRIS = 40000;
const CLOUDS = 14;
const POINTS = 9;
/** Si las caras salen hacia dentro, se invierte aquí (lo comprueba un test). */
const FLIP = false;

interface Point {
  ox: number;
  oy: number;
  oz: number;
  radius: number; // alcance del núcleo
  gain: number; // cuánta humedad puede retener este punto
  phase: number;
  freq: number; // rad/s: ritmo al que su humedad sube y baja
  h: number; // humedad actual (la calcula la simulación)
}

interface Cluster {
  x: number;
  y: number;
  z: number;
  speed: number;
  age: number;
  life: number;
  phase: number;
  envelope: number; // 0..1: ciclo de vida de toda la acumulación de humedad
  points: Point[];
}

export interface DebugPoint {
  x: number;
  y: number;
  z: number;
  r: number;
  h: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Clouds {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly clusters: Cluster[] = [];
  /** Humedad total en el cielo: sube cuando las nubes se acumulan y baja cuando se disipan. */
  humidity = 0;
  triangleCount = 0;
  /** Coste de la última reconstrucción de campo + malla (ms), para medir. */
  lastBuildMs = 0;

  private readonly rng = { s: 1 };
  private readonly field = new Float32Array(NX * NY * NZ);
  private readonly positions = new Float32Array(MAX_TRIS * 9);
  private readonly colors = new Float32Array(MAX_TRIS * 9);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly edge = new Float32Array(36); // vértices interpolados de las 12 aristas del cubo
  private readonly ramp = new Float32Array(32 * 3); // degradado de color por altura
  private readonly emissive = new THREE.Color(0xffffff);
  private readonly material: THREE.MeshStandardMaterial;
  private gy0 = 0; // altura del plano inferior del campo
  private baseY = 14;
  private windX = 1;
  private windZ = 0;
  private time = 0;
  private sinceBuild = STEP;
  private manual: DebugPoint[] | null = null;
  // Límites (en celdas) de la zona del campo que se ha tocado: solo ahí se busca superficie.
  private bi0 = 0;
  private bi1 = 0;
  private bj0 = 0;
  private bj1 = 0;
  private bk0 = 0;
  private bk1 = 0;

  constructor() {
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colAttr);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    this.material.emissive = this.emissive;
    this.material.emissiveIntensity = 0.45;
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // la malla se reescribe entera: no tiene una esfera englobante estable
    this.mesh.castShadow = false; // las nubes no proyectan sombra: no aportaba nada y ensuciaba el terreno
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh);
  }

  /** Regenera el cielo de un paisaje: misma semilla, mismas nubes iniciales. */
  reset(code: number, maxTerrainHeight: number, sky: THREE.Color): void {
    this.rng.s = seedFromCode(code + 777);
    this.time = 0;
    this.manual = null;
    this.baseY = maxTerrainHeight + 11; // la capa empieza ≥ 4 u por encima de cimas, pedestal y cámara del menú
    this.gy0 = this.baseY - 6.5;
    const angle = rngNext(this.rng) * Math.PI * 2;
    this.windX = Math.cos(angle);
    this.windZ = Math.sin(angle);

    // Mismos tonos que el cielo del nivel: blanco teñido arriba, algo más oscuro y frío abajo.
    const top = new THREE.Color().copy(sky).lerp(new THREE.Color(0xffffff), 0.8);
    const under = new THREE.Color().copy(sky).lerp(new THREE.Color(0xffffff), 0.55).multiplyScalar(0.92);
    const c = new THREE.Color();
    for (let i = 0; i < 32; i++) {
      c.copy(under).lerp(top, i / 31);
      this.ramp[i * 3] = c.r;
      this.ramp[i * 3 + 1] = c.g;
      this.ramp[i * 3 + 2] = c.b;
    }
    this.emissive.copy(sky).lerp(new THREE.Color(0xffffff), 0.6);

    this.clusters.length = 0;
    for (let i = 0; i < CLOUDS; i++) {
      const cl = this.newCluster();
      this.clusters.push(cl);
      this.spawn(cl, true);
    }
    this.sinceBuild = STEP;
    this.update(0);
  }

  private newCluster(): Cluster {
    return { x: 0, y: 0, z: 0, speed: 0, age: 0, life: 1, phase: 0, envelope: 0, points: [] };
  }

  /** Coloca una nueva acumulación de humedad aguas arriba, con vida suficiente para no salir del campo. */
  private spawn(c: Cluster, randomAge: boolean): void {
    const r = this.rng;
    const lim = LIMIT;
    c.x = CENTER + Math.max(-lim, Math.min(lim, (rngNext(r) * 2 - 1) * lim * 0.9 - this.windX * lim * 0.6));
    c.z = CENTER + Math.max(-lim, Math.min(lim, (rngNext(r) * 2 - 1) * lim * 0.9 - this.windZ * lim * 0.6));
    c.y = this.gy0 + 6.5 + rngNext(r) * 3.5;
    c.speed = WIND_SPEED * (0.7 + rngNext(r) * 0.6);
    c.phase = rngNext(r) * Math.PI * 2;

    // Vida: la habitual, acortada si el viento la sacaría del campo antes de disiparse.
    const gustMax = 1.25;
    let exit = Infinity;
    const vx = this.windX * c.speed * gustMax;
    const vz = this.windZ * c.speed * gustMax;
    if (vx > 1e-6) exit = Math.min(exit, (CENTER + lim - c.x) / vx);
    if (vx < -1e-6) exit = Math.min(exit, (CENTER - lim - c.x) / vx);
    if (vz > 1e-6) exit = Math.min(exit, (CENTER + lim - c.z) / vz);
    if (vz < -1e-6) exit = Math.min(exit, (CENTER - lim - c.z) / vz);
    c.life = Math.max(50, Math.min(110 + rngNext(r) * 80, exit * 0.95)); // ciclos largos: la humedad cambia despacio
    c.age = randomAge ? rngNext(r) * c.life : 0;

    // Puntos de humedad en cúpula: los centrales son más grandes y más altos, los de los bordes se afinan.
    c.points = [];
    const n = POINTS - 2 + Math.floor(rngNext(r) * 3);
    const spread = 4 + rngNext(r) * 3;
    for (let i = 0; i < POINTS; i++) {
      if (i >= n) break;
      const a = rngNext(r) * Math.PI * 2;
      const d = i === 0 ? 0 : Math.sqrt(rngNext(r)) * spread;
      const centrality = 1 - d / (spread + 1e-6);
      c.points.push({
        ox: Math.cos(a) * d * 1.3,
        oy: centrality * 1.4 * (0.4 + 0.6 * rngNext(r)) - 0.6,
        oz: Math.sin(a) * d,
        radius: (6 + rngNext(r) * 3) * (0.7 + 0.3 * centrality),
        gain: 0.95 + rngNext(r) * 0.45,
        phase: rngNext(r) * Math.PI * 2,
        freq: 0.025 + rngNext(r) * 0.045, // rad/s: la humedad tarda de 90 a 250 s en subir y bajar
        h: 0,
      });
    }
  }

  /** Evoluciona la humedad: ciclo de vida de la acumulación × subidas y bajadas propias de cada punto. */
  private evolve(): void {
    for (const c of this.clusters) {
      const t = c.age / c.life;
      // La condensación y la disipación duran al menos 25 s: la humedad nunca cambia de golpe.
      const f = Math.min(0.5, Math.max(25 / c.life, 0.28));
      c.envelope = smooth(0, f, t) * (1 - smooth(1 - f, 1, t));
      for (const p of c.points) {
        p.h = c.envelope * p.gain * (0.65 + 0.35 * Math.sin(p.phase + this.time * p.freq));
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.sinceBuild += dt;
    const gust = 1 + 0.25 * Math.sin(this.time * 0.05); // el viento sopla algo más o menos con el tiempo
    for (const c of this.clusters) {
      c.age += dt;
      if (c.age >= c.life) this.spawn(c, false); // se disipó del todo: se condensa otra en otro sitio
      c.x += this.windX * c.speed * gust * dt;
      c.z += this.windZ * c.speed * gust * dt;
    }
    if (this.sinceBuild >= STEP) {
      this.sinceBuild = 0;
      this.evolve();
      this.build();
    }
  }

  /** Solo para tests: sustituye la simulación por puntos de humedad fijos y reconstruye la malla. */
  debugSet(points: DebugPoint[]): void {
    this.manual = points;
    this.build();
  }

  /** Puntos de humedad activos (los que ahora mismo sostienen superficie). */
  activePoints(): DebugPoint[] {
    if (this.manual) return this.manual;
    const out: DebugPoint[] = [];
    for (const c of this.clusters) {
      for (const p of c.points) {
        if (p.h > ISO) out.push({ x: c.x + p.ox, y: c.y + p.oy, z: c.z + p.oz, r: p.radius, h: p.h });
      }
    }
    return out;
  }

  private build(): void {
    const t0 = performance.now();
    this.field.fill(0);
    this.bi0 = NX;
    this.bj0 = NY;
    this.bk0 = NZ;
    this.bi1 = this.bj1 = this.bk1 = 0;

    let total = 0;
    if (this.manual) {
      for (const p of this.manual) {
        this.addPoint(p.x, p.y, p.z, p.r, p.h);
        total += p.h;
      }
    } else {
      for (const c of this.clusters) {
        for (const p of c.points) {
          if (p.h <= 0.02) continue;
          this.addPoint(c.x + p.ox, c.y + p.oy, c.z + p.oz, p.radius, p.h);
          total += p.h;
        }
      }
    }
    this.humidity = total;
    this.polygonize();
    this.lastBuildMs = performance.now() - t0;
  }

  /** Suma el aporte de un punto de humedad: núcleo suave de soporte compacto (1−u)³ por su humedad. */
  private addPoint(px: number, py: number, pz: number, R: number, h: number): void {
    const gx0 = CENTER - HALF;
    const gz0 = CENTER - HALF;
    const ry = R / KERNEL_Y;
    // La capa exterior del campo queda siempre a 0: las superficies son cerradas.
    const i0 = Math.max(1, Math.floor((px - R - gx0) / CELL));
    const i1 = Math.min(NX - 2, Math.ceil((px + R - gx0) / CELL));
    const j0 = Math.max(1, Math.floor((py - ry - this.gy0) / CELL));
    const j1 = Math.min(NY - 2, Math.ceil((py + ry - this.gy0) / CELL));
    const k0 = Math.max(1, Math.floor((pz - R - gz0) / CELL));
    const k1 = Math.min(NZ - 2, Math.ceil((pz + R - gz0) / CELL));
    if (i0 > i1 || j0 > j1 || k0 > k1) return;
    this.bi0 = Math.min(this.bi0, i0);
    this.bi1 = Math.max(this.bi1, i1);
    this.bj0 = Math.min(this.bj0, j0);
    this.bj1 = Math.max(this.bj1, j1);
    this.bk0 = Math.min(this.bk0, k0);
    this.bk1 = Math.max(this.bk1, k1);

    const R2 = R * R;
    const F = this.field;
    for (let k = k0; k <= k1; k++) {
      const dz = gz0 + k * CELL - pz;
      const dz2 = dz * dz;
      if (dz2 >= R2) continue;
      for (let j = j0; j <= j1; j++) {
        const dy = (this.gy0 + j * CELL - py) * KERNEL_Y;
        const dyz = dz2 + dy * dy;
        if (dyz >= R2) continue;
        const row = j * SY + k * SZ;
        for (let i = i0; i <= i1; i++) {
          const dx = gx0 + i * CELL - px;
          const d2 = dx * dx + dyz;
          if (d2 >= R2) continue;
          const w = 1 - d2 / R2;
          F[row + i]! += h * w * w * w;
        }
      }
    }
  }

  /** Marching cubes sobre la zona activa del campo, con las tablas clásicas de three. */
  private polygonize(): void {
    const F = this.field;
    const E = this.edge;
    const P = this.positions;
    const Cc = this.colors;
    const gx0 = CENTER - HALF;
    const gz0 = CENTER - HALF;
    const span = NY * CELL;
    let n = 0; // vértices escritos

    const edge = (e: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, fa: number, fb: number): void => {
      const d = fb - fa;
      const t = d === 0 ? 0.5 : (ISO - fa) / d;
      E[e * 3] = ax + (bx - ax) * t;
      E[e * 3 + 1] = ay + (by - ay) * t;
      E[e * 3 + 2] = az + (bz - az) * t;
    };
    const emit = (e: number): void => {
      const y = E[e * 3 + 1]!;
      P[n * 3] = E[e * 3]!;
      P[n * 3 + 1] = y;
      P[n * 3 + 2] = E[e * 3 + 2]!;
      const s = Math.min(31, Math.max(0, Math.floor(((y - this.gy0) / span) * 31 * 1.6)));
      Cc[n * 3] = this.ramp[s * 3]!;
      Cc[n * 3 + 1] = this.ramp[s * 3 + 1]!;
      Cc[n * 3 + 2] = this.ramp[s * 3 + 2]!;
      n++;
    };

    if (this.bi1 >= this.bi0) {
      const iA = Math.max(0, this.bi0 - 1);
      const iB = Math.min(NX - 2, this.bi1);
      const jA = Math.max(0, this.bj0 - 1);
      const jB = Math.min(NY - 2, this.bj1);
      const kA = Math.max(0, this.bk0 - 1);
      const kB = Math.min(NZ - 2, this.bk1);
      const C = CELL;
      for (let k = kA; k <= kB; k++) {
        for (let j = jA; j <= jB; j++) {
          for (let i = iA; i <= iB; i++) {
            const q = i + j * SY + k * SZ;
            const f0 = F[q]!;
            const f1 = F[q + 1]!;
            const f2 = F[q + SY]!;
            const f3 = F[q + 1 + SY]!;
            const f4 = F[q + SZ]!;
            const f5 = F[q + 1 + SZ]!;
            const f6 = F[q + SY + SZ]!;
            const f7 = F[q + 1 + SY + SZ]!;
            let ci = 0;
            if (f0 < ISO) ci |= 1;
            if (f1 < ISO) ci |= 2;
            if (f3 < ISO) ci |= 4;
            if (f2 < ISO) ci |= 8;
            if (f4 < ISO) ci |= 16;
            if (f5 < ISO) ci |= 32;
            if (f7 < ISO) ci |= 64;
            if (f6 < ISO) ci |= 128;
            const bits = edgeTable[ci]!;
            if (bits === 0) continue;

            const x = gx0 + i * C;
            const y = this.gy0 + j * C;
            const z = gz0 + k * C;
            if (bits & 1) edge(0, x, y, z, x + C, y, z, f0, f1);
            if (bits & 2) edge(1, x + C, y, z, x + C, y + C, z, f1, f3);
            if (bits & 4) edge(2, x, y + C, z, x + C, y + C, z, f2, f3);
            if (bits & 8) edge(3, x, y, z, x, y + C, z, f0, f2);
            if (bits & 16) edge(4, x, y, z + C, x + C, y, z + C, f4, f5);
            if (bits & 32) edge(5, x + C, y, z + C, x + C, y + C, z + C, f5, f7);
            if (bits & 64) edge(6, x, y + C, z + C, x + C, y + C, z + C, f6, f7);
            if (bits & 128) edge(7, x, y, z + C, x, y + C, z + C, f4, f6);
            if (bits & 256) edge(8, x, y, z, x, y, z + C, f0, f4);
            if (bits & 512) edge(9, x + C, y, z, x + C, y, z + C, f1, f5);
            if (bits & 1024) edge(10, x + C, y + C, z, x + C, y + C, z + C, f3, f7);
            if (bits & 2048) edge(11, x, y + C, z, x, y + C, z + C, f2, f6);

            const o = ci << 4;
            for (let m = 0; triTable[o + m] !== -1; m += 3) {
              if (n + 3 > MAX_TRIS * 3) break; // tope de seguridad del búfer
              const a = triTable[o + m]!;
              const b = triTable[o + m + 1]!;
              const c = triTable[o + m + 2]!;
              emit(a);
              if (FLIP) {
                emit(c);
                emit(b);
              } else {
                emit(b);
                emit(c);
              }
            }
          }
        }
      }
    }

    this.triangleCount = n / 3;
    this.geometry.setDrawRange(0, n);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
