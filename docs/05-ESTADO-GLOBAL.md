# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-08-15**) |
|---|---|
| **Misión ahora** | **ADR-064/065 (08-20): Fichas Técnicas con su port COMPLETO** — 4 vistas + gestión de novedades con acta (el CSS ya estaba, faltaba el marcado). Antes: ADR-063 (cola de la auditoría: CF con topes, 53 índices vivos, suscripciones acotadas), ADR-062 (auditoría holística), ADR-061. ⏭️ FALTA validar Fichas con **sesión real** (TODO-30). Pendientes → `10`. |
| **Build** | 🟢 `node --test` **1349 pass / 0 fail / 2 skip** (277 suites) + `lint:html` limpio + 8 tests de reglas (emulador, G025). CI corre los tests. · verificado-vivo: 2026-08-20 · CI en VERDE desde 08-16 (tras 76 corridas en rojo) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `origin/main` (sin hash fijo — el SHA vivo lo da el handoff hook o `git fetch`, M-01; se commitea+pushea+mergea en el mismo turno; ⚠️ NO fiarse del ref local, puede quedar stale tras el filter-repo). **Historia reescrita 2026-07-21** (git-filter-repo purgó confidenciales; `.git` 220M→23M; respaldo bundle en bóveda) → cualquier otra copia debe re-clonar. Árbol tracked 17M. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`** (10/1/3/5): `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias` (esta se creó el 08-17: estaba en el código sin subir). **53 índices Firestore declarados == desplegados** (comprobar con `firestore:indexes`, NO con el archivo — L-66) · verificado-vivo: 2026-08-17 |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA desactivada a propósito; CLAUDE §4 dormida). |
| **Deuda crítica** | 🔴 Del Ingeniero: (a) **drag&drop del import** (paso único, `10`); (b) **GitHub Support** purga `refs/pull/*` + revocar PATs (TODO-08); (c) **capítulo pruebas eléctricas del MO** (per-clase; el anexo Salud ya entregado y ratificado NO las trae, ADR-057); (d) 🔴 **la bóveda `../brain-private` NO tiene remoto** — un solo disco, con material real de cliente (TODO-29, ADR-058). (✅ billing resuelto · ✅ B/E + extracción IA validadas en vivo ADR-054/bitácora 07-23 — ítem viejo corregido 07-28 · ✅ alerta GCP $5/mes.) |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato Opus 4.8 (activo 2026-07-23)**: si el modelo del turno principal NO es Fable 5 → cargar la skill `opus-interino-protocolo` al boot (R1-R7: marcar commits, TDD en dinero/datos, verificación en vivo, escalada honesta). Workflows/subagentes SIEMPRE acotados y con `model: 'opus'` (cuota Fable reservada para análisis/decisiones — orden del Ingeniero 2026-07-23).
- **Política git NUEVA (F3a 2026-07-18, ADR-051)**: Claude hace commit+push+merge+deploys, validando cada commit con el Ingeniero. NUNCA force-push a `main`. (Reemplaza la regla "el push lo hace el director" — L-01 actualizada.)
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA paso a paso a pedido del director — NO generalizar sin su pedido (ADR-048/050) · 🔲 validación en APP real (tras Auth) de ADR-046→050 pendiente (TODO-06; preview fiel `_dev/` es lo más cercano).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro v1.1.0 ✅ — **ecosistema `~/Desktop/GitHub-MJ`** (repo ⇄ `brain-private` hermanos), kernel CANÓNICO repartido con `npm run brain:pull` (versión: la reporta `brain:check`; dueño del dato = `scripts/.kernel-version.json`) + heartbeat + `60-WORKFLOWS` (ADR-058)
