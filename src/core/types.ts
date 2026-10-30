export type TileId = number;
export type ObjectKind = 'tree' | 'boulder' | 'synthoid' | 'sentinel';
export type CreatableKind = 'tree' | 'boulder' | 'synthoid';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Entity {
  id: number;
  kind: ObjectKind;
  tile: TileId;
  yaw: number;
}

export interface Landscape {
  readonly code: number;
  readonly heights: Int8Array; // SIZE*SIZE vertex heights
  readonly sentinelTile: TileId;
  readonly startTile: TileId;
  readonly trees: readonly TileId[];
}

export interface World {
  tick: number;
  landscape: Landscape;
  entities: Map<number, Entity>;
  stacks: Map<TileId, number[]>; // bottom -> top
  nextId: number;
  /** Se incrementa en cada alta/baja de entidades; sirve para invalidar cachés de la UI. */
  version: number;
  /** Altura extra por baldosa (pedestal + rocas apiladas), mantenida por add/removeEntity. */
  lift: Float32Array;
  sentinelId: number | null;
  player: { synthoidId: number; energy: number };
  status: 'playing' | 'won' | 'lost';
  rng: { s: number };
  ai: { targetId: number | null; count: number };
}

export type Command =
  | { t: 'absorb'; target: number }
  | { t: 'create'; kind: CreatableKind; tile: TileId }
  | { t: 'transfer'; target: number }
  | { t: 'hyperspace' };

export type RuleError =
  | 'NotVisible'
  | 'NotEnoughEnergy'
  | 'InvalidTile'
  | 'HasObjectOnTop'
  | 'NoSuchTarget'
  | 'NotFlat'
  | 'GameOver';

export type GameEvent =
  | { t: 'absorbed'; id: number; kind: ObjectKind; gain: number }
  | { t: 'created'; id: number; kind: ObjectKind; tile: TileId }
  | { t: 'transferred'; to: number }
  | { t: 'hyperspace'; tile: TileId }
  | { t: 'drainWarning' }
  | { t: 'drained'; amount: number }
  | { t: 'enemyAbsorbed'; kind: ObjectKind }
  | { t: 'sentinelAbsorbed' }
  | { t: 'won' }
  | { t: 'lost'; reason: string };

export interface ApplyResult {
  events: GameEvent[];
  error?: RuleError;
}
