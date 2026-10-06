# 🧭 32 — LECCIONES · Verificación, despliegue y honestidad del dato (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, creado 2026-08-21 en la auditoría Nivel-2, `99 §68`,
> cuando `30` volvió a pasar su tope). Reúne el cluster que nació entre 2026-07 y 2026-08 y comparte una
> sola raíz: **el repositorio describe una INTENCIÓN; producción, la pantalla y el dato son hechos aparte.**
> Se lee on-demand (trigger 🧪 Experiencia) **ANTES de declarar algo desplegado, portado, saneado o
> auditado**, y antes de poner en pantalla un dato que no venga de la fuente real.
> Todas son **[HONOR]**: ningún linter las cubre — por eso están escritas.
> **Las de seguridad, reglas y datos personales** (L-64, L-75, L-76, L-78, L-79, L-91, L-93, L-95,
> L-106, L-107) se mudaron el 2026-09-30 a la hermana [`35-LECCIONES-SEGURIDAD.md`](35-LECCIONES-SEGURIDAD.md)
> (`99 §120`: esta hija llegó a su tope). Las que quedan aquí no cambiaron.

---

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
**Receta en uso** (desde `99 §90.5`): por cada archivo del sitio que cambió, `curl -s -o /tmp/x "$URL?cb=$(date +%s)"` y `cmp /tmp/x <ruta del repo>`; «idénticos byte a byte» es la evidencia. No comparar pasando el contenido por `echo` o por variables de la consola: un archivo con `\u0000` dio «character not in range» y un falso «falta».
**Y antes de publicar** (`§103.5`, 09-25): las pruebas van en un paso APARTE; se lee `fail 0` y solo entonces se mergea. Una cadena `npm run test:unit | grep …; … git merge …` sigue aunque haya fallos (`;` no mira el resultado y la tubería devuelve el de `grep`): así salió `1f13f55` con una prueba vieja en rojo; lo frenaron CI y Deploy y la página no cambió. [HONOR]

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
**Y `§117`**: `firestore.indexes.json` se edita como TEXTO, insertando solo el índice nuevo: reescribirlo con un serializador (`json.dumps`) reformateó el archivo entero y el cambio dejó de poderse revisar (se restauró con `git checkout` y se insertó a mano).

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

Es la misma forma del defecto que tenía el backend hasta `99 §80` (20-09): la decisión «manda el
Excel» se aplicó al importador y NO a la función de la nube, que siguió pisándola tres semanas. Dos
superficies distintas, un solo patrón; el backend ya se cerró, la prosa fue el otro camino.

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

### L-90 · Vaciar un dato que sirve de LLAVE rompe en silencio todo lo que buscaba por él

`§70` vació las cédulas del módulo de Órdenes de Materiales porque el repositorio es público. Estaba
bien. Pero `escribirOrden` seguía buscando al responsable con `findIndex(p => p.cedula === …)`: con todas
las cédulas en `''`, **cualquier** orden recuperada devolvía la primera persona. Nadie lo vio en dos
semanas porque el formulario se veía perfecto; solo fallaba al *recuperar* una orden, y fallaba hacia el
lado peligroso: nombres cambiados en un documento que se firma y la firma de la sesión estampable en una
línea ajena.

**La regla**: al vaciar, anonimizar o quitar un campo por seguridad, `grep` de **todas las lecturas** de ese
campo y pregunta, en cada una, si lo usaba como **llave**. Si sí, cambia la llave en el mismo commit.

**El corolario de la fusión**: al traer una versión nueva de algo que ya se había saneado, **sanea la suya
ANTES de fusionar**, no después. En una fusión a tres vías, lo que no choca entra limpio — y así habría
vuelto a entrar cualquier cédula nueva. Y el saneado por forma volvió a fallar: la cédula real seguía en
un comentario (L-75). → `99 §76`.

### L-97 · Lo que el módulo escribe por defecto no es trabajo del usuario — y si cuenta como tal, se lo borra
**Disparador**: sembrar un texto, una selección o un valor «por defecto» en un campo que también tiene guardado automático. · **Cicatriz** (`99 §85.4`): al abrir la ficha se dejó escrita la redacción del formato; el borrador de `§83` la vio como «ya tenía texto en pantalla», **se saltó la restauración** del texto del día anterior y al primer tecleo lo reemplazó en disco. La revisión previa a publicar lo paró con veredicto «no publicar». · **Regla**: lo que el sistema compone y puede rehacer solo (aquí, `_ver` numérico) **no cuenta como contenido**; solo cuenta lo que el usuario tecleó o eligió. Distinguirlos en el DOMINIO, no en la pantalla, para que todos los caminos (guardar, restaurar, avisar al salir) lo apliquen igual.

### L-99 · «¿Quedó hecho?» se responde revisando el código publicado, no el diff
**Disparador**: el dueño pregunta si algo quedó listo, o toca cerrar un ADR grande. · **Cicatriz** (`99 §83.7`): un día después de publicar el borrador de la ficha —ya con 23 pruebas y verificación en banco— cuatro lentes adversariales sobre el código en producción encontraron **seis cabos, tres graves**, todos en las COSTURAS entre módulos (el equipo sin identidad que se perdía callando, restaurar pisando el diagrama, el sello ilegible sobre la barra azul). El diff estaba limpio: el fallo vivía en lo que el diff no muestra. · **Regla**: antes de dar por hecho un cambio que toca un papel que se firma, una pasada adversarial sobre el resultado publicado, con lentes distintas (escritores sin cubrir · dónde se sigue perdiendo · concurrencia · lo que ve el usuario). Lo caro no es correrla; es creer que las pruebas del diff bastan.

### L-100 · Un hallazgo se reproduce en el FORMATO real antes de arreglarlo — el arreglo de manual puede ser el daño
**Disparador**: un pendiente heredado de un comité o auditoría trae su «arreglo de dos líneas» ya escrito, sobre todo si es un riesgo de manual (inyección, escapado, codificación). · **Cicatriz** (`99 §87`, CF-32): la cola afirmaba que un texto que empieza por `=` se vuelve fórmula viva en el Excel y mandaba anteponer un apóstrofo. Eso es cierto en **CSV**; nuestro `.xlsx` escribe el texto como celda de texto (`t="inlineStr"`) y nadie lo evalúa. Y el apóstrofo, en un `.xlsx`, **se imprime**: el «arreglo» habría metido un carácter falso en el papel que se firma sin proteger nada. · **Regla**: antes de aplicar el arreglo de un hallazgo, reprodúcelo con el archivo real y dos lectores independientes (aquí LibreOffice y SheetJS); si no se reproduce, se cierra como REFUTADO con la evidencia y se deja un candado de prueba que falle si el riesgo aparece de verdad — y también si alguien aplica el arreglo equivocado.

### L-101 · Un control nuevo se prueba con el GESTO real (doble clic, pantalla baja), no solo con clics limpios
**Disparador**: un desplegable o ventanita propia dentro de un área con scroll (modal de la ficha). · **Cicatriz** (`99 §94`): el calendario de años pasó ratón, teclado, Esc, recarga y celular; la revisión adversarial lo rompió con un **doble clic** —al abrirse, `scrollIntoView` movía la rejilla BAJO el puntero y el segundo clic guardaba un año que nadie eligió— y con una **pantalla baja**, donde `block:'nearest'` alineaba mal y tapaba la casilla. · **Regla**: en todo control propio, probar doble clic, Enter sostenido, pantalla más baja que el control y toque en el fondo; y no usar `scrollIntoView` para mostrar un desplegable (calcular `scrollTop` con la casilla como tope). Un clic con `detail > 1` no elige.

### L-102 · Lo que un dato REAL de producción decide se lee en vivo antes de declarar la función lista — y el módulo cargado se comprueba, no el HTML
**Disparador**: una función depende de un dato que solo existe en producción (el `nombre` del perfil, un rol, una
configuración) o la validación en vivo sigue a un segundo despliegue en minutos. · **Cicatriz** (`99 §99.12`): la
firma propia del Ingeniero dependía de que su perfil se llamara como la lista cerrada; `§98.8` lo dejó escrito como
riesgo y nadie lo leyó en vivo. Se llama «Ing. Miguel Jimenez»: su casilla nunca fue suya y el panel lo listaba como
tercero. Al revalidar el arreglo, Chrome seguía con los módulos viejos (`max-age=600`) aunque el HTML era nuevo, y
Cmd+Shift+R desde la extensión no los refrescó. · **Regla**: (1) un riesgo que depende de un dato de producción se
cierra LEYÉNDOLO en la sesión real (`window.__sgmSession.profile`), no se deja en el ADR; (2) en la validación en vivo,
comprobar la versión con `import()` del módulo cambiado; si es vieja, `fetch(u, {cache: 'reload'})` de cada módulo
cambiado y recargar; (3) una exportación NUEVA se pone en un archivo NUEVO (no en uno que el navegador ya tenía): la mezcla de un módulo nuevo con su vecino viejo tumbó la página de Fichas (`99 §102.4`). **Gate** [HONOR] (TODO-57 es el arreglo de fondo).

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

### L-104 · Vacío no es cero: `Number(null)` y `Number('')` dan 0
**Disparador**: un número de la base decide una clasificación, un color o un veredicto. · **Cicatriz**
(`99 §107.3`): `nivelPorUsuarios(null)` devolvía «Mínima» y la ficha firmaba «Riesgo tolerable» para 3 equipos sin
usuarios registrados; `conteoPorNivel`, en el mismo archivo, ya los dejaba fuera. · **Regla**: antes de `Number()`,
`null`, `''` y espacios son «sin dato» (nulo), y el camino «sin dato» se prueba con su caso; 0 registrado sí es
un dato. **Gate**: prueba «sin dato de usuarios…» en `tests/fichas_salud_riesgo_excel.test.js`.


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

### L-109 · «No se pudo leer» no es «no existe»: tres estados, y reintentar sin recargar
**Cicatriz** (`99 §116`): una lectura lenta del perfil (primera carga en frío, más de 3,5 s) se tomaba como «sin
perfil». Al Ingeniero le puso un perfil de arranque y en Órdenes no salió su firma; a un técnico lo habría sacado de la
sesión. **Regla**: toda lectura que DECIDE acceso o identidad distingue ok / no-existe / falla. Espera más que el
cliente de datos (Firestore da la conexión por caída a los 10 s) y reintenta en la MISMA página: recargar vuelve a
arrancar en frío. **Gate**: `tests/decision_perfil.test.js`.

### L-118 · Antes de decir que algo «no mueve» un agregado, se lee cómo se agrega; y el test usa datos que el agregado puede producir
**Cicatriz** (`99 §127`): le dije al Ingeniero que el CO y el CO₂ «no suben el nivel» del panel DGA, porque no tenían un
ajuste propio. Falso: la columna sale de `eval_dga`, que es el PROMEDIO de los cuatro grupos, así que el CO y el CO₂
pesan por ahí (en agosto, los 18 «Inmediato» de R3×C son «Medio» SOLO por el papel). El test que lo «probaba» usaba una
calificación global 2 con CO 5 y CO₂ 5: un dato que el promedio nunca produce. Lo cazó el comité, no las pruebas.
**Regla**: (1) antes de afirmar que un componente no influye en un valor compuesto, leer la fórmula del compuesto
(`calcularEvalDGA`) y decirlo con ella; (2) los datos de prueba de un valor derivado se ARMAN con la función que lo deriva,
nunca a mano; (3) si ya se le dijo al dueño algo falso, se corrige en el mismo informe y se nombra. **Gate**:
`tests/scada_carga_dga.test.js` (gases coherentes con `calcularEvalDGA`) + [HONOR].

### L-119 · Un resumen precalculado decide solo donde se PRUEBA exacto; donde no, se lee la fuente
**Cicatriz** (`99 §129`): la lista marcaba «sobrecarga sostenida» con el resumen en bruto del mes y el detalle con la
serie limpia: 10 marcas falsas en 8 meses (GBT, PBN, MAJ). **Regla**: (1) antes de decidir con un resumen, demostrar con
datos reales que equivale a la fuente y DÓNDE deja de equivaler (aquí: máx > 3 × A, y el medio paso del redondeo);
(2) el propio resumen debe poder decir «no sé» — ese caso va a la fuente, con tope de lecturas; (3) una lectura que
falla no es un «no» → **L-109** (tres estados); aquí queda como «por confirmar». **Gate**: `tests/scada_carga_sostenida.test.js` + [HONOR].


### L-120 · Una foto de antes/después compara VALORES, no texto: el servidor devuelve los mapas en otro orden
**Cicatriz** (`99 §131.9`): tras cargar los gases en producción, comparar `JSON.stringify(ultima_dga)` de la lectura
inmediata (caché local, orden en que se escribió) con la de un minuto después (servidor, orden alfabético) dio «207
equipos cambiados» que no cambiaron. Casi se reporta como una escritura extraña. **Regla**: (1) la huella de un documento
se arma con las llaves ORDENADAS y los Timestamp como número; (2) un «cambiaron todos» exactamente donde se escribió es
sospecha del comparador antes que del dato: se re-verifica con la comparación ordenada ANTES de decir nada; (3) la
fidelidad de una carga se prueba con una lectura independiente de la fuente (aquí, openpyxl sobre el Excel) y una huella
común (SHA-1 de líneas canónicas), no con el mismo código que escribió. **Gate**: [HONOR].

### L-121 · Un mensaje de commit no prueba una función: el camino vivo se recorre en el tamaño en que se usa
**Cicatriz** (`99 §135`): `dd9b5f6` (16-ago) decía «botón de menú con panel deslizante, cierre con Escape y al pulsar
fuera»; existían el botón y el CSS, pero NINGÚN código abría el cajón. Mes y medio sin menú en celular y tablet hasta
que el Ingeniero lo vio en su teléfono. **Regla**: (1) lo que solo se ve en un ancho (≤1024, ≤720) se verifica EN ese
ancho, tocando el control, no leyendo el diff; (2) antes de decir que algo responsivo funciona, se barre el sitio entero
con un medidor (iframes de 375/768 px sobre la vista previa con stubs; `bóveda 2026-10-02-sitio-responsive`; banco pariente: **L-92**); (3) una
clase de estado (`sb-open`) que solo existe en CSS y en ningún JS es una señal de código muerto. **Gate**: `tests/shell_menu_estado.test.js` (punto 3) + [HONOR] (1-2).
**Y en `§143`**: una regla de celular dentro de un `@media` escrita ANTES de la regla base de igual especificidad no se aplica (el `@media` no suma especificidad): el bloque de celular va DESPUÉS, y se mide el estilo calculado (`getComputedStyle`) a 375 px, no se supone.

### L-122 · CI o Deploy en rojo solo por la prueba de velocidad del Diagrama Operativo: relanzar, no subir el umbral
**Disparador**: un trabajo de CI o Deploy falla y el ÚNICO rojo es `tests/fichas_diagrama_operativo_blindaje.test.js` «miles
de definiciones de columnas» (~1,6 s > `RAPIDO` 1500 ms en el runner de GitHub). · **Cicatriz** (`99 §119.9`, `§124`, `§136`):
4 rojos entre 09-30 y 10-02, siempre con el mismo árbol verde en otro intento; el guardián busca el desastre de 5-23 s, no 1,6 s.
· **Receta**: relanzar solo el trabajo fallido (`gh run rerun <id> --failed`) tras comprobar que el rojo era ESE test; NO subir
el umbral ni saltarlo (decisión del Ingeniero 2026-10-02, antes TODO-68). Si falla otro test o pasa de ~3 s, es regresión. [HONOR]

### L-124 · Un aviso automático se verifica como una cifra: si anuncia que algo falta, comprobar que falta
**Cicatriz** (2026-10-01, dos veces el mismo día): (a) «Cargabilidad SCADA» publicó «no se leyeron los umbrales activos» y era falso: en producción no existe `umbrales_salud/global` porque no hace falta, y las bandas del MO.00418 SON las vigentes (`99 §122.4`, retirado en `6eed00c`); (b) en el libro de parámetros SCADA por punto, 12 de 21 avisos de «la escala cambia entre meses» eran falsos (ceros nocturnos, congelamientos, cambios de signo; `§138`, bóveda `2026-10-01-parametros-scada`). Las cifras estaban exactas; lo que engañaba eran las observaciones. **Regla**: (1) antes de mostrar un aviso de falta, comprobar en producción si falta de verdad o si su ausencia es el estado normal (L-109: «no existe» no es «no se pudo leer»); (2) un detector de anomalías se valida por cuántos falsos da sobre los casos reales, no con el caso que lo motivó; (3) no se silencia (L-81): se afina hasta que acierte, y al entregar se separa lo verificado (cifras) de lo orientativo (observaciones). [HONOR]
