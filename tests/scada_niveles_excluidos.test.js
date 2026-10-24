// Niveles que el SCADA SÍ mide pero que la homologación dejó en «No usar» (`domain/scada_niveles_excluidos.js`): la página dice
// «medida excluida en la homologación» con el motivo de la nota, no «no se mide». Datos SINTÉTICOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nivelesExcluidos, notaCorta } from '../assets/js/domain/scada_niveles_excluidos.js';

const tx = { electrico: { tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 66.9, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 167.3 } };
const punto = { niveles: { N34_5: {}, N13_8: {} } };
const fila = (decision) => ({ matricula: 'T1-EstDemo', decision });
const usar = { tipo: 'usar', mapa: { N13_8: 'S' }, niveles_vistos: ['N34_5', 'N13_8'], nota: 'El 34,5 kV del punto tiene escalas erradas en la prueba. Se usa solo 13,8 kV.' };

test('excluido: el nivel que la decisión «usar» dejó sin devanado, con el devanado que le toca por tensión y la nota', () => {
  const r = nivelesExcluidos({ tx, fila: fila(usar), punto });
  assert.deepEqual(r.porNivel, { N34_5: { devanado: 'P' } });
  assert.deepEqual(r.porDevanado, { P: ['N34_5'] });
  assert.match(r.nota, /escalas erradas/);
});

test('no excluido: sin decisión, con «Excluir», con mapa vacío o con todos los niveles asignados', () => {
  const vacio = { porNivel: {}, porDevanado: {}, nota: null };
  assert.deepEqual(nivelesExcluidos({ tx, fila: fila(null), punto }), vacio);
  assert.deepEqual(nivelesExcluidos({ tx, fila: fila({ ...usar, tipo: 'no_usar' }), punto }), vacio);
  assert.deepEqual(nivelesExcluidos({ tx, fila: fila({ ...usar, mapa: {} }), punto }), vacio);
  assert.deepEqual(nivelesExcluidos({ tx, fila: fila({ ...usar, mapa: { N34_5: 'P', N13_8: 'S' } }), punto }), vacio);
  assert.deepEqual(nivelesExcluidos({}), vacio);
});

test('un nivel que apareció DESPUÉS de la decisión no cuenta como excluido (queda «por revisar»)', () => {
  const r = nivelesExcluidos({ tx, fila: fila({ ...usar, niveles_vistos: ['N13_8'] }), punto });
  assert.deepEqual(r.porNivel, {});
});

test('un nivel excluido que por tensión no es de ningún devanado: excluido, sin devanado', () => {
  const r = nivelesExcluidos({ tx, fila: fila({ ...usar, niveles_vistos: ['N110', 'N13_8'] }), punto: { niveles: { N110: {}, N13_8: {} } } });
  assert.deepEqual(r.porNivel, { N110: { devanado: null } });
  assert.deepEqual(r.porDevanado, {});
});

test('nota corta: hasta el primer punto seguido, o recortada con «…»', () => {
  assert.equal(notaCorta('El 34,5 kV del punto tiene escalas erradas en la prueba. Se usa solo 13,8 kV.'), 'El 34,5 kV del punto tiene escalas erradas en la prueba.');
  assert.equal(notaCorta(''), null); assert.equal(notaCorta(null), null);
  const larga = 'palabra '.repeat(40).trim();
  const c = notaCorta(larga, 50);
  assert.ok(c.length <= 50 && c.endsWith('…'), c);
  assert.equal(notaCorta('Corta.'), 'Corta.');
});

test('cableado: detalle, historia y «Cada devanado» dicen «excluida en la homologación»; «mes a mes» le pasa la fila', () => {
  const src = (f) => readFileSync(new URL('../assets/js/ui/cargabilidad-scada/' + f, import.meta.url), 'utf8');
  const det = src('detalle.js'); const his = src('historia.js'); const dev = src('panel-devanados-mes.js'); const men = src('panel-mensual.js');
  for (const s of [det, his, dev]) assert.match(s, /import \{ nivelesExcluidos, notaCorta \} from '\.\.\/\.\.\/domain\/scada_niveles_excluidos\.js'/);
  assert.match(det, /', excluida en la homologación'/); assert.match(det, /' · excluida \(homologación\)'/);
  assert.match(det, /Se muestra solo para ver: no entra en ninguna cifra\./);
  assert.match(his, /' excluida en la homologación'/);
  assert.match(dev, /excluida: 'medida excluida \(homologación\)'/);
  assert.match(men, /fila: a\.fila, punto: a\.punto \}/);
});
