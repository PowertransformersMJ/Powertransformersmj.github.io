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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) **1040/1040 verde** (2026-06-07, +4 aislamiento NETA por clase / veredicto normativo). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **IA-primaria**. **Arco ADR-003→010 EN PRODUCCIÓN**: completitud DETERMINISTA (`derivarTablaTAP`+canal `extra`), workflow de auditoría, excitación/relación/aislamiento NETA, criterios con fórmula, **Tendencia F1-F3** (gráficas + **franja-timeline** + **narrativa por IA on-demand**), **Biblioteca-hub**. Detalle → `99 §9`+`§10`. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-07: `origin/main` = `64d3dab` (Tendencia F1-F3 + biblioteca-fixes EN PRODUCCIÓN). `origin/DESARROLLO` = `283d454` = HEAD local (en sync). **Cambios LOCALES sin commitear: veredicto normativo ADR-011** (scorecard vs norma + NETA unificada + desviación general resistencia) → pendiente commit (Claude) + push (director). |
| **Deploys backend** | (1) `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; canal `extra` por punto, timeout 540s/1GiB — L-27). (2) **`narrativaTendenciaIA` DESPLEGADA 2026-06-07** (southamerica-east1; F3, narrativa de tendencia: recibe el resumen ya extraído `resumenTendenciaParaIA`, NO PDF; default sonnet, timeout 120s/512MiB). Secret `LLM_API_KEY` ok. **Flujo (ADR-005)**: Claude commitea+deploya; el **director pushea**. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea/mergea (runtime 403, L-01); nunca force-push a `main`. **Tablero + Tendencia F1-F3 consolidados** (ADR-009/010); **veredicto 100% NORMATIVO** (ADR-011, L-36): scorecard/KPI/matriz/tendencia derivan del VALOR vs norma (no del texto del informe/IA), aislamiento NETA por clase unificado en el dominio. ⚠️ **DECISIONES NORMATIVAS del director pendientes**: (1) resistencia ≤5% (código) vs **≤2% NETA D.8** → confirmar umbral; (2) relación con valor `verificar` (TAP6 1.26%) hoy = "fuera de norma" duro → ¿degradar a "verificar"?; (3) badges por bloque aún con texto IA → ¿recomputar? Próximo: confirmar (1)-(3) + validar secciones con informes reales; TODO-01/02/08 abiertos.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
