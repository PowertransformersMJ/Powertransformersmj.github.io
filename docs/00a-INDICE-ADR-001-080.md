# 🗂️ 00a — ÍNDICE SINÁPTICO, tramo §1–§80 (hija de `00`)

> **Hija por rango de [`00-INDICE.md`](00-INDICE.md)** (§G.5 sharding, 2026-09-30, `99 §120`): la madre
> llegó a su tope exacto (16000/16000). Aquí viven, **sin tocar una letra**, las filas §1–§80 del
> mapa § → línea de `99-HISTORIAL-ADR.md`. Las filas nuevas NUNCA entran aquí: se agregan al final
> de la madre (`brain:archive` lo hace solo). La columna Línea la reconcilia el mismo
> `npm run brain:index` (lee `00` y esta hija), y `brain:check` las audita juntas (gates #3/#5a/#9).
> El ruteo semántico (síntoma → neurona) sigue en la madre: **consulta allí primero**.

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
| §17 | ADR-017 — Reproceso colgado: timeout INTERNO por intento + watchdog + 2 GiB | 375 |
| §18 | ADR-018 — «terminated»: bodyTimeout de undici → dispatcher sin bodyTimeout | 398 |
| §19 | ADR-019 — 504/deadline-exceeded: presupuesto de reintento + timeoutSeconds 1500 | 420 |
| §20 | ADR-020 — RETIRO de "Reprocesar" (costo > valor). CF queda solo-CARGA; se conserva la robustez de transporte | 440 |
| §21 | ADR-021 — Colisión por fecha: comparar guardado vs nuevo antes de reemplazar | 462 |
| §22 | ADR-022 — Calificación global muestra TODAS las pruebas (FP bujes separado) + acción clasificada | 480 |
| §23 | ADR-023 — Vista CONSOLIDADA % del límite (SUPERSEDED por ADR-024 — mala interpretación) | 500 |
| §24 | ADR-024 — Tablero MULTI-AÑO (años superpuestos + filtro por prueba); nace el workflow de PREVIEW | 518 |
| §25 | ADR-025 — Multi-año v2: conserva FASES + valores reales + filtro año GLOBAL + tendencia con PROYECCIÓN | 539 |
| §26 | ADR-026 — Regresión: multi-año colapsaba informes del MISMO año → identidad por INFORME (no por año) | 560 |
| §27 | ADR-027 — Multi-año muestra TODAS las pruebas ELÉCTRICAS (familia genérica); ACEITE/DGA EXCLUIDO; no se fabrica | 578 |
| §28 | ADR-028 — Multi-año TENDENCIA: 1 gráfica por SUB-PRUEBA, orden cronológico | 600 |
| §29 | ADR-029 — Tan δ CONDENSADO en panel único filtrable (`ui/pruebas/tand-panel.js`, barras + filtros) | 628 |
| §30 | ADR-030 — Modal de colisión por fecha abre AMBOS PDFs (blob URL); modal → `ui/pruebas/modal-upsert.js` | 644 |
| §31 | ADR-031 — Tan δ "Por devanado": `svgPorDevanado` con leyenda limpia + criterio normativo VISIBLE | 656 |
| §32 | ADR-032 — Tan δ "Análisis conforme a norma": sellos estilizados NETA/IEEE + `analizarTand` multi-norma | 670 |
| §33 | ADR-033 — Retiro selectivo del overlay genérico vía `FAMILIAS_EXCLUIDAS_OVERLAY` (no destructivo) | 686 |
| §34 | ADR-034 — Retiro TOTAL del overlay genérico (predicado `excluidaDelOverlay`, regla `^otros:`). Reversible | 700 |
| §35 | ADR-035 — Retiro de "Resultados del informe" vía flag. ⚠️ CORREGIDO por §36 (sobre-retiro) | 716 |
| §36 | ADR-036 — CORRIGE §35: sección restaurada; solo se filtra el bloque tan δ del detalle (L-51) | 732 |
| §37 | ADR-037 — Reorden HTML: "Identidad de la unidad" bajo "Resumen de la unidad" (por ID, sin JS) | 746 |
| §38 | ADR-038 — FP/tan δ: vista Tip-up (ΔFP alta−baja) + caveat 20 °C | 758 |
| §39 | ADR-039 — FP/tan δ: localización del defecto por modo (`localizacionDe`/`causaProbableDe`) | 774 |
| §40 | ADR-040 — FP/tan δ: pendiente predictiva por sección + baseline-proxy; capacitancia descartada (artefacto) | 790 |
| §41 | ADR-041 — Corriente de excitación: panel propio `excitacion-panel.js`, espejo del tan δ | 804 |
| §42 | ADR-042 — Excitación: «Resumen (todo)», gating, fix `reset` (L-54), separación por NIVEL | 822 |
| §43 | ADR-043 — Excitación: tabla-RESUMEN por nivel (banda+KPI+norma+años); detalle por TAP gateado | 842 |
| §44 | ADR-044 — Panel "Valores por prueba" (`tablas-pruebas-panel.js`): rango, Σ pérdidas, multi-norma + CBM | 860 |
| §45 | ADR-045 — "Valores por prueba": acordeón por NIVEL + filtro de año por nivel + fix conformidad (`quitarColumnasVeredicto`, L-42) | 878 |
| §46 | ADR-046 — Excitación: orden por nivel; nace el preview FIEL `_dev/preview-excitacion-fiel.html` (L-56) | 894 |
| §47 | ADR-047 — Fix modo MIXTO que tumbaba el panel: layout por-fila + guards + try/catch por nivel | 912 |
| §48 | ADR-048 — Reorg POR PRUEBA paso 1: "Corriente de excitación" = SEGMENTO unificado `.pe-seg` (gráficas+tablas+JSON); demás pruebas intactas | 930 |
| §49 | ADR-049 — "Nomenclatura y secciones de aislamiento" pasa DENTRO del segmento Tan δ (reubica `#nomencl` vivo) | 948 |
| §50 | ADR-050 — Tan δ/FP = SEGMENTO unificado espejo de excitación (`montarPanelPrueba`, L-57) + fuera-de-criterio en rojo | 968 |
| §51 | ADR-051 — Migración del cerebro a brain-kit v1.0 (política git: Claude commit+push+merge+deploy) | 986 |
| §52 | ADR-052 — Fase 9: diagnóstico integral (14 auditores + 11 verificadores) → 123 hallazgos en 6 olas | 1004 |
| §53 | ADR-053 — "HAS TODO TU": G010 (umbrales→HI) + validación normativa TODO-04 + endurecimiento FASE B/E | 1036 |
| §54 | ADR-054 — Shell: `sgm:session-ready` no llegaba a los listeners de `document` de 10 páginas admin | 1054 |
| §55 | ADR-055 — TODO-15: ΔC1 de bujes al veredicto + caveat 20 °C de IR + clusters 3b/4 validados | 1072 |
| §56 | ADR-056 — Dashboard Salud de Activos conectado al parque REAL (`parque_salud.js`, sin fabricar) | 1090 |
| §57 | ADR-057 — Importador del Excel real «Salud de Activos» + MO.00418 Ed.02 ratificado (DGA/CRG/HER) ⟦FABLE-5⟧ | 1104 |
| §58 | ADR-058 — Ecosistema `GitHub-MJ`: kernel canónico propio (`brain:pull` + gate #0) + `60-WORKFLOWS` | 1122 |
| §59 | ADR-059 — Cierre del 058: bóveda de uso LOCAL (kernel v1.8.0, sentinel `NINGUNA`) | 1140 |
| §60 | ADR-060 — Hosting: Pages no nos prohíbe nada → NO se migra; runbook a Cloudflare listo por si acaso | 1158 |
| §61 | ADR-061 — Fichas Técnicas: de módulo suelto (1,8 MB) a `pages/fichas-tecnicas.html` + Firestore; híbrido `.ftm-` | 1181 |
| §62 | ADR-062 — Auditoría holística (11 auditores): datos de AFINIA servidos por Pages en modo `legacy` | 1226 |
| §63 | ADR-063 — Cola de la auditoría: topes en funciones, 16 índices Firestore, `ts_calculo` | 1284 |
| §64 | ADR-064 — Fichas: el port trajo todo el CSS y el 44% del marcado (clases huérfanas = vistas faltantes) | 1343 |
| §65 | ADR-065 — Novedades UUCC: contadores + cajón de decisión por equipo (aceptar / mantener / corregir) | 1394 |
| §66 | ADR-066 — Evaluación de Fichas: terciario «0» inflaba 23 %; «20.000» kVA leído como 20 | 1436 |
| §67 | ADR-067 — «Veo información basura»: Cargabilidad/SCADA con equipos inventados sin rótulo | 1497 |
| §68 | ADR-068 — Mantenimiento del cerebro (Nivel-2, 8 sondas): dos gates en verde sin medir | 1551 |
| §69 | ADR-069 — TX_Potencia: los «62 omitidos» eran 57 equipos reales → 208 válidos (cierra TODO-34) | 1637 |
| §70 | ADR-070 — Órdenes de Materiales SSEE con página propia, sin firmas escaneadas ni cédulas | 1710 |
| §71 | ADR-071 — Firmas a la cuenta de cada quien: `firmas/{uid}`, solo el dueño lee y escribe la suya | 1781 |
| §72 | ADR-072 — «Documenta absolutamente todo»: el cerebro no se enteró de dos tareas (M-02) | 1838 |
| §73 | ADR-073 — Reglas sin probar: `firebase deploy` solo COMPILA → 43 pruebas de `storage.rules` + `test:rules` | 1905 |
| §74 | ADR-074 — Las 39 discrepancias que no lo eran: el terciario vivía en otra ruta; catálogo de 3 familias | 1983 |
| §75 | ADR-075 — **Fichas**: 5 falsedades del papel firmado corregidas; redacción por banda; matriz a color | 2642 |
| §76 | ADR-076 — **Órdenes de Materiales** versión 8-sep, sin firmas ni cédulas, parque vivo; **L-90** | 2964 |
| §77 | ADR-077 — **Registro OE/OS** en Firestore: crear ≠ editar, versión, lápida al borrar, sin cédulas | 3017 |
| §78 | ADR-078 — **Cédulas** desde directorio privado en Firestore; candado en commit/merge/push. **L-93/94** | 3110 |
| §79 | ADR-079 — **El rol sale del perfil**: `/admins` deja de dar admin a quien ya tiene perfil | 3186 |
| §80 | ADR-080 — **Manda el Excel en todos los caminos**: el trigger ya no borra la condición del archivo | 3221 |
