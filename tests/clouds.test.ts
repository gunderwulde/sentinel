import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Clouds } from '../src/render/clouds';

const SKY = new THREE.Color().setHSL(0.6, 0.45, 0.72);

function run(code: number, seconds: number, step = 0.1): { clouds: Clouds; coverage: number[] } {
  const clouds = new Clouds();
  clouds.reset(code, 9, SKY);
  const coverage: number[] = [];
  for (let t = 0; t < seconds; t += step) {
    clouds.update(step);
    coverage.push(clouds.coverage);
  }
  return { clouds, coverage };
}

describe('nubes procedurales', () => {
  it('se acumulan y se disipan con el tiempo (la cobertura sube y baja, nunca es NaN)', () => {
    const { coverage } = run(7, 300);
    expect(coverage.every((c) => Number.isFinite(c) && c >= 0)).toBe(true);
    const min = Math.min(...coverage);
    const max = Math.max(...coverage);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(min * 1.05); // hay variación apreciable, no es una cifra fija
  });

  it('derivan con el viento en una dirección coherente', () => {
    const c = new Clouds();
    c.reset(3, 9, SKY);
    const before = c.clouds.map((x) => ({ x: x.x, z: x.z, age: x.age }));
    c.update(5); // 5 s: ninguna nube llega al final de su vida (≥45 s) salvo que ya estuviera casi muerta
    const moved = c.clouds
      .map((x, i) => ({ dx: x.x - before[i]!.x, dz: x.z - before[i]!.z, same: x.age > before[i]!.age }))
      .filter((m) => m.same);
    expect(moved.length).toBeGreaterThan(6);
    // Todas se desplazan en el mismo sentido (el viento es global) y poco: es un movimiento leve.
    const dirs = moved.map((m) => Math.atan2(m.dz, m.dx));
    for (const d of dirs) expect(Math.abs(Math.atan2(Math.sin(d - dirs[0]!), Math.cos(d - dirs[0]!)))).toBeLessThan(1e-6);
    for (const m of moved) expect(Math.hypot(m.dx, m.dz)).toBeLessThan(10);
  });

  it('es determinista por semilla y distinto entre paisajes', () => {
    const a = run(11, 40).coverage;
    const b = run(11, 40).coverage;
    const c = run(12, 40).coverage;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('siempre queda por encima del terreno', () => {
    const { clouds } = run(5, 120);
    for (const c of clouds.clouds) expect(c.y).toBeGreaterThanOrEqual(9 + 7 - 0.5);
  });
});

describe('nubes con marching cubes', () => {
  function triangles(geo: THREE.BufferGeometry): Float32Array {
    return geo.getAttribute('position').array as Float32Array;
  }

  it('cada nube es una malla no vacía y condensa de dentro hacia fuera', () => {
    const c = new Clouds();
    c.reset(21, 9, SKY);
    for (const cloud of c.clouds) {
      const geo = cloud.mesh.geometry;
      expect(geo.getAttribute('position').count).toBeGreaterThan(90); // decenas de triángulos
      const thr = geo.getAttribute('aThreshold').array as Float32Array;
      expect(Math.min(...thr)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...thr)).toBeLessThanOrEqual(1);
    }
  });

  it('los triángulos miran hacia fuera (el flat shading y el culling dependen de ello)', () => {
    const c = new Clouds();
    c.reset(8, 9, SKY);
    let outward = 0;
    let total = 0;
    for (const cloud of c.clouds) {
      const p = triangles(cloud.mesh.geometry);
      for (let i = 0; i < p.length; i += 9) {
        const e1 = [p[i + 3]! - p[i]!, p[i + 4]! - p[i + 1]!, p[i + 5]! - p[i + 2]!];
        const e2 = [p[i + 6]! - p[i]!, p[i + 7]! - p[i + 1]!, p[i + 8]! - p[i + 2]!];
        const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        const area = Math.hypot(n[0]!, n[1]!, n[2]!);
        if (area < 1e-6) continue; // triángulos colapsados contra la base plana
        const cx = (p[i]! + p[i + 3]! + p[i + 6]!) / 3;
        const cy = (p[i + 1]! + p[i + 4]! + p[i + 7]!) / 3;
        const cz = (p[i + 2]! + p[i + 5]! + p[i + 8]!) / 3;
        total++;
        if (n[0]! * cx + n[1]! * cy + n[2]! * cz > 0) outward++;
      }
    }
    expect(total).toBeGreaterThan(500);
    expect(outward / total).toBeGreaterThan(0.97);
  });

  it('la base es plana y las nubes siguen siendo baratas de generar', () => {
    const t0 = performance.now();
    const c = new Clouds();
    c.reset(2, 9, SKY);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(1500); // 12 nubes; en la práctica unas decenas de ms
    for (const cloud of c.clouds) {
      const p = triangles(cloud.mesh.geometry);
      let minY = Infinity;
      for (let i = 1; i < p.length; i += 3) minY = Math.min(minY, p[i]!);
      expect(minY).toBeGreaterThanOrEqual(-0.12 * cloud.size * 0.8 - 1e-4);
    }
  });

  it('condensarse y disiparse afecta a la nube entera: el crecimiento llega a 0 y a 1', () => {
    const c = new Clouds();
    c.reset(4, 9, SKY);
    const seen = c.clouds.map(() => ({ min: 1, max: 0 }));
    for (let t = 0; t < 200; t += 0.5) {
      c.update(0.5);
      c.clouds.forEach((cl, i) => {
        seen[i]!.min = Math.min(seen[i]!.min, cl.growth);
        seen[i]!.max = Math.max(seen[i]!.max, cl.growth);
      });
    }
    // En 200 s (vida máx. 90 s) toda nube pasa por casi vacía y por casi completa.
    for (const s of seen) {
      expect(s.min).toBeLessThan(0.05);
      expect(s.max).toBeGreaterThan(0.95);
    }
  });
});
