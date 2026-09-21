// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · la identidad del equipo (99 §82)
// ──────────────────────────────────────────────────────────────
// Cuando los datos entran por LISTADO ADJUNTO —el camino de la exportación
// de Salud de Activos— la columna que el módulo llamaba `codigo` es el
// «CODIGO SUBESTACION»: los dos transformadores de una misma subestación lo
// COMPARTEN. Como de ahí salía la clave de estado, el segundo equipo nunca
// podía abrir su propia ficha: el botón llevaba la misma clave y la búsqueda
// devolvía siempre el primero.
//
// Estas pruebas fijan que la clave salga de un identificador PROPIO del
// equipo (matrícula o serie) y, cuando no hay ninguno, que la fila del
// listado entre como desempate — nunca sola, porque una fila suelta cambia
// de equipo si el listado se reordena.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { claveEquipo } from '../assets/js/ui/fichas/unifilar.js';
import { equiposDesdeListado } from '../assets/js/domain/fichas_evaluacion_uucc.js';

/* Dos renglones reales del listado: misma subestación, distinto equipo. */
const T1 = { fila: 7, codigo: 'M-BQE', matricula: 'T1-A/M-BQE', serie: 'S-101', subestacion: 'BOSQUE' };
const T2 = { fila: 8, codigo: 'M-BQE', matricula: 'T4-A/M-BQE', serie: 'S-102', subestacion: 'BOSQUE' };

describe('dos TX de la misma subestación no pueden compartir identidad', () => {
  test('con matrícula, cada uno tiene su propia clave', () => {
    assert.notEqual(claveEquipo(T1), claveEquipo(T2));
    assert.equal(claveEquipo(T1), 'T1-A/M-BQE', 'manda la matrícula, no el código de subestación');
  });

  test('sin matrícula, manda la serie', () => {
    const a = { fila: 7, codigo: 'M-BQE', serie: 'S-101' };
    const b = { fila: 8, codigo: 'M-BQE', serie: 'S-102' };
    assert.equal(claveEquipo(a), 'S-101');
    assert.notEqual(claveEquipo(a), claveEquipo(b));
  });

  test('sin matrícula NI serie, la fila desempata el código compartido', () => {
    const a = { fila: 7, codigo: 'M-BQE' };
    const b = { fila: 8, codigo: 'M-BQE' };
    assert.notEqual(claveEquipo(a), claveEquipo(b));
    assert.ok(String(claveEquipo(a)).includes('M-BQE'), 'la clave sigue siendo legible');
    assert.ok(String(claveEquipo(a)).includes('7'));
  });

  test('el mismo equipo devuelve SIEMPRE la misma clave', () => {
    assert.equal(claveEquipo(T2), claveEquipo({ ...T2 }));
  });
});

describe('lo que ya funcionaba sigue igual', () => {
  test('el equipo de Firestore se identifica por su documento', () => {
    const doc = { id: 'abc123', codigo: 'T4-A/M-BQE', matricula: 'T4-A/M-BQE' };
    assert.equal(claveEquipo(doc), 'abc123');
  });

  test('identificación anidada del esquema v2', () => {
    assert.equal(claveEquipo({ identificacion: { matricula: 'T2-M/M-CAZ' } }), 'T2-M/M-CAZ');
    assert.equal(claveEquipo({ identificacion: { codigo: 'T2-M/M-CAZ' } }), 'T2-M/M-CAZ');
  });

  test('texto y número se aceptan tal cual; el vacío no inventa clave', () => {
    assert.equal(claveEquipo('T1'), 'T1');
    assert.equal(claveEquipo(12), '12');
    assert.equal(claveEquipo(null), '');
  });

  test('dos equipos sin ningún identificador no se pisan entre sí', () => {
    const a = {}; const b = {};
    assert.notEqual(claveEquipo(a), claveEquipo(b));
    assert.equal(claveEquipo(a), claveEquipo(a), 'y cada uno conserva la suya');
  });

  test('solo fila: se usa, porque es lo único que hay', () => {
    assert.equal(claveEquipo({ fila: 9 }), '9');
  });
});

/* ── El listado deja de llamar «código» a lo que es la subestación ──────── */

const CAB = ['SUBESTACION', 'MATRICULA', 'SERIE', 'POTENCIA (KVA)',
  'NIVEL DE TENSION PRIMARIO (KV)', 'NIVEL DE TENSION SECUNDARIO (KV)',
  'NIVEL DE TENSION TERCEARIO (KV)', 'REGULACION', 'UUCC', 'ZONA', 'DEPARTAMENTO',
  'CODIGO SUBESTACION'];

const fila = (mat, cod) => ['BOSQUE', mat, 'S-' + mat, 20000, 66, '13.8', 'N/A',
  'OLTC', 'N4T2', 'ZONA 1', 'BOLIVAR', cod];

describe('equiposDesdeListado nombra el dato por lo que es', () => {
  test('la columna CODIGO SUBESTACION viaja también como codigo_subestacion', () => {
    const { equipos } = equiposDesdeListado([CAB, fila('T1-A/M-BQE', 'M-BQE'), fila('T4-A/M-BQE', 'M-BQE')]);
    assert.equal(equipos.length, 2);
    assert.equal(equipos[0].codigo_subestacion, 'M-BQE');
    assert.equal(equipos[0].codigo, 'M-BQE', 'el campo viejo se conserva: nada se borra');
    assert.notEqual(claveEquipo(equipos[0]), claveEquipo(equipos[1]),
      'los dos equipos del listado deben poder abrir su propia ficha');
  });
});
