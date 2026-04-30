# Changelog — SGM · TRANSPOWER

Evolución v1.0 → v2.0 conforme **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM).

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).
Semver por tag. Pulido post-v2.0 incrementa el patch (v2.0.1,
v2.0.2, …) sin promesas de incompatibilidad.

## v2.7.0 — Sidebar contratos como toggle puro + admin upload de PDFs (2026-04-27 PM4)

Microcirugía adicional al módulo Contratos según lineamientos del
director. Documentación en `docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`
sección 'v2.7.0 follow-up'. 4 fases atómicas (A, B, C, D).

### Resumen ejecutivo

- **Número de contrato deja de ser link**: 4123000081 / 4125000143
  pasan de `<a href>` a `<button class="sb-item-toggle">`. Click solo
  expande/colapsa el árbol; la navegación al dashboard del contrato
  sale exclusivamente por el sub-item "Control y Gestión Operativa".
  Misma filosofía aplicada antes a la categoría "Suministro de
  Elementos…" — consistencia total.
- **UI admin para gestionar PDFs contractuales**: botón
  "+ Agregar documento" en la cabecera de la lista (visible solo a
  admin) + hover-action de eliminar en cada doc. Modales con form
  glass material y barra de progreso resumable.
- **Wire a Firebase Storage + Firestore**: upload via
  `uploadBytesResumable` con onProgress 0-100, idempotente por slug
  (re-subir el mismo título sobreescribe). Delete con `deleteObject`
  + filter del array Firestore. Manejo de errores con pista de
  deploy de storage rules cuando aplica.

### Micro-fases (4 commits)

- **Fase A** — `76f7b88` fix(sidebar): número de contrato es
  `<button>` toggle, no link. CSS reutilizado de
  `.sb-item-toggle` (sin nuevas reglas).
- **Fase B** — `3f7963e` feat(contrato-info): UI admin de
  upload/eliminar (HTML + CSS). Modales glass material con
  campos título / categoría / archivo. Botón delete absoluto en
  hover sobre cada doc.
- **Fase C** — `450f2f9` feat(contrato-info): wire a Firebase
  Storage + Firestore. Nuevas funciones `subirDocumento`,
  `eliminarDocumento`, `slugFromTitle` en el data layer.
  Detección de admin via `window.__sgmSession.role` con fallback a
  evento `sgm:session-ready`.
- **Fase D** — Esta documentación.

### Decisiones técnicas

1. **`<button>` para nodos solo-toggle** (consistencia con la
   categoría). Cuando un nodo de árbol no debe navegar, es siempre
   `<button>` para semántica correcta y reset uniforme via CSS
   `.sb-item-toggle`.
2. **`uploadBytesResumable` en lugar de `uploadBytes` simple** — da
   onProgress y permite que el director vea %  durante el upload de
   PDFs grandes (algunos pesan 11 MB).
3. **Idempotencia por slug**: si el director sube un doc con título
   que ya existe (mismo slug), el archivo en Storage se sobreescribe
   y el array Firestore filtra el duplicado antes de hacer push.
   Re-ejecutar es seguro.
4. **Delete tolerante a 404 en Storage**: si el objeto ya no existe
   en Storage (alguien lo borró por consola o nunca se subió), el
   filter del array Firestore se ejecuta igual para limpieza.
5. **Wrapper div** (`.cloud-doc-wrap`) para evitar `<button>` dentro
   de `<button>` (HTML5 inválido). El delete absoluto se posiciona
   sobre el wrap, hover-detection en el wrap.
6. **Manejo de errores con pista de deploy**: si el upload/delete
   recibe `permission-denied`, el mensaje incluye sugerencia de
   ejecutar `firebase deploy --only storage` (referencia a la
   regla §0.1.1 de CLAUDE.md sobre protocolo de deploys).

### Pendientes post-v2.7.0

- **Deploy de storage rules** (si no se hizo en v2.6.0):
  ```
  firebase deploy --only storage
  ```
- **Verificar rol admin del director** está activo en Firestore
  `/admins/{uid}` o `/usuarios/{uid}` con `rol=admin`.
- **Probar upload + delete en producción** después del merge.

## v2.6.1 — Hotfixes Información Contractual · URL absoluta + scroll iframe (2026-04-27 PM3.5)

Dos bug fixes inmediatos al cierre de v2.6.0 reportados por el director
durante la verificación visual de la página `pages/contrato-info.html`.

### Bugs corregidos

**Bug 1 — `0bd2122` URL absoluta del PDF (404 en visor)**

Síntoma: la lista lateral de PDFs cargaba bien pero al hacer click en
un doc el visor mostraba "404 File not found".

Causa raíz: `urlDocumento(cid, slug)` devolvía la cadena RELATIVA
`assets/docs/contratos/{cid}/{slug}`. El navegador la resolvía contra
`location.href` de la página, dando:

```
https://.../LordPowerTransformersMJ.github.io/pages/assets/docs/...
                                              ^^^^^ pages/ sobrando
```

GitHub Pages 404 porque el path real es sin `pages/` en medio.

Fix: la función ahora prepende `BASE_HREF` resuelto desde
`import.meta.url` (mismo patrón que `aqua-shell.js` y la función
`cargarManifest()` que ya funcionaba). URLs absolutas que no
dependen del path de la página llamante.

**Bug 2 — `91dec5f` empty-state + scroll del PDF**

Síntoma: el placeholder "Selecciona un documento / Elige un PDF…"
se veía como marca de agua sobre el PDF aún después de seleccionar
uno; y la rueda del mouse no scroleaba dentro del PDF.

Causa 1 (empty-state): `.viewer-empty { display: flex }` ganaba en
especificidad sobre el `[hidden] { display: none }` implícito del
browser. Setear `hidden=true` no surtía efecto visual.

Fix 1: regla explícita `.viewer-empty[hidden] { display: none
!important }`. Lo mismo para `.viewer-frame[hidden]` por consistencia.

Causa 2 (scroll): el iframe se cargaba con `src='...pdf#view=FitH'`.
El parámetro `FitH` instruye al visor PDF nativo a fit-horizontal
(página entera en ancho), lo que en Chrome/Safari resulta en una
vista single-page que NO captura wheel events.

Fix 2: removido el `#view=FitH` del src. La URL bare deja al visor
nativo del browser en su modo default (vista continua con scroll
vertical funcional).

## v2.6.0 — Microcirugía Suministros · Información Contractual + visor PDF (2026-04-27 PM3)

Reestructura del módulo Suministros / Contratos según lineamientos
del director, en 6 fases atómicas (commits aislados). Documentación
completa en `docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`.

### Resumen ejecutivo

- **Sidebar restructurado**: la categoría "Suministro de Elementos y
  Accesorios para Transformadores de Potencia" pasa de ser un link
  (`<a href>`) a un nodo padre puro (`<button>`). Click solo
  expande/colapsa, no navega.
- **Fondo aqua glass del sidebar recuperado**: el director había
  perdido el material Liquid Glass del sidebar al revertir el dark
  mode. Restaurado al diseño v2.1.0-aqua original con
  `background: rgba(255,255,255,.36-.22)` + `blur(52px)
  saturate(200%) brightness(108%)` + highlight 3D superior.
- **Nueva página Información Contractual** con nube documental:
  visor PDF embebido (iframe nativo), buscador instantáneo, lista
  agrupada por categoría, hash routing para refresh, fullscreen API.
  Cero dependencias externas.
- **13 PDFs (39 MB)** commiteados al repo desde las carpetas
  `Contrato N° XXX Informacion Contractual/` con paths URL-safe en
  `assets/docs/contratos/{cid}/`. Manifest JSON con título legible
  + categoría + peso. PDFs sirven inmediato vía GitHub Pages.
- **Script Node** `scripts/deploy-pdfs-storage.js` para migrar a
  Firebase Storage cuando el director quiera. Idempotente por md5.
  Genera URLs firmadas (exp 2100) e inyecta el array
  `documentos_contractuales[]` en `/contratos/{cid}` Firestore.
- **Auditoría visual WCAG AA**: corrección de contraste en chips,
  iconos y tabs donde `color: var(--brand)` se usaba sobre
  `rgba(0,122,255,.14)` (contraste 3.8:1 → 5.4:1 con `--brand-deep`).

### Micro-fases (6 commits)

- **#1 Fase 1** — Inventario PDFs + plan de microcirugía
  (`docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`).
- **#2 Fase 2** — Sidebar: categoría como nodo padre + recuperar
  fondo aqua glass.
- **#3 Fase 3** — Página `pages/contrato-info.html` con visor PDF
  embebido (split layout: lista + visor). 4 archivos nuevos:
  `contrato-info.html`, `contrato-info.css`, `contrato-info.js`,
  `data/documentos_contractuales.js`. PDFs movidos a paths URL-safe.
- **#4 Fase 4** — `scripts/deploy-pdfs-storage.js` Node ESM con CLI
  args (`--service-account`, `--contrato`, `--dry-run`). Update de
  `storage.rules` con match `/contratos/{contratoId}/{filename=**}`
  (read:true, write:isAdmin con tope 50 MB).
- **#5 Fase 5** — Auditoría visual: 6 reglas CSS migradas de
  `var(--brand)` a `var(--brand-deep)` para mejor contraste.
- **#6 Fase 6** — Esta documentación.

### Decisiones técnicas

1. **Visor PDF nativo** (iframe + `#view=FitH`) en lugar de PDF.js.
   Cero dependencias, los navegadores modernos lo manejan
   internamente (Chrome PDF Viewer, Safari built-in, Firefox PDF.js
   integrado). PDF.js queda como fallback futuro si aparecen
   limitaciones.
2. **Manifest JSON** + paths URL-safe. Los PDFs originales tenían
   acentos, espacios y caracteres especiales (ñ, °, etc.) que
   complicaban URLs. El slug normalizado (NFD + lowercase + dash)
   resuelve el transporte; el manifest preserva el título humano.
3. **Doble canal de transporte**: GitHub Pages (default, vía
   manifest local) + Firebase Storage (override vía
   `/contratos/{cid}.documentos_contractuales[]`). Cuando el director
   ejecute el deploy script, Firestore gana sobre el manifest local
   sin tocar el frontend.
4. **`<button>` para nodos solo-toggle**: la categoría de contratos
   se convirtió de `<a>` a `<button>` para semántica correcta. CSS
   reset del button (border, font, background) normalizado.
5. **Hash routing** (`#doc=slug`) para que un refresh o un
   share-link restaure la selección del PDF.

### Archivos clave

- `assets/css/aqua-components.css` — `.sb` con material aqua glass
  restaurado, contraste WCAG AA en chips/icons
- `assets/css/contrato-info.css` — layout split + estilos del visor
- `assets/js/aqua-shell.js` — categoría como `<button>`, hrefs
  Información Contractual → `pages/contrato-info.html?id=NNN`
- `assets/js/contrato-info.js` — controlador de la página (lista,
  buscador, visor, hash routing, fullscreen)
- `assets/js/data/documentos_contractuales.js` — data layer dual-channel
- `pages/contrato-info.html` — shell de la página
- `assets/docs/contratos/{4123000081,4125000143}/` — 13 PDFs +
  manifest.json
- `scripts/deploy-pdfs-storage.js` — migrador a Firebase Storage
- `storage.rules` — match `/contratos/{cid}/{filename=**}`

### Pendientes post-v2.6.0

- Deploy de `storage.rules` por el director: `firebase deploy --only storage`
- Eventual ejecución de `node scripts/deploy-pdfs-storage.js
  --service-account ~/sa.json` cuando el director quiera migrar los
  PDFs de GitHub Pages a Firebase Storage (sin urgencia).
- Si se necesitan más documentos contractuales en el futuro, se
  agregan al manifest JSON o vía Firestore override.

## v2.5.1 — Iteraciones visuales · revert aqua light + JSX removal + SIN DATOS fix (2026-04-27 PM2)

Período de afinamiento entre v2.5.0 (UI v3 dark mode) y v2.6.0
(microcirugía Suministros). 5 commits incrementales no agrupados en
un plan formal pero todos en la misma sesión.

### Cambios consolidados

1. **`215f615` Foto Fondo PT.jpg** — el director subió un primer
   reemplazo (1920×1080 JPEG, 1.16 MB). Procesada con `optimize=True
   progressive=True` + EXIF stripped → 365 KB sin pérdida visual.
   PR #105.
2. **`8c32420` Foto Fonto PT.jpg** — segunda iteración con fuente
   más grande (2880×1620, 2.9 MB). Redimensionada a 2560×1440 LANCZOS
   q88 progressive → 657 KB retina-suitable. PR #106.
3. **`50cf27a` Revert dark mode → aqua light** — el director pidió
   "letras de color negro que haga match con el entorno aqua".
   Tokens revertidos: ink-1 #f3f7ff → #0d1f38 (steel navy deep),
   glass tokens rgba(8,18,35,X) → rgba(255,255,255,X) (blanco perla
   translúcido), specular y borders restaurados al diseño v2.1.0-aqua
   original. PR #107.
4. **`7310a33` Foto FONDO POWERTRANSFORMER.jpg en WebP** — tercera
   iteración (2880×1620, 3.4 MB JPG). Convertida a WebP q=95 method=6
   sin redimensionar para garantizar nitidez en monitores 4K/5K.
   1.07 MB final · 67% reducción vs JPG original con calidad
   visualmente idéntica. PR #108.
5. **`c41d316` Importador canal único Excel + tag SIN DATOS dinámico** —
   el director pidió retirar JSX como canal de importación
   (`control_suministros-2.jsx`) y arreglar el tag "SIN DATOS" pegado
   en el contrato 4125000143 después de su importación. PR #109.

### Detalle del refactor JSX (commit `c41d316`)

**Eliminado del importador** (UI + data + domain):
- Campo `<input type="file" id="jsxInput">` y botón "Subir .jsx"
- Funciones `parsearJsxTransformadores`, `parsearJsxCatalogo`,
  `enriquecerCatalogoConJsx`, `jsxRowADocV2`,
  `extraerCorreccionesEmbedded`, `reconciliarEquipos` (6 funciones,
  ~270 líneas en domain)
- Etapas /transformadores y /correcciones de `ejecutarImportacion`
- 5 describes de tests asociados a JSX
- Archivo `control_suministros-2.jsx` borrado del repo

**Razón**: el JSX era un canal de bootstrap one-time. Sus datos
(206 transformers, 22 catalog items con valU, 3 correcciones
hardcoded) ya viven en Firestore desde imports anteriores. Re-leer
de JSX en cada import sobreescribía el `valor_unitario` que el
director ajustaba manualmente desde `admin/suministros-catalogo.html`.
Excel queda como motor único de importación.

### Detalle del fix SIN DATOS (mismo commit `c41d316`)

**Causa raíz**: en `assets/js/contratos-public.js` el flag
`con_datos: false` para 4125000143 estaba HARDCODEADO en el array
seed `CATEGORIAS_SEMILLA`. La suscripción a `/contratos` solo
agregaba contratos no-semilla, jamás actualizaba los flags de
contratos semilla.

**Fix**: nueva función `aplicarEstadoFirestore()` que mergea cada
contrato semilla con el doc Firestore `/contratos/{id}`. Si el doc
existe y tiene `ultima_importacion` (lo escribe el importador al
final de cada bulk), el flag `con_datos` queda `true` y el tag SIN
DATOS desaparece. Auto-corregible: la primera importación al
contrato 4125 quita el tag automáticamente.

### Tests

- 468/468 → 453/453 verde (perdimos 15 tests del JSX, esperado)
- Lint HTML limpio en cada commit

## v2.5.0 — UI v3 dark mode · foto IMG_9840 · drilldown contratos (2026-04-27 PM)

Refactor visual completo del shell sobre la nueva foto de fondo
`IMG_9840.HEIC` que el director subió al repo. 14 PRs micro
(#90–#103) en una sola sesión. Documentación completa en
`docs/UI-V3-DARKMODE.md` y `CLAUDE.md` §9 reescrito.

### Resumen ejecutivo

- **Foto nueva** `assets/img/aqua/substation-photo.jpg` 2560×1920,
  1.16 MB JPEG q88. Origen: `IMG_9840.HEIC` 5712×4284 convertida
  con `pillow-heif` + redimensionada con LANCZOS. Subestación
  Caribe Colombiano de noche con luces puntuales sobre aisladores.
- **Dark mode completo**: inks claros (`#f3f7ff` títulos,
  `#d6e0ec` cuerpo, `#a0b3ca` meta, `#6f7f96` placeholder), glass
  tokens con tint navy oscuro `rgba(8,18,35,X)` en vez de
  `rgba(255,255,255,X)`. Topbar, sidebar y page titles con
  text-shadow oscuro para legibilidad.
- **Sidebar transparente** (`background: transparent !important;
  backdrop-filter: none !important`). La foto se ve a través
  directamente.
- **Drilldown contratos en sidebar**: bajo cada número de contrato
  (4123000081, 4125000143) ahora se despliegan dos links terminales
  — "Control y Gestión Operativa" e "Información Contractual" —
  que cargan el contrato en el panel derecho con o sin tab
  pre-seleccionado.
- **Service Worker kill-switch**: el SW v3-5-2 (cache-first) que
  bloqueaba deploys queda reemplazado por uno que se
  auto-desregistra al activarse. PWA offline-first temporalmente
  desactivada — prioridad: deploy y se ve.
- **Foto vieja borrada** (`substation-photo.png` 1598×1599 con
  41% de área útil) y archivos HEIC de tránsito removidos del
  repo.

### Micro-fases (14 PRs)

- **#90** — Swap foto thumbnail (755×752) → hi-res (3840×2400 con
  padding blanco interno).
- **#91** — Cobertura full-viewport `.aqua-power-scene` con
  `width: 100vw; height: 100vh; height: 100dvh`.
- **#92** — Sidebar más transparente (rgba .18-.08, blur 20px).
- **#93** — SW bump v3-5-2 → v3-5-3.
- **#94** — Sidebar prácticamente transparente (rgba .06-.02,
  blur 8px).
- **#95** — SW refactor a network-first.
- **#96** — SW kill-switch auto-desregistra.
- **#97** — Sidebar 100% transparente (`!important`) + text-shadow
  blanco halo.
- **#98** — Recorte de la foto al bounding box no-blanco
  (3840×2400 → 1598×1599) eliminando 60% de padding blanco interno.
- **#99** — Nueva foto IMG_9840 procesada · HEIC 3.9 MB →
  JPEG 2560×1920 1.16 MB.
- **#100** — Dark mode tokens (inks claros, glass navy oscuro,
  topbar dark, text-shadows oscuros).
- **#101** — Submenu inicial "Información Contractual" bajo cada
  contrato (luego refactorizado).
- **#102** — Drilldown 5 niveles · `markActive()` reescrito para
  desambiguar por hash `#tab=`, expandir cadena completa de
  árboles ancestros · `bindTreeToggle()` respeta `aria-expanded`
  inicial del caret.
- **#103** — Refactor: "Control y Gestión Operativa" e "Información
  Contractual" como links terminales (no acordeones), proper case
  (sin uppercase). Removidos los 5 leaves (Dashboard, Catálogo,
  Movimiento, Histórico, Importar) del sidebar — ya viven como
  tabs en el panel derecho del contrato.

### Lecciones técnicas

1. **HEIC no es válido como CSS background-image** en Chrome/Firefox.
   Pipeline establecido: `pillow-heif` → resize LANCZOS → JPEG q88
   progressive optimize=True.
2. **Padding blanco dentro de un PNG** es invisible para el
   desarrollador pero `background-size: cover` lo estira hasta los
   bordes del viewport. Detectar bounding box no-blanco con
   PIL+numpy antes de usar fotos como fondo:
   ```python
   non_white = np.any(arr < 245, axis=2)
   rows = np.any(non_white, axis=1)
   cols = np.any(non_white, axis=0)
   ```
3. **Service Workers cache-first bloquean deploys de GitHub Pages**
   incluso bumpeando `CACHE_VERSION` — Safari no chequea `sw.js`
   con suficiente frecuencia. Solución de raíz: kill-switch SW
   que se auto-desregistra al activarse.
4. **`markActive()` con multi-active** ocurría cuando varios
   sidebar items compartían el mismo `?id=`. Fix: agregar
   comparación de hash `#tab=` y elegir un solo ganador antes de
   marcar `is-active`.
5. **`bindTreeToggle()` forzando expand-all** impedía colapsar
   árboles por default. Fix: respetar el `aria-expanded` inicial
   del botón caret.
6. **Project page URL** (`ajimenezp99-jpg.github.io/LordPowerTransformersMJ.github.io/`)
   distinta de user page (`ajimenezp99-jpg.github.io/`). La user
   page retorna 404. Documentado en CLAUDE.md §9.7.

### Archivos clave

- `assets/css/aqua-tokens.css` · inks dark + glass navy
- `assets/css/aqua-components.css` · topbar dark, sidebar
  transparent, sidebar 4-level structure (greatgrandchild proper
  case), text-shadows dark
- `assets/js/aqua-shell.js` · `markActive()` con hash matching,
  `bindTreeToggle()` respetando aria-expanded
- `assets/img/aqua/substation-photo.jpg` · foto activa
- `sw.js` · kill-switch
- `pages/dashboard.html` · removida llamada a `register('/sw.js')`
- `docs/UI-V3-DARKMODE.md` · documento de decisiones de diseño

### Pendientes post-v2.5.0

- **Datos de Información Contractual** · cuando el director suba
  el archivo (formato/contenido por definir), montar tab
  `#tab=info-contractual` en `pages/contrato.html` que renderice
  los datos.
- **Reactivar PWA offline-first** después de validar que los
  deploys quedan estables · sustituir kill-switch por SW
  network-first probado.
- **Revocar segundo PAT** (`ghp_kzk3…`) cuando termine la
  iteración visual.

## v2.4.1 — Deploy contrato 4125000143 · export espejo + rules multi-contrato (2026-04-27)

Integración del nuevo dataset del contrato **4125000143**
(`Gestion_Suministros_Transformadores_4125000143.xlsm`) sobre la
arquitectura multi-contrato N1–N5. 9 micro-fases atómicas (A, B,
pre-E, D, E.1–E.6, F).

### Resumen ejecutivo

- 25 SKUs nuevos (S01–S25, +3 bujes 13.8/34.5/66-110 kV) detectados
  en el archivo del contrato y validados contra el parser puro.
- Exportador `.xlsm` reescrito como **espejo completo** del template
  canónico: además de Movimientos (sheet6/table4), ahora cubre
  Catálogo (sheet2/table1), Marcas (sheet3/table2), ListasMarcas
  oculta (sheet4) y `definedName Sxx` extendidos en workbook.xml.
- `vbaProject.bin` del template se preserva idéntico (md5
  `5ab76c9f…`); macros operativos al abrir el archivo exportado.
- Seeder Node CLI `scripts/import-contrato.js` para importar el
  catálogo de cualquier contrato server-side desde la Mac del
  director, vía service-account JSON.
- 3 bugs pre-existentes de N3-N5 corregidos: rules multi-contrato,
  estado de `/contratos` al auto-registrar, y replace-with-`$`
  patterns en exporter (que generaba 179 definedName duplicados).

### Micro-fases

- **FASE A** — Análisis estructural de los dos `.xlsm`. Reporte
  completo en `docs/CONTRATO_4125000143_ANALISIS.md`. Inventario
  ZIP idéntico (35 partes), workbook con 8 hojas mismo `r:id`,
  vbaProject.bin distinto entre archivos (decisión: usar el del
  template como canónico), `definedName` para S23-S25 ausente,
  ListasMarcas reestructurada en el archivo del contrato.
- **FASE B** — Test dryrun del parser puro contra el archivo real
  (`tests/import_4125000143_dryrun.test.js`, 12 tests verde):
  estructura del .xlsm, parseo de 25 sumins, S23/S24/S25 con
  stock_inicial 3/3/6, marcas filtradas por placeholders,
  prepararPlanImportacion con Firestore vacío vs catálogo previo.
  `xlsx@0.18.5` añadido como devDependency.
- **FASE C** — No-op confirmado. Regex y enums actuales aceptan
  el archivo nuevo sin cambios al parser/dominio.
- **FASE pre-E** — `firestore.rules`: bug pre-existente en línea
  496 (`data.codigo == id`) bloqueaba writes con docId composite
  introducido por N5. Helpers nuevos `isContratoIdValido` y
  `isSuministroDocId`. Validación opcional de `contrato_id` añadida
  a `/suministros`, `/marcas`, `/movimientos`, `/correcciones`.
  Inmutabilidad de `codigo` en updates conservada. **Requiere
  deploy manual** (`firebase deploy --only firestore:rules`).
- **FASE D** — `scripts/import-contrato.js` CLI seeder con
  `firebase-admin@^13.8.0`. Reusa el parser puro del dominio,
  acepta `--xlsm`, `--contrato-id`, `--service-account`, `--dry-run`,
  `--uid`, `--nombre`. Idempotente. Audita en /audit. Bug paralelo
  fixed: importer web escribía `estado: 'activo'` a /contratos/{cid}
  (N5 commit aac5994), valor que las rules rechazaban con try/catch
  silenciado → ambos paths (UI + CLI) ahora escriben
  `estado: 'vigente'` con payload completo del contrato_schema F21.
- **FASE E.1** — `parchearSheet2` + `generarFilaCatalogoSuministro`:
  reescribe Catálogo con fórmulas individuales (no shared) para
  SUMIFS/Stock_Actual/Alerta. 8 tests nuevos.
- **FASE E.2** — `parchearSheet3` + `generarFilaMarca`: reescribe
  Marcas. 7 tests nuevos.
- **FASE E.3** — `parchearSheet4` + `colLetter`: reescribe
  ListasMarcas oculta con layout estable 3 filas × N cols. Cierra
  el gap detectado en FASE A. 8 tests nuevos.
- **FASE E.4** — `parchearTable1` (`tblSuministros`) y
  `parchearTable2` (`tblMarcas`): refs `B3:J{3+n}` y `B3:D{3+n}`.
  5 tests nuevos.
- **FASE E.5** — `parchearWorkbookXml`: extiende `definedName Sxx`
  para todos los suministros del catálogo (idx → colLetter).
  Preserva `ent_*`, `flt_*` intactos. 5 tests nuevos.
- **FASE E.6** — Wire-up de `generarXlsmExport(payload, opts)` con
  firma extendida backwards-compat. **Bug crítico corregido en
  TODOS los helpers**: `String.replace(regex, "templateLiteral")`
  interpreta `$1`/`$&`/`$'`/`$\`` en el reemplazo. Las fórmulas
  Excel y los `definedName` con `$F$6`/`$E25` corrompían el
  output. Fix: cada `replace` con template literal pasó a callback
  function. Test de integración `tests/xlsm_export_integracion.test.js`
  con archivo real (2 tests). devDeps: `jszip@^3.10.1`.

### Estado al cierre

- Suite **468/468 tests verde**, lint HTML limpio.
- Branch `claude/deploy-contract-dataset-Fx8eG`, listo para PR a
  `main`.
- Archivo `.xlsm` exportado real verificado: 82212 bytes, 25 SKUs,
  vbaProject.bin md5 = `5ab76c9f…` (igual al template), tablas
  con refs correctas, dropdowns operativos para los 25 SKUs, abre
  en Excel/SheetJS sin errores.

### ⚠ Requiere deploy manual tras merge

```bash
firebase deploy --only firestore:rules
```

Sin esto, el seeder server-side (FASE D) y el importer web (con
contrato_id) fallan con `permission-denied` por la regla pre-N3.

### Cómo cargar el contrato 4125000143 a producción

1. Mergear esta rama a `main`.
2. Deployar rules: `firebase deploy --only firestore:rules`.
3. Generar service-account JSON: Firebase Console → Project
   Settings → Service accounts → Generate new private key. Guardar
   FUERA del repo.
4. Ejecutar el seeder en dry-run para revisar el plan:
   ```bash
   node scripts/import-contrato.js \
     --xlsm Gestion_Suministros_Transformadores_4125000143.xlsm \
     --contrato-id 4125000143 \
     --service-account ~/.firebase/sa-transpower.json \
     --dry-run
   ```
5. Si el plan se ve bien, ejecutar sin `--dry-run`. Idempotente.
6. Verificar en `pages/contratos.html` que aparece el contrato
   4125000143; entrar y ver Catálogo con S01-S25.

## v2.4.0 — Refactor Contratos · arquitectura escalable multi-contrato (2026-04-25)

Reorganización de la navegación para soportar de forma escalable múltiples
contratos de suministro. El módulo "Suministros" (que era flat y
monocontrato) pasa a vivir jerárquicamente dentro de un contrato; cada
contrato futuro replica la misma estructura de tabs sin duplicación de
código. 5 microfases atómicas (M1–M5).

### Microfases

- **M1** — Eliminación del módulo Correcciones. Tab + tabpanel removidos
  de pages/suministros.html, archivos admin/suministros-correcciones.html
  y assets/js/admin/admin-suministros-correcciones.js eliminados, redirect
  legacy retirado de aqua-shell.js. El data layer
  data/correcciones.js y la rule firestore.rules para /correcciones
  permanecen intactos por backwards-compat (3 docs sembrados desde el JSX
  siguen accesibles, colección reusable a futuro).
- **M2** — pages/contratos.html con grid responsive de cards. Cada card
  tiene icon + número + estado-pill + nombre + fechas + footer con flecha
  animada. Suscripción realtime a /contratos con filter tipo='suministros';
  fallback a contrato semilla 4123000081 cuando la query devuelve vacío,
  con tag visible 'SEMILLA' para indicar que aún no está formalmente
  registrado.
- **M3** — pages/contrato.html?id=XXX shell dinámico. Lee el id del query,
  renderiza header con número y nombre cargados desde /contratos/{id}
  (con fallback a META_SEMILLA mientras Firestore responde). 5 tabs sin
  Correcciones: Dashboard (público) · Catálogo · Movimiento · Histórico ·
  Importar (admin). Reusa initModuleShell del refactor v2.3.
- **M4** — Sidebar refactor: 'Suministros' → 'Contratos' (icon
  file-text). LEGACY_REDIRECTS actualizado para que las 5 URLs viejas
  de Suministros lleven al contrato semilla con tab correcta. El shell
  pages/suministros.html antiguo también redirige.
- **M5** — Cache PWA sgm-v3-3-0 → sgm-v3-4-0 + CHANGELOG + tag.

### Patrón escalable para nuevos contratos

Cuando llegue un Excel de un contrato adicional:
1. Importador F42 amplía para detectar el `contrato_id` del Excel.
2. Crea/actualiza /contratos/{id} con tipo='suministros'.
3. Filtra los docs sembrados por contrato_id (suministros, marcas,
   movimientos).
4. La página pages/contratos.html lo lista automáticamente vía
   onSnapshot.
5. Click en la card → pages/contrato.html?id={N} carga sus tabs
   con datos filtrados.

Cero refactor de UI necesario para soportar el contrato N+1.

### Métricas

- 5 microfases · 5 commits aislados
- ~530 LOC nuevas (pages contratos/contrato + controllers + CSS cards)
- 341 LOC eliminadas (módulo Correcciones)
- Tests siguen 399/399 verdes (el módulo de Correcciones eliminado no
  tenía tests automatizados)
- Cero deploys nuevos
- Cache PWA bump

---

## v2.3.0 — Refactor UX · Navegación consolidada con tabs (2026-04-25)

Reorganización inteligente de TODOS los menús del portal. Sidebar pasa
de 32 entradas dispersas a **8 módulos jerárquicos** con tabs internas.
9 microfases (R0–R9) atómicas, cada una shippable independientemente.

### Bloque · Componente reutilizable

- **R0** — `assets/js/ui/tabs.js` ARIA-compliant con keyboard nav y hash
  routing. `assets/css/tabs.css` con estilo Aqua liquid-glass sticky.
  17 tests para los helpers puros (parseHash/buildHash/mergeHash).

### Bloque · Consolidación módulo a módulo

- **R1** — Suministros: 6 vistas (Catálogo, Movimiento, Histórico,
  Correcciones, Importar, Dashboard) → 1 con tabs.
- **R2** — Salud del Activo: 5 vistas (Muestras, Motor HI, Propuestas
  FUR, Contramuestras, Fallados+RCA) + Matriz Riesgo movida desde
  Análisis → 1 con tabs.
- **R3** — Activos: 4 vistas (Inventario, Mapa, Subestaciones,
  Contratos) → 1 con tabs.
- **R4** — Análisis: 5 vistas (Dashboard, KPIs RAM, Alertas, Plan
  Inversión, Desempeño Aliados) → 1 con tabs.
- **R5** — Administración: 5 vistas (Panel, Usuarios, Catálogos,
  Importar Excel, Auditoría) → 1 con tabs.
- **R6** — Recursos: 4 vistas (Documentos, Normativa, Cobertura,
  Acerca) → 1 con tabs.
- **R7** — Reescritura del sidebar: distribuida orgánicamente en R1–R6.

### Bloque · Compatibilidad y cierre

- **R8** — `LEGACY_REDIRECTS` en aqua-shell.js: 28 URLs viejas
  redirigen automáticamente a la página padre con tab activa. Preserva
  bookmarks. Escape hatch `?legacy=keep` para acceso standalone.
- **R9** — Cache PWA `sgm-v3-2-0` → `sgm-v3-3-0` + CHANGELOG + tag.

### Patrón técnico

- **Sin refactor de subscreens**: cada vista existente sigue siendo una
  página completa que se embebe vía `<iframe lazy data-src>`. El
  `module-shell.js` genérico (initModuleShell) es un wrapper de 1
  línea por módulo sobre `tabs.js`.
- **Detección de iframe en aqua-shell.js**: si `window.self !== window.top`
  marca el body con `.is-embedded` y oculta topbar/sidebar/escena Aqua
  para no duplicar el shell del padre.
- **Hash routing**: cada tab activa actualiza `location.hash` con
  `history.replaceState` (no llena el back stack); `hashchange` listener
  permite back/forward del browser entre tabs.
- **RBAC visual**: tabs marcadas `data-admin="1"` se ocultan a
  no-admins leyendo `window.__sgmSession.profile.rol`.

### Métricas

| Métrica | Antes (v2.2.0) | Después (v2.3.0) |
|---|---|---|
| Entradas en sidebar | 32 | **8** (-75%) |
| Páginas standalone | 30+ | mantenidas (compat) |
| Tests | 382 | **399** (+17 helpers tabs) |
| LOC nuevas | — | ~900 (shells + redirects) |
| LOC eliminadas | — | 0 (zero refactor de legacy) |
| Deploys nuevos | 0 | 0 (puro client-side) |

### Estructura final del sidebar

| Grupo | Entrada | Ruta | Tabs internas |
|---|---|---|---|
| Operación | Inicio | `home.html` | — |
| Operación | **Activos** | `pages/activos.html` | Inventario · Mapa · Subestaciones · Contratos |
| Operación | Órdenes | `pages/ordenes.html` | — |
| Operación | **Suministros** | `pages/suministros.html` | Dashboard · Catálogo · Movimiento · Histórico · Correcciones · Importar |
| Análisis | **Análisis e Indicadores** | `pages/analisis.html` | Dashboard · KPIs RAM · Alertas · Plan Inversión · Desempeño |
| Salud del activo | **Salud del Activo** | `pages/salud.html` | Muestras · Motor HI · FUR · Contramuestras · Fallados+RCA · Matriz |
| Administración | **Administración** | `admin/administracion.html` | Panel · Usuarios · Catálogos · Importar Excel · Auditoría |
| Recursos | **Recursos** | `pages/recursos.html` | Documentos · Normativa · Cobertura · Acerca |

---

## v2.2.0 — Suministros + Repuestos · F38–F50 (2026-04-25)

Integración del sistema de control de suministros del .xlsm fuente
+ JSX al sitio web. 13 microfases atómicas. Plan completo en
`docs/PLAN-SUMINISTROS.md`.

### Bloque A · Cimientos (sin UI visible)

- **F38** — Dominio puro. 4 schemas + sanitizers + validadores
  (`suministro_schema.js`, `marca_schema.js`, `movimiento_schema.js`,
  `correccion_schema.js`) + extensión a `schema.js` con
  `TIPOS_MOVIMIENTO`, `ESTADOS_REPUESTO`, `TIPOS_CORRECCION`,
  `UNIDADES`, `ESTADOS_STOCK` (semáforo 6 estados del skill),
  `estadoStock(disp, ini, opts)` y `generarCodigoMov(anio, sec)`.
  41 tests.
- **F39** — Data layer. `data/suministros.js` (codigo como docId),
  `data/marcas.js` con sync arrayUnion/arrayRemove de
  `marcas_disponibles[]`, `data/movimientos.js` con `crear()` en
  `runTransaction()` que valida stock atómicamente y genera
  `MOV-YYYY-NNNN` sin race condition, `data/correcciones.js`
  (sin delete), `data/suministros_config.js` singleton, motor puro
  `domain/stock_calculo.js`. 20 tests.
- **F40** — Rules + 7 índices compuestos. Validación enums
  server-side. Movimientos con campos críticos inmutables en
  update. Correcciones DELETE bloqueado.
- **F41** — Sub-section `repuesto.estado` con dual-write retrocompat.
  +8 tests.

### Bloque B · Importador

- **F42** — Importador idempotente XLSM/JSX → Firestore. Parser puro
  con regex+JSON.parse (cero `eval`). Mapping corregido tras feedback:
  `cod` → `identificacion.codigo`, `m` → `identificacion.matricula`,
  `sub` → `identificacion.nombre` + `subestacion_nombre`.
  Enriquecimiento del catálogo con `valor_unitario` desde JSX. UI
  admin con dropzone + drag-from-repo + dryRun. Audit
  `bulk_import_suministros` con SHA-256. 20 tests.

### Bloque C · Admin UI

- **F43** — Catálogo CRUD realtime + chips marcas inline editables
  en el modal (gestión consolidada).
- **F44** — Marcas CRUD con sync arrayUnion.
- **F45** — Formulario INGRESO/EGRESO con autocomplete cascada,
  validación atómica de stock, color coding del skill,
  `StockInsuficienteError` con faltante explícito.
- **F46** — Histórico con filtros + delete con justificación
  obligatoria + export CSV. Correcciones CRUD sin delete.

### Bloque D · Public UI

- **F47** — Stock Dashboard con 8 KPIs + tabla 22 filas con
  semáforo 6 estados.
- **F48** — Dashboard ejecutivo con 8 KPIs + 4 charts Chart.js +
  vista cruzada zona/depto.

### Bloque E · Export y cierre

- **F49** — Export XLSM 1:1 con template binario via JSZip + parche
  XML quirúrgico. Preserva byte a byte: `vbaProject.bin` (3 macros),
  Office Add-in, charts, theme, styles, las otras 7 hojas. Sólo
  reescribe `sheet6.xml` y `table4.xml`. JSZip lazy-loaded vía CDN.
  8 tests.
- **F50** — Cache PWA bump `sgm-v3-1-0` → `sgm-v3-2-0` + CHANGELOG +
  tag.

### Decisiones del director registradas

1·C 10 hojas en export · 2·A JSX gana / sin DELETE huérfanos ·
3·A `stock_inicial=0` mostrado como SIN_STOCK · 4·A preservar VBA
via template binario · 5·A preservar Office Add-in · 6·A escritura
de movimientos solo admin · 7·A audit `bulk_import_suministros`
con metadata granular.

### Métricas

- 13 microfases · 23+ commits · 6.500+ LOC nuevas
- 282 → 382 tests verdes (+100 tests)
- 1 deploy manual del director (rules + índices)
- Plan completo: `docs/PLAN-SUMINISTROS.md` (1.269 líneas)

---

## v2.1.0-aqua · post-tag · PR #55 (2026-04-25)

Ajustes finos del rediseño Aqua tras feedback del director sobre el
PR #54 (que ya quedó mergeado a `main`). Estos 4 commits viven en
`claude/distracted-hoover-43da2d` esperando merge.

### `d688999` · foto real + overlay SVG con equipos (REVERTIDO)

Primer intento tras feedback "no tuviste en cuenta la imagen": añadí
foto de subestación + overlay SVG con DPS/89/52/CT interconectados
por las 3 fases. El director rechazó el overlay ("manten la imagen
tal cual"). El SVG `assets/img/aqua/substation-scene.svg` queda en
repo pero inactivo.

### `0025a8b` · foto sin overlay + más transparencia

- `.aqua-power-scene` apunta directo a `substation-photo.png` (no al
  SVG). `position: inset 0` cubre toda la viewport. `opacity: 1`
  (era .72). Solo un velo perla muy ligero (12-22%) sobre el cielo
  para asegurar contraste de texto.
- Glass más transparente: thin .42→.22 / .22→.10, regular .52→.30 /
  .32→.16, thick .66→.42 / .44→.24, ultra .82→.62 / .62→.42.
- Topbar idle .55→.30 / .40→.18 (scrolled .78→.50 / .62→.36).
- Sidebar .62→.36 / .48→.22, brand-head .42→.22.
- Blur compensa: 32/48/64px (era 28/44/60).

### `e6e04fe` · texto Steel Corporate Navy + text-shadow

- `--ink-1: #0a1628 → #0d1f38` (títulos · steel navy deep).
- `--ink-2: #2a3a52 → #1f3656` (cuerpo · corporate steel).
- `--ink-3: #5a6c87 → #4d6485` (meta · muted blue-gray).
- `--ink-4: #8896ad → #8093ad` (placeholder · light blue-gray).
- Misma familia cromática que `--brand: #007aff` pero saturada y
  oscura. Estilo corporativo del sector energía (GE, Siemens, ISA).
- `text-shadow: 0 1px 0 rgba(255,255,255,.55), 0 2px 8px rgba(244,
  249,255,.42)` en `.page-title`/`.section-title`/`.page-sub`/
  `.section-sub` para legibilidad sobre la foto (zonas claras del
  cielo y zonas oscuras del transformador).

### `4e24111` · `.gitignore` excluye `.claude/`

- Una línea: `.claude/` añadida al `.gitignore`.
- Resuelve el "commit fantasma" que GitHub Desktop mostraba en
  `main` al ver la carpeta del worktree de Claude Code como
  cambio nuevo.

### Pendientes en PR #55

- Foto en alta resolución (la actual 755×752 pixela en viewports
  >1200px). Pendiente que el director exporte el original desde
  Photos (Export Unmodified Original) o provea URL de origen.
- Merge del PR desde GitHub.com web.
- Revocar el PAT clásico que dio inline durante la sesión.

---

## v2.1.0-aqua · 2026-04-25 · Liquid Glass redesign (iOS 26 / macOS Tahoe)

Rediseño visual integral a **Apple Aqua light perla** (iOS 26 /
macOS Tahoe Liquid Glass). Cero impacto en lógica de Firestore,
motor de salud, importador, RBAC, alertas, reportes o Cloud
Functions. Capa puramente visual sobre la arquitectura v2.0.x.

### Sistema de diseño Aqua (10 microfases)

#### A1 · Fundación
- `assets/css/aqua-tokens.css` (light perla, sin azul de fondo,
  sin rosa). iOS palette (blue/cyan/teal/amber). SF Pro + Instrument
  Serif italic en hero + JetBrains Mono. Radii iOS, motion ease-ios,
  shadows light. **Solo activo con `body.aqua`.** Bloque de aliases
  legacy (`--space-*`, `--surface-*`, `--edge-*`, `--radius-*`,
  `--brand-500`, `--text-*`, `--gradient-*`, etc.) para que el CSS
  legacy de páginas v2 siga funcionando sobre la paleta perla.
- `assets/css/aqua-components.css` (1090 líneas) — librería completa:
  4 materiales de glass con specular + ring 3D, topbar, sidebar,
  botones 3D, chips, inputs, stat cards, panels, alerts, hero,
  feed, qc cards, modals, tabs, breadcrumb, page-head, form-grid,
  hring, reveal + overrides para componentes legacy.
- `assets/js/aqua.js` — partículas eléctricas, glint cursor, topbar
  scroll state, IntersectionObserver reveal, Lucide auto-init.
- `assets/js/aqua-shell.js` — auto-inyecta topbar + sidebar + escena
  en cualquier página con `body.aqua`. Detecta base relativa, marca
  sidebar item activo según URL, lee `window.__sgmSession` para
  mostrar role-chip + iniciales + ocultar links admin a no-admins.
  Bind `⌘K` para enfocar búsqueda global.
- `assets/img/aqua/{transformer,tower,logo-aqua}.svg` — 3 SVG
  técnicos del bundle de Claude Design.

#### A2 · Login Aqua (`index.html`)
Portal de acceso reescrito con auth-card glass-ultra + escena
completa (mesh + grid + 4 orbes blue/cyan/teal/amber + transformer
SVG + partículas). Hero con `<em>` Instrument Serif italic
gradient. Inputs con icon, check Aqua, btn-primary 3D. Mensajes
de estado info/ok/err con paleta light. **100% lógica Firebase
Auth preservada** (mismos IDs de form, mismo módulo ESM con
`signInWithEmailAndPassword`, `sendPasswordResetEmail`,
`setPersistence`, `onAuthStateChanged`, verificación
`/usuarios/{uid}` con fallback `/admins/{uid}`).

#### A3 · Home dashboard (`home.html`)
Topbar `.tb` pegajoso, sidebar `.sb` permanente 240px, app-main
responsive. Hero glass-thick con título serif italic + parque card
(totales por tipo POTENCIA/TPT/RESPALDO). KPIs grid-4 con stat-cards
+ sparklines. Banda de alertas críticas con alert-card glass.
Panel grid-2: distribución HI bucket (1-5 con paleta iOS) + Top
Plan de Inversión. Feed reciente. Quick cards. **Toda la lógica
realtime de Firestore intacta** (mismas suscripciones a
transformadores + ordenes + suscribirComputo de alertas).

#### A4 · Páginas públicas (13)
Migración mecánica con script Python: about, cobertura, contacto,
normativa, alertas, dashboard, documentos, inventario, kpis, mapa,
matriz-riesgo, ordenes, _firebase-test. Cada una: `theme-color
#f4f6fb`, `color-scheme light`, favicon → `logo-aqua.svg`, imports
CSS legacy (theme/base/app/nav/compat) → un solo
`aqua-components.css`, `body class="aqua"`, `<main class="app-main
page-container">`. `nav.js` (legacy) removido — `aqua-shell.js`
auto-inyecta navegación.

#### A5 · Paneles admin (22)
Mismo patrón A4 sobre `admin/*.html`: alertas, auditoria, catalogos,
contramuestras, contratos, demo-seed, desempeno-aliados, documentos,
fallados, importar, index, inventario, kpis, mapa, motor-salud,
muestras, ordenes, plan-inversion, propuestas-fur, subestaciones,
umbrales-salud, usuarios. `admin-guard.js` intacto.

#### A6 · Modales y formularios legacy
Bloque de overrides `body.aqua` para `.modal-overlay`, `.modal-bg`,
`.modal-card`, `.modal-head`, `.modal-x`, `.modal-actions` con
glass-ultra + specular + animación spring. Inputs/textarea/select
dentro de modales legacy con focus iOS. Form grids `.cols-2`/`.cols-3`
responsive. `.btn-primary`/`.btn-primary-v3` → `grad-brand`.

#### A7 · Pills, tablas, alertas legacy
Overrides para `.estado-pill` (operativo/mantenimiento/fuera_servicio
/retirado/fallado · planificada/en_curso/cerrada/cancelada),
`.tipo-pill` (preventivo/correctivo/predictivo/emergencia con
border-left semántico), `.prioridad-pill` (baja/media/alta/critica),
`.sev-pill` (critica/warning/info), `.bucket-pill[data-b="1..5"]`
para HI 1..5 (paleta verde-teal-azul-naranja-rojo). Tablas legacy
con thead translúcido sticky-style. `.alert-row` con glass-thin +
border-left semántico. `.toolbar`, `.filtros`, `.card`, `.panel-v3`,
`.stat-v3`, page-header con tipografía Aqua.

#### A8 · Charts Chart.js
`assets/js/kpis-render.js` detecta `body.aqua` y aplica paleta iOS
(brand `#007aff`, cyan `#00b8d4`, teal `#30d1b0`, success `#1cc870`,
warn `#ff9500`, danger `#ff3b30`, purple `#7e57ff`). Texto SF Pro
en lugar de Share Tech Mono. Tooltips translúcidos perla con border
iOS blue. Líneas con borderWidth 2.5 y point radius 3. Fallback a
paleta dark legacy si la página no es Aqua.

#### A9 · Mapa Leaflet
`mapa-render.js` detecta `body.aqua` y cambia tile a CARTO Voyager
(gris claro, neutro, sin azul dominante). `aqua-components.css` con
override completo: `.map-wrap` glass-thin + border-left brand,
`#sgmMap` perla `#e6edf7`, controles zoom translúcidos, popups con
glass-ultra, marker clusters con `rgba(0,122,255,.20)` y borde
blanco, divIcon con drop-shadow azul, leyenda translúcida.

#### A10 · Polish + QA
- 282/282 tests verdes (`node --test`).
- Lint HTML 100% limpio en index, home, 13 públicas y 22 admin.
- `CHANGELOG.md` actualizado con el bloque Aqua.
- Tag `v2.1.0-aqua`.

### Garantías

- **Cero impacto en lógica.** Solo CSS, HTML estructural mínimo y
  configuración Chart.js/Leaflet. Firebase Auth, Firestore rules,
  Storage rules, motor de salud F18, importador F17, alertas, RBAC,
  audit log, PWA: **intactos**.
- **Reversibilidad por fase.** 10 commits atómicos
  (`6ee0ae3 → e886612`).
- **Performance.** `backdrop-filter` activo solo en superficies
  visibles; `will-change` en hover/scroll. Fallback `@supports not
  (backdrop-filter)` con bg `rgba(255,255,255,.92)` plano.
- **Accesibilidad.** Contraste WCAG AA, skip-link, `:focus-visible`
  con outline brand, sr-only conservados, `prefers-reduced-motion`
  respeta animaciones.
- **Sin emojis** en UI ni copy (regla del AQUA_GUIDE).

### Adiciones nuevas
- Sidebar lateral fijo 240px en todas las páginas internas.
- Búsqueda global ⌘K en topbar (placeholder, lógica futura).
- Partículas eléctricas animadas (sutiles, 8–18 puntos).
- SVG técnico de transformador como fondo a la derecha.
- Avatar con iniciales del usuario en topbar + role-chip dinámico.

### Lo que NO cambió
- Functions, rules, indexes, schema, motor de salud, importador,
  RBAC, audit log: idénticos a v2.0.8.
- 282 tests Node siguen pasando sin modificar.
- Estructura de archivos /assets/js/data, /assets/js/domain, /tests
  no se tocó.

### Comandos de despliegue
- **GitHub Pages:** auto-deploy via `pages.yml` al hacer merge a `main`.
- **Sin deploy de Firebase requerido** (no tocan rules/indexes/
  storage/functions).

---

## v3.0.0 · 2026-04 · UX v3 + Cloud Functions activas

Evolución mayor con reestructuración de UX y activación de la primera
Cloud Function en producción.

### Nuevo sistema de diseño (UX v3)
- Tokens CSS corporativos en `assets/css/theme.css` (Space Grotesk +
  Inter + JetBrains Mono, paleta azul eléctrico + teal, glass morphism,
  aurora gradient sutil).
- Navegación unificada con 2 desplegables (`Más ▾` y `Admin ▾`) en lugar
  de 3 universos inconsistentes. Componente ESM en `assets/js/ui/nav.js`.
- `home.html` redibujado como dashboard operativo (hero + KPIs con
  sparklines + alertas críticas + Top 5 PI + feed + accesos rápidos).
- Páginas estáticas (about, cobertura, normativa, contacto) reescritas
  con tono corporativo, sin referencias a "fases" / "v1.0.0".
- `compat.css` para que las 15 páginas admin secundarias hereden el look
  v3 sin reescribir su HTML.
- `admin/index.html` reducido a redirect → `home.html`. Se retira el
  panel admin separado.
- Dashboard ejecutivo, Matriz de Riesgo y KPIs rediseñados con cards v3.

### Fixes críticos
- Splash de verificación de sesión + failsafe 7.5 s + escape valve
  "Volver al login" tras 2 s.
- Eliminado el bucle infinito MutationObserver + Lucide que congelaba
  el browser (`window.sgmRefreshIcons()` debounced).
- Firebase SDK `10.13.0 → 10.14.1`: silencia warnings "heartbeats
  undefined" (bug conocido del SDK).
- Consolida 4 suscripciones Firestore duplicadas en home a 2.
- Service Worker bump `sgm-v2-0-8 → sgm-v3-1-0` para invalidar cache.

### Cloud Functions
- `firebase.json` declara sección `functions` con runtime `nodejs22`.
- `functions/prepare-deploy.mjs` sincroniza `assets/js/domain/` →
  `functions/domain/` antes del deploy (predeploy hook).
- Refactor `functions/index.js` a Firebase Extension "Trigger Email"
  vía colección `/mail` (100% Google, sin Resend/Secret Manager).
- Dependencias actualizadas: `firebase-admin ^13`, `firebase-functions ^6`.
- ✅ **`onMuestraCreate` deployado en producción** (southamerica-east1).
- Cleanup policy Artifact Registry: 7 días de retención.

### Documentación nueva
- `docs/OPERACIONES.md §0` — **Protocolo de deploys**: regla
  permanente de avisar al director qué hay que deployar manualmente
  cada vez que se modifican rules/indexes/storage/functions.
- `docs/DEPLOY-FUNCTIONS.md` reescrito con flujo Gmail + Extension
  (etapa 1 sin email, etapa 2 opcional con email).
- `CLAUDE.md §0.1.1` — regla obligatoria para Claude de avisar
  en el mismo turno cuando haga cambios que requieran deploy Firebase.

### Pendiente
- `cronAlertasDiarias` — requiere instalar Firebase Extension
  "Trigger Email from Firestore" con Gmail App Password (documentado
  en `docs/DEPLOY-FUNCTIONS.md §2`).

## v2.0.8 · 2026-04
- Audit log wired en `documentos.js` (subir/actualizar/eliminar) — cierre del trail en los 7 data layers de mutación.
- `assets/js/ui-helpers.js` compartido (bucketColor · escHtml · fmtTs). Elimina duplicados en inventario admin/público.
- `admin/demo-seed.html` — pobla 6 TX ficticios cubriendo los 5 buckets + fin_vida_util_papel, 3 muestras DGA y 2 órdenes. Idempotente. Cada TX con `salud_actual` calculado en vivo por el motor F18.

## v2.0.7 · 2026-04
- Audit wired en `ordenes.js` (crear/actualizar/eliminar + `cambiar_estado_orden`), `importar.js` (`importar_excel`), `umbrales_salud.js` (`cambiar_umbrales`).
- `pages/ordenes.html` upgrade v2: añade columnas macroactividad_codigo, contrato_codigo, aliado_ejecutor; estado muestra `estado_v2` del workflow F29.

## v2.0.6 · 2026-04
- `docs/DEPLOY-FUNCTIONS.md` — guía completa de despliegue F32 (firebase login, secret RESEND_API_KEY, npm install + deploy, costos <2 USD/mes, rollback).
- `admin/index.html` añade asistente "PUESTA EN MARCHA v2" con 7 pasos enlazados al final del panel.
- Labels de notificaciones alineados: "cron F32 · Cloud Functions + Resend" (antes "preparación F12").

## v2.0.5 · 2026-04
- KPIs saludV2 visibles en `pages/kpis.html` y `admin/kpis.html` (HI promedio · vida remanente · régimen especial · distribución por bucket con chart §A9.7).
- `kpis-render.js` añade `renderSaludV2()` y registro de canvas `chBucket`.

## v2.0.4 · 2026-04
- `pages/inventario.html` vista pública con columnas Tipo / Zona / HI · Bucket.
- `firestore.rules` valida `estado_v2` en create/update de órdenes (11 valores del workflow F29).
- 3 nuevos índices: `ordenes(estado_v2+codigo)`, `ordenes(contratoId+codigo)`, `ordenes(macroactividadId+codigo)`.
- 3 tests nuevos del handler puro `onMuestraCreate`.

## v2.0.3 · 2026-04
- `admin/inventario.html` + `admin-inventario.js` upgrade v2: tabla con 9 columnas incluye HI/bucket/vida remanente; modal con sección "Identificación v2" (tipo_activo / UUCC / grupo / zona).
- `admin/ordenes.html` + `admin-ordenes.js` upgrade v2: selects de macroactividad, contrato, causantes multi, aliado ejecutor, estado_v2 (11 estados).
- `data/transformadores.js` wired con `auditar()` en crear/actualizar/eliminar con diff de campos clave.
- `functions/package.json` + `functions/index.js` refactor para ser deployable real (firebase-admin v12, firebase-functions v5, resend v3, secret RESEND_API_KEY).
- `tests/integracion_e2e.test.js` — 3 escenarios E2E del dominio (TX crítico → propuesta · FUR aprobado → bloqueo · TX joven sano).

## v2.0.2 · 2026-04
- `admin/fallados.html` — UI RCA post-mortem (5 Porqués · Ishikawa 6M · FMEA con RPN dinámico).
- `admin/auditoria.html` + `data/auditoria.js` — visor de bitácora F35.
- Wiring de `auditar()` en `data/usuarios.js` y `data/monitoreo_fur.js`.
- RBAC F28: `data/usuarios.js` acepta los 6 roles oficiales + `permisos_extra[]`, `zonas[]`, `contratos[]`.
- `admin/contramuestras.html` — UI de seguimiento reforzado (muestras tomadas / pendientes / vencidas).

## v2.0.1 · 2026-04
- `admin/propuestas-fur.html` — cola de juicio experto §A9.2 con 3 decisiones (aprobar reemplazo / aprobar OTC / rechazar).
- `admin/plan-inversion.html` — ranking PI con scoring multicriterio + export XLSX.
- `admin/desempeno-aliados.html` — score 0–100 por aliado con desviación de costo, reincidencias, tiempo medio.
- README.md reflejando cierre v2.0.0.

## v2.0.0 · 2026-04 · **Cierre del plan MO.00418**

22 microfases F16→F37 derivadas del prompt maestro v2.2.

- **F16** · Schema v2 con secciones (identificacion, ubicacion, placa, electrico, mecanico, refrigeracion, protecciones, fabricacion, servicio) + `salud_actual` + `estados_especiales[]`. Sanitizador puro + proyección v1 retrocompat. Rules v2 con helpers + 3 subcolecciones append-only.
- **F17** · Importador Excel → Firestore con recálculo HI oficial (descarta columna CONDICION del Excel por §D1-D17). Log en `/importaciones` con reporte de discrepancias.
- **F18** · Motor de Salud (7 calificadores + HI ponderado Tabla 10 + overrides §A5/§A9 + Duval/Rogers/Doernenburg + IEEE C57.91 + monitoreo intensivo C₂H₂ + juicio experto FUR).
- **F19** · Muestras DGA/ADFQ/FUR time-series con contexto §A9.6 obligatorio.
- **F20** · Subestaciones UI dedicada.
- **F21** · 8 contratos macro con control presupuestario (vigente/suspendido/finalizado/en_liquidacion).
- **F22** · Catálogos §A7 (31 subactividades · 7 macroactividades · 12 causantes).
- **F23** · Refactor Órdenes v2 con FKs catálogo + workflow de 11 estados.
- **F24** · TPT/Respaldo (IEEE C57.91 + selección óptima por zona/HI).
- **F25** · Fallados + RCA (5 Porqués · Ishikawa · FMEA con RPN).
- **F26** · Contramuestras + Monitoreo Intensivo + Propuestas FUR (A9.1 + A9.2).
- **F27** · Dashboard ejecutivo por rol con 6 KPIs + matriz 5×5 + Top-10 PI.
- **F28** · RBAC granular (6 roles + ámbito geográfico zonas[]).
- **F29** · Workflow aprobaciones + estados especiales de activo (OTC §A9.3).
- **F30** · Plan de Inversión con scoring multicriterio (HI 40% + criticidad 25% + vida 15% + costo_inv 10% + fallas 10%).
- **F31** · Reportes PDF/XLSX (ficha técnica · cierre orden · reporte mensual RAM).
- **F32** · Cloud Functions stubs (onMuestraCreate + cronAlertasDiarias).
- **F33** · Desempeño aliados con score 0-100.
- **F34** · PWA + service worker + manifest.
- **F35** · Audit log global.
- **F36** · Matriz Criticidad × Salud (Tabla 11 con §A9.9).
- **F37** · Motor de Estrategias por Condición (catálogo §A7).

- **Tests:** 234 unitarios al cierre del plan (escalan a 275 con pulido).
- **Stack operativo:** 14 UIs admin + 4 páginas públicas + 6 módulos de dominio puro + 9 data layers + rules + índices.
- **Fuente canónica:** MO.00418.DE-GAC-AX.01 Ed. 02 (Tabla 10 fuente única de pesos HI).

## v1.0.0 · 2026-04
Plataforma base F0-F15 (pre-evolución MO.00418). Ver `CLAUDE.md` §5 para detalle.
