// Triángulo de Duval 1 (`99 §131`) — fronteras de Duval 2002 Fig. 1, puerta de gas significativo (USBR FIST 3-31),
// proyección de carga y carga «solo gases». Valores SINTÉTICOS (ningún equipo real).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  zonaDuval1, distanciaFrontera, significancia, leerUltimaDGA, coherenciaConCalificaciones, duvalDeEquipo,
  POLIGONOS_DUVAL1, ZONAS_DUVAL1, REFERENCIA_SIGNIFICANCIA,
} from '../assets/js/domain/dga_duval.js';
import { margenesCarga, escenarioCarga, corrienteReferencia } from '../assets/js/domain/scada_carga_proyeccion.js';
import { gasesDeFila, planCargaGases, ultimaDgaDeFila } from '../assets/js/domain/dga_ppm_excel.js';
import { parsearFilaTransformador, procesarLibro } from '../assets/js/domain/importador.js';
import { cruceDgaCarga, columnaGases, leerGases } from '../assets/js/domain/scada_carga_dga.js';
import { serieCargabilidad, horasSostenidasSobre } from '../assets/js/domain/scada_carga_kpis.js';

/** Regla de referencia (la de pages/parque-transformadores.html, ya correcta) para la comparación en malla. */
function referencia(M, E, A) {
  if (M >= 98) return 'PD';
  if (A < 4) return E < 20 ? 'T1' : (E < 50 ? 'T2' : 'T3');
  if (E >= 50 && A < 15) return 'T3';
  if (A < 13) return 'DT';
  if (E < 23) return 'D1';
  if (A >= 29) return 'D2';
  if (E < 40) return 'D2';
  return 'DT';
}

describe('zonaDuval1 (Duval 2002, Fig. 1)', () => {
  test('puntos de referencia, incluidos los que la regla vieja clasificaba mal', () => {
    const casos = [
      [99, 1, 0, 'PD'], [85, 15, 0, 'T1'], [60, 40, 0, 'T2'], [40, 60, 0, 'T3'],
      [30, 60, 10, 'T3'], [30, 56, 14, 'T3'], [20, 70, 10, 'T3'],          // T3 con C₂H₂ hasta 15 %
      [10, 10, 80, 'D1'], [50, 5, 45, 'D1'], [70, 10, 20, 'D1'], [87, 0, 13, 'D1'],   // D1 (la vieja decía D2)
      [70, 20, 10, 'DT'], [60, 30, 10, 'DT'], [96, 0, 4, 'DT'], [90, 5, 5, 'DT'],    // DT (la vieja decía D1)
      [50, 35, 15, 'D2'], [20, 30, 50, 'D2'], [10, 60, 30, 'D2'], [31, 40, 29, 'D2'],
      [30, 45, 25, 'DT'], [30, 55, 15, 'DT'],
    ];
    for (const [m, e, a, z] of casos) assert.equal(zonaDuval1(m, e, a).zona, z, m + '/' + e + '/' + a);
  });
  test('una frontera exacta no se pierde por redondeo (29 % de C₂H₂)', () => {
    assert.equal(zonaDuval1(31, 40, 29).pct.C2H2, 29);
    assert.equal(zonaDuval1(31, 40, 29).zona, 'D2');
  });
  test('malla de 0,5 % sobre todo el triángulo: idéntica a la regla de referencia', () => {
    let n = 0;
    for (let a = 0; a <= 100; a += 0.5) for (let e = 0; e <= 100 - a; e += 0.5) {
      const m = 100 - a - e; if (m < 0) continue;
      const z = zonaDuval1(m, e, a); if (!z) continue;
      assert.equal(z.zona, referencia(z.pct.CH4, z.pct.C2H4, z.pct.C2H2)); n++;
    }
    assert.ok(n > 20000);
  });
  test('un gas que falta no es cero; sin gases no hay punto ni zona «normal»', () => {
    assert.equal(zonaDuval1(10, null, 2), null);
    assert.equal(zonaDuval1(0, 0, 0), null);
    assert.equal(zonaDuval1(-1, 5, 2), null);
  });
  test('los polígonos cubren el triángulo sin solaparse (centroide de cada uno en su zona)', () => {
    for (const [z, pts] of Object.entries(POLIGONOS_DUVAL1)) {
      const c = pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
      assert.equal(zonaDuval1(c[0], c[1], c[2]).zona, z, z);
      assert.ok(ZONAS_DUVAL1[z]);
    }
  });
});

describe('distancia a la frontera y gas significativo', () => {
  test('distancia en puntos a la zona vecina', () => {
    const d = distanciaFrontera(zonaDuval1(50, 45, 5).pct);
    assert.ok(d.puntos > 1 && d.puntos <= 1.1); assert.equal(d.zona, 'T2');
  });
  test('USBR FIST 3-31 Tabla 3 (L1) + suma mínima de criterio', () => {
    assert.deepEqual(REFERENCIA_SIGNIFICANCIA.L1, { H2: 100, CH4: 75, C2H2: 3, C2H4: 75, C2H6: 75 });
    assert.equal(significancia({ CH4: 3, C2H4: 3, C2H2: 0.5, H2: 10, C2H6: 1 }).significativo, false);   // < 10 ppm
    assert.equal(significancia({ CH4: 30, C2H4: 20, C2H2: 0, H2: 50, C2H6: 10 }).significativo, false);  // nada en L1
    assert.equal(significancia({ CH4: 30, C2H4: 20, C2H2: 3, H2: 50, C2H6: 10 }).significativo, true);   // C₂H₂ en L1
    assert.equal(significancia({ CH4: 30, C2H4: 20, C2H2: 0, H2: 150, C2H6: 10 }).significativo, true);  // H₂ en L1
    assert.equal(significancia({ CH4: 30, C2H2: 0 }).significativo, false);                               // falta C₂H₄
  });
});

const sa = { calif_tdgc: 2, calif_c2h2: 1, calif_co: 2, calif_co2: 2, eval_dga: 2 };
const txCon = (gases, salud = sa) => ({ id: 'x', salud_actual: salud, ultima_dga: { gases, fuente: 'salud_activos', archivo: 'demo.xlsx', importado_en: '2026-10-02T00:00:00Z', fecha_toma: null } });
const G = { H2: 40, CH4: 80, C2H4: 30, C2H6: 10, C2H2: 0, CO: 200, CO2: 2000 };

describe('última DGA del equipo', () => {
  test('lee el campo de la raíz; un gas sin valor queda null', () => {
    const u = leerUltimaDGA(txCon({ ...G, CO2: 'x' }));
    assert.equal(u.gases.CO2, null); assert.equal(u.gases.CH4, 80); assert.equal(u.fecha_toma, null);
    assert.equal(leerUltimaDGA({}), null);
    assert.equal(leerUltimaDGA({ ultima_dga: { gases: {} } }), null);
  });
  test('coherencia: los ppm deben dar las mismas calificaciones que tiene el equipo', () => {
    assert.equal(coherenciaConCalificaciones(G, sa, null).coherente, true);
    const otra = coherenciaConCalificaciones({ ...G, C2H2: 8 }, sa, null);
    assert.equal(otra.coherente, false); assert.deepEqual(otra.diferencias, ['calif_c2h2']);
  });
  test('estados de la vista', () => {
    assert.equal(duvalDeEquipo({}).estado, 'sin_ppm');
    assert.equal(duvalDeEquipo(txCon({ ...G, C2H4: null })).estado, 'faltan');
    assert.equal(duvalDeEquipo(txCon({ ...G, CH4: 0, C2H4: 0, C2H2: 0 })).estado, 'sin_punto');
    assert.equal(duvalDeEquipo(txCon({ ...G, C2H2: 8 })).estado, 'incoherente');
    const ok = duvalDeEquipo(txCon(G));
    assert.equal(ok.estado, 'ok'); assert.equal(ok.zona, 'T2'); assert.ok(ok.frontera);
    const bajo = duvalDeEquipo(txCon({ H2: 5, CH4: 3, C2H4: 2, C2H6: 1, C2H2: 0, CO: 50, CO2: 500 }, { calif_tdgc: 1, calif_c2h2: 1, calif_co: 1, calif_co2: 1 }));
    assert.equal(bajo.estado, 'no_concluyente');
    assert.deepEqual([bajo.significancia.sobreL1, bajo.significancia.sumaBaja], [[], true], 'fondo de verdad: nada pasa L1');
    // H₂ alto con el triángulo casi vacío: no concluyente, pero NO es «fondo» (la pantalla nombra el H₂)
    const h2 = significancia({ H2: 500, CH4: 3, C2H4: 2, C2H6: 1, C2H2: 0 });
    assert.deepEqual([h2.significativo, h2.sobreL1, h2.sumaBaja], [false, ['H2'], true]);
  });
});

describe('proyección de carga', () => {
  const entrada = { pct: 70, crg: 3, clase: 'firme', horasSobre100: 0, max2h: 72, picoMax: 74 };
  test('márgenes exactos hasta cada franja', () => {
    const m = margenesCarga(entrada, null);
    assert.deepEqual(m.map((x) => [x.fila, x.ya, x.pct]), [['R1', false, 7.1], ['R2', false, 28.6], ['R3', false, 38.9], ['R4', false, 80.6]]);
    const prov = margenesCarga({ ...entrada, clase: 'provisional' }, null);
    assert.ok(!prov.some((x) => x.fila === 'R4'), 'sin cifra firme no hay fila severa');
    const ya = margenesCarga({ ...entrada, pct: 95, crg: 5, horasSobre100: 3, max2h: 104 }, null);
    assert.deepEqual(ya.slice(0, 3).map((x) => x.ya), [true, true, true]);
    // ya en R3 (2 h sobre el 100 %) con la cifra baja: R1 y R2 quedan por debajo, sin margen engañoso
    const r3 = margenesCarga({ ...entrada, pct: 72, crg: 3, horasSobre100: 3, max2h: 105 }, null);
    assert.deepEqual(r3.map((x) => [x.fila, x.ya, x.superada, x.pct]), [['R1', true, true, null], ['R2', true, true, null], ['R3', true, false, null], ['R4', false, false, 23.8]]);
    assert.deepEqual(margenesCarga({ pct: null }, null), []);
  });
  test('el escenario de hoy (+0 %) da el mismo nivel que el panel de gases y carga', () => {
    const A = 100; const serie = Float32Array.from({ length: 200 }, (_, h) => (h >= 50 && h < 53 ? 104 : 88));
    const carga = serieCargabilidad(serie, A);
    const calc = { pct: 95, crg: 5, clase: 'firme', devMax: 'S', motivoNulo: null, niveles: [{ nivel: 'N13_8', devanado: 'S', pct: 95, A }] };
    const porNivel = { N13_8: { carga, sobre: horasSostenidasSobre(carga.serie, 100, 2) } };
    const tx = { salud_actual: { eval_dga: 3, calif_tdgc: 2, calif_co: 4, calif_co2: 3, calif_c2h2: 1 } };
    const e = { ...entrada, pct: 95, crg: 5, horasSobre100: 3, max2h: 104 };
    const cg = columnaGases(leerGases(tx));
    const hoy = escenarioCarga(e, calc, porNivel, cg, 0, null);
    const panel = cruceDgaCarga(tx, e, { adversidades: [], acciones: [] });
    assert.equal(hoy.nivel.n, panel.nivel.n); assert.equal(hoy.horasSobre100, 3); assert.equal(hoy.perdidas, 1);
    const mas = escenarioCarga(e, calc, porNivel, cg, 20, null);
    assert.equal(mas.horasSobre100, 200, 'al 120 % todas las horas pasan del 100 %'); assert.equal(Math.round(mas.perdidas * 100), 144);
  });
  test('corriente de referencia del devanado que manda', () => {
    assert.equal(corrienteReferencia({ pct: 80, devMax: 'S', niveles: [{ devanado: 'S', pct: 80, A: 500 }] }), 400);
    assert.equal(corrienteReferencia({ pct: null }), null);
  });
});

describe('carga «solo gases» desde el Excel', () => {
  test('gases de la fila: cabeceras del archivo, coma decimal, N/D y «<1» quedan null', () => {
    const g = gasesDeFila({ H2: '9,2', CH4: '3.1', C2H4: 'N/D', C2H6: '<1', C2H2: 0, CO: '332', CO2: '1.992,5', 'EVALUACION CO': 2 });
    assert.deepEqual(g, { H2: 9.2, CH4: 3.1, C2H4: null, C2H6: null, C2H2: 0, CO: 332, CO2: 1992.5 });
    assert.equal(gasesDeFila({ MATRICULA: 'X' }), null);
    assert.equal(ultimaDgaDeFila({ CH4: 5 }, { archivo: 'a.xlsx', ahoraISO: 'hoy' }).fecha_toma, null);
  });
  test('plan: cruza por matrícula; iguales, sin coincidencia, repetidas y sin gases', () => {
    const parque = [
      { id: '1', codigo: 'T1-DEMO', identificacion: { matricula: 'T1-DEMO' } },
      { id: '2', codigo: 'T2-DEMO', ultima_dga: { gases: { H2: 1, CH4: 2, C2H4: 3, C2H6: 4, C2H2: 0, CO: 5, CO2: 6 } } },
      { id: '3', codigo: 'T3-DOBLE' }, { id: '4', codigo: 'T3-DOBLE' },
    ];
    const filas = [
      { MATRICULA: 't1-demo ', H2: 10, CH4: 20, C2H4: 30, C2H6: 1, C2H2: 0, CO: 100, CO2: 1000 },
      { MATRICULA: 'T2-DEMO', H2: 1, CH4: 2, C2H4: 3, C2H6: 4, C2H2: 0, CO: 5, CO2: 6 },
      { MATRICULA: 'T3-DOBLE', CH4: 1 }, { MATRICULA: 'T9-NADA', CH4: 1 }, { MATRICULA: 'T1-DEMO', CH4: 99 },
      { MATRICULA: 'T5-SIN' },
    ];
    const p = planCargaGases(filas, parque, { archivo: 'demo.xlsx', ahoraISO: 'hoy' });
    // T1-DEMO viene dos veces: es ambigua (en un Excel real eran dos equipos) → no se escribe ninguna de sus filas
    assert.deepEqual(p.escribir.map((x) => x.id), []);
    assert.deepEqual(p.iguales, ['T2-DEMO']); assert.deepEqual(p.sinCoincidencia, ['T3-DOBLE', 'T9-NADA']);
    assert.deepEqual(p.repetidas, ['T1-DEMO']); assert.deepEqual(p.sinGases, ['T5-SIN']);
    const una = planCargaGases(filas.filter((f, i) => i !== 4), parque, { archivo: 'demo.xlsx', ahoraISO: 'hoy' });
    assert.deepEqual(una.escribir.map((x) => x.id), ['1']); assert.equal(una.escribir[0].ultima_dga.gases.C2H4, 30);
    assert.deepEqual(una.repetidas, []);
  });
  test('la importación completa también entrega los ppm (para no desfasarlos de la calificación)', () => {
    const r = parsearFilaTransformador({ codigo: 'TX-01', nombre: 'Demo', departamento: 'BOLIVAR', H2: '12', CH4: '30', C2H4: '5', C2H6: '2', C2H2: 'N/D', CO: '250', CO2: '2000' }, 'TX_Potencia');
    assert.deepEqual(r.gasesPpm, { H2: 12, CH4: 30, C2H4: 5, C2H6: 2, C2H2: null, CO: 250, CO2: 2000 });
    assert.equal(parsearFilaTransformador({ codigo: 'TX-02', nombre: 'Demo', departamento: 'BOLIVAR' }, 'TX_Potencia').gasesPpm, null);
    const { resultados } = procesarLibro([{ hoja: 'TX_Potencia', filas: [{ codigo: 'TX-03', nombre: 'D', departamento: 'BOLIVAR', CH4: '4' }] }]);
    assert.equal(resultados[0].gasesPpm.CH4, 4);
  });
});
