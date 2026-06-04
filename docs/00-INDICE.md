# 00 — ÍNDICE SINÁPTICO (mapa § → línea del Historial ADR)

> **Nodo neuronal: Índice sináptico.** Mapa § → línea de
> `docs/99-HISTORIAL-ADR.md`. Es la tabla de contenidos del
> nodo de Largo Plazo. Se consulta on-demand (Trigger de Error/Historia, ver
> `CLAUDE.md §G`).
>
> **Cerebro completo**: 🧠 `CLAUDE.md` (router/identidad) · 🩺 `05-ESTADO-GLOBAL.md` (signos vitales)
> · ⚡ `10-MEMORIA-CORTO-PLAZO.md` (WIP) · 🛰️ `15-CONSEJO-EXTERNO.md` (red team) · 🗺️ `20-MEMORIA-ESPACIAL.md` (arquitectura)
> · 🧪 `30-LECCIONES.md` (experiencia/recetas) · 🎯 `40-LOBULOS-DOMINIO.md` (registry) · 🗂️ este (índice) · 📚 `99-HISTORIAL-ADR.md` (largo plazo)
> · 🛠️ `skills-inventory.md` (catálogo skills).
>
> **Cómo usarlo (regla de oro anti-saturación)**:
> 1. Busca aquí el § que necesitas y su línea de inicio.
> 2. Lee SOLO ese tramo: `Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150`.
> 3. NUNCA leas el historial completo (puede llegar a 40k+ líneas y saturar el contexto al instante).
>
> Grep rápido para regenerar: `grep -n "^## " docs/99-HISTORIAL-ADR.md`.

---

## 🧭 Enrutamiento semántico (síntoma/tema → neurona) — CONSULTA ESTO PRIMERO

> La sinapsis de recuperación rápida: ante una duda, NO escanees el cerebro. Busca
> tu caso aquí y ve directo a la neurona. (Reflejo de Auto-mejora §G.4: si tu caso
> no está, añádelo tras resolverlo.)

| Tu situación / síntoma | Ve a |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-ESPACIAL` |
| Voy a mover/renombrar archivos, refactor de estructura | 🧪 `30-LECCIONES` (gotchas Git/refactor) + 🗺️ `20-ESPACIAL` |
| Conflicto al fusionar / cache / cron | 🧪 `30-LECCIONES` + `CLAUDE.md §4` (si aplica cache) |
| Validar si algo es código muerto antes de borrar | 🧪 `30-LECCIONES` + `_legacy/README.md` |
| Bug recurrente / 2 fallos en el mismo síntoma | 📚 `99-HISTORIAL-ADR` (tabla § → línea abajo) |
| Performance / Core Web Vitals | `CLAUDE.md §3.1` + 🎯 `40-LOBULOS` → 45-PERFORMANCE (on-demand) |
| ¿Qué hay pendiente? estado del sprint | ⚡ `10-CORTO-PLAZO` (TODO-NN) |
| 🔵 Audita SEGURIDAD / vulnerabilidades / rules / auth | 🎯 `40-LOBULOS-DOMINIO` → 41-SEGURIDAD (on-demand) + Skill tool |
| 🔵 Audita LEGAL / cookies / privacidad / GDPR / Ley 1581 | 🎯 `40-LOBULOS-DOMINIO` → 42-LEGAL (on-demand) + Skill tool |
| 🔵 Audita UX / interfaz / componentes | 🎯 `40-LOBULOS-DOMINIO` → 43-UX (on-demand) + Skill tool (`frontend-design`, `impeccable`, `redesign-existing-projects`) |
| 🔵 Audita SEO / rich snippets / structured data | 🎯 `40-LOBULOS-DOMINIO` → 44-SEO (on-demand) + Skill tool (`seo-audit`, `ai-seo`, `schema-markup`) |
| 🔵 Audita PERFORMANCE / Core Web Vitals / LCP/CLS | 🎯 `40-LOBULOS-DOMINIO` → 45-PERFORMANCE (on-demand) |
| 🔵 Audita ESCALABILIDAD / arquitectura / modernización | 🎯 `40-LOBULOS-DOMINIO` → 46-ESCALABILIDAD (on-demand) + Skill tool |
| 🔵 Audita COPY / voz / tono / CTAs | 🎯 `40-LOBULOS-DOMINIO` → 47-COPYWRITING (on-demand) + Skill tool (`copywriting`, `copy-editing`) |
| 🔵 Audita ACCESIBILIDAD / WCAG / a11y | 🎯 `40-LOBULOS-DOMINIO` → 48-ACCESIBILIDAD (on-demand) + Skill **`accessibility-audit`** (framework WCAG 2.2 AA) |
| 🛠️ ¿Qué skill tengo para X? / mapa de skills | 🛠️ `docs/skills-inventory.md` + 🎯 `40-LOBULOS §Recursos Externos` |
| 🛰️ Decisión fuerte / cara de revertir / fork 50-50 → ¿2ª opinión? | 🛰️ `docs/15-CONSEJO-EXTERNO.md` (cuándo + qué tier del provider externo configurado en §0) |
| 🌱 Crear / sugerir una SKILL nueva (capacidad portable) | 🎯 `40-LOBULOS-DOMINIO` §Reflejo de Sugerencia de Skills + Skill `skill-creator` |
| El "por qué" de una decisión / detalle de un § | tabla "§ → línea" abajo → 📚 `99-HISTORIAL-ADR.md` |

---

## Mapa § → línea

> Vacío hasta que se cierre el primer ADR. Apenas se apenda `## NN.` al final de
> `docs/99-HISTORIAL-ADR.md`, agregar aquí su fila con la línea de inicio.

| § | Tema | Línea |
|---|---|---|
| _(sin entradas — primera tarea aún no cerrada como ADR)_ | | |

---

## Doctrinas (referencia rápida — las always-on viven en CLAUDE.md §3)

| Doctrina | Donde vive | Resumen |
|---|---|---|
| Performance | `CLAUDE.md §3.1` | Sin `transition:all`, sin animar layout, lazy imgs |
| HTML/CSS / API estable | `CLAUDE.md §3.2` | No renombrar IDs/endpoints; cambios aditivos |
| Verifica no asumas (RCA) | `CLAUDE.md §3.3` | Evidencia antes de afirmar CUALQUIER hecho |
| IAP (Impact Analysis Previo) | `CLAUDE.md §3.4` | 5 secciones A-E antes de commit no-trivial |
| Anti-MutationObserver / anti-pointermove | `CLAUDE.md §3.5` | No observers globales con subtree:true |

---

## Planes maestros (cerrados — detalle en historial)

> Se llenan a medida que se cierran fases grandes. Formato: nombre · rango §X-§Y · estado.

| Plan | § rango | Estado |
|---|---|---|
| _(sin entradas)_ | | |

---

> Mantener este índice sincronizado: cuando se agregue un ADR al historial,
> añadir su fila aquí con la línea de inicio (`grep -n "^## " docs/99-HISTORIAL-ADR.md`).
> El linter `brain:check` valida que cada ADR de `99` tenga fila aquí.
