// Panel «Gases disueltos (DGA) y carga» · textos según el equipo tenga o no las ppm de la última muestra (`99 §133`).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_DGA, NO_PUEDE_SABER } from '../assets/js/domain/scada_carga_dga_textos.js';
import { TEXTOS_CON_PPM, NO_PUEDE_SABER_TIPO, textoItem, noPuedeSaber } from '../assets/js/domain/scada_carga_dga_textos_ppm.js';

const todos = [...CATALOGO_DGA.adversidades, ...CATALOGO_DGA.acciones];

describe('textos del panel DGA según las ppm', () => {
  test('cada variante corresponde a un ítem que existe en el catálogo', () => {
    for (const id of Object.keys(TEXTOS_CON_PPM)) assert.ok(todos.some((it) => it.id === id), id);
  });
  test('sin ppm queda el texto del catálogo; con ppm, la variante (los demás ítems no cambian)', () => {
    for (const it of todos) {
      assert.equal(textoItem(it, false), it.texto);
      assert.equal(textoItem(it, true), TEXTOS_CON_PPM[it.id] || it.texto);
    }
  });
  test('ninguna variante dice que la plataforma solo tiene calificaciones ni manda a pedir las ppm de la última muestra', () => {
    for (const t of [...Object.values(TEXTOS_CON_PPM), NO_PUEDE_SABER_TIPO.conPpm]) {
      assert.doesNotMatch(t, /guarda calificaciones de 1 a 5/);
      assert.doesNotMatch(t, /de la última muestra, las partes por millón/);
    }
  });
  test('«Lo que este panel no puede saber»: cambia SOLO el ítem del tipo de defecto, en su lugar', () => {
    const i = NO_PUEDE_SABER.findIndex((t) => t.startsWith(NO_PUEDE_SABER_TIPO.prefijo));
    assert.ok(i >= 0, 'el catálogo trae el ítem del tipo de defecto');
    for (const [conPpm, esperado] of [[true, NO_PUEDE_SABER_TIPO.conPpm], [false, NO_PUEDE_SABER_TIPO.sinPpm]]) {
      const l = noPuedeSaber(NO_PUEDE_SABER, conPpm);
      assert.equal(l.length, NO_PUEDE_SABER.length); assert.equal(l[i], esperado);
      l.forEach((t, j) => { if (j !== i) assert.equal(t, NO_PUEDE_SABER[j]); });
    }
    assert.deepEqual(noPuedeSaber(null, true), []);
  });
});
