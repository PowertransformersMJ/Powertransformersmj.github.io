// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas personales (dominio puro, sin Firebase)
// ──────────────────────────────────────────────────────────────
// Regla que gobierna todo este módulo: **cada quien solo puede firmar por
// sí mismo**. No existe forma de estampar la firma de otra persona, ni
// aunque su nombre aparezca en el documento. Esto no es una comodidad de
// implementación: es lo que impide que el sitio se convierta en una
// máquina de falsificar documentos (ADR-070, ADR-071).
//
// Sin I/O a propósito: se prueba con `node --test`. El acceso (Firestore
// `firmas/{uid}` desde `99 §100`; antes Storage) vive en `assets/js/data/firmas.js`.
// ══════════════════════════════════════════════════════════════

/** Tope de una firma escaneada. Un PNG recortado a solo el trazo pesa
 *  decenas de KB. Era 1 MB; desde `99 §100` la firma vive DENTRO de un
 *  documento de Firestore (tope 1 MiB por documento, con sus campos), así
 *  que el tope baja a 900 KB: sigue sobrando y corta las fotos de cámara. */
export const MAX_BYTES = 900 * 1024;

/** Solo PNG: es el único formato de los tres habituales que garantiza
 *  fondo TRANSPARENTE. Un JPG (que no tiene canal alfa) llega con fondo
 *  blanco y tapa la línea de firma del formato impreso. */
export const TIPO_REQUERIDO = 'image/png';

/**
 * ¿Puede aceptarse este archivo como firma?
 * Devuelve `{ ok, motivo }`. El motivo está redactado para el usuario
 * final, que no es técnico: dice qué pasó Y qué hacer.
 */
export function validarArchivoFirma(archivo) {
  if (!archivo) return { ok: false, motivo: 'No se eligió ningún archivo.' };

  const tipo = String(archivo.type || '').toLowerCase();
  if (tipo !== TIPO_REQUERIDO) {
    return {
      ok: false,
      motivo: 'La firma debe ser un PNG con fondo transparente. Un JPG llega '
            + 'con fondo blanco y taparía la línea de firma del formato.'
    };
  }

  const bytes = Number(archivo.size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, motivo: 'El archivo está vacío o no se pudo leer.' };
  }
  if (bytes > MAX_BYTES) {
    // Hacia ARRIBA: redondeando, 900,4 KB se leía «pesa 900 KB y el tope es 900 KB».
    const peso = bytes >= 1024 * 1024 ? (Math.ceil(bytes / (1024 * 1024) * 10) / 10).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
    return {
      ok: false,
      motivo: `La imagen pesa ${peso} y el tope es ${Math.round(MAX_BYTES / 1024)} KB. Recórtela dejando `
            + 'solo el trazo de la firma: así pesa mucho menos y se ve mejor.'
    };
  }
  return { ok: true, motivo: '' };
}

/** ¿Son estos bytes un PNG de verdad (firma de 8 bytes), diga lo que diga la
 *  etiqueta del archivo? Se comprueba antes de guardar (`99 §100`). */
export function esPngPorBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const FIRMA_PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  return b.length > FIRMA_PNG.length && FIRMA_PNG.every((v, i) => b[i] === v);
}

/** Normaliza un nombre para compararlo: sin tildes, sin dobles espacios,
 *  en mayúsculas. «Miguel  Jiménez » y «MIGUEL JIMENEZ» son la misma persona. */
export function normalizarNombre(n) {
  // La Ñ se protege ANTES de descomponer: en NFD la Ñ es «N + tilde», y al
  // quitar los diacríticos se convertiría en N. Eso haría que MUÑOZ y MUNOZ
  // se tomaran por la misma persona — y en una firma, equivocarse hacia el
  // lado permisivo es exactamente lo que no se puede permitir.
  // Primero se RECOMPONE (NFC): una «Ñ» pegada como «N» + tilde combinable
  // (así llega desde algunos PDF y nombres de archivo de macOS) no es una Ñ
  // precompuesta y se perdía al quitar diacríticos (revisión de `99 §98`).
  return String(n == null ? '' : n).normalize('NFC')
    .replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * ¿La firma de la sesión corresponde a ESTA línea del documento?
 *
 * El documento tiene varias líneas de firma (autoriza / entrega / recibe) y
 * cada una lleva el nombre de una persona distinta. Solo se estampa cuando
 * el nombre de la línea es el de quien tiene la sesión abierta. Para el
 * resto, la línea queda EN BLANCO para firmar a mano — que es exactamente
 * lo que hace el formato en papel.
 *
 * Devolver `false` no es un fallo: es el comportamiento correcto.
 */
export function firmaAplicaA(nombreDeLaLinea, nombreEnSesion) {
  const linea = normalizarNombre(nombreDeLaLinea);
  const sesion = normalizarNombre(nombreEnSesion);
  if (!linea || !sesion) return false;
  return linea === sesion;
}

/**
 * Motivo por el que una línea sale sin firma, para explicarlo en pantalla.
 * Nunca se deja un hueco sin explicación (L-69: un vacío se redacta como
 * lo que es, no se disfraza).
 */
export function motivoSinFirma({ haySesion, hayFirmaPropia, esMiLinea }) {
  if (!haySesion)      return 'Sin sesión: el documento sale para firmar a mano.';
  if (!esMiLinea)      return 'Solo puede firmar aquí la persona nombrada en esta línea.';
  if (!hayFirmaPropia) return 'Aún no ha cargado su firma. Puede hacerlo en «Mi firma».';
  return '';
}
