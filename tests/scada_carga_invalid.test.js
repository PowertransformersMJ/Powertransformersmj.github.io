// Cargabilidad SCADA — BANDERA «INVALID» NO CONFIABLE de un punto (decisión del Ingeniero 2026-10-28: La Europa y Ovejas),
// con datos SINTÉTICOS («EstDemo»). Lo que se exige: con la opción, solo la bandera «Invalid» se acepta (los valores y
// banderas crudos no cambian); «Not Renewed», sin archivo, congelado y cero siguen igual; un mes guardado se puede volver a
// limpiar sin las carpetas; el importador y el diálogo usan la marca.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limpiarNivel } from '../assets/js/domain/scada_carga_limpieza.js';
import { procesarPuntoMes } from '../assets/js/domain/scada_carga_importacion.js';
import { invalidNoConfiable, puntosInvalidNoConfiable, reprocesarGuardado, conMarcaInvalid } from '../assets/js/domain/scada_carga_invalid.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO, BANDERA, FAMILIAS } from '../assets/js/domain/scada_carga_config.js';

const N = 48;
/** Un nivel crudo de 13,8 kV: horas 0–23 «Actual», 24–35 «Invalid», 36–41 «Not Renewed», 42–47 sin archivo. */
function crudo() {
  const fams = {};
  for (const f of FAMILIAS) {
    const v = new Float32Array(N).fill(NaN); const b = new Uint8Array(N); const presente = new Uint8Array(N);
    for (let h = 0; h < 42; h++) {
      presente[h] = 1;
      v[h] = f[0] === 'I' ? Math.fround(20 + (h % 7)) : (f[0] === 'U' ? 13.8 + (h % 3) / 100 : Math.fround(0.4 + (h % 5) / 100));
      b[h] = h < 24 ? BANDERA.ACTUAL : (h < 36 ? BANDERA.INVALID : BANDERA.NOT_RENEWED);
    }
    fams[f] = { v, b, presente };
  }
  return fams;
}
const codigos = (out, f) => [...out[f].m];

describe('limpieza con la bandera «Invalid» no confiable', () => {
  test('sin la opción, «Invalid» es hueco (como siempre)', () => {
    const m = codigos(limpiarNivel(crudo(), 13.8), 'IR');
    assert.ok(m.slice(24, 36).every((c) => c === CODIGO.BANDERA));
  });
  test('con la opción, SOLO «Invalid» pasa; «Not Renewed» y sin archivo siguen; valores y banderas crudos intactos', () => {
    const c = crudo();
    const out = limpiarNivel(c, 13.8, { aceptarInvalid: true });
    const m = codigos(out, 'IR');
    assert.ok(m.slice(24, 36).every((x) => x === CODIGO.VALIDO), 'las horas «Invalid» quedan válidas');
    assert.ok(m.slice(36, 42).every((x) => x === CODIGO.BANDERA), '«Not Renewed» sigue siendo hueco');
    assert.ok(m.slice(42).every((x) => x === CODIGO.SIN_ARCHIVO));
    assert.deepEqual([...out.IR.b], [...c.IR.b], 'la bandera cruda no cambia');
    assert.deepEqual([...out.IR.v], [...c.IR.v]);
  });
});

describe('volver a limpiar un mes ya guardado', () => {
  test('mismo resultado que haberlo importado con la marca, sin releer las carpetas', () => {
    const guardado = procesarPuntoMes({ N13_8: crudo() }, null, 'completar');           // como se guardó (sin la marca)
    assert.equal(guardado.resumen.N13_8.i.n, 24);
    const conMarca = procesarPuntoMes({ N13_8: crudo() }, null, 'completar', { aceptarInvalid: true });
    const r = reprocesarGuardado({ niveles: guardado.niveles });
    assert.equal(r.resumen.N13_8.i.n, 36);
    assert.equal(r.resumen.N13_8.invalidAceptadas, 12, 'el resumen deja el rastro de las horas aceptadas');
    const { invalidAceptadas, ...resto } = r.resumen.N13_8;
    assert.deepEqual(resto, conMarca.resumen.N13_8);
    for (const f of FAMILIAS) {
      assert.deepEqual([...r.niveles.N13_8.fam[f].m], [...conMarca.niveles.N13_8.fam[f].m], f);
      assert.deepEqual([...r.niveles.N13_8.fam[f].v], [...guardado.niveles.N13_8.fam[f].v], f + ' valores');
    }
  });
  test('sin horas «Invalid», volver a limpiar no cambia nada (salvo el rastro en 0)', () => {
    const c = crudo(); for (const f of FAMILIAS) for (let h = 24; h < 36; h++) c[f].b[h] = BANDERA.ACTUAL;
    const g = procesarPuntoMes({ N13_8: c }, null, 'completar');
    const { invalidAceptadas, ...resto } = reprocesarGuardado({ niveles: g.niveles }).resumen.N13_8;
    assert.equal(invalidAceptadas, 0); assert.deepEqual(resto, g.resumen.N13_8);
  });
  test('un limpiador viejo (que ignora la opción) se detiene en vez de guardar lo de siempre', () => {
    const viejo = procesarPuntoMes({ N13_8: crudo() }, null, 'completar');   // como lo daría un módulo viejo en caché
    assert.throws(() => conMarcaInvalid(viejo), /versión anterior/);
  });
});

describe('la marca en la homologación', () => {
  const fila = (decision, extra = {}) => ({ clave_excel: '/EstDemo1/DEM302', decision, ...extra });
  test('solo con «usar» y la marca exactamente true; el punto es el de la clave efectiva', () => {
    assert.equal(invalidNoConfiable(fila({ tipo: 'usar', invalid_no_confiable: true })), true);
    assert.equal(invalidNoConfiable(fila({ tipo: 'no_usar', invalid_no_confiable: true })), false);
    assert.equal(invalidNoConfiable(fila({ tipo: 'usar', invalid_no_confiable: 'si' })), false);
    const p = puntosInvalidNoConfiable({ a: fila({ tipo: 'usar', clave: '/EstDemo1/DEM302', invalid_no_confiable: true }),
      b: fila({ tipo: 'usar', clave: '/EstDemo2/DEM303' }), c: fila({ tipo: 'usar', invalid_no_confiable: true }, { retirada: true }) });
    assert.deepEqual([...p], [claveId('EstDemo1', 'DEM302')]);
  });
  test('el importador la aplica y el diálogo «Revisar» la conserva', () => {
    const w = readFileSync(new URL('../assets/js/workers/scada_carga_importar.worker.js', import.meta.url), 'utf8');
    assert.match(w, /conInvalid\.has\(cid\) \? conMarcaInvalid\(procesarPuntoMes\(nuevo, g, modo, \{ aceptarInvalid: true \}\)\) : procesarPuntoMes\(nuevo, g, modo\)/);
    const im = readFileSync(new URL('../assets/js/ui/scada-datos/importar-mes.js', import.meta.url), 'utf8');
    assert.match(im, /puntosInvalidNoConfiable\(filasVigentes\(\)\)\.size && procesado\.versionInvalid == null/);
    assert.match(im, /\+ '\|' \+ JSON\.stringify\(\[\.\.\.puntosInvalidNoConfiable\(filasVigentes\(\)\)\]\.sort\(\)\)/);
    const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
    assert.match(h, /decision\.invalid_no_confiable = true;/);
  });
});
