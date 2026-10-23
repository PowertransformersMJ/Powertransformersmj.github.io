// Detalle de los umbrales de placa de cada devanado (`domain/scada_umbrales_detalle.js`): dónde está la carga frente a
// ONAN / ONAF, las columnas de la tabla y los rótulos que no se pisan. Datos SINTÉTICOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lecturaUmbral, columnasEtapas, escalaRotulos, BORDE } from '../assets/js/domain/scada_umbrales_detalle.js';

const et = (nombre, A, mva = null, origen = 'calculada') => ({ nombre, A, mva, origen });
const dos = { etapas: [et('ONAN', 300), et('ONAF', 400)], onan: et('ONAN', 300), onaf: et('ONAF', 400), tope: 'ONAF', dePlaca: true, sinLimite: false };
const casi = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);

test('lectura: dentro de ONAN, entre ONAN y ONAF (necesita ventiladores) y por encima de la ONAF', () => {
  const a = lecturaUmbral(250, dos);
  assert.equal(a.clase, 'holgado'); casi(a.margenA, 150); casi(a.pctOnan, 250 / 3); casi(a.pctTope, 62.5); assert.equal(a.excesoA, null);
  const b = lecturaUmbral(350, dos);
  assert.equal(b.clase, 'ventiladores'); casi(b.margenA, 50);
  const c = lecturaUmbral(460, dos);
  assert.equal(c.clase, 'supera'); casi(c.excesoA, 60); casi(c.pctTope, 115); assert.equal(c.margenA, null);
  // En el borde exacto no «supera»: igual a la ONAN sigue sin ventiladores (al borde); igual a la ONAF, con ventiladores.
  assert.equal(lecturaUmbral(300, dos).clase, 'borde'); assert.equal(lecturaUmbral(400, dos).clase, 'ventiladores');
  // «Al borde» desde el 90 % de la ONAN (banda CRG 5): le dice cuánto le falta sin y con ventiladores.
  const borde = lecturaUmbral(280, dos);
  assert.equal(borde.clase, 'borde'); casi(borde.margenOnanA, 20); casi(borde.margenA, 120);
  assert.equal(lecturaUmbral(269, dos).clase, 'holgado'); assert.equal(lecturaUmbral(270, dos).clase, 'borde'); assert.equal(BORDE, 90);
});

test('lectura: placa de una sola etapa (ONAN), sin placa (ampacidad), compensación y sin carga', () => {
  const una = { etapas: [et('ONAN', 100)], onan: null, onaf: et('ONAN', 100), tope: 'ONAN', dePlaca: true, sinLimite: false };
  assert.equal(lecturaUmbral(90, una).clase, 'holgado'); assert.equal(lecturaUmbral(90, una).pctOnan, null);
  assert.equal(lecturaUmbral(120, una).clase, 'supera');
  const plat = { etapas: [et('ampacidad', 200, null, 'plataforma')], onan: null, onaf: et('ampacidad', 200), tope: 'la ampacidad', dePlaca: false, sinLimite: false };
  assert.equal(lecturaUmbral(150, plat).clase, 'holgado');
  assert.equal(lecturaUmbral(10, { sinLimite: true, etapas: [], onaf: { A: null } }).clase, 'sinLimite');
  assert.equal(lecturaUmbral(null, dos), null); assert.equal(lecturaUmbral(NaN, dos), null); assert.equal(lecturaUmbral(5, null), null);
  assert.equal(lecturaUmbral(5, { ...dos, onaf: { A: 0 } }), null);
});

test('columnas: las etapas que traen los devanados, en orden ONAN → ONAF → ONAF II, y la ampacidad al final', () => {
  const U = {
    P: { etapas: [et('ONAN', 1), et('ONAF', 2), et('ONAF II', 3)] },
    S: { etapas: [et('ONAN', 1), et('ONAF', 2)] },
    T: { etapas: [et('ampacidad', 5)] }
  };
  assert.deepEqual(columnasEtapas([{ d: 'T' }, { d: 'S' }, { d: 'P' }], U), ['ONAN', 'ONAF', 'ONAF II', 'ampacidad']);
  assert.deepEqual(columnasEtapas([{ d: 'S' }], U), ['ONAN', 'ONAF']);
  assert.deepEqual(columnasEtapas([{ d: 'X' }], { X: { etapas: [] } }), []);
  assert.deepEqual(columnasEtapas([], U), []);
});

test('escala: espacio arriba para el recuadro de umbrales según sus renglones (2 = el 1,32 de antes)', () => {
  casi(escalaRotulos(1), 1.255); casi(escalaRotulos(2), 1.33); casi(escalaRotulos(3), 1.405);
  casi(escalaRotulos(0), 1.255); casi(escalaRotulos(9), 1.48); casi(escalaRotulos(undefined), 1.255);
});

test('panel: importa el detalle desde el archivo NUEVO, un recuadro de umbrales encima de los datos y nombres sin inclinar', () => {
  const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-devanados-mes.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ lecturaUmbral, columnasEtapas, escalaRotulos \} from '\.\.\/\.\.\/domain\/scada_umbrales_detalle\.js'/);
  // Los umbrales van en UN recuadro por devanado, anotación ENCIMA de lo más alto (caja o barra), con fondo y borde.
  assert.match(src, /y: Math\.max\(lim\[k\], val\[k\] \?\? 0\)/);
  assert.match(src, /bgcolor: 'rgba\(255,255,255,0\.92\)', bordercolor: '#c3cede', borderwidth: 1/);
  assert.doesNotMatch(src, /textposition: 'outside'/);
  assert.match(src, /tickangle: 0/);
  assert.match(src, /poner\(nodo, titulo, origen, resumen, leyenda, detalle, \.\.\.bloques, ayuda\)/);
  assert.match(src, /'Necesita los ventiladores: pasa la ONAN/);
});
