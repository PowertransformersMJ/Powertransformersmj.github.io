// Placa característica de cada transformador (TODO-69, propuesta 2026-10-22): lectura de textos de placa y
// diferencias con la plataforma (solo se muestran). Datos sintéticos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numeros, tensionesKv, corrientesA, topePlacaKva, diferencias, seccionesPlaca, unir } from '../assets/js/domain/placa_caracteristica.js';

test('números de placa: coma decimal, punto o espacio de miles', () => {
  assert.deepEqual(numeros('13 800 V').map((x) => x.v), [13800]);
  assert.deepEqual(numeros('1.255,1 A').map((x) => x.v), [1255.1]);
  assert.deepEqual(numeros('34,5 kV').map((x) => x.v), [34.5]);
});

test('tensiones y corrientes impresas', () => {
  assert.ok(tensionesKv('34,5 kV (conmutador 36225–32775 V)').includes(34.5));
  assert.deepEqual(tensionesKv('13 800 V'), [13.8]);
  assert.ok(tensionesKv('13,8/7,96 kV').includes(7.96));
  assert.deepEqual(corrientesA('BT 600,1/800,2 A y AT 240,0/320,0 A'), [600.1, 800.2, 240, 320]);
});

const tx = (e, pl = {}, extra = {}) => ({ id: 'x', electrico: e, placa: { potencia_kva: 20000, serial: 'AB-123', ...pl }, ...extra });
const placa = (datos) => ({ datos: { serie: 'AB 123', etapas_kva: { ONAN: 15000, ONAF1: 20000 }, ...datos } });

test('coincide: sin diferencias (la ampacidad cuadra con la potencia a su tensión)', () => {
  const t = tx({ tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 334.7, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 836.7 });
  assert.deepEqual(diferencias(placa({ tension: { P: '34500 V', S: '13800 V' } }), t), []);
});

test('errata ×10 en la ampacidad', () => {
  const t = tx({ tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 334.7, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 8367 });
  const d = diferencias(placa({}), t);
  assert.equal(d.length, 1); assert.match(d[0].nota, /errata ×10/); assert.equal(d[0].campo, 'Ampacidad secundario');
});

test('ampacidad de otra potencia (equipo anterior) en un equipo de dos devanados', () => {
  const t = tx({ tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 66.94, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 167.35 }, { potencia_kva: 6500 });
  const d = diferencias(placa({ etapas_kva: { ONAN: 5000, ONAF1: 6500 } }), t);
  assert.deepEqual(d.map((x) => x.campo), ['Ampacidad primario', 'Ampacidad secundario']);
});

test('tres devanados: el secundario con su propia potencia no se marca', () => {
  const t = tx({ tension_primaria_kv: 110, corriente_nominal_primaria_a: 105, tension_secundaria_kv: 34.5, corriente_nominal_secundaria_a: 251, tension_terciaria_kv: 13.8, corriente_nominal_terciaria_a: 1464 });
  assert.deepEqual(diferencias(placa({}), t), []);
});

test('tensión que no casa con la placa, serie distinta, potencia y año', () => {
  const t = tx({ tension_primaria_kv: 66 }, { serial: 'ZZ-999', potencia_kva: 30000 }, { fabricacion: { ano_fabricacion: 1990 } });
  const d = diferencias(placa({ tension: { P: '110 kV (OLTC 115,5–93,5 kV)' }, anio: 2012 }), t);
  assert.deepEqual(d.map((x) => x.campo).sort(), ['Año de fabricación', 'Potencia', 'Serie', 'Tensión primario']);
});

test('la potencia ONAN en la plataforma se explica, no es grave', () => {
  const d = diferencias(placa({}), tx({}, { potencia_kva: 15000 }));
  assert.equal(d.length, 1); assert.match(d[0].nota, /ONAN/); assert.equal(d[0].grave, false);
});

test('fases: que la plataforma no lo tenga no es diferencia; uno distinto sí', () => {
  assert.deepEqual(diferencias(placa({ fases: 3 }), tx({})), []);
  assert.equal(diferencias(placa({ fases: 1 }), tx({ fases: 3 }))[0].campo, 'Fases');
});

test('secciones: solo lo que la placa trae; tope de etapas y unión de partes', () => {
  const s = seccionesPlaca(placa({ fabricante: 'X', impedancia_pct: 7.7, impedancia_base_kva: 15000 }));
  assert.ok(s.find((x) => x.titulo === 'Identificación').filas.some(([k]) => k === 'Fabricante'));
  assert.ok(!s.some((x) => x.titulo === 'Masas'));
  assert.equal(topePlacaKva(placa({}).datos), 20000);
  assert.deepEqual([...unir([new Uint8Array([1, 2]), new Uint8Array([3])])], [1, 2, 3]);
});

test('L-102 y compilación: el panel es un archivo nuevo y el detalle no importa nada nuevo de lista.js', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const f of ['ui/cargabilidad-scada/panel-placa.js', 'ui/cargabilidad-scada/detalle.js', 'data/placas_caracteristicas.js']) {
    const src = readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' });
    assert.equal(r.status, 0, f + ': ' + r.stderr);
  }
  const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(det, /import\('\.\/panel-placa\.js'\)/);
});
