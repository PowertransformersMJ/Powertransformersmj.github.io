// Cargabilidad SCADA — UNIDAD DE RESERVA (propuesta aprobada por el Ingeniero 2026-10-28), con datos SINTÉTICOS («EstDemo»).
// Lo que se exige: solo con la marca en la decisión; un mes sin carga apreciable queda «en reserva» (sin cifra) y no cuenta
// para la firmeza de varios meses; un mes con carga cuenta como siempre; el detalle por rango hace lo mismo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { esUnidadReserva, mesEnReserva, MOTIVO_RESERVA, RESERVA } from '../assets/js/domain/scada_carga_reserva.js';
import { firmezaDelRango } from '../assets/js/domain/scada_carga_firmeza_rango.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';
import { recortarRango, ventanaDeMes, horasMes } from '../assets/js/domain/scada_carga_series.js';
import { FAMILIAS, CODIGO } from '../assets/js/domain/scada_carga_config.js';

describe('qué mes es de reserva', () => {
  const nv = (devanado, n, pct, horas, servicio) => ({ devanado, n, pct, horas, servicio });
  test('sin carga apreciable y un devanado sin horas válidas, fuera de servicio la mitad o más', () => {
    assert.equal(RESERVA.cargaMaxPct, 5);
    assert.equal(mesEnReserva([nv('P', 30, 1.2, 744, 744), nv('S', 0, null, 744, 120)]), true);
    assert.equal(mesEnReserva([nv('P', 0, null, 744, 744), nv('S', 0, null, 744, 300)]), true);
  });
  test('con carga, sin horas fuera de servicio, sin exporte o con una cifra que no se puede descartar: no', () => {
    assert.equal(mesEnReserva([nv('P', 470, 55.8, 744, 708), nv('S', 0, null, 744, 300)]), false, 'llevó carga');
    assert.equal(mesEnReserva([nv('P', 30, 1.2, 744, 744), nv('S', 0, null, 744, 600)]), false, 'S fuera de servicio menos de la mitad');
    assert.equal(mesEnReserva([nv('P', 0, null, 0, 0), nv('S', 0, null, 0, 0)]), false, 'no vino en el exporte');
    assert.equal(mesEnReserva([nv('P', 30, null, 744, 744), nv('S', 0, null, 744, 100)]), false, 'horas válidas sin cifra (escala)');
    assert.equal(mesEnReserva([]), false);
  });
  test('solo con la marca en una decisión «usar»', () => {
    assert.equal(esUnidadReserva({ decision: { tipo: 'usar', unidad_reserva: true } }), true);
    assert.equal(esUnidadReserva({ decision: { tipo: 'no_usar', unidad_reserva: true } }), false);
    assert.equal(esUnidadReserva({ decision: { tipo: 'usar', unidad_reserva: 'si' } }), false);
    assert.equal(esUnidadReserva(null), false);
  });
});

// ── Lista y periodo: dos niveles (110 kV → P, 13,8 kV → S) ────────────────────────────────────────────────────────────
const tx = { id: 'a', identificacion: { matricula: 'T3-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' },
  electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 105, corriente_nominal_secundaria_a: 836.7 } };
const cid = claveId('EstDemo1', 'swTrafo3');
const red = (x) => Math.round(x * 1000) / 1000;
function nivel(valores, horas, servicio) {
  const n = valores.length;
  const e = estadisticas(Float32Array.from(valores.length ? valores : [0]));
  const i = n ? { n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 }
    : { n: 0, p50: null, p95: null, p98: null, p99: null, max: null, iMax: -1, prom: null, unaFalta: 0 };
  return { i, sost: null, horas, servicio, des: horas - servicio, cob: servicio > 0 ? n / servicio : null, sMax: null, sP99: null, rUI: 1, uProm: 13.6,
    sP: 1, flujoInverso: 0, desde: 0, top: [...Float32Array.from([...valores].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
}
const serie = (a, n) => Array.from({ length: n }, (_, h) => Math.fround(a + (h % 20)));
const enServicio = () => ({ N110: nivel(serie(40, 500), 744, 708), N13_8: nivel(serie(400, 480), 744, 600) });
const enReserva = () => ({ N110: nivel(serie(1, 30).map((v) => Math.fround(1 + (v % 2))), 744, 744), N13_8: nivel([], 744, 120) });
function homologacion(extra) {
  const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T3-X/X-DM1', '/EstDemo1/swTrafo3']]).filas, null);
  const id = Object.keys(filas)[0];
  filas[id] = { ...filas[id], decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo3', mapa: { N110: 'P', N13_8: 'S' }, niveles_vistos: ['N110', 'N13_8'], nota: 'unidad de reserva', avisos_vistos: [], ...extra } };
  return { filas };
}
const meses = ['2026-06', '2026-07', '2026-08'];
const catalogo = { meses: Object.fromEntries(meses.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N110: {}, N13_8: {} }, meses } } };
const resumenes = { '2026-06': { mes: '2026-06', claves: { [cid]: enReserva() } }, '2026-07': { mes: '2026-07', claves: { [cid]: enReserva() } }, '2026-08': { mes: '2026-08', claves: { [cid]: enServicio() } } };
const lista = (h, m) => filasLista({ parque: [tx], homologacion: h, catalogo, resumenMes: resumenes[m] })[0];
const periodo = (h) => {
  const fpm = Object.fromEntries(meses.map((m) => [m, filasLista({ parque: [tx], homologacion: h, catalogo, resumenMes: resumenes[m] })]));
  return filasPeriodo({ parque: [tx], homologacion: h, catalogo, meses, resumenes, filasPorMes: fpm })[0];
};

describe('mes y periodo de una unidad de reserva', () => {
  test('con la marca: el mes en reserva queda sin cifra «en reserva»; el mes en servicio, igual que siempre', () => {
    const h = homologacion({ unidad_reserva: true });
    const jun = lista(h, '2026-06');
    assert.equal(jun.pct, null); assert.equal(jun.motivoNulo, MOTIVO_RESERVA); assert.equal(jun.enReserva, true);
    const ago = lista(h, '2026-08');
    assert.equal(ago.enReserva, undefined); assert.equal(ago.firme, true);
    assert.equal(ago.pct, lista(homologacion({}), '2026-08').pct);
  });
  test('sin la marca: el mes de reserva da su cifra de ruido, provisional, como antes', () => {
    const jun = lista(homologacion({}), '2026-06');
    assert.equal(jun.enReserva, undefined);
    assert.ok(jun.pct != null && jun.pct < 5);
  });
  test('el periodo no cuenta los meses en reserva: firme con la marca, provisional sin ella; la MISMA cifra', () => {
    const con = periodo(homologacion({ unidad_reserva: true }));
    const sin = periodo(homologacion({}));
    assert.equal(con.firme, true, con.motivos.join('; '));
    assert.equal(sin.firme, false);
    assert.equal(con.pct, sin.pct);
    const p = con.devanados.find((d) => d.d === 'P');
    assert.equal(p.mesesTotal, 1); assert.equal(p.mesesMedidos, 1);
  });
});

// ── Detalle: el rango de meses completos cuenta igual ───────────────────────────────────────────────────────────────
function curvas(mes, ok, valor, kv) {
  const n = horasMes(mes); const fam = {};
  for (const f of FAMILIAS) {
    const v = new Float32Array(n).fill(NaN); const m = new Uint8Array(n).fill(CODIGO.SIN_ARCHIVO); const b = new Uint8Array(n);
    const esI = f[0] === 'I';
    for (let h = 0; h < n; h++) {
      const s = ok(h); const i = valor(h);
      if (s === 'v') { v[h] = esI ? Math.fround(i) : (f === 'P' ? Math.sqrt(3) * kv * i / 1000 : f === 'Q' ? 0 : kv); m[h] = CODIGO.VALIDO; }
      else if (s === 'd') { v[h] = esI ? 0 : kv; m[h] = esI ? CODIGO.DESENERGIZADO : CODIGO.VALIDO; }
    }
    fam[f] = { v, m, b };
  }
  return fam;
}
test('detalle: con la marca, el mes en reserva no cuenta en el rango', () => {
  const m = ['2026-07', '2026-08'];
  const p = { '2026-07': curvas('2026-07', (h) => (h < 30 ? 'v' : 'd'), (h) => 1 + (h % 2), 110), '2026-08': curvas('2026-08', () => 'v', (h) => 40 + (h % 20), 110) };
  const s = { '2026-07': curvas('2026-07', () => 'd', () => 0, 13.8), '2026-08': curvas('2026-08', () => 'v', (h) => 400 + (h % 20), 13.8) };
  const desde = ventanaDeMes(m[0]).desde; const hasta = ventanaDeMes(m[1]).hasta;
  const rec = (x) => recortarRango(Object.fromEntries(m.map((k) => [k, { estado: 'ok', series: x[k] }])), FAMILIAS, desde, hasta);
  const recs = { N110: rec(p), N13_8: rec(s) };
  const niveles = [{ nivel: 'N110', devanado: 'P', A: 105 }, { nivel: 'N13_8', devanado: 'S', A: 836.7 }];
  const sin = firmezaDelRango(recs, niveles, m, desde);
  const con = firmezaDelRango(recs, niveles, m, desde, {}, { reserva: true });
  assert.equal(sin.P.mesesTotal, 2); assert.equal(sin.P.mesesMedidos, 2);
  assert.equal(con.P.mesesTotal, 1); assert.equal(con.P.mesesMedidos, 1);
});

test('el detalle y el diálogo «Revisar» usan la marca (y el diálogo la conserva)', () => {
  const d = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(d, /\{ reserva: esUnidadReserva\(a\.fila\) \}/);
  const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
  assert.match(h, /decision\.unidad_reserva = true;/);
});
