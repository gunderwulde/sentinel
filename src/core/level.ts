import { TILES, baseHeight, isFlat, tileX, tileZ } from './grid';
import { generateLandscape } from './terrain';
import type { TileId, World } from './types';
import { canSee } from './visibility';
import { createWorldFromLandscape, eyePos } from './world';

/**
 * Mundo inicial del paisaje `code`. RULES §7.4: el jugador no debe empezar a la vista del Centinela;
 * si el generador lo coloca visible, se busca la baldosa plana más lejana y oculta (y más baja que el pedestal).
 */
export function createWorld(code: number): World {
  let landscape = generateLandscape(code);
  let w = createWorldFromLandscape(landscape);
  const sentinel = w.entities.get(w.sentinelId!)!;
  const eye = eyePos(w, sentinel);
  const seen = (t: TileId): boolean =>
    canSee(w, eye, { x: tileX(t) + 0.5, y: baseHeight(landscape, t), z: tileZ(t) + 0.5 }, t);

  if (!seen(landscape.startTile)) return w;

  const taken = new Set<TileId>(landscape.trees);
  taken.add(landscape.sentinelTile);
  const maxY = baseHeight(landscape, landscape.sentinelTile) - 2;
  let best = -1;
  let bestTile = -1;
  for (let t = 0; t < TILES * TILES; t++) {
    if (taken.has(t) || !isFlat(landscape, t) || baseHeight(landscape, t) > maxY || seen(t)) continue;
    const d = (tileX(t) - tileX(landscape.sentinelTile)) ** 2 + (tileZ(t) - tileZ(landscape.sentinelTile)) ** 2;
    if (d > best) {
      best = d;
      bestTile = t;
    }
  }
  if (bestTile >= 0) {
    landscape = { ...landscape, startTile: bestTile };
    w = createWorldFromLandscape(landscape);
  }
  return w;
}
