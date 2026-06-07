# 02 · Cálculos — FP de buje, ΔC1/ΔFP vs placa, corrección de temperatura

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| FP/tan δ de C1 (y C2 si hay tap) | FP | Sí | %FP por aislamiento |
| Capacitancia medida C1 (y C2) | C_med | Sí | en pF |
| **Valor de placa del buje**: FP y C1 de fábrica | FP_placa, C1_placa | Sí ⭐ | criterio rey; grabado en el buje |
| Temperatura | T | Sí | °C al ensayo |
| Factor de corrección del fabricante | K_T | preferente | curva del buje; ⚠️ verificar |
| Tipo de buje | — | Sí | OIP / RIP / RBP / sólido (define método) |
| Pérdidas hot-collar (si no hay tap) | W_HC | alternativa | W por sección |
| Histórico (commissioning + previos) | — | preferente | para tendencia |

---

## 1) FP/tan δ y corrección a 20 °C

```
FP₂₀ = FP_medido × K_T
```

`K_T` del fabricante del buje (preferente). La **capacitancia** apenas depende de T → se
compara casi directa contra placa. ⚠️ verificar la curva de corrección usada.

**Ejemplo**: FP_medido(C1) = 0.55 % a 30 °C, K_T(30 °C) ≈ 0.75 → `FP₂₀ = 0.55 × 0.75 = 0.41 %`.
Buje típico de fábrica: FP placa 0.2–0.4 % → 0.41 % ya es deriva → vigilar.

---

## 2) Desviación vs PLACA — el cálculo que manda ⭐

```
ΔC1 (%) = (C1_medida − C1_placa) / C1_placa × 100        ← INDICADOR CRÍTICO
ΔFP (%) = (FP₂₀_medido − FP_placa) / FP_placa × 100       ← variación relativa NETA D.5
```

> NETA §7.2.2.D.5 está redactada en **variación relativa vs placa**: investigar si el FP
> varía **>50 %** del valor de placa; investigar si la **capacitancia varía >5 %** del de placa.

**Ejemplo ΔC1**: C1_placa = 350 pF, C1_medida = 378 pF →
`ΔC1 = (378 − 350)/350 × 100 = +8.0 %` → supera 5 % ⇒ **INVESTIGAR** (posible capa en corto);
si llegara a >10 % ⇒ **CRÍTICO / riesgo de explosión** (sacar de servicio).

**Ejemplo ΔFP**: FP_placa = 0.30 %, FP₂₀ = 0.50 % →
`ΔFP = (0.50 − 0.30)/0.30 × 100 = +66.7 %` → supera 50 % ⇒ **INVESTIGAR**.

> ⚠️ La banda de capacitancia **5–10 % = investigar / >10 % = crítico** proviene de la
> práctica de industria (Megger/Doble); NETA fija el disparador en **>5 %**. Verificar el
> umbral fino contra la edición de norma del director.

---

## 3) Hot-collar (bujes sin tap)

```
Criterio NETA: pérdidas por sección ≤ 0.1 W (100 mW)
```

Si las pérdidas de una sección **exceden 0.1 W** o difieren mucho entre secciones del mismo
buje ⇒ **INVESTIGAR** (humedad/fisura/bajo nivel de aceite localizado). Comparar secciones
homólogas entre fases.

---

## 4) Factor de potencia desde corriente y pérdidas (si el equipo no da %FP directo)

```
FP (%) = (W / (V_prueba × I_carga)) × 100
C (pF) = I_carga / (2π · f · V_prueba) · 1e12     (f = 60 Hz)
```

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarBuje({C1_med, C1_placa, FP_med, FP_placa, C2_med, FP_C2, T, K_T, W_HC}) {
  const FP20 = FP_med * (K_T ?? factorGenericoFP(T));
  const dC1  = (C1_med - C1_placa) / C1_placa * 100;     // INDICADOR CRÍTICO
  const dFP  = (FP20 - FP_placa) / FP_placa * 100;       // variación relativa NETA D.5
  const flagExplosion = Math.abs(dC1) > 10;              // ⚠️ umbral a verificar
  const investigar = Math.abs(dC1) > 5 || dFP > 50 || (W_HC ?? 0) > 0.1;
  // veredicto por buje (C1/C2/hot-collar) + tendencia → ver 03-criterios-evaluacion.md
}
```
