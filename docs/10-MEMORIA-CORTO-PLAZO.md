# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo neuronal: Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`,
> es de las primeras lecturas de cada sesión (Ignorancia Selectiva, `CLAUDE.md §G`).
> SOLO lo vivo: foco actual, pendientes abiertos, bitácora. Estado técnico → `05`.
>
> **Es la pizarra, no el archivo.** Al cerrar una tarea: consolidar a ADR (`99`) +
> fila en `00-INDICE`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).
>
> **Convención de handoff (relevo a ventana nueva)**: el "Foco actual" debe incluir
> **🚫 Callejones sin salida** — qué se probó que FALLÓ y NO reintentar, con el porqué.
> Le ahorra al próximo "tú" repetir errores ya descartados (relevo curado > `/compact`).

---

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-07)

> **TEMA: Tablero de Pruebas Eléctricas con IA — "ir MÁS ALLÁ del informe".**
> **Arco COMPLETO consolidado en ADR-003→ADR-009 y EN PRODUCCIÓN** (`origin/main=7f2b61b`, PR #128;
> `origin/DESARROLLO=f2533da=HEAD`, en sync). Detalle: `00`→`99 §3..§9`.
>
> **Qué hay hoy (todo en prod):** la IA (Opus 4.7) extrae EXCELENTE; tablero **IA-primaria** (bloques =
> cuerpo, scorecard derivado). **Completitud DETERMINISTA** (ADR-009): `derivarTablaTAP` arma la tabla por
> TAP desde las series + Desviación/Evaluación derivadas en cliente; la IA aporta lo único-del-PDF por el
> **canal `extra`** (Potencia/Tensión/Relación teórica/%DIF/R.Ref — **VERIFICADO** por el auditor). Excitación
> con Potencia graficada + desviación ÷mayor; relación con desviación = %DIF (vs placa); **aislamiento conforme
> a NETA por clase** (110 kV→30 GΩ → los 5–6 GΩ medidos = "pobre"). Subtítulos por gráfica + criterios con
> fórmula. **Pestaña Tendencia (F1)** + **Biblioteca como HUB** (informes + PDF + accesos Tablero/Tendencia).
> **Workflow de auditoría por sección**: `scripts/audit-bloques-pruebas.mjs` + hoja `workflow-auditoria-secciones-pruebas.md`.
>
> **PRÓXIMO:** **Veredicto 100% NORMATIVO completo → ADR-011 (`99 §11`, L-36)**: scorecard/KPI/matriz/tendencia +
> **badges por bloque** derivan del VALOR vs norma (no del texto IA); aislamiento NETA por clase + **resistencia ≤2%
> (NETA §7.2.2.D.8, vía skill)** en el dominio; `conCriterios` sobrescribe el `limite_desbalance` de la IA; +gráfica de
> desviación general en resistencia. Decisiones del director RESUELTAS (resistencia 2% / relación por-valor / badges
> normativos). Sin commitear aún (commits locales `5d2cdfd` + este). ⚠️ MO.00418 por clase sigue `verificar` (TODO-08).
> Luego: validar más secciones con informes reales; TODO-01/02 abiertos.
>
> **MAPA DE ARCHIVOS CLAVE**: Funciones IA `functions/index.js#extraerPruebasElectricasIA` (extracción, canal `extra`)
> + `#narrativaTendenciaIA` (F3, narrativa sin PDF) · Render genérico `assets/js/ui/pruebas/grafico-generico.js` ·
> Dominio bloques `…/pruebas_electricas_bloques.js` (`derivarTablaTAP`/`extra`) · Tendencia `…/pruebas_electricas_tendencia.js`
> (`bloquesTendencia`/`resumenTendenciaParaIA`) · Semáforo `ui/pruebas/semaforo.js` (`estadoInforme`/`lineaTiempoInformes`) ·
> Schema `…_schema.js` (`CRITERIOS_NORMA`/`NETA_IR_MIN_GOHM`) · Capa datos `data/pruebas_electricas.js` (`narrarTendencia`) ·
> Shell `pruebas-electricas-shell.js` (`renderTendenciaUI`/`timelineHtml`/`onGenerarNarrativa`/`narrativaCache`) ·
> Página `pages/pruebas-electricas.html` · CSS `…/pruebas-electricas.css` · Auditor `scripts/audit-bloques-pruebas.mjs`. Ref local gitignored: `450108/`.
>
> **Flujo git (ADR-005)**: Claude commitea + deploya; el director pushea/mergea. Claude NUNCA force-push a `main`.
>
> **🚫 Callejones sin salida (curados)**: (1) push del runtime da 403 → solo el director pushea (L-01).
> (2) `httpsCallable` default 70s → `timeout` explícito cliente+server (L-27). (3) Storage NO se LEE del browser
> sin CORS → datos legibles a **Firestore** (L-29). (4) Firestore prohíbe arrays anidados → string JSON (L-30).
> (5) UI gated por rol → re-render en `sgm:session-ready` (L-28). (6) clave `prueba` de la IA NO estable
> (tand↔tan_delta) → **aliasear** (L-31). (7) el LLM OMITE estructura redundante (tabla ancha) aunque insistas →
> derivar en cliente + `extra` inline (L-32/L-33). (8) NO graficar toda clave `extra` (duplica/ensucia: R.Ref≈R)
> → curar (L-34). (9) desviación NO genérica: excitación ÷ lateral mayor, relación = %DIF (vs placa), resistencia
> vs promedio. (10) aislamiento NO es ≥1 GΩ genérico → mínimo NETA por clase de tensión.

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (script `scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |
| **TODO-08** | Skills `pruebas-electricas`: **13/13 creadas** (patrón 4 neuronas + 3 marcos compartidos). Falta: director **valida** + **confirma los valores `⚠️ verificar`** (lobe 49 §Valores a verificar) contra su edición de norma → fijar en `03-…` + schema del tablero; ingerir más normas. | 🔄 en validación | director valida + entrega docs/edición de norma |

> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05/06** → ADR-008 · **TODO-07** (arco del tablero: completitud determinista, workflow de auditoría, excitación/relación/aislamiento, tendencia F1, biblioteca-hub) → **ADR-009** (EN PRODUCCIÓN, PR #128).

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. Modo "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas §0.1.2.* condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.

## 📝 Bitácora (efímera)

- **2026-06-08** — **Fix robustez Firestore (L-38).** El director reportó error rojo en consola al cargar informes (`WebChannel RPC 'Listen' transport errored 400`). Diagnóstico: los informes 450108 (2021+2023) SÍ cargaron (libros visibles); el error es del transporte streaming de Firestore en redes/proxies. Fix: `firebase-init.js#getDbSafe` → `initializeFirestore(app, {experimentalAutoDetectLongPolling:true})` (memoizado + fallback). 1059/1059 verde. Sin commitear. **Nota para el director (config, no código)**: aviso "domain not authorized for OAuth" = agregar `powertransformersmj.github.io` en Firebase console → Auth → Settings → Authorized domains (solo afecta login Google/popup; email/password OK).
- **2026-06-07** — **Capa de DIAGNÓSTICO / recomendaciones (extiende ADR-012).** A pedido del director: todas las pruebas se diagnostican conforme a la skill y, donde no hay veredicto definitivo, se deja una SUGERENCIA para investigar/determinar el estado. Nuevo `pruebas_electricas_recomendaciones.js` (`recomendarPrueba` por familia × nivel aprueba/investigar/rechaza/faltante, con correlaciones cruzadas + principio "1 hallazgo=investigar, 2 convergentes=diagnóstico" + intervalos; fallback genérico). Render "Recomendación" en el panel multi-norma de cada bloque (prefijo de divergencia). +7 tests. **1059/1059 verde.** Sin commitear.
- **2026-06-07** — **Evaluación MULTI-NORMA → ADR-012 (`99 §12`) + L-37.** Aclaración del director: NETA NO es la definitiva; mostrar el veredicto bajo CADA norma + consolidado conservador + divergencias (marco de la skill `marco-normativo-multinorma.md`). Motor de dominio `pruebas_electricas_multinorma.js` (`CRITERIOS_MULTINORMA`/`evaluarMultiNorma`/`metricaPrueba`) = fuente única: `calificarPrueba` delega al consolidado (scorecard/KPI/matriz/timeline coherentes); panel "Evaluación multi-norma" por bloque (`panelMultiNorma`) + badge=consolidado. Caso testigo aislamiento 110 kV (pasa piso NETA 5 GΩ / falla por clase 30 GΩ). Efecto: tan δ 0.5–0.7 ahora "investigar" por NETA 100.3. Gotcha corregido: no filtrar `ctx` como 2º arg de `calificarResistencia` (→flag). **1052/1052 verde + lint.** Sin commitear. ⚠️ por-clase MO.00418/PI-DAR/C1 siguen `verificar` (TODO-08).
- **2026-06-07** — **ADR-011 completado: las 3 decisiones del director RESUELTAS** (misma sesión). (1) **resistencia ≤2%** (apoyo skill `resistencia-devanados/03`: NETA §7.2.2.D.8; precedencia fábrica>MO.00418>NETA) — fijado en UMBRAL_DESBALANCE/CRITERIOS/CRITERIOS_NORMA/UMBRALES (5→2) + `conCriterios` SOBRESCRIBE el `limite_desbalance` de la IA (emitía 5). (2) **relación por-valor** (1.26%→fuera de norma; el flag `verificar` NO degrada). (3) **badges por bloque NORMATIVOS** (`calificarBloque`/`badgeBloque` en grafico-generico; aislamiento NETA, FP/bujes bandas IEEE 62, collar mW, curvas desbalance). Tests resistencia migrados 5→2%. **1040/1040 verde + lint.** Sin commitear.
- **2026-06-07** — **Veredicto 100% NORMATIVO → ADR-011 (`99 §11`) + L-36.** A pedido del director (todo criterio basado en normas, independiente de la calif del informe) + su confirmación visual (PDF tablero) + extracción real JSON-3 (450108). `renderScorecard` ya NO lee `b.calif` de la IA: deriva de `calificarPrueba(valor vs norma)` + bujes desde tan δ medido; aislamiento **NETA por clase unificado en el dominio** (`opts.minNeta` en calificarPrueba/estadoInforme/estadoVigente/lineaTiempoInformes/renderMatriz) → scorecard/KPI/matriz/timeline coherentes (resuelta la contradicción KPI rojo vs scorecard verde). +`bloqueDesviacionGeneral` (curva única desbalance máx entre fases por TAP + criterio) en resistencia. Eliminado `estadoDeCalif`. **1040/1040 verde + lint.** Sin commitear. **DECISIONES del director**: resistencia 2% NETA D.8 vs 5% código; relación `verificar`→¿AMBAR?; badges por bloque ¿recomputar?
- **2026-06-07** — **Skills `pruebas-electricas` — LAS 13 COMPLETAS.** Replicado el patrón enriquecido a las 12 restantes vía **4 agentes en paralelo** (grupos: electromagnético / FP-dieléctrico / mecánico-impedancia / química-aceite). +3er marco compartido `_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto→acción preventiva/correctiva + urgencia criticidad×severidad + intervalo de re-ensayo CBM/PdM). Total **65 .md** (13×5). Verificado: 13 carpetas ×5 archivos, `name`=carpeta, 0 links rotos, wiring de los 3 marcos en cada skill (03→multinorma, 04→integrado+predictivo), sin `.DS_Store`. README a ✅; lobe 49 con tabla de skills + **lista consolidada de valores `⚠️ verificar`** para el director (criterios por clase MO.00418, ppm percentil C57.104-2019, bandas SFRA, etc.). brain:check SANO. Sin commit aún. **PRÓXIMO**: director valida + confirma los valores `verificar` contra su edición de norma → fijarlos en `03-…` + schema del tablero.
- **2026-06-07** — **Skills `pruebas-electricas` — capa MULTI-NORMA + diagnóstico integrado** (a pedido del director: el patrón de 4 neuronas no bastaba para criterio robusto). +2 neuronas compartidas: `_conocimiento/marco-normativo-multinorma.md` (evaluar con varias normas a la vez: NETA/IEEE C57.152/IEC/interno/fábrica + precedencia + reconciliación = peor verdicto + mostrar divergencias) y `diagnostico-integrado-bateria.md` (convergencia cross-test: no condenar con 1 prueba). Ejemplar `resistencia-aislamiento` migrada a salida multi-norma (03/04/SKILL.md). **Accuracy grabada**: IEC 60076-3 NO da umbrales de IR (es withstand/PD); escala PI 2–4 viene de IEEE 43 (rotativas, excluye tx) → apoyo por analogía, criterio duro NETA PI≥1.0 + C57.152 PI≥1.5. El 110kV→30GΩ ahora se reporta junto al piso NETA 5GΩ (ambas ópticas). Lobe 49 + README actualizados. brain:check SANO. Sin commit aún.
- **2026-06-07** — **Iniciativa Skills `pruebas-electricas` (scaffold + ejemplar).** Creada carpeta `skills/pruebas-electricas/` vía `skill-creator`: README maestro (13 skills ↔ batería NETA 7.2.2) + `_conocimiento/` compartido (backbone 7.2.2 + tablas 100.1/100.3/100.4/100.5/100.14 literales) + **skill ejemplar COMPLETA `resistencia-aislamiento`** (SKILL.md + 4 neuronas teoría/cálculos/criterios/diagnóstico, base NETA ATS-2025 §7.2.2 + IEEE C57.152, web research PI/DAR). Lóbulo de dominio nuevo **`49-PRUEBAS-ELECTRICAS`** (registrado en `40` registry + `00` routing + `skills-inventory`). ⚠️ `110 kV→30 GΩ` (NETA_IR_MIN_GOHM) **pendiente de verificar** vs edición de norma del director. **PRÓXIMO**: director valida la ejemplar → replicar patrón de 4 neuronas a las 12 restantes (TODO-08). .DS_Store removidos. Aún sin commit (director pushea).
- **2026-06-07** — **2 fixes de biblioteca (revisan ADR-009 §9.2):** (1) **click en libro YA NO salta al tablero** → despliega el hub "Libro abierto" (opciones Ver tablero/Ver tendencia) y hace scrollIntoView (`onClickParque`). El atajo serieInput+Enter sí sigue yendo al tablero (deliberado). (2) **Dedupe de serie**: `normalizarSerie` (dominio, sin espacios/guiones, mayúsculas; refactor de `confirmarSerie`) + en `storeReport` se reutiliza el libro existente cuya serie normalizada coincide → evita partir la tendencia por formato (`173523-15510` vs `17352315510`). Backward-compatible (NO cambia docId existente, solo compara). +5 tests `normalizarSerie`. **1036/1036 verde + lint.** ⚠️ Sin verificar en navegador. Pendiente commit+push (director). NO se auto-extrae la serie del PDF para auto-enrutar (mejora futura posible).
- **2026-06-07** — **Tendencia F2+F3 → consolidado en ADR-010 (`99 §10`)** + fila en `00` + L-35 en `30`. F2 (franja-timeline determinista, `estadoInforme`/`lineaTiempoInformes`) + F3 (narrativa por IA on-demand, CF `narrativaTendenciaIA` desplegada, sin PDF). **EN PRODUCCIÓN** (F2 PR #130, F3 PR #131, `main 75daf29`). 1031/1031 verde. ⚠️ Falta confirmación visual del director (UI gated). `10` podado, `05` al día, brain:check SANO.
- **2026-06-07** — Arco del tablero → ADR-009 (`99 §9`). EN PRODUCCIÓN (PR #129).
