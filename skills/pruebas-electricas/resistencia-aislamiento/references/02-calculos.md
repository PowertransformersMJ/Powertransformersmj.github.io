# 02 · Cálculos — IR corregida, DAR, PI

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Lectura(s) de IR por par | R_medida | Sí | en MΩ o GΩ; conservar la unidad |
| Tiempos de lectura | t | para PI/DAR | 15s, 30s, 60s, 10 min según aplique |
| Temperatura del devanado | T | Sí | °C al momento del ensayo (top-oil ≈ devanado si estabilizado) |
| Voltaje de prueba DC | V_prueba | Sí | validar vs Tabla 100.5 por clase |
| Tensión de clase / placa | — | Sí | define el criterio de aceptación |
| Dato de fábrica (si existe) | — | preferente | tiene precedencia sobre tablas |

---

## 1) Corrección de temperatura a 20 °C ⭐ (hacer SIEMPRE primero)

```
R₂₀ = R_medida × K
```

- `K` = factor de la **Tabla 100.14.1**, columna **"Oil-immersed"** (tx en aceite).
- Si la temperatura no es un valor exacto de la tabla, **interpolar linealmente**
  entre las dos filas vecinas (la tabla va de 5 en 5 °C).

**Ejemplo** (NETA): R_medida = 2 MΩ a 40 °C → K(40 °C, aceite) = 3.95 →
`R₂₀ = 2 × 3.95 = 7.9 MΩ`.

**Ejemplo proyecto**: AT–tierra = 6.2 GΩ medidos a 35 °C → K(35°C)=2.80 →
`R₂₀ = 6.2 × 2.80 = 17.36 GΩ`. (Compárese contra el criterio en `03-…`.)

> Interpolación: para T=33 °C, entre 30 (K=1.98) y 35 (K=2.80):
> `K ≈ 1.98 + (2.80−1.98)×(33−30)/(35−30) = 1.98 + 0.82×0.6 = 2.472`.

> ⚠️ Para corregir a **40 °C** como base (no 20 °C) usar la Tabla 100.14.2.
> El tablero del proyecto corrige a 20 °C — mantener consistencia.

---

## 2) DAR — Dielectric Absorption Ratio (ensayo rápido, ~1 min)

```
DAR = R(60 s) / R(30 s)
```

No requiere corrección de temperatura (es un **cociente** de dos lecturas a la
misma temperatura → la dependencia térmica se cancela). Igual para el PI.

**Ejemplo**: R(30s)=2.0 GΩ, R(60s)=2.9 GΩ → `DAR = 2.9/2.0 = 1.45`.

---

## 3) PI — Índice de Polarización (ensayo completo, 10 min)

```
PI = R(10 min) / R(1 min)
```

**Ejemplo**: R(1min)=2.9 GΩ, R(10min)=7.0 GΩ → `PI = 7.0/2.9 = 2.41`.

> **Cuándo el PI deja de ser informativo**: si la IR a 1 min ya es **muy alta**
> (criterio análogo a IEEE 43: IR₂₀ > ~5 GΩ), el PI puede dar bajo y aun así el
> aislamiento estar sano — la corriente es tan pequeña que el ruido domina el
> cociente. En ese caso **el PI se puede desestimar** y prevalece la IR absoluta +
> FP/tan δ. Anotar siempre la IR a 1 min junto al PI. (Detalle en `04-diagnostico.md`.)

---

## 4) Regla histórica de referencia (NO normativa, solo sanity-check)

Regla del pulgar clásica: `IR_min (MΩ) ≈ kV_nominal + 1` (a 20 °C). Útil como
verificación gruesa de orden de magnitud; **no sustituye** a la Tabla 100.5 ni al
mínimo por clase de tensión. Para tx de potencia (>5000 V) la Tabla 100.5 exige
mucho más (5000 MΩ líquido), así que esta regla solo sirve para detectar lecturas
absurdamente bajas.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarIR({lecturas, T, Vprueba, claseKV, datoFabrica}) {
  const K = factorTabla100_14_oil(T);              // interpolar si hace falta
  const corr = lecturas.map(r => ({...r, R20: r.R * K}));
  const dar = lecturas.t30 && lecturas.t60 ? lecturas.t60.R / lecturas.t30.R : null;
  const pi  = lecturas.t60 && lecturas.t600 ? lecturas.t600.R / lecturas.t60.R : null;
  const minimo = criterioIR(claseKV, datoFabrica); // jerarquía: fábrica > clase > Tabla 100.5
  // veredicto por par + PI/DAR → ver 03-criterios-evaluacion.md
}
```
