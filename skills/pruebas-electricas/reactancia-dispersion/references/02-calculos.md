# 02 · Cálculos — %Z, normalización de base y desviaciones

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Reactancia/impedancia medida por fase | X_med, Z_med | Sí | de las 3 mediciones por fase |
| Impedancia 3φ equivalente medida | Z_3φ | Sí | la lectura del modo equivalente trifásico |
| %Z de placa | %Z_placa | Sí | con su **base** (kVA, kV) — sin la base no se compara |
| Base de placa (kVA, kV) | S_b, V_b | Sí | define Z_base = V_b² / S_b |
| Corriente / tensión de inyección | I, V | Sí | validar caída 30–100 VAC @ 60 Hz (⚠️ verificar) |
| TAP de medición | — | Sí | medir y comparar SIEMPRE en el mismo TAP |
| Histórico / fase hermana | — | preferente | baseline para tendencia |

---

## 1) Cálculo del %Z medido ⭐ (llevar a la base de placa)

```
Z_base = V_b² / S_b                  (impedancia base del transformador)
%Z_medido = (Z_med / Z_base) × 100
```

- `V_b` = tensión nominal del devanado energizado; `S_b` = potencia base de placa.
- El %Z de placa SIEMPRE viene referido a una base (kVA/kV). **Comparar en la misma
  base** o normalizar primero; mezclar bases es el error #1.

**Ejemplo**: tx 20 MVA, 115 kV. `Z_base = 115000² / 20e6 = 661.25 Ω`. Si la impedancia
medida AT→BT-corto fue `Z_med = 70.0 Ω` → `%Z = 70.0/661.25 × 100 = 10.59%`. Placa
indica `%Z = 10.5%`. (Compárese en `03-…`.)

---

## 2) Desviación 3φ equivalente vs placa ⭐

```
Δ3φ (%) = ((%Z_medido_3φ − %Z_placa) / %Z_placa) × 100
```

**Ejemplo**: %Z_medido_3φ = 10.59%, %Z_placa = 10.5% →
`Δ3φ = (10.59 − 10.5)/10.5 × 100 = +0.86%`. **< 3% → APRUEBA** (criterio NETA D.10).

> ⚠️ El umbral 3% es relativo al valor de placa, no puntos absolutos de %Z.

---

## 3) Desviación por fase vs el promedio de las 3 lecturas ⭐

```
prom = (X_A + X_B + X_C) / 3
Δfase_i (%) = ((X_i − prom) / prom) × 100   para i = A, B, C
```

**Ejemplo**: lecturas por fase X_A=70.0, X_B=70.3, X_C=72.8 Ω →
`prom = 71.03 Ω`. `Δ_C = (72.8 − 71.03)/71.03 × 100 = +2.49%` (< 3%, APRUEBA por poco;
vigilar C). Si una fase superara **±3%** del promedio → INVESTIGAR (posible deformación
local que la 3φ equivalente diluye).

---

## 4) Normalización por TAP / cambio de TAP

La reactancia varía con el TAP (cambia N efectivo). Para comparar contra placa o
histórico, **usar el mismo TAP** que el del dato de referencia. Si la placa da %Z solo
en el TAP nominal, medir en nominal; documentar el TAP de cada lectura.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarReactancia({Zmed3f, ZmedFase, Zpct_placa, Vbase, Sbase, tap, hist}) {
  const Zbase = (Vbase*Vbase) / Sbase;
  const pct3f = (Zmed3f / Zbase) * 100;
  const d3f   = ((pct3f - Zpct_placa) / Zpct_placa) * 100;     // umbral 3% (NETA D.10)
  const prom  = ZmedFase.reduce((a,b)=>a+b,0) / ZmedFase.length;
  const dFase = ZmedFase.map(x => ((x - prom) / prom) * 100);  // umbral ±3% vs promedio
  // veredicto multi-norma + tendencia → ver 03-criterios-evaluacion.md
}
```
