# 01 · Teoría — Gases disueltos como huella de falla

## Qué mide el DGA

Toda falla incipiente dentro de un transformador (un punto caliente, un arco, una
descarga parcial) **descompone** el aceite y/o la celulosa, liberando gases que se
**disuelven** en el aceite. El DGA extrae esos gases de una muestra (ASTM D3612 /
IEC 60567) y mide su concentración en **ppm**. Como cada mecanismo de falla genera
una **combinación característica** de gases a distintas temperaturas, el patrón de
ppm es una **huella diagnóstica** del tipo y la severidad de la falla — y, por ser
una prueba en aceite (no off-line), detecta el problema **meses antes** que las
pruebas eléctricas.

## Los 7 gases clave y qué falla revela cada uno

| Gas | Símbolo | Se genera por | Indica |
|---|---|---|---|
| **Hidrógeno** | H2 | casi cualquier falla; el más temprano | descarga parcial / corona; gas "universal" |
| **Metano** | CH4 | calentamiento de baja T | falla térmica incipiente (<300 °C) |
| **Etano** | C2H6 | calentamiento medio | falla térmica de baja-media T |
| **Etileno** | C2H4 | calentamiento alto | **falla térmica de alta T (>300 °C)**, punto caliente |
| **Acetileno** | C2H2 | arco eléctrico / alta energía | **arco / descarga de alta energía** (el más grave) |
| **Monóxido de carbono** | CO | degradación de la **celulosa** (papel) | sobrecalentamiento del papel |
| **Dióxido de carbono** | CO2 | degradación de la celulosa (oxidación lenta) | envejecimiento térmico del papel |

> Regla mnemotécnica: **gases del aceite** (H2, CH4, C2H6, C2H4, C2H2) firman fallas
> del líquido; **gases de la celulosa** (CO, CO₂) firman degradación del papel. El
> **acetileno (C2H2)** es la bandera roja: su sola aparición sugiere arco.

## La escalera térmica: temperatura → gas dominante

A medida que sube la energía/temperatura de la falla, el gas dominante cambia:

```
PD/corona (baja energía)         → H2 (+ algo de CH4)
Térmico < 300 °C (T1)            → CH4, C2H6 dominantes
Térmico 300–700 °C (T2)          → C2H4 aparece y crece
Térmico > 700 °C (T3)            → C2H4 dominante (+ algo de H2)
Arco / descarga alta energía (D2)→ C2H2 (acetileno) + H2 fuertes
```

Esta progresión es la base física de **todos** los métodos de diagnóstico (Duval,
Rogers, Doernenburg): todos leen **relaciones** entre estos gases para ubicar la
falla en esa escalera térmica/eléctrica.

## Por qué la tasa de generación importa más que el nivel

IEEE C57.104-2019 cambió el énfasis: un **nivel** alto pero **estable** (gases viejos
de un evento ya resuelto) puede ser inofensivo, mientras un nivel "normal" que
**sube rápido** indica una falla **activa**. Por eso el motor predictivo es la
**tasa de generación** (ppm/mes), no la foto puntual. La edición 2019 usa
percentiles estadísticos (90/95) por gas en lugar de un único umbral TDCG fijo.

## Nivel vs diagnóstico (dos preguntas distintas)

El DGA responde **dos** preguntas que no hay que mezclar:
1. **¿Hay falla y cuán grave?** → niveles y tasa de generación (IEEE C57.104-2019
   status 1/2/3) — define la urgencia.
2. **¿Qué tipo de falla?** → relaciones de gases (Duval/Rogers/Doernenburg) — define
   la acción. **Las relaciones solo son válidas si los gases superan umbrales mínimos**
   (si todo está en ruido, la relación no significa nada).

> Continúa en `02-calculos.md` (TDCG, tasa, relaciones con ejemplo) y
> `03-criterios-evaluacion.md` (status 1/2/3 e IEC 60599).
