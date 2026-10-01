# 🔐 35 — LECCIONES · Seguridad, reglas y datos personales (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, 2026-09-30, `99 §120`): nace cuando `32` llegó a su tope
> y `30` a 7 caracteres del suyo. Reúne, **copiadas sin cambiar una letra**, las lecciones cuya raíz común es
> **quién puede leer o escribir qué**: reglas de Firestore/Storage, cédulas y datos personales en un repo
> PÚBLICO, firmas de otras personas, y cómo se prueba de verdad un arreglo de seguridad. Salieron de `32`
> (L-64 … L-107) y de `30` (L-110). Se lee on-demand (trigger 🧪 Experiencia, o 🔵 al auditar seguridad)
> **ANTES de tocar `firestore.rules`/`storage.rules`, un dato personal o una firma ajena**.

---

### L-64 · El saneador que reintroduce lo que borra (fuga por la lista de lo prohibido)
**Síntoma.** Se sanea un binario para quitarle datos de cliente y el `.xlsx` queda impecable… pero el
script que lo limpia lleva escrita, en texto plano, la lista de lo que debe borrar: nombres de
personas reales, subestaciones, usuario de dominio, fechas de firma. En un repo PÚBLICO la fuga
simplemente se mudó de archivo. Lo detectó una auditoría adversarial, no el que escribió el script.
**Regla.** El material sensible que un script necesita **conocer** para eliminarlo vive FUERA del repo
público — en `../brain-private/` — y el script **falla ruidosamente** si no lo encuentra, en vez de
sanear a medias. Nunca literales sensibles en código versionado, ni siquiera "para borrarlos".
**Corolario (más caro que el síntoma).** Al abrir la plantilla PE.02081 aparecieron **firmas
manuscritas escaneadas** de tres personas, el autor del archivo, GUIDs de la organización M365,
rutas locales con usuario de dominio y el estudio económico del proyecto real. **Un formato
institucional recibido por correo es material de cliente hasta que se demuestre lo contrario**:
descomprimirlo y auditar TODAS sus partes (XML, `.rels`, `docProps`, `media/`) antes de versionarlo.
**Gate.** [HONOR] — ningún linter lo cubre. Ver `99 §61`.

### L-75 · Sanear por la FORMA del campo deja lo que está en texto libre
**Disparador**: retirar datos personales de un archivo antes de publicarlo. · **Cicatriz** (ADR-070): el saneado sustituyó el patrón `cedula: '…'` y dio el trabajo por hecho; una revisión adversarial encontró que **la cédula real de un trabajador sobrevivía en dos comentarios**, escrita además en sus dos formas (con puntos y sin puntos), a 20 líneas de donde su nombre sí figuraba. Es la misma raíz que el `.gitignore` que protegía la carpeta `450108/` mientras los datos vivían en `_dev/fixtures/450108-*.json` (`99 §68`, A-05): **la regla se escribió contra la FORMA, no contra el DATO**. · **Regla**: sanear se verifica barriendo por el VALOR —cada dato real, en todas sus grafías— sobre los archivos exactos que se van a publicar, y repitiéndolo contra lo YA DESPLEGADO. Y ojo con el barrido en sí: pasar varias rutas en una variable de shell hizo que el `grep` de este entorno (envoltorio de ugrep, **L-70**) las tratara como un solo nombre, avisara `No such file or directory` y devolviera `0` — **un barrido de seguridad que emite un warning no es un barrido**. Rutas explícitas y `/usr/bin/grep`. **Gate** [HONOR]. Ver `99 §70`.

### L-76 · `getDownloadURL` entrega una URL que funciona SIN sesión: las reglas cierran la ruta, no el enlace
**Disparador**: mover un archivo privado a Firebase Storage «para que quede detrás del login». · **Cicatriz** (ADR-071): al sacar las firmas escaneadas del repo público, el camino evidente era `getDownloadURL()` + `<img src>`. Pero esa URL lleva un token incorporado y **sigue sirviendo el archivo a quien la tenga, sin autenticarse**: basta con que aparezca en un historial, un log, un copiar-pegar o la caché del navegador. Habría movido el problema de sitio —de un PNG público a una URL pública— con la sensación de haberlo resuelto. Las propias reglas del repo ya lo decían en un comentario (`storage.rules`: *"los download-token URLs siguen funcionando; se cierra el acceso por-path"*) y aun así era fácil caer. · **Regla**: para material que NO puede filtrarse, leer con **`getBytes()`/`getBlob()`**, que exige la sesión en CADA lectura y no deja URL pública detrás; convertir a dataURL en memoria. `getDownloadURL` es para lo que puede circular. Y la regla de acceso se escribe sobre el DUEÑO del recurso (`request.auth.uid == uid`), no solo sobre "estar autenticado": si cualquier miembro puede leer la firma de otro, el sitio sirve para falsificar documentos. **Gate** [HONOR]. Ver `99 §71`.

### L-78 · Desplegar unas reglas solo COMPILA: verde en el deploy no es verde en el comportamiento
**Disparador**: `firebase deploy --only storage` (o `firestore`) sale en verde y se declara la ruta protegida. · **Cicatriz** (ADR-071→073): las reglas de `firmas/{uid}` se desplegaron el 2026-08-31 y se dieron por buenas porque el deploy no protestó. El deploy solo valida la SINTAXIS: no ejecuta una sola petición. La promesa que sostenía todo el mecanismo —«ningún compañero puede descargar la firma ajena»— estuvo 24 h sin una sola prueba, y la suite que la demostró (34 casos) tardó 40 min en escribirse. · **Regla**: una regla nueva no está entregada hasta que existe un caso del emulador que la ejerce en las **dos** direcciones (el dueño SÍ, el ajeno NO). La contra-prueba positiva no es opcional: unas reglas que denieguen TODO pasan los invariantes negativos y dejan la función rota en producción sin que nadie se entere —aquí, `miFirma()` convierte un fallo de permisos en «no hay firma» y el documento sale sin firmar—. Las reglas de Storage necesitan **los dos emuladores** (`--only firestore,storage`): preguntan en Firestore quién es el usuario, y con uno solo pasan en verde por la razón equivocada. **Gate** [HONOR] + CI (`npm run test:rules`). Ver `99 §73`.

### L-79 · En Storage, `read` incluye `list`, y al listar un prefijo los comodines sin ligar valen null
**Disparador**: leer `allow read: if isTeamMember()` como «puede descargar los objetos que ya conoce». · **Cicatriz** (ADR-073): también puede pedir el **inventario**. Al evaluar un `list` sobre un prefijo ancestro (`pruebas_electricas`, sin unidad), los comodines del match que no quedan ligados se ligan a **null** y el match aplica igual; como `isTeamMember()` no menciona `{unidadId}` ni `{filename}`, la condición da true y se entrega la lista completa de unidades, contratos y documentos. La cara opuesta es más traicionera: `firmas/` SÍ queda cerrado al listado, pero **por un error de evaluación** (`Null value error` al comparar `request.auth.uid == uid` con `uid` nulo), no por una regla — funciona hoy, y nadie lo escribió a propósito. · **Regla**: si el nombre de los objetos ya es información (un padrón de personas, un listado de contratos), el `list` se decide y se prueba aparte del `read`, con un caso que afirme el CONTENIDO del listado, no solo que no falle. Y antes de cerrarlo en todas partes, comprobar quién lo usa: `eliminarUnidad()` necesita `listAll` de admin para borrar los PDFs de una unidad. **Gate** [HONOR]. Ver `99 §73`.

### L-91 · Pasar un dato de LOCAL a COMPARTIDO: todo lo que era seguro «porque era mío» deja de serlo

Las Órdenes de Materiales vivían en el navegador de quien las hacía; el encargo era «que queden
almacenadas». Parecía cambiar solo *dónde* se guardan. El comité y el código mostraron cuatro cosas que eran
correctas **solo por ser locales** y que en compartido rompen: el número propuesto `DDMMAAAA-01` igual para
todos (el choque pasa a ser el caso normal), el `confirm «¿reemplazar?»` (ahora pisa la orden de un
compañero sin verla), el archivo que **reemplazaba** la lista al abrirse (resucita lo que otro borró) y el
texto pintado en la página (ahora lo abre el admin: XSS almacenado).

**La regla**: antes de mover estado de local a compartido, lista **cada supuesto que dependía de un solo
dueño** —valores por defecto, confirmaciones de reemplazo, fusiones «gana el más reciente», caminos de
importación, lo que se pinta— y dale a cada uno su versión compartida: crear ≠ editar, versión esperada,
lápida al borrar, fuentes locales congeladas que solo *ofrecen* subir, escapado verificado. El diseño que
solo cambia la capa de datos hereda todos esos supuestos sin que nadie lo note. → `99 §77`.

### L-93 · Un candado de datos personales solo en pre-commit tiene seis puertas laterales

Para las cédulas (`99 §78`) el primer candado revisaba lo preparado para commit, por huella de la cédula
exacta. La revisión adversarial le encontró salidas reales: **merge, cherry-pick y push** no pasan por
pre-commit; el **mensaje** del commit no se mira; un **PDF/Excel** (justo lo que ahora lleva cédulas) es
binario y comprimido; un número con **guion, coma o pegado** a otros cae fuera de la expresión; en un
**worktree** la bóveda no aparece y el candado falla abierto; y una cédula **nueva**, cargada desde la web,
no tiene huella.

**La regla**: un candado de dato sensible se prueba contra la lista de puertas —commit, mensaje, merge,
push; texto, binario, nombre de archivo; separadores y ventanas; worktree; dato no registrado— y cada una
tiene su caso con datos FALSOS (huellas falsas vía `SGM_HUELLAS`). Donde el texto no deja ver (binarios),
se bloquea por tipo con un escape explícito. DATO (huellas con sal fuera del repo) y FORMA («cédula +
número») se complementan: uno atrapa lo conocido, el otro lo nuevo.

### L-95 · Un comentario no revoca: lo que la regla EJECUTA es lo que manda

`adminsBootstrapValido()` llevaba meses con un comentario que decía «uid en /admins SIN perfil = bootstrap
puro»… y un código que aceptaba a cualquiera de /admins mientras estuviera activo (`99 §79`). El cliente
implementaba la intención del comentario; las reglas, otra cosa. Nadie lo vio leyendo: se vio cuando una
prueba del emulador ESCRIBIÓ con el uid de un ex-admin degradado y pasó.

**La regla**: cuando el comentario de una regla enuncia una condición, esa condición se prueba con un caso
que la ejerza; si el caso pasa cuando debía fallar, el defecto es del código, no del comentario. Y el
hallazgo se deja fijado como test que AFIRMA el comportamiento vigente («🔴 HOY PERMITE»), para que cerrar
el hueco sea cambiarle el signo y no descubrirlo otra vez.

### L-106 · Un arreglo de seguridad se prueba contra la CLASE, no contra el ejemplo que lo destapó
**Disparador**: cerrar un hallazgo de denegación, inyección o topes con un parche y darlo por «corregido». ·
**Cicatriz** (`99 §112.8`): el ReDoS del lector del `.xlsx` se cerró contando etiquetas sin cierre en la hoja, los
textos y los dibujos, y la prueba solo cubría ese caso. La verificación del cerebro halló el mismo mal por `styles.xml`
(nunca pasó el filtro) y por el ORDEN (cierres antes que aperturas: la cuenta cuadra) ya en producción, con el ADR
diciendo «corregido». · **Regla**: antes de declarar cerrado, enumerar TODAS las entradas que llegan al mecanismo
vulnerable (aquí: cada regex perezosa sobre texto ajeno) y darle a cada una su caso hostil; mejor si la defensa es
estructural (una pasada lineal que valide el anidamiento de TODA parte leída, o un Worker con tiempo límite) que
casuística. **Gate** [HONOR] + las pruebas de CF-40.

### L-107 · Un documento con firmas ajenas: TODAS sus salidas, y la huella de los bytes que de verdad se entregan
**Disparador**: estampar firmas de otras personas (directorio del custodio) con registro de cada emisión. · **Cicatriz**
(`99 §114`): el PDF y el Excel de Órdenes registraban y ponían folio, pero el botón «Imprimir» de la vista previa (y
Archivo → Imprimir) sacaba la firma de Carlos sin releerla, sin registro y sin folio; y la huella registrada del PDF no
era la del archivo descargado, porque jsPDF rearma el documento en cada `output()`/`save()` y con imágenes no sale igual.
La revisión adversarial lo cazó antes de publicar. · **Regla**: antes de publicar, ENUMERAR cada salida del documento
(descargas, vista previa, imprimir, atajos, copias) y decidir para cada una si lleva las firmas y con qué registro; la
que no registra, no las lleva (aquí: `@media print` dentro del propio SVG). Y armar el archivo UNA vez: huellar y
descargar esos mismos bytes. **Gate**: pruebas de `§114` en el banco + [HONOR].

### L-110 · Una regla de Firestore se prueba a CARGA MÁXIMA: tope de 1000 expresiones por petición
`99 §119`: el folio del delegado pasaba con 1-4 casillas y el emulador lo negó con 5 («maximum of 1000
expressions»). **Regla**: probar con el máximo real y medir el margen (variante con casillas de más). Abarata:
una función sobre `e`; `x.size()==N` en vez de listas de claves; una regex en vez de una lista de parejas.
**Gate**: `tests-rules/firmas_delegados_fichas.rules.test.js` (5 casillas) + [HONOR].

### L-112 · En un papel firmado, nombre y firma salen de UNA foto tomada al empezar
`99 §121`: el elaborador por defecto pasó a depender de la sesión y del permiso; si el permiso se retiraba a mitad de
«Exportar Excel», el nombre se recalculaba (el Ingeniero) y la firma ya estampada era la de Carlos. La revisión
adversarial lo cazó antes de publicar. **Regla**: todo valor que decide QUIÉN firma y que puede cambiar solo (sesión,
permiso, red) se congela en una COPIA al empezar la descarga; nombre, firma y folio salen de esa copia, nunca del estado
vivo ni del borrador. **Gate**: `tests/fichas_elaborador_sesion.test.js` («una descarga no cambia de elaborador»).
