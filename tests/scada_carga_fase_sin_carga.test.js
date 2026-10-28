// Cargabilidad SCADA — FASE SIN CARGA POR DISEÑO (banco de dos monofásicas), decisión del Ingeniero 2026-10-28, con datos
// SINTÉTICOS («EstDemo»). Lo que se exige: con la marca en la decisión, las horas de dos fases de ese nivel no son «falta una
// fase» y la cifra no cambia; sin la marca, todo igual que antes; si la fase marcada empieza a medir, vuelve a provisional.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { faseSinCarga, faseSinCargaMide, TOPE_TRES_FASES } from '../assets/js/domain/scada_carga_fase_sin_carga.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';

const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 14.5, corriente_nominal_secundaria_a: 62.8 } };
const cid = claveId('EstDemo1', 'swTrafo1');
const red = (x) => Math.round(x * 1000) / 1000;
/** Un nivel con n horas válidas, `dos` de ellas con solo dos fases. */
function nivel(n, dos) {
  const v = Array.from({ length: n }, (_, h) => Math.fround(15 + (h % 10)));
  const e = estadisticas(Float32Array.from(v));
  return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: dos },
    sost: null, horas: 720, servicio: 720, des: 0, cob: e.n / 720, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0,
    top: [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
}
function homologacion(extra) {
  const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
  const id = Object.keys(filas)[0];
  filas[id] = { ...filas[id], decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo1', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'banco de dos monofásicas', avisos_vistos: [], ...extra } };
  return { filas };
}
const meses = ['2026-01', '2026-02'];
const catalogo = { meses: Object.fromEntries(meses.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses } } };
const fila = (h, r) => filasLista({ parque: [tx], homologacion: h, catalogo, resumenMes: { mes: '2026-01', claves: { [cid]: { N13_8: r } } } })[0];

describe('la marca en la decisión', () => {
  test('solo vale una fase de corriente y solo en una decisión «usar»', () => {
    const f = (d) => ({ decision: { tipo: 'usar', ...d } });
    assert.equal(faseSinCarga(f({ fases_sin_carga: { N13_8: 'IS' } }), 'N13_8'), 'IS');
    assert.equal(faseSinCarga(f({ fases_sin_carga: { N13_8: 'IS' } }), 'N34_5'), null);
    assert.equal(faseSinCarga(f({ fases_sin_carga: { N13_8: 'S' } }), 'N13_8'), null);
    assert.equal(faseSinCarga({ decision: { tipo: 'no_usar', fases_sin_carga: { N13_8: 'IS' } } }, 'N13_8'), null);
    assert.equal(faseSinCarga(null, 'N13_8'), null);
  });
  test('la fase marcada «mide» si las horas con tres fases pasan del mayor de 6 h o el 5 %', () => {
    assert.deepEqual(TOPE_TRES_FASES, { horas: 6, fraccion: 0.05 });
    assert.equal(faseSinCargaMide(600, 600), false);
    assert.equal(faseSinCargaMide(600, 570), false, '30 h = el 5 % de 600: en el tope, todavía no');
    assert.equal(faseSinCargaMide(600, 560), true, '40 h: pasa del 5 %');
    assert.equal(faseSinCargaMide(100, 94), false, '6 h: en el piso, todavía no');
    assert.equal(faseSinCargaMide(100, 93), true, '7 h: pasa del piso de 6 h (el 5 % serían 5)');
  });
});

describe('cifra y firmeza de un banco de dos monofásicas', () => {
  test('sin la marca: provisional por «falta una fase» (como antes)', () => {
    const x = fila(homologacion({}), nivel(600, 600));
    assert.equal(x.firme, false);
    assert.ok(x.motivos.includes('falta una fase en la mayoría de las horas'));
  });
  test('con la marca: firme y la MISMA cifra', () => {
    const sin = fila(homologacion({}), nivel(600, 600));
    const con = fila(homologacion({ fases_sin_carga: { N13_8: 'IS' } }), nivel(600, 600));
    assert.equal(con.firme, true, con.motivos.join('; '));
    assert.equal(con.pct, sin.pct);
    assert.equal(con.devanados[0].faseSinCarga, 'IS');
  });
  test('si la fase marcada empieza a medir, vuelve a provisional con su motivo', () => {
    const x = fila(homologacion({ fases_sin_carga: { N13_8: 'IS' } }), nivel(600, 500));
    assert.equal(x.firme, false);
    assert.deepEqual(x.motivos, ['la fase marcada sin carga está midiendo']);
  });
  test('el resguardo se mira MES A MES: un mes que mide no se diluye en el periodo', () => {
    const h = homologacion({ fases_sin_carga: { N13_8: 'IS' } });
    // Febrero: 40 h con tres fases (pasa su tope de 30). Sumado con enero: 40 de 1.200 h, bajo el tope de 60 del periodo.
    const resumenes = { '2026-01': { mes: '2026-01', claves: { [cid]: { N13_8: nivel(600, 600) } } }, '2026-02': { mes: '2026-02', claves: { [cid]: { N13_8: nivel(600, 560) } } } };
    const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: h, catalogo, resumenMes: resumenes[m] })]));
    assert.equal(fpm['2026-02'][0].firme, false);
    const p = filasPeriodo({ parque: [tx], homologacion: h, catalogo, meses, resumenes, filasPorMes: fpm })[0];
    assert.equal(p.firme, false);
    assert.ok(p.motivos.includes('la fase marcada sin carga está midiendo'), p.motivos.join('; '));
  });
  test('en varios meses también (el periodo suma las horas de dos fases)', () => {
    const h = homologacion({ fases_sin_carga: { N13_8: 'IS' } });
    const resumenes = Object.fromEntries(meses.map((m) => [m, { mes: m, claves: { [cid]: { N13_8: nivel(600, 600) } } }]));
    const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: h, catalogo, resumenMes: resumenes[m] })]));
    const p = filasPeriodo({ parque: [tx], homologacion: h, catalogo, meses, resumenes, filasPorMes: fpm })[0];
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
});

test('el diálogo «Revisar» conserva la marca al guardar (si no, la borraba)', () => {
  const src = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
  assert.match(src, /if \(Object\.keys\(fsc\)\.length\) decision\.fases_sin_carga = fsc;/);
  assert.match(src, /Fase sin carga \(p\. ej\., banco de dos monofásicas o red de dos fases\)/);
  // Sin leer los niveles (catálogo no leído) no se guarda: se perdería la marca.
  assert.match(src, /!niveles\.length && \(Object\.keys\(sumaGuardada\)\.length \|\| fscGuardada \|\| bmGuardada \|\| mapaGuardado\)/);
});

test('un nivel medido por suma de circuitos no usa la marca (sus tres fases salen de los circuitos)', () => {
  const src = readFileSync(new URL('../assets/js/domain/scada_carga_vista.js', import.meta.url), 'utf8');
  assert.match(src, /const fsc = d && !sp \? faseSinCarga\(fila, nv\) : null;/);
});
