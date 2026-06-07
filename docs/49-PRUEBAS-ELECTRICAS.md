# ⚡ 49 — PRUEBAS ELÉCTRICAS / Ingeniería de Diagnóstico (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO`. Disparador: Trigger 🔵 §G.2 cuando el
> cliente pide mejorar **cálculos / criterios / diagnóstico** de pruebas eléctricas a
> transformadores de potencia (megóhmetro, FP/tan δ, relación, excitación, DGA, SFRA…).
> Mantenido por Claude bajo demanda del director; **el cliente irá entregando más normas
> y documentos** para alimentar las neuronas de cada skill.

## Qué es esta iniciativa

Carpeta de **skills project-specific** en `skills/pruebas-electricas/` que convierten el
conocimiento normativo de ensayos eléctricos en una capacidad de **veredicto trazable**
(corrección de temperatura → criterio normativo que aplica → diagnóstico de causa). El fin
declarado por el director: mejorar los **cálculos matemáticos, criterios de evaluación y
diagnóstico** en TODAS las funcionalidades de la página (en especial el Tablero de Pruebas
Eléctricas con IA — ver ADR-003→ADR-010).

> ⚠️ Estas skills son **del proyecto** (criterios AFINIA/NETA + decisiones del schema), NO
> capacidades portables genéricas → por eso viven en el cerebro (lobe) y no son candidatas a
> "skill genérica" del `40 §Sugerencia`. La frontera: el *framework* de cómo escribir skills
> es portable (skill-creator); el *contenido normativo aterrizado al proyecto* es del cerebro.

## Skills consultadas

- **`skill-creator`** — dio el método: `SKILL.md` (frontmatter `name`+`description` "pushy"
  ≤1024 chars para disparar bien) + progressive disclosure (`references/` on-demand) + formato
  de salida. Se aplicó para estructurar la skill ejemplar y el patrón replicable.

## Arquitectura (patrón validado en la ejemplar)

```
skills/pruebas-electricas/
  README.md                         ← índice maestro: 13 skills ↔ batería NETA 7.2.2
  _conocimiento/                    ← neuronas COMPARTIDAS (no duplicar por skill)
    00-BATERIA-NETA-7.2.2.md        ← backbone: bloques B (ensayos) + D (criterios)
    tablas-neta-referencia.md       ← Tablas 100.1 / 100.3 / 100.4 / 100.5 / 100.14
    marco-normativo-multinorma.md   ← ⭐ varias normas + precedencia + reconciliación + salida
    diagnostico-integrado-bateria.md← ⭐ convergencia cross-test (no condenar con 1 prueba)
    gestion-mantenimiento-predictivo.md ← ⭐ veredicto → acción preventiva/correctiva + intervalo
  <una-carpeta-por-prueba>/
    SKILL.md                        ← trigger + workflow 6 pasos + salida MULTI-NORMA
    references/
      01-teoria.md    02-calculos.md    03-criterios-evaluacion.md    04-diagnostico.md
```

**Patrón = 4 neuronas por skill + 3 marcos compartidos.** Las 4 (teoría → cálculos →
criterios → diagnóstico) más: **(a) multi-norma** — evaluar desde varias ópticas (NETA +
IEEE C57.152 + IEC + interno + fábrica), consolidar en el más conservador y mostrar
divergencias; **(b) diagnóstico integrado** — confirmar causa por convergencia de pruebas,
nunca con una sola; **(c) gestión predictiva** — traducir el veredicto en acción
preventiva/correctiva, urgencia (criticidad×severidad) e intervalo de re-ensayo (CBM/PdM).
Replicar es mecánico una vez validada la ejemplar.

> **Decisión de diseño (2026-06-07, a pedido del director)**: el patrón de 4 neuronas NO era
> suficiente para un criterio robusto → se añadió la **capa multi-norma** (evaluar con varios
> estándares a la vez) + el **diagnóstico integrado cross-test**. Hallazgos de accuracy que
> quedan grabados: **IEC 60076-3 NO da umbrales de IR/PI** (gobierna withstand/PD, no
> resistencia); la escala fina de PI (2–4 "bueno") viene de **IEEE 43, que es de máquinas
> ROTATIVAS y excluye tx** → en tx es apoyo por analogía, el criterio duro es NETA (PI≥1.0) +
> IEEE C57.152 (PI≥1.5).

## Estado de las 13 skills (1 por prueba de la batería 7.2.2)

| # | Skill | Estado |
|---|---|---|
| 1 | `resistencia-aislamiento` (IR · DAR · PI) | ✅ ejemplar + multi-norma |
| 2–13 | relacion-transformacion · corriente-excitacion · resistencia-devanados · factor-potencia-aislamiento · factor-potencia-bujes · resistencia-aislamiento-nucleo · reactancia-dispersion · sfra · cambiador-tomas-ltc · analisis-aceite · dga · dfr-respuesta-dielectrica | ✅ **LAS 13 COMPLETAS** (2026-06-07, 4 neuronas c/u + 3 marcos compartidos) |

> **Replicación hecha (2026-06-07)** vía 4 agentes en paralelo (grupos: electromagnético /
> dieléctrico FP / mecánico-impedancia / química-aceite). 65 archivos `.md` (13×5). Cada skill:
> SKILL.md (trigger pushy ≤1024) + 4 neuronas, con salida multi-norma + convergencia cross-test
> + acción predictiva. Verificado: nombres = carpeta, 0 links rotos, wiring de los 3 marcos en cada
> skill, sin `.DS_Store`. **Pendiente del director**: validar y, sobre todo, confirmar los valores
> marcados `⚠️ verificar` (ver §Decisiones) contra la edición de norma vigente.

## Decisiones / criterios project-specific (verificar contra el tablero)

- **Jerarquía de criterio IR** (NETA explícita): dato de fábrica/placa > mínimo por **clase de
  tensión** > Tabla 100.5 genérica. El tablero usa `NETA_IR_MIN_GOHM` en `…_schema.js`.
- **110 kV → 30 GΩ** (mínimo por clase): el enfoque **multi-norma ya lo resuelve sin tener que
  elegir** — se presentan AMBOS veredictos (pasa el piso NETA 100.5 de 5 GΩ **pero** falla el
  criterio por clase de 30 GΩ → "pobre/INVESTIGAR"). Aun así queda **PENDIENTE confirmar la
  fuente exacta** del 30 GΩ contra la edición de norma del director (¿IEEE C57.152 por clase o
  interno MO.00418.DE-GAC-AX.01 Ed. 02?) para citarlo con precisión en `03` y el schema.
- Corrección de temperatura **a 20 °C** (Tabla 100.14.1 col. aceite) — consistente con el tablero.
- PI/DAR **no se leen aislados**: con IR muy alta (>~5 GΩ) un PI bajo puede ser no concluyente.

## ⚠️ Valores `verificar` que las skills dejaron marcados (consolidado para el director)

Números no confirmables contra norma pública → cada skill los marca `⚠️ verificar` y usa
mientras tanto el piso normativo más conservador. **Confirmar contra la edición vigente** del
director (MO.00418 Ed. 02 / IEEE / NETA) y luego fijar en `03-…` + el schema del tablero:
- **Todos los criterios por CLASE de tensión** (MO.00418) en las 13 skills — incl. `110 kV→30 GΩ` de IR.
- **Excitación**: no hay umbral % duro normativo (se compara vs fábrica/fases); el "~5% externas / ~30% central" es práctica de industria, no norma.
- **R. devanados**: desbalance ≤2 % (NETA, piso) vs 2–3 % industria.
- **FP/tan δ**: IEEE C57.12.90 retiró factores genéricos de corrección de T en 2010 → usar el del fabricante; umbral de tip-up ΔFP.
- **Bujes**: banda de capacitancia 5–10 %/>10 % (NETA solo fija >5 %); límite de FP de C2.
- **IR núcleo**: piso 500 MΩ @500 Vdc (NETA) vs "cientos de MΩ"; límite de corriente circulante.
- **Reactancia de dispersión**: umbral 3 % (batería interna; prueba opcional en NETA).
- **SFRA**: sin umbral numérico de consenso IEEE/IEC — interpretación por bandas + métricas CC/ASLE (práctica).
- **LTC**: transición 40–60 ms y tolerancia de resistores; umbral de nº de operaciones (del fabricante).
- **Aceite**: límites en servicio por clase (IEEE C57.106 / NETA 100.4); cortes del índice IFT/acidez.
- **DGA**: ppm exactos del percentil 90/95 por gas (IEEE C57.104-2019 Tablas 1/2, no públicos); cortes de Rogers/Doernenburg/Duval.
- **DFR**: escala de % humedad del papel (2/3/4.5 %, CIGRE TB 349/414).

## Pendientes / próxima ronda

- Validación del director sobre la skill ejemplar (¿el patrón de 4 neuronas le sirve?) antes
  de replicar a las 12 restantes.
- Ingerir las normas/documentos adicionales que el director vaya entregando (alimentar neuronas).
- Investigación web continua por prueba (IEEE C57.152/C57.104/C57.149 SFRA, etc.).
- Confirmar el set de mínimos por clase de tensión vs la edición de norma vigente.

## Cómo se conecta con el resto del cerebro

- El **Tablero de Pruebas Eléctricas con IA** (ADR-003→ADR-010, ver `99 §3..§10`) es el
  consumidor: la IA extrae lecturas crudas; estas skills aportan el **diagnóstico determinista**
  (corregir, criteriar por jerarquía, emitir veredicto + causa probable).
- Mapa de archivos del tablero → `10-MEMORIA-CORTO-PLAZO §MAPA DE ARCHIVOS CLAVE`.
- Catálogo de skills del repo → `skills-inventory.md` (sección Pruebas Eléctricas).
