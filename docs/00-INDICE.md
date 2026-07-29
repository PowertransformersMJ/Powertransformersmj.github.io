# 🗂️ 00 — ÍNDICE SINÁPTICO (mapa § → línea + ruteo semántico)

> Puerta de entrada al Largo Plazo (`99`). Dos capas: (1) tabla mecánica §→línea
> (la reconcilia `npm run brain:index` — NO la mantengas a mano); (2) ruteo semántico
> "síntoma → neurona" (esta SÍ es inteligencia curada — aliméntala).
> Regla de oro: NUNCA leer `99` completo — busca el § aquí y lee SOLO ese tramo
> (`Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150`).

## Capa 1 — Mapa § → línea de `99-HISTORIAL-ADR.md`

> Formato de fila EXACTO (el reconciliador lo parsea): `| §N | descripción con hook | LINEA |`

| § | Qué resuelve (hook para decidir si leerlo) | Línea |
|---|---|---|
| §1 | ADR-001 — Instalación del cerebro neuronal documental v1.0.0 (7 fases + auditoría, 2026-06-04) | 20 |
| §2 | ADR-002 — Activación local de 24 skills repo-only en `.claude/skills/` | 42 |
| §3 | ADR-003 — Extracción de informes de Pruebas Eléctricas con IA (Claude) vía Cloud Function | 64 |
| §4 | ADR-004 — Pruebas Eléctricas: extracción IA robusta + identidad + tablero detallado | 87 |
| §5 | ADR-005 — Gobernanza: purga de Debug/ del historial + flujo commit/deploy/push | 107 |
| §6 | ADR-006 — Tablero flexible "bloques de análisis" (modelo agnóstico + render genérico) | 127 |
| §7 | ADR-007 — Subsistema de diagnóstico de extracción + bloques a Firestore (revisión ADR-006) | 152 |
| §8 | ADR-008 — Tablero: pipeline bloques completo + rediseño IA-primaria + render interactivo | 175 |
| §9 | ADR-009 — Tablero: completitud determinista, workflow de auditoría, tendencia y Biblioteca-hub | 200 |
| §10 | ADR-010 — Tendencia F2+F3: franja-timeline de informes + narrativa de tendencia por IA | 226 |
| §11 | ADR-011 — Veredicto 100% normativo (scorecard vs norma, no informe) + NETA por clase + desviación general | 246 |
| §12 | ADR-012 — Evaluación MULTI-NORMA (veredicto por norma + consolidado conservador + divergencias) | 267 |
| §13 | ADR-013 — FP de bujes canónico (discriminado) + Tendencia de alto nivel multi-norma por métrica | 290 |
| §14 | ADR-014 — Identidad/placa CONGELADA por informe (trafo móvil doble config: clase del propio ensayo) | 311 |
| §15 | ADR-015 — "Reprocesar" funcional: reintento con backoff server-side + presupuesto de tiempo | 332 |
| §16 | ADR-016 — "Reprocesar" asíncrono observable: persistencia + estado durable + badge en vivo | 353 |
| §17 | ADR-017 — Reproceso colgado: timeout INTERNO por intento (abort del stream) + watchdog + 2 GiB | 375 |
| §18 | ADR-018 — "Claude API: terminated" = bodyTimeout de undici corta el stream → dispatcher sin bodyTimeout | 398 |
| §19 | ADR-019 — 504/deadline-exceeded: presupuesto de reintento sin sitio para intento entero + timeoutSeconds 1500 | 420 |
| §20 | ADR-020 — RETIRO de "Reprocesar" (costo > valor). CF queda solo-CARGA; se conserva la robustez de transporte | 440 |
| §21 | ADR-021 — Previsualización al colisionar por fecha: comparar guardado vs nuevo antes de reemplazar | 462 |
| §22 | ADR-022 — Calificación global muestra TODAS las pruebas (FP bujes separado) + acción clasificada | 480 |
| §23 | ADR-023 — Vista CONSOLIDADA % del límite (SUPERSEDED por ADR-024 — mala interpretación) | 500 |
| §24 | ADR-024 — Tablero MULTI-AÑO (años superpuestos + filtro por prueba); nace el workflow de PREVIEW | 518 |
| §25 | ADR-025 — Multi-año v2: conserva FASES + valores reales + filtro año GLOBAL + tendencia con PROYECCIÓN | 539 |
| §26 | ADR-026 — Regresión: multi-año colapsaba informes del MISMO año → identidad por INFORME (no por año) | 560 |
| §27 | ADR-027 — Multi-año muestra TODAS las pruebas ELÉCTRICAS (familia genérica); ACEITE/DGA EXCLUIDO; no se fabrica | 578 |
| §28 | ADR-028 — Multi-año TENDENCIA año a año: 1 gráfica por SUB-PRUEBA, orden cronológico; validado con informes reales | 600 |
| §29 | ADR-029 — Tan δ CONDENSADO en panel único filtrable (`ui/pruebas/tand-panel.js`, barras + filtros) | 628 |
| §30 | ADR-030 — Modal de colisión por fecha abre AMBOS PDFs (blob URL); modal → `ui/pruebas/modal-upsert.js` | 644 |
| §31 | ADR-031 — Tan δ "Por devanado": `svgPorDevanado` con leyenda limpia + criterio normativo VISIBLE | 656 |
| §32 | ADR-032 — Tan δ "Análisis conforme a norma": sellos estilizados NETA/IEEE + `analizarTand` multi-norma | 670 |
| §33 | ADR-033 — Retiro selectivo del overlay genérico vía `FAMILIAS_EXCLUIDAS_OVERLAY` (no destructivo) | 686 |
| §34 | ADR-034 — Retiro TOTAL del overlay genérico (predicado `excluidaDelOverlay`, regla `^otros:`). Reversible | 700 |
| §35 | ADR-035 — Retiro de "Resultados del informe" vía flag. ⚠️ CORREGIDO por §36 (sobre-retiro) | 716 |
| §36 | ADR-036 — CORRIGE §35: sección restaurada; solo se filtra el bloque tan δ del detalle (L-51) | 732 |
| §37 | ADR-037 — Reorden HTML: "Identidad de la unidad" bajo "Resumen de la unidad" (por ID, sin JS) | 746 |
| §38 | ADR-038 — FP/tan δ: vista Tip-up (ΔFP alta−baja: PD vs humedad) + caveat 20 °C; auditoría 🔵 skill FP | 758 |
| §39 | ADR-039 — FP/tan δ: localización del defecto por modo (`localizacionDe`/`causaProbableDe`) | 774 |
| §40 | ADR-040 — FP/tan δ: pendiente predictiva por sección + baseline-proxy; capacitancia descartada (artefacto) | 790 |
| §41 | ADR-041 — Corriente de excitación: panel propio `excitacion-panel.js` espejo del tan δ; nivel de tensión (`nivelDe`), 5 vistas, W de pérdidas, criterio NETA 2+1/IEEE 62 (patrón=FORMA, L-53) | 804 |
| §42 | ADR-042 — Excitación: vista "Resumen (todo)" + gating de tablas + fix `reset` (Sets en sitio, L-54) + separación por NIVEL (§42.8) | 822 |
| §43 | ADR-043 — Excitación: tabla-RESUMEN por nivel (fusión 1+4: banda+KPI+norma+años); detalle por TAP gateado; elegida por el director entre 4 previews | 842 |
| §44 | ADR-044 — Panel "Valores por prueba" (`tablas-pruebas-panel.js`): rango real, Σ pérdidas, nivel real, diagnóstico multi-norma + acción CBM; aditivo | 860 |
| §45 | ADR-045 — "Valores por prueba": acordeón por NIVEL + filtro de año por nivel + fix conformidad (`quitarColumnasVeredicto`, L-42) | 878 |
| §46 | ADR-046 — Excitación: orden por nivel + retira tablas repetidas; nace el preview FIEL `_dev/preview-excitacion-fiel.html` (L-56); código muerto FUSIÓN pendiente de poda | 894 |
| §47 | ADR-047 — Fix modo MIXTO que tumbaba el panel (solo AT·110 visible): layout por-fila + guards + try/catch por nivel; reproducido en navegador | 912 |
| §48 | ADR-048 — Reorg POR PRUEBA paso 1: "Corriente de excitación" = SEGMENTO unificado `.pe-seg` (gráficas+tablas+JSON); demás pruebas intactas | 930 |
| §49 | ADR-049 — "Nomenclatura y secciones de aislamiento" pasa DENTRO del segmento Tan δ (reubica `#nomencl` vivo) | 948 |
| §50 | ADR-050 — Tan δ/FP = SEGMENTO unificado espejo de excitación (tablas de `montarPanelPrueba`, L-57) + detalle por informe + fuera-de-criterio en rojo + fix chips multi-norma (L-58) | 968 |
| §51 | ADR-051 — Migración del cerebro a brain-kit v1.0 (kernel v1.2): entrevista F3a (política git NUEVA: Claude commit+push+merge+deploy), rescate TRIAJE en `_legacy/`, 30 condensado, hooks de sesión | 986 |
| §52 | ADR-052 — Fase 9: diagnóstico integral (14 auditores + 11 verificadores adversariales, 0 refutados) → 123 hallazgos en 6 olas; hallazgo dominante = confidencial/copyright en repo público; detalle en bóveda privada | 1004 |
| §53 | ADR-053 — "HAS TODO TU": G010 cableado (umbrales F18→Health Index, aditivo+fail-safe) + validación normativa TODO-04 (re-atribución tan δ/per-clase; refutados 2) + fixes FASE E (tarjeta+XSS) · billing confirmado caído (CF IA 500) | 1036 |
| §54 | ADR-054 — Fix sistémico del shell (TODO-16, cazado en validación VIVA): evento `sgm:session-ready` no llegaba a los listeners de `document` de 10 páginas admin (doble dispatch) + override AQUA dejaba 6 modales legacy pegados abiertos (`:not(.open):not(.on)`) | 1054 |
| §55 | ADR-055 — TODO-15 completo: ΔC1 de bujes al veredicto (>5% investigar, nunca rojo sin dirección) + caveat 20 °C de IR + clusters 3b/4 validados con refutación (re-atribuciones: 50 mA→práctica, DRM→fabricante, collar→Doble TDRB) · TODO-07 bóveda git | 1072 |
| §56 | ADR-056 — TODO-09: dashboard Salud de Activos conectado al parque REAL de Firestore (mapper puro `parque_salud.js`, hi_final del motor G010, sin fabricar) — verificado vivo: 212 activos, 6 evaluados/206 sin dato; corrección §3.3: los 6 evaluados eran TX-DEMO del seed, no reales — limpiar | 1090 |
| §57 | ADR-057 — Importador del Excel real Salud de Activos + MO.00418 Ed.02 ratificado tabla por tabla: eval_dga = promedio(TDGC,CO,CO₂,C₂H₂), CRG = % oficial Planificación AT, HER = calif 1-5 de inspección, guard omitidos; dry-run 208/213, coincidencias ≥93-100%; CONDICION Excel = trunc(HI)+juicio experto ~38 | 1104 |
| §58 | ADR-058 — Ecosistema `~/Desktop/GitHub-MJ`: kernel canónico PROPIO v1.7.0 con reparto sellado (`brain:pull` + gate #0), `60-WORKFLOWS`, Antigravity oficial; bóvedas NO se fusionan (datos de cliente) ⟦OPUS-5⟧ | 1122 |

## Capa 2 — Ruteo semántico (síntoma → neurona) — CONSULTA ESTO PRIMERO

| Si el síntoma / la duda es… | Ve a… |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-MEMORIA-ESPACIAL` |
| Voy a mover/renombrar archivos, refactor, merge, deploy | 🧪 `30-LECCIONES` (gotchas) + 🗺️ `20` |
| Voy a tocar `functions/` o el pipeline de IA (streaming/reintentos/timeouts) | 🤖 `31-LECCIONES-IA` (hija de `30`, L-35/L-43–L-48) |
| Validar si algo es código muerto antes de borrar | 🧪 `30-LECCIONES` + `_legacy/README.md` |
| Bug recurrente / 2 fallos en el mismo síntoma | Capa 1 → tramo de `99-HISTORIAL-ADR` |
| ¿Qué hay pendiente? estado del sprint | ⚡ `10-CORTO-PLAZO` (TODO-NN) |
| ¿Estado real del sistema / build / producción? | 🩺 `05-ESTADO-GLOBAL` |
| 🔵 Audita SEGURIDAD / rules / auth | 🎯 `40-LOBULOS` → 41-SEGURIDAD (on-demand) + Skill tool |
| 🔵 Audita LEGAL / privacidad / Ley 1581 | 🎯 `40-LOBULOS` → 42-LEGAL (on-demand) + Skill tool |
| 🔵 Audita UX / SEO / performance / a11y / copy | 🎯 `40-LOBULOS` → lóbulo 43-48 (on-demand) + Skill tool (`accessibility-audit`, `seo-audit`…) |
| 🔵 Criterios / diagnóstico de PRUEBAS ELÉCTRICAS (IR/PI/DAR, FP/tan δ, SFRA, excitación…) | 🎯 `49-PRUEBAS-ELECTRICAS` + skills `skills/pruebas-electricas/*` |
| 🔵 TIPO de transformador, grupo vectorial, cálculos del EQUIPO | 🎯 `50-TRANSFORMADORES-POTENCIA` + skills `skills/transformadores-potencia/*` |
| 🛠️ ¿Qué skill tengo para X? | `docs/skills-inventory.md` + `40-LOBULOS §Recursos` |
| 🛰️ Decisión fuerte / cara de revertir → ¿2ª opinión externa? | `60-WORKFLOWS §W-11` (checklist cerrado) → `15-CONSEJO-EXTERNO` + skills `proceso-decision-fuerte`/`comite-expertos` |
| 🔁 ¿Cómo se corre un proceso repetible? (red-team de reglas, verificar un subagente, criterio multi-norma, importar Excel real) | 🔁 `60-WORKFLOWS` (W-01..W-13) |
| 🔑 Tocar `scripts/*.mjs` del cerebro / actualizar el kernel | `../brain-private/kernel/README.md` → editar allí + `npm run brain:pull` (NUNCA en el repo: gate #0) |
| 🤖 Extracción de PDFs con IA / Claude API / costos LLM | 🧪 `30` (L-20/L-21) + `99 §3` + Skill `claude-api` |
| El "por qué" de una decisión / detalle de un § | Capa 1 → `99-HISTORIAL-ADR.md` |

## Doctrinas (referencia rápida — las always-on viven en CLAUDE.md §3)

| Doctrina | Dónde vive |
|---|---|
| Performance (sin `transition:all`, sin animar layout) | `CLAUDE.md §3.1` |
| API estable (no renombrar IDs/exports; aditivo) | `CLAUDE.md §3.2` |
| Verifica-no-asumas (evidencia antes de afirmar) | `CLAUDE.md §3.3` |
| IAP (Impact Analysis Previo, 5 secciones) | `CLAUDE.md §3.4` |
| Anti-observers globales / concurrencia | `CLAUDE.md §3.5` |
