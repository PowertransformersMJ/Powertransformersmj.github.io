# 02 · Cálculos — TDCG, tasa de generación, Rogers, Duval, Doernenburg

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| ppm de los 7 gases | H2,CH4,C2H6,C2H4,C2H2,CO,CO2 | Sí | de la muestra actual |
| Fecha de muestreo actual y previa | t, t₀ | para tasa | habilita ppm/mes (motor predictivo) |
| ppm de la muestra previa | — | para tasa | misma metodología |
| Método | — | Sí | ASTM D3612 / IEC 60567 (afecta comparabilidad) |
| Volumen de aceite | V | para mL/día | si se pide tasa volumétrica |

---

## 1) TDCG — Total Dissolved Combustible Gas (apoyo)

```
TDCG = H2 + CH4 + C2H6 + C2H4 + C2H2 + CO     (NO incluye CO2)
```

**Ejemplo**: H2=60, CH4=40, C2H6=30, C2H4=50, C2H2=2, CO=350 → TDCG = 532 ppm.

> ⚠️ IEEE C57.104-**2019 retiró el TDCG como criterio primario** (pasó a gas-by-gas
> por percentiles). El TDCG se mantiene como **indicador de apoyo / tendencia**, no
> como veredicto. La edición **2008** sí lo usaba con 4 condiciones (Condition 1–4).

---

## 2) Tasa de generación ⭐ (el motor predictivo)

```
Tasa_gas (ppm/mes) = (ppm_actual − ppm_previo) / Δmeses
```

**Ejemplo**: C2H4 pasó de 20 ppm (1-ene) a 80 ppm (1-abr) → Δ=60 ppm en 3 meses →
**20 ppm/mes**. Una generación así de C2H4 (gas térmico de alta T) sostenida es
señal de **falla térmica activa**, aun si el nivel absoluto no fuera Status 3.

> IEEE C57.104-2019 publica tasas de generación de referencia por gas y por percentil.
> ⚠️ **Verificar los valores exactos** contra la edición de norma del director.

---

## 3) Relaciones de Rogers (4 ratios → código → falla)

Ratios usados (versión de 3 ratios, la más común): **R1=CH4/H2 · R2=C2H2/C2H4 ·
R5=C2H4/C2H6**. Se codifican y se buscan en tabla. Diagnósticos típicos:

| Diagnóstico | CH4/H2 | C2H2/C2H4 | C2H4/C2H6 |
|---|---|---|---|
| Normal / sin falla | 0.1–1 | <0.1 | <1 |
| Descarga parcial (PD, baja energía) | <0.1 | <0.1 | <1 |
| Térmico < 300 °C | 0.1–1 | <0.1 | 1–3 |
| Térmico 300–700 °C | >1 | <0.1 | 1–3 |
| Térmico > 700 °C | >1 | <0.1 | >3 |
| Arco (descarga alta energía) | 0.1–1 | 0.6–2.5 | >2 |

**Ejemplo**: CH4/H2=1.3, C2H2/C2H4=0.05, C2H4/C2H6=4.0 → R1>1, R2<0.1, R5>3 →
**falla térmica > 700 °C** (punto caliente severo). ⚠️ Cortes de los rangos —
**verificar** contra IEC 60599 / IEEE C57.104 (las ediciones difieren ligeramente).

## 4) Doernenburg (requiere gases > umbrales mínimos primero)

Ratios: **R1=CH4/H2 · R2=C2H2/C2H4 · R3=C2H2/CH4 · R4=C2H6/C2H2**. Válido SOLO si
los gases superan ~2× los límites de detección. Diagnóstico (valores de búsqueda web):

| Falla | R1 (CH4/H2) | R2 (C2H2/C2H4) | R3 (C2H2/CH4) | R4 (C2H6/C2H2) |
|---|---|---|---|---|
| Descomposición térmica | >1.0 | <0.75 | <0.3 | >0.4 |
| Corona / PD | <0.1 | — | <0.3 | >0.4 |
| Arco | 0.1–1.0 | >0.75 | >0.3 | <0.4 |

⚠️ **Verificar** los umbrales mínimos de aplicabilidad y los cortes contra IEEE C57.104.

## 5) Triángulo de Duval (gráfico, robusto)

Usa solo 3 gases: **CH4, C2H4, C2H2**. Se calcula el % de cada uno sobre la suma y
se ubica el punto en el triángulo, que tiene 7 zonas:

```
%CH4 = 100·CH4/(CH4+C2H4+C2H2)   ; análogo %C2H4 y %C2H2   (suman 100)
```

**Ejemplo**: CH4=40, C2H4=50, C2H2=2 → suma=92 → %CH4=43, %C2H4=54, %C2H2=2 →
punto en zona **T2/T3** (térmico de alta T, sin acetileno significativo → no es arco).

Zonas (Duval Triángulo 1): **PD** (descarga parcial), **D1** (descarga baja energía),
**D2** (descarga alta energía/arco), **T1** (térmico <300 °C), **T2** (300–700 °C),
**T3** (>700 °C), **DT** (térmico+eléctrico mixto). Triángulos 4 y 5 refinan PD/T1/T2/T3;
NO usarlos para fallas eléctricas D1/D2 (regla de Duval).

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarDGA({gases, gasesPrev, dias}) {
  const tdcg  = gases.H2+gases.CH4+gases.C2H6+gases.C2H4+gases.C2H2+gases.CO;
  const tasa  = ratesPorGas(gases, gasesPrev, dias);          // ppm/mes
  const status= ieeeC57104_2019_status(gases);                // 1/2/3 gas-by-gas
  const duval = duvalTriangulo1(gases.CH4, gases.C2H4, gases.C2H2);
  const rogers= rogersCodigo(gases);                          // si gases > mínimos
  // peor óptica + tipo de falla → ver 03 y 04
}
```
