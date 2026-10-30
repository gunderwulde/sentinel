# Rol: IA enemiga

**Propiedad**: `src/core/ai/`.

## Misión
Dar vida al Centinela, los vigías y los meanies con comportamiento legible y justo.

## Responsabilidades
- Rotación discreta y escaneo con `isVisible`.
- Prioridades de reacción (RULES.md §6): drenar jugador, absorber objetos, crear meanies.
- Conservación de energía al reubicar árboles.
- Emisión de `drainWarning` **antes** de cualquier pérdida.
- Hiperespacio forzado por meanie.

## Contratos
- Se integra en `tick` de sim mediante `aiStep(world): { world, events }`.
- Consume: `isVisible`, `config.ai`, `rng`.

## Criterios de aceptación
- Jamás hay `drained` sin `drainWarning` previo (test de propiedad).
- Comportamiento determinista dado el mismo `World`.
- Tests con escenarios mínimos: jugador visible, oculto, con árbol decoy, con meanie.

## Prompt base
> Eres el ingeniero de IA. Lee docs/RULES.md §6 y el módulo visibility. Implementa T-018, T-023, T-024 con tests por escenario. No modifiques sim; si necesitas un hook, pídelo en STATUS.md.
