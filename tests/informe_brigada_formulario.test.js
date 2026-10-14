// Informe de Mantenimiento Brigada · formulario por secciones (dominio puro).
// Amarra el formulario con el contenido del informe (dominio de B1): toda ruta
// que pide la pantalla existe en un informe vacío y todo faltante lleva a una
// sección que existe. Datos INVENTADOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECCIONES, IDS_SECCION, seccionDeRuta, seccionDeFaltante, buscarSeccion, contarFaltantesPorSeccion,
  valorEnRuta, existeRuta, leerNumero, numeroEnCasilla, totalesVentiladores, numeracionFiguras,
  reestructurarCuadricula, siguienteId, idsUsados, FORMA_DISPOSICION, ORDEN_FIGURAS,
  puedeEmitir, escaparHtml, sinMarcas, haceCuanto
} from '../assets/js/domain/informe_brigada_formulario.js';
import * as MODELO from '../assets/js/domain/informe_brigada_modelo.js';
import * as PLANTILLA from '../assets/js/domain/informe_brigada_plantilla.js';

const vacio = () => MODELO.informeVacio({ actividad: PLANTILLA.ACTIVIDAD_REFRIGERACION });

describe('secciones del formulario contra el contenido del informe', () => {
  test('ids de sección: los mismos que usa faltantes() (plan §3.5)', () => {
    assert.deepEqual([...IDS_SECCION], ['portada', 's1', 's2_1', 's2_2', 's2_3', 's3', 's4_1', 's4_2', 's4_3', 's4_4', 's4_final', 's5', 'anexos', 'firmas']);
  });
  test('toda ruta de SECCIONES existe en informeVacio()', () => {
    const c = vacio();
    const faltan = [];
    for (const s of SECCIONES) for (const campo of s.campos) if (!existeRuta(c, campo.ruta)) faltan.push(s.id + ' → ' + campo.ruta);
    assert.deepEqual(faltan, []);
  });
  test('cada texto de plantilla del formulario existe en textos{} (null = plantilla)', () => {
    const c = vacio();
    for (const s of SECCIONES) for (const campo of s.campos) {
      if (campo.tipo !== 'texto_plantilla') continue;
      assert.ok(Object.prototype.hasOwnProperty.call(c.textos, campo.plantilla), campo.plantilla);
    }
  });
  test('cada sección de figuras del formulario existe y está en el orden del papel', () => {
    const c = vacio();
    const enFormulario = [];
    for (const s of SECCIONES) for (const campo of s.campos) if (campo.tipo === 'figuras') enFormulario.push(campo.clave);
    assert.deepEqual(enFormulario, [...ORDEN_FIGURAS]);
    for (const k of ORDEN_FIGURAS) assert.ok(Array.isArray(c.figuras[k]), k);
  });
  test('todo faltante del informe vacío lleva a una sección que existe', () => {
    const lista = MODELO.faltantes(vacio(), { config: { editores: [], marca: {} } });
    assert.ok(lista.length > 0, 'el informe vacío tiene faltantes');
    for (const f of lista) {
      assert.ok(IDS_SECCION.includes(seccionDeFaltante(f)), 'sin sección: ' + f.ruta);
      assert.ok(IDS_SECCION.includes(seccionDeRuta(f.ruta)), 'sin sección: ' + f.ruta);
      if (f.seccion != null) assert.ok(IDS_SECCION.includes(f.seccion), 'sección desconocida en el faltante: ' + f.seccion);
    }
  });
  test('cada faltante del dominio cae en la MISMA sección donde el formulario dibuja su campo', () => {
    const lista = MODELO.faltantes(vacio(), { config: { editores: [], marca: {} } });
    const distintas = lista.filter((f) => seccionDeFaltante(f) !== f.seccion).map((f) => f.ruta + ' (' + f.seccion + ' ≠ ' + seccionDeFaltante(f) + ')');
    assert.deepEqual(distintas, []);
  });
  test('las disposiciones del formulario son las de la plantilla (amarre)', () => {
    const d = PLANTILLA.DISPOSICIONES;
    assert.deepEqual(Object.keys(FORMA_DISPOSICION).sort(), Object.keys(d).sort());
    for (const [k, v] of Object.entries(FORMA_DISPOSICION)) {
      assert.equal(v.figuras, d[k].figuras, k);
      assert.equal(v.fotosPorFigura, d[k].fotosPorFigura, k);
    }
  });
  test('la numeración de figuras del informe vacío da 22, como el papel (plan §4.6)', () => {
    assert.equal(numeracionFiguras(vacio()).size, 22);
  });
});

describe('ruta → sección', () => {
  test('rutas profundas y rutas sin campo propio', () => {
    assert.equal(seccionDeRuta('equipo.fabricante'), 's3');
    assert.equal(seccionDeRuta('confirmaciones.potencia'), 's3');
    assert.equal(seccionDeRuta('salud.texto'), 's1');
    assert.equal(seccionDeRuta('config.marca.applus-portada'), 'portada');
    assert.equal(seccionDeRuta('portada.contrato'), 'portada');
    assert.equal(seccionDeRuta('tablas.material.2.cantidad'), 's3');
    assert.equal(seccionDeRuta('ventiladores.actual.0.modelo'), 's4_3');
    assert.equal(seccionDeRuta('ventiladores.nuevo.0.cfm_unitario'), 's4_3');
    assert.equal(seccionDeRuta('ventiladores.accion_id'), 's4_3');
    assert.equal(seccionDeRuta('figuras.montaje.1.figuras.0.fotos.0.archivo'), 's4_3');
    assert.equal(seccionDeRuta('figuras.pruebas_giro.0.figuras.0.pie'), 's4_4');
    assert.equal(seccionDeRuta('figuras.estado_final'), 's4_final');
    assert.equal(seccionDeRuta('textos.intro_p2'), 's1');
    assert.equal(seccionDeRuta('textos.personal'), 's2_2');
    assert.equal(seccionDeRuta('trabajo.fecha_fin'), 's2_2');
    assert.equal(seccionDeRuta('odt.0'), 's4_1');
    assert.equal(seccionDeRuta('corrientes.nominal.r'), 's4_4');
    assert.equal(seccionDeRuta('conclusiones.1.texto'), 's5');
    assert.equal(seccionDeRuta('anexos.1.ficha'), 'anexos');
    assert.equal(seccionDeRuta('portada.subtitulo_anexos'), 'anexos');
    assert.equal(seccionDeRuta('firmas.revisado.nombre'), 'firmas');
  });
  test('ruta desconocida: buscarSeccion da null y seccionDeRuta cae a la portada', () => {
    assert.equal(buscarSeccion('inventada.x'), null);
    assert.equal(seccionDeRuta('inventada.x'), 'portada');
    assert.equal(seccionDeFaltante({ ruta: 'inventada.x', seccion: 's5' }), 's5');
    assert.equal(seccionDeFaltante({ ruta: 'inventada.x', seccion: 'otra' }), 'portada');
  });
  test('conteo por sección separa los que bloquean de los avisos', () => {
    const m = contarFaltantesPorSeccion([
      { ruta: 'equipo.serie', bloquea: true }, { ruta: 'textos.intro_p1', bloquea: false },
      { ruta: 'odt', bloquea: true }, { ruta: 'odt', bloquea: true }
    ]);
    assert.deepEqual(m.get('s3'), { bloquea: 1, avisos: 0 });
    assert.deepEqual(m.get('s1'), { bloquea: 0, avisos: 1 });
    assert.deepEqual(m.get('s4_1'), { bloquea: 2, avisos: 0 });
  });
});

describe('lectura de rutas y de números', () => {
  test('valorEnRuta y existeRuta', () => {
    const o = { a: { b: [{ c: null }, { c: 3 }] } };
    assert.equal(valorEnRuta(o, 'a.b.1.c'), 3);
    assert.equal(valorEnRuta(o, 'a.x.y'), undefined);
    assert.equal(existeRuta(o, 'a.b.0.c'), true);
    assert.equal(existeRuta(o, 'a.b.0.d'), false);
    assert.equal(existeRuta(o, ''), false);
  });
  test('leerNumero: coma decimal, miles con punto, vacío = null, basura = NaN', () => {
    assert.equal(leerNumero('2,03'), 2.03);
    assert.equal(leerNumero('2.03'), 2.03);
    assert.equal(leerNumero('34.500'), 34500);
    assert.equal(leerNumero('1.234,5'), 1234.5);
    assert.equal(leerNumero(' 14 '), 14);
    assert.equal(leerNumero(''), null);
    assert.equal(leerNumero('   '), null);
    assert.equal(leerNumero(null), null);
    assert.ok(Number.isNaN(leerNumero('dos')));
    assert.ok(Number.isNaN(leerNumero('2,0,3')));
    assert.equal(leerNumero(0), 0, 'el cero escrito sí es cero');
  });
  test('numeroEnCasilla muestra coma decimal', () => {
    assert.equal(numeroEnCasilla(2.03), '2,03');
    assert.equal(numeroEnCasilla(14000), '14000');
    assert.equal(numeroEnCasilla(null), '');
  });
  test('totales de ventiladores: vacíos no suman y avisan', () => {
    assert.deepEqual(totalesVentiladores([{ cantidad: 4, cfm_unitario: 7000 }, { cantidad: 1, cfm_unitario: 5000 }]), { cantidad: 5, cfm: 33000, completas: true });
    assert.deepEqual(totalesVentiladores([{ cantidad: 4, cfm_unitario: null }]), { cantidad: 4, cfm: 0, completas: false });
    assert.deepEqual(totalesVentiladores([]), { cantidad: 0, cfm: 0, completas: true });
  });
});

describe('cuadrículas de figuras', () => {
  test('numeración: una figura cuenta una vez, en el orden del papel', () => {
    const c = { figuras: {
      montaje: [{ id: 'g3', disposicion: '2x1', figuras: [{ id: 'f3' }, { id: 'f4' }] }],
      alcance: [{ id: 'g1', disposicion: '2x1', figuras: [{ id: 'f1' }, { id: 'f2' }] }],
      pruebas_giro: [{ id: 'g4', disposicion: '2x2f', figuras: [{ id: 'f5', fotos: [{}, {}, {}, {}] }] }]
    } };
    const n = numeracionFiguras(c);
    assert.deepEqual([...n.entries()], [['f1', 1], ['f2', 2], ['f3', 3], ['f4', 4], ['f5', 5]]);
  });
  test('ids nuevos no chocan con los existentes', () => {
    assert.equal(siguienteId('g', ['g01', 'g14', 'gx']), 'g15');
    assert.equal(siguienteId('fg', []), 'fg01');
    const usados = idsUsados({ figuras: { alcance: [{ id: 'g02', figuras: [{ id: 'fg07' }] }] } });
    assert.deepEqual([...usados].sort(), ['fg07', 'g02']);
  });
  test('cada disposición de la plantilla, al reestructurar, queda con su forma', () => {
    const base = { id: 'g01', disposicion: '1x1', figuras: [{ id: 'fg01', pie: 'x', fotos: [{ archivo: null, marcas: [] }] }] };
    for (const [k, forma] of Object.entries(FORMA_DISPOSICION)) {
      const { cuadricula } = reestructurarCuadricula(base, k, new Set());
      assert.equal(cuadricula.figuras.length, forma.figuras, k);
      for (const f of cuadricula.figuras) assert.equal(f.fotos.length, forma.fotosPorFigura, k);
      assert.equal(new Set(cuadricula.figuras.map((f) => f.id)).size, cuadricula.figuras.length, 'ids de figura únicos en ' + k);
    }
  });
  test('cambiar de disposición conserva fotos y pies en orden y devuelve las que no caben', () => {
    const g = { id: 'g01', disposicion: '2x2f', figuras: [{ id: 'fg01', pie: 'Prueba de giro', fotos: [
      { archivo: 'a1', marcas: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] }, { archivo: 'a2', marcas: [] }, { archivo: null, marcas: [] }, { archivo: 'a4', marcas: [] }
    ] }] };
    const r = reestructurarCuadricula({ ...g, figuras: [{ ...g.figuras[0], pie_plantilla: 'Prueba de {nuevo}' }] }, '2x1', new Set(['g01', 'fg01']));
    assert.equal(r.cuadricula.figuras[0].pie_plantilla, 'Prueba de {nuevo}', 'conserva el pie sugerido de la plantilla');
    assert.equal(r.cuadricula.disposicion, '2x1');
    assert.equal(r.cuadricula.figuras.length, 2);
    assert.equal(r.cuadricula.figuras[0].id, 'fg01', 'la primera figura conserva su id');
    assert.equal(r.cuadricula.figuras[0].pie, 'Prueba de giro');
    assert.equal(r.cuadricula.figuras[0].fotos[0].archivo, 'a1');
    assert.deepEqual(r.cuadricula.figuras[0].fotos[0].marcas, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]);
    assert.equal(r.cuadricula.figuras[1].fotos[0].archivo, 'a2');
    assert.deepEqual(r.sobrantes.map((f) => f.archivo), ['a4']);
    assert.notEqual(r.cuadricula.figuras[1].id, 'fg01');
    assert.equal(g.disposicion, '2x2f', 'no muta la original');
  });
});

describe('emisión', () => {
  test('emitir solo sin faltantes que bloqueen', () => {
    assert.equal(puedeEmitir([{ bloquea: false }]), true);
    assert.equal(puedeEmitir([{ bloquea: true }]), false);
    assert.equal(puedeEmitir([]), true);
  });
});

describe('utilidades de texto', () => {
  test('escaparHtml no deja pasar marcado', () => {
    assert.equal(escaparHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    assert.equal(escaparHtml(null), '');
  });
  test('sinMarcas quita [b] y [m] de la plantilla', () => {
    assert.equal(sinMarcas('en [m]condición [b]2[/b][/m].'), 'en condición 2.');
  });
  test('haceCuanto', () => {
    const t = Date.parse('2026-10-14T12:00:00Z');
    assert.equal(haceCuanto('2026-10-14T11:59:50Z', t), 'hace 10 s');
    assert.equal(haceCuanto('2026-10-14T11:57:00Z', t), 'hace 3 min');
    assert.equal(haceCuanto('', t), '');
  });
});

test('cambiar la disposición de una cuadrícula suelta su ajuste fino (era para la disposición anterior)', async () => {
  const M = await import('../assets/js/domain/informe_brigada_modelo.js');
  const { reestructurarCuadricula } = await import('../assets/js/domain/informe_brigada_formulario.js');
  const g = M.informeVacio().figuras.alcance[0];
  assert.ok(g.ajuste);
  assert.equal(reestructurarCuadricula(g, '1x1', new Set()).cuadricula.ajuste, undefined);
  assert.deepEqual(reestructurarCuadricula(g, '2x1', new Set()).cuadricula.ajuste, g.ajuste);
});

test('al cargar un logo: aviso si su proporción no es la del recuadro o si el del encabezado no es transparente', async () => {
  const { avisosLogo } = await import('../assets/js/ui/informe-brigada/configuracion.js');
  const { MARCA_GEOMETRIA } = await import('../assets/js/domain/informe_brigada_plantilla.js');
  const g = MARCA_GEOMETRIA['afinia-portada'];
  assert.deepEqual(avisosLogo('afinia-portada', { ancho: Math.round(g.w * 10), alto: Math.round(g.h * 10), transparente: true }, MARCA_GEOMETRIA), []);
  const otra = avisosLogo('afinia-portada', { ancho: 288, alto: 163, transparente: true }, MARCA_GEOMETRIA);
  assert.equal(otra.length, 1);
  assert.match(otra[0], /se ensancha 9 %/);
  const opaco = avisosLogo('applus-encabezado', { ancho: 1183, alto: 495, transparente: false }, MARCA_GEOMETRIA);
  assert.ok(opaco.some((t) => /tapará la dirección «Bogotá D\.C\.»/.test(t)));
  assert.deepEqual(avisosLogo('applus-portada', { ancho: 1541, alto: 645, transparente: false }, MARCA_GEOMETRIA), [], 'solo el del encabezado tapa la dirección');
});
