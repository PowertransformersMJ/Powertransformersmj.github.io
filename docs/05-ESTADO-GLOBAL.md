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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) 1004/1004 verde (2026-06-07, lote 7). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **IA-primaria** (ADR-008). Lotes 4–5 EN PRODUCCIÓN (filtro por fase en todas las gráficas incl. desviación; criterio verificable `CRITERIOS_NORMA`). **Lote 6 (2026-06-07, commits `2534bcb`+`4548fb6`, pend. push+re-extract)**: **tabla de TAP COMPLETA DETERMINISTA** — `derivarTablaTAP()` arma la tabla desde las series + columnas Desviación %/Evaluación derivadas EN CLIENTE (la IA NO emitía la tabla ancha, L-32/L-33). Canal `extra` por punto para Potencia W/tensión/relación teórica/%DIF/R.Ref (la IA los adjunta inline). `UMBRAL_DESBALANCE` del dominio. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `origin/main` = `2bc0ca3` (lotes 4–5 en prod); `origin/DESARROLLO` = `1f51b70`; **HEAD local = `78e7ec0`** (lotes 6–8 + workflow, sin pushear). **Pendiente push (director)**: lote 6 (tabla determinista) + 7 (excitación) + workflow auditoría + 8 (presentación: sin duplicados, subtítulos, criterios con fórmula). Solo lote 7 + workflow tocaron función (ya desplegados). |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; última 2026-06-07: prompt pivotado al **canal `extra` por punto** + schema `point.extra`, sobre `limite_desbalance`/IP/análisis crítico; timeout 540s, 1GiB — L-27). **Flujo (ADR-005)**: Claude commitea+deploya (firebase CLI local); el **director pushea**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea (runtime 403, L-01); nunca force-push a `main`. **Pendiente VISUAL (ADR-008, TODO-07) — lote 6**: el director debe (1) **pushear DESARROLLO** (lote 6) y (2) **re-correr 450108**. Las columnas **Desviación %/Evaluación** de las tablas de TAP son DETERMINISTAS (cliente) → aparecen SOLO con el push, SIN re-run. Las columnas **Potencia W/tensión/relación teórica/%DIF/R.Ref** dependen de que la IA emita `extra` por punto (canal nuevo, más fiable que la `tabla` ancha que omitió en lotes 4–5, L-32/L-33). **YO debo verificar por logs `[IA-DIAG]` que `extra` ya viene tras el re-run ANTES de declarar OK** (no asumir). Umbral resistencia OFICIAL = ≤5% (IEEE 62.2/C57.152), confirmado.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
