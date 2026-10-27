# 🌡️ 53 — CARGA Y TÉRMICA DEL TRANSFORMADOR (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO` y nombrado en `CLAUDE.md §0`. Nacido 2026-10-02 (`99 §137`).
> **Dueño del CRITERIO** del esfuerzo que la operación le impone al equipo: cargabilidad oficial (CRG) y medida por
> SCADA, ampacidad por devanado, sobrecarga sostenida, modelo térmico IEC 60076-7 (punto caliente ESTIMADO,
> envejecimiento, límites), proyección «con más carga» y el puente DGA × carga. **Dueño de la regla de los 6 °C.**
> **Dónde vive el código** → `22` (fila Cargabilidad SCADA). **Los valores vigentes** los manda el archivo:constante
> citado; aquí vive el porqué, la fuente y el estado de validación.
>
> Fronteras: las zonas del triángulo de Duval, las bandas DGA y el papel → `52` · el índice de salud → `51` ·
> la refrigeración como subsistema del equipo → `50` (aquí solo su efecto: la ampacidad supone ONAF en servicio).

---

## 1. Dos escalas de carga que NO son la misma
- **CRG del MO.00418 §A3.4** (Ed. 02: AX.01 §4.1.3, Tabla 7) (> 60/65/75/90 %); se NOMBRA con la escala de condición Muy Bueno … Muy Pobre (`99 §160`): `umbrales_salud_baseline.js` (`crg`). La cifra de CARGABILIDAD es el
  dato OFICIAL de Planificación AT y tiene prioridad (`calcularCalifCRG`, decisión del Ingeniero 2026-07-27, `99 §57.2 c`).
  **CRG 5 ⇒ HI ≥ 4** (override §A5, MO.00418 §4.1.3) → `51 §1`.
- Las palabras de la CRG son SOLO las de la escala de condición (`CRG_CHIP` = `CONDICIONES`, candado
  `tests/scada_carga_crg_nombres.test.js`). NO renombrar lo que solo comparte palabras: prioridad de la ficha y de órdenes,
  severidad de alertas, criticidad por usuarios («Moderada», MO §4.2.1 → `51 §6`) y nivel de atención DGA × carga
  (`99 §160.3`). Ofrecido sin respuesta: MAYÚSCULAS y el color de «Medio» (naranja en CRG, amarillo en salud) → `§160.7`; prefijo «CRG» en los botones del mapa y «Carga normal» del panel DGA → `§160.8`.
- **Cortes 80/95/100 % del tablero viejo** `seguimiento-cargabilidad` (`cargabilidad_config.js`): **sin fuente
  normativa**; no mezclarlos con la CRG.

## 2. La cifra medida por SCADA (`99 §122.2`)
- Corriente horaria de la fase más cargada (≥ 2 fases válidas) → **p99 del periodo ÷ ampacidad del devanado**
  (`electrico.corriente_nominal_*_a`). Horas > 3 × ampacidad = escala imposible, fuera. Equipo = máximo de sus
  devanados: **NUNCA se suman niveles**. Calibrada contra la carga oficial 2025: mediana del cociente 0,993.
- **Firme / provisional**: firme solo si se cumple TODO: homologación automática (sin avisos que la frenen) o confirmada por el Ingeniero —y confirmada si lo que se mide es un circuito—, ampacidad en cada devanado, se mide el devanado que lleva la carga, cobertura ≥ 50 %, ≥ 72 h válidas, las 3 fases en la mayoría de las horas (con solo 2 en más del 50 % es provisional, `§125.2`), sin escala sospechosa y sin mes del rango sin leer (`firmeza` en `scada_carga_kpis.js`); la provisional va en gris con su motivo.
- Ventana del mes = las horas que el SCADA ROTULA en él (`ventanaDeMes`). Gotchas → L-113 (`37`), L-117 (`36`).
- **Mes a mes y acumulada** (`99 §168`, detalle de cada equipo): mes = «Un mes»; acumulada = «Varios meses» desde el primer mes con
  datos (12 meses de calendario). **«A la fecha» = la cargabilidad oficial** al revisar cada equipo (decisión suya 2026-10-23).
- **Cada devanado frente a su PLACA** (`99 §169`): límite = la mayor etapa de la placa (ONAF; ONAN si la placa solo trae una;
  ONAF II si tres) a la tensión de placa de la CONEXIÓN del equipo; también el % de ONAN (sin ventiladores). La cifra oficial
  sigue con la ampacidad de la plataforma; si no es la de placa, se avisa y se corrige en la revisión uno a uno (TODO-54).
  La corriente límite es la IMPRESA en la placa cuando la trae (se rotula «impresa» o «calculada», `99 §170`); un
  terciario de COMPENSACIÓN no tiene límite de carga; una lectura de plano o de equipo «futuro» se advierte.
  Con la ventilación OBSOLETA el límite usable es la ONAN, no la ONAF (Corozal y Chiriguaná: ~120–135 % de su ONAN, `§169.9`).
- **Periodo de varios meses** (`99 §159`): su cifra es el p99 de TODAS sus horas (exacto con las 90 más altas de cada mes),
  NUNCA el promedio ni la mediana de los p99 mensuales (subestiman ~10–14 pts, hasta 37) ni el peor mes (sobrestima ~8).
- **Periodo e historia** (`§159`, `scada_carga_periodo.js`): «Supera su capacidad desde» = la PRIMERA ventana de 2 h
  seguidas > 100 % (la sostenida del §4; la hora suelta anterior, como nota). Los meses PROVISIONALES cuentan igual que
  los firmes y se rotulan: decisión del Ingeniero, NO la recomendada (no «corregirla» excluyéndolos). Cobertura: no cuentan
  un mes que el parque no cargó ni los días aún no cargados de un mes incompleto (solo en varios meses); un mes que vino
  para el parque y no para el equipo SÍ cuenta (hueco suyo).
- **Mes incompleto** (`§158.12`): solo, su cobertura se mide contra el mes entero (7 de 31 días ⇒ máx. 22,6 % ⇒
  provisional; firme hacia los 16–17 días). Es «completo» con ≥ 90 % de sus días (`TIEMPO.mesCompletoMin`); la página abre
  por defecto el último mes completo (`mesPorDefecto`).
- Las horas del SCADA se leen en **hora de Colombia, UTC−5 fijo** (sin horario de verano): calendario, lista y curvas no dependen de la zona del computador (`domain/scada_carga_fecha.js`, `99 §122`).
- Homologación SCADA ↔ transformador, valores tope y escala ×10 → `99 §122`, `§125`; bóveda `2026-10-01-parametros-scada`. Sin medición
  (motivo con la causa, hueco del exporte de 43 S/E desde el 1–2 sep, homologación v3, relevo de estación) → `§158`.
  Insumos vigentes (homologación v3 con su hoja «Relevos de estación», paquetes) → bóveda `2026-10-08-scada-sin-medicion`
  (`crudos/insumos/`) y memoria del proyecto; nunca al repo. Cómo cargar un mes → `60 §W-13` (paso 8).
- **Sin medición: el motivo dice la causa** (`motivoSinHoras`, `scada_carga_vista.js`; `§158.2`, `.10`): «no vino en el
  exporte del SCADA» · «el punto SCADA aún no aparecía en el exporte» · «sin corriente válida (sí llega la potencia)» ·
  «sin carga (fuera de servicio o en reserva)» (≥ `CALCULO.horasMinSinCarga` = 24 h en cero con tensión) · «medida en
  cero, congelada o marcada no válida por el SCADA». Deciden solo los niveles CON devanado. Antes de pedir datos, mirar si
  el punto vino en el exporte (sep-2026: 44 de 77 sí se medían; falló el exporte o el nombre, `§158.1`).
- **El SCADA renombra estaciones**: el punto conserva su historial y el relevo se declara en la hoja «Relevos de
  estación» del Excel de homologación (`§158.10`); sin él, el punto queda en la estación vieja que el SCADA ya no renueva
  (Sampués solo tiene horas válidas gracias al relevo, `§158.12`). La cifra usa SOLO la corriente: P/Q mal escaladas
  (~×1000 en 4 puntos, `§158.12`) solo dañan la curva de potencia.
- **Medida propia mal escalada → SUMA DE CIRCUITOS** (`99 §182`): si la medida de un nivel del transformador llega mal escalada en
  el SCADA y su barra la alimenta SOLO ese transformador, la homologación puede medir ese nivel con la suma, hora por hora y fase
  por fase, de los circuitos de la barra (decisión suya con nota y casilla «barra propia»). NO es «sumar niveles»: es la misma
  corriente medida aguas abajo. Se guarda aparte, rotulada «suma de circuitos»; la medida propia no se pisa; cada mes se
  contrasta con las fases sanas del transformador (±10 %; si no cuadra → provisional). Sin suma válida, el nivel no da cifra.

## 3. Ampacidad
- Es la de **ventiladores en servicio (ONAF)**, confirmado por el Ingeniero (`99 §127.1`). Si la refrigeración falla,
  la ampacidad real es menor y la cifra subestima: hoy nada lo cruza («refrigeración deficiente» sin señal → CF-27).
  Hoy son **27 equipos ONAF con ventilación obsoleta** (dato del diseño de `§122`, bóveda `2026-09-30-cargabilidad-scada/diseno-v2.md`; riesgo anotado en `99 §127.8`): en ellos la cifra medida y el nivel del panel DGA pueden quedarse cortos.
- Erratas ×10 conocidas en la ampacidad: hay que dividir el PAR (ampacidad y carga), no la ampacidad sola (TODO-54).
- Vistas desde el SCADA, solo informativas y sin tocar: posibles erratas en la cifra OFICIAL de Salud de Activos
  (Ariguaní; El Carmen y Sampués, corrientes copiadas entre T1 y T2 —Sampués NO: iban en paralelo y Salud da a cada uno la mitad, `99 §188.8`—; Membrillal T1) y un circuito cuya limpieza descartó casi todo agosto → síntesis
  de la bóveda `2026-10-08-scada-sin-medicion` y TODO-54.
- **Devanados de placa por transformador** (pedido del Ingeniero 2026-10-22; BORRADOR hasta su «procede»): la lista y el detalle muestran
  cada devanado con tensión, ampacidad y **potencia CALCULADA** = √3 × kV × A (no hay campo de potencia por devanado; monofásico:
  kV × A, o kV × A ÷ √3 si cuadra mejor con la placa: devanado entre fase y neutro). La carga de un devanado se publica SOLO si el
  equipo tiene cifra (circuito sin confirmar, excluida o sin homologación no dan número, tampoco sus devanados). Aviso si un devanado
  supera 1,5 × la placa, con su causa probable: ≈ ×10 → errata (corregir ampacidad y carga juntas, TODO-54); ≈ √3 o 3 → parece
  monofásico (confirmar fases); otra → la ampacidad parece de otra potencia (placa cambiada, p. ej. Casacará). `scada_carga_devanados.js`.
- Al corregir la POTENCIA de placa, corregir también la ampacidad y la carga medida que se derivó de ella: Casacará T1 quedó con la ampacidad de 5 MVA tras pasar a 2 MVA (`99 §158.11`). Su Excel de Salud de Activos aún trae la vieja: no reimportarlo sin corregirlo.

## 4. Sobrecarga sostenida
- **≥ 2 h seguidas > 100 %** (criterio del Ingeniero, `§122.2`) · fila severa **≥ 2 h > 130 % (1,3 p.u.)**: el MENOR
  tope de corriente de IEC 60076-7:2005 Tabla 4, criterio conservador del área, solo con cifra FIRME (`§127.2`).
  La edición 2018 (§7.2, Tabla 3, leída en `§132`) mantiene 1,3 p.u. para unidades GRANDES y da 1,5 p.u. a las medianas en carga cíclica normal y en emergencia larga: el 130 % sigue siendo el tope más conservador de la norma vigente (bóveda `2026-10-02-duval-proyeccion`, crudo del paso 5).
- La marca de la LISTA (resumen en bruto) decide solo donde se probó exacta; si no, lee la curva del mes con la serie
  limpia (`§129`, L-119). El «Máximo sostenido 2 h» del detalle sale de la serie limpia (`§130`).

## 5. Modelo térmico IEC 60076-7:2018 — punto caliente ESTIMADO (`99 §132`)
- `domain/scada_carga_termico.js` (`TERMICO_ONAF`, `simularTermico`): ecuaciones en diferencias (18)–(23) de §8.2.3,
  paso de 1 min, sobre la corriente horaria medida. Constantes ONAF de la Tabla 4 y del ejemplo K.1 (Δθor 52 K,
  **Δθhr 26 K** —no 33,8—, R 6): a carga nominal y 20 °C de ambiente da 20 + 52 + 26 = **98 °C**.
- Envejecimiento relativo V = 2^((θh − 98)/6) (Ec. 2, papel NO mejorado). Límites Tabla 2 (120/140/160 °C) y Tabla 3
  (1,8 p.u.); riesgo de burbujas sobre 140 °C (§5.3).
- **Es ESTIMADO, no medido**: el SCADA trae I, U, P, Q y ninguna temperatura.
- Fuente: leída en una copia de tercero cotejada con la muestra oficial de iTeh (`§132.4`).
- **Supuestos pendientes del Ingeniero** (TODO-69, `§132.8`): ambiente 30 °C, papel no mejorado, constantes típicas
  en vez de las de los protocolos de calentamiento, y huecos del SCADA ≤ 2 h rellenados (los más largos quedan fuera).

## 6. Regla de los 6 °C (dueña única)
- Papel NO mejorado: referencia **98 °C**; cada **6 K** de más duplica la velocidad de envejecimiento (IEC 60076-7,
  la misma V del §5). Papel termomejorado: referencia 110 °C y paso de unos 7 K.
- Conciliación: la skill `transformadores-potencia/gestion-vida-activo` dice «Montsinger 6–8 °C» (regla clásica de
  IEEE C57.91); la cifra que usa la plataforma es la de IEC 60076-7 (6 K). Por actualizar la skill.
- El argumento de negocio y las 4 palancas de mantenimiento (radiadores limpios, ventilación en servicio, aceite en
  buen estado, carga) → memoria `reference_temperatura_vida_util_tx`.

## 7. ⚠️ Riesgo de veracidad abierto: `sobrecarga_admisible.js`
- Dice resumir «IEEE C57.91 Tabla 6» (tiempo admisible de emergencia) con un punto caliente propio; **NO está
  cotejado** contra la norma (bóveda `2026-10-01-dga-carga/SINTESIS.md`). Lo usan la ventana de detalle de
  Cargabilidad (`cargabilidad_detalle.js`) y el respaldo TPT (`tpt_respaldo.js`). → TODO-73.

## 8. «Con más carga» — qué se proyecta y qué NO
- `domain/scada_carga_proyeccion.js`: márgenes por factor f y escenarios; las pérdidas que dependen de la corriente crecen con f² (las del núcleo no).
- Ritmo de cada gas (`ritmoGases`), nunca ppm (con una muestra sin fecha no hay ritmo de hoy): falla térmica ×1 (núcleo)
  a ≥ ×f² (conexión o contacto; la ubicación es un SUPUESTO) · descargas ×1 · **CO/CO₂ en rango**: Arrhenius del
  CO+CO₂ en papel Kraft (≈ 44,4 kJ/mol, patente US 6 276 222) a la temperatura media del devanado, hasta V en el punto
  caliente — ninguna norma da su ritmo.
- En el triángulo: **solo DIRECCIÓN** hacia el etileno (Duval 2002, Tabla II), en un segundo triángulo junto al de hoy;
  nunca una posición calculada (`§131.5`, `§134`). Las fronteras del triángulo → `52 §3`.

## 9. Puente DGA × carga (`99 §127`, `§133`)
- Nivel de atención = fila de carga (R1 CRG 4 · R2 CRG 5 · R3 ≥ 2 h > 100 % · R4 ≥ 2 h > 130 %) × columna de gases
  (A sin DGA · B 1–2 · C 3 · D 4–5 · E C₂H₂ = 5). Sin medición SCADA no hay nivel. Catálogo de 15 adversidades y 17
  acciones con norma y cláusula: **BORRADOR** (`APROBADO = false`), sin revisión externa (TODO-69). Textos con/sin ppm:
  `scada_carga_dga_textos_ppm.js` (el catálogo no se edita, L-102). Lección: L-118.
- ⚠️ **Dos rótulos «Borrador»**: el del panel DGA lo apaga `APROBADO` (`domain/scada_carga_dga_textos.js:13`); el del triángulo de Duval está escrito fijo en `ui/cargabilidad-scada/panel-duval.js:274` y no lo mira. Cuando él apruebe los textos, se quitan los dos o se decide panel por panel.

## 10. Pendientes (solo punteros)
- TODO-69 (supuestos del §5, textos DGA, 0,5 pu) · TODO-54 (erratas de ampacidad) · TODO-71 (detalle de la tabla vieja)
  · TODO-73 (`sobrecarga_admisible.js`) · CF-27 (refrigeración deficiente).
- Skill por actualizar con fuente web verificada en la misma sesión: `gestion-vida-activo` (método IEC 60076-7:2018 y la
  conciliación de los 6 °C; cotejar C57.91). No crear una skill nueva de térmica: duplicaría este §5.
