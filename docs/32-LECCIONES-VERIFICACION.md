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
