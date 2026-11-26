// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Avisos de CUMPLIMIENTO DEL CIERRE (99 §236): el proceso de un corte con DOBLES, de punta a punta
// ──────────────────────────────────────────────────────────────
// Sin red, sin emulador y sin Firestore real: la lógica (assets/js/domain/odt_afinia_cumplimiento_avisos.js) corre
// sobre los adaptadores de verdad (functions/cumplimiento.mjs) con un Firestore del Admin SDK EN MEMORIA
// (firestore_admin_falso.mjs). CAMBIO del 2026-11-26 (99 §236): la función YA NO ENVÍA; deja los correos EN COLA y los
// envía el script de Google de la cuenta remitente. Aquí el script se SIMULA llamando a la atención real de la función
// avisosCorreoRemitente (domain/odt_afinia_cumplimiento_remitente.js + functions/cumplimiento_remitente.mjs) con un
// token ya verificado de mentira. Se prueba:
//   · sin configuración, desactivada, de otro responsable, corte de la versión 2, corte incompleto o con datos más
//     viejos que otro: no se encola nada (y se dice por qué);
//   · un corte con ODT a 9, 10, 16 y 26 días (más cerradas, por revisar y GENERADA): 3 correos EN COLA (10, 15 y 20),
//     con el texto, la tabla (con el EQUIPO), destinatarios, copia y saludo de la configuración; los avisos más altos
//     «reservado» y los menores «omitido»; el script los envía y todo queda «enviado»;
//   · otra vez el MISMO corte: no duplica nada; un corte NUEVO (5 días después): solo los umbrales nuevos;
//   · si el script no puede enviar: correo y avisos en «error»; el reproceso lo devuelve a la cola (sin repetir lo
//     enviado) y el script lo envía; el tope de 5 préstamos sin confirmar; un correo en manos del script no se toca;
//   · la cola se renueva: lo que dejó en cola un corte anterior y no salió lo reemplaza el corte más reciente;
//   · la fecha del corte en Colombia; sin la hora de descarga en el nombre del archivo, no se avisa;
//   · un proceso CORTADO a mitad no deja una ODT sin su aviso;
//   · un correo demasiado grande para un mensaje de Google va solo con el texto.
// Datos INVENTADOS: personas, correos @prueba.test, contratistas, ids de cliente y N.º que empiezan por 9.
// Correr: node --test functions/tests/cumplimiento_avisos.test.mjs (desde la raíz del repositorio).
// ══════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { procesarCorteCumplimiento, idAviso, idCorreo, LEASE_ENVIO_MS, asuntoCorreo, TEXTO_MOTIVO, TEXTO_REEMPLAZADO } from '../../assets/js/domain/odt_afinia_cumplimiento_avisos.js';
import * as R from '../../assets/js/domain/odt_afinia_cumplimiento_remitente.js';
import { sumarDias } from '../../assets/js/domain/odt_afinia_cumplimiento.js';
import { agregar } from '../../assets/js/domain/odt_afinia_indicadores.js';
import { planCorte } from '../../assets/js/data/odt_afinia_cortes_lotes.js';
import { crearDepsCumplimiento, esAdminConPerfil, esYaExiste } from '../cumplimiento.mjs';
import { crearDepsRemitente } from '../cumplimiento_remitente.mjs';
import { crearAdminFalso, FieldValue, TS } from './firestore_admin_falso.mjs';

/* ── Datos inventados ─────────────────────────────────────────────────────────── */
const RESP = 'RESPONSABLE FICTICIO DE AVISOS';
const AUD = '9000000001-ficticio0aprobado.apps.googleusercontent.com';
const CONFIG = {
  activo: true, remitente: 'remitente.sgm@prueba.test', responsable: 'Responsable  Fictício de Avisos',    // se compara normalizado
  para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Uno' }, { correo: 'destino.dos@prueba.test', nombre: 'Persona Dos' }],
  cc: ['copia.uno@prueba.test'], audienciaScript: AUD
};
const DIA_CORTE = '2026-11-21';   // INFORME_ODT_20261121150000 → 21/11 a las 10:00 en Colombia
const odt = (nro, { estado = 'EJECUTADA', dias = null, ejecucion = '', cerrada = '', empresa = 'CONTRATISTA FICTICIO UNO' } = {}) => ({
  nro, empresa, tipo: 'TIPO FICTICIO', zona: 'ZONA FICTICIA', subestacion: 'S/E FICTICIA ' + nro.slice(-1), prevista: '2026-10-15', cerrada, estado, principal: true,
  azt: 'AZT FICTICIO', jefe: 'JEFE FICTICIO', ejecucion: dias != null ? sumarDias(DIA_CORTE, -dias) : ejecucion, equipo: 'EQUIPO FICTICIO ' + nro.slice(-1)
});
const BASE = () => [
  odt('90000701', { dias: 9 }),
  odt('90000702', { dias: 10 }),
  odt('90000703', { dias: 16, empresa: 'CONTRATISTA FICTICIO DOS' }),
  odt('90000704', { dias: 26 }),
  odt('90000705', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-30' }),
  odt('90000706', { ejecucion: '' }),
  odt('90000707', { estado: 'GENERADA', dias: 30 })
];
const ID = (k) => 'Cumplim' + String(k).padStart(13, '0');
/** Guarda un corte como lo deja la página (planCorte: corte de la versión 3 + sus partes). */
function sembrarCorte(f, id, { odts = BASE(), sello = '20261121150000', responsable = RESP, version } = {}) {
  const analisis = { responsable, odts, filasResponsable: odts.length, ...agregar(odts) };
  const p = planCorte({ id, archivo: { nombre: 'INFORME_ODT_' + sello + '_prueba.csv', bytes: 10, sha256: 'ab'.repeat(32) },
    lectura: { filas: odts.length + 3, odtsArchivo: odts.length + 1 }, analisis, por: { uid: 'uid-admin-prueba', nombre: 'Admin Prueba' }, ts: TS });
  for (const o of p.operaciones) f.store.set(o.ruta.join('/'), o.datos);
  if (version) f.store.set('odt_afinia_cortes/' + id, { ...f.store.get('odt_afinia_cortes/' + id), version });
  return p;
}
/** El token (ya verificado) del script aprobado de la cuenta remitente. */
const payload = (ms) => ({ iss: 'https://accounts.google.com', aud: AUD, email: CONFIG.remitente, email_verified: true, exp: ms / 1000 + 3000, iat: ms / 1000 - 10 });

function preparar({ config = CONFIG } = {}) {
  const f = crearAdminFalso();
  if (config) f.store.set('odt_afinia_config/cumplimiento', config);
  const registro = [];
  let ahora = Date.UTC(2026, 10, 21, 16, 0, 0);
  const deps = crearDepsCumplimiento({ db: f.db, FieldValue, log: (nivel, msg, datos) => registro.push([nivel, msg, datos]), ahora: () => new Date(ahora) });
  deps.esperar = async () => {};      // sin pausas reales entre reintentos
  let k = 0;
  const depsScript = crearDepsRemitente({
    db: f.db, FieldValue, logica: R, verificarToken: async () => payload(ahora), ahora: () => new Date(ahora),
    nuevoPrestamo: () => 'prestamo' + String(++k).padStart(16, '0')
  });
  const llamar = (cuerpo) => R.atenderRemitente({ metodo: 'POST', tipo: 'application/json', autorizacion: 'Bearer ' + 'x'.repeat(40), cuerpo }, depsScript);
  const enviados = [];
  /**
   * El script de Google en un turno: pide los pendientes, «envía» cada uno (salvo los que `falla` rechace) y reporta.
   * responder: false = se cae después de enviar, sin reportar.
   */
  async function script({ falla = () => '', responder = true } = {}) {
    const r = await llamar({ accion: 'pendientes', cupo: 100 });
    assert.equal(r.status, 200, 'el script aprobado recibe la cola');
    for (const c of r.cuerpo.correos) {
      const error = falla(c);
      if (!error) enviados.push(c);
      if (responder) await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: !error, error });
    }
    return r.cuerpo.correos;
  }
  return { f, deps, registro, script, llamar, enviados, avanzar: (ms) => { ahora += ms; } };
}
const aviso = (f, nro, u) => f.leer('odt_afinia_avisos/' + idAviso(nro, u));
const correo = (f, corteId, u) => f.leer('odt_afinia_correos/' + idCorreo(corteId, u));
const correos = (f) => [...f.store.keys()].filter((k) => k.startsWith('odt_afinia_correos/'));

describe('cuándo NO se encola nada (y se dice por qué en el registro)', () => {
  test('sin configuración, desactivada, inválida, de otro responsable, corte de la versión 2 o incompleto', async () => {
    const casos = [
      [{ config: null }, 'sin_config'],
      [{ config: { ...CONFIG, activo: false } }, 'inactivo'],
      [{ config: { ...CONFIG, para: [] } }, 'config_invalida'],
      [{ config: { ...CONFIG, responsable: 'OTRA PERSONA FICTICIA' } }, 'otro_responsable']
    ];
    for (const [op, motivo] of casos) {
      const { f, deps, registro } = preparar(op);
      sembrarCorte(f, ID(1));
      const r = await procesarCorteCumplimiento(ID(1), deps, { origen: 'prueba' });
      assert.equal(r.motivo, motivo);
      assert.ok(registro.some(([, msg]) => msg.includes(motivo)), 'el motivo queda en el registro: ' + motivo);
      assert.equal([...f.store.keys()].filter((k) => k.startsWith('odt_afinia_avisos/') || k.startsWith('odt_afinia_correos/')).length, 0);
    }
    const v2 = preparar();
    sembrarCorte(v2.f, ID(2), { version: 2 });
    assert.equal((await procesarCorteCumplimiento(ID(2), v2.deps)).motivo, 'version');
    const inc = preparar();
    sembrarCorte(inc.f, ID(3));
    inc.f.store.set('odt_afinia_cortes/' + ID(3), { ...inc.f.store.get('odt_afinia_cortes/' + ID(3)), odts: 8 });
    assert.equal((await procesarCorteCumplimiento(ID(3), inc.deps)).motivo, 'corte_incompleto');
    assert.equal((await procesarCorteCumplimiento(ID(9), inc.deps)).motivo, 'sin_corte');
    assert.equal((await procesarCorteCumplimiento('../otro', inc.deps)).motivo, 'id_invalido');
  });
  test('un corte con datos MÁS VIEJOS que otro ya guardado del mismo responsable no avisa', async () => {
    const { f, deps } = preparar();
    sembrarCorte(f, ID(4), { sello: '20261121150000' });
    sembrarCorte(f, ID(5), { sello: '20261124150000' });
    assert.equal((await procesarCorteCumplimiento(ID(4), deps)).motivo, 'hay_corte_mas_reciente');
    assert.equal(correos(f).length, 0);
  });
});

describe('un corte nuevo: un correo por umbral EN COLA; el script de Google lo envía; cada ODT una sola vez', () => {
  test('9, 10, 16 y 26 días → correos de 10, 15 y 20 en cola; los umbrales menores de la primera vez quedan «omitido»', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(10));
    const r = await procesarCorteCumplimiento(ID(10), deps, { origen: 'al guardar el corte' });
    assert.equal(r.motivo, 'procesado');
    assert.deepEqual(r.encolados, [{ umbral: 10, n: 1 }, { umbral: 15, n: 1 }, { umbral: 20, n: 1 }]);
    assert.ok(!('enviados' in r), 'la función ya no envía');
    for (const u of [10, 15, 20]) {
      const c = correo(f, ID(10), u);
      assert.equal(c.estado, 'pendiente');
      assert.equal(c.asunto, asuntoCorreo(u, 1));
      assert.deepEqual(c.para, ['destino.uno@prueba.test', 'destino.dos@prueba.test']);
      assert.deepEqual(c.cc, ['copia.uno@prueba.test']);
      assert.equal(c.responsable, RESP);
      assert.equal(c.intentos, 0); assert.equal(c.prestamo, ''); assert.ok(c.creadoEn && Number.isFinite(c.encoladoEnMs));
      assert.ok(c.texto.startsWith('Buen día, Persona Uno y Persona Dos:'));
      assert.match(c.texto, /Responsable O\.D\.T\.: RESPONSABLE FICTICIO DE AVISOS · Mensaje generado por SGM · TRANSPOWER$/);
      assert.match(c.texto, /con datos del 21\/11\/2026 10:00/);
      assert.ok(c.html.startsWith('<div'));
    }
    const c10 = correo(f, ID(10), 10);
    assert.match(c10.texto, /N\.º ODT: 90000702 · Subestación: S\/E FICTICIA 2 · Equipo: EQUIPO FICTICIO 2 · Contratista: /, 'la tabla trae el equipo');
    assert.ok(c10.html.includes('>Equipo</th>') && c10.html.includes('>EQUIPO FICTICIO 2</td>'));
    assert.ok(!/90000701|90000705|90000706|90000707/.test([10, 15, 20].map((u) => correo(f, ID(10), u).texto).join()), 'ni 9 días, ni cerradas, ni por revisar, ni GENERADA');
    assert.match(correo(f, ID(10), 15).texto, /90000703 .*Días transcurridos: 16/);
    assert.match(correo(f, ID(10), 20).texto, /90000704 .*Días transcurridos: 26 .*Situación: Incumplimiento/);
    // Los avisos: el más alto, «reservado» por su correo (sale con él); los menores de la primera vez, «omitido».
    assert.deepEqual([aviso(f, '90000702', 10).estado, aviso(f, '90000702', 10).correoId], ['reservado', idCorreo(ID(10), 10)]);
    assert.deepEqual([aviso(f, '90000703', 10).estado, aviso(f, '90000703', 15).estado], ['omitido', 'reservado']);
    assert.deepEqual([10, 15, 20].map((u) => aviso(f, '90000704', u).estado), ['omitido', 'omitido', 'reservado']);
    assert.equal(aviso(f, '90000704', 20).dias, 26);
    assert.equal(aviso(f, '90000701', 10), undefined);
    // El script de Google los envía: correos y avisos quedan «enviado».
    const turno = await script();
    assert.deepEqual(turno.map((c) => c.asunto), [asuntoCorreo(10, 1), asuntoCorreo(15, 1), asuntoCorreo(20, 1)], 'el de 10 primero');
    assert.equal(enviados.length, 3);
    assert.deepEqual(Object.keys(turno[0]).sort(), ['asunto', 'cc', 'html', 'id', 'para', 'prestamo', 'texto']);
    for (const u of [10, 15, 20]) {
      const c = correo(f, ID(10), u);
      assert.equal(c.estado, 'enviado'); assert.ok(c.enviadoEn); assert.equal(c.error, ''); assert.equal(c.intentos, 1);
    }
    assert.equal(aviso(f, '90000702', 10).estado, 'enviado');
    assert.equal(aviso(f, '90000703', 15).estado, 'enviado');
    assert.equal(aviso(f, '90000704', 20).estado, 'enviado');
    assert.equal(aviso(f, '90000704', 10).estado, 'omitido', 'un omitido nunca se manda');
    assert.deepEqual(await script(), [], 'el turno siguiente no encuentra nada');
  });
  test('otra vez el MISMO corte (el reproceso): antes de enviar no duplica; después, no repite nada', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(11));
    await procesarCorteCumplimiento(ID(11), deps);
    const r = await procesarCorteCumplimiento(ID(11), deps, { origen: 'a pedido' });
    assert.deepEqual(r.encolados.map((x) => x.umbral), [10, 15, 20], 'siguen en cola (re-armados)');
    assert.equal(correos(f).length, 3);
    await script();
    const r2 = await procesarCorteCumplimiento(ID(11), deps, { origen: 'a pedido' });
    assert.deepEqual([r2.motivo, r2.encolados, r2.reabiertos], ['procesado', [], []]);
    await script();
    assert.equal(enviados.length, 3);
  });
  test('un corte NUEVO 5 días después: solo los umbrales nuevos (9→14: el de 10; 10→15: el de 15; 16→21: el de 20; 26→31: nada)', async () => {
    const { f, deps, script, enviados, avanzar } = preparar();
    sembrarCorte(f, ID(12), { sello: '20261121150000' });
    await procesarCorteCumplimiento(ID(12), deps);
    await script();
    avanzar(5 * 24 * 3600 * 1000);
    sembrarCorte(f, ID(13), { sello: '20261126150000' });
    const r = await procesarCorteCumplimiento(ID(13), deps);
    assert.deepEqual(r.encolados, [{ umbral: 10, n: 1 }, { umbral: 15, n: 1 }, { umbral: 20, n: 1 }]);
    await script();
    const nuevos = enviados.slice(3);
    assert.match(nuevos[0].texto, /90000701 .*Días transcurridos: 14/);
    assert.match(nuevos[1].texto, /90000702 .*Días transcurridos: 15/);
    assert.match(nuevos[2].texto, /90000703 .*Días transcurridos: 21/);
    assert.ok(!nuevos.some((m) => m.texto.includes('90000704')), 'la de 26 → 31 ya recibió el de 20');
    assert.equal(aviso(f, '90000702', 15).correoId, idCorreo(ID(13), 15));
    assert.equal(aviso(f, '90000702', 10).correoId, idCorreo(ID(12), 10), 'el de 10 sigue siendo el del primer corte');
  });
});

describe('si el script no puede enviar: error, vuelta a la cola sin repetir, tope de préstamos y correo en manos del script', () => {
  test('falla el de 20: correo y aviso en «error» (en llano); el reproceso lo devuelve a la cola y no repite los ya enviados', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(20));
    await procesarCorteCumplimiento(ID(20), deps);
    await script({ falla: (c) => (c.asunto.includes('INCUMPLIMIENTO') ? 'Invalid email: destino@prueba' : '') });
    assert.equal(enviados.length, 2);
    const c20 = correo(f, ID(20), 20);
    assert.equal(c20.estado, 'error');
    assert.match(c20.error, /^Google rechazó alguna dirección/, 'en llano, lo que ve la pantalla');
    assert.equal(aviso(f, '90000704', 20).estado, 'error');
    assert.deepEqual([aviso(f, '90000704', 10).estado, aviso(f, '90000704', 15).estado], ['omitido', 'omitido']);
    assert.deepEqual(await script(), [], 'un correo en «error» no se vuelve a prestar solo');
    const r = await procesarCorteCumplimiento(ID(20), deps, { origen: 'a pedido' });
    assert.deepEqual([r.encolados, r.reabiertos], [[{ umbral: 20, n: 1 }], [20]]);
    assert.deepEqual([correo(f, ID(20), 20).estado, correo(f, ID(20), 20).intentos, correo(f, ID(20), 20).error], ['pendiente', 0, '']);
    await script();
    assert.deepEqual(enviados.map((m) => m.asunto), [asuntoCorreo(10, 1), asuntoCorreo(15, 1), asuntoCorreo(20, 1)], 'el de 10 y el de 15 no se repiten');
    assert.equal(correo(f, ID(20), 20).estado, 'enviado');
    assert.equal(aviso(f, '90000704', 20).estado, 'enviado');
  });
  test('un aviso en «error» de un corte anterior lo toma el corte siguiente (no queda trabado)', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(21), { odts: [odt('90000711', { dias: 22 })] });
    await procesarCorteCumplimiento(ID(21), deps);
    await script({ falla: () => 'falla de prueba' });
    assert.equal(aviso(f, '90000711', 20).estado, 'error');
    sembrarCorte(f, ID(22), { odts: [odt('90000711', { dias: 22 })], sello: '20261122150000' });
    const r = await procesarCorteCumplimiento(ID(22), deps);
    assert.deepEqual(r.encolados, [{ umbral: 20, n: 1 }]);
    assert.equal(aviso(f, '90000711', 20).correoId, idCorreo(ID(22), 20));
    await script();
    assert.equal(aviso(f, '90000711', 20).estado, 'enviado');
    assert.equal(enviados.length, 1);
    assert.equal(correo(f, ID(21), 20).estado, 'error', 'el del corte viejo queda en el historial');
    // Corrector ronda 1 (99 §236): reemplazado por el corte nuevo (ya no cuenta en «Con error»), con su motivo.
    assert.deepEqual([correo(f, ID(21), 20).reemplazadoPor, correo(f, ID(21), 20).error], [ID(22), 'El script de Google no pudo enviarlo: falla de prueba']);
  });
  test('un proceso cortado DESPUÉS de enviar (correo «enviado», avisos «reservado»): el reproceso no lo encola y los marca', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(23), { odts: [odt('90000721', { dias: 11 })] });
    f.store.set('odt_afinia_avisos/' + idAviso('90000721', 10), { nro: '90000721', umbral: 10, estado: 'reservado', corteId: ID(23), correoId: idCorreo(ID(23), 10), dias: 11, en: 1 });
    f.store.set('odt_afinia_correos/' + idCorreo(ID(23), 10), { corteId: ID(23), umbral: 10, estado: 'enviado', nros: ['90000721'], intentos: 1, responsable: RESP });
    const r = await procesarCorteCumplimiento(ID(23), deps);
    assert.deepEqual(r.encolados, []);
    assert.equal(aviso(f, '90000721', 10).estado, 'enviado');
    await script();
    assert.equal(enviados.length, 0);
  });
  test('un correo en manos del script («en_envio»): el reproceso no lo toca; lo que sumó vuelve a «error»; al vencer el préstamo se presta otra vez', async () => {
    const { f, deps, script, enviados, avanzar } = preparar();
    sembrarCorte(f, ID(24), { odts: [odt('90000731', { dias: 12 }), odt('90000732', { dias: 12 })] });
    await procesarCorteCumplimiento(ID(24), deps);
    // El script lo toma y se cae (no reporta): queda «en_envio» con su préstamo.
    await script({ responder: false });
    assert.equal(correo(f, ID(24), 10).estado, 'en_envio');
    // Mientras tanto, el aviso de la 732 queda en «error» (como si su parte hubiera fallado) y se reprocesa.
    f.store.set('odt_afinia_avisos/' + idAviso('90000732', 10), { ...f.store.get('odt_afinia_avisos/' + idAviso('90000732', 10)), estado: 'error' });
    f.store.set('odt_afinia_correos/' + idCorreo(ID(24), 10), { ...f.store.get('odt_afinia_correos/' + idCorreo(ID(24), 10)), nros: ['90000731'] });
    const r = await procesarCorteCumplimiento(ID(24), deps, { origen: 'a pedido' });
    assert.deepEqual([r.ocupados, r.encolados], [[10], []]);
    assert.equal(correo(f, ID(24), 10).estado, 'en_envio', 'no se toca');
    assert.equal(aviso(f, '90000732', 10).estado, 'error', 'lo que sumó el reproceso (no va en ese correo) vuelve a «error»');
    assert.equal(aviso(f, '90000731', 10).estado, 'reservado');
    assert.deepEqual(await script(), [], 'préstamo vigente: no se presta otra vez');
    avanzar(R.PRESTAMO_MS);
    const otra = await script();
    assert.equal(otra.length, 1);
    assert.equal(correo(f, ID(24), 10).intentos, 2);
    assert.equal(correo(f, ID(24), 10).estado, 'enviado');
    assert.equal(enviados.length, 2, 'el turno que se cayó y el de ahora (el préstamo vencido se vuelve a prestar)');
  });
  test('tope: prestado 5 veces sin confirmar, el sexto pedido lo deja en «error»; el reproceso le da otra ronda', async () => {
    const { f, deps, script, avanzar, llamar } = preparar();
    sembrarCorte(f, ID(25), { odts: [odt('90000741', { dias: 21 })] });
    await procesarCorteCumplimiento(ID(25), deps);
    for (let i = 0; i < 5; i++) { assert.equal((await script({ responder: false })).length, 1, 'préstamo ' + (i + 1)); avanzar(R.PRESTAMO_MS); }
    assert.deepEqual(await script(), []);
    const c = correo(f, ID(25), 20);
    assert.deepEqual([c.estado, c.intentos], ['error', 5]);
    assert.match(c.error, /5 veces sin confirmar/);
    assert.equal(aviso(f, '90000741', 20).estado, 'error');
    const estado = f.leer('odt_afinia_config/cumplimiento_script');
    assert.match(estado.ultimoResultado, /1 correo quedó en «No se pudo enviar»/);
    // Un «sí salió» tardío del último préstamo se cree (así el reproceso no lo vuelve a mandar).
    const tardio = await llamar({ accion: 'resultado', id: idCorreo(ID(25), 20), prestamo: c.prestamo, ok: true });
    assert.equal(tardio.cuerpo.estado, 'enviado');
    assert.equal(aviso(f, '90000741', 20).estado, 'enviado');
    const r = await procesarCorteCumplimiento(ID(25), deps, { origen: 'a pedido' });
    assert.deepEqual(r.encolados, [], 'ya salió: no vuelve a la cola');
  });
});

describe('la cola se renueva con el corte más reciente (99 §236)', () => {
  test('lo que un corte anterior dejó en cola y no salió lo reemplaza el más reciente (con los días y las ODT de hoy)', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(30), { odts: [odt('90000751', { dias: 11 }), odt('90000752', { dias: 12 })], sello: '20261121150000' });
    await procesarCorteCumplimiento(ID(30), deps);
    assert.equal(correo(f, ID(30), 10).estado, 'pendiente');
    // El script todavía no está instalado. Un día después: la 751 ya se cerró; la 752 sigue abierta.
    sembrarCorte(f, ID(31), { odts: [odt('90000751', { estado: 'CERRADA', ejecucion: sumarDias(DIA_CORTE, -11), cerrada: DIA_CORTE }), odt('90000752', { dias: 13 })], sello: '20261122150000' });
    const r = await procesarCorteCumplimiento(ID(31), deps);
    assert.equal(r.reemplazados, 1);
    const viejo = correo(f, ID(30), 10);
    assert.deepEqual([viejo.estado, viejo.reemplazadoPor, viejo.error], ['error', ID(31), TEXTO_REEMPLAZADO]);
    assert.deepEqual(correo(f, ID(31), 10).nros, ['90000752'], 'solo la que sigue abierta, con los días de hoy');
    assert.equal(aviso(f, '90000751', 10).estado, 'error', 'la cerrada queda libre y no se avisa');
    await script();
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].texto, /90000752 .*Días transcurridos: 14/, 'los días al 22/11 (el corte nuevo)');
    assert.ok(!enviados[0].texto.includes('90000751'));
  });
  test('corrector 99 §236: PAUSADOS, un corte más reciente igual retira lo de antes; al reactivarlos no sale lo viejo', async () => {
    const { f, deps, script, enviados } = preparar();
    sembrarCorte(f, ID(35), { odts: [odt('90000771', { dias: 21 })], sello: '20261121150000' });
    await procesarCorteCumplimiento(ID(35), deps);
    assert.equal(correo(f, ID(35), 20).estado, 'pendiente', 'en cola; el script todavía no lo tomó');
    // El administrador pausa los avisos; mientras tanto se guarda un corte más reciente (la 771 ya se cerró).
    f.store.set('odt_afinia_config/cumplimiento', { ...CONFIG, activo: false });
    sembrarCorte(f, ID(36), { odts: [odt('90000771', { estado: 'CERRADA', ejecucion: sumarDias(DIA_CORTE, -21), cerrada: DIA_CORTE })], sello: '20261122150000' });
    const r = await procesarCorteCumplimiento(ID(36), deps);
    assert.deepEqual([r.motivo, r.reemplazados, r.encolados], ['inactivo', 1, []]);
    const viejo = correo(f, ID(35), 20);
    assert.deepEqual([viejo.estado, viejo.reemplazadoPor], ['error', ID(36)]);
    assert.equal(aviso(f, '90000771', 20).estado, 'error');
    // Los reactiva: el script no recibe el correo viejo («cerrar de inmediato» de una ODT ya cerrada).
    f.store.set('odt_afinia_config/cumplimiento', CONFIG);
    assert.deepEqual(await script(), []);
    assert.equal(enviados.length, 0);
    // Pausados, un corte que no vale (o de otro responsable) no retira nada y el motivo sigue siendo «inactivo».
    const otro = preparar({ config: { ...CONFIG, activo: false } });
    otro.f.store.set('odt_afinia_correos/' + idCorreo(ID(37), 10), { corteId: ID(37), umbral: 10, estado: 'pendiente', responsable: RESP, nros: ['90000772'] });
    sembrarCorte(otro.f, ID(38), { version: 2 });
    const r2 = await procesarCorteCumplimiento(ID(38), otro.deps);
    assert.deepEqual([r2.motivo, r2.reemplazados], ['inactivo', 0]);
    assert.equal(correo(otro.f, ID(37), 10).estado, 'pendiente');
  });
  test('no toca lo de OTRO responsable ni lo que ya está en manos del script', async () => {
    const { f, deps } = preparar();
    f.store.set('odt_afinia_correos/' + idCorreo(ID(32), 10), { corteId: ID(32), umbral: 10, estado: 'pendiente', responsable: 'OTRA PERSONA FICTICIA', nros: ['90000761'] });
    f.store.set('odt_afinia_correos/' + idCorreo(ID(33), 10), { corteId: ID(33), umbral: 10, estado: 'en_envio', responsable: RESP, nros: ['90000762'], prestamo: 'x'.repeat(24), prestamoHastaMs: 1 });
    sembrarCorte(f, ID(34), { odts: [odt('90000763', { dias: 11 })] });
    const r = await procesarCorteCumplimiento(ID(34), deps);
    assert.equal(r.reemplazados, 0);
    assert.equal(correo(f, ID(32), 10).estado, 'pendiente');
    assert.equal(correo(f, ID(33), 10).estado, 'en_envio');
  });
});

describe('la fecha del corte en Colombia', () => {
  test('archivo bajado a las 22:00 del 20/11 en Colombia (03:00 del 21/11 en UTC): los días se cuentan al 20/11', async () => {
    const { f, deps } = preparar();
    // Al 20/11 (Colombia): la del 10/11 lleva 10 días, la del 05/11 lleva 15 y la del 01/11 lleva 19 (todavía no 20).
    // Contados al 21/11 (la fecha en UTC), la del 01/11 llevaría 20 y saldría en el correo de INCUMPLIMIENTO: no debe.
    sembrarCorte(f, ID(35), { odts: [odt('90000741', { ejecucion: '2026-11-10' }), odt('90000742', { ejecucion: '2026-11-05' }), odt('90000743', { ejecucion: '2026-11-01' })], sello: '20261121030000' });
    const r = await procesarCorteCumplimiento(ID(35), deps);
    assert.deepEqual(r.encolados, [{ umbral: 10, n: 1 }, { umbral: 15, n: 2 }]);
    assert.match(correo(f, ID(35), 10).texto, /90000741 .*Días transcurridos: 10/);
    assert.match(correo(f, ID(35), 15).texto, /90000743 .*Días transcurridos: 19/);
    assert.match(correo(f, ID(35), 15).texto, /90000742 .*Días transcurridos: 15/);
    assert.match(correo(f, ID(35), 15).texto, /con datos del 20\/11\/2026 22:00/);
    assert.equal(correo(f, ID(35), 20), undefined);
  });
});

describe('quién pide el reproceso', () => {
  test('esAdminConPerfil: perfil con rol admin y activo (el arranque sin perfil, un técnico o un inactivo, no)', () => {
    assert.equal(esAdminConPerfil({ existe: true, datos: { rol: 'admin', activo: true } }), true);
    assert.equal(esAdminConPerfil({ existe: true, datos: { rol: 'admin', activo: false } }), false);
    assert.equal(esAdminConPerfil({ existe: true, datos: { rol: 'tecnico', activo: true } }), false);
    assert.equal(esAdminConPerfil({ existe: true, datos: { rol: 'admin visitante', activo: true } }), false);
    assert.equal(esAdminConPerfil({ existe: false, datos: null }), false);
    assert.equal(esAdminConPerfil(null), false);
  });
  test('esYaExiste reconoce el «ya existe» del Admin SDK', () => {
    assert.equal(esYaExiste({ code: 6 }), true);
    assert.equal(esYaExiste({ code: 'already-exists' }), true);
    assert.equal(esYaExiste({ code: 5 }), false);
  });
});

describe('un proceso CORTADO a mitad no deja una ODT sin su aviso (99 §236)', () => {
  /** Hace que `deps[nombre]` falle las `veces` primeras llamadas que cumplan `cuando` (por defecto, todas). */
  const fallar = (deps, nombre, veces, cuando = () => true) => {
    const orig = deps[nombre];
    let n = 0;
    deps[nombre] = async (...args) => {
      if (cuando(...args) && n < veces) { n++; const e = new Error('DEADLINE_EXCEEDED de prueba'); e.code = 4; throw e; }
      return orig(...args);
    };
  };
  test('la base falla al RESERVAR: lo reservado vuelve a «error», el proceso lanza y el corte siguiente lo encola', async () => {
    const { f, deps, registro } = preparar();
    sembrarCorte(f, ID(40), { odts: [odt('90000751', { dias: 12 }), odt('90000752', { dias: 22 })] });
    // Las de más días van primero: se reserva la de 22 (umbral 20) y falla la reserva de la de 12.
    fallar(deps, 'crearAviso', 1, (id) => id === idAviso('90000751', 10));
    await assert.rejects(procesarCorteCumplimiento(ID(40), deps), /DEADLINE_EXCEEDED/);
    assert.equal(correos(f).length, 0);
    assert.equal(aviso(f, '90000752', 20).estado, 'error', 'lo que este proceso reservó vuelve a «error»');
    assert.equal(aviso(f, '90000751', 10), undefined);
    assert.ok(registro.some(([nivel, msg]) => nivel === 'error' && /al reservar/.test(msg)));
    sembrarCorte(f, ID(41), { odts: [odt('90000751', { dias: 13 }), odt('90000752', { dias: 23 })], sello: '20261122150000' });
    const r = await procesarCorteCumplimiento(ID(41), deps);
    assert.deepEqual(r.encolados, [{ umbral: 10, n: 1 }, { umbral: 20, n: 1 }]);
    assert.equal(aviso(f, '90000752', 20).correoId, idCorreo(ID(41), 20), 'el de 20 lo tomó el corte siguiente');
    assert.equal(aviso(f, '90000752', 20).estado, 'reservado');
  });
  test('la instancia se CAE después de reservar (sin correo): el corte siguiente la toma al vencer el candado, no antes', async () => {
    const { f, deps, avanzar, script, enviados } = preparar();
    sembrarCorte(f, ID(42), { odts: [odt('90000761', { dias: 21 })] });
    const caida = deps.encolarCorreo;
    deps.encolarCorreo = async () => new Promise(() => {});   // nunca vuelve
    const colgado = procesarCorteCumplimiento(ID(42), deps);
    await new Promise((r) => setTimeout(r, 20));
    deps.encolarCorreo = caida;
    assert.equal(aviso(f, '90000761', 20).estado, 'reservado');
    assert.equal(correo(f, ID(42), 20), undefined);
    // Un corte guardado un minuto después: el otro proceso podría seguir vivo → no se toca.
    sembrarCorte(f, ID(43), { odts: [odt('90000761', { dias: 21 })], sello: '20261121151000' });
    avanzar(60000);
    const r1 = await procesarCorteCumplimiento(ID(43), deps);
    assert.deepEqual(r1.encolados, []);
    assert.equal(aviso(f, '90000761', 20).correoId, idCorreo(ID(42), 20));
    // Pasado el candado, el corte siguiente la TOMA y la encola.
    sembrarCorte(f, ID(44), { odts: [odt('90000761', { dias: 22 })], sello: '20261122150000' });
    avanzar(LEASE_ENVIO_MS);
    assert.equal((await procesarCorteCumplimiento(ID(42), deps)).motivo, 'hay_corte_mas_reciente');
    const r2 = await procesarCorteCumplimiento(ID(44), deps);
    assert.deepEqual(r2.encolados, [{ umbral: 20, n: 1 }]);
    assert.equal(aviso(f, '90000761', 20).correoId, idCorreo(ID(44), 20));
    await script();
    assert.equal(aviso(f, '90000761', 20).estado, 'enviado');
    assert.equal(enviados.length, 1);
    void colgado;
  });
  test('una reserva vieja cuyo correo SÍ salió con esa ODT: se marca «enviado» y no se repite', async () => {
    const { f, deps, avanzar } = preparar();
    sembrarCorte(f, ID(47), { odts: [odt('90000781', { dias: 11 })] });
    f.store.set('odt_afinia_avisos/' + idAviso('90000781', 10), { nro: '90000781', umbral: 10, estado: 'reservado', corteId: ID(47), correoId: idCorreo(ID(47), 10), dias: 11, en: 1, intentoEnMs: 1 });
    f.store.set('odt_afinia_correos/' + idCorreo(ID(47), 10), { corteId: ID(47), umbral: 10, estado: 'enviado', nros: ['90000781'], intentos: 1, responsable: RESP });
    sembrarCorte(f, ID(48), { odts: [odt('90000781', { dias: 12 })], sello: '20261122150000' });
    avanzar(LEASE_ENVIO_MS);
    const r = await procesarCorteCumplimiento(ID(48), deps);
    assert.deepEqual(r.encolados, []);
    assert.equal(aviso(f, '90000781', 10).estado, 'enviado');
    assert.equal(aviso(f, '90000781', 10).correoId, idCorreo(ID(47), 10), 'sigue siendo del correo que salió');
  });
  test('la base falla al DEJAR EN COLA un correo: sus avisos vuelven a «error», siguen los demás y el reproceso lo encola', async () => {
    const { f, deps } = preparar();
    sembrarCorte(f, ID(51), { odts: [odt('90000811', { dias: 11 }), odt('90000812', { dias: 21 })] });
    fallar(deps, 'encolarCorreo', 1, (id) => id === idCorreo(ID(51), 10));
    const r = await procesarCorteCumplimiento(ID(51), deps);
    assert.deepEqual(r.encolados, [{ umbral: 20, n: 1 }]);
    assert.deepEqual(r.errores.map((x) => x.umbral), [10]);
    assert.equal(aviso(f, '90000811', 10).estado, 'error');
    const r2 = await procesarCorteCumplimiento(ID(51), deps);
    assert.deepEqual(r2.encolados.map((x) => x.umbral), [10, 20]);
    assert.equal(correo(f, ID(51), 10).estado, 'pendiente');
  });
  test('el script avisó que salió pero la base no marcó los avisos: el proceso siguiente los marca «enviado» (no se repite)', async () => {
    const { f, deps, script, enviados, avanzar } = preparar();
    sembrarCorte(f, ID(52), { odts: [odt('90000821', { dias: 11 })] });
    await procesarCorteCumplimiento(ID(52), deps);
    // La primera vez que se marcan los avisos de un correo (una transacción que lee avisos: corrector 99 §236), la base falla.
    const orig = f.db.runTransaction;
    let rota = true;
    f.db.runTransaction = (fn) => orig((t) => {
      const getAll = t.getAll;
      t.getAll = async (...refs) => {
        if (rota && refs.every((r) => r.path.startsWith('odt_afinia_avisos/'))) { rota = false; throw new Error('falla de la base de prueba'); }
        return getAll(...refs);
      };
      return fn(t);
    });
    await script();
    f.db.runTransaction = orig;
    assert.equal(rota, false, 'la falla se usó');
    assert.equal(correo(f, ID(52), 10).estado, 'enviado');
    assert.equal(aviso(f, '90000821', 10).estado, 'reservado');
    sembrarCorte(f, ID(53), { odts: [odt('90000821', { dias: 12 })], sello: '20261122150000' });
    avanzar(LEASE_ENVIO_MS);
    const r = await procesarCorteCumplimiento(ID(53), deps);
    assert.deepEqual(r.encolados, []);
    assert.equal(aviso(f, '90000821', 10).estado, 'enviado');
    await script();
    assert.equal(enviados.length, 1, 'no se reenvía');
  });
});

describe('sin la hora de descarga en el nombre del archivo, no se avisa (99 §236)', () => {
  test('un archivo renombrado: la fecha sería la prevista más reciente (puede ser futura): no encola nada y dice por qué', async () => {
    const { f, deps } = preparar();
    const p = sembrarCorte(f, ID(54));
    const ruta = 'odt_afinia_cortes/' + ID(54);
    f.store.set(ruta, { ...f.store.get(ruta), archivo: { ...p.corte.archivo, nombre: 'informe_renombrado.csv' }, fechaDatos: '2026-12-31T23:59:59' });
    const r = await procesarCorteCumplimiento(ID(54), deps);
    assert.equal(r.motivo, 'sin_hora_de_descarga');
    assert.equal(correos(f).length, 0);
    assert.match(TEXTO_MOTIVO.sin_hora_de_descarga, /no trae la hora de descarga/);
  });
});

describe('un correo demasiado grande para un mensaje de Google (99 §236)', () => {
  test('con cientos de ODT, el HTML no cabe: el correo va solo con el texto (la misma tabla, en líneas)', async () => {
    const { f, deps } = preparar();
    const muchas = Array.from({ length: 380 }, (_, i) => odt(String(90100000 + i), { dias: 25 }));
    sembrarCorte(f, ID(55), { odts: muchas });
    const r = await procesarCorteCumplimiento(ID(55), deps);
    assert.deepEqual(r.encolados, [{ umbral: 20, n: 380 }]);
    const c = correo(f, ID(55), 20);
    assert.equal(c.html, '');
    assert.ok(c.texto.includes('90100379') && c.texto.length < 180000);
  });
});
