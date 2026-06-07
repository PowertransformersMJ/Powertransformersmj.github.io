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
