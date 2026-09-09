// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El import no escribe claves vacías (TODO-51)
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// `sanitizarTransformador` devuelve SIEMPRE todas las claves de todas
// las secciones, rellenando con '' o null lo que el Excel no traiga. Y
// el escritor usa `merge: true`, donde una clave presente con valor
// vacío NO se ignora: SOBRESCRIBE. Cada importación borraba en silencio
// todo lo que el Excel no conoce.
//
// Le pasó a la UUCC (2026-09-08, se parcheó a mano en el parser) y habría
// vuelto a pasar con cualquier dato cargado por otra vía: coordenadas,
// marca, fechas, el tipo constructivo.
//
// La regla: con `merge: true` una clave AUSENTE deja intacto lo guardado.
// El Excel manda sobre lo que TRAE y calla sobre lo que no.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ralo } from '../assets/js/domain/importador.js';

describe('ralo — quita lo vacío, respeta lo que es dato', () => {

  test('quita cadenas vacías, null y undefined', () => {
    assert.deepEqual(ralo({ a: 1, b: '', c: null, d: undefined }), { a: 1 });
  });

  // 🔒 Lo que más duele perder por accidente: un 0 legítimo.
  test('0 y false NO son vacíos: son datos', () => {
    const r = ralo({ tap: 0, hermetico: false, carga: 0.0 });
    assert.deepEqual(r, { tap: 0, hermetico: false, carga: 0 });
  });

  test('limpia en profundidad, sección por sección', () => {
    const r = ralo({
      identificacion: { codigo: 'TX-1', uucc: '', grupo: 'G3' },
      electrico: { tension_primaria_kv: 110, tension_terciaria_kv: null }
    });
    assert.deepEqual(r, {
      identificacion: { codigo: 'TX-1', grupo: 'G3' },
      electrico: { tension_primaria_kv: 110 }
    });
  });

  test('una sección que se queda sin nada no viaja', () => {
    const r = ralo({ codigo: 'TX-1', ubicacion: { latitud: null, longitud: null } });
    assert.deepEqual(r, { codigo: 'TX-1' });
    assert.equal('ubicacion' in r, false,
      'escribir ubicacion:{} no aporta nada y en algunas rutas borra hermanos');
  });

  test('un documento entero vacío devuelve undefined, no {}', () => {
    assert.equal(ralo({ a: '', b: null }), undefined);
  });

  test('los arrays viajan enteros, sin tocar', () => {
    const r = ralo({ estados: [], overrides: ['a', 'b'] });
    assert.deepEqual(r.overrides, ['a', 'b']);
    assert.deepEqual(r.estados, []);
  });

  test('las fechas no se destripan', () => {
    const d = new Date('2026-09-08T00:00:00Z');
    assert.equal(ralo({ f: d }).f, d);
  });

  // El caso que origino todo: el Excel del parque no trae UUCC ni fases.
  test('el caso real: lo que el Excel no trae, no se escribe', () => {
    const doc = {
      codigo: 'T1-M/M-TPS',
      identificacion: { codigo: 'T1-M/M-TPS', uucc: '' },
      electrico: { tension_primaria_kv: 34.5, fases: null },
      ubicacion: { departamento: 'SUCRE', latitud: null, longitud: null }
    };
    const r = ralo(doc);
    assert.equal('uucc' in r.identificacion, false, 'la UUCC guardada sobrevive');
    assert.equal('fases' in r.electrico, false, 'el tipo constructivo sobrevive');
    assert.equal('latitud' in r.ubicacion, false, 'las coordenadas sobreviven');
    assert.equal(r.ubicacion.departamento, 'SUCRE', 'lo que SÍ trae, se escribe');
  });
});
