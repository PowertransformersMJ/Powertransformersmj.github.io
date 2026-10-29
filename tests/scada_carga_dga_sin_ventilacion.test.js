// Cargabilidad SCADA — el panel de gases y el de Duval SIN textos de ventilación (orden del Ingeniero 2026-10-28: «no mezcles
// cargabilidad con ventilacion» → «Quitarlos de Cargabilidad»). Lo que se exige: salen los dos ítems, las dos frases y el
// renglón de «no puede saber»; el resto del texto y los demás ítems quedan iguales; el catálogo no cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGO_DGA, NO_PUEDE_SABER } from '../assets/js/domain/scada_carga_dga_textos.js';
import { sinVentilacion, noPuedeSaberSinVentilacion, QUITAR_VENTILACION, FRASES_VENTILACION } from '../assets/js/domain/scada_carga_dga_sin_ventilacion.js';

const todos = [...CATALOGO_DGA.adversidades, ...CATALOGO_DGA.acciones];

test('los ítems y frases a quitar existen tal cual en el catálogo (si el catálogo cambia, esto avisa)', () => {
  for (const id of QUITAR_VENTILACION) assert.ok(todos.some((it) => it.id === id), id);
  for (const [id, f] of Object.entries(FRASES_VENTILACION)) assert.ok(todos.find((it) => it.id === id).texto.includes(f), id);
  assert.equal(NO_PUEDE_SABER.filter((t) => t.startsWith('Si los ventiladores estaban en marcha')).length, 1);
});

test('después del filtro ningún texto del panel nombra los ventiladores ni la ventilación (salvo la termografía de componentes)', () => {
  const quedan = sinVentilacion(todos);
  assert.equal(quedan.length, todos.length - QUITAR_VENTILACION.length);
  const conVent = quedan.filter((it) => /ventila/i.test(it.texto)).map((it) => it.id);
  assert.deepEqual(conVent, ['ACC-R1-03'], 'solo la termografía, que lista los ventiladores entre los componentes a cubrir');
  assert.equal(noPuedeSaberSinVentilacion(NO_PUEDE_SABER).filter((t) => /ventila/i.test(t)).length, 0);
  assert.equal(noPuedeSaberSinVentilacion(NO_PUEDE_SABER).length, NO_PUEDE_SABER.length - 1);
});

test('el resto del texto queda igual y el catálogo no cambia', () => {
  const r3 = todos.find((it) => it.id === 'ADV-R1-03');
  const antes = r3.texto;
  const r3b = sinVentilacion([r3])[0];
  assert.equal(r3b.texto, antes.replace(FRASES_VENTILACION['ADV-R1-03'], ''));
  assert.equal(r3.texto, antes, 'el objeto del catálogo no se toca');
  const otro = todos.find((it) => it.id === 'ADV-R1-01');
  assert.equal(sinVentilacion([otro])[0], otro);
});

test('pantallas: el panel de gases filtra y el de Duval ya no trae los dos renglones', () => {
  const dg = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-dga.js', import.meta.url), 'utf8');
  assert.match(dg, /lista\('Posibles adversidades', sinVentilacion\(r\.adversidades\)/);
  assert.match(dg, /lista\('Acciones preventivas', sinVentilacion\(r\.acciones\)/);
  assert.match(dg, /noPuedeSaber\(noPuedeSaberSinVentilacion\(NO_PUEDE_SABER\), conPpm\)/);
  const du = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-duval.js', import.meta.url), 'utf8');
  assert.doesNotMatch(du, /Capacidad con ventiladores \(ONAF\)/);
  assert.doesNotMatch(du, /'Si los ventiladores estaban en marcha\.'/);
});
