# 🗂️ 00 — ÍNDICE SINÁPTICO (mapa § → línea + ruteo semántico)

> Puerta de entrada al Largo Plazo (`99`). Dos capas: (1) tabla mecánica §→línea
> (la reconcilia `npm run brain:index` — NO la mantengas a mano); (2) ruteo semántico
> "síntoma → neurona" (esta SÍ es inteligencia curada — aliméntala).
> Regla de oro: NUNCA leer `99` completo — busca el § aquí y lee SOLO ese tramo
> (`Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150`).

## Capa 1 — Mapa § → línea de `99-HISTORIAL-ADR.md`

> Formato de fila EXACTO (el reconciliador lo parsea): `| §N | descripción con hook | LINEA |`
>
> **§1–§80 → hija [`00a-INDICE-ADR-001-080.md`](00a-INDICE-ADR-001-080.md)** (mismo formato, misma
> reconciliación, `99 §120`). Aquí, de §81 en adelante; las filas nuevas se agregan AQUÍ, al final.

| § | Qué resuelve (hook para decidir si leerlo) | Línea |
|---|---|---|
| §81 | ADR-081 — **Potencia y usuarios EN la casilla** (informativo); la casilla sigue siendo la de la norma | 3264 |
| §82 | ADR-082 — **Cada TX abre SU ficha**: el «CODIGO SUBESTACION» dejó de ser la identidad (dos TX de un patio compartían ficha) | 3313 |
| §83 | ADR-083 — **Borrador local de la ficha** con dueño y caducidad (no pisa ni cruza equipos) | 3362 |
| §84 | ADR-084 — **La carga tardía ya no borra el listado**; el pie del papel dice su fuente real | 3468 |
| §85 | ADR-085 — **El alcance lo escribe la redacción dictada** por el Ingeniero | 3514 |
| §86 | ADR-086 — **Auditoría Nivel-2**: 53 hallazgos; kernel sin IDs ajenos | 3574 |
| §87 | ADR-087 — **Tanda B, el Excel que se firma**: Valor Real, `[PENDIENTE]` nunca «0» | 3632 |
| §88 | ADR-088 — **Período y firmas con la forma del Excel** (Aprobación con dos firmantes) | 3713 |
| §89 | ADR-089 — **Quién firma**: lista dictada por el Ingeniero, ficha y Excel (CF-25) | 3743 |
| §90 | ADR-090 — **El Alcance muestra solo el alcance**: fuera el selector de acciones | 3797 |
| §91 | ADR-091 — **Fechas con calendario**: se ven «dd/mm/aaaa» y el calendario se abre al tocarlas | 3832 |
| §92 | ADR-092 — **Beneficios por práctica**: el selector pasa a Beneficios y propone el texto con lo escogido | 3855 |
| §93 | ADR-093 — **Valor Real vacío ⇒ en blanco** (J36 y su total), no `[PENDIENTE]` ni aviso | 3887 |
| §94 | ADR-094 — **Año de entrada con calendario de años** desde 2020 | 3922 |
| §95 | ADR-095 — **Beneficios de Mantenimiento** siguen a las prácticas marcadas, en breve | 3964 |
| §96 | ADR-096 — **Mantenimiento sin casillas pre-marcadas** | 4014 |
| §97 | ADR-097 — **Beneficios sin subtítulos** | 4032 |
| §98 | ADR-098 — **Firma estampada** de la sesión | 4046 |
| §99 | ADR-099 — **Firmas del equipo bajo custodia** | 4078 |
| §100 | ADR-100 — **Firmas en Firestore** (Storage daba 503) | 4169 |
| §101 | ADR-101 — **Firmas de tamaño parejo** | 4197 |
| §102 | ADR-102 — **Vista previa del Excel + PDF** | 4211 |
| §103 | ADR-103 — **Mantenimiento al PE.02081** | 4238 |
| §104 | ADR-104 — **Excel sin datos ocultos** | 4256 |
| §105 | ADR-105 — **Beneficios con las 13 acciones** | 4285 |
| §106 | ADR-106 — **Zona del activo** | 4321 |
| §107 | ADR-107 — **«Salud y riesgo» al Excel** (sin usuarios, sin casilla) | 4335 |
| §108 | ADR-108 — **Siempre las cinco firmas** y folio al exportar | 4368 |
| §109 | ADR-109 — **Auditoría Nivel-2** (M-07) | 4389 |
| §110 | ADR-110 — **Sin hoja Beneficios**; Futuro derecho | 4416 |
| §111 | ADR-111 — **«Salud y riesgo»**: sin lectura por potencia; nota 7 variables | 4448 |
| §112 | ADR-112 — **«Diagrama Operativo»**: adjunto, última hoja | 4467 |
| §113 | ADR-113 — **CF-40**: lector en un hilo con tiempo límite | 4553 |
| §114 | ADR-114 — **Órdenes E/S**: firmas en Autorizado y Entregado | 4599 |
| §115 | ADR-115 — **«Salud y riesgo» letra grande**; Actual anclado | 4645 |
| §116 | ADR-116 — **Sesión**: lectura lenta ≠ sin perfil | 4717 |
| §117 | ADR-117 — **Órdenes E/S**: firmas delegadas | 4768 |
| §118 | ADR-118 — **Diagrama Operativo**: permiso puntual para adjuntar | 4828 |
| §119 | ADR-119 — **Fichas**: firmas delegadas (Carlos, Jorge) | 4871 |
| §120 | ADR-120 — **Cerebro partido en hijas** (`00a`, `22`, `34`, `35`, CF cerrados); kernel reconcilia el índice por rangos | 4959 |
| §121 | ADR-121 — **Fichas**: «Elaboración» por defecto sigue a la sesión (Carlos, Jorge) | 5035 |
| §122 | ADR-122 — **Cargabilidad SCADA**: carga horaria real vs ampacidad del devanado, CRG firme/provisional, «Datos SCADA» (homologación y meses) | 5078 |
| §123 | ADR-123 — **Detalle de Cargabilidad**: la ventana de la tabla priorizada abre con el parque real, sin cifras sin dato y a la vista en la pestaña (iframe) | 5173 |
| §124 | ADR-124 — **Detalle de Cargabilidad**: «Diagnóstico» con las 7 calificaciones de Salud de Activos y enlace a las curvas horarias medidas por el SCADA (decisiones del Ingeniero) | 5248 |
| §125 | ADR-125 — **Cargabilidad SCADA con datos**: «Paquete preparado» (un mes en 3 partes por la extensión, mismo lector), homologación v2 y 8 meses cargados, arreglos de la revisión | 5304 |
| §126 | ADR-126 — **Cargabilidad SCADA: máx/mín/instantáneo** con filtro «Valores a mostrar» y «Fases» (solo para ver; la cifra igual) + una gráfica grande por magnitud con zoom compartido; 8 meses recargados | 5367 |
| §127 | ADR-127 — **Cargabilidad SCADA**: panel DGA × carga (adversidades y acciones; borrador) | 5431 |
| §128 | ADR-128 — **Auditoría Nivel-2 del cerebro** (59 hallazgos; gate #14 mal calibrado) | 5505 |

## Capa 2 — Ruteo semántico (síntoma → neurona) — CONSULTA ESTO PRIMERO

| Si el síntoma / la duda es… | Ve a… |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-MEMORIA-ESPACIAL` |
| Voy a mover/renombrar archivos, refactor, merge, deploy | 🧪 `30-LECCIONES` (gotchas) + 🗺️ `20` |
| Voy a agregar o retirar una exportación de un módulo JS ya publicado (caché del navegador) | `32` **L-102 (3)**: lo nuevo va en un archivo NUEVO · retirar → `30` **L-116** |
| Voy a tocar `functions/` o el pipeline de IA (streaming/reintentos/timeouts) | 🤖 `31-LECCIONES-IA` (hija de `30`, L-35/L-43–L-48) |
| Busco un pendiente que no está en `10` (decisión de arquitectura, validación diferida, cola vieja) | 🧊 `11-PENDIENTES-FRIOS` (hija de `10`) |
| Necesito saber qué contiene una hoja `docs/*.md` del dueño | 🗂️ `21-ESPACIAL-HOJAS` (hija de `20`) |
| Voy a lanzar agentes/workflow, automatizar el navegador o fiarme de un barrido por consola | 🛠️ `33-LECCIONES-HARNESS` (hija de `30`) |
| Validar si algo es código muerto antes de borrar | 🧪 `30-LECCIONES` + `_legacy/README.md` |
| Bug recurrente / 2 fallos en el mismo síntoma | Capa 1 → tramo de `99-HISTORIAL-ADR` |
| ¿Qué hay pendiente? estado del sprint | ⚡ `10-CORTO-PLAZO` (TODO-NN) |
| ¿Estado real del sistema / build / producción? | 🩺 `05-ESTADO-GLOBAL` |
| 🔵 Audita SEGURIDAD / rules / auth · cédulas · firmas de otros | 🔐 `35-LECCIONES-SEGURIDAD` (hija de `30`) + 🎯 `40-LOBULOS` → 41-SEGURIDAD (on-demand) + Skill tool |
| 🔵 Audita LEGAL / privacidad / Ley 1581 | 🎯 `40-LOBULOS` → 42-LEGAL (on-demand) + Skill tool |
| 🔵 Audita UX / SEO / performance / a11y / copy | 🎯 `40-LOBULOS` → lóbulo 43-48 (on-demand) + Skill tool (`accessibility-audit`, `seo-audit`…) |
| 🔵 Criterios / diagnóstico de PRUEBAS ELÉCTRICAS (IR/PI/DAR, FP/tan δ, SFRA, excitación…) | 🎯 `49-PRUEBAS-ELECTRICAS` + skills `skills/pruebas-electricas/*` + ⚡ `34-LECCIONES-PRUEBAS-ELECTRICAS` (tablero, veredicto, previews) |
| 🔵 TIPO de transformador, grupo vectorial, cálculos del EQUIPO | 🎯 `50-TRANSFORMADORES-POTENCIA` + skills `skills/transformadores-potencia/*` |
| 🛠️ ¿Qué skill tengo para X? | `docs/skills-inventory.md` + `40-LOBULOS §Recursos` |
| ¿Podemos seguir en GitHub Pages? ¿migramos el hosting? ¿los ToS nos prohíben algo? | `99 §60` (veredicto + runbook Cloudflare + disparadores) — **no re-analizar por calendario** |
| 🛰️ Decisión fuerte / cara de revertir → ¿2ª opinión externa? | `60-WORKFLOWS §W-11` (checklist cerrado) → `15-CONSEJO-EXTERNO` + skills `proceso-decision-fuerte`/`comite-expertos` |
| 🔁 ¿Cómo se corre un proceso repetible? (red-team de reglas, verificar un subagente, criterio multi-norma, importar Excel real) | 🔁 `60-WORKFLOWS` (W-01..W-13) |
| 🔑 Tocar `scripts/*.mjs` del cerebro / actualizar el kernel | `../brain-private/kernel/README.md` → editar allí + `npm run brain:pull` (NUNCA en el repo: gate #0) |
| 🤖 Extracción de PDFs con IA / Claude API / costos LLM | 🤖 `31` (L-20/L-21) + `99 §3` + Skill `claude-api` |
| 📄 Fichas · Excel PE.02081 · firmas · «Salud y riesgo» · «Diagrama Operativo» | `cola-fichas-tecnicas.md` (cerrados → `cola-fichas-tecnicas-cerrados.md`) + archivos → `22-ESPACIAL-MODULOS` + `99 §82 en adelante` + **L-103** |
| 📈 Cargabilidad SCADA: curvas horarias, homologación con el SCADA, carga de un mes, ventana de un mes | `99 §122` + L-113 · L-114 (botón ilegible, página vacía y clase CSS compartida entre pantallas, §122.9/§126.9) · cargar un mes sin arrastrar (paquete preparado, `scripts/scada-empaquetar.mjs`) → `§125` + L-117 · máx/mín/instantáneo, filtro y gráficas grandes → `§126` · DGA × carga (adversidades y acciones preventivas) → `§127` + L-118 · archivos y colecciones `scada_*` → `22` · bóvedas `2026-09-30-cargabilidad-scada` · `2026-10-01-carga-scada-paquete` · `2026-10-01-parametros-scada` (TODO-69) · `2026-10-01-dga-carga` |
| 🪟 Ventana de detalle de Cargabilidad (tabla vieja) · una ventana fija dentro de un iframe que no se ve · retirar exportaciones con caché | `99 §123`, `§124` + L-115, L-116 · bóveda `2026-10-01-detalle-cargabilidad` |
| ✒ Firmas en Órdenes E/S o en el informe de refrigeración | `99 §114`, `§117`, `§119`, `§121` (+ `§71`, `§99`) · archivos → `22` |
| El "por qué" de una decisión / detalle de un § | Capa 1 (§1-§80 en `00a`) → `99-HISTORIAL-ADR.md` |
| ¿Dónde está la lección `L-NN` / `M-NN`? | `grep -n "^### L-NN " docs/3*-LECCIONES*.md` — `30` y sus hijas `31`-`35` |

> **Doctrinas** → always-on en `CLAUDE.md §3` (3.1 performance · 3.2 aditivo/API estable · 3.3 verifica · 3.4 IAP · 3.5 observers).
