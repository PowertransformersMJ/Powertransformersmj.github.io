# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-09-01**) |
|---|---|
| **Misión ahora** | **ADR-070/071 (08-30/31)**: Órdenes de Materiales SSEE entra al sitio como página propia, y las firmas escaneadas salen de la web a la cuenta de cada quien (`firmas/{uid}` en Storage, solo el dueño). Antes: ADR-068/069. ⏭️ Falta **pulsar IMPORTAR** el Excel de Salud de Activos → cierra TODO-34. Pendientes → `10`. |
| **Build** | 🟢 **1407 pass / 0 fail / 2 skip** + `lint:html` limpio + 8 tests de reglas de Firestore (emulador). ⚠️ **NO hay suite para las reglas de Storage** (TODO-46). · verificado-vivo: 2026-09-01 · CI y Deploy en VERDE (esperar SIEMPRE a que el Deploy termine — L-65) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `origin/main` (SHA vivo → handoff hook o `git fetch`, nunca de memoria; se commitea+pushea+mergea en el mismo turno). **Historia reescrita 2026-07-21** (filter-repo purgó confidenciales) → otra copia debe re-clonar. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`** (10/1/3/5): `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias` (esta se creó el 08-17: estaba en el código sin subir). **53 índices Firestore declarados == desplegados** (comprobar con `firestore:indexes`, NO con el archivo — L-66) · verificado-vivo: 2026-08-17. **Storage**: reglas con `firmas/{uid}` desplegadas 2026-08-31 (`99 §71`). |
| **Parque real** | **206 TX**, **0 ficticios**, 3.834,3 MVA (concordancia → `99 §67`). ⚠️ **Sin Índice de Salud**: salud, matriz y priorización vacías hasta el import — el dato ya existe y está verificado en el Excel (`99 §69`, TODO-34) · verificado-vivo: 2026-08-21 |
| **Deuda crítica** | 🔴 Cinco cosas que **solo el Ingeniero** puede hacer (pulsar IMPORTAR · GitHub Support + PATs · capítulo del MO · 3 decisiones de ADR-063 · proteger `main`) → lista viva en `10 §Solo puede hacerlo el Ingeniero`. 🔴 La bóveda vive en UN disco sin remoto (TODO-29). |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato (desde 2026-07-23)**: si el modelo del turno NO es Fable 5 → cargar la skill `opus-interino-protocolo` (R1-R7). Subagentes/workflows SIEMPRE acotados y con `model: 'opus'`; la cuota Fable se reserva para análisis y decisiones (orden del Ingeniero).
- **Política git**: Claude hace commit+push+merge+deploys y VALIDA entregando el resumen, no esperando el "sí" (`CLAUDE.md §2` · L-01 · L-63). NUNCA force-push a `main`.
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA paso a paso a pedido del director — NO generalizar sin su pedido (`99 §48/50`); su validación en la APP real sigue abierta (TODO-06).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro ✅ (kernel canónico del ecosistema; su versión la reporta `brain:check`). Mapa del ecosistema → `20 §Ecosistema`.
