// Tests de la trampa de foco de los diálogos (`assets/js/ui/foco-modal.js`).
//
// La regla que protege la accesibilidad: un diálogo que declara
// `aria-modal="true"` le PROMETE al lector de pantalla que el resto de la
// página está inerte. Si el tabulador se escapa del diálogo, esa promesa se
// incumple y el usuario acaba navegando por controles que su lector le dice
// que no existen. Aquí se fija el comportamiento del ciclo del tabulador.
//
// `calcularSiguienteFoco` es pura a propósito (recibe una lista, devuelve un
// elemento o null) para poder probarla sin DOM: el proyecto corre con
// `node --test`, sin jsdom. Los elementos se sustituyen por marcas de texto.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularSiguienteFoco, SELECTOR_FOCALIZABLES, atraparFoco
} from '../assets/js/ui/foco-modal.js';

// Controles ficticios de un diálogo: [primero, …, último]
const A = 'btn-exportar';
const B = 'btn-cerrar';
const C = 'input-busqueda';
const LISTA = [A, B, C];

const FUERA = 'enlace-de-la-pagina-de-detras';

describe('calcularSiguienteFoco · ciclo del tabulador', () => {
  test('en el ÚLTIMO control, Tab vuelve al primero (no se escapa)', () => {
    assert.equal(
      calcularSiguienteFoco({ focalizables: LISTA, activo: C, haciaAtras: false }),
      A
    );
  });

  test('en el PRIMER control, Shift+Tab salta al último (no se escapa)', () => {
    assert.equal(
      calcularSiguienteFoco({ focalizables: LISTA, activo: A, haciaAtras: true }),
      C
    );
  });

  test('en medio de la lista NO interviene: devuelve null y manda el navegador', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: B, haciaAtras: false }), null);
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: B, haciaAtras: true }), null);
  });

  test('el primero con Tab y el último con Shift+Tab tampoco intervienen', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: A, haciaAtras: false }), null);
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: C, haciaAtras: true }), null);
  });
});

describe('calcularSiguienteFoco · el foco se recupera si estaba fuera', () => {
  test('foco fuera del diálogo + Tab → primer control del diálogo', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: FUERA }), A);
  });

  test('foco fuera del diálogo + Shift+Tab → último control del diálogo', () => {
    assert.equal(
      calcularSiguienteFoco({ focalizables: LISTA, activo: FUERA, haciaAtras: true }),
      C
    );
  });

  test('sin foco conocido (null) → primer control', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: LISTA, activo: null }), A);
  });
});

describe('calcularSiguienteFoco · bordes', () => {
  test('un solo control: el tabulador se queda en él en ambos sentidos', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: [A], activo: A }), A);
    assert.equal(calcularSiguienteFoco({ focalizables: [A], activo: A, haciaAtras: true }), A);
  });

  test('diálogo sin controles tabulables → null (lo resuelve atraparFoco)', () => {
    assert.equal(calcularSiguienteFoco({ focalizables: [], activo: FUERA }), null);
  });

  test('lista ausente o inválida no revienta', () => {
    assert.equal(calcularSiguienteFoco(), null);
    assert.equal(calcularSiguienteFoco({}), null);
    assert.equal(calcularSiguienteFoco({ focalizables: 'no-es-lista', activo: A }), null);
  });

  test('los huecos de la lista se ignoran, no cuentan como extremo', () => {
    assert.equal(
      calcularSiguienteFoco({ focalizables: [A, null, B, undefined], activo: B }),
      A
    );
  });
});

describe('SELECTOR_FOCALIZABLES', () => {
  test('deja FUERA los tabindex="-1" (enfocables por código, no por tabulador)', () => {
    assert.ok(SELECTOR_FOCALIZABLES.includes('[tabindex]:not([tabindex="-1"])'));
    // La ÚNICA mención a tabindex="-1" es la exclusión: si apareciera suelta,
    // el tabulador se detendría en contenedores que no son controles.
    const menciones = SELECTOR_FOCALIZABLES.split('[tabindex="-1"]').length - 1;
    assert.equal(menciones, 1);
  });

  test('excluye los controles deshabilitados y los input ocultos', () => {
    assert.ok(SELECTOR_FOCALIZABLES.includes('button:not([disabled])'));
    assert.ok(SELECTOR_FOCALIZABLES.includes('input:not([disabled]):not([type="hidden"])'));
  });
});

describe('atraparFoco · degradación segura', () => {
  test('sin diálogo devuelve una trampa inerte (no lanza)', () => {
    const t = atraparFoco(null);
    assert.equal(typeof t.soltar, 'function');
    assert.equal(typeof t.refrescar, 'function');
    t.soltar();
    t.soltar();   // idempotente
  });
});
