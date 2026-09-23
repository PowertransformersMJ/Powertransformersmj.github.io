// Tests del presupuesto CREG de la Ficha Técnica de Planificación.
// Regla del dueño (2026-08-15):
//   Valor CREG Total = COSTO DE INSTALACIÓN + (MVA del proyecto × VALOR UNITARIO $/MVA)
// Equipos de ejemplo FICTICIOS (SUBESTACIÓN A…): el repo es público.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  valorCregTotal, desgloseCreg, totalProyectoCreg, variacionReal,
  formatearCOP, TEXTO_PENDIENTE, MOTIVOS_PENDIENTE, leerMonto
} from '../assets/js/domain/fichas_presupuesto.js';
import { costoUC } from '../assets/js/domain/fichas_creg_uc.js';

// UC de ejemplo del catálogo congelado (CREG 015/2018, Tabla 52):
// N4T5 · nivel 4, bidevanado, OLTC, 21–30 MVA.
const UC = 'N4T5';
const INST = 192852000;    // costo de instalación  [$ Dic 2007]
const POR_MVA = 49593000;  // valor unitario     [$/MVA Dic 2007]

describe('catálogo — las cifras de partida son las esperadas', () => {
  test('costoUC devuelve instalación y $/MVA de la fila', () => {
    const c = costoUC(UC);
    assert.equal(c.inst, INST);
    assert.equal(c.porMVA, POR_MVA);
    assert.equal(c.vig, '2007');
  });
});

describe('valorCregTotal — fórmula oficial', () => {
  test('total = instalación + (MVA × $/MVA)', () => {
    const esperado = INST + 30 * POR_MVA;          // 1.680.642.000
    assert.equal(valorCregTotal({ uc: UC, mva: 30 }), esperado);
    assert.equal(esperado, 1680642000);
  });

  test('la instalación se suma UNA vez, aunque haya varias unidades', () => {
    const uno = valorCregTotal({ uc: UC, mva: 30, cantidad: 1 });
    const tres = valorCregTotal({ uc: UC, mva: 30, cantidad: 3 });
    assert.equal(tres, uno);                        // la cantidad NO multiplica
  });

  test('el $/MVA sí escala con la potencia del proyecto', () => {
    const a = valorCregTotal({ uc: UC, mva: 25 });
    const b = valorCregTotal({ uc: UC, mva: 30 });
    assert.equal(b - a, 5 * POR_MVA);
  });

  test('la UC en minúsculas o con espacios se normaliza', () => {
    assert.equal(valorCregTotal({ uc: ' n4t5 ', mva: 30 }), INST + 30 * POR_MVA);
  });
});

describe('valorCregTotal — nunca inventa una cifra', () => {
  test('UC inexistente → null', () => {
    assert.equal(valorCregTotal({ uc: 'ZZ999', mva: 30 }), null);
  });

  test('sin UC → null', () => {
    assert.equal(valorCregTotal({ mva: 30 }), null);
    assert.equal(valorCregTotal({ uc: '', mva: 30 }), null);
  });

  test('sin potencia del proyecto → null', () => {
    assert.equal(valorCregTotal({ uc: UC }), null);
    assert.equal(valorCregTotal({ uc: UC, mva: null }), null);
    assert.equal(valorCregTotal({ uc: UC, mva: 0 }), null);
    assert.equal(valorCregTotal({ uc: UC, mva: 'no aplica' }), null);
  });
});

describe('desgloseCreg — trazabilidad del cálculo', () => {
  test('desglosa las dos componentes y arma la fórmula legible', () => {
    const r = desgloseCreg({ uc: UC, mva: 30 });
    assert.equal(r.pendiente, false);
    assert.equal(r.enCatalogo, true);
    assert.equal(r.costoInstalacion, INST);
    assert.equal(r.valorUnitarioMVA, POR_MVA);
    assert.equal(r.componentePotencia, 30 * POR_MVA);
    assert.equal(r.total, r.costoInstalacion + r.componentePotencia);
    assert.equal(r.vigencia, '2007');
    assert.match(r.formula, /^192\.852\.000 \+ \(30 MVA × 49\.593\.000 \$\/MVA\) = 1\.680\.642\.000$/);
    assert.equal(r.motivo, null);
  });

  test('UC fuera del catálogo → [PENDIENTE] con motivo explícito', () => {
    const r = desgloseCreg({ uc: 'ZZ999', mva: 30 });
    assert.equal(r.total, null);
    assert.equal(r.pendiente, true);
    assert.equal(r.enCatalogo, false);
    assert.equal(r.motivo, MOTIVOS_PENDIENTE.UC_FUERA_CATALOGO);
    assert.ok(r.formula.startsWith(TEXTO_PENDIENTE));
  });

  test('falta la potencia → motivo distinto al de la UC', () => {
    const r = desgloseCreg({ uc: UC });
    assert.equal(r.motivo, MOTIVOS_PENDIENTE.SIN_POTENCIA);
    assert.equal(r.enCatalogo, true);              // la UC sí existe
  });

  test('overrides manuales mandan sobre el catálogo', () => {
    const r = desgloseCreg({ uc: UC, mva: 10, costoInstalacion: '200.000.000', valorUnitarioMVA: 1000000 });
    assert.equal(r.costoInstalacion, 200000000);
    assert.equal(r.valorUnitarioMVA, 1000000);
    assert.equal(r.total, 210000000);
  });

  test('con override completo el cálculo funciona aun sin catálogo', () => {
    const r = desgloseCreg({ uc: 'ZZ999', mva: 2, costoInstalacion: 1000, valorUnitarioMVA: 500 });
    assert.equal(r.total, 2000);
    assert.equal(r.enCatalogo, false);
    assert.equal(r.pendiente, false);
  });
});

describe('totalProyectoCreg — suma de líneas', () => {
  test('proyecto completo suma y se declara completo', () => {
    const r = totalProyectoCreg([{ uc: UC, mva: 30 }, { uc: UC, mva: 25 }]);
    assert.equal(r.total, (INST + 30 * POR_MVA) + (INST + 25 * POR_MVA));
    assert.equal(r.completo, true);
    assert.equal(r.pendientes, 0);
  });

  test('una línea pendiente marca el proyecto como incompleto', () => {
    const r = totalProyectoCreg([{ uc: UC, mva: 30 }, { uc: 'ZZ999', mva: 25 }]);
    assert.equal(r.completo, false);
    assert.equal(r.pendientes, 1);
    assert.equal(r.total, INST + 30 * POR_MVA);   // solo lo resuelto
  });
});

describe('variacionReal — Valor Real contra CREG', () => {
  test('sobrecosto', () => {
    const v = variacionReal({ totalCreg: 1000, valorReal: 1200 });
    assert.equal(v.abs, 200);
    assert.equal(v.sentido, 'sobrecosto');
    assert.match(v.texto, /sobrecosto/);
  });

  test('ahorro', () => {
    const v = variacionReal({ totalCreg: 1000, valorReal: '800' });
    assert.equal(v.abs, -200);
    assert.equal(v.sentido, 'ahorro');
  });

  test('sin valor real no se inventa variación', () => {
    const v = variacionReal({ totalCreg: 1000, valorReal: null });
    assert.equal(v.abs, null);
    assert.equal(v.sentido, null);
  });

  test('sin valor CREG avisa que está pendiente', () => {
    const v = variacionReal({ totalCreg: null, valorReal: 1200 });
    assert.equal(v.abs, null);
    assert.match(v.texto, /PENDIENTE/);
  });
});

describe('formatearCOP', () => {
  test('separador de miles colombiano', () => {
    assert.equal(formatearCOP(1680642000), '1.680.642.000');
    assert.equal(formatearCOP(1000), '1.000');
    assert.equal(formatearCOP(999), '999');
    assert.equal(formatearCOP(-1500), '-1.500');
    assert.equal(formatearCOP(null), '');
  });
});

describe('leerMonto — el dinero tecleado se lee sin adivinar (99 §87)', () => {
  test('forma colombiana: miles con punto, coma decimal, «$» y signo opcionales', () => {
    assert.deepEqual(leerMonto('2.100.000.000'), { valor: 2100000000, estado: 'ok' });
    assert.deepEqual(leerMonto('2100000000'), { valor: 2100000000, estado: 'ok' });
    assert.deepEqual(leerMonto('$ 2.100.000.000'), { valor: 2100000000, estado: 'ok' });
    assert.deepEqual(leerMonto('1.000.000,50'), { valor: 1000000.5, estado: 'ok' });
    assert.deepEqual(leerMonto('-1.000'), { valor: -1000, estado: 'ok' });
    assert.deepEqual(leerMonto('12.500'), { valor: 12500, estado: 'ok' });
    assert.deepEqual(leerMonto('0'), { valor: 0, estado: 'ok' });
    assert.deepEqual(leerMonto(1234), { valor: 1234, estado: 'ok' });
  });

  test('vacío no es ilegible: es que no se ha tecleado', () => {
    for (const v of [null, undefined, '', '   ']) assert.deepEqual(leerMonto(v), { valor: null, estado: 'vacio' });
  });

  test('lo que montoCOP convertía en OTRA cifra ahora es ilegible', () => {
    for (const v of ['2.100 millones', '$2.100 MM', '2,1 mil millones', '2,100,000,000', '1850000000.50',
      'aprox 2 mil millones', '1.5 millones', '=2.100.000.000*1,19', 'USD 500.000', '1.000.00', '12.5', '$', NaN]) {
      assert.deepEqual(leerMonto(v), { valor: null, estado: 'ilegible' }, String(v));
    }
  });

  test('un costo de instalación tecleado ilegible deja la línea pendiente y NO cae al catálogo', () => {
    const d = desgloseCreg({ uc: UC, mva: 30, costoInstalacion: '192 millones' });
    assert.equal(d.pendiente, true);
    assert.equal(d.costoInstalacion, null);
    assert.equal(d.total, null);
    assert.equal(d.motivo, 'instalacion_ilegible');
    assert.match(d.formula, /no se puede leer como cifra/);
  });

  test('un costo de instalación tecleado en forma colombiana sí manda', () => {
    const d = desgloseCreg({ uc: UC, mva: 30, costoInstalacion: '200.000.000' });
    assert.equal(d.pendiente, false);
    assert.equal(d.costoInstalacion, 200000000);
    assert.equal(d.total, 200000000 + 30 * POR_MVA);
  });

  test('la variación no se calcula sobre un Valor Real ilegible: lo dice', () => {
    const v = variacionReal({ totalCreg: 1000, valorReal: '2.100 millones' });
    assert.equal(v.abs, null);
    assert.match(v.texto, /no se puede leer como cifra/);
  });
});
