// Firma de ODT Afinia · revisión ESTÁTICA del bloque de reglas `odt_afinia` en firestore.rules:
// lo que el emulador no ve o no aplica igual que producción.
//   · Presupuesto de lecturas de documentos (get/exists/getAfter/existsAfter): ≤ 10 por operación y ≤ 20 por lote
//     (firebase.google.com/docs/firestore/security/rules-conditions, «Access call limits»). Se cuenta en el PEOR
//     caso: se expanden las funciones auxiliares (las del bloque y las globales), se cuentan todas las ramas y
//     cada llamada distinta por su texto (sin suponer que get y exists del mismo documento se juntan). Y el
//     contador se verifica con mutaciones (L-144): un bloque con lecturas de más DEBE dar más del tope.
//   · El bloque no nombra las firmas custodiadas ni las delegadas (P1: nadie firma por otro) y solo llama a
//     las funciones globales de sesión/rol.
//   · Los textos de acuerdo y declaración v1 (aprobados por el Ingeniero) que arma la regla, carácter a carácter.
//   · Ningún apellido del equipo en el bloque (repo público).
//   · Decisiones del 2026-11-21: compositor @2 en los actos nuevos, FECHA CIERRE = la prevista, REEMPLAZADA y
//     CERRADA solo desde LISTA y solo el admin, candado libre también tras REEMPLAZADA (con `reemplaza` sin
//     lecturas de más) y descarga en LISTA o CERRADA. El presupuesto de lecturas no sube.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const REGLAS = leer('firestore.rules');
const INICIO = '// Firma de ODT Afinia (diseño W-11';
const FIN = '// ── Resto: cerrado por defecto ──';

function bloqueDe(texto) {
  const i = texto.indexOf(INICIO);
  const j = texto.indexOf(FIN, i);
  assert.ok(i > 0 && j > i, 'no encontré el bloque de ODT Afinia en firestore.rules');
  return texto.slice(i, j);
}
const BLOQUE = bloqueDe(REGLAS);
/** Sin comentarios de línea (en firestore.rules ninguna cadena lleva «//»). */
const sinComentarios = (t) => t.replace(/\/\/.*$/gm, '');

/* ── un lector mínimo del lenguaje de reglas: cadenas, paréntesis y llaves ───────────────── */
/** Recorre `t` saltando cadenas '…'; devuelve el índice del cierre que balancea la apertura en `i`. */
function cierre(t, i, abre, cierra) {
  let prof = 0;
  for (let k = i; k < t.length; k++) {
    const c = t[k];
    if (c === "'") { k++; while (k < t.length && t[k] !== "'") { if (t[k] === '\\') k++; k++; } continue; }
    if (c === abre) prof++;
    else if (c === cierra && --prof === 0) return k;
  }
  throw new Error('sin cierre desde ' + t.slice(i, i + 40));
}
/** Parte en los argumentos de primer nivel (comas fuera de paréntesis, corchetes, llaves y cadenas). */
function argumentos(t) {
  const out = []; let prof = 0; let ini = 0;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (c === "'") { k++; while (k < t.length && t[k] !== "'") { if (t[k] === '\\') k++; k++; } continue; }
    if ('([{'.includes(c)) prof++;
    else if (')]}'.includes(c)) prof--;
    else if (c === ',' && prof === 0) { out.push(t.slice(ini, k).trim()); ini = k + 1; }
  }
  if (t.trim()) out.push(t.slice(ini).trim());
  return out;
}
/** Reemplaza identificadores sueltos (no propiedades, no dentro de cadenas) según `mapa`. */
function sustituir(t, mapa) {
  if (!Object.keys(mapa).length) return t;
  let out = ''; let k = 0;
  while (k < t.length) {
    const c = t[k];
    if (c === "'") { let f = k + 1; while (f < t.length && t[f] !== "'") { if (t[f] === '\\') f++; f++; } out += t.slice(k, f + 1); k = f + 1; continue; }
    const m = /^[A-Za-z_]\w*/.exec(t.slice(k));
    if (m && !/[\w.$]/.test(t[k - 1] || '')) {
      out += Object.hasOwn(mapa, m[0]) ? '(' + mapa[m[0]] + ')' : m[0];
      k += m[0].length; continue;
    }
    if (m) { out += m[0]; k += m[0].length; continue; }
    out += c; k++;
  }
  return out;
}
/** Todas las funciones del archivo: nombre → { params, cuerpo }. */
function funcionesDe(texto) {
  const t = sinComentarios(texto); const mapa = new Map();
  const re = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g; let m;
  while ((m = re.exec(t))) {
    const ab = re.lastIndex - 1; const ce = cierre(t, ab, '{', '}');
    mapa.set(m[1], { params: m[2].split(',').map((s) => s.trim()).filter(Boolean), cuerpo: t.slice(ab + 1, ce) });
  }
  return mapa;
}
const ACCESO = new Set(['get', 'exists', 'getAfter', 'existsAfter']);
const norm = (s) => s.replace(/\s+/g, '');
/**
 * Llamadas de acceso a documentos que puede hacer `expr` (peor caso, todas las ramas), como claves de texto
 * «get(ruta)». Expande las funciones definidas sustituyendo sus parámetros; `usadas` recoge las funciones tocadas.
 */
function llamadas(expr, fns, usadas = new Set(), prof = 0) {
  assert.ok(prof < 40, 'recursión demasiado profunda');
  const out = new Set();
  const t = expr;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (c === "'") { k++; while (k < t.length && t[k] !== "'") { if (t[k] === '\\') k++; k++; } continue; }
    const m = /^([A-Za-z_]\w*)\s*\(/.exec(t.slice(k));
    if (!m || /[\w.$]/.test(t[k - 1] || '')) { if (m) k += m[1].length - 1; continue; }
    const ab = k + m[0].length - 1; const ce = cierre(t, ab, '(', ')');
    const args = argumentos(t.slice(ab + 1, ce));
    const nombre = m[1];
    if (ACCESO.has(nombre)) out.add(nombre + '(' + norm(args[0]) + ')');
    if (fns.has(nombre)) {
      usadas.add(nombre);
      const f = fns.get(nombre);
      const mapa = Object.fromEntries(f.params.map((p, i) => [p, args[i]]));
      for (const x of llamadas(sustituir(f.cuerpo, mapa), fns, usadas, prof + 1)) out.add(x);
    }
    for (const a of args) for (const x of llamadas(a, fns, usadas, prof + 1)) out.add(x);
    k = ce;
  }
  return out;
}
/** Los `allow` del bloque: [{ ops, expr }]. */
function allowsDe(bloque) {
  return [...sinComentarios(bloque).matchAll(/allow\s+([\w, ]+):\s*if\s+([\s\S]*?);/g)].map((m) => ({ ops: m[1].trim(), expr: m[2].trim() }));
}
/** Une las llamadas de las operaciones de un lote; cada operación con sus variables de ruta fijadas. */
function llamadasDelLote(ops, fns, allows) {
  const total = new Set();
  for (const [expr, vars] of ops) {
    assert.ok(allows.some((a) => norm(a.expr) === norm(expr)), 'no está en el bloque: allow … if ' + expr);
    for (const x of llamadas(sustituir(expr, vars || {}), fns)) total.add(x);
  }
  return total;
}

const FNS = funcionesDe(REGLAS);
const ALLOWS = allowsDe(BLOQUE);
// Los lotes que escribe la página (diseño §3): publicar = odt + hasta 5 partes + candado (nuevo o reasignado);
// firmar = acto + cambio de estado de la ODT; reemplazar y registrar el cierre en Afinia = un update de la ODT.
const PARTES = [0, 1, 2, 3, 4].map((k) => ['odtParte(id, n)', { n: `'${k}'` }]);
const UPDATE_ODT = 'odtTransicion(id) || odtAnulacion() || odtReemplazo() || odtCierreAfinia()';
const LOTES = {
  'publicar (odt + 5 partes + candado nuevo)': [['odtPublicacion(id)'], ['odtCandado(nro, null)'], ...PARTES],
  'publicar de nuevo un N.º anulado o reemplazado (odt + 5 partes + candado reasignado)': [['odtPublicacion(id)'], ['odtCandado(nro, resource.data.odtId) && odtCandadoLibre()'], ...PARTES],
  'firmar (acto + cambio de estado)': [['odtActo(id, rol)'], [UPDATE_ODT]],
  'reemplazar o registrar el cierre en Afinia (update de la ODT)': [[UPDATE_ODT]]
};

describe('presupuesto de lecturas de documentos del bloque odt_afinia (peor caso)', () => {
  test('se encontraron las reglas del bloque y todas sus funciones', () => {
    assert.ok(ALLOWS.length >= 25, 'allows encontrados: ' + ALLOWS.length);
    for (const n of ['odtPublicacion', 'odtParte', 'odtActo', 'odtTransicion', 'odtAnulacion', 'odtHabilitacion', 'odtCandado',
      'odtCandadoLibre', 'odtLector', 'odtDescarga', 'odtDevolucion', 'odtReauth', 'odtReemplazo', 'odtCierreAfinia']) assert.ok(FNS.has(n), n);
    // Sanidad del contador: la base de sesión/rol son 3 lecturas (perfil exists + get, y /admins del arranque).
    assert.deepEqual([...llamadas('isTeamMember() && hasProfile() && isAdmin() && profile().nombre == 1', FNS)].sort(), [
      'exists(/databases/$(database)/documents/admins/$(request.auth.uid))',
      'exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))',
      'get(/databases/$(database)/documents/usuarios/$(request.auth.uid))'
    ]);
  });

  test('cada operación lee como máximo 10 (llamadas distintas por su texto)', () => {
    const reporte = [];
    for (const a of ALLOWS) {
      const n = llamadas(a.expr, FNS).size;
      reporte.push(`${n} · ${a.ops}: ${a.expr.slice(0, 50)}`);
      assert.ok(n <= 10, `«allow ${a.ops}: if ${a.expr.slice(0, 70)}» lee ${n}: ${[...llamadas(a.expr, FNS)].join(' | ')}`);
    }
    // Las más caras quedan a la vista en la salida de la prueba.
    assert.ok(reporte.length > 0);
  });

  test('las operaciones clave cuestan lo que dice el diseño (publicar 10, firmar 8, cambio de estado 5; reemplazar y cerrar 3)', () => {
    const cuesta = (e) => llamadas(e, FNS).size;
    // Publicar = 9 + la lista blanca odt_afinia_config/firmantes (revisión 20-11): justo en el tope de 10.
    assert.equal(cuesta('odtPublicacion(id)'), 10);
    assert.ok(llamadas('odtPublicacion(id)', FNS).has('get(odtRutaConfig())'), 'publicar no lee la lista blanca');
    // Firmar sigue en 8: el paliativo D5 usa la ODT y el acto del AZT, que ya se leían (mismo texto de llamada).
    assert.equal(cuesta('odtActo(id, rol)'), 8);
    // El update de la ODT (firma, anulación, reemplazo o cierre) sigue en 5: reemplazar y cerrar solo leen el perfil.
    assert.equal(cuesta(UPDATE_ODT), 5);
    assert.equal(cuesta('odtReemplazo()'), 3);
    assert.equal(cuesta('odtCierreAfinia()'), 3);
    assert.equal(cuesta("odtParte(id, n)"), 6);
    // El candado con `reemplaza` no lee nada nuevo: la ODT nueva ya se leía (getAfter, mismo texto).
    assert.equal(cuesta('odtCandado(nro, null)'), 5);
    assert.equal(cuesta('odtCandado(nro, resource.data.odtId) && odtCandadoLibre()'), 6);
  });

  // Peor caso por TEXTO (revisión 20-11, con la lista blanca): 19, 20 y 10. Republicar un N.º anulado o reemplazado
  // queda en el tope exacto (también con `reemplaza`, 2026-11-21); los documentos distintos que de verdad se tocan
  // son menos (exists/get del mismo documento, la rama de /admins que no corre con perfil, la parte 0 que no mira la
  // anterior), pero el contador no lo supone.
  const COSTO_LOTE = {
    'publicar (odt + 5 partes + candado nuevo)': 19,
    'publicar de nuevo un N.º anulado o reemplazado (odt + 5 partes + candado reasignado)': 20,
    'firmar (acto + cambio de estado)': 10,
    'reemplazar o registrar el cierre en Afinia (update de la ODT)': 5
  };
  for (const [nombre, ops] of Object.entries(LOTES)) {
    test(`lote «${nombre}»: ≤ 20 en total (hoy ${COSTO_LOTE[nombre]})`, () => {
      const t = llamadasDelLote(ops, FNS, ALLOWS);
      assert.ok(t.size <= 20, `${nombre}: ${t.size} → ${[...t].join(' | ')}`);
      assert.equal(t.size, COSTO_LOTE[nombre], `${nombre}: ${[...t].join(' | ')}`);
    });
  }

  test('mutación (L-144): con lecturas de más el contador SÍ pasa los topes', () => {
    // Publicar está en el tope (10): UNA lectura nueva ya lo pasa (11 > 10).
    const mut0 = REGLAS.replace('&& getAfter(odtRutaNro(d.nro)).data.odtId == id;',
      "&& getAfter(odtRutaNro(d.nro)).data.odtId == id && exists(odtRutaNro('m0'));");
    assert.notEqual(mut0, REGLAS, 'la mutación 0 no encontró su ancla');
    assert.equal(llamadas('odtPublicacion(id)', funcionesDe(mut0)).size, 11);
    // Y el paliativo D5 escrito con OTRA ruta del acto del AZT sí costaría una lectura más (9 > 8).
    const mutD5 = REGLAS.replace("get(odtRutaActo(id, 'azt')).data.en.toMillis()", "get(odtRutaActo(id, 'azt2')).data.en.toMillis()");
    assert.notEqual(mutD5, REGLAS, 'la mutación D5 no encontró su ancla');
    assert.equal(llamadas('odtActo(id, rol)', funcionesDe(mutD5)).size, 9);
    // 2 lecturas nuevas en publicar → 12 > 10.
    const mut1 = REGLAS.replace('&& getAfter(odtRutaNro(d.nro)).data.odtId == id;',
      "&& getAfter(odtRutaNro(d.nro)).data.odtId == id && get(odtRutaNro('m1')).data.x == 1 && exists(odtRutaNro('m2'));");
    assert.notEqual(mut1, REGLAS, 'la mutación 1 no encontró su ancla');
    assert.ok(llamadas('odtPublicacion(id)', funcionesDe(mut1)).size > 10);
    // 1 lectura nueva por parte (depende de n) → el lote de publicar pasa de 20.
    const mut2 = REGLAS.replace("&& (n == '0' || existsAfter(odtRutaParte(id, string(int(n) - 1))));",
      "&& (n == '0' || existsAfter(odtRutaParte(id, string(int(n) - 1)))) && exists(odtRutaNro(n));");
    assert.notEqual(mut2, REGLAS, 'la mutación 2 no encontró su ancla');
    const fns2 = funcionesDe(mut2);
    assert.ok(llamadasDelLote(LOTES['publicar (odt + 5 partes + candado nuevo)'], fns2, allowsDe(bloqueDe(mut2))).size > 20);
    // `reemplaza` comprobado con OTRA lectura (el candado por su ruta) en vez de la getAfter que ya estaba: el lote de
    // republicar pasaría de 20. Por eso la regla lo compara con resource.data.odtId (gratis).
    const mutR = REGLAS.replace("getAfter(odtRuta(d.odtId)).data.get('reemplaza', null) == previa",
      "get(odtRutaNro(nro)).data.get('odtId', null) == previa");
    assert.notEqual(mutR, REGLAS, 'la mutación del reemplazo no encontró su ancla');
    const nombreR = 'publicar de nuevo un N.º anulado o reemplazado (odt + 5 partes + candado reasignado)';
    assert.ok(llamadasDelLote(LOTES[nombreR], funcionesDe(mutR), allowsDe(bloqueDe(mutR))).size > 20);
    // Y una función global nueva con lecturas también se cuenta al expandir.
    const mut3 = REGLAS.replace('function odtLector(id) {\n      return isTeamMember() && hasProfile()',
      'function odtLector(id) {\n      return isTeamMember() && hasProfile() && extraMut()') + '\nfunction extraMut() { return exists(/a/b) && get(/c/d) && exists(/e/f) && get(/g/h) && exists(/i/j) && get(/k/l) && exists(/m/n); }';
    assert.ok(mut3.includes('hasProfile() && extraMut()'), 'la mutación 3 no encontró su ancla');
    assert.ok(llamadas('odtLector(id)', funcionesDe(mut3)).size > 10);
  });
});

describe('aislamiento: el bloque no toca firmas custodiadas ni delegadas', () => {
  test('no nombra firmas_equipo, firmas_delegados* ni delegaciones', () => {
    assert.ok(!/firmas_equipo/i.test(BLOQUE), 'nombra firmas_equipo');
    assert.ok(!/firmas_delegad/i.test(BLOQUE), 'nombra firmas_delegados*');
    assert.ok(!/delegaci[oó]n|delegables|custodio\s*\(/i.test(sinComentarios(BLOQUE)));
  });

  test('solo llama a funciones del bloque o a las globales de sesión/rol', () => {
    const PERMITIDAS = new Set(['isSignedIn', 'hasProfile', 'profile', 'adminsBootstrapValido', 'esRolVisitante', 'isTeamMember', 'isAdmin']);
    const propias = new Set(funcionesDe(BLOQUE).keys());
    const usadas = new Set();
    for (const a of ALLOWS) llamadas(a.expr, FNS, usadas);
    for (const f of usadas) assert.ok(propias.has(f) || PERMITIDAS.has(f), 'llama a ' + f);
    for (const f of propias) assert.ok(f.startsWith('odt'), 'función sin prefijo odt: ' + f);
  });

  test('solo lee las colecciones odt_afinia*, el perfil, /admins (arranque) y la firma PROPIA', () => {
    const cols = new Set();
    for (const a of ALLOWS) {
      for (const x of llamadas(a.expr, FNS)) {
        const ruta = x.replace(/^\w+\(/, '');
        const f = /^odtRuta(\w*)\(/.exec(ruta);
        if (f) { cols.add('odtRuta' + f[1]); continue; }
        cols.add(/documents\/(\w+)/.exec(ruta)[1]);
      }
    }
    assert.deepEqual([...cols].sort(), ['admins', 'odtRuta', 'odtRutaActo', 'odtRutaConfig', 'odtRutaFirmaPropia', 'odtRutaHab', 'odtRutaNro', 'odtRutaParte', 'odtRutaUsuario', 'usuarios'].sort());
    // La lista blanca es UN documento fijo, solo se lee (write false) y solo la lee el admin.
    assert.match(FNS.get('odtRutaConfig').cuerpo, /documents\/odt_afinia_config\/firmantes;/);
    assert.match(sinComentarios(BLOQUE), /match \/odt_afinia_config\/firmantes \{\s*allow get: if hasProfile\(\) && isAdmin\(\);\s*allow list, write: if false;\s*\}/);
    // La firma que se lee es la del que hace la petición: firmas/{request.auth.uid}, nunca la de otro.
    const firmas = [...new Set(ALLOWS.flatMap((a) => [...llamadas(a.expr, FNS)]))].filter((x) => x.includes('odtRutaFirmaPropia'));
    assert.deepEqual(firmas, ['get(odtRutaFirmaPropia(request.auth.uid))']);
    assert.match(FNS.get('odtRutaFirmaPropia').cuerpo, /documents\/firmas\/\$\(uid\)/);
  });
});

describe('textos v1 armados en la regla (BORRADOR del Ingeniero), carácter a carácter', () => {
  /** Evalúa `return 'a' + x + 'b';` con los argumentos dados. */
  function armar(nombreFn, valores) {
    const f = FNS.get(nombreFn);
    const cuerpo = /^\s*return\s+([\s\S]*);\s*$/.exec(f.cuerpo)[1];
    const piezas = []; let k = 0; let ini = 0;
    while (k < cuerpo.length) {
      if (cuerpo[k] === "'") { k++; while (cuerpo[k] !== "'") k++; }
      else if (cuerpo[k] === '+') { piezas.push(cuerpo.slice(ini, k).trim()); ini = k + 1; }
      k++;
    }
    piezas.push(cuerpo.slice(ini).trim());
    return piezas.map((p) => (p.startsWith("'") ? p.slice(1, -1) : (() => {
      const i = f.params.indexOf(p); assert.ok(i >= 0, 'pieza desconocida ' + p); return valores[i];
    })())).join('');
  }
  const N = 'Nombre De Prueba'; const C = 'cuenta@prueba.test'; const NRO = '00000001'; const F = '20/11/2026';

  test('acuerdo odt-acuerdo-v1', () => {
    assert.equal(armar('odtAcuerdo', [N, C]),
      'Yo, Nombre De Prueba, con mi cuenta personal cuenta@prueba.test, acepto firmar electr\u00f3nicamente las ODT de Afinia en SGM. ' +
      'Mi firma solo se estampa desde mi propia cuenta y con mi contrase\u00f1a personal, que no comparto.');
  });
  test('declaración AZT odt-azt-v1', () => {
    assert.equal(armar('odtDeclaracionAzt', [N, C, NRO]),
      'Yo, Nombre De Prueba, con mi cuenta personal cuenta@prueba.test, declaro que revis\u00e9 las dos p\u00e1ginas de la ODT N.\u00ba 00000001 ' +
      'y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.');
  });
  test('declaración Responsable odt-resp-v1', () => {
    assert.equal(armar('odtDeclaracionResp', [N, C, NRO, F]),
      'Yo, Nombre De Prueba, con mi cuenta personal cuenta@prueba.test, declaro que revis\u00e9 las dos p\u00e1ginas de la ODT N.\u00ba 00000001, ' +
      'verifiqu\u00e9 la firma del AZT y, como RESPONSABLE O.D.T., la firmo y la cierro con fecha 20/11/2026. Esta firma equivale a mi firma manuscrita.');
  });
  test('el texto del bloque está en NFC y el «º» es U+00BA (no el signo de grado)', () => {
    assert.equal(BLOQUE, BLOQUE.normalize('NFC'));
    assert.ok(!BLOQUE.includes('N.\u00b0'));
  });
  test('estados y versiones del contrato', () => {
    const literales = new Set([...sinComentarios(BLOQUE).matchAll(/'([^'\\]*)'/g)].map((m) => m[1]));
    for (const e of ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'LISTA', 'ANULADA', 'CERRADA', 'REEMPLAZADA', 'odt-acuerdo-v1', 'odt-azt-v1', 'odt-resp-v1',
      'odt-afinia@2', 'password', 'azt', 'responsable']) assert.ok(literales.has(e), e);
    assert.ok(!literales.has('odt-afinia@1'), 'ningún acto nuevo con el compositor @1');
    const estados = [...literales].filter((s) => /^[A-Z][A-Z_]+$/.test(s)).sort();
    assert.deepEqual(estados, ['ANULADA', 'CERRADA', 'LISTA', 'PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'REEMPLAZADA']);
  });
});

describe('sin datos de personas en el bloque (repo público)', () => {
  // Los apellidos se leen de scripts/guardia-firmas.mjs (SOSPECHOSO): así esta prueba no escribe ningún nombre.
  const fuente = /const SOSPECHOSO = \/\(([^)]*)\)\/i;/.exec(leer('scripts/guardia-firmas.mjs'));
  const GENERICAS = new Set(['firma', 'signature', '\\bsign', 'firmas-equipo']);
  const apellidos = fuente ? fuente[1].split('|').filter((x) => !GENERICAS.has(x)) : [];
  const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  test('la lista de apellidos se pudo leer de la guardia', () => { assert.ok(apellidos.length >= 4, apellidos.join(',')); });
  test('ningún apellido del equipo ni correo real en el bloque', () => {
    for (const a of apellidos) assert.ok(!sinTildes(BLOQUE).includes(a), a);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(BLOQUE), 'un correo escrito en el bloque');
  });
});

describe('revisión 20-11 (D5, D6 y lente seg): las condiciones están en la regla que toca', () => {
  const cuerpo = (n) => norm(FNS.get(n).cuerpo);
  test('publicar exige la lista blanca por rol', () => {
    assert.ok(cuerpo('odtPublicacion').includes(norm('d.firmantes.azt.uid in cfg.azt && d.firmantes.responsable.uid in cfg.responsable')));
    assert.ok(cuerpo('odtPublicacion').includes(norm('let cfg = get(odtRutaConfig()).data;')));
  });
  test('D5: el acto exige sesión iniciada después de publicar, y el Responsable después del acto del AZT', () => {
    const a = cuerpo('odtActo');
    assert.ok(a.includes(norm('request.auth.token.auth_time * 1000 > o.publicadoEn.toMillis()')));
    assert.ok(a.includes(norm("request.auth.token.auth_time * 1000 > get(odtRutaActo(id, 'azt')).data.en.toMillis()")));
  });
  test('el acto ata nombre y correo a lo publicado y la huella a la guardada por «Mi firma»', () => {
    const a = cuerpo('odtActo');
    assert.ok(a.includes(norm('d.nombre == o.firmantes[rol].nombre && d.correo == o.firmantes[rol].correo')));
    assert.ok(a.includes(norm('firma.huella == d.huellaImagen')));
  });
  test('D6: anular solo desde PENDIENTE_*; devolución con id rol_rev', () => {
    assert.ok(cuerpo('odtAnulacion').includes(norm("o.estado in ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE']")));
    assert.ok(!cuerpo('odtAnulacion').includes(norm("o.estado != 'ANULADA'")));
    assert.ok(cuerpo('odtDevolucion').includes(norm("dv == d.rol + '_' + string(o.rev)")));
    assert.match(sinComentarios(BLOQUE), /allow create: if odtDevolucion\(id, dv\);/);
  });
  test('odtFecha descarta los días que no existen en el mes (tabla de 12 meses, febrero 29)', () => {
    assert.ok(cuerpo('odtFecha').includes(norm('int(f[0:2]) <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][int(f[3:5]) - 1]')));
  });
});

describe('decisiones del 2026-11-21: pie de cierre @2, reemplazo, CERRADA, candado y descargas', () => {
  const cuerpo = (n) => norm(FNS.get(n).cuerpo);
  test('el acto exige el compositor @2 y, para el Responsable, la fecha de cierre = la fecha prevista (sin el rango viejo)', () => {
    const a = cuerpo('odtActo');
    assert.ok(a.includes(norm("d.compositor == 'odt-afinia@2'")));
    assert.ok(a.includes(norm('d.cierre.fecha == o.fechaTrabajo')));
    assert.ok(a.includes(norm('odtFecha(d.cierre.fecha)')), 'sigue exigiendo una fecha real');
    assert.ok(a.includes(norm('odtFechaNum(d.cierre.fecha) <= odtHoyBogota()')), 'y no posterior a hoy en Bogotá');
    assert.ok(!a.includes(norm('odtFechaNum(d.cierre.fecha) >= odtFechaNum(o.fechaTrabajo)')), 'el rango viejo ya no está');
  });
  test('L-102: el cierre del Responsable es el pie completo {si, fecha, generada} con generada == N.º (sin lecturas de más)', () => {
    const a = cuerpo('odtActo');
    assert.ok(a.includes(norm('d.cierre is map && d.cierre.size() == 3')), 'tres claves: un cierre de 2 (armador viejo de la caché) se niega');
    assert.ok(!a.includes(norm('d.cierre.size() == 2')));
    assert.ok(a.includes(norm('d.cierre.generada == o.nro')), 'el N.º de «ODT GENERADA» es el de la ODT (o ya se leyó: sin get de más)');
  });
  test('reemplazar: admin con perfil, solo desde LISTA, con motivo 10-500, quién y hora del servidor; solo 3 claves', () => {
    const r = cuerpo('odtReemplazo');
    for (const x of ['hasProfile() && isAdmin()', "o.estado == 'LISTA'", "n.diff(o).affectedKeys().hasOnly(['estado', 'rev', 'reemplazo'])",
      "n.estado == 'REEMPLAZADA' && n.rev == o.rev + 1", 'n.reemplazo.size() == 3', 'odtTexto(n.reemplazo.motivo, 10, 500)',
      'n.reemplazo.por == odtQuien()', 'n.reemplazo.en == request.time']) assert.ok(r.includes(norm(x)), x);
  });
  test('cerrar en Afinia: admin con perfil, solo desde LISTA, fecha real entre la prevista y hoy, soporte 3-120; solo 3 claves', () => {
    const c = cuerpo('odtCierreAfinia');
    for (const x of ['hasProfile() && isAdmin()', "o.estado == 'LISTA'", "n.diff(o).affectedKeys().hasOnly(['estado', 'rev', 'cierreAfinia'])",
      "n.estado == 'CERRADA' && n.rev == o.rev + 1", 'n.cierreAfinia.size() == 4', 'odtFecha(n.cierreAfinia.fecha)',
      'odtFechaNum(n.cierreAfinia.fecha) <= odtHoyBogota()', 'odtFechaNum(n.cierreAfinia.fecha) >= odtFechaNum(o.fechaTrabajo)',
      'odtTexto(n.cierreAfinia.soporte, 3, 120)', 'n.cierreAfinia.por == odtQuien()', 'n.cierreAfinia.en == request.time']) assert.ok(c.includes(norm(x)), x);
    assert.match(sinComentarios(BLOQUE), /allow update: if odtTransicion\(id\) \|\| odtAnulacion\(\) \|\| odtReemplazo\(\) \|\| odtCierreAfinia\(\);/);
  });
  test('candado: libre con la vigente ANULADA o REEMPLAZADA; `reemplaza` = la del candado previo (o ninguna)', () => {
    assert.ok(cuerpo('odtCandadoLibre').includes(norm("get(odtRuta(resource.data.odtId)).data.estado in ['ANULADA', 'REEMPLAZADA']")));
    assert.ok(cuerpo('odtCandado').includes(norm("getAfter(odtRuta(d.odtId)).data.get('reemplaza', null) == previa")));
    assert.match(sinComentarios(BLOQUE), /allow create: if odtCandado\(nro, null\);/);
    assert.match(sinComentarios(BLOQUE), /allow update: if odtCandado\(nro, resource\.data\.odtId\) && odtCandadoLibre\(\);/);
    assert.ok(cuerpo('odtPublicacion').includes(norm('(d.size() == 16 || (d.size() == 17 && odtIdValido(d.reemplaza)))')));
  });
  test('descarga: solo de una ODT LISTA o CERRADA (una REEMPLAZADA no se descarga)', () => {
    assert.ok(cuerpo('odtDescarga').includes(norm("get(odtRuta(d.odtId)).data.estado in ['LISTA', 'CERRADA']")));
  });
  test('los estados finales no tienen salida: ninguna regla de update parte de ANULADA, REEMPLAZADA ni CERRADA', () => {
    for (const f of ['odtTransicion', 'odtAnulacion', 'odtReemplazo', 'odtCierreAfinia']) {
      const c = cuerpo(f);
      for (const e of ['ANULADA', 'REEMPLAZADA', 'CERRADA']) assert.ok(!c.includes(norm("o.estado == '" + e + "'")), f + ' parte de ' + e);
    }
  });
});

describe('exenciones de índice de los binarios del módulo (firestore.indexes.json, editado como texto)', () => {
  const IDX = leer('firestore.indexes.json');
  test('partes.datos y actos.imagen sin índice, y las exenciones previas siguen', () => {
    const fo = JSON.parse(IDX).fieldOverrides;
    const tiene = (g, f) => fo.some((x) => x.collectionGroup === g && x.fieldPath === f && Array.isArray(x.indexes) && x.indexes.length === 0);
    assert.ok(tiene('partes', 'datos'));
    assert.ok(tiene('actos', 'imagen'));
    for (const [g, f] of [['archivos', 'bytes'], ['informes_brigada_bin', 'bytes'], ['partes', 'bytes']]) assert.ok(tiene(g, f), g + '.' + f);
    // Una línea por exención, con el mismo formato que las demás (L-66 §117: se inserta como texto).
    assert.match(IDX, /\n {4}\{ "collectionGroup": "partes", "fieldPath": "datos", "indexes": \[\] \},\n/);
    assert.match(IDX, /\n {4}\{ "collectionGroup": "actos", "fieldPath": "imagen", "indexes": \[\] \},\n/);
  });
});
