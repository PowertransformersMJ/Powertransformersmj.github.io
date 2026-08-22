# 🧪 30 — MEMORIA PROCEDIMENTAL (Lecciones · Anti-patterns · Recetas)

> **Nodo neuronal: la EXPERIENCIA del cerebro** — gotchas, trampas y recetas que evitan reproceso y regresión.
> **Cuándo leerlo** (Trigger de Experiencia, `CLAUDE.md §G.2`): ANTES de una op riesgosa/repetitiva (mover archivos, merges, cache, refactor) y cuando un síntoma "suena". No se auto-carga.
> **Cómo crece** (Reflejo de Captura, `§G.4`): al fallar/sorprender/resolver algo no-obvio, apendar una lección (Síntoma → Causa → Receta → Cómo evitarlo) ANTES de cerrar la tarea; solo lo reutilizable.
> **Cómo leerlo sin quemar contexto** (es la neurona on-demand más pesada): `grep -n "^## \|^### L-" docs/30-LECCIONES.md`
> para ver secciones y títulos, y LUEGO `Read` con `offset`/`limit` solo del tramo que sirve. Nunca completo.
> **IDs**: `L-NN` lecciones operativas; `M-NN` meta-aprendizajes. Cada lección = header `### L-NN · …`; el linter valida las refs.
> Cosecha del CLAUDE.md previo (2026-06-04): las 14 reglas §0.1.2.* del monolito viven en `_legacy/CLAUDE-previo.md`; aquí condensadas, el detalle (bug, código, commits) en el legacy.

---

## 🔧 Operaciones de Git / refactor

### L-01 · Push/merge/deploy los ejecuta Claude (ACTUALIZADA 2026-07-18 — antes: "el push lo hace el director")
**Disparador**: cualquier push/merge. · **Cicatriz**: 2026-04→06 el push del runtime daba 403 → pushaba el director; 2026-06-23 el push funcionó pero Claude se extralimitó (posible ≠ permitido). En la entrevista F3a de la migración (ADR-051, `99 §51`) el Ingeniero CAMBIÓ la regla. · **Regla**: Claude ejecuta commit + push + merge + deploys, **validando cada commit con el Ingeniero** (resumen sin jerga). NUNCA force-push a `main`. JAMÁS tokens a archivo/commit/log. (Historia completa: `_legacy §0.1`.)

### L-02 · `main` solo con pedido explícito
**Regla**: no tocar `main` salvo orden directa del director.

### L-03 · Migrar archivo legacy SIN perder detalles visuales
**Disparador**: portar `*.html` monolítico (JS inline) a arquitectura moderna. · **Cicatriz**: se pierden detalles de UX de Chart.js. · **Regla**: comparar lado a lado contra el original en navegador ANTES de cerrar; copiar `plugins.legend`/`plugins.tooltip` palabra por palabra y replicar el plugin `afterDraw` completo (cada `setLineDash`/`arc`/`fillText` importa). 100% paridad visual; si hay captura del director, ESA manda. (Full: `_legacy §0.1.2.1`.)

### L-04 · Refactor 1→N NO debe vaciar la UI legacy
**Disparador**: pasar de 1 entidad a N. · **Cicatriz**: director: "eliminaste todo lo de [sección]". · **Regla**: conservar el cómputo de 1 entidad como fallback — Ruta 1: colección N≥1 → agregado; Ruta 2: colección vacía + preview legacy → cálculo con 1; Ruta 3: vacío real → placeholder INFORMATIVO con catálogo esperado (nunca stub silencioso). Verificar cada sección consumidora abriendo la página. (Full: `_legacy §0.1.2.4`.)

---

### L-25 · Purgar archivos sensibles del historial git (filter-repo)
**Disparador**: se commiteó algo sensible (PDFs de cliente, secretos) en repo público · **Cicatriz**: sacarlo del HEAD no basta — vive en commits viejos · **Regla**: (1) respaldo `git bundle create /tmp/backup-$(date +%s).bundle --all`; (2) anotar SHAs de ramas afectadas; (3) `pip3 install --user git-filter-repo`; (4) `git-filter-repo --invert-paths --path "Debug/" --force`; (5) re-agregar `origin` (filter-repo lo borra); (6) verificar `git rev-list --objects --all | grep -c "Debug/"` = 0; (7) force-push lo hace el DIRECTOR, nunca Claude. GitHub puede cachear commits viejos (pedir a Support si crítico); lo expuesto es ya-comprometido; clones deben re-clonar.
## 🌐 Frontend / runtime

### L-05 · NO usar `<datalist>` para búsqueda/autocompletar
**Cicatriz**: en Safari (con `autocomplete="off"`, iframe o extensiones de privacidad) el dropdown nunca renderiza. · **Regla**: combobox custom — `<input role="combobox">` + `<ul role="listbox">`, filtro NFD case-insensitive multi-campo, ↑↓ Enter Esc, tope 30 + "… y N más", ARIA completo, `dispatchEvent(new Event('change'))` en commit. Ref: `initMatSelect()` en `assets/js/calculo-refrigeracion.js`. (Full: `_legacy §0.1.2.12`.)

### L-06 · Informes imprimibles: paginación manual con `.sheet` divs
**Cicatriz**: Safari/WebKit NO repite `<thead>/<tfoot>` en tablas paginadas y `position:fixed` + `@page margin` es inconsistente entre browsers. · **Regla**: divs `.sheet` (8.5×11in, `page-break-after:always`) con header/footer DOM-explícito, script que distribuye bloques midiendo `scrollHeight > clientHeight`; `break-inside:avoid` en bloques atómicos; capturar formulario + totales + BOM + fórmulas + diagramas. **Verificar en Safari REAL** — `puppeteer.pdf()`/headless NO representa `window.print()`. (Full: `_legacy §0.1.2.2` y `§0.1.2.3`.)

### L-07 · Captura HD de Chart.js: escalar fontsize Y lineWidth, no solo el canvas
**Cicatriz**: canvas 4× con fonts en px absolutos → textos ilegibles. · **Regla**: escalar TODOS los font sizes, `borderWidth`/`pointRadius`, boxWidth de leyenda y lo que dibuje `afterDraw` (vía `chart._exportScale`). Flujo: backup → aplicar → `resize`+`update` → capturar → restaurar. (Full: `_legacy §0.1.2.8`.)

### L-08 · Foto de referencia → embeber con `<image>`, NUNCA redibujar en SVG
**Cicatriz**: redibujar una foto como SVG siempre la "altera" (colores, proporciones, detalles inventados). · **Regla**: embeber la original con `<image href>`, archivarla en `assets/img/refs/`, anotar encima (cotas, regiones invisibles). SVG vectorial solo sin foto; con foto: fidelidad + interactividad (2-3 iteraciones esperadas). (Full: `_legacy §0.1.2.10` y `§0.1.2.11`.)

---

### L-22 · Contenido sobre el fondo "liquid glass" necesita superficie propia
**Disparador**: crear módulos sobre el fondo foto `.aqua-power-scene` (`aqua-components.css`, `position:fixed; z-index:-1`) · **Cicatriz**: texto sin fondo propio queda ilegible ("los textos se ocultan con el fondo") · **Regla**: toda sección de contenido en panel sólido (`background:var(--pe-surface)` + borde/radio/sombra), acotado por `[data-tab-panel] > section`; sin sombra en internos (`.chartbox/.tblwrap/.matrix`) para evitar tarjeta-en-tarjeta; NUNCA texto suelto sobre el body.

### L-23 · Gráficas SVG: eje Y dinámico para no desbordar el marco
**Disparador**: gráficas en `assets/js/ui/pruebas/grafico-svg.js` · **Cicatriz**: `ymax` fijo (aislamiento 4, relación 0.6, resistencia 6) → un valor real (5.72 GΩ) se dibujaba FUERA del marco · **Regla**: techo dinámico `ejeMax(valores, limite, piso)` = `max(dataMax*1.15, limite*1.1, piso)` + `ticksY(ymax)` + `drawGridY()`; calcular `ymax` de los datos ANTES de definir `Y`; nunca asumir rango fijo para datos de campo (aislamiento 2–50 GΩ).

### L-28 · UI gated por rol admin: re-render al `sgm:session-ready` (carrera intermitente)
**Disparador**: UI condicionada a `esAdmin()` / `window.__sgmSession` · **Cicatriz**: la "X" de borrar aparecía a veces sí a veces no — `session-guard.js` resuelve el perfil ASÍNCRONO y setea `__sgmSession` + dispara `sgm:session-ready`; si el `onSnapshot` de datos llega antes, el gate queda en false · **Regla**: además del primer render, escuchar `window.addEventListener('sgm:session-ready', () => reRender())` (patrón de `contrato-info.js`, `aqua-shell.js`); nunca asumir sesión lista en el primer render.
## 🔥 Backend / infra / entorno

### L-09 · Deploys Firebase los ejecuta Claude (flujo ADR-005, desde 2026-06-06)
**Disparador**: tocar `firestore.rules` / `firestore.indexes.json` / `storage.rules` / `functions/*`. · **Cicatriz**: sin deploy → `permission-denied` (rules), `FAILED_PRECONDITION` (índices) o código viejo (functions). · **Regla**: Claude ejecuta `firebase deploy --only X` (CLI local autenticado), anuncia el deploy en el MISMO turno y verifica. El director hace los push; NUNCA force-push a `main`. (ADR-005 en `99 §5`; full: `_legacy §0.1.1`.)

### L-10 · Firestore rechaza `undefined` con un `permission-denied` ENGAÑOSO
**Cicatriz**: payloads con `undefined`/`NaN` (objetos anidados de funciones puras) → SDK Web los enmascara como `permission-denied` aunque seas admin. · **Regla**: `deepClean(payload)` (`assets/js/data/_firestore_clean.js`) — omite `undefined`/`NaN`/`Infinity`/funciones, preserva `null`/`0`/`''`/`false` y tipos Firestore (Timestamp/FieldValue/GeoPoint/DocumentReference) — JUSTO antes de `addDoc`/`setDoc`/`updateDoc`. (Full: `_legacy §0.1.2.6`.)

### L-11 · Re-deploy de `firestore.rules` tras CUALQUIER cambio
**Disparador**: colección NUEVA falla con `permission-denied` mientras las viejas funcionan y el pre-chequeo admin pasa. · **Cicatriz**: rules en prod sin el `match` nuevo → cae al `match /{document=**} { allow: if false }`. · **Regla**: verificar que el deploy diga "released rules ... to cloud.firestore" (no solo "deployed indexes"). (Full: `_legacy §0.1.2.7`.)

### L-12 · `/suministros/{X}` usa docId compuesto `{contrato_id}_{codigo}`
**Disparador**: cualquier consumer de `/suministros` (desde migración N5). · **Cicatriz**: código plano falla silenciosamente post-N5 — "Suministro X no existe" / stock "—". · **Regla**: usar `composeDocId(cid, codigo)` de `domain/contratos.js` y pasar `contrato_id` en todo consumer. (Full: `_legacy §0.1.3`.)

### L-13 · Validaciones críticas en el SUBMIT, no solo al abrir el form + doble defensa en data layer
**Cicatriz**: el estado del modal NO es fuente de verdad (race conditions de queries async). · **Regla**: re-verificar EN VIVO antes de escribir; si la query de verificación falla, BLOQUEAR con mensaje accionable (no `{existe:false}` silencioso); el data layer (`crear()`) revalida el invariante independientemente. (Full: `_legacy §0.1.2.9`.)

### L-14 · Lint local con `npm install` + `npm run lint:html`, NO `npx html-validate`
**Cicatriz**: `npx` descarga una versión transitoria más laxa que la de `package.json` → exit 0 local pero CI rojo (ej. WCAG H63 `<th>` sin `scope`). · **Regla**: CI corre `npm ci || npm install` + `npm run lint:html`; replicar eso localmente. (Full: `_legacy §0.1.2.5`.)

### L-15 · setDoc(merge:true) sobre colección con rules de enums obligatorios
**Cicatriz**: las rules evalúan `request.resource.data` merged-post; si el doc no existía, campos requeridos (`codigo`, `estado`) quedan `undefined` → falla la rule. · **Regla**: rellenar defaults seguros en el data layer respetando valores existentes. (Full: `_legacy §9.9` / v2.8.1.)

---

### L-72 · Una hoja de Excel cuyo título está en la fila 2 se lee como una hoja SIN columnas
**Disparador**: importar un libro con varias hojas del cliente. · **Cicatriz** (2026-08-21): el simulacro del import reportó **62 filas omitidas** y se dio por hecho que eran hojas sin campos obligatorios. Falso: **57 eran equipos REALES** (`TPT_Servicio` 30 · `TX_Respaldo` 25, con serie, potencia y subestación). Su fila de títulos está en la **fila 2** —la 1 está en blanco, seguramente un título combinado—, así que `sheet_to_json` devuelve claves vacías y TODA fila falla la validación. No les faltaban datos: no se sabían leer. · **Regla**: antes de culpar al dato, imprimir las 3 primeras filas crudas de CADA hoja (`header: 1`) y localizar la cabecera; si la primera fila viene vacía, buscar la cabecera hacia abajo antes de descartar. Un contador de "omitidos" alto es una hipótesis, no un diagnóstico. Ver `99 §69`.

### L-38 · Firestore "WebChannel RPC 'Listen' transport errored (400)" → activar auto-long-polling
**Disparador**: error rojo `firestore.../Listen/channel... 400` + `WebChannelConnection RPC 'Listen' stream transport errored` en consola. · **Cicatriz**: `getFirestore(app)` usa WebChannel, que ciertas redes/proxies/antivirus bloquean (los datos igual cargan, pero puede cortar onSnapshot). · **Regla**: `firebase-init.js#getDbSafe` — `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })` memoizado ANTES del primer `getFirestore` (con fallback). Es el fix oficial; no es bug del código de datos. Aparte: "domain not authorized for OAuth" solo afecta login Google/popup, no email/password ni Firestore.

### L-29 · Firebase Storage NO se puede LEER desde el navegador sin CORS → datos que el browser lee van a Firestore
**Disparador**: decidir dónde persistir datos · **Cicatriz**: lecturas (`getBytes`/`getBlob`/`getDownloadURL`+fetch, endpoint `?alt=media`) bloqueadas por CORS (`No 'Access-Control-Allow-Origin'`, `net::ERR_FAILED 200`); las ESCRITURAS sí pasan → engaña · **Regla**: ¿quién lee? Browser → Firestore (sin CORS); server/binario por URL directa → Storage. Configurar CORS del bucket (`gsutil cors set`) solo si es imprescindible. Caso: ADR-007 movió bloques a subcolección `informes/{id}/diagnostico/ia`.

### L-30 · Firestore NO admite arrays anidados → serializar payloads complejos a string JSON
**Disparador**: `setDoc` de tablas/matrices/JSON de LLM · **Cicatriz**: `tabla.filas=[[…],[…]]` → error `Nested arrays are not supported` (arrays DE OBJETOS sí valen; `[[...]]` no) · **Regla**: serializar el bloque complejo a string JSON en un campo (`{payload: JSON.stringify(obj), ts}`) y re-parsear al leer — inmune a arrays anidados, `undefined` y tipos raros. Caso: ADR-007 `guardarBloques`. Asumir arrays anidados por defecto en datos de LLM.
## 🔗 Integración cross-módulo (patrón canónico)

### L-16 · Integración cross-módulo = dominio puro + idempotencia + trazabilidad bidireccional
**Disparador**: módulo A escribe/lee datos de módulo B. · **Regla**: (1) funciones puras en `domain/` (sin Firebase, testables); (2) data layers thin en `data/` (one-shot / realtime con debounce ~200ms / orquestador transaccional); (3) idempotencia por marcador persistente en el doc; (4) trazabilidad en AMBAS direcciones (array de IDs origen→destino + identificador embebido destino→origen); (5) hook no-bloqueante (try/catch que solo loguea, nunca re-lanza); (6) tests de la función pura sin Firebase; (7) UI con 3 estados (OK/bloqueo/fuera-de-scope). (Full: `_legacy §0.1.2.13`.)

### L-17 · NO dejar pasos manuales del director post-merge para "encender" una integración
**Cicatriz**: "andá al admin, editá N items, confirmá X" — prohibido. · **Regla**: si la feature necesita data nueva en Firestore: auto-aplicación silenciosa idempotente al primer load, O banner accionable de UN click, O Cloud Function trigger, O script CI. Detectar el cold-start activamente; el detector dispara si CUALQUIER atributo del mapeo congelado difiere, no solo si falta todo. (Full: `_legacy §0.1.2.14`.)

---

## 🗂️ Validación de código muerto

### L-18 · Cuarentenar, no borrar
**Disparador**: eliminar código presuntamente muerto. · **Regla**: cero refs internas (`grep` en HTML/JS/MJS/JSON/TS) + ausencia en sitemap/manifest/router → mover a `_legacy/` con fila en `_legacy/README.md` (qué era, por qué, fecha). Borrado definitivo solo con ADR. (Límite de guardián, `CLAUDE.md §G.4`.)

---

## 🛠️ Claude Code / harness (skills, config)

### L-19 · Activar una skill repo-only = copiar su `SKILL.md` a `.claude/skills/<name>/` + reiniciar
**Disparador**: skill que solo existe en `skills/` del repo (NO es la fuente de lo cargado; el bundle `anthropic-skills:*` viene del entorno). · **Cicatriz**: `<name>` = el `name` del frontmatter, NO la carpeta fuente (ej. `brutalist-skill` → `industrial-brutalist-ui`; `grep -m1 '^name:' SKILL.md`); escaneo solo en boot → el director debe reiniciar; bundles multi-skill anidados se copian por subcarpeta; plugins (`code-modernization`) y subagentes (`code-simplifier`) sin `SKILL.md` no cargan; re-stagear skills del bundle = colisión de `name`. · **Regla**: copiar la carpeta a `.claude/skills/<name>/`, validar con `find .claude/skills -name SKILL.md` + chequear `name`+`description`. `.claude/` está gitignorado (`.gitignore:22`) → copia local-only; al re-clonar, re-correr el copy (la fuente tracked vive en `skills/`). (Ref: ADR-002, `99`.)

---

### L-71 · Un array pasado a `args` de un Workflow llega SERIALIZADO como string
**Disparador**: parametrizar un workflow con una lista (rutas, dimensiones, ítems). · **Cicatriz**: se pasó el array como string JSON y en el script `args` llegó siendo UN string; `args.filter`/`args.map` revientan. Estuvo años como callejón en `10` **sin fuente** — la auditoría §68 lo obligó a nacer con ancla (M-04). · **Regla**: `args` recibe el VALOR JSON real (`args: ["a.ts","b.ts"]`), nunca su serialización; si llega un string donde esperas lista, es esto. Ver `99 §68`.

### L-70 · El `grep` de esta Mac es un envoltorio de **ugrep**, no GNU/BSD grep
**Disparador**: barrido por `grep` para afirmar "no queda ninguna referencia a X". · **Cicatriz**: `grep --version` → `ugrep 7.8.4`; la shell define una función `grep` que ejecuta `ARGV0=ugrep claude -G --ignore-files --hidden -I --exclude-dir=.git …`. Semántica distinta a la esperada (`-I` salta binarios, excluye VCS, otras banderas largas). · **Regla**: para un barrido del que dependa una AFIRMACIÓN, correr `/usr/bin/grep` (o `git grep`) y comparar; `command grep` también salta la función. **Verificado 2026-08-21**: la afirmación heredada de que ugrep se salta lo gitignored (2 aciertos vs 38) **NO se reprodujo** en prueba controlada — el envoltorio sí encontró el archivo ignorado. Se conserva el hecho comprobado (no es GNU grep) y se marca lo no reproducido, para no perseguir un fantasma. Ver `99 §68`.

### L-63 · No re-pedir una autorización que la doctrina YA concedió (fricción disfrazada de prudencia)
**Disparador**: estar a punto de preguntar "¿procedo?" por una acción que `CLAUDE.md` ya autoriza de forma permanente. · **Cicatriz** (2026-07-28, ADR-058): terminé la migración completa y **retuve el merge a `main` pidiendo el visto bueno**, cuando §2 dice literalmente *"Claude ejecuta commit + push + merge + TODOS los deploys"* desde la entrevista F3a. El Ingeniero tuvo que repetirlo: *"tú haces commit, push, merge a main y todos los deploy siempre"*. Pedir permiso ya dado no es cautela: es devolverle al dueño un trabajo que él ya delegó, y encima suena a que no me leí su propia política. · **Regla**: antes de preguntar, **verifica si §2/§G ya lo cubre**. Si lo cubre → EJECUTA y reporta. Reserva la pregunta para lo que la doctrina NO cubre: dinero, legal, datos de cliente, go/no-go de negocio, o algo genuinamente irreversible y no previsto. Corolario: la validación por commit que él sí pidió es **presentarle el resumen claro**, no esperar su "sí" para cada paso.

## 🪞 Meta: fallos del propio cerebro (Reflejo de Autocrítica `CLAUDE.md §G.4`)

### M-01 · `brain-check.mjs` ensuciaba la raíz con un archivo `NUL` en cada corrida
**Disparador**: archivo `NUL` 0-byte huérfano en la raíz. · **Cicatriz**: el linter traía `git rev-parse … 2>NUL` (Windows); en macOS/Linux crea un archivo literal `NUL` en cwd en cada corrida. · **Regla**: `scripts/brain-check.mjs:171` → `2>/dev/null` (2×); tooling POSIX-limpio; ante `NUL` huérfano, grep `2>NUL`.

### M-02 · El mapa espacial se pudre en SILENCIO (el Reflejo de Frescura no tiene gate)
**Disparador**: buscar dónde vive un módulo y que `20` diga "no está". · **Cicatriz** (auditoría 2026-08-21): `20-ESPACIAL` no nombraba el importador de Salud de Activos —la tarea VIVA del proyecto— ni Fichas Técnicas, ni Indicadores de Calidad, ni Seguimiento Operativo, pese a 4 ADRs seguidos sobre ellos. Un agente frío gastó 16 KB para recibir un "no documentado" FALSO. Ningún gate lo caza: el linter valida que las hojas existan, no que el mapa conozca el código. · **Regla**: al crear/mover una PÁGINA o un módulo `ui/`, la fila en `20` va en el MISMO commit; y al cerrar un ADR que estrena módulo, verificar `grep -c '<slug>' docs/20-MEMORIA-ESPACIAL.md` antes de dar la tarea por cerrada. Ver `99 §68`.

### M-03 · Un ✅ que verifica una condición DISTINTA a la que anuncia
**Disparador**: leer un verde del linter y creerle. · **Cicatriz** (auditoría 2026-08-21): (a) el arranque imprimía `✅ cache verificada (SW↔manager↔05)` con solo existir `sw.js`, mientras la comprobación real estaba saltada — una mentira inyectada en CADA sesión; (b) `✅ archiveDir íntegro (0 crudos indexados)` con 10 deliberaciones caras dentro, porque el gate solo miraba ficheros sueltos y la convención real son carpetas. · **Regla**: un gate cuyo mensaje no nombre EXACTAMENTE lo que evaluó es peor que no tenerlo (apaga la sospecha). Al leer un ✅ del que dependa una decisión, mirar su condición en el código; al escribir uno, que la condición del `if` sea la del texto. Ver `99 §68`.

### M-04 · Un callejón sin cita es superstición
**Disparador**: la lista `🚫 Callejones` de `10`. · **Cicatriz** (auditoría 2026-08-21): de 8 entradas, 3 llevaban cita y una ("Workflow `args` grande como string → serializado") **no tenía fuente en ninguna neurona**: se obedecía sin poder reevaluarse. En paralelo, los callejones probados de ADR-058/066/067 —lo más caro de producir— nunca llegaron a la lista. · **Regla**: todo "no reintentar" nace con su ancla (`L-NN`, `§NN` o ruta del crudo) o no se escribe; y al cerrar una deliberación, sus falsos positivos y su "verificado sano" bajan a `10 §🚫` ANTES de que la bóveda sea el único ejemplar. Ver `99 §68`.

### M-05 · La bóveda es COMPARTIDA: un `git add` amplio se lleva el trabajo a medio hacer de otra sesión
**Disparador**: dos sesiones de Claude abiertas a la vez en proyectos distintos del paraguas (aquí y `mantenimiento-lineas-at`). · **Cicatriz** (2026-08-21, durante la auditoría §68): mientras yo editaba `../brain-private/kernel/` para el bump a v1.9.0, la otra sesión commiteó en la MISMA bóveda con un `git add` amplio y se llevó mi `VERSION`, mi `brain-check.mjs` y mi `session-handoff.mjs` **a medio terminar**, bajo el mensaje `f10d142` («ADR-045 enlaza sus crudos»), que no habla de nada de eso. La historia quedó diciendo una cosa distinta de la que pasó, y no se reescribe porque la bóveda es compartida. · **Regla**: en `brain-private` **`git add` de rutas específicas SIEMPRE** (`CLAUDE.md §2` ya lo exige y aquí es doblemente crítico: el repo tiene dueños concurrentes); antes de commitear ahí, `git status --porcelain -uall` y commitear **solo lo tuyo**; si aparece trabajo ajeno a medias, se deja y se avisa, no se barre. Ver `99 §68`.

> Pendiente universal: no confiar en `origin/*` sin `git fetch`. Lección→doctrina: promover a `CLAUDE.md §3`. Tope ~350 líneas: shard (ej. `31-LECCIONES-GIT.md`) registrada en §0/`00-INDICE`, puntero madre→hija.

---

## ⚡ Pruebas Eléctricas: dominio, tablero y previews fieles

### L-49 · UI con requisito ambiguo o sensible → workflow de PREVIEW (dev-server + harness mock) ANTES de cablear
**Disparador**: cambio de UI no trivial invisible en la app real (admin-gated + Firebase). · **Cicatriz**: (ADR-024) doble misinterpretación; la "leyenda 2019/2021/2023" NO eran chips de filtro (`.pe-fase-chip`=0). · **Regla**: `scripts/dev-server.mjs` (Node puro; `python -m http.server` da `PermissionError` en el sandbox) + harness `_dev/preview-multiano.html` con módulos reales + mocks; validar con Preview MCP y eval duro (líneas SVG 6→5 tras clic). Una LEYENDA no es un FILTRO hasta clicarla.

### L-50 · Datos de prueba (mocks dev-only) NUNCA simulan otro dominio ni datos inexistentes; y blindar el límite de dominio en el código
**Disparador**: inventar datos de ejemplo para un harness. · **Cicatriz**: (ADR-027) inventé un bloque DGA (aceite); el tablero es pruebas ELÉCTRICAS — fabricar datos + cruzar dominios. · **Regla**: mocks solo del dominio correcto (SFRA, dispersión, IR núcleo, LTC/DRM, DFR sí; DGA/fisicoquímicos/furanos/humedad-papel NO), rotulados "dev-only"; blindar en código: `familiaMA` excluye `ES_NO_ELECTRICA` antes del fallback, con test.

### L-52 · Un resultado físicamente IMPLAUSIBLE = artefacto de datos, no hallazgo → RCA en el dato ANTES de mostrarlo
**Disparador**: métrica derivada con valor absurdo. · **Cicatriz**: (ADR-040) capacitancia CHL −91.4% / CL −89.3% (~10x, imposible); esquemas distintos (2021: combos 2 devanados `CH+CHL`; 2023: 3 devanados GST/UST) → misma etiqueta ≠ misma capacitancia (2233.5 vs 191.9 pF). · **Regla**: RCA en el dato antes de mostrar; una RATIO (tan δ) tolera cambios de modo, una ABSOLUTA (pF) no; mejor caveat honesto que falsa alarma.

### L-54 · `reset` que REASIGNA un Set capturado por closures lo deja huérfano (filtros muertos / contador pegado) → mutar EN SITIO (`set.clear()` + re-add)
**Disparador**: resetear una colección capturada por closures (UI vanilla). · **Cicatriz**: (ADR-042) `sel.nivel = new Set(...)`; los chips/contadores de `grupoFiltro` capturan la referencia VIEJA → contador pegado "1/3", filtros muertos. · **Regla**: mutar en sitio (`set.clear()` + re-add), jamás reasignar; verificar ciclo default→filtrar→reset→filtrar (contadores Y efecto real).

### L-55 · Tabulador genérico cross-prueba: el TIPO de criterio (desbalance / valor / mínimo) decide qué columnas y colores; y el preview abre la RAÍZ por defecto
**Disparador**: tabulador genérico o lógica de dominio en un preview. · **Cicatriz**: (1) tan δ mostró "Desv. máx 14.53%" en rojo con chip ✓ (criterio = VALOR ≤1%, no desbalance); (2) "comparten X ⇒ fases" malclasificó bujes/2 tensiones (`Cannot read 'map' of undefined`); (3) el panel abre `/` = login en blanco; (4) GRAVE: regex tomó "10 kV" del título (tensión de ENSAYO) como nivel — el real = devanado+config (AT delta→66, AT estrella→110, MT→34.5, BT→13.8; ya en `nivelDe()`/`configInforme()`); (5) `Edit` pegó en `tarjetaGrupo` (1ª coincidencia), no en `cabeceraCard`. · **Regla**: ramificar por `crit.kind` (`desb`/`valor`/`mínimo`; columna desviación solo si `desb`); desbalance POR devanado (nunca MT ~160 mΩ vs BT ~19 mΩ); dar URL completa `/_dev/...`; REUSAR helpers de producción (`nivelDe`, `configInforme`, `derivarTablaTAP`), jamás reinventar dominio en `_dev/`; tras `Edit`, `grep -n` + `console.log` marcador antes de culpar la caché.

### L-56 · Un preview que NO ejecuta el módulo REAL + el scope + la composición de producción es ENGAÑOSO → validas algo que no es lo que se mergea
**Disparador**: preview para validación pre-merge. · **Cicatriz**: al mergear "no se parecía en NADA": MÓDULO distinto (maqueta `_dev/` vs `excitacion-panel.js`), SCOPE (sin `.pe-scope` no aplican overrides `.pe-scope .pe-vp-acc .pe-fus-*`), COMPOSICIÓN (el shell apila varios paneles). · **Regla**: importar módulos REALES + `.pe-scope` + misma composición del shell + fixtures reales (`_dev/preview-excitacion-fiel.html` ADR-046, `_dev/preview-panel-prueba-prod.html` ADR-045); estilos inline en el JS = preview==prod; marcar "falta validar en la APP".

### L-53 · Patrón de excitación 2+1: el criterio es la FORMA (externas simétricas + central distinta); la dirección HLH/LHL vs la conexión es solo INFORMATIVA (la geometría del núcleo manda)
**Disparador**: codificar una "regla de libro" como criterio duro. · **Cicatriz**: (ADR-041) "estrella⇒HLH / delta⇒LHL" marcó 4/7 tríos "irregular" en unidad SANA; la central (B) es la MENOR en estrella Y delta (camino magnético más corto → menor reluctancia). · **Regla**: criterio = FORMA (externas simétricas Δ A–C + central como extremo, `formaOk`); dirección por conexión solo informativa (`dirCoincide`); excitación = COMPARATIVA sin umbral % universal (≠ TTR 0.5%; precedencia fábrica→previos→NETA 2+1→IEEE 62/C57.152; pérdidas W también comparativas); la teoría orienta, el dato decide.

### L-51 · BORRAR de más es destruir valor ajeno al pedido → ante duda de alcance, retira lo MÍNIMO señalado (no el contenedor)
**Disparador**: borrado por pantallazo o alcance ambiguo. · **Cicatriz**: (ADR-035→036) "elimina esto": el pantallazo arrancaba en el encabezado "Resultados del informe" pero señalaba el bloque tan δ; oculté TODA la sección y borré bujes/excitación/relación/resistencia/aislamiento. · **Regla**: defecto CONSERVADOR — retirar lo mínimo, nunca el contenedor; lo ya representado en otro lado (tan δ) es candidato, lo único es pérdida neta; implementar como filtro (`bloques.filter(b => familiaMA(b)?.key !== 'tand')`) y validar en `preview-bloques.html`.

> **Todo lo de IA / Claude API / Cloud Functions vive en la hija** →
> [`31-LECCIONES-IA.md`](31-LECCIONES-IA.md) (§G.5): streaming largo, reintentos, timeouts, trabajo
> asíncrono observable y extracción con LLM (prompt, modelo, estructura). Léela ANTES de tocar
> `functions/` o el pipeline de IA. La hija lleva su propio listado — aquí no se duplican sus IDs.

### L-42 · Ninguna columna "Evaluación/OK" en las tablas — el veredicto es del panel multi-norma
**Disparador**: tablas de detalle (tan δ, bujes, aislamiento) con veredictos por fila. · **Cicatriz**: el prompt PEDÍA columna "Evaluación" (la IA ponía "OK") y `derivarTablaTAP` añadía "Eval." derivada — doble origen que violaba L-36. Cada laboratorio nombra distinto la columna (2021/Applus: "Resultado"/"Evaluación"; 2023/EMS: "Evaluación"). · **Regla** (3 capas): (1) quitar Evaluación/Calificación del prompt (IA emite solo datos crudos) + re-deploy de `extraerPruebasElectricasIA`; (2) `derivarTablaTAP` sin "Eval." (mantener "Desv. %", que es DATO); (3) `quitarColumnasVeredicto` (dominio) como strip defensivo en `tablaBloque` — detección por DOS vías: encabezado `/evaluaci|calificaci|veredicto|resultado|concepto|dictamen|diagnostic|^eval\.?$/i` O todas las celdas = palabras de veredicto. Tablas = DATOS; veredicto = panel multi-norma; sospechoso → `verificar`, nunca "OK".

### L-41 · El badge de estado debe reconocer TODOS los estados "listos" (allowlist frágil)
**Disparador**: clasificar un código de estado. · **Cicatriz**: `pendiente = estado !== 'extraido' && estado !== 'procesado'` (×3 copias inline) no incluía `'extraido_ia'` → informes perfectos marcados "pendiente de extracción" con Reprocesar siempre visible. · **Regla**: predicado único `tabla-pruebas.js#esPendienteExtraccion` = `!String(estado).startsWith('extraido') && estado !== 'procesado'`. Nunca allowlist de strings exactos repetida inline; si un estado nuevo aparece en la ESCRITURA, busca TODAS las LECTURAS que lo clasifican.

### L-40 · Reprocesar un informe también va SERVER-SIDE (sin leer el PDF en el navegador)
**Disparador**: operar sobre un archivo YA en Storage. · **Cicatriz**: "Reprocesar" descargaba el PDF al navegador (`getBlob`/fetch de la downloadURL) → errores CORS (Storage no se lee del browser sin CORS, L-29) y usaba el extractor débil. · **Regla**: reprocesar = re-llamar `extraerConIA({storagePath})` — la CF lee el PDF en el servidor, re-extrae y re-deriva; luego `actualizarInforme`+`guardarBloques` con el MISMO id + invalidar `state.bloquesCache`. El navegador solo SUBE o navega ("Descargar PDF" = `<a href download>`, sin XHR); CORS del bucket solo si de verdad lees blobs desde el cliente.

### L-39 · Re-carga de informes = upsert por fecha exacta (con confirmación), no duplicar a ciegas
**Disparador**: cargas que pueden repetirse. · **Cicatriz**: `crearInforme` siempre hacía `addDoc` → duplicados (dos puntos del mismo año en la tendencia, columnas dobles). · **Regla** (`storeReport`): `listarInformes(unidadId)` + `buscarInformeExistente` por FECHA EXACTA (dd/mm/aaaa; fallback a AÑO solo si el nuevo no trae fecha); si hay match, `window.confirm` → REEMPLAZAR (borra doc + diagnóstico + `eliminarPDF`, sin huérfanos) o crear nuevo. Lista local mutable para duplicados dentro del MISMO lote. Toda carga repetible: clave de identidad + política de colisión explícita, nunca "siempre insertar".

### L-37 · Veredicto robusto = MULTI-NORMA (peor de todas + mostrar divergencias) — ninguna norma es "la definitiva"
**Disparador**: calificar una prueba contra criterios normativos. · **Cicatriz**: colapsar a UN criterio (≤2% NETA) pierde diagnóstico — cada norma mira un ángulo (NETA pisos, IEEE C57.152 método+tendencia, MO.00418 por clase, industria, fábrica baseline); caso testigo: 5 GΩ a 110 kV pasa NETA 100.5 pero falla por clase 30 GΩ. · **Regla** (ADR-012, `pruebas_electricas_multinorma.js`): `evaluarMultiNorma` → `{opticas, consolidado=el más conservador, divergen}`; el consolidado conduce el semáforo, las divergencias se muestran; precedencia fábrica > clase > NETA > industria define qué número se CITA, no cuál se ignora. Gotcha: al reusar `calificarResistencia` como evaluador NO pasar `ctx` crudo como 2º arg (lo toma como `flagVerificar` → siempre ámbar); envolver `(v)=>calificar(v)`. Marco: `_conocimiento/marco-normativo-multinorma.md §4`.

### L-73 · La columna de EVALUACIÓN de la fuente del cliente contradice a su propio valor medido
**Disparador**: usar una columna «EVALUACION …» del Excel del cliente como si fuera veredicto. · **Cicatriz** (2026-08-21, hoja TX_Potencia): `T1-M/M-AST` (ASTREA) mide **250 % de carga** —físicamente implausible, artefacto de dato (**L-52**), y coincide con la hipótesis «columnas intercambiadas» que el barrido de ADR-067 había dejado sin cerrar— mientras su propia `EVALUACION CARGABILIDAD` dice **1** (óptimo). Igual `T1-M/M-LOR` (LORICA): 98 % medido, evaluación 1. Y al revés: GUATAPURI y MAJAGUAL vienen en `CONDICION` 5 sin que ninguna columna medida lo sostenga. · **Regla**: las columnas de EVALUACIÓN/CONDICIÓN de la fuente son **referencia, no veredicto** — es **L-36 aplicada al Excel**: se recalcula desde el valor medido contra la norma y la divergencia se MUESTRA, no se esconde ni se pisa. Una fuente que se contradice a sí misma es señal de dato sucio, no de criterio experto (mismo patrón que la columna CAUSANTE, ya conocida como no confiable). Ver `99 §69`.

### L-36 · El veredicto es del VALOR contra la NORMA — nunca del informe ni del texto de la IA
**Disparador**: cualquier "estado/semáforo/OK" en la UI. · **Cicatriz** (ADR-011): `renderScorecard` mapeaba `b.calif` (texto del laboratorio/IA) al semáforo mientras el KPI derivaba de `calificarPrueba(valor)` → "Satisfactorio" junto a "fuera de norma". · **Regla**: toda calificación se computa en el dominio desde el valor medido vs el umbral (`calificarPrueba`, único punto de verdad); el texto del informe/IA es solo CONTEXTO. Parámetros físicos del criterio (clase de tensión, NETA 100.5) entran al calificador del DOMINIO (`opts.minNeta`), no a la capa de presentación — si no, las vistas divergen. Citar siempre norma + umbral junto al veredicto.

### L-34 · Auto-graficar TODA magnitud derivada produce ruido/duplicados → curar qué amerita gráfica
**Disparador**: auto-render de claves `extra`/derivadas · **Cicatriz**: gráficas redundantes (R.Ref ≈ R.Medida, %DIF duplicada, tensión monótona sin valor) — "renderiza todo" trata datos de TABLA como de GRÁFICA · **Regla (ADR-009, `bloquesDeExtra`/`EXTRA_GRAFICABLE`)**: data secundaria a TABLA por defecto; solo graficar magnitud distinta y diagnóstica (ej. Potencia); curar con allowlist/regex/flag. Mostrar dato ≠ visualizar tendencia; más gráficas ≠ más claridad.

### L-57 · "Hazlo como X" → encuentra QUÉ componente produce X antes de construir uno nuevo
**Disparador**: pedido "hazlo como X" · **Cicatriz (ADR-050)**: asumí que las tablas de excitación salían de `excitacion-panel.js` y recreé un panel en `tand-panel.js`; en realidad las renderiza `montarPanelPrueba(host,'excitacion',…)` (`tablas-pruebas-panel.js`), compartido y que YA soportaba `'tand'` — rechazo del director y revert a HEAD · **Regla**: localizar el código que produce X (grep del render real, no el panel "obvio") y reusar; "parecerse a X" = usar el MISMO componente, no reimplementar (§3.3).

### L-58 · Veredicto multi-norma: un chip POR NORMA, nunca un estado consolidado para todos
**Disparador**: pintar chips/badges por norma · **Cicatriz (ADR-050)**: tan δ 0.51% marcado ✕ en NETA E IEEE — cumple IEEE (≤1%), solo supera NETA (0.5% → investigar); `chipsCriterio(familia, estado)` aplicaba el estado consolidado (peor) a TODOS los chips · **Regla**: cada chip sale de `evaluarMultiNorma(familia, metrica).opticas[i].estado` (nivel→símbolo: 0 ✓ · 1-2 ⚠ · ≥3 ✕; óptica informativa nivel <0 cae al consolidado); el consolidado conservador es solo para el VEREDICTO GLOBAL; "investigar" ≠ "no cumple"; chips deben coincidir con la tabla de diagnóstico.

## 🖼️ Rescates tardíos del monolito previo (minería 2026-07-18, ADR-051)

### L-59 · Fotos del Ingeniero: HEIC no renderiza en Chrome/Firefox y `cover` estira el padding blanco
**Cicatriz**: HEIC solo lo pinta Safari (background-image roto en Chrome/Firefox); `background-size:cover` estiró el padding blanco interno de una foto a todo el viewport. · **Regla**: convertir SIEMPRE a JPEG/WebP (`sips -s format jpeg`) y recortar el padding interno ANTES de usar; probar en Chrome. (Origen: `_legacy/CLAUDE-previo.md §9.5`.)

### L-60 · "Todo sigue igual" tras un deploy → triage con `curl` del asset, no adivinar
**Regla**: `curl` directo al asset en producción (`https://powertransformersmj.github.io/assets/…`) para separar "no desplegado" vs "cache del navegador" ANTES de tocar código; la PWA vieja causaba esto (por eso `sw.js` es kill-switch). (Origen: `_legacy/CLAUDE-previo.md §9.7`.)

### L-61 · Glosario del Ingeniero + invariante visual AQUA
**Regla**: "tal cual" = SIN overlays/velos/scrims sobre la foto (retirar cualquier veil existente); `.aqua-power-scene` (aqua-components.css) cubre SIEMPRE el viewport completo (`position:fixed; inset:0`). Ante ambigüedad visual → preview fiel (L-56) + preguntar. (Origen: `_legacy/CLAUDE-previo.md §9.5/§9.7/§0.1.2`.)

### L-62 · Automatizar el Chrome del Ingeniero: subir archivos = gesto humano; localhost bloqueado
**Disparador**: inyectar un archivo local a un file-input de la app vía la extensión de Chrome. · **Cicatriz** (2026-07-23, carga del informe LEL27007): `file_upload` de la extensión solo acepta archivos compartidos a la sesión (ni scratchpad); `fetch` a `http://127.0.0.1` desde página https queda COLGADO por Local Network Access de Chrome (ni con headers PNA/CORS — el prompt de permiso no aparece en fetch programático); los inputs de wizards nacen ocultos en su paso (`display:none`). · **Regla**: la vía robusta es el **drag&drop del usuario** — prepararle todo: `open -R "<archivo>"` revela el PDF seleccionado en Finder y el arrastre son 5 s; si el input está oculto, hacerlo visible con JS es legítimo para diagnóstico. NO pelear contra los candados (son de seguridad, no bugs); presupuestar el gesto humano en el flujo.

## 🧭 Verificación, despliegue y honestidad del dato → hija `32`

> **Todo lo de "lo declarado ≠ lo que hay en producción" y "un dato sin rótulo miente" vive en**
> [`32-LECCIONES-VERIFICACION.md`](32-LECCIONES-VERIFICACION.md) (§G.5): sanear sin filtrar la lista de
> lo prohibido, verificar el EFECTO y no el workflow, preguntarle al servidor, medir un port por su CSS,
> auditar en paralelo por dimensiones, rotular el dato de demostración. Léela ANTES de declarar algo
> desplegado, portado o auditado. La hija lleva su propio listado — aquí no se duplican sus IDs.
