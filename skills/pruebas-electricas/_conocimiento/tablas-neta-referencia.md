# 📊 Tablas NETA ATS-2025 — datos crudos relevantes a transformadores

> Transcripción literal de las tablas de ANSI/NETA ATS-2025 que rigen los criterios
> de las skills de esta carpeta. **Fuente única de verdad** para los umbrales: si un
> número aparece en una skill, debe coincidir con esta neurona. Citar siempre la
> tabla + edición (ATS-2025).

---

## Tabla 100.1 — Insulation Resistance Test Values (equipos NO máquinas rotativas)

Valores genéricos (Megohms @ 20 °C). Para transformadores prevalece la **100.5**.

| Tensión nominal del equipo (V) | Voltaje de prueba DC (V) | IR mínima recomendada (MΩ @ 20 °C) |
|---|---|---|
| 250 | 500 | 25 |
| 600 | 1,000 | 100 |
| 1,000 | 1,000 | 100 |
| 2,500 | 1,000 | 500 |
| 5,000 | 2,500 | 1,500 |
| 8,000 | 2,500 | 2,500 |
| 15,000 | 2,500 | 5,000 |
| 25,000 | 5,000 | 10,000 |
| 34,500 | 5,000 | 100,000 |
| 46,000 y superior | 5,000 | 100,000 |

Notas: corrección de temperatura → Tabla 100.14. Los datos de IR sirven para
**tendencia** (desviaciones vs baseline permiten evaluar el aislamiento).

---

## Tabla 100.5 — Transformer Insulation Resistance Acceptance Testing ⭐

(IR mínima recomendada, Megohms **@ 20 °C**). Esta es la tabla específica de tx.

| Tipo por tensión de bobina (V) | Voltaje de prueba DC (V) | Líquido (MΩ) | Seco (MΩ) |
|---|---|---|---|
| 600 y menos | 1,000 | 100 | 500 |
| 601 – 5,000 | 2,500 | 1,000 | 5,000 |
| **Mayor a 5,000** | **5,000** | **5,000** | **25,000** |

Notas: (2) corrección de temp → Tabla 100.14. (3) la IR depende de la tensión (kV)
y la capacidad (kVA); comparar con dato de fábrica. (4) los tx con éster natural
suelen tener IR menor que con aceite mineral → comparar vs fábrica/previos.

---

## Tabla 100.3 — FP/tan δ recomendado @ 20 °C, tx/reguladores/reactores en líquido ⭐

| | Aceite mineral (máx.) | Éster natural (máx.) |
|---|---|---|
| Transformadores de potencia, reguladores y reactores | **0.5 %** | **1.0 %** |

Notas: (1) valores representativos sugeridos por NETA en ausencia de norma de
consenso. (2) FP de tx de distribución: comparar vs resultados previos.

---

## Tabla 100.4 — Insulating Fluid Limits

### 100.4.1 — Aceite mineral NUEVO recibido en equipo nuevo (por clase de tensión)

| Ensayo | ASTM | ≤69 kV | >69 – <230 kV | ≥230 kV |
|---|---|---|---|---|
| Rigidez dieléctrica, kV mín @ gap 1 mm (0.04") | D1816 | 25 | 30 | 35 |
| Rigidez dieléctrica, kV mín @ gap 2 mm (0.08") | D1816 | 45 | 55 | 60 |
| Tensión interfacial mN/m mín | D971 | 38 | 38 | 38 |
| Número de neutralización mg KOH/g máx | D974 | 0.03 | 0.03 | 0.03 |
| Agua, ppm máx | D1533 | 20 | 10 | 10 |
| FP @ 25 °C, % máx | D924 | 0.05 | 0.05 | 0.05 |
| FP @ 100 °C, % máx | D924 | 0.40 | 0.40 | 0.5 |
| Color | D1500 | 0.5 | 0.5 | 0.5 |
| Condición visual | D1524 | bright & clear | bright & clear | bright & clear |

(Ref. IEEE C57.106-2015, Tabla 2.)

### 100.4.2 — Líquido silicónico nuevo en tx nuevos
Rigidez D1816 ≥30 kV · visual D2129 claro sin partículas · agua D1533 ≤50 ppm ·
FP/DF @25 °C D924 ≤0.01% · viscosidad D445 47.5–52.5 cSt · fire point D92 ≥340 °C ·
neutralización D974 ≤0.01 mg KOH/g. (IEEE C57.111-1989 R2009, Tabla 2.)

### 100.4.3 — Hidrocarburo menos inflamable (HMWH)
Rigidez D1816 @0.08": ≥40 (≤34.5 kV) / ≥50 (>34.5 kV) / 60 deseable · acidez D974
≤0.03 · FP D924 ≤0.1% (25°C) / ≤1% (100°C) · agua D1533B ≤25 ppm · flash D92 ≥275 °C
· fire D92 ≥300 °C · IFT D971 ≥38 · viscosidad D445 100–130 cSt @40°C · color D1500 ≤L2.5.

---

## Tabla 100.14 — Insulation Resistance Conversion Factors (corrección de temperatura) ⭐

**Fórmula: R₂₀ = R_medida × K** (corrige IR a 20 °C). Para tx en aceite usar la
columna **"Immersed Oil Insulation"**. (El coeficiente halviza la IR cada 10 °C en
aceite, cada 15 °C en aislamiento sólido.)

| Temp (°C) | K — Oil-immersed (→20 °C) | K — Solid insulation (→20 °C) |
|---|---|---|
| -10 | 0.125 | 0.25 |
| -5 | 0.180 | 0.32 |
| 0 | 0.25 | 0.40 |
| 5 | 0.36 | 0.50 |
| 10 | 0.50 | 0.63 |
| 15 | 0.75 | 0.81 |
| **20** | **1.00** | **1.00** |
| 25 | 1.40 | 1.25 |
| 30 | 1.98 | 1.58 |
| 35 | 2.80 | 2.00 |
| 40 | 3.95 | 2.50 |
| 45 | 5.60 | 3.15 |
| 50 | 7.85 | 3.98 |
| 55 | 11.20 | 5.00 |
| 60 | 15.85 | 6.30 |
| 65 | 22.40 | 7.90 |
| 70 | 31.75 | 10.00 |
| 75 | 44.70 | 12.60 |
| 80 | 63.50 | 15.80 |
| 85 | 89.789 | 20.00 |
| 90 | 127.00 | 25.20 |
| 95 | 180.00 | 31.60 |
| 100 | 245.00 | 40.00 |
| 105 | 359.15 | 50.40 |
| 110 | 509.00 | 63.20 |

> Existe la 100.14.2 (corrección a **40 °C**) si la base de comparación es 40 °C.
> Ejemplo NETA: 2 MΩ medidos @ 40 °C (104 °F), K=3.95 → R₂₀ = 2 × 3.95 = **7.9 MΩ @ 20 °C**.

---

## Otras tablas de tx (referencia rápida, transcribir on-demand al construir su skill)
- **100.12** — pares de apriete de conexiones apernadas (Nm/lb-ft por material).
- **100.13** — ensayos de gas SF₆ (no aplica a tx en aceite).
- **100.18** — incremento de temperatura sugerido en termografía.
