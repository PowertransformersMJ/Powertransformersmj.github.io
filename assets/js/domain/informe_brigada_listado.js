// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · LISTADO del parque (dominio puro)
// ──────────────────────────────────────────────────────────────
// Lo que necesita la tabla de equipos de `pages/informe-brigada.html`:
// buscar, filtrar, ordenar y contar los informes de cada equipo. Sin DOM ni
// Firebase: se prueba con `node --test` (tests/informe_brigada_listado.test.js).
//
// Un «equipo» aquí es el que entrega `equipoDesdeInventario()` (dominio del
// informe): { transformador_id, matricula, subestacion, zona, departamento,
// municipio, serie, potencia_kva, salud: { numero } … }. Nada se inventa: lo
// que no viene queda vacío y la tabla lo muestra como «—» o «s/d».
// ══════════════════════════════════════════════════════════════

/** Texto sin tildes, sin mayúsculas y sin espacios de sobra (para buscar y comparar). */
export function plano(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Condición 1..5 del equipo, o null si no hay (o si no es un entero de la escala). */
export function condicionDe(e) {
  if (!e) return null;
  const crudo = (e.salud && e.salud.numero != null) ? e.salud.numero : e.condicion;
  if (crudo == null || crudo === '') return null;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/** Potencia en MVA (el inventario guarda kVA). null si no hay dato (vacío no es cero, L-104). */
export function mvaDe(e) {
  if (!e) return null;
  if (e.potencia_kva != null && e.potencia_kva !== '') {
    const n = Number(e.potencia_kva);
    return Number.isFinite(n) ? n / 1000 : null;
  }
  if (e.mva != null && e.mva !== '') {
    const n = Number(e.mva);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Matrícula de un informe: la identidad fija primero, el contenido después. */
export function matriculaDeInforme(inf) {
  if (!inf) return '';
  const r = inf.equipo_ref && inf.equipo_ref.matricula;
  if (r) return String(r);
  const c = inf.contenido && inf.contenido.equipo && inf.contenido.equipo.matricula;
  return c ? String(c) : '';
}

function marcaTiempo(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Cuenta los informes de cada matrícula.
 * @returns {Map<string, { total, emitidos, borradores, anulados, ultimo: { id, estado, version, actualizadoEn } }>}
 */
export function contarInformesPorMatricula(informes) {
  const mapa = new Map();
  for (const inf of (Array.isArray(informes) ? informes : [])) {
    const m = matriculaDeInforme(inf);
    if (!m) continue;
    let r = mapa.get(m);
    if (!r) { r = { total: 0, emitidos: 0, borradores: 0, anulados: 0, ultimo: null }; mapa.set(m, r); }
    r.total += 1;
    if (inf.estado === 'emitido') r.emitidos += 1;
    else if (inf.estado === 'anulado') r.anulados += 1;
    else r.borradores += 1;
    const t = marcaTiempo(inf.actualizadoEn);
    if (!r.ultimo || t > marcaTiempo(r.ultimo.actualizadoEn)) {
      r.ultimo = { id: inf.id || '', estado: inf.estado || 'borrador', version: Number(inf.version) || 0, actualizadoEn: inf.actualizadoEn || null };
    }
  }
  return mapa;
}

/** Cómo se dice en la tabla el estado del último informe: «v2 emitido», «borrador», «v1 · en corrección», «anulado». */
export function etiquetaEstado(estado, version) {
  const v = Number(version) || 0;
  if (estado === 'emitido') return 'v' + v + ' emitido';
  if (estado === 'anulado') return 'anulado';
  return v > 0 ? 'v' + v + ' · en corrección' : 'borrador';
}

/**
 * Filtra el parque.
 * - `texto`: cada palabra debe aparecer en subestación, matrícula, serie, departamento, zona o municipio
 *   (sin tildes ni mayúsculas).
 * - `zona`, `departamento`: comparación sin tildes ni mayúsculas.
 * - `condicion`: '1'..'5' o 'sd' (sin dato).
 */
export function filtrarEquipos(equipos, { texto = '', zona = '', departamento = '', condicion = '' } = {}) {
  const palabras = plano(texto).split(' ').filter(Boolean);
  const z = plano(zona);
  const d = plano(departamento);
  const c = String(condicion == null ? '' : condicion);
  return (Array.isArray(equipos) ? equipos : []).filter((e) => {
    if (!e) return false;
    if (z && plano(e.zona) !== z) return false;
    if (d && plano(e.departamento) !== d) return false;
    if (c) {
      const k = condicionDe(e);
      if (c === 'sd') { if (k != null) return false; }
      else if (String(k) !== c) return false;
    }
    if (palabras.length) {
      const hay = plano([e.subestacion, e.matricula, e.serie, e.departamento, e.zona, e.municipio].join(' '));
      for (const p of palabras) if (!hay.includes(p)) return false;
    }
    return true;
  });
}

/** Claves por las que se puede ordenar la tabla. */
export const CLAVES_ORDEN = Object.freeze(['subestacion', 'matricula', 'mva', 'zona', 'departamento', 'condicion', 'informes']);

function valorOrden(e, clave, conteo) {
  switch (clave) {
    case 'mva': return mvaDe(e);
    case 'condicion': return condicionDe(e);
    case 'informes': {
      const r = conteo && conteo.get ? conteo.get(String(e.matricula || '')) : null;
      return r ? r.total : 0;
    }
    default: {
      const v = e[clave];
      return v == null || v === '' ? null : String(v);
    }
  }
}

/**
 * Ordena (sin mutar). Los vacíos van SIEMPRE al final, en cualquier sentido:
 * un equipo sin dato no debe aparecer como «el mejor» ni como «el peor».
 * Empates: por subestación y luego por matrícula, para que el orden sea estable.
 */
export function ordenarEquipos(equipos, { clave = 'subestacion', asc = true, conteo = null } = {}) {
  const k = CLAVES_ORDEN.includes(clave) ? clave : 'subestacion';
  const sentido = asc ? 1 : -1;
  const comparar = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y), 'es', { sensitivity: 'base', numeric: true });
  };
  return (Array.isArray(equipos) ? equipos.slice() : []).sort((a, b) => {
    const x = valorOrden(a, k, conteo);
    const y = valorOrden(b, k, conteo);
    if (x == null && y != null) return 1;
    if (y == null && x != null) return -1;
    if (x != null && y != null) {
      const r = comparar(x, y);
      if (r !== 0) return r * sentido;
    }
    const s = comparar(a.subestacion || '', b.subestacion || '');
    if (s !== 0) return s;
    return comparar(a.matricula || '', b.matricula || '');
  });
}

/** Opciones de los filtros, sacadas de los datos (nada fijo): zonas, departamentos y condiciones presentes. */
export function opcionesFiltro(equipos) {
  const zonas = new Map();
  const deps = new Map();
  const conds = new Set();
  let sinDato = false;
  for (const e of (Array.isArray(equipos) ? equipos : [])) {
    if (!e) continue;
    if (e.zona) { const k = plano(e.zona); if (!zonas.has(k)) zonas.set(k, String(e.zona)); }
    if (e.departamento) { const k = plano(e.departamento); if (!deps.has(k)) deps.set(k, String(e.departamento)); }
    const c = condicionDe(e);
    if (c == null) sinDato = true; else conds.add(c);
  }
  const ordenar = (arr) => arr.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const condiciones = [...conds].sort((a, b) => a - b).map(String);
  if (sinDato) condiciones.push('sd');
  return { zonas: ordenar([...zonas.values()]), departamentos: ordenar([...deps.values()]), condiciones };
}

/** ¿El parque llegó completo? Si llegan exactamente `limite` equipos, puede haber más (`limites_lectura.js:40`). */
export function posibleParqueIncompleto(n, limite) {
  return Number.isFinite(limite) && limite > 0 && Number(n) >= limite;
}
