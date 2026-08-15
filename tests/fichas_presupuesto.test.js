// Tests del presupuesto CREG de la Ficha Técnica de Planificación.
// Regla del dueño (2026-08-15):
//   Valor CREG Total = COSTO DE INSTALACIÓN + (MVA del proyecto × VALOR UNITARIO $/MVA)
// Equipos de ejemplo FICTICIOS (SUBESTACIÓN A…): el repo es público.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  valorCregTotal, desgloseCreg, totalProyectoCreg, variacionReal,
  formatearCOP, TEXTO_PENDIENTE, MOTIVOS_PENDIENTE
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
