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
> 1. ✅ **CERRADO (TODO-09 → ADR-015..018)**: "Reprocesar" funcional. Reintento (ADR-015) + asíncrono observable/estado
>    durable (ADR-016) + timeout interno por intento/watchdog/2GiB (ADR-017) + **fix "terminated" = bodyTimeout de undici,
>    dispatcher sin bodyTimeout** (ADR-018). Solo falla por causa ajena (sin saldo, PDF ilegible, infra) con motivo claro.
> 2. **⚠️ verificar (TODO-08)**: umbrales por clase **MO.00418** (resistencia/aislamiento/relación), banda **C1 de
>    bujes**, **PI/DAR** — entran como una óptica más cuando el director pase su edición de norma / los informes traigan PI/DAR.
> 3. Validar más secciones con informes reales (libro 450108 en validación). **TODO-01/02** abiertos (refrigeración/contratos).
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
> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05/06** → ADR-008 · **TODO-07** → ADR-009 · **TODO-09** → ADR-015 (reintento IA en "Reprocesar").

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en `v2.0.0`; ahora "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.
- **Nota config (no código)**: aviso "domain not authorized for OAuth" → agregar `powertransformersmj.github.io` en
  Firebase console → Auth → Settings → Authorized domains (solo afecta login Google/popup; email/password OK).

## 📝 Bitácora (efímera)

- **2026-06-08** — **ADR-022 (P1+Tendencia) + ADR-024 (multi-año), pedido del director (frontend; valida en navegador)**:
  (P1) **calificación global muestra TODAS las pruebas** — el scorecard ocultaba las sin dato → el FP de bujes "desaparecía";
  ahora lista todas, "No realizada" donde falta, FP bujes separado, +collar. **Motor del veredicto INTACTO.** (Tendencia)
  `accionPrueba` clasifica predictiva/preventiva/correctiva/diagnóstica + resalta relevantes. **(Tablero MULTI-AÑO, ADR-024 —
  corrige la mala interpretación de barras de ADR-023)**: por PRUEBA, una gráfica con una LÍNEA por AÑO superpuestas + **chips de
  año por prueba** (`bloquesMultiAno` dominio + `montarMultiAno` shell). **Validado con WORKFLOW DE PREVIEW** (`scripts/dev-server.mjs`
  + `.claude/launch.json` + `_dev/preview-multiano.html` + Claude Preview MCP) — atrapó que la leyenda SVG no filtraba (L-49).
  1110/1110 verde. 🚫 **NO romper la calificación global** (memoria `feedback_calificacion_global_por_prueba.md`).
  ⚙️ **Preview workflow disponible** para validar UI: `preview_start name:static` → `preview_eval`/`preview_screenshot` (L-49).
- **2026-06-08** — **ADR-020 RETIRO de "Reprocesar"** (costo > valor; re-extraer = re-subir): se quitó el botón + handler +
  el modo-reproceso de la CF (queda **solo-CARGA**) + **ADR-021 previsualización al colisionar por fecha** (modal
  `confirmarUpsert`: "ya guardado" vs "nuevo" + abrir PDF → reemplazar/crear-nuevo, no un `confirm` ciego). 1099/1099 verde.
  **CF DESPLEGADA** (solo-CARGA). ⚠️ El director valida el modal en navegador. Frontend a prod tras push.
- **Arco "Reprocesar" (HISTÓRICO — retirado en ADR-020; en `99`)**: la robustez de transporte que dejó —reintento con
  presupuesto (L-44/L-48), timeout interno abortable (L-46), dispatcher undici sin bodyTimeout/"terminated" (L-47)— **se
  conserva para la CARGA**. ADR-015→019 cuentan la secuencia de causas reales (cuelgue→terminated→504) por si reaparecen en carga.
- Anterior (consolidado en `99`): arco tablero **ADR-010→ADR-014 + L-35..L-43** TODO EN PRODUCCIÓN (Tendencia F2/F3,
  veredicto MULTI-NORMA, bujes canónico, identidad por informe/trafo móvil, long-polling, upsert, reproceso server-side, backfill).
