// Cargabilidad SCADA — resguardos de la firmeza por el devanado que da la cifra (revisión adversarial 2026-10-27), con
// datos SINTÉTICOS («EstDemo»). Lo que se exige: en un tridevanado, el devanado que mide la carga también mide bien; lo
// que solo muestra un devanado que mide poco no se da por firme; los días que el parque aún no cargó y los meses fuera de
// servicio no son hueco; el detalle cuenta por meses solo en rangos de meses completos y cuenta igual que la lista.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firmeza, estadisticas, resumenFisico } from '../assets/js/domain/scada_carga_kpis.js';
import { firmezaDeMeses } from '../assets/js/domain/scada_carga_firmeza_periodo.js';
import { esDeMesesCompletos, recortarMes, firmezaDelRango } from '../assets/js/domain/scada_carga_firmeza_rango.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS, resumirParaGuardar } from '../assets/js/domain/scada_carga_importacion.js';
import { recortarRango, ventanaDeMes, horasMes, mesesDelRango } from '../assets/js/domain/scada_carga_series.js';
import { FAMILIAS, NIVELES, CODIGO } from '../assets/js/domain/scada_carga_config.js';

const base = { estadoHomologacion: 'automatica', esCircuito: false, mesesFallidos: [] };
const dos = { P: { kv: 34.5, A: 300 }, S: { kv: 13.8, A: 800 }, T: { kv: null, A: null } };
const tres = { P: { kv: 110, A: 200 }, S: { kv: 34.5, A: 600 }, T: { kv: 13.8, A: 800 } };
const dev = (d, pct, cobertura, n = 600, extra = {}) => ({ d, A: 500, pct, cobertura, n, escala: 'ok', unaFalta: 0, ...extra });

describe('firmeza: resguardos', () => {
  test('tridevanado: si la cifra sale del secundario, el primario (que lleva la carga) también tiene que medir bien', () => {
    const mal = firmeza({ ...base, placa: tres, devanados: [dev('P', 40, 0.05, 30), dev('S', 70, 0.9)] });
    assert.deepEqual(mal.motivos, ['el devanado que lleva la carga mide poco']);
    assert.equal(firmeza({ ...base, placa: tres, devanados: [dev('P', 40, 0.9), dev('S', 70, 0.9)] }).firme, true);
    // Secundario y terciario bien medidos también miden la carga; con el terciario mal medido, no.
    assert.equal(firmeza({ ...base, placa: tres, devanados: [dev('S', 70, 0.9), dev('T', 50, 0.9)] }).firme, true);
    assert.ok(firmeza({ ...base, placa: tres, devanados: [dev('S', 70, 0.9), dev('T', 50, 0.1, 40)] }).motivos.includes('el devanado que lleva la carga mide poco'));
  });
  test('dos devanados: lo de siempre con la regla nueva (el otro mal medido no la vuelve provisional)', () => {
    assert.equal(firmeza({ ...base, placa: dos, devanados: [dev('P', 60, 0.05, 30), dev('S', 70, 0.9)] }).firme, true);
  });
  test('una sobrecarga que solo muestra el devanado que mide poco deja la cifra provisional', () => {
    const f = firmeza({ ...base, placa: dos, devanados: [dev('P', 93, 0.9, 600, { sobre: 0 }), dev('S', 80, 0.42, 300, { sobre: 1 })] });
    assert.deepEqual(f.motivos, ['sobrecarga que solo muestra un devanado que mide poco']);
    // Si el bien medido también la muestra, la confirma: firme (así siguen La Ye, Simaña y San Marcos con datos reales).
    assert.equal(firmeza({ ...base, placa: dos, devanados: [dev('P', 93, 0.9, 600, { sobre: 1 }), dev('S', 80, 0.42, 300, { sobre: 1 })] }).firme, true);
    // Severa (la de R4) solo en el mal medido: provisional aunque el bien medido muestre una sostenida menor.
    assert.equal(firmeza({ ...base, placa: dos, devanados: [dev('P', 93, 0.9, 600, { sobre: 1 }), dev('S', 80, 0.42, 300, { sobre: 2 })] }).firme, false);
    // Un módulo viejo que no trae `sobre` no inventa el motivo.
    assert.equal(firmeza({ ...base, placa: dos, devanados: [dev('P', 93, 0.9), dev('S', 80, 0.42, 300)] }).firme, true);
  });
});

describe('cobertura en los meses en que midió: horas en servicio, días sin cargar y meses fuera de servicio', () => {
  test('usa las horas en servicio del resumen menos los días que el parque aún no cargó', () => {
    const r = firmezaDeMeses([{ n: 600, cob: 600 / 720, servicio: 720 }, { n: 100, cob: 100 / 744, servicio: 744, fuera: 600 }]);
    assert.equal(r.mesesMedidos, 2); assert.equal(r.mesesSinServicio, 0);
    assert.ok(Math.abs(r.coberturaFirmeza - 700 / (720 + 144)) < 1e-12);
  });
  test('un mes desenergizado todo el mes no cuenta (no había nada que medir); uno que no vino en el exporte sí', () => {
    const r = firmezaDeMeses([{ n: 700, cob: 1, servicio: 700, horas: 720 }, { n: 0, cob: null, servicio: 0, horas: 720 }, { n: 0, cob: null, servicio: 0, horas: 744 }, null]);
    assert.deepEqual({ ...r, coberturaFirmeza: Math.round(r.coberturaFirmeza * 1e6) / 1e6 }, { coberturaFirmeza: 1, mesesMedidos: 1, mesesSinServicio: 2 });
    // Sin horas (el punto no vino en el exporte) o sin saber cuántas: es un mes en que no midió.
    assert.equal(firmezaDeMeses([{ n: 0, cob: null, servicio: 0, horas: 0 }, { n: 0, cob: null, servicio: 0 }]).mesesSinServicio, 0);
  });
  test('con las horas en servicio no se infla el mes por la cobertura redondeada', () => {
    assert.equal(firmezaDeMeses([{ n: 1, cob: 0.001, servicio: 744 }]).coberturaFirmeza, 1 / 744);
  });
});

// ── Periodo de la lista con datos sintéticos de UN nivel (13,8 kV → secundario) ─────────────────────────────────────
const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
const cid = claveId('EstDemo1', 'swTrafo1');
const red = (x) => Math.round(x * 1000) / 1000;
const serie = (a, n) => Array.from({ length: n }, (_, h) => Math.fround(a + (h % 40)));
/** Resumen de un nivel con `horas` del mes, `servicio` y `n` horas válidas (n = 0 → sin horas válidas). */
function nivelR(n, horas, servicio = horas) {
  const v = serie(400, Math.max(n, 1));
  const e = estadisticas(Float32Array.from(v));
  const i = n > 0 ? { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 }
    : { n: 0, p50: null, p95: null, p98: null, p99: null, max: null, iMax: -1, prom: null, unaFalta: 0 };
  return { i, sost: null, horas, servicio, des: horas - servicio, cob: servicio > 0 ? Math.round((i.n / servicio) * 1000) / 1000 : null, sMax: null, sP99: null,
    rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0, top: n > 0 ? [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] : [] };
}
function periodoDe(meses, porMes, catMeses) {
  const catalogo = { meses: catMeses || Object.fromEntries(meses.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses } } };
  const resumenes = Object.fromEntries(meses.map((m) => [m, { mes: m, claves: porMes[m] ? { [cid]: { N13_8: porMes[m] } } : {} }]));
  const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: resumenes[m] })]));
  return filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses, resumenes, filasPorMes: fpm })[0];
}

describe('periodo de la lista: resguardos', () => {
  test('un mes a medio cargar no cuenta sus días sin cargar como hueco (igual que la cobertura del periodo)', () => {
    // Enero completo al 55 %; febrero cargado 7 de 28 días, al 55 % de lo cargado (el resumen trae el mes entero en servicio).
    const p = periodoDe(['2026-01', '2026-02'], { '2026-01': nivelR(409, 744), '2026-02': nivelR(92, 672) },
      { '2026-01': { completo: true }, '2026-02': { completo: false, dias: '1'.repeat(7) + '0'.repeat(21) } });
    const s = p.devanados.find((d) => d.d === 'S');
    assert.ok(Math.abs(s.coberturaFirmeza - s.cobertura) < 0.002, s.coberturaFirmeza + ' vs ' + s.cobertura);
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
  test('los meses fuera de servicio no cuentan como meses en que no midió', () => {
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    const porMes = Object.fromEntries(meses.map((m, k) => [m, k < 2 ? nivelR(700, 720) : nivelR(0, 720, 0)]));
    const p = periodoDe(meses, porMes);
    const s = p.devanados.find((d) => d.d === 'S');
    assert.equal(s.mesesMedidos, 2); assert.equal(s.mesesTotal, 2);
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
  test('los meses que NO vinieron en el exporte sí cuentan como meses en que no midió', () => {
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const porMes = Object.fromEntries(meses.map((m, k) => [m, k < 2 ? nivelR(700, 720) : nivelR(0, 0, 0)]));
    const p = periodoDe(meses, porMes);
    const s = p.devanados.find((d) => d.d === 'S');
    assert.equal(s.mesesMedidos, 2); assert.equal(s.mesesTotal, 5);
    assert.ok(p.motivos.includes('midió menos de la mitad de los meses'), p.motivos.join('; '));
  });
  test('la frontera: midió exactamente la mitad de los meses → firme', () => {
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04'];
    const p = periodoDe(meses, { '2026-01': nivelR(700, 720), '2026-02': nivelR(700, 720) });
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
});

describe('sobrecarga en el devanado que mide poco (lista de un mes)', () => {
  const nivelS = (v, n, sost, horas = 720) => {
    const e = estadisticas(Float32Array.from(v));
    return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 },
      sost: sost == null ? null : { v: sost, idx: 0 }, horas, servicio: horas, des: 0, cob: n / horas, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1,
      flujoInverso: 0, desde: 0, top: [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
  };
  const catalogo = { meses: { '2026-01': { completo: true } }, puntos: { [cid]: { niveles: { N34_5: {}, N13_8: {} }, meses: ['2026-01'] } } };
  const fila = (sostP, sostS) => filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: { mes: '2026-01', claves: { [cid]: {
    N34_5: nivelS(serie(160, 650), 650, sostP), N13_8: nivelS(serie(400, 216), 216, sostS) } } } })[0];
  test('el secundario mal medido muestra 2 h sobre el 100 % y el primario (la cifra) no: provisional, sobrecarga posible', () => {
    const x = fila(null, 850);
    assert.equal(x.devMax, 'P');
    assert.ok(x.motivos.includes('sobrecarga que solo muestra un devanado que mide poco'), x.motivos.join('; '));
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.sobrecargaProvisional, true);
  });
  test('si el primario bien medido también la muestra, la cifra es firme y la sobrecarga también', () => {
    const x = fila(310, 850);
    assert.equal(x.firme, true, x.motivos.join('; ')); assert.equal(x.sobrecargaSostenida, true);
  });
  test('sin sobrecarga en ninguno: firme (la regla del devanado que da la cifra)', () => {
    assert.equal(fila(null, null).firme, true);
  });
});

// ── Detalle: el corte por mes y la cuenta por meses, contra la lista ────────────────────────────────────────────────
/** Curvas de UN nivel de UN mes: `ok(h)` → 'v' válido · 'd' desenergizado · otro → sin archivo. */
function serieNivel(mes, ok, i0, kv) {
  const n = horasMes(mes); const fam = {};
  for (const f of FAMILIAS) {
    const v = new Float32Array(n).fill(NaN); const m = new Uint8Array(n).fill(CODIGO.SIN_ARCHIVO); const b = new Uint8Array(n);
    const esI = f[0] === 'I';
    for (let h = 0; h < n; h++) {
      const s = ok(h);
      if (s === 'v') { v[h] = esI ? Math.fround(i0 + (h % 37)) : (f === 'P' ? Math.sqrt(3) * kv * (i0 + (h % 37)) / 1000 : f === 'Q' ? 0 : kv); m[h] = CODIGO.VALIDO; }
      else if (s === 'd') { v[h] = esI ? 0 : kv; m[h] = esI ? CODIGO.DESENERGIZADO : CODIGO.VALIDO; }
    }
    fam[f] = { v, m, b };
  }
  return fam;
}

describe('detalle: firmeza de un rango de meses completos', () => {
  const meses = ['2026-02', '2026-03', '2026-04'];
  // 13,8 kV: febrero entero, marzo solo la primera semana, abril fuera de servicio todo el mes.
  const ok = { '2026-02': () => 'v', '2026-03': (h) => (h < 168 ? 'v' : null), '2026-04': () => 'd' };
  const series = Object.fromEntries(meses.map((m) => [m, serieNivel(m, ok[m], 400, 13.8)]));
  const desde = ventanaDeMes(meses[0]).desde; const hasta = ventanaDeMes(meses[2]).hasta;
  const rec = recortarRango(Object.fromEntries(meses.map((m) => [m, { estado: 'ok', series: series[m] }])), FAMILIAS, desde, hasta);

  test('solo los rangos de meses completos cuentan por meses', () => {
    assert.equal(esDeMesesCompletos(desde, hasta, mesesDelRango(desde, hasta)), true);
    assert.equal(esDeMesesCompletos(desde + 3600e3, hasta, mesesDelRango(desde + 3600e3, hasta)), false);
    assert.equal(esDeMesesCompletos(desde, hasta - 3600e3, mesesDelRango(desde, hasta - 3600e3)), false);
  });
  test('el corte de cada mes es hora a hora el mismo que recortar ese mes solo', () => {
    for (const m of meses) {
      const w = ventanaDeMes(m);
      const solo = recortarRango({ [m]: { estado: 'ok', series: series[m] } }, FAMILIAS, w.desde, w.hasta);
      const corte = recortarMes(rec, m, desde);
      for (const f of FAMILIAS) { assert.deepEqual([...corte[f].m], [...solo.fam[f].m], m + ' ' + f); }
    }
    assert.equal(recortarMes(rec, '2026-05', desde), null);
  });
  test('cuenta igual que la lista por periodo (mismos resúmenes del importador)', () => {
    const fr = firmezaDelRango({ N13_8: rec }, [{ nivel: 'N13_8', devanado: 'S' }], meses, desde);
    const resumen = (m) => resumirParaGuardar(resumenFisico(series[m], NIVELES.N13_8.kv), series[m]);
    const lista = firmezaDeMeses(meses.map((m) => { const r = resumen(m); return { n: r.i.n, cob: r.cob, servicio: r.servicio }; }));
    assert.equal(fr.S.mesesMedidos, 2); assert.equal(fr.S.mesesTotal, 2, 'abril fuera de servicio no cuenta');
    assert.equal(fr.S.mesesMedidos, lista.mesesMedidos);
    assert.ok(Math.abs(fr.S.coberturaFirmeza - lista.coberturaFirmeza) < 1e-12);
    assert.equal(firmezaDelRango({ N13_8: rec }, [{ nivel: 'N13_8', devanado: 'S' }], ['2026-02'], desde), null, 'un solo mes: la firmeza de siempre');
  });
  test('el detalle la aplica solo en meses completos, descuenta los días sin cargar y avisa si falla', () => {
    const d = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(d, /if \(esDeMesesCompletos\(desde, hasta, mesesRango\)\)/);
    assert.match(d, /firmezaDelRango\(recs, previo\.niveles, mesesCargados, desde, horasNoCargadas\(ctx\.catalogo, mesesCargados\)\)/);
    assert.match(d, /console\.warn\('\[cargabilidad-scada\] firmeza del rango', e\)/);
  });
});
