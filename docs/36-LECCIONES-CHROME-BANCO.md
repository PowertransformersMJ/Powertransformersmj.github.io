# 🌐 36 — LECCIONES · El Chrome del Ingeniero, la extensión y el banco de pruebas (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, 2026-10-07, `99 §149`: lo pidió la auditoría del 10-02 (S6-07) y en su lugar
> se había subido el tope de `33`). Reúne, **copiadas sin cambiar una letra**, las lecciones de automatizar SU navegador
> (extensión de Chrome, subir datos, no tocar lo que tiene abierto) y del **banco local** (importmap, capturas, scratchpad
> que se poda). Salieron de `33` (L-62, L-92, L-94, L-105) y de `30` (L-117); **L-130 es nueva** (`§149`). Las referencias
> internas de estas lecciones a `30`/`33` (p. ej. «L-117 (`30`)») hoy son `36`. Se lee on-demand (trigger 🧪 Experiencia)
> **antes de conducir su Chrome, subir datos por la extensión o montar/capturar un banco**.

---

### L-62 · Automatizar el Chrome del Ingeniero: subir archivos = gesto humano; localhost bloqueado
**Disparador**: inyectar un archivo local a un file-input de la app vía la extensión de Chrome. · **Cicatriz** (2026-07-23, carga del informe LEL27007): `file_upload` de la extensión solo acepta archivos compartidos a la sesión (ni scratchpad); `fetch` a `http://127.0.0.1` desde página https queda COLGADO por Local Network Access de Chrome (ni con headers PNA/CORS — el prompt de permiso no aparece en fetch programático); los inputs de wizards nacen ocultos en su paso (`display:none`). · **Regla**: la vía robusta es el **drag&drop del usuario** — prepararle todo: `open -R "<archivo>"` revela el PDF seleccionado en Finder y el arrastre son 5 s; si el input está oculto, hacerlo visible con JS es legítimo para diagnóstico. NO pelear contra los candados (son de seguridad, no bugs); presupuestar el gesto humano en el flujo.
**Datos grandes** (meses SCADA): paquete por `file_upload` ≤ 9 MiB desde Descargas, una parte por llamada → L-117 (`30`).

### L-92 · Banco de una página con sesión: `importmap` con rutas absolutas sustituye los imports relativos
**Disparador**: probar en local una página que exige sesión de Firebase (el guard la tapa en `localhost`, L-62) y cuyos caminos difíciles (choque, sin red, permiso) no se pueden provocar en producción sin escribir datos reales. · **Cicatriz** (`99 §77`): el registro de OE/OS tenía 15 caminos de estado-cero y borde; en producción solo se podía leer. · **Receta**: copia la página a `_dev/zz-*.html` (gitignored), quita `page-guard`, cambia `../assets/` por `/assets/` y declara un `<script type="importmap">` cuyas **claves son rutas absolutas** (`"/assets/js/auth/session-guard.js": "/_dev/zz-mock-sesion.js"`): el navegador resuelve el import relativo del módulo a esa URL y la mapea al mock. Mocks con la MISMA interfaz (sesión, datos) controlados por `window.__estado` y persistidos en `sessionStorage` para sobrevivir a recargas. Se recorre todo por `javascript_tool` leyendo el DOM, sin tocar el código de producción. · **Ojo**: las capturas del panel Browser salieron **negras** con un `<dialog>` modal abierto (y luego con el panel oculto): el diálogo se verifica por DOM (`open`, textos, botones) y la evidencia visual se toma en el Chrome real. · **Y** no termines un script de verificación con `location.reload()`: se pierde el valor devuelto. · **Antes/después sin copiar nada** (`99 §119.9`): el servidor del banco sirve `/__antes/<ruta>` con `git show HEAD:<ruta>` y el importmap mapea también `/__antes/assets/js/...` a los mocks: `?v=antes` corre el código publicado sobre los mismos datos (reprodujo los dos huecos antes de arreglarlos). · **El scratchpad se poda de madrugada aun con la sesión viva** (10-05: cayeron `banco-fichas`, `banco-scada`, `fichas-preview` y `cdp-cap.mjs`, que `.claude/launch.json` aún nombra) y cada conversación recibe otro: lo que se reusará va a `_dev/zz-*` (sin datos reales) o a la bóveda.

### L-94 · Validar en vivo sin tocar lo que el Ingeniero tiene abierto
**Disparador**: validar un despliegue con la sesión del Ingeniero en Chrome. · **Cicatriz** (`99 §78`): una pestaña nueva cayó en la pantalla de acceso —inició sesión SIN «Mantener sesión en este dispositivo», que usa `browserSessionPersistence`: la sesión vive solo en ESA pestaña— y la suya tenía un formulario sin guardar (el aviso de salida bloquea recargar). · **Receta**: no recargar ni descartar; desde SU pestaña, `await import('/assets/js/data/<modulo>.js?v=N')` carga el módulo nuevo y comparte la misma instancia de Firebase y sesión (mismas URLs de `firebase-init.js` y `session-guard.js`), así se prueban reglas y datos en producción; nunca escribir la contraseña. · **Y en el banco local**: con el panel Browser oculto los temporizadores se frenan y `javascript_tool` corta a los 45 s: acciones cortas sin esperas largas y lectura del estado en llamadas aparte. · **Ampliación (`99 §108`)**: una acción que ESCRIBE en producción no sirve para validar: «Exportar Excel» del custodio registra la emisión con folio en `fichas_emisiones`. En vivo se recorre la **vista previa** (solo lectura); la descarga real es del Ingeniero; el Excel se prueba en el banco o con `?nocustodio=1`. · **Por defecto** (`§107`→`§135`): pestaña APARTE, solo lectura, cerrada al terminar (si cae en el acceso → la receta de arriba; sin sesión → su lista (I)). **Nunca un diálogo en su pestaña**: un `confirm()` de prueba congeló el SGM hasta que él pulsó Aceptar (`§102`); se prueban en el banco.
· **Ampliación (`99 §147`, 10-07)**: la extensión solo alcanza las pestañas de SU grupo «Claude». Su pestaña con sesión, fuera
del grupo, no se puede conducir, y una nueva dentro del grupo cae en el acceso: (A) él inicia sesión en la pestaña del grupo o
(B) arrastra su pestaña al grupo. Nunca se escribe su contraseña. Si la conexión no encuentra navegador: Chrome cerrado,
extensión sin instalar o panel lateral sin sesión en la misma cuenta; una captura suya confirma el grupo y se reintenta. Si la
pestaña queda abierta al terminar, se le dice.

### L-105 · Capturar el banco: `--screenshot` de Chrome sin cabeza no espera un flujo asíncrono; se conduce por CDP
**Disparador**: necesitar la captura en ARCHIVO de un estado del banco que se arma solo (importaciones diferidas, `fetch`,
esperas) para enviársela al Ingeniero. · **Cicatriz** (`99 §112`): `chrome --headless --screenshot` con
`--virtual-time-budget=25000` devolvió dos veces solo la cabecera del banco (el flujo no corrió), y la captura de la
extensión con `save_to_disk` no dejó archivo. · **Regla**: lanzar Chrome sin cabeza con `--remote-debugging-port` y
conducirlo por CDP desde Node 24 (trae `WebSocket` y `fetch`, sin librerías): `Page.navigate` → sondear
`Runtime.evaluate('document.title')` hasta la señal que pone el flujo (`LISTO`) → `Page.captureScreenshot` a escala 2 →
recortar a la ventana con PIL (fuera quedan firmas y datos del fondo). El guion vivía en el scratchpad de la sesión
(`cdp-cap.mjs`) y ya se podó (L-92): se rehace en 40 líneas. [HONOR] · **Sin CDP también sirve** (10-06): el banco inyecta un guion que sondea y actúa solo (`?clic=<id>`), `--virtual-time-budget=20000` y se mata Chrome apenas existe el PNG (no sale solo). **A 375 px Chrome sin cabeza CORTA la imagen** (ventana mínima ~500): se captura un iframe del ancho exacto (`marco.html`, bóveda `2026-10-06-ordenes-indicadores`).

### L-117 · Datos grandes por la extensión: un paquete que alimenta el MISMO lector, y su equivalencia probada con datos reales

`99 §125`: la extensión de Chrome sube ≤ 10 MB por llamada y solo de carpetas permitidas (Downloads sí, Documents no),
no suelta archivos dentro de Chrome y un clic por coordenadas no llega a una pestaña que no está al frente; un mes del
SCADA pesa ~650 MB. **Regla**: (1) no se escribe un camino paralelo: se adelgaza el insumo (solo lo que el lector usa,
marcas con el tamaño original) y se entrega al MISMO lector; (2) antes de producción se prueba la EQUIVALENCIA con los
datos reales (lo que se escribiría, byte a byte) más un control negativo que el sistema debe frenar; (3) partes ≤ 9 MiB
con su huella en el nombre, comprobada al juntar; (4) los paquetes llevan datos reales: salida prohibida dentro del
repo y su extensión en `.gitignore`; (5) en la pestaña: `element.click()` por JS y sondeos cortos (la evaluación corta a
los 45 s). **Gate**: `tests/scada_carga_paquete.test.js` (formato, filtro = lector, empaquetador de punta a punta).
**Y en `§126`** (paquete con máx/mín, 6–8 partes por mes): el límite de 10 MB de la extensión se cuenta por LLAMADA y
también por `browser_batch` (suma las subidas del lote): una parte por llamada; un campo auxiliar FIJO que reenvía al de
la página evita volver a buscar el campo que la página repinta; en paralelo alguna subida «no responde a tiempo» aunque
SÍ llega: se confirma con un contador en la página, no con la respuesta de la herramienta.

### L-130 · Antes de ESCRIBIR datos de producción desde SU pestaña con un JS recién publicado: servido, 10 min y su módulo
**Disparador**: se acaba de publicar código y lo siguiente es escribir datos reales desde la pestaña del Ingeniero (registrar,
importar, corregir). · **Cicatriz** (`99 §147.3`/`§147.5`): con el JS viejo vivo en su pestaña, el registro de entregas habría
escrito movimientos SIN enlace con su orden —contados dos veces—; la regla solo estaba en el ADR y la auditoría del 10-07 la
encontró dispersa (S3-02, `§149`). · **Regla**: (1) servido = main archivo por archivo (curl + shasum, L-65); (2) esperar
≥ 10 min (max-age=600 del CDN de Pages; sin `?v=`, L-102); (3) en SU pestaña, `import()` del módulo y comprobar que trae la
función nueva; si no, `fetch(u, {cache:'reload'})` y recargar. Sin los tres, no se escribe. **Gate**: [HONOR] + el código
escritor se niega con un módulo viejo (`registrarDesdeOrden` exige `orden_es`, `§147`).

### L-131 · Un flujo ENTRE páginas (guardar en una, ver en otra) se prueba con el almacén en el PADRE
**Disparador**: verificar en el banco algo que nace en una página y se ve en otra (guardar una orden → el contrato la registra →
el Histórico la muestra). · **Cicatriz** (`99 §148`): el simulador de Firestore vivía en la memoria de cada página; al navegar se
perdía, no entendía campos con punto (`orden_es.clave`), su `onSnapshot` era de una sola lectura (el tablero no veía lo recién
escrito) y sus fechas no tenían `toMillis` (la creación de la orden salía en 0 y todo parecía «desfasado»). · **Regla**: una
página-arnés (`flujo.html`) con el almacén y los oyentes en el padre y cada página en un iframe; **sembrar SOLO en el padre**
(una semilla dentro del iframe crea su propio almacén); simulador con campos con punto, tiempo real (re-llamar a los oyentes
tras cada escritura) y fechas con `toMillis`; un interruptor para tumbar una colección (`?caida=transformadores`). Banco de
referencia: bóveda `2026-10-07-registro-automatico/crudos/banco/` (`node server.mjs <repo>`). **Gate**: [HONOR].
