// Firma de ODT Afinia · «POR SUBSANAR» · PANTALLA con el doble de DOM y los repositorios sobre el doble de Firestore
// (sin navegador): la pestaña en el arranque (admin siempre; el AZT si tiene alguna, con su contador), la lista
// (tarjetas con conteo e insignia «Lista para publicar»), el detalle (el AZT ve «Marcar subsanado» → nota →
// «Confirmar»; el admin ve «Verificar» y «Devolver» en los SUBSANADOS, «Agregar punto» y «Dar por resuelta»), el
// registro (vista previa de los puntos antes de «Guardar»; campos bloqueados mientras se consulta o se guarda; una
// vista previa que vio cambiar un dato se descarta), «Agregar punto» de a uno, el «NO repita» (un lote que tarda no
// vuelve a ofrecer el botón y se espera su desenlace) y que ninguna vista deje restos «null» pintados ni muestre un
// paso escondido.
// Datos INVENTADOS (repo público).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso, crearFirestoreFalso, TS } from './odt_afinia_ui_dobles.js';
import { crearRepositorioObs } from '../assets/js/data/odt_afinia_obs.js';
import { crearRepositorioOdt } from '../assets/js/data/odt_afinia.js';

let guardado;
before(() => { guardado = globalThis.document; globalThis.document = crearDomFalso(); });
after(() => { if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado; });

const { montarPorSubsanar, contarDeMiLado, VACIO_AZT } = await import('../assets/js/ui/odt-afinia/por-subsanar.js');
const { leerAncla, montarOdtAfinia } = await import('../assets/js/ui/odt-afinia/app.js');

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', correoPerfil: 'admin@prueba.test', rol: 'admin', esAdmin: true, legacy: false };
const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', correoPerfil: 'azt@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const TERCERO = { uid: 'uid-tercero-prueba', nombre: 'Tercero De Prueba', correoPerfil: 'tercero@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const NRO = '00000001';

function base() {
  const fs = crearFirestoreFalso();
  fs.poner('odt_afinia_firmantes/' + AZT.uid, { uid: AZT.uid, nombre: AZT.nombre, correo: AZT.correoPerfil, en: TS });
  fs.poner('odt_afinia_config/firmantes', { azt: [AZT.uid], responsable: [] });
  for (const s of [ADMIN, AZT, TERCERO]) fs.poner('usuarios/' + s.uid, { nombre: s.nombre, rol: s.rol, activo: true });
  const repoObs = (s) => crearRepositorioObs({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
  const repoOdt = (s) => crearRepositorioOdt({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
  return { fs, repoObs, repoOdt };
}
async function conObs(puntos = [{ texto: 'Falta el registro fotográfico', quien: 'contratista' }, { texto: 'Diligenciar el control previo', quien: 'azt' }]) {
  const b = base();
  const hab = { uid: AZT.uid, nombre: AZT.nombre, correo: AZT.correoPerfil };
  const { id } = await b.repoObs(ADMIN).registrar({ form: { nro: NRO, subestacion: 'S/E Prueba Norte', equipo: 'TR-Prueba', fechaPrevista: '15/11/2026' }, azt: hab, puntos });
  return { ...b, id };
}
const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent.includes(texto));
const botonesExactos = (el, texto) => botones(el).filter((b) => b.textContent === texto);
/** ¿Se ve? (ni él ni ningún ancestro tiene `hidden`). */
const visible = (el) => { for (let n = el; n; n = n.parentNode) if (n.hidden) return false; return true; };
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false', 'NaN'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}
/** Un SDK cuyo lote no responde hasta `soltar()` (una red lenta): para el «NO repita». `enviados` cuenta los lotes pedidos. */
function loteDemorado(fs) {
  let soltar; const demora = new Promise((r) => { soltar = r; });
  const enviados = [];
  const F = {
    ...fs.F,
    writeBatch: (d) => {
      const b = fs.F.writeBatch(d);
      return { set: b.set, update: b.update, commit: () => { enviados.push(1); return demora.then(() => b.commit()); } };
    }
  };
  return { F, soltar, enviados };
}
/** Espera (poco) a que `cond` se cumpla: para lo que pasa cuando un lote tardío por fin responde. */
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 5));
  }
}
/** Llena el formulario de registro con datos válidos (inventados); devuelve el buscador de campos. */
function llenarRegistro(c, { sub = 'S/E Prueba Norte', puntos = 'Falta el registro fotográfico' } = {}) {
  const campo = (id) => c.todos().find((x) => x.id === id);
  campo('odtObsNro').value = NRO; campo('odtObsSubestacion').value = sub; campo('odtObsEquipo').value = 'TR-Prueba';
  campo('odtObsFecha').value = '15/11/2026'; campo('odtObsAzt').value = AZT.uid; campo('odtObsPuntos').value = puntos;
  return campo;
}
function montar(s, repoObs, extra = {}) {
  const c = caja(); const idas = []; const cuentas = [];
  const p = montarPorSubsanar(c, {
    sesion: s, repoObs, alIr: (ancla, mensaje) => idas.push([ancla, mensaje || '']), alContar: (d) => cuentas.push(d || null), ...extra
  });
  return p.then((r) => ({ c, r, idas, cuentas }));
}

describe('anclas de la pestaña', () => {
  test('#subsanar, #subsanar=<id> y #subsanar-nueva; un id mal formado vuelve a la bandeja', () => {
    assert.deepEqual(leerAncla('#subsanar'), { vista: 'subsanar', sub: 'lista' });
    assert.deepEqual(leerAncla('#subsanar=' + 'A'.repeat(20)), { vista: 'subsanar', sub: 'detalle', obsId: 'A'.repeat(20) });
    assert.deepEqual(leerAncla('#subsanar-nueva'), { vista: 'subsanar', sub: 'nueva' });
    assert.deepEqual(leerAncla('#subsanar=../x'), { vista: 'bandeja' });
    assert.deepEqual(leerAncla('#odt=' + 'A'.repeat(20)), { vista: 'odt', odtId: 'A'.repeat(20) }, 'lo de antes no cambia');
  });
});

describe('arranque: la pestaña «Por subsanar» y su contador', () => {
  async function arrancar(perfil, repoObs) {
    const g = { window: globalThis.window, location: globalThis.location, sesion: globalThis.__sgmSession };
    globalThis.window = { __sgmSession: { user: { uid: perfil.uid }, profile: { nombre: perfil.nombre, email: perfil.correoPerfil, rol: perfil.rol, activo: true }, role: perfil.rol }, addEventListener: () => {} };
    globalThis.__sgmSession = globalThis.window.__sgmSession;
    globalThis.location = { hash: '' };
    try {
      const raiz = caja();
      await montarOdtAfinia(raiz, { franja: caja(), repoObs });
      return raiz;
    } finally {
      for (const [k, v] of [['window', g.window], ['location', g.location], ['__sgmSession', g.sesion]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    }
  }
  const nav = (raiz) => raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent);
  test('el AZT con una ODT asignada ve la pestaña con sus puntos pendientes; un técnico sin ninguna, no', async () => {
    const { repoObs } = await conObs();
    assert.deepEqual(nav(await arrancar(AZT, repoObs(AZT))), ['Bandeja', 'Habilitarme y Mi firma', 'Por subsanar2']);
    const b = (await arrancar(AZT, repoObs(AZT))).querySelectorAll('.odt-nav-btn').at(-1);
    assert.equal(b.getAttribute('href'), '#subsanar');
    assert.equal(b.querySelectorAll('.odt-cuenta')[0].getAttribute('title'), 'Puntos pendientes por subsanar');
    assert.deepEqual(nav(await arrancar(TERCERO, repoObs(TERCERO))), ['Bandeja', 'Habilitarme y Mi firma'], 'sin datos ajenos: no la ve');
  });
  test('el admin la ve siempre; su contador son los subsanados por verificar', async () => {
    const { repoObs, id } = await conObs();
    assert.deepEqual(nav(await arrancar(ADMIN, repoObs(ADMIN))), ['Bandeja', 'Habilitarme y Mi firma', 'Publicar ODT', 'Por subsanar0']);
    await repoObs(AZT).cambiarPunto(id, '0', 'subsanar', 'Se subió la foto');
    assert.deepEqual(nav(await arrancar(ADMIN, repoObs(ADMIN))).at(-1), 'Por subsanar1');
    assert.deepEqual(await contarDeMiLado({ repoObs: repoObs(AZT), sesion: AZT }), { total: 1, deMiLado: 1 });
  });
});

describe('lista', () => {
  test('el AZT ve su tarjeta: N.º, S/E, fecha prevista, AZT y el conteo; al tocarla abre el detalle', async () => {
    const { repoObs, id } = await conObs();
    const { c, idas, cuentas } = await montar(AZT, repoObs(AZT));
    const t = c.textContent;
    for (const x of ['ODT N.º ' + NRO, 'S/E Prueba Norte', 'prevista 15/11/2026', 'AZT: Azt De Prueba', 'Pendientes 2 · Subsanados por verificar 0 · Verificados 0', 'Abierta']) assert.ok(t.includes(x), x);
    assert.ok(!boton(c, 'Registrar ODT por subsanar'), 'el AZT no registra');
    await boton(c, 'ODT N.º').disparar('click');
    assert.deepEqual(idas, [['subsanar=' + id, '']]);
    assert.deepEqual(cuentas, [{ total: 1, deMiLado: 2 }]);
    sinRestos(c);
  });
  test('un técnico sin ODT ve el estado vacío; el admin ve «Registrar ODT por subsanar» y la insignia «Lista para publicar»', async () => {
    const { repoObs, id } = await conObs([{ texto: 'Falta el registro fotográfico', quien: 'contratista' }]);
    const v = await montar(TERCERO, repoObs(TERCERO));
    assert.ok(v.c.textContent.includes(VACIO_AZT));
    await repoObs(AZT).cambiarPunto(id, '0', 'subsanar', 'Se subió la foto');
    await repoObs(ADMIN).cambiarPunto(id, '0', 'verificar', '');
    const { c, idas } = await montar(ADMIN, repoObs(ADMIN));
    assert.ok(c.textContent.includes('Lista para publicar'));
    assert.equal(c.querySelectorAll('.odt-chip--publicar').length, 1);
    await boton(c, 'Registrar ODT por subsanar').disparar('click');
    assert.deepEqual(idas, [['subsanar-nueva', '']]);
    sinRestos(c);
  });
  test('un error de lectura se dice y ofrece «Reintentar»', async () => {
    const { c } = await montar(AZT, { listar: async () => { throw new Error('No hay conexión con la plataforma.'); } });
    assert.ok(c.textContent.includes('No hay conexión'));
    assert.ok(boton(c, 'Reintentar'));
  });
});

describe('detalle: el AZT marca subsanado en dos pasos', () => {
  test('ve «Marcar subsanado» en cada punto PENDIENTE (no «Verificar» ni «Devolver»); la nota y «Confirmar» aparecen al pulsarlo', async () => {
    const { fs, repoObs, id } = await conObs();
    const { c } = await montar(AZT, repoObs(AZT), { vista: 'detalle', obsId: id });
    const t = c.textContent;
    for (const x of ['ODT N.º ' + NRO + ' · por subsanar', 'Falta el registro fotográfico', 'Diligenciar el control previo', 'Le toca: Contratista', 'Le toca: AZT', 'Pendiente', 'Sin cambios todavía.']) assert.ok(t.includes(x), x);
    assert.equal(botonesExactos(c, 'Marcar subsanado').length, 2);
    assert.ok(!boton(c, 'Verificar') && !boton(c, 'Devolver'), 'el AZT no verifica ni devuelve');
    assert.ok(!boton(c, 'Agregar punto') && !boton(c, 'Dar por resuelta'));
    const confirmar = botonesExactos(c, 'Confirmar')[0];
    assert.ok(!visible(confirmar), '«Confirmar» escondido hasta pulsar «Marcar subsanado»');
    const marcar = botonesExactos(c, 'Marcar subsanado')[0];
    await marcar.disparar('click');
    assert.ok(visible(confirmar) && !visible(marcar), 'segundo paso a la vista; el primero, escondido');
    // Sin nota no escribe.
    const lotes = fs.lotes.length;
    await confirmar.disparar('click');
    assert.equal(fs.lotes.length, lotes);
    assert.ok(c.textContent.includes('Escriba qué se hizo para subsanar el punto'));
    // Con nota: escribe el lote atado y vuelve a pintar con el mensaje y el rastro.
    c.todos().find((x) => x.tagName === 'TEXTAREA' && x.id === 'odtObsNota0subsanar').value = 'Se subió la foto del antes';
    await botonesExactos(c, 'Confirmar')[0].disparar('click');
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/0').estado, 'SUBSANADO');
    assert.equal(fs.store.get('odt_afinia_obs/' + id).resumen['0'], 'SUBSANADO');
    const t2 = c.textContent;
    assert.ok(t2.includes('Punto 1 marcado como subsanado. El administrador lo verificará.'));
    assert.ok(t2.includes('Subsanado · por verificar'));
    assert.ok(t2.includes('Rastro (1 cambio)'));
    assert.ok(t2.includes('Azt De Prueba · Pendiente → Subsanado · por verificar · «Se subió la foto del antes»'));
    assert.equal(botonesExactos(c, 'Marcar subsanado').length, 1, 'el punto 1 ya no ofrece marcar');
    sinRestos(c);
  });
  test('«Cancelar» vuelve al primer paso; un tercero no ve la ODT', async () => {
    const { repoObs, id } = await conObs();
    const { c } = await montar(AZT, repoObs(AZT), { vista: 'detalle', obsId: id });
    const marcar = botonesExactos(c, 'Marcar subsanado')[0];
    await marcar.disparar('click');
    await botonesExactos(c, 'Cancelar')[0].disparar('click');
    assert.ok(visible(marcar) && !visible(botonesExactos(c, 'Confirmar')[0]));
    const t = await montar(TERCERO, repoObs(TERCERO), { vista: 'detalle', obsId: id });
    assert.ok(t.c.textContent.includes('no existe o usted no está asignado'));
    assert.ok(!boton(t.c, 'Marcar subsanado'));
    sinRestos(t.c);
  });
});

describe('detalle: el administrador verifica o devuelve, agrega puntos y la da por resuelta', () => {
  test('en un SUBSANADO ve «Verificar» y «Devolver» (no «Marcar subsanado»); devolver exige motivo; con todo verificado: «Lista para publicar»', async () => {
    const { fs, repoObs, id } = await conObs();
    await repoObs(AZT).cambiarPunto(id, '0', 'subsanar', 'Se subió la foto');
    const { c } = await montar(ADMIN, repoObs(ADMIN), { vista: 'detalle', obsId: id });
    assert.equal(botonesExactos(c, 'Verificar').length, 1, 'solo en el punto SUBSANADO');
    assert.equal(botonesExactos(c, 'Devolver').length, 1);
    assert.ok(!boton(c, 'Marcar subsanado'), 'el admin no marca subsanado');
    assert.ok(!visible(botonesExactos(c, 'Confirmar devolución')[0]) && !visible(botonesExactos(c, 'Confirmar verificación')[0]));
    await botonesExactos(c, 'Devolver')[0].disparar('click');
    const lotes = fs.lotes.length;
    await botonesExactos(c, 'Confirmar devolución')[0].disparar('click');
    assert.equal(fs.lotes.length, lotes, 'sin motivo no escribe');
    assert.ok(c.textContent.includes('Escriba el motivo de la devolución'));
    c.todos().find((x) => x.id === 'odtObsNota0devolver').value = 'La foto no tiene fecha';
    await botonesExactos(c, 'Confirmar devolución')[0].disparar('click');
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/0').estado, 'PENDIENTE');
    assert.ok(c.textContent.includes('Punto 1 devuelto al AZT con el motivo.'));
    assert.ok(c.textContent.includes('Subsanado · por verificar → Pendiente · «La foto no tiene fecha»'));
    // El AZT lo vuelve a subsanar (y el otro punto) y el admin verifica los dos (nota opcional).
    await repoObs(AZT).cambiarPunto(id, '0', 'subsanar', 'Foto con fecha');
    await repoObs(AZT).cambiarPunto(id, '1', 'subsanar', 'Control diligenciado');
    const v = await montar(ADMIN, repoObs(ADMIN), { vista: 'detalle', obsId: id });
    for (const k of ['0', '1']) {
      await botonesExactos(v.c, 'Verificar')[0].disparar('click');
      await botonesExactos(v.c, 'Confirmar verificación')[0].disparar('click');
      assert.ok(v.c.textContent.includes('Punto ' + (Number(k) + 1) + ' verificado.'));
    }
    assert.ok(v.c.textContent.includes('Lista para publicar: todos los puntos están verificados.'));
    assert.ok(v.c.todos().some((x) => x.tagName === 'A' && x.getAttribute('href') === '#publicar'), 'enlace a «Publicar ODT» (no se publica aquí)');
    assert.ok(!boton(v.c, 'Verificar') && !boton(v.c, 'Devolver'));
    sinRestos(v.c);
  });
  test('quien marcó el punto subsanado (un admin que además es el AZT) no ve «Verificar»: se le dice por qué', async () => {
    const b = base();
    const ADMIN2 = { ...ADMIN, uid: 'uid-admin2-prueba', nombre: 'Admin Dos De Prueba' };
    b.fs.poner('odt_afinia_firmantes/' + ADMIN2.uid, { uid: ADMIN2.uid, nombre: ADMIN2.nombre, correo: 'admin2@prueba.test' });
    const { id } = await b.repoObs(ADMIN).registrar({ form: { nro: NRO, subestacion: 'S/E Prueba', equipo: '', fechaPrevista: '15/11/2026' },
      azt: { uid: ADMIN2.uid, nombre: ADMIN2.nombre, correo: 'admin2@prueba.test' }, puntos: [{ texto: 'Falta la foto', quien: 'contratista' }] });
    await b.repoObs(ADMIN2).cambiarPunto(id, '0', 'subsanar', 'Lo hice yo');
    const { c } = await montar(ADMIN2, b.repoObs(ADMIN2), { vista: 'detalle', obsId: id });
    assert.ok(!boton(c, 'Verificar'));
    assert.ok(c.textContent.includes('lo verifica o lo devuelve otro administrador'));
    const otro = await montar(ADMIN, b.repoObs(ADMIN), { vista: 'detalle', obsId: id });
    assert.ok(boton(otro.c, 'Verificar'));
  });
  test('«Agregar punto» con prefijo; «Dar por resuelta» en dos pasos y, después, sin acciones', async () => {
    const { fs, repoObs, id } = await conObs();
    const { c } = await montar(ADMIN, repoObs(ADMIN), { vista: 'detalle', obsId: id });
    c.todos().find((x) => x.id === 'odtObsPuntoNuevo').value = 'Responsable: firmar la casilla del responsable';
    await boton(c, 'Agregar punto').disparar('click');
    assert.deepEqual({ ...fs.store.get('odt_afinia_obs/' + id + '/puntos/2'), creadoEn: null }, {
      orden: 2, texto: 'firmar la casilla del responsable', quien: 'responsable', estado: 'PENDIENTE', rev: 0, rastro: {},
      creadoPor: { uid: ADMIN.uid, nombre: ADMIN.nombre }, creadoEn: null
    });
    assert.ok(c.textContent.includes('Punto 3 agregado (Pendiente, le toca: Responsable).'));
    // Dar por resuelta: sin nota, no; con nota, primero explica y luego «Sí, darla por resuelta».
    const si = boton(c, 'Sí, darla por resuelta');
    assert.ok(!visible(si), 'el «Sí» está escondido hasta el primer paso');
    await boton(c, 'Dar por resuelta').disparar('click');
    assert.ok(c.textContent.includes('Escriba por qué se da por resuelta'));
    assert.ok(!visible(si));
    c.todos().find((x) => x.id === 'odtObsResolver').value = 'La ODT ya no va';
    await botonesExactos(c, 'Dar por resuelta')[0].disparar('click');
    assert.ok(visible(si));
    assert.ok(c.textContent.includes('Ojo: 3 puntos no están verificados.'));
    await si.disparar('click');
    assert.equal(fs.store.get('odt_afinia_obs/' + id).estado, 'RESUELTA');
    const t = c.textContent;
    assert.ok(t.includes('ODT N.º ' + NRO + ' dada por resuelta.'));
    assert.ok(t.includes('Resuelta') && t.includes('«La ODT ya no va»'));
    assert.ok(!boton(c, 'Agregar punto') && !boton(c, 'Dar por resuelta') && !boton(c, 'Verificar'));
    const az = await montar(AZT, repoObs(AZT), { vista: 'detalle', obsId: id });
    assert.ok(!boton(az.c, 'Marcar subsanado'), 'en una RESUELTA el AZT ya no marca nada');
    sinRestos(c); sinRestos(az.c);
  });
  test('«Agregar punto» recibe un punto a la vez: con dos líneas lo pide y no escribe nada', async () => {
    const { fs, repoObs, id } = await conObs();
    const { c } = await montar(ADMIN, repoObs(ADMIN), { vista: 'detalle', obsId: id });
    const lotes = fs.lotes.length;
    c.todos().find((x) => x.id === 'odtObsPuntoNuevo').value = 'AZT: Diligenciar el control previo\nResponsable: Firmar la casilla';
    await boton(c, 'Agregar punto').disparar('click');
    assert.equal(fs.lotes.length, lotes, 'no junta dos líneas en un punto');
    assert.ok(c.textContent.includes('Agregue un punto a la vez (escribió 2 líneas con texto).'));
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/2'), undefined);
    // Una sola línea con texto (las vacías no cuentan): entra con su prefijo.
    c.todos().find((x) => x.id === 'odtObsPuntoNuevo').value = '\nAZT: Diligenciar el control previo\n\n';
    await boton(c, 'Agregar punto').disparar('click');
    assert.deepEqual({ texto: fs.store.get('odt_afinia_obs/' + id + '/puntos/2').texto, quien: fs.store.get('odt_afinia_obs/' + id + '/puntos/2').quien },
      { texto: 'Diligenciar el control previo', quien: 'azt' });
    assert.ok(c.textContent.includes('Punto 3 agregado (Pendiente, le toca: AZT).'));
  });
});

describe('un cambio que no responde a tiempo («NO repita»): no se ofrece repetir y se espera el desenlace', () => {
  async function marcarConLoteLento() {
    const { fs, id } = await conObs();
    const l = loteDemorado(fs);
    const repo = crearRepositorioObs({ sdk: l.F, db: fs.db, sesion: () => AZT, tiempoLoteMs: 30 });
    const v = await montar(AZT, repo, { vista: 'detalle', obsId: id });
    await botonesExactos(v.c, 'Marcar subsanado')[0].disparar('click');
    v.c.todos().find((x) => x.id === 'odtObsNota0subsanar').value = 'Se subió la foto del antes';
    const confirmar = botonesExactos(v.c, 'Confirmar')[0];
    await confirmar.disparar('click');
    return { fs, id, l, confirmar, ...v };
  }
  test('el AZT: «Confirmar» y «Cancelar» siguen bloqueados (otro clic no envía nada); cuando entra, la vista se vuelve a leer', async () => {
    const { fs, id, l, c, confirmar } = await marcarConLoteLento();
    assert.ok(c.textContent.includes('NO repita'));
    assert.ok(confirmar.disabled && botonesExactos(c, 'Cancelar')[0].disabled, 'no se ofrece repetir');
    await confirmar.disparar('click');
    assert.equal(l.enviados.length, 1, 'un segundo clic no pide otro lote');
    l.soltar();
    await hasta(() => c.textContent.includes('Punto 1 marcado como subsanado. El administrador lo verificará.'));
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/0').estado, 'SUBSANADO');
    assert.ok(c.textContent.includes('Subsanado · por verificar'));
    sinRestos(c);
  });
  test('si la base lo niega al final, se explica y se puede volver a intentar; si el usuario ya se fue, no se pinta encima', async () => {
    const a = await marcarConLoteLento();
    a.fs.opciones.denegarLote = true;
    a.l.soltar();
    await hasta(() => !a.confirmar.disabled);
    assert.ok(a.c.textContent.includes('La plataforma no aceptó el cambio'));
    const b = await marcarConLoteLento();
    for (const x of [...b.c.childNodes]) b.c.removeChild(x);
    b.c.appendChild(document.createTextNode('Otra vista'));
    b.l.soltar();
    await hasta(() => b.fs.store.get('odt_afinia_obs/' + b.id + '/puntos/0').estado === 'SUBSANADO');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(b.c.textContent, 'Otra vista', 'el desenlace tardío no tapa la vista nueva');
  });
  test('registrar: «Guardar», «Vista previa» y los campos siguen bloqueados; cuando entra, va a la lista con el mensaje', async () => {
    const { fs, repoOdt } = base();
    const l = loteDemorado(fs);
    const repo = crearRepositorioObs({ sdk: l.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 30 });
    const { c, idas } = await montar(ADMIN, repo, { vista: 'nueva', repoOdt: repoOdt(ADMIN) });
    const campo = llenarRegistro(c);
    await boton(c, 'Vista previa').disparar('click');
    const guardar = botonesExactos(c, 'Guardar')[0];
    await guardar.disparar('click');
    assert.ok(c.textContent.includes('NO repita'));
    assert.ok(guardar.disabled && boton(c, 'Vista previa').disabled && campo('odtObsNro').disabled, 'no se ofrece repetir');
    await guardar.disparar('click');
    assert.equal(l.enviados.length, 1, 'un segundo clic no pide otro lote');
    assert.deepEqual(idas, []);
    l.soltar();
    await hasta(() => idas.length > 0);
    assert.deepEqual(idas, [['subsanar', 'ODT N.º ' + NRO + ' registrada con 1 punto. El AZT asignado ya la ve en «Por subsanar».']]);
    assert.equal(fs.lotes.length, 1);
  });
});

describe('registrar (solo admin): vista previa de los puntos antes de guardar', () => {
  test('valida, muestra los puntos con a quién le toca y guarda en UN lote; cambiar un campo esconde «Guardar»', async () => {
    const { fs, repoObs, repoOdt } = base();
    const { c, idas, r } = await montar(ADMIN, repoObs(ADMIN), { vista: 'nueva', repoOdt: repoOdt(ADMIN) });
    assert.deepEqual(r.candidatos.map((x) => x.uid), [AZT.uid], 'solo AZT de la lista blanca, habilitados');
    const guardar = botonesExactos(c, 'Guardar')[0];
    assert.ok(!visible(guardar), '«Guardar» escondido hasta la vista previa');
    const campo = (id) => c.todos().find((x) => x.id === id);
    // Vacío: errores en llano, sin escribir.
    await boton(c, 'Vista previa').disparar('click');
    assert.ok(c.textContent.includes('El N.º de ODT debe tener 8 dígitos.'));
    assert.ok(c.textContent.includes('Escriba al menos un punto'));
    assert.ok(!visible(guardar));
    campo('odtObsNro').value = NRO; campo('odtObsSubestacion').value = 'S/E Prueba Norte'; campo('odtObsFecha').value = '15/11/2026';
    campo('odtObsAzt').value = AZT.uid;
    campo('odtObsPuntos').value = '- Falta el registro fotográfico\nAZT: Diligenciar el control previo\n\nResponsable: Firmar la casilla';
    await boton(c, 'Vista previa').disparar('click');
    const t = c.textContent;
    assert.ok(t.includes('Se registran 3 puntos, todos PENDIENTES:'));
    assert.ok(t.includes('AZT asignado: Azt De Prueba'));
    for (const x of ['ContratistaFalta el registro fotográfico', 'AZTDiligenciar el control previo', 'ResponsableFirmar la casilla']) assert.ok(t.replace(/ /g, '').includes(x.replace(/ /g, '')), x);
    assert.ok(visible(guardar));
    await campo('odtObsSubestacion').disparar('input');
    assert.ok(!visible(guardar), 'un cambio pide otra vista previa');
    await boton(c, 'Vista previa').disparar('click');
    await guardar.disparar('click');
    assert.equal(fs.lotes.length, 1);
    const id = fs.lotes[0].ops[0].ruta.split('/')[1];
    assert.deepEqual(idas, [['subsanar=' + id, 'ODT N.º ' + NRO + ' registrada con 3 puntos. El AZT asignado ya la ve en «Por subsanar».']]);
    assert.deepEqual(Object.values(fs.store.get('odt_afinia_obs/' + id).resumen), ['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
    sinRestos(c);
    // El mismo N.º con la anterior ABIERTA: la vista previa lo dice y no ofrece guardar.
    const otra = await montar(ADMIN, repoObs(ADMIN), { vista: 'nueva', repoOdt: repoOdt(ADMIN) });
    const campo2 = (x) => otra.c.todos().find((y) => y.id === x);
    campo2('odtObsNro').value = NRO; campo2('odtObsSubestacion').value = 'S/E Prueba'; campo2('odtObsFecha').value = '15/11/2026';
    campo2('odtObsAzt').value = AZT.uid; campo2('odtObsPuntos').value = 'Otro punto de prueba';
    await boton(otra.c, 'Vista previa').disparar('click');
    assert.ok(otra.c.textContent.includes('Ya hay una ODT por subsanar ABIERTA con el N.º ' + NRO));
    assert.ok(!visible(botonesExactos(otra.c, 'Guardar')[0]));
  });
  test('mientras se guarda: los campos quedan bloqueados y editar uno no rompe el guardado (va la copia de lo validado)', async () => {
    const { fs, repoObs, repoOdt } = base();
    const real = repoObs(ADMIN);
    let soltar; const espera = new Promise((r) => { soltar = r; });
    const repo = { ...real, registrar: async (x) => { await espera; return real.registrar(x); } };
    const { c, idas } = await montar(ADMIN, repo, { vista: 'nueva', repoOdt: repoOdt(ADMIN) });
    const campo = llenarRegistro(c);
    await boton(c, 'Vista previa').disparar('click');
    assert.ok(c.textContent.includes('Se registra 1 punto, PENDIENTE:'), 'singular bien escrito');
    const guardar = botonesExactos(c, 'Guardar')[0];
    const enCurso = guardar.disparar('click');
    for (const x of ['odtObsNro', 'odtObsSubestacion', 'odtObsEquipo', 'odtObsFecha', 'odtObsAzt', 'odtObsPuntos']) assert.ok(campo(x).disabled, x + ' bloqueado');
    assert.ok(guardar.disabled && boton(c, 'Vista previa').disabled);
    // Aunque llegara un cambio (el navegador no lo deja con el campo bloqueado), no toca lo que se envía.
    campo('odtObsEquipo').value = 'TR-Otro';
    await campo('odtObsEquipo').disparar('input');
    soltar();
    await enCurso;
    assert.equal(fs.lotes.length, 1);
    const id = fs.lotes[0].ops[0].ruta.split('/')[1];
    assert.deepEqual(idas, [['subsanar=' + id, 'ODT N.º ' + NRO + ' registrada con 1 punto. El AZT asignado ya la ve en «Por subsanar».']]);
    assert.equal(fs.store.get('odt_afinia_obs/' + id).equipo, 'TR-Prueba', 'se guardó lo validado en la vista previa');
    assert.ok(!c.textContent.includes('Cannot read'));
    sinRestos(c);
  });
  test('si un dato cambia mientras se consulta el N.º, esa vista previa se descarta; la siguiente usa el dato nuevo', async () => {
    const { fs, repoObs, repoOdt } = base();
    const real = repoObs(ADMIN);
    let soltar; const espera = new Promise((r) => { soltar = r; });
    let primera = true;
    const repo = { ...real, previaDelNro: async (n) => { if (primera) { primera = false; await espera; } return real.previaDelNro(n); } };
    const { c } = await montar(ADMIN, repo, { vista: 'nueva', repoOdt: repoOdt(ADMIN) });
    const campo = llenarRegistro(c, { sub: 'S/E Vieja' });
    const guardar = botonesExactos(c, 'Guardar')[0];
    const enCurso = boton(c, 'Vista previa').disparar('click');
    assert.ok(campo('odtObsSubestacion').disabled, 'bloqueado durante la consulta');
    campo('odtObsSubestacion').value = 'S/E Nueva';
    await campo('odtObsSubestacion').disparar('input');
    soltar(); await enCurso;
    assert.ok(!visible(guardar), 'sin «Guardar» con datos viejos');
    assert.ok(c.textContent.includes('Un dato cambió mientras se consultaba el N.º: pulse «Vista previa» otra vez.'));
    assert.ok(!c.textContent.includes('S/E Vieja'));
    assert.ok(!campo('odtObsSubestacion').disabled, 'los campos vuelven a quedar libres');
    await boton(c, 'Vista previa').disparar('click');
    assert.ok(visible(guardar) && c.textContent.includes('S/E Nueva'));
    await guardar.disparar('click');
    const id = fs.lotes[0].ops[0].ruta.split('/')[1];
    assert.equal(fs.store.get('odt_afinia_obs/' + id).subestacion, 'S/E Nueva');
  });
  test('un técnico no ve el registro; con un repositorio de la firma viejo (sin candidatos) se pide recargar', async () => {
    const { repoObs } = base();
    const t = await montar(AZT, repoObs(AZT), { vista: 'nueva' });
    assert.ok(t.c.textContent.includes('Solo un administrador registra ODT por subsanar.'));
    const v = await montar(ADMIN, repoObs(ADMIN), { vista: 'nueva', repoOdt: {} });
    assert.ok(v.c.textContent.includes('versión anterior (caché del navegador)'));
    sinRestos(v.c);
  });
});
