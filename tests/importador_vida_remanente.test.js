// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La vida remanente del papel no pasa del 100 %
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El importador reimplementaba el cálculo con `Math.max(0, 100 - vidaU)`,
// que solo pone PISO en 0. Sin techo, un 2FAL bajo devuelve una vida
// utilizada NEGATIVA y sale una vida remanente del 114 %, o del 135 %:
// papel mejor que nuevo.
//
// No era teórico. El Excel real del parque trae FURANOS = 14 ppb en 88
// filas —el mismo valor repetido, que es el piso de detección del
// laboratorio— y 1 ppb en otras 5. Por debajo de ~58 ppb la curva de
// Chedong devuelve DP > 800, fuera de su rango de validez. Ejecutando el
// importador real sobre el archivo real: **123 de 208 equipos** salían por
// encima del 100 %, con máximo 135,28 %.
//
// Ese número alimenta el KPI «vida remanente promedio» del tablero
// ejecutivo y se imprime en el PDF de la ficha. El motor
// (`calcularVidaRemanente`) y la Cloud Function ya hacían clamp(0,100);
// el importador era el único de los tres escritores que rompía la regla.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parsearFilaTransformador } from '../assets/js/domain/importador.js';
import { calcularDP, calcularVidaUtilizada } from '../assets/js/domain/salud_activos.js';

const HOY = new Date('2026-09-08T00:00:00Z');

/** Fila del parque con el 2FAL (furanos) que se quiera. */
function fila(furanos) {
  return {
    codigo: 'TX-TEST', nombre: 'Test', departamento: 'CESAR',
    potencia_kva: 2000, tension_primaria_kv: 34.5,
    'año de fabricacion': 2005, furanos
  };
}
const vida = (f) => parsearFilaTransformador(fila(f), 'TX_Potencia', HOY)
  .docV2.salud_actual.vida_remanente_pct;

describe('importador — la vida remanente del papel está acotada a [0, 100]', () => {

  // 🔒 EL INVARIANTE. 14 ppb es el valor que traen 88 filas del Excel real.
  test('con 2FAL de 14 ppb (el piso del laboratorio) NO supera el 100 %', () => {
    const v = vida(14);
    assert.ok(v <= 100, `esperaba <= 100 y dio ${v}`);
    assert.ok(v >= 0, `esperaba >= 0 y dio ${v}`);
  });

  test('con 2FAL de 1 ppb tampoco (era el caso de 135 %)', () => {
    const v = vida(1);
    assert.ok(v <= 100 && v >= 0, `fuera de rango: ${v}`);
  });

  test('la vida utilizada sí puede salir negativa — es el clamp el que protege', () => {
    // Se afirma la CAUSA, no solo el síntoma: si mañana la curva cambiara y
    // dejara de dar negativos, este test avisa de que el escenario cambió.
    const u = calcularVidaUtilizada(calcularDP(14));
    assert.ok(u < 0, `la curva debería dar utilizada negativa con 14 ppb, dio ${u}`);
  });

  test('un 2FAL alto sigue dando una vida remanente baja y real', () => {
    const v = vida(5000);
    assert.ok(v >= 0 && v < 50, `esperaba una vida baja y real, dio ${v}`);
  });

  test('sin dato de furanos, la vida remanente es null y no se inventa', () => {
    assert.equal(vida(null), null);
    assert.equal(vida(''), null);
  });

  // Barrido: ningún valor plausible de 2FAL puede salirse del rango.
  test('ningún 2FAL entre 1 y 20.000 ppb produce un valor fuera de [0, 100]', () => {
    for (const f of [1, 5, 14, 25, 58, 100, 250, 1000, 5000, 20000]) {
      const v = vida(f);
      assert.ok(v === null || (v >= 0 && v <= 100), `2FAL ${f} ppb dio ${v}`);
    }
  });
});
