// Vistas gerenciales — funciones puras que alimentan lo que ve la gerencia.
// Este archivo tenía CERO tests y escondía dos cifras contradictorias con el
// resto del sistema (ADR-066).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resumenGerencial, valorReposicion } from '../assets/js/ui/fichas/vistas-gerenciales.js';
import { resumir } from '../assets/js/domain/fichas_evaluacion_uucc.js';
import { valorCregTotal } from '../assets/js/domain/fichas_presupuesto.js';

const flota = () => ([
  { estado: 'CONCORDANTE',  mva: 20,   cond_int: 2 },
  { estado: 'CONCORDANTE',  mva: 20,   cond_int: 2 },
  { estado: 'DISCREPANCIA', mva: 20,   cond_int: 5, uucc_calculada: 'N4T4' },
  { estado: 'SIN CALCULO',  mva: null, cond_int: null }
]);

describe('resumenGerencial — no puede contradecir al resto del sistema', () => {
  // El tablero y la vista gerencial se miran en la misma reunión: si dan
  // porcentajes distintos sobre la misma flota, ninguno es creíble.
  test('la conformidad usa el mismo criterio que el informe del dominio', () => {
    const g = resumenGerencial(flota());
    const d = resumir(flota().map((e) => ({ estado: e.estado })));
    assert.equal(Math.round(g.conformidad * 10) / 10, d.conformidad);
  });

  test('los equipos sin placa completa no cuentan como incumplimiento', () => {
    const r = resumenGerencial(flota());
    assert.equal(r.evaluables, 3);
    assert.equal(r.sinCalculo, 1);
  });

  test('cuenta como gestionada la novedad que tiene decisión o corrección', () => {
    const eq = flota();
    eq[2].novedad_gestionada = true;
    assert.equal(resumenGerencial(eq).gestionadas, 1);
    const eq2 = flota();
    eq2[2].gestion = 'Aceptar UUCC calculada';   // lo estampa aplicarDecisiones
    assert.equal(resumenGerencial(eq2).gestionadas, 1);
  });

  test('flota vacía o nula devuelve ceros, nunca NaN', () => {
    for (const f of [[], null, undefined]) {
      const r = resumenGerencial(f);
      assert.equal(r.total, 0);
      assert.equal(r.conformidad, 0);
      assert.equal(r.avanceNovedades, 0);
      assert.ok(!Number.isNaN(r.mvaTotal));
    }
  });
});

describe('valorReposicion — la misma cifra que la ficha, o ninguna', () => {
  test('coincide exactamente con el presupuesto del dominio', () => {
    const e = { uucc_calculada: 'N4T5', mva: 30 };
    assert.equal(valorReposicion(e), valorCregTotal({ uc: 'N4T5', mva: 30 }));
  });

  test('sin potencia NO inventa una cifra parcial', () => {
    // Antes devolvía solo el costo de instalación, y el KPI «valor de
    // reposición de la flota en mala salud» sumaba cifras incompletas.
    assert.equal(valorReposicion({ uucc_calculada: 'N4T5', mva: null }), null);
  });

  test('una UC fuera del catálogo no produce número', () => {
    assert.equal(valorReposicion({ uucc_calculada: 'ZZ999', mva: 30 }), null);
    assert.equal(valorReposicion({ mva: 30 }), null);
    assert.equal(valorReposicion(null), null);
  });
});
