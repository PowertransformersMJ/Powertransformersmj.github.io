// Gestión de novedades UUCC y acta de correcciones (ADR-065).
//
// Es un flujo de TRAZABILIDAD: lo que sale de aquí se firma y sustenta una
// corrección del parque. Las dos invariantes que se prueban abajo son las que
// no pueden romperse nunca: (1) la UUCC calculada por la regla CREG jamás se
// modifica por una decisión; (2) el acta va y vuelve sin perder ni inventar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  esNovedad, resumenNovedades, textoEdiciones, filasActa,
  decisionesDesdeActa, aplicarDecisiones, DECISIONES, COLUMNAS_ACTA
} from '../assets/js/ui/fichas/correcciones.js';

const flota = () => ([
  { fila: 1, subestacion: 'A', estado: 'DISCREPANCIA',   uucc_registrada: 'N4T3', uucc_calculada: 'N4T4' },
  { fila: 2, subestacion: 'B', estado: 'CONCORDANTE',    uucc_registrada: 'N4T2', uucc_calculada: 'N4T2' },
  { fila: 3, subestacion: 'C', estado: 'FALTA REGISTRO', uucc_registrada: '',     uucc_calculada: 'N3T5' },
  { fila: 4, subestacion: 'D', estado: 'SIN CALCULO',    uucc_registrada: 'N4T1', uucc_calculada: '' }
]);

describe('Novedades — qué hay que gestionar', () => {
  test('solo lo que NO concuerda es novedad', () => {
    const eq = flota();
    assert.equal(eq.filter(esNovedad).length, 3);
    assert.equal(esNovedad(eq[1]), false);
  });

  test('el resumen cuenta gestionadas y pendientes', () => {
    const eq = flota();
    assert.deepEqual(resumenNovedades(eq, {}, {}),
      { novedades: 3, gestionadas: 0, pendientes: 3 });
    const dec = { 1: { decision: 'Aceptar UUCC calculada' } };
    assert.deepEqual(resumenNovedades(eq, {}, dec),
      { novedades: 3, gestionadas: 1, pendientes: 2 });
  });

  test('corregir datos también cuenta como gestión, aunque no haya decisión', () => {
    const eq = flota();
    const edits = { 3: { potencia_kva: 8000 } };
    assert.equal(resumenNovedades(eq, edits, {}).gestionadas, 1);
  });
});

describe('Aplicar decisiones', () => {
  test('«Aceptar UUCC calculada» subsana: la registrada pasa a ser la calculada', () => {
    const eq = flota();
    const r = aplicarDecisiones(eq, { 1: { decision: 'Aceptar UUCC calculada' } });
    assert.equal(eq[0].uucc_registrada, 'N4T4');
    assert.equal(eq[0].estado, 'CONCORDANTE');
    assert.equal(r.subsanadas, 1);
  });

  test('«Corregir a otra UUCC» usa la unidad indicada', () => {
    const eq = flota();
    aplicarDecisiones(eq, { 1: { decision: 'Corregir a otra UUCC', final: 'N4T9' } });
    assert.equal(eq[0].uucc_registrada, 'N4T9');
    assert.equal(eq[0].estado, 'DISCREPANCIA');   // sigue sin coincidir con la calculada
  });

  test('«Mantener UUCC registrada» no cambia nada y cuenta como aceptada', () => {
    const eq = flota();
    const r = aplicarDecisiones(eq, { 1: { decision: 'Mantener UUCC registrada' } });
    assert.equal(eq[0].uucc_registrada, 'N4T3');
    assert.equal(r.aceptadas, 1);
  });

  // INVARIANTE 1 — si esto se rompe, el tablero deja de ser una auditoría.
  test('NINGUNA decisión modifica la UUCC calculada por la regla CREG', () => {
    for (const d of DECISIONES) {
      const eq = flota();
      const calculadasAntes = eq.map((e) => e.uucc_calculada);
      aplicarDecisiones(eq, { 1: { decision: d.id, final: 'N9T9' } });
      assert.deepEqual(eq.map((e) => e.uucc_calculada), calculadasAntes,
        'la decisión «' + d.id + '» alteró el veredicto de la norma');
    }
  });

  test('un equipo sin decisión queda intacto', () => {
    const eq = flota();
    aplicarDecisiones(eq, { 1: { decision: 'Aceptar UUCC calculada' } });
    assert.equal(eq[2].uucc_registrada, '');
    assert.equal(eq[2].estado, 'FALTA REGISTRO');
  });
});

describe('Acta de correcciones', () => {
  test('lleva las novedades y también lo ya gestionado', () => {
    const eq = flota();
    const filas = filasActa(eq, {}, {});
    assert.equal(filas.length, 3);                       // las 3 novedades
    assert.equal(filas.every((f) => COLUMNAS_ACTA.every((c) => c in f)), true);
  });

  test('un concordante entra al acta si se le corrigió algo', () => {
    const eq = flota();
    const filas = filasActa(eq, { 2: { serie: 'X' } }, {});
    assert.equal(filas.some((f) => f['Subestación'] === 'B'), true);
  });

  // INVARIANTE 2 — el acta se firma; no puede perder ni deformar lo decidido.
  test('ida y vuelta: exportar y releer devuelve la misma decisión', () => {
    const eq = flota();
    const dec = {
      1: { decision: 'Corregir a otra UUCC', final: 'N4T7',
        resp: 'Ing. MJ', fecha: '2026-08-20', obs: 'Acta 12; se ajusta a placa.' },
      3: { decision: 'Mantener UUCC registrada', final: '',
        resp: 'Ing. MJ', fecha: '2026-08-20', obs: '' }
    };
    const filas = filasActa(eq, {}, dec);
    const matriz = [COLUMNAS_ACTA, ...filas.map((f) => COLUMNAS_ACTA.map((c) => f[c]))];
    const r = decisionesDesdeActa(matriz);
    assert.equal(r.leidas, 2);
    for (const fila of [1, 3]) {
      for (const k of ['decision', 'final', 'resp', 'fecha', 'obs']) {
        assert.equal(r.dec[fila][k], dec[fila][k], 'se deformó ' + k + ' de la fila ' + fila);
      }
    }
  });

  test('una decisión que no existe en el catálogo se ignora, no se cuela', () => {
    const matriz = [COLUMNAS_ACTA,
      [1, '', '', '', '', '', '', '', '', '', '', '', '', 'Lo que sea', '', '', '', '']];
    const r = decisionesDesdeActa(matriz);
    assert.deepEqual(r.dec, {});
    assert.equal(r.ignoradas, 1);
  });

  test('un archivo que no es un acta no rompe nada', () => {
    assert.deepEqual(decisionesDesdeActa([['Nombre', 'Edad'], ['Ana', 30]]),
      { dec: {}, leidas: 0, ignoradas: 0 });
    assert.deepEqual(decisionesDesdeActa([]), { dec: {}, leidas: 0, ignoradas: 0 });
    assert.deepEqual(decisionesDesdeActa(null), { dec: {}, leidas: 0, ignoradas: 0 });
  });

  test('filas sin decisión no viajan como gestión', () => {
    const matriz = [COLUMNAS_ACTA,
      [7, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']];
    assert.equal(decisionesDesdeActa(matriz).leidas, 0);
  });
});

describe('Correcciones de datos', () => {
  test('se describen en lenguaje del formulario, no con nombres de campo', () => {
    const t = textoEdiciones({ 1: { potencia_kva: 8000, subestacion: 'NUEVA' } }, 1);
    assert.match(t, /Potencia \(kVA\)=8000/);
    assert.match(t, /Subestación=NUEVA/);
  });

  test('un campo vaciado se declara, no se omite', () => {
    assert.match(textoEdiciones({ 1: { kv_terc: null } }, 1), /\(vacío\)/);
  });

  test('sin correcciones, texto vacío', () => {
    assert.equal(textoEdiciones({}, 1), '');
  });
});
