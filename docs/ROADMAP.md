# ROADMAP

Formato de tarea: `T-ID · Rol · Descripción · Depende`. El estado vivo está en [STATUS.md](STATUS.md).

## M0 — Fundaciones (Lead)
- T-001 · Lead · Scaffold Vite + TS strict + Vitest + ESLint/Prettier + scripts pnpm
- T-002 · Lead · `git init`, `.gitignore`, convención de ramas
- T-003 · Lead · `core/types.ts`, `core/config`, `core/rng` (PRNG con semilla) · T-001
- T-004 · Lead · Reglas ESLint de fronteras (`no-restricted-imports`) · T-001
- T-005 · QA · Fixtures `flatWorld()`/`hillWorld()` · T-003
- T-006 · Lead · Bus de eventos tipado + bucle de paso fijo (`app`) · T-003
**Salida M0**: `pnpm dev` muestra pantalla vacía; `pnpm test` verde.

## M1 — MVP vertical (un paisaje a mano)
- T-010 · Terreno · Estructura `Landscape` y paisaje de prueba fijo · T-003
- T-011 · Sim · `createWorld`, entidades, energía · T-003
- T-012 · Sim · Visibilidad (DDA sobre heightfield) + tests · T-010
- T-013 · Sim · Comandos `absorb/create/transfer/turn` con `RuleError` · T-011,T-012
- T-014 · Render · Terreno (malla + colores) y cámara FP · T-010
- T-015 · Render · Objetos instanciados (árbol/roca/synthoid/Centinela) · T-014
- T-016 · Input · Picking por raycast a heightfield + mapeo de comandos · T-012,T-014
- T-017 · UI · HUD de energía + mensajes de error · T-013
- T-018 · IA · Centinela: rotación, escaneo, drenaje básico · T-012,T-013
- T-019 · Sim · Victoria/derrota y hiperespacio mínimo · T-013,T-018
**Salida M1**: se puede ganar y perder en un paisaje fijo.

## M2 — Alfa (contenido y reglas completas)
- T-020 · Terreno · Generador por semilla (`code` 0–9999) · T-010
- T-021 · Terreno · Validador de solubilidad + `tools/validate-seeds.ts` · T-020
- T-022 · Terreno · Curvas de dificultad en config · T-020
- T-023 · IA · Vigías y prioridades de reacción · T-018
- T-024 · IA · Meanies + hiperespacio forzado · T-023
- T-025 · Sim · Progresión (siguiente paisaje por energía) y códigos · T-019,T-020
- T-026 · Sim · Replay determinista (grabar/reproducir) · T-013
- T-027 · QA · Tests de propiedades (conservación de energía, determinismo) · T-026
**Salida M2**: 10.000 paisajes generables y jugables de principio a fin; CI valida muestra.

## M3 — Beta (look & feel)
- T-030 · Render · Guía de estilo y tokens de color, paleta por semilla
- T-031 · Render · Iluminación, sombras suaves, niebla, cielo degradado
- T-032 · Render · Outlines y post-proceso (bloom, viñeta, AA) con presets de calidad
- T-033 · Render · Animaciones de absorber/crear/transferir/hiperespacio
- T-034 · Render · Overlay de líneas de visión del Centinela (modo ayuda)
- T-035 · UI · Menús: inicio, selección de código, opciones, pausa
- T-036 · UI · HUD completo (brújula Centinela, indicador «visto», previsualización de coste)
- T-037 · Audio · Motor Web Audio procedural + SFX + alerta de drenaje
- T-038 · Input · Rebinding, sensibilidad, FOV, persistencia
- T-039 · UI · i18n es/en · T-035

## M4 — 1.0 (pulido)
- T-040 · UI · Tutorial interactivo (3 paisajes guiados)
- T-041 · Sim/UI · Guardado/reanudar, modo Práctica con deshacer
- T-042 · QA · Perfilado: 60 fps, ≤150 draw calls; optimizaciones
- T-043 · UI · Accesibilidad: daltonismo, reducir movimiento, contraste AA
- T-044 · Lead · Build de producción, hosting estático, README
- T-045 · QA · Pasada de regresión completa y checklist de release

## Criterios de salida de hito
Cada hito exige DoD de AGENTS.md §6 + demo grabada/descrita por el Lead en STATUS.md.
