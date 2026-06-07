# 🔋 Batería NETA §7.2.2 — Transformers, Liquid-Filled (transformador de potencia en aceite)

> **Neurona maestra / backbone.** Transcribe fielmente la batería de pruebas y los
> criterios de aceptación de **ANSI/NETA ATS-2025 §7.2.2** para transformadores
> sumergidos en líquido (el caso de los tx de potencia de AFINIA). Toda skill de
> esta carpeta deriva de aquí. Las tablas citadas (100.x) están en
> `tablas-neta-referencia.md`.
>
> **Estructura NETA de cada equipo** (4 bloques): A) Inspección visual y mecánica ·
> B) Pruebas eléctricas · C) Valores esperados visual/mecánica · D) **Valores
> esperados eléctricos** (los criterios que rigen el diagnóstico). `*` = prueba
> opcional en NETA.

---

## B — Pruebas eléctricas (lo que se ejecuta)

| # | Prueba | Skill | Nota NETA |
|---|---|---|---|
| 1 | Resistencia de conexiones apernadas (micro-ohmímetro) | (conexiones) | low-resistance ohmmeter |
| 2 | **Resistencia de aislamiento** dev-dev y dev-tierra + **DAR/PI** | `resistencia-aislamiento` | Tabla 100.5 si no hay dato de fábrica |
| 3 | **Relación de transformación (TTR)**, todos los TAPs | `relacion-transformacion` | en todas las posiciones |
| 4 | **FP / tan δ** de aislamiento, todos los devanados | `factor-potencia-aislamiento` | según fabricante del equipo de prueba |
| 5 | **FP / tan δ de bujes** (o hot-collar si no hay tap capacitivo) | `factor-potencia-bujes` | |
| 6 | **Corriente de excitación** | `corriente-excitacion` | |
| 7 | `*`**SFRA** (respuesta en frecuencia de barrido) | `sfra` | opcional |
| 8 | **Resistencia de devanados** (cada TAP) | `resistencia-devanados` | I prueba ≤ 10% In (IEEE C57.152) |
| 9 | `*`**Resistencia dinámica** del cambiador de tomas (LTC) | `cambiador-tomas-ltc` | opcional |
| 10 | `*`**Reactancia de dispersión** (3φ equivalente + por fase) | `reactancia-dispersion` | opcional |
| 11 | `*`**Resistencia de aislamiento del núcleo** @ 500 Vdc | `resistencia-aislamiento-nucleo` | si la pletina de tierra es accesible |
| 12 | `*`% de **oxígeno** en el colchón de gas | `analisis-aceite` | opcional |
| 13 | `*`**DFR** (respuesta dieléctrica en frecuencia) | `dfr-respuesta-dielectrica` | opcional |
| 14 | Muestra de **líquido aislante** (ASTM D923) → batería físico-química | `analisis-aceite` | ver desglose abajo |
| 15 | **DGA** (análisis de gases disueltos) | `dga` | IEEE C57.104 / ASTM D3612 |
| 16 | Transformadores de instrumento | (§7.10) | |
| 17 | Pararrayos / DPS | (§7.19) | |
| 18 | Dispositivo de impedancia de puesta a tierra del neutro | (neutro) | |
| 19 | Calefactores (heaters) | — | operativos |

**Desglose del aceite (B.14)** — muestra ASTM D923, ensayar:
rigidez dieléctrica **ASTM D1816** · número de acidez/neutralización **D974** ·
gravedad específica **D1298** · tensión interfacial (IFT) **D971** · color **D1500** ·
condición visual **D1524** · agua **D1533** · FP/tan δ **D924**.

---

## D — Valores esperados eléctricos (CRITERIOS DE ACEPTACIÓN — el corazón del diagnóstico)

> Regla transversal NETA: *"en ausencia de dato del fabricante, usar la Tabla…"*.
> El **dato de placa/fábrica SIEMPRE tiene precedencia** sobre la tabla genérica.

| # | Criterio NETA §7.2.2.D | Umbral | Fuente |
|---|---|---|---|
| 1 | Resistencia de conexión apernada | investigar si **>50%** del valor menor de conexiones similares | D.1 |
| 2 | Resistencia de aislamiento mínima | ver **Tabla 100.5**; **PI ≥ 1.0** | D.2 |
| 3 | Relación de transformación (TTR) | desviación **≤ ½% (0.5%)** vs ratio calculado o bobinas adyacentes | D.3 |
| 4 | FP/tan δ máximo (corregido a 20 °C) | ver **Tabla 100.3** (aceite mineral **0.5%**, éster natural **1.0%**); distribución: comparar vs previos | D.4 |
| 5 | FP de bujes | investigar si varía **>50%** vs placa; capacitancia **>5%** vs placa; hot-collar **>0.1 W** | D.5 |
| 6 | Corriente de excitación | patrón núcleo 3 columnas = **2 lecturas similares + 1 menor** | D.6 |
| 7 | SFRA | comparar vs fábrica y previos | D.7 |
| 8 | Resistencia de devanados (corregida a temp.) | comparar dentro de **2%** vs previos o entre fases adyacentes | D.8 |
| 9 | Resistencia dinámica (LTC) | comparar vs previos | D.9 |
| 10 | Reactancia de dispersión | 3φ equivalente: investigar si **>3%** vs placa; por fase: no desviar **>3%** del promedio de las 3 lecturas | D.10 |
| 11 | Resistencia de aislamiento del núcleo | comparable a fábrica, **≥ 500 MΩ @ 500 Vdc** | D.11 |
| 12 | Oxígeno en colchón de N₂ | investigar su presencia | D.12 |
| 13 | DFR | comparar vs previos + límites de humedad publicados del aislamiento sólido | D.13 |
| 14 | Líquido aislante | conforme a **Tabla 100.4** | D.14 |
| 15 | DGA | evaluar conforme a **IEEE C57.104** | D.15 |

---

## ⚠️ Notas de aplicación al proyecto

- **Clase de tensión**: los tx de AFINIA son de potencia (alta tensión). Para IR usar
  la fila `>5000 V` de Tabla 100.5 (líquido → **5000 MΩ** mínimo, ensayo @ 5000 Vdc).
  Para el mínimo por **clase de aislamiento** (criterio más estricto que ya usa el
  tablero, p.ej. 110 kV → 30 GΩ) ver discusión en `resistencia-aislamiento`.
- **Corrección de temperatura**: IR y FP/tan δ DEBEN corregirse (IR→20 °C vía Tabla
  100.14; FP→20 °C). Sin corrección, los criterios no aplican.
- **Interpretación conjunta** (IEEE C57.152): ningún resultado se diagnostica aislado.
  IR baja + FP alta + DGA con gases → moja/contaminación; corroborar entre pruebas.
- **Dry-Type (§7.2.1.2)** añade matices: FP típico CHL tx de potencia ≤2.0%,
  distribución ≤5.0%; tip-up >1.0% investigar; núcleo ≥1 MΩ @500Vdc; AC withstand
  ≤75% del voltaje de fábrica (IEEE C57.12.91).
