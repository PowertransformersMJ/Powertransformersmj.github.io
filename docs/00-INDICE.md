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
| 🔵 Cálculos / criterios / diagnóstico de PRUEBAS ELÉCTRICAS (IR/PI/DAR, FP/tan δ, DGA, SFRA, relación, excitación…) | 🎯 `40-LOBULOS-DOMINIO` → **49-PRUEBAS-ELECTRICAS** (on-demand) + skills `skills/pruebas-electricas/*` (vía tool `Skill`) |
| 🔵 TIPO de transformador (bidevanado/tridevanado/auto/compensación), grupo vectorial, cálculos nominales/relación/impedancia del EQUIPO | 🎯 `40-LOBULOS-DOMINIO` → **50-TRANSFORMADORES-POTENCIA** (on-demand) + skills `skills/transformadores-potencia/*` (vía tool `Skill`) |
| 🛠️ ¿Qué skill tengo para X? / mapa de skills | 🛠️ `docs/skills-inventory.md` + 🎯 `40-LOBULOS §Recursos Externos` |
| 🛰️ Decisión fuerte / cara de revertir / fork 50-50 → ¿2ª opinión? | 🛰️ `docs/15-CONSEJO-EXTERNO.md` (cuándo + qué tier del provider externo configurado en §0) |
| 🌱 Crear / sugerir una SKILL nueva (capacidad portable) | 🎯 `40-LOBULOS-DOMINIO` §Reflejo de Sugerencia de Skills + Skill `skill-creator` |
| 🤖 Extracción de PDFs con IA / Claude API / tool use / costos LLM | 🧪 `30-LECCIONES` (L-20/L-21) + 📚 `99` §3 (ADR-003) + Skill `claude-api` |
| El "por qué" de una decisión / detalle de un § | tabla "§ → línea" abajo → 📚 `99-HISTORIAL-ADR.md` |

---

## Mapa § → línea

> Vacío hasta que se cierre el primer ADR. Apenas se apenda `## NN.` al final de
> `docs/99-HISTORIAL-ADR.md`, agregar aquí su fila con la línea de inicio.

| § | Tema | Línea |
|---|---|---|
| §1 | ADR-001 — Instalación del cerebro neuronal documental (7 fases + auditoría) | 20 |
| §2 | ADR-002 — Activación local de 24 skills repo-only en `.claude/skills/` | 42 |
| §3 | ADR-003 — Extracción de informes de Pruebas Eléctricas con IA (Claude) vía Cloud Function | 64 |
| §4 | ADR-004 — Pruebas Eléctricas: extracción IA robusta + identidad + tablero detallado | 87 |
| §5 | ADR-005 — Gobernanza: purga de Debug/ del historial + flujo commit/deploy/push | 107 |
| §6 | ADR-006 — Tablero flexible "bloques de análisis" (modelo agnóstico + render genérico) | 127 |
| §7 | ADR-007 — Subsistema de diagnóstico de extracción + bloques a Firestore (revisión ADR-006) | 152 |
| §8 | ADR-008 — Tablero Pruebas Eléctricas: pipeline bloques completo + rediseño IA-primaria + render interactivo | 175 |
| §9 | ADR-009 — Tablero Pruebas Eléctricas: completitud determinista, workflow de auditoría, tendencia y Biblioteca-hub | 200 |
| §10 | ADR-010 — Tendencia F2+F3: franja-timeline de informes + narrativa de tendencia por IA (on-demand) | 226 |
| §11 | ADR-011 — Veredicto 100% normativo (scorecard vs norma, no informe) + NETA por clase unificada + desviación general de resistencia | 246 |
| §12 | ADR-012 — Evaluación MULTI-NORMA (veredicto por cada norma + consolidado conservador + divergencias) | 267 |
| §13 | ADR-013 — FP de bujes canónico (discriminado) + Tendencia de alto nivel (diagnóstico multi-norma por métrica) | 290 |
| §14 | ADR-014 — Identidad/placa CONGELADA por informe (trafo móvil doble config: aislamiento por clase del propio ensayo) | 311 |
| §15 | ADR-015 — "Reprocesar" 100% funcional: reintento con backoff de fallos transitorios de la IA (server-side) + presupuesto de tiempo | 332 |
| §16 | ADR-016 — "Reprocesar" asíncrono observable: persistencia server-side + estado durable (en_curso/ok/error) + badge en vivo | 353 |
| §17 | ADR-017 — Causa raíz del reproceso colgado: timeout INTERNO por intento (abort del stream) + watchdog global + 2 GiB | 375 |
| §18 | ADR-018 — Fallo real "Claude API: terminated" = bodyTimeout de undici (5 min) corta el stream largo → dispatcher sin bodyTimeout (undici@6) | 398 |
| §19 | ADR-019 — 504/deadline-exceeded: bug del presupuesto de reintento (2.º intento sin sitio → SIGKILL) + timeoutSeconds 900→1500 para máxima calidad | 420 |
| §20 | ADR-020 — RETIRO de "Reprocesar" (costo > valor; re-extraer = re-subir). CF queda solo-CARGA; se conserva la robustez de transporte | 440 |
| §21 | ADR-021 — Previsualización al colisionar por fecha: comparar "ya guardado" vs "nuevo" (+ abrir PDF) antes de reemplazar | 462 |
| §22 | ADR-022 — Calificación global muestra TODAS las pruebas (no oculta/fusiona, FP bujes separado) + Tendencia con acción clasificada (predictiva/preventiva/correctiva) | 480 |
| §23 | ADR-023 — Tablero: vista CONSOLIDADA % del límite (SUPERSEDED por ADR-024 — mala interpretación) | 500 |
| §24 | ADR-024 — Tablero MULTI-AÑO: cada prueba con todos los años superpuestos + filtro de año por prueba; **workflow de PREVIEW** (dev-server + harness) | 518 |
| §25 | ADR-025 — Multi-año v2 (feedback): conserva FASES + valores reales + filtro de año GLOBAL + fase por gráfica; Tendencia con cambios año-a-año + PROYECCIÓN | 539 |
| §26 | ADR-026 — Regresión: el multi-año colapsaba informes del MISMO año → identidad por INFORME (no por año); verificar antes/después | 560 |
| §27 | ADR-027 — Multi-año muestra TODAS las pruebas ELÉCTRICAS (SFRA/reactancia/IR-núcleo/LTC/DFR con familia genérica, no solo las 7); el ACEITE (DGA) queda EXCLUIDO; criterios/datos se surfacean, no se fabrican | 578 |
| §28 | ADR-028 — Multi-año TENDENCIA año a año: 1 gráfica por SUB-PRUEBA (par de devanados, no fusiona escalas), TODOS los años por defecto, orden cronológico + etiquetas uniformes; validado con 5 informes REALES 450108 (+ tan δ por sección) | 600 |

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
