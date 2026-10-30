# AGENTS.md — Guía para el equipo de agentes

Lee este archivo **completo** antes de tocar nada. Es el contrato de trabajo común.

## 1. Misión
Construir una adaptación web de *The Sentinel* según [GDD.md](GDD.md). Stack: **TypeScript estricto + three.js + Vite + Vitest**.

## 2. Mapa de documentos
| Doc | Para qué |
|---|---|
| [GDD.md](GDD.md) | Qué es el juego y por qué |
| [docs/RULES.md](docs/RULES.md) | Reglas y números exactos (fuente de verdad de simulación) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Módulos, fronteras, interfaces |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | Estilo, tests, rendimiento |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Hitos y tareas con IDs |
| [docs/STATUS.md](docs/STATUS.md) | Tablero vivo: quién hace qué |
| [docs/DECISIONS.md](docs/DECISIONS.md) | ADRs y preguntas abiertas |
| [docs/agents/](docs/agents/) | Ficha detallada por rol |

Jerarquía en caso de conflicto: **RULES > ARCHITECTURE > GDD > resto**. Si detectas contradicción, no la resuelvas en silencio: anótala en DECISIONS.md.

## 3. Roles y propiedad de código
Cada agente es **dueño** de sus carpetas. Editar fuera de tu zona requiere pedirlo al dueño (entrada en STATUS.md) salvo cambios triviales de import.

| Rol | Ficha | Propiedad |
|---|---|---|
| Lead / Arquitecto | [lead](docs/agents/lead.md) | `docs/`, `src/core/types.ts`, config de build, integración |
| Terreno | [terrain](docs/agents/terrain.md) | `src/core/terrain/` |
| Simulación | [sim](docs/agents/sim.md) | `src/core/sim/`, `src/core/visibility/` |
| IA enemiga | [ai](docs/agents/ai.md) | `src/core/ai/` |
| Render | [render](docs/agents/render.md) | `src/render/` |
| Input y cámara | [input](docs/agents/input.md) | `src/input/` |
| UI y audio | [ui-audio](docs/agents/ui-audio.md) | `src/ui/`, `src/audio/`, `src/i18n/` |
| QA | [qa](docs/agents/qa.md) | `tests/`, `tools/`, CI |

## 4. Reglas de oro
1. **Núcleo puro**: `src/core/**` NO importa `three`, DOM, `window`, `Math.random`, `Date.now`. Todo determinista con PRNG con semilla.
2. **Contratos primero**: toda interfaz entre módulos vive en `src/core/types.ts` o en el `index.ts` público del módulo. Cambiarla = ADR + aviso a consumidores.
3. **Dirección de dependencias**: `core ← render/input/ui/audio ← app`. Nunca al revés ni entre `render` ↔ `ui` directamente (usar eventos/estado).
4. **Números en config**: ningún número mágico de gameplay fuera de `src/core/config`.
5. **Tests con el código**: sin tests, la tarea no está hecha.
6. **Cambios pequeños y verificables**: una tarea del ROADMAP = un cambio coherente.
7. **No inventes reglas**: si RULES.md no lo cubre, pregunta (DECISIONS.md → «Abiertas») y usa el valor por defecto documentado.
8. **Español en docs/comentarios de dominio, inglés en identificadores**.

## 5. Flujo de trabajo
1. Toma una tarea `Pendiente` de [docs/STATUS.md](docs/STATUS.md) cuyo bloqueo esté resuelto; márcala `En curso` con tu rol.
2. Lee los docs relevantes y el contrato del módulo vecino.
3. Implementa + tests + (si cambia interfaz) actualiza `types.ts` y ARCHITECTURE.md.
4. Ejecuta el **Definition of Done** (§6).
5. Marca `Hecho` en STATUS.md con 1–2 líneas: qué cambió, cómo verificar, riesgos.
6. Si tu trabajo desbloquea a otro rol, menciónalo en la línea de STATUS.

### Handoff entre agentes
Formato en STATUS.md:
```
[T-014] Hecho · sim · visibilidad por DDA sobre heightfield
  Verifica: pnpm test visibility
  API: isVisible(world, from, to): boolean  (core/visibility)
  Notas: tolerancia ε en config.visibility.epsilon
```

## 6. Definition of Done
- [ ] `pnpm typecheck` sin errores (strict, sin `any` salvo justificado con comentario).
- [ ] `pnpm lint` limpio.
- [ ] `pnpm test` verde; tests nuevos para lógica nueva.
- [ ] Sin imports que violen las fronteras (regla de ESLint `no-restricted-imports`).
- [ ] Docs actualizados si cambió contrato o regla.
- [ ] STATUS.md actualizado.
- [ ] Para render/UI: captura o descripción visual verificada en `pnpm dev`.

## 7. Orquestación recomendada
Orden por dependencias (los marcados ∥ pueden ir en paralelo):
1. **Lead**: scaffold, `types.ts`, config, lint/test/CI. *(bloquea todo)*
2. ∥ **Terreno** (generación + validador) · **Sim** (acciones/energía/visibilidad sobre mundos de prueba hechos a mano) · **Render** (terreno desde `World` estático) · **Input**.
3. **IA** (necesita sim + visibilidad).
4. **UI/Audio** (necesita eventos de sim).
5. **QA** continuo desde el paso 1; integración final por Lead.

Paralelismo seguro: agentes en worktrees/ramas separadas; integrar vía Lead con rebase. Si no hay git, el Lead ejecuta `git init` en M0.

## 8. Comunicación y escalado
- Bloqueos o dudas de diseño → entrada en DECISIONS.md «Abiertas» y avisa al Lead; no te quedes parado: continúa con tarea no bloqueada.
- Si dos roles necesitan tocar el mismo archivo → el dueño lo edita, el otro propone parche en STATUS.
- Si una regla del original es incierta, **configurable + test que documente el valor elegido**.

## 9. Comandos
```
pnpm install
pnpm dev          # Vite
pnpm build
pnpm typecheck
pnpm lint
pnpm test         # Vitest
pnpm test:sim     # propiedades de simulación y solubilidad de semillas
```

## 10. Qué NO hacer
- No añadir dependencias sin ADR (ligero: three, vite, vitest, eslint, prettier, typescript; opcional: postprocessing).
- No usar `Math.random`/`Date.now` en `core`.
- No acoplar la simulación a `requestAnimationFrame`: `core` avanza por `tick(dt_fijo)`.
- No reescribir módulos ajenos «porque es más bonito».
