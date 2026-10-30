# CODING STANDARDS

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride`.
- Sin `any`; si es inevitable, `// eslint-disable-next-line` + motivo.
- Módulos ES; un `index.ts` por carpeta expone la API pública. Nada de imports profundos entre módulos.
- Tipos de unión discriminada para `Command` y `GameEvent` (campo `t`).
- Preferir funciones puras y datos planos en `core`; clases solo en `render`/`input`/`audio` cuando gestionen recursos.
- `readonly` por defecto.

## Naming
- Archivos: `kebab-case.ts`. Tipos/clases: `PascalCase`. Funciones/variables: `camelCase`. Constantes de config: `camelCase` dentro de objeto `config`.
- Identificadores en inglés; comentarios de dominio pueden estar en español.

## Estructura de módulo
```
modulo/
  index.ts        # API pública
  *.ts            # implementación
  *.test.ts       # tests junto al código (unitarios)
```

## Tests (Vitest)
- `core`: cobertura objetivo ≥ 90 % líneas en `sim`, `visibility`, `terrain`.
- **Propiedades**: invariantes de energía (conservación), determinismo (replay), solubilidad de semillas.
- Mundos de prueba construidos a mano con `tests/fixtures/` (builders: `flatWorld()`, `hillWorld()`).
- Render/UI: tests de lógica pura (picking math, formatters); lo visual se verifica manualmente y con capturas en `tests/visual/` (opcional).

## Three.js
- Liberar recursos (`dispose()`) de geometrías/materiales/texturas.
- No crear objetos por frame; reutilizar vectores temporales.
- `InstancedMesh` para elementos repetidos; materiales compartidos.
- Colores desde `render/style/tokens.ts`; ningún hex suelto.

## Rendimiento
- Medir antes de optimizar; `performance.mark` solo en `render`/`app`.
- Evitar asignaciones en `tick` (arrays tipados donde proceda).

## Git (recomendado)
- Commits pequeños: `tipo(módulo): descripción` (`feat(sim): absorb action`).
- Rama por tarea: `T-014-visibility-dda`.

## i18n
- Ninguna cadena visible hardcodeada: `t('hud.energy')`.

## Accesibilidad
- Contraste AA en HUD; modo daltónico; opción «reducir movimiento» desactiva sacudidas/parpadeos.
