# 03 · Criterios de evaluación — interpretación por banda con cita normativa

> SFRA NO tiene umbral numérico de "pasa/no pasa". Su criterio es **comparativo y por
> bandas**. Jerarquía de baseline (mayor a menor confianza): **(1) huella de fábrica/
> commissioning de la propia unidad → (2) ensayo previo de la misma unidad (time-based) →
> (3) unidad gemela (type-based) → (4) fase hermana (construction-based)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-óptica + consolidado (el más
> conservador) + dónde divergen. Aquí "óptica" incluye cada baseline + cada norma.

---

## A) Criterio por NORMA (qué dice cada una)

### A.1 — NETA ATS-2025 §7.2.2 D.7

| Criterio NETA | Lectura |
|---|---|
| **Comparar SFRA vs fábrica y vs previos** | divergencia significativa de la huella = INVESTIGAR |

→ Fuente: `../../_conocimiento/00-BATERIA-NETA-7.2.2.md` (D.7). NETA no da un número: exige
**comparación** contra fábrica/previos. La prueba es **opcional** (`*`) en §7.2.2.

### A.2 — IEEE C57.149 (guía de aplicación e interpretación de FRA, tx en aceite)

- Define instrumentación, procedimiento y **técnicas de análisis** de la huella.
- Advierte explícitamente: las **bandas no tienen límites fijos en Hz** — se definen por la
  **forma** de la respuesta y dependen del diseño/potencia del tx.
- Interpretación: baja f → núcleo/magnético; media f → devanados/geometría; alta f →
  conexiones/derivaciones/montaje. ⚠️ **verificar** redacción/edición (C57.149-2012 / 2024).

### A.3 — IEC 60076-18 (Measurement of frequency response)

- Norma internacional gemela de C57.149: método de medición de respuesta en frecuencia.
- Igual filosofía: **comparación de huellas**, no umbral absoluto. ⚠️ **verificar** edición.

### A.4 — Criterio interno por CLASE (MO.00418)

Si el tablero define reglas de aceptación de divergencia por clase, aplican como criterio
primario. ⚠️ **Verificar** contra la norma interna del director.

---

## B) MATRIZ — divergencia por banda → veredicto

| Banda con divergencia vs baseline | Subsistema | Veredicto base |
|---|---|---|
| **Baja** (núcleo/magnético) | núcleo, sujeción, magnetismo residual, espiras en corto | INVESTIGAR (desmagnetizar y repetir primero) |
| **Media** (devanados/geometría) | desplazamiento axial/radial, deformación | INVESTIGAR→RECHAZA si converge con reactancia |
| **Alta** (conexiones/cables) | set-up de prueba, conexión floja | repetir set-up; rara vez condena el tx |
| **Sin divergencia** (todas coinciden) | — | APRUEBA (registrar como nuevo baseline) |

> **Regla de oro SFRA**: una divergencia de **alta f** se trata como set-up hasta probar lo
> contrario; una de **media f** reproducible es la más sospechosa de deformación real; una
> de **baja f** exige desmagnetizar y repetir antes de condenar.

---

## C) Coherencia entre fases y vs histórico (tendencia)

- **Entre fases (construction-based)**: las 3 huellas de un tx sano son muy parecidas; una
  fase distinta localiza el problema (cuidado: las fases externas vs central difieren algo
  por diseño — comparar contra la misma fase del baseline si existe).
- **Time-based (la más fuerte)**: la misma unidad vs su huella previa. Un cambio reproducible
  es la evidencia más sólida de un cambio físico.
- **Pre vs post evento**: comparar antes/después de un cortocircuito pasante o transporte.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
1. ¿Set-up equivalente al baseline? (TAP, cables, aterrizaje)  → si no, repetir, NO diagnosticar.
2. Compara por banda vs baseline (fábrica/previo/gemela/fase hermana). Evalúa TODAS las ópticas:
   Baseline fábrica/previo (precedencia 1)        → [✔ coincide / ✘ desvía]
   Interno por clase (MO.00418, precedencia 2)     → [✔/✘]
   NETA §7.2.2 D.7 (vs fábrica/previos, precedencia 3) → [✔/✘]
   IEEE C57.149 / IEC 60076-18 (interpretación banda) → [✔/✘]
   Tendencia (time-based / pre-post evento)        → [estable / cambió]
3. Localiza la banda divergente → subsistema (núcleo/devanados/conexiones).
VEREDICTO CONSOLIDADO = el PEOR de las ópticas, citando la banda + el criterio.
  ⊳ Reportar divergencias (ej. media f desvía pero baja/alta coinciden → deformación de devanado).
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si hay divergencia en media/baja f, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con reactancia de dispersión + excitación + relación) antes de nombrar la causa.
