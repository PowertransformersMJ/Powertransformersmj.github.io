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
| **Build** | 🟢 `npm test` (lint + `node --test tests/*`) **1063/1063 verde** (2026-06-08, +bujes canónico + tendencia alto nivel). |
| **Versión** | `v2.4.1` + cerebro v1.0.0. Pruebas Eléctricas con IA (Claude): tablero **IA-primaria**. **Arco ADR-003→010 EN PRODUCCIÓN**: completitud DETERMINISTA (`derivarTablaTAP`+canal `extra`), workflow de auditoría, excitación/relación/aislamiento NETA, criterios con fórmula, **Tendencia F1-F3** (gráficas + **franja-timeline** + **narrativa por IA on-demand**), **Biblioteca-hub**. Detalle → `99 §9`+`§10`. Secret `LLM_API_KEY` ok. |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `DESARROLLO-/-PROYECTO-MJ` (dev) → merge a `main` (producción). Verificado 2026-06-07. |
| **Producción** | `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-06-08: `origin/main` = `57ee038` (multi-norma + recomendaciones + fix Firestore EN PRODUCCIÓN). `origin/DESARROLLO` = `292e3b4` = HEAD base. **Cambios LOCALES sin commitear: ADR-013 (bujes canónico + Tendencia alto nivel)** → pendiente commit (Claude) + push (director). |
| **Deploys backend** | (1) `extraerPruebasElectricasIA` **DESPLEGADA** (southamerica-east1; canal `extra` por punto, timeout 540s/1GiB — L-27). (2) **`narrativaTendenciaIA` DESPLEGADA 2026-06-07** (southamerica-east1; F3, narrativa de tendencia: recibe el resumen ya extraído `resumenTendenciaParaIA`, NO PDF; default sonnet, timeout 120s/512MiB). Secret `LLM_API_KEY` ok. **Flujo (ADR-005)**: Claude commitea+deploya; el **director pushea**. |

## ⚠️ Flags de riesgo activos
- **Flujo git (ADR-005)**: Claude commitea+deploya, el director pushea/mergea (runtime 403, L-01); nunca force-push a `main`. **Tablero + Tendencia F1-F3 consolidados** (ADR-009/010); **veredicto MULTI-NORMA** (ADR-011/012, L-36/L-37): cada prueba se evalúa contra CADA norma → panel por bloque con veredicto por norma + **consolidado conservador** + divergencias (caso testigo: 5 GΩ@110kV pasa piso NETA 5 GΩ / falla por clase 30 GΩ). Motor único `pruebas_electricas_multinorma.js` alimenta scorecard/KPI/matriz/timeline/badges + **capa de diagnóstico `pruebas_electricas_recomendaciones.js`** (sugerencia accionable por bloque cuando el veredicto no es aprobado limpio, conforme a las skills 04-diagnostico). El veredicto sale del VALOR vs norma, nunca del texto IA. ⚠️ Umbrales por clase MO.00418 + PI/DAR + banda C1 bujes siguen `verificar` (TODO-08). Próximo: validar más secciones con informes reales; TODO-01/02/08 abiertos.

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
