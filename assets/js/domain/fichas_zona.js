// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Zona del activo en la ficha (`99 §106`)
// ─────────────────────────────────────────────────────────────────────────────
// El Ingeniero (2026-09-27): «noto que las zonas están mal, me aparece córdoba y
// las zonas son BOLIVAR, ORIENTE Y OCCIDENTE, cada activo tiene asociado su zona
// y departamento». La casilla ZONA de la ficha y del PE.02081 mostraba el
// DEPARTAMENTO. La zona es la registrada del activo; solo si faltara se deduce
// del departamento con el catálogo oficial (`schema.js`, DEPARTAMENTOS). Nunca
// se escribe el departamento en la casilla de zona.
// Pura: cero DOM, cero Firebase.
// ═════════════════════════════════════════════════════════════════════════════

import { DEPARTAMENTOS } from './schema.js';

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Zona del activo (BOLIVAR / ORIENTE / OCCIDENTE), o '' si no se conoce. */
export function zonaDelActivo(equipo) {
  const e = equipo || {};
  const ub = e.ubicacion || {};
  const z = String(e.zona || ub.zona || '').trim();
  if (z) return z.toUpperCase();
  const d = norm(e.departamento || ub.departamento);
  if (!d) return '';
  const hit = DEPARTAMENTOS.find((x) => x.value === d || norm(x.label) === d);
  return hit ? hit.zona : '';
}
