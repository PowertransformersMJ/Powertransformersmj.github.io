// Firma de ODT Afinia · PANTALLA sin navegador (DOM mínimo de tests/odt_afinia_ui_dobles.js).
//   · la declaración que se MUESTRA es, carácter a carácter, la cadena que se GUARDA (comité W-11, legal);
//   · la casilla «Acepto» empieza DESMARCADA y el botón no actúa sin casilla y contraseña;
//   · la contraseña sale del campo al usarla;
//   · un nombre con «<…>» se muestra como texto, no como HTML;
//   · Habilitarme: estado de los cuatro pasos (la firma debe ser POSTERIOR a la habilitación);
//   · Bandeja: pestañas pedidas y aviso de suplantación en «Firmadas por mí»;
//   · Constancia: muestra quién, con qué cuenta, cuándo firmó y cuándo escribió su contraseña.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso } from './odt_afinia_ui_dobles.js';
import { declaracionAzt, declaracionResponsable, textoAcuerdo } from '../assets/js/domain/odt_afinia_textos.js';
import { NRO } from './odt_afinia_fixture.js';

let guardado;
before(() => { guardado = globalThis.document; globalThis.document = crearDomFalso(); });
after(() => { if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado; });

const { armarDeclaracion } = await import('../assets/js/ui/odt-afinia/declaracion.js');
const { estadoPasos, TEXTO_MI_FIRMA } = await import('../assets/js/ui/odt-afinia/habilitarme.js');
const { PESTANAS, AVISO_SUPLANTACION } = await import('../assets/js/ui/odt-afinia/bandeja.js');
const { constancia } = await import('../assets/js/ui/odt-afinia/constancia.js');
const { leerAncla } = await import('../assets/js/ui/odt-afinia/app.js');

const DATOS = { nombre: 'Azt De Prueba', correo: 'azt@prueba.test', nro: NRO };

describe('declaración: lo que se muestra es lo que se guarda', () => {
  for (const [nombre, texto, version] of [
    ['AZT', declaracionAzt(DATOS), 'odt-azt-v1'],
    ['Responsable', declaracionResponsable({ ...DATOS, fecha: '15/11/2026' }), 'odt-resp-v1'],
    ['acuerdo', textoAcuerdo(DATOS), 'odt-acuerdo-v1']
  ]) {
    test(nombre + ': textContent idéntico a la cadena (NFC, «N.º» U+00BA)', () => {
      const d = armarDeclaracion({ texto, version, alConfirmar: () => {} });
      assert.equal(d.textoEl.textContent, texto);
      assert.equal(d.textoMostrado(), texto);
      assert.equal(d.textoEl.textContent.normalize('NFC'), d.textoEl.textContent);
      if (nombre !== 'acuerdo') assert.ok(d.textoEl.textContent.includes('N.º ' + NRO));
      assert.equal(d.textoEl.childNodes.length, 1, 'un solo nodo de texto: sin marcado intercalado');
    });
  }

  test('la casilla empieza DESMARCADA y el botón desactivado', () => {
    const d = armarDeclaracion({ texto: declaracionAzt(DATOS), version: 'odt-azt-v1', alConfirmar: () => {} });
    assert.equal(d.casilla.type, 'checkbox');
    assert.equal(d.casilla.checked, false);
    assert.equal(d.boton.disabled, true);
    assert.equal(d.contrasena.type, 'password');
    assert.equal(d.contrasena.value, '');
  });

  test('sin casilla o sin contraseña no se confirma; con las dos, sí, y la contraseña sale del campo', async () => {
    const llamadas = [];
    const d = armarDeclaracion({ texto: declaracionAzt(DATOS), version: 'odt-azt-v1', alConfirmar: (c) => { llamadas.push(c); } });
    d.contrasena.value = 'clave-sintetica'; await d.contrasena.disparar('input');
    assert.equal(d.boton.disabled, true, 'contraseña sin casilla');
    await d.boton.disparar('click');
    assert.equal(llamadas.length, 0);
    d.casilla.checked = true; await d.casilla.disparar('change');
    assert.equal(d.boton.disabled, false);
    d.contrasena.value = ''; await d.contrasena.disparar('input');
    assert.equal(d.boton.disabled, true, 'casilla sin contraseña');
    d.contrasena.value = 'clave-sintetica'; await d.contrasena.disparar('input');
    await d.boton.disparar('click');
    assert.deepEqual(llamadas, ['clave-sintetica']);
    assert.equal(d.contrasena.value, '', 'la contraseña no queda en pantalla');
  });

  test('un texto con «<b>» se muestra literal (textContent, nunca HTML)', () => {
    const t = declaracionAzt({ ...DATOS, nombre: 'Nombre <b>raro</b>' });
    const d = armarDeclaracion({ texto: t, version: 'odt-azt-v1', alConfirmar: () => {} });
    assert.equal(d.textoEl.textContent, t);
    assert.ok(!d.textoEl.childNodes.some((c) => c.nodeType === 1));
  });

  test('sin texto no se arma', () => {
    assert.throws(() => armarDeclaracion({ texto: '', alConfirmar: () => {} }));
  });
});

describe('Habilitarme: los cuatro pasos', () => {
  const perfil = { nombre: 'Azt De Prueba', correoPerfil: 'azt@prueba.test' };
  const cuenta = { correo: 'azt@prueba.test', verificado: true, proveedor: 'password' };
  test('listo solo con correo verificado, habilitación y firma POSTERIOR a ella', () => {
    assert.equal(estadoPasos({ cuenta, perfil, hab: { enMs: 100 }, miFirma: { hay: true, enMs: 200 } }).listo, true);
    const vieja = estadoPasos({ cuenta, perfil, hab: { enMs: 200 }, miFirma: { hay: true, enMs: 100 } });
    assert.equal(vieja.listo, false); assert.equal(vieja.pasos.firma, false);
    assert.equal(estadoPasos({ cuenta: { ...cuenta, verificado: false }, perfil, hab: null, miFirma: null }).pasos.correo, false);
    assert.equal(estadoPasos({ cuenta, perfil, hab: null, miFirma: { hay: true, enMs: 5 } }).pasos.firma, false);
  });
  test('problemas que la regla negaría se avisan antes', () => {
    assert.ok(estadoPasos({ cuenta, perfil: { ...perfil, correoPerfil: 'otro@prueba.test' } }).problemas.some((p) => /correo de su perfil/.test(p)));
    assert.equal(estadoPasos({ cuenta, perfil: { ...perfil, correoPerfil: 'AZT@Prueba.Test' } }).problemas.length, 0, 'sin distinguir mayúsculas');
    assert.ok(estadoPasos({ cuenta, perfil: { ...perfil, nombre: '' } }).problemas.some((p) => /nombre/.test(p)));
    assert.ok(estadoPasos({ cuenta, perfil: { ...perfil, legacy: true } }).problemas.some((p) => /perfil/.test(p)));
    assert.ok(estadoPasos({ cuenta: { ...cuenta, proveedor: 'google.com' }, perfil }).problemas.some((p) => /contraseña/.test(p)));
  });
  test('texto propio junto al panel «Mi firma»', () => {
    assert.equal(TEXTO_MI_FIRMA, 'En la ODT solo se estampa su firma, desde su cuenta.');
  });
});

describe('Bandeja', () => {
  test('pestañas Mi turno / En curso / Listas / Firmadas por mí', () => {
    const t = PESTANAS.map((p) => p.titulo);
    for (const x of ['Mi turno', 'En curso', 'Listas', 'Firmadas por mí']) assert.ok(t.includes(x), x);
  });
  test('aviso de suplantación', () => {
    assert.match(AVISO_SUPLANTACION, /no firmó/);
    assert.match(AVISO_SUPLANTACION, /cambie su contraseña/);
  });
  test('el ancla elige la vista (y un id mal formado vuelve a la bandeja)', () => {
    assert.deepEqual(leerAncla('#odt=' + 'A'.repeat(20)), { vista: 'odt', odtId: 'A'.repeat(20) });
    assert.deepEqual(leerAncla('#odt=../x'), { vista: 'bandeja' });
    assert.deepEqual(leerAncla('#publicar'), { vista: 'publicar' });
    assert.deepEqual(leerAncla(''), { vista: 'bandeja' });
  });
});

describe('Constancia de firmas', () => {
  test('muestra el acto: nombre, cuenta, hora de firma y de contraseña, declaración y huellas', () => {
    const odt = {
      estado: 'PENDIENTE_RESPONSABLE', huella: 'a'.repeat(64), publicadoPor: { nombre: 'Admin De Prueba' }, publicadoEnMs: Date.UTC(2026, 10, 20, 14),
      firmantes: { azt: { uid: 'u1', nombre: 'Azt De Prueba', correo: 'azt@prueba.test' }, responsable: { uid: 'u2', nombre: 'Resp De Prueba', correo: 'resp@prueba.test' } }
    };
    const acto = {
      nombre: 'Azt De Prueba', correo: 'azt@prueba.test', enMs: Date.UTC(2026, 10, 20, 15, 30, 5), authTime: Math.floor(Date.UTC(2026, 10, 20, 15, 29, 0) / 1000),
      nro: NRO, huellaImagen: 'b'.repeat(64), huellaBase: 'a'.repeat(64), huellaVista: 'c'.repeat(64), compositor: 'odt-afinia@1',
      declaracionVersion: 'odt-azt-v1', declaracion: declaracionAzt(DATOS)
    };
    const t = constancia({ odt, actos: { azt: acto } }).textContent;
    for (const x of ['Azt De Prueba', 'azt@prueba.test', '20/11/2026', '10:30:05', '10:29:00', NRO, declaracionAzt(DATOS), 'Sin firmar', 'Resp De Prueba']) {
      assert.ok(t.includes(x), 'falta: ' + x);
    }
  });
});

const { TEXTOS_APROBADOS, ROTULO_BORRADOR } = await import('../assets/js/domain/odt_afinia_textos.js');
const { mensajeEsDeLaVista } = await import('../assets/js/ui/odt-afinia/app.js');
const { avisoSesionReciente, motivosEnLlano } = await import('../assets/js/ui/odt-afinia/publicar.js');
const { cargarPdfLib, bloquearCopia } = await import('../assets/js/ui/odt-afinia/comun.js');
const { PDF_LIB } = await import('../assets/js/domain/odt_afinia_rutas.js');

describe('textos sin aprobar: rótulo «Borrador · pendiente del Ingeniero»', () => {
  test('mientras TEXTOS_APROBADOS sea false, la declaración (firma y acuerdo) lleva el rótulo ENCIMA del texto', () => {
    assert.equal(TEXTOS_APROBADOS, false);
    assert.equal(ROTULO_BORRADOR, 'Borrador · pendiente del Ingeniero');
    for (const texto of [declaracionAzt(DATOS), textoAcuerdo(DATOS)]) {
      const d = armarDeclaracion({ texto, version: 'v', alConfirmar: () => {} });
      assert.ok(d.rotulo, 'hay rótulo');
      assert.equal(d.rotulo.textContent, ROTULO_BORRADOR);
      assert.ok(d.raiz.childNodes.indexOf(d.rotulo) < d.raiz.childNodes.indexOf(d.textoEl), 'antes del texto');
      assert.equal(d.textoEl.textContent, texto, 'el rótulo no se mezcla con lo que se guarda');
    }
  });
});

describe('app: el mensaje de una ODT va a SU vista', () => {
  const ID = 'A'.repeat(20); const OTRA = 'B'.repeat(20);
  test('solo si el ancla es esa misma ODT', () => {
    assert.equal(mensajeEsDeLaVista('#odt=' + ID, ID), true);
    assert.equal(mensajeEsDeLaVista('#odt=' + OTRA, ID), false);
    assert.equal(mensajeEsDeLaVista('#bandeja', ID), false);
    assert.equal(mensajeEsDeLaVista('', ID), false);
    assert.equal(mensajeEsDeLaVista('#odt=' + ID, ''), false);
  });
});

describe('Publicar: procedimiento D5 y motivos en llano', () => {
  test('sesión de admin abierta hace < 5 min (hora del servidor) → avisa y pide confirmar', () => {
    assert.match(avisoSesionReciente({ edadSeg: 30 }), /menos de 5 minutos/);
    assert.match(avisoSesionReciente({ edadSeg: 299 }), /titular/);
    assert.equal(avisoSesionReciente({ edadSeg: 300 }), null);
    assert.equal(avisoSesionReciente({ edadSeg: 3600 }), null);
  });
  test('si no se puede saber, también pide confirmar (no se da por vieja)', () => {
    assert.match(avisoSesionReciente(null, new Error('sin red')), /No se pudo comprobar[\s\S]*sin red/);
    assert.match(avisoSesionReciente({ edadSeg: NaN }), /No se pudo comprobar/);
  });
  test('motivos de tinta y de la revisión estructural, sin repetir', () => {
    assert.equal(motivosEnLlano(['anotacion:Ink', 'tinta:0.034']), 'trae una anotación (Ink) y tinta');
    assert.equal(motivosEnLlano(['imagen', 'trazo', 'texto']), 'trae una imagen y trazos dibujados y texto escrito');
    assert.equal(motivosEnLlano(['formulario:trazo', 'tinta:0.1', 'tinta:0.2']), 'trae un formulario incrustado con trazos dibujados y tinta');
  });
});

describe('comun: pdf-lib de los MISMOS bytes verificados y lienzos sin copia', () => {
  const resp = (bytes) => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  test('huella distinta: no se importa nada', async () => {
    let importado = false;
    await assert.rejects(cargarPdfLib({
      fetchFn: async () => resp(new Uint8Array([1, 2, 3])), importar: async () => { importado = true; return {}; },
      crearUrl: () => 'blob:x', revocarUrl: () => {}
    }), /huella distinta/);
    assert.equal(importado, false);
  });
  test('huella correcta: se importa el Blob URL de esos bytes (no un segundo pedido) y se revoca', async () => {
    const { readFileSync } = await import('node:fs');
    const bytes = new Uint8Array(readFileSync(new URL('../' + PDF_LIB.ruta, import.meta.url)));
    const urls = []; const revocadas = []; const blobs = [];
    const mod = await cargarPdfLib({
      fetchFn: async () => resp(bytes),
      crearUrl: (b) => { blobs.push(b); const u = 'blob:verificado-' + urls.length; urls.push(u); return u; },
      revocarUrl: (u) => revocadas.push(u),
      importar: async (u) => { assert.equal(u, urls[0], 'importa la URL del Blob verificado'); return { PDFDocument: class {} }; }
    });
    assert.ok(mod.PDFDocument);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].size, bytes.length);
    assert.deepEqual(revocadas, urls);
  });
  test('bloquearCopia: menú contextual y arrastre bloqueados', async () => {
    const l = document.createElement('canvas');
    bloquearCopia(l);
    assert.equal(l.getAttribute('draggable'), 'false');
    for (const tipo of ['contextmenu', 'dragstart']) {
      let evitado = false;
      for (const fn of l._esc[tipo] || []) fn({ preventDefault: () => { evitado = true; } });
      assert.ok(evitado, tipo);
    }
  });
});
