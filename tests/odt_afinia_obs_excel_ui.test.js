// Firma de ODT Afinia · «POR SUBSANAR» · DESCARGAR EXCEL · PANTALLA con el doble de DOM y el repositorio sobre el doble de
// Firestore (sin navegador): el bloque «Descargar Excel» en la lista para el administrador y para el AZT asignado (no
// en el estado vacío), la casilla «Incluir las ya resueltas» desmarcada por defecto, el avance «Preparando… n de N»,
// que el AZT exporta solo lo suyo, que un error de red (en la lista o en una ODT) se dice claro y NO entrega nada, que
// un segundo clic no arma otro archivo, el nombre ODT_por_subsanar_AAAA-MM-DD.xlsx y el camino por defecto (SheetJS de
// la página y XLSX.writeFile).
// Datos INVENTADOS (repo público): N.º que empiezan por 9, personas y subestaciones de prueba.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crearDomFalso, crearFirestoreFalso, TS } from './odt_afinia_ui_dobles.js';
import { crearRepositorioObs } from '../assets/js/data/odt_afinia_obs.js';

// Lección §234.6: la preparación de raíz va ANTES de todo describe y de todo await de nivel superior (en Node 20, el del
// CI, un before() de raíz tardío no corre).
let guardado;
before(() => { guardado = globalThis.document; globalThis.document = crearDomFalso(); });
after(() => { if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado; });

const XLSX_REAL = createRequire(import.meta.url)('xlsx');
const { montarPorSubsanar } = await import('../assets/js/ui/odt-afinia/por-subsanar.js');
const { bloqueDescargaExcel, descargarExcel, leerRegistros, TEXTOS_EXCEL } = await import('../assets/js/ui/odt-afinia/subsanar-excel.js');
const { nombreArchivoExcel } = await import('../assets/js/domain/odt_afinia_obs_excel.js');

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', correoPerfil: 'admin@prueba.test', rol: 'admin', esAdmin: true, legacy: false };
const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', correoPerfil: 'azt@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const AZT2 = { uid: 'uid-azt-dos-prueba', nombre: 'Otro Azt De Prueba', correoPerfil: 'azt2@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const TERCERO = { uid: 'uid-tercero-prueba', nombre: 'Tercero De Prueba', correoPerfil: 'tercero@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };

function base() {
  const fs = crearFirestoreFalso();
  for (const a of [AZT, AZT2]) fs.poner('odt_afinia_firmantes/' + a.uid, { uid: a.uid, nombre: a.nombre, correo: a.correoPerfil, en: TS });
  fs.poner('odt_afinia_config/firmantes', { azt: [AZT.uid, AZT2.uid], responsable: [] });
  for (const s of [ADMIN, AZT, AZT2, TERCERO]) fs.poner('usuarios/' + s.uid, { nombre: s.nombre, rol: s.rol, activo: true });
  const repoObs = (s) => crearRepositorioObs({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
  return { fs, repoObs };
}
/** Tres ODT: 90000001 (AZT, 2 puntos), 90000002 (AZT2, 1 punto) y 90000003 (AZT, RESUELTA, 1 punto). */
async function conTres() {
  const b = base();
  const reg = async (nro, azt, puntos) => (await b.repoObs(ADMIN).registrar({
    form: { nro, subestacion: 'S/E Prueba ' + nro.slice(-1), equipo: 'TR-Prueba', fechaPrevista: '15/11/2026' },
    azt: { uid: azt.uid, nombre: azt.nombre, correo: azt.correoPerfil }, puntos
  })).id;
  const ids = {
    uno: await reg('90000001', AZT, [{ texto: 'Control previo: ajustar la hora anotada (06:00).', quien: 'contratista' },
      { texto: 'Aclarar dónde estuvo la cuadrilla ese día.', quien: 'azt' }]),
    dos: await reg('90000002', AZT2, [{ texto: 'Registro fotográfico: agregar una imagen nítida de la placa.', quien: 'contratista' }]),
    tres: await reg('90000003', AZT, [{ texto: 'Generar de nuevo la ODT.', quien: 'contratista' }])
  };
  await b.repoObs(AZT).cambiarPunto(ids.uno, '0', 'subsanar', 'Se corrigió la hora');
  await b.repoObs(ADMIN).resolver(ids.tres, 'Ya no aplica');
  return { ...b, ids };
}
const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent === texto);
const casillaDe = (el) => el.todos().find((x) => x.tagName === 'INPUT' && x.id === 'odtObsExcelResueltas');
const estadoDe = (el) => el.querySelectorAll('.odt-obs-excel')[0].querySelectorAll('.odt-estado')[0];
/** Lo que se «descarga»: el libro escrito a bytes y vuelto a leer con SheetJS, y su nombre. */
function capturador() {
  const entregas = [];
  const entregar = (XLSX, wb, nombre) => {
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    entregas.push({ nombre, libro: XLSX.read(bytes, { cellNF: true }) });
  };
  return { entregas, entregar };
}
const filas = (libro, hoja) => XLSX_REAL.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: null });
/** Espera (poco) a que `cond` se cumpla. */
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 2));
  }
}
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false', 'NaN'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}

describe('el bloque en la lista de «Por subsanar»', () => {
  test('el administrador y el AZT asignado ven «Descargar Excel» y la casilla «Incluir las ya resueltas» (desmarcada)', async () => {
    const { repoObs } = await conTres();
    for (const s of [ADMIN, AZT]) {
      const c = caja();
      await montarPorSubsanar(c, { sesion: s, repoObs: repoObs(s), alIr: () => {}, alContar: () => {} });
      const b = boton(c, 'Descargar Excel');
      assert.ok(b, s.nombre + ': el botón');
      assert.equal(b.disabled, false);
      const casilla = casillaDe(c);
      assert.ok(casilla && casilla.type === 'checkbox', s.nombre + ': la casilla');
      assert.equal(casilla.checked, false, 'por defecto, solo las abiertas');
      const etiqueta = c.todos().find((x) => x.tagName === 'LABEL' && x.htmlFor === 'odtObsExcelResueltas');
      assert.ok(etiqueta && etiqueta.textContent === 'Incluir las ya resueltas', 'la casilla tiene su texto');
      assert.ok(c.textContent.includes('una fila por punto'), 'dice qué trae');
      // El bloque va antes de la lista de tarjetas.
      const hijos = c.childNodes.map((n) => n.className || (n.childNodes[0] && n.childNodes[0].className) || n.tagName);
      assert.ok(hijos.indexOf('odt-obs-excel') >= 0 && hijos.indexOf('odt-obs-excel') < hijos.indexOf('odt-filas'), 'sobre la lista: ' + hijos.join(', '));
      sinRestos(c);
    }
  });
  test('quien no tiene ODT por subsanar ve el estado vacío, sin el botón', async () => {
    const { repoObs } = await conTres();
    const c = caja();
    await montarPorSubsanar(c, { sesion: TERCERO, repoObs: repoObs(TERCERO), alIr: () => {}, alContar: () => {} });
    assert.ok(!boton(c, 'Descargar Excel'));
    assert.ok(!casillaDe(c));
  });
});

describe('descargar desde la lista (camino por defecto: la SheetJS de la página y XLSX.writeFile)', () => {
  test('el administrador: lee las ODT abiertas del servidor y entrega ODT_por_subsanar_AAAA-MM-DD.xlsx con las dos hojas', async () => {
    const { repoObs } = await conTres();
    const escritos = [];
    const XLSX = { ...XLSX_REAL, writeFile: (wb, nombre, op) => { escritos.push({ wb, nombre, op }); } };
    const g = globalThis.window;
    globalThis.window = { XLSX };
    try {
      const c = caja();
      await montarPorSubsanar(c, { sesion: ADMIN, repoObs: repoObs(ADMIN), alIr: () => {}, alContar: () => {} });
      const antes = nombreArchivoExcel(new Date());
      await boton(c, 'Descargar Excel').disparar('click');
      const despues = nombreArchivoExcel(new Date());
      assert.equal(escritos.length, 1, 'un archivo');
      assert.ok([antes, despues].includes(escritos[0].nombre), escritos[0].nombre);
      assert.match(escritos[0].nombre, /^ODT_por_subsanar_\d{4}-\d{2}-\d{2}\.xlsx$/);
      assert.deepEqual(escritos[0].op, { bookType: 'xlsx', compression: true });
      const libro = escritos[0].wb;
      assert.deepEqual(libro.SheetNames, ['Detalle', 'Resumen']);
      const d = filas(libro, 'Detalle');
      assert.equal(d[0][0], 'N.º ODT', 'encabezado en la fila 1');
      assert.deepEqual(d.slice(1).map((f) => [f[0], f[6], f[7], f[12]]), [
        ['90000001', 1, 'Control previo', 'Subsanado (falta verificar)'],
        ['90000001', 2, 'Aclaración del AZT', 'Pendiente'],
        ['90000002', 1, 'Registro fotográfico', 'Pendiente']
      ], 'solo las ABIERTAS: la RESUELTA no va');
      assert.match(d[1][13], /^Se corrigió la hora \(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\)$/, 'la nota del AZT con su fecha');
      assert.equal(libro.Sheets.Detalle['!autofilter'].ref, 'A1:P4');
      assert.equal(filas(libro, 'Resumen').length, 1 + 2);
      assert.equal(estadoDe(c).textContent, 'Listo: se descargó «' + escritos[0].nombre + '» con 2 ODT y 3 puntos.');
      assert.equal(estadoDe(c).querySelectorAll('.odt-aviso--ok').length, 1, 'el resultado, en verde como la otra descarga del módulo');
      assert.equal(boton(c, 'Descargar Excel').disabled, false, 'el botón vuelve a quedar disponible');
      sinRestos(c);
    } finally {
      if (g === undefined) delete globalThis.window; else globalThis.window = g;
    }
  });
});

describe('el bloque: casilla, avance, lo de cada quien y los errores', () => {
  const montarBloque = (repoObs, extra = {}) => {
    const { entregas, entregar } = capturador();
    const el = bloqueDescargaExcel({ repoObs, cargarXlsx: async () => XLSX_REAL, entregar, ahora: () => new Date(Date.UTC(2026, 10, 25, 3, 0)), ...extra });
    return { el, entregas };
  };
  test('«Incluir las ya resueltas» marcada: la RESUELTA va al final; el nombre lleva la fecha de Colombia', async () => {
    const { repoObs } = await conTres();
    const { el, entregas } = montarBloque(repoObs(ADMIN));
    casillaDe(el).checked = true;
    await boton(el, 'Descargar Excel').disparar('click');
    assert.equal(entregas.length, 1);
    assert.equal(entregas[0].nombre, 'ODT_por_subsanar_2026-11-24.xlsx', 'las 22:00 del 24 en Colombia');
    const d = filas(entregas[0].libro, 'Detalle');
    assert.deepEqual(d.slice(1).map((f) => [f[0], f[5]]), [['90000001', 'Abierta'], ['90000001', 'Abierta'], ['90000002', 'Abierta'], ['90000003', 'Resuelta']]);
    assert.equal(d[4][7], 'ODT');
    assert.equal(d[4][10], 'Sí');
    assert.match(el.querySelectorAll('.odt-estado')[0].textContent, /con 3 ODT y 4 puntos\.$/);
  });
  test('el AZT exporta SOLO sus ODT (lo que la plataforma le deja leer)', async () => {
    const { repoObs } = await conTres();
    const { el, entregas } = montarBloque(repoObs(AZT));
    casillaDe(el).checked = true;
    await boton(el, 'Descargar Excel').disparar('click');
    assert.deepEqual([...new Set(filas(entregas[0].libro, 'Detalle').slice(1).map((f) => f[0]))], ['90000001', '90000003'], 'nada de la ODT de otro AZT');
    assert.deepEqual(filas(entregas[0].libro, 'Detalle').slice(1).map((f) => f[4]), ['Azt De Prueba', 'Azt De Prueba', 'Azt De Prueba']);
  });
  test('avance «Preparando… n de N» mientras lee del servidor, y el botón y la casilla bloqueados', async () => {
    const { repoObs } = await conTres();
    const real = repoObs(ADMIN);
    const sueltas = [];
    const lento = { listar: () => real.listar(), leer: (id) => new Promise((r) => sueltas.push(() => r(real.leer(id)))) };
    const { el, entregas } = montarBloque(lento, { aLaVez: 1 });
    const st = el.querySelectorAll('.odt-estado')[0];
    const clic = boton(el, 'Descargar Excel').disparar('click');
    await hasta(() => sueltas.length === 1);
    assert.equal(st.textContent, 'Preparando… 0 de 2');
    assert.equal(st.getAttribute('aria-busy'), 'true', 'mientras prepara, el lector de pantalla no anuncia cada «n de N»');
    assert.equal(boton(el, 'Descargar Excel').disabled, true);
    assert.equal(casillaDe(el).disabled, true);
    // Un segundo clic mientras prepara no arma otro archivo.
    await boton(el, 'Descargar Excel').disparar('click');
    sueltas[0]();
    await hasta(() => sueltas.length === 2);
    assert.equal(st.textContent, 'Preparando… 1 de 2');
    sueltas[1]();
    await clic;
    assert.equal(entregas.length, 1, 'un solo archivo');
    assert.match(st.textContent, /^Listo: se descargó «ODT_por_subsanar_2026-11-24\.xlsx» con 2 ODT y 3 puntos\.$/);
    assert.equal(st.getAttribute('aria-busy'), 'false');
    assert.equal(boton(el, 'Descargar Excel').disabled, false);
    assert.equal(casillaDe(el).disabled, false);
  });
  test('la secuencia completa del avance (de a una)', async () => {
    const { repoObs } = await conTres();
    const vistos = [];
    const { entregar, entregas } = capturador();
    const r = await descargarExcel({ repoObs: repoObs(ADMIN), cargarXlsx: async () => XLSX_REAL, entregar, aLaVez: 1, alEstado: (t) => vistos.push(t),
      ahora: () => new Date(Date.UTC(2026, 10, 24, 15, 0)) });
    assert.deepEqual(vistos, ['Consultando las ODT por subsanar…', 'Preparando… 0 de 2', 'Preparando… 1 de 2', 'Preparando… 2 de 2', 'Armando el archivo de Excel…']);
    assert.deepEqual({ descargado: r.descargado, nombre: r.nombre, odts: r.odts, puntos: r.puntos }, { descargado: true, nombre: 'ODT_por_subsanar_2026-11-24.xlsx', odts: 2, puntos: 3 });
    assert.equal(entregas.length, 1);
  });
  test('sin ODT abiertas: lo dice (y sugiere la casilla si hay resueltas); no entrega nada', async () => {
    const { repoObs, ids } = await conTres();
    await repoObs(ADMIN).resolver(ids.uno, 'Prueba');
    await repoObs(ADMIN).resolver(ids.dos, 'Prueba');
    const { el, entregas } = montarBloque(repoObs(ADMIN));
    await boton(el, 'Descargar Excel').disparar('click');
    assert.equal(entregas.length, 0);
    assert.equal(el.querySelectorAll('.odt-estado')[0].textContent, TEXTOS_EXCEL.sinAbiertas(3));
    assert.match(TEXTOS_EXCEL.sinAbiertas(3), /marque «Incluir las ya resueltas» para descargarlas\.$/);
    assert.equal(TEXTOS_EXCEL.sinAbiertas(1), 'No hay ODT abiertas por subsanar. Hay 1 ODT resuelta: marque «Incluir las ya resueltas» para descargarla.');
    assert.equal(el.querySelectorAll('.odt-aviso--info').length, 1, 'no es un error');
    const vacio = montarBloque({ listar: async () => ({ lista: [], tope: false }), leer: async () => { throw new Error('no se llama'); } });
    await boton(vacio.el, 'Descargar Excel').disparar('click');
    assert.equal(vacio.el.querySelectorAll('.odt-estado')[0].textContent, 'No hay ODT por subsanar para descargar.');
  });
  test('error de red al consultar la lista: lo dice en llano, no entrega nada y el botón vuelve', async () => {
    const { fs, repoObs } = await conTres();
    fs.opciones.sinRedLectura = true;
    const { el, entregas } = montarBloque(repoObs(ADMIN));
    await boton(el, 'Descargar Excel').disparar('click');
    assert.equal(entregas.length, 0);
    assert.equal(el.querySelectorAll('.odt-estado')[0].textContent,
      'No se pudo preparar el Excel y no se descargó nada. No hay conexión con la plataforma. Revise su red e inténtelo de nuevo.');
    const error = el.querySelectorAll('.odt-aviso--error');
    assert.equal(error.length, 1, 'el error, en rojo');
    assert.equal(error[0].getAttribute('role'), 'alert');
    assert.equal(boton(el, 'Descargar Excel').disabled, false);
  });
  test('error al leer UNA ODT: dice cuál, no entrega un Excel a medias', async () => {
    const { repoObs, ids } = await conTres();
    const real = repoObs(ADMIN);
    const falla = { listar: () => real.listar(), leer: (id) => (id === ids.dos ? Promise.reject(new Error('No hay conexión con la plataforma.')) : real.leer(id)) };
    const { el, entregas } = montarBloque(falla);
    await boton(el, 'Descargar Excel').disparar('click');
    assert.equal(entregas.length, 0);
    assert.equal(el.querySelectorAll('.odt-estado')[0].textContent,
      'No se pudo leer la ODT N.º 90000002 del servidor y no se descargó nada. No hay conexión con la plataforma. Vuelva a intentarlo.');
    assert.equal(el.querySelectorAll('.odt-aviso--error').length, 1);
    assert.equal(boton(el, 'Descargar Excel').disabled, false);
  });
  test('si no carga el lector de Excel: lo dice y no entrega nada', async () => {
    const { repoObs } = await conTres();
    const { el, entregas } = montarBloque(repoObs(ADMIN), { cargarXlsx: async () => { throw new Error('red'); } });
    await boton(el, 'Descargar Excel').disparar('click');
    assert.equal(entregas.length, 0);
    assert.equal(el.querySelectorAll('.odt-estado')[0].textContent, TEXTOS_EXCEL.sinLector);
    assert.equal(el.querySelectorAll('.odt-aviso--error').length, 1);
  });
  test('pulsado con el teclado: al terminar, el foco vuelve al botón; con el ratón (sin foco), no se mueve', async () => {
    const { repoObs } = await conTres();
    for (const [conFoco, esperado] of [[true, [{ preventScroll: true }]], [false, []]]) {
      const { el, entregas } = montarBloque(repoObs(ADMIN));
      const b = boton(el, 'Descargar Excel');
      const enfoques = [];
      b.focus = (op) => { enfoques.push(op); };
      document.activeElement = conFoco ? b : document.body;
      try {
        await b.disparar('click');
      } finally {
        delete document.activeElement;
      }
      assert.equal(entregas.length, 1);
      assert.deepEqual(enfoques, esperado, conFoco ? 'Enter: el foco vuelve al botón' : 'sin foco en el botón: nada cambia');
    }
  });
  test('con más de 50 en la lista, avisa que solo trae las más recientes', async () => {
    const r = await descargarExcel({
      repoObs: { listar: async () => ({ lista: [{ id: 'IdObsPruebaZ00000001', nro: '90000009', estado: 'ABIERTA' }], tope: true }),
        leer: async () => ({ obs: { id: 'IdObsPruebaZ00000001', nro: '90000009', estado: 'ABIERTA' }, puntos: [] }) },
      cargarXlsx: async () => XLSX_REAL, entregar: () => {}, ahora: () => new Date(Date.UTC(2026, 10, 24, 15, 0))
    });
    assert.match(r.mensaje, /con 1 ODT y 0 puntos\. Solo trae las 50 ODT más recientes de la lista\.$/);
  });
});

describe('leerRegistros: de a varias, en el orden de la lista', () => {
  test('el resultado sale en el orden pedido aunque las respuestas lleguen al revés', async () => {
    const lista = [1, 2, 3, 4, 5].map((n) => ({ id: 'id' + n, nro: '9000000' + n }));
    const pendientes = [];
    const repo = { leer: (id) => new Promise((r) => pendientes.push([id, r])) };
    const avances = [];
    const p = leerRegistros(repo, lista, { aLaVez: 5, alAvanzar: (n, t) => avances.push(n + '/' + t) });
    await hasta(() => pendientes.length === 5);
    for (const [id, r] of [...pendientes].reverse()) r({ obs: { id }, puntos: [] });
    const out = await p;
    assert.deepEqual(out.map((x) => x.obs.id), ['id1', 'id2', 'id3', 'id4', 'id5']);
    assert.deepEqual(avances, ['1/5', '2/5', '3/5', '4/5', '5/5']);
  });
  test('con una que falla, no sigue pidiendo y dice cuál', async () => {
    const pedidas = [];
    const repo = { leer: async (id) => { pedidas.push(id); if (id === 'id2') throw new Error('Sin permiso.'); return { obs: { id }, puntos: [] }; } };
    await assert.rejects(leerRegistros(repo, [1, 2, 3, 4].map((n) => ({ id: 'id' + n, nro: '9000000' + n })), { aLaVez: 1 }),
      { message: 'No se pudo leer la ODT N.º 90000002 del servidor y no se descargó nada. Sin permiso. Vuelva a intentarlo.' });
    assert.deepEqual(pedidas, ['id1', 'id2']);
  });
});
