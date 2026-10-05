# 📦 Cola de FICHAS TÉCNICAS — puntos CERRADOS (archivo de la cola)

> **Hoja hija de [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md)** (2026-09-30, `99 §120`). La cola
> manda retirar un punto cuando el ADR que lo resuelve lo recoge (§G.3); aquí quedan esos puntos
> **copiados sin cambiar una letra**, con el «Antes:» que explica qué fallaba. No se auto-carga: se
> consulta antes de re-auditar un CF o de volver a proponer algo que ya se refutó. Cada fila nombra su
> ADR en `99` (vía `00`), que es donde vive la decisión. **No se reabre un punto sin motivo nuevo.**

---

## Del bloque 🔴 GRAVE

| id | Qué pasa | Dónde | Arreglo |
|---|---|---|---|
| ~~**CF-01**~~ | ✅ **CERRADO `99 §83` (09-22)** — borrador local con dueño y caducidad de 30 días, volcado síncrono antes de limpiar, banda que nunca restaura en silencio ni pisa lo tecleado hoy, y sello visible de «guardado». Si el navegador no deja guardar, lo dice y el aviso de salida vuelve a cubrir la ficha. | `domain/fichas_borrador.js` + 23 pruebas | — |
| ~~**CF-02**~~ | ✅ **CERRADO `99 §84`** — número de secuencia: la respuesta tardía se descarta y se dice; la rama de fallo no vacía si hay trabajo. Antes: **la carga tardía borraba el listado** y no pregunta, porque entra con `forzar`. El peor camino: adjuntas el archivo *porque* el parque no cargaba, y la rama de fallo te deja la pantalla en blanco. | `panel.js:2856-2862` (`fijarDatos(filas, {forzar:true})` tras el `await`), `:2887` (`recargar()` sin `await`) | Sello de secuencia: la respuesta que vuelve tarde comprueba que sigue siendo la última; si no, se descarta |
| ~~**CF-03**~~ | ✅ **CERRADO `99 §84`** — el origen viaja con los datos y sin declaración no se afirma nada. Antes: **el pie del papel podía declarar un origen falso.** `cfg.origen` solo se reescribe si llega `meta.origen`, y la carga de Firestore no lo manda: el documento sigue diciendo «Listado adjunto · archivo.xlsx» sobre datos de Firestore, o al revés. Es la única línea que dice de dónde salió el dato. | `panel.js:2814`, `:2862`, `:2413`, `:2547`; `fichas-tecnicas.html:113` | Que el origen viaje **siempre** junto con los datos, y que el segmento apague su banner cuando la fuente cambie |
| ~~**CF-04**~~ | ✅ **CERRADO `99 §83.7`** — `fijarDatos` ya olvida los diagramas al cambiar de datos. Antes: **los diagramas sobrevivían al cambio de datos** y pueden reaparecer dibujados sobre otro equipo: `olvidarDiagramas()` solo corre al desmontar el tablero. | `panel.js:2873-2877` vs `:2815` | Llamar `olvidarDiagramas()` dentro de `fijarDatos`, donde ya se limpia el resto. **Una línea** + prueba |
| ~~**CF-05**~~ | ✅ **PUBLICADO 09-23 (`99 §87`, merge `f3411fb`)**. `J36` sale como número leído con `montoCOP` y `K36` como texto; de paso se vio que el TOTAL real del papel firmaba **0**. Antes: el Valor Real y el Sistema tecleados se quedaban en pantalla. | `exportar-planificacion.js` + 6 pruebas contra la plantilla real | — |
| ~~**CF-06**~~ | ✅ **PUBLICADO 09-23 (`99 §87`)**. F36/I36/J36 sin dato ⇒ `[PENDIENTE]`; I78/J78 también mientras su línea esté pendiente (la SUM de la plantilla firmaba **0**); aviso con la lista antes de descargar, solo si falta algo. ~~Pregunta abierta~~ **Resuelta 09-24 (`§93`)**: Valor Real vacío ⇒ **en blanco** (J36 y J78, sin aviso); solo lo ilegible dice `[PENDIENTE]`. | `exportar-planificacion.js` (`pendientesFichaPlan`) + `panel.js` (`avisoPendientes`) | — |
| ~~**CF-07**~~ | ✅ **CERRADO `99 §107.3` (publicado 09-27, `1330bf1`)** — `nivelPorUsuarios` devuelve nulo sin dato: la ficha dice «no se puede situar», sin veredicto, y la matriz gerencial lo cuenta fuera (en vivo: los 3 de TODO-55). Lo que decía: **Al equipo sin usuarios registrados la hoja le asigna «criticidad Mínima» y firma un veredicto**, sin avisar. | `panel.js` (hoja salud/riesgo) + `matriz_riesgo.js` (`avisoDatoConsecuencia` no cubre el vacío) | Sin usuarios no hay columna: aviso de «no se puede situar» y sin veredicto |
| ~~**CF-32**~~ | ❎ **REFUTADO con evidencia (`99 §87`, `2fa7241`)**: el exportador escribe todo texto como celda de texto (`t="inlineStr"`) y ni LibreOffice ni SheetJS lo evalúan; la «fórmula viva» es riesgo del CSV, que la evaluación masiva ya neutraliza. El apóstrofo propuesto **imprimía «'» en el papel** y no protegía nada: NO se aplicó. Queda un candado de prueba que falla si lo tecleado se vuelve fórmula o recibe el apóstrofo. | `tests/fichas_exportar_planificacion.test.js` | — |

> **Nota 2026-10-05 sobre CF-05** (la fila se conserva tal cual): desde la revisión de `99 §87.4b` el Valor Real ya NO se lee con `montoCOP` sino con `leerMonto` (solo cifras escritas a la colombiana; lo demás sale `[PENDIENTE]` y avisa). `montoCOP` sigue leyendo solo el catálogo.

## Del bloque 🟠 MEDIO/MENOR

- ~~**CF-40**~~ ✅ **CERRADO `99 §113` (publicado 09-28, `54ec71f`)**: estructura revisada en una pasada + lectura en un Worker con 20 s de límite. Lo que decía: **«Diagrama Operativo»: el lector del `.xlsx` aún se puede congelar** (`99 §112.8`). (a) ReDoS
  por `styles.xml` (no pasa por `estructuraSana`) y por el ORDEN de las etiquetas (se cuentan, no se ordenan): ~21-23 s
  de pestaña congelada con 3-97 KB. (b) El tope contra archivos «bomba» lee un tamaño que el autor del zip falsea.
  Hoy solo lo mitigan el tope de entrada (15 MB) y que solo adjunta un administrador; no daña datos. Arreglo: validar
  el anidamiento en UNA pasada lineal para toda parte XML que se lea con regex (estilos, tema, libro, hoja, textos,
  dibujos) + leer y dibujar en un Worker que se corta a los N segundos (el respaldo para lo que no se prevea).

## Del bloque 🤝 «con una respuesta suya primero»

| id | Pregunta concreta | Mi propuesta por defecto |
|---|---|---|
| ~~**CF-25**~~ | ✅ **PUBLICADO 09-23 (`§88`/`§89`)**: la lista dictada por el Ingeniero va en la ficha y en el Excel. Antes: **los firmantes no llegaban al Excel** (solo la fecha). ¿El formato admite el nombre impreso o exige escribirlo a mano sobre la línea? | Imprimirlos, como la fecha |
