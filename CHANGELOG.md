# Changelog — SGM · TRANSPOWER

Evolución v1.0 → v2.0 conforme **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM).

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).
Semver por tag. Pulido post-v2.0 incrementa el patch (v2.0.1,
v2.0.2, …) sin promesas de incompatibilidad.

## En curso · Mix multi-modelo en Selección ONAF (2026-05-03)

Trabajo en curso para soportar **combinación de varios modelos de
ventilador en el mismo transformador** (mix real de campo, ej.:
4 × ZIEHL FN-050 + 8 × ZIEHL FN-063 + 12 × KRENZ F20 alimentando
un mismo transformador 24 MVA). Estado actual: dominio puro listo
+ tests verdes. Pendientes: UI · informe · persistencia · tab
consolidado.

### Hotfix UI · Reordenar Mix antes que Datos técnicos + alta resolución gráfica informe (2026-05-03 PM12)

Dos ajustes solicitados por el director:

**1. Gráfica del informe AFINIA en alta resolución**
- `assets/js/calculo-refrigeracion.js` · `generateReport()` ahora
  cambia `state.chart.options.devicePixelRatio = 3` antes de
  capturar la imagen base64, fuerza `chart.resize()` para que
  Chart.js redibuje a 3× resolución, captura, y restaura el DPR
  original. Causa un breve flash al exportar (aceptable).
- CSS del informe · `.chart-img` aumenta `max-width` de 5.6in a
  6in y agrega `image-rendering: -webkit-optimize-contrast` +
  `image-rendering: crisp-edges` para que al imprimir o ampliar
  no haya pixelado. Todos los rótulos, ticks, líneas punteadas,
  legendas y curvas se aprecian nítidos.

**2. Reordenar UI · Mix antes de Datos técnicos del motoventilador
   y mostrar TODAS las fichas del mix**
- `pages/calculo-refrigeracion.html` · sección "Mix de
  motoventiladores" movida ANTES de "Datos técnicos del
  motoventilador" (orden lógico: primero se elige qué modelos y
  cuántos, después se ven sus fichas técnicas detalladas).
- `pages/calculo-refrigeracion.html` · "Datos técnicos del
  motoventilador" ahora trae al inicio un contenedor
  `#fichas-mix-wrap` que se rellena dinámicamente con UNA ficha
  read-only por cada modelo del mix (24 campos del catálogo:
  identificación + aerodinámica + motor eléctrico).
- El editor manual / preview legacy (selector `fan_db_sel` +
  inputs editables) se mantiene debajo con su subsection title
  explícito "Editor manual / preview de un modelo (opcional)" y
  hint que aclara que alimenta compatibilidad mecánica + fallback
  legacy de protección.
- `assets/js/calculo-refrigeracion.js` · funciones nuevas
  `renderFichasMix()` y `renderFichaUnica(it, idx)` que generan
  cada ficha con cabecera (marca + modelo + cantidad + aporte
  CFM) + grid de identificación con 12 campos + grid del motor
  eléctrico con 12 campos. Se invoca desde `renderMix()` en cada
  cambio del mix.
- `assets/css/calculo-refrigeracion.css` · estilos nuevos
  `.fichas-mix-wrap`, `.ficha-mix-grid` (auto-fit responsive),
  `.fmf-cell`, `.fmf-l`, `.fmf-v`, `.fmf-empty`. Diseño compacto
  con borde-left azul de marca que distingue cada ficha.

570/570 tests verdes · HTML lint OK.

Sin deploys Firebase requeridos.

### Hotfix post-plan · Deep-clean en data layer acciones_refrigeracion (2026-05-03 PM11)

Bug de regresión revelado al probar el modal "Registrar acción de
mantenimiento" después de cerrar el plan de 6 microfases. El
director envió un payload con todo correcto (matrícula T1-M/M-CHG,
mix válido de 2 modelos / 6 unidades, descripción de 100+ chars,
estado planificada, fechas) y obtuvo *"Missing or insufficient
permissions"* en el banner de error del modal.

**Causa raíz:** Firestore Web SDK rechaza valores `undefined` con
un error engañoso de `permission-denied` (en lugar del esperado
`invalid-argument`). El sanitizador top-level del data layer no
recurría a objetos anidados, así que el `mix[].ficha` y los
snapshots `evaluacion` / `proteccion` / `compatibilidad` /
`resumen_json` / `validacion_grafica` (microfases 4-5-6) podían
contener `undefined` en campos opcionales del catálogo. Documentado
extensamente en CLAUDE.md §0.1.2.6 como regla permanente.

Cambios:
- `assets/js/data/_firestore_clean.js` (nuevo) · helper genérico
  `deepClean(value)` recursivo. Elimina `undefined`, `NaN`,
  `Infinity`, `function`. Preserva `null`, `0`, `''`, `false`,
  `Timestamp`, `FieldValue`. Mapea arrays + objetos planos.
- `assets/js/data/acciones_refrigeracion.js` · importa `deepClean`
  y lo aplica en `crear()` y `actualizar()` justo antes de
  `addDoc()` / `updateDoc()`.
- `assets/js/calculo-refrigeracion.js` · `guardarAccion()` mejora
  el manejo de error: detecta `code: 'permission-denied'` o regex
  `/permission/i` y muestra mensaje accionable con las 3 causas
  probables (sesión admin, rules desplegadas, undefined en
  payload). Misma lógica para `invalid-argument` y
  `failed-precondition`.
- `tests/acciones_refrigeracion_deepclean.test.js` (nuevo) · 13
  tests cubriendo:
  - undefined / null / primitivos preservados / NaN / Infinity
  - function omitida
  - Objeto plano elimina claves undefined
  - Objeto anidado profundidad 3
  - Array elimina items undefined / array de objetos
  - Caso real con payload completo de acciones_refrigeracion
  - Timestamp simulado (con toDate) preservado
  - FieldValue simulado (con _methodName) preservado
- `CLAUDE.md` · regla permanente nueva **§0.1.2.6** *"Firestore
  rechaza undefined con error 'permission-denied' engañoso"* con:
  · contexto del bug histórico
  · causa raíz documentada (con referencia al issue de
    firebase-js-sdk)
  · síntomas a reconocer en futuras sesiones
  · 5 reglas obligatorias (helper deepClean genérico, aplicar
    antes de write, no confiar en sanitizador top-level, mensaje
    de error accionable, tests obligatorios del helper)
  · catálogo de data layers afectados (acciones_refrigeracion,
    documentos_contractuales, muestras, ordenes, futuros del
    módulo brigada).

570/570 tests verdes (+13 del deep-clean) · HTML lint OK.

**Sin deploys Firebase requeridos** (el cambio es 100% cliente).

### Microfase 6 · Validación gráfica Westinghouse vs cálculo (2026-05-03 PM10) — CIERRE PLAN

Sexta y última microfase. Cierra el plan de 6 microfases para
alinear la calculadora ONAF con el prompt técnico del director.
Detecta inconsistencias entre los inputs del usuario y la curva
Westinghouse calibrada.

Dominio (assets/js/domain/refrigeracion.js):
- Función pura nueva validarPuntoOperacion({onan_kva, pct,
  cfm_calculado, alt_m}) hace 2 chequeos:
  · A · Rango calibrado: el % está dentro del rango cubierto por
    las curvas oficiales (115-166%). Fuera de eso → severidad
    'err' por extrapolación.
  · B · Coherencia gráfica vs cálculo: calcula CFM esperado
    interpolando la pendiente Westinghouse al % seleccionado y
    aplicando corrección de altitud. Compara con cfm_calculado.
    Delta > 5% → 'err' (inconsistencia de inputs). Delta 2-5%
    → 'warn'. Delta ≤ 2% → 'ok'.
- Devuelve estructura compacta con cfm_esperado, cfm_calculado,
  pendiente_esperada, delta_cfm, delta_pct_abs, severidad,
  rango_calibrado, pct y mensaje humano.

Tests: +6 (98 → 104 en refrigeración):
- Caso golden 24 MVA × 125% = 48000 CFM (severidad 'ok')
- Discrepancia leve (2-5%) → 'warn'
- Discrepancia grande (>5%) → 'err'
- % fuera del rango calibrado → 'err' por extrapolación
- Aplica corrección de altitud al esperado
- pendiente_esperada coincide con interpolarPendiente

UI (pages/calculo-refrigeracion.html + assets/js/calculo-refrigeracion.js):
- Contenedor nuevo #valida-grafica debajo del canvas Chart.js.
  Hidden por defecto.
- renderValidacionGrafica(v) muestra banner con badge ✓/⚠/✗,
  mensaje, KPIs (CFM esperado, delta absoluto y %, pendiente
  esperada). Color verde/naranja/rojo según severidad.
- upd() invoca validarPuntoOperacion en cada cambio de input
  (ONAN/ONAF/% / altitud) y persiste en state.lastValidacion.
- calcularResumenActual() (helper microfase 5) adjunta el
  resultado como campo `validacion_grafica` del resumen JSON
  exportado.
- guardarAccion enriquece payload con validacion_grafica.

CSS:
- .valida-grafica con 3 variantes (.is-ok verde, .is-warn
  naranja, .is-err rojo).
- .vg-badge pill, .vg-msg flexible, .vg-kpi monoespaciado.

Data layer (assets/js/data/acciones_refrigeracion.js):
- sanitizar() acepta data.validacion_grafica como objeto y lo
  persiste para auditoría desde la tab Consolidado.

557/557 tests verdes (+6) · HTML lint OK.

Pendiente director: validar visualmente.

═══════════════════════════════════════════════════════════════
PLAN DE 6 MICROFASES CERRADO
═══════════════════════════════════════════════════════════════
Resumen total:
- Microfase 1: tolerancia_pct configurable
- Microfase 2: 5 estrategias enriquecidas (incl. VFD,
  optimización aerodinámica)
- Microfase 3: FLC + contactor ABB AF + tags SCADA + coordinación
- Microfase 4: detección de faltantes con 3 severidades
- Microfase 5: snapshot JSON con shape exacto del prompt
- Microfase 6: validación gráfica Westinghouse vs cálculo

Tests acumulados: 557/557 verdes (vs 503 al inicio del plan).
HTML lint limpio durante toda la sesión. Branch lista para merge
a main tras validación final del director.

### Microfase 5 · Exportar resumen JSON estructurado (2026-05-03 PM9)

Quinta microfase. Genera un snapshot JSON con el shape EXACTO del
prompt técnico del director (selecciones / cfm_requerido / cfm_total
/ evaluacion / razon / estrategias_sugeridas / seleccion_electrica /
faltantes / metadatos). Útil para integraciones, audit trail y
handoff a herramientas externas (Excel, Power BI, ERP, SCADA).

Dominio (assets/js/domain/refrigeracion.js):
- Función pura nueva construirResumenJSON({mix, evaluacion,
  proteccion, sugerencias, faltantes, metadatos}) que arma:
  · selecciones[] · una entrada por modelo del mix con
    {id, marca, modelo, cantidad, cfm_unit, cfm_total}
  · cfm_requerido / cfm_total / cfm_umbral / tolerancia_pct /
    cobertura_pct / deficit_cfm / exceso_cfm / n_unidades_total
  · evaluacion · 'APROBADO' | 'REQUIERE AJUSTE'
  · razon · texto humano refleja tolerancia si > 0
  · estrategias_sugeridas[] · descripcion + impacto +
    implicaciones + factibilidad + aprobado
  · seleccion_electrica[] · uno por grupo (modelo) con
    id_ventilador, marca, modelo, cantidad, potencia_hp, flc_A,
    guardamotor {tipo, corriente_ajustada_A, rango_A, pid,
    justificacion}, contactor {modelo_sugerido, ac3_A, kw_400v,
    margen_pct, bobina, pid, contactos_NO, contactos_NC,
    tags_SCADA, justificacion}, auxiliar_guardamotor
  · breaker_sistema · 1 ud para todo el sistema con
    {modelo_sugerido, In_A, curva, poder_de_corte_kA,
    perdidas_W, pid, auxiliar_SCADA, justificacion}
  · faltantes[] · strings compactos con [SEVERIDAD] + campo +
    modelo + mensaje
  · metadatos · transformador_id, matricula, proyecto,
    subestacion, zona, depto, grupo, serie, kva_*, pct, altitud,
    conexion_motor, responsable_uid/email/nombre,
    fecha_generacion, version_resumen ('1.0'), norma_referencia.

Tests: +7 (91 → 98 en refrigeración):
- Shape canónico con todas las claves del prompt
- selecciones tiene estructura correcta por modelo
- evaluación APROBADO vs REQUIERE AJUSTE
- seleccion_electrica trae guardamotor + contactor + breaker
- faltantes mapeados a strings con severidad
- metadatos incluye fecha_generacion + version_resumen
- Razón refleja tolerancia cuando aplica

UI (assets/js/calculo-refrigeracion.js + pages/calculo-refrigeracion.html):
- Función nueva calcularResumenActual() que es helper común
  reutilizado por exportarResumenJSON, guardarAccion (snapshot
  persistido) y eventualmente generateReport. Captura todo el
  estado actual + sesión del usuario + parámetros del cálculo.
- Función nueva exportarResumenJSON() que descarga el snapshot
  como .json con nombre `resumen-refrigeracion-{matricula}-{fecha}.json`.
- Botón nuevo #btnExportJson (color púrpura) en la barra de
  exportar, al lado de "Exportar informe AFINIA". Icono Lucide
  `braces`.
- guardarAccion enriquece el payload con `resumen_json:
  calcularResumenActual()` para que el doc Firestore quede con
  el snapshot canónico para el audit.

Data layer (assets/js/data/acciones_refrigeracion.js):
- sanitizar() acepta data.resumen_json como objeto, lo persiste
  en el doc para que la tab Consolidado pueda exportar el
  resumen sin recalcular.

551/551 tests verdes (+7) · HTML lint OK.

Pendiente director: validar visualmente.
Próxima microfase (6): comparación gráfica Westinghouse vs
cálculo (validación punto de operación + warning si
discrepancia > 2%).

### Microfase 4 · Detección de faltantes para cálculo eléctrico (2026-05-03 PM8)

Cuarta microfase. Detecta y reporta campos faltantes en la ficha
técnica de cada modelo del mix que afectan el cálculo eléctrico,
sin bloquear el flujo (la calculadora sigue con valores por defecto
razonables).

Dominio (assets/js/domain/refrigeracion.js):
- Función pura nueva detectarFaltantes({mix}) → devuelve array de
  objetos {key, modelo, marca, campo, severidad, sustituto, mensaje}
  por cada faltante. Tres severidades:
  · critico · sin esto NO se puede calcular protección eléctrica
    del modelo (ej. fan_amp + sin potencia ni voltaje para derivar).
    Si esto pasa, los siguientes faltantes del mismo modelo se
    omiten (cascada).
  · aviso   · cálculo con valor por defecto razonable (ej. cos φ
    asumido 0.85, η asumida 0.85, voltaje 400 V).
  · info    · opcional, solo afecta exports (ej. fan_peso = null).
- Heurística: corriente directa de placa fan_amp parsea el primer
  número (formato "1.13/0.65 A (D/Y)"). Voltaje extraído del
  string fan_volt (regex /(\d+)\s*V/).

Tests: +7 (83 → 91 en refrigeración):
- Mix vacío devuelve [].
- Ficha completa no genera faltantes.
- Severidad crítico cuando no hay placa ni datos para derivar.
- Aviso cuando falta cos φ (sustituto 0.85).
- Info cuando falta peso (no bloquea cálculo).
- Omite items con cantidad <= 0.
- Mensajes incluyen marca + modelo para identificar.

UI (pages/calculo-refrigeracion.html + assets/js/calculo-refrigeracion.js):
- Contenedor nuevo #prot-faltantes en la sección "Circuito de
  protección eléctrica y mando", debajo del bloque de conexión
  Δ/Y. Hidden por default.
- Función nueva renderFaltantes(arr) que ordena por severidad
  (crítico > aviso > info), muestra contador en el header
  ("3 críticos · 2 avisos · 1 info"), lista cada faltante con
  pill de severidad + mensaje accionable, y pie con hint
  diferenciado: si hay críticos enfatiza que esos modelos no
  pueden dimensionar protección.
- calcProtection() invoca detectarFaltantes(state.mix) y
  guarda en state.lastFaltantes; renderFaltantes(arr) en cada
  cambio de mix o tolerancia.
- guardarAccion() incluye campo nuevo `faltantes` en el payload.

CSS:
- .prot-faltantes con fondo amarillo crema + border-left naranja.
- .pf-sev.critico (rojo), .pf-sev.aviso (naranja), .pf-sev.info
  (azul) en pills.

Data layer (assets/js/data/acciones_refrigeracion.js):
- sanitizar() acepta data.faltantes como array, lo persiste en el
  doc Firestore para auditoría posterior desde la tab Consolidado.

Informe AFINIA · sec 9:
- Bloque amarillo informativo bajo la tabla principal cuando hay
  faltantes. Lista cada uno con badge [SEVERIDAD] coloreado (rojo
  crítico, naranja aviso, azul info). Pie explica que el cálculo
  se ejecutó con valores por defecto razonables.

544/544 tests verdes (+8) · HTML lint OK.

Pendiente director: validar visualmente.
Próxima microfase (5): exportar resumen JSON estructurado con shape
exacto del prompt (selecciones, evaluacion, estrategias_sugeridas,
seleccion_electrica, faltantes).

### Microfase 3 · Selección eléctrica detallada (FLC + contactor AF + SCADA + coordinación) (2026-05-03 PM7)

Tercera microfase del plan de 6. Amplía el cálculo eléctrico para
cubrir el ciclo completo de protección + maniobra + señalización
SCADA exigido por el prompt técnico del director.

Dominio (assets/js/domain/refrigeracion.js):
- Catálogo nuevo CONTACTOR_AF_DB (7 modelos ABB AF: AF09, AF12,
  AF16, AF26, AF38, AF65, AF80) con corriente AC-3, kW @ 400 V,
  PID y tipo de bobina universal.
- Constante TAGS_SCADA con 4 tags estándar (RUN, FAULT, TRIP,
  READY) cada uno con contacto físico + descripción.
- Función pura nueva seleccionarContactor(flc, factor=1.15) que
  selecciona el AF cuya corriente AC-3 cubre FLC × margen de
  servicio. Devuelve `margen_pct` calculado.
- Función pura nueva calcularFLC({p_w, hp, voltaje, cosphi,
  eficiencia, amps_directo}) con 3 rutas:
  · placa: si pasamos amps_directo lo usamos sin cálculo
  · cálculo: FLC = P / (√3 × V × cos φ × η) con memoria
    (fórmula sustituida con valores reales)
  · sin_datos: lista de campos faltantes
- calcularProteccionMix devuelve cada grupo con campo `contactor`
  + objeto `tags_scada` a nivel raíz.
- calcularProteccionElectrica (legacy) devuelve también
  `contactor` y `tags_scada`.

Tests (tests/refrigeracion.test.js): +12 tests:
- CONTACTOR_AF_DB tiene 7 modelos ordenados por AC-3
- TAGS_SCADA expone los 4 tags estándar
- seleccionarContactor cubre FLC × 1.15 (caso 0.65 / 8 / 25 A)
- factor personalizable
- fuera de catálogo → null
- calcularFLC ruta 1 (placa)
- calcularFLC ruta 2 (cálculo desde p_w)
- calcularFLC acepta HP (× 746)
- calcularFLC ruta 3 (sin datos) reporta faltantes
- amps_directo tiene precedencia sobre cálculo
- calcularProteccionMix incluye contactor + tags_scada
- calcularProteccionElectrica también

UI (assets/js/calculo-refrigeracion.js):
- renderProtPorGrupo refactorizado a renderGrupoProtCard. Cada
  card de grupo muestra ahora 4 columnas:
  · Grupo + FLC + memoria de cálculo (norma NEMA MG-1 / IEC 60034)
  · Guardamotor MS116 + setting + margen del setting % del rango
    (NEC 430.32, IEC 60947-4-1)
  · Contactor ABB AF + AC-3 + margen sobre FLC + tags SCADA
    inline (RUN/FAULT/READY) con norma IEC 60947-4-1
  · Auxiliar SCADA del guardamotor
- renderProtTotal incluye al pie un bloque renderSCADAblock con
  los 4 tags SCADA en grid responsive + norma IEEE C37.91 /
  IEC 61850. La card del breaker incluye coordinación con MCCB
  aguas arriba (norma IEC 60947-2 · NEC 430.52).
- renderListaMaterialesMix añade el contactor por grupo al BOM.
- renderProtLegacyPerFan reescrito con 4 cards (FLC + memoria
  calcularFLC, MS116, AF, auxiliar SCADA).
- renderProtLegacyTotal con bloque SCADA + nota de coordinación.
- renderProtLegacyMateriales añade contactor al BOM.

Informe AFINIA · sec 9 (Circuito de protección eléctrica):
- Tabla principal amplía columna 'Detalles' por columnas
  separadas Guardamotor MS116 + Contactor AF (modelo + AC-3 +
  PID inline).
- Tabla complementaria de KPIs incluye fila "Coordinación" con
  nota explícita.
- Sub-tabla nueva con los 4 tags SCADA + contacto + descripción.
- BOM agrupado incluye contactor por grupo + nota tags al pie.

CSS: sin cambios (reutiliza .prot-card existentes).

536/536 tests verdes (+12) · HTML lint OK.

Pendiente director: validar visualmente.
Próxima microfase (4): detección y reporte de "Faltantes" para
cálculo eléctrico completo (banner amarillo cuando faltan
potencia, eficiencia, voltaje, cos φ).

### Microfase 2 · Estrategias enriquecidas (5 tipos + factibilidad + implicaciones) (2026-05-03 PM6)

Refactor del motor `sugerirMejoras` para alinearlo con el prompt
técnico del director: hasta 5 estrategias, cada una con `factibilidad`,
`impacto_estimado_cfm` e `implicaciones` operativas/coste.

- `assets/js/domain/refrigeracion.js` · `sugerirMejoras` reescrito:
  - Mantiene las 3 estrategias existentes (`agregar_unidades`,
    `sustituir`, `agregar_modelo`).
  - Suma 2 estrategias nuevas:
    - **`vfd_uprate`** · operar con variador de frecuencia. Si en el
      catálogo existe variante de mayor frecuencia/RPM del mismo
      modelo (ej. `fn063_50` → `fn063_60`) usa el CFM exacto de esa
      variante; si no, asume factor 1.20 sobre el CFM nominal con
      texto explícito en la descripción.
    - **`optimizacion_aerodinamica`** · informativa. Aparece solo
      cuando el déficit es > 10% del requerido. Estima +5–10%
      adicional al rediseñar toma de aire / reducir restricciones
      del flujo. Sin cambios automáticos al mix (`cambios = []`).
  - Cada sugerencia retorna **3 campos nuevos**:
    `impacto_estimado_cfm` (delta CFM versus mix actual),
    `implicaciones` (texto sobre coste y consideraciones operativas),
    `factibilidad` (`'alta' | 'media' | 'baja'`).
  - Acepta nuevo parámetro `tolerancia_pct` (alineado con microfase 1).
    Las sugerencias se evalúan contra `cfm_requerido × (1 − tol/100)`
    en lugar del requerido estricto, así son coherentes con el banner.
  - Default `max_sugerencias` sube de 3 → 5.
  - **Ordenamiento nuevo:** primero las `aprobado=true`, luego por
    factibilidad (alta > media > baja), luego por menor exceso. Antes
    era solo por menor exceso.
  - Factibilidad asignada por estrategia: `agregar_unidades=alta`
    (mismo modelo, sin reingeniería); `sustituir=media` (recalcular
    protección + verificar montaje); `agregar_modelo=media`
    (más SKUs en inventario); `vfd_uprate=baja` (requiere VFD +
    coordinación SCADA); `optimizacion_aerodinamica=baja` (requiere
    ingeniería específica).
- `tests/refrigeracion.test.js` · 5 tests nuevos:
  - Ordenamiento por factibilidad (alta > media > baja).
  - Cada sugerencia trae los 3 campos enriquecidos.
  - `vfd_uprate` con variante en catálogo (50→60 Hz) → quitar+agregar.
  - `vfd_uprate` genérica sin variante → `cambios=[]` + factor 1.20.
  - `optimizacion_aerodinamica` solo aparece con déficit > 10%.
  - Propagación de `tolerancia_pct` (sugerencias coherentes con el
    banner de microfase 1).
- UI · `renderSugCard` extraído como helper. Cada card del panel
  de sugerencias ahora muestra:
  - Header con título de la estrategia + badge de factibilidad
    (🟢 ALTA / 🟡 MEDIA / 🟠 BAJA) en pill alineado a la derecha.
  - Descripción de la acción.
  - KPI con CFM resultante + delta `+X CFM` (verde si aprueba,
    rojo si no) + cobertura + exceso.
  - **Bloque "Implicaciones"** con texto sobre coste y consideraciones
    operativas, separado por línea dashed.
  - Botón "Aplicar sugerencia" deshabilitado en estrategias
    informativas (`cambios=[]`) con tooltip explicativo.
- Informe AFINIA · sec 8 sub-tabla de sugerencias amplía columnas
  con **Factibilidad** + **Δ CFM** y muestra implicaciones bajo cada
  descripción en cursiva. Header del panel actualizado: *"hasta 5
  alternativas ordenadas por factibilidad (alta → baja)"*.
- 524/524 tests verdes · HTML lint OK.

**Pendiente director:** validar visualmente.
Próxima microfase (3): selección eléctrica detallada con FLC + contactor
ABB AF + tags SCADA + coordinación de protecciones.

### Microfase 1 · Tolerancia configurable en evaluación del mix (2026-05-03 PM5)

Primera microfase de un plan de 6 microfases para alinear la
calculadora ONAF con el prompt técnico del director (selección
estructurada de ventiladores + protección eléctrica + JSON output).

- `assets/js/domain/refrigeracion.js` · `evaluarMixVentiladores`
  acepta nuevo parámetro opcional `tolerancia_pct` (default 0).
  Cuando `tolerancia_pct > 0` el umbral de aprobación se relaja
  a `cfm_requerido × (1 − tol/100)` — útil cuando el proyecto
  admite cobertura mínima ≥95% en lugar de ≥100% estricto.
  Devuelve dos campos nuevos: `cfm_umbral` (CFM mínimo aceptado)
  y `tolerancia_pct` (eco del valor aplicado, clampeado a 0…100).
  El mensaje del banner ahora indica el umbral cuando hay
  tolerancia activa: *"Mix aprobado (umbral 95.0% con tolerancia
  5.0%) · cobertura 95.5% · exceso 0 CFM"*.
- `pages/calculo-refrigeracion.html` · campo nuevo
  `#mix_tolerancia` en la barra de mix con default **5%** (como
  pidió el director en su prompt). Hint visible *"Umbral mínimo
  aceptado · default 5%"*.
- `assets/js/calculo-refrigeracion.js` · helper `getTolerancia()`
  con clamp [0, 100]. Listener `input` que recalcula el banner +
  sugerencias en vivo cuando el usuario cambia la tolerancia.
  Propagado a las 3 llamadas de `evaluarMixVentiladores` (tabla,
  banner, snapshot del informe) + persistencia (campo
  `tolerancia_pct` en el doc `acciones_refrigeracion`). Banner
  ampliado con KPI nuevo *"Umbral · X CFM (tol Y%)"* visible
  solo cuando hay tolerancia configurada.
- `tests/refrigeracion.test.js` · 4 tests nuevos cubriendo:
  tol=0 default exige ≥100%, tol=5 acepta 96.2% (cobertura aún
  bajo 100% nominal), tol=5 rechaza 90% (déficit calculado
  contra el umbral relajado), clamp de valores fuera de rango
  [-10 → 0 / 999 → 100].
- 519 / 519 tests verdes · HTML lint OK.

**Pendiente del director:** validar visualmente en producción.
Próxima microfase (2): estrategias enriquecidas con VFD + paralelo/
serie + `impacto_estimado_cfm` + `implicaciones` operativas/coste.

### Hotfix · Restaurar protección eléctrica como fallback legacy (2026-05-03 PM4)

El director reportó que la sección **"Circuito de protección
eléctrica y mando"** quedó VACÍA tras el refactor mix multi-modelo.
Cuando él cargaba una ficha técnica desde el dropdown legacy
(`#fan_db_sel`) sin agregar nada al mix, el detalle (guardamotores
con cantidades + PIDs + breaker principal + auxiliares SCADA) ya
no aparecía — solo veía el stub *"Agregue al menos un modelo de
ventilador al mix para calcular la protección eléctrica"*.

**Causa:** `calcProtection()` cortocircuitaba con un stub cuando
`state.mix.length === 0`, eliminando la ruta legacy de cómputo
con un solo modelo + N derivado (`calcularProteccionElectrica`).

**Fix:** `calcProtection()` reescrita con 3 rutas:

1. **Ruta 1 — Mix multi-modelo (≥1):** comportamiento del refactor.
   Renderiza grupos por modelo + breaker principal único + BOM
   agrupado (sin cambios respecto al commit 5).
2. **Ruta 2 — Fallback legacy (mix vacío + dropdown cargado):**
   restaura el comportamiento original v2.9.0 — cálculo con un
   solo modelo del catálogo + N derivado de `cfm_requerido /
   cfm_modelo`. Muestra las 3 cards (corriente por ventilador,
   guardamotor sugerido + setting + PID, contacto auxiliar SCADA)
   y la card "Corriente total del sistema" con breaker principal +
   pérdidas + auxiliar. Lista de materiales con PIDs completos.
   Pie de la sección con nota explícita: *"vista preview con el
   modelo seleccionado · para combinar varios modelos en el mismo
   transformador, agregue cada uno al mix arriba"*.
3. **Ruta 3 — Sin datos:** placeholder INFORMATIVO con tarjetas
   dashed mostrando el catálogo de componentes esperables
   (Guardamotor MS116, Auxiliar HK1-11, Breaker S203, Auxiliar
   S2C-H11L) con sus PIDs y rangos. Reemplaza el stub silencioso.

Cambios:
- `assets/js/calculo-refrigeracion.js` · `calcProtection()`
  reescrita con las 3 rutas. Helpers nuevos:
  `renderProtLegacyPerFan`, `renderProtLegacyTotal`,
  `renderProtLegacyMateriales` (reciclan el código legacy v2.9.0
  que había sido eliminado).
- `CLAUDE.md` · regla permanente nueva **§0.1.2.4** *"Refactor
  1→N NO debe vaciar la UI legacy"* con 5 puntos accionables y
  catálogo de casos típicos. Regla nueva **§0.1.2.5** *"Lint local
  con `npm run lint:html`, no `npx html-validate`"* documentando
  el falso negativo del lint resuelto el mismo día.

JS lint OK · HTML lint OK · 515 / 515 tests verdes.

### Commit 5 · Tab "Consolidado Sistemas de Refrigeración" (2026-05-03)

Nueva pestaña del módulo Mantenimiento Brigada para visualizar
todas las acciones registradas en `acciones_refrigeracion` en
realtime.

- **`pages/mantenimiento-brigada.html`** · segunda tab agregada al
  tablist: `data-tab="consolidado"` con icono Lucide `list-checks`
  → `consolidado-refrigeracion.html` vía iframe lazy-load.
- **`pages/consolidado-refrigeracion.html`** · página dedicada con:
  - Cabecera con título + estado de sincronización + botón
    **"Exportar CSV"**.
  - 5 KPI cards con paleta semáforo: total acciones · aprobadas
    o ejecutadas (verde) · planificadas o pendientes (naranja) ·
    Σ kVA ONAF objetivo · Σ ventiladores totales del parque.
  - Barra de filtros: búsqueda libre (matrícula / proyecto /
    descripción / responsable) · estado · subestación (poblada
    dinámicamente desde la suscripción) · zona · rango de fechas
    (desde / hasta). Botón "Limpiar".
  - Tabla con 15 columnas: fecha, matrícula, proyecto,
    subestación, zona, ONAN, ONAF, mix (resumen "8× ZIEHL FN-063
    + 4× ZIEHL FN-050"), CFM total, cobertura %, OK ✓/✗,
    estado-pill (5 colores), responsable, acción (descripción
    truncada con tooltip al título completo), acciones de fila.
  - Acciones admin-only en cada fila: cambiar estado (prompt) /
    eliminar (confirm).
  - Banner de error visible si las rules o índices no están
    desplegados (mensaje incluye comando exacto a ejecutar).
- **`assets/js/consolidado-refrigeracion.js`** · UI binding:
  - `suscribir()` del data layer al primer paint sin filtros
    server-side (filtros se aplican cliente para no requerir
    índices adicionales por combinación).
  - Filtros cliente reactivos (input + change events).
  - KPIs recalculados en cada cambio de filtro.
  - Export CSV con BOM UTF-8 + 28 columnas planas (campos del
    payload + agregados de `evaluacion`/`proteccion`).
  - Detección de admin via `window.__sgmSession.profile.rol`.
  - Cleanup de la suscripción en `beforeunload`.
- Estilos inline en la página (paleta consistente con el resto
  del módulo): KPIs glass + tabla con sticky header + estado-pills
  por estado_accion + aprobado-pills verde/rojo.

JS lint OK · HTML lint OK · 501/503 tests verdes.

⚠ La pestaña requiere los deploys del commit 4 (rules + indexes
para `acciones_refrigeracion`). Sin ellos los queries fallarán con
`permission-denied` y/o `FAILED_PRECONDITION` con mensaje claro
en el banner de error.

### Commit 4 · Persistencia · acciones_refrigeracion + botón "Registrar acción" (2026-05-03)

Persistencia en Firestore de las acciones de mantenimiento del
sistema de refrigeración. Cada acción es un snapshot completo del
cálculo (mix, evaluación, protección, BOM, compatibilidad) + datos
del responsable + estado del workflow.

- **Nueva colección Firestore `acciones_refrigeracion/{id}`** con
  ID autogenerado. Schema:
  - Identificación: `transformador_id`, `matricula`, `proyecto`,
    `subestacion`, `zona`, `departamento`, `grupo`, `serie`,
    `refrigeracion`.
  - Parámetros del cálculo: `kva_onan`, `kva_onaf`, `pct`,
    `altitud`, `cfm_requerido`, `cfm_corregido`.
  - Snapshot: `mix[]` (lista de items con marca/modelo/cantidad/
    cfm_unitario + ficha técnica completa), `evaluacion`,
    `proteccion`, `compatibilidad`.
  - Workflow: `accion_descripcion`, `estado_accion` ∈
    {planificada, pendiente_aprobacion, aprobada, ejecutada,
    cancelada}, `fecha_accion`, `fecha_ejecucion`, `observaciones`.
  - Responsable: `responsable_uid`, `responsable_nombre`,
    `responsable_email` (extraídos de `window.__sgmSession`).
  - Auditoría: `createdAt`, `updatedAt`, `createdBy`.
- **`firestore.rules`** · `match /acciones_refrigeracion/{id}`:
  - `read: isTeamMember()`.
  - `create: isAdmin()` con validación server-side: tipo `string`
    no vacío de `transformador_id` y `matricula`, `accion_descripcion`
    de mínimo 10 caracteres, `estado_accion` en enum,
    `mix is list && mix.size() >= 1`, `fecha_accion` no vacío.
  - `update: isAdmin()` con validación de enum + congelación de
    `transformador_id` (no se puede cambiar el activo asociado).
  - `delete: isAdmin()`.
- **`firestore.indexes.json`** · 4 índices compuestos nuevos:
  - `transformador_id ASC + fecha_accion DESC` (histórico por activo).
  - `estado_accion ASC + fecha_accion DESC` (filtrar por estado).
  - `subestacion ASC + fecha_accion DESC` (filtro geográfico).
  - `responsable_uid ASC + fecha_accion DESC` (mis acciones).
- **`assets/js/data/acciones_refrigeracion.js`** · data layer
  completo: `crear`, `listar`, `suscribir`, `obtener`,
  `actualizar`, `actualizarEstado`, `eliminar`, `validar`,
  constante `ESTADOS_ACCION`, helper `labelEstado`. Sanitización
  + validación cliente antes de pegarle a las rules.
- **UI** · `pages/calculo-refrigeracion.html`:
  - Botón nuevo **"Registrar acción de mantenimiento"**
    (`#btnRegistrarAccion`) en la barra de exportar (color verde
    AFINIA, junto al "Exportar informe AFINIA").
  - Modal `#modalAccion` con cabecera + cuerpo + pie. Cuerpo:
    aviso explicativo, resumen del cálculo (matrícula, subestación,
    mix, cobertura, estado APROBADO/NO), formulario con
    descripción (textarea required minlength 10), estado (select),
    fecha de la acción (date required), fecha de ejecución (date
    opcional), observaciones (textarea), área de status para
    feedback. Pie: cancelar + guardar.
- **`assets/js/calculo-refrigeracion.js`** · funciones nuevas:
  `openModalAccion`, `closeModalAccion`, `guardarAccion`. Lazy
  import de `data/acciones_refrigeracion.js` solo al guardar.
  Captura del usuario logueado vía `window.__sgmSession`. Cierra
  el modal con backdrop + botón ✕ + tecla Escape. Status visual
  con tres estados (info/error/success) y auto-cierre al éxito.
- **`assets/css/calculo-refrigeracion.css`** · sistema de modales
  reutilizable `.sgm-modal` + variantes (`.sgm-modal-card`,
  `.sgm-modal-head`, `.sgm-modal-body`, `.sgm-modal-foot`,
  `.sgm-modal-summary`, `.sgm-modal-status` con 3 estados,
  `.sgm-modal-meta`, `.sgm-modal-x`).

⚠ **Requiere deploy manual** (regla CLAUDE.md §0.1.1):

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Sin esos deploys los queries van a fallar con `permission-denied`
(rules) y `FAILED_PRECONDITION` (indexes) hasta que el director los
ejecute desde su Mac.

JS/HTML lint OK · 501/503 tests verdes (los 2 fallos pre-existentes
son de importador Excel sin relación con este trabajo).

### Commit 3 · Informe AFINIA · refleja mix multi-modelo (2026-05-03)

Refactor del generador de informe técnico AFINIA
(`generateReport()` en `assets/js/calculo-refrigeracion.js`) para
que la salida HTML imprimible refleje el mix multi-modelo en lugar
del modelo único legacy.

- **Sección 5 · Datos de los motoventiladores** — se vuelve plural.
  Una sub-sección 5.N por cada modelo del mix (ej.: 5.1 ZIEHL FN-050,
  5.2 ZIEHL FN-063, 5.3 KRENZ F20). Cada una con:
  - Cabecera con marca + modelo + cantidad ("8 unidades").
  - Aporte de CFM al mix (`cantidad × cfm_unitario`).
  - Ficha completa de identificación + aerodinámica (12 campos).
  - Sub-sección 5.N.1 con motor eléctrico (12 campos) + cantidad
    × kW del grupo + peso del grupo agregado.
- **Sección 8 · Selección de motoventiladores** — pasa de "tabla
  comparativa de opciones" a **tabla del mix con totales y estado**:
  - Columnas: # · Marca · Modelo · CFM/u · Cantidad · Aporte CFM ·
    Aporte %.
  - Pie con totales (Σ unidades, Σ CFM, 100%).
  - Banner de estado APROBADO ✓ verde / NO APROBADO ✗ rojo con
    cobertura % + déficit/exceso CFM + n total.
  - Si NO aprobado: sub-sección "Sugerencias para alcanzar el CFM
    requerido" con tabla de hasta 3 estrategias del motor
    `sugerirMejoras` (agregar_unidades / sustituir / agregar_modelo)
    + descripción + CFM resultante + cobertura + exceso.
  - Fórmula del mix sustituida con valores reales:
    `CFM_mix = Σ (Cantidad_i × CFM_unitario_i)` con expansión.
- **Sección 9 · Protección eléctrica** — refleja agrupación:
  - Tabla con una fila por grupo (modelo del mix) + columnas
    "A/unidad", "A grupo", guardamotor sugerido, PID + setting.
  - Pie con totales del sistema (Σ corriente, breaker principal
    único S203 dimensionado a la corriente total).
  - Tabla de KPIs adicionales: corriente total, corriente mínima
    breaker, kW total absorbido (Σ por grupo), kVA aparente
    (Σ P_grupo / cosφ_grupo), peso total, auxiliar breaker.
  - Fórmulas eléctricas adaptadas:
    - `I_total = Σ (Cantidad_i × I_unitario_i)` con expansión.
    - `I_min,breaker = 1.25 × I_total` (NEC 430).
    - `P_total`, `S_total = Σ (P_i / cosφ_i)`, `W_total`.
- **Sección 10 · Lista de materiales** — BOM agrupado:
  - Por cada grupo del mix: línea de motoventiladores (cantidad +
    PID + diámetro + CFM + Hz + corriente del grupo) + línea de
    guardamotores (cantidad para ese modelo + setting + rango) +
    línea de auxiliares SCADA del guardamotor.
  - Línea única de breaker principal del sistema completo
    (1 unidad cubre toda la corriente del mix).
  - Línea de auxiliar SCADA del breaker.
- El alias `state.fans` derivado del mix queda como código
  defensivo sin lectores activos en producción (tanto la UI como
  el informe son nativos al mix).

`assets/js/calculo-refrigeracion.js` · 175 LOC modificadas en el
generador de informe. JS lint OK · 501/503 tests verdes.

### Commit 2 · UI · selector agregar-al-mix + tabla + estado APROBADO/NO + sugerencias (2026-05-03)

- `pages/calculo-refrigeracion.html` · sección "Calculador de
  motoventiladores" reemplazada por **"Mix de motoventiladores"**:
  - Nueva barra superior con selector `#mix_fan_sel` (catálogo
    completo: 13 modelos ZIEHL-ABEGG + KRENZ), input de cantidad
    `#mix_fan_qty` y botón **"+ Agregar al mix"** (`#btnAddToMix`).
  - Nueva tabla `#mix-table` con columnas: # · Marca · Modelo ·
    CFM/u · Cantidad (input editable inline) · Aporte CFM · Aporte %
    · Eliminar. Pie de tabla con totales.
  - Nuevo banner `#mix-status` con badge **APROBADO ✓ / NO APROBADO ✗ /
    SIN DATOS** + cobertura % + déficit/exceso + n total.
  - Nuevo panel `#mix-suggestions` (visible solo si NO aprobado)
    con 3 cards (una por estrategia: agregar_unidades, sustituir,
    agregar_modelo) + botón "Aplicar sugerencia" en cada una.
  - El selector legacy `#fan_db_sel` (dentro de "Datos técnicos del
    motoventilador") se conserva como preview de ficha técnica sin
    agregar al mix.
- `assets/css/calculo-refrigeracion.css` · estilos nuevos `.mix-status`
  (3 estados con paleta semáforo verde/rojo/gris), `.mix-suggestions`
  con grid responsive de cards, `.btn-rm-mix`, `input.mix-qty`.
- `assets/js/calculo-refrigeracion.js` · refactor profundo del estado
  y handlers:
  - `state.mix` reemplaza `state.fans` (legacy). Cada item:
    `{id, key, marca, modelo, cfm_unitario, cantidad, ficha}`. La
    `ficha` es snapshot inmutable (Object.freeze) del catálogo al
    momento de agregar — protege contra mutaciones del catálogo.
  - Funciones nuevas: `addToMix`, `removeFromMix`, `updateMixQty`,
    `applyMixSuggestion`, `renderMix`, `renderMixStatus`,
    `renderMixSuggestions`, `syncFichaVisibleConKey`.
  - `calcProtection()` reescrito para usar `calcularProteccionMix`
    del dominio puro. Renderiza grupos por modelo (cada uno con
    su guardamotor MS116) + breaker principal único S203 +
    auxiliares SCADA + KPIs agregados (kW totales, peso total).
  - `onFanSelect()` simplificado: ya no muta `state.fans[0]` —
    solo sincroniza la ficha visible con el modelo seleccionado.
  - Funciones legacy eliminadas: `renderFans`, `addFan`, `removeFan`,
    `updateCells`, `updateSum`, `calcFan`, `renderPerFanCard`,
    `renderTotalCard`, `renderListaMateriales` (~120 LOC).
  - Alias `state.fans` derivado del mix mantenido para que
    `generateReport()` siga funcionando hasta el commit 3 (informe
    AFINIA con mix nativo).
- `bindEvents()` actualizado: `btnAddFan` removido (era opción legacy
  manual); listeners para `mix-tbody` (input qty + click eliminar)
  y `mix-suggestions` (click "Aplicar sugerencia").
- HTML lint limpio · 501/503 tests verdes (los 2 fallos son
  pre-existentes de importador Excel · sin relación con este trabajo).

### Commit 1 · Dominio puro (2026-05-03)

- `assets/js/domain/refrigeracion.js` · 3 funciones puras nuevas:
  - `evaluarMixVentiladores({items, cfm_requerido})` — suma los
    aportes de cada modelo (cantidad × CFM unitario), calcula
    cobertura, déficit, exceso, número total de unidades y emite
    estado **APROBADO / NO_APROBADO / SIN_DATOS** con mensaje
    humanizado.
  - `sugerirMejoras({items, cfm_requerido, fan_db, max_sugerencias})`
    — motor de sugerencias activo cuando el mix no aprueba. Tres
    estrategias: (1) **agregar_unidades** del modelo más eficiente
    ya en el mix; (2) **sustituir** el modelo más débil del mix
    por otro mayor del catálogo; (3) **agregar_modelo** del catálogo
    que no esté en el mix. Cada sugerencia incluye los cambios
    estructurados, CFM total resultante, cobertura y exceso.
    Ordenadas por menor exceso (ajuste más fino primero).
  - `calcularProteccionMix({items, factor_seguridad})` — protección
    eléctrica para mix heterogéneo: cada modelo con su propio
    guardamotor MS116 dimensionado a la corriente unitaria del
    grupo, y **un único breaker principal** S203 dimensionado a
    la corriente total del sistema con factor de seguridad NEC 430
    ×1.25. Devuelve también totales de potencia (kW) y peso (kg)
    agregados por grupo.
- Constante exportada `MIX_ESTADO` con los 3 estados.
- `tests/refrigeracion.test.js` · 18 tests nuevos (44 → 62 totales)
  cubriendo: estado SIN_DATOS por mix vacío o requerido cero, suma
  correcta de aportes con n unidades total, no_aprobado con déficit
  exacto, aporte_pct por modelo, clamp de cantidades negativas,
  vacío de sugerencias cuando ya cubre, las 3 estrategias del motor
  de sugerencias con casos de control, ordenamiento por exceso,
  respeto de `max_sugerencias`, agrupación por modelo en protección
  eléctrica, totales kW/peso, factor de seguridad personalizado,
  filtrado de items con cantidad o amperaje no positivos.
- 501 / 503 tests verdes (los 2 fallos pre-existentes son de
  importador Excel · sin relación con este trabajo).

## v2.9.0 — Mantenimiento Brigada · Selección ONAF (2026-05-02)

Nuevo módulo top-level **"Mantenimiento Brigada"** en el sidebar
(grupo Operación, entre Órdenes y Contratos · icono Lucide
`hard-hat`). Primera herramienta entregada: **calculadora de
selección de sistema de refrigeración (ONAN → ONAF)** conforme
IEEE C57.12.00-2015 · ANSI C57.12.91 · IEEE C57.91-2011 ·
Westinghouse T&D Reference. Migración del archivo legacy
monolítico `Calculo de Sistemas de refriegracion.html` (1917
líneas inline) a la arquitectura canónica del proyecto: dominio
puro / data layer / UI binding · 4 microfases con commits
aislados.

### Arquitectura

- `pages/mantenimiento-brigada.html` · módulo padre `module-shell`
  con tablist + iframe lazy-load (mismo patrón que `Activos`,
  `Salud`, `Análisis`). 1 pestaña inicial "Sistema de Refrigeración",
  future-proof para sumar más calculadoras de brigada sin tocar el
  sidebar.
- `pages/calculo-refrigeracion.html` · página hija con los 84 IDs
  originales del archivo legacy preservados sin renombrar.
- `assets/js/domain/refrigeracion.js` (552 LOC) · funciones puras
  testables sin DOM: interpolación Westinghouse, conversión de
  caudal a CFM (5 unidades), corrección ISA por altitud, núcleo
  de cálculo, N=⌈total/fan⌉, evaluación de compatibilidad mecánica
  (4 criterios C1-C4), parser de corriente "1.60 / 0.92 A (D/Y)",
  selección guardamotor MS116 + breaker S203 con factor seguridad
  NEC 430 ×1.25, heurística de auto-rango del gráfico.
- `assets/js/data/refrigeracion-transformadores-afinia.js` · 206
  transformadores AFINIA con matrícula, serie, potencia, grupo,
  subestación, zona, departamento, refrigeración.
- `assets/js/data/refrigeracion-fan-db.js` · 13 fichas técnicas de
  motoventiladores (ZIEHL-ABEGG ZN045/FN050/FN063/ZN063 + KRENZ F20).
- `assets/js/calculo-refrigeracion.js` · UI binding + Chart.js +
  generador de informe. Carga lazy de los catálogos pesados.
- `tests/refrigeracion.test.js` · 44 tests cubriendo la verificación
  golden 24 MVA × 125 % = 48.000 CFM (calibración AFINIA original)
  + las 16 funciones del dominio.

### Calibración Westinghouse congelada (Object.freeze)

```
115% → 1.20 CFM/kVA
125% → 2.00 CFM/kVA
133% → 2.65 CFM/kVA
166% → 4.25 CFM/kVA
```

Cualquier modificación accidental lanza `TypeError`. Verificación
del modelo: 24 MVA × 125 % = 48.000 CFM (caso de control oficial).

### Maquetación Aqua Liquid Glass

`assets/css/calculo-refrigeracion.css` (~720 LOC) deriva 100 % de
los tokens AQUA del proyecto (`aqua-tokens.css` · `aqua-components.css`).
Cero color hard-coded. Adaptación del rediseño dark del bundle de
Claude Design al sistema light-perla del proyecto:

- 5 KPIs en grid con borde lateral coloreado (3px) + glow
- 4 secciones mecánicas con header gradient diagonal (steel /
  teal / purple / indigo)
- Diagrama A/B/C/D con dots A=rojo · B=verde · C=rojo · D=cian
  + glow shadow
- 4 cards de compatibilidad con estados ok/warn/err/nd
- Tabla de fans con estados visuales y botón "+" dashed
- Calculador con header brand-deep + chip de fórmula

### Gráfico Chart.js · 4 curvas Westinghouse

Plugin custom `sgmCurveLabels` que dibuja:
- Etiquetas SOBRE las curvas con ángulo calculado (115/125/133/166% OA RATING)
- Etiqueta de la curva interpolada con sufijo "◀" cuando difiere
- **Cruceta roja**: líneas dashed desde ambos ejes hasta el punto
  de operación + puntos rojos en intersecciones + etiquetas
  X.X MVA y XX.XXX CFM sobre los ejes (lectura visual directa
  para validación del cálculo, fiel al original)
- Leyenda en posición **inferior** (no superior · paridad fiel
  con el original Westinghouse)
- Tooltip con conversión kVA → MVA en tiempo real

### Generador de informe técnico AFINIA

`generateReport()` construye un documento HTML imprimible
conforme al `Formato Afinia.docx` oficial extraído del repo:

- Hoja Letter portrait (8.5″ × 11″)
- **Header logo afinia · Grupo·epm** (1273×282 PNG) y **footer
  banda azul curva www.afinia.com.co + dirección "CaribeMar de
  la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio
  Chambacú – Piso 1 / Cartagena."** repetidos en CADA hoja
  impresa vía técnica `<table>` + `<thead>` con
  `display: table-header-group` + `<tfoot>` con
  `display: table-footer-group` (gold standard cross-navegador
  · funciona en Chrome, Firefox, Safari, Edge sin excepciones).

10 secciones del informe:

1. Identificación del transformador (8 campos)
2. Parámetros del cálculo + 5 KPIs
3. Curvas Westinghouse · gráfico íntegro embebido como base64
   PNG (sin riesgo de corte) + 3 fórmulas aplicadas con valores
   reales (pendiente interpolada · CFM₀ = m × kVA · F_alt)
4. Datos mecánicos del radiador con **diagrama SVG inline**
   (vista frontal + perspectiva isométrica con cotas A/B/C/D
   codificadas por color) + 8 campos de medidas
5. Motoventilador · 12 campos aerodinámica + 12 motor eléctrico
6. Montaje sobre radiador (8 campos)
7. Análisis de compatibilidad mecánica (4 cards C1-C4 con
   estados pill ok/warn/err/nd + diagnóstico textual + conclusión)
8. Selección de motoventiladores · **fórmula N = ⌈ … ⌉ aplicada**
   con valores reales + tabla con todas las opciones + recomendación
   destacada
9. Protección eléctrica · **5 fórmulas aplicadas** (I_total =
   N × I, I_min = 1.25 × I_total NEC 430, P_total = N × P₁,
   S_total = P/cos φ) + tabla con MS116 / S203 / auxiliares +
   TODOS los totales del sistema
10. Lista de materiales (BOM) con # · Cantidad · Componente ·
    PID · Especificación · lista para emisión de OC

### Datalist en "Nombre del proyecto"

Dos opciones predefinidas (admite texto libre):
- "Actualización y Repotenciación del Sistema de Refrigeración"
- "Sistema de Refrigeración URE"

### Reglas de paginación bulletproof

Sin saltos `page-break-after: always` forzados (causaban hojas
en blanco). Cada bloque atómico (gráfico, KPI grid, tabla,
formula-box, rad-diagram) lleva `break-inside: avoid` +
`page-break-inside: avoid`. Cada h2 envuelto en
`<section class="section-anchor">` con `break-inside: avoid`
para que nunca quede como "viuda" al pie de página sin su
contenido. `widows: 4 / orphans: 4` en párrafos.

### Animaciones y micro-interacciones

- KPI count-up con easeOutCubic 480 ms cuando el valor cambia
- Hover lift en `.calc-section` y `.kpi` con shimmer animado
  sobre la barra accent
- Reveal por scroll vía IntersectionObserver
- Validación reactiva con shake animation + mensajes inline
  cuando un input está fuera de su rango min/max
- Manejo defensivo si Chart.js no carga del CDN (reintento +
  mensaje al usuario)
- Todo respeta `prefers-reduced-motion`

### Memorizado en CLAUDE.md

3 nuevas reglas permanentes:
- §0.1.2.1 — Migrar archivos legacy SIN perder detalles visuales
  (cruceta roja, posición leyenda, etiquetas de eje, etc.)
- §0.1.2.2 — Generación de informes imprimibles (PDF/print) ·
  13 reglas + checklist de cierre · plantilla del cliente como
  fuente de verdad · header/footer SIEMPRE vía thead/tfoot
  (NO position:fixed) · fórmulas con sustitución numérica · BOM
  obligatorio · diagrama del componente cuando exista en el
  original

### Tests

497 / 497 verdes (453 base + 44 nuevos del módulo refrigeración).
html-validate limpio.

### Commits

10 commits aislados del módulo brigada desde `4323ac4` (F1 ·
skeleton + sidebar). El fix definitivo del header/footer
cross-navegador quedó consolidado en main como `b4606cd`
(PR #128 · "informe AFINIA · header/footer SE REPITEN en cada
hoja"), reemplazando una iteración anterior `2ee9a9c` que
implementaba el mismo patrón thead/tfoot con CSS algo distinto.

### Nuevos archivos

- `pages/mantenimiento-brigada.html`
- `pages/calculo-refrigeracion.html`
- `assets/js/mantenimiento-brigada-shell.js`
- `assets/js/calculo-refrigeracion.js`
- `assets/js/domain/refrigeracion.js`
- `assets/js/data/refrigeracion-transformadores-afinia.js`
- `assets/js/data/refrigeracion-fan-db.js`
- `assets/css/calculo-refrigeracion.css`
- `assets/img/afinia/header.png`
- `assets/img/afinia/footer.png`
- `tests/refrigeracion.test.js`
- `docs/MANTENIMIENTO-BRIGADA.md` (esta documentación)

### Modificados

- `assets/js/aqua-shell.js` (+1 línea entrada sidebar)
- `CLAUDE.md` (§0.1.2.1, §0.1.2.2 nuevas)

---

## v2.8.1 — Hotfix admin upload · defaults codigo+estado en /contratos/{cid} (2026-05-01)

Bug reportado por el director justo después del lanzamiento v2.8.0.
Al usar el botón **"+ Agregar documento"** desde
`pages/contrato-info.html?id=…&tipo=remisiones` (o cualquier otro
`tipo`), el upload llegaba al **100 % en Firebase Storage** y al
final caía con `Missing or insufficient permissions`. Reproducible
en cualquier contrato cuyo doc Firestore `/contratos/{cid}` no fue
dado de alta previamente con los campos canónicos.

### Causa raíz

`firestore.rules:418-430` restringe `/contratos/{id}`:

```javascript
allow create: if isAdmin()
              && request.resource.data.codigo is string
              && request.resource.data.codigo.size() > 0
              && request.resource.data.estado in
                 ['vigente','suspendido','finalizado','en_liquidacion'];
allow update: if isAdmin()
              && request.resource.data.estado in
                 ['vigente','suspendido','finalizado','en_liquidacion'];
```

`subirDocumento` y `eliminarDocumento` hacían:

```javascript
await setDoc(docRef, {
  [campo]: arr,
  [campoUpdatedAt]: serverTimestamp()
}, { merge: true });
```

Con `merge: true`, el `request.resource.data` que evalúan las rules
es el merged-post-state. Casos:

- Doc no existe → CREATE → falta `codigo` y `estado` → ❌
- Doc existe pero sin `estado` válido → UPDATE → `estado` post-merge
  queda `undefined`, `estado in [...]` falla → ❌

`4123000081` sí funcionaba porque su `/contratos/4123000081` tiene
`estado: 'vigente'` en Firestore. `4125000143` (más reciente, sin
"Información Contractual" cargada antes) no tenía el doc poblado.

### Fix aplicado

Helper interno `_conDefaultsContrato(payload, cid, dataExistente)`
en `assets/js/data/documentos_contractuales.js` que **respeta los
valores existentes** (no pisa un `estado='suspendido'` legítimo)
y solo agrega defaults cuando faltan o son inválidos:

```javascript
function _conDefaultsContrato(payload, cid, dataExistente) {
  const out = { ...payload };
  if (!dataExistente.codigo) out.codigo = String(cid);
  const ESTADOS_VALIDOS = ['vigente', 'suspendido', 'finalizado', 'en_liquidacion'];
  if (!ESTADOS_VALIDOS.includes(dataExistente.estado)) out.estado = 'vigente';
  return out;
}
```

Aplicado en ambas operaciones de write a `/contratos/{cid}`
(`subirDocumento` línea 279 y `eliminarDocumento` línea 342).

### Verificación

- ✅ Las 7 remisiones (`REMISION 1.pdf`–`REMISION 7.pdf`) del contrato
  `4123000081` cargadas exitosamente vía el botón **"+ Agregar
  documento"** del admin. Visor PDF embebido renderiza correctamente.
  Categorización automática como "Remisiones".
- ✅ Información Contractual de `4123000081` sigue funcionando (no
  hay regresión — `estado: 'vigente'` ya estaba en el doc, el helper
  no toca nada).
- ✅ El flujo cubre los 3 canales documentales: `''` (Información
  Contractual), `'remisiones'`, `'reuniones-seguimiento'`.

### Sin deploy de Firebase

Fix 100 % en data layer JavaScript. **No requiere** `firebase
deploy --only firestore:rules` ni storage. GitHub Pages reconstruye
automáticamente desde `main` tras merge.

### Commit / PR

- Commit: `e43aa42`
- PR: [#119](https://github.com/ajimenezp99-jpg/LordPowerTransformersMJ.github.io/pull/119)
- Merge a main: `8e1aa10`

### Nota operativa

En el commit `91f386c` el director subió por error los 7 archivos
`REMISION X.pdf` al raíz del repo via GitHub web. No afecta el
flujo (los PDFs reales viven en Firebase Storage tras el upload
admin), pero quedaron como peso muerto. Cleanup pendiente en una
versión futura.

## v2.8.0 — Seguimiento Contractual · Remisiones + Reuniones de Seguimiento (2026-05-01)

Bajo cada contrato (4123000081 y 4125000143) se agrega un nuevo
sub-árbol **Seguimiento Contractual** en el sidebar — sibling de
"Control y Gestión Operativa" e "Información Contractual" — que
expande a dos secciones documentales:

- **Remisiones**
- **Reuniones de Seguimiento**

Ambas reutilizan exactamente el mismo visor PDF embebido y el flujo
admin de upload/delete que ya existía para Información Contractual
(v2.7.0). Estructura final del sidebar:

```
Contratos ▾
  Suministro de Elementos y Accesorios… ▾
    4123000081 ▾
      Control y Gestión Operativa
      Información Contractual
      Seguimiento Contractual ▾
        Remisiones                    → ?id=…&tipo=remisiones
        Reuniones de Seguimiento      → ?id=…&tipo=reuniones-seguimiento
    4125000143 ▾  (espejo)
```

### Cambios técnicos

**Data layer · `assets/js/data/documentos_contractuales.js`** —
generalizado para multi-tipo. Helpers internos `_segmento(tipo)`,
`_campoFirestore(tipo)`, `_campoUpdatedAt(tipo)` resuelven path/campo
según tipo:

| `tipo`                    | Storage path                                       | Campo Firestore                       |
|---------------------------|----------------------------------------------------|---------------------------------------|
| `''` (default)            | `contratos/{cid}/{slug}.pdf`                       | `documentos_contractuales[]`          |
| `'remisiones'`            | `contratos/{cid}/remisiones/{slug}.pdf`            | `documentos_remisiones[]`             |
| `'reuniones-seguimiento'` | `contratos/{cid}/reuniones-seguimiento/{slug}.pdf` | `documentos_reuniones_seguimiento[]`  |

Funciones públicas (`listarDocumentos`, `urlDocumento`, `subirDocumento`,
`eliminarDocumento`) reciben parámetro opcional `tipo`. Backwards-compat
total: cualquier llamada existente sin `tipo` sigue resolviendo al
flujo Información Contractual original.

Categorías agregadas a `CATEGORIAS_DOC`:
- `remision` (icono Lucide `truck`)
- `acta` (icono Lucide `users`)

**Página · `assets/js/contrato-info.js`** — lee `?tipo=` del query y
aplica un map `META_TIPO` para breadcrumb / título / subtítulo /
empty-state. Pasa `tipoDoc` a las 3 calls del data layer
(`listarDocumentos`, `subirDocumento`, `eliminarDocumento`). Una sola
página HTML sirve a las 3 secciones documentales.

**HTML · `pages/contrato-info.html`** — breadcrumb (`#bcSeccion`) y
título (`#pageTitleLead` / `#pageTitleEm`) ahora son spans dinámicos.
Select de categoría del modal upload incluye opciones `remision` y
`acta`.

**Sidebar · `assets/js/aqua-shell.js`** — inyecta 2 sub-árboles nuevos
(`seguimiento-{cid}`) bajo cada contrato, cada uno con sus 2 leaves
nivel 5 (`sb-item-leaf`). `markActive()` ahora también compara `?tipo=`
para desambiguar items con el mismo pathname + id (Información
Contractual vs Remisiones vs Reuniones comparten
`contrato-info.html?id=N` y se diferencian solo por `?tipo=`).

### Storage rules — sin deploy

La regla wildcard de v2.6.0 ya cubre los nuevos sub-paths:

```javascript
match /contratos/{contratoId}/{filename=**} { ... }
```

El `{filename=**}` (recursive wildcard) matchea
`contratos/4123000081/remisiones/foo.pdf` sin cambios. **No requiere
`firebase deploy --only storage`** para esta versión.

### Verificación

- 453/453 tests verdes (sin tests nuevos — la generalización es
  estructural, no agrega lógica de dominio)
- Lint HTML limpio
- Manual: `/pages/contrato-info.html?id=4123000081&tipo=remisiones`
  pinta breadcrumb "Seguimiento / Remisiones", título "Seguimiento
  Remisiones", lista vacía hasta primer upload (Firestore-only,
  sin manifest local de respaldo)

## v2.7.1 — Hotfix Movimiento · docId compuesto en suministroRef (2026-04-27 PM5)

Bug crítico reportado por el director: el módulo Movimiento dentro
del Control y Gestión Operativa del contrato 4125000143 fallaba al
intentar guardar (síntoma sutil: el lookup del suministro retornaba
"Suministro X no existe", el formulario aceptaba la entrada pero el
submit fallaba).

### Causa raíz

Tras la migración multi-contrato N5, los suministros se guardan con
**docId compuesto** `{contrato_id}_{codigo}` (ej. `4125000143_S01`)
para aislar contratos. Pero el data layer de movimientos
(`assets/js/data/movimientos.js#suministroRef`) y el de marcas
(`assets/js/data/marcas.js#suministroRef`) seguían accediendo a
`/suministros/{sid}` directo con solo el código plano "S01".

Resultado: el `tx.get(suministroRef('S01'))` dentro de la tx atómica
de `crearMovimiento` retornaba `exists() === false` para todos los
suministros del contrato 4125000143 (que tienen docId compuesto),
lanzando "Suministro S01 no existe". El contrato legacy 4123000081
seguía funcionando porque sus docs se importaron antes de N5 y
usan codigo plano como docId.

### Fix aplicado

1. `data/movimientos.js#suministroRef(sid, contratoId='')` ahora
   compone el docId con `composeDocId(cid, codigo)` cuando se pasa
   `contratoId`. Sin él, fallback al codigo plano (compat 4123).
2. `data/movimientos.js#crear` lee `sane.contrato_id` del payload
   sanitizado y lo pasa a `suministroRef`. También filtra el
   query de movimientos por `contrato_id` cuando aplica para que
   dos contratos con el mismo S01 no mezclen su stock en el
   cálculo agregado.
3. `data/movimientos.js#computarStock(suministroId, contratoId)`
   acepta `contratoId` opcional. El controller del formulario lo
   pasa desde `getContratoActivo()` o desde el `contrato_id` del
   suministro encontrado en cache.
4. `admin/admin-suministros-movimiento.js#aplicarSuministro` pasa
   el `contratoId` activo a `computarStock`.
5. **Mismo fix preventivo en `data/marcas.js`**: las funciones
   `crear/actualizar/eliminar` que sync-ean `marcas_disponibles[]`
   en el suministro también componían mal el docId. Ahora todas
   las llamadas pasan `contrato_id` del payload o del prev.

### Regla operativa permanente

Documentada en `CLAUDE.md` §0.1.3 (nueva) — para que ninguna sesión
futura introduzca código que acceda a `/suministros/{X}` directo
sin pasar por `composeDocId` y se rompa el módulo Movimiento (o
cualquier otro consumer de `/suministros`) en silencio para los
contratos N5.

Tests 453/453 verde · Lint HTML limpio.

## v2.7.0 — Sidebar contratos como toggle puro + admin upload de PDFs (2026-04-27 PM4)

Microcirugía adicional al módulo Contratos según lineamientos del
director. Documentación en `docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`
sección 'v2.7.0 follow-up'. 4 fases atómicas (A, B, C, D).

### Resumen ejecutivo

- **Número de contrato deja de ser link**: 4123000081 / 4125000143
  pasan de `<a href>` a `<button class="sb-item-toggle">`. Click solo
  expande/colapsa el árbol; la navegación al dashboard del contrato
  sale exclusivamente por el sub-item "Control y Gestión Operativa".
  Misma filosofía aplicada antes a la categoría "Suministro de
  Elementos…" — consistencia total.
- **UI admin para gestionar PDFs contractuales**: botón
  "+ Agregar documento" en la cabecera de la lista (visible solo a
  admin) + hover-action de eliminar en cada doc. Modales con form
  glass material y barra de progreso resumable.
- **Wire a Firebase Storage + Firestore**: upload via
  `uploadBytesResumable` con onProgress 0-100, idempotente por slug
  (re-subir el mismo título sobreescribe). Delete con `deleteObject`
  + filter del array Firestore. Manejo de errores con pista de
  deploy de storage rules cuando aplica.

### Micro-fases (4 commits)

- **Fase A** — `76f7b88` fix(sidebar): número de contrato es
  `<button>` toggle, no link. CSS reutilizado de
  `.sb-item-toggle` (sin nuevas reglas).
- **Fase B** — `3f7963e` feat(contrato-info): UI admin de
  upload/eliminar (HTML + CSS). Modales glass material con
  campos título / categoría / archivo. Botón delete absoluto en
  hover sobre cada doc.
- **Fase C** — `450f2f9` feat(contrato-info): wire a Firebase
  Storage + Firestore. Nuevas funciones `subirDocumento`,
  `eliminarDocumento`, `slugFromTitle` en el data layer.
  Detección de admin via `window.__sgmSession.role` con fallback a
  evento `sgm:session-ready`.
- **Fase D** — Esta documentación.

### Decisiones técnicas

1. **`<button>` para nodos solo-toggle** (consistencia con la
   categoría). Cuando un nodo de árbol no debe navegar, es siempre
   `<button>` para semántica correcta y reset uniforme via CSS
   `.sb-item-toggle`.
2. **`uploadBytesResumable` en lugar de `uploadBytes` simple** — da
   onProgress y permite que el director vea %  durante el upload de
   PDFs grandes (algunos pesan 11 MB).
3. **Idempotencia por slug**: si el director sube un doc con título
   que ya existe (mismo slug), el archivo en Storage se sobreescribe
   y el array Firestore filtra el duplicado antes de hacer push.
   Re-ejecutar es seguro.
4. **Delete tolerante a 404 en Storage**: si el objeto ya no existe
   en Storage (alguien lo borró por consola o nunca se subió), el
   filter del array Firestore se ejecuta igual para limpieza.
5. **Wrapper div** (`.cloud-doc-wrap`) para evitar `<button>` dentro
   de `<button>` (HTML5 inválido). El delete absoluto se posiciona
   sobre el wrap, hover-detection en el wrap.
6. **Manejo de errores con pista de deploy**: si el upload/delete
   recibe `permission-denied`, el mensaje incluye sugerencia de
   ejecutar `firebase deploy --only storage` (referencia a la
   regla §0.1.1 de CLAUDE.md sobre protocolo de deploys).

### Pendientes post-v2.7.0

- **Deploy de storage rules** (si no se hizo en v2.6.0):
  ```
  firebase deploy --only storage
  ```
- **Verificar rol admin del director** está activo en Firestore
  `/admins/{uid}` o `/usuarios/{uid}` con `rol=admin`.
- **Probar upload + delete en producción** después del merge.

## v2.6.1 — Hotfixes Información Contractual · URL absoluta + scroll iframe (2026-04-27 PM3.5)

Dos bug fixes inmediatos al cierre de v2.6.0 reportados por el director
durante la verificación visual de la página `pages/contrato-info.html`.

### Bugs corregidos

**Bug 1 — `0bd2122` URL absoluta del PDF (404 en visor)**

Síntoma: la lista lateral de PDFs cargaba bien pero al hacer click en
un doc el visor mostraba "404 File not found".

Causa raíz: `urlDocumento(cid, slug)` devolvía la cadena RELATIVA
`assets/docs/contratos/{cid}/{slug}`. El navegador la resolvía contra
`location.href` de la página, dando:

```
https://.../LordPowerTransformersMJ.github.io/pages/assets/docs/...
                                              ^^^^^ pages/ sobrando
```

GitHub Pages 404 porque el path real es sin `pages/` en medio.

Fix: la función ahora prepende `BASE_HREF` resuelto desde
`import.meta.url` (mismo patrón que `aqua-shell.js` y la función
`cargarManifest()` que ya funcionaba). URLs absolutas que no
dependen del path de la página llamante.

**Bug 2 — `91dec5f` empty-state + scroll del PDF**

Síntoma: el placeholder "Selecciona un documento / Elige un PDF…"
se veía como marca de agua sobre el PDF aún después de seleccionar
uno; y la rueda del mouse no scroleaba dentro del PDF.

Causa 1 (empty-state): `.viewer-empty { display: flex }` ganaba en
especificidad sobre el `[hidden] { display: none }` implícito del
browser. Setear `hidden=true` no surtía efecto visual.

Fix 1: regla explícita `.viewer-empty[hidden] { display: none
!important }`. Lo mismo para `.viewer-frame[hidden]` por consistencia.

Causa 2 (scroll): el iframe se cargaba con `src='...pdf#view=FitH'`.
El parámetro `FitH` instruye al visor PDF nativo a fit-horizontal
(página entera en ancho), lo que en Chrome/Safari resulta en una
vista single-page que NO captura wheel events.

Fix 2: removido el `#view=FitH` del src. La URL bare deja al visor
nativo del browser en su modo default (vista continua con scroll
vertical funcional).

## v2.6.0 — Microcirugía Suministros · Información Contractual + visor PDF (2026-04-27 PM3)

Reestructura del módulo Suministros / Contratos según lineamientos
del director, en 6 fases atómicas (commits aislados). Documentación
completa en `docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`.

### Resumen ejecutivo

- **Sidebar restructurado**: la categoría "Suministro de Elementos y
  Accesorios para Transformadores de Potencia" pasa de ser un link
  (`<a href>`) a un nodo padre puro (`<button>`). Click solo
  expande/colapsa, no navega.
- **Fondo aqua glass del sidebar recuperado**: el director había
  perdido el material Liquid Glass del sidebar al revertir el dark
  mode. Restaurado al diseño v2.1.0-aqua original con
  `background: rgba(255,255,255,.36-.22)` + `blur(52px)
  saturate(200%) brightness(108%)` + highlight 3D superior.
- **Nueva página Información Contractual** con nube documental:
  visor PDF embebido (iframe nativo), buscador instantáneo, lista
  agrupada por categoría, hash routing para refresh, fullscreen API.
  Cero dependencias externas.
- **13 PDFs (39 MB)** commiteados al repo desde las carpetas
  `Contrato N° XXX Informacion Contractual/` con paths URL-safe en
  `assets/docs/contratos/{cid}/`. Manifest JSON con título legible
  + categoría + peso. PDFs sirven inmediato vía GitHub Pages.
- **Script Node** `scripts/deploy-pdfs-storage.js` para migrar a
  Firebase Storage cuando el director quiera. Idempotente por md5.
  Genera URLs firmadas (exp 2100) e inyecta el array
  `documentos_contractuales[]` en `/contratos/{cid}` Firestore.
- **Auditoría visual WCAG AA**: corrección de contraste en chips,
  iconos y tabs donde `color: var(--brand)` se usaba sobre
  `rgba(0,122,255,.14)` (contraste 3.8:1 → 5.4:1 con `--brand-deep`).

### Micro-fases (6 commits)

- **#1 Fase 1** — Inventario PDFs + plan de microcirugía
  (`docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md`).
- **#2 Fase 2** — Sidebar: categoría como nodo padre + recuperar
  fondo aqua glass.
- **#3 Fase 3** — Página `pages/contrato-info.html` con visor PDF
  embebido (split layout: lista + visor). 4 archivos nuevos:
  `contrato-info.html`, `contrato-info.css`, `contrato-info.js`,
  `data/documentos_contractuales.js`. PDFs movidos a paths URL-safe.
- **#4 Fase 4** — `scripts/deploy-pdfs-storage.js` Node ESM con CLI
  args (`--service-account`, `--contrato`, `--dry-run`). Update de
  `storage.rules` con match `/contratos/{contratoId}/{filename=**}`
  (read:true, write:isAdmin con tope 50 MB).
- **#5 Fase 5** — Auditoría visual: 6 reglas CSS migradas de
  `var(--brand)` a `var(--brand-deep)` para mejor contraste.
- **#6 Fase 6** — Esta documentación.

### Decisiones técnicas

1. **Visor PDF nativo** (iframe + `#view=FitH`) en lugar de PDF.js.
   Cero dependencias, los navegadores modernos lo manejan
   internamente (Chrome PDF Viewer, Safari built-in, Firefox PDF.js
   integrado). PDF.js queda como fallback futuro si aparecen
   limitaciones.
2. **Manifest JSON** + paths URL-safe. Los PDFs originales tenían
   acentos, espacios y caracteres especiales (ñ, °, etc.) que
   complicaban URLs. El slug normalizado (NFD + lowercase + dash)
   resuelve el transporte; el manifest preserva el título humano.
3. **Doble canal de transporte**: GitHub Pages (default, vía
   manifest local) + Firebase Storage (override vía
   `/contratos/{cid}.documentos_contractuales[]`). Cuando el director
   ejecute el deploy script, Firestore gana sobre el manifest local
   sin tocar el frontend.
4. **`<button>` para nodos solo-toggle**: la categoría de contratos
   se convirtió de `<a>` a `<button>` para semántica correcta. CSS
   reset del button (border, font, background) normalizado.
5. **Hash routing** (`#doc=slug`) para que un refresh o un
   share-link restaure la selección del PDF.

### Archivos clave

- `assets/css/aqua-components.css` — `.sb` con material aqua glass
  restaurado, contraste WCAG AA en chips/icons
- `assets/css/contrato-info.css` — layout split + estilos del visor
- `assets/js/aqua-shell.js` — categoría como `<button>`, hrefs
  Información Contractual → `pages/contrato-info.html?id=NNN`
- `assets/js/contrato-info.js` — controlador de la página (lista,
  buscador, visor, hash routing, fullscreen)
- `assets/js/data/documentos_contractuales.js` — data layer dual-channel
- `pages/contrato-info.html` — shell de la página
- `assets/docs/contratos/{4123000081,4125000143}/` — 13 PDFs +
  manifest.json
- `scripts/deploy-pdfs-storage.js` — migrador a Firebase Storage
- `storage.rules` — match `/contratos/{cid}/{filename=**}`

### Pendientes post-v2.6.0

- Deploy de `storage.rules` por el director: `firebase deploy --only storage`
- Eventual ejecución de `node scripts/deploy-pdfs-storage.js
  --service-account ~/sa.json` cuando el director quiera migrar los
  PDFs de GitHub Pages a Firebase Storage (sin urgencia).
- Si se necesitan más documentos contractuales en el futuro, se
  agregan al manifest JSON o vía Firestore override.

## v2.5.1 — Iteraciones visuales · revert aqua light + JSX removal + SIN DATOS fix (2026-04-27 PM2)

Período de afinamiento entre v2.5.0 (UI v3 dark mode) y v2.6.0
(microcirugía Suministros). 5 commits incrementales no agrupados en
un plan formal pero todos en la misma sesión.

### Cambios consolidados

1. **`215f615` Foto Fondo PT.jpg** — el director subió un primer
   reemplazo (1920×1080 JPEG, 1.16 MB). Procesada con `optimize=True
   progressive=True` + EXIF stripped → 365 KB sin pérdida visual.
   PR #105.
2. **`8c32420` Foto Fonto PT.jpg** — segunda iteración con fuente
   más grande (2880×1620, 2.9 MB). Redimensionada a 2560×1440 LANCZOS
   q88 progressive → 657 KB retina-suitable. PR #106.
3. **`50cf27a` Revert dark mode → aqua light** — el director pidió
   "letras de color negro que haga match con el entorno aqua".
   Tokens revertidos: ink-1 #f3f7ff → #0d1f38 (steel navy deep),
   glass tokens rgba(8,18,35,X) → rgba(255,255,255,X) (blanco perla
   translúcido), specular y borders restaurados al diseño v2.1.0-aqua
   original. PR #107.
4. **`7310a33` Foto FONDO POWERTRANSFORMER.jpg en WebP** — tercera
   iteración (2880×1620, 3.4 MB JPG). Convertida a WebP q=95 method=6
   sin redimensionar para garantizar nitidez en monitores 4K/5K.
   1.07 MB final · 67% reducción vs JPG original con calidad
   visualmente idéntica. PR #108.
5. **`c41d316` Importador canal único Excel + tag SIN DATOS dinámico** —
   el director pidió retirar JSX como canal de importación
   (`control_suministros-2.jsx`) y arreglar el tag "SIN DATOS" pegado
   en el contrato 4125000143 después de su importación. PR #109.

### Detalle del refactor JSX (commit `c41d316`)

**Eliminado del importador** (UI + data + domain):
- Campo `<input type="file" id="jsxInput">` y botón "Subir .jsx"
- Funciones `parsearJsxTransformadores`, `parsearJsxCatalogo`,
  `enriquecerCatalogoConJsx`, `jsxRowADocV2`,
  `extraerCorreccionesEmbedded`, `reconciliarEquipos` (6 funciones,
  ~270 líneas en domain)
- Etapas /transformadores y /correcciones de `ejecutarImportacion`
- 5 describes de tests asociados a JSX
- Archivo `control_suministros-2.jsx` borrado del repo

**Razón**: el JSX era un canal de bootstrap one-time. Sus datos
(206 transformers, 22 catalog items con valU, 3 correcciones
hardcoded) ya viven en Firestore desde imports anteriores. Re-leer
de JSX en cada import sobreescribía el `valor_unitario` que el
director ajustaba manualmente desde `admin/suministros-catalogo.html`.
Excel queda como motor único de importación.

### Detalle del fix SIN DATOS (mismo commit `c41d316`)

**Causa raíz**: en `assets/js/contratos-public.js` el flag
`con_datos: false` para 4125000143 estaba HARDCODEADO en el array
seed `CATEGORIAS_SEMILLA`. La suscripción a `/contratos` solo
agregaba contratos no-semilla, jamás actualizaba los flags de
contratos semilla.

**Fix**: nueva función `aplicarEstadoFirestore()` que mergea cada
contrato semilla con el doc Firestore `/contratos/{id}`. Si el doc
existe y tiene `ultima_importacion` (lo escribe el importador al
final de cada bulk), el flag `con_datos` queda `true` y el tag SIN
DATOS desaparece. Auto-corregible: la primera importación al
contrato 4125 quita el tag automáticamente.

### Tests

- 468/468 → 453/453 verde (perdimos 15 tests del JSX, esperado)
- Lint HTML limpio en cada commit

## v2.5.0 — UI v3 dark mode · foto IMG_9840 · drilldown contratos (2026-04-27 PM)

Refactor visual completo del shell sobre la nueva foto de fondo
`IMG_9840.HEIC` que el director subió al repo. 14 PRs micro
(#90–#103) en una sola sesión. Documentación completa en
`docs/UI-V3-DARKMODE.md` y `CLAUDE.md` §9 reescrito.

### Resumen ejecutivo

- **Foto nueva** `assets/img/aqua/substation-photo.jpg` 2560×1920,
  1.16 MB JPEG q88. Origen: `IMG_9840.HEIC` 5712×4284 convertida
  con `pillow-heif` + redimensionada con LANCZOS. Subestación
  Caribe Colombiano de noche con luces puntuales sobre aisladores.
- **Dark mode completo**: inks claros (`#f3f7ff` títulos,
  `#d6e0ec` cuerpo, `#a0b3ca` meta, `#6f7f96` placeholder), glass
  tokens con tint navy oscuro `rgba(8,18,35,X)` en vez de
  `rgba(255,255,255,X)`. Topbar, sidebar y page titles con
  text-shadow oscuro para legibilidad.
- **Sidebar transparente** (`background: transparent !important;
  backdrop-filter: none !important`). La foto se ve a través
  directamente.
- **Drilldown contratos en sidebar**: bajo cada número de contrato
  (4123000081, 4125000143) ahora se despliegan dos links terminales
  — "Control y Gestión Operativa" e "Información Contractual" —
  que cargan el contrato en el panel derecho con o sin tab
  pre-seleccionado.
- **Service Worker kill-switch**: el SW v3-5-2 (cache-first) que
  bloqueaba deploys queda reemplazado por uno que se
  auto-desregistra al activarse. PWA offline-first temporalmente
  desactivada — prioridad: deploy y se ve.
- **Foto vieja borrada** (`substation-photo.png` 1598×1599 con
  41% de área útil) y archivos HEIC de tránsito removidos del
  repo.

### Micro-fases (14 PRs)

- **#90** — Swap foto thumbnail (755×752) → hi-res (3840×2400 con
  padding blanco interno).
- **#91** — Cobertura full-viewport `.aqua-power-scene` con
  `width: 100vw; height: 100vh; height: 100dvh`.
- **#92** — Sidebar más transparente (rgba .18-.08, blur 20px).
- **#93** — SW bump v3-5-2 → v3-5-3.
- **#94** — Sidebar prácticamente transparente (rgba .06-.02,
  blur 8px).
- **#95** — SW refactor a network-first.
- **#96** — SW kill-switch auto-desregistra.
- **#97** — Sidebar 100% transparente (`!important`) + text-shadow
  blanco halo.
- **#98** — Recorte de la foto al bounding box no-blanco
  (3840×2400 → 1598×1599) eliminando 60% de padding blanco interno.
- **#99** — Nueva foto IMG_9840 procesada · HEIC 3.9 MB →
  JPEG 2560×1920 1.16 MB.
- **#100** — Dark mode tokens (inks claros, glass navy oscuro,
  topbar dark, text-shadows oscuros).
- **#101** — Submenu inicial "Información Contractual" bajo cada
  contrato (luego refactorizado).
- **#102** — Drilldown 5 niveles · `markActive()` reescrito para
  desambiguar por hash `#tab=`, expandir cadena completa de
  árboles ancestros · `bindTreeToggle()` respeta `aria-expanded`
  inicial del caret.
- **#103** — Refactor: "Control y Gestión Operativa" e "Información
  Contractual" como links terminales (no acordeones), proper case
  (sin uppercase). Removidos los 5 leaves (Dashboard, Catálogo,
  Movimiento, Histórico, Importar) del sidebar — ya viven como
  tabs en el panel derecho del contrato.

### Lecciones técnicas

1. **HEIC no es válido como CSS background-image** en Chrome/Firefox.
   Pipeline establecido: `pillow-heif` → resize LANCZOS → JPEG q88
   progressive optimize=True.
2. **Padding blanco dentro de un PNG** es invisible para el
   desarrollador pero `background-size: cover` lo estira hasta los
   bordes del viewport. Detectar bounding box no-blanco con
   PIL+numpy antes de usar fotos como fondo:
   ```python
   non_white = np.any(arr < 245, axis=2)
   rows = np.any(non_white, axis=1)
   cols = np.any(non_white, axis=0)
   ```
3. **Service Workers cache-first bloquean deploys de GitHub Pages**
   incluso bumpeando `CACHE_VERSION` — Safari no chequea `sw.js`
   con suficiente frecuencia. Solución de raíz: kill-switch SW
   que se auto-desregistra al activarse.
4. **`markActive()` con multi-active** ocurría cuando varios
   sidebar items compartían el mismo `?id=`. Fix: agregar
   comparación de hash `#tab=` y elegir un solo ganador antes de
   marcar `is-active`.
5. **`bindTreeToggle()` forzando expand-all** impedía colapsar
   árboles por default. Fix: respetar el `aria-expanded` inicial
   del botón caret.
6. **Project page URL** (`ajimenezp99-jpg.github.io/LordPowerTransformersMJ.github.io/`)
   distinta de user page (`ajimenezp99-jpg.github.io/`). La user
   page retorna 404. Documentado en CLAUDE.md §9.7.

### Archivos clave

- `assets/css/aqua-tokens.css` · inks dark + glass navy
- `assets/css/aqua-components.css` · topbar dark, sidebar
  transparent, sidebar 4-level structure (greatgrandchild proper
  case), text-shadows dark
- `assets/js/aqua-shell.js` · `markActive()` con hash matching,
  `bindTreeToggle()` respetando aria-expanded
- `assets/img/aqua/substation-photo.jpg` · foto activa
- `sw.js` · kill-switch
- `pages/dashboard.html` · removida llamada a `register('/sw.js')`
- `docs/UI-V3-DARKMODE.md` · documento de decisiones de diseño

### Pendientes post-v2.5.0

- **Datos de Información Contractual** · cuando el director suba
  el archivo (formato/contenido por definir), montar tab
  `#tab=info-contractual` en `pages/contrato.html` que renderice
  los datos.
- **Reactivar PWA offline-first** después de validar que los
  deploys quedan estables · sustituir kill-switch por SW
  network-first probado.
- **Revocar segundo PAT** (`ghp_kzk3…`) cuando termine la
  iteración visual.

## v2.4.1 — Deploy contrato 4125000143 · export espejo + rules multi-contrato (2026-04-27)

Integración del nuevo dataset del contrato **4125000143**
(`Gestion_Suministros_Transformadores_4125000143.xlsm`) sobre la
arquitectura multi-contrato N1–N5. 9 micro-fases atómicas (A, B,
pre-E, D, E.1–E.6, F).

### Resumen ejecutivo

- 25 SKUs nuevos (S01–S25, +3 bujes 13.8/34.5/66-110 kV) detectados
  en el archivo del contrato y validados contra el parser puro.
- Exportador `.xlsm` reescrito como **espejo completo** del template
  canónico: además de Movimientos (sheet6/table4), ahora cubre
  Catálogo (sheet2/table1), Marcas (sheet3/table2), ListasMarcas
  oculta (sheet4) y `definedName Sxx` extendidos en workbook.xml.
- `vbaProject.bin` del template se preserva idéntico (md5
  `5ab76c9f…`); macros operativos al abrir el archivo exportado.
- Seeder Node CLI `scripts/import-contrato.js` para importar el
  catálogo de cualquier contrato server-side desde la Mac del
  director, vía service-account JSON.
- 3 bugs pre-existentes de N3-N5 corregidos: rules multi-contrato,
  estado de `/contratos` al auto-registrar, y replace-with-`$`
  patterns en exporter (que generaba 179 definedName duplicados).

### Micro-fases

- **FASE A** — Análisis estructural de los dos `.xlsm`. Reporte
  completo en `docs/CONTRATO_4125000143_ANALISIS.md`. Inventario
  ZIP idéntico (35 partes), workbook con 8 hojas mismo `r:id`,
  vbaProject.bin distinto entre archivos (decisión: usar el del
  template como canónico), `definedName` para S23-S25 ausente,
  ListasMarcas reestructurada en el archivo del contrato.
- **FASE B** — Test dryrun del parser puro contra el archivo real
  (`tests/import_4125000143_dryrun.test.js`, 12 tests verde):
  estructura del .xlsm, parseo de 25 sumins, S23/S24/S25 con
  stock_inicial 3/3/6, marcas filtradas por placeholders,
  prepararPlanImportacion con Firestore vacío vs catálogo previo.
  `xlsx@0.18.5` añadido como devDependency.
- **FASE C** — No-op confirmado. Regex y enums actuales aceptan
  el archivo nuevo sin cambios al parser/dominio.
- **FASE pre-E** — `firestore.rules`: bug pre-existente en línea
  496 (`data.codigo == id`) bloqueaba writes con docId composite
  introducido por N5. Helpers nuevos `isContratoIdValido` y
  `isSuministroDocId`. Validación opcional de `contrato_id` añadida
  a `/suministros`, `/marcas`, `/movimientos`, `/correcciones`.
  Inmutabilidad de `codigo` en updates conservada. **Requiere
  deploy manual** (`firebase deploy --only firestore:rules`).
- **FASE D** — `scripts/import-contrato.js` CLI seeder con
  `firebase-admin@^13.8.0`. Reusa el parser puro del dominio,
  acepta `--xlsm`, `--contrato-id`, `--service-account`, `--dry-run`,
  `--uid`, `--nombre`. Idempotente. Audita en /audit. Bug paralelo
  fixed: importer web escribía `estado: 'activo'` a /contratos/{cid}
  (N5 commit aac5994), valor que las rules rechazaban con try/catch
  silenciado → ambos paths (UI + CLI) ahora escriben
  `estado: 'vigente'` con payload completo del contrato_schema F21.
- **FASE E.1** — `parchearSheet2` + `generarFilaCatalogoSuministro`:
  reescribe Catálogo con fórmulas individuales (no shared) para
  SUMIFS/Stock_Actual/Alerta. 8 tests nuevos.
- **FASE E.2** — `parchearSheet3` + `generarFilaMarca`: reescribe
  Marcas. 7 tests nuevos.
- **FASE E.3** — `parchearSheet4` + `colLetter`: reescribe
  ListasMarcas oculta con layout estable 3 filas × N cols. Cierra
  el gap detectado en FASE A. 8 tests nuevos.
- **FASE E.4** — `parchearTable1` (`tblSuministros`) y
  `parchearTable2` (`tblMarcas`): refs `B3:J{3+n}` y `B3:D{3+n}`.
  5 tests nuevos.
- **FASE E.5** — `parchearWorkbookXml`: extiende `definedName Sxx`
  para todos los suministros del catálogo (idx → colLetter).
  Preserva `ent_*`, `flt_*` intactos. 5 tests nuevos.
- **FASE E.6** — Wire-up de `generarXlsmExport(payload, opts)` con
  firma extendida backwards-compat. **Bug crítico corregido en
  TODOS los helpers**: `String.replace(regex, "templateLiteral")`
  interpreta `$1`/`$&`/`$'`/`$\`` en el reemplazo. Las fórmulas
  Excel y los `definedName` con `$F$6`/`$E25` corrompían el
  output. Fix: cada `replace` con template literal pasó a callback
  function. Test de integración `tests/xlsm_export_integracion.test.js`
  con archivo real (2 tests). devDeps: `jszip@^3.10.1`.

### Estado al cierre

- Suite **468/468 tests verde**, lint HTML limpio.
- Branch `claude/deploy-contract-dataset-Fx8eG`, listo para PR a
  `main`.
- Archivo `.xlsm` exportado real verificado: 82212 bytes, 25 SKUs,
  vbaProject.bin md5 = `5ab76c9f…` (igual al template), tablas
  con refs correctas, dropdowns operativos para los 25 SKUs, abre
  en Excel/SheetJS sin errores.

### ⚠ Requiere deploy manual tras merge

```bash
firebase deploy --only firestore:rules
```

Sin esto, el seeder server-side (FASE D) y el importer web (con
contrato_id) fallan con `permission-denied` por la regla pre-N3.

### Cómo cargar el contrato 4125000143 a producción

1. Mergear esta rama a `main`.
2. Deployar rules: `firebase deploy --only firestore:rules`.
3. Generar service-account JSON: Firebase Console → Project
   Settings → Service accounts → Generate new private key. Guardar
   FUERA del repo.
4. Ejecutar el seeder en dry-run para revisar el plan:
   ```bash
   node scripts/import-contrato.js \
     --xlsm Gestion_Suministros_Transformadores_4125000143.xlsm \
     --contrato-id 4125000143 \
     --service-account ~/.firebase/sa-transpower.json \
     --dry-run
   ```
5. Si el plan se ve bien, ejecutar sin `--dry-run`. Idempotente.
6. Verificar en `pages/contratos.html` que aparece el contrato
   4125000143; entrar y ver Catálogo con S01-S25.

## v2.4.0 — Refactor Contratos · arquitectura escalable multi-contrato (2026-04-25)

Reorganización de la navegación para soportar de forma escalable múltiples
contratos de suministro. El módulo "Suministros" (que era flat y
monocontrato) pasa a vivir jerárquicamente dentro de un contrato; cada
contrato futuro replica la misma estructura de tabs sin duplicación de
código. 5 microfases atómicas (M1–M5).

### Microfases

- **M1** — Eliminación del módulo Correcciones. Tab + tabpanel removidos
  de pages/suministros.html, archivos admin/suministros-correcciones.html
  y assets/js/admin/admin-suministros-correcciones.js eliminados, redirect
  legacy retirado de aqua-shell.js. El data layer
  data/correcciones.js y la rule firestore.rules para /correcciones
  permanecen intactos por backwards-compat (3 docs sembrados desde el JSX
  siguen accesibles, colección reusable a futuro).
- **M2** — pages/contratos.html con grid responsive de cards. Cada card
  tiene icon + número + estado-pill + nombre + fechas + footer con flecha
  animada. Suscripción realtime a /contratos con filter tipo='suministros';
  fallback a contrato semilla 4123000081 cuando la query devuelve vacío,
  con tag visible 'SEMILLA' para indicar que aún no está formalmente
  registrado.
- **M3** — pages/contrato.html?id=XXX shell dinámico. Lee el id del query,
  renderiza header con número y nombre cargados desde /contratos/{id}
  (con fallback a META_SEMILLA mientras Firestore responde). 5 tabs sin
  Correcciones: Dashboard (público) · Catálogo · Movimiento · Histórico ·
  Importar (admin). Reusa initModuleShell del refactor v2.3.
- **M4** — Sidebar refactor: 'Suministros' → 'Contratos' (icon
  file-text). LEGACY_REDIRECTS actualizado para que las 5 URLs viejas
  de Suministros lleven al contrato semilla con tab correcta. El shell
  pages/suministros.html antiguo también redirige.
- **M5** — Cache PWA sgm-v3-3-0 → sgm-v3-4-0 + CHANGELOG + tag.

### Patrón escalable para nuevos contratos

Cuando llegue un Excel de un contrato adicional:
1. Importador F42 amplía para detectar el `contrato_id` del Excel.
2. Crea/actualiza /contratos/{id} con tipo='suministros'.
3. Filtra los docs sembrados por contrato_id (suministros, marcas,
   movimientos).
4. La página pages/contratos.html lo lista automáticamente vía
   onSnapshot.
5. Click en la card → pages/contrato.html?id={N} carga sus tabs
   con datos filtrados.

Cero refactor de UI necesario para soportar el contrato N+1.

### Métricas

- 5 microfases · 5 commits aislados
- ~530 LOC nuevas (pages contratos/contrato + controllers + CSS cards)
- 341 LOC eliminadas (módulo Correcciones)
- Tests siguen 399/399 verdes (el módulo de Correcciones eliminado no
  tenía tests automatizados)
- Cero deploys nuevos
- Cache PWA bump

---

## v2.3.0 — Refactor UX · Navegación consolidada con tabs (2026-04-25)

Reorganización inteligente de TODOS los menús del portal. Sidebar pasa
de 32 entradas dispersas a **8 módulos jerárquicos** con tabs internas.
9 microfases (R0–R9) atómicas, cada una shippable independientemente.

### Bloque · Componente reutilizable

- **R0** — `assets/js/ui/tabs.js` ARIA-compliant con keyboard nav y hash
  routing. `assets/css/tabs.css` con estilo Aqua liquid-glass sticky.
  17 tests para los helpers puros (parseHash/buildHash/mergeHash).

### Bloque · Consolidación módulo a módulo

- **R1** — Suministros: 6 vistas (Catálogo, Movimiento, Histórico,
  Correcciones, Importar, Dashboard) → 1 con tabs.
- **R2** — Salud del Activo: 5 vistas (Muestras, Motor HI, Propuestas
  FUR, Contramuestras, Fallados+RCA) + Matriz Riesgo movida desde
  Análisis → 1 con tabs.
- **R3** — Activos: 4 vistas (Inventario, Mapa, Subestaciones,
  Contratos) → 1 con tabs.
- **R4** — Análisis: 5 vistas (Dashboard, KPIs RAM, Alertas, Plan
  Inversión, Desempeño Aliados) → 1 con tabs.
- **R5** — Administración: 5 vistas (Panel, Usuarios, Catálogos,
  Importar Excel, Auditoría) → 1 con tabs.
- **R6** — Recursos: 4 vistas (Documentos, Normativa, Cobertura,
  Acerca) → 1 con tabs.
- **R7** — Reescritura del sidebar: distribuida orgánicamente en R1–R6.

### Bloque · Compatibilidad y cierre

- **R8** — `LEGACY_REDIRECTS` en aqua-shell.js: 28 URLs viejas
  redirigen automáticamente a la página padre con tab activa. Preserva
  bookmarks. Escape hatch `?legacy=keep` para acceso standalone.
- **R9** — Cache PWA `sgm-v3-2-0` → `sgm-v3-3-0` + CHANGELOG + tag.

### Patrón técnico

- **Sin refactor de subscreens**: cada vista existente sigue siendo una
  página completa que se embebe vía `<iframe lazy data-src>`. El
  `module-shell.js` genérico (initModuleShell) es un wrapper de 1
  línea por módulo sobre `tabs.js`.
- **Detección de iframe en aqua-shell.js**: si `window.self !== window.top`
  marca el body con `.is-embedded` y oculta topbar/sidebar/escena Aqua
  para no duplicar el shell del padre.
- **Hash routing**: cada tab activa actualiza `location.hash` con
  `history.replaceState` (no llena el back stack); `hashchange` listener
  permite back/forward del browser entre tabs.
- **RBAC visual**: tabs marcadas `data-admin="1"` se ocultan a
  no-admins leyendo `window.__sgmSession.profile.rol`.

### Métricas

| Métrica | Antes (v2.2.0) | Después (v2.3.0) |
|---|---|---|
| Entradas en sidebar | 32 | **8** (-75%) |
| Páginas standalone | 30+ | mantenidas (compat) |
| Tests | 382 | **399** (+17 helpers tabs) |
| LOC nuevas | — | ~900 (shells + redirects) |
| LOC eliminadas | — | 0 (zero refactor de legacy) |
| Deploys nuevos | 0 | 0 (puro client-side) |

### Estructura final del sidebar

| Grupo | Entrada | Ruta | Tabs internas |
|---|---|---|---|
| Operación | Inicio | `home.html` | — |
| Operación | **Activos** | `pages/activos.html` | Inventario · Mapa · Subestaciones · Contratos |
| Operación | Órdenes | `pages/ordenes.html` | — |
| Operación | **Suministros** | `pages/suministros.html` | Dashboard · Catálogo · Movimiento · Histórico · Correcciones · Importar |
| Análisis | **Análisis e Indicadores** | `pages/analisis.html` | Dashboard · KPIs RAM · Alertas · Plan Inversión · Desempeño |
| Salud del activo | **Salud del Activo** | `pages/salud.html` | Muestras · Motor HI · FUR · Contramuestras · Fallados+RCA · Matriz |
| Administración | **Administración** | `admin/administracion.html` | Panel · Usuarios · Catálogos · Importar Excel · Auditoría |
| Recursos | **Recursos** | `pages/recursos.html` | Documentos · Normativa · Cobertura · Acerca |

---

## v2.2.0 — Suministros + Repuestos · F38–F50 (2026-04-25)

Integración del sistema de control de suministros del .xlsm fuente
+ JSX al sitio web. 13 microfases atómicas. Plan completo en
`docs/PLAN-SUMINISTROS.md`.

### Bloque A · Cimientos (sin UI visible)

- **F38** — Dominio puro. 4 schemas + sanitizers + validadores
  (`suministro_schema.js`, `marca_schema.js`, `movimiento_schema.js`,
  `correccion_schema.js`) + extensión a `schema.js` con
  `TIPOS_MOVIMIENTO`, `ESTADOS_REPUESTO`, `TIPOS_CORRECCION`,
  `UNIDADES`, `ESTADOS_STOCK` (semáforo 6 estados del skill),
  `estadoStock(disp, ini, opts)` y `generarCodigoMov(anio, sec)`.
  41 tests.
- **F39** — Data layer. `data/suministros.js` (codigo como docId),
  `data/marcas.js` con sync arrayUnion/arrayRemove de
  `marcas_disponibles[]`, `data/movimientos.js` con `crear()` en
  `runTransaction()` que valida stock atómicamente y genera
  `MOV-YYYY-NNNN` sin race condition, `data/correcciones.js`
  (sin delete), `data/suministros_config.js` singleton, motor puro
  `domain/stock_calculo.js`. 20 tests.
- **F40** — Rules + 7 índices compuestos. Validación enums
  server-side. Movimientos con campos críticos inmutables en
  update. Correcciones DELETE bloqueado.
- **F41** — Sub-section `repuesto.estado` con dual-write retrocompat.
  +8 tests.

### Bloque B · Importador

- **F42** — Importador idempotente XLSM/JSX → Firestore. Parser puro
  con regex+JSON.parse (cero `eval`). Mapping corregido tras feedback:
  `cod` → `identificacion.codigo`, `m` → `identificacion.matricula`,
  `sub` → `identificacion.nombre` + `subestacion_nombre`.
  Enriquecimiento del catálogo con `valor_unitario` desde JSX. UI
  admin con dropzone + drag-from-repo + dryRun. Audit
  `bulk_import_suministros` con SHA-256. 20 tests.

### Bloque C · Admin UI

- **F43** — Catálogo CRUD realtime + chips marcas inline editables
  en el modal (gestión consolidada).
- **F44** — Marcas CRUD con sync arrayUnion.
- **F45** — Formulario INGRESO/EGRESO con autocomplete cascada,
  validación atómica de stock, color coding del skill,
  `StockInsuficienteError` con faltante explícito.
- **F46** — Histórico con filtros + delete con justificación
  obligatoria + export CSV. Correcciones CRUD sin delete.

### Bloque D · Public UI

- **F47** — Stock Dashboard con 8 KPIs + tabla 22 filas con
  semáforo 6 estados.
- **F48** — Dashboard ejecutivo con 8 KPIs + 4 charts Chart.js +
  vista cruzada zona/depto.

### Bloque E · Export y cierre

- **F49** — Export XLSM 1:1 con template binario via JSZip + parche
  XML quirúrgico. Preserva byte a byte: `vbaProject.bin` (3 macros),
  Office Add-in, charts, theme, styles, las otras 7 hojas. Sólo
  reescribe `sheet6.xml` y `table4.xml`. JSZip lazy-loaded vía CDN.
  8 tests.
- **F50** — Cache PWA bump `sgm-v3-1-0` → `sgm-v3-2-0` + CHANGELOG +
  tag.

### Decisiones del director registradas

1·C 10 hojas en export · 2·A JSX gana / sin DELETE huérfanos ·
3·A `stock_inicial=0` mostrado como SIN_STOCK · 4·A preservar VBA
via template binario · 5·A preservar Office Add-in · 6·A escritura
de movimientos solo admin · 7·A audit `bulk_import_suministros`
con metadata granular.

### Métricas

- 13 microfases · 23+ commits · 6.500+ LOC nuevas
- 282 → 382 tests verdes (+100 tests)
- 1 deploy manual del director (rules + índices)
- Plan completo: `docs/PLAN-SUMINISTROS.md` (1.269 líneas)

---

## v2.1.0-aqua · post-tag · PR #55 (2026-04-25)

Ajustes finos del rediseño Aqua tras feedback del director sobre el
PR #54 (que ya quedó mergeado a `main`). Estos 4 commits viven en
`claude/distracted-hoover-43da2d` esperando merge.

### `d688999` · foto real + overlay SVG con equipos (REVERTIDO)

Primer intento tras feedback "no tuviste en cuenta la imagen": añadí
foto de subestación + overlay SVG con DPS/89/52/CT interconectados
por las 3 fases. El director rechazó el overlay ("manten la imagen
tal cual"). El SVG `assets/img/aqua/substation-scene.svg` queda en
repo pero inactivo.

### `0025a8b` · foto sin overlay + más transparencia

- `.aqua-power-scene` apunta directo a `substation-photo.png` (no al
  SVG). `position: inset 0` cubre toda la viewport. `opacity: 1`
  (era .72). Solo un velo perla muy ligero (12-22%) sobre el cielo
  para asegurar contraste de texto.
- Glass más transparente: thin .42→.22 / .22→.10, regular .52→.30 /
  .32→.16, thick .66→.42 / .44→.24, ultra .82→.62 / .62→.42.
- Topbar idle .55→.30 / .40→.18 (scrolled .78→.50 / .62→.36).
- Sidebar .62→.36 / .48→.22, brand-head .42→.22.
- Blur compensa: 32/48/64px (era 28/44/60).

### `e6e04fe` · texto Steel Corporate Navy + text-shadow

- `--ink-1: #0a1628 → #0d1f38` (títulos · steel navy deep).
- `--ink-2: #2a3a52 → #1f3656` (cuerpo · corporate steel).
- `--ink-3: #5a6c87 → #4d6485` (meta · muted blue-gray).
- `--ink-4: #8896ad → #8093ad` (placeholder · light blue-gray).
- Misma familia cromática que `--brand: #007aff` pero saturada y
  oscura. Estilo corporativo del sector energía (GE, Siemens, ISA).
- `text-shadow: 0 1px 0 rgba(255,255,255,.55), 0 2px 8px rgba(244,
  249,255,.42)` en `.page-title`/`.section-title`/`.page-sub`/
  `.section-sub` para legibilidad sobre la foto (zonas claras del
  cielo y zonas oscuras del transformador).

### `4e24111` · `.gitignore` excluye `.claude/`

- Una línea: `.claude/` añadida al `.gitignore`.
- Resuelve el "commit fantasma" que GitHub Desktop mostraba en
  `main` al ver la carpeta del worktree de Claude Code como
  cambio nuevo.

### Pendientes en PR #55

- Foto en alta resolución (la actual 755×752 pixela en viewports
  >1200px). Pendiente que el director exporte el original desde
  Photos (Export Unmodified Original) o provea URL de origen.
- Merge del PR desde GitHub.com web.
- Revocar el PAT clásico que dio inline durante la sesión.

---

## v2.1.0-aqua · 2026-04-25 · Liquid Glass redesign (iOS 26 / macOS Tahoe)

Rediseño visual integral a **Apple Aqua light perla** (iOS 26 /
macOS Tahoe Liquid Glass). Cero impacto en lógica de Firestore,
motor de salud, importador, RBAC, alertas, reportes o Cloud
Functions. Capa puramente visual sobre la arquitectura v2.0.x.

### Sistema de diseño Aqua (10 microfases)

#### A1 · Fundación
- `assets/css/aqua-tokens.css` (light perla, sin azul de fondo,
  sin rosa). iOS palette (blue/cyan/teal/amber). SF Pro + Instrument
  Serif italic en hero + JetBrains Mono. Radii iOS, motion ease-ios,
  shadows light. **Solo activo con `body.aqua`.** Bloque de aliases
  legacy (`--space-*`, `--surface-*`, `--edge-*`, `--radius-*`,
  `--brand-500`, `--text-*`, `--gradient-*`, etc.) para que el CSS
  legacy de páginas v2 siga funcionando sobre la paleta perla.
- `assets/css/aqua-components.css` (1090 líneas) — librería completa:
  4 materiales de glass con specular + ring 3D, topbar, sidebar,
  botones 3D, chips, inputs, stat cards, panels, alerts, hero,
  feed, qc cards, modals, tabs, breadcrumb, page-head, form-grid,
  hring, reveal + overrides para componentes legacy.
- `assets/js/aqua.js` — partículas eléctricas, glint cursor, topbar
  scroll state, IntersectionObserver reveal, Lucide auto-init.
- `assets/js/aqua-shell.js` — auto-inyecta topbar + sidebar + escena
  en cualquier página con `body.aqua`. Detecta base relativa, marca
  sidebar item activo según URL, lee `window.__sgmSession` para
  mostrar role-chip + iniciales + ocultar links admin a no-admins.
  Bind `⌘K` para enfocar búsqueda global.
- `assets/img/aqua/{transformer,tower,logo-aqua}.svg` — 3 SVG
  técnicos del bundle de Claude Design.

#### A2 · Login Aqua (`index.html`)
Portal de acceso reescrito con auth-card glass-ultra + escena
completa (mesh + grid + 4 orbes blue/cyan/teal/amber + transformer
SVG + partículas). Hero con `<em>` Instrument Serif italic
gradient. Inputs con icon, check Aqua, btn-primary 3D. Mensajes
de estado info/ok/err con paleta light. **100% lógica Firebase
Auth preservada** (mismos IDs de form, mismo módulo ESM con
`signInWithEmailAndPassword`, `sendPasswordResetEmail`,
`setPersistence`, `onAuthStateChanged`, verificación
`/usuarios/{uid}` con fallback `/admins/{uid}`).

#### A3 · Home dashboard (`home.html`)
Topbar `.tb` pegajoso, sidebar `.sb` permanente 240px, app-main
responsive. Hero glass-thick con título serif italic + parque card
(totales por tipo POTENCIA/TPT/RESPALDO). KPIs grid-4 con stat-cards
+ sparklines. Banda de alertas críticas con alert-card glass.
Panel grid-2: distribución HI bucket (1-5 con paleta iOS) + Top
Plan de Inversión. Feed reciente. Quick cards. **Toda la lógica
realtime de Firestore intacta** (mismas suscripciones a
transformadores + ordenes + suscribirComputo de alertas).

#### A4 · Páginas públicas (13)
Migración mecánica con script Python: about, cobertura, contacto,
normativa, alertas, dashboard, documentos, inventario, kpis, mapa,
matriz-riesgo, ordenes, _firebase-test. Cada una: `theme-color
#f4f6fb`, `color-scheme light`, favicon → `logo-aqua.svg`, imports
CSS legacy (theme/base/app/nav/compat) → un solo
`aqua-components.css`, `body class="aqua"`, `<main class="app-main
page-container">`. `nav.js` (legacy) removido — `aqua-shell.js`
auto-inyecta navegación.

#### A5 · Paneles admin (22)
Mismo patrón A4 sobre `admin/*.html`: alertas, auditoria, catalogos,
contramuestras, contratos, demo-seed, desempeno-aliados, documentos,
fallados, importar, index, inventario, kpis, mapa, motor-salud,
muestras, ordenes, plan-inversion, propuestas-fur, subestaciones,
umbrales-salud, usuarios. `admin-guard.js` intacto.

#### A6 · Modales y formularios legacy
Bloque de overrides `body.aqua` para `.modal-overlay`, `.modal-bg`,
`.modal-card`, `.modal-head`, `.modal-x`, `.modal-actions` con
glass-ultra + specular + animación spring. Inputs/textarea/select
dentro de modales legacy con focus iOS. Form grids `.cols-2`/`.cols-3`
responsive. `.btn-primary`/`.btn-primary-v3` → `grad-brand`.

#### A7 · Pills, tablas, alertas legacy
Overrides para `.estado-pill` (operativo/mantenimiento/fuera_servicio
/retirado/fallado · planificada/en_curso/cerrada/cancelada),
`.tipo-pill` (preventivo/correctivo/predictivo/emergencia con
border-left semántico), `.prioridad-pill` (baja/media/alta/critica),
`.sev-pill` (critica/warning/info), `.bucket-pill[data-b="1..5"]`
para HI 1..5 (paleta verde-teal-azul-naranja-rojo). Tablas legacy
con thead translúcido sticky-style. `.alert-row` con glass-thin +
border-left semántico. `.toolbar`, `.filtros`, `.card`, `.panel-v3`,
`.stat-v3`, page-header con tipografía Aqua.

#### A8 · Charts Chart.js
`assets/js/kpis-render.js` detecta `body.aqua` y aplica paleta iOS
(brand `#007aff`, cyan `#00b8d4`, teal `#30d1b0`, success `#1cc870`,
warn `#ff9500`, danger `#ff3b30`, purple `#7e57ff`). Texto SF Pro
en lugar de Share Tech Mono. Tooltips translúcidos perla con border
iOS blue. Líneas con borderWidth 2.5 y point radius 3. Fallback a
paleta dark legacy si la página no es Aqua.

#### A9 · Mapa Leaflet
`mapa-render.js` detecta `body.aqua` y cambia tile a CARTO Voyager
(gris claro, neutro, sin azul dominante). `aqua-components.css` con
override completo: `.map-wrap` glass-thin + border-left brand,
`#sgmMap` perla `#e6edf7`, controles zoom translúcidos, popups con
glass-ultra, marker clusters con `rgba(0,122,255,.20)` y borde
blanco, divIcon con drop-shadow azul, leyenda translúcida.

#### A10 · Polish + QA
- 282/282 tests verdes (`node --test`).
- Lint HTML 100% limpio en index, home, 13 públicas y 22 admin.
- `CHANGELOG.md` actualizado con el bloque Aqua.
- Tag `v2.1.0-aqua`.

### Garantías

- **Cero impacto en lógica.** Solo CSS, HTML estructural mínimo y
  configuración Chart.js/Leaflet. Firebase Auth, Firestore rules,
  Storage rules, motor de salud F18, importador F17, alertas, RBAC,
  audit log, PWA: **intactos**.
- **Reversibilidad por fase.** 10 commits atómicos
  (`6ee0ae3 → e886612`).
- **Performance.** `backdrop-filter` activo solo en superficies
  visibles; `will-change` en hover/scroll. Fallback `@supports not
  (backdrop-filter)` con bg `rgba(255,255,255,.92)` plano.
- **Accesibilidad.** Contraste WCAG AA, skip-link, `:focus-visible`
  con outline brand, sr-only conservados, `prefers-reduced-motion`
  respeta animaciones.
- **Sin emojis** en UI ni copy (regla del AQUA_GUIDE).

### Adiciones nuevas
- Sidebar lateral fijo 240px en todas las páginas internas.
- Búsqueda global ⌘K en topbar (placeholder, lógica futura).
- Partículas eléctricas animadas (sutiles, 8–18 puntos).
- SVG técnico de transformador como fondo a la derecha.
- Avatar con iniciales del usuario en topbar + role-chip dinámico.

### Lo que NO cambió
- Functions, rules, indexes, schema, motor de salud, importador,
  RBAC, audit log: idénticos a v2.0.8.
- 282 tests Node siguen pasando sin modificar.
- Estructura de archivos /assets/js/data, /assets/js/domain, /tests
  no se tocó.

### Comandos de despliegue
- **GitHub Pages:** auto-deploy via `pages.yml` al hacer merge a `main`.
- **Sin deploy de Firebase requerido** (no tocan rules/indexes/
  storage/functions).

---

## v3.0.0 · 2026-04 · UX v3 + Cloud Functions activas

Evolución mayor con reestructuración de UX y activación de la primera
Cloud Function en producción.

### Nuevo sistema de diseño (UX v3)
- Tokens CSS corporativos en `assets/css/theme.css` (Space Grotesk +
  Inter + JetBrains Mono, paleta azul eléctrico + teal, glass morphism,
  aurora gradient sutil).
- Navegación unificada con 2 desplegables (`Más ▾` y `Admin ▾`) en lugar
  de 3 universos inconsistentes. Componente ESM en `assets/js/ui/nav.js`.
- `home.html` redibujado como dashboard operativo (hero + KPIs con
  sparklines + alertas críticas + Top 5 PI + feed + accesos rápidos).
- Páginas estáticas (about, cobertura, normativa, contacto) reescritas
  con tono corporativo, sin referencias a "fases" / "v1.0.0".
- `compat.css` para que las 15 páginas admin secundarias hereden el look
  v3 sin reescribir su HTML.
- `admin/index.html` reducido a redirect → `home.html`. Se retira el
  panel admin separado.
- Dashboard ejecutivo, Matriz de Riesgo y KPIs rediseñados con cards v3.

### Fixes críticos
- Splash de verificación de sesión + failsafe 7.5 s + escape valve
  "Volver al login" tras 2 s.
- Eliminado el bucle infinito MutationObserver + Lucide que congelaba
  el browser (`window.sgmRefreshIcons()` debounced).
- Firebase SDK `10.13.0 → 10.14.1`: silencia warnings "heartbeats
  undefined" (bug conocido del SDK).
- Consolida 4 suscripciones Firestore duplicadas en home a 2.
- Service Worker bump `sgm-v2-0-8 → sgm-v3-1-0` para invalidar cache.

### Cloud Functions
- `firebase.json` declara sección `functions` con runtime `nodejs22`.
- `functions/prepare-deploy.mjs` sincroniza `assets/js/domain/` →
  `functions/domain/` antes del deploy (predeploy hook).
- Refactor `functions/index.js` a Firebase Extension "Trigger Email"
  vía colección `/mail` (100% Google, sin Resend/Secret Manager).
- Dependencias actualizadas: `firebase-admin ^13`, `firebase-functions ^6`.
- ✅ **`onMuestraCreate` deployado en producción** (southamerica-east1).
- Cleanup policy Artifact Registry: 7 días de retención.

### Documentación nueva
- `docs/OPERACIONES.md §0` — **Protocolo de deploys**: regla
  permanente de avisar al director qué hay que deployar manualmente
  cada vez que se modifican rules/indexes/storage/functions.
- `docs/DEPLOY-FUNCTIONS.md` reescrito con flujo Gmail + Extension
  (etapa 1 sin email, etapa 2 opcional con email).
- `CLAUDE.md §0.1.1` — regla obligatoria para Claude de avisar
  en el mismo turno cuando haga cambios que requieran deploy Firebase.

### Pendiente
- `cronAlertasDiarias` — requiere instalar Firebase Extension
  "Trigger Email from Firestore" con Gmail App Password (documentado
  en `docs/DEPLOY-FUNCTIONS.md §2`).

## v2.0.8 · 2026-04
- Audit log wired en `documentos.js` (subir/actualizar/eliminar) — cierre del trail en los 7 data layers de mutación.
- `assets/js/ui-helpers.js` compartido (bucketColor · escHtml · fmtTs). Elimina duplicados en inventario admin/público.
- `admin/demo-seed.html` — pobla 6 TX ficticios cubriendo los 5 buckets + fin_vida_util_papel, 3 muestras DGA y 2 órdenes. Idempotente. Cada TX con `salud_actual` calculado en vivo por el motor F18.

## v2.0.7 · 2026-04
- Audit wired en `ordenes.js` (crear/actualizar/eliminar + `cambiar_estado_orden`), `importar.js` (`importar_excel`), `umbrales_salud.js` (`cambiar_umbrales`).
- `pages/ordenes.html` upgrade v2: añade columnas macroactividad_codigo, contrato_codigo, aliado_ejecutor; estado muestra `estado_v2` del workflow F29.

## v2.0.6 · 2026-04
- `docs/DEPLOY-FUNCTIONS.md` — guía completa de despliegue F32 (firebase login, secret RESEND_API_KEY, npm install + deploy, costos <2 USD/mes, rollback).
- `admin/index.html` añade asistente "PUESTA EN MARCHA v2" con 7 pasos enlazados al final del panel.
- Labels de notificaciones alineados: "cron F32 · Cloud Functions + Resend" (antes "preparación F12").

## v2.0.5 · 2026-04
- KPIs saludV2 visibles en `pages/kpis.html` y `admin/kpis.html` (HI promedio · vida remanente · régimen especial · distribución por bucket con chart §A9.7).
- `kpis-render.js` añade `renderSaludV2()` y registro de canvas `chBucket`.

## v2.0.4 · 2026-04
- `pages/inventario.html` vista pública con columnas Tipo / Zona / HI · Bucket.
- `firestore.rules` valida `estado_v2` en create/update de órdenes (11 valores del workflow F29).
- 3 nuevos índices: `ordenes(estado_v2+codigo)`, `ordenes(contratoId+codigo)`, `ordenes(macroactividadId+codigo)`.
- 3 tests nuevos del handler puro `onMuestraCreate`.

## v2.0.3 · 2026-04
- `admin/inventario.html` + `admin-inventario.js` upgrade v2: tabla con 9 columnas incluye HI/bucket/vida remanente; modal con sección "Identificación v2" (tipo_activo / UUCC / grupo / zona).
- `admin/ordenes.html` + `admin-ordenes.js` upgrade v2: selects de macroactividad, contrato, causantes multi, aliado ejecutor, estado_v2 (11 estados).
- `data/transformadores.js` wired con `auditar()` en crear/actualizar/eliminar con diff de campos clave.
- `functions/package.json` + `functions/index.js` refactor para ser deployable real (firebase-admin v12, firebase-functions v5, resend v3, secret RESEND_API_KEY).
- `tests/integracion_e2e.test.js` — 3 escenarios E2E del dominio (TX crítico → propuesta · FUR aprobado → bloqueo · TX joven sano).

## v2.0.2 · 2026-04
- `admin/fallados.html` — UI RCA post-mortem (5 Porqués · Ishikawa 6M · FMEA con RPN dinámico).
- `admin/auditoria.html` + `data/auditoria.js` — visor de bitácora F35.
- Wiring de `auditar()` en `data/usuarios.js` y `data/monitoreo_fur.js`.
- RBAC F28: `data/usuarios.js` acepta los 6 roles oficiales + `permisos_extra[]`, `zonas[]`, `contratos[]`.
- `admin/contramuestras.html` — UI de seguimiento reforzado (muestras tomadas / pendientes / vencidas).

## v2.0.1 · 2026-04
- `admin/propuestas-fur.html` — cola de juicio experto §A9.2 con 3 decisiones (aprobar reemplazo / aprobar OTC / rechazar).
- `admin/plan-inversion.html` — ranking PI con scoring multicriterio + export XLSX.
- `admin/desempeno-aliados.html` — score 0–100 por aliado con desviación de costo, reincidencias, tiempo medio.
- README.md reflejando cierre v2.0.0.

## v2.0.0 · 2026-04 · **Cierre del plan MO.00418**

22 microfases F16→F37 derivadas del prompt maestro v2.2.

- **F16** · Schema v2 con secciones (identificacion, ubicacion, placa, electrico, mecanico, refrigeracion, protecciones, fabricacion, servicio) + `salud_actual` + `estados_especiales[]`. Sanitizador puro + proyección v1 retrocompat. Rules v2 con helpers + 3 subcolecciones append-only.
- **F17** · Importador Excel → Firestore con recálculo HI oficial (descarta columna CONDICION del Excel por §D1-D17). Log en `/importaciones` con reporte de discrepancias.
- **F18** · Motor de Salud (7 calificadores + HI ponderado Tabla 10 + overrides §A5/§A9 + Duval/Rogers/Doernenburg + IEEE C57.91 + monitoreo intensivo C₂H₂ + juicio experto FUR).
- **F19** · Muestras DGA/ADFQ/FUR time-series con contexto §A9.6 obligatorio.
- **F20** · Subestaciones UI dedicada.
- **F21** · 8 contratos macro con control presupuestario (vigente/suspendido/finalizado/en_liquidacion).
- **F22** · Catálogos §A7 (31 subactividades · 7 macroactividades · 12 causantes).
- **F23** · Refactor Órdenes v2 con FKs catálogo + workflow de 11 estados.
- **F24** · TPT/Respaldo (IEEE C57.91 + selección óptima por zona/HI).
- **F25** · Fallados + RCA (5 Porqués · Ishikawa · FMEA con RPN).
- **F26** · Contramuestras + Monitoreo Intensivo + Propuestas FUR (A9.1 + A9.2).
- **F27** · Dashboard ejecutivo por rol con 6 KPIs + matriz 5×5 + Top-10 PI.
- **F28** · RBAC granular (6 roles + ámbito geográfico zonas[]).
- **F29** · Workflow aprobaciones + estados especiales de activo (OTC §A9.3).
- **F30** · Plan de Inversión con scoring multicriterio (HI 40% + criticidad 25% + vida 15% + costo_inv 10% + fallas 10%).
- **F31** · Reportes PDF/XLSX (ficha técnica · cierre orden · reporte mensual RAM).
- **F32** · Cloud Functions stubs (onMuestraCreate + cronAlertasDiarias).
- **F33** · Desempeño aliados con score 0-100.
- **F34** · PWA + service worker + manifest.
- **F35** · Audit log global.
- **F36** · Matriz Criticidad × Salud (Tabla 11 con §A9.9).
- **F37** · Motor de Estrategias por Condición (catálogo §A7).

- **Tests:** 234 unitarios al cierre del plan (escalan a 275 con pulido).
- **Stack operativo:** 14 UIs admin + 4 páginas públicas + 6 módulos de dominio puro + 9 data layers + rules + índices.
- **Fuente canónica:** MO.00418.DE-GAC-AX.01 Ed. 02 (Tabla 10 fuente única de pesos HI).

## v1.0.0 · 2026-04
Plataforma base F0-F15 (pre-evolución MO.00418). Ver `CLAUDE.md` §5 para detalle.
