# 03 · Criterios de evaluación — validar el cálculo contra la placa

> Norma: IEEE C57.12.00 (tolerancias, placa), IEC 60076-1. Filosofía multi-norma en
> `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** tolerancias → `⚠️ verificar` edición.

## A) Coherencia interna del cálculo (debe cerrar)

Tres relaciones que SIEMPRE deben cumplirse; si una falla, hay error de lectura:

1. `S_3φ = √3 · V_L · I_L` para cada devanado (con su S de etapa).
2. `S` igual en todos los devanados (bidevanado) o igual a la suma asignada (tridevanado por carga).
3. La relación de línea reproduce con el factor √3 del grupo (`02 §D`).

## B) Validación contra la placa (cifras)

| Magnitud | Cómo se valida | Tolerancia (pública) |
|---|---|---|
| Corriente nominal | recalcular `I_L = S/(√3·V_L)` y comparar con placa | debe coincidir (es derivada) |
| Relación | `a_línea` vs `V_L,AT/V_L,BT` con factor √3 | **±0.5 %** — IEEE C57.12.00 ⚠️ verificar edición |
| Potencia por etapa | % de etapa vs placa | `⚠️ verificar` por unidad |

> La corriente nominal **no es un dato independiente**: si la placa la trae, debe reproducirse con
> `S` y `V`. Una discrepancia delata un error de transcripción de placa (`04 §C`).

## C) Evaluación MULTI-NORMA (registrar divergencias)

```
vs PLACA de la unidad (precedencia 1)        → S/V/I = ___   (la verdad del equipo)
vs interno MO.00418 (precedencia 2)          → ___          ⚠️ verificar con el director
vs IEEE C57.12.00 / IEC 60076-1              → tolerancias ___
CONSOLIDADO = mayor precedencia disponible; mostrar divergencias.
```

## D) Valores `⚠️ verificar` (consolidar para el director)

- **% exacto de cada etapa de enfriamiento** (60/80/100 es ejemplo) — placa de la unidad.
- Tolerancia de relación **±0.5 %** — IEEE C57.12.00, confirmar edición (2015/2021).
- Densidad de flujo de diseño `B` y margen a saturación — reporte de fábrica.
- Temperatura de referencia para corrientes/resistencias (75/85 °C) — norma/placa.

→ Qué falla si el cálculo está mal (errores, implicaciones): `04-diagnostico.md`.
