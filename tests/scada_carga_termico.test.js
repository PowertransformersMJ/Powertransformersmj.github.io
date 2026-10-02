// Cargabilidad SCADA · punto caliente ESTIMADO (IEC 60076-7) y ritmo de cada gas con más carga (`99 §132`). Datos SINTÉTICOS.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { simularTermico, envejecimientoRelativo, arrheniusRelativo, ritmoGases, tendenciaDuval, TERMICO_ONAF as P, AMBIENTE_SUPUESTO as TA, EA_CO_CO2_KJ, HUECO_MAX_H } from '../assets/js/domain/scada_carga_termico.js';

const cte = (v, n = 240) => Float32Array.from({ length: n }, () => v);
const permanente = (K) => TA + P.dThetaOr * Math.pow((1 + P.R * K * K) / (1 + P.R), P.x) + P.dThetaHr * Math.pow(K, P.y);

describe('modelo térmico IEC 60076-7 (escenario)', () => {
  test('constantes de IEC 60076-7:2018 (Tabla 4 ONAF y ejemplo K.1): 20 + 52 + 26 = 98 °C a carga nominal', () => {
    assert.deepEqual([P.x, P.y, P.k11, P.k21, P.k22, P.tauO, P.tauW, P.R, P.dThetaOr, P.dThetaHr], [0.8, 1.3, 0.5, 2, 2, 150, 7, 6, 52, 26]);
    assert.ok(Math.abs(simularTermico(cte(100), 1, { thetaA: 20 }).thetaHMax - 98) < 0.01);
  });
  test('carga constante = régimen permanente de la norma', () => {
    for (const pct of [40, 75, 100, 125]) {
      const r = simularTermico(cte(pct));
      assert.ok(Math.abs(r.thetaHMax - permanente(pct / 100)) < 0.05, pct + ': ' + r.thetaHMax);
    }
  });
  test('un escalón llega al permanente nuevo (constantes de tiempo, paso de 1 min estable)', () => {
    const serie = Float32Array.from({ length: 72 }, (_, h) => (h < 24 ? 50 : 110));
    const r = simularTermico(serie);
    assert.ok(Math.abs(r.thetaHMax - permanente(1.1)) < 1.5, String(r.thetaHMax));
    assert.ok(Number.isFinite(r.vMedio) && r.vMedio > 0);
  });
  test('el escenario × f es la misma curva aumentada parejo', () => {
    const a = simularTermico(cte(100), 1.2); const b = simularTermico(cte(120));
    assert.ok(Math.abs(a.thetaHMax - b.thetaHMax) < 1e-9);
  });
  test('huecos cortos (≤ 2 h) se rellenan con la hora anterior; los del comienzo se saltan', () => {
    const s = cte(80, 48); s[0] = NaN; s[1] = NaN; s[20] = NaN; s[30] = NaN; s[31] = NaN;
    const r = simularTermico(s);
    assert.equal(HUECO_MAX_H, 2); assert.equal(r.horas, 46); assert.equal(r.rellenadas, 3); assert.equal(r.sinDato, 0);
    assert.equal(simularTermico(Float32Array.from([NaN, NaN])), null);
  });
  test('un hueco largo NO inventa horas calientes: queda fuera y el cálculo arranca de nuevo (revisión 2026-10-02)', () => {
    const s = Float32Array.from({ length: 2160 }, () => 60); s[1000] = 125;
    const sinHueco = simularTermico(s, 1.2);
    for (let h = 1001; h <= 1720; h++) s[h] = NaN;   // un mes sin SCADA justo después del pico
    const conHueco = simularTermico(s, 1.2);
    assert.equal(conHueco.sinDato, 720); assert.equal(conHueco.horas, 2160 - 720);
    assert.ok(conHueco.horasSobre[140] <= sinHueco.horasSobre[140], JSON.stringify(conHueco.horasSobre));
    assert.ok(conHueco.thetaHMax <= sinHueco.thetaHMax + 1e-9);
    const cola = cte(70, 30); for (let h = 25; h < 30; h++) cola[h] = NaN;  // horas del final aún sin dato
    assert.equal(simularTermico(cola).sinDato, 5); assert.equal(simularTermico(cola).horas, 25);
  });
  test('envejecimiento del papel no mejorado: Tabla 1 de la norma (80 → 0,125; 98 → 1; 110 → 4; 140 → 128)', () => {
    for (const [t, v] of [[80, 0.125], [98, 1], [110, 4], [140, 128]]) assert.ok(Math.abs(envejecimientoRelativo(t) - v) < 1e-9, String(t));
    assert.equal(envejecimientoRelativo(NaN), null);
  });
  test('el CO + CO₂ medido en laboratorio es mucho menos sensible a la temperatura que el envejecimiento', () => {
    assert.ok(Math.abs(arrheniusRelativo(98, EA_CO_CO2_KJ) - 1) < 1e-12);
    const co = arrheniusRelativo(110, EA_CO_CO2_KJ); const v = envejecimientoRelativo(110);
    assert.ok(co > 1.4 && co < 1.6, String(co)); assert.ok(v / co > 2.5);
  });
  test('el extremo bajo del CO + CO₂ usa la temperatura media del devanado: queda por debajo del de punto caliente', () => {
    const hoy = simularTermico(cte(100)); const mas = simularTermico(cte(100), 1.2);
    const bajo = mas.coMedio / hoy.coMedio; const alto = mas.vMedio / hoy.vMedio;
    const enPuntoCaliente = arrheniusRelativo(mas.thetaHMax, EA_CO_CO2_KJ) / arrheniusRelativo(hoy.thetaHMax, EA_CO_CO2_KJ);
    assert.ok(bajo > 1 && bajo < enPuntoCaliente && enPuntoCaliente < alto, [bajo, enPuntoCaliente, alto].join(' '));
  });
});

describe('ritmo de cada gas con más carga (no ppm)', () => {
  test('falla térmica: rango × 1 (núcleo) a al menos × f² (conexión o contacto); CO y CO₂ con su rango', () => {
    const r = ritmoGases({ zona: 'T3', concluyente: true, f: 1.2, rangoPapel: [1.3, 3.5] });
    for (const g of ['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2']) {
      assert.equal(r[g].origen, 'corriente'); assert.equal(r[g].rango[0], 1); assert.ok(Math.abs(r[g].rango[1] - 1.44) < 1e-12); assert.equal(r[g].altoEsMinimo, true);
    }
    assert.deepEqual([r.CO.origen, r.CO.factor, r.CO.rango, r.CO2.rango], ['papel', null, [1.3, 3.5], [1.3, 3.5]]);
  });
  test('descargas: × 1; mixta DT: H₂ y C₂H₂ de descarga, el resto de corriente', () => {
    const pd = ritmoGases({ zona: 'PD', concluyente: true, f: 1.3, rangoPapel: [1.2, 2] });
    assert.deepEqual([pd.H2.factor, pd.C2H2.factor, pd.CH4.origen], [1, 1, 'descarga']);
    const dt = ritmoGases({ zona: 'DT', concluyente: true, f: 1.1, rangoPapel: [1.1, 2] });
    assert.deepEqual([dt.H2.origen, dt.C2H2.origen, dt.C2H4.origen], ['descarga', 'descarga', 'corriente']);
  });
  test('sin gas suficiente: no se proyecta un ritmo de falla, pero el papel sí envejece', () => {
    const r = ritmoGases({ zona: 'T2', concluyente: false, f: 1.2, rangoPapel: [1.2, 2.4] });
    assert.equal(r.CH4.factor, null); assert.equal(r.CH4.origen, 'sin_falla'); assert.deepEqual(r.CO2.rango, [1.2, 2.4]);
  });
  test('tendencia en el triángulo: dirección, nunca posición', () => {
    assert.equal(tendenciaDuval('T2', true).tipo, 'flecha'); assert.equal(tendenciaDuval('T3', true).tipo, 'flecha');
    assert.equal(tendenciaDuval('D2', true).tipo, 'quieto'); assert.equal(tendenciaDuval('T2', false), null);
    assert.match(tendenciaDuval('DT', true).texto, /parte térmica/); assert.doesNotMatch(tendenciaDuval('DT', true).texto, /T1 o T2/);
  });
});
