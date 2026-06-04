// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · RANKING DIARIO
// ──────────────────────────────────────────────────────────────
// Bump chart: evolución de la posición en el Top de violaciones
// día a día. Función PURA. Respeta el filtro de zona pero NO el
// filtro temporal (siempre muestra todos los días para ver la
// trayectoria completa).
// ══════════════════════════════════════════════════════════════

import { magnitudeOf } from './scada_config.js';

/**
 * Calcula ranking por día para una magnitud específica.
 * @param {Array} events     Dataset completo (allEvents)
 * @param {Object} opts
 * @param {string} opts.zona     Filtro de zona ('' = todas)
 * @param {string} opts.magFilter 'all' | 'voltage' | 'current' | 'power'
 * @returns {{dates:string[], ranking:Object, metaBy:Map}}
 *
 * ranking[date] = [{sid, count, rank, name, zona}, ...]
 */
export function buildDailyRanking(events, { zona = '', magFilter = 'all' } = {}) {
  let src = events;
  if (zona) src = src.filter(e => e.zona === zona);

  const byDate = new Map();
  const metaBy = new Map();
  for (const e of src) {
    if (!e.viol) continue;
    if (magFilter !== 'all' && magnitudeOf(e.param) !== magFilter) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, new Map());
    const dm = byDate.get(e.date);
    dm.set(e.sid, (dm.get(e.sid) || 0) + 1);
    if (!metaBy.has(e.sid)) {
      metaBy.set(e.sid, { name: `${e.sub} ${e.asset} ${e.kv}`, zona: e.zona });
    }
  }

  const dates = [...byDate.keys()].sort();
  const ranking = {};
  for (const d of dates) {
    const items = [...byDate.get(d).entries()].sort((a, b) => b[1] - a[1]);
    ranking[d] = items.map(([sid, count], i) => ({
      sid, count, rank: i + 1,
      name:  metaBy.get(sid).name,
      zona:  metaBy.get(sid).zona,
    }));
  }
  return { dates, ranking, metaBy };
}

/**
 * Para cada sid presente en el ranking, devuelve {best, worst, series}
 * donde `series` es el ranking en cada día (null si ese día no apareció).
 */
export function calcularHistorial({ dates, ranking, metaBy }) {
  const hist = {};
  for (const sid of metaBy.keys()) {
    const ranks = dates.map(d => {
      const r = ranking[d].find(z => z.sid === sid);
      return r ? r.rank : null;
    });
    const valid = ranks.filter(x => x !== null);
    if (valid.length) {
      hist[sid] = {
        best:   Math.min(...valid),
        worst:  Math.max(...valid),
        series: ranks,
      };
    }
  }
  return hist;
}

/**
 * Calcula el delta de posición vs el día anterior.
 * Devuelve {delta, cls} donde cls ∈ 'new'|'up'|'down'|'same'
 */
export function deltaPosicion(rank, prevRank) {
  if (prevRank === undefined || prevRank === null) {
    return { delta: 'NEW', cls: 'new' };
  }
  const d = prevRank - rank;
  if (d > 0)  return { delta: '▲ ' + d,            cls: 'up' };
  if (d < 0)  return { delta: '▼ ' + Math.abs(d),  cls: 'down' };
  return       { delta: '=',                       cls: 'same' };
}

/**
 * Sparkline ASCII de 1 línea para la serie de rankings de un sid.
 * Convención: rank 1 = mejor (bloque alto), peor rank = bloque bajo.
 * Días sin presencia se renderean como espacio.
 */
export function rankSparkline(series) {
  const blocks = '▁▂▃▄▅▆▇█';
  const valid = series.filter(x => x !== null);
  if (!valid.length) return '';
  const max = Math.max(...valid), min = Math.min(...valid);
  return series.map(r => {
    if (r === null) return ' ';
    const norm = max === min ? 0.5 : (max - r) / (max - min);
    return blocks[Math.round(norm * (blocks.length - 1))];
  }).join('');
}
