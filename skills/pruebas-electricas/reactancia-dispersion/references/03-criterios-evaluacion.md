# 03 · Criterios de evaluación — umbrales con cita normativa

> Jerarquía de criterio (mayor a menor precedencia): **(1) dato de fábrica/placa
> (%Z nameplate) → (2) criterio interno por clase (MO.00418) → (3) NETA §7.2.2 D.10
> (3% genérico) → (4) IEEE C57.152 / IEC 60076 (interpretación)**. El %Z de placa es la
> referencia más fuerte porque es la huella del propio tx en fábrica.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) Desviación de impedancia — umbrales de aceptación

### A.1 — NETA ATS-2025 §7.2.2 D.10 (criterio núcleo) ⭐

| Modo de medición | Criterio NETA | Veredicto si lo supera |
|---|---|---|
| **3φ equivalente** | investigar si **> 3%** vs %Z de placa | INVESTIGAR |
| **Por fase** | una fase no debe desviar **> 3%** del promedio de las 3 lecturas | INVESTIGAR |

→ Fuente: `../../_conocimiento/00-BATERIA-NETA-7.2.2.md` (criterio D.10). El 3% es la
señal de alerta NETA: por debajo = APRUEBA; por encima = INVESTIGAR (no es rechazo
automático, pero obliga a cruzar con SFRA).

> ⚠️ **Verificar** el redondeo/texto exacto del 3% contra la edición de NETA ATS-2025 del
> director (el valor proviene de la batería interna del proyecto; la prueba es **opcional**
> en NETA — `*` en §7.2.2). La práctica de industria (Megger/Doble/CIGRE) trata desviaciones
> **> ~2–3%** como significativas de cambio mecánico; reportar el valor crudo + el veredicto.

### A.2 — Criterio interno por CLASE (MO.00418)

Si el tablero define un umbral por clase de tensión más estricto que el 3% genérico,
aplica como criterio **primario**; el 3% NETA queda como piso. ⚠️ **Verificar** la fuente
exacta del umbral por clase contra la edición de la norma interna del director antes de
tomarlo como definitivo.

---

## B) IEEE C57.152 / IEC 60076 (interpretación)

- **IEEE C57.152** — guía de diagnóstico en campo: enfatiza **comparar contra fábrica y
  contra el histórico**, y correlacionar con SFRA/excitación. No fija un "pasa/no pasa"
  numérico duro; el 3% es el límite operativo de campo. ⚠️ **verificar** cláusula exacta.
- **IEC 60076** — código de ensayo: la **impedancia de cortocircuito** se mide en fábrica;
  IEC 60076-5 trata la capacidad de soportar cortocircuito (post-evento se re-mide la
  reactancia para confirmar que el devanado no se deformó). ⚠️ **verificar** edición/parte.

---

## C) Coherencia entre fases y vs histórico (tendencia)

- **Entre fases**: en un tx sano las 3 reactancias son muy parecidas (dentro del ±3% del
  promedio). Una fase fuera de banda **localiza** la deformación.
- **Vs histórico / pre-vs-post evento**: el uso más potente es comparar la reactancia
  **antes y después** de un cortocircuito pasante o impacto. Un cambio significativo vs el
  baseline condena aunque siga dentro del 3% de placa (la tendencia pesa, IEEE C57.152).
- **Mismo TAP**: comparar siempre en la misma posición de TAP (la reactancia varía con N).

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Normaliza %Z medido a la base de placa (mismo TAP). Evalúa TODAS las ópticas:
  Δ3φ vs %Z placa (precedencia 1)          → >3% INVESTIGAR | ≤3% ✔
  Δ por clase (MO.00418, precedencia 2)     → [✔/✘]
  NETA §7.2.2 D.10 (precedencia 3, piso)    → 3φ>3% ✘ | fase>3% prom ✘
  IEEE C57.152 / IEC 60076 (interpretación) → [✔/✘]
  Tendencia (pre vs post evento)            → [estable / cambió → deformación]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar divergencias (ej. 3φ pasa pero la fase B desvía 4% → deformación local en B).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con SFRA + excitación + relación + histórico) antes de nombrar la causa.
