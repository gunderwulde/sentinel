import type { Landscape, TileId } from './types';

export const SIZE = 32; // vértices por lado
export const TILES = SIZE - 1; // baldosas por lado

export const tileId = (x: number, z: number): TileId => z * TILES + x;
export const tileX = (t: TileId): number => t % TILES;
export const tileZ = (t: TileId): number => Math.floor(t / TILES);

export function vh(l: Landscape, i: number, j: number): number {
  return l.heights[j * SIZE + i]!;
}

export function isFlat(l: Landscape, t: TileId): boolean {
  const x = tileX(t);
  const z = tileZ(t);
  const a = vh(l, x, z);
  return vh(l, x + 1, z) === a && vh(l, x, z + 1) === a && vh(l, x + 1, z + 1) === a;
}

export function baseHeight(l: Landscape, t: TileId): number {
  const x = tileX(t);
  const z = tileZ(t);
  return (vh(l, x, z) + vh(l, x + 1, z) + vh(l, x, z + 1) + vh(l, x + 1, z + 1)) / 4;
}
