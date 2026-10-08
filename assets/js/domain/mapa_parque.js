// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Mapa geográfico de Colombia: el parque resumido por territorio
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «te sitúes en el segmento de mapa en la página y vayas
// construyendo el mapa geográfico de Colombia en un máximo nivel».
// Etapa 1 (sin coordenadas): el parque se resume por DEPARTAMENTO REGISTRADO y por ZONA, con la
// salud OFICIAL del motor (`salud_actual.hi_final`, 1 muy bueno … 5 muy pobre). Nada se inventa:
// sin coordenada no hay punto, y sin salud el equipo cuenta en «sin dato».
// Módulo PURO (sin DOM ni Firebase); pruebas en tests/mapa_parque.test.js con datos sintéticos.
// ══════════════════════════════════════════════════════════════

import { municipioDeSubestacion } from './municipios_subestacion.js';

/** Departamentos de AFINIA: código DANE (DIVIPOLA) ↔ clave del parque. */
export const DPTO_DANE = Object.freeze({ '13': 'bolivar', '20': 'cesar', '23': 'cordoba', '47': 'magdalena', '70': 'sucre' });
export const DANE_DE_DPTO = Object.freeze(Object.fromEntries(Object.entries(DPTO_DANE).map(([k, v]) => [v, k])));

/**
 * Zona de un municipio cuando NO es la de su departamento. Derivada de la zona REGISTRADA de sus
 * subestaciones en el parque (lectura del 2026-10-07: las S/E de la región de Loba, Regidor y Río Viejo
 * están en ORIENTE). Los demás municipios siguen a su departamento: por eso las zonas son «aproximadas».
 */
export const ZONA_EXCEPCIONES = Object.freeze({ '13074': 'ORIENTE', '13300': 'ORIENTE', '13580': 'ORIENTE', '13600': 'ORIENTE', '13667': 'ORIENTE' });

/** Zona AFINIA de un municipio (código DIVIPOLA de 5 dígitos y su departamento de 2). */
export function zonaDeMunicipio(cod, dpto) {
  if (ZONA_EXCEPCIONES[cod]) return ZONA_EXCEPCIONES[cod];
  if (dpto === '13') return 'BOLIVAR';
  if (dpto === '23' || dpto === '70') return 'OCCIDENTE';
  return 'ORIENTE';
}

/** Nombres de la tabla oficial de municipios por subestación que el DANE escribe distinto → DIVIPOLA. */
export const ALIAS_MUNICIPIO = Object.freeze({ 'mompos': '13468', 'tolu viejo': '70823', 'san andres sotavento': '23670' });

/**
 * Código DIVIPOLA de un municipio de la tabla oficial, SIN adivinar: alias conocido, nombre exacto (en el
 * departamento registrado si hay homónimos) o el nombre como palabra inicial/final del DANE («CARTAGENA» →
 * «CARTAGENA DE INDIAS»). null si no queda uno solo.
 * @param {string} nombre        municipio de la tabla oficial
 * @param {string} dptoParque    departamento registrado (bolivar, cesar…)
 * @param {{cod:string, nom:string, dpto:string}[]} municipios  DANE
 */
export function codigoMunicipio(nombre, dptoParque, municipios) {
  const n = normal(nombre);
  if (!n) return null;
  if (ALIAS_MUNICIPIO[n]) return ALIAS_MUNICIPIO[n];
  const lista = Array.isArray(municipios) ? municipios : [];
  const dp = DANE_DE_DPTO[normal(dptoParque)];
  const unico = (xs) => {
    if (xs.length > 1 && dp) xs = xs.filter((m) => m.dpto === dp);
    return xs.length === 1 ? xs[0].cod : null;
  };
  const exacto = lista.filter((m) => normal(m.nom) === n);
  if (exacto.length) return unico(exacto);
  return unico(lista.filter((m) => normal(m.nom).startsWith(n + ' ') || normal(m.nom).endsWith(' ' + n)));
}

/**
 * Municipio (DIVIPOLA) de una subestación según la tabla oficial de Fichas (2026-09-10), SIN adivinar.
 * Manda el CÓDIGO de la matrícula (T1-M/M-VAC → VAC): el nombre solo no basta porque hay homónimos en
 * departamentos distintos (VALENCIA de Valledupar y de Córdoba; PUEBLO NUEVO de Córdoba y de Ariguaní).
 * Si sus transformadores apuntan a municipios distintos → null. Sin código en la tabla → por el nombre.
 * @param {{nombre:string, departamento:string, municipio?:string, tx:{matricula:string}[]}} sub
 * @param {{cod:string, nom:string, dpto:string}[]} municipios  DANE (área AFINIA)
 */
export function municipioDeSubestacionMapa(sub, municipios) {
  const s = sub || {};
  const porCodigo = [...new Set((s.tx || []).map((t) => municipioDeSubestacion({ matricula: t && t.matricula })).filter(Boolean))];
  if (porCodigo.length > 1) return null;
  const nombre = porCodigo[0] || municipioDeSubestacion({ subestacion: s.nombre }) || s.municipio;
  return nombre ? codigoMunicipio(nombre, s.departamento, municipios) : null;
}

/**
 * Código de la subestación al final de la matrícula (T1-M/M-VAC → VAC · T-KDR04 → KDR): la llave de
 * `/subestaciones/{código}`. Misma regla que la tabla oficial de Fichas (`municipios_subestacion.js`).
 */
export function codigoSubestacion(matricula) {
  const m = normal(matricula).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().match(/([A-Z]{2,4})\s*\d*$/);
  return m ? m[1] : '';
}

/** Rótulo corto del transformador dentro de su subestación: T1-M/M-VAC → «T1» · T-KDR04 → «KDR04». */
export function etiquetaTx(matricula) {
  const m = String(matricula || '').trim();
  const pref = m.match(/^T\d+[A-Z]?(?=[-/\s]|$)/i);     // T1-M/M-VAC · T2A-A/M-… · T3A/M-TER (sin guion tras la A)
  if (pref) return pref[0].toUpperCase();
  const partes = m.split(/[-/]/).filter(Boolean);
  return partes.length ? partes[partes.length - 1].toUpperCase() : '';
}

/** Recuadro de Colombia (con San Andrés): una posición fuera de él es un error de captura, no se dibuja. */
const COLOMBIA_LAT = [-4.3, 13.6];
const COLOMBIA_LNG = [-82, -66.8];

/**
 * Posiciones de las subestaciones (documentos de `/subestaciones`, id = código de la matrícula; `codigos_alias` = otros
 * códigos con que se la nombra, p. ej. el de la tabla de Fichas). Entra solo una coordenada válida dentro de Colombia de
 * una S/E activa; lo demás se ignora (sin posición no hay punto). Un alias nunca le quita la llave a un id.
 * `editadaAMano`: la coordenada ya no es la que respalda su procedencia (`ubicacion_fuente`).
 * @param {object[]} docs
 * @returns {Map<string, {id:string, coordenada:[number,number], nombre:string, departamento:string, municipio:string,
 *           fuente:object|null, confianza:string, verificacion:string, editadaAMano:boolean}>}
 */
export function indiceUbicaciones(docs) {
  const out = new Map();
  const alias = [];
  const repetidos = new Set();
  for (const d of Array.isArray(docs) ? docs : []) {
    // Llave = `codigo` (la página admin crea con id automático y deja editar el código); el id es un alias más.
    const cod = String((d && (d.codigo || d.id)) || '').trim().toUpperCase();
    if (!cod || d.activa === false || d.latitud == null || d.longitud == null || d.latitud === '' || d.longitud === '') continue;
    const lat = Number(d.latitud);
    const lng = Number(d.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < COLOMBIA_LAT[0] || lat > COLOMBIA_LAT[1] || lng < COLOMBIA_LNG[0] || lng > COLOMBIA_LNG[1]) continue;
    if (out.has(cod)) { repetidos.add(cod); continue; }    // dos documentos con el mismo código: no se elige uno a ciegas
    const f = d.ubicacion_fuente && typeof d.ubicacion_fuente === 'object' ? d.ubicacion_fuente : null;
    const editada = Boolean(f) && (Number(f.latitud) !== lat || Number(f.longitud) !== lng);
    const e = { id: cod, coordenada: [lat, lng], nombre: String(d.nombre || ''), departamento: normal(d.departamento),
      municipio: String(d.municipio || ''), fuente: f, confianza: editada ? '' : String((f && f.confianza) || ''),
      verificacion: editada ? '' : String((f && f.verificacion) || ''), editadaAMano: editada };
    out.set(cod, e);
    const otros = (Array.isArray(d.codigos_alias) ? d.codigos_alias : []).concat(d.id && String(d.id).toUpperCase() !== cod ? [d.id] : []);
    for (const a of otros) alias.push([String(a || '').trim().toUpperCase(), e]);
  }
  for (const cod of repetidos) out.delete(cod);
  for (const [a, e] of alias) if (a && !out.has(a) && !repetidos.has(a) && !repetidos.has(e.id)) out.set(a, e);
  return out;
}

/** Colores de zona (los de la plataforma). */
export const COLOR_ZONA = Object.freeze({ BOLIVAR: '#2563EB', OCCIDENTE: '#16A34A', ORIENTE: '#EA580C' });

/** Texto comparable: sin tildes, minúsculas y espacios simples. */
export function normal(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Banda oficial de salud (1…5) o null si el motor no la trae. `hi_final` es decimal (1,45…): se redondea
 *  a entero igual que el Parque (`parque-transformadores.html`), así las cifras coinciden (85/83/16/15/9). */
export function bandaDe(tx) {
  const v = Number(tx && tx.salud_actual && tx.salud_actual.hi_final);
  if (!Number.isFinite(v)) return null;
  const b = Math.round(v);
  return b >= 1 && b <= 5 ? b : null;
}

/** Coordenada válida del equipo (la de `ubicacion.*` primero), o null. */
export function coordenadaDe(tx) {
  const u = (tx && tx.ubicacion) || {};
  const lat = Number(u.latitud != null && u.latitud !== '' ? u.latitud : tx && tx.latitud);
  const lng = Number(u.longitud != null && u.longitud !== '' ? u.longitud : tx && tx.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/** Lo que el mapa necesita de un transformador v2. `cargas` (opcional): id → cifra de Cargabilidad SCADA del mes
 *  (`{pct, crg, clase, motivo}`, la MISMA de la página Cargabilidad SCADA: `domain/scada_carga_vista.js#filasLista`). */
export function fichaTx(tx, cargas = null) {
  const id = (tx && tx.identificacion) || {};
  const u = (tx && tx.ubicacion) || {};
  const kva = Number(tx && tx.placa && tx.placa.potencia_kva);
  return {
    id: String((tx && tx.id) || ''),
    codigo: String(id.codigo || (tx && tx.codigo) || ''),
    matricula: String(id.matricula || (tx && tx.matricula) || ''),
    tipo: String(id.tipo_activo || ''),
    grupo: String(id.grupo || ''),
    mva: Number.isFinite(kva) && kva > 0 ? Math.round(kva / 10) / 100 : null,
    banda: bandaDe(tx),
    subestacionId: String(u.subestacionId || ''),
    subestacion: String(u.subestacion_nombre || (tx && tx.subestacion) || ''),
    departamento: normal(u.departamento || (tx && tx.departamento) || ''),
    zona: String(u.zona || '').toUpperCase(),
    municipio: String(u.municipio || (tx && tx.municipio) || ''),
    coordenada: coordenadaDe(tx),
    // Si la matrícula falta (editar en Inventario la puede vaciar), el código del equipo es la misma matrícula.
    codigoSE: codigoSubestacion(id.matricula || (tx && tx.matricula) || id.codigo || (tx && tx.codigo) || ''),
    etiqueta: etiquetaTx(id.matricula || (tx && tx.matricula) || ''),
    ...cargaDe(tx && tx.id, cargas)
  };
}

/** Cifra SCADA del equipo (o vacía): CRG 1…5 solo si hay porcentaje; sin él, «sin medición» con su motivo. */
function cargaDe(id, cargas) {
  const c = id && cargas && typeof cargas.get === 'function' ? cargas.get(String(id)) : null;
  const pct = c && Number.isFinite(Number(c.pct)) && c.pct !== null ? Number(c.pct) : null;
  const crg = pct != null && [1, 2, 3, 4, 5].includes(Number(c.crg)) ? Number(c.crg) : null;
  return { cargaPct: pct, crg, cargaClase: crg == null ? 'nulo' : (c.clase === 'firme' ? 'firme' : 'provisional'),
    cargaMotivo: c ? String(c.motivo || '') : '' };
}

/** Valores elegidos de un filtro múltiple (lista o un valor suelto); vacío = todos. */
const elegidos = (v) => (Array.isArray(v) ? v : (v === '' || v == null ? [] : [v])).map(String);

const bandasVacias = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, sin: 0 });
/** Una subestación = su id; sin id, su nombre + departamento (hay homónimos en departamentos distintos). */
const claveSE = (f) => f.subestacionId || ('#' + normal(f.subestacion) + '|' + f.departamento);
const peorDe = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));

/**
 * ¿Pasa el equipo los filtros del mapa? zona, departamento, tipo; salud oficial `bandas` (varias a la vez: '1'…'5', 'sin';
 * `banda` suelta sigue valiendo); Cargabilidad SCADA `crgs` (varias: '1'…'5', 'sin' = sin medición) y `soloFirmes`.
 */
export function pasaFiltros(f, filtros = {}) {
  if (filtros.zona && f.zona !== filtros.zona) return false;
  if (filtros.departamento && f.departamento !== filtros.departamento) return false;
  if (filtros.tipo && f.tipo !== filtros.tipo) return false;
  const bandas = elegidos(filtros.bandas != null ? filtros.bandas : filtros.banda);
  if (bandas.length && !bandas.includes(f.banda == null ? 'sin' : String(f.banda))) return false;
  const crgs = elegidos(filtros.crgs);
  if (crgs.length && !crgs.includes(f.crg == null ? 'sin' : String(f.crg))) return false;
  if (filtros.soloFirmes && f.cargaClase !== 'firme') return false;
  return true;
}

/**
 * Resumen del parque para el mapa.
 * @param {object[]} txs  documentos v2 de /transformadores
 * @param {object} [filtros]
 * @param {Map} [ubicaciones]  `indiceUbicaciones(/subestaciones)`: la posición de la S/E manda sobre la de cada equipo
 * @returns {{ total:number, bandas:object, subestaciones:object[], porDepartamento:object, porZona:object,
 *             ubicadas:number, sinUbicar:number }}
 */
export function resumenParque(txs, filtros = {}, ubicaciones = null, cargas = null) {
  const todas = (Array.isArray(txs) ? txs : []).map((t) => fichaTx(t, cargas));
  // El código de cada S/E sale de TODOS sus equipos (no de los filtrados): un filtro de salud no mueve una instalación.
  const codigosDe = new Map();
  for (const f of todas) {
    const k = claveSE(f);
    if (!codigosDe.has(k)) codigosDe.set(k, new Set());
    if (f.codigoSE) codigosDe.get(k).add(f.codigoSE);
  }
  const fichas = todas.filter((f) => pasaFiltros(f, filtros));
  const subs = new Map();
  const porDepartamento = {};
  const porZona = {};
  const bandas = bandasVacias();
  const crgs = bandasVacias();
  const crgsFirmes = bandasVacias();
  for (const f of fichas) {
    bandas[f.banda == null ? 'sin' : f.banda]++;
    crgs[f.crg == null ? 'sin' : f.crg]++;
    if (f.cargaClase === 'firme') crgsFirmes[f.crg]++;
    const ks = claveSE(f);
    const s = subs.get(ks) || { clave: ks, id: f.subestacionId, nombre: f.subestacion || '(sin subestación)',
      departamento: f.departamento, zona: f.zona, municipio: f.municipio, coordenada: null, peor: null, tx: [] };
    s.tx.push(f);
    s.peor = peorDe(s.peor, f.banda);
    if (!s.coordenada && f.coordenada) s.coordenada = f.coordenada;
    if (!s.municipio && f.municipio) s.municipio = f.municipio;
    subs.set(ks, s);
    for (const [mapa, k] of [[porDepartamento, f.departamento || 'sin departamento'], [porZona, f.zona || 'SIN ZONA']]) {
      const x = mapa[k] || { transformadores: 0, subestaciones: new Set(), bandas: bandasVacias(), peor: null, mva: 0 };
      x.transformadores++;
      x.subestaciones.add(ks);
      x.bandas[f.banda == null ? 'sin' : f.banda]++;
      x.peor = peorDe(x.peor, f.banda);
      if (f.mva) x.mva += f.mva;
      mapa[k] = x;
    }
  }
  const cerrar = (m) => Object.fromEntries(Object.entries(m).map(([k, x]) =>
    [k, { ...x, subestaciones: x.subestaciones.size, mva: Math.round(x.mva * 10) / 10 }]));
  const lista = [...subs.values()].map((s) => {
    // Código de la S/E: el de sus matrículas, si todas dicen el mismo (si discrepan no se adivina).
    const cods = [...(codigosDe.get(s.clave) || [])];
    const codigo = cods.length === 1 ? cods[0] : '';
    const cand = codigo && ubicaciones && typeof ubicaciones.get === 'function' ? ubicaciones.get(codigo) : null;
    // Doble llave: el código Y el nombre + departamento registrados. Si el equipo cambió de S/E sin cambiar su matrícula,
    // el código apuntaría a otra posición: no se pone punto y la S/E queda «por revisar» (nunca se adivina).
    const casa = cand && normal(cand.nombre) === normal(s.nombre) && cand.departamento === s.departamento;
    const ub = casa ? cand : null;
    return { ...s, codigo, ubicacion: ub, porRevisar: cand && !casa ? `la posición ${cand.id} es de «${cand.nombre}» (${cand.departamento})` : '',
      // Con índice, el ÚNICO origen del punto es el documento validado de la S/E (la coordenada suelta de un equipo no
      // se dibuja ni cuenta como «validada»). Sin índice (uso anterior), la del equipo.
      coordenada: ubicaciones ? (ub ? ub.coordenada : null) : s.coordenada,
      tx: s.tx.slice().sort((a, b) => (b.banda || 0) - (a.banda || 0) || a.codigo.localeCompare(b.codigo, 'es')) };
  })
    .sort((a, b) => (b.peor || 0) - (a.peor || 0) || b.tx.length - a.tx.length || a.nombre.localeCompare(b.nombre, 'es'));
  const ubicadas = lista.filter((s) => s.coordenada).length;
  return { total: fichas.length, bandas, crgs, crgsFirmes, subestaciones: lista, porDepartamento: cerrar(porDepartamento),
    porZona: cerrar(porZona), ubicadas, sinUbicar: lista.length - ubicadas };
}

/**
 * Buscador único del mapa: municipios, subestaciones y transformadores.
 * @param {string} texto
 * @param {{ municipios?: {cod:string, nom:string, dpto:string}[], subestaciones?: object[] }} indices
 * @returns {{ tipo:'municipio'|'subestacion'|'transformador', etiqueta:string, ref:object }[]} (máx. 12)
 */
export function buscarEnMapa(texto, { municipios = [], subestaciones = [] } = {}) {
  const q = normal(texto);
  if (q.length < 2) return [];
  const out = [];
  const empieza = (s) => normal(s).startsWith(q);
  const contiene = (s) => normal(s).includes(q);
  const ordenar = (a, b) => (a.primero === b.primero ? a.etiqueta.localeCompare(b.etiqueta, 'es') : a.primero ? -1 : 1);
  const m = municipios.filter((x) => contiene(x.nom) || x.cod === q)
    .map((x) => ({ tipo: 'municipio', etiqueta: `${x.nom} (municipio)`, ref: x, primero: empieza(x.nom) }));
  const s = subestaciones.filter((x) => contiene(x.nombre))
    .map((x) => ({ tipo: 'subestacion', etiqueta: `S/E ${x.nombre}`, ref: x, primero: empieza(x.nombre) }));
  const t = [];
  for (const sub of subestaciones) {
    for (const f of sub.tx) {
      if (contiene(f.codigo) || contiene(f.matricula)) {
        t.push({ tipo: 'transformador', etiqueta: `${f.matricula || f.codigo} · S/E ${sub.nombre}`, ref: { ...f, sub }, primero: empieza(f.matricula) || empieza(f.codigo) });
      }
    }
  }
  for (const grupo of [m, s, t]) out.push(...grupo.sort(ordenar));
  return out.slice(0, 12).map(({ primero, ...x }) => x);
}
