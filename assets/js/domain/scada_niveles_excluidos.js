// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: niveles que el SCADA SÍ mide pero que la homologación dejó en «No usar» · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23, San Benito de Abad): la página decía «no se mide» del lado de 34,5 kV, pero el SCADA sí lo
// mide; se excluyó en la homologación porque su escala está errada. «No se mide» y «se mide pero se excluyó» son cosas
// distintas y la página debe decir cuál es, con el motivo que el Ingeniero escribió en la nota de la decisión (escala errada en
// San Benito, suma de dos transformadores en Puerto Libertador y Lorica). Funciones PURAS.
// Archivo NUEVO (L-102): los módulos ya publicados lo importan; solo importa exportaciones que ya existen en producción.
// ══════════════════════════════════════════════════════════════

import { mapaNivelDevanado, mapaDeDecision, placaDe } from './scada_carga_homologacion.js';

/**
 * Niveles del punto que la decisión de homologación «usar» dejó SIN devanado («No usar»), con el devanado al que
 * corresponderían por su tensión de placa. Sin decisión, o con «Excluir», no hay niveles excluidos (un nivel sin devanado por
 * tensión sigue siendo «sin devanado»). Un nivel que apareció DESPUÉS de la decisión (no está en `niveles_vistos`) tampoco:
 * ese queda «por revisar».
 * @param {{tx: object, fila: object|null, punto: {niveles: object}|null}} p
 * @returns {{porNivel: Object<string, {devanado: 'P'|'S'|'T'|null}>, porDevanado: Object<string, string[]>, nota: string|null}}
 */
export function nivelesExcluidos({ tx, fila, punto } = {}) {
  const out = { porNivel: {}, porDevanado: {}, nota: null };
  const dec = fila && fila.decision;
  const mapa = mapaDeDecision(fila);
  if (!dec || dec.tipo !== 'usar' || !mapa) return out;
  const niveles = Object.keys((punto && punto.niveles) || {});
  const vistos = Array.isArray(dec.niveles_vistos) && dec.niveles_vistos.length ? dec.niveles_vistos : niveles;
  const auto = mapaNivelDevanado(niveles, placaDe(tx)).mapa;
  for (const nv of niveles) {
    if (mapa[nv] || !vistos.includes(nv)) continue;
    const d = auto[nv] || null;
    out.porNivel[nv] = { devanado: d };
    if (d) (out.porDevanado[d] = out.porDevanado[d] || []).push(nv);
  }
  if (Object.keys(out.porNivel).length) out.nota = String(dec.nota || '').trim() || null;
  return out;
}

/**
 * La nota de la decisión, corta para una celda: hasta el primer punto seguido (si deja al menos 30 caracteres) o `max`
 * caracteres con «…». Sin nota → null.
 */
export function notaCorta(nota, max = 150) {
  const t = String(nota || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const punto = t.search(/\.\s/);
  const corte = punto >= 30 && punto < max ? t.slice(0, punto + 1) : t;
  return corte.length > max ? corte.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '') + '…' : corte;
}
