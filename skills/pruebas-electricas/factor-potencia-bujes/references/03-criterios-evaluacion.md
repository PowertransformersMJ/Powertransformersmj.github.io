# 03 · Criterios de evaluación — umbrales con cita normativa

> FP corregido a **20 °C**. Jerarquía de criterio (de mayor a menor precedencia):
> **(1) placa del propio buje (fábrica) → (2) criterio por clase (MO.00418) → (3) NETA
> §7.2.2.D.5 → (4) IEEE C57.19.01 / práctica Doble**. El **valor de placa del buje** es
> el criterio rey: cada buje trae su FP y C1 de fábrica.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen. ⚠️ Aquí el consolidado incluye un **flag de riesgo de explosión**.

---

## A) NETA §7.2.2.D.5 — criterios de aceptación de bujes

| Magnitud | Disparador NETA | Veredicto |
|---|---|---|
| **FP/tan δ** (corregido 20 °C) | varía **> 50 %** del valor de **placa** | INVESTIGAR |
| **Capacitancia C1** | varía **> 5 %** del valor de **placa** | INVESTIGAR ⭐ |
| **Hot-collar** (bujes sin tap) | pérdidas **> 0.1 W (100 mW)** por sección | INVESTIGAR |

→ Estos son los criterios duros de NETA §7.2.2.D.5. El de **capacitancia (>5 %)** es el más
importante para seguridad: señala capas del condensador en cortocircuito.

## B) Placa del buje + práctica de industria (Doble/Megger) — afinado por tipo

Cada buje trae FP y C1 de **fábrica grabados en placa**: esa es la referencia primaria.
Bandas de práctica de industria (⚠️ orientativas, verificar contra la edición del director):

| Magnitud | Bueno | Investigar | Crítico (riesgo) |
|---|---|---|---|
| **FP₂₀ absoluto** (OIP) | ≤ ~0.5 % (típ. fábrica 0.2–0.4 %) | 0.5–1.0 % o **>2× placa** | > 1.0 % |
| **ΔC1 vs placa** | < 5 % | **5–10 %** | **> 10 %** ⇒ sacar de servicio |

> ⚠️ La banda **5–10 % investigar / >10 % crítico** de capacitancia proviene de la práctica
> Megger/Doble; NETA sólo fija **>5 % = investigar**. RIP y RBP tienen FP de fábrica más
> bajos que OIP. Verificar umbrales finos contra la norma del director.

## C) C2 (aislamiento del tap)

El **C2** (tap↔brida) suele no tener valor de placa; se evalúa por **FP absoluto** y
**tendencia**. Un FP de C2 alto/creciente delata **humedad ingresando por el tap** — punto
de entrada común de degradación. ⚠️ verificar el límite de FP de C2 por tipo de buje.

## D) IEEE C57.19.01 / C57.152 — interpretación

IEEE C57.19.01 (requisitos de bujes) y C57.152 (diagnóstico en campo) enfatizan la
comparación **vs placa** y la **tendencia**, no un "pasa/no pasa" universal. La pendiente
de C1 y FP en el tiempo es el motor predictivo.

---

## E) Coherencia entre bujes y vs histórico (tendencia)

- **Entre fases**: los tres bujes homólogos (mismo tipo) deben dar FP y C1 coherentes; un
  buje desviado **localiza** el problema.
- **Vs placa y vs previos**: la **deriva de C1** en el tiempo es la señal temprana de
  explosión. Un FP que pasa pero **sube sostenido** vs commissioning también condena.

---

## Árbol de veredicto (resumen ejecutable · multi-norma + riesgo)

```
Para CADA buje evalúa TODAS las ópticas:
  FP₂₀ y C1 vs PLACA del buje                      → [✔/✘/—]   (precedencia 1)
  vs criterio por CLASE (MO.00418)                 → [✔/✘]      (precedencia 2)
  NETA D.5:  ΔFP>50% placa | ΔC1>5% | HC>0.1 W      → [✔/✘]      (precedencia 3 · piso)
  IEEE C57.19.01 / Doble (banda por tipo de buje)  → [✔/✘]
  C2 (FP del tap): humedad por el tap              → [✔/✘]
  Tendencia vs histórico (deriva de C1)            → [estable / ↑↑ degrada]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Si ΔC1 > 10% (o capas en corto evidentes) → RECHAZA · RIESGO DE EXPLOSIÓN → sacar de servicio.
  ⊳ Reportar SIEMPRE las divergencias (ej. FP ok pero ΔC1>5% → capas en corto, peligro).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia de DGA + FP del devanado + inspección) antes de nombrar la causa.
