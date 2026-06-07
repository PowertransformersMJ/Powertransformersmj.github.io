# 02 · Cálculos — ajuste X-Y, corrección de temperatura, lectura del % humedad

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Curva tan δ (o C y pérdidas) vs frecuencia | tan δ(f) | Sí | barrido típico ~1 mHz – 1 kHz |
| Temperatura del aislamiento al ensayo | T | Sí | °C; sin ella el % humedad no es interpretable |
| Geometría X-Y del aislamiento | X, Y | preferente | mejora el ajuste; si no, se usa default del software |
| Conductividad del aceite (o se obtiene del ajuste) | σ_aceite | salida | separa aceite de papel |
| Datos convergentes | — | preferente | agua en aceite (D1533), IR/PI, FP a red |
| Humedad de fábrica / previos | — | preferente | tendencia (ingreso de humedad) |

> El DFR NO se calcula a mano: el % de humedad sale del **software de ajuste** del equipo
> (Megger IDAX, OMICRON DIRANA, etc.). Esta neurona explica QUÉ hace ese ajuste para poder
> interpretarlo y verificarlo, no para reemplazarlo.

---

## 1) Ajuste al modelo X-Y ⭐ (separar papel de aceite)

El software compara la **curva medida** tan δ(f) contra una **familia de curvas modeladas**
parametrizadas por:
- **% humedad del papel** (m_papel)
- **conductividad del aceite** (σ_aceite)
- geometría **X-Y** del ducto de aislamiento

```
minimizar  Σ_f [ tan δ_medida(f) − tan δ_modelo(f; m_papel, σ_aceite, X, Y) ]²
→ entrega (m_papel, σ_aceite) que mejor reproducen la curva
```

La **calidad del ajuste** (residual) debe reportarse: un mal ajuste (curva medida que no
encaja en ninguna del modelo) invalida el % de humedad → revisar T, geometría, o ruido.

---

## 2) Corrección por temperatura a 20 °C ⭐ (imprescindible)

La curva tan δ(f) se **desplaza en frecuencia** con la T. El software aplica un factor de
corrimiento (shift) basado en la energía de activación del aislamiento para llevar la
medición a la temperatura de referencia (20 °C) antes de leer el % de humedad.

**Regla práctica**: el % de humedad SIEMPRE se reporta **a 20 °C** + se anota la **T real**
del ensayo. Comparar dos DFR a temperaturas distintas sin corregir = error grueso.

**Ejemplo de lectura**: ajuste X-Y a T=45 °C → corregido a 20 °C → **m_papel = 3.2%**,
σ_aceite indicando aceite moderadamente conductivo. Se compara el 3.2% contra el criterio
de `03-criterios-evaluacion.md`.

---

## 3) Interpretación del % de humedad (órdenes de magnitud orientativos)

Escala de referencia de industria/CIGRE para humedad de la celulosa (⚠️ verificar):

```
< 2%        Seco (sano)
2 – 3%      Moderadamente húmedo (vigilar)
3 – 4.5%    Húmedo (considerar secado)
> 4.5%      Muy húmedo (secado necesario; riesgo)
```

> ⚠️ Estos cortes (2 / 3 / 4.5%) provienen de práctica de industria / guías CIGRE.
> **Verificar contra la edición de norma del director** (CIGRE TB 349/414 e IEEE C57.152
> /C57.161) antes de tomarlos como definitivos.

---

## 4) Coherencia con otras pruebas (sanity-check)

- DFR húmedo (>3%) **debe** correlacionar con **agua en aceite** alta (D1533, en %
  saturación) e IR/PI bajos. Si el DFR dice húmedo pero IR/agua están bien → revisar el
  ajuste/T del DFR.
- DFR seco (<2%) con IR baja → la baja IR **no es humedad** (es contaminación de bujes,
  partículas, o T mal corregida). El DFR **descarta** humedad: ese es su valor de árbitro.

---

## Pseudocódigo de referencia (interpretar la salida del equipo)

```
function interpretarDFR({curva, T, geomXY, convergentes}) {
  const fit = ajusteXY(curva, geomXY);          // entrega {m_papel, sigma_aceite, residual}
  const mPapel20 = corregirTemp(fit.m_papel, T, 20);  // a 20 °C
  const calidad  = fit.residual < UMBRAL ? 'bueno' : 'revisar';
  const veredicto= clasificarHumedad(mPapel20);  // seco/vigilar/secar (03-…)
  // cruzar con convergentes (agua aceite, IR/PI) → 04-diagnostico.md
}
```
