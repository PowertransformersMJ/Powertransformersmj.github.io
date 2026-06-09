# 02 · Cálculos — capacitancias, %FP, criterio de cambio

> Reglas en `../../_conocimiento/convenciones-calculo.md`. Los valores de referencia (C1/C2/FP de
> fábrica) vienen de la **placa del buje** → `⚠️ verificar` si no se tienen. La **interpretación**
> (límites de aceptación, tendencia) es del lóbulo 49 (`../../pruebas-electricas/`).

## A) Cambio relativo de capacitancia (criterio de alarma)

```
ΔC%  =  (C_medida − C_placa) / C_placa  × 100
```

- Un cambio de capacitancia respecto a la placa indica **alteración de la geometría dieléctrica**
  (cortocircuito de capas, pérdida de aceite/foil). Umbrales típicos del orden de **±5–10 %**
  exigen acción, pero el **límite exacto es del criterio de prueba** (`⚠️ verificar`,
  `../../pruebas-electricas/`). Aquí solo se establece la fórmula.

## B) Factor de potencia / tan δ

```
FP ≈ tan δ  (para ángulos pequeños)        P_pérdidas = V·I·cos φ ; FP = cos φ ≈ tan δ
```

- El **FP de buje** cuantifica las pérdidas dieléctricas del aislamiento. Sube con humedad,
  envejecimiento o contaminación.
- Se compara contra: (1) **placa del buje** (valor de fábrica), (2) **referencia histórica** del
  propio buje, (3) bujes hermanos (mismo lote). La **tendencia** importa más que el valor absoluto.
- Corrección por **temperatura**: el FP depende de la temperatura del aislamiento → se corrige a
  20 °C con el factor de la norma/fabricante (`⚠️ verificar` factor). Detalle → lóbulo 49.

## C) Relación C1/C2 y conexión de prueba

```
Hot-collar / UST / GST     →  selección según qué capacitancia se aísla (C1 vs C2)
C1 (núcleo)  se mide energizando el conductor central con el tap como retorno.
C2 (tap)     se mide energizando el tap con el conductor a tierra.
```

- Los **modos de conexión** (GST, UST, hot-collar) seleccionan qué porción del dieléctrico se mide.
  El procedimiento y la lectura correcta son del lóbulo 49 — aquí solo se nombra para que la ficha
  pida `C1` y `C2` por separado.

## D) No hay cálculo de dimensionamiento aquí

A diferencia de `../calculos-nominales` o `../impedancia-cortocircuito`, el buje **no se dimensiona**
en campo: su BIL, C1/C2 y FP de fábrica son **datos de placa**. El trabajo de campo es **comparar**
lo medido con esos datos. Por eso este lóbulo es más de *criterio* que de *cálculo*.

→ Identificar el tipo desde la placa y multi-norma: `03-criterios-evaluacion.md`.
