# 🔬 Pruebas Eléctricas a Transformadores de Potencia — Carpeta de Skills

> Conjunto de skills (capacidades) que codifican el **proceso completo de pruebas
> eléctricas a transformadores de potencia**: cálculos matemáticos, criterios de
> evaluación normativos y diagnóstico. Pensadas para alimentar y mejorar el tablero
> de **Pruebas Eléctricas con IA** de SGM·TRANSPOWER (extracción, scorecard,
> tendencia, narrativa) con conocimiento normativo trazable.
>
> **Norma de referencia base**: ANSI/NETA ATS-2025, **§7.2.2 Transformers,
> Liquid-Filled** (más §7.2.1.1/.1.2 Dry-Type). Complementada con IEEE
> (C57.152, C57.104, C57.12.90, 62.2), IEC y ASTM según cada prueba.

---

## 📐 Arquitectura

```
skills/pruebas-electricas/
├── README.md                    ← este índice
├── _conocimiento/               ← neuronas COMPARTIDAS entre skills (no duplicar)
│   ├── 00-BATERIA-NETA-7.2.2.md       batería completa + criterios de aceptación
│   ├── tablas-neta-referencia.md      Tablas 100.x crudas relevantes a tx
│   ├── marco-normativo-multinorma.md  ⭐ varias normas (NETA/IEEE/IEC/interno) + reconciliación
│   ├── diagnostico-integrado-bateria.md ⭐ convergencia cross-test (no condenar con 1 prueba)
│   └── gestion-mantenimiento-predictivo.md ⭐ veredicto → acción preventiva/correctiva + intervalo
└── <prueba>/                    ← una skill por prueba
    ├── SKILL.md                   qué hace + cuándo dispara + workflow + salida multi-norma
    └── references/                neuronas de conocimiento (progressive disclosure)
        ├── 01-teoria.md             física: qué mide y por qué
        ├── 02-calculos.md           fórmulas exactas + ejemplos numéricos
        ├── 03-criterios-evaluacion.md  umbrales por NORMA (matriz multi-norma)
        └── 04-diagnostico.md        interpretación + troubleshooting
```

**Patrón de neuronas (4 por skill + 3 marcos compartidos)**: cada skill replica
`teoría → cálculos → criterios → diagnóstico` y se apoya en los TRES marcos compartidos:
**(a) multi-norma** — evaluar desde varias ópticas (NETA + IEEE C57.152 + IEC + interno +
fábrica) y consolidar en el más conservador, mostrando divergencias; **(b) diagnóstico
integrado** — confirmar la causa por convergencia de varias pruebas, nunca con una sola;
**(c) gestión predictiva** — traducir el veredicto en acción preventiva/correctiva, urgencia
(criticidad×severidad) e intervalo de re-ensayo. Réplica mecánica + veredicto que apalanca la decisión.

---

## 🗂️ Catálogo de skills (mapea 1:1 con la batería NETA 7.2.2 y los bloques del tablero)

| # | Skill | Prueba | Norma / criterio núcleo | Estado |
|---|---|---|---|---|
| 1 | `resistencia-aislamiento` | IR + PI/DAR (dev-dev, dev-tierra) | NETA Tabla 100.5 · IEEE C57.152 · PI≥1.0 | ✅ **ejemplar** |
| 2 | `relacion-transformacion` | TTR, todos los TAPs | NETA: ≤0.5% vs ratio calculado | ✅ completa |
| 3 | `factor-potencia-aislamiento` | FP/tan δ de devanados (Doble) | NETA Tabla 100.3 (aceite mineral 0.5%) | ✅ completa |
| 4 | `factor-potencia-bujes` | FP de bujes / hot-collar | NETA: >50% placa, cap. >5%, hot-collar >0.1 W | ✅ completa |
| 5 | `corriente-excitacion` | Corriente de excitación | NETA: patrón 2 similares + 1 menor | ✅ completa |
| 6 | `resistencia-devanados` | Resistencia de devanados | NETA: ±2% temp-corr; IEEE C57.152 (≤10% In) | ✅ completa |
| 7 | `reactancia-dispersion` | Reactancia de dispersión | NETA: 3φ >3% placa; por fase >3% promedio | ✅ completa |
| 8 | `sfra` | Análisis de respuesta en frecuencia | NETA: comparar vs fábrica/previos | ✅ completa |
| 9 | `resistencia-aislamiento-nucleo` | IR del núcleo @ 500 Vdc | NETA: ≥500 MΩ | ✅ completa |
| 10 | `analisis-aceite` | Pruebas físico-químicas del aceite | NETA Tabla 100.4 · ASTM (D1816, D974, D971…) | ✅ completa |
| 11 | `dga` | Análisis de gases disueltos | IEEE C57.104 / ASTM D3612 | ✅ completa |
| 12 | `cambiador-tomas-ltc` | Resistencia dinámica del LTC | NETA §7.12.3 · comparar vs previos | ✅ completa |
| 13 | `dfr-respuesta-dielectrica` | DFR / humedad del aislamiento sólido | NETA: vs previos + límites de humedad | ✅ completa |

> El orden de la tabla sigue la batería de **Electrical Tests (B)** de NETA §7.2.2.
> Detalle completo de la batería y criterios → `_conocimiento/00-BATERIA-NETA-7.2.2.md`.

---

## ⚙️ Cómo se conecta con el tablero de la página

El tablero ya deriva criterios en `…/pruebas_electricas_schema.js`
(`CRITERIOS_NORMA`, `NETA_IR_MIN_GOHM`). Estas skills son la **fuente normativa
trazable** detrás de esos números: cada umbral del código debe poder citarse a una
neurona `03-criterios-evaluacion.md` con su tabla/cláusula NETA o IEEE. Al ajustar
un criterio en el código, actualizar primero la neurona y citar la fuente.

## 🛠️ Activación como skill invocable

Para que una skill sea invocable vía la tool `Skill`, debe estar staged en
`.claude/skills/` (ver `docs/30-LECCIONES.md` L-19). El contenido vive en el repo
(versionado); el staging local es un paso aparte. Mientras tanto funcionan como
**base de conocimiento de referencia** consultable on-demand.
