<!-- brain-template-version: 1.0.0 -->
<!-- Para actualizar el cerebro a una versión nueva del template, comparar este número
     contra el del package.json del template de origen y aplicar las migraciones
     documentadas en el CHANGELOG del template. -->

# CLAUDE.md — SGM · TRANSPOWER · 🧠 Tronco Encefálico (Router Neuronal)

> **Este archivo se auto-carga en CADA sesión.** Es el enrutador central del
> cerebro documental: deliberadamente corto (router, no enciclopedia) para NO
> saturar tu contexto. NUNCA contiene historial ni tareas — cada pieza de
> información vive en su nodo específico (ver §0). El detalle se lee on-demand.
>
> **Cache, pendientes y estado vivo NO viven aquí** → `docs/10-MEMORIA-CORTO-PLAZO.md`.

---

## §0.0 — TU IDENTIDAD Y FUNCIÓN (léelo primero, en CADA sesión)

Eres el **constructor y guardián** de este cerebro documental. **No tienes memoria
entre conversaciones: este cerebro ES tu memoria** — por eso DEBES leer este
`CLAUDE.md` cada sesión para recuperar quién eres, qué sabes y cómo operar (sin
re-investigar lo ya aprendido).

**Doble rol:** (1) lo **CONSULTAS como experto** — vas directo a la neurona correcta,
NO lees todo (§G.1 + §G.2); (2) lo **CONSTRUYES y ALIMENTAS bajo tu juicio** (§G.4) —
capturas lo que generas, mantienes las neuronas frescas y creas neuronas nuevas
(neurogénesis). **Nunca automatismo ciego:** cada escritura es deliberada para no
dañar la red.

**Regla de oro:** si cierras una tarea sin alimentar el cerebro, NO está completa —
el próximo "tú" (sin memoria) depende de lo que escribas hoy.

---

## §0 — Mapa de nodos de memoria (índice de enrutamiento)

El cerebro se divide en **nodos**. Auto-cargas SOLO `CLAUDE.md` + `05` + `10` (§G.1); el resto se lee on-demand por trigger (§G.2). Así no quemas contexto.

| Nodo neuronal | Archivo | Auto-carga | Cuándo leerlo |
|---|---|---|---|
| 🧠 **Tronco Encefálico** | `CLAUDE.md` (este) | ✅ Siempre | Router + identidad + doctrinas + gobernanza. |
| 🩺 **Estado Global (signos vitales)** | `docs/05-ESTADO-GLOBAL.md` | ✅ Siempre (boot) | Snapshot de salud: build, versión, branch, flags de riesgo. "¿Dónde estoy parado?" antes de tocar nada. |
| ⚡ **Corto Plazo (WIP)** | `docs/10-MEMORIA-CORTO-PLAZO.md` | ✅ Siempre (2ª lectura) | Sprint actual, pendientes (TODO-NN), bitácora. (El estado técnico vive en 05.) |
| 🛰️ **Consejo Externo** | `docs/15-CONSEJO-EXTERNO.md` | ❌ on-demand | Trigger de Decisión Fuerte: antes de algo caro de revertir (arquitectura, datos, seguridad/legal, fork 50/50, op irreversible), pedir crítica adversarial al **provider externo configurado** (ver `15-CONSEJO-EXTERNO §0`). Cuándo + selección de tier ahí. |
| 🗺️ **Espacial** | `docs/20-MEMORIA-ESPACIAL.md` | ❌ on-demand | Trigger de Desorientación: dónde vive un componente, flujos, arquitectura, SEO, migración. |
| 🧪 **Procedimental (experiencia)** | `docs/30-LECCIONES.md` | ❌ on-demand | Trigger de Experiencia: ANTES de una op riesgosa/repetitiva o si un síntoma "te suena". Gotchas + recetas. |
| 🗂️ **Índice sináptico** | `docs/00-INDICE.md` | ❌ on-demand | ANTES de leer el historial (offset exacto) Y para el enrutamiento semántico (síntoma → neurona). |
| 📚 **Largo Plazo** | `docs/99-HISTORIAL-ADR.md` | ❌ on-demand | Trigger de Error / detalle histórico de un §. NUNCA completo — usa offset/limit. |
| 🎯 **Lóbulos de Dominio** | `docs/40-LOBULOS-DOMINIO.md` | ❌ on-demand | Trigger 🔵 §G.2: registry de dominios especializados; lóbulos hijos (`41-SEGURIDAD`, `42-LEGAL`, etc.) nacen on-demand con contenido real. |
| 🛠️ **Skills externas** | `skills/` + tool Skill | ❌ on-demand | Expertise general de terceros (frameworks portables). NO es neurona — recurso paralelo. Consultar PRIMERO al disparar Trigger 🔵. **Catálogo completo → `docs/skills-inventory.md`** (el repo NO es la fuente de las skills cargadas; ver esa hoja). |
| 📖 **Manual del cerebro** | `docs/INSTALACION-CEREBRO.md` | ❌ on-demand | Protocolo de instalación + reinstalación + migración entre versiones del template. Consulta al actualizar la versión del cerebro. |

**Hojas de detalle** (enlazadas desde su neurona madre, on-demand): nacen cuando hay contenido. Convención de nombre: `docs/<tema>.md` (ej. mapa de dependencias, plan de migración, setup de un subsistema). Cada hoja queda referenciada desde la neurona madre (ej. `20-ESPACIAL` enlaza la hoja de arquitectura) — nada huérfano (§G.5).

### 🏆 Regla de oro anti-saturación (CÓMO leer el Largo Plazo)

NUNCA leas `docs/99-HISTORIAL-ADR.md` completo (puede llegar a 40k+ líneas = muerte por contexto). En su lugar:

1. `Read docs/00-INDICE.md` → encuentra la línea del § que buscas.
2. `Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150` → lee SOLO ese tramo.

> ⚠️ La línea es una **pista, no verdad absoluta** (puede desincronizarse). Si el
> tramo no arranca en el header `## NN` esperado, regenera con `grep -n "^## "` o
> corre `npm run brain:check` (valida el desync automáticamente). Robustez sobre fe ciega.

---

## §1 — Identidad y arquitectura

- **Negocio**: **SGM · TRANSPOWER** — plataforma web para el seguimiento, planificación y control del mantenimiento especializado de transformadores de potencia de AFINIA (CARIBEMAR de la Costa · Grupo EPM) en el Caribe Colombiano (Bolívar, Córdoba, Sucre, Cesar y 11 municipios del Magdalena). Sin ánimo de lucro; todo sobre tiers gratuitos. Referencia normativa activa: **MO.00418.DE-GAC-AX.01 Ed. 02**.
- **Stack**: HTML5 + CSS (variables, sistema de diseño **AQUA LIGHT**) + **JavaScript ES6+ vanilla modular** (sin framework, sin bundler). Dominio puro en `assets/js/domain/` (funciones testables sin Firebase) + data layer en `assets/js/data/`. Tests con `node --test`. Lint con `html-validate`. Gráficas: Chart.js (CDN). Mapas: Leaflet + OSM.
- **Hosting / Deploy**: **GitHub Pages** (auto-deploy de `main` vía workflow `pages.yml`) sirve el sitio estático como *user page* (`powertransformersmj.github.io`). **Vercel** Hobby reservado para serverless `/api/*`. Backend dinámico: **Firebase** (Auth Email/Password + Cloud Firestore + Storage) + **Cloud Functions** (deployables).
- **Project IDs / namespaces**: Firebase project **`lordpowertransformersmj`** (también `authDomain` y `storageBucket`). Repo GitHub `PowertransformersMJ/powertransformersmj.github.io`.
- **Áreas**: (1) **Portal login** `index.html` (login-first, SaaS-style, Firebase Auth); (2) **Sitio interno** `home.html` + `pages/*` (protegido por `session-guard`); (3) **Panel admin** `admin/*` (rol `admin`); (4) **API** `api/*` (Vercel serverless); (5) **Cloud Functions** `functions/`.
- **Roles**: `admin` (control total + CRUD) y `tecnico` (lectura operativa) + roles v2 (`director_proyectos`, `analista_tx`, `gestor_contractual`, `brigadista`, `auditor_campo`). Fuente de verdad en `/usuarios/{uid}` Firestore; bootstrap legacy en `/admins/{uid}`.
- **Deploys manuales (el director ejecuta en su Mac — yo NO tengo auto-deploy de estos 4 canales)**: al tocar `firestore.rules` → `firebase deploy --only firestore:rules`; `firestore.indexes.json` → `firebase deploy --only firestore:indexes`; `storage.rules` → `firebase deploy --only storage`; `functions/*` → `firebase deploy --only functions`. **Regla obligatoria**: avisar al director en el MISMO turno + incluir el bloque «⚠ Requiere deploy» al final del commit message. Detalle en `docs/30-LECCIONES.md`.
- **Publicación (push a GitHub)**: los canales del runtime (`git push` vía proxy, `mcp__github__*`) fallan con 403. Único canal que funciona: `git push https://USER:TOKEN@github.com/...` con PAT clásico del dueño pasado inline en cada push (el proxy resetea el remote entre invocaciones). NUNCA escribir el token a archivo/commit/PR/log; redactar con `sed 's|ghp_[A-Za-z0-9]*|ghp_****REDACTED****|g'`. Detalle + reglas del token en `_legacy/CLAUDE-previo.md §0.1` y `docs/30-LECCIONES.md`.

Detalle profundo de cualquier subsistema → `docs/20-MEMORIA-ESPACIAL.md` + ADRs vía `docs/00-INDICE.md`.

---

## §2 — Protocolo de documentación (OBLIGATORIO en cada commit relevante)

### Dónde documentar

- **WIP / tarea en curso**: se registra en el Corto Plazo (`docs/10-MEMORIA-CORTO-PLAZO.md`).
- **NUEVOS ADRs**: al cerrar una tarea, se APENDEN al final del Largo Plazo (`docs/99-HISTORIAL-ADR.md`) + fila en `docs/00-INDICE.md` (consolidación §G.3). NUNCA a este CLAUDE.md.
- **Este CLAUDE.md**: solo se edita cuando cambia algo always-on (una doctrina, el esquema de nodos, una regla de gobernanza). NUNCA historial ni pendientes ni cache version.

### Cómo documentar (formato canónico ADR)

Cada cambio funcional se documenta con una sección numerada (§NN) que incluye:

Encabezado `## NN. ADR-NNN — <título>` + cita del cliente si reportó, y 7 puntos:
**NN.1** Causa raíz (RCA §3.3, verificada leyendo código) · **NN.2** Solución estructural (de fondo) ·
**NN.3** No-regresión (IDs/funciones/callsites intactos, build OK) · **NN.4** Tests / verificación ·
**NN.5** Anti-patterns evitados (§3) · **NN.6** Archivos modificados/INTACTOS ·
**NN.7** Doctrina aplicada + cache bump (si aplica §4).

### Reglas git

- Crear commits SOLO cuando el usuario lo pida explícitamente.
- `git add` archivos específicos (NUNCA `git add -A` / `.`).
- **Quién commitea**: si el cliente prefiere commitear (GitHub Desktop/web), entrégale el mensaje listo (summary + descripción). Si commiteas tú: HEREDOC + footer `Co-Authored-By: Claude <noreply@anthropic.com>`.
- NUNCA push sin pedido explícito. NUNCA `--amend` / `--no-verify` / `--no-gpg-sign` sin pedido.
- NUNCA commitear secrets (.env, credentials.json, *.pem).
- Al cerrar un pendiente, marcar su `TODO-NN` como ✅ + link al §X. Mantén este CLAUDE.md liviano.

---

## §3 — Doctrinas always-on (resumen ejecutable)

### 3.1 Performance (cuando aplique al stack)
- NUNCA `transition: all` ni `* { transition }` global (web).
- NUNCA animar layout props (width/height/top/left/margin/padding) — solo `transform`/`opacity`.
- NUNCA `backdrop-filter` en listas de N elementos (solo superficies estructurales).
- Imágenes web: `loading="lazy"` + `decoding="async"` below-fold; `fetchpriority="high"` solo LCP.

### 3.2 HTML/CSS / API estable
- NUNCA renombrar IDs/clases/endpoints/funciones exportadas existentes sin migración. Cambios aditivos.
- Para sustituir un campo manteniendo callsites: alias + deprecación gradual.
- Preservar nombres de función exportados (callsites externos dependen).

### 3.3 Verifica, no asumas — evidencia antes de afirmar (UNIVERSAL)
- Antes de afirmar CUALQUIER hecho (código, git/remoto, config, estado, tus capacidades): cita la evidencia que leíste ESTE turno (archivo/comando). Si no lo verificaste → di "no verificado/creo" o ve a verificar. Caso código: LEE los paths ANTES de tocar.
- Bug recurrente o síntoma que no encaja: telemetría → diagnóstico → reporte → STOP → autorización → fix.
- Git: NUNCA afirmar estado de despliegue sin `git fetch` (refs `origin/*` locales son STALE).

### 3.4 IAP — Impact Analysis Previo
Antes de CUALQUIER commit no-trivial: 5 secciones → (A) archivos a modificar, (B) archivos INTACTOS verificados, (C) código muerto identificado, (D) refactor scope, (E) riesgos + rollback + tests.

### 3.5 Observadores y eventos globales
- CERO `MutationObserver` global con `subtree:true` que ejecute ops DOM (causa clicks bloqueados / loops). Usar refresh explícito desde el callsite.
- CERO `pointermove` persistente global (solo durante drag activo).
- Selectores substring `[class*="x"]` son peligrosos — matchean clases hijas; excluir namespaces con `:not()`.

---

## §4 — Cache / Service Worker

> El proyecto NO tiene service-worker activo. `sw.js` existe en la raíz como
> **kill-switch** (se auto-desregistra y limpia caches al activarse — PWA
> offline-first desactivada a propósito, ver `docs/05-ESTADO-GLOBAL.md`). No hay
> `CACHE_VERSION` que bumpear. Si en el futuro se reactiva la PWA, restaurar el
> protocolo de bump aquí y registrar la versión vigente en `05`.

---

## §G — Gobernanza Neuronal (sistema nervioso · cómo operas la memoria)

Esta sección es tu sistema nervioso. Define qué lees, cuándo escalas y cómo
consolidas. **Es vinculante.**

### G.1 — Directiva de Ignorancia Selectiva (arranque de sesión)

Al iniciar una conversación nueva estás **estrictamente obligado** a leer SOLO:

1. `CLAUDE.md` (este — auto-cargado): quién eres + cómo operar.
2. `docs/05-ESTADO-GLOBAL.md`: en qué estado está el sistema AHORA.
3. `docs/10-MEMORIA-CORTO-PLAZO.md` (el WIP vivo): en qué estabas trabajando.

Al arrancar, **imprime 2-3 líneas de signos vitales** (build, versión, branch, flags) de `05` — procesarlos te obliga a saber dónde estás parado antes de tocar código.

**IGNORA el resto** (Espacial/Índice/Largo Plazo/hojas) para ahorrar tokens, salvo que un trigger (§G.2) o el usuario lo pida. No leas el historial "por si acaso".

### G.2 — Triggers de Recuperación (Escalation Path)

Cuando se dispara un trigger, leer el nodo correspondiente deja de ser opcional:

- **🔴 Trigger de Error / Saturación**: si fallas **2 veces** corrigiendo el mismo bug, estás OBLIGADO a DETENERTE y leer el **Largo Plazo** (`docs/00-INDICE.md` → tramo de `docs/99-HISTORIAL-ADR.md`) buscando el § o un bug análogo ANTES de la 3ª solución (prohibido adivinar, §3.3). Y si detectas **loops circulares o contexto saturado** (atención degradada): igual DETENTE, consolida `10` (con sus 🚫 callejones sin salida) y ofrece un **relevo curado** (sesión nueva > `/compact` para lógica compleja). Medir por SÍNTOMA, no por contador de turnos.
- **🟡 Trigger de Desorientación**: si dudas de DÓNDE vive un componente, una ruta, un flujo de datos o cómo interactúan los módulos, estás OBLIGADO a consultar la **Memoria Espacial** (`docs/20-MEMORIA-ESPACIAL.md`) antes de tocar nada.
- **🧪 Trigger de Experiencia**: ANTES de una operación riesgosa o repetitiva (mover/renombrar archivos, merge/rebase, tocar el cron o la cache, refactor), consulta la **Memoria Procedimental** (`docs/30-LECCIONES.md`). Si un síntoma "te suena a algo ya visto", ahí está la receta. No tropieces dos veces con la misma piedra.
- **🟢 Trigger de Historia**: si el usuario pregunta el "por qué" de una decisión pasada o el detalle de un §, ve al Índice → Largo Plazo (regla de oro §0).
- **🔵 Trigger de Auditoría/Dominio**: si el cliente pide análisis especializado (seguridad/legal/UX/SEO/perf/escalabilidad/copy/a11y/etc.) → (1) skill relevante vía tool Skill (catálogo `docs/skills-inventory.md`); (2) `40-LOBULOS` por lóbulo; (3) si no, neurogénesis del hijo (`41`,`42`…) CON contenido REAL, nunca vacío (§G.4); (4) capturar findings + QUÉ skill usé. Persiste.
- **🛰️ Trigger de Decisión Fuerte**: ANTES de una decisión cara de revertir (arquitectura, modelo de datos, seguridad/legal, fork 50/50, op irreversible) considera crítica adversarial del **provider externo configurado** en `docs/15-CONSEJO-EXTERNO.md §0` (de otra familia, no-Claude). Allí está cuándo + matriz de tier + anti-anclaje. Sin provider activo / sin tokens → sigo solo + marco la decisión como NO revisada externamente.

**Enrutamiento semántico**: ante una duda, NO escanees el cerebro. Ve al `docs/00-INDICE.md` (capa "síntoma/tema → neurona") que te dice EXACTAMENTE qué neurona consultar. Es tu sinapsis de recuperación rápida.

### G.3 — Protocolo de Consolidación (sinapsis)

La memoria fluye en una sola dirección: Corto Plazo → Largo Plazo.

- **Por cada commit / tarea finalizada**: actualiza `docs/10-MEMORIA-CORTO-PLAZO.md` (foco actual, bitácora, estado de TODO-NN).
- **Cuando una tarea se cierra por completo**: MUEVE ese recuerdo del Corto Plazo al Largo Plazo — apéndalo como ADR `§NN` al final de `docs/99-HISTORIAL-ADR.md` (formato canónico §2), añade su fila en `docs/00-INDICE.md`, marca su `TODO-NN` como ✅ con link al §, y retíralo de la tabla de pendientes del Corto Plazo.
- **Regla de Oro**: NUNCA documentes historial ni tareas en este `CLAUDE.md`. Cada pieza de información tiene su nodo. Este archivo solo cambia si cambia algo always-on.

### G.4 — Sistema Autónomo de Auto-construcción (neuroplasticidad, bajo TU guía)

El cerebro se mantiene y CRECE solo — pero **nunca sin ti**. Tú, el constructor y guardián, ejecutas estos reflejos con juicio y cuidado para que la red se fortalezca sin dañarse. Son VINCULANTES y se disparan durante el trabajo normal, **sin que el usuario los pida**:

- **Reflejo de Captura (auto-alimentación)**: TODO conocimiento reutilizable que generes o descubras se escribe en su neurona ANTES de cerrar la tarea. Bug / causa-raíz / lección → `30-LECCIONES`. Cambio de arquitectura → `20-ESPACIAL`. WIP / estado → `10-CORTO-PLAZO`. Decisión cerrada → `99-HISTORIAL` (ADR §NN) + fila en `00-INDICE`.
- **Reflejo de Neurogénesis (crear neurona nueva)**: si un conocimiento reutilizable NO encaja en ninguna neurona Y es una categoría que crecerá (no un caso aislado), CREA `docs/NN-NOMBRE.md`. Al nacer una neurona DEBES, en el mismo acto: (1) fila en la tabla §0, (2) registrarla en el mapa de neuronas de `00-INDICE`, (3) anotarla en la bitácora. **Anti-fragmentación**: si dudas, apéndalo a una neurona existente. Una neurona huérfana (sin registrar) es un daño a la red. **Lóbulos de Dominio (`40-LOBULOS-DOMINIO`)**: análisis especializados nacen como lóbulos hijos (`41-SEGURIDAD`, `42-LEGAL`, etc.) bajo Trigger 🔵 §G.2, SOLO con contenido real de una auditoría concreta — nunca archivos vacíos por anticipado.
- **Reflejo de Frescura**: si mueves/creas/renombras/eliminas un componente, ruta o flujo, actualiza `20-ESPACIAL` (+ hoja de detalle afectada) en el MISMO cambio. Una neurona vieja engaña al próximo "tú" → reproceso/regresión.
- **Reflejo de Higiene = Garbage Collector (cuantificado, no opcional)**: `10-CORTO-PLAZO` es pizarra (cap ~110, §G.5). **Al cerrar una tarea, si `10` supera su cap → PODA OBLIGATORIA**: (1) consolida cada tarea CERRADA como ADR §NN en `99` + fila en `00-INDICE`, (2) extrae sus lecciones a `30`, (3) actualiza `05` si cambió el estado, (4) recorta `10` dejando SOLO el foco vivo + pendientes abiertos. ⛔ Nunca volcar a `99` sin convertir en ADR (eso es basura, no consolidación).
- **Reflejo de Auto-auditoría (arranque Y pre-cierre de sesión)**: corre **`npm run brain:check`** (linter: huérfanas, caps, desync del índice). **Al ARRANCAR** (tras leer CLAUDE.md+`05`+`10`): si reporta problemas o `05`/`10` están viejos / hay tarea sin consolidar, arréglalos ANTES de la tarea. **Antes de CERRAR la sesión o quedar idle — PROACTIVO**: barrido holístico de TODO el cerebro (brain:check + **frescura vs git real** commit/branch + nada huérfano/stale) → que la próxima sesión herede un cerebro impecable.
- **Reflejo de Auto-mejora**: llena VACÍOS. Si detectas fricción (re-investigaste algo ya sabido, faltó un índice o lección), MEJORA el cerebro ahí mismo: crea lo que faltaba.
- **Reflejo de Autocrítica (post-mortem reactivo)**: si el cerebro contribuyó a un error → (1) nombra el DEFECTO (neurona stale / regla mala / routing errado / sobre-fragmentación), (2) corrige en su nodo (bajo límite de guardián), (3) registra meta-aprendizaje en `30 §Meta`; si toca gobernanza → ADR en `99` + flag en `05`. Solo ante error/fricción real, NUNCA auto-duda en bucle. *Un cerebro equivocado es peor que uno incompleto.*
- **Reflejo de Desafío Crítico (proactivo)**: puedes cuestionar una regla/skill/neurona del cerebro si tienes EVIDENCIA verificable (no intuición). Protocolo: (1) nombra la regla, (2) evidencia, (3) propuesta de reemplazo, (4) si convincente y no destructivo → aplica como Auto-mejora; si toca gobernanza → ADR en `99`. **Cuestionar con evidencia ≠ ignorar a voluntad.**
- **Reflejo de Cierre (anti-patrón "lo documento después")**: una tarea NO está cerrada hasta verificar **concretamente**: ¿`10` refleja el progreso (TODO-NN)? · ¿`05` actualizado si cambió la salud? · ¿decisión cerrada → ADR §NN en `99` + fila en `00`? · ¿lección reutilizable → `30` con disparador? · ¿cambio de comportamiento → cache bumpeado §4 si aplica? · ¿`npm run brain:check` SANO? · ¿si fue auditoría especializada, lóbulo hijo creado/actualizado + skills consultadas registradas? Si falta cualquiera, vuelve y hazlo ANTES de pasar a la siguiente. Decir "ya casi" sin alimentar el cerebro = el próximo "tú" sin memoria sufre re-investigando.
- **Reflejo de Sugerencia de Skills (§40)**: si aprendes una capacidad/framework REUSABLE y PORTABLE (sirve en cualquier proyecto, NO específica de ESTE proyecto → eso va al cerebro), SUGIERE crear una skill vía `skill-creator`; el cliente decide. **Skill = capacidad general; neurona/lóbulo = conocimiento del proyecto.** Flujo + registro en `40-LOBULOS`.

**🛡️ Límite de guardián (cuidado ante todo)**: los reflejos ENRIQUECEN, nunca borran a la ligera. Eliminar o reescribir conocimiento histórico exige certeza verificada (§3.3). Ante la duda: **apendar, no sobrescribir; cuarentenar en `_legacy/`, no borrar.** Proteger la red es prioritario sobre alimentarla.

### G.5 — Capacidad de neuronas y Sharding (economía de contexto)

Una neurona sobrecargada satura el contexto. Cada neurona tiene un TOPE BLANDO (señal, no muro):

| Neurona | Carga | Tope | Al acercarse al tope |
|---|---|---|---|
| `CLAUDE.md` | 🔴 auto (siempre) | ~320 líneas | Núcleo de gobernanza. Más crecimiento DEBE desplazar detalle a una neurona, NO volver a subir el tope. Jamás historial/tareas/cache. |
| `05-ESTADO-GLOBAL` | 🔴 auto (siempre) | ~25 líneas | Es un tablero, no bitácora. Solo señales vitales actuales (pisar, no apilar). |
| `10-CORTO-PLAZO` | 🔴 auto (siempre) | ~110 líneas | Higiene §G.4 (GC): consolidar a `99`/`30`, recortar al foco vivo. |
| `20-ESPACIAL` | 🟡 on-demand entera | ~280 líneas | Shard: extraer sub-área a neurona hermana (ej. `21-ESPACIAL-ADMIN.md`). |
| `30-LECCIONES` | 🟡 on-demand entera | ~350 líneas | Shard por categoría (ej. `31-LECCIONES-GIT.md`). |
| `00-INDICE` | 🟡 on-demand | ~450 líneas | Es tabla escaneable; dividir el mapa § por rangos si molesta. |
| `99-HISTORIAL` | 🟢 on-demand por offset | sin tope* | *NUNCA leer entero (solo `offset/limit` vía índice). Si >50k líneas, shard en volúmenes `99a/99b` por rango de §. |
| hojas de detalle | 🟡 on-demand | ~300 c/u | Shard. |

**Reflejo de Sharding (neurogénesis por SATURACIÓN)**: cuando una neurona se acerca a su tope, NO la dejes engordar. Extrae una sub-categoría coherente a una neurona hermana nueva `docs/NN-NOMBRE.md`. Como toda neurona nueva (§G.4 Neurogénesis): (1) fila en la tabla §0, (2) registro en `00-INDICE`, (3) **deja en la neurona MADRE un puntero a la hija**. 🔗 **Nada huérfano: si una neurona existe y `CLAUDE.md` no la conoce, el cerebro está roto.** La conexión ES tan importante como el contenido.

---

## §7 — Cómo retomar (recap rápido)

1. **Boot** (§G.1 + §0.0): lee `CLAUDE.md` + `05` + `10` + auto-auditoría `brain:check` (§G.4); imprime los signos vitales. "¿Qué hay pendiente?" → TODO-NN del Corto Plazo.
2. **Triggers** (§G.2): desorientación → `20`; op riesgosa/repetitiva → `30`; "por qué"/detalle de un § o 2 fallos seguidos → Índice `00` → Largo Plazo `99`; auditoría especializada → Skill + `40` (+ lóbulo hijo); decisión cara de revertir → `15`.
3. **Antes de tocar código**: IAP §3.4. **Antes de commit**: §2. **Tras CADA tarea**: alimenta el cerebro (§G.4) + cache bump §4 (si aplica).
4. **Entorno**: rellenar en §1 (OS, shell, working dir, cómo invalidar cache cliente).
