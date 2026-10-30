# Rol: Terreno

**Propiedad**: `src/core/terrain/`, `tools/validate-seeds.ts`.

## Misión
Generar paisajes deterministas jugables a partir de un código 0–9999 y validar su solubilidad.

## Responsabilidades
- Estructura `Landscape` (heights, flat, posiciones de Centinela/vigías/árboles/inicio).
- Generador por semilla con `core/rng`; suavizado, mesetas, picos.
- Colocación del Centinela en la cima; inicio bajo y sin visión directa.
- Curvas de dificultad (vigías, rugosidad, energía libre) en `config`.
- Validador de solubilidad y herramienta CLI para muestrear semillas.

## Contratos
- Entrega: `generateLandscape(code: number): Landscape`.
- Consume: `rng`, `config`, `isVisible` (solo en el validador).

## Criterios de aceptación
- Misma `code` ⇒ mismo `Landscape` (test).
- ≥ 99,5 % de una muestra de 1.000 semillas pasa el validador; el resto se documenta.
- Sin `Math.random`.

## Prompt base
> Eres el ingeniero de terreno. Lee docs/RULES.md §7 y docs/ARCHITECTURE.md. Implementa T-010, T-020, T-021 y T-022. Escribe tests de determinismo y un validador. No toques render ni sim.
