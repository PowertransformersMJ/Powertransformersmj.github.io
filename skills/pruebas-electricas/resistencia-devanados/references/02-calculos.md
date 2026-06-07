# 02 · Cálculos — corrección de temperatura y desbalance entre fases

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Resistencia medida por fase y TAP | Rm | Sí | en mΩ, método Kelvin/4 hilos |
| Temperatura del devanado al medir | Tm | Sí | °C del devanado (no la ambiente), estabilizado |
| Temperatura de referencia objetivo | Ts | Sí | a la que se corrige (p.ej. 75 °C o la de fábrica) |
| Material del devanado | — | Sí | cobre (Tk=234.5) / aluminio (Tk=225) |
| Corriente de prueba DC | I | Sí | validar ≤ 10% In (IEEE C57.152) |
| Dato de fábrica / previos | — | preferente | base de comparación (a la misma Ts) |

---

## 1) Corrección de temperatura ⭐ (hacer SIEMPRE primero)

```
Rs = Rm × (Ts + Tk) / (Tm + Tk)
```

- `Rs` = resistencia corregida a la temperatura de referencia `Ts`.
- `Rm` = resistencia medida a la temperatura del devanado `Tm`.
- `Tk` = **constante de temperatura del material**: **234.5 °C (cobre)**, **225 °C (aluminio)**,
  ~230 °C (aluminio aleado).

**Ejemplo (cobre, corregir 25 °C → 75 °C)**: Rm = 250.0 mΩ a Tm = 25 °C →
`Rs = 250.0 × (75 + 234.5) / (25 + 234.5) = 250.0 × 309.5 / 259.5 = 298.2 mΩ`.

**Ejemplo (comparar a la T de fábrica)**: fábrica reporta R a 20 °C; medida en campo Rm = 252 mΩ
a Tm = 32 °C (cobre) → corregir a Ts = 20 °C:
`Rs = 252 × (20+234.5)/(32+234.5) = 252 × 254.5/266.5 = 240.6 mΩ` → comparar contra fábrica.

> ⚠️ **Comparar SIEMPRE a la misma temperatura de referencia.** El criterio NETA (≤2%) solo
> tiene sentido con todas las resistencias corregidas a la misma `Ts`.

---

## 2) Desbalance entre fases ⭐ (criterio núcleo)

Para las 3 fases del mismo devanado y TAP (ya corregidas a Ts):

```
desbalance (%) = (Rs_max − Rs_min) / Rs_promedio × 100
```

**Ejemplo**: Rs_A = 298.2, Rs_B = 299.0, Rs_C = 297.5 mΩ →
`promedio = 298.2; desbalance = (299.0−297.5)/298.2 ×100 = 0.50%` → **dentro de ≤2% (APRUEBA)**.

**Ejemplo de falla**: Rs_A = 298.2, Rs_B = 312.5, Rs_C = 297.5 →
`desbalance = (312.5−297.5)/302.7 ×100 = 4.96%` → **excede 2%** → INVESTIGAR fase B (mala
conexión o contacto); cruzar con termografía / TTR.

> ⚠️ **Criterio de desbalance**: NETA ATS-2025 §7.2.2 fija comparar dentro de **2%** vs fábrica
> o **entre fases adyacentes**. La práctica de industria a veces cita 2–3% — usar el **≤2% de
> NETA** como piso y marcar "⚠️ verificar contra la edición de norma del director" si MO.00418
> fija otro valor por clase.

---

## 3) Desviación vs fábrica / previos (tendencia)

```
%desv_vs_fábrica = (Rs_actual − Rs_fábrica) / Rs_fábrica × 100   (ambas a la misma Ts)
```

Una desviación >2% vs el baseline de fábrica/commissioning señala degradación de una conexión,
aunque el desbalance entre fases aún parezca aceptable (IEEE C57.152: tendencia).

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarRdevanados({Rm, Tm, Ts, material, fabrica}) {
  const Tk = material === 'aluminio' ? 225 : 234.5;            // §1
  const Rs = Rm.map(r => r.val * (Ts + Tk) / (r.Tm + Tk));     // corrección a Ts
  const desbalance = (Math.max(...Rs) - Math.min(...Rs)) / promedio(Rs) * 100; // §2
  const desvFab = fabrica ? (Rs - fabrica)/fabrica*100 : null; // §3
  // veredicto: desbalance >2% O desv vs fábrica >2% → INVESTIGAR (cruzar termografía/TTR/LTC)
}
```
