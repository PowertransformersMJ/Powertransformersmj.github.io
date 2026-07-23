# 🗺️ 20 — MEMORIA ESPACIAL (Arquitectura / Flujos / Estructura)

> **Nodo neuronal: Memoria Espacial.** Se lee SOLO ante desorientación
> (Trigger de Desorientación, ver `CLAUDE.md §G.2`): cuando dudas de DÓNDE vive
> un componente, CÓMO interactúan los módulos, qué depende de qué, o cómo está
> estructurado el deploy. NO se auto-carga.
>
> Este nodo es un HUB: enlaza a las hojas de detalle. Lee primero el mapa de
> abajo; baja a la hoja específica solo si necesitas el detalle fino.
>
> ⚠️ corregido 2026-07-18: verificado archivo por archivo contra el repo real
> (branch `DESARROLLO-/-PROYECTO-MJ`). El cerebro anterior completo vive hoy en
> `_legacy/cerebro-anterior/docs/`. El instalador `brain-kit/` se retiró
> el 2026-07-23 (Fase 9 al 100%; respaldo íntegro en la bóveda privada).

---

## 🧭 Mapa rápido de "dónde vive cada cosa"

| Si buscas… | Ve a |
|---|---|
| Lógica de negocio pura (HI, DGA, sobrecarga, refrigeración, RBAC, plan inversión, SAIDI, SCADA, multi-norma pruebas) | `assets/js/domain/*.js` (54 módulos sin Firebase, testables con `node --test`) |
| Acceso a Firestore/Storage (CRUD, suscripciones realtime) | `assets/js/data/*.js` (38 data layers thin I/O que delegan a `domain/`) |
| UI de administración (CRUD con sesión admin) | `admin/*.html` (30 páginas) + `assets/js/admin/*.js` |
| Páginas públicas/operativas (detrás de session-guard) | `pages/*.html` (31 páginas) + `assets/js/*-public.js` |
| Portal de login (única ruta pública) | `index.html` |
| Guard de sesión / roles | `assets/js/auth/session-guard.js` + `page-guard.js` + `admin-guard.js` |
| Reglas de seguridad / índices Firestore / Storage | `firestore.rules` · `firestore.indexes.json` · `storage.rules` (deploy manual vía firebase CLI — flujo ADR-005, ver Convenciones) |
| Cloud Functions | `functions/index.js` — 4 exports: `onMuestraCreate`, `cronAlertasDiarias`, `extraerPruebasElectricasIA`, `narrativaTendenciaIA` ⚠️ corregido 2026-07-18: antes decía solo "email/cron"; el email va por Firebase Extension "Trigger Email", no por código propio |
| Sistema de diseño visual AQUA LIGHT | `assets/css/aqua-tokens.css` + `aqua-components.css` + `assets/js/aqua-shell.js` |
| Foto de fondo | `assets/img/aqua/substation-photo.webp` |
| Migraciones / scripts de datos | `scripts/migrate/*.js` (`tipificar-suministros-fan-db.js`, `v1-to-v2-transformadores.js`) |
| Tests | `tests/*.test.js` (64 suites) |
| Historia/decisión de un subsistema (§NN) | `00-INDICE.md` → `99-HISTORIAL-ADR.md` |
| Reglas permanentes históricas (informes, deep-clean, anti-datalist, etc.) | `30-LECCIONES.md` (condensado) · `_legacy/CLAUDE-previo.md §0.1.2.*` (full) |

---

## 🏗️ Estructura del repo (vista aérea)

- **Frontend / cliente**: HTML5 + CSS (sistema AQUA LIGHT) + JS ES6+ vanilla modular. **Sin framework ni bundler** — los `.js` se cargan como ES modules vía `<script type="module">` o CDN. Hosting GitHub Pages.
- **Backend**: Firebase (Auth + Firestore + Storage, proyecto `lordpowertransformersmj`) + Cloud Functions (`functions/`) + Vercel para `/api/*` (hoy solo `api/health.js`).
- **Scripts / herramientas**: `scripts/` — incluye `scripts/migrate/`, `scripts/brain-check.mjs` y `scripts/audit-bloques-pruebas.mjs`. ⚠️ corregido 2026-07-18: hoy también `boot-gate.mjs`, `brain-diff.mjs`, `brain-index.mjs`, `dev-server.mjs`, `session-handoff.mjs`.
- **Tests**: `tests/*.test.js` con el runner nativo `node --test` (`npm run test:unit`).
- **Docs**: `docs/` = hojas técnicas del dueño (16 .md + `docs/pruebas/`, ver sección final). ⚠️ corregido 2026-07-18: las neuronas del cerebro anterior YA NO viven en `docs/` — fueron movidas a `_legacy/cerebro-anterior/docs/`.
- **CI / Deploy**: `.github/workflows/ci.yml` (lint HTML) · `pages.yml` (deploy main → GitHub Pages) · `vercel.json` (`/api`). `sw.js` en raíz es kill-switch (PWA desactivada).

### 📁 Estructura de carpetas principales

| Carpeta | Qué contiene | Cómo se carga / consume |
|---|---|---|
| `assets/js/domain/` | Funciones puras de dominio (sin I/O) | Importadas por `data/` y por tests Node |
| `assets/js/data/` | Data layers Firebase (one-shot + realtime `onSnapshot`) | Importadas por las UIs |
| `assets/js/admin/` | Controladores de las páginas `admin/*.html` | `<script type="module">` por página |
| `assets/js/ui/` | Componentes de render por módulo (`pruebas/`, `calidad/`, `cargabilidad/`, `seguimiento/`, `module-shell.js`, `tabs.js`, `contrato-context.js`) ⚠️ corregido 2026-07-18: fila añadida — carpeta ya existente y central | Importados por los shells de página |
| `assets/css/` | Estilos + sistema AQUA LIGHT | `<link>` por página |
| `admin/` | UIs de administración (CRUD) | Protegidas por `admin-guard.js` |
| `pages/` | Páginas públicas/operativas | Protegidas por `page-guard.js` |
| `functions/` | Cloud Functions (deployable) | `firebase deploy --only functions` |
| `scripts/migrate/` | Migraciones y tipificaciones de datos | Corre el director con firebase-admin |
| `tests/` | Suites `node --test` | `npm run test:unit` |

**⚠️ Reflejo de Frescura (`CLAUDE.md §G.4`):** si mueves/creas/renombras un archivo importante, actualiza esta tabla en el MISMO cambio. Una neurona vieja engaña al próximo "tú" → reproceso/regresión.

---

## 📚 Subsistema Pruebas Eléctricas — extracción IA / tendencia (detalle único)

> ⚠️ GC 2026-07-23: el listado de hojas del dueño duplicaba el inventario de la
> sección final — fusionado allá; aquí queda solo el detalle técnico único.

- **Extracción IA de PDFs (Pruebas Eléctricas)** — Cloud Function `functions/index.js#extraerPruebasElectricasIA` (PDF desde Storage → `sanitizarInforme` en `domain/pruebas_electricas_schema.js`); cliente `data/pruebas_electricas.js#extraerConIA` (+ `eliminarUnidad`); render detallado `ui/pruebas/tabla-pruebas.js` + gráficas `ui/pruebas/grafico-svg.js` (eje Y dinámico). Tablero IA-primaria (bloques): render genérico `ui/pruebas/grafico-generico.js` + dominio `domain/pruebas_electricas_bloques.js` (`derivarTablaTAP` + canal `extra`). ⚠️ corregido 2026-07-18: `bloquesDeExtra` es función LOCAL de `ui/pruebas/grafico-generico.js`, no export del dominio; y el módulo creció — shell `assets/js/pruebas-electricas-shell.js` (~2.4k líneas, scorecard/fichas), motor multi-norma `domain/pruebas_electricas_multinorma.js` + `_recomendaciones.js` + `_semaforo.js`, paneles `ui/pruebas/tand-panel.js`/`excitacion-panel.js`/`tablas-pruebas-panel.js`/`semaforo.js`/`modal-upsert.js`. Detalle → `REPOSITORIO-PRUEBAS-ELECTRICAS.md §13` + ADRs (arco 003→020+ en `99`).
  - **Workflow de auditoría/completitud por sección** (detectar→clasificar→corregir→verificar; auditor `scripts/audit-bloques-pruebas.mjs`) → hoja `workflow-auditoria-secciones-pruebas.md`.
  - **Tendencia temporal** (multi-informe): pestaña "Tendencia" + `domain/pruebas_electricas_tendencia.js` (`bloquesTendencia` — escalar peor-caso por prueba vs umbral; determinista, reusa el render genérico). ⚠️ corregido 2026-07-18: ya NO es "Fase 1 con F2-F3 pendientes" — F1-F3 consolidadas: timeline + narrativa IA vía Cloud Function `narrativaTendenciaIA` (desplegada) y cliente `data/pruebas_electricas.js` (httpsCallable, 120s).
- `CONTRATO_4125000143_ANALISIS.md` · `MICROCIRUGIA-CONTRATOS-2026-04-27.md` — contratos.
- `UI-V3-DARKMODE.md` — handoff del sistema visual (histórico; el activo es AQUA LIGHT).
- `PLAN-SERVICIOS-EXTERNOS.md` — servicios externos (legacy).
- `SESION-2026-05-03-CONTINUACION.md` · `SESION-2026-05-05.md` — handoffs de sesión.
- `INSTALACION-CEREBRO.md` — manual del cerebro neuronal. ⚠️ corregido 2026-07-18: ya NO está en `docs/`; vive en `_legacy/cerebro-anterior/docs/INSTALACION-CEREBRO.md`.

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

**Módulos de alto blast radius** (IAP `CLAUDE.md §3.4` obligatorio): `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `assets/js/auth/session-guard.js`, `assets/js/data/*.js`, `assets/js/domain/schema.js` (pesos HI Tabla 10 + enums canónicos), `assets/js/domain/pruebas_electricas_multinorma.js` (veredictos normativos), `functions/`.

---

## 🗂️ Schema de datos (resumen · Firestore `lordpowertransformersmj`)

- `usuarios/{uid}` — perfil + rol (`{email, nombre, rol, activo}`). Fuente de verdad de auth.
- `admins/{uid}` — bootstrap legacy de admin (fallback).
- `transformadores/{id}` — activos v2 estructurado por secciones + `salud_actual` (HI) + proyección v1 plana al raíz (convivencia v1/v2). Subcolecciones append-only `placas_historicas`, `historial_hi`, `historial`.
- `subestaciones/{id}` · `ordenes/{id}` (+ subcol `historial`) · `documentos/{id}` · `muestras/{id}` · `contratos/{cid}` · `suministros/{contratoId_codigo}` (docId compuesto N5, ver `30-LECCIONES`) · `movimientos` · `marcas` · `fallados` · `alertas_config/global` · `alertas_reconocidas/{id}` · `acciones_refrigeracion/{id}` · `umbrales_salud/global` (+ subcol `historial`) · `auditoria` · `importaciones/{jobId}`.
- ⚠️ corregido 2026-07-18: `firestore.rules` define además `pruebas_electricas/{id}` (+ subcol `informes/{informeId}` y `diagnostico/{d}`), `contramuestras`, `monitoreo_intensivo`, `parametros_sistema`, `subactividades`/`macroactividades`/`causantes` (catálogos), `propuestas_reclasificacion_fur`, `gate_codes/{hash}`, `correcciones`, `suministros_config`. NO existe bloque `match /catalogos` en rules (el `data/catalogos.js` es genérico por nombre de colección).

Detalle completo → `docs/MODELO-DATOS-v2.md`.

---

## ⚙️ Convenciones espaciales (dónde NO equivocarse)

- **Deploys Firebase (reglas/índices/storage/functions)**: ⚠️ corregido 2026-07-18 — flujo ADR-005 (desde 2026-06-06): **Claude ejecuta los `firebase deploy`** con la CLI local autenticada en la Mac del director (`--only firestore:rules` / `firestore:indexes` / `storage` / `functions`), anunciándolo en el MISMO turno. Ya no "los corre el director a mano".
- **`/suministros/{X}` usa docId compuesto** `{contrato_id}_{codigo}` desde la migración N5 — usar `composeDocId(cid, codigo)` (definido en `domain/contratos.js`, re-exportado por `data/suministros.js`), nunca el código plano (ver `30-LECCIONES`).
- **No hay bundler**: los `.js` son ES modules directos; rutas relativas importan (`../domain/x.js`). Nada pasa por transpilación.
- **Lint local con `npm run lint:html`** (NO `npx html-validate` — descarga versión transitoria distinta a la de CI).
- **Git**: ⚠️ corregido 2026-07-23 — política vigente F3a/ADR-051 (reemplaza ADR-005): **Claude ejecuta commit + push + merge + deploys**, validando cada commit con el Ingeniero (L-01 actualizada). NUNCA force-push a `main`; NUNCA escribir tokens a archivo/commit/log.

---

## 🗂️ Hojas de detalle del proyecto (docs/ del dueño)

> ⚠️ añadido 2026-07-18: inventario verificado leyendo la cabecera de cada archivo.

- `ARQUITECTURA.md` — mapa de navegación del repositorio (v2.0.8): dónde vive cada cosa, para sesiones nuevas sin explorar a ciegas.
- `MODELO-DATOS-v2.md` — documento maestro del schema Firestore v2 (Fase 16): Health Index ponderado por secciones, referencia MO.00418.DE-GAC-AX.01 Ed. 02.
- `DEPLOY-FUNCTIONS.md` — guía de activación por etapas de `onMuestraCreate` y `cronAlertasDiarias` (F32); email opcional vía Firebase Extension "Trigger Email" + Gmail SMTP.
- `OPERACIONES.md` — runbook operativo v2.0.8: bootstrap, uso diario y emergencia de la plataforma en producción (audiencia: Ingeniero Director).
- `MANTENIMIENTO-BRIGADA.md` — módulo Selección ONAF: calculadora de refrigeración ONAN→ONAF conforme IEEE C57.12.00 / C57.91-2011 / ANSI C57.12.91 + Westinghouse.
- `MANTENIMIENTO-PREDICTIVO.md` — refactor del tablero estático de Pruebas Eléctricas (TransformerOps) a módulo modular sobre Firestore realtime + sistema Aqua.
- `PLAN-SERVICIOS-EXTERNOS.md` — guía paso a paso (legacy, para no-programadores) de conexión con Firebase, Node.js, GitHub Pages y Vercel.
- `PLAN-SUMINISTROS.md` — plan v2.2 de integración Suministros + Repuestos (F38–F50) a partir de los fuentes `.jsx`/`.xlsm`, con decisiones bloqueantes aprobadas.
- `INDICADORES-CALIDAD.md` — dashboard SAIDI_E/SAIFI_E (refactor F40): impacto de causas controlables + proyección Jun–Dic con OLS y bandas IC95%.
- `REPOSITORIO-PRUEBAS-ELECTRICAS.md` — arquitectura del repositorio digital de pruebas por número de serie (extiende `pages/pruebas-electricas.html`); su §13 documenta la extracción con IA (ADR-003).
- `CONTRATO_4125000143_ANALISIS.md` — reporte Fase A: diff estructural del `.xlsm` del contrato 4125000143 vs el template canónico (inventario ZIP parte a parte).
- `MICROCIRUGIA-CONTRATOS-2026-04-27.md` — Fase 1 (inventario y diagnóstico) de la microcirugía del módulo Suministros/Contratos: estado encontrado + PDFs del repo.
- `SESION-2026-05-03-CONTINUACION.md` — handoff de sesión: Mantenimiento Brigada (mix multi-modelo, plan de microfases, hotfix).
- `SESION-2026-05-05.md` — handoff de sesión: render integral del transformador, interactividad click-en-cuerpo y render lateral con foto real.
- `UI-V3-DARKMODE.md` — decisiones de diseño del refactor visual UI v3 dark mode (cierre 2026-04-27, v2.5.0; histórico — el sistema activo es AQUA LIGHT).
- `workflow-auditoria-secciones-pruebas.md` — hoja hija de ESTE nodo: proceso repetible de auditoría/completitud por sección del tablero de pruebas (columnas que la IA pierde).
- `docs/pruebas/` — 10 fichas JSON de criterios normativos, una por prueba (01 FP aislamiento … 10 DFR): mapa código↔norma con `_fuente` apuntando a dominio/skill; las consume `assets/js/pruebas-electricas-shell.js` vía `fetch('../docs/pruebas/…')`.

---

> Si tras leer este nodo sigues sin ubicar algo, NO adivines: lee la hoja de
> detalle enlazada arriba, o el ADR § correspondiente vía `docs/00-INDICE.md`.
>
> **📏 Capacidad (`CLAUDE.md §G.5`): ~280 líneas.** Al acercarse, SHARD por
> sub-área (ej. extraer `js/` a `21-ESPACIAL-FRONTEND.md`), registrar en
> `CLAUDE.md §0` + `00-INDICE`, dejar puntero aquí.
