// Firma de ODT Afinia · MONTAJE de las vistas con el DOM mínimo y el repositorio sobre dobles
// de Firestore (sin navegador). Caza errores de ejecución en el camino vivo de cada vista y
// comprueba qué acciones ofrece cada persona según el turno (P1, D2, D3). Desde el 2026-11-21, también
// el pie de cierre fijo del Responsable, Reemplazar y Registrar cierre en Afinia (admin, LISTA), la
// pestaña «Cerradas» y que ninguna vista nueva deje restos «null» pintados.
// Decisión del Ingeniero del 2026-11-21 («la contraseña solo al iniciar sesión»): Firmar se monta sin campo de
// contraseña ni casilla: «Preparar mi firma» → «Firmar» → «Confirmar firma», con el token de la sesión (sin
// reautenticar), un solo envío y sin restos «null». La habilitación conserva su casilla y su contraseña.
// La pestaña «Por subsanar» (2026-11-21) se monta con sus datos en tests/odt_afinia_obs_ui.test.js; aquí solo su lugar en el menú.
// Lo que NO cubre (necesita navegador): pdf.js (pintar, texto, tinta), pdf-lib cargado por
// fetch + import(), Firebase Auth real (reautenticación al habilitarse) y el panel «Mi firma».
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crearDomFalso, crearFirestoreFalso, BytesFalso, TS } from './odt_afinia_ui_dobles.js';
import { armarOdt, pngFirma, NRO, PDFLib } from './odt_afinia_fixture.js';
import { tokenFalso } from './odt_afinia_ui_dobles.js';
import { miFirmaOdt } from '../assets/js/data/odt_afinia_mi_firma.js';
import { prepararFirma } from '../assets/js/ui/odt-afinia/preparar.js';
import { fechaBogota, declaracionAzt } from '../assets/js/domain/odt_afinia_textos.js';
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
  test('habilitarme: con correo verificado y contraseña cambiada aparece el acuerdo, con la casilla desmarcada y la contraseña', async () => {
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
    // La habilitación SÍ sigue pidiendo la contraseña (2026-11-21: solo la firma dejó de pedirla).
    assert.ok(c.todos().some((x) => x.tagName === 'INPUT' && x.type === 'password'), 'campo de contraseña del acuerdo');
    assert.ok(c.textContent.includes('se le pide para aceptar el acuerdo'));
    assert.ok(!c.textContent.includes('en cada firma'));
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
  test('técnico: sin franja de vista previa (publicada, 99 §231.15) y dos vistas (sin «Publicar» ni, sin ODT asignadas, «Por subsanar»)', async () => {
    const { raiz, franja, escuchas } = await arrancar(AZT);
    assert.equal(franja.textContent, '', 'publicada: la franja queda vacía (ningún aviso de vista previa, con cualquier redacción)');
    const nav = raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent);
    assert.deepEqual(nav, ['Bandeja', 'Habilitarme y Mi firma']);
    assert.ok(escuchas.includes('hashchange'));
  });
  test('administrador: cuatro vistas (con «Publicar ODT» y, desde el 2026-11-21, «Por subsanar»)', async () => {
    const { raiz } = await arrancar(ADMIN);
    // Sin Firestore (Node) el contador no llega: la pestaña sale sin número. Con datos: tests/odt_afinia_obs_ui.test.js.
    assert.deepEqual(raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent), ['Bandeja', 'Habilitarme y Mi firma', 'Publicar ODT', 'Por subsanar']);
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
    await firmarComo(fs, repo, RESP, id);
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
    // 2026-11-21: la columna es «Sesión iniciada» (la firma ya no pide la contraseña).
    const ths = c.todos().filter((x) => x.tagName === 'TH').map((x) => x.textContent);
    assert.ok(ths.includes('Sesión iniciada'), ths.join(' | '));
    assert.ok(!ths.some((t) => /contraseña/i.test(t)), ths.join(' | '));
    const fila = c.todos().filter((x) => x.tagName === 'TD').map((x) => x.textContent);
    // Columnas: N.º · Firmé como · Fecha y hora de la firma · Sesión iniciada · (botón).
    assert.equal(ths.indexOf('Sesión iniciada'), 3);
    assert.match(fila[3], /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/, 'la hora del inicio de sesión se muestra: ' + fila.join(' | '));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Decisiones del 2026-11-21 en pantalla: pie de cierre fijo, Reemplazar, Registrar cierre en Afinia, bandeja.
// ═════════════════════════════════════════════════════════════════════════════
describe('pie de cierre, reemplazo y cierre en Afinia en pantalla (sin restos «null»)', () => {
  const detalle = (repo, s, id, extra = {}) => {
    const c = caja();
    return montarDetalle(c, { repo, cuenta: {}, sesion: s, odtId: id, miFirmaOdt: async () => ({ hay: false }), alVolver: () => {}, alCambiar: () => {}, pdfLib: async () => PDFLib, ...extra }).then(() => c);
  };
  async function lista() {
    const b = await base();
    await firmarComo(b.fs, b.repo, AZT, b.id);
    await firmarComo(b.fs, b.repo, RESP, b.id);
    assert.equal(b.fs.store.get('odt_afinia/' + b.id).estado, 'LISTA');
    return b;
  }
  const SOPORTE_PRUEBA = 'SOPORTE_ODT_PRUEBA_01';

  test('Firmar (Responsable): la FECHA CIERRE se muestra fija = la prevista, con «ODT GENERADA N° …»; no hay campo que editar', async () => {
    const { fs, repo, id } = await base();
    await firmarComo(fs, repo, AZT, id);
    const c = await detalle(repo(RESP), RESP, id);
    const t = c.textContent;
    assert.ok(t.includes('Firmar como RESPONSABLE O.D.T.'));
    assert.ok(t.includes('FECHA CIERRE'));
    assert.ok(t.includes('01/01/2026 (fecha prevista de la orden)'));
    // «ODT GENERADA N°» UNA sola vez en el pie: su fila dt/dd con el N.º (antes salía también en un párrafo repetido).
    const gen = c.querySelectorAll('.odt-generada');
    assert.equal(gen.length, 1);
    assert.deepEqual(gen[0].todos().filter((x) => x.tagName === 'DT' || x.tagName === 'DD').map((x) => x.textContent), ['ODT GENERADA N°', NRO]);
    assert.equal(t.split('ODT GENERADA N°').length - 1, 1, 'el dato no se repite en la pantalla de firma');
    assert.ok(t.includes('¿SE CIERRA LA ODT?'));
    assert.ok(!c.todos().some((x) => x.tagName === 'INPUT' && x.id === 'odtFechaCierre'), 'la fecha de cierre ya no se edita');
    assert.ok(!t.includes('Fecha del trabajo'));
    assert.ok(t.includes('Fecha prevista de la orden'));
    // Con la fecha prevista ya cumplida (01/01/2026), «Preparar mi firma» está disponible y no hay aviso de espera.
    assert.equal(boton(c, 'Preparar mi firma').disabled, false);
    assert.ok(!t.includes('Todavía no puede firmar'));
    sinRestos(c);
  });
  test('Firmar (Responsable) antes de la fecha prevista: «Preparar mi firma» deshabilitado y se le dice desde cuándo podrá firmar', async () => {
    const { fs, repo, id } = await base();
    await firmarComo(fs, repo, AZT, id);
    const ruta = 'odt_afinia/' + id;
    fs.poner(ruta, { ...fs.store.get(ruta), fechaTrabajo: '31/12/2099' });
    const c = await detalle(repo(RESP), RESP, id);
    const t = c.textContent;
    const btn = boton(c, 'Preparar mi firma');
    assert.ok(btn, 'el botón se ve (para que sepa dónde firmará)');
    assert.equal(btn.disabled, true, 'pero no se ofrece mientras no llegue la fecha');
    assert.ok(t.includes('Todavía no puede firmar: la fecha prevista de la orden es el 31/12/2099. Podrá firmar y cerrar la ODT desde ese día.'));
    assert.ok(!t.includes('el Responsable firma y cierra'), 'le habla a él (no en tercera persona)');
    // Aunque le llegue un clic (el doble de DOM no respeta disabled), no se lee nada ni se prepara.
    let consultas = 0;
    const cuenta = { uidVivo: async () => { consultas += 1; return RESP.uid; } };
    const c2 = await detalle(repo(RESP), RESP, id, { cuenta });
    await boton(c2, 'Preparar mi firma').disparar('click');
    await espera();
    assert.equal(consultas, 0, 'ni siquiera se consulta la cuenta');
    assert.ok(!c2.textContent.includes('Preparando'));
    sinRestos(c);
  });
  test('Firmar (AZT): sin pie de cierre (es del Responsable)', async () => {
    const { repo, id } = await base();
    const c = await detalle(repo(AZT), AZT, id);
    assert.ok(!c.textContent.includes('ODT GENERADA N°'));
    assert.ok(!c.textContent.includes('FECHA CIERRE'));
    sinRestos(c);
  });
  test('LISTA (admin): ofrece «Registrar cierre en Afinia» y «Reemplazar»; un técnico firmante no los ve', async () => {
    const { repo, id } = await lista();
    const c = await detalle(repo(ADMIN), ADMIN, id);
    assert.ok(c.textContent.includes('Reemplazar (administrador)'));
    assert.ok(c.textContent.includes('Registrar cierre en Afinia (administrador)'));
    assert.ok(boton(c, 'Descargar la ODT firmada'));
    sinRestos(c);
    const c2 = await detalle(repo(AZT), AZT, id);
    assert.ok(!c2.textContent.includes('Reemplazar (administrador)'));
    assert.ok(!c2.textContent.includes('Registrar cierre en Afinia'));
    assert.ok(boton(c2, 'Descargar la ODT firmada'));
  });
  test('Reemplazar: confirmación en dos pasos y motivo; queda REEMPLAZADA, con su motivo a la vista y sin Descargar', async () => {
    const { fs, repo, id } = await lista();
    const cambios = [];
    const c = await detalle(repo(ADMIN), ADMIN, id, { alCambiar: (m) => cambios.push(m) });
    c.todos().find((x) => x.tagName === 'TEXTAREA' && x.id === 'odtMotivoReemplazar').value = 'La consignación del PDF no era la correcta.';
    const confirmar = boton(c, 'Sí, reemplazarla');
    assert.equal(confirmar.hidden, true, 'la confirmación aparece solo tras el primer clic');
    await boton(c, 'Reemplazar la ODT').disparar('click');
    assert.equal(confirmar.hidden, false);
    assert.ok(c.textContent.includes('No se borra nada'));
    await confirmar.disparar('click');
    await espera();
    assert.equal(fs.store.get('odt_afinia/' + id).estado, 'REEMPLAZADA');
    assert.match(cambios[0], /reemplazada/);
    const c2 = await detalle(repo(ADMIN), ADMIN, id);
    const t = c2.textContent;
    assert.ok(t.includes('Reemplazada'));
    assert.ok(t.includes('La consignación del PDF no era la correcta.'), 'el motivo se ve');
    assert.ok(!boton(c2, 'Descargar la ODT firmada'), 'una REEMPLAZADA no se descarga');
    assert.ok(!t.includes('Reemplazar (administrador)') && !t.includes('Registrar cierre en Afinia') && !t.includes('Anular (administrador)'));
    assert.ok(boton(c2, 'Ver la ODT en pantalla'), 'se sigue pudiendo ver');
    sinRestos(c2);
    // «Ver la ODT»: su título no manda a «Descargar» (no existe para una REEMPLAZADA); el de una LISTA sí.
    const titulos = [];
    const pintar = async (bytes, zona, o) => { titulos.push(o.titulo); return { paginas: 2 }; };
    const c3 = await detalle(repo(ADMIN), ADMIN, id, { pintar });
    await boton(c3, 'Ver la ODT en pantalla').disparar('click');
    await espera();
    assert.equal(titulos.length, 1);
    assert.ok(!titulos[0].includes('Descargar'), titulos[0]);
    assert.match(titulos[0], /versión reemplazada: se conserva para consulta; ya no se entrega ni se descarga/);
    const otra = await lista();
    const c4 = await detalle(otra.repo(ADMIN), ADMIN, otra.id, { pintar });
    await boton(c4, 'Ver la ODT en pantalla').disparar('click');
    await espera();
    assert.match(titulos[1], /para entregarla, use «Descargar»/, 'control: una LISTA sí manda a Descargar');
  });
  test('Registrar cierre en Afinia: valida, confirma y queda CERRADA; el detalle y la constancia lo dicen; se sigue descargando', async () => {
    const { fs, repo, id } = await lista();
    const cambios = [];
    const c = await detalle(repo(ADMIN), ADMIN, id, { alCambiar: (m) => cambios.push(m) });
    const soporte = c.todos().find((x) => x.tagName === 'INPUT' && x.id === 'odtSoporteAfinia');
    const fecha = c.todos().find((x) => x.tagName === 'INPUT' && x.id === 'odtFechaCierreAfinia');
    assert.equal(fecha.value, fechaBogota(), 'propone la fecha de hoy');
    const confirmar = boton(c, 'Sí, registrar el cierre');
    soporte.value = 'ab';
    await boton(c, 'Registrar cierre en Afinia').disparar('click');
    assert.equal(confirmar.hidden, true, 'con un soporte corto no se ofrece confirmar');
    assert.ok(c.textContent.includes('Escriba el soporte'));
    soporte.value = SOPORTE_PRUEBA;
    await boton(c, 'Registrar cierre en Afinia').disparar('click');
    assert.equal(confirmar.hidden, false);
    await confirmar.disparar('click');
    await espera();
    const o = fs.store.get('odt_afinia/' + id);
    assert.equal(o.estado, 'CERRADA');
    assert.equal(o.cierreAfinia.soporte, SOPORTE_PRUEBA);
    assert.match(cambios[0], /cerrada en Afinia/);
    const c2 = await detalle(repo(RESP), RESP, id);
    const texto = 'Cerrada en Afinia el ' + fechaBogota() + ' · soporte ' + SOPORTE_PRUEBA + ' · registró ' + ADMIN.nombre;
    assert.ok(c2.querySelectorAll('.odt-cerrada').length >= 2, 'en el detalle y en la constancia');
    for (const el of c2.querySelectorAll('.odt-cerrada')) assert.ok(el.textContent.includes(texto), el.textContent);
    assert.ok(boton(c2, 'Descargar la ODT firmada'), 'una CERRADA se descarga');
    const c3 = await detalle(repo(ADMIN), ADMIN, id);
    assert.ok(!c3.textContent.includes('Reemplazar (administrador)'), 'una CERRADA no se reemplaza');
    assert.ok(!c3.textContent.includes('Registrar cierre en Afinia (administrador)'));
    sinRestos(c2); sinRestos(c3);
  });
  test('bandeja: CERRADA en «Cerradas»; REEMPLAZADA en «Anuladas y reemplazadas»', async () => {
    const { fs, repo, id } = await lista();
    await repo(ADMIN).registrarCierreAfinia(id, { fecha: fechaBogota(), soporte: SOPORTE_PRUEBA });
    const c = caja();
    const r = await montarBandeja(c, { repo: repo(AZT), sesion: AZT, alAbrir: () => {} });
    assert.equal(r.grupos.cerradas.length, 1);
    assert.equal(r.grupos.listas.length, 0);
    await boton(c, 'Cerradas').disparar('click');
    assert.ok(c.textContent.includes('Cerrada en Afinia'));
    assert.ok(c.textContent.includes('prevista 01/01/2026'));
    sinRestos(c);
    // Otra LISTA, reemplazada.
    const b = await lista();
    await b.repo(ADMIN).reemplazar(b.id, 'La consignación del PDF no era la correcta.');
    const c2 = caja();
    const r2 = await montarBandeja(c2, { repo: b.repo(AZT), sesion: AZT, alAbrir: () => {} });
    assert.equal(r2.grupos.anuladas.length, 1);
    await boton(c2, 'Anuladas y reemplazadas').disparar('click');
    assert.ok(c2.textContent.includes('Reemplazada'));
    sinRestos(c2);
    void fs;
  });
  test('bandeja: abrir «Cerradas» sin ODT cerradas muestra su vacío (la guarda «|| []» la mira la prueba estática)', async () => {
    const { repo } = await base();
    const c = caja();
    await montarBandeja(c, { repo: repo(AZT), sesion: AZT, alAbrir: () => {}, pestana: 'cerradas' });
    assert.ok(c.textContent.includes('No hay ODT cerradas en Afinia.'));
    sinRestos(c);
  });
  test('la ODT publicada sobre un N.º reemplazado dice «Reemplaza a la versión publicada el …»', async () => {
    const { fs, repo, id } = await lista();
    await repo(ADMIN).reemplazar(id, 'La consignación del PDF no era la correcta.');
    const { bytes, estructura } = await armarOdt();
    const zonas = validarOdt(estructura, { nro: NRO }).zonas;
    const habs = await repo(ADMIN).listarHabilitados();
    const { id: nueva } = await repo(ADMIN).publicar({
      form: { nro: NRO, consignacion: '', subestacion: 'S/E Sintética', equipo: 'TR-Prueba', fechaTrabajo: '01/01/2026' },
      preparado: await prepararPartes(bytes), zonas,
      firmantes: { azt: habs.find((x) => x.uid === AZT.uid), responsable: habs.find((x) => x.uid === RESP.uid) }
    });
    assert.equal(fs.store.get('odt_afinia/' + nueva).reemplaza, id);
    const c = await detalle(repo(ADMIN), ADMIN, nueva);
    assert.ok(c.textContent.includes('Reemplaza a la versión publicada el '), c.textContent.slice(0, 300));
    sinRestos(c);
    // Si quien la abre no puede leer la anterior, queda el texto general (sin fecha).
    const r = repo(AZT);
    const sinLeer = { ...r, leerOdtDoc: async (x) => { if (x === id) throw new Error('sin permiso de prueba'); return r.leerOdtDoc(x); } };
    const c2 = await detalle(sinLeer, AZT, nueva);
    assert.ok(c2.textContent.includes('Reemplaza a una versión anterior publicada con el mismo N.º.'));
    sinRestos(c2);
  });
  test('un repositorio viejo de la caché (sin reemplazar ni registrarCierreAfinia): se pide recargar en lugar de romper', async () => {
    const { repo, id } = await lista();
    const r = repo(ADMIN);
    const viejo = { ...r }; delete viejo.reemplazar; delete viejo.registrarCierreAfinia;
    const c = await detalle(viejo, ADMIN, id);
    assert.ok(c.textContent.includes('Reemplazar (administrador)'));
    assert.ok(c.textContent.includes('Recargue con Cmd + Shift + R'));
    assert.ok(!boton(c, 'Reemplazar la ODT'));
    sinRestos(c);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Decisión del Ingeniero del 2026-11-21: firmar sin volver a escribir la contraseña.
// «Preparar mi firma» (igual que antes) → «Firmar» → «Confirmar firma» (+ «Cancelar») → lote.
// ═════════════════════════════════════════════════════════════════════════════
const { montarFirmar } = await import('../assets/js/ui/odt-afinia/firmar.js');
describe('Firmar sin contraseña: Preparar → Firmar → Confirmar firma', () => {
  const HORA = 3600e3;
  /** Monta Firmar con dobles: la cuenta NO deja reautenticar (si se llamara, la prueba lo vería). */
  async function montar(s, b, { token, ...extra } = {}) {
    const r = b.repo(s);
    const { odt, bytesV0 } = await r.leerOdt(b.id);
    const actos = await r.leerActos(b.id);
    const c = caja(); const hechos = []; const pintados = []; const pedidos = []; const reaut = [];
    const cuenta = {
      uidVivo: async () => s.uid,
      estadoCuenta: async () => ({ uid: s.uid, correo: s.correoPerfil, verificado: true, proveedor: 'password' }),
      reautenticar: async (...a) => { reaut.push(a); throw new Error('firmar NO debe pedir la contraseña'); }
    };
    // Por defecto, una sesión abierta hace 6 h (antes de publicar): ya no importa (2026-11-21).
    const tk = token || tokenFalso({ uid: s.uid, email: s.correoPerfil, ahoraMs: Date.now() - 6 * HORA });
    const sesionFirma = { tokenVigente: async (op) => { pedidos.push(op); return tk; } };
    montarFirmar(c, {
      repo: r, cuenta, sesion: s, odt, bytesV0, actos, alFirmar: (m) => hechos.push(m),
      miFirmaOdt: () => miFirmaOdt({ sdk: b.fs.F, db: b.fs.db, sesion: () => s }),
      sesionFirma, pdfLib: async () => PDFLib, pintar: async (bytes, zona, o) => { pintados.push({ hx: sha(bytes), o }); return { paginas: 2 }; },
      ...extra
    });
    return { c, hechos, pintados, pedidos, reaut, tk };
  }
  const exacto = (el, t) => botones(el).find((x) => x.textContent === t);
  const sinCampos = (el) => !el.todos().some((x) => x.tagName === 'INPUT');

  test('AZT: sin campo de contraseña ni casilla; «Firmar» → «Confirmar firma» / «Cancelar»; un solo lote, con el inicio de sesión', async () => {
    const b = await base();
    const m = await montar(AZT, b);
    const { c } = m;
    assert.ok(exacto(c, 'Preparar mi firma'));
    assert.ok(!exacto(c, 'Firmar'), '«Firmar» aparece solo después de preparar');
    assert.ok(c.textContent.includes('pulse «Firmar» y después «Confirmar firma»'));
    assert.ok(!/escriba su contraseña/i.test(c.textContent));
    assert.ok(sinCampos(c));
    sinRestos(c);

    await exacto(c, 'Preparar mi firma').disparar('click');
    assert.equal(m.pintados.length, 1, 'se muestra la ODT con su firma');
    const decl = declaracionAzt({ nombre: AZT.nombre, correo: AZT.correoPerfil, nro: NRO });
    assert.ok(c.textContent.includes(decl), 'la declaración completa, tal cual se guarda');
    assert.ok(sinCampos(c), 'ni contraseña ni casilla');
    const firmar = exacto(c, 'Firmar'); const confirmar = exacto(c, 'Confirmar firma'); const cancelar = exacto(c, 'Cancelar');
    assert.ok(firmar && confirmar && cancelar);
    const cajaConfirmar = c.querySelectorAll('.odt-confirmar')[0];
    assert.equal(cajaConfirmar.hidden, true, '«Confirmar firma» aún no se ve');
    sinRestos(c);

    const antes = b.fs.lotes.length;
    await firmar.disparar('click');
    assert.equal(cajaConfirmar.hidden, false);
    assert.ok(cajaConfirmar.textContent.includes('Al confirmar, acepta la declaración de arriba y su firma queda registrada.'));
    await cancelar.disparar('click');
    assert.equal(cajaConfirmar.hidden, true, '«Cancelar» vuelve atrás');
    assert.equal(b.fs.lotes.length, antes, 'ni «Firmar» ni «Cancelar» escriben');
    await firmar.disparar('click');
    // Doble clic: un solo envío.
    await Promise.all([confirmar.disparar('click'), confirmar.disparar('click')]);
    assert.equal(b.fs.lotes.length, antes + 1, 'un solo lote');
    assert.deepEqual(m.pedidos, [{ uidEsperado: AZT.uid }], 'el token de la sesión, una vez');
    assert.deepEqual(m.reaut, [], 'no se llamó a reautenticar');
    assert.deepEqual(m.hechos, ['Su firma quedó registrada en la ODT N.º ' + NRO + '.']);
    const [acto, upd] = b.fs.lotes.at(-1).ops;
    assert.equal(acto.ruta, 'odt_afinia/' + b.id + '/actos/azt');
    assert.equal(acto.datos.authTime, m.tk.auth_time, 'authTime = el inicio de la sesión (solo registro)');
    assert.equal(acto.datos.declaracion, decl);
    assert.deepEqual(upd.datos, { estado: 'PENDIENTE_RESPONSABLE', rev: 1 });
    // Firmada: nada más se ofrece.
    assert.equal(confirmar.disabled, true); assert.equal(firmar.disabled, true);
    assert.equal(exacto(c, 'Cambiar algo y volver a preparar').disabled, true);
    sinRestos(c);
  });

  test('Responsable: con una sesión abierta ANTES de publicar y antes de la firma del AZT, firma → LISTA (sin contraseña)', async () => {
    const b = await base();
    await firmarComo(b.fs, b.repo, AZT, b.id);
    const odt = await b.repo(RESP).leerOdtDoc(b.id);
    const tk = tokenFalso({ uid: RESP.uid, email: RESP.correoPerfil, ahoraMs: odt.publicadoEnMs - 2 * HORA });
    const m = await montar(RESP, b, { token: tk });
    await exacto(m.c, 'Preparar mi firma').disparar('click');
    assert.ok(m.c.textContent.includes('declaro que revisé las dos páginas de la ODT N.º ' + NRO + ', verifiqué la firma del AZT'));
    assert.ok(sinCampos(m.c));
    await exacto(m.c, 'Firmar').disparar('click');
    await exacto(m.c, 'Confirmar firma').disparar('click');
    assert.deepEqual(m.reaut, []);
    assert.equal(b.fs.store.get('odt_afinia/' + b.id).estado, 'LISTA');
    assert.equal(b.fs.store.get('odt_afinia/' + b.id + '/actos/responsable').authTime, tk.auth_time);
    sinRestos(m.c);
  });

  test('la sesión no sirve (no abierta con contraseña, correo sin verificar u otro correo): se dice en llano y NO se escribe', async () => {
    for (const [cambio, texto] of [
      [{ sign_in_provider: 'google.com' }, 'su sesión debe abrirse con su correo y contraseña'],
      [{ email_verified: false }, 'Su correo no está verificado'],
      [{ email: 'otro@prueba.test' }, 'El correo de su sesión no coincide']
    ]) {
      const b = await base();
      const tk = { ...tokenFalso({ uid: AZT.uid, email: AZT.correoPerfil }), ...cambio };
      const m = await montar(AZT, b, { token: tk });
      await exacto(m.c, 'Preparar mi firma').disparar('click');
      const antes = b.fs.lotes.length;
      await exacto(m.c, 'Firmar').disparar('click');
      await exacto(m.c, 'Confirmar firma').disparar('click');
      assert.equal(b.fs.lotes.length, antes, JSON.stringify(cambio) + ': no se escribe');
      assert.ok(m.c.textContent.includes(texto), JSON.stringify(cambio) + ': ' + texto);
      assert.deepEqual(m.hechos, []);
      assert.equal(exacto(m.c, 'Confirmar firma').disabled, false, 'se puede corregir y reintentar');
      assert.equal(exacto(m.c, 'Cambiar algo y volver a preparar').disabled, false);
      sinRestos(m.c);
    }
  });

  test('lote sin respuesta: «NO repita» y nada se puede volver a pulsar', async () => {
    const b = await base();
    const m = await montar(AZT, b);
    await exacto(m.c, 'Preparar mi firma').disparar('click');
    b.fs.opciones.colgarLote = true;
    await exacto(m.c, 'Firmar').disparar('click');
    await exacto(m.c, 'Confirmar firma').disparar('click');
    assert.ok(m.c.textContent.includes('NO repita'));
    assert.equal(exacto(m.c, 'Confirmar firma').disabled, true);
    assert.equal(exacto(m.c, 'Cambiar algo y volver a preparar').disabled, true);
    assert.deepEqual(m.hechos, []);
    sinRestos(m.c);
  });
});
