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
| §81 | ADR-081 — **Potencia y usuarios EN la casilla** (informativo); la casilla sigue siendo la de la norma | 3266 |
| §82 | ADR-082 — **Cada TX abre SU ficha**: el «CODIGO SUBESTACION» dejó de ser la identidad (dos TX de un patio compartían ficha) | 3315 |
| §83 | ADR-083 — **Borrador local de la ficha** con dueño y caducidad (no pisa ni cruza equipos) | 3364 |
| §84 | ADR-084 — **La carga tardía ya no borra el listado**; el pie del papel dice su fuente real | 3470 |
| §85 | ADR-085 — **El alcance lo escribe la redacción dictada** por el Ingeniero | 3516 |
| §86 | ADR-086 — **Auditoría Nivel-2**: 53 hallazgos; kernel sin IDs ajenos | 3576 |
| §87 | ADR-087 — **Tanda B, el Excel que se firma**: Valor Real, `[PENDIENTE]` nunca «0» | 3634 |
| §88 | ADR-088 — **Período y firmas con la forma del Excel** (Aprobación con dos firmantes) | 3717 |
| §89 | ADR-089 — **Quién firma**: lista dictada por el Ingeniero, ficha y Excel (CF-25) | 3749 |
| §90 | ADR-090 — **El Alcance muestra solo el alcance**: fuera el selector de acciones | 3803 |
| §91 | ADR-091 — **Fechas con calendario**: se ven «dd/mm/aaaa» y el calendario se abre al tocarlas | 3838 |
| §92 | ADR-092 — **Beneficios por práctica**: el selector pasa a Beneficios y propone el texto con lo escogido | 3861 |
| §93 | ADR-093 — **Valor Real vacío ⇒ en blanco** (J36 y su total), no `[PENDIENTE]` ni aviso | 3893 |
| §94 | ADR-094 — **Año de entrada con calendario de años** desde 2020 | 3928 |
| §95 | ADR-095 — **Beneficios de Mantenimiento** siguen a las prácticas marcadas, en breve | 3970 |
| §96 | ADR-096 — **Mantenimiento sin casillas pre-marcadas** | 4022 |
| §97 | ADR-097 — **Beneficios sin subtítulos** | 4041 |
| §98 | ADR-098 — **Firma estampada** de la sesión | 4056 |
| §99 | ADR-099 — **Firmas del equipo bajo custodia** | 4088 |
| §100 | ADR-100 — **Firmas en Firestore** (Storage daba 503) | 4180 |
| §101 | ADR-101 — **Firmas de tamaño parejo** | 4208 |
| §102 | ADR-102 — **Vista previa del Excel + PDF** | 4222 |
| §103 | ADR-103 — **Mantenimiento al PE.02081** | 4249 |
| §104 | ADR-104 — **Excel sin datos ocultos** | 4268 |
| §105 | ADR-105 — **Beneficios con las 13 acciones** | 4298 |
| §106 | ADR-106 — **Zona del activo** | 4334 |
| §107 | ADR-107 — **«Salud y riesgo» al Excel** (sin usuarios, sin casilla) | 4348 |
| §108 | ADR-108 — **Siempre las cinco firmas** y folio al exportar | 4382 |
| §109 | ADR-109 — **Auditoría Nivel-2** (M-07) | 4403 |
| §110 | ADR-110 — **Sin hoja Beneficios**; Futuro derecho | 4430 |
| §111 | ADR-111 — **«Salud y riesgo»**: sin lectura por potencia; nota 7 variables | 4462 |
| §112 | ADR-112 — **«Diagrama Operativo»**: adjunto, última hoja | 4481 |
| §113 | ADR-113 — **CF-40**: lector en un hilo con tiempo límite | 4568 |
| §114 | ADR-114 — **Órdenes E/S**: firmas en Autorizado y Entregado | 4615 |
| §115 | ADR-115 — **«Salud y riesgo» letra grande**; Actual anclado | 4662 |
| §116 | ADR-116 — **Sesión**: lectura lenta ≠ sin perfil | 4734 |
| §117 | ADR-117 — **Órdenes E/S**: firmas delegadas | 4785 |
| §118 | ADR-118 — **Diagrama Operativo**: permiso puntual para adjuntar | 4847 |
| §119 | ADR-119 — **Fichas**: firmas delegadas (Carlos, Jorge) | 4892 |
| §120 | ADR-120 — **Cerebro partido en hijas** (`00a`, `22`, `34`, `35`, CF cerrados); kernel reconcilia el índice por rangos | 4982 |
| §121 | ADR-121 — **Fichas**: «Elaboración» por defecto sigue a la sesión (Carlos, Jorge) | 5058 |
| §122 | ADR-122 — **Cargabilidad SCADA**: carga horaria real vs ampacidad del devanado, CRG firme/provisional, «Datos SCADA» (homologación y meses) | 5101 |
| §123 | ADR-123 — **Detalle de Cargabilidad**: la ventana de la tabla priorizada abre con el parque real, sin cifras sin dato y a la vista en la pestaña (iframe) | 5198 |
| §124 | ADR-124 — **Detalle de Cargabilidad**: «Diagnóstico» con las 7 calificaciones de Salud de Activos y enlace a las curvas horarias medidas por el SCADA (decisiones del Ingeniero) | 5273 |
| §125 | ADR-125 — **Cargabilidad SCADA con datos**: «Paquete preparado» (un mes en 3 partes por la extensión, mismo lector), homologación v2 y 8 meses cargados, arreglos de la revisión | 5329 |
| §126 | ADR-126 — **Cargabilidad SCADA: máx/mín/instantáneo** con filtro «Valores a mostrar» y «Fases» (solo para ver; la cifra igual) + una gráfica grande por magnitud con zoom compartido; 8 meses recargados | 5395 |
| §127 | ADR-127 — **Cargabilidad SCADA**: panel DGA × carga (adversidades y acciones; borrador) | 5461 |
| §128 | ADR-128 — **Auditoría Nivel-2 del cerebro** (59 hallazgos; gate #14 mal calibrado) | 5535 |
| §129 | ADR-129 — **Cargabilidad SCADA**: marca «sostenida» de la lista sin falsos | 5584 |
| §130 | ADR-130 — **Cargabilidad SCADA**: «Máximo sostenido 2 h» del detalle con serie limpia | 5629 |
| §131 | ADR-131 — **Cargabilidad SCADA**: triángulo de Duval hoy y con más carga + carga «solo gases» + regla vieja de Duval corregida | 5660 |
| §132 | ADR-132 — **Cargabilidad SCADA**: gases con más carga (ritmo por gas, punto caliente estimado IEC 60076-7, flecha) | 5740 |
| §133 | ADR-133 — **Cargabilidad SCADA**: textos del panel DGA sobre las ppm (variantes con/sin ppm) | 5786 |
| §134 | ADR-134 — **Cargabilidad SCADA**: triángulo «con más carga» visible junto al de hoy | 5816 |
| §135 | ADR-135 — **Interfaz**: el sitio en celular y tablet (menú ☰ con su código, barra que cabe, lo ancho desplazable) | 5837 |
| §136 | ADR-136 — **Cerebro**: mantenimiento minucioso (auditoría de 5 lentes, 55 confirmados) · TODO-68 → L-122 · prueba del ☰ | 5881 |
| §137 | ADR-137 — **Cerebro · dominio**: nacen los lóbulos 51 (salud y riesgo), 52 (DGA, aceite y papel) y 53 (carga y térmica); 49/50/34 trascienden · TODO-73 | 5916 |
| §138 | ADR-138 — **Cargabilidad SCADA: libro de parámetros por punto** (columna C de la homologación): entregable aparte, 17 posibles correcciones, 104 medidas fuera | 5971 |
| §139 | ADR-139 — **Cerebro: documentación total de la conversación 09-23 → 10-05** (notas a ADRs, lecciones, cola, memoria y bóveda; sin código) | 5998 |
| §140 | ADR-140 — **Fichas: CF-38 publicado · CF-43/CF-44 (gases e ISO 55001 en el papel) en rama con ejemplos, esperan «procede» · decisiones de TODO-69 en una tanda** | 6032 |
| §141 | ADR-141 — **Órdenes E/S: cantidad corregible en la tabla de materiales y material «Otro» escrito a mano** (sin cédulas, sin signos que el PDF no imprime, que quepa en el renglón) | 6088 |
| §142 | ADR-142 — **Órdenes E/S: «Órdenes guardadas»** (dónde reposan; Ver · PDF · Excel · Editar desde la lista, también las pendientes sin conexión) | 6130 |
| §143 | ADR-143 — **Órdenes E/S: filtro por zona y consolidado de entregas por transformador y subestación** (Excel; el tipo —entradas, salidas o ambas— lo escoge él, `§143.9`) | 6167 |
| §144 | ADR-144 — **Órdenes E/S: indicadores por accesorio, zona, motivo y mes** (apartado en la página + panel; cantidad en su unidad al escoger un accesorio; aviso «verok» invisible) | 6211 |

## Capa 2 — Ruteo semántico (síntoma → neurona) — CONSULTA ESTO PRIMERO

| Si el síntoma / la duda es… | Ve a… |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-MEMORIA-ESPACIAL` |
| Voy a mover/renombrar archivos, refactor, merge, deploy | 🧪 `30-LECCIONES` (gotchas) + 🗺️ `20` |
| Otra sesión de Claude trabaja a la vez (mismo repo, misma rama o la bóveda): números de ADR/L, qué sube a `main` | `30` **M-08** (mismo repo) + **M-05** (bóveda) |
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
| 🔵 TIPO de transformador, grupo vectorial, cálculos del EQUIPO · OLTC/DETC, refrigeración, protecciones | 🎯 `50-TRANSFORMADORES-POTENCIA` + skills `skills/transformadores-potencia/*` |
| 🔵 Salud / HI, condición oficial, criticidad, matriz de riesgo, estrategias, plan de inversión, CREG/UUCC | 🎯 `51-SALUD-RIESGO-ACTIVOS` (+ cola de Fichas para lo operativo) |
| 🔵 DGA, Duval, ppm, gas suficiente, aceite (ADFQ), furanos, vida del papel | 🎯 `52-DGA-ACEITE-PAPEL` + `34` (lecciones de dominio) |
| 🔵 Cargabilidad (CRG/SCADA), ampacidad, sobrecarga, punto caliente, regla de los 6 °C, «con más carga», DGA × carga | 🎯 `53-CARGA-TERMICA` (archivos → `22`) |
| 🛠️ ¿Qué skill tengo para X? | `docs/skills-inventory.md` + `40-LOBULOS §Recursos` |
| ¿Podemos seguir en GitHub Pages? ¿migramos el hosting? ¿los ToS nos prohíben algo? | `99 §60` (veredicto + runbook Cloudflare + disparadores) — **no re-analizar por calendario** |
| 🛰️ Decisión fuerte / cara de revertir → ¿2ª opinión externa? | `60-WORKFLOWS §W-11` (checklist cerrado) → `15-CONSEJO-EXTERNO` + skills `proceso-decision-fuerte`/`comite-expertos` |
| 🔁 ¿Cómo se corre un proceso repetible? (red-team de reglas, verificar un subagente, criterio multi-norma, importar Excel real) | 🔁 `60-WORKFLOWS` (W-01..W-13) |
| 🔑 Tocar `scripts/*.mjs` del cerebro / actualizar el kernel | `../brain-private/kernel/README.md` → editar allí + `npm run brain:pull` (NUNCA en el repo: gate #0) |
| 🤖 Extracción de PDFs con IA / Claude API / costos LLM | 🤖 `31` (L-20/L-21) + `99 §3` + Skill `claude-api` |
| 📄 Fichas · Excel PE.02081 · firmas · «Salud y riesgo» · «Diagrama Operativo» | `cola-fichas-tecnicas.md` (cerrados → `cola-fichas-tecnicas-cerrados.md`) + archivos → `22-ESPACIAL-MODULOS` + `99 §82 en adelante` + **L-103** |
| ✍️ Redactar o retocar un texto que se FIRMA (Beneficios, Alcance de Fichas) | memoria `feedback_redaccion_beneficios` (vocabulario y método) + `32` **L-88** + bóveda `2026-09-2[5-7]-beneficio-*` (`99 §105`) · preguntas suyas sin respuesta → cola de Fichas, «Tuyo» 9 |
| 📈 Cargabilidad SCADA: curvas horarias, homologación con el SCADA, carga de un mes, ventana de un mes | `99 §122` + L-113 · L-114 (botón ilegible, página vacía y clase CSS compartida entre pantallas, §122.9/§126.9) · cargar un mes sin arrastrar (paquete preparado, `scripts/scada-empaquetar.mjs`) → `§125` + L-117 · máx/mín/instantáneo, filtro y gráficas grandes → `§126` · DGA × carga (adversidades y acciones preventivas) → `§127` + L-118 · marca «sostenida» de la lista (resumen en bruto vs serie limpia) → `§129` + L-119 (bóveda `2026-10-02-marca-sostenida`) · triángulo de Duval por activo, ppm `ultima_dga`, márgenes de carga → `§131` (foto antes/después de una carga: comparar valores, no texto → `§131.9` + L-120) · margen en ppm y criterio «no firme» → `§131.10` · gases con más carga, punto caliente IEC 60076-7 → `§132` · textos del panel DGA con/sin ppm (`scada_carga_dga_textos_ppm.js`; el catálogo no se edita) → `§133` · triángulo «con más carga» aparte del de hoy → `§134` (bóveda `2026-10-02-duval-proyeccion`) · un aviso automático de «falta» que resultó falso → `32` **L-124** · libro de parámetros por punto (columna C) → `§138` · archivos y colecciones `scada_*` → `22` · bóvedas `2026-09-30-cargabilidad-scada` · `2026-10-01-carga-scada-paquete` · `2026-10-01-parametros-scada` (TODO-69) · `2026-10-01-dga-carga` |
| 🪟 Ventana de detalle de Cargabilidad (tabla vieja) · una ventana fija dentro de un iframe que no se ve · retirar exportaciones con caché | `99 §123`, `§124` + L-115, L-116 · bóveda `2026-10-01-detalle-cargabilidad` |
| ✒ Firmas en Órdenes E/S o en el informe de refrigeración | `99 §114`, `§117`, `§119`, `§121` (+ `§71`, `§99`) · archivos → `22` |
| 📱 El sitio en celular o tablet: el menú ☰ no abre, la barra no cabe, una tabla o gráfica se corta a 375/768 px · tocar `aqua-shell.js` o `aqua-components.css` | `99 §135` + `32` **L-121** · barrido reutilizable (servidor con stubs + iframes de 375/768) → bóveda `2026-10-02-sitio-responsive/crudos/` |
| La zona de Duval de una muestra nueva o del motor de salud cambió o no cuadra (`dga_diagnostico.js` · `duvalTriangle1`) | `99 §131` (regla vieja corregida en `ba117cf`: delega en `zonaDuval1` de `domain/dga_duval.js`; cambia 6 equipos; lo ya guardado no se toca) |
| El papel firmado de Fichas habla de gases (arco, térmica, descargas) o de «ISO 55001»: ¿de dónde sale cada corte y cada cita? | `99 §140` (los cortes no son de norma; frases con fuente en rama) · `52 §7` · nota `§57.8` (los 15 ppm y 0,5 ppm/día del monitoreo NO están en el MO) |
| ¿Volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de Storage? | ANTES, lo ya DESPEJADO: casillas `NN.8` (`§66.8`, `§68.8`, `§73.8`, `§75.8`) + crudo de la bóveda (23 refutados: mecanismo cierto, consecuencia falsa) |
| CI o Deploy en rojo solo por la prueba de velocidad del Diagrama Operativo | `32` **L-122**: relanzar el trabajo fallido, no subir el umbral |
| El "por qué" de una decisión / detalle de un § | Capa 1 (§1-§80 en `00a`) → `99-HISTORIAL-ADR.md` |
| ¿Dónde está la lección `L-NN` / `M-NN`? | `grep -n "^### L-NN " docs/3*-LECCIONES*.md` — `30` y sus hijas `31`-`35` |

> **Doctrinas** → always-on en `CLAUDE.md §3` (3.1 performance · 3.2 aditivo/API estable · 3.3 verifica · 3.4 IAP · 3.5 observers).
