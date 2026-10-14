// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · repositorio LOCAL
// ──────────────────────────────────────────────────────────────
// Mismo contrato que data/informes_brigada.js (nube), pero TODO vive en este
// navegador: memoria + localStorage['ssee.informe_brigada.local.v1']. Sirve
// para la vista previa mientras las reglas no estén publicadas (la nube
// responde «sin permiso») y para probar sin escribir NADA en la plataforma.
//
// Cero imports de Firebase en este archivo (una prueba lo revisa). Lo único
// que lee de la plataforma, y solo si nadie le pasa otro lector, son las
// acciones de refrigeración del equipo: con `listar`, en solo lectura
// (decisión 12: la acción nunca se modifica).
//
// Los cambios de estado son los MISMOS planes puros que usa la nube
// (domain/informe_brigada_rutas.js), así que la vista previa se comporta
// como se comportará en producción: rev, emitir, corregir, anular.
// ══════════════════════════════════════════════════════════════

import {
  LIMITES, CLAVE_LOCAL, CLAVE_RESPALDO, ALMACEN_POR_DEFECTO, ErrorIBR, esIdFicha, esHuella,
  normalizarConfig, configParaGuardar, configDePrueba, esEditorDe, documentoAInforme, documentoAVersion,
  documentoAFicha, ordenarPorActualizado, resumenAccion, topeConsulta, nuevoIdLocal,
  planCrear, planGuardar, planCorregir, planEmitir, planAnular
} from '../domain/informe_brigada_rutas.js';

/** Sesión publicada por el guard (assets/js/auth/session-guard.js:262-263). Sin importar el guard: él trae Firebase. */
function sesionGlobal() {
  const s = globalThis.__sgmSession;
  if (!s || !s.user || !s.user.uid) return null;
  const p = s.profile || {};
  return { uid: s.user.uid, nombre: p.nombre || '', rol: s.role || p.rol || '', activo: p.activo !== false };
}

/** localStorage si existe y se deja usar (modo privado o bloqueado → null). */
function almacenamientoNavegador() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const k = '__ibr_prueba__';
    ls.setItem(k, '1'); ls.removeItem(k);
    return ls;
  } catch (_) { return null; }
}

const copia = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const vacio = () => ({ v: 1, informes: {}, versiones: {}, fichas: {}, config: null });

/**
 * @param {object} [opciones]
 * @param {() => ({uid, nombre, rol}|null)} [opciones.sesion]
 * @param {Storage|null} [opciones.almacenamiento]  por defecto localStorage (null = solo memoria)
 * @param {string} [opciones.clave]
 * @param {() => string} [opciones.ahora]            ISO; por defecto el reloj del equipo
 * @param {(f: object) => Promise<object[]>} [opciones.lectorAcciones]
 * @param {() => Promise<object[]>} [opciones.lectorUsuarios]
 */
export function crearRepositorio(opciones = {}) {
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const almac = opciones.almacenamiento !== undefined ? opciones.almacenamiento : almacenamientoNavegador();
  const clave = opciones.clave || CLAVE_LOCAL;
  const ahora = typeof opciones.ahora === 'function' ? opciones.ahora : () => new Date().toISOString();
  let persistente = !!almac;
  let estado = cargar();

  function cargar() {
    if (!almac) return vacio();
    try {
      const t = almac.getItem(clave);
      const j = t ? JSON.parse(t) : null;
      if (j && j.v === 1) {
        return { v: 1, informes: j.informes || {}, versiones: j.versiones || {}, fichas: j.fichas || {}, config: j.config || null };
      }
    } catch (_) { persistente = false; }
    return vacio();
  }
  function grabar() {
    if (!almac) { persistente = false; return; }
    try { almac.setItem(clave, JSON.stringify(estado)); persistente = true; } catch (_) { persistente = false; }
  }
  /**
   * Antes de cada lectura o escritura se vuelve a leer lo guardado: con el informe abierto en DOS
   * pestañas, la segunda ya no pisa en silencio lo que guardó la primera (ve su `rev` y responde
   * «conflicto», igual que la nube). Si lo guardado no se puede leer, se sigue con lo de la memoria.
   */
  function alDia() {
    if (!almac) return;
    try {
      const t = almac.getItem(clave);
      if (!t) return;
      const j = JSON.parse(t);
      if (j && j.v === 1) estado = { v: 1, informes: j.informes || {}, versiones: j.versiones || {}, fichas: j.fichas || {}, config: j.config || null };
    } catch (_) { /* se sigue con la memoria */ }
  }

  function autor() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorIBR('sin_permiso', 'No hay sesión. Recargue la página e ingrese de nuevo.');
    return { uid: s.uid, nombre: s.nombre || '' };
  }
  function config() {
    const s = leerSesion();
    const base = estado.config ? normalizarConfig(estado.config) : configDePrueba(s && s.uid);
    return { ...base, almacen: 'local' };
  }
  function exigirEditor() {
    const a = autor();
    if (!esEditorDe(config(), a.uid)) throw new ErrorIBR('sin_permiso', 'Solo los editores del informe lo arman.');
    return a;
  }
  function exigirAdmin() {
    const s = leerSesion();
    const a = autor();
    if (!s || s.rol !== 'admin') throw new ErrorIBR('sin_permiso', 'Solo un administrador puede hacer esto.');
    return a;
  }
  function informe(id) {
    const d = estado.informes[id];
    return d ? documentoAInforme(id, d) : null;
  }

  return {
    modo: 'local',
    /** ¿Lo armado sobrevive a recargar? (false = solo memoria: modo privado o almacenamiento lleno). Las fotos locales nunca sobreviven. */
    get persistente() { return persistente; },

    async leerConfig() {
      alDia();
      return { estado: 'ok', config: copia(config()) };
    },

    async guardarConfig(cfg) {
      alDia();
      const a = exigirAdmin();
      const entrada = { ...(cfg || {}) };
      if (!['storage', 'firestore'].includes(entrada.almacen)) entrada.almacen = ALMACEN_POR_DEFECTO;
      const { payload, errores } = configParaGuardar(entrada);
      if (errores.length) throw new ErrorIBR('validacion', errores.join(' '));
      estado.config = { ...copia(payload), actualizadoPor: a, actualizadoEn: ahora() };
      grabar();
    },

    async listarRecientes({ limite = LIMITES.recientes } = {}) {
      alDia();
      const todos = Object.keys(estado.informes).map(informe);
      return copia(ordenarPorActualizado(todos).slice(0, topeConsulta(limite, LIMITES.recientes, LIMITES.listado)));
    },

    async listarDeEquipo(matricula, { limite = LIMITES.deEquipo } = {}) {
      alDia();
      const m = String(matricula || '').trim();
      if (!m) return [];
      const del = Object.keys(estado.informes).map(informe).filter((x) => x.equipo_ref.matricula === m);
      return copia(ordenarPorActualizado(del).slice(0, topeConsulta(limite, LIMITES.deEquipo, LIMITES.listado)));
    },

    async obtener(id) {
      alDia();
      return copia(informe(id));
    },

    async crear({ equipo_ref, actividad, modelo, contenido } = {}) {
      alDia();
      const a = exigirEditor();
      const datos = planCrear({ equipo_ref, actividad, modelo, contenido });
      let id = nuevoIdLocal();
      while (estado.informes[id]) id = nuevoIdLocal();
      const en = ahora();
      estado.informes[id] = { ...datos, creadoPor: a, creadoEn: en, actualizadoPor: a, actualizadoEn: en };
      grabar();
      return copia(informe(id));
    },

    async guardar(id, contenido, revEsperada) {
      alDia();
      const a = exigirEditor();
      const c = planGuardar(informe(id), { contenido, revEsperada });
      const en = ahora();
      Object.assign(estado.informes[id], { contenido: c.contenido, rev: c.rev, actualizadoPor: a, actualizadoEn: en });
      grabar();
      return { rev: c.rev, actualizadoEn: en };
    },

    async corregir(id, revEsperada) {
      alDia();
      const a = exigirEditor();
      const c = planCorregir(informe(id), { revEsperada });
      Object.assign(estado.informes[id], { estado: c.estado, rev: c.rev, actualizadoPor: a, actualizadoEn: ahora() });
      grabar();
      return { rev: c.rev };
    },

    async emitir(id, { contenido, revEsperada, motivo = '', firmas = [], marca = {}, huella } = {}) {
      alDia();
      const a = exigirEditor();
      const p = planEmitir(informe(id), { contenido, revEsperada, motivo, firmas, marca, huella });
      const n = p.informe.version;
      const en = ahora();
      Object.assign(estado.informes[id], {
        estado: p.informe.estado, version: n, rev: p.informe.rev, contenido: p.informe.contenido,
        actualizadoPor: a, actualizadoEn: en, emitidoPor: a, emitidoEn: en
      });
      estado.versiones[id] = estado.versiones[id] || {};
      estado.versiones[id][String(n)] = { ...p.version, emitidoPor: a, en };
      grabar();
      return { version: n, rev: p.informe.rev };
    },

    async anular(id, revEsperada, motivo) {
      alDia();
      const a = exigirAdmin();
      const p = planAnular(informe(id), { revEsperada, motivo });
      const en = ahora();
      Object.assign(estado.informes[id], {
        estado: p.estado, rev: p.rev, anulacion: { motivo: p.anulacion.motivo, por: a, en },
        actualizadoPor: a, actualizadoEn: en
      });
      grabar();
      return { rev: p.rev };
    },

    async listarVersiones(id) {
      alDia();
      const vs = estado.versiones[id] || {};
      return copia(Object.keys(vs).map((n) => documentoAVersion(n, vs[n]))
        .sort((x, y) => y.version - x.version).slice(0, LIMITES.versiones));
    },

    async obtenerVersion(id, n) {
      alDia();
      const v = (estado.versiones[id] || {})[String(Number(n))];
      return v ? copia(documentoAVersion(String(Number(n)), v)) : null;
    },

    /** Acciones de refrigeración del equipo, SOLO lectura. [] con `.error` si no se pudieron leer. */
    async listarAcciones(matricula) {
      const m = String(matricula || '').trim();
      if (!m) return [];
      try {
        const leer = opciones.lectorAcciones || (await import('./acciones_refrigeracion.js')).listar;
        const filas = await leer({ transformador_id: m, limite: LIMITES.acciones });
        return (filas || []).map(resumenAccion);
      } catch (_) {
        const sin = [];
        sin.error = 'No se pudieron leer las acciones de refrigeración de este equipo.';
        return sin;
      }
    },

    async listarFichas({ limite = LIMITES.fichas } = {}) {
      alDia();
      return copia(Object.keys(estado.fichas).map((id) => documentoAFicha(id, estado.fichas[id]))
        .sort((x, y) => x.titulo.localeCompare(y.titulo, 'es')).slice(0, topeConsulta(limite, LIMITES.fichas, LIMITES.fichas)));
    },

    async registrarFicha(ficha) {
      alDia();
      const a = exigirEditor();
      const f = ficha || {};
      const titulo = String(f.titulo || '').trim();
      if (!esIdFicha(f.id)) throw new ErrorIBR('validacion', 'Identificador de ficha inválido.');
      if (titulo.length < LIMITES.tituloFichaMin || titulo.length > LIMITES.tituloFichaMax) {
        throw new ErrorIBR('validacion', `El título de la ficha debe tener entre ${LIMITES.tituloFichaMin} y ${LIMITES.tituloFichaMax} caracteres.`);
      }
      if (!esHuella(f.huella)) throw new ErrorIBR('validacion', 'La ficha no tiene huella: súbala de nuevo.');
      if (estado.fichas[f.id]) return;
      estado.fichas[f.id] = {
        titulo, marca: String(f.marca || ''), modelo: String(f.modelo || ''), almacen: String(f.almacen || 'local'),
        ruta: String(f.ruta || ''), mime: String(f.mime || ''), ancho: Math.round(Number(f.ancho) || 0),
        alto: Math.round(Number(f.alto) || 0), tamano: Math.round(Number(f.tamano) || 0), huella: f.huella,
        subidoPor: a, en: ahora()
      };
      grabar();
    },

    async listarUsuarios() {
      exigirAdmin();
      if (opciones.lectorUsuarios) {
        const filas = await opciones.lectorUsuarios();
        return (filas || []).map((u) => ({ uid: String(u.uid || ''), nombre: String(u.nombre || ''), rol: String(u.rol || ''), activo: u.activo === true })).filter((u) => u.uid);
      }
      const s = leerSesion();
      return [{ uid: s.uid, nombre: s.nombre || '', rol: s.rol || '', activo: true }];
    },

    /** Borra todo lo local de la vista previa (no toca la plataforma). */
    vaciar() {
      estado = vacio();
      if (almac) { try { almac.removeItem(clave); } catch (_) { /* nada que borrar */ } }
    }
  };
}

// ══════════════════════════════════════════════════════════════
// Respaldo ante un choque (§5.2 del plan): si otra persona cambió el informe,
// lo que esta pantalla tenía se guarda aquí para no perderlo.
// localStorage['ssee.informe_brigada.respaldo.v1'] = { [id]: { contenido, en, base?, revBase?, uid? } }
// `base` = el informe del que partió la pantalla: con él, «Recuperar mis cambios» aplica solo lo que
// esta persona cambió (sin pisar a la otra); `uid` = quién lo dejó (un computador compartido).
// ══════════════════════════════════════════════════════════════

function leerRespaldos(almac) {
  try { const t = almac && almac.getItem(CLAVE_RESPALDO); return t ? JSON.parse(t) || {} : {}; } catch (_) { return {}; }
}

/** Guarda el contenido de un informe como respaldo. @returns {boolean} si quedó guardado */
export function guardarRespaldo(id, contenido, almac = almacenamientoNavegador(), { base = null, revBase = null, uid = '' } = {}) {
  if (!almac || !id) return false;
  try {
    const r = leerRespaldos(almac);
    r[id] = { contenido: copia(contenido), en: new Date().toISOString() };
    if (base && typeof base === 'object') r[id].base = copia(base);
    if (Number.isInteger(revBase)) r[id].revBase = revBase;
    if (uid) r[id].uid = String(uid);
    almac.setItem(CLAVE_RESPALDO, JSON.stringify(r));
    return true;
  } catch (_) { return false; }
}

/** @returns {{contenido: object, en: string}|null} */
export function leerRespaldo(id, almac = almacenamientoNavegador()) {
  const r = leerRespaldos(almac)[id];
  return r ? copia(r) : null;
}

export function borrarRespaldo(id, almac = almacenamientoNavegador()) {
  if (!almac) return;
  try {
    const r = leerRespaldos(almac);
    delete r[id];
    almac.setItem(CLAVE_RESPALDO, JSON.stringify(r));
  } catch (_) { /* sin almacenamiento: nada que borrar */ }
}
