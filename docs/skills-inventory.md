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

**Leyenda Disp.**: ✅ contraparte instalada usable vía `Skill` · ⚠️ repo-only (no instalada) · 🔧 anomalía estructural (no carga tal cual).

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

## ✅ Cómo usar este catálogo

1. **Trigger 🔵 (`CLAUDE.md §G.2`)** dispara: el cliente pide análisis especializado.
2. Vienes a este archivo y al `40-LOBULOS-DOMINIO §Recursos Externos`.
3. Identificas la skill del dominio. Verifica que esté ✅ (instalada). Si solo aparece en `skills/` del repo (⚠️ repo-only), NO la invoques vía `Skill` — léela como referencia.
4. Invocas la skill vía tool `Skill` con el nombre exacto.
5. La aplicas al código del proyecto y capturas findings en el lóbulo hijo (`41-*..49-*`), registrando QUÉ skill usaste.

**Mantenimiento (Reflejo de Frescura)**: si agregas/quitas una carpeta en `skills/` o instalas una skill nueva, actualiza este catálogo en el mismo cambio. El cliente puede ampliar la carpeta `skills/` libremente (curaduría); este catálogo refleja lo que hay.
