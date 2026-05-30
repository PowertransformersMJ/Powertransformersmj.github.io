// Integración del DataService de Pruebas Eléctricas.
//
// NOTA de alcance: el data layer real (assets/js/data/pruebas_electricas.js)
// importa el SDK de Firestore/Storage desde el CDN de gstatic, que no es
// resoluble en Node sin red. Por eso aquí NO importamos ese módulo:
// probamos el CONTRATO que el DataService garantiza, con sus piezas
// importables y deterministas —
//   1) el schema de dominio que sanitiza/valida cada write,
//   2) la verificación de serie del flujo de carga (paso 3 del modal),
//   3) el fixture seed reconstruido con el MISMO schema, pasado por los
//      calificadores reales de la UI, para verificar que la cadena
//      datos → semáforo produce los estados del tablero original.
// Esto cubre la capa de procesamiento de datos sin requerir Firestore.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarUnidad, validarUnidad,
  sanitizarInforme, validarInforme,
  confirmarSerie, CONFIGS_TAND
} from '../assets/js/domain/pruebas_electricas_schema.js';
import { calificarPrueba } from '../assets/js/ui/pruebas/semaforo.js';

/* ─── Reconstrucción del seed (idéntico a SEED_LOCAL del data layer) ── */
// Si el data layer cambia su seed, este fixture debe seguirlo para que
// el test refleje lo que la vista muestra offline.
function seedInformes() {
  return [2012, 2014, 2020].map((ano, i) => sanitizarInforme({
    unidadId: '173523-15510', serie: '173523-15510', ano,
    tand: [
      { code: 'CH',  valor_pct: [0.39, 0.42, 0.146][i] },
      { code: 'CHL', valor_pct: [0.27, 0.34, 0.100][i] },
      { code: 'CL',  valor_pct: [1.23, 1.52, 0.192][i] },
      { code: 'CLT', valor_pct: [0.24, 0.32, 0.089][i] },
      { code: 'CT',  valor_pct: [0.49, 0.67, 0.334][i] },
      { code: 'CHT', valor_pct: [0.54, 0.66, 0.054][i] }
    ],
    excitacion:  { delta_pct: [4.41, 4.83, 3.02][i], corriente_ma: 12 },
    relacion:    { desviacion_pct: [0.13, 0.31, 0.23][i] },
    resistencia: { desbalance_pct: [2, 3, null][i], verificar: i === 2 },
    aislamiento: { gohm: [null, 2.5, null][i] },
    collar:      { mw: [49, 56, 57.9][i] }
  }));
}

describe('sanitizarUnidad', () => {
  test('mapea campos y fija schema_version=1', () => {
    const u = sanitizarUnidad({ serie: ' 173523-15510 ', ano_fabricacion: '1998' });
    assert.equal(u.serie, '173523-15510');     // trim
    assert.equal(u.ano_fabricacion, 1998);     // int
    assert.equal(u.schema_version, 1);
  });
  test('campos ausentes caen a strings vacíos / null', () => {
    const u = sanitizarUnidad({});
    assert.equal(u.serie, '');
    assert.equal(u.ano_fabricacion, null);
    assert.equal(u.transformadorId, '');
  });
});

describe('validarUnidad', () => {
  test('exige serie', () => {
    assert.deepEqual(validarUnidad({ serie: '' }).length > 0, true);
    assert.deepEqual(validarUnidad({ serie: 'X' }), []);
  });
  test('rechaza año de fabricación fuera de rango', () => {
    assert.equal(validarUnidad({ serie: 'X', ano_fabricacion: 1800 }).length, 1);
    assert.equal(validarUnidad({ serie: 'X', ano_fabricacion: 2200 }).length, 1);
  });
});

describe('sanitizarInforme', () => {
  test('normaliza tand (uppercase code, coma decimal) y descarta vacíos', () => {
    const inf = sanitizarInforme({
      serie: 'S', ano: 2020,
      tand: [{ code: 'ch', valor_pct: '0,39' }, { code: '', valor_pct: 1 }]
    });
    assert.equal(inf.tand.length, 1);
    assert.equal(inf.tand[0].code, 'CH');
    assert.equal(inf.tand[0].valor_pct, 0.39);  // coma → punto
  });
  test('pdf.estado por defecto = pendiente_extraccion', () => {
    const inf = sanitizarInforme({ serie: 'S', ano: 2020 });
    assert.equal(inf.pdf.estado, 'pendiente_extraccion');
  });
  test('flag verificar se castea a bool', () => {
    const inf = sanitizarInforme({ serie: 'S', ano: 2020, resistencia: { verificar: 'true' } });
    assert.equal(inf.resistencia.verificar, true);
  });
});

describe('validarInforme', () => {
  test('exige serie y año, valida rango de año', () => {
    assert.equal(validarInforme({ serie: '', ano: 2020 }).length, 1);
    assert.equal(validarInforme({ serie: 'S' }).length, 1);            // sin año
    assert.equal(validarInforme({ serie: 'S', ano: 1800 }).length, 1); // fuera de rango
    assert.deepEqual(validarInforme({ serie: 'S', ano: 2020 }), []);
  });
  test('rechaza tan δ negativa', () => {
    const errs = validarInforme({ serie: 'S', ano: 2020, tand: [{ code: 'CH', valor_pct: -1 }] });
    assert.equal(errs.length, 1);
  });
});

describe('confirmarSerie (paso 3 del flujo de carga)', () => {
  test('coincide ignorando espacios y guiones', () => {
    const r = confirmarSerie('173523-15510', 'Serie  173523 15510  Siemens');
    assert.equal(r.coincide, true);
    assert.equal(r.encontrada, true);
  });
  test('no coincide cuando el PDF trae otra serie', () => {
    const r = confirmarSerie('173523-15510', 'Equipo serie 999999');
    assert.equal(r.coincide, false);
  });
  test('serie vacía → no coincide', () => {
    assert.equal(confirmarSerie('', 'cualquier texto').coincide, false);
  });
});

describe('integración datos → semáforo (seed = tablero original)', () => {
  const informes = seedInformes();
  const byAno = (a) => informes.find((i) => i.ano === a);

  test('CL 2012/2014 fuera de norma se refleja en tan δ (peor celda roja)', () => {
    // CL=1.23 (2012) y 1.52 (2014) > 1.0 → la peor config de tand es roja
    assert.equal(calificarPrueba('tand', byAno(2012)).estado.clase, 'b-r');
    assert.equal(calificarPrueba('tand', byAno(2014)).estado.clase, 'b-r');
  });
  test('tan δ 2020 vuelve a verde (recuperación)', () => {
    assert.equal(calificarPrueba('tand', byAno(2020)).estado.clase, 'b-g');
  });
  test('resistencia 2020 marcada como verificar → ámbar', () => {
    assert.equal(calificarPrueba('resistencia', byAno(2020)).estado.clase, 'b-a');
    assert.equal(calificarPrueba('resistencia', byAno(2020)).texto, 'verificar');
  });
  test('aislamiento sin dato → neutral; con 2.5 GΩ → verde', () => {
    assert.equal(calificarPrueba('aislamiento', byAno(2012)).estado.clase, 'b-n');
    assert.equal(calificarPrueba('aislamiento', byAno(2014)).estado.clase, 'b-g');
  });
  test('collar siempre por debajo de 100 mW (verde toda la serie)', () => {
    informes.forEach((inf) => {
      assert.equal(calificarPrueba('collar', inf).estado.clase, 'b-g');
    });
  });
});

describe('CONFIGS_TAND congelado', () => {
  test('las 6 configuraciones de aislamiento del tablero', () => {
    assert.equal(CONFIGS_TAND.length, 6);
    assert.deepEqual(CONFIGS_TAND.map((c) => c.code),
      ['CH', 'CHL', 'CL', 'CLT', 'CT', 'CHT']);
  });
});
