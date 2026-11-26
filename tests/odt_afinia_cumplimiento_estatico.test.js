// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE (99 §236) · revisión ESTÁTICA (lo que una prueba de ejecución no ve):
//   · el bloque de reglas «Cumplimiento del cierre · ODT Afinia»: va ANTES del de Indicadores (así las revisiones de ese
//     bloque no cambian), la configuración solo para admin con perfil y con la forma EXACTA del dominio (las mismas
//     claves y los MISMOS patrones de correo, nombre y responsable, probados contra el dominio), correos y avisos con
//     escritura del cliente SIEMPRE negada y lectura de admin y lectores (odtIndLector);
//   · la fecha de ejecución de la regla de la primera ODT es la del dominio (esIso o vacía);
//   · la Cloud Function: onDocumentCreated de odt_afinia_cortes/{id} en southamerica-east1 con maxInstances 1 y
//     concurrency 1; el reproceso es onCall, exige un admin con perfil y un id de corte válido; la lógica es dominio
//     puro que prepare-deploy.mjs copia (sus imports no salen de assets/js/domain);
//   · 99 §236 (2026-11-26, sin contraseña de aplicación de Gmail): ninguna de las tres funciones del cumplimiento pide
//     un secreto ni envía correo (sin nodemailer); la HTTPS avisosCorreoRemitente es onRequest, POST con JSON, sin
//     CORS, maxInstances 1 y concurrency 1, y verifica el token con google-auth-library (dependencia explícita);
//     el estado del script (odt_afinia_config/cumplimiento_script) lo lee solo el admin y nadie lo escribe desde la
//     página; la configuración suma audienciaScript con el MISMO patrón del dominio;
//   · repo público: sin correos reales (solo @prueba.test) ni nombres de personas en lo nuevo; ningún correo ni nombre
//     de destinatario vive en el código (los pone el administrador en la configuración).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as C from '../assets/js/domain/odt_afinia_cumplimiento.js';
import { esIso } from '../assets/js/domain/odt_afinia_indicadores.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const REGLAS = leer('firestore.rules');
const INI = REGLAS.indexOf('// Cumplimiento del cierre · ODT Afinia');
const FIN = REGLAS.indexOf('// Indicadores · ODT Afinia', INI);
const B = INI > 0 && FIN > INI ? REGLAS.slice(INI, FIN) : '';
const sc = B.replace(/\/\/.*$/gm, '');
const cuerpo = (t, f) => { const m = new RegExp('function ' + f + '\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\}').exec(t); assert.ok(m, 'no encontré ' + f); return m[1]; };
/** El patrón de `<algo>.matches('…')` como RegExp de JS (en la regla, «\\» es una barra). */
const patron = (t, antes) => {
  const i = t.indexOf(antes + ".matches('");
  assert.ok(i >= 0, 'no encontré ' + antes + '.matches');
  const ini = i + antes.length + 10;
  return new RegExp(t.slice(ini, t.indexOf("')", ini)).replace(/\\\\/g, '\\'));
};

const NUEVOS = ['assets/js/domain/odt_afinia_cumplimiento.js', 'assets/js/domain/odt_afinia_cumplimiento_avisos.js', 'assets/js/data/odt_afinia_cumplimiento.js',
  'assets/js/ui/odt-afinia/indicadores-cumplimiento.js', 'assets/js/ui/odt-afinia/indicadores-avisos.js', 'assets/css/odt-afinia-cumplimiento.css',
  'functions/cumplimiento.mjs',
  // El script de Google que envía (99 §236).
  'assets/js/domain/odt_afinia_cumplimiento_remitente.js', 'assets/js/data/odt_afinia_cumplimiento_script.js',
  'assets/js/ui/odt-afinia/indicadores-avisos-script.js', 'functions/cumplimiento_remitente.mjs',
  'functions/apps-script/avisos-cumplimiento.gs', 'functions/apps-script/appsscript.json', 'functions/apps-script/README.md',
  // Las notificaciones de cumplimiento (99 §236, pedido del 2026-11-26: «cuándo y cuántas veces notificas»).
  'assets/js/domain/odt_afinia_cumplimiento_resumen.js', 'assets/js/data/odt_afinia_cumplimiento_notificaciones.js',
  'assets/js/ui/odt-afinia/indicadores-notificaciones.js', 'assets/css/odt-afinia-notificaciones.css', 'functions/cumplimiento_resumen.mjs'];
const PRUEBAS = ['tests/odt_afinia_cumplimiento.test.js', 'tests/odt_afinia_cumplimiento_ui.test.js', 'tests/odt_afinia_cumplimiento_estatico.test.js',
  'tests-rules/odt_afinia_cumplimiento.rules.test.js', 'functions/tests/cumplimiento_avisos.test.mjs',
  'tests/odt_afinia_cumplimiento_remitente.test.js', 'functions/tests/cumplimiento_remitente.test.mjs', 'functions/tests/apps_script.test.mjs',
  'functions/tests/firestore_admin_falso.mjs', 'tests/odt_afinia_cumplimiento_notificaciones.test.js', 'functions/tests/cumplimiento_resumen.test.mjs'];

describe('reglas: bloque «Cumplimiento del cierre · ODT Afinia»', () => {
  test('existe, va justo ANTES del de Indicadores y no se mete en el de la firma', () => {
    assert.ok(B.length > 1500, 'no encontré el bloque');
    const firma = REGLAS.indexOf('// Firma de ODT Afinia (diseño W-11');
    assert.ok(INI < FIN && FIN < firma);
    for (const m of ['match /odt_afinia_config/cumplimiento {', 'match /odt_afinia_config/cumplimiento_script {', 'match /odt_afinia_config/cumplimiento_resumen {',
      'match /odt_afinia_correos/{id} {', 'match /odt_afinia_avisos/{id} {']) {
      assert.equal(REGLAS.split(m).length, 2, 'una sola vez: ' + m);
      assert.ok(B.includes(m), 'en este bloque: ' + m);
    }
    assert.ok(!/match \/odt_afinia_config\/\{/.test(REGLAS), 'ningún comodín sobre odt_afinia_config');
  });
  test('config: solo admin con perfil (leer, crear, cambiar); nadie la borra ni la lista; el estado del script, correos y avisos: el cliente NUNCA escribe', () => {
    const allows = [...sc.matchAll(/allow\s+([\w, ]+):\s*if\s+([\s\S]*?);/g)].map((m) => [m[1].trim(), m[2].replace(/\s+/g, ' ').trim()]);
    assert.deepEqual(allows, [
      ['get', 'hasProfile() && isAdmin()'],
      ['create, update', 'odtCumConfig()'],
      ['list, delete', 'false'],
      ['get', 'hasProfile() && isAdmin()'],
      ['list, create, update, delete', 'false'],
      // 99 §236 (pedido del 2026-11-26): el resumen de notificaciones, que escribe SOLO el servidor.
      ['get', 'odtIndLector()'],
      ['list, create, update, delete', 'false'],
      ['get', 'odtIndLector()'],
      ['list', 'request.query.limit <= 50 && odtIndLector()'],
      ['create, update, delete', 'false'],
      ['get', 'odtIndLector()'],
      ['list', 'request.query.limit <= 50 && odtIndLector()'],
      ['create, update, delete', 'false']
    ]);
    assert.match(cuerpo(sc, 'odtCumConfig'), /return hasProfile\(\) && isAdmin\(\)/);
    assert.equal(C.TOPE_CORREOS_LISTA, 50);
  });
  test('la forma exacta es la del dominio: claves, topes y los MISMOS patrones (probados contra el dominio)', () => {
    const c = cuerpo(sc, 'odtCumConfig');
    const claves = [...(/hasOnly\(\[([^\]]*)\]\)/.exec(c) || [])[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    assert.deepEqual(claves.sort(), [...C.CLAVES_CONFIG].sort());
    assert.ok(c.includes('d.size() == ' + C.CLAVES_CONFIG.length));
    const T = C.TOPES_CONFIG;
    assert.ok(c.includes('d.para.size() >= ' + T.paraMin + ' && d.para.size() <= ' + T.paraMax));
    assert.ok(c.includes('d.cc.size() <= ' + T.ccMax));
    // Cada destinatario y cada copia, uno por uno, hasta el tope (sin recorrer listas).
    for (let i = 0; i < T.paraMax; i++) assert.ok(c.includes('odtCumDestinatario(d.para[' + i + '])'), 'para ' + i);
    for (let i = 0; i < T.ccMax; i++) assert.ok(c.includes('odtCumCorreo(d.cc[' + i + '])'), 'cc ' + i);
    assert.ok(!c.includes('d.para[' + T.paraMax + ']') && !c.includes('d.cc[' + T.ccMax + ']'));
    const correo = patron(cuerpo(sc, 'odtCumCorreo'), 'v');
    assert.equal(correo.source, C.RE_CORREO.source, 'el mismo patrón de correo');
    for (const v of ['a@prueba.test', 'nombre.apellido+x@sub.prueba.test', 'a@b', 'a b@prueba.test', '@prueba.test', 'a@c.' + 'c', '']) assert.equal(correo.test(v), C.esCorreo(v), v);
    const d = cuerpo(sc, 'odtCumDestinatario');
    assert.ok(d.includes("x.keys().hasOnly(['correo', 'nombre'])") && d.includes('x.size() == 2') && d.includes('x is map'));
    const nombre = patron(d, 'x.nombre');
    for (const [v, ok] of [['A', true], ['N'.repeat(T.nombreMax), true], ['N'.repeat(T.nombreMax + 1), false], ['', false], [' A', false], ['A ', false], ['Ana Pérez', true]]) {
      assert.equal(nombre.test(v), ok, 'nombre ' + v.length);
      const err = C.errorConfigCumplimiento({ activo: true, remitente: 'r@prueba.test', para: [{ correo: 'u@prueba.test', nombre: v }], cc: [], responsable: 'RESPONSABLE' });
      assert.equal(err === '', ok, 'dominio, nombre ' + v.length);
    }
    const resp = patron(c, 'd.responsable');
    for (const [v, ok] of [['R'.repeat(T.responsableMin), true], ['R'.repeat(T.responsableMin - 1), false], ['R'.repeat(T.responsableMax), true], ['R'.repeat(T.responsableMax + 1), false], [' RESP', false]]) {
      assert.equal(resp.test(v), ok, 'responsable ' + v.length);
    }
    assert.ok(c.includes('d.activo is bool') && c.includes('odtCumCorreo(d.remitente)'));
    // 99 §236: audienciaScript (el script de Google aprobado), con el MISMO patrón que el dominio.
    assert.ok(c.includes('d.audienciaScript is string'));
    const aud = patron(c, 'd.audienciaScript');
    for (const v of ['', '9000000001-ficticio.apps.googleusercontent.com', 'A'.repeat(200), 'A'.repeat(201), 'con espacio', 'a/b:c_d-e.f', 'tilde-é', 'a;b']) {
      assert.equal(aud.test(v), C.esAudiencia(v), 'audienciaScript ' + JSON.stringify(v).slice(0, 30));
    }
  });
  test('la ejecución de la primera ODT de una parte (bloque de Indicadores): la forma del dominio (esIso) o vacía', () => {
    const odt = cuerpo(REGLAS.replace(/\/\/.*$/gm, ''), 'odtIndOdt');
    const p = patron(odt, 'o.ejecucion');
    for (const v of ['', '2026-11-26', '2026-13-01', '26/11/2026', '2026-11-26T00:00:00', '2026-1-05']) assert.equal(p.test(v), v === '' || esIso(v), v);
    assert.ok(odt.includes('o.size() == 13'), 'la ODT de la versión 3: 13 campos (con la ejecución y el equipo)');
    assert.ok(odt.includes("o.equipo.matches('^.{0,200}$')"), 'el equipo: texto de 0 a 200');
  });
  test('accesos a documentos: solo el perfil (y /admins) y la lista de lectores, a través de las funciones de siempre', () => {
    const llamadas = [...sc.matchAll(/(?<![.\w])(get|exists|getAfter|existsAfter)\(/g)];
    assert.equal(llamadas.length, 0, 'el bloque no lee documentos por su cuenta');
    const usadas = new Set([...sc.matchAll(/\b(odt[A-Za-z]+|isAdmin|hasProfile|profile|isTeamMember)\(/g)].map((m) => m[1]));
    for (const u of usadas) assert.ok(/^odtCum/.test(u) || ['isAdmin', 'hasProfile', 'odtIndLector'].includes(u), 'usa ' + u);
  });
});

describe('la Cloud Function', () => {
  const idx = codigo(leer('functions/index.js'));
  const bloque = idx.slice(idx.indexOf('function depsCumplimiento()'));
  const opciones = (re) => { const m = re.exec(bloque); assert.ok(m, 'no encontré ' + re); return m[1]; };
  test('al guardar un corte: onDocumentCreated de odt_afinia_cortes/{id}, southamerica-east1, maxInstances 1 y concurrency 1, sin secreto', () => {
    const o = opciones(/export const avisosCumplimientoCorte = onDocumentCreated\(\s*\{([\s\S]*?)\},/);
    assert.match(o, /document: 'odt_afinia_cortes\/\{id\}'/);
    assert.match(o, /region: 'southamerica-east1'/);
    assert.match(o, /maxInstances: 1/);
    assert.match(o, /concurrency: 1/);
    assert.ok(!/secrets/.test(o), 'sin secreto (99 §236)');
  });
  test('el reproceso: onCall, solo admin con perfil (esAdminConPerfil del perfil en /usuarios) y un id de corte válido', () => {
    const r = bloque.slice(bloque.indexOf('export const reprocesarAvisosCumplimiento = onCall('));
    const o = opciones(/export const reprocesarAvisosCumplimiento = onCall\(\s*\{([\s\S]*?)\},/);
    assert.match(o, /region: 'southamerica-east1'/);
    assert.match(o, /maxInstances: 1/);
    assert.match(o, /concurrency: 1/);
    assert.ok(!/secrets/.test(o), 'sin secreto (99 §236)');
    assert.match(r, /if \(!uid\) throw new HttpsError\('unauthenticated'/);
    assert.match(r, /db\.doc\(`usuarios\/\$\{uid\}`\)\.get\(\)/);
    assert.match(r, /if \(!esAdminConPerfil\(/);
    assert.match(r, /if \(!esIdCorte\(corteId\)\) throw new HttpsError\('invalid-argument'/);
    assert.ok(r.indexOf('esAdminConPerfil') < r.indexOf('procesarCorteCumplimiento('), 'primero el permiso');
  });
  test('99 §236: la función del script de Google es onRequest, sin CORS, una sola instancia y un proceso a la vez, sin secreto', () => {
    const o = opciones(/export const avisosCorreoRemitente = onRequest\(\s*\{([\s\S]*?)\},/);
    assert.match(o, /region: 'southamerica-east1'/);
    assert.match(o, /maxInstances: 1/);
    assert.match(o, /concurrency: 1/);
    assert.match(o, /cors: false/);
    assert.ok(!/secrets/.test(o));
    const r = bloque.slice(bloque.indexOf('export const avisosCorreoRemitente = onRequest('));
    assert.match(r, /responderHttp\(req, res, \(sol\) => REMITENTE\.atenderRemitente\(sol, deps\)\)/);
    assert.match(idx, /import \* as REMITENTE from '\.\/domain\/odt_afinia_cumplimiento_remitente\.js';/);
    // El POST y el JSON los exige el dominio (atenderRemitente), con sus pruebas.
    const dom = codigo(leer('assets/js/domain/odt_afinia_cumplimiento_remitente.js'));
    assert.match(dom, /sol\.metodo !== 'POST'/);
    assert.match(dom, /application\\\/json/);
  });
  test('99 §236: ya no hay clave de Gmail ni nodemailer; google-auth-library es dependencia explícita', () => {
    assert.ok(!/SGM_CORREO_CLAVE|defineSecret\('SGM_|nodemailer|crearEnviarGmail/.test(idx), 'index.js');
    const adaptadores = codigo(leer('functions/cumplimiento.mjs')) + codigo(leer('functions/cumplimiento_remitente.mjs'));
    assert.ok(!/nodemailer|smtp|service: 'gmail'|SGM_CORREO_CLAVE/i.test(adaptadores), 'adaptadores sin SMTP');
    assert.ok(!/pass:\s*'[^']/.test(adaptadores + idx), 'ninguna clave escrita');
    const pkg = JSON.parse(leer('functions/package.json'));
    assert.ok(!pkg.dependencies.nodemailer, 'nodemailer fuera de functions/package.json');
    assert.ok(!/"node_modules\/nodemailer"/.test(leer('functions/package-lock.json')), 'y fuera del lock');
    assert.ok(pkg.dependencies['google-auth-library'], 'google-auth-library explícita');
    // verifyIdToken SIN audience (el aud lo compara el dominio contra config.audienciaScript).
    const ver = codigo(leer('functions/cumplimiento_remitente.mjs'));
    assert.match(ver, /verifyIdToken\(\{ idToken: token \}\)/);
  });
  test('la lógica es dominio puro que prepare-deploy copia: sus imports no salen de assets/js/domain', () => {
    for (const p of ['assets/js/domain/odt_afinia_cumplimiento.js', 'assets/js/domain/odt_afinia_cumplimiento_avisos.js', 'assets/js/domain/odt_afinia_cumplimiento_remitente.js',
      'assets/js/domain/odt_afinia_cumplimiento_resumen.js']) {
      const imports = [...codigo(leer(p)).matchAll(/from\s*'([^']+)'/g)].map((m) => m[1]);
      for (const i of imports) assert.match(i, /^\.\/[\w-]+\.js$/, p + ' importa ' + i);
      assert.ok(!/firebase|document\.|window\.|fetch\(/.test(codigo(leer(p))), p + ': sin Firebase, DOM ni red');
    }
    assert.match(idx, /from '\.\/domain\/odt_afinia_cumplimiento_avisos\.js'/);
    assert.match(leer('functions/prepare-deploy.mjs'), /cpSync\(srcDomain, dstDomain, \{ recursive: true \}\)/);
    // Los adaptadores no importan ./domain (en las pruebas puede no existir): la lógica les llega inyectada.
    for (const p of ['functions/cumplimiento.mjs', 'functions/cumplimiento_remitente.mjs', 'functions/cumplimiento_resumen.mjs']) assert.ok(!/from '\.\/domain\//.test(codigo(leer(p))), p);
  });
});

describe('99 §236: el script de Google (functions/apps-script)', () => {
  const gs = leer('functions/apps-script/avisos-cumplimiento.gs');
  test('el manifiesto: zona de Bogotá, V8 y SOLO los permisos mínimos', () => {
    const m = JSON.parse(leer('functions/apps-script/appsscript.json'));
    assert.equal(m.timeZone, 'America/Bogota');
    assert.equal(m.runtimeVersion, 'V8');
    assert.deepEqual([...m.oauthScopes].sort(), ['https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.scriptapp',
      'https://www.googleapis.com/auth/script.send_mail', 'https://www.googleapis.com/auth/userinfo.email', 'openid'].sort());
  });
  test('la URL de la función es la del proyecto (pública en .firebaserc), y no hay secretos ni ids de cliente en el script', () => {
    const proyecto = JSON.parse(leer('.firebaserc')).projects.default;
    assert.ok(gs.includes("const URL_FUNCION = 'https://southamerica-east1-" + proyecto + ".cloudfunctions.net/avisosCorreoRemitente';"));
    assert.ok(!/apps\.googleusercontent\.com|ya29\.|eyJ[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}/.test(gs + leer('functions/apps-script/README.md')), 'sin ids de cliente, tokens ni claves');
    for (const f of ['function instalar()', 'function enviarPendientes()', 'function probarConexion()']) assert.ok(gs.includes(f), f);
    assert.match(gs, /ScriptApp\.getIdentityToken\(\)/);
    assert.match(gs, /MailApp\.getRemainingDailyQuota\(\)/);
    assert.match(gs, /name: NOMBRE_REMITENTE/);
    assert.match(gs, /const NOMBRE_REMITENTE = 'SGM · TRANSPOWER';/);
  });
  test('el despliegue de las funciones no sube la carpeta del script', () => {
    const fb = JSON.parse(leer('firebase.json'));
    assert.ok(fb.functions[0].ignore.includes('apps-script'));
  });
});

describe('repo público: nada real en lo nuevo', () => {
  const fuente = /const SOSPECHOSO = \/\(([^)]*)\)\/i;/.exec(leer('scripts/guardia-firmas.mjs'));
  const GENERICAS = new Set(['firma', 'signature', '\\bsign', 'firmas-equipo']);
  const apellidos = fuente ? fuente[1].split('|').filter((x) => !GENERICAS.has(x)) : [];
  const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  test('sin apellidos del equipo ni correos que no sean de prueba (también en las reglas y en la función)', () => {
    assert.ok(apellidos.length >= 4);
    for (const p of [...NUEVOS, ...PRUEBAS, 'functions/index.js']) {
      const t = leer(p);
      for (const a of apellidos) assert.ok(!sinTildes(t).includes(a), p + ': ' + a);
      for (const m of t.matchAll(/[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) assert.ok(/(^|\.)prueba\.test$/.test(m[1]) || p === 'functions/index.js', p + ': correo ' + m[0]);
    }
    for (const a of apellidos) assert.ok(!sinTildes(B).includes(a), 'reglas: ' + a);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(B), 'reglas sin correos');
  });
  test('en las pruebas, solo N.º de ODT inventados (empiezan por 9)', () => {
    for (const p of PRUEBAS) {
      for (const m of leer(p).matchAll(/(?<![\w.])(\d{8})(?![\w.])/g)) assert.ok(m[1].startsWith('9') || /^2026\d{4}$/.test(m[1]), p + ': ' + m[1]);
    }
  });
});
