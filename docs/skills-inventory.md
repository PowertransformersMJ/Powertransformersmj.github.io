# 🛠️ Inventario de Skills (catálogo del repo `skills/`)

> **Hoja de detalle** (no neurona) enlazada desde `40-LOBULOS-DOMINIO.md §Recursos
> Externos`. Catálogo completo de las skills que viven en `skills/` del repo, para
> consultar al disparar **Trigger 🔵 §G.2** ("¿qué skill tengo para X?"). On-demand:
> NO se auto-carga. Mantener al añadir/quitar/renombrar una skill (Reflejo de Frescura `CLAUDE.md §G.4`).

---

## ⚠️ Verdad del wiring (leer primero — corrige un supuesto común)

`skills/` del repo **NO es la fuente** de las skills que Claude tiene cargadas en sesión.

- `~/.claude/settings.json` (config del usuario) → habilita plugins instalados (típicamente `superpowers@claude-plugins-official`).
- `~/.claude/skills/` (user-level) → skills extra instaladas localmente (ej. `crm-architect`).
- El namespace `anthropic-skills:*` que Claude ve es **bundle del entorno/build** (set oficial de Anthropic), independiente del repo.

**Conclusión**: el solape de nombres entre `skills/` (repo) y las skills cargadas es **curaduría** (el repo se compone a partir de esos mismos sets). El repo es un **recurso de referencia paralelo** (como dice `40-LOBULOS §Recursos Externos`), NO el origen de las capacidades. Implicaciones:

- La mayoría de skills del repo **SÍ tienen contraparte usable** vía tool `Skill` (✅ abajo).
- Algunas son **"repo-only"** (⚠️): NO hay contraparte instalada → invocarlas vía `Skill` fallaría; sirven como documentación/fuente.
- **Anomalías estructurales** (🔧) NO romperían la config (el repo no es la fuente), pero ensucian el repo y romperían la carga **si algún día** se cablea `skills/` como plugin.

**Leyenda Disp.**: ✅ contraparte instalada usable vía `Skill` · 🟩 staged local en `.claude/skills/` (activa tras reinicio, ver §Estado real) · ⚠️ repo-only (no instalada) · 🔧 anomalía estructural (no carga tal cual).

---

## 📍 Estado real de activación (auditado 2026-06-04 · ADR-002)

> **Corrección importante**: las tablas de abajo marcaban con ✅ varias skills de
> **diseño/UX** (`frontend-design`, `impeccable`, `emil-design-eng`, el bundle taste, etc.)
> que en realidad NO estaban en la interfaz — eran **repo-only**. Auditoría de solape real:
> **56** skills del repo SÍ tenían contraparte en el bundle `anthropic-skills:*`; **24** eran
> repo-only. Esas 24 se **staged a `.claude/skills/`** (`name` del frontmatter como nombre de
> carpeta) y cargan **tras reiniciar Claude Code**. Receta → `30-LECCIONES L-19`.

**🟩 Las 24 ahora staged localmente** (verificadas activas tras reinicio):
`accessibility-audit`, `animate`, `frontend-design`, `impeccable`, `emil-design-eng`,
`design-taste-frontend` (+`-v1`), `redesign-existing-projects`, `minimalist-ui`,
`industrial-brutalist-ui`, `high-end-visual-design`, `brandkit`, `stitch-design-taste`,
`gpt-taste`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`,
`full-output-enforcement`, `ecommerce`, `crm-architect`, `claude-automation-recommender`,
`claude-md-improver`, `session-report`, `llm-council`.

**Notas**: `canvas-design-creative` SÍ está en el bundle (✅, no fue necesario stagearla).
`code-modernization` (plugin) y `code-simplifier` (subagente) NO se pueden activar como skill
— sin `SKILL.md`; el built-in `simplify` cubre el segundo. **Persistencia**: `.claude/` está
gitignorado → estas 24 son **local-only**; al re-clonar, re-correr el copy (la fuente vive en `skills/`).

---

## 🧬 Proceso / Desarrollo (superpowers + dev)

> Las skills de `superpowers` están **doble-disponibles** (`superpowers:` y `anthropic-skills:`).

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `brainstorming` | Explorar intención/requisitos ANTES de construir | ✅ |
| `writing-plans` | Escribir plan de implementación multi-paso | ✅ |
| `executing-plans` | Ejecutar un plan con checkpoints de revisión | ✅ |
| `subagent-driven-development` | Ejecutar plan con subagentes en la sesión | ✅ |
| `dispatching-parallel-agents` | Despachar 2+ tareas independientes en paralelo | ✅ |
| `test-driven-development` | TDD: test antes que implementación | ✅ |
| `systematic-debugging` | Debug metódico ante bug/fallo/comportamiento raro | ✅ |
| `verification-before-completion` | Verificar antes de declarar "hecho" | ✅ |
| `requesting-code-review` | Pedir revisión de código | ✅ |
| `receiving-code-review` | Recibir/aplicar feedback de revisión | ✅ |
| `finishing-a-development-branch` | Cerrar una rama de desarrollo | ✅ |
| `using-git-worktrees` | Trabajar con git worktrees aislados | ✅ |
| `using-superpowers` | Cómo descubrir/usar skills (boot) | ✅ |
| `writing-skills` | Escribir/editar skills | ✅ |
| `skill-creator` | Crear/optimizar/evaluar skills | ✅ |
| `code-simplifier` | (definición de SUBAGENTE en el repo, NO `SKILL.md`) | ⚠️🔧 |
| `code-modernization` | (PLUGIN de comandos/agentes en el repo, NO skill) | ⚠️🔧 |

---

## 🎨 Diseño / UX / Frontend

> El "taste bundle" vive **anidado** en `taste-skill-main/<sub>/SKILL.md` (varias skills en una carpeta).

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `frontend-design` | UI front-end production-grade, anti-genérico | ✅ |
| `impeccable` | Diseñar/auditar/pulir interfaces (UX, jerarquía, motion) | ✅ |
| `emil-design-eng` | Filosofía Emil Kowalski: pulido fino de UI | ✅ |
| `animate` | Animaciones/transiciones web (React/Next) | ✅ |
| `design-taste-frontend` | Anti-slop: landing/portfolio/redesign con gusto | ✅ |
| `redesign-existing-projects` | Elevar a premium sin romper funcionalidad | ✅ |
| `minimalist-ui` | Estética minimalista | ✅ |
| `industrial-brutalist-ui` | Estética brutalista industrial | ✅ |
| `high-end-visual-design` | Diseño visual high-end | ✅ |
| `brandkit` | Brand boards / sistemas de identidad | ✅ |
| `stitch-design-taste` | Gusto de diseño con Stitch | ✅ |
| `gpt-taste` | Criterio de diseño estilo GPT | ✅ |
| `image-to-code` | Convertir imagen → código UI | ✅ |
| `imagegen-frontend-web` | Generación de imágenes para front web | ✅ |
| `imagegen-frontend-mobile` | Idem mobile | ✅ |
| `full-output-enforcement` | Forzar salida completa (anti-truncado) | ✅ |
| `canvas-design-creative` | Arte/posters/PDF/PNG por filosofía de diseño | ✅ |
| `accessibility-audit` | Framework WCAG 2.2 AA portable (auditoría a11y) | ✅ |

---

## 🔍 SEO / Contenido / Arquitectura de sitio

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `seo-audit` | Auditoría SEO técnica/on-page | ✅ |
| `ai-seo` | Optimizar para motores de IA (AEO/GEO) | ✅ |
| `schema-markup` | Datos estructurados / rich snippets | ✅ |
| `programmatic-seo` | SEO programático a escala | ✅ |
| `site-architecture` | Arquitectura de información del sitio | ✅ |
| `content-strategy` | Estrategia de contenido / topic clusters | ✅ |
| `competitor-alternatives` | Páginas "vs"/alternativas (SEO+ventas) | ✅ |

---

## 📣 Marketing / Growth / Conversión (CRO)

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `copywriting` | Copy de páginas (hero, pricing, CTAs) | ✅ |
| `copy-editing` | Editar/pulir copy existente | ✅ |
| `ad-creative` | Creatividades/variaciones de anuncios | ✅ |
| `cold-email` | Cold email B2B + secuencias | ✅ |
| `email-sequence` | Secuencias de email lifecycle/warm | ✅ |
| `social-content` | Contenido para redes | ✅ |
| `marketing-ideas` | Ideación de marketing | ✅ |
| `marketing-psychology` | Palancas psicológicas de marketing | ✅ |
| `community-marketing` | Construir/crecer comunidad | ✅ |
| `launch-strategy` | Estrategia de lanzamiento | ✅ |
| `lead-magnets` | Imanes de leads | ✅ |
| `free-tool-strategy` | Herramientas gratis como growth | ✅ |
| `referral-program` | Programas de referidos | ✅ |
| `paid-ads` | Estrategia/targeting de paid ads | ✅ |
| `pricing-strategy` | Estrategia de precios | ✅ |
| `product-marketing-context` | Contexto de product marketing | ✅ |
| `revops` | Revenue operations | ✅ |
| `customer-research` | Investigación de clientes / VOC / ICP | ✅ |
| `churn-prevention` | Reducir churn / flujos de cancelación | ✅ |
| `ab-test-setup` | Diseñar A/B tests y experimentación | ✅ |
| `analytics-tracking` | Tracking/medición (GA4, eventos) | ✅ |
| `page-cro` | CRO a nivel página | ✅ |
| `form-cro` | CRO de formularios | ✅ |
| `popup-cro` | CRO de popups | ✅ |
| `onboarding-cro` | CRO de onboarding | ✅ |
| `signup-flow-cro` | CRO del flujo de registro | ✅ |
| `paywall-upgrade-cro` | CRO de paywall/upgrade in-app | ✅ |
| `ecommerce` | Patrones de e-commerce | ✅ |

---

## 🌐 Investigación web / Firecrawl / Council

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `firecrawl` | Firecrawl CLI | ✅ |
| `firecrawl-agent` | Agente Firecrawl | ✅ |
| `firecrawl-crawl` | Crawl de sitios | ✅ |
| `firecrawl-scrape` | Scrape de páginas | ✅ |
| `firecrawl-search` | Búsqueda web | ✅ |
| `firecrawl-map` | Mapear URLs de un sitio | ✅ |
| `firecrawl-download` | Descargar contenido | ✅ |
| `firecrawl-interact` | Interacción con páginas | ✅ |
| `llm-council` | Panel de varios LLMs para deliberar | ✅ |

---

## 🏗️ Construcción de productos verticales

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `crm-architect` | Framework para CONSTRUIR CRMs sobre Firebase + Firestore + Cloud Functions (vertical automotive-dealership incluido, RBAC + GDPR/Ley 1581). | ✅ user+bundle (si está instalada) |
| `asesor-critico-honesto` | Feedback crítico honesto sobre ideas/planes (es) | ✅ |

---

## 🧰 Meta Claude Code (repo-only — NO instaladas)

| Skill (name) | Para qué | Disp. |
|---|---|---|
| `claude-automation-recommender` | Analiza el repo y recomienda automatizaciones de Claude Code (hooks/subagentes/skills/plugins/MCP). Read-only. | ⚠️ repo-only |
| `claude-md-improver` | Audita y mejora archivos CLAUDE.md contra plantillas. | ⚠️ repo-only |
| `session-report` | Genera reporte HTML de uso de sesiones Claude Code (tokens/cache/subagentes). | ⚠️ repo-only |

---

## ⚡ Pruebas Eléctricas (project-specific — construidas in-house)

> A diferencia del resto del catálogo (terceros, portables), estas son **del proyecto**:
> criterios AFINIA/NETA aterrizados al schema del tablero. Viven SOLO en `skills/pruebas-electricas/`
> (no hay contraparte de bundle). Lóbulo madre con las decisiones: **`docs/49-PRUEBAS-ELECTRICAS.md`**.
> Patrón: `SKILL.md` + 4 neuronas `references/` (teoría/cálculos/criterios/diagnóstico) + `_conocimiento/`
> compartido (tablas NETA). Disp. 🏠 = repo-only del proyecto.

| Skill (carpeta) | Para qué | Disp. |
|---|---|---|
| `resistencia-aislamiento` | IR · DAR · PI: corrección de temp a 20 °C + criterio NETA por clase + diagnóstico de humedad | 🏠 ✅ ejemplar completa |
| `relacion-transformacion`, `corriente-excitacion`, `resistencia-devanados`, `factor-potencia-aislamiento`, `factor-potencia-bujes`, `resistencia-aislamiento-nucleo`, `reactancia-dispersion`, `sfra`, `cambiador-tomas-ltc`, `analisis-aceite`, `dga`, `dfr-respuesta-dielectrica` | resto de la batería 7.2.2 | 🏠 ✅ completas (4 neuronas c/u) |

> **3 marcos compartidos** en `_conocimiento/` que toda skill referencia: `marco-normativo-multinorma.md`
> (evaluar con varias normas a la vez), `diagnostico-integrado-bateria.md` (convergencia cross-test),
> `gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo). Valores `⚠️ verificar` pendientes
> de confirmar contra la edición de norma del director → `docs/49-PRUEBAS-ELECTRICAS.md`.

---

## 🏭 Transformadores de Potencia · EQUIPO (project-specific — construidas in-house)

> Familia hermana de `pruebas-electricas`, pero sobre el **EQUIPO** (qué es, de qué tipo, qué
> cálculos nominales/de placa le aplican), no los ensayos. Viven en `skills/transformadores-potencia/`.
> Lóbulo madre con las decisiones: **`docs/50-TRANSFORMADORES-POTENCIA.md`**. Mismo patrón:
> `SKILL.md` + 4 neuronas `references/` + `_conocimiento/` compartido. Disp. 🏠 = repo-only del proyecto.
> Índice maestro de la familia: `skills/transformadores-potencia/README.md`. Arquitectura de 11 skills
> **validada por el director (2026-06-08) y COMPLETA (11/11, 2026-06-09)** — cada una `SKILL.md` + 4 neuronas.

| Skill (carpeta) | Para qué | Disp. |
|---|---|---|
| `identificacion-tipo-transformador` | Tipificar: bidevanado / bi+compensación (delta estabilización) / tridevanado / auto; deriva qué relación, qué impedancia y qué secuencia cero aplican | 🏠 ✅ ejemplar |
| `grupo-vectorial-conexiones` | Grupo Dyn/YNd/YNyn0d, desfase horario, ANSI↔IEC, polaridad, paralelo, compensación 87T | 🏠 ✅ |
| `calculos-nominales` | I nominal, S/I por etapa de enfriamiento, relación con √3 por conexión, V/espira | 🏠 ✅ |
| `impedancia-cortocircuito` | %Z, base común, estrella equivalente (3 ramas), secuencia cero, I_cc, reparto de carga | 🏠 ✅ |
| `placa-caracteristica` | Auditar nameplate, coherencias cruzadas, identidad por informe (móviles/multiconfig) | 🏠 ✅ |
| `regulacion-tomas` | OLTC vs DETC (seguridad), V_toma(n), efecto en %Z, modos, prueba DRM | 🏠 ✅ |
| `sistema-refrigeracion` | Notación IEEE 4 letras, etapas=potencia, "etapa ≠ MVA gratis", I por etapa, termografía | 🏠 ✅ |
| `construccion-nucleo-devanados` | Shell/core form, 3/5 columnas (Z0), tipos de devanado, fuerzas ∝I² (telescopeo/pandeo), FRA | 🏠 ✅ |
| `bujes-y-accesorios` | Bujes condensador OIP/RIP/RBP, C1/C2, FP de buje, tap capacitivo; conservador, Buchholz, sobrepresión, imagen térmica | 🏠 ✅ |
| `gestion-vida-activo` | Papel/DP (1000-1200→150-250), hot-spot IEEE C57.91, Montsinger, cargabilidad, MTMP/condición | 🏠 ✅ |
| `modos-falla-diagnostico` | Esfuerzos (E/T/M/Q) → deterioro → modos de falla; mapa síntoma→ensayo→lóbulo (integrador) | 🏠 ✅ |

> **3 marcos compartidos** en `_conocimiento/`: `00-fundamentos-transformador.md`,
> `marco-normativo-tx.md`, `convenciones-calculo.md`. ✅ **EG + ABB ingeridos** (2026-06-08, vía
> subagentes). Valores `⚠️ verificar` y tablas [ILEGIBLES] pendientes → `docs/50-TRANSFORMADORES-POTENCIA.md`.

---

## ✅ Cómo usar este catálogo

1. **Trigger 🔵 (`CLAUDE.md §G.2`)** dispara: el cliente pide análisis especializado.
2. Vienes a este archivo y al `40-LOBULOS-DOMINIO §Recursos Externos`.
3. Identificas la skill del dominio. Verifica que esté ✅ (instalada). Si solo aparece en `skills/` del repo (⚠️ repo-only), NO la invoques vía `Skill` — léela como referencia.
4. Invocas la skill vía tool `Skill` con el nombre exacto.
5. La aplicas al código del proyecto y capturas findings en el lóbulo hijo (`41-*..49-*`), registrando QUÉ skill usaste.

**Mantenimiento (Reflejo de Frescura)**: si agregas/quitas una carpeta en `skills/` o instalas una skill nueva, actualiza este catálogo en el mismo cambio. El cliente puede ampliar la carpeta `skills/` libremente (curaduría); este catálogo refleja lo que hay.
