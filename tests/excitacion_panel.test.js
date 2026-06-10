// Helpers puros del panel de Corriente de Excitación (ui/pruebas/excitacion-panel.js).
// Mismo enfoque que tand_panel.test.js: se prueban las funciones de dominio sin DOM.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nivelDe, fasesDe, perdidasDe, tapsDe, evaluarPatron, analizarExcitacion } from '../assets/js/ui/pruebas/excitacion-panel.js';

// Bloque de excitación: 3 series (Fase A/B/C), cada punto {x:TAP, y:mA, extra:{"P (W)":w}}.
// taps = [[tap, A, B, C, [wA, wB, wC]?], …]
const bloque = (titulo, taps) => ({ titulo, prueba: 'excitacion', unidad: 'mA', series: ['A', 'B', 'C'].map((f, i) => ({
  nombre: 'Fase ' + f,
  puntos: taps.map((row) => { const p = { x: row[0], y: row[1 + i] }; const w = row[4]; if (w && w[i] != null) p.extra = { 'P (W)': w[i] }; return p; }),
})) });
// Un "rep" para analizarExcitacion: med por (rep × nivel × TAP).
const med = (rep, nivel, tap, fases, ev, wfases) => ({ rep, nivel, tap, fases, wfases: wfases || {}, ev });
const evalDe = (A, B, C, config) => evaluarPatron({ A, B, C }, config || '');

describe('nivelDe · devanado + tensión nominal según grupo vectorial', () => {
  test('AT delta → 66 kV (el "10 kV" del título es la tensión de ensayo)', () => {
    const n = nivelDe('Corriente de excitación AT por TAP - 10 kV', 'delta');
    assert.equal(n.dev, 'AT'); assert.equal(n.kv, 66); assert.equal(n.testKv, 10); assert.equal(n.label, 'AT · 66 kV');
  });
  test('AT estrella → 110 kV', () => {
    const n = nivelDe('Corriente de excitación AT por TAP - 10 kV', 'estrella');
    assert.equal(n.kv, 110); assert.equal(n.label, 'AT · 110 kV');
  });
  test('AT 66 kV explícito (no ensayo) → 66 kV', () => {
    const n = nivelDe('Corriente de excitación AT por TAP - 66 kV', 'delta');
    assert.equal(n.kv, 66); assert.equal(n.testKv, null);
  });
  test('MT → 34.5 kV; BT/Terciario → 13.8 kV', () => {
    assert.equal(nivelDe('Corriente de excitación MT por TAP - 34.5 kV', '').kv, 34.5);
    assert.equal(nivelDe('Corriente de excitación BT por TAP - 10 kV', '').kv, 13.8);
    assert.equal(nivelDe('Corriente terciario por TAP - 10 kV', '').dev, 'Terciario');
  });
});

describe('fasesDe / tapsDe / perdidasDe · lectura de series por TAP', () => {
  const b = bloque('AT - 10 kV', [
    [1, 18, 13, 18, [156, 110, 158]],
    [2, 20, 14, 20, [170, 120, 172]],
  ]);
  test('fasesDe filtra por TAP', () => {
    assert.deepEqual(fasesDe(b, 1), { A: 18, B: 13, C: 18 });
  });
  test('fasesDe sin TAP promedia todas las posiciones', () => {
    assert.deepEqual(fasesDe(b, null), { A: 19, B: 13.5, C: 19 });
  });
  test('tapsDe ordena numéricamente', () => {
    assert.deepEqual(tapsDe(b), ['1', '2']);
  });
  test('perdidasDe lee extra["P (W)"] por fase y por TAP', () => {
    assert.deepEqual(perdidasDe(b, 1), { A: 156, B: 110, C: 158 });
  });
  test('perdidasDe devuelve {} cuando el informe NO trae W', () => {
    const sinW = bloque('AT - 10 kV', [[1, 18, 13, 18]]);
    assert.deepEqual(perdidasDe(sinW, 1), {});
  });
});

describe('evaluarPatron · patrón 2+1 + simetría de externas', () => {
  test('externas similares + central distinta → ok (forma 2+1)', () => {
    const ev = evalDe(28, 22, 28, 'estrella');
    assert.equal(ev.externasSimilares, true);
    assert.equal(ev.formaOk, true);
    assert.equal(ev.ok, true);
    assert.equal(ev.patron, 'HLH'); // central B la menor
  });
  test('central la menor en delta también es forma OK (geometría manda, dir informativa)', () => {
    const ev = evalDe(28, 22, 28, 'delta');
    assert.equal(ev.ok, true);
    assert.equal(ev.patron, 'HLH');
    assert.equal(ev.dirEsperada, 'LHL'); // libro dice LHL en delta…
    assert.equal(ev.dirCoincide, false); // …pero NO entra al criterio
  });
  test('externas desbalanceadas → roto (posible espira)', () => {
    const ev = evalDe(30, 22, 24, 'estrella'); // Δ ext = |30-24|/27 ≈ 22%
    assert.equal(ev.externasSimilares, false);
    assert.equal(ev.ok, false);
    assert.equal(ev.estado, 'roto');
    assert.equal(ev.faseAlta, 'A');
  });
  test('patrón plano (central no se distingue) → no ok', () => {
    const ev = evalDe(20, 20, 20, 'estrella');
    assert.equal(ev.formaOk, false);
    assert.equal(ev.ok, false);
    assert.equal(ev.estado, 'plano');
  });
  test('lecturas incompletas → null', () => {
    assert.equal(evaluarPatron({ A: 10, B: null, C: 12 }, ''), null);
  });
});

describe('analizarExcitacion · veredicto + tendencia + pérdidas', () => {
  const r2021 = { id: 'a', label: '2021', ano: 2021, config: 'delta' };
  const r2024 = { id: 'b', label: '2024', ano: 2024, config: 'delta' };
  test('sin mediciones → null', () => {
    assert.equal(analizarExcitacion([]), null);
  });
  test('todo sano → 0 fuera de criterio en ambas normas', () => {
    const m = [med(r2021, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta'))];
    const d = analizarExcitacion(m);
    assert.equal(d.porNorma[1].superan, 0); // IEEE
    assert.equal(d.porNorma[0].superan, 0); // NETA patrón
    assert.equal(d.hallazgos.length, 0);
  });
  test('peor caso = mayor Δ externas', () => {
    const m = [
      med(r2021, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta')),
      med(r2024, 'AT · 66 kV', 1, { A: 30, B: 22, C: 24 }, evalDe(30, 22, 24, 'delta')),
    ];
    const d = analizarExcitacion(m);
    assert.equal(d.peor.rep.id, 'b');
    assert.equal(d.hallazgos.length, 1);
  });
  test('tendencia de pérdidas (W): Δ% entre baseline y último cuando AMBOS traen W', () => {
    const m = [
      med(r2021, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta'), { A: 180, B: 130, C: 180 }),
      med(r2024, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta'), { A: 198, B: 143, C: 198 }),
    ];
    const t = analizarExcitacion(m).tendencias.find((x) => x.nivel === 'AT · 66 kV');
    assert.equal(t.hayW, true);
    assert.equal(t.wIni, 490); // 180+130+180
    assert.equal(t.wFin, 539); // 198+143+198
    assert.equal(t.dW, 10); // +10%
  });
  test('si el informe final NO trae W → NO se compara contra 0 (sin falso Δ -100%)', () => {
    const m = [
      med(r2021, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta'), { A: 180, B: 130, C: 180 }),
      med(r2024, 'AT · 66 kV', 1, { A: 28, B: 22, C: 28 }, evalDe(28, 22, 28, 'delta')), // sin W
    ];
    const t = analizarExcitacion(m).tendencias.find((x) => x.nivel === 'AT · 66 kV');
    assert.equal(t.hayW, false);
    assert.equal(t.dW, null);
  });
});
