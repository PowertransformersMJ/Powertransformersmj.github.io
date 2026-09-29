// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · la imagen GIRADA conserva su caja girada (`99 §115`)
// ──────────────────────────────────────────────────────────────────────────────
// El Diagrama Actual va girado 270° y se ancla a su tamaño (`anclarConTamano`,
// `ajustes-libro.js`). Excel guarda el ancla de una imagen girada entre 45° y
// 135° (o entre 225° y 315°) como la caja YA girada: ancho y alto cambiados
// respecto del <a:ext> de la imagen. `anclarConTamano` ya lo hace; esto es el
// seguro por si el navegador trae de su caché un `ajustes-libro.js` VIEJO que no
// lo hacía (L-102, revisión adversarial 2026-09-28): sin él, el Actual saldría
// deformado y encima de «Notas», sin aviso. Con el archivo nuevo no cambia nada.
//
// Archivo NUEVO a propósito (L-102): un navegador no puede tenerlo en caché viejo.
// ══════════════════════════════════════════════════════════════════════════════

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Un giro (en 60000-ésimos de grado) hace que Excel guarde la caja cambiada? */
export function giroAcostado(rot) {
  const g = (((Math.round(Number(rot || 0) / 60000) % 360) + 360) % 360);
  return (g >= 45 && g < 135) || (g >= 225 && g < 315);
}

/**
 * Si la imagen `rId` está en un oneCellAnchor, girada «acostada», y su ancla
 * tiene el ancho y alto SIN cambiar (igual que su <a:ext>), los cambia.
 * @returns {Promise<boolean>} true si corrigió algo
 */
export async function enderezarCajaGirada(zip, rutaDibujo, rId) {
  const f = zip.file(rutaDibujo);
  if (!f) return false;
  const xml = await f.async('string');
  let hecho = false;
  const nuevo = xml.replace(/<xdr:oneCellAnchor\b[^>]*>[\s\S]*?<\/xdr:oneCellAnchor>/g, (a) => {
    if (hecho || !new RegExp('r:embed="' + escRe(rId) + '"').test(a)) return a;
    const giro = (a.match(/<a:xfrm\b[^>]*\brot="(-?\d+)"/) || [])[1];
    if (!giro || !giroAcostado(giro)) return a;
    const ancla = a.match(/<xdr:ext cx="(\d+)" cy="(\d+)"\/>/);
    const img = a.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!ancla || !img || ancla[1] === ancla[2] || ancla[1] !== img[1] || ancla[2] !== img[2]) return a;
    hecho = true;
    return a.replace(ancla[0], '<xdr:ext cx="' + ancla[2] + '" cy="' + ancla[1] + '"/>');
  });
  if (hecho) zip.file(rutaDibujo, nuevo);
  return hecho;
}
