# 02 · Cálculos — hot-spot, Montsinger, pérdida de vida

> Reglas en `../../_conocimiento/convenciones-calculo.md`. Norma de carga: **IEEE C57.91**. Los datos
> térmicos de diseño (gradientes, hot-spot nominal) vienen del reporte de fábrica → `⚠️ verificar`.

## A) Temperatura del punto caliente (hot-spot)

```
Θ_hs  =  Θ_amb  +  ΔΘ_top-oil  +  ΔΘ_hs-oil
```

- `Θ_amb` = ambiente; `ΔΘ_top-oil` = sobre-elevación del aceite superior sobre el ambiente;
  `ΔΘ_hs-oil` = gradiente del punto caliente sobre el aceite (incluye el factor de hot-spot `H`).
- Ambos `Δ` dependen de la **carga** (`K = I/I_nom`) elevada a un exponente del modo de refrigeración
  (IEEE C57.91). A más carga → más hot-spot → más envejecimiento. Los exponentes y gradientes de
  diseño son `⚠️ verificar` (fábrica / IEEE C57.91).

## B) Factor de envejecimiento (Montsinger / Arrhenius)

```
F_AA  =  2^((Θ_hs − Θ_ref) / Δ)        con Δ ≈ 6–8 °C   (regla de Montsinger)
```

- `F_AA` = factor de aceleración del envejecimiento relativo a la temperatura de referencia `Θ_ref`
  (la del envejecimiento "normal" de la clase térmica). `F_AA = 1` → vida nominal; `F_AA = 2` →
  envejece al doble.
- IEEE C57.91 usa una forma de Arrhenius más precisa; **Montsinger (Δ≈6–8 °C duplica)** es la regla
  de bolsillo para razonar escenarios rápido. Para informe formal, usar la ecuación de la norma
  (`⚠️ verificar` constantes).

## C) Pérdida de vida acumulada

```
LOL  =  ∫ F_AA(t) dt      (integral del factor de envejecimiento sobre el tiempo)
        ≈ Σ F_AA,i · Δt_i  (suma por tramos de carga/temperatura)
```

- La **pérdida de vida** (Loss of Life) se acumula sumando el envejecimiento de cada tramo de carga.
  Un perfil con picos calientes consume vida desproporcionadamente (por el exponencial, `§B`).
- Útil para comparar **escenarios de cargabilidad**: una sobrecarga de emergencia corta puede ser
  aceptable; sostenida, no.

## D) Cargabilidad — el compromiso

```
subir refrigeración (ONAN→ONAF→OFAF)  →  evacúa más calor para el MISMO límite de hot-spot
NO sube el límite térmico del papel; permite mover más MVA SIN superar ese límite.
sobrecargar por encima de placa  →  hot-spot sube  →  F_AA sube  →  vida se consume más rápido
```

- Liga con `../sistema-refrigeracion` (etapas) y `../calculos-nominales` (I por etapa). La decisión
  de sobrecarga es un **balance vida vs necesidad operativa**, no un "MVA gratis" (EG cap.6.2).

## E) Humedad (corrección)

- El **% de agua en papel** se reparte con el aceite según la temperatura (curvas de equilibrio).
  Más humedad → el papel envejece más rápido y baja el BIL. El valor de agua en papel se **estima**
  desde el aceite (lóbulo 49). Aquí solo se nota que es un **multiplicador** del envejecimiento.

→ Criterios de fin de vida y qué medir: `03-criterios-evaluacion.md`.
