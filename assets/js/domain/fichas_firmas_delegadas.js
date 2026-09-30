// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · firmas del equipo cuando exporta un DELEGADO (puro)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-30): «necesito que en el módulo de fichas técnicas
// Jorge y Carlos puedan exportar el archivo Excel con todas las firmas. Yo lo
// autorizo». Igual que en Órdenes E/S (`99 §117`): el custodio da el permiso usuario
// por usuario y firma por firma en `firmas_delegados_fichas/{uid}`, con la fecha y el
// medio de la autorización de cada titular (`99 §119`); las reglas del servidor lo
// vuelven a exigir en cada lectura y en cada folio.
//
// Qué firma lleva cada casilla lo sigue decidiendo `planDeEstampado` (el MISMO camino
// del custodio, `99 §99`/`§108`): la casilla de la sesión con su firma propia; las
// demás, del directorio, por CLAVE y solo si la persona se eligió de la lista de esa
// casilla. Aquí solo lo que cambia para el delegado: qué claves puede leer y, como
// espejo de la regla `casillaFichasDelegadaOk`, qué persona cabe en qué casilla.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CASILLAS_FIRMA, FIRMANTES } from './fichas_firmantes.js';
import { IDS_EQUIPO, idDeNombreDeLista } from './firmas_equipo.js';

/** En Fichas se pueden delegar las cinco firmas de la lista (la ficha lleva todas). */
export const DELEGABLES_FICHAS = IDS_EQUIPO;
/** Quién puede ser el propio delegado en la lista (lo que pidió el Ingeniero: Carlos y Jorge). */
export const PROPIAS_FICHAS = Object.freeze(['CARLOS_MARTELO', 'JORGE_RHENALS']);

/**
 * Claves que caben en cada casilla, sacadas de la lista dictada (`FIRMANTES`, `§89`).
 * La regla del servidor lleva la MISMA tabla (una prueba compara las dos).
 * @returns {Object<string, string[]>}
 */
export function personasPorCasilla() {
  const out = {};
  for (const k of CASILLAS_FIRMA) {
    const ids = [];
    for (const f of FIRMANTES[k] || []) {
      const id = idDeNombreDeLista(f.nombre);
      if (id && !ids.includes(id)) ids.push(id);
    }
    out[k] = ids;
  }
  return out;
}

/**
 * Normaliza la delegación leída de la base, o null si no sirve para Fichas.
 * @returns {{custodio: string, custodioNombre: string, personaPropia: string, personas: string[], lote: string}|null}
 */
export function delegacionFichasDe(d) {
  if (!d || d.alcance !== 'fichas' || !d.custodio || !Array.isArray(d.personas)) return null;
  const personas = DELEGABLES_FICHAS.filter((p) => d.personas.includes(p));
  if (!personas.length || !/^[A-Za-z0-9]{20}$/.test(String(d.lote || ''))) return null;
  return {
    custodio: String(d.custodio), custodioNombre: String(d.custodioNombre || ''),
    personaPropia: PROPIAS_FICHAS.includes(d.personaPropia) ? d.personaPropia : '',
    personas, lote: String(d.lote)
  };
}

/** ¿El delegado puede leer del directorio la firma de `id`? */
export function puedeLeerDelegada(id, delegacion) {
  return !!delegacion && IDS_EQUIPO.includes(id) && Array.isArray(delegacion.personas) && delegacion.personas.includes(id);
}

/**
 * ¿La casilla que se va a registrar cumple lo que exige la regla? (para no pedir un
 * folio que el servidor va a negar). No comprueba la huella contra el directorio: eso
 * lo hace la regla con la firma vigente.
 * @param {{k, persona, nombre, origen, huella}} c
 */
export function casillaDelegadaValida(c, delegacion) {
  if (!c || !delegacion || !CASILLAS_FIRMA.includes(c.k)) return false;
  if (typeof c.nombre !== 'string' || c.nombre.length > 80 || !/^[0-9a-f]{64}$/.test(String(c.huella || ''))) return false;
  if (c.origen === 'propia') return c.persona === '' || c.persona === delegacion.personaPropia;
  if (c.origen !== 'equipo') return false;
  return puedeLeerDelegada(c.persona, delegacion) && (personasPorCasilla()[c.k] || []).includes(c.persona);
}
