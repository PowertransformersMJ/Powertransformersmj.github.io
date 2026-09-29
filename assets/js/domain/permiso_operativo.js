// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Permiso «adjuntar el Diagrama Operativo» en Fichas (dominio puro) · `99 §118`
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-29): «necesito que los usuarios Jorge Rhenals y
// Carlos Martelo puedan adjuntar el diagrama operativo en el módulo de fichas
// técnicas». Hasta aquí solo un administrador lo adjuntaba (`§112`).
//
// Se da USUARIO POR USUARIO (no a todo técnico): el administrador marca el permiso
// en Administración › Usuarios y queda en `permisos_extra` del perfil (catálogo
// RBAC, `rbac.js`). Solo el administrador escribe /usuarios, así que nadie se lo
// da a sí mismo; las reglas de Firestore lo vuelven a exigir en cada escritura.
// Con el permiso se adjunta y se REEMPLAZA; QUITAR sigue siendo del administrador
// (borra la imagen; para corregir basta reemplazar).
//
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** Clave del permiso en `permisos_extra` (la regla de Firestore usa la misma cadena). */
export const PERMISO_ADJUNTAR_OPERATIVO = 'fichas.adjuntar_operativo';

/** ¿El perfil (activo, real) puede adjuntar o reemplazar el Diagrama Operativo? */
export function puedeAdjuntarOperativo(perfil) {
  const p = perfil || {};
  if (p.activo === false || p.legacy) return false;
  if (p.rol === 'admin') return true;
  return Array.isArray(p.permisos_extra) && p.permisos_extra.includes(PERMISO_ADJUNTAR_OPERATIVO);
}

/** ¿Puede QUITARLO? Solo el administrador. */
export function puedeQuitarOperativo(perfil) {
  const p = perfil || {};
  return p.activo !== false && !p.legacy && p.rol === 'admin';
}

/** La lista de permisos con (`si`) o sin el de adjuntar, sin tocar los demás ni repetir. */
export function conPermisoOperativo(lista, si) {
  const base = (Array.isArray(lista) ? lista : []).map((x) => String(x || '').trim()).filter(Boolean)
    .filter((x) => x !== PERMISO_ADJUNTAR_OPERATIVO);
  return si ? [...base, PERMISO_ADJUNTAR_OPERATIVO] : base;
}
