// Informe de Mantenimiento Brigada (F60-ADM) — el Documento (bloques del papel) que leen igual
// el PDF y el Word: orden, numeración, saltos de hoja, firmas solo al emitir y texto sin HTML.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../assets/js/domain/informe_brigada_modelo.js';
import { construirDocumento, refsDelDocumento, metaDeRef, runsPieFigura, titulosAnexos } from '../assets/js/domain/informe_brigada_documento.js';
import { escaparHTML, htmlDeRuns, urlSegura, geometriaFotos } from '../assets/js/ui/informe-brigada/papel.js';
import { txPrueba, accionPrueba, configPrueba, contenidoCompletoEjemplo, versionEmitidaEjemplo, PERSONAS } from './informe_brigada_fixture.js';

const textoDe = (runs) => runs.map((r) => r.t).join('');
const bloque = (d, id) => d.bloques.find((b) => b.id === id);
/** Todos los textos que el Documento manda a dibujar. */
function textosDelDocumento(d) {
  const out = [d.meta.titulo, ...d.portada.titulo, ...d.portada.anexos, d.portada.cliente, d.portada.anexosSubtitulo];
  d.portada.datos.forEach((r) => out.push(textoDe(r)));
  d.portada.firmas.forEach((f) => out.push(f.nombre, f.rotulo, f.casilla));
  d.bloques.forEach((b) => {
    if (b.runs) out.push(textoDe(b.runs));
    if (b.texto) out.push(b.texto);
    if (b.filas) b.filas.forEach((f) => f.celdas.forEach((c) => out.push(textoDe(c.runs))));
    if (b.figuras) b.figuras.forEach((f) => out.push(f.pie, textoDe(f.runs)));
  });
  return out;
}

describe('orden del papel', () => {
  const d = construirDocumento(contenidoCompletoEjemplo());
  test('bloques en el orden del F60 (forma corregida)', () => {
    const seq = d.bloques.map((b) => b.tipo + ':' + (b.id || b.texto));
    assert.deepEqual(seq, [
      'titulo:s1', 'parrafo:intro_p1', 'parrafo:intro_p2', 'parrafo:intro_p3',
      'titulo:s2', 'titulo:s2_1', 'titulo:s2_1_1', 'parrafo:obj_general', 'titulo:s2_1_2', 'parrafo:obj_esp_1', 'parrafo:obj_esp_2', 'parrafo:obj_esp_3',
      'titulo:s2_2', 'parrafo:personal', 'titulo:s2_3', 'parrafo:alcance', 'cuadricula:g01',
      'titulo:s3', 'tabla:t1', 'pieTabla:Tabla 1 Características del activo', 'tabla:t2', 'pieTabla:Tabla 2 Material Utilizado',
      'tabla:t3', 'pieTabla:Tabla 3 Herramientas y logística utilizada', 'tabla:t4', 'pieTabla:Tabla 4 Elementos SST',
      'titulo:s4', 'titulo:s4_1', 'parrafo:ingreso', 'cuadricula:g02', 'titulo:s4_2', 'parrafo:cond_iniciales', 'cuadricula:g03', 'cuadricula:g04',
      'titulo:s4_3', 'parrafo:montaje', 'cuadricula:g05', 'cuadricula:g06', 'cuadricula:g07', 'cuadricula:g08', 'cuadricula:g09',
      'titulo:s4_4', 'parrafo:pruebas_1', 'cuadricula:g10', 'cuadricula:g11', 'etiqueta:Tabla 5.', 'tabla:t5', 'parrafo:pruebas_2',
      'cuadricula:g12', 'cuadricula:g13',
      'titulo:s5', 'vineta:c1', 'vineta:c2', 'vineta:c3', 'titulo:s5_1', 'vineta:r1', 'vineta:r2', 'vineta:r3', 'vineta:r4', 'vineta:r5', 'vineta:r6', 'vineta:r7',
      'anexoTitulo:anexos', 'anexoTitulo:anexo_consignacion', 'anexoImagen:undefined', 'anexoTitulo:anexo_ficha_actual', 'anexoImagen:undefined',
      'anexoTitulo:anexo_ficha_nuevo', 'anexoImagen:undefined', 'anexoTitulo:anexo_calculo', 'tabla:calc_actual', 'tabla:calc_proyectado'
    ]);
  });
  test('hoja nueva antes de 3., 4., ANEXOS y de cada anexo siguiente (nunca antes del primero)', () => {
    const saltos = d.bloques.filter((b) => b.saltoAntes).map((b) => b.id);
    assert.deepEqual(saltos, ['s3', 's4', 'anexos', 'anexo_ficha_actual', 'anexo_ficha_nuevo', 'anexo_calculo']);
  });
  test('todo título va pegado a lo que sigue', () => {
    d.bloques.filter((b) => b.tipo === 'titulo' || b.tipo === 'anexoTitulo' || b.tipo === 'etiqueta').forEach((b) => assert.equal(b.conSiguiente, true, b.id || b.texto));
  });
  test('estructura de las hojas: portada + 1 · 2 · 3 · 4 · 5 + ANEXOS (4)', () => {
    assert.equal(d.portada.indice.length, 8);
    assert.deepEqual(d.portada.anexos, ['CONSIGNACIÓN', 'FICHA TÉCNICA VENTILADOR VA-50', 'FICHA TÉCNICA VENTILADOR MARCA-PRUEBA VX-100', 'CÁLCULO DE VENTILADORES']);
    assert.deepEqual(d.bloques.filter((b) => b.tipo === 'anexoTitulo').map((b) => b.texto),
      ['ANEXOS', 'CONSIGNACIÓN', 'FICHA TÉCNICA VENTILADOR VA-50', 'FICHA TÉCNICA VENTILADOR VX-100', 'CÁLCULO DE VENTILADORES']);
    assert.deepEqual(d.portada.titulo, ['INFORME DE MANTENIMIENTO CORRECTIVO.', 'ACTUALIZACIÓN DE SISTEMA DE REFRIGERACIÓN', 'T9-Z/Z-PRU.']);
    assert.equal(d.meta.titulo, 'INFORME T9-Z_Z-PRU');
    assert.equal(d.formato.codigo, 'F60-ADM V. 11 – 16/09/2024');
  });
});

describe('figuras y tablas', () => {
  const d = construirDocumento(contenidoCompletoEjemplo());
  test('22 figuras numeradas 1..22; una cuadrícula de una sola figura cuenta una', () => {
    const nums = d.bloques.filter((b) => b.tipo === 'cuadricula').flatMap((b) => b.figuras.map((f) => f.numero));
    assert.deepEqual(nums, Array.from({ length: 22 }, (_, i) => i + 1));
    const g12 = bloque(d, 'g12');
    assert.equal(g12.disposicion, '2x2f');
    assert.equal(g12.figuras.length, 1);
    assert.equal(g12.figuras[0].fotos.length, 4);
  });
  test('pie uniforme «Figura N. texto» con «Figura N» en negrita', () => {
    assert.deepEqual(runsPieFigura(7, 'Conexión de guardamotor.'), [{ t: 'Figura 7', b: true }, { t: '. Conexión de guardamotor.' }]);
    assert.deepEqual(runsPieFigura(3, '  '), [{ t: 'Figura 3', b: true }]);
    assert.deepEqual(bloque(d, 'g01').figuras[0].runs, [{ t: 'Figura 1', b: true }, { t: '. Panorámica del equipo' }]);
  });
  test('Tabla 1 con sus 9 rótulos comprimidos y los valores del equipo', () => {
    const t1 = bloque(d, 't1');
    assert.equal(t1.filas.length, 9);
    assert.deepEqual(t1.filas.map((f) => textoDe(f.celdas[0].runs)), ['MATRICULA', 'FABRICANTE', 'POTENCIA MVA', 'AÑO DE FABRICACIÓN', 'SERIAL',
      'TENSIÓN PRIMARIA', 'TENSIÓN SECUNDARIA', 'GRUPO DE CONEXIÓN', 'FRECUENCIA']);
    assert.deepEqual(t1.filas.map((f) => textoDe(f.celdas[1].runs)), ['T9-Z/Z-PRU', 'FABRICANTE PRUEBA', '10 / 14 MVA', '2019', 'SERIE-PRUEBA-001',
      '34500 V', '13800 V', 'Dyn1', '60 Hz']);
    const pot = t1.filas[2].celdas[0].runs;
    assert.equal(pot[0].esc, 0.76471);
    assert.equal(pot[0].sep, 0.2);
    assert.equal(pot[2].t, 'MVA');
    assert.equal(pot[2].esc, 0.88235);
  });
  test('Tabla 1 con un dato que falta: la celda queda en blanco (no «… V»)', () => {
    const c = M.cambiarCampo(contenidoCompletoEjemplo(), 'equipo.tension_primaria_v', null);
    assert.deepEqual(bloque(construirDocumento(c), 't1').filas[5].celdas[1].runs, []);
  });
  test('Tablas 2–4 numeradas; Tabla 5 con título, encabezado, V1…V4 y nominal', () => {
    assert.equal(textoDe(bloque(d, 't2').filas[0].celdas[1].runs), 'VENTILADOR MARCA-PRUEBA VX-100 (7000 CFM)');
    assert.equal(bloque(d, 't2').filas[0].celdas[1].envolver, true);
    assert.deepEqual(bloque(d, 't3').filas.map((f) => textoDe(f.celdas[0].runs)), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const t5 = bloque(d, 't5');
    assert.equal(t5.filas[0].celdas[0].span, 4);
    assert.equal(textoDe(t5.filas[0].celdas[0].runs), 'CONSUMO DE CORRIENTE EN VENTILADORES');
    assert.deepEqual(t5.filas.slice(2).map((f) => f.celdas.map((c) => textoDe(c.runs)).join('|')),
      ['V1 VX-100|2,03|1,9|1,91', 'V2 VX-100|2,02|1,9|1,91', 'V3 VX-100|2,01|1,9|1,91', 'V4 VX-100|2|1,9|1,91', 'NOMINAL VX-100|2,7|2,7|2,7']);
  });
  test('anexo de cálculo: SOLO dos tablas, con su total cuando hay más de un tipo (decisión 9)', () => {
    const calc = d.bloques.filter((b) => b.tipo === 'tabla' && b.id.startsWith('calc'));
    assert.deepEqual(calc.map((t) => t.id), ['calc_actual', 'calc_proyectado']);
    assert.deepEqual(calc[0].filas.map((f) => f.celdas.map((c) => textoDe(c.runs)).join('|')),
      ['ACTUAL', 'TIPO / MODELO|CANTIDAD|CFM POR UNIDAD|CFM TOTAL', 'VA-50|3|5000|15000']);
    assert.equal(calc[0].filas[0].celdas[0].fondo, '#D9D9D9');
    let c = contenidoCompletoEjemplo();
    c = M.cambiarCampo(c, 'ventiladores.nuevo', [{ marca: 'MARCA-PRUEBA', modelo: 'VX-100', cantidad: 3, cfm_unitario: 7000 }, { marca: 'OTRA', modelo: 'VZ-9', cantidad: 2, cfm_unitario: 6000 }]);
    const pro = bloque(construirDocumento(c), 'calc_proyectado');
    assert.deepEqual(pro.filas.slice(2).map((f) => f.celdas.map((x) => textoDe(x.runs)).join('|')),
      ['MARCA-PRUEBA VX-100|3|7000|21000', 'OTRA VZ-9|2|6000|12000', 'TOTAL|5||33000']);
    const todo = textosDelDocumento(d).join(' ');
    assert.doesNotMatch(todo, /AIR REQUIRED|CFM Requeridos|Numero de Ventiladores|OA RATING/);
  });
  test('anexos: la imagen cabe en su hoja (una ficha muy alta se angosta y se centra)', () => {
    const anx = d.bloques.filter((b) => b.tipo === 'anexoImagen');
    assert.deepEqual(anx.map((b) => b.ref), ['archivo:aConsignacion0000000', 'ficha:ficha_actual', 'ficha:ficha_nuevo']);
    assert.equal(anx[0].anchoPt, undefined);
    assert.ok(anx[2].anchoPt > 300 && anx[2].anchoPt < 441.9);
    assert.ok(anx[2].anchoPt * anx[2].alto / anx[2].ancho <= 605 - 12.455);
  });
});

describe('frases que dependen de los datos', () => {
  const personal = (tecnicos) => textoDe(bloque(construirDocumento(M.cambiarCampo(contenidoCompletoEjemplo(), 'personal.tecnicos', tecnicos)), 'personal').runs);
  test('0, 1 y 2 técnicos', () => {
    assert.match(personal([]), /el ingeniero Ingeniero Prueba Uno, del 20 al 21 de marzo de 2026\.$/);
    assert.match(personal(['Técnico Prueba Dos']), /el ingeniero Ingeniero Prueba Uno y el técnico Técnico Prueba Dos, del 20/);
    assert.match(personal([...PERSONAS.tecnicos]), /y los técnicos Técnico Prueba Dos y Técnico Prueba Tres, del 20/);
  });
  const montaje = (nNuevo) => textoDe(bloque(construirDocumento(M.cambiarCampo(contenidoCompletoEjemplo(), 'ventiladores.nuevo.0.cantidad', nNuevo)), 'montaje').runs);
  test('0, 1 y 2 ventiladores adicionales (3 actuales)', () => {
    assert.match(montaje(3), /el cambio de los 3 ventiladores actuales, de acuerdo/);
    assert.match(montaje(4), /los 3 ventiladores actuales y la incorporación del cuarto ventilador adicional en disposición lateral, de acuerdo/);
    assert.match(montaje(5), /los 3 ventiladores actuales y la incorporación de 2 ventiladores adicionales en disposición lateral, de acuerdo/);
  });
  test('objetivo específico 1 y resaltado de la condición de salud', () => {
    const d = construirDocumento(contenidoCompletoEjemplo());
    assert.match(textoDe(bloque(d, 'obj_esp_1').runs), /pasar de 3 unidades de refrigeración a 4 unidades/);
    const p2 = bloque(d, 'intro_p2').runs;
    assert.deepEqual(p2.filter((r) => r.mark), [{ t: 'condición de salud 2 (bueno)', mark: true }]);
    const ingreso = bloque(d, 'ingreso').runs;
    assert.deepEqual(ingreso.filter((r) => r.b).map((r) => r.t), ['000111', 'ODT-PRUEBA-1 Y ODT-PRUEBA-2']);
  });
  test('zona y departamento escritos a mano salen en MAYÚSCULAS (con tilde) en la portada', () => {
    let c = M.cambiarCampo(contenidoCompletoEjemplo(), 'equipo.departamento', 'bolivar');
    c = M.cambiarCampo(c, 'equipo.zona', 'occidente');
    const datos = construirDocumento(c).portada.datos.map(textoDe);
    assert.ok(datos.includes('DEPARTAMENTO: BOLÍVAR'));
    assert.ok(datos.includes('ZONA: OCCIDENTE'));
  });
  test('un dato que falta se ve como hueco «[…]» en el borrador', () => {
    const d = construirDocumento(M.informeVacio());
    const p2 = bloque(d, 'intro_p2').runs;
    assert.ok(p2.some((r) => r.falta && r.t === '[subestación]'));
  });
});

describe('estado: marca de agua y firmas (decisión 4)', () => {
  const c = contenidoCompletoEjemplo();
  const v = versionEmitidaEjemplo(c);
  test('marca de agua según el estado', () => {
    assert.equal(construirDocumento(c).meta.marcaAgua, 'BORRADOR · SIN EMITIR');
    assert.equal(construirDocumento(c, { estado: 'anulado', versionDoc: v }).meta.marcaAgua, 'ANULADO');
    assert.equal(construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: v }).meta.marcaAgua, null);
  });
  test('en BORRADOR nunca hay firma, aunque el firmante tenga firma y haya versión', () => {
    const d = construirDocumento(c, { estado: 'borrador', versionDoc: v });
    assert.ok(d.portada.firmas.every((f) => f.firmaRef === null && f.fecha === null));
    assert.ok(!refsDelDocumento(d).some((r) => r.startsWith('firma:')));
  });
  test('EMITIDO: solo la línea cuya firma trae la versión y con el MISMO nombre', () => {
    const d = construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: v });
    const [e, r, a] = d.portada.firmas;
    assert.equal(e.firmaRef, 'firma:elaborado');
    assert.equal(e.fecha, '22/03/2026', 'fecha de emisión en hora de Colombia');
    assert.ok(e.firmaTamPt.ancho > 0 && e.firmaTamPt.alto <= 26);
    assert.ok(Math.abs(e.firmaXPt + e.firmaTamPt.ancho / 2 - 270.5) < 0.01, 'centrada bajo la fecha (§163.14)');
    assert.equal(r.firmaXPt, null);
    assert.equal(r.firmaRef, null);
    assert.equal(a.firmaRef, null);
    assert.equal(e.nombre, 'FIRMANTE PRUEBA');
  });
  test('EMITIDO sin versión o con otro nombre en la línea: sin firma', () => {
    assert.ok(construirDocumento(c, { estado: 'emitido' }).portada.firmas.every((f) => f.firmaRef === null));
    const otro = M.cambiarCampo(c, 'firmas.elaborado.nombre', 'OTRA PERSONA PRUEBA');
    const d = construirDocumento(otro, { estado: 'emitido', version: 1, versionDoc: versionEmitidaEjemplo(otro) });
    assert.equal(d.portada.firmas[0].firmaRef, null);
  });
  test('ANULADO: sin firmas', () => {
    assert.ok(construirDocumento(c, { estado: 'anulado', versionDoc: v }).portada.firmas.every((f) => f.firmaRef === null));
  });
});

describe('texto sin HTML y referencias de imágenes', () => {
  test('con datos inventados normales, ningún texto contiene «<»', () => {
    const d = construirDocumento(contenidoCompletoEjemplo());
    for (const t of textosDelDocumento(d)) assert.ok(!String(t).includes('<'), t);
  });
  test('un dato con HTML viaja como TEXTO y el papel lo escapa', () => {
    let c = contenidoCompletoEjemplo();
    c = M.cambiarCampo(c, 'equipo.fabricante', '<img src=x onerror=alert(1)>');
    c = M.cambiarCampo(c, 'textos.alcance', 'Texto <b>propio</b> & más');
    c = M.cambiarCampo(c, 'figuras.alcance.0.figuras.0.pie', '"pie" <script>');
    const d = construirDocumento(c);
    assert.equal(textoDe(bloque(d, 't1').filas[1].celdas[1].runs), '<img src=x onerror=alert(1)>');
    const html = htmlDeRuns(bloque(d, 'alcance').runs) + htmlDeRuns(bloque(d, 't1').filas[1].celdas[1].runs) + htmlDeRuns(bloque(d, 'g01').figuras[0].runs);
    assert.doesNotMatch(html, /<img|<script|<b>propio/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /Texto &lt;b&gt;propio&lt;\/b&gt; &amp; más/);
    assert.equal(escaparHTML(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
  test('htmlDeRuns: negrita, resaltado, escala y hueco', () => {
    assert.equal(htmlDeRuns([{ t: 'A', b: true }, { t: 'B', mark: true }, { t: 'C', esc: 0.88 }, { t: '[x]', falta: true }]),
      '<b>A</b><mark class="ibr-mark">B</mark><span class="ibr-esc" data-s="0.88">C</span><span class="ibr-falta">[x]</span>');
  });
  test('urlSegura: solo https, blob o imagen data', () => {
    assert.equal(urlSegura('https://x/y.png'), 'https://x/y.png');
    assert.equal(urlSegura('blob:https://x/1'), 'blob:https://x/1');
    assert.equal(urlSegura('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
    assert.equal(urlSegura('javascript:alert(1)'), null);
    assert.equal(urlSegura('data:text/html,<b>'), null);
    assert.equal(urlSegura(null), null);
  });
  test('toda referencia del documento se resuelve con metaDeRef (informe completo + versión emitida)', () => {
    const c = contenidoCompletoEjemplo();
    const v = versionEmitidaEjemplo(c);
    const d = construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: v });
    const refs = refsDelDocumento(d);
    assert.equal(refs.filter((r) => r.startsWith('marca:')).length, 5);
    assert.equal(refs.filter((r) => r.startsWith('archivo:')).length, 30, '29 fotos + consignación');
    assert.deepEqual(refs.filter((r) => r.startsWith('firma:')), ['firma:elaborado']);
    for (const r of refs) assert.ok(metaDeRef(r, { contenido: c, config: configPrueba(), versionDoc: v }), r);
    assert.equal(new Set(refs).size, refs.length);
  });
  test('metaDeRef: marca de la versión antes que la de la configuración; firma solo de una versión', () => {
    const c = contenidoCompletoEjemplo();
    const v = versionEmitidaEjemplo(c);
    v.marca['applus-portada'] = { ruta: 'de-la-version' };
    assert.equal(metaDeRef('marca:applus-portada', { contenido: c, config: configPrueba(), versionDoc: v }).ruta, 'de-la-version');
    assert.notEqual(metaDeRef('marca:applus-portada', { contenido: c, config: configPrueba() }).ruta, 'de-la-version');
    assert.equal(metaDeRef('firma:elaborado', { contenido: c, config: configPrueba() }), null);
    assert.equal(metaDeRef('marca:inventada', { config: configPrueba() }), null);
    assert.equal(metaDeRef('otra:cosa', {}), null);
  });
  test('titulosAnexos: lo escrito a mano manda; si no, la plantilla', () => {
    let c = contenidoCompletoEjemplo();
    c = M.cambiarCampo(c, 'anexos.1.titulo', 'FICHA PROPIA');
    const t = titulosAnexos(c);
    assert.equal(t[1].titulo, 'FICHA PROPIA');
    assert.equal(t[1].titulo_portada, 'FICHA PROPIA');
    assert.equal(t[2].titulo_portada, 'FICHA TÉCNICA VENTILADOR MARCA-PRUEBA VX-100');
  });
});

describe('geometría de las fotos (pura)', () => {
  const d = construirDocumento(contenidoCompletoEjemplo());
  test('2x1: dos columnas iguales, fotos del ancho de la columna menos 10,8 pt, a 5,2 pt del borde izquierdo (como el modelo)', () => {
    const g = geometriaFotos(bloque(d, 'g01'));
    assert.equal(g.colW.length, 2);
    assert.ok(Math.abs(g.colW[0] - 240.6) < 1e-9);
    assert.ok(Math.abs(g.x0 - (306 - 481.2 / 2)) < 1e-9);
    const f = g.filas[0].fotos[0];
    assert.ok(Math.abs(f.w - (240.6 - 10.8)) < 1e-9);
    assert.ok(Math.abs(f.x - (g.colX[0] + 5.2)) < 1e-9);
  });
  test('3f: un alto común; 2x2f: dos filas de 175,1 pt; 1x1: a lo ancho', () => {
    const g3 = geometriaFotos(bloque(d, 'g10'));
    assert.equal(g3.filas.length, 1);
    assert.equal(new Set(g3.filas[0].fotos.map((f) => f.h.toFixed(6))).size, 1);
    assert.ok(Math.abs(g3.ancho - 493.7) < 1e-6);
    const g4 = geometriaFotos(bloque(d, 'g12'));
    assert.equal(g4.filas.length, 2);
    assert.ok(g4.filas.every((r) => r.fotos.every((f) => f.h <= 175.1 + 1e-9)));
    const g1 = geometriaFotos(bloque(d, 'g13'));
    assert.equal(g1.colW.length, 1);
  });
  test('una foto muy alta no se come la hoja', () => {
    const b = { disposicion: '2x1', figuras: [{ fotos: [{ ancho: 300, alto: 2000 }] }, { fotos: [{ ancho: 600, alto: 800 }] }] };
    const g = geometriaFotos(b);
    assert.ok(g.filas[0].fotos[0].h <= 430);
  });
});

describe('correcciones de la revisión (firmas, geometría compartida y ajustes del modelo)', () => {
  const c = contenidoCompletoEjemplo();
  const v = versionEmitidaEjemplo(c);
  test('una versión con el nombre de la línea pero la firma de OTRO firmante no se estampa (aun con firmante null)', () => {
    const ajena = { ...v, firmas: [{ ...v.firmas[0], clave: 'f-persona-ajena', firma: { ...v.firmas[0].firma, ruta: 'informes_brigada_marca/firmas/f-persona-ajena/' + v.firmas[0].firma.huella } }] };
    assert.equal(construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: ajena }).portada.firmas[0].firmaRef, null);
    // misma clave pero la imagen en la carpeta de otro
    const otraCarpeta = { ...v, firmas: [{ ...v.firmas[0], firma: { ...v.firmas[0].firma, ruta: 'informes_brigada_marca/firmas/f-persona-ajena/' + v.firmas[0].firma.huella } }] };
    assert.equal(construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: otraCarpeta }).portada.firmas[0].firmaRef, null);
    // la línea sin firmante (nombre escrito a mano igual al del firmante): sin firma
    const aMano = M.cambiarCampo(c, 'firmas.elaborado.firmante', null);
    assert.equal(construirDocumento(aMano, { estado: 'emitido', version: 1, versionDoc: versionEmitidaEjemplo(aMano) }).portada.firmas[0].firmaRef, null);
    assert.equal(metaDeRef('firma:elaborado', { contenido: aMano, versionDoc: versionEmitidaEjemplo(aMano) }), null, 'metaDeRef tampoco la entrega');
    // la buena sí (Storage y Firestore)
    assert.equal(construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: v }).portada.firmas[0].firmaRef, 'firma:elaborado');
    const enFs = { ...v, firmas: [{ ...v.firmas[0], firma: { ...v.firmas[0].firma, almacen: 'firestore', ruta: 'informes_brigada_bin/firma_f-firmante-prueba_' + v.firmas[0].firma.huella.slice(0, 16) } }] };
    assert.equal(construirDocumento(c, { estado: 'emitido', version: 1, versionDoc: enFs }).portada.firmas[0].firmaRef, 'firma:elaborado');
  });

  test('cada cuadrícula lleva su geometría (disposición + ajuste del modelo) y el papel la usa', () => {
    const d = construirDocumento(c);
    const cuads = d.bloques.filter((b) => b.tipo === 'cuadricula');
    const alcance = cuads.find((b) => b.seccion === 'alcance');
    assert.equal(alcance.geom.alinearV, 'centro');
    assert.equal(alcance.geom.sangriaPie, 35.5);
    const g = geometriaFotos(alcance);
    assert.equal(g.pie.sangria, 35.5);
    assert.equal(g.pie.dy, 3.1);
    assert.equal(g.pie.alto, 16.7);
    const ingreso = cuads.find((b) => b.seccion === 'ingreso');
    assert.equal(geometriaFotos(ingreso).pie.sangria, 35.5);
    assert.equal(geometriaFotos(ingreso).alinearV, null, 'solo el alcance va centrado en alto');
    const montaje = cuads.filter((b) => b.seccion === 'montaje');
    assert.equal(montaje[0].geom.extraInferior, 7);
    assert.equal(montaje[1].geom.extraInferior, 7);
    assert.equal(montaje[2].geom.extraInferior, undefined);
    const tension = cuads.filter((b) => b.seccion === 'pruebas_consumo')[1];
    const gt = geometriaFotos(tension);
    assert.deepEqual(gt.colW, [166.3, 163.8, 164.3]);
    assert.ok(gt.filas[0].fotos.every((f) => f.h <= 175.1 + 1e-9));
    const consumo = cuads.filter((b) => b.seccion === 'pruebas_consumo')[0];
    assert.ok(Math.abs(geometriaFotos(consumo).x0 - 64.3) < 1e-9, '3f arranca en 64,3 pt');
  });

  test('fotos ARRIBA en su celda (como el modelo); centradas en alto solo con alinearV', () => {
    const b = { disposicion: '2x1', geom: null, figuras: [{ fotos: [{ ancho: 600, alto: 800 }] }, { fotos: [{ ancho: 600, alto: 700 }] }] };
    const g = geometriaFotos(b);
    assert.equal(g.filas[0].fotos[0].y, 0.5);
    assert.equal(g.filas[0].fotos[1].y, 0.5, 'la más corta también arriba');
    const gc = geometriaFotos({ ...b, geom: { alinearV: 'centro' } });
    assert.ok(gc.filas[0].fotos[1].y > 0.5, 'centrada: baja la más corta');
  });

  test('UN tope de alto por disposición (430 pt a lo ancho, 260 pt en tres fotos), el mismo para PDF y Word', () => {
    const alta = { disposicion: '1x1', figuras: [{ fotos: [{ ancho: 600, alto: 1600 }] }] };
    assert.ok(Math.abs(geometriaFotos(alta).filas[0].fotos[0].h - 430) < 1e-9);
    const tres = { disposicion: '3f', figuras: [{ fotos: [{ ancho: 100, alto: 900 }, { ancho: 100, alto: 900 }, { ancho: 100, alto: 900 }] }] };
    assert.ok(Math.abs(geometriaFotos(tres).filas[0].fotos[0].h - 260) < 1e-9);
  });

  test('un ajuste que no está en la lista o fuera de rango se ignora', () => {
    const d = construirDocumento(M.cambiarCampo(c, 'figuras.alcance.0.ajuste', { sangriaPie: 9999, inventado: 3, alinearV: 'abajo', altoPie: 20 }));
    const b = d.bloques.find((x) => x.tipo === 'cuadricula' && x.seccion === 'alcance');
    assert.equal(b.geom.altoPie, 20);
    assert.equal(b.geom.sangriaPie, undefined);
    assert.equal(b.geom.inventado, undefined);
    assert.equal(b.geom.alinearV, undefined);
  });
});
