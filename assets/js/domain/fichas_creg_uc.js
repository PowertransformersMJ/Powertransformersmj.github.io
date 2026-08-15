// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE UNIDADES CONSTRUCTIVAS · CREG 015 de 2018 — dominio puro
// ───────────────────────────────────────────────────────────────────────────
// Transformadores de potencia: bandas de capacidad, descriptores y valores de
// reposición reconocidos por la CREG. Es INFORMACIÓN NORMATIVA PÚBLICA (la
// resolución y sus tablas), no información de ningún cliente.
//
// QUÉ HAY AQUÍ
//   · `CREG_UC.T16` → **Tabla 52** · niveles de tensión 4 y 3.
//   · `CREG_UC.T15` → **Tabla 51** · conexión al STN (niveles 5 y 6).
//   Las llaves `T16`/`T15` son el nombre interno del artículo de la resolución
//   (Tabla 16 y Tabla 15 del articulado); el rótulo que ve el usuario es el de
//   `titulo`/`tabla`: **Tabla 52** y **Tabla 51**. Se conservan ambos para no
//   romper trazabilidad con la fuente.
//
// ⚠️ QUÉ VALOR ES EL VIGENTE PARA LA FICHA
//   Cada fila trae DOS juegos de cifras:
//     · `costo` / `unit`         → **pesos de DICIEMBRE DE 2007** (Tablas 51 y
//                                   52). **ESTOS SON LOS QUE USA LA FICHA
//                                   TÉCNICA DE PLANIFICACIÓN PE.02081.**
//     · `costo2017` / `unit2017` → pesos de diciembre de 2017 (Tablas 15 y 16).
//                                   Informativos: NO alimentan el presupuesto.
//   `costo` = costo de instalación de la UC.  `unit` = valor unitario $/MVA.
//   El presupuesto de la ficha se arma como:  costo + (MVA × unit).
//   `vig` indica de qué corte son realmente `costo`/`unit` en esa fila: "2007"
//   en general, y "2017" en las filas de nivel 6, que solo existen en el corte
//   de 2017 (ahí `costo` === `costo2017` por construcción de la fuente).
//   Los montos son CADENAS con separador de miles colombiano ("152.592.000");
//   use `montoCOP()` para pasarlos a número.
//
// RELACIÓN CON OTROS NODOS DEL DOMINIO
//   `domain/schema.js` ya valida la SINTAXIS y la vigencia regulatoria de un
//   código UUCC (`esUUCCValida`, `esUUCCRegulada`, CREG 085/2018, patrón
//   /^N[345]T\d{1,2}$/). Este módulo es complementario: aporta la BANDA de
//   capacidad, el descriptor y el valor de reposición. No duplica ni sustituye
//   aquellas funciones — si necesita validar un código, use las de `schema.js`.
//   Nota: los códigos N6Tx de la Tabla 51 quedan FUERA de ese patrón; conviven
//   aquí porque la tabla los cataloga, pero no son UUCC reguladas N3/N4/N5.
//
// PROCEDENCIA
//   Portado literalmente desde la constante `CREG` y la función `clasificarJS`
//   del módulo estático de Fichas Técnicas (v22). El criterio de clasificación
//   NO se modificó: mismos umbrales, mismos pasos y mismas notas, para que la
//   página reproduzca exactamente la evaluación con la que se auditó la flota.
//
// Funciones puras, sin DOM ni Firestore. Testeable con `node --test`.
// ═══════════════════════════════════════════════════════════════════════════

/** Congela en profundidad: el catálogo normativo es de solo lectura. */
function congelar(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congelar(v);
  }
  return o;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATÁLOGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Tablas 52 (T16) y 51 (T15) de la CREG 015/2018, tal como las publica la
 * resolución. Cada fila:
 *   uc        código de la unidad constructiva (p. ej. "N4T4")
 *   nivel     nivel de tensión del lado de alta ("N3".."N6")
 *   dev       "bi" bidevanado · "tri" tridevanado · "auto" autotransformador
 *   reg       regulación del descriptor: "OLTC" (con cambiador en carga)
 *             o "NLTC" (sin cambiador en carga)
 *   cap       texto de la banda de capacidad, como aparece en la tabla
 *   min/max   límites de la banda en MVA (max === null ⇒ sin tope superior)
 *   costo     costo de instalación · pesos de DIC-2007 (vigente para la ficha)
 *   unit      valor unitario $/MVA · pesos de DIC-2007 (vigente para la ficha)
 *   desc      descriptor completo de la UC en la resolución
 *   costo2017 costo de instalación · pesos de DIC-2017 (informativo)
 *   unit2017  valor unitario $/MVA · pesos de DIC-2017 (informativo)
 *   vig       corte al que pertenecen `costo`/`unit` en esa fila
 */
export const CREG_UC = congelar({
  T16: {
    titulo: "Tabla 52 — UC de transformadores de potencia de niveles de tensión 4 y 3 · pesos de diciembre de 2007",
    fuente: "CREG 015 de 2018, Tabla 16",
    grupos: [
      {
        sub: "Nivel 4 · Transformador trifásico (bidevanado)",
        key: "N4|bi",
        rows: [
          { uc: "N4T1", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final hasta 5 MVA", min: 0, max: 5, costo: "152.592.000", unit: "95.390.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final hasta 5 MVA", costo2017: "173.802.000", unit2017: "123.704.000", vig: "2007" },
          { uc: "N4T2", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 5 a 10 MVA", min: 5, max: 10, costo: "161.743.000", unit: "74.400.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 5 a 10 MVA", costo2017: "180.170.000", unit2017: "96.484.000", vig: "2007" },
          { uc: "N4T3", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 11 a 15 MVA", min: 11, max: 15, costo: "172.110.000", unit: "64.011.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 11 a 15 MVA", costo2017: "204.477.000", unit2017: "83.010.000", vig: "2007" },
          { uc: "N4T4", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 16 a 20 MVA", min: 16, max: 20, costo: "181.070.000", unit: "57.047.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 16 a 20 MVA", costo2017: "224.880.000", unit2017: "73.979.000", vig: "2007" },
          { uc: "N4T5", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 21 a 30 MVA", min: 21, max: 30, costo: "192.852.000", unit: "49.593.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 21 a 30 MVA", costo2017: "249.450.000", unit2017: "64.312.000", vig: "2007" },
          { uc: "N4T6", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 31 a 40 MVA", min: 31, max: 40, costo: "247.740.000", unit: "42.513.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 31 a 40 MVA", costo2017: "278.964.000", unit2017: "55.131.000", vig: "2007" },
          { uc: "N4T7", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 41 a 50 MVA", min: 41, max: 50, costo: "261.206.000", unit: "37.201.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 41 a 50 MVA", costo2017: "303.583.000", unit2017: "48.243.000", vig: "2007" },
          { uc: "N4T8", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 51 a 60 MVA", min: 51, max: 60, costo: "273.655.000", unit: "32.950.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 51 a 60 MVA", costo2017: "324.690.000", unit2017: "42.730.000", vig: "2007" },
          { uc: "N4T9", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 61 a 80 MVA", min: 61, max: 80, costo: "416.987.000", unit: "29.569.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 61 a 80 MVA", costo2017: "364.204.000", unit2017: "38.345.000", vig: "2007" },
          { uc: "N4T10", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final de 81 a 100 MVA", min: 81, max: 100, costo: "465.610.000", unit: "25.125.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 81 a 100 MVA", costo2017: "394.282.000", unit2017: "32.582.000", vig: "2007" },
          { uc: "N4T11", nivel: "N4", dev: "bi", reg: "OLTC", cap: "Capacidad final mayor a 100 MVA", min: 100, max: null, costo: "470.974.000", unit: "20.350.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final mayor a 100 MVA", costo2017: "424.320.000", unit2017: "26.390.000", vig: "2007" }
        ]
      },
      {
        sub: "Nivel 4 · Transformador tridevanado trifásico",
        key: "N4|tri",
        rows: [
          { uc: "N4T12", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final hasta 5 MVA", min: 0, max: 5, costo: "153.214.000", unit: "107.134.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final hasta 5 MVA", costo2017: "180.047.000", unit2017: "138.933.000", vig: "2007" },
          { uc: "N4T13", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 6 a 10 MVA", min: 6, max: 10, costo: "164.096.000", unit: "86.212.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 6 a 10 MVA", costo2017: "189.604.000", unit2017: "111.801.000", vig: "2007" },
          { uc: "N4T14", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 11 a 20 MVA", min: 11, max: 20, costo: "180.004.000", unit: "72.187.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 11 a 20 MVA", costo2017: "222.286.000", unit2017: "93.613.000", vig: "2007" },
          { uc: "N4T15", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 21 a 30 MVA", min: 21, max: 30, costo: "198.017.000", unit: "59.343.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 21 a 30 MVA", costo2017: "261.229.000", unit2017: "76.956.000", vig: "2007" },
          { uc: "N4T16", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 31 a 40 MVA", min: 31, max: 40, costo: "253.892.000", unit: "50.807.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 31 a 40 MVA", costo2017: "292.425.000", unit2017: "65.887.000", vig: "2007" },
          { uc: "N4T17", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 41 a 50 MVA", min: 41, max: 50, costo: "268.073.000", unit: "44.404.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 41 a 50 MVA", costo2017: "318.360.000", unit2017: "57.583.000", vig: "2007" },
          { uc: "N4T18", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final de 51 a 60 MVA", min: 51, max: 60, costo: "281.030.000", unit: "39.278.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 51 a 60 MVA", costo2017: "340.509.000", unit2017: "50.936.000", vig: "2007" },
          { uc: "N4T19", nivel: "N4", dev: "tri", reg: "OLTC", cap: "Capacidad final más de 60 MVA", min: 60, max: null, costo: "282.338.000", unit: "33.289.000", desc: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final más de 60 MVA", costo2017: "410.540.000", unit2017: "43.170.000", vig: "2007" }
        ]
      },
      {
        sub: "Nivel 3 · Transformador trifásico (bidevanado)",
        key: "N3|bi",
        rows: [
          { uc: "N3T1", nivel: "N3", dev: "bi", reg: "NLTC", cap: "Capacidad final de 0.5 a 2.5 MVA", min: 0.5, max: 2.5, costo: "96.712.000", unit: "53.376.000", desc: "Transformador trifásico (NLTC) lado de alta en el nivel 3 capacidad final de 0.5 a 2.5 MVA", costo2017: "67.602.000", unit2017: "69.219.000", vig: "2007" },
          { uc: "N3T2", nivel: "N3", dev: "bi", reg: "NLTC", cap: "Capacidad final de 2.6 a 6 MVA", min: 2.6, max: 6, costo: "103.303.000", unit: "47.184.000", desc: "Transformador trifásico (NLTC) lado de alta en el nivel 3 capacidad final de 2.6 a 6 MVA", costo2017: "76.962.000", unit2017: "61.188.000", vig: "2007" },
          { uc: "N3T3", nivel: "N3", dev: "bi", reg: "OLTC", cap: "Capacidad final de 6.1 a 10 MVA", min: 6.1, max: 10, costo: "112.806.000", unit: "43.497.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 6.1 a 10 MVA", costo2017: "90.319.000", unit2017: "56.407.000", vig: "2007" },
          { uc: "N3T4", nivel: "N3", dev: "bi", reg: "OLTC", cap: "Capacidad final de 11 a 15 MVA", min: 11, max: 15, costo: "126.108.000", unit: "40.679.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 11 a 15 MVA", costo2017: "106.019.000", unit2017: "52.752.000", vig: "2007" },
          { uc: "N3T5", nivel: "N3", dev: "bi", reg: "OLTC", cap: "Capacidad final de 16 a 20 MVA", min: 16, max: 20, costo: "138.748.000", unit: "38.765.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 16 a 20 MVA", costo2017: "119.530.000", unit2017: "50.271.000", vig: "2007" },
          { uc: "N3T6", nivel: "N3", dev: "bi", reg: "OLTC", cap: "Capacidad final de 21 a 30 MVA", min: 21, max: 30, costo: "157.082.000", unit: "36.717.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 21 a 30 MVA", costo2017: "136.199.000", unit2017: "47.615.000", vig: "2007" },
          { uc: "N3T7", nivel: "N3", dev: "bi", reg: "OLTC", cap: "Capacidad final mayor a 31 MVA", min: 31, max: null, costo: "208.869.000", unit: "34.070.000", desc: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final mayor a 31 MVA", costo2017: "146.130.000", unit2017: "44.182.000", vig: "2007" }
        ]
      }
    ]
  },
  T15: {
    titulo: "Tabla 51 — UC de transformadores de conexión al STN · pesos de diciembre de 2007",
    fuente: "CREG 015 de 2018, Tabla 15",
    grupos: [
      {
        sub: "Conexión al STN · Transformador trifásico (bidevanado)",
        key: "N5|bi",
        rows: [
          { uc: "N5T1", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de hasta 10 MVA", min: 0, max: 10, costo: "161.846.000", unit: "54.795.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de hasta 10 MVA", costo2017: "239.250.000", unit2017: "71.059.000", vig: "2007" },
          { uc: "N5T2", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 11 a 20 MVA", min: 11, max: 20, costo: "174.071.000", unit: "48.568.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 11 a 20 MVA", costo2017: "266.661.000", unit2017: "62.984.000", vig: "2007" },
          { uc: "N5T3", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 21 a 40 MVA", min: 21, max: 40, costo: "234.809.000", unit: "44.500.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 21 a 40 MVA", costo2017: "335.011.000", unit2017: "57.708.000", vig: "2007" },
          { uc: "N5T4", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 41 a 50 MVA", min: 41, max: 50, costo: "254.438.000", unit: "42.096.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 41 a 50 MVA", costo2017: "447.444.000", unit2017: "54.591.000", vig: "2007" },
          { uc: "N5T5", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 51 a 60 MVA", min: 51, max: 60, costo: "267.152.000", unit: "40.902.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 51 a 60 MVA", costo2017: "482.056.000", unit2017: "53.042.000", vig: "2007" },
          { uc: "N5T6", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 61 a 90 MVA", min: 61, max: 90, costo: "414.005.000", unit: "39.052.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 61 a 90 MVA", costo2017: "542.489.000", unit2017: "50.644.000", vig: "2007" },
          { uc: "N5T7", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 91 a 100 MVA", min: 91, max: 100, costo: "438.082.000", unit: "37.640.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 91 a 100 MVA", costo2017: "594.951.000", unit2017: "48.812.000", vig: "2007" },
          { uc: "N5T8", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 101 a 120 MVA", min: 101, max: 120, costo: "455.779.000", unit: "36.763.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 101 a 120 MVA", costo2017: "630.619.000", unit2017: "47.675.000", vig: "2007" },
          { uc: "N5T9", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 121 a 150 MVA", min: 121, max: 150, costo: "484.711.000", unit: "35.538.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 121 a 150 MVA", costo2017: "684.899.000", unit2017: "46.085.000", vig: "2007" },
          { uc: "N5T10", nivel: "N5", dev: "bi", reg: "OLTC", cap: "Capacidad final de 151 a 180 MVA", min: 151, max: 180, costo: "518.654.000", unit: "34.336.000", desc: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 151 a 180 MVA", costo2017: "743.645.000", unit2017: "44.527.000", vig: "2007" }
        ]
      },
      {
        sub: "Conexión al STN · Autotransformador monofásico",
        key: "N5|auto",
        rows: [
          { uc: "N5T11", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final hasta 20 MVA", min: 0, max: 20, costo: "171.525.000", unit: "48.603.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final hasta 20 MVA", costo2017: "331.529.000", unit2017: "63.029.000", vig: "2007" },
          { uc: "N5T12", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 21 a 40 MVA", min: 21, max: 40, costo: "234.549.000", unit: "44.091.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 21 a 40 MVA", costo2017: "379.407.000", unit2017: "57.177.000", vig: "2007" },
          { uc: "N5T13", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 41 a 50 MVA", min: 41, max: 50, costo: "251.540.000", unit: "39.057.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 41 a 50 MVA", costo2017: "436.539.000", unit2017: "50.650.000", vig: "2007" },
          { uc: "N5T14", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 51 a 60 MVA", min: 51, max: 60, costo: "263.494.000", unit: "37.764.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 51 a 60 MVA", costo2017: "469.890.000", unit2017: "48.972.000", vig: "2007" },
          { uc: "N5T15", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 61 a 90 MVA", min: 61, max: 90, costo: "408.773.000", unit: "35.760.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 61 a 90 MVA", costo2017: "527.913.000", unit2017: "46.374.000", vig: "2007" },
          { uc: "N5T16", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 91 a 100 MVA", min: 91, max: 100, costo: "431.218.000", unit: "34.231.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 91 a 100 MVA", costo2017: "578.058.000", unit2017: "44.390.000", vig: "2007" },
          { uc: "N5T17", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 101 a 120 MVA", min: 101, max: 120, costo: "447.662.000", unit: "33.281.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 101 a 120 MVA", costo2017: "612.028.000", unit2017: "43.159.000", vig: "2007" },
          { uc: "N5T18", nivel: "N5", dev: "auto", reg: "OLTC", cap: "Capacidad final de 121 a 150 MVA", min: 121, max: 150, costo: "474.457.000", unit: "31.953.000", desc: "AutoTransformador monofásico (OLTC) de conexión al STN capacidad final de 121 a 150 MVA", costo2017: "663.525.000", unit2017: "41.437.000", vig: "2007" }
        ]
      },
      {
        sub: "Conexión al STN · Transformador tridevanado trifásico",
        key: "N5|tri",
        rows: [
          { uc: "N5T19", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de hasta 20 MVA", min: 0, max: 20, costo: "177.568.000", unit: "77.123.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de hasta 20 MVA", costo2017: "312.012.000", unit2017: "100.014.000", vig: "2007" },
          { uc: "N5T20", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de 21 a 40 MVA", min: 21, max: 40, costo: "243.846.000", unit: "58.716.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 21 a 40 MVA", costo2017: "352.707.000", unit2017: "76.144.000", vig: "2007" },
          { uc: "N5T21", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de 41 a 50 MVA", min: 41, max: 50, costo: "262.103.000", unit: "50.134.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 41 a 50 MVA", costo2017: "466.899.000", unit2017: "65.014.000", vig: "2007" },
          { uc: "N5T22", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de 51 a 60 MVA", min: 51, max: 60, costo: "275.341.000", unit: "47.929.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 51 a 60 MVA", costo2017: "502.829.000", unit2017: "62.154.000", vig: "2007" },
          { uc: "N5T23", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de 61 a 90 MVA", min: 61, max: 90, costo: "422.682.000", unit: "44.513.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 61 a 90 MVA", costo2017: "565.128.000", unit2017: "57.724.000", vig: "2007" },
          { uc: "N5T24", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de 91 a 120 MVA", min: 91, max: 120, costo: "458.270.000", unit: "40.799.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 91 a 120 MVA", costo2017: "643.094.000", unit2017: "52.908.000", vig: "2007" },
          { uc: "N5T25", nivel: "N5", dev: "tri", reg: "OLTC", cap: "Capacidad final de más de 121 MVA", min: 121, max: null, costo: "471.952.000", unit: "38.021.000", desc: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de más de 121 MVA", costo2017: "674.251.000", unit2017: "49.306.000", vig: "2007" }
        ]
      },
      {
        sub: "Conexión al STN 500 kV · Autotransformador monofásico",
        key: "N6|auto",
        rows: [
          { uc: "N6T1", nivel: "N6", dev: "auto", reg: "OLTC", cap: "Capacidad final 50 MVA", min: 50, max: 100, costo: "678.157.000", unit: "25.456.000", desc: "Autotransformador monofásico (OLTC) lado de alta en el 500 kV capacidad final 50 MVA a 100 MVA", costo2017: "678.157.000", unit2017: "25.456.000", vig: "2017" },
          { uc: "N6T2", nivel: "N6", dev: "auto", reg: "OLTC", cap: "Capacidad final 100 MVA", min: 100, max: 150, costo: "899.502.000", unit: "27.300.000", desc: "Autotransformador monofásico (OLTC) lado de alta en el 500 kV capacidad final 100 MVA a 150 MVA", costo2017: "899.502.000", unit2017: "27.300.000", vig: "2017" },
          { uc: "N6T3", nivel: "N6", dev: "auto", reg: "OLTC", cap: "Capacidad final mayor o igual a 150 MVA", min: 150, max: null, costo: "1.265.741.000", unit: "29.741.000", desc: "Autotransformador monofásico (OLTC) lado de alta en el 500 kV capacidad final mayor o igual a 150 MVA", costo2017: "1.265.741.000", unit2017: "29.741.000", vig: "2017" }
        ]
      }
    ]
  }
});

/**
 * Los grupos de las dos tablas en una sola lista, cada uno con el rótulo de la
 * tabla a la que pertenece. Mismo orden que usa el módulo original: primero la
 * Tabla 52 (niveles 4 y 3) y luego la Tabla 51 (conexión al STN).
 */
export const GRUPOS_UC = congelar([
  ...CREG_UC.T16.grupos.map((g) => ({ ...g, tabla: 'Tabla 52' })),
  ...CREG_UC.T15.grupos.map((g) => ({ ...g, tabla: 'Tabla 51' }))
]);

/** Índice grupo por llave "<nivel>|<devanado>" (p. ej. "N4|bi"). */
const GRUPO_POR_LLAVE = congelar(
  Object.fromEntries(GRUPOS_UC.map((g) => [g.key, g]))
);

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Busca una unidad constructiva por su código.
 * @param {string} codigo p. ej. "N4T4"
 * @returns {{uc: string, fila: object, grupo: object, tabla: string}|null}
 */
export function buscarUC(codigo) {
  if (!codigo) return null;
  const c = String(codigo).trim().toUpperCase();
  for (const grupo of GRUPOS_UC) {
    const fila = grupo.rows.find((r) => r.uc === c);
    if (fila) return { uc: fila.uc, fila, grupo, tabla: grupo.tabla };
  }
  return null;
}

/** Códigos de UC catalogados para un nivel de tensión ("N3".."N6"). */
export function codigosPorNivel(nivel) {
  const out = [];
  for (const g of GRUPOS_UC) {
    if (g.key.split('|')[0] === nivel) g.rows.forEach((r) => out.push(r.uc));
  }
  return out;
}

/**
 * Pasa un monto del catálogo ("152.592.000") a número (152592000).
 * Devuelve `null` si no hay dígitos.
 */
export function montoCOP(texto) {
  if (texto == null) return null;
  const n = parseInt(String(texto).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Cifras de reposición VIGENTES para la ficha (pesos de diciembre de 2007).
 * @returns {{inst: number, porMVA: number, vig: string}|null}
 *   inst   costo de instalación de la UC (celda F36 de la ficha)
 *   porMVA valor unitario $/MVA
 *   vig    corte de esas cifras ("2007", o "2017" en las filas de nivel 6)
 * El presupuesto de la ficha es: inst + (MVA del proyecto × porMVA).
 */
export function costoUC(codigo) {
  const r = buscarUC(codigo);
  if (!r) return null;
  const inst = montoCOP(r.fila.costo);
  const porMVA = montoCOP(r.fila.unit);
  if (inst == null || porMVA == null) return null;
  return { inst, porMVA, vig: r.fila.vig || '2007' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLASIFICADOR · portado literal desde `clasificarJS` del módulo v22
   ───────────────────────────────────────────────────────────────────────────
   No cambiar el criterio sin una decisión documentada: la auditoría de la
   flota (concordante / discrepancia / falta registro) se calculó con estas
   mismas reglas, y cualquier ajuste reescribiría el veredicto histórico.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Normaliza una tensión a número en kV. "N/A", "", "-" y similares ⇒ null. */
export function normalizarKv(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase();
  if (['N/A', 'NA', '', 'NONE', '-'].includes(s)) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/**
 * Nivel de tensión CREG del lado de alta.
 * @returns {[string|null, string]} [código de nivel, etiqueta legible]
 */
export function nivelPorTension(kv) {
  if (kv == null) return [null, 'sin dato'];
  if (kv >= 500) return ['N6', 'Conexion STN 500 kV'];
  if (kv >= 220) return ['N5', 'Conexion al STN (>=220 kV)'];
  if (kv >= 57.5) return ['N4', 'Nivel 4 [57,5-220) kV'];
  if (kv >= 30) return ['N3', 'Nivel 3 [30-57,5) kV'];
  if (kv >= 1) return ['N2', 'Nivel 2 [1-30) kV'];
  return ['N1', 'Nivel 1 (<1 kV)'];
}

/** Limpia el prefijo "Capacidad final (de)" del texto de banda. */
function textoBanda(cap) {
  return (cap || '').replace(/^Capacidad final (de )?/i, '');
}

/**
 * Asigna la unidad constructiva CREG a partir de los datos de placa.
 * Réplica exacta del clasificador con el que se evaluó la flota.
 *
 * @param {number|string} potKva  potencia en kVA
 * @param {number|string} kvPrim  tensión primaria (lado de alta) en kV
 * @param {number|string} kvTerc  tensión terciaria en kV (null/"N/A" ⇒ bidevanado)
 * @param {string} regulacion     regulación reportada: "OLTC" | "NLTC" | otro
 * @returns {{
 *   uucc_calc: string|null, mva: number|null, nivel: string|null,
 *   nivel_lbl: string, devanado: 'bi'|'tri', banda: string|null,
 *   reg_catalogo: string|null, pasos: string[], notas: string[]
 * }}
 *   `pasos` es la traza auditable del cálculo y `notas` las advertencias
 *   (banda por debajo del mínimo, regulación que no concuerda con el
 *   descriptor, conexión al STN sin tipo constructivo…).
 */
export function clasificarUC(potKva, kvPrim, kvTerc, regulacion) {
  const pasos = [];
  const notas = [];
  let mva = null;

  if (potKva != null && potKva !== '') {
    mva = Math.round((parseFloat(String(potKva).replace(',', '.')) / 1000) * 10000) / 10000;
    pasos.push(`Potencia ${potKva} kVA / 1000 = ${mva} MVA`);
  }

  const kvp = normalizarKv(kvPrim);
  const kvt = normalizarKv(kvTerc);
  const [niv, nivLbl] = nivelPorTension(kvp);
  pasos.push(`Tension primaria = ${kvp} kV -> ${niv} (${nivLbl})`);

  const tri = kvt != null;
  const dev = tri ? 'tri' : 'bi';
  pasos.push(`Tension terciaria = ${kvt} kV -> ${tri ? 'TRIDEVANADO' : 'BIDEVANADO'}`);

  let uucc = null;
  let banda = null;
  let regCat = null;
  const key = `${niv}|${dev}`;

  if (niv === 'N1' || niv === 'N2') {
    notas.push(`Nivel ${niv}: la Tabla 16 no cataloga UC de transformador de potencia para este nivel (revisar; posible activo Nivel 1/2).`);
  } else if (niv === 'N6') {
    notas.push('Primario 500 kV: aplica catalogo N6 (Tabla 15); requiere dato de tipo constructivo.');
  } else if (niv && GRUPO_POR_LLAVE[key]) {
    const rows = GRUPO_POR_LLAVE[key].rows;
    const mmin = rows[0].min;
    if (mva == null) {
      notas.push('Sin potencia: no se puede asignar banda.');
    } else if (mva < mmin) {
      const r = rows[0];
      uucc = r.uc; banda = textoBanda(r.cap); regCat = r.reg;
      pasos.push(`${mva} MVA < minimo catalogo ${mmin} MVA -> se asigna banda minima ${r.uc} (${banda})`);
      notas.push(`Capacidad ${mva} MVA inferior al minimo del catalogo ${niv}/${dev} (${mmin} MVA); el CREG no define banda por debajo de ${mmin} MVA. Se asigna la banda minima ${r.uc} (interpretacion; requiere validacion).`);
    } else {
      for (const r of rows) {
        const hi = r.max == null ? Infinity : r.max;
        if (mva <= hi) {
          uucc = r.uc; banda = textoBanda(r.cap); regCat = r.reg;
          pasos.push(`${mva} MVA <= limite ${r.max == null ? '∞' : r.max} -> banda ${r.uc} (${banda}, ${r.reg})`);
          break;
        }
      }
    }
    if (niv === 'N5') {
      notas.push(`Conexion STN: catalogo distingue trifasico (N5T1-10), autotransf. monofasico (N5T11-18) y tridevanado (N5T19-25). Sin columna de fases/tipo, se asume trifasico${tri ? '/tridevanado' : ''}; verificar tipo constructivo.`);
    }
  } else if (niv) {
    notas.push(`Combinacion ${key} sin catalogo aplicable.`);
  }

  const rr = regulacion != null ? String(regulacion).trim().toUpperCase() : null;
  if (uucc && regCat && (rr === 'OLTC' || rr === 'NLTC') && rr !== regCat) {
    notas.push(`Regulacion reportada ${rr} difiere del descriptor de la banda ${uucc} (${regCat}) en catalogo CREG (advertencia, no altera codigo por capacidad).`);
  }

  return {
    uucc_calc: uucc,
    mva,
    nivel: niv,
    nivel_lbl: nivLbl,
    devanado: dev,
    banda,
    reg_catalogo: regCat,
    pasos,
    notas
  };
}

/**
 * ¿Las notas de una clasificación ameritan bandera de advertencia?
 * Mismo criterio que `advFromNotas` en el módulo original.
 */
export function hayAdvertencia(notas) {
  return (notas || []).some(
    (n) => /difiere del descriptor|inferior al minimo|Conexion STN/.test(n)
  );
}
