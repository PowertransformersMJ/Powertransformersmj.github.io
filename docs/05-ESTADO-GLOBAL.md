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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) **1027/1027 verde** (2026-06-07, +9 Tendencia F2 timeline). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **IA-primaria**. **Arco ADR-003→009 EN PRODUCCIÓN** (PR #128): completitud DETERMINISTA (`derivarTablaTAP` + canal `extra` verificado), workflow de auditoría por sección, excitación (Potencia + desviación ÷mayor), relación (desviación = %DIF), **aislamiento NETA por clase** (110 kV→30 GΩ), subtítulos + criterios con fórmula, **pestaña Tendencia (F1)**, **Biblioteca-hub** (informes + PDF). Detalle → `99 §9`. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-07: `origin/main` = `4592f57` (PR #129, incluye consolidación cerebro ADR-009; arco del tablero ADR-003→009 EN PRODUCCIÓN desde PR #128). `origin/DESARROLLO` = `172c305` = HEAD. **Cambios LOCALES sin commitear: Tendencia F2 (franja-timeline)** — 4 archivos (`ui/pruebas/semaforo.js`, `pruebas-electricas-shell.js`, `pruebas-electricas.css`, test nuevo). Pendiente: commit (Claude) + push (director). |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; última 2026-06-07: prompt pivotado al **canal `extra` por punto** + schema `point.extra`, sobre `limite_desbalance`/IP/análisis crítico; timeout 540s, 1GiB — L-27). **Flujo (ADR-005)**: Claude commitea+deploya (firebase CLI local); el **director pushea**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea/mergea (runtime 403, L-01); nunca force-push a `main`. **Arco del tablero EN PRODUCCIÓN** (ADR-009, PR #128) y consolidado: TODO-07 cerrado. Criterios oficiales: resistencia ≤5% (IEEE 62.2/C57.152); aislamiento = mínimo NETA 100.5 por clase de tensión (110 kV→30 GΩ). **Sin flags de riesgo abiertos.** Próximo: Tendencia Fases 2-3 + validar secciones con informes reales (TODO-01/02 siguen abiertos, no relacionados al tablero).

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
