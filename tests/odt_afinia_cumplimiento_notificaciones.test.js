// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE · NOTIFICACIONES (99 §236, pedido del Ingeniero del 2026-11-26: «me
// gustaría que en SGM, en mi sesión, pueda apreciar cuándo y cuántas veces notificas»). Sin navegador, con dobles:
//   · el dominio: la suma de un envío y el recálculo (las ODT distintas, una vez), las fechas en la hora de Colombia y
//     «hace cuánto», los textos en llano (tipo, estado, fecha de la fila, título con los NOMBRES o, en un correo viejo,
//     sus direcciones), los avisos de una ODT;
//   · el repositorio (un SDK de mentira): el resumen del servidor, la tabla de a 20 con su cursor (limit 21 ≤ 50), los
//     conteos de la cola y de los errores (limit 50, sin los reemplazados; sin conteo en el SDK, la lista), los avisos de
//     varias ODT con «in» por lotes de 10 (limit 50) y los de una ODT; sin sesión, nada;
//   · el bloque «Notificaciones a …» con un DOM de mentira: ABIERTO, justo arriba de la sección de cumplimiento, para el
//     admin y el lector; tarjetas (En cola y Con error solo si hay); la tabla (la más reciente primero, con su estado en
//     llano, las ODT plegadas y la fecha de los datos), «Ver más notificaciones»; sin ninguna, el mensaje; si no se puede
//     leer, lo dice y ofrece consultar de nuevo; se vuelve a leer después del reproceso;
//   · la columna «Avisos recibidos» de las franjas (se consulta al abrir la franja, también la de 0 a 9 días; una
//     consulta en curso no se repite) y el buscador «Historial de avisos de una ODT»;
//   · corrector ronda 1: si el resumen no cuenta envíos que la tabla muestra, «por recalcular» (no 0 ni «ninguna»);
//   · estático: la hoja de estilos nueva enlazada una vez, con el prefijo .odt- y sin transition: all; la pantalla sin
//     innerHTML ni `.hidden =`; cada consulta del repositorio con su limit.
// Datos INVENTADOS (personas, correos @prueba.test, contratistas y N.º que empiezan por 9).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearDomFalso } from './odt_afinia_ui_dobles.js';
import { RESP_A, ALFA, BETA } from './odt_afinia_indicadores_fixture.js';
import * as C from '../assets/js/domain/odt_afinia_cumplimiento.js';
import * as N from '../assets/js/domain/odt_afinia_cumplimiento_resumen.js';
import { crearRepositorioNotificaciones, TAM_PAGINA, TOPE_CONTEO, LOTE_IN } from '../assets/js/data/odt_afinia_cumplimiento_notificaciones.js';

let guardado; let proto; const originales = {};
before(() => {
  guardado = globalThis.document;
  const dom = crearDomFalso();
  dom.createElementNS = (_ns, tag) => dom.createElement(tag);
  dom.activeElement = dom.body;
  proto = Object.getPrototypeOf(dom.createElement('div'));
  for (const k of ['focus', 'scrollIntoView', 'getBoundingClientRect']) originales[k] = proto[k];
  proto.focus = function () { dom.activeElement = this; };
  proto.scrollIntoView = function () { /* sin desplazamiento */ };
  proto.getBoundingClientRect = function () { return { top: 5000 }; };
  globalThis.document = dom;
});
after(() => {
  if (proto) for (const [k, v] of Object.entries(originales)) { if (v === undefined) delete proto[k]; else proto[k] = v; }
  if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado;
});

const { montarNotificaciones, COLS_NOTIFICACIONES, PIDE_NRO } = await import('../assets/js/ui/odt-afinia/indicadores-notificaciones.js');
const { montarVistaCorte } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');

const caja = () => document.createElement('div');
const boton = (el, texto) => el.todos().find((b) => b.tagName === 'BUTTON' && b.textContent.includes(texto));
const filasDe = (tabla) => tabla.todos().filter((x) => x.tagName === 'TBODY')[0].childNodes.map((tr) => tr.childNodes.map((td) => td.textContent));
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo'); await new Promise((r) => setTimeout(r, 5)); }
}
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false', 'NaN', '[object Object]'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}
const LEER = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/* ── fechas inventadas (UTC → hora de Colombia, UTC−5) ───────────────────────── */
const UTC = (d, h, m) => Date.UTC(2026, 10, d, h, m);
const AHORA = UTC(26, 15, 0);                       // 26/11/2026 10:00 en Colombia
const CORTE_ID = 'C'.repeat(20);

/* ═══════════════════════════════════════════════════════════════════════════════ */
describe('el dominio (puro)', () => {
  test('la suma de UN envío: +1 total y en su umbral; las ODT, solo las que no habían salido en otro correo', () => {
    const r = N.sumarEnvio({ enviados: 4, porUmbral: { 10: 2, 15: 1, 20: 1 }, odtAvisadas: 6 }, { umbral: 15, nros: ['90000001', '90000002', '90000002', ''] }, new Set(['90000001']));
    assert.deepEqual(r, { enviados: 5, porUmbral: { 10: 2, 15: 2, 20: 1 }, odtAvisadas: 7, nuevas: 1 });
    assert.deepEqual(N.sumarEnvio(null, { umbral: 10, nros: ['90000003'] }), { enviados: 1, porUmbral: { 10: 1, 15: 0, 20: 0 }, odtAvisadas: 1, nuevas: 1 });
    assert.deepEqual(N.contadoresResumen({ enviados: -3, porUmbral: { 10: 'x' }, odtAvisadas: 2.5 }), { enviados: 0, porUmbral: { 10: 0, 15: 0, 20: 0 }, odtAvisadas: 0 });
  });
  test('el recálculo: los enviados que llegan, por umbral, las ODT distintas y el primero y el último envío', () => {
    const t = (ms) => ({ toMillis: () => ms });
    const r = N.recalcularResumen([
      { umbral: 10, nros: ['90000011', '90000012'], enviadoEn: t(300) }, { umbral: 15, nros: ['90000011'], enviadoEn: t(100) },
      { umbral: 20, nros: ['90000013'], enviadoEn: null }, null
    ]);
    assert.deepEqual([r.enviados, r.porUmbral, r.odtAvisadas, r.primerEnvioEn.toMillis(), r.ultimoEnvioEn.toMillis()], [3, { 10: 1, 15: 1, 20: 1 }, 3, 100, 300]);
    assert.deepEqual(N.recalcularResumen([]), { enviados: 0, porUmbral: { 10: 0, 15: 0, 20: 0 }, odtAvisadas: 0, primerEnvioEn: null, ultimoEnvioEn: null });
    assert.deepEqual(N.enLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual([N.msDeMarca({ ms: 5 }), N.msDeMarca(7), N.msDeMarca(new Date(9)), N.msDeMarca(null), N.msDeMarca('x')], [5, 7, 9, null, null]);
  });
  test('fechas en la hora de Colombia (UTC−5) y «hace cuánto»', () => {
    assert.equal(N.fechaHoraColombia(UTC(20, 12, 12)), '20/11/2026 07:12');
    assert.equal(N.fechaHoraColombia(UTC(21, 3, 5)), '20/11/2026 22:05', 'de noche en Colombia, otro día en UTC');
    assert.equal(N.fechaCortaColombia(UTC(25, 12, 10)), '25/11 07:10');
    assert.deepEqual([N.fechaHoraColombia(null), N.fechaCortaColombia(NaN)], ['—', '—']);
    assert.deepEqual([0, 30e3, 60e3, 5 * 60e3, 3600e3, 3 * 3600e3, 86400e3, 12 * 86400e3].map((d) => N.haceCuanto(AHORA - d, AHORA)),
      ['hace un momento', 'hace un momento', 'hace 1 minuto', 'hace 5 minutos', 'hace 1 hora', 'hace 3 horas', 'hace 1 día', 'hace 12 días']);
    assert.equal(N.haceCuanto(null, AHORA), '');
  });
  test('los textos de una notificación: tipo, estado en llano, fecha de la fila, destinatarios y título', () => {
    assert.deepEqual([10, 15, 20].map(N.textoTipoNotificacion), ['10 días: ejecutar a conformidad', '15 días: apresurar el cierre', '20 días: incumplimiento']);
    const e = (x) => N.textoEstadoNotificacion(x, AHORA);
    assert.equal(e({ estado: 'enviado' }), 'Enviado');
    // Corrector ronda 1: no promete el envío sin la condición (la pantalla no sabe si los avisos siguen activos).
    assert.equal(e({ estado: 'pendiente' }), 'En cola: el script lo enviará en los próximos minutos, si los avisos siguen activos');
    assert.equal(e({ estado: 'en_envio', prestamoHastaMs: AHORA + 60e3 }), 'En cola: el script lo está enviando en este momento');
    assert.match(e({ estado: 'en_envio', prestamoHastaMs: AHORA - 1 }), /^En cola: el script lo tomó y no confirmó el envío/);
    assert.equal(e({ estado: 'error', error: 'Se acabó el cupo diario.' }), 'No se pudo enviar: Se acabó el cupo diario');
    assert.equal(e({ estado: 'error' }), 'No se pudo enviar: la plataforma no registró el motivo');
    assert.equal(e({ estado: 'error', reemplazadoPor: 'X'.repeat(20) }), 'No se envió: lo reemplazó un corte con datos más recientes');
    // Corrector ronda 1: uno que FALLÓ y después lo reemplazó un corte más reciente conserva su motivo.
    assert.equal(e({ estado: 'error', error: 'Se acabó el cupo diario.', reemplazadoPor: 'X'.repeat(20) }), 'No se pudo enviar: Se acabó el cupo diario. Sus ODT se revisaron con un corte con datos más recientes');
    assert.deepEqual(['enviado', 'pendiente', 'en_envio', 'error'].map((estado) => N.claseEstadoNotificacion({ estado })), ['enviado', 'cola', 'cola', 'error']);
    assert.equal(N.fechaDeNotificacion({ estado: 'enviado', enviadoEnMs: UTC(20, 12, 12), creadoEnMs: UTC(20, 12, 0) }), '20/11/2026 07:12');
    assert.equal(N.fechaDeNotificacion({ estado: 'pendiente', creadoEnMs: UTC(24, 13, 0) }), '24/11/2026 08:00 (en cola)');
    assert.equal(N.fechaDeNotificacion({ estado: 'error', creadoEnMs: UTC(24, 13, 0) }), '24/11/2026 08:00 (no salió)');
    assert.equal(N.destinatariosDe({ paraNombres: ['Persona Uno', ' Persona  Dos '], para: ['a@prueba.test'] }), 'Persona Uno y Persona Dos');
    assert.equal(N.destinatariosDe({ para: ['viejo.uno@prueba.test', 'viejo.dos@prueba.test'] }), 'viejo.uno@prueba.test y viejo.dos@prueba.test', 'un correo viejo sin nombres: sus direcciones');
    assert.equal(N.tituloNotificaciones({ paraNombres: ['Persona Uno'] }), 'Notificaciones a Persona Uno');
    assert.equal(N.tituloNotificaciones(null), 'Notificaciones de cumplimiento');
    assert.equal(N.tituloNotificaciones({ para: [] }), 'Notificaciones de cumplimiento');
    assert.deepEqual([N.textoConteo(3, 50), N.textoConteo(50, 50), N.textoCuantasOdt(1)], ['3', '50 o más', '1 ODT']);
  });
  test('los avisos de una ODT: los ENVIADOS con su fecha (de menor a mayor) o «Ninguno»; el estado de cada uno en llano', () => {
    assert.equal(N.textoAvisosRecibidos([{ umbral: 15, estado: 'enviado', enMs: UTC(25, 12, 10) }, { umbral: 10, estado: 'enviado', enMs: UTC(20, 12, 12) }, { umbral: 20, estado: 'reservado' }]),
      '10 d · 20/11 07:12; 15 d · 25/11 07:10');
    assert.equal(N.textoAvisosRecibidos([{ umbral: 10, estado: 'omitido' }]), 'Ninguno');
    assert.equal(N.textoAvisosRecibidos([]), 'Ninguno');
    assert.deepEqual(['enviado', 'reservado', 'omitido', 'error'].map((estado) => N.textoEstadoAviso({ estado }).split(':')[0]), ['Enviado', 'En cola', 'No se envía', 'No se pudo enviar']);
    assert.deepEqual([N.nroBuscado('  90000123 '), N.nroBuscado(''), N.nroBuscado('9'.repeat(41))], ['90000123', '', '']);
  });
});

/* ── un SDK de Firestore de mentira (lo que usa el repositorio) ──────────────────── */
function sdkFalso({ docs = {}, conConteo = true } = {}) {
  const store = new Map(Object.entries(docs));
  const consultas = [];
  const ts = (v) => (v && typeof v === 'object' && Number.isFinite(v.ms) ? { toMillis: () => v.ms } : v);
  const conMarcas = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, ts(v)]));
  function correr(q) {
    const pref = q.col + '/';
    let xs = [...store.keys()].filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes('/')).sort()
      .map((k) => ({ id: k.slice(pref.length), data: () => conMarcas(store.get(k)) }));
    let lim = Infinity; let tras = null;
    for (const f of q.filtros) {
      if (f.t === 'where') xs = xs.filter((x) => { const v = x.data()[f.campo]; return f.op === 'in' ? f.v.includes(v) : v === f.v; });
      if (f.t === 'orderBy') {
        const v = (x) => { const m = x.data()[f.campo]; return m && m.toMillis ? m.toMillis() : 0; };
        xs.sort((a, b) => (f.dir === 'desc' ? v(b) - v(a) : v(a) - v(b)));
      }
      if (f.t === 'startAfter') tras = f.s;
      if (f.t === 'limit') lim = f.n;
    }
    if (tras) xs = xs.slice(xs.findIndex((x) => x.id === tras.id) + 1);
    xs = xs.slice(0, lim);
    return { docs: xs, size: xs.length };
  }
  const F = {
    doc: (_d, ...seg) => ({ path: seg.join('/') }),
    collection: (_d, ...seg) => ({ col: seg.join('/') }),
    where: (campo, op, v) => ({ t: 'where', campo, op, v }),
    orderBy: (campo, dir = 'asc') => ({ t: 'orderBy', campo, dir }),
    limit: (n) => ({ t: 'limit', n }),
    startAfter: (s) => ({ t: 'startAfter', s }),
    query: (c, ...filtros) => ({ col: c.col, filtros }),
    async getDocFromServer(r) { const d = store.get(r.path); return { exists: () => d !== undefined, data: () => (d ? conMarcas(d) : undefined) }; },
    async getDocsFromServer(q) { consultas.push(q); return correr(q); }
  };
  if (conConteo) F.getCountFromServer = async (q) => { consultas.push({ ...q, conteo: true }); return { data: () => ({ count: correr(q).size }) }; };
  return { F, store, consultas };
}
const SESION = () => ({ uid: 'uid-lector-prueba', esAdmin: false });
const repoCon = (s, sesion = SESION) => crearRepositorioNotificaciones({ sdk: s.F, db: { falso: true }, sesion });
const correoDoc = (k, extra = {}) => ({ corteId: CORTE_ID, umbral: 10, estado: 'enviado', nros: ['9000010' + (k % 10)], para: ['destino.uno@prueba.test'], paraNombres: ['Persona Uno'], reemplazadoPor: '', creadoEn: { ms: 1000 + k }, enviadoEn: { ms: 2000 + k }, ...extra });

describe('el repositorio (SDK de mentira)', () => {
  test('el resumen del servidor (o null), con sus fechas en milisegundos', async () => {
    const s = sdkFalso({ docs: { 'odt_afinia_config/cumplimiento_resumen': { enviados: 7, porUmbral: { 10: 3, 15: 2, 20: 2 }, odtAvisadas: 5, primerEnvioEn: { ms: 10 }, ultimoEnvioEn: { ms: 20 }, actualizadoEn: { ms: 30 }, porRecalcular: true } } });
    assert.deepEqual(await repoCon(s).leerResumen(), { enviados: 7, porUmbral: { 10: 3, 15: 2, 20: 2 }, odtAvisadas: 5, primerEnvioEnMs: 10, ultimoEnvioEnMs: 20, actualizadoEnMs: 30, porRecalcular: true });
    assert.equal(await repoCon(sdkFalso()).leerResumen(), null);
  });
  test('la tabla: la más reciente primero, de a 20 (limit 21 ≤ 50 para saber si hay más) y la página siguiente con su cursor', async () => {
    const docs = {};
    for (let k = 0; k < 25; k++) docs['odt_afinia_correos/' + 'K' + String(k).padStart(19, '0') + '_10'] = correoDoc(k);
    const s = sdkFalso({ docs });
    const repo = repoCon(s);
    const p1 = await repo.listar();
    assert.equal(TAM_PAGINA, 20);
    assert.deepEqual([p1.items.length, p1.hayMas, p1.items[0].creadoEnMs, p1.items[0].enviadoEnMs], [20, true, 1024, 2024]);
    assert.deepEqual(s.consultas[0].filtros, [{ t: 'orderBy', campo: 'creadoEn', dir: 'desc' }, { t: 'limit', n: 21 }]);
    const p2 = await repo.listar({ despuesDe: p1.cursor });
    assert.deepEqual([p2.items.length, p2.hayMas, p2.items[0].creadoEnMs], [5, false, 1004]);
    assert.ok(s.consultas[1].filtros.some((f) => f.t === 'startAfter' && f.s === p1.cursor));
  });
  test('los conteos: en cola (pendiente o en manos del script) y con error SIN los reemplazados, con limit 50; sin conteo en el SDK, la lista', async () => {
    const docs = {
      'odt_afinia_correos/A_10': correoDoc(1, { estado: 'pendiente' }), 'odt_afinia_correos/B_10': correoDoc(2, { estado: 'en_envio' }),
      'odt_afinia_correos/C_10': correoDoc(3, { estado: 'error', error: 'x' }), 'odt_afinia_correos/D_10': correoDoc(4, { estado: 'error', reemplazadoPor: 'X'.repeat(20) }),
      'odt_afinia_correos/E_10': correoDoc(5)
    };
    for (const conConteo of [true, false]) {
      const s = sdkFalso({ docs, conConteo });
      assert.deepEqual(await repoCon(s).contarPendientes(), { enCola: 2, conError: 1, tope: TOPE_CONTEO });
      assert.deepEqual(s.consultas.map((q) => q.filtros.map((f) => [f.t, f.campo || f.n, f.op, f.v])), [
        [['where', 'estado', 'in', ['pendiente', 'en_envio']], ['limit', 50, undefined, undefined]],
        [['where', 'estado', '==', 'error'], ['where', 'reemplazadoPor', '==', ''], ['limit', 50, undefined, undefined]]
      ]);
      assert.equal(s.consultas.every((q) => q.conteo === (conConteo || undefined)), true);
    }
  });
  test('los avisos de varias ODT: «in» por lotes de 10 con limit 50 → Map N.º → [avisos]; los de una ODT: == con limit 50', async () => {
    const docs = {};
    const nros = Array.from({ length: 25 }, (_, i) => String(90000200 + i));
    for (const n of nros.slice(0, 3)) docs['odt_afinia_avisos/' + n + '_10'] = { nro: n, umbral: 10, estado: 'enviado', en: { ms: 500 } };
    docs['odt_afinia_avisos/90000200_15'] = { nro: '90000200', umbral: 15, estado: 'reservado', en: { ms: 600 } };
    const s = sdkFalso({ docs });
    const m = await repoCon(s).avisosDeOdts([...nros, nros[0]]);
    assert.equal(LOTE_IN, 10);
    assert.deepEqual(s.consultas.map((q) => [q.filtros[0].op, q.filtros[0].v.length, q.filtros[1].n]), [['in', 10, 50], ['in', 10, 50], ['in', 5, 50]]);
    assert.deepEqual(m.get('90000200').map((a) => [a.umbral, a.estado, a.enMs]).sort(), [[10, 'enviado', 500], [15, 'reservado', 600]]);
    assert.equal(m.has('90000210'), false);
    assert.equal((await repoCon(s).avisosDeOdts([])).size, 0);
    const uno = await repoCon(s).avisosDeOdt('90000201');
    assert.deepEqual(uno.map((a) => a.umbral), [10]);
    assert.deepEqual(s.consultas.at(-1).filtros, [{ t: 'where', campo: 'nro', op: '==', v: '90000201' }, { t: 'limit', n: 50 }]);
  });
  test('sin sesión no consulta nada (lo dice en llano)', async () => {
    const s = sdkFalso();
    await assert.rejects(repoCon(s, () => null).listar(), (e) => e.codigo === 'cuenta');
    await assert.rejects(repoCon(s, () => null).leerResumen(), (e) => e.codigo === 'cuenta');
    assert.equal(s.consultas.length, 0);
  });
});

/* ── un repositorio de notificaciones de mentira (para la pantalla) ───────────────── */
const ITEMS = [
  { id: 'A'.repeat(20) + '_15', corteId: 'A'.repeat(20), umbral: 15, estado: 'enviado', paraNombres: ['Persona Uno', 'Persona Dos'], para: ['destino.uno@prueba.test', 'destino.dos@prueba.test'],
    nros: ['90000831', '90000832'], creadoEnMs: UTC(25, 12, 0), enviadoEnMs: UTC(25, 12, 10), datosDel: '25/11/2026 10:00' },
  { id: CORTE_ID + '_10', corteId: CORTE_ID, umbral: 10, estado: 'pendiente', paraNombres: ['Persona Uno', 'Persona Dos'], nros: ['90000804'], creadoEnMs: UTC(24, 13, 0), datosDel: '' },
  { id: 'B'.repeat(20) + '_20', corteId: 'B'.repeat(20), umbral: 20, estado: 'error', error: 'Se acabó el cupo diario de correos de la cuenta remitente.', paraNombres: ['Persona Uno'],
    nros: ['90000803'], creadoEnMs: UTC(23, 13, 0), datosDel: '23/11/2026 08:00' },
  // Un correo VIEJO (sin paraNombres ni datosDel): muestra la dirección y enlaza a su corte.
  { id: 'D'.repeat(20) + '_10', corteId: 'D'.repeat(20), umbral: 10, estado: 'enviado', para: ['destino.viejo@prueba.test'], nros: ['90000801'], creadoEnMs: UTC(20, 12, 0), enviadoEnMs: UTC(20, 12, 12) }
];
const RESUMEN = { enviados: 7, porUmbral: { 10: 3, 15: 2, 20: 2 }, odtAvisadas: 5, primerEnvioEnMs: UTC(10, 12, 0), ultimoEnvioEnMs: UTC(25, 12, 10), actualizadoEnMs: UTC(25, 12, 10), porRecalcular: false };
function notifFalso({ resumen = RESUMEN, paginas = [ITEMS], conteo = { enCola: 1, conError: 50, tope: 50 }, avisos = new Map(), fallar = false } = {}) {
  const r = { resumenes: 0, listados: [], conteos: 0, pedidosOdts: [], pedidosOdt: [] };
  return Object.assign(r, {
    async leerResumen() { r.resumenes++; if (fallar) throw new Error('La plataforma no respondió (prueba).'); return resumen; },
    async listar({ despuesDe = null } = {}) {
      r.listados.push(despuesDe);
      const i = despuesDe ? despuesDe.pagina + 1 : 0;
      const items = paginas[i] || [];
      return { items, hayMas: i + 1 < paginas.length, cursor: { pagina: i } };
    },
    async contarPendientes() { r.conteos++; return conteo; },
    async avisosDeOdts(nros) { r.pedidosOdts.push([...nros]); return new Map(nros.filter((n) => avisos.has(n)).map((n) => [n, avisos.get(n)])); },
    async avisosDeOdt(nro) { r.pedidosOdt.push(nro); return avisos.get(nro) || []; }
  });
}
const corte = (extra = {}) => ({ id: CORTE_ID, version: 3, responsable: RESP_A, archivo: { nombre: 'INFORME_ODT_20261121150000_prueba.csv', sha256: 'ab'.repeat(32) },
  fechaDatos: '2026-11-21T15:00:00', rango: { desde: '2026-10-15', hasta: '2026-10-15' }, odts: 0, filasResponsable: 0, odtsArchivo: 10, filasArchivo: 12, totales: { total: 0 }, ...extra });
const montar = (p = {}) => { const z = caja(); const m = montarNotificaciones(z, { corte: corte(), ahora: () => AHORA, ...p }); return { z, m }; };

describe('el bloque «Notificaciones a …»', () => {
  test('título con los NOMBRES del correo más reciente; en llano, que no depende de los filtros; tarjetas (En cola y Con error porque hay)', async () => {
    const repo = notifFalso();
    const { z, m } = montar({ repo });
    await hasta(() => m.estado().cargado);
    assert.equal(z.querySelectorAll('.odt-not-titulo')[0].textContent, 'Notificaciones a Persona Uno y Persona Dos');
    assert.equal(z.querySelectorAll('.odt-not-titulo')[0].tagName, 'H3');
    assert.match(z.textContent, /Este registro no depende de los filtros de periodo ni de contratista de esta página/);
    const tarjetas = z.querySelectorAll('.odt-not-tarjeta').map((t) => t.childNodes[0].childNodes.map((x) => x.textContent));
    assert.deepEqual(tarjetas, [
      ['7', 'Notificaciones enviadas', 'en total'],
      ['3', 'De 10 días', 'ejecutar a conformidad'],
      ['2', 'De 15 días', 'apresurar el cierre'],
      ['2', 'De 20 días', 'incumplimiento'],
      ['5', 'ODT avisadas', 'con al menos un aviso enviado'],
      ['25/11/2026 07:10', 'Última notificación', 'hora de Colombia · hace 1 día'],
      ['1', 'En cola', 'salen con el próximo envío del script, si los avisos siguen activos'],
      ['50 o más', 'Con error', 'no se pudieron enviar: el motivo está en la tabla']
    ]);
    assert.equal(z.querySelectorAll('.odt-not-vacio').length, 0);
    sinRestos(z);
  });
  test('la tabla «Cuándo se le notificó»: la más reciente primero, fecha de Colombia, tipo, para, ODT plegadas, estado en llano y datos del informe', async () => {
    const { z, m } = montar({ repo: notifFalso() });
    await hasta(() => m.estado().cargado);
    const tabla = z.querySelectorAll('.odt-not-tabla')[0];
    assert.deepEqual(tabla.todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').map((x) => x.textContent), [...COLS_NOTIFICACIONES]);
    assert.deepEqual([...COLS_NOTIFICACIONES], ['Fecha y hora de envío', 'Tipo', 'Para', 'ODT incluidas', 'Estado', 'Datos del informe del']);
    const filas = filasDe(tabla);
    assert.deepEqual(filas[0], ['25/11/2026 07:10', '15 días: apresurar el cierre', 'Persona Uno y Persona Dos', '2 ODT · ver sus N.º90000831, 90000832', 'Enviado', '25/11/2026 10:00']);
    assert.deepEqual(filas[1], ['24/11/2026 08:00 (en cola)', '10 días: ejecutar a conformidad', 'Persona Uno y Persona Dos', '1 ODT · ver sus N.º90000804', 'En cola: el script lo enviará en los próximos minutos, si los avisos siguen activos', '21/11/2026 10:00 (este corte)']);
    assert.deepEqual(filas[2].slice(0, 2), ['23/11/2026 08:00 (no salió)', '20 días: incumplimiento']);
    assert.equal(filas[2][4], 'No se pudo enviar: Se acabó el cupo diario de correos de la cuenta remitente');
    assert.deepEqual([filas[3][0], filas[3][2], filas[3][5]], ['20/11/2026 07:12', 'destino.viejo@prueba.test', 'Ver el corte'], 'un correo viejo: su dirección y el enlace a su corte');
    const para = tabla.todos().filter((x) => x.getAttribute('data-etq') === 'Para');
    assert.deepEqual(para.map((x) => x.className.includes('odt-romper')), [false, false, false, true], 'los nombres parten entre palabras; una dirección, donde haga falta');
    // Las ODT van plegadas (details): la cantidad es lo que se ve; sus N.º, al desplegar.
    const det = tabla.todos().filter((x) => x.tagName === 'DETAILS');
    assert.equal(det.length, 4);
    assert.equal(det[0].childNodes[0].tagName, 'SUMMARY');
    assert.equal(det[0].getAttribute('open'), null);
    assert.equal(tabla.todos().find((x) => x.tagName === 'A' && x.textContent === '25/11/2026 10:00').getAttribute('href'), '#indicadores=' + 'A'.repeat(20));
    assert.ok(tabla.todos().some((x) => x.className.includes('odt-not-estado--error')) && tabla.todos().some((x) => x.className.includes('odt-not-estado--cola')));
    assert.equal(boton(z, 'Ver más'), undefined, 'una sola página: sin «Ver más»');
    sinRestos(z);
  });
  test('«Ver más notificaciones»: trae la página siguiente con el cursor, la agrega, lo anuncia y se quita al terminar', async () => {
    const otra = [{ ...ITEMS[3], id: 'E'.repeat(20) + '_10', corteId: 'E'.repeat(20), creadoEnMs: UTC(18, 12, 0), enviadoEnMs: UTC(18, 12, 30) }];
    const repo = notifFalso({ paginas: [ITEMS, otra] });
    const { z, m } = montar({ repo });
    await hasta(() => m.estado().cargado);
    const mas = boton(z, 'Ver más notificaciones');
    assert.ok(mas);
    await mas.disparar('click');
    assert.deepEqual(repo.listados, [null, { pagina: 0 }]);
    const filas = filasDe(z.querySelectorAll('.odt-not-tabla')[0]);
    assert.equal(filas.length, 5);
    assert.equal(filas[4][0], '18/11/2026 07:30');
    assert.equal(boton(z, 'Ver más notificaciones'), undefined, 'ya no hay más');
    assert.equal(z.querySelectorAll('.odt-not-estado-tabla')[0].textContent, 'Se muestran 5 notificaciones: son todas.');
    assert.equal(document.activeElement.textContent, '18/11/2026 07:30', 'el foco va a la primera fila nueva');
  });
  test('una página de «Ver más» que llega DESPUÉS de releer el bloque (p. ej. tras un reproceso) se descarta', async () => {
    const otra = [{ ...ITEMS[3], id: 'F'.repeat(20) + '_10', corteId: 'F'.repeat(20), creadoEnMs: UTC(17, 12, 0), enviadoEnMs: UTC(17, 12, 30) }];
    const repo = notifFalso({ paginas: [ITEMS, otra] });
    let soltar;
    const listar = repo.listar;
    const { z, m } = montar({ repo });
    await hasta(() => m.estado().cargado);
    repo.listar = (p) => (p && p.despuesDe ? new Promise((res) => { soltar = () => res(listar(p)); }) : listar(p));
    const enCurso = boton(z, 'Ver más notificaciones').disparar('click');
    await hasta(() => typeof soltar === 'function');
    await m.cargar();
    soltar(); await enCurso;
    assert.equal(filasDe(z.querySelectorAll('.odt-not-tabla')[0]).length, 4, 'la tabla releída no se mezcla con la página vieja');
  });
  test('sin ninguna enviada: «Todavía no se ha enviado ninguna notificación» (sin tarjetas ni tabla); con algo en cola, la tabla', async () => {
    const vacio = montar({ repo: notifFalso({ resumen: null, paginas: [[]], conteo: { enCola: 0, conError: 0, tope: 50 } }) });
    await hasta(() => vacio.m.estado().cargado);
    assert.equal(vacio.z.querySelectorAll('.odt-not-vacio')[0].textContent, 'Todavía no se ha enviado ninguna notificación.');
    assert.equal(vacio.z.querySelectorAll('.odt-not-titulo')[0].textContent, 'Notificaciones de cumplimiento');
    assert.equal(vacio.z.querySelectorAll('.odt-not-tarjeta').length + vacio.z.querySelectorAll('.odt-not-tabla').length, 0);
    const cola = montar({ repo: notifFalso({ resumen: null, paginas: [[ITEMS[1]]], conteo: { enCola: 1, conError: 0, tope: 50 } }) });
    await hasta(() => cola.m.estado().cargado);
    assert.equal(cola.z.querySelectorAll('.odt-not-vacio').length, 1);
    assert.equal(filasDe(cola.z.querySelectorAll('.odt-not-tabla')[0]).length, 1);
    assert.deepEqual(cola.z.querySelectorAll('.odt-not-tarjeta').map((t) => t.className.split('--')[1]), ['enviados', 'u10', 'u15', 'u20', 'odt', 'ultima', 'cola'], 'sin «Con error» (no hay)');
    sinRestos(vacio.z); sinRestos(cola.z);
  });
  test('corrector ronda 1: si el resumen no cuenta envíos que la tabla SÍ muestra, no dice «ninguna» ni pone 0', async () => {
    for (const resumen of [{ enviados: 0, porUmbral: { 10: 0, 15: 0, 20: 0 }, odtAvisadas: 0, porRecalcular: true }, null]) {
      const { z, m } = montar({ repo: notifFalso({ resumen, conteo: { enCola: 0, conError: 0, tope: 50 } }) });
      await hasta(() => m.estado().cargado);
      assert.equal(z.querySelectorAll('.odt-aviso')[0].textContent, N.NOTA_POR_RECALCULAR);
      assert.equal(z.querySelectorAll('.odt-not-vacio').length, 0, 'no dice «Todavía no se ha enviado ninguna notificación»');
      const tarjetas = z.querySelectorAll('.odt-not-tarjeta').map((t) => t.childNodes[0].childNodes.map((x) => x.textContent));
      assert.deepEqual(tarjetas.slice(0, 5).map((t) => [t[0], t[2]]), Array(5).fill(['—', 'por recalcular']));
      assert.deepEqual(tarjetas[5], ['25/11/2026 07:10', 'Última notificación', 'hora de Colombia · hace 1 día'], 'la última, de la tabla');
      assert.equal(filasDe(z.querySelectorAll('.odt-not-tabla')[0])[0][4], 'Enviado');
      sinRestos(z);
    }
    assert.match(N.NOTA_POR_RECALCULAR, /se corrigen solas con la próxima notificación/);
    assert.match(N.NOTA_POR_RECALCULAR, /de un corte que tenga la fecha de ejecución/, 'no da por hecho que el botón está en este corte');
  });
  test('si las cuentas quedaron «por recalcular», lo dice en llano; si no se puede leer, lo dice y ofrece consultar de nuevo', async () => {
    const pr = montar({ repo: notifFalso({ resumen: { ...RESUMEN, porRecalcular: true } }) });
    await hasta(() => pr.m.estado().cargado);
    assert.equal(pr.z.querySelectorAll('.odt-aviso')[0].textContent, N.NOTA_POR_RECALCULAR);
    const repo = notifFalso({ fallar: true });
    const { z } = montar({ repo });
    await hasta(() => z.querySelectorAll('.odt-aviso--error').length === 1);
    assert.match(z.querySelectorAll('.odt-aviso--error')[0].textContent, /^No se pudieron leer las notificaciones: La plataforma no respondió/);
    repo.leerResumen = async () => RESUMEN;
    await boton(z, 'Consultar de nuevo').disparar('click');
    await hasta(() => z.querySelectorAll('.odt-not-tabla').length === 1);
    sinRestos(z);
  });
  test('el buscador «Historial de avisos de una ODT»: sin N.º lo pide; con avisos, su tabla (umbral, estado en llano, fecha); sin avisos, lo dice', async () => {
    const avisos = new Map([['90000831', [{ nro: '90000831', umbral: 15, estado: 'reservado', enMs: UTC(26, 12, 0) }, { nro: '90000831', umbral: 10, estado: 'enviado', enMs: UTC(20, 12, 12) }]]]);
    const repo = notifFalso({ avisos });
    const { z, m } = montar({ repo });
    await hasta(() => m.estado().cargado);
    const form = z.todos().find((x) => x.tagName === 'FORM');
    assert.equal(form.getAttribute('aria-label'), 'Historial de avisos de una ODT');
    const input = form.todos().find((x) => x.tagName === 'INPUT');
    assert.equal(form.todos().find((x) => x.tagName === 'LABEL').htmlFor, input.id, 'la etiqueta va con su campo');
    let evitado = false;
    await form.disparar('submit');
    assert.equal(z.querySelectorAll('.odt-not-buscar-resultado')[0].textContent, PIDE_NRO);
    assert.equal(repo.pedidosOdt.length, 0);
    input.value = ' 90000831 ';
    for (const fn of form._esc.submit) await fn({ preventDefault: () => { evitado = true; } });
    assert.ok(evitado, 'no recarga la página');
    assert.deepEqual(repo.pedidosOdt, ['90000831']);
    const t = z.querySelectorAll('.odt-not-tabla-avisos')[0];
    assert.deepEqual(filasDe(t), [['10 días: ejecutar a conformidad', 'Enviado', '20/11/2026 07:12'], ['15 días: apresurar el cierre', 'En cola: sale con el próximo envío del script', '26/11/2026 07:00']]);
    input.value = '90009999';
    await form.disparar('submit');
    assert.match(z.querySelectorAll('.odt-not-buscar-resultado')[0].textContent, /^La ODT 90009999 no tiene avisos registrados/);
    sinRestos(z);
  });
});

/* ── en la vista del corte: arriba de la sección de cumplimiento, para el admin y el lector ── */
const DIA = '2026-11-21';
const o3 = (nro, dias, empresa = ALFA) => ({
  nro, empresa, tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion: 'S/E PRUEBA ' + nro.slice(-1), prevista: '2026-10-15', cerrada: '', estado: 'EJECUTADA', principal: true,
  azt: 'AZT FICTICIO UNO', jefe: 'JEFE FICTICIO UNO', ejecucion: C.sumarDias(DIA, -dias), equipo: 'EQUIPO FICTICIO ' + nro.slice(-1)
});
const ODTS = [o3('90000901', 25, BETA), o3('90000902', 12), o3('90000903', 3)];
function repoCumFalso() {
  const r = { reprocesos: [] };
  return Object.assign(r, { async listarCorreos() { return []; }, async reprocesar(id) { r.reprocesos.push(id); return { motivo: 'procesado', encolados: [], errores: [] }; } });
}
const vista = (p = {}) => {
  const c = caja();
  const v = montarVistaCorte(c, { corte: corte({ odts: ODTS.length, filasResponsable: ODTS.length, totales: { total: ODTS.length } }), odts: ODTS, alIr: () => {}, historial: [], repoCumplimiento: repoCumFalso(), ...p });
  return { c, v };
};

describe('en la vista del corte', () => {
  test('el bloque va ABIERTO (no plegado) justo arriba de la sección de cumplimiento; lo ven el admin y el lector', async () => {
    for (const soloLectura of [false, true]) {
      const repo = notifFalso();
      const { c, v } = vista({ repoNotificaciones: repo, soloLectura });
      const secciones = c.childNodes;
      const iNot = secciones.findIndex((x) => x.className.includes('odt-not'));
      const iCum = secciones.findIndex((x) => x.className.includes('odt-cum'));
      assert.ok(iNot >= 0 && iNot === iCum - 1, 'justo arriba del cumplimiento');
      const bloque = secciones[iNot];
      assert.equal(bloque.tagName, 'SECTION');
      // Corrector ronda 1: se nombra con su título VISIBLE (que cambia a «Notificaciones a …»), no con un texto fijo.
      assert.equal(bloque.getAttribute('aria-label'), null);
      assert.equal(bloque.getAttribute('aria-labelledby'), bloque.querySelectorAll('.odt-not-titulo')[0].id);
      assert.ok(bloque.getAttribute('aria-labelledby'));
      assert.ok(!['DETAILS'].includes(bloque.childNodes[0].tagName) && bloque.childNodes[0].tagName === 'H3', 'abierto: su título a la vista');
      await hasta(() => v.notificaciones.estado().cargado);
      assert.equal(repo.resumenes, 1, 'se lee al montarse');
      assert.equal(bloque.querySelectorAll('.odt-not-titulo')[0].textContent, 'Notificaciones a Persona Uno y Persona Dos');
      sinRestos(c);
    }
  });
  test('«Avisos recibidos» por ODT: al abrir la franja consulta sus avisos (una vez) y escribe los ENVIADOS con su fecha o «Ninguno»; también la de 0 a 9 días', async () => {
    const avisos = new Map([['90000901', [{ nro: '90000901', umbral: 10, estado: 'enviado', enMs: UTC(20, 12, 12) }, { nro: '90000901', umbral: 20, estado: 'enviado', enMs: UTC(25, 12, 10) }, { nro: '90000901', umbral: 15, estado: 'omitido', enMs: 1 }]]]);
    const repo = notifFalso({ avisos });
    const { c } = vista({ repoNotificaciones: repo });
    const s = c.querySelectorAll('.odt-cum')[0];
    const det = s.querySelectorAll('.odt-cum-franja-detalle');
    assert.deepEqual(det.map((d) => d.childNodes[0].textContent), ['0 a 9 días (1)', '10 a 14 días (1)', 'Más de 20 días: vencidas (1)']);
    const celda = (d) => d.querySelectorAll('.odt-cum-avisos-odt')[0];
    // Corrector ronda 1: la de 0 a 9 días también consulta (en un corte viejo esa ODT pudo recibir avisos después).
    assert.equal(celda(det[0]).textContent, '—', '0 a 9 días: cerrada, todavía no consulta');
    assert.equal(celda(det[2]).textContent, '—', 'cerrada: todavía no consulta');
    assert.match(s.querySelectorAll('.odt-cum-nota-recibidos')[0].textContent, /enviados hasta hoy, no hasta la fecha de este corte/);
    assert.equal(repo.pedidosOdts.length, 0);
    det[2].open = true; await det[2].disparar('toggle');
    await hasta(() => celda(det[2]).textContent !== 'Consultando…');
    assert.equal(celda(det[2]).textContent, '10 d · 20/11 07:12; 20 d · 25/11 07:10');
    assert.equal(celda(det[2]).getAttribute('data-etq'), 'Avisos recibidos');
    det[1].open = true; await det[1].disparar('toggle');
    await hasta(() => celda(det[1]).textContent === 'Ninguno');
    det[0].open = true; await det[0].disparar('toggle');
    await hasta(() => celda(det[0]).textContent === 'Ninguno');
    assert.deepEqual(repo.pedidosOdts, [['90000901'], ['90000902'], ['90000903']], 'también la de 0 a 9 días');
    det[2].open = false; await det[2].disparar('toggle'); det[2].open = true; await det[2].disparar('toggle');
    assert.equal(repo.pedidosOdts.length, 3, 'lo leído se guarda mientras la vista siga abierta');
    // Cambiar los filtros repinta las franjas: la abierta vuelve a tener sus avisos sin consultar otra vez.
    const sel = c.todos().find((x) => x.id === 'odtIndEmpresa');
    sel.value = BETA; await sel.disparar('change');
    const det2 = c.querySelectorAll('.odt-cum')[0].querySelectorAll('.odt-cum-franja-detalle');
    await hasta(() => celda(det2[0]).textContent === '10 d · 20/11 07:12; 20 d · 25/11 07:10');
    assert.equal(repo.pedidosOdts.length, 3);
    sinRestos(c);
  });
  test('corrector ronda 1: una franja que NACE abierta (y el «toggle» que el navegador dispara por eso) consulta sus N.º UNA vez', async () => {
    const repo = notifFalso();
    const soltar = [];
    repo.avisosDeOdts = (nros) => { repo.pedidosOdts.push([...nros]); return new Promise((res) => { soltar.push(() => res(new Map())); }); };
    const odts = [...ODTS, o3('90000904', 13, BETA)];
    const { c } = vista({ repoNotificaciones: repo, odts, corte: corte({ odts: odts.length, filasResponsable: odts.length, totales: { total: odts.length } }) });
    const sel = c.todos().find((x) => x.id === 'odtIndEmpresa');
    const franja = () => c.querySelectorAll('.odt-cum')[0].querySelectorAll('.odt-cum-franja-detalle').find((d) => d.childNodes[0].textContent.startsWith('10 a 14'));
    sel.value = ALFA; await sel.disparar('change');
    franja().open = true; await franja().disparar('toggle');
    await hasta(() => soltar.length === 1);
    soltar.shift()();
    await hasta(() => franja().querySelectorAll('.odt-cum-avisos-odt')[0].textContent === 'Ninguno');
    // Sin filtro: la franja se repinta ABIERTA con una ODT nueva (la 904). enlazar la consulta y, mientras tanto,
    // llega el «toggle» del navegador: no se pide otra vez.
    sel.value = ''; await sel.disparar('change');
    const det = franja();
    assert.equal(det.getAttribute('open'), '');
    await det.disparar('toggle');
    await hasta(() => soltar.length >= 1);
    assert.deepEqual(repo.pedidosOdts, [['90000902'], ['90000904']], 'la 904 una sola vez');
    soltar.shift()();
    await hasta(() => det.querySelectorAll('.odt-cum-avisos-odt').every((td) => td.textContent === 'Ninguno'));
    assert.equal(repo.pedidosOdts.length, 2);
    sinRestos(c);
  });
  test('si la consulta de los avisos falla, la celda lo dice y al volver a abrir la franja se reintenta', async () => {
    const repo = notifFalso();
    let falla = true;
    repo.avisosDeOdts = async (nros) => { repo.pedidosOdts.push(nros); if (falla) throw new Error('sin red'); return new Map(); };
    const { c } = vista({ repoNotificaciones: repo });
    const det = c.querySelectorAll('.odt-cum')[0].querySelectorAll('.odt-cum-franja-detalle');
    det[1].open = true; await det[1].disparar('toggle');
    await hasta(() => /^No se pudo consultar/.test(det[1].querySelectorAll('.odt-cum-avisos-odt')[0].textContent));
    falla = false;
    det[1].open = false; await det[1].disparar('toggle'); det[1].open = true; await det[1].disparar('toggle');
    await hasta(() => det[1].querySelectorAll('.odt-cum-avisos-odt')[0].textContent === 'Ninguno');
    assert.equal(repo.pedidosOdts.length, 2);
  });
  test('después de «Revisar y enviar los avisos de este corte», el bloque se vuelve a leer', async () => {
    const repo = notifFalso();
    const { c, v } = vista({ repoNotificaciones: repo });
    await hasta(() => v.notificaciones.estado().cargado);
    const det = c.querySelectorAll('.odt-cum-correos')[0];
    await boton(det, 'Revisar y enviar los avisos de este corte').disparar('click');
    await boton(det, 'Sí, revisar y enviar').disparar('click');
    await hasta(() => repo.resumenes === 2);
    assert.equal(repo.listados.length, 2);
  });
});

describe('estático', () => {
  test('la hoja nueva: enlazada UNA vez, después de la del cumplimiento; prefijo .odt-, sin transition: all ni backdrop-filter', () => {
    const pagina = LEER('pages/firma-odt-afinia.html');
    assert.equal(pagina.split('\n').filter((l) => l.includes('odt-afinia-notificaciones.css')).length, 1);
    assert.ok(pagina.indexOf('odt-afinia-cumplimiento.css') < pagina.indexOf('odt-afinia-notificaciones.css'));
    const css = LEER('assets/css/odt-afinia-notificaciones.css');
    assert.match(css, /Archivo NUEVO \(L-102\)/);
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/transition\s*:\s*all|backdrop-filter/.test(sinComentarios));
    for (const bloque of sinComentarios.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
      for (const sel of bloque[1].split(',').map((x) => x.trim()).filter(Boolean)) assert.match(sel, /^\.odt-/, 'selector sin prefijo: ' + sel);
    }
  });
  test('la pantalla: sin innerHTML ni `.hidden =` (un `hidden` lo pisaría el display propio de una caja); el repositorio: cada consulta con su limit', () => {
    const ui = codigo(LEER('assets/js/ui/odt-afinia/indicadores-notificaciones.js'));
    assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(ui));
    assert.ok(!/\.hidden\s*=/.test(ui));
    const datos = codigo(LEER('assets/js/data/odt_afinia_cumplimiento_notificaciones.js'));
    const consultas = (datos.match(/F\.query\(/g) || []).length;
    assert.ok(consultas >= 5);
    assert.equal((datos.match(/F\.limit\(/g) || []).length, consultas, 'una F.limit por cada F.query');
    assert.match(datos, /const partes = \[F\.orderBy\('creadoEn', 'desc'\), \.\.\.\(despuesDe \? \[F\.startAfter\(despuesDe\)\] : \[\]\), F\.limit\(TAM_PAGINA \+ 1\)\];/);
    assert.ok(TAM_PAGINA + 1 <= 50 && TOPE_CONTEO <= 50);
    assert.ok(!/setDoc|updateDoc|deleteDoc|writeBatch|addDoc/.test(datos), 'la página no escribe nada de esto');
  });
});
