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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) 997/997 verde (2026-06-06). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude) + tablero detallado VIVO (ADR-003/004); tablero flexible "bloques" **Fases 1-3 + extras hechos** (función emite `bloques`+`verificar` desplegada + data layer + shell monta sección lazy por año + callout/barras rayadas; falta push + validar render E2E) (ADR-006). Secret `LLM_API_KEY` configurado. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-06. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `origin/main` ≈ `106c359` (sin `Debug/`, con features; el director mergea desde DESARROLLO). `origin/DESARROLLO` = `3f8bbdd`. |
| **Deploys backend** | Cloud Function `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1, re-deploy 2026-06-06: `bloques`+`verificar`, **timeout 540s, memoria 1GiB** tras timeout en PDF escaneado — L-27). **Flujo nuevo (ADR-005)**: Claude commitea + deploya (firebase CLI local); el **director hace los push**. Force-push a `main` solo el director. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea (runtime da 403, L-01); Claude NUNCA force-push a `main`. **Validación E2E en curso (director)**: 1er intento (DB5.pdf, 5 págs escaneadas) **falló por timeout** (callable 70s default + función 300s) → fix L-27 (timeouts 540s + 1GiB) desplegado; **falta reintentar la subida**.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
