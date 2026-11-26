// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE (99 §236) · PANTALLA y DATOS con dobles (DOM de mentira y Firestore en
// memoria de tests/odt_afinia_ui_dobles.js), sin navegador:
//   · la sección «Cumplimiento del cierre (20 días desde la ejecución)» en la vista de un corte de la versión 3:
//     tarjetas, tabla por contratista, franjas de las abiertas con su lista y «fechas por revisar»; RESPETA los filtros
//     de arriba (al cambiar el contratista se recalcula); las tarjetas de los estados (odt-ind-…) no cambian;
//   · un corte de la versión 1 o 2: lo dice en llano (al admin, «guarde un corte nuevo»; al lector, lo que él puede);
//   · el historial de correos se lee SOLO al abrirlo; el admin tiene «Revisar y enviar los avisos de este corte» en dos
//     pasos (llama al reproceso y vuelve a leer el historial; si la vista se cerró mientras tanto, no pinta ni lee); el
//     lector no, y no ve las direcciones de los destinatarios ni de las copias (solo cuántos son);
//   · la lista de abiertas trae el EQUIPO; las franjas se leen «N ODT con …» y dicen cuándo sale el correo;
//   · «Avisos de cumplimiento por correo» (solo admin, plegado): lee al abrirse, valida en llano, guarda en dos pasos;
//     99 §236: ya no habla de la clave de Gmail; muestra el estado del script de Google (última conexión, último
//     resultado) y, si un script pide permiso, «Aprobar este script» en dos pasos;
//   · el historial: los estados en llano («En cola: lo enviará el script de Google…», «Enviándose…», «Enviado el…»,
//     «No se pudo enviar: …») y el resultado del reproceso («Quedaron en cola…»);
//   · el repositorio: la configuración de 6 claves (conserva el script aprobado si el formulario no lo trae), el
//     historial (el último primero, limit 50), el reproceso (errores de la función en llano) y el del estado del script;
//   · la pestaña entera: el admin ve el bloque de configuración; el lector, no; ninguna vista deja «null» pintado.
// Datos INVENTADOS (personas, correos @prueba.test, contratistas y N.º que empiezan por 9).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso, crearFirestoreFalso } from './odt_afinia_ui_dobles.js';
import { conConsultas, RESP_A, ALFA, BETA, csv, odt } from './odt_afinia_indicadores_fixture.js';
import { leerCsv, analizarResponsable } from '../assets/js/domain/odt_afinia_indicadores.js';
import * as C from '../assets/js/domain/odt_afinia_cumplimiento.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import { crearRepositorioCumplimiento } from '../assets/js/data/odt_afinia_cumplimiento.js';
import { crearRepositorioScript } from '../assets/js/data/odt_afinia_cumplimiento_script.js';
import * as R from '../assets/js/domain/odt_afinia_cumplimiento_remitente.js';

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

const { montarVistaCorte } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
const { montarCumplimiento } = await import('../assets/js/ui/odt-afinia/indicadores-cumplimiento.js');
const { montarSeccionAvisos, SIN_CONFIG, NOTA_ACTIVO } = await import('../assets/js/ui/odt-afinia/indicadores-avisos.js');
const { RESULTADO_RECIEN_APROBADO, APROBADO_ACTIVO, APROBADO_INACTIVO } = await import('../assets/js/ui/odt-afinia/indicadores-avisos-script.js');
const { montarIndicadores } = await import('../assets/js/ui/odt-afinia/indicadores.js');

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Persona Fictícia Úno', esAdmin: true, legacy: false };
const LECTOR = { uid: 'uid-lector-prueba', nombre: 'Lector Ficticio', esAdmin: false, legacy: false };
const caja = () => document.createElement('div');
const boton = (el, texto) => el.todos().find((b) => b.tagName === 'BUTTON' && b.textContent.includes(texto));
const valores = (c, clase) => c.querySelectorAll('.' + clase).map((x) => x.textContent);
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

/* ── un corte de la versión 3 (como lo deja planCorte) ─────────────────────────── */
const DIA = '2026-11-21';
const o3 = (nro, { estado = 'EJECUTADA', dias = null, ejecucion = '', cerrada = '', empresa = ALFA } = {}) => ({
  nro, empresa, tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion: 'S/E PRUEBA ' + nro.slice(-1), prevista: '2026-10-15', cerrada, estado, principal: true,
  azt: 'AZT FICTICIO UNO', jefe: 'JEFE FICTICIO UNO', ejecucion: dias != null ? C.sumarDias(DIA, -dias) : ejecucion, equipo: 'EQUIPO FICTICIO ' + nro.slice(-1)
});
const ODTS = [
  o3('90000801', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-11' }),               // a tiempo (10)
  o3('90000802', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-31', empresa: BETA }), // fuera de plazo (30)
  o3('90000803', { dias: 25, empresa: BETA }),                                                           // vencida
  o3('90000804', { dias: 12 }),                                                                          // 10–14
  o3('90000805', { dias: 20 }),                                                                          // vence hoy
  o3('90000806', { ejecucion: '' }),                                                                     // por revisar
  o3('90000807', { estado: 'GENERADA', dias: 40 })                                                       // fuera
];
const corteDe = (version = 3, extra = {}) => ({
  id: 'C'.repeat(20), version, responsable: RESP_A, archivo: { nombre: 'INFORME_ODT_20261121150000_prueba.csv', sha256: 'ab'.repeat(32) },
  fechaDatos: '2026-11-21T15:00:00', rango: { desde: '2026-10-15', hasta: '2026-10-15' }, odts: ODTS.length, filasResponsable: ODTS.length,
  odtsArchivo: 10, filasArchivo: 12, totales: { total: 7 }, creadoEnMs: Date.UTC(2026, 10, 21, 16), ...extra
});
function repoFalso({ correos = [], resultado = { motivo: 'procesado', encolados: [{ umbral: 20, n: 1 }], errores: [] } } = {}) {
  const r = { listar: 0, reprocesos: [], guardadas: [], config: null };
  return Object.assign(r, {
    async listarCorreos() { r.listar++; return correos; },
    async reprocesar(id) { r.reprocesos.push(id); return resultado; },
    async leerConfig() { return r.config; },
    async guardarConfig(d) { r.guardadas.push(d); r.config = C.normalizarConfig(d); return r.config; }
  });
}
/** El repositorio del estado del script de Google, de mentira (99 §236). */
function scriptFalso({ estado = null, aprobar } = {}) {
  const r = { leidas: 0, aprobados: [], estado };
  return Object.assign(r, {
    async leerEstado() { r.leidas++; return r.estado; },
    async aprobar(aud) {
      if (aprobar) return aprobar(aud);
      r.aprobados.push(aud);
      return C.normalizarConfig({ activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: [], responsable: 'PERSONA FICTICIA UNO', audienciaScript: aud });
    }
  });
}
const vista = (p = {}) => {
  const c = caja();
  const v = montarVistaCorte(c, { corte: corteDe(), odts: ODTS, alIr: () => {}, historial: [], ...p });
  return { c, v };
};

describe('la sección en la vista de un corte de la versión 3', () => {
  test('tarjetas, tabla por contratista, franjas y fechas por revisar (y las tarjetas de los estados no cambian)', async () => {
    const { c } = vista({ repoCumplimiento: repoFalso() });
    const s = c.querySelectorAll('.odt-cum')[0];
    assert.ok(s, 'la sección');
    assert.ok(s.textContent.startsWith(C.TITULO_CUMPLIMIENTO));
    assert.equal(s.getAttribute('aria-label'), 'Cumplimiento del cierre');
    assert.deepEqual(valores(s, 'odt-cum-tarjeta-valor'), ['5', '1', '1', '1', '33,3 %', '20 días']);
    assert.equal(c.querySelectorAll('.odt-ind-tarjeta-valor').length, 6, 'las de los estados siguen siendo 6');
    assert.match(s.textContent, /Los días de las ODT abiertas se cuentan hasta la fecha de los datos del corte: 21\/11\/2026/);
    assert.match(s.querySelectorAll('.odt-cum-resumen')[0].textContent, /^6 ODT EJECUTADA o CERRADA con estos filtros: 5 evaluables y 1 con fecha por revisar\. % de cumplimiento: 33,3 %\.$/);
    const tabla = s.querySelectorAll('.odt-cum-tabla-contratistas')[0];
    assert.deepEqual(filasDe(tabla), [
      [BETA, '2', '0', '1', '0', '1', '0', '0,0 %', '30 días'],
      [ALFA, '3', '1', '0', '2', '0', '1', '100,0 %', '10 días']
    ]);
    assert.ok(tabla.todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').length >= 9, 'encabezados de columna');
    assert.equal(tabla.todos().filter((x) => x.className.includes('odt-cum-incumple')).length, 4, 'solo los incumplimientos > 0 (los 2 de BETA y los 2 del total)');
    assert.deepEqual(valores(s, 'odt-cum-franja-n'), ['0', '1', '0', '1', '1']);
    assert.equal(s.querySelectorAll('.odt-cum-franja')[1].textContent, '1 ODT con 10 a 14 días', 'el lector de pantalla oye «N ODT con …»');
    assert.equal(s.querySelectorAll('.odt-cum-franja')[1].querySelectorAll('.odt-oculto')[0].textContent, ' ODT con', 'el «ODT con» va oculto a la vista');
    const { NOTA_PROXIMO_AVISO } = await import('../assets/js/ui/odt-afinia/indicadores-cumplimiento.js');
    assert.equal(s.querySelectorAll('.odt-cum-nota-aviso')[0].textContent, NOTA_PROXIMO_AVISO);
    assert.match(NOTA_PROXIMO_AVISO, /El correo queda en cola cuando se guarda el primer corte desde esa fecha .* y sale en los minutos siguientes/);
    const det = s.querySelectorAll('.odt-cum-franja-detalle');
    assert.deepEqual(det.map((d) => d.childNodes[0].textContent), ['10 a 14 días (1)', '20 días: vence hoy (1)', 'Más de 20 días: vencidas (1)']);
    const filasVencidas = filasDe(det[2].todos().find((x) => x.tagName === 'TABLE'));
    // 99 §236 (pedido del 2026-11-26): «Avisos recibidos» se consulta al ABRIR la franja (cerrada, todavía «—»).
    assert.deepEqual(filasVencidas, [['90000803', BETA, 'S/E PRUEBA 3', 'EQUIPO FICTICIO 3', '27/10/2026', '25', '16/11/2026', 'Ya alcanzó el de 20 días (incumplimiento)', '—']]);
    const cabeza = det[2].todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').map((x) => x.textContent);
    assert.deepEqual(cabeza, ['N.º', 'Contratista', 'Subestación', 'Equipo', 'Ejecución', 'Días', 'Fecha límite', 'Próximo aviso', 'Avisos recibidos']);
    assert.deepEqual(filasDe(det[0].todos().find((x) => x.tagName === 'TABLE'))[0].slice(-2, -1), ['15 días · 24/11/2026']);
    const rev = s.querySelectorAll('.odt-cum-revisar')[0];
    assert.equal(rev.childNodes[0].textContent, 'Fechas por revisar (1): fuera del %, sin avisos');
    assert.deepEqual(filasDe(rev.todos().find((x) => x.tagName === 'TABLE'))[0], ['90000806', ALFA, 'S/E PRUEBA 6', 'EJECUTADA', '—', '—', C.MOTIVOS_REVISAR.sinEjecucion]);
    sinRestos(c);
  });
  test('respeta los filtros de arriba: con el contratista BETA solo cuentan las suyas; la franja abierta se conserva', async () => {
    const { c } = vista({ repoCumplimiento: repoFalso() });
    const s = c.querySelectorAll('.odt-cum')[0];
    const franja = s.querySelectorAll('.odt-cum-franja-detalle')[2];
    franja.open = true; await franja.disparar('toggle');
    const sel = c.todos().find((x) => x.id === 'odtIndEmpresa');
    sel.value = BETA; await sel.disparar('change');
    assert.deepEqual(valores(s, 'odt-cum-tarjeta-valor'), ['2', '0', '1', '1', '0,0 %', '30 días']);
    assert.match(s.querySelectorAll('.odt-cum-resumen')[0].textContent, /^2 ODT EJECUTADA o CERRADA con estos filtros/);
    const det = s.querySelectorAll('.odt-cum-franja-detalle');
    assert.equal(det.length, 1);
    assert.equal(det[0].getAttribute('open'), '', 'la franja que estaba abierta sigue abierta');
    assert.equal(s.querySelectorAll('.odt-cum-revisar-vacio')[0].textContent, 'Fechas por revisar: ninguna.');
    sel.value = 'NADIE'; await sel.disparar('change');
    assert.equal(s.querySelectorAll('.odt-cum-resumen')[0].textContent, 'Con estos filtros no hay ODT EJECUTADA ni CERRADA que evaluar.');
    sinRestos(c);
  });
  test('un corte de la versión 1 o 2: lo dice en llano (admin: guarde uno nuevo; lector: lo que él puede)', () => {
    for (const version of [1, 2]) {
      const a = vista({ corte: corteDe(version) }).c.querySelectorAll('.odt-cum')[0];
      assert.equal(a.querySelectorAll('.odt-cum-sin-ejecucion')[0].textContent, C.SIN_EJECUCION_CORTE);
      assert.equal(a.querySelectorAll('.odt-cum-tarjeta-valor').length, 0);
      const l = vista({ corte: corteDe(version), soloLectura: true }).c.querySelectorAll('.odt-cum')[0];
      assert.equal(l.querySelectorAll('.odt-cum-sin-ejecucion')[0].textContent, C.SIN_EJECUCION_CORTE_LECTOR);
      assert.ok(!boton(l, 'Revisar y enviar'), 'sin reproceso');
    }
  });
});

describe('el historial de correos y el reproceso', () => {
  const CORREOS = [
    { id: 'C'.repeat(20) + '_20', corteId: 'C'.repeat(20), umbral: 20, nros: ['90000803'], para: ['destino.uno@prueba.test'], cc: [], estado: 'enviado', creadoEnMs: Date.UTC(2026, 10, 21, 16), enviadoEnMs: Date.UTC(2026, 10, 21, 16, 1) },
    { id: 'D'.repeat(20) + '_10', corteId: 'D'.repeat(20), umbral: 10, nros: ['90000804', '90000805'], para: ['destino.uno@prueba.test'], cc: ['copia@prueba.test'], estado: 'error', error: 'sin conexión de prueba', creadoEnMs: Date.UTC(2026, 10, 20, 16) },
    { id: 'E'.repeat(20) + '_15', corteId: 'E'.repeat(20), umbral: 15, nros: ['90000806'], para: ['destino.uno@prueba.test'], cc: [], estado: 'pendiente', error: '', creadoEnMs: Date.UTC(2026, 10, 19, 16) },
    { id: 'F'.repeat(20) + '_20', corteId: 'F'.repeat(20), umbral: 20, nros: ['90000807'], para: ['destino.uno@prueba.test'], cc: [], estado: 'en_envio', error: '', prestamoHastaMs: Date.now() + 600000, creadoEnMs: Date.UTC(2026, 10, 18, 16) },
    { id: 'G'.repeat(20) + '_10', corteId: 'G'.repeat(20), umbral: 10, nros: ['90000808'], para: ['destino.uno@prueba.test'], cc: [], estado: 'error', error: 'x', reemplazadoPor: 'H'.repeat(20), creadoEnMs: Date.UTC(2026, 10, 17, 16) },
    // Corrector 99 §236: prestado al script hace rato y sin confirmar (el préstamo ya venció).
    { id: 'J'.repeat(20) + '_15', corteId: 'J'.repeat(20), umbral: 15, nros: ['90000809'], para: ['destino.uno@prueba.test'], cc: [], estado: 'en_envio', error: '', prestamoHastaMs: Date.UTC(2026, 10, 16, 16, 10), creadoEnMs: Date.UTC(2026, 10, 16, 16) }
  ];
  test('se lee SOLO al abrirlo; el último primero, con su estado y el enlace al corte', async () => {
    const repo = repoFalso({ correos: CORREOS });
    const { c } = vista({ repoCumplimiento: repo });
    const det = c.querySelectorAll('.odt-cum-correos')[0];
    assert.equal(det.tagName, 'DETAILS');
    assert.equal(repo.listar, 0, 'plegado: no lee');
    det.open = true; await det.disparar('toggle');
    await hasta(() => det.querySelectorAll('.odt-cum-tabla-correos').length === 1);
    assert.equal(repo.listar, 1);
    const filas = filasDe(det.querySelectorAll('.odt-cum-tabla-correos')[0]);
    assert.equal(filas[0][1], '20 días o más (cerrar de inmediato)');
    assert.match(filas[0][5], /^Enviado el /);
    assert.equal(filas[0][6], 'Este corte');
    assert.equal(filas[1][2], '2: 90000804, 90000805');
    assert.equal(filas[1][4], 'copia@prueba.test');
    assert.equal(filas[1][5], 'No se pudo enviar: sin conexión de prueba');
    // 99 §236: la cola del script de Google, en llano.
    assert.equal(filas[2][5], 'En cola: lo enviará el script de Google en los próximos minutos');
    assert.match(filas[3][5], /^Enviándose: el script de Google lo tomó/);
    // Corrector ronda 1: falló (motivo «x») y después lo reemplazó un corte más reciente: conserva su motivo.
    assert.equal(filas[4][5], 'No se pudo enviar: x (sus ODT se revisaron con un corte con datos más recientes)');
    assert.match(filas[5][5], /^El script de Google lo tomó y no confirmó el envío/, 'el préstamo venció: ya no dice «Enviándose»');
    assert.ok(!/Gmail|contraseña/i.test(det.textContent));
    assert.equal(det.todos().find((x) => x.tagName === 'A').getAttribute('href'), '#indicadores=' + 'D'.repeat(20));
    sinRestos(c);
  });
  test('el admin: «Revisar y enviar los avisos de este corte» en DOS pasos; el resultado en llano y el historial otra vez', async () => {
    const repo = repoFalso({ correos: CORREOS });
    const { c } = vista({ repoCumplimiento: repo });
    const det = c.querySelectorAll('.odt-cum-correos')[0];
    await boton(det, 'Revisar y enviar los avisos de este corte').disparar('click');
    assert.equal(repo.reprocesos.length, 0, 'primero pide confirmar');
    assert.equal(document.activeElement, boton(det, 'Sí, revisar y enviar'));
    await boton(det, 'Cancelar').disparar('click');
    assert.equal(repo.reprocesos.length, 0);
    await boton(det, 'Revisar y enviar los avisos de este corte').disparar('click');
    await boton(det, 'Sí, revisar y enviar').disparar('click');
    assert.deepEqual(repo.reprocesos, ['C'.repeat(20)]);
    assert.match(det.querySelectorAll('.odt-cum-estado')[0].textContent, /Quedaron en cola 1 correo: el de 20 días \(1 ODT\)\. Los enviará el script de Google/);
    assert.equal(repo.listar, 1, 'vuelve a leer el historial');
    sinRestos(c);
  });
  test('el lector: ve el historial (sin las direcciones: solo cuántos destinatarios), pero no puede reprocesar', async () => {
    const repo = repoFalso({ correos: CORREOS });
    const { c } = vista({ repoCumplimiento: repo, soloLectura: true });
    assert.ok(!boton(c, 'Revisar y enviar'));
    const det = c.querySelectorAll('.odt-cum-correos')[0];
    det.open = true; await det.disparar('toggle');
    await hasta(() => det.querySelectorAll('.odt-cum-tabla-correos').length === 1);
    const tabla = det.querySelectorAll('.odt-cum-tabla-correos')[0];
    assert.deepEqual(tabla.todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').map((x) => x.textContent), ['Creado el', 'Aviso', 'ODT', 'Destinatarios', 'Estado', 'Corte']);
    const filas = filasDe(tabla);
    assert.equal(filas[0][3], '1 destinatario');
    assert.equal(filas[1][3], '1 destinatario y 1 en copia');
    assert.ok(!/@/.test(tabla.textContent), 'ninguna dirección de correo a la vista del lector');
    sinRestos(c);
  });
  test('si la vista se cierra mientras se revisan los avisos, al volver no pinta ni vuelve a leer el historial', async () => {
    let soltar;
    const repo = repoFalso({ correos: CORREOS });
    repo.reprocesar = (id) => { repo.reprocesos.push(id); return new Promise((r) => { soltar = r; }); };
    const { c } = vista({ repoCumplimiento: repo });
    const det = c.querySelectorAll('.odt-cum-correos')[0];
    await boton(det, 'Revisar y enviar los avisos de este corte').disparar('click');
    const enCurso = boton(det, 'Sí, revisar y enviar').disparar('click');
    await hasta(() => typeof soltar === 'function');
    while (c.firstChild) c.removeChild(c.firstChild);      // la vista se cierra (otro corte, otra pestaña)
    soltar({ motivo: 'procesado', encolados: [{ umbral: 10, n: 1 }], errores: [] });
    await enCurso;
    assert.equal(repo.listar, 0, 'no vuelve a leer el historial');
    assert.ok(!/Quedaron en cola/.test(det.textContent), 'no pinta el resultado en una vista cerrada');
  });
  test('si no se puede leer, lo dice y ofrece reintentar', async () => {
    const zona = caja();
    const cum = montarCumplimiento(zona, { corte: corteDe(), repoCumplimiento: { listarCorreos: async () => { throw new Error('caída de prueba'); } } });
    await cum.abrirCorreos();
    assert.match(zona.textContent, /No se pudieron leer los correos de aviso/);
    assert.ok(boton(zona, 'Reintentar'));
  });
});

describe('«Avisos de cumplimiento por correo» (solo admin)', () => {
  test('solo el admin con perfil; lee al abrirse; sin configuración lo dice y propone el responsable del perfil', async () => {
    assert.equal(montarSeccionAvisos(caja(), { sesion: LECTOR }), null);
    assert.equal(montarSeccionAvisos(caja(), { sesion: { ...ADMIN, legacy: true } }), null);
    const repo = repoFalso();
    let leidas = 0; const leer = repo.leerConfig; repo.leerConfig = async () => { leidas++; return leer(); };
    const c = caja();
    const script = scriptFalso();
    const s = montarSeccionAvisos(c, { repoCumplimiento: repo, repoScript: script, sesion: ADMIN });
    assert.equal(leidas, 0, 'plegada: no lee');
    assert.equal(script.leidas, 0);
    s.elemento.open = true; await s.elemento.disparar('toggle');
    await hasta(() => s.estado().cargado && c.querySelectorAll('.odt-cum-script-datos').length === 1);
    assert.equal(leidas, 1);
    assert.equal(c.querySelectorAll('.odt-cum-config-actual')[0].textContent, SIN_CONFIG);
    assert.equal(c.todos().find((x) => x.id === 'odtCumResponsable').value, 'PERSONA FICTICIA UNO');
    // 99 §236: ya no habla de la clave de Gmail; explica el script de Google y su estado.
    assert.ok(!/contraseña de aplicación|SGM_CORREO_CLAVE/.test(c.textContent));
    assert.match(c.textContent, /script de Google que vive en la cuenta remitente/);
    assert.match(c.querySelectorAll('.odt-cum-script-datos')[0].textContent, /Última conexión del scriptNunca se ha conectadoÚltimo resultado—Script aprobadoNinguno todavía/);
    // Corrector 99 §236: qué pasa al desactivarlos y reactivarlos, junto a la casilla.
    assert.ok(c.textContent.includes(NOTA_ACTIVO));
    assert.equal(c.todos().find((x) => x.id === 'odtCumActivo').getAttribute('aria-describedby'), 'odtCumActivoNota');
    assert.equal(c.todos().filter((x) => x.tagName === 'LABEL').length, 1 + 2 + 10 + 5, 'cada campo con su etiqueta');
    sinRestos(c);
  });
  test('valida en llano y guarda en DOS pasos lo que está escrito (filas vacías fuera)', async () => {
    const repo = repoFalso();
    const c = caja();
    const s = montarSeccionAvisos(c, { repoCumplimiento: repo, repoScript: scriptFalso(), sesion: ADMIN });
    await s.cargar();
    const campo = (id) => c.todos().find((x) => x.id === id);
    campo('odtCumActivo').checked = true;
    campo('odtCumRemitente').value = 'remitente@prueba';
    campo('odtCumPara0').value = 'destino.uno@prueba.test';
    campo('odtCumParaNombre0').value = 'Persona Uno';
    await boton(c, 'Guardar').disparar('click');
    assert.match(c.textContent, /El correo del remitente no es válido/);
    assert.equal(repo.guardadas.length, 0);
    campo('odtCumRemitente').value = 'remitente@prueba.test';
    campo('odtCumCc2').value = 'copia@prueba.test';
    await boton(c, 'Guardar').disparar('click');
    assert.match(c.textContent, /Queda así: avisos ACTIVOS · remitente remitente@prueba\.test · para Persona Uno <destino\.uno@prueba\.test> · copia copia@prueba\.test/);
    await boton(c, 'Sí, guardar').disparar('click');
    assert.equal(repo.guardadas.length, 1);
    assert.deepEqual(C.docConfigCumplimiento(repo.guardadas[0]), {
      activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Uno' }], cc: ['copia@prueba.test'], responsable: 'PERSONA FICTICIA UNO', audienciaScript: ''
    });
    assert.ok(!('audienciaScript' in repo.guardadas[0]), 'el formulario no la trae: el repositorio conserva la guardada');
    assert.match(c.textContent, /Guardado\. Hoy: avisos ACTIVOS/);
    assert.match(c.textContent, /el script de Google de la cuenta remitente está instalado y aprobado/);
    sinRestos(c);
  });
});

describe('99 §236: el script de Google que envía (estado y aprobación, solo admin)', () => {
  const AUD = '9000000002-ficticio0nuevo.apps.googleusercontent.com';
  const CONFIG_OK = { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: [], responsable: 'PERSONA FICTICIA UNO', audienciaScript: '' };
  async function abrir({ estado, config = CONFIG_OK, aprobar } = {}) {
    const repo = repoFalso(); repo.config = config ? C.normalizarConfig(config) : null;
    const script = scriptFalso({ estado, aprobar });
    const c = caja();
    const s = montarSeccionAvisos(c, { repoCumplimiento: repo, repoScript: script, sesion: ADMIN });
    await s.cargar();
    await hasta(() => c.querySelectorAll('.odt-cum-script-datos').length === 1);
    return { c, s, repo, script };
  }
  test('muestra la última conexión y el último resultado; sin pedido de permiso, sin botón de aprobar', async () => {
    const { c } = await abrir({ estado: { audienciaVista: '', ultimaConexionEnMs: Date.UTC(2026, 10, 26, 15), ultimoResultado: 'Pidió los correos en cola: se le entregaron 2.' }, config: { ...CONFIG_OK, audienciaScript: AUD } });
    const datos = c.querySelectorAll('.odt-cum-script-datos')[0].textContent;
    assert.match(datos, /Última conexión del script26\/11\/2026/);
    assert.match(datos, /Último resultadoPidió los correos en cola: se le entregaron 2\./);
    assert.match(datos, /Script aprobadoSí/);
    assert.ok(!boton(c, 'Aprobar este script'));
    assert.ok(!/Hay un script de Google pidiendo permiso/.test(c.textContent));
    sinRestos(c);
  });
  test('un script pide permiso: «Aprobar este script» en DOS pasos guarda audienciaScript = audienciaVista', async () => {
    const { c, script } = await abrir({ estado: { audienciaVista: AUD, vistaEnMs: Date.UTC(2026, 10, 26, 14), ultimaConexionEnMs: Date.UTC(2026, 10, 26, 14), ultimoResultado: R.TEXTO_ESTADO.sinAprobar } });
    assert.match(c.textContent, /Hay un script de Google pidiendo permiso para enviar los avisos/);
    assert.ok(c.textContent.includes(AUD));
    await boton(c, 'Aprobar este script').disparar('click');
    assert.deepEqual(script.aprobados, [], 'primero pide confirmar');
    assert.equal(document.activeElement, boton(c, 'Sí, aprobar'));
    assert.match(c.textContent, /Apruébelo solo si usted/);
    await boton(c, 'Cancelar').disparar('click');
    assert.deepEqual(script.aprobados, []);
    await boton(c, 'Aprobar este script').disparar('click');
    await boton(c, 'Sí, aprobar').disparar('click');
    assert.deepEqual(script.aprobados, [AUD]);
    assert.match(c.querySelectorAll('.odt-cum-script-estado')[0].textContent, /Script aprobado\./);
    assert.ok(!boton(c, 'Aprobar este script'), 'aprobado: ya no pide permiso');
    assert.match(c.querySelectorAll('.odt-cum-script-datos')[0].textContent, /Script aprobadoSí/);
    // Corrector 99 §236: lo leído antes («Pidió permiso…») no queda junto a «aprobado»; el aviso, según los avisos activos.
    const datos = c.querySelectorAll('.odt-cum-script-datos')[0].textContent;
    assert.ok(datos.includes(RESULTADO_RECIEN_APROBADO) && !datos.includes(R.TEXTO_ESTADO.sinAprobar), datos);
    assert.equal(c.querySelectorAll('.odt-cum-script-estado')[0].textContent, APROBADO_ACTIVO);
    assert.ok(!/probarConexion/.test(c.textContent), 'sin nombres de funciones');
    sinRestos(c);
  });
  test('corrector 99 §236: aprobado con los avisos DESACTIVADOS, lo dice; el identificador parte la línea; el título no es un h4', async () => {
    const config = { ...CONFIG_OK, activo: false };
    const { c } = await abrir({ config, estado: { audienciaVista: AUD, vistaEnMs: 1 }, aprobar: async (aud) => C.normalizarConfig({ ...config, audienciaScript: aud }) });
    assert.ok(c.querySelectorAll('.odt-cum-script-id')[0].textContent.includes(AUD));
    assert.equal(c.querySelectorAll('.odt-cum-script')[0].todos().filter((x) => /^H[1-6]$/.test(x.tagName)).length, 0);
    assert.equal(c.querySelectorAll('.odt-cum-script-titulo')[0].textContent, R.TITULO_SCRIPT);
    await boton(c, 'Aprobar este script').disparar('click');
    await boton(c, 'Sí, aprobar').disparar('click');
    assert.equal(c.querySelectorAll('.odt-cum-script-estado')[0].textContent, APROBADO_INACTIVO);
  });
  test('corrector 99 §236: «Volver a consultar» no se borra al repintar (conserva el foco) y anuncia que actualizó', async () => {
    const { c, script } = await abrir({ estado: { audienciaVista: '', ultimaConexionEnMs: 1, ultimoResultado: 'antes' }, config: { ...CONFIG_OK, audienciaScript: AUD } });
    const b = boton(c, 'Volver a consultar');
    b.focus();
    script.estado = { audienciaVista: '', ultimaConexionEnMs: 2, ultimoResultado: 'después' };
    await b.disparar('click');
    await hasta(() => /Estado del script actualizado/.test(c.querySelectorAll('.odt-cum-script-estado')[0].textContent));
    assert.equal(boton(c, 'Volver a consultar'), b, 'el mismo botón');
    assert.equal(document.activeElement, b, 'el foco sigue en el botón');
    assert.match(c.querySelectorAll('.odt-cum-script-datos')[0].textContent, /Último resultadodespués/);
    assert.equal(c.querySelectorAll('.odt-cum-script')[0].todos().filter((x) => x.tagName === 'BUTTON' && x.textContent === 'Volver a consultar').length, 1);
  });
  test('sin configuración guardada no se puede aprobar (lo dice); si la aprobación falla, lo dice en llano', async () => {
    const sin = await abrir({ config: null, estado: { audienciaVista: AUD, vistaEnMs: 1 } });
    assert.equal(boton(sin.c, 'Aprobar este script').disabled, true);
    assert.match(sin.c.textContent, /Guarde primero la configuración/);
    const mal = await abrir({ estado: { audienciaVista: AUD, vistaEnMs: 1 }, aprobar: async () => { throw new Error('falla de prueba al aprobar'); } });
    await boton(mal.c, 'Aprobar este script').disparar('click');
    await boton(mal.c, 'Sí, aprobar').disparar('click');
    assert.match(mal.c.querySelectorAll('.odt-cum-script-estado')[0].textContent, /falla de prueba al aprobar/);
    assert.ok(boton(mal.c, 'Aprobar este script'), 'puede volver a intentarlo');
  });
  test('si no se puede leer el estado, lo dice y ofrece reintentar', async () => {
    const repo = repoFalso();
    const c = caja();
    const s = montarSeccionAvisos(c, { repoCumplimiento: repo, repoScript: { leerEstado: async () => { throw new Error('caída de prueba'); } }, sesion: ADMIN });
    await s.cargar();
    await hasta(() => /No se pudo leer el estado del script/.test(c.textContent));
    assert.ok(boton(c, 'Volver a consultar'), 'el botón fijo sirve para reintentar');
    assert.match(c.textContent, /Pulse «Volver a consultar» para reintentar/);
  });
});

describe('el repositorio (Firestore en memoria y la función de mentira)', () => {
  const repoDe = (fs, s = ADMIN, llamar) => crearRepositorioCumplimiento({ sdk: fs.F, db: fs.db, sesion: () => s, llamar, tiempoMs: 30 });
  test('guardarConfig escribe EXACTAMENTE las 6 claves y lo vuelve a leer; un lector no la lee ni la guarda', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    const r = repoDe(fs);
    assert.equal(await r.leerConfig(), null);
    const g = await r.guardarConfig({ activo: true, remitente: ' remitente@prueba.test ', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }, { correo: '', nombre: '' }], cc: [''], responsable: RESP_A });
    const escrito = fs.lotes.at(-1).ops[0];
    assert.equal(escrito.ruta, 'odt_afinia_config/cumplimiento');
    assert.deepEqual(Object.keys(escrito.datos), [...C.CLAVES_CONFIG]);
    assert.deepEqual(g, { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: [], responsable: RESP_A, audienciaScript: '' });
    await assert.rejects(r.guardarConfig({ activo: true, remitente: 'x', para: [], cc: [], responsable: RESP_A }), (e) => e.codigo === 'validacion');
    await assert.rejects(repoDe(fs, LECTOR).leerConfig(), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(repoDe(fs, LECTOR).guardarConfig(g), (e) => e.codigo === 'sin_permiso');
  });
  test('99 §236: guardar desde el formulario (sin audienciaScript) CONSERVA el script aprobado; con ella, la cambia', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    const AUD = '9000000001-ficticio0aprobado.apps.googleusercontent.com';
    fs.store.set('odt_afinia_config/cumplimiento', { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: [], responsable: RESP_A, audienciaScript: AUD });
    const r = repoDe(fs);
    const g = await r.guardarConfig({ activo: false, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: [], responsable: RESP_A });
    assert.equal(g.audienciaScript, AUD);
    assert.equal(fs.lotes.at(-1).ops[0].datos.audienciaScript, AUD);
    assert.equal((await r.guardarConfig({ ...g, audienciaScript: '' })).audienciaScript, '', 'con ella explícita, se guarda la que viene');
  });
  test('99 §236: el repositorio del script lee su estado del servidor y aprueba copiando el aud en la configuración (solo admin)', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    const AUD = '9000000002-ficticio0nuevo.apps.googleusercontent.com';
    const rs = (s = ADMIN) => crearRepositorioScript({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoMs: 30 });
    assert.equal(await rs().leerEstado(), null);
    await assert.rejects(rs().aprobar(AUD), (e) => e.codigo === 'validacion' && /Guarde primero la configuración/.test(e.message));
    fs.store.set('odt_afinia_config/cumplimiento_script', { audienciaVista: AUD, vistaEn: { toMillis: () => 5 }, ultimaConexionEn: { toMillis: () => 6 }, ultimoResultado: 'Pidió permiso' });
    assert.deepEqual(await rs().leerEstado(), { audienciaVista: AUD, vistaEnMs: 5, ultimaConexionEnMs: 6, ultimoResultado: 'Pidió permiso' });
    fs.store.set('odt_afinia_config/cumplimiento', { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: ['copia@prueba.test'], responsable: RESP_A, audienciaScript: '' });
    const g = await rs().aprobar(AUD);
    assert.equal(g.audienciaScript, AUD);
    const escrito = fs.lotes.at(-1).ops[0];
    assert.equal(escrito.ruta, 'odt_afinia_config/cumplimiento');
    assert.deepEqual(escrito.datos, { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Uno' }], cc: ['copia@prueba.test'], responsable: RESP_A, audienciaScript: AUD }, 'la configuración entera, con el script aprobado');
    await assert.rejects(rs().aprobar('no válido'), (e) => e.codigo === 'validacion');
    await assert.rejects(rs(LECTOR).leerEstado(), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(rs(LECTOR).aprobar(AUD), (e) => e.codigo === 'sin_permiso');
  });
  test('listarCorreos: el último primero, con limit 50 (lo puede pedir el lector: la regla decide)', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    fs.store.set('odt_afinia_correos/' + 'A'.repeat(20) + '_10', { corteId: 'A'.repeat(20), umbral: 10, estado: 'enviado', creadoEn: { toMillis: () => 1000 } });
    fs.store.set('odt_afinia_correos/' + 'B'.repeat(20) + '_20', { corteId: 'B'.repeat(20), umbral: 20, estado: 'error', creadoEn: { toMillis: () => 2000 } });
    const xs = await repoDe(fs, LECTOR).listarCorreos();
    assert.deepEqual(xs.map((x) => [x.umbral, x.creadoEnMs]), [[20, 2000], [10, 1000]]);
    const q = fs.consultas.at(-1);
    assert.equal(q.col, 'odt_afinia_correos');
    assert.deepEqual(q.filtros.map((f) => f.t + ':' + (f.campo || f.n) + (f.dir ? ':' + f.dir : '')), ['orderBy:creadoEn:desc', 'limit:50']);
  });
  test('reprocesar: solo el admin, con un id de corte válido; los errores de la función, en llano', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    const llamadas = [];
    const r = repoDe(fs, ADMIN, async (nombre, datos) => { llamadas.push([nombre, datos]); return { motivo: 'sin_avisos' }; });
    assert.deepEqual(await r.reprocesar('C'.repeat(20)), { motivo: 'sin_avisos' });
    assert.deepEqual(llamadas, [['reprocesarAvisosCumplimiento', { corteId: 'C'.repeat(20) }]]);
    await assert.rejects(r.reprocesar('../x'), (e) => e.codigo === 'validacion');
    await assert.rejects(repoDe(fs, LECTOR, async () => ({})).reprocesar('C'.repeat(20)), (e) => e.codigo === 'sin_permiso');
    const negada = repoDe(fs, ADMIN, async () => { const e = new Error('Solo un administrador con perfil puede revisar y enviar los avisos.'); e.code = 'functions/permission-denied'; throw e; });
    await assert.rejects(negada.reprocesar('C'.repeat(20)), (e) => e.codigo === 'sin_permiso' && /Solo un administrador/.test(e.message));
  });
});

describe('la pestaña entera', () => {
  const ZT = 'FECHA Y HORA AZT - RECIBE ZT';
  async function guardarCorte(fs) {
    const texto = csv([
      odt('90000901', { estado: 'EJECUTADA', prevista: '01/11/2026 07:00', extra: { [ZT]: '01/11/2026 08:00' } }),
      odt('90000902', { estado: 'CERRADA', prevista: '01/11/2026 07:00', cerrada: '05/11/2026 08:00', extra: { [ZT]: '02/11/2026 08:00' } })
    ]);
    const l = leerCsv(texto);
    return crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 30 })
      .guardar({ archivo: { nombre: 'INFORME_ODT_20261121150000_prueba.csv', bytes: 10, sha256: 'ef'.repeat(32) }, lectura: l, analisis: analizarResponsable(l, RESP_A) });
  }
  test('el admin: la sección con los números del corte guardado (versión 3) y el bloque de configuración; el lector, sin él', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    await guardarCorte(fs);
    const c = caja();
    await montarIndicadores(c, { vista: 'ultimo', repoCortes: crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN }), sesion: ADMIN, alIr: () => {}, repoCumplimiento: repoFalso() });
    assert.ok(c.querySelectorAll('.odt-cum-config')[0], 'el bloque del admin');
    const s = c.querySelectorAll('.odt-cum')[0];
    // La abierta (01/11 → 21/11) lleva 20 días: vence hoy, todavía sin veredicto; la cerrada, en 3 días: 1 de 1.
    assert.deepEqual(valores(s, 'odt-cum-tarjeta-valor'), ['2', '1', '0', '0', '100,0 %', '3 días']);
    assert.deepEqual(valores(s, 'odt-cum-franja-n'), ['0', '0', '0', '1', '0']);
    sinRestos(c);
    const l = caja();
    await montarIndicadores(l, { vista: 'ultimo', repoCortes: crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => LECTOR, esLector: true }), sesion: LECTOR, lector: true, alIr: () => {}, repoCumplimiento: repoFalso() });
    assert.equal(l.querySelectorAll('.odt-cum-config').length, 0);
    assert.ok(l.querySelectorAll('.odt-cum')[0]);
    sinRestos(l);
  });
});
