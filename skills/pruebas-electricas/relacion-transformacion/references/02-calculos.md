# 02 · Cálculos — relación nominal por conexión y desviación %

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Tensión de placa AT por TAP | V_AT | Sí | tensión de línea nominal de cada posición |
| Tensión de placa BT | V_BT | Sí | tensión de línea del secundario |
| Grupo de conexión (vector) | — | Sí | Dyn11, Yyn0, Dd0… define el factor √3 |
| Relación medida por fase y TAP | R_med | Sí | la lectura del ratiómetro |
| Corriente de excitación / desfase | I_exc, φ | preferente | acompaña al diagnóstico |
| Dato de fábrica (si existe) | — | preferente | tiene precedencia sobre placa |

---

## 1) Relación nominal calculada (ajustada por conexión) ⭐

La relación de espiras nominal sale del ratio de tensiones de **fase**, no de línea. El
factor depende de la conexión de cada lado:

```
R_calc = (V_AT_fase) / (V_BT_fase)
```

| Conexión (AT/BT) | V_fase AT | V_fase BT | R_calc |
|---|---|---|---|
| Yy (estrella/estrella) | V_AT/√3 | V_BT/√3 | V_AT / V_BT |
| Dd (delta/delta) | V_AT | V_BT | V_AT / V_BT |
| **Dyn** (delta AT / estrella BT) | V_AT | V_BT/√3 | (V_AT · √3) / V_BT |
| **Yd** (estrella AT / delta BT) | V_AT/√3 | V_BT | V_AT / (V_BT · √3) |

**Ejemplo** (Dyn11): V_AT = 13,200 V, V_BT = 480 V →
`R_calc = (13200 × √3) / 480 = (13200 × 1.732) / 480 = 22862 / 480 = 47.63`.

---

## 2) Desviación porcentual por fase y TAP ⭐ (el número que se evalúa)

```
%dev = (R_medida − R_calc) / R_calc × 100
```

**Ejemplo**: R_calc = 47.63, R_medida(fase A) = 47.70 →
`%dev = (47.70 − 47.63)/47.63 × 100 = 0.147 %` → **dentro de ≤0.5% (APRUEBA)**.

**Ejemplo de falla**: R_medida(fase B) = 47.21 →
`%dev = (47.21 − 47.63)/47.63 × 100 = −0.882 %` → **excede ±0.5% (INVESTIGAR/RECHAZA)**;
si además I_exc de la fase B está alta → espiras en corto (ver `04-diagnostico.md`).

> **Criterio alternativo NETA**: la desviación también se evalúa **vs bobinas adyacentes**
> (fases hermanas) — no solo vs el ratio calculado. Una fase que se desvía >0.5% de las otras
> dos localiza el defecto aunque el ratio calculado de placa tuviera tolerancia.

---

## 3) Verificación del cambiador de tomas (TAP) — paso de tensión

Entre dos TAPs consecutivos el ratio debe cambiar en el **% de paso del conmutador** declarado
en placa (típico ±2.5% por escalón). Verificar que `R_calc(TAP n+1) − R_calc(TAP n)` siga el
escalón nominal en TODAS las posiciones; un salto que no corresponde = defecto del conmutador.

```
paso% ≈ (R_calc(TAP n+1) − R_calc(TAP n)) / R_calc(TAP nominal) × 100
```

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarTTR({Vat, Vbt, conexion, lecturas, datoFabrica}) {
  const Rcalc = ratioPorConexion(Vat, Vbt, conexion);     // tabla §1, incluye √3
  const devs  = lecturas.map(L => ({
    tap: L.tap, fase: L.fase,
    pdev: (L.Rmed - Rcalc[L.tap]) / Rcalc[L.tap] * 100      // §2
  }));
  const criterio = datoFabrica ?? 0.5;                     // jerarquía: fábrica > clase > NETA 0.5%
  // veredicto = peor %dev vs criterio; cruzar con excitación si falla → 03/04
}
```
