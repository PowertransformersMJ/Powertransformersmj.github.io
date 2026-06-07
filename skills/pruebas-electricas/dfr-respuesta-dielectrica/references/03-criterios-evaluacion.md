# 03 · Criterios de evaluación — % humedad del papel con cita normativa

> NETA §7.2.2 lista el DFR como prueba **opcional** (B.13) y su criterio (D.13) es
> "comparar vs previos + **límites de humedad publicados** del aislamiento sólido" —
> es decir, NETA **no da una tabla propia** de % de humedad: remite a CIGRE/IEEE.
> Jerarquía: **(1) humedad de fábrica/commissioning → (2) interno por clase (MO.00418)
> → (3) límites publicados CIGRE / IEEE C57.152 (tendencia)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el veredicto contra cada óptica y
> consolida con el formato de `../../_conocimiento/marco-normativo-multinorma.md` (§4):
> per-norma + consolidado (más conservador) + dónde diverge / converge con IR-FP.

---

## A) % de humedad del papel — escala de referencia (CIGRE / industria)

Todos los valores **corregidos a 20 °C** (la corrección de T es obligatoria, `02-…`):

| % humedad celulosa @20 °C | Categoría | Veredicto | Acción |
|---|---|---|---|
| < 2% | **Seco** | SECO | operación normal; baseline |
| 2 – 3% | Moderadamente húmedo | HÚMEDO-VIGILAR | acortar intervalo; cruzar con agua aceite |
| 3 – 4.5% | Húmedo | HÚMEDO-SECAR | planificar secado; confirmar por convergencia |
| > 4.5% | Muy húmedo | HÚMEDO-SECAR (urgente) | secado necesario; riesgo de rigidez/vida |

> ⚠️ **Verificar los cortes (2 / 3 / 4.5%)** contra la edición de norma del director.
> Provienen de guías **CIGRE** (TB 349 / TB 414) y práctica de industria; **IEEE C57.152
> §A.5 / IEEE C57.161** dan el marco metodológico del DFR. No hay un único umbral de
> consenso "pasa/no pasa" — por eso el peso recae en la **tendencia** y la convergencia.

## B) Conductividad del aceite (subproducto del ajuste)

El ajuste X-Y entrega también la **conductividad del aceite**; una conductividad alta
indica aceite envejecido/contaminado → cruzar con `analisis-aceite` (acidez, IFT, FP).
No confundir aceite conductivo con papel húmedo: el modelo X-Y los separa (`01-…`).

## C) Interno por clase (MO.00418) y fábrica

- **Fábrica/commissioning**: el % de humedad de puesta en servicio es el baseline más
  fuerte. Un tx nuevo bien procesado arranca <0.5–1%.
- **Interno por clase**: si MO.00418 fija un % máximo por clase de tensión, tiene
  precedencia sobre la escala genérica. ⚠️ Verificar si existe ese umbral interno.

## D) Tendencia (decisiva en DFR)

El % de humedad que **sube** entre ensayos sucesivos indica **ingreso de humedad**
(sello defectuoso, respiración, mal procesado) y condena aunque cada valor esté en rango.
La pendiente pesa tanto como el valor absoluto (IEEE C57.152).

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
1) Verifica la CALIDAD DEL AJUSTE X-Y + que el % esté corregido a 20 °C. Si mal ajuste → repetir.
2) ÓPTICAS:
   vs humedad de fábrica/commissioning        → [✔/✘/—]   (precedencia 1)
   vs interno por clase (MO.00418)             → [✔/✘]      (precedencia 2)
   vs escala CIGRE / IEEE C57.152 (publicados) → [seco/vigilar/secar]
   vs histórico (tendencia)                    → [estable / ↑↑ ingresa humedad]
3) CONVERGENCIA con IR-FP-agua aceite: DFR es el ÁRBITRO de humedad
   (confirma o descarta la sospecha de IR/FP).
VEREDICTO CONSOLIDADO = el PEOR de las ópticas, citando el criterio que lo determina.
  ⊳ Reportar la convergencia: "DFR confirma humedad de IR/FP" o "DFR descarta → causa es otra".
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ El DFR cierra (o reabre) el diagnóstico de humedad de IR/FP: ve a
  `../../_conocimiento/diagnostico-integrado-bateria.md` para la convergencia y a
  `04-diagnostico.md` para el rol de árbitro.
