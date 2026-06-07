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
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **rediseñado IA-primaria** (ADR-008) — bloques = cuerpo, scorecard derivado, render interactivo (auto-rango, filtro por fase, tabla por TAP, chart de desviación por física de prueba, análisis crítico). Sobre ADR-006 (bloques) + ADR-007 (diagnóstico). Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `origin/main` = `6a384db`; `origin/DESARROLLO` = `b42b8aa` (= HEAD del código, en sync y mergeado; `git fetch` 2026-06-07). **Pendiente push**: el commit de consolidación del cerebro. |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; última: prompt con `limite_desbalance`/IP/análisis crítico; timeout 540s, 1GiB — L-27). **Flujo (ADR-005)**: Claude commitea+deploya (firebase CLI local); el **director pushea**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea (runtime 403, L-01); nunca force-push a `main`. **Pendiente VISUAL (ADR-008, TODO-07)**: el tablero rediseñado + desviación correcta + análisis sin truncar **solo se ven al RE-CARGAR 450108 una vez** (la versión guardada tiene cálculos/textos viejos; el scorecard se corrige al recargar). La extracción de la IA es EXCELENTE (no es el cuello de botella); falta el OK visual + siguiente feedback. Math de desviación ya verificada.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
