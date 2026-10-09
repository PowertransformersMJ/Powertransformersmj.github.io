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
- **CRG del MO.00418 §A3.4** (> 60/65/75/90 %): `umbrales_salud_baseline.js` (`crg`). La cifra de CARGABILIDAD es el
  dato OFICIAL de Planificación AT y tiene prioridad (`calcularCalifCRG`, decisión del Ingeniero 2026-07-27, `99 §57.2 c`).
  **CRG 5 ⇒ HI ≥ 4** (override §A5, MO.00418 §4.1.3) → `51 §1`.
- **Cortes 80/95/100 % del tablero viejo** `seguimiento-cargabilidad` (`cargabilidad_config.js`): **sin fuente
  normativa**; no mezclarlos con la CRG.

## 2. La cifra medida por SCADA (`99 §122.2`)
- Corriente horaria de la fase más cargada (≥ 2 fases válidas) → **p99 del periodo ÷ ampacidad del devanado**
  (`electrico.corriente_nominal_*_a`). Horas > 3 × ampacidad = escala imposible, fuera. Equipo = máximo de sus
  devanados: **NUNCA se suman niveles**. Calibrada contra la carga oficial 2025: mediana del cociente 0,993.
- **Firme / provisional**: firme solo si se cumple TODO: homologación automática (sin avisos que la frenen) o confirmada por el Ingeniero —y confirmada si lo que se mide es un circuito—, ampacidad en cada devanado, se mide el devanado que lleva la carga, cobertura ≥ 50 %, ≥ 72 h válidas, las 3 fases en la mayoría de las horas (con solo 2 en más del 50 % es provisional, `§125.2`), sin escala sospechosa y sin mes del rango sin leer (`firmeza` en `scada_carga_kpis.js`); la provisional va en gris con su motivo.
- Ventana del mes = las horas que el SCADA ROTULA en él (`ventanaDeMes`). Gotchas → L-113 (`30`), L-117 (`36`).
- **Periodo de varios meses** (`99 §159`): su cifra es el p99 de TODAS sus horas (exacto con las 90 más altas de cada mes),
  NUNCA el promedio ni la mediana de los p99 mensuales (subestiman ~10–14 pts, hasta 37) ni el peor mes (sobrestima ~8).
- Las horas del SCADA se leen en **hora de Colombia, UTC−5 fijo** (sin horario de verano): calendario, lista y curvas no dependen de la zona del computador (`domain/scada_carga_fecha.js`, `99 §122`).
- Homologación SCADA ↔ transformador, valores tope y escala ×10 → `99 §122`, `§125`; bóveda `2026-10-01-parametros-scada`.

## 3. Ampacidad
- Es la de **ventiladores en servicio (ONAF)**, confirmado por el Ingeniero (`99 §127.1`). Si la refrigeración falla,
  la ampacidad real es menor y la cifra subestima: hoy nada lo cruza («refrigeración deficiente» sin señal → CF-27).
  Hoy son **27 equipos ONAF con ventilación obsoleta** (dato del diseño de `§122`, bóveda `2026-09-30-cargabilidad-scada/diseno-v2.md`; riesgo anotado en `99 §127.8`): en ellos la cifra medida y el nivel del panel DGA pueden quedarse cortos.
- Erratas ×10 conocidas en la ampacidad: hay que dividir el PAR (ampacidad y carga), no la ampacidad sola (TODO-54).
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
