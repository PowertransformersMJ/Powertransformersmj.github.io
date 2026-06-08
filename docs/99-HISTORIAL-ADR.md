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

**11.7 Doctrina + evolución** — "El veredicto es del VALOR contra la NORMA, nunca de la calificación del informe ni del texto de la IA" (L-36). **Decisiones del director RESUELTAS (mismo arco, 2026-06-07)**: (1) **resistencia ≤2%** — apoyado en la skill `pruebas-electricas/resistencia-devanados/03` (precedencia fábrica > MO.00418 `verificar` > **NETA ATS §7.2.2.D.8 = 2%**); fijado en `UMBRAL_DESBALANCE`/`CRITERIOS`/`CRITERIOS_NORMA`/`UMBRALES.resistencia` (5→2) + textos de matriz/scorecard. **`conCriterios` ahora SOBRESCRIBE el `limite_desbalance` de la IA con el de dominio** (la IA emitía 5; el criterio es de dominio, L-36). (2) **relación**: se evalúa con el valor del informe tal cual (1.26% → fuera de norma); NO se degrada por el flag `verificar`. (3) **badges por bloque NORMATIVOS** (`calificarBloque`/`badgeBloque` en grafico-generico): el chip de cada bloque deriva del valor vs la norma (aislamiento=NETA por clase, FP/tan δ/bujes=bandas IEEE 62, collar=mW, curvas=desbalance vs límite), no del texto de la IA; cae al texto solo si no es derivable. `node --test` **1040/1040** (tests de resistencia migrados 5→2%). Sin cache bump.

## 12. ADR-012 — Evaluación MULTI-NORMA (veredicto por cada norma + consolidado + divergencias)

> Director (2026-06-07): *"la skill tiene la capacidad de evaluar/dar criterio según las distintas normas para apalancar la toma de decisiones; NO quiere decir que ANSI/NETA es la definitiva — debe mostrar las distintas calificaciones según cada norma buscando un diagnóstico más preciso"*. Corrige el ADR-011 (que había colapsado a un solo criterio por prueba). Mirror de `skills/pruebas-electricas/_conocimiento/marco-normativo-multinorma.md`. **EN PRODUCCIÓN tras push.**

**12.1 Causa raíz** — ADR-011 hizo el veredicto normativo pero con UNA sola norma por prueba (p.ej. resistencia = solo NETA 2%). Un diagnóstico robusto necesita ver la prueba desde CADA óptica (NETA da pisos numéricos; IEEE C57.152 método+tendencia; MO.00418 por clase; industria sanity; fábrica baseline) y exponer dónde divergen — esa divergencia ES información (caso testigo: 5–6 GΩ a 110 kV PASA el piso NETA 100.5 de 5 GΩ pero FALLA el criterio por clase de 30 GΩ → "pobre", no "sano").

**12.2 Decisiones / cambios** —
- **Motor de dominio `pruebas_electricas_multinorma.js`**: `CRITERIOS_MULTINORMA` (por familia, una óptica por norma con su umbral + evaluador), `evaluarMultiNorma(familia, valor, ctx)` → `{opticas, consolidado, divergen}` (consolidado = el más conservador; divergen = las normas no coinciden), `metricaPrueba(key, inf)` (métrica peor-caso canónica). Funciones puras + tests.
- **Fuente ÚNICA de veredicto**: `calificarPrueba` (UI semáforo) delega al consolidado del motor → scorecard, KPI, matriz y timeline ya consolidan multi-norma (coherentes). DRM conserva su lógica de ventana; resistencia conserva el override `verificar`→ámbar (calidad de dato).
- **Panel "Evaluación multi-norma" por bloque** (`panelMultiNorma` en grafico-generico): una línea por norma (umbral + veredicto), el consolidado y la nota de divergencia. Reemplaza el criterio único; el badge del bloque = consolidado (`metricaBloque`+`evaluarMultiNorma`).
- **Capa de DIAGNÓSTICO / recomendaciones** (`pruebas_electricas_recomendaciones.js`, pedido del director "dejando sugerencias o recomendaciones"): por familia y nivel de veredicto (aprueba/investigar/rechaza/faltante) una sugerencia accionable conforme a `skills/*/04-diagnostico.md` + `_conocimiento/{diagnostico-integrado-bateria,gestion-mantenimiento-predictivo}.md` (correlaciones cruzadas, principio "un hallazgo=investigar; dos convergentes=diagnóstico", urgencia criticidad×severidad, intervalos de re-ensayo). Se muestra como "Recomendación" en el panel de cada bloque (con prefijo de divergencia si aplica). Fallback genérico para familias sin set propio.
- **Efecto normativo**: p.ej. tan δ 0.5135% → NETA 100.3 (≤0.5%) investiga / IEEE 62 (≤0.7) verde → divergen, consolidado "investigar" (más preciso que el único 0.7 previo).

**12.3 No-regresión** — Aditivo: el motor reusa los calificadores del dominio ya probados (calificarTanDelta/Relacion/Resistencia/Excitacion/Collar) donde la óptica coincide; firmas con `opts` opcionales intactas. Tests migrados a la realidad normativa: tan δ 0.5–0.7 = investigar (NETA), aislamiento <5 GΩ = investigar (piso NETA 100.5). `calificarAislamiento` genérico queda disponible (no usado por el flujo principal).

**12.4 Tests / verificación** — `node --test` **1052/1052** + lint. Nuevo `tests/pruebas_electricas_multinorma.test.js` (resistencia NETA 2% vs industria 3% → divergencia; aislamiento testigo 110 kV; tan δ NETA vs IEEE; relación coincide; metricaPrueba). Tests de aislamiento/seed actualizados al piso NETA.

**12.5 Anti-patterns evitados** — NO una sola norma como "la definitiva"; NO un "✔/✘ pelado" (siempre set de ópticas + consolidado + divergencia, marco §4); NO duplicar bandas (reusa calificadores del dominio); el `ctx` no debe filtrarse como 2º arg de un calificador (bug corregido: `calificarResistencia(v, ctx)` interpretaba ctx como flag → envuelto).

**12.6 Archivos** — `domain/pruebas_electricas_multinorma.js` (nuevo: motor), `domain/pruebas_electricas_recomendaciones.js` (nuevo: diagnóstico/sugerencias), `ui/pruebas/semaforo.js` (`calificarPrueba` delega), `ui/pruebas/grafico-generico.js` (`metricaBloque`/`multiNormaBloque`/`panelMultiNorma`+recomendación/`badgeBloque`), `assets/css/pruebas-electricas.css` (`.pe-multinorma`/`.pe-mn-*`/`.mn-*`/`.mn-rec`), `tests/*` (multinorma + recomendaciones nuevos + data/semaforo migrados).

**12.7 Doctrina + evolución** — "Veredicto robusto = el peor de TODAS las normas aplicables + mostrar dónde divergen; ninguna norma es 'la definitiva'" (L-37). Supersede el criterio único de ADR-011. **⚠️ verificar (director)**: umbrales por clase MO.00418 (resistencia, aislamiento, relación), banda C1 de bujes, PI/DAR cuando el informe los traiga. Sin cache bump.

## 13. ADR-013 — FP de bujes canónico (discriminado) + Tendencia de ALTO NIVEL (diagnóstico multi-norma por métrica)

> Director (2026-06-08): el FP del transformador y el de **bujes** no aparecían discriminados al inicio (el de bujes vivía solo en el bloque, sin campo canónico); y *"la tendencia se ve muy básica — usa todo tu potencial para una ilustración de alto nivel con criterios de evaluación y diagnóstico"*. **EN PRODUCCIÓN tras push.**

**13.1 Causa raíz** — (1) El FP de bujes (tan δ C1) lo emite la IA SOLO en el bloque `bushing`, no en las mediciones canónicas → no entraba en la matriz/scorecard multi-año ni en la tendencia (quedaba "no discriminado"). (2) `METRICAS_TENDENCIA` usaba límites HARDCODEADOS y viejos (resistencia 5%, aislamiento 1 GΩ) en vez del motor multi-norma, y la tendencia era solo "línea vs un umbral" — sin veredicto, sin diagnóstico, sin degradación.

**13.2 Decisiones / cambios** —
- **FP de bujes CANÓNICO**: `sanitizarBushing` → campo `bushing:{fp_max_pct, dc1_max_pct}` en `sanitizarInforme`; el shell lo DERIVA al guardar (`derivarBushing` desde el bloque `bushing`: peor tan δ + peor ΔC1 vs placa). Fila `bushing` en la matriz (FILAS) y métrica en `metricaPrueba`/`METRICAS_TENDENCIA` → bujes evaluado por el motor multi-norma como prueba propia, discriminado del transformador.
- **Scorecard del vigente SIEMPRE arriba** (se quitó la restricción `reales<=1`): el top "Calificación global" muestra cada prueba del informe vigente —incluido el FP de bujes (C1) aparte— en vez de la matriz multi-año (la evolución vive en Tendencia).
- **Tendencia de ALTO NIVEL**: `analisisTendencia(informes,{minClase})` (dominio) → por métrica: serie temporal + **veredicto vigente multi-norma** (consolidado) + **recomendación** de diagnóstico + **tendencia** (empeora/mejora/estable) + Δ vs informe previo. UI: panel "Diagnóstico de la unidad" (chips de conteo por veredicto + aviso de métricas que empeoran + por métrica: badge + flecha de tendencia + recomendación plegable). Límites de las gráficas corregidos al criterio real (resistencia 2%); aislamiento por clase vía `conCriterios`. Las gráficas ya heredan el panel multi-norma + recomendación (ADR-012).

**13.3 No-regresión** — `bushing` es aditivo (spread condicional en `sanitizarInforme`; null si no hay bujes). Informes guardados ANTES del fix no tienen `bushing` canónico → la matriz muestra `n/d` esa fila hasta re-cargar; el FP de bujes igual se ve en el bloque del Tablero y en el scorecard del vigente (deriva de bloques). Sin renombres de exports.

**13.4 Tests / verificación** — `node --test` **1063/1063** + lint. Nuevos: `analisisTendencia` (veredicto vigente + tendencia empeora/mejora + bushing como métrica), fixture de tendencia con bushing. ⚠️ Sin verificación de UI en navegador (gated).

**13.5 Anti-patterns evitados** — NO dejar el FP de bujes solo en el bloque (se promueve a canónico para discriminarlo); NO una tendencia "línea contra un número" (se evalúa multi-norma + se diagnostica + se mide degradación); NO límites hardcodeados desalineados del motor.

**13.6 Archivos** — `domain/pruebas_electricas_schema.js` (`sanitizarBushing`+campo), `domain/pruebas_electricas_tendencia.js` (`bushing` en escalar/METRICAS + `analisisTendencia`), `domain/pruebas_electricas_multinorma.js` (`metricaPrueba` bushing), `ui/pruebas/semaforo.js` (fila bushing en FILAS), `pruebas-electricas-shell.js` (`derivarBushing`, scorecard siempre, `diagnosticoUnidadHtml`/`trendMarker`), `assets/css/pruebas-electricas.css` (`.pe-diagnostico`/`.pe-diag-*`), tests.

**13.7 Doctrina + evolución** — "Cada prueba se evalúa Y se diagnostica conforme a la skill; donde no hay veredicto definitivo, se deja una recomendación — y la tendencia (degradación vs baseline) pesa tanto como el valor." Bujes discriminado en todo el flujo. **Re-carga LIMPIA (upsert, L-39)**: `storeReport` detecta si ya existe el MISMO informe por **fecha exacta** (fallback a año) y pregunta (`window.confirm`) **REEMPLAZAR** (borra el anterior + su PDF vía `eliminarInforme`+`eliminarPDF`) o **crear nuevo** — re-cargar 2021/2023 para poblar el `bushing` canónico ya no duplica. Dos ensayos de fechas distintas del mismo año NO colapsan. Sin cache bump.

## 14. ADR-014 — Identidad/placa CONGELADA por informe (trafo móvil de doble configuración)

> Director (2026-06-08): adjuntó las DOS placas de la serie 450108 para aclarar la "inconsistencia" detectada en ADR-013/auditoría. **No era error**: es UN transformador MÓVIL de doble configuración (tipo cKLTM 14511-17, fab. 05/2020): AT en **TRIÁNGULO → 63.509 kV, Dyn1yn1** (Bocagrande 2021) y AT en **ESTRELLA → 110 kV, YNyn0yn0** (Membrillal 2023). Misma unidad, dos placas reales según conexión de la AT. **EN PRODUCCIÓN tras push.**

**14.1 Causa raíz** — La identidad (tensiones/grupo) vivía SOLO en el doc de la unidad (`guardarUnidad`, merge last-wins) → no determinista y, peor, el **aislamiento NETA por CLASE de tensión** usaba el kV de la unidad (última carga) para TODOS los informes. Un trafo móvil con 63.5 kV (clase 69 → 25 GΩ) y 110 kV (clase 115 → 30 GΩ) se evaluaba mal: el ensayo del 2021 contra la clase del 2023 (o viceversa).

**14.2 Decisiones / cambios** —
- **Placa CONGELADA por informe**: `sanitizarIdentidad` (subconjunto PLANO: tensiones, grupo_conexion, potencia, fabricante, año, subestación, ubicación, refrigeración, frecuencia, fases) → campo `identidad` en `sanitizarInforme`. `storeReport` y el **reproceso** lo guardan desde `mediciones.unidad`. Cada ensayo conserva SU placa.
- **Aislamiento por clase del PROPIO informe**: `calificarPrueba` deriva el mínimo NETA de `inf.identidad.tensiones` (`minNetaDe`: placa del informe → `minNetaGohm(kvAT)`); cae a `opts.minNeta` (unidad) si el informe no trae identidad. Así matriz, scorecard, KPI y tendencia evalúan cada informe contra SU clase, automáticamente. Los bloques de detalle usan `kvDeInforme(inf)` (`conCriterios`).
- **Display**: la tira de metadata del informe muestra "Config" (tensiones · grupo) y "Subestación" → se ve a qué configuración corresponde cada ensayo.

**14.3 No-regresión** — `identidad` aditivo (spread condicional; null si no hay). Informes guardados ANTES no tienen identidad → caen al kv de la unidad (comportamiento previo) hasta re-cargar/reprocesar (el reproceso server-side lo puebla sin re-subir). `opts.minNeta` se conserva como fallback. Sin renombres de exports.

**14.4 Tests / verificación** — `node --test` **1073/1073** + lint. Nuevos: aislamiento usa la clase del informe (110 kV→30, 63.5 kV→25; la identidad del informe MANDA sobre `opts.minNeta`); `sanitizarIdentidad`. ⚠️ Sin verificación de UI en navegador (gated).

**14.5 Anti-patterns evitados** — NO una sola identidad por unidad para un activo de doble config (cada informe su placa); NO evaluar por clase con el kV de "la última carga"; NO arrays anidados en `identidad` (subconjunto plano, Firestore-safe, L-30).

**14.6 Archivos** — `domain/pruebas_electricas_schema.js` (`sanitizarIdentidad` + campo `identidad`), `ui/pruebas/semaforo.js` (`minNetaDe`, `calificarPrueba` usa la placa del informe), `pruebas-electricas-shell.js` (`kvDeInforme`, `identidad` en carga/reproceso, `conCriterios` por informe, `encabezadoInforme` muestra Config/Subestación), tests.

**14.7 Doctrina + evolución** — "El activo puede tener varias placas (móvil/reconfigurable): congela la identidad EN cada ensayo y evalúa cada uno contra SU clase — nunca contra la 'última identidad' de la unidad." **Pendiente**: re-cargar/REPROCESAR 2021 y 2023 para poblar su `identidad` (el reproceso server-side ya lo hace). Sin cache bump.

## 15. ADR-015 — "Reprocesar" 100% funcional: reintento con backoff de fallos transitorios de la IA (server-side)

> Director (2026-06-08): "la función reprocesar debe quedar 100% funcional; si se presenta un error o falla que sea por algo **ajeno a la IA o a ti**." Cierra la oferta abierta TODO-09 (la CF había dado un 500 puntual al reprocesar). **CF DESPLEGADA; frontend EN PRODUCCIÓN tras push.**

**15.1 Causa raíz** — La extracción IA (`extraerPruebasElectricasIA`, usada por carga Y reproceso) llamaba `client.messages.stream(params).finalMessage()` envuelto en un único `try/catch` SIN reintento. Cualquier fallo TRANSITORIO de la API de Claude —429 rate-limit, 500 internal, 502/503/504, **529 overloaded**, corte de stream— o que el modelo NO llamara la herramienta (hipo de "conformismo", L-26) se propagaba como `HttpsError('internal')` → "Reprocesar" fallaba aunque el informe fuera perfecto y el PDF legible. Esos hipos son culpa de la IA/infra, no del usuario → debían absorberse, no surfacearse.

**15.2 Decisiones / cambios** —
- **Módulo puro `functions/reintentos.mjs`** (sin Firebase → testeable `node --test`): `esErrorTransitorioIA(e)` clasifica transitorio (status 408/409/425/429/5xx/529, `APIConnectionError/Timeout`, patrones `overloaded/ECONNRESET/socket hang up/…`) vs permanente/externo (401/400/413/403/404 → relanza). `retrasoBackoff(i)` = exponencial + jitter, respeta `Retry-After`, tope `maxMs`. `conReintentosIA(fabricar, {intentos, deadlineMs,…})` reintenta SOLO transitorios, **presupuesto de tiempo** (`deadlineMs`) para no exceder el timeout de la CF, hooks `ahora/dormirFn/onReintento` inyectables.
- **CF cableada**: la llamada IA va dentro de `conReintentosIA` (4 intentos, `deadlineMs = inicioIA + 820000`). Un stream NO se reusa → cada intento abre uno nuevo. **"Sin tool_use" se marca 529** (transitorio) para que el reintento lo absorba. Cliente Anthropic con `maxRetries: 0` (el reintento lo gobierna nuestro helper, no el backoff opaco del SDK).
- **Presupuesto de tiempo coherente**: `timeoutSeconds` de la CF **540→900 s** (margen para ~2 intentos lentos); cliente `httpsCallable` timeout **540000→900000** (`data/pruebas_electricas.js`) + `conTiempoLimite` del reproceso **540000→900000** y mensaje "15 min" (`pruebas-electricas-shell.js`).

**15.3 No-regresión** — `extraerConIA` (data) y el contrato `registrar_pruebas_electricas` intactos; el guard `if(!toolBlock)` posterior se conserva (defensivo). El módulo es aditivo; ningún export renombrado. Reproceso y carga comparten el fix (misma CF). Antes del push del frontend NO hay regresión: CF=900 s pero cliente aún 540 s solo afecta el caso raro >540 s; los transitorios rápidos (429/529 fallan en <5 s) ya se benefician.

**15.4 Tests / verificación** — `node --test` **1087/1087** (+14: `tests/reintentos_ia.test.js` — clasificación transitorio/permanente, backoff/Retry-After/tope, política de reintento, **presupuesto de tiempo** que no inicia un intento sin margen). Lint OK. `node --check` de los 4 archivos OK. **CF desplegada**: `extraerPruebasElectricasIA(southamerica-east1) Successful update`. ⚠️ Sin verificación de UI en navegador (gated admin).

**15.5 Anti-patterns evitados** — NO tragar el error ni reintentar a ciegas (los permanentes/externos se relanzan: §3.3); NO reintentar sin presupuesto (evita exceder el timeout de la CF); NO depender del backoff opaco del SDK (no cubre mid-stream ni "no tool block"); NO reusar un stream consumido; clasificación por status/nombre/patrón, no allowlist frágil de un solo string (L-41).

**15.6 Archivos** — NUEVOS: `functions/reintentos.mjs`, `tests/reintentos_ia.test.js`. MODIFICADOS: `functions/index.js` (import + `maxRetries:0` + `timeoutSeconds:900` + wrap `conReintentosIA`), `assets/js/data/pruebas_electricas.js` (timeout 900000), `assets/js/pruebas-electricas-shell.js` (conTiempoLimite 900000 + msg 15 min). INTACTOS: motor multi-norma, schema, render, narrativa.

**15.7 Doctrina + evolución** — "Toda llamada a IA/red propensa a fallos transitorios se envuelve en reintento con backoff + presupuesto de tiempo: el transitorio se absorbe, el permanente/externo se relanza con mensaje claro. El usuario solo ve un fallo cuando la causa es ajena a la IA y al código." Sin cache bump (SW kill-switch). Lección → L-44. **Posible extensión**: aplicar `conReintentosIA` a `narrativaTendenciaIA` (mismo patrón, hoy sin reintento; no pedido).

## 16. ADR-016 — "Reprocesar" como trabajo asíncrono observable: persistencia server-side + estado durable

> Director (2026-06-08, tras ADR-015): "sigue pasando la misma situación, transcurre el tiempo y **no se aprecia si terminó o hubo problemas**" + "la función reprocesar debe quedar **100% funcional**". El reintento (ADR-015) atacó la confiabilidad pero NO el dolor real: la espera opaca sin estado terminal claro. **CF DESPLEGADA; frontend EN PRODUCCIÓN tras push.**

**16.1 Causa raíz** — El reproceso era una llamada BLOQUEANTE de varios minutos cuya persistencia ocurría en el NAVEGADOR *después* de que la CF respondía: (1) el feedback era un contador `setInterval` que corría independiente del estado real del servidor → no distinguía "trabajando" de "colgado"; (2) si el cliente se desconectaba / recargaba / agotaba el tiempo, el trabajo se PERDÍA y el estado quedaba ambiguo; (3) al fallar, el motivo vivía solo en un toast efímero. Resultado: "no se aprecia si terminó o hubo problemas".

**16.2 Decisiones / cambios** —
- **La CF persiste el reproceso ella misma** (admin SDK), reusando los MISMOS sanitizadores del dominio que el cliente (sin divergencia, L-36): `extraerPruebasElectricasIA` acepta `unidadId`+`informeId` → **modo REPROCESO**: re-extrae, sanitiza (`sanitizarInforme`/`sanitizarBloques`/`derivarBushing`), escribe el doc del informe + subcolección `diagnostico/ia` + enriquece la unidad. Sin `informeId` = **modo CARGA** (devuelve crudo; el cliente persiste con su upsert/confirmación — intacto).
- **Estado DURABLE en el informe** (`reproceso: {estado, inicio|fin, motivo, ts}`): `marcarReproceso` escribe `en_curso` al arrancar, `ok` junto al parche al terminar, `error`+motivo en CADA camino de fallo (PDF/IA/persistencia). La fila lo refleja en vivo (onSnapshot): "⟳ reprocesando… desde HH:MM" → "procesado" / "⚠ reproceso falló (motivo)". **Sobrevive a recargas**; **guard de stale** (`en_curso` > 16 min → "interrumpido", reintentable).
- **Cliente = trigger + observe**: el handler ya no persiste ni corre un contador frágil; dispara la CF y la fila se actualiza sola. El botón se **bloquea** mientras `en_curso` (gating durable, no DOM).
- **Helpers puros al dominio** (sincronizados a la CF por el predeploy): `derivarBushing` (de shell → `pruebas_electricas_bloques.js`), `deepClean` (de `data/_firestore_clean.js` → `domain/firestore_clean.js`, con re-export back-compat). Una sola fuente de verdad cliente↔servidor.

**16.3 No-regresión** — Modo CARGA (subida) INTACTO (sin `informeId` → return crudo, persistencia cliente con upsert/confirm). `extraerConIA` exige `mediciones` solo en modo carga. `deepClean` re-exportado → los 3 importadores del navegador siguen igual. `reproceso` es campo aditivo. Sin renombres de exports. La CF usa admin SDK → bypassa rules (sin cambio de `firestore.rules`).

**16.4 Tests / verificación** — `node --test` **1091/1091** (+4: `derivarBushing` en dominio — peor tan δ, ΔC1 vs placa con alias, placa 0/no-numérica, "buje"/"bushing"). Lint OK. `node --check` de los 8 archivos OK. **CF desplegada**: `Successful update operation` + predeploy sincronizó 54 módulos de dominio (incl. `firestore_clean.js`). ⚠️ Sin verificación de UI en navegador (admin gated) → el director valida el badge en vivo.

**16.5 Anti-patterns evitados** — NO contador de UI desacoplado del estado real (estado durable del servidor); NO persistencia solo-cliente para una op larga (se pierde al recargar); NO replicar la sanitización server-side (reusa el dominio, una sola verdad, L-36/L-43); NO bloquear al usuario (trigger + observe); motivo de error DURABLE, no efímero.

**16.6 Archivos** — NUEVO: `assets/js/domain/firestore_clean.js`. MODIFICADOS: `functions/index.js` (imports dominio + `FieldValue`; `marcarReproceso`/`persistirReproceso`; modo reproceso en la CF), `assets/js/domain/pruebas_electricas_bloques.js` (+`derivarBushing`), `assets/js/data/_firestore_clean.js` (re-export), `assets/js/data/pruebas_electricas.js` (`extraerConIA` pasa `informeId`; ack en modo reproceso), `assets/js/pruebas-electricas-shell.js` (reproceso = trigger+observe; `derivarBushing` del dominio), `assets/js/ui/pruebas/tabla-pruebas.js` (badge de estado de reproceso + gating del botón + guard de stale), `tests/pruebas_electricas_bloques.test.js`. INTACTOS: motor multi-norma, semáforo, render de bloques, narrativa, modo CARGA.

**16.7 Doctrina + evolución** — "Una operación larga (IA/red) no se modela como llamada bloqueante con feedback de UI efímero, sino como **trabajo asíncrono observable**: el servidor PERSISTE el resultado y escribe un ESTADO DURABLE; la UI solo dispara y observa (onSnapshot). Estado terminal claro, sobrevive a recargas, no bloquea, y el motivo de fallo queda registrado." Lección → L-45. Sin cache bump (SW kill-switch). **Nota**: `timeoutSeconds` 900 (margen para reintentos ADR-015); el audit log de `functions:log` se rezaga — re-confirmar con el director si hace falta.

## 17. ADR-017 — Causa raíz del reproceso colgado: timeout INTERNO por intento (el cuelgue de la IA ya no mata la función sin estado)

> Director (2026-06-08, con captura): "**sigue la misma situación, transcurre el tiempo y no se aprecia si terminó o hubo problemas**… encuentra la **verdadera causa raíz**, llevamos mucho tiempo con lo mismo". El badge de ADR-016 funcionaba ("⟳ reprocesando… desde HH:MM") pero **NUNCA pasaba a procesado/error** — quedaba colgado. Tres intentos previos (ADR-015 reintento, timeout 540→900, ADR-016 estado durable) trataron síntomas. **CF DESPLEGADA; frontend EN PRODUCCIÓN tras push.**

**17.1 Causa raíz (verificada en código, no conjetura)** — `functions/reintentos.mjs` hacía `return await fabricar(i)` (la llamada a la IA) **SIN límite de tiempo por intento**; `deadlineMs` solo se revisa en el `catch`, es decir DESPUÉS de que un intento falla. Si el stream de Claude **se cuelga** (ni responde ni falla — frecuente bajo carga "overloaded", peor con `thinking` + `effort:high`), el `await` no retorna nunca → la función corre hasta el **SIGKILL de plataforma a los 900 s** → **ningún `catch`/`finally` corre** → `marcarReproceso('error')` jamás se ejecuta → el informe queda en `reproceso.estado='en_curso'` para siempre. Por qué los fixes previos no bastaban: el **reintento** solo se dispara tras un FALLO (un cuelgue no "falla"); el **timeout 900** solo alargó la espera colgada; el **estado durable** muestra el estado pero el estado nunca avanza. Las líneas de error VACÍAS en `functions:log` son consistentes con un kill abrupto (no una excepción capturada).

**17.2 Decisiones / cambios** —
- **`conTimeoutAbortable(fabricarConSignal, ms)`** (en `reintentos.mjs`): crea un `AbortController`, pasa el `signal` al `client.messages.stream(params, {signal})`, y corre `Promise.race([finalMessage, timer])`. Al vencer `ms` **ABORTA el signal** (cancela el stream colgado → libera la conexión) y rechaza con **`TimeoutIA`** (`transitorio:true`). Así un cuelgue se vuelve un error transitorio reintentable: la promesa SIEMPRE se asienta → la función nunca corre hasta el SIGKILL.
- **`esErrorTransitorioIA`** reconoce `e.transitorio===true` + `Abort`/`abort` → `TimeoutIA` y abortos se reintentan.
- **CF**: la IA va envuelta en `conTimeoutAbortable(..., ATTEMPT_MS=400000)` (6.7 min/intento, cubre los 2–5 min reales + margen) dentro de `conReintentosIA({intentos:2, deadlineMs: inicioIA+820000})` → 2×400 s + persistencia **< 900 s** (jamás llega al SIGKILL). Motivo de error CLARO en timeout ("La IA no respondió a tiempo; informe muy denso").
- **WATCHDOG GLOBAL**: `setTimeout(870 s)` que escribe `reproceso.estado='error'` si la función sigue viva (cubre cuelgues imprevistos de Storage/Firestore); se cancela (`limpiarGuard`) en CADA salida (ok/error/carga). Garantía DEFINITIVA: la fila nunca queda en 'reprocesando'.
- **Memoria 1→2 GiB**: más CPU (extracción más rápida) + margen anti-OOM (un OOM-kill tampoco corre `catch` → también dejaría el estado colgado).

**17.3 No-regresión** — `conReintentosIA` sin cambios de firma (solo se le pasa una `fabricar` distinta). Modo CARGA intacto (no usa `marcarReproceso`/guard). `intentos` 4→2 + `ATTEMPT_MS` mantienen el total < 900 s. Sin renombres de exports.

**17.4 Tests / verificación** — `node --test` **1096/1096** (+5: `conTimeoutAbortable` resuelve rápido / **aborta el signal y rechaza TimeoutIA en un cuelgue** / propaga error real / `TimeoutIA` clasificado transitorio / **integración: cuelgue acotado + reintento SIEMPRE se asienta, nunca cuelga**). Lint OK. `node --check` OK. **CF desplegada**: `Successful update operation` (memoria 2GiB + timeout 900 desde fuente; audit log de `functions:log` rezagado). ⚠️ Validación en navegador la hace el director (admin gated).

**17.5 Anti-patterns evitados** — NO `await` sin timeout sobre una op de red que puede colgarse (el cuelgue era invisible e infinito); NO confiar en el reintento para un cuelgue (el reintento necesita un FALLO); NO depender solo del estado durable sin garantizar que el estado AVANCE; defensa en profundidad (timeout por-intento + watchdog global + memoria) para que el estado terminal esté **garantizado**.

**17.6 Archivos** — MODIFICADOS: `functions/reintentos.mjs` (`TimeoutIA` + `conTimeoutAbortable` + abort/transitorio en el clasificador), `functions/index.js` (IA acotada por intento + watchdog global + `limpiarGuard` en cada salida + memoria 2GiB + motivo claro), `tests/reintentos_ia.test.js`. INTACTOS: dominio, persistencia ADR-016, render del badge, modo CARGA.

**17.7 Doctrina + evolución** — "Toda espera sobre una operación de red que PUEDE colgarse (un stream de IA es el caso típico) se acota con un timeout INTERNO que aborta el recurso — nunca un `await` desnudo. En una Cloud Function, un cuelgue/OOM mata el proceso sin correr `catch`, dejando cualquier estado 'en curso' colgado: el estado terminal debe estar GARANTIZADO por un timeout por-operación + watchdog global, no solo escrito en el camino feliz." Lección → L-46. Sin cache bump.

## 18. ADR-018 — El fallo REAL del reproceso: "Claude API: terminated" = bodyTimeout de undici (~5 min) corta el stream largo de Opus

> Director (2026-06-08, con consola visible): "**la función reprocesar parece imposible, hemos intentado mil cosas**". Pero la consola por fin mostró el error CONCRETO: `Failed to load resource: 500 … extraerPruebasElectricasIA` + `[pruebas-electricas] reprocesar — FirebaseError: Claude API: terminated`. Y, señal de progreso: el badge YA pasaba a "⚠ reproceso falló" (ADR-017 funcionando: el estado resuelve, ya no se cuelga). Faltaba el porqué del FALLO. **CF DESPLEGADA; frontend ya en prod (sin cambios de front en este ADR).**

**18.1 Causa raíz (del mensaje real)** — El error `terminated` es de **undici** (cliente HTTP de Node, usado por `fetch` global → el SDK de Anthropic). undici aplica un **`bodyTimeout`/`headersTimeout` por defecto de ~300 s (5 min)** de INACTIVIDAD del stream. La extracción de un informe denso (Opus 4.7 + `thinking:adaptive` + `effort:high` + 32k tokens sobre un escaneo) **tarda > 5 min** → undici corta la conexión → `TypeError: terminated` (cause `UND_ERR_BODY_TIMEOUT`) → el SDK lo propaga → la CF lanza `HttpsError('internal','Claude API: terminated')`. Por qué se confundía con un cuelgue (ADR-017): undici cortaba a los 5 min ANTES de nuestro abort interno (que estaba en 6.7 min) → el síntoma previo (colgado) era el SIGKILL; ahora, con ADR-017, el estado resuelve a 'error' pero el error de fondo seguía siendo el corte de los 5 min. `terminated` además NO estaba clasificado transitorio → ni siquiera reintentaba.

**18.2 Decisiones / cambios** —
- **Dispatcher de undici SIN bodyTimeout** (la pieza clave): `new Agent({ bodyTimeout: 0, headersTimeout: 0, keepAliveTimeout: 60000 })` (módulo-level, reusado) pasado al cliente Anthropic vía `fetchOptions.dispatcher`. Ahora el stream puede tardar lo que la extracción necesite; el límite real lo ponen el timeout por-intento (`conTimeoutAbortable`) + el `timeoutSeconds` (900 s) de la función. Dependencia nueva: **`undici@^6`** en `functions/package.json`.
- **`timeout` del SDK a 840 s** (≥ ATTEMPT_MS) para que el AbortSignal interno del SDK tampoco aborte antes que nuestro control.
- **Clasificar `terminated`/`premature`/`other side closed`/`socket`/`UND_ERR_*`/body|headers timeout como TRANSITORIO** (`esErrorTransitorioIA` ahora también mira `e.cause.code/message`) → si vuelve a ocurrir, reintenta en vez de fallar duro.
- **ATTEMPT_MS 400→760 s** (sin el corte de 5 min, un intento puede correr lo que la extracción densa necesite) con patrón "un intento generoso + reintento SOLO si falla rápido" (`intentos:2`, `deadlineMs inicioIA+800000` < 900 s).

**18.3 No-regresión** — Modo CARGA usa el mismo cliente → también se beneficia (las cargas densas ya no se cortan a 5 min). `conTimeoutAbortable`/watchdog/2GiB de ADR-017 intactos (siguen garantizando estado terminal). Sin renombres. `effort:high` se CONSERVA (no se sacrificó completitud, L-24/L-26): el fix es de transporte HTTP, no de modelo.

**18.4 Tests / verificación** — `node --test` **1097/1097** (+1: `esErrorTransitorioIA` reconoce `terminated` + `cause.code UND_ERR_BODY_TIMEOUT`/`HEADERS_TIMEOUT` + "other side closed"). Lint OK. `node --check` OK. **CF desplegada**: `Successful update operation` (undici instalado en el build). ⚠️ Validación en navegador la hace el director: reprocesar un informe denso ya NO debe dar "terminated".

**18.5 Anti-patterns evitados** — NO asumir que el `timeout` del SDK (10 min) cubre el `bodyTimeout` de undici (son capas distintas); NO bajar `effort`/modelo (habría degradado la extracción) cuando el problema era de TRANSPORTE; NO dejar `terminated` sin clasificar; diagnóstico guiado por el MENSAJE REAL de la consola (§3.3), no por conjetura.

**18.6 Archivos** — MODIFICADOS: `functions/index.js` (import `undici` + `IA_DISPATCHER` + `fetchOptions.dispatcher` + `timeout:840000` + ATTEMPT_MS 760 s), `functions/reintentos.mjs` (clasificar terminated/cause), `functions/package.json` (+`undici@^6`), `tests/reintentos_ia.test.js`. INTACTOS: dominio, persistencia, render, modo CARGA, `effort:high`.

**18.7 Doctrina + evolución** — "El `timeout` de un SDK HTTP y el `bodyTimeout` del cliente de transporte (undici) son capas DISTINTAS: para streams largos (IA sobre documentos densos) hay que extender el bodyTimeout del transporte, no solo el timeout del SDK. Y diagnosticar por el MENSAJE de error real (la consola del navegador trae el `code`/`message` de la CF) antes de tocar el modelo." Lección → L-47. Sin cache bump. **Si aún falla**: revisar logs reales (`firebase functions:log`) del nuevo error; considerar bajar `effort` solo si el tiempo, ya sin corte, excede los ~12 min.

## 19. ADR-019 — `504`/`deadline-exceeded`: bug del presupuesto de reintento (un 2.º intento sin sitio corría hasta el SIGKILL) + 900 s insuficiente para máxima calidad

> Director (2026-06-08, consola COMPLETA): tras ADR-018 el "terminated" desapareció, pero el reproceso del EMS denso ahora daba `FirebaseError: deadline-exceeded` + **`504`** en la URL de la función (+ un error CORS secundario, porque un 504 no trae cabeceras CORS) + transport error 400 de Firestore (L-38, benigno). El director eligió **Opción A — MÁXIMA CALIDAD** (`effort:high`, sin acelerar). **CF DESPLEGADA; frontend en prod tras push.**

**19.1 Causa raíz (doble, del error real)** — (A) **Bug del presupuesto en `conReintentosIA`**: el chequeo de `deadlineMs` antes de reintentar solo exigía sitio para el **backoff** (~2 s), NO para un **intento COMPLETO** más. Con un `ATTEMPT_MS` largo (12.7 min), tras abortar el 1.er intento por timeout SÍ "sobraba" para el backoff → arrancaba un **2.º intento** que corría hasta el `timeoutSeconds` (900 s) → la plataforma devolvía **504** y el cliente `deadline-exceeded`. (B) **900 s insuficiente**: a máxima calidad un escaneo denso (EMS 450108) supera los 12–13 min → con 900 s no alcanzaba aunque no hubiera bug. El watchdog (ADR-017) sí escribía 'error' → el badge mostraba "falló" (no quedaba colgado), pero el resultado era un fallo, no la extracción.

**19.2 Decisiones / cambios** —
- **Fix del presupuesto** (`reintentos.mjs`): nueva opción `intentoMaxMs`; el gate de reintento ahora exige `restante > espera + intentoMaxMs + margen` (sitio para un intento ENTERO). La CF pasa `intentoMaxMs = ATTEMPT_MS`. Patrón resultante: "un intento largo + reintento SOLO si el 1.º falla RÁPIDO" (sin sitio para 2 intentos largos → no se arranca el 2.º → error limpio, nunca 504).
- **`timeoutSeconds` 900→1500** (25 min; gen2 admite 3600) para que máxima calidad alcance; **cliente `httpsCallable` 900000→1500000**; **`ATTEMPT_MS` 760000→1320000** (22 min); **`deadlineMs` inicioIA+1440000**; **watchdog 870000→1440000**; **SDK `timeout` 840000→1440000** (≥ ATTEMPT_MS). El reproceso es no bloqueante (badge durable, ADR-016) → la espera larga no congela la UI; el director puede navegar y volver.

**19.3 No-regresión** — `intentoMaxMs` default 0 → `conReintentosIA` se comporta igual donde no se pasa (la firma y los tests previos siguen válidos). `effort:high` CONSERVADO (decisión del director). Modo CARGA intacto. Sin renombres.

**19.4 Tests / verificación** — `node --test` **1099/1099** (+2: el gate NO reintenta si no hay sitio para un intento entero aunque sobre para el backoff —reproduce el bug del 504—; y SÍ reintenta si el fallo es RÁPIDO). Lint OK. `node --check` OK. **CF desplegada**: `Successful update operation` (1500 s / 2 GiB desde fuente). ⚠️ El director valida: reprocesar el EMS ya NO debe dar 504/deadline-exceeded y debe COMPLETAR (puede tardar 12–22 min a máxima calidad).

**19.5 Anti-patterns evitados** — NO gatear un reintento por el costo del backoff cuando el intento mismo es lo caro (hay que reservar presupuesto para el intento ENTERO); NO asumir que `timeoutSeconds` 900 alcanza para máxima calidad en escaneos densos; el 504+CORS era un síntoma (gateway timeout sin cabeceras), no un problema de CORS — diagnosticar por el `deadline-exceeded`/504 real (§3.3).

**19.6 Archivos** — MODIFICADOS: `functions/reintentos.mjs` (`intentoMaxMs` + gate corregido), `functions/index.js` (1500 s, ATTEMPT_MS 22 min, watchdog/deadline/SDK-timeout acordes, pasa `intentoMaxMs`), `assets/js/data/pruebas_electricas.js` (cliente 1500000), `tests/reintentos_ia.test.js`. INTACTOS: dominio, persistencia, render, modo CARGA, `effort:high`, dispatcher undici (ADR-018).

**19.7 Doctrina + evolución** — "Al reintentar una operación CARA bajo un presupuesto de tiempo, reserva sitio para un intento ENTERO, no solo para el backoff — si no, el último reintento se pasa del límite duro (en una Cloud Function = SIGKILL → 504). Y dimensiona `timeoutSeconds` al PEOR caso real de la operación (máxima calidad sobre el documento más denso), no al caso típico." Lección → L-48. Sin cache bump. **Si el EMS aún excede 22 min**: subir más `timeoutSeconds`/ATTEMPT_MS (gen2 hasta 3600 s) o reconsiderar Opción B con el director.

## 20. ADR-020 — RETIRO de "Reprocesar": el costo supera el valor (re-extraer = volver a subir el PDF)

> Director (2026-06-08), tras el arco ADR-015→019: "noto que **seleccionar reprocesar sale más costoso que eliminar e ingresar el informe nuevamente**; no genera valor tener la posibilidad de regenerar si es más costoso que ingresar el informe nuevamente." Y, con la consola: el reproceso seguía dando `La conexión de red se perdió` (una llamada de 12–25 min es frágil a cortes de red/proxy). Decisión de PRODUCTO: **eliminar el botón "Reprocesar".** **CF DESPLEGADA (solo-CARGA); frontend en prod tras push.**

**20.1 Causa raíz (de producto, no bug)** — "Reprocesar" corría la MISMA extracción IA que una carga nueva (mismo costo de 12–22 min a máxima calidad) y como llamada larga sincrónica era frágil (red/proxy la cortan → `network connection lost`). Su única ventaja real —re-extraer sin tener el PDF a mano— casi no aplica: el director siempre tiene los PDFs. El valor barato (refrescar campos canónicos sin IA) ya lo da el **backfill** (L-43), no el reproceso. Conclusión: el botón no justifica su costo/complejidad.

**20.2 Decisiones / cambios** —
- **Frontend**: se retira el botón "Reprocesar" (`tabla-pruebas.js#accionesPdf`), el handler `data-reproc` (`pruebas-electricas-shell.js`) y los estados de badge de reproceso (`reprocesando/interrumpido/falló`) → el badge vuelve a `pendiente/procesado`.
- **Cloud Function**: se elimina el **modo-reproceso** (ADR-016/017): `marcarReproceso`, `persistirReproceso`, `refInforme`, el watchdog global, los params `unidadId/informeId` y las marcas de estado. La función queda **solo-CARGA** ("thin": devuelve datos crudos; el cliente persiste). Se SIGUE conservando toda la robustez de transporte (reintento con presupuesto, timeout interno abortable, dispatcher sin bodyTimeout de undici, `timeoutSeconds:1500`, 2 GiB) porque **la carga usa la MISMA función** y también extrae informes densos.
- **`extraerConIA`** (data) vuelve a su forma simple (sin `informeId`/ack de reproceso).
- Se retira también la dep de la CF a los sanitizadores del dominio (`sanitizarInforme/Unidad/Bloques`, `derivarBushing`, `deepClean`, `FieldValue`) que solo usaba la persistencia server-side. (`derivarBushing`/`deepClean` siguen en `domain/` porque los usa el FRONTEND — carga + backfill.)

**20.3 No-regresión** — CARGA intacta (es el camino que ahora importa); upsert por fecha (L-39) y backfill (L-43) intactos. `node --test` **1099/1099** (los tests de `reintentos.mjs`/`derivarBushing` siguen válidos: la carga los usa). Sin renombres de exports usados por el frontend.

**20.4 Tests / verificación** — `node --test` 1099/1099 + lint. `node --check` de los archivos tocados OK. **CF desplegada** (solo-CARGA). ⚠️ Ventana transitoria: el frontend viejo (con botón) sobre la CF nueva → un clic en Reprocesar es un NO-OP (extrae y no guarda); se cierra al pushear el frontend (botón retirado). El director casi no usa el botón.

**20.5 Anti-patterns evitados** — NO conservar una feature cara solo porque "ya está hecha" (sunk cost); NO dejar código muerto (se removió el modo-reproceso completo, no solo el botón); NO tirar la robustez de transporte (la carga la sigue necesitando).

**20.6 Archivos** — MODIFICADOS: `assets/js/ui/pruebas/tabla-pruebas.js` (sin botón ni badges de reproceso), `assets/js/pruebas-electricas-shell.js` (sin handler), `assets/js/data/pruebas_electricas.js` (`extraerConIA` simple), `functions/index.js` (solo-CARGA; -modo reproceso; -imports dominio/FieldValue). INTACTOS: carga/upsert/backfill, robustez IA (reintentos/timeout/dispatcher), dominio (`derivarBushing`/`deepClean` usados por el frontend).

**20.7 Doctrina + evolución** — "Una feature que cuesta MÁS que su alternativa simple (aquí: re-extraer = volver a subir) y añade superficie/fragilidad debe RETIRARSE, no seguir parcheándose. El trabajo de robustez no se pierde si protege también al camino que se queda (la carga)." Sin lección nueva (es decisión de producto; la robustez ya está en L-44..L-48). Sin cache bump.

## 21. ADR-021 — Previsualización al colisionar por fecha: comparar "ya guardado" vs "nuevo" antes de reemplazar

> Director (2026-06-08): "en este segmento me gustaría que me permitas una **previsualización detallada** para constatar si se trata de un mismo informe o informes distintos en la misma fecha." (El upsert por fecha, L-39, mostraba un `window.confirm` ciego: REEMPLAZAR vs NUEVO sin ver QUÉ.) **Frontend; en prod tras push.**

**21.1 Causa raíz** — `storeReport` resolvía la colisión por fecha con un `window.confirm` que solo decía "ya existe un informe de DD/MM/AAAA" → el director no podía distinguir si el guardado y el nuevo eran el MISMO ensayo (reemplazar) o dos ensayos DISTINTOS de la misma fecha (crear ambos) sin información.

**21.2 Decisiones / cambios** — Nuevo modal `confirmarUpsert(prev, nuevo, serie, item)` (`pruebas-electricas-shell.js`): overlay propio (no reusa `#ov`, ocupado por la carga) que muestra **lado a lado** "YA GUARDADO" vs "NUEVO (a cargar)" con Fecha · Ejecutante · Equipos · Serie en PDF · Pruebas detectadas, + **"↗ Abrir PDF guardado"** (downloadURL) para inspeccionar, + el nombre del archivo nuevo. Devuelve `'reemplazar' | 'nuevo'`. Escape/clic-fondo = `'nuevo'` (no destructivo, igual default que el confirm previo). Estilos inline → sin dependencia de CSS nuevo. Reemplaza el `window.confirm` en `storeReport`.

**21.3 No-regresión** — La lógica de reemplazo (borrar prev + su PDF) / crear-nuevo es la MISMA; solo cambia la UI de decisión. Sin cambios de datos. `buscarInformeExistente`/upsert intactos.

**21.4 Tests / verificación** — `node --test` 1099/1099 + lint + `node --check` OK. ⚠️ **Sin verificación de UI en navegador (admin gated)** → el director valida el render del modal y el flujo (reemplazar/crear/abrir PDF).

**21.5 Anti-patterns evitados** — NO un `confirm` ciego para una decisión DESTRUCTIVA (reemplazar borra el anterior); NO reusar el overlay de carga (estaba ocupado); fallback no destructivo (Escape = crear nuevo, no reemplazar).

**21.6 Archivos** — MODIFICADO: `assets/js/pruebas-electricas-shell.js` (`confirmarUpsert` + cableado en `storeReport`).

**21.7 Doctrina + evolución** — "Antes de una acción DESTRUCTIVA con ambigüedad (reemplazar un registro que 'coincide'), dale al usuario la EVIDENCIA para decidir (previsualización lado a lado + abrir el original), no un sí/no ciego." Sin lección nueva. Sin cache bump.

## 22. ADR-022 — Calificación global muestra TODAS las pruebas (no oculta/fusiona) + Tendencia con acción clasificada (predictiva/preventiva/correctiva)

> Director (2026-06-08): "**debes respetar siempre el segmento de calificación global por prueba, siempre lo modificas y dañas**… el FP de bujes, te digo que lo separes independiente de los devanados, pero terminas dejando una sola; integra las demás pruebas que no estén ahí, independiente si se hacen o no en el transcurso de los años." Y, en Tendencia: "resaltar cambios relevantes dando criterio y diagnóstico basándose en normas, proponiendo acciones predictivas, preventivas y correctivas." **Frontend; en prod tras push.** (Feedback guardado en memoria persistente: `feedback_calificacion_global_por_prueba.md`.)

**22.1 Causa raíz (P1)** — El "scorecard" (`renderScorecard`, informe vigente) SOBRESCRIBE `#matrix` SIEMPRE (aunque haya varios informes, `montarBloques`) y tenía `if (!r || estado===NEUTRAL) return null` → **ocultaba las pruebas sin dato medido**. Si el informe vigente no traía bujes, la fila "FP de bujes (C1)" DESAPARECÍA → parecía "fusionada/quitada" (el síntoma que el director reporta). Además `FAMILIAS_SCORE` no incluía `collar`. (El FP de bujes YA estaba separado del tan δ de devanados en filas distintas — eso no era el bug; el bug era la OCULTACIÓN.)

**22.2 Decisiones / cambios** —
- **Calificación global (P1)**: `renderScorecard` ahora lista SIEMPRE TODAS las pruebas; una prueba sin dato se marca **"No realizada"** (estado neutro) en vez de ocultarse — cada prueba conserva su fila INDEPENDIENTE (FP bujes ≠ FP devanados), exista o no ese año. Se añadió `collar` a `FAMILIAS_SCORE` (8 pruebas, alineado con la matriz). **NO se tocó el motor del veredicto** (`semaforo.js#renderMatriz`/`multinorma`/`calificarPrueba`).
- **Tendencia (acciones)**: nueva `accionPrueba(familia, ctx)` (dominio puro, `pruebas_electricas_recomendaciones.js`) que clasifica la acción de mantenimiento (taxonomía CBM/PdM): **PREVENTIVA** (verde/rutina) · **PREDICTIVA** (ámbar-naranja/vigilar) · **CORRECTIVA** (rojo/fuera de norma) · **DIAGNÓSTICA** (sin dato). **Sensible a la tendencia**: una prueba verde que EMPEORA fuerte (≥5% relativo informe→informe) sube a PREDICTIVA (IEEE C57.152: la tendencia manda). `analisisTendencia` adjunta `accion` + `relevante`. El diagnóstico de la unidad RESALTA los cambios relevantes (orden: relevantes/peor primero, filas abiertas, marcador rojo) y muestra el badge de acción + criterio/diagnóstico normativo + leyenda.

**22.3 No-regresión** — `recomendarPrueba` intacto (refactor interno a `textoNivel`, mismo resultado; tests previos verdes). `renderMatriz`/multinorma/`calificarPrueba` SIN tocar. El scorecard solo cambia su política de filas (mostrar todas) — misma fuente de verdad (`calificarPrueba`/`estadoBushing`).

**22.4 Tests / verificación** — `node --test` **1105/1105** (+6: `accionPrueba` — preventiva/predictiva/correctiva/diagnóstica por nivel + bump por tendencia + leve no bumpea). Lint OK. `node --check` OK. ⚠️ **Sin verificación de UI en navegador (admin gated)** → el director valida que la calificación global lista todas las pruebas (FP bujes separado, "No realizada" donde aplique) y que la Tendencia resalta relevantes + muestra el tipo de acción.

**22.5 Anti-patterns evitados** — NO ocultar/fusionar pruebas en la calificación global (la ausencia es información); NO tocar el motor del veredicto al arreglar la presentación; el tipo de acción es EXPLÍCITO (campo), no embebido en prosa.

**22.6 Archivos** — MODIFICADOS: `assets/js/pruebas-electricas-shell.js` (`FAMILIAS_SCORE` +collar, `renderScorecard` muestra todas, `diagnosticoUnidadHtml` resalta relevantes + acción), `assets/js/domain/pruebas_electricas_recomendaciones.js` (`accionPrueba`/`TIPO_ACCION`/`textoNivel`), `assets/js/domain/pruebas_electricas_tendencia.js` (`analisisTendencia` adjunta `accion`/`relevante`/`deltaRel`), `tests/pruebas_electricas_recomendaciones.test.js`. INTACTOS: `semaforo.js`, `multinorma.js`, render de bloques/matriz.

**22.7 Doctrina + evolución** — "En un tablero de calificación, la AUSENCIA de una prueba es información: lístala como 'No realizada', no la ocultes ni la fusiones. Y separa SIEMPRE pruebas distintas (FP bujes ≠ FP devanados)." + "El diagnóstico de tendencia debe clasificar la acción (predictiva/preventiva/correctiva) de forma explícita y sensible a la deriva, no solo al valor puntual." Sin lección nueva (feedback en memoria persistente). Sin cache bump. Continúa en ADR-023.

## 23. ADR-023 — Tablero: vista CONSOLIDADA (todas las pruebas en una gráfica, % del límite) + filtro de año

> Director (2026-06-08): "que en el tablero se puedan apreciar todas las pruebas en la misma gráfica y… un filtro de año para cada gráfica" → P2 elegida: **opción A** (valores como % del límite, misma unidad) "permite que la gráfica ajuste el rango según la selección de pruebas". 3.ª parte del pedido de ADR-022. **Frontend; en prod tras push.**

**23.1 Decisiones / cambios** —
- **Vista consolidada** (`renderConsolidado`, sección nueva `#pe-consolidado` tras la calificación global): cada prueba se normaliza a **% de su límite** normativo (100% = en el límite → misma unidad para todas, comparables en un eje) y se dibuja como **barra horizontal** coloreada por el **veredicto multi-norma** (reusa `metricaPrueba` + `calificarPrueba`; aislamiento → límite = mínimo NETA por clase del informe). Controles: **`<select>` de año del informe** + **chips para seleccionar pruebas**; el **rango del eje se AUTO-AJUSTA** al máximo de las pruebas seleccionadas (mín. 110% para que la línea de límite sea visible). DRM se omite (criterio = ventana de tiempo, no límite único). Estado de selección persistente entre re-renders (`state.consolidadoSel`); listeners delegados una sola vez. Estilos inline (robusto, sin CSS nuevo).
- **Filtro de año en las gráficas detalladas** (bloques): `montarBloques` etiqueta cada grupo con `data-bloque-ano` y, si hay >1 año, antepone un `<select>` (Todos + cada año) que hace **toggle de visibilidad** de los grupos — sin re-render, sin tocar el scorecard ni la calificación global. Persistente (`state.bloquesAnoFiltro`).

**23.2 No-regresión** — ADITIVO: nueva sección + nueva función; NO toca `renderMatriz`/`renderScorecard`/multinorma (la calificación global queda intacta — garantía pedida por el director). El filtro de bloques solo cambia `display` de grupos. `metricaPrueba` ya existía (lo usa la matriz). Lint HTML OK con la sección nueva.

**23.3 Tests / verificación** — `node --test` **1105/1105** + lint. `node --check` OK. ⚠️ **Sin verificación de UI en navegador (admin gated + requiere datos/sesión)** → el director valida el render: barras % del límite, selección de pruebas que reajusta el rango, filtros de año (consolidada y bloques). El panel de Launch preview muestra la página estática (sin datos).

**23.4 Anti-patterns evitados** — NO meter pruebas de distintas unidades en un mismo eje crudo (se normaliza a % del límite); NO re-render pesado para el filtro de bloques (toggle de display); NO tocar el motor del veredicto ni la calificación global.

**23.5 Archivos** — MODIFICADOS: `pages/pruebas-electricas.html` (sección `#consolidado`/`#pe-consolidado`), `assets/js/pruebas-electricas-shell.js` (`renderConsolidado` + `LIM_CONSOLIDADO`/`COLOR_ESTADO`, llamada en `renderInformesUI`, filtro de año en `montarBloques`, import `metricaPrueba`). INTACTOS: calificación global, multinorma, render de bloques/matriz.

**23.6 Doctrina + evolución** — "Para comparar magnitudes de distintas unidades en una sola gráfica, normaliza a una unidad común con SIGNIFICADO (aquí: % del límite normativo, 100% = el límite) y deja que el eje se ajuste a la selección. Filtrar = togglear visibilidad, no re-renderizar." **SUPERSEDED por ADR-024** (la interpretación correcta era otra). Sin cache bump.

## 24. ADR-024 — Tablero MULTI-AÑO: cada prueba con TODOS los años superpuestos (+ filtro de año por prueba) — validado con workflow de PREVIEW

> Director (2026-06-08), corrigiéndome: "**cuando me refería a que se vieran todas las pruebas en la misma gráfica es que todos los años aparezcan plasmados en la misma gráfica** — corriente de excitación que se vean todos los años conforme a los informes anexados, relación, etc., **todas las pruebas**. Los filtros de cada año deben ser posibles **en cada prueba**. Apóyate con tus habilidades, skill/plugins. **Implementa workflow para que sea un trabajo más preciso**." ADR-023 (barras "% del límite" de un año) era una MALA interpretación. **Frontend; en prod tras push.**

**24.1 Interpretación correcta** — Por PRUEBA, UNA gráfica con una LÍNEA por AÑO (informe) superpuestas en el mismo eje (X = TAP/config) → se compara la evolución de cada ensayo entre años. Filtro de año POR PRUEBA (chips que muestran/ocultan cada año en ESA gráfica). No barras de "todas las pruebas juntas".

**24.2 Workflow de PRECISIÓN (lo que el director pidió) — clave de este ADR** — Se montó un **preview**: `scripts/dev-server.mjs` (servidor estático Node — `python http.server` lo bloquea el sandbox) + `.claude/launch.json` + harness `_dev/preview-multiano.html` con datos MOCK. Se VALIDÓ el render en el navegador (Claude Preview MCP) ANTES de cablear a la app. **Atrapó un defecto invisible al código**: la leyenda "2019/2021/2023" del SVG NO eran chips de filtro (el render genérico solo genera chips de FASE, no de año) → `.pe-fase-chip` = 0. Sin el preview se habría enviado "sin filtro de año" otra vez. Con el preview: se confirmó `filtra: 6→5 líneas` al clic en un año.

**24.3 Decisiones / cambios** —
- **Dominio puro** `bloquesMultiAno(items)` (`pruebas_electricas_bloques.js`, testeado): agrupa los bloques por FAMILIA de prueba y produce, por familia, un bloque con una serie por AÑO (nombre = año), reduciendo cada año a su curva REPRESENTATIVA = peor fase por X (máx; mín en aislamiento). Ignora familias no reconocidas; robusto ante basura.
- **`montarMultiAno`** (shell, en `#pe-consolidado`): por cada bloque multi-año, renderiza la gráfica con `renderBloque` + **chips de AÑO propios** (la leyenda del SVG no filtra) que togglean qué años se ven y re-renderizan el bloque filtrado. Se llama al final de `montarBloques` (necesita las curvas ya cargadas en `state.bloquesCache`).
- Se **RETIRÓ** la vista de barras "% del límite" de ADR-023 (`renderConsolidado`/`LIM_CONSOLIDADO`/`COLOR_ESTADO`) y el **dropdown de año global** de los bloques (causaba "años vacíos" — el filtro ahora es POR PRUEBA, por chips).

**24.4 No-regresión** — ADITIVO sobre las gráficas; NO toca la calificación global ni el motor del veredicto (reusa `renderBloque`/`mountBloques` existentes). `node --test` **1110/1110** (+5 `bloquesMultiAno`: agrupa por familia, serie=año ordenada, representativa=peor fase, aislamiento=mín, ignora desconocidas, basura). Lint OK. **Preview**: render + filtro validados visualmente.

**24.5 Anti-patterns evitados** — NO asumir que una leyenda es un filtro (se verificó en el navegador); NO re-interpretar a ciegas un pedido ambiguo dos veces (se validó con preview/mock antes de cablear); NO un dropdown global que deja años vacíos (filtro por prueba).

**24.6 Archivos** — NUEVOS: `scripts/dev-server.mjs`, `.claude/launch.json`, `_dev/preview-multiano.html` (workflow de preview). MODIFICADOS: `assets/js/domain/pruebas_electricas_bloques.js` (`bloquesMultiAno`+helpers), `assets/js/pruebas-electricas-shell.js` (`montarMultiAno`; -barras; -dropdown buggy; import `renderBloque`/`bloquesMultiAno`), `pages/pruebas-electricas.html` (título sección multi-año), `tests/pruebas_electricas_bloques.test.js`. INTACTOS: calificación global, multinorma, render de bloques.

**24.7 Doctrina + evolución** — "Para trabajo de UI con requisito ambiguo: monta un PREVIEW con datos mock y VALÍDALO en el navegador antes de cablear a la app — atrapa lo que el código no muestra (p.ej. que una leyenda no filtra). Una 'leyenda' no es un 'filtro' hasta verificarlo." Lección → L-49. Sin cache bump. (Las gráficas detalladas por informe siguen abajo como drill-down.)

## 25. ADR-025 — Multi-año v2 (feedback del director): conserva FASES + valores reales + filtro de año GLOBAL + fase por gráfica; Tendencia con cambios año-a-año + PROYECCIÓN

> Director (2026-06-08, revisando el preview de ADR-024): (1) "quitaste la opción de filtrar por fases, no debes desmejorar"; (2) "en relación los valores están mal extraídos, ninguna cumple — antes se veían bien"; (3) "el filtro de año aplica para TODAS las pruebas del libro"; (4) "en Tendencia deben reposar los cambios relevantes año tras año y un análisis de cómo se proyecta". Validado todo con el workflow de PREVIEW (ADR-024/L-49). **Frontend; en prod tras push.**

**25.1 Causa raíz** — ADR-024 reducía cada año a UNA curva "peor fase por X" → (1) perdía las fases (no se podían filtrar) y (2) DISTORSIONABA valores (en relación, tomar el máx entre fases sobreestimaba; con un mock irreal parecía "ninguna cumple"). La extracción IA NO cambió — el defecto era de PRESENTACIÓN (la reducción).

**25.2 Decisiones / cambios** —
- **(1+2) Conservar fases + valores reales** (`bloquesMultiAno` reescrita): NO reduce; produce una serie por **año × fase** (etiquetas `_ano`/`_fase`, nombre "<año> · <fase>"), con los valores REALES de cada fase. Tests actualizados (conserva fases, no distorsiona).
- **(3) Filtro de año GLOBAL** + **fase por gráfica** (`montarMultiAno` reescrita): chips de **año arriba** que aplican a TODAS las pruebas del libro (`state.multiAnoYears`), + chips de **fase en cada gráfica** (`b._selF`). Color por AÑO consistente entre gráficas (compara la evolución). Se exportó `svgBloque` (grafico-generico) para renderizar la gráfica con filtros propios (la leyenda del render genérico no filtra años, L-49). Validado en preview: año global 18→12 líneas (quita un año de todas), fase 6→4 (solo esa gráfica), relación bajo el límite 0.5%.
- **(4) Tendencia: cambios AÑO A AÑO + PROYECCIÓN** (`tendencia.js`): `cambiosAnoAno(puntos, invertir)` (todo el historial: Δ/Δ%/dirección por par consecutivo) + `proyectarTendencia(puntos, limite, invertir)` (ajuste lineal mínimos cuadrados → pendiente/año y **años estimados hasta cruzar el límite** al ritmo actual; "ya fuera de norma" si aplica). `analisisTendencia` los adjunta; el diagnóstico de la unidad muestra los saltos año a año (badges ▲/▼/→ con Δ%) + la proyección por métrica.

**25.3 No-regresión** — Las gráficas detalladas por informe (drill-down) intactas (su filtro de fase sigue). `svgBloque` solo se EXPORTÓ (sin cambio de lógica). NO toca calificación global ni motor del veredicto. `node --test` **1119/1119** (+ cambiosAnoAno + proyectarTendencia; bloquesMultiAno actualizado a año×fase). Lint OK.

**25.4 Verificación** — Preview (Claude MCP): estructura (año global + fases A/B/C por gráfica + aislamiento sin fases), valores reales (relación bajo límite), y AMBOS filtros por conteo de líneas antes/después de clic. ⚠️ Validación final sobre datos reales: el director.

**25.5 Anti-patterns evitados** — NO reducir/colapsar series (perdía fases y distorsionaba); NO confundir un defecto de presentación con uno de extracción (la IA no cambió); proyección por ajuste lineal explícito (no "a ojo").

**25.6 Archivos** — MODIFICADOS: `assets/js/domain/pruebas_electricas_bloques.js` (`bloquesMultiAno` → año×fase), `assets/js/pruebas-electricas-shell.js` (`montarMultiAno` v2: año global + fase por gráfica + color por año; diagnóstico con cambios año-a-año + proyección; import `svgBloque`), `assets/js/ui/pruebas/grafico-generico.js` (export `svgBloque`), `assets/js/domain/pruebas_electricas_tendencia.js` (`cambiosAnoAno`/`proyectarTendencia` + en `analisisTendencia`), tests (bloques, tendencia), `_dev/preview-multiano.html`. INTACTOS: calificación global, multinorma, gráficas por informe.

**25.7 Doctrina + evolución** — "No reduzcas/colapses datos para 'simplificar' una vista comparativa — conserva las dimensiones reales (fase) y deja que el usuario filtre; reducir distorsiona y se confunde con 'mala extracción'. Un análisis de tendencia útil incluye el historial de cambios AÑO A AÑO y una PROYECCIÓN cuantitativa (ajuste lineal → años a cruzar el límite), no solo el último Δ." Sin lección nueva (preview en L-49). Sin cache bump.

## 26. ADR-026 — Regresión: el multi-año colapsaba informes del MISMO año → identidad por INFORME (no por año)

> Director (2026-06-08, frustrado por **costo de tokens/IA**): "antes se podían apreciar **7 informes** de la serie 450108; cuando trabajaste el filtro dejaron de apreciarse todos. Corrige, **memoriza y no repitas estos errores de alto costo**." Basado en el preview. **Frontend; en prod tras push.**

**26.1 Causa raíz** — `bloquesMultiAno`/`montarMultiAno` (ADR-025) agrupaban y filtraban las series por **AÑO** (`_ano`). La serie 450108 tiene **2 ensayos en 2021** (18/01 y 20/09); al usar el año como clave, ambos compartían etiqueta/color y un solo chip → se "fundían" en uno. Reproducido en el preview: 7 informes (2 en 2021) → solo **6 chips** y dos series "2021 · Fase A" indistinguibles.

**26.2 Decisiones / cambios** — Identidad por **INFORME**, no por año. `bloquesMultiAno`: cada serie lleva `_rep` (id del informe, ÚNICO), `_repLabel` (FECHA o año, para mostrar) además de `_ano`/`_fase`; nombre "<fecha> · <fase>"; orden por (año, fecha). `montarMultiAno`: el filtro GLOBAL es por **informe** (chips con la FECHA, `state.multiAnoReps`), color **por informe** (distinto cada uno); el filtro de fase por gráfica intacto. Resultado validado en preview: **7 chips** (incl. 18/01/2021 y 20/09/2021 separados), 21 líneas con etiquetas únicas, el filtro global quita un informe de TODAS las gráficas (42→36 líneas).

**26.3 No-regresión** — Solo cambia la CLAVE (año→informe) y el etiquetado/color; la conservación de fases + valores reales (ADR-025) intacta. NO toca calificación global ni motor. `node --test` **1119/1119** (test nuevo: 2 informes del mismo año NO colapsan, `_rep` distintos). Lint OK.

**26.4 Anti-patterns evitados** — NO usar como clave un atributo que varios registros comparten (año) cuando la unidad real es otra (el informe); NO "arreglar" a ciegas — se REPRODUJO el caso real (7 informes, 2 en 2021) en el preview antes de tocar, fijando la causa exacta (ahorra tokens); verificar antes/después que TODO lo visible sigue visible.

**26.5 Archivos** — MODIFICADOS: `assets/js/domain/pruebas_electricas_bloques.js` (`bloquesMultiAno` → clave por informe, `_rep`/`_repLabel`), `assets/js/pruebas-electricas-shell.js` (`montarMultiAno` → filtro/color por informe), `tests/pruebas_electricas_bloques.test.js`, `_dev/preview-multiano.html`. INTACTOS: calificación global, multinorma, tendencia, gráficas por informe.

**26.6 Doctrina + evolución** — "La clave de identidad de una serie/fila es la ENTIDAD real (el informe), no un atributo agregable (el año) — si varios comparten ese atributo, se colapsan y desaparecen. Y al añadir/reescribir una vista, verificar que lo que ANTES se veía sigue viéndose (contar antes/después en el preview)." Memorizado (feedback persistente: `feedback_no_regresiones_visibilidad.md`). Sin lección nueva (refuerza L-49). Sin cache bump.
