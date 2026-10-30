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
    expect(moved.length).toBeGreaterThan(10);
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
