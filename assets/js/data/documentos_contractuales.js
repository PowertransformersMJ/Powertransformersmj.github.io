// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: documentos contractuales (Fase 3 · 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Resuelve la lista de PDFs de Información Contractual por contrato.
//
// Tres canales con un único API:
//   1. Manifest local (default · GitHub Pages)
//      assets/docs/contratos/{cid}/manifest.json + PDFs en mismo dir
//   2. Firebase Storage (futuro · cuando el director ejecute el
//      script scripts/deploy-pdfs-storage.js)
//      gs://sgm-transpower.appspot.com/contratos/{cid}/{slug}.pdf
//   3. Firestore /contratos/{cid}/documentos (override opcional · si
//      el doc tiene un array `documentos`, gana sobre el manifest)
//
// El frontend siempre llama listarDocumentos(cid) y recibe la misma
// shape independientemente de la fuente.
// ══════════════════════════════════════════════════════════════

import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

// Categorías canónicas con label legible + ícono Lucide.
export const CATEGORIAS_DOC = {
  minuta:        { label: 'Minuta del contrato',  icon: 'file-signature' },
  garantias:     { label: 'Garantías y seguros',  icon: 'shield-check' },
  oferta:        { label: 'Oferta y aceptación',  icon: 'handshake' },
  adenda:        { label: 'Adendas',              icon: 'file-plus' },
  orden:         { label: 'Órdenes y pedidos',    icon: 'package-check' },
  administracion:{ label: 'Administración',       icon: 'briefcase' },
  otros:         { label: 'Otros',                icon: 'file-text' }
};

// Raíz del proyecto resuelta desde import.meta.url. Soporta project
// pages (ajimenezp99-jpg.github.io/repo/) sin asumir el path. Este
// archivo vive en assets/js/data/, así que ../../../ apunta al root.
const BASE_HREF = new URL('../../../', import.meta.url).href;

/**
 * Devuelve la URL pública absoluta de un documento (resuelta contra
 * el root del sitio, NO relativa al path de la página que llama).
 * Esto es crítico porque pages/contrato-info.html vive un nivel
 * adentro y una URL relativa simple se rompe.
 */
export function urlDocumento(cid, slug) {
  if (!cid || !slug) return '';
  return BASE_HREF + `assets/docs/contratos/${cid}/${slug}`;
}

/**
 * Carga el manifest local (GitHub Pages) y devuelve la lista
 * sanitizada. Si no existe, devuelve [].
 */
async function cargarManifest(cid) {
  try {
    const url = BASE_HREF + `assets/docs/contratos/${cid}/manifest.json`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.documentos)) return null;
    return {
      contrato_id: String(json.contrato_id || cid),
      nombre: String(json.nombre || ''),
      documentos: json.documentos.map((d) => ({
        titulo:      String(d.titulo || d.archivo || '').trim(),
        archivo:     String(d.archivo || '').trim(),
        categoria:   CATEGORIAS_DOC[d.categoria] ? d.categoria : 'otros',
        peso_bytes:  Number(d.peso_bytes) || 0,
        url:         urlDocumento(cid, d.archivo)
      })).filter((d) => d.archivo)
    };
  } catch (err) {
    console.warn('[documentos_contractuales] manifest fetch fallo:', err);
    return null;
  }
}

/**
 * Si el doc /contratos/{cid} tiene un array `documentos_contractuales`,
 * lo retorna mergeado con el manifest local (Firestore gana en
 * conflictos por archivo). Esto permite que el director re-ordene,
 * oculte o agregue documentos sin re-deployar el sitio.
 */
async function cargarOverrideFirestore(cid) {
  if (!isFirebaseConfigured) return null;
  const db = getDbSafe();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'contratos', String(cid)));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (!Array.isArray(data.documentos_contractuales)) return null;
    return data.documentos_contractuales.map((d) => ({
      titulo:     String(d.titulo || d.archivo || '').trim(),
      archivo:    String(d.archivo || '').trim(),
      categoria:  CATEGORIAS_DOC[d.categoria] ? d.categoria : 'otros',
      peso_bytes: Number(d.peso_bytes) || 0,
      url:        d.url || urlDocumento(cid, d.archivo)
    })).filter((d) => d.archivo);
  } catch (err) {
    console.warn('[documentos_contractuales] firestore override fallo:', err);
    return null;
  }
}

/**
 * API pública: devuelve la lista combinada de documentos del contrato.
 * El consumidor (UI) recibe la misma shape independientemente de la
 * fuente.
 */
export async function listarDocumentos(cid) {
  const id = String(cid || '').trim();
  if (!id) return [];

  const [manifest, override] = await Promise.all([
    cargarManifest(id),
    cargarOverrideFirestore(id)
  ]);

  const base = manifest ? manifest.documentos : [];
  if (!override || override.length === 0) return base;

  // Merge: Firestore gana por nombre de archivo. Documentos solo en
  // Firestore se anexan al final.
  const map = new Map(base.map((d) => [d.archivo, d]));
  for (const d of override) {
    map.set(d.archivo, { ...map.get(d.archivo), ...d });
  }
  return Array.from(map.values());
}

/**
 * Agrupa una lista de documentos por su categoría. Conserva el orden
 * relativo del input dentro de cada grupo.
 */
export function agruparPorCategoria(documentos) {
  const grupos = new Map();
  for (const cat of Object.keys(CATEGORIAS_DOC)) grupos.set(cat, []);
  for (const d of documentos) {
    const cat = CATEGORIAS_DOC[d.categoria] ? d.categoria : 'otros';
    grupos.get(cat).push(d);
  }
  return Array.from(grupos.entries())
    .filter(([_, docs]) => docs.length > 0)
    .map(([categoria, docs]) => ({
      categoria,
      label: CATEGORIAS_DOC[categoria].label,
      icon:  CATEGORIAS_DOC[categoria].icon,
      docs
    }));
}

/**
 * Formatea el peso de un archivo a string legible.
 */
export function formatearPeso(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
