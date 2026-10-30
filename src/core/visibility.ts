import { config } from './config';
import { TILES, tileId, vh } from './grid';
import { boulderCount, pedestalOf } from './world';
import type { TileId, Vec3, World } from './types';

const EPS = 0.02;

/** Altura de la superficie en (x,z): interpolación bilineal + objetos apilados de la baldosa. */
export function surfaceY(w: World, x: number, z: number): number {
  const ix = Math.min(TILES - 1, Math.max(0, Math.floor(x)));
  const iz = Math.min(TILES - 1, Math.max(0, Math.floor(z)));
  const fx = Math.min(1, Math.max(0, x - ix));
  const fz = Math.min(1, Math.max(0, z - iz));
  const l = w.landscape;
  const h =
    vh(l, ix, iz) * (1 - fx) * (1 - fz) +
    vh(l, ix + 1, iz) * fx * (1 - fz) +
    vh(l, ix, iz + 1) * (1 - fx) * fz +
    vh(l, ix + 1, iz + 1) * fx * fz;
  const t = tileId(ix, iz);
  return h + pedestalOf(w, t) + boulderCount(w, t) * config.boulderHeight;
}

/**
 * Línea de visión de `from` al punto `to` (apoyo de un objeto en `toTile`).
 * Dentro de la baldosa destino el rayo debe llegar por encima del punto: no se ve la parte alta de una baldosa
 * más elevada que el observador.
 */
export function canSee(w: World, from: Vec3, to: Vec3, toTile: TileId): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(dist / config.visibilityStep));
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    const x = from.x + dx * f;
    const y = from.y + dy * f;
    const z = from.z + dz * f;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= TILES || iz >= TILES) continue;
    if (tileId(ix, iz) === toTile) {
      if (y < to.y - EPS) return false;
      continue;
    }
    if (y < surfaceY(w, x, z) - EPS) return false;
  }
  return true;
}
