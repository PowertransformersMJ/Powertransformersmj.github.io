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
> **Papel firmado, PDF y Excel** (L-87, L-88, L-89, L-100, L-103, L-108, L-128, L-133) se mudaron el 2026-10-11 a la
> hermana [`38-LECCIONES-PAPEL-EXCEL.md`](38-LECCIONES-PAPEL-EXCEL.md) (`99 §162`: esta hija llegó al 98 % de su tope).

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

### L-101 · Un control nuevo se prueba con el GESTO real (doble clic, pantalla baja), no solo con clics limpios
**Disparador**: un desplegable o ventanita propia dentro de un área con scroll (modal de la ficha). · **Cicatriz** (`99 §94`): el calendario de años pasó ratón, teclado, Esc, recarga y celular; la revisión adversarial lo rompió con un **doble clic** —al abrirse, `scrollIntoView` movía la rejilla BAJO el puntero y el segundo clic guardaba un año que nadie eligió— y con una **pantalla baja**, donde `block:'nearest'` alineaba mal y tapaba la casilla. · **Regla**: en todo control propio, probar doble clic, Enter sostenido, pantalla más baja que el control y toque en el fondo; y no usar `scrollIntoView` para mostrar un desplegable (calcular `scrollTop` con la casilla como tope). Un clic con `detail > 1` no elige. **Y `§156.7`**: la consola se lee DESPUÉS de cada gesto (encender y apagar capas varias veces), no solo al cargar.

### L-102 · Lo que un dato REAL de producción decide se lee en vivo antes de declarar la función lista — y el módulo cargado se comprueba, no el HTML
**Disparador**: una función depende de un dato que solo existe en producción (el `nombre` del perfil, un rol, una
configuración) o la validación en vivo sigue a un segundo despliegue en minutos. · **Cicatriz** (`99 §99.12`): la
firma propia del Ingeniero dependía de que su perfil se llamara como la lista cerrada; `§98.8` lo dejó escrito como
riesgo y nadie lo leyó en vivo. Se llama «Ing. Miguel Jimenez»: su casilla nunca fue suya y el panel lo listaba como
tercero. Al revalidar el arreglo, Chrome seguía con los módulos viejos (`max-age=600`) aunque el HTML era nuevo, y
Cmd+Shift+R desde la extensión no los refrescó. · **Regla**: (1) un riesgo que depende de un dato de producción se
cierra LEYÉNDOLO en la sesión real (`window.__sgmSession.profile`), no se deja en el ADR; (2) en la validación en vivo,
comprobar la versión con `import()` del módulo cambiado; si es vieja, `fetch(u, {cache: 'reload'})` de cada módulo
cambiado y recargar; (3) una exportación NUEVA se pone en un archivo NUEVO (no en uno que el navegador ya tenía): la mezcla de un módulo nuevo con su vecino viejo tumbó la página de Fichas (`99 §102.4`); (4) un productor nuevo no le entrega a un consumidor ya publicado un TIPO que no sabe escribir: `top` como `Uint8Array` hacía fallar el `escribirResumen` viejo de una pestaña abierta antes de publicar; va como lista de números (`99 §159`). **Gate** [HONOR] (TODO-57 es el arreglo de fondo).
(5) un módulo publicado que necesita una exportación NUEVA de un vecino que puede seguir viejo en caché lo importa por espacio de nombres (`import * as KPIS`) y pregunta si existe: un `import { x }` que falta tumba el módulo entero (`99 §158.10`, `ui/cargabilidad-scada/detalle.js`).

### L-104 · Vacío no es cero: `Number(null)` y `Number('')` dan 0
**Disparador**: un número de la base decide una clasificación, un color o un veredicto. · **Cicatriz**
(`99 §107.3`): `nivelPorUsuarios(null)` devolvía «Mínima» y la ficha firmaba «Riesgo tolerable» para 3 equipos sin
usuarios registrados; `conteoPorNivel`, en el mismo archivo, ya los dejaba fuera. · **Regla**: antes de `Number()`,
`null`, `''` y espacios son «sin dato» (nulo), y el camino «sin dato» se prueba con su caso; 0 registrado sí es
un dato. **Gate**: prueba «sin dato de usuarios…» en `tests/fichas_salud_riesgo_excel.test.js`.


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

### L-127 · Un aviso se verifica VISIBLE, no solo con texto; y un tope de seguridad corta lo viejo, nunca lo reciente
**Cicatriz** (`99 §144`, 2026-10-06): (a) `'oms-aviso ver' + 'ok'` armaba la clase «verok»: el aviso tenía su texto
(`innerText` correcto) pero `display:none`. En Órdenes, el alcance de Indicadores (con el «Parcial» del tope de 500) y los 9
avisos de la carga de listas NUNCA se vieron desde el 26-ago; las pruebas leían el texto y pasaban. (b) La serie mensual
tenía un tope de 120 meses contado desde el PRINCIPIO: un «Desde» de hace 15 años o una fecha 2016-por-2026 dejaban fuera
justo los meses de ahora (lo halló la revisión adversarial, no las pruebas). · **Regla**: (1) en el preview, un aviso se da
por bueno con `getComputedStyle(el).display` y una captura, no con su texto; al concatenar clases, el espacio va dentro de
la cadena (`'x ver ' + clase`); (2) todo tope de seguridad sobre una serie de tiempo se cuenta desde lo más reciente, y lo
que deja fuera se dice en cifras («N órdenes anteriores…»). [HONOR]

### L-143 · Una herramienta no se mide con otra herramienta propia: la vara es el dato de fábrica o de campo
**Disparador**: comparar dos calculadoras, dos métodos o dos versiones y concluir «esta pide de más» o «esa se queda corta». ·
**Cicatriz** (TODO-80, 2026-10-13, bóveda `2026-10-12-refrigeracion-onaf-onan`): la comparación con Mantenimiento Brigada midió
a la plataforma con la calculadora v1 y tituló «+725 ventiladores» y «36 casos bajo el 90 %». Contra la vara objetiva (lo que
instaló WEG en 9 transformadores de AFINIA) las dos se pasaban casi igual, unas 2,5 veces, porque las dos suponían pérdidas del
1 % y las reales son 0,29–0,64 %. Además, la propia v1 traía el caudal del Tipo 1 12 % alto, tomado de la curva de otro motor. ·
**Regla**: (1) antes de comparar, nombrar la vara y su origen (dossier, prueba, medición), nunca la herramienta propia; (2) si
no hay vara externa, decir «contra X, que tampoco está validado» y bajar el tono de los titulares; (3) el dato de una ficha
se cruza con su texto impreso (potencia, tensión, frecuencia), no solo con la curva. [HONOR]

