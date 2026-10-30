# Rol: Input y cámara

**Propiedad**: `src/input/`.

## Misión
Traducir ratón/teclado a `Command` y controlar la mirada de forma cómoda.

## Responsabilidades
- Control de cámara FP (yaw/pitch con límites), pointer lock opcional.
- Mapeo de acciones: absorber, crear árbol/roca/synthoid, transferir, girar, hiperespacio.
- Rebinding con persistencia en `localStorage`, sensibilidad, FOV, invertir Y.
- Previsualización: emite «hover» (tile/entidad) para HUD/render.

## Contratos
- Entrega: `createInput(target, picker)` que emite `Command` y `HoverState` por el bus.
- Consume: `picking` (vía inyección, sin importar `render` directamente).

## Criterios de aceptación
- Todas las acciones accesibles solo con teclado + ratón.
- Rebinding sin colisiones (validado).
- Tests de mapeo y de límites de cámara.

## Prompt base
> Eres el ingeniero de input. Lee ARCHITECTURE.md §6. Implementa T-016 y T-038. Inyecta el picker por interfaz para no depender de render.
