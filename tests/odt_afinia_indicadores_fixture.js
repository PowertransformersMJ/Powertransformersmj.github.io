// Firma de ODT Afinia · INDICADORES · FIXTURE para las pruebas (no es una prueba).
// Arma un CSV con la FORMA del «Informe Seguimiento de Órdenes de Trabajo» de Afinia (los 48 encabezados, «|», sin
// comillas, CRLF, latin-1) y datos 100 % INVENTADOS: personas, contratistas, zonas, subestaciones y N.º de ODT
// ficticios (repo público). Nada de aquí sale de un archivo real.
import { ENCABEZADOS_AFINIA } from '../assets/js/domain/odt_afinia_indicadores.js';

export const RESP_A = 'PERSONA FICTICIA UNO';               // como lo trae el CSV: mayúsculas, sin tildes
export const RESP_A_PERFIL = 'Persona  Fictícia Úno';        // como lo tendría un perfil de SGM: tildes y espacios
export const RESP_B = 'OTRA PERSONA INVENTADA';
export const ALFA = 'CONTRATISTA ALFA S.A.S.';
export const BETA = 'CONSORCIO BETA';
export const GAMMA = 'UNION TEMPORAL GAMMA - DELTA';

/** Una fila de 48 campos: valores por defecto y lo que se pida por encabezado. */
export function fila(campos = {}) {
  const base = {
    ITEM: '1', 'NRO. ODT': '90000001', 'ODT PRINCIPAL': 'SI', EMPRESA: ALFA, 'TIPO DE TRABAJO': 'MANTENIMIENTO DE PRUEBA',
    'FECHA Y HORA PREVISTA DE INICIO': '15/03/2026 07:00', 'FECHA Y HORA PREVISTA DE FIN': '15/03/2026 17:00',
    ZONA: 'ZONA NORTE', DEPARTAMENTO: 'DEPARTAMENTO FICTICIO', MUNICIPIO: 'MUNICIPIO FICTICIO', SUBESTACION: 'S/E PRUEBA UNO',
    'ELEMENTO / BAHÍA / LN': 'BAHÍA DE PRUEBA', EQUIPO: 'EQUIPO DE PRUEBA', 'LUGAR DE TRABAJO': 'PATIO',
    'DESCRIPCIÓN DE LA PLANIFICACIÓN DEL TRABAJO / DAÑO': 'Revisión de prueba', OBSERVACIONES: 'Sin novedad',
    'RESPONSABLE O.D.T.': RESP_A, 'FECHA ODT CERRADA': '', 'ESTADO FINAL DE LA ODT': 'GENERADA', 'FUENTE DE ORIGEN': 'FUENTE FICTICIA'
  };
  const v = { ...base, ...campos };
  return ENCABEZADOS_AFINIA.map((h) => (v[h] == null ? '' : String(v[h])));
}
/** Atajo: una ODT con N.º, contratista, estado y fechas. */
export function odt(nro, { empresa = ALFA, estado = 'GENERADA', prevista = '15/03/2026 07:00', cerrada = '', resp = RESP_A, tipo, zona, sub, extra = {} } = {}) {
  return fila({
    'NRO. ODT': nro, EMPRESA: empresa, 'ESTADO FINAL DE LA ODT': estado, 'FECHA Y HORA PREVISTA DE INICIO': prevista,
    'FECHA ODT CERRADA': cerrada, 'RESPONSABLE O.D.T.': resp,
    ...(tipo ? { 'TIPO DE TRABAJO': tipo } : {}), ...(zona ? { ZONA: zona } : {}), ...(sub ? { SUBESTACION: sub } : {}), ...extra
  });
}
/** El texto del CSV: encabezados + filas (arreglos o líneas ya armadas), con su fin de línea. */
export function csv(filas, { encabezados = ENCABEZADOS_AFINIA, eol = '\r\n', final = true } = {}) {
  const lineas = [encabezados.join('|'), ...filas.map((f) => (Array.isArray(f) ? f.join('|') : f))];
  return lineas.join(eol) + (final ? eol : '');
}
/** Texto → bytes ISO-8859-1 (cada carácter ≤ U+00FF en un byte), como los entrega Afinia. */
export function latin1(texto) {
  const u = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c > 255) throw new Error('carácter fuera de latin-1 en el fixture');
    u[i] = c;
  }
  return u;
}

/**
 * El doble de Firestore de tests/odt_afinia_ui_dobles.js, con las CONSULTAS que usa el repositorio de cortes y que ese
 * doble no evalúa: where (==, <, <=, >, >=, in, array-contains; también campos anidados «archivo.sha256») y varios
 * orderBy (textos, números o marcas de tiempo), como el SDK. Cambia solo cómo responde ESTE doble (no el archivo común).
 * @param {{F:object, store:Map, consultas:object[]}} fs  lo que devuelve crearFirestoreFalso()
 */
export function conConsultas(fs) {
  const valor = (d, campo) => String(campo).split('.').reduce((o, k) => (o == null ? undefined : o[k]), d);
  const plano = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v);
  const OPS = {
    '==': (a, b) => a === b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    in: (a, b) => Array.isArray(b) && b.includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b)
  };
  fs.F._ejecutar = (q) => {
    fs.consultas.push(q);
    const pref = q.col + '/';
    let docs = [...fs.store.keys()].filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes('/'))
      .map((k) => ({ id: k.slice(pref.length), data: () => fs.store.get(k), _d: fs.store.get(k) }));
    const ordenes = []; let lim = Infinity;
    for (const f of q.filtros) {
      if (f.t === 'where') {
        const op = OPS[f.opr];
        if (!op) throw new Error('operador no previsto en el doble: ' + f.opr);
        docs = docs.filter((x) => { const v = valor(x._d, f.campo); return v !== undefined && op(plano(v), Array.isArray(f.valor) ? f.valor : plano(f.valor)); });
      }
      if (f.t === 'orderBy') ordenes.push(f);
      if (f.t === 'limit') lim = f.n;
    }
    if (ordenes.length) {
      docs.sort((a, b) => {
        for (const o of ordenes) {
          const x = plano(valor(a._d, o.campo)); const y = plano(valor(b._d, o.campo));
          if (x === y) continue;
          const c = x < y ? -1 : 1;
          return o.dir === 'desc' ? -c : c;
        }
        return 0;
      });
    }
    docs = docs.slice(0, lim);
    return { docs, size: docs.length, empty: !docs.length };
  };
  return fs;
}

/**
 * Un archivo de prueba con dos responsables y tres contratistas:
 *   RESP_A: 9 filas → 8 ODT (la 90000002 viene dos veces, con el mismo estado).
 *     ALFA: 90000001 GENERADA · 90000002 CERRADA (×2) · 90000003 EJECUTADA · 90000004 CERRADA
 *     BETA: 90000005 NO EJECUTADA · 90000006 CERRADA · 90000007 INACTIVA
 *     GAMMA: 90000008 «SUSPENDIDA» (estado que la página no conoce → Otro)
 *   RESP_B: 2 filas → 2 ODT (ALFA 90000009 CERRADA, BETA 90000010 GENERADA)
 */
export function archivoBase() {
  const filas = [
    odt('90000001', { estado: 'GENERADA', prevista: '05/01/2026 07:00', tipo: 'TIPO UNO', zona: 'ZONA NORTE' }),
    odt('90000002', { estado: 'CERRADA', prevista: '10/02/2026 08:00', cerrada: '20/03/2026 10:00', tipo: 'TIPO UNO', zona: 'ZONA SUR' }),
    odt('90000002', { estado: 'CERRADA', prevista: '11/02/2026 08:00', cerrada: '20/03/2026 10:00', tipo: 'TIPO UNO', zona: 'ZONA SUR', extra: { 'ELEMENTO / BAHÍA / LN': 'OTRA BAHÍA' } }),
    odt('90000003', { estado: 'EJECUTADA', prevista: '12/02/2026 08:00', tipo: 'TIPO DOS', zona: 'ZONA NORTE' }),
    odt('90000004', { estado: 'CERRADA', prevista: '01/03/2026 08:00', cerrada: '02/03/2026 09:00', tipo: 'TIPO DOS', zona: 'ZONA NORTE' }),
    odt('90000005', { empresa: BETA, estado: 'NO EJECUTADA', prevista: '03/03/2026 08:00', tipo: 'TIPO UNO', zona: 'ZONA SUR' }),
    odt('90000006', { empresa: BETA, estado: 'CERRADA', prevista: '04/03/2026 08:00', cerrada: '30/04/2026 08:00', tipo: 'TIPO UNO', zona: 'ZONA SUR' }),
    odt('90000007', { empresa: BETA, estado: 'INACTIVA', prevista: '05/03/2026 08:00', tipo: 'TIPO DOS', zona: 'ZONA NORTE' }),
    odt('90000008', { empresa: GAMMA, estado: 'SUSPENDIDA', prevista: '06/04/2026 08:00', tipo: 'TIPO DOS', zona: 'ZONA NORTE' }),
    odt('90000009', { resp: RESP_B, estado: 'CERRADA', prevista: '07/04/2026 08:00', cerrada: '08/04/2026 08:00' }),
    odt('90000010', { resp: RESP_B, empresa: BETA, estado: 'GENERADA', prevista: '08/04/2026 08:00' })
  ];
  return csv(filas);
}
