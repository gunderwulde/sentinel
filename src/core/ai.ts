import { config } from './config';
import { tileX, tileZ } from './grid';
import { canSee } from './visibility';
import { eyePos, footPoint, removeEntity, spawnTrees, topId } from './world';
import type { Entity, GameEvent, World } from './types';

const TWO_PI = Math.PI * 2;

function wrap(a: number): number {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r < -Math.PI) r += TWO_PI;
  return r;
}

function priority(w: World, e: Entity): number {
  if (e.id === w.player.synthoidId) return 0;
  if (e.kind === 'synthoid') return 1;
  if (e.kind === 'boulder') return 2;
  return 3;
}

/** Un paso de giro del Centinela: gira, escanea y actúa sobre lo que ve. */
export function aiStep(w: World, events: GameEvent[]): void {
  const s = w.sentinelId === null ? undefined : w.entities.get(w.sentinelId);
  if (!s) return;
  s.yaw = wrap(s.yaw + config.ai.turnStepRad);

  const eye = eyePos(w, s);
  let target: Entity | undefined;
  for (const e of w.entities.values()) {
    if (e.kind === 'sentinel' || topId(w, e.tile) !== e.id) continue;
    const dx = tileX(e.tile) + 0.5 - eye.x;
    const dz = tileZ(e.tile) + 0.5 - eye.z;
    if (Math.abs(wrap(Math.atan2(dx, dz) - s.yaw)) > config.ai.coneHalfRad) continue;
    if (target && priority(w, target) <= priority(w, e)) continue;
    if (!canSee(w, eye, footPoint(w, e), e.tile)) continue;
    target = e;
  }

  if (!target) {
    w.ai.targetId = null;
    w.ai.count = 0;
    return;
  }
  if (w.ai.targetId === target.id) {
    w.ai.count++;
  } else {
    w.ai.targetId = target.id;
    w.ai.count = 1;
    if (target.id === w.player.synthoidId) events.push({ t: 'drainWarning' });
  }
  if (w.ai.count < config.ai.actCount) return;

  if (target.id === w.player.synthoidId) {
    if (w.player.energy >= 1) {
      w.player.energy -= 1;
      events.push({ t: 'drained', amount: 1 });
      spawnTrees(w, 1, events);
    } else {
      w.status = 'lost';
      events.push({ t: 'lost', reason: 'absorbed' });
    }
  } else {
    removeEntity(w, target.id);
    events.push({ t: 'enemyAbsorbed', kind: target.kind });
    spawnTrees(w, config.energy[target.kind], events);
    w.ai.targetId = null;
    w.ai.count = 0;
  }
}
