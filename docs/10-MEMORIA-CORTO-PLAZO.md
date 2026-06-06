# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo neuronal: Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`,
> es de las primeras lecturas de cada sesión (Ignorancia Selectiva, `CLAUDE.md §G`).
> SOLO lo vivo: foco actual, pendientes abiertos, bitácora. Estado técnico → `05`.
>
> **Es la pizarra, no el archivo.** Al cerrar una tarea: consolidar a ADR (`99`) +
> fila en `00-INDICE`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).
>
> **Convención de handoff (relevo a ventana nueva)**: el "Foco actual" debe incluir
> **🚫 Callejones sin salida** — qué se probó que FALLÓ y NO reintentar, con el porqué.
> Le ahorra al próximo "tú" repetir errores ya descartados (relevo curado > `/compact`).

---

## 🎯 Foco actual

> 🤖 **Extracción de Pruebas Eléctricas con IA (Claude) — código completo + tests, PENDIENTE DEPLOY** (2026-06-04, **ADR-003** `99` línea 64). Cloud Function `extraerPruebasElectricasIA` (PDF nativo desde Storage → tool use forzado → `sanitizarInforme`) + selector de modelo (Sonnet 4.6 def / Opus 4.7 / Haiku 4.5) en el modal + fallback regex→manual. 112/112 tests verdes + contrato IA `tests/pruebas_electricas_ia.test.js`. **⚠ Requiere que el director despliegue (TODO-04)**: `cd functions && npm install`; `firebase functions:secrets:set LLM_API_KEY` (key de platform.claude.com); `firebase deploy --only functions:extraerPruebasElectricasIA`. El front (shell/data/init) va por GitHub Pages (push a `main`). Skill `claude-api` consultada. 🚫 NO mandar texto pre-extraído (PDF nativo), NO exponer la key al cliente.
>
> 🧠 **Cerebro neuronal instalado + auditado** sobre SGM·TRANSPOWER (2026-06-04).
> Instalación cerrada como **ADR-001** (`99-HISTORIAL` línea 20). El CLAUDE.md
> monolítico previo (3081 líneas) quedó cuarentenado en `_legacy/CLAUDE-previo.md`
> — sigue siendo la fuente histórica más rica (plan F0–F37, 14 reglas §0.1.2.*,
> handoff visual §9). Lo esencial se cosechó en §1 + `05` + `20` + `30`; el resto
> se consulta on-demand desde el legacy.
>
> **✅ Cerebro commiteado local como `8a6db90`** (`feat(cerebro): instalar sistema
> de memoria neuronal documental`) vía GitHub Desktop — incluyó `skills/` (290
> archivos tracked). **⏳ PENDIENTE menor**: los docs de cierre del ADR-001 (`00`,
> `05`, `10`, `99`) **+ los del ADR-002** (`00`, `10`, `30`, `99`, `skills-inventory.md`)
> quedaron modificados DESPUÉS de `8a6db90` → el director debe hacer un commit con
> ellos. **⏳ Verificar push**: confirmar que llegaron a `origin/main` para que GitHub
> Pages deploye. NO requiere deploy Firebase (no se tocó rules/indexes/storage/functions).
>
> **🛠️ Skills (ADR-002, 2026-06-04)**: 24 skills repo-only quedaron staged en
> `.claude/skills/` y **activas tras reinicio** (probado con `crm-architect`). ⚠️ Son
> **local-only** (`.claude/` gitignorado) → si se re-clona el repo, re-correr el copy
> (fuente en `skills/`, receta en `30 L-19`). Las 56 ya-instaladas no se tocaron.
>
> Tras eso: no hay tarea de producto en curso. Esperar pedido del director
> y seguir el árbol de decisión `_legacy/CLAUDE-previo.md §7.2`.
>
> **🚫 Callejones sin salida**: (1) NO usar canales MCP/`git push` del runtime para
> escribir — dan 403; solo PAT inline funciona. (2) NO asumir que las reglas/índices
> Firebase están desplegados — el director deploya a mano. (3) En scripts del cerebro,
> NUNCA `2>NUL` (Windows) — crea archivo literal `NUL` en macOS; usar `2>/dev/null` (ver M-01).

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 en Firestore (script `scripts/migrate/tipificar-suministros-fan-db.js`, correr `dryRun` primero) | 🔮 abierto | director corre el script en su Mac |
| **TODO-02** | Definir flujo de selección runtime FN-063 vs FN-050 para el contrato 4123000081 (pedido del director) | 🔮 abierto | requiere brief del director |
| **TODO-03** | Cleanup: PDFs `REMISION N.pdf` subidos por error al raíz del repo | ✅ resuelto (commit `18a25c6` "limpieza basura raíz · 25 archivos · ~9.4 MB") — verificado 2026-06-04: cero PDFs en raíz | — |
| **TODO-04** | IA de Pruebas Eléctricas (ADR-003 §3): ✅ 1ª versión desplegada + secret `LLM_API_KEY` configurado + E2E real OK (Opus 4.7, Siemens 266762). **Pendiente RE-DEPLOY** tras la mejora de identidad de unidad: `firebase deploy --only functions:extraerPruebasElectricasIA` + re-push del front a `main`. Luego probar 2º PDF (más completo, con DRM). | 🔄 en curso | re-deploy + 2ª prueba |

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. El proyecto está en modo "features puntuales + bugfixes de campo", no en plan maestro.
- `_legacy/CLAUDE-previo.md` es el archivo de referencia histórica: contiene las 14 reglas permanentes §0.1.2.* (informes imprimibles, deep-clean Firestore, anti-datalist, integración cross-módulo, render con foto, etc.) que NO se perdieron — están condensadas en `30-LECCIONES.md`.
- Las skills viven en `skills/` (catálogo paralelo). El framework de auditoría se activa con el **Trigger 🔵** cuando el director pida análisis especializado.

## 📝 Bitácora (efímera)

- **2026-06-04** — Instalado el cerebro neuronal (7 fases). CLAUDE.md previo → cuarentena. Cosechado §1/05/20/30 con datos reales del proyecto.
- **2026-06-04** — Auditoría holística post-instalación: limpieza de `CEREBRO NUEVO/` (3.3 MB fuente redundante) + `NUL` (artefacto 0-byte). brain:check SANO, cero huérfanos, 15 hojas técnicas referenciadas, rutas del proyecto verificadas, frescura `05` ↔ git real OK. TODO-03 detectado stale → marcado ✅ (ya resuelto por commit `18a25c6`).
- **2026-06-04** — Bug `M-01` corregido: `brain-check.mjs:171` usaba `2>NUL` (Windows) → recreaba archivo `NUL` en cada corrida; cambiado a `2>/dev/null`, verificado que no se recrea. Lección en `30 §Meta`.
- **2026-06-04** — Cierre: instalación consolidada como ADR-001 (`99` + fila en `00`). El director commiteó el cerebro como `8a6db90` vía GitHub Desktop (incluyó `skills/`). Queda 2º commit pendiente con los docs de cierre (00/05/10/99) + verificar push a `origin/main`.
- **2026-06-06** — Feature: **eliminar libros** desde la biblioteca. `eliminarUnidad(unidadId)` en data layer (borra informes de la subcolección + PDFs en Storage vía listAll/deleteObject + doc de la unidad). UI: botón rojo "×" sobre cada lomo (aparece al hover; wrapper `.pe-book-wrap` del mismo tamaño preserva la repisa flex), solo admin + backend + NO seed (173523/200718 base). `window.confirm` + las suscripciones en vivo vacían el tablero. Rules ya permitían delete (admin). Frontend puro, sin deploy. **También**: nuevo flujo git (Claude commitea+deploya, director pushea — memoria); `Debug/` destrackeado del repo público (tenía PDFs de cliente). **Purga de historial HECHA localmente** con git-filter-repo (0 blobs Debug, .git 98→70M, respaldo bundle en `/tmp/transpower-backup-pre-debug-purge-*.bundle`). ⚠ **Pendiente que el director haga force-push** de `main` y `DESARROLLO` para publicar la historia limpia (receta `L-25`). main estaba expuesto (19 PDFs en su árbol); tras el rewrite su árbol queda sin Debug.
- **2026-06-06** — 2ª prueba E2E (Sonnet, informe EMS 20 MVA NS 450108, slides, 3 devanados, 17 TAPs). Fix de paneles legibles ✅ confirmado en screencapture. **Bugs hallados + corregidos**: (1) gráficas con eje Y fijo → barras se salían del marco (aislamiento 5.72 > tope 4); refactor a eje dinámico `ejeMax/ticksY/drawGridY` en `grafico-svg.js` (helpers testeados en node). (2) extracción incompleta: solo tan δ; el resto vacío por datos por-TAP que no encajan + Sonnet < Opus en formatos densos; reforzado el system prompt (exhaustividad + representativo por TAP) + `max_tokens` 16k→32k. Lecciones `L-23`/`L-24`. **Pendiente mayor (propuesto)**: schema por-TAP (curvas) + bushing PF como familia propia + nomenclatura dinámica. ⚠ Requiere re-deploy función + re-push front.
- **2026-06-04** — UI Pruebas Eléctricas: fix de legibilidad. Los títulos/subtítulos del tablero caían sobre la foto fija `.aqua-power-scene` y eran ilegibles (reporte del cliente). Cada `<section>` del tablero ahora es un panel sólido (`[data-tab-panel="tablero"] .pe-scope > section`), sin tocar la biblioteca; neutralizado el doble-realce interno. CSS balanceado; **no verificado visualmente en vivo** (sitio Firebase-gated) → el director valida tras push. Lección `L-22`. Pendiente (propuesto): callout de insight + nomenclatura dinámica (hoy hardcodeada AT 110kV, no corresponde a toda unidad).
- **2026-06-04** — IA Pruebas Eléctricas · prueba E2E REAL exitosa (Opus 4.7, informe Applus 22 págs, Siemens 266762): todas las pruebas extraídas y clasificadas correctas vs el PDF (tan δ CH/CHL/CL, excitación 0.29%, relación 0.04%, aislamiento 2.54/5.72/2.02 GΩ exactos, collar ~28 mW, DRM correctamente vacío). **Laguna detectada + resuelta**: la ficha "Identidad de la unidad" salía vacía (fabricante/potencia/tensiones…) porque el tool solo extraía el informe, no la placa. Fix aditivo: tool schema + system prompt ganan objeto `unidad` (lee placa de características); el shell hace `guardarUnidad({serie, ...unidad})` (merge, una vez). 114/114 tests. ⚠ Requiere **re-deploy de la función** + re-push del front (la 1ª versión ya estaba desplegada).
- **2026-06-04** — IA Pruebas Eléctricas (ADR-003): implementada Cloud Function `extraerPruebasElectricasIA` (onCall, `southamerica-east1`, secret `LLM_API_KEY`) que lee el PDF nativo desde Storage y fuerza tool use de Claude espejando `sanitizarInforme`; prompt caching del system; cascada Sonnet 4.6/Opus 4.7/Haiku 4.5. Cliente: `getFunctionsSafe` + `extraerConIA` + selector en modal + branch IA→fallback en `storeReport`. Corregidos los IDs de modelo inválidos del prompt de Antigravity. 112/112 + nuevo test de contrato (10/10). Pendiente deploy (TODO-04).
- **2026-06-04** — Skills: auditoría de solape repo↔interfaz (56 ya instaladas / 24 repo-only). Las 24 staged a `.claude/skills/` con `name` del frontmatter; bundle `taste-skill-main` desglosado en 13 sub-skills; `code-modernization`/`code-simplifier` excluidas (no son skills). Director reinició → `crm-architect` probada OK. Consolidado como **ADR-002** (`99` línea 42 + fila en `00`) + lección `L-19` (`30`) + `skills-inventory.md` corregido. `.claude/` gitignorado → activación local-only.
