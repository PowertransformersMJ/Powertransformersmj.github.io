// Firma de ODT Afinia · DOBLES para las pruebas de datos y pantalla (no es una prueba).
// · crearFirestoreFalso: un Firestore en memoria con la MISMA forma de llamadas que usa
//   data/odt_afinia.js (doc, collection, query, where, orderBy, limit, writeBatch,
//   getDoc[FromServer], getDocs[FromServer], setDoc, serverTimestamp, Bytes). No evalúa
//   reglas (eso lo hacen tests-rules/odt_afinia.rules.test.js en el emulador): registra
//   cada lote TAL COMO se envió para comparar su forma con el contrato de las reglas.
// · crearDomFalso: un document mínimo (createElement, textContent, eventos) para armar
//   la declaración en Node.
// Repo público: uids, correos y N.º inventados.

export const TS = Object.freeze({ __marca: 'serverTimestamp' });

/** Bytes de Firestore de mentira (guardan una COPIA, como el SDK). */
export const BytesFalso = {
  fromUint8Array(u) {
    const copia = new Uint8Array(u);
    return { _u: copia, toUint8Array() { return this._u.slice(); } };
  }
};

let _ms = Date.UTC(2026, 10, 20, 15, 0, 0);
/** Marca de tiempo del «servidor» (crece en cada escritura). */
function marca() { const t = (_ms += 1000); return { toMillis: () => t, toDate: () => new Date(t) }; }

function resolverTs(v) {
  if (v === TS) return marca();
  if (Array.isArray(v)) return v.map(resolverTs);
  if (v && typeof v === 'object' && !(v instanceof Uint8Array) && !v._u && typeof v.toMillis !== 'function') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolverTs(x)]));
  }
  return v;
}

/**
 * @param {{colgarLote?:boolean, escribirYColgar?:boolean, denegarLote?:boolean, rechazarRed?:boolean, sinRedLectura?:boolean}} [op]
 *   rechazarRed: el lote TERMINA rechazado por la red (no queda en cola)
 */
export function crearFirestoreFalso(op = {}) {
  const store = new Map();
  const lotes = [];          // [{ops:[{tipo, ruta, datos}]}] tal como se enviaron
  const consultas = [];      // [{col, filtros}]
  const opciones = { ...op };
  let n = 0;
  const db = { falso: true };
  const ref = (path) => ({ tipo: 'doc', path, id: path.split('/').pop() });
  const snap = (path) => {
    const d = store.get(path);
    return { id: path.split('/').pop(), exists: () => d !== undefined, data: () => d };
  };
  const autoId = () => ('Falso' + String(++n).padStart(15, '0'));
  const sinRed = () => { const e = new Error('sin red'); e.code = 'unavailable'; return e; };

  const F = {
    Bytes: BytesFalso,
    serverTimestamp: () => TS,
    doc(a, ...seg) {
      if (a && a.tipo === 'col') return ref(a.path + '/' + (seg[0] || autoId()));
      return ref(seg.join('/'));
    },
    collection(_db, ...seg) { return { tipo: 'col', path: seg.join('/') }; },
    where: (campo, opr, valor) => ({ t: 'where', campo, opr, valor }),
    orderBy: (campo, dir = 'asc') => ({ t: 'orderBy', campo, dir }),
    limit: (n2) => ({ t: 'limit', n: n2 }),
    query: (col, ...filtros) => ({ col: col.path, filtros }),
    async getDoc(r) { return snap(r.path); },
    async getDocFromServer(r) { if (opciones.sinRedLectura) throw sinRed(); return snap(r.path); },
    async getDocs(q) { return F._ejecutar(q); },
    async getDocsFromServer(q) { if (opciones.sinRedLectura) throw sinRed(); return F._ejecutar(q); },
    _ejecutar(q) {
      consultas.push(q);
      const pref = q.col + '/';
      let docs = [...store.keys()].filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes('/'))
        .map((k) => ({ id: k.slice(pref.length), data: () => store.get(k), _d: store.get(k) }));
      let lim = Infinity;
      for (const f of q.filtros) {
        if (f.t === 'where' && f.opr === 'array-contains') docs = docs.filter((x) => Array.isArray(x._d[f.campo]) && x._d[f.campo].includes(f.valor));
        if (f.t === 'orderBy') docs.sort((a, b) => ((a._d[f.campo] && a._d[f.campo].toMillis()) || 0) - ((b._d[f.campo] && b._d[f.campo].toMillis()) || 0) * 1);
        if (f.t === 'orderBy' && f.dir === 'desc') docs.reverse();
        if (f.t === 'limit') lim = f.n;
      }
      docs = docs.slice(0, lim);
      return { docs, size: docs.length, empty: !docs.length };
    },
    writeBatch() {
      const ops = [];
      return {
        set(r, datos) { ops.push({ tipo: 'set', ruta: r.path, datos }); },
        update(r, datos) { ops.push({ tipo: 'update', ruta: r.path, datos }); },
        commit() {
          lotes.push({ ops });
          if (opciones.denegarLote) { const e = new Error('denegado'); e.code = 'permission-denied'; return Promise.reject(e); }
          if (opciones.rechazarRed) return Promise.reject(sinRed());
          if (opciones.colgarLote) return new Promise(() => {});
          for (const o of ops) {
            if (o.tipo === 'set') store.set(o.ruta, resolverTs(o.datos));
            else store.set(o.ruta, { ...store.get(o.ruta), ...resolverTs(o.datos) });
          }
          if (opciones.escribirYColgar) return new Promise(() => {});
          return Promise.resolve();
        }
      };
    },
    async setDoc(r, datos) {
      lotes.push({ ops: [{ tipo: 'set', ruta: r.path, datos }] });
      store.set(r.path, resolverTs(datos));
    }
  };
  return { F, db, store, lotes, consultas, opciones, poner: (path, datos) => store.set(path, resolverTs(datos)) };
}

/** Claims de un token recién renovado (sintético). */
export function tokenFalso({ uid = 'uid-azt-prueba', email = 'azt@prueba.test', ahoraMs = Date.now(), ...resto } = {}) {
  return { uid, email, email_verified: true, auth_time: Math.floor(ahoraMs / 1000), sign_in_provider: 'password', ...resto };
}

// ── DOM mínimo ─────────────────────────────────────────────────────────────────
class NodoTexto {
  constructor(t) { this.nodeType = 3; this._t = String(t); this.parentNode = null; }
  get textContent() { return this._t; }
  set textContent(v) { this._t = String(v); }
}
class Elemento {
  constructor(tag) {
    this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.childNodes = []; this.parentNode = null;
    this.atributos = {}; this.dataset = {}; this.className = ''; this._esc = {};
    this.checked = false; this.disabled = false; this.value = ''; this.hidden = false; this.type = ''; this.id = '';
  }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = [new NodoTexto(v)]; }
  set innerHTML(_v) { throw new Error('innerHTML no se usa en el módulo'); }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  append(...cs) { for (const c of cs) if (c != null) this.appendChild(typeof c === 'string' ? new NodoTexto(c) : c); }
  removeChild(c) { this.childNodes = this.childNodes.filter((x) => x !== c); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return k in this.atributos ? this.atributos[k] : null; }
  removeAttribute(k) { delete this.atributos[k]; }
  addEventListener(tipo, fn) { (this._esc[tipo] = this._esc[tipo] || []).push(fn); }
  async disparar(tipo) { for (const fn of this._esc[tipo] || []) await fn({ currentTarget: this, target: this, type: tipo }); }
  /** Todos los descendientes (para buscar). */
  todos() { const out = []; for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c, ...c.todos()); } return out; }
  /** Solo selectores de una clase ('.x'). */
  querySelectorAll(sel) {
    const m = /^\.([\w-]+)$/.exec(sel);
    if (!m) throw new Error('selector no soportado en el DOM falso: ' + sel);
    return this.todos().filter((e) => String(e.className).split(/\s+/).includes(m[1]));
  }
}
export function crearDomFalso() {
  return {
    createElement: (t) => new Elemento(t),
    createTextNode: (t) => new NodoTexto(t),
    body: new Elemento('body')
  };
}
