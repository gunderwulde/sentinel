# RULES — Reglas de simulación

> Fuente de verdad numérica. Todo valor aquí se materializa en `src/core/config`.
> Los valores marcados **[V]** son de memoria del original y **deben verificarse/ajustarse** (ver DECISIONS D-003). Hasta entonces se usan como defecto y se cubren con un test que documente el valor.

## 1. Energía
| Objeto | Valor |
|---|---|
| Árbol | 1 |
| Roca | 2 |
| Synthoid | 3 |
| Vigía | 3 |
| Centinela | 4 |
| Meanie | 1 |

- Absorber objeto → `+valor` a la energía del jugador.
- Crear objeto → `−valor` (requiere energía suficiente: `energía ≥ valor`).
- Energía inicial del jugador: **[V]** 10 unidades totales entre synthoid y objetos iniciales (config `player.startEnergy`).
- Energía `< 0` o ausencia de synthoid válido → derrota.

## 2. Terreno y colocación
- Baldosa = 4 vértices; **plana** si los 4 tienen igual altura.
- Crear árbol/roca/synthoid solo sobre baldosa **plana y visible**, o encima de una **roca** visible.
- Se pueden apilar rocas; sobre la cima de una pila se puede colocar un árbol o un synthoid.
- Un objeto no se puede absorber si tiene otro encima (hay que absorber lo de arriba primero).
- No se pueden crear objetos sobre baldosa con synthoid/enemigo.

## 3. Visibilidad
- Observador con ojo a `altura_vértice + eyeOffset(synthoid)`.
- Baldosa visible si el rayo ojo→**centro de la baldosa** (o su base) no es interceptado por heightfield ni por pilas.
- Absorber un objeto exige ver **la baldosa en la que se asienta** (para pila: la baldosa base) **[V]**.
- Cono vertical de visión del jugador: hasta ±`config.view.maxPitch`.
- Centinela/vigías usan **la misma** función de visibilidad.

## 4. Acciones del jugador
| Acción | Precondiciones | Efecto |
|---|---|---|
| absorb | objetivo visible y sin objeto encima | +energía, elimina objeto |
| create | baldosa visible válida; energía ≥ coste | −energía, nueva entidad (synthoid orientado hacia el jugador) |
| transfer | synthoid propio visible y ≠ actual | cambia punto de vista |
| turn | — | cambia yaw 180° |
| hyperspace | energía ≥ 3 **[V]** | teletransporta a baldosa aleatoria (semilla) **más baja o igual** que la actual; −3 |
| look | — | libre; no consume tick de gameplay |

Coste de hiperespacio y su comportamiento (puede fallar si no hay sitio) → config.

## 5. Victoria
1. Absorber al Centinela (visible su baldosa de pedestal).
2. Crear un synthoid sobre el pedestal.
3. Transferirse a él.
4. `hyperspace` → estado `won`; se calcula el siguiente paisaje.

**Siguiente paisaje**: `siguiente = código + bonus(energíaSobrante)` **[V]**; fórmula en `core/progression`.

## 6. Enemigos

### 6.1 Rotación y escaneo
- El Centinela/vigía gira en pasos discretos de `ai.turnStepDeg` cada `ai.turnIntervalTicks` **[V]**.
- Tras cada paso evalúa qué ve (baldosas y objetos).

### 6.2 Reacción
Orden de prioridad de lo que ve **[V]**:
1. Si ve **la baldosa/objeto del synthoid del jugador** → comienza a **drenar al jugador** tras un retardo `ai.drainDelayTicks` (aviso `drainWarning` inmediato).
2. Si no ve al jugador pero ve **objetos absorbibles** (árboles/rocas no apilados bajo el jugador) → los absorbe, uno por vez; la energía absorbida se «devuelve» como **árbol nuevo** aleatorio en baldosa plana del paisaje (la energía es conservada).
3. Si no puede absorber y ve un **árbol**, puede convertirlo en **meanie**.

### 6.3 Drenaje
- Cada ciclo de drenaje: `−1` energía al jugador; si la energía queda sin objetos que absorber → el enemigo absorbe el synthoid del jugador.
- Si el jugador tiene otro synthoid disponible, puede **transferirse** durante el aviso.

### 6.4 Meanie
- Un meanie ve al jugador → obliga a **hiperespacio forzado**. Si no hay energía para hiperespacio → derrota **[V]**.

### 6.5 Vigías
- Igual que el Centinela pero con menor prioridad y sin condición de victoria. Aparecen según nivel (`landscape.sentries`).

## 7. Generación de paisajes
- Determinista por `code ∈ [0,9999]` → semilla → PRNG (`core/rng`).
- Requisitos duros (validador en CI):
  1. Existe baldosa plana de inicio.
  2. El Centinela está en la cima o cerca del máximo de altura.
  3. Energía total disponible (árboles) permite, en teoría, ascender hasta ver el pedestal.
  4. Ninguna baldosa de inicio es visible desde el Centinela en t=0 sin al menos un giro de margen **[V]**.
- Dificultad `d = f(code)`: n.º de vigías, rugosidad del terreno, árboles disponibles (curvas en config).
- **Nota**: no se garantiza equivalencia bit a bit con los 10.000 paisajes originales (D-002).

## 8. Determinismo
- Orden fijo de evaluación de entidades (por `id`).
- Prohibido `Math.random`/`Date.now` en `core`.
- Mismos `code` + `Command[]` ⇒ mismo `World` final (test de replay).

## 9. Errores de regla (`RuleError`)
`NotVisible`, `NotEnoughEnergy`, `InvalidTile`, `HasObjectOnTop`, `NoSuchTarget`, `NotFlat`.
La UI traduce cada error a un mensaje i18n y un sonido discreto.

## 10. Incertidumbres explícitas
Todo lo marcado **[V]**. Política: valor por defecto en config + test + entrada en DECISIONS.
