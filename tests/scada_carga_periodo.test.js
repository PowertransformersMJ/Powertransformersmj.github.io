// Cargabilidad SCADA (`99 §159`) — periodo de varios meses e historia de un equipo, con datos SINTÉTICOS
// (estaciones «EstDemo»). Lo que se exige: el p99 del periodo es EXACTO (igual al de todas sus horas), un periodo de UN mes
// da la misma cifra que la lista de ese mes, y sin las horas más altas guardadas la cifra no se inventa.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { aBytesF32, msRotulo, empaquetar, desempaquetar } from '../assets/js/domain/scada_carga_series.js';
import { TOP_HORAS, topHoras, resumirParaGuardar } from '../assets/js/domain/scada_carga_importacion.js';
import { resumenFisico } from '../assets/js/domain/scada_carga_kpis.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO } from '../assets/js/domain/scada_carga_config.js';
import {
  topsDe, p99DePeriodo, resumenPeriodo, agregadosDeMeses, filasPeriodo, hitosDeCurva, horasNoCargadas, MAX_MESES_PERIODO
} from '../assets/js/domain/scada_carga_periodo.js';

// Generador determinista (sin Math.random): congruencial lineal.
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const f32 = (x) => Math.fround(x);
const top90 = (vals) => Float32Array.from([...vals].sort((a, b) => b - a).slice(0, TOP_HORAS));
const red = (x) => Math.round(x * 1000) / 1000;

describe('p99 de un periodo con las horas más altas de cada mes', () => {
  test('es EXACTO frente a todas las horas, con meses de distinto tamaño y picos concentrados en un mes', () => {
    for (const semilla of [1, 7, 42, 2026]) {
      const r = azar(semilla);
      const meses = Array.from({ length: 12 }, (_, k) => {
        const n = 400 + Math.floor(r() * 344);            // horas válidas del mes
        const pico = k === 3 ? 400 : 0;                   // un mes con todo lo alto (peor caso)
        return Array.from({ length: n }, () => f32(80 + r() * 100 + (r() < 0.12 ? pico : 0)));
      });
      const todos = meses.flat();
      const exacto = estadisticas(Float32Array.from(todos)).p99;
      const p = p99DePeriodo(meses.map((v) => ({ n: v.length, top: top90(v) })));
      assert.equal(p.exacto, true);
      assert.equal(p.p99, red(exacto), 'semilla ' + semilla);
    }
  });
  test('UN mes: igual al p99 de ese mes; con menos de 90 horas, también', () => {
    const r = azar(5);
    const v = Array.from({ length: 37 }, () => f32(r() * 300));
    assert.equal(p99DePeriodo([{ n: v.length, top: top90(v) }]).p99, red(estadisticas(Float32Array.from(v)).p99));
  });
  test('si a un mes con horas le faltan las suyas, no hay cifra (no se inventa)', () => {
    const p = p99DePeriodo([{ n: 700, top: top90(Array(700).fill(10)) }, { n: 500, top: null }]);
    assert.equal(p.p99, null); assert.equal(p.exacto, false); assert.equal(p.n, 1200);
    assert.deepEqual(p99DePeriodo([]), { n: 0, p99: null, exacto: true });
  });
  test('tope de 12 meses: el detalle y la lista usan el mismo', () => { assert.equal(MAX_MESES_PERIODO, 12); });
  test('topsDe lee Bytes de Firestore, bytes y listas', () => {
    const b = aBytesF32(Float32Array.from([5, 3, 1]));
    assert.deepEqual([...topsDe(b)], [5, 3, 1]);
    assert.deepEqual([...topsDe({ toUint8Array: () => b })], [5, 3, 1]);
    assert.deepEqual([...topsDe([2, 1])], [2, 1]);
    assert.equal(topsDe(null), null);
  });
});

describe('el importador guarda las horas más altas del mes', () => {
  // Un nivel con 3 fases; la fase más cargada es IR. Horas 0..719 con valores conocidos; dos horas inválidas.
  const n = 720;
  const fase = (fn, cod = () => CODIGO.VALIDO) => ({ v: Float32Array.from({ length: n }, (_, h) => fn(h)), m: Uint8Array.from({ length: n }, (_, h) => cod(h)), b: new Uint8Array(n).fill(1) });
  const limpio = {
    IR: fase((h) => 100 + (h % 97), (h) => (h === 5 || h === 6 ? CODIGO.CONGELADO : CODIGO.VALIDO)),
    IS: fase((h) => 90 + (h % 97)), IT: fase((h) => 50)
  };
  test('las 90 más altas de la fase más cargada, de mayor a menor, como LISTA de números (cualquier página la escribe)', () => {
    const t = topHoras(limpio);
    assert.ok(Array.isArray(t));
    assert.equal(t.length, TOP_HORAS);
    for (let i = 1; i < t.length; i++) assert.ok(t[i] <= t[i - 1]);
    assert.equal(t[0], 196);
  });
  test('el resumen las trae y su p99 es el mismo que da el periodo de ese mes', () => {
    const r = resumirParaGuardar(resumenFisico(limpio, 13.8), limpio);
    assert.ok(Array.isArray(r.top));
    assert.equal(p99DePeriodo([{ n: r.i.n, top: topsDe(r.top) }]).p99, r.i.p99);
  });
});

describe('resumen del periodo', () => {
  const mk = (n, p99, extra = {}) => ({ i: { n, p50: p99 / 2, p95: null, p98: null, p99, max: red(p99 * 1.1), iMax: 3, prom: p99 / 2, unaFalta: 0 }, sost: { v: p99, idx: 1 }, horas: 720, servicio: 700, des: 20, cob: n / 700, top: Array(Math.min(90, n)).fill(p99), ...extra });
  test('suma horas y cobertura; el mes que vino para el parque y no para el punto es un hueco suyo', () => {
    const r = resumenPeriodo([{ mes: '2026-01', r: { N13_8: mk(600, 100) } }, { mes: '2026-02', r: null }]);
    const x = r.porNivel.N13_8;
    assert.equal(x.i.n, 600); assert.equal(x.horas, 720 + 672); assert.equal(x.servicio, 700 + 672);
    assert.equal(x.cob, Math.round((600 / 1372) * 1000) / 1000);
    assert.equal(x.i.max, 110); assert.equal(x.sost.v, 100);
  });
  test('los días que el PARQUE no cargó de un mes incompleto no son hueco del equipo (como un mes no cargado)', () => {
    const oct = { ...mk(160, 100), horas: 744, servicio: 744, des: 0 };
    const r = resumenPeriodo([{ mes: '2026-09', r: { N13_8: mk(600, 100) } }, { mes: '2026-10', r: { N13_8: oct }, noCargadas: 24 * 24 }]);
    assert.equal(r.porNivel.N13_8.servicio, 700 + 168); assert.equal(r.porNivel.N13_8.horas, 720 + 168);
    // y si el punto no vino en ese mes, su hueco son solo los días cargados
    const sin = resumenPeriodo([{ mes: '2026-09', r: { N13_8: mk(600, 100) } }, { mes: '2026-10', r: null, noCargadas: 24 * 24 }]);
    assert.equal(sin.porNivel.N13_8.servicio, 700 + 168);
  });
  test('horasNoCargadas: solo meses INCOMPLETOS y solo en periodos de varios meses', () => {
    const cat = { meses: { '2026-08': { dias: '1111111111101111111111111111111', completo: true }, '2026-10': { dias: '1111111' + '0'.repeat(24), completo: false } } };
    assert.deepEqual(horasNoCargadas(cat, ['2026-08', '2026-10']), { '2026-10': 576 });
    assert.deepEqual(horasNoCargadas(cat, ['2026-10']), {});
    assert.deepEqual(horasNoCargadas(null, ['2026-08', '2026-10']), {});
  });
  test('un mes cargado sin sus horas más altas se reporta (para pedir prepararlo)', () => {
    const viejo = mk(500, 90); delete viejo.top;
    const r = resumenPeriodo([{ mes: '2026-01', r: { N13_8: mk(600, 100) } }, { mes: '2026-02', r: { N13_8: viejo } }]);
    assert.deepEqual(r.faltaTop, { N13_8: ['2026-02'] });
    assert.equal(r.porNivel.N13_8.i.p99, null);
  });
});

describe('lista del periodo e historia', () => {
  const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
    electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
  const { filas } = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null);
  const cid = claveId('EstDemo1', 'swTrafo1');
  const vals = (base, n, r) => Array.from({ length: n }, () => f32(base + r() * 200));
  const nivel = (v, { sost = null, max = null, iMax = 10 } = {}) => {
    const e = estadisticas(Float32Array.from(v));
    return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: max ?? red(e.max), iMax, prom: red(e.prom), unaFalta: 0 },
      sost: sost == null ? null : { v: sost, idx: 0 }, horas: 720, servicio: 720, des: 0, cob: e.n / 720, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0,
      top: [...top90(v)] };
  };
  const r = azar(9);
  const enero = vals(400, 700, r); const febrero = vals(500, 650, r);
  const resumenes = {
    '2026-01': { mes: '2026-01', claves: { [cid]: { N13_8: nivel(enero, { sost: 650 }) } } },
    '2026-02': { mes: '2026-02', claves: { [cid]: { N13_8: nivel(febrero, { sost: 820, iMax: 100 }) } } }
  };
  const catalogo = { meses: { '2026-01': { completo: true }, '2026-02': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} }, meses: ['2026-01', '2026-02'] } } };
  const ctxMes = (mes) => filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: resumenes[mes] });
  const filasPorMes = { '2026-01': ctxMes('2026-01'), '2026-02': ctxMes('2026-02') };
  const periodo = (meses) => filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses, resumenes, filasPorMes })[0];

  test('periodo de UN mes = la cifra de la lista de ese mes', () => {
    for (const m of ['2026-01', '2026-02']) {
      const p = periodo([m]); const x = filasPorMes[m][0];
      assert.equal(p.pct, x.pct); assert.equal(p.clase, x.clase); assert.equal(p.crg, x.crg); assert.equal(p.motivoNulo, x.motivoNulo);
    }
  });
  test('periodo de dos meses: p99 exacto de todas las horas, peor mes y mayor corriente con su mes y hora', () => {
    const p = periodo(['2026-01', '2026-02']);
    const exacto = red(estadisticas(Float32Array.from([...enero, ...febrero])).p99);
    assert.equal(p.pct, (100 * exacto) / 800);
    assert.equal(p.periodo.peorMes.mes, '2026-02');
    assert.equal(p.periodo.mesesConCifra, 2);
    const mc = p.periodo.mayorCorriente;
    assert.equal(mc.devanado, 'S'); assert.equal(mc.mes, '2026-02'); assert.equal(mc.ms, msRotulo('2026-02', 100));
    assert.equal(p.matricula, 'T1-X/X-DM1'); assert.equal(p.zona, 'ORIENTE');
  });
  test('desde cuándo: el primer mes con sobrecarga sostenida; si es el primero con datos, «desde el inicio de los datos»', () => {
    const p = periodo(['2026-01', '2026-02']);
    assert.equal(p.periodo.primeraSostenida.mes, '2026-02');       // enero: sostenido 650 de 800 = 81 % (no supera)
    assert.equal(p.periodo.primeraSostenida.inicioDatos, false);
    assert.equal(p.sobrecargaSostenida || p.sobrecargaProvisional, true);
    // Febrero solo: el punto tiene enero ANTES → «desde el inicio del periodo», no «de los datos».
    const solo = periodo(['2026-02']);
    assert.equal(solo.periodo.primeraSostenida.inicioDatos, false);
    assert.equal(solo.periodo.primeraSostenida.inicioPeriodo, true);
  });
  test('«desde el inicio de los datos» solo si no hay meses antes y el primer mes con horas medidas es el de la sobrecarga', () => {
    const f = (pct, n, sost) => ({ pct, clase: 'firme', crg: 5, sobrecargaSostenida: sost, niveles: [{ nivel: 'N13_8', devanado: 'S', A: 100, pct, n, picoPct: 120, sostenidaPct: sost ? 110 : 90 }] });
    const ag = agregadosDeMeses([{ mes: '2026-01', fila: f(null, 0, false), r: null }, { mes: '2026-02', fila: f(110, 600, true), r: null }]);
    assert.equal(ag.primerMesConDato, '2026-02');
    assert.equal(ag.primeraSostenida.inicioDatos, true);
    assert.equal(agregadosDeMeses([{ mes: '2026-02', fila: f(110, 600, true), r: null }], { hayAntes: true }).primeraSostenida.inicioDatos, false);
  });
  test('un mes del periodo sin sus horas más altas: la cifra se pide preparar (no se inventa)', () => {
    const viejo = JSON.parse(JSON.stringify(resumenes['2026-02'])); delete viejo.claves[cid].N13_8.top;
    const p = filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses: ['2026-01', '2026-02'], resumenes: { ...resumenes, '2026-02': viejo }, filasPorMes })[0];
    assert.equal(p.pct, null); assert.match(p.motivoNulo, /falta preparar 2026-02/);
    assert.equal(p.periodo.peorMes.mes, '2026-02');                  // el peor mes sí se sabe (sale de la lista del mes)
  });
  test('los meses provisionales cuentan igual (decisión del Ingeniero) y se rotulan', () => {
    const ag = agregadosDeMeses([
      { mes: '2026-01', fila: { pct: 120, clase: 'provisional', crg: 5, sobrecargaProvisional: true, niveles: [] }, r: null },
      { mes: '2026-02', fila: { pct: 90, clase: 'firme', crg: 4, niveles: [] }, r: null }]);
    assert.equal(ag.peorMes.mes, '2026-01'); assert.equal(ag.peorMes.clase, 'provisional');
    assert.equal(ag.primeraSostenida.mes, '2026-01'); assert.equal(ag.primeraSostenida.clase, 'provisional');
    assert.equal(ag.mesesCRG45, 2);
  });
  // Fila mensual mínima con la forma de calcularEquipo: niveles con cifra propia (pct), pico y sostenido en % de su ampacidad.
  const nv = (nivel, devanado, A, { pct = 80, n = 700, pico = 90, sost = 85, escala = 'ESCALA_PQ' } = {}) => ({ nivel, devanado, A, pct, n, picoPct: pico, sostenidaPct: sost, escala });
  const rs = (max, iMax = 4) => ({ i: { n: 700, max, iMax } });
  test('mayor corriente: un mes con horas imposibles (> 3 × A) no se cuenta; manda la confiable y se avisa «por confirmar»', () => {
    const ag = agregadosDeMeses([
      { mes: '2026-01', fila: { pct: 80, clase: 'firme', crg: 4, niveles: [nv('N34_5', 'P', 300, { pico: 333 }), nv('N13_8', 'S', 800)] }, r: { N34_5: rs(1000), N13_8: rs(700) } },
      { mes: '2026-02', fila: { pct: 85, clase: 'firme', crg: 4, niveles: [nv('N34_5', 'P', 300, { pico: 290 }), nv('N13_8', 'S', 800)] }, r: { N34_5: rs(870), N13_8: rs(650) } }]);
    const P = ag.devanados.find((d) => d.devanado === 'P');
    assert.equal(P.mes, '2026-02'); assert.equal(P.max, 870);              // la confiable de febrero, no el 1000 de enero
    assert.deepEqual(P.imposibles.map((m) => m.mes), ['2026-01']);
    assert.equal(ag.mayorCorriente.devanado, 'P'); assert.equal(ag.mayorCorriente.porConfirmar, true);
    assert.deepEqual(ag.mayorCorriente.mesesPorConfirmar, ['2026-01']);
  });
  test('un nivel de escala sospechosa o un equipo sin cifra (circuito sin confirmar) no dan mayor corriente ni sobrecarga', () => {
    const escala = agregadosDeMeses([{ mes: '2026-01', fila: { pct: 60, clase: 'firme', crg: 2, niveles: [nv('N34_5', 'P', 67, { pct: null, pico: 240, sost: 230, escala: 'ESCALA_I' }), nv('N13_8', 'S', 167, { pct: 60, pico: 70, sost: 65 })] }, r: { N34_5: rs(160), N13_8: rs(117) } }]);
    assert.deepEqual(escala.devanados.map((d) => d.devanado), ['S']);
    assert.equal(escala.devanados[0].mesesSost, 0);
    const circuito = agregadosDeMeses([{ mes: '2026-01', fila: { pct: null, clase: 'nulo', motivoNulo: 'se mide un circuito, no el transformador', niveles: [nv('N13_8', 'S', 100, { pct: 138, pico: 140, sost: 130 })] }, r: { N13_8: rs(140) } }]);
    assert.equal(circuito.devanados.length, 0); assert.equal(circuito.mayorCorriente, null);
  });
  test('por devanado: primer mes con 2 h sobre el 100 % y en cuántos meses (provisionales cuentan)', () => {
    const ag = agregadosDeMeses([
      { mes: '2026-01', fila: { pct: 90, clase: 'firme', crg: 5, niveles: [nv('N13_8', 'S', 100, { pct: 90, pico: 99, sost: 95 })] }, r: { N13_8: rs(99) } },
      { mes: '2026-02', fila: { pct: 105, clase: 'provisional', crg: 5, sobrecargaProvisional: true, niveles: [nv('N13_8', 'S', 100, { pct: 105, pico: 130, sost: 120 })] }, r: { N13_8: rs(130) } },
      { mes: '2026-03', fila: { pct: 101, clase: 'firme', crg: 5, sobrecargaSostenida: true, niveles: [nv('N13_8', 'S', 100, { pct: 101, pico: 125, sost: 110 })] }, r: { N13_8: rs(125) } }]);
    const S = ag.devanados[0];
    assert.equal(S.primeraSost.mes, '2026-02'); assert.equal(S.primeraSost.clase, 'provisional');
    assert.equal(S.mesesSost, 2); assert.equal(S.mesesConDato, 3);
  });
  test('hitos de la curva de un mes: primera ventana de 2 h, primera hora suelta y máximo limpio con su rótulo', () => {
    const n = 744; const A = 100;
    const IR = new Float32Array(n).fill(50); IR[10] = 120; IR[200] = 130; IR[201] = 140; IR[300] = 900;   // 900 = imposible (> 3 × A)
    const fam = { IR: empaquetar({ v: IR, m: new Uint8Array(n), b: new Uint8Array(n).fill(1) }), IS: empaquetar({ v: new Float32Array(n).fill(40), m: new Uint8Array(n), b: new Uint8Array(n).fill(1) }) };
    const doc = { estado: 'ok', serie: { niveles: { N13_8: { kv: 13.8, fam: { IR: desempaquetar(fam.IR), IS: desempaquetar(fam.IS) } } } } };
    const h = hitosDeCurva(doc, '2026-03', 'N13_8', A);
    assert.equal(h.primeraHora, msRotulo('2026-03', 10));
    assert.equal(h.primeraSostenida, msRotulo('2026-03', 200));
    assert.equal(h.horasSostenidas, 2);
    assert.equal(Math.round(h.max.pct), 140); assert.equal(h.max.ms, msRotulo('2026-03', 201));   // el 900 imposible no cuenta
    assert.equal(hitosDeCurva({ estado: 'fallo' }, '2026-03', 'N13_8', A), null);
  });
});
