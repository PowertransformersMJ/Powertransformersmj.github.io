// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas personales (dominio puro, sin Firebase)
// ──────────────────────────────────────────────────────────────
// Regla que gobierna todo este módulo: **cada quien solo puede firmar por
// sí mismo**. No existe forma de estampar la firma de otra persona, ni
// aunque su nombre aparezca en el documento. Esto no es una comodidad de
// implementación: es lo que impide que el sitio se convierta en una
// máquina de falsificar documentos (ADR-070, ADR-071).
//
// Sin I/O a propósito: se prueba con `node --test`. El acceso a Storage
// vive en `assets/js/data/firmas.js`.
// ══════════════════════════════════════════════════════════════

/** Tope de una firma escaneada. Un PNG recortado a solo el trazo pesa
 *  decenas de KB; 1 MB deja margen de sobra y corta las fotos de cámara. */
export const MAX_BYTES = 1024 * 1024;

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
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      motivo: `La imagen pesa ${mb} MB y el tope es 1 MB. Recórtela dejando `
            + 'solo el trazo de la firma: así pesa mucho menos y se ve mejor.'
    };
  }
  return { ok: true, motivo: '' };
}

/** Normaliza un nombre para compararlo: sin tildes, sin dobles espacios,
 *  en mayúsculas. «Miguel  Jiménez » y «MIGUEL JIMENEZ» son la misma persona. */
export function normalizarNombre(n) {
  // La Ñ se protege ANTES de descomponer: en NFD la Ñ es «N + tilde», y al
  // quitar los diacríticos se convertiría en N. Eso haría que MUÑOZ y MUNOZ
  // se tomaran por la misma persona — y en una firma, equivocarse hacia el
  // lado permisivo es exactamente lo que no se puede permitir.
  return String(n == null ? '' : n)
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
