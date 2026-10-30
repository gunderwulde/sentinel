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
  config,
  surfaceY,
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

describe('generación de paisajes (muestra de 345 códigos)', () => {
  it('cumple los requisitos duros de RULES §7', () => {
    let startSeen = 0;
    let n = 0;
    for (let code = 0; code < 10000; code += 29) {
      const w = createWorld(code);
      const l = w.landscape;
      n++;
      expect(isFlat(l, l.sentinelTile)).toBe(true);
      expect(isFlat(l, l.startTile)).toBe(true);
      expect(l.startTile).not.toBe(l.sentinelTile);
      expect(l.trees.length).toBeGreaterThanOrEqual(10);
      const s = w.entities.get(w.sentinelId!)!;
      const foot = { x: (l.startTile % TILES) + 0.5, y: baseOf(w, l.startTile), z: Math.floor(l.startTile / TILES) + 0.5 };
      if (canSee(w, eyePos(w, s), foot, l.startTile)) startSeen++;
    }
    expect(startSeen / n).toBeLessThan(0.01); // RULES §7.4: el inicio no es visible desde el Centinela
  });
});

function baseOf(w: ReturnType<typeof createWorld>, tile: number): number {
  const x = tile % TILES;
  const z = Math.floor(tile / TILES);
  const h = (i: number, j: number): number => w.landscape.heights[j * SIZE + i]!;
  return (h(x, z) + h(x + 1, z) + h(x, z + 1) + h(x + 1, z + 1)) / 4;
}

describe('visibility', () => {
  it('la superficie usa la misma triangulación que la malla del render', () => {
    const l = flatLandscape();
    l.heights[6 * SIZE + 6] = 4; // vértice (6,6) = h11 de la baldosa (5,5)
    const w = createWorldFromLandscape(l);
    expect(surfaceY(w, 5.5, 5.5)).toBeCloseTo(0, 6); // bilineal daría 1
    expect(surfaceY(w, 5.9, 5.9)).toBeCloseTo(3.2, 6); // 4 + (0.1)(0-4)+(0.1)(0-4)
  });

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
    let accepted = 0;
    for (let i = 0; i < 600; i++) {
      const ids = [...w.entities.keys()];
      let cmd: Command;
      const p = rnd();
      if (p < 0.5) {
        // Baldosas cercanas al jugador: las lejanas casi siempre fallan por visibilidad.
        const me = playerEntity(w)!;
        const x = Math.min(TILES - 1, Math.max(0, (me.tile % TILES) + Math.floor(rnd() * 13) - 6));
        const z = Math.min(TILES - 1, Math.max(0, Math.floor(me.tile / TILES) + Math.floor(rnd() * 13) - 6));
        cmd = { t: 'create', kind: kinds[Math.floor(rnd() * 3)]!, tile: tileId(x, z) };
      }
      else if (p < 0.85) cmd = { t: 'absorb', target: ids[Math.floor(rnd() * ids.length)]! };
      else cmd = { t: 'transfer', target: ids[Math.floor(rnd() * ids.length)]! };
      if (!apply(w, cmd).error) accepted++;
      for (let k = 0; k < 10; k++) tick(w);
      expect(totalEnergy(w)).toBe(initial);
    }
    // Sin esto el test podría pasar con todas las órdenes rechazadas.
    expect(accepted).toBeGreaterThan(20);
  });

  it('el hiperespacio es un sumidero deliberado: cuesta exactamente su coste', () => {
    const w = createWorldFromLandscape(flatLandscape());
    const before = totalEnergy(w);
    const r = apply(w, { t: 'hyperspace' });
    expect(r.error).toBeUndefined();
    expect(totalEnergy(w)).toBe(before - config.hyperspaceCost);
  });

  it('rechaza tiles NaN, fraccionarios o fuera de rango sin cobrar energía', () => {
    const w = createWorldFromLandscape(flatLandscape());
    const before = totalEnergy(w);
    for (const tile of [NaN, 100.5, -1, TILES * TILES, Infinity]) {
      expect(apply(w, { t: 'create', kind: 'tree', tile }).error).toBe('InvalidTile');
    }
    expect(totalEnergy(w)).toBe(before);
    expect(w.entities.size).toBe(2); // Centinela + synthoid
  });

  it('victoria: absorber al Centinela, crear un robot en su pedestal, transferirse e hiperespaciar', () => {
    const w = createWorldFromLandscape(flatLandscape());
    expect(apply(w, { t: 'absorb', target: w.sentinelId! }).error).toBeUndefined();
    const pedestal = tileId(28, 28);
    expect(apply(w, { t: 'create', kind: 'synthoid', tile: pedestal }).error).toBeUndefined();
    const robot = [...w.entities.values()].find((e) => e.kind === 'synthoid' && e.tile === pedestal)!;
    expect(apply(w, { t: 'transfer', target: robot.id }).error).toBeUndefined();
    const r = apply(w, { t: 'hyperspace' });
    expect(r.error).toBeUndefined();
    expect(w.status).toBe('won');
    expect(r.events.some((e) => e.t === 'won')).toBe(true);
  });

  it('derrota: el Centinela ve al jugador sin energía, avisa y lo absorbe', () => {
    const w = createWorldFromLandscape({ ...flatLandscape(), sentinelTile: tileId(10, 15) });
    const s = w.entities.get(w.sentinelId!)!;
    s.yaw = -Math.PI / 2 - config.ai.turnStepRad; // tras un paso, mira al jugador (al oeste)
    w.player.energy = 0;
    const events = [];
    for (let i = 0; i < config.ai.turnIntervalTicks * 2; i++) events.push(...tick(w));
    expect(events.some((e) => e.t === 'drainWarning')).toBe(true);
    expect(w.status).toBe('lost');
  });

  it('el drenaje avisa siempre antes de quitar energía', () => {
    const w = createWorldFromLandscape({ ...flatLandscape(), sentinelTile: tileId(10, 15) });
    w.entities.get(w.sentinelId!)!.yaw = -Math.PI / 2 - config.ai.turnStepRad;
    const seen: string[] = [];
    for (let i = 0; i < config.ai.turnIntervalTicks * 6; i++) for (const e of tick(w)) seen.push(e.t);
    const firstDrain = seen.indexOf('drained');
    expect(firstDrain).toBeGreaterThan(-1);
    expect(seen.indexOf('drainWarning')).toBeLessThan(firstDrain);
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
