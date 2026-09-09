// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El tipo constructivo deja de adivinarse
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El catálogo de la CREG 015/2018 solo cataloga unidades MONOFÁSICAS en
// los niveles 5 y 6 (autotransformadores de conexión al STN). En los
// niveles 3 y 4, todas sus unidades son trifásicas.
//
// El sistema no guardaba el número de fases, así que el clasificador
// tenía que ASUMIR trifásico. Esa suposición salió cara (`99 §74.12`):
// TRES PALMAS T1/T2/T3 son monofásicos de 250 kVA en nivel 3, y se les
// venía asignando `N3T1` — una banda trifásica, de una capacidad que la
// norma tampoco define. Una interpretación disfrazada de dato.
//
// Ahora `electrico.fases` (1 ó 3) alimenta al clasificador. Sin el dato,
// todo se comporta EXACTAMENTE como antes: el campo es opcional y su
// ausencia no cambia ningún veredicto ya emitido.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { clasificarUC } from '../assets/js/domain/fichas_creg_uc.js';
import { sanitizarTransformador } from '../assets/js/domain/transformador_schema.js';
import { normalizarEquipo } from '../assets/js/ui/fichas/panel.js';

describe('clasificarUC — el número de fases elige la familia', () => {

  // 🔒 EL INVARIANTE. El caso real de TRES PALMAS.
  test('un monofásico en nivel 3 NO tiene Unidad Constructiva, y se dice', () => {
    const r = clasificarUC(250, 34.5, null, 'NLTC', 1);
    assert.equal(r.uucc_calc, null,
      'asignarle una banda trifásica sería una interpretación, no un dato');
    const nota = r.notas.find((n) => /MONOFASICO en nivel/.test(n));
    assert.ok(nota, 'debe explicar por qué no hay UC');
    assert.match(nota, /solo cataloga unidades monofasicas en los niveles 5 y 6/);
  });

  test('un monofásico en nivel 5 SÍ tiene: la familia autotransformador', () => {
    const r = clasificarUC(100000, 220, null, 'OLTC', 1);
    assert.equal(r.uucc_calc, 'N5T16', 'N5T11-N5T18 es la familia monofásica');
  });

  test('un trifásico en nivel 5 va a la familia trifásica', () => {
    const r = clasificarUC(100000, 220, null, 'OLTC', 3);
    assert.equal(r.uucc_calc, 'N5T7');
  });

  // Sin el dato, nada cambia: es la garantía de que añadir el campo no
  // movió ningún veredicto de los 208 equipos que no lo tienen.
  test('SIN el dato, el resultado es idéntico al de antes', () => {
    for (const caso of [[250, 34.5, null, 'NLTC'], [100000, 220, null, 'OLTC'],
                        [50000, 110, 13.8, 'OLTC'], [33000, 66, null, 'OLTC']]) {
      const sin = clasificarUC(...caso);
      const conTres = clasificarUC(...caso, 3);
      assert.equal(sin.uucc_calc, conTres.uucc_calc,
        `sin fases y con fases=3 deben coincidir: ${caso.join(',')}`);
    }
  });

  test('la advertencia «se asume trifásico» desaparece cuando ya se sabe', () => {
    const sinDato = clasificarUC(100000, 220, null, 'OLTC');
    const conDato = clasificarUC(100000, 220, null, 'OLTC', 3);
    assert.ok(sinDato.notas.some((n) => /se asume trifasico/.test(n)),
      'sin dato hay suposición, y se advierte');
    assert.ok(!conDato.notas.some((n) => /se asume trifasico/.test(n)),
      'con dato no hay suposición: repetir el aviso enseña a ignorarlo');
  });

  test('un valor de fases que no sea 1 ni 3 se ignora, no rompe', () => {
    assert.equal(clasificarUC(100000, 220, null, 'OLTC', 2).uucc_calc, 'N5T7');
    assert.equal(clasificarUC(100000, 220, null, 'OLTC', 0).uucc_calc, 'N5T7');
  });
});

describe('esquema — `electrico.fases` solo acepta 1 o 3', () => {
  const fases = (v) => sanitizarTransformador({
    identificacion: { codigo: 'X', nombre: 'X', tipo_activo: 'POTENCIA' },
    ubicacion: { departamento: 'sucre' }, estado_servicio: 'operativo',
    electrico: { fases: v }
  }).electrico.fases;

  test('acepta 1 y 3, también como texto', () => {
    assert.equal(fases(1), 1);
    assert.equal(fases(3), 3);
    assert.equal(fases('3'), 3);
  });

  test('cualquier otra cosa queda en null — media fase no existe', () => {
    for (const v of [2, 0, -1, 'trifasico', '', null, undefined]) {
      assert.equal(fases(v), null, `${JSON.stringify(v)} no debería colarse`);
    }
  });
});

describe('normalizarEquipo — lee las fases del documento', () => {
  test('un monofásico de nivel 3 llega a la pantalla sin UC calculada', () => {
    const e = normalizarEquipo({
      potencia_kva: 250, tension_primaria_kv: 34.5,
      identificacion: { uucc: 'N3T1' },
      electrico: { tension_primaria_kv: 34.5, fases: 1 }
    }, 0);
    assert.equal(e.fases, 1);
    assert.equal(e.uucc_calculada, '');
    assert.equal(e.estado, 'SIN CALCULO',
      'sin UC que calcular, el veredicto es «no se puede», no «concordante»');
  });

  // El equipo va POR ENCIMA del mínimo del catálogo a propósito: así esta
  // prueba mide solo la dimensión de las fases. Con 250 kVA medía dos cosas a
  // la vez y se rompió al cambiar el criterio del mínimo — un ejemplo mal
  // elegido convierte una prueba en una alarma falsa.
  test('sin el dato sigue clasificando como siempre', () => {
    const e = normalizarEquipo({
      potencia_kva: 6500, tension_primaria_kv: 34.5,
      identificacion: { uucc: 'N3T3' },
      electrico: { tension_primaria_kv: 34.5 }
    }, 0);
    assert.equal(e.fases, null);
    assert.equal(e.uucc_calculada, 'N3T3');
    assert.equal(e.estado, 'CONCORDANTE');
  });

  // El caso de CUIVA: trifásico, pero 225 kVA — por debajo del mínimo del
  // catálogo. Tampoco tiene UC, y por un motivo distinto al de TRES PALMAS.
  test('un trifásico por debajo del mínimo del catálogo tampoco tiene UC', () => {
    const e = normalizarEquipo({
      potencia_kva: 225, tension_primaria_kv: 34.5,
      identificacion: { uucc: 'N3T1' },
      electrico: { tension_primaria_kv: 34.5, fases: 3 }
    }, 0);
    assert.equal(e.fases, 3);
    assert.equal(e.uucc_calculada, '');
    assert.equal(e.estado, 'SIN CALCULO');
  });
});
