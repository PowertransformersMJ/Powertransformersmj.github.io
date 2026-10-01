// «Diagnóstico de condición» de la ventana de Cargabilidad = las calificaciones
// de Salud de Activos (decisión del Ingeniero, 2026-10-01, `99 §124`).
//
// Antes el panel salía con cinco «—»: las filas del parque no traían el grupo
// `diag` del archivo retirado. El dato SÍ existe en el registro del equipo
// (`salud_actual`): son las siete calificaciones del MO.00418 que ya muestra la
// página de Salud de Activos. Aquí se fija que salgan las MISMAS, con el mismo
// mapeo (`domain/parque_salud.js`), la escala oficial (Tabla 11: 1 Muy Bueno …
// 5 Muy Pobre) y «—» cuando no hay dato. Nada se calcula ni se rellena.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { VARIABLES_SALUD, calificacionesDe } from '../assets/js/domain/cargabilidad_diagnostico.js';
import { filaCargabilidad } from '../assets/js/domain/cargabilidad_parque.js';
import { filaParqueDesdeTx } from '../assets/js/domain/parque_salud.js';

const docV2 = (salud) => ({
  identificacion: { matricula: 'EJ-1' },
  ubicacion: { subestacion_nombre: 'EJEMPLO', departamento: 'sucre' },
  electrico: { corriente_nominal_primaria_a: 100, corriente_medida_primaria_a: 60 },
  salud_actual: salud
});

describe('filaCargabilidad — trae las calificaciones de Salud de Activos', () => {

  // 🔒 El mismo mapeo que la página de Salud de Activos: DGA y ADFQ son las
  // EVALUACIONES compuestas (eval_*), el resto las calificaciones (calif_*).
  test('mapea igual que parque_salud.js', () => {
    const sa = { eval_dga: 1.75, eval_adfq: 2.4, calif_fur: 1, calif_crg: 3, calif_pyt: 2, calif_edad: 4, calif_her: 1 };
    const f = filaCargabilidad(docV2(sa));
    const p = filaParqueDesdeTx(docV2(sa));
    assert.deepEqual(f.salud, {
      dga: p.calif_dga, edad: p.calif_edad, adfq: p.calif_adfq, fur: p.calif_fur,
      crg: p.calif_crg, pyt: p.calif_pyt, her: p.calif_her
    });
    assert.equal(f.salud.dga, 1.75);
    assert.equal(f.salud.crg, 3);
  });

  test('sin calificaciones en el registro viajan como null (no se inventan)', () => {
    const f = filaCargabilidad(docV2({ crg_pct_medido: 60 }));
    for (const v of Object.values(f.salud)) assert.equal(v, null);
  });
});

describe('calificacionesDe — las siete del MO.00418, en el orden de Salud de Activos', () => {

  test('orden y nombres iguales a la página de Salud de Activos', () => {
    assert.deepEqual(VARIABLES_SALUD.map((v) => v.k), ['dga', 'edad', 'adfq', 'fur', 'crg', 'pyt', 'her']);
    assert.deepEqual(VARIABLES_SALUD.map((v) => v.nombre),
      ['DGA', 'Edad', 'ADFQ', 'Furanos', 'Cargabilidad', 'Protec. & TC', 'Hermeticidad']);
  });

  // 🔒 Escala oficial (Tabla 11). El panel decía «Buena / Aceptable / Media /
  // Alta / Crítica», que no es el vocabulario del MO.00418.
  test('nombre y color oficiales; la evaluación con decimales se nombra por su redondeo', () => {
    const c = calificacionesDe(filaCargabilidad(docV2({ eval_dga: 1.75, calif_crg: 3, calif_edad: 5, calif_her: 1 })));
    const por = Object.fromEntries(c.map((x) => [x.k, x]));
    assert.deepEqual([por.dga.valor, por.dga.texto], [1.75, 'Bueno']);
    assert.deepEqual([por.crg.valor, por.crg.texto, por.crg.color], [3, 'Medio', '#F5C518']);
    assert.equal(por.edad.texto, 'Muy Pobre');
    assert.equal(por.her.texto, 'Muy Bueno');
  });

  test('sin dato: «—», sin color y sin valor', () => {
    const c = calificacionesDe(filaCargabilidad(docV2({})));
    assert.equal(c.length, 7);
    for (const x of c) assert.deepEqual([x.valor, x.texto, x.color], [null, '—', null]);
  });

  test('fuera de la escala 1–5 o ilegible no se muestra como calificación', () => {
    const c = calificacionesDe({ salud: { dga: 0, edad: 6, adfq: 'x', fur: '', crg: {}, pyt: null, her: 5.6 } });
    for (const x of c) assert.equal(x.texto, '—', x.k);
  });

  // La forma vieja (`diag` del archivo retirado) se sigue leyendo, ahora con el
  // nombre oficial: la usa la vista previa de desarrollo.
  test('una fila con `diag` (forma vieja) se lee con el nombre oficial', () => {
    const c = calificacionesDe({ diag: { carg: 3, edad: 2, dga: 1, fur: 1, herm: 4 } });
    const por = Object.fromEntries(c.map((x) => [x.k, x.texto]));
    assert.deepEqual(por, { dga: 'Muy Bueno', edad: 'Bueno', adfq: '—', fur: 'Muy Bueno', crg: 'Medio', pyt: '—', her: 'Pobre' });
  });

  test('fila nula o sin nada: siete «—»', () => {
    for (const d of [null, undefined, {}]) {
      const c = calificacionesDe(d);
      assert.equal(c.length, 7);
      assert.ok(c.every((x) => x.texto === '—'));
    }
  });
});
