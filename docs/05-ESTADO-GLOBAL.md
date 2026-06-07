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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) 997/997 verde (2026-06-07). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **rediseñado IA-primaria** (ADR-008) — bloques = cuerpo, scorecard derivado, render interactivo. **Lote 4 (2026-06-07, commit `a790f94`, pend. push+re-extract)**: filtro por fase en TODAS las gráficas (curvas=serie, barras=categoría: bujes/resistencia MT-BT), criterio verificable por bloque (fórmula+umbral+norma, `CRITERIOS_NORMA` en dominio), y prompt IA exige tabla de TAP COMPLETA (Potencia W, %DIF, R.Ref, Desviación, Evaluación). Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `origin/main` = `6a384db`; `origin/DESARROLLO` = `b42b8aa`; **HEAD local = `a790f94`** (lote 4, sin pushear). **Pendiente push (director)**: commit de consolidación del cerebro previo + `a790f94`. |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; última 2026-06-07: prompt exige **tabla de TAP completa**, sobre `limite_desbalance`/IP/análisis crítico; timeout 540s, 1GiB — L-27). **Flujo (ADR-005)**: Claude commitea+deploya (firebase CLI local); el **director pushea**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea (runtime 403, L-01); nunca force-push a `main`. **Pendiente VISUAL (ADR-008, TODO-07) — lote 4**: el director debe (1) **pushear `a790f94`** (branch DESARROLLO → Pages: habilita filtro por fase en barras + franja de criterio) y (2) **re-correr 450108** (la función ya deployada llena las tablas de TAP completas; el mismo re-run también recalcula scorecard/desviación viejos). Pendiente: OK visual + siguiente feedback. **Resuelto (director 2026-06-07)**: umbral OFICIAL de resistencia de devanados = **≤5% (IEEE 62.2/C57.152)** — coincide con el código ya enviado (`UMBRALES.resistencia.limite=5` + `CRITERIOS_NORMA.resistencia`); el 3% del informe era interpretación más estricta del laboratorio.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
