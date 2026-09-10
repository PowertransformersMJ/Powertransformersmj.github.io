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
  esInversion, idAccion, prosaAcciones, lineaBaseCondicion
} from '../assets/js/domain/fichas_acciones.js';
import { nucleoFicha, LINEA_BASE_POR_CONDICION } from '../assets/js/ui/fichas/ficha-tecnica.js';
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

describe('Un solo catálogo: la línea base sale de la norma (decisión 2026-09-10)', () => {
  test('la línea base de cada banda son las subactividades de SU macroactividad', () => {
    for (const m of macroactividadesCatalogo()) {
      if (m.esMitigacion) continue;
      assert.deepEqual(lineaBaseCondicion(m.condicion), m.subs.map((s) => s.nombre));
    }
  });

  test('la MITIGACIÓN no se marca sola: depende de la causa, no de la banda', () => {
    const mit3 = macroactividadesCatalogo().find((m) => m.codigo === 'MACRO-MIT-C3');
    const base3 = lineaBaseCondicion(3);
    for (const s of mit3.subs) {
      assert.ok(!base3.includes(s.nombre),
        s.nombre + ' no puede entrar sola en el alcance de todo equipo en condición 3');
    }
  });

  test('sin condición no se inventa una línea base', () => {
    assert.deepEqual(lineaBaseCondicion(null), []);
  });

  test('nucleoFicha ya NO usa la lista escrita a mano', () => {
    // Anclado a la NORMA, no a la función bajo prueba: si `lineaBaseCondicion`
    // devolviera cualquier cosa, esto tiene que caer.
    const n = nucleoFicha({ potencia_kva: 20000, cond_int: 2 });
    assert.ok(n.baseUsada);
    assert.deepEqual([...n.acciones.map((a) => a.s)].sort(),
      ['Evaluación de DPS', 'Inspección ocular detallada', 'Inspección termográfica trimestral',
       'Pruebas eléctricas', 'Verificación indicadores de temperatura',
       'Verificación sistemas de enfriamiento'].sort());
    // Y lo que decía la lista vieja de C2 ya no manda.
    assert.ok(!n.acciones.some((a) => a.s === 'Verificación de sistemas de refrigeración'));
  });

  // CORRECCIÓN de un juicio mío: un alcance sin nada marcado NO es un agujero.
  // La plantilla cae sola en «las acciones que se definan según los resultados
  // del diagnóstico», que es lo único cierto. Marcar por defecto la banda 5
  // entera prometía recuperar el aislamiento de un activo que el mismo
  // documento declara irrecuperable: el papel se contradecía a sí mismo.
  test('condición 5: NADA se marca solo, y el alcance cae en su texto honesto', () => {
    const EQ5 = { potencia_kva: 30000, cond_int: 5, subestacion: 'PRUEBA', nivel: 'N4' };
    const sel = seleccionAcciones(EQ5, { plan: {} }, 'alcance_mtto');
    assert.deepEqual(sel, [], 'un activo en fin de vida no contrata recuperación por defecto');
    // Pero el trabajo de su banda SÍ se le ofrece, sin marcar.
    const ofrecidas = accionesDeEquipo(EQ5, { todasLasCondiciones: true })
      .filter((a) => a.macro === 'MACRO-REP' && !esInversion(a.txt));
    assert.ok(ofrecidas.length >= 3);
  });

  test('condición 4: la mitigación por sobrecarga NO se marca sola', () => {
    // SUB-C4-08 lleva `mitigacion:true` aunque cuelgue de la macro principal:
    // afirmaría un dato de carga que nadie midió.
    const EQ4 = { potencia_kva: 30000, cond_int: 4, subestacion: 'PRUEBA', nivel: 'N4' };
    const sel = seleccionAcciones(EQ4, { plan: {} }, 'alcance_mtto');
    assert.ok(!sel.some((a) => /mitigaci/i.test(a.txt)), sel.map((a) => a.txt).join(' | '));
  });

  test('solo se marca lo de su banda — y de las ajenas, únicamente lo que la norma repite', () => {
    // C2 es el caso duro: comparte «Pruebas eléctricas» e «Inspección ocular
    // detallada» con C1, así que ahí SÍ aparecen marcas en un grupo ajeno.
    const EQ = { potencia_kva: 20000, cond_int: 2, subestacion: 'PRUEBA', nivel: 'N4' };
    const marcados = new Set(seleccionAcciones(EQ, { plan: {} }, 'alcance_mtto').map((a) => a.id));
    const todas = accionesDeEquipo(EQ, { todasLasCondiciones: true });
    const idsSuBanda = new Set(todas.filter((a) => a.macro === 'MACRO-ST').map((a) => a.id));
    const ajenasMarcadas = todas.filter((a) => a.macro && a.macro !== 'MACRO-ST' && marcados.has(a.id));
    assert.ok(ajenasMarcadas.every((a) => idsSuBanda.has(a.id)),
      'una marca en banda ajena solo se admite si es LA MISMA acción de su banda');
    assert.ok(ajenasMarcadas.length > 0, 'si la norma deja de repetirlas, esta prueba sobra');
  });

  test('el export viejo sigue existiendo: no se retira un público sin migración (§3.2)', () => {
    assert.ok(LINEA_BASE_POR_CONDICION && LINEA_BASE_POR_CONDICION[1],
      'queda marcado @deprecated, pero sigue publicado');
  });
});

describe('Lo que la revisión adversarial cazó antes de producción', () => {
  test('el recorte del paréntesis se come la periodicidad, NO el calificativo técnico', () => {
    // «Regeneración aceite (frío)» es OTRO trabajo —y otro precio— que la
    // regeneración completa de la banda 4. Perder el «(frío)» las volvía
    // indistinguibles en la prosa firmada.
    const c3 = catalogoCondicion(3).map((x) => x.nombre);
    assert.ok(c3.some((n) => /\(frío\)/i.test(n)), c3.join(' | '));
    // Y las periodicidades sí se recortan.
    const c2 = catalogoCondicion(2).map((x) => x.nombre);
    assert.ok(!c2.some((n) => /\((?:semestral|anual|trimestral|mensual)\)/i.test(n)));
  });

  test('un plan sin inversión en condición 4 SÍ dice dónde se sustenta la reposición', () => {
    // La hoja imprime la píldora de enfoque «Inversión» y el horizonte de
    // reposición: sin esta línea el documento se contradice a sí mismo.
    const n = nucleoFicha({ potencia_kva: 30000, cond_int: 4 });
    assert.ok(n.baseUsada);
    assert.match(n.brecha, /Propuesta a Plan de Inversión/);
  });

  test('en condición 5 no hay brecha: su línea base SÍ remite al PI', () => {
    const n = nucleoFicha({ potencia_kva: 30000, cond_int: 5 });
    assert.equal(n.brecha, '');
    assert.ok(lineaBaseCondicion(5).some((x) => /Plan de Inversión/i.test(x)));
  });
});
