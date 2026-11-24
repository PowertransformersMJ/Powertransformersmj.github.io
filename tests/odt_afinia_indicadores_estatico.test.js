// Firma de ODT Afinia · INDICADORES · revisión ESTÁTICA (lo que una prueba de ejecución no ve):
//   · L-102: todo lo nuevo vive en archivos NUEVOS; a sus vecinos de antes (que pudieron quedar viejos en la caché del
//     navegador) solo les piden nombres que ya existían; app.js carga la pestaña con import() y pregunta si trae lo que
//     usa; la pestaña no les pide nada a los repositorios de la firma ni de «Por subsanar» (el estado en SGM se lee por
//     N.º con el repositorio de cortes, de solo lectura) y ningún archivo nuevo escribe en ellos;
//   · el dominio y el armado del lote son PUROS (sin Firebase, sin DOM, sin red);
//   · los pasos que se esconden son contenedores sin `display` propio (o la caja .odt-confirmar), nunca un botón;
//   · el CSS nuevo: prefijo .odt-, sin transition: all ni backdrop-filter, y el bloque de celular DESPUÉS de las reglas base;
//   · el bloque de reglas «Indicadores · ODT Afinia»: aparte, ANTES del de la firma (así las revisiones de los otros dos
//     bloques no cambian), crear solo admin con perfil, update y delete prohibidos SIEMPRE, lecturas solo de admin, pocas
//     lecturas de documentos (≤ 10 por operación, ≤ 20 por lote) y las mismas constantes que el dominio;
//   · repo público: sin correos, sin apellidos del equipo, y en las pruebas solo N.º de ODT inventados (empiezan por 9);
//   · el PERIODO (2026-11-24) vive en dos archivos NUEVOS (su dominio puro y su bloque de pantalla): al dominio de antes
//     solo le pide nombres que ya existían, y el dominio de antes no cambia.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, posix } from 'node:path';
import { TOPES_CORTE, VERSION_CORTE, COL_CORTES } from '../assets/js/domain/odt_afinia_indicadores.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const NUEVOS = [
  'assets/js/domain/odt_afinia_indicadores.js',
  'assets/js/data/odt_afinia_cortes_lotes.js',
  'assets/js/data/odt_afinia_cortes.js',
  'assets/js/ui/odt-afinia/indicadores.js',
  'assets/js/ui/odt-afinia/indicadores-vista.js',
  'assets/js/ui/odt-afinia/indicadores-cargar.js',
  'assets/js/ui/odt-afinia/indicadores-graficos.js',
  // El periodo (2026-11-24): sus exportaciones son nuevas, así que van en archivos nuevos (L-102 (3)).
  'assets/js/domain/odt_afinia_indicadores_periodo.js',
  'assets/js/ui/odt-afinia/indicadores-periodo.js'
];
const PRUEBAS = ['tests/odt_afinia_indicadores.test.js', 'tests/odt_afinia_indicadores_datos.test.js', 'tests/odt_afinia_indicadores_ui.test.js',
  'tests/odt_afinia_indicadores_fixture.js', 'tests/odt_afinia_indicadores_estatico.test.js', 'tests-rules/odt_afinia_cortes.rules.test.js',
  'tests/odt_afinia_indicadores_azt_jefe.test.js', 'tests/odt_afinia_indicadores_periodo.test.js'];
const CSS_NUEVO = 'assets/css/odt-afinia-indicadores.css';
const FUENTE = Object.fromEntries(NUEVOS.map((p) => [p, leer(p)]));
/** Lo que los archivos nuevos pueden pedir a cada vecino de ANTES (nombres que ya exportaban antes de esta entrega). */
const YA_EXISTIAN = {
  'assets/js/ui/odt-afinia/comun.js': ['h', 'vaciar', 'aviso', 'mensajeDe', 'fechaHora'],
  'assets/js/data/odt_afinia_lotes.js': ['ErrorOdt', 'MENSAJES', 'errorDesdeFirebase', 'sesionGlobal', 'esIdOdt'],
  'assets/js/domain/odt_afinia_partes.js': ['huella'],
  // Los nombres de las colecciones de la firma y de «Por subsanar» (el estado en SGM se consulta por N.º en ellas).
  'assets/js/domain/odt_afinia_rutas.js': ['COL'],
  'assets/js/domain/odt_afinia_obs.js': ['COL_OBS'],
  // «Hoy» en la hora de Colombia, para «Este mes» y «Mes pasado» del periodo.
  'assets/js/domain/odt_afinia_textos.js': ['fechaBogota']
};
function importsDe(ruta, texto) {
  return [...codigo(texto).matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].map((m) => [
    posix.normalize(posix.join(posix.dirname(ruta), m[2])),
    m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)
  ]);
}
function pedidosNuevos(ruta, texto) {
  const out = [];
  for (const [mod, nombres] of importsDe(ruta, texto)) {
    if (NUEVOS.includes(mod)) continue;
    const permitidos = YA_EXISTIAN[mod];
    if (!permitidos) { out.push('vecino no previsto: ' + mod); continue; }
    for (const n of nombres) if (!permitidos.includes(n)) out.push(n + ' a ' + mod);
  }
  return out;
}

describe('L-102: lo nuevo en archivos NUEVOS; a los vecinos de antes, solo lo que ya existía', () => {
  test('los archivos nuevos existen y su cabecera dice que son nuevos a propósito', () => {
    for (const p of NUEVOS) {
      assert.ok(existsSync(resolve(RAIZ, p)), p);
      assert.match(FUENTE[p], /Archivo NUEVO a propósito \(L-102\)/, p);
    }
    assert.match(leer(CSS_NUEVO), /Archivo NUEVO \(L-102\)/);
    for (const p of PRUEBAS) assert.ok(existsSync(resolve(RAIZ, p)), p);
  });
  test('ningún archivo nuevo le pide a un vecino de antes un nombre que no existía', () => {
    for (const [p, t] of Object.entries(FUENTE)) assert.deepEqual(pedidosNuevos(p, t), [], p);
    // Mutación (L-144): pedirle a comun.js un nombre nuevo, o a un vecino no previsto, SÍ se ve.
    assert.deepEqual(pedidosNuevos('assets/js/ui/odt-afinia/x.js', "import { h, huellaCorta } from './comun.js';"), ['huellaCorta a assets/js/ui/odt-afinia/comun.js']);
    assert.deepEqual(pedidosNuevos('assets/js/ui/odt-afinia/x.js', "import { montarBandeja } from './bandeja.js';"), ['vecino no previsto: assets/js/ui/odt-afinia/bandeja.js']);
  });
  test('los nombres permitidos siguen existiendo en esos vecinos (control)', async () => {
    for (const [mod, nombres] of Object.entries(YA_EXISTIAN)) {
      if (mod.includes('/ui/')) {
        const t = codigo(leer(mod));
        for (const n of nombres) assert.match(t, new RegExp('export (const|function|async function) ' + n + '\\b'), mod + ' · ' + n);
        continue;
      }
      const m = await import('../' + mod);
      for (const n of nombres) assert.ok(n in m, mod + ' · ' + n);
    }
  });
  test('app.js carga «Indicadores» con import() (nunca estático), pregunta si trae lo que usa y la da solo al admin', () => {
    const app = codigo(leer('assets/js/ui/odt-afinia/app.js'));
    assert.ok(!/^import[^;]*(indicadores|odt_afinia_cortes)/m.test(app), 'sin import estático de lo nuevo');
    assert.match(app, /import\('\.\/indicadores\.js'\)/);
    assert.match(app, /typeof m\.montarIndicadores === 'function' && typeof m\.crearRepositorioCortes === 'function'/);
    assert.match(app, /MSG_INDICADORES_NO_CARGO/);
    assert.match(app, /\.\.\.\(sesion\.esAdmin \? \[\{ clave: 'publicar', titulo: 'Publicar ODT' \}, \{ clave: 'indicadores', titulo: 'Indicadores' \}\] : \[\]\)/);
    assert.match(app, /if \(a\.vista === 'indicadores'\) \{\s*if \(!sesion\.esAdmin\)/);
    assert.match(app, /return \{ ir \};/);
  });
  test('a la firma y a «Por subsanar» (que pudieron quedar viejos) no se les pide nada: el estado en SGM va por el repositorio de cortes', () => {
    const i = codigo(FUENTE['assets/js/ui/odt-afinia/indicadores.js']);
    assert.ok(!/repoOdt|repoObs|cargarObs|listarBandeja/.test(i), 'la pestaña no usa los repositorios de la firma ni de «Por subsanar»');
    assert.match(i, /typeof repoCortes\.estadoSgm === 'function' \? \(nros\) => repoCortes\.estadoSgm\(nros\)/);
    const app = codigo(leer('assets/js/ui/odt-afinia/app.js'));
    const llamada = /m\.montarIndicadores\(zona, \{([^}]*)/.exec(app);
    assert.ok(llamada && !/repoOdt|cargarObs/.test(llamada[1]), 'app.js no le pasa los repositorios de la firma');
    for (const p of NUEVOS) assert.ok(!/repo(Odt|Obs)\.(publicar|firmar|anular|reemplazar|registrar|cambiarPunto|agregarPunto|resolver|habilitarme)\b/.test(codigo(FUENTE[p])), p + ' escribe en la firma o en «Por subsanar»');
    // Mutación (L-144): una llamada que escribe SÍ se ve.
    assert.ok(/repo(Odt|Obs)\.(publicar|firmar|anular|reemplazar|registrar|cambiarPunto|agregarPunto|resolver|habilitarme)\b/.test('repoObs.cambiarPunto(id)'));
  });
  test('la página enlaza el CSS nuevo (una línea)', () => {
    const pagina = leer('pages/firma-odt-afinia.html');
    assert.equal(pagina.split('\n').filter((l) => l.includes('odt-afinia-indicadores.css')).length, 1);
    assert.ok(pagina.indexOf('odt-afinia.css') < pagina.indexOf('odt-afinia-indicadores.css'), 'después de la hoja del módulo');
  });
});

describe('dominio y armado del lote: puros', () => {
  for (const p of ['assets/js/domain/odt_afinia_indicadores.js', 'assets/js/data/odt_afinia_cortes_lotes.js', 'assets/js/domain/odt_afinia_indicadores_periodo.js']) {
    test(p + ': sin Firebase, sin DOM, sin red', () => {
      const c = codigo(FUENTE[p]);
      assert.ok(!/firebasejs|gstatic|firebase-init|session-guard/.test(c), 'Firebase');
      assert.ok(!/\bdocument\.|\bwindow\.|localStorage|sessionStorage|\bfetch\(/.test(c), 'DOM / red');
    });
  }
  test('el dominio solo importa módulos hermanos (aquí: ninguno)', () => {
    assert.deepEqual(importsDe('assets/js/domain/odt_afinia_indicadores.js', FUENTE['assets/js/domain/odt_afinia_indicadores.js']), []);
  });
  test('el dominio del periodo solo le pide a su hermano de antes nombres que ya exportaba (L-102: puede seguir viejo en caché)', async () => {
    const dom = 'assets/js/domain/odt_afinia_indicadores.js';
    const PEDIDOS_PERIODO = ['esIso', 'fechaDMA', 'filtrar'];
    assert.deepEqual(importsDe('assets/js/domain/odt_afinia_indicadores_periodo.js', FUENTE['assets/js/domain/odt_afinia_indicadores_periodo.js']), [[dom, PEDIDOS_PERIODO]]);
    const m = await import('../' + dom);
    for (const n of PEDIDOS_PERIODO) assert.equal(typeof m[n], 'function', n);
    // Lo del periodo NO se agregó al dominio de antes: ninguna de sus exportaciones vive allí.
    const per = await import('../assets/js/domain/odt_afinia_indicadores_periodo.js');
    assert.ok(Object.keys(per).length >= 10);
    for (const n of Object.keys(per)) assert.ok(!(n in m), 'exportación nueva en el dominio de antes: ' + n);
    // Lo que la vista y el bloque nuevo le piden al dominio de antes también existía antes del periodo.
    for (const p of ['assets/js/ui/odt-afinia/indicadores-vista.js', 'assets/js/ui/odt-afinia/indicadores-periodo.js', 'assets/js/ui/odt-afinia/indicadores-graficos.js']) {
      for (const [mod, nombres] of importsDe(p, FUENTE[p])) if (mod === dom) for (const n of nombres) assert.ok(n in m, p + ' · ' + n);
    }
  });
});

describe('pantalla: pasos escondidos de verdad, sin HTML y sin salidas del documento', () => {
  const UI = NUEVOS.filter((p) => p.includes('/ui/'));
  test('solo se esconden contenedores sin `display` propio (pasoGuardar, caja), nunca un botón', () => {
    for (const p of UI) {
      const c = codigo(FUENTE[p]);
      const escondidos = new Set([...c.matchAll(/(\w+(?:\.\w+)?)\.hidden\s*=/g)].map((m) => m[1]));
      for (const x of escondidos) assert.ok(['pasoGuardar', 'caja'].includes(x), p + ': esconde ' + x);
    }
    const c = codigo(FUENTE['assets/js/ui/odt-afinia/indicadores-cargar.js']);
    assert.match(c, /const pasoGuardar = h\('div', \{ hidden: true \}, h\('div', \{ class: 'odt-acciones' \}, btnGuardar\)\);/);
    assert.match(c, /const caja = h\('div', \{ class: 'odt-confirmar', role: 'group'/);
    // «NO repita»: con un lote pendiente no se libera el botón.
    assert.match(c, /if \(pendiente\) return;\s*liberar\(\);/);
    assert.match(c, /const envio = listo;/);
  });
  test('sin innerHTML, sin print/open/descargas, y el SVG con createElementNS + setAttribute (también la clase)', () => {
    for (const p of UI) {
      const c = codigo(FUENTE[p]);
      assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(c), p);
      assert.ok(!/\bprint\s*\(|window\.open\s*\(|createObjectURL|entregarBlob|getDownloadURL/.test(c), p);
    }
    const g = codigo(FUENTE['assets/js/ui/odt-afinia/indicadores-graficos.js']);
    assert.match(g, /document\.createElementNS\(NS, tag\)/);
    assert.ok(!/\.className\s*=/.test(g), 'en un SVG, className es de solo lectura: va con setAttribute');
    assert.match(g, /'http:\/\/www\.w3\.org\/2000\/svg'/);
  });
  test('sin dependencias nuevas de CDN (ni Chart.js ni otra librería)', () => {
    for (const p of NUEVOS) {
      const urls = [...codigo(FUENTE[p]).matchAll(/https?:\/\/[^'"\s)]+/g)].map((m) => m[0]);
      for (const u of urls) assert.ok(u === 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js' || u === 'http://www.w3.org/2000/svg', p + ': ' + u);
    }
  });
});

describe('CSS nuevo (prefijo .odt-, rendimiento, celular)', () => {
  const css = leer(CSS_NUEVO).replace(/\/\*[\s\S]*?\*\//g, '');
  test('sin transition: all, sin backdrop-filter, sin animar el layout', () => {
    assert.ok(!/transition\s*:[^;]*\ball\b/i.test(css));
    assert.ok(!/backdrop-filter/i.test(css));
    for (const m of css.matchAll(/transition\s*:([^;]*);/g)) assert.ok(!/\b(width|height|top|left|margin|padding)\b/.test(m[1]), m[1]);
  });
  test('cada selector lleva el prefijo .odt-', () => {
    const bloques = [...css.matchAll(/(@?[^{}@]+)\{/g)].map((m) => m[1].trim());
    const selectores = bloques.filter((s) => s && !s.startsWith('@'));
    assert.ok(selectores.length > 30, 'el lector ve las reglas (' + selectores.length + ')');
    for (const s of selectores) for (const parte of s.split(',')) assert.match(parte.trim(), /\.odt-/, 'sin prefijo: ' + parte.trim());
  });
  test('la leyenda: un color por clase (sin estilos en línea), el mismo que el de los gráficos', async () => {
    const { COLOR_ESTADO, COLOR_MES } = await import('../assets/js/ui/odt-afinia/indicadores-graficos.js');
    const color = (k) => (new RegExp('\\.odt-ind-muestra--' + k + ' \\{ background: (#[0-9a-f]{6}); \\}').exec(css) || [])[1];
    for (const [k, c] of Object.entries(COLOR_ESTADO)) assert.equal(color(k), c, k);
    assert.equal(color('generadas'), COLOR_MES.generadas);
    assert.equal(color('cerradasMes'), COLOR_MES.cerradas);
    for (const p of NUEVOS) assert.ok(!/\bstyle\s*:/.test(codigo(FUENTE[p])), p + ': estilo en línea');
    // El SVG no lleva viewBox (el texto se encogería en un celular) y la hoja no le pisa el alto.
    assert.ok(!/viewBox/.test(codigo(FUENTE['assets/js/ui/odt-afinia/indicadores-graficos.js'])));
    assert.ok(!/\.odt-ind-svg \{[^}]*height/.test(css));
  });
  test('la barra superior FIJA de la página (64 px) no tapa lo que se lleva a la vista: scroll-margin-top en cada destino', () => {
    const m = /([^{}]+)\{\s*scroll-margin-top:\s*(\d+)px;\s*\}/.exec(css);
    assert.ok(m, 'hay una regla con scroll-margin-top');
    assert.ok(Number(m[2]) >= 72, 'más que la barra (64 px) y un margen');
    const sels = m[1].split(',').map((x) => x.trim());
    // Cada destino de un desplazamiento o del foco al navegar (indicadores.js, -vista.js y -cargar.js).
    for (const c of ['.odt-ind-titulo', '.odt-ind-aviso-inicial', '.odt-ind-seccion', '.odt-ind-seccion > h3', '.odt-ind-lista-titulo', '.odt-ind-h3-datos',
      '.odt-ind-historial-titulo', '.odt-ind-previa-titulo', '.odt-ind-estado', '.odt-ind-num', '.odt-ind-tarjeta-btn', '.odt-ind-orden', '.odt-ind-mas-historial']) {
      assert.ok(sels.includes(c), 'falta ' + c);
      const clase = c.split(' ')[0].slice(1);
      assert.ok(NUEVOS.some((p) => p.endsWith('.js') && new RegExp("'[^']*\\b" + clase + "\\b").test(codigo(FUENTE[p]))), 'la clase ' + clase + ' la usa la pantalla');
    }
    // La entrada cuenta como oculto lo que queda debajo de la barra (no solo lo que sale de la ventana).
    const barra = Number((/export const BARRA_FIJA_PX = (\d+);/.exec(FUENTE['assets/js/ui/odt-afinia/indicadores-vista.js']) || [])[1]);
    assert.ok(barra > 64 && barra < Number(m[2]), 'BARRA_FIJA_PX entre la barra y el scroll-margin-top');
    assert.match(codigo(FUENTE['assets/js/ui/odt-afinia/indicadores.js']), /r\.top >= BARRA_FIJA_PX/);
  });
  test('el bloque de celular va DESPUÉS de las reglas base (L-121) y [hidden] no lo pisa ningún display de la caja', () => {
    const i = css.indexOf('@media (max-width: 720px)');
    assert.ok(i > css.indexOf('.odt-ind-tarjetas {'), 'después de la base');
    for (const m of css.matchAll(/([^{}]*\.odt-confirmar[^{}]*)\{([^}]*)\}/g)) assert.ok(!/display\s*:/.test(m[2]));
  });
});

describe('reglas: bloque «Indicadores · ODT Afinia» de firestore.rules', () => {
  const REGLAS = leer('firestore.rules');
  const ini = REGLAS.indexOf('// Indicadores · ODT Afinia');
  const fin = REGLAS.indexOf('// Firma de ODT Afinia (diseño W-11', ini);
  const B = ini > 0 && fin > ini ? REGLAS.slice(ini, fin) : '';
  const sc = B.replace(/\/\/.*$/gm, '');
  test('existe, va ANTES del bloque de la firma y no se mete en los bloques de la firma ni de «Por subsanar»', () => {
    assert.ok(B.length > 1500, 'no encontré el bloque');
    const firma = REGLAS.indexOf('// Firma de ODT Afinia (diseño W-11');
    const obs = REGLAS.indexOf('// Por subsanar · ODT Afinia');
    const resto = REGLAS.indexOf('// ── Resto: cerrado por defecto ──');
    assert.ok(ini < firma && firma < obs && obs < resto);
    assert.ok(!REGLAS.slice(firma, resto).includes('odt_afinia_cortes'), 'nada de los cortes en los otros dos bloques');
    assert.equal((REGLAS.match(/match \/odt_afinia_cortes\/\{id\}/g) || []).length, 1);
  });
  test('crear: solo un admin con perfil; update y delete prohibidos SIEMPRE; leer: solo admin con perfil', () => {
    const allows = [...sc.matchAll(/allow\s+([\w, ]+):\s*if\s+([\s\S]*?);/g)].map((m) => [m[1].trim(), m[2].replace(/\s+/g, ' ').trim()]);
    assert.deepEqual(allows, [
      ['get', 'hasProfile() && isAdmin()'],
      ['list', 'request.query.limit <= 50 && hasProfile() && isAdmin()'],
      ['create', 'odtIndCorte(id)'],
      ['update, delete', 'false'],
      ['get', 'hasProfile() && isAdmin()'],
      ['list', 'request.query.limit <= 60 && hasProfile() && isAdmin()'],
      ['create', 'odtIndParte(id, k)'],
      ['update, delete', 'false']
    ]);
    for (const f of ['odtIndCorte', 'odtIndParte']) {
      const cuerpo = new RegExp('function ' + f + '\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\}').exec(sc)[1];
      assert.match(cuerpo, /return hasProfile\(\) && isAdmin\(\)/, f);
    }
  });
  /** El cuerpo de una función del bloque (sin comentarios). */
  const cuerpo = (f) => {
    const m = new RegExp('function ' + f + '\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\}').exec(sc);
    assert.ok(m, 'no encontré la función ' + f);
    return m[1];
  };
  /** Las listas de cada hasOnly([…]) de un texto. */
  const hasOnly = (t) => [...t.matchAll(/hasOnly\(\[([^\]]*)\]\)/g)].map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  /** El patrón de `<algo>.matches('…')` como RegExp de JS (en la regla, «\\» es una barra). */
  const patron = (t, antes) => {
    const i = t.indexOf(antes + ".matches('");
    assert.ok(i >= 0, 'no encontré ' + antes + '.matches');
    const ini2 = i + antes.length + 10;
    return new RegExp(t.slice(ini2, t.indexOf("')", ini2)).replace(/\\\\/g, '\\'));
  };
  /** El plan de un corte mínimo, armado con el código de la página (lo que la regla debe aceptar). */
  async function planMinimo() {
    const { planCorte } = await import('../assets/js/data/odt_afinia_cortes_lotes.js');
    const D = await import('../assets/js/domain/odt_afinia_indicadores.js');
    const o = { nro: '90000001', empresa: 'CONTRATISTA FICTICIO', tipo: 'TIPO FICTICIO', zona: 'ZONA FICTICIA', subestacion: 'S/E FICTICIA',
      prevista: '2026-03-15', cerrada: '', estado: 'GENERADA', principal: true };
    return planCorte({
      id: 'A'.repeat(20), archivo: { nombre: 'INFORME_ODT_20260101000000_prueba.csv', bytes: 10, sha256: 'ab'.repeat(32) },
      lectura: { filas: 1, odtsArchivo: 1 }, analisis: { responsable: 'RESPONSABLE FICTICIO', odts: [o], filasResponsable: 1, ...D.agregar([o]) },
      por: { uid: 'u', nombre: 'n' }, ts: 'TS'
    });
  }
  test('forma exacta: las claves de la regla (hasOnly + size) son las que escribe planCorte (corte de 17, grupo, mes, parte y ODT)', async () => {
    const p = await planMinimo();
    const { CLAVES } = await import('../assets/js/domain/odt_afinia_indicadores.js');
    const iguales = (regla, js, que) => assert.deepEqual([...regla].sort(), [...js].sort(), que);
    const c = cuerpo('odtIndCorte');
    assert.equal(Object.keys(p.corte).length, 17);
    iguales(hasOnly(c)[0], Object.keys(p.corte), 'campos del corte');
    assert.ok(c.includes('d.size() == ' + Object.keys(p.corte).length));
    const g = cuerpo('odtIndGrupos');
    iguales(hasOnly(g)[0], Object.keys(p.corte.porEmpresa[0]), 'un contratista, tipo o zona');
    assert.ok(g.includes('l[0].size() == ' + Object.keys(p.corte.porEmpresa[0]).length));
    const m = cuerpo('odtIndMeses');
    iguales(hasOnly(m)[0], Object.keys(p.corte.porMes[0]), 'un mes');
    assert.ok(m.includes('l[0].size() == ' + Object.keys(p.corte.porMes[0]).length));
    const o = cuerpo('odtIndOdt');
    iguales(hasOnly(o)[0], Object.keys(p.partes[0].odts[0]), 'una ODT');
    assert.ok(o.includes('o.size() == ' + Object.keys(p.partes[0].odts[0]).length));
    // La ODT de la versión que se crea (la 2: con azt y jefe), la misma del armado del lote.
    const { CAMPOS_ODT_POR_VERSION } = await import('../assets/js/data/odt_afinia_cortes_lotes.js');
    iguales(hasOnly(o)[0], CAMPOS_ODT_POR_VERSION[VERSION_CORTE], 'una ODT de la versión ' + VERSION_CORTE);
    assert.equal(VERSION_CORTE, 2);
    iguales(hasOnly(cuerpo('odtIndParte'))[0], Object.keys(p.operaciones[1].datos), 'una parte');
    const t = cuerpo('odtIndTotales');
    assert.ok(t.includes('t.size() == ' + CLAVES.length));
    for (const k of CLAVES) assert.ok(t.includes('t.' + k), 'totales.' + k);
    // Cada lista se revisa (lista, tamaño máximo, PRIMER elemento) y las cuatro van en el corte.
    assert.ok(c.includes('odtIndGrupos(d.porEmpresa) && odtIndGrupos(d.porTipo) && odtIndGrupos(d.porZona) && odtIndMeses(d.porMes)'));
    assert.match(cuerpo('odtIndParte'), /odtIndOdt\(d\.odts\[0\]\)/);
  });
  test('textos, números y topes iguales a los del dominio (los patrones de la regla, probados contra el dominio)', async () => {
    const { esFechaDatos, esIso } = await import('../assets/js/domain/odt_afinia_indicadores.js');
    const c = cuerpo('odtIndCorte');
    const T = TOPES_CORTE;
    const resp = patron(c, 'd.responsable');
    for (const [s, ok] of [['R'.repeat(T.responsableMin), true], ['R'.repeat(T.responsableMin - 1), false], ['R'.repeat(T.responsableMax), true],
      ['R'.repeat(T.responsableMax + 1), false], [' RESPONSABLE', false], ['RESPONSABLE ', false], ['UNO DOS', true]]) assert.equal(resp.test(s), ok, 'responsable ' + s.length);
    const nombre = patron(c, 'd.archivo.nombre');
    assert.ok(nombre.test('x') && nombre.test('x'.repeat(T.archivoNombreMax)) && !nombre.test('') && !nombre.test('x'.repeat(T.archivoNombreMax + 1)));
    const fd = patron(c, 'd.fechaDatos');
    for (const s of ['2026-11-20T08:00:00', '2026-12-31T23:59:59', '2026-11-20 08:00:00', '2026-13-01T00:00:00', '2026-11-20T24:00:00', '2026-11-20', '2026-11-20T08:00:00Z']) {
      assert.equal(fd.test(s), esFechaDatos(s), 'fechaDatos ' + s);
    }
    const iso = patron(cuerpo('odtIndIso'), 'f');
    for (const s of ['2026-01-05', '2026-02-31', '2026-13-01', '2026-1-05', '05/01/2026', '']) assert.equal(iso.test(s), esIso(s), 'fecha ' + s);
    const clave = patron(cuerpo('odtIndGrupos'), 'l[0].clave');
    assert.ok(clave.test('x'.repeat(T.textoMax)) && !clave.test('x'.repeat(T.textoMax + 1)) && !clave.test(''));
    const nro = patron(cuerpo('odtIndOdt'), 'o.nro');
    assert.ok(nro.test('9'.repeat(T.nroMax)) && !nro.test('9'.repeat(T.nroMax + 1)) && !nro.test(''));
    // Versión 2: el AZT en sitio y el jefe de trabajo, textos de 0 al tope de los textos del dominio.
    for (const campo of ['o.azt', 'o.jefe']) {
      const p = patron(cuerpo('odtIndOdt'), campo);
      assert.ok(p.test('') && p.test('x'.repeat(T.textoMax)) && !p.test('x'.repeat(T.textoMax + 1)), campo);
    }
    const k = patron(cuerpo('odtIndParte'), 'k');
    for (let i = 0; i < T.partesMax; i++) assert.ok(k.test(String(i)), 'parte ' + i);
    for (const s of [String(T.partesMax), '00', '-1', 'x', '']) assert.ok(!k.test(s), 'parte ' + s);
    for (const x of ["d.archivo.sha256.matches('^[0-9a-f]{64}$')", 'odtIndEntero(d.archivo.bytes, 1, ' + T.archivoBytesMax + ')',
      'd.filasArchivo <= ' + T.filasMax, 'odtIndEntero(d.nPartes, 1, ' + T.partesMax + ')',
      '(d.nPartes - 1) * ' + T.porParte + ' < d.odts && d.odts <= d.nPartes * ' + T.porParte,
      'd.version == ' + VERSION_CORTE, "d.creadoPor == {'uid': request.auth.uid, 'nombre': profile().get('nombre', '')}", 'd.creadoEn == request.time',
      "id.matches('^[A-Za-z0-9]{20}$')"]) assert.ok(c.includes(x), x);
    assert.ok(cuerpo('odtIndGrupos').includes('l is list && l.size() <= ' + T.listasMax));
    assert.ok(cuerpo('odtIndMeses').includes('l is list && l.size() <= ' + T.mesesMax));
    assert.ok(cuerpo('odtIndParte').includes('d.odts.size() == (int(k) < c.nPartes - 1 ? ' + T.porParte + ' : c.odts - (c.nPartes - 1) * ' + T.porParte + ')'));
    for (const x of ['request.query.limit <= ' + T.listado, 'request.query.limit <= ' + T.partesMax, 'match /' + COL_CORTES.cortes + '/{id}',
      'match /' + COL_CORTES.partes + '/{k}']) assert.ok(B.includes(x), x);
  });
  test('partes en CADENA, solo en el lote que crea el corte: cada parte exige la anterior y el corte la última', () => {
    const p = cuerpo('odtIndParte');
    for (const x of ['!exists(odtIndRuta(id))', 'int(k) < c.nPartes', '(int(k) == 0 || existsAfter(odtIndRutaParte(id, string(int(k) - 1))))',
      'getAfter(odtIndRuta(id)).data', 'd.k == int(k)']) assert.ok(p.includes(x), x);
    assert.ok(cuerpo('odtIndCorte').includes('existsAfter(odtIndRutaParte(id, string(d.nPartes - 1)))'));
  });
  test('lecturas de documentos: solo sus cortes y el perfil propio (y /admins del arranque); pocas por operación y por lote', () => {
    // Llamadas get/exists/getAfter/existsAfter con sus paréntesis anidados (se recorren a mano).
    const llamadas = [];
    for (const m of sc.matchAll(/(?<![.\w])(get|exists|getAfter|existsAfter)\(/g)) {
      let i = m.index + m[0].length; let nivel = 1;
      while (nivel && i < sc.length) { if (sc[i] === '(') nivel++; else if (sc[i] === ')') nivel--; i++; }
      llamadas.push(m[1] + '(' + sc.slice(m.index + m[0].length, i - 1).replace(/\s+/g, '') + ')');
    }
    assert.deepEqual([...new Set(llamadas)].sort(), ['exists(odtIndRuta(id))', 'existsAfter(odtIndRutaParte(id,string(d.nPartes-1)))',
      'existsAfter(odtIndRutaParte(id,string(int(k)-1)))', 'getAfter(odtIndRuta(id))'].sort());
    // Con las del perfil (hasProfile: exists usuarios; isAdmin/profile: get usuarios; arranque: exists admins), el peor caso
    // por texto: guardar el corte 3 + 1, cada parte 3 + 3 (tope: 10 por operación). En el lote, los existsAfter/getAfter a
    // documentos del MISMO lote no cuentan para el tope de 20 (medido en el emulador: una cadena de 61 entra); fuera del
    // lote solo se leen el perfil, /admins (sin perfil) y el corte antes del lote: 3 como mucho, tenga las partes que tenga.
    const perfil = 3;
    const enCorte = llamadas.filter((x) => cuerpo('odtIndCorte').replace(/\s+/g, '').includes(x.replace(/\s+/g, ''))).length;
    const enParte = llamadas.filter((x) => cuerpo('odtIndParte').replace(/\s+/g, '').includes(x.replace(/\s+/g, ''))).length;
    assert.equal(enCorte, 1); assert.equal(enParte, 3);
    assert.ok(perfil + enCorte <= 10 && perfil + enParte <= 10 && perfil + 1 + 1 <= 20);
    for (const f of ['odtIndRutaParte', 'odtIndRuta']) assert.match(sc, new RegExp('function ' + f + '\\([^)]*\\) \\{ return /databases/\\$\\(database\\)/documents/odt_afinia_cortes/'));
    // Solo funciones globales de sesión/rol y las suyas (prefijo odtInd), ninguna del bloque de la firma.
    const usadas = new Set([...sc.matchAll(/\b(odt[A-Za-z]+|isAdmin|hasProfile|profile|isTeamMember)\(/g)].map((m) => m[1]));
    for (const u of usadas) assert.ok(/^odtInd/.test(u) || ['isAdmin', 'hasProfile', 'profile'].includes(u), 'usa ' + u);
  });
  test('presupuesto de 1000 expresiones: el bloque lo explica y la prueba de reglas lo vigila (≥ 30 % libre)', () => {
    for (const x of ['PRESUPUESTO', '1000 expresiones', 'PRIMER', 'planCorte', 'unirPartes']) assert.ok(B.includes(x), x);
    const pr = leer('tests-rules/odt_afinia_cortes.rules.test.js');
    assert.match(pr, /describe\('presupuesto/);
    assert.match(pr, /Math\.ceil\(cap \* 0\.3\)/);
    assert.match(pr, /'tope', 'control: el relleno entero en el corte/);
  });
  test('textos en NFC, sin correos ni apellidos del equipo', () => {
    assert.equal(B, B.normalize('NFC'));
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(B));
    const fuente = /const SOSPECHOSO = \/\(([^)]*)\)\/i;/.exec(leer('scripts/guardia-firmas.mjs'));
    const GENERICAS = new Set(['firma', 'signature', '\\bsign', 'firmas-equipo']);
    const apellidos = fuente ? fuente[1].split('|').filter((x) => !GENERICAS.has(x)) : [];
    assert.ok(apellidos.length >= 4);
    const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const a of apellidos) assert.ok(!sinTildes(B).includes(a), a);
  });
  test('índices: el compuesto del corte anterior (responsable ↑ · fechaDatos ↓ · creadoEn ↓) es el de las consultas del repositorio; partes.odts sin índice', () => {
    const IDX = leer('firestore.indexes.json');
    const J = JSON.parse(IDX);
    assert.deepEqual(J.indexes.filter((x) => x.collectionGroup === COL_CORTES.cortes), [{
      collectionGroup: COL_CORTES.cortes, queryScope: 'COLLECTION',
      fields: [{ fieldPath: 'responsable', order: 'ASCENDING' }, { fieldPath: 'fechaDatos', order: 'DESCENDING' }, { fieldPath: 'creadoEn', order: 'DESCENDING' }]
    }], 'un solo compuesto para los cortes');
    // anterior y ultimoDe: igualdad en responsable + orden por fechaDatos y creadoEn (descendente) → ese índice.
    const repo = codigo(leer('assets/js/data/odt_afinia_cortes.js'));
    assert.match(repo, /F\.where\('responsable', '==', corte\.responsable\), F\.where\('fechaDatos', '<=', fd\),\s*F\.orderBy\('fechaDatos', 'desc'\), F\.orderBy\('creadoEn', 'desc'\), F\.limit\(lim\)/);
    assert.match(repo, /F\.where\('responsable', '==', r0\),\s*F\.orderBy\('fechaDatos', 'desc'\), F\.orderBy\('creadoEn', 'desc'\), F\.limit\(1\)/);
    // Las demás consultas son de UN campo (índice automático): listar (creadoEn), porHuella (archivo.sha256) y el estado
    // en SGM (nro, en la firma y en «Por subsanar»). Ninguna exención les quita ese índice.
    assert.match(repo, /F\.orderBy\('creadoEn', 'desc'\), F\.limit\(TOPES_CORTE\.listado\)/);
    assert.match(repo, /F\.where\('archivo\.sha256', '==', sha256\), F\.limit\(20\)/);
    assert.match(repo, /F\.where\('nro', 'in', trozo\), F\.limit\(SGM_LIMITE\)/);
    for (const [cg, campo] of [[COL_CORTES.cortes, 'responsable'], [COL_CORTES.cortes, 'fechaDatos'], [COL_CORTES.cortes, 'creadoEn'],
      [COL_CORTES.cortes, 'archivo.sha256'], [COL_CORTES.cortes, 'archivo'], ['odt_afinia', 'nro'], ['odt_afinia_obs', 'nro']]) {
      assert.ok(!J.fieldOverrides.some((x) => x.collectionGroup === cg && x.fieldPath === campo), 'exención que estorba: ' + cg + '.' + campo);
    }
    const fo = J.fieldOverrides;
    assert.ok(fo.some((x) => x.collectionGroup === 'partes' && x.fieldPath === 'odts' && Array.isArray(x.indexes) && x.indexes.length === 0));
    assert.match(IDX, /\n {4}\{ "collectionGroup": "partes", "fieldPath": "odts", "indexes": \[\] \},\n/);
  });
});

describe('repo público: cero datos reales en lo nuevo', () => {
  const fuente = /const SOSPECHOSO = \/\(([^)]*)\)\/i;/.exec(leer('scripts/guardia-firmas.mjs'));
  const GENERICAS = new Set(['firma', 'signature', '\\bsign', 'firmas-equipo']);
  const apellidos = fuente ? fuente[1].split('|').filter((x) => !GENERICAS.has(x)) : [];
  const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const todos = [...NUEVOS, ...PRUEBAS, CSS_NUEVO].map((p) => [p, leer(p)]);
  test('sin apellidos del equipo ni correos reales (solo dominios de prueba)', () => {
    assert.ok(apellidos.length >= 4);
    for (const [p, t] of todos) {
      for (const a of apellidos) assert.ok(!sinTildes(t).includes(a), p + ': ' + a);
      for (const m of t.matchAll(/[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) assert.ok(/(^|\.)prueba\.test$/.test(m[1]), p + ': correo ' + m[0]);
    }
  });
  test('en el código, ningún N.º de 8 dígitos; en las pruebas, solo N.º inventados (empiezan por 9)', () => {
    for (const p of NUEVOS) assert.ok(!/(?<![\d.])\d{8}(?![\d.])/.test(codigo(FUENTE[p]).replace(/209715200|2000000/g, '')), p);
    for (const p of PRUEBAS) {
      for (const m of leer(p).matchAll(/(?<![\w.])(\d{8})(?![\w.])/g)) assert.ok(m[1].startsWith('9') || /^2026\d{4}$/.test(m[1]), p + ': ' + m[1]);
    }
  });
});
