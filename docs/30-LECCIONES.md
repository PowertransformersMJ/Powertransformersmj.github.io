# 🧪 30 — MEMORIA PROCEDIMENTAL (Lecciones · Anti-patterns · Recetas)

> **Nodo neuronal: la EXPERIENCIA del cerebro.** Aquí vive lo que un humano
> experto "ya sabe por haberse quemado": gotchas, trampas, recetas que funcionan.
> Es lo que evita el **reproceso** y la **regresión** — el corazón del
> auto-aprendizaje.
>
> **Cuándo leerlo (Trigger de Experiencia, `CLAUDE.md §G.2`)**: ANTES de una
> operación riesgosa o repetitiva (mover archivos, merges, tocar cache, refactor),
> y SIEMPRE que un síntoma "me suena". No se auto-carga.
>
> **Cómo crece (Reflejo de Captura, `CLAUDE.md §G.4`)**: cada vez que algo falla,
> sorprende o se resuelve de forma no-obvia, el constructor (Claude) APENDE aquí
> una lección — formato: **Síntoma/Contexto → Causa → Receta → Cómo evitarlo** —
> ANTES de cerrar la tarea. Bajo su juicio: solo lo reutilizable, no ruido.
>
> **Formato de IDs**: `L-NN` para lecciones operativas; `M-NN` para meta-aprendizajes
> (fallos del propio cerebro / cómo razona). Cada lección se define como un
> encabezado nivel-3 `### L-NN · …`. El linter valida que las refs `L-NN`/`M-NN`
> usadas en otras neuronas estén definidas aquí con ese formato.

---

> **Cosecha del CLAUDE.md previo (2026-06-04).** Las 14 reglas permanentes
> §0.1.2.* del monolito quedaron cuarentenadas en `_legacy/CLAUDE-previo.md`.
> Abajo están condensadas como lecciones accionables; el **detalle completo
> (contexto del bug, código, commits)** vive en el legacy en la sección citada.

## 🔧 Operaciones de Git / refactor

### L-01 · Push solo con PAT inline
Los canales de push del runtime (`git push` vía proxy, `mcp__github__*`) dan **403** en este repo. Único canal que funciona: `git push https://USER:TOKEN@github.com/USER/REPO.git BRANCH:BRANCH` con un PAT clásico (scope `repo`) del dueño. El `local_proxy` resetea el remote entre invocaciones → NO sirve `git remote set-url`; pasar la URL con token inline en CADA push. **Jamás** escribir el token a archivo/commit/PR/log; redactar con `sed 's|ghp_[A-Za-z0-9]*|ghp_****|g'`. Si no hay token visible y hay commits pendientes, pedirlo al dueño. (Full: `_legacy §0.1`.)

### L-02 · `main` solo con pedido explícito
No tocar `main` salvo orden directa del director.

### L-03 · Migrar archivo legacy SIN perder detalles visuales
Al portar un `*.html` monolítico (con JS inline) a la arquitectura moderna: comparar lado a lado contra el original en el navegador ANTES de cerrar. Para Chart.js: copiar `plugins.legend`/`plugins.tooltip` palabra por palabra y replicar el plugin `afterDraw` completo (cada `setLineDash`/`arc`/`fillText` tiene propósito de UX). 100% de paridad visual, no solo numérica. Si el director da captura del original, ESA manda. (Full: `_legacy §0.1.2.1`.)

### L-04 · Refactor 1→N NO debe vaciar la UI legacy
Al pasar de "1 entidad" a "N entidades", NO eliminar el cómputo de 1 entidad: dejarlo como **fallback** (Ruta 1 colección N≥1 → agregado; Ruta 2 colección vacía + preview legacy → cálculo con 1; Ruta 3 vacío real → placeholder INFORMATIVO con catálogo esperado, nunca stub silencioso). Verificar cada sección consumidora abriendo la página sin acciones. Síntoma del bug: director dice "eliminaste todo lo de [sección]". (Full: `_legacy §0.1.2.4`.)

---

## 🌐 Frontend / runtime

### L-05 · NO usar `<datalist>` para búsqueda/autocompletar
Falla en Safari (sobre todo con `autocomplete="off"`, dentro de iframe, o con extensiones de privacidad): el dropdown nunca renderiza. Patrón canónico = **combobox custom** (`<input role="combobox">` + `<ul role="listbox">`, filtro NFD case-insensitive multi-campo, ↑↓ Enter Esc, tope 30 + "… y N más", ARIA completo, `dispatchEvent(new Event('change'))` en commit para no romper handlers downstream). Ref. `initMatSelect()` en `assets/js/calculo-refrigeracion.js`. (Full: `_legacy §0.1.2.12`.)

### L-06 · Informes imprimibles: paginación manual con `.sheet` divs
Safari/WebKit **NO repite** `<thead>/<tfoot>` de tabla paginada (solo en pág 1 y última), y `position:fixed` + `@page margin` es inconsistente entre browsers. Único método universal: divs `.sheet` (8.5×11in, `page-break-after:always`) cada uno con su header/footer DOM-explícito, rellenados por un script de paginación que distribuye bloques midiendo `scrollHeight > clientHeight`. Flujo natural (sin `page-break-after:always` salvo entre documentos), `break-inside:avoid` en bloques atómicos, captura exhaustiva del formulario + totales + BOM + fórmulas con sustitución numérica + diagramas. **Verificar en Safari REAL** — `puppeteer.pdf()`/headless NO representa `window.print()`. (Full: `_legacy §0.1.2.2` y `§0.1.2.3`.)

### L-07 · Captura HD de Chart.js: escalar fontsize Y lineWidth, no solo el canvas
Si subes el canvas 4× pero dejas los font sizes en px absolutos, los textos quedan ilegibles. Escalar proporcionalmente TODOS los font sizes de las opciones, `borderWidth`/`pointRadius` de datasets, boxWidth de leyenda, y todo lo que dibuje el plugin `afterDraw` (vía `chart._exportScale`). Backup → aplicar → `resize`+`update` → capturar → restaurar. (Full: `_legacy §0.1.2.8`.)

### L-08 · Foto de referencia → embeber con `<image>`, NUNCA redibujar en SVG
Redibujar una foto del director como SVG siempre la "altera" (colores, proporciones, detalles inventados). Embeber la imagen original con `<image href>`, archivarla en `assets/img/refs/`, agregar solo anotaciones encima (cotas, regiones interactivas invisibles). SVG vectorial solo cuando NO hay foto. Si la foto es referencia, fidelidad + interactividad son obligatorias (2-3 iteraciones esperadas). (Full: `_legacy §0.1.2.10` y `§0.1.2.11`.)

---

## 🔥 Backend / infra / entorno

### L-09 · Deploys Firebase son MANUALES
Si modifico `firestore.rules` / `firestore.indexes.json` / `storage.rules` / `functions/*`, AVISAR al director el comando `firebase deploy --only X` en el MISMO turno + incluir bloque "⚠ Requiere deploy" al final del commit message. Sin deploy: queries fallan con `permission-denied` (rules), `FAILED_PRECONDITION` (índices) o corre código viejo (functions). (Full: `_legacy §0.1.1`.)

### L-10 · Firestore rechaza `undefined` con un `permission-denied` ENGAÑOSO
Cuando un payload tiene campos `undefined`/`NaN` (típico en objetos anidados de funciones puras), la SDK Web los enmascara como `permission-denied` aunque seas admin y las rules estén bien. Receta: helper `deepClean(payload)` (en `assets/js/data/_firestore_clean.js`) que recursivamente omite `undefined`/`NaN`/`Infinity`/funciones, preserva `null`/`0`/`''`/`false` y objetos Firestore (Timestamp/FieldValue/GeoPoint/DocumentReference). Aplicar JUSTO antes de `addDoc`/`setDoc`/`updateDoc`. (Full: `_legacy §0.1.2.6`.)

### L-11 · Re-deploy de `firestore.rules` tras CUALQUIER cambio
Si una colección NUEVA falla con `permission-denied` mientras colecciones viejas funcionan y el pre-chequeo de admin pasa → las rules en prod no incluyen el `match` nuevo (cae al `match /{document=**} { allow: if false }`). Verificar que el deploy diga "released rules ... to cloud.firestore" (no solo "deployed indexes"). (Full: `_legacy §0.1.2.7`.)

### L-12 · `/suministros/{X}` usa docId compuesto `{contrato_id}_{codigo}`
Desde la migración N5. Usar `composeDocId(cid, codigo)` de `domain/contratos.js`; nunca el código plano (falla silenciosamente para contratos post-N5). Pasar `contrato_id` en todo consumer de `/suministros`. Síntoma: "Suministro X no existe" / stock "—". (Full: `_legacy §0.1.3`.)

### L-13 · Validaciones críticas en el SUBMIT, no solo al abrir el form + doble defensa en data layer
El estado del modal NO es fuente de verdad (race conditions de queries async). Re-verificar EN VIVO justo antes de escribir; si la query de verificación falla, BLOQUEAR con mensaje accionable (no retornar `{existe:false}` silencioso). El data layer (`crear()`) revalida el invariante independientemente. (Full: `_legacy §0.1.2.9`.)

### L-14 · Lint local con `npm install` + `npm run lint:html`, NO `npx html-validate`
`npx` descarga una versión transitoria más laxa que la fijada en `package.json` → exit 0 local pero CI rojo (ej. WCAG H63 `<th>` sin `scope`). CI corre `npm ci || npm install` + `npm run lint:html`. (Full: `_legacy §0.1.2.5`.)

### L-15 · setDoc(merge:true) sobre colección con rules de enums obligatorios
El `request.resource.data` que evalúan las rules es el estado merged-post. Si el doc no existía, campos requeridos (`codigo`, `estado`) quedan `undefined` → falla la rule. Rellenar defaults seguros en el data layer respetando valores existentes. (Full: `_legacy §9.9` / v2.8.1.)

---

## 🔗 Integración cross-módulo (patrón canónico)

### L-16 · Integración cross-módulo = dominio puro + idempotencia + trazabilidad bidireccional
Cuando un módulo A escribe/lee datos en módulo B: (1) funciones puras en `domain/` (sin Firebase, testables); (2) data layers thin en `data/` (one-shot / realtime con debounce ~200ms / orquestador transaccional); (3) idempotencia por **marcador persistente** en el doc (no transiente); (4) trazabilidad en AMBAS direcciones (array de IDs origen→destino + identificador embebido destino→origen); (5) hook no-bloqueante (try/catch que solo loguea, **nunca re-lanza** — no revertir el write upstream); (6) tests de la función pura sin Firebase; (7) UI con 3 estados (OK/bloqueo/fuera-de-scope). (Full: `_legacy §0.1.2.13`.)

### L-17 · NO dejar pasos manuales del director post-merge para "encender" una integración
Prohibido decir "andá al admin, editá N items, confirmá X". Si la feature necesita data nueva en Firestore: auto-aplicación silenciosa idempotente al primer load, O banner accionable de UN click, O Cloud Function trigger, O script CI. Detectar el cold-start activamente (no fallar con "vacío" silencioso). El detector debe disparar si CUALQUIER atributo del mapeo congelado difiere, no solo si está totalmente ausente. (Full: `_legacy §0.1.2.14`.)

---

## 🗂️ Validación de código muerto

### L-18 · Cuarentenar, no borrar
Antes de eliminar código presuntamente muerto: cero refs internas (`grep` en HTML/JS/MJS/JSON/TS) + ausencia en sitemap/manifest/router. Mover a `_legacy/` con fila en `_legacy/README.md` (qué era, por qué, fecha) en vez de borrar. Borrado definitivo solo con ADR que lo justifique. (Límite de guardián, `CLAUDE.md §G.4`.)

---

## 🛠️ Claude Code / harness (skills, config)

### L-19 · Activar una skill repo-only = copiar su `SKILL.md` a `.claude/skills/<name>/` + reiniciar
`skills/` del repo **NO es la fuente** de lo que Claude carga; el bundle `anthropic-skills:*` viene del entorno. Para activar una skill que solo existe en `skills/` (repo-only): copiar su carpeta a `.claude/skills/<name>/`, donde `<name>` = el **`name` del frontmatter** (NO el nombre de la carpeta fuente — pueden diferir, ej. `brutalist-skill` → `industrial-brutalist-ui`; sácalo con `grep -m1 '^name:' SKILL.md`). Claude Code escanea esa ruta **solo en boot** → no hay carga en caliente, **el director debe reiniciar**. Gotchas: (1) bundles con varias skills anidadas (ej. `taste-skill-main/<sub>/SKILL.md`) → copiar cada subcarpeta por separado, no la raíz; (2) carpetas que son **plugin** (`code-modernization`) o **subagente** (`code-simplifier`) NO tienen `SKILL.md` → no cargan como skill; (3) NO re-stagear skills que ya están en el bundle → colisión de `name`. Validar: `find .claude/skills -name SKILL.md` + chequear `name`+`description` en cada una. **Ojo persistencia**: `.claude/` está gitignorado (`.gitignore:22`) → lo copiado es **local-only**; si se re-clona el repo, re-correr el copy (la fuente sobrevive en `skills/`, que sí está tracked). (Ref: ADR-002, `99`.)

---

## 🪞 Meta: fallos del propio cerebro (Reflejo de Autocrítica `CLAUDE.md §G.4`)

> El cerebro se critica a SÍ MISMO: dónde una neurona/regla **causó un error o me
> engañó**, y qué se corrigió. Cierra el bucle: usar → criticar → corregir = madurez.
> Formato: **Defecto del cerebro → Causa → Corrección → Principio**.

### M-01 · `brain-check.mjs` ensuciaba la raíz con un archivo `NUL` en cada corrida
**Defecto del cerebro:** el linter del template traía `git rev-parse … 2>NUL` (sintaxis de redirección de Windows). **Causa:** en macOS/Linux `2>NUL` no descarta stderr — crea un archivo literal llamado `NUL` en `cwd` cada vez que corre el chequeo de frescura 4c; el artefacto reaparecía tras borrarlo. **Corrección:** `scripts/brain-check.mjs:171` → `2>/dev/null` (2×); verificado que ya no se recrea. **Principio:** el tooling del cerebro debe ser POSIX-limpio; un linter que contamina el repo que audita es peor que no tenerlo. Si ves un `NUL` 0-byte huérfano, busca `2>NUL` en scripts.

> _(Ejemplos universales a esperar, aún no materializados:
> - M-XX · Confiar en `origin/*` local sin `git fetch` → afirmé estado de despliegue falso.
> - M-XX · "Verifica, no asumas" es UNIVERSAL, no solo RCA de código.
> - M-XX · Lo verificable va al LINTER que falla, no a un reflejo que debo recordar.)_

---

> Esta neurona crece sola (bajo guía del constructor). Si una lección se vuelve
> doctrina permanente, promoverla a `CLAUDE.md §3`. Si encaja en un § histórico,
> enlazarla. Mantenerla accionable: síntoma → causa → receta.
>
> **📏 Capacidad (`CLAUDE.md §G.5`): ~350 líneas.** Al acercarse, SHARD por categoría
> → ej. extraer la sección "Git / refactor" a `docs/31-LECCIONES-GIT.md`, registrarla
> en `CLAUDE.md §0` + `00-INDICE`, y dejar aquí un puntero a la hija. Nada huérfano.

---

## 🤖 IA / Claude API (Anthropic)

### L-20 · IDs de modelo Claude: forma exacta y cascada por costo
Los IDs válidos son `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` (alias sin sufijo de fecha — NO inventar `claude-4-8-opus`, `claude-3-5-sonnet-20241022` ni "Opus 4.8/Sonnet 4.7": no existen, dan 404/400). Verificar SIEMPRE contra la skill **`claude-api`** (`shared/models.md`) antes de codear, no contra memoria de entrenamiento. Para extracción/clasificación: **Sonnet 4.6 por defecto** (mejor $/calidad + visión), **Opus 4.7 solo escalación** en PDFs ambiguos, **Haiku 4.5** para lo simple. Opus en cada documento es caro e innecesario. Allowlist server-side + default seguro (la función `extraerPruebasElectricasIA` rechaza cualquier `modelId` fuera del set).

### L-21 · Extracción de PDFs variables con Claude (patrón de la plataforma)
Receta para llevar PDFs sin formato fijo a un schema estructurado, sin exponer la API key ni romper el front:
1. **Cloud Function `onCall`** (firebase-functions/v2/https) con el secret **`LLM_API_KEY`** (`defineSecret`) — la key NUNCA va al cliente. Región DEBE coincidir con el resto de funciones del proyecto (`southamerica-east1`) y con `getFunctions(app, REGION)` del cliente, o el callable da `not-found`.
2. **PDF nativo, no texto**: el cliente sube el PDF a Storage (ya lo hace `subirPDF`) y pasa solo `storagePath`; la función lo **descarga server-side** (`getStorage().bucket().file(path).download()` → base64) y lo manda como bloque `{type:'document', source:{type:'base64', media_type:'application/pdf'}}`. Así Claude ve tablas/layout/escaneos (mejor que texto plano) y se evita el límite de payload del callable.
3. **Tool use forzado** (`tool_choice:{type:'tool', name:...}`) con `input_schema` que **espeja el sanitizador del dominio** → el JSON sale con la forma exacta que consume `sanitizarInforme`. NO calcular calificaciones/semáforo en la IA: que devuelva números crudos y el dominio derive el color (un solo punto de verdad). Inline los sub-objetos repetidos (no `$ref/$defs` — poco fiable en tool use no-estricto).
4. **Prompt caching** (`cache_control:{type:'ephemeral'}` en el system) sobre la pericia de dominio (estable) → ~80% menos costo de input en cargas repetidas. El PDF (volátil) va en `messages`, después del prefijo cacheado.
5. **Fallback en capas**: IA → extractor local existente → editor manual. La función es "thin" (devuelve `tool_use.input` crudo); el cliente sigue sanitizando/persistiendo igual (mínima superficie de cambio, anti-regresión). Contrato fijado por test puro `tests/pruebas_electricas_ia.test.js` (sin red ni Firebase).

### L-22 · Contenido sobre el fondo "liquid glass" necesita superficie propia
El fondo global de la app es una FOTO fija a pantalla completa: `.aqua-power-scene` (`assets/css/aqua-components.css` — `position:fixed; inset:0; z-index:-1; background-image:url(../img/aqua/substation-photo.webp)`). Cualquier contenido que NO tenga fondo propio (títulos `h2/h4`, párrafos, leyendas) queda sobre la foto y se vuelve ILEGIBLE (bajo contraste). Síntoma del cliente: "los textos se ocultan con el fondo". **Receta**: dar a cada sección de contenido una superficie sólida (`background:var(--pe-surface)` + borde + radio + sombra → panel), acotada por `[data-tab-panel="..."] > section` para no afectar otras vistas (ej. la biblioteca, que sí quiere la foto visible). Evitar "tarjeta dentro de tarjeta" quitando la sombra de los contenedores internos (`.chartbox/.tblwrap/.matrix`). Las tablas ya no se rompen si tienen `min-width` + wrapper `overflow-x:auto` (ya estaba). **Cómo evitarlo**: al crear un módulo nuevo, NUNCA dejar texto suelto sobre el body con `.aqua-power-scene`; siempre dentro de un panel/`card`.
