# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-07-23**) |
|---|---|
| **Misión ahora** | Fase 9 + CONECTAR completas (D: NO activar, §52.14). **ADR-053 "HAS TODO TU" (2026-07-23): G010 cableado** (umbrales F18 → Health Index; ⚠️ NO editar umbrales hasta deploy de functions) + **TODO-04 validado parcial** (`49 §Validación`; resta ratificación + TODO-15) + fixes FASE E. **Bloqueo #1: billing** (abajo). Decisiones abiertas: G017/G111-xlsx/STRUCT/CSP. Detalle → `10` + `99 §52.8-53`. |
| **Build** | 🟢 `node --test` **1194 pass / 0 fail / 2 skip** (incl. 7 de G010) + **8 tests de reglas** (`test:rules` vía emulador, G025). CI corre los tests (`ci.yml`). · verificado-vivo: 2026-07-23 |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `origin/main` (sin hash fijo — el SHA vivo lo da el handoff hook o `git fetch`, M-01; se commitea+pushea+mergea en el mismo turno; ⚠️ NO fiarse del ref local, puede quedar stale tras el filter-repo). **Historia reescrita 2026-07-21** (git-filter-repo purgó confidenciales; `.git` 220M→23M; respaldo bundle en bóveda) → cualquier otra copia debe re-clonar. Árbol tracked 17M. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO por el Ingeniero (2026-07-23)** y CF re-desplegadas VIVAS (401 JSON limpio): `extraerPruebasElectricasIA` + `narrativaTendenciaIA` + `onMuestraCreate`, ya con G007/G008 + G010-CF; secret ok · verificado-vivo: 2026-07-23 |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA desactivada a propósito; CLAUDE §4 dormida). |
| **Deuda crítica** | ✅ billing resuelto (prueba gratuita había expirado; Ingeniero activó cuenta completa 2026-07-23 y Claude desplegó — CF vivas). 🔴 Restan del Ingeniero: (a) **GitHub Support** purga `refs/pull/*`; (b) **ratificar TODO-04** + entregar MO.00418 (per-clase); (c) probar B/E + extracción IA en vivo. (✅ alerta de presupuesto GCP: $5/mes, 2026-07-23.) |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato Opus 4.8 (activo 2026-07-23)**: si el modelo del turno principal NO es Fable 5 → cargar la skill `opus-interino-protocolo` al boot (R1-R7: marcar commits, TDD en dinero/datos, verificación en vivo, escalada honesta). Workflows/subagentes SIEMPRE acotados y con `model: 'opus'` (cuota Fable reservada para análisis/decisiones — orden del Ingeniero 2026-07-23).
- **Política git NUEVA (F3a 2026-07-18, ADR-051)**: Claude hace commit+push+merge+deploys, validando cada commit con el Ingeniero. NUNCA force-push a `main`. (Reemplaza la regla "el push lo hace el director" — L-01 actualizada.)
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA paso a paso a pedido del director — NO generalizar sin su pedido (ADR-048/050) · 🔲 validación en APP real (tras Auth) de ADR-046→050 pendiente (TODO-06; preview fiel `_dev/` es lo más cercano).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro v1.1.0 ✅ (kernel v1.2 + hooks + handoff)
