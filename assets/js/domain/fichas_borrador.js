// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · BORRADOR LOCAL (99 §83)
// ──────────────────────────────────────────────────────────────
// Todo lo que el Ingeniero redacta para el documento que se FIRMA —proyecto,
// consecutivo, alcance, beneficios, presupuesto, quiénes firman, el Anexo AT y
// los dos diagramas— vivía SOLO en memoria: cerrar la pestaña, pulsar F5 o
// adjuntar un listado se lo llevaba sin decir nada (CF-01).
//
// Esta pieza es PURA: da forma, valida, fusiona y poda. No conoce el navegador
// ni `localStorage` —eso es un adaptador de quince líneas en la pantalla—, así
// que todo lo que decide se puede probar sin abrir Chrome.
//
// LAS CINCO REGLAS QUE EL COMITÉ IMPUSO (y que aquí son código, no intención):
//
//   1. GUARDAR ES FUSIONAR CONTRA EL DISCO, nunca volcar la memoria. La
//      memoria de una sesión está casi vacía al empezar: escribirla encima
//      borraría las fichas que aún no se han restaurado. `fusionar()` solo
//      añade o pisa los equipos que ESTA sesión tocó de verdad; un mapa vacío
//      NUNCA se traduce en un borrado.
//   2. LA IDENTIDAD ES EL APARATO, no el patio. La clave sale de
//      `identidadDeEquipo` (matrícula o serie, `§82`): sin ninguna de las dos
//      no se guarda, y la subestación viaja solo para poder enseñarla.
//   3. SE GUARDA LO QUE ÉL TECLEÓ, tal cual, y nada del parque. Ni caché de
//      Firestore en el navegador, ni cifras reinterpretadas al volver.
//   4. LO QUE VUELVE DEL DISCO ES ENTRADA NO CONFIABLE. Cualquiera puede
//      escribir en `localStorage` (una extensión, la consola). Se parsea con
//      lista blanca, se rechazan `__proto__`/`constructor`/`prototype` y el
//      mapa se construye sin prototipo. Quien lo pinte usa `.value` y
//      `.textContent`, nunca `innerHTML`.
//   5. EL BORRADOR ES DE SU DUEÑO Y NO ES ETERNO. Lleva el `uid` de la sesión
//      (opaco, nunca el correo): otro usuario del mismo computador no lo ve.
//      Y caduca a los 30 días, que es lo que justifica guardar los nombres de
//      quienes firman.
// ══════════════════════════════════════════════════════════════

import { identidadDeEquipo, mismaIdentidad } from './fichas_identidad.js';

export const CLAVE_ALMACEN = 'ssee.ficha.borrador.v1';
export const VERSION = 1;
/** Topes: el almacén del navegador lo comparten otros módulos del sitio. */
export const TOPE_EQUIPOS = 40;
export const TOPE_BYTES = 400 * 1024;
export const TOPE_CAMPO = 8000;
export const DIAS_VIDA = 30;

const LLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);
const DIAGRAMAS = ['actual', 'futuro'];

/* ── saneado de valores ──────────────────────────────────────── */

/** Texto tal como se tecleó, sin caracteres de control y con tope de largo. */
function limpiarTexto(v) {
  // eslint-disable-next-line no-control-regex
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return s.length > TOPE_CAMPO ? s.slice(0, TOPE_CAMPO) : s;
}

/**
 * Valores admitidos en `plan`/`anexo`: lo que la pantalla escribe de verdad —
 * texto, número (la versión de redacción elegida), booleano y la lista de
 * acciones marcadas—. Cualquier otra cosa se descarta en vez de viajar.
 */
function limpiarValor(v) {
  if (typeof v === 'string') return limpiarTexto(v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    const l = v.filter((x) => typeof x === 'string').map(limpiarTexto).slice(0, 200);
    return l;
  }
  return undefined;
}

function limpiarMapa(src) {
  const out = {};
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const k of Object.keys(src)) {
    if (LLAVES_PROHIBIDAS.has(k)) continue;
    if (k.length > 80) continue;
    const v = limpiarValor(src[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function limpiarDiagramas(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const w of DIAGRAMAS) {
    const m = limpiarMapa(src[w]);
    if (Object.keys(m).length) out[w] = m;
  }
  return out;
}

function fecha(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * De los dos diagramas, SOLO lo que se apartó de la semilla del equipo.
 * Exportar el diagrama entero guardaba en el navegador la placa del parque
 * —contra la regla 3— y, de paso, hacía que una ficha en blanco contara como
 * redactada: el borrador ofrecía de vuelta fichas que nadie había escrito.
 */
export function soloLoTocado(diagramas, semillas) {
  const out = {};
  const src = diagramas || {};
  const sem = semillas || {};
  for (const w of DIAGRAMAS) {
    const a = src[w];
    if (!a || typeof a !== 'object') continue;
    const s = (sem[w] && typeof sem[w] === 'object') ? sem[w] : {};
    const dif = {};
    for (const k of Object.keys(a)) {
      const v = a[k];
      if (v == null || v === '') continue;
      if (String(v) === String(s[k] == null ? '' : s[k])) continue;
      dif[k] = v;
    }
    if (Object.keys(dif).length) out[w] = dif;
  }
  return limpiarDiagramas(out);
}

/* ── forma del documento ─────────────────────────────────────── */

export function documentoVacio(uid) {
  return { v: VERSION, duenoUid: uid ? String(uid) : '', guardadoISO: '', equipos: Object.create(null) };
}

/**
 * ¿Esta entrada tiene algo escrito, o es una ficha en blanco?
 * Los campos `*_ver` NO cuentan: son la anotación de qué redacción se eligió,
 * no texto. Sin esto, tocar el selector y volver a dejarlo vacío dejaba en el
 * borrador una ficha sin una sola palabra, que la banda ofrecía de vuelta.
 */
export function tieneContenido(entrada) {
  if (!entrada) return false;
  const conAlgo = (m) => !!m && Object.keys(m).some((k) => {
    if (k.endsWith('_ver')) return false;
    // `sel_<casilla>` solo dice que la casilla de firma está en «Otra persona»:
    // sin un nombre escrito no hay trabajo que proteger (`99 §89`).
    if (k.startsWith('sel_')) return false;
    // Texto que compuso el MÓDULO, no él: cuando el campo tiene una versión
    // elegida por índice, su contenido se puede rehacer en cualquier momento a
    // partir de `_ver`. No es trabajo del Ingeniero y no puede contar como tal:
    // si contara, abrir una ficha bastaría para que el borrador guardado se
    // saltara al restaurar —«omitida porque ya tenía texto en pantalla»— y su
    // redacción de ayer se perdería (`99 §85`). Lo escrito a mano lleva
    // `_ver: 'custom'` y sí cuenta.
    if (typeof m[k + '_ver'] === 'number') return false;
    const v = m[k];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim() !== '';
    return v != null && v !== '';
  });
  return conAlgo(entrada.plan) || conAlgo(entrada.anexo)
    || DIAGRAMAS.some((w) => conAlgo((entrada.diagramas || {})[w]));
}

/**
 * Entrada de borrador a partir de lo que hay en pantalla para UN equipo.
 * Devuelve `null` si el equipo no se puede identificar (regla 2) o si no hay
 * nada escrito: un borrador vacío no se guarda, solo haría ruido en la banda.
 */
export function entradaDesdeFicha({ equipo, plan, anexo, diagramas, ahoraISO }) {
  const ident = identidadDeEquipo(equipo);
  if (!ident) return null;
  const entrada = {
    clave: ident.clave,
    matricula: ident.matricula,
    serie: ident.serie,
    subestacion: ident.subestacion,
    plan: limpiarMapa(plan),
    anexo: limpiarMapa(anexo),
    diagramas: limpiarDiagramas(diagramas),
    tocadoISO: ahoraISO || ''
  };
  return tieneContenido(entrada) ? entrada : null;
}

/* ── leer lo que hay en disco (entrada NO confiable) ─────────── */

/**
 * @returns {{estado:'ok'|'vacio'|'ajeno'|'futuro'|'corrupto', doc:object|null,
 *            caducados:number}}
 *   'futuro'  → lo escribió una versión más nueva de la página: ni se lee ni se
 *               escribe encima (perderíamos el borrador bueno).
 *   'ajeno'   → es de otro usuario de este mismo computador: no se muestra.
 */
export function leerDocumento(crudo, opciones = {}) {
  const { uid = '', ahoraISO = '' } = opciones;
  if (crudo == null || crudo === '') return { estado: 'vacio', doc: null, caducados: 0 };
  let bruto;
  try { bruto = JSON.parse(String(crudo)); } catch (_) { return { estado: 'corrupto', doc: null, caducados: 0 }; }
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return { estado: 'corrupto', doc: null, caducados: 0 };
  }
  const v = Number(bruto.v);
  if (Number.isFinite(v) && v > VERSION) return { estado: 'futuro', doc: null, caducados: 0 };
  if (v !== VERSION) return { estado: 'corrupto', doc: null, caducados: 0 };

  const dueno = typeof bruto.duenoUid === 'string' ? bruto.duenoUid : '';
  if (uid && dueno && dueno !== String(uid)) return { estado: 'ajeno', doc: null, caducados: 0 };

  const doc = documentoVacio(dueno || uid);
  doc.guardadoISO = typeof bruto.guardadoISO === 'string' ? limpiarTexto(bruto.guardadoISO) : '';
  const eq = (bruto.equipos && typeof bruto.equipos === 'object' && !Array.isArray(bruto.equipos))
    ? bruto.equipos : {};
  const limite = fecha(ahoraISO);
  let caducados = 0;
  for (const k of Object.keys(eq)) {
    if (LLAVES_PROHIBIDAS.has(k) || k.length > 200) continue;
    const src = eq[k];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    const entrada = {
      clave: limpiarTexto(src.clave != null ? src.clave : k),
      matricula: limpiarTexto(src.matricula || ''),
      serie: limpiarTexto(src.serie || ''),
      subestacion: limpiarTexto(src.subestacion || ''),
      plan: limpiarMapa(src.plan),
      anexo: limpiarMapa(src.anexo),
      diagramas: limpiarDiagramas(src.diagramas),
      tocadoISO: typeof src.tocadoISO === 'string' ? limpiarTexto(src.tocadoISO) : ''
    };
    if (!entrada.matricula && !entrada.serie) continue;   // regla 2
    if (!tieneContenido(entrada)) continue;
    const t = fecha(entrada.tocadoISO);
    if (limite != null && t != null && (limite - t) > DIAS_VIDA * 86400000) { caducados++; continue; }
    doc.equipos[k] = entrada;
  }
  const n = Object.keys(doc.equipos).length;
  return { estado: n ? 'ok' : 'vacio', doc: n ? doc : null, caducados };
}

/* ── guardar = fusionar contra el disco (regla 1) ────────────── */

/**
 * Funde en el documento del disco SOLO los equipos que esta sesión tocó.
 * Nunca quita lo que no se le mandó quitar, así que un `ESTADOS.clear()` o una
 * pestaña recién abierta no pueden borrar el trabajo de ayer ni el de la otra
 * pestaña. Entre dos versiones del mismo equipo gana la de `tocadoISO` mayor.
 */
export function fusionar(docDisco, entradas, opciones = {}) {
  const { uid = '', ahoraISO = '' } = opciones;
  const base = (docDisco && docDisco.equipos) ? docDisco : documentoVacio(uid);
  const doc = documentoVacio(base.duenoUid || uid);
  for (const k of Object.keys(base.equipos)) doc.equipos[k] = base.equipos[k];

  for (const entrada of (entradas || [])) {
    if (!entrada || !entrada.clave) continue;
    if (LLAVES_PROHIBIDAS.has(entrada.clave)) continue;
    const previo = doc.equipos[entrada.clave];
    if (previo) {
      const tp = fecha(previo.tocadoISO);
      const tn = fecha(entrada.tocadoISO);
      if (tp != null && tn != null && tn < tp) continue;   // el disco es más nuevo: no se pisa
    }
    doc.equipos[entrada.clave] = entrada;
  }
  doc.guardadoISO = ahoraISO || doc.guardadoISO;
  return podar(doc);
}

/**
 * Poda por tope de equipos y de tamaño, sacrificando primero lo más viejo.
 * @returns {{...doc, evicciones:number}} — el documento ya cabe en el almacén.
 */
export function podar(doc) {
  const claves = Object.keys(doc.equipos);
  const porEdad = claves.slice().sort((a, b) => {
    const ta = fecha(doc.equipos[a].tocadoISO) || 0;
    const tb = fecha(doc.equipos[b].tocadoISO) || 0;
    return ta - tb;                                    // el más viejo primero
  });
  let evicciones = 0;
  while (Object.keys(doc.equipos).length > TOPE_EQUIPOS && porEdad.length) {
    delete doc.equipos[porEdad.shift()];
    evicciones++;
  }
  while (serializar(doc).length > TOPE_BYTES && porEdad.length > 1) {
    delete doc.equipos[porEdad.shift()];
    evicciones++;
  }
  doc.evicciones = evicciones;
  return doc;
}

export function serializar(doc) {
  const plano = { v: VERSION, duenoUid: doc.duenoUid || '', guardadoISO: doc.guardadoISO || '', equipos: {} };
  for (const k of Object.keys(doc.equipos)) plano.equipos[k] = doc.equipos[k];
  return JSON.stringify(plano);
}

/* ── restaurar: emparejar con lo que hay en pantalla ─────────── */

/**
 * Decide qué borradores pueden volver a la pantalla actual.
 *  · `aplicables`  — identidad exacta con UN equipo de la lista y ficha en
 *                    blanco en memoria (no se pisa lo tecleado hoy).
 *  · `ocupados`    — calzan, pero esa ficha ya tiene contenido en pantalla.
 *  · `ambiguos`    — calzan con más de un equipo: no se aplica ninguno.
 *  · `sinUbicar`   — su equipo no está en la lista cargada (se conservan).
 */
export function emparejar(doc, equipos, yaEscrita) {
  const res = { aplicables: [], ocupados: [], ambiguos: [], sinUbicar: [] };
  if (!doc || !doc.equipos) return res;
  const vivos = (equipos || [])
    .map((e) => ({ equipo: e, ident: identidadDeEquipo(e) }))
    .filter((x) => x.ident);

  for (const k of Object.keys(doc.equipos)) {
    const entrada = doc.equipos[k];
    const calzan = vivos.filter((x) => mismaIdentidad(entrada, x.ident));
    if (calzan.length === 0) { res.sinUbicar.push(entrada); continue; }
    if (calzan.length > 1) { res.ambiguos.push(entrada); continue; }
    const destino = calzan[0].equipo;
    if (typeof yaEscrita === 'function' && yaEscrita(destino)) { res.ocupados.push(entrada); continue; }
    res.aplicables.push({ entrada, equipo: destino });
  }
  return res;
}

/**
 * Lo que puede decir la banda de restauración: CUÁNTAS y DE QUÉ EQUIPOS.
 * Nunca presupuesto ni nombres de quienes firman — esa banda sale en pantalla
 * al abrir el módulo, que muchas veces es proyectando en un comité.
 */
export function resumenParaBanda(doc, opciones = {}) {
  const { tope = 5 } = opciones;
  const claves = doc && doc.equipos ? Object.keys(doc.equipos) : [];
  const items = claves
    .map((k) => doc.equipos[k])
    .sort((a, b) => (fecha(b.tocadoISO) || 0) - (fecha(a.tocadoISO) || 0));
  return {
    total: items.length,
    guardadoISO: (doc && doc.guardadoISO) || '',
    equipos: items.slice(0, tope).map((e) => ({
      matricula: e.matricula || e.serie,
      subestacion: e.subestacion,
      tocadoISO: e.tocadoISO
    })),
    resto: Math.max(0, items.length - tope)
  };
}
