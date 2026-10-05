# 📋 Cola del módulo de FICHAS TÉCNICAS (hoja de `10`)

> **Hoja de detalle de `docs/10-MEMORIA-CORTO-PLAZO.md` (TODO-35/58).** No se auto-carga.
> Levantada el **2026-09-21** con una auditoría de 9 agentes Opus sobre el módulo REAL —una superficie
> por agente, cada hallazgo con su `archivo:línea`— que reemplaza la cola heredada de `§75` (los «31
> hallazgos» sin lista viva). Crudo → bóveda `2026-09-21-estado-fichas-tecnicas/`.
>
> ⚠️ **Leído en el código, NO reproducido en el navegador** salvo donde se diga. El mecanismo está
> verificado; la confirmación en vivo es parte del arreglo, no de este inventario.
> Al cerrar un punto: marcarlo ✅ con su `§` y retirarlo cuando el ADR lo recoja (§G.3). El ADR que resuelve un CF lo nombra.
> **Revisada al 2026-09-27** contra `§94`-`§108` (auditoría `99 §109`).
> **Ampliada el 2026-10-05** (`99 §139`): CF-41…CF-44, el código sin llamada y los puntos 9-10 de «Tuyo». El resello completo contra `§110`–`§137` sigue pendiente (TODO-66).

## Lo que YA está cerrado (no re-auditar sin motivo)

- **`§115`** «Salud y riesgo» con letra más grande (anchos reales de Arial; prueba que falla si un texto baja de
  producción) · el Actual anclado con su caja YA girada (+ seguro contra caché vieja) · sin los dos párrafos en pantalla.
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
- **CF-01…CF-07, CF-25, CF-40** (cerrados) y **CF-32** (refutado): sus filas, tal cual, en [`cola-fichas-tecnicas-cerrados.md`](cola-fichas-tecnicas-cerrados.md) (`99 §120`).

---

## 🔴 GRAVE · mío, sin preguntar nada

| id | Qué pasa | Dónde | Arreglo |
|---|---|---|---|
| **CF-08** | **Dos criterios para el equipo sin evaluar**: la matriz del sitio lo pinta de verde (clampa), la ficha lo descarta (`condEntera`). | `panel.js:389` vs `matriz_riesgo.js` (`evaluarTransformador`) | Subir la regla de `condEntera` al dominio: un solo criterio para matriz, analítica y ficha |
| **CF-09** | **El papel llama «plan registrado» a actividades que salieron de la norma** (línea base referencial), no de un plan del equipo. | redactor del alcance (`ficha-tecnica.js`) — el origen no viaja hasta la frase | Dos frases distintas: lo registrado y lo «tomado de la línea base referencial» |
| **CF-10** | **7 actividades pierden su sustento técnico en el papel** (el de las 48 correcciones): el renglón no lleva el código de la subactividad y el índice no encuentra el nombre sin periodicidad. | `acciones_tecnicas.js` / redactor | Que el código viaje con el renglón y aceptar el nombre sin periodicidad |
| **CF-35** | **Sin Unidad Constructiva, la «Descripción» de la línea de inversión es una frase rota** —«TRANSFORMADOR () - LADO DE ALTA NIVEL  - DE»— en la pantalla y en `D36` del papel (lo vio el banco de `§87`, equipo sin tensión primaria como LA SALVACIÓN). | `exportar-planificacion.js` `descripcionUC` (respaldo sin catálogo) | `[PENDIENTE: DESCRIPCIÓN — sin Unidad Constructiva]`. Texto que se firma ⇒ **ejemplos antes** |
| **CF-36** | **La «Cantidad» (`H36`) no dice lo tecleado**: «0», «-1» o texto se imprimen 1 sin aviso; «2,5» sale «3» (formato entero de la plantilla). No mueve dinero (la regla no multiplica), pero es una casilla firmada. Confirmado por la revisión de `§87`; preexistente. | `fichas_presupuesto.js:107` (`cantidad` ⇒ 1) | Cantidad ilegible o ≤ 0 ⇒ `[PENDIENTE]` + aviso, como el dinero |
| **CF-38** | (Misma trampa volvió a morder en `§107`, «$B$2» en el área de impresión → **L-103**.) **Las redacciones insertan subestación y matrícula con `String.replace` de texto**: un nombre con «$&» o «$`» cambiaría el texto que se firma (el mismo mecanismo que `§87` cerró en el exportador). Con datos normales no pasa. | `panel.js` `resolverPlantilla` (~769-778) | Reemplazo con función. Cuatro líneas |
| **CF-39** | **La hoja impresa de la ficha**: los campos del presupuesto salen como cajas redondeadas y cortados («TRANSI», «192.85…») por la regla global `body.aqua input:not(...)` (`§88.1`), y el texto de ayuda del alcance se imprime (visto en `§89.7`). Y el texto de Beneficios sale DOS veces al imprimir, desde la casilla de edición y en la hoja (visto el 09-24, `§95.8`; no re-verificado tras `§105`). Preexistente. | `fichas-tecnicas.css` (impresión) | Neutralizar la regla global en toda la hoja, no solo en firmas; ocultar los textos de ayuda al imprimir |
| **CF-34** | **Dos cabos que destapó `§85`**: el exportador escribe `plan.alcance` en B17 y el documento de Mantenimiento usa `alcance_mtto` (hoy no muerde: su botón de Excel está oculto) [corrección 2026-10-02, auditoría `§128`: falso desde `§103`, Mantenimiento ya exporta con `alcance_mtto`] · el cuadro del alcance **no crece al imprimir**, así que una redacción larga se corta en silencio (el corte empieza cerca de los 950 caracteres). | `exportar-planificacion.js:261` · `fichas-tecnicas.css:1266` | Pasar el campo del documento abierto · dejar que el cuadro crezca en la regla de impresión |

## 🟠 MEDIO/MENOR · mío, en paquetes

- **Paquete «papel honesto»**: la paginación del documento de Salud está mal (7 hojas rotuladas «de 5», la
  hoja de Salud y riesgo sin folio) [corrección 2026-10-05, leído en `panel.js`: la paginación de la PANTALLA de Mantenimiento ya se corrigió en `99 §110`/`§112` —«Pág. N de 4», o «de 5» con Diagrama Operativo; Beneficios «Va en la Pág. 1»—. Siguen abiertos: la pestaña «Salud y riesgo» sin pie en pantalla (en el Excel es la Pág. 4) y el anexo del Plan, que dice «No forma parte de las cinco hojas oficiales» también en Mantenimiento, que tiene 4 (o 5 con Diagrama Operativo)] · «Código S/E» sale vacío (lee `cod_subestacion`, que nadie escribe:
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
  **8,0 KB** de CSS con todas sus clases muertas (el suelo seguro; no los 11,9 KB). · **Código sin llamada, conservado por «nada se borra»** (se retira con este paquete, solo con su sí y siguiendo **L-18**: cuarentenar, no borrar; skill `anti-codigo-muerto`): `selectorAcciones`, `fijarAcciones` y sus dos manejadores de `[data-accion]`/`[data-acc-todo]` en `panel.js` (`99 §105.8`) · el botón oculto «Descargar con firmas del equipo» con `prepararEmisionEquipo`/`confirmarEmisionEquipo` y su tabla (`§108.8`) · `lectura` y `nota` que `modeloSaludRiesgo` sigue armando sin pintarse (`§115`). En ese retiro **NO** se tocan las redacciones viejas del Alcance que dicen «las acciones de mantenimiento que se definan…»: él pidió no tocar el Alcance (`§105`); se le ofreció quitarlas (`§90.3`) y no respondió.
- **Detalles**: en Analítica la tabla de priorización usa rangos distintos de la matriz de arriba · la
  bandera de advertencia mira una lista y la pantalla pinta otra · si pides «Volver al parque vivo» y
  cancelas, te quedas sin evaluación y sin botón · una clase de estilo que la lámina pide y el CSS no tiene.

- **CF-33 · Cabos que el barrido de `§83.7` dejó a sabiendas (ninguno pierde trabajo en silencio): dos pestañas del módulo no se avisan entre sí · dos filas con la MISMA matrícula en un listado se pisan al guardar y salen ambiguas al restaurar · si la sesión tarda más de 12 s el borrador podría escribirse sin dueño. → Evento `storage` entre pestañas · guardia de matrícula duplicada al guardar · no escribir mientras el uid esté vacío
- **CF-41 · Si la limpieza de datos ocultos falla, el Excel sale CON ellos y solo lo dice la consola** (`99 §104.2`). Las otras fallas del exportador ya le avisan a quien descarga (`opts.avisos`: «Salud y riesgo», «Diagrama Operativo», hoja «Beneficios»). Con la plantilla de hoy no falla, pero si cambia la plantilla, un documento que se firma volvería a llevar en silencio el vínculo a otro archivo, la etiqueta de Microsoft 365 y las fechas viejas. → `exportar-planificacion.js` paso 8: sumar a `opts.avisos` «Este Excel salió con datos ocultos de la plantilla. Vuelva a exportar.» y una prueba con una plantilla que haga fallar la limpieza.

## 🤝 Mío, pero con UNA respuesta suya primero

> ✅ **AUTORIZADO EN BLOQUE (2026-09-22)**: *«adelante con todas tus propuestas»*. Las doce se aplican
> con la propuesta por defecto de la última columna, cada una en su tanda, y se le reporta al cerrarla;
> lo que toque el papel se le enseña en preview antes de publicar. Si al verlo quiere otra cosa, se
> cambia: la autorización es para no frenar, no para decidir por él.

| id | Pregunta concreta | Mi propuesta por defecto |
|---|---|---|
| **CF-20** | **La casilla que se firma cambia según qué archivo esté cargado**, porque el máximo de usuarios se recalcula con lo que hay en pantalla y el papel dice «todo el parque». ¿Se **congela** en el parámetro oficial (hoy 48.312) o se sigue recalculando? | Congelarlo: así la casilla es reproducible y el papel no miente |
| **CF-21** | ✅ **Mantenimiento: CERRADO `99 §107`** (la hoja va al Excel en el lugar del Anexo AT, decisión suya). **El PI sigue sin ella** (no la pidió ahí). Lo que decía: **La hoja «Salud y riesgo» no puede salir en ningún archivo** (la plantilla oficial no la tiene). ¿Se agrega al libro PE.02081, va como hoja anexa, o se queda solo en pantalla? | Incluirla ya en el HTML que se descarga; hoja anexa en el libro, no dentro de las oficiales |
| **CF-22** | ⚠️ Su «dónde» proponía `O11` del Anexo AT, que en Mantenimiento ya no sale (`§107`): **fuera de la autorización en bloque hasta volver a preguntarle**. **Las advertencias del clasificador CREG no llegan al papel**: el Excel sale con un precio basado en una interpretación, sin decirlo. ¿Dónde caben y con qué palabras? (`O11` «observación» del Anexo AT está libre) | `O11` del Anexo AT, con el mismo texto que ya muestra el tablero |
| **CF-23** | **Vigencia de pesos.** El papel no dice de qué año son las cifras (son de dic-2007, Tablas 51/52) y la «Variación Valor Real − CREG» compara con pesos de hoy. Además **tres UC de nivel 6 están en pesos de 2017**. ¿Hay activos de 500 kV en el parque? ¿La comparación se hace contra la resolución tal cual o indexada? | Rotular la vigencia junto a cada cifra y declarar la variación como comparación entre vigencias; no sumar 2017 dentro de un total rotulado 2007 |
| **CF-24** | **Las notas del diagrama no llegan a ningún papel.** ¿Se imprimen dentro del recuadro del diagrama, o son notas internas y hay que decirlo en pantalla? | Imprimirlas en el recuadro |
| **CF-26** | **SheetJS 0.18.5 con CVE** en el camino de exportación. ¿Autorizas vendorizar ≥0.20.2 en `assets/vendor/` (como los iconos) verificando que los Excel salgan idénticos? | Sí, vendorizar |
| **CF-27** | **Refrigeración deficiente** sigue sin señal, y ya existe el dato: `acciones_refrigeracion` guarda un veredicto por matrícula (`no_aprobado`, con déficit y cobertura) y el registro de OE/OS tiene el motivo «Reposición de unidad de refrigeración fallada». ¿Sirve como evidencia para firmar la condición? (antes TODO-61; el registro guarda el TIPO, no el ESTADO, `99 §75.13`) | Sí, con el veredicto de `acciones_refrigeracion` y rotulando de dónde sale |
| **CF-28** | **Documento de Mantenimiento Especializado**: ¿qué código y edición de formato lleva (hoy usa el `PE.02081` del PI)? ¿Tiene consecutivo y firmantes propios? | Sin código mientras no exista el formato; consecutivo y firmantes propios ⚠️ **(auditoría 2026-10-02) Decidido por `§103`: «PE.02081 igual al PI»**; queda abierto solo consecutivo y firmantes → FUERA del bloque hasta confirmarlo con él. |
| **CF-29** | ✅ **«Zona» CERRADO `99 §106`** (zona del activo, no el departamento). **Siguen abiertos**: Ámbito, «Transformador» del Anexo AT y MCOL. Lo que decía: Casillas del formato: **«Zona»** imprime el departamento · **«Ámbito»** sale «Media Tensión / Alta Tensión» a la vez · en el Anexo AT la casilla **«Transformador»** se precarga con el nombre de la subestación · la sección dice **«Unidades MCOL $»** y escribimos pesos completos. ¿Qué va en cada una? | Zona operativa · ámbito derivado del nivel · «Transformador» vacío antes que con el dato de otro · pesos completos |
| **CF-30** | **¿Un PE.02081 lleva alguna vez más de una línea de inversión?** (hoy solo cabe una; la función que suma varias está sin conectar, y el formato admite 33) | Si es sí, abro la tabla con su aviso de vigencia |
| **CF-37** | 🔶 **`99 §104`**: K11 ya lee la casilla del MISMO libro (sin vínculo externo) y sigue dando 0 → «$ -» y «#¡DIV/0!» como antes; la pregunta de fondo sigue abierta (`§104.8`). En Mantenimiento esa hoja ya no sale (pedido del 09-27). Lo que decía: **La hoja «Beneficios» del PE.02081 lee sus Costos de OTRO archivo** (`K11 = '[1]Ficha Técnica'!J37/1000000`, vínculo externo a un libro que no existe, caché 0): sale «Costos $ -» y «Relación B/C #DIV/0!» aunque la Ficha ya lleve Valor Real (`§87`; el `#DIV/0!` ya estaba en `§61.8`). ¿«Costos» es el Valor Real (`J78`) o el Valor CREG (`I78`)? | Conectarlo a `J78` (la columna J es la que el vínculo original leía), protegido para cuando diga `[PENDIENTE]` **o esté en blanco (`§93`)** |
| **CF-31** | Menores: el **$/MVA** no tiene casilla para corregir a mano (solo la instalación) · «Cantidad 2» con un total que no la multiplica · los **huecos entre bandas** del catálogo se resuelven hoy con la banda superior sin declararlo · en C3/C5 sin plan registrado el alcance sale sin actividades: ¿aviso o bloqueo? · ¿el acta debe recuperar la ficha completa (alcance, Anexo, diagramas) al importarla? · ¿una **sexta condición** para cargabilidad/edad, con tu texto? · la alerta de dato incoherente, ¿se imprime como nota de verificación? | Declarar siempre la interpretación; aviso y no bloqueo; acta que recupere todo; sin sexta condición salvo que la redactes |
| **CF-42** | **Las líneas «Fecha:» bajo cada firma salen vacías** si no se escriben en la ficha (`99 §99.11`; se le ofreció el 09-25 y no contestó). ¿Se llenan solas con la fecha del día en que se descarga el Excel? Toca el papel que se firma: **fuera de la autorización en bloque del 09-22; preguntarle**. | Dejarlas como están hasta que responda; si dice sí, la fecha de la descarga en las cinco casillas que estén vacías, con vista previa antes de publicar |

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
9. **Preguntas de Beneficios de Mantenimiento que quedaron sin respuesta** (`99 §105`). Aprobó cada texto con «aprobado» y nada se cambió por suposición: (a) ¿se quita también la salvedad final («no mejora el aceite ni el aislamiento…») a «Protecciones mecánicas» y a «Accesorios», como pidió en el tablero? Hoy la conservan · (b) ¿cambiar la sílica del respirador al terminar el termovacío o el secado es parte de esa acción? (solo cambia la nota técnica interna, no el papel) · (c) «Regeneración aceite (frío)» del catálogo: ¿«frío» quiere decir con el equipo desenergizado o con el aceite sin calentar? El texto aprobado dice «en caliente» · (d) «estanqueidad» sigue en otros textos que se firman (`fichas_diagnostico.js:435`, `acciones_tecnicas.js:91` y `:226`): ¿se cambia por «hermeticidad», como en fugas? Hasta su sí no se toca nada firmado. Las demás preguntas de cada texto → «Preguntas abiertas» de su `SINTESIS.md` en la bóveda (`2026-09-2[5-7]-beneficio-*`).
10. **CF-43 · CF-44 — Dos textos que se FIRMAN sin fuente** (`99 §137`, TODO-73; avisados el 10-03, nada tocado). **CF-43**: los cortes del «modo de degradación» (`domain/fichas_diagnostico.js:161-164`: C₂H₂ ≥ 15 · H₂ ≥ 1.000 con C₂H₄ < 100 · C₂H₄ ≥ 500 ppm) no tienen norma detrás (`52 §7`). **CF-44**: «ISO 55001» en el diagnóstico (`fichas_diagnostico.js:327`) y en el beneficio V2 (`ui/fichas/panel.js:240`) sin sustento documentado (`51 §12`). ¿Se busca y cita la fuente, se rotula «criterio del área» o se retira? Cualquier cambio: ejemplos antes y su «procede».
