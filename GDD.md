# GDD — SENTINEL (adaptación web de *The Sentinel*, 1986)

> Documento de diseño de juego. Fuente de verdad del **qué** y el **porqué**.
> El **cómo** técnico está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); las reglas numéricas en [docs/RULES.md](docs/RULES.md).

## 1. Resumen

| Campo | Valor |
|---|---|
| Título de trabajo | Sentinel (nombre final por decidir, ver DECISIONS D-001) |
| Original | *The Sentinel*, Geoff Crammond / Firebird, ZX Spectrum, 1986 |
| Género | Puzle estratégico en primera persona, tiempo real, 3D |
| Plataforma | Navegador de escritorio (Chrome/Edge/Firefox actuales) |
| Controles | Ratón + teclado |
| Stack | TypeScript (strict) + three.js + Vite + Vitest |
| Fidelidad | **Remake fiel con mejoras de calidad de vida** |
| Estilo visual | **Moderno estilizado** sobre la geometría de cuadrícula original |
| Idioma | Docs en español, código/identificadores en inglés, UI con i18n (es/en) |

### Pitch
Eres una conciencia que habita robots («synthoids») en un paisaje de colinas y cuadrícula. Un Centinela giratorio en el punto más alto absorbe toda la energía a la vista. Para vencerle debes **absorber, crear y transferirte** para ganar altura hasta poder verle… y absorberle antes de que te vea a ti.

### Pilares de diseño
1. **Tensión silenciosa**: el peligro es lento, visible e inevitable; el jugador siempre entiende por qué pierde.
2. **Altura = poder**: toda decisión gira en torno a ver más y ser visto menos.
3. **Economía de energía exacta**: cada acción tiene coste/ganancia claros y deterministas.
4. **Determinismo**: mismo paisaje + mismas acciones = mismo resultado (esencial para tests y repeticiones).
5. **Claridad antes que espectáculo**: lo moderno al servicio de leer el terreno y las líneas de visión.

## 2. Bucle de juego

1. Se carga el paisaje N (semilla determinista). El jugador aparece en un synthoid sobre una baldosa baja.
2. Mira alrededor, apunta con el cursor a una baldosa u objeto.
3. Acciona: **absorber** objeto (+energía), **crear** objeto (−energía), **transferir** a otro synthoid propio, **hiperespacio** (escape, coste fijo).
4. Los enemigos giran y escanean. Si te ven, drenan energía/objetos.
5. Objetivo del nivel: absorber al Centinela, crear un synthoid en su pedestal, transferirte y **hiperespaciar** al siguiente paisaje.
6. Derrota: quedarte sin energía, o ser absorbido sin otro synthoid al que transferir.

## 3. Entidades

| Entidad | Energía | Rol |
|---|---|---|
| Árbol | 1 | Moneda barata; bloquea poco, sirve de decoy |
| Roca (boulder) | 2 | Apilable → construir altura |
| Synthoid | 3 | Cuerpo del jugador; puntos de vista |
| Centinela | 4 | Objetivo final; escanea 360° |
| Vigía (sentry) | 3 | Centinelas menores en niveles avanzados |
| Meanie | 1 (árbol corrompido) | Fuerza al jugador a huir/transferirse |

Valores iniciales; la fuente de verdad numérica es [docs/RULES.md](docs/RULES.md) y debe ser **configurable** (`src/core/config`).

## 4. Mecánicas clave

### 4.1 Terreno
- Rejilla de baldosas con altura entera; baldosas planas y pendientes. Solo se puede crear/colocar sobre baldosas planas visibles.
- Paisajes numerados `0000–9999` generados por semilla (ver D-002 sobre equivalencia con el original).
- Dificultad creciente: más vigías, terreno más agreste, menos energía libre.

### 4.2 Visión
- Una baldosa/objeto es «visible» si hay línea de visión desde el ojo del observador hasta la baldosa (o su base) sin ser ocluida por terreno/objetos.
- La misma regla vale para el jugador y para los enemigos (simetría = justicia).

### 4.3 Acciones del jugador
Absorber · Crear (árbol/roca/synthoid) · Transferir · Girar (U-turn) · Mirar libre · Hiperespacio.

### 4.4 Enemigos
- Giran en pasos discretos; al ver tu baldosa o tus objetos comienzan a drenar.
- Prioridad de drenaje y conversión a meanies definida en RULES.md.
- Aviso al jugador (audio + HUD) antes de perder energía: **nunca** debe haber una pérdida sin señal previa.

### 4.5 Progresión
Al hiperespaciar tras vencer, el siguiente paisaje depende de la energía sobrante (como el original). Sistema de códigos de acceso por paisaje.

## 5. Calidad de vida (alcance de «mejoras»)
- Previsualización de coste/ganancia al apuntar.
- Overlay opcional de líneas de visión del Centinela (modo ayuda, desactivable).
- Deshacer **solo** en modo «Práctica»; el modo «Clásico» no lo tiene.
- Guardado/reanudado de partida y códigos de paisaje.
- Rebinding de teclas, sensibilidad, FOV, accesibilidad (daltonismo, reducir movimiento).
- Tutorial interactivo de 3 paisajes guiados.
- Repetición (replay) determinista exportable.

## 6. Dirección visual — «moderno estilizado»
- Low-poly limpio, **flat/toon shading** con iluminación direccional + sombras suaves, niebla atmosférica y cielo degradado por paisaje.
- Paleta por paisaje (generada por semilla, validada para contraste).
- Post-proceso ligero: bloom sutil, viñeta, AA. Todo desactivable por «Calidad».
- Centinela con silueta icónica y cono de visión legible; objetos con outline.
- Rendimiento objetivo: 60 fps en portátil integrada (≤ 150 draw calls, InstancedMesh para baldosas/árboles).

## 7. Audio
- Ambiente mínimo y tenso, viento, pulsos graves.
- SFX diferenciados: absorber, crear, transferir, hiperespacio, escaneo, **alerta de drenaje**.
- Web Audio con síntesis procedural; sin assets pesados en MVP.

## 8. UI / UX
- HUD: energía (iconos de árbol/roca/synthoid), brújula de rotación del Centinela, indicador «visto».
- Menús: Inicio, Selección de paisaje/código, Opciones, Pausa, Créditos.
- Cursor tipo punto en modo apuntado; selección con ratón, acciones con clic + teclas.

## 9. Alcance y fases
- **MVP**: un paisaje jugable completo con reglas, enemigo, victoria/derrota, render básico.
- **Alfa**: generación de 10.000 paisajes, vigías, meanies, hiperespacio y progresión.
- **Beta**: estilo visual final, audio, UI, opciones, guardado, tutorial.
- **1.0**: pulido, rendimiento, accesibilidad, i18n, empaquetado web.
Detalle en [docs/ROADMAP.md](docs/ROADMAP.md).

## 10. Fuera de alcance (v1)
Multijugador, móvil/táctil, editor de niveles, modo VR, música compuesta.

## 11. Riesgos
| Riesgo | Mitigación |
|---|---|
| Las reglas exactas del original son difíciles de recordar/verificar | Parametrizar todo en `config`; tests de propiedades; sección de «incertidumbres» en RULES.md |
| Generación de terreno poco jugable | Validador de solubilidad en CI sobre muestra de semillas |
| Líneas de visión costosas | Núcleo puro, grid + DDA/raycast en heightfield, caché por frame |
| Deriva visual entre agentes | Guía de estilo y tokens de color en `src/render/style` |

## 12. Cuestiones abiertas
Ver [docs/DECISIONS.md](docs/DECISIONS.md) (sección «Abiertas»).
