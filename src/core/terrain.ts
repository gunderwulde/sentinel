import { config } from './config';
import { SIZE, TILES, baseHeight, isFlat, tileX, tileZ } from './grid';
import { next, nextInt, seedFromCode } from './rng';
import type { Landscape, TileId } from './types';

// Generador PROPIO (ver docs/DECISIONS.md D-002): determinista por código, sin equivalencia con el original.
export function generateLandscape(code: number): Landscape {
  const r = { s: seedFromCode(code) };

  let g = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < g.length; i++) g[i] = next(r);

  for (let pass = 0; pass < 5; pass++) {
    const o = new Float32Array(SIZE * SIZE);
    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        let sum = 0;
        let n = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const x = i + di;
            const y = j + dj;
            if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
            sum += g[y * SIZE + x]!;
            n++;
          }
        }
        o[j * SIZE + i] = sum / n;
      }
    }
    g = o;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of g) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const heights = new Int8Array(SIZE * SIZE);
  for (let i = 0; i < g.length; i++) {
    heights[i] = Math.round(((g[i]! - min) / (max - min)) * config.maxTerrainHeight);
  }

  const partial: Landscape = { code, heights, sentinelTile: 0, startTile: 0, trees: [] };
  const flats: TileId[] = [];
  for (let t = 0; t < TILES * TILES; t++) if (isFlat(partial, t)) flats.push(t);

  // Centinela: baldosa plana más alta (desempate con el PRNG).
  const maxH = Math.max(...flats.map((t) => baseHeight(partial, t)));
  const peaks = flats.filter((t) => baseHeight(partial, t) === maxH);
  const sentinelTile = peaks[nextInt(r, peaks.length)]!;

  // Inicio: baldosa plana baja, la más lejana al Centinela.
  const sorted = flats.map((t) => baseHeight(partial, t)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const dist = (t: TileId): number =>
    (tileX(t) - tileX(sentinelTile)) ** 2 + (tileZ(t) - tileZ(sentinelTile)) ** 2;
  let startTile = flats[0]!;
  let best = -1;
  for (const t of flats) {
    if (baseHeight(partial, t) > median) continue;
    const d = dist(t);
    if (d > best) {
      best = d;
      startTile = t;
    }
  }

  const pool = flats.filter((t) => t !== sentinelTile && t !== startTile);
  const trees: TileId[] = [];
  const n = Math.min(config.treesPerLandscape, pool.length);
  for (let k = 0; k < n; k++) {
    const idx = nextInt(r, pool.length);
    trees.push(pool.splice(idx, 1)[0]!);
  }

  return { code, heights, sentinelTile, startTile, trees };
}
