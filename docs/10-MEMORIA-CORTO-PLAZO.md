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

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-09)

> **TEMA: Tablero de Pruebas Eléctricas con IA — panel tan δ + auditoría FP/tan δ.**
> **Arco tablero base (ADR-003→014) EN PRODUCCIÓN.** **Esta sesión (ADR-029→040, 16 commits
> `d5d974e`→`e696af6` en rama dev) FALTA PUSH** (Claude commitea, el director pushea; refs locales
> STALE → `git fetch` antes de afirmar estado). Detalle: `00`→`99 §29..§40`. ✅ Validado todo con
> workflow (`_dev/preview-*.html`) + datos REALES 450108; **pendiente validar en la APP tras push**
> (la página vive tras Firebase Auth → el preview no entra; sólo harness).
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
> **ARCO DE ESTA SESIÓN (ADR-029→040, FALTA PUSH) — panel tan δ `ui/pruebas/tand-panel.js` + análisis:**
> - **Panel tan δ condensado** (ADR-029/031/032): vistas **Por devanado** (secciones en X, leyenda limpia por
>   informe, criterio NETA0.5%/IEEE1% visible) · **Tendencia** (años en X) · **Tip-up (ΔFP)**. Bloque **"Análisis
>   conforme a norma"** (`analizarTand`, puro/testeado): sellos/emblemas ESTILIZADOS propios (NETA+IEEE, NO logos
>   oficiales) + veredicto multi-norma + peor medición + localización + tip-up + pendiente + caveats.
> - **Overlay genérico "Demás pruebas" RETIRADO** (ADR-033/034) vía `excluidaDelOverlay` (familias + regla `^otros:`);
>   panel tan δ = única vista multi-año. Reversible; datos/motor intactos (scorecard evalúa todo).
> - **"Resultados del informe" CONSERVADA**; sólo se filtra el bloque tan δ del detalle por informe (ADR-036 corrige
>   el sobre-retiro de ADR-035 → **L-51**). **"Identidad de la unidad" reubicada** bajo "Resumen de la unidad" (ADR-037).
> - **Auditoría FP/tan δ 🔵 (skill `factor-potencia-aislamiento`) CERRADA** (ADR-038/039/040, lobe 49 §Auditoría):
>   #1 tip-up, #2 localización por modo (`localizacionDe`/`causaProbableDe`), #4 caveat 20 °C (sin T → se declara),
>   #5 pendiente predictiva por sección, #6 baseline-proxy. **#3 capacitancia DESCARTADA** (el workflow cazó −91% =
>   artefacto: pF no comparable entre esquemas/modos de medida → **L-52**; habilitarlo exige extracción POR MODO).
> - ⚠️ Umbrales `TIPUP_UMBRAL 0.1` / `PEND_UMBRAL 0.05` **a verificar** con el director. ⛔ NO dañar calificación
>   global / scorecard / `grafico-generico.js`. Trafo MÓVIL cambia config/tensión por despliegue (ADR-014).
>
> **OTROS pendientes:** TODO-08 (⚠️ verificar umbrales MO.00418/C1 bujes/PI-DAR) · TODO-01/02 (refrigeración/contratos)
> · TODO-10 (skills `transformadores-potencia` esperan validación + commit). #3 capacitancia → extracción por modo.
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
> **🚫 Callejones sin salida (curados, detalle en `30`)**: push runtime 403→solo director pushea (L-01) · Storage no se lee del
> browser sin CORS→CF server-side (L-29/L-40) · Firestore sin arrays anidados (L-30) + auto-long-polling (L-38) · clave IA no estable→aliasear
> (L-31), LLM omite tabla ancha→derivar+`extra` (L-32/L-33) · veredicto SIEMPRE valor vs norma, nunca texto IA, sin col."OK" (L-36/L-37/L-42) ·
> backfill derivable sin re-correr IA (L-43) · aislamiento por CLASE del propio informe (ADR-014) · allowlists frágiles→detectar por prefijo/contenido
> (L-41) · **borrar de menos > borrar de más** (L-51) · valor implausible=artefacto, no hallazgo (L-52).

---

## 📋 Pendientes abiertos (TODO-NN)

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |
| **TODO-08** | Skills `pruebas-electricas` (13/13). Falta: director **valida** + confirma los valores `⚠️ verificar` (lobe 49) contra su edición de norma (MO.00418 por clase, C1 bujes, PI/DAR) → fijarlos en el motor multi-norma. | 🔄 en validación | director entrega edición de norma |
| **TODO-10** | Skills `transformadores-potencia` (EQUIPO, lobe 50). Hoy: 1 ejemplar completa (`identificacion-tipo-transformador`, 4 neuronas) + scaffold (README + 3 marcos). **EG + ABB leídos completos** (subagentes); tipificación ABB (excitación/5-limb/6-cap) integrada en la ejemplar (`01 §B`, `03 §E`); resto EG destilado en lobe 50 (papel/cargabilidad → `gestion-vida-activo`; aceite/DGA → lobe 49). Falta: director **valida** arquitectura de 11 skills antes de replicar a las 10 restantes; luego commit (Claude commitea, director pushea). ⚠️ tablas EG [ILEGIBLES] (Transequipos + C57.104) `⚠️ verificar`. | 🔄 ejemplar reforzada, esperando validación | director valida arquitectura |
> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05/06** → ADR-008 · **TODO-07** → ADR-009 · **TODO-09** → ADR-015 (reintento IA en "Reprocesar").

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en `v2.0.0`; ahora "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.
- **Nota config (no código)**: aviso "domain not authorized for OAuth" → agregar `powertransformersmj.github.io` en
  Firebase console → Auth → Settings → Authorized domains (solo afecta login Google/popup; email/password OK).

## 📝 Bitácora (efímera)

- **2026-06-09** — **Sesión panel tan δ + auditoría FP (ADR-029→040, 16 commits en dev, FALTA PUSH).** Construido el
  panel tan δ condensado (3 vistas + análisis multi-norma con sellos), retirado el overlay genérico "Demás pruebas"
  (reversible), corregido un **sobre-retiro** (oculté toda "Resultados del informe" cuando el director solo pedía el
  bloque tan δ → ADR-036, **L-51 + memoria `feedback_no_sobre_retiro`**), reubicada "Identidad", y CERRADA la
  auditoría FP/tan δ con la skill (tip-up/localización/pendiente/baseline + caveat 20 °C; **#3 capacitancia descartada
  por artefacto −91%, L-52**). Todo validado con workflow + datos reales; falta validar en la APP tras push. Tests 1160/1160.
- **2026-06-07/09** — Skills `transformadores-potencia` (EQUIPO) **11/11 + lóbulo 50** (detalle → `50`). ⚠️ Tablas EG
  [ILEGIBLES] + valores `⚠️ verificar` pendientes del director. 🔲 **PENDIENTE: commit de `skills/transformadores-potencia/`**
  + validación de arquitectura (TODO-10).
- **2026-06-08** — Arco tablero pruebas-eléctricas **consolidado en `99` (ADR-010→027) + lecciones L-35..L-50** (TODO en prod
  salvo el multi-año). 🚫 **NO romper la calificación global por prueba** (`feedback_calificacion_global_por_prueba`); preview UI L-49.
