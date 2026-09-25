# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-09-25**) |
|---|---|
| **Misión ahora** | **FICHAS TÉCNICAS, por partes** (cola viva → `docs/cola-fichas-tecnicas.md`). **Publicado 09-25** (`098dbff`, `0499e0d`, `01c921a`): `§93` Valor Real en blanco · `§94` calendario de años · `§95`-`§97` beneficios por práctica (breves, técnicos, sin marcas de fábrica) · `§98` firma estampada · `§99` firmas del equipo · `§100` firmas en Firestore (Storage daba 503; `8f5d5da`, validado en vivo). |
| **Build** | 🟢 **1869 pass / 0 fail / 2 skip** + `lint:html` limpio + **119 tests de reglas** + `test:trigger` (1, emulador de Functions) (Storage necesita el emulador de Firestore al lado — L-78) + candado `guardia:cedulas`. · verificado-vivo: 2026-09-25 (local; CI y Deploy en VERDE = `main`, L-65) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` == `main` == `origin/main` · `main` == `origin/main` (SHA vivo → handoff hook o `git fetch`, nunca de memoria; se commitea+pushea+mergea en el mismo turno). **Historia reescrita 2026-07-21** (filter-repo purgó confidenciales) → otra copia debe re-clonar. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`**: `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias`. **53 índices declarados en el archivo**; la igualdad contra el servidor **sin verificar desde 2026-08-17** (se comprueba con `firestore:indexes`, no con el archivo — L-66). **Firmas**: en Firestore desde `§100` (Storage no entrega descargas al navegador). **Firestore**: `ordenes_materiales` (+lápidas) y `responsables_ordenes` desplegadas 2026-09-16 (`§77/§78`). |
| **Parque real** | **208 TX** · 3.838,5 MVA · **salud 85/83/16/15/9** (la del Excel, decisión del Ingeniero `99 §74.15`) · 0 discrepancias UUCC · 4 fuera del catálogo CREG · verificado-vivo: 2026-09-08 |
| **Deuda crítica** | 🔴 Cosas que **solo el Ingeniero** puede hacer (GitHub Support + PATs · capítulo del MO · 3 decisiones de ADR-063 · proteger `main`) → lista viva en `10 §Solo puede hacerlo el Ingeniero`. 🔴 La bóveda vive en UN disco sin remoto (TODO-29). |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato (desde 2026-07-23)**: si el modelo del turno NO es Fable 5 → cargar la skill `opus-interino-protocolo` (R1-R7). Subagentes/workflows SIEMPRE acotados y con `model: 'opus'`; la cuota Fable se reserva para análisis y decisiones (orden del Ingeniero).
- **Política git**: Claude hace commit+push+merge+deploys y VALIDA entregando el resumen, no esperando el "sí" (`CLAUDE.md §2` · L-01 · L-63). NUNCA force-push a `main`.
- **Free-tier sagrado** (Firebase/Vercel/Pages): nada que facture sin aprobación del Ingeniero.
- **Foco de producto**: reorg POR PRUEBA paso a paso a pedido del director — NO generalizar sin su pedido (`99 §48/50`); su validación en la APP real sigue abierta (TODO-06).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro ✅ (kernel canónico del ecosistema; su versión la reporta `brain:check`). Mapa del ecosistema → `20 §Ecosistema`.
