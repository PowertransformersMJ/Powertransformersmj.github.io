// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El municipio sale solo de la subestación
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// La ficha técnica imprime el MUNICIPIO en «Emplazamiento físico
// del proyecto», y el registro del parque no siempre lo trae: el
// campo salía vacío y había que teclearlo en cada ficha. Con la
// tabla oficial del Ingeniero (153 subestaciones) se completa
// solo. Es un dato que se FIRMA, así que las tres reglas que
// fijan estas pruebas son:
//   1. lo que traiga el parque MANDA — nunca se pisa;
//   2. si no hay una única respuesta NO se adivina: el campo se
//      queda vacío, como hoy («COSPIQUE» y «NUEVA COSPIQUE» son
//      subestaciones distintas);
//   3. el nombre manda y el código de la matrícula es respaldo,
//      porque no siempre coinciden (Candelaria es CDR en la
//      tabla y aparece como KDR en alguna matrícula).
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SUBESTACIONES, municipioDeSubestacion } from '../assets/js/domain/municipios_subestacion.js';
import { normalizarEquipo } from '../assets/js/ui/fichas/panel.js';

describe('La tabla de subestaciones', () => {
  test('trae las 153 de la fuente, sin filas rotas', () => {
    assert.equal(SUBESTACIONES.length, 153);
    for (const f of SUBESTACIONES) {
      assert.equal(f.length, 3);
      assert.ok(f[0] && f[1] && f[2], JSON.stringify(f));
    }
  });

  test('ningún código se repite: es lo que la hace usable como clave', () => {
    const cods = SUBESTACIONES.map((f) => f[0]);
    assert.equal(new Set(cods).size, cods.length);
  });

  test('ninguna subestación se quedó sin municipio', () => {
    assert.deepEqual(SUBESTACIONES.filter((f) => !String(f[2]).trim()), []);
  });
});

describe('municipioDeSubestacion — resuelve o calla, no adivina', () => {
  test('el caso del encargo: MAMONAL es CARTAGENA', () => {
    assert.equal(municipioDeSubestacion({ subestacion: 'MAMONAL' }), 'CARTAGENA');
  });

  test('las tildes y la caja no lo despistan', () => {
    assert.equal(municipioDeSubestacion({ subestacion: 'Guatapurí' }), 'VALLEDUPAR');
    assert.equal(municipioDeSubestacion({ subestacion: '  coveñas  ' }), 'SAN ANTERO');
  });

  test('sin nombre, cae al código de la matrícula', () => {
    assert.equal(municipioDeSubestacion({ matricula: 'T4-A/A-BQE' }), 'CARTAGENA');
  });

  test('COSPIQUE y NUEVA COSPIQUE son subestaciones DISTINTAS, cada una la suya', () => {
    const a = SUBESTACIONES.find((f) => f[1] === 'COSPIQUE');
    const b = SUBESTACIONES.find((f) => f[1] === 'NUEVA COSPIQUE');
    assert.ok(a && b, 'si la tabla cambia, esta prueba hay que rehacerla');
    assert.equal(municipioDeSubestacion({ subestacion: 'COSPIQUE' }), a[2]);
    assert.equal(municipioDeSubestacion({ subestacion: 'NUEVA COSPIQUE' }), b[2]);
  });

  test('una subestación que no está en la tabla NO se inventa', () => {
    assert.equal(municipioDeSubestacion({ subestacion: 'SUBESTACIÓN INEXISTENTE' }), null);
    assert.equal(municipioDeSubestacion({}), null);
    assert.equal(municipioDeSubestacion(null), null);
  });

  test('un código de matrícula que no está en la tabla tampoco', () => {
    // Candelaria es CDR en el catálogo; «KDR» de la matrícula no debe resolver
    // por su cuenta: para eso está el nombre.
    assert.equal(municipioDeSubestacion({ matricula: 'T-KDR05' }), null);
  });
});

describe('En la ficha: se completa lo que falta y NO se pisa lo que hay', () => {
  test('sin municipio en el registro, la ficha lo trae de la subestación', () => {
    const e = normalizarEquipo({ subestacion: 'MAMONAL', potencia_kva: 20000 });
    assert.equal(e.municipio, 'CARTAGENA');
  });

  test('con municipio en el registro, MANDA el registro', () => {
    const e = normalizarEquipo({ subestacion: 'MAMONAL', municipio: 'OTRO', potencia_kva: 20000 });
    assert.equal(e.municipio, 'OTRO', 'el parque es la fuente; la tabla solo rellena huecos');
  });

  test('si no se puede resolver, el campo queda vacío para que lo llene el Ingeniero', () => {
    const e = normalizarEquipo({ subestacion: 'NO EXISTE', potencia_kva: 20000 });
    assert.equal(e.municipio, '');
  });
});
