# 03 · Criterios de evaluación — umbrales con cita normativa

> El LTC se evalúa **por comparación** (vs previos y entre fases) + continuidad + DGA del
> compartimiento + conteo de operaciones. Jerarquía de criterio (mayor a menor precedencia):
> **(1) ensayos previos/fábrica de la propia unidad → (2) criterio interno por clase
> (MO.00418) → (3) NETA §7.2.2 D.9 (comparar vs previos) → (4) IEEE C57.139/C57.152 ·
> IEC 60214 (interpretación)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-óptica + consolidado (el más
> conservador) + dónde divergen.

---

## A) Criterio por NORMA

### A.1 — NETA ATS-2025 §7.2.2 D.9 (criterio núcleo)

| Criterio NETA | Lectura |
|---|---|
| **Resistencia dinámica del LTC: comparar vs previos** | divergencia significativa = INVESTIGAR |

→ Fuente: `../../_conocimiento/00-BATERIA-NETA-7.2.2.md` (D.9). NETA exige **comparación**
contra previos (firma DRM), no un número absoluto. La prueba es **opcional** (`*`) en §7.2.2.
NETA §7.12.3 cubre el regulador/cambiador como equipo. ⚠️ **verificar** referencia §7.12.x.

### A.2 — Continuidad sin interrupción (criterio físico duro)

| Condición | Veredicto |
|---|---|
| Corriente **cae a cero** durante la transición (transición abierta) | **RECHAZA** — falla del mecanismo |
| Continuidad mantenida (siempre hay camino) | ✔ en este eje |

Este es el criterio menos ambiguo: una transición abierta condena independientemente de las
demás ópticas.

### A.3 — IEEE C57.139 / C57.152 · IEC 60214 (interpretación)

- **IEEE C57.139** — guía para la **DGA del aceite del LTC** (interpreta gases del
  compartimiento, distinto del tanque). ⚠️ **verificar** edición/título.
- **IEEE C57.152** — guía de diagnóstico en campo: comparación y tendencia.
- **IEC 60214** (-1 requisitos, -2 aplicación) — norma de cambiadores de tomas. ⚠️ verificar.

### A.4 — Criterio interno por CLASE (MO.00418)

Si el tablero define reglas por clase/modelo de LTC, aplican como primario. ⚠️ **verificar**.

---

## B) MATRIZ — eje medido → criterio

| Eje | Criterio | Veredicto si falla |
|---|---|---|
| **Continuidad** (firma DRM) | sin caída a cero corriente | RECHAZA si hay transición abierta |
| **Resistores de transición** | medido ≈ nominal (±~10% ⚠️ verificar) y simétrico entre fases | INVESTIGAR |
| **Tiempos de transición** | simétricos entre fases + estables vs previos (≈40–60 ms tipo resistor ⚠️) | INVESTIGAR |
| **DGA del compartimiento LTC** | por RATIOS/tendencia (NO límites del tanque); arqueo normal esperado | INVESTIGAR si ratio/tendencia anómalos |
| **Conteo de operaciones** | dentro del umbral del fabricante | mantenimiento programado al vencer |

---

## C) Coherencia entre fases y vs histórico (tendencia)

- **Entre fases**: resistencias de contacto, resistores y tiempos deben ser **simétricos**
  entre A/B/C. Una fase fuera de patrón **localiza** el problema.
- **Vs previos (tendencia)**: la firma DRM y los tiempos comparados contra el ensayo anterior
  son el motor del diagnóstico (IEEE C57.152). Un contacto que se degrada lo hace gradualmente.
- **DGA LTC vs su propio histórico**: la tendencia de C₂H₂/C₂H₄ del compartimiento, no su
  valor absoluto (que es alto por diseño).

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
1. ¿Continuidad mantenida en TODA la transición?  → NO ⇒ RECHAZA (transición abierta).
2. Evalúa TODAS las ópticas:
   Firma DRM / tiempos vs previos (precedencia 1)        → [✔ coincide / ✘ desvía]
   Interno por clase (MO.00418, precedencia 2)            → [✔/✘]
   NETA §7.2.2 D.9 (vs previos, precedencia 3)            → [✔/✘]
   IEEE C57.139/C57.152 · IEC 60214 (interpretación)      → [✔/✘]
   DGA del compartimiento LTC (ratios/tendencia)          → [normal arqueo / anómalo]
   Conteo de operaciones vs umbral fabricante            → [dentro / vencido]
VEREDICTO CONSOLIDADO = el PEOR de las ópticas, citando el criterio que lo determina.
  ⊳ Reportar divergencias (ej. firma DRM ok pero DGA del LTC con C2H2 en ascenso → arco anómalo).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia DGA LTC + termografía + relación por TAP) antes de nombrar la causa.
