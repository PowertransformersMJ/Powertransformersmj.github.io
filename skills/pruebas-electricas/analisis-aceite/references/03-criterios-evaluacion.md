# 03 · Criterios de evaluación — umbrales por método ASTM y clase de tensión

> Jerarquía de criterio (de mayor a menor precedencia): **(1) dato de fábrica →
> (2) mínimo por clase (MO.00418) → (3) NETA Tabla 100.4 / IEEE C57.106 → (4) límite
> ASTM por método**. La tabla 100.4 da el aceite **NUEVO recibido**; para aceite
> **en servicio** rige IEEE C57.106 por clase y antigüedad.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: calcula el veredicto contra CADA óptica
> y emite el formato de `../../_conocimiento/marco-normativo-multinorma.md` (§4):
> per-norma + consolidado (el más conservador) + dónde divergen.

---

## A) Aceite mineral NUEVO recibido — NETA Tabla 100.4.1 (por clase de tensión @ recepción)

| Ensayo | ASTM | ≤69 kV | >69–<230 kV | ≥230 kV |
|---|---|---|---|---|
| Rigidez kV @ gap 1 mm | D1816 | 25 | 30 | 35 |
| Rigidez kV @ gap 2 mm | D1816 | 45 | 55 | 60 |
| IFT mN/m **mín** | D971 | 38 | 38 | 38 |
| Nº neutralización mgKOH/g **máx** | D974 | 0.03 | 0.03 | 0.03 |
| Agua ppm **máx** | D1533 | 20 | 10 | 10 |
| FP @25 °C % **máx** | D924 | 0.05 | 0.05 | 0.05 |
| FP @100 °C % **máx** | D924 | 0.40 | 0.40 | 0.50 |
| Color **máx** | D1500 | 0.5 | 0.5 | 0.5 |
| Visual | D1524 | bright & clear | — | — |

→ Transcripción de `../../_conocimiento/tablas-neta-referencia.md` (Tabla 100.4.1, ref. IEEE C57.106-2015 Tabla 2).

## B) Aceite EN SERVICIO — IEEE C57.106 por clase (lo que más se usa en campo)

Límites de **acción/servicio** (más permisivos que aceite nuevo; condenan degradación):

| Parámetro | ≤69 kV | 69–230 kV | ≥230 kV | Fuente |
|---|---|---|---|---|
| Rigidez D1816 @2 mm, kV **mín** | ≥ 25 | ≥ 30 | ≥ 32 | C57.106 ⚠️ verificar |
| Agua D1533, ppm **máx** | ≤ 35 | ≤ 25 | ≤ 20 | C57.106 ⚠️ verificar |
| Acidez D974, mgKOH/g **máx** | ≤ 0.20 | ≤ 0.15 | ≤ 0.10 | C57.106 ⚠️ verificar |
| IFT D971, mN/m **mín** | ≥ 25 | ≥ 30 | ≥ 32 | C57.106-2015 (≤69→25; ≥230→32) |
| FP D924 @25 °C, % **máx** | ≤ 0.5 | ≤ 0.5 | ≤ 0.5 | C57.106 ⚠️ verificar |

> ⚠️ **Verificar TODA la columna B** contra la edición de IEEE C57.106 del director.
> El único valor confirmado en la búsqueda es IFT en servicio: **25 mN/m (≤69 kV) →
> 32 mN/m (≥230 kV)**. El resto son valores de práctica de industria a confirmar.

## C) Rigidez dieléctrica — método importa (no comparar D1816 vs D877)

- **D1816** (electrodos redondeados VDE, gap 1 o 2 mm): muy sensible a agua y
  partículas → preferido por IEEE C57.106 (de-énfasis de D877 desde la rev. 2002).
- **D877** (discos planos): menos sensible; valores típicos más altos (nuevo ≥30 kV).
- ⚠️ Reportar SIEMPRE el método y el gap. Un "BDV bajo" sin método es ininterpretable.

## D) Tendencia e éster natural

- **Tendencia** (NETA / IEEE C57.152): IFT que cae o acidez que sube sostenidamente
  vs baseline = degradación, **aunque cada valor pase**. La pendiente condena.
- **Éster natural**: usar la columna de éster (Tabla 100.3 da FP éster 1.0% vs mineral
  0.5%); mayor tolerancia de agua. No penalizar contra límites de aceite mineral.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Para CADA parámetro (rigidez, acidez, IFT, agua, FP, color) evalúa TODAS las ópticas:
  vs fábrica/recepción (si existe)              → [✔/✘/—]   (precedencia 1)
  vs mínimo por CLASE (MO.00418)                → [✔/✘]      (precedencia 2)
  vs NETA 100.4 (nuevo) / IEEE C57.106 (servicio)→ [✔/✘]     (precedencia 3)
  vs límite ASTM del método                     → [✔/✘]      (precedencia 4)
  vs histórico (tendencia)                      → [estable / ↓↓ degrada]
ÍNDICE DE ENVEJECIMIENTO: cruzar IFT+acidez+color (no aislado)
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar divergencias (ej. rigidez pasa pero IFT+acidez condenan → "envejecido, INVESTIGAR").
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con DGA + DFR + IR/FP) antes de nombrar la causa.
