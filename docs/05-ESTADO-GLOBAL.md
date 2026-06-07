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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) **1031/1031 verde** (2026-06-07, +9 F2 timeline, +4 F3 resumen IA). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **IA-primaria**. **Arco ADR-003→009 EN PRODUCCIÓN** (PR #128): completitud DETERMINISTA (`derivarTablaTAP` + canal `extra` verificado), workflow de auditoría por sección, excitación (Potencia + desviación ÷mayor), relación (desviación = %DIF), **aislamiento NETA por clase** (110 kV→30 GΩ), subtítulos + criterios con fórmula, **pestaña Tendencia (F1)**, **Biblioteca-hub** (informes + PDF). Detalle → `99 §9`. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-07: `origin/main` = `4592f57` (PR #129, incluye consolidación cerebro ADR-009; arco del tablero ADR-003→009 EN PRODUCCIÓN desde PR #128). `origin/DESARROLLO` = `172c305`. **HEAD local adelantado: commit `a8f32a3` (Tendencia F2 timeline) + cambios sin commitear de F3 (narrativa IA).** Pendiente: commit F3 (Claude) + push de ambos (director). |
| **Deploys backend** | (1) `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; canal `extra` por punto, timeout 540s/1GiB — L-27). (2) **`narrativaTendenciaIA` DESPLEGADA 2026-06-07** (southamerica-east1; F3, narrativa de tendencia: recibe el resumen ya extraído `resumenTendenciaParaIA`, NO PDF; default sonnet, timeout 120s/512MiB). Secret `LLM_API_KEY` ok. **Flujo (ADR-005)**: Claude commitea+deploya; el **director pushea**. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea/mergea (runtime 403, L-01); nunca force-push a `main`. **Arco del tablero EN PRODUCCIÓN** (ADR-009, PR #128) y consolidado: TODO-07 cerrado. Criterios oficiales: resistencia ≤5% (IEEE 62.2/C57.152); aislamiento = mínimo NETA 100.5 por clase de tensión (110 kV→30 GΩ). ⚠️ **Tendencia F2+F3 code-complete + CF desplegada, PERO sin verificar en navegador ni en prod** (frontend sin push). Verificar la narrativa IA en vivo tras el push antes de consolidar ADR-010. Próximo: push (director) → verificación → ADR-010 + validar secciones con informes reales (TODO-01/02 abiertos, no del tablero).

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
