// Firma de ODT Afinia · MONTAJE de las vistas con el DOM mínimo y el repositorio sobre dobles
// de Firestore (sin navegador). Caza errores de ejecución en el camino vivo de cada vista y
// comprueba qué acciones ofrece cada persona según el turno (P1, D2, D3).
// Lo que NO cubre (necesita navegador): pdf.js (pintar, texto, tinta), pdf-lib cargado por
// fetch + import(), Firebase Auth real (reautenticación) y el panel «Mi firma».
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crearDomFalso, crearFirestoreFalso, BytesFalso, TS } from './odt_afinia_ui_dobles.js';
import { armarOdt, pngFirma, NRO, PDFLib } from './odt_afinia_fixture.js';
import { tokenFalso } from './odt_afinia_ui_dobles.js';
import { miFirmaOdt } from '../assets/js/data/odt_afinia_mi_firma.js';
import { prepararFirma } from '../assets/js/ui/odt-afinia/preparar.js';
import { fechaBogota } from '../assets/js/domain/odt_afinia_textos.js';
import { crearRepositorioOdt } from '../assets/js/data/odt_afinia.js';
import { validarOdt } from '../assets/js/domain/odt_afinia_formato.js';
import { prepararPartes } from '../assets/js/domain/odt_afinia_partes.js';

let guardado;
before(() => { guardado = globalThis.document; globalThis.document = crearDomFalso(); });
after(() => { if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado; });

const { montarBandeja } = await import('../assets/js/ui/odt-afinia/bandeja.js');
const { montarDetalle } = await import('../assets/js/ui/odt-afinia/detalle.js');
const { montarHabilitarme } = await import('../assets/js/ui/odt-afinia/habilitarme.js');
const { montarPublicar } = await import('../assets/js/ui/odt-afinia/publicar.js');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', correoPerfil: 'admin@prueba.test', rol: 'admin', esAdmin: true, legacy: false };
const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', correoPerfil: 'azt@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const RESP = { uid: 'uid-resp-prueba', nombre: 'Resp De Prueba', correoPerfil: 'resp@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const TERCERO = { ...AZT, uid: 'uid-tercero-prueba', nombre: 'Tercero De Prueba' };

async function base() {
  const fs = crearFirestoreFalso();
  for (const s of [AZT, RESP]) fs.poner('odt_afinia_firmantes/' + s.uid, { uid: s.uid, nombre: s.nombre, correo: s.correoPerfil, en: TS });
  fs.poner('odt_afinia_config/firmantes', { azt: [AZT.uid], responsable: [RESP.uid] });
  for (const s of [ADMIN, AZT, RESP]) fs.poner('usuarios/' + s.uid, { nombre: s.nombre, rol: s.rol, activo: true });
  const png = pngFirma(200, 80, 1);
  fs.poner('firmas/' + AZT.uid, { imagen: BytesFalso.fromUint8Array(png), huella: sha(png), en: TS });
  const pngR = pngFirma(180, 70, 2);
  fs.poner('firmas/' + RESP.uid, { imagen: BytesFalso.fromUint8Array(pngR), huella: sha(pngR), en: TS });
  const { bytes, estructura } = await armarOdt();
  const zonas = validarOdt(estructura, { nro: NRO }).zonas;
  const repo = (s) => crearRepositorioOdt({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
  const habs = await repo(ADMIN).listarHabilitados();
  const { id } = await repo(ADMIN).publicar({
    form: { nro: NRO, consignacion: '', subestacion: 'S/E Sintética', equipo: 'TR-Prueba', fechaTrabajo: '01/01/2026' },
    preparado: await prepararPartes(bytes), zonas,
    firmantes: { azt: habs.find((x) => x.uid === AZT.uid), responsable: habs.find((x) => x.uid === RESP.uid) }
  });
  return { fs, repo, id };
}
const caja = () => document.createElement('div');
const espera = () => new Promise((r) => setTimeout(r, 5));
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent.includes(texto));
/** Ningún resto de «null»/«undefined» pintado como texto (el navegador real los escribe; 99 §231.12). */
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}

describe('Bandeja', () => {
  test('el AZT ve la ODT en «Mi turno»; «Firmadas por mí» trae el aviso de suplantación', async () => {
    const { repo, id } = await base();
    const c = caja(); const abiertas = [];
    const r = await montarBandeja(c, { repo: repo(AZT), sesion: AZT, alAbrir: (x) => abiertas.push(x) });
    assert.equal(r.grupos.miTurno.length, 1);
    assert.ok(c.textContent.includes('ODT N.º ' + NRO));
    assert.ok(c.textContent.includes('Usted firma como AZT EN SITIO'));
    await boton(c, 'ODT N.º').disparar('click');
    assert.deepEqual(abiertas, [id]);
    await boton(c, 'Firmadas por mí').disparar('click');
    assert.ok(c.textContent.includes('Si ve aquí una ODT que usted no firmó'));
  });
  test('el Responsable la ve «En curso» (aún no es su turno); un tercero no ve nada', async () => {
    const { repo } = await base();
    const c = caja();
    const r = await montarBandeja(c, { repo: repo(RESP), sesion: RESP, alAbrir: () => {} });
    assert.equal(r.grupos.miTurno.length, 0); assert.equal(r.grupos.enCurso.length, 1);
    const r3 = await montarBandeja(caja(), { repo: repo(TERCERO), sesion: TERCERO, alAbrir: () => {} });
    assert.equal(r3.grupos.enCurso.length + r3.grupos.miTurno.length, 0);
  });
  test('un error de lectura se dice y ofrece «Reintentar» (no se pinta una bandeja vacía como si no hubiera nada)', async () => {
    const c = caja();
    const repoMalo = { listarBandeja: async () => { const e = new Error('La bandeja se está preparando'); throw e; } };
    await montarBandeja(c, { repo: repoMalo, sesion: AZT, alAbrir: () => {} });
    assert.ok(c.textContent.includes('se está preparando'));
    assert.ok(boton(c, 'Reintentar'));
  });
});

describe('Detalle de una ODT: acciones según quién y en qué paso', () => {
  test('AZT en su turno: Firmar (Preparar) y «No firmo»; sin Descargar ni Anular', async () => {
    const { repo, id } = await base();
    const c = caja();
    await montarDetalle(c, { repo: repo(AZT), cuenta: {}, sesion: AZT, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {} });
    const t = c.textContent;
    assert.ok(t.includes('Firmar como AZT EN SITIO'));
    assert.ok(boton(c, 'Preparar mi firma'));
    assert.ok(t.includes('No firmo: devolver con motivo'));
    assert.ok(t.includes('Constancia de firmas'));
    assert.ok(!t.includes('Descargar la ODT firmada'));
    assert.ok(!t.includes('Anular (administrador)'));
    assert.ok(!c.todos().some((x) => x.tagName === 'INPUT' && x.type === 'checkbox'), 'la declaración aparece solo después de Preparar');
    sinRestos(c);
  });
  test('Responsable antes del AZT: no puede firmar; ve la ODT en pantalla', async () => {
    const { repo, id } = await base();
    const c = caja();
    await montarDetalle(c, { repo: repo(RESP), cuenta: {}, sesion: RESP, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {} });
    assert.ok(!boton(c, 'Preparar mi firma'));
    assert.ok(boton(c, 'Ver la ODT en pantalla'));
  });
  test('administrador: puede anular (con confirmación en dos pasos) y no firma', async () => {
    const { repo, id, fs } = await base();
    const c = caja(); const cambios = [];
    await montarDetalle(c, { repo: repo(ADMIN), cuenta: {}, sesion: ADMIN, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: (m) => cambios.push(m) });
    assert.ok(!boton(c, 'Preparar mi firma'));
    const ta = c.todos().find((x) => x.tagName === 'TEXTAREA');
    ta.value = 'Motivo de anulación de prueba';
    const confirmar = boton(c, 'Sí, anularla');
    assert.equal(confirmar.hidden, true, 'la confirmación aparece solo tras el primer clic');
    await boton(c, 'Anular la ODT').disparar('click');
    assert.equal(confirmar.hidden, false);
    await confirmar.disparar('click');
    await espera();
    assert.equal(fs.store.get('odt_afinia/' + id).estado, 'ANULADA');
    assert.match(cambios[0], /anulada/);
  });
  test('un tercero no ve la ODT (el repositorio de dobles no evalúa reglas: aquí se mira que la vista no ofrezca acciones)', async () => {
    const { repo, id } = await base();
    const c = caja();
    await montarDetalle(c, { repo: repo(TERCERO), cuenta: {}, sesion: TERCERO, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {} });
    assert.ok(!boton(c, 'Preparar mi firma'));
    assert.ok(!c.textContent.includes('Anular (administrador)'));
  });
  test('si la huella del original no cuadra, no se muestra nada de la ODT', async () => {
    const { repo, id, fs } = await base();
    const malo = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
    fs.poner('odt_afinia/' + id + '/partes/0', { datos: BytesFalso.fromUint8Array(malo) });
    const c = caja();
    await montarDetalle(c, { repo: repo(AZT), cuenta: {}, sesion: AZT, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {} });
    assert.ok(!c.textContent.includes('Constancia de firmas'));
    assert.ok(!boton(c, 'Preparar mi firma'));
  });
});

describe('Habilitarme y Publicar', () => {
  test('habilitarme: con correo sin verificar ofrece el enlace y el acuerdo espera', async () => {
    const { repo } = await base();
    const c = caja();
    const fs2 = crearFirestoreFalso();
    const r = crearRepositorioOdt({ sdk: fs2.F, db: fs2.db, sesion: () => TERCERO });
    const cuenta = { estadoCuenta: async () => ({ correo: TERCERO.correoPerfil, verificado: false, proveedor: 'password' }) };
    await montarHabilitarme(c, { repo: r, cuenta, sesion: TERCERO, miFirmaOdt: async () => ({ hay: false }) });
    assert.ok(boton(c, 'Enviarme el enlace'));
    assert.ok(c.textContent.includes('Disponible cuando termine los pasos 1 y 2'));
    assert.ok(!c.todos().some((x) => x.tagName === 'INPUT' && x.type === 'checkbox'));
    void repo;
  });
  test('habilitarme: con correo verificado y contraseña cambiada aparece el acuerdo, con la casilla desmarcada', async () => {
    const c = caja();
    const fs2 = crearFirestoreFalso();
    const r = crearRepositorioOdt({ sdk: fs2.F, db: fs2.db, sesion: () => TERCERO });
    const cuenta = { estadoCuenta: async () => ({ correo: TERCERO.correoPerfil, verificado: true, proveedor: 'password' }) };
    await montarHabilitarme(c, { repo: r, cuenta, sesion: TERCERO, miFirmaOdt: async () => ({ hay: false }) });
    await boton(c, 'Ya la cambié').disparar('click');
    await espera();
    const casilla = c.todos().find((x) => x.tagName === 'INPUT' && x.type === 'checkbox');
    assert.ok(casilla, 'aparece la casilla del acuerdo');
    assert.equal(casilla.checked, false);
    assert.ok(c.textContent.includes('acepto firmar electrónicamente las ODT de Afinia en SGM'));
    assert.ok(c.textContent.includes('En la ODT solo se estampa su firma, desde su cuenta.'));
  });
  test('habilitado y con firma posterior: «Está habilitado y su firma está lista»', async () => {
    const { repo } = await base();
    const c = caja();
    const cuenta = { estadoCuenta: async () => ({ correo: AZT.correoPerfil, verificado: true, proveedor: 'password' }) };
    await montarHabilitarme(c, { repo: repo(AZT), cuenta, sesion: AZT, miFirmaOdt: async () => ({ hay: true, enMs: Date.now() + 1e9 }) });
    assert.ok(c.textContent.includes('Está habilitado y su firma está lista'));
  });
  test('publicar: un técnico no ve el formulario; el admin sin perfil tampoco', async () => {
    const c = caja();
    await montarPublicar(c, { repo: {}, sesion: AZT, alPublicar: () => {} });
    assert.ok(c.textContent.includes('Solo un administrador'));
    const c2 = caja();
    await montarPublicar(c2, { repo: {}, sesion: { ...ADMIN, legacy: true }, alPublicar: () => {} });
    assert.ok(c2.textContent.includes('no tiene perfil'));
  });
  test('publicar (admin): ofrece elegir el PDF y no pide contraseña', async () => {
    const c = caja();
    await montarPublicar(c, { repo: {}, sesion: ADMIN, alPublicar: () => {} });
    assert.ok(c.textContent.includes('Elegir el PDF de la ODT'));
    assert.ok(!c.todos().some((x) => x.tagName === 'INPUT' && x.type === 'password'));
    sinRestos(c);
  });
});

const { montarOdtAfinia } = await import('../assets/js/ui/odt-afinia/app.js');
describe('Arranque (app.js)', () => {
  async function arrancar(perfil) {
    const g = { window: globalThis.window, location: globalThis.location, sesion: globalThis.__sgmSession };
    const escuchas = [];
    globalThis.window = { __sgmSession: { user: { uid: perfil.uid }, profile: { nombre: perfil.nombre, email: perfil.correoPerfil, rol: perfil.rol, activo: true }, role: perfil.rol }, addEventListener: (t) => escuchas.push(t) };
    globalThis.__sgmSession = globalThis.window.__sgmSession;
    globalThis.location = { hash: '' };
    try {
      const raiz = caja(); const franja = caja();
      const r = await montarOdtAfinia(raiz, { franja });
      return { raiz, franja, r, escuchas };
    } finally {
      for (const [k, v] of [['window', g.window], ['location', g.location], ['__sgmSession', g.sesion]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    }
  }
  test('técnico: sin franja de vista previa (publicada, 99 §231.15) y dos vistas (sin «Publicar»)', async () => {
    const { raiz, franja, escuchas } = await arrancar(AZT);
    assert.equal(franja.textContent, '', 'publicada: la franja queda vacía (ningún aviso de vista previa, con cualquier redacción)');
    const nav = raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent);
    assert.deepEqual(nav, ['Bandeja', 'Habilitarme y Mi firma']);
    assert.ok(escuchas.includes('hashchange'));
  });
  test('administrador: tres vistas (con «Publicar ODT»)', async () => {
    const { raiz } = await arrancar(ADMIN);
    assert.deepEqual(raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent), ['Bandeja', 'Habilitarme y Mi firma', 'Publicar ODT']);
  });
});

/** Firma de punta a punta con el repositorio sobre dobles (como en la pantalla, sin pdf.js). */
async function firmarComo(fs, repo, s, id, extra = {}) {
  const r = repo(s);
  const { odt, bytesV0 } = await r.leerOdt(id);
  const c = await prepararFirma({
    odt, bytesV0, actos: await r.leerActos(id), sesion: s, correo: s.correoPerfil,
    miFirma: await miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => s }), habilitacion: await r.leerHabilitacion(), PDFLib, ...extra
  });
  await r.firmar(c, tokenFalso({ uid: s.uid, email: s.correoPerfil }));
  return c;
}

describe('contrato nuevo en pantalla (D6, Ver verificado, bandeja)', () => {
  const detalle = (repo, s, id, extra = {}) => {
    const c = caja();
    return montarDetalle(c, { repo, cuenta: {}, sesion: s, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {}, pdfLib: async () => PDFLib, ...extra }).then(() => c);
  };
  test('D6: el administrador NO ve «Anular» en una ODT LISTA (sí mientras falte una firma)', async () => {
    const { fs, repo, id } = await base();
    await firmarComo(fs, repo, AZT, id);
    const c1 = await detalle(repo(ADMIN), ADMIN, id);
    assert.ok(c1.textContent.includes('Anular (administrador)'), 'PENDIENTE_RESPONSABLE: se puede anular');
    await firmarComo(fs, repo, RESP, id, { fechaCierre: fechaBogota() });
    assert.equal(fs.store.get('odt_afinia/' + id).estado, 'LISTA');
    const c2 = await detalle(repo(ADMIN), ADMIN, id);
    assert.ok(!c2.textContent.includes('Anular (administrador)'));
    assert.ok(!boton(c2, 'Anular la ODT'));
    assert.ok(boton(c2, 'Descargar la ODT firmada'));
  });
  test('«Ver la ODT»: se pinta lo compuesto con la huella que vieron los firmantes; si no cuadra, no se pinta', async () => {
    const { fs, repo, id } = await base();
    const cAzt = await firmarComo(fs, repo, AZT, id);
    const pintados = [];
    const pintar = async (bytes, zona, op) => { pintados.push({ hx: sha(bytes), op }); return { paginas: 2 }; };
    const c = await detalle(repo(ADMIN), ADMIN, id, { pintar });
    await boton(c, 'Ver la ODT en pantalla').disparar('click');
    assert.equal(pintados.length, 1);
    assert.equal(pintados[0].hx, cAzt.huellaVista, 'los bytes pintados son los que vio el AZT');
    assert.equal(pintados[0].op.huella, cAzt.huellaVista, 'y la vista muestra esa huella');
    const ruta = 'odt_afinia/' + id + '/actos/azt';
    fs.poner(ruta, { ...fs.store.get(ruta), huellaVista: '0'.repeat(64) });
    const c2 = await detalle(repo(ADMIN), ADMIN, id, { pintar });
    await boton(c2, 'Ver la ODT en pantalla').disparar('click');
    assert.equal(pintados.length, 1, 'no se pintó nada');
    assert.ok(c2.textContent.includes('no sale lo que el AZT vio'));
  });
  test('«No firmo»: la devolución va con el id del turno (rol_rev) y no se ofrece otra', async () => {
    const { fs, repo, id } = await base();
    const cambios = [];
    const c = await detalle(repo(AZT), AZT, id, { alCambiar: (m) => cambios.push(m) });
    c.todos().find((x) => x.tagName === 'TEXTAREA').value = 'La consignación no corresponde.';
    await boton(c, 'Devolver sin firmar').disparar('click');
    assert.ok(fs.store.get('odt_afinia/' + id + '/devoluciones/azt_0'));
    assert.match(cambios[0], /devolución/);
    const c2 = await detalle(repo(AZT), AZT, id);
    assert.ok(!boton(c2, 'Devolver sin firmar'));
    assert.ok(c2.textContent.includes('Ya devolvió esta ODT en este turno'));
  });
  test('la Constancia DICE si no pudo leer las devoluciones', async () => {
    const { repo, id } = await base();
    const r = repo(AZT);
    const malo = { ...r, leerDevoluciones: async () => { throw new Error('sin red de prueba'); } };
    const c = await detalle(malo, AZT, id);
    assert.ok(c.textContent.includes('No se pudieron leer las devoluciones'));
    assert.ok(c.textContent.includes('sin red de prueba'));
  });
  test('bandeja: estado cero sin habilitación orienta a «Habilitarme y Mi firma»', async () => {
    const { repo } = await base();
    const c = caja();
    await montarBandeja(c, { repo: repo(TERCERO), sesion: TERCERO, alAbrir: () => {} });
    assert.ok(c.textContent.includes('Aún no está habilitado para firmar'));
    assert.ok(c.todos().some((x) => x.tagName === 'A' && x.getAttribute('href') === '#habilitarme'));
    const c2 = caja();
    await montarBandeja(c2, { repo: repo(AZT), sesion: AZT, alAbrir: () => {} });
    assert.ok(!c2.textContent.includes('Aún no está habilitado'));
  });
  test('bandeja: «Firmadas por mí» lee cada acto UNA vez aunque se abra la pestaña varias veces', async () => {
    const { fs, repo, id } = await base();
    await firmarComo(fs, repo, AZT, id);
    const r = repo(AZT); let lecturas = 0;
    const contado = { ...r, leerActo: (...a) => { lecturas++; return r.leerActo(...a); } };
    const c = caja();
    await montarBandeja(c, { repo: contado, sesion: AZT, alAbrir: () => {} });
    for (let i = 0; i < 3; i++) { await boton(c, 'Firmadas por mí').disparar('click'); await espera(); }
    assert.equal(lecturas, 1);
  });
});
