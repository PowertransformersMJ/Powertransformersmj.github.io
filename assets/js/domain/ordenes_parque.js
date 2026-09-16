// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales SSEE · el parque para el desplegable
// ─────────────────────────────────────────────────────────────────────────────
// El módulo suelto trae el parque COPIADO de la hoja TX_Potencia. En el sitio se
// lee del parque vivo en Firestore, detrás de la sesión (repositorio público:
// `99 §70`; y una copia se queda vieja en cuanto el parque cambia). Esta función
// convierte esos documentos en lo que el desplegable necesita.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Documentos del parque (esquema v2 o aplanado v1) → filas del desplegable.
 *
 * · La llave es matrícula + subestación: la matrícula NO es única por sí sola
 *   (hay una que aparece en dos subestaciones), así que dos documentos con la
 *   misma matrícula y distinta subestación son dos filas; con ambas iguales,
 *   una sola.
 * · Sin matrícula o sin subestación no hay nada que imprimir en «Motivo»: fuera.
 * · La zona va en MAYÚSCULA, que es como la escribe el formato y como agrupa el
 *   desplegable («BOLIVAR», no «bolivar»).
 * · Orden: zona → subestación → matrícula, en español.
 *
 * @param {Array<object>} docs
 * @returns {Array<{matricula:string, subestacion:string, zona:string, potencia:number|null}>}
 */
export function parqueParaOrdenes(docs) {
  const vistos = new Set();
  return (Array.isArray(docs) ? docs : [])
    .map((d) => {
      const x = d || {};
      const id = x.identificacion || {}, ub = x.ubicacion || {}, pl = x.placa || {};
      const pot = Number(pl.potencia_kva != null ? pl.potencia_kva : x.potencia_kva);
      return {
        matricula: String(id.matricula || x.matricula || '').trim(),
        subestacion: String(ub.subestacion_nombre || x.subestacion || '').trim(),
        zona: String(ub.zona || x.zona || '').trim().toUpperCase(),
        potencia: Number.isFinite(pot) && pot > 0 ? pot : null
      };
    })
    .filter((t) => t.matricula && t.subestacion)
    .filter((t) => {
      const k = t.matricula.toUpperCase() + '|' + t.subestacion.toUpperCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .sort((a, b) => a.zona.localeCompare(b.zona, 'es')
      || a.subestacion.localeCompare(b.subestacion, 'es')
      || a.matricula.localeCompare(b.matricula, 'es'));
}
