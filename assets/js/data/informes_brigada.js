// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada (F60-ADM) · repositorio NUBE
// ──────────────────────────────────────────────────────────────
// Firestore:
//   · informes_brigada/{id}             el informe (borrador → emitido → anulado)
//   · informes_brigada/{id}/versiones/{n} cada emisión, congelada (solo se agrega)
//   · informes_brigada_config/general   editores (uid), contrato, almacén,
//                                       firmantes y marca — lo escribe un admin
//   · informes_brigada_fichas/{id}      biblioteca de fichas de fabricante
// Reglas y pruebas: firestore.rules (bloque «Informe de Mantenimiento Brigada»)
// y tests-rules/informes_brigada.rules.test.js.
//
// Concurrencia: cada escritura es una transacción que relee `rev` y exige que
// sea la que tenía la pantalla (si no, ErrorIBR 'conflicto'); la regla vuelve a
// exigir rev + 1. Emitir escribe el informe y su copia congelada en la MISMA
// transacción. Nadie borra informes.
//
// Las reglas de negocio (estados, motivos, topes) son las funciones PURAS de
// domain/informe_brigada_rutas.js: las mismas que usa el repositorio local.
// El SDK de Firestore se carga al usarlo (y se puede inyectar: así las pruebas
// del emulador ejercitan ESTE módulo contra las reglas reales).
// Este módulo se carga con import() dinámico desde la página.
// ══════════════════════════════════════════════════════════════

import {
  COL, LIMITES, ErrorIBR, errorDesdeFirebase, esSinPermiso, esIdInforme, esIdFicha, esHuella,
  normalizarConfig, configParaGuardar, esEditorDe, documentoAInforme, documentoAVersion, documentoAFicha,
  ordenarPorActualizado, resumenAccion, topeConsulta,
  planCrear, planGuardar, planCorregir, planEmitir, planAnular
} from '../domain/informe_brigada_rutas.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

/** Sesión publicada por el guard (assets/js/auth/session-guard.js:262-263 y :294-296). */
export function sesionGlobal() {
  const s = globalThis.__sgmSession;
  if (!s || !s.user || !s.user.uid) return null;
  const p = s.profile || {};
  return { uid: s.user.uid, nombre: p.nombre || '', rol: s.role || p.rol || '', activo: p.activo !== false };
}

const ahoraIso = () => new Date().toISOString();

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]   funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]    instancia de Firestore (por defecto, getDbSafe())
 * @param {() => ({uid, nombre, rol}|null)} [opciones.sesion]
 * @param {(f: object) => Promise<object[]>} [opciones.lectorAcciones]  por defecto acciones_refrigeracion.listar
 * @param {() => Promise<object[]>} [opciones.lectorUsuarios]          por defecto usuarios.listar
 */
export function crearRepositorio(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  let configVista = null;   // la última configuración leída (para avisar antes de que la regla niegue)

  async function sdk() {
    if (!_sdk) _sdk = await import(CDN_FIRESTORE);
    return _sdk;
  }
  async function db() {
    if (!_db) {
      const fb = await import('../firebase-init.js');
      _db = fb.getDbSafe();
    }
    if (!_db) throw new ErrorIBR('red', 'La plataforma no está disponible en este momento (la base no inició).');
    return _db;
  }

  /** { uid, nombre } de quien escribe: lo que la regla compara con su perfil. */
  function autor() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorIBR('sin_permiso', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    return { uid: s.uid, nombre: s.nombre || '' };
  }
  function exigirEditor() {
    const a = autor();
    if (configVista && !esEditorDe(configVista, a.uid)) throw new ErrorIBR('sin_permiso', 'Solo los editores del informe lo arman.');
    return a;
  }
  function exigirAdmin() {
    const s = leerSesion();
    const a = autor();
    if (!s || s.rol !== 'admin') throw new ErrorIBR('sin_permiso', 'Solo un administrador puede hacer esto.');
    return a;
  }
  function exigirId(id) {
    if (!esIdInforme(id)) throw new ErrorIBR('no_existe');
  }

  /** Envuelve una operación: todo error sale como ErrorIBR. */
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }

  /** Transacción sobre un informe: relee, aplica el plan puro y escribe. */
  async function transaccion(id, alAplicar) {
    exigirId(id);
    return op(async () => {
      const F = await sdk();
      const d = await db();
      const ref = F.doc(d, COL.informes, id);
      return F.runTransaction(d, async (tx) => {
        const s = await tx.get(ref);
        const actual = s.exists() ? documentoAInforme(id, s.data()) : null;
        return alAplicar({ F, d, tx, ref, actual });
      });
    });
  }

  return {
    modo: 'nube',

    async leerConfig() {
      try {
        const F = await sdk();
        const d = await db();
        const s = await F.getDoc(F.doc(d, COL.config, COL.configId));
        if (!s.exists()) { configVista = null; return { estado: 'sin_config', config: null }; }
        configVista = normalizarConfig(s.data());
        return { estado: 'ok', config: configVista };
      } catch (e) {
        // Las reglas aún no publicadas niegan TODO (cierre por defecto): la página pasa a modo local.
        if (esSinPermiso(e)) return { estado: 'sin_permiso', config: null };
        return { estado: 'error', config: null, error: errorDesdeFirebase(e).message };
      }
    },

    async guardarConfig(config) {
      const a = exigirAdmin();
      const { payload, errores } = configParaGuardar(config);
      if (errores.length) throw new ErrorIBR('validacion', errores.join(' '));
      await op(async () => {
        const F = await sdk();
        const d = await db();
        await F.setDoc(F.doc(d, COL.config, COL.configId), { ...payload, actualizadoPor: a, actualizadoEn: F.serverTimestamp() });
      });
      configVista = normalizarConfig({ ...payload, actualizadoPor: a, actualizadoEn: ahoraIso() });
    },

    async listarRecientes({ limite = LIMITES.recientes } = {}) {
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const q = F.query(F.collection(d, COL.informes), F.orderBy('actualizadoEn', 'desc'),
          F.limit(topeConsulta(limite, LIMITES.recientes, LIMITES.listado)));
        const snap = await F.getDocs(q);
        return snap.docs.map((x) => documentoAInforme(x.id, x.data()));
      });
    },

    async listarDeEquipo(matricula, { limite = LIMITES.deEquipo } = {}) {
      const m = String(matricula || '').trim();
      if (!m) return [];
      return op(async () => {
        const F = await sdk();
        const d = await db();
        // Sin orderBy: igualdad sola usa el índice automático (no se toca firestore.indexes.json).
        const q = F.query(F.collection(d, COL.informes), F.where('equipo_ref.matricula', '==', m),
          F.limit(topeConsulta(limite, LIMITES.deEquipo, LIMITES.listado)));
        const snap = await F.getDocs(q);
        return ordenarPorActualizado(snap.docs.map((x) => documentoAInforme(x.id, x.data())));
      });
    },

    async obtener(id) {
      if (!esIdInforme(id)) return null;
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const s = await F.getDoc(F.doc(d, COL.informes, id));
        return s.exists() ? documentoAInforme(id, s.data()) : null;
      });
    },

    async crear({ equipo_ref, actividad, modelo, contenido } = {}) {
      const a = exigirEditor();
      const datos = planCrear({ equipo_ref, actividad, modelo, contenido });
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const ref = F.doc(F.collection(d, COL.informes));
        const ts = F.serverTimestamp();
        await F.setDoc(ref, { ...datos, creadoPor: a, creadoEn: ts, actualizadoPor: a, actualizadoEn: ts });
        const en = ahoraIso();
        return documentoAInforme(ref.id, { ...datos, creadoPor: a, creadoEn: en, actualizadoPor: a, actualizadoEn: en });
      });
    },

    async guardar(id, contenido, revEsperada) {
      const a = exigirEditor();
      return transaccion(id, ({ F, tx, ref, actual }) => {
        const c = planGuardar(actual, { contenido, revEsperada });
        tx.update(ref, { contenido: c.contenido, rev: c.rev, actualizadoPor: a, actualizadoEn: F.serverTimestamp() });
        return { rev: c.rev, actualizadoEn: ahoraIso() };
      });
    },

    async corregir(id, revEsperada) {
      const a = exigirEditor();
      return transaccion(id, ({ F, tx, ref, actual }) => {
        const c = planCorregir(actual, { revEsperada });
        tx.update(ref, { estado: c.estado, rev: c.rev, actualizadoPor: a, actualizadoEn: F.serverTimestamp() });
        return { rev: c.rev };
      });
    },

    async emitir(id, { contenido, revEsperada, motivo = '', firmas = [], marca = {}, huella } = {}) {
      const a = exigirEditor();
      return transaccion(id, ({ F, d, tx, ref, actual }) => {
        const p = planEmitir(actual, { contenido, revEsperada, motivo, firmas, marca, huella });
        const n = p.informe.version;
        const ts = F.serverTimestamp();
        tx.update(ref, {
          estado: p.informe.estado, version: n, rev: p.informe.rev, contenido: p.informe.contenido,
          actualizadoPor: a, actualizadoEn: ts, emitidoPor: a, emitidoEn: ts
        });
        tx.set(F.doc(d, COL.informes, id, COL.versiones, String(n)), { ...p.version, emitidoPor: a, en: ts });
        return { version: n, rev: p.informe.rev };
      });
    },

    async anular(id, revEsperada, motivo) {
      const a = exigirAdmin();
      return transaccion(id, ({ F, tx, ref, actual }) => {
        const p = planAnular(actual, { revEsperada, motivo });
        const ts = F.serverTimestamp();
        tx.update(ref, {
          estado: p.estado, rev: p.rev, anulacion: { motivo: p.anulacion.motivo, por: a, en: ts },
          actualizadoPor: a, actualizadoEn: ts
        });
        return { rev: p.rev };
      });
    },

    async listarVersiones(id) {
      if (!esIdInforme(id)) return [];
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const q = F.query(F.collection(d, COL.informes, id, COL.versiones), F.orderBy('version', 'desc'), F.limit(LIMITES.versiones));
        const snap = await F.getDocs(q);
        return snap.docs.map((x) => documentoAVersion(x.id, x.data()));
      });
    },

    async obtenerVersion(id, n) {
      if (!esIdInforme(id) || !Number.isInteger(Number(n)) || Number(n) < 1) return null;
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const s = await F.getDoc(F.doc(d, COL.informes, id, COL.versiones, String(Number(n))));
        return s.exists() ? documentoAVersion(s.id, s.data()) : null;
      });
    },

    /**
     * Acciones de refrigeración del equipo, SOLO lectura (decisión 12: nunca se
     * modifican). Si no se pudieron leer devuelve [] con `.error` (no es lo mismo
     * «no hay» que «no se pudo leer»).
     */
    async listarAcciones(matricula) {
      const m = String(matricula || '').trim();
      if (!m) return [];
      try {
        const leer = opciones.lectorAcciones || (await import('./acciones_refrigeracion.js')).listar;
        // transformador_id = matrícula (assets/js/calculo-refrigeracion.js:3254)
        const filas = await leer({ transformador_id: m, limite: LIMITES.acciones });
        return (filas || []).map(resumenAccion);
      } catch (e) {
        const vacio = [];
        vacio.error = 'No se pudieron leer las acciones de refrigeración de este equipo.';
        console.warn('[informes_brigada] acciones:', (e && e.code) || e);
        return vacio;
      }
    },

    async listarFichas({ limite = LIMITES.fichas } = {}) {
      return op(async () => {
        const F = await sdk();
        const d = await db();
        const q = F.query(F.collection(d, COL.fichas), F.orderBy('titulo'), F.limit(topeConsulta(limite, LIMITES.fichas, LIMITES.fichas)));
        const snap = await F.getDocs(q);
        return snap.docs.map((x) => documentoAFicha(x.id, x.data()));
      });
    },

    /** Registra en la biblioteca una ficha YA subida con el almacén (subirFicha). Idempotente. */
    async registrarFicha(ficha) {
      const a = exigirEditor();
      const f = ficha || {};
      const titulo = String(f.titulo || '').trim();
      if (!esIdFicha(f.id)) throw new ErrorIBR('validacion', 'Identificador de ficha inválido.');
      if (titulo.length < LIMITES.tituloFichaMin || titulo.length > LIMITES.tituloFichaMax) {
        throw new ErrorIBR('validacion', `El título de la ficha debe tener entre ${LIMITES.tituloFichaMin} y ${LIMITES.tituloFichaMax} caracteres.`);
      }
      if (!esHuella(f.huella)) throw new ErrorIBR('validacion', 'La ficha no tiene huella: súbala de nuevo.');
      await op(async () => {
        const F = await sdk();
        const d = await db();
        const ref = F.doc(d, COL.fichas, f.id);
        const ya = await F.getDoc(ref);
        if (ya.exists()) return;   // misma marca, modelo y huella: ya está en la biblioteca
        await F.setDoc(ref, {
          titulo, marca: String(f.marca || ''), modelo: String(f.modelo || ''),
          almacen: String(f.almacen || ''), ruta: String(f.ruta || ''), mime: String(f.mime || ''),
          ancho: Math.round(Number(f.ancho) || 0), alto: Math.round(Number(f.alto) || 0),
          tamano: Math.round(Number(f.tamano) || 0), huella: f.huella,
          subidoPor: a, en: F.serverTimestamp()
        });
      });
    },

    /** Usuarios para escoger editores (solo administrador; usuarios.js:58). */
    async listarUsuarios() {
      exigirAdmin();
      return op(async () => {
        const leer = opciones.lectorUsuarios || (await import('./usuarios.js')).listar;
        const filas = await leer();
        return (filas || []).map((u) => ({ uid: String(u.uid || u.id || ''), nombre: String(u.nombre || u.email || ''), rol: String(u.rol || ''), activo: u.activo === true }))
          .filter((u) => u.uid);
      });
    }
  };
}
