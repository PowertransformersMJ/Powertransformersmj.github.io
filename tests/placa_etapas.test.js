// Potencias de PLACA por devanado (ONAN / ONAF) leídas del texto de la placa (pedido 2026-10-23: «todo es con base a la
// placa»). Datos SINTÉTICOS con las FORMAS de escritura reales: las cifras son inventadas y ningún texto es el de una placa
// del parque (comprobado contra el banco de placas antes de publicar; el repo es público).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapasPorDevanado, limitesDePlaca, kvDePlaca } from '../assets/js/domain/placa_etapas.js';

const d = (etapas, texto, tension = {}) => ({ etapas_kva: etapas, potencias_texto: texto, tension });
const eq = { ONAN: 30000, ONAF1: 40000 };
const caso = (texto, opc = {}, extra = {}) => etapasPorDevanado(d(extra.etapas || eq, texto, extra.tension), { tres: true, ...opc });
const casi = (a, b, tol = 0.1) => assert.ok(Math.abs(a - b) < tol, a + ' ≠ ' + b);

test('dos devanados: las etapas del equipo valen para los dos', () => {
  const r = etapasPorDevanado(d({ ONAN: 5000, ONAF1: 6500 }, ''), { tres: false });
  assert.deepEqual(r.P, [5000, 6500]); assert.deepEqual(r.S, [5000, 6500]); assert.equal(r.T, null);
});

test('rótulos de devanado en MVA con coma decimal (AT / MT / BT)', () => {
  const r = caso('Sistema ONAN/ONAF, potencia (MVA): AT 30,0/40,0; MT 12,5/17,0; BT 22,0/29,0');
  assert.deepEqual([r.P, r.S, r.T], [[30000, 40000], [12500, 17000], [22000, 29000]]);
});

test('«BT» es el secundario cuando no hay «MT» (AT / BT / TERC), aunque la cifra empiece en 2', () => {
  const r = caso('MVA ONAN/ONAF: AT 30,0 / 40,0; BT 20,5 / 27,0; TERC 9,5 / 13,0');
  assert.deepEqual([r.S, r.T], [[20500, 27000], [9500, 13000]]);
});

test('una terna por etapa, con la tensión entre paréntesis y tres etapas', () => {
  const r = caso('Potencia (kVA) ONAN 30000 (110 kV) / 15000 (34,5 kV) / 15000 (13,8 kV); ONAF 40000 / 20000 / 20000');
  assert.deepEqual([r.P, r.S, r.T], [[30000, 40000], [15000, 20000], [15000, 20000]]);
  const r3 = caso('Potencia nominal ONAF II 50000/20000/30000 kVA; ONAF I 40000/16000/24000 kVA; ONAN 30000/12000/18000 kVA (AT/MT/BT)',
    {}, { etapas: { ONAN: 30000, ONAF1: 40000, ONAF2: 50000 } });
  assert.deepEqual([r3.P, r3.S, r3.T], [[30000, 40000, 50000], [12000, 16000, 20000], [18000, 24000, 30000]]);
});

test('formas compactas: «AT-MT-BT a/b c/d e/f» y «a-b-c/d-e-f»', () => {
  const r = caso('POTENCIA NOMINAL AT-MT-BT 30000/40000 20000/26000 10000/14000 kVA');
  assert.deepEqual([r.S, r.T], [[20000, 26000], [10000, 14000]]);
  const g = etapasPorDevanado(d({ ONAN: 5000, ONAF1: 7000 }, 'CAPACIDAD MVA 5-2-3/7-3-4'), { tres: true });
  assert.deepEqual([g.P, g.S, g.T], [[5000, 7000], [2000, 3000], [3000, 4000]]);
});

test('«primario y secundario» comparten; el terciario se lee de su tensión si hace falta', () => {
  const r = caso('Capacidad 30000 / 40000 kVA ONAN/ONAF (primario y secundario); terciario 7500/10000 kVA ONAN/ONAF');
  assert.deepEqual([r.S, r.T], [[30000, 40000], [7500, 10000]]);
  const t = caso('CAPAC. MVA 30/40', {}, { tension: { T: '13800 V (7,5/10 MVA)' } });
  assert.deepEqual(t.T, [7500, 10000]); assert.equal(t.S, null); assert.match(t.nota, /secundario/);
});

test('dos placas en el texto: se usa la de la tensión del equipo', () => {
  const r = caso('Placa 115 kV: Potencia 40 000 / 30 000 / 10 000 kVA y 30 000 / 22 500 / 7 500 kVA, ONAF / ONAN. '
    + 'Placa 66 kV: Potencia 20 000 / 15 000 / 5 000 kVA y 15 000 / 11 000 / 4 000 kVA (cifras AT / TM / BT)', { kvPrimario: 110 });
  assert.deepEqual([r.P, r.S, r.T], [[30000, 40000], [22500, 30000], [7500, 10000]]);
});

test('si el primario leído no es el del equipo, no se inventa nada', () => {
  const r = caso('AT 25/35; MT 10/14; BT 15/21');
  assert.deepEqual(r.P, [30000, 40000]); assert.equal(r.S, null); assert.equal(r.T, null); assert.match(r.nota, /no trae de forma legible/);
});

test('límites para las gráficas: corriente de cada etapa a la tensión de PLACA', () => {
  const tx = { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8 } };
  const L = limitesDePlaca({ datos: { etapas_kva: { ONAN: 12000, ONAF1: 16000 }, tension: { P: '34500 V', S: '13800 V' } } }, tx);
  assert.deepEqual(L.S.nombres, ['ONAN', 'ONAF1']);
  casi(L.S.A[1], 669.4); casi(L.S.A[0], 502.0); casi(L.P.A[1], 267.8);
  assert.equal(L.S.difKv, false); assert.equal(L.nota, null);
  assert.equal(limitesDePlaca(null, tx).P, undefined);
});

test('tensión de placa: la de la conexión del equipo, aunque la placa nombre varias', () => {
  assert.equal(kvDePlaca('13800/7967 V', 13.8), 13.8);                                      // línea y fase
  assert.equal(kvDePlaca('13 800 / 7 967 V', null), 13.8);                                   // sin plataforma: la de línea
  assert.equal(kvDePlaca('115000GrdY/66395 V (120750-97750 V, 21 pos. OLTC)', 115), 115);    // «GrdY»: no es 66,4 kV…
  assert.equal(kvDePlaca('115000GrdY/66395 V (120750-97750 V, 21 pos. OLTC)', 66), 115);     // …ni aunque la plataforma diga 66
  assert.equal(kvDePlaca('12470Y/7200 V', 13.8), 12.47);                                     // la de placa, no la del sistema
  assert.equal(kvDePlaca('Y 115 000 V – Δ 66 400 V', 66), 66.4);                            // Y–Δ reconectable: la del equipo
  assert.equal(kvDePlaca('115 kV ± 10 × 0,9 % (religable a 69 kV ± 10 × 1,5 %)', 66), 69);
  assert.equal(kvDePlaca('115 kV +9/-13 x 1,0 % (reconectable a 69 kV +5/-17 x 0,95 %)', 66), 69);
  assert.equal(kvDePlaca('115 kV (OLTC 121-98 kV)', 66), 115);                               // ninguna cerca: la de placa
  assert.equal(kvDePlaca('31500 V', 34.5), 31.5);
  assert.equal(kvDePlaca('7967 V', 13.8), 7.967);                                           // monofásico
  assert.equal(kvDePlaca('', 13.8), null);
  assert.equal(kvDePlaca('34,5 kV'), 34.5);
});

test('tensión con la tolerancia del cambiador entre la cifra y la unidad, y miles con espacio y coma decimal', () => {
  assert.equal(kvDePlaca('69,0 +5/-15x0,95% kV (Dyn11) o 115,0 +9/-15x1,0% kV (YNyn0), reconectable', 66), 69);
  assert.equal(kvDePlaca('34500 +2/-2 x 2,5 % V (OCTC 5 pos)', 34.5), 34.5);
  casi(kvDePlaca('7 967,421 V', 13.8), 7.967421, 1e-6);
});

test('límites: tensión de placa de la conexión, aviso si no es la de la plataforma, monofásico sin falso aviso', () => {
  const tx = { electrico: { tension_primaria_kv: 66, tension_secundaria_kv: 13.8 } };
  const L = limitesDePlaca({ datos: { etapas_kva: { ONAN: 24000, ONAF1: 32000 }, tension: { P: 'Y 115 000 V – Δ 66 400 V', S: '13800/7967 V' } } }, tx);
  assert.equal(L.P.kv, 66.4); casi(L.P.A[1], 278.2); assert.equal(L.P.difKv, false);
  const r = limitesDePlaca({ datos: { etapas_kva: { ONAN: 4000, ONAF1: 5000 }, tension: { P: '31500 V', S: '13800 V' } } },
    { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8 } });
  assert.equal(r.P.kv, 31.5); assert.equal(r.P.difKv, true); assert.equal(r.P.kvPlataforma, 34.5);
  const mono = limitesDePlaca({ datos: { fases: 1, etapas_kva: { ONAN: 400 }, tension: { P: '34500 V', S: '7967 V' } } }, tx);
  casi(mono.S.A[0], 50.21, 0.01);                                                             // monofásico: kVA / kV
  assert.equal(mono.S.difKv, false);                                                          // 7,967 kV es la fase de 13,8
});

test('límites: sin tensión legible lo dice la nota; el terciario de compensación se marca', () => {
  const tx = { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, tension_terciaria_kv: 6.6 } };
  const L = limitesDePlaca({ datos: { etapas_kva: { ONAN: 20000, ONAF1: 25000 },
    potencias_texto: 'AT 20/25; MT 20/25; TERC 7/8,5 MVA',
    tension: { P: 'ilegible', S: '13800 V', T: '6600 V, terciario de compensación' } } }, tx);
  assert.equal(L.P.A, null); assert.match(L.nota, /no trae legible la tensión del primario/);
  assert.equal(L.T.compensa, true); assert.equal(L.S.compensa, false);
});

test('corriente IMPRESA: si la placa la graba y cuadra, se usa y se rotula; una toma distinta o sin dato → calculada', () => {
  const tx = { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8 } };
  const placa = (S, notas = null) => ({ datos: { etapas_kva: { ONAN: 4000, ONAF1: 5000 }, notas, tension: { P: '34500 V', S } } });
  const L = limitesDePlaca(placa('13800/7967 V · corriente de placa 167,4/209,2 A'), tx);
  assert.deepEqual(L.S.origenA, ['impresa', 'impresa']); assert.deepEqual(L.S.A, [167.4, 209.2]);
  assert.deepEqual(L.P.origenA, ['calculada', 'calculada']); casi(L.P.A[1], 83.67);
  // Grabada en entero (redondeo de la placa) también vale; la de otra toma (≈ 2 % arriba) no.
  const ent = limitesDePlaca(placa('13800 V · corriente de placa 167/209 A'), tx);
  assert.deepEqual(ent.S.origenA, ['impresa', 'impresa']);
  const toma = limitesDePlaca(placa('13800 V', 'Corriente BT en la toma 1: 171,4/214,2 A'), tx);
  assert.deepEqual(toma.S.origenA, ['calculada', 'calculada']); casi(toma.S.A[1], 209.18);
  // Solo una etapa impresa: cada etapa con su origen.
  const una = limitesDePlaca(placa('13800 V · corriente de placa ONAN 167,35 A'), tx);
  assert.deepEqual(una.S.origenA, ['impresa', 'calculada']);
});

test('corriente IMPRESA: la de las notas que cuadra mejor con OTRO devanado no se presta; la propia y el empate sí valen', () => {
  const tx = { electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 34.5, tension_terciaria_kv: 13.8 } };
  const placa = (S, T = '13,8 kV', bt = '22,0/27,5') => ({ datos: { etapas_kva: { ONAN: 32000, ONAF1: 40000 },
    potencias_texto: 'potencia (MVA): AT 32,0/40,0; MT 10,0/12,5; BT ' + bt, notas: 'Corrientes AT 168/210 A.',
    tension: { P: '110 kV', S, T } } });
  // 168/210 A son del primario (167,96/209,95 A); el secundario (167,35/209,18 A) no las toma aunque caigan a ±0,6 %.
  const L = limitesDePlaca(placa('34,5 kV'), tx);
  assert.deepEqual(L.P.origenA, ['impresa', 'impresa']); assert.deepEqual(L.P.A, [168, 210]);
  assert.deepEqual(L.S.origenA, ['calculada', 'calculada']); casi(L.S.A[0], 167.35, 0.01);
  // Con su propia corriente en su tensión, el secundario sí es «impresa» (y la del primario no le gana).
  const propia = limitesDePlaca(placa('34,5 kV · corriente de placa 167/209 A'), tx);
  assert.deepEqual(propia.S.origenA, ['impresa', 'impresa']); assert.deepEqual(propia.S.A, [167, 209]);
  // Empate: dos devanados con la misma corriente de placa → la de las notas vale para los dos.
  const tx2 = { electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 34.5, tension_terciaria_kv: 34.5 } };
  const emp = limitesDePlaca({ datos: { ...placa('34,5 kV', '34,5 kV', '10,0/12,5').datos, notas: 'Corrientes MT y BT 167/209 A.' } }, tx2);
  assert.deepEqual(emp.S.origenA, ['impresa', 'impresa']); assert.deepEqual(emp.T.origenA, ['impresa', 'impresa']);
});

test('fuente de la lectura y terciario de compensación: marcas en las notas; el terciario no tiene límite de carga', () => {
  const tx = { electrico: { tension_primaria_kv: 66, tension_secundaria_kv: 34.5, tension_terciaria_kv: 13.8 } };
  const L = limitesDePlaca({ datos: { etapas_kva: { ONAN: 20000, ONAF1: 25000 }, potencias_texto: 'AT 20/25; MT 20/25; TERC 7/8 MVA',
    notas: '[documento: plano del fabricante] [equipo FUTURO] Plano del dossier.',
    tension: { P: '66 kV', S: '34,5 kV', T: '6600 V, devanado de compensación no cargable' } } }, tx);
  assert.equal(L.documento, 'plano'); assert.equal(L.futuro, true);
  assert.equal(L.T.sinLimite, true); assert.equal(L.T.A, null); assert.equal(L.T.compensa, true);
  const sin = limitesDePlaca({ datos: { etapas_kva: { ONAN: 5000 }, notas: 'Placa de fábrica.', tension: { P: '34500 V', S: '13800 V' } } },
    { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8 } });
  assert.equal(sin.documento, 'placa'); assert.equal(sin.futuro, false);
});
