# 🩺 05 — ESTADO GLOBAL (SGM · TRANSPOWER · Heartbeat)

> Nodo de signos vitales. Se **AUTO-CARGA** (con `CLAUDE.md` + `10`). "¿En qué estado está el sistema AHORA?". Tope ~25 líneas / 4k chars (§G.5) — tablero, no bitácora. Detalle histórico → `99` vía `00`.

| Señal | Valor (al **2026-10-05**) |
|---|---|
| **Misión ahora** | **Dos frentes**: FICHAS TÉCNICAS por partes (cola → `docs/cola-fichas-tecnicas.md`) · CARGABILIDAD SCADA (TODO-69). Último publicado: **`§135` sitio en celular y tablet** (`e810c89`); antes `§131`–`§134` Duval (BORRADOR; 207 con gases). Cerebro: `§136`, lóbulos 51–53 `§137`, cierre documental `§139` (10-05). Cadena en `00` Capa 1. |
| **Build** | 🟢 **2292 pass / 0 fail / 2 skip** + `lint:html` limpio + **201 tests de reglas** + `test:trigger` (1, emulador de Functions) (Storage: con el de Firestore al lado, L-78) + candado `guardia:cedulas`. · verificado-vivo: 2026-10-05 (local; CI y Deploy en VERDE en `main` `8dadc14`, 10-03; último despliegue de CÓDIGO `e810c89`, servido = main el 10-02, L-65; 1 prueba de velocidad inestable: relanzar, **L-122**) |
| **Branch / Deploy** | `DESARROLLO-/-PROYECTO-MJ` y `main` con el MISMO contenido (`main` avanza por merge; SHA vivo → handoff hook o `git fetch`, nunca de memoria; se commitea+pushea+mergea en el mismo turno). Historia reescrita 2026-07-21 → `99 §52.8` + L-25. |
| **Backend** | Firebase `lordpowertransformersmj` (Auth + Firestore + Storage). **Billing REACTIVADO (2026-07-23)**. **4 CF desplegadas con `maxInstances`**: `extraerPruebasElectricasIA` · `narrativaTendenciaIA` · `onMuestraCreate` · `cronAlertasDiarias`. **55 índices + 13 exenciones `scada_*`: archivo = servidor** (2026-10-01, L-66). **Firmas**, **Diagrama Operativo** y registro de órdenes con folio: en Firestore (`§100`/`§112`/`§114`). |
| **Parque real** | **208 TX** · 3.838,5 MVA · **salud 85/83/16/15/9** (la del Excel, decisión del Ingeniero `99 §74.15`) · 0 discrepancias UUCC · 4 fuera del catálogo CREG · verificado-vivo: 2026-09-08 |
| **Deuda crítica** | 🔴 Lo que **solo el Ingeniero** puede hacer → `10 §Solo puede hacerlo el Ingeniero` (B–I). 🔴 La bóveda vive en UN disco sin remoto (TODO-29). |

## ⚠️ Flags de riesgo activos
- **🤖 Interinato (desde 2026-07-23)**: si el modelo del turno NO es Fable 5 → cargar la skill `opus-interino-protocolo` (R1-R7). Subagentes/workflows SIEMPRE acotados y con `model: 'opus'`; la cuota Fable se reserva para análisis y decisiones (orden del Ingeniero).
- **Política git** → `CLAUDE.md §2` + L-63 (validar = entregar el resumen; incluye la excepción de Fichas).

## 🧩 Sub-sistemas
Frontend estático ✅ · Firebase (Auth+Firestore+Storage) ✅ · Cloud Functions ✅ · Vercel `/api` ✅ · PWA/SW ⛔ (kill-switch) · Cerebro ✅ (kernel canónico del ecosistema; su versión la reporta `brain:check`). Mapa del ecosistema → `20 §Ecosistema`.
