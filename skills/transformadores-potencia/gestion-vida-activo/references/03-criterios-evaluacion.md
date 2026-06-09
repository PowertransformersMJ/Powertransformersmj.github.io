# 03 · Criterios de evaluación — fin de vida y qué medir

> Norma/fuente: IEEE C57.91 (vida/carga), EG cap.2/5, ABB MTMP (gestión de flota). Filosofía
> multi-norma en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** límites →
> `⚠️ verificar` (MO.00418 / norma).

## A) Indicadores de fin de vida del aislamiento

| Indicador | Nuevo | Fin de vida | Fuente |
|---|---|---|---|
| **DP** (grado de polimerización) | 1000–1200 | 150–250 | muestra de papel (intrusivo) — lóbulo 49 |
| **2-FAL / furánicos** | ~0 | creciente (correlaciona con DP bajo) | DGA furánicos — lóbulo 49 |
| **Resistencia mecánica del papel** | 100 % | ~50 % | correlato del DP |
| **Agua en papel** | < 2 % | > 4 % acelera mucho | estimada del aceite — lóbulo 49 |

- El **DP** es el criterio de oro; los **furánicos** son el sustituto no intrusivo. **CO/CO2** del DGA
  también indican degradación de celulosa (lóbulo 49). La **medición** es del lóbulo 49; aquí se
  **interpreta para la vida**.

## B) Qué entra a la decisión de vida (entradas)

1. **Condición del aislamiento**: DP / furánicos / humedad (lóbulo 49).
2. **Historia térmica**: perfil de carga, hot-spot estimado, pérdida de vida acumulada (`02 §C`).
3. **Estrés acumulado**: nº y severidad de cortocircuitos pasantes (`../impedancia-cortocircuito`,
   `../construccion-nucleo-devanados §B`) — el papel envejecido es más frágil a las fuerzas.
4. **Criticidad del activo**: ubicación en la red, redundancia, MVA, consecuencia de falla.

## C) Evaluación MULTI-NORMA

```
vs interno MO.00418 (precedencia 2)          → criterios de cargabilidad y reemplazo  ⚠️ verificar
vs IEEE C57.91 (precedencia 3)               → modelo de vida, hot-spot, F_AA
vs ABB MTMP / EG cap.2/5 (precedencia 4)     → priorización de flota, condición
CONSOLIDADO = criterio interno manda; el modelo IEEE da la física; lo ausente se marca.
```

> **MTMP (ABB)** = enfoque de gestión por condición + criticidad para priorizar la inversión en la
> flota (qué unidad intervenir primero). Los umbrales exactos de RS%/IC son `⚠️ verificar`.

## D) Valores `⚠️ verificar` (consolidar para el director)

- **DP / furánicos** actuales de cada unidad — lóbulo 49.
- **Hot-spot de diseño** y gradientes térmicos — reporte de fábrica / IEEE C57.91.
- **Límites de cargabilidad y de reemplazo** por MO.00418 — interno.
- **Clase térmica** del aislamiento (105/120/… °C) — placa.
- **Historia de cortocircuitos pasantes** de cada unidad — bitácora operativa.

→ Qué implica (priorización de flota, acción, errores): `04-diagnostico.md`.
