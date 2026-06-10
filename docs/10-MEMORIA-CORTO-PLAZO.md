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
> **Arco tablero base (ADR-003→014) + arco panel tan δ (ADR-029→040) EN PRODUCCIÓN** (mergeado a `main`
> vía **PR #172**). **Arco panel CORRIENTE DE EXCITACIÓN (ADR-041) COMMITEADO en `DESARROLLO`, FALTA PUSH.**
> Detalle: `00`→`99 §29..§41`. ✅ Validado con workflow (`_dev/preview-*.html`) + datos REALES 450108;
> **pendiente validar en la APP** (la página vive tras Firebase Auth → el preview no entra; sólo harness).
>
> **ARCO EXCITACIÓN (ADR-041, FALTA PUSH) — `ui/pruebas/excitacion-panel.js` (espejo del tan δ):**
> 5 vistas (Δ por TAP / patrón 2+1 / tendencia / por nivel / **tabla mA·W·ambos**) + filtros (año/grupo/**nivel**/fase).
> **Discrimina por NIVEL DE TENSIÓN** (`nivelDe`: AT delta→66·estrella→110·MT 34.5·BT 13.8; el "10 kV" = tensión de
> ENSAYO, no el nivel). **W de pérdidas** incluidos (`perdidasDe` lee `extra["P (W)"]`; tabla con sub-toggle mA/W/ambos
> + Σ pérd. por TAP; informes sin W → "—"+badge, NO inventa; tendencia de pérdidas NO compara contra 0). Criterio
> COMPARATIVO conforme a norma (NETA 2+1 / IEEE 62; sin umbral % duro; pérdidas = componente resistiva sin umbral propio).
> **Patrón 2+1 = FORMA** (externas A–C simétricas + central distinta); dirección HLH/LHL **informativa** — la central B es la
> MENOR en estrella Y delta por GEOMETRÍA del núcleo (verificado 7 tríos 450108; **L-53**). 19 tests; suite **1179/1179**.
> ⚠️ Umbrales Δ 5–10% a verificar con el director. ⛔ NO dañar scorecard/calificación global/`grafico-generico.js`.
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
> **🎯 "Reprocesar" RETIRADO (ADR-020, en prod):** ⛔ NO re-introducir sin pedido explícito (cuesta más que re-subir el PDF).
> Re-extraer = volver a subir el PDF (upsert por fecha, L-39); refrescar canónicos = backfill sin IA (L-43). Robustez de
> transporte + `effort:high` se conservan para la CARGA (informes densos, 12–22 min). Detalle → `99 §20`.
>
> **ARCO PANEL tan δ (ADR-029→040, EN PROD vía PR #172) — `ui/pruebas/tand-panel.js`** (detalle → `99 §29..§40` + lobe 49):
> panel condensado (Por devanado / Tendencia / Tip-up ΔFP) + "Análisis conforme a norma" (`analizarTand`, sellos NETA+IEEE) +
> overlay genérico "Demás pruebas" RETIRADO (`excluidaDelOverlay`, reversible) + auditoría FP CERRADA (tip-up/localización/
> pendiente/baseline + caveat 20 °C; #3 capacitancia descartada por artefacto, L-52). ⚠️ Umbrales `TIPUP 0.1`/`PEND 0.05` a
> verificar. **El panel excitación (ADR-041) sigue el MISMO molde** — al iterar uno, revisar el otro. ⛔ NO dañar scorecard/`grafico-generico.js`.
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

- **2026-06-10** — **Sesión panel CORRIENTE DE EXCITACIÓN (ADR-041) — COMMITEADA en `DESARROLLO`, FALTA PUSH.**
  Panel propio espejo del tan δ: discriminación por nivel de tensión (`nivelDe`), 5 vistas (Δ por TAP / patrón 2+1 /
  tendencia / por nivel / tabla mA·W·ambos), **W de pérdidas** incluidos (`perdidasDe`), criterio comparativo conforme a
  norma (skill `corriente-excitacion`). Hallazgo **L-53**: patrón 2+1 = FORMA, dirección HLH/LHL informativa (central B
  menor en estrella Y delta por geometría del núcleo; la regla rígida daba 4/7 falsas alarmas). 19 tests; **1179/1179**.
  **CABLEADO al shell HECHO** (`pruebas-electricas-shell.js`: `esExc`/`excItems` espejo de tan δ + montaje tras el panel
  tan δ; `node --check` OK). Validado con workflow; **falta validar en la APP** (tras Auth, el preview no entra).
- **2026-06-09** — **Sesión panel tan δ + auditoría FP (ADR-029→040) — PUSHEADA + MERGEADA a `main` (PR #172).** Panel
  tan δ condensado (3 vistas + análisis multi-norma con sellos), overlay genérico "Demás pruebas" retirado (reversible),
  corregido **sobre-retiro** (ADR-036, **L-51** + memoria `feedback_no_sobre_retiro`), reubicada "Identidad", y CERRADA la
  auditoría FP/tan δ (tip-up/localización/pendiente/baseline + caveat 20 °C; **#3 capacitancia descartada por artefacto
  −91%, L-52**). Validado con workflow + datos reales; **falta validar en la APP**. Tests 1160/1160.
- **2026-06-07/09** — Skills `transformadores-potencia` (EQUIPO) **11/11 + lóbulo 50** (detalle → `50`). ⚠️ Tablas EG
  [ILEGIBLES] + valores `⚠️ verificar` pendientes del director. 🔲 **PENDIENTE: commit de `skills/transformadores-potencia/`**
  + validación de arquitectura (TODO-10).
- **2026-06-08** — Arco tablero pruebas-eléctricas **consolidado en `99` (ADR-010→027) + lecciones L-35..L-50** (TODO en prod
  salvo el multi-año). 🚫 **NO romper la calificación global por prueba** (`feedback_calificacion_global_por_prueba`); preview UI L-49.
