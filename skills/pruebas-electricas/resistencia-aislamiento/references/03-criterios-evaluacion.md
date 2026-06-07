# 03 · Criterios de evaluación — umbrales con cita normativa

> Todos los valores corregidos a **20 °C**. Jerarquía de criterio (de mayor a menor
> precedencia): **(1) dato de fábrica/placa → (2) mínimo por clase de aislamiento →
> (3) Tabla 100.5 genérica**. NETA es explícita: el dato del fabricante manda.
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen. El caso 110 kV de abajo es el testigo de esa divergencia.

---

## A) Valor absoluto de IR — mínimos de aceptación

### A.1 — Tabla 100.5 (NETA ATS-2025) — mínimo genérico por tensión de bobina @ 20 °C

| Tensión de bobina | V prueba DC | **Líquido (MΩ)** | Seco (MΩ) |
|---|---|---|---|
| ≤ 600 V | 1,000 | 100 | 500 |
| 601–5,000 V | 2,500 | 1,000 | 5,000 |
| **> 5,000 V** | **5,000** | **5,000** | **25,000** |

→ Los tx de potencia de AFINIA caen en `>5000 V`: **mínimo 5,000 MΩ (5 GΩ) líquido**,
ensayados a 5,000 Vdc. Si el resultado corregido < 5 GΩ ⇒ **INVESTIGAR**.

### A.2 — Mínimo por CLASE DE TENSIÓN (criterio más estricto — el que usa el tablero)

El tablero del proyecto aplica un mínimo por **clase de aislamiento** más exigente
que la Tabla 100.5 (constante `NETA_IR_MIN_GOHM` en `…_schema.js`). Ejemplo
documentado del proyecto: **110 kV → 30 GΩ** (por eso 5–6 GΩ medidos se califican
como "pobre" pese a superar los 5 GΩ de la Tabla 100.5). 

> ⚠️ **Verificar la fuente exacta de estos mínimos por clase** contra la edición de
> la norma del director antes de tomarlos como definitivos (pueden venir de una
> tabla por clase de tensión de IEEE C57.152 o de la norma interna
> MO.00418.DE-GAC-AX.01). Si la edición difiere, actualizar aquí y en el schema.
> Mientras tanto: usar el mínimo por clase como criterio primario y la Tabla 100.5
> como piso absoluto.

---

## B) PI — Índice de Polarización (multi-norma)

Dos pisos normativos conviven (mostrar **ambos**, §3 multi-norma):
- **NETA ATS-2025 §7.2.2** → **PI ≥ 1.0** (mínimo absoluto; por debajo = falla).
- **IEEE C57.152** → **PI ≥ 1.5** (recomendado para condición aceptable).

> ⚠️ **Atribución correcta**: la escala fina de abajo (PI 2–4 "bueno", etc.) proviene de la
> **práctica clásica de industria (Megger/Doble)**, históricamente de **IEEE 43 — que es para
> máquinas ROTATIVAS y EXCLUYE explícitamente a los transformadores**. En tx se usa **por
> analogía**, como apoyo, NO como norma de tx. El criterio duro de tx es NETA (≥1.0) + IEEE
> C57.152 (≥1.5). Rangos de interpretación (apoyo):

| PI | Categoría | Acción |
|---|---|---|
| < 1.0 | **Peligroso** (NETA falla) | RECHAZA — no energizar |
| 1.0 – 1.5 | Cuestionable / pobre | INVESTIGAR (probable humedad) |
| 1.5 – 2.0 | Aceptable / regular | aceptar con seguimiento |
| 2.0 – 4.0 | Bueno | APRUEBA |
| > 4.0 | Excelente (seco) | APRUEBA |

> **Excepción de IR alta**: si la IR₂₀ a 1 min ya es muy alta (> ~5 GΩ), un PI bajo
> puede ser no concluyente → desestimar PI y decidir por IR absoluta + FP/tan δ.

## C) DAR — Dielectric Absorption Ratio (cuando no hay PI de 10 min)

| DAR | Categoría |
|---|---|
| < 1.25 | Cuestionable / pobre |
| 1.25 – 1.6 | Aceptable |
| > 1.6 | Bueno |

---

## D) Coherencia entre devanados y vs histórico (tendencia)

- **Entre devanados**: AT–tierra y BT–tierra deben ser del mismo orden de magnitud
  esperado por diseño; una caída marcada en uno solo señala localización del defecto.
- **Vs ensayos previos** (Tabla 100.1 nota 4 / Tabla 100.5 nota 3): una IR₂₀ que cae
  significativamente respecto al baseline histórico es señal de degradación **aunque
  siga superando el mínimo de tabla**. La tendencia pesa tanto como el valor absoluto.
- **Éster natural** (Tabla 100.5 nota 4): IR típicamente menor que en aceite mineral
  → comparar contra fábrica/previos, no penalizar contra el mínimo de aceite mineral.

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Para CADA par (AT–tierra, BT–tierra, AT–BT) evalúa TODAS las ópticas:
  IR₂₀ vs fábrica/commissioning (si existe)  → [✔/✘/—]   (precedencia 1)
  IR₂₀ vs mínimo por CLASE (MO.00418)        → [✔/✘]      (precedencia 2)
  IR₂₀ vs NETA Tabla 100.5 (piso)            → [✔/✘]      (precedencia 3)
  IR₂₀ vs histórico (tendencia)              → [estable / ↓↓ degrada]
  PI:  <1.0 RECHAZA(NETA) | 1.0–1.5 INVESTIGAR | ≥1.5 ok(C57.152)   (si IR no es altísima)
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar SIEMPRE las divergencias (ej. pasa NETA 100.5 pero falla por clase → "pobre").
```

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia de FP/tan δ + agua en aceite + DGA + DFR) antes de nombrar la causa.
