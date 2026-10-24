// Cargabilidad SCADA — la prueba de relación entre niveles (RELACION_NIVELES) solo vale si TODA la corriente pasa de un
// lado al otro. Datos SINTÉTICOS con cifras parecidas a las medidas (sin nombres reales).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relacionNiveles, avisosFila, estadoEfectivo, conteosHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';

const pl = (P, S, T) => ({ P: { kv: P[0], A: P[1] }, S: { kv: S[0], A: S[1] }, T: { kv: T[0], A: T[1] } });
const r = (p50) => ({ i: { p50 } });

test('dos devanados sanos (34,5/13,8): aplica y pasa', () => {
  assert.equal(relacionNiveles({ N34_5: r(100), N13_8: r(250) }, { N34_5: 'P', N13_8: 'S' }, pl([34.5, 66.9], [13.8, 167.3], [null, null])).ok, true);
});
test('dos devanados con una entrada común a dos equipos (1,61 frente a 2,50): falla, como hoy', () => {
  assert.equal(relacionNiveles({ N34_5: r(119.278), N13_8: r(192.476) }, { N34_5: 'P', N13_8: 'S' }, pl([34.5, 108.7], [13.8, 271.9], [null, null])).ok, false);
});
test('dos devanados sin ampacidad en la placa: sigue aplicando', () => {
  assert.equal(relacionNiveles({ N34_5: r(58.6), N13_8: r(67.9) }, { N34_5: 'P', N13_8: 'S' }, pl([34.5, null], [13.8, null], [null, null])).ok, false);
});
test('tres devanados con secundario y terciario medidos (el terciario genera): no aplica', () => {
  assert.equal(relacionNiveles({ N34_5: r(324.336), N13_8: r(98.747) }, { N34_5: 'S', N13_8: 'T' }, pl([66, 419.9], [34.5, 401.6], [13.8, 1004.1])), null);
});
test('tres devanados con primario y secundario medidos y el terciario con carga sin medir: no aplica', () => {
  assert.equal(relacionNiveles({ N110: r(234.064), N34_5: r(406.964) }, { N110: 'P', N34_5: 'S' }, pl([110, 314.9], [34.5, 502.4], [13.8, 1464.3])), null);
});
test('terciario de estabilización o sin ampacidad en la plataforma (kV sin A): sigue aplicando (aviso conservador)', () => {
  assert.equal(relacionNiveles({ N110: r(100), N13_8: r(797) }, { N110: 'P', N13_8: 'S' }, pl([110, 300], [13.8, 2091.7], [13.8, null])).ok, true);
  assert.equal(relacionNiveles({ N110: r(100), N13_8: r(797) }, { N110: 'P', N13_8: 'S' }, pl([110, 300], [13.8, 2091.7], [13.8, 0])).ok, true, 'ampacidad 0 = sin dato');
});
test('terciario con ampacidad pero sin kV en la plataforma: sigue aplicando (falta el dato, no se adivina)', () => {
  assert.equal(relacionNiveles({ N220: r(100), N110: r(200) }, { N220: 'P', N110: 'S' }, pl([220, 393.6], [110, 783.3], [null, 2091.8])).ok, true);
});
test('dos niveles en el MISMO devanado (mapa decidido): no aplica', () => {
  assert.equal(relacionNiveles({ N34_5: r(100), N13_8: r(250) }, { N34_5: 'S', N13_8: 'S' }, pl([66, 100], [34.5, 200], [null, null])), null);
});
test('tres niveles medidos: no aplica (como hoy)', () => {
  assert.equal(relacionNiveles({ N110: r(1), N34_5: r(1), N13_8: r(1) }, { N110: 'P', N34_5: 'S', N13_8: 'T' }, pl([110, 1], [34.5, 1], [13.8, 1])), null);
});
test('fila de tres devanados: sin RELACION_NIVELES queda automática; una confirmada que ya lo vio sigue confirmada', () => {
  const tx = { electrico: { tension_primaria_kv: 66, tension_secundaria_kv: 34.5, tension_terciaria_kv: 13.8, corriente_nominal_primaria_a: 419.9, corriente_nominal_secundaria_a: 401.6, corriente_nominal_terciaria_a: 1004.1 } };
  const fila = { matricula: 'T1-X/X-DM1', subestacion: 'DEMO UNO', clave_excel: '/EstDemo1/swTrafo1', decision: null };
  const ctx = { ...conteosHomologacion({ a: fila }), tx, punto: { niveles: { N34_5: {}, N13_8: {} } }, resumenPorNivel: { N34_5: r(324.336), N13_8: r(98.747) } };
  const a = avisosFila(fila, ctx);
  assert.deepEqual(a.avisos, ['DEVANADO_SIN_MEDIDA']);
  assert.equal(estadoEfectivo(fila, a.avisos), 'automatica');
  const conf = { ...fila, decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo1', mapa: { N34_5: 'S', N13_8: 'T' }, niveles_vistos: ['N34_5', 'N13_8'], avisos_vistos: ['RELACION_NIVELES'], clave_excel_vista: '/EstDemo1/swTrafo1' } };
  assert.equal(estadoEfectivo(conf, avisosFila(conf, ctx).avisos), 'confirmada');
});
