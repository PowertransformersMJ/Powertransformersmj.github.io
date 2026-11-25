// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · POR SUBSANAR · ¿qué DOCUMENTO toca cada punto? (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): descargar en Excel el detalle de «Por subsanar», con lo que hay que corregir
// en cada ODT para que quede conforme, «sea control previo o registro fotográfico». No hay un campo guardado con el
// documento: se decide LEYENDO el texto del punto (y a quién le toca). Un punto puede tocar varios documentos
// («corregir la fecha y las horas en la ODT … y en su control previo, y la fecha en el registro fotográfico»).
//
// Categorías (en este orden; la primera que aplica gana):
//   1. «Aviso»                               el texto empieza por «Aviso:».
//   2. «Sistema / decisión del Responsable»  le toca al Responsable y pide decidir («Decidir…», «Definir…»,
//                                            «Aceptar…») o corregir algo en el sistema («en el sistema»).
//   3. «Aclaración del AZT»                  le toca al AZT, pide «Aclarar…» o «Confirmar…» (o «Indicar…»,
//                                            «Precisar…», «Explicar…») y NO pide corregir, cambiar, anexar ni
//                                            enviar nada.
//   4. Documentos: «Control previo», «Registro fotográfico», «ODT», o varios separados por « + ».
//      · El documento con que EMPIEZA el punto («Control previo: …», «Registro fotográfico, hoja 2: …»,
//        «ODT, condiciones ambientales: …») cuenta siempre.
//      · En el resto, solo cuentan los documentos nombrados en una frase que pide un cambio (corregir, cambiar,
//        anexar, enviar, cargar, generar, quitar, reemplazar, tomar de nuevo, «deben ser…»…) o que dice que algo
//        FALTA o está MAL («falta…», «no tiene…», «no se lee…», «sin firma…», «ilegible», «equivocada»…). Las frases
//        que solo describen («Es la misma foto…», «La ODT dice…») no cuentan, ni lo que va después de «según…»,
//        «para que coincida con…», «es copia de…», «igual a…», «la misma foto de…», «que está en…», «en la ODT
//        dice…», «porque…» o «sin tocar…» (son referencias a otro papel o explicaciones, no lo que se corrige).
//      · Un verbo con pronombre («generarla», «cambiarlas») o una frase que empieza por «debe decir…» sin nombrar
//        un documento se refiere al que nombró la frase anterior («La ODT imprime mal la fecha; generarla de nuevo»).
//      · La ODT casi siempre se nombra como referencia («Según la ODT 9…», «de esta ODT»): solo cuenta cuando es
//        lo que se corrige: «en la ODT», «Generar de nuevo la ODT», «Cargar la ODT», «Corregir la ODT», «La ODT no
//        tiene…» (al comienzo de la frase, sin N.º), o un campo propio de la ODT («hora real fin», «condiciones
//        ambientales», «Recibe ZP») en un punto que no empieza por otro documento.
//      · Registro fotográfico: «registro fotográfico», «foto(s)», «fotografía(s)», o «placa» cuando se habla de
//        leerla («placa legible», «no se lee»).
//   5. «Otro»                                si nada de lo anterior aplica. CONSERVADORA: ante la duda, «Otro»;
//                                            nunca se inventa un documento.
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102): ninguna pieza vieja de la caché lo nombra.
// ══════════════════════════════════════════════════════════════════════════════

/** Los tres documentos, en el orden en que se escriben y en que van sus columnas en el Excel. */
export const DOCUMENTOS = Object.freeze(['control_previo', 'registro_fotografico', 'odt']);
export const ETIQUETA_DOCUMENTO = Object.freeze({
  control_previo: 'Control previo',
  registro_fotografico: 'Registro fotográfico',
  odt: 'ODT'
});
/** Las categorías que no son un documento. */
export const CATEGORIAS = Object.freeze({
  documento: 'documento',
  aclaracion: 'aclaracion',
  sistema: 'sistema',
  aviso: 'aviso',
  otro: 'otro'
});
export const ETIQUETA_CATEGORIA = Object.freeze({
  aclaracion: 'Aclaración del AZT',
  sistema: 'Sistema / decisión del Responsable',
  aviso: 'Aviso',
  otro: 'Otro'
});
/** Entre dos o más documentos: «Control previo + Registro fotográfico». */
export const SEPARADOR = ' + ';

// ── Texto normalizado: minúsculas, sin tildes, espacios simples ────────────────
/** «Registro FOTOGRÁFICO,  hoja 2» → «registro fotografico, hoja 2». */
export function normalizar(t) {
  return (typeof t === 'string' ? t : '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Piezas de las expresiones (sobre el texto normalizado) ─────────────────────
const NOMBRE_CP = 'control(?:es)? previos?';
const NOMBRE_RF = 'registros? fotograficos?|fotos?|fotografias?';
const NOMBRE_DOC = '(?:' + NOMBRE_CP + '|' + NOMBRE_RF + '|odt)';
/**
 * El documento con que empieza el punto: «control previo:», «registro fotografico, hoja 2 (tpt x):»,
 * «odt, condiciones ambientales iniciales:», «control previo y registro fotografico:». El detalle entre la coma (o el
 * paréntesis) y los dos puntos no cruza el fin de una frase.
 */
const RE_PREFIJO = new RegExp('^(' + NOMBRE_DOC + '(?:\\s*(?:,|\\by\\b|\\be\\b|\\+)\\s*(?:el |la |los |las |su )?' + NOMBRE_DOC + ')*)'
  + '\\s*(?:[,(](?:(?!\\.\\s)[^:]){0,120})?:');
const RE_CP = new RegExp('\\b(?:' + NOMBRE_CP + ')\\b');
const RE_RF = new RegExp('\\b(?:' + NOMBRE_RF + ')\\b');
const RE_ODT_SOLA = /\bodt\b/;
/** «placa» cuenta como registro fotográfico solo si se habla de LEERLA (en la foto). */
const RE_PLACA = /\bplaca\b/;
const RE_LEER = /\b(?:legible|ilegible|nitida|se lee|se lean|se leen|leer|leerse|reflejo|de cerca|enfocada|borrosa)\b/;

/** Verbos que piden un CAMBIO (infinitivo, con o sin pronombre: «cambiarla»; o en subjuntivo: «corrija»). */
const VERBOS_CAMBIO = ['corregir', 'reemitir', 'cambiar', 'anexar', 'enviar', 'cargar', 'generar', 'regenerar', 'quitar', 'retirar', 'reemplazar',
  'sustituir', 'subir', 'adjuntar', 'rehacer', 'completar', 'diligenciar', 'escribir', 'incluir', 'agregar', 'firmar', 'marcar',
  'actualizar', 'ajustar', 'modificar', 'imprimir'];
const SUBJUNTIVOS = ['corrija', 'reemita', 'cambie', 'anexe', 'envie', 'cargue', 'genere', 'quite', 'reemplace', 'suba', 'adjunte', 'complete',
  'diligencie', 'incluya', 'agregue', 'firme', 'actualice', 'modifique'];
const RE_CAMBIO = new RegExp('\\b(?:(?:' + VERBOS_CAMBIO.join('|') + ')(?:la|lo|las|los|le|les)?|(?:' + SUBJUNTIVOS.join('|') + ')n?'
  + '|deben? (?:traer|decir|llevar|incluir|quedar))\\b');
/**
 * Para los DOCUMENTOS (no para decidir si el AZT solo aclara), también piden algo las frases que mandan tomar (de nuevo)
 * la foto, las de «deben ser…» y las que dicen que algo FALTA o está MAL en el documento que nombran.
 */
const RE_PIDE_MAS = new RegExp([
  '\\b(?:re)?tomar(?:la|lo|las|los)?\\b',
  '\\bdeben? ser\\b',
  '\\bfaltan?\\b',
  '\\bno (?:tiene|tienen|trae|traen|lleva|llevan|aparece|aparecen|esta|estan|figura|figuran)\\b',
  '\\bno se (?:lee|leen|ve|ven|distingue|distinguen)\\b',
  '\\bno se (?:puede|pueden|alcanza|alcanzan) (?:a )?(?:leer|ver|distinguir)\\b',
  '\\bno (?:se )?(?:anex|adjunt|carg|envi|incluy|sub(?!san)|tom)\\w*',
  '\\b(?:ilegibles?|borros[ao]s?|equivocad[ao]s?|errad[ao]s?|incorrect[ao]s?|erroneos?|erroneas?)\\b',
  '\\bsin (?!que\\b)(?!\\w+(?:ar|er|ir)\\b)\\w'          // «sin firma», «sin registro fotográfico» (no «sin que», «sin tocar»)
].join('|'));
/** Un verbo con pronombre («generarla») o «debe decir…» al comienzo: se refiere a lo que nombró la frase anterior. */
const RE_REMITE = new RegExp('\\b(?:' + VERBOS_CAMBIO.join('|') + '|tomar)(?:la|lo|las|los)\\b|^deben? (?:decir|ser|traer|llevar|quedar)\\b');
/** La ODT como lo que se corrige: «en la ODT», «generar de nuevo la ODT», «cargar la ODT», «corregir la ODT». */
const RE_ODT_OBJETO = new RegExp('\\ben (?:la|su|esta|cada) odt\\b'
  + '|\\b(?:' + VERBOS_CAMBIO.join('|') + ')(?:la|lo)? (?:(?:en afinia|de nuevo|otra vez|nuevamente) )*(?:la|una|su|esta) odt\\b');
/** Campos propios del formato de la ODT. */
const RE_CAMPO_ODT = /\bhoras? real(?:es)? (?:de )?(?:inicio|fin)\b|\bcondiciones ambientales\b|\b(?:recibe|entrega) (?:zp|zt)\b/;
/** La ODT como SUJETO al comienzo de la frase («La ODT no tiene la firma…»), sin N.º (con N.º es otra ODT). */
const RE_ODT_SUJETO = /^(?:la|su|esta) odt\b(?!\s*\d)/;

/**
 * Lo que va después de estas palabras es una REFERENCIA a otro papel o una explicación (hasta el fin de la frase o unos
 * dos puntos; los de «hh:mm» no cortan), no lo que se corrige.
 */
const FIN = '(?:[^.;:]|:(?=\\d))*';
const REFERENCIAS = [
  new RegExp('\\bsegun\\b' + FIN, 'g'),
  new RegExp('\\bcoincid\\w* con\\b' + FIN, 'g'),
  new RegExp('\\bcopias?(?: exactas?)? (?:de|del)\\b' + FIN, 'g'),
  new RegExp('\\biguale?s? (?:a|al|que)\\b' + FIN, 'g'),
  new RegExp('\\brepetid[ao]s? (?:de|del|en)\\b' + FIN, 'g'),
  new RegExp('\\b(?:el|la|los|las) mism[ao]s? (?:foto|fotos|archivo|archivos|pagina|paginas|hoja|hojas|imagen|imagenes|de|del|que)\\b' + FIN, 'g'),
  /\b(?:figuran?|aparecen?|estan?|vienen?|salen?|traen?) en (?:la|el|los|las|su|sus)\b[^.;,]*/g,
  new RegExp('\\ben (?:la|su|esta|cada) odt (?:dicen?|figuran?|aparecen?|marcan?|salen?|traen?|tienen?|imprimen?|estan?)\\b' + FIN, 'g'),
  new RegExp('\\b(?:porque|pues|ya que|dado que|puesto que)\\b' + FIN, 'g'),
  /\bsin \w+(?:ar|er|ir)\b[^.;,]*/g
];
const quitarReferencias = (t) => REFERENCIAS.reduce((s, re) => s.replace(re, ' '), t);
/** Frases (punto, punto y coma, signos de cierre). «N.º», «12.5» y «hh:mm» no parten la frase. */
const frases = (t) => t.split(/(?<=[.;!?])\s+/).map((x) => x.trim()).filter(Boolean);

/** Los documentos con que empieza el punto (vacío si no empieza por uno). */
export function documentosDelPrefijo(norm) {
  const m = RE_PREFIJO.exec(norm);
  if (!m) return [];
  const nombrados = documentosNombrados(m[1], { odtSola: true });
  return DOCUMENTOS.filter((d) => nombrados.has(d));
}

/** Los documentos NOMBRADOS en un trozo (para la ODT, solo si se pide `odtSola`: en el prefijo basta con nombrarla). */
function documentosNombrados(trozo, { odtSola = false } = {}) {
  const out = new Set();
  if (RE_CP.test(trozo)) out.add('control_previo');
  if (RE_RF.test(trozo) || (RE_PLACA.test(trozo) && RE_LEER.test(trozo))) out.add('registro_fotografico');
  if (odtSola ? RE_ODT_SOLA.test(trozo) : (RE_ODT_OBJETO.test(trozo) || RE_ODT_SUJETO.test(trozo))) out.add('odt');
  return out;
}

/** Los documentos que el punto pide corregir, en el orden de DOCUMENTOS. */
export function documentosDe(texto) {
  const norm = normalizar(texto);
  const prefijo = documentosDelPrefijo(norm);
  const out = new Set(prefijo);
  // Un campo propio de la ODT solo la señala si el punto no empieza por otro documento.
  const campoCuenta = !prefijo.length || prefijo.includes('odt');
  const nombradosEn = (f) => {
    const s = documentosNombrados(f);
    if (campoCuenta && RE_CAMPO_ODT.test(f)) s.add('odt');
    return s;
  };
  let anterior = new Set();
  for (const f of frases(quitarReferencias(norm))) {
    const aqui = nombradosEn(f);
    if (RE_CAMBIO.test(f) || RE_PIDE_MAS.test(f)) {     // una frase que solo describe no pide nada
      // «generarla de nuevo», «debe decir 09:00»: sin documento propio, el de la frase anterior.
      const docs = aqui.size || !RE_REMITE.test(f) ? aqui : anterior;
      for (const d of docs) out.add(d);
    }
    anterior = aqui;
  }
  return DOCUMENTOS.filter((d) => out.has(d));
}

const RE_AVISO = /^aviso\s*:/;
const RE_DECISION = /\b(?:decidir|definir)\b|^(?:aceptar|aprobar|autorizar|validar)\b|\b(?:en|del) (?:el )?sistema\b/;
const RE_ACLARAR = /\b(?:aclarar|confirmar|indicar|precisar|explicar)\b/;
const RE_ACLARAR_INICIO = /^(?:aclarar|confirmar|indicar|precisar|explicar)\b/;

/**
 * Clasifica UN punto por su texto (y a quién le toca).
 * @param {{texto?:string, quien?:string}} punto   quien: 'contratista' | 'azt' | 'responsable'
 * @returns {{categoria:'documento'|'aclaracion'|'sistema'|'aviso'|'otro', documentos:string[], etiqueta:string}}
 *   documentos: claves de DOCUMENTOS (vacío salvo en 'documento'); etiqueta: el texto de la columna «Documento».
 */
export function clasificarPunto({ texto, quien } = {}) {
  const norm = normalizar(texto);
  const resultado = (categoria, documentos = []) => ({
    categoria,
    documentos,
    etiqueta: categoria === CATEGORIAS.documento ? documentos.map((d) => ETIQUETA_DOCUMENTO[d]).join(SEPARADOR) : ETIQUETA_CATEGORIA[categoria]
  });
  if (!norm) return resultado(CATEGORIAS.otro);
  if (RE_AVISO.test(norm)) return resultado(CATEGORIAS.aviso);
  if (quien === 'responsable' && RE_DECISION.test(norm)) return resultado(CATEGORIAS.sistema);
  if (quien === 'azt' && RE_ACLARAR.test(norm) && !RE_CAMBIO.test(norm)) return resultado(CATEGORIAS.aclaracion);
  const documentos = documentosDe(texto);
  if (documentos.length) return resultado(CATEGORIAS.documento, documentos);
  // Un punto del AZT que EMPIEZA pidiendo aclarar o confirmar y no nombra un documento por corregir («Confirmar el nombre
  // de la Persona 1 para completarla en el sistema») sigue siendo una aclaración, aunque mencione un cambio después.
  if (quien === 'azt' && RE_ACLARAR_INICIO.test(norm)) return resultado(CATEGORIAS.aclaracion);
  return resultado(CATEGORIAS.otro);
}
