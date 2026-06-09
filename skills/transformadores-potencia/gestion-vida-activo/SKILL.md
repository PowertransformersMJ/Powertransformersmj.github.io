---
name: gestion-vida-activo
description: Explica la GESTIÓN DE VIDA del transformador de potencia como activo — el envejecimiento del aislamiento sólido (papel/celulosa), el grado de polimerización (DP 1000-1200 nuevo → 150-250 fin de vida), el punto caliente (hot-spot) que gobierna la vida (IEEE C57.91), la ley de Montsinger (6-8 °C duplican el envejecimiento), la cargabilidad/sobrecarga, la pérdida de vida acumulada, y la priorización de riesgo de la flota (MTMP / condición). Úsala SIEMPRE que el usuario mencione vida útil, envejecimiento, papel/celulosa, DP / grado de polimerización, punto caliente / hot-spot, cargabilidad, sobrecarga, pérdida de vida, fin de vida, IEEE C57.91, Montsinger, o priorización/gestión de la flota de transformadores.
---

# Gestión de vida del activo

La vida del transformador la fija la **vida del aislamiento sólido** (papel/celulosa): el cobre y el
acero no envejecen, el **papel sí**. La temperatura del **punto caliente** (hot-spot) gobierna la
velocidad de envejecimiento. Gestionar el activo es estimar cuánta vida se consume con la carga y la
temperatura, y **priorizar** la flota por riesgo.

## Cuándo se dispara

El usuario menciona la vida útil, el envejecimiento del aislamiento, el **papel/celulosa**, el
**DP** (grado de polimerización), el **punto caliente/hot-spot**, la **cargabilidad/sobrecarga**, la
pérdida de vida acumulada, el fin de vida, IEEE C57.91, la ley de **Montsinger**, o la priorización
de riesgo de la flota.

## Workflow (5 pasos)

1. **Ubica el aislamiento sólido como límite de vida**: el papel es lo que envejece irreversiblemente.
   → `references/01-teoria.md`.
2. **Estima la temperatura del punto caliente** (hot-spot) bajo la carga real → gobierna la tasa de
   envejecimiento (IEEE C57.91). → `references/02-calculos.md`.
3. **Aplica la ley de Montsinger** (≈6–8 °C duplican el envejecimiento) para comparar escenarios de
   carga / sobrecarga y la pérdida de vida acumulada.
4. **Cruza con el estado medido**: DP del papel (1000-1200 nuevo → 150-250 EOL) y furánicos/2-FAL son
   del lóbulo 49 (`../../pruebas-electricas/`) — aquí se usan como entrada para la decisión.
5. **Prioriza la flota por riesgo** (condición + criticidad) y recomienda acción. → `references/04-diagnostico.md`.

## Fórmulas / conceptos núcleo

```
LÍMITE DE VIDA = aislamiento SÓLIDO (papel/celulosa). Cobre/acero no envejecen.
DP (grado de polimerización): NUEVO 1000–1200 → FIN DE VIDA 150–250. Carbonización ~150 °C.
HOT-SPOT gobierna la vida (IEEE C57.91): la vida se consume según la T del punto más caliente,
   no la T media del aceite.
MONTSINGER: cada ≈ 6–8 °C de aumento de hot-spot DUPLICA la tasa de envejecimiento.
   (regla exponencial de Arrhenius simplificada)
CARGABILIDAD: "subir de etapa de refrigeración NO regala MVA" (../sistema-refrigeracion).
   Sobrecargar sube el hot-spot → consume vida más rápido (compromiso, no almuerzo gratis).
AGUA: papel < 2 % ; aceite objetivo ~20 ppm (límite ~30) — la humedad acelera el envejecimiento.
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — papel como límite de vida, DP, hot-spot, humedad, mecanismos.
- `references/02-calculos.md` — hot-spot, Montsinger, pérdida de vida, cargabilidad (IEEE C57.91).
- `references/03-criterios-evaluacion.md` — criterios de fin de vida, multi-norma, qué medir.
- `references/04-diagnostico.md` — priorización de riesgo de flota, errores, acción.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md`,
`../_conocimiento/convenciones-calculo.md`, `../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de gestión de vida)

```
LÍMITE DE VIDA: aislamiento sólido (papel)
DP estimado/medido: <valor — nuevo 1000-1200 / EOL 150-250 — ⚠️ verificar (lóbulo 49)>
HOT-SPOT bajo carga: <°C ⚠️ verificar diseño> · vs límite de clase térmica
PÉRDIDA DE VIDA: <relativa, vía Montsinger; escenario de carga>
HUMEDAD: papel <% ⚠️ verificar> · aceite <ppm — lóbulo 49>
RIESGO (condición × criticidad): <bajo/medio/alto>
ACCIÓN: <monitoreo / secado / restricción de carga / reemplazo>
⚠️ VERIFICAR: <DP y furánicos (lóbulo 49), hot-spot de diseño, límites MO.00418>
```

→ Los datos de condición (DP, furánicos/2-FAL, humedad, DGA) se **miden** en el lóbulo 49
(`../../pruebas-electricas/`); aquí se **interpretan para la vida del activo** y la priorización.
