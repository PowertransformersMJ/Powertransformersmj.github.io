# 🗺️ 20 — MEMORIA ESPACIAL (Arquitectura / Flujos / Estructura)

> **Nodo neuronal: Memoria Espacial.** Se lee SOLO ante desorientación
> (Trigger de Desorientación, ver `CLAUDE.md §G.2`): cuando dudas de DÓNDE vive
> un componente, CÓMO interactúan los módulos, qué depende de qué, o cómo está
> estructurado el deploy. NO se auto-carga.
>
> Este nodo es un HUB: enlaza a las hojas de detalle. Lee primero el mapa de
> abajo; baja a la hoja específica solo si necesitas el detalle fino.
>
> Verificado archivo por archivo contra el repo real. El instalador `brain-kit/` se
> retiró el 2026-07-23 (respaldo íntegro en la bóveda privada).

---

## 🧭 Mapa rápido de "dónde vive cada cosa"

| Si buscas… | Ve a |
|---|---|
| Lógica de negocio pura (HI, DGA, sobrecarga, refrigeración, RBAC, plan inversión, SAIDI, SCADA, multi-norma pruebas) | `assets/js/domain/*.js` — dominio puro sin Firebase, testable con `node --test` |
| Acceso a Firestore/Storage (CRUD, suscripciones realtime) | `assets/js/data/*.js` — data layers thin I/O que delegan a `domain/` |
| UI de administración (CRUD con sesión admin) | `admin/*.html` + `assets/js/admin/*.js` |
| Páginas públicas/operativas (detrás de session-guard) | `pages/*.html` + `assets/js/*-public.js` |
| Portal de login (única ruta pública) | `index.html` |
| Guard de sesión / roles | `assets/js/auth/session-guard.js` + `page-guard.js` + `admin-guard.js` + `domain/decision_perfil.js` (`§116`) |
| Reglas de seguridad / índices Firestore / Storage | `firestore.rules` · `firestore.indexes.json` · `storage.rules` (deploy manual vía firebase CLI — flujo ADR-005, ver Convenciones) |
| Cloud Functions | `functions/index.js` — 4 exports: `onMuestraCreate`, `cronAlertasDiarias`, `extraerPruebasElectricasIA`, `narrativaTendenciaIA` · el email sale por la Firebase Extension "Trigger Email", NO por código propio |
| Sistema de diseño visual AQUA LIGHT | `assets/css/aqua-tokens.css` + `aqua-components.css` + `assets/js/aqua-shell.js` (barra + menú; cajón ☰ ≤1024 `bindMenu`, reglas de celular ≤720 — `99 §135`) |
| Foto de fondo | `assets/img/aqua/substation-photo.webp` |
| Migraciones / scripts de datos | `scripts/migrate/*.js` (`tipificar-suministros-fan-db.js`, `v1-to-v2-transformadores.js`) |
| Candados de git (`core.hooksPath = githooks`, lo comparten los worktrees) | `pre-commit`: `guardia-cedulas`, `guardia-firmas`, `guardia-scada` y, solo si el commit toca `CLAUDE.md`/`docs/`, `brain-check` + `boot-gate` (TODO-67) · `commit-msg`: cédulas y SCADA en el MENSAJE · `pre-merge-commit`: cédulas · `pre-push`: cédulas, SCADA y **`freno-publicar.mjs`** (código que cite `99 §N` sin su ADR no sube a `main`, `§150`) · los `firebase deploy` no pasan por git (M-10) · kernel en `../brain-private/kernel` (`brain:pull`) |
| Tests | `tests/*.test.js` (el conteo vivo lo lleva `05`) |
| **Importar el Excel real "Salud de Activos"** (la tarea viva del Ingeniero) | `assets/js/domain/importador.js` + `assets/js/data/importar.js` + `admin/importar.html`. 3 hojas; `TPT_Servicio` y `TX_Respaldo` con la cabecera en la **fila 2** (L-72). Proceso → `60-WORKFLOWS` W-13 · historia → `99 §57` y `§69` · Abierta sola, `admin/importar.html` redirige a `admin/administracion.html#tab=importar` (la pestaña la carga en un iframe): lo hace `LEGACY_REDIRECTS` de `aqua-shell.js` (30 páginas viejas); `?legacy=keep` la abre sola (así se usa en la vista previa con stubs). |
| **Fichas Técnicas de reposición** (familia CSS `.ftm-`) | `pages/fichas-tecnicas.html` + `assets/js/ui/fichas/*` + dominio puro `assets/js/domain/fichas_*.js` · **archivo por archivo → [`22`](22-ESPACIAL-MODULOS.md)** · estado vivo y cola → [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md) |
| **Indicadores de calidad** (SAIDI/SAIFI) | `pages/indicadores-calidad.html` + `assets/js/ui/calidad/*` · hoja `INDICADORES-CALIDAD.md` |
| **Seguimiento operativo / cargabilidad** | `pages/seguimiento-operativo.html` + `assets/js/ui/seguimiento/*` · `pages/seguimiento-cargabilidad.html` + `assets/js/ui/cargabilidad/*` + dominio `domain/cargabilidad_*.js` (filas del parque → `_parque`; ventana de detalle → `_detalle`); SCADA del seguimiento: `domain/scada_{config,filtros,ranking,violaciones}.js` + `data/seguimiento_scada*.js` + `css/seguimiento-scada.css` (≠ Cargabilidad SCADA, `scada_carga_*` → `22`) |
| **Cargabilidad SCADA** (`§122`, familia `.cscada`) | `pages/cargabilidad-scada.html` (lista y curvas) + `admin/scada-datos.html` (homologación y carga del mes) · archivo por archivo y colecciones `scada_*` → **[`22`](22-ESPACIAL-MODULOS.md)** |
| **Parque de transformadores / Salud de Activos** | `pages/parque-transformadores.html` · `pages/salud.html` + `assets/js/activos-shell.js` + `domain/salud_activos.js` · `99 §56` |
| **Mapa geográfico de Colombia** (`§152`, familia `.mc-`) | `pages/mapa-v2.html` + `assets/js/ui/mapa/mapa-colombia.js` + `assets/css/mapa-colombia.css` · dominio `domain/mapa_parque.js` · geografía DANE MGN 2025 en `assets/geo/` (regenerar: `scripts/mapa-geo/construir.mjs`) · el viejo `pages/mapa.html` + `mapa-render.js` sigue en la pestaña Mapa de `pages/activos.html` hasta la Etapa 1b |
| **Órdenes de Materiales SSEE** (formato IT.05801, familia `.oms-`) | `pages/ordenes-materiales.html` + `assets/js/ordenes-materiales.js` · registro, cédulas y firmas → **[`22`](22-ESPACIAL-MODULOS.md)** · **≠ «Órdenes»** (`pages/ordenes.html`: órdenes de TRABAJO) |
| **Contratos de suministro · Movimientos · nexo con Órdenes E/S** (`§145`–`§148`) | `pages/contrato.html` (pestañas: `pages/suministros-dashboard.html`, `admin/suministros-movimiento.html`) · nexo y registro automático → **[`22`](22-ESPACIAL-MODULOS.md)** |
| **Firmas personales** (subir/ver/quitar la propia) | `assets/js/domain/firmas.js` + `assets/js/data/firmas.js` (Firestore `firmas/{uid}`) · dónde se usa → **[`22`](22-ESPACIAL-MODULOS.md)** |
| **Firmas del EQUIPO** (custodio admin; delegados `§117`/`§119`) | `assets/js/domain/firmas_equipo.js` + `assets/js/data/firmas_equipo.js` · delegaciones, folio y candado → **[`22`](22-ESPACIAL-MODULOS.md)** |
| Historia/decisión de un subsistema (§NN) | `00-INDICE.md` → `99-HISTORIAL-ADR.md` |
| Reglas permanentes históricas (informes, deep-clean, anti-datalist, etc.) | `30-LECCIONES.md` (condensado) · `_legacy/CLAUDE-previo.md §0.1.2.*` (full) |

---

## 🌐 Ecosistema — el paraguas `~/Desktop/GitHub-MJ/` (ADR-058, 2026-07-28)

El repo NO vive suelto: es un miembro de un ecosistema con **kernel canónico único**.

```
~/Desktop/GitHub-MJ/
├── brain-private/   bóveda privada (repo git aparte, NUNCA pública)
│   ├── kernel/          🔑 KERNEL CANÓNICO (VERSION + .mjs) — escritor único
│   ├── NUEVO-PROYECTO.md  receta: un proyecto nuevo nace conectado
│   └── sgm-transpower/research-archive/  = `archiveDir` (crudos de deliberación)
├── powertransformersmj.github.io/   ESTE repo (público)
├── oltc-capacitacion/ · oltc-metodologia/   trabajo (work/ + entregables/)
└── _archivo/   linajes viejos y capturas — no se toca, no se borra
```

- **Hermandad `repo ↔ brain-private` = ESTRUCTURAL**: de ella cuelgan `archiveDir` y el reparto
  del kernel (`npm run brain:pull` → `../brain-private/kernel/pull.mjs`). Romperla **NO da error**
  (gate #7 degrada a `info` → diría "SANO" con la bóveda desconectada). Tras cualquier mudanza
  exigir literalmente `✅ archiveDir íntegro` **y** `kernel vX.Y.Z íntegro == canónico`.
- **`brain-private` NO se renombra jamás**: `brain-diff.mjs` la ignora por nombre literal.
- Ecosistema **gemelo, NO compartido**, del de un tercero (`~/Desktop/GitHub/`): su bóveda sube a
  una cuenta GitHub ajena y esta guarda material real de cliente AFINIA → **jamás fusionar bóvedas
  ni apuntar `archiveDir` allí**. El kernel se porta por copia + diff, nunca por dependencia.

---

## 🏗️ Estructura del repo (vista aérea)

- **Frontend / cliente**: HTML5 + CSS (sistema AQUA LIGHT) + JS ES6+ vanilla modular. **Sin framework ni bundler** — los `.js` se cargan como ES modules vía `<script type="module">` o CDN. Hosting GitHub Pages.
- **Backend**: Firebase (Auth + Firestore + Storage, proyecto `lordpowertransformersmj`) + Cloud Functions (`functions/`) + Vercel para `/api/*` (hoy solo `api/health.js`).
- **Scripts / herramientas**: `scripts/` — incluye `scripts/migrate/`, `scripts/brain-check.mjs` y `scripts/audit-bloques-pruebas.mjs`. Además `boot-gate.mjs`, `brain-diff.mjs`, `brain-index.mjs`, `brain-archive.mjs`, `dev-server.mjs`, `session-handoff.mjs`.
- **Docs**: `docs/` = neuronas del cerebro + hojas técnicas del dueño (ver sección final). Las del cerebro anterior están en `_legacy/cerebro-anterior/docs/`.
- **CI / Deploy**: `.github/workflows/ci.yml` (lint HTML + `test:unit` + `test:rules` con emuladores) · `pages.yml` (deploy main → GitHub Pages) · `vercel.json` (`/api`). `sw.js` en raíz es kill-switch (PWA desactivada).

### 📁 Estructura de carpetas principales

| Carpeta | Qué contiene | Cómo se carga / consume |
|---|---|---|
| `assets/js/domain/` | Funciones puras de dominio (sin I/O) | Importadas por `data/` y por tests Node |
| `assets/js/data/` | Data layers Firebase (one-shot + realtime `onSnapshot`) | Importadas por las UIs |
| `assets/js/admin/` | Controladores de las páginas `admin/*.html` | `<script type="module">` por página |
| `assets/js/ui/` | Componentes de render por módulo (`pruebas/`, `calidad/`, `cargabilidad/`, `seguimiento/`, `fichas/`, `cargabilidad-scada/`, `scada-datos/` → `22`; `module-shell.js`, `tabs.js`, `contrato-context.js`, `firma-personal.js`, `importar-gases.js`, `foco-modal.js` (foco accesible de modales)) | Importados por los shells de página |
| `assets/js/auth/` · `workers/` · `exports/` · `assets/vendor/` | Guards de sesión (`admin-`/`page-`/`session-guard.js`) · Web Worker del importador SCADA · exportadores PDF/XLSX/XLSM · íconos `lucide` locales | Por página / bajo demanda |
| `assets/css/` | Estilos + sistema AQUA LIGHT | `<link>` por página |
| `admin/` | UIs de administración (CRUD) | Protegidas por `admin-guard.js` |
| `pages/` | Páginas públicas/operativas | Protegidas por `page-guard.js` |
| `functions/` | Cloud Functions (deployable) | `firebase deploy --only functions` |
| `scripts/migrate/` | Migraciones y tipificaciones de datos | Corre el director con firebase-admin |
| `tests/` | Suites `node --test` | `npm run test:unit` |
| `tests-rules/` | Pruebas de reglas Firestore/Storage | `npm run test:rules` (emuladores) |

**⚠️ Reflejo de Frescura (`CLAUDE.md §G.4`):** si mueves/creas/renombras un archivo importante, actualiza esta tabla en el MISMO cambio. Una neurona vieja engaña al próximo "tú" → reproceso/regresión.

---

## 📚 Subsistema Pruebas Eléctricas — extracción IA / tendencia (detalle único)

- **Extracción IA de PDFs (Pruebas Eléctricas)** — CF `functions/index.js#extraerPruebasElectricasIA` (PDF desde Storage → `sanitizarInforme` en `domain/pruebas_electricas_schema.js`); cliente `data/pruebas_electricas.js#extraerConIA`; render `ui/pruebas/*` (tabla, gráficas SVG con eje Y dinámico, panel genérico por bloques con `derivarTablaTAP`). Shell `assets/js/pruebas-electricas-shell.js` (~2,4k líneas) + motor multi-norma `domain/pruebas_electricas_multinorma.js` (+ `_recomendaciones`, `_semaforo`). (`bloquesDeExtra` es LOCAL de `ui/pruebas/grafico-generico.js`.) Detalle completo → `REPOSITORIO-PRUEBAS-ELECTRICAS.md §13` + el arco de ADRs 003→020 en `99`.
  - **Workflow de auditoría/completitud por sección** (detectar→clasificar→corregir→verificar; auditor `scripts/audit-bloques-pruebas.mjs`) → hoja `workflow-auditoria-secciones-pruebas.md`.
  - **Tendencia temporal** (multi-informe): pestaña "Tendencia" + `domain/pruebas_electricas_tendencia.js` (`bloquesTendencia` — escalar peor-caso por prueba vs umbral; determinista, reusa el render genérico). F1-F3 consolidadas: timeline + narrativa IA vía Cloud Function `narrativaTendenciaIA` (desplegada) y cliente `data/pruebas_electricas.js` (httpsCallable, 120s).

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
- `firestore.rules` define además `pruebas_electricas/{id}` (+ subcol `informes/{informeId}` y `diagnostico/{d}`), `contramuestras`, `monitoreo_intensivo`, `parametros_sistema`, `subactividades`/`macroactividades`/`causantes` (catálogos), `propuestas_reclasificacion_fur`, `gate_codes/{hash}`, `correcciones`, `suministros_config`. NO existe bloque `match /catalogos` en rules (el `data/catalogos.js` es genérico por nombre de colección).

Documento transformadores v2 y colecciones F17–F37 (al 2026-04-20) → `docs/MODELO-DATOS-v2.md`. Lo posterior (`scada_*`, `firmas*`, `fichas_*`, `ordenes_materiales*`, `ultima_dga`) → `22` y `firestore.rules`.

---

## ⚙️ Convenciones espaciales (dónde NO equivocarse)

- **Deploys Firebase y git**: los ejecuta Claude (`firebase deploy --only …` con la CLI local autenticada; commit/push/merge) → la regla vive en `CLAUDE.md §2` y los gotchas en `30` **L-01**/**L-09**.
- **`/suministros/{X}` usa docId compuesto** `{contrato_id}_{codigo}` desde la migración N5 — usar `composeDocId(cid, codigo)` (definido en `domain/contratos.js`, re-exportado por `data/suministros.js`), nunca el código plano (ver `30-LECCIONES`).
- **No hay bundler**: los `.js` son ES modules directos; rutas relativas importan (`../domain/x.js`). Nada pasa por transpilación.
- **Lint local con `npm run lint:html`** (NO `npx html-validate` — descarga versión transitoria distinta a la de CI).

---

## 🗂️ Hojas de detalle del proyecto → hija `21`

> El inventario de las hojas técnicas del dueño (qué contiene cada `docs/*.md` y para qué sirve)
> vive en [`21-ESPACIAL-HOJAS.md`](21-ESPACIAL-HOJAS.md). Se consulta a demanda: aquí solo se
> nombran desde el mapa de arriba cuando hacen falta.

> Si tras leer este nodo sigues sin ubicar algo, NO adivines: lee la hoja de
> detalle enlazada arriba, o el ADR § correspondiente vía `docs/00-INDICE.md`.
>
> **📏 Capacidad (`CLAUDE.md §G.5`): el tope que aprieta es el de CARACTERES** (manifest). Al acercarse, SHARD por
> sub-área (ej. extraer `js/` a una hija con número libre: `21` y `22` ya existen), registrar en
> `CLAUDE.md §0` + `00-INDICE`, dejar puntero aquí.
