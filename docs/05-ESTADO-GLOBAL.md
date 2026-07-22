# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-07-21**) |
|---|---|
| **Misión ahora** | Fase 9 (ADR-052) EN EJECUCIÓN por olas (autorizadas todas). ✅ Ola 0 confidencialidad · ✅ Ola 1 reglas (functions bloqueadas por billing). 🟡 **Olas 2-5 re-verificadas adversarialmente (2026-07-22, §52.9)** + ejecutados/desplegados G024 (XSS bump.js), G022 (auto-host lucide), G119 (untrack functions/domain). PENDIENTE: batch REAL G011/G016/G020/G012 · 6 decisiones del Ingeniero (G013/G014/G017/G095/G111-xlsx/STRUCT) · G025/CSP · G010 bloqueado por TODO-04 · 2 acciones del Ingeniero (billing + GitHub Support). Detalle → `10` TODO-11..14 + `99 §52.9`. |
| **Build** | 🟢 `node --test` **1171 pass / 0 fail / 12 skip** (fixtures xlsm confidenciales retirados). CI ahora corre los tests (`ci.yml`). · verificado-vivo: 2026-07-22 |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `9d99016` (Fase 9 se commitea+pushea+mergea en el mismo turno; ⚠️ comparar contra `origin/main`, NO el ref local que puede quedar stale tras el filter-repo). **Historia reescrita 2026-07-21** (git-filter-repo purgó confidenciales; `.git` 220M→23M; respaldo bundle en bóveda) → cualquier otra copia debe re-clonar. Árbol tracked 17M. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth email/password + Firestore + Storage). CF desplegadas: `extraerPruebasElectricasIA` (southamerica-east1, solo-CARGA, ADR-020) + `narrativaTendenciaIA`; secret `LLM_API_KEY` ok · verificado-vivo: 2026-06-23 |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA desactivada a propósito; CLAUDE §4 dormida). |
| **Deuda crítica** | 🔴 **ACCIÓN INGENIERO**: (a) **billing Firebase** (Blaze lapsó → deploy de functions bloqueado Y las CF de IA quizá no corren hoy); (b) **GitHub Support** "remove sensitive data" (purga `refs/pull/*` con commits confidenciales viejos). Pendiente técnico: motor normativo HI/excitación (G010-12, umbrales `⚠️ verificar` TODO-04) requiere trabajo cuidadoso con tests; `firestore.rules` sin tests (G025). |

## ⚠️ Flags de riesgo activos
- **Política git NUEVA (F3a 2026-07-18, ADR-051)**: Claude hace commit+push+merge+deploys, validando cada commit con el Ingeniero. NUNCA force-push a `main`. (Reemplaza la regla "el push lo hace el director" — L-01 actualizada.)
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA va paso a paso a pedido del director — NO generalizar a las demás pruebas sin su pedido (ADR-048/050).
- 🔲 Validación en la APP real (tras Firebase Auth) de ADR-046→050 sigue pendiente (TODO-06); el preview fiel `_dev/` es lo más cercano.

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro v1.1.0 ✅ (kernel v1.2 + hooks + handoff)
