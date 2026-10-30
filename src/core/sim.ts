import { config } from './config';
import { TILES, baseHeight, isFlat, tileX, tileZ } from './grid';
import { nextInt } from './rng';
import { canSee } from './visibility';
import {
  addEntity,
  eyePos,
  footPoint,
  footY,
  freeTiles,
  playerEntity,
  removeEntity,
  tileTopY,
  topId,
} from './world';
import type { ApplyResult, Command, CreatableKind, GameEvent, RuleError, TileId, World } from './types';

function fail(error: RuleError): ApplyResult {
  return { events: [], error };
}

export function checkAbsorb(w: World, id: number): RuleError | undefined {
  const e = w.entities.get(id);
  const me = playerEntity(w);
  if (!e || !me || id === me.id) return 'NoSuchTarget';
  if (topId(w, e.tile) !== id) return 'HasObjectOnTop';
  if (!canSee(w, eyePos(w, me), footPoint(w, e), e.tile)) return 'NotVisible';
  return undefined;
}

export function checkCreate(w: World, kind: CreatableKind, tile: TileId): RuleError | undefined {
  const me = playerEntity(w);
  if (!me) return 'GameOver';
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILES * TILES) return 'InvalidTile';
  if (!isFlat(w.landscape, tile)) return 'NotFlat';
  const top = topId(w, tile);
  if (top !== undefined && w.entities.get(top)?.kind !== 'boulder') return 'InvalidTile';
  if (w.player.energy < config.energy[kind]) return 'NotEnoughEnergy';
  const target = { x: tileX(tile) + 0.5, y: tileTopY(w, tile), z: tileZ(tile) + 0.5 };
  if (!canSee(w, eyePos(w, me), target, tile)) return 'NotVisible';
  return undefined;
}

export function checkTransfer(w: World, id: number): RuleError | undefined {
  const e = w.entities.get(id);
  const me = playerEntity(w);
  if (!e || !me || e.kind !== 'synthoid' || id === me.id) return 'NoSuchTarget';
  if (topId(w, e.tile) !== id) return 'HasObjectOnTop';
  if (!canSee(w, eyePos(w, me), footPoint(w, e), e.tile)) return 'NotVisible';
  return undefined;
}

export function apply(w: World, cmd: Command): ApplyResult {
  if (w.status !== 'playing') return fail('GameOver');
  const events: GameEvent[] = [];
  const me = playerEntity(w);
  if (!me) return fail('GameOver');

  switch (cmd.t) {
    case 'absorb': {
      const error = checkAbsorb(w, cmd.target);
      if (error) return fail(error);
      const e = w.entities.get(cmd.target)!;
      const gain = config.energy[e.kind];
      removeEntity(w, e.id);
      w.player.energy += gain;
      events.push({ t: 'absorbed', id: e.id, kind: e.kind, gain });
      if (e.kind === 'sentinel') events.push({ t: 'sentinelAbsorbed' });
      return { events };
    }
    case 'create': {
      const error = checkCreate(w, cmd.kind, cmd.tile);
      if (error) return fail(error);
      w.player.energy -= config.energy[cmd.kind];
      const yaw = Math.atan2(eyePos(w, me).x - (tileX(cmd.tile) + 0.5), eyePos(w, me).z - (tileZ(cmd.tile) + 0.5));
      const id = addEntity(w, cmd.kind, cmd.tile, yaw);
      events.push({ t: 'created', id, kind: cmd.kind, tile: cmd.tile });
      return { events };
    }
    case 'transfer': {
      const error = checkTransfer(w, cmd.target);
      if (error) return fail(error);
      w.player.synthoidId = cmd.target;
      events.push({ t: 'transferred', to: cmd.target });
      return { events };
    }
    case 'hyperspace': {
      if (w.player.energy < config.hyperspaceCost) return fail('NotEnoughEnergy');
      if (me.tile === w.landscape.sentinelTile && w.sentinelId === null) {
        w.status = 'won';
        events.push({ t: 'hyperspace', tile: me.tile }, { t: 'won' });
        return { events };
      }
      const here = footY(w, me);
      // RULES §4: solo a baldosas igual de bajas o más; si no hay sitio, falla.
      const pool = freeTiles(w).filter((t) => baseHeight(w.landscape, t) <= here);
      if (pool.length === 0) return fail('InvalidTile');
      const tile = pool[nextInt(w.rng, pool.length)]!;
      removeEntity(w, me.id);
      w.player.energy -= config.hyperspaceCost;
      w.player.synthoidId = addEntity(w, 'synthoid', tile, 0);
      events.push({ t: 'hyperspace', tile });
      return { events };
    }
  }
}
