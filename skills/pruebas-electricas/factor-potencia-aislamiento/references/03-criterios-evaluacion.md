# 03 · Criterios de evaluación — umbrales con cita normativa

> Todos los valores corregidos a **20 °C**. Jerarquía de criterio (de mayor a menor
> precedencia): **(1) dato de fábrica/commissioning → (2) mínimo por clase (MO.00418) →
> (3) Tabla 100.3 genérica → (4) IEEE C57.152 / práctica Doble (interpretación)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) FP/tan δ máximo de aceptación — Tabla 100.3 (NETA ATS-2025) @ 20 °C

| Equipo en líquido | Aceite mineral (máx.) | Éster natural (máx.) |
|---|---|---|
| **Transformadores de potencia, reguladores y reactores** | **0.5 %** | **1.0 %** |

→ Criterio NETA §7.2.2.D.4: FP₂₀ por modo (CH/CL/CHL) ≤ **0.5 %** en aceite mineral.
Si FP₂₀ > 0.5 % ⇒ **INVESTIGAR**. Nota NETA: valores representativos en ausencia de
norma de consenso; la **distribución** (comparar vs previos) pesa tanto como el absoluto.

> ⚠️ La Tabla 100.3 da un **techo genérico**, no por clase de tensión. Un transformador
> nuevo sano suele estar muy por debajo (típ. 0.2–0.4 %). El 0.5 % es el límite de
> aceptación, NO el objetivo.

## B) Criterio por CLASE / fábrica (más estricto — el que prevalece si existe)

- **Dato de fábrica / commissioning**: máxima precedencia. El FP del propio tx en puesta
  en servicio es el baseline real; un aumento marcado vs ese baseline condena aunque siga
  bajo 0.5 %.
- **Interno por clase (MO.00418)**: si el tablero define un FP máximo por clase de tensión
  (constante en `…_schema.js`), usarlo como criterio primario. ⚠️ **verificar la fuente
  exacta** contra la edición de norma del director antes de tomarlo como definitivo.

## C) IEEE C57.152 — interpretación (escala de apoyo, no límite duro)

IEEE C57.152 es **guía de diagnóstico**, enfatiza **tendencia** y correlación, no da un
"pasa/no pasa" absoluto. Escala de apoyo de práctica de industria (Doble/Megger) para
aislamiento sólido-líquido (⚠️ orientativa, verificar contra la edición del director):

| FP₂₀ (aceite mineral) | Categoría | Acción |
|---|---|---|
| < 0.5 % | Bueno / aceptable | APRUEBA |
| 0.5 – 1.0 % | Cuestionable / deteriorado | INVESTIGAR (probable humedad/envejecimiento) |
| > 1.0 % | Malo / deteriorado | RECHAZA / acción correctiva |

## D) Tip-up (FP vs tensión)

| ΔFP (tip-up) | Interpretación |
|---|---|
| ≈ 0 (plano) | Sano — sin dependencia de tensión |
| **↑ positivo** (>~0.1 %) | Ionización en voids / descargas parciales → INVESTIGAR ⚠️ umbral a verificar |
| ↓ negativo (tip-down) | Humedad superficial que se seca, o tierra de núcleo faltante |

---

## E) Coherencia entre modos y vs histórico (tendencia)

- **Entre modos**: CH, CL y CHL deben ser coherentes con el diseño. Un modo alto aislado
  **localiza** el defecto (CHL alto = entre devanados; CH alto = AT a tierra).
- **Vs ensayos previos** (NETA Tabla 100.3 nota 2 / IEEE C57.152): un FP₂₀ que **sube
  sostenidamente** vs baseline es señal de degradación **aunque siga ≤0.5 %**. La pendiente
  pesa tanto como el valor absoluto — es el motor del diagnóstico predictivo.
- **Éster natural** (Tabla 100.3): techo mayor (1.0 %); no penalizar contra el límite de
  aceite mineral. Comparar contra fábrica/previos del propio líquido.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Para CADA modo (CH, CL, CHL) evalúa TODAS las ópticas:
  FP₂₀ vs fábrica/commissioning (si existe)   → [✔/✘/—]   (precedencia 1)
  FP₂₀ vs máximo por CLASE (MO.00418)          → [✔/✘]      (precedencia 2)
  FP₂₀ vs NETA Tabla 100.3 (≤0.5% min / ≤1.0% éster) → [✔/✘] (precedencia 3 · piso)
  FP₂₀ vs IEEE C57.152 (interpretación)        → [✔/✘]
  Tip-up:  plano ok | ↑ ionización INVESTIGAR | ↓ humedad/tierra núcleo
  Tendencia vs histórico                       → [estable / ↑↑ degrada]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar SIEMPRE las divergencias (ej. CH/CL ok pero CHL alto → defecto entre devanados).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia de IR/PI + agua en aceite + DGA + DFR) antes de nombrar la causa.
