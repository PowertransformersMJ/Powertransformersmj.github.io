// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · filtro «Devanado sobrecargado» (dominio puro) · 2026-10-27
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero: «sí, agrega el filtro por devanado» (tras ADR-185: cada sobrecarga dice su devanado). Un equipo
// entra si su sobrecarga sostenida —la de la fila (`sobrecarga`, mes o periodo) o la de ANTES de un cambio de medida
// (`sobrecargaAnterior`, ADR-186)— está en alguno de los devanados elegidos. Sin sobrecarga no tiene devanados y no entra.
// Una fila de un dominio viejo en caché (sin `sobrecarga`) no dice su devanado: con el filtro activo no entra (L-102).
// Funciones PURAS. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

export const DEVANADOS_FILTRO = Object.freeze([['P', 'Primario'], ['S', 'Secundario'], ['T', 'Terciario']]);

/** Los devanados con sobrecarga sostenida de una fila de la lista: subconjunto ordenado de ['P', 'S', 'T']. */
export function devanadosSobrecargados(x) {
  const s = new Set();
  for (const fuente of [x && x.sobrecarga, x && x.sobrecargaAnterior]) {
    for (const d of (fuente && Array.isArray(fuente.devanados) ? fuente.devanados : [])) if (d && d.devanado) s.add(d.devanado);
  }
  return ['P', 'S', 'T'].filter((d) => s.has(d));
}

/** ¿La fila pasa el filtro? Sin devanados elegidos, todas pasan. */
export function pasaFiltroDevanado(x, elegidos) {
  const e = new Set((Array.isArray(elegidos) ? elegidos : (elegidos ? [elegidos] : [])).map(String));
  if (!e.size) return true;
  return devanadosSobrecargados(x).some((d) => e.has(d));
}

/** Cuántas filas tienen sobrecarga en cada devanado (para rotular las opciones del filtro). */
export function conteoPorDevanado(filas) {
  const c = { P: 0, S: 0, T: 0 };
  for (const x of filas || []) for (const d of devanadosSobrecargados(x)) c[d]++;
  return c;
}
