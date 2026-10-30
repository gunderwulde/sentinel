# STATUS — Tablero vivo

Estados: `Pendiente` · `En curso` · `Bloqueada` · `Hecho`
Actualiza solo tus propias líneas. Formato de handoff: ver AGENTS.md §5.

## Hito actual: M0

| ID | Rol | Estado | Notas |
|---|---|---|---|
| T-001 | lead | Pendiente | Scaffold Vite + TS + Vitest + ESLint |
| T-002 | lead | Pendiente | `git init` |
| T-003 | lead | Pendiente | types, config, rng |
| T-004 | lead | Pendiente | fronteras ESLint |
| T-005 | qa | Bloqueada | espera T-003 |
| T-006 | lead | Bloqueada | espera T-003 |

## Registro de handoffs
[M1-v0.1] Hecho · lead · primera versión jugable (núcleo, render, menús, HUD) + revisión adversarial Carmack + Abrash
  Verifica: npm test (16 tests) · npm run build · npm run dev
  Corregido tras la revisión: validación de tiles NaN/fraccionarios; hiperespacio solo a baldosas ≤ altura (RULES §4);
    energía repuesta si no hay baldosa libre; Centinela ignora árboles hasta que existan meanies; inicio nunca visible
    desde el Centinela (`createWorld`); visibilidad con la misma triangulación que el render y paso 0.1;
    `world.lift`/`world.version` (sin recorrer pilas por muestra, caché del hover); geometrías/materiales compartidos
    (fuga GPU), sombras solo al cambiar la escena, shader de muros sin comportamiento indefinido y con espacio de color;
    input: blur, modificadores, hover viejo tras recargar; menú: código acotado, Esc reanuda, la pausa no gira la cámara.
  Pendiente (objeciones aceptadas, no resueltas): DDA exacto (Amanatides-Woo) en lugar de muestreo; picking por
    heightfield en vez de Raycaster; InstancedMesh; validador de solubilidad (RULES §7.3); progresión por energía;
    vigías y meanies; ESLint con fronteras de módulos (T-004).

## Peticiones entre roles
_(vacío)_
