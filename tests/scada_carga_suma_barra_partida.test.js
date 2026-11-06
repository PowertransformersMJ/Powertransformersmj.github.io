// Cargabilidad SCADA — SUMA DE CIRCUITOS con BARRA PARTIDA y GUARDA DE POTENCIA (decisión del Ingeniero 2026-11-04), con
// datos SINTÉTICOS de la estación «EstDemo1»: dos transformadores miden 13,8 kV, pero la barra está partida. El T1 no tiene
// corriente válida (cero con bandera «Existent») y su P sí, pero NEGATIVA (como llega en el caso real) frente a la de sus
// circuitos, positiva; alimenta solo EDM301 + EDM302 + EDM303; el T2 alimenta EDM304 en la otra sección. Los datos pasan
// por las funciones REALES del importador (CSV de promedios y de calidad → acumular → armar → procesar → resumir, L-118).
// Lo que se exige: sin las marcas, D5 bloquea como siempre; con barra partida + guarda + sentido −1, la suma da la cifra y
// las horas en paralelo (−P del T1 = 0,69 × Σ P) o con el T2 fuera (1,2 × Σ P) quedan como hueco 8, contadas en
// `horas.guarda`, y las que no se pueden comprobar (falta una potencia) en `horas.guardaSinP`; con sentido 1 sobre esos
// datos no pasa ninguna hora y el motivo lo dice; la barra partida sin la guarda no se puede guardar; la firma cambia con
// las marcas y sin ellas es la de siempre; un mes casi sin horas no se bloquea; el diálogo «Revisar» conserva las marcas.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUMA, especSuma, firmaSuma, claveSuma, objetivoConSumas, sumarNivel, componerNivel, derivadosDelMes, componerSerieMes,
  componerResumen, estadoSumaNivel, derivadoDeMeses, erroresSuma, textoSuma
} from '../assets/js/domain/scada_carga_suma.js';
import { crearAcumulador, acumularArchivo, armarMeses, procesarPuntoMes, docSerie, resumirParaGuardar } from '../assets/js/domain/scada_carga_importacion.js';
import { desempaquetar, recortarRango, ventanaDeMes } from '../assets/js/domain/scada_carga_series.js';
import { resumenFisico } from '../assets/js/domain/scada_carga_kpis.js';
import { conteosHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { CODIGO as COD, FAMILIAS } from '../assets/js/domain/scada_carga_config.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO, MOTIVO, CODIGOS_VALIDOS } from '../assets/js/domain/scada_carga_config.js';
import { filasLista, calcularEquipo } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';

// ── Datos sintéticos (EstDemo1) ────────────────────────────────────────────────
const C1 = 'EDM301'; const C2 = 'EDM302'; const C3 = 'EDM303';   // la sección de la barra de 13,8 kV del T1
const C4 = 'EDM304';                                             // la sección del T2
const T1 = 'swTrafo1'; const T2 = 'swTrafo2';
const MV = 'Mv' + 'Moment';
const pad = (x) => String(x).padStart(2, '0');
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + pad(m) + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const filaCsv = (elem, tok, vals) => '/' + 'EstDemo1'.padEnd(8) + '/' + '13.8kV'.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const txt = (x) => (x == null ? 'null' : x.toFixed(3));
const RAIZ3 = Math.sqrt(3);
const idxDe = (d, h) => (d - 1) * 24 + h;
const FASES = ['I R', 'I S', 'I T'];

// Las horas especiales del escenario de marzo (día, hora del rótulo).
const PARALELO = (d, h) => d === 5 && h >= 10 && h <= 15;      // T1 y T2 en paralelo: P del T1 = 0,69 × Σ P
const T2_FUERA = (d, h) => d === 8 && h <= 5;                  // el T2 fuera, el T1 lleva también EDM304: 1,2 × Σ P
const ABIERTOS = (d, h) => d === 16 && (h === 6 || h === 7);   // los tres circuitos abiertos (con tensión en el T1)

/**
 * Valores de una hora de los seis puntos. `casi` = un mes casi todo en paralelo (solo `buenas` horas buenas: el día 2 desde
 * las 0; 7 si no se dice).
 * Excepciones de marzo: la P de EDM302 vacía (día 12, 7 h); la P del T1 vacía (día 13, 9 h); EDM301 sin corriente R (día
 * 18, 3 h); EDM303 sin ninguna corriente y la P del T1 vacía (día 20, 4 h); todos abiertos con el T1 sin carga (día 16,
 * 6 h) y con el T1 llevando el circuito del T2 (día 16, 7 h).
 */
function hora(d, h, { casi = false, buenas = 7 } = {}) {
  const idx = idxDe(d, h);
  const U = 13.6 + 0.05 * Math.sin(idx / 11);
  const corr = (k) => [0, 0.6, -0.5].map((f) => 40 + 10 * k + 8 * Math.sin(idx / (5 + k)) + 0.37 * (idx % (3 + k)) + f * Math.cos(idx / 3));
  const pDe = (I) => 0.95 * RAIZ3 * U * ((I[0] + I[1] + I[2]) / 3) / 1000;
  const circ = [corr(0), corr(1), corr(2)];
  const abiertos = !casi && ABIERTOS(d, h);
  if (abiertos) for (const I of circ) I.fill(0);
  const P = circ.map(pDe);
  const sumaP = P.reduce((a, b) => a + b, 0);
  let k = 1.002;
  if (casi) k = d === 2 && h < buenas ? 1.002 : 0.69;
  else if (PARALELO(d, h)) k = 0.69;
  else if (T2_FUERA(d, h)) k = 1.2;
  // El SCADA da la P del T1 con el signo CONTRARIO al de sus circuitos (caso real): de ahí `sentido_p: -1`.
  let pT1 = -k * sumaP;
  if (abiertos) pT1 = h === 6 ? -0.01 : -0.8;
  if (!casi && ((d === 13 && h === 9) || (d === 20 && h === 4))) pT1 = null;
  const I4 = corr(3); const P4 = pDe(I4);
  const fueraT2 = !casi && T2_FUERA(d, h);
  const out = {
    [T1]: { 'I R': 0, 'I S': 0, 'I T': 0, 'U RS': U, P: pT1, Q: pT1 == null ? null : -0.31 * pT1 },
    [T2]: { 'I R': fueraT2 ? 0 : I4[0], 'I S': fueraT2 ? 0 : I4[1], 'I T': fueraT2 ? 0 : I4[2], 'U RS': U, P: fueraT2 ? 0 : P4, Q: fueraT2 ? 0 : 0.3 * P4 },
    [C1]: { 'I R': !casi && d === 18 && h === 3 ? null : circ[0][0], 'I S': circ[0][1], 'I T': circ[0][2], P: P[0], Q: 0.3 * P[0] },
    [C2]: { 'I R': circ[1][0], 'I S': circ[1][1], 'I T': circ[1][2], P: !casi && d === 12 && h === 7 ? null : P[1], Q: 0.3 * P[1] },
    [C3]: { 'I R': circ[2][0], 'I S': circ[2][1], 'I T': circ[2][2], P: P[2], Q: 0.3 * P[2] },
    [C4]: { 'I R': I4[0], 'I S': I4[1], 'I T': I4[2], P: P4, Q: 0.3 * P4 }
  };
  if (!casi && d === 20 && h === 4) { out[C3]['I R'] = null; out[C3]['I S'] = null; out[C3]['I T'] = null; }
  return out;
}

/** Los archivos de un mes: un CSV de promedios por día y uno de calidad (la corriente del T1 viene «Existent»). */
function archivosMes(mes, op = {}) {
  const [an, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(an, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= dias; d++) {
    const porHora = Array.from({ length: 24 }, (_, h) => hora(d, h, op));
    const prom = [cab(d, m, an)];
    for (const elem of Object.keys(porHora[0])) for (const tok of Object.keys(porHora[0][elem])) prom.push(filaCsv(elem, tok, porHora.map((x) => txt(x[elem][tok]))));
    out.push({ nombre: 'x_average-' + an + pad(m) + pad(d) + '.csv', ruta: 'Mes/' + pad(d), texto: prom.join('\n') });
    const cal = [cab(d, m, an), ...FASES.map((tok) => filaCsv(T1, tok, Array(24).fill('Existent')))];
    out.push({ nombre: 'x_quality-' + an + pad(m) + pad(d) + '.csv', ruta: 'Mes/' + pad(d), texto: cal.join('\n') });
  }
  return out;
}

/** Un mes por el camino REAL del importador; devuelve lo que el worker tiene al final del bucle del mes. */
function cargarMes(mes, filas, op = {}) {
  const acc = crearAcumulador();
  const obj = objetivoConSumas(filas);
  for (const a of archivosMes(mes, op)) acumularArchivo(acc, { nombre: a.nombre, ruta: a.ruta, texto: a.texto, tamano: a.texto.length }, obj);
  const armados = armarMeses(acc, [mes]).get(mes);
  const porCid = {}; const resumen = {}; const docs = {}; const puntos = {};
  for (const [cid, nuevo] of armados) {
    const p = procesarPuntoMes(nuevo, null, 'completar');
    resumen[cid] = p.resumen; porCid[cid] = { niveles: p.niveles };
    const meta = acc.puntos.get(cid);
    docs[cid] = docSerie(cid, mes, meta, p.niveles);
    puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [mes] };
  }
  return { porCid, resumen, docs, puntos };
}
const guardadoDe = (doc) => {
  const g = { claveId: doc.claveId, mes: doc.mes, n: doc.n, niveles: {} };
  for (const [nv, x] of Object.entries(doc.niveles)) { g.niveles[nv] = { kv: x.kv, fam: {} }; for (const [f, s] of Object.entries(x.fam)) g.niveles[nv].fam[f] = desempaquetar(s); }
  return g;
};
function noGuardables(x, ruta = '') {
  if (x === undefined) return [ruta];
  if (typeof x === 'number') return Number.isFinite(x) ? [] : [ruta];
  if (Array.isArray(x)) return x.flatMap((y, i) => noGuardables(y, ruta ? ruta + '.' + i : String(i)));
  if (x && typeof x === 'object' && !ArrayBuffer.isView(x)) return Object.entries(x).flatMap(([k, y]) => noGuardables(y, ruta ? ruta + '.' + k : k));
  return [];
}

const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/' + T1]];
const base = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const FID = Object.keys(base)[0];
const CID = claveId('EstDemo1', T1);
const CC = [C1, C2, C3].map((c) => claveId('EstDemo1', c));
const decision = (extra = {}) => ({ tipo: 'usar', clave: '/EstDemo1/' + T1, mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'barra partida de prueba EstDemo1',
  clave_excel_vista: '/EstDemo1/' + T1, avisos_vistos: [], ...extra });
const filasCon = (mas = {}) => ({ [FID]: { ...base[FID], decision: decision({ suma: { N13_8: { de: [C1, C2, C3], fases: ['IR', 'IS', 'IT'], barra_propia: true, ...mas } } }) } });
const SIN_MARCAS = filasCon();
const PARTIDA = filasCon({ barra_partida: true, guarda_potencia: true, sentido_p: -1 });
const SENTIDO_1 = filasCon({ barra_partida: true, guarda_potencia: true });   // sin sentido_p = 1: el signo no coincide
const tx = { id: 'tx1', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'CENTRO' }, placa: { potencia_kva: 12500 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 120, corriente_nominal_secundaria_a: 300 } };
const A_S = 300;

const MAR = cargarMes('2026-03', PARTIDA);
const DER = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: PARTIDA });
const resMar = (der = DER) => ({ mes: '2026-03', claves: { ...MAR.resumen, ...der } });
const catalogoDe = (...cargas) => {
  const puntos = {};
  for (const c of cargas) for (const [cid, p] of Object.entries(c.puntos)) puntos[cid] = { ...p, meses: [...new Set([...((puntos[cid] && puntos[cid].meses) || []), ...p.meses])].sort() };
  const meses = {}; for (const c of cargas) for (const p of Object.values(c.puntos)) for (const m of p.meses) meses[m] = { completo: true };
  return { meses, puntos };
};
const CAT = catalogoDe(MAR);
const lista = (filas, res, cat = CAT) => filasLista({ parque: [tx], homologacion: { filas }, catalogo: cat, resumenMes: res })[0];
const fam = (cid) => MAR.porCid[cid].niveles.N13_8.fam;
const D5 = /otro transformador de la estación \(swTrafo2\) también mide 13,8 kV/i;

describe('el escenario: el T1 sin corriente válida, con P; el T2 mide el mismo nivel en la otra sección', () => {
  test('los datos de prueba son los del caso real', () => {
    assert.ok(fam(CID).IR.m.every((c) => c === CODIGO.BANDERA), 'la corriente del T1 viene «Existent»: no válida');
    assert.equal(fam(CID).P.m[idxDe(3, 10)], CODIGO.VALIDO, 'la P del T1 sí vale');
    assert.ok(MAR.puntos[claveId('EstDemo1', T2)].niveles.N13_8, 'el T2 mide 13,8 kV (D5 lo vería)');
    assert.equal(MAR.porCid[claveId('EstDemo1', C4)], undefined, 'EDM304 no es de esta suma: no se lee');
  });
});

describe('sin las marcas, D5 bloquea como siempre', () => {
  test('al guardar: otro transformador mide el nivel', () => {
    assert.match(erroresSuma(SIN_MARCAS[FID], SIN_MARCAS[FID].decision, { filas: SIN_MARCAS, puntos: MAR.puntos, filaId: FID }).join(' '), D5);
  });
  test('al leer: «barra_compartida» en el resumen, la lista y el detalle (sin cifra)', () => {
    const der = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SIN_MARCAS });
    const r = componerResumen(resMar(der).claves, CID, SIN_MARCAS[FID], MAR.puntos);
    assert.equal(r.N13_8.derivado.estado, 'barra_compartida'); assert.deepEqual(r.N13_8.derivado.otros, [T2]);
    const x = lista(SIN_MARCAS, resMar(der));
    assert.equal(x.pct, null); assert.match(x.motivoNulo, D5);
    const leidas = Object.fromEntries([CID, ...CC].map((c) => [c, guardadoDe(MAR.docs[c])]));
    const comp = componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos: leidas, spec: especSuma(SIN_MARCAS[FID]), guardadas: resMar(der).claves, puntos: MAR.puntos });
    assert.equal(comp.derivado.N13_8.estado, 'barra_compartida');
  });
  test('la guarda SOLA (sin barra partida) no quita D5', () => {
    const solo = filasCon({ guarda_potencia: true });
    assert.match(erroresSuma(solo[FID], solo[FID].decision, { filas: solo, puntos: MAR.puntos, filaId: FID }).join(' '), D5);
    const der = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: solo });
    assert.equal(componerResumen(resMar(der).claves, CID, solo[FID], MAR.puntos).N13_8.derivado.estado, 'barra_compartida');
  });
});

describe('erroresSuma: la barra partida exige la guarda', () => {
  test('barra_partida sin guarda_potencia → error (y D5 sigue)', () => {
    const f = filasCon({ barra_partida: true });
    const e = erroresSuma(f[FID], f[FID].decision, { filas: f, puntos: MAR.puntos, filaId: FID }).join(' ');
    assert.match(e, /La barra partida de 13,8 kV exige la guarda de potencia hora a hora/);
    assert.match(e, D5);
    assert.match(erroresSuma(f[FID], f[FID].decision, { filas: f, puntos: {}, filaId: FID }).join(' '), /exige la guarda de potencia/, 'aunque no haya otro transformador');
  });
  test('con las dos → [] aunque otro transformador mida el nivel; los demás chequeos siguen', () => {
    assert.deepEqual(erroresSuma(PARTIDA[FID], PARTIDA[FID].decision, { filas: PARTIDA, puntos: MAR.puntos, filaId: FID }), []);
    const sinCasilla = filasCon({ barra_partida: true, guarda_potencia: true, barra_propia: false });
    assert.match(erroresSuma(sinCasilla[FID], sinCasilla[FID].decision, { filas: sinCasilla, puntos: MAR.puntos, filaId: FID }).join(' '), /casilla obligatoria/);
    // Solo `true` cuenta: un texto no activa la excepción (falla cerrado).
    const texto = filasCon({ barra_partida: 'true', guarda_potencia: 'true' });
    assert.match(erroresSuma(texto[FID], texto[FID].decision, { filas: texto, puntos: MAR.puntos, filaId: FID }).join(' '), D5);
  });
  test('sentido_p: solo con la guarda y solo 1 o −1 (sin él vale 1, como hoy)', () => {
    const err = (mas) => { const f = filasCon(mas); return erroresSuma(f[FID], f[FID].decision, { filas: f, puntos: MAR.puntos, filaId: FID }).join(' '); };
    assert.equal(err({ barra_partida: true, guarda_potencia: true, sentido_p: 1 }), '');
    assert.equal(err({ barra_partida: true, guarda_potencia: true }), '', 'sin sentido_p se puede guardar (vale 1)');
    for (const x of [2, 0, '-1', null]) assert.match(err({ barra_partida: true, guarda_potencia: true, sentido_p: x }), /debe ser 1 o −1/, String(x));
    assert.match(err({ sentido_p: -1 }), /solo se usa con la guarda de potencia/);
  });
});

describe('firma y especSuma', () => {
  test('sin marcas la firma es la de siempre (la suma ya en uso no cambia ni un byte); con marcas, otra', () => {
    const hoy = 'v' + SUMA.version + '|N13_8|' + CC.join('+') + '|IR,IS,IT';
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases), hoy);
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, null), hoy);
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, {}), hoy);
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { barraPartida: false, guardaPotencia: 'true' }), hoy, 'solo true');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { barraPartida: true, guardaPotencia: true }), hoy + '|bp|gp');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { barraPartida: true, guardaPotencia: true, sentidoP: 1 }), hoy + '|bp|gp');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { barraPartida: true, guardaPotencia: true, sentidoP: -1 }), hoy + '|bp|gp-');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { guardaPotencia: true, sentidoP: 2 }), hoy + '|gp0', 'un sentido que no sirve, otra firma');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { guardaPotencia: true }), hoy + '|gp');
    assert.equal(firmaSuma('N13_8', CC, SUMA.fases, { sentidoP: -1 }), hoy, 'el sentido solo cuenta con la guarda');
    assert.equal(especSuma(SIN_MARCAS[FID]).porNivel.N13_8.firma, hoy);
    assert.equal(especSuma(filasCon({ sentido_p: -1 })[FID]).porNivel.N13_8.firma, hoy, 'sentido_p sin la guarda: la firma de siempre');
    assert.equal(especSuma(PARTIDA[FID]).porNivel.N13_8.firma, hoy + '|bp|gp-');
    assert.equal(especSuma(SENTIDO_1[FID]).porNivel.N13_8.firma, hoy + '|bp|gp');
  });
  test('el nivel lleva las marcas SOLO cuando están (sin ellas, las mismas claves de hoy)', () => {
    assert.deepEqual(Object.keys(especSuma(SIN_MARCAS[FID]).porNivel.N13_8), ['nivel', 'devanado', 'elems', 'cids', 'fases', 'firma', 'barraPropia']);
    const sp = especSuma(PARTIDA[FID]).porNivel.N13_8;
    assert.deepEqual(Object.keys(sp), ['nivel', 'devanado', 'elems', 'cids', 'fases', 'firma', 'barraPropia', 'barraPartida', 'guardaPotencia', 'sentidoP']);
    assert.equal(sp.barraPartida, true); assert.equal(sp.guardaPotencia, true); assert.equal(sp.sentidoP, -1);
    assert.equal(especSuma(SENTIDO_1[FID]).porNivel.N13_8.sentidoP, 1, 'sin sentido_p, 1');
    assert.equal(especSuma(filasCon({ guarda_potencia: true, sentido_p: 2 })[FID]).porNivel.N13_8.sentidoP, 0, 'un valor que no sirve: 0 (ninguna hora pasa)');
    assert.equal('sentidoP' in especSuma(filasCon({ sentido_p: -1 })[FID]).porNivel.N13_8, false, 'solo con la guarda');
    assert.equal('barraPartida' in especSuma(filasCon({ barra_partida: 'si' })[FID]).porNivel.N13_8, false);
  });
  test('un derivado calculado SIN la guarda no vale para la decisión con ella (otra firma)', () => {
    const viejo = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SIN_MARCAS });
    const r = componerResumen(resMar(viejo).claves, CID, PARTIDA[FID], MAR.puntos);
    assert.equal(r.N13_8.derivado.estado, 'otra_firma'); assert.deepEqual(r.N13_8.i, { n: 0 });
  });
});

describe('la guarda de potencia hora a hora', () => {
  const F = [fam(CC[0]), fam(CC[1]), fam(CC[2])];
  const T = fam(CID);
  const g = sumarNivel(F, T, { n: 744, guarda: true, sentidoP: -1 });
  const sin = sumarNivel(F, T, { n: 744 });
  const exacta = (h) => ['IR', 'IS', 'IT'].every((f) => g.fam[f].m[h] === CODIGO.VALIDO && g.fam[f].v[h] === Math.fround(F[0][f].v[h] + F[1][f].v[h] + F[2][f].v[h]));
  const tapada = (h) => ['IR', 'IS', 'IT'].every((f) => g.fam[f].m[h] === CODIGO.PARALELO && Number.isNaN(g.fam[f].v[h]));
  test('la P del T1 llega NEGATIVA y la de sus circuitos positiva (como en el caso real)', () => {
    const h = idxDe(3, 10);
    assert.ok(T.P.v[h] < 0 && F.every((x) => x.P.v[h] > 0));
    const k = -T.P.v[h] / (F[0].P.v[h] + F[1].P.v[h] + F[2].P.v[h]);
    assert.ok(Math.abs(k - 1.002) < 0.003, String(k));
  });
  test('paralelo (0,69) y T2 fuera (1,2): hueco 8 en las tres fases', () => {
    for (let h = 10; h <= 15; h++) assert.ok(tapada(idxDe(5, h)), 'paralelo día 5 ' + h + ' h');
    for (let h = 0; h <= 5; h++) assert.ok(tapada(idxDe(8, h)), 'T2 fuera día 8 ' + h + ' h');
    // Sin la guarda, esas mismas horas se sumaban (es la guarda la que las quita).
    for (const h of [idxDe(5, 12), idxDe(8, 3)]) assert.equal(sin.fam.IR.m[h], CODIGO.VALIDO);
  });
  test('la P de un circuito que suma o la del transformador sin dato: hueco 8 (sin comprobar); el resto, la suma exacta', () => {
    assert.ok(tapada(idxDe(12, 7)), 'la P de EDM302 vacía');
    assert.ok(tapada(idxDe(13, 9)), 'la P del T1 vacía');
    for (const [d, h] of [[3, 10], [5, 9], [5, 16], [8, 6], [27, 23]]) assert.ok(exacta(idxDe(d, h)), 'día ' + d + ' ' + h + ' h');
  });
  test('una hora que ya era hueco conserva SU código: con una fase sumada se juzga; sin ninguna, no se cuenta', () => {
    const h1 = idxDe(18, 3);
    assert.equal(g.fam.IR.m[h1], CODIGO.NULO, 'EDM301 sin corriente R');
    assert.equal(g.fam.IS.m[h1], CODIGO.VALIDO, 'las otras fases sí (la P cuadra)');
    const h2 = idxDe(20, 4);
    for (const f of ['IR', 'IS', 'IT']) assert.equal(g.fam[f].m[h2], CODIGO.NULO, 'EDM303 sin corrientes: su código, no el 8');
  });
  test('todos abiertos: fuera de servicio si el T1 tampoco lleva potencia; hueco 8 si la lleva (el circuito del T2)', () => {
    for (const f of ['IR', 'IS', 'IT']) assert.equal(g.fam[f].m[idxDe(16, 6)], CODIGO.DESENERGIZADO);
    assert.ok(tapada(idxDe(16, 7)));
    assert.equal(sin.fam.IR.m[idxDe(16, 7)], CODIGO.DESENERGIZADO, 'sin la guarda: «fuera de servicio» con 0 A (subestimaba)');
  });
  test('horas, cada una con su causa: no cuadra 13 (6 paralelo + 6 T2 fuera + 1 abiertos con carga); sin comprobar 2 (sin P)', () => {
    assert.equal(g.horas.guarda, 13);
    assert.equal(g.horas.guardaSinP, 2);
    assert.equal(g.horas.fueraServicio, 1);
    assert.equal(g.horas.total, g.horas.completas + g.horas.hueco + g.horas.fueraServicio);
    assert.equal(g.horas.hueco, 13 + 2 + 2, 'las de la guarda más las dos horas que ya eran hueco por un circuito');
    assert.deepEqual(Object.keys(g.horas), ['total', 'completas', 'bandaMuerta', 'rechazadas', 'abiertas', 'fueraServicio', 'hueco', 'guarda', 'guardaSinP']);
  });
  test('con sentido 1 sobre esos mismos datos no pasa NINGUNA hora (el signo contrario al declarado queda fuera)', () => {
    const s1 = sumarNivel(F, T, { n: 744, guarda: true });
    assert.equal(s1.horas.completas, 0);
    assert.equal(s1.horas.guardaSinP, 2, 'las que no se pueden comprobar siguen aparte');
    assert.ok(s1.horas.guarda > 700, String(s1.horas.guarda));
    // Con sentido −1 y la P del T1 con el signo de sus circuitos (lo contrario a lo declarado), tampoco.
    const inv = { ...T, P: { ...T.P, v: Float32Array.from(T.P.v, (x) => -x) } };
    assert.equal(sumarNivel(F, inv, { n: 744, guarda: true, sentidoP: -1 }).horas.completas, 0);
    // Un sentido que no sirve (0): ninguna hora.
    assert.equal(sumarNivel(F, T, { n: 744, guarda: true, sentidoP: 0 }).horas.completas, 0);
  });
  test('sin guarda, `horas` trae exactamente las claves de hoy (y `guarda: false` es lo mismo)', () => {
    assert.deepEqual(Object.keys(sin.horas), ['total', 'completas', 'bandaMuerta', 'rechazadas', 'abiertas', 'fueraServicio', 'hueco']);
    assert.deepEqual(sumarNivel(F, T, { n: 744, guarda: false }), sin);
    assert.deepEqual(componerNivel({ fuentes: F, barra: T, n: 744 }), componerNivel({ fuentes: F, barra: T, n: 744, guarda: false }));
  });
  test('falla cerrado: sin la P del transformador (o sin su nivel) ninguna hora sumada vale, y se cuentan sin comprobar', () => {
    const { P: _p, ...sinP } = T;
    const a = sumarNivel(F, sinP, { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(a.horas.completas, 0); assert.equal(a.horas.guarda, 0); assert.ok(a.horas.guardaSinP > 700);
    assert.equal(sumarNivel(F, null, { n: 744, guarda: true, sentidoP: -1 }).horas.completas, 0);
  });
  test('sin carga apreciable (|Σ P| y |P| < 0,05 MW) no se puede juzgar: hueco', () => {
    const escala = (s, f) => ({ ...s, P: { ...s.P, v: Float32Array.from(s.P.v, (x) => x * f) } });
    const chicos = F.map((s) => escala(s, 0.01)); const tChico = escala(T, 0.01);
    const h = idxDe(3, 10);
    assert.ok(Math.abs(chicos.reduce((a, s) => a + s.P.v[h], 0)) < SUMA.guardaPisoMW);
    const x = sumarNivel(chicos, tChico, { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(x.fam.IR.m[h], CODIGO.PARALELO);
    assert.ok(x.horas.guardaSinP > 700, 'sin carga para comprobar: aparte de «no cuadra»');
  });
});

describe('con barra partida + guarda: la cifra sale de la suma', () => {
  const r = DER[claveSuma(CID)].N13_8;
  test('el derivado del importador: ok, con las horas de la guarda, guardable', () => {
    assert.equal(r.derivado.estado, 'ok'); assert.equal(r.derivado.firma, especSuma(PARTIDA[FID]).porNivel.N13_8.firma);
    assert.equal(r.derivado.horas.guarda, 13); assert.equal(r.derivado.horas.guardaSinP, 2); assert.equal(r.derivado.horas.fueraServicio, 1);
    assert.equal(r.derivado.veredicto, 'sin_contraste', 'la corriente del T1 no vale: la suma no se puede contrastar (regla de siempre)');
    assert.match(r.derivado.criterio, /guarda de potencia \(barra partida\): solo las horas con −P del transformador/);
    assert.ok(r.i.n > 700, String(r.i.n));
    assert.deepEqual(noGuardables(DER), []);
    // Sin la guarda, el derivado no trae `horas.guarda` ni el criterio nuevo.
    const sinG = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SIN_MARCAS })[claveSuma(CID)].N13_8.derivado;
    assert.equal('guarda' in sinG.horas, false); assert.equal('guardaSinP' in sinG.horas, false); assert.doesNotMatch(sinG.criterio, /guarda/);
  });
  test('al leer con el catálogo (el T2 mide 13,8 kV): no hay barra compartida; la lista da la cifra del derivado', () => {
    const c = componerResumen(resMar().claves, CID, PARTIDA[FID], MAR.puntos);
    assert.equal(c.N13_8, r, 'el derivado válido, tal cual');
    const x = lista(PARTIDA, resMar());
    assert.notEqual(x.pct, null, x.motivoNulo);
    assert.equal(x.pct, 100 * r.i.p99 / A_S);
    assert.equal(x.clase, 'provisional');
    assert.ok(x.motivos.includes('la suma de circuitos no se pudo contrastar con el transformador'), x.motivos.join(' · '));
    assert.doesNotMatch(x.motivos.join(' · '), D5);
    assert.equal(x.niveles[0].etiqueta, '13,8 kV · suma de circuitos');
  });
  test('el detalle compone lo mismo que el importador (mes completo, con el catálogo y lo guardado)', () => {
    const leidas = Object.fromEntries([CID, ...CC].map((c) => [c, guardadoDe(MAR.docs[c])]));
    const comp = componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos: leidas, spec: especSuma(PARTIDA[FID]), guardadas: resMar().claves, puntos: MAR.puntos });
    assert.deepEqual(comp.derivado.N13_8, r.derivado);
    const s = comp.serie.niveles.N13_8.fam;
    assert.equal(s.IR.m[idxDe(5, 12)], CODIGO.PARALELO); assert.equal(s.IT.m[idxDe(8, 2)], CODIGO.PARALELO);
    assert.equal(s.IS.v[idxDe(3, 10)], Math.fround(fam(CC[0]).IS.v[idxDe(3, 10)] + fam(CC[1]).IS.v[idxDe(3, 10)] + fam(CC[2]).IS.v[idxDe(3, 10)]));
    assert.deepEqual([...s.P.v], [...fam(CID).P.v], 'la P es la del transformador (copia)');
  });
  test('estadoSumaNivel: un registro «barra_compartida» con la firma de la barra partida no da el aviso de D5 (sin cifra)', () => {
    const sp = especSuma(PARTIDA[FID]).porNivel.N13_8;
    const reg = { derivado: { tipo: SUMA.tipo, v: SUMA.version, firma: sp.firma, de: sp.elems, fases: sp.fases, base: CID, estado: 'barra_compartida', otros: [T2] } };
    const e = estadoSumaNivel(reg, sp);
    assert.notEqual(e.estado, 'ok'); assert.doesNotMatch(e.motivo, /barra puede ser compartida/);
    const spSin = especSuma(SIN_MARCAS[FID]).porNivel.N13_8;
    assert.match(estadoSumaNivel({ derivado: { ...reg.derivado, firma: spSin.firma } }, spSin).motivo, /barra puede ser compartida/, 'sin las marcas, el de siempre');
  });
  test('textos: el rótulo dice la barra partida; con el derivado, las horas que quitó la guarda', () => {
    const spec = especSuma(PARTIDA[FID]);
    assert.equal(textoSuma(spec), 'Secundario por suma de circuitos ' + [C1, C2, C3].join(' + ') + ' (barra partida: sin las horas en que el transformador no lleva solo esos circuitos)');
    assert.match(textoSuma(spec, 'N13_8', { derivado: r.derivado }),
      / · 13 h fuera porque el transformador no llevaba solo esos circuitos \(paralelo u otra fuente\) · 2 h fuera porque faltó la potencia del transformador o de un circuito para comprobarlo$/);
    assert.equal(textoSuma(especSuma(SIN_MARCAS[FID])), 'Secundario por suma de circuitos ' + [C1, C2, C3].join(' + '), 'sin marcas, el de siempre');
    assert.match(lista(PARTIDA, resMar()).suma.texto, /\(barra partida: /);
  });
});

describe('un mes casi sin horas (casi todo en paralelo) no se bloquea', () => {
  const ABR = cargarMes('2026-04', PARTIDA, { casi: true });
  const derAbr = derivadosDelMes({ mes: '2026-04', porCid: ABR.porCid, filas: PARTIDA });
  const ra = derAbr[claveSuma(CID)].N13_8;
  test('el derivado del mes: ok con 7 horas; las demás, de la guarda', () => {
    assert.equal(ra.derivado.estado, 'ok');
    assert.equal(ra.derivado.horas.completas, 7); assert.equal(ra.derivado.horas.guarda, 720 - 7); assert.equal(ra.derivado.horas.guardaSinP, 0);
    assert.equal(ra.i.n, 7);
  });
  test('el periodo con marzo: el derivado de varios meses es válido y suma las horas de la guarda; la cifra no se tumba', () => {
    const sp = especSuma(PARTIDA[FID]).porNivel.N13_8;
    const dm = derivadoDeMeses([{ mes: '2026-03', derivado: DER[claveSuma(CID)].N13_8.derivado }, { mes: '2026-04', derivado: ra.derivado }], sp);
    assert.equal(dm.estado, 'ok'); assert.equal(dm.horas.guarda, 13 + 713); assert.equal(dm.horas.guardaSinP, 2);
    const cat = catalogoDe(MAR, ABR);
    const resumenes = { '2026-03': resMar(), '2026-04': { mes: '2026-04', claves: { ...ABR.resumen, ...derAbr } } };
    const p = filasPeriodo({ parque: [tx], homologacion: { filas: PARTIDA }, catalogo: cat, meses: ['2026-03', '2026-04'], resumenes, filasPorMes: {} })[0];
    assert.notEqual(p.pct, null, p.motivoNulo);
    assert.doesNotMatch(String(p.motivoNulo || ''), /falta calcular|compartida/);
    // Sin guarda en ningún mes, `horas` del periodo con las claves de siempre.
    const d0 = { ...DER[claveSuma(CID)].N13_8.derivado, horas: { completas: 1, bandaMuerta: 0, rechazadas: 0, abiertas: 0, fueraServicio: 0, hueco: 0 } };
    const h0 = derivadoDeMeses([{ mes: '2026-03', derivado: d0 }], sp).horas;
    assert.equal('guarda' in h0, false); assert.equal('guardaSinP' in h0, false);
  });
  test('la lista del mes sale como cualquier mes con pocas horas (con cifra del derivado, nunca bloqueada)', () => {
    const x = filasLista({ parque: [tx], homologacion: { filas: PARTIDA }, catalogo: catalogoDe(ABR), resumenMes: { mes: '2026-04', claves: { ...ABR.resumen, ...derAbr } } })[0];
    assert.equal(x.motivoNulo, null);
    assert.equal(x.pct, 100 * ra.i.p99 / A_S);
    assert.equal(x.clase, 'provisional');
    assert.ok(x.motivos.includes('menos de 72 horas válidas') && x.motivos.includes('cobertura menor al 50 %'), x.motivos.join(' · '));
  });
});

describe('la guarda deja el mes sin NINGUNA hora válida: motivo propio, sin tumbar el periodo', () => {
  const MAY = cargarMes('2026-05', PARTIDA, { casi: true, buenas: 0 });
  const derMay = derivadosDelMes({ mes: '2026-05', porCid: MAY.porCid, filas: PARTIDA });
  const rm = derMay[claveSuma(CID)].N13_8;
  const resMay = { mes: '2026-05', claves: { ...MAY.resumen, ...derMay } };
  const MOTIVO_0 = 'sin ninguna hora válida: la guarda de potencia de la barra partida dejó fuera 744 h porque el transformador no llevaba solo esos circuitos (paralelo u otra fuente)';
  test('el derivado del mes sigue «ok» (no es un bloqueo); lo guardado se lee tal cual', () => {
    assert.equal(rm.derivado.estado, 'ok'); assert.equal(rm.derivado.horas.completas, 0); assert.equal(rm.derivado.horas.guarda, 744); assert.equal(rm.i.n, 0);
    assert.equal(componerResumen(resMay.claves, CID, PARTIDA[FID], MAY.puntos).N13_8, rm, 'no se tapa con un registro sin cifra');
    const e = estadoSumaNivel(rm, especSuma(PARTIDA[FID]).porNivel.N13_8);
    assert.equal(e.estado, 'sin_horas_guarda'); assert.equal(e.motivo, MOTIVO_0);
  });
  test('la lista del mes: sin cifra con ESE motivo (no «sin corriente válida (sí llega la potencia)»)', () => {
    const x = filasLista({ parque: [tx], homologacion: { filas: PARTIDA }, catalogo: catalogoDe(MAY), resumenMes: resMay })[0];
    assert.equal(x.pct, null); assert.equal(x.motivoNulo, MOTIVO_0);
    // El mismo mes sin la guarda (sin marcas: D5) da su motivo de siempre: lo nuevo solo existe con la guarda.
    const der0 = derivadosDelMes({ mes: '2026-05', porCid: MAY.porCid, filas: SIN_MARCAS });
    const x0 = filasLista({ parque: [tx], homologacion: { filas: SIN_MARCAS }, catalogo: catalogoDe(MAY), resumenMes: { mes: '2026-05', claves: { ...MAY.resumen, ...der0 } } })[0];
    assert.match(x0.motivoNulo, D5);
  });
  test('el periodo: con marzo da la cifra de marzo (el mes en cero no lo tumba); solo ese mes, el motivo propio', () => {
    const cat = catalogoDe(MAR, MAY);
    const resumenes = { '2026-03': resMar(), '2026-05': resMay };
    const p = filasPeriodo({ parque: [tx], homologacion: { filas: PARTIDA }, catalogo: cat, meses: ['2026-03', '2026-05'], resumenes, filasPorMes: {} })[0];
    assert.notEqual(p.pct, null, p.motivoNulo);
    const solo = filasPeriodo({ parque: [tx], homologacion: { filas: PARTIDA }, catalogo: catalogoDe(MAY), meses: ['2026-05'], resumenes: { '2026-05': resMay }, filasPorMes: {} })[0];
    assert.equal(solo.pct, null); assert.equal(solo.motivoNulo, MOTIVO_0);
  });
  test('con sentido 1 sobre los datos de marzo (P del T1 negativa): cero horas y el motivo dice las dos causas', () => {
    const der1 = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SENTIDO_1 });
    const r1 = der1[claveSuma(CID)].N13_8;
    assert.equal(r1.derivado.horas.completas, 0); assert.equal(r1.i.n, 0); assert.equal(r1.derivado.horas.guardaSinP, 2);
    const x = lista(SENTIDO_1, resMar(der1));
    assert.equal(x.pct, null);
    assert.match(x.motivoNulo, /^sin ninguna hora válida: la guarda de potencia de la barra partida dejó fuera \d+ h porque el transformador no llevaba solo esos circuitos \(paralelo u otra fuente\) · 2 h porque faltó la potencia del transformador o de un circuito para comprobarlo$/);
  });
});

describe('segunda revisión: rango del detalle, P en cero exacto, huella de la P y caché del diálogo', () => {
  const sp = especSuma(PARTIDA[FID]).porNivel.N13_8;
  const dMar = DER[claveSuma(CID)].N13_8.derivado;
  test('estadoSumaNivel con `horas.guardaRango` (detalle): manda el dato del rango, nunca el de los meses enteros', () => {
    const r0 = (gr) => ({ i: { n: 0 }, derivado: { ...dMar, horas: { ...dMar.horas, guardaRango: gr } } });
    const e0 = estadoSumaNivel(r0(0), sp);
    assert.equal(e0.estado, 'ok', 'la guarda no tocó el rango: queda el motivo de siempre (lo pone la vista)');
    const e5 = estadoSumaNivel(r0(5), sp);
    assert.equal(e5.estado, 'sin_horas_guarda');
    assert.equal(e5.motivo, 'sin ninguna hora válida: 5 h de este rango fuera por la guarda de potencia de la barra partida (no cuadra o falta la potencia para comprobarlo)');
    assert.doesNotMatch(e5.motivo, /13 h|2 h/, 'sin las cifras del mes');
    // Con horas válidas en el rango, nada.
    assert.equal(estadoSumaNivel({ i: { n: 3 }, derivado: r0(5).derivado }, sp).estado, 'ok');
  });
  test('el detalle de UN día (camino del detalle): el motivo cuenta las horas de ese día; un día sin la guarda no lo da', () => {
    const MAY = cargarMes('2026-05', PARTIDA, { casi: true, buenas: 0 });
    const derMay = derivadosDelMes({ mes: '2026-05', porCid: MAY.porCid, filas: PARTIDA });
    const claves = { ...MAY.resumen, ...derMay };
    const leidas = Object.fromEntries([CID, ...CC].map((c) => [c, guardadoDe(MAY.docs[c])]));
    const comp = componerSerieMes({ mes: '2026-05', trafo: leidas[CID], circuitos: leidas, spec: especSuma(PARTIDA[FID]), guardadas: claves, puntos: MAY.puntos });
    const v = ventanaDeMes('2026-05');
    const dia = (d) => recortarRango({ '2026-05': { estado: 'ok', series: comp.serie.niveles.N13_8.fam } }, FAMILIAS, v.desde + (d - 1) * 24 * 3600e3, v.desde + d * 24 * 3600e3);
    const rangoDe = (rec) => {
      let enRango = 0; for (const c of rec.fam.IR.m) if (c === COD.PARALELO) enRango++;
      const der = derivadoDeMeses([{ mes: '2026-05', derivado: comp.derivado.N13_8 }], sp);
      return { ...resumirParaGuardar(resumenFisico(rec.fam, 13.8), rec.fam), derivado: { ...der, horas: { ...der.horas, guardaRango: enRango } } };
    };
    const r3 = rangoDe(dia(3));
    assert.equal(r3.derivado.horas.guardaRango, 24); assert.equal(r3.derivado.horas.guarda, 744, 'el del mes sigue ahí (para «en los meses del rango»)');
    const c = calcularEquipo({ tx, fila: PARTIDA[FID], punto: catalogoDe(MAY).puntos[CID], resumenPorNivel: { N13_8: r3 }, conteos: conteosHomologacion(PARTIDA), umbrales: null });
    assert.equal(c.pct, null);
    assert.equal(c.motivoNulo, 'sin ninguna hora válida: 24 h de este rango fuera por la guarda de potencia de la barra partida (no cuadra o falta la potencia para comprobarlo)');
    // Un día de marzo sin horas quitadas por la guarda: guardaRango = 0 y el estado no es «sin_horas_guarda».
    const leidasM = Object.fromEntries([CID, ...CC].map((x) => [x, guardadoDe(MAR.docs[x])]));
    const compM = componerSerieMes({ mes: '2026-03', trafo: leidasM[CID], circuitos: leidasM, spec: especSuma(PARTIDA[FID]), guardadas: resMar().claves, puntos: MAR.puntos });
    const vm = ventanaDeMes('2026-03');
    const recM = recortarRango({ '2026-03': { estado: 'ok', series: compM.serie.niveles.N13_8.fam } }, FAMILIAS, vm.desde + 2 * 24 * 3600e3, vm.desde + 3 * 24 * 3600e3);
    let n8 = 0; for (const x of recM.fam.IR.m) if (x === COD.PARALELO) n8++;
    assert.equal(n8, 0, 'el 3 de marzo la guarda no quitó nada');
    const dM = derivadoDeMeses([{ mes: '2026-03', derivado: compM.derivado.N13_8 }], sp);
    assert.equal(estadoSumaNivel({ i: { n: 0 }, derivado: { ...dM, horas: { ...dM.horas, guardaRango: n8 } } }, sp).estado, 'ok');
    // El detalle hace ese conteo SOLO con la guarda, con el 8 de respaldo (L-102).
    const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(det, /if \(sp\.guardaPotencia === true && a\.sumaRango\[nv\] && a\.sumaRango\[nv\]\.horas && porNivel\[nv\]\.fam && porNivel\[nv\]\.fam\.IR\) \{/);
    assert.match(det, /const cod8 = Number\.isInteger\(CODIGO\.PARALELO\) \? CODIGO\.PARALELO : 8;/);
    assert.match(det, /a\.sumaRango\[nv\] = \{ \.\.\.a\.sumaRango\[nv\], horas: \{ \.\.\.a\.sumaRango\[nv\]\.horas, guardaRango: enRango \} \};/);
  });
  test('P en cero exacto (código 6) de un circuito con corriente residual: si con 0 MW cuadra, la hora vale', () => {
    const F = [fam(CC[0]), fam(CC[1]), fam(CC[2])];
    const T = fam(CID);
    const h = idxDe(3, 10);
    const con = (s, f, v, m) => ({ ...s, [f]: { ...s[f], v: Float32Array.from(s[f].v, (x, i) => (i === h ? v : x)), m: Uint8Array.from(s[f].m, (x, i) => (i === h ? m : x)) } });
    // EDM303 casi abierto: corriente residual VÁLIDA (no está «abierto») y su P en 0 exacto (6).
    let c3 = con(F[2], 'P', 0, COD.CERO);
    for (const f of ['IR', 'IS', 'IT']) c3 = con(c3, f, 0.8, COD.VALIDO);
    const sP12 = F[0].P.v[h] + F[1].P.v[h];
    const tBien = con(T, 'P', -1.002 * sP12, COD.VALIDO);
    const ok = sumarNivel([F[0], F[1], c3], tBien, { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(ok.fam.IR.m[h], COD.VALIDO, 'k con P = 0 MW cuadra: la hora vale');
    assert.equal(ok.fam.IR.v[h], Math.fround(F[0].IR.v[h] + F[1].IR.v[h] + 0.8));
    // La misma P en 0 pero el transformador lleva también la carga de ese circuito: no cuadra, y como no se sabe si es otra
    // fuente o un medidor de P muerto, queda «sin comprobar» (nunca «paralelo u otra fuente»).
    const malo = sumarNivel([F[0], F[1], c3], T, { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(malo.fam.IR.m[h], COD.PARALELO);
    const base = sumarNivel(F, T, { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(malo.horas.guardaSinP, base.horas.guardaSinP + 1); assert.equal(malo.horas.guarda, base.horas.guarda);
    // La P del T1 en 0 exacto con sus circuitos en carga: sin comprobar (como antes).
    const t0 = sumarNivel(F, con(T, 'P', 0, COD.CERO), { n: 744, guarda: true, sentidoP: -1 });
    assert.equal(t0.horas.guardaSinP, base.horas.guardaSinP + 1); assert.equal(t0.horas.guarda, base.horas.guarda);
    // Sin la guarda, ese 0 no cambia nada (la suma de corrientes es la de siempre).
    assert.deepEqual(sumarNivel([F[0], F[1], c3], T, { n: 744 }), sumarNivel([F[0], F[1], c3], tBien, { n: 744 }));
  });
  test('huella de la P (solo con la guarda): base_i la trae y, si la P guardada del transformador cambió, «desfasado»', () => {
    const t = MAR.resumen[CID].N13_8;
    assert.deepEqual(dMar.base_i, { n: t.i.n, p99: t.i.p99, sP99: t.sP99, sMax: t.sMax });
    assert.deepEqual(noGuardables(dMar.base_i), []);
    const otraP = { ...resMar().claves, [CID]: { ...MAR.resumen[CID], N13_8: { ...t, sP99: t.sP99 + 0.5 } } };
    assert.equal(componerResumen(otraP, CID, PARTIDA[FID], MAR.puntos).N13_8.derivado.estado, 'desfasado');
    const otroMax = { ...resMar().claves, [CID]: { ...MAR.resumen[CID], N13_8: { ...t, sMax: t.sMax + 0.5 } } };
    assert.equal(componerResumen(otroMax, CID, PARTIDA[FID], MAR.puntos).N13_8.derivado.estado, 'desfasado');
    // Un derivado con guarda sin esa huella (de antes de este arreglo) tampoco vale.
    const { sP99: _a, sMax: _b, ...soloI } = dMar.base_i;
    const sinHuellaP = { ...resMar().claves, [claveSuma(CID)]: { N13_8: { ...DER[claveSuma(CID)].N13_8, derivado: { ...dMar, base_i: soloI } } } };
    assert.equal(componerResumen(sinHuellaP, CID, PARTIDA[FID], MAR.puntos).N13_8.derivado.estado, 'desfasado');
    assert.equal(componerResumen(resMar().claves, CID, PARTIDA[FID], MAR.puntos).N13_8, DER[claveSuma(CID)].N13_8, 'con la misma P, el derivado vale');
    // Sin la guarda, base_i es el de siempre y la P no entra.
    const der0 = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SIN_MARCAS })[claveSuma(CID)].N13_8;
    assert.deepEqual(Object.keys(der0.derivado.base_i), ['n', 'p99']);
    const claves0 = { ...MAR.resumen, [claveSuma(CID)]: { N13_8: der0 } };
    const otraP0 = { ...claves0, [CID]: { ...MAR.resumen[CID], N13_8: { ...t, sP99: t.sP99 + 0.5 } } };
    assert.equal(componerResumen(otraP0, CID, SIN_MARCAS[FID]).N13_8, der0, 'sin la guarda, un cambio de P no desfasa (como en HEAD)');
  });
  test('diálogo: con las marcas guardadas y un dominio viejo en caché, pide recargar antes de erroresSuma', () => {
    const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
    assert.match(h, /try \{ return firmaSuma\('N13_8', \['x'\], \['IR'\], \{ guardaPotencia: true, sentidoP: -1 \}\)\.endsWith\('\|gp-'\); \} catch \(e\) \{ return false; \}/);
    assert.match(h, /if \(conMarcas && !dominioConoceMarcas\(\)\) \{ msg\.textContent = 'Esta pestaña tiene una versión anterior: recargue la página \(Cmd\+Shift\+R\) antes de guardar\.'; return; \}\n\s*if \(decision\.suma \|\| decision\.diferencia\) \{\n\s*const errores = erroresSuma/);
    // Con el dominio de hoy la comprobación pasa; con la firma de antes (sin las marcas) no.
    assert.equal(firmaSuma('N13_8', ['x'], ['IR'], { guardaPotencia: true, sentidoP: -1 }).endsWith('|gp-'), true);
    assert.equal(('v' + SUMA.version + '|N13_8|x|IR').endsWith('|gp-'), false);
  });
});

describe('código 8, textos de pantalla y el diálogo «Revisar»', () => {
  const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
  test('CODIGO.PARALELO = 8 con su motivo; no es válido y no choca con otro código', () => {
    assert.equal(CODIGO.PARALELO, 8); assert.ok(MOTIVO[8] && /no cuadra con sus circuitos/.test(MOTIVO[8]));
    assert.equal(CODIGOS_VALIDOS.includes(8), false);
    const v = Object.values(CODIGO); assert.equal(new Set(v).size, v.length);
    assert.match(src('domain/scada_carga_suma.js'), /const COD_PARALELO = Number\.isInteger\(CODIGO\.PARALELO\) \? CODIGO\.PARALELO : 8;/, 'con un config viejo en caché, nunca 0 (= válido)');
  });
  test('el diálogo conserva la barra partida y la guarda si la lista de circuitos no cambió, y las muestra', () => {
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /suma\[nv\] = \{ de: listaDe\(sumaUI\[nv\]\.de\.value\), fases: \[\.\.\.SUMA\.fases\], barra_propia: !!sumaUI\[nv\]\.barra\.checked \};\n\s*\/\/[^\n]*\n\s*Object\.assign\(suma\[nv\], marcasQueSiguen\(nv, suma\[nv\]\.de\)\);/);
    assert.match(h, /if \(comparable\(Array\.isArray\(g\.de\) \? g\.de : \[\]\) !== comparable\(lista\)\) return \{\};/, 'con otra lista, se quitan');
    assert.match(h, /return \{ \.\.\.\(g\.barra_partida === true \? \{ barra_partida: true \} : \{\}\), \.\.\.\(g\.guarda_potencia === true \? \{ guarda_potencia: true \} : \{\}\),/);
    assert.match(h, /\.\.\.\(g\.guarda_potencia === true && g\.sentido_p !== undefined \? \{ sentido_p: g\.sentido_p \} : \{\}\) \};/, 'el sentido de la potencia también');
    assert.match(h, /d\.firma === firmaSuma\(nv, cids, SUMA\.fases, \{ barraPartida: m\.barra_partida === true, guardaPotencia: m\.guarda_potencia === true, sentidoP: m\.sentido_p \}\)/, 'el último mes, con la firma de las marcas');
    assert.match(h, /h fuera porque faltó la potencia del transformador o de un circuito para comprobarlo/);
    assert.match(h, /'Barra partida: este transformador alimenta solo estos circuitos en su sección de la barra/);
    assert.match(h, /' Se conserva al guardar con «Confirmar», esta misma lista de circuitos y «Medir con» la suma; «Excluir», «Reabrir» o medir con '\n\s*\+ 'la medida del transformador la quitan, y para volver a usarla hay que revisarla de nuevo con los datos\.'/);
    assert.match(h, /marcas, cuadre\)\);/);
  });
  test('con otra lista y la barra partida guardada, el diálogo dice que así no se puede guardar (D5) y que vuelva a la lista', () => {
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /const otros = g\.barra_partida === true \? otrosQueMiden\(nv\) : \[\];/);
    assert.match(h, /' La lista de circuitos cambió: así no se puede guardar, porque otro transformador de la estación \(' \+ otros\.join\(', '\)/);
    assert.match(h, /mide este nivel y la barra partida solo vale con la lista revisada\. Vuelva a la lista guardada: '/);
    assert.match(h, /cid !== ev0\.cid && p && estN && normalizarTexto\(p\.est\) === estN\n\s*&& esElementoTransformador\(p\.elem\) && p\.niveles && p\.niveles\[nv\]/, 'la misma regla que D5 en erroresSuma');
    assert.doesNotMatch(h, /^import .*textoHorasGuarda/m, 'L-102: ninguna pantalla importa algo nuevo del dominio');
  });
  test('el detalle y el plan de la simulación dicen las horas de la guarda', () => {
    const det = src('ui/cargabilidad-scada/detalle.js');
    assert.match(det, /h\.guarda \? h\.guarda \+ ' h fuera porque el transformador no llevaba solo esos circuitos \(paralelo u otra fuente\)' : null/);
    assert.match(det, /\(spm\.barraPartida === true \? 'barra partida' : 'guarda de potencia'\)/);
    const im = src('ui/scada-datos/importar-mes.js');
    assert.match(im, /\(h\.guarda \? ' · ' \+ h\.guarda \+ ' h fuera porque el transformador no llevaba solo esos circuitos \(paralelo u otra fuente\)' : ''\)/);
    assert.match(im, /\(h\.guardaSinP \? ' · ' \+ h\.guardaSinP \+ ' h fuera porque faltó la potencia del transformador o de un circuito para comprobarlo' : ''\)/);
    assert.match(det, /h\.guardaSinP \? h\.guardaSinP \+ ' h fuera porque faltó la potencia del transformador o de un circuito para comprobarlo' : null/);
    assert.match(det, /spm\.sentidoP === -1 \?/);
  });
});
