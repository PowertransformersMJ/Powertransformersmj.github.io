// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · AGREGADORES
// ──────────────────────────────────────────────────────────────
// Reducers PUROS sobre arreglos de eventos SCADA. Sin DOM ni I/O.
// Cada función recibe el conjunto YA filtrado por scope global
// (la composición la hace el shell o el caller).
// ══════════════════════════════════════════════════════════════

import { magnitudeOf, HEATMAP_PARAMS } from './scada_config.js';

// ── KPI band ──────────────────────────────────────────────────
// total, viol, u1, u2, trafos, subs, voltage, current, power, maxViol
export function aggKPIs(events) {
  const k = {
    total: 0, viol: 0, u1: 0, u2: 0,
    trafos: new Set(), subs: new Set(),
    maxViol: null,
    voltage: 0, current: 0, power: 0,
  };
  for (const e of events) {
    k.total++;
    if (!e.viol) continue;
    k.viol++;
    if (e.u === 'U1') k.u1++;
    else if (e.u === 'U2') k.u2++;
    k.trafos.add(e.sid);
    k.subs.add(e.sub);
    if (!k.maxViol || e.v > k.maxViol.v) k.maxViol = e;
    const mag = magnitudeOf(e.param);
    if (mag === 'voltage')      k.voltage++;
    else if (mag === 'current') k.current++;
    else if (mag === 'power')   k.power++;
  }
  k.trafos = k.trafos.size;
  k.subs   = k.subs.size;
  return k;
}

// ── Top 10 transformadores ─────────────────────────────────────
// magFilter: 'all' | 'voltage' | 'current' | 'power'
export function aggTop10(events, magFilter = 'all') {
  const map = new Map();
  for (const e of events) {
    if (!e.viol) continue;
    if (magFilter !== 'all' && magnitudeOf(e.param) !== magFilter) continue;
    const key = e.sid;
    if (!map.has(key)) {
      map.set(key, {
        sid: key, sub: e.sub, asset: e.asset, kv: e.kv, zona: e.zona,
        name: `${e.sub} ${e.asset} ${e.kv}`,
        total: 0, u1: 0, u2: 0, maxV: 0,
      });
    }
    const s = map.get(key);
    s.total++;
    if (e.u === 'U1') s.u1++;
    else if (e.u === 'U2') s.u2++;
    if (e.v > s.maxV) s.maxV = e.v;
  }
  const arr = [...map.values()];
  arr.sort((a, b) => b.total - a.total);
  return arr.slice(0, 10);
}

// ── Tendencia (hourly | daily) ────────────────────────────────
// Devuelve [{label, U1, U2}, ...]
export function aggTrend(events, scope = 'daily') {
  const u1 = new Map(), u2 = new Map();
  const fmt = scope === 'hourly'
    ? (ts) => ts.slice(11, 13) + ':00'
    : (ts) => ts.slice(0, 10);
  for (const e of events) {
    if (!e.viol) continue;
    const k = fmt(e.ts);
    if (e.u === 'U1') u1.set(k, (u1.get(k) || 0) + 1);
    else if (e.u === 'U2') u2.set(k, (u2.get(k) || 0) + 1);
  }
  const labels = new Set([...u1.keys(), ...u2.keys()]);
  if (scope === 'hourly') {
    for (let h = 0; h < 24; h++) labels.add(`${String(h).padStart(2, '0')}:00`);
  }
  return [...labels].sort().map(k => ({ label: k, U1: u1.get(k) || 0, U2: u2.get(k) || 0 }));
}

// ── Por zona ──────────────────────────────────────────────────
export function aggByZona(events) {
  const m = new Map();
  for (const e of events) {
    if (!e.viol) continue;
    const z = e.zona || 'SIN_ZONA';
    m.set(z, (m.get(z) || 0) + 1);
  }
  return [...m.entries()]
    .map(([zona, violations]) => ({ zona, violations }))
    .sort((a, b) => b.violations - a.violations);
}

// ── Por parámetro SCADA ───────────────────────────────────────
export function aggByParam(events) {
  const m = new Map();
  for (const e of events) {
    if (!e.viol) continue;
    m.set(e.param, (m.get(e.param) || 0) + 1);
  }
  return [...m.entries()]
    .map(([parameter, violations]) => ({ parameter, violations }))
    .sort((a, b) => b.violations - a.violations);
}

// ── Heatmap top 15 subestaciones × parámetro ──────────────────
export function aggHeatmap(events) {
  const bySub = new Map();
  for (const e of events) {
    if (!e.viol) continue;
    if (!bySub.has(e.sub)) bySub.set(e.sub, {});
    const row = bySub.get(e.sub);
    row[e.param] = (row[e.param] || 0) + 1;
  }
  const rows = [...bySub.entries()].map(([sub, vals]) => {
    const total = Object.values(vals).reduce((s, v) => s + v, 0);
    return { sub, total, ...vals };
  });
  rows.sort((a, b) => b.total - a.total);
  return { rows: rows.slice(0, 15), params: [...HEATMAP_PARAMS] };
}

// ── Filtros disponibles (catálogos derivados del dataset) ─────
// Devuelve {subs, assets, kvs, zonas} en orden alfabético
// para alimentar los <select> de la tabla filtrable.
export function aggFiltros(events) {
  const s = (acc, key) => {
    acc[key] = [...new Set(events.map(e => e[key]))].filter(Boolean).sort();
    return acc;
  };
  return s(s(s(s({}, 'sub'), 'asset'), 'kv'), 'zona');
}
