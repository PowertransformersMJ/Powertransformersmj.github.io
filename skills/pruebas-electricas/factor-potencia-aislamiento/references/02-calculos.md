# 02 · Cálculos — FP/tan δ, corrección de temperatura, tip-up

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Lectura de FP/tan δ por modo | FP_medido | Sí | %FP directo, o derivar de I + pérdidas |
| Corriente de carga (si no hay %FP) | I_c | alternativa | mA, por modo |
| Pérdidas dieléctricas (si no hay %FP) | W | alternativa | mW o W, por modo |
| Tensión de prueba | V_prueba | Sí | kV (típ. 10 kV o ≤125 % de operación) |
| Temperatura del aislamiento | T | Sí | °C al ensayo (top-oil ≈ aislamiento si estabilizado) |
| Factor de corrección del fabricante | K_T | preferente | ⚠️ IEEE C57.12.90 quitó el genérico en 2010 |
| Tipo de líquido | — | Sí | mineral (≤0.5 %) vs éster natural (≤1.0 %), Tabla 100.3 |
| Dato de fábrica / commissioning | — | preferente | tiene precedencia sobre tablas |

---

## 1) FP/tan δ desde corriente y pérdidas (si el equipo no da %FP directo)

```
FP (%) = (W / (V_prueba × I_total)) × 100        // pérdidas / potencia aparente
tan δ  = I_resistiva / I_capacitiva ≈ FP          // para FP pequeño, FP ≈ tan δ
```

**Ejemplo**: V=10 kV, I_total=10 mA → S = 10 000 × 0.010 = 100 VA; pérdidas W=0.45 W →
`FP = 0.45 / 100 × 100 = 0.45 %`. (Compárese contra Tabla 100.3 en `03-…`.)

> La mayoría de equipos Doble/DELTA reportan el %FP (o %DF) ya calculado + la corriente
> de carga (en mA, indicador de la capacitancia) y las pérdidas (mW). Conservar los tres.

---

## 2) Corrección de temperatura a 20 °C ⭐ (hacer SIEMPRE antes de comparar)

```
FP₂₀ = FP_medido × K_T
```

- `K_T` = factor de corrección. **Preferente: el del fabricante del transformador** (IEEE
  C57.12.90 retiró la tabla genérica en su edición 2010 por la variación de materiales).
- Si NO hay factor del fabricante: usar la curva genérica histórica documentada (los
  equipos Doble traen tablas internas). ⚠️ **verificar** qué tabla usa el director.

**Ejemplo** (factor genérico ilustrativo): FP_medido = 0.62 % a 35 °C, K_T(35 °C) ≈ 0.65 →
`FP₂₀ = 0.62 × 0.65 = 0.40 %` → pasaría el 0.5 % de la Tabla 100.3.

> ⚠️ Los factores genéricos varían entre fuentes (Doble vs IEEE-2006); el valor 0.65 es
> ilustrativo. **No usar un factor genérico si el fabricante dio el suyo.** Anotar siempre
> qué factor se aplicó y su fuente.

---

## 3) Tip-up — dependencia del FP con la tensión

```
ΔFP = FP(V_alta) − FP(V_baja)        // ambas a la misma temperatura → sin corrección
```

No requiere corrección de temperatura (es una **diferencia** a igual T). 

**Ejemplo**: FP@2 kV = 0.41 %, FP@10 kV = 0.55 % → `ΔFP = 0.55 − 0.41 = +0.14 %` →
**tip-up positivo** = posible ionización en voids → INVESTIGAR. (⚠️ umbral exacto a
verificar; la práctica usa ΔFP > ~0.1 % como señal.)

---

## 4) Capacitancia (subproducto útil para tendencia)

```
C = I_c / (2π · f · V_prueba)         // f = 60 Hz
```

La capacitancia del modo debe ser **estable** vs histórico. Un cambio marcado de C señala
alteración geométrica del aislamiento (no condena por sí solo, pero alimenta la tendencia).

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarFP({lecturas, T, Vprueba, liquido, K_fabricante, datoFabrica}) {
  const KT = K_fabricante ?? factorGenericoFP(T);     // preferir fabricante
  const corr = lecturas.map(m => ({
    ...m,
    FP: m.FP ?? (m.W / (Vprueba * m.I)) * 100,         // derivar si falta
    FP20: (m.FP ?? (m.W / (Vprueba * m.I)) * 100) * KT
  }));
  const tipUp = lecturas.V2 ? lecturas.FP_V2 - lecturas.FP_V1 : null;
  const limite = liquido === 'ester' ? 1.0 : 0.5;      // Tabla 100.3
  // veredicto por modo (CH/CL/CHL) + tip-up + tendencia → ver 03-criterios-evaluacion.md
}
```
