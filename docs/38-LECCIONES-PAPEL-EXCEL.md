# 🖨️ 38 — LECCIONES · Papel firmado, PDF y Excel (shard de `32`)

> **Nodo hijo de `30-LECCIONES`, hermana de `32`** (§G.5 sharding, 2026-10-11, `99 §162`: `32` llegó al 98 % de su tope y el plan
> estaba escrito desde `§149.4`). Reúne lo que cuesta sacar BIEN un documento que se firma o se entrega: el texto que redacta un
> modelo, el catálogo normativo, el color y los caracteres que se imprimen, el .xlsx editado por texto, el visor que no es testigo
> y la columna de un libro del cliente. **Copiadas sin cambiar una letra** de `32`: L-87, L-88, L-89, L-133, L-100, L-103, L-108,
> L-128 (las referencias internas a «`32`» de estas lecciones hoy son `38`). Se lee on-demand (trigger 🧪 Experiencia) **ANTES de
> tocar un exportador (PDF, XLSX/XLSM), un texto que se firma o un Excel del Ingeniero**. Todas son **[HONOR]** salvo que digan su gate.

---

### L-87 · Un catálogo normativo lista lo que PUEDE aplicar, no lo que hay que contratar

Al unificar la línea base de Fichas Técnicas con el `MO.00418 §4.3` marqué por defecto la
macroactividad **completa** de cada banda. Parecía lo más fiel a la norma y era lo contrario: el §4.3
es un **menú por condición**, no una lista de trabajos obligatorios. Marcarlo entero contrataba, en
condición 3, secado de aceite + regeneración de aceite + recuperación de aislamientos a la vez
—tratamientos **alternativos** del mismo aceite y del mismo papel— y, en condición 5, prometía
recuperar el aislamiento de un activo que el mismo documento declara irrecuperable. El papel se
contradecía a sí mismo, y lo firma el Ingeniero.

**La regla**: antes de marcar por defecto un catálogo normativo, pregunta si sus renglones son
**acumulativos o alternativos**. Si son alternativos, el defecto correcto es *ninguno* y que el
sistema lo diga («las acciones que se definan según el diagnóstico»). Lo que se ofrece no es lo que
se contrata.

**El corolario que casi me cuesta más caro**: le presenté al Ingeniero un alcance vacío como «un
agujero» sin comprobar qué hacía el sistema con él. Hacía lo correcto — caer en su texto de reserva.
**Un estado vacío que el código ya maneja con honestidad no es un defecto**; llamarlo así justifica
un «arreglo» que rompe algo sano. Comprobar el estado vacío ANTES de prometer cerrarlo.

**Cómo se cazó**: tres escépticos independientes sobre el diff sin commitear, con lentes distintas
(regresión · fidelidad a la norma · lo que el usuario ve). Dos dijeron «roto». La lente normativa
—la que fue a mirar precios y alternativas del catálogo— es la que vio el fondo; las de código
encontraron los ocho defectos de superficie. → `99 §75.10`.

### L-88 · El texto que redacta un modelo para un papel firmado necesita un revisor de DOMINIO, no de estilo

Se redactó el sustento técnico de 36 actividades de mantenimiento con una lista cerrada de normas
permitidas y la orden explícita de no inventar ninguna. Aun así, el revisor de rigor encontró **una
norma inventada, dos que no aplicaban y una promesa de revertir lo irreversible** — más 35
imprecisiones técnicas. La restricción en el prompt **no bastó**; lo que las cazó fue un segundo
agente leyendo como ingeniero que va a firmar.

Los tres patrones que se repiten y que hay que buscar siempre:
1. **El absoluto falso**: «el único indicador que declara un defecto interno». Suena autoritario y es
   refutable con el propio catálogo. Es lo primero que ataca un revisor externo.
2. **La obligación incumplible**: «deja localizado TODO punto caliente» — la termografía solo ve
   superficies accesibles. Firmado, crea una obligación imposible ante un hallazgo interno posterior.
3. **El verbo que sube de categoría el trabajo**: una *verificación* de enfriamiento que prometía
   «capacidad de disipación restituida a su condición de diseño» — eso es una reparación, con otro
   repuesto, otras horas y otro costo.

**La regla**: cuando un texto generado vaya a un documento que se firma, el segundo par de ojos revisa
**el dominio** (¿es cierto? ¿es exigible? ¿esa norma aplica?), no la redacción. Y conviene un tercer
paso mecánico: las correcciones llegan **sin tildes** —hay que reponerlas antes de publicar—.
→ `99 §75.12`.

### L-89 · El color que se ve en pantalla no es el que se imprime: fondos y `<i>` vacíos

Dos defectos del mismo tipo, cazados el mismo día sobre la misma matriz de riesgo:

1. **Los fondos no se imprimen.** Chrome omite `background` al imprimir salvo que el elemento lleve
   `print-color-adjust: exact`. Una matriz de riesgo pintada con `style="background:…"` se ve perfecta
   en pantalla y sale **en blanco** en el PDF. En un documento que se firma, lo que cuenta es el papel.
2. **Un `<i>` vacío mide 0×0.** La leyenda gerencial pintaba cada muestra con
   `<i style="background:#1B8E3F">` sin tamaño: el color estaba en el DOM y no se veía. La leyenda decía
   «Verde (OK)» sin verde, y nadie lo notó porque el texto se lee igual.

**La regla**: un color que *significa* algo (semáforo, veredicto) se verifica **midiendo**
(`getBoundingClientRect`, `getComputedStyle(...).backgroundColor`), no mirando el código; y si el
documento se imprime, se declara `print-color-adjust: exact` en el mismo cambio. → `99 §75.15`.

### L-133 · El PDF con Helvetica estándar solo imprime Windows-1252: Ω, μ y ≥ salen cambiados en el papel firmado
**Disparador**: texto libre que termina en un PDF de jsPDF sin fuente embebida (Órdenes, `ordenes-materiales.js`;
`exports/pdf.js`). · **Cicatriz** (`99 §141`): en el material «Otro», «Ω», «≥», la «μ» griega, «⌀» y un espacio invisible salían
en el PDF como otro signo, mientras la vista previa y el Excel los mostraban bien (probado con la librería real). · **Regla**:
todo campo libre que va al PDF pasa por `caracterNoImprimible` (`domain/ordenes_items.js`); si falla, se rechaza nombrando el
signo y pidiéndolo con letras («ohm», «micro», «mayor o igual»). Se prueba con «MΩ» en el PDF DESCARGADO, no en la vista previa.
Hoy solo lo cumple el material «Otro» (resto → TODO-65). [HONOR]

### L-100 · Un hallazgo se reproduce en el FORMATO real antes de arreglarlo — el arreglo de manual puede ser el daño
**Disparador**: un pendiente heredado de un comité o auditoría trae su «arreglo de dos líneas» ya escrito, sobre todo si es un riesgo de manual (inyección, escapado, codificación). · **Cicatriz** (`99 §87`, CF-32): la cola afirmaba que un texto que empieza por `=` se vuelve fórmula viva en el Excel y mandaba anteponer un apóstrofo. Eso es cierto en **CSV**; nuestro `.xlsx` escribe el texto como celda de texto (`t="inlineStr"`) y nadie lo evalúa. Y el apóstrofo, en un `.xlsx`, **se imprime**: el «arreglo» habría metido un carácter falso en el papel que se firma sin proteger nada. · **Regla**: antes de aplicar el arreglo de un hallazgo, reprodúcelo con el archivo real y dos lectores independientes (aquí LibreOffice y SheetJS); si no se reproduce, se cierra como REFUTADO con la evidencia y se deja un candado de prueba que falle si el riesgo aparece de verdad — y también si alguien aplica el arreglo equivocado.

### L-103 · Editar un .xlsx por TEXTO: reemplazo con función, identidades únicas, y se valida sin Excel real
**Disparador**: se reescribe XML de un libro (áreas de impresión, hojas clonadas o quitadas, imágenes de la
plantilla) o se va a declarar «el Excel sale bien». · **Cicatriz** (`99 §107`): `'Salud y riesgo'!$B$2:$R$56`
como TEXTO de `String.replace` metió el grupo 2 en medio (la misma trampa de CF-38); la hoja clonada repitió el
`xr:uid` de su original. En esta Mac no se puede abrir Microsoft Excel desde aquí (`osascript` -1743, sin
«Grabación de pantalla», `§104.5`). · **Regla**: (1) reemplazo SIEMPRE con función cuando el texto nuevo lleva
datos o `$`; (2) una hoja clonada toma el `xr:uid` de la que reemplaza; quitar una hoja exige correr los
`localSheetId` de los nombres definidos y los pies «Pág. N de T»; (3) antes de dibujar en una imagen de la
plantilla, leer su `<a:xfrm rot>` y su `<a:ext>`: la plantilla puede girar una y no la otra; (4) validar con
LibreOffice → PDF → `pdftoppm` (antes/después), `openpyxl` como lector estricto, chequeo de paquete (cada
relación y Override con su parte) y un archivo PRUEBA con nombre nuevo en Descargas para que el Ingeniero lo abra. (5) una plantilla oficial arrastra datos que no se ven —vínculos a otros libros, propiedades de SharePoint/Microsoft 365 y etiqueta de clasificación, nombres #REF!, impresora, hojas borradas y dibujos fuera del área de impresión—: se quitan al exportar (`99 §104`, `limpiar-ocultos.js`); los textos sobrantes de la tabla de textos compartidos se VACÍAN sin moverlos, porque las celdas los llaman por número; las pruebas del DETECTOR (vista previa) van contra la PLANTILLA, donde esos datos siguen, y las del exportador comprueban que el archivo sale sin ellos; (6) una casilla COMBINADA no crece sola con el texto (Excel no ajusta el alto de las combinadas): su alto se calcula con `ui/fichas/alto-casilla.js` (parámetros y tope en `§105.2`); con «ajustar a una página» la hoja se imprime más chica en vez de pasar a dos.
**Gate**: `tests/fichas_salud_riesgo_excel.test.js` + `tests/fichas_ajustes_libro.test.js` (paquete sano) + `tests/fichas_limpiar_ocultos.test.js` + `tests/fichas_alto_casilla.test.js` · resto [HONOR].

### L-108 · Un visor que falla igual no es testigo: se compara contra la FUENTE del formato, y se mide, no se promedia
**Disparador**: cambiar cómo se ancla, gira o dimensiona algo en un xlsx, o ajustar texto «para que quepa». · **Cicatriz**
(`99 §115`): el Actual girado se ancló con su `<a:ext>` sin cambiar. En LibreOffice se veía IGUAL que en producción
(ambos, mal, montados sobre «Notas»), y en Excel habría salido deformado: lo delató la PLANTILLA (ancla apaisada, imagen
vertical). Y un ancho PROMEDIO por letra achicó «Riesgo tolerable» 14 % en un cambio pedido para AGRANDAR la letra.
Además, una limpieza «de paso» borró la línea de la función hermana. Solo lo cazó el camino vivo del banco. · **Regla**:
(1) el testigo es la fuente del formato (la plantilla guardada por Excel) o el programa real, no un visor que puede
fallar igual; (2) lo que decide un tamaño se mide con las métricas reales y se compara contra producción; (3) una
limpieza se ubica por su función, no por su texto. **Gate**: `tests/fichas_salud_riesgo_letra.test.js` +
`tests/fichas_export_actual.test.js` + [HONOR].

### L-128 · Antes de recomendar qué significa una columna de cantidades, cuadrarla contra el documento de valor
**Cicatriz** (`99 §145.9`, 2026-10-07): pregunté si la «Cantidad» del Libro4 de un contrato era «existencia de hoy» o
«cantidad pactada» y recomendé la primera, porque unas cifras bajaban y eso «parecía un conteo». La cargué así. Una hora
después él trajo el pedido: Σ cantidad × precio de su Excel daba $2.269.222.125 contra $2.269.395.067 del pedido, así que
era lo pactado. Hubo que corregir datos de producción y el tablero. · **Regla**: cuando una hoja trae cantidades y precios
de un contrato, ANTES de preguntar o recomendar, multiplicar y comparar contra el valor del contrato (pedido, aceptación,
adiciones), y pedir ese documento si no está. Una recomendación sin ese cuadre es una suposición; dila como tal. [HONOR]
