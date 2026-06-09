# 🏭 50 — TRANSFORMADORES DE POTENCIA (lóbulo de dominio · equipo)

> Lóbulo registrado en `40-LOBULOS-DOMINIO`. Disparador: Trigger 🔵 §G.2 con
> "tipo de transformador", "bidevanado / tridevanado / autotransformador",
> "devanado de compensación / estabilización / terciario", "buried delta",
> "grupo vectorial", "cálculos nominales / relación / impedancia del equipo".
> Hogar de las skills `skills/transformadores-potencia/*`.
>
> **Frontera con el lóbulo `49-PRUEBAS-ELECTRICAS`**: 49 = los **ENSAYOS** (cómo se
> mide y se diagnostica). 50 = el **EQUIPO** (qué es, de qué tipo, qué cálculos
> nominales y de placa le aplican). Se cruzan, no se duplican: la tipificación (50)
> define el alcance del plan de pruebas (49).

---

## Origen (pedido del director, 2026-06-07)

Crear una familia de skills sobre **conceptos, criterios y particularidades de
transformadores de potencia** para (1) mejorar los **cálculos matemáticos** y (2) la
**identificación del tipo** (bidevanado / bi+compensación / tridevanado / auto).
Construidas con `skill-creator`. El director irá **alimentando más documentos**; los
adjuntos son una BASE, no el límite — se amplía con investigación web (norma IEEE/IEC).

**Fuentes ingeridas:**
- ✅ **ABB Transformer Service Handbook** (V4 rev3) — diseño/construcción (§1), riesgo de
  falla (§2), diagnóstico (§3, incl. 3.2.7.1 dos devanados / 3.2.7.2 tres devanados).
- ✅ **Investigación web** (subagente, citada): IEEE C57.158 (terciarios/estabilización),
  C57.12.00/.90/.70 (placa/impedancia/desfase), IEC 60076-1.
- ✅ **EG — Ernesto Gallo Martínez, "Diagnóstico y Mantenimiento a Transformadores en Campo",
  3ª ed. 2021** (Transequipos S.A., ISBN 978-958-49-1908-3, 266 págs). El director lo entregó
  **comprimido a 39.2 MB** (2026-06-08), ya ingerible. Fuente colombiana de campo, alineada con
  IEEE/IEC/CIGRÉ. **Cap. 6 leído** (protecciones + refrigeración) → ya plasmado en el marco
  `_conocimiento/00-fundamentos-transformador.md §E`. Mapa de capítulos abajo.

### Mapa de capítulos EG → a qué lóbulo alimenta (para lecturas dirigidas futuras)
| Cap. EG | Tema | Alimenta |
|---|---|---|
| 1 | Aceite aislante (química, degradación, lodos, fluidos alt.) | **49** (`analisis-aceite`) |
| 2 | Papel aislante (celulosa, vida útil, **cargabilidad/punto caliente IEEE C57.91**, sobrecarga) | **50** (`gestion-vida-activo`) + 49 |
| 3 | Diagnóstico de laboratorio (ASTM/IEC/IEEE, **códigos de acción Transequipos**, azufre corrosivo, **DGA IEEE C57.104-2019**, furánicos, metales) | **49** (`dga`, `analisis-aceite`) |
| 4 | Diagnóstico de campo (PEC, IV, **SFRA**, **FDS/DFR**, emisiones acústicas, termografía, coronografía, monitoreo en línea) | **49** (sfra, dfr, etc.) |
| 5 | Mantenimiento en campo (secado/vacío, humedad, **gestión de confiabilidad y vida útil**, formulaciones frío/caliente) | **50** (`gestion-vida-activo`) |
| 6 ✅ | **Protecciones** (físicas/eléctricas) + **tipos de refrigeración (notación IEEE)** | **50** (`sistema-refrigeracion`, `bujes-y-accesorios`) — **leído** |

> ⚠️ **Frontera de dominio (memoria `feedback_no_fabricar_datos_dominio`)**: Caps 1/3/4 de EG son
> **aceite/papel/DGA/ensayos** → territorio del lóbulo **49** (no inventar datos de aceite en el
> tablero de pruebas ELÉCTRICAS). El EQUIPO (lóbulo 50) toma de EG sobre todo Caps 2/5/6.
> Lecturas dirigidas pendientes: **Cap 2.4.5/2.4.6** (cargabilidad/punto caliente/sobrecarga,
> IEEE C57.91) para `gestion-vida-activo`.

---

## Arquitectura propuesta (11 skills · PENDIENTE validación del director)

Mismo patrón probado en `pruebas-electricas`: scaffold → **validar con el director** →
replicar. **Familia COMPLETA (11/11)** — el director aprobó replicar el 2026-06-08 ("apruebo
todo para proceder con la culminación"). Cada skill = `SKILL.md` + 4 neuronas.

**Grupo A — Identificación y cálculos (núcleo del pedido):**
- ✅ `identificacion-tipo-transformador` — **EJEMPLAR COMPLETA** (4 neuronas).
- ✅ `grupo-vectorial-conexiones` — Dyn/YNd/YNyn0d, desfase horario, ANSI↔IEC, polaridad, paralelo.
- ✅ `calculos-nominales` — I nominal, potencias por etapa de enfriamiento, relación √3, V/espira.
- ✅ `impedancia-cortocircuito` — Z de par → estrella equivalente (3 ramas), base común, secuencia cero, I_cc, reparto.
- ✅ `placa-caracteristica` — leer/auditar la placa, coherencias cruzadas, identidad por informe.
- ✅ `regulacion-tomas` — OLTC/DETC (seguridad), rango ±%, escalones, efecto en %Z, DRM.
- ✅ `sistema-refrigeracion` — ONAN/ONAF/OFAF/ODAF, etapas, "etapa ≠ MVA gratis", I por etapa.

**Grupo B — Construcción:**
- ✅ `construccion-nucleo-devanados` — shell/core form, 3/5 columnas, tipos de devanado, fuerzas ∝I², FRA.
- ✅ `bujes-y-accesorios` — condensador OIP/RIP/RBP, C1/C2, FP de buje, tap capacitivo; conservador, Buchholz, sobrepresión, imagen térmica.

**Grupo C — Gestión:**
- ✅ `gestion-vida-activo` — papel/DP (1000-1200→150-250), hot-spot IEEE C57.91, Montsinger, cargabilidad, MTMP/condición.
- ✅ `modos-falla-diagnostico` — esfuerzos (E/T/M/Q) → deterioro → modos de falla; mapa síntoma→ensayo→lóbulo (integrador).

> Índice maestro de la familia: `skills/transformadores-potencia/README.md`.

---

## Skill ejemplar — `identificacion-tipo-transformador` (✅ completa)

Patrón: `SKILL.md` (frontmatter + workflow 6 pasos + árbol de decisión + ficha de salida)
+ 4 neuronas `references/`:
- `01-teoria.md` — los 4 tipos, por qué existe el delta de estabilización, buried vs accesible.
- `02-calculos.md` — relación √3 por par, Z de 3 ramas (estrella equiv.), base común, secuencia cero.
- `03-criterios-evaluacion.md` — discriminar desde placa/bornes/grupo (multi-norma + sanity check).
- `04-diagnostico.md` — implicaciones de protección de tierra, qué ensayos cambian, errores típicos.

**3 marcos compartidos** en `skills/transformadores-potencia/_conocimiento/`:
`00-fundamentos-transformador.md`, `marco-normativo-tx.md`, `convenciones-calculo.md`.

### Criterios clave fijados (consolidados de la investigación)
- **Discriminador de tipo**: tercer devanado **sin MVA de carga y/o sin bornes accesibles**
  = **estabilización** (delta terciario), NO tridevanado. Con MVA+bornes = tridevanado real.
- **Auto**: AT-BT comparten cobre (aislamiento parcial); nota `auto`/símbolo `a`; suele llevar
  terciario delta (revisar secuencia cero).
- **Relación de línea**: Yy/Dd → `a`; Dy → `a/√3`; Yd → `a·√3`. Debe coincidir con placa.
- **Z tridevanado**: `Z1=½(Z_HM+Z_HL−Z_ML)`, `Z2=½(Z_HM+Z_ML−Z_HL)`, `Z3=½(Z_HL+Z_ML−Z_HM)`,
  a **base común** primero; una rama **negativa es normal**.
- **Secuencia cero**: el delta (estabilización o terciario) **baja `Z0`** → sube falla
  monofásica a tierra → habilita 50N/51N. `Z0` muy baja en un Y-Y "sin delta" delata delta oculto.

---

## ⚠️ Valores a verificar (consolidar con el director / norma MO.00418)

- Tolerancias por edición: relación **±0.5 %**, Z **±7.5 %** (2 dev.) / **±10 %** (3+/auto) — IEEE C57.12.00.
- Rating aparente del delta de estabilización (buried) — IEEE C57.158 + paper Part I.
- Base de MVA exacta de cada `Z` de par — reporte de fábrica / C57.12.90.
- Mapeo de desfase ANSI ↔ índice horario IEC — C57.12.70.
- Criterios por **clase de tensión** del interno MO.00418 (cuando el director los entregue).

---

## Material extraído de la lectura exhaustiva (2026-06-08) — destilado, pendiente de plasmar

> Lectura completa de EG + ABB vía subagentes (el director pidió "leer todo y aportar lo mayor
> posible"). Lo de **tipificación** ya se plasmó en la skill ejemplar (ver abajo). Lo demás se
> **distila aquí** para no perderlo hasta construir su skill destino. ⚠️ Nada de esto se inventa:
> valores numéricos sin fuente pública confirmable van marcados `⚠️ verificar`.

**Ya integrado en la skill ejemplar (tipificación):**
- ABB Tabla 3-32 — **discriminación por corriente de excitación**: 3-limb → 2 altas + 1 baja
  (central); 5-limb / banco 3×1φ → 3 similares; delta cerrando lazo → 2 iguales > 1. → `03 §E.2`.
- ABB p.17 — **núcleo de 5 columnas baja `Z0`** como un delta (camino homopolar por columnas
  laterales). Refina el criterio "Z0 baja = delta oculto" para evitar falso positivo. → `03 §E.1`.
- ABB §3 — **modelo de 6 capacitancias**; el terciario buried es invisible a FP si no hay bornes.
  → `01 §B`.

**✅ Plasmado en `gestion-vida-activo` (lóbulo 50, EG Caps 2/5 · IEEE C57.91):**
- Papel/celulosa: **DP 1000–1200 nuevo → 150–250 fin de vida**; carbonización ~150 °C; el
  **punto caliente gobierna la vida** (IEEE C57.91); Montsinger ≈ **6–8 °C duplican el
  envejecimiento**. Agua: papel <2 %, aceite objetivo ~20 ppm (límite 30). → `gestion-vida-activo/references/01,02`.
- Cooling (EG cap. 6) — plasmado en `_conocimiento/00 §E` + `sistema-refrigeracion` (ONAN/ONAF/OFAF/ODAF + "etapa ≠ MVA gratis").
- Mantenimiento/secado: criterios de confiabilidad (RS%, IC frío/caliente) → `⚠️ verificar` valores exactos (sigue pendiente con el director).

**Frontera 49 (NO va al lóbulo 50): EG Caps 1/3/4 = aceite/DGA/ensayos** → lóbulo `49-PRUEBAS`:
- DGA IEEE C57.104-2019 (Status 1/2/3, NEI), triángulos de Duval, furánicos, azufre corrosivo.
- ⚠️ **Tablas [ILEGIBLES] en el scan comprimido** (NO fabricar): "Códigos de Acción de
  Mantenimiento" de Transequipos y las **Tablas 1–4 numéricas de IEEE C57.104-2019**. Relectura en
  alta resolución o tomar los valores directo de la norma IEEE C57.104-2019. Marcado `⚠️ verificar`.

---

## Pendientes / próxima ronda

1. ✅ **Director validó** la arquitectura de 11 skills (2026-06-08) + aprobó replicar.
2. ✅ **EG + ABB leídos completos** (subagentes, 2026-06-08). Tipificación en la ejemplar; papel/
   cargabilidad en `gestion-vida-activo`; aceite/DGA → lóbulo 49. **Único pendiente de lectura**:
   tablas [ILEGIBLES] (Códigos Transequipos + C57.104-2019 Tablas 1–4) en HD o directo de la norma.
3. ✅ **Familia COMPLETA (11/11)** — patrón de 4 neuronas replicado a todas (2026-06-09).
4. 🔲 Commit de `skills/transformadores-potencia/` (Claude commitea; el director pushea).
5. 🔲 **Director confirma valores `⚠️ verificar`**: tolerancias, MO.00418 por clase, % por etapa,
   tabla OLTC, base de MVA por par, hot-spot de diseño, criterios de FP de buje y DGA.
