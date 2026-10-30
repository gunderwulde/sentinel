import { config } from './config';
import { TILES, tileId, vh } from './grid';
import type { TileId, Vec3, World } from './types';

const EPS = 0.02;

/**
 * Altura de la superficie en (x,z) + objetos apilados de la baldosa.
 * Usa la MISMA triangulación que la malla del render (diagonal (x,z+1)-(x+1,z)), para que lo que se ve
 * en pantalla y lo que dicta la regla de visión coincidan.
 */
export function surfaceY(w: World, x: number, z: number): number {
  const ix = Math.min(TILES - 1, Math.max(0, Math.floor(x)));
  const iz = Math.min(TILES - 1, Math.max(0, Math.floor(z)));
  const fx = Math.min(1, Math.max(0, x - ix));
  const fz = Math.min(1, Math.max(0, z - iz));
  const l = w.landscape;
  const h00 = vh(l, ix, iz);
  const h10 = vh(l, ix + 1, iz);
  const h01 = vh(l, ix, iz + 1);
  const h11 = vh(l, ix + 1, iz + 1);
  const h =
    fx + fz <= 1
      ? h00 + fx * (h10 - h00) + fz * (h01 - h00)
      : h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  return h + w.lift[tileId(ix, iz)]!;
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
