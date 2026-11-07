// Cargabilidad SCADA — MEDIDA COMÚN de transformadores en paralelo (decisión del Ingeniero 2026-11-06, «mitad de la medida
// común»), con datos SINTÉTICOS de la estación «EstDemo1»: dos transformadores gemelos (110/66/13,8 kV) en paralelo detrás
// de las mismas bahías de 110 y 66 kV; el punto «swTrafo1» mide la SUMA de los dos en esos niveles y, en 13,8 kV, solo la
// del primero (ese nivel es solo suyo). Los datos se arman con las funciones REALES del importador (CSV → acumular →
// armar → procesar → resumir, L-118).
// Lo que se exige: cada fila sale con la medida común ÷ n (cifra = p99 / 2 ÷ A), PROVISIONAL con su motivo; el nivel propio
// sin dividir; el periodo de varios meses dividido igual que el mes (también sus horas más altas); las curvas del detalle
// divididas (P y Q también: el factor de potencia igual, S ÷ n); la validación al guardar; CLAVE_COMPARTIDA no bloquea con
// la marca coherente y sí sin ella; el diálogo conserva la marca; y que SIN la marca todo dé exactamente lo mismo que hoy.
// Revisión adversarial (2026-11-06): el grupo que ya no cuadra (falta una fila, otra sin la marca o con otro n) lleva
// MEDIDA_COMUN_INCOMPLETA en TODAS sus filas vigentes y no se puede «ver»; el diálogo calcula los avisos con los conteos de
// ANTES de guardar (como siempre: sin la marca, lo mismo que hoy) y no deja vistos ni ese ni CLAVE_COMPARTIDA con la marca;
// los topes del sistema no se dividen; banda
// muerta o fase sin carga en un nivel común no se deja guardar y ese nivel no se divide; los textos dicen la salida.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MEDIDA_COMUN, especMedidaComun, dividirResumenNivel, dividirResumen, dividirFamilias, dividirSerie, dividirLectura,
  clavesConMedidaComun, erroresMedidaComun, etiquetaMedidaComun, motivoMedidaComun, notaCurvasMedidaComun,
  origenCsvMedidaComun, textoMedidaComunGuardada, gruposMedidaComun, avisosQueSePuedenVer, AVISO_INCOMPLETA, textoDetalleMedidaComun,
  repartoMedidaComun, copiaMedidaComun, rotuloMedidaComun, alcanceCurvasMedidaComun, porcentajeParte, fraccionMedidaComun
} from '../assets/js/domain/scada_carga_medida_comun.js';
import { crearAcumulador, acumularArchivo, armarMeses, procesarPuntoMes, docSerie, resumirParaGuardar } from '../assets/js/domain/scada_carga_importacion.js';
import { desempaquetar } from '../assets/js/domain/scada_carga_series.js';
import { resumenFisico, serieS, factorPotencia } from '../assets/js/domain/scada_carga_kpis.js';
import {
  fusionarHomologacion, leerFilasHomologacion, objetivoImportacion, conteosHomologacion, avisosFila, analizarClaveHomologada, claveEfectiva,
  estadoEfectivo, AVISOS
} from '../assets/js/domain/scada_carga_homologacion.js';
import { extrasVisibles } from '../assets/js/domain/scada_carga_extras.js';
import { CENTINELAS } from '../assets/js/domain/scada_carga_config.js';
import { esCentinela } from '../assets/js/domain/scada_carga_limpieza.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { componerResumen, erroresSuma, claveEnSumaAjena } from '../assets/js/domain/scada_carga_suma.js';
import { filasLista, calcularEquipo } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo, topsDe } from '../assets/js/domain/scada_carga_periodo.js';

// ── Datos sintéticos (EstDemo1) ────────────────────────────────────────────────
const MV = 'Mv' + 'Moment';
const pad = (x) => String(x).padStart(2, '0');
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + pad(m) + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const filaCsv = (nivel, elem, tok, vals) => '/' + 'EstDemo1'.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const txt = (x) => (x == null ? 'null' : x.toFixed(3));
const RAIZ3 = Math.sqrt(3);

/**
 * Valores de una hora del punto swTrafo1 por nivel. En 110 y 66 kV, la SUMA de los dos transformadores (cada uno lleva su
 * mitad, con una pequeña diferencia entre fases); en 13,8 kV, la carga propia del primero. P y Q con FP ≈ 0,95.
 */
function hora(d, h) {
  const idx = (d - 1) * 24 + h;
  const uno = 150 + 40 * Math.sin(idx / 7) + 0.3 * (idx % 5);   // A de UN transformador en 110 kV
  const I110 = { R: 2 * uno, S: 2 * uno * 1.01, T: 2 * uno * 0.99 };
  const I66 = { R: I110.R * 110 / 66 * 0.98, S: I110.S * 110 / 66 * 0.98, T: I110.T * 110 / 66 * 0.98 };
  const I13 = { R: 80 + 20 * Math.cos(idx / 5), S: 82 + 20 * Math.cos(idx / 5), T: 79 + 20 * Math.cos(idx / 5) };
  const nivel = (U, I) => {
    const S = RAIZ3 * U * ((I.R + I.S + I.T) / 3) / 1000;
    return { 'I R': I.R, 'I S': I.S, 'I T': I.T, 'U RS': U, 'U ST': U * 1.002, 'U TR': U * 0.998, P: 0.95 * S, Q: 0.312 * S };
  };
  return { '110kV': nivel(110 + 0.5 * Math.sin(idx / 11), I110), '66kV': nivel(66 + 0.3 * Math.sin(idx / 9), I66), '13.8kV': nivel(13.7 + 0.05 * Math.sin(idx / 13), I13) };
}

/** Los archivos de un mes (un CSV por día), como los arrastra el Ingeniero. */
function archivosMes(mes) {
  const [an, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(an, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= dias; d++) {
    const porHora = Array.from({ length: 24 }, (_, h) => hora(d, h));
    const lineas = [cab(d, m, an)];
    for (const nv of Object.keys(porHora[0])) for (const tok of Object.keys(porHora[0][nv])) lineas.push(filaCsv(nv, 'swTrafo1', tok, porHora.map((x) => txt(x[nv][tok]))));
    out.push({ nombre: 'x_average-' + an + pad(m) + pad(d) + '.csv', ruta: 'Mes/' + pad(d), texto: lineas.join('\n') });
  }
  return out;
}

/** Un mes por el camino REAL del importador. */
function cargarMes(mes, filas) {
  const acc = crearAcumulador();
  const obj = objetivoImportacion(filas);
  for (const a of archivosMes(mes)) acumularArchivo(acc, { nombre: a.nombre, ruta: a.ruta, texto: a.texto, tamano: a.texto.length }, obj);
  const armados = armarMeses(acc, [mes]).get(mes);
  const resumen = {}; const docs = {}; const puntos = {};
  for (const [cid, nuevo] of armados) {
    const p = procesarPuntoMes(nuevo, null, 'completar');
    resumen[cid] = p.resumen;
    const meta = acc.puntos.get(cid);
    docs[cid] = docSerie(cid, mes, meta, p.niveles);
    puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [mes] };
  }
  return { resumen, docs, puntos };
}
/** Lo guardado (desempaquetado) de un doc de serie, como lo lee la página. */
const guardadoDe = (doc) => {
  const g = { claveId: doc.claveId, mes: doc.mes, n: doc.n, niveles: {} };
  for (const [nv, x] of Object.entries(doc.niveles)) { g.niveles[nv] = { kv: x.kv, fam: {} }; for (const [f, s] of Object.entries(x.fam)) g.niveles[nv].fam[f] = desempaquetar(s); }
  return g;
};

const MAT1 = 'T1A-X/X-DM1'; const MAT2 = 'T2A-X/X-DM2';
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', MAT1, '/EstDemo1/swTrafo1'], ['DEMO UNO', MAT2, '/EstDemo1/swTrafo1']];
const base = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const [F1, F2] = Object.keys(base).sort((a, b) => base[a].orden - base[b].orden);
const CID = claveId('EstDemo1', 'swTrafo1');
const CLAVE = '/EstDemo1/swTrafo1';
const VISTOS = ['N110', 'N66', 'N13_8'];
const dec = (mapa, extra = {}) => ({ tipo: 'usar', clave: CLAVE, mapa, niveles_vistos: VISTOS, nota: 'paralelo de prueba EstDemo1', clave_excel_vista: CLAVE, avisos_vistos: [], ...extra });
const MAPA1 = { N110: 'P', N66: 'S', N13_8: 'T' }; const MAPA2 = { N110: 'P', N66: 'S' };
const MC = { N110: 2, N66: 2 };
const filasCon = (m1 = { medida_comun: MC }, m2 = { medida_comun: MC }) => ({
  [F1]: { ...base[F1], decision: dec(MAPA1, m1) }, [F2]: { ...base[F2], decision: dec(MAPA2, m2) }
});
const CON = filasCon();
const SIN = filasCon({}, {});
const txDe = (id, mat) => ({ id, identificacion: { matricula: mat }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' }, placa: { potencia_kva: 60000 },
  electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 66, tension_terciaria_kv: 13.8, corriente_nominal_primaria_a: 315, corriente_nominal_secundaria_a: 525, corriente_nominal_terciaria_a: 837 } });
const TX1 = txDe('tx1', MAT1); const TX2 = txDe('tx2', MAT2);
const A = { P: 315, S: 525, T: 837 };

const MAR = cargarMes('2026-03', CON);
const ABR = cargarMes('2026-04', CON);
const catalogo = { meses: { '2026-03': { completo: true }, '2026-04': { completo: true } }, puntos: { [CID]: { ...MAR.puntos[CID], meses: ['2026-03', '2026-04'] } } };
const resumenMes = (mes, carga) => ({ mes, claves: { ...carga.resumen } });
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, a + ' ≠ ' + b);
const cidDe = (g) => { const k = analizarClaveHomologada(claveEfectiva(g)); return k ? claveId(k.est, k.elem) : null; };
// El motivo dice lo que le corresponde a ESTE transformador en cada nivel común, en una sola frase (2026-11-06, con la parte).
const MOTIVO = 'medida común de 2 transformadores en paralelo: a este le corresponde la mitad en 110 kV y 66 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';

describe('la marca: especMedidaComun', () => {
  test('se normaliza por nivel asignado, con su devanado; sin la marca, null', () => {
    assert.deepEqual(especMedidaComun(CON[F1]), { porNivel: { N110: { nivel: 'N110', n: 2, devanado: 'P' }, N66: { nivel: 'N66', n: 2, devanado: 'S' } } });
    assert.deepEqual(especMedidaComun(CON[F2]), especMedidaComun(CON[F1]));
    assert.equal(especMedidaComun(SIN[F1]), null);
    assert.equal(especMedidaComun({ ...CON[F1], retirada: true }), null);
    assert.equal(especMedidaComun({ ...CON[F1], decision: { ...CON[F1].decision, tipo: 'no_usar' } }), null);
    assert.equal(especMedidaComun({ ...CON[F1], decision: { ...CON[F1].decision, previas: { '2026-01': { tipo: 'sin_carga', nota: 'antes sin carga' } } } }), null, 'con cambio de medida no se usa');
  });
  test('un nivel que no cumple se ignora (n fuera de 2–4, sin asignar, con suma o diferencia); los demás siguen', () => {
    const con = (mc, extra = {}) => especMedidaComun({ ...CON[F1], decision: dec(MAPA1, { medida_comun: mc, ...extra }) });
    assert.deepEqual(Object.keys(con({ N110: 5, N66: 2 }).porNivel), ['N66']);
    assert.deepEqual(Object.keys(con({ N110: '2', N66: 2.5, N13_8: 2 }).porNivel), ['N13_8']);
    assert.equal(con({ N34_5: 2 }), null, 'nivel sin devanado asignado');
    assert.deepEqual(Object.keys(con(MC, { suma: { N110: { de: ['EDM301'], barra_propia: true } } }).porNivel), ['N66']);
    assert.deepEqual(Object.keys(con(MC, { diferencia: { N66: { salidas: ['EDM601'], restar: ['swTrafo2'] } } }).porNivel), ['N110']);
    assert.equal(MEDIDA_COMUN.min, 2); assert.equal(MEDIDA_COMUN.max, 4);
  });
});

describe('resúmenes: componerResumen divide la medida común (y sin la marca es el MISMO objeto)', () => {
  const claves = MAR.resumen;
  test('sin la marca: el mismo objeto de siempre', () => {
    assert.equal(componerResumen(claves, CID, SIN[F1]), claves[CID]);
    assert.equal(componerResumen(claves, CID, SIN[F2]), claves[CID]);
  });
  test('con la marca: copia con 110 y 66 kV ÷ 2 (corrientes, sostenida, horas más altas, S) y 13,8 kV propio tal cual', () => {
    const antes = JSON.stringify(claves);
    const r = componerResumen(claves, CID, CON[F1]);
    assert.notEqual(r, claves[CID]);
    assert.equal(JSON.stringify(claves), antes, 'no modifica lo que recibe');
    for (const nv of ['N110', 'N66']) {
      const b = claves[CID][nv]; const x = r[nv];
      for (const k of ['p50', 'p95', 'p98', 'p99', 'max', 'prom']) assert.equal(x.i[k], b.i[k] / 2, nv + ' ' + k);
      assert.equal(x.sost.v, b.sost.v / 2);
      assert.equal(x.sMax, b.sMax / 2); assert.equal(x.sP99, b.sP99 / 2);
      assert.deepEqual(x.top, b.top.map((v) => v / 2));
      // Lo que NO se divide: horas, conteos, posiciones, cobertura, tensión, razón U·I/S y signo.
      for (const k of ['horas', 'servicio', 'des', 'cob', 'uProm', 'rUI', 'sP', 'flujoInverso', 'desde']) assert.equal(x[k], b[k], nv + ' ' + k);
      for (const k of ['n', 'iMax', 'unaFalta']) assert.equal(x.i[k], b.i[k], nv + ' i.' + k);
      assert.equal(x.sost.idx, b.sost.idx);
    }
    assert.equal(r.N13_8, claves[CID].N13_8, 'el nivel propio (13,8 kV) no se toca');
    // La segunda fila (sin 13,8 kV en su mapa) ve la misma mitad en los niveles comunes.
    const r2 = componerResumen(claves, CID, CON[F2]);
    assert.deepEqual(r2.N110, r.N110); assert.deepEqual(r2.N66, r.N66);
  });
  test('dividirResumenNivel: también lo de «sin meses casi sin medida» y las horas más altas en bytes; null se queda null', () => {
    const x = dividirResumenNivel({ i: { n: 10, p99: 8, max: null }, sinMesesCasi: { p99: 6, sost: 4, max: 10 }, top: Uint8Array.from([0, 0, 128, 64]) }, 2);
    assert.deepEqual(x.sinMesesCasi, { p99: 3, sost: 2, max: 5 });
    assert.equal(x.i.max, null);
    assert.deepEqual(x.top, [2]);   // 4,0 en float32 little-endian → 2
    assert.deepEqual(topsDe(x.top), Float32Array.from([2]), 'el periodo la sigue leyendo');
    assert.equal(dividirResumen(null, especMedidaComun(CON[F1])), null);
    assert.equal(dividirResumen(claves[CID], null), claves[CID]);
  });
});

describe('la lista del mes: cada transformador con su parte, provisional y con su motivo', () => {
  const homologacion = { filas: CON };
  const lista = filasLista({ parque: [TX1, TX2], homologacion, catalogo, resumenMes: resumenMes('2026-03', MAR) });
  const r = MAR.resumen[CID];
  const nivel = (x, nv) => x.niveles.find((n) => n.nivel === nv);
  test('cifra = p99 ÷ 2 ÷ ampacidad en 110 y 66 kV; 13,8 kV del primero sin dividir', () => {
    const [x1, x2] = lista;
    for (const x of [x1, x2]) {
      assert.equal(nivel(x, 'N110').pct, 100 * (r.N110.i.p99 / 2) / A.P);
      assert.equal(nivel(x, 'N66').pct, 100 * (r.N66.i.p99 / 2) / A.S);
      assert.equal(nivel(x, 'N110').etiqueta, '110 kV · medida común ÷ 2');
      assert.equal(nivel(x, 'N66').etiqueta, etiquetaMedidaComun('N66', 2));
      assert.deepEqual(nivel(x, 'N110').medidaComun, { n: 2 });
    }
    assert.equal(nivel(x1, 'N13_8').pct, 100 * r.N13_8.i.p99 / A.T);
    assert.equal(nivel(x1, 'N13_8').etiqueta, '13,8 kV');
    assert.equal('medidaComun' in nivel(x1, 'N13_8'), false);
    assert.equal(nivel(x2, 'N13_8').devanado, null, 'la segunda fila no usa el 13,8 kV');
    // La cifra del equipo: la mayor de sus devanados (~6 de cada 10 con la mitad, no ~12).
    assert.ok(x1.pct > 50 && x1.pct < 70, String(x1.pct));
    assert.equal(x2.pct, Math.max(nivel(x2, 'N110').pct, nivel(x2, 'N66').pct));
  });
  test('PROVISIONAL con el motivo a la vista; sin CLAVE_COMPARTIDA; campo medidaComun para leer la curva dividida', () => {
    for (const x of lista) {
      assert.equal(x.clase, 'provisional');
      assert.ok(x.motivos.includes(MOTIVO), x.motivos.join(' | '));
      assert.equal(x.motivos.filter((m) => m === MOTIVO).length, 1, 'una vez aunque sean dos niveles');
      assert.equal(x.avisos.includes('CLAVE_COMPARTIDA'), false);
      assert.equal(x.estado, 'confirmada');
      assert.ok(x.medidaComun && x.medidaComun.niveles.length === 2);
    }
    assert.equal(motivoMedidaComun([{ nivel: 'N66', n: 2 }, { nivel: 'N110', n: 2 }]), MOTIVO);
    assert.equal(motivoMedidaComun(especMedidaComun(CON[F1]).porNivel), MOTIVO, 'también con porNivel de especMedidaComun');
  });
  test('SIN la marca: la cifra de siempre (toda la medida contra la placa de uno) y CLAVE_COMPARTIDA bloquea', () => {
    const [y1, y2] = filasLista({ parque: [TX1, TX2], homologacion: { filas: SIN }, catalogo, resumenMes: resumenMes('2026-03', MAR) });
    assert.equal(nivel(y1, 'N110').pct, 100 * r.N110.i.p99 / A.P);
    assert.equal(nivel(y1, 'N110').etiqueta, '110 kV');
    for (const y of [y1, y2]) {
      assert.ok(y.avisos.includes('CLAVE_COMPARTIDA'));
      assert.equal(y.estado, 'pendiente');
      assert.equal('medidaComun' in y, false);
      assert.equal(y.motivos.some((m) => /medida común/.test(m)), false);
      assert.equal(nivel(y, 'N110').medidaComun, undefined);
    }
    // calcularEquipo con el resumen de siempre da lo mismo que la lista (nada nuevo sin la marca).
    const fila = { ...SIN[F1], id: F1 };
    const c = calcularEquipo({ tx: TX1, fila, punto: catalogo.puntos[CID], resumenPorNivel: MAR.resumen[CID], conteos: conteosHomologacion(SIN), umbrales: undefined, mes: '2026-03' });
    assert.equal(c.pct, y1.pct); assert.deepEqual(c.motivos, y1.motivos); assert.deepEqual(c.niveles, y1.niveles);
  });
});

describe('periodo de varios meses: dividido igual que el mes (sus horas más altas también)', () => {
  const resumenes = { '2026-03': resumenMes('2026-03', MAR), '2026-04': resumenMes('2026-04', ABR) };
  const periodo = (filas) => {
    const homologacion = { filas };
    const filasPorMes = Object.fromEntries(['2026-03', '2026-04'].map((m) => [m, filasLista({ parque: [TX1, TX2], homologacion, catalogo, resumenMes: resumenes[m] })]));
    return filasPeriodo({ parque: [TX1, TX2], homologacion, catalogo, meses: ['2026-03', '2026-04'], resumenes, filasPorMes });
  };
  const con = periodo(CON); const sin = periodo(SIN);
  const nivel = (x, nv) => x.niveles.find((n) => n.nivel === nv);
  test('la carga del periodo con la marca es la mitad de la de siempre en 110 y 66 kV; 13,8 kV igual', () => {
    for (const k of [0, 1]) {
      for (const nv of ['N110', 'N66']) cerca(nivel(con[k], nv).pct, nivel(sin[k], nv).pct / 2, 1e-3);
      assert.equal(nivel(con[k], 'N110').etiqueta, '110 kV · medida común ÷ 2');
    }
    assert.equal(nivel(con[0], 'N13_8').pct, nivel(sin[0], 'N13_8').pct);
    // El periodo de un mes da lo mismo que la lista de ese mes.
    const homologacion = { filas: CON };
    const mes = filasLista({ parque: [TX1], homologacion, catalogo, resumenMes: resumenes['2026-03'] });
    const uno = filasPeriodo({ parque: [TX1], homologacion, catalogo, meses: ['2026-03'], resumenes, filasPorMes: { '2026-03': mes } })[0];
    cerca(nivel(uno, 'N110').pct, nivel(mes[0], 'N110').pct, 1e-3);
  });
  test('provisional con su motivo (también con la firmeza por periodo) y sin CLAVE_COMPARTIDA', () => {
    for (const x of con) {
      assert.equal(x.clase, 'provisional');
      assert.ok(x.motivos.includes(MOTIVO));
      assert.equal(x.avisos.includes('CLAVE_COMPARTIDA'), false);
      assert.deepEqual(x.periodo.faltanPreparar, []);
    }
    // Sin la marca, el periodo de siempre: sin el motivo nuevo.
    for (const y of sin) assert.equal(y.motivos.some((m) => /medida común/.test(m)), false);
  });
});

describe('curvas del detalle: las familias del nivel ÷ n (P y Q también: el FP igual, S ÷ n)', () => {
  const serie = guardadoDe(MAR.docs[CID]);
  const spec = especMedidaComun(CON[F1]);
  test('dividirSerie: IR/IS/IT, P y Q ÷ 2; tensiones y códigos iguales; arreglos nuevos; lo leído no cambia', () => {
    const antes = Array.from(serie.niveles.N110.fam.IR.v);
    const d = dividirSerie(serie, spec);
    for (const nv of ['N110', 'N66']) {
      const f0 = serie.niveles[nv].fam; const f1 = d.niveles[nv].fam;
      for (const F of ['IR', 'IS', 'IT', 'P', 'Q']) {
        assert.notEqual(f1[F].v, f0[F].v);
        f0[F].v.forEach((x, h) => (Number.isNaN(x) ? assert.ok(Number.isNaN(f1[F].v[h])) : cerca(f1[F].v[h], x / 2, 1e-4)));
        assert.deepEqual(Array.from(f1[F].m), Array.from(f0[F].m));
      }
      for (const F of ['URS', 'UST', 'UTR']) { assert.deepEqual(Array.from(f1[F].v), Array.from(f0[F].v)); assert.notEqual(f1[F].v, f0[F].v); }
      // S = √(P² + Q²) sale ÷ 2 y el factor de potencia queda igual.
      const S0 = serieS(f0); const S1 = serieS(f1);
      S0.forEach((x, h) => { if (Number.isFinite(x)) cerca(S1[h], x / 2, 1e-4); });
      const fp0 = factorPotencia(f0, resumenFisico(f0, 110).s.max); const fp1 = factorPotencia(f1, resumenFisico(f1, 110).s.max);
      cerca(fp1.prom, fp0.prom, 1e-6);
    }
    assert.equal(d.niveles.N13_8, serie.niveles.N13_8, 'el nivel propio queda como vino');
    assert.deepEqual(Array.from(serie.niveles.N110.fam.IR.v), antes, 'la caché no se toca');
  });
  test('el resumen del detalle (de la curva dividida) coincide con el de la lista (componerResumen)', () => {
    const d = dividirSerie(serie, spec);
    const lista = componerResumen(MAR.resumen, CID, CON[F1]);
    for (const nv of ['N110', 'N66']) {
      const det = resumirParaGuardar(resumenFisico(d.niveles[nv].fam, nv === 'N110' ? 110 : 66), d.niveles[nv].fam);
      cerca(det.i.p99, lista[nv].i.p99, 1e-3); cerca(det.i.max, lista[nv].i.max, 1e-3); cerca(det.sost.v, lista[nv].sost.v, 1e-3);
      cerca(det.sMax, lista[nv].sMax, 1e-3); cerca(det.rUI, lista[nv].rUI, 1e-3);
    }
  });
  test('dividirFamilias: los extras (máx, mín, instantáneo) también; dividirLectura solo toca los meses leídos', () => {
    const fam = { IR: { v: Float32Array.from([10, NaN]), m: Uint8Array.from([0, 1]), b: Uint8Array.from([0, 0]), max: Float32Array.from([12, NaN]), ins: Float32Array.from([8, 9]) },
      URS: { v: Float32Array.from([110, 111]), m: Uint8Array.from([0, 0]), b: Uint8Array.from([0, 0]), min: Float32Array.from([109, 110]) } };
    const d = dividirFamilias(fam, 2);
    assert.deepEqual(Array.from(d.IR.max).slice(0, 1), [6]); assert.deepEqual(Array.from(d.IR.ins), [4, 4.5]);
    assert.deepEqual(Array.from(d.URS.min), [109, 110]);
    assert.equal(fam.IR.v[0], 10, 'no modifica lo que recibe');
    const lect = { porMes: { '2026-03': { estado: 'ok', serie }, '2026-04': { estado: 'fallo' } } };
    const dl = dividirLectura(lect, spec);
    assert.equal(dl.porMes['2026-04'], lect.porMes['2026-04']);
    cerca(dl.porMes['2026-03'].serie.niveles.N66.fam.IS.v[5], serie.niveles.N66.fam.IS.v[5] / 2, 1e-4);
    assert.equal(dividirLectura(lect, null), lect);
  });
  test('el lector de las curvas (detalle, historia y verificación de la lista) divide al leer; sin la marca, lo de siempre', () => {
    const data = readFileSync(new URL('../assets/js/data/scada_carga_suma.js', import.meta.url), 'utf8');
    assert.match(data, /if \(mc && \(!spec \|\| spec\.cid !== cid\)\) return dividirLectura\(await leerSeriesPunto\(cid, meses\), mc\);/);
    assert.match(data, /if \(!spec \|\| spec\.cid !== cid\) return leerSeriesPunto\(cid, meses\);/);
    assert.match(data, /serie: mc \? dividirSerie\(r\.serie, mc\) : r\.serie/);
    const lista = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
    assert.match(lista, /if \(x && x\.medidaComun && !x\.suma && x\.filaId/, 'la verificación de sobrecarga lee la curva dividida');
    assert.match(lista, /leerCurvaUnaVez\(x\.claveId, mes, filaConSuma\(x\), x\.filaId\)/);
    const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(det, /\(i\.medidaComun \? ' · ' \+ rotuloMedidaComun\(i\.medidaComun\) : ''\)/, 'rótulo del nivel');
    assert.match(det, /notaCurvasMedidaComun\(info\.medidaComun\) \+ '\. ' \+ alcanceCurvasMedidaComun\(info\.medidaComun\)/, 'nota bajo las curvas');
    assert.match(det, /const origenComun = !info\.suma && info\.medidaComun \? origenCsvMedidaComun\(info\.medidaComun\) : null;/);
    assert.match(det, /\.\.\.\(origenComun \? \['Origen'\] : \[\]\)\]/, 'columna Origen al final del CSV');
    assert.match(det, /\(origenComun \? '_medida-comun' : ''\)/);
    assert.equal(notaCurvasMedidaComun(2), 'medida común de los 2 transformadores en paralelo: se muestra la parte de cada uno (1/2); puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
    assert.match(origenCsvMedidaComun(2), /^IR, IS, IT, P y Q = medida común de los 2 transformadores en paralelo ÷ 2/);
  });
});

describe('al guardar: erroresMedidaComun', () => {
  const err = (d, filas = CON, id = F1) => erroresMedidaComun({ ...filas[id], id }, d, { filas, filaId: id, cidDe });
  test('la marca coherente en las dos filas se puede guardar; sin ninguna marca no hay nada que revisar', () => {
    assert.deepEqual(err(CON[F1].decision), []);
    assert.deepEqual(err(CON[F2].decision, CON, F2), []);
    assert.deepEqual(err(SIN[F1].decision, SIN), []);
    assert.deepEqual(err({ tipo: 'no_usar', clave: CLAVE, nota: 'excluida de prueba' }), []);
  });
  test('bloquea: n fuera de 2–4, nivel sin devanado, con suma o diferencia en el nivel, con medidas anteriores', () => {
    assert.match(err(dec(MAPA1, { medida_comun: { N110: 5, N66: 2 } })).join(' '), /110 kV debe ser un número entero de 2 a 4/);
    assert.match(err(dec(MAPA1, { medida_comun: { N110: 1, N66: 2 } })).join(' '), /entero de 2 a 4/);
    assert.match(err(dec(MAPA1, { medida_comun: { N110: '2', N66: 2 } })).join(' '), /entero de 2 a 4/);
    assert.match(err(dec(MAPA1, { medida_comun: { N110: 2, N66: 2, N34_5: 2 } })).join(' '), /34,5 kV tiene medida común pero no está asignado/);
    assert.match(err(dec(MAPA1, { medida_comun: MC, suma: { N110: { de: ['EDM301'], barra_propia: true } } })).join(' '), /con medida común y con suma de circuitos/);
    assert.match(err(dec(MAPA1, { medida_comun: MC, diferencia: { N66: { salidas: ['EDM601'], restar: ['swTrafo2'] } } })).join(' '), /con medida común y por diferencia de barra/);
    assert.match(err(dec(MAPA1, { medida_comun: MC, previas: { '2026-01': { tipo: 'sin_carga', nota: 'antes sin carga' } } })).join(' '), /cambio de medida/);
    assert.match(err(dec(MAPA1, { medida_comun: [2, 2] })).join(' '), /mapa por nivel/);
  });
  test('bloquea: otra fila con la misma clave sin la marca, con otro n o con otros niveles; esta sin la marca y la otra con ella', () => {
    assert.match(err(CON[F1].decision, filasCon({ medida_comun: MC }, {})).join(' '), /la fila T2A-X\/X-DM2 no declara la medida común/);
    assert.match(err(CON[F1].decision, filasCon({ medida_comun: MC }, { medida_comun: { N110: 3, N66: 3 } })).join(' '), /110 kV no coincide: esta fila dice ÷ 2 y la fila T2A-X\/X-DM2 dice ÷ 3/);
    assert.match(err(CON[F1].decision, filasCon({ medida_comun: MC }, { medida_comun: { N110: 2 } })).join(' '), /La fila T2A-X\/X-DM2 usa la misma medida y no declara la medida común de 66 kV \(÷ 2\)/);
    assert.match(err(SIN[F1].decision, filasCon({}, { medida_comun: MC })).join(' '), /esta fila no declara la medida común/);
    // Por partes las filas NO la declaran igual (0,58 y 0,42): los textos piden los mismos niveles, la misma forma y el mismo número.
    assert.match(err(CON[F1].decision, filasCon({ medida_comun: MC }, {})).join(' '), /deben declararla, en los mismos niveles y con el mismo número de transformadores\./);
    assert.match(err(dec(MAPA1, { medida_comun: { N110: 2 } }), filasCon({ medida_comun: { N110: 2 } }, { medida_comun: MC })).join(' '), /La fila T2A-X\/X-DM2 declara la medida común de 66 kV \(÷ 2\) y esta fila no: las filas en paralelo deben declararla en los mismos niveles\./);
    assert.doesNotMatch(textoMedidaComunGuardada(MC), /declararla igual/);
    assert.match(textoMedidaComunGuardada(MC), /deben declararla en los mismos niveles, de la misma forma y con el mismo número de transformadores \(por partes, entre todas suman 100 %\)\./);
  });
  test('bloquea: más filas que n con la misma medida; un nivel fuera de la marca que usan dos filas', () => {
    const tres = { ...CON, rTres: { matricula: 'T3A-X/X-DM3', subestacion: 'DEMO UNO', clave_excel: CLAVE, decision: dec(MAPA2, { medida_comun: MC }) } };
    assert.match(err(CON[F1].decision, tres).join(' '), /la comparten 3 filas y la medida común dice 2 transformadores/);
    const ambas13 = { [F1]: CON[F1], [F2]: { ...CON[F2], decision: dec(MAPA1, { medida_comun: MC }) } };
    assert.match(err(CON[F1].decision, ambas13).join(' '), /El nivel 13,8 kV lo usan esta fila y la fila T2A-X\/X-DM2 con la misma medida y sin medida común/);
    // Una fila retirada o excluida no cuenta.
    assert.deepEqual(err(CON[F1].decision, { ...tres, rTres: { ...tres.rTres, retirada: true } }), []);
  });
});

describe('homologación: CLAVE_COMPARTIDA no bloquea con la marca coherente; sin ella, como hoy', () => {
  const punto = catalogo.puntos[CID];
  const avisos = (filas, id, tx) => avisosFila(filas[id], { ...conteosHomologacion(filas), tx, punto }).avisos;
  test('con la marca coherente en las dos filas: sin el aviso', () => {
    assert.ok(conteosHomologacion(CON).clavesMedidaComun.has(CID));
    assert.equal(conteosHomologacion(CON).filasPorClave.get(CID), 2, 'el conteo sigue siendo el real');
    assert.equal(avisos(CON, F1, TX1).includes('CLAVE_COMPARTIDA'), false);
    assert.equal(avisos(CON, F2, TX2).includes('CLAVE_COMPARTIDA'), false);
  });
  test('sin la marca, con una sola fila marcada, con otro n o con más filas que n: el aviso de siempre (bloquea)', () => {
    for (const filas of [SIN, filasCon({ medida_comun: MC }, {}), filasCon({ medida_comun: MC }, { medida_comun: { N110: 3, N66: 3 } }),
      { ...CON, rTres: { matricula: 'T3A-X/X-DM3', subestacion: 'DEMO UNO', clave_excel: CLAVE, decision: dec(MAPA2, { medida_comun: MC }) } }]) {
      assert.equal(conteosHomologacion(filas).clavesMedidaComun.has(CID), false);
      assert.ok(avisos(filas, F1, TX1).includes('CLAVE_COMPARTIDA'));
    }
    assert.equal(clavesConMedidaComun(new Map()).size, 0);
    assert.equal(clavesConMedidaComun(undefined).size, 0);
  });
  test('sin bloqueos cruzados con la suma: la clave común no es «circuito de una suma ajena» y erroresSuma no tiene nada que decir', () => {
    assert.equal(claveEnSumaAjena(CLAVE, CON, F1), null);
    assert.equal(claveEnSumaAjena(CLAVE, CON, F2), null);
    assert.deepEqual(erroresSuma(CON[F1], CON[F1].decision, { filas: CON, puntos: catalogo.puntos, filaId: F1 }), []);
    assert.deepEqual(erroresSuma(CON[F2], CON[F2].decision, { filas: CON, puntos: catalogo.puntos, filaId: F2 }), []);
  });
});

describe('el diálogo «Revisar» conserva la marca (no la arma) y L-102', () => {
  const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
  test('la conserva con el mismo punto, el nivel asignado y «Medir con la medida del transformador»; la muestra; la valida', () => {
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /const mcGuardada = \(f\.decision && f\.decision\.tipo === 'usar' && f\.decision\.medida_comun && typeof f\.decision\.medida_comun === 'object'/);
    assert.match(h, /if \(mcGuardada && tipo\.value === 'usar' && \(selClave\.value \|\| null\) === \(claveEfectiva\(f\) \|\| null\)\) \{/);
    assert.match(h, /Object\.entries\(mcGuardada\)\.filter\(\(\[nv\]\) => decision\.mapa && decision\.mapa\[nv\] && medirSel\[nv\] && !medirSel\[nv\]\.disabled && medirSel\[nv\]\.value === 'medida'\)/);
    assert.match(h, /if \(Object\.keys\(mc\)\.length\) decision\.medida_comun = mc;/);
    assert.match(h, /mcGuardada \? el\('p', \{ class: 'cs-ayuda' \}, textoMedidaComunGuardada\(mcGuardada\)\) : null/);
    assert.match(h, /const erroresComun = erroresMedidaComun\(f, decision, \{ filas: ctx\.filas, filaId: f\.id, cidDe \}\);/);
    // No se arma desde el diálogo: la única escritura es la copia de lo guardado.
    assert.equal([...h.matchAll(/medida_comun\s*=(?!=)/g)].length, 1);
    assert.match(textoMedidaComunGuardada({ N66: 2, N110: 2 }), /^Medida común de transformadores en paralelo: 110 kV ÷ 2 · 66 kV ÷ 2\. /);
    assert.match(textoMedidaComunGuardada(MC), /No se arma desde aquí/);
    assert.equal(textoMedidaComunGuardada(null), '');
  });
  test('el archivo NUEVO solo importa exportaciones publicadas y no importa la homologación (ella lo importa: sin ciclo)', () => {
    const dom = src('domain/scada_carga_medida_comun.js');
    assert.deepEqual([...dom.matchAll(/^import .*$/gm)].map((m) => m[0]), [
      "import { NIVELES, FAMILIAS_I } from './scada_carga_config.js';",
      "import { EXTRAS } from './scada_carga_extras.js';",
      "import { deBytesF32 } from './scada_carga_series.js';",
      "import { esCentinela } from './scada_carga_limpieza.js';"
    ]);
    assert.match(src('domain/scada_carga_homologacion.js'), /^import \{ gruposMedidaComun \} from '\.\/scada_carga_medida_comun\.js';$/m);
    assert.match(src('domain/scada_carga_vista.js'), /^import \{ especMedidaComun, etiquetaMedidaComun, motivoMedidaComun \} from '\.\/scada_carga_medida_comun\.js';$/m);
    // Repo PÚBLICO: ningún nombre real de punto en el archivo nuevo.
    assert.doesNotMatch(dom, /\/[A-Z][a-z]+\/sw[A-Z]/);
  });
});

// ══ Revisión adversarial 2026-11-06 ══════════════════════════════════════════════════════════════════════════════

const K2 = '/EstDemo1/swTrafo2';
const INC = 'MEDIDA_COMUN_INCOMPLETA';
const TODOS = Object.keys(AVISOS);
const puntoDe = (f) => catalogo.puntos[cidDe(f)] || null;
const txDeId = (id) => (id === F1 ? TX1 : TX2);
/** Avisos y estado de una fila, con los conteos de TODAS las filas (como la página). */
const evalFila = (filas, id) => {
  const a = avisosFila(filas[id], { ...conteosHomologacion(filas), tx: txDeId(id), punto: puntoDe(filas[id]) }).avisos;
  return { avisos: a, estado: estadoEfectivo(filas[id], a) };
};
/** La fila 1 con la marca de siempre y la 2 como se pida. */
const conF2 = (d2, extra = {}) => ({ [F1]: CON[F1], [F2]: { ...base[F2], ...extra, decision: d2 } });
/** La misma homologación con los avisos_vistos de una fila reemplazados. */
const conVistos = (filas, id, vistos) => ({ ...filas, [id]: { ...filas[id], decision: { ...filas[id].decision, avisos_vistos: vistos } } });

describe('grupo que ya no cuadra: MEDIDA_COMUN_INCOMPLETA en todas sus filas vigentes, y no se puede «ver»', () => {
  test('el aviso: bloquea, no se confirma con avisos_vistos y dice el problema en texto llano', () => {
    assert.equal(AVISO_INCOMPLETA, INC);
    assert.deepEqual(AVISOS[INC], { bloquea: true, seConfirma: false, texto: 'Esta medida es común a varios transformadores en paralelo, pero el grupo ya no cuadra (falta uno, otro no tiene la marca o la tiene distinta, o las partes no suman 100 %): la parte de cada uno puede estar mal.' });
  });
  test('grupo coherente: ni este aviso ni CLAVE_COMPARTIDA; las dos «confirmada»', () => {
    const c = conteosHomologacion(CON);
    assert.equal(c.clavesMedidaComunIncompleta.size, 0);
    for (const id of [F1, F2]) {
      const e = evalFila(CON, id);
      assert.equal(e.avisos.includes(INC), false); assert.equal(e.avisos.includes('CLAVE_COMPARTIDA'), false);
      assert.equal(e.estado, 'confirmada');
    }
  });
  test('sin ninguna marca: como hoy (CLAVE_COMPARTIDA, sin el aviso nuevo)', () => {
    assert.equal(conteosHomologacion(SIN).clavesMedidaComunIncompleta.size, 0);
    for (const id of [F1, F2]) { const e = evalFila(SIN, id); assert.ok(e.avisos.includes('CLAVE_COMPARTIDA')); assert.equal(e.avisos.includes(INC), false); }
  });
  const casos = {
    'T2A excluida («no usar»)': [conF2({ tipo: 'no_usar', clave: CLAVE, nota: 'excluida de prueba', avisos_vistos: [] }), false],
    'T2A retirada (salió del Excel)': [conF2(CON[F2].decision, { retirada: true }), false],
    'T2A con otra clave (su punto propio, sin la marca)': [conF2(dec(MAPA2, { clave: K2 })), false],
    'T2A con la misma clave y sin la marca': [conF2(dec(MAPA2)), true],
    'T2A con otro n (÷ 3)': [conF2(dec(MAPA2, { medida_comun: { N110: 3, N66: 3 } })), true],
    'T2A sin la marca de 66 kV': [conF2(dec(MAPA2, { medida_comun: { N110: 2 } })), true]
  };
  for (const [nombre, [filas, f2EnElGrupo]] of Object.entries(casos)) {
    test(nombre + ' → MEDIDA_COMUN_INCOMPLETA en las filas que quedan; «pendiente» aunque CLAVE_COMPARTIDA esté vista', () => {
      assert.ok(conteosHomologacion(filas).clavesMedidaComunIncompleta.has(CID));
      assert.equal(conteosHomologacion(filas).clavesMedidaComun.has(CID), false);
      const e1 = evalFila(filas, F1);
      assert.ok(e1.avisos.includes(INC), e1.avisos.join(','));
      assert.equal(e1.estado, 'pendiente');
      // Ni con CLAVE_COMPARTIDA ni con TODOS los avisos (también el nuevo) en avisos_vistos: sigue «pendiente».
      for (const vistos of [['CLAVE_COMPARTIDA'], TODOS]) assert.equal(evalFila(conVistos(filas, F1, vistos), F1).estado, 'pendiente', vistos.join(','));
      const e2 = evalFila(filas, F2);
      assert.equal(e2.avisos.includes(INC), f2EnElGrupo, 'la otra fila: ' + e2.avisos.join(','));
      if (f2EnElGrupo) { assert.equal(e2.estado, 'pendiente'); assert.ok(e2.avisos.includes('CLAVE_COMPARTIDA')); }
    });
  }
  test('T2A en su punto propio CONSERVANDO la marca: también ella queda sola con ÷ 2 → el aviso en las dos', () => {
    const filas = conF2(dec(MAPA2, { clave: K2, medida_comun: MC }));
    assert.ok(evalFila(filas, F1).avisos.includes(INC));
    assert.ok(evalFila(filas, F2).avisos.includes(INC));
    assert.deepEqual([...conteosHomologacion(filas).clavesMedidaComunIncompleta].sort(), [CID, claveId('EstDemo1', 'swTrafo2')].sort());
  });
  test('más filas que n, y menos filas que n con la misma marca (÷ 3 en dos): el aviso en todas', () => {
    const tres = { ...CON, rTres: { matricula: 'T3A-X/X-DM3', subestacion: 'DEMO UNO', clave_excel: CLAVE, decision: dec(MAPA2, { medida_comun: MC }) } };
    for (const id of [F1, F2, 'rTres']) assert.ok(avisosFila(tres[id], { ...conteosHomologacion(tres), tx: TX1, punto: catalogo.puntos[CID] }).avisos.includes(INC), id);
    const M3 = { N110: 3, N66: 3 };
    const dosDeTres = filasCon({ medida_comun: M3 }, { medida_comun: M3 });
    assert.deepEqual(erroresMedidaComun({ ...dosDeTres[F1], id: F1 }, dosDeTres[F1].decision, { filas: dosDeTres, filaId: F1, cidDe }), [], 'al guardar no es error (la marca se escribe fila por fila)');
    for (const id of [F1, F2]) { const e = evalFila(dosDeTres, id); assert.ok(e.avisos.includes(INC)); assert.equal(e.estado, 'pendiente'); }
  });
  test('una fila retirada o excluida no lleva el aviso (no está vigente)', () => {
    const filas = conF2(dec(MAPA2));   // grupo incoherente
    for (const f1 of [{ ...filas[F1], retirada: true }, { ...filas[F1], decision: { tipo: 'no_usar', clave: CLAVE, nota: 'excluida de prueba', avisos_vistos: [] } }]) {
      const a = avisosFila(f1, { ...conteosHomologacion(filas), tx: TX1, punto: catalogo.puntos[CID] }).avisos;
      assert.equal(a.includes(INC), false);
    }
  });
  test('la lista del mes: T1A con T2A excluida sale «pendiente» con el aviso (antes: «confirmada» sin nada)', () => {
    const filas = casos['T2A excluida («no usar»)'][0];
    const [x] = filasLista({ parque: [TX1], homologacion: { filas }, catalogo, resumenMes: resumenMes('2026-03', MAR) });
    assert.ok(x.avisos.includes(INC)); assert.equal(x.estado, 'pendiente'); assert.equal(x.clase, 'provisional');
  });
  test('gruposMedidaComun: separa los que cuadran de los que no; sin marca, ninguno', () => {
    const g = (filas) => { const m = new Map(); for (const [id, f] of Object.entries(filas)) { if (f.retirada || (f.decision && f.decision.tipo === 'no_usar')) continue; const c = cidDe(f); if (!m.has(c)) m.set(c, []); m.get(c).push({ ...f, id }); } return gruposMedidaComun(m); };
    assert.deepEqual([...g(CON).coherentes], [CID]); assert.equal(g(CON).incompletas.size, 0);
    assert.equal(g(SIN).coherentes.size + g(SIN).incompletas.size, 0);
    assert.deepEqual([...g(conF2(dec(MAPA2))).incompletas], [CID]);
    assert.deepEqual(gruposMedidaComun(undefined), { coherentes: new Set(), incompletas: new Set() });
  });
  test('estadoEfectivo: los demás avisos se siguen confirmando como siempre', () => {
    const f = { ...CON[F1], decision: { ...CON[F1].decision, avisos_vistos: ['CLAVE_COMPARTIDA'] } };
    assert.equal(estadoEfectivo(f, ['CLAVE_COMPARTIDA']), 'confirmada');
    assert.equal(estadoEfectivo({ ...f, decision: { ...f.decision, avisos_vistos: [INC] } }, [INC]), 'pendiente');
    assert.equal(estadoEfectivo({ ...base[F1] }, [INC]), 'pendiente', 'sin decisión: bloquea');
  });
});

describe('orden de escritura y avisos_vistos: el estado intermedio sale pendiente y el final limpio', () => {
  // Hoy: T1A mide con swTrafo1 sin la marca; T2A con su punto propio. Se escriben las dos marcas, una tras otra, con los
  // avisos_vistos que arma el diálogo: ev0 ∪ evD (los dos con los conteos de ANTES de guardar, como siempre), sin los que no
  // se pueden ver. (Así escribe Claude; el diálogo no deja guardar una fila de un grupo incoherente: aquí se escribe directo.)
  // `filtro: false` = el diálogo publicado (sin el filtro); `despues: true` = la variante descartada (evD con los conteos de
  // DESPUÉS de guardar), solo como control.
  const HOY = { [F1]: { ...base[F1], decision: dec(MAPA1) }, [F2]: { ...base[F2], decision: dec(MAPA2, { clave: K2 }) } };
  const D1 = dec(MAPA1, { medida_comun: MC }); const D2 = dec(MAPA2, { medida_comun: MC });
  const bloqueantes = (av) => av.filter((a) => AVISOS[a] && AVISOS[a].bloquea);
  const ctxDe = (fs, id) => ({ ...conteosHomologacion(fs), tx: txDeId(id), punto: puntoDe(fs[id]) });
  function escribir(filas, id, decision, { filtro = true, despues = false } = {}) {
    const ev0 = avisosFila(filas[id], ctxDe(filas, id)).avisos;
    const tras = { ...filas, [id]: { ...filas[id], decision } };
    const evD = avisosFila(tras[id], ctxDe(despues ? tras : filas, id)).avisos;
    const bloq = [...new Set(bloqueantes([...ev0, ...evD]))].filter((x) => x !== 'NIVEL_NO_REVISADO');
    return { ...filas, [id]: { ...filas[id], decision: { ...decision, avisos_vistos: filtro ? avisosQueSePuedenVer(bloq, decision) : bloq } } };
  }
  const limpio = (filas) => {
    for (const id of [F1, F2]) {
      const e = evalFila(filas, id);
      assert.equal(e.avisos.includes(INC), false, id); assert.equal(e.avisos.includes('CLAVE_COMPARTIDA'), false, id);
      assert.equal(e.estado, 'confirmada', id);
      assert.equal(filas[id].decision.avisos_vistos.includes('CLAVE_COMPARTIDA'), false, id + ' sin CLAVE_COMPARTIDA vista');
      assert.equal(filas[id].decision.avisos_vistos.includes(INC), false);
    }
  };
  test('T1A → T2A: T1A sola con ÷ 2 queda «pendiente» con el aviso; con las dos, limpio', () => {
    const s1 = escribir(HOY, F1, D1);
    const e1 = evalFila(s1, F1);
    assert.ok(e1.avisos.includes(INC)); assert.equal(e1.estado, 'pendiente');
    assert.equal(s1[F1].decision.avisos_vistos.includes(INC), false, 'el aviso no entra a avisos_vistos');
    limpio(escribir(s1, F2, D2));
  });
  test('T2A → T1A: las dos «pendiente» en el intermedio (aunque T1A trajera CLAVE_COMPARTIDA vista); con las dos, limpio', () => {
    const t1 = escribir(HOY, F2, D2);
    for (const id of [F1, F2]) { const e = evalFila(t1, id); assert.ok(e.avisos.includes(INC)); assert.ok(e.avisos.includes('CLAVE_COMPARTIDA')); assert.equal(e.estado, 'pendiente'); }
    assert.equal(evalFila(conVistos(t1, F1, ['CLAVE_COMPARTIDA']), F1).estado, 'pendiente');
    assert.deepEqual(t1[F2].decision.avisos_vistos, [], 'con la marca, ni CLAVE_COMPARTIDA ni el aviso nuevo quedan vistos');
    limpio(escribir(t1, F1, D1));
    // Lo que pasaba antes del arreglo (sin el filtro): T1A quedaba con CLAVE_COMPARTIDA vista para siempre.
    const viejo = escribir(t1, F1, D1, { filtro: false });
    assert.ok(viejo[F1].decision.avisos_vistos.includes('CLAVE_COMPARTIDA'));
  });
  test('con la marca, los conteos de antes o de después dan lo mismo (intermedios, finales, ÷ 3 posterior)', () => {
    const pasos = (opc) => {
      const a1 = escribir(HOY, F1, D1, opc); const a2 = escribir(a1, F2, D2, opc);
      const b1 = escribir(HOY, F2, D2, opc); const b2 = escribir(b1, F1, D1, opc);
      const x3 = escribir(b2, F2, dec(MAPA2, { medida_comun: { N110: 3, N66: 3 } }), opc);
      return [a1, a2, b1, b2, x3].map((fs) => [F1, F2].map((id) => [fs[id].decision.avisos_vistos, evalFila(fs, id).estado]));
    };
    assert.deepEqual(pasos({}), pasos({ despues: true }));
  });
  // Sin la marca, el diálogo deja vistos los mismos avisos que el publicado: uno que no salió en pantalla (ev0) no se apaga.
  const S = {
    'S1 · T2A (sola en su punto) pasa al punto que ya usa T1A': [{ [F1]: { ...base[F1], decision: dec(MAPA1) }, [F2]: { ...base[F2], decision: dec(MAPA2, { clave: K2 }) } },
      F2, dec(MAPA2), 'CLAVE_COMPARTIDA'],
    'S2 · T2A excluida en el punto de T1A vuelve a «usar»': [{ [F1]: { ...base[F1], decision: dec(MAPA1) }, [F2]: { ...base[F2], decision: { tipo: 'no_usar', clave: CLAVE, nota: 'excluida de prueba', avisos_vistos: [] } } },
      F2, dec(MAPA2), 'CLAVE_COMPARTIDA'],
    'S3 · una fila excluida con la matrícula de T1A vuelve a «usar» en otro punto': [{ [F1]: { ...base[F1], decision: dec(MAPA1) }, [F2]: { ...base[F2], matricula: MAT1, decision: { tipo: 'no_usar', clave: K2, nota: 'excluida de prueba', avisos_vistos: [] } } },
      F2, dec(MAPA2, { clave: K2 }), 'MATRICULA_REPETIDA']
  };
  for (const [nombre, [filas, id, d, aviso]] of Object.entries(S)) {
    test('sin la marca, como hoy: ' + nombre + ' → ' + aviso + ' no queda «visto» y la fila sigue «pendiente»', () => {
      assert.deepEqual(bloqueantes(avisosFila(filas[id], ctxDe(filas, id)).avisos).filter((x) => x !== 'NIVEL_NO_REVISADO'), [], 'el diálogo no lo mostró');
      assert.deepEqual(erroresMedidaComun({ ...filas[id], id }, d, { filas, filaId: id, cidDe }), [], 'se deja guardar');
      const hoy = escribir(filas, id, d);
      assert.deepEqual(hoy[id].decision.avisos_vistos, escribir(filas, id, d, { filtro: false })[id].decision.avisos_vistos, 'lo mismo que el diálogo publicado');
      assert.equal(hoy[id].decision.avisos_vistos.includes(aviso), false);
      const e = evalFila(hoy, id); assert.ok(e.avisos.includes(aviso)); assert.equal(e.estado, 'pendiente');
      // Control: con los conteos de DESPUÉS, la fila quedaba «confirmada» con un aviso que nunca vio.
      const ctl = escribir(filas, id, d, { despues: true });
      assert.ok(ctl[id].decision.avisos_vistos.includes(aviso)); assert.equal(evalFila(ctl, id).estado, 'confirmada');
    });
  }
  test('avisosQueSePuedenVer: el aviso nuevo nunca; CLAVE_COMPARTIDA solo sin la marca; lo demás igual; no modifica', () => {
    const lista = ['CLAVE_COMPARTIDA', INC, 'RELACION_NIVELES'];
    assert.deepEqual(avisosQueSePuedenVer(lista, D1), ['RELACION_NIVELES']);
    assert.deepEqual(avisosQueSePuedenVer(lista, dec(MAPA1)), ['CLAVE_COMPARTIDA', 'RELACION_NIVELES']);
    assert.deepEqual(avisosQueSePuedenVer(lista, { tipo: 'no_usar', nota: 'x' }), ['CLAVE_COMPARTIDA', 'RELACION_NIVELES']);
    assert.deepEqual(lista, ['CLAVE_COMPARTIDA', INC, 'RELACION_NIVELES']);
    assert.deepEqual(avisosQueSePuedenVer(undefined, D1), []);
  });
  test('el diálogo: conteos de ANTES de guardar (como siempre), sin los avisos que no se pueden ver (prueba de fuente)', () => {
    const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
    assert.match(h, /const evD = evaluar\(f, ctx, decision\);/);
    assert.doesNotMatch(h, /filasDespues/);
    assert.match(h, /decision\.avisos_vistos = avisosQueSePuedenVer\(\[\.\.\.bloq\]\.filter\(\(x\) => x !== 'NIVEL_NO_REVISADO'\), decision\);/);
    assert.equal([...h.matchAll(/avisos_vistos\s*=(?!=)/g)].length, 1, 'ninguna otra escritura de avisos_vistos');
    assert.match(h, /^import \{ erroresMedidaComun, textoMedidaComunGuardada, avisosQueSePuedenVer, repartoMedidaComun, copiaMedidaComun, porcentajeParte, fraccionMedidaComun \} from '\.\.\/\.\.\/domain\/scada_carga_medida_comun\.js';$/m);
  });
});

describe('topes del sistema: no se dividen (siguen reconociéndose y ocultos)', () => {
  const N = 24;
  const familia = (normal, extra, c) => {
    const v = Array(N).fill(normal); v[3] = c;
    const e = Array(N).fill(extra); e[5] = c;
    return { v: Float32Array.from(v), m: new Uint8Array(N), b: new Uint8Array(N), max: Float32Array.from(e), min: Float32Array.from(e), ins: Float32Array.from(e) };
  };
  test('la lista de topes es la del limpiador (32767 y 160,74801636 incluidos) y esCentinela los reconoce en float32', () => {
    assert.ok(CENTINELAS.includes(32767)); assert.ok(CENTINELAS.includes(160.74801636)); assert.ok(CENTINELAS.includes(32.767));
    for (const c of CENTINELAS) assert.ok(esCentinela(Math.fround(c)), String(c));
  });
  for (const c of CENTINELAS) {
    test('tope ' + c + ': el valor y sus extras quedan tal cual; lo normal ÷ 2; extrasVisibles lo sigue ocultando', () => {
      const fam = { IR: familia(320, 330, c), IS: familia(320, 330, c), IT: familia(320, 330, c), P: familia(55, 57, c), URS: familia(110, 111, c) };
      const d = dividirFamilias(fam, 2);
      for (const F of ['IR', 'P']) {
        assert.equal(d[F].v[3], fam[F].v[3], F + ' valor');
        for (const k of ['max', 'min', 'ins']) { assert.equal(d[F][k][5], fam[F][k][5], F + ' ' + k); assert.equal(d[F][k][0], fam[F][k][0] / 2, F + ' ' + k + ' normal'); }
        assert.equal(d[F].v[0], fam[F].v[0] / 2);
      }
      assert.equal(d.URS.v[0], 110, 'la tensión no se divide');
      const vis = extrasVisibles(d, 110, 315);
      for (const F of ['IR', 'P']) for (const k of ['max', 'min', 'ins']) {
        const x = vis.series[F][k];
        assert.ok(!x || Number.isNaN(x[5]), F + ' ' + k + ' hora 5 se vería: ' + (x && x[5]));
      }
    });
  }
  test('los que antes se veían tras dividir (32,767 y 160,748) ahora siguen ocultos', () => {
    for (const c of [32.767, 160.74801636]) {
      const fam = { IR: familia(320, 330, c), P: familia(55, 57, c) };
      const vis = extrasVisibles(dividirFamilias(fam, 2), 110, 315);
      assert.ok(!vis.series.IR.max || Number.isNaN(vis.series.IR.max[5]));
      assert.ok(!vis.series.P.max || Number.isNaN(vis.series.P.max[5]));
      // Control: dividido «a mano» (lo de antes) sí se veía en la corriente.
      const aMano = { ...fam.IR, max: Float32Array.from(fam.IR.max, (x) => x / 2) };
      const visMano = extrasVisibles({ IR: aMano }, 110, 315);
      assert.ok(Number.isFinite(visMano.series.IR.max[5]), 'el control debe verse');
    }
  });
});

describe('banda muerta / fases sin carga junto con medida común: no se guarda y ese nivel no se divide', () => {
  const err = (d, filas = CON, id = F1) => erroresMedidaComun({ ...filas[id], id }, d, { filas, filaId: id, cidDe });
  test('al guardar: error claro en esta fila y en otra del grupo; en un nivel propio (fuera de la marca), nada', () => {
    assert.match(err(dec(MAPA1, { medida_comun: MC, banda_muerta: { N66: 24 } })).join(' '), /Banda muerta \/ fases sin carga junto con medida común en 66 kV \(esta fila\): todavía no está resuelto\./);
    assert.match(err(dec(MAPA1, { medida_comun: MC, fases_sin_carga: { N110: 'IS' } })).join(' '), /Banda muerta \/ fases sin carga junto con medida común en 110 kV \(esta fila\): todavía no está resuelto\./);
    const hermana = conF2(dec(MAPA2, { medida_comun: MC, banda_muerta: { N110: 20 } }));
    assert.match(err(CON[F1].decision, hermana).join(' '), /Banda muerta \/ fases sin carga junto con medida común en 110 kV \(la fila T2A-X\/X-DM2\): todavía no está resuelto\./);
    assert.deepEqual(err(dec(MAPA1, { medida_comun: MC, banda_muerta: { N13_8: 5 } })), [], 'el 13,8 kV es propio: su banda muerta no choca');
  });
  test('especMedidaComun ignora el nivel con banda muerta (no lo divide); la fase sin carga no cambia la división', () => {
    assert.deepEqual(Object.keys(especMedidaComun({ ...CON[F1], decision: dec(MAPA1, { medida_comun: MC, banda_muerta: { N66: 24 } }) }).porNivel), ['N110']);
    assert.deepEqual(Object.keys(especMedidaComun({ ...CON[F1], decision: dec(MAPA1, { medida_comun: MC, fases_sin_carga: { N66: 'IS' } }) }).porNivel), ['N110', 'N66']);
  });
  test('una combinación vieja (las dos con banda muerta en 66 kV): 66 kV sin dividir, el escalón bien calculado y el grupo pendiente', () => {
    const bm = { banda_muerta: { N66: 24 } };
    const filas = filasCon({ medida_comun: MC, ...bm }, { medida_comun: MC, ...bm });
    const r = MAR.resumen[CID];
    for (const x of filasLista({ parque: [TX1, TX2], homologacion: { filas }, catalogo, resumenMes: resumenMes('2026-03', MAR) })) {
      const n66 = x.niveles.find((n) => n.nivel === 'N66'); const n110 = x.niveles.find((n) => n.nivel === 'N110');
      assert.equal(n66.pct, 100 * r.N66.i.p99 / A.S, '66 kV sin dividir');
      assert.equal(n66.etiqueta, '66 kV'); assert.equal(n66.medidaComun, undefined);
      cerca(n66.bandaMuertaPct, 100 * 24 / A.S, 1e-9);
      assert.equal(n110.pct, 100 * (r.N110.i.p99 / 2) / A.P, '110 kV sigue ÷ 2');
      assert.ok(x.avisos.includes(INC)); assert.ok(x.avisos.includes('CLAVE_COMPARTIDA')); assert.equal(x.estado, 'pendiente');
    }
  });
});

describe('textos: el motivo, la nota bajo las curvas y la salida del diálogo', () => {
  test('motivo provisional y nota bajo las curvas', () => {
    assert.equal(motivoMedidaComun([{ nivel: 'N110', n: 3 }]), 'medida común de 3 transformadores en paralelo: a este le corresponde un tercio en 110 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
    assert.equal(motivoMedidaComun([{ nivel: 'N66', n: 4 }]), 'medida común de 4 transformadores en paralelo: a este le corresponde la cuarta parte en 66 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
    assert.equal(notaCurvasMedidaComun(3), 'medida común de los 3 transformadores en paralelo: se muestra la parte de cada uno (1/3); puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
  });
  test('motivo con tres niveles: una sola «y» por lista y siempre de mayor a menor tensión (solo se juntan niveles vecinos)', () => {
    const cola = '; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';
    assert.equal(motivoMedidaComun([{ nivel: 'N13_8', n: 2 }, { nivel: 'N110', n: 2 }, { nivel: 'N34_5', n: 2 }]),
      'medida común de 2 transformadores en paralelo: a este le corresponde la mitad en 110 kV, 34,5 kV y 13,8 kV' + cola);
    assert.equal(motivoMedidaComun([{ nivel: 'N110', n: 2 }, { nivel: 'N66', n: 2, parte: 0.58 }, { nivel: 'N13_8', n: 2 }]),
      'medida común de 2 transformadores en paralelo: a este le corresponde la mitad en 110 kV, el 58 % en 66 kV y la mitad en 13,8 kV' + cola);
    assert.equal(motivoMedidaComun([{ nivel: 'N110', n: 2, parte: 0.58 }, { nivel: 'N66', n: 2, parte: 0.58 }, { nivel: 'N13_8', n: 2 }]),
      'medida común de 2 transformadores en paralelo: a este le corresponde el 58 % en 110 kV y 66 kV y la mitad en 13,8 kV' + cola);
    assert.equal(fraccionMedidaComun(2), 'la mitad'); assert.equal(fraccionMedidaComun(3), 'un tercio'); assert.equal(fraccionMedidaComun(4), 'la cuarta parte');
  });
  test('la fila «Medida común» del detalle no repite el rótulo en el valor', () => {
    assert.equal(textoDetalleMedidaComun(2), 'Se muestra la parte de cada uno de los 2 transformadores en paralelo (1/2): se dividen las corrientes, P y Q; la tensión no. Puede ir más cargado si circula corriente entre ellos o si otro sale de servicio · cifra provisional');
    assert.doesNotMatch(textoDetalleMedidaComun(3), /^medida común/i);
    const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(det, /info\.medidaComun \? fila\('Medida común', textoDetalleMedidaComun\(info\.medidaComun\)\) : null/);
  });
  test('el error del diálogo al tocar un nivel común en una sola fila dice la salida (prueba de fuente)', () => {
    const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
    assert.match(h, /if \(erroresComun\.length\) \{ msg\.textContent = erroresComun\.join\(' '\) \+ ' La marca de medida común la ajusta Claude; para quitarla use «Reabrir»\.'; return; \}/);
    assert.doesNotMatch(h, /[“”]/, 'comillas «» como el resto del diálogo');
    // El error que se le pega: tocar 110 kV en T1A deja la marca solo en 66 kV y choca con la de T2A.
    const e = erroresMedidaComun({ ...CON[F1], id: F1 }, dec(MAPA1, { medida_comun: { N66: 2 } }), { filas: CON, filaId: F1, cidDe });
    assert.match(e.join(' '), /La fila T2A-X\/X-DM2 declara la medida común de 110 kV \(÷ 2\) y esta fila no/);
  });
});

// ══ Medida común POR PARTES (criterio del Ingeniero 2026-11-06) ═══════════════════════════════════════════════════
// Dos transformadores en paralelo en 110 y 66 kV con la misma medida; el 66 kV se reparte por mitades y el 13,8 kV es solo
// del primero, así que en el 110 kV común al primero le toca su mitad del 66 kV más todo el 13,8 kV (≈ 58 %) y al segundo
// el resto (≈ 42 %). La marca: `{ N110: { parte, de: 2 }, N66: 2 }`, con la parte de cada uno.
describe('medida común por partes: { parte, de } junto al entero', () => {
  const P1 = { N110: { parte: 0.58, de: 2 }, N66: 2 }; const P2 = { N110: { parte: 0.42, de: 2 }, N66: 2 };
  const PARTES = filasCon({ medida_comun: P1 }, { medida_comun: P2 });
  const r = MAR.resumen[CID];
  const nivel = (x, nv) => x.niveles.find((n) => n.nivel === nv);
  const MOTIVO1 = 'medida común de 2 transformadores en paralelo: a este le corresponde el 58 % en 110 kV y la mitad en 66 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';
  const MOTIVO2 = 'medida común de 2 transformadores en paralelo: a este le corresponde el 42 % en 110 kV y la mitad en 66 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';
  const err = (d, filas = PARTES, id = F1) => erroresMedidaComun({ ...filas[id], id }, d, { filas, filaId: id, cidDe });
  const conMarcas = (m1, m2) => filasCon({ medida_comun: m1 }, { medida_comun: m2 });

  test('repartoMedidaComun: el entero (÷ n) y la parte; lo demás, null', () => {
    assert.deepEqual(repartoMedidaComun(2), { n: 2, parte: null });
    assert.deepEqual(repartoMedidaComun({ parte: 0.58, de: 2 }), { n: 2, parte: 0.58 });
    assert.deepEqual(repartoMedidaComun({ parte: 0.333, de: 3 }), { n: 3, parte: 0.333 });
    for (const v of [{ parte: 1.2, de: 2 }, { parte: 0, de: 2 }, { parte: 1, de: 2 }, { parte: '0.5', de: 2 }, { parte: 0.5555, de: 2 }, { parte: 0.5 }, { parte: 0.5, de: 5 },
      { parte: 0.5, de: 1 }, { parte: NaN, de: 2 }, { parte: Infinity, de: 2 }, '2', 2.5, 5, [0.5, 2], null]) assert.equal(repartoMedidaComun(v), null, JSON.stringify(v));
  });
  test('especMedidaComun: la parte en su nivel, el entero en el otro; una parte que no vale se ignora (ese nivel no se toca)', () => {
    assert.deepEqual(especMedidaComun(PARTES[F1]), { porNivel: { N110: { nivel: 'N110', n: 2, devanado: 'P', parte: 0.58 }, N66: { nivel: 'N66', n: 2, devanado: 'S' } } });
    assert.deepEqual(especMedidaComun(PARTES[F2]).porNivel.N110, { nivel: 'N110', n: 2, devanado: 'P', parte: 0.42 });
    assert.deepEqual(Object.keys(especMedidaComun({ ...PARTES[F1], decision: dec(MAPA1, { medida_comun: { N110: { parte: 1.2, de: 2 }, N66: 2 } }) }).porNivel), ['N66']);
  });
  test('el grupo cuadra: sin CLAVE_COMPARTIDA ni MEDIDA_COMUN_INCOMPLETA; se deja guardar', () => {
    const c = conteosHomologacion(PARTES);
    assert.ok(c.clavesMedidaComun.has(CID)); assert.equal(c.clavesMedidaComunIncompleta.size, 0);
    for (const id of [F1, F2]) {
      const e = evalFila(PARTES, id);
      assert.equal(e.avisos.includes('CLAVE_COMPARTIDA'), false); assert.equal(e.avisos.includes(INC), false);
      assert.equal(e.estado, 'confirmada');
    }
    assert.deepEqual(err(PARTES[F1].decision), []);
    assert.deepEqual(err(PARTES[F2].decision, PARTES, F2), []);
  });

  describe('la lista del mes', () => {
    const [x1, x2] = filasLista({ parque: [TX1, TX2], homologacion: { filas: PARTES }, catalogo, resumenMes: resumenMes('2026-03', MAR) });
    test('110 kV: T1A = 0,58 × p99 común ÷ A, T2A = 0,42 × …; 66 kV por mitades; 13,8 kV del T1A entero', () => {
      cerca(nivel(x1, 'N110').pct, 100 * 0.58 * r.N110.i.p99 / A.P, 1e-9);
      cerca(nivel(x2, 'N110').pct, 100 * 0.42 * r.N110.i.p99 / A.P, 1e-9);
      for (const x of [x1, x2]) assert.equal(nivel(x, 'N66').pct, 100 * (r.N66.i.p99 / 2) / A.S);
      assert.equal(nivel(x1, 'N13_8').pct, 100 * r.N13_8.i.p99 / A.T);
      assert.equal(nivel(x2, 'N13_8').devanado, null);
      // Las dos partes del 110 kV suman la medida común completa.
      cerca(nivel(x1, 'N110').pct + nivel(x2, 'N110').pct, 100 * r.N110.i.p99 / A.P, 1e-9);
      assert.equal(x1.pct, Math.max(...x1.niveles.filter((n) => n.pct != null).map((n) => n.pct)));
    });
    test('rótulos: «58 % de la medida común» y «medida común ÷ 2»; el nivel lleva su parte', () => {
      assert.equal(nivel(x1, 'N110').etiqueta, '110 kV · 58 % de la medida común');
      assert.equal(nivel(x2, 'N110').etiqueta, '110 kV · 42 % de la medida común');
      assert.equal(nivel(x1, 'N66').etiqueta, '66 kV · medida común ÷ 2');
      assert.deepEqual(nivel(x1, 'N110').medidaComun, { n: 2, parte: 0.58 });
      assert.deepEqual(nivel(x1, 'N66').medidaComun, { n: 2 });
      assert.equal(nivel(x1, 'N13_8').etiqueta, '13,8 kV');
      assert.deepEqual(x1.medidaComun.niveles.map((n) => [n.nivel, n.n, n.parte]), [['N110', 2, 0.58], ['N66', 2, undefined]]);
    });
    test('PROVISIONAL con el motivo exacto, una sola frase con los dos niveles', () => {
      assert.equal(x1.clase, 'provisional'); assert.equal(x2.clase, 'provisional');
      assert.ok(x1.motivos.includes(MOTIVO1), x1.motivos.join(' | '));
      assert.ok(x2.motivos.includes(MOTIVO2), x2.motivos.join(' | '));
      for (const x of [x1, x2]) assert.equal(x.motivos.filter((m) => /medida común/.test(m)).length, 1);
      assert.equal(motivoMedidaComun(especMedidaComun(PARTES[F1]).porNivel), MOTIVO1);
    });
  });

  test('periodo de varios meses: igual que el mes (110 kV × parte, 66 kV ÷ 2, 13,8 kV entero), con el mismo motivo', () => {
    const resumenes = { '2026-03': resumenMes('2026-03', MAR), '2026-04': resumenMes('2026-04', ABR) };
    const periodo = (filas) => {
      const homologacion = { filas };
      const filasPorMes = Object.fromEntries(['2026-03', '2026-04'].map((m) => [m, filasLista({ parque: [TX1, TX2], homologacion, catalogo, resumenMes: resumenes[m] })]));
      return filasPeriodo({ parque: [TX1, TX2], homologacion, catalogo, meses: ['2026-03', '2026-04'], resumenes, filasPorMes });
    };
    const con = periodo(PARTES); const sin = periodo(SIN);
    cerca(nivel(con[0], 'N110').pct, 0.58 * nivel(sin[0], 'N110').pct, 1e-3);
    cerca(nivel(con[1], 'N110').pct, 0.42 * nivel(sin[1], 'N110').pct, 1e-3);
    for (const k of [0, 1]) cerca(nivel(con[k], 'N66').pct, nivel(sin[k], 'N66').pct / 2, 1e-3);
    assert.equal(nivel(con[0], 'N13_8').pct, nivel(sin[0], 'N13_8').pct);
    assert.equal(nivel(con[0], 'N110').etiqueta, '110 kV · 58 % de la medida común');
    assert.ok(con[0].motivos.includes(MOTIVO1)); assert.ok(con[1].motivos.includes(MOTIVO2));
    for (const x of con) { assert.equal(x.clase, 'provisional'); assert.equal(x.avisos.includes('CLAVE_COMPARTIDA'), false); assert.equal(x.avisos.includes(INC), false); }
  });

  test('curvas: 110 kV × 0,58 (IR/IS/IT, sus extras, P y Q; el FP igual), 66 kV ÷ 2, tensiones y 13,8 kV tal cual; coincide con la lista', () => {
    const serie = guardadoDe(MAR.docs[CID]);
    const spec = especMedidaComun(PARTES[F1]);
    const d = dividirSerie(serie, spec);
    const f0 = serie.niveles.N110.fam; const f1 = d.niveles.N110.fam;
    for (const F of ['IR', 'IS', 'IT', 'P', 'Q']) f0[F].v.forEach((x, h) => (Number.isNaN(x) ? assert.ok(Number.isNaN(f1[F].v[h])) : cerca(f1[F].v[h], Math.fround(x * 0.58), 1e-4)));
    for (const F of ['URS', 'UST', 'UTR']) assert.deepEqual(Array.from(f1[F].v), Array.from(f0[F].v));
    const S0 = serieS(f0); const S1 = serieS(f1);
    S0.forEach((x, h) => { if (Number.isFinite(x)) cerca(S1[h], 0.58 * x, 1e-3); });
    cerca(factorPotencia(f1, resumenFisico(f1, 110).s.max).prom, factorPotencia(f0, resumenFisico(f0, 110).s.max).prom, 1e-6);
    serie.niveles.N66.fam.IR.v.forEach((x, h) => { if (!Number.isNaN(x)) cerca(d.niveles.N66.fam.IR.v[h], x / 2, 1e-4); });
    assert.equal(d.niveles.N13_8, serie.niveles.N13_8);
    const lista = componerResumen(MAR.resumen, CID, PARTES[F1]);
    for (const [nv, kv] of [['N110', 110], ['N66', 66]]) {
      const det = resumirParaGuardar(resumenFisico(d.niveles[nv].fam, kv), d.niveles[nv].fam);
      cerca(det.i.p99, lista[nv].i.p99, 1e-3); cerca(det.i.max, lista[nv].i.max, 1e-3); cerca(det.sMax, lista[nv].sMax, 1e-3); cerca(det.rUI, lista[nv].rUI, 1e-3);
    }
    // Extras y topes del sistema con la parte: los extras × 0,58; un tope queda tal cual.
    const fam = { IR: { v: Float32Array.from([100, 32767]), m: new Uint8Array(2), b: new Uint8Array(2), max: Float32Array.from([120, 32767]) } };
    const dd = dividirFamilias(fam, { parte: 0.58, de: 2 });
    cerca(dd.IR.v[0], 58, 1e-4); cerca(dd.IR.max[0], 69.6, 1e-4); assert.equal(dd.IR.v[1], 32767); assert.equal(dd.IR.max[1], 32767);
    // El resumen de un nivel con la parte: también las horas más altas; lo que no es corriente ni potencia, igual.
    const rn = dividirResumenNivel(r.N110, { parte: 0.58, de: 2 });
    cerca(rn.i.p99, 0.58 * r.N110.i.p99, 1e-9); cerca(rn.sost.v, 0.58 * r.N110.sost.v, 1e-9); cerca(rn.sMax, 0.58 * r.N110.sMax, 1e-9);
    rn.top.forEach((x, k) => cerca(x, 0.58 * r.N110.top[k], 1e-9));
    for (const k of ['horas', 'cob', 'uProm', 'rUI']) assert.equal(rn[k], r.N110[k]);
  });

  test('grupo que no cuadra → MEDIDA_COMUN_INCOMPLETA y error al guardar: suma 0,58 + 0,40, mezcla entero/parte, otro «de»', () => {
    const casos = [
      [conMarcas(P1, { N110: { parte: 0.40, de: 2 }, N66: 2 }), /Las partes de la medida común de 110 kV suman 98 % \(esta fila 58 % \+ la fila T2A-X\/X-DM2 40 %\): entre los 2 transformadores deben sumar 100 %\./],
      [conMarcas(P1, { N110: 2, N66: 2 }), /La medida común de 110 kV no coincide: esta fila la reparte por partes y la fila T2A-X\/X-DM2 la divide en partes iguales \(÷ 2\): todas las filas deben declararla de la misma forma\./],
      [conMarcas(P1, { N110: { parte: 0.5, de: 2 }, N66: { parte: 0.5, de: 2 } }), /La medida común de 66 kV no coincide: esta fila la divide en partes iguales \(÷ 2\) y la fila T2A-X\/X-DM2 la reparte por partes/],
      [conMarcas(P1, { N110: { parte: 0.42, de: 3 }, N66: 2 }), /La medida común de 110 kV no coincide: esta fila dice que la comparten 2 transformadores y la fila T2A-X\/X-DM2 dice 3\./]
    ];
    for (const [filas, msg] of casos) {
      const c = conteosHomologacion(filas);
      assert.ok(c.clavesMedidaComunIncompleta.has(CID)); assert.equal(c.clavesMedidaComun.has(CID), false);
      for (const id of [F1, F2]) { const e = evalFila(filas, id); assert.ok(e.avisos.includes(INC), id); assert.equal(e.estado, 'pendiente'); }
      assert.match(err(filas[F1].decision, filas).join(' '), msg);
    }
    // Las partes de dos filas de un grupo de 3 que ya pasan de 100 %: error aunque falte la tercera.
    const dosDeTres = conMarcas({ N110: { parte: 0.58, de: 3 }, N66: 3 }, { N110: { parte: 0.58, de: 3 }, N66: 3 });
    assert.match(err(dosDeTres[F1].decision, dosDeTres).join(' '), /ya suman 116 % \(esta fila 58 % \+ la fila T2A-X\/X-DM2 58 %\) y todavía falta un transformador/);
    // Dos de tres que no pasan de 100 %: se deja guardar (la marca se escribe fila por fila), pero el grupo no cuadra.
    const parcial = conMarcas({ N110: { parte: 0.4, de: 3 }, N66: 3 }, { N110: { parte: 0.3, de: 3 }, N66: 3 });
    assert.deepEqual(err(parcial[F1].decision, parcial), []);
    assert.ok(conteosHomologacion(parcial).clavesMedidaComunIncompleta.has(CID));
  });

  test('la suma se acepta entre 99 % y 101 % (con los decimales del computador); fuera, no', () => {
    for (const [a, b, ok] of [[0.58, 0.42, true], [0.5, 0.51, true], [0.5, 0.49, true], [0.495, 0.495, true], [0.5, 0.52, false], [0.5, 0.48, false], [0.58, 0.4, false]]) {
      const filas = conMarcas({ N110: { parte: a, de: 2 }, N66: 2 }, { N110: { parte: b, de: 2 }, N66: 2 });
      assert.equal(conteosHomologacion(filas).clavesMedidaComun.has(CID), ok, a + ' + ' + b);
      assert.equal(err(filas[F1].decision, filas).length === 0, ok, a + ' + ' + b);
    }
    // Tres transformadores con partes de 3 decimales: 0,333 × 3 = 99,9 % cuadra.
    const tres = { ...conMarcas({ N110: { parte: 0.333, de: 3 }, N66: 3 }, { N110: { parte: 0.333, de: 3 }, N66: 3 }),
      rTres: { matricula: 'T3A-X/X-DM3', subestacion: 'DEMO UNO', clave_excel: CLAVE, decision: dec(MAPA2, { medida_comun: { N110: { parte: 0.333, de: 3 }, N66: 3 } }) } };
    assert.ok(conteosHomologacion(tres).clavesMedidaComun.has(CID));
    assert.deepEqual(err(tres[F1].decision, tres), []);
  });

  test('al guardar: parte 1,2 / 0 / «0.5» (texto) / 0,5555, sin «de», «de» 5 → error en texto llano', () => {
    const conValor = (v) => err(dec(MAPA1, { medida_comun: { N110: v, N66: 2 } })).join(' ');
    for (const v of [{ parte: 1.2, de: 2 }, { parte: 0, de: 2 }, { parte: '0.5', de: 2 }, { parte: 1, de: 2 }, { parte: -0.3, de: 2 }, { de: 2 }]) {
      assert.match(conValor(v), /La parte de la medida común de 110 kV debe ser un número mayor que 0 y menor que 1 \(por ejemplo, 0,58 = el 58 %\)\./, JSON.stringify(v));
    }
    assert.match(conValor({ parte: 0.5555, de: 2 }), /La parte de la medida común de 110 kV lleva como mucho 3 decimales/);
    assert.match(conValor({ parte: 0.58 }), /debe decir entre cuántos transformadores se reparte la medida \(«de», de 2 a 4\)/);
    assert.match(conValor({ parte: 0.58, de: 5 }), /La medida común de 110 kV se reparte entre 2 y 4 transformadores: «de» debe ser un número entero de 2 a 4\./);
    assert.match(conValor({ parte: 0.58, de: 1 }), /«de» debe ser un número entero de 2 a 4/);
    assert.match(conValor({ parte: 0.58, de: '2' }), /«de» debe ser un número entero de 2 a 4/);
    assert.match(conValor('2'), /110 kV debe ser un número entero de 2 a 4 .* o la parte de este transformador/);
    // La parte que no vale deja al grupo sin cuadrar (en las dos filas).
    const mala = conMarcas({ N110: { parte: 0.5555, de: 2 }, N66: 2 }, { N110: { parte: 0.4445, de: 2 }, N66: 2 });
    assert.ok(conteosHomologacion(mala).clavesMedidaComunIncompleta.has(CID));
  });

  test('textos: nota bajo las curvas, fila de la tabla del detalle, CSV, rótulo y párrafo del diálogo dicen la parte', () => {
    const rep = { n: 2, parte: 0.58 };
    assert.equal(rotuloMedidaComun(rep), '58 % de la medida común');
    assert.equal(rotuloMedidaComun({ n: 2 }), 'medida común ÷ 2');
    assert.equal(rotuloMedidaComun({ parte: 0.425, de: 2 }), '42,5 % de la medida común');
    assert.equal(porcentajeParte(0.58), '58 %'); assert.equal(porcentajeParte(0.333), '33,3 %');
    assert.equal(notaCurvasMedidaComun(rep), 'medida común de los 2 transformadores en paralelo; se muestra la parte de este transformador: 58 % de la medida común; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
    assert.equal(alcanceCurvasMedidaComun(rep), 'Las corrientes (con su máximo, mínimo e instantáneo), P y Q van al 58 % de lo medido; la tensión es la medida común, tal cual.');
    assert.equal(alcanceCurvasMedidaComun({ n: 2 }), 'Se dividen las corrientes (con su máximo, mínimo e instantáneo), P y Q; la tensión es la medida común sin dividir.');
    assert.equal(textoDetalleMedidaComun(rep), 'Se muestra la parte de este transformador: 58 % de la medida común de los 2 transformadores en paralelo (el 58 % de las corrientes, de P y de Q; la tensión no cambia). Puede ir más cargado si circula corriente entre ellos o si otro sale de servicio · cifra provisional');
    assert.equal(origenCsvMedidaComun(rep), 'IR, IS, IT, P y Q = 58 % de la medida común de los 2 transformadores en paralelo (la parte de este transformador); U = la medida común, tal cual');
    // El entero, como antes.
    assert.equal(textoDetalleMedidaComun({ n: 2 }), textoDetalleMedidaComun(2));
    assert.equal(origenCsvMedidaComun({ n: 2 }), origenCsvMedidaComun(2));
    assert.equal(notaCurvasMedidaComun({ n: 2 }), notaCurvasMedidaComun(2));
    // El diálogo: la marca guardada con la parte, de mayor a menor tensión.
    assert.match(textoMedidaComunGuardada(P1), /^Medida común de transformadores en paralelo: 110 kV: a este le corresponde el 58 % \(de 2 en paralelo\) · 66 kV: a este le corresponde la mitad \(de 2 en paralelo\)\. /);
    assert.match(textoMedidaComunGuardada(P1), /por partes, entre todas suman 100 %/);
    assert.match(textoMedidaComunGuardada(P1), /No se arma desde aquí/);
    // Un motivo con niveles de distinto número de transformadores lo dice nivel por nivel.
    assert.equal(motivoMedidaComun([{ nivel: 'N110', n: 3, parte: 0.4 }, { nivel: 'N66', n: 2 }]),
      'medida común de transformadores en paralelo (3 en 110 kV y 2 en 66 kV): a este le corresponde el 40 % en 110 kV y la mitad en 66 kV; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio');
  });

  test('el diálogo «Revisar» conserva la parte: objeto NUEVO con solo «parte» y «de» (números finitos, nada undefined)', () => {
    const guardada = { N110: { parte: 0.58, de: 2, otra: 'x' }, N66: 2 };
    const c = copiaMedidaComun(guardada);
    assert.deepEqual(c, { N110: { parte: 0.58, de: 2 }, N66: 2 });
    assert.notEqual(c.N110, guardada.N110, 'objeto nuevo, no la referencia a lo leído');
    assert.ok(Number.isFinite(c.N110.parte) && Number.isFinite(c.N110.de));
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c, 'sin undefined ni NaN (Firestore)');
    assert.deepEqual(guardada.N110, { parte: 0.58, de: 2, otra: 'x' }, 'no modifica lo que recibe');
    // Sin «de»: la copia no escribe `de: undefined` (y erroresMedidaComun no deja guardarla).
    const sinDe = copiaMedidaComun({ N110: { parte: 0.58 } });
    assert.equal('de' in sinDe.N110, false);
    // Guardar sin cambios con la copia: sin errores en el grupo.
    assert.deepEqual(err(dec(MAPA1, { medida_comun: copiaMedidaComun(P1) })), []);
    // Prueba de fuente: el diálogo copia con copiaMedidaComun y muestra la parte en la celda del p99.
    const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
    assert.match(h, /const mc = copiaMedidaComun\(Object\.fromEntries\(Object\.entries\(mcGuardada\)\.filter\(/);
    assert.match(h, /const repComun = mcGuardada && !medir\.disabled && medir\.value === 'medida' \? repartoMedidaComun\(mcGuardada\[nv\]\) : null;/);
    assert.match(h, /'el ' \+ porcentajeParte\(repComun\.parte\) \+ ' = ' \+ num\(r\.i\.p99 \* repComun\.parte, 0\)/);
    // Partes iguales, con la palabra del motivo: «le corresponde la mitad = 617 A» (no «le corresponde ÷ 2 = 617 A»).
    assert.match(h, /: fraccionMedidaComun\(repComun\.n\) \+ ' = ' \+ num\(r\.i\.p99 \/ repComun\.n, 0\)\) \+ ' A'/);
    assert.doesNotMatch(h, /'÷ ' \+ repComun\.n/);
  });

  test('las marcas con el entero dan EXACTAMENTE lo mismo que antes de la parte (cifra, rótulo, estado)', () => {
    const [y1, y2] = filasLista({ parque: [TX1, TX2], homologacion: { filas: CON }, catalogo, resumenMes: resumenMes('2026-03', MAR) });
    for (const y of [y1, y2]) {
      assert.equal(nivel(y, 'N110').pct, 100 * (r.N110.i.p99 / 2) / A.P);
      assert.equal(nivel(y, 'N110').etiqueta, '110 kV · medida común ÷ 2');
      assert.deepEqual(nivel(y, 'N110').medidaComun, { n: 2 });
      assert.equal(y.estado, 'confirmada'); assert.equal(y.clase, 'provisional');
    }
    // Y la parte 0,5 de 2 da la misma cifra que ÷ 2 (otra forma, mismo número).
    const medias = conMarcas({ N110: { parte: 0.5, de: 2 }, N66: { parte: 0.5, de: 2 } }, { N110: { parte: 0.5, de: 2 }, N66: { parte: 0.5, de: 2 } });
    const [z1] = filasLista({ parque: [TX1, TX2], homologacion: { filas: medias }, catalogo, resumenMes: resumenMes('2026-03', MAR) });
    assert.equal(nivel(z1, 'N110').pct, nivel(y1, 'N110').pct);
    assert.equal(nivel(z1, 'N110').etiqueta, '110 kV · 50 % de la medida común');
  });
});
