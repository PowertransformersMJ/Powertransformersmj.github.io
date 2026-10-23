// Placa característica de cada transformador (TODO-69, propuesta 2026-10-22): lectura de textos de placa y
// diferencias con la plataforma (solo se muestran). Datos sintéticos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numeros, tensionesKv, tensionesPlaca, corrientesA, topePlacaKva, diferencias, revisionPlaca, revisarPlacaPaquete, seccionesPlaca, unir } from '../assets/js/domain/placa_caracteristica.js';

test('números de placa: coma decimal, punto o espacio de miles', () => {
  assert.deepEqual(numeros('13 800 V').map((x) => x.v), [13800]);
  assert.deepEqual(numeros('1.255,1 A').map((x) => x.v), [1255.1]);
  assert.deepEqual(numeros('34,5 kV').map((x) => x.v), [34.5]);
});

test('tensiones y corrientes impresas', () => {
  assert.ok(tensionesKv('34,5 kV (conmutador 36225–32775 V)').includes(34.5));
  assert.deepEqual(tensionesPlaca('13 800 V').nominal, [13.8]);
  assert.ok(tensionesKv('13,8/7,96 kV').includes(7.96));
  assert.deepEqual(corrientesA('BT 600,1/800,2 A y AT 240,0/320,0 A'), [600.1, 800.2, 240, 320]);
  assert.deepEqual(corrientesA('CT1 200/5 A'), []);
  assert.ok(!numeros('AT pos 6 219/289 A').some((x) => x.v === 6219));
});

const tx = (e, pl = {}, extra = {}) => ({ id: 'x', electrico: e, placa: { potencia_kva: 20000, serial: 'AB-12345', ...pl }, ...extra });
const placa = (datos) => ({ datos: { serie: 'AB-12345', etapas_kva: { ONAN: 15000, ONAF1: 20000 }, ...datos } });

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
  const t = tx({ tension_primaria_kv: 66 }, { serial: 'ZZ-99999', potencia_kva: 30000 }, { fabricacion: { ano_fabricacion: 1990 } });
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
  // Abierto por defecto, como en la vista previa aprobada (2026-10-23): plegado, el Ingeniero no veía la placa.
  const panel = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-placa.js', import.meta.url), 'utf8');
  assert.match(panel, /el\('details', \{ class: 'cs-placa-det', open: true \}/);
  // La nota de la homologación decidida se ve en el equipo.
  assert.match(det, /a\.fila\.decision\.nota/);
});

test('tensión: nominal, una toma del cambiador (aviso) o fuera (grave)', () => {
  const t = tensionesPlaca('33000 V (5 pos: 34650 a 31350 V)');
  assert.deepEqual(t.nominal, [33]); assert.equal(t.max, 34.65);
  const d = diferencias(placa({ tension: { P: '33000 V (5 pos: 34650 a 31350 V)' } }), tx({ tension_primaria_kv: 34.5 }));
  assert.equal(d.length, 1); assert.match(d[0].nota, /toma del cambiador/); assert.equal(d[0].grave, false);
  assert.ok(tensionesPlaca('110,0 kV ±8x1,25%').min < 100);
});

test('la ampacidad que cuadra con la tensión de la PLACA apunta a la tensión, no a la potencia', () => {
  const d = diferencias(placa({ tension: { S: '14300 V' } }), tx({ tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 334.7, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 807.5 }));
  assert.ok(d.some((x) => x.campo === 'Tensión secundario' && x.grave));
  assert.ok(d.some((x) => x.campo === 'Ampacidad secundario' && /revisar la tensión/.test(x.nota) && !x.grave));
});

test('serie por partes: CP y serie de WEG, lectura incompleta y error de un dígito', () => {
  assert.deepEqual(diferencias(placa({ serie: 'CP 40917725 / serie 2088316450' }), tx({}, { serial: '2088316450' })), []);
  assert.match(diferencias(placa({ serie: '82231' }), tx({}, { serial: '82231604' }))[0].nota, /incompleta/);
  assert.match(diferencias(placa({ serie: '3348027' }), tx({}, { serial: '33480127' }))[0].nota, /uno o dos caracteres/);
});

test('revisión: dice qué se comparó y qué no', () => {
  const r = revisionPlaca(placa({}), tx({}, { serial: '' }));
  assert.ok(r.comparados.includes('potencia')); assert.ok(r.sinComparar.includes('serie'));
});

test('paquete: rechaza placas sin huella de datos y fotos con metadatos de cámara', () => {
  const tx1 = { id: 'abcdef01', identificacion: { matricula: 'T1-X' } };
  const parque = new Map([[tx1.id, tx1]]);
  const meta = { schema: 1, matricula: 'T1-X', datos: {}, fuente: { huella_datos: 'c'.repeat(64) }, foto: null };
  assert.equal(revisarPlacaPaquete({ id: 'abcdef01', meta }, parque).ok, true);
  assert.match(revisarPlacaPaquete({ id: 'abcdef01', meta: { ...meta, fuente: {} } }, parque).motivo, /huella/);
  const jpegExif = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x04, 0x45, 0x78, 0xFF, 0xDA]);
  const b64 = Buffer.from(jpegExif).toString('base64');
  const conFoto = { ...meta, foto: { partes: 1, lote: 'loteloteA1', huella: 'd'.repeat(64), bytes: jpegExif.length } };
  assert.match(revisarPlacaPaquete({ id: 'abcdef01', meta: conFoto, partes: [{ lote: 'loteloteA1', b64 }] }, parque).motivo, /metadatos/);
  assert.match(revisarPlacaPaquete({ id: 'zzzzzz99', meta }, parque).motivo, /no está en el parque/);
  // Se compara sin espacios ni mayúsculas, pero se guarda la matrícula del inventario tal cual (la regla la exige idéntica).
  const txMin = { id: 'abcdef02', identificacion: { matricula: 't1-x ' } };
  const r = revisarPlacaPaquete({ id: 'abcdef02', meta }, new Map([[txMin.id, txMin]]));
  assert.equal(r.ok, true); assert.equal(r.meta.matricula, 't1-x '); assert.equal(meta.matricula, 'T1-X');
});

test('placa reconectable: la plataforma en la conexión alternativa no es un error grave, se anota', () => {
  const t = tx({ tension_primaria_kv: 66, corriente_nominal_primaria_a: 344.7, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 1673.5 },
    { potencia_kva: 40000 });
  const p = { datos: { serie: 'AB-12345', etapas_kva: { ONAN: 35000, ONAF1: 40000 },
    tension: { P: '115 kV ± 10 × 0,9 % (religable a 67 kV ± 10 × 1,5 %) · corriente de placa 301,6/344,7 A', S: '13,8 kV' } } };
  const d = diferencias(p, t).filter((x) => /Tensión primario/.test(x.campo));
  assert.equal(d.length, 1); assert.equal(d[0].grave, false); assert.match(d[0].nota, /conexión alternativa/);
  // Sin la conexión alternativa, sigue siendo «no coincide».
  const q = { datos: { ...p.datos, tension: { P: '115 kV ± 10 × 0,9 %', S: '13,8 kV' } } };
  assert.equal(diferencias(q, t).find((x) => /Tensión primario/.test(x.campo)).grave, true);
});
