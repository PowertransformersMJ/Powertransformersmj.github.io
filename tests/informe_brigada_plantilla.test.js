// Informe de Mantenimiento Brigada (F60-ADM) — plantilla «forma + erratas» (decisión 7).
// Amarres: las actividades son los motivos de Órdenes de materiales y los nombres de condición
// son los de Fichas; si alguien cambia esas listas, esta prueba lo dice.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as P from '../assets/js/domain/informe_brigada_plantilla.js';

const leer = (r) => readFileSync(new URL('../' + r, import.meta.url), 'utf8');

/** Todos los textos (strings) que cuelgan de un valor. */
function textos(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => textos(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => textos(x, out));
  return out;
}
const TODOS = textos([P.TEXTOS, P.CONCLUSIONES, P.RECOMENDACIONES, P.TITULOS, P.INDICE, P.PORTADA, P.FIRMAS_PORTADA,
  P.TABLAS, P.ANEXO_TITULOS, P.FIGURAS_DEFECTO, P.MATERIAL_DEFECTO, P.HERRAMIENTAS_DEFECTO, P.SST_DEFECTO, P.FORMATO,
  P.MODELOS, P.FRASES, P.HALLAZGO_DEFECTO]);

describe('amarres con el resto de la plataforma', () => {
  test('ACTIVIDADES = los 8 motivos de Órdenes de materiales, en el mismo orden y texto', () => {
    const src = leer('assets/js/ordenes-materiales.js');
    const bloque = /motivos:\s*\[([\s\S]*?)\]/.exec(src);
    assert.ok(bloque, 'no encontré la lista «motivos» en ordenes-materiales.js');
    const motivos = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.equal(motivos.length, 8);
    assert.deepEqual([...P.ACTIVIDADES], motivos);
    assert.equal(P.ACTIVIDAD_REFRIGERACION, 'Actualización y repotenciación del sistema de refrigeración.');
  });
  test('NOMBRE_CONDICION = el de Fichas (ui/fichas/ficha-tecnica.js)', () => {
    const src = leer('assets/js/ui/fichas/ficha-tecnica.js');
    const m = /NOMBRE_CONDICION\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(src);
    assert.ok(m, 'no encontré NOMBRE_CONDICION en ficha-tecnica.js');
    const pares = Object.fromEntries([...m[1].matchAll(/(\d)\s*:\s*'([^']+)'/g)].map((x) => [x[1], x[2]]));
    assert.deepEqual({ ...P.NOMBRE_CONDICION }, pares);
  });
  test('solo la actividad de refrigeración tiene modelo hoy', () => {
    assert.equal(P.modeloDeActividad(P.ACTIVIDAD_REFRIGERACION), 'F60-REFRIG@1');
    P.ACTIVIDADES.slice(1).forEach((a) => assert.equal(P.modeloDeActividad(a), null, a));
    assert.equal(P.modeloDeActividad(''), null);
    assert.equal(P.MODELOS['F60-REFRIG@1'].aprobada, false);
  });
});

describe('las 19 erratas no vuelven', () => {
  const PROHIBIDAS = [/perdidas/, /ESPECIFICOS/, /sobre corriente/, /FICHA TECNICA/, /CALCULO/, /INFORMACION /,
    /actividades, fue/, /COLLING/, /DESCRIPCIÓN DE LOS TRABAJOS/, /Personal y fecha/, /FECHA DE EJECUCION/, / {2}/, /Tabla 4\./];
  test('ningún texto fijo trae una errata ni dobles espacios', () => {
    for (const t of TODOS) for (const re of PROHIBIDAS) assert.doesNotMatch(t, re, `«${t.slice(0, 60)}…» trae ${re}`);
  });
  test('textos corregidos presentes', () => {
    assert.match(P.TEXTOS.intro_p3, /disipación eficiente de pérdidas/);
    assert.equal(P.TITULOS.s2_1_2.texto, 'OBJETIVOS ESPECÍFICOS');
    assert.match(P.TEXTOS.obj_esp_1, /refrigeración de pérdidas/);
    assert.match(P.TEXTOS.obj_esp_2, /ante sobrecorriente/);
    assert.match(P.TEXTOS.personal, /^La ejecución de las actividades fue realizada/);
    assert.equal(P.TABLAS.t5.etiqueta, 'Tabla 5.');
    assert.equal(P.ANEXO_TITULOS.calculo.titulo, 'CÁLCULO DE VENTILADORES');
    assert.match(P.ANEXO_TITULOS.ficha_actual.titulo, /^FICHA TÉCNICA/);
    assert.match(P.PORTADA.datos[5], /^FECHA DE EJECUCIÓN: \{fecha_fin\}$/);
    assert.equal(P.PORTADA.titulo[2], '{matricula}.');
    assert.match(P.CONCLUSIONES[0].texto, /transformador de potencia \{matricula\}/);
  });
  test('ningún texto fijo trae HTML', () => {
    for (const t of TODOS) assert.doesNotMatch(t, /[<>]/, t.slice(0, 60));
  });
});

describe('índice, títulos y firmas', () => {
  test('el índice de la portada coincide con los títulos del cuerpo', () => {
    const porNumero = Object.fromEntries(Object.values(P.TITULOS).map((t) => [t.numero, t.texto]));
    assert.equal(P.INDICE.length, 8);
    for (const r of P.INDICE) assert.equal(r.texto.toLocaleUpperCase('es-CO'), porNumero[r.numero], r.numero);
    assert.deepEqual(P.INDICE.filter((r) => r.nivel === 2).map((r) => r.numero), ['2.1', '2.2', '2.3']);
    assert.equal(P.INDICE[1].texto, 'DESCRIPCIÓN DE TRABAJOS');
    assert.equal(P.INDICE[3].texto, 'Personal');
  });
  test('las 3 casillas dicen «Fecha / Firma:» con dos puntos (errata 8)', () => {
    assert.deepEqual(P.FIRMAS_PORTADA.map((f) => f.casilla), ['Fecha / Firma:', 'Fecha / Firma:', 'Fecha / Firma:']);
    assert.deepEqual([...P.ROLES_FIRMA], ['elaborado', 'revisado', 'aprobado']);
  });
  test('saltos de hoja en 3. y 4.; «5.» escrito a mano', () => {
    assert.equal(P.TITULOS.s3.saltoAntes, true);
    assert.equal(P.TITULOS.s4.saltoAntes, true);
    assert.equal(P.TITULOS.s5.estilo, 'manual');
    assert.equal(P.TITULOS.s5_1.estilo, 'plano');
  });
});

describe('figuras, listas y marca', () => {
  test('22 figuras por defecto (una cuadrícula de una sola figura cuenta una)', () => {
    let n = 0;
    for (const s of P.SECCIONES_FIGURAS) for (const g of P.FIGURAS_DEFECTO[s]) {
      const d = P.DISPOSICIONES[g.disposicion];
      assert.ok(d, g.disposicion);
      assert.equal(g.pies.length, d.figuras);
      n += d.figuras;
    }
    assert.equal(n, 22);
  });
  test('listas por defecto palabra por palabra', () => {
    assert.equal(P.MATERIAL_DEFECTO.length, 6);
    assert.equal(P.HERRAMIENTAS_DEFECTO.length, 9);
    assert.equal(P.SST_DEFECTO.length, 8);
    assert.equal(P.SST_DEFECTO.filter((x) => x.por_persona).length, 5);
    assert.equal(P.HERRAMIENTAS_DEFECTO[7].descripcion, 'COPA SIERRA ½”');
  });
  test('5 claves de marca con su posición', () => {
    assert.deepEqual([...P.MARCA_CLAVES], ['applus-encabezado', 'together-encabezado', 'applus-portada', 'together-portada', 'afinia-portada']);
    P.MARCA_CLAVES.forEach((k) => assert.ok(P.MARCA_GEOMETRIA[k] && P.MARCA_GEOMETRIA[k].w > 0, k));
    assert.equal(P.FORMATO.codigo, 'F60-ADM V. 11 – 16/09/2024');
  });
  test('anexo de cálculo: solo dos tablas (decisión 9)', () => {
    assert.deepEqual(Object.keys(P.TABLAS.calculo).filter((k) => ['actual', 'proyectado'].includes(k)), ['actual', 'proyectado']);
    assert.deepEqual([...P.TABLAS.calculo.actual.encabezados], ['TIPO / MODELO', 'CANTIDAD', 'CFM POR UNIDAD', 'CFM TOTAL']);
    assert.deepEqual([...P.TABLAS.calculo.proyectado.encabezados], ['MODELO', 'CANTIDAD', 'CFM POR UNIDAD', 'CFM TOTAL']);
  });
});

describe('aRuns: marcas de la plantilla y variables', () => {
  test('negrita y resaltado de la plantilla', () => {
    const r = P.aRuns('a [b]{x}[/b] y [m]c {y}[/m].', { x: 'X', y: 'Y' });
    assert.deepEqual(r, [{ t: 'a ' }, { t: 'X', b: true }, { t: ' y ' }, { t: 'c Y', mark: true }, { t: '.' }]);
  });
  test('una variable con marcas o HTML queda como texto literal', () => {
    const r = P.aRuns('[b]{x}[/b]', { x: '[b]hola[/b] <script>' });
    assert.deepEqual(r, [{ t: '[b]hola[/b] <script>', b: true }]);
  });
  test('variable que falta → hueco visible; variable vacía → nada', () => {
    assert.deepEqual(P.aRuns('de {onaf} MVA', {}), [{ t: 'de ' }, { t: '[potencia ONAF]', falta: true }, { t: ' MVA' }]);
    assert.deepEqual(P.aRuns('el ingeniero X{frase_tecnicos}, hoy', { frase_tecnicos: '' }), [{ t: 'el ingeniero X, hoy' }]);
  });
  test('variablesDe y rellenar', () => {
    assert.deepEqual(P.variablesDe('{a} y {b} y {a}'), ['a', 'b']);
    assert.equal(P.rellenar('[b]{a}[/b]!', { a: 'Hola' }), 'Hola!');
  });
});
