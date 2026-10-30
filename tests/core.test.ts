import { describe, expect, it } from 'vitest';
import {
  SIZE,
  TILES,
  apply,
  canSee,
  createWorld,
  createWorldFromLandscape,
  eyePos,
  generateLandscape,
  isFlat,
  playerEntity,
  tick,
  tileId,
  totalEnergy,
  checkCreate,
} from '../src/core';
import type { Command, Landscape } from '../src/core';

function flatLandscape(wall?: { x: number; h: number }): Landscape {
  const heights = new Int8Array(SIZE * SIZE);
  if (wall) for (let j = 0; j < SIZE; j++) heights[j * SIZE + wall.x] = wall.h;
  return { code: 1, heights, sentinelTile: tileId(28, 28), startTile: tileId(2, 15), trees: [] };
}

describe('terrain', () => {
  it('es determinista por código', () => {
    const a = generateLandscape(42);
    const b = generateLandscape(42);
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(a.sentinelTile).toBe(b.sentinelTile);
    expect(a.trees).toEqual(b.trees);
  });

  it('coloca Centinela e inicio en baldosas planas, con el Centinela más alto', () => {
    for (const code of [0, 1, 7, 123, 4567, 9999]) {
      const l = generateLandscape(code);
      expect(isFlat(l, l.sentinelTile)).toBe(true);
      expect(isFlat(l, l.startTile)).toBe(true);
      expect(l.sentinelTile).not.toBe(l.startTile);
      expect(l.trees.length).toBeGreaterThan(0);
    }
  });
});

describe('visibility', () => {
  it('ve una baldosa del mismo nivel', () => {
    const w = createWorldFromLandscape(flatLandscape());
    const me = playerEntity(w)!;
    const target = { x: 10.5, y: 0, z: 15.5 };
    expect(canSee(w, eyePos(w, me), target, tileId(10, 15))).toBe(true);
  });

  it('un muro alto lo bloquea', () => {
    const w = createWorldFromLandscape(flatLandscape({ x: 6, h: 6 }));
    const me = playerEntity(w)!;
    const target = { x: 10.5, y: 0, z: 15.5 };
    expect(canSee(w, eyePos(w, me), target, tileId(10, 15))).toBe(false);
  });
});

describe('sim', () => {
  it('crear un árbol cuesta su energía', () => {
    const w = createWorldFromLandscape(flatLandscape());
    const before = w.player.energy;
    const r = apply(w, { t: 'create', kind: 'tree', tile: tileId(5, 15) });
    expect(r.error).toBeUndefined();
    expect(w.player.energy).toBe(before - 1);
  });

  it('no se puede crear sin energía suficiente', () => {
    const w = createWorldFromLandscape(flatLandscape());
    w.player.energy = 0;
    expect(checkCreate(w, 'tree', tileId(5, 15))).toBe('NotEnoughEnergy');
  });

  it('absorber devuelve la energía', () => {
    const w = createWorldFromLandscape(flatLandscape());
    apply(w, { t: 'create', kind: 'boulder', tile: tileId(5, 15) });
    const id = [...w.entities.values()].find((e) => e.kind === 'boulder')!.id;
    const r = apply(w, { t: 'absorb', target: id });
    expect(r.error).toBeUndefined();
    expect(w.player.energy).toBe(10);
  });

  it('conserva la energía total con órdenes aleatorias y ticks (sin hiperespacio)', () => {
    const w = createWorld(3);
    const initial = totalEnergy(w);
    let seed = 12345;
    const rnd = (): number => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    const kinds = ['tree', 'boulder', 'synthoid'] as const;
    for (let i = 0; i < 600; i++) {
      const ids = [...w.entities.keys()];
      let cmd: Command;
      const p = rnd();
      if (p < 0.5) cmd = { t: 'create', kind: kinds[Math.floor(rnd() * 3)]!, tile: Math.floor(rnd() * TILES * TILES) };
      else if (p < 0.85) cmd = { t: 'absorb', target: ids[Math.floor(rnd() * ids.length)]! };
      else cmd = { t: 'transfer', target: ids[Math.floor(rnd() * ids.length)]! };
      apply(w, cmd);
      for (let k = 0; k < 10; k++) tick(w);
      expect(totalEnergy(w)).toBe(initial);
    }
  });

  it('es determinista: mismas órdenes, mismo resultado', () => {
    const run = (): string => {
      const w = createWorld(9);
      for (let i = 0; i < 300; i++) {
        apply(w, { t: 'create', kind: 'tree', tile: (i * 37) % (TILES * TILES) });
        tick(w);
      }
      return JSON.stringify([w.player, w.status, [...w.entities.values()]]);
    };
    expect(run()).toBe(run());
  });
});
