# 02 · Cálculos — índice de envejecimiento, % saturación de agua, corrección FP

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Rigidez dieléctrica | BDV | Sí | kV; indicar método (D1816 gap 1/2 mm, o D877) — NO comparables entre sí |
| Acidez / nº de neutralización | TAN | Sí | mg KOH/g |
| Tensión interfacial | IFT | Sí | mN/m (= dynes/cm) |
| Contenido de agua | W | Sí | ppm (Karl Fischer D1533) |
| FP / tan δ del aceite | DF | preferente | %, indicar T de medida (25 °C / 100 °C) |
| Color | — | preferente | escala D1500 |
| Temperatura del aceite al muestrear | T | Sí | define la solubilidad de agua (% saturación) |
| Clase de tensión + tipo de líquido | — | Sí | define la columna de criterio (Tabla 100.4) |
| Datos previos | — | preferente | tendencia (pesa tanto como el valor absoluto) |

---

## 1) Índice de envejecimiento (correlación IFT–acidez) ⭐

El estado oxidativo NO se lee de un parámetro: se cruza IFT con acidez. Regla de
clasificación clásica (curva de Myers / práctica de industria, **apoyo, no norma dura**):

```
Aceite sano:        IFT > 30 mN/m   y  TAN < 0.05 mgKOH/g
Envejecim. incip.:  IFT 25–30       o  TAN 0.05–0.10
Envejecim. marcado: IFT 20–25       o  TAN 0.10–0.20
Envejecim. severo:  IFT < 20        o  TAN > 0.20  (riesgo de lodos)
```

**Ejemplo**: IFT = 22 mN/m, TAN = 0.15, color D1500 = 3.0 → los tres apuntan a
**envejecimiento marcado por oxidación** (convergencia interna del propio aceite).
Acción candidata: regeneración/filtrado (ver `04-diagnostico.md`).

> ⚠️ Los cortes exactos (30/25/20 mN/m; 0.05/0.10/0.20) provienen de práctica de
> industria (IEEE C57.106 da límites por clase de tensión y antigüedad). **Verificar
> contra la edición de norma del director** antes de tomarlos como definitivos.

---

## 2) Porcentaje de saturación relativa de agua ⭐ (no leer ppm crudos)

La solubilidad del agua en aceite mineral crece con la T. Para juzgar humedad hay
que normalizar a **% de saturación**:

```
% saturación = (W_ppm / W_sat(T)) × 100
```

donde `W_sat(T)` es la solubilidad a la T de muestreo. Aproximación de industria
(aceite mineral): `W_sat(ppm) ≈ exp(7.42 − 1670/(T+273))` (T en °C). 

**Ejemplo**: W = 20 ppm a 30 °C → W_sat(30 °C) ≈ exp(7.42 − 1670/303) ≈ exp(1.91) ≈
**67 ppm** → % saturación = 20/67 ≈ **30%**. La misma 20 ppm a 60 °C (W_sat ≈ 200
ppm) da solo **10%** de saturación → el mismo número ppm, riesgo muy distinto.

> ⚠️ La constante de `W_sat(T)` varía por fabricante/tipo de aceite. **Verificar**
> la curva del aceite real. Para éster natural la solubilidad es mucho mayor → no
> aplicar esta fórmula de mineral.

---

## 3) Corrección del FP / tan δ del aceite

El FP del aceite es fuertemente dependiente de la T. Para comparar contra criterio,
reportar a la **misma T del método** (25 °C y 100 °C en Tabla 100.4) o corregir a
20 °C como el resto de la batería. Anotar SIEMPRE la T de medida; un FP @100 °C no
se compara contra un límite @25 °C.

---

## 4) Coherencia entre ensayos (sanity-check interno)

Antes de condenar, cruzar dentro del propio aceite:
- Rigidez baja **+ agua alta** → contaminación por humedad (coherente).
- Rigidez baja **con agua normal** → probables **partículas** (filtrar mecánicamente).
- FP alto **+ IFT baja + TAN alta** → envejecimiento (coherente).
- IFT baja **con TAN normal** → posible contaminación por compuestos polares externos.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarAceite({bdv, tan, ift, agua_ppm, fp, color, T, claseKV, liquido, previos}) {
  const wsat   = liquido==='mineral' ? Math.exp(7.42 - 1670/(T+273)) : null;
  const satPct = wsat ? (agua_ppm / wsat) * 100 : null;     // % saturación
  const aging  = clasificarEnvejecimiento(ift, tan, color); // sano…severo
  const crit   = criterioTabla100_4(claseKV, liquido);      // jerarquía: fábrica>clase>NETA/C57.106>ASTM
  const trend  = compararPrevios(previos);                  // tendencia
  // veredicto por parámetro → peor óptica → ver 03-criterios-evaluacion.md
}
```
