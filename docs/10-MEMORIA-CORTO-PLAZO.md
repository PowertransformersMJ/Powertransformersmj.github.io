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

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-10)

> **TEMA: Tablero de Pruebas Eléctricas con IA — paneles condensados por prueba (tan δ → excitación).**
> **Arco tablero base (ADR-003→014) + arco panel tan δ (ADR-029→040) EN PRODUCCIÓN** (PR #172).
> **Arco completo CORRIENTE DE EXCITACIÓN EN PRODUCCIÓN** (verificado `git fetch` 2026-06-10, `main`=`45ad218`):
> ADR-041 (panel `3ce25ae` + cableado `7bb8b38`, PR #173) · ADR-042 (vista "Resumen (todo)" + gating de tablas por
> año/nivel + fix `reset` L-54 + §42.8 separación por NIVEL) · ADR-043 (tabla-RESUMEN FUSIÓN 1+4: banda+KPI tiles+
> franja de norma+tabla por años con criterio; detalle por TAP gateado) → mergeados vía PR #176/**#177**.
> Detalle: `00`→`99 §29..§43`. ✅ Validado con workflow (`_dev/preview-*.html`) + datos REALES 450108.
> **🔲 ÚNICO PENDIENTE DEL ARCO: validar en la APP REAL** (la página vive tras Firebase Auth → el preview no entra; sólo harness).
>
> **ARCO EXCITACIÓN (ADR-041 → `99 §41` + lobe 49) — `ui/pruebas/excitacion-panel.js` + cableado en shell:**
> espejo del tan δ; discrimina por NIVEL DE TENSIÓN (`nivelDe`), 5 vistas + W de pérdidas (`perdidasDe`), criterio
> COMPARATIVO conforme a norma, patrón 2+1 = FORMA (central B menor por geometría, **L-53**). ⚠️ Umbrales Δ 5–10% a
> verificar con el director. ⛔ NO dañar scorecard/calificación global/`grafico-generico.js`. El panel sigue el MISMO molde del tan δ.
>
> **Qué hace el tablero HOY (todo en prod, detalle → `99 §3..§43` + lobe 49):** IA extrae el PDF → tablero **IA-primaria**;
> **VEREDICTO 100% NORMATIVO** (VALOR vs norma, nunca texto IA, L-36) vía motor **MULTI-NORMA** `pruebas_electricas_multinorma.js`
> (por norma + consolidado conservador + divergencias) + capa de **recomendaciones** (ADR-012). Fuente única `calificarPrueba` →
> scorecard/KPI/matriz/timeline. **FP bujes CANÓNICO** (ADR-013) · **identidad/placa CONGELADA por informe** → aislamiento NETA por
> clase del ensayo (ADR-014) · tablas SIN col. "Evaluación/OK" (L-42) · upsert por fecha (L-39) · reproceso+backfill server-side (L-40/43).
> **"Reprocesar" RETIRADO (ADR-020):** ⛔ NO re-introducir (re-extraer = re-subir el PDF).
>
> **ARCO PANEL tan δ (ADR-029→040, PR #172) — `ui/pruebas/tand-panel.js`** (detalle → `99 §29..§40` + lobe 49): panel condensado
> (Por devanado / Tendencia / Tip-up ΔFP) + análisis conforme a norma + auditoría FP CERRADA (L-52). ⚠️ Umbrales `TIPUP 0.1`/`PEND 0.05`
> a verificar. **Excitación sigue el MISMO molde** — al iterar uno, revisar el otro. ⛔ NO dañar scorecard/`grafico-generico.js`.
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

- **2026-06-10** — **Panel "Valores por prueba" PROMOVIDO A PRODUCCIÓN (ADR-044 → `99 §44`).** Origen: fichas `docs/pruebas/*.json`
  (10) + workflow iterado en `_dev/preview-panel-prueba*.html`. Módulo `ui/pruebas/tablas-pruebas-panel.js` (`montarPanelPrueba`):
  nombre de prueba + filtro de año; resumen = **rango REAL mín–máx + Σ pérdidas (W)**; un año = **tabla completa** (todos los TAP);
  **NIVEL real** (`nivelDe`, no la tensión de ensayo — bug 10kV→110kV corregido, **L-55.4**); **diagnóstico** (sellos NETA/IEEE +
  `evaluarMultiNorma`) + **análisis/acción CBM** (`accionPrueba`). Cableado ADITIVO en `montarMultiAno` (relación/resistencia/
  aislamiento/bujes/collar; tan δ/excitación intactos); CSS `pe-vp-*`; reusa dominio. Tests `tablas_pruebas_panel.test.js` (6).
  **1185/1185, lint 0.** Validado con harness del módulo de PRODUCCIÓN. 🔲 Falta validar en la APP + **commit (Claude) + push (director)**.
  **ADR-045**: ese panel pasó a **acordeón por NIVEL** (cada nivel desplegable) + **filtro de año POR NIVEL** (solo años de ese nivel) +
  **toque premium "prime"** (`pe-vp-acc-*`: gradiente header, KPI tiles, micro-interacciones transform/opacity) + **fix conformidad**
  (`tablaDetalleItems`→`quitarColumnasVeredicto`: bujes 2021 traía "Evaluación", L-42). Auditoría de extracción de los 6 informes: conforme,
  diferencias reales por placa/visita (2021 delta 2-dev sin MT; tan δ ausente 2024; exc 2024 sin W; DAR/C1-C2 variables). Shell sin cambio.
  Lección **L-55** (reusar dominio no reinventar · criterio por tipo · dedup · edité función equivocada entre duplicados · preview en raíz).
- **2026-06-10** — **Tabla-RESUMEN por nivel FUSIÓN 1+4 (ADR-043 → `99 §43`):** el director pidió 4 propuestas de tablas
  vía preview (por nivel · valores totales · criterio por norma) → módulo DEV `_dev/excitacion-tablas-opciones.js` +
  harness → eligió **fusionar opción 1 + 4**. Integrado en `excitacion-panel.js`: `agruparNiveles`/`tablaFusion` (banda +
  KPI tiles + franja NETA/IEEE + tabla por años con criterio), `pintarTablas` = fusión SIEMPRE + detalle por TAP gateado
  debajo (conservado); CSS `pe-fus-*`. Overflow de la col. criterio cerrado a 0 (chips de norma apilados + ancho/fuente).
  1179/1179, lint 0. **EN PRODUCCIÓN (PR #177)**. 🔲 Falta validar en la APP real.
- **2026-06-10** — **Arco CORRIENTE DE EXCITACIÓN MERGEADO a `main`** (ADR-041/042/043, PR #173/#176/#177). ADR-042:
  vista "Resumen (todo)" + gating de tablas (1 año/1 nivel) + fix `reset` (**L-54**) + §42.8 por NIVEL. **L-53** (patrón
  2+1 = FORMA, central B menor por geometría). 🔲 Único pendiente del arco: validar en la APP real.
- **2026-06-09** — **Panel tan δ + auditoría FP (ADR-029→040) — MERGEADO a `main` (PR #172).** Detalle en `99`; lecciones
  **L-51** (sobre-retiro) / **L-52** (capacitancia −91% = artefacto). Tests 1160/1160.
- **2026-06-07/09** — Skills `transformadores-potencia` (EQUIPO) **11/11 + lóbulo 50** (detalle → `50`). ⚠️ Tablas EG
  [ILEGIBLES] + valores `⚠️ verificar` pendientes del director. 🔲 **PENDIENTE: commit de `skills/transformadores-potencia/`**
  + validación de arquitectura (TODO-10).
