# DECISIONS

## Aceptadas
- **A-001** Stack: TypeScript strict + three.js + Vite + Vitest. npm como gestor (pnpm no está instalado en el entorno).
- **A-002** Fidelidad: remake fiel + mejoras de calidad de vida.
- **A-003** Plataforma: web de escritorio, ratón + teclado.
- **A-004** Estilo visual: moderno estilizado (low-poly, toon/flat, sombras, post-proceso opcional).
- **A-005** Docs en español; código en inglés; UI con i18n es/en.
- **A-006** Núcleo (`core`) puro y determinista, paso fijo.

## Abiertas (responde el humano / Lead)
- **D-001** Nombre final del juego (evitar infringir marca «The Sentinel»/«Sentinel»).
- **D-002** Generación: el humano quiere usar el algoritmo original (paisajes idénticos 0–9999). El algoritmo exacto NO está en memoria fiable del equipo; no se inventa. Plan: (1) el Lead busca documentación/desensamblado publicado del generador (PRNG, pasadas de suavizado, colocación de Centinela/vigías/árboles) y lo cita en esta entrada; (2) si hay fuente verificable, Terreno lo implementa tras la interfaz `generateLandscape(code)` con tests contra paisajes conocidos; (3) si no, se usa generador propio (mismos códigos, sin equivalencia) y se documenta. La interfaz no cambia en ningún caso.
- **D-003** Verificar valores **[V]** de RULES.md contra una fuente fiable del original (manual/reverse-engineering publicado).
- **D-004** Estado inmutable vs mutable con snapshots en `sim` (afecta a replay y deshacer). Defecto: inmutable por paso con estructuras compartidas; revisar con benchmark en M1.
- **D-005** Audio: ¿solo síntesis procedural o permitir samples CC0?
- **D-006** Licencia del proyecto y de assets.
- **D-007** Hosting objetivo (estático: GitHub Pages / itch.io).
- **D-008** ¿Dos modos desde el inicio (Clásico / Práctica con deshacer)?

## Plantilla ADR
```
### D-0XX Título
Contexto · Opciones · Decisión · Consecuencias · Fecha
```
