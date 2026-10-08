# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-10-07**) |
|---|---|
| **Misión ahora** | **Frente en curso** (pedido suyo del 10-07): **MAPA DE COLOMBIA** (`§152`, TODO-78); antes ÓRDENES E/S + CONTRATO (`§141`–`§148`; TODO-76 · 62 · 65). **Esperan su respuesta**: FICHAS (CF-43/44 en rama; cola → `docs/cola-fichas-tecnicas.md`) · CARGABILIDAD SCADA (TODO-69). Último publicado: **`§148` las entregas de Órdenes se registran SOLAS en el contrato** (reglas + `776e31f`); cerebro: auditoría `§149` y freno al publicar `§150` (main `6a75027`, 10-07). Cadena → `00` Capa 1. |
| **Build** | 🟢 **2514 pass / 0 fail / 2 skip** + `lint:html` limpio + **238 tests de reglas** + `test:trigger` (1, emulador de Functions) (Storage: con el de Firestore al lado, L-78) + candado `guardia:cedulas`. · verificado-vivo: 2026-10-07 (local + emulador de reglas; servido = main `776e31f` el 10-07 (curl); CI en VERDE en `6a75027` y `776e31f` (`gh run list`, 10-07; la prueba de velocidad inestable se relanzó, **L-122**) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` y `main` con el MISMO contenido (`main` avanza por merge; SHA vivo → handoff hook o `git fetch`, nunca de memoria; se commitea+pushea+mergea en el mismo turno). |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`**: `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias`. **55 índices + 13 exenciones `scada_*`: archivo = servidor** (2026-10-01, L-66). **Firmas**, **Diagrama Operativo** y registro de órdenes con folio: en Firestore (`§100`/`§112`/`§114`). |
| **Parque real** | **208 TX** · 3.838,5 MVA · **salud 85/83/16/15/9** (la del Excel, decisión del Ingeniero `99 §74.15`) · 0 discrepancias UUCC · 4 fuera del catálogo CREG · verificado-vivo: 2026-09-08 |
| **Deuda crítica** | 🔴 Lo que **solo el Ingeniero** puede hacer → `10 §Solo puede hacerlo el Ingeniero` (B–J). |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato (desde 2026-07-23)**: si el modelo del turno NO es Fable 5 → cargar la skill `opus-interino-protocolo` (R1-R7). Subagentes/workflows SIEMPRE acotados y con `model: 'opus'`; la cuota Fable se reserva para análisis y decisiones (orden del Ingeniero).
- **Política git** → `CLAUDE.md §2` + L-63 (validar = entregar el resumen; incluye la excepción de Fichas).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro ✅ (kernel canónico del ecosistema; su versión la reporta `brain:check`). Mapa del ecosistema → `20 §Ecosistema`.
