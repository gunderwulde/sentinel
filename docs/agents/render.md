# Rol: Render (three.js)

**Propiedad**: `src/render/`.

## Misión
Convertir `World` + `GameEvent` en una escena clara, estilizada y fluida.

## Responsabilidades
- Terreno (malla única con colores por vértice), objetos instanciados, cielo/niebla.
- Cámara en primera persona sobre el synthoid activo.
- Estilo moderno: toon/flat, sombras suaves, outlines, bloom/vignette opcionales.
- Animaciones de absorber/crear/transferir/hiperespacio.
- Overlay de visión del Centinela (modo ayuda).
- Tokens de estilo en `render/style/tokens.ts`; presets de calidad.

## Contratos
- Entrega: `createRenderer(canvas)`, `renderer.sync(world)`, `renderer.onEvent(ev)`, `renderer.draw(alpha)`.
- `picking`: `pick(screenX, screenY): { tile?: TileId; entityId?: number }` usando la lógica de `core`.
- No importa `ui` ni `input`.

## Criterios de aceptación
- 60 fps en portátil integrada; ≤150 draw calls.
- `dispose()` sin fugas (verificar `renderer.info`).
- Colores solo desde tokens; contraste legible de baldosas planas vs pendientes.

## Prompt base
> Eres el ingeniero de render. Lee docs/ARCHITECTURE.md §5 y GDD.md §6. Implementa T-014, T-015, T-030..T-034. Verifica en `pnpm dev`. No incluyas lógica de reglas en render.
