// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: la tabla «Devanados de placa» del detalle con los valores de la PLACA · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): «si estamos tomando los valores de placa, ¿por qué calculas potencia? Donde sí debemos
// calcular corriente es en las placas que no traen ampacidad; del resto, todos los valores son de placa».
// Por devanado: tensión, potencia (sus etapas) y corriente nominal de la placa leída (`limitesDePlaca`): la corriente IMPRESA
// y, solo si la placa no la graba, la calculada con su potencia y su tensión. La cargabilidad del rango va contra esa
// corriente. Sin placa leída para un devanado, sus valores son los de la plataforma y se dice. Si la ampacidad de la
// plataforma (la que usa la cifra oficial) no es la de placa, se anota con la cifra oficial al lado. Funciones PURAS.
// Archivo NUEVO (L-102): el detalle lo importa; ningún módulo ya publicado importa de aquí algo que no exista.
// ══════════════════════════════════════════════════════════════

const ETIQ = Object.freeze({ ONAN: 'ONAN', ONAF1: 'ONAF', ONAF2: 'ONAF II' });
const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Filas de la tabla con los valores de placa.
 * @param {Array} ds  `devanadosDe(tx, calc)`: {d, nombre, kv, A, mva, conexion, niveles, pct, iP99, manda, aviso}
 * @param {object|null} lp  `limitesDePlaca(placa, tx)`, o null si el equipo no tiene placa leída
 * @returns {Array<{d, nombre, manda, niveles, iP99, aviso,
 *   tension: {kv, origen: 'placa'|'plataforma', kvSistema},
 *   potencia: {mva: number[], nombres: string[], origen: 'placa'|'calculada'} | {compensacion: true},
 *   ampacidad: {A, origen: 'impresa'|'calculada'|'plataforma', onan, plataforma},
 *   pct, pctOficial}>}
 *   `ampacidad.plataforma` = la de la plataforma SOLO si difiere más de 2 % de la de placa (`plataformaEsOnan`: es la ONAN de
 *   la placa, p. ej. con la ventilación fuera de servicio); `pctOficial` = la cargabilidad con ella (la cifra oficial), solo en
 *   ese caso.
 */
export function filasDevanadosPlaca(ds, lp) {
  return (ds || []).map((d) => {
    const base = { d: d.d, nombre: d.nombre, manda: !!d.manda, niveles: d.niveles || [], iP99: d.iP99 ?? null, aviso: d.aviso || null };
    const p = lp && lp[d.d];
    if (p && p.sinLimite) {
      return { ...base, tension: { kv: p.kv || d.kv, origen: p.kv ? 'placa' : 'plataforma', kvSistema: d.kv },
        potencia: { compensacion: true }, ampacidad: { A: null, origen: 'placa', onan: null, plataforma: null }, pct: null, pctOficial: null };
    }
    if (p && p.A && p.A.length) {
      const k = p.A.length - 1;
      const A = p.A[k];
      const difiere = pos(d.A) && Math.abs(d.A / A - 1) > 0.02;
      // La plataforma puede usar a propósito la ONAN de la placa (ventilación fuera de servicio): no es un error de dato.
      const usaOnan = difiere && p.A.length > 1 && Math.abs(d.A / p.A[0] - 1) <= 0.02;
      const pct = base.iP99 != null ? 100 * base.iP99 / A : null;
      return { ...base,
        tension: { kv: p.kv, origen: 'placa', kvSistema: d.kv },
        potencia: { mva: p.kva.map((s) => s / 1000), nombres: p.nombres.map((n) => ETIQ[n] || n), origen: 'placa' },
        ampacidad: { A, origen: (p.origenA && p.origenA[k]) || 'calculada', onan: p.A.length > 1 ? p.A[0] : null, onanOrigen: p.A.length > 1 ? ((p.origenA && p.origenA[0]) || 'calculada') : null,
          plataforma: difiere ? d.A : null, plataformaEsOnan: !!usaOnan },
        pct, pctOficial: difiere ? d.pct : null };
    }
    // Sin valores de placa para este devanado: los de la plataforma (su potencia, calculada con tensión y ampacidad).
    return { ...base, tension: { kv: d.kv, origen: 'plataforma', kvSistema: d.kv },
      potencia: { mva: d.mva != null ? [d.mva] : [], nombres: [], origen: 'calculada' },
      ampacidad: { A: d.A, origen: 'plataforma', onan: null, plataforma: null }, pct: d.pct, pctOficial: null };
  });
}
