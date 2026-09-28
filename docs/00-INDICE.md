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
| §41 | ADR-041 — Corriente de excitación: panel propio `excitacion-panel.js`, espejo del tan δ | 804 |
| §42 | ADR-042 — Excitación: vista "Resumen (todo)" + gating de tablas + fix `reset` (Sets en sitio, L-54) + separación por NIVEL (§42.8) | 822 |
| §43 | ADR-043 — Excitación: tabla-RESUMEN por nivel (fusión 1+4: banda+KPI+norma+años); detalle por TAP gateado; elegida por el director entre 4 previews | 842 |
| §44 | ADR-044 — Panel "Valores por prueba" (`tablas-pruebas-panel.js`): rango real, Σ pérdidas, nivel real, diagnóstico multi-norma + acción CBM; aditivo | 860 |
| §45 | ADR-045 — "Valores por prueba": acordeón por NIVEL + filtro de año por nivel + fix conformidad (`quitarColumnasVeredicto`, L-42) | 878 |
| §46 | ADR-046 — Excitación: orden por nivel; nace el preview FIEL `_dev/preview-excitacion-fiel.html` (L-56) | 894 |
| §47 | ADR-047 — Fix modo MIXTO que tumbaba el panel (solo AT·110 visible): layout por-fila + guards + try/catch por nivel; reproducido en navegador | 912 |
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
| §66 | ADR-066 — Evaluación holística de Fichas (6 auditores): terciario «0» inflaba 23%, «20.000» kVA leído como 20… | 1436 |
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
| §81 | ADR-081 — **Potencia y usuarios se leen EN la casilla** de la ficha (punto por banda de MVA, aviso del «1»); la casilla sigue siendo la de la norma | 3264 |
| §82 | ADR-082 — **Cada TX abre SU ficha**: el «CODIGO SUBESTACION» dejó de ser la identidad (dos TX de un patio compartían ficha) | 3313 |
| §83 | ADR-083 — **El documento que se firma deja de vivir solo en memoria**: borrador local con dueño y caducidad que nunca pisa ni se equivoca de equipo | 3362 |
| §84 | ADR-084 — **La carga tardía ya no borra el listado**; el pie del papel dice su fuente real | 3468 |
| §85 | ADR-085 — **El alcance lo escribe la redacción del formato** dictada por el Ingeniero; lo que compone el módulo no cuenta como trabajo suyo | 3514 |
| §86 | ADR-086 — **Auditoría Nivel-2**: 53 hallazgos, 6 reincidentes; la disparó el volumen de ADRs y no el calendario; kernel v1.11.0 sin IDs ajenos | 3574 |
| §87 | ADR-087 — **Tanda B, el Excel que se firma**: Valor Real al papel, `[PENDIENTE]` (nunca «0»); CF-32 refutado | 3632 |
| §88 | ADR-088 — **Período y firmas con la forma del Excel** (Aprobación con dos firmantes, ocupación de la plantilla); aún no llegan al Excel (CF-25) | 3713 |
| §89 | ADR-089 — **Quién firma**: lista dictada por el Ingeniero en la ficha y en el Excel (CF-25); revisión de 12 agentes, 6 confirmados | 3743 |
| §90 | ADR-090 — **El Alcance muestra solo el alcance**: fuera el selector de acciones de mantenimiento | 3797 |
| §91 | ADR-091 — **Fechas con calendario**: se ven «dd/mm/aaaa» y el calendario se abre al tocarlas | 3832 |
| §92 | ADR-092 — **Beneficios por práctica**: el selector pasa a Beneficios y propone el texto con lo escogido | 3855 |
| §93 | ADR-093 — **Valor Real vacío ⇒ en blanco** (J36 y su total), no `[PENDIENTE]` ni aviso | 3887 |
| §94 | ADR-094 — **Año de entrada con calendario de años** desde 2020 | 3922 |
| §95 | ADR-095 — **Beneficios de Mantenimiento** siguen a las prácticas marcadas, en breve | 3964 |
| §96 | ADR-096 — **Mantenimiento sin casillas pre-marcadas**: Beneficios vacío hasta escoger | 4014 |
| §97 | ADR-097 — **Beneficios sin subtítulos y con términos técnicos** | 4032 |
| §98 | ADR-098 — **Firma estampada** de la sesión en su casilla (ficha y Excel) | 4046 |
| §99 | ADR-099 — **Firmas del equipo bajo custodia** | 4078 |
| §100 | ADR-100 — **Firmas en Firestore** (Storage daba 503) | 4169 |
| §101 | ADR-101 — **Firmas de tamaño parejo** | 4197 |
| §102 | ADR-102 — **Vista previa del Excel + PDF**; cinco firmas en pantalla | 4211 |
| §103 | ADR-103 — **Mantenimiento al PE.02081** | 4238 |
| §104 | ADR-104 — **Excel sin datos ocultos** | 4256 |
| §105 | ADR-105 — **Beneficios con las 13 acciones**; casilla que crece | 4285 |
| §106 | ADR-106 — **Zona del activo**, no el departamento | 4321 |
| §107 | ADR-107 — **«Salud y riesgo» al Excel** (sin Anexo AT); sin usuarios no hay casilla | 4335 |
| §108 | ADR-108 — **Siempre las cinco firmas** y folio al exportar | 4368 |
| §109 | ADR-109 — **Auditoría Nivel-2**: cola 15 ADRs atrás; candado asimétrico (M-07) | 4389 |
| §110 | ADR-110 — **Mantenimiento sin hoja Beneficios**; Futuro derecho | 4416 |

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
| 📄 Fichas · Excel PE.02081 · firmas · «Salud y riesgo» | `cola-fichas-tecnicas.md` + `20` fila Fichas + `99 §82-§110` + **L-103** |
| El "por qué" de una decisión / detalle de un § | Capa 1 → `99-HISTORIAL-ADR.md` |

> **Doctrinas** → always-on en `CLAUDE.md §3` (3.1 performance · 3.2 aditivo/API estable · 3.3 verifica · 3.4 IAP · 3.5 observers).
