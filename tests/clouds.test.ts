import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Clouds } from '../src/render/clouds';

const SKY = new THREE.Color().setHSL(0.6, 0.45, 0.72);
const CY = 16; // dentro del campo para reset(_, 9, _): baseY = 16

function make(code = 7): Clouds {
  const c = new Clouds();
  c.reset(code, 9, SKY);
  return c;
}

function positions(c: Clouds): Float32Array {
  return (c.mesh.geometry.getAttribute('position').array as Float32Array).subarray(0, c.triangleCount * 9);
}

/** Volumen firmado de la malla (positivo si las caras miran hacia fuera). */
function volume(c: Clouds): number {
  const p = positions(c);
  let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!, p[i + 4]!, p[i + 5]!, p[i + 6]!, p[i + 7]!, p[i + 8]!];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

/** Nº de estructuras separadas: soldamos vértices coincidentes y unimos los de cada triángulo. */
function components(c: Clouds): number {
  const p = positions(c);
  const ids = new Map<string, number>();
  const parent: number[] = [];
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!;
      a = parent[a]!;
    }
    return a;
  };
  const id = (i: number): number => {
    const key = `${Math.round(p[i]! * 1e3)},${Math.round(p[i + 1]! * 1e3)},${Math.round(p[i + 2]! * 1e3)}`;
    let v = ids.get(key);
    if (v === undefined) {
      v = parent.length;
      ids.set(key, v);
      parent.push(v);
    }
    return v;
  };
  for (let i = 0; i < p.length; i += 9) {
    const a = id(i);
    const b = id(i + 3);
    const d = id(i + 6);
    parent[find(a)] = find(b);
    parent[find(b)] = find(d);
  }
  return new Set(parent.map((_, k) => find(k))).size;
}

describe('nubes de humedad + marching cubes', () => {
  it('las caras miran hacia fuera', () => {
    const c = make();
    c.debugSet([{ x: 15.5, y: CY, z: 15.5, r: 9, h: 1 }]);
    const p = positions(c);
    let outward = 0;
    let total = 0;
    for (let i = 0; i < p.length; i += 9) {
      const e1 = [p[i + 3]! - p[i]!, p[i + 4]! - p[i + 1]!, p[i + 5]! - p[i + 2]!];
      const e2 = [p[i + 6]! - p[i]!, p[i + 7]! - p[i + 1]!, p[i + 8]! - p[i + 2]!];
      const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      if (Math.hypot(n[0]!, n[1]!, n[2]!) < 1e-9) continue;
      const cx = (p[i]! + p[i + 3]! + p[i + 6]!) / 3 - 15.5;
      const cy = (p[i + 1]! + p[i + 4]! + p[i + 7]!) / 3 - CY;
      const cz = (p[i + 2]! + p[i + 5]! + p[i + 8]!) / 3 - 15.5;
      total++;
      if (n[0]! * cx + n[1]! * cy + n[2]! * cz > 0) outward++;
    }
    expect(total).toBeGreaterThan(100);
    expect(outward / total).toBeGreaterThan(0.97);
    expect(volume(c)).toBeGreaterThan(0);
  });

  it('más humedad = estructura más grande; por debajo del umbral no hay nube', () => {
    const c = make();
    const at = (h: number): number => {
      c.debugSet([{ x: 15.5, y: CY, z: 15.5, r: 9, h }]);
      return volume(c);
    };
    const v1 = at(1.2);
    const v2 = at(0.8);
    const v3 = at(0.5);
    expect(v1).toBeGreaterThan(v2);
    expect(v2).toBeGreaterThan(v3);
    expect(v3).toBeGreaterThan(0);
    c.debugSet([{ x: 15.5, y: CY, z: 15.5, r: 9, h: 0.3 }]);
    expect(c.triangleCount).toBe(0); // sin humedad suficiente no se dibuja nada (y tampoco se «recortan» caras)
  });

  it('dos acumulaciones cercanas se funden en una sola estructura; lejos, quedan separadas', () => {
    const c = make();
    const two = (dist: number): number => {
      c.debugSet([
        { x: 15.5 - dist / 2, y: CY, z: 15.5, r: 9, h: 0.7 },
        { x: 15.5 + dist / 2, y: CY, z: 15.5, r: 9, h: 0.7 },
      ]);
      return components(c);
    };
    expect(two(14)).toBe(2);
    expect(two(8)).toBe(1);
  });

  it('subir la humedad de un punto cercano acerca y acaba uniendo las estructuras', () => {
    const c = make();
    const comps = (h: number): number => {
      c.debugSet([
        { x: 10, y: CY, z: 15.5, r: 9, h: 0.7 },
        { x: 21, y: CY, z: 15.5, r: 9, h },
      ]);
      return components(c);
    };
    expect(comps(0.45)).toBe(2);
    expect(comps(1.3)).toBe(1);
  });

  it('la humedad sube y baja con el tiempo y nunca es NaN', () => {
    const c = make();
    const series: number[] = [];
    for (let t = 0; t < 300; t += 0.1) {
      c.update(0.1);
      series.push(c.humidity);
    }
    expect(series.every((h) => Number.isFinite(h) && h >= 0)).toBe(true);
    expect(Math.max(...series)).toBeGreaterThan(Math.min(...series) * 1.1);
  });

  it('las nubes crecen y se encogen de forma continua, sin saltos ni caras que aparecen o desaparecen', () => {
    const c = make(3);
    const vols: number[] = [];
    for (let t = 0; t < 150; t += 0.1) {
      c.update(0.1);
      vols.push(volume(c));
    }
    const max = Math.max(...vols);
    expect(max).toBeGreaterThan(0);
    let maxStep = 0;
    for (let i = 1; i < vols.length; i++) maxStep = Math.max(maxStep, Math.abs(vols[i]! - vols[i - 1]!));
    expect(maxStep / max).toBeLessThan(0.08); // ningún paso cambia más del 8 % del volumen máximo
    expect(Math.min(...vols.slice(50))).toBeLessThan(max * 0.9); // y sí hay variación real
  });

  it('es determinista por semilla y distinto entre paisajes', () => {
    const run = (code: number): number[] => {
      const c = make(code);
      const out: number[] = [];
      for (let t = 0; t < 30; t += 0.1) {
        c.update(0.1);
        out.push(c.humidity);
      }
      return out;
    };
    expect(run(11)).toEqual(run(11));
    expect(run(11)).not.toEqual(run(12));
  });

  it('las nubes derivan con el viento y quedan por encima del terreno', () => {
    const c = make(5);
    const before = c.clusters.map((k) => ({ x: k.x, z: k.z, age: k.age }));
    c.update(5);
    const moved = c.clusters
      .map((k, i) => ({ dx: k.x - before[i]!.x, dz: k.z - before[i]!.z, same: k.age > before[i]!.age }))
      .filter((m) => m.same);
    expect(moved.length).toBeGreaterThan(6);
    const d0 = Math.atan2(moved[0]!.dz, moved[0]!.dx);
    for (const m of moved) {
      expect(Math.abs(Math.atan2(Math.sin(Math.atan2(m.dz, m.dx) - d0), Math.cos(Math.atan2(m.dz, m.dx) - d0)))).toBeLessThan(1e-6);
      expect(Math.hypot(m.dx, m.dz)).toBeLessThan(10); // movimiento leve
    }
    for (const k of c.clusters) expect(k.y).toBeGreaterThanOrEqual(9 + 11 - 0.5);
  });

  it('reconstruir el campo y la malla es barato', () => {
    const c = make(2);
    let sum = 0;
    let steps = 0;
    for (let t = 0; t < 60; t += 0.1) {
      c.update(0.1);
      sum += c.lastBuildMs;
      steps++;
    }
    expect(sum / steps).toBeLessThan(25); // a 10 Hz: holgura enorme frente a un frame de 16 ms
  });

  it("la humedad cambia despacio: ningún punto sube o baja más de 0,12 por segundo", () => {
    const c = make(9);
    const prev = new Map<object, number>();
    let worst = 0;
    for (let t = 0; t < 400; t += 0.1) {
      c.update(0.1);
      for (const k of c.clusters) {
        for (const p of k.points) {
          const before = prev.get(p);
          // Un punto recién creado (h pasa de un clúster viejo a uno nuevo) no cuenta como salto.
          if (before !== undefined && k.age > 0.2) worst = Math.max(worst, Math.abs(p.h - before) / 0.1);
          prev.set(p, p.h);
        }
      }
    }
    expect(worst).toBeLessThan(0.12);
  });
});
