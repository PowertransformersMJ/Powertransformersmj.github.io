# 🩺 05 — ESTADO GLOBAL (Heartbeat · Snapshot de salud del sistema)

> **Nodo neuronal: signos vitales.** Se **AUTO-CARGA** (junto a `CLAUDE.md` +
> `10-CORTO-PLAZO`). Responde *"¿en qué estado está el sistema AHORA, antes de
> tocar nada?"*. Lo lee el **Reflejo de Auto-auditoría (`CLAUDE.md §G.4`)** al arrancar.
>
> **Mantenimiento (Reflejo de Frescura §G.4)**: actualizar al cambiar versión,
> branch, build o al detectar/resolver un riesgo. **Tope ~25 líneas (§G.5)** — es un
> tablero, no una bitácora.

| Señal | Valor |
|---|---|
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) **1091/1091 verde** (2026-06-08, +"Reprocesar" asíncrono observable: persistencia server-side + estado durable, ADR-016). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA: tablero **IA-primaria**, **veredicto 100% MULTI-NORMA** (valor vs cada norma + consolidado + recomendación, NUNCA texto IA). **Arco ADR-003→014 EN PRODUCCIÓN**: extracción IA + canal `extra`, multi-norma + diagnóstico, **bujes canónico**, **identidad/placa por informe** (trafo móvil doble config → aislamiento por clase del propio ensayo), tablas SIN col. "Evaluación/OK", **Tendencia alto nivel** (diagnóstico unidad + timeline + narrativa IA), biblioteca-hub, upsert por fecha, reproceso server-side + backfill instantáneo. Detalle → `99 §9..§14`. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-08. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-08: `origin/main` = `8914a11` (ADR-015 reintento+timeout 900 EN PRODUCCIÓN). `origin/DESARROLLO` = `7693b60`. **HEAD local `8dd6a93` (ADR-016 reproceso asíncrono) AHEAD 1 → falta push+merge del director** (la CF de ADR-016 YA está desplegada; el frontend del badge llega con el push). |
| **Deploys backend** | (1) `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; canal `extra` por punto; prompt SIN columna "Evaluación/OK", L-42; **re-deploy 2026-06-08: (a) reintento con backoff de fallos transitorios — `functions/reintentos.mjs`, `maxRetries:0`, timeout 540→900s/1GiB, ADR-015/L-44; (b) REPROCESO server-side: la CF persiste el resultado + escribe estado durable `reproceso.{estado}` reusando el dominio — modo `informeId`, ADR-016/L-45**; "Reprocesar" = trabajo asíncrono observable. ⚠️ audit log de functions:log rezagado; timeout 900 desde fuente). (2) `narrativaTendenciaIA` **DESPLEGADA** (southamerica-east1; F3, narrativa sin PDF, default sonnet, 120s/512MiB). Secret `LLM_API_KEY` ok. Firestore con `experimentalAutoDetectLongPolling` (L-38). **Flujo (ADR-005)**: Claude commitea+deploya; el **director pushea**. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea/mergea (runtime 403, L-01); nunca force-push a `main`. **Tablero + Tendencia F1-F3 consolidados** (ADR-009/010); **veredicto MULTI-NORMA** (ADR-011/012, L-36/L-37): cada prueba se evalúa contra CADA norma → panel por bloque con veredicto por norma + **consolidado conservador** + divergencias (caso testigo: 5 GΩ@110kV pasa piso NETA 5 GΩ / falla por clase 30 GΩ). Motor único `pruebas_electricas_multinorma.js` alimenta scorecard/KPI/matriz/timeline/badges + **capa de diagnóstico `pruebas_electricas_recomendaciones.js`** (sugerencia accionable por bloque cuando el veredicto no es aprobado limpio, conforme a las skills 04-diagnostico). El veredicto sale del VALOR vs norma, nunca del texto IA. **Identidad/placa por informe (ADR-014)**: aislamiento por la clase del PROPIO ensayo (trafo móvil 63.5/110 kV). **Sin riesgos abiertos.** ⚠️ Umbrales por clase MO.00418 + PI/DAR + banda C1 bujes siguen `verificar` (TODO-08). **"Reprocesar" 100% funcional** (TODO-09→ADR-015: reintento IA con backoff). Pendientes: TODO-01/02/08.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
