# 📚 99 — HISTORIAL DE DECISIONES (ADRs · Largo Plazo)

> **Nodo neuronal: Largo Plazo (ADRs cerrados).** El "por qué" detrás de cada
> decisión funcional del proyecto, en orden cronológico de cierre.
>
> **Cómo leerlo (regla de oro `CLAUDE.md §0`)**: NUNCA leer entero. Usar siempre
> `Read offset=<línea> limit=~150` con la línea sacada de `docs/00-INDICE.md`.
> Si crece >50k líneas, shardar en `99a/99b` por rango de §.
>
> **Cómo crece (`CLAUDE.md §G.3`)**: cada vez que una tarea se cierra por completo:
> 1. apender un `## NN. ADR-NNN — <título>` al final de este archivo (formato §2 de `CLAUDE.md`),
> 2. agregar la fila `| §NN | <tema> | <línea> |` en `docs/00-INDICE.md`,
> 3. marcar el `TODO-NN` correspondiente como ✅ con link al § en `10-CORTO-PLAZO`.
>
> El linter `brain:check` valida que cada `## NN.` aquí tenga fila en el índice
> y que las refs `L-NN`/`M-NN` usadas estén definidas en `30-LECCIONES`.

---

## 1. ADR-001 — Instalación del cerebro neuronal documental sobre SGM·TRANSPOWER

> Pedido del director (2026-06-04): *"Revisa INSTALACION.md y ejecuta las 7 fases
> para instalarlo, adaptándolo a este proyecto. No declares instalado hasta que
> brain-check salga SANO y el barrido anti-vacíos esté limpio."*

**1.1 Causa raíz / motivación** — El `CLAUDE.md` previo era un monolito de 3081 líneas que se auto-cargaba entero en cada sesión → saturación de contexto y memoria no curada. Se adopta el modelo neuronal (router liviano + neuronas on-demand) para acotar la auto-carga a `CLAUDE.md` + `05` + `10`.

**1.2 Solución estructural** — Trasplante del template (v1.0.0) adaptado con datos REALES del proyecto: router `CLAUDE.md` (230 líneas) + 8 neuronas (`00,05,10,15,20,30,40,99`) + manual `INSTALACION-CEREBRO.md` + catálogo `skills-inventory.md` + tooling (`scripts/brain-check.mjs`, `githooks/pre-commit`, `skills/`). Las 18 lecciones `L-01..L-18` y el `§1` se cosecharon del código y del legacy real. `§4` cache/SW se omitió a propósito (`sw.js` es kill-switch, sin PWA activa).

**1.3 No-regresión** — El monolito previo se CUARENTENÓ intacto en `_legacy/CLAUDE-previo.md` (no se borró, límite de guardián). Ningún archivo de producto del proyecto fue tocado. `package.json` solo SUMÓ el script `brain:check`.

**1.4 Tests / verificación** — `node scripts/brain-check.mjs` → ✅ CEREBRO SANO (EXIT=0): cero huérfanos, capacidades bajo tope, refs `L-/M-` (18/18) resueltas, 11 hojas referenciadas existen. Barrido anti-vacíos (grep de placeholders) limpio. Frescura `05` ↔ git real (`main`, `e372c6c` PR #92) verificada. 15 hojas técnicas pre-existentes confirmadas como referenciadas (sin huérfanas).

**1.5 Anti-patterns evitados** — No se borró conocimiento histórico (cuarentena > delete, `L-18`). No se declaró "instalado" antes de cumplir los dos criterios duros. No se versionó nada como plantilla vacía (anti-fragmentación §G.4).

**1.6 Archivos** — *Nuevos*: `_legacy/`, `docs/{00,05,10,15,20,30,40,99}*.md`, `docs/INSTALACION-CEREBRO.md`, `docs/skills-inventory.md`, `githooks/`, `scripts/brain-check.mjs`, `skills/`. *Modificados*: `CLAUDE.md` (monolito → router), `package.json` (+script). *INTACTOS*: todo `assets/`, `pages/`, `admin/`, `functions/`, `firestore.*`, `storage.rules`.

**1.7 Doctrina aplicada + secuela** — Reflejo de Cierre + Auto-auditoría (§G.4). Secuela: bug `M-01` detectado y corregido en la auditoría post-instalación (`brain-check.mjs` usaba `2>NUL` de Windows → ensuciaba la raíz con archivo `NUL`; corregido a `2>/dev/null`). `TODO-03` detectado stale (PDFs ya borrados por `18a25c6`) → marcado resuelto. Sin cache bump (no aplica §4).

---

## 2. ADR-002 — Activación local de 24 skills repo-only en `.claude/skills/`

> Pedido del director (2026-06-04): *"En el repo hay muchísimas skills cargadas,
> algunas ya están en mi interfaz y otras no. Revísate, dime cuáles están y cuáles
> no… ¿puedes auto-instalarlas tú o me toca manual?… TODAS… commitea para reiniciar."*

**2.1 Causa raíz / motivación** — `skills/` del repo (74 carpetas, 83 `SKILL.md` únicos) **NO es la fuente** de las skills que Claude carga en sesión (esas vienen del bundle `anthropic-skills:*` del entorno + plugins de `~/.claude`). Auditoría de solape: **56** skills del repo ya tenían contraparte instalada; **24** eran **repo-only** (invocarlas vía `Skill` habría fallado). El director las quería todas usables.

**2.2 Solución estructural** — Staging local: copiar las 24 carpetas repo-only a `.claude/skills/<name>/` (ruta que Claude Code escanea al **arrancar**). Cada carpeta destino se nombró con el **`name` real del frontmatter** (no el nombre de la carpeta fuente — ej. `taste-skill-main/brutalist-skill` → `industrial-brutalist-ui`). El bundle `taste-skill-main` se desglosó en sus 13 sub-skills (cada una tiene su propio `SKILL.md`). Excluidas correctamente: `code-modernization` (plugin) y `code-simplifier` (subagente) — no tienen `SKILL.md`, no cargan como skill (ya existe el built-in `simplify`).

**2.3 No-regresión** — Operación 100% aditiva: nada de `skills/` ni de producto fue tocado. Las 56 ya-instaladas NO se re-copiaron (evita colisión de `name` con el bundle `anthropic-skills:*`). Verificación post-reinicio: `Skill crm-architect` ejecutó OK → las 24 cargaron.

**2.4 Tests / verificación** — `find .claude/skills -name SKILL.md` → 24, todas con `name`+`description` válidos (linter ad-hoc: 0 problemas). Tras reinicio del director: 24 carpetas intactas en disco + invocación real de `crm-architect` exitosa.

**2.5 Anti-patterns evitados** — No force-add contra `.gitignore` (ver 2.7). No re-stagear las 56 ya disponibles (ruido + colisión). No copiar la raíz `taste-skill-main` como una sola skill (habría ocultado 13). No inventar nombres de carpeta (se usó el `name` del frontmatter, garantiza match con el id que Claude Code resuelve).

**2.6 Archivos** — *Nuevos (NO versionados, ver 2.7)*: `.claude/skills/{24 carpetas}`. *Modificados*: `docs/skills-inventory.md` (estado real), `docs/{00,10,30,99}` (consolidación). *INTACTOS*: `skills/` (fuente), todo `assets/`/`pages/`/`admin/`/`functions/`.

**2.7 Doctrina aplicada + nota de wiring** — Reflejo de Captura + Frescura (§G.4). **`.claude/` está gitignorado a propósito** (`.gitignore:22` — "memoria local, nunca al repo"), por eso las 24 skills son **local-only**: si se re-clona el repo hay que re-correr el copy (la fuente vive en `skills/`, que SÍ está tracked). Receta reusable extraída → `L-19` en `30-LECCIONES`. La activación exige **reiniciar Claude Code** (escaneo de skills es solo en boot; no hay carga en caliente). Sin cache bump (no aplica §4).

---

## 3. ADR-003 — Extracción de informes de Pruebas Eléctricas con IA (Claude) vía Cloud Function

> Pedido del director (2026-06-04): *"Montar un LLM (Opus + Sonnet) que analice
> los PDF de pruebas eléctricas que sube el admin —sin formato estandarizado— y
> los lleve al tablero bien organizados, independientemente del PDF. Ya cargué
> créditos en platform.claude.com."* (Trigger 🛰️ Decisión Fuerte + Skill `claude-api`.)

**3.1 Causa raíz / motivación** — El extractor `assets/js/domain/pruebas_electricas_extraccion.js` es regex/heurístico rígido: solo acierta en PDFs con layout ideal y deja `null` en informes de otros laboratorios (política conservadora correcta, pero cobertura pobre). El schema y los calificadores normativos (`pruebas_electricas_schema.js`) ya son exhaustivos y testeados — lo único que faltaba era una extracción agnóstica al formato.

**3.2 Solución estructural** — Cloud Function v2 `onCall` **`extraerPruebasElectricasIA`** (región `southamerica-east1`, secret `LLM_API_KEY`): recibe `{storagePath, filename, modelId}`, **descarga el PDF nativo desde Storage server-side** (el cliente ya lo subió con `subirPDF` antes de extraer → evita el límite de payload del callable y deja que Claude *vea* tablas/escaneos), y lo envía a Claude con **(a) documento PDF nativo**, **(b) tool use forzado** (`registrar_pruebas_electricas`, cuyo `input_schema` espeja la "bolsa de mediciones" de `sanitizarInforme`), **(c) prompt caching** en el system prompt (pericia de dominio de las 7 familias). La función NO califica ni sanitiza: devuelve el `tool_use.input` crudo; el cliente sigue llamando `sanitizarInforme` + `crearInforme` igual que antes (un solo punto de verdad para el semáforo). Cascada de modelos: `claude-sonnet-4-6` por defecto, `claude-opus-4-7` escalación, `claude-haiku-4-5` económico. Fallback en capas: **IA → extractor regex local → editor manual** (ya existente). Selector de modelo + toggle "Usar IA" en el paso 3 del modal de carga.

**3.3 No-regresión** — `pruebas_electricas_schema.js` y `_extraccion.js` quedaron **INTACTOS** (el extractor regex vive como fallback, no es código muerto). El cambio en `storeReport` es aditivo (branch IA con `try/catch` → fallback). Suite completa `node --test tests/pruebas_electricas_*.test.js` = **112/112 verde**; nuevo test de contrato `tests/pruebas_electricas_ia.test.js` (10/10) fija que el `tool_use.input` de Claude pase por `sanitizarInforme` y derive los calificadores correctos.

**3.4 Tests / verificación** — `node --check` en los 4 archivos cliente + `functions/index.js` OK. Tests de dominio verdes. Pendiente: prueba E2E con un PDF real (requiere deploy + secret; ver TODO-04). Modelos verificados contra la skill `claude-api` (IDs correctos: `claude-sonnet-4-6`/`claude-opus-4-7`/`claude-haiku-4-5` — los que propuso Antigravity, `claude-4-8-opus`/`claude-4-6-sonnet`/`claude-3-5-sonnet-20241022`, eran inválidos y habrían dado 404/400).

**3.5 Anti-patterns evitados** — No se mandó texto pre-extraído (perdería estructura de tablas; se usa PDF nativo). No se expuso la API key al cliente (vive en `LLM_API_KEY` secret, server-side). No `$ref/$defs` en el tool schema (inline `FASE_SCHEMA`, robusto en tool use no-estricto). No se duplicó la sanitización (la función es "thin", el cliente sigue siendo el único que sanitiza/persiste). Sin renombrar IDs/funciones existentes (§3.2 estable).

**3.6 Archivos** — *Modificados*: `functions/index.js` (+`extraerPruebasElectricasIA` + imports), `functions/package.json` (+`@anthropic-ai/sdk ^0.100.0`), `assets/js/firebase-init.js` (+`getFunctionsSafe`), `assets/js/data/pruebas_electricas.js` (+`extraerConIA`), `assets/js/pruebas-electricas-shell.js` (import + `UP.modelId/usarIA` + selector + branch IA). *Nuevo*: `tests/pruebas_electricas_ia.test.js`. *INTACTOS*: `pruebas_electricas_schema.js`, `pruebas_electricas_extraccion.js`, UI (`semaforo.js`, `grafico-svg.js`, `tabla-pruebas.js`).

**3.7 Doctrina aplicada + secuela** — Trigger 🔵 (Skill `claude-api` consultada: PDF nativo + tool use + prompt caching + IDs de modelo) + Trigger 🛰️ (decisión fuerte; NO se sometió a consejo externo — el director confirmó la arquitectura directamente). **⚠ Requiere deploy del director** (canal `functions` + secret, ver TODO-04 en `10` y flag en `05`). Sin cache bump del front (no aplica §4; el SW es kill-switch). Lecciones reusables → `L-20`/`L-21` en `30`.

---

## 4. ADR-004 — Pruebas Eléctricas: extracción IA robusta + identidad + tablero detallado

> Iteraciones del director (2026-06-04 → 06): *"que el LLM lleve cualquier PDF al tablero completo… aún hay errores, no muestra toda la información… la plataforma está limitada para que la inteligencia de la IA se desenvuelva."*

**4.1 Causa raíz** — Tres limitaciones, NO la capacidad del modelo: (a) la identidad de la unidad no se extraía (el tool solo sacaba el informe, no la placa); (b) **la extracción se "conformaba"** en informes densos (22 págs, 17 TAPs): salía solo tan δ — causa real = `tool_choice` FORZADO desactiva el thinking, el modelo debe emitir el JSON de un golpe sin razonar (L-26); (c) **el tablero descartaba el detalle** que el schema sí guarda: `renderTablaResumen` mostraba solo `Año|valor|calif`, tirando fases/terminales/TAP/bujes.

**4.2 Solución** — (a) Tool + system prompt ganan objeto `unidad` (lee placa); el shell hace `guardarUnidad(merge)`. (b) Llamada a Claude: `tool_choice:'auto'` + `thinking:adaptive` + `effort:high` (Opus 4.7/Sonnet 4.6) + **streaming** → el modelo recorre todo el PDF razonando y luego emite todo; prompt de recorrido completo + valor representativo/peor-caso por TAP. (c) Renderizadores **detallados** (`tabla-pruebas.js`): excitación por fase A/B/C+terminal+TAP+Δ; relación por par; resistencia por devanado+fases+verificar; aislamiento por par/tierra; collar por buje individual. (d) Gráficas: eje Y dinámico `ejeMax/ticksY/drawGridY` para que las barras no se salgan (L-23).

**4.3 No-regresión** — Schema (`pruebas_electricas_schema.js`) y extractor regex INTACTOS (fallback). Cambios aditivos. 114/114 tests + nuevo contrato IA↔schema (`tests/pruebas_electricas_ia.test.js`) + helpers de eje testeados en node.

**4.4 Tests / verificación** — `node --test` 114/114; `node --check` en función y cliente; helpers `ejeMax/ticksY` verificados. Pendiente: validación E2E del fix de completitud con 1 PDF real (Sonnet) — ver TODO en `10`. Las tablas detalladas se verifican en el seed 173523 sin gastar créditos.

**4.5 Anti-patterns evitados** — No herramienta forzada para extracción compleja (mata el thinking, L-26); no texto pre-extraído (PDF nativo); no exponer la API key (secret `LLM_API_KEY`); no inventar (representativo/peor-caso). IDs de modelo correctos (`claude-sonnet-4-6`/`claude-opus-4-7`/`claude-haiku-4-5`).

**4.6 Archivos** — `functions/index.js` (tool `unidad`, auto+thinking+streaming, prompt), `functions/package.json` (+@anthropic-ai/sdk), `assets/js/firebase-init.js` (getFunctionsSafe), `assets/js/data/pruebas_electricas.js` (extraerConIA, eliminarUnidad), `assets/js/pruebas-electricas-shell.js`, `assets/js/ui/pruebas/tabla-pruebas.js` (tablas detalladas), `assets/js/ui/pruebas/grafico-svg.js` (eje dinámico), `assets/css/pruebas-electricas.css`. Lecciones L-20..L-26.

**4.7 Doctrina + deploys** — Skill `claude-api` (PDF nativo + tool use + caching + IDs). **Función re-desplegada por Claude** (southamerica-east1, nuevo flujo ADR-005). Front por push del director. Pendiente menor: callout de hallazgo, barras rayadas, lista dinámica de informes.

---

## 5. ADR-005 — Gobernanza: purga de Debug/ del historial + flujo commit/deploy/push

> Director (2026-06-06): *"de ahora en adelante tú haces los commits y deploys, yo los push"* + *"purga el historial de Debug"*.

**5.1 Causa raíz** — (a) La carpeta `Debug/` (19 archivos, 8.8 MB, **PDFs reales de clientes** Afinia/EMS + capturas) estaba versionada en el repo PÚBLICO, incluido el árbol de `origin/main` → exposición de datos. (b) El push del runtime da 403 (L-01); se redefine quién hace qué.

**5.2 Solución** — (a) `Debug/` a `.gitignore` + `git rm --cached`; **purga de historial** con `git-filter-repo --invert-paths --path Debug/` (respaldo en bundle previo); force-push de `main`+`DESARROLLO` por el director. Receta `L-25`. (b) Nuevo flujo: **Claude commitea + deploya** (firebase CLI local), **el director pushea** (GitHub Desktop / terminal). Memoria `feedback_workflow_deploy_commit_push`.

**5.3 No-regresión** — `--cached`/bundle no borran archivos en disco; tras force-push, `origin/main` quedó 0 blobs Debug + con las features (verificado). filter-repo quita `origin` → re-agregado + upstream restaurado.

**5.4 Tests / verificación** — `git rev-list --objects --all|grep Debug` = 0 local y en origin; `origin/main` con `eliminarUnidad`+`ejeMax` y 0 Debug.

**5.5 Anti-patterns evitados** — Claude NUNCA hace force-push a main (lo dispara el director); respaldo antes de reescribir; `--force-with-lease`. NO `git add -A` (archivos específicos).

**5.6 Archivos** — `.gitignore` (+Debug/), historial reescrito. Memoria de flujo + `L-25`.

**5.7 Doctrina + caveat** — Límite de guardián (respaldo > reescribir). GitHub puede cachear commits viejos tras el force-push; datos tratados como ya-expuestos. `CLAUDE.md §1`/`L-01`/`L-09` describen el modelo viejo (director deploya); ahora Claude deploya — pendiente actualizar esa redacción en una pasada futura.

---

## 6. ADR-006 — Tablero flexible "bloques de análisis" (modelo agnóstico + render genérico)

> Director (2026-06-06): *"un tablero capaz de mostrar todo, graficar todo lo que la IA analice… que no tenga límites para plasmar su interpretación… piensa como arquitecto de software (escala, seguridad, costo, mantenibilidad, evolución)."*

**6.1 Causa raíz** — El modelo de datos era una **plantilla rígida** (7 pruebas fijas × 1 escalar). Aunque Claude lea el detalle real (17 posiciones de TAP × fases × pares, capacitancia pF, DAR, bushing), no había DÓNDE ponerlo → la plataforma, no la IA, era el límite. Soportar un formato nuevo exigía tocar código (no escala en mantenibilidad).

**6.2 Decisiones de arquitectura** —
- **Modelo genérico versionado** (`domain/pruebas_electricas_bloques.js`): un informe puede llevar N `bloques`, cada uno = `{prueba, titulo, unidad, eje_x, grafica(linea/barra/dispersion), series:[{nombre,color,puntos:[{x,y}]}], tabla, limite, guia, invertir, calif, observaciones}`. La IA define la estructura; el código no conoce ninguna prueba concreta → **cero código por formato nuevo** (DGA/SFRA/bushing/n-TAP). `schema_version` para migrar.
- **Render genérico** (`ui/pruebas/grafico-generico.js`): dibuja cualquier bloque (línea/barra multi-serie, eje Y dinámico reusando `ejeMax/ticksY`, tooltips, límite/guía) + tabla. Es el motor "sin límites".
- **Desacople de almacenamiento (escala/costo)**: el RESUMEN normativo (matriz/semáforo/lista) sigue en el doc Firestore (liviano, va en el `onSnapshot`). El DETALLE pesado (`bloques`) NO infla el doc → se persiste como **JSON en Storage** (`pruebas_electricas/{unidadId}/{informeId}.bloques.json`), inmutable, cacheable, **cargado perezosamente** al abrir el tablero. Respeta el límite de 1 MiB de Firestore y evita arrastrar MB en cada lectura de la biblioteca.
- **Extraer-una-vez, renderizar-muchas**: Claude (lo caro) corre 1 vez por carga; resultado persistido. Cada vista es lectura gratis.
- **Seguridad/validación desde el diseño**: `sanitizarBloques` es DEFENSIVO y **ACOTADO** (`LIMITES`: 24 bloques, 16 series, 64 puntos, 80 filas, 18 cols, 240 chars) — la salida del LLM es semi-confiable; nunca se persiste sin acotar (protege Firestore/Storage/render de payloads abusivos). Auth ya exigida; secret en Secret Manager.

**6.3 No-regresión / fases** — Aditivo: la matriz/semáforo y las tablas detalladas actuales se conservan; los bloques se SUMAN. **Fase 1 (este ADR, hecha)**: dominio `bloques` + render genérico + tests (125/125). **Fase 2 (pendiente)**: la función emite `bloques` (tool ampliado) + escribe el JSON a Storage; data layer `cargarBloques`/persistencia. **Fase 3 (pendiente)**: sección en la página + carga perezosa; bushing/capacitancia/DAR/tip-up salen "gratis" del modelo genérico.

**6.4 Tests** — `tests/pruebas_electricas_bloques.test.js` (11): forma, acotamiento (caps), robustez ante basura, x numérico (TAP) y etiqueta (par). Suite 125/125. `node --check` en dominio y render.

**6.5 Anti-patterns evitados** — NO sobre-ingeniería: el contexto real es Firebase + sitio estático + equipo pequeño; el cuello de botella es volumen de datos por documento, no usuarios concurrentes → se desacopla detalle/resumen y se acota, sin meter colas/microservicios que no aportan. NO confiar ciego en el LLM (acotar). NO inflar el doc Firestore con el detalle.

**6.6 Archivos** — *Nuevos*: `assets/js/domain/pruebas_electricas_bloques.js`, `assets/js/ui/pruebas/grafico-generico.js`, `tests/pruebas_electricas_bloques.test.js`. *Pendientes (Fase 2/3)*: `functions/index.js` (tool + Storage JSON), `data/pruebas_electricas.js` (cargar/guardar bloques), `pages/pruebas-electricas.html` + shell (sección + lazy load), `storage.rules` (si aplica).

**6.7 Doctrina + evolución** — Decisión Fuerte (Trigger 🛰️) aprobada por el director. **Evolución documentada**: migrar la extracción de `onCall` a **trigger por evento de Storage** (upload PDF → onFinalize → extrae → escribe resumen+JSON → cliente lo ve por `onSnapshot`) para desacoplar carga↔extracción y sobrevivir desconexiones; diseñado, no forzado hoy. Sin cache bump (no aplica §4).

---

## 7. ADR-007 — Subsistema de diagnóstico de extracción + bloques a Firestore (revisión de ADR-006 §6.2)

> Director (2026-06-06): *"tú eres ciego a las interpretaciones que da la api de Claude… diseña algo para almacenar la interpretación del análisis del PDF vs lo que se grafica y lo que yo te muestro… seguimos gastando dinero sin soluciones."*

**7.1 Causa raíz** — Dos fallos descubiertos validando E2E (informe real Applus 22 págs, SIEMENS 266762): (a) **los bloques no se mostraban** — `cargarBloques` leía el JSON de Storage con `getBytes`, pero el bucket `firebasestorage.app` NO tiene CORS para el origen GitHub Pages → el navegador bloquea TODA lectura (la escritura sí pasa). La decisión "Storage JSON" de ADR-006 §6.2 era inviable para lectura desde browser. (b) **Ceguera de observabilidad**: la interpretación cruda de Claude (tool output) era efímera (solo se logueaban tokens) → imposible saber QUÉ interpretó vs qué se graficó → se iteraba a ciegas quemando dinero de API.

**7.2 Decisiones de arquitectura** —
- **Bloques + interpretación cruda a Firestore, NO Storage** (revisa ADR-006 §6.2): subcolección **perezosa** `/pruebas_electricas/{unidadId}/informes/{informeId}/diagnostico/ia`. La suscripción viva consulta la colección `informes`, NO la subcolección → **no infla la matriz** (igual objetivo que ADR-006, pero **sin CORS**: Firestore usa otro transporte). Se lee solo al abrir el análisis (`getDoc`). Riesgo 1 MiB/doc acotado por los `LIMITES` del dominio.
- **Captura cruda server-side (des-ciega a Claude Code)**: la función loguea `[IA-DIAG]` (JSON estructurado: modelo, stop_reason, usage, **resumen de conteos** por prueba/bloque, `mediciones_raw`, `bloques_raw`; cap ~200 KB) a Cloud Logging → legible con `firebase functions:log` SIN re-correr la IA (coste 0). El `resumen` revela de un vistazo si la IA soltó pruebas.
- **Panel admin "Interpretación de la IA"** en el tablero: chips de conteos + tokens + JSON crudo colapsable + "Copiar JSON". El triángulo de comparación: PDF (lo lee Claude Code) ↔ interpretación (`[IA-DIAG]`/export) ↔ render (screenshots del director).

**7.3 No-regresión** — Aditivo salvo el cambio de persistencia (Storage→Firestore): `guardar/cargarBloques` mantienen firma (cargar gana campos `modelo/usage/resumen/mediciones_raw`); `montarBloques` sigue pintando `data.bloques`. Limpieza explícita del doc `diagnostico/ia` en `eliminarInforme`/`eliminarUnidad` (Firestore no cascadea). IDs/funciones exportadas intactos. Informes viejos con JSON en Storage (era DB5) quedan ilegibles por CORS igual → no se migran; si se requiere, re-extraer.

**7.4 Tests / verificación** — `node --test` 997/997 (sin nuevos tests de dominio; la lógica nueva es I/O Firestore + DOM, no unit-testeable sin Firebase, consistente con la capa de datos). `node --check` en función/data/shell. lint HTML OK. Función + `firestore.rules` desplegadas (southamerica-east1). **Pendiente**: 1 corrida E2E para validar el triángulo.

**7.5 Anti-patterns evitados** — NO seguir iterando a ciegas (se construye observabilidad ANTES de la próxima corrida paga). NO configurar CORS del bucket (más superficie/operación) cuando Firestore resuelve lectura sin CORS y co-localiza el diagnóstico. NO inflar el doc del informe (subcolección perezosa). NO confiar ciego en el LLM (se sigue sanitizando con `LIMITES`).

**7.6 Archivos** — *Modificados*: `functions/index.js` (resumen + log `[IA-DIAG]` + return `diagnostico`; antes: timeout 540s/1GiB L-27 + tool `bloques`/`verificar`), `assets/js/data/pruebas_electricas.js` (`guardar/cargarBloques`→Firestore + limpieza), `assets/js/pruebas-electricas-shell.js` (pasa `diag` + `panelDiagnostico` admin), `assets/css/pruebas-electricas.css` (`.pe-diag*`), `firestore.rules` (subcolección `diagnostico`). *Intactos*: dominio `bloques` + render genérico.

**7.7 Doctrina + evolución** — Decisión Fuerte (Trigger 🛰️) aprobada por el director. Lecciones: **L-29** (Storage CORS → Firestore para datos leídos por el browser). **Open follow-up (siguiente sesión)**: con el diagnóstico ya capturando el crudo, atacar la **extracción incompleta** (el informe real solo extrajo tan δ; el resto de pruebas vacías pese a auto+thinking+effort+540s — el `[IA-DIAG]` dirá si es prompt, modelo o token budget). Sin cache bump (no aplica §4).

---

## 8. ADR-008 — Tablero de Pruebas Eléctricas: pipeline de bloques completo + rediseño IA-primaria + render interactivo

> Director (2026-06-06/07): *"un tablero capaz de graficar TODO… ir MÁS ALLÁ del informe — esa es la razón de la IA… te doy libertad de dar forma y magia, acompañada de la interpretación de la API."*

**8.1 Causa raíz** — La plantilla rígida (7 secciones fijas, escalar por prueba, series temporales por año) era el límite y la fuente de errores: con UN informe las curvas salían como puntos solitarios; el render forzaba unidades fijas ("(mΩ)" sobre datos en Ω); el semáforo del collar daba "OK" falso (ver 8.2). El subsistema de diagnóstico (ADR-007) reveló que **la IA (Opus 4.7) extrae EXCELENTE** (9 bloques, curvas de 17 TAPs, bujes, DAR, capacitancias, hasta cazó un error de digitación del laboratorio) → el problema era de **presentación**, no de extracción.

**8.2 Decisiones / cambios** —
- **Pipeline de bloques (completa ADR-006 Fases 2-3 + extras, desplegado)**: la función emite `bloques` (curva COMPLETA por TAP) + `verificar` por punto + `limite_desbalance` por bloque + **análisis crítico OBLIGATORIO** en `observaciones`; el cliente persiste el diagnóstico en Firestore (ADR-007). Render genérico pinta línea/barra multi-serie con eje dinámico, hatch de "verificar", callout de análisis.
- **IA = vista PRIMARIA** (rediseño): se RETIRARON las 7 secciones rígidas; los **bloques son el cuerpo** del informe ("Resultados del informe"). El **scorecard se DERIVA de los bloques** (`renderScorecard`: calif de la IA por familia presente — una sola fuente de verdad, sin "OK" fantasma).
- **Fix raíz collar** (`sanitizarCollar`): `max_mw` quedaba **0** con bujes sin `mw` (informe sin hot-collar) → "OK" falso; ahora `null`→n/d.
- **Render interactivo (lotes)**: (a) **auto-rango del eje Y** en curvas (zoom a [min,max]+pad, no aplastar contra 0); (b) **tabla por-TAP autogenerada** de las series (`tablaDeSeries`: TAP|Fase A|B|C); (c) **filtro por fase** (chips A/B/C que repintan el SVG); (d) **chart de desviación** (`bloqueDesviacion`) con **física por prueba**: excitación = Δ entre las dos fases laterales mayores (la central es menor por geometría del núcleo); relación/resistencia = desviación de CADA fase vs promedio (3 líneas) contra banda ±límite.
- **Encabezado del informe** (ensayo/ejecutante/instrumento/fecha) + **nomenclatura dinámica** (deriva devanados de `tensiones`+`grupo_conexion`, parser `parseGrupo`).
- **UX**: libro demo seed (173523-15510) **retirado** del parque (no se inyecta; exports quedan como fixtures de tests); **estado vacío** del tablero (`#tablero-scope.is-empty`); **pestañas** reordenadas (Biblioteca→Tablero).
- **Evolución multi-año (Etapa 3)**: scorecard condicional — 1 informe → derivado de bloques; >1 → matriz canónica multi-año (columnas por año) + bloques agrupados por año.

**8.3 No-regresión** — Aditivo salvo la retirada de las secciones rígidas (redundantes y con errores). IDs/funciones exportadas intactos; `mountTablas`/`mountCharts` retirados del shell. Dominio `bloques` extendido (`limite_desbalance`) sin romper. `prueba` de la IA NO es estable (tand↔tan_delta) → **aliasear** (L-31).

**8.4 Tests / verificación** — `node --test` 997/997 en cada lote. lint HTML OK. Función re-desplegada (prompt + schema). **Math de desviación verificada contra el informe real** (excitación 3.12%/1.07% = informe 3.0%/1.06%; relación TAP6 fase C −0.80% rompe ±0.5%). Falta validación VISUAL en vivo (re-carga del director).

**8.5 Anti-patterns evitados** — NO forzar datos ricos en casillas rígidas; NO una métrica de desviación genérica ciega (la física difiere por prueba); NO confiar en la estabilidad de las claves del LLM (alias); NO truncar el análisis crítico (cap `observaciones` 240→1200).

**8.6 Archivos** — `pages/pruebas-electricas.html` (retiro secciones, estado vacío, tabs, nomencl dinámica), `assets/js/pruebas-electricas-shell.js` (scorecard derivado, encabezado, nomenclatura, seed off, FAMILIAS_SCORE), `assets/js/ui/pruebas/grafico-generico.js` (auto-rango, tabla series, filtro fase, desviación), `assets/js/domain/pruebas_electricas_bloques.js` (`limite_desbalance`, cap obs 1200), `assets/js/domain/pruebas_electricas_schema.js` (fix collar), `functions/index.js` (prompt: limite_desbalance/IP/análisis), `assets/css/pruebas-electricas.css`.

**8.7 Doctrina + evolución** — "La IA interpreta, no transcribe": el render exprime lo que la API ya da y, donde falta dato (IP = R10min, no presente en este informe), se le pide a la IA. **Iterativo**: con cada informe cargado se afinan extracción y presentación. **Pendiente de validación VISUAL** (re-carga 450108) → la versión guardada tiene cálculos/textos viejos; el scorecard se corrige solo al recargar el sitio. Sin cache bump (no aplica §4).

## 9. ADR-009 — Tablero Pruebas Eléctricas: completitud determinista, workflow de auditoría, tendencia y Biblioteca-hub

> Director (2026-06-07): trabajo POR SECCIÓN comparando el informe real (450108) vs el tablero; *"siempre debes ir más allá"*, *"libertad de decisión"*. Verificado por logs/auditor en cada paso (L-32). **EN PRODUCCIÓN** (PR #128, `main` `7f2b61b`).

**9.1 Causa raíz** — Tras ADR-008 (presentación IA-primaria) faltaba COMPLETITUD y correctitud: las tablas de TAP solo mostraban el valor por fase — la IA emitía las curvas en `series` pero OMITÍA la `tabla` ancha del informe (Potencia W, %DIF, R.Ref, voltajes), verificado en 2 corridas incl. few-shot (L-32/L-33); la desviación de relación se calculaba entre fases cuando el criterio es vs placa (%DIF); aislamiento usaba ≥1 GΩ genérico (laxo para 110 kV); el tab "Informes cargados" mostraba solo la unidad activa (confuso, "no carga todo"); y no había vista de evolución temporal multi-informe.

**9.2 Decisiones / cambios** —
- **Tabla de TAP COMPLETA y DETERMINISTA** (la IA omite la tabla ancha): `derivarTablaTAP()` (dominio puro) arma la tabla desde las `series` + columnas Desviación %/Evaluación DERIVADAS en cliente. La IA solo aporta lo único-del-PDF vía canal **`extra` por punto** (`{x,y,extra:{…}}`). Prompt pivotado a `extra` + few-shot literal + **AUTO-CHEQUEO DE COMPLETITUD universal**. **Canal `extra` VERIFICADO** (auditor sobre JSON-2 = ✅ sin banderas: Potencia/Tensión/Relación teórica/%DIF/R.Ref/DAR ya vienen).
- **Workflow de auditoría por sección** (hoja `workflow-auditoria-secciones-pruebas.md`): `scripts/audit-bloques-pruebas.mjs` flagea curvas sin `extra` / barras sin `tabla` en cualquier informe → detectar→clasificar→validar fórmula→corregir→verificar. Mecanismos GENÉRICOS (no hardcodean columnas) → el tablero sigue DINÁMICO.
- **Excitación**: Potencia (W) graficada (companion `bloquesDeExtra`) + en tabla; desviación entre laterales ÷ la MAYOR (= informe: 3.0%/1.06%).
- **Presentación**: subtítulo por gráfica (`chartCap`: qué muestra + qué evalúa); tabla "Criterios de calificación" dinámica desde `CRITERIOS_NORMA` con columna Fórmula; `bloquesDeExtra` ya NO grafica TODA clave `extra` (duplicados: R.Ref≈R.Medida, %DIF/Tensión redundantes) → solo Potencia (L-34).
- **Relación**: la desviación (gráfica + columna Desv./Eval) usa el **%DIF del informe** (vs placa, criterio ±0.5% IEEE C57.152), no vs promedio. Resistencia sigue vs promedio (criterio "≤5% entre fases").
- **Aislamiento conforme a NETA 100.5** (decisión director): mínimo por CLASE DE TENSIÓN (`NETA_IR_MIN_GOHM`/`minNetaGohm`, redondeo a la clase ≥ kv: 13.8→5, 34.5→15, 110→30 GΩ; `kvAT` parsea la placa); el shell (`conCriterios(data,kv)`) fija el límite del bloque y recalifica "investigar" si el peor valor cae por debajo; el scorecard recibe los bloques enriquecidos → coherente.
- **Tendencia temporal (Fase 1)**: pestaña nueva + `domain/pruebas_electricas_tendencia.js` (`bloquesTendencia`: escalar peor-caso por prueba a lo largo de los informes vs umbral; determinista, reusa el render genérico).
- **Biblioteca = HUB**: se elimina el tab "Informes cargados"; al abrir un libro la Biblioteca despliega "Libro abierto · <serie>" con accesos (Tablero/Tendencia vía `irATab`) + informes con Abrir/Descargar PDF (`#reportlist` reubicado).

**9.3 No-regresión** — Aditivo. `tablaDeSeries` delega en `derivarTablaTAP`; `conCriterios(data,kv)` enriquece sin mutar el cache; `irAlTablero`→`irATab`. Carpeta de referencia `450108/` gitignored (informe de cliente, NO publicar en Pages). Sin renombres de exports.

**9.4 Tests / verificación** — `node --test` 1018/1018 + lint en cada lote. Canal `extra` VERIFICADO por el auditor (JSON-2). Función re-desplegada (prompt extra + few-shot + auto-chequeo). Math: excitación ÷mayor = informe 3.0%; relación = %DIF; NETA 110 kV = 30 GΩ (5–6 GΩ medidos ≪ → pobre, = laboratorio).

**9.5 Anti-patterns evitados** — NO insistir en un canal que el LLM omite 2 veces (re-arquitectura: derivar en cliente + `extra` inline, L-33); NO graficar toda magnitud secundaria (ruido/duplicados, L-34); NO criterio de aislamiento ciego a la tensión; NO confiar en que la IA traiga umbrales normativos (van por dominio).

**9.6 Archivos** — `domain/pruebas_electricas_bloques.js` (`derivarTablaTAP`, `extra`, `devKey`), `domain/pruebas_electricas_schema.js` (`CRITERIOS_NORMA`, `UMBRAL_DESBALANCE`, NETA), `domain/pruebas_electricas_tendencia.js` (nuevo), `ui/pruebas/grafico-generico.js` (`bloquesDeExtra`, `chartCap`, desviación %DIF), `pruebas-electricas-shell.js` (`conCriterios`, `renderTendenciaUI`, biblioteca-hub, `renderCriteriosNorma`), `pages/pruebas-electricas.html`, `assets/css/pruebas-electricas.css`, `functions/index.js` (prompt), `scripts/audit-bloques-pruebas.mjs` (nuevo), hoja `workflow-auditoria-secciones-pruebas.md` (nueva).

**9.7 Doctrina + evolución** — "Lo computable, derívalo en cliente; lo único-del-PDF, pásalo por `extra`; los umbrales normativos, por dominio." **Pendientes (Fases 2-3 de tendencia)**: biblioteca como timeline de informes + narrativa de tendencia por IA. Sin cache bump (no aplica §4).

## 10. ADR-010 — Tendencia F2 + F3: franja-timeline de informes + narrativa de tendencia por IA

> Director (2026-06-07): cerrar el arco de Tendencia pendiente de ADR-009 §9.7. Arrancar por F2 (determinista), luego F3 (IA on-demand, función dedicada + cacheo por unidad). **EN PRODUCCIÓN** (F2 PR #130, F3 PR #131, `main` `75daf29`). ⚠️ Verificación VISUAL en vivo pendiente del director (la UI está gated por Auth+Firestore; Claude no pudo probar en navegador).

**10.1 Causa raíz** — La pestaña Tendencia (ADR-009 F1) graficaba la evolución por métrica, pero (a) el historial de la unidad era una lista plana sin lectura de un vistazo de "cómo va la salud informe a informe", y (b) interpretar las series exigía criterio de ingeniería que el usuario no siempre tiene a mano.

**10.2 Decisiones / cambios** —
- **F2 · franja-timeline (determinista, sin IA)**: `estadoInforme(inf)` + `lineaTiempoInformes(informes)` en `ui/pruebas/semaforo.js` (puras) reusan EXACTAMENTE `calificarPrueba`+`estadoGlobal` → el estado por nodo NUNCA diverge de la matriz. `renderTendenciaUI` pinta `<ol.pe-timeline>` (un nodo/informe, color = peor prueba, último = "vigente") arriba de las gráficas. `estadoVigente` refactorizado para delegar en `estadoInforme`.
- **F3 · narrativa por IA (on-demand, barata)**: Cloud Function dedicada `narrativaTendenciaIA` (onCall, southamerica-east1, sonnet por defecto, 120s/512MiB, sin visión/thinking) que **NO re-lee PDFs** — recibe el resumen numérico ya extraído. Dominio `resumenTendenciaParaIA(informes)` arma el payload compacto desde `bloquesTendencia` ([] si <2 puntos). Capa datos `narrarTendencia(payload)` (httpsCallable, timeout 120s). Shell: botón `#btn-narrar` + `narrativaToHtml` (markdown-lite ANTI-XSS: escapa y reaplica) + **cache por unidad** (`state.narrativaCache`, clave unidad+nº informes → se invalida con informe nuevo). CSS `.pe-narrativa`.

**10.3 No-regresión** — Aditivo. `estadoVigente` conserva su firma/semántica (delega en `estadoInforme`). Sin renombres de exports. El botón se renderiza dinámico (sin HTML estático nuevo). `functions/domain` re-sincronizado por el predeploy (idéntico a `assets/js/domain`).

**10.4 Tests / verificación** — `node --test` **1031/1031** + lint. Nuevos: `tests/pruebas_electricas_timeline.test.js` (9: estadoInforme/estadoVigente/lineaTiempoInformes) + 4 en `pruebas_electricas_tendencia.test.js` (resumenTendenciaParaIA). CF desplegada OK (create operation). ⚠️ Sin verificación de UI en navegador (gated).

**10.5 Anti-patterns evitados** — NO duplicar la lógica de calificación para el timeline (reusar `calificarPrueba` → cero divergencia); NO re-subir el PDF para análisis SECUNDARIO (mandar datos ya extraídos → función barata, L-35); NO innerHTML del texto crudo del modelo (markdown-lite anti-XSS); NO auto-llamar a la IA en cada apertura (on-demand + cache por unidad → costo controlado).

**10.6 Archivos** — `ui/pruebas/semaforo.js` (`estadoInforme`, `lineaTiempoInformes`), `domain/pruebas_electricas_tendencia.js` (`resumenTendenciaParaIA`), `data/pruebas_electricas.js` (`narrarTendencia`), `pruebas-electricas-shell.js` (`timelineHtml`, `narrativaSectionHtml`, `onGenerarNarrativa`, `state.narrativaCache`), `functions/index.js` (`narrativaTendenciaIA` + `SYSTEM_NARRATIVA_TENDENCIA`), `assets/css/pruebas-electricas.css` (`.pe-timeline`/`.pe-tl-*`/`.pe-narrativa`), tests nuevos.

**10.7 Doctrina + evolución** — "Extracción (PDF→datos) es cara y se hace una vez; razonar SOBRE datos (datos→prosa) es barato y on-demand: nunca re-subas la fuente cruda para lo segundo" (L-35). Cierra el arco Tendencia F1-F3. Sin cache bump (no aplica §4). Próximo: confirmación visual del director + seguir validando secciones con informes reales.

## 11. ADR-011 — Veredicto 100% NORMATIVO (scorecard derivado de valores vs norma, no del informe) + NETA por clase unificada + desviación general de resistencia

> Director (2026-06-07): *"todo lo que es normativo, criterios de evaluación o aceptación TODOS deben ser basados en normas; independientemente de la calificación que tengan los informes, tú debes evaluar/calificar con base a las normas"*. Además: en resistencia de devanados, *"anexa una gráfica donde se aprecie la desviación general y el criterio"*. Confirmación visual aportada (PDF del tablero en vivo) + extracción real JSON-3 (450108). **EN PRODUCCIÓN tras push (PR ⧖).**

**11.1 Causa raíz** — El scorecard "Calificación global por prueba" (`renderScorecard`) mapeaba la **calificación TEXTUAL de la IA** (`b.calif` → `estadoDeCalif`) al semáforo → mostraba "Satisfactorio" porque el informe lo decía, NO porque el valor cumpliera la norma. Esto contradecía la doctrina (L-31) y producía una **inconsistencia visible**: el KPI "estado vigente" (que SÍ deriva de `calificarPrueba`) decía "fuera de norma" (relación 1.26% > ±0.5%) mientras el scorecard de al lado decía "Satisfactorio". Además, la recalificación de aislamiento por clase NETA vivía SOLO en el shell (`conCriterios` sobre bloques), no en el dominio `calificarPrueba` → matriz multi-año y KPI usaban el genérico ≥1 GΩ (5–6 GΩ a 110 kV pasaban como verde, cuando NETA exige ~30 GΩ).

**11.2 Decisiones / cambios** —
- **Scorecard NORMATIVO**: `renderScorecard` ya NO lee `b.calif`. Deriva cada familia con `calificarPrueba(key, inf, {minNeta})` (mediciones canónicas vs umbral del dominio); bujes (C1) desde el peor tan δ medido del bloque (`estadoBushing` → `calificarTanDelta`). Columna muestra el **veredicto normativo** (`estado.etiqueta`) + valor medido + **criterio con norma citada**. Nota al pie: "calificación DERIVADA de los valores medidos vs los criterios normativos — independiente de la calificación del laboratorio". Eliminado `estadoDeCalif` (código muerto).
- **NETA por clase UNIFICADA en el dominio**: `calificarPrueba`/`estadoInforme`/`estadoVigente`/`lineaTiempoInformes`/`renderMatriz` aceptan `opts.minNeta`; el aislamiento se califica contra el mínimo NETA 100.5 de la clase de tensión (no el genérico). El shell pasa `minNetaGohm(kvAT)`. Ahora **scorecard + KPI + matriz + timeline** son coherentes (110 kV → 30 GΩ → 5–6 GΩ = "investigar"). Matriz: criterio de aislamiento dinámico (`≥ {minNeta} GΩ`).
- **Resistencia de devanados — gráfica de DESVIACIÓN GENERAL** (`bloqueDesviacionGeneral`): curva única del desbalance máximo entre fases por TAP `((máx−mín)/prom×100)` contra el criterio `≤ limite_desbalance%` + norma, además de las 3 curvas por fase. Resume de un vistazo la separación entre fases en todo el conmutador.

**11.3 No-regresión** — `opts` es opcional (default `{}`): sin `minNeta` el comportamiento es el genérico previo (tests existentes intactos). `estadoVigente`/`estadoInforme`/`lineaTiempoInformes`/`renderMatriz`/`calificarPrueba` conservan firma (param opcional). Sin renombres de exports. NO se cambió ningún UMBRAL (la divergencia resistencia 2% NETA D.8 vs 5% IEEE queda como decisión del director, ver 11.7).

**11.4 Tests / verificación** — `node --test` **1040/1040** + lint. Nuevos: aislamiento NETA por clase (genérico vs minNeta 30 vs minNeta 5; veredicto del valor, no del texto). Resultado para 450108: tan δ/bujes/excitación/resistencia = dentro de norma; **aislamiento = investigar** (5 GΩ < 30); **relación = fuera de norma** (1.26% en TAP6, marcado `verificar` por la IA). KPI + scorecard ahora consistentes.

**11.5 Anti-patterns evitados** — NO confiar en el "OK"/"Satisfactorio" del laboratorio ni en el texto de la IA para el veredicto (L-31/L-36); NO duplicar la lógica NETA en shell y dominio (se unifica en `calificarPrueba`); NO romper firmas (param opcional, aditivo).

**11.6 Archivos** — `ui/pruebas/semaforo.js` (`calificarPrueba`/`estadoInforme`/`estadoVigente`/`lineaTiempoInformes`/`renderMatriz` con `opts.minNeta`; aislamiento NETA), `pruebas-electricas-shell.js` (`renderScorecard` normativo, `estadoBushing`, threading `minNeta`; eliminado `estadoDeCalif`), `ui/pruebas/grafico-generico.js` (`bloqueDesviacionGeneral` + render en resistencia), `tests/pruebas_electricas_data.test.js`.

**11.7 Doctrina + evolución** — "El veredicto es del VALOR contra la NORMA, nunca de la calificación del informe ni del texto de la IA" (L-36). **⚠️ Decisiones del director pendientes (normativas)**: (1) **resistencia de devanados**: el código usa ≤5% (IEEE 62.2/C57.152) pero **NETA ATS-2025 §7.2.2.D.8 = ≤2%** (vs fábrica o entre fases adyacentes) → confirmar umbral (TODO-08/lobe 49 `verificar`); (2) relación: cuando el peor valor está marcado `verificar` (sospecha de typo, p.ej. TAP6 = 1.26%), hoy el veredicto es "fuera de norma" duro — evaluar si debe degradarse a "verificar" (AMBAR) en vez de ROJO; (3) badges por bloque aún muestran el texto cualitativo de la IA (no el veredicto normativo) — evaluar recomputarlos. Sin cache bump.
