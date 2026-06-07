# 03 · Criterios de evaluación — umbrales con cita normativa

> Lectura a **500 Vdc** con la **tierra del núcleo levantada** (sin esto, no hay criterio que
> aplicar — la medida es inválida). Jerarquía de criterio (de mayor a menor precedencia):
> **(1) dato de fábrica/commissioning del núcleo → (2) criterio por clase (MO.00418) →
> (3) NETA §7.2.2.D.11 (≥500 MΩ) → (4) IEEE C57.152 (interpretación + tendencia)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) NETA §7.2.2.D.11 — mínimo de aceptación

| Magnitud | Criterio NETA | Veredicto |
|---|---|---|
| IR núcleo–tierra @ 500 Vdc | **comparable a fábrica** y **≥ 500 MΩ** | APRUEBA si cumple |

→ NETA §7.2.2.D.11: el aislamiento del núcleo debe ser **comparable al dato de fábrica** y,
como piso, del orden de **≥ 500 MΩ @ 500 Vdc**. Por debajo ⇒ **INVESTIGAR / RECHAZA** según
severidad (pocos MΩ o kΩ = segundo aterrizaje franco).

> ⚠️ **Verificar el valor exacto del piso** (≥500 MΩ) contra la edición de norma del director.
> Algunas referencias de campo citan cientos de MΩ como mínimo y GΩ como valor sano; los
> equipos nuevos suelen dar **GΩ**. El 500 MΩ es el piso de aceptación, no el objetivo:
> el dato de **fábrica** y la **tendencia** mandan sobre el piso genérico.

## B) Fábrica / commissioning + criterio por clase

- **Dato de fábrica**: máxima precedencia. Una IR que **cae fuerte vs el baseline de fábrica**
  (p.ej. de GΩ a decenas de MΩ) es alerta de **segundo aterrizaje incipiente** aunque siga
  ≥500 MΩ → la tendencia condena antes que el piso.
- **Interno por clase (MO.00418)**: si el tablero define un mínimo, usarlo como primario.
  ⚠️ verificar la fuente exacta.

## C) IEEE C57.152 — interpretación

IEEE C57.152 trata la IR del núcleo como **diagnóstica de la integridad del aislamiento del
núcleo** y enfatiza la **tendencia** + la **correlación con DGA**. No fija un "pasa/no pasa"
universal: una IR baja se interpreta junto a los gases de falla térmica. La pendiente vs
baseline es el motor del diagnóstico.

---

## D) Bandas de interpretación (apoyo de práctica de industria)

⚠️ Orientativas — verificar contra la norma del director:

| IR núcleo–tierra @ 500 Vdc | Interpretación |
|---|---|
| > ~1 GΩ (comparable a fábrica) | Sano — una sola tierra, aislamiento bueno |
| 500 MΩ – 1 GΩ | Aceptable; vigilar tendencia |
| 10 – 500 MΩ | INVESTIGAR — aislamiento degradado o segundo contacto débil |
| < 10 MΩ (kΩ–pocos MΩ) | RECHAZA — segundo punto de tierra franco / corriente circulante |

---

## E) Coherencia vs histórico (tendencia)

- **Vs fábrica/previos**: la **caída** de la IR del núcleo en el tiempo es la señal temprana
  de un aterrizaje accidental que se está formando (lodo, humedad, rebaba migrando). La
  pendiente pesa tanto como el valor absoluto.
- **Correlación con DGA**: una IR de núcleo que baja + gases C₂H₄/C₂H₆ ascendentes = caso
  cerrado de múltiple tierra con punto caliente. Cruzar SIEMPRE con el DGA más reciente.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
0) Validar método: 500 Vdc + tierra del núcleo levantada. Si no → INVÁLIDA (repetir).
Para la medida válida evalúa TODAS las ópticas:
  R_med vs fábrica/commissioning (si existe)   → [✔/✘/—]   (precedencia 1)
  R_med vs mínimo por CLASE (MO.00418)          → [✔/✘]      (precedencia 2)
  R_med vs NETA §7.2.2.D.11 (≥500 MΩ)           → [✔/✘]      (precedencia 3 · piso)
  R_med vs IEEE C57.152 (interpretación)        → [✔/✘]
  Tendencia vs histórico                        → [estable / ↓↓ degrada]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar divergencias (ej. supera 500 MΩ pero cae fuerte vs fábrica → 2º aterrizaje incipiente).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con DGA C₂H₄/C₂H₆ + termografía + corriente de tierra) antes de nombrar la causa.
