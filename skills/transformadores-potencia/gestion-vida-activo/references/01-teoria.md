# 01 · Teoría — envejecimiento y vida del aislamiento

> Base: IEEE C57.91 (loading/vida), EG cap.2/5, ABB Service Handbook. Backbone en
> `../../_conocimiento/00-fundamentos-transformador.md`. Los datos de condición (DP, furánicos,
> humedad, DGA) se **miden** en el lóbulo 49 (`../../pruebas-electricas/`).

## A) El papel es lo que envejece

- El **cobre** (devanados) y el **acero** (núcleo) **no envejecen** en operación normal. Lo que fija
  la **vida del transformador** es el **aislamiento sólido**: papel/celulosa y cartón prensado.
- El envejecimiento del papel es **irreversible**: las cadenas de celulosa se rompen (despolimerizan)
  por **calor, humedad y oxígeno**. Un papel envejecido pierde resistencia mecánica → no aguanta las
  fuerzas de cortocircuito (`../construccion-nucleo-devanados §B`) → falla.

## B) Grado de polimerización (DP) — el "kilometraje" del papel

```
DP NUEVO:        1000 – 1200
DP FIN DE VIDA:   150 – 250    (pérdida de ~50% de resistencia mecánica)
Carbonización del papel: ~150 °C
```

- El **DP** mide la longitud media de las cadenas de celulosa. Baja monótonamente con la edad
  térmica. Es el indicador más directo de la vida consumida.
- El DP se mide en una **muestra de papel** (intrusivo) o se **estima** por **furánicos / 2-FAL** en
  el aceite (no intrusivo) → lóbulo 49. Aquí se usa el valor como **entrada** de la decisión.

## C) El punto caliente (hot-spot) gobierna la vida

- La vida no se consume según la temperatura **media** del aceite, sino según la del **punto más
  caliente** del devanado (**hot-spot**), donde el papel se degrada más rápido (IEEE C57.91).
- El hot-spot = top-oil + gradiente devanado-aceite + sobre-elevación local. La **imagen térmica**
  (`../bujes-y-accesorios`, `../sistema-refrigeracion`) lo simula para gobernar ventiladores y alarmas.

## D) Ley de Montsinger (envejecimiento exponencial)

```
cada ≈ 6 – 8 °C de aumento del hot-spot  →  DUPLICA la tasa de envejecimiento del papel
```

- Es una simplificación de Arrhenius: el envejecimiento es **exponencial** con la temperatura. Por
  eso una sobrecarga breve a alta temperatura consume **mucha** vida, y operar fresco la **alarga**.
- Implicación de gestión: **no existe el almuerzo gratis** — subir carga sube hot-spot sube
  consumo de vida. "Subir de etapa de refrigeración no regala MVA" (`../sistema-refrigeracion`,
  EG cap.6.2): solo evacúa más calor para **el mismo** límite de hot-spot.

## E) Humedad y oxígeno (aceleradores)

| Acelerador | Objetivo | Efecto |
|---|---|---|
| **Agua en papel** | < 2 % | acelera la despolimerización; baja el BIL; burbujeo en sobrecarga |
| **Agua en aceite** | ~20 ppm (límite ~30) `⚠️ verificar` | migra al papel con la temperatura |
| **Oxígeno** | bajo (conservador con membrana) | oxida la celulosa y el aceite |

- El **conservador con membrana** (`../bujes-y-accesorios`) reduce oxígeno y humedad → alarga la vida.

## F) Por qué importa para la gestión

- Permite **estimar vida consumida/restante**, **decidir cargabilidad/sobrecarga** con criterio, y
  **priorizar** qué unidades de la flota intervenir primero (condición × criticidad) → `04`.

→ Cálculos (hot-spot, Montsinger, pérdida de vida): `02-calculos.md`. Criterios de fin de vida: `03`.
