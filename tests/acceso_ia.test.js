// ¿Quién puede llamar a las funciones de IA? (functions/acceso_ia.mjs) · `99 §198`
//
// El visitante se niega SIEMPRE, también si su uid estuviera en /admins (el arranque de
// las funciones es más laxo que el de las reglas). Para todos los demás, la decisión es
// la de antes del cambio, caso por caso. Puro: sin red ni Firebase.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { decidirAccesoIA, esRolVisitante } from '../functions/acceso_ia.mjs';

const perfil = (datos) => ({ existe: true, datos });
const SIN_PERFIL = { existe: false, datos: null };
const ADMINS = { existe: true };
const NO_ADMINS = { existe: false };

/** La regla tal como estaba en index.js antes de `§198` (para comparar). */
function decisionAnterior(p, a) {
  const d = p.existe ? p.datos : null;
  const perfilActivo = p.existe && d && d.activo === true;
  const bootstrap = a.existe && (!p.existe || (d && d.activo === true));
  return perfilActivo || bootstrap ? 'ok' : 'sin_perfil_activo';
}

describe('decidirAccesoIA — visitante', () => {
  test('visitante activo → negado', () => {
    assert.equal(decidirAccesoIA(perfil({ rol: 'visitante', activo: true }), NO_ADMINS), 'visitante');
  });
  test('visitante con su uid en /admins → negado igual', () => {
    assert.equal(decidirAccesoIA(perfil({ rol: 'visitante', activo: true }), ADMINS), 'visitante');
  });
  test('variantes escritas a mano y roles que no son texto → negadas (ante la duda, cerrado)', () => {
    for (const rol of ['Visitante', ' visitante ', 'VISITANTE', 'visitante\u00a0', '\ufeffvisitante', 'visitante\n', ['visitante'], 42, true, {}]) {
      assert.equal(decidirAccesoIA(perfil({ rol, activo: true }), ADMINS), 'visitante', JSON.stringify(rol));
    }
  });
  test('esRolVisitante: sin rol, null y los roles del equipo no lo son', () => {
    for (const rol of [undefined, null, '', 'admin', 'tecnico', 'director_proyectos', 'auditor_campo', 'visit']) {
      assert.equal(esRolVisitante(rol), false, String(rol));
    }
  });
});

describe('decidirAccesoIA — el equipo, igual que antes', () => {
  const casos = [
    [perfil({ rol: 'admin', activo: true }), NO_ADMINS],
    [perfil({ rol: 'tecnico', activo: true }), NO_ADMINS],
    [perfil({ rol: 'tecnico', activo: false }), NO_ADMINS],
    [perfil({ rol: 'tecnico', activo: false }), ADMINS],
    [perfil({ rol: 'brigadista', activo: true }), NO_ADMINS],
    [perfil({ activo: true }), NO_ADMINS],
    [perfil({}), ADMINS],
    [SIN_PERFIL, ADMINS],
    [SIN_PERFIL, NO_ADMINS],
  ];
  for (const [p, a] of casos) {
    test(JSON.stringify(p) + ' · admins ' + a.existe, () => {
      assert.equal(decidirAccesoIA(p, a), decisionAnterior(p, a));
    });
  }
});
