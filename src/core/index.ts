import { config } from './config';
import { aiStep } from './ai';
import type { GameEvent, World } from './types';

export * from './types';
export { config } from './config';
export { apply, checkAbsorb, checkCreate, checkTransfer } from './sim';
export { canSee, surfaceY } from './visibility';
export { SIZE, TILES, tileId, tileX, tileZ, vh, isFlat, baseHeight } from './grid';
export { generateLandscape } from './terrain';
export { next as rngNext, seedFromCode } from './rng';
export { createWorld } from './level';
export {
  createWorldFromLandscape,
  eyePos,
  footY,
  playerEntity,
  tileTopY,
  topId,
  totalEnergy,
} from './world';

/** Un paso fijo de simulación (config.tickHz). */
export function tick(w: World): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.status !== 'playing') return events;
  w.tick++;
  if (w.tick % config.ai.turnIntervalTicks === 0) aiStep(w, events);
  return events;
}
