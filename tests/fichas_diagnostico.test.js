// Tests del diagnóstico y la redacción automática de la Ficha Técnica.
// La regla que protege el documento: un equipo con el PAPEL SANO nunca puede
// recibir el argumento de "fin de vida por furanos".
// Equipos FICTICIOS (SUBESTACIÓN A…): el repo es público.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  dpInfo, modoDegradacion, redaccionAlcance, redaccionBeneficios, numES
} from '../assets/js/domain/fichas_diagnostico.js';
import { calcularDP, calcularVidaUtilizada } from '../assets/js/domain/salud_activos.js';

// ── Equipos y medidas de ejemplo ─────────────────────────────────────────────

const EQUIPO_A = Object.freeze({
  fila: 1, subestacion: 'SUBESTACIÓN A', matricula: 'TX-A-01', serie: 'SER-A-0001',
  mva: 30, edad: 42, anio_fab: 1984, usuarios: 12500, cond_int: 5, cond_lbl: 'Muy pobre'
});

const EQUIPO_B = Object.freeze({
  fila: 2, subestacion: 'SUBESTACIÓN B', matricula: 'TX-B-02',
  mva: 20, edad: 12, anio_fab: 2014, usuarios: 4200, cond_int: 2, cond_lbl: 'Buena'
});

// Papel AGOTADO: 2-FAL muy alto ⇒ vida consumida por encima del 100 %.
const DIAG_AGOTADO = Object.freeze({
  fur: 10000, efur: 5, h2: 40, ch4: 60, c2h4: 30, c2h6: 12, c2h2: 0.2,
  co: 900, co2: 6800, rig: 38, hum: 18, nn: 0.12, tif: 22, ic: 180,
  eadfq: 4, erig: 3, eic: 4, eherm: 2, ecrg: 5, crg: 96, eedad: 5,
  causa: 'ENVEJECIMIENTO DEL PAPEL'
});

// Papel SANO: 2-FAL bajo ⇒ vida consumida por debajo de 0 en la curva.
// La condición del equipo la explica la cargabilidad, no la celulosa.
const DIAG_SANO = Object.freeze({
  fur: 20, efur: 1, h2: 12, ch4: 4, c2h4: 3, c2h6: 1, c2h2: 0.1,
  co: 300, co2: 1900, rig: 52, hum: 8, nn: 0.02, tif: 40, ic: 2000,
  eadfq: 1, erig: 1, eic: 1, eherm: 1, ecrg: 5, crg: 94, eedad: 1,
  causa: 'CARGABILIDAD'
});

// Papel a media vida: entre el 50 % y el 100 % consumido.
const DIAG_MEDIO = Object.freeze({
  fur: 2000, efur: 4, ecrg: 2, crg: 60, causa: 'PAPEL'
});

// ── DP y vida útil ───────────────────────────────────────────────────────────

describe('dpInfo — topes corregidos de la curva de Chendong', () => {
  test('no reimplementa la curva: usa salud_activos', () => {
    const i = dpInfo(DIAG_MEDIO);
    assert.equal(i.dp, Math.round(calcularDP(DIAG_MEDIO.fur)));
  });

  test('papel agotado ⇒ "≥100 %", remanente 0, sin números absurdos', () => {
    const i = dpInfo(DIAG_AGOTADO);
    assert.ok(calcularVidaUtilizada(calcularDP(DIAG_AGOTADO.fur)) > 100, 'el caso debe salirse por arriba');
    assert.equal(i.fueraRango, true);
    assert.equal(i.papelSano, false);
    assert.equal(i.vidaTxt, '≥100');
    assert.equal(i.vidaUsada, 100);          // acotado, nunca 115 %
    assert.equal(i.remanente, 0);            // acotado, nunca negativo
  });

  test('papel sano ⇒ "<1 %", remanente 100, nunca negativo', () => {
    const i = dpInfo(DIAG_SANO);
    assert.ok(calcularVidaUtilizada(calcularDP(DIAG_SANO.fur)) < 0, 'el caso debe salirse por abajo');
    assert.equal(i.papelSano, true);
    assert.equal(i.fueraRango, false);
    assert.equal(i.vidaTxt, '<1');
    assert.equal(i.vidaUsada, 0);
    assert.equal(i.remanente, 100);
  });

  test('caso intermedio: cifra real, dentro de rango', () => {
    const i = dpInfo(DIAG_MEDIO);
    assert.equal(i.fueraRango, false);
    assert.equal(i.papelSano, false);
    assert.ok(i.vidaUsada > 50 && i.vidaUsada < 100, `vidaUsada=${i.vidaUsada}`);
    assert.ok(i.remanente > 0 && i.remanente < 50);
    assert.match(i.vidaTxt, /^\d+,\d$/);
  });

  test('todos los porcentajes quedan acotados a [0,100]', () => {
    for (const d of [DIAG_AGOTADO, DIAG_SANO, DIAG_MEDIO]) {
      const i = dpInfo(d);
      assert.ok(i.vidaUsada >= 0 && i.vidaUsada <= 100);
      assert.ok(i.remanente >= 0 && i.remanente <= 100);
    }
  });

  test('sin furanos, o con furanos no válidos, no se estima nada', () => {
    assert.equal(dpInfo(null), null);
    assert.equal(dpInfo({}), null);
    assert.equal(dpInfo({ fur: null }), null);
    assert.equal(dpInfo({ fur: 0 }), null);
    assert.equal(dpInfo({ fur: -5 }), null);
  });
});

// ── Modo de degradación ──────────────────────────────────────────────────────

describe('modoDegradacion — decide por el valor medido', () => {
  test('papel agotado ⇒ dominante es la celulosa, con hallazgos concurrentes', () => {
    const md = modoDegradacion(EQUIPO_A, DIAG_AGOTADO);
    assert.equal(md.dominante.k, 'papel');
    assert.ok(md.todos.length > 1);
    assert.ok(md.todos.some((m) => m.k === 'carga'));
    assert.ok(md.todos.some((m) => m.k === 'edad'));
    assert.equal(md.alerta, null);            // la fuente y los ensayos coinciden
  });

  test('papel sano ⇒ el dominante NO es la celulosa', () => {
    const md = modoDegradacion(EQUIPO_B, DIAG_SANO);
    assert.equal(md.dominante.k, 'carga');
    assert.ok(!md.todos.some((m) => m.k === 'papel'));
  });

  test('arco: el acetileno manda sobre la degradación del aceite', () => {
    const md = modoDegradacion(EQUIPO_B, { c2h2: 30, eadfq: 5, rig: 30, hum: 20, nn: 0.2, tif: 18 });
    assert.equal(md.dominante.k, 'arco');
    assert.match(md.dominante.e, /acetileno/);
  });

  test('descargas parciales: H₂ alto con etileno ausente', () => {
    const md = modoDegradacion(EQUIPO_B, { h2: 1500, ch4: 80, c2h4: 5 });
    assert.equal(md.dominante.k, 'descargas');
    assert.match(md.dominante.e, /descargas parciales, no con envejecimiento térmico del papel/);
  });

  test('alerta de incoherencia: la fuente culpa al papel y los furanos la desmienten', () => {
    const md = modoDegradacion(EQUIPO_B, {
      fur: 20, efur: 1, c2h2: 30, causa: 'ENVEJECIMIENTO DEL PAPEL / CELULOSA'
    });
    assert.ok(md.alerta, 'debe advertir la contradicción');
    assert.match(md.alerta, /CAUSANTE/);
    assert.match(md.alerta, /Verificar antes de emitir la ficha/);
  });

  test('sin hallazgos medidos no se fabrica un modo', () => {
    assert.equal(modoDegradacion(EQUIPO_B, null), null);
    assert.equal(modoDegradacion(EQUIPO_B, { fur: 20, efur: 1, c2h4: 2 }), null);
  });
});

// ── Redacción ────────────────────────────────────────────────────────────────

describe('redaccionAlcance — anclada en las cifras del equipo', () => {
  test('nombra el activo, su condición y su diagnóstico dominante', () => {
    const t = redaccionAlcance(EQUIPO_A, DIAG_AGOTADO);
    assert.match(t, /30 MVA/);
    assert.match(t, /SUBESTACIÓN A/);
    assert.match(t, /TX-A-01/);
    assert.match(t, /5 de 5 — Muy pobre/);
    assert.match(t, /42 años de servicio \(fabricación 1984\)/);
    assert.match(t, /degradación del aislamiento sólido/i);
    assert.match(t, /12\.500 usuarios/);
    assert.match(t, /ISO 55001/);
  });

  test('cargabilidad ≥ 90 % aparece como falta de margen', () => {
    assert.match(redaccionAlcance(EQUIPO_A, DIAG_AGOTADO), /96 % de su capacidad nominal/);
    assert.doesNotMatch(redaccionAlcance(EQUIPO_A, DIAG_MEDIO), /de su capacidad nominal/);
  });

  test('dos equipos distintos producen textos distintos', () => {
    assert.notEqual(redaccionAlcance(EQUIPO_A, DIAG_AGOTADO), redaccionAlcance(EQUIPO_B, DIAG_SANO));
  });

  test('sin diagnóstico se redacta igual, sin inventar hallazgos', () => {
    const t = redaccionAlcance(EQUIPO_B, null);
    assert.match(t, /SUBESTACIÓN B/);
    assert.doesNotMatch(t, /diagnóstico dominante/);
  });
});

describe('redaccionBeneficios — el papel sano NO recibe el argumento de furanos', () => {
  test('papel agotado ⇒ sí se invoca el fin de vida del aislamiento', () => {
    const t = redaccionBeneficios(EQUIPO_A, DIAG_AGOTADO);
    assert.match(t, /Restablecimiento de la vida útil/);
    assert.match(t, /está agotado/);
    assert.match(t, /2-FAL de 10\.000 ppb/);
  });

  test('papel sano ⇒ NUNCA se invoca el fin de vida ni los furanos', () => {
    const t = redaccionBeneficios(EQUIPO_B, DIAG_SANO);
    assert.doesNotMatch(t, /Restablecimiento de la vida útil/);
    assert.doesNotMatch(t, /agotado/);
    assert.doesNotMatch(t, /2-FAL/);
    assert.doesNotMatch(t, /fin de vida por/);
  });

  test('las dos redacciones son DISTINTAS', () => {
    assert.notEqual(
      redaccionBeneficios(EQUIPO_A, DIAG_AGOTADO),
      redaccionBeneficios(EQUIPO_B, DIAG_SANO)
    );
  });

  test('papel a media vida ⇒ se cita el porcentaje real, no "agotado"', () => {
    const t = redaccionBeneficios(EQUIPO_A, DIAG_MEDIO);
    assert.match(t, /Restablecimiento de la vida útil/);
    assert.doesNotMatch(t, /está agotado/);
    assert.match(t, /de la vida de su aislamiento consumida/);
  });

  test('el modo de degradación del equipo entra en la primera viñeta', () => {
    assert.match(redaccionBeneficios(EQUIPO_B, DIAG_SANO), /cargabilidad en el límite/i);
    assert.match(redaccionBeneficios(EQUIPO_A, DIAG_AGOTADO), /aislamiento sólido/i);
  });

  test('sin diagnóstico se entregan los beneficios genéricos, sin cifras falsas', () => {
    const t = redaccionBeneficios(EQUIPO_B, null);
    assert.match(t, /Mayor confiabilidad operativa/);
    assert.doesNotMatch(t, /Restablecimiento de la vida útil/);
    assert.doesNotMatch(t, /modo de falla identificado/);
  });
});

describe('numES — formato colombiano sin depender del ICU', () => {
  test('miles y decimales', () => {
    assert.equal(numES(1234567), '1.234.567');
    assert.equal(numES(63.44, 1), '63,4');
    assert.equal(numES(0.024, 2), '0,02');
    assert.equal(numES(null), '');
  });
});
