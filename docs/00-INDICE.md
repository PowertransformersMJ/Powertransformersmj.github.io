# 🗂️ 00 — ÍNDICE SINÁPTICO (mapa § → línea + ruteo semántico)

> Puerta de entrada al Largo Plazo (`99`). Dos capas: (1) tabla mecánica §→línea
> (la reconcilia `npm run brain:index` — NO la mantengas a mano); (2) ruteo semántico
> "síntoma → neurona" (esta SÍ es inteligencia curada — aliméntala).
> Regla de oro: NUNCA leer `99` completo — busca el § aquí y lee SOLO ese tramo
> (`Read docs/99-HISTORIAL-ADR.md offset=<línea> limit=~150`).

## Capa 1 — Mapa § → línea de `99-HISTORIAL-ADR.md`

> Formato de fila EXACTO (el reconciliador lo parsea): `| §N | descripción con hook | LINEA |` · descripción ≤ ~90 caracteres: el detalle va en `99`.
>
> **§1–§80 → hija [`00a-INDICE-ADR-001-080.md`](00a-INDICE-ADR-001-080.md)** · **§81–§140 → hija
> [`00b-INDICE-ADR-081-140.md`](00b-INDICE-ADR-081-140.md)** (mismo formato y reconciliación, `99 §120`, `§162`). Aquí, de §141
> en adelante; las filas nuevas se agregan AQUÍ, al final.

| § | Qué resuelve (hook para decidir si leerlo) | Línea |
|---|---|---|
| §141 | ADR-141 — **Órdenes E/S**: cantidad corregible y material «Otro» | 6104 |
| §142 | ADR-142 — **Órdenes E/S**: «Órdenes guardadas» (ver, PDF, Excel, editar) | 6146 |
| §143 | ADR-143 — **Órdenes E/S**: filtro por zona y entregas por transformador | 6184 |
| §144 | ADR-144 — **Órdenes E/S**: indicadores por accesorio, zona, motivo y mes | 6230 |
| §145 | ADR-145 — **Contrato 4125000143**: inventario de Libro4 (pactado, `§145.9`; `§145.10` → cerrado en `§161.7`) | 6283 |
| §146 | ADR-146 — **Contrato ↔ Órdenes E/S**: nexo calculado (luego §147/§148 escriben) | 6347 |
| §147 | ADR-147 — **Contrato ↔ Órdenes E/S**: entregas como movimientos enlazados | 6449 |
| §148 | ADR-148 — **Contrato ↔ Órdenes E/S**: registro automático (equipo, reglas) | 6544 |
| §149 | ADR-149 — **Cerebro**: auditoría Nivel-2 (44 hallazgos, M-10, hija 36) | 6637 |
| §150 | ADR-150 — **Cerebro**: freno al PUBLICAR, consejo externo a pedido, memoria liviana | 6703 |
| §151 | ADR-151 — **Cerebro**: documentación total de la sesión 10-06 → 10-07 | 6749 |
| §152 | ADR-152 — **Mapa de Colombia**: fondo arreglado + mapa DANE en Borrador (parque por municipio) | 6783 |
| §153 | ADR-153 — **Mapa**: S/E ubicadas con el KMZ del Ingeniero (147/147) y sus transformadores | 6863 |
| §154 | ADR-154 — **Inventario**: editar guarda solo lo que cambió (ya no borra matrícula ni condición) | 6994 |
| §155 | ADR-155 — **Mapa**: el botón «Mapa» abre el mapa nuevo (opción 2 suya) | 7061 |
| §156 | ADR-156 — **Mapa**: Mapa y Relieve a voluntad (casillas) | 7099 |
| §157 | ADR-157 — **Mapa**: filtros de salud 1–5 y de Cargabilidad SCADA (CRG) | 7121 |
| §158 | ADR-158 — **Cargabilidad SCADA**: los 77 sin medición; motivo con la causa; relevo de Sampués | 7165 |
| §159 | ADR-159 — **Cargabilidad SCADA por periodo** (p99 exacto con `top`) e historia del equipo | 7339 |
| §160 | ADR-160 — **CRG con la escala del MO** (Muy Bueno…Muy Pobre); lo ofrecido → `§160.7` (dentro de §161) | 7456 |
| §161 | ADR-161 — **Contrato conforme a las órdenes**: 4 órdenes corregidas; el tablero relee las órdenes | 7496 |
| §162 | ADR-162 — **Cerebro**: auditoría Nivel-2 + neurogénesis (00b, 23, 37, 38, lóbulo 54) | 7566 |
| §163 | ADR-163 — **Informe de Mantenimiento Brigada**: F60 de Applus (refrigeración) con listado como Fichas, PDF y Word · TODO-81 | 7679 |
| §164 | ADR-164 — **Cerebro**: espejo PRIVADO en GitHub (`cerebro-mj`); matiza ADR-059, no es respaldo · TODO-29 | 7980 |
| §165 | ADR-165 — **Cargabilidad SCADA**: todos los devanados de placa (tensión, ampacidad, potencia calculada, carga) en lista, CSV y detalle · TODO-69 | 8049 |
| §166 | ADR-166 — **Cargabilidad SCADA**: placa característica de cada equipo en su detalle (foto, lectura, diferencias); carga admin, foto atada a sus bytes · TODO-69 | 8105 |
| §167 | ADR-167 — **Lorica T1** contra su placa + cargabilidad del SCADA (67,4 %, 13,8 kV); una muestra nueva ya no borra la CRG · TODO-54 | 8173 |
| §168 | ADR-168 — **Cargabilidad SCADA**: mes a mes y acumulada a la fecha en cada equipo; «A la fecha» = cargabilidad oficial en la revisión · TODO-69 | 8240 |
| §169 | ADR-169 — **Cargabilidad SCADA**: cada devanado mes a mes frente a sus límites de PLACA (ONAN/ONAF); potencias placa ↔ plataforma ↔ Excel de Salud de Activos · TODO-69/54 | 8288 |

## Capa 2 — Ruteo semántico (síntoma → neurona) — CONSULTA ESTO PRIMERO

| Si el síntoma / la duda es… | Ve a… |
|---|---|
| ¿Dónde vive un módulo / ruta / flujo / componente? | 🗺️ `20-MEMORIA-ESPACIAL` (módulos → `22`; Cargabilidad SCADA → `23`) |
| Voy a mover/renombrar archivos, refactor, merge, deploy | 🧪 `30-LECCIONES` (gotchas) + 🗺️ `20` |
| Otra sesión de Claude trabaja a la vez (mismo repo, misma rama o la bóveda): números de ADR/L, qué sube a `main` | `30` **M-08** (mismo repo) + **M-05** (bóveda) |
| 🪞 ¿El cerebro está en GitHub? Espejo `cerebro-mj`, el otro PC y su buzón · ¿la bóveda tiene remoto o respaldo? | `99 §164` (qué es y qué no) + `../cerebro-mj/CLAUDE.md` · respaldo real → `§162.10` y (J) de `10` |
| Voy a agregar o retirar una exportación de un módulo JS ya publicado (caché del navegador) | `32` **L-102 (3)**: lo nuevo va en un archivo NUEVO; **(4)** no entregar un tipo que el módulo publicado no sepa escribir · retirar → `37` **L-116** |
| Voy a tocar `functions/` o el pipeline de IA (streaming/reintentos/timeouts) | 🤖 `31-LECCIONES-IA` (hija de `30`, L-35/L-43–L-48) |
| Busco un pendiente que no está en `10` (decisión de arquitectura, validación diferida, cola vieja) | 🧊 `11-PENDIENTES-FRIOS` (hija de `10`) |
| Necesito saber qué contiene una hoja `docs/*.md` del dueño | 🗂️ `21-ESPACIAL-HOJAS` (hija de `20`) |
| Voy a lanzar agentes/workflow o fiarme de un barrido por consola | 🛠️ `33-LECCIONES-HARNESS` (hija de `30`) |
| Conduzco SU Chrome, subo datos por la extensión o monto/capturo un banco local · voy a ESCRIBIR datos desde su pestaña tras publicar (**L-130**) | 🌐 `36-LECCIONES-CHROME-BANCO` (hija de `30`) |
| Dos caminos escriben o leen lo mismo (trigger + importador, lectura de una vez + escucha en vivo, módulo viejo en caché, iframe) · lo derivado no cuadra con su fuente | 🧵 `37-LECCIONES-COSTURAS-DATOS` (hija de `30`) |
| Voy a tocar un exportador (PDF/XLSX), un texto que se firma o un Excel del cliente | 🖨️ `38-LECCIONES-PAPEL-EXCEL` (hija de `30`) + cola de Fichas |
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
| 🔵 Cargabilidad (CRG/SCADA), ampacidad, sobrecarga, punto caliente, regla de los 6 °C, «con más carga», DGA × carga | 🎯 `53-CARGA-TERMICA` (archivos → `23`) |
| 🛠️ ¿Qué skill tengo para X? | `docs/skills-inventory.md` + `40-LOBULOS §Recursos` |
| ¿Podemos seguir en GitHub Pages? ¿migramos el hosting? ¿los ToS nos prohíben algo? | `99 §60` (veredicto + runbook Cloudflare + disparadores) — **no re-analizar por calendario** |
| 🛰️ Decisión fuerte / cara de revertir → ¿2ª opinión externa? | `60-WORKFLOWS §W-11` (checklist cerrado) → `15-CONSEJO-EXTERNO` + skills `proceso-decision-fuerte`/`comite-expertos` |
| 🔁 ¿Cómo se corre un proceso repetible? (red-team de reglas, verificar un subagente, criterio multi-norma, importar Excel real, cargar un mes SCADA, cerrar el turno) | 🔁 `60-WORKFLOWS` (W-01..W-14) |
| 🔑 Tocar `scripts/*.mjs` del cerebro / actualizar el kernel | `../brain-private/kernel/README.md` → editar allí + `npm run brain:pull` (NUNCA en el repo: gate #0) |
| 🤖 Extracción de PDFs con IA / Claude API / costos LLM | 🤖 `31` (L-20/L-21) + `99 §3` + Skill `claude-api` |
| 📄 Fichas · Excel PE.02081 · firmas · «Salud y riesgo» · «Diagrama Operativo» | `cola-fichas-tecnicas.md` (cerrados → `cola-fichas-tecnicas-cerrados.md`) + archivos → `22-ESPACIAL-MODULOS` + `99 §82 en adelante` + **L-103** (`38`) |
| ✍️ Redactar o retocar un texto que se FIRMA (Beneficios, Alcance de Fichas) | `51 §7` (vocabulario y método; respaldo: memoria `feedback_redaccion_beneficios`) + `38` **L-88** + bóveda `2026-09-2[5-7]-beneficio-*` (`99 §105`) · preguntas suyas sin respuesta → cola de Fichas, «Tuyo» 9 |
| 📈 Cargabilidad SCADA: curvas horarias, homologación, cargar un mes, sin medición, periodo, DGA × carga, Duval | 🎯 `53-CARGA-TERMICA` (cada tema con su §) · Capa 1 `§122`–`§138`, `§158`–`§160` · archivos → `23` · cargar un mes → `60 §W-13` (paso 8) · lecciones → `37` (L-113, L-114), `32` (L-118–L-120, L-124), L-117 (`36`) · bóveda `2026-10-08-scada-sin-medicion` (TODO-69) |
| 🪟 Ventana de detalle de Cargabilidad (tabla vieja) · una ventana fija dentro de un iframe que no se ve · retirar exportaciones con caché | `99 §123`, `§124` + L-115, L-116 (`37`) · bóveda `2026-10-01-detalle-cargabilidad` |
| ✒ Firmas en Órdenes E/S o en el informe de refrigeración | `99 §114`, `§117`, `§119`, `§121` (+ `§71`, `§99`) · archivos → `22` |
| 📦 Órdenes E/S y Contrato 4125000143: Libro4 y valor, nexo, movimientos, «no cuadra con las órdenes», ENTRADA/SALIDA | 🎯 `54-SUMINISTROS-ORDENES` (criterio) · `22` (archivos) · `99 §141`–`§148`, `§161` · L-137/L-138 (`37`) · L-128 (`38`) · L-129 (`35`) · bóveda `2026-10-09-contrato-conforme-ordenes` |
| 🗺️ Mapa de Colombia · ¿dónde queda una S/E, de qué zona o municipio es, por qué no tiene punto? | `22` (fila Mapa) · `99 §152`–`§157` (zona por municipio «aproximada» `§152.2`; llave = código al final de la matrícula `§153.2`) · zona del ACTIVO = la registrada (`fichas_zona.js`) · L-139 · coordenadas NUNCA al repo (`35` L-140) · bóvedas `2026-10-07-mapa-colombia`, `2026-10-08-ubicacion-subestaciones` · TODO-78 |
| 📱 El sitio en celular o tablet: el menú ☰ no abre, la barra no cabe, una tabla o gráfica se corta a 375/768 px · tocar `aqua-shell.js` o `aqua-components.css` | `99 §135` + `32` **L-121** · barrido reutilizable (servidor con stubs + iframes de 375/768) → bóveda `2026-10-02-sitio-responsive/crudos/` |
| La zona de Duval de una muestra nueva o del motor de salud cambió o no cuadra (`dga_diagnostico.js` · `duvalTriangle1`) | `99 §131` (regla vieja corregida en `ba117cf`: delega en `zonaDuval1` de `domain/dga_duval.js`; cambia 6 equipos; lo ya guardado no se toca) |
| El papel firmado de Fichas habla de gases (arco, térmica, descargas) o de «ISO 55001»: ¿de dónde sale cada corte y cada cita? | `99 §140` (los cortes no son de norma; frases con fuente en rama) · `52 §7` · nota `§57.8` (los 15 ppm y 0,5 ppm/día del monitoreo NO están en el MO) |
| ¿Volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de Storage? | ANTES, lo ya DESPEJADO: casillas `NN.8` (`§66.8`, `§68.8`, `§73.8`, `§75.8`) + crudo de la bóveda (23 refutados: mecanismo cierto, consecuencia falsa) |
| CI o Deploy en rojo solo por la prueba de velocidad del Diagrama Operativo | `32` **L-122**: relanzar el trabajo fallido, no subir el umbral |
| El "por qué" de una decisión / detalle de un § | Capa 1 (§1–§80 en `00a`, §81–§140 en `00b`) → `99-HISTORIAL-ADR.md` |
| ¿Dónde está la lección `L-NN` / `M-NN`? | `grep -n "^### L-NN " docs/3*-LECCIONES*.md` — `30` y sus hijas `31`-`38` |

> **Doctrinas** → always-on en `CLAUDE.md §3` (3.1 performance · 3.2 aditivo/API estable · 3.3 verifica · 3.4 IAP · 3.5 observers).
