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
> **🎯 DECISIÓN DEL DIRECTOR (2026-06-08): "Reprocesar" = OPCIÓN A · MÁXIMA CALIDAD.** Ante el trade-off
> velocidad↔completitud, eligió EXPLÍCITAMENTE conservar `output_config.effort:'high'` + `thinking:adaptive` (Opus 4.7):
> el reproceso de un informe DENSO (p.ej. EMS 450108) tarda **~7–12 min** pero extrae COMPLETO. ⛔ **NO bajar el effort
> ni cambiar a un modelo más rápido para acelerar** — es una elección deliberada (son datos de ingeniería de transformador).
> El estado terminal está garantizado (ADR-017) y el badge es durable/no bloqueante (ADR-016): el director puede navegar y
> volver. La lentitud es ESPERADA, no un bug.
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

- **2026-06-08** — **ADR-019 · 504/deadline-exceeded** (causa real, vista en consola completa). DOBLE: (A) bug del presupuesto
  de reintento — el gate solo exigía sitio para el backoff, no para un intento ENTERO → tras abortar el 1.er intento largo
  arrancaba un 2.º que corría hasta el SIGKILL (900s) → 504; fix `intentoMaxMs`. (B) 900s insuficiente para máxima calidad →
  `timeoutSeconds 900→1500`, ATTEMPT_MS 22min, cliente 1500s, watchdog/SDK acordes. `effort:high` CONSERVADO. 1099/1099 verde
  (+2 tests del gate). **CF DESPLEGADA**. L-48. ⚠️ El director valida que el EMS ya NO da 504 y COMPLETA (12–22 min, esperado).
- **Arco "Reprocesar" (consolidado en `99`, todo desplegado; secuencia de causas REALES encontradas una a una)**:
  **ADR-015** reintento con backoff (L-44) · **ADR-016** asíncrono observable: persistencia server-side + estado durable
  `reproceso.{estado}` + badge en vivo (L-45, EN PROD) · **ADR-017** `await` desnudo sin timeout por intento → cuelgue →
  SIGKILL sin estado: `conTimeoutAbortable` + watchdog + 2GiB (L-46) · **ADR-018** "terminated" = bodyTimeout de undici (~5 min)
  corta el stream largo → dispatcher sin bodyTimeout (`undici@^6`), L-47. ADR-019 (arriba) cierra el 504.
- Anterior (consolidado en `99`): arco tablero **ADR-010→ADR-014 + L-35..L-43** TODO EN PRODUCCIÓN (Tendencia F2/F3,
  veredicto MULTI-NORMA, bujes canónico, identidad por informe/trafo móvil, long-polling, upsert, reproceso server-side, backfill).
