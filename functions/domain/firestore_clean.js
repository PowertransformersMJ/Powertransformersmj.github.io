// ══════════════════════════════════════════════════════════════
// HELPER · Deep-clean recursivo para payloads Firestore (DOMINIO)
// ──────────────────────────────────────────────────────────────
// Vive en domain/ (no en data/) porque también lo usa la Cloud
// Function al persistir el reproceso server-side (functions/domain
// se sincroniza desde aquí). data/_firestore_clean.js lo re-exporta
// para no romper a los importadores existentes del navegador.
//
// Firestore rechaza valores undefined / NaN / function en payloads
// con un error engañoso "Missing or insufficient permissions" (en
// realidad es un error de tipo, enmascarado como permission-denied):
//   · undefined / NaN / Infinity → omitidos (la clave no se incluye)
//   · null / 0 / '' / false → preservados (valores legítimos)
//   · function → omitida
//   · arrays → mapeados recursivamente, items undefined eliminados
//   · objetos → recursivos, claves con undefined eliminadas
//   · Timestamps (toDate) y FieldValue (_methodName) → intactos
//
// Aplicar SIEMPRE antes de addDoc / setDoc / updateDoc cuando el
// payload tenga estructura anidada o venga de funciones del dominio.
// ══════════════════════════════════════════════════════════════

/**
 * Limpia recursivamente undefined / NaN / function de un valor para
 * que sea seguro persistir en Firestore.
 * @template T
 * @param {T} value
 * @returns {T | undefined}
 */
export function deepClean(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) {
    return value
      .map(deepClean)
      .filter(v => v !== undefined);
  }
  if (typeof value === 'object') {
    // Preserva objetos especiales de Firestore intactos:
    //   · Timestamps (con toDate) · FieldValue / serverTimestamp (_methodName)
    if (typeof value.toDate === 'function') return value;
    if (value._methodName) return value;
    const out = {};
    for (const k of Object.keys(value)) {
      const v = deepClean(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}
