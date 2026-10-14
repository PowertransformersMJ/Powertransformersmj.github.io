// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · «Descargar Word»
// ──────────────────────────────────────────────────────────────────────────────
// Arma el .docx del MISMO Documento que se ve en «Ver hojas» y lo entrega al
// navegador. Las imágenes se piden al almacén (bytes) con `resolverBytes`; las
// fotos con óvalos rojos se hornean antes (lienzo, `imagenes.js`) porque en Word
// van dentro de la foto. Si algo falta, el Word sale igual, con su recuadro
// «pendiente» y un aviso en palabras: nunca se inventa una imagen.
// Se carga con import() solo al pulsar el botón (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { construirDocx, refsDeImagenes, fotosConMarcas, MIME_DOCX } from '../../domain/informe_brigada_docx.js';
import { crearZip } from '../../domain/zip_almacenado.js';

/** Nombre de archivo seguro: «INFORME T9-Z_Z-PRU.docx» (sin / \ : * ? " < > |). */
export function nombreArchivo(documento) {
  const base = String((documento && documento.meta && documento.meta.titulo) || 'INFORME')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim() || 'INFORME';
  return `${base}.docx`;
}

/** Carga el horneado de óvalos solo si hace falta (módulo de imágenes, con lienzo). */
async function cargarHorneado() {
  try {
    const m = await import('./imagenes.js');
    return typeof m.hornearMarcas === 'function' ? m.hornearMarcas : null;
  } catch (err) {
    console.warn('[informe-brigada] no se pudo cargar el módulo de imágenes para los óvalos:', err);
    return null;
  }
}

const aBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

/**
 * @param {object} p
 * @param {object} p.documento  Documento del informe (construirDocumento)
 * @param {(refs: string[]) => Promise<Map<string, {bytes: Uint8Array, mime: string, ancho: number, alto: number}|null>>} p.resolverBytes
 * @param {(blob: Blob, marcas: object[]) => Promise<Blob>} [p.hornear]  por defecto `hornearMarcas` de imagenes.js
 * @returns {Promise<{ blob: Blob, nombre: string, avisos: string[], bytes: number }>}
 */
export async function exportarWord({ documento, resolverBytes, hornear } = {}) {
  if (!documento || !Array.isArray(documento.bloques)) throw new Error('No hay informe para exportar.');
  if (typeof resolverBytes !== 'function') throw new Error('No hay de dónde leer las imágenes del informe.');
  const avisos = [];
  const refs = refsDeImagenes(documento);
  let mapa = new Map();
  try {
    mapa = (await resolverBytes(refs)) || new Map();
  } catch (err) {
    console.warn('[informe-brigada] no se pudieron leer las imágenes:', err);
    avisos.push('No se pudieron leer las imágenes del almacenamiento: el Word sale con los recuadros «pendiente».');
  }
  if (Array.isArray(mapa.avisos)) avisos.push(...mapa.avisos);
  const imagenes = new Map(mapa);

  // Óvalos rojos: se dibujan DENTRO de la foto (la foto guardada no cambia; esto es solo para el Word)
  const marcadas = fotosConMarcas(documento).filter((x) => imagenes.get(x.ref));
  if (marcadas.length) {
    const fn = typeof hornear === 'function' ? hornear : await cargarHorneado();
    if (fn) {
      for (const x of marcadas) {
        const base = imagenes.get(x.ref);
        try {
          const salida = await fn(new Blob([base.bytes], { type: base.mime || 'image/jpeg' }), x.marcas, x.anchoPt);
          imagenes.set(x.clave, { bytes: await aBytes(salida), mime: salida.type || 'image/jpeg', ancho: base.ancho, alto: base.alto });
        } catch (err) {
          console.warn('[informe-brigada] óvalos de una foto:', err);
        }
      }
    }
  }

  const { partes, avisos: avisosDocx } = construirDocx(documento, imagenes, { creado: new Date().toISOString() });
  const bytes = crearZip(partes);
  const blob = new Blob([bytes], { type: MIME_DOCX });
  return { blob, nombre: nombreArchivo(documento), avisos: avisos.concat(avisosDocx), bytes: bytes.length };
}

/** Entrega el archivo al navegador (mismo patrón de Fichas, `ui/fichas/panel.js:4866-4876`). */
export function descargar(blob, nombre) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
