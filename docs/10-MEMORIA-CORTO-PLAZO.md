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

---

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-08)

> **TEMA: Tablero de Pruebas Eléctricas con IA — evaluación + diagnóstico MULTI-NORMA.**
> **Arco COMPLETO consolidado en ADR-003→ADR-014 y EN PRODUCCIÓN** (`origin/main=295de3e` merge PR #144,
> `origin/DESARROLLO=18566fa=HEAD`, en sync, nada pendiente de push). Detalle: `00`→`99 §3..§14`.
>
> **Qué hace el tablero HOY (todo en prod):** la IA (Opus 4.7/Sonnet 4.6) extrae el PDF →
> tablero **IA-primaria** (bloques = cuerpo; tablas = DATOS). **El VEREDICTO es 100% NORMATIVO**
> (del VALOR vs norma, NUNCA del texto de la IA, L-36): motor **MULTI-NORMA** `pruebas_electricas_multinorma.js`
> evalúa cada prueba contra CADA norma aplicable → panel "Evaluación multi-norma" por bloque
> (veredicto por norma + **consolidado conservador** + divergencias) + **capa de diagnóstico/recomendaciones**
> `pruebas_electricas_recomendaciones.js` (sugerencia accionable por prueba, ADR-012). Alimenta scorecard/KPI/
> matriz/timeline/badges (fuente única `calificarPrueba` → consolidado). **FP de bujes CANÓNICO** discriminado
> (ADR-013). **Identidad/placa CONGELADA por informe** → aislamiento NETA por la clase del PROPIO ensayo
> (trafo móvil doble config 63.5 kV/110 kV, ADR-014). **Tablas SIN columna "Evaluación/OK"** (strip por encabezado
> Y contenido, L-42). **Tendencia de alto nivel**: panel "Diagnóstico de la unidad" (veredicto vigente + tendencia
> ▲/▼ + recomendación) + franja-timeline (F2) + narrativa por IA on-demand (F3). **Biblioteca-hub**; **upsert por
> fecha** (re-cargar no duplica, L-39); **reproceso SERVER-SIDE** con contador (L-40) + **backfill INSTANTÁNEO**
> de campos canónicos desde el diagnóstico guardado, sin IA (L-43).
>
> **🎯 "Reprocesar" RETIRADO (ADR-020, 2026-06-08).** El director concluyó que reprocesar **sale más costoso que
> eliminar + re-subir el informe** (misma extracción IA, pero llamada larga y frágil a cortes de red). Se eliminó el botón
> + handler + el modo-reproceso de la CF. ⛔ **NO re-introducir "Reprocesar"** sin pedido explícito del director. Para
> re-extraer: **volver a subir el PDF** (upsert por fecha, L-39); para refrescar campos canónicos: **backfill sin IA** (L-43).
> La **máxima calidad** (`effort:high`) y toda la robustez de transporte (reintento/timeout/dispatcher undici) **se conservan
> para la CARGA** (que extrae los mismos informes densos, 12–22 min).
>
> **PRÓXIMO / pendientes:**
> 1. **⚠️ verificar (TODO-08)**: umbrales por clase **MO.00418** (resistencia/aislamiento/relación), banda **C1 de
>    bujes**, **PI/DAR** — entran como una óptica más cuando el director pase su edición de norma / los informes traigan PI/DAR.
> 2. Validar más secciones con informes reales (libro 450108 en validación). **TODO-01/02** abiertos (refrigeración/contratos).
> 3. ✅ **Arco MULTI-AÑO del tablero (ADR-024→028)**: superposición + filtro + fase (024/025); identidad por informe (026); TODA prueba
>    ELÉCTRICA con familia genérica + ACEITE/DGA excluido (027, L-50); **ADR-028 = TENDENCIA año a año**: 1 gráfica por SUB-PRUEBA (par de
>    devanados, no fusiona escalas Ω/mΩ ni AT/MT vs AT/BT), **TODOS los años por defecto**, orden cronológico + `etiquetaFecha` uniforme,
>    toggle "Solo último". **Validado con 5 informes REALES de la 450108** (PDFs del director → `_dev/fixtures/450108-*.json`, incl. tan δ
>    por sección). **Frontend, validado en preview; pendiente PUSH.** ⛔ NO dañar calificación global / criterios / gráficas de desviación
>    (`grafico-generico.js` intacto). Trafo MÓVIL cambia config/tensión por año (ADR-014) → keying por devanado, no por título.
> (Cerrado y consolidado: TODO-09 "Reprocesar" → ADR-015..018, luego RETIRADO en ADR-020.)
>
> **MAPA DE ARCHIVOS CLAVE**: Funciones IA `functions/index.js` (`extraerPruebasElectricasIA` — prompt SIN col.
> Evaluación; `narrativaTendenciaIA` F3) · Motor **multi-norma** `domain/pruebas_electricas_multinorma.js`
> (`evaluarMultiNorma`/`metricaPrueba`) · **recomendaciones** `domain/pruebas_electricas_recomendaciones.js` ·
> Tendencia `domain/pruebas_electricas_tendencia.js` (`analisisTendencia`/`bloquesTendencia`) · Bloques
> `domain/pruebas_electricas_bloques.js` (`derivarTablaTAP`/`quitarColumnasVeredicto`) · Schema `…_schema.js`
> (`sanitizarBushing`/`sanitizarIdentidad`/`NETA_IR_MIN_GOHM`/`minNetaGohm`/`kvAT`) · Semáforo `ui/pruebas/semaforo.js`
> (`calificarPrueba` delega + `minNetaDe`) · Render `ui/pruebas/grafico-generico.js` (`panelMultiNorma`/`badgeBloque`) ·
> Tabla `ui/pruebas/tabla-pruebas.js` (`esPendienteExtraccion`) · Shell `pruebas-electricas-shell.js`
> (`renderScorecard`/`diagnosticoUnidadHtml`/`storeReport` upsert/`backfillCanonicos`/`kvDeInforme`/reproceso) ·
> Capa datos `data/pruebas_electricas.js` (`narrarTendencia`/`eliminarPDF`/`listarInformes`) · `firebase-init.js`
> (Firestore `experimentalAutoDetectLongPolling`). Lóbulo dominio **`49-PRUEBAS-ELECTRICAS`** + skills `skills/pruebas-electricas/*` (13).
>
> **Flujo git (ADR-005)**: Claude commitea + deploya; el director pushea/mergea. Claude NUNCA force-push a `main`.
>
> **🚫 Callejones sin salida (curados)**: (1) push del runtime da 403 → solo el director pushea (L-01).
> (2) Storage NO se LEE del browser sin CORS → la CF lee el PDF server-side; el reproceso TAMBIÉN (L-29/L-40); datos a Firestore.
> (3) Firestore: arrays anidados prohibidos → string JSON (L-30); transport error 400 → auto-long-polling (L-38).
> (4) clave `prueba` de la IA NO estable → aliasear (L-31); el LLM omite tabla ancha → derivar en cliente + `extra` (L-32/L-33).
> (5) Veredicto NUNCA del texto IA, siempre VALOR vs norma multi-norma (L-36/L-37); ninguna columna "OK" en tablas (L-42).
> (6) Backfill de campos derivables: NO re-correr la IA (lenta), derivar de lo guardado (L-43). Reproceso IA = 2–5 min (Opus).
> (7) Aislamiento NO genérico ≥1 GΩ → mínimo NETA por CLASE; y por la clase del PROPIO informe (trafo móvil, ADR-014).
> (8) `calificarResistencia(v, ctx)`: el 2º arg es `flagVerificar` → al reusar como `evaluar`, envolver `(v)=>calificar(v)` (L-37).
> (9) Allowlists de strings frágiles (estado `extraido_ia`, columna `Resultado`) → detectar por prefijo/contenido (L-41/L-42).

---

## 📋 Pendientes abiertos (TODO-NN)

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |
| **TODO-08** | Skills `pruebas-electricas` (13/13). Falta: director **valida** + confirma los valores `⚠️ verificar` (lobe 49) contra su edición de norma (MO.00418 por clase, C1 bujes, PI/DAR) → fijarlos en el motor multi-norma. | 🔄 en validación | director entrega edición de norma |
| **TODO-10** | Skills `transformadores-potencia` (EQUIPO, lobe 50). Hoy: 1 ejemplar completa (`identificacion-tipo-transformador`, 4 neuronas) + scaffold (README + 3 marcos). **EG ingerido** (39 MB; Cap 6 protecciones/refrigeración plasmado en marco fundamentos §E; mapa de capítulos en lobe 50). Falta: director **valida** la arquitectura de 11 skills antes de replicar a las 10 restantes; lectura dirigida EG Cap 2.4.5/2.4.6 (cargabilidad IEEE C57.91); luego commit (Claude commitea, director pushea). | 🔄 ejemplar lista + EG ingerido, esperando validación | director valida arquitectura |
> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05/06** → ADR-008 · **TODO-07** → ADR-009 · **TODO-09** → ADR-015 (reintento IA en "Reprocesar").

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en `v2.0.0`; ahora "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.
- **Nota config (no código)**: aviso "domain not authorized for OAuth" → agregar `powertransformersmj.github.io` en
  Firebase console → Auth → Settings → Authorized domains (solo afecta login Google/popup; email/password OK).

## 📝 Bitácora (efímera)

- **2026-06-07** — **Nueva familia de skills `transformadores-potencia` (EQUIPO) + lóbulo 50** (pedido del director,
  vía `skill-creator`): conceptos/criterios/particularidades de tx de potencia para mejorar **cálculos** e
  **identificación de tipo** (bidevanado / bi+compensación / tridevanado / auto). Construido: **scaffold**
  (`skills/transformadores-potencia/README.md` + 3 marcos `_conocimiento/`: fundamentos, marco-normativo-tx,
  convenciones-calculo) + **skill ejemplar completa** `identificacion-tipo-transformador` (SKILL.md + 4 neuronas
  01-teoría/02-cálculos/03-criterios/04-diagnóstico). Base: **ABB Service Handbook** (legible) + investigación web
  (IEEE C57.158/.12.00/.90/.70, IEC 60076-1). ⚠️ **EG PDF 108.6 MB > límite 100 MB → bloqueado**, director debe
  partirlo. Registrado: lóbulo **`50-TRANSFORMADORES-POTENCIA`** + `40-LOBULOS` + `00-INDICE` + `skills-inventory`.
  **TODO-10** abierto: director valida arquitectura de 11 skills antes de replicar; luego commit (Claude commitea,
  director pushea). Frontera con lobe 49: 50=EQUIPO, 49=ENSAYOS (se cruzan, no se duplican).
- **2026-06-08** — Arco tablero pruebas-eléctricas **consolidado en `99` (ADR-010→ADR-027) + lecciones L-35..L-50**, TODO en
  prod salvo el multi-año (frontend, pendiente PUSH). Hitos: calificación global muestra TODAS las pruebas (FP bujes separado,
  motor del veredicto INTACTO); `accionPrueba` (predictiva/preventiva/correctiva/diagnóstica); tablero MULTI-AÑO por informe×fase
  (no por año) + filtro de año global; `proyectarTendencia` (años a cruzar el límite); RETIRO de "Reprocesar" (costo>valor, re-subir
  = re-extraer) dejando la CF **solo-CARGA** con su robustez de transporte; modal `confirmarUpsert` al colisionar por fecha.
  🚫 **NO romper la calificación global por prueba** (memoria `feedback_calificacion_global_por_prueba.md`). Preview UI: L-49.
