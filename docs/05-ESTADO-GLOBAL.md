# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-08-21**) |
|---|---|
| **Misión ahora** | **ADR-067 (08-21)**: barrido de las 32 páginas — el sitio pintaba equipos ficticios sin rotularlos y escondía los datos reales del Ingeniero. Antes: ADR-066 (6 auditores sobre Fichas), ADR-064/065 (port completo), ADR-063. ⏭️ Falta **pulsar IMPORTAR** el Excel de Salud de Activos → cierra TODO-34. Pendientes → `10`. |
| **Build** | 🟢 `node --test` **1387 pass / 0 fail / 2 skip** + `lint:html` limpio + 8 tests de reglas (emulador, G025). CI corre los tests. · verificado-vivo: 2026-08-21 · CI y Deploy en VERDE (esperar SIEMPRE a que el Deploy termine antes de verificar producción — L-65) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `origin/main` (SHA vivo → handoff hook o `git fetch`, M-01; se commitea+pushea+mergea en el mismo turno). **Historia reescrita 2026-07-21** (filter-repo purgó confidenciales) → otra copia debe re-clonar. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`** (10/1/3/5): `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias` (esta se creó el 08-17: estaba en el código sin subir). **53 índices Firestore declarados == desplegados** (comprobar con `firestore:indexes`, NO con el archivo — L-66) · verificado-vivo: 2026-08-17 |
| **Parque real** | **206 TX** en Firestore, **0 ficticios** · 167 concordantes (81,1%) · 39 discrepancias · 3.834,3 MVA. ⚠️ **Sin Índice de Salud** (todo null, sin usuarios) → salud, matriz de riesgo y priorización vacías hasta el import (TODO-34) · verificado-vivo: 2026-08-21 |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA desactivada a propósito; CLAUDE §4 dormida). |
| **Deuda crítica** | 🔴 Del Ingeniero: (a) **pulsar IMPORTAR** en `admin/importar.html` (simulación corrida: 9 nuevos/199 actualizados/0 errores; el clasificador me bloquea esa escritura); (b) GitHub Support purga `refs/pull/*` + revocar PATs (TODO-08); (c) capítulo pruebas eléctricas del MO (ADR-057); (d) 🔴 **la bóveda `../brain-private` NO tiene remoto** — un solo disco con material real de cliente, y hoy 127 MB de fotos sin respaldar (TODO-29). |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato Opus 4.8 (activo 2026-07-23)**: si el modelo del turno principal NO es Fable 5 → cargar la skill `opus-interino-protocolo` al boot (R1-R7: marcar commits, TDD en dinero/datos, verificación en vivo, escalada honesta). Workflows/subagentes SIEMPRE acotados y con `model: 'opus'` (cuota Fable reservada para análisis/decisiones — orden del Ingeniero 2026-07-23).
- **Política git NUEVA (F3a 2026-07-18, ADR-051)**: Claude hace commit+push+merge+deploys, validando cada commit con el Ingeniero. NUNCA force-push a `main`. (Reemplaza la regla "el push lo hace el director" — L-01 actualizada.)
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA paso a paso a pedido del director — NO generalizar sin su pedido (ADR-048/050) · 🔲 validación en APP real (tras Auth) de ADR-046→050 pendiente (TODO-06; preview fiel `_dev/` es lo más cercano).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro v1.1.0 ✅ — **ecosistema `~/Desktop/GitHub-MJ`** (repo ⇄ `brain-private` hermanos), kernel CANÓNICO repartido con `npm run brain:pull` (versión: la reporta `brain:check`; dueño del dato = `scripts/.kernel-version.json`) + heartbeat + `60-WORKFLOWS` (ADR-058)
