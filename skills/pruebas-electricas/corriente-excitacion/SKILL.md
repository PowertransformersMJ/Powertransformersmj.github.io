---
name: corriente-excitacion
description: >-
  Calcula, evalúa y diagnostica la prueba de CORRIENTE DE EXCITACIÓN (exciting /
  excitation current) de transformadores de potencia: patrón de las 3 fases
  (típico 2 similares + 1 menor por la columna central del núcleo), comparación
  vs fábrica / ensayos previos / fases hermanas, con interpretación ANSI/NETA
  ATS-2025 §7.2.2 e IEEE C57.152. Úsala SIEMPRE que aparezcan datos de corriente
  de excitación, excitación, exciting current, prueba de excitación a 10 kV,
  patrón de fases del núcleo, magnetización, mA de excitación, lecturas
  H1-H2/H2-H3/H3-H1, columna central del núcleo, o cuando haya que decidir si un
  transformador "pasa" la prueba de excitación, detectar espiras en corto,
  problemas de núcleo, devanado o cambiador de tomas — aunque el usuario no
  nombre la norma. Sensible al magnetismo residual (desmagnetizar primero).
---

# Corriente de Excitación — Transformadores de potencia

Esta skill convierte lecturas crudas de corriente de excitación en un **veredicto
trazable**: el patrón de las 3 fases interpretado contra el patrón esperado del núcleo,
comparado con fábrica/previos/fases hermanas, y con un diagnóstico de qué falla revela
una desviación.

## Por qué importa hacerlo bien

La excitación es una de las pruebas más sensibles a defectos de **núcleo y devanado**, pero
también la más fácil de malinterpretar. Tres errores típicos invalidan el veredicto: (1) **no
desmagnetizar el núcleo** — el magnetismo residual distorsiona el patrón y simula fallas
inexistentes; (2) **buscar un umbral % duro universal** — NETA no fija un porcentaje fijo de
aceptación: el criterio es la **comparación de patrón** vs fábrica/previos/fases hermanas;
(3) **leer la excitación sin la TTR y la resistencia de devanados** que la acompañan — la
convergencia es la que confirma una espira en corto. Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): corriente de excitación
   por fase y por TAP, tensión de prueba aplicada, configuración del núcleo (3 o 5 columnas),
   conexión, dato de fábrica/previos si existen, estado de desmagnetización.
2. **Identifica el patrón** de las 3 fases: el esperado en núcleo de 3 columnas es **2 lecturas
   similares (fases externas) + 1 menor (fase central)** por el camino magnético más corto.
   → `references/01-teoria.md` + `references/02-calculos.md`.
3. **Compara** cada fase vs fábrica/previos y vs su fase hermana; calcula la dispersión
   (%diferencia entre externas, posición relativa de la central). → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): calcula el veredicto contra cada óptica aplicable
   (fábrica > previos > NETA patrón 2+1 > IEEE C57.152) + tendencia, y consolida en el peor
   citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si el patrón se rompe: ¿espira en corto, núcleo, conmutador, magnetismo
   residual? Confirma por **convergencia** (TTR + R devanados + SFRA + DGA) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`; cierra
   con acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Corriente de excitación — <tag/serie del tx>
Condiciones: V prueba = <kV> | núcleo = <3 columnas> | TAP = <pos> | desmagnetizado = <sí/no>
Resultados (mA por fase):
  Fase A=<…>  Fase B=<…>  Fase C=<…>   → patrón observado: <2 sim + 1 menor / roto>
  Δ externas = <%>   central vs externas = <%>
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <mA baseline> → [✔/✘/—]        (precedencia 1)
  • Ensayos previos (tendencia): [estable / cambió]        (precedencia 2)
  • NETA §7.2.2 (patrón 2 similares + 1 menor): [✔/✘]       (precedencia 3)
  • IEEE C57.152 (comparación vs fábrica/previos): [✔/✘]
  ⊳ Divergencias: <p.ej. patrón ok pero ↑ vs previos → vigilar>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes que la confirman>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide la excitación, el patrón del núcleo, qué fallas revela.
- `references/02-calculos.md` — comparaciones y dispersión de patrón + ejemplos numéricos.
- `references/03-criterios-evaluacion.md` — criterios por norma (matriz multi-norma).
- `references/04-diagnostico.md` — interpretación y troubleshooting.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x de referencia),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
