// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La importación no borra la Unidad Constructiva
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El Excel del parque («Salud de Activos», hoja TX_Potencia) NO trae
// columna de UUCC. El parser la leía como '' y el sanitizador la emitía
// igual —siempre devuelve la clave—, así que `data/importar.js`, que
// escribe con `merge: true`, la mandaba vacía: cada importación BORRABA
// la UUCC de los 206 equipos y el reporte decía «actualizados: 206».
//
// Lo encontró una revisión adversarial (2026-09-08) ANTES de que se
// escribiera una sola UUCC en producción: sin esto, corregir una UUCC
// desde el módulo habría sido trabajo que se perdía en la siguiente carga.
//
// La regla: con `merge: true`, una clave AUSENTE deja intacto lo guardado.
// Así que si la fila no trae UUCC, la clave no viaja.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parsearFilaTransformador } from '../assets/js/domain/importador.js';

/** Fila mínima como la que trae la hoja TX_Potencia del Excel real. */
const FILA = Object.freeze({
  codigo: 'TX-PRC-1',
  nombre: 'Planeta Rica T1',
  departamento: 'CORDOBA',
  potencia_kva: 50000,
  tension_primaria_kv: 110
});

describe('parsearFilaTransformador — la UUCC no se pisa con un vacío', () => {

  // 🔒 EL INVARIANTE. Si esta prueba se cae, la próxima importación del
  // parque vuelve a borrar en silencio todas las UUCC corregidas.
  test('sin columna UUCC, la clave NO viaja en el documento', () => {
    const { docV2 } = parsearFilaTransformador({ ...FILA }, 'TX_Potencia');
    assert.ok(docV2.identificacion, 'el documento debe traer identificación');
    assert.equal('uucc' in docV2.identificacion, false,
      'con merge:true una clave ausente deja intacto lo guardado; una clave con "" lo borra');
  });

  test('una celda vacía o en blanco tampoco borra', () => {
    for (const v of ['', '   ', null, undefined]) {
      const { docV2 } = parsearFilaTransformador({ ...FILA, uucc: v }, 'TX_Potencia');
      assert.equal('uucc' in docV2.identificacion, false,
        `la celda ${JSON.stringify(v)} no debe emitir la clave`);
    }
  });

  // Contra-prueba: si el Excel SÍ trae la columna, el valor manda. Sin
  // esto, la corrección de arriba podría dejar la UUCC inservible para
  // siempre y nadie se enteraría.
  test('con columna UUCC, el valor viaja y manda', () => {
    const { docV2 } = parsearFilaTransformador({ ...FILA, uucc: 'N4T17' }, 'TX_Potencia');
    assert.equal(docV2.identificacion.uucc, 'N4T17');
  });

  test('la UUCC del Excel se normaliza a mayúsculas', () => {
    const { docV2 } = parsearFilaTransformador({ ...FILA, uucc: 'n4t17' }, 'TX_Potencia');
    assert.equal(docV2.identificacion.uucc, 'N4T17');
  });

  // Un código que no existe en el catálogo lo descarta el sanitizador
  // (deja ''), y entonces sí conviene que la clave viaje: es una
  // corrección explícita de alguien que puso algo, aunque estuviera mal.
  test('un código inválido en el Excel no se cuela como UUCC válida', () => {
    const { docV2 } = parsearFilaTransformador({ ...FILA, uucc: 'XXXX' }, 'TX_Potencia');
    assert.notEqual(docV2.identificacion.uucc, 'XXXX');
  });

  test('el resto del documento no se toca', () => {
    const { docV2 } = parsearFilaTransformador({ ...FILA }, 'TX_Potencia');
    assert.equal(docV2.identificacion.codigo, 'TX-PRC-1');
    assert.equal(docV2.identificacion.nombre, 'Planeta Rica T1');
    assert.equal(docV2.potencia_kva, 50000);
  });
});
