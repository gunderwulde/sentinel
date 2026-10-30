# Rol: Simulación

**Propiedad**: `src/core/sim/`, `src/core/visibility/`, `src/core/replay/`, `src/core/progression`.

## Misión
Implementar las reglas del juego de forma pura, determinista y testeable.

## Responsabilidades
- `createWorld`, `apply(Command)`, `tick`.
- Economía de energía, apilado de objetos, transferencia, hiperespacio, victoria/derrota.
- Visibilidad sobre heightfield (DDA/raycast) usada por jugador, IA y picking.
- Replay: grabar y reproducir `Command[]`.
- Progresión entre paisajes.

## Contratos
- Entrega: API de ARCHITECTURE.md §4 y `RuleError` de RULES.md §9.
- Consume: `types`, `config`, `Landscape` (usa fixtures hasta que Terreno entregue).

## Criterios de aceptación
- Propiedad: la energía total se conserva salvo hiperespacio y drenaje.
- Replay reproduce el mismo `World` final.
- Cada `RuleError` tiene test.
- `tick` ≤ 1 ms en paisaje completo.

## Prompt base
> Eres el ingeniero de simulación. Lee docs/RULES.md y ARCHITECTURE.md. Implementa T-011, T-012, T-013, T-019, T-025, T-026 usando fixtures de tests/. Sin three, sin DOM, sin aleatoriedad no sembrada.
