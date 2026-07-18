# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-07-18**) |
|---|---|
| **Misión ahora** | Tablero de Pruebas Eléctricas IA-primaria EN PRODUCCIÓN (arcos ADR-003→050). Cerebro migrado a brain-kit v1.0 (ADR-051). Próximo: **Fase 9 — escaneo total + propuestas** (TODO-01). |
| **Build** | 🟢 `npm test` (html-validate + `node --test`) **1185/1185** · verificado-vivo: 2026-07-18 |
| **Branch / Deploy** | Trabajo en `DESARROLLO-/-PROYECTO-MJ` → merge a `main` → GitHub Pages (`pages.yml`). `git fetch` 2026-07-18: **PRs #181–#187 MERGEADAS** (ADR-046→050 en producción, `main`=`44fd75a`); `main` trae además **10 PDFs OLTC (~60MB) en la RAÍZ** subidos vía web (revisar en Fase 9: peso+copyright en repo público). |
| **Backend** | Firebase `lordpowertransformersmj` (Auth email/password + Firestore + Storage). CF desplegadas: `extraerPruebasElectricasIA` (southamerica-east1, solo-CARGA, ADR-020) + `narrativaTendenciaIA`; secret `LLM_API_KEY` ok · verificado-vivo: 2026-06-23 |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA desactivada a propósito; CLAUDE §4 dormida). |
| **Deuda crítica** | (1) Diagnóstico integral PENDIENTE (Fase 9, TODO-01) — el director reporta falta de estructura/backend robusto. (2) Código muerto FUSIÓN en `excitacion-panel.js` (ADR-046). (3) Umbrales normativos `⚠️ verificar` sin validar por el Ingeniero (TODO-04). |

## ⚠️ Flags de riesgo activos
- **Política git NUEVA (F3a 2026-07-18, ADR-051)**: Claude hace commit+push+merge+deploys, validando cada commit con el Ingeniero. NUNCA force-push a `main`. (Reemplaza la regla "el push lo hace el director" — L-01 actualizada.)
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA va paso a paso a pedido del director — NO generalizar a las demás pruebas sin su pedido (ADR-048/050).
- 🔲 Validación en la APP real (tras Firebase Auth) de ADR-046→050 sigue pendiente (TODO-06); el preview fiel `_dev/` es lo más cercano.

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro v1.1.0 ✅ (kernel v1.2 + hooks + handoff)
