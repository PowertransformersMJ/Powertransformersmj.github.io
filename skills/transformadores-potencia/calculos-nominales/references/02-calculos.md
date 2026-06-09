# 02 · Cálculos — corriente, potencia por etapa, relación, V/espira

> Reglas y símbolos en `../../_conocimiento/convenciones-calculo.md`. Reportar SIEMPRE
> fórmula + entradas + resultado (trazabilidad). **Nunca inventar** % de etapa o base → `⚠️ verificar`.

## A) Corriente nominal de LÍNEA por devanado

```
I_L = S_3φ / (√3 · V_L)
```

Ejemplo: `S = 100 MVA`, `V_L = 115 kV` → `I_L = 100e6 / (√3 · 115e3) = 502 A`.

| Devanado | S (MVA) | V_L (kV) | I_L = S/(√3·V_L) |
|---|---|---|---|
| AT | 100 | 230 | 251 A |
| BT | 100 | 34.5 | 1674 A |

> Cada devanado pasa la **misma S** (bidevanado), pero **distinta I** según su tensión. En
> tridevanado, cada devanado lleva **su** S de carga (`../impedancia-cortocircuito`).

## B) Corriente de FASE según conexión

```
Estrella (Y):  I_fase = I_L            V_fase = V_L/√3
Delta   (Δ):  I_fase = I_L/√3         V_fase = V_L
```

> La `I_fase` es la que circula por **la bobina** → es la referencia para resistencia de devanados
> y para las fuerzas de cortocircuito (∝ I²). La de **línea** es la de los bornes.

## C) Corriente por ETAPA de enfriamiento

Cada etapa tiene su S → su I_L. A misma tensión, la corriente escala con la potencia de la etapa:

```
I_L,etapa = S_etapa / (√3 · V_L)
```

Ejemplo `V_L=115 kV`, etapas `60/80/100 MVA`:
`ONAN → 301 A` · `ONAF → 402 A` · `OFAF → 502 A`.

> ⚠️ Usar el MVA de la **etapa correctamente seleccionada**; subir de etapa exige diseño previo
> (`01 §B`). Los % (60/80/100) son ejemplo → `⚠️ verificar` en placa de la unidad.

## D) Relación de transformación (con el factor √3 del grupo)

```
relación de línea = a · k√3      donde a = N_AT/N_BT (espiras, fase)
   Yy/Dd → k√3 = 1     Dy → k√3 = 1/√3     Yd → k√3 = √3
```

Validación: `a_línea_placa = V_L,AT / V_L,BT` debe coincidir. Ej. `230/34.5 kV` en **Dy** ⇒ la
relación de **espiras** efectiva es `a = (230/34.5)·√3 = 11.5` (porque `relación_línea = a/√3`).
Si no cuadra, el grupo o la lectura están mal → `../grupo-vectorial-conexiones 03 §C`.

## E) Densidad de flujo / V-por-espira (si se conoce nº de espiras)

```
V_fase / N = 4.44 · f · B · A_núcleo
```

- Despejar `B` para chequear margen a saturación (típico ~1.5–1.7 T en acero GO, `⚠️ verificar` diseño).
- Útil para sobreexcitación: `V/Hz` por encima de ~1.1 pu sostenido satura el núcleo (riesgo térmico).

## F) Reparto de carga (anticipo a paralelo / tridevanado)

Si dos devanados o unidades comparten carga, el reparto va **inverso a la impedancia**:

```
S_i / S_total ≈ (S_nom,i / Z%_i) / Σ(S_nom/Z%)
```

> Detalle de impedancias y base común → `../impedancia-cortocircuito`.
