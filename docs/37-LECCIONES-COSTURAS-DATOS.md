# 🧵 37 — LECCIONES · Costuras de datos, caché e iframes (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, 2026-10-11, `99 §162`: `30` llegó al 98 % de su tope y el plan estaba escrito
> desde `§149.4`). Reúne lo que se rompe en la **COSTURA** entre dos caminos que por separado están bien: dos escritores del mismo
> objeto, la ventana de un periodo, la caché del navegador ante un módulo que cambia, un iframe, una casilla que alimenta un papel,
> un dato derivado que se corrige en su fuente. **Copiadas sin cambiar una letra** de `30`: L-96, L-113…L-116, L-126; **nuevas**
> L-137 y L-138 (`§162`). Se lee on-demand (trigger 🧪 Experiencia) **antes de tocar un camino de escritura compartido, retirar o
> agregar una exportación, leer dos colecciones en una misma cifra o meter una pantalla en un iframe**.

---

### L-96 · Un trigger que reemplaza un objeto entero borra lo que otro camino escribió

`onMuestraCreate` hacía `update({ salud_actual: snapshotDelMotor })`. Correcto cuando el motor era el único
que escribía ahí; destructivo desde que el importador del Excel pasó a fijar la condición oficial en ese
MISMO objeto (`99 §80`). El dominio estaba bien, el importador estaba bien, y aun así el dato se perdía:
el defecto solo existe en la COSTURA entre los dos caminos.

**La regla**: cuando dos caminos escriben el mismo sub-objeto, ninguno lo reemplaza entero — se actualiza
por campos o se fusiona con una función pura que declare quién manda sobre cada campo (y que la procedencia
quede guardada, no deducida). Y eso se prueba donde vive el defecto: una prueba del dominio no lo ve; hace
falta una de integración que ejecute el trigger de verdad (emulador de Functions, `npm run test:trigger`).

### L-113 · Datos rotulados por el FIN de la hora: el mes es lo que el origen rotula en él, y los agregados compartidos solo crecen

`99 §122`: la lista resumía las 744 horas que el SCADA rotula en agosto (la primera, 00:00 del día 1, es el promedio
de 23:00 a 00:00 del 31 de julio) y el detalle pedía «agosto» como [1-ago 00:00, 1-sep 00:00): una hora corrida, el
mes siguiente leído de más y una cifra distinta para el «mismo» mes. Y el catálogo y el resumen se escribían con la
foto tomada al simular: dos cargas a la vez se borraban meses entre sí (probado en el emulador). **Regla**: (1) la
ventana de un periodo se define UNA vez, con la convención del origen, y la usan TODAS las vistas (`ventanaDeMes`);
mostrar las horas como las rotula el origen; (2) un documento que agrega lo de varios escritores se funde DENTRO de una
transacción con lo guardado en ese instante, y la regla exige que no encoja (`keys().hasAll(resource…keys())`); antes de
escribir lo derivado de una simulación, comprobar que nadie escribió entre medias. **Gate**: pruebas de `ventanaDeMes`
y `fundirCatalogo` + regla con casos de encoger negados (`tests-rules/scada_carga.rules.test.js`).

### L-114 · Un `<a>` con forma de botón hereda el color de enlace del sitio: el estado vacío también se mira en producción

`99 §122.9`: el Ingeniero abrió «Cargabilidad SCADA» y «no se aprecia nada». La página estaba bien (no hay datos aún),
pero su único botón, `<a class="btn btn--primary">`, salía azul sobre azul: `body.aqua a` (0,1,2) le gana a `.btn`
(0,1,0). Y lo elegido con fondo translúcido (`rgba(…,.12)`) se pierde sobre la foto de fondo del shell. En el banco
se había probado el camino CON datos; el estado vacío —lo PRIMERO que ve el dueño— nunca se miró de cerca. **Regla**:
(1) un enlace que luce como botón fija su color dentro del alcance del módulo (`.cscada a.btn`); (2) lo seleccionado y
los paneles de lectura van con fondo sólido o casi sólido sobre la foto; (3) la pantalla vacía dice QUÉ falta y quién lo
hace, paso por paso, y se valida en vivo igual que la llena. [HONOR]
**Y `§126.9`**: antes de dar un nombre de clase CSS nuevo, buscarlo en la hoja del módulo — `.cs-filtros` ya era la barra de la lista
y la regla nueva la cambió de cuadrícula a fila libre sin que nadie mirara la lista. Al tocar el CSS de un módulo se revisan
TODAS sus pantallas, no solo la del cambio. [HONOR]
**Y del banco de `§122`**: el `append` nativo del DOM no ignora `null` ni `undefined`: los escribe como texto («null» salió en el cuadro «Revisar» de la homologación). El ayudante `el()` del módulo sí los salta; con `append` directo, filtrar antes (`.filter(Boolean)`). [HONOR]


### L-115 · Una ventana fija dentro de un iframe estirado no se ve donde está el usuario: se prueba por CADA entrada

`99 §123`: el detalle de la tabla de Cargabilidad se arregló, pasó pruebas y banco con la página DIRECTA… y dentro de
la pestaña de Seguimiento Operativo (iframe que la madre estira a todo su alto) se habría seguido viendo «no abre»: el
fondo `position:fixed` cubre el iframe entero y la ventana se pintaba en su tope, 886 px fuera de la pantalla. En
producción, además, la barra de pestañas fija tapaba la X. `scrollIntoView` no sirve (no desplaza la madre por un
elemento fijo). **Regla**: (1) una pantalla que vive en más de una entrada (directa e iframe) se valida en TODAS, con
el usuario donde de verdad hace clic (abajo, en la tabla); (2) dentro de un iframe, lo «visible» se mide desde la madre
(`frameElement` + `elementFromPoint`, con una franja libre, no un píxel) y nunca se supone qué barras fijas tiene;
(3) al cambiar la FORMA de una fila, recorrer todos sus consumidores en el camino vivo (el detalle llevaba roto desde
julio porque nadie abrió la ventana). **Gate**: pruebas de `cargabilidad_detalle` + [HONOR] para las entradas.


### L-116 · Retirar una exportación también choca con la caché: el importador VIEJO la sigue pidiendo

`99 §124`: la ventana de Cargabilidad dejó de usar ocho exportaciones (la curva de ejemplo, el vocabulario viejo del
diagnóstico). Borrarlas en la misma publicación habría tumbado la página a quien tuviera en caché el `modal-detalle.js`
anterior (`max-age=600`): su `import { DIAG_MAP }` falla y el módulo entero no carga — el espejo de L-102. **Regla**:
(1) lo que un módulo deja de importar se CONSERVA en esa publicación, con una nota «compat de caché» y su motivo;
(2) se retira en una publicación POSTERIOR, pasados ≥ 10 min del despliegue; (3) antes de retirarlo, grep en todo el
repo (assets, pages, admin, tests, _dev, functions, scripts, api) de que nadie más lo usa. **Gate** [HONOR] (TODO-57 es
el arreglo de fondo: versionar los assets).

### L-126 · Una casilla editable dentro de una tabla: lo válido se confirma al escribir, no al salir
**Disparador**: convertir en casilla un dato que alimenta un documento o un guardado (cantidad, monto, fecha). · **Cicatriz**
(`99 §141`): la cantidad de Órdenes se confirmaba en `change`; Ctrl+S/P/Q leían la orden con la casilla aún enfocada y el
PDF firmado salía con la cifra vieja mientras la pantalla mostraba la nueva, y Escape (que debía cerrar la vista previa)
borraba lo escrito. · **Regla**: (1) lo válido se guarda en `input`; `change` solo revierte lo inválido al valor que tenía al
entrar; (2) los atajos que leen el formulario sueltan primero la casilla enfocada (`blur`), NUNCA dentro de la función que
lee (la llama un temporizador mientras se escribe); (3) la rueda sobre un `type=number` enfocado lo cambia sin que se note:
soltarla; (4) lo que se pinta en la casilla sale formateado igual que en el papel. Gate: `tests/ordenes_items.test.js`.

### L-137 · Una cifra que cruza una lectura de UNA vez con una escucha EN VIVO miente cuando cambia la de una vez
**Disparador**: un tablero que combina dos colecciones y solo una se escucha en vivo (o la otra queda en caché). · **Cicatriz**
(`99 §161.1`): el tablero del contrato y la pestaña Movimiento leían las órdenes una vez por visita y los movimientos en vivo; al
editar una orden con el contrato abierto mezclaban la orden VIEJA con el movimiento NUEVO («1 por registrar», valor y existencia
inflados) hasta recargar. · **Regla**: (1) las dos fuentes de una cifra tienen la MISMA frescura, o la de una vez se relee cuando
cambia algo enlazado (huella), al volver tras > 1 min y con «Actualizar» (`domain/contrato_relectura.js`); (2) la pantalla dice de
cuándo es lo leído («Órdenes leídas a las hh:mm»); (3) con una relectura pendiente nada escribe con la foto vieja; (4) sin escucha
en vivo de colecciones enteras (free-tier). **Gate**: `tests/contrato_relectura.test.js`.

### L-138 · Lo que se DERIVA de otro documento se corrige en su FUENTE: el registro automático rehace lo que se borre a mano
**Disparador**: «la cifra no cuadra» en algo que un registro automático rehace desde otro documento (contrato ← órdenes E/S). ·
**Cicatriz** (`99 §161`, `§148`): el cálculo cuadraba; las diferencias venían de cómo se ESCRIBIERON las órdenes. Borrar el
movimiento no sirve: el registro automático lo vuelve a crear desde la orden (MOV-2026-0002 → 0021). · **Regla**: reconciliar en
solo lectura (`.get()`), preguntarle los HECHOS, corregir la FUENTE por su página y en su sesión, y dejar que lo derivado se rehaga.
El criterio del dominio (qué descuenta, cómo cambiar el tipo de una orden) vive en `54 §2`. **Gate**: [HONOR].
