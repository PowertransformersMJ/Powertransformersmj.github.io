---
name: dga
description: >-
  Evalúa y diagnostica el ANÁLISIS DE GASES DISUELTOS (DGA) en el aceite de
  transformadores de potencia: gases clave hidrógeno (H2), metano (CH4), etano
  (C2H6), etileno (C2H4), acetileno (C2H2), monóxido (CO) y dióxido de carbono
  (CO2), con clasificación de estado (DGA Status 1/2/3 de IEEE C57.104-2019),
  tasas de generación, TDCG, y diagnóstico de falla por triángulo de Duval y
  relaciones de Rogers/Doernenburg (térmico vs eléctrico vs arco). Métodos ASTM
  D3612 / IEC 60567. Úsala SIEMPRE que aparezcan gases disueltos, cromatografía
  de gases, DGA, ppm de H2/CH4/C2H6/C2H4/C2H2/CO/CO2, acetileno/hidrógeno/etileno,
  TDCG, status 1/2/3, triángulo de Duval, relaciones de Rogers o Doernenburg,
  gas patterns, falla térmica/arco/descarga parcial, punto caliente, o cuando
  haya que decidir si un transformador tiene falla incipiente por gases —
  aunque el usuario no nombre la norma ni el método.
---

# Análisis de Gases Disueltos (DGA) — Transformadores de potencia

Esta skill convierte un set de ppm de gases en un **veredicto trazable**: estado
clasificado por IEEE C57.104-2019, tasa de generación evaluada, y un **diagnóstico
del tipo de falla** (térmica de baja/alta T, descarga parcial, arco) vía Duval y
las relaciones de Rogers/Doernenburg, consolidado en multi-norma.

## Por qué importa hacerlo bien

El DGA es la prueba **predictiva por excelencia**: detecta fallas incipientes
**meses antes** de que se manifiesten en pruebas eléctricas off-line. Tres errores
típicos invalidan el veredicto: (1) **leer una sola muestra sin tasa de generación**
— un nivel alto estable puede ser histórico inofensivo, mientras un nivel "normal"
que sube rápido es la alarma real (IEEE C57.104-2019 enfatiza el **gas-by-gas +
generación**); (2) **aplicar una relación de diagnóstico (Rogers/Duval) sin antes
verificar que hay falla** — las relaciones solo son válidas cuando los gases superan
umbrales mínimos; (3) **confundir gases de celulosa (CO/CO₂) con gases de falla del
aceite**. Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): ppm de los 7
   gases clave (H2, CH4, C2H6, C2H4, C2H2, CO, CO2), **fecha de muestreo y muestras
   previas** (para tasa de generación), método (ASTM D3612 / IEC 60567), volumen de
   aceite del tx (para mL/día si se pide), y carga/historial.
2. **Clasifica el estado**: cada gas vs **IEEE C57.104-2019 (DGA Status 1/2/3)**;
   calcula TDCG (suma de gases combustibles) como apoyo. → `references/03-criterios-evaluacion.md`.
3. **Calcula la tasa de generación** (ppm/mes o ppm/día) vs muestra previa — el motor
   predictivo. → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): IEEE C57.104-2019 (status) + IEC 60599
   (límites típicos + ratios) + interno + tendencia; consolida en el peor citando la
   fuente. → `references/03-criterios-evaluacion.md` + `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica el TIPO de falla**: triángulo de Duval + Rogers/Doernenburg (térmico
   vs PD vs arco) → `references/04-diagnostico.md`; confirma por **convergencia**
   (R devanados, FP, termografía, SFRA) → `../_conocimiento/diagnostico-integrado-bateria.md`;
   y traduce a acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: DGA (gases disueltos) — <tag/serie del tx>
Muestreo: <fecha> (previa: <fecha>) | método = <D3612/IEC 60567> | aceite = <L>
Gases (ppm):  H2=<…> CH4=<…> C2H6=<…> C2H4=<…> C2H2=<…> CO=<…> CO2=<…>
TDCG = <suma combustibles ppm>     Tasa de generación: <ppm/mes por gas relevante>
ESTADO (IEEE C57.104-2019): gas-by-gas → DGA Status <1/2/3>  (peor gas: <…>)
DIAGNÓSTICO DE FALLA:
  • Triángulo de Duval: zona <PD/D1/D2/T1/T2/T3/DT>
  • Rogers (CH4/H2, C2H2/C2H4, C2H4/C2H6): código <…> → <falla>
  • Doernenburg (si gases > mínimos): <térmico/corona/arco>
CRITERIOS APLICADOS (por óptica):
  • IEEE C57.104-2019 (status + generación): → [✔/✘]   (precedencia DGA)
  • IEC 60599 (límites típicos + ratios): → [✔/✘]
  • Interno (MO.00418) / fábrica: → [✔/✘/—]
  • Tendencia vs histórico: [estable / ↑↑ generación activa]
  ⊳ Divergencias: <p.ej. nivel Status 2 pero generación alta → escalar>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <tipo de falla + pruebas convergentes que lo confirman>
Acción: <re-muestreo acelerado / inspección / fuera de servicio> + intervalo
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — gases como "huella" térmica/eléctrica, qué falla genera cada gas.
- `references/02-calculos.md` — TDCG, tasa de generación, relaciones de Rogers/Duval con ejemplo numérico.
- `references/03-criterios-evaluacion.md` — matriz multi-norma (C57.104-2019 status / IEC 60599 / interno / tendencia).
- `references/04-diagnostico.md` — patrón de gases → tipo de falla → convergencia.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/tablas-neta-referencia.md` (DGA → NETA §7.2.2.D.15 remite a IEEE C57.104),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
