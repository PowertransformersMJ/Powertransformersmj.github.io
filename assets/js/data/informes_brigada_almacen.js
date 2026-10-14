// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · ALMACÉN de imágenes
// ──────────────────────────────────────────────────────────────
// Un solo contrato y tres adaptadores, escogidos por `config.almacen`:
//   · 'storage'   (por defecto, decisión 5) — Firebase Storage
//   · 'firestore' (contingencia de L-29 / `99 §100`: en producción Storage ha
//                  negado las descargas al navegador) — bytes en documentos
//   · 'local'     (vista previa) — Blob en memoria; se pierde al recargar
// Cada imagen guardada lleva su meta { almacen, ruta, huella, mime, ancho, alto }
// y se lee con el adaptador de SU almacén: se pueden mezclar (una foto vieja
// en Storage sigue legible aunque la configuración pase a Firestore).
//
// Antes de subir, el almacén COMPRUEBA (no confía): tipo real por los bytes,
// tope de la regla, huella SHA-256 de los bytes, y que las fotos no traigan
// datos de cámara (Exif/XMP: ubicación GPS, decisión 5). La reducción y la
// limpieza las hace la pantalla (ui/informe-brigada/imagenes.js, por lienzo);
// esto es el último control antes de que la imagen salga del navegador.
//
// Firmas de terceros: NUNCA por URL con token (data/firmas.js:13); se leen con
// la sesión y solo resuelven desde una versión EMITIDA (decisión 4).
// El SDK de Firebase se carga al usarlo (y se puede inyectar para probar
// contra el emulador). Este módulo se carga con import() dinámico.
// ══════════════════════════════════════════════════════════════

import {
  ALMACEN_POR_DEFECTO, ErrorIBR, errorDesdeFirebase, esSinPermiso, validarBinario, mimePorBytes, imagenConMetadatos,
  rutaArchivo, rutaLogo, rutaFirma, rutaFicha, rutaParteFicha, idBin, rutaBin, esRutaFirma, rutaAdmitidaPara
} from '../domain/informe_brigada_rutas.js';
import { huellaHex } from '../domain/fichas_adjunto.js';

const CDN_STORAGE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
export const MODOS = Object.freeze(['storage', 'firestore', 'local']);

/** Sesión publicada por el guard (session-guard.js:262-263). */
function autorDeSesion(autor) {
  if (autor && autor.uid) return { uid: String(autor.uid), nombre: String(autor.nombre || '') };
  const s = globalThis.__sgmSession;
  if (s && s.user && s.user.uid) return { uid: s.user.uid, nombre: (s.profile && s.profile.nombre) || '' };
  throw new ErrorIBR('sin_permiso', 'La sesión venció. Recargue la página e ingrese de nuevo.');
}

const ahoraIso = () => new Date().toISOString();

async function bytesDe(blob) {
  if (blob instanceof Uint8Array) return blob;
  if (blob && typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  throw new ErrorIBR('validacion', 'No llegó ninguna imagen.');
}

/**
 * El último control antes de guardar: lo que dice la meta debe ser lo que son los bytes.
 * @returns {Promise<{bytes: Uint8Array, mime, ancho, alto, tamano, huella}>}
 */
async function revisar(clase, blob, meta, almacen) {
  const bytes = await bytesDe(blob);
  const m = meta || {};
  const mime = mimePorBytes(bytes);
  if (!mime) throw new ErrorIBR('validacion', 'El archivo no es una imagen JPG o PNG.');
  if (m.mime && m.mime !== mime) throw new ErrorIBR('validacion', 'El archivo no es del tipo que dice ser (' + m.mime + ').');
  if (m.tamano != null && Number(m.tamano) !== bytes.length) throw new ErrorIBR('validacion', 'El tamaño de la imagen no coincide con lo preparado. Vuelva a cargarla.');
  const huella = await huellaHex(bytes);
  if (m.huella && m.huella !== huella) throw new ErrorIBR('validacion', 'La huella de la imagen no coincide con lo preparado. Vuelva a cargarla.');
  const datos = { mime, ancho: Math.round(Number(m.ancho) || 0), alto: Math.round(Number(m.alto) || 0), tamano: bytes.length, huella };
  const errores = validarBinario(clase, datos, almacen);
  if (errores.length) throw new ErrorIBR('validacion', errores.join(' '));
  if ((clase === 'archivo' || clase === 'ficha') && imagenConMetadatos(bytes)) {
    throw new ErrorIBR('validacion', 'La imagen todavía trae datos de la cámara (puede incluir la ubicación GPS). Cárguela desde la pantalla del informe, que la limpia.');
  }
  return { bytes, ...datos };
}

function revisarAutorizacion(a) {
  const x = a || {};
  const fecha = String(x.fecha || '');
  const medio = String(x.medio || '').trim();
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha) || medio.length < 3) {
    throw new ErrorIBR('validacion', 'Registre la fecha y el medio con que el titular autorizó usar su firma.');
  }
  return { fecha, medio };
}

/** URLs locales (objectURL) por ruta, para liberarlas todas juntas. */
function cacheUrls() {
  const m = new Map();
  return {
    async obtener(clave, crear) {
      if (m.has(clave)) return m.get(clave);
      const p = crear();
      m.set(clave, p);
      try { return await p; } catch (e) { m.delete(clave); throw e; }
    },
    liberar() {
      for (const p of m.values()) Promise.resolve(p).then((u) => { try { URL.revokeObjectURL(u); } catch (_) { /* ya liberada */ } }, () => {});
      m.clear();
    }
  };
}
/** Enlaces de descarga ya pedidos (texto, no objectURL: no hay nada que liberar). Un fallo no queda guardado. */
function cacheEnlaces() {
  const m = new Map();
  return {
    async obtener(clave, crear) {
      if (m.has(clave)) return m.get(clave);
      const p = crear();
      m.set(clave, p);
      try { return await p; } catch (e) { m.delete(clave); throw e; }
    },
    limpiar() { m.clear(); }
  };
}
const urlDeBytes = (bytes, mime) => URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));

// ══════════════════════════════════════════════════════════════
// Adaptador STORAGE
// ══════════════════════════════════════════════════════════════
function almacenStorage({ storage = null, sdk = null } = {}) {
  let _st = storage;
  let _S = sdk;
  const S = async () => _S || (_S = await import(CDN_STORAGE));
  async function st() {
    if (!_st) { const fb = await import('../firebase-init.js'); _st = fb.getStorageSafe(); }
    if (!_st) throw new ErrorIBR('red', 'El almacenamiento no está disponible en este momento.');
    return _st;
  }
  async function subir(ruta, bytes, contentType, customMetadata, alProgreso) {
    const F = await S();
    const r = F.ref(await st(), ruta);
    if (typeof alProgreso === 'function' && F.uploadBytesResumable) {
      await new Promise((ok, mal) => {
        const t = F.uploadBytesResumable(r, bytes, { contentType, customMetadata });
        t.on('state_changed', (s) => { try { alProgreso(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0); } catch (_) { /* la barra no tumba la subida */ } }, mal, ok);
      });
    } else {
      await F.uploadBytes(r, bytes, { contentType, customMetadata });
    }
  }
  /** true = ya está · false = no está · null = no se pudo saber (sin permiso de lectura). */
  async function existe(ruta) {
    const F = await S();
    try { await F.getMetadata(F.ref(await st(), ruta)); return true; } catch (e) {
      const c = String((e && e.code) || '');
      if (/object-not-found/.test(c)) return false;
      if (/unauthorized|permission/.test(c)) return null;
      throw e;
    }
  }
  const urls = cacheUrls();
  const enlaces = cacheEnlaces();

  return {
    modo: 'storage',
    async subirArchivo(informeId, archivoId, blob, meta, autor, { alProgreso } = {}) {
      const a = autorDeSesion(autor);
      const ruta = rutaArchivo(informeId, archivoId);
      const r = await revisar('archivo', blob, meta, 'storage');
      try { await subir(ruta, r.bytes, r.mime, { huella: r.huella }, alProgreso); } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'storage', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, subidoPor: a, en: ahoraIso() };
    },
    async borrarArchivo(meta) {
      if (!meta || !meta.ruta) return false;
      const F = await S();
      try { await F.deleteObject(F.ref(await st(), meta.ruta)); return true; } catch (_) { return false; }  // emitido o ya borrado: se ignora
    },
    async subirLogo(clave, blob, meta, autor) {
      autorDeSesion(autor);
      const r = await revisar('logo', blob, meta, 'storage');
      const ruta = rutaLogo(clave, r.huella);
      try { if ((await existe(ruta)) !== true) await subir(ruta, r.bytes, r.mime, { huella: r.huella }); } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'storage', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto };
    },
    // ── FIRMAS (inicio): nunca getDownloadURL; se leen con la sesión ──
    async subirFirma(clave, blob, meta, autor) {
      autorDeSesion(autor);
      const autorizacion = revisarAutorizacion(meta && meta.autorizacion);
      const r = await revisar('firma', blob, meta, 'storage');
      const ruta = rutaFirma(clave, r.huella);
      try {
        if ((await existe(ruta)) !== true) {
          await subir(ruta, r.bytes, r.mime, { huella: r.huella, autorizacion_fecha: autorizacion.fecha, autorizacion_medio: autorizacion.medio });
        }
      } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'storage', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto, autorizacion };
    },
    async urlFirma(meta) {
      return urls.obtener('storage:' + meta.ruta, async () => {
        const F = await S();
        const blob = await F.getBlob(F.ref(await st(), meta.ruta));
        return URL.createObjectURL(blob);
      });
    },
    // ── FIRMAS (fin) ──
    async subirFicha(fichaId, blob, meta, autor) {
      autorDeSesion(autor);
      const ruta = rutaFicha(fichaId);
      const r = await revisar('ficha', blob, meta, 'storage');
      try { if ((await existe(ruta)) !== true) await subir(ruta, r.bytes, r.mime, { huella: r.huella }); } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'storage', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella };
    },
    async url(meta) {
      if (esRutaFirma(meta.ruta)) return this.urlFirma(meta);
      // Una sola consulta a Storage por imagen en la sesión: cada «Ver hojas» ya no vuelve a pedir
      // el enlace de las ~30 fotos (y sus lecturas de Firestore por la regla). Se guarda por ruta.
      return enlaces.obtener('storage:' + meta.ruta, async () => {
        const F = await S();
        return F.getDownloadURL(F.ref(await st(), meta.ruta));
      });
    },
    async bytes(meta) {
      // getBytes necesita CORS en el bucket (L-29): si falla, la pantalla avisa y el
      // administrador puede pasar a almacen 'firestore' sin tocar código (§0.1 del plan).
      const F = await S();
      return new Uint8Array(await F.getBytes(F.ref(await st(), meta.ruta)));
    },
    liberar() { urls.liberar(); enlaces.limpiar(); }
  };
}

// ══════════════════════════════════════════════════════════════
// Adaptador FIRESTORE (bytes en documentos ≤ 900 KB)
// ══════════════════════════════════════════════════════════════
function almacenFirestore({ db = null, sdk = null } = {}) {
  let _db = db;
  let _F = sdk;
  const S = async () => _F || (_F = await import(CDN_FIRESTORE));
  async function base() {
    if (!_db) { const fb = await import('../firebase-init.js'); _db = fb.getDbSafe(); }
    if (!_db) throw new ErrorIBR('red', 'La plataforma no está disponible en este momento.');
    return _db;
  }
  /** Lee un documento; si la regla no deja leer lo que no existe, responde null (no se sabe). */
  async function leer(ruta) {
    const F = await S();
    try { const s = await F.getDoc(F.doc(await base(), ruta)); return s.exists() ? s.data() : false; } catch (e) {
      if (esSinPermiso(e)) return null;
      throw e;
    }
  }
  async function escribir(ruta, datos) {
    const F = await S();
    await F.setDoc(F.doc(await base(), ruta), { ...datos, en: F.serverTimestamp() });
  }
  const aBytes = async (u8) => (await S()).Bytes.fromUint8Array(u8);
  const urls = cacheUrls();

  async function bytesDeDoc(meta) {
    const F = await S();
    const s = await F.getDoc(F.doc(await base(), meta.ruta));
    if (!s.exists() || !s.data().bytes) throw new ErrorIBR('no_existe', 'La imagen ya no está guardada.');
    return s.data().bytes.toUint8Array();
  }

  return {
    modo: 'firestore',
    async subirArchivo(informeId, archivoId, blob, meta, autor, { alProgreso } = {}) {
      const a = autorDeSesion(autor);
      const ruta = rutaArchivo(informeId, archivoId);
      const r = await revisar('archivo', blob, meta, 'firestore');
      try {
        await escribir(ruta, { bytes: await aBytes(r.bytes), mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, subidoPor: a });
      } catch (e) { throw errorDesdeFirebase(e); }
      if (typeof alProgreso === 'function') { try { alProgreso(1); } catch (_) { /* barra */ } }
      return { almacen: 'firestore', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, subidoPor: a, en: ahoraIso() };
    },
    async borrarArchivo(meta) {
      if (!meta || !meta.ruta) return false;
      const F = await S();
      try { await F.deleteDoc(F.doc(await base(), meta.ruta)); return true; } catch (_) { return false; }
    },
    async subirLogo(clave, blob, meta, autor) {
      const a = autorDeSesion(autor);
      const r = await revisar('logo', blob, meta, 'firestore');
      const ruta = rutaBin(idBin('logo', clave, r.huella));
      try {
        if (!(await leer(ruta))) {
          await escribir(ruta, { clase: 'logo', clave, bytes: await aBytes(r.bytes), mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, subidoPor: a });
        }
      } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'firestore', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto };
    },
    // ── FIRMAS (inicio): nunca getDownloadURL; se leen con la sesión ──
    async subirFirma(clave, blob, meta, autor) {
      const a = autorDeSesion(autor);
      const autorizacion = revisarAutorizacion(meta && meta.autorizacion);
      const r = await revisar('firma', blob, meta, 'firestore');
      const ruta = rutaBin(idBin('firma', clave, r.huella));
      try {
        if (!(await leer(ruta))) {
          await escribir(ruta, { clase: 'firma', clave, bytes: await aBytes(r.bytes), mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, autorizacion, subidoPor: a });
        }
      } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'firestore', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto, autorizacion };
    },
    async urlFirma(meta) {
      return urls.obtener('firestore:' + meta.ruta, async () => urlDeBytes(await bytesDeDoc(meta), meta.mime));
    },
    // ── FIRMAS (fin) ──
    async subirFicha(fichaId, blob, meta, autor) {
      const a = autorDeSesion(autor);
      const ruta = rutaParteFicha(fichaId);
      const r = await revisar('ficha', blob, meta, 'firestore');
      try {
        const ya = await leer(ruta);
        if (ya && ya.huella !== r.huella) throw new ErrorIBR('validacion', 'Ya hay otra imagen guardada con ese identificador de ficha.');
        if (!ya) await escribir(ruta, { bytes: await aBytes(r.bytes), mime: r.mime, huella: r.huella, subidoPor: a });
      } catch (e) { throw errorDesdeFirebase(e); }
      return { almacen: 'firestore', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella };
    },
    async url(meta) {
      if (esRutaFirma(meta.ruta)) return this.urlFirma(meta);
      return urls.obtener('firestore:' + meta.ruta, async () => urlDeBytes(await bytesDeDoc(meta), meta.mime));
    },
    async bytes(meta) { return bytesDeDoc(meta); },
    liberar() { urls.liberar(); }
  };
}

// ══════════════════════════════════════════════════════════════
// Adaptador LOCAL (vista previa: memoria del navegador, cero red)
// ══════════════════════════════════════════════════════════════
function almacenLocal() {
  const memoria = new Map();   // ruta → { bytes, mime }
  const urls = cacheUrls();
  const guardar = (ruta, r) => { if (!memoria.has(ruta)) memoria.set(ruta, { bytes: r.bytes, mime: r.mime }); };
  const sacar = (meta) => {
    const x = memoria.get(meta && meta.ruta);
    if (!x) throw new ErrorIBR('no_existe', 'Las imágenes de la vista previa local se pierden al recargar la página.');
    return x;
  };
  return {
    modo: 'local',
    async subirArchivo(informeId, archivoId, blob, meta, autor, { alProgreso } = {}) {
      const a = autorDeSesion(autor);
      const ruta = rutaArchivo(informeId, archivoId);
      const r = await revisar('archivo', blob, meta, 'local');
      guardar(ruta, r);
      if (typeof alProgreso === 'function') { try { alProgreso(1); } catch (_) { /* barra */ } }
      return { almacen: 'local', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella, subidoPor: a, en: ahoraIso() };
    },
    async borrarArchivo(meta) { return memoria.delete(meta && meta.ruta); },
    async subirLogo(clave, blob, meta, autor) {
      autorDeSesion(autor);
      const r = await revisar('logo', blob, meta, 'local');
      const ruta = rutaLogo(clave, r.huella);
      guardar(ruta, r);
      return { almacen: 'local', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto };
    },
    // ── FIRMAS (inicio): nunca getDownloadURL; se leen con la sesión ──
    async subirFirma(clave, blob, meta, autor) {
      autorDeSesion(autor);
      const autorizacion = revisarAutorizacion(meta && meta.autorizacion);
      const r = await revisar('firma', blob, meta, 'local');
      const ruta = rutaFirma(clave, r.huella);
      guardar(ruta, r);
      return { almacen: 'local', ruta, huella: r.huella, mime: r.mime, ancho: r.ancho, alto: r.alto, autorizacion };
    },
    async urlFirma(meta) {
      return urls.obtener('local:' + meta.ruta, async () => { const x = sacar(meta); return urlDeBytes(x.bytes, x.mime); });
    },
    // ── FIRMAS (fin) ──
    async subirFicha(fichaId, blob, meta, autor) {
      autorDeSesion(autor);
      const ruta = rutaFicha(fichaId);
      const r = await revisar('ficha', blob, meta, 'local');
      guardar(ruta, r);
      return { almacen: 'local', ruta, mime: r.mime, ancho: r.ancho, alto: r.alto, tamano: r.tamano, huella: r.huella };
    },
    async url(meta) {
      if (esRutaFirma(meta.ruta)) return this.urlFirma(meta);
      return urls.obtener('local:' + meta.ruta, async () => { const x = sacar(meta); return urlDeBytes(x.bytes, x.mime); });
    },
    async bytes(meta) { return sacar(meta).bytes; },
    /** ¿Sigue en la memoria de esta pestaña? (tras recargar, las imágenes locales ya no están). */
    tiene(meta) { return !!(meta && memoria.has(meta.ruta)); },
    liberar() { urls.liberar(); }
  };
}

// ══════════════════════════════════════════════════════════════
// Fábrica y resolución de referencias del Documento
// ══════════════════════════════════════════════════════════════

const registro = new Map();   // modo → Almacen (el local DEBE ser uno solo: las fotos viven en su memoria)

/**
 * @param {{modo?: 'storage'|'firestore'|'local', nuevo?: boolean, storage?, db?, sdkStorage?, sdkFirestore?}} [opciones]
 *   `nuevo: true` crea uno aparte (pruebas); si no, se reutiliza el del mismo modo.
 */
export function crearAlmacen({ modo = ALMACEN_POR_DEFECTO, nuevo = false, storage, db, sdkStorage, sdkFirestore } = {}) {
  if (!MODOS.includes(modo)) throw new ErrorIBR('validacion', 'Almacén desconocido: ' + modo + '.');
  if (!nuevo && registro.has(modo)) return registro.get(modo);
  const a = modo === 'storage' ? almacenStorage({ storage, sdk: sdkStorage })
    : modo === 'firestore' ? almacenFirestore({ db, sdk: sdkFirestore })
      : almacenLocal();
  if (!nuevo) registro.set(modo, a);
  return a;
}

function almacenPara(modo, almacenes) {
  if (almacenes && almacenes[modo]) return almacenes[modo];
  return crearAlmacen({ modo });
}

const TIPO_AVISO = { archivo: ['foto o anexo', 'fotos o anexos'], ficha: ['ficha', 'fichas'], marca: ['logo', 'logos'], firma: ['firma', 'firmas'] };

async function cargarMetaDeRef(inyectado) {
  if (typeof inyectado === 'function') return inyectado;
  try { return (await import('../domain/informe_brigada_documento.js')).metaDeRef; } catch (e) {
    throw new ErrorIBR('red', 'No se pudo cargar el motor del informe. Recargue con Cmd + Shift + R.', e);
  }
}

/** Meta de una ref, con los cierres de seguridad (firmas solo emitidas; cada ref en su carpeta). */
function metaSegura(ref, metaDeRef, ctx) {
  const r = String(ref || '');
  if (r.startsWith('firma:') && !ctx.versionDoc) return null;               // decisión 4: nunca en borrador
  const meta = metaDeRef(r, ctx);
  if (!meta || !meta.ruta || !MODOS.includes(meta.almacen)) return null;
  if (!rutaAdmitidaPara(r, meta.ruta)) return { rechazada: true };
  return meta;
}

async function enParalelo(lista, n, fn) {
  let i = 0;
  const trabajo = async () => { while (i < lista.length) { const x = lista[i++]; await fn(x); } };
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, trabajo));
}

function cerrarAvisos(out, fallas, rechazadas) {
  for (const [tipo, n] of Object.entries(fallas)) {
    if (!n) continue;
    const [uno, varios] = TIPO_AVISO[tipo] || ['imagen', 'imágenes'];
    out.avisos.push(`No se pudieron leer ${n} ${n === 1 ? uno : varios} del almacenamiento.`);
  }
  if (rechazadas) out.avisos.push(`${rechazadas} ${rechazadas === 1 ? 'imagen apunta' : 'imágenes apuntan'} a una carpeta que no le corresponde; se omitieron.`);
}

/**
 * URLs para dibujar el papel. Map<ref, string|null> con `.avisos`.
 * @param {string[]} refs
 * @param {{contenido, config, versionDoc, almacenes?, metaDeRef?}} ctx
 */
export async function resolverUrls(refs, { contenido, config, versionDoc = null, almacenes, metaDeRef } = {}) {
  const md = await cargarMetaDeRef(metaDeRef);
  const ctx = { contenido, config, versionDoc };
  const out = new Map();
  out.avisos = [];
  const fallas = {};
  let rechazadas = 0;
  await enParalelo([...new Set(refs || [])], 4, async (ref) => {
    const meta = metaSegura(ref, md, ctx);
    if (!meta || meta.rechazada) { out.set(ref, null); if (meta && meta.rechazada) rechazadas++; return; }
    try { out.set(ref, await almacenPara(meta.almacen, almacenes).url(meta)); } catch (e) {
      out.set(ref, null);
      const t = String(ref).split(':')[0];
      fallas[t] = (fallas[t] || 0) + 1;
      console.warn('[informe-brigada] no se pudo leer', ref, (e && (e.code || e.codigo)) || e);
    }
  });
  cerrarAvisos(out, fallas, rechazadas);
  return out;
}

/**
 * Bytes para el Word. Map<ref, {bytes, mime, ancho, alto}|null> con `.avisos`.
 * Comprueba la huella: una firma que no coincide NO se estampa.
 */
export async function resolverBytes(refs, { contenido, config, versionDoc = null, almacenes, metaDeRef } = {}) {
  const md = await cargarMetaDeRef(metaDeRef);
  const ctx = { contenido, config, versionDoc };
  const out = new Map();
  out.avisos = [];
  const fallas = {};
  let rechazadas = 0;
  let alteradas = 0;
  await enParalelo([...new Set(refs || [])], 4, async (ref) => {
    const meta = metaSegura(ref, md, ctx);
    if (!meta || meta.rechazada) { out.set(ref, null); if (meta && meta.rechazada) rechazadas++; return; }
    try {
      const bytes = await almacenPara(meta.almacen, almacenes).bytes(meta);
      if (meta.huella && (await huellaHex(bytes)) !== meta.huella) {
        alteradas++;
        if (String(ref).startsWith('firma:')) { out.set(ref, null); return; }
      }
      out.set(ref, { bytes, mime: meta.mime || mimePorBytes(bytes), ancho: meta.ancho || 0, alto: meta.alto || 0 });
    } catch (e) {
      out.set(ref, null);
      const t = String(ref).split(':')[0];
      fallas[t] = (fallas[t] || 0) + 1;
      console.warn('[informe-brigada] no se pudieron leer los bytes de', ref, (e && (e.code || e.codigo)) || e);
    }
  });
  cerrarAvisos(out, fallas, rechazadas);
  if (alteradas) out.avisos.push(`${alteradas} ${alteradas === 1 ? 'imagen no coincide' : 'imágenes no coinciden'} con su huella (las firmas alteradas no se estampan).`);
  return out;
}
