---
name: dfr-respuesta-dielectrica
description: >-
  Evalúa y diagnostica la prueba de RESPUESTA DIELÉCTRICA EN FRECUENCIA (DFR /
  FDS, Frequency Domain Spectroscopy) de transformadores de potencia: estima el
  % de HUMEDAD del aislamiento SÓLIDO (papel/celulosa) ajustando la respuesta
  medida a un modelo X-Y, con corrección por temperatura, y aporta la conductividad
  del aceite. Es la prueba CONCLUYENTE de humedad del papel cuando IR y FP/tan δ
  son ambiguos. Marco CIGRE / IEEE C57.152 / IEEE C57.161. Úsala SIEMPRE que
  aparezcan datos de DFR, FDS, respuesta dieléctrica en frecuencia, dielectric
  frequency response, barrido de frecuencia de tan δ, % humedad del papel/celulosa,
  contenido de humedad del aislamiento sólido, modelo X-Y, curva tan δ vs frecuencia,
  o cuando haya que decidir cuánta agua hay en el papel, validar/complementar IR y
  FP, o decidir secado del transformador — aunque el usuario no nombre la norma.
---

# Respuesta Dieléctrica en Frecuencia (DFR / FDS) — Humedad del papel

Esta skill convierte un barrido de tan δ vs frecuencia en un **veredicto trazable**:
el **% de humedad del aislamiento sólido** (celulosa) estimado por ajuste a un modelo
X-Y, corregido por temperatura, más la conductividad del aceite — la respuesta
**concluyente** cuando IR/FP dejan la duda de "¿es humedad o no?".

## Por qué importa hacerlo bien

La humedad del **papel** (no del aceite) es lo que envejece y arriesga el transformador,
y es **invisible** a la IR/FP de forma directa (ellas miden el sistema completo). El DFR
la estima específicamente. Tres errores típicos invalidan el veredicto: (1) **no corregir
por temperatura** — la respuesta dieléctrica se desplaza fuertemente en frecuencia con la
T; un % de humedad sin la T del ensayo no significa nada; (2) **confundir conductividad
del aceite con humedad del papel** — el aceite envejecido/contaminado también sube tan δ
a bajas frecuencias y puede simular humedad si no se separa con el modelo X-Y; (3) **leer
el DFR aislado** en vez de cerrar la convergencia con IR/FP/agua-en-aceite. Esta skill te
obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): curva de tan δ (o
   capacitancia/pérdidas) vs **frecuencia** (típ. 1 mHz–1 kHz), **temperatura del
   aislamiento** al ensayo, geometría X-Y del aislamiento (si se conoce), y datos
   convergentes (agua en aceite D1533, IR/PI, FP/tan δ a red).
2. **Ajusta al modelo X-Y**: separa la contribución del **aceite** (conductividad) de la
   del **papel** (humedad) ajustando la curva medida a la modelada. → `references/02-calculos.md`.
3. **Corrige por temperatura** a la referencia (20 °C) — paso imprescindible.
   → `references/02-calculos.md` + `references/01-teoria.md`.
4. **Evalúa MULTI-NORMA** (no una sola): % humedad vs límites publicados (CIGRE / IEEE
   C57.152 / interno) + tendencia; consolida en el peor citando la fuente.
   → `references/03-criterios-evaluacion.md` + `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica y cierra el lazo**: el DFR es el **árbitro** de humedad → confirma o
   descarta la sospecha de IR/FP por **convergencia** →
   `../_conocimiento/diagnostico-integrado-bateria.md`; y traduce a acción (secado) +
   intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`. → `references/04-diagnostico.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: DFR / FDS (respuesta dieléctrica) — <tag/serie del tx>
Condiciones: T aislamiento = <°C> | rango = <f_min–f_max Hz> | modelo = X-Y
Resultados:
  % humedad del papel (corregido a 20 °C): <…>%
  Conductividad del aceite: <…>     Calidad del ajuste X-Y: <bueno/regular>
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning (humedad de fábrica): <…> → [✔/✘/—]   (precedencia 1)
  • Interno por clase (MO.00418): <umbral %> → [✔/✘]             (precedencia 2)
  • CIGRE / IEEE C57.152 (límites de humedad del sólido): <umbral> → [✔/✘]
  • Tendencia vs histórico: [estable / ↑↑ ingresa humedad]
  ⊳ Divergencias / convergencia con IR-FP: <DFR confirma o descarta la sospecha>
VEREDICTO CONSOLIDADO: <SECO / HÚMEDO-VIGILAR / HÚMEDO-SECAR>  — <criterio citado>
Diagnóstico: <humedad del papel confirmada/descartada + pruebas convergentes>
Acción: <secado vacío/calor / vigilancia> + intervalo de re-ensayo
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide el DFR, modelo X-Y, por qué separa papel de aceite.
- `references/02-calculos.md` — ajuste X-Y, corrección de temperatura, lectura del % humedad + ejemplo.
- `references/03-criterios-evaluacion.md` — matriz multi-norma de % humedad con cita (CIGRE/IEEE/interno).
- `references/04-diagnostico.md` — DFR como árbitro de humedad + convergencia + troubleshooting.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (DFR = §7.2.2.B.13, criterio D.13),
  `../_conocimiento/tablas-neta-referencia.md` (contexto NETA),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
