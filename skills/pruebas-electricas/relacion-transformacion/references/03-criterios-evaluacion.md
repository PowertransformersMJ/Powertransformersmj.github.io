# 03 · Criterios de evaluación — umbrales con cita normativa

> Jerarquía de criterio (de mayor a menor precedencia): **(1) dato de fábrica/placa →
> (2) criterio por clase de tensión MO.00418 → (3) NETA ATS-2025 (≤0.5%)**. NETA es explícita:
> el dato del fabricante manda.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) Desviación de relación — criterio de aceptación

### A.1 — NETA ATS-2025 §7.2.2.D.3 (piso de aceptación) ⭐

> "Turns-ratio test results should not deviate more than **one-half percent (0.5%)** from
> either the **calculated ratio** or the **adjacent coils** (bobinas adyacentes)."

| %dev | Veredicto | Acción |
|---|---|---|
| ≤ 0.5% | **APRUEBA** | dentro de tolerancia NETA |
| > 0.5% | **INVESTIGAR / RECHAZA** | excede; cruzar con excitación + R devanados |

→ Se evalúa en **TODAS** las posiciones de TAP y en las **3 fases**. Basta una fase/TAP fuera
de ±0.5% para que el equipo no apruebe la prueba.

### A.2 — IEEE C57.152-2013 / C57.12.90 (código de ensayo)

IEEE C57.152-2013 fija el mismo límite: medido vs calculado deben coincidir dentro de **±0.5%**.
IEEE C57.12.90 (código de ensayo) define el método de medición en fábrica/rutina. Ambas normas
**coinciden con NETA** en el ±0.5% → no hay divergencia de umbral; sí de énfasis (IEEE: tendencia
+ correlación con excitación).

### A.3 — Criterio por CLASE / interno (MO.00418)

⚠️ **Verificar** si la norma interna MO.00418.DE-GAC-AX.01 Ed. 02 fija una tolerancia más
estricta por clase de tensión. Si no la fija, el ±0.5% de NETA/IEEE es el criterio primario.
Marcar como "⚠️ verificar contra la edición de norma del director".

---

## B) Coherencia entre fases y vs histórico (tendencia)

- **Entre fases (bobinas adyacentes)**: las 3 fases del mismo TAP deben dar %dev similar. Una
  fase que se aparta >0.5% de las otras dos localiza el defecto (NETA "adjacent coils").
- **Entre TAPs**: el paso de ratio entre posiciones consecutivas debe seguir el escalón de placa
  (típ. ±2.5%). Un salto anómalo en una sola posición = defecto del conmutador.
- **Vs ensayos previos**: una %dev que crece vs baseline histórico señala degradación incipiente
  (espira que empieza a fallar) **aunque siga dentro de ±0.5%** (IEEE C57.152: tendencia).

---

## C) Desfase / grupo de conexión

El ángulo de fase medido debe coincidir con el desplazamiento del grupo vectorial de placa
(p.ej. 30° en Dyn11). Un desfase fuera de lo esperado = **conexión errónea**, no es tolerancia
de ratio → RECHAZA hasta corregir la conexión o el rótulo de vector.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Para CADA fase × CADA TAP evalúa TODAS las ópticas:
  %dev vs fábrica/commissioning (si existe)      → [✔/✘/—]   (precedencia 1)
  %dev vs criterio por CLASE (MO.00418, si hay)  → [✔/✘]      (precedencia 2)
  %dev vs NETA ≤0.5% (calc. y adyacentes)        → [✔/✘]      (precedencia 3 · piso)
  %dev vs IEEE C57.152 (±0.5%)                   → [✔/✘]
  %dev vs histórico (tendencia)                  → [estable / crece]
  desfase vs grupo de conexión                   → [✔/✘ conexión errónea]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar SIEMPRE las divergencias (ej. todos los TAPs ok salvo TAP 5 → conmutador).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con excitación + R devanados + SFRA) antes de nombrar la causa.
