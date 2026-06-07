---
name: resistencia-aislamiento
description: >-
  Calcula, evalúa y diagnostica la prueba de RESISTENCIA DE AISLAMIENTO de
  transformadores de potencia (megóhmetro): IR devanado-devanado y
  devanado-tierra, índice de absorción dieléctrica (DAR) e índice de
  polarización (PI), con corrección de temperatura a 20 °C y criterios de
  aceptación ANSI/NETA ATS-2025 (Tabla 100.5) e IEEE C57.152. Úsala SIEMPRE que
  aparezcan datos de megóhmetro, Megger, "insulation resistance", IR, megaohmios/
  GΩ, lecturas a 15s/30s/60s/10min, PI, DAR, índice de polarización o absorción,
  ratios de aislamiento, o cuando haya que decidir si un transformador "pasa" la
  prueba de aislamiento, corregir por temperatura, o interpretar un aislamiento
  bajo/pobre por humedad o contaminación — aunque el usuario no nombre la norma.
---

# Resistencia de Aislamiento (IR · DAR · PI) — Transformadores de potencia

Esta skill convierte lecturas crudas de megóhmetro en un **veredicto trazable**:
correctamente corregidas por temperatura, comparadas contra el criterio normativo
que aplica, y con un diagnóstico de qué significan PI/DAR bajos.

## Por qué importa hacerlo bien

La IR es la prueba más barata y más malinterpretada. Tres errores típicos invalidan
el veredicto: (1) **no corregir por temperatura** — la IR cae ~½ cada 10 °C en aceite,
así que 5 GΩ a 40 °C no son comparables a 5 GΩ a 20 °C; (2) **usar un mínimo genérico**
(p.ej. "1 GΩ") en vez del mínimo que corresponde a la clase de tensión del equipo;
(3) **leer PI/DAR de forma aislada** — en aislamientos muy secos y modernos con IR
altísima, el PI pierde sentido y un PI "bajo" puede no indicar problema. Esta skill
te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): lecturas IR por
   par (AT-BT, AT-tierra, BT-tierra), tiempos de lectura (15s/30s/60s/10min si hay),
   **temperatura del devanado** al momento del ensayo, voltaje de prueba DC aplicado,
   y datos de placa (tensión de clase, dato de fábrica si existe).
2. **Corrige a 20 °C**: `R₂₀ = R_medida × K` con K de la Tabla 100.14 (columna aceite).
   → `references/02-calculos.md`.
3. **Calcula ratios** si hay tiempos: `DAR = R60s/R30s`, `PI = R10min/R60s`.
   → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): calcula el veredicto contra cada óptica aplicable
   (fábrica > clase MO.00418 > NETA 100.5 > IEEE C57.152) + tendencia, y consolida en el peor
   citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo no pasa: ¿humedad, contaminación superficial, defecto? Confirma por
   **convergencia** (FP/tan δ + agua en aceite + DGA + DFR) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Resistencia de aislamiento — <tag/serie del tx>
Condiciones: T devanado = <°C> | V prueba = <Vdc> | clase = <kV>
Resultados (corregidos a 20 °C):
  AT–tierra:  R_medida=<…> → R₂₀=<…>
  BT–tierra:  …
  AT–BT:      …
Ratios:  DAR=<…> (<categoría>)   PI=<…> (<categoría>)
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <…> → [✔/✘/—]        (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]  (precedencia 2)
  • NETA Tabla 100.5 (piso): <umbral> → [✔/✘]       (precedencia 3)
  • IEEE C57.152 (PI≥1.5 / NETA PI≥1.0): [✔/✘]
  • Tendencia vs histórico: [estable / ↓↓ degrada]
  ⊳ Divergencias: <p.ej. pasa NETA 100.5 pero falla por clase → "pobre">
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes que la confirman>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide la IR, polarización/absorción, por qué baja.
- `references/02-calculos.md` — fórmulas exactas (corrección temp, DAR, PI) + ejemplos.
- `references/03-criterios-evaluacion.md` — todos los umbrales con cita normativa.
- `references/04-diagnostico.md` — interpretación y troubleshooting.
- Compartidas: `../_conocimiento/tablas-neta-referencia.md` (Tablas 100.5 y 100.14),
  `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
