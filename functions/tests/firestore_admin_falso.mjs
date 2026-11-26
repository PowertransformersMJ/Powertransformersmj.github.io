// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Un Firestore del Admin SDK EN MEMORIA para las pruebas de los avisos de cumplimiento (99 §236)
// ──────────────────────────────────────────────────────────────
// Lo que usan functions/cumplimiento.mjs y functions/cumplimiento_remitente.mjs: doc (get, create, update, set con
// merge), collection (where con ==, >, <, >=, <= e «in»; orderBy, que no ordena; limit), getAll, runTransaction (get,
// getAll, create, update, set; las escrituras se aplican al final y, como el SDK, se repite si otro proceso cambió lo
// leído: corrector 99 §236) y batch (update). serverTimestamp() se
// resuelve a una marca con toMillis() que avanza un segundo cada vez. Sin red ni emulador.
// Desde el resumen de notificaciones (99 §236, 2026-11-26) también, como el SDK: «array-contains» y
// «array-contains-any»; orderBy que SÍ ordena (marcas, números o textos; sin el campo, el documento no sale) y, sin
// orderBy, el orden por id; startAfter(un documento leído); select(campos) (solo esos campos); y consultas DENTRO de
// una transacción (t.get(consulta): lo que devuelve cuenta como leído).
// Corrector ronda 1 (99 §236): como el SDK (@google-cloud/firestore, transaction.js → isRetryableTransactionError),
// si la función de la transacción LANZA un error con un código que se puede reintentar (ABORTED, UNAVAILABLE…), la
// transacción se repite; uno sin código, o con otro, sale tal cual.
// Archivo de apoyo (no es una prueba: node --test no lo corre solo).
// ══════════════════════════════════════════════════════════════

export const TS = Object.freeze({ __ts: 'serverTimestamp' });
/** Los códigos con los que el SDK repite una transacción (ABORTED, CANCELLED, UNKNOWN, DEADLINE_EXCEEDED, INTERNAL,
 *  UNAVAILABLE, UNAUTHENTICATED, RESOURCE_EXHAUSTED). */
const REINTENTABLES = new Set([10, 1, 2, 4, 13, 14, 16, 8]);
export const FieldValue = { serverTimestamp: () => TS };

export function crearAdminFalso() {
  const store = new Map();
  let reloj = Date.UTC(2026, 10, 21, 16, 0, 0);
  // La hora se fija al ESCRIBIR (como el servidor): leerla dos veces da lo mismo (corrector 99 §236, resumen).
  const marca = () => { const t = (reloj += 1000); return { toMillis: () => t }; };
  const resolver = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === TS ? marca() : v]));
  const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x.toMillis === 'function' ? { ms: x.toMillis() } : x))));
  const snap = (path) => ({ id: path.split('/').pop(), ref: { path }, exists: store.has(path), data: () => copia(store.get(path)) });
  const yaExiste = () => { const e = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; return e; };
  const noExiste = () => { const e = new Error('5 NOT_FOUND: No document to update'); e.code = 5; return e; };
  const escribir = {
    create(path, d) { if (store.has(path)) throw yaExiste(); store.set(path, resolver(d)); },
    update(path, d) { if (!store.has(path)) throw noExiste(); store.set(path, { ...store.get(path), ...resolver(d) }); },
    set(path, d, op) { store.set(path, op && op.merge ? { ...(store.get(path) || {}), ...resolver(d) } : resolver(d)); }
  };
  const docRef = (path) => ({
    path, id: path.split('/').pop(),
    get: async () => snap(path),
    create: async (d) => escribir.create(path, d),
    update: async (d) => escribir.update(path, d),
    set: async (d, op) => escribir.set(path, d, op),
    collection: (nombre) => colRef(path + '/' + nombre)
  });
  const valor = (d, campo) => String(campo).split('.').reduce((o, k) => (o == null ? undefined : o[k]), d);
  const OPS = {
    '==': (a, b) => a === b, '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, in: (a, b) => b.includes(a),
    'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
    'array-contains-any': (a, b) => Array.isArray(a) && a.some((x) => b.includes(x))
  };
  /** Un valor para ordenar: las marcas (con toMillis o ya copiadas como {ms}) por sus milisegundos. */
  const clave = (v) => (v && typeof v === 'object' ? (typeof v.toMillis === 'function' ? v.toMillis() : v.ms) : v);
  const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const consultas = [];
  const ganchos = { antesDeConfirmar: null };
  /** Corre una consulta como el SDK: filtros, orden (o por id), cursor, límite y campos. */
  function correr(path, filtros) {
    const pref = path + '/';
    let docs = [...store.keys()].filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes('/')).sort().map((k) => snap(k));
    const ordenes = filtros.filter((f) => f.t === 'orderBy');
    let lim = Infinity; let tras = null; let campos = null;
    for (const f of filtros) {
      if (f.t === 'where') docs = docs.filter((x) => { const v = valor(x.data(), f.campo); return v !== undefined && OPS[f.op](v, f.v); });
      if (f.t === 'limit') lim = f.n;
      if (f.t === 'startAfter') tras = f.snap;
      if (f.t === 'select') campos = f.campos;
    }
    for (const o of ordenes) docs = docs.filter((x) => valor(x.data(), o.campo) !== undefined);
    const llave = (x) => [...ordenes.map((o) => clave(valor(x.data(), o.campo))), x.ref.path];
    const cmp = (a, b) => {
      const ka = llave(a); const kb = llave(b);
      for (let i = 0; i < ka.length; i++) { const c = comparar(ka[i], kb[i]); if (c) return i < ordenes.length && ordenes[i].dir === 'desc' ? -c : c; }
      return 0;
    };
    docs.sort(cmp);
    if (tras) docs = docs.filter((x) => cmp(x, tras) > 0);
    docs = docs.slice(0, lim);
    if (campos) docs = docs.map((x) => ({ ...x, data: () => Object.fromEntries(campos.filter((c) => x.data()[c] !== undefined).map((c) => [c, x.data()[c]])) }));
    return { docs, empty: !docs.length, size: docs.length };
  }
  const colRef = (path, filtros = []) => ({
    esConsulta: true,
    doc: (id) => docRef(path + '/' + id),
    where: (campo, op, v) => colRef(path, [...filtros, { t: 'where', campo, op, v }]),
    orderBy: (campo, dir = 'asc') => colRef(path, [...filtros, { t: 'orderBy', campo, dir }]),
    limit: (n) => colRef(path, [...filtros, { t: 'limit', n }]),
    startAfter: (s) => colRef(path, [...filtros, { t: 'startAfter', snap: s }]),
    select: (...campos) => colRef(path, [...filtros, { t: 'select', campos }]),
    async get() {
      consultas.push({ col: path, filtros });
      return correr(path, filtros);
    },
    _correr: () => { consultas.push({ col: path, filtros, enTransaccion: true }); return correr(path, filtros); }
  });
  const db = {
    collection: (nombre) => colRef(nombre),
    doc: (path) => docRef(path),
    async getAll(...refs) { return refs.map((r) => snap(r.path)); },
    /**
     * Como el SDK: si algo de lo leído cambió antes de confirmar (otro proceso escribió), se repite `fn` (hasta 5
     * veces). Cada escritura deja un objeto nuevo en `store`, así que «cambió» = no es el mismo objeto.
     * ganchos.antesDeConfirmar (pruebas): corre justo antes de confirmar, para meter la escritura de otro proceso.
     */
    async runTransaction(fn) {
      let ultimoError = null;
      for (let intento = 0; intento < 5; intento++) {
        const pendientes = [];
        const leidos = new Map();
        const leer = (r) => { if (!leidos.has(r.path)) leidos.set(r.path, store.get(r.path)); return snap(r.path); };
        const t = {
          // Una consulta dentro de la transacción: lo que devuelve cuenta como leído (si cambia, se repite).
          get: async (r) => {
            if (!r || !r.esConsulta) return leer(r);
            const q = r._correr();
            for (const d of q.docs) if (!leidos.has(d.ref.path)) leidos.set(d.ref.path, store.get(d.ref.path));
            return q;
          },
          getAll: async (...refs) => refs.map(leer),
          create: (r, d) => { pendientes.push(() => escribir.create(r.path, d)); },
          update: (r, d) => { pendientes.push(() => escribir.update(r.path, d)); },
          set: (r, d, op) => { pendientes.push(() => escribir.set(r.path, d, op)); }
        };
        let out;
        try { out = await fn(t); } catch (e) {
          if (!e || !REINTENTABLES.has(e.code)) throw e;
          ultimoError = e;
          continue;
        }
        if (typeof ganchos.antesDeConfirmar === 'function') await ganchos.antesDeConfirmar();
        if ([...leidos].some(([path, v]) => store.get(path) !== v)) continue;
        for (const p of pendientes) p();
        return out;
      }
      if (ultimoError) throw ultimoError;
      const e = new Error('10 ABORTED: Too much contention on these documents'); e.code = 10; throw e;
    },
    batch() {
      const ops = [];
      return { update: (r, d) => { ops.push(() => escribir.update(r.path, d)); }, async commit() { for (const o of ops) o(); } };
    }
  };
  return { db, store, consultas, ganchos, leer: (path) => copia(store.get(path)) };
}
