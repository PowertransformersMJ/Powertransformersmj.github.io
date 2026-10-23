// Cada devanado mes a mes frente a sus límites de PLACA: umbrales, motivo sin cifra y estado a la fecha
// (`domain/scada_devanados_mes.js`). Datos SINTÉTICOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { umbralesDevanado, motivoSinCifra, estadoDevanados, pctDe } from '../assets/js/domain/scada_devanados_mes.js';

const lim = (kva, nombres, A, extra = {}) => ({ kva, nombres, kv: 13.8, A, ...extra });

test('umbrales: con dos etapas, ONAN y ONAF; el % va contra la ONAF', () => {
  const u = umbralesDevanado({ d: 'S', A: 669.4, mva: 16, kv: 13.8 }, { S: lim([12000, 16000], ['ONAN', 'ONAF1'], [502, 669.4]) });
  assert.equal(u.tope, 'ONAF'); assert.equal(u.onan.nombre, 'ONAN'); assert.equal(u.dePlaca, true);
  assert.equal(u.difA, false); assert.equal(Math.round(pctDe(502, u.onaf)), 75);
});

test('umbrales: placa de UNA sola etapa → el límite es ONAN (no «ONAF») y no hay marca ONAN aparte', () => {
  const u = umbralesDevanado({ d: 'P', A: 33.5, mva: 2, kv: 34.5 }, { P: lim([2000], ['ONAN'], [33.5]) });
  assert.equal(u.tope, 'ONAN'); assert.equal(u.onan, null); assert.equal(u.onaf.nombre, 'ONAN');
});

test('umbrales: tres etapas → el límite mayor es ONAF II', () => {
  const u = umbralesDevanado({ d: 'P', A: 262, mva: 50, kv: 110 }, { P: lim([30000, 40000, 50000], ['ONAN', 'ONAF1', 'ONAF2'], [157, 210, 262]) });
  assert.equal(u.tope, 'ONAF II'); assert.deepEqual(u.etapas.map((e) => e.nombre), ['ONAN', 'ONAF', 'ONAF II']);
});

test('umbrales: ampacidad de la plataforma distinta (aviso) y ×10 (fuera de escala)', () => {
  const p = { S: lim([12000, 16000], ['ONAN', 'ONAF1'], [502, 669.4], { difKv: true, kvPlataforma: 13.2, compensa: false }) };
  const u = umbralesDevanado({ d: 'S', A: 6694, mva: 160, kv: 13.8 }, p);
  assert.equal(u.difA, true); assert.equal(u.fueraEscala, true); assert.equal(u.difKv, true); assert.equal(u.kvPlataforma, 13.2);
  const v = umbralesDevanado({ d: 'S', A: 600, mva: 14.3, kv: 13.8 }, p);
  assert.equal(v.difA, true); assert.equal(v.fueraEscala, false);
});

test('umbrales: sin placa (o sin corriente de placa) → los de la plataforma, rotulados «la ampacidad»', () => {
  const u = umbralesDevanado({ d: 'P', A: 100, mva: 6, kv: 34.5 }, null);
  assert.equal(u.dePlaca, false); assert.equal(u.tope, 'la ampacidad'); assert.equal(u.etapas.length, 1); assert.equal(u.difA, false);
  const w = umbralesDevanado({ d: 'P', A: 100, mva: 6, kv: 34.5 }, { P: lim([5000, 6000], ['ONAN', 'ONAF1'], null) });
  assert.equal(w.dePlaca, false);
});

test('motivo sin cifra: el del equipo primero; si el equipo tiene cifra, sin niveles ≠ sin horas', () => {
  assert.equal(motivoSinCifra({ niveles: ['34.5'] }, { pct: null, motivoNulo: 'no vino en el exporte' }), 'no vino en el exporte');
  assert.equal(motivoSinCifra({ niveles: [] }, { pct: 50 }), 'sin señal del SCADA en uso para este devanado');
  assert.equal(motivoSinCifra({ niveles: ['34.5'] }, { pct: 50 }), 'sin horas válidas de este devanado');
});

// Serie mínima: cada mes con mensual/acumulado y sus devanados.
const mes = (m, { cargado = true, leido = true, eqPct = 60, motivoNulo = null, dev = {} } = {}) => {
  const devs = Object.entries(dev).map(([d, v]) => ({ d, niveles: v.niveles || [], pct: v.pct ?? null, iP99: v.iP99 ?? null }));
  const fila = { pct: eqPct, firme: true, motivoNulo, devanados: devs };
  return { mes: m, cargado, leido, mensual: fila, acumulado: { ...fila, desde: '2026-01', nMeses: 1 } };
};
const reg = [{ d: 'P' }, { d: 'S' }];

test('estado: el motivo de un devanado que se mide sin cifra sale de un mes LEÍDO, nunca del mes hueco', () => {
  const serie = [
    mes('2026-01', { dev: { P: { niveles: ['110'] }, S: { niveles: ['13.8'], pct: 60, iP99: 400 } } }),
    mes('2026-02', { cargado: false, leido: false, eqPct: null, motivoNulo: 'este mes no está cargado en la plataforma' })
  ];
  const e = estadoDevanados(serie, reg);
  assert.equal(e.porDevanado.P.estado, 'sinCifra');
  assert.equal(e.porDevanado.P.motivo, 'sin horas válidas de este devanado');
  assert.deepEqual(e.porDevanado.P.niveles, ['110']);
  assert.equal(e.porDevanado.S.estado, 'cifra');
});

test('estado: sin señal en uso solo si ningún mes leído lo mide; sin lectura si no se leyó ningún mes', () => {
  const leidos = estadoDevanados([mes('2026-01', { dev: { P: {}, S: { niveles: ['13.8'], pct: 60, iP99: 400 } } })], reg);
  assert.equal(leidos.porDevanado.P.estado, 'sinSenal'); assert.equal(leidos.porDevanado.P.motivo, null);
  const nada = estadoDevanados([mes('2026-01', { leido: false, eqPct: null, motivoNulo: 'no se pudo leer este mes' })], reg);
  assert.equal(nada.algunoLeido, false);
  assert.equal(nada.porDevanado.P.estado, 'sinLectura'); assert.equal(nada.porDevanado.S.estado, 'sinLectura');
});

test('estado: la cifra a la fecha sale del último mes con acumulada', () => {
  const serie = [mes('2026-01', { dev: { S: { niveles: ['13.8'], pct: 55, iP99: 380 } } }), mes('2026-02', { dev: { S: { niveles: ['13.8'], pct: 61, iP99: 410 } } })];
  const e = estadoDevanados(serie, [{ d: 'S' }]);
  assert.equal(e.conCifraEq.mes, '2026-02'); assert.equal(e.porDevanado.S.hoy.iP99, 410);
});

test('umbrales: cada corriente lleva su origen (impresa/calculada/plataforma); el terciario de compensación queda sin límite', () => {
  const u = umbralesDevanado({ d: 'S', A: 209.2, mva: 5, kv: 13.8 },
    { S: { kva: [4000, 5000], nombres: ['ONAN', 'ONAF1'], kv: 13.8, A: [167.4, 209.2], origenA: ['impresa', 'calculada'] } });
  assert.deepEqual(u.etapas.map((e) => e.origen), ['impresa', 'calculada']);
  assert.equal(umbralesDevanado({ d: 'P', A: 100, mva: 6, kv: 34.5 }, null).onaf.origen, 'plataforma');
  const t = umbralesDevanado({ d: 'T', A: 400, mva: 9.6, kv: 13.8 }, { T: { kva: null, A: null, sinLimite: true, compensa: true, kv: 6.6 } });
  assert.equal(t.sinLimite, true); assert.equal(t.etapas.length, 0); assert.equal(pctDe(300, t.onaf), null); assert.equal(t.difA, false);
});
