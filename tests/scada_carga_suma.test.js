// Cargabilidad SCADA — medida de un nivel por SUMA DE CIRCUITOS (decisión del Ingeniero 2026-10-24, D1–D5), con datos
// SINTÉTICOS de la estación «EstDemo1»: un transformador cuya fase S del 13,8 kV lee el DOBLE y dos circuitos de su barra.
// Los datos se arman con las funciones REALES del importador (CSV → acumular → armar → procesar → resumir, L-118).
// Lo que se exige: la suma hora por hora con sus reglas (hueco, abierto, banda muerta validada), el cuadre con el
// transformador, el derivado que se guarda APARTE (la medida del transformador no cambia), el candado de la página (sin
// derivado válido no hay cifra, nunca la medida propia), la misma cifra en lista, detalle y periodo, y que SIN suma todo
// dé exactamente lo mismo que antes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  SUMA, especSuma, firmaSuma, claveSuma, objetivoConSumas, sumarNivel, componerNivel, cuadreSuma, derivadosDelMes,
  componerSerieMes, componerResumen, estadoSumaNivel, derivadoDeMeses, erroresSuma, aliasTocaSuma, textoSuma, textoCuadre,
  claveEnSumaAjena
} from '../assets/js/domain/scada_carga_suma.js';
import { crearAcumulador, acumularArchivo, armarMeses, procesarPuntoMes, docSerie, docSinCambios, resumirParaGuardar } from '../assets/js/domain/scada_carga_importacion.js';
import { desempaquetar, recortarRango, ventanaDeMes } from '../assets/js/domain/scada_carga_series.js';
import { resumenFisico, iFaseMax, estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { fusionarHomologacion, leerFilasHomologacion, objetivoImportacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO, FAMILIAS } from '../assets/js/domain/scada_carga_config.js';
import { filasLista, calcularEquipo } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { serieMensualEquipo } from '../assets/js/domain/scada_carga_mensual.js';
import { devanadosDe } from '../assets/js/domain/scada_carga_devanados.js';
import { conteosHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';

// ── Datos sintéticos (EstDemo1) ────────────────────────────────────────────────
const C1 = 'EDM301'; const C2 = 'EDM302';   // circuitos de la barra de 13,8 kV de EstDemo1
const MV = 'Mv' + 'Moment';
const pad = (x) => String(x).padStart(2, '0');
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + pad(m) + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const filaCsv = (elem, tok, vals) => '/' + 'EstDemo1'.padEnd(8) + '/' + '13.8kV'.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const txt = (x) => (x == null ? 'null' : (typeof x === 'string' ? x : x.toFixed(3)));
const RAIZ3 = Math.sqrt(3);
const ventanas = { acepta: { dia: 10 }, rechaza: { dia: 12 }, sinRef: { dia: 14 } };   // 8 h «congeladas» de C1 (horas 2–9)
const enVentana = (d, h) => Object.entries(ventanas).find(([, v]) => v.dia === d && h >= 2 && h <= 9)?.[0] || null;

/**
 * Valores de una hora (día d, hora h del rótulo) de los tres puntos. C1 «congela» sus tres corrientes en las ventanas;
 * C2 se abre (corrientes en cero) el día 16 a las 5; los dos se abren a las 6 (con tensión) y a las 7 (sin tensión);
 * C1 trae su corriente R vacía el día 18 a las 3. El transformador ve la suma real (fase S al doble).
 */
function hora(d, h, { quitar = [] } = {}) {
  const idx = (d - 1) * 24 + h;
  const v = enVentana(d, h);
  const a = (k) => (v ? 30 + k : 30 + 8 * Math.sin(idx / 7) + 0.37 * (idx % 5) + k * Math.cos(idx / 3));
  const b = (k) => 20 + 6 * Math.cos(idx / 5) + 0.29 * (idx % 3) + k * Math.sin(idx / 4);
  const A = { R: a(0), S: a(0.6), T: a(-0.5) }; const B = { R: b(0), S: b(0.4), T: b(-0.3) };
  const abierto2 = d === 16 && h === 5; const abiertos = d === 16 && (h === 6 || h === 7); const sinU = d === 16 && h === 7;
  if (abierto2 || abiertos) { B.R = 0; B.S = 0; B.T = 0; }
  if (abiertos) { A.R = 0; A.S = 0; A.T = 0; }
  const U = 13.6 + 0.05 * Math.sin(idx / 11);
  const fac = v === 'rechaza' ? 1.3 : 1;
  const tr = { R: fac * (A.R + B.R), S: 2 * (A.S + B.S), T: fac * (A.T + B.T) };
  const Sreal = RAIZ3 * U * ((A.R + B.R + A.S + B.S + A.T + B.T) / 3) / 1000;
  const out = {
    swTrafo1: { 'I R': v === 'sinRef' ? null : tr.R, 'I S': tr.S, 'I T': v === 'sinRef' ? null : tr.T, 'U RS': sinU ? null : U, P: -0.9 * Sreal, Q: 0.436 * Sreal },
    [C1]: { 'I R': d === 18 && h === 3 ? null : A.R, 'I S': A.S, 'I T': A.T, P: 0.9 * RAIZ3 * U * A.R / 1000 + 0.0001 * (idx % 7), Q: 0.4 * RAIZ3 * U * A.R / 1000 + 0.0001 * (idx % 5) },
    [C2]: { 'I R': B.R, 'I S': B.S, 'I T': B.T, P: 0.9 * RAIZ3 * U * B.R / 1000 + 0.0001 * (idx % 3), Q: 0.4 * RAIZ3 * U * B.R / 1000 + 0.0001 * (idx % 7) }
  };
  for (const q of quitar) delete out[q];
  return out;
}

/** Los archivos de un mes (un CSV por día, con los puntos de `hora`), como los arrastra el Ingeniero. */
function archivosMes(mes, { quitar = [] } = {}) {
  const [an, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(an, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= dias; d++) {
    const porHora = Array.from({ length: 24 }, (_, h) => hora(d, h, { quitar }));
    const lineas = [cab(d, m, an)];
    for (const elem of Object.keys(porHora[0])) for (const tok of Object.keys(porHora[0][elem])) lineas.push(filaCsv(elem, tok, porHora.map((x) => txt(x[elem][tok]))));
    // Un circuito de OTRA estación con el mismo nombre no entra (el objetivo es por estación).
    lineas.push('/' + 'EstDemo2'.padEnd(8) + '/' + '13.8kV'.padEnd(8) + '/' + C1.padEnd(8) + '/' + 'I R'.padEnd(8) + '/' + MV + ',' + Array(24).fill('5').join(','));
    out.push({ nombre: 'x_average-' + an + pad(m) + pad(d) + '.csv', ruta: 'Mes/' + pad(d), texto: lineas.join('\n') });
  }
  return out;
}

/** Un mes por el camino REAL del importador; devuelve lo que el worker tiene al final del bucle del mes. */
function cargarMes(mes, filas, { guardados = null, quitar = [], modo = 'completar' } = {}) {
  const acc = crearAcumulador();
  const obj = objetivoConSumas(filas);
  for (const a of archivosMes(mes, { quitar })) acumularArchivo(acc, { nombre: a.nombre, ruta: a.ruta, texto: a.texto, tamano: a.texto.length }, obj);
  const armados = armarMeses(acc, [mes]).get(mes);
  const porCid = {}; const resumen = {}; const docs = {}; const puntos = {};
  for (const [cid, nuevo] of armados) {
    const p = procesarPuntoMes(nuevo, guardados ? guardados[cid] || null : null, modo);
    resumen[cid] = p.resumen; porCid[cid] = { niveles: p.niveles };
    const meta = acc.puntos.get(cid);
    docs[cid] = docSerie(cid, mes, meta, p.niveles);
    puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [mes] };
  }
  return { acc, porCid, resumen, docs, puntos };
}
/** Lo guardado (desempaquetado) de un doc de serie, como lo lee la página. */
const guardadoDe = (doc) => {
  const g = { claveId: doc.claveId, mes: doc.mes, n: doc.n, niveles: {} };
  for (const [nv, x] of Object.entries(doc.niveles)) { g.niveles[nv] = { kv: x.kv, fam: {} }; for (const [f, s] of Object.entries(x.fam)) g.niveles[nv].fam[f] = desempaquetar(s); }
  return g;
};

const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
const base = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const FID = Object.keys(base)[0];
const CID = claveId('EstDemo1', 'swTrafo1');
const CC1 = claveId('EstDemo1', C1); const CC2 = claveId('EstDemo1', C2);
const decision = (extra = {}) => ({ tipo: 'usar', clave: '/EstDemo1/swTrafo1', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'suma de prueba EstDemo1',
  clave_excel_vista: '/EstDemo1/swTrafo1', avisos_vistos: [], ...extra });
const conSuma = (de = [C1, C2], mas = {}) => ({ [FID]: { ...base[FID], decision: decision({ suma: { N13_8: { de, fases: ['IR', 'IS', 'IT'], barra_propia: true, ...mas } } }) } });
const FILAS = conSuma();
const SIN_SUMA = { [FID]: { ...base[FID], decision: decision() } };
const tx = { id: 'tx1', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' }, placa: { potencia_kva: 12500 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 120, corriente_nominal_secundaria_a: 300 } };
const A_S = 300;

const MAR = cargarMes('2026-03', FILAS);
const DER_MAR = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: FILAS });
const resumenMes = (mes, carga, der) => ({ mes, claves: { ...carga.resumen, ...der } });
const catalogoDe = (...cargas) => {
  const puntos = {};
  for (const c of cargas) for (const [cid, p] of Object.entries(c.puntos)) puntos[cid] = { ...p, meses: [...new Set([...((puntos[cid] && puntos[cid].meses) || []), ...p.meses])].sort() };
  const meses = {}; for (const c of cargas) for (const p of Object.values(c.puntos)) for (const m of p.meses) meses[m] = { completo: true };
  return { meses, puntos };
};
const red3 = (x) => Math.round(x * 1000) / 1000;
/** Rutas de lo que Firestore no guarda: campos `undefined` y números no finitos (recorrido completo, también en listas). */
function noGuardables(x, ruta = '') {
  if (x === undefined) return [ruta];
  if (typeof x === 'number') return Number.isFinite(x) ? [] : [ruta];
  if (Array.isArray(x)) return x.flatMap((y, i) => noGuardables(y, ruta ? ruta + '.' + i : String(i)));
  if (x && typeof x === 'object' && !ArrayBuffer.isView(x)) return Object.entries(x).flatMap(([k, y]) => noGuardables(y, ruta ? ruta + '.' + k : k));
  return [];
}
const SP = () => especSuma(FILAS[FID]).porNivel.N13_8;

describe('la decisión: especSuma, firma, clave y objetivo de la importación', () => {
  test('especSuma normaliza (sin repetidos, en orden) y solo aplica con «usar», fila vigente y nivel asignado', () => {
    const s = especSuma(conSuma([C2, ' ' + C1, C1.toLowerCase()])[FID]);
    assert.equal(s.cid, CID);
    assert.deepEqual(s.porNivel.N13_8.elems, [C1, C2]);
    assert.deepEqual(s.porNivel.N13_8.cids, [CC1, CC2]);
    assert.deepEqual(s.porNivel.N13_8.fases, ['IR', 'IS', 'IT']);
    assert.equal(s.porNivel.N13_8.devanado, 'S'); assert.equal(s.porNivel.N13_8.barraPropia, true);
    assert.equal(especSuma(SIN_SUMA[FID]), null);
    assert.equal(especSuma({ ...FILAS[FID], retirada: true }), null);
    assert.equal(especSuma({ ...FILAS[FID], decision: { ...FILAS[FID].decision, tipo: 'no_usar' } }), null);
    assert.equal(especSuma({ ...FILAS[FID], decision: { ...FILAS[FID].decision, mapa: { N13_8: '' } } }), null, 'nivel en «No usar»: no hay suma');
    // Un '/estación/elemento' de la misma estación vale por su elemento; de otra estación se conserva (y nunca llega).
    const k = especSuma(conSuma(['/EstDemo1/' + C1, '/EstDemo9/' + C2])[FID]).porNivel.N13_8;
    assert.equal(k.elems.length, 2); assert.ok(k.elems.includes(C1));
  });
  test('firma: el orden y las mayúsculas no la cambian; la lista, las fases y la versión sí', () => {
    assert.equal(firmaSuma('N13_8', [CC2, CC1], ['IT', 'IR', 'IS']), firmaSuma('N13_8', [CC1.toUpperCase(), CC2], ['IR', 'IS', 'IT']));
    assert.notEqual(firmaSuma('N13_8', [CC1], SUMA.fases), firmaSuma('N13_8', [CC1, CC2], SUMA.fases));
    assert.notEqual(firmaSuma('N13_8', [CC1, CC2], ['IS']), firmaSuma('N13_8', [CC1, CC2], SUMA.fases));
    assert.match(firmaSuma('N13_8', [CC1], SUMA.fases), new RegExp('^v' + SUMA.version + '\\|'));
    assert.equal(claveSuma(CID), CID + '--suma');
    // El id derivado cumple el patrón de las claves de la regla (minúsculas, guiones y dos rayas bajas).
    assert.match(claveSuma(CID), /^[a-z0-9_-]{1,40}__[a-z0-9_-]{1,40}$/);
  });
  test('objetivoConSumas: el de siempre MÁS los circuitos; deja fuera las filas «no usar» y las retiradas', () => {
    const o = objetivoConSumas(FILAS);
    const b = objetivoImportacion(FILAS);
    assert.deepEqual(o.estaciones, b.estaciones);
    assert.equal(o.quiere('estdemo1', 'swtrafo1'), true);
    assert.equal(o.quiere('estdemo1', 'edm301'), true); assert.equal(o.quiere('estdemo1', 'edm302'), true);
    assert.equal(b.quiere('estdemo1', 'edm301'), false, 'sin la suma, el circuito no se leía');
    assert.equal(o.quiere('estdemo2', 'edm301'), false, 'otra estación');
    const noUsar = { [FID]: { ...FILAS[FID], decision: { ...FILAS[FID].decision, tipo: 'no_usar' } } };
    assert.equal(objetivoConSumas(noUsar).quiere('estdemo1', 'edm301'), false);
    assert.equal(objetivoConSumas({ [FID]: { ...FILAS[FID], retirada: true } }).quiere('estdemo1', 'edm301'), false);
    // Sin sumas, el objetivo es idéntico al de siempre (no-regresión del worker).
    const s = objetivoConSumas(SIN_SUMA); const s0 = objetivoImportacion(SIN_SUMA);
    for (const [e, x] of [['estdemo1', 'swtrafo1'], ['estdemo1', 'swtrafo2'], ['estdemo1', 'edm301'], ['otra', 'swtrafo1']]) assert.equal(s.quiere(e, x), s0.quiere(e, x));
  });
});

describe('la suma hora por hora (sumarNivel / componerNivel)', () => {
  const T = MAR.porCid[CID].niveles.N13_8.fam;
  const F1 = MAR.porCid[CC1].niveles.N13_8.fam; const F2 = MAR.porCid[CC2].niveles.N13_8.fam;
  const idx = (d, h) => (d - 1) * 24 + h;
  test('las tres fases: la hora vale si valen todos y es la suma exacta', () => {
    const s = sumarNivel([F1, F2], T, { n: 744 });
    const h = idx(3, 10);
    for (const F of ['IR', 'IS', 'IT']) {
      assert.equal(s.fam[F].m[h], CODIGO.VALIDO);
      assert.equal(s.fam[F].v[h], Math.fround(F1[F].v[h] + F2[F].v[h]));
    }
    assert.ok(s.horas.completas > 700, 'casi todas las horas con las tres fases');
  });
  test('un circuito que falla deja HUECO con SU código; sin documento, código 1 (nunca una suma parcial)', () => {
    const s = sumarNivel([F1, F2], T, { n: 744 });
    assert.equal(s.fam.IR.m[idx(18, 3)], CODIGO.NULO, 'C1 trae la corriente R vacía');
    assert.equal(s.fam.IS.m[idx(18, 3)], CODIGO.VALIDO);
    const sinC2 = sumarNivel([F1, null], T, { n: 744 });
    assert.equal(sinC2.fam.IR.m[idx(3, 10)], CODIGO.SIN_ARCHIVO);
    assert.ok(Number.isNaN(sinC2.fam.IR.v[idx(3, 10)]));
    assert.equal(sinC2.horas.completas, 0);
  });
  test('D3: un circuito abierto (tres corrientes en cero con tensión) aporta 0; todos abiertos = 9; sin tensión = 6', () => {
    const s = sumarNivel([F1, F2], T, { n: 744 });
    assert.equal(F2.IR.m[idx(16, 5)], CODIGO.CERO, 'el circuito no trae tensión: su cero queda «sin explicación»');
    assert.equal(s.fam.IR.m[idx(16, 5)], CODIGO.VALIDO);
    assert.equal(s.fam.IR.v[idx(16, 5)], F1.IR.v[idx(16, 5)], 'solo aporta el que está cerrado');
    for (const F of ['IR', 'IS', 'IT']) assert.equal(s.fam[F].m[idx(16, 6)], CODIGO.DESENERGIZADO);
    assert.equal(s.fam.IR.v[idx(16, 6)], 0);
    for (const F of ['IR', 'IS', 'IT']) assert.equal(s.fam[F].m[idx(16, 7)], CODIGO.CERO, 'sin tensión no se sabe: hueco');
    assert.equal(s.horas.abiertas, 1, 'una hora con un circuito abierto'); assert.equal(s.horas.fueraServicio, 1, 'una hora con todos abiertos');
  });
  test('D1: banda muerta aceptada (cuadra con R y T), rechazada (no cuadra) y sin referencia (hueco)', () => {
    const estricta = sumarNivel([F1, F2], T, { n: 744 });
    const cu = cuadreSuma(estricta.fam, T);
    assert.deepEqual(cu.referencias, ['IR', 'IT'], 'la fase S del transformador lee el doble: no es referencia');
    for (let h = 2; h <= 9; h++) assert.equal(estricta.fam.IR.m[idx(10, h)], CODIGO.CONGELADO, 'estricta: el congelado es hueco');
    const s = sumarNivel([F1, F2], T, { n: 744, referencias: cu.referencias });
    for (let h = 2; h <= 9; h++) {
      for (const F of ['IR', 'IS', 'IT']) assert.equal(s.fam[F].m[idx(10, h)], CODIGO.RETENIDO, 'aceptada: retenido (válido)');
      assert.equal(s.fam.IR.v[idx(10, h)], Math.fround(F1.IR.v[idx(10, h)] + F2.IR.v[idx(10, h)]));
      for (const F of ['IR', 'IS', 'IT']) assert.equal(s.fam[F].m[idx(12, h)], CODIGO.CONGELADO, 'rechazada: el transformador no cuadra esa hora');
      for (const F of ['IR', 'IS', 'IT']) assert.equal(s.fam[F].m[idx(14, h)], CODIGO.CONGELADO, 'sin referencia válida esa hora: hueco');
    }
    assert.equal(s.horas.bandaMuerta, 8); assert.equal(s.horas.rechazadas, 16);
    // Las tensiones nunca se tocan aquí: la corriente es lo único que se acepta por banda muerta.
    const c = componerNivel({ fuentes: [F1, F2], barra: T, n: 744 });
    assert.deepEqual(c.fam.URS.m, T.URS.m);
  });
  test('componerNivel: tensión, P y Q del transformador (copias); con fases = [IS], R y T también del transformador', () => {
    const c = componerNivel({ fuentes: [F1, F2], barra: T, n: 744 });
    assert.deepEqual([...c.fam.P.v], [...T.P.v]); assert.notEqual(c.fam.P.v, T.P.v, 'una copia, no la misma');
    assert.equal(c.fam.IR.max, undefined, 'las fases sumadas no llevan máximo, mínimo ni instantáneo');
    const s = componerNivel({ fuentes: [F1, F2], barra: T, n: 744, fases: ['IS'] });
    assert.deepEqual([...s.fam.IR.v], [...T.IR.v]); assert.deepEqual([...s.fam.IR.m], [...T.IR.m]);
    assert.equal(s.fam.IS.v[idx(3, 10)], Math.fround(F1.IS.v[idx(3, 10)] + F2.IS.v[idx(3, 10)]));
    assert.equal(c.veredicto, 'ok'); assert.deepEqual(c.signosP, [1, 1]);
  });
  test('cuadre: ok con R y T (S lee 2 ×: «distinta»); no_cuadra si falta un circuito (≈ 1,6); sin_contraste sin corrientes', () => {
    const c = componerNivel({ fuentes: [F1, F2], barra: T, n: 744 }).cuadre;
    assert.equal(c.veredicto, 'ok');
    assert.ok(Math.abs(c.porFase.IR.razon - 1) < 0.01 && Math.abs(c.porFase.IT.razon - 1) < 0.01);
    assert.ok(Math.abs(c.porFase.IS.razon - 2) < 0.02); assert.equal(c.porFase.IS.nota, 'distinta'); assert.equal(c.porFase.IS.cuadra, false);
    const falta = componerNivel({ fuentes: [F1], barra: T, n: 744 }).cuadre;
    assert.equal(falta.veredicto, 'no_cuadra'); assert.ok(falta.porFase.IR.razon > 1.4 && falta.porFase.IR.razon < 1.9, String(falta.porFase.IR.razon));
    const sinI = { URS: T.URS, P: T.P, Q: T.Q };
    assert.equal(componerNivel({ fuentes: [F1, F2], barra: sinI, n: 744 }).cuadre.veredicto, 'sin_contraste');
    assert.equal(componerNivel({ fuentes: [F1, F2], barra: null, n: 744 }).veredicto, 'sin_contraste');
    assert.equal(textoCuadre({ cuadre: c }), 'R ' + c.porFase.IR.razon.toFixed(2).replace('.', ',') + ' · S ' + c.porFase.IS.razon.toFixed(2).replace('.', ',') + ' · T ' + c.porFase.IT.razon.toFixed(2).replace('.', ','));
  });
});

describe('el derivado que guarda el importador (derivadosDelMes)', () => {
  test('va APARTE: la clave del transformador queda idéntica a procesarPuntoMes; cada nivel con horas trae `top`', () => {
    const resumen = { ...MAR.resumen };
    const antes = structuredClone(MAR.resumen[CID]);
    Object.assign(resumen, DER_MAR);   // como el worker al final del bucle del mes
    assert.equal(resumen[CID], MAR.resumen[CID]); assert.deepEqual(resumen[CID], antes);
    assert.deepEqual(Object.keys(DER_MAR), [claveSuma(CID)]);
    const r = DER_MAR[claveSuma(CID)].N13_8;
    assert.ok(r.i.n > 700 && Array.isArray(r.top) && r.top.length === 90);
    assert.equal(r.derivado.estado, 'ok'); assert.equal(r.derivado.v, SUMA.version); assert.equal(r.derivado.firma, SP().firma);
    assert.deepEqual(r.derivado.de, [C1, C2]); assert.equal(r.derivado.base, CID); assert.equal(r.derivado.veredicto, 'ok');
    assert.equal(r.derivado.horas.bandaMuerta, 8);
    // El resumen es el de cualquier nivel, sobre la serie compuesta (lo que el detalle recalcula con las curvas).
    const c = componerNivel({ fuentes: [MAR.porCid[CC1].niveles.N13_8.fam, MAR.porCid[CC2].niveles.N13_8.fam], barra: MAR.porCid[CID].niveles.N13_8.fam, n: 744 });
    const { derivado, ...numeros } = r;
    assert.deepEqual(numeros, resumirParaGuardar(resumenFisico(c.fam, 13.8), c.fam));
    // Testigo potencia/corriente con U, P y Q del transformador: la suma cuadra (la medida propia, con S al doble, no).
    assert.ok(Math.abs(r.rUI - 1) < 0.05, String(r.rUI));
    assert.ok(MAR.resumen[CID].N13_8.rUI > 1.2, String(MAR.resumen[CID].N13_8.rUI));
    // Nada de listas dentro de listas (L-30): Firestore no las admite.
    const anidadas = (x) => (Array.isArray(x) ? x.some((y) => Array.isArray(y) || anidadas(y)) : (x && typeof x === 'object' ? Object.values(x).some(anidadas) : false));
    assert.equal(anidadas(DER_MAR), false);
    // Ningún campo `undefined` ni número no finito (Firestore rechaza el primero). JSON.stringify NO sirve para esto: omite
    // las propiedades undefined (revisión adversarial 2026-10-24); se recorre el objeto entero.
    assert.deepEqual(noGuardables(DER_MAR), []);
    assert.deepEqual(noGuardables(derivadosDelMes({ mes: '2026-03', porCid: cargarMes('2026-03', FILAS, { quitar: [C2] }).porCid, filas: FILAS })), []);
    assert.deepEqual(noGuardables({ a: { b: undefined, c: [1, NaN] } }), ['a.b', 'a.c.1'], 'el recorrido sí ve lo que JSON.stringify esconde');
  });
  test('si falta un circuito en la carga: registro «falta» que tapa el derivado viejo (sin cifra)', () => {
    const sin2 = cargarMes('2026-03', FILAS, { quitar: [C2] });
    const der = derivadosDelMes({ mes: '2026-03', porCid: sin2.porCid, filas: FILAS });
    const r = der[claveSuma(CID)].N13_8;
    assert.deepEqual(r.i, { n: 0 }); assert.equal(r.derivado.estado, 'falta'); assert.deepEqual(r.derivado.faltan, [C2]);
    assert.equal(Array.isArray(r.top), false, 'sin horas no hace falta `top` (la guarda de escribirResumen lo admite)');
  });
  test('circuitos SIN el transformador: se tapa el derivado viejo («falta» el transformador); sin ningún punto de la suma, nada', () => {
    // Revisión adversarial 2026-10-24: las series de los circuitos cambian y el derivado guardado quedaba viejo.
    const porCid = { ...MAR.porCid }; delete porCid[CID];
    const der = derivadosDelMes({ mes: '2026-03', porCid, filas: FILAS });
    const r = der[claveSuma(CID)].N13_8;
    assert.deepEqual(r.i, { n: 0 }); assert.equal(r.derivado.estado, 'falta'); assert.deepEqual(r.derivado.faltan, ['swTrafo1']);
    assert.equal(r.derivado.firma, SP().firma, 'con la firma vigente: tapa (no queda como «otra firma» que se ignora)');
    const solo1 = { [CC1]: MAR.porCid[CC1] };
    assert.equal(derivadosDelMes({ mes: '2026-03', porCid: solo1, filas: FILAS })[claveSuma(CID)].N13_8.derivado.estado, 'falta');
    const ajeno = { [claveId('EstDemo1', 'EDM399')]: MAR.porCid[CC1] };
    assert.deepEqual(derivadosDelMes({ mes: '2026-03', porCid: ajeno, filas: FILAS }), {}, 'ningún punto de la suma: nada');
    assert.deepEqual(derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: SIN_SUMA }), {});
  });
  test('cargar dos veces el mismo mes en «Completar» da lo mismo (series sin cambios y el mismo derivado)', () => {
    const guardados = Object.fromEntries(Object.entries(MAR.docs).map(([cid, d]) => [cid, guardadoDe(d)]));
    const otra = cargarMes('2026-03', FILAS, { guardados });
    for (const cid of [CID, CC1, CC2]) assert.equal(docSinCambios(otra.docs[cid], MAR.docs[cid]), true, cid);
    assert.deepEqual(derivadosDelMes({ mes: '2026-03', porCid: otra.porCid, filas: FILAS }), DER_MAR);
    assert.deepEqual(otra.resumen[CID], MAR.resumen[CID]);
  });
});

describe('ninguna función modifica lo que recibe', () => {
  test('sumarNivel, componerNivel, derivadosDelMes, componerSerieMes, componerResumen, especSuma y erroresSuma', () => {
    const entradas = { porCid: MAR.porCid, filas: FILAS, claves: resumenMes('2026-03', MAR, DER_MAR).claves };
    const copia = structuredClone(entradas);
    const T = MAR.porCid[CID].niveles.N13_8.fam; const F1 = MAR.porCid[CC1].niveles.N13_8.fam; const F2 = MAR.porCid[CC2].niveles.N13_8.fam;
    sumarNivel([F1, F2], T, { n: 744, referencias: ['IR', 'IT'] });
    componerNivel({ fuentes: [F1, F2], barra: T, n: 744 });
    derivadosDelMes({ mes: '2026-03', porCid: entradas.porCid, filas: entradas.filas });
    const trafo = guardadoDe(MAR.docs[CID]); const c1 = guardadoDe(MAR.docs[CC1]); const c2 = guardadoDe(MAR.docs[CC2]);
    const cTrafo = structuredClone(trafo); const cc1 = structuredClone(c1);
    const comp = componerSerieMes({ mes: '2026-03', trafo, circuitos: { [CC1]: c1, [CC2]: c2 }, spec: especSuma(FILAS[FID]) });
    assert.notEqual(comp.serie, trafo); assert.notEqual(comp.serie.niveles.N13_8, trafo.niveles.N13_8);
    componerResumen(entradas.claves, CID, FILAS[FID]);
    especSuma(FILAS[FID]);
    erroresSuma(FILAS[FID], FILAS[FID].decision, { filas: entradas.filas, puntos: MAR.puntos, filaId: FID });
    assert.deepStrictEqual(entradas, copia);
    assert.deepStrictEqual(trafo, cTrafo); assert.deepStrictEqual(c1, cc1);
  });
});

describe('lo que lee la página (componerResumen, estadoSumaNivel, derivadoDeMeses)', () => {
  const claves = resumenMes('2026-03', MAR, DER_MAR).claves;
  test('sin suma devuelve EL MISMO objeto; con suma, el nivel sumado es el derivado válido', () => {
    assert.equal(componerResumen(claves, CID, SIN_SUMA[FID]), claves[CID]);
    assert.equal(componerResumen(claves, CID, null), claves[CID]);
    const r = componerResumen(claves, CID, FILAS[FID]);
    assert.notEqual(r, claves[CID]); assert.equal(r.N13_8, claves[claveSuma(CID)].N13_8);
    assert.equal(componerResumen({}, CID, FILAS[FID]), null, 'sin datos del transformador: nada que componer');
  });
  test('con otra lista de circuitos (firma) u otra versión: registro de reemplazo sin cifra, nunca la medida propia', () => {
    const otra = conSuma([C1]);
    const r = componerResumen(claves, CID, otra[FID]);
    assert.deepEqual(r.N13_8.i, { n: 0 }); assert.equal(r.N13_8.derivado.estado, 'otra_firma');
    const vieja = { ...claves, [claveSuma(CID)]: { N13_8: { ...claves[claveSuma(CID)].N13_8, derivado: { ...claves[claveSuma(CID)].N13_8.derivado, v: SUMA.version - 1 } } } };
    assert.equal(componerResumen(vieja, CID, FILAS[FID]).N13_8.derivado.estado, 'otra_version');
    const sinDer = { ...claves }; delete sinDer[claveSuma(CID)];
    assert.equal(componerResumen(sinDer, CID, FILAS[FID]).N13_8.derivado.estado, 'falta');
    assert.match(estadoSumaNivel(r.N13_8, especSuma(otra[FID]).porNivel.N13_8).motivo, /falta calcular la suma de circuitos de este mes/);
  });
  test('estadoSumaNivel: sin la casilla de barra propia no hay cifra (D5); no_cuadra → aviso (D4)', () => {
    const sp = SP();
    assert.equal(estadoSumaNivel(claves[claveSuma(CID)].N13_8, sp).estado, 'ok');
    assert.equal(estadoSumaNivel(claves[claveSuma(CID)].N13_8, { ...sp, barraPropia: false }).estado, 'sin_barra');
    const nc = { derivado: { ...claves[claveSuma(CID)].N13_8.derivado, veredicto: 'no_cuadra' } };
    assert.equal(estadoSumaNivel(nc, sp).aviso, 'la suma de circuitos no cuadra con el transformador');
  });
  test('derivadoDeMeses: válido si TODOS los meses traen el suyo; si no, «falta» con esos meses; el peor veredicto', () => {
    const sp = SP(); const d = DER_MAR[claveSuma(CID)].N13_8.derivado;
    const ok = derivadoDeMeses([{ mes: '2026-03', derivado: d }, { mes: '2026-04', derivado: d }], sp);
    assert.equal(ok.estado, 'ok'); assert.equal(ok.veredicto, 'ok'); assert.equal(ok.horas.bandaMuerta, 16);
    const falta = derivadoDeMeses([{ mes: '2026-03', derivado: d }, { mes: '2026-04', derivado: null }], sp);
    assert.equal(falta.estado, 'falta'); assert.deepEqual(falta.meses, ['2026-04']);
    assert.match(estadoSumaNivel({ derivado: falta }, sp).motivo, /falta calcular la suma de circuitos de abril 2026: vuelva a cargarlo/);
    const peor = derivadoDeMeses([{ mes: '2026-03', derivado: d }, { mes: '2026-04', derivado: { ...d, veredicto: 'no_cuadra' } }], sp);
    assert.equal(peor.veredicto, 'no_cuadra'); assert.deepEqual(peor.mesesNoCuadran, ['2026-04']);
  });
});

describe('la cifra del equipo con suma de circuitos (lista, detalle, periodo, mes a mes)', () => {
  const homologacion = { filas: FILAS };
  const catalogo = catalogoDe(MAR);
  const resMar = resumenMes('2026-03', MAR, DER_MAR);
  const filaLista = (res, hom = homologacion) => filasLista({ parque: [tx], homologacion: hom, catalogo, resumenMes: res })[0];
  test('con derivado válido: firme, del derivado, con su etiqueta; nunca la medida propia (fase S al doble)', () => {
    const x = filaLista(resMar);
    const der = DER_MAR[claveSuma(CID)].N13_8;
    assert.equal(x.clase, 'firme', x.motivos.join(' · '));
    assert.equal(x.pct, 100 * der.i.p99 / A_S);
    assert.notEqual(x.pct, 100 * MAR.resumen[CID].N13_8.i.p99 / A_S);
    assert.equal(x.niveles[0].etiqueta, '13,8 kV · suma de circuitos');
    assert.deepEqual(x.niveles[0].suma, { de: [C1, C2], estado: 'ok', veredicto: 'ok' });
    assert.equal(x.suma.texto, 'Secundario por suma de circuitos ' + C1 + ' + ' + C2);
    assert.equal(x.suma.veredicto, 'ok');
    assert.deepEqual(x.devanadosPlaca.find((d) => d.d === 'S').niveles, ['13,8 kV · suma de circuitos'], 'la columna Devanados lo rotula');
  });
  test('la decisión pide suma y el mes no tiene derivado: SIN cifra con su motivo (no la medida propia)', () => {
    const x = filaLista({ mes: '2026-03', claves: MAR.resumen });
    assert.equal(x.pct, null); assert.equal(x.clase, 'nulo');
    assert.equal(x.motivoNulo, 'falta calcular la suma de circuitos de este mes: vuelva a cargarlo');
    const sinBarra = filaLista(resMar, { filas: conSuma([C1, C2], { barra_propia: false }) });
    assert.equal(sinBarra.pct, null); assert.match(sinBarra.motivoNulo, /la barra de 13,8 kV la alimenta solo este transformador/);
  });
  test('D4: una suma que no cuadra con el transformador da cifra PROVISIONAL con su motivo', () => {
    const solo1 = conSuma([C1]);
    const der = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: solo1 });
    const x = filaLista(resumenMes('2026-03', MAR, der), { filas: solo1 });
    assert.equal(der[claveSuma(CID)].N13_8.derivado.veredicto, 'no_cuadra');
    assert.notEqual(x.pct, null); assert.equal(x.clase, 'provisional');
    assert.ok(x.motivos.includes('la suma de circuitos no cuadra con el transformador'), x.motivos.join(' · '));
  });
  test('la cifra del mes es la misma en la lista y en el detalle (curvas compuestas al leer, mes completo)', () => {
    const x = filaLista(resMar);
    const leidas = { [CID]: guardadoDe(MAR.docs[CID]), [CC1]: guardadoDe(MAR.docs[CC1]), [CC2]: guardadoDe(MAR.docs[CC2]) };
    const spec = especSuma(FILAS[FID]);
    const r = componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos: { [CC1]: leidas[CC1], [CC2]: leidas[CC2] }, spec });
    assert.deepEqual(r.derivado.N13_8, DER_MAR[claveSuma(CID)].N13_8.derivado, 'el mismo derivado que el importador');
    const v = ventanaDeMes('2026-03');
    const rec = recortarRango({ '2026-03': { estado: 'ok', series: r.serie.niveles.N13_8.fam } }, FAMILIAS, v.desde, v.hasta);
    const resumen = { ...resumirParaGuardar(resumenFisico(rec.fam, 13.8), rec.fam), derivado: derivadoDeMeses([{ mes: '2026-03', derivado: r.derivado.N13_8 }], spec.porNivel.N13_8) };
    const det = calcularEquipo({ tx, fila: FILAS[FID], punto: catalogo.puntos[CID], resumenPorNivel: { N13_8: resumen }, conteos: conteosHomologacion(FILAS), umbrales: null });
    assert.equal(det.pct, x.pct); assert.equal(det.clase, x.clase); assert.deepEqual(det.motivos, x.motivos);
    // Un circuito que no existe ese mes: el nivel queda hueco y su derivado en «falta» (sin cifra).
    const sin = componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos: { [CC1]: leidas[CC1], [CC2]: null }, spec });
    assert.equal(sin.derivado.N13_8.estado, 'falta'); assert.deepEqual(sin.derivado.N13_8.faltan, [C2]);
    assert.ok(sin.serie.niveles.N13_8.fam.IR.m.every((c) => c !== CODIGO.VALIDO && c !== CODIGO.RETENIDO), 'ninguna hora válida: nunca una suma parcial');
    assert.equal(sin.serie.niveles.N13_8.fam.IR.m[(3 - 1) * 24 + 10], CODIGO.SIN_ARCHIVO, 'el código del circuito que falta');
  });
  test('periodo: p99 EXACTO de todas las horas del derivado; un mes sin derivado deja el periodo sin cifra con su motivo', () => {
    const ABR = cargarMes('2026-04', FILAS);
    const derAbr = derivadosDelMes({ mes: '2026-04', porCid: ABR.porCid, filas: FILAS });
    const cat = catalogoDe(MAR, ABR);
    const resumenes = { '2026-03': resMar, '2026-04': resumenMes('2026-04', ABR, derAbr) };
    const p = filasPeriodo({ parque: [tx], homologacion, catalogo: cat, meses: ['2026-03', '2026-04'], resumenes, filasPorMes: {} })[0];
    const serieDe = (carga) => iFaseMax(componerNivel({ fuentes: [carga.porCid[CC1].niveles.N13_8.fam, carga.porCid[CC2].niveles.N13_8.fam], barra: carga.porCid[CID].niveles.N13_8.fam, n: carga === MAR ? 744 : 720 }).fam).serie;
    const todas = Float32Array.from([...serieDe(MAR), ...serieDe(ABR)]);
    assert.equal(p.pct, 100 * red3(estadisticas(todas).p99) / A_S);
    assert.equal(p.clase, 'firme', p.motivos.join(' · '));
    assert.equal(p.niveles[0].etiqueta, '13,8 kV · suma de circuitos');
    const sinAbr = { ...resumenes, '2026-04': { mes: '2026-04', claves: ABR.resumen } };
    const q = filasPeriodo({ parque: [tx], homologacion, catalogo: cat, meses: ['2026-03', '2026-04'], resumenes: sinAbr, filasPorMes: {} })[0];
    assert.equal(q.pct, null); assert.equal(q.motivoNulo, 'falta calcular la suma de circuitos de abril 2026: vuelva a cargarlo');
    // Mes a mes: el mes = la lista de ese mes; el acumulado = «Varios meses».
    const s = serieMensualEquipo({ tx, homologacion, catalogo: cat, punto: cat.puntos[CID], resumenes });
    assert.equal(s[0].mensual.pct, filaLista(resMar).pct);
    assert.equal(s[1].acumulado.pct, p.pct);
    assert.deepEqual(s[1].mensual.devanados.find((d) => d.d === 'S').niveles, ['13,8 kV · suma de circuitos']);
  });
});

describe('SIN suma, todo da exactamente lo mismo que antes (no-regresión)', () => {
  const homologacion = { filas: SIN_SUMA };
  const catalogo = catalogoDe(MAR);
  test('lista: los resúmenes derivados y los circuitos en el mes no cambian nada de una fila sin suma', () => {
    const conTodo = filasLista({ parque: [tx], homologacion, catalogo, resumenMes: resumenMes('2026-03', MAR, DER_MAR) })[0];
    const soloTrafo = filasLista({ parque: [tx], homologacion, catalogo, resumenMes: { mes: '2026-03', claves: { [CID]: MAR.resumen[CID] } } })[0];
    assert.deepEqual(conTodo, soloTrafo);
    assert.equal('suma' in conTodo, false); assert.equal(conTodo.niveles.some((n) => 'suma' in n), false);
    assert.equal(conTodo.niveles[0].etiqueta, '13,8 kV');
    const directo = calcularEquipo({ tx, fila: { ...SIN_SUMA[FID], id: FID }, punto: catalogo.puntos[CID], resumenPorNivel: MAR.resumen[CID], conteos: conteosHomologacion(SIN_SUMA), umbrales: undefined, mes: '2026-03' });
    for (const k of Object.keys(directo)) assert.deepEqual(conTodo[k], directo[k], k);
    assert.deepEqual(conTodo.devanadosPlaca, devanadosDe(tx, directo));
  });
  test('periodo y mes a mes: lo mismo con y sin las claves derivadas', () => {
    const ABR = cargarMes('2026-04', FILAS);
    const cat = catalogoDe(MAR, ABR);
    const conTodo = { '2026-03': resumenMes('2026-03', MAR, DER_MAR), '2026-04': resumenMes('2026-04', ABR, derivadosDelMes({ mes: '2026-04', porCid: ABR.porCid, filas: FILAS })) };
    const soloTrafo = { '2026-03': { mes: '2026-03', claves: { [CID]: MAR.resumen[CID] } }, '2026-04': { mes: '2026-04', claves: { [CID]: ABR.resumen[CID] } } };
    const a = filasPeriodo({ parque: [tx], homologacion, catalogo: cat, meses: ['2026-03', '2026-04'], resumenes: conTodo, filasPorMes: {} })[0];
    const b = filasPeriodo({ parque: [tx], homologacion, catalogo: cat, meses: ['2026-03', '2026-04'], resumenes: soloTrafo, filasPorMes: {} })[0];
    assert.deepEqual(a, b); assert.equal('suma' in a, false);
    assert.deepEqual(serieMensualEquipo({ tx, homologacion, catalogo: cat, punto: cat.puntos[CID], resumenes: conTodo }),
      serieMensualEquipo({ tx, homologacion, catalogo: cat, punto: cat.puntos[CID], resumenes: soloTrafo }));
  });
  test('detalle e historia: sin suma, `leerSeriesEquipo` devuelve lo de `leerSeriesPunto`; la lista lee como siempre', () => {
    const data = readFileSync(new URL('../assets/js/data/scada_carga_suma.js', import.meta.url), 'utf8');
    assert.match(data, /if \(!spec \|\| spec\.cid !== cid\) return leerSeriesPunto\(cid, meses\);/);
    const lista = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
    assert.match(lista, /fila \? import\('\.\.\/\.\.\/data\/scada_carga_suma\.js'\)\.then\(\(m\) => m\.leerSeriesEquipo\(cid, \[mes\], fila\)\) : leerSeriesPunto\(cid, \[mes\]\)/);
    assert.match(lista, /return x && x\.suma && x\.filaId/, 'solo una fila CON suma lee las curvas compuestas');
    assert.doesNotMatch(lista, /^import .*scada_carga_suma/m, 'la lista no carga el lector nuevo de entrada');
    const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(det, /leerSeriesEquipo\(a\.cid, existentes, a\.fila, \{ puntos: \(ctx\.catalogo && ctx\.catalogo\.puntos\) \|\| null \}\)/);
    assert.match(det, /\.\.\.\(origen \? \['Origen'\] : \[\]\)/, 'la columna Origen solo en un nivel sumado (al final)');
    assert.match(det, /\(origen \? '_suma-circuitos' : ''\)/);
    const his = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/historia.js', import.meta.url), 'utf8');
    assert.match(his, /componerResumen\(leidas\[k\]\.datos\.claves, a\.cid, a\.fila, \(ctx\.catalogo && ctx\.catalogo\.puntos\) \|\| null\)/);
    assert.match(his, /leerSeriesEquipo\(a\.cid, \[mes\], a\.fila, \{ puntos: \(ctx\.catalogo && ctx\.catalogo\.puntos\) \|\| null \}\)/);
  });
  test('worker e importación: sin sumas no se calcula nada; con sumas, lector nuevo con versión y freno si es viejo', () => {
    const w = readFileSync(new URL('../assets/js/workers/scada_carga_importar.worker.js', import.meta.url), 'utf8');
    assert.match(w, /const objetivo = objetivoConSumas\(filasAnalisis\);/);
    assert.match(w, /if \(specs\.length\) \{/);
    assert.match(w, /derivados, versionSuma: SUMA\.version, versionInvalid: VERSION_INVALID, versionBandaMuerta: VERSION_BANDA_MUERTA \}\);/);
    assert.doesNotMatch(w, /resumen\[mes\]\[cid\] = .*derivad/, 'el resumen del transformador queda como vino');
    const im = readFileSync(new URL('../assets/js/ui/scada-datos/importar-mes.js', import.meta.url), 'utf8');
    assert.match(im, /scada_carga_importar\.worker\.js\?v=banda1/);
    assert.match(im, /if \(filasConSuma\(\)\.length && procesado\.versionSuma == null\)/);
    assert.match(im, /if \(Array\.isArray\(manifiesto\.alias\) && manifiesto\.alias\.length\) validarAlias\(manifiesto\.alias, filasHomologacion\(\)\)/);
    assert.match(im, /aliasTocaSuma\(manifiesto\.alias, filasHomologacion\(\)\)/);
    assert.match(im, /Se guarda aparte como resumen derivado; la medida del transformador no cambia\./);
  });
});

describe('al guardar la decisión: erroresSuma (D5) y alias', () => {
  const puntos = { ...MAR.puntos };
  const errores = (de, mas = {}, ctx = {}) => erroresSuma(FILAS[FID], decision({ suma: { N13_8: { de, fases: ['IR', 'IS', 'IT'], barra_propia: true, ...mas } }, ...(ctx.decision || {}) }),
    { filas: ctx.filas || FILAS, puntos: ctx.puntos || puntos, filaId: FID });
  test('una suma bien armada se puede guardar', () => {
    assert.deepEqual(errores([C1, C2]), []);
    assert.deepEqual(erroresSuma(SIN_SUMA[FID], SIN_SUMA[FID].decision, { filas: SIN_SUMA, puntos, filaId: FID }), [], 'sin suma no hay nada que revisar');
  });
  test('bloquea: transformador como circuito, repetido, más de 8, nivel sin devanado, sin circuitos y sin la casilla', () => {
    assert.match(errores([C1, 'swTrafo2']).join(' '), /es un transformador, no un circuito/);
    assert.match(errores([C1, 'swTrafo1']).join(' '), /es el propio transformador/);
    assert.match(errores([C1, C1.toLowerCase()]).join(' '), /está repetido/);
    assert.match(errores(Array.from({ length: 9 }, (_, k) => 'EDM3' + pad(k + 10))).join(' '), /más de 8 circuitos/);   // EstDemo1
    assert.match(errores([C1], {}, { decision: { mapa: {} } }).join(' '), /no está asignado a ningún devanado/);
    assert.match(errores([]).join(' '), /Escriba al menos un circuito/);
    assert.match(errores([C1, C2], { barra_propia: false }).join(' '), /Confirme que la barra de 13,8 kV la alimenta solo este transformador/);
    assert.match(errores(['/EstDemo9/' + C1]).join(' '), /es de otra estación/);
  });
  test('bloquea: un circuito de otra suma o que es la medida de otra fila; otro transformador mide ese nivel (barra compartida)', () => {
    const otraId = 'rOtra';
    const otra = { matricula: 'T2-X/X-DM2', subestacion: 'DEMO UNO', clave_excel: '/EstDemo1/swTrafo2', decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo2', mapa: { N34_5: 'P' }, suma: { N34_5: { de: [C2], barra_propia: true } } } };
    assert.match(errores([C1, C2], {}, { filas: { ...FILAS, [otraId]: otra } }).join(' '), /ya está en la suma de otra fila \(T2-X\/X-DM2\)/);
    const deCircuito = { matricula: 'T3-X/X-DM3', subestacion: 'DEMO UNO', clave_excel: '/EstDemo1/' + C1, decision: null };
    assert.match(errores([C1, C2], {}, { filas: { ...FILAS, [otraId]: deCircuito } }).join(' '), /es la medida de otra fila \(T3-X\/X-DM3\)/);
    const conOtroTrafo = { ...puntos, [claveId('EstDemo1', 'swTrafo2')]: { clave: '/EstDemo1/swTrafo2', est: 'EstDemo1', elem: 'swTrafo2', niveles: { N13_8: {} }, meses: ['2026-03'] } };
    assert.match(errores([C1, C2], {}, { puntos: conOtroTrafo }).join(' '), /Otro transformador de la estación \(swTrafo2\) también mide 13,8 kV/);
    // Si el otro transformador mide OTRO nivel, no estorba.
    const otroNivel = { ...puntos, [claveId('EstDemo1', 'swTrafo2')]: { clave: '/EstDemo1/swTrafo2', est: 'EstDemo1', elem: 'swTrafo2', niveles: { N34_5: {} }, meses: ['2026-03'] } };
    assert.deepEqual(errores([C1, C2], {}, { puntos: otroNivel }), []);
  });
  test('aliasTocaSuma: un alias no puede renombrar ni esconder un circuito de una suma', () => {
    assert.throws(() => aliasTocaSuma([{ est: 'EstDemo1', de: C1, a: 'swTrafo1' }], FILAS), /es un circuito de una suma de circuitos/);
    assert.throws(() => aliasTocaSuma([{ est: 'EstDemo1', de: 'swTafoX1', a: C2 }], FILAS), /es un circuito de una suma de circuitos/);
    assert.doesNotThrow(() => aliasTocaSuma([{ est: 'EstDemo1', de: 'swTafoX1', a: 'swTrafo1' }], FILAS));
    assert.doesNotThrow(() => aliasTocaSuma([{ est: 'EstDemo1', de: C1, a: 'swTrafo1' }], SIN_SUMA));
  });
  test('textoSuma: el rótulo de la lista con los nombres de la decisión (nunca del código)', () => {
    const spec = especSuma(FILAS[FID]);
    assert.equal(textoSuma(spec), 'Secundario por suma de circuitos ' + C1 + ' + ' + C2);
    assert.match(textoSuma(spec, 'N13_8', { derivado: DER_MAR[claveSuma(CID)].N13_8.derivado }), /transformador ÷ suma: R 1,00 · S 2,0\d · T 1,00 \(cuadra\)$/);
    assert.equal(textoSuma(null), null);
  });
});

describe('L-102 y compilación', () => {
  const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
  test('los archivos NUEVOS solo importan exportaciones ya publicadas (líneas exactas)', () => {
    const dom = src('domain/scada_carga_suma.js');
    const imp = [...dom.matchAll(/^import \{([^}]+)\} from '(\.[^']+)';/gm)].map((m) => m[2] + ':' + m[1].split(',').map((x) => x.trim()).sort().join(','));
    assert.deepEqual(imp.sort(), [
      './scada_carga_config.js:CODIGO,CODIGOS_VALIDOS,DEVANADO,FAMILIAS_I,FAMILIAS_U,NIVELES',
      './scada_carga_csv.js:claveId,esElementoTransformador,normalizarTexto',
      './scada_carga_fecha.js:nombreMes',
      './scada_carga_homologacion.js:analizarClaveHomologada,claveEfectiva,mapaDeDecision,objetivoImportacion',
      './scada_carga_importacion.js:resumirParaGuardar',
      './scada_carga_kpis.js:percentilOrdenado,resumenFisico',
      './scada_carga_limpieza.js:validos',
      './scada_carga_series.js:horasMes'
    ].sort());
    const data = src('data/scada_carga_suma.js');
    assert.deepEqual([...data.matchAll(/^import .*$/gm)].map((m) => m[0]), [
      "import { leerSeriesPunto, leerResumenMes } from './scada_carga.js';",
      "import { especSuma, componerSerieMes } from '../domain/scada_carga_suma.js';"
    ]);
  });
  test('los módulos de pantalla, el worker y el lector nuevo compilan', () => {
    for (const f of ['workers/scada_carga_importar.worker.js', 'ui/scada-datos/importar-mes.js', 'ui/scada-datos/homologacion.js', 'ui/cargabilidad-scada/lista.js',
      'ui/cargabilidad-scada/detalle.js', 'ui/cargabilidad-scada/historia.js', 'data/scada_carga_suma.js', 'ui/cargabilidad-scada/panel-devanados-mes.js']) {
      const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src(f), encoding: 'utf8' });
      assert.equal(r.status, 0, f + ': ' + r.stderr);
    }
  });
  test('el diálogo «Revisar» guarda la suma con su casilla, la valida con erroresSuma y evalúa con componerResumen', () => {
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /suma\[nv\] = \{ de: listaDe\(sumaUI\[nv\]\.de\.value\), fases: \[\.\.\.SUMA\.fases\], barra_propia: !!sumaUI\[nv\]\.barra\.checked \};/);
    assert.match(h, /const errores = erroresSuma\(f, decision, \{ filas: ctx\.filas, puntos: ctx\.puntos, filaId: f\.id \}\);/);
    assert.match(h, /componerResumen\(resumenUltimo\.claves, cid, fila, ctx\.puntos\)/);
    assert.match(h, /'Medir con la medida del transformador'/); assert.match(h, /'Medir con la suma de circuitos'/);
    assert.match(h, /La barra de este nivel la alimenta solo este transformador/);
    assert.match(h, /El cuadre con el transformador se calculará al volver a cargar los meses\./);
    assert.match(h, /if \(Object\.keys\(suma\)\.length\) \{/, 'sin suma, la decisión de siempre (sin el campo)');
    // `hidden` va en un div: en el fieldset no basta, la hoja de estilos le da display:flex a .cs-rango (lo atrapó la prueba de humo).
    assert.match(h, /return el\('div', \{\}, el\('fieldset', \{ class: 'cs-rango'/);
    assert.match(h, /bloque\.hidden = medir\.disabled \|\| medir\.value !== 'suma';/);
  });
});

describe('revisión adversarial 2026-10-24: candado del detalle, D5 después de guardar, huella, horas y textos', () => {
  const resMar = resumenMes('2026-03', MAR, DER_MAR);
  const catalogo = catalogoDe(MAR);
  const lista = (res, filas = FILAS, cat = catalogo) => filasLista({ parque: [tx], homologacion: { filas }, catalogo: cat, resumenMes: res })[0];
  const leidas = { [CID]: guardadoDe(MAR.docs[CID]), [CC1]: guardadoDe(MAR.docs[CC1]), [CC2]: guardadoDe(MAR.docs[CC2]) };
  /** Lo que hace el detalle con el mes completo: leerSeriesEquipo (con el resumen GUARDADO del mes) → derivadoDeMeses → calcularEquipo. */
  function detalle({ filas = FILAS, guardadas, circuitos = { [CC1]: leidas[CC1], [CC2]: leidas[CC2] }, puntos = null, cat = catalogo }) {
    const fila = filas[FID]; const spec = especSuma(fila);
    const comp = componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos, spec, guardadas, puntos });
    const v = ventanaDeMes('2026-03');
    const rec = recortarRango({ '2026-03': { estado: 'ok', series: comp.serie.niveles.N13_8.fam } }, FAMILIAS, v.desde, v.hasta);
    const resumen = { ...resumirParaGuardar(resumenFisico(rec.fam, 13.8), rec.fam), derivado: derivadoDeMeses([{ mes: '2026-03', derivado: comp.derivado.N13_8 }], spec.porNivel.N13_8) };
    return { comp, calc: calcularEquipo({ tx, fila, punto: cat.puntos[CID], resumenPorNivel: { N13_8: resumen }, conteos: conteosHomologacion(filas), umbrales: null }) };
  }

  test('candado del detalle: con el derivado guardado válido, la misma cifra que la lista', () => {
    const x = lista(resMar);
    const d = detalle({ guardadas: resMar.claves });
    assert.equal(d.comp.derivado.N13_8.estado, 'ok');
    assert.equal(d.calc.pct, x.pct); assert.equal(d.calc.clase, x.clase); assert.deepEqual(d.calc.motivos, x.motivos);
  });
  test('candado del detalle: lo guardado dice «falta» (la última carga no trajo un circuito) → sin cifra en la lista Y en el detalle', () => {
    // La curva vieja del circuito SÍ existe (de la carga anterior): sin el candado, el detalle la sumaba y daba cifra.
    const sin2 = cargarMes('2026-03', FILAS, { quitar: [C2] });
    const claves = { ...resMar.claves, ...sin2.resumen, ...derivadosDelMes({ mes: '2026-03', porCid: sin2.porCid, filas: FILAS }) };   // fundirResumen
    const x = lista({ mes: '2026-03', claves });
    assert.equal(x.pct, null);
    assert.equal(x.motivoNulo, 'falta calcular la suma de circuitos de este mes (no llegó ' + C2 + '): vuelva a cargarlo con esa medida');
    const d = detalle({ guardadas: claves });
    assert.equal(d.comp.derivado.N13_8.estado, 'falta'); assert.deepEqual(d.comp.derivado.N13_8.faltan, [C2]);
    assert.equal(d.calc.pct, null); assert.match(d.calc.motivoNulo, /^falta calcular la suma de circuitos de marzo 2026/);
    assert.equal(detalle({ guardadas: null }).comp.derivado.N13_8.estado, 'ok', 'sin el resumen guardado la curva se sumaría: es lo que el candado evita');
  });
  test('candado del detalle: otra lista de circuitos (otra firma) sin volver a cargar → sin cifra en los dos', () => {
    const solo1 = conSuma([C1]);
    assert.equal(lista(resMar, solo1).pct, null);
    const d = detalle({ filas: solo1, guardadas: resMar.claves, circuitos: { [CC1]: leidas[CC1] } });
    assert.equal(d.comp.derivado.N13_8.estado, 'otra_firma'); assert.equal(d.calc.pct, null);
  });
  test('circuitos sin el transformador: el derivado tapado deja el mes sin cifra en la lista y en el detalle (nunca la cifra vieja)', () => {
    const porCid = { [CC1]: MAR.porCid[CC1], [CC2]: MAR.porCid[CC2] };
    const claves = { ...resMar.claves, ...derivadosDelMes({ mes: '2026-03', porCid, filas: FILAS }) };
    const x = lista({ mes: '2026-03', claves });
    assert.equal(x.pct, null); assert.match(x.motivoNulo, /no llegó swTrafo1\): vuelva a cargarlo con esa medida/);
    assert.equal(detalle({ guardadas: claves }).calc.pct, null);
  });
  test('huella: el derivado lleva la medida del transformador con que se compuso; si esa medida cambia después, sin cifra', () => {
    const i = MAR.resumen[CID].N13_8.i;
    assert.deepEqual(DER_MAR[claveSuma(CID)].N13_8.derivado.base_i, { n: i.n, p99: i.p99 });
    // El mes se volvió a cargar SIN la suma (pestaña vieja, o la fila pasó por «medida» y volvió): el transformador es otro.
    const otra = { ...resMar.claves, [CID]: { ...MAR.resumen[CID], N13_8: { ...MAR.resumen[CID].N13_8, i: { ...i, n: i.n + 24, p99: red3(i.p99 * 1.4) } } } };
    const r = componerResumen(otra, CID, FILAS[FID]);
    assert.equal(r.N13_8.derivado.estado, 'desfasado'); assert.deepEqual(r.N13_8.i, { n: 0 });
    const x = lista({ mes: '2026-03', claves: otra });
    assert.equal(x.pct, null); assert.equal(x.motivoNulo, 'falta calcular la suma de circuitos de este mes: vuelva a cargarlo');
    assert.equal(detalle({ guardadas: otra }).calc.pct, null, 'el detalle aplica el mismo candado');
    // Un derivado sin huella (no debería existir: todavía no hay derivados en producción) tampoco vale.
    const { base_i: _sin, ...sinHuella } = DER_MAR[claveSuma(CID)].N13_8.derivado;
    const viejo = { ...resMar.claves, [claveSuma(CID)]: { N13_8: { ...DER_MAR[claveSuma(CID)].N13_8, derivado: sinHuella } } };
    assert.equal(componerResumen(viejo, CID, FILAS[FID]).N13_8.derivado.estado, 'desfasado');
  });
  test('D5 después de guardar: otro transformador de la estación mide la barra → sin cifra en la lista, el periodo y el detalle', () => {
    const sw2 = claveId('EstDemo1', 'swTrafo2');
    const conOtro = { ...catalogo, puntos: { ...catalogo.puntos, [sw2]: { clave: '/EstDemo1/swTrafo2', est: 'EstDemo1', elem: 'swTrafo2', niveles: { N13_8: {} }, meses: ['2026-03'] } } };
    const motivo = /^otro transformador de la estación \(swTrafo2\) también mide 13,8 kV: la barra puede ser compartida y la suma de circuitos no se puede usar$/;
    const x = lista(resMar, FILAS, conOtro);
    assert.equal(x.pct, null); assert.match(x.motivoNulo, motivo);
    const ABR = cargarMes('2026-04', FILAS);
    const cat2 = { meses: { '2026-03': { completo: true }, '2026-04': { completo: true } }, puntos: { ...catalogoDe(MAR, ABR).puntos, [sw2]: conOtro.puntos[sw2] } };
    const resumenes = { '2026-03': resMar, '2026-04': resumenMes('2026-04', ABR, derivadosDelMes({ mes: '2026-04', porCid: ABR.porCid, filas: FILAS })) };
    const p = filasPeriodo({ parque: [tx], homologacion: { filas: FILAS }, catalogo: cat2, meses: ['2026-03', '2026-04'], resumenes, filasPorMes: {} })[0];
    assert.equal(p.pct, null); assert.match(p.motivoNulo, motivo);
    const d = detalle({ guardadas: resMar.claves, puntos: conOtro.puntos, cat: conOtro });
    assert.equal(d.comp.derivado.N13_8.estado, 'barra_compartida'); assert.deepEqual(d.comp.derivado.N13_8.otros, ['swTrafo2']);
    assert.equal(d.calc.pct, null); assert.match(d.calc.motivoNulo, motivo);
    // Si el otro transformador mide OTRO nivel, no estorba; sin el catálogo, componerResumen da lo de antes.
    const otroNivel = { ...catalogo, puntos: { ...catalogo.puntos, [sw2]: { ...conOtro.puntos[sw2], niveles: { N34_5: {} } } } };
    assert.equal(lista(resMar, FILAS, otroNivel).pct, lista(resMar).pct);
    assert.equal(componerResumen(resMar.claves, CID, FILAS[FID]).N13_8, resMar.claves[claveSuma(CID)].N13_8);
    // Al guardar la decisión, el mismo bloqueo (y con la misma función).
    assert.match(erroresSuma(FILAS[FID], FILAS[FID].decision, { filas: FILAS, puntos: conOtro.puntos, filaId: FID }).join(' '), /Otro transformador de la estación \(swTrafo2\) también mide 13,8 kV/);
  });
  test('circuito que SÍ llegó pero no mide el nivel: «sin_nivel» con su motivo (no «no llegó»); erroresSuma lo frena', () => {
    const filas34 = { [FID]: { ...base[FID], decision: decision({ mapa: { N13_8: 'S', N34_5: 'P' }, niveles_vistos: ['N13_8', 'N34_5'],
      suma: { N34_5: { de: [C1], fases: ['IR', 'IS', 'IT'], barra_propia: true } } }) } };
    const d = derivadosDelMes({ mes: '2026-03', porCid: MAR.porCid, filas: filas34 })[claveSuma(CID)].N34_5.derivado;
    assert.equal(d.estado, 'sin_nivel'); assert.deepEqual(d.sinNivel, [C1]); assert.equal('faltan' in d, false);
    const sp = especSuma(filas34[FID]).porNivel.N34_5;
    assert.equal(estadoSumaNivel({ derivado: d }, sp).motivo, C1 + ' llegó pero no mide 34,5 kV: revise el nivel o el nombre del circuito en la homologación');
    assert.equal(componerSerieMes({ mes: '2026-03', trafo: leidas[CID], circuitos: { [CC1]: leidas[CC1] }, spec: especSuma(filas34[FID]) }).derivado.N34_5.estado, 'sin_nivel');
    // Varios meses: el bloqueo pasa con su nombre (volver a cargar no lo arregla).
    const dm = derivadoDeMeses([{ mes: '2026-03', derivado: d }, { mes: '2026-04', derivado: null }], sp);
    assert.equal(dm.estado, 'sin_nivel'); assert.deepEqual(dm.sinNivel, [C1]); assert.deepEqual(dm.meses, ['2026-03', '2026-04']);
    assert.match(estadoSumaNivel({ derivado: dm }, sp).motivo, /llegó pero no mide 34,5 kV/);
    // Al guardar: el mismo circuito en dos niveles, y uno que los datos cargados ya traen en otro nivel.
    const dos = decision({ mapa: { N13_8: 'S', N34_5: 'P' }, suma: { N13_8: { de: [C1, C2], barra_propia: true }, N34_5: { de: [C1], barra_propia: true } } });
    assert.match(erroresSuma(FILAS[FID], dos, { filas: FILAS, puntos: {}, filaId: FID }).join(' '), new RegExp('«' + C1 + '» está en la suma de 13,8 kV y de 34,5 kV: un circuito es de una sola barra'));
    const otro = decision({ mapa: { N13_8: 'S', N34_5: 'P' }, suma: { N34_5: { de: [C1], barra_propia: true } } });
    assert.match(erroresSuma(FILAS[FID], otro, { filas: FILAS, puntos: MAR.puntos, filaId: FID }).join(' '), new RegExp('«' + C1 + '» está en los datos cargados pero no mide 34,5 kV \\(mide 13,8 kV\\)'));
    assert.deepEqual(erroresSuma(FILAS[FID], otro, { filas: FILAS, puntos: {}, filaId: FID }), [], 'sin datos cargados de ese circuito se puede guardar');
  });
  test('las horas por banda muerta y con un circuito abierto son parte de las horas COMPLETAS (nunca más que ellas)', () => {
    const T = MAR.porCid[CID].niveles.N13_8.fam; const F1 = MAR.porCid[CC1].niveles.N13_8.fam; const F2 = MAR.porCid[CC2].niveles.N13_8.fam;
    const conHueco = (F, fase, h) => ({ ...F, [fase]: { ...F[fase], m: Uint8Array.from(F[fase].m, (c, k) => (k === h ? CODIGO.NULO : c)) } });
    const hBanda = (10 - 1) * 24 + 3; const hAbierto = (16 - 1) * 24 + 5;
    // Esa hora de banda muerta pierde la fase S de C2 y la del circuito abierto la T de C1: quedan sin las tres fases.
    const s = sumarNivel([conHueco(F1, 'IT', hAbierto), conHueco(F2, 'IS', hBanda)], T, { n: 744, referencias: ['IR', 'IT'] });
    assert.equal(s.fam.IR.m[hBanda], CODIGO.RETENIDO, 'la fase R sí entra por banda muerta'); assert.notEqual(s.fam.IS.m[hBanda], CODIGO.RETENIDO);
    assert.equal(s.horas.bandaMuerta, 7, 'la hora sin las tres fases ya no cuenta como banda muerta (antes: 8)');
    assert.equal(s.horas.abiertas, 0, 'la hora del circuito abierto quedó sin las tres fases (antes: 1)');
    assert.ok(s.horas.bandaMuerta + s.horas.abiertas <= s.horas.completas);
    const d = DER_MAR[claveSuma(CID)].N13_8.derivado.horas;
    assert.ok(d.bandaMuerta <= d.completas && d.abiertas <= d.completas);
  });
  test('textoCuadre: un rango que se lee igual va una sola vez («R 1,00», nunca «R 1,00–1,00»)', () => {
    assert.equal(textoCuadre({ razones: { IR: { min: 0.998, max: 1.003 }, IS: { min: 2.01, max: 2.03 }, IT: { min: 0.981, max: 0.99 } } }), 'R 1,00 · S 2,01–2,03 · T 0,98–0,99');
    const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(det, /num\(rz\[F\]\.min, 2\) === num\(rz\[F\]\.max, 2\) \?/, 'el detalle compara los textos redondeados');
  });
  test('claveEnSumaAjena: la medida de una fila no puede ser un circuito que OTRA fila ya suma', () => {
    assert.equal(claveEnSumaAjena('/EstDemo1/' + C1, FILAS, 'otraFila'), base[FID].matricula);
    assert.equal(claveEnSumaAjena('/EstDemo1/' + C1, FILAS, FID), null, 'sus propias sumas no cuentan');
    assert.equal(claveEnSumaAjena('/EstDemo1/swTrafo1', FILAS, 'otraFila'), null);
    assert.equal(claveEnSumaAjena('/EstDemo1/' + C1, SIN_SUMA, 'otraFila'), null);
    assert.equal(claveEnSumaAjena(null, FILAS, 'otraFila'), null);
  });
  test('el lector (worker) de verdad, en Node: sin sumas lo de siempre; con sumas el derivado APARTE; solo circuitos, tapado', async () => {
    const msgs = [];
    globalThis.self = globalThis; globalThis.postMessage = (m) => msgs.push(m);
    await import('../assets/js/workers/scada_carga_importar.worker.js');
    const correr = async (filas, quitar = []) => {
      msgs.length = 0;
      const archivos = archivosMes('2026-03', { quitar }).map((a) => ({ file: new File([a.texto], a.nombre), ruta: a.ruta, nombre: a.nombre, tamano: a.texto.length }));
      await globalThis.self.onmessage({ data: { tipo: 'analizar', archivos, filas } });
      await globalThis.self.onmessage({ data: { tipo: 'procesar', meses: ['2026-03'], guardados: {}, modo: 'completar' } });
      const err = msgs.find((m) => m.tipo === 'error');
      if (err) throw new Error(err.mensaje);
      return msgs.find((m) => m.tipo === 'procesado');
    };
    const sin = await correr(SIN_SUMA);
    assert.deepEqual(Object.keys(sin.resumen['2026-03']), [CID], 'sin suma no se leen los circuitos');
    assert.deepEqual(sin.derivados, []);
    assert.deepEqual(sin.resumen['2026-03'][CID], MAR.resumen[CID], 'el resumen del transformador es el de siempre');
    assert.equal(sin.docs.length, 1); assert.equal(docSinCambios(sin.docs[0], MAR.docs[CID]), true);
    const con = await correr(FILAS);
    assert.deepEqual(Object.keys(con.resumen['2026-03']).sort(), [CID, CC1, CC2, claveSuma(CID)].sort());
    assert.deepEqual(con.resumen['2026-03'][CID], sin.resumen['2026-03'][CID], 'la suma no toca la medida del transformador');
    assert.deepEqual(con.resumen['2026-03'][claveSuma(CID)], DER_MAR[claveSuma(CID)]);
    assert.equal(con.versionSuma, SUMA.version); assert.equal(con.derivados.length, 1);
    assert.deepEqual(noGuardables(con.resumen['2026-03'][claveSuma(CID)]), []);
    const solo = await correr(FILAS, ['swTrafo1']);
    assert.equal(solo.resumen['2026-03'][CID], undefined);
    assert.deepEqual(solo.resumen['2026-03'][claveSuma(CID)].N13_8.derivado.faltan, ['swTrafo1']);
  });
  test('pantallas: lo que la revisión adversarial pidió y no corre en Node queda en el código', () => {
    const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
    const data = src('data/scada_carga_suma.js');
    assert.match(data, /Promise\.all\(meses\.map\(\(m\) => leerResumenMes\(m\)\)\)/, 'el detalle lee el resumen guardado de cada mes');
    assert.match(data, /componerSerieMes\(\{ mes, trafo: t\.serie, circuitos: series, spec, guardadas, puntos \}\)/);
    assert.match(data, /\|\| !rg \|\| rg\.estado === 'fallo'\) \{ porMes\[mes\] = \{ estado: 'fallo' \}; return; \}/, 'sin poder leer lo guardado, «no se pudo leer»');
    const im = src('ui/scada-datos/importar-mes.js');
    assert.match(im, /firmaSumasLeidas = firmaSumas\(\);\n    w\.postMessage\(\{ tipo: 'analizar'/);
    assert.match(im, /if \(firmaSumas\(\) !== firmaSumasLeidas\) \{/, 'la homologación cambió después de leer la carpeta');
    assert.match(im, /sinCalcular: lineas\.some\(\(x\) => !x\.resumen\)/);
    assert.match(im, /\|\| !!\(plan\.sumas && plan\.sumas\.sinCalcular\), onclick: guardar \}, 'Guardar en la base'\)/);
    assert.match(im, /const umbrales = await obtenerUmbralesActivos\(\)\.catch\(\(\) => null\);/, 'las bandas activas, como la lista');
    assert.match(im, /componerResumen\(claves, spec\.cid, f, puntosCat\), conteos, umbrales, mes \}\)/);
    assert.match(im, /if \(!claves\[spec\.cid\] && !claves\[claveSuma\(spec\.cid\)\]\) continue;/, 'el derivado tapado también se dice en el plan');
    assert.match(im, /if \(d\.estado === 'sin_nivel'\)/);
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /if \(mes !== mesResumen \|\| carga !== cargaResumen\) \{/, 'tras cargar el MISMO mes se vuelve a leer su resumen');
    assert.match(h, /if \(tipo\.value === 'usar' && !niveles\.length && \(Object\.keys\(sumaGuardada\)\.length \|\| fscGuardada \|\| bmGuardada \|\| mapaGuardado\)\) \{/, 'sin niveles a la vista no se borra la suma');
    assert.match(h, /ponga primero «Medir con la medida del transformador» en el nivel sumado, guarde, y vuelva a abrir «Revisar»/);
    assert.match(h, /medir\.disabled = !s\.value;/); assert.match(h, /de la medida propia del transformador: no se usa/);
    assert.match(h, /if \(!medirSel\[nv\] \|\| medirSel\[nv\]\.disabled \|\| medirSel\[nv\]\.value !== 'suma'\) continue;/);
    assert.match(h, /const ajena = tipo\.value === 'usar' \? claveEnSumaAjena\(selClave\.value \|\| null, ctx\.filas, f\.id\) : null;/);
    const l = src('ui/cargabilidad-scada/lista.js');
    // Desde 2026-10-26 la siguen las dos columnas de la sobrecarga por devanado (también al final; las de antes no se mueven).
    // …y desde el mismo día la columna del cambio de medida (también al final).
    assert.equal((l.match(/\.\.\.CSV_DEV_CAB, 'Suma_de_circuitos', \.\.\.CSV_SOB_CAB, 'Cambio_de_medida'\]/g) || []).length, 2, 'columna NUEVA al final de los dos CSV');
    assert.equal((l.match(/\.\.\.csvDevanados\(x\.devanadosPlaca\), textoSumaCSV\(x\), \.\.\.csvSobrecarga\(x\), csvCambio\(x\)\]/g) || []).length, 2);
    assert.match(l, /porSuma\(d\) \? el\('span', \{ class: 'cs-sub' \}, 'por suma de circuitos'\) : null/);
    const pd = src('ui/cargabilidad-scada/panel-devanados-mes.js');
    assert.match(pd, /porSuma\(niveles\) \? el\('p', \{ class: 'cs-sub' \}, SUB_SUMA\) : null/);
    assert.match(pd, /porSuma\(ed\.porDevanado\[b\.d\]\.niveles\)/);
    // El rótulo del que cuelgan esas líneas lo pone calcularEquipo en el nivel (y devanadosDe lo pasa a cada devanado).
    const x = lista(resMar);
    assert.ok(x.devanadosPlaca.find((dv) => dv.d === 'S').niveles.some((t) => /suma de circuitos/.test(t)));
  });
});
