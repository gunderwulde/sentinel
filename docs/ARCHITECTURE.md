# ARCHITECTURE

## 1. Principio
**Simulación pura y determinista** (`core`) separada de **presentación** (three.js, DOM, audio). La presentación observa el estado y emite *comandos*; el núcleo emite *eventos*.

```
 input ──Command──▶ ┌────────────┐ ──Event──▶ render / ui / audio
                    │ core (sim) │
 render ◀──World───│ determinista│
                    └────────────┘
```

## 2. Estructura de carpetas
```
/
├─ index.html
├─ package.json  tsconfig.json  vite.config.ts  eslint.config.js
├─ src/
│  ├─ main.ts                 # composición (Lead)
│  ├─ app/                    # estados de app: menú, partida, pausa (Lead)
│  ├─ core/                   # SIN three/DOM/random/time
│  │  ├─ types.ts             # contratos públicos
│  │  ├─ config/              # números de gameplay
│  │  ├─ rng/                 # PRNG con semilla (mulberry32/xoshiro)
│  │  ├─ terrain/             # generación de paisajes + validador
│  │  ├─ visibility/          # línea de visión sobre heightfield
│  │  ├─ sim/                 # estado, comandos, energía, tick
│  │  ├─ ai/                  # Centinela, vigías, meanies
│  │  └─ replay/              # grabación/reproducción
│  ├─ render/                 # three.js
│  │  ├─ style/               # tokens, paletas, materiales
│  │  ├─ scene/               # terreno instanciado, objetos, cielo
│  │  ├─ fx/                  # post-proceso, outlines
│  │  └─ picking/             # rayo de pantalla → baldosa/objeto
│  ├─ input/                  # ratón, teclado, rebinding, cámara FP
│  ├─ ui/                     # HUD y menús (DOM)
│  ├─ audio/                  # Web Audio procedural
│  └─ i18n/                   # es.json, en.json
├─ tests/                     # unit, propiedades, integración
├─ tools/                     # scripts: validador de semillas, replays
└─ docs/
```

## 3. Modelo de datos (`core/types.ts`, esbozo)
```ts
export type Vec2 = { x: number; z: number };
export type TileId = number;                 // z * SIZE + x

export interface Landscape {
  readonly code: number;                     // 0..9999
  readonly size: number;                     // vértices por lado
  readonly heights: Int8Array;               // altura por vértice
  readonly flat: Uint8Array;                 // 1 si la baldosa es plana
  readonly sentinel: { tile: TileId };
  readonly sentries: readonly { tile: TileId }[];
  readonly startTile: TileId;
  readonly trees: readonly TileId[];
}

export type ObjectKind = 'tree' | 'boulder' | 'synthoid' | 'sentinel' | 'sentry' | 'meanie';
export interface Entity { id: number; kind: ObjectKind; tile: TileId; stackIndex: number; yaw: number; }

export interface World {
  tick: number;
  landscape: Landscape;
  entities: ReadonlyMap<number, Entity>;
  player: { synthoidId: number; energy: number; };
  status: 'playing' | 'won' | 'lost';
}

export type Command =
  | { t: 'absorb'; target: number | TileId }
  | { t: 'create'; kind: 'tree' | 'boulder' | 'synthoid'; tile: TileId }
  | { t: 'transfer'; synthoidId: number }
  | { t: 'hyperspace' }
  | { t: 'turn'; yaw: number };

export type GameEvent =
  | { t: 'absorbed'; id: number; gain: number }
  | { t: 'created'; id: number; kind: ObjectKind; tile: TileId }
  | { t: 'transferred'; to: number }
  | { t: 'drainWarning'; by: number }
  | { t: 'drained'; amount: number; by: number }
  | { t: 'meanie'; treeId: number }
  | { t: 'won' } | { t: 'lost'; reason: string };
```

## 4. API de simulación
```ts
createWorld(code: number, opts?): World
apply(world: World, cmd: Command): { world: World; events: GameEvent[]; error?: RuleError }
tick(world: World, dtFixed: number): { world: World; events: GameEvent[] }
isVisible(world, fromEye: Vec3, tile: TileId): boolean
```
- Estado **inmutable por paso** (o mutación controlada con `structuredClone`/snapshots para replay). Decisión del Lead en M0 (ADR D-004).
- `tick` a paso fijo (p.ej. 30 Hz); el render interpola.

## 5. Render
- `render/scene` construye desde `World`; reacciona a `GameEvent` para animar (aparición, absorción).
- Terreno: malla única con vértices coloreados + `InstancedMesh` para árboles/rocas.
- Cámara en primera persona en el ojo del synthoid activo (`yaw`/`pitch`).
- Picking por raycast contra heightfield (no contra mallas) usando la misma función de `core` para coherencia.
- Calidad escalable: sombras, bloom, outlines conmutables.

## 6. Input
- Pointer lock opcional; modo cursor libre por defecto para apuntar.
- Mapea teclas/clics → `Command`. Rebinding persistido en `localStorage`.

## 7. Bucle principal
```
requestAnimationFrame(frame):
  acumulador += dt
  mientras acumulador ≥ DT_FIJO: sim.tick(DT_FIJO)
  render.draw(alpha)
```
Eventos del sim se difunden por un bus tipado (`src/app/bus.ts`).

## 8. Fronteras forzadas (ESLint)
- `src/core/**` ⟂ `three`, `document`, `window`, `performance`, `Math.random`, `Date`.
- `render` no importa `ui`; `ui` no importa `render`.
- Solo `app` y `main` componen módulos.

## 9. Rendimiento
- Presupuesto: 60 fps, ≤150 draw calls, ≤1 ms por `tick` en paisaje completo.
- Visibilidad: cachear por (observador, tick); recalcular solo al mutar el mundo.

## 10. Persistencia
`localStorage`: opciones, progreso (código de paisaje máx.), rebinding. Replays como JSON `{code, version, commands[]}`.
