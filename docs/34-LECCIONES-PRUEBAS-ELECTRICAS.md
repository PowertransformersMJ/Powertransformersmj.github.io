# ⚡ 34 — LECCIONES · Pruebas Eléctricas: dominio, tablero y previews fieles (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, 2026-09-30, `99 §120`: `30` llegó a 7 caracteres de su
> tope). Es la sección «⚡ Pruebas Eléctricas» de `30`, **copiada sin cambiar una letra**: lo que enseñó el
> tablero de pruebas eléctricas (veredicto normativo, multi-norma, paneles por prueba, previews fieles,
> datos de prueba sin cruzar de dominio). Se lee on-demand (trigger 🧪 Experiencia) **ANTES de tocar el
> tablero, sus paneles o un veredicto**, y ante UI sensible o ambigua. Varias son doctrina always-on en
> `CLAUDE.md §3.2` (L-36/L-37/L-58, L-56): aquí vive su detalle.
>
> **Alcance ampliado (2026-10-02, `99 §137`), sin renombrar el archivo**: es la casa de las lecciones de DOMINIO del
> diagnóstico —pruebas eléctricas, DGA, carga y salud—. El criterio vigente vive en los lóbulos `49`–`53`; aquí, lo
> que costó aprenderlo. Las lecciones de verificación de datos siguen fuera: L-113 en `30`, L-117 en `36`, L-118…L-120 en `32`.

---

### L-49 · UI con requisito ambiguo o sensible → workflow de PREVIEW (dev-server + harness mock) ANTES de cablear
**Disparador**: cambio de UI no trivial invisible en la app real (admin-gated + Firebase). · **Cicatriz**: (ADR-024) doble misinterpretación; la "leyenda 2019/2021/2023" NO eran chips de filtro (`.pe-fase-chip`=0). · **Regla**: `scripts/dev-server.mjs` (Node puro; `python -m http.server` da `PermissionError` en el sandbox) + harness `_dev/preview-multiano.html` con módulos reales + mocks; validar con Preview MCP y eval duro (líneas SVG 6→5 tras clic). Una LEYENDA no es un FILTRO hasta clicarla.

### L-50 · Datos de prueba (mocks dev-only) NUNCA simulan otro dominio ni datos inexistentes; y blindar el límite de dominio en el código
**Disparador**: inventar datos de ejemplo para un harness. · **Cicatriz**: (ADR-027) inventé un bloque DGA (aceite); el tablero es pruebas ELÉCTRICAS — fabricar datos + cruzar dominios. · **Regla**: mocks solo del dominio correcto (SFRA, dispersión, IR núcleo, LTC/DRM, DFR sí; DGA/fisicoquímicos/furanos/humedad-papel NO), rotulados "dev-only"; blindar en código: `familiaMA` excluye `ES_NO_ELECTRICA` antes del fallback, con test.

### L-52 · Un resultado físicamente IMPLAUSIBLE = artefacto de datos, no hallazgo → RCA en el dato ANTES de mostrarlo
**Disparador**: métrica derivada con valor absurdo. · **Cicatriz**: (ADR-040) capacitancia CHL −91.4% / CL −89.3% (~10x, imposible); esquemas distintos (2021: combos 2 devanados `CH+CHL`; 2023: 3 devanados GST/UST) → misma etiqueta ≠ misma capacitancia (2233.5 vs 191.9 pF). · **Regla**: RCA en el dato antes de mostrar; una RATIO (tan δ) tolera cambios de modo, una ABSOLUTA (pF) no; mejor caveat honesto que falsa alarma.

### L-54 · `reset` que REASIGNA un Set capturado por closures lo deja huérfano (filtros muertos / contador pegado) → mutar EN SITIO (`set.clear()` + re-add)
**Disparador**: resetear una colección capturada por closures (UI vanilla). · **Cicatriz**: (ADR-042) `sel.nivel = new Set(...)`; los chips/contadores de `grupoFiltro` capturan la referencia VIEJA → contador pegado "1/3", filtros muertos. · **Regla**: mutar en sitio (`set.clear()` + re-add), jamás reasignar; verificar ciclo default→filtrar→reset→filtrar (contadores Y efecto real).

### L-55 · Tabulador genérico cross-prueba: el TIPO de criterio (desbalance / valor / mínimo) decide qué columnas y colores; y el preview abre la RAÍZ por defecto
**Disparador**: tabulador genérico o lógica de dominio en un preview. · **Cicatriz**: (1) tan δ mostró "Desv. máx 14.53%" en rojo con chip ✓ (criterio = VALOR ≤1%, no desbalance); (2) "comparten X ⇒ fases" malclasificó bujes/2 tensiones (`Cannot read 'map' of undefined`); (3) el panel abre `/` = login en blanco; (4) GRAVE: regex tomó "10 kV" del título (tensión de ENSAYO) como nivel — el real = devanado+config (AT delta→66, AT estrella→110, MT→34.5, BT→13.8; ya en `nivelDe()`/`configInforme()`); (5) `Edit` pegó en `tarjetaGrupo` (1ª coincidencia), no en `cabeceraCard`. · **Regla**: ramificar por `crit.kind` (`desb`/`valor`/`mínimo`; columna desviación solo si `desb`); desbalance POR devanado (nunca MT ~160 mΩ vs BT ~19 mΩ); dar URL completa `/_dev/...`; REUSAR helpers de producción (`nivelDe`, `configInforme`, `derivarTablaTAP`), jamás reinventar dominio en `_dev/`; tras `Edit`, `grep -n` + `console.log` marcador antes de culpar la caché.

### L-56 · Un preview que NO ejecuta el módulo REAL + el scope + la composición de producción es ENGAÑOSO → validas algo que no es lo que se mergea
**Disparador**: preview para validación pre-merge. · **Cicatriz**: al mergear "no se parecía en NADA": MÓDULO distinto (maqueta `_dev/` vs `excitacion-panel.js`), SCOPE (sin `.pe-scope` no aplican overrides `.pe-scope .pe-vp-acc .pe-fus-*`), COMPOSICIÓN (el shell apila varios paneles). · **Regla**: importar módulos REALES + `.pe-scope` + misma composición del shell + fixtures reales (`_dev/preview-excitacion-fiel.html` ADR-046, `_dev/preview-panel-prueba-prod.html` ADR-045); estilos inline en el JS = preview==prod; marcar "falta validar en la APP".

### L-53 · Patrón de excitación 2+1: el criterio es la FORMA (externas simétricas + central distinta); la dirección HLH/LHL vs la conexión es solo INFORMATIVA (la geometría del núcleo manda)
**Disparador**: codificar una "regla de libro" como criterio duro. · **Cicatriz**: (ADR-041) "estrella⇒HLH / delta⇒LHL" marcó 4/7 tríos "irregular" en unidad SANA; la central (B) es la MENOR en estrella Y delta (camino magnético más corto → menor reluctancia). · **Regla**: criterio = FORMA (externas simétricas Δ A–C + central como extremo, `formaOk`); dirección por conexión solo informativa (`dirCoincide`); excitación = COMPARATIVA sin umbral % universal (≠ TTR 0.5%; precedencia fábrica→previos→NETA 2+1→IEEE 62/C57.152; pérdidas W también comparativas); la teoría orienta, el dato decide.

### L-51 · BORRAR de más es destruir valor ajeno al pedido → ante duda de alcance, retira lo MÍNIMO señalado (no el contenedor)
**Disparador**: borrado por pantallazo o alcance ambiguo. · **Cicatriz**: (ADR-035→036) "elimina esto": el pantallazo arrancaba en el encabezado "Resultados del informe" pero señalaba el bloque tan δ; oculté TODA la sección y borré bujes/excitación/relación/resistencia/aislamiento. · **Regla**: defecto CONSERVADOR — retirar lo mínimo, nunca el contenedor; lo ya representado en otro lado (tan δ) es candidato, lo único es pérdida neta; implementar como filtro (`bloques.filter(b => familiaMA(b)?.key !== 'tand')`) y validar en `preview-bloques.html`.

### L-42 · Ninguna columna "Evaluación/OK" en las tablas — el veredicto es del panel multi-norma
**Disparador**: tablas de detalle (tan δ, bujes, aislamiento) con veredictos por fila. · **Cicatriz**: el prompt PEDÍA columna "Evaluación" (la IA ponía "OK") y `derivarTablaTAP` añadía "Eval." derivada — doble origen que violaba L-36. Cada laboratorio nombra distinto la columna (2021/Applus: "Resultado"/"Evaluación"; 2023/EMS: "Evaluación"). · **Regla** (3 capas): (1) quitar Evaluación/Calificación del prompt (IA emite solo datos crudos) + re-deploy de `extraerPruebasElectricasIA`; (2) `derivarTablaTAP` sin "Eval." (mantener "Desv. %", que es DATO); (3) `quitarColumnasVeredicto` (dominio) como strip defensivo en `tablaBloque` — detección por DOS vías: encabezado `/evaluaci|calificaci|veredicto|resultado|concepto|dictamen|diagnostic|^eval\.?$/i` O todas las celdas = palabras de veredicto. Tablas = DATOS; veredicto = panel multi-norma; sospechoso → `verificar`, nunca "OK".

### L-41 · El badge de estado debe reconocer TODOS los estados "listos" (allowlist frágil)
**Disparador**: clasificar un código de estado. · **Cicatriz**: `pendiente = estado !== 'extraido' && estado !== 'procesado'` (×3 copias inline) no incluía `'extraido_ia'` → informes perfectos marcados "pendiente de extracción" con Reprocesar siempre visible. · **Regla**: predicado único `tabla-pruebas.js#esPendienteExtraccion` = `!String(estado).startsWith('extraido') && estado !== 'procesado'`. Nunca allowlist de strings exactos repetida inline; si un estado nuevo aparece en la ESCRITURA, busca TODAS las LECTURAS que lo clasifican.

### L-40 · Operar sobre un archivo YA en Storage va SERVER-SIDE (caso histórico: Reprocesar, retirado en ADR-020)
**HISTÓRICA: Reprocesar se retiró (ADR-020); NO reintroducir (`CLAUDE.md §3.2`).** El principio sigue valiendo para cualquier operación sobre un archivo que ya está en Storage: lo lee el servidor, no el navegador (L-29). · **Disparador**: operar sobre un archivo YA en Storage. · **Cicatriz**: "Reprocesar" descargaba el PDF al navegador (`getBlob`/fetch de la downloadURL) → errores CORS (Storage no se lee del browser sin CORS, L-29) y usaba el extractor débil. · **Regla**: reprocesar = re-llamar `extraerConIA({storagePath})` — la CF lee el PDF en el servidor, re-extrae y re-deriva; luego `actualizarInforme`+`guardarBloques` con el MISMO id + invalidar `state.bloquesCache`. El navegador solo SUBE o navega ("Descargar PDF" = `<a href download>`, sin XHR); CORS del bucket solo si de verdad lees blobs desde el cliente.

### L-39 · Re-carga de informes = upsert por fecha exacta (con confirmación), no duplicar a ciegas
**Disparador**: cargas que pueden repetirse. · **Cicatriz**: `crearInforme` siempre hacía `addDoc` → duplicados (dos puntos del mismo año en la tendencia, columnas dobles). · **Regla** (`storeReport`): `listarInformes(unidadId)` + `buscarInformeExistente` por FECHA EXACTA (dd/mm/aaaa; fallback a AÑO solo si el nuevo no trae fecha); si hay match, `window.confirm` → REEMPLAZAR (borra doc + diagnóstico + `eliminarPDF`, sin huérfanos) o crear nuevo. Lista local mutable para duplicados dentro del MISMO lote. Toda carga repetible: clave de identidad + política de colisión explícita, nunca "siempre insertar".

### L-37 · Veredicto robusto = MULTI-NORMA (peor de todas + mostrar divergencias) — ninguna norma es "la definitiva"
**Disparador**: calificar una prueba contra criterios normativos. · **Cicatriz**: colapsar a UN criterio (≤2% NETA) pierde diagnóstico — cada norma mira un ángulo (NETA pisos, IEEE C57.152 método+tendencia, MO.00418 por clase, industria, fábrica baseline); caso testigo: 5 GΩ a 110 kV pasa NETA 100.5 pero falla por clase 30 GΩ. · **Regla** (ADR-012, `pruebas_electricas_multinorma.js`): `evaluarMultiNorma` → `{opticas, consolidado=el más conservador, divergen}`; el consolidado conduce el semáforo, las divergencias se muestran; precedencia fábrica > clase > NETA > industria define qué número se CITA, no cuál se ignora. Gotcha: al reusar `calificarResistencia` como evaluador NO pasar `ctx` crudo como 2º arg (lo toma como `flagVerificar` → siempre ámbar); envolver `(v)=>calificar(v)`. Marco: `_conocimiento/marco-normativo-multinorma.md §4`.

### L-73 · La columna de EVALUACIÓN de la fuente del cliente contradice a su propio valor medido
**Disparador**: usar una columna «EVALUACION …» del Excel del cliente como si fuera veredicto. · **Cicatriz** (2026-08-21, hoja TX_Potencia): `T1-M/M-AST` (ASTREA) mide **250 % de carga** —físicamente implausible, artefacto de dato (**L-52**), y coincide con la hipótesis «columnas intercambiadas» que el barrido de ADR-067 había dejado sin cerrar— mientras su propia `EVALUACION CARGABILIDAD` dice **1** (óptimo). Igual `T1-M/M-LOR` (LORICA): 98 % medido, evaluación 1. Y al revés: GUATAPURI y MAJAGUAL vienen en `CONDICION` 5 sin que ninguna columna medida lo sostenga. · **Regla**: las columnas de EVALUACIÓN/CONDICIÓN de la fuente son **referencia, no veredicto** — es **L-36 aplicada al Excel**: se recalcula desde el valor medido contra la norma y la divergencia se MUESTRA, no se esconde ni se pisa. Una fuente que se contradice a sí misma es señal de dato sucio, no de criterio experto (mismo patrón que la columna CAUSANTE, ya conocida como no confiable). Ver `99 §69`.

### L-36 · El veredicto es del VALOR contra la NORMA — nunca del informe ni del texto de la IA
**Disparador**: cualquier "estado/semáforo/OK" en la UI. · **Cicatriz** (ADR-011): `renderScorecard` mapeaba `b.calif` (texto del laboratorio/IA) al semáforo mientras el KPI derivaba de `calificarPrueba(valor)` → "Satisfactorio" junto a "fuera de norma". · **Regla**: toda calificación se computa en el dominio desde el valor medido vs el umbral (`calificarPrueba`, único punto de verdad); el texto del informe/IA es solo CONTEXTO. Parámetros físicos del criterio (clase de tensión, NETA 100.5) entran al calificador del DOMINIO (`opts.minNeta`), no a la capa de presentación — si no, las vistas divergen. Citar siempre norma + umbral junto al veredicto.

### L-34 · Auto-graficar TODA magnitud derivada produce ruido/duplicados → curar qué amerita gráfica
**Disparador**: auto-render de claves `extra`/derivadas · **Cicatriz**: gráficas redundantes (R.Ref ≈ R.Medida, %DIF duplicada, tensión monótona sin valor) — "renderiza todo" trata datos de TABLA como de GRÁFICA · **Regla (ADR-009, `bloquesDeExtra`/`EXTRA_GRAFICABLE`)**: data secundaria a TABLA por defecto; solo graficar magnitud distinta y diagnóstica (ej. Potencia); curar con allowlist/regex/flag. Mostrar dato ≠ visualizar tendencia; más gráficas ≠ más claridad.

### L-57 · "Hazlo como X" → encuentra QUÉ componente produce X antes de construir uno nuevo
**Disparador**: pedido "hazlo como X" · **Cicatriz (ADR-050)**: asumí que las tablas de excitación salían de `excitacion-panel.js` y recreé un panel en `tand-panel.js`; en realidad las renderiza `montarPanelPrueba(host,'excitacion',…)` (`tablas-pruebas-panel.js`), compartido y que YA soportaba `'tand'` — rechazo del director y revert a HEAD · **Regla**: localizar el código que produce X (grep del render real, no el panel "obvio") y reusar; "parecerse a X" = usar el MISMO componente, no reimplementar (§3.3).

### L-58 · Veredicto multi-norma: un chip POR NORMA, nunca un estado consolidado para todos
**Disparador**: pintar chips/badges por norma · **Cicatriz (ADR-050)**: tan δ 0.51% marcado ✕ en NETA E IEEE — cumple IEEE (≤1%), solo supera NETA (0.5% → investigar); `chipsCriterio(familia, estado)` aplicaba el estado consolidado (peor) a TODOS los chips · **Regla**: cada chip sale de `evaluarMultiNorma(familia, metrica).opticas[i].estado` (nivel→símbolo: 0 ✓ · 1-2 ⚠ · ≥3 ✕; óptica informativa nivel <0 cae al consolidado); el consolidado conservador es solo para el VEREDICTO GLOBAL; "investigar" ≠ "no cumple"; chips deben coincidir con la tabla de diagnóstico.

### L-123 · Antes de crear un criterio de DGA, busca los que ya existen: hoy conviven cuatro
**Disparador**: escribir una regla que lea gases (zona de falla, «modo de degradación», alerta). · **Cicatriz** (`99 §131`,
`§137`): la plataforma ya tenía DOS reglas de Duval —una corregida en `dga_duval.js` y la vieja de `dga_diagnostico.js`, que
clasificaba mal ~51 % del área y se guardaba con cada muestra nueva— y una TERCERA copia en `pages/parque-transformadores.html`
(idéntica a la corregida por casualidad, sin candado), más Rogers/Doernenburg sin cotejar y los cortes propios de
`modoDegradacion` (Fichas) sin fuente. · **Regla**: antes de escribir, leer el registro de `52 §7`; reusar `zonaDuval1`;
si hace falta un criterio nuevo, registrarlo allí con su fuente o rotularlo «criterio del área». [HONOR] (candado
pendiente: TODO-73)

### L-125 · Una cifra que el código pone junto a una norma se busca EN la norma antes de firmarla
**Disparador**: un texto que se firma (o el cerebro) cita una norma al lado de un umbral, o dice «ratificado con …». · **Cicatriz**
(`99 §140`, nota `§57.8`): `modoDegradacion` cerraba con «conforme a IEEE C57.104 · IEC 60599 · triángulo de Duval» unos cortes
(15 · 500 · 1.000/100 ppm) que ninguna trae; decía que el acetileno «solo» sale de un arco (IEC 60599:2022 §4.1: *principalmente*)
y que 500 ppm de etileno son el punto caliente del devanado por carga (es una falla térmica localizada); y el cerebro daba por
«ratificados con el MO» 15 ppm y 0,5 ppm/día, cuando el PDF del MO no dice «ppm» ni una vez. · **Regla**: (1) la norma se cita
para el PRINCIPIO (qué gas da cada falla); el umbral propio se rotula «criterio del área» solo con el sí del Ingeniero; (2)
«ratificado con X» exige la página leída en la sesión (`pdftotext` del PDF de `~/Downloads`); (3) un valor absoluto en ppm no
garantiza la temperatura de la falla (C₂H₄ 500 con CH₄ alto da T1): sin Duval calculado no se imprime un rango en °C. [HONOR]
