# 01 · Teoría — qué es "nominal" y las magnitudes de placa

> Base: IEEE C57.12.00 (ratings/placa), IEC 60076-1. Magnitudes y símbolos en
> `../../_conocimiento/convenciones-calculo.md`. Refrigeración por etapas en
> `../../_conocimiento/00-fundamentos-transformador.md §E` y `../sistema-refrigeracion`.

## A) Qué significa "nominal" (rated)

Los valores nominales son las condiciones de diseño en las que el equipo entrega su potencia
**sin exceder el calentamiento admisible** (aislamiento clase A, 65 °C de rise típico). No son un
límite físico instantáneo, sino el punto en que la **vida del papel** es la esperada (`../gestion-vida-activo`).

- **S nominal (MVA)**: potencia aparente trifásica de diseño, por etapa de enfriamiento.
- **V nominal (kV)**: tensión de línea de cada devanado en la toma principal (`../regulacion-tomas`).
- **I nominal (A)**: la corriente de línea que resulta de `S` y `V` → se **calcula**, no es un dato
  independiente (`02 §A`).

## B) Potencias por ETAPA de enfriamiento

Un mismo transformador tiene **varias potencias nominales**, una por modo de refrigeración activo
(la placa lista p.ej. `60/80/100 MVA` para `ONAN/ONAF/OFAF`):

| Etapa | Qué activa | S típica (ejemplo) |
|---|---|---|
| ONAN | convección natural | 60 % (base) |
| ONAF | ventiladores | 80 % |
| OFAF / ODAF | bombas + ventiladores | 100 % |

> ⚠️ **Regla EG cap. 6.2**: subir de etapa **NO regala MVA** — sacar más potencia por refrigeración
> exige que el equipo **se haya diseñado** para esa potencia. Los % exactos varían por unidad →
> `⚠️ verificar` en placa. La corriente nominal se calcula con el MVA de **la etapa correspondiente**.

## C) Tensión, espiras y densidad de flujo

La tensión por espira liga el diseño magnético con el eléctrico (ley de Faraday):

```
V_fase / N = 4.44 · f · B · A_núcleo      (tensión por espira)
```

- `f` = frecuencia (60 Hz), `B` = densidad de flujo (T), `A_núcleo` = sección del núcleo (m²).
- A igualdad de espiras, **más tensión → más flujo → más riesgo de saturación**. Relevante para
  sobreexcitación (V/Hz) y para auditar relaciones (`02 §D`).

## D) Por qué la conexión cambia los números (fase vs línea)

La potencia trifásica `S_3φ = √3·V_L·I_L` usa magnitudes de **línea**, pero la corriente que ve
**cada bobina** es la de **fase**:

- **Estrella (Y)**: `I_fase = I_L`, pero `V_fase = V_L/√3`.
- **Delta (Δ)**: `V_fase = V_L`, pero `I_fase = I_L/√3`.

> Confundir fase con línea es el error #1 (`04 §C`). La resistencia de devanados, por ejemplo, se
> mide por bobina (fase) y debe compararse con la `I_fase`, no la de línea.

→ Cómo se calcula cada magnitud paso a paso: `02-calculos.md`. Cómo validar vs placa: `03-criterios-evaluacion.md`.
