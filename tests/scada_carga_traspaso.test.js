// Cargabilidad SCADA — EQUIPOS QUE PASARON A OTRO OPERADOR (dato del Ingeniero 2026-10-28: la zona Oriente la opera ENERGUA
// (Energía Atenea) desde el 1-sep-2026), con datos SINTÉTICOS («EstDemo»). Lo que se exige: un mes desde el traspaso queda sin
// cifra con su motivo; el periodo de esos equipos llega hasta el último mes que los operó AFINIA (sep–oct no son meses «sin
// medir»); el resto del parque no cambia; la lista y el detalle lo dicen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRASPASOS, traspasoDe, mesDeOtroOperador, mesesAntesDelTraspaso, puntoAntesDelTraspaso, motivoTraspaso, textoTraspaso, ultimoMesDeAfinia
} from '../assets/js/domain/scada_carga_traspaso.js';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';
import { serieMensualEquipo } from '../assets/js/domain/scada_carga_mensual.js';
import { decisionConCambio } from '../assets/js/domain/scada_carga_cambio_medida.js';

const T = TRASPASOS[0];
const txZona = (zona) => ({ id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } });

describe('la regla', () => {
  test('el traspaso del Ingeniero: zona Oriente desde sep-2026, a ENERGUA (Energía Atenea)', () => {
    assert.deepEqual({ ...T }, { zona: 'ORIENTE', desde: '2026-09', operador: 'ENERGUA (Energía Atenea)' });
  });
  test('aplica por la zona del parque (sin importar mayúsculas, tildes ni espacios); otras zonas, nada', () => {
    assert.equal(traspasoDe(txZona('ORIENTE')), T);
    assert.equal(traspasoDe(txZona(' Oriente ')), T);
    assert.equal(traspasoDe(txZona('OCCIDENTE')), null);
    assert.equal(traspasoDe(txZona('BOLIVAR')), null);
    assert.equal(traspasoDe({}), null);
  });
  test('un mes es de otro operador desde el mes del traspaso', () => {
    assert.equal(mesDeOtroOperador(txZona('ORIENTE'), '2026-08'), null);
    assert.equal(mesDeOtroOperador(txZona('ORIENTE'), '2026-09'), T);
    assert.equal(mesDeOtroOperador(txZona('ORIENTE'), '2026-10'), T);
    assert.equal(mesDeOtroOperador(txZona('OCCIDENTE'), '2026-10'), null);
    assert.equal(mesDeOtroOperador(txZona('ORIENTE'), null), null);
  });
  test('recortes y textos', () => {
    assert.deepEqual(mesesAntesDelTraspaso(T, ['2026-07', '2026-08', '2026-09', '2026-10']), ['2026-07', '2026-08']);
    assert.deepEqual(mesesAntesDelTraspaso(null, ['2026-09']), ['2026-09']);
    assert.deepEqual(puntoAntesDelTraspaso({ clave: 'x', meses: ['2026-08', '2026-09'] }, T), { clave: 'x', meses: ['2026-08'] });
    const p = { meses: ['2026-09'] };
    assert.equal(puntoAntesDelTraspaso(p, null), p);
    assert.equal(motivoTraspaso(T), 'desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)');
    assert.equal(textoTraspaso(T), 'Periodo hasta ago-2026: desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)');
    assert.equal(ultimoMesDeAfinia(T), '2026-08');
  });
});

// ── Lista del mes y periodo con UN nivel (13,8 kV → secundario, ampacidad 800 A) ─────────────────────────────────────
const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
const cid = claveId('EstDemo1', 'swTrafo1');
const red = (x) => Math.round(x * 1000) / 1000;
function nivelR(n) {
  const v = Array.from({ length: Math.max(n, 1) }, (_, h) => Math.fround(400 + (h % 40)));
  const e = estadisticas(Float32Array.from(v));
  const i = n > 0 ? { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 }
    : { n: 0, p50: null, p95: null, p98: null, p99: null, max: null, iMax: -1, prom: null, unaFalta: 0 };
  return { i, sost: null, horas: 720, servicio: 720, des: 0, cob: Math.round((n / 720) * 1000) / 1000, sMax: null, sP99: null,
    rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0, top: n > 0 ? [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] : [] };
}
const MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
function periodo(tx, porMes, meses = MESES) {
  const conDatos = meses.filter((m) => porMes[m]);
  const catalogo = { meses: Object.fromEntries(meses.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: conDatos } } };
  const resumenes = Object.fromEntries(meses.map((m) => [m, { mes: m, claves: porMes[m] ? { [cid]: { N13_8: porMes[m] } } : {} }]));
  const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: resumenes[m] })]));
  return { fpm, p: filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses, resumenes, filasPorMes: fpm })[0] };
}
// Como Santa Teresa: midió bien ene–abr; jun–ago casi nada; sep–oct no vino (ya lo opera otra empresa).
const santaTeresa = Object.fromEntries(MESES.map((m, k) => [m, k < 4 ? nivelR(600) : (k < 7 ? nivelR(20) : null)]));

describe('el mes y el periodo', () => {
  test('un mes desde el traspaso: sin cifra, con el motivo del otro operador (aunque traiga horas del 1-sep)', () => {
    const { fpm } = periodo(txZona('ORIENTE'), { ...santaTeresa, '2026-09': nivelR(48) });
    const s = fpm['2026-09'][0];
    assert.equal(s.pct, null); assert.equal(s.clase, 'nulo');
    assert.equal(s.motivoNulo, 'desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)');
    assert.equal(s.traspaso, T);
    assert.equal(s.sobrecargaSostenida, false);
    // Antes del traspaso, el mes de siempre.
    assert.equal(fpm['2026-01'][0].clase, 'firme');
    assert.equal(fpm['2026-01'][0].traspaso, undefined);
  });
  test('el periodo de la zona Oriente llega hasta agosto: firme con 4 de 7 meses (antes, 4 de 9 → provisional)', () => {
    const { p } = periodo(txZona('ORIENTE'), santaTeresa);
    assert.equal(p.firme, true, p.motivos.join('; '));
    assert.deepEqual(p.traspaso.meses, MESES.slice(0, 7));
    assert.deepEqual(p.periodo.meses, MESES.slice(0, 7));
    const s = p.devanados.find((d) => d.d === 'S');
    assert.equal(s.mesesTotal, 7);
  });
  test('el mismo equipo en otra zona: sep–oct sí son meses en que no midió (como siempre)', () => {
    const { p } = periodo(txZona('OCCIDENTE'), santaTeresa);
    assert.equal(p.firme, false);
    assert.ok(p.motivos.includes('midió menos de la mitad de los meses'), p.motivos.join('; '));
    assert.equal(p.traspaso, undefined);
  });
  test('un periodo que cae entero después del traspaso: sin cifra, con su motivo', () => {
    const { p } = periodo(txZona('ORIENTE'), { '2026-09': nivelR(48), '2026-10': null }, ['2026-09', '2026-10']);
    assert.equal(p.pct, null); assert.equal(p.clase, 'nulo');
    assert.equal(p.motivoNulo, 'desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)');
    assert.deepEqual(p.traspaso.meses, []);
  });
  test('un periodo que termina antes del traspaso no lleva nota (nada se recortó)', () => {
    const { p } = periodo(txZona('ORIENTE'), santaTeresa, MESES.slice(0, 7));
    assert.equal(p.traspaso, undefined);
  });
});

test('pantallas: la lista y el detalle lo dicen (lo que no corre en Node queda en el código)', () => {
  const l = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
  assert.match(l, /if \(x\.traspaso && Array\.isArray\(x\.traspaso\.meses\) && x\.pct != null\) td\.append\(el\('span', \{ class: 'cs-sub' \}, textoTraspaso\(x\.traspaso\)\)\);/);
  assert.match(l, /mes >= x\.traspaso\.desde\) return el\('i', \{ class: 'cs-tira-mes cs-tira--vacio', title: nombreMes\(mes\) \+ ': ' \+ motivoTraspaso\(x\.traspaso\) \}\);/);
  const d = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(d, /const punto = puntoAntesDelTraspaso\(/);
  assert.match(d, /const corte = porTraspaso \? ventanaDeMes\(ultimoMesDeAfinia\(tras\)\)\.hasta : null;/);
  assert.match(d, /cand\.hasta = corte;/);
  assert.match(d, /const mesCfg = tras && \(!mesPedido \|\| mesPedido >= tras\.desde\) \? ultimoMesDeAfinia\(tras\) : mesPedido;/);
  assert.match(l, /'Cambio_de_medida', 'Otro_operador'\],/);
  assert.equal((l.match(/csvCambio\(x\), csvOperador\(x\)\]/g) || []).length, 2, 'los dos CSV llevan la columna nueva al final');
});

describe('revisión adversarial 2026-10-28', () => {
  test('mes a mes y acumulado: desde el traspaso, sin acumulado ni promedio y con su motivo; agosto queda igual', () => {
    const tx = txZona('ORIENTE');
    const porMes = { ...santaTeresa, '2026-09': nivelR(48) };
    const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: MESES.filter((m) => porMes[m]) } } };
    const resumenes = Object.fromEntries(MESES.map((m) => [m, { mes: m, claves: porMes[m] ? { [cid]: { N13_8: porMes[m] } } : {} }]));
    const serie = serieMensualEquipo({ tx, homologacion: { filas }, catalogo, punto: catalogo.puntos[cid], resumenes });
    const de = (m) => serie.find((x) => x.mes === m);
    for (const m of ['2026-09', '2026-10']) {
      assert.equal(de(m).acumulado.pct, null, m);
      assert.equal(de(m).acumulado.motivoNulo, 'desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)');
      assert.equal(de(m).acumulado.nMeses, 0);
      assert.equal(de(m).promedio.pct, null);
      assert.equal(de(m).mensual.pct, null);
    }
    assert.equal(de('2026-08').acumulado.firme, true);
    assert.equal(de('2026-08').acumulado.nMeses, 7);
    // «A la fecha» = la última con acumulado: agosto, no octubre.
    assert.equal([...serie].reverse().find((x) => x.acumulado.pct != null).mes, '2026-08');
  });
  test('un mes del otro operador no cuenta sobrecarga, tampoco la «posible» de un circuito sin confirmar', () => {
    const { filas: fc } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/CIR301']]).filas, null);
    const cidC = claveId('EstDemo1', 'CIR301');
    const sost = { ...nivelR(48), sost: { v: 1100, idx: 0 } };
    const catalogo = { meses: { '2026-09': { completo: true } }, puntos: { [cidC]: { niveles: { N13_8: {} }, meses: ['2026-09'] } } };
    const fila = (zona) => filasLista({ parque: [txZona(zona)], homologacion: { filas: fc }, catalogo, resumenMes: { mes: '2026-09', claves: { [cidC]: { N13_8: sost } } } })[0];
    assert.equal(fila('ORIENTE').sobrecarga, null);
    assert.ok(fila('OCCIDENTE').sobrecarga, 'en otra zona, la de siempre');
  });
  test('cambio de medida vigente desde el traspaso: el periodo usa la configuración del último mes de AFINIA', () => {
    const { filas: f0 } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
    const id = Object.keys(f0)[0];
    const base = { ...f0[id], decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo1', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'demo', avisos_vistos: [] } };
    const fc = { [id]: { ...base, decision: decisionConCambio(base, { hasta: '2026-08', antes: 'actual', nota: 'antes por el interruptor',
      nueva: { tipo: 'usar', clave: '/EstDemo1/DEM302', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'desde sep por el circuito', avisos_vistos: [] } }) } };
    const cidC = claveId('EstDemo1', 'DEM302');
    const porMes = Object.fromEntries(MESES.map((m, k) => [m, k < 7 ? { [cid]: { N13_8: nivelR(600) } } : { [cidC]: { N13_8: nivelR(600) } }]));
    const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])),
      puntos: { [cid]: { niveles: { N13_8: {} }, meses: MESES.slice(0, 7) }, [cidC]: { niveles: { N13_8: {} }, meses: MESES.slice(7) } } };
    const resumenes = Object.fromEntries(MESES.map((m) => [m, { mes: m, claves: porMes[m] }]));
    const per = (zona) => {
      const tx = txZona(zona);
      const fpm = Object.fromEntries(MESES.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas: fc }, catalogo, resumenMes: resumenes[m] })]));
      return filasPeriodo({ parque: [tx], homologacion: { filas: fc }, catalogo, meses: MESES, resumenes, filasPorMes: fpm })[0];
    };
    const p = per('ORIENTE');
    assert.ok(p.pct != null, 'tiene cifra: ' + p.motivoNulo);
    assert.deepEqual(p.periodo.meses, MESES.slice(0, 7));
    assert.equal(p.claveId, cid, 'la medida de antes del cambio, la que operó AFINIA');
  });
});
