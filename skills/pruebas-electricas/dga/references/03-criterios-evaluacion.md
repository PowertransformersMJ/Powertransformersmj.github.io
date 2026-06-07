# 03 · Criterios de evaluación — status DGA, IEC 60599 y tendencia

> El DGA tiene **norma propia**: NETA §7.2.2.D.15 remite explícitamente a **IEEE
> C57.104**. La jerarquía de criterio: **(1) fábrica/baseline del propio tx → (2)
> interno (MO.00418) → (3) IEEE C57.104-2019 (status) / IEC 60599 (límites típicos)**.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: emite el veredicto contra cada óptica y
> consolida con el formato de `../../_conocimiento/marco-normativo-multinorma.md` (§4):
> per-norma + consolidado (el más conservador) + dónde divergen.

---

## A) IEEE C57.104-2019 — DGA Status 1 / 2 / 3 ⭐ (criterio principal)

La edición 2019 reemplazó las "Conditions" del TDCG por **3 estados gas-by-gas**
basados en **percentiles estadísticos** de la población de transformadores:

| Estado | Significado | Base estadística |
|---|---|---|
| **DGA Status 1** | Niveles bajos, sin indicio de gasificación (DGA no excepcional) | gas < percentil 90 |
| **DGA Status 2** | Niveles intermedios y/o posible gasificación (DGA posiblemente sospechoso) | percentil 90–95 |
| **DGA Status 3** | Niveles altos y/o gasificación activa probable (DGA probablemente sospechoso) | gas > percentil 95 |

El estado se evalúa **gas por gas** (no un único TDCG); el **peor gas** define el
estado global. Se combina con la **tasa de generación** (un Status 2 que genera
rápido escala a tratamiento como Status 3).

> ⚠️ **Verificar los valores ppm exactos** del percentil 90/95 por gas (Tablas 1 y 2
> de C57.104-2019) contra la edición de norma del director — no son públicos con
> certeza. Valores L1 (90º percentil) **típicos de referencia** (⚠️ verificar):
> H2 ≈ 80, CH4 ≈ 90, C2H6 ≈ 90, C2H4 ≈ 50, C2H2 ≈ 1, CO ≈ 900, CO2 ≈ 9000 ppm.

## B) IEC 60599 — concentraciones típicas y ratios (óptica internacional)

IEC 60599 da **valores típicos 90º percentil** y los **ratios de diagnóstico**
(C2H2/C2H4, CH4/H2, C2H4/C2H6). Aporta el marco internacional para Duval/Rogers.
⚠️ Los valores típicos por gas dependen del tipo de tx (con/sin OLTC comunicado);
**verificar** la tabla aplicable.

## C) Condición histórica TDCG (IEEE C57.104-**2008**, solo apoyo/tendencia)

La edición 2008 clasificaba por TDCG en 4 condiciones (Condition 1 ≤720 ppm …
Condition 4 >4630 ppm). **Ya no es el criterio primario** (2019 lo retiró), pero
sirve de **referencia histórica y de tendencia** si el cliente la pide. Marcar
siempre que el criterio vigente es la edición 2019.

## D) Tendencia (decisiva en DGA)

- **Tasa de generación** (`02-…`): un gas que sube sostenidamente condena aunque el
  nivel absoluto siga en Status 1–2. La pendiente manda (IEEE C57.104-2019).
- **Cambio de método** entre muestras (D3612 vs IEC 60567 vs sensor online) puede
  introducir saltos artificiales — normalizar antes de leer tendencia.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
1) NIVEL: clasifica cada gas → DGA Status (IEEE C57.104-2019). Status global = peor gas.
2) GENERACIÓN: tasa ppm/mes vs previa → [estable / activa]. Activa escala el estado.
3) ÓPTICAS:
   vs fábrica/baseline del tx                 → [✔/✘/—]   (precedencia 1)
   vs interno (MO.00418)                       → [✔/✘]      (precedencia 2)
   vs IEEE C57.104-2019 (status)               → [✔/✘]      (criterio DGA principal)
   vs IEC 60599 (típicos)                      → [✔/✘]
   vs histórico (tendencia/tasa)               → [estable / ↑↑ activa]
VEREDICTO CONSOLIDADO = el PEOR de las ópticas + el estado escalado por la tasa.
  ⊳ Divergencias: ej. nivel Status 2 pero generación alta → tratar como Status 3.
4) Solo si hay falla (gases > mínimos): diagnosticar TIPO en 04-diagnostico.md.
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Para el TIPO de falla (térmico/PD/arco) y la convergencia con otras pruebas, ve a
  `04-diagnostico.md` y `../../_conocimiento/diagnostico-integrado-bateria.md`.
