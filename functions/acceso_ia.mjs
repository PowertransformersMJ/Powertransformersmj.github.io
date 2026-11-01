// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — ¿Quién puede llamar a las funciones de IA? · `99 §198`
// ──────────────────────────────────────────────────────────────
// Decisión PURA (sin Firebase) de `exigirMiembroActivo` en index.js, para probarla
// sin emulador ni secreto (patrón de reintentos.mjs). El rol «visitante» solo ve
// Cargabilidad SCADA y el Mapa: nunca usa la IA (y la IA cuesta). Se niega PRIMERO,
// antes del arranque por /admins, que aquí es más laxo que en las reglas.
// Espejo del criterio de firestore.rules, storage.rules y domain/acceso_por_rol.js.
// ══════════════════════════════════════════════════════════════

/**
 * Ante la duda, CERRADO (espejo exacto de las reglas): cuenta como visitante todo texto que contenga
 * «visitante» (mayúsculas, espacios raros escritos por consola) y todo rol que no sea texto; sin rol
 * (o null) no lo es.
 */
export function esRolVisitante(rol) {
  if (rol == null) return false;
  return typeof rol !== 'string' || rol.toLowerCase().includes('visitante');
}

/**
 * @param {{existe:boolean, datos:object|null}} perfil  /usuarios/{uid}
 * @param {{existe:boolean}} admins                      /admins/{uid}
 * @returns {'ok'|'visitante'|'sin_perfil_activo'}
 */
export function decidirAccesoIA(perfil, admins) {
  const datos = perfil && perfil.existe ? (perfil.datos || {}) : null;
  if (datos && esRolVisitante(datos.rol)) return 'visitante';
  const perfilActivo = !!datos && datos.activo === true;
  const bootstrap = !!(admins && admins.existe) && (!datos || datos.activo === true);
  return perfilActivo || bootstrap ? 'ok' : 'sin_perfil_activo';
}
