// Firestore SIMULADO en memoria para el banco local (scripts/banco/server.mjs). Imita lo que importa:
//  · sin orderBy, los resultados salen por id ascendente (como Firestore); campos con punto al leer («orden_es.clave»);
//  · las listas de delegaciones y registros exigen limit <= 50 y where custodio == sesión (como las reglas);
//  · writeBatch atómico; serverTimestamp → marca con toDate() y toMillis(); arrayUnion y arrayRemove;
//  · updateDoc con rutas («a.b» o FieldPath), y error si el documento no existe; setDoc con merge, superficial;
//  · tiempo real: onSnapshot vuelve a llamar a sus oyentes tras cada escritura.
// Un iframe de la misma página comparte el almacén y los oyentes del padre (L-131: sembrar SOLO en el padre).
// ?caida=<colección> la tumba (window.__caida); window.__falloEscritura = true niega las escrituras.
// Debe exportar TODO nombre que el sitio importe de firebase-firestore.js: lo vigila tests/banco_canonico.test.js.
const delPadre = (k) => { try { return window.parent !== window ? window.parent[k] : null; } catch (e) { return null; } };
const S = (window.__store = window.__store || delPadre('__store') || new Map());
const OY = (window.__oyentes = window.__oyentes || delPadre('__oyentes') || []);
window.__consultas = window.__consultas || [];
window.__escrituras = window.__escrituras || [];
const NOMBRE = '__name__';
const auto = () => { let s = ''; const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789'; for (let i = 0; i < 20; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const uid = () => (window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid) || null;
const fallar = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const denegar = () => fallar('permission-denied', 'Missing or insufficient permissions.');
export const ts = (d) => ({ toDate: () => new Date(d), toMillis: () => new Date(d).getTime(), _ms: new Date(d).getTime() });
const campo = (x, f) => String(f).split('.').reduce((o, k) => (o == null ? undefined : o[k]), x);
let avisoPend = null;
function notificar() {
  if (avisoPend) return;
  avisoPend = setTimeout(() => { avisoPend = null; for (const o of OY.slice()) { try { o(); } catch (e) { /* iframe cerrado */ } } }, 60);
}

export function getFirestore() { return { banco: true }; }
export function initializeFirestore() { return { banco: true }; }
export function collection(_db, ...seg) { return { col: true, path: seg.join('/') }; }
export function doc(a, ...seg) {
  if (a && a.col) { const id = seg[0] || auto(); return { path: a.path + '/' + id, id }; }
  const p = seg.join('/'); return { path: p, id: seg[seg.length - 1] };
}
export function serverTimestamp() { return '__TS__'; }
export function documentId() { return NOMBRE; }
export function arrayUnion(...v) { return { __op: 'union', v }; }
export function arrayRemove(...v) { return { __op: 'remove', v }; }
export class FieldPath { constructor(...seg) { this.seg = seg; } }
export function where(f, op, v) { return { t: 'where', f, op, v }; }
export function orderBy(f, dir = 'asc') { return { t: 'orderBy', f, dir }; }
export function limit(n) { return { t: 'limit', n }; }
export function startAfter(snap) { return { t: 'startAfter', snap }; }
export function query(col, ...cs) { return { col: col.path, cs }; }

const snapDe = (path, x) => ({ id: path.split('/').pop(), ref: { path, id: path.split('/').pop() }, exists: () => x !== undefined, data: () => x });
export async function getDoc(ref) { return snapDe(ref.path, S.get(ref.path)); }

const PROTEGIDAS = ['firmas_delegados', 'firmas_delegados_registro', 'firmas_delegados_fichas', 'firmas_delegados_fichas_registro'];
export async function getDocs(q) {
  if (q.col && !q.cs) q = { col: q.path, cs: [] };
  const cs = q.cs;
  const lim = cs.find((c) => c.t === 'limit');
  const ws = cs.filter((c) => c.t === 'where');
  if (PROTEGIDAS.includes(q.col)) {
    // Como las reglas: sin tope ≤ 50 o sin «custodio == yo», se niega la lista entera.
    if (!lim || lim.n > 50 || !ws.some((w) => w.f === 'custodio' && w.op === '==' && w.v === uid())) denegar();
  }
  window.__consultas.push({ col: q.col, cs: cs.map((c) => c.t + (c.t === 'limit' ? c.n : c.t === 'where' ? ':' + c.f : c.t === 'orderBy' ? ':' + c.f : '')) });
  if (window.__caida && window.__caida === q.col) fallar('unavailable', 'unavailable');
  let filas = [...S.entries()].filter(([p]) => p.startsWith(q.col + '/') && !p.slice(q.col.length + 1).includes('/'))
    .map(([p, x]) => ({ id: p.split('/').pop(), x }));
  const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b,
    'in': (a, b) => Array.isArray(b) && b.includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b) };
  const val = (r, f) => { if (f === NOMBRE) return r.id; const v = campo(r.x, f); return v && v._ms !== undefined ? v._ms : v; };
  for (const w of ws) filas = filas.filter((r) => OPS[w.op] && val(r, w.f) !== undefined && OPS[w.op](val(r, w.f), w.v && w.v._ms !== undefined ? w.v._ms : w.v));
  const ob = cs.find((c) => c.t === 'orderBy');
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  filas.sort((a, b) => {
    if (ob && ob.f !== NOMBRE) { const c = cmp(val(a, ob.f), val(b, ob.f)); if (c) return ob.dir === 'desc' ? -c : c; }
    return cmp(a.id, b.id) * (ob && ob.f === NOMBRE && ob.dir === 'desc' ? -1 : 1);
  });
  const sa = cs.find((c) => c.t === 'startAfter');
  if (sa) { const i = filas.findIndex((r) => r.id === sa.snap.id); filas = filas.slice(i + 1); }
  if (lim) filas = filas.slice(0, lim.n);
  const docs = filas.map((r) => snapDe(q.col + '/' + r.id, r.x));
  return { size: docs.length, docs, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
}

// Lo que se escribe: la marca del servidor y las uniones o quitas de arreglos (comparadas por valor).
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function valor(prev, v, ahora) {
  if (v === '__TS__') return ahora;
  if (v && v.__op === 'union') { const a = Array.isArray(prev) ? prev.slice() : []; for (const x of v.v) if (!a.some((y) => igual(x, y))) a.push(x); return a; }
  if (v && v.__op === 'remove') return (Array.isArray(prev) ? prev : []).filter((y) => !v.v.some((x) => igual(x, y)));
  return v;
}
function escribir(path, datos, opts) {
  const ahora = ts(Date.now());
  const prev = (opts && opts.merge) ? (S.get(path) || {}) : {};
  const nuevo = Object.assign({}, prev);
  for (const [k, v] of Object.entries(datos || {})) nuevo[k] = valor(prev[k], v, ahora);
  S.set(path, nuevo);
  window.__escrituras.push('set ' + path);
}
// updateDoc(ref, {…}) o updateDoc(ref, campo, valor, campo, valor…): «a.b» y FieldPath son rutas, como en Firestore.
function pares(a, resto) {
  if (typeof a === 'string' || a instanceof FieldPath) { const l = [a, ...resto]; const out = []; for (let i = 0; i + 1 < l.length; i += 2) out.push([l[i], l[i + 1]]); return out; }
  return Object.entries(a || {});
}
function actualizar(path, lista) {
  if (!S.has(path)) fallar('not-found', 'No document to update: ' + path);
  const ahora = ts(Date.now());
  const x = Object.assign({}, S.get(path));
  for (const [ruta, v] of lista) {
    const seg = ruta instanceof FieldPath ? ruta.seg : String(ruta).split('.');
    let o = x;
    for (const k of seg.slice(0, -1)) { o[k] = (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? Object.assign({}, o[k]) : {}; o = o[k]; }
    const ult = seg[seg.length - 1];
    o[ult] = valor(o[ult], v, ahora);
  }
  S.set(path, x);
  window.__escrituras.push('update ' + path);
}
function borrar(path) { S.delete(path); window.__escrituras.push('delete ' + path); }

export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, datos, opts) { ops.push(() => escribir(ref.path, datos, opts)); return b; },
    update(ref, a, ...resto) { const l = pares(a, resto); ops.push(() => actualizar(ref.path, l)); return b; },
    delete(ref) { ops.push(() => borrar(ref.path)); return b; },
    async commit() {
      if (window.__falloEscritura) denegar();
      const antes = new Map(S);
      try { for (const op of ops) op(); } catch (e) { S.clear(); for (const [k, v] of antes) S.set(k, v); throw e; }   // atómico
      notificar();
    }
  };
  return b;
}
export async function setDoc(ref, datos, opts) { if (window.__falloEscritura) denegar(); escribir(ref.path, datos, opts); notificar(); }
export async function updateDoc(ref, a, ...resto) { if (window.__falloEscritura) denegar(); actualizar(ref.path, pares(a, resto)); notificar(); }
export async function addDoc(col, datos) { const r = doc(col); await setDoc(r, datos); return r; }
export async function deleteDoc(ref) { if (window.__falloEscritura) denegar(); borrar(ref.path); notificar(); }
export async function getCountFromServer(q) { const r = await getDocs(q); return { data: () => ({ count: r.size }) }; }
export function onSnapshot(q, ok, err) {
  const sig = typeof ok === 'object' && ok ? ok.next : ok;
  const mal = typeof ok === 'object' && ok ? ok.error : err;
  const leer = () => { const p = (q && q.path && !q.col && !q.cs) ? getDoc(q) : getDocs(q); p.then(sig, mal || (() => {})); };
  leer();
  OY.push(leer);
  return () => { const i = OY.indexOf(leer); if (i >= 0) OY.splice(i, 1); };
}
export const Bytes = { fromUint8Array: (u) => ({ toUint8Array: () => u }) };
export async function runTransaction(_db, fn) {
  const ops = [];
  const tx = {
    get: async (ref) => getDoc(ref),
    set: (ref, d, o) => { ops.push(() => escribir(ref.path, d, o)); return tx; },
    update: (ref, a, ...resto) => { const l = pares(a, resto); ops.push(() => actualizar(ref.path, l)); return tx; },
    delete: (ref) => { ops.push(() => borrar(ref.path)); return tx; }
  };
  const r = await fn(tx);
  if (window.__falloEscritura) denegar();
  const antes = new Map(S);
  try { for (const op of ops) op(); } catch (e) { S.clear(); for (const [k, v] of antes) S.set(k, v); throw e; }
  notificar();
  return r;
}
