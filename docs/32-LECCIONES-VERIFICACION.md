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

### L-81 · Ante dos fuentes que discrepan, silenciar la comparación no es prudencia: es perder la señal
**Disparador**: un sistema compara un dato REGISTRADO contra uno CALCULADO y salta una discrepancia que el cálculo "no puede sostener" porque le falta una entrada. La tentación es degradar el veredicto a «no evaluable» para no acusar en falso. · **Cicatriz** (ADR-074 §74.12): el catálogo CREG tiene tres familias y el clasificador solo distingue dos —no lee el tipo constructivo—, así que a tres equipos registrados como *autotransformador monofásico* les calculaba una UC *trifásica*. Razoné que el registro estaría bien y el clasificador ciego, y marqué los tres «Sin cálculo». El Ingeniero miró la tabla y dijo la frase que lo tumbó: **«todos son transformadores trifásicos»**. Era al revés — el registro estaba mal, el cálculo tenía razón, y mi regla había **tapado tres errores reales** en el registro oficial de activos. · **Regla**: cuando dos fuentes discrepan y no puedes decidir cuál manda, **mantén la discrepancia visible y EXPLÍCALA**: qué dice cada una, por qué el cálculo puede estar limitado, y qué hay que verificar (aquí: la placa). Nunca la conviertas en silencio. Un «no evaluable» se lee como «aquí no hay nada que mirar», y es exactamente lo contrario. Corolario del mismo día: la asimetría también engaña al revés — di por supuesto que el dato humano vencía al calculado *porque el calculado tenía una limitación conocida*, sin comprobar el hecho físico. El hecho físico lo sabe el dueño: **pregúntale, en vez de elegir por él**. **Gate** [HONOR]. Ver `99 §74.12`.

### L-82 · El ejemplo que le das a una plantilla se convierte en el único caso que se prueba

Quince plantillas de alcance llevaban un hueco `{ACCIONES}` y varias lo remataban con un participio
concordado: *«comprende {ACCIONES}, **ejecutadas** sobre los subsistemas…»*. Con la lista de ejemplo
del prompt —«inspección termográfica, muestreo de aceite y corrección de fugas», femenina plural por
casualidad— se lee perfecto. Con la lista real se rompe: *«comprende muestreo de aceite, ejecutadas
sobre…»*, y basta una sola acción o un género mixto para que la frase quede agramatical en un
documento que se firma.

**Lo que falló** no fue la redacción sino el ejemplo: al darle un caso cómodo, ese fue el único que
se verificó. **La regla**: cuando algo tiene un hueco, el ejemplo de referencia debe ser el caso
ADVERSO —el elemento solo, el género contrario, la lista vacía—, no el que luce bien.

**Cómo se cazó**: cinco críticos adversariales independientes, y varios no lo razonaron: **ejecutaron
la función que rellena el hueco** (`prosaAcciones()`) contra el catálogo real y leyeron el resultado.
Es la diferencia entre revisar el texto y revisar lo que el texto produce. → `99 §74.19`.

### L-83 · Un panel de jueces sirve tanto para elegir como para señalar dónde no vale ninguna

Tres juegos de definiciones, tres jueces con un criterio cada uno. Los tres coincidieron en que la
**banda 2 era la más floja de las quince** y **ninguno la dio por buena**: hubo que reescribirla en
la síntesis. Un revisor solo no dice eso — elige la menos mala y sigue.

El juez de rigor aportó lo que ningún lector atento habría visto sin abrir el código: tres
afirmaciones que suenan impecables y que **el motor no sostiene** —«sin deterioro detectable» en la
banda superior de un índice donde EDAD pesa 0,30; «ya no recupera margen» en una banda cuya
estrategia todavía incluye mejora; y promesas de comportamiento de red en un índice que no modela
topología—. Las tres venían del juego que mejor se leía en pantalla.

**La regla**: cuando lo que se juzga es texto de dominio, al menos un juez tiene que tener por
criterio **verificar el fondo contra el código**, y hay que dejarle decir «ninguna sirve». Sin eso,
el panel premia la redacción más vívida, que es justo la que más afirma. → `99 §74.21`.

### L-84 · Un valor por equipo pintado en cada parte fabrica dos mentiras, y la segunda acusa al dato

El tablero de cargabilidad tomaba `crg_pct_medido` —uno por transformador— y lo mostraba como
porcentaje de sus tres devanados. La primera mentira es visible: un devanado sin ampacidad ni
corriente exhibía «96 %» junto a «— A / — A». La segunda es peor porque **parece diligencia**: como
un valor único no puede coincidir con tres cocientes distintos, el sistema declaraba «fuente en
desacuerdo» en 74 equipos y mandaba a *revisar la captura*. La captura estaba bien; el que no
cuadraba era el modelo.

**La regla**: cuando un dato de nivel N se muestra en el nivel N+1, cualquier comprobación de
coherencia entre ambos denunciará al dato de abajo por construcción. Antes de creer un contador de
discrepancias, hay que preguntar si el valor comparado describe de verdad la cosa comparada.

**Cómo se comprobó**: abriendo el Excel y midiendo. Los porcentajes por devanado coinciden con sus
propios amperios en el 100 % de las filas medidas — 196, 196 y 31. Un solo número mata la hipótesis
de que el problema fuera la captura. → `99 §74.23`.

### L-85 · «Está en producción» no es «lo está viendo»: valida en SU pestaña, no en el servidor

Confirmé un despliegue con `curl` contra el sitio —CI verde, deploy verde, el archivo servido con el
cambio— y le dije al Ingeniero que ya estaba. Él respondió que no lo veía. Lo estaba mirando con el
navegador sirviendo **una mezcla**: HTML nuevo y módulos ES viejos, con la tabla en 11 cabeceras y
8 celdas por fila. Ninguna comprobación del lado del servidor podía detectar eso.

**Lo que hay que saber de la caché**: un `?query` en la URL refresca el HTML pero **no** los módulos
ES —se piden por su propia URL, sin el parámetro—; y revalidar solo los módulos produce el caso
inverso, filas nuevas bajo cabeceras viejas. La receta que funcionó desde la extensión:

```js
for (const u of urlsDeModulos) await fetch(u, { cache: 'reload' });
await fetch(rutaDelHTML, { cache: 'reload' });
location.replace(rutaDelHTML);
```

**La regla**: cuando el usuario reporta que no ve un cambio, la evidencia válida es el DOM de su
pestaña, no la respuesta del servidor. Y si el módulo tiene sesión, se valida con la extensión de
Chrome, que es la única que la tiene. → `99 §74.24`.

### L-86 · Una decisión aplicada a UN camino de escritura no está aplicada

El 2026-09-09 el Ingeniero ordenó que *«todo lo referente a inversión queda en PI»*. Se aplicó al
selector de casillas del documento de mantenimiento y quedó fijado con prueba. Pero la **prosa** del
alcance se compone por otra vía (`resolverPlantilla` → `seleccionAcciones`), y esa no filtraba: el
documento abría proponiendo reposición del activo **sin casilla con la que quitarla**, porque el
selector ya la había escondido. La prueba existente pasaba: probaba el camino arreglado.

Es la misma forma del defecto que `TODO-52` tiene en el backend —la decisión «manda el Excel» se
aplicó al importador y no a la función de la nube, que sigue pisándola—. Dos superficies distintas,
un solo patrón.

**La regla**: al aplicar una decisión del dueño, primero **enumera los caminos de escritura** de ese
dato (pantalla, prosa, exportación, backend, importador) y cierra todos o declara por escrito cuál
queda fuera y por qué. Una prueba que solo cubre el camino que acabas de tocar confirma tu trabajo,
no la decisión.

**Cómo se cazó**: recorriendo el flujo end-to-end en vez del diff — el reflejo de caza-bugs de §G.4.
El diff de `§74.20` era impecable. → `99 §75`.

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
