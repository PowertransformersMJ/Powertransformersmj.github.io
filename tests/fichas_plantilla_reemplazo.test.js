// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Las redacciones insertan los datos TAL CUAL
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// CF-38 de la cola de Fichas. `resolverPlantilla` metía la
// subestación y la matrícula con `String.replace` de TEXTO: un
// nombre con «$&», «$`» o «$'» se interpretaba como patrón y
// cambiaba la frase que se firma (la misma trampa que `§87` cerró
// en el exportador y que volvió a morder en `§107`, L-103).
//
// Dos cosas quedan fijadas aquí:
// 1. Con datos normales el texto es IDÉNTICO al de antes, en
//    todas las redacciones de los cuatro catálogos: el arreglo no
//    mueve ni una coma de lo que ya se firma.
// 2. Con un nombre raro, el papel dice exactamente ese nombre.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALCANCE_OPC, BENEF_OPC, ALCANCE_MTTO_OPC, BENEF_MTTO_OPC,
  normalizarEquipo, resolverPlantilla, seleccionAcciones
} from '../assets/js/ui/fichas/panel.js';

// La implementación anterior, copiada tal cual, como referencia de
// «no cambia nada con datos normales». Recibe los valores ya resueltos.
function resolverAntes(tpl, v) {
  return String(tpl || '')
    .replace(/\{MVA\}/g, v.MVA)
    .replace(/\{SUB\}/g, v.SUB)
    .replace(/\{MATRICULA\}/g, v.MATRICULA)
    .replace(/\{ACCIONES\}/g, v.ACCIONES);
}

const CATALOGOS = [
  ['alcance', ALCANCE_OPC],
  ['beneficios', BENEF_OPC],
  ['alcance_mtto', ALCANCE_MTTO_OPC],
  ['beneficios_mtto', BENEF_MTTO_OPC]
];

describe('CF-38 · reemplazo con función en las redacciones', () => {
  const EQ = normalizarEquipo({
    potencia_kva: 33000, cond_int: 4, subestacion: 'MAMONAL',
    matricula: 'T1-M/M-MAM', usuarios: 9500
  });
  const ST = { plan: { acc_sel: ['REGENERACION-DE-ACEITE'] } };

  test('con datos normales cada redacción sale idéntica a la de antes', () => {
    let revisadas = 0;
    for (const [campo, opc] of CATALOGOS) {
      for (const o of opc) {
        if (!o.v) continue; // las automáticas no pasan por la plantilla
        // Los valores que la versión anterior habría insertado se leen de la
        // salida nueva con una plantilla de un solo marcador: así la prueba no
        // re-implementa la potencia ni la prosa de las acciones.
        const v = {
          MVA: resolverPlantilla('{MVA}', EQ, ST, campo),
          SUB: resolverPlantilla('{SUB}', EQ, ST, campo),
          MATRICULA: resolverPlantilla('{MATRICULA}', EQ, ST, campo),
          ACCIONES: resolverPlantilla('{ACCIONES}', EQ, ST, campo)
        };
        assert.equal(resolverPlantilla(o.v, EQ, ST, campo), resolverAntes(o.v, v), `${campo} · ${o.t}`);
        revisadas++;
      }
    }
    assert.ok(revisadas >= 20, `solo se revisaron ${revisadas} redacciones`);
  });

  test('los marcadores salen con los datos del equipo', () => {
    assert.equal(resolverPlantilla('{SUB}', EQ, ST, 'alcance'), 'MAMONAL');
    assert.equal(resolverPlantilla('{MATRICULA}', EQ, ST, 'alcance'), 'T1-M/M-MAM');
    assert.equal(resolverPlantilla('{MVA}', EQ, ST, 'alcance'), '33');
  });

  for (const raro of ['PATIO $& NORTE', 'S/E $` VIEJA', "S/E $' NUEVA", 'S/E $$ DOBLE', 'S/E $1 UNO']) {
    test(`una subestación «${raro}» se imprime tal cual`, () => {
      const eq = normalizarEquipo({ potencia_kva: 33000, cond_int: 4, subestacion: raro, matricula: 'T1-X' });
      const t = resolverPlantilla('en la subestación {SUB}, matrícula {MATRICULA}.', eq, ST, 'alcance');
      assert.equal(t, `en la subestación ${raro}, matrícula T1-X.`);
    });
  }

  test('una matrícula con «$&» se imprime tal cual', () => {
    const eq = normalizarEquipo({ potencia_kva: 33000, cond_int: 4, subestacion: 'MAMONAL', matricula: 'T1-$&' });
    assert.equal(resolverPlantilla('({MATRICULA})', eq, ST, 'alcance'), '(T1-$&)');
  });

  test('un dato que trae un marcador no se vuelve a sustituir', () => {
    const eq = normalizarEquipo({ potencia_kva: 33000, cond_int: 4, subestacion: 'S/E {MATRICULA}', matricula: 'T1-X' });
    assert.equal(resolverPlantilla('{SUB}', eq, ST, 'alcance'), 'S/E {MATRICULA}');
  });

  test('sin potencia ni matrícula se declara el hueco, como antes', () => {
    const eq = normalizarEquipo({ cond_int: 4, subestacion: 'MAMONAL' });
    assert.equal(resolverPlantilla('{MVA}|{MATRICULA}', eq, { plan: {} }, 'alcance'),
      '[PENDIENTE: POTENCIA]|[PENDIENTE: MATRÍCULA]');
  });

  test('la selección de acciones sigue llegando a {ACCIONES}', () => {
    const t = resolverPlantilla('{ACCIONES}', EQ, ST, 'alcance_mtto');
    assert.ok(t.length > 0);
    assert.equal(seleccionAcciones(EQ, ST, 'alcance_mtto').length > 0, true);
  });
});
