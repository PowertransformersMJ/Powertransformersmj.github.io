// Cargabilidad SCADA — firmeza por el devanado que da la cifra (2026-10-27), con datos SINTÉTICOS («EstDemo»).
// Decisión del Ingeniero: «Sí, en mes y periodo». Lo que se exige: un devanado que mide poco y NO da la cifra ya no vuelve
// provisional al equipo; en varios meses, el devanado de la cifra se cuenta solo en los meses en que midió y debe haber
// medido al menos la mitad; lo demás (fase, homologación, escala) no cambia.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firmeza, estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { firmezaDeMeses, firmezaPeriodoDeFilas, FRACCION_MESES_MIN } from '../assets/js/domain/scada_carga_firmeza_periodo.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';

const placa = { P: { kv: 34.5, A: 300 }, S: { kv: 13.8, A: 800 }, T: { kv: null, A: null } };
const dev = (d, pct, cobertura, n = 600, extra = {}) => ({ d, A: d === 'P' ? 300 : 800, pct, cobertura, n, escala: 'ok', unaFalta: 0, ...extra });
const base = { estadoHomologacion: 'automatica', esCircuito: false, placa, mesesFallidos: [] };

describe('firmeza: decide el devanado que da la cifra', () => {
  test('el otro devanado con poca medida ya no la vuelve provisional', () => {
    assert.deepEqual(firmeza({ ...base, devanados: [dev('P', 60, 0.9), dev('S', 50, 0.2, 100)] }), { firme: true, motivos: [] });
  });
  test('si el que da la cifra mide poco, sigue provisional', () => {
    const f = firmeza({ ...base, devanados: [dev('P', 60, 0.3), dev('S', 50, 0.9)] });
    assert.equal(f.firme, false); assert.ok(f.motivos.includes('cobertura menor al 50 %'));
    assert.ok(firmeza({ ...base, devanados: [dev('P', 60, 0.9, 40), dev('S', 50, 0.9)] }).motivos.includes('menos de 72 horas válidas'));
  });
  test('varios meses: cuenta la cobertura en los meses en que midió y exige la mitad de los meses', () => {
    const p = (extra) => dev('P', 60, 0.27, 1700, extra);
    assert.equal(firmeza({ ...base, devanados: [p({ coberturaFirmeza: 0.8, mesesMedidos: 5, mesesTotal: 9 })] }).firme, true);
    const f = firmeza({ ...base, devanados: [p({ coberturaFirmeza: 0.8, mesesMedidos: 4, mesesTotal: 9 })] });
    assert.deepEqual(f.motivos, ['midió menos de la mitad de los meses']);
    assert.ok(firmeza({ ...base, devanados: [p({ coberturaFirmeza: 0.4, mesesMedidos: 9, mesesTotal: 9 })] }).motivos.includes('cobertura menor al 50 %'));
    assert.equal(FRACCION_MESES_MIN, 0.5);
  });
  test('lo demás no cambia: una fase que falta, la homologación y la escala siguen mandando', () => {
    assert.ok(firmeza({ ...base, devanados: [dev('P', 60, 0.9, 600, { unaFalta: 400 }), dev('S', 50, 0.9)] }).motivos.includes('falta una fase en la mayoría de las horas'));
    assert.ok(firmeza({ ...base, estadoHomologacion: 'pendiente', devanados: [dev('P', 60, 0.9)] }).motivos.includes('homologación por confirmar'));
  });
});

describe('cobertura de un devanado en los meses en que midió', () => {
  test('pesa cada mes por sus horas en servicio e ignora los meses sin medida', () => {
    const r = firmezaDeMeses([{ n: 600, cob: 0.8 }, null, { n: 0, cob: 0 }, { n: 300, cob: 0.5 }]);
    assert.equal(r.mesesMedidos, 2);
    assert.equal(Math.round(r.coberturaFirmeza * 1e6) / 1e6, Math.round((900 / (750 + 600)) * 1e6) / 1e6);
    assert.deepEqual(firmezaDeMeses([]), { coberturaFirmeza: null, mesesMedidos: 0 });
  });
  test('desde las filas de cada mes, por devanado, con los meses del periodo', () => {
    const fm = [{ devanados: [{ d: 'P', n: 600, cobertura: 0.9 }, { d: 'S', n: 500, cobertura: 0.8 }] }, null, { devanados: [{ d: 'P', n: 700, cobertura: 1 }] }];
    const r = firmezaPeriodoDeFilas(fm, 3);
    assert.equal(r.P.mesesMedidos, 2); assert.equal(r.P.mesesTotal, 3);
    assert.equal(r.S.mesesMedidos, 1); assert.equal(Math.round(r.S.coberturaFirmeza * 100) / 100, 0.8);
  });
});

describe('periodo de la lista: un devanado que midió solo un mes ya no lo vuelve provisional', () => {
  const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
    electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
  const { filas } = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null);
  const cid = claveId('EstDemo1', 'swTrafo1');
  const red = (x) => Math.round(x * 1000) / 1000;
  const nivel = (v) => {
    const e = estadisticas(Float32Array.from(v));
    return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 },
      sost: null, horas: 720, servicio: 720, des: 0, cob: e.n / 720, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0,
      top: [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
  };
  const serie = (a, n) => Array.from({ length: n }, (_, h) => Math.fround(a + (h % 40)));
  const meses = ['2026-01', '2026-02', '2026-03', '2026-04'];
  // P (la cifra, ~66 %) mide bien los 4 meses; S (~55 %, relación de corrientes 2,3) solo mide en enero.
  const resumenes = Object.fromEntries(meses.map((m, k) => [m, { mes: m, claves: { [cid]: k === 0
    ? { N34_5: nivel(serie(160, 650)), N13_8: nivel(serie(400, 600)) }
    : { N34_5: nivel(serie(160, 650)) } } }]));
  const catalogo = { meses: Object.fromEntries(meses.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N34_5: {}, N13_8: {} }, meses } } };
  const filasPorMes = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: resumenes[m] })]));
  const periodo = (ms) => filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses: ms, resumenes, filasPorMes })[0];

  test('cada mes es firme y el periodo también (antes salía provisional por el devanado S)', () => {
    for (const m of meses) assert.equal(filasPorMes[m][0].firme, true, m);
    const p = periodo(meses);
    const s = p.devanados.find((d) => d.d === 'S');
    assert.ok(s.cobertura < 0.5, 'la cobertura del periodo de S sigue siendo baja (se muestra igual)');
    assert.equal(p.devMax, 'P');
    assert.equal(p.firme, true); assert.deepEqual(p.motivos, []);
  });
  test('si el devanado de la cifra midió menos de la mitad de los meses, el periodo queda provisional', () => {
    const solo = Object.fromEntries(meses.map((m, k) => [m, { mes: m, claves: { [cid]: k === 0 ? { N34_5: nivel(serie(160, 650)) } : {} } }]));
    const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: solo[m] })]));
    const p = filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses, resumenes: solo, filasPorMes: fpm })[0];
    assert.equal(p.firme, false); assert.ok(p.motivos.includes('midió menos de la mitad de los meses'));
  });
  test('el detalle aplica la misma regla en un rango de varios meses', () => {
    const d = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(d, /firmezaPeriodo = firmezaDelRango\(recs, previo\.niveles, mesesCargados, desde\)/);
    assert.match(d, /mesesFallidos: \[\.\.\.fallidos\], firmezaPeriodo \}\)/);
  });
});
