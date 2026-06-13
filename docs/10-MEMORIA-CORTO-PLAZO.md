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

## 🎯 Foco actual — HANDOFF (sesión 2026-06-11/12)

> **MÁS RECIENTE (ADR-047, commit `f472c8e`, FALTA PUSH+PR):** BUG de producción — el acordeón "Valores por prueba"
> de excitación mostraba **solo AT·110** (faltaban AT·66/MT·34.5) aunque las gráficas sí los mostraban. Causa (L-55 p2):
> `cardResumen` (`tablas-pruebas-panel.js`) aplicaba `filas[0].mode` a todas las filas → un nivel con informe modo 'items'
> (fase con TAP faltante) hacía `faseNames.forEach` sobre null → TypeError corta el render tras el 1.er acordeón. **REPRODUCIDO
> en navegador** antes de tocar (§3.3). Fix: layout **por-fila** + guards de null + **try/catch por nivel**. ⚠️ El preview con
> fixtures LIMPIOS NO reproducía el bug — los datos reales imperfectos sí (L-56). 1185/1185.
>
> **ANTES (ADR-046, commit `6148710`, FALTA PUSH+PR):** excitación — cada NIVEL se ve **barras (valores) → curvas (desviación)**; la **tabla desplegable única** (con veredicto) vive en el acordeón "Valores por prueba" (panel B `pe-vp-acc`). Se retiraron del panel de gráficas la pestaña "Tabla de valores" (FUSIÓN ADR-043) + toggle "Magnitud" = info REPETIDA. **L-56** (preview debe ejecutar módulo REAL + `.pe-scope` + composición del shell, si no es engañoso — origen de varios días perdidos). Nuevo `_dev/preview-excitacion-fiel.html`. ⚠️ **Código muerto pendiente de poda** (FUSIÓN inalcanzable: `modo==='tabla'`/`pintarTablas`/`tablaFusion`/`tablaValores`/`agruparNiveles`/`magBar`). 1185/1185. 🔲 Falta validar en la APP real.

---

## 🎯 Contexto del tablero (consolidado — detalle en `99 §3..§47` + lobe 49)

> **TODO el tablero de Pruebas Eléctricas con IA está EN PRODUCCIÓN** salvo ADR-046/047 (commiteados, FALTA PUSH+PR).
> Arcos: base ADR-003→014 · panel tan δ ADR-029→040 (PR #172) · corriente de excitación ADR-041→043 (PR #173/#176/#177) ·
> panel "Valores por prueba" ADR-044/045 · ADR-046 (orden por nivel + retira tablas repetidas) · ADR-047 (fix modo-mixto).
> **🔲 PENDIENTE TRANSVERSAL: validar en la APP REAL** (vive tras Firebase Auth → el preview fiel es lo más cercano).
>
> **Qué hace HOY:** IA extrae el PDF → tablero **IA-primaria**; **VEREDICTO 100% NORMATIVO** (VALOR vs norma, nunca texto IA,
> L-36) vía motor **MULTI-NORMA** `pruebas_electricas_multinorma.js` (por norma + consolidado conservador + divergencias) +
> capa **recomendaciones** (ADR-012). Fuente única `calificarPrueba` → scorecard/KPI/matriz/timeline. FP bujes CANÓNICO (ADR-013) ·
> identidad/placa CONGELADA por informe → aislamiento NETA por clase del ensayo (ADR-014) · tablas SIN col."OK" (L-42) ·
> upsert por fecha (L-39) · backfill server-side (L-40/43). **"Reprocesar" RETIRADO (ADR-020)** ⛔ NO re-introducir.
> Excitación y tan δ siguen el MISMO molde — al iterar uno, revisar el otro. ⛔ NO dañar scorecard/`grafico-generico.js`.
> ⚠️ Umbrales a verificar con el director: Δ excitación 5–10%, `TIPUP 0.1`/`PEND 0.05`, MO.00418/C1 bujes/PI-DAR (TODO-08).
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

- **2026-06-12** — **ADR-046 + ADR-047 (excitación) commiteados, FALTA PUSH+PR.** ADR-046: orden por nivel (barras→curvas) +
  retira tablas repetidas del panel de gráficas (FUSIÓN + Magnitud) → tabla única en el acordeón. ADR-047: **fix de bug de
  producción** — el acordeón mostraba solo AT·110 por un nivel modo-mixto que reventaba `cardResumen` (L-55 p2); **reproducido
  en navegador** + fix layout por-fila + try/catch por nivel. Lecciones **L-56** (preview fiel) y refuerzo **L-55**.
  Commits `6148710` (ADR-046), `cfe7958`+ (cerebro), `f472c8e` (ADR-047). 1185/1185. 🔲 Validar en la APP real.
- **2026-06-10** — Panel "Valores por prueba" (ADR-044/045 → `99 §44-45`) + arco excitación (ADR-041→043) y tan δ (ADR-029→040)
  **EN PRODUCCIÓN**. Lecciones clave: **L-55** (reusar dominio · criterio por tipo · 10kV≠110kV) · L-53/L-54 · L-51/L-52.
- **2026-06-07/09** — Skills `transformadores-potencia` (EQUIPO) **11/11 + lóbulo 50** (detalle → `50`). ⚠️ Tablas EG
  [ILEGIBLES] + valores `⚠️ verificar` pendientes del director. 🔲 **PENDIENTE: commit de `skills/transformadores-potencia/`**
  + validación de arquitectura (TODO-10).
