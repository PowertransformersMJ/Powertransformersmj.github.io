// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia · INDICADORES (pedido del Ingeniero del 2026-11-23), reglas en el emulador.
//   · odt_afinia_cortes/{id}: lo guarda SOLO un admin con perfil, en UN lote con todas sus partes; forma exacta
//     (17 campos, con fechaDatos), textos y números acotados, totales que suman, nPartes coherente con las ODT,
//     creadoPor = su perfil, hora del servidor; de cada lista, que sea lista, su tamaño y la forma del PRIMER elemento.
//   · partes/{k}: solo en el lote que crea su corte; k < nPartes; llenas (400) menos la última (el resto); CADENA:
//     cada parte exige la anterior y el corte la última, así que un lote con un hueco se NIEGA.
//   · lectura: solo administradores con perfil (técnico, visitante, admin de arranque sin perfil y anónimo, fuera),
//     probada también con el REPOSITORIO de la página (listar, leer, anterior, ultimoDe, porHuella, estadoSgm).
//   · TRAZABILIDAD: un corte y sus partes NUNCA cambian ni se borran, ni por el admin que los creó.
//   · PRESUPUESTO: Firestore evalúa ≤ 1000 expresiones por documento. Un corte de forma real debe entrar dejando
//     ≥ 30 % libre (relleno calibrado: ver la prueba «presupuesto»).
//   · VERSIÓN 2 (2026-11-24, filtros por AZT y por jefe de trabajo): los cortes nuevos se crean con version == 2 y la
//     PRIMERA ODT de cada parte con sus 11 campos (azt y jefe, textos de 0 a 200); un corte nuevo de la versión 1 se
//     niega, y los de la versión 1 ya guardados se siguen leyendo (y nunca cambian).
// Cada caso en las DOS direcciones (L-73/L-78): lo que se niega tiene su control que pasa. Incluye SABOTAJES: lo que
// alguien con la sesión admin intentaría escribir a mano y la regla debe rechazar.
// Prefijo `ic_` (ids `iccorte…`); nunca clearFirestore() (el emulador se comparte con las demás pruebas de reglas).
// Datos INVENTADOS: ninguna persona, empresa, uid, correo, N.º de ODT ni conteo real (la «forma real» usa 6
// contratistas, 6 tipos, 4 zonas, 12 meses y 3 partes de 400/400/97).
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as SDK from 'firebase/firestore';
import { agregar } from '../assets/js/domain/odt_afinia_indicadores.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';

const { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, orderBy, limit, writeBatch, serverTimestamp } = SDK;
const REGLAS = readFileSync('firestore.rules', 'utf8');
let testEnv;

/* ── personas inventadas ─────────────────────────────────────────────────────── */
const P = {
  ic_admin: { rol: 'admin', nombre: 'Admin Indicadores Prueba', email: 'admin.ind@prueba.test' },
  ic_admin2: { rol: 'admin', nombre: 'Otro Admin Indicadores', email: 'admin2.ind@prueba.test' },
  ic_tecnico: { rol: 'tecnico', nombre: 'Tecnico Indicadores Prueba', email: 'tecnico.ind@prueba.test' },
  ic_visit: { rol: 'visitante', nombre: 'Visitante Indicadores', email: 'visitante.ind@prueba.test' },
  ic_inact: { rol: 'admin', nombre: 'Admin Inactivo Indicadores', email: 'inactivo.ind@prueba.test', activo: false }
};
const plano = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
async function sembrar(fn) { await testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }
async function leer(ruta) {
  let v; await testEnv.withSecurityRulesDisabled(async (c) => { v = (await getDoc(doc(c.firestore(), ruta))).data(); }); return v;
}

/* ── cortes de prueba (forma real, datos inventados) ──────────────────────────── */
const ID = (k) => 'iccorte' + String(k).padStart(13, '0');     // 20 alfanuméricos
const HEX = 'ab'.repeat(32);
const ESTADOS = ['GENERADA', 'EJECUTADA', 'CERRADA', 'CERRADA', 'NO EJECUTADA', 'CERRADA', 'INACTIVA'];
const mm = (i) => String((i % 12) + 1).padStart(2, '0');
const odtDe = (i) => {
  const estado = ESTADOS[i % ESTADOS.length];
  return {
    nro: String(90000000 + i), empresa: 'CONTRATISTA FICTICIO ' + (i % 6), tipo: 'TIPO DE TRABAJO FICTICIO ' + (i % 6),
    zona: 'ZONA FICTICIA ' + (i % 4), subestacion: 'S/E PRUEBA ' + (i % 9), prevista: '2026-' + mm(i) + '-15',
    cerrada: estado === 'CERRADA' ? '2026-' + mm(i) + '-20' : '', estado, principal: i % 5 !== 0,
    azt: 'AZT FICTICIO DE PRUEBA ' + (i % 7), jefe: 'JEFE DE TRABAJO FICTICIO DE PRUEBA ' + (i % 11)
  };
};
/** Una ODT como las guardaba la VERSIÓN 1 (9 campos, sin azt ni jefe). */
const odtV1 = (i) => { const { azt, jefe, ...resto } = odtDe(i); return resto; };
const odtsDe = (n) => Array.from({ length: n }, (_, i) => odtDe(i));
const nombreDe = (u) => (P[u] ? P[u].nombre : '');
/** El corte como lo arma la página (los agregados salen del dominio: agregar). */
function corteDe(uid, n, extra = {}) {
  const ag = agregar(odtsDe(n));
  return {
    responsable: 'RESPONSABLE FICTICIO DE PRUEBA',
    archivo: { nombre: 'INFORME_ODT_20260101000000_prueba.csv', bytes: 12345, sha256: HEX },
    rango: ag.rango,
    fechaDatos: '2026-01-01T00:00:00',
    filasArchivo: n + 10, odtsArchivo: n + 5, filasResponsable: n + 2, odts: n,
    totales: ag.totales, porEmpresa: ag.porEmpresa, porTipo: ag.porTipo, porZona: ag.porZona, porMes: ag.porMes,
    nPartes: Math.ceil(n / 400), version: 2,
    creadoPor: { uid, nombre: nombreDe(uid) }, creadoEn: serverTimestamp(),
    ...extra
  };
}
const partesDe = (n) => {
  const out = [];
  for (let k = 0; k * 400 < n; k++) out.push([String(k), { k, odts: Array.from({ length: Math.min(400, n - k * 400) }, (_, j) => odtDe(k * 400 + j)) }]);
  return out;
};
/**
 * Lo que escribe la página: el corte + sus partes en UN lote. Cada pieza se puede torcer para los sabotajes:
 * `corte` (datos del corte, o null = sin corte), `partes` ([k, datos] a escribir), `mas(b, d)` agrega operaciones.
 */
function guardar(uid, id, n, { corte, partes, mas, db } = {}) {
  const d = db || plano(uid); const b = writeBatch(d);
  if (corte !== null) b.set(doc(d, 'odt_afinia_cortes', id), corte || corteDe(uid, n));
  for (const [k, datos] of (partes || partesDe(n))) b.set(doc(d, 'odt_afinia_cortes', id, 'partes', k), datos);
  if (mas) mas(b, d);
  return b.commit();
}
/** La primera ODT de una parte, cambiada (para los sabotajes del primer elemento). */
function conPrimera(n, cambio) {
  const p = partesDe(n);
  const [k, datos] = p[0];
  p[0] = [k, { ...datos, odts: [cambio({ ...datos.odts[0] }), ...datos.odts.slice(1)] }];
  return p;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: REGLAS, host: '127.0.0.1', port: 8080 }
  });
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(P)) {
      await setDoc(doc(d, 'usuarios', uid), { email: p.email, rol: p.rol, activo: p.activo ?? true, nombre: p.nombre });
    }
    await setDoc(doc(d, 'admins', 'ic_arranque'), { email: 'arranque.ind@prueba.test' });   // admin de arranque SIN perfil
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

// ═════════════════════════════════════════════════════════════════════════════
describe('guardar un corte — solo un admin con perfil, en UN lote con todas sus partes', () => {
  test('el admin guarda un corte de FORMA REAL (6 contratistas, 6 tipos, 4 zonas, 12 meses, 3 partes 400/400/97) y uno de 1 parte; los demás no', async () => {
    const real = corteDe('ic_admin', 897);
    assert.deepEqual([real.porEmpresa.length, real.porTipo.length, real.porZona.length, real.porMes.length, real.nPartes], [6, 6, 4, 12, 3]);
    assert.equal(Object.keys(real).length, 17);
    await assertFails(guardar('ic_tecnico', ID(2), 5));
    await assertFails(guardar('ic_visit', ID(3), 5));
    await assertFails(guardar('ic_inact', ID(4), 5));
    await assertFails(guardar('ic_arranque', ID(5), 5));
    await assertFails((() => { const d = anon(); const b = writeBatch(d); b.set(doc(d, 'odt_afinia_cortes', ID(6)), corteDe('ic_admin', 5)); return b.commit(); })());
    await assertSucceeds(guardar('ic_admin', ID(1), 5));
    await assertSucceeds(guardar('ic_admin', ID(7), 897, { corte: real }));
    const c = await leer('odt_afinia_cortes/' + ID(7));
    assert.equal(c.nPartes, 3);
    assert.equal(c.fechaDatos, '2026-01-01T00:00:00');
    assert.equal((await leer('odt_afinia_cortes/' + ID(7) + '/partes/2')).odts.length, 97);
  });
  test('carga máxima: 60 partes (24.000 ODT) en el mismo lote', async () => {
    await assertSucceeds(guardar('ic_admin', ID(8), 24000, { corte: corteDe('ic_admin', 24000, { filasArchivo: 30000, odtsArchivo: 25000, filasResponsable: 24500 }) }));
    assert.equal((await leer('odt_afinia_cortes/' + ID(8) + '/partes/59')).odts.length, 400);
  });
  test('forma exacta: campo de más o de menos (sin fechaDatos), archivo, rango, textos, versión y quién/cuándo', async () => {
    const mal = (k, extra) => guardar('ic_admin', ID(k), 5, { corte: corteDe('ic_admin', 5, extra) });
    await assertFails(mal(20, { extra: 1 }));
    const sinCampo = corteDe('ic_admin', 5); delete sinCampo.porZona;
    await assertFails(guardar('ic_admin', ID(21), 5, { corte: sinCampo }));
    const sinFecha = corteDe('ic_admin', 5); delete sinFecha.fechaDatos;                                  // la forma vieja de 16
    await assertFails(guardar('ic_admin', ID(37), 5, { corte: sinFecha }));
    await assertFails(mal(22, { responsable: 'AB' }));
    await assertFails(mal(23, { responsable: 'R'.repeat(121) }));
    await assertFails(mal(38, { responsable: ' RESPONSABLE CON ESPACIO' }));
    await assertFails(mal(39, { responsable: 12345 }));
    await assertFails(mal(24, { archivo: { nombre: 'x.csv', bytes: 1, sha256: 'AB'.repeat(32) } }));      // huella en mayúsculas
    await assertFails(mal(25, { archivo: { nombre: 'x.csv', bytes: 0, sha256: HEX } }));
    await assertFails(mal(26, { archivo: { nombre: '', bytes: 10, sha256: HEX } }));
    await assertFails(mal(27, { archivo: { nombre: 'x.csv', bytes: 10, sha256: HEX, ruta: '/tmp' } }));
    await assertFails(mal(28, { rango: { desde: '2026-11-20', hasta: '2026-01-02' } }));                  // al revés
    await assertFails(mal(29, { rango: { desde: '02/01/2026', hasta: '2026-11-20' } }));                  // no es aaaa-mm-dd
    await assertFails(mal(30, { version: 1 }));                                                          // la versión vieja
    await assertFails(mal(34, { version: 3 }));
    await assertFails(mal(35, { version: '2' }));
    await assertFails(mal(31, { creadoPor: { uid: 'ic_admin', nombre: 'Otro Nombre' } }));
    await assertFails(mal(32, { creadoPor: { uid: 'ic_admin2', nombre: nombreDe('ic_admin2') } }));
    // Una hora puesta por el cliente (un minuto atrás: con «ahora» podría caer en el mismo milisegundo que el servidor).
    await assertFails(mal(33, { creadoEn: new Date(Date.now() - 60000) }));
    // Control: la misma forma, bien, pasa.
    await assertSucceeds(mal(36, {}));
  });
  test('fechaDatos: solo «aaaa-mm-ddThh:mm:ss» (la hora de descarga del archivo)', async () => {
    const mal = (k, fechaDatos) => guardar('ic_admin', ID(k), 5, { corte: corteDe('ic_admin', 5, { fechaDatos }) });
    for (const [k, f] of [[100, '2026-11-20 08:00:00'], [101, '2026-13-01T00:00:00'], [102, '2026-11-20T24:00:00'], [103, '2026-11-20'],
      [104, 20261120080000], [105, '2026-11-20T08:00:00Z'], [106, '']]) await assertFails(mal(k, f));
    await assertSucceeds(mal(107, '2026-11-20T08:00:00'));
    await assertSucceeds(mal(108, '2026-12-31T23:59:59'));
  });
  test('números: enteros ≥ 0 y coherentes (filas ≥ ODT, totales que suman, total = odts)', async () => {
    const mal = (k, extra) => guardar('ic_admin', ID(k), 5, { corte: corteDe('ic_admin', 5, extra) });
    const t5 = { total: 5, generada: 1, ejecutada: 1, noEjecutada: 1, cerrada: 1, inactiva: 0, otro: 1 };
    await assertFails(mal(40, { odts: 6 }));                                         // no cuadra con totales ni partes
    await assertFails(mal(41, { filasResponsable: 4 }));                             // menos filas que ODT
    await assertFails(mal(42, { odtsArchivo: 4 }));                                  // menos ODT en el archivo que en el corte
    await assertFails(mal(43, { filasArchivo: 6, filasResponsable: 7 }));            // más filas del responsable que del archivo
    await assertFails(mal(44, { totales: { ...t5, cerrada: 3 } }));                  // los estados no suman el total
    await assertFails(mal(45, { totales: { ...t5, otro: -1, generada: 3 } }));       // suma bien, pero con un negativo
    await assertFails(mal(46, { totales: { ...t5, extra: 0 } }));
    await assertFails(mal(47, { filasArchivo: 15.5 }));
    await assertFails(mal(48, { totales: { ...t5, generada: '1' } }));               // un texto que parece número
    await assertFails(mal(50, { totales: { ...t5, generada: 0.5, ejecutada: 1.5 } })); // decimales que suman entero
    await assertFails(mal(51, { totales: { ...t5, total: '5' } }));
    await assertFails(mal(52, { filasArchivo: 2000001, odtsArchivo: 2000000, filasResponsable: 2000000 }));
    // Control.
    await assertSucceeds(mal(49, { totales: t5 }));
  });
  test('nPartes coherente: ni de más ni de menos, y la última parte existe en el MISMO lote', async () => {
    await assertFails(guardar('ic_admin', ID(55), 5, { corte: corteDe('ic_admin', 5, { nPartes: 2 }), partes: [...partesDe(5), ['1', { k: 1, odts: [] }]] }));
    await assertFails(guardar('ic_admin', ID(56), 401, { corte: corteDe('ic_admin', 401, { nPartes: 1 }), partes: [['0', { k: 0, odts: partesDe(401)[0][1].odts }]] }));
    await assertFails(guardar('ic_admin', ID(57), 5, { partes: [] }));                                       // SABOTAJE: corte sin partes
    await assertFails(guardar('ic_admin', ID(58), 803, { partes: partesDe(803).slice(0, 2) }));             // falta la última
    await assertSucceeds(guardar('ic_admin', ID(59), 803));
  });
});

describe('listas: que sean listas, su tamaño y la forma del PRIMER elemento (el resto lo garantiza planCorte)', () => {
  test('SABOTAJE: contratistas, tipos, zonas y meses con otra forma', async () => {
    const mal = (k, extra) => guardar('ic_admin', ID(k), 5, { corte: corteDe('ic_admin', 5, extra) });
    const g0 = corteDe('ic_admin', 5).porEmpresa[0];
    const m0 = corteDe('ic_admin', 5).porMes[0];
    await assertFails(mal(110, { porEmpresa: Array.from({ length: 301 }, (_, i) => ({ ...g0, clave: 'C' + i })) }));
    await assertFails(mal(111, { porMes: 'no es lista' }));
    await assertFails(mal(112, { porTipo: [] }));                                                // sin ningún tipo
    await assertFails(mal(113, { porEmpresa: [{ ...g0, extra: 1 }] }));                         // una clave de más
    const sinTotal = { ...g0 }; delete sinTotal.total;
    await assertFails(mal(114, { porEmpresa: [sinTotal] }));                                    // una clave de menos
    await assertFails(mal(115, { porTipo: [{ ...g0, clave: 'T'.repeat(201) }] }));               // nombre demasiado largo
    await assertFails(mal(116, { porZona: [{ ...g0, clave: '' }] }));                            // sin nombre
    await assertFails(mal(117, { porZona: [{ ...g0, clave: 7 }] }));                             // el nombre no es texto
    await assertFails(mal(118, { porMes: [{ ...m0, mes: '2026-13' }] }));
    await assertFails(mal(119, { porMes: [{ ...m0, extra: 0 }] }));
    await assertFails(mal(120, { porMes: Array.from({ length: 241 }, () => m0) }));
    await assertFails(mal(121, { porEmpresa: ['no es un mapa'] }));
    // Control: la misma forma, bien, pasa (y el primero con 200 letras y 300 elementos, también).
    await assertSucceeds(mal(122, { porTipo: [{ ...g0, clave: 'T'.repeat(200) }], porEmpresa: Array.from({ length: 300 }, (_, i) => ({ ...g0, clave: 'C' + i })) }));
  });
  test('SABOTAJE: la primera ODT de una parte con otra forma', async () => {
    const mal = (k, cambio) => guardar('ic_admin', ID(k), 5, { partes: conPrimera(5, cambio) });
    await assertFails(mal(130, (o) => ({ ...o, extra: true })));
    await assertFails(mal(131, (o) => { delete o.principal; return o; }));
    await assertFails(mal(132, (o) => ({ ...o, nro: '' })));
    await assertFails(mal(133, (o) => ({ ...o, nro: '9'.repeat(41) })));
    await assertFails(mal(134, () => 'no es un mapa'));
    // Control.
    await assertSucceeds(mal(135, (o) => ({ ...o, nro: '9'.repeat(40) })));
  });
});

describe('versión 2 — cada ODT con su AZT en sitio y su jefe de trabajo (2026-11-24)', () => {
  /** Las partes como las escribía la versión 1 (ODT de 9 campos). */
  const partesV1 = (n) => partesDe(n).map(([k, d]) => [k, { k: d.k, odts: d.odts.map((_, j) => odtV1(Number(k) * 400 + j)) }]);
  test('entra la versión 2; un corte NUEVO de la versión 1 se niega (con sus ODT de 9 campos, o con las de 11)', async () => {
    assert.deepEqual(Object.keys(partesDe(5)[0][1].odts[0]).sort(), ['azt', 'cerrada', 'empresa', 'estado', 'jefe', 'nro', 'prevista', 'principal', 'subestacion', 'tipo', 'zona']);
    await assertFails(guardar('ic_admin', ID(140), 5, { corte: corteDe('ic_admin', 5, { version: 1 }), partes: partesV1(5) }));   // la forma vieja entera
    await assertFails(guardar('ic_admin', ID(141), 5, { partes: partesV1(5) }));                                                 // versión 2 con ODT de 9
    await assertFails(guardar('ic_admin', ID(142), 5, { corte: corteDe('ic_admin', 5, { version: 1 }) }));                       // versión 1 con ODT de 11
    await assertFails(guardar('ic_admin', ID(144), 803, { partes: partesV1(803) }));                                             // 3 partes viejas
    // Control: la versión 2 entera pasa (1 y 3 partes).
    await assertSucceeds(guardar('ic_admin', ID(143), 5));
    await assertSucceeds(guardar('ic_admin', ID(145), 803));
    assert.equal((await leer('odt_afinia_cortes/' + ID(145) + '/partes/2')).odts[0].azt, odtDe(800).azt);
  });
  test('SABOTAJE: la primera ODT sin azt o sin jefe, con otro tipo, más larga o con otra clave', async () => {
    const mal = (k, cambio) => guardar('ic_admin', ID(k), 5, { partes: conPrimera(5, cambio) });
    await assertFails(mal(150, (o) => { delete o.azt; return o; }));
    await assertFails(mal(151, (o) => { delete o.jefe; return o; }));
    await assertFails(mal(152, (o) => { delete o.azt; delete o.jefe; return o; }));          // 9 campos: la forma vieja
    await assertFails(mal(153, (o) => ({ ...o, azt: 7 })));
    await assertFails(mal(154, (o) => ({ ...o, azt: null })));
    await assertFails(mal(155, (o) => ({ ...o, jefe: 'J'.repeat(201) })));
    await assertFails(mal(163, (o) => ({ ...o, azt: 'A'.repeat(201) })));
    await assertFails(mal(156, (o) => ({ ...o, azt: ['AZT FICTICIO'] })));
    await assertFails(mal(157, (o) => ({ ...o, jefe: { nombre: 'JEFE FICTICIO' } })));
    await assertFails(mal(158, (o) => { const x = { ...o, aztt: o.azt }; delete x.azt; return x; }));   // 11 campos, otra clave
    await assertFails(mal(159, (o) => ({ ...o, extra: '' })));                                   // 12 campos
    // 9 campos CON azt y jefe, pero sin estado ni principal: solo `size() == 11` la niega (claves y textos están bien).
    await assertFails(mal(162, (o) => { delete o.estado; delete o.principal; return o; }));
    // Control: vacíos y de 200 letras pasan.
    await assertSucceeds(mal(160, (o) => ({ ...o, azt: '', jefe: 'J'.repeat(200) })));
    await assertSucceeds(mal(161, (o) => ({ ...o, azt: 'A'.repeat(200), jefe: '' })));
  });
  test('los cortes de la versión 1 ya guardados se siguen leyendo (también con el repositorio) y nunca cambian', async () => {
    const id = ID(170);
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia_cortes', id), { ...corteDe('ic_admin', 5, { version: 1 }), creadoEn: new Date(Date.UTC(2026, 3, 15, 14, 0)) });
      for (const [k, datos] of partesV1(5)) await setDoc(doc(d, 'odt_afinia_cortes', id, 'partes', k), datos);
    });
    await assertSucceeds(getDoc(doc(plano('ic_admin2'), 'odt_afinia_cortes', id)));
    await assertSucceeds(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes', id, 'partes'), limit(60))));
    await assertFails(getDoc(doc(plano('ic_tecnico'), 'odt_afinia_cortes', id)));
    const repo = crearRepositorioCortes({ sdk: SDK, db: plano('ic_admin'), sesion: () => ({ uid: 'ic_admin', nombre: nombreDe('ic_admin'), esAdmin: true, legacy: false }) });
    const l = await repo.leer(id);
    assert.equal(l.corte.version, 1);
    assert.equal(l.completo, true);
    assert.ok(l.odts.length === 5 && l.odts.every((o) => Object.keys(o).length === 9));
    // Ni «pasarlo» a la versión 2, ni agregarle el AZT, ni borrarlo.
    await assertFails(updateDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', id), { version: 2 }));
    await assertFails(setDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', id, 'partes', '0'), partesDe(5)[0][1]));
    await assertFails(deleteDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', id)));
  });
});

describe('partes — solo en el lote que crea su corte, llenas menos la última, en CADENA', () => {
  test('SABOTAJE: una parte suelta (sin su corte) o una parte nueva para un corte que ya existe', async () => {
    await assertFails(guardar('ic_admin', ID(60), 5, { corte: null }));
    await assertSucceeds(guardar('ic_admin', ID(61), 5));
    await assertFails(setDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', ID(61), 'partes', '1'), { k: 1, odts: [odtDe(1)] }));
    await assertFails(setDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', ID(61), 'partes', '0'), { k: 0, odts: [odtDe(1)] }));
  });
  test('SABOTAJE: tamaños que no suman, k fuera de rango o que no coincide, campos de más', async () => {
    const p = partesDe(803);
    await assertFails(guardar('ic_admin', ID(70), 803, { partes: [p[0], ['1', { k: 1, odts: p[1][1].odts.slice(0, 399) }], p[2]] }));   // una del medio no está llena
    await assertFails(guardar('ic_admin', ID(71), 803, { partes: [p[0], p[1], ['2', { k: 2, odts: [odtDe(1), odtDe(2)] }]] }));      // la última no lleva el resto
    await assertFails(guardar('ic_admin', ID(72), 803, { mas: (b, d) => b.set(doc(d, 'odt_afinia_cortes', ID(72), 'partes', '3'), { k: 3, odts: [odtDe(9)] }) }));   // k ≥ nPartes
    await assertFails(guardar('ic_admin', ID(73), 5, { partes: [['0', { k: 1, odts: partesDe(5)[0][1].odts }]] }));                    // k no coincide
    await assertFails(guardar('ic_admin', ID(74), 5, { partes: [['0', { k: 0, odts: partesDe(5)[0][1].odts, extra: true }]] }));
    await assertFails(guardar('ic_admin', ID(75), 5, { partes: [['0', { k: 0, odts: 'no es lista' }]] }));
    await assertFails(guardar('ic_admin', ID(76), 5, { mas: (b, d) => b.set(doc(d, 'odt_afinia_cortes', ID(76), 'partes', 'x'), { k: 0, odts: [] }) }));
    // Control: el mismo lote bien armado pasa.
    await assertSucceeds(guardar('ic_admin', ID(77), 803));
  });
  test('SABOTAJE: un lote SIN una parte del medio se NIEGA (cadena), y la que falta tampoco entra después', async () => {
    const p = partesDe(803);
    await assertFails(guardar('ic_admin', ID(78), 803, { partes: [p[0], p[2]] }));
    const q = partesDe(15 * 400);
    await assertFails(guardar('ic_admin', ID(79), 15 * 400, { partes: q.filter(([k]) => k !== '7') }));
    await assertFails(guardar('ic_admin', ID(81), 803, { partes: [p[1], p[2]] }));                        // sin la primera
    // Nada quedó a medias: ni el corte ni sus partes.
    assert.equal(await leer('odt_afinia_cortes/' + ID(78)), undefined);
    assert.equal(await leer('odt_afinia_cortes/' + ID(78) + '/partes/0'), undefined);
    // Control: los mismos lotes completos pasan; después no se les puede agregar ni rehacer una parte.
    await assertSucceeds(guardar('ic_admin', ID(82), 803));
    await assertSucceeds(guardar('ic_admin', ID(83), 15 * 400));
    await assertFails(setDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', ID(82), 'partes', '1'), p[1][1]));
  });
});

describe('trazabilidad — un corte nunca cambia ni se borra', () => {
  test('ni el admin que lo creó, ni otro admin, ni el corte ni sus partes', async () => {
    await assertSucceeds(guardar('ic_admin', ID(80), 5));
    for (const u of ['ic_admin', 'ic_admin2']) {
      await assertFails(updateDoc(doc(plano(u), 'odt_afinia_cortes', ID(80)), { responsable: 'OTRO RESPONSABLE' }));
      await assertFails(setDoc(doc(plano(u), 'odt_afinia_cortes', ID(80)), corteDe(u, 5)));
      await assertFails(deleteDoc(doc(plano(u), 'odt_afinia_cortes', ID(80))));
      await assertFails(updateDoc(doc(plano(u), 'odt_afinia_cortes', ID(80), 'partes', '0'), { odts: [] }));
      await assertFails(setDoc(doc(plano(u), 'odt_afinia_cortes', ID(80), 'partes', '0'), partesDe(5)[0][1]));
      await assertFails(deleteDoc(doc(plano(u), 'odt_afinia_cortes', ID(80), 'partes', '0')));
    }
    assert.equal((await leer('odt_afinia_cortes/' + ID(80))).responsable, 'RESPONSABLE FICTICIO DE PRUEBA');
  });
});

describe('lectura — solo administradores con perfil', () => {
  test('el admin lee el corte, sus partes y el historial (limit ≤ 50 / ≤ 60); los demás no', async () => {
    await assertSucceeds(guardar('ic_admin', ID(90), 5));
    await assertSucceeds(getDoc(doc(plano('ic_admin2'), 'odt_afinia_cortes', ID(90))));
    await assertSucceeds(getDoc(doc(plano('ic_admin'), 'odt_afinia_cortes', ID(90), 'partes', '0')));
    await assertSucceeds(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes'), orderBy('creadoEn', 'desc'), limit(50))));
    await assertSucceeds(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes', ID(90), 'partes'), limit(60))));
    await assertFails(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes'), limit(51))));
    await assertFails(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes'))));
    await assertFails(getDocs(query(collection(plano('ic_admin'), 'odt_afinia_cortes', ID(90), 'partes'), limit(61))));
    for (const u of ['ic_tecnico', 'ic_visit', 'ic_inact', 'ic_arranque']) {
      await assertFails(getDoc(doc(plano(u), 'odt_afinia_cortes', ID(90))));
      await assertFails(getDoc(doc(plano(u), 'odt_afinia_cortes', ID(90), 'partes', '0')));
      await assertFails(getDocs(query(collection(plano(u), 'odt_afinia_cortes'), limit(10))));
    }
    await assertFails(getDoc(doc(anon(), 'odt_afinia_cortes', ID(90))));
  });
});

describe('el REPOSITORIO de la página contra las reglas (lo que hacen «Guardar corte» y la vista)', () => {
  const RESP = 'RESPONSABLE FICTICIO DEL REPOSITORIO';
  // La sesión dice «admin» en todos (la página no muestra la pestaña a los demás; aquí se prueba que la REGLA los frena).
  const repoDe = (uid) => crearRepositorioCortes({ sdk: SDK, db: plano(uid), sesion: () => ({ uid, nombre: nombreDe(uid), esAdmin: true, legacy: false }) });
  const analisisDe = (n) => ({ responsable: RESP, odts: odtsDe(n), filasResponsable: n + 3, ...agregar(odtsDe(n)) });
  const archivoDe = (sello, hex) => ({ nombre: 'INFORME_ODT_' + sello + '_prueba.csv', bytes: 4321, sha256: hex });
  const NROS_SGM = ['91000001', '91000002', '91000003'];
  let viejo; let nuevo;

  test('guardar (como la página): entra el lote real de 3 partes; el técnico no', async () => {
    const repo = repoDe('ic_admin');
    viejo = await repo.guardar({ archivo: archivoDe('20260301080000', 'c1'.repeat(32)), lectura: { filas: 2000, odtsArchivo: 1500 }, analisis: analisisDe(803) });
    nuevo = await repo.guardar({ archivo: archivoDe('20260401080000', 'c2'.repeat(32)), lectura: { filas: 2000, odtsArchivo: 1500 }, analisis: analisisDe(810) });
    assert.equal(viejo.estado, 'entro');
    assert.equal(nuevo.estado, 'entro');
    await assert.rejects(repoDe('ic_tecnico').guardar({ archivo: archivoDe('20260402080000', 'c3'.repeat(32)), lectura: { filas: 2000, odtsArchivo: 1500 }, analisis: analisisDe(5) }),
      (e) => e.codigo === 'sin_permiso');
  });
  test('listar, leer (con sus partes), anterior, ultimoDe y porHuella: el admin sí; técnico, visitante, inactivo y arranque no', async () => {
    const repo = repoDe('ic_admin2');
    const h = await repo.listar();
    assert.ok(h.cortes.some((c) => c.id === nuevo.id) && h.cortes.some((c) => c.id === viejo.id));
    const l = await repo.leer(nuevo.id);
    assert.equal(l.completo, true);
    assert.equal(l.odts.length, 810);
    assert.equal(l.corte.fechaDatos, '2026-04-01T08:00:00');
    assert.equal((await repo.anterior(l.corte)).anterior.id, viejo.id);
    assert.equal((await repo.anterior((await repo.leer(viejo.id)).corte)).anterior, null);
    assert.equal((await repo.ultimoDe(RESP)).id, nuevo.id);
    assert.deepEqual((await repo.porHuella('c1'.repeat(32))).map((c) => c.id), [viejo.id]);
    assert.equal((await repo.listar({ antesDe: h.cortes[0] })).cortes.every((c) => c.id !== h.cortes[0].id), true);
    for (const u of ['ic_tecnico', 'ic_visit', 'ic_inact', 'ic_arranque']) {
      const r = repoDe(u);
      const niega = (e) => e.codigo === 'sin_permiso';
      await assert.rejects(r.listar(), niega, u + ' listar');
      await assert.rejects(r.leer(nuevo.id), niega, u + ' leer');
      await assert.rejects(r.anterior(l.corte), niega, u + ' anterior');
      await assert.rejects(r.ultimoDe(RESP), niega, u + ' ultimoDe');
      await assert.rejects(r.porHuella('c1'.repeat(32)), niega, u + ' porHuella');
    }
  });
  test('estadoSgm (solo lectura de la firma y de «Por subsanar», por N.º): el admin sí; el técnico no', async () => {
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', 'icsgmodt000000000001'), { nro: NROS_SGM[0], estado: 'LISTA', lectores: [] });
      await setDoc(doc(d, 'odt_afinia', 'icsgmodt000000000002'), { nro: NROS_SGM[1], estado: 'ANULADA', lectores: [] });
      await setDoc(doc(d, 'odt_afinia_obs', 'icsgmobs000000000001'), { nro: NROS_SGM[1], estado: 'ABIERTA', lectores: [] });
    });
    const r = await repoDe('ic_admin').estadoSgm([...NROS_SGM, '91000004']);
    assert.equal(r.mapa.get(NROS_SGM[0]).clave, 'lista');
    assert.equal(r.mapa.get(NROS_SGM[1]).clave, 'subsanar');
    assert.equal(r.mapa.has(NROS_SGM[2]), false);
    assert.equal(r.consultados.length, 4);
    await assert.rejects(repoDe('ic_tecnico').estadoSgm(NROS_SGM), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(repoDe('ic_visit').estadoSgm(NROS_SGM), (e) => e.codigo === 'sin_permiso');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRESUPUESTO: Firestore evalúa ≤ 1000 expresiones por documento escrito. Se mide con RELLENO: n términos `1 == 1`.
// 1) Calibración: cuántos caben solos en una regla vacía (≈ 196 en el emulador de hoy).
// 2) Con las reglas del repo + 30 % de ese relleno al final de odtIndCorte y de odtIndParte, el corte de forma real
//    (3 partes) DEBE entrar: la regla gasta ≤ 70 % del tope. 3) Control: con el relleno entero, NO entra (el
//    relleno de verdad cuenta). Si alguien agrega revisiones caras al bloque, esta prueba lo avisa.
// ═════════════════════════════════════════════════════════════════════════════
describe('presupuesto — un corte de forma real entra dejando ≥ 30 % del tope de 1000 expresiones', () => {
  const U = '1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1';
  const FUNCIONES = '    function icPadU() { return ' + U + '; }\n    function icPadV() { return ' + Array(10).fill('icPadU()').join(' && ') + '; }\n';
  const relleno = (n) => [...Array(Math.floor(n / 100)).fill('icPadV()'), ...Array(Math.floor((n % 100) / 10)).fill('icPadU()'), ...Array(n % 10).fill('1 == 1')].join(' && ') || 'true';
  let nProyecto = 0;
  async function lote(reglas, n, { crear } = {}) {
    const env = await initializeTestEnvironment({ projectId: 'demo-sgm-presupuesto-' + (++nProyecto), firestore: { rules: reglas, host: '127.0.0.1', port: 8080 } });
    try {
      await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'usuarios', 'ic_admin'), { email: P.ic_admin.email, rol: 'admin', activo: true, nombre: P.ic_admin.nombre }));
      const d = env.authenticatedContext('ic_admin').firestore();
      if (crear) { const b = writeBatch(d); b.set(doc(d, 'cal', 'x'), { a: 1 }); await b.commit(); return 'entra'; }
      await guardar('ic_admin', ID(200 + nProyecto), n, { db: d });
      return 'entra';
    } catch (e) {
      return /1000 expressions/.test(String(e && e.message)) ? 'tope' : 'niega: ' + String(e && e.message).slice(0, 200);
    } finally { await env.cleanup(); }
  }
  const vacia = (n) => "rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n" + FUNCIONES
    + '    function icPad() { return ' + relleno(n) + '; }\n    match /cal/{id} { allow create: if icPad(); }\n} }';
  function conRelleno(nCorte, nParte) {
    const fin = "existsAfter(odtIndRutaParte(id, string(d.nPartes - 1)));";
    const finParte = '&& odtIndOdt(d.odts[0]);';
    const ancla = '    function odtIndRuta(id)';
    for (const a of [fin, finParte, ancla]) assert.equal(REGLAS.split(a).length, 2, 'el ancla «' + a + '» cambió: ajuste esta prueba');
    return REGLAS.replace(fin, fin.slice(0, -1) + ' && ' + relleno(nCorte) + ';')
      .replace(finParte, finParte.slice(0, -1) + ' && ' + relleno(nParte) + ';')
      .replace(ancla, FUNCIONES + ancla);
  }
  test('calibrado: con ≥ 30 % de relleno en el corte y en cada parte, el lote real (3 partes) entra; con el relleno entero, no', async () => {
    let lo = 50; let hi = 400;                     // lo entra, hi no
    assert.equal(await lote(vacia(lo), 0, { crear: true }), 'entra');
    assert.equal(await lote(vacia(hi), 0, { crear: true }), 'tope');
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (await lote(vacia(m), 0, { crear: true }) === 'entra') lo = m; else hi = m; }
    const cap = lo;
    const margen = Math.ceil(cap * 0.3);
    assert.equal(await lote(conRelleno(0, 0), 897), 'entra');
    assert.equal(await lote(conRelleno(margen, margen), 897), 'entra', 'la regla ya no deja 30 % libre (caben ' + cap + ' términos solos)');
    assert.equal(await lote(conRelleno(cap, 0), 897), 'tope', 'control: el relleno entero en el corte pasa el tope');
    assert.equal(await lote(conRelleno(0, cap), 897), 'tope', 'control: el relleno entero en la parte pasa el tope');
  });
});
