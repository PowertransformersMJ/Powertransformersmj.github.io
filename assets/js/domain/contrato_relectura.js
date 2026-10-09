// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cuándo volver a leer las Órdenes E/S en el contrato
// ──────────────────────────────────────────────────────────────
// Defecto (2026-10-09, visto en producción): el tablero del contrato y la pestaña
// Movimiento leen las órdenes de entrada y salida UNA vez por visita (free-tier: no hay
// escucha en vivo sobre `ordenes_materiales`), pero los movimientos sí llegan en vivo. Si
// con el contrato abierto alguien edita o elimina una orden, el registro automático
// (`99 §148`) retira o crea su movimiento ENLAZADO (`orden_es`) y la página lo ve al
// instante, mientras sigue usando la orden VIEJA en memoria: la cuenta «por registrar» y
// las cifras quedan infladas hasta recargar.
//
// Regla: las órdenes se vuelven a leer (con la misma lectura acotada a la vigencia) cuando
//  (a) cambia un movimiento enlazado — los cambios seguidos se agrupan en UNA lectura;
//  (b) la pestaña vuelve a verse y la última lectura tiene más de un minuto;
//  (c) la persona pulsa «Actualizar».
//
// Módulo PURO (sin Firebase ni DOM). El temporizador del agrupador se inyecta para poder
// probarlo. Se carga con import() perezoso (`32 L-102`): si falta, la página sigue como antes.
// ══════════════════════════════════════════════════════════════

/** Al volver a la pestaña, se releen las órdenes solo si la última lectura tiene más de esto. */
export const RELEER_AL_VOLVER_MS = 60 * 1000;
/** Espera para juntar cambios seguidos (una corrección retira y vuelve a registrar: dos cambios). */
export const AGRUPAR_CAMBIOS_MS = 1500;

/**
 * Huella de los movimientos ENLAZADOS a órdenes E/S (los que traen `orden_es`). Cambia si uno
 * se crea, se retira o cambia su cantidad, valor, código o la orden a la que apunta. Los
 * movimientos manuales no cuentan: no dicen nada de las órdenes.
 * @param {Array<object>} movimientos
 * @returns {string}
 */
export function firmaEnlazados(movimientos) {
  if (!Array.isArray(movimientos)) return '';
  const partes = [];
  for (const m of movimientos) {
    const o = m && m.orden_es;
    if (!o || typeof o !== 'object') continue;
    partes.push([m.id, m.codigo, m.suministro_id, m.cantidad, m.valor_total,
      o.clave, o.version, o.fechaISO, o.transformador]
      .map((x) => String(x == null ? '' : x)).join('~'));
  }
  return partes.sort().join('|');
}

/**
 * (a) ¿Hay que volver a leer las órdenes porque cambió un movimiento enlazado?
 * La primera huella (sin una anterior) es el punto de partida: no dispara lectura.
 * @param {string|null} firmaAnterior
 * @param {string|null} firmaNueva
 */
export function cambiaronEnlazados(firmaAnterior, firmaNueva) {
  if (firmaAnterior == null || firmaNueva == null) return false;
  return firmaAnterior !== firmaNueva;
}

/**
 * (b) ¿Hay que volver a leer las órdenes al volver a la pestaña?
 * Solo si la pestaña se ve, no hay una lectura en curso, ya hubo una lectura (si nunca se
 * leyó, la página no usa órdenes o la primera lectura todavía no termina) y pasó más del umbral.
 * @param {{ visible:boolean, ultimaLecturaMs:number|null, ahoraMs:number, leyendo?:boolean, umbralMs?:number }} p
 */
export function releerAlVolver({ visible, ultimaLecturaMs, ahoraMs, leyendo = false, umbralMs = RELEER_AL_VOLVER_MS } = {}) {
  if (!visible || leyendo) return false;
  if (!Number.isFinite(ultimaLecturaMs) || !Number.isFinite(ahoraMs)) return false;
  return ahoraMs - ultimaLecturaMs > umbralMs;
}

/** «hh:mm» (24 h, hora local) de un instante en milisegundos; '' si no hay instante. */
export function horaCorta(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/**
 * Texto junto al rótulo del nexo, sin jerga.
 * @param {{ leidasMs?:number|null, leyendo?:boolean, error?:string }} p
 *   leidasMs: hora de la última lectura BUENA · leyendo: hay una lectura en curso o por empezar ·
 *   error: la última relectura falló (se siguen mostrando las órdenes anteriores).
 */
export function textoLectura({ leidasMs = null, leyendo = false, error = '' } = {}) {
  const hora = horaCorta(leidasMs);
  if (leyendo) return hora ? `Actualizando las órdenes… (leídas a las ${hora})` : 'Leyendo las órdenes…';
  if (error) {
    return hora
      ? `No se pudieron volver a leer las órdenes (${error}). Se muestran las leídas a las ${hora}.`
      : `No se pudieron leer las órdenes (${error}).`;
  }
  return hora ? `Órdenes leídas a las ${hora}` : '';
}

/**
 * Lector de órdenes que (1) agrupa pedidos seguidos: `pedir()` espera `agruparMs` sin pedidos
 * nuevos; (2) lee enseguida con `ya()`; (3) nunca corre dos lecturas a la vez; y (4) si llega un
 * pedido mientras lee, al terminar lee UNA vez más (la lectura en curso pudo empezar antes del
 * cambio). Los errores de `leer` no lo detienen: `leer` avisa los suyos.
 * @param {{ leer: () => any, agruparMs?: number, temporizador?: { setTimeout: Function, clearTimeout: Function } }} opts
 * @returns {{ pedir: () => void, ya: () => Promise<void>, leyendo: () => boolean, esperando: () => boolean, parar: () => void }}
 */
export function crearRelector({ leer, agruparMs = AGRUPAR_CAMBIOS_MS, temporizador = null } = {}) {
  if (typeof leer !== 'function') throw new TypeError('crearRelector: falta leer()');
  const t = temporizador || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h) };
  let espera = null;      // pedido agrupado en espera
  let enCurso = null;     // promesa de la lectura en curso
  let otraVez = false;    // llegó un pedido durante la lectura
  let parado = false;

  const cancelarEspera = () => { if (espera != null) { t.clearTimeout(espera); espera = null; } };
  function correr() {
    if (parado) return Promise.resolve();
    if (enCurso) { otraVez = true; return enCurso; }
    otraVez = true;
    enCurso = (async () => {
      await null;                                   // `enCurso` queda asignado antes de leer
      while (otraVez && !parado) {
        otraVez = false;
        try { await leer(); } catch (_) { /* leer avisa sus propios errores */ }
      }
      enCurso = null;                               // en el mismo paso que la última comprobación: no se pierde un pedido
    })();
    return enCurso;
  }
  return {
    pedir() {
      if (parado) return;
      cancelarEspera();
      espera = t.setTimeout(() => { espera = null; correr(); }, agruparMs);
    },
    ya() { cancelarEspera(); return correr(); },
    leyendo() { return !!enCurso; },
    esperando() { return espera != null; },
    parar() { parado = true; cancelarEspera(); }
  };
}
