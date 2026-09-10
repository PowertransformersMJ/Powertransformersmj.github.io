// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Todas las macroactividades por condición
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Encargo del Ingeniero (2026-09-10): «aquí me gustaría que
// aparezcan todas las macroactividades por condición». Hasta
// entonces el selector del alcance solo ofrecía la banda del
// equipo, así que un correctivo que conviniera adelantar —o una
// mitigación de otra banda— no estaba a la vista ni para
// descartarlo.
//
// Abrir el catálogo entero trae tres riesgos que estas pruebas
// fijan, porque los tres terminan en un documento que se firma:
//   · que se cuele INVERSIÓN, contra la orden del 2026-09-09;
//   · que la norma repita una subactividad en dos bandas y el
//     alcance la enumere DOS VECES (pasó: «pruebas eléctricas,
//     pruebas eléctricas y …»);
//   · que la Propuesta a Plan de Inversión, que comparte este
//     motor, cambie sin que nadie lo pida.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  macroactividadesCatalogo, accionesDisponibles, catalogoCondicion,
  esInversion, idAccion, prosaAcciones
} from '../assets/js/domain/fichas_acciones.js';
import { accionesDeEquipo, seleccionAcciones } from '../assets/js/ui/fichas/panel.js';

describe('macroactividadesCatalogo — el catálogo MO.00418 §4.3 entero', () => {
  const G = macroactividadesCatalogo();

  test('son las 7 macroactividades de la norma', () => {
    assert.equal(G.length, 7);
    assert.deepEqual(G.map((m) => m.codigo),
      ['MACRO-PSM', 'MACRO-ST', 'MACRO-CM', 'MACRO-MIT-C3',
       'MACRO-CMA', 'MACRO-MIT-C4', 'MACRO-REP']);
  });

  test('cada mitigación va pegada a la condición que mitiga, no al final', () => {
    const i3 = G.findIndex((m) => m.codigo === 'MACRO-MIT-C3');
    assert.equal(G[i3 - 1].codigo, 'MACRO-CM', 'la de C3 va tras Correctivo Menor');
    const i4 = G.findIndex((m) => m.codigo === 'MACRO-MIT-C4');
    assert.equal(G[i4 - 1].codigo, 'MACRO-CMA', 'la de C4 va tras Correctivo Mayor');
  });

  test('ningún grupo queda vacío y todos citan su referencia normativa', () => {
    for (const m of G) {
      assert.ok(m.subs.length > 0, m.codigo + ' sin subactividades');
      assert.match(m.referencia, /MO\.00418/);
      assert.ok(m.condicion >= 1 && m.condicion <= 5);
    }
  });

  test('no se pierde ni una subactividad respecto del catálogo por condición', () => {
    const enGrupos = new Set(G.flatMap((m) => m.subs.map((s) => s.codigo)));
    for (let ci = 1; ci <= 5; ci++) {
      for (const c of catalogoCondicion(ci)) {
        assert.ok(enGrupos.has(c.codigo), 'falta ' + c.codigo + ' en los grupos');
      }
    }
  });

  test('la periodicidad no se desarrolla: se ofrece la actividad, no su ciclo', () => {
    for (const m of G) for (const s of m.subs) assert.doesNotMatch(s.nombre, /\($/);
  });
});

describe('El selector ofrece todas las bandas, sin colar inversión', () => {
  // Condición 2, sin plan registrado: el caso del pantallazo del Ingeniero.
  const EQUIPO = { potencia_kva: 20000, cond_int: 2, subestacion: 'PRUEBA', nivel: 'N4' };

  test('en modo completo aparecen acciones de las cinco condiciones', () => {
    const todas = accionesDeEquipo(EQUIPO, { todasLasCondiciones: true });
    const bandas = new Set(todas.filter((a) => a.cond != null).map((a) => a.cond));
    assert.deepEqual([...bandas].sort(), [1, 2, 3, 4, 5]);
  });

  test('sin el modo completo NO cambia nada: el PI sigue viendo solo su banda', () => {
    const antes = accionesDeEquipo(EQUIPO);
    assert.ok(antes.every((a) => a.macro === undefined),
      'el camino del Plan de Inversión no debe recibir el catálogo entero');
  });

  test('la inversión sigue fuera del documento de mantenimiento (99 §74.20)', () => {
    const EQ5 = { potencia_kva: 30000, cond_int: 5, subestacion: 'PRUEBA', nivel: 'N4' };
    const sel = seleccionAcciones(EQ5, { plan: {} }, 'alcance_mtto');
    assert.deepEqual(sel.filter((a) => esInversion(a.txt)), []);
  });

  test('una acción de OTRA banda marcada a mano sí llega al alcance', () => {
    const otra = idAccion('Regeneración de aceite');            // C4, banda ajena a un C2
    const sel = seleccionAcciones(EQUIPO, { plan: { acc_sel: [otra] } }, 'alcance_mtto');
    assert.ok(sel.some((a) => a.id === otra),
      'de nada sirve ofrecerla si al marcarla no entra en el texto');
  });
});

describe('Una acción, un renglón: la norma repite dos subactividades', () => {
  const EQUIPO = { potencia_kva: 20000, cond_int: 2, subestacion: 'PRUEBA', nivel: 'N4' };
  const gemela = idAccion('Pruebas eléctricas');                 // está en C1 y en C2

  test('la subactividad repetida existe de verdad en dos bandas', () => {
    const veces = [1, 2, 3, 4, 5]
      .flatMap((ci) => catalogoCondicion(ci))
      .filter((c) => idAccion(c.nombre) === gemela).length;
    assert.equal(veces, 2, 'si la norma deja de repetirla, esta prueba sobra');
  });

  test('el alcance NO la enumera dos veces', () => {
    const sel = seleccionAcciones(EQUIPO, { plan: { acc_sel: [gemela] } }, 'alcance_mtto');
    assert.equal(sel.filter((a) => a.id === gemela).length, 1);
    const prosa = prosaAcciones(sel);
    assert.equal((prosa.match(/pruebas eléctricas/gi) || []).length, 1, prosa);
  });
});

describe('El contrato viejo de accionesDisponibles no se movió', () => {
  test('sin el quinto argumento se comporta exactamente como antes', () => {
    const reg = [{ s: 'Muestreo de aceite', cat: 'DIAG' }];
    const a = accionesDisponibles(3, reg, false, () => 'DIAG');
    const b = accionesDisponibles(3, reg, false, () => 'DIAG', undefined);
    assert.deepEqual(a, b);
    assert.ok(a.some((x) => x.origen === 'registro'));
    assert.ok(a.every((x) => x.macro === undefined));
  });
});
