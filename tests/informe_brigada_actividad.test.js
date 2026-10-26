// Informe de Mantenimiento Brigada · ACTIVIDAD escrita a mano (pedido del Ingeniero, 2026-10-26).
// La MISMA regla en tres sitios: la ventana «Nuevo informe» (ui/informe-brigada/selector.js),
// planCrear (que aplican los dos repositorios) y firestore.rules (`ibrActividad`). Aquí:
//   · normalizar y validar (de 3 a 200 caracteres, una línea, sin espacios sobrantes);
//   · el patrón y los topes amarrados con las reglas, y el veredicto del dominio = el de la
//     regla sobre el texto que se guarda (batería fija + textos al azar con semilla);
//   · la ventana, leída como texto (campo con sugerencias, aviso del modelo F60);
//   · L-102: archivo NUEVO sin importaciones; ningún archivo publicado gana exportaciones.
// La regla de verdad se prueba en el emulador: tests-rules/informes_brigada.rules.test.js.
// Datos INVENTADOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  ACTIVIDAD_MIN, ACTIVIDAD_MAX, PATRON_ACTIVIDAD, PATRON_CONTENIDO, normalizarActividad, errorActividad, avisoActividad
} from '../assets/js/domain/informe_brigada_actividad.js';
import { ACTIVIDADES, ACTIVIDAD_REFRIGERACION } from '../assets/js/domain/informe_brigada_plantilla.js';

const leer = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('normalizar: como se guarda', () => {
  test('sin espacios a los lados y un solo espacio entre palabras (también el duro, el fino y el tabulador; U+FEFF se quita)', () => {
    assert.equal(normalizarActividad('  Cambio de bujes  '), 'Cambio de bujes');
    assert.equal(normalizarActividad('Cambio   de\tbujes de baja﻿ tensión'), 'Cambio de bujes de baja tensión');
    assert.equal(normalizarActividad('\n Cambio de bujes \r\n'), 'Cambio de bujes', 'un salto a los lados es espacio sobrante');
    assert.equal(normalizarActividad('Primera línea\nSegunda línea'), 'Primera línea\nSegunda línea', 'un salto adentro NO se esconde: se rechaza');
  });
  test('marcas invisibles de copiar y pegar: se QUITAN (no se ven), a los lados y adentro (revisión 2026-10-26)', () => {
    // Espacio de ancho cero, marcas de dirección y aislamientos (Teams/Outlook), guion blando (Word), U+FEFF, separador mongol.
    assert.equal(normalizarActividad('Cambio de bujes\u200B'), 'Cambio de bujes');
    assert.equal(normalizarActividad('\u200ECambio de bujes\u200F'), 'Cambio de bujes');
    assert.equal(normalizarActividad('\u2068Juan\u2069 revisó'), 'Juan revisó');
    assert.equal(normalizarActividad('Trans\u00ADformador'), 'Transformador', 'el guion blando no parte la palabra');
    assert.equal(normalizarActividad('Cambio\u180Ede bujes'), 'Cambiode bujes', 'U+180E: no se ve; el motor de las reglas lo tomaba por espacio');
    assert.equal(normalizarActividad('\uFEFFCambio\u2060 de\u202A bujes'), 'Cambio de bujes');
    for (const v of ['\u200B\u200B\u200B', '\u00AD\u00AD\u00AD', '\u3164\u3164\u3164', '\u115F\u1160\uFFA0', ' \u200B \u2060 ']) assert.equal(normalizarActividad(v), '', JSON.stringify(v));
    // Se quitan ANTES de la NFC: la tilde no queda suelta.
    assert.equal(normalizarActividad('Revisio\u200B\u0301n'), 'Revisión');
    // La unión U+200D se queda (los emojis compuestos la usan).
    assert.equal(normalizarActividad('Cambio \u{1F468}\u200D\u{1F527}'), 'Cambio \u{1F468}\u200D\u{1F527}');
  });
  test('forma normal de Unicode (NFC): «é» escrita de dos maneras se guarda igual', () => {
    assert.equal(normalizarActividad('Revisión'), 'Revisión');
    assert.equal(normalizarActividad('Revisión').length, 'Revisión'.length);
  });
  test('lo que no es texto queda vacío; normalizar dos veces no cambia nada', () => {
    for (const v of [undefined, null, 42, {}, ['abc'], true]) assert.equal(normalizarActividad(v), '', String(v));
    for (const v of ['  a  b  ', 'x\t\ty', ACTIVIDAD_REFRIGERACION, 'Revisio\u200B\u0301n', ' \u2068a\u2069  b ']) assert.equal(normalizarActividad(normalizarActividad(v)), normalizarActividad(v));
  });
});

describe('validar: de 3 a 200 caracteres, en una sola línea', () => {
  test('las 8 actividades de la lista sirven tal cual (ya vienen normalizadas)', () => {
    assert.equal(ACTIVIDADES.length, 8);
    for (const a of ACTIVIDADES) {
      assert.equal(errorActividad(a), null, a);
      assert.equal(normalizarActividad(a), a, a);
    }
  });
  test('topes: 3 y 200 sí; 2 y 201 no (contados después de normalizar)', () => {
    assert.equal(errorActividad('abc'), null);
    assert.match(errorActividad('ab'), /muy corta: escriba al menos 3/);
    assert.match(errorActividad('  ab  '), /muy corta/);
    assert.equal(errorActividad('x'.repeat(200)), null);
    assert.equal(errorActividad(' ' + 'x'.repeat(200) + ' '), null, 'los espacios de los lados no cuentan');
    assert.equal(errorActividad('x'.repeat(201)), 'La actividad es muy larga: máximo 200 caracteres (tiene 201).');
    assert.equal(errorActividad('a' + ' '.repeat(300) + 'b c'), null, 'los espacios repetidos se reducen antes de contar');
  });
  test('se cuenta como las reglas (`size()` = `.length`): una letra con tilde es 1; un emoji, 2', () => {
    assert.equal(errorActividad('ñé'), errorActividad('ab'));
    assert.equal(errorActividad('\u{1F600}a'), null, '2 + 1 = 3');
    assert.equal(errorActividad('ab' + '\u{1F600}'.repeat(99)), null, '2 + 198 = 200');
    assert.match(errorActividad('ab' + '\u{1F600}'.repeat(99) + 'c'), /tiene 201/);
  });
  test('al menos una letra (latina, con o sin tilde) o un número: lo que se ve en blanco, o solo puntos o emojis, no', () => {
    for (const v of ['123', 'Ñandú', 'Revisión 1', 'a!!', 'ü..', '\u{1F600}a', ACTIVIDAD_REFRIGERACION]) assert.equal(errorActividad(v), null, v);
    for (const v of ['...', '---', '\u2800\u2800\u2800', '\u200D\u200D\u200D', '\u{1F600}'.repeat(100), '\uA7C0\uA7C0\uA7C0', '\u4E2D\u6587\u5B57']) {
      assert.equal(errorActividad(v), 'La actividad necesita al menos una letra o un número.', JSON.stringify(v));
    }
  });
  test('vacía, solo espacios o solo marcas invisibles: pide escribirla', () => {
    for (const v of ['', '   ', '\t ', '\u200B\u200B\u200B', '\u00AD\u00AD\u00AD', '\u3164\u3164\u3164', undefined, null, 7]) assert.equal(errorActividad(v), 'Escriba la actividad del informe (de 3 a 200 caracteres).', String(v));
  });
  test('saltos de línea y caracteres de control adentro: no', () => {
    for (const v of ['Primera línea\nSegunda línea', 'Uno\r\nDos', 'Uno Dos', 'Uno Dos', 'Con\u0007campana', 'Con\u0085NEL', 'Con\u000bvertical', 'Con\u0000nulo']) {
      assert.equal(errorActividad(v), 'La actividad va en una sola línea, sin saltos de línea ni caracteres de control.', JSON.stringify(v));
    }
  });
});

describe('amarre con firestore.rules (`ibrActividad`): la misma regla', () => {
  const REGLAS = leer('firestore.rules');
  const fn = /function ibrActividad\(a\) \{([\s\S]*?)\n {4}\}/.exec(REGLAS);
  const cuerpo = fn ? fn[1] : '';
  // En el archivo de reglas la barra invertida va doble ('\\p'): el patrón que lee RE2 la lleva sencilla.
  const patrones = [...cuerpo.matchAll(/a\.matches\('([^']+)'\)/g)].map((x) => x[1].replace(/\\\\/g, '\\'));
  const [patronReglas = '', contenidoReglas = ''] = patrones;
  // `matches()` de las reglas compara el texto ENTERO (RE2 FullMatch): en JavaScript, con ^…$.
  const aJs = (p) => new RegExp('^(?:' + p.replace(/\\x\{/g, '\\u{') + ')$', 'u');
  const RE_REGLAS = aJs(patronReglas);
  const RE_CONTENIDO_REGLAS = aJs(contenidoReglas);
  /** Lo que hace la regla, en JavaScript: `size()` cuenta como `.length` (comprobado en el emulador). */
  const reglaAcepta = (s) => typeof s === 'string' && s.length >= ACTIVIDAD_MIN && s.length <= ACTIVIDAD_MAX
    && RE_REGLAS.test(s) && RE_CONTENIDO_REGLAS.test(s);

  test('la función existe, con los mismos topes y el mismo patrón, y la creación la exige', () => {
    assert.ok(fn, 'no encontré function ibrActividad(a) en firestore.rules');
    assert.match(cuerpo, new RegExp('a is string && a\\.size\\(\\) >= ' + ACTIVIDAD_MIN + ' && a\\.size\\(\\) <= ' + ACTIVIDAD_MAX));
    assert.equal(patrones.length, 2, 'dos patrones: la forma y el contenido');
    assert.equal(patronReglas, PATRON_ACTIVIDAD);
    assert.equal(contenidoReglas, PATRON_CONTENIDO);
    assert.ok(REGLAS.includes("a.matches('" + PATRON_ACTIVIDAD.replace(/\\/g, '\\\\') + "')"));
    assert.ok(REGLAS.includes("&& a.matches('" + PATRON_CONTENIDO.replace(/\\/g, '\\\\') + "');"));
    // El contenido va con rangos por CÓDIGO (no \p{L}): el motor de las reglas no conoce las letras nuevas de Unicode.
    assert.doesNotMatch(PATRON_CONTENIDO, /\\p\{/);
    // Cada marca invisible que se quita al normalizar está prohibida en la regla (si no, la regla aceptaría texto sin normalizar).
    for (const c of ['\u00AD', '\u115F', '\u1160', '\u180E', '\u200B', '\u200E', '\u200F', '\u202A', '\u202E', '\u2060', '\u2064', '\u2066', '\u2069', '\u3164', '\uFEFF', '\uFFA0']) {
      assert.equal(reglaAcepta('ab' + c + 'c'), false, 'U+' + c.codePointAt(0).toString(16));
      assert.equal(normalizarActividad('ab' + c + 'c'), 'abc');
    }
    const crear = /match \/informes_brigada\/\{id\} \{[\s\S]*?allow create: if ([\s\S]*?);/.exec(REGLAS);
    assert.ok(crear && crear[1].includes('&& ibrActividad(request.resource.data.actividad)'));
    assert.ok(!/actividad == '/.test(crear[1]), 'ya no exige el texto fijo de refrigeración');
    assert.ok(crear[1].includes("request.resource.data.modelo == 'F60-REFRIG@1'"), 'el modelo sigue siendo el único que existe');
  });
  test('la actividad sigue sin cambiar después de crear (ibrFijos intacto)', () => {
    assert.match(REGLAS, /function ibrFijos\(d, r\) \{\n\s+return d\.esquema == r\.esquema && d\.modelo == r\.modelo && d\.actividad == r\.actividad/);
  });

  const BATERIA = [
    ...ACTIVIDADES, '', ' ', 'ab', 'abc', ' abc', 'abc ', 'a  b c', 'a\tbc', 'a bc', 'a﻿bc', 'abc\n', 'a\nbc', 'a bc',
    'a\u0007bc', 'a\u0085bc', 'x'.repeat(200), 'x'.repeat(201), ' ' + 'x'.repeat(200), 'x'.repeat(199) + '  y', '\u{1F600}'.repeat(100),
    '\u{1F600}'.repeat(100) + 'a', 'ab' + '\u{1F600}'.repeat(99), 'p{Cc}', 'x\\y', 'a​bc', 'Revisión general', 'Cambio de bujes de baja tensión',
    // Revisión 2026-10-26: marcas invisibles y actividades que se ven en blanco.
    'Cambio\u180Ede bujes', '\u200B\u200B\u200B', '\u00AD\u00AD\u00AD', '\u2800\u2800\u2800', '\u3164\u3164\u3164', 'Cambio de bujes\u200B',
    'Cambio de bujes\u200E', '\u2068Juan\u2069 revisión', '\u200D\u200D\u200D', '...', '123', '\uA7C0\uA7C0\uA7C0', '\uA7C0\uA7C0a', 'Ñandú'
  ];
  test('batería fija: el dominio dice «sirve» exactamente cuando la regla acepta el texto que se guarda', () => {
    for (const x of BATERIA) {
      assert.equal(errorActividad(x) === null, reglaAcepta(normalizarActividad(x)), JSON.stringify(x));
    }
  });
  test('textos al azar (semilla fija): mismo veredicto; y la regla solo acepta texto ya normalizado', () => {
    let s = 20261026 >>> 0;
    const azar = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const PIEZAS = ['a', 'Z', 'é', 'ñ', '1', '.', '-', ' ', '  ', '\t', ' ', ' ', '﻿', '\n', '\r', ' ', '\u0007', '\u0085', '\u{1F600}', '​', 'xxxxxxxxxx',
      '\u180E', '\u00AD', '\u200E', '\u2068', '\u2069', '\u3164', '\u2800', '\u200D', '\u0301', '\uA7C0', '...'];
    let aceptadas = 0;
    for (let i = 0; i < 4000; i++) {
      let x = azar() < 0.15 ? 'x'.repeat(190 + Math.floor(azar() * 15)) : '';
      const n = Math.floor(azar() * 14);
      for (let k = 0; k < n; k++) x += PIEZAS[Math.floor(azar() * PIEZAS.length)];
      if (azar() < 0.5) x = PIEZAS[Math.floor(azar() * PIEZAS.length)] + x;
      const ok = errorActividad(x) === null;
      assert.equal(ok, reglaAcepta(normalizarActividad(x)), JSON.stringify(x));
      // La regla no sabe de la NFC (una tilde suelta «Z\u0301» pasa): eso no es un espacio sobrante y la plataforma siempre guarda en NFC.
      if (reglaAcepta(x)) { aceptadas++; assert.equal(normalizarActividad(x), x.normalize('NFC'), 'la regla dejó pasar espacios sobrantes o marcas invisibles: ' + JSON.stringify(x)); }
    }
    assert.ok(aceptadas > 50, 'la batería al azar tiene que incluir textos que la regla acepta (' + aceptadas + ')');
  });
});

describe('lo que dice la ventana debajo del campo (avisoActividad)', () => {
  test('vacía MIENTRAS se escribe: aviso neutro (la ayuda pide borrar para ver la lista), «Crear» apagado; al salir o al crear, en rojo', () => {
    assert.deepEqual(avisoActividad(''), { sirve: false, error: false, texto: 'Escriba la actividad o escoja una de la lista.' });
    assert.deepEqual(avisoActividad('   '), { sirve: false, error: false, texto: 'Escriba la actividad o escoja una de la lista.' });
    assert.deepEqual(avisoActividad('', { estricto: true }), { sirve: false, error: true, texto: 'Escriba la actividad del informe (de 3 a 200 caracteres).' });
  });
  test('lo de verdad inválido va en rojo aunque se esté escribiendo', () => {
    assert.deepEqual(avisoActividad('ab'), { sirve: false, error: true, texto: 'La actividad es muy corta: escriba al menos 3 caracteres.' });
    assert.equal(avisoActividad('Uno\nDos').error, true);
    assert.equal(avisoActividad('...').error, true);
  });
  test('la que sirve dice si es de la lista de motivos o escrita a mano', () => {
    assert.deepEqual(avisoActividad(ACTIVIDAD_REFRIGERACION, { lista: ACTIVIDADES }), { sirve: true, error: false, texto: 'Actividad de la lista de motivos.' });
    assert.deepEqual(avisoActividad('  ' + ACTIVIDADES[3] + '\u200B', { lista: ACTIVIDADES }), { sirve: true, error: false, texto: 'Actividad de la lista de motivos.' });
    assert.deepEqual(avisoActividad('Cambio de bujes', { lista: ACTIVIDADES }), { sirve: true, error: false, texto: 'Actividad escrita a mano.' });
    assert.equal(avisoActividad('Cambio de bujes').texto, 'Actividad escrita a mano.', 'sin lista no se cae');
  });
});

describe('ventana «Nuevo informe» (selector.js, leído como texto)', () => {
  const SRC = leer('assets/js/ui/informe-brigada/selector.js');
  test('compila (las pruebas de dominio no cargan la pantalla)', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: SRC, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
  test('la actividad es un campo de TEXTO con sugerencias (las 8 de la lista), que viene escrito con la de refrigeración', () => {
    assert.match(SRC, /'<input type="text" class="ibr-input" id="' \+ idSugerencias \+ 'Campo" data-s="actividad" list="' \+ idSugerencias \+ '"'/);
    assert.match(SRC, /value="' \+ esc\(P\.ACTIVIDAD_REFRIGERACION \|\| ''\) \+ '">'/);
    assert.match(SRC, /'<datalist id="' \+ idSugerencias \+ '">' \+ sugerencias \+ '<\/datalist>'/);
    assert.match(SRC, /const sugerencias = actividades\.map\(\(a\) => '<option value="' \+ esc\(a\) \+ '"><\/option>'\)\.join\(''\);/);
    assert.match(SRC, /const actividades = Array\.isArray\(P\.ACTIVIDADES\) \? P\.ACTIVIDADES : \[\];/);
    assert.doesNotMatch(SRC, /<select class="ibr-select" data-s="actividad">/, 'ya no es una lista desplegable cerrada');
    assert.doesNotMatch(SRC, /sin modelo todavía|todavía no tienen? modelo/);
  });
  test('dice en llano con qué modelo se arma; el lector de pantalla oye el aviso, la ayuda y el modelo al entrar al campo', () => {
    assert.ok(SRC.includes('El informe se arma con el modelo F60 de refrigeración; sus textos se ajustan en el editor.'));
    assert.ok(SRC.includes('Escoja una de la lista (borre el texto para verlas todas) o escriba la suya, en una sola línea.'));
    assert.match(SRC, /aria-describedby="' \+ idSugerencias \+ 'Aviso ' \+ idSugerencias \+ 'Ayuda ' \+ idSugerencias \+ 'Modelo"'/);
    assert.match(SRC, /'<p class="ibr-ayuda" id="' \+ idSugerencias \+ 'Ayuda">Escoja una de la lista/);
    assert.match(SRC, /'<p class="ibr-ayuda" id="' \+ idSugerencias \+ 'Modelo">El informe se arma/);
    // Reescribir el mismo texto en cada tecla hacía que el lector de pantalla lo repitiera.
    assert.match(SRC, /if \(avisoAct\.textContent !== a\.texto\) avisoAct\.textContent = a\.texto;/);
  });
  test('lo que viene escrito queda SELECCIONADO al abrir: lo que se escribe lo reemplaza (no se pega delante)', () => {
    assert.match(SRC, /if \(document\.activeElement === campoAct\) \{ try \{ campoAct\.select\(\); \}/);
  });
  test('en pantalla táctil el foco inicial no va al campo de texto (no saca el teclado)', () => {
    assert.match(SRC, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);
    assert.match(SRC, /v\.atrapar\(ctx\.puedeEditar && !tactil \? '\[data-s="actividad"\]' : '\[data-s="cancelar"\]'\);/);
  });
  test('Esc con una ventana encima de otra cierra SOLO la de arriba (la confirmación no se lleva lo escrito)', () => {
    assert.match(SRC, /trampa = atraparFoco\(ventana, \{ alCerrar: alEsc, autoFoco, escape \}\)/);
    assert.match(SRC, /if \(\(ev && ev\.__ibrEscAtendido\) \|\| ventanaDeArriba\(\) !== velo\) return;/);
    assert.match(SRC, /abiertas\.push\(velo\);/);
    assert.match(SRC, /const i = abiertas\.indexOf\(velo\);\n\s+if \(i >= 0\) abiertas\.splice\(i, 1\);/);
  });
  test('valida con el dominio mientras se escribe y crea con la actividad NORMALIZADA y el modelo que sale del dominio', () => {
    assert.match(SRC, /const a = avisoActividad\(campoAct\.value, \{ lista: actividades, estricto \}\);/);
    assert.match(SRC, /campoAct\.addEventListener\('input', \(\) => revisarActividad\(false\)\);/, 'mientras se escribe, vacío no es rojo');
    assert.match(SRC, /revisarActividad\(true\);\n\s+\}\);/, 'al salir del campo, vacío sí es rojo');
    assert.match(SRC, /if \(!creando\) \$\('crear'\)\.disabled = !a\.sirve;/, '«Crear informe» apagado mientras la actividad no sirva');
    assert.match(SRC, /const err = revisarActividad\(true\);/);
    assert.match(SRC, /if \(err\) \{ ctx\.avisar\(err, 'aviso'\); campoAct\.focus\(\); return; \}/);
    assert.match(SRC, /const actividad = normalizarActividad\(campoAct\.value\);/);
    assert.match(SRC, /ctx\.dep\.modelo\.prellenar\(\{ equipo, config: ctx\.config, accion, actividad \}\)/);
    assert.match(SRC, /const modelo = \(contenido && contenido\.modelo\) \|\| P\.modeloDeActividad\(P\.ACTIVIDAD_REFRIGERACION\);/);
    assert.match(SRC, /actividad, modelo, contenido\n/);
    assert.doesNotMatch(SRC, /P\.modeloDeActividad\(actividad\)/, 'el modelo ya no se busca con el texto escrito');
  });
});

describe('los dos repositorios crean con planCrear (la misma regla)', () => {
  for (const f of ['assets/js/data/informes_brigada.js', 'assets/js/data/informes_brigada_local.js']) {
    test(f, () => {
      const src = leer(f);
      const cuerpo = /async crear\(\{ equipo_ref, actividad, modelo, contenido \} = \{\}\) \{([\s\S]*?)\n {4}\},/.exec(src);
      assert.ok(cuerpo, 'no encontré crear');
      assert.match(cuerpo[1], /const datos = planCrear\(\{ equipo_ref, actividad, modelo, contenido \}\);/);
      assert.equal((cuerpo[1].match(/actividad/g) || []).length, 1, 'la actividad solo pasa por planCrear: se guarda la normalizada de `datos`');
    });
  }
});

describe('L-102: archivo NUEVO; ningún archivo publicado gana exportaciones', () => {
  test('informe_brigada_actividad.js no importa nada y compila', () => {
    const src = leer('assets/js/domain/informe_brigada_actividad.js');
    assert.deepEqual([...src.matchAll(/^import .*$/gm)], []);
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
  test('los publicados que lo usan importan SOLO lo que exporta (líneas exactas)', () => {
    const lineas = (f) => [...leer(f).matchAll(/^import .*informe_brigada_actividad.*$/gm)].map((m) => m[0]);
    assert.deepEqual(lineas('assets/js/domain/informe_brigada_rutas.js'), ["import { normalizarActividad, errorActividad } from './informe_brigada_actividad.js';"]);
    assert.deepEqual(lineas('assets/js/domain/informe_brigada_modelo.js'), ["import { normalizarActividad, errorActividad } from './informe_brigada_actividad.js';"]);
    assert.deepEqual(lineas('assets/js/ui/informe-brigada/selector.js'), ["import { normalizarActividad, avisoActividad } from '../../domain/informe_brigada_actividad.js';"]);
  });
  test('los publicados tocados no importan nada nuevo de sus vecinos publicados', () => {
    const modulos = (f) => [...leer(f).matchAll(/^import[\s\S]*?from\s+'([^']+)';/gm)].map((m) => m[1]).sort();
    assert.deepEqual(modulos('assets/js/domain/informe_brigada_modelo.js'),
      ['./fichas_adjunto.js', './informe_brigada_actividad.js', './informe_brigada_formato.js', './informe_brigada_plantilla.js']);
    assert.deepEqual(modulos('assets/js/ui/informe-brigada/selector.js'), ['../../domain/informe_brigada_actividad.js', '../foco-modal.js']);
    // De la plantilla, modelo.js toma lo mismo que ya tomaba en origin/main (2026-10-26).
    const dePlantilla = /import \{([^}]+)\} from '\.\/informe_brigada_plantilla\.js';/.exec(leer('assets/js/domain/informe_brigada_modelo.js'));
    assert.deepEqual(dePlantilla[1].split(',').map((x) => x.trim()).filter(Boolean).sort(), [
      'ACTIVIDADES_POR_CLASE', 'ACTIVIDAD_REFRIGERACION', 'AJUSTES_CUADRICULA', 'ANEXOS_DEFECTO', 'CONCLUSIONES', 'DISPOSICIONES',
      'FIGURAS_DEFECTO', 'FORMATO', 'FRASES', 'HALLAZGO_DEFECTO', 'HERRAMIENTAS_DEFECTO', 'IDS_TEXTOS', 'MARCA_CLAVES', 'MARCA_GEOMETRIA',
      'MATERIAL_DEFECTO', 'MODELOS', 'NOMBRE_CONDICION', 'PERSONAS_DEFECTO', 'RECOMENDACIONES', 'ROLES_FIRMA', 'SECCIONES_FIGURAS',
      'SST_DEFECTO', 'TEXTOS', 'modeloDeActividad', 'rellenar'
    ]);
  });
  test('rutas.js, modelo.js y selector.js exportan lo mismo que en origin/main (una exportación nueva va en un archivo nuevo)', () => {
    const exporta = (f) => [...leer(f).matchAll(/^export (?:async )?(?:function\*?|const|let|class) (\w+)/gm)].map((m) => m[1]).sort();
    const sinLlaves = (f) => !/^export \{/m.test(leer(f));
    const PUBLICADO = {
      'assets/js/domain/informe_brigada_rutas.js': 'ACTIVIDAD_REFRIGERACION ALMACENES ALMACEN_POR_DEFECTO CLAVES_MARCA CLAVE_LOCAL CLAVE_RESPALDO COL ESQUEMA ErrorIBR LIMITES MENSAJES MIMES MODELOS_ADMITIDOS MODELO_REFRIGERACION ROLES_FIRMA TOPES aIso claveFirmante configDePrueba configParaGuardar documentoAFicha documentoAInforme documentoAVersion errorDesdeFirebase errorMotivo esClaveFirmante esEditorDe esHuella esIdArchivo esIdBin esIdFicha esIdInforme esRutaFirma esSinPermiso firmasParaEmitir hayListaEnLista idAleatorio idBin idFicha imagenConMetadatos jpegConMetadatos metaBinaria mimePorBytes normalizarConfig normalizarEquipoRef nuevoIdArchivo nuevoIdLocal ordenarPorActualizado planAnular planCorregir planCrear planEmitir planGuardar pngConMetadatos prepararContenido resumenAccion rutaAdmitidaPara rutaArchivo rutaBin rutaFicha rutaFirma rutaLogo rutaParteFicha slug tamanoJson topeConsulta topeDe validarBinario',
      'assets/js/domain/informe_brigada_modelo.js': 'ESQUEMA SECCION_FIGURAS agregarAnexoFicha agregarCuadricula ajusteLimpio aplicarAccion asignarFirmante cambiarCampo condicionEntera confirmarPotencia equipoDesdeInventario esEditor estadoCampo faltantes faltantesQueBloquean fusionarRespaldo huellaContenido informeVacio jsonCanonico moverCuadricula nuevoId ponerFoto prellenar quitarCuadricula regenerarFilasAuto registrarArchivo textoPlantilla variablesDelInforme',
      'assets/js/ui/informe-brigada/selector.js': 'abrirSelector confirmar crearVentana pedirTexto'
    };
    for (const [f, lista] of Object.entries(PUBLICADO)) {
      assert.deepEqual(exporta(f), lista.split(' ').sort(), f);
      assert.ok(sinLlaves(f), f + ': sin «export { … }»');
    }
  });
});
