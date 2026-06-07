# 🗺️ 20 — MEMORIA ESPACIAL (Arquitectura / Flujos / Estructura)

> **Nodo neuronal: Memoria Espacial.** Se lee SOLO ante desorientación
> (Trigger de Desorientación, ver `CLAUDE.md §G.2`): cuando dudas de DÓNDE vive
> un componente, CÓMO interactúan los módulos, qué depende de qué, o cómo está
> estructurado el deploy. NO se auto-carga.
>
> Este nodo es un HUB: enlaza a las hojas de detalle. Lee primero el mapa de
> abajo; baja a la hoja específica solo si necesitas el detalle fino.

---

## 🧭 Mapa rápido de "dónde vive cada cosa"

| Si buscas… | Ve a |
|---|---|
| Lógica de negocio pura (HI, DGA, sobrecarga, refrigeración, RBAC, plan inversión) | `assets/js/domain/*.js` (sin Firebase, testable con `node --test`) |
| Acceso a Firestore/Storage (CRUD, suscripciones realtime) | `assets/js/data/*.js` (thin I/O que delega a `domain/`) |
| UI de administración (CRUD con sesión admin) | `admin/*.html` + `assets/js/admin/*.js` |
| Páginas públicas/operativas (detrás de session-guard) | `pages/*.html` + `assets/js/*-public.js` |
| Portal de login (única ruta pública) | `index.html` |
| Guard de sesión / roles | `assets/js/auth/session-guard.js` + `page-guard.js` + `admin-guard.js` |
| Reglas de seguridad / índices Firestore / Storage | `firestore.rules` · `firestore.indexes.json` · `storage.rules` (deploy MANUAL) |
| Cloud Functions (email/cron) | `functions/index.js` |
| Sistema de diseño visual AQUA LIGHT | `assets/css/aqua-tokens.css` + `aqua-components.css` + `assets/js/aqua-shell.js` |
| Foto de fondo | `assets/img/aqua/substation-photo.webp` |
| Migraciones / scripts de datos | `scripts/migrate/*.js` |
| Tests | `tests/*.test.js` |
| Historia/decisión de un subsistema (§NN) | `00-INDICE.md` → `99-HISTORIAL-ADR.md` |
| Reglas permanentes históricas (informes, deep-clean, anti-datalist, etc.) | `30-LECCIONES.md` (condensado) · `_legacy/CLAUDE-previo.md §0.1.2.*` (full) |

---

## 🏗️ Estructura del repo (vista aérea)

- **Frontend / cliente**: HTML5 + CSS (sistema AQUA LIGHT) + JS ES6+ vanilla modular. **Sin framework ni bundler** — los `.js` se cargan como ES modules vía `<script type="module">` o CDN. Hosting GitHub Pages.
- **Backend**: Firebase (Auth + Firestore + Storage, proyecto `lordpowertransformersmj`) + Cloud Functions (`functions/`) + Vercel para `/api/*`.
- **Scripts / herramientas**: `scripts/` (incluye `scripts/migrate/` y `scripts/brain-check.mjs`).
- **Tests**: `tests/*.test.js` con el runner nativo `node --test`.
- **Docs**: este `docs/` (cerebro neuronal + 15 hojas técnicas pre-existentes, ver abajo).
- **CI / Deploy**: `.github/workflows/ci.yml` (lint HTML) · `pages.yml` (deploy main → GitHub Pages) · `vercel.json` (`/api`).

### 📁 Estructura de carpetas principales

| Carpeta | Qué contiene | Cómo se carga / consume |
|---|---|---|
| `assets/js/domain/` | Funciones puras de dominio (sin I/O) | Importadas por `data/` y por tests Node |
| `assets/js/data/` | Data layers Firebase (one-shot + realtime `onSnapshot`) | Importadas por las UIs |
| `assets/js/admin/` | Controladores de las páginas `admin/*.html` | `<script type="module">` por página |
| `assets/css/` | Estilos + sistema AQUA LIGHT | `<link>` por página |
| `admin/` | UIs de administración (CRUD) | Protegidas por `admin-guard.js` |
| `pages/` | Páginas públicas/operativas | Protegidas por `page-guard.js` |
| `functions/` | Cloud Functions (deployable) | `firebase deploy --only functions` |
| `scripts/migrate/` | Migraciones y tipificaciones de datos | Corre el director con firebase-admin |
| `tests/` | Suites `node --test` | `npm run test:unit` |

**⚠️ Reflejo de Frescura (`CLAUDE.md §G.4`):** si mueves/creas/renombras un archivo importante, actualiza esta tabla en el MISMO cambio. Una neurona vieja engaña al próximo "tú" → reproceso/regresión.

---

## 📚 Hojas de detalle técnicas (docs/ pre-existentes · COEXISTEN con el cerebro)

> El proyecto ya tenía 15 documentos técnicos en `docs/` antes del cerebro. NO son
> neuronas numeradas pero son fuente de verdad de su tema. Consultar on-demand:

- `ARQUITECTURA.md` — arquitectura de código (dónde vive cada cosa, detalle fino).
- `MODELO-DATOS-v2.md` — diccionario completo del schema Firestore v2 (ER, por sección, referencia normativa MO.00418 por campo).
- `OPERACIONES.md` — runbook operativo / troubleshooting.
- `DEPLOY-FUNCTIONS.md` — despliegue de Cloud Functions.
- `MANTENIMIENTO-BRIGADA.md` — módulo Selección ONAF (dominio refrigeración, catálogos AFINIA + ZIEHL-ABEGG, informe imprimible).
- `MANTENIMIENTO-PREDICTIVO.md` · `INDICADORES-CALIDAD.md` · `PLAN-SUMINISTROS.md` · `REPOSITORIO-PRUEBAS-ELECTRICAS.md` — módulos/dominios específicos.
- **Extracción IA de PDFs (Pruebas Eléctricas)** — Cloud Function `functions/index.js#extraerPruebasElectricasIA` (PDF nativo desde Storage → `auto` tool + adaptive thinking + streaming → `sanitizarInforme`); cliente `data/pruebas_electricas.js#extraerConIA` (+ `eliminarUnidad`); render detallado `ui/pruebas/tabla-pruebas.js` + gráficas `ui/pruebas/grafico-svg.js` (eje Y dinámico). Detalle → `REPOSITORIO-PRUEBAS-ELECTRICAS.md §13` + ADRs `99 §3/§4`.
- `CONTRATO_4125000143_ANALISIS.md` · `MICROCIRUGIA-CONTRATOS-2026-04-27.md` — contratos.
- `UI-V3-DARKMODE.md` — handoff del sistema visual (histórico; el activo es AQUA LIGHT).
- `PLAN-SERVICIOS-EXTERNOS.md` — servicios externos (legacy).
- `SESION-2026-05-03-CONTINUACION.md` · `SESION-2026-05-05.md` — handoffs de sesión.
- `INSTALACION-CEREBRO.md` — manual del cerebro neuronal (movido aquí en la instalación).

---

## 🔗 Flujos de datos clave

```
Usuario → index.html (login Firebase Auth)
   │  sesión válida + perfil /usuarios/{uid}
   ▼
home.html / pages/* (session-guard) ── realtime onSnapshot ──▶ Firestore
   │  rol === 'admin'
   ▼
admin/* (admin-guard) ── data/*.js (CRUD) ──▶ Firestore + Storage

Patrón canónico: UI → data/*.js (I/O) → domain/*.js (cálculo puro)
Integración cross-módulo: domain puro + idempotencia por marcador + trazabilidad
   bidireccional + hook no-bloqueante (ver 30-LECCIONES + _legacy §0.1.2.13).
```

**Módulos de alto blast radius** (IAP `CLAUDE.md §3.4` obligatorio): `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `assets/js/auth/session-guard.js`, `assets/js/data/*.js`, `assets/js/domain/schema.js` (pesos HI Tabla 10 + enums canónicos), `functions/`.

---

## 🗂️ Schema de datos (resumen · Firestore `lordpowertransformersmj`)

- `usuarios/{uid}` — perfil + rol (`{email, nombre, rol, activo}`). Fuente de verdad de auth.
- `admins/{uid}` — bootstrap legacy de admin (fallback).
- `transformadores/{id}` — activos v2 estructurado por secciones + `salud_actual` (HI) + proyección v1 plana al raíz (convivencia v1/v2). Subcolecciones append-only `placas_historicas`, `historial_hi`.
- `subestaciones/{id}` · `ordenes/{id}` (+ subcol `historial`) · `documentos/{id}` · `muestras/{id}` · `contratos/{cid}` · `suministros/{contratoId_codigo}` (docId compuesto N5, ver `30-LECCIONES`) · `movimientos` · `marcas` · `catalogos` · `fallados` · `alertas_config/global` · `alertas_reconocidas/{id}` · `acciones_refrigeracion/{id}` · `umbrales_salud/global` · `auditoria` · `importaciones/{jobId}`.

Detalle completo → `docs/MODELO-DATOS-v2.md`.

---

## ⚙️ Convenciones espaciales (dónde NO equivocarse)

- **Reglas/índices/storage Firestore NO auto-deployan** — el director los corre a mano en su Mac. Avisar en el mismo turno (`CLAUDE.md §1`).
- **`/suministros/{X}` usa docId compuesto** `{contrato_id}_{codigo}` desde la migración N5 — usar `composeDocId(cid, codigo)`, nunca el código plano (ver `30-LECCIONES`).
- **No hay bundler**: los `.js` son ES modules directos; rutas relativas importan (`../domain/x.js`). Nada pasa por transpilación.
- **Lint local con `npm run lint:html`** (NO `npx html-validate` — descarga versión transitoria distinta a la de CI).
- **Push solo con PAT inline** (`git push https://USER:TOKEN@github.com/...`); redactar el token de cualquier output.

---

> Si tras leer este nodo sigues sin ubicar algo, NO adivines: lee la hoja de
> detalle enlazada arriba, o el ADR § correspondiente vía `docs/00-INDICE.md`.
>
> **📏 Capacidad (`CLAUDE.md §G.5`): ~280 líneas.** Al acercarse, SHARD por
> sub-área (ej. extraer `js/` a `21-ESPACIAL-FRONTEND.md`), registrar en
> `CLAUDE.md §0` + `00-INDICE`, dejar puntero aquí.
