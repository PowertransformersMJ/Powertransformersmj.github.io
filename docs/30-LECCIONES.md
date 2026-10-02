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
**Disparador**: se commiteó algo sensible (PDFs de cliente, secretos) en repo público · **Cicatriz**: sacarlo del HEAD no basta — vive en commits viejos · **Regla**: (1) respaldo `git bundle create /tmp/backup-$(date +%s).bundle --all`; (2) anotar SHAs de ramas afectadas; (3) `pip3 install --user git-filter-repo`; (4) `git-filter-repo --invert-paths --path "Debug/" --force`; (5) re-agregar `origin` (filter-repo lo borra); (6) verificar `git rev-list --objects --all | grep -c "Debug/"` = 0; (7) force-push lo hace el DIRECTOR, nunca Claude. GitHub puede cachear commits viejos (pedir a Support si crítico); lo expuesto es ya-comprometido; clones deben re-clonar. (8) `--branch <rama>` reescribe SOLO esa rama: para purgar el repo entero NO se usa; `git rm` + `gc` antes (callejón 2026-07-21; antes solo vivía en `10`).
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
**Disparador**: tocar `firestore.rules` / `firestore.indexes.json` / `storage.rules` / `functions/*`. · **Cicatriz**: sin deploy → `permission-denied` (rules), `FAILED_PRECONDITION` (índices) o código viejo (functions). · **Regla**: Claude ejecuta `firebase deploy --only X` (CLI local autenticado), anuncia el deploy en el MISMO turno y verifica. Los push también los hace Claude (L-01, ADR-051); NUNCA force-push a `main`. (ADR-005 en `99 §5`; full: `_legacy §0.1.1`.)

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
**Disparador**: decidir dónde persistir datos · **Cicatriz**: lecturas (`getBytes`/`getBlob`/`getDownloadURL`+fetch, endpoint `?alt=media`) bloqueadas por CORS (`No 'Access-Control-Allow-Origin'`, `net::ERR_FAILED 200`); las ESCRITURAS sí pasan → engaña · **Regla**: ¿quién lee? Browser → Firestore (sin CORS); server/binario por URL directa → Storage. Configurar CORS del bucket (`gsutil cors set`) solo si es imprescindible. Caso: ADR-007 movió bloques a subcolección `informes/{id}/diagnostico/ia`. **Reincidió** en `§71`/`§99` (firmas con `getBytes`, probadas solo en el emulador): en producción, 503 → pasaron a Firestore (`99 §100`).

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

## 🛠️ Claude Code, entorno y herramientas → hija `33`

> **Lo que muerde por el ENTORNO y no por el código** vive en
> [`33-LECCIONES-HARNESS.md`](33-LECCIONES-HARNESS.md) (§G.5): activar skills, automatizar el Chrome
> del Ingeniero, el `grep` que no es GNU grep, cómo se le pasan datos a un workflow y por qué un
> workflow de horas no sobrevive. Léela ANTES de lanzar trabajo largo con agentes o de fiarte de un
> barrido por consola. La hija lleva su propio listado — aquí no se duplican sus IDs.
---

### L-63 · No re-pedir una autorización que la doctrina YA concedió (fricción disfrazada de prudencia)
**Disparador**: estar a punto de preguntar "¿procedo?" por una acción que `CLAUDE.md` ya autoriza de forma permanente. · **Cicatriz** (2026-07-28, ADR-058): terminé la migración completa y **retuve el merge a `main` pidiendo el visto bueno**, cuando §2 dice literalmente *"Claude ejecuta commit + push + merge + TODOS los deploys"* desde la entrevista F3a. El Ingeniero tuvo que repetirlo: *"tú haces commit, push, merge a main y todos los deploy siempre"*. Pedir permiso ya dado no es cautela: es devolverle al dueño un trabajo que él ya delegó, y encima suena a que no me leí su propia política. · **Regla**: antes de preguntar, **verifica si §2/§G ya lo cubre**. Si lo cubre → EJECUTA y reporta. Reserva la pregunta para lo que la doctrina NO cubre: dinero, legal, datos de cliente, go/no-go de negocio, o algo genuinamente irreversible y no previsto. Corolario: la validación por commit que él sí pidió es **presentarle el resumen claro**, no esperar su "sí" para cada paso. · **Excepción (Fichas, desde `§92`)**: lo que toca el PAPEL que se firma va en rama + vista previa + su «procede» antes del merge; lo demás, directo.

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

### M-06 · Escribir la lección no la INSTALA: la misma sesión la volvió a romper
**Disparador**: dar por corregido un fallo porque ya está escrito en el cerebro. · **Cicatriz** (2026-09-01): en la auditoría §68 diagnostiqué que el mapa espacial se pudre en silencio y escribí **M-02** — «al crear una página o un módulo, la fila en `20` va en el MISMO commit». **Dos tareas después, en esta misma sesión, creé cinco cosas** (la página de Órdenes de Materiales, tres módulos de firmas, una neurona hija) **y no anoté ninguna**. El fallo lo destapó el propio dueño al pedir «documenta absolutamente todo», no un gate. · **Regla**: una lección recién escrita no es un reflejo adquirido; es un texto. Mientras no exista un gate que la vigile, el cierre de tarea debe incluir la comprobación EXPLÍCITA — `git status` de lo creado contra `grep` en `20` — y no la confianza en acordarse. Corolario general: **la lección que solo vive en prosa se incumple primero por quien la escribió**; si la regla importa, o se mecaniza o se verifica a mano en cada cierre. Ver `99 §71`. · **Segunda cicatriz (2026-09-23, `99 §86`)**: tres semanas después el mapa volvió a pudrirse sobre el MISMO módulo —`20` citaba ADRs de cuatro cierres atrás y no nombraba dos archivos creados el día anterior— y los identificadores de otro cerebro reaparecieron en el kernel porque **el gate #5 solo recorre `docs/`**. Queda probado en dos auditorías seguidas: cuando un hallazgo REINCIDE, el arreglo NO es repetir la doctrina sino **mover la vigilancia a un gate determinista**, o declarar por escrito que se acepta [HONOR].

### M-07 · Un candado que frena DOCUMENTAR y no PUBLICAR produce cierres a medias (reincidente B-03 → `§109` C-03)
**Cicatriz**: con la auditoría vencida el pre-commit bloqueaba el cerebro, pero el código se fusionó tres veces a `main`: los ADR de
`§104`-`§108` vivieron dos días solo en el árbol de trabajo, y la cola de Fichas quedó 15 ADRs atrás (B-05 → R3-01). · **Regla**:
el cierre de una tarea incluye el commit del cerebro; si un gate lo bloquea, se resuelve el gate en ese MISMO cierre (auditoría,
poda sin pérdida) antes de publicar lo siguiente. El rediseño del candado (avisar al publicar con ADRs sin commitear) → KERNEL, TODO-67. [HONOR]

> Pendiente universal: no confiar en `origin/*` sin `git fetch`. Lección→doctrina: promover a `CLAUDE.md §3`. Tope ~350 líneas: shard (ej. `31-LECCIONES-GIT.md`) registrada en §0/`00-INDICE`, puntero madre→hija.

## ⚡ Pruebas Eléctricas: dominio, tablero y previews fieles → hija `34`

> **Lo aprendido construyendo el tablero de Pruebas Eléctricas** vive en
> [`34-LECCIONES-PRUEBAS-ELECTRICAS.md`](34-LECCIONES-PRUEBAS-ELECTRICAS.md) (§G.5, 2026-09-30, `99 §120`):
> el veredicto sale del VALOR contra la NORMA, un chip por norma, preview FIEL antes de cablear UI
> sensible, mocks sin cruzar de dominio, retirar lo MÍNIMO señalado y reusar el componente que ya
> produce «X». Léela ANTES de tocar el tablero, sus paneles o un veredicto.
> IDs (para ubicarlas; la definición vive en la hija): L-34, L-36, L-37, L-39…L-42, L-49…L-58, L-73.

## 🖼️ Rescates tardíos del monolito previo (minería 2026-07-18, ADR-051)

### L-59 · Fotos del Ingeniero: HEIC no renderiza en Chrome/Firefox y `cover` estira el padding blanco
**Cicatriz**: HEIC solo lo pinta Safari (background-image roto en Chrome/Firefox); `background-size:cover` estiró el padding blanco interno de una foto a todo el viewport. · **Regla**: convertir SIEMPRE a JPEG/WebP (`sips -s format jpeg`) y recortar el padding interno ANTES de usar; probar en Chrome. (Origen: `_legacy/CLAUDE-previo.md §9.5`.)

### L-60 · "Todo sigue igual" tras un deploy → triage con `curl` del asset, no adivinar
**Regla**: `curl` directo al asset en producción (`https://powertransformersmj.github.io/assets/…`) para separar "no desplegado" vs "cache del navegador" ANTES de tocar código; la PWA vieja causaba esto (por eso `sw.js` es kill-switch). (Origen: `_legacy/CLAUDE-previo.md §9.7`.)

### L-61 · Glosario del Ingeniero + invariante visual AQUA
**Regla**: "tal cual" = SIN overlays/velos/scrims sobre la foto (retirar cualquier veil existente); `.aqua-power-scene` (aqua-components.css) cubre SIEMPRE el viewport completo (`position:fixed; inset:0`). Ante ambigüedad visual → preview fiel (L-56) + preguntar. (Origen: `_legacy/CLAUDE-previo.md §9.5/§9.7/§0.1.2`.)

## 🧭 Verificación, despliegue y honestidad del dato → hija `32`

> **Todo lo de "lo declarado ≠ lo que hay en producción" y "un dato sin rótulo miente" vive en**
> [`32-LECCIONES-VERIFICACION.md`](32-LECCIONES-VERIFICACION.md) (§G.5): verificar el EFECTO y no el
> workflow, preguntarle al servidor, medir un port por su CSS,
> auditar en paralelo por dimensiones, rotular el dato de demostración. Léela ANTES de declarar algo
> desplegado, portado o auditado. La hija lleva su propio listado — aquí no se duplican sus IDs.

### L-96 · Un trigger que reemplaza un objeto entero borra lo que otro camino escribió

`onMuestraCreate` hacía `update({ salud_actual: snapshotDelMotor })`. Correcto cuando el motor era el único
que escribía ahí; destructivo desde que el importador del Excel pasó a fijar la condición oficial en ese
MISMO objeto (`99 §80`). El dominio estaba bien, el importador estaba bien, y aun así el dato se perdía:
el defecto solo existe en la COSTURA entre los dos caminos.

**La regla**: cuando dos caminos escriben el mismo sub-objeto, ninguno lo reemplaza entero — se actualiza
por campos o se fusiona con una función pura que declare quién manda sobre cada campo (y que la procedencia
quede guardada, no deducida). Y eso se prueba donde vive el defecto: una prueba del dominio no lo ve; hace
falta una de integración que ejecute el trigger de verdad (emulador de Functions, `npm run test:trigger`).

### L-113 · Datos rotulados por el FIN de la hora: el mes es lo que el origen rotula en él, y los agregados compartidos solo crecen

`99 §122`: la lista resumía las 744 horas que el SCADA rotula en agosto (la primera, 00:00 del día 1, es el promedio
de 23:00 a 00:00 del 31 de julio) y el detalle pedía «agosto» como [1-ago 00:00, 1-sep 00:00): una hora corrida, el
mes siguiente leído de más y una cifra distinta para el «mismo» mes. Y el catálogo y el resumen se escribían con la
foto tomada al simular: dos cargas a la vez se borraban meses entre sí (probado en el emulador). **Regla**: (1) la
ventana de un periodo se define UNA vez, con la convención del origen, y la usan TODAS las vistas (`ventanaDeMes`);
mostrar las horas como las rotula el origen; (2) un documento que agrega lo de varios escritores se funde DENTRO de una
transacción con lo guardado en ese instante, y la regla exige que no encoja (`keys().hasAll(resource…keys())`); antes de
escribir lo derivado de una simulación, comprobar que nadie escribió entre medias. **Gate**: pruebas de `ventanaDeMes`
y `fundirCatalogo` + regla con casos de encoger negados (`tests-rules/scada_carga.rules.test.js`).

### L-114 · Un `<a>` con forma de botón hereda el color de enlace del sitio: el estado vacío también se mira en producción

`99 §122.9`: el Ingeniero abrió «Cargabilidad SCADA» y «no se aprecia nada». La página estaba bien (no hay datos aún),
pero su único botón, `<a class="btn btn--primary">`, salía azul sobre azul: `body.aqua a` (0,1,2) le gana a `.btn`
(0,1,0). Y lo elegido con fondo translúcido (`rgba(…,.12)`) se pierde sobre la foto de fondo del shell. En el banco
se había probado el camino CON datos; el estado vacío —lo PRIMERO que ve el dueño— nunca se miró de cerca. **Regla**:
(1) un enlace que luce como botón fija su color dentro del alcance del módulo (`.cscada a.btn`); (2) lo seleccionado y
los paneles de lectura van con fondo sólido o casi sólido sobre la foto; (3) la pantalla vacía dice QUÉ falta y quién lo
hace, paso por paso, y se valida en vivo igual que la llena. [HONOR]
**Y `§126.9`**: antes de dar un nombre de clase CSS nuevo, buscarlo en la hoja del módulo — `.cs-filtros` ya era la barra de la lista
y la regla nueva la cambió de cuadrícula a fila libre sin que nadie mirara la lista. Al tocar el CSS de un módulo se revisan
TODAS sus pantallas, no solo la del cambio. [HONOR]


### L-115 · Una ventana fija dentro de un iframe estirado no se ve donde está el usuario: se prueba por CADA entrada

`99 §123`: el detalle de la tabla de Cargabilidad se arregló, pasó pruebas y banco con la página DIRECTA… y dentro de
la pestaña de Seguimiento Operativo (iframe que la madre estira a todo su alto) se habría seguido viendo «no abre»: el
fondo `position:fixed` cubre el iframe entero y la ventana se pintaba en su tope, 886 px fuera de la pantalla. En
producción, además, la barra de pestañas fija tapaba la X. `scrollIntoView` no sirve (no desplaza la madre por un
elemento fijo). **Regla**: (1) una pantalla que vive en más de una entrada (directa e iframe) se valida en TODAS, con
el usuario donde de verdad hace clic (abajo, en la tabla); (2) dentro de un iframe, lo «visible» se mide desde la madre
(`frameElement` + `elementFromPoint`, con una franja libre, no un píxel) y nunca se supone qué barras fijas tiene;
(3) al cambiar la FORMA de una fila, recorrer todos sus consumidores en el camino vivo (el detalle llevaba roto desde
julio porque nadie abrió la ventana). **Gate**: pruebas de `cargabilidad_detalle` + [HONOR] para las entradas.


### L-116 · Retirar una exportación también choca con la caché: el importador VIEJO la sigue pidiendo

`99 §124`: la ventana de Cargabilidad dejó de usar ocho exportaciones (la curva de ejemplo, el vocabulario viejo del
diagnóstico). Borrarlas en la misma publicación habría tumbado la página a quien tuviera en caché el `modal-detalle.js`
anterior (`max-age=600`): su `import { DIAG_MAP }` falla y el módulo entero no carga — el espejo de L-102. **Regla**:
(1) lo que un módulo deja de importar se CONSERVA en esa publicación, con una nota «compat de caché» y su motivo;
(2) se retira en una publicación POSTERIOR, pasados ≥ 10 min del despliegue; (3) antes de retirarlo, grep en todo el
repo (assets, pages, admin, tests, _dev, functions, scripts, api) de que nadie más lo usa. **Gate** [HONOR] (TODO-57 es
el arreglo de fondo: versionar los assets).

### L-117 · Datos grandes por la extensión: un paquete que alimenta el MISMO lector, y su equivalencia probada con datos reales

`99 §125`: la extensión de Chrome sube ≤ 10 MB por llamada y solo de carpetas permitidas (Downloads sí, Documents no),
no suelta archivos dentro de Chrome y un clic por coordenadas no llega a una pestaña que no está al frente; un mes del
SCADA pesa ~650 MB. **Regla**: (1) no se escribe un camino paralelo: se adelgaza el insumo (solo lo que el lector usa,
marcas con el tamaño original) y se entrega al MISMO lector; (2) antes de producción se prueba la EQUIVALENCIA con los
datos reales (lo que se escribiría, byte a byte) más un control negativo que el sistema debe frenar; (3) partes ≤ 9 MiB
con su huella en el nombre, comprobada al juntar; (4) los paquetes llevan datos reales: salida prohibida dentro del
repo y su extensión en `.gitignore`; (5) en la pestaña: `element.click()` por JS y sondeos cortos (la evaluación corta a
los 45 s). **Gate**: `tests/scada_carga_paquete.test.js` (formato, filtro = lector, empaquetador de punta a punta).
**Y en `§126`** (paquete con máx/mín, 6–8 partes por mes): el límite de 10 MB de la extensión se cuenta por LLAMADA y
también por `browser_batch` (suma las subidas del lote): una parte por llamada; un campo auxiliar FIJO que reenvía al de
la página evita volver a buscar el campo que la página repinta; en paralelo alguna subida «no responde a tiempo» aunque
SÍ llega: se confirma con un contador en la página, no con la respuesta de la herramienta.

## 🔐 Seguridad, reglas y datos personales → hija `35`

> **Reglas de Firestore/Storage, cédulas, firmas ajenas y saneado de datos** viven en
> [`35-LECCIONES-SEGURIDAD.md`](35-LECCIONES-SEGURIDAD.md) (§G.5, 2026-09-30, `99 §120`; salieron de `32` y
> de aquí): lo que la regla EJECUTA es lo que manda, desplegar solo compila, se prueba a carga máxima y
> contra la CLASE, y sanear por la forma deja el texto libre. Léela ANTES de tocar `firestore.rules`,
> `storage.rules`, datos personales o firmas de otros.
