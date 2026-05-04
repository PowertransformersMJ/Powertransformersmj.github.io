// ══════════════════════════════════════════════════════════════
// HELPER · Deep-clean recursivo para payloads Firestore
// ──────────────────────────────────────────────────────────────
// Firestore rechaza valores undefined / NaN / function en payloads
// con un error engañoso "Missing or insufficient permissions"
// (en realidad es un error de tipo, pero la SDK lo enmascara como
// permission-denied). Esta función:
//
//   · undefined / NaN / Infinity → omitidos (la clave no se incluye)
//   · null / 0 / '' / false → preservados (son valores legítimos)
//   · function → omitida
//   · arrays → mapeados recursivamente, items undefined eliminados
//   · objetos → recursivos, claves con undefined eliminadas
//   · Timestamps de Firestore (con toDate) y FieldValue (con
//     _methodName) → preservados sin tocar
//
// Aplicar SIEMPRE antes de llamar `addDoc` / `setDoc` / `updateDoc`
// cuando el payload tenga estructura anidada o objetos serializados
// que puedan venir de funciones puras del dominio.
//
// Ver CLAUDE.md §0.1.2.6 (regla permanente desde 2026-05-03).
// ══════════════════════════════════════════════════════════════

/**
 * Limpia recursivamente undefined / NaN / function de un valor para
 * que sea seguro persistir en Firestore.
 *
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
    //   · Timestamps (con toDate)
    //   · FieldValue / serverTimestamp (con _methodName)
    //   · GeoPoint, DocumentReference, etc.
    if (typeof value.toDate === 'function') return value;
    if (value._methodName) return value;
    // Objeto plano: recursión sobre cada clave, omitiendo undefined.
    const out = {};
    for (const k of Object.keys(value)) {
      const v = deepClean(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}
