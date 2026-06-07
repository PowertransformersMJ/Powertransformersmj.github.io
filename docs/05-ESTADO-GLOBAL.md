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
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-07: `origin/main` = `a535534` (**lote 4 mergeado y EN PRODUCCIÓN**); `origin/DESARROLLO` = `c7bd4eb`; **HEAD local = `bfc6bfa`** (lote 5 sin pushear: `04f0c2f` código + `bfc6bfa` cerebro). **Pendiente push (director)**: lote 5. |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; última 2026-06-07: prompt exige **tabla de TAP completa**, sobre `limite_desbalance`/IP/análisis crítico; timeout 540s, 1GiB — L-27). **Flujo (ADR-005)**: Claude commitea+deploya (firebase CLI local); el **director pushea**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea (runtime 403, L-01); nunca force-push a `main`. **Pendiente VISUAL (ADR-008, TODO-07) — lote 5**: el director debe (1) **pushear DESARROLLO** (filtro por fase en barras + en gráficas de desviación + franja de criterio) y (2) **re-correr 450108**. ⚠️ Las tablas de TAP completas dependen de que la IA emita `tabla` en las curvas — el lote 4 NO lo logró (L-32, verificado por logs); el lote 5 añadió ejemplo few-shot al prompt + re-deploy. **YO debo verificar por logs `[IA-DIAG]` que la `tabla` ya viene tras el re-run, ANTES de declarar OK** (no asumir). **Resuelto (director 2026-06-07)**: umbral OFICIAL de resistencia de devanados = **≤5% (IEEE 62.2/C57.152)** — coincide con el código ya enviado (`UMBRALES.resistencia.limite=5` + `CRITERIOS_NORMA.resistencia`); el 3% del informe era interpretación más estricta del laboratorio.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
