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
| §57 | ADR-057 — Importador del Excel real «Salud de Activos» + MO.00418 Ed.02 ratificado (DGA/CRG/HER) ⟦FABLE-5⟧ | 1104 |
| §58 | ADR-058 — Ecosistema `~/Desktop/GitHub-MJ`: kernel canónico PROPIO v1.7.0 con reparto sellado (`brain:pull` + gate #0), `60-WORKFLOWS`, Antigravity oficial; bóvedas NO se fusionan (datos de cliente) ⟦OPUS-5⟧ | 1122 |
| §59 | ADR-059 — Cierre del 058: bóveda de uso LOCAL (kernel v1.8.0: sentinel `NINGUNA` para no dejar alarma perpetua), menú de Antigravity confirmado con nombres reales, y L-63 (no re-pedir autorización ya concedida) ⟦OPUS-5⟧ | 1140 |
| §60 | ADR-060 — Hosting: Pages no nos prohíbe nada → NO se migra; runbook a Cloudflare listo por si acaso ⟦OPUS-5⟧ | 1158 |
| §61 | ADR-061 — Fichas Técnicas: de módulo suelto (1,8 MB con 208 registros embebidos) a `pages/fichas-tecnicas.html` con datos de Firestore; modelo híbrido `.ftm-` (483 selectores, 0 globales); plantilla PE.02081 saneada (traía firmas manuscritas y datos de cliente); 1254 pruebas ⟦OPUS-5⟧ | 1181 |
| §62 | ADR-062 — Auditoría holística (11 auditores) y remediación: datos reales de AFINIA servidos en internet (Pages en modo `legacy` ignoraba el filtro del artefacto), importador que dividía entre 1.000, CI en rojo 76 corridas, registro abierto en Firebase, menú que no colapsaba. 1.334 pruebas · CI en verde ⟦OPUS-5⟧ | 1226 |
| §63 | ADR-063 — Cola de la auditoría: funciones con topes, 16 índices Firestore nuevos (producción tenía 33 de 37), `ts_calculo` con dos tipos, 5 suscripciones sin límite, 5 pruebas sin assert, 13 escapadores sin comillas, foto de 1,1 MB → 236 KB ⟦OPUS-5⟧ | 1284 |
| §64 | ADR-064 — Fichas: el port de ADR-061 trajo el CSS entero pero solo el 44% del marcado; las clases huérfanas nombraban las vistas que faltaban ⟦OPUS-5⟧ | 1343 |
| §65 | ADR-065 — Gestión de novedades UUCC: barra de contadores, cajón de decisión por equipo (aceptar calculada / mantener registrada / corregir a otra) y acta en Excel que se puede reimportar. Dos invariantes con prueba: una decisión NUNCA toca la UUCC calculada, y el acta va y vuelve sin deformarse. 1.349 pruebas ⟦OPUS-5⟧ | 1394 |
| §66 | ADR-066 — Evaluación holística de Fichas Técnicas (6 auditores) y remediación: terciario «0» inflaba el presupuesto 23%, «20.000» kVA se leía como 20, conformidad contradictoria entre vistas, acta reimportada por posición, 412→206 lecturas ⟦OPUS-5⟧ | 1436 |
| §67 | ADR-067 — «Veo información basura»: Cargabilidad y SCADA mostraban equipos inventados sin rotularlos, la matriz vestía la falta de datos de buena noticia y 8 de 10 fichas normativas no tenían botón. 64 de 208 equipos con la fuente en desacuerdo ⟦OPUS-5⟧ | 1497 |
| §68 | ADR-068 — Mantenimiento integral del cerebro (auditoría Nivel-2, 8 sondas): el arranque afirmaba una verificación de caché que no corría, el gate de la bóveda decía «íntegro» con 8 deliberaciones sin indexar, el mapa no conocía 4 módulos vivos y el formato ADR no tenía casilla para lo «verificado sano». Neurona hija `32` ⟦OPUS-5⟧ | 1551 |
| §69 | ADR-069 — La hoja TX_Potencia leída de verdad: los «62 omitidos» eran **57 equipos reales** con la cabecera en la fila 2. Da 208 válidos con Índice de Salud y 1.655.376 usuarios (cierra TODO-34). Su `CONDICION` y el índice recalculado solo coinciden en el 46%: manda la cargabilidad (18 al ≥90%), y ASTREA marca un 250% imposible ⟦OPUS-5⟧ | 1637 |
| §70 | ADR-070 — Órdenes de Materiales SSEE entra al sitio con página propia (ya existían las «Órdenes» de TRABAJO), sin las 3 firmas escaneadas ni las 8 cédulas: el guard esconde la página, no el archivo. Acotar estilos no basta (el sitio también define `.modal`) y sanear por la forma del campo dejó una cédula viva en comentarios ⟦OPUS-5⟧ | 1710 |
| §71 | ADR-071 — Las firmas salen de la web y pasan a la cuenta de cada quien: ruta `firmas/{uid}` en Storage, solo el dueño lee y escribe la suya, y solo se estampa en la línea que lleva su nombre. Se lee con `getBytes` y NO con `getDownloadURL`, cuya URL con token funciona sin sesión ⟦OPUS-5⟧ | 1781 |
| §72 | ADR-072 — «Documenta absolutamente todo»: el cerebro no sabía nada de lo construido en las dos tareas anteriores — escribí M-02 y dos tareas después la incumplí yo mismo (M-06). Frescura restituida, `05` re-sellado, skill externa catalogada, dos shards nuevos (`21`, `33`), y la admisión de que W-11 se aplicó A MEDIAS ⟦OPUS-5⟧ | 1838 |
| §73 | ADR-073 — Las reglas que nadie había probado: `firebase deploy` solo COMPILA. 43 pruebas nuevas de `storage.rules` y `test:rules` con los dos emuladores. Auditoría adversarial: 26 hallazgos, **23 refutados** (§73.8), 3 confirmados con sonda propia — el grave alcanza también a `firestore.rules` ⟦OPUS-5⟧ | 1905 |

## Capa 2 — Ruteo semántico (síntoma → neurona) — CONSULTA ESTO PRIMERO

| Si el síntoma / la duda es… | Ve a… |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-MEMORIA-ESPACIAL` |
| Voy a mover/renombrar archivos, refactor, merge, deploy | 🧪 `30-LECCIONES` (gotchas) + 🗺️ `20` |
| Voy a tocar `functions/` o el pipeline de IA (streaming/reintentos/timeouts) | 🤖 `31-LECCIONES-IA` (hija de `30`, L-35/L-43–L-48) |
| Busco un pendiente que no está en `10` (decisión de arquitectura, validación diferida, cola vieja) | 🧊 `11-PENDIENTES-FRIOS` (hija de `10`) |
| Necesito saber qué contiene una hoja `docs/*.md` del dueño | 🗂️ `21-ESPACIAL-HOJAS` (hija de `20`) |
| Voy a lanzar agentes/workflow, automatizar el navegador o fiarme de un barrido por consola | 🛠️ `33-LECCIONES-HARNESS` (hija de `30`) |
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
| ¿Podemos seguir en GitHub Pages? ¿migramos el hosting? ¿los ToS nos prohíben algo? | `99 §60` (veredicto + runbook Cloudflare + disparadores) — **no re-analizar por calendario** |
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
