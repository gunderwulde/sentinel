import * as THREE from 'three';
import { rngNext, seedFromCode } from '../core';

/** Nubes procedurales: solo decoración (no afectan a la simulación ni al picking). */
const CLOUDS = 14;
const MAX_PUFFS = 10;
const CENTER = 15.5;
const HALF = 48; // las nubes viven en un cuadrado de 96 u alrededor del centro del nivel
const WIND_SPEED = 0.7; // unidades/s: «un leve movimiento por el aire»

interface Puff {
  ox: number;
  oy: number;
  oz: number;
  r: number; // 0 = bocanada sin usar
  delay: number; // 0..0.5: cuándo aparece mientras la nube crece (y cuándo se va al disiparse)
  phase: number;
  rot: number;
}

interface Cloud {
  x: number;
  y: number;
  z: number;
  speed: number;
  age: number;
  life: number;
  phase: number;
  puffs: Puff[];
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  readonly clouds: Cloud[] = [];
  /** Suma de radios visibles: sube cuando las nubes se acumulan y baja cuando se disipan. */
  coverage = 0;

  private readonly rng = { s: 1 };
  private readonly material: THREE.MeshStandardMaterial;
  private readonly dummy = new THREE.Object3D();
  private readonly top = new THREE.Color(0xffffff);
  private readonly under = new THREE.Color(0xd8dde8);
  private baseY = 14;
  private windX = 1;
  private windZ = 0;
  private time = 0;

  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
      emissiveIntensity: 0.5,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.material, CLOUDS * MAX_PUFFS);
    this.mesh.frustumCulled = false; // las instancias se mueven fuera de la esfera original
    this.mesh.castShadow = false; // sin sombras: el mapa de sombras es estático y no debe repintarse por las nubes
    this.mesh.receiveShadow = false;
    for (let i = 0; i < CLOUDS; i++) {
      this.clouds.push({ x: 0, y: 0, z: 0, speed: 0, age: 0, life: 1, phase: 0, puffs: [] });
    }
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
    this.material.emissive.copy(sky).lerp(new THREE.Color(0xffffff), 0.6);

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

    const radius = 4 + rngNext(r) * 5;
    const n = 6 + Math.floor(rngNext(r) * (MAX_PUFFS - 5));
    c.puffs = [];
    for (let p = 0; p < MAX_PUFFS; p++) {
      if (p >= n) {
        c.puffs.push({ ox: 0, oy: 0, oz: 0, r: 0, delay: 0, phase: 0, rot: 0 });
        continue;
      }
      const a = rngNext(r) * Math.PI * 2;
      const d = Math.sqrt(rngNext(r)) * radius;
      const oy = rngNext(r) * radius * 0.35;
      c.puffs.push({
        ox: Math.cos(a) * d,
        oy,
        oz: Math.sin(a) * d,
        r: radius * (0.35 + rngNext(r) * 0.3) * (1 - 0.5 * (d / radius)), // más grandes hacia el centro
        delay: rngNext(r) * 0.5,
        phase: rngNext(r) * Math.PI * 2,
        rot: rngNext(r) * Math.PI * 2,
      });
      const shade = Math.min(1, oy / (radius * 0.35));
      this.mesh.setColorAt(index * MAX_PUFFS + p, new THREE.Color().copy(this.under).lerp(this.top, shade));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.time += dt;
    const gust = 1 + 0.25 * Math.sin(this.time * 0.05); // el viento sopla algo más o menos con el tiempo
    const d = this.dummy;
    let coverage = 0;

    for (let ci = 0; ci < CLOUDS; ci++) {
      const c = this.clouds[ci]!;
      c.age += dt;
      if (c.age >= c.life) this.spawn(ci, false); // se disipó del todo: nace otra en otro sitio
      c.x += this.windX * c.speed * gust * dt;
      c.z += this.windZ * c.speed * gust * dt;

      const t = c.age / c.life;
      const growth = smooth(0, 0.3, t) * (1 - smooth(0.7, 1, t)); // acumula, mantiene, disipa
      const bob = Math.sin(this.time * 0.2 + c.phase) * 0.4;
      const spread = 0.6 + 0.4 * growth; // la nube se expande al crecer

      for (let p = 0; p < MAX_PUFFS; p++) {
        const puff = c.puffs[p]!;
        // Las bocanadas aparecen una a una al crecer y se van en orden inverso al disiparse.
        const s = smooth(puff.delay, puff.delay + 0.5, growth);
        const r = puff.r * s * (1 + 0.05 * Math.sin(this.time * 0.6 + puff.phase));
        d.position.set(c.x + puff.ox * spread, c.y + bob + puff.oy * spread, c.z + puff.oz * spread);
        d.rotation.set(0, puff.rot, 0);
        d.scale.set(r, r * 0.7, r); // achatadas: base plana de nube
        d.updateMatrix();
        this.mesh.setMatrixAt(ci * MAX_PUFFS + p, d.matrix);
        coverage += r;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.coverage = coverage;
  }
}
