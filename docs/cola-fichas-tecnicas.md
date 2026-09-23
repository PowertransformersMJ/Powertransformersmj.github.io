# 📋 Cola del módulo de FICHAS TÉCNICAS (hoja de `10`)

> **Hoja de detalle de `docs/10-MEMORIA-CORTO-PLAZO.md` (TODO-35/58).** No se auto-carga.
> Levantada el **2026-09-21** con una auditoría de 9 agentes Opus sobre el módulo REAL —una superficie
> por agente, cada hallazgo con su `archivo:línea`— que reemplaza la cola heredada de `§75` (los «31
> hallazgos» sin lista viva). Crudo → bóveda `2026-09-21-estado-fichas-tecnicas/`.
>
> ⚠️ **Leído en el código, NO reproducido en el navegador** salvo donde se diga. El mecanismo está
> verificado; la confirmación en vivo es parte del arreglo, no de este inventario.
> Al cerrar un punto: marcarlo ✅ con su `§` y retirarlo cuando el ADR lo recoja (§G.3).

## Lo que YA está cerrado (no re-auditar sin motivo)

- **`§82`** cada TX abre SU ficha: la identidad sale de matrícula/serie, no del «CODIGO SUBESTACION»
  (verificado en banco con dos TX de una subestación, y con prueba que lo vigila).
- **`§81`** en la casilla de la matriz se leen potencia y usuarios, y es **informativo**: el color sale
  solo de `colorCelda(hi, nivel)`; hay prueba que falla si la potencia mueve la columna.
- **`§75`** las cinco afirmaciones falsas del papel · un solo catálogo de acciones (registrado vs línea
  base) · el sustento técnico de las 36 actividades · «conservación del activo» · las 5 condiciones
  literales del Ingeniero con prueba anti-paráfrasis · la inversión fuera del alcance de mantenimiento
  en las **dos** vías de escritura.
- **`§80`** manda el Excel de Salud de Activos en todos los caminos (de aquí en adelante; lo ya pisado
  es TODO-64).
- El Excel sale de la **plantilla oficial real** (se parchean celdas conservando estilo) y el «Valor CREG
  Total» va como **fórmula viva** `F36+(MVA × $/MVA)`, auditable por el revisor.
- El presupuesto **no inventa cifra**: sin UC en catálogo o sin potencia, imprime `[PENDIENTE]` con motivo.
- El municipio se rellena solo desde `Municipios.xlsx` con las tres reglas del Ingeniero.
- Por debajo del mínimo del catálogo CREG **no se propone banda** (decisión suya, escrita en el código).
- **303 pruebas** del módulo en verde (17 archivos) y el lado del cálculo separado de la pantalla.

---

## 🔴 GRAVE · mío, sin preguntar nada

| id | Qué pasa | Dónde | Arreglo |
|---|---|---|---|
| ~~**CF-01**~~ | ✅ **CERRADO `99 §83` (09-22)** — borrador local con dueño y caducidad de 30 días, volcado síncrono antes de limpiar, banda que nunca restaura en silencio ni pisa lo tecleado hoy, y sello visible de «guardado». Si el navegador no deja guardar, lo dice y el aviso de salida vuelve a cubrir la ficha. | `domain/fichas_borrador.js` + 23 pruebas | — |
| ~~**CF-02**~~ | ✅ **CERRADO `99 §84`** — número de secuencia: la respuesta tardía se descarta y se dice; la rama de fallo no vacía si hay trabajo. Antes: **la carga tardía borraba el listado** y no pregunta, porque entra con `forzar`. El peor camino: adjuntas el archivo *porque* el parque no cargaba, y la rama de fallo te deja la pantalla en blanco. | `panel.js:2856-2862` (`fijarDatos(filas, {forzar:true})` tras el `await`), `:2887` (`recargar()` sin `await`) | Sello de secuencia: la respuesta que vuelve tarde comprueba que sigue siendo la última; si no, se descarta |
| ~~**CF-03**~~ | ✅ **CERRADO `99 §84`** — el origen viaja con los datos y sin declaración no se afirma nada. Antes: **el pie del papel podía declarar un origen falso.** `cfg.origen` solo se reescribe si llega `meta.origen`, y la carga de Firestore no lo manda: el documento sigue diciendo «Listado adjunto · archivo.xlsx» sobre datos de Firestore, o al revés. Es la única línea que dice de dónde salió el dato. | `panel.js:2814`, `:2862`, `:2413`, `:2547`; `fichas-tecnicas.html:113` | Que el origen viaje **siempre** junto con los datos, y que el segmento apague su banner cuando la fuente cambie |
| ~~**CF-04**~~ | ✅ **CERRADO `99 §83.7`** — `fijarDatos` ya olvida los diagramas al cambiar de datos. Antes: **los diagramas sobrevivían al cambio de datos** y pueden reaparecer dibujados sobre otro equipo: `olvidarDiagramas()` solo corre al desmontar el tablero. | `panel.js:2873-2877` vs `:2815` | Llamar `olvidarDiagramas()` dentro de `fijarDatos`, donde ya se limpia el resto. **Una línea** + prueba |
| ~~**CF-05**~~ | ✅ **HECHO en rama `6c702c5` (`99 §87`)** — espera el visto bueno del preview para publicarse. `J36` sale como número leído con `montoCOP` y `K36` como texto; de paso se vio que el TOTAL real del papel firmaba **0**. Antes: el Valor Real y el Sistema tecleados se quedaban en pantalla. | `exportar-planificacion.js` + 6 pruebas contra la plantilla real | — |
| ~~**CF-06**~~ | ✅ **HECHO en rama `b830c02` (`99 §87`)** — espera el visto bueno del preview. F36/I36/J36 sin dato ⇒ `[PENDIENTE]`; I78/J78 también mientras su línea esté pendiente (la SUM de la plantilla firmaba **0**); aviso con la lista antes de descargar, solo si falta algo. **Pregunta abierta**: ¿Valor Real vacío ⇒ `[PENDIENTE]` (así quedó) o en blanco? | `exportar-planificacion.js` (`pendientesFichaPlan`) + `panel.js` (`avisoPendientes`) | — |
| **CF-07** | **Al equipo sin usuarios registrados la hoja le asigna «criticidad Mínima» y firma un veredicto**, sin avisar. | `panel.js` (hoja salud/riesgo) + `matriz_riesgo.js` (`avisoDatoConsecuencia` no cubre el vacío) | Sin usuarios no hay columna: aviso de «no se puede situar» y sin veredicto |
| **CF-08** | **Dos criterios para el equipo sin evaluar**: la matriz del sitio lo pinta de verde (clampa), la ficha lo descarta (`condEntera`). | `panel.js:389` vs `matriz_riesgo.js` (`evaluarTransformador`) | Subir la regla de `condEntera` al dominio: un solo criterio para matriz, analítica y ficha |
| **CF-09** | **El papel llama «plan registrado» a actividades que salieron de la norma** (línea base referencial), no de un plan del equipo. | redactor del alcance (`ficha-tecnica.js`) — el origen no viaja hasta la frase | Dos frases distintas: lo registrado y lo «tomado de la línea base referencial» |
| **CF-10** | **7 actividades pierden su sustento técnico en el papel** (el de las 48 correcciones): el renglón no lleva el código de la subactividad y el índice no encuentra el nombre sin periodicidad. | `acciones_tecnicas.js` / redactor | Que el código viaje con el renglón y aceptar el nombre sin periodicidad |
| ~~**CF-32**~~ | ❎ **REFUTADO con evidencia (`99 §87`, `2fa7241`)**: el exportador escribe todo texto como celda de texto (`t="inlineStr"`) y ni LibreOffice ni SheetJS lo evalúan; la «fórmula viva» es riesgo del CSV, que la evaluación masiva ya neutraliza. El apóstrofo propuesto **imprimía «'» en el papel** y no protegía nada: NO se aplicó. Queda un candado de prueba que falla si lo tecleado se vuelve fórmula o recibe el apóstrofo. | `tests/fichas_exportar_planificacion.test.js` | — |
| **CF-35** | **Sin Unidad Constructiva, la «Descripción» de la línea de inversión es una frase rota** —«TRANSFORMADOR () - LADO DE ALTA NIVEL  - DE»— en la pantalla y en `D36` del papel (lo vio el banco de `§87`, equipo sin tensión primaria como LA SALVACIÓN). | `exportar-planificacion.js` `descripcionUC` (respaldo sin catálogo) | `[PENDIENTE: DESCRIPCIÓN — sin Unidad Constructiva]`. Texto que se firma ⇒ **ejemplos antes** |
| **CF-36** | **La «Cantidad» (`H36`) no dice lo tecleado**: «0», «-1» o texto se imprimen 1 sin aviso; «2,5» sale «3» (formato entero de la plantilla). No mueve dinero (la regla no multiplica), pero es una casilla firmada. Confirmado por la revisión de `§87`; preexistente. | `fichas_presupuesto.js:107` (`cantidad` ⇒ 1) | Cantidad ilegible o ≤ 0 ⇒ `[PENDIENTE]` + aviso, como el dinero |
| **CF-38** | **Las redacciones insertan subestación y matrícula con `String.replace` de texto**: un nombre con «$&» o «$`» cambiaría el texto que se firma (el mismo mecanismo que `§87` cerró en el exportador). Con datos normales no pasa. | `panel.js` `resolverPlantilla` (~769-778) | Reemplazo con función. Cuatro líneas |
| **CF-34** | **Dos cabos que destapó `§85`**: el exportador escribe `plan.alcance` en B17 y el documento de Mantenimiento usa `alcance_mtto` (hoy no muerde: su botón de Excel está oculto) · el cuadro del alcance **no crece al imprimir**, así que una redacción larga se corta en silencio (el corte empieza cerca de los 950 caracteres). | `exportar-planificacion.js:261` · `fichas-tecnicas.css:1266` | Pasar el campo del documento abierto · dejar que el cuadro crezca en la regla de impresión |

## 🟠 MEDIO/MENOR · mío, en paquetes

- **Paquete «papel honesto»**: la paginación del documento de Salud está mal (7 hojas rotuladas «de 5», la
  hoja de Salud y riesgo sin folio) · «Código S/E» sale vacío (lee `cod_subestacion`, que nadie escribe:
  conectarlo al `codigo_subestacion` de `§82`) · «Identificador (fuente)» lidera con el código de
  subestación · el papel dice «DISCREPANCIA» sin decir por qué · el pie pone la fecha de hoy rotulada
  «corte» · el anexo dice «cinco hojas oficiales» también en el de Salud · seis erratas y un espacio doble
  en texto que se firma · «Regeneración aceite (frío)» pierde el «(frío)» · la fuga se imprime genérica
  aunque la fuente traiga el sitio exacto (`ubicacion_fuga_dominante`) · dos fichas del mismo patio pueden
  salir con el mismo nombre de archivo.
- **Paquete «que no vuelva a pasar»** (pruebas): el camino de datos, la hoja salud/riesgo y el exportador
  **no tienen ni una prueba**; la pantalla y el Excel calculan lo mismo con **dos copias** del código.
  Sacar el estado (carga, sello de fuente, rangos, veredicto) a funciones puras y cubrirlo; unificar las
  dos copias. El molde ya existe (`tests/xlsm_export_integracion.test.js`).
- **Paquete «partir la pantalla»**: `panel.js` es el monolito; 638 líneas de constructores de hoja salen
  primero a `ui/fichas/hojas.js`, en 4 commits de menos a más riesgo. **Después** de eso, retirar los
  **8,0 KB** de CSS con todas sus clases muertas (el suelo seguro; no los 11,9 KB).
- **Detalles**: en Analítica la tabla de priorización usa rangos distintos de la matriz de arriba · la
  bandera de advertencia mira una lista y la pantalla pinta otra · si pides «Volver al parque vivo» y
  cancelas, te quedas sin evaluación y sin botón · una clase de estilo que la lámina pide y el CSS no tiene.

- **CF-33 · Cabos que el barrido de `§83.7` dejó a sabiendas (ninguno pierde trabajo en silencio): dos pestañas del módulo no se avisan entre sí · dos filas con la MISMA matrícula en un listado se pisan al guardar y salen ambiguas al restaurar · si la sesión tarda más de 12 s el borrador podría escribirse sin dueño. → Evento `storage` entre pestañas · guardia de matrícula duplicada al guardar · no escribir mientras el uid esté vacío

## 🤝 Mío, pero con UNA respuesta suya primero

> ✅ **AUTORIZADO EN BLOQUE (2026-09-22)**: *«adelante con todas tus propuestas»*. Las doce se aplican
> con la propuesta por defecto de la última columna, cada una en su tanda, y se le reporta al cerrarla;
> lo que toque el papel se le enseña en preview antes de publicar. Si al verlo quiere otra cosa, se
> cambia: la autorización es para no frenar, no para decidir por él.

| id | Pregunta concreta | Mi propuesta por defecto |
|---|---|---|
| **CF-20** | **La casilla que se firma cambia según qué archivo esté cargado**, porque el máximo de usuarios se recalcula con lo que hay en pantalla y el papel dice «todo el parque». ¿Se **congela** en el parámetro oficial (hoy 48.312) o se sigue recalculando? | Congelarlo: así la casilla es reproducible y el papel no miente |
| **CF-21** | **La hoja «Salud y riesgo» no puede salir en ningún archivo** (la plantilla oficial no la tiene). ¿Se agrega al libro PE.02081, va como hoja anexa, o se queda solo en pantalla? | Incluirla ya en el HTML que se descarga; hoja anexa en el libro, no dentro de las oficiales |
| **CF-22** | **Las advertencias del clasificador CREG no llegan al papel**: el Excel sale con un precio basado en una interpretación, sin decirlo. ¿Dónde caben y con qué palabras? (`O11` «observación» del Anexo AT está libre) | `O11` del Anexo AT, con el mismo texto que ya muestra el tablero |
| **CF-23** | **Vigencia de pesos.** El papel no dice de qué año son las cifras (son de dic-2007, Tablas 51/52) y la «Variación Valor Real − CREG» compara con pesos de hoy. Además **tres UC de nivel 6 están en pesos de 2017**. ¿Hay activos de 500 kV en el parque? ¿La comparación se hace contra la resolución tal cual o indexada? | Rotular la vigencia junto a cada cifra y declarar la variación como comparación entre vigencias; no sumar 2017 dentro de un total rotulado 2007 |
| **CF-24** | **Las notas del diagrama no llegan a ningún papel.** ¿Se imprimen dentro del recuadro del diagrama, o son notas internas y hay que decirlo en pantalla? | Imprimirlas en el recuadro |
| **CF-25** | 🟡 **Pantalla lista con la forma del Excel (`§88`, en rama)**; falta conectarla al Excel con sus parámetros. **Los firmantes no llegan al Excel** (solo la fecha). ¿El formato admite el nombre impreso o exige escribirlo a mano sobre la línea? | Imprimirlos, como la fecha |
| **CF-26** | **SheetJS 0.18.5 con CVE** en el camino de exportación. ¿Autorizas vendorizar ≥0.20.2 en `assets/vendor/` (como los iconos) verificando que los Excel salgan idénticos? | Sí, vendorizar |
| **CF-27** | **Refrigeración deficiente** sigue sin señal, y ya existe el dato: `acciones_refrigeracion` guarda un veredicto por matrícula (`no_aprobado`, con déficit y cobertura) y el registro de OE/OS tiene el motivo «Reposición de unidad de refrigeración fallada». ¿Sirve como evidencia para firmar la condición? | Sí, con el veredicto de `acciones_refrigeracion` y rotulando de dónde sale |
| **CF-28** | **Documento de Mantenimiento Especializado**: ¿qué código y edición de formato lleva (hoy usa el `PE.02081` del PI)? ¿Tiene consecutivo y firmantes propios? | Sin código mientras no exista el formato; consecutivo y firmantes propios |
| **CF-29** | Casillas del formato: **«Zona»** imprime el departamento · **«Ámbito»** sale «Media Tensión / Alta Tensión» a la vez · en el Anexo AT la casilla **«Transformador»** se precarga con el nombre de la subestación · la sección dice **«Unidades MCOL $»** y escribimos pesos completos. ¿Qué va en cada una? | Zona operativa · ámbito derivado del nivel · «Transformador» vacío antes que con el dato de otro · pesos completos |
| **CF-30** | **¿Un PE.02081 lleva alguna vez más de una línea de inversión?** (hoy solo cabe una; la función que suma varias está sin conectar, y el formato admite 33) | Si es sí, abro la tabla con su aviso de vigencia |
| **CF-37** | **La hoja «Beneficios» del PE.02081 lee sus Costos de OTRO archivo** (`K11 = '[1]Ficha Técnica'!J37/1000000`, vínculo externo a un libro que no existe, caché 0): sale «Costos $ -» y «Relación B/C #DIV/0!» aunque la Ficha ya lleve Valor Real (`§87`; el `#DIV/0!` ya estaba en `§61.8`). ¿«Costos» es el Valor Real (`J78`) o el Valor CREG (`I78`)? | Conectarlo a `J78` (la columna J es la que el vínculo original leía), protegido para cuando diga `[PENDIENTE]` |
| **CF-31** | Menores: el **$/MVA** no tiene casilla para corregir a mano (solo la instalación) · «Cantidad 2» con un total que no la multiplica · los **huecos entre bandas** del catálogo se resuelven hoy con la banda superior sin declararlo · en C3/C5 sin plan registrado el alcance sale sin actividades: ¿aviso o bloqueo? · ¿el acta debe recuperar la ficha completa (alcance, Anexo, diagramas) al importarla? · ¿una **sexta condición** para cargabilidad/edad, con tu texto? · la alerta de dato incoherente, ¿se imprime como nota de verificación? | Declarar siempre la interpretación; aviso y no bloqueo; acta que recupere todo; sin sexta condición salvo que la redactes |

## 🧑‍💼 Tuyo · dato o decisión, sin código de por medio

0. **¿El borrador debe morirse al cerrar sesión?** (`§83`) Hoy sobrevive a F5, a cerrar la pestaña y a adjuntar otro listado —que es el objetivo—, es de tu usuario y caduca a los 30 días. Borrarlo también en el cierre de sesión voluntario exige un gancho en el guardián de sesión, fuera de este módulo.

1. **El archivo de Salud de Activos vigente** para re-importar: hay equipos cuya ficha firma hoy la
   condición del motor y no la tuya (TODO-64.a). Cuántos son solo se cuenta en Firestore con tu sesión.
2. **Los usuarios aguas abajo** (TODO-55): el alcance real de los 14 equipos de transmisión y de los tres
   con celda vacía (`M-BEC`, `M-GUP`, `M-SML`) — o la orden de imprimir «no aplica» en vez de «1 usuario».
3. **Los 3 equipos sin medida 2025** (`M-CAZ`, `M-BEC`, `M-SML`): ¿se miden, se excluyen del análisis de
   cargabilidad, o la ficha imprime «sin medida 2025»?
4. **`calif_crg` del parque** (TODO-56): 119 cambios sobre 193, 35 bajan. ¿Todo, solo lo que tiene medida
   2025, o nada por ahora? Exige antes/después guardado.
5. **La discrepancia condición vs índice de salud** (46 % de acuerdo) y **ASTREA al 250 %**: qué número
   manda y si la ficha declara la discrepancia.
6. **La tabla de 153 subestaciones con su municipio** vive en el repo público: ¿se queda o se mueve a
   Firestore (con su costo de lectura)?
7. **¿A cuáles de los 9 equipos en condición 5 se les emite ficha?** (venía de la memoria del harness, 08-15; sin nodo dueño hasta hoy).
8. **Dos huecos de dato que solo estaban en la memoria del harness**: el archivo `Furanos Trafos de Potencia.xlsx` está protegido con contraseña (se usó Salud de Activos como fuente) · **LA SALVACIÓN** no tiene tensión primaria en la fuente y por eso no calcula UC.
