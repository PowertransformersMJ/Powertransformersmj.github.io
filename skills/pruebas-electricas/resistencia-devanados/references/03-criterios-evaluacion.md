# 03 · Criterios de evaluación — umbrales con cita normativa

> Todos los valores corregidos a la **misma temperatura de referencia** (Ts). Jerarquía de criterio
> (de mayor a menor precedencia): **(1) dato de fábrica/commissioning → (2) criterio por clase
> MO.00418 → (3) NETA ATS-2025 (≤2%)**. NETA es explícita: el dato del fabricante manda.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) Desbalance / desviación — criterio de aceptación

### A.1 — NETA ATS-2025 §7.2.2.D.8 (piso de aceptación) ⭐

> Para tx en líquido, los valores de resistencia de devanado (corregidos a temperatura) **no deben
> variar más del dos por ciento (2%)** respecto a **valores de fábrica** o **entre fases adyacentes**;
> si se excede, consultar al fabricante.

| desbalance / %desv vs fábrica | Veredicto | Acción |
|---|---|---|
| ≤ 2% | **APRUEBA** | dentro de tolerancia NETA |
| > 2% | **INVESTIGAR / RECHAZA** | excede; cruzar con termografía + TTR + LTC |

→ Se evalúa por devanado (AT/BT), en las **3 fases** y en **cada posición de TAP**.

### A.2 — IEEE C57.152-2013 / C57.12.90 (método + tendencia)

- **IEEE C57.152** define el **método** (Kelvin/4 hilos) y exige corriente de prueba **≤ 10% de
  la corriente nominal (In)** del devanado para no calentarlo y falsear la medida; enfatiza la
  **comparación vs fábrica/previos y la tendencia**.
- **IEEE C57.12.90** es el código de ensayo (medición en fábrica/rutina).
- Tx **dry-type grandes** (≥500 kVA 3φ): NETA exige comparar dentro de **1%** vs previos
  (criterio más estricto que el 2% de líquido) — no aplica a los tx en aceite de AFINIA, pero
  conviene tenerlo presente al clasificar el equipo.

### A.3 — Criterio por CLASE / interno (MO.00418)

⚠️ **Verificar** si MO.00418.DE-GAC-AX.01 Ed. 02 fija un desbalance admisible por clase distinto
al 2% de NETA. La práctica de industria a veces cita **2–3%**. Hasta confirmar: usar el **≤2% de
NETA** como criterio primario y marcar "⚠️ verificar contra la edición de norma del director".

---

## B) Coherencia entre fases, TAPs y vs histórico (tendencia)

- **Entre fases**: las 3 del mismo TAP deben quedar dentro del 2% una vez corregidas a Ts. Una
  fase que se aparta localiza la conexión/contacto defectuoso.
- **Entre TAPs**: la R debe variar suavemente entre posiciones; un salto en una sola posición
  apunta al **contacto del cambiador de tomas** en ese TAP.
- **Vs ensayos previos**: una Rs que crece vs baseline (>2%) señala una conexión que se degrada
  (oxidación, aflojamiento), aunque el desbalance instantáneo aún parezca aceptable.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Para CADA devanado × fase × TAP (todo corregido a la misma Ts) evalúa TODAS las ópticas:
  Rs vs fábrica/commissioning (si existe, misma Ts)   → [✔/✘/—]   (precedencia 1)
  Rs vs criterio por CLASE (MO.00418, si hay)         → [✔/✘ ⚠️verificar]  (precedencia 2)
  desbalance entre fases / vs fábrica ≤2% (NETA)      → [✔/✘]      (precedencia 3 · piso)
  método: I prueba ≤10% In (IEEE C57.152)             → [✔/✘ válida]
  Rs vs histórico (tendencia)                         → [estable / crece]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar SIEMPRE las divergencias (ej. global dentro de 2% pero TAP 3 alto → contacto LTC).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con termografía + TTR + excitación + DGA del LTC) antes de nombrar la causa.
