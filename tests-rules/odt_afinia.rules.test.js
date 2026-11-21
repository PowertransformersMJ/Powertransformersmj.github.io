// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia (diseño W-11 del 2026-11-20, tras comité ×3), reglas en el emulador.
//   · odt_afinia_firmantes/{uid}: habilitación; la crea SOLO el propio uid, recién autenticado con contraseña
//     (auth_time ≤ 5 min), con el correo verificado y el acuerdo exacto; nadie la edita ni la borra.
//   · odt_afinia/{id}: publica un admin con perfil (lote odt + partes + candado del N.º); AZT ≠ Responsable,
//     AZT ≠ quien publica, los dos habilitados y activos; estados PENDIENTE_AZT → PENDIENTE_RESPONSABLE → LISTA
//     o ANULADA. Partes con sha256 == huellasPartes[n], la 0 con %PDF-, número exacto, solo en el lote.
//   · actos/{rol}: firmar = crear el acto + avanzar el estado en el MISMO lote (atado en las dos direcciones),
//     con la imagen de firmas/{uid} del propio firmante (bytes y sha256), subida después de habilitarse.
//   · odt_afinia_nro/{nro}, odt_afinia_descargas, devoluciones; lectura solo de sus dos firmantes y del admin.
//   · Revisión del 20-11: lista blanca odt_afinia_config/firmantes (solo consola), paliativo D5 (la sesión que firma
//     se abrió después de publicar; la del Responsable, además, después del acto del AZT), nombre/correo del acto =
//     los publicados, huella de «Mi firma» = la de sus bytes, días inexistentes, devolución «rol_rev», D6 (una LISTA
//     no se anula) y las negativas con su control que pidió la lente de seguridad.
//   · Decisiones del 2026-11-21: actos nuevos con compositor 'odt-afinia@2'; el Responsable cierra con la FECHA
//     PREVISTA (cierre.fecha == o.fechaTrabajo, real y no posterior a hoy en Bogotá) y escribe su pie completo
//     (cierre.generada == N.º: el acto de un armador viejo de la caché no lo trae y se niega, L-102); REEMPLAZAR una LISTA (solo admin,
//     con motivo) y registrar su CIERRE EN AFINIA (solo admin, fecha y soporte); los dos son finales; candado
//     reasignable tras ANULADA o REEMPLAZADA, con `reemplaza` = la anterior; descarga en LISTA y CERRADA.
// Cada caso en las DOS direcciones (L-73/L-78): lo que se niega tiene su control que pasa. Un lote = una
// conexión. Carga máxima (L-110): 5 partes de 900 KB y una firma de 900 KB. Prefijo `oa_`; nunca
// clearFirestore(). Datos INVENTADOS: ningún uid, correo, nombre ni N.º de ODT real; los PDF se arman en memoria.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, where, orderBy, limit, writeBatch,
  serverTimestamp, Bytes, Timestamp
} from 'firebase/firestore';

let testEnv;

/* ── personas inventadas ─────────────────────────────────────────────────────── */
const P = {
  oa_admin: { rol: 'admin', nombre: 'Admin Publica Prueba', email: 'admin.publica@prueba.test' },
  oa_resp: { rol: 'admin', nombre: 'Responsable Prueba', email: 'responsable@prueba.test' },
  oa_azt: { rol: 'tecnico', nombre: 'Azt Prueba Uno', email: 'azt.uno@prueba.test' },
  oa_azt2: { rol: 'tecnico', nombre: 'Azt Prueba Dos', email: 'azt.dos@prueba.test' },
  oa_azt3: { rol: 'tecnico', nombre: 'Azt Prueba Tres', email: 'azt.tres@prueba.test' },
  oa_aztB: { rol: 'tecnico', nombre: 'Azt Prueba Otra', email: 'azt.otra@prueba.test' },
  oa_aztMax: { rol: 'tecnico', nombre: 'Azt Prueba Maxima', email: 'azt.maxima@prueba.test' },
  oa_doble: { rol: 'tecnico', nombre: 'Doble Prueba', email: 'doble@prueba.test' },
  oa_azt4: { rol: 'tecnico', nombre: 'Azt Prueba Cuatro', email: 'azt.cuatro@prueba.test' },   // se desactiva al firmar
  oa_azt5: { rol: 'tecnico', nombre: 'Azt Prueba Cinco', email: 'azt.cinco@prueba.test' },     // se renombra al firmar
  oa_azt6: { rol: 'tecnico', nombre: 'Azt Prueba Seis', email: 'azt.seis@prueba.test' },       // huella guardada falsa
  oa_fuera: { rol: 'tecnico', nombre: 'Fuera De Lista', email: 'fuera.lista@prueba.test' },    // habilitado, NO en la lista blanca
  oa_h3: { rol: 'tecnico', nombre: 'Habilita Prueba Tres', email: 'habilita.tres@prueba.test' },
  oa_tercero: { rol: 'tecnico', nombre: 'Tercero Prueba', email: 'tercero@prueba.test' },
  oa_visit: { rol: 'visitante', nombre: 'Visitante Prueba', email: 'visitante@prueba.test' },
  oa_inact: { rol: 'tecnico', nombre: 'Inactivo Prueba', email: 'inactivo@prueba.test', activo: false },
  oa_adminInact: { rol: 'admin', nombre: 'Admin Inactivo Prueba', email: 'admin.inactivo@prueba.test', activo: false },
  // Habilitación: el perfil de h1 trae el correo con mayúsculas (el token de Auth lo trae en minúsculas).
  oa_h1: { rol: 'tecnico', nombre: 'Habilita Prueba Uno', email: 'Habilita.Uno@Prueba.Test' },
  oa_h2: { rol: 'tecnico', nombre: 'Habilita Prueba Dos', email: 'habilita.dos@prueba.test' },
  oa_hsin: { rol: 'tecnico', email: 'habilita.sin@prueba.test' },                       // perfil sin nombre
  oa_hvis: { rol: 'visitante', nombre: 'Habilita Visitante', email: 'habilita.vis@prueba.test' },
  oa_hinact: { rol: 'tecnico', nombre: 'Habilita Inactivo', email: 'habilita.inact@prueba.test', activo: false }
};
const NOMBRE = (u) => (P[u] && P[u].nombre) || '';
const CORREO = (u) => (P[u] ? P[u].email : u + '@prueba.test').toLowerCase();
const HABILITADOS = ['oa_admin', 'oa_resp', 'oa_azt', 'oa_azt2', 'oa_azt3', 'oa_aztB', 'oa_aztMax', 'oa_doble', 'oa_visit', 'oa_inact',
  'oa_azt4', 'oa_azt5', 'oa_azt6', 'oa_fuera'];
// Lista blanca por rol (en producción la llena el Ingeniero por la consola). oa_tercero, oa_inact y oa_visit están
// en ella a propósito: así sus negativas prueban la habilitación y el perfil, no la lista. oa_fuera NO está.
const CONFIG = {
  azt: ['oa_azt', 'oa_azt2', 'oa_azt3', 'oa_azt4', 'oa_azt5', 'oa_azt6', 'oa_aztB', 'oa_aztMax', 'oa_doble', 'oa_resp',
    'oa_tercero', 'oa_inact', 'oa_visit'],
  responsable: ['oa_resp', 'oa_admin', 'oa_doble', 'oa_tercero']
};

/* ── textos v1 (BORRADOR del Ingeniero), escritos aquí aparte de las reglas: deben coincidir carácter a carácter ── */
const ACUERDO = (n, c) => `Yo, ${n}, con mi cuenta personal ${c}, acepto firmar electrónicamente las ODT de Afinia en SGM. Mi firma solo se estampa desde mi propia cuenta y con mi contraseña personal, que no comparto.`;
const DECL_AZT = (n, c, nro) => `Yo, ${n}, con mi cuenta personal ${c}, declaro que revisé las dos páginas de la ODT N.º ${nro} y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.`;
const DECL_RESP = (n, c, nro, f) => `Yo, ${n}, con mi cuenta personal ${c}, declaro que revisé las dos páginas de la ODT N.º ${nro}, verifiqué la firma del AZT y, como RESPONSABLE O.D.T., la firmo y la cierro con fecha ${f}. Esta firma equivale a mi firma manuscrita.`;

/* ── tiempo: fechas de Bogotá (UTC-5) relativas a hoy, y auth_time en segundos ───── */
const ahoraS = () => Math.floor(Date.now() / 1000);
function fechaBogota(dias) {
  const t = new Date(Date.now() - 5 * 3600e3 + dias * 86400e3);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
}
const HOY = fechaBogota(0);
const TRABAJO = fechaBogota(-10);
// Con microsegundos (L-129): los sellos sembrados no son milisegundos redondos.
const haceMs = (ms) => { const t = Date.now() - ms; return new Timestamp(Math.floor(t / 1000), (t % 1000) * 1e6 + 367123); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const msDe = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
/**
 * auth_time (s) de una sesión abierta DESPUÉS de los instantes dados (paliativo D5): si hace falta, espera al
 * siguiente segundo entero. Nunca devuelve un auth_time futuro (un token real no lo trae).
 */
async function sesionTras(...instantesMs) {
  const tope = Math.max(0, ...instantesMs.filter((x) => x != null));
  const falta = (Math.floor(tope / 1000) + 1) * 1000 - Date.now();
  if (falta > 0) await espera(falta + 30);
  return ahoraS();
}

/* ── bytes sintéticos ───────────────────────────────────────────────────────── */
const sha = (u) => createHash('sha256').update(u).digest('hex');
const by = (u) => Bytes.fromUint8Array(u);
/** Una «parte» de PDF inventada: la 0 empieza por %PDF-1.7; las demás, relleno. */
function parte(i, n = 2000) {
  const u = new Uint8Array(n).fill(0x41 + i);
  if (i === 0) u.set([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]);
  return u;
}
/** Una «firma PNG» inventada por persona (los bytes solo tienen que ser suyos). */
function png(semilla, n = 600) { const u = new Uint8Array(n).fill(semilla); u.set([0x89, 0x50, 0x4E, 0x47]); return u; }
const FIRMA = {
  oa_admin: png(11), oa_resp: png(12), oa_azt: png(13), oa_azt2: png(14), oa_azt3: png(15), oa_aztB: png(16),
  oa_aztMax: png(17, 900 * 1024), oa_doble: png(18), oa_azt4: png(19), oa_azt5: png(20), oa_azt6: png(21), oa_fuera: png(22)
};
const FIRMA_NUEVA_AZT2 = png(24);

/* ── contextos ──────────────────────────────────────────────────────────────── */
/** Sesión recién reautenticada con contraseña y correo verificado (lo que pide firmar y habilitarse). */
const ctx = (uid, claims = {}) => testEnv.authenticatedContext(uid, {
  email: CORREO(uid), email_verified: true, auth_time: ahoraS() - 5, firebase: { sign_in_provider: 'password' }, ...claims
}).firestore();
/** Sesión normal, sin reautenticar (publicar NO lo exige: D4). */
const plano = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
async function leer(ruta) {
  let v; await testEnv.withSecurityRulesDisabled(async (c) => { v = (await getDoc(doc(c.firestore(), ruta))).data(); }); return v;
}
async function sembrar(fn) { await testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }

/* ── ODT: ids de 20 caracteres, meta y lote de publicación ───────────────────── */
const ID = (k) => 'oaodt' + String(k).padStart(15, '0');
const NRO = (k) => String(k).padStart(8, '0');
const ZONAS = { azt: { x: 225.22, y: 190.5, w: 159.45, h: 34.5 }, responsable: { x: 81.2, y: 190.5, w: 121.02, h: 34.5 },
  si: { x: 224.94, y: 156.2 }, fecha: { x: 316, y: 156.2 } };
const FIRMANTE = (u) => ({ uid: u, nombre: NOMBRE(u), correo: CORREO(u) });
function metaOdt(pub, nro, partes, { azt = 'oa_azt', resp = 'oa_resp', ...extra } = {}) {
  const todo = Buffer.concat(partes.map((p) => Buffer.from(p)));
  return {
    nro, consignacion: 'C-PRUEBA-0001', subestacion: 'S/E Prueba Norte', equipo: 'TX Prueba 1', fechaTrabajo: TRABAJO,
    firmantes: { azt: FIRMANTE(azt), responsable: FIRMANTE(resp) }, lectores: [azt, resp],
    estado: 'PENDIENTE_AZT', rev: 0,
    huella: sha(todo), bytes: todo.length, partes: partes.length, huellasPartes: partes.map(sha), zonas: ZONAS,
    publicadoPor: { uid: pub, nombre: P[pub] ? (P[pub].nombre || '') : '' }, publicadoEn: serverTimestamp(), ...extra
  };
}
/**
 * Lo que escribe la página al publicar: odt + sus partes + el candado del N.º, en UN lote.
 * `escribir`: pares [n, bytes] que se escriben como partes (por defecto, todas las de `partes`).
 */
function publicar(pub, id, nro, { partes = [parte(0)], m, escribir, candado, azt, resp, mas, reemplaza } = {}) {
  const d = plano(pub); const b = writeBatch(d);
  b.set(doc(d, 'odt_afinia', id), m || metaOdt(pub, nro, partes, { azt, resp, ...(reemplaza ? { reemplaza } : {}) }));
  for (const [n, u] of (escribir || partes.map((u, i) => [i, u]))) b.set(doc(d, 'odt_afinia', id, 'partes', String(n)), { datos: by(u) });
  if (candado !== null) b.set(doc(d, 'odt_afinia_nro', nro), candado || { odtId: id });
  if (mas) mas(b, d);
  return b.commit();
}

/* ── firmar: acto + cambio de estado, en UN lote ─────────────────────────────── */
function actoDe(uid, rol, o, at, extra = {}) {
  const n = NOMBRE(uid); const c = CORREO(uid);
  const base = {
    rol, uid, correo: c, correoVerificado: true, proveedor: 'password', authTime: at, nombre: n, nro: o.nro,
    imagen: by(FIRMA[uid] || png(99)), huellaImagen: sha(FIRMA[uid] || png(99)), huellaBase: o.huella, huellaVista: 'e'.repeat(64),
    compositor: 'odt-afinia@2', en: serverTimestamp()
  };
  // El Responsable cierra con la FECHA PREVISTA de la orden (2026-11-21) y su pie completo lleva el N.º de
  // «ODT GENERADA N°» (cierre.generada == o.nro; un armador viejo de la caché no lo escribe, L-102).
  if (rol === 'azt') Object.assign(base, { declaracionVersion: 'odt-azt-v1', declaracion: DECL_AZT(n, c, o.nro) });
  else Object.assign(base, { declaracionVersion: 'odt-resp-v1', cierre: { si: true, fecha: o.fechaTrabajo, generada: o.nro }, declaracion: DECL_RESP(n, c, o.nro, o.fechaTrabajo) });
  return { ...base, ...extra };
}
async function firmar(uid, id, rol, { claims = {}, acto = {}, quitar = [], cambio, sinActo = false, sinCambio = false } = {}) {
  const o = await leer('odt_afinia/' + id);
  // Por defecto, una sesión abierta después de publicar y (Responsable) después del acto del AZT: así cada negativa
  // falla por SU causa y no por el paliativo D5, que tiene sus propias pruebas.
  let at = claims.auth_time;
  if (at === undefined) {
    const azt = rol === 'responsable' ? await leer('odt_afinia/' + id + '/actos/azt') : null;
    at = await sesionTras(msDe(o && o.publicadoEn), msDe(azt && azt.en));
  }
  const d = ctx(uid, { ...claims, auth_time: at }); const b = writeBatch(d);
  const a = actoDe(uid, rol, o, at, typeof acto === 'function' ? acto(o, at) : acto);
  for (const k of quitar) delete a[k];
  if (!sinActo) b.set(doc(d, 'odt_afinia', id, 'actos', rol), a);
  if (!sinCambio) b.update(doc(d, 'odt_afinia', id), cambio || { estado: rol === 'azt' ? 'PENDIENTE_RESPONSABLE' : 'LISTA', rev: o.rev + 1 });
  return b.commit();
}

/* ── habilitarse ────────────────────────────────────────────────────────────── */
function habilitacion(uid, at, extra = {}) {
  return {
    uid, correo: CORREO(uid), correoVerificado: true, proveedor: 'password', authTime: at,
    acuerdoVersion: 'odt-acuerdo-v1', acuerdo: ACUERDO(NOMBRE(uid), CORREO(uid)), nombre: NOMBRE(uid), en: serverTimestamp(), ...extra
  };
}
function habilitar(uid, { claims = {}, h = {}, como = uid } = {}) {
  const at = claims.auth_time ?? (ahoraS() - 5);
  return setDoc(doc(ctx(como, { ...claims, auth_time: at }), 'odt_afinia_firmantes', uid), habilitacion(uid, at, h));
}
const anular = (uid, id, rev, extra = {}) => updateDoc(doc(plano(uid), 'odt_afinia', id), {
  estado: 'ANULADA', rev, anulacion: { motivo: 'Publicada con un error de prueba', por: { uid, nombre: NOMBRE(uid) }, en: serverTimestamp() }, ...extra
});
/** Reemplazar una LISTA (2026-11-21): {estado, rev, reemplazo{motivo, por, en}}. */
const reemplazar = (uid, id, rev, extra = {}) => updateDoc(doc(plano(uid), 'odt_afinia', id), {
  estado: 'REEMPLAZADA', rev, reemplazo: { motivo: 'La consignación del PDF de prueba no era la correcta', por: { uid, nombre: NOMBRE(uid) }, en: serverTimestamp() }, ...extra
});
const SOPORTE = 'SOPORTE_ODT_PRUEBA_01';
/** Registrar el cierre en Afinia de una LISTA (2026-11-21): {estado, rev, cierreAfinia{fecha, soporte, por, en}}. */
const cerrar = (uid, id, rev, { fecha = HOY, soporte = SOPORTE, ...extra } = {}) => updateDoc(doc(plano(uid), 'odt_afinia', id), {
  estado: 'CERRADA', rev, cierreAfinia: { fecha, soporte, por: { uid, nombre: NOMBRE(uid) }, en: serverTimestamp() }, ...extra
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(P)) {
      const perfil = { email: p.email, rol: p.rol, activo: p.activo ?? true };
      if (p.nombre) perfil.nombre = p.nombre;
      await setDoc(doc(d, 'usuarios', uid), perfil);
    }
    await setDoc(doc(d, 'admins', 'oa_arranque'), { email: 'arranque@prueba.test' });   // admin de arranque SIN perfil
    await setDoc(doc(d, 'odt_afinia_config', 'firmantes'), CONFIG);
    for (const uid of HABILITADOS) {
      await setDoc(doc(d, 'odt_afinia_firmantes', uid), {
        uid, correo: CORREO(uid), correoVerificado: true, proveedor: 'password', authTime: ahoraS() - 7200,
        acuerdoVersion: 'odt-acuerdo-v1', acuerdo: ACUERDO(NOMBRE(uid), CORREO(uid)), nombre: NOMBRE(uid), en: haceMs(2 * 3600e3)
      });
    }
    // «Mi firma» subida DESPUÉS de habilitarse; la de azt2 es ANTERIOR; azt3 no tiene.
    for (const uid of ['oa_admin', 'oa_resp', 'oa_azt', 'oa_aztB', 'oa_aztMax', 'oa_doble', 'oa_azt4', 'oa_azt5', 'oa_fuera']) {
      await setDoc(doc(d, 'firmas', uid), { imagen: by(FIRMA[uid]), huella: sha(FIRMA[uid]), en: haceMs(3600e3) });
    }
    // azt6: «Mi firma» con una huella guardada que NO es la de sus bytes (la regla de firmas solo mira la forma).
    await setDoc(doc(d, 'firmas', 'oa_azt6'), { imagen: by(FIRMA.oa_azt6), huella: 'f'.repeat(64), en: haceMs(3600e3) });
    await setDoc(doc(d, 'firmas', 'oa_azt2'), { imagen: by(FIRMA.oa_azt2), huella: sha(FIRMA.oa_azt2), en: haceMs(3 * 3600e3) });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

// ═════════════════════════════════════════════════════════════════════════════
describe('habilitación — solo el propio uid, una vez, recién autenticado y con el acuerdo exacto', () => {
  test('se habilita (perfil con mayúsculas en el correo); no la reescribe ni la borra nadie; la leen él y el admin', async () => {
    await assertSucceeds(habilitar('oa_h1'));
    await assertFails(habilitar('oa_h1'));                                                   // update: false
    await assertFails(deleteDoc(doc(ctx('oa_h1'), 'odt_afinia_firmantes', 'oa_h1')));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia_firmantes', 'oa_h1')));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia_firmantes', 'oa_h1'), { nombre: 'Otro' }));
    await assertSucceeds(getDoc(doc(ctx('oa_h1'), 'odt_afinia_firmantes', 'oa_h1')));
    await assertSucceeds(getDoc(doc(plano('oa_admin'), 'odt_afinia_firmantes', 'oa_h1')));
    await assertFails(getDoc(doc(plano('oa_tercero'), 'odt_afinia_firmantes', 'oa_h1')));
    await assertSucceeds(getDocs(query(collection(plano('oa_admin'), 'odt_afinia_firmantes'), limit(50))));
    await assertFails(getDocs(query(collection(plano('oa_admin'), 'odt_afinia_firmantes'), limit(51))));
    await assertFails(getDocs(query(collection(plano('oa_tercero'), 'odt_afinia_firmantes'), limit(5))));
  });

  test('el admin no habilita a otro, ni con el correo del otro en su token', async () => {
    await assertFails(habilitar('oa_h2', { como: 'oa_admin' }));
    await assertFails(habilitar('oa_h2', { como: 'oa_admin', claims: { email: CORREO('oa_h2') } }));
  });

  test('acuerdo distinto por UN carácter, otra versión, o nombre distinto del perfil → no', async () => {
    const a = ACUERDO(NOMBRE('oa_h2'), CORREO('oa_h2'));
    await assertFails(habilitar('oa_h2', { h: { acuerdo: a.replace('SGM.', 'SGM,') } }));
    await assertFails(habilitar('oa_h2', { h: { acuerdo: a + ' ' } }));
    await assertFails(habilitar('oa_h2', { h: { acuerdo: a + '\u200b' } }));   // un espacio invisible al final
    await assertFails(habilitar('oa_h2', { h: { acuerdoVersion: 'odt-acuerdo-v2' } }));
    await assertFails(habilitar('oa_h2', { h: { nombre: 'Nombre Cambiado', acuerdo: ACUERDO('Nombre Cambiado', CORREO('oa_h2')) } }));
  });

  test('reautenticación: auth_time de hace más de 5 min, sin correo verificado, otro proveedor o authTime distinto → no; reciente → sí', async () => {
    await assertFails(habilitar('oa_h2', { claims: { auth_time: ahoraS() - 301 } }));
    await assertFails(habilitar('oa_h2', { claims: { email_verified: false } }));
    await assertFails(habilitar('oa_h2', { claims: { firebase: { sign_in_provider: 'custom' } } }));
    await assertFails(habilitar('oa_h2', { claims: { firebase: { sign_in_provider: 'google.com' } } }));
    const at = ahoraS() - 5;
    await assertFails(setDoc(doc(ctx('oa_h2', { auth_time: at }), 'odt_afinia_firmantes', 'oa_h2'), habilitacion('oa_h2', at - 1)));
    // Correo: el del acto ≠ token, o el token ≠ perfil.
    const otro = 'otra.cuenta@prueba.test';
    await assertFails(habilitar('oa_h2', { h: { correo: otro, acuerdo: ACUERDO(NOMBRE('oa_h2'), otro) } }));
    await assertFails(habilitar('oa_h2', { claims: { email: otro }, h: { correo: otro, acuerdo: ACUERDO(NOMBRE('oa_h2'), otro) } }));
    // Forma: sello del cliente, campo de más, correoVerificado falso.
    await assertFails(habilitar('oa_h2', { h: { en: Timestamp.now() } }));
    await assertFails(habilitar('oa_h2', { h: { extra: 1 } }));
    await assertFails(habilitar('oa_h2', { h: { correoVerificado: false } }));
    // Control: recién autenticado (4 min) con todo exacto, pasa.
    await assertSucceeds(habilitar('oa_h2', { claims: { auth_time: ahoraS() - 240 } }));
  });

  test('perfil sin nombre, visitante, desactivado o sin sesión → no', async () => {
    await assertFails(habilitar('oa_hsin', { h: { nombre: '', acuerdo: ACUERDO('', CORREO('oa_hsin')) } }));
    await assertFails(habilitar('oa_hsin', { h: { nombre: 'Inventado Ahora', acuerdo: ACUERDO('Inventado Ahora', CORREO('oa_hsin')) } }));
    await assertFails(habilitar('oa_hvis'));
    await assertFails(habilitar('oa_hinact'));
    await assertFails(setDoc(doc(anon(), 'odt_afinia_firmantes', 'oa_h2b'), habilitacion('oa_h2', ahoraS())));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('publicar — admin con perfil; separación de funciones; firmantes habilitados y activos', () => {
  test('el Responsable (admin) publica odt + parte + candado sin reautenticar; un admin que no firma también', async () => {
    await assertSucceeds(publicar('oa_resp', ID(1), NRO(1)));
    await assertSucceeds(publicar('oa_admin', ID(2), NRO(2), { azt: 'oa_aztB', resp: 'oa_resp' }));
    const o = await leer('odt_afinia/' + ID(1));
    assert.equal(o.estado, 'PENDIENTE_AZT'); assert.equal(o.rev, 0);
    assert.deepEqual(await leer('odt_afinia_nro/' + NRO(1)), { odtId: ID(1) });
  });

  test('el AZT nunca es quien publica, ni el mismo uid que el Responsable', async () => {
    await assertFails(publicar('oa_resp', ID(101), NRO(101), { azt: 'oa_resp', resp: 'oa_admin' }));
    await assertFails(publicar('oa_admin', ID(102), NRO(102), { azt: 'oa_admin', resp: 'oa_resp' }));
    await assertFails(publicar('oa_admin', ID(103), NRO(103), { azt: 'oa_azt', resp: 'oa_azt' }));
    // Control con los mismos uid en el orden permitido: el admin publica con AZT ≠ él.
    await assertSucceeds(publicar('oa_admin', ID(104), NRO(104), { azt: 'oa_resp', resp: 'oa_admin' }));
  });

  test('firmante sin habilitación, desactivado o visitante (aunque esté habilitado) → no', async () => {
    await assertFails(publicar('oa_resp', ID(105), NRO(105), { azt: 'oa_tercero' }));
    await assertFails(publicar('oa_admin', ID(106), NRO(106), { resp: 'oa_tercero' }));
    await assertFails(publicar('oa_resp', ID(107), NRO(107), { azt: 'oa_inact' }));
    await assertFails(publicar('oa_resp', ID(108), NRO(108), { azt: 'oa_visit' }));
  });

  test('nombre o correo distintos de su habilitación → no (ni cambiando /usuarios en el mismo lote)', async () => {
    const pt = [parte(0)];
    const conAzt = (azt) => metaOdt('oa_resp', NRO(109), pt, { firmantes: { azt, responsable: FIRMANTE('oa_resp') } });
    await assertFails(publicar('oa_resp', ID(109), NRO(109), { m: conAzt({ ...FIRMANTE('oa_azt'), nombre: 'Nombre Suplantado' }) }));
    await assertFails(publicar('oa_resp', ID(109), NRO(109), { m: conAzt({ ...FIRMANTE('oa_azt'), correo: 'buzon.ajeno@prueba.test' }) }));
    await assertFails(publicar('oa_resp', ID(109), NRO(109), {
      m: conAzt({ ...FIRMANTE('oa_azt'), nombre: 'Nombre Suplantado' }),
      mas: (b, d) => b.update(doc(d, 'usuarios', 'oa_azt'), { nombre: 'Nombre Suplantado' })
    }));
    await assertFails(publicar('oa_resp', ID(109), NRO(109), { m: conAzt({ ...FIRMANTE('oa_azt'), cargo: 'x' }) }));
    assert.equal((await leer('usuarios/oa_azt')).nombre, NOMBRE('oa_azt'));
  });

  test('lectores, estado, rev, sello, N.º, zonas y forma: solo lo exacto pasa', async () => {
    const pt = [parte(0)];
    const m = (extra) => metaOdt('oa_resp', NRO(110), pt, extra);
    for (const extra of [
      { lectores: ['oa_resp', 'oa_azt'] }, { lectores: ['oa_azt', 'oa_resp', 'oa_tercero'] },
      { estado: 'LISTA' }, { estado: 'PENDIENTE_RESPONSABLE' }, { rev: 1 },
      { anulacion: { motivo: 'no corresponde aquí', por: { uid: 'oa_resp', nombre: NOMBRE('oa_resp') }, en: serverTimestamp() } },
      { publicadoPor: { uid: 'oa_admin', nombre: NOMBRE('oa_admin') } }, { publicadoEn: Timestamp.now() },
      { fechaTrabajo: '2026-11-01' }, { zonas: { ...ZONAS, si: undefined } }, { zonas: { ...ZONAS, azt: { x: 1, y: 1, w: 2 } } },
      { zonas: { ...ZONAS, azt: { x: 1, y: 1, w: 2, alto: 3 } } }, { zonas: { ...ZONAS, otra: { x: 1, y: 1 } } },
      { extra: true }, { subestacion: '' }
    ]) {
      const meta = m(extra); if (meta.zonas && meta.zonas.si === undefined) delete meta.zonas.si;
      await assertFails(publicar('oa_resp', ID(110), NRO(110), { m: meta }), JSON.stringify(extra).slice(0, 60));
    }
    await assertFails(publicar('oa_resp', ID(111), '1234567'));
    await assertFails(publicar('oa_resp', ID(111), 'ABCDEFGH'));
    await assertFails(publicar('oa_resp', 'corto', NRO(111)));
    await assertSucceeds(publicar('oa_resp', ID(110), NRO(110)));          // control: lo exacto pasa
  });

  test('quién publica: técnico, admin de arranque sin perfil, admin desactivado, visitante, sin sesión → no', async () => {
    for (const u of ['oa_azt', 'oa_arranque', 'oa_adminInact', 'oa_visit']) {
      await assertFails(publicar(u, ID(112), NRO(112), { azt: 'oa_aztB', resp: 'oa_resp' }), u);
    }
    const d = anon(); const b = writeBatch(d);
    b.set(doc(d, 'odt_afinia', ID(112)), metaOdt('oa_admin', NRO(112), [parte(0)], { azt: 'oa_aztB' }));
    await assertFails(b.commit());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('partes — sha256 == huellasPartes[n], %PDF- en la 0, número exacto, solo en el lote, inmutables', () => {
  test('huella de una parte que no es la de sus bytes; huella total ≠ la de la única parte; tamaño de huellasPartes', async () => {
    const p0 = parte(0);
    await assertFails(publicar('oa_resp', ID(120), NRO(120), { m: metaOdt('oa_resp', NRO(120), [p0], { huellasPartes: [sha(parte(1))], huella: sha(parte(1)) }) }));
    await assertFails(publicar('oa_resp', ID(120), NRO(120), { m: metaOdt('oa_resp', NRO(120), [p0], { huella: 'c'.repeat(64) }) }));
    await assertFails(publicar('oa_resp', ID(120), NRO(120), { m: metaOdt('oa_resp', NRO(120), [p0], { huellasPartes: [sha(p0), sha(p0)] }) }));
  });

  test('la parte 0 sin cabecera %PDF- → no (aunque su huella sea la correcta)', async () => {
    const noPdf = new Uint8Array(2000).fill(0x41);
    await assertFails(publicar('oa_resp', ID(121), NRO(121), { partes: [noPdf] }));
    const casi = parte(0); casi[4] = 0x20;   // «%PDF » sin el guion
    await assertFails(publicar('oa_resp', ID(121), NRO(121), { partes: [casi] }));
  });

  test('número exacto: partes=1 con una parte/1 de más; partes=2 con una sola; o sin la 0 → no; 2 de 2 → sí', async () => {
    const [p0, p1] = [parte(0), parte(1)];
    await assertFails(publicar('oa_resp', ID(122), NRO(122), { partes: [p0], escribir: [[0, p0], [1, p1]] }));
    await assertFails(publicar('oa_resp', ID(122), NRO(122), { m: metaOdt('oa_resp', NRO(122), [p0], { partes: 1 }), escribir: [[0, p0], [1, p0]] }));
    await assertFails(publicar('oa_resp', ID(122), NRO(122), { partes: [p0, p1], escribir: [[0, p0]] }));
    await assertFails(publicar('oa_resp', ID(122), NRO(122), { partes: [p0, p1], escribir: [[1, p1]] }));
    await assertFails(publicar('oa_resp', ID(122), NRO(122), { partes: [p0, p1], escribir: [] }));
    await assertSucceeds(publicar('oa_resp', ID(3), NRO(3), { partes: [p0, p1] }));
  });

  test('una parte después del lote de publicación, o update/delete de una parte → no', async () => {
    const d = plano('oa_resp');
    await assertFails(setDoc(doc(d, 'odt_afinia', ID(3), 'partes', '1'), { datos: by(parte(1)) }));   // ya existe: update
    await assertFails(setDoc(doc(d, 'odt_afinia', ID(3), 'partes', '2'), { datos: by(parte(2)) }));   // nueva: fuera del lote
    await assertFails(deleteDoc(doc(d, 'odt_afinia', ID(3), 'partes', '0')));
    await assertFails(updateDoc(doc(d, 'odt_afinia', ID(3), 'partes', '0'), { datos: by(parte(0, 10)) }));
  });

  test('parte de más de 900 KB, 6 partes, campo de más en la parte → no', async () => {
    const grande = parte(0, 900 * 1024 + 1);
    await assertFails(publicar('oa_resp', ID(123), NRO(123), { partes: [grande] }));
    const seis = [0, 1, 2, 3, 4, 5].map((i) => parte(i, 50));
    await assertFails(publicar('oa_resp', ID(123), NRO(123), { partes: seis }));
    const d = plano('oa_resp'); const b = writeBatch(d);
    b.set(doc(d, 'odt_afinia', ID(123)), metaOdt('oa_resp', NRO(123), [parte(0)]));
    b.set(doc(d, 'odt_afinia', ID(123), 'partes', '0'), { datos: by(parte(0)), lote: 'x' });
    b.set(doc(d, 'odt_afinia_nro', NRO(123)), { odtId: ID(123) });
    await assertFails(b.commit());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('candado del N.º — nace con la ODT, en el mismo lote, y no se repite mientras la vigente no esté ANULADA', () => {
  test('sin candado, candado de otra ODT, o el mismo N.º con la vigente pendiente → no', async () => {
    await assertFails(publicar('oa_resp', ID(130), NRO(130), { candado: null }));
    await assertFails(publicar('oa_resp', ID(130), NRO(130), { candado: { odtId: ID(999) } }));
    await assertFails(publicar('oa_resp', ID(130), NRO(130), { candado: { odtId: ID(130), extra: 1 } }));
    await assertFails(publicar('oa_admin', ID(131), NRO(1), { azt: 'oa_aztB' }));   // NRO(1) vigente (PENDIENTE_AZT)
  });

  test('un candado suelto (sin crear su ODT), borrarlo o reasignarlo a mano → no; lo lee solo el admin', async () => {
    const d = plano('oa_resp');
    await assertFails(setDoc(doc(d, 'odt_afinia_nro', NRO(132)), { odtId: ID(1) }));
    await assertFails(setDoc(doc(d, 'odt_afinia_nro', NRO(1)), { odtId: ID(2) }));
    await assertFails(deleteDoc(doc(d, 'odt_afinia_nro', NRO(1))));
    await assertSucceeds(getDoc(doc(d, 'odt_afinia_nro', NRO(1))));
    await assertFails(getDoc(doc(plano('oa_azt'), 'odt_afinia_nro', NRO(1))));
    await assertFails(getDocs(query(collection(d, 'odt_afinia_nro'), limit(5))));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('firmar como AZT — su imagen, su credencial reciente, su turno, atado al estado', () => {
  test('el admin custodio no crea actos/azt: ni a nombre del AZT con la imagen de él, ni a su propio nombre', async () => {
    await assertFails(firmar('oa_resp', ID(1), 'azt', { acto: { uid: 'oa_azt', imagen: by(FIRMA.oa_azt), huellaImagen: sha(FIRMA.oa_azt) } }));
    await assertFails(firmar('oa_resp', ID(1), 'azt'));
    await assertFails(firmar('oa_admin', ID(1), 'azt'));
    await assertFails(firmar('oa_tercero', ID(1), 'azt', { acto: { imagen: by(FIRMA.oa_azt), huellaImagen: sha(FIRMA.oa_azt) } }));
  });

  test('el Responsable no firma antes que el AZT', async () => {
    await assertFails(firmar('oa_resp', ID(1), 'responsable'));
  });

  test('imagen con 1 byte cambiado, o huella que no es la de los bytes → no', async () => {
    const otra = FIRMA.oa_azt.slice(); otra[100] ^= 1;
    await assertFails(firmar('oa_azt', ID(1), 'azt', { acto: { imagen: by(otra), huellaImagen: sha(otra) } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { acto: { huellaImagen: sha(otra) } }));
  });

  test('reautenticación: auth_time de hace más de 5 min, sin correo verificado, otro proveedor, authTime ≠ token → no', async () => {
    await assertFails(firmar('oa_azt', ID(1), 'azt', { claims: { auth_time: ahoraS() - 301 } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { claims: { email_verified: false } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { claims: { firebase: { sign_in_provider: 'custom' } } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { acto: (o, at) => ({ authTime: at - 1 }) }));
  });

  test('correo: el del acto ≠ el del token, o el del token ≠ el del perfil → no', async () => {
    const otro = 'otra.cuenta@prueba.test';
    await assertFails(firmar('oa_azt', ID(1), 'azt', { acto: (o) => ({ correo: otro, declaracion: DECL_AZT(NOMBRE('oa_azt'), otro, o.nro) }) }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { claims: { email: otro }, acto: (o) => ({ correo: otro, declaracion: DECL_AZT(NOMBRE('oa_azt'), otro, o.nro) }) }));
  });

  test('declaración distinta por UN carácter, otra versión, N.º, nombre, huella base, compositor o forma → no', async () => {
    const decl = (o) => DECL_AZT(NOMBRE('oa_azt'), CORREO('oa_azt'), o.nro);
    for (const acto of [
      (o) => ({ declaracion: decl(o).replace('N.º', 'N.°') }),                   // º → ° (se ven iguales)
      (o) => ({ declaracion: decl(o).slice(0, -1) }),
      () => ({ declaracionVersion: 'odt-resp-v1' }),
      () => ({ nro: NRO(2), declaracion: DECL_AZT(NOMBRE('oa_azt'), CORREO('oa_azt'), NRO(2)) }),
      (o) => ({ nombre: 'Otro Nombre', declaracion: DECL_AZT('Otro Nombre', CORREO('oa_azt'), o.nro) }),
      () => ({ huellaBase: 'd'.repeat(64) }), () => ({ huellaVista: 'no-hex' }),
      () => ({ compositor: 'odt-afinia@1' }), () => ({ compositor: 'odt-afinia@3' }),          // 2026-11-21: solo @2
      () => ({ rol: 'responsable' }), () => ({ correoVerificado: false }), () => ({ proveedor: 'custom' }),
      () => ({ cierre: { si: true, fecha: HOY } }), () => ({ en: Timestamp.now() }), () => ({ uid: 'oa_aztB' })
    ]) {
      await assertFails(firmar('oa_azt', ID(1), 'azt', { acto }), String(acto));
    }
  });

  test('atadura del lote en las dos direcciones: acto sin cambio, cambio sin acto, estado o rev equivocados → no', async () => {
    await assertFails(firmar('oa_azt', ID(1), 'azt', { sinCambio: true }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { sinActo: true }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { cambio: { estado: 'LISTA', rev: 1 } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { cambio: { estado: 'PENDIENTE_RESPONSABLE', rev: 2 } }));
    await assertFails(firmar('oa_azt', ID(1), 'azt', { cambio: { estado: 'PENDIENTE_RESPONSABLE', rev: 1, lectores: ['oa_azt', 'oa_tercero'] } }));
    await assertFails(firmar('oa_azt', ID(1), 'responsable'));                                 // rol ajeno
  });

  test('sin firmas/{uid} → no; tras subir «Mi firma» él mismo → sí', async () => {
    await assertSucceeds(publicar('oa_resp', ID(4), NRO(4), { azt: 'oa_azt3' }));
    await assertFails(firmar('oa_azt3', ID(4), 'azt'));
    await assertSucceeds(setDoc(doc(ctx('oa_azt3'), 'firmas', 'oa_azt3'), { imagen: by(FIRMA.oa_azt3), huella: sha(FIRMA.oa_azt3), en: serverTimestamp() }));
    await assertSucceeds(firmar('oa_azt3', ID(4), 'azt'));
  });

  test('«Mi firma» ANTERIOR a la habilitación → no; la vuelve a subir después → sí', async () => {
    await assertSucceeds(publicar('oa_resp', ID(5), NRO(5), { azt: 'oa_azt2' }));
    await assertFails(firmar('oa_azt2', ID(5), 'azt'));
    FIRMA.oa_azt2 = FIRMA_NUEVA_AZT2;
    await assertSucceeds(setDoc(doc(ctx('oa_azt2'), 'firmas', 'oa_azt2'), { imagen: by(FIRMA.oa_azt2), huella: sha(FIRMA.oa_azt2), en: serverTimestamp() }));
    await assertSucceeds(firmar('oa_azt2', ID(5), 'azt'));
  });

  test('con todo exacto el AZT firma (sesión abierta después de publicar); no firma dos veces ni en otro estado', async () => {
    await assertSucceeds(firmar('oa_azt', ID(1), 'azt'));
    const o = await leer('odt_afinia/' + ID(1));
    assert.equal(o.estado, 'PENDIENTE_RESPONSABLE'); assert.equal(o.rev, 1);
    await assertFails(firmar('oa_azt', ID(1), 'azt'));                                          // set sobre acto existente
    await assertFails(firmar('oa_azt', ID(1), 'azt', { cambio: { estado: 'LISTA', rev: 2 } }));
    await assertFails(updateDoc(doc(ctx('oa_azt'), 'odt_afinia', ID(1), 'actos', 'azt'), { huellaVista: 'f'.repeat(64) }));
    await assertFails(deleteDoc(doc(plano('oa_resp'), 'odt_afinia', ID(1), 'actos', 'azt')));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('firmar como Responsable — después del AZT, otra persona, cerrando con la FECHA PREVISTA de la orden', () => {
  test('fecha de cierre distinta de la prevista (hoy, antes o después), mal escrita, sin cierre, «SI» falso o declaración con otra fecha → no', async () => {
    const r = (fecha, extra = {}) => (o) => ({ cierre: { si: true, fecha, generada: o.nro }, declaracion: DECL_RESP(NOMBRE('oa_resp'), CORREO('oa_resp'), o.nro, fecha), ...extra });
    // 2026-11-21: la de HOY ya no sirve (antes pasaba): la FECHA CIERRE es la prevista (TRABAJO).
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r(HOY) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r(fechaBogota(-9)) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r(fechaBogota(2)) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r(fechaBogota(-11)) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r('31-12-2026') }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: r(TRABAJO.replace(/\//g, '-')) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { quitar: ['cierre'] }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ ...r(TRABAJO)(o), cierre: { si: false, fecha: TRABAJO, generada: o.nro } }) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ ...r(TRABAJO)(o), declaracion: DECL_RESP(NOMBRE('oa_resp'), CORREO('oa_resp'), o.nro, HOY) }) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: () => ({ declaracionVersion: 'odt-azt-v1' }) }));
    // Compositor: solo @2 (el @1 queda para los actos ya firmados, que no se vuelven a escribir).
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: () => ({ compositor: 'odt-afinia@1' }) }));
  });

  test('L-102 (caché mezclada): el acto que arma un odt_afinia_lotes.js VIEJO con el odt_afinia_rutas.js nuevo (@2, cierre sin «ODT GENERADA») → no', async () => {
    // Era el agujero: compositor @2 (del rutas nuevo), los mismos 17 campos y la fecha prevista, pero lo compuesto
    // por el preparar.js viejo era @1 (sin el N.º): la ODT quedaba LISTA y ya no se podía ver ni descargar.
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ cierre: { si: true, fecha: o.fechaTrabajo } }) }));
    // «ODT GENERADA» con otro N.º, como número o vacío → no.
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ cierre: { si: true, fecha: o.fechaTrabajo, generada: NRO(2) } }) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ cierre: { si: true, fecha: o.fechaTrabajo, generada: Number(o.nro) } }) }));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { acto: (o) => ({ cierre: { si: true, fecha: o.fechaTrabajo, generada: '' } }) }));
    // Control (la prueba «con todo exacto» de abajo): el mismo acto con cierre.generada == N.º de la ODT → sí.
  });

  test('la fecha prevista todavía no llega (es posterior a hoy en Bogotá) → no firma, aunque sea la prevista; llegada → sí', async () => {
    const manana = fechaBogota(1);
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', ID(45)), {
        ...metaOdt('oa_admin', NRO(45), [parte(0)], { azt: 'oa_azt', resp: 'oa_resp' }),
        fechaTrabajo: manana, estado: 'PENDIENTE_RESPONSABLE', rev: 1, publicadoEn: haceMs(120e3)
      });
      await setDoc(doc(d, 'odt_afinia', ID(45), 'actos', 'azt'), { uid: 'oa_azt', en: haceMs(60e3) });
    });
    await assertFails(firmar('oa_resp', ID(45), 'responsable'));                        // cierre = la prevista (mañana)
    await sembrar(async (d) => { await updateDoc(doc(d, 'odt_afinia', ID(45)), { fechaTrabajo: HOY }); });
    await assertSucceeds(firmar('oa_resp', ID(45), 'responsable'));                     // control: la prevista es hoy
  });

  test('el AZT no firma como Responsable; sin reautenticación reciente → no', async () => {
    await assertFails(firmar('oa_azt', ID(1), 'responsable'));
    await assertFails(firmar('oa_resp', ID(1), 'responsable', { claims: { auth_time: ahoraS() - 400 } }));
  });

  test('con todo exacto (compositor @2, cierre con la fecha prevista y «ODT GENERADA» = el N.º) el Responsable cierra → LISTA; después nadie firma', async () => {
    await assertSucceeds(firmar('oa_resp', ID(1), 'responsable'));
    const o = await leer('odt_afinia/' + ID(1));
    assert.equal(o.estado, 'LISTA'); assert.equal(o.rev, 2);
    const a = await leer('odt_afinia/' + ID(1) + '/actos/responsable');
    assert.deepEqual(a.cierre, { si: true, fecha: o.fechaTrabajo, generada: o.nro });
    assert.equal(a.compositor, 'odt-afinia@2');
    await assertFails(firmar('oa_resp', ID(1), 'responsable'));
    await assertFails(firmar('oa_azt', ID(1), 'azt'));
    // ODT 5 (ya firmada por el AZT): la prevista escrita a mano en el acto también pasa (mismo texto).
    await assertSucceeds(firmar('oa_resp', ID(5), 'responsable', {
      acto: (x) => ({ cierre: { si: true, fecha: TRABAJO, generada: x.nro }, declaracion: DECL_RESP(NOMBRE('oa_resp'), CORREO('oa_resp'), x.nro, TRABAJO) })
    }));
  });

  test('defensa en profundidad: si el acto del AZT es del mismo uid, el Responsable no firma; con otro uid, sí', async () => {
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', ID(6)), {
        ...metaOdt('oa_admin', NRO(6), [parte(0)], { azt: 'oa_doble', resp: 'oa_doble' }),
        estado: 'PENDIENTE_RESPONSABLE', rev: 1, publicadoEn: haceMs(120e3)
      });
      await setDoc(doc(d, 'odt_afinia', ID(6), 'actos', 'azt'), { uid: 'oa_doble', en: haceMs(60e3) });
    });
    await assertFails(firmar('oa_doble', ID(6), 'responsable'));
    await sembrar(async (d) => { await setDoc(doc(d, 'odt_afinia', ID(6), 'actos', 'azt'), { uid: 'oa_otro_uid', en: haceMs(60e3) }); });
    await assertSucceeds(firmar('oa_doble', ID(6), 'responsable'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('anular, inmutables y carrera — solo el admin, con motivo; ANULADA cierra todo', () => {
  test('inmutables: firmantes, lectores, N.º, huella, partes o publicadoPor no cambian (ni el admin ni el firmante)', async () => {
    await assertSucceeds(publicar('oa_admin', ID(7), NRO(7), { azt: 'oa_azt', resp: 'oa_resp' }));
    const d = plano('oa_admin');
    for (const cambio of [
      { firmantes: { azt: FIRMANTE('oa_aztB'), responsable: FIRMANTE('oa_resp') } }, { lectores: ['oa_azt', 'oa_resp', 'oa_admin'] },
      { nro: NRO(77) }, { huella: 'a'.repeat(64) }, { partes: 2 }, { publicadoPor: { uid: 'oa_resp', nombre: NOMBRE('oa_resp') } },
      { zonas: { ...ZONAS, fecha: { x: 1, y: 1 } } }, { fechaTrabajo: HOY }
    ]) {
      await assertFails(updateDoc(doc(d, 'odt_afinia', ID(7)), { ...cambio, rev: 1 }), JSON.stringify(cambio).slice(0, 40));
      await assertFails(updateDoc(doc(ctx('oa_azt'), 'odt_afinia', ID(7)), { ...cambio, rev: 1 }));
    }
    await assertFails(deleteDoc(doc(d, 'odt_afinia', ID(7))));
  });

  test('anular: técnico o firmante, sin motivo, motivo corto, «por» ajeno, sello del cliente, o tocando otro campo → no', async () => {
    await assertFails(anular('oa_azt', ID(7), 1));
    await assertFails(anular('oa_arranque', ID(7), 1));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(7)), { estado: 'ANULADA', rev: 1 }));
    await assertFails(anular('oa_admin', ID(7), 1, { anulacion: { motivo: 'muy corto', por: { uid: 'oa_admin', nombre: NOMBRE('oa_admin') }, en: serverTimestamp() } }));
    await assertFails(anular('oa_admin', ID(7), 1, { anulacion: { motivo: 'Motivo suficiente', por: { uid: 'oa_resp', nombre: NOMBRE('oa_resp') }, en: serverTimestamp() } }));
    await assertFails(anular('oa_admin', ID(7), 1, { anulacion: { motivo: 'Motivo suficiente', por: { uid: 'oa_admin', nombre: NOMBRE('oa_admin') }, en: Timestamp.now() } }));
    await assertFails(anular('oa_admin', ID(7), 1, { lectores: ['oa_azt'] }));
    await assertFails(anular('oa_admin', ID(7), 2));
  });

  test('carrera AZT / anulación con la misma rev de partida: solo pasa una; ANULADA no vuelve ni recibe firmas', async () => {
    await assertSucceeds(firmar('oa_azt', ID(7), 'azt'));                     // rev 0 → 1
    await assertFails(anular('oa_admin', ID(7), 1));                          // el admin con la rev vieja
    await assertSucceeds(anular('oa_admin', ID(7), 2));                       // desde PENDIENTE_RESPONSABLE
    await assertFails(firmar('oa_resp', ID(7), 'responsable'));
    await assertFails(anular('oa_admin', ID(7), 3));                          // ANULADA → ANULADA
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(7)), { estado: 'PENDIENTE_RESPONSABLE', rev: 3 }));
    // Al revés: anula primero; la firma del AZT con la rev vieja ya no entra.
    await assertSucceeds(publicar('oa_admin', ID(8), NRO(8), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertSucceeds(anular('oa_admin', ID(8), 1));
    await assertFails(firmar('oa_azt', ID(8), 'azt'));
    await assertFails(firmar('oa_azt', ID(8), 'azt', { cambio: { estado: 'PENDIENTE_RESPONSABLE', rev: 2 } }));
  });

  test('D6: una ODT LISTA no se anula (ni con todo exacto); desde PENDIENTE_AZT sí', async () => {
    await assertSucceeds(firmar('oa_resp', ID(4), 'responsable'));
    assert.equal((await leer('odt_afinia/' + ID(4))).estado, 'LISTA');
    await assertFails(anular('oa_resp', ID(4), 3));
    await assertFails(anular('oa_admin', ID(4), 3));
    assert.equal((await leer('odt_afinia/' + ID(4))).estado, 'LISTA');
    // Control: el mismo admin, desde PENDIENTE_AZT (ID 8 más abajo es la otra mitad, desde PENDIENTE_RESPONSABLE la ID 7).
    await assertSucceeds(publicar('oa_admin', ID(13), NRO(13), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertSucceeds(anular('oa_resp', ID(13), 1));
  });

  test('republicar el N.º de una ODT ANULADA reasigna el candado (con `reemplaza` = la anulada); con la nueva vigente, otra vez no', async () => {
    // 2026-11-21: la republicación dice a cuál reemplaza, y tiene que ser la del candado.
    await assertFails(publicar('oa_admin', ID(9), NRO(7), { azt: 'oa_azt', resp: 'oa_resp' }));                         // sin reemplaza
    await assertFails(publicar('oa_admin', ID(9), NRO(7), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(8) }));       // otra ODT
    await assertFails(publicar('oa_admin', ID(9), NRO(7), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: 'corto' }));     // id inválido
    await assertSucceeds(publicar('oa_admin', ID(9), NRO(7), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(7) }));
    assert.deepEqual(await leer('odt_afinia_nro/' + NRO(7)), { odtId: ID(9) });
    assert.equal((await leer('odt_afinia/' + ID(9))).reemplaza, ID(7));
    await assertFails(publicar('oa_admin', ID(10), NRO(7), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertFails(publicar('oa_admin', ID(10), NRO(7), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(9) }));    // vigente PENDIENTE_AZT
  });

  test('un N.º nuevo no lleva `reemplaza` (el candado es nuevo); sin él, sí', async () => {
    await assertFails(publicar('oa_admin', ID(46), NRO(46), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(7) }));
    await assertSucceeds(publicar('oa_admin', ID(46), NRO(46), { azt: 'oa_azt', resp: 'oa_resp' }));
    assert.equal((await leer('odt_afinia/' + ID(46))).reemplaza, undefined);
  });

  test('candado: con la vigente LISTA no se reasigna; reasignarlo al mismo odtId tampoco; con la vigente ANULADA, sí', async () => {
    await assertFails(publicar('oa_admin', ID(14), NRO(4), { azt: 'oa_azt', resp: 'oa_resp' }));                    // ID 4 está LISTA
    await assertFails(publicar('oa_admin', ID(14), NRO(4), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(4) }));  // ni diciendo a cuál
    await assertFails(setDoc(doc(plano('oa_admin'), 'odt_afinia_nro', NRO(13)), { odtId: ID(13) }));                 // mismo odtId (ANULADA)
    await assertSucceeds(publicar('oa_admin', ID(14), NRO(13), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(13) }));   // control: ID 13 ANULADA
    assert.deepEqual(await leer('odt_afinia_nro/' + NRO(13)), { odtId: ID(14) });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('leer — solo sus dos firmantes y el admin; list con array-contains y tope', () => {
  test('firmantes y admin leen odt, partes y actos', async () => {
    for (const u of ['oa_azt', 'oa_resp', 'oa_admin']) {
      const d = plano(u);
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(1))));
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(1), 'partes', '0')));
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(1), 'actos', 'azt')));
    }
  });

  test('un tercero del equipo, el visitante, el desactivado, el admin de arranque sin perfil y sin sesión → no', async () => {
    for (const d of [plano('oa_tercero'), plano('oa_visit'), plano('oa_inact'), plano('oa_arranque'), anon()]) {
      await assertFails(getDoc(doc(d, 'odt_afinia', ID(1))));
      await assertFails(getDoc(doc(d, 'odt_afinia', ID(1), 'partes', '0')));
      await assertFails(getDoc(doc(d, 'odt_afinia', ID(1), 'actos', 'azt')));
    }
  });

  test('el firmante de OTRA ODT no la lee; la suya, sí', async () => {
    await assertFails(getDoc(doc(plano('oa_aztB'), 'odt_afinia', ID(1))));
    await assertFails(getDoc(doc(plano('oa_aztB'), 'odt_afinia', ID(1), 'actos', 'azt')));
    await assertSucceeds(getDoc(doc(plano('oa_aztB'), 'odt_afinia', ID(2))));
  });

  test('list: con array-contains de su uid y limit ≤ 50 → sí; sin filtro, con otro uid, limit 51 o sin limit → no', async () => {
    const d = plano('oa_azt'); const c = collection(d, 'odt_afinia');
    const r = await assertSucceeds(getDocs(query(c, where('lectores', 'array-contains', 'oa_azt'), orderBy('publicadoEn', 'desc'), limit(50))));
    assert.ok(r.size >= 1);
    await assertFails(getDocs(query(c, limit(50))));
    await assertFails(getDocs(query(c, where('lectores', 'array-contains', 'oa_resp'), limit(50))));
    await assertFails(getDocs(query(c, where('lectores', 'array-contains', 'oa_azt'), limit(51))));
    await assertFails(getDocs(query(c, where('lectores', 'array-contains', 'oa_azt'))));
    // Un tercero con SU uid: la consulta pasa y no trae nada (no hay fuga).
    const t = await assertSucceeds(getDocs(query(collection(plano('oa_tercero'), 'odt_afinia'), where('lectores', 'array-contains', 'oa_tercero'), limit(50))));
    assert.equal(t.size, 0);
    await assertFails(getDocs(query(collection(plano('oa_tercero'), 'odt_afinia'), where('lectores', 'array-contains', 'oa_azt'), limit(50))));
    await assertFails(getDocs(query(collection(plano('oa_visit'), 'odt_afinia'), where('lectores', 'array-contains', 'oa_visit'), limit(50))));
    // El admin: con limit, sí; sin limit, no.
    await assertSucceeds(getDocs(query(collection(plano('oa_admin'), 'odt_afinia'), orderBy('publicadoEn', 'desc'), limit(50))));
    await assertFails(getDocs(collection(plano('oa_admin'), 'odt_afinia')));
  });

  test('partes: nadie lista; actos: lector con limit ≤ 2; tercero no', async () => {
    await assertFails(getDocs(query(collection(plano('oa_admin'), 'odt_afinia', ID(1), 'partes'), limit(5))));
    await assertFails(getDocs(query(collection(plano('oa_azt'), 'odt_afinia', ID(1), 'partes'), limit(5))));
    const a = await assertSucceeds(getDocs(query(collection(plano('oa_azt'), 'odt_afinia', ID(1), 'actos'), limit(2))));
    assert.equal(a.size, 2);
    await assertFails(getDocs(query(collection(plano('oa_azt'), 'odt_afinia', ID(1), 'actos'), limit(3))));
    await assertFails(getDocs(query(collection(plano('oa_tercero'), 'odt_afinia', ID(1), 'actos'), limit(2))));
  });

  test('ninguna otra colección odt_afinia_* se puede escribir (cerrado por defecto)', async () => {
    await assertFails(setDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'firmantes'), { azt: ['oa_azt'] }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('descargas y devoluciones', () => {
  const desc = (uid, odtId, extra = {}) => ({ odtId, uid, huella: 'a'.repeat(64), en: serverTimestamp(), ...extra });

  test('descarga: un lector de una ODT LISTA la registra; terceros, uid ajeno, ODT pendiente o huella inválida → no', async () => {
    const C = (u) => collection(plano(u), 'odt_afinia_descargas');
    await assertSucceeds(setDoc(doc(C('oa_azt'), 'oaDescarga0000000001'), desc('oa_azt', ID(1))));
    await assertSucceeds(setDoc(doc(C('oa_resp'), 'oaDescarga0000000002'), desc('oa_resp', ID(1))));
    await assertSucceeds(setDoc(doc(C('oa_admin'), 'oaDescarga0000000003'), desc('oa_admin', ID(1))));
    await assertFails(setDoc(doc(C('oa_tercero'), 'oaDescarga0000000004'), desc('oa_tercero', ID(1))));
    await assertFails(setDoc(doc(C('oa_azt'), 'oaDescarga0000000005'), desc('oa_resp', ID(1))));
    await assertFails(setDoc(doc(C('oa_aztB'), 'oaDescarga0000000006'), desc('oa_aztB', ID(2))));   // PENDIENTE_AZT
    await assertFails(setDoc(doc(C('oa_azt'), 'oaDescarga0000000007'), desc('oa_azt', ID(1), { huella: 'xyz' })));
    await assertFails(setDoc(doc(C('oa_azt'), 'oaDescarga0000000008'), desc('oa_azt', ID(1), { en: Timestamp.now() })));
    await assertFails(setDoc(doc(C('oa_azt'), 'oaDescarga0000000009'), desc('oa_azt', ID(1), { extra: 1 })));
  });

  test('descarga: la leen y listan solo los admin; nadie la cambia ni la borra', async () => {
    await assertFails(getDoc(doc(plano('oa_azt'), 'odt_afinia_descargas', 'oaDescarga0000000001')));
    await assertSucceeds(getDoc(doc(plano('oa_admin'), 'odt_afinia_descargas', 'oaDescarga0000000001')));
    await assertSucceeds(getDocs(query(collection(plano('oa_admin'), 'odt_afinia_descargas'), limit(50))));
    await assertFails(getDocs(query(collection(plano('oa_admin'), 'odt_afinia_descargas'), limit(51))));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia_descargas', 'oaDescarga0000000001'), { huella: 'b'.repeat(64) }));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia_descargas', 'oaDescarga0000000001')));
  });

  const dv = (uid, rol, extra = {}) => ({ uid, rol, motivo: 'La ODT trae un dato de prueba que no corresponde', en: serverTimestamp(), ...extra });

  test('devolución: el firmante en SU turno, con motivo, id «rol_rev»; el otro rol, un tercero o motivo corto → no; una por turno; inmutable', async () => {
    const C = (u) => collection(plano(u), 'odt_afinia', ID(2), 'devoluciones');   // ID 2: PENDIENTE_AZT, rev 0
    // Las negativas van con el id correcto, para que fallen por SU causa.
    await assertFails(setDoc(doc(C('oa_resp'), 'responsable_0'), dv('oa_resp', 'responsable')));   // no es su turno
    await assertFails(setDoc(doc(C('oa_resp'), 'azt_0'), dv('oa_resp', 'azt')));                   // rol ajeno
    await assertFails(setDoc(doc(C('oa_tercero'), 'azt_0'), dv('oa_tercero', 'azt')));
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt', { motivo: 'corto' })));
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt', { uid: 'oa_resp' })));
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt', { extra: 1 })));          // campo de más
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt', { en: Timestamp.now() })));   // sello del cliente
    // Id: automático, de otra rev o de otro rol → no.
    await assertFails(setDoc(doc(C('oa_aztB')), dv('oa_aztB', 'azt')));                             // id automático
    await assertFails(setDoc(doc(C('oa_aztB'), 'oaDevolucion00000001'), dv('oa_aztB', 'azt')));
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_1'), dv('oa_aztB', 'azt')));
    await assertFails(setDoc(doc(C('oa_aztB'), 'responsable_0'), dv('oa_aztB', 'azt')));
    // Control: todo exacto, pasa; la segunda del mismo turno es un update → no.
    await assertSucceeds(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt')));
    await assertFails(setDoc(doc(C('oa_aztB'), 'azt_0'), dv('oa_aztB', 'azt', { motivo: 'Segunda devolución del mismo turno' })));
    await assertFails(updateDoc(doc(C('oa_aztB'), 'azt_0'), { motivo: 'Cambio el motivo de la devolución' }));
    await assertFails(deleteDoc(doc(C('oa_admin'), 'azt_0')));
    await assertSucceeds(getDocs(query(C('oa_resp'), limit(20))));
    await assertFails(getDocs(query(C('oa_resp'), limit(21))));
    await assertFails(getDocs(query(C('oa_tercero'), limit(20))));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Revisión del 20-11 (lentes seg/cod/comp + decisiones D5 y D6 del Ingeniero). Cada negativa con su control.
// ═════════════════════════════════════════════════════════════════════════════
describe('lista blanca odt_afinia_config/firmantes — solo la consola la escribe; publicar exige el uid en la lista de SU rol', () => {
  test('la lee solo el admin con perfil; nadie la lista ni la escribe (ni el admin)', async () => {
    await assertSucceeds(getDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'firmantes')));
    for (const u of ['oa_azt', 'oa_tercero', 'oa_visit', 'oa_adminInact', 'oa_arranque']) {
      await assertFails(getDoc(doc(plano(u), 'odt_afinia_config', 'firmantes')), u);
    }
    await assertFails(getDocs(query(collection(plano('oa_admin'), 'odt_afinia_config'), limit(5))));
    await assertFails(setDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'firmantes'), { ...CONFIG, azt: [...CONFIG.azt, 'oa_fuera'] }));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'firmantes'), { azt: ['oa_fuera'] }));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'firmantes')));
    await assertFails(setDoc(doc(plano('oa_admin'), 'odt_afinia_config', 'otra'), { azt: ['oa_fuera'] }));
    assert.deepEqual(await leer('odt_afinia_config/firmantes'), CONFIG);
  });

  test('habilitado y activo pero FUERA de la lista → no publica (ni de AZT ni de Responsable); en la lista → sí', async () => {
    await assertFails(publicar('oa_admin', ID(30), NRO(30), { azt: 'oa_fuera', resp: 'oa_resp' }));
    await assertFails(publicar('oa_admin', ID(30), NRO(30), { azt: 'oa_azt', resp: 'oa_fuera' }));
    // Las listas son por rol: oa_azt2 está en la del AZT, no en la del Responsable.
    await assertFails(publicar('oa_admin', ID(30), NRO(30), { azt: 'oa_azt', resp: 'oa_azt2' }));
    // Control: el Ingeniero lo agrega por la consola (aquí, con las reglas apagadas) → publica.
    await sembrar(async (d) => { await setDoc(doc(d, 'odt_afinia_config', 'firmantes'), { ...CONFIG, azt: [...CONFIG.azt, 'oa_fuera'] }); });
    await assertSucceeds(publicar('oa_admin', ID(30), NRO(30), { azt: 'oa_fuera', resp: 'oa_resp' }));
    await sembrar(async (d) => { await setDoc(doc(d, 'odt_afinia_config', 'firmantes'), CONFIG); });
    await assertFails(publicar('oa_admin', ID(31), NRO(31), { azt: 'oa_fuera', resp: 'oa_resp' }));   // retirado → otra vez no
  });

  test('sin el documento de la lista blanca nadie publica; con él, sí', async () => {
    await sembrar(async (d) => { await deleteDoc(doc(d, 'odt_afinia_config', 'firmantes')); });
    await assertFails(publicar('oa_admin', ID(31), NRO(31), { azt: 'oa_azt', resp: 'oa_resp' }));
    await sembrar(async (d) => { await setDoc(doc(d, 'odt_afinia_config', 'firmantes'), CONFIG); });
    await assertSucceeds(publicar('oa_admin', ID(31), NRO(31), { azt: 'oa_azt', resp: 'oa_resp' }));
  });
});

describe('paliativo D5 — la sesión que firma se abrió DESPUÉS de publicar (y la del Responsable, después del acto del AZT)', () => {
  test('AZT con una sesión abierta antes de publicar (aunque tenga < 5 min) → no; abierta después → sí', async () => {
    await assertSucceeds(publicar('oa_admin', ID(32), NRO(32), { azt: 'oa_azt', resp: 'oa_resp' }));
    const pub = msDe((await leer('odt_afinia/' + ID(32))).publicadoEn);
    await assertFails(firmar('oa_azt', ID(32), 'azt', { claims: { auth_time: Math.floor(pub / 1000) - 1 } }));
    await assertFails(firmar('oa_azt', ID(32), 'azt', { claims: { auth_time: Math.floor(pub / 1000) } }));   // mismo segundo: no es «después»
    await assertSucceeds(firmar('oa_azt', ID(32), 'azt'));
  });

  test('Responsable: cierre con una clave de más → no; sesión posterior a publicar pero anterior al acto del AZT → no; posterior → sí', async () => {
    const o = await leer('odt_afinia/' + ID(32));
    const azt = await leer('odt_afinia/' + ID(32) + '/actos/azt');
    const entre = Math.floor(msDe(azt.en) / 1000);
    assert.ok(entre * 1000 > msDe(o.publicadoEn), 'la sesión «entre» debe ser posterior a publicar');
    await assertFails(firmar('oa_resp', ID(32), 'responsable', { acto: (x) => ({ cierre: { si: true, fecha: x.fechaTrabajo, generada: x.nro, hora: '10:00' } }) }));
    await assertFails(firmar('oa_resp', ID(32), 'responsable', { claims: { auth_time: entre } }));
    await assertSucceeds(firmar('oa_resp', ID(32), 'responsable'));
  });

  test('publicada hace 6 min: el AZT reautenticado hace 4 min firma (la ventana de 5 min sigue igual)', async () => {
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', ID(33)), { ...metaOdt('oa_admin', NRO(33), [parte(0)], { azt: 'oa_azt', resp: 'oa_resp' }), publicadoEn: haceMs(6 * 60e3) });
    });
    await assertFails(firmar('oa_azt', ID(33), 'azt', { claims: { auth_time: ahoraS() - 7 * 60 } }));   // antes de publicar (y vencida)
    await assertFails(firmar('oa_azt', ID(33), 'azt', { claims: { auth_time: ahoraS() - 301 } }));      // después, pero vencida
    await assertSucceeds(firmar('oa_azt', ID(33), 'azt', { claims: { auth_time: ahoraS() - 240 } }));
  });
});

describe('identidad del acto = la publicada; firmante activo AL FIRMAR; huella de «Mi firma»; token sin correo', () => {
  test('perfil renombrado después de publicar → no firma (ni con el nombre viejo ni con el nuevo); devuelto → sí', async () => {
    await assertSucceeds(publicar('oa_admin', ID(34), NRO(34), { azt: 'oa_azt5', resp: 'oa_resp' }));
    const nuevo = 'Nombre Cambiado Prueba';
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt5'), { nombre: nuevo }); });
    await assertFails(firmar('oa_azt5', ID(34), 'azt'));
    await assertFails(firmar('oa_azt5', ID(34), 'azt', { acto: (o) => ({ nombre: nuevo, declaracion: DECL_AZT(nuevo, CORREO('oa_azt5'), o.nro) }) }));
    // Correo: el del perfil y el del token cambian juntos; el publicado no → no.
    const otro = 'azt.cinco.nuevo@prueba.test';
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt5'), { nombre: NOMBRE('oa_azt5'), email: otro }); });
    await assertFails(firmar('oa_azt5', ID(34), 'azt', {
      claims: { email: otro }, acto: (o) => ({ correo: otro, declaracion: DECL_AZT(NOMBRE('oa_azt5'), otro, o.nro) })
    }));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt5'), { email: P.oa_azt5.email }); });
    await assertSucceeds(firmar('oa_azt5', ID(34), 'azt'));
  });

  test('firmante desactivado o visitante en el momento de firmar → no; reactivado → sí (AZT y Responsable)', async () => {
    await assertSucceeds(publicar('oa_admin', ID(35), NRO(35), { azt: 'oa_azt4', resp: 'oa_resp' }));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt4'), { activo: false }); });
    await assertFails(firmar('oa_azt4', ID(35), 'azt'));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt4'), { activo: true, rol: 'visitante' }); });
    await assertFails(firmar('oa_azt4', ID(35), 'azt'));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_azt4'), { rol: 'tecnico' }); });
    // Token sin correo (con todo lo demás exacto) → no; con correo → sí.
    await assertFails(firmar('oa_azt4', ID(35), 'azt', { claims: { email: undefined } }));
    await assertSucceeds(firmar('oa_azt4', ID(35), 'azt'));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_resp'), { activo: false }); });
    await assertFails(firmar('oa_resp', ID(35), 'responsable'));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_resp'), { activo: true, rol: 'visitante' }); });
    await assertFails(firmar('oa_resp', ID(35), 'responsable'));
    await sembrar(async (d) => { await updateDoc(doc(d, 'usuarios', 'oa_resp'), { rol: 'admin' }); });
    await assertSucceeds(firmar('oa_resp', ID(35), 'responsable'));
  });

  test('«Mi firma» con una huella guardada que no es la de sus bytes → no; la vuelve a subir bien → sí', async () => {
    await assertSucceeds(publicar('oa_admin', ID(36), NRO(36), { azt: 'oa_azt6', resp: 'oa_resp' }));
    await assertFails(firmar('oa_azt6', ID(36), 'azt'));
    await assertFails(firmar('oa_azt6', ID(36), 'azt', { acto: { huellaImagen: 'f'.repeat(64) } }));   // ni copiando la huella falsa
    await assertSucceeds(setDoc(doc(ctx('oa_azt6'), 'firmas', 'oa_azt6'), { imagen: by(FIRMA.oa_azt6), huella: sha(FIRMA.oa_azt6), en: serverTimestamp() }));
    await assertSucceeds(firmar('oa_azt6', ID(36), 'azt'));
  });

  test('habilitarse con un token sin correo → no; con correo → sí', async () => {
    await assertFails(habilitar('oa_h3', { claims: { email: undefined } }));
    await assertSucceeds(habilitar('oa_h3'));
  });
});

describe('fechas: días que no existen en el mes', () => {
  test('fechaTrabajo 31/02, 30/02 o 31/04 → no publica; 30/04, 29/02 y 31/12 → sí', async () => {
    const pt = [parte(0)];
    for (const f of ['31/02/2026', '30/02/2026', '31/04/2026', '31/06/2026', '31/09/2026', '31/11/2026']) {
      await assertFails(publicar('oa_admin', ID(37), NRO(37), { m: metaOdt('oa_admin', NRO(37), pt, { fechaTrabajo: f }) }), f);
    }
    await assertSucceeds(publicar('oa_admin', ID(37), NRO(37), { m: metaOdt('oa_admin', NRO(37), pt, { fechaTrabajo: '30/04/2026' }) }));
    await assertSucceeds(publicar('oa_admin', ID(38), NRO(38), { m: metaOdt('oa_admin', NRO(38), pt, { fechaTrabajo: '29/02/2028' }) }));
    await assertSucceeds(publicar('oa_admin', ID(39), NRO(39), { m: metaOdt('oa_admin', NRO(39), pt, { fechaTrabajo: '31/12/2026' }) }));
  });

  test('cierre del Responsable en un día inexistente → no, aunque sea la «prevista» (sembrada sin pasar por publicar); un día real → sí', async () => {
    const y = Number(HOY.slice(6)) - 1;   // el año pasado: todo su febrero y abril quedan antes de hoy
    // La fecha prevista se siembra con las reglas apagadas (publicar ya la niega): así la regla del acto sigue
    // exigiendo una fecha REAL (odtFecha) además de que sea la prevista.
    const sembrarCon = (fechaTrabajo) => sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', ID(40)), {
        ...metaOdt('oa_admin', NRO(40), [parte(0)], { azt: 'oa_azt', resp: 'oa_resp' }),
        fechaTrabajo, estado: 'PENDIENTE_RESPONSABLE', rev: 1, publicadoEn: haceMs(120e3)
      });
      await setDoc(doc(d, 'odt_afinia', ID(40), 'actos', 'azt'), { uid: 'oa_azt', en: haceMs(60e3) });
    });
    for (const f of [`31/02/${y}`, `30/02/${y}`, `31/04/${y}`]) {
      await sembrarCon(f);
      await assertFails(firmar('oa_resp', ID(40), 'responsable'), f);
    }
    await sembrarCon(`28/02/${y}`);
    await assertSucceeds(firmar('oa_resp', ID(40), 'responsable'));
  });
});

describe('publicar: bordes de la forma (lista BAJA de la lente seg), cada uno con su control', () => {
  test('bytes, partes, firmantes, consignación y equipo fuera de rango → no; en el borde → sí', async () => {
    const pt = [parte(0)];
    const m = (extra) => metaOdt('oa_admin', NRO(41), pt, extra);
    for (const extra of [
      { bytes: 0 }, { bytes: 900 * 1024 + 1 }, { bytes: '2000' },
      { partes: 0 }, { partes: 1.5 }, { partes: '1' },
      { firmantes: { azt: FIRMANTE('oa_azt'), responsable: FIRMANTE('oa_resp'), testigo: FIRMANTE('oa_aztB') } },
      { consignacion: 'C'.repeat(61) }, { equipo: '' }, { equipo: 'E'.repeat(121) }
    ]) {
      await assertFails(publicar('oa_admin', ID(41), NRO(41), { m: m(extra) }), JSON.stringify(extra).slice(0, 60));
    }
    await assertSucceeds(publicar('oa_admin', ID(41), NRO(41), {
      m: m({ bytes: 900 * 1024, consignacion: 'C'.repeat(60), equipo: 'E'.repeat(120) })
    }));
    await assertSucceeds(publicar('oa_admin', ID(42), NRO(42), { m: metaOdt('oa_admin', NRO(42), pt, { bytes: 1, consignacion: '', equipo: 'E' }) }));
  });
});

describe('anular, devolución y descarga: bordes con su control', () => {
  const dv = (uid, rol, extra = {}) => ({ uid, rol, motivo: 'La ODT trae un dato de prueba que no corresponde', en: serverTimestamp(), ...extra });
  const por = { uid: 'oa_admin', nombre: NOMBRE('oa_admin') };

  test('anular: una cuarta clave o un motivo de 501 → no; motivo de 500 exactos → sí', async () => {
    await assertSucceeds(publicar('oa_admin', ID(43), NRO(43), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertFails(anular('oa_admin', ID(43), 1, { anulacion: { motivo: 'Motivo suficiente', por, en: serverTimestamp(), nota: 'x' } }));
    await assertFails(anular('oa_admin', ID(43), 1, { anulacion: { motivo: 'M'.repeat(501), por, en: serverTimestamp() } }));
    await assertSucceeds(anular('oa_admin', ID(43), 1, { anulacion: { motivo: 'M'.repeat(500), por, en: serverTimestamp() } }));
  });

  test('devolución del Responsable en SU turno (id responsable_<rev>) → sí; con id de la rev vieja → no', async () => {
    await assertSucceeds(publicar('oa_admin', ID(44), NRO(44), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertSucceeds(firmar('oa_azt', ID(44), 'azt'));   // → PENDIENTE_RESPONSABLE, rev 1
    const C = collection(plano('oa_resp'), 'odt_afinia', ID(44), 'devoluciones');
    await assertFails(setDoc(doc(C, 'responsable_0'), dv('oa_resp', 'responsable')));
    await assertFails(setDoc(doc(collection(plano('oa_azt'), 'odt_afinia', ID(44), 'devoluciones'), 'azt_1'), dv('oa_azt', 'azt')));   // ya no es su turno
    await assertSucceeds(setDoc(doc(C, 'responsable_1'), dv('oa_resp', 'responsable')));
  });

  test('devolución con la ODT LISTA o ANULADA → no (con el id de su rev)', async () => {
    // ID 1: LISTA, rev 2. ID 43: ANULADA desde PENDIENTE_AZT, rev 1. ID 8: ANULADA, rev 1.
    await assertFails(setDoc(doc(collection(plano('oa_resp'), 'odt_afinia', ID(1), 'devoluciones'), 'responsable_2'), dv('oa_resp', 'responsable')));
    await assertFails(setDoc(doc(collection(plano('oa_azt'), 'odt_afinia', ID(43), 'devoluciones'), 'azt_1'), dv('oa_azt', 'azt')));
    await assertFails(setDoc(doc(collection(plano('oa_azt'), 'odt_afinia', ID(8), 'devoluciones'), 'azt_1'), dv('oa_azt', 'azt')));
  });

  test('descarga: ODT ANULADA o odtId inválido → no; la misma persona con una ODT LISTA → sí', async () => {
    const C = collection(plano('oa_azt'), 'odt_afinia_descargas');
    const desc = (odtId, extra = {}) => ({ odtId, uid: 'oa_azt', huella: 'a'.repeat(64), en: serverTimestamp(), ...extra });
    await assertFails(setDoc(doc(C, 'oaDescarga0000000010'), desc(ID(43))));    // ANULADA
    await assertFails(setDoc(doc(C, 'oaDescarga0000000011'), desc('corto')));
    await assertFails(setDoc(doc(C, 'oaDescarga0000000012'), desc(ID(1) + 'x')));
    await assertSucceeds(setDoc(doc(C, 'oaDescarga0000000013'), desc(ID(1))));   // LISTA
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Decisiones del Ingeniero del 2026-11-21: REEMPLAZAR una LISTA y registrar su CIERRE EN AFINIA. Cada negativa con
// su control que pasa (L-73/L-78).
// ═════════════════════════════════════════════════════════════════════════════
describe('reemplazar una ODT LISTA — solo el admin con perfil, con motivo; nada se borra; el N.º queda libre', () => {
  const por = (u) => ({ uid: u, nombre: NOMBRE(u) });
  const reemplazo = (u, extra = {}) => ({ motivo: 'La consignación del PDF de prueba no era la correcta', por: por(u), en: serverTimestamp(), ...extra });

  test('desde PENDIENTE_AZT o PENDIENTE_RESPONSABLE → no (eso se anula); técnico, tercero, admin sin perfil, inactivo o visitante → no', async () => {
    await assertSucceeds(publicar('oa_admin', ID(50), NRO(50), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertFails(reemplazar('oa_admin', ID(50), 1));                       // PENDIENTE_AZT
    await assertSucceeds(firmar('oa_azt', ID(50), 'azt'));
    await assertFails(reemplazar('oa_admin', ID(50), 2));                       // PENDIENTE_RESPONSABLE
    await assertSucceeds(firmar('oa_resp', ID(50), 'responsable'));             // → LISTA, rev 2
    assert.equal((await leer('odt_afinia/' + ID(50))).estado, 'LISTA');
    for (const u of ['oa_azt', 'oa_tercero', 'oa_arranque', 'oa_adminInact', 'oa_visit']) {
      await assertFails(reemplazar(u, ID(50), 3), u);
    }
    await assertFails(updateDoc(doc(anon(), 'odt_afinia', ID(50)), { estado: 'REEMPLAZADA', rev: 3, reemplazo: reemplazo('oa_admin') }));
  });

  test('forma: sin reemplazo, motivo corto o largo, «por» ajeno, sello del cliente, clave de más, otro campo, rev o estado equivocados → no', async () => {
    const d = plano('oa_admin');
    await assertFails(updateDoc(doc(d, 'odt_afinia', ID(50)), { estado: 'REEMPLAZADA', rev: 3 }));
    for (const extra of [
      { reemplazo: reemplazo('oa_admin', { motivo: 'muy corto' }) },
      { reemplazo: reemplazo('oa_admin', { motivo: 'M'.repeat(501) }) },
      { reemplazo: reemplazo('oa_admin', { por: por('oa_resp') }) },
      { reemplazo: reemplazo('oa_admin', { en: Timestamp.now() }) },
      { reemplazo: reemplazo('oa_admin', { nota: 'x' }) },
      { reemplazo: 'texto suelto' },
      { lectores: ['oa_azt', 'oa_resp', 'oa_admin'] }, { fechaTrabajo: HOY },
      { rev: 4 }, { rev: 2 },
      { estado: 'ANULADA' }, { estado: 'CERRADA' }, { estado: 'LISTA' }
    ]) {
      await assertFails(reemplazar('oa_admin', ID(50), 3, extra), JSON.stringify(extra).slice(0, 60));
    }
    assert.equal((await leer('odt_afinia/' + ID(50))).estado, 'LISTA');
    // Control: todo exacto (motivo de 500 caracteres justos) → REEMPLAZADA, rev 3.
    await assertSucceeds(reemplazar('oa_admin', ID(50), 3, { reemplazo: reemplazo('oa_admin', { motivo: 'M'.repeat(500) }) }));
    const o = await leer('odt_afinia/' + ID(50));
    assert.equal(o.estado, 'REEMPLAZADA'); assert.equal(o.rev, 3);
    assert.deepEqual(o.reemplazo.por, por('oa_admin'));
  });

  test('REEMPLAZADA es final: no se reemplaza otra vez, no se cierra, no se anula, no vuelve a LISTA ni recibe devoluciones', async () => {
    await assertFails(reemplazar('oa_admin', ID(50), 4));
    await assertFails(cerrar('oa_admin', ID(50), 4));
    await assertFails(anular('oa_admin', ID(50), 4));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(50)), { estado: 'LISTA', rev: 4 }));
    await assertFails(firmar('oa_resp', ID(50), 'responsable'));
    await assertFails(setDoc(doc(collection(plano('oa_resp'), 'odt_afinia', ID(50), 'devoluciones'), 'responsable_3'),
      { uid: 'oa_resp', rol: 'responsable', motivo: 'La ODT trae un dato de prueba que no corresponde', en: serverTimestamp() }));
  });

  test('nada se borra: sus firmantes y el admin siguen leyendo la ODT, sus partes y sus actos; nadie los borra ni los cambia', async () => {
    for (const u of ['oa_azt', 'oa_resp', 'oa_admin']) {
      const d = plano(u);
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(50))), u);
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(50), 'partes', '0')));
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(50), 'actos', 'azt')));
      await assertSucceeds(getDoc(doc(d, 'odt_afinia', ID(50), 'actos', 'responsable')));
    }
    await assertFails(getDoc(doc(plano('oa_tercero'), 'odt_afinia', ID(50))));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia', ID(50))));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia', ID(50), 'actos', 'responsable')));
    await assertFails(deleteDoc(doc(plano('oa_admin'), 'odt_afinia', ID(50), 'partes', '0')));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(50)), { reemplazo: reemplazo('oa_admin', { motivo: 'Otro motivo cambiado después' }) }));
  });

  test('candado reasignable tras REEMPLAZADA (con `reemplaza` = la reemplazada); la REEMPLAZADA no se descarga', async () => {
    await assertFails(publicar('oa_admin', ID(52), NRO(50), { azt: 'oa_azt', resp: 'oa_resp' }));                       // sin reemplaza
    await assertFails(publicar('oa_admin', ID(52), NRO(50), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(1) }));     // otra ODT
    await assertSucceeds(publicar('oa_admin', ID(52), NRO(50), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(50) }));
    assert.deepEqual(await leer('odt_afinia_nro/' + NRO(50)), { odtId: ID(52) });
    assert.equal((await leer('odt_afinia/' + ID(52))).reemplaza, ID(50));
    const C = (u) => collection(plano(u), 'odt_afinia_descargas');
    const desc = (u, odtId) => ({ odtId, uid: u, huella: 'a'.repeat(64), en: serverTimestamp() });
    await assertFails(setDoc(doc(C('oa_azt'), 'oaDescarga0000000020'), desc('oa_azt', ID(50))));
    await assertFails(setDoc(doc(C('oa_admin'), 'oaDescarga0000000021'), desc('oa_admin', ID(50))));
  });
});

describe('registrar el cierre en Afinia — solo el admin, solo desde LISTA; CERRADA es final y se sigue descargando', () => {
  const por = (u) => ({ uid: u, nombre: NOMBRE(u) });
  const cierreAfinia = (u, extra = {}) => ({ fecha: HOY, soporte: SOPORTE, por: por(u), en: serverTimestamp(), ...extra });

  test('desde PENDIENTE_* → no; técnico, tercero, admin sin perfil, inactivo o visitante → no', async () => {
    await assertSucceeds(publicar('oa_admin', ID(51), NRO(51), { azt: 'oa_azt', resp: 'oa_resp' }));
    await assertFails(cerrar('oa_admin', ID(51), 1));                            // PENDIENTE_AZT
    await assertSucceeds(firmar('oa_azt', ID(51), 'azt'));
    await assertFails(cerrar('oa_admin', ID(51), 2));                            // PENDIENTE_RESPONSABLE
    await assertSucceeds(firmar('oa_resp', ID(51), 'responsable'));              // → LISTA, rev 2
    for (const u of ['oa_azt', 'oa_tercero', 'oa_arranque', 'oa_adminInact', 'oa_visit']) {
      await assertFails(cerrar(u, ID(51), 3), u);
    }
  });

  test('fecha futura, anterior a la prevista, inexistente o mal escrita; soporte corto, largo o no texto; «por» ajeno; sello; claves → no', async () => {
    for (const extra of [
      { fecha: fechaBogota(1) }, { fecha: fechaBogota(-11) }, { fecha: '31/11/2026' }, { fecha: '31/02/2026' }, { fecha: '2026-11-15' },
      { soporte: 'ab' }, { soporte: 'S'.repeat(121) }, { soporte: 12345 }
    ]) {
      await assertFails(cerrar('oa_admin', ID(51), 3, extra), JSON.stringify(extra).slice(0, 60));
    }
    const d = plano('oa_admin');
    const u = (cambio) => updateDoc(doc(d, 'odt_afinia', ID(51)), { estado: 'CERRADA', rev: 3, cierreAfinia: cierreAfinia('oa_admin'), ...cambio });
    for (const cambio of [
      { cierreAfinia: cierreAfinia('oa_admin', { por: por('oa_resp') }) },
      { cierreAfinia: cierreAfinia('oa_admin', { en: Timestamp.now() }) },
      { cierreAfinia: cierreAfinia('oa_admin', { nota: 'x' }) },
      { cierreAfinia: { fecha: HOY, por: por('oa_admin'), en: serverTimestamp() } },   // sin soporte
      { lectores: ['oa_azt'] }, { rev: 4 }, { rev: 2 }, { estado: 'LISTA' }, { estado: 'REEMPLAZADA' }
    ]) {
      await assertFails(u(cambio), JSON.stringify(cambio).slice(0, 60));
    }
    await assertFails(updateDoc(doc(d, 'odt_afinia', ID(51)), { estado: 'CERRADA', rev: 3 }));
    assert.equal((await leer('odt_afinia/' + ID(51))).estado, 'LISTA');
  });

  test('con todo exacto (fecha de hoy) → CERRADA; es final: no se reemplaza, ni se anula, ni se cierra otra vez, ni se edita; su N.º no se republica', async () => {
    await assertSucceeds(cerrar('oa_admin', ID(51), 3));
    const o = await leer('odt_afinia/' + ID(51));
    assert.equal(o.estado, 'CERRADA'); assert.equal(o.rev, 3);
    assert.deepEqual({ fecha: o.cierreAfinia.fecha, soporte: o.cierreAfinia.soporte, por: o.cierreAfinia.por }, { fecha: HOY, soporte: SOPORTE, por: por('oa_admin') });
    await assertFails(reemplazar('oa_admin', ID(51), 4));
    await assertFails(anular('oa_admin', ID(51), 4));
    await assertFails(cerrar('oa_admin', ID(51), 4));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(51)), { estado: 'LISTA', rev: 4 }));
    await assertFails(updateDoc(doc(plano('oa_admin'), 'odt_afinia', ID(51)), { cierreAfinia: cierreAfinia('oa_admin', { soporte: 'OTRO_SOPORTE' }) }));
    await assertFails(publicar('oa_admin', ID(53), NRO(51), { azt: 'oa_azt', resp: 'oa_resp', reemplaza: ID(51) }));
    await assertFails(publicar('oa_admin', ID(53), NRO(51), { azt: 'oa_azt', resp: 'oa_resp' }));
  });

  test('descarga: de una CERRADA, sus firmantes y el admin sí; un tercero no', async () => {
    const C = (u) => collection(plano(u), 'odt_afinia_descargas');
    const desc = (u, odtId) => ({ odtId, uid: u, huella: 'a'.repeat(64), en: serverTimestamp() });
    await assertSucceeds(setDoc(doc(C('oa_azt'), 'oaDescarga0000000022'), desc('oa_azt', ID(51))));
    await assertSucceeds(setDoc(doc(C('oa_resp'), 'oaDescarga0000000023'), desc('oa_resp', ID(51))));
    await assertSucceeds(setDoc(doc(C('oa_admin'), 'oaDescarga0000000024'), desc('oa_admin', ID(51))));
    await assertFails(setDoc(doc(C('oa_tercero'), 'oaDescarga0000000025'), desc('oa_tercero', ID(51))));
  });

  test('borde: cierre con la fecha prevista exacta y un soporte de 120 caracteres → sí (ODT 4, LISTA)', async () => {
    const o = await leer('odt_afinia/' + ID(4));
    assert.equal(o.estado, 'LISTA');
    await assertFails(cerrar('oa_admin', ID(4), o.rev + 1, { fecha: fechaBogota(-11) }));        // un día antes de la prevista
    await assertSucceeds(cerrar('oa_admin', ID(4), o.rev + 1, { fecha: o.fechaTrabajo, soporte: 'S'.repeat(120) }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('carga máxima (L-110) — 5 partes de 900 KB y una firma de 900 KB', () => {
  test('publicar 5 × 900 KB, firmar el AZT con su imagen de 900 KB y cerrar el Responsable: pasa', async () => {
    const partes = [0, 1, 2, 3, 4].map((i) => parte(i, 900 * 1024));
    await assertSucceeds(publicar('oa_admin', ID(11), NRO(11), { partes, azt: 'oa_aztMax', resp: 'oa_resp' }));
    await assertSucceeds(getDoc(doc(plano('oa_aztMax'), 'odt_afinia', ID(11), 'partes', '4')));
    await assertSucceeds(firmar('oa_aztMax', ID(11), 'azt'));
    await assertSucceeds(firmar('oa_resp', ID(11), 'responsable'));
    assert.equal((await leer('odt_afinia/' + ID(11))).estado, 'LISTA');
  });

  test('el mismo lote con la parte 4 que no es la declarada, o sin la parte 3, no pasa', async () => {
    const partes = [0, 1, 2, 3, 4].map((i) => parte(i, 900 * 1024));
    const otra = parte(4, 900 * 1024); otra[0] ^= 1;
    await assertFails(publicar('oa_admin', ID(12), NRO(12), { partes, escribir: [[0, partes[0]], [1, partes[1]], [2, partes[2]], [3, partes[3]], [4, otra]], azt: 'oa_aztMax' }));
    await assertFails(publicar('oa_admin', ID(12), NRO(12), { partes, escribir: [[0, partes[0]], [1, partes[1]], [2, partes[2]], [4, partes[4]]], azt: 'oa_aztMax' }));
  });

  test('2026-11-21: reemplazar la LISTA de carga máxima y volver a publicar su N.º con 5 × 900 KB y `reemplaza` (candado reasignado): pasa', async () => {
    assert.equal((await leer('odt_afinia/' + ID(11))).estado, 'LISTA');
    await assertSucceeds(reemplazar('oa_admin', ID(11), 3));
    const partes = [0, 1, 2, 3, 4].map((i) => parte(i, 900 * 1024));
    // La regla más cara (17 campos + candado reasignado que compara `reemplaza`) cabe en el tope de expresiones.
    await assertSucceeds(publicar('oa_admin', ID(55), NRO(11), { partes, azt: 'oa_aztMax', resp: 'oa_resp', reemplaza: ID(11) }));
    assert.deepEqual(await leer('odt_afinia_nro/' + NRO(11)), { odtId: ID(55) });
    // Y se firma de punta a punta con la firma de 900 KB (compositor @2, cierre con la fecha prevista).
    await assertSucceeds(firmar('oa_aztMax', ID(55), 'azt'));
    await assertSucceeds(firmar('oa_resp', ID(55), 'responsable'));
    assert.equal((await leer('odt_afinia/' + ID(55))).estado, 'LISTA');
  });
});
