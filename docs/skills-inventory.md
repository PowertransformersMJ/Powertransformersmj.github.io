# 🛠️ skills-inventory — Catálogo de skills y agents

> Hoja de detalle referenciada desde `CLAUDE.md §0`. Regenerable: `node <scratchpad>/gen-skills-inventory.mjs`
> (generado 2026-07-18, instalación brain-kit v1.0 — ADR-051). El linter #6 exige que TODA carpeta
> de `skills/` del repo aparezca aquí. Skill nueva instalada → fila aquí en el MISMO cambio (§G.4).

## 1 · Skills de MÉTODO del brain-kit (viven en `~/.claude/skills/` — nivel usuario, portables)

| Skill | Qué hace |
|---|---|
| `accessibility-audit` | >- |
| `ad-creative` | When the user wants to generate, iterate, or scale ad creative — headlines, descriptions, primary text, or full ad variations — for any paid advertis… |
| `anti-codigo-muerto` | Usar SIEMPRE al estrenar/fix/mejorar código que REEMPLAZA algo viejo — antes de cerrar el cambio. Evita el síndrome Knight Capital (el "8º servidor":… |
| `arquitecto-software` | Piensa como ARQUITECTO DE SOFTWARE ANTES de escribir o corregir código en webs y apps. Aplica en CUALQUIER trabajo de código no trivial: implementar… |
| `asesor-critico-honesto` | Activar cuando el usuario pide feedback, evalúa una idea, comparte un plan/estrategia/contenido/diseño, o pregunta "¿qué te parece?", "¿está bien?",… |
| `auditoria-cerebro` | Auditoría profunda Nivel-2 del cerebro documental del proyecto activo — lo que el linter estructural NO puede medir (fidelidad, frescura, función). S… |
| `auditoria-financiera` | Usar cuando haya que AUDITAR flujos de dinero de un sistema (POS/caja, pagos online, stock con valor, arqueos, saldos, reembolsos) buscando fugas, du… |
| `caza-bugs` | Usar al TOCAR o ROZAR un subsistema con estado observable (render, listener/onSnapshot, CRUD, flujo de pasos) — editarlo, refactorizarlo con cambio d… |
| `claude-automation-recommender` | Analyze a codebase and recommend Claude Code automations (hooks, subagents, skills, plugins, MCP servers). Use when user asks for automation recommen… |
| `claude-md-improver` | Audit and improve CLAUDE.md files in repositories. Use when user asks to check, audit, update, improve, or fix CLAUDE.md files. Scans for all CLAUDE.… |
| `cms-dinamico` | Usar al construir o EXTENDER un CMS donde el contenido de la web pública se administra desde un panel — migrar contenido HARDCODED a una base de dato… |
| `comite-expertos` | Monta un comité de expertos que MEJORA ×3 la última respuesta de Claude. Infiere SOLO qué expertos convienen según el tema (no son fijos), los hace c… |
| `crm-architect` | >- |
| `ga4-lead-tracking` | Medir lo que importa en un negocio offline/bajo-consulta (joya, carro, inmueble) con GA4 — el LEAD, no `purchase` — con Consent Mode v2 (Ley 1581 Col… |
| `image` | When the user wants to create, generate, edit, or optimize images for marketing — blog heroes, social graphics, product mockups, profile banners, lis… |
| `image-pipeline` | Optimizar imágenes en el BUILD para velocidad (Core Web Vitals) + SEO de imagen + señal local — porque en joyería/autos/inmuebles la imagen ES el pro… |
| `legal-colombia` | Guardrail + método para CUALQUIER tarea legal de un negocio COLOMBIANO (e-commerce, joyería, datos personales). Garantiza que todo lo legal se haga e… |
| `maps-gbp-local` | Rankear #1 en el local pack de Google Maps / Google Business Profile (GBP) para un negocio con ubicación (joyería, concesionario, inmobiliaria) — don… |
| `marketing-loops` | When the user wants to set up a recurring, self-running marketing workflow — a repeatable loop an AI agent runs on a cadence (weekly, daily, on a tri… |
| `marketing-psicologico-conversion` | Activar cuando el usuario quiera crear guiones de video, piezas gráficas, copywriting para anuncios o estrategia de contenido — en especial piezas de… |
| `meta-ads-diagnostico` | When the user wants to diagnose, analyze, or optimize a Meta Ads campaign. Use when the user shares metrics or asks 'why is my campaign not working,'… |
| `offers` | When the user wants to design, construct, or improve an offer — the thing they actually sell — including value framing, bonus stacking, guarantee des… |
| `optimizacion-rendimiento-web` | Usar para MEJORAR EL RENDIMIENTO de una página/sitio web end-to-end (velocidad de carga, Core Web Vitals, PageSpeed/Lighthouse) — no como parches sue… |
| `opus-interino-protocolo` | Cargar SIEMPRE al inicio de sesión cuando el modelo activo NO es el titular del proyecto (p.ej. Opus 4.8 operando como interino mientras Fable 5 no t… |
| `paid-ads` | When the user wants help with paid advertising campaigns on Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, or other ad platforms. Also u… |
| `pos-facturacion-retail` | Usar al DISEÑAR, auditar o explicar un sistema POS / facturación / caja de retail (joyería, tienda, concesionario, restaurante) — para que el sistema… |
| `proceso-decision-fuerte` | Pipeline de validación multi-capa para DECISIONES FUERTES (arquitectura, modelo de datos, seguridad/legal, operaciones irreversibles, cambios multi-s… |
| `product-feeds` | Generar feeds de producto/inventario en el BUILD para EMPUJAR tu catálogo a Google y portales en vez de esperar el rastreo — la palanca de visibilida… |
| `publicar-web-produccion` | > |
| `search-console-setup-y-diagnostico` | Dar de alta Google Search Console (GSC) y diagnosticar por qué un sitio "no sale en Google" — la herramienta gratis que dice qué indexó Google, con q… |
| `semantic-schema-aeo` | El cerebro semántico de la visibilidad — qué structured data (JSON-LD) inyectar por tipo de página + cómo ser CITADO/RECOMENDADO #1 por buscadores e… |
| `session-report` | Generate an explorable HTML report of Claude Code session usage (tokens, cache, subagents, skills, expensive prompts) from ~/.claude/projects transcr… |
| `spec-kit` | Spec-Driven Development (SDD) — el método de GitHub spec-kit para construir software CON IA con rigor. Úsalo ANTES de codear una funcionalidad o proy… |
| `validacion-live-chrome` | Usar DESPUÉS de un merge/deploy cuando los cambios YA están EN VIVO y hace falta EVIDENCIA REAL del comportamiento (no localhost, no opinión). Modo D… |
| `video` | When the user wants to create, generate, or produce video content using AI tools or programmatic frameworks. Also use when the user mentions 'video p… |
| `wompi-api-core` | Activar cuando el usuario quiera crear, leer, o gestionar transacciones, fuentes de pago o tokens de tarjetas en Wompi Colombia. |
| `wompi-colombia-api-v1` | Skill maestro para la integración completa de la API v1 de Wompi Colombia. Úsalo cuando necesites implementar pagos en Colombia, Wompi, Bancolombia,… |
| `wompi-webhooks-validator` | Activar cuando el usuario pida ayuda recibiendo, procesando o validando webhooks asíncronos de Wompi Colombia (ej. pagos PSE, Nequi). |

## 2 · Agents del brain-kit (`~/.claude/agents/`)

- `plan-auditor` · - `seo-auditor` · - `spec-analyze` · - `wompi_qa_agent` · - `wompi_support_agent`

## 3 · Skills de DOMINIO del repo (`skills/` — conocimiento del PROYECTO, se commitean)

| Pack | Qué es |
|---|---|
| `pruebas-electricas` | Pack de dominio: criterios/diagnóstico por prueba eléctrica (FP/tan δ, bujes, excitación, relación, resistencias, SFRA, DFR, DGA/aceite, LTC…). Fuente del lóbulo `49`. |
| `transformadores-potencia` | Pack de dominio del EQUIPO: identificación de tipo, grupo vectorial, cálculos nominales. Fuente del lóbulo `50`. 11 skills (TODO-05: validación del Ingeniero). |

Sub-skills `pruebas-electricas`: `_conocimiento`, `analisis-aceite`, `cambiador-tomas-ltc`, `corriente-excitacion`, `dfr-respuesta-dielectrica`, `dga`, `factor-potencia-aislamiento`, `factor-potencia-bujes`, `reactancia-dispersion`, `relacion-transformacion`, `resistencia-aislamiento`, `resistencia-aislamiento-nucleo`, `resistencia-devanados`, `sfra`.
Sub-skills `transformadores-potencia`: `_conocimiento`, `bujes-y-accesorios`, `calculos-nominales`, `construccion-nucleo-devanados`, `gestion-vida-activo`, `grupo-vectorial-conexiones`, `identificacion-tipo-transformador`, `impedancia-cortocircuito`, `modos-falla-diagnostico`, `placa-caracteristica`, `regulacion-tomas`, `sistema-refrigeracion`.

## 4 · Skills de MÉTODO instaladas en el repo (`skills/` — activación repo-only vía L-19)

`ab-test-setup` · `accessibility-audit` · `ad-creative` · `ai-seo` · `analytics-tracking` · `animate-skill-main` · `asesor-critico-honesto` · `brainstorming` · `canvas-design-creative` · `churn-prevention` · `claude-automation-recommender` · `claude-md-improver` · `claude-skills-llm-council-main` · `code-modernization` · `code-simplifier` · `cold-email` · `community-marketing` · `competitor-alternatives` · `content-strategy` · `copy-editing` · `copywriting` · `crm-architect` · `customer-research` · `dispatching-parallel-agents` · `ecommerce` · `email-sequence` · `emil-design-eng` · `executing-plans` · `finishing-a-development-branch` · `firecrawl-agent` · `firecrawl-cli` · `firecrawl-crawl` · `firecrawl-download` · `firecrawl-interact` · `firecrawl-map` · `firecrawl-scrape` · `firecrawl-search` · `form-cro` · `free-tool-strategy` · `frontend-design` · `impeccable` · `launch-strategy` · `lead-magnets` · `marketing-ideas` · `marketing-psychology` · `onboarding-cro` · `page-cro` · `paid-ads` · `paywall-upgrade-cro` · `popup-cro` · `pricing-strategy` · `product-marketing-context` · `programmatic-seo` · `receiving-code-review` · `referral-program` · `requesting-code-review` · `revops` · `sales-enablement` · `schema-markup` · `seo-audit` · `session-report` · `signup-flow-cro` · `site-architecture` · `skill-creator` · `social-content` · `subagent-driven-development` · `systematic-debugging` · `taste-skill-main` · `test-driven-development` · `using-git-worktrees` · `using-superpowers` · `verification-before-completion` · `writing-plans` · `writing-skills`

> ⚠️ El repo NO es la fuente de las skills CARGADAS en la sesión (esas vienen de plugins + `~/.claude/skills`).
> Para activar una skill repo-only: copiar su `SKILL.md` a `.claude/skills/<name>/` + reiniciar (L-19).
