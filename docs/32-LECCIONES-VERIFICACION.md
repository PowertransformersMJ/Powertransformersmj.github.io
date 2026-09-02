# 🧭 32 — LECCIONES · Verificación, despliegue y honestidad del dato (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, creado 2026-08-21 en la auditoría Nivel-2, `99 §68`,
> cuando `30` volvió a pasar su tope). Reúne el cluster que nació entre 2026-07 y 2026-08 y comparte una
> sola raíz: **el repositorio describe una INTENCIÓN; producción, la pantalla y el dato son hechos aparte.**
> Se lee on-demand (trigger 🧪 Experiencia) **ANTES de declarar algo desplegado, portado, saneado o
> auditado**, y antes de poner en pantalla un dato que no venga de la fuente real.
> Todas son **[HONOR]**: ningún linter las cubre — por eso están escritas.

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

### L-65 · Un arreglo desplegado no es un arreglo verificado (GitHub Pages en modo `legacy`)
**Síntoma.** Se corrige una fuga filtrando el artefacto en `pages.yml`, el commit entra, el workflow
«Deploy» sale VERDE… y los archivos siguen sirviéndose en producción. Se reportó como resuelto y no
lo estaba.
**Causa.** GitHub Pages tenía `build_type: legacy`: publica la rama directamente e **ignora por
completo** el artefacto que sube el workflow. El flujo corría y su salida no se usaba.
**Regla.** Tras CUALQUIER arreglo de despliegue, comprobar el EFECTO contra la URL pública con
anti-caché (`curl -o /dev/null -w '%{http_code}' "$URL?cb=$(date +%s)"`), nunca el estado del
workflow. Verde en Actions ≠ cambio en producción. Y antes de tocar `pages.yml`, mirar
`gh api repos/OWNER/REPO/pages` y confirmar que `build_type` es `workflow`.
**Corolario.** Un sitio ESTÁTICO no puede guardar datos privados: todo lo que lee el navegador es
público. Si un dato no debe verse, no se arregla con `.gitignore` ni con filtros de publicación —
se mueve detrás de la autenticación. El catálogo de 206 equipos se resolvió leyendo de Firestore.
**Gate.** [HONOR]. Ver `99 §62`.

### L-66 · Lo DECLARADO en el repo no es lo que hay en producción (índices de Firestore)
**Síntoma.** El archivo declaraba 37 índices y producción tenía 33: los 4 de
`acciones_refrigeracion` llevaban meses declarados sin desplegar. Y 5 colecciones publicadas
(`auditoria`, `fallados`, `contramuestras`, `monitoreo_intensivo`, `propuestas_reclasificacion_fur`)
no tenían ninguno: sus pantallas fallaban con `FAILED_PRECONDITION` al filtrar.
**Causa.** Un índice se declara en el repo pero solo existe si alguien corre el deploy. Son dos
estados independientes y nada los concilia: sin gate, sin aviso, y el error solo se ve en la consola
del usuario que filtra. Igual con las CF: `maxInstances` no acota nada hasta desplegar.
**Regla.** Antes de afirmar que un índice o una función existe, PREGUNTARLE AL SERVIDOR
(`firestore:indexes`, `functions:list`) y comparar contra lo declarado. Misma raíz que L-65 aplicada
al backend: **el repo describe una intención; producción es un hecho aparte**.
**Corolario.** Un `where` + `orderBy` nuevo lleva su índice en el MISMO turno: declarado y desplegado.
**Gate.** [HONOR]. Ver `99 §63`.

### L-67 · Una hoja de estilos sin marcado detrás es un port a medias
**Síntoma.** El dueño dice que un módulo portado «no está como lo diseñó». Difícil de confirmar
leyendo código: lo que hay funciona; el defecto es lo que FALTA, y las ausencias no se ven.
**Medida objetiva.** Cruzar las clases que DEFINE el CSS contra las que USA el JS. En Fichas Técnicas:
189 de 339 (56%) sin usar — la hoja traía las cuatro vistas y el JS pintaba una. Convierte una
impresión en un hecho, y además dice QUÉ falta: cada familia huérfana (`ftm-rmx`, `ftm-gkpi`,
`ftm-norma`, `ftm-form`) nombraba una vista.
**Regla.** Al portar un módulo cuyo CSS se trae entero, medir esa cobertura ANTES de darlo por cerrado.
Un CSS que define el doble de lo que el marcado usa no es «CSS de más»: es la lista de lo que falta.
**Corolario.** No juzgar una página por su preview de `_dev/` sin comprobar que monta lo MISMO que la
real: el de fichas no montaba la evaluación masiva. Primero se hace fiel el preview, luego se compara.
**Gate.** [HONOR]. Ver `99 §64`.

### L-68 · Auditar en paralelo por dimensiones: lo que dos auditores ven a la vez, es real
**Receta.** Un auditor por DIMENSIÓN en paralelo (dominio · arquitectura · uso · robustez · seguridad ·
pruebas), cada uno con su lista de archivos, las reglas de la casa para no proponer lo prohibido, y la
orden de descartar en voz alta sus falsos positivos.
**Por qué funciona.** La CONVERGENCIA filtra: el `NaN` de la matriz lo hallaron tres auditores por
separado y dos lo reprodujeron en Node antes de que yo lo mirara. Lo que ve uno se verifica; lo que ven
tres, se arregla. Pedirles también qué está BIEN evita el refactor por gusto.
**Gate.** [HONOR]. Ver `99 §66`.

### L-69 · Un dato de demostración sin rótulo es peor que una pantalla vacía
**Cicatriz.** El dueño abrió Cargabilidad y vio «SUB-DEMO-NORTE», «TD-01», con KPIs calculados sobre
tres equipos ficticios y presentados como su flota. Los baselines sintéticos se pusieron al retirar
datos confidenciales, con la idea de que Firestore los sustituiría; la colección nunca se pobló y la
pantalla se quedó en el demo para siempre, sin decirlo.
**Regla.** Todo dato que no venga de la fuente real se ROTULA en pantalla, con la palabra
«demostración» visible, o no se muestra. Si no hay dato: estado vacío que explique **por qué** está
vacío y **qué hacer**. Y ningún indicador de alarma se cablea en el HTML: se calcula, o miente para
siempre (el badge «CRITICAL ALERT» de SCADA llevaba meses encendido sobre eventos inventados).
**Corolario — la falta de dato no es una buena noticia.** «El parque opera dentro de parámetros» sin
Índice de Salud, una matriz de riesgo en ceros y un «0 equipos en riesgo» se leen como tranquilidad
cuando significan ignorancia. Redactar los vacíos como lo que son.
**Segundo corolario.** Antes de dar por ausente un dato, buscarlo en el repo: el Excel traía la carga
medida por devanado y el importador la leía **para calcular y tirarla**; y 8 de 10 fichas normativas
estaban publicadas sin un botón que las abriera.
**Gate.** [HONOR]. Ver `99 §67`.

### L-74 · Acotar estilos impide que el módulo se ESCAPE, no que el sitio se COLE
**Disparador**: portar un módulo suelto a una página del sitio metiendo sus estilos bajo un contenedor (`.oms-scope`, `.pe-scope`). · **Cicatriz** (ADR-070): el módulo traía nombres genéricos (`.modal`, `.btn`, `.aviso`, `.logo`, `.num`, `.sub`) y el sitio **también define `.modal`**, con `max-width: 560px`. La regla acotada gana en las propiedades que DECLARA, pero en las que no declara manda la del sitio: la vista previa del documento salía encajonada a 560 px en una pantalla de 1280, y la captura parecía un fallo de pintado. · **Regla**: acotar es la mitad del trabajo. La otra mitad es **calcular la intersección real** entre las clases que USA el módulo y las que DEFINE el sitio (`aqua-tokens.css` + `aqua-components.css`) y **renombrar con prefijo solo las que chocan** — renombrarlo todo es caro y renombrar de más rompe (un `btn-quitar` convertido en `oms-btn-quitar` deja de encontrar su CSS). Y las capas se toman de los tokens del sitio (`--z-modal`, `--z-toast`), no se inventan: los modales del módulo estaban en 100 y la barra del sitio en 200, así que el documento salía tapado. **Gate** [HONOR]. Ver `99 §70`.

### L-75 · Sanear por la FORMA del campo deja lo que está en texto libre
**Disparador**: retirar datos personales de un archivo antes de publicarlo. · **Cicatriz** (ADR-070): el saneado sustituyó el patrón `cedula: '…'` y dio el trabajo por hecho; una revisión adversarial encontró que **la cédula real de un trabajador sobrevivía en dos comentarios**, escrita además en sus dos formas (con puntos y sin puntos), a 20 líneas de donde su nombre sí figuraba. Es la misma raíz que el `.gitignore` que protegía la carpeta `450108/` mientras los datos vivían en `_dev/fixtures/450108-*.json` (`99 §68`, A-05): **la regla se escribió contra la FORMA, no contra el DATO**. · **Regla**: sanear se verifica barriendo por el VALOR —cada dato real, en todas sus grafías— sobre los archivos exactos que se van a publicar, y repitiéndolo contra lo YA DESPLEGADO. Y ojo con el barrido en sí: pasar varias rutas en una variable de shell hizo que el `grep` de este entorno (envoltorio de ugrep, **L-70**) las tratara como un solo nombre, avisara `No such file or directory` y devolviera `0` — **un barrido de seguridad que emite un warning no es un barrido**. Rutas explícitas y `/usr/bin/grep`. **Gate** [HONOR]. Ver `99 §70`.

### L-76 · `getDownloadURL` entrega una URL que funciona SIN sesión: las reglas cierran la ruta, no el enlace
**Disparador**: mover un archivo privado a Firebase Storage «para que quede detrás del login». · **Cicatriz** (ADR-071): al sacar las firmas escaneadas del repo público, el camino evidente era `getDownloadURL()` + `<img src>`. Pero esa URL lleva un token incorporado y **sigue sirviendo el archivo a quien la tenga, sin autenticarse**: basta con que aparezca en un historial, un log, un copiar-pegar o la caché del navegador. Habría movido el problema de sitio —de un PNG público a una URL pública— con la sensación de haberlo resuelto. Las propias reglas del repo ya lo decían en un comentario (`storage.rules`: *"los download-token URLs siguen funcionando; se cierra el acceso por-path"*) y aun así era fácil caer. · **Regla**: para material que NO puede filtrarse, leer con **`getBytes()`/`getBlob()`**, que exige la sesión en CADA lectura y no deja URL pública detrás; convertir a dataURL en memoria. `getDownloadURL` es para lo que puede circular. Y la regla de acceso se escribe sobre el DUEÑO del recurso (`request.auth.uid == uid`), no solo sobre "estar autenticado": si cualquier miembro puede leer la firma de otro, el sitio sirve para falsificar documentos. **Gate** [HONOR]. Ver `99 §71`.

### L-78 · Desplegar unas reglas solo COMPILA: verde en el deploy no es verde en el comportamiento
**Disparador**: `firebase deploy --only storage` (o `firestore`) sale en verde y se declara la ruta protegida. · **Cicatriz** (ADR-071→073): las reglas de `firmas/{uid}` se desplegaron el 2026-08-31 y se dieron por buenas porque el deploy no protestó. El deploy solo valida la SINTAXIS: no ejecuta una sola petición. La promesa que sostenía todo el mecanismo —«ningún compañero puede descargar la firma ajena»— estuvo 24 h sin una sola prueba, y la suite que la demostró (34 casos) tardó 40 min en escribirse. · **Regla**: una regla nueva no está entregada hasta que existe un caso del emulador que la ejerce en las **dos** direcciones (el dueño SÍ, el ajeno NO). La contra-prueba positiva no es opcional: unas reglas que denieguen TODO pasan los invariantes negativos y dejan la función rota en producción sin que nadie se entere —aquí, `miFirma()` convierte un fallo de permisos en «no hay firma» y el documento sale sin firmar—. Las reglas de Storage necesitan **los dos emuladores** (`--only firestore,storage`): preguntan en Firestore quién es el usuario, y con uno solo pasan en verde por la razón equivocada. **Gate** [HONOR] + CI (`npm run test:rules`). Ver `99 §73`.

### L-79 · En Storage, `read` incluye `list`, y al listar un prefijo los comodines sin ligar valen null
**Disparador**: leer `allow read: if isTeamMember()` como «puede descargar los objetos que ya conoce». · **Cicatriz** (ADR-073): también puede pedir el **inventario**. Al evaluar un `list` sobre un prefijo ancestro (`pruebas_electricas`, sin unidad), los comodines del match que no quedan ligados se ligan a **null** y el match aplica igual; como `isTeamMember()` no menciona `{unidadId}` ni `{filename}`, la condición da true y se entrega la lista completa de unidades, contratos y documentos. La cara opuesta es más traicionera: `firmas/` SÍ queda cerrado al listado, pero **por un error de evaluación** (`Null value error` al comparar `request.auth.uid == uid` con `uid` nulo), no por una regla — funciona hoy, y nadie lo escribió a propósito. · **Regla**: si el nombre de los objetos ya es información (un padrón de personas, un listado de contratos), el `list` se decide y se prueba aparte del `read`, con un caso que afirme el CONTENIDO del listado, no solo que no falle. Y antes de cerrarlo en todas partes, comprobar quién lo usa: `eliminarUnidad()` necesita `listAll` de admin para borrar los PDFs de una unidad. **Gate** [HONOR]. Ver `99 §73`.

### L-80 · «Espejo EXACTO» de un helper también copia el defecto — y lo duplica sin avisar
**Disparador**: un comentario que dice «espejo exacto de los helpers de `firestore.rules`» y tranquiliza. · **Cicatriz** (ADR-073): `adminsBootstrapValido()` está copiado literal en los dos archivos de reglas, y en los dos **no mira el rol**: comprueba estar en `/admins` y no estar desactivado, nada más. Como en `isAdmin()` va en la rama OR, gana. Resultado: degradar a alguien de administrador a técnico desde el panel no le quita nada, ni en los archivos ni en la base de datos. El auditor lo encontró en Storage; que estuviera igual en Firestore solo se supo al ir a mirar. Peor: el propio comentario del helper describe otra intención («uid en `/admins` SIN perfil en `/usuarios` = bootstrap puro») y el cliente implementa esa otra (`session-guard.js` solo consulta `/admins` cuando no hay perfil) — el código es el único de los tres que se aparta. · **Regla**: al encontrar un defecto en un helper duplicado, **buscar el gemelo antes de cerrar el hallazgo**, y probar el invariante en los DOS sitios: una prueba en un solo archivo certifica media verdad. Y cuando el comentario, el cliente y la regla discrepan, el que manda es la regla — la discrepancia es el hallazgo. **Gate** [HONOR]. Ver `99 §73`.
