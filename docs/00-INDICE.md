# 🗂️ 00 — ÍNDICE SINÁPTICO (mapa § → línea + ruteo semántico)

> Puerta de entrada al Largo Plazo (`99`). Dos capas: (1) tabla mecánica §→línea
> (la reconcilia `npm run brain:index` — NO la mantengas a mano); (2) ruteo semántico
> "síntoma → neurona" (esta SÍ es inteligencia curada — aliméntala).
> Regla de oro: NUNCA leer `99` completo — busca el § aquí y lee SOLO ese tramo
> (`Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150`).

## Capa 1 — Mapa § → línea de `99-HISTORIAL-ADR.md`

> Formato de fila EXACTO (el reconciliador lo parsea): `| §N | descripción con hook | LINEA |` · descripción ≤ ~90 caracteres: el detalle va en `99`.
>
> **§1–§80 → hija [`00a-INDICE-ADR-001-080.md`](00a-INDICE-ADR-001-080.md)** (mismo formato, misma
> reconciliación, `99 §120`). Aquí, de §81 en adelante; las filas nuevas se agregan AQUÍ, al final.

| § | Qué resuelve (hook para decidir si leerlo) | Línea |
|---|---|---|
| §81 | ADR-081 — **Potencia y usuarios EN la casilla** (informativo); la casilla sigue siendo la de la norma | 3271 |
| §82 | ADR-082 — **Cada TX abre SU ficha**: el «CODIGO SUBESTACION» dejó de ser la identidad (dos TX de un patio compartían ficha) | 3320 |
| §83 | ADR-083 — **Borrador local de la ficha** con dueño y caducidad (no pisa ni cruza equipos) | 3369 |
| §84 | ADR-084 — **La carga tardía ya no borra el listado**; el pie del papel dice su fuente real | 3475 |
| §85 | ADR-085 — **El alcance lo escribe la redacción dictada** por el Ingeniero | 3521 |
| §86 | ADR-086 — **Auditoría Nivel-2**: 53 hallazgos; kernel sin IDs ajenos | 3581 |
| §87 | ADR-087 — **Tanda B, el Excel que se firma**: Valor Real, `[PENDIENTE]` nunca «0» | 3639 |
| §88 | ADR-088 — **Período y firmas con la forma del Excel** (Aprobación con dos firmantes) | 3722 |
| §89 | ADR-089 — **Quién firma**: lista dictada por el Ingeniero, ficha y Excel (CF-25) | 3754 |
| §90 | ADR-090 — **El Alcance muestra solo el alcance**: fuera el selector de acciones | 3808 |
| §91 | ADR-091 — **Fechas con calendario**: se ven «dd/mm/aaaa» y el calendario se abre al tocarlas | 3843 |
| §92 | ADR-092 — **Beneficios por práctica**: el selector pasa a Beneficios y propone el texto con lo escogido | 3866 |
| §93 | ADR-093 — **Valor Real vacío ⇒ en blanco** (J36 y su total), no `[PENDIENTE]` ni aviso | 3898 |
| §94 | ADR-094 — **Año de entrada con calendario de años** desde 2020 | 3933 |
| §95 | ADR-095 — **Beneficios de Mantenimiento** siguen a las prácticas marcadas, en breve | 3975 |
| §96 | ADR-096 — **Mantenimiento sin casillas pre-marcadas** | 4027 |
| §97 | ADR-097 — **Beneficios sin subtítulos** | 4046 |
| §98 | ADR-098 — **Firma estampada** de la sesión | 4061 |
| §99 | ADR-099 — **Firmas del equipo bajo custodia** | 4093 |
| §100 | ADR-100 — **Firmas en Firestore** (Storage daba 503) | 4185 |
| §101 | ADR-101 — **Firmas de tamaño parejo** | 4213 |
| §102 | ADR-102 — **Vista previa del Excel + PDF** | 4227 |
| §103 | ADR-103 — **Mantenimiento al PE.02081** | 4254 |
| §104 | ADR-104 — **Excel sin datos ocultos** | 4273 |
| §105 | ADR-105 — **Beneficios con las 13 acciones** | 4303 |
| §106 | ADR-106 — **Zona del activo** | 4339 |
| §107 | ADR-107 — **«Salud y riesgo» al Excel** (sin usuarios, sin casilla) | 4353 |
| §108 | ADR-108 — **Siempre las cinco firmas** y folio al exportar | 4387 |
| §109 | ADR-109 — **Auditoría Nivel-2** (M-07) | 4408 |
| §110 | ADR-110 — **Sin hoja Beneficios**; Futuro derecho | 4435 |
| §111 | ADR-111 — **«Salud y riesgo»**: sin lectura por potencia; nota 7 variables | 4467 |
| §112 | ADR-112 — **«Diagrama Operativo»**: adjunto, última hoja | 4486 |
| §113 | ADR-113 — **CF-40**: lector en un hilo con tiempo límite | 4573 |
| §114 | ADR-114 — **Órdenes E/S**: firmas en Autorizado y Entregado | 4620 |
| §115 | ADR-115 — **«Salud y riesgo» letra grande**; Actual anclado | 4667 |
| §116 | ADR-116 — **Sesión**: lectura lenta ≠ sin perfil | 4739 |
| §117 | ADR-117 — **Órdenes E/S**: firmas delegadas | 4790 |
| §118 | ADR-118 — **Diagrama Operativo**: permiso puntual para adjuntar | 4852 |
| §119 | ADR-119 — **Fichas**: firmas delegadas (Carlos, Jorge) | 4897 |
| §120 | ADR-120 — **Cerebro partido en hijas** (`00a`, `22`, `34`, `35`, CF cerrados); kernel reconcilia el índice por rangos | 4987 |
| §121 | ADR-121 — **Fichas**: «Elaboración» por defecto sigue a la sesión (Carlos, Jorge) | 5063 |
| §122 | ADR-122 — **Cargabilidad SCADA**: carga horaria real vs ampacidad del devanado, CRG firme/provisional, «Datos SCADA» (homologación y meses) | 5106 |
| §123 | ADR-123 — **Detalle de Cargabilidad**: la ventana de la tabla priorizada abre con el parque real, sin cifras sin dato y a la vista en la pestaña (iframe) | 5203 |
| §124 | ADR-124 — **Detalle de Cargabilidad**: «Diagnóstico» con las 7 calificaciones de Salud de Activos y enlace a las curvas horarias medidas por el SCADA (decisiones del Ingeniero) | 5278 |
| §125 | ADR-125 — **Cargabilidad SCADA con datos**: «Paquete preparado» (un mes en 3 partes por la extensión, mismo lector), homologación v2 y 8 meses cargados, arreglos de la revisión | 5334 |
| §126 | ADR-126 — **Cargabilidad SCADA: máx/mín/instantáneo** con filtro «Valores a mostrar» y «Fases» (solo para ver; la cifra igual) + una gráfica grande por magnitud con zoom compartido; 8 meses recargados | 5400 |
| §127 | ADR-127 — **Cargabilidad SCADA**: panel DGA × carga (adversidades y acciones; borrador) | 5466 |
| §128 | ADR-128 — **Auditoría Nivel-2 del cerebro** (59 hallazgos; gate #14 mal calibrado) | 5540 |
| §129 | ADR-129 — **Cargabilidad SCADA**: marca «sostenida» de la lista sin falsos | 5589 |
| §130 | ADR-130 — **Cargabilidad SCADA**: «Máximo sostenido 2 h» con serie limpia | 5634 |
| §131 | ADR-131 — **Cargabilidad SCADA**: triángulo de Duval hoy y con más carga | 5665 |
| §132 | ADR-132 — **Cargabilidad SCADA**: gases con más carga, punto caliente IEC 60076-7 | 5745 |
| §133 | ADR-133 — **Cargabilidad SCADA**: textos del panel DGA con/sin ppm | 5791 |
| §134 | ADR-134 — **Cargabilidad SCADA**: triángulo «con más carga» junto al de hoy | 5821 |
| §135 | ADR-135 — **Interfaz**: el sitio en celular y tablet (menú ☰) | 5842 |
| §136 | ADR-136 — **Cerebro**: mantenimiento de 5 lentes · TODO-68 → L-122 | 5886 |
| §137 | ADR-137 — **Cerebro · dominio**: nacen los lóbulos 51, 52 y 53 · TODO-73 | 5921 |
| §138 | ADR-138 — **Cargabilidad SCADA**: libro de parámetros por punto (columna C) | 5976 |
| §139 | ADR-139 — **Cerebro**: documentación de la conversación 09-23 → 10-05 | 6003 |
| §140 | ADR-140 — **Fichas**: CF-38 · CF-43/44 en rama · decisiones de TODO-69 | 6037 |
| §141 | ADR-141 — **Órdenes E/S**: cantidad corregible y material «Otro» | 6096 |
| §142 | ADR-142 — **Órdenes E/S**: «Órdenes guardadas» (ver, PDF, Excel, editar) | 6138 |
| §143 | ADR-143 — **Órdenes E/S**: filtro por zona y entregas por transformador | 6176 |
| §144 | ADR-144 — **Órdenes E/S**: indicadores por accesorio, zona, motivo y mes | 6222 |
| §145 | ADR-145 — **Contrato 4125000143**: inventario de Libro4 (pactado, `§145.9`) | 6275 |
| §146 | ADR-146 — **Contrato ↔ Órdenes E/S**: nexo calculado (luego §147/§148 escriben) | 6338 |
| §147 | ADR-147 — **Contrato ↔ Órdenes E/S**: entregas como movimientos enlazados | 6440 |
| §148 | ADR-148 — **Contrato ↔ Órdenes E/S**: registro automático (equipo, reglas) | 6535 |
| §149 | ADR-149 — **Cerebro**: auditoría Nivel-2 (44 hallazgos, M-10, hija 36) | 6628 |
| §150 | ADR-150 — **Cerebro**: freno al PUBLICAR, consejo externo a pedido, memoria liviana | 6694 |
| §151 | ADR-151 — **Cerebro**: documentación total de la sesión 10-06 → 10-07 | 6740 |
| §152 | ADR-152 — **Mapa de Colombia**: fondo arreglado + mapa DANE en Borrador (parque por municipio) | 6774 |
| §153 | ADR-153 — **Mapa**: S/E ubicadas con el KMZ del Ingeniero (142/147) y sus transformadores | 6854 |
| §154 | ADR-154 — **Inventario**: editar guarda solo lo que cambió (ya no borra matrícula ni condición) | 6975 |
| §155 | ADR-155 — **Mapa**: el botón «Mapa» abre el mapa nuevo (opción 2 suya) | 7042 |
| §156 | ADR-156 — **Mapa**: Mapa y Relieve a voluntad (casillas) | 7080 |

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
| Voy a lanzar agentes/workflow o fiarme de un barrido por consola | 🛠️ `33-LECCIONES-HARNESS` (hija de `30`) |
| Conduzco SU Chrome, subo datos por la extensión o monto/capturo un banco local · voy a ESCRIBIR datos desde su pestaña tras publicar (**L-130**) | 🌐 `36-LECCIONES-CHROME-BANCO` (hija de `30`) |
| Voy a GUARDAR desde un formulario que no muestra todo el documento (editar un equipo, una S/E…) | `30` **L-134** + `99 §154` (`actualizarCampos`) |
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
| 📈 Cargabilidad SCADA: curvas horarias, homologación, carga de un mes, DGA × carga, Duval | 🎯 `53-CARGA-TERMICA` (cada tema con su §) · Capa 1 `§122`–`§138` · archivos y `scada_*` → `22` · L-113 · L-114 (botón ilegible, CSS compartida) · L-117 (un mes en paquete, `36`) · L-118 · L-119 (sostenida) · L-120 (antes/después: valores) · L-124 (aviso «falta» falso) · bóvedas `2026-09-30`…`2026-10-02` (TODO-69) |
| 🪟 Ventana de detalle de Cargabilidad (tabla vieja) · una ventana fija dentro de un iframe que no se ve · retirar exportaciones con caché | `99 §123`, `§124` + L-115, L-116 · bóveda `2026-10-01-detalle-cargabilidad` |
| ✒ Firmas en Órdenes E/S o en el informe de refrigeración | `99 §114`, `§117`, `§119`, `§121` (+ `§71`, `§99`) · archivos → `22` |
| 📦 Órdenes E/S y Contrato 4125000143: Libro4 y valor, nexo, movimientos enlazados y automáticos, reglas del técnico | `99 §141` en adelante · `22` (filas Órdenes y Contratos) · L-128 (`32`) · L-129 (`35`) · vocabulario: entregas a trafo = órdenes de ENTRADA (`§143.9`) |
| 📱 El sitio en celular o tablet: el menú ☰ no abre, la barra no cabe, una tabla o gráfica se corta a 375/768 px · tocar `aqua-shell.js` o `aqua-components.css` | `99 §135` + `32` **L-121** · barrido reutilizable (servidor con stubs + iframes de 375/768) → bóveda `2026-10-02-sitio-responsive/crudos/` |
| La zona de Duval de una muestra nueva o del motor de salud cambió o no cuadra (`dga_diagnostico.js` · `duvalTriangle1`) | `99 §131` (regla vieja corregida en `ba117cf`: delega en `zonaDuval1` de `domain/dga_duval.js`; cambia 6 equipos; lo ya guardado no se toca) |
| El papel firmado de Fichas habla de gases (arco, térmica, descargas) o de «ISO 55001»: ¿de dónde sale cada corte y cada cita? | `99 §140` (los cortes no son de norma; frases con fuente en rama) · `52 §7` · nota `§57.8` (los 15 ppm y 0,5 ppm/día del monitoreo NO están en el MO) |
| ¿Volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de Storage? | ANTES, lo ya DESPEJADO: casillas `NN.8` (`§66.8`, `§68.8`, `§73.8`, `§75.8`) + crudo de la bóveda (23 refutados: mecanismo cierto, consecuencia falsa) |
| CI o Deploy en rojo solo por la prueba de velocidad del Diagrama Operativo | `32` **L-122**: relanzar el trabajo fallido, no subir el umbral |
| El "por qué" de una decisión / detalle de un § | Capa 1 (§1-§80 en `00a`) → `99-HISTORIAL-ADR.md` |
| ¿Dónde está la lección `L-NN` / `M-NN`? | `grep -n "^### L-NN " docs/3*-LECCIONES*.md` — `30` y sus hijas `31`-`36` |

> **Doctrinas** → always-on en `CLAUDE.md §3` (3.1 performance · 3.2 aditivo/API estable · 3.3 verifica · 3.4 IAP · 3.5 observers).
