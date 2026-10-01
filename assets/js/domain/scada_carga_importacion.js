// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · orquestación pura de la importación · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// La carpeta del mes se lee EN EL NAVEGADOR (un worker): nada se sube como archivo. Solo se
// toman las filas de las estaciones homologadas (sus claves y TODO swTrafo de la estación, para
// que confirmar otro punto de la misma estación tenga efecto sin volver a cargar), de los
// archivos 'average' (valores) y 'quality' (banderas) y —desde §126, SOLO para ver— 'max', 'min'
// y 'current' (el «max» del SCADA trae picos falsos: nunca entra en la cifra). Los .xls se ignoran
// (son copias de sus CSV).
// Pasos: acumular por día → armar meses por rótulo → fundir con lo guardado → limpiar →
// resumir → simular (veredicto en lenguaje llano) → plan de escritura en lotes.
// Funciones PURAS: cero DOM, cero Firebase. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { FAMILIAS, NIVELES, ESCRITURA, CODIGO, TIEMPO } from './scada_carga_config.js';
import { EXTRAS, EXTRA_DE_ESTADISTICO, LOTE_MAX_BYTES } from './scada_carga_extras.js';
import { leerArchivo, estadisticoDeNombre, fechaDeNombre, fechaDeCarpeta, claveId } from './scada_carga_csv.js';
import { limpiarNivel, conteoCodigos } from './scada_carga_limpieza.js';
import { horasMes, diasMes, idxDe, empaquetar, fusionarCrudo, igualBytes, mesDeFecha } from './scada_carga_series.js';
import { resumenFisico } from './scada_carga_kpis.js';
import { nombreMes } from './scada_carga_fecha.js';

const TOL = 1e-6;

/** Acumulador vacío de una importación. */
export function crearAcumulador() {
  return {
    dias: new Map(),            // `${cid}|${nivel}|${fam}|${fecha}` → {v, b, pv}
    extras: new Map(),          // misma clave → {max?, min?, ins?} (Float32Array(24); NaN = sin dato) · `99 §126`
    puntos: new Map(),          // cid → {clave, est, elem, niveles: {N: {kv, texto}}}
    fechas: new Map(),          // fecha → archivos average leídos
    archivos: { average: 0, quality: 0, max: 0, min: 0, current: 0, extrasInvalidos: 0, otrosEstadisticos: 0, noCsv: 0, vacios: 0, encabezadoInvalido: 0, sinEstadistico: 0 },
    discrepancias: { fechaNombre: 0, fechaCarpeta: 0, ejemplos: [] },
    conflictos: 0,
    invalidos: []
  };
}

/**
 * Agrega un archivo al acumulador.
 * @param {{nombre: string, ruta: string, texto: string|null, tamano: number}} arch
 * @param {{quiere: Function}} objetivo
 */
export function acumularArchivo(acc, arch, objetivo) {
  const nombre = arch.nombre || '';
  if (!/\.csv$/i.test(nombre)) { acc.archivos.noCsv++; return; }
  if (!arch.tamano) { acc.archivos.vacios++; return; }
  const est = estadisticoDeNombre(nombre);
  const extra = est ? EXTRA_DE_ESTADISTICO[est] : null;
  if (extra) { acumularExtra(acc, arch, objetivo, est, extra); return; }
  // Defensa: hoy estadisticoDeNombre solo da average/quality/max/min/current, así que no se alcanza.
  if (est && est !== 'average' && est !== 'quality') { acc.archivos.otrosEstadisticos++; return; }
  if (!est) acc.archivos.sinEstadistico++;
  const r = leerArchivo(arch.texto, objetivo, { estadistico: est });
  if (!r.ok) { acc.archivos.encabezadoInvalido++; if (acc.invalidos.length < ESCRITURA.detalleMaxItems) acc.invalidos.push(arch.ruta); return; }
  acc.archivos[r.tipo]++;
  if (r.tipo === 'average') acc.fechas.set(r.fecha, (acc.fechas.get(r.fecha) || 0) + 1);
  const fn = fechaDeNombre(nombre);
  if (fn && fn !== r.fecha) { acc.discrepancias.fechaNombre++; }
  const fc = fechaDeCarpeta(arch.ruta, r.anio);
  if (fc && fc !== r.fecha) {
    acc.discrepancias.fechaCarpeta++;
    if (acc.discrepancias.ejemplos.length < 20) acc.discrepancias.ejemplos.push({ ruta: arch.ruta, fecha: r.fecha });
  }
  for (const f of r.filas) {
    const cid = claveId(f.est, f.elem);
    if (!acc.puntos.has(cid)) acc.puntos.set(cid, { clave: '/' + f.est + '/' + f.elem, est: f.est, elem: f.elem, niveles: {} });
    const p = acc.puntos.get(cid);
    if (!p.niveles[f.nivel]) p.niveles[f.nivel] = { kv: NIVELES[f.nivel].kv, texto: f.nivelTexto };
    const key = cid + '|' + f.nivel + '|' + f.familia + '|' + r.fecha;
    let d = acc.dias.get(key);
    if (!d) { d = { v: new Float32Array(24).fill(NaN), b: new Uint8Array(24), pv: new Uint8Array(24) }; acc.dias.set(key, d); }
    if (f.valores) {
      for (let h = 0; h < 24; h++) {
        const x = f.valores[h];
        if (!d.pv[h]) { d.v[h] = x; d.pv[h] = 1; continue; }
        const a = d.v[h];
        if (Number.isNaN(a) && !Number.isNaN(x)) { d.v[h] = x; continue; }
        if (Number.isFinite(a) && Number.isFinite(x) && Math.abs(a - x) > TOL * Math.max(1, Math.abs(a))) acc.conflictos++;
      }
    } else if (f.banderas) {
      for (let h = 0; h < 24; h++) if (!d.b[h]) d.b[h] = f.banderas[h];
    }
  }
}

/**
 * Máximo, mínimo o instantáneo de cada hora (`99 §126`): solo para VER. No cuentan para los días del
 * mes, las discrepancias ni el veredicto (que siguen siendo los de promedio y calidad); un punto o nivel
 * que solo traiga extras no se crea (armarMeses solo los usa donde hay promedio o calidad ese día).
 */
function acumularExtra(acc, arch, objetivo, est, extra) {
  const r = leerArchivo(arch.texto, objetivo, { estadistico: 'average' });
  if (!r.ok) { acc.archivos.extrasInvalidos++; return; }
  acc.archivos[est]++;
  for (const f of r.filas) {
    if (!f.valores) continue;
    const key = claveId(f.est, f.elem) + '|' + f.nivel + '|' + f.familia + '|' + r.fecha;
    let e = acc.extras.get(key);
    if (!e) { e = {}; acc.extras.set(key, e); }
    if (!e[extra]) e[extra] = new Float32Array(24).fill(NaN);
    for (let h = 0; h < 24; h++) if (Number.isNaN(e[extra][h]) && !Number.isNaN(f.valores[h])) e[extra][h] = f.valores[h];
  }
}

/**
 * Meses presentes en el acumulador y su clasificación: el PRINCIPAL (más días) se marca; los
 * meses sueltos (pocos días, p. ej. un día traspapelado en otra carpeta) y los de otro año no.
 * @returns {Array<{mes, dias: number, diasMes: number, principal: boolean, marcado: boolean, nota: string}>}
 */
export function clasificarMeses(acc) {
  const porMes = new Map();
  for (const f of acc.fechas.keys()) porMes.set(mesDeFecha(f), (porMes.get(mesDeFecha(f)) || 0) + 1);
  if (!porMes.size) return [];
  const orden = [...porMes.entries()].sort((a, b) => b[1] - a[1]);
  const [principal] = orden[0];
  const anio = principal.slice(0, 4);
  return [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, dias]) => {
    const esPrincipal = mes === principal;
    const otroAnio = mes.slice(0, 4) !== anio;
    const suelto = !esPrincipal && dias <= 3;
    return {
      mes, dias, diasMes: diasMes(mes), principal: esPrincipal, marcado: esPrincipal || (!otroAnio && !suelto),
      nota: otroAnio ? 'otro año' : (suelto ? dias + (dias === 1 ? ' día suelto' : ' días sueltos') + ' dentro de la carpeta' : '')
    };
  });
}

/**
 * Arma los meses pedidos: por punto y nivel, series CRUDAS {v, b, presente} del largo del mes.
 * @returns {Map<string, Map<string, Object<string, Object<string, {v, b, presente}>>>>} mes → cid → nivel → fam
 */
export function armarMeses(acc, meses) {
  const quiero = new Set(meses);
  const out = new Map();
  for (const [key, d] of acc.dias) {
    const [cid, nivel, fam, fecha] = key.split('|');
    const mes = mesDeFecha(fecha);
    if (!quiero.has(mes)) continue;
    const n = horasMes(mes);
    if (!out.has(mes)) out.set(mes, new Map());
    const pm = out.get(mes);
    if (!pm.has(cid)) pm.set(cid, {});
    const pn = pm.get(cid);
    if (!pn[nivel]) pn[nivel] = {};
    if (!pn[nivel][fam]) pn[nivel][fam] = { v: new Float32Array(n).fill(NaN), b: new Uint8Array(n), presente: new Uint8Array(n) };
    const s = pn[nivel][fam];
    const dia = +fecha.slice(8, 10);
    for (let h = 0; h < 24; h++) {
      const i = idxDe(dia, h);
      if (d.pv[h]) { s.v[i] = d.v[h]; s.presente[i] = 1; }
      s.b[i] = d.b[h];
    }
    // Extras del mismo punto, nivel, familia y día (solo donde hay promedio o calidad).
    const x = acc.extras && acc.extras.get(key);
    if (x) {
      for (const k of EXTRAS) {
        if (!x[k]) continue;
        if (!s[k]) s[k] = new Float32Array(n).fill(NaN);
        for (let h = 0; h < 24; h++) s[k][idxDe(dia, h)] = x[k][h];
      }
    }
  }
  return out;
}

/**
 * Funde un punto-mes nuevo con lo guardado (desempaquetado), limpia y devuelve el documento y su resumen.
 * @param {object|null} guardado  {niveles: {N: {fam: {IR: {v: Float32Array, m, b}}}}} o null
 * @returns {{niveles: Object, resumen: Object, conteos: Object, conflictos: number, nuevas: number}}
 */
export function procesarPuntoMes(nuevo, guardado, modo = 'completar') {
  const niveles = {}; const resumen = {}; const conteos = {};
  let conflictos = 0; let nuevas = 0;
  const nivelesTodos = new Set([...Object.keys(nuevo || {}), ...Object.keys((guardado && guardado.niveles) || {})]);
  for (const nv of nivelesTodos) {
    const kv = NIVELES[nv] ? NIVELES[nv].kv : 0;
    const crudo = {};
    const fams = new Set([...Object.keys((nuevo && nuevo[nv]) || {}), ...Object.keys((guardado && guardado.niveles && guardado.niveles[nv] && guardado.niveles[nv].fam) || {})]);
    for (const f of fams) {
      const g = guardado && guardado.niveles && guardado.niveles[nv] && guardado.niveles[nv].fam && guardado.niveles[nv].fam[f];
      const t = nuevo && nuevo[nv] && nuevo[nv][f];
      const n = (t || g).v.length;
      const base = t || { v: new Float32Array(n).fill(NaN), b: new Uint8Array(n), presente: new Uint8Array(n) };
      const fz = fusionarCrudo(g || null, base, modo);
      conflictos += fz.conflictos; nuevas += fz.nuevas;
      crudo[f] = fz;
    }
    const limpio = limpiarNivel(crudo, kv);
    niveles[nv] = { kv, fam: {} };
    conteos[nv] = {};
    for (const [f, s] of Object.entries(limpio)) {
      niveles[nv].fam[f] = s;
      conteos[nv][f] = conteoCodigos(s.m);
    }
    resumen[nv] = resumirParaGuardar(resumenFisico(limpio, kv), limpio);
  }
  return { niveles, resumen, conteos, conflictos, nuevas };
}

/** Lo que se guarda del resumen físico (solo números y su posición en el mes). */
export function resumirParaGuardar(r, limpio) {
  let desde = null;
  const ref = limpio.IR || limpio.IS || limpio.IT;
  if (ref) for (let h = 0; h < ref.m.length; h++) if (ref.m[h] === CODIGO.VALIDO) { desde = h; break; }
  const red = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
  return {
    i: {
      n: r.i.n, p50: red(r.i.p50), p95: red(r.i.p95), p98: red(r.i.p98), p99: red(r.i.p99),
      max: red(r.i.max), iMax: r.i.iMax, prom: red(r.i.prom), unaFalta: r.i.unaFalta
    },
    sost: r.sostenida ? { v: red(r.sostenida.valor), idx: r.sostenida.idx } : null,
    horas: r.horas, servicio: r.servicio, des: r.desenergizadas,
    cob: r.cobertura == null ? null : Math.round(r.cobertura * 1000) / 1000,
    sMax: red(r.s.max), sP99: red(r.s.p99), rUI: red(r.rUI), uProm: red(r.u.prom), sP: r.sP, flujoInverso: r.flujoInverso,
    desde
  };
}

/** Documento de una serie punto-mes, listo para la capa de datos (bytes como Uint8Array). */
export function docSerie(cid, mes, punto, niveles) {
  const out = { schema: 1, claveId: cid, clave: punto.clave, est: punto.est, elem: punto.elem, mes, n: horasMes(mes), formato: 'v32le+m8+b8', niveles: {} };
  for (const [nv, x] of Object.entries(niveles)) {
    out.niveles[nv] = { kv: x.kv, fam: {} };
    for (const [f, s] of Object.entries(x.fam)) out.niveles[nv].fam[f] = empaquetar(s);
  }
  return out;
}

/** ¿El doc nuevo es byte a byte igual al guardado? (entonces no se reescribe) */
export function docSinCambios(nuevo, guardadoCrudo) {
  if (!guardadoCrudo || !guardadoCrudo.niveles) return false;
  const a = nuevo.niveles; const b = guardadoCrudo.niveles;
  const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return false;
  for (const nv of ka) {
    const fa = a[nv].fam; const fb = (b[nv] && b[nv].fam) || {};
    if (Object.keys(fa).sort().join() !== Object.keys(fb).sort().join()) return false;
    for (const f of Object.keys(fa)) {
      for (const k of ['v', 'm', 'b', ...EXTRAS]) {
        const A = fa[f][k]; const B = fb[f] && fb[f][k];
        if (!A && !B) continue;   // un extra que no está en ninguno de los dos
        if (!igualBytes(A, B)) return false;
      }
    }
  }
  return true;
}

/** Tamaño aproximado (bytes) de un doc de serie en Firestore. */
export function tamanoDoc(doc) {
  let t = 300;
  for (const x of Object.values(doc.niveles || {})) {
    for (const s of Object.values(x.fam || {})) {
      t += s.v.length + s.m.length + s.b.length + 60;
      for (const k of EXTRAS) if (s[k]) t += s[k].length + 10;
    }
  }
  return t;
}

/** Lotes de escritura: ≤ ESCRITURA.loteMaxDocs docs y ≤ loteMaxBytes cada uno (un doc solo, aunque pese más, va en su lote). */
export function planLotes(docs, max = ESCRITURA.loteMaxDocs, maxBytes = LOTE_MAX_BYTES) {
  const out = [];
  let lote = []; let bytes = 0;
  for (const d of docs) {
    const t = tamanoDoc(d);
    if (lote.length && (lote.length >= max || bytes + t > maxBytes)) { out.push(lote); lote = []; bytes = 0; }
    lote.push(d); bytes += t;
  }
  if (lote.length) out.push(lote);
  return out;
}

/** Máscara de días con datos de un mes ('1101…') y su cobertura. */
export function diasDelMes(acc, mes) {
  const n = diasMes(mes);
  let s = '';
  let k = 0;
  for (let d = 1; d <= n; d++) {
    const f = mes + '-' + String(d).padStart(2, '0');
    const hay = acc.fechas.has(f);
    s += hay ? '1' : '0';
    if (hay) k++;
  }
  return { mascara: s, dias: k, completo: k / n >= TIEMPO.mesCompletoMin };
}

/**
 * Veredicto en lenguaje llano + bloqueos / avisos.
 * @param {{acc, meses, clavesHomologadas: string[], puntosHallados: Set<string>, totalesLimpieza, escrituras, conflictos, homologacionVigente}} ctx
 */
export function informeSimulacion(ctx) {
  const bloqueos = []; const avisos = [];
  const a = ctx.acc.archivos;
  const leidos = a.average + a.quality + a.encabezadoInvalido;
  if (!ctx.homologacionVigente) bloqueos.push('No hay homologación cargada: cárguela primero en la pestaña «Homologación».');
  if (!leidos) bloqueos.push('No se encontró ningún archivo de promedios ni de calidad en la carpeta.');
  if (leidos && a.encabezadoInvalido / leidos > 0.05) bloqueos.push(a.encabezadoInvalido + ' archivos tienen el encabezado de fechas dañado (más del 5 %).');
  const hallados = ctx.clavesHomologadas.filter((c) => ctx.puntosHallados.has(c));
  if (ctx.clavesHomologadas.length && !hallados.length) bloqueos.push('Ninguna clave de la homologación aparece en estos archivos.');
  const marcados = (ctx.meses || []).filter((m) => m.marcado);
  if (!marcados.length) bloqueos.push('No hay ningún mes con datos para guardar.');
  if (ctx.acc.discrepancias.fechaCarpeta) avisos.push(ctx.acc.discrepancias.fechaCarpeta + ' archivos están en una carpeta de otro día: se usó la fecha que trae el propio archivo.');
  if (ctx.conflictos) avisos.push(ctx.conflictos + ' horas traen un valor distinto al ya guardado: se conservó el guardado.');
  const faltan = ctx.clavesHomologadas.length - hallados.length;
  if (faltan > 0) avisos.push(faltan === 1 ? '1 clave de la homologación no aparece en estos archivos.' : faltan + ' claves de la homologación no aparecen en estos archivos.');
  for (const m of ctx.meses || []) if (m.nota) avisos.push(nombreMes(m.mes) + ': ' + m.nota + (m.marcado ? '' : ' (no se guardará salvo que lo marque)'));
  const veredicto = bloqueos.length ? 'bloqueado' : (avisos.length ? 'listo_con_avisos' : 'listo');
  return { veredicto, bloqueos, avisos, hallados: hallados.length, claves: ctx.clavesHomologadas.length };
}

/** Une dos máscaras de días ('1101…'): hay dato si lo hay en cualquiera. */
function unirMascaras(a, b) {
  if (!a) return b; if (!b) return a;
  let s = '';
  for (let i = 0; i < Math.max(a.length, b.length); i++) s += a[i] === '1' || b[i] === '1' ? '1' : '0';
  return s;
}

/**
 * Catálogo fundido: lo guardado AHORA + lo de esta carga. Nada se quita (las reglas exigen que
 * meses y puntos no disminuyan). Se llama DENTRO de la transacción, con lo guardado fresco.
 */
export function fundirCatalogo(guardado, nuevo) {
  const meses = { ...((guardado && guardado.meses) || {}) };
  for (const [mes, m] of Object.entries((nuevo && nuevo.meses) || {})) {
    const g = meses[mes];
    const dias = unirMascaras(g && g.dias, m.dias);
    const nDias = (dias.match(/1/g) || []).length;
    meses[mes] = { dias, nDias, completo: nDias / dias.length >= TIEMPO.mesCompletoMin };
  }
  const puntos = { ...((guardado && guardado.puntos) || {}) };
  for (const [cid, p] of Object.entries((nuevo && nuevo.puntos) || {})) {
    const g = puntos[cid];
    puntos[cid] = {
      clave: p.clave, est: p.est, elem: p.elem,
      niveles: { ...((g && g.niveles) || {}), ...p.niveles },
      meses: [...new Set([...((g && g.meses) || []), ...p.meses])].sort()
    };
  }
  return { meses, puntos };
}

/** Resumen de un mes fundido: los puntos de esta carga reemplazan los suyos; los demás se conservan. */
export function fundirResumen(guardadas, nuevas) {
  return { ...(guardadas || {}), ...(nuevas || {}) };
}

/** Familias admitidas (para validar un doc antes de escribir). */
export const FAMILIAS_ADMITIDAS = FAMILIAS;
