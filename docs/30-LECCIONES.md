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

### L-01 · El push lo hace el director (el runtime da 403)
Los canales de push del runtime (`git push` vía proxy, `mcp__github__*`) dan **403** en este repo. **Flujo vigente (ADR-005)**: Claude commitea + deploya; **el director hace los `git push`** (GitHub Desktop o su terminal con sus credenciales). Claude NUNCA force-push a `main`. Si alguna vez se necesitara push desde el runtime, el único canal que funcionaría es `git push https://USER:TOKEN@github.com/USER/REPO.git BRANCH:BRANCH` con PAT clásico del dueño inline (el `local_proxy` resetea el remote → pasar la URL con token en CADA push). **Jamás** escribir el token a archivo/commit/PR/log; redactar con `sed 's|ghp_[A-Za-z0-9]*|ghp_****|g'`. (Full: `_legacy §0.1`.)

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

### L-09 · Deploys Firebase los ejecuta Claude (flujo ADR-005, desde 2026-06-06)
Al modificar `firestore.rules` / `firestore.indexes.json` / `storage.rules` / `functions/*`, **Claude ejecuta** `firebase deploy --only X` (firebase CLI local autenticado), **anuncia el deploy en el MISMO turno** (acción de producción) y verifica el resultado. Sin deploy: queries fallan con `permission-denied` (rules), `FAILED_PRECONDITION` (índices) o corre código viejo (functions). El **director hace los push**; Claude NUNCA force-push a `main`. (Antes era manual del director — ver ADR-005 en `99 §5`. Full histórico: `_legacy §0.1.1`.)

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

### L-35 · IA secundaria (análisis/narrativa) reusa los datos YA extraídos, NO re-manda el PDF
Síntoma/contexto: F3 pedía una "narrativa de tendencia" por IA sobre la evolución de varios informes. El instinto sería mandar los PDFs (como `extraerPruebasElectricasIA`). Error caro: visión + thinking + 1GiB + 540s por documento, y re-extraer lo que YA está en Firestore. **Receta (`narrativaTendenciaIA`)**: cuando la IA hace un análisis SECUNDARIO sobre datos que la plataforma ya extrajo de forma determinista, manda solo el **resumen numérico compacto** (texto plano, p.ej. `resumenTendenciaParaIA` → series {x,y} + umbral por métrica). Entrada chica → función **barata**: sin documento/visión, sin tool_use (texto libre basta), sin thinking, `max_tokens` bajo, timeout/memoria reducidos (120s/512MiB vs 540s/1GiB). El cliente arma el payload desde el dominio puro (testeable) y la función solo redacta. **Cómo evitarlo**: distingue extracción (PDF→datos, cara, una vez) de razonamiento sobre datos (datos→prosa, barata, on-demand); nunca re-subas la fuente cruda para lo segundo. Anti-XSS al pintar la salida: escapar y reaplicar markdown-lite, nunca innerHTML del texto del modelo.

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

### L-23 · Gráficas SVG: eje Y dinámico para no desbordar el marco
Las 7 gráficas de `assets/js/ui/pruebas/grafico-svg.js` tenían el máximo del eje Y **fijo** (ej. aislamiento `ymax=4`, relación `0.6`, resistencia `6`). Un valor real mayor (p.ej. aislamiento 5.72 GΩ) hacía que `Y(v)` cayera por encima del tope y la barra/punto se dibujara FUERA de la sección. **Receta**: techo de eje dinámico — helper puro `ejeMax(valores, limite, piso)` = `max(dataMax*1.15, limite*1.1, piso)` (contiene SIEMPRE datos + línea límite, sin bajar del piso bonito) + `ticksY(ymax)` (líneas de cuadrícula redondeadas) + `drawGridY()` (pinta grid + límite rojo + guía ámbar en su valor exacto). Cada gráfica calcula su `ymax` de los datos ANTES de definir `Y`. Helpers exportados y testeables en `node` (no requieren DOM si no se llama el render). **Cómo evitarlo**: nunca asumir un rango fijo para datos de campo (aislamiento puede ser 2–50 GΩ); el eje se adapta al dato.

### L-24 · Extracción IA: completitud en informes densos / multi-TAP
Síntoma: con un informe de otro laboratorio (slides, 3 devanados, 17 posiciones de TAP) y modelo **Sonnet**, solo se extrajo tan δ; excitación/relación/resistencia/aislamiento/identidad salieron vacíos. Causa: (1) las pruebas vienen POR posición de TAP (17 filas) que no encajan en el schema de valor único → el modelo las dejó vacías; (2) modelos menos capaces (Sonnet) rinden peor que Opus en formatos densos. **Receta**: instruir explícitamente en el system prompt → "recorre TODO el documento, extrae TODAS las familias, NO te detengas tras la primera; para datos por TAP elige la posición representativa/peor caso y rellena; nunca dejar vacío lo que aparece". Subir `max_tokens` (16k→32k) como seguro. **Para informes densos, preferir Opus 4.7** (en la 1ª prueba real Opus extrajo un Applus completo perfecto; Sonnet falló el EMS denso). Pendiente mayor: extender el schema a series POR TAP (curvas como el informe original) — es cambio de schema+render, no solo prompt.

### L-25 · Purgar archivos sensibles del historial git (filter-repo)
Si se commiteó por error algo que no debía (PDFs de cliente, secretos) — sobre todo en repo PÚBLICO — sacarlo del HEAD no basta: queda en commits viejos. Receta segura:
1. **Respaldo primero**: `git bundle create /tmp/backup-$(date +%s).bundle --all` (snapshot completo restaurable con `git clone`).
2. Registrar los SHAs actuales de las ramas afectadas (`git branch -a --contains <commit-que-lo-añadió>`) para rollback.
3. Instalar: `pip3 install --user git-filter-repo` (queda en `~/Library/Python/3.9/bin/git-filter-repo`).
4. Reescribir: `~/Library/Python/3.9/bin/git-filter-repo --invert-paths --path "Debug/" --force` (quita esa ruta de TODA la historia y todas las refs; cambia SHAs solo en commits que la contenían o descienden de ellos).
5. filter-repo **elimina el remoto `origin`** por seguridad → re-agregarlo: `git remote add origin <url>`.
6. Verificar: `git rev-list --objects --all | grep -c "Debug/"` debe dar 0.
7. **Force-push** de cada rama afectada que esté en origin (lo hace el director; force-push a `main` es la op más peligrosa, NUNCA Claude la dispara). Solo las ramas que existen en origin necesitan push (las claude/* locales no).
**Caveats**: GitHub puede cachear los commits viejos/forks tras el force-push (para datos críticos, pedir a GitHub Support); tratar lo expuesto como ya-comprometido. Quien tenga clon debe re-clonar.

### L-26 · `tool_choice` forzado MATA el thinking → extracción incompleta en docs densos
Síntoma persistente: al extraer un informe denso (22 págs, 3 devanados, 17 TAPs) con Claude, SIEMPRE salía solo la primera prueba (tan δ) y el resto vacío, **sin importar cuánto se reforzara el system prompt** ni subir `max_tokens`. Causa raíz: la llamada usaba `tool_choice: {type:'tool', name:...}` (herramienta FORZADA). Con herramienta forzada el modelo **NO puede emitir bloques de thinking** → debe producir el JSON de un solo golpe sin razonar → en un documento largo se "conforma" (satisficing): extrae lo más visible/primero y deja el resto. **Receta**: para extracción compleja usar `tool_choice: {type:'auto'}` + `thinking:{type:'adaptive'}` + `output_config:{effort:'high'}` (solo Opus 4.7 / Sonnet 4.6; en Haiku omitir) → el modelo recorre TODO el documento razonando y luego llama la herramienta con todo. Usar **streaming** (`client.messages.stream(...).finalMessage()`) para que outputs largos no corten por timeout. El prompt de usuario debe pedir explícitamente recorrer el documento completo y no parar en la primera prueba. **Cómo evitarlo**: herramienta forzada SOLO para tareas triviales de 1 paso; para análisis de documentos largos, auto + thinking SIEMPRE.

### L-27 · `httpsCallable` default 70 s → IA "falla y cae al motor local" en PDFs lentos
Síntoma: subir un PDF escaneado denso (DB5: 3.86 MB, 5 págs de alta resolución) → "procesa por minutos" → la IA "falla" y el sistema cae al lector local (sin bloques); en consola un 404 de `…bloques.json` (este 404 es **benigno**: es `cargarBloques` que no halla el JSON porque la IA no llegó a generarlo). Causa raíz: **el SDK de Firebase Functions pone un timeout por defecto de 70 s al `httpsCallable`** si no se pasa `{ timeout }`. Una extracción con `thinking`+`effort:high`+visión sobre un escaneo tarda > 70 s → el **cliente** aborta (`deadline-exceeded`) aunque la función server-side siga corriendo (su `timeoutSeconds` era 300) → `catch` → fallback al OCR local (lento → de ahí los "minutos"). Empeorado porque la extracción de `bloques` (curvas completas) encareció el tiempo. **Receta**: pasar `timeout` explícito al callable `httpsCallable(fns, name, { timeout: 540000 })` y que sea **≥** el `timeoutSeconds` de la función (subido a 540 s; gen2 admite hasta 3600). Subir memoria a `1GiB` (gen2 acopla CPU → base64+visión más rápidos). **Cómo evitarlo**: en CUALQUIER callable que invoque IA/operación larga, fijar `timeout` explícito en cliente Y servidor — nunca confiar en el default de 70 s.

### L-28 · UI gated por rol admin: re-render al `sgm:session-ready` (carrera intermitente)
Síntoma: la "X" de eliminar libros de Pruebas Eléctricas aparecía a veces sí, a veces no, sin patrón claro. Causa raíz: el botón se renderiza con `puedeBorrar = isReady() && esAdmin()`, y `esAdmin()` lee `window.__sgmSession`, que **`auth/session-guard.js` resuelve de forma ASÍNCRONA** (Firebase Auth + fetch del perfil Firestore) y recién entonces setea `__sgmSession` (~línea 245) + dispara `window.dispatchEvent(new CustomEvent('sgm:session-ready', {detail: sess}))` (~248). La grilla se pinta en el `onSnapshot` de unidades, cadena async independiente: si las unidades llegan ANTES de que el perfil resuelva → `esAdmin()===false` → sin X; si el snapshot no se re-dispara, queda sin X. **Receta**: cualquier UI condicionada al rol admin debe **re-renderizar al recibir `sgm:session-ready`** (`window.addEventListener('sgm:session-ready', () => reRender())`), además de leer `__sgmSession` en el primer render. Patrón ya usado en `contrato-info.js` (`{once:true}`) y `aqua-shell.js`. **Cómo evitarlo**: nunca asumir que `window.__sgmSession` está listo en el primer render; el rol llega async → siempre escuchar el evento para re-aplicar gates de admin.

### L-29 · Firebase Storage NO se puede LEER desde el navegador sin CORS → datos que el browser lee van a Firestore
Síntoma: tras subir un PDF, la consola llenaba de errores rojos `Access to XMLHttpRequest at firebasestorage.googleapis.com… blocked by CORS policy: No 'Access-Control-Allow-Origin'` + `net::ERR_FAILED 200 (OK)` (`connection.ts:88`), y la sección de bloques salía vacía. Causa raíz: `getBytes`/`getBlob`/`getDownloadURL`+fetch del SDK de Storage hacen un XHR al endpoint `?alt=media`, que **requiere CORS configurado en el bucket GCS** (vía `gsutil cors set`). El bucket de Firebase por defecto NO trae CORS para orígenes web → toda **lectura** desde el navegador se bloquea. Las **escrituras** (`uploadBytes`/`uploadString`/`subirPDF`) sí pasan (endpoint distinto) → engaña: el dato se guarda pero no se puede releer. **Receta**: para datos estructurados que el navegador deba LEER, NO usar Storage como store legible — usar **Firestore** (otro transporte, sin CORS). Reservar Storage para binarios que se sirven por URL directa (href/descarga) o se leen server-side (Cloud Function con admin SDK). Si SÍ se necesita leer Storage desde el browser, configurar CORS del bucket (`gsutil cors set cors.json gs://bucket`) — pero implica gcloud/gsutil + mantenimiento. Caso real: ADR-007 movió los bloques de `…/{informeId}.bloques.json` (Storage) a subcolección Firestore `informes/{id}/diagnostico/ia`. **Cómo evitarlo**: decisión de almacenamiento = ¿quién lee? Browser→Firestore; server/binario→Storage.

### L-30 · Firestore NO admite arrays anidados → serializar payloads complejos a string JSON
Síntoma: al mover los bloques a Firestore (L-29), `setDoc()` falló con `Function setDoc() called with invalid data. Nested arrays are not supported (found in document …/diagnostico/ia)` → el diagnóstico no se guardaba y el tablero seguía vacío. Causa raíz: **Firestore prohíbe arrays dentro de arrays**. El modelo de bloques tiene `tabla.filas = [[celda, celda], …]` (array de arrays) → inválido. (Los arrays DE OBJETOS sí se permiten: `[{...},{...}]`; lo prohibido es `[[...],[...]]`.) **Receta**: para persistir en Firestore cualquier estructura con arrays anidados (tablas, matrices, JSON arbitrario del LLM), serializar el bloque complejo a un **string JSON** en un solo campo (`{ payload: JSON.stringify(obj), ts }`) y re-parsear a la lectura. Inmune a arrays anidados, a `undefined` y a tipos no soportados; sigue en Firestore (sin CORS, L-29). Alternativa más invasiva: re-modelar `filas` como array de objetos `{cells:[...]}`. Caso real: ADR-007, `guardarBloques` guarda `payload` string. **Cómo evitarlo**: antes de `setDoc` de datos derivados de un LLM o de tablas, asumir arrays anidados → string JSON por defecto.

### L-32 · Cambiar el prompt ≠ que el LLM obedezca → VERIFICAR la salida cruda antes de declarar hecho
Síntoma: reforcé el prompt para que la IA emitiera la `tabla` de detalle COMPLETA en las curvas por TAP (excitación/relación/resistencia), declaré la feature lista y la desplegué; al revisar el tablero, las tablas seguían flacas (TAP|A|B|C). Causa raíz: la IA puso los datos en `series` (la curva) y **omitió `tabla`** pese a la instrucción — el render cayó a la tabla derivada de las series. Una instrucción en prosa ("incluye la tabla completa") es una sugerencia DÉBIL: el LLM la ignora si ya cubrió el dato de otra forma. Repetí el anti-patrón §3.3 (afirmar sin evidencia) al asumir que cambiar el prompt = obtener el resultado. **Receta**: (1) tras tocar un prompt, VERIFICA la salida real en una corrida (logs `[IA-DIAG]` con `mediciones_raw`/`bloques_raw`, o el panel "Interpretación cruda") ANTES de decir "hecho"; el `[IA-DIAG-RESUMEN]` trae `n_bloques`/`n_series` pero NO si la `tabla` vino — hay que mirar el crudo. (2) Para forzar FORMATO/estructura, un **ejemplo few-shot concreto** en el prompt es mucho más fuerte que prosa imperativa. (3) Si la fiabilidad sigue baja, considera marcar el campo `required` en el tool schema o derivar el dato en el cliente. Caso real: ADR-008 lote 4→5, `functions/index.js` SYSTEM_PRUEBAS_IA. **Cómo evitarlo**: nunca cerrar una tarea que depende de la salida del LLM sin haber leído esa salida en una corrida real.

### L-33 · El LLM omite estructura REDUNDANTE → derivar en el cliente + adjuntar lo único-del-PDF inline
Síntoma: tras L-32, ni siquiera el ejemplo few-shot logró que la IA emitiera la `tabla` ancha de 17 filas en las curvas por TAP (verificado por logs: `tabla cols=0` en excitación/relación/resistencia, 2 corridas). Causa raíz: pedir una `tabla` que RE-EMITE datos que el LLM ya puso en `series` (TAP + valor por fase) es trabajo redundante y voluminoso → el modelo lo evita sistemáticamente, da igual cuánto insistas. **Receta (la que funcionó, ADR-008 lote 6)**: NO depender del LLM para lo que se puede construir o derivar:
- **Derivar en el cliente** lo computable a partir de lo que el LLM SÍ emite fiable (las `series`): columnas Desviación %/Evaluación con `derivarTablaTAP()` (dominio puro, testeable). Estas aparecen sin re-extract, solo con desplegar el frontend.
- **Canal `extra` por punto** para lo único-del-PDF (Potencia W, tensión, relación teórica, %DIF, R.Ref): el LLM lo adjunta INLINE al punto que YA está emitiendo (`{x,y,extra:{...}}`) — mínima data nueva, sin re-emitir índices ni primarios → mucho más fiable que una estructura paralela.
- **Umbrales/criterios normativos = DOMINIO, no LLM**: `UMBRAL_DESBALANCE`/`CRITERIOS_NORMA` los adjunta el shell; nunca confiar en que la IA los traiga.
**Cómo evitarlo**: cuando una salida del LLM falle 2 veces, no insistas en el prompt — re-arquitectura: ¿qué es derivable de lo fiable? ¿cuál es el mínimo dato nuevo que el modelo sí dará inline? El prompt es la última palanca, no la primera.

### L-34 · Auto-graficar TODA magnitud derivada produce ruido/duplicados → curar qué amerita gráfica
Síntoma: al graficar automáticamente cada clave `extra`/derivada de un bloque, el tablero se llenó de gráficas redundantes — R.Ref ≈ R.Medida (curva IDÉNTICA a la principal), %DIF duplicaba la gráfica de desviación, Tensión/Relación teórica son entradas monótonas sin valor diagnóstico. Causa raíz: "renderiza todo lo que tengas" trata datos de TABLA como datos de GRÁFICA. **Receta (ADR-009, `bloquesDeExtra`/`EXTRA_GRAFICABLE`)**: la data secundaria va a la TABLA por defecto; SOLO se grafica una magnitud DISTINTA y diagnóstica (en pruebas: la Potencia, su propia escala). Curar con un criterio (regex/allowlist/flag) qué amerita su propia gráfica; el resto, tabla. **Cómo evitarlo**: al auto-renderizar desde datos, distingue "MOSTRAR el dato" (tabla) de "VISUALIZAR una tendencia/relación" (gráfica) — no son lo mismo; más gráficas ≠ más claridad.

### L-31 · Las claves categóricas que emite el LLM NO son estables → aliasear, no igualar
Síntoma: tras un cambio de prompt, el scorecard dejó de mostrar la fila "Tan δ de devanados" — la IA empezó a emitir `prueba: "tan_delta"` cuando antes emitía `"tand"`, y el código filtraba con igualdad exacta (`keys.includes('tand')`). Causa raíz: el valor de un campo de **clasificación libre** que produce el LLM (familia de prueba, categoría, etiqueta) puede variar entre corridas/versiones de modelo/prompt aunque el dato sea el mismo. Igualar contra UN string es frágil. **Receta**: cualquier MATCHING contra una clave categórica del LLM debe usar un **conjunto de alias** (`['tand','tan_delta']`) o normalizar (lowercase + sinónimos) antes de comparar. Lo mismo aplica a `prueba`, `tipo_prueba`, nombres de sección, unidades, etc. Caso real: ADR-008, `FAMILIAS_SCORE` aliasea `tand`/`tan_delta`; `bloqueDesviacion` keya por `prueba==='excitacion'` (vigilar si cambia). **Cómo evitarlo**: nunca asumir que el LLM repetirá literal una clave categórica; diseñar el consumo con alias/normalización desde el inicio.
