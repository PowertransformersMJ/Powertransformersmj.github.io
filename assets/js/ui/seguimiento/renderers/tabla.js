// ══════════════════════════════════════════════════════════════
// Renderer · Tabla filtrable de eventos (último bloque)
// ══════════════════════════════════════════════════════════════

import { magnitudeOf } from '../../../domain/scada_config.js';
import { scopedEvents } from '../state.js';

const $ = (sel) => document.querySelector(sel);

function lecturaFiltros() {
  const v = (id) => { const el = $('#' + id); return el ? el.value : ''; };
  return {
    fmag:  v('f-mag'),
    fsub:  v('f-sub'),
    fa:    v('f-asset'),
    fk:    v('f-kv'),
    fz:    v('f-zona'),
    fu:    v('f-unit'),
    fminv: parseFloat(v('f-minv')) || 0,
  };
}

export function renderTabla() {
  const f = lecturaFiltros();
  const scoped = scopedEvents();
  const filtered = scoped.filter(e =>
    e.viol &&
    (!f.fmag || magnitudeOf(e.param) === f.fmag) &&
    (!f.fsub || e.sub   === f.fsub) &&
    (!f.fa   || e.asset === f.fa) &&
    (!f.fk   || e.kv    === f.fk) &&
    (!f.fz   || e.zona  === f.fz) &&
    (!f.fu   || e.u     === f.fu) &&
    e.v >= f.fminv
  );
  filtered.sort((a, b) => b.v - a.v);
  const view = filtered.slice(0, 500);

  const tb = document.querySelector('#events-table tbody');
  if (tb) {
    tb.innerHTML = view.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.ts.slice(11, 19)}</td>
        <td>${e.sub}</td>
        <td>${e.asset}</td>
        <td>${e.kv}</td>
        <td><span class="zona-pill">${e.zona || '—'}</span></td>
        <td>${e.param}</td>
        <td><span class="u-pill ${(e.u || '').toLowerCase()}">${e.u}</span></td>
        <td class="num">${e.m.toFixed(3)} ${e.uom}</td>
        <td class="num">${e.l.toFixed(3)}</td>
        <td class="num num-bad">+${e.v.toFixed(3)}</td>
        <td class="num">${(e.vp || 0).toFixed(2)}%</td>
      </tr>`).join('');
  }
  const scopedViol = scoped.filter(e => e.viol).length;
  const tag = $('#filter-count');
  if (tag) {
    tag.textContent = `${filtered.length.toLocaleString()} / ${scopedViol.toLocaleString()} (mostrando hasta 500)`;
  }
  // Cache para exportar CSV
  window._filteredEvents = filtered;
}

// ── Bind único de los listeners de la tabla ──────────────────
let _bound = false;
export function inicializarTabla() {
  if (_bound) return;
  _bound = true;
  ['f-mag', 'f-sub', 'f-asset', 'f-kv', 'f-zona', 'f-unit'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('change', renderTabla);
  });
  const minv = $('#f-minv');
  if (minv) minv.addEventListener('input', renderTabla);
}

// ── Export CSV (helper colocado aquí porque usa _filteredEvents) ───
export function exportCSV() {
  const filtered = window._filteredEvents || [];
  if (!filtered.length) return { ok: false, count: 0 };
  const hdr = 'date,time,substation,asset,voltage_level,zona,parameter,unit,measured,unit_of_measure,limit,violation,violation_pct';
  const rows = filtered.map(e =>
    [e.date, e.ts.slice(11, 19), e.sub, e.asset, e.kv, e.zona, e.param, e.u, e.m, e.uom, e.l, e.v, e.vp].join(',')
  );
  const csv = hdr + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scada_violaciones_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, count: filtered.length };
}
