// Firma de ODT Afinia · PANTALLA sin navegador (DOM mínimo de tests/odt_afinia_ui_dobles.js).
//   · la declaración que se MUESTRA es, carácter a carácter, la cadena que se GUARDA (comité W-11, legal);
//   · HABILITARSE (acuerdo): la casilla «Acepto» empieza DESMARCADA y el botón no actúa sin casilla y contraseña;
//     la contraseña sale del campo al usarla;
//   · FIRMAR (decisión del Ingeniero del 2026-11-21): la declaración completa, «Firmar» → «Confirmar firma» y «Cancelar»,
//     sin casilla ni contraseña, y un solo envío aunque se pulse dos veces;
//   · un nombre con «<…>» se muestra como texto, no como HTML;
//   · Habilitarme: estado de los cuatro pasos (la firma debe ser POSTERIOR a la habilitación);
//   · Bandeja: pestañas pedidas y aviso de suplantación en «Firmadas por mí»;
//   · Constancia: muestra quién, con qué cuenta, cuándo firmó y cuándo inició la sesión con la que firmó.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso } from './odt_afinia_ui_dobles.js';
import { declaracionAzt, declaracionResponsable, textoAcuerdo } from '../assets/js/domain/odt_afinia_textos.js';
import { NRO } from './odt_afinia_fixture.js';

let guardado;
before(() => { guardado = globalThis.document; globalThis.document = crearDomFalso(); });
after(() => { if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado; });

const { armarDeclaracion } = await import('../assets/js/ui/odt-afinia/declaracion.js');
const { armarConfirmacionFirma, LINEA_CONFIRMAR } = await import('../assets/js/ui/odt-afinia/confirmar-firma.js');
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

describe('firmar (2026-11-21): declaración completa, «Firmar» → «Confirmar firma», sin casilla ni contraseña', () => {
  const sinCampos = (el) => !el.todos().some((x) => x.tagName === 'INPUT');
  for (const [nombre, texto, version] of [
    ['AZT', declaracionAzt(DATOS), 'odt-azt-v1'],
    ['Responsable', declaracionResponsable({ ...DATOS, fecha: '15/11/2026' }), 'odt-resp-v1']
  ]) {
    test(nombre + ': lo que se muestra es la cadena que se guarda (completa, un solo nodo de texto)', () => {
      const d = armarConfirmacionFirma({ texto, version, alConfirmar: () => {} });
      assert.equal(d.textoEl.textContent, texto);
      assert.equal(d.textoMostrado(), texto);
      assert.equal(d.textoEl.childNodes.length, 1);
      assert.ok(d.raiz.textContent.includes(texto), 'la declaración entera está en la pantalla');
      assert.ok(d.raiz.textContent.includes('Texto ' + version + ' (se guarda tal cual):'));
      assert.ok(sinCampos(d.raiz), 'ni casilla ni contraseña');
    });
  }
  test('al empezar solo se ve «Firmar»; al pulsarlo aparecen «Confirmar firma», «Cancelar» y la línea en llano', async () => {
    const llamadas = [];
    const d = armarConfirmacionFirma({ texto: declaracionAzt(DATOS), version: 'odt-azt-v1', alConfirmar: () => { llamadas.push(1); } });
    assert.equal(d.boton.textContent, 'Firmar');
    assert.equal(d.pasoFirmar.hidden, false); assert.equal(d.boton.disabled, false);
    assert.equal(d.caja.hidden, true, '«Confirmar firma» no se ve hasta pulsar «Firmar»');
    assert.equal(d.confirmar.textContent, 'Confirmar firma');
    assert.equal(d.cancelar.textContent, 'Cancelar');
    assert.equal(LINEA_CONFIRMAR, 'Al confirmar, acepta la declaración de arriba y su firma queda registrada.');
    assert.ok(d.caja.textContent.includes(LINEA_CONFIRMAR));
    // Un clic en «Confirmar firma» con la caja escondida no hace nada (solo se confirma después de «Firmar»).
    await d.confirmar.disparar('click');
    assert.equal(llamadas.length, 0);
    await d.boton.disparar('click');
    assert.equal(d.caja.hidden, false); assert.equal(d.pasoFirmar.hidden, true, '«Firmar» se va mientras se confirma');
    assert.equal(llamadas.length, 0, 'pulsar «Firmar» no firma');
    await d.cancelar.disparar('click');
    assert.equal(d.caja.hidden, true); assert.equal(d.pasoFirmar.hidden, false);
    assert.equal(llamadas.length, 0, '«Cancelar» no firma');
    await d.boton.disparar('click');
    await d.confirmar.disparar('click');
    assert.equal(llamadas.length, 1, '«Confirmar firma» firma');
  });
  test('sin doble envío: dos clics seguidos en «Confirmar firma» llaman UNA vez; mientras trabaja, todo ocupado', async () => {
    let soltar; let n = 0;
    const d = armarConfirmacionFirma({ texto: declaracionAzt(DATOS), version: 'odt-azt-v1', alConfirmar: () => { n++; return new Promise((r) => { soltar = r; }); } });
    await d.boton.disparar('click');
    const p1 = d.confirmar.disparar('click');
    const p2 = d.confirmar.disparar('click');
    assert.equal(n, 1);
    assert.equal(d.confirmar.disabled, true); assert.equal(d.cancelar.disabled, true); assert.equal(d.boton.disabled, true);
    await d.cancelar.disparar('click');
    assert.equal(d.caja.hidden, false, 'no se cancela a mitad del envío');
    soltar(); await Promise.all([p1, p2]);
    assert.equal(d.confirmar.disabled, false, 'terminó: se puede reintentar si falló');
    // bloquear (firma enviada o pendiente): ya nada se ofrece.
    d.bloquear(true);
    await d.confirmar.disparar('click');
    assert.equal(n, 1);
    assert.equal(d.confirmar.disabled, true); assert.equal(d.boton.disabled, true);
    d.bloquear(false);
    assert.equal(d.confirmar.disabled, false);
  });
  test('un texto con «<b>» se muestra literal; sin texto o sin alConfirmar no se arma; ningún «null» pintado', () => {
    const t = declaracionAzt({ ...DATOS, nombre: 'Nombre <b>raro</b>' });
    const d = armarConfirmacionFirma({ texto: t, version: 'odt-azt-v1', alConfirmar: () => {} });
    assert.equal(d.textoEl.textContent, t);
    assert.ok(!d.textoEl.childNodes.some((c) => c.nodeType === 1));
    assert.ok(!/\bnull\b|\bundefined\b/.test(d.raiz.textContent));
    assert.equal(d.rotulo, null, 'textos aprobados: sin rótulo de borrador');
    assert.throws(() => armarConfirmacionFirma({ texto: '', alConfirmar: () => {} }));
    assert.throws(() => armarConfirmacionFirma({ texto: t }));
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
  test('muestra el acto: nombre, cuenta, hora de firma y de inicio de sesión, declaración y huellas', () => {
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
    // 2026-11-21: la firma ya no pide la contraseña. El dato es «Sesión iniciada» (verdad también en los actos viejos:
    // su authTime fue la contraseña que abrió esa sesión), nunca «Escribió su contraseña».
    assert.ok(t.includes('Sesión iniciada'));
    assert.ok(!t.includes('Escribió su contraseña'));
    const fila = constancia({ odt, actos: { azt: acto } }).todos().find((x) => x.tagName === 'DT' && x.textContent === 'Sesión iniciada');
    assert.ok(fila, 'la fila «Sesión iniciada»');
    assert.equal(fila.parentNode.todos().find((x) => x.tagName === 'DD').textContent, '20/11/2026, 10:29:00');
    // Una sesión iniciada horas antes de firmar se muestra tal cual (no se inventa otra hora).
    const vieja = { ...acto, authTime: Math.floor(Date.UTC(2026, 10, 20, 11, 0, 0) / 1000) };
    assert.ok(constancia({ odt, actos: { azt: vieja } }).textContent.includes('20/11/2026, 06:00:00'));
  });
});

describe('decisiones del 2026-11-21 en la Constancia y la bandeja', () => {
  const odtBase = {
    nro: NRO, huella: 'a'.repeat(64), publicadoPor: { nombre: 'Admin De Prueba' }, publicadoEnMs: Date.UTC(2026, 10, 20, 14),
    firmantes: { azt: { uid: 'u1', nombre: 'Azt De Prueba', correo: 'azt@prueba.test' }, responsable: { uid: 'u2', nombre: 'Resp De Prueba', correo: 'resp@prueba.test' } }
  };
  const actoResp = (compositor) => ({
    nombre: 'Resp De Prueba', correo: 'resp@prueba.test', enMs: Date.UTC(2026, 10, 20, 16), authTime: Math.floor(Date.UTC(2026, 10, 20, 15, 59) / 1000),
    nro: NRO, huellaImagen: 'b'.repeat(64), huellaBase: 'a'.repeat(64), huellaVista: 'd'.repeat(64), compositor,
    cierre: { si: true, fecha: '15/11/2026' }, declaracionVersion: 'odt-resp-v1', declaracion: declaracionResponsable({ ...DATOS, fecha: '15/11/2026' })
  });
  const sello = (ms) => ({ toMillis: () => ms });
  test('pestañas «Cerradas» y «Anuladas y reemplazadas»', () => {
    const t = PESTANAS.map((p) => p.titulo);
    assert.ok(t.includes('Cerradas'));
    assert.ok(t.includes('Anuladas y reemplazadas'));
    assert.ok(t.indexOf('Listas') < t.indexOf('Cerradas'), 'Cerradas va después de Listas');
  });
  test('CERRADA: «Cerrada en Afinia el … · soporte … · registró …» y el estado en llano', () => {
    const odt = { ...odtBase, estado: 'CERRADA', cierreAfinia: { fecha: '18/11/2026', soporte: 'SOPORTE_ODT_PRUEBA_01', por: { uid: 'u9', nombre: 'Admin De Prueba' }, en: sello(Date.UTC(2026, 10, 18, 20)) } };
    const t = constancia({ odt, actos: {} }).textContent;
    assert.ok(t.includes('Cerrada en Afinia el 18/11/2026 · soporte SOPORTE_ODT_PRUEBA_01 · registró Admin De Prueba'));
    assert.ok(t.includes('Estado') && t.includes('Cerrada en Afinia'));
    assert.ok(!/null|undefined/.test(t));
  });
  test('REEMPLAZADA: quién, cuándo y el motivo', () => {
    const odt = { ...odtBase, estado: 'REEMPLAZADA', reemplazo: { motivo: 'La consignación del PDF no era la correcta.', por: { uid: 'u9', nombre: 'Admin De Prueba' }, en: sello(Date.UTC(2026, 10, 19, 15)) } };
    const t = constancia({ odt, actos: {} }).textContent;
    assert.ok(t.includes('Reemplazada por Admin De Prueba, 19/11/2026'), t);
    assert.ok(t.includes('Motivo: La consignación del PDF no era la correcta.'));
    assert.ok(!/null|undefined/.test(t));
  });
  test('acto del Responsable @2: dice el N.º estampado en «ODT GENERADA N°»; uno @1, no', () => {
    const odt = { ...odtBase, estado: 'LISTA' };
    const t2 = constancia({ odt, actos: { responsable: actoResp('odt-afinia@2') } }).textContent;
    assert.ok(t2.includes('ODT GENERADA N° (estampado)'));
    assert.ok(t2.includes('Fecha de cierre declarada') && t2.includes('15/11/2026'));
    const t1 = constancia({ odt, actos: { responsable: actoResp('odt-afinia@1') } }).textContent;
    assert.ok(!t1.includes('ODT GENERADA N°'));
    assert.ok(t1.includes('odt-afinia@1'), 'el compositor del acto se sigue mostrando');
  });
});

const { TEXTOS_APROBADOS, ROTULO_BORRADOR } = await import('../assets/js/domain/odt_afinia_textos.js');
const { mensajeEsDeLaVista } = await import('../assets/js/ui/odt-afinia/app.js');
const PUBLICAR = await import('../assets/js/ui/odt-afinia/publicar.js');
const { motivosEnLlano } = PUBLICAR;
const { cargarPdfLib, bloquearCopia } = await import('../assets/js/ui/odt-afinia/comun.js');
const { PDF_LIB } = await import('../assets/js/domain/odt_afinia_rutas.js');

describe('textos aprobados por el Ingeniero (2026-11-20, 99 §231.10): sin rótulo de borrador', () => {
  test('TEXTOS_APROBADOS es true y la declaración (firma y acuerdo) ya no lleva el rótulo', () => {
    assert.equal(TEXTOS_APROBADOS, true);
    assert.equal(ROTULO_BORRADOR, 'Borrador · pendiente del Ingeniero');
    for (const texto of [declaracionAzt(DATOS), textoAcuerdo(DATOS)]) {
      const d = armarDeclaracion({ texto, version: 'v', alConfirmar: () => {} });
      assert.equal(d.rotulo, null, 'sin rótulo');
      assert.ok(!d.raiz.textContent.includes(ROTULO_BORRADOR), 'el rótulo no aparece en ninguna parte');
      assert.equal(d.textoEl.textContent, texto, 'lo que se muestra es lo que se guarda');
    }
  });
  test('lo aprobado es el texto v1 EXACTO: cambiar una letra exige subir la versión y volver a aprobarlo', async () => {
    const { VERSIONES } = await import('../assets/js/domain/odt_afinia_rutas.js');
    const { literales } = await import('../assets/js/domain/odt_afinia_textos.js');
    assert.deepEqual(VERSIONES, { acuerdo: 'odt-acuerdo-v1', azt: 'odt-azt-v1', responsable: 'odt-resp-v1' });
    assert.deepEqual(literales(VERSIONES.acuerdo), [
      'Yo, ', ', con mi cuenta personal ',
      ', acepto firmar electrónicamente las ODT de Afinia en SGM. Mi firma solo se estampa desde mi propia cuenta y con mi contraseña personal, que no comparto.'
    ]);
    assert.deepEqual(literales(VERSIONES.azt), [
      'Yo, ', ', con mi cuenta personal ', ', declaro que revisé las dos páginas de la ODT N.º ',
      ' y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.'
    ]);
    assert.deepEqual(literales(VERSIONES.responsable), [
      'Yo, ', ', con mi cuenta personal ', ', declaro que revisé las dos páginas de la ODT N.º ',
      ', verifiqué la firma del AZT y, como RESPONSABLE O.D.T., la firmo y la cierro con fecha ',
      '. Esta firma equivale a mi firma manuscrita.'
    ]);
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

describe('Publicar: sin el aviso D5 de «5 minutos» (2026-11-21) y motivos en llano', () => {
  test('el aviso D5 salió: con la contraseña solo al iniciar sesión, esperar 5 minutos ya no impide firmar', () => {
    assert.equal(PUBLICAR.avisoSesionReciente, undefined, 'publicar.js ya no exporta el aviso');
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
