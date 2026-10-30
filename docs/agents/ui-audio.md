# Rol: UI, audio e i18n

**Propiedad**: `src/ui/`, `src/audio/`, `src/i18n/`.

## Misión
Que el jugador siempre sepa qué pasa: HUD claro, menús sobrios, sonido que avisa.

## Responsabilidades
- HUD: energía, brújula del Centinela, indicador «visto», previsualización de coste/ganancia, mensajes de `RuleError`.
- Menús: inicio, selección de código, opciones, pausa, créditos; tutorial guiado.
- Audio Web Audio procedural: ambiente, SFX y **alerta de drenaje**.
- i18n es/en (`t()`), sin cadenas hardcodeadas.
- Accesibilidad: contraste AA, daltonismo, reducir movimiento, volúmenes.

## Contratos
- Consume: bus de `GameEvent` y `HoverState`; nunca importa `render`.
- Entrega: `mountUI(root, bus, store)`, `createAudio(bus)`.

## Criterios de aceptación
- Cada `RuleError` y `GameEvent` relevante tiene feedback visual y/o sonoro.
- El aviso de drenaje se percibe sin mirar el HUD (audio).
- Navegable con teclado.

## Prompt base
> Eres el ingeniero de UI/audio. Lee GDD.md §7–8 y RULES.md §9. Implementa T-017, T-035..T-037, T-039, T-040, T-043. Todo texto vía i18n.
