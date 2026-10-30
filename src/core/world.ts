import { config } from './config';
import { baseHeight, isFlat, tileX, tileZ, TILES } from './grid';
import { next, nextInt, seedFromCode } from './rng';
import { generateLandscape } from './terrain';
import type { Entity, GameEvent, Landscape, ObjectKind, TileId, Vec3, World } from './types';

export function createWorld(code: number): World {
  return createWorldFromLandscape(generateLandscape(code));
}

export function createWorldFromLandscape(landscape: Landscape): World {
  const w: World = {
    tick: 0,
    landscape,
    entities: new Map(),
    stacks: new Map(),
    nextId: 1,
    sentinelId: null,
    player: { synthoidId: 0, energy: config.startEnergy },
    status: 'playing',
    rng: { s: (seedFromCode(landscape.code) ^ 0x5bd1e995) >>> 0 },
    ai: { targetId: null, count: 0 },
  };
  w.sentinelId = addEntity(w, 'sentinel', landscape.sentinelTile, next(w.rng) * Math.PI * 2);
  w.player.synthoidId = addEntity(w, 'synthoid', landscape.startTile, 0);
  for (const t of landscape.trees) addEntity(w, 'tree', t, next(w.rng) * Math.PI * 2);
  return w;
}

export function addEntity(w: World, kind: ObjectKind, tile: TileId, yaw: number): number {
  const id = w.nextId++;
  w.entities.set(id, { id, kind, tile, yaw });
  const s = w.stacks.get(tile);
  if (s) s.push(id);
  else w.stacks.set(tile, [id]);
  return id;
}

export function removeEntity(w: World, id: number): void {
  const e = w.entities.get(id);
  if (!e) return;
  w.entities.delete(id);
  const s = w.stacks.get(e.tile);
  if (s) {
    s.splice(s.indexOf(id), 1);
    if (s.length === 0) w.stacks.delete(e.tile);
  }
  if (w.sentinelId === id) w.sentinelId = null;
}

export function topId(w: World, tile: TileId): number | undefined {
  const s = w.stacks.get(tile);
  return s && s.length > 0 ? s[s.length - 1] : undefined;
}

export function boulderCount(w: World, tile: TileId): number {
  const s = w.stacks.get(tile);
  if (!s) return 0;
  let n = 0;
  for (const id of s) if (w.entities.get(id)?.kind === 'boulder') n++;
  return n;
}

export function pedestalOf(w: World, tile: TileId): number {
  return tile === w.landscape.sentinelTile ? config.pedestalHeight : 0;
}

/** Altura sobre la que se apoyaría el siguiente objeto de la baldosa. */
export function tileTopY(w: World, tile: TileId): number {
  return baseHeight(w.landscape, tile) + pedestalOf(w, tile) + boulderCount(w, tile) * config.boulderHeight;
}

export function footY(w: World, e: Entity): number {
  const idx = w.stacks.get(e.tile)?.indexOf(e.id) ?? 0;
  return baseHeight(w.landscape, e.tile) + pedestalOf(w, e.tile) + idx * config.boulderHeight;
}

export function footPoint(w: World, e: Entity): Vec3 {
  return { x: tileX(e.tile) + 0.5, y: footY(w, e), z: tileZ(e.tile) + 0.5 };
}

export function eyePos(w: World, e: Entity): Vec3 {
  const p = footPoint(w, e);
  p.y += e.kind === 'sentinel' ? config.eyeHeight.sentinel : config.eyeHeight.synthoid;
  return p;
}

export function playerEntity(w: World): Entity | undefined {
  return w.entities.get(w.player.synthoidId);
}

export function isFree(w: World, tile: TileId): boolean {
  return !w.stacks.has(tile) && tile !== w.landscape.sentinelTile && isFlat(w.landscape, tile);
}

export function freeTiles(w: World): TileId[] {
  const out: TileId[] = [];
  for (let t = 0; t < TILES * TILES; t++) if (isFree(w, t)) out.push(t);
  return out;
}

/** Devuelve la energía absorbida al paisaje como árboles (conservación de energía). */
export function spawnTrees(w: World, count: number, events: GameEvent[]): void {
  for (let k = 0; k < count; k++) {
    const free = freeTiles(w);
    if (free.length === 0) return;
    const tile = free[nextInt(w.rng, free.length)]!;
    const id = addEntity(w, 'tree', tile, next(w.rng) * Math.PI * 2);
    events.push({ t: 'created', id, kind: 'tree', tile });
  }
}

export function totalEnergy(w: World): number {
  let sum = w.player.energy;
  for (const e of w.entities.values()) sum += config.energy[e.kind];
  return sum;
}
