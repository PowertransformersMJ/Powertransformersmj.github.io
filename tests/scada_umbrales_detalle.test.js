// Detalle de los umbrales de placa de cada devanado (`domain/scada_umbrales_detalle.js`): dónde está la carga frente a
// ONAN / ONAF, las columnas de la tabla y los rótulos que no se pisan. Datos SINTÉTICOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lecturaUmbral, columnasEtapas, escalaRotulos, partirRenglon, BORDE } from '../assets/js/domain/scada_umbrales_detalle.js';

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
  // En el borde exacto no «supera»: igual a la ONAN, al borde de ella; igual a la ONAF, al borde de la ONAF.
  assert.equal(lecturaUmbral(300, dos).clase, 'borde'); assert.equal(lecturaUmbral(400, dos).clase, 'bordeTope');
  // Con ventiladores y cerca del límite mayor (≥ 90 % de la ONAF): al borde de la ONAF, no un «necesita ventiladores» más.
  const tope = lecturaUmbral(370, dos); assert.equal(tope.clase, 'bordeTope'); casi(tope.margenA, 30);
  // «Al borde» desde el 90 % de la ONAN (banda CRG 5): le dice cuánto le falta sin y con ventiladores.
  const borde = lecturaUmbral(280, dos);
  assert.equal(borde.clase, 'borde'); casi(borde.margenOnanA, 20); casi(borde.margenA, 120);
  assert.equal(lecturaUmbral(269, dos).clase, 'holgado'); assert.equal(lecturaUmbral(270, dos).clase, 'borde'); assert.equal(BORDE, 90);
});

test('lectura: placa de una sola etapa (ONAN), sin placa (ampacidad), compensación y sin carga', () => {
  const una = { etapas: [et('ONAN', 100)], onan: null, onaf: et('ONAN', 100), tope: 'ONAN', dePlaca: true, sinLimite: false };
  assert.equal(lecturaUmbral(85, una).clase, 'holgado'); assert.equal(lecturaUmbral(85, una).pctOnan, null);
  // Su ÚNICO límite también tiene borde (revisión adversarial: al 97,5 % salía «holgado» en verde junto a un CRG 5).
  assert.equal(lecturaUmbral(97.5, una).clase, 'bordeTope'); casi(lecturaUmbral(97.5, una).margenA, 2.5);
  assert.equal(lecturaUmbral(120, una).clase, 'supera');
  const plat = { etapas: [et('ampacidad', 200, null, 'plataforma')], onan: null, onaf: et('ampacidad', 200), tope: 'la ampacidad', dePlaca: false, sinLimite: false };
  assert.equal(lecturaUmbral(150, plat).clase, 'holgado'); assert.equal(lecturaUmbral(195, plat).clase, 'bordeTope');
  // La página pasa la banda CRG 5 configurada: con otra banda, otro borde.
  assert.equal(lecturaUmbral(280, dos, (p) => p > 95).clase, 'holgado'); assert.equal(lecturaUmbral(97.5, una, (p) => p > 98).clase, 'holgado');
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

test('renglones: uno largo se parte en dos por el espacio más cercano al medio; uno corto o sin espacios, no', () => {
  assert.deepEqual(partirRenglon('sin lectura de los meses', 18), ['sin lectura', 'de los meses']);
  assert.deepEqual(partirRenglon('90,5 % de la ampacidad', 18), ['90,5 % de la', 'ampacidad']);
  assert.deepEqual(partirRenglon('156 A', 18), ['156 A']);
  assert.deepEqual(partirRenglon('Supercalifragilístico', 5), ['Supercalifragilístico']);
  assert.deepEqual(partirRenglon(null, 5), ['']); assert.deepEqual(partirRenglon('a b c', 0), ['a b c']);
});

test('escala: espacio arriba para el recuadro de umbrales según sus renglones (2 = el 1,32 de antes)', () => {
  casi(escalaRotulos(1), 1.255); casi(escalaRotulos(2), 1.33); casi(escalaRotulos(3), 1.405);
  casi(escalaRotulos(0), 1.255); casi(escalaRotulos(9), 1.48); casi(escalaRotulos(undefined), 1.255);
});

test('panel: importa el detalle desde el archivo NUEVO, un recuadro de umbrales encima de los datos y nombres sin inclinar', () => {
  const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-devanados-mes.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ lecturaUmbral, columnasEtapas, escalaRotulos, partirRenglon \} from '\.\.\/\.\.\/domain\/scada_umbrales_detalle\.js'/);
  // El borde es la banda CRG 5 configurada (la del chip), y el verde no contradice un CRG 4.
  assert.match(src, /const esBorde = \(p\) => califCRG\(p, umbrales\) === 5;/);
  assert.match(src, /\(califCRG\(l\.pctTope, umbrales\) \|\| 0\) >= 4 \? 'neutro'/);
  // La leyenda y la tabla no dicen «de placa» ni «ONAN» si el límite es la ampacidad de la plataforma.
  assert.match(src, /'Caja clara: la ampacidad de la plataforma \(no hay placa leída\)'/);
  assert.match(src, /marcas \? it\('cs-ley-onan'/);
  // Los umbrales van en UN recuadro por devanado, anotación ENCIMA de lo más alto (caja o barra), con fondo y borde.
  assert.match(src, /y: Math\.max\(lim\[k\], val\[k\] \?\? 0\)/);
  assert.match(src, /bgcolor: 'rgba\(255,255,255,0\.92\)', bordercolor: '#c3cede', borderwidth: 1/);
  assert.doesNotMatch(src, /textposition: 'outside'/);
  assert.match(src, /tickangle: 0/);
  assert.match(src, /poner\(nodo, titulo, origen, resumen, leyenda, detalle, \.\.\.bloques, ayuda\)/);
  assert.match(src, /'Necesita los ventiladores: pasa la ONAN/);
});
