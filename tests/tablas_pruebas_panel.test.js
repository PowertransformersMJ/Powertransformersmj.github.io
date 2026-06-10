// Tests del panel "Valores por prueba" (ui/pruebas/tablas-pruebas-panel.js).
// Solo helpers PUROS (sin DOM): discriminación de nivel, sellos, métrica/tendencia/peor caso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  grupoDe, selloDe, metricaFila, tendenciaFilas, peorCasoFila
} from '../assets/js/ui/pruebas/tablas-pruebas-panel.js';

test('grupoDe excitación: el kV del título es la tensión de ENSAYO, no el nivel (reusa nivelDe)', () => {
  // estrella → AT 110 kV ; delta → AT 66 kV ; nunca "10 kV" (regresión L-55).
  assert.equal(grupoDe('excitacion', 'Corriente de excitación AT por TAP - 10 kV', 'estrella'), 'AT · 110 kV');
  assert.equal(grupoDe('excitacion', 'Corriente de excitación AT por TAP - 10 kV', 'delta'), 'AT · 66 kV');
  assert.equal(grupoDe('excitacion', 'Corriente de excitación MT por TAP - 34.5 kV', 'delta'), 'MT · 34.5 kV');
  // sin "AT" en el título → asume AT y aplica la config.
  assert.equal(grupoDe('excitacion', 'Corriente de excitación por TAP - 10 kV', 'estrella'), 'AT · 110 kV');
});

test('grupoDe otras pruebas: discrimina por devanado/par (no por tensión de ensayo)', () => {
  assert.equal(grupoDe('relacion', 'Relación de transformación AT/MT (T1=66 kV, T2=34.5 kV)'), 'AT / MT');
  assert.equal(grupoDe('relacion', 'Relación de transformación AT/BT (T1=66 kV, T2=13.8 kV)'), 'AT / BT');
  assert.equal(grupoDe('resistencia', 'Resistencia de devanados AT por TAP (referida a 75 °C)'), 'AT');
  assert.equal(grupoDe('resistencia', 'Resistencia de devanados MT y BT (referida a 75 °C)'), 'MT / BT');
});

test('selloDe: acrónimo + color por norma (emblema propio, no logo oficial)', () => {
  assert.deepEqual(selloDe('ANSI/NETA §7.2.2.D.6'), { acron: 'NETA', color: '#2c6e72' });
  assert.equal(selloDe('IEEE C57.152').acron, 'IEEE');
  assert.equal(selloDe('IEC 60076-18').acron, 'IEC');
  assert.equal(selloDe('Por clase (MO.00418 / C57.152)').acron, 'MO');
  assert.equal(selloDe('algo sin norma conocida').acron, 'NORMA');
});

test('metricaFila: peor caso por tipo de criterio', () => {
  // desb → |desvMax|
  assert.equal(metricaFila('excitacion', { desvMax: -3.03, valores: [10, 20] }), 3.03);
  // min (aislamiento) → mínimo de los valores
  assert.equal(metricaFila('aislamiento', { valores: [36.8, 8.98, 22] }), 8.98);
  // max (bushing) → máximo
  assert.equal(metricaFila('bushing', { valores: [0.33, 0.45, 0.34] }), 0.45);
  assert.equal(metricaFila('excitacion', { desvMax: null, valores: [] }), null);
});

test('tendenciaFilas: desbalance que baja = MEJORA; aislamiento que baja = EMPEORA', () => {
  const exc = [
    { ano: 2022, desvMax: 2.67, valores: [24] },
    { ano: 2024, desvMax: 0.36, valores: [34] }
  ];
  const tExc = tendenciaFilas('excitacion', exc);
  assert.equal(tExc.tendencia, 'mejora'); // el desbalance disminuyó

  const ais = [
    { ano: 2022, valores: [36.8] },
    { ano: 2024, valores: [22.0] }
  ];
  const tAis = tendenciaFilas('aislamiento', ais);
  assert.equal(tAis.tendencia, 'empeora'); // GΩ mínimo bajó (peor aislamiento)

  // un solo informe → estable, sin delta.
  assert.deepEqual(tendenciaFilas('excitacion', [{ ano: 2024, desvMax: 1, valores: [1] }]), { tendencia: 'estable', delta: 0 });
});

test('peorCasoFila: elige la fila más desfavorable', () => {
  const filas = [
    { label: 'A', desvMax: 2.67, valores: [1] },
    { label: 'B', desvMax: 3.03, valores: [1] },
    { label: 'C', desvMax: 0.36, valores: [1] }
  ];
  const pc = peorCasoFila('excitacion', filas);
  assert.equal(pc.fila.label, 'B');
  assert.equal(pc.metrica, 3.03);
});
