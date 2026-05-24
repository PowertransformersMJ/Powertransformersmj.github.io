// ══════════════════════════════════════════════════════════════
// Renderer · KPI band (7 tarjetas)
// ══════════════════════════════════════════════════════════════

import { aggKPIs } from '../../../domain/scada_violaciones.js';
import { scopedEvents } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderKPIs() {
  const k = aggKPIs(scopedEvents());
  const sev = k.maxViol;
  const sev_label = sev ? `${sev.m.toLocaleString()} ${sev.uom}` : '—';
  const sev_ctx = sev
    ? `${sev.sub} · ${sev.asset} · ${sev.param}<br>límite ${sev.l} ${sev.uom} · Δ+${sev.v.toFixed(1)}`
    : '';

  const kpis = [
    { label: 'Eventos APPEAR U1/U2',    value: k.total.toLocaleString(), klass: 'blue' },
    { label: 'Violaciones reales',      value: k.viol.toLocaleString(),  klass: 'red',
      delta: `${((k.viol / Math.max(k.total, 1)) * 100).toFixed(1)}% del total` },
    { label: 'U1 (banda 1)',            value: k.u1.toLocaleString(),    klass: 'amber' },
    { label: 'U2 (banda 2 · severa)',   value: k.u2.toLocaleString(),    klass: 'red',
      delta: `${((k.u2 / Math.max(k.viol, 1)) * 100).toFixed(1)}% del total` },
    { label: 'Trafos afectados',        value: k.trafos,                 klass: 'teal' },
    { label: 'Subestaciones',           value: k.subs,                   klass: 'purple' },
    { label: 'Pico medido (outlier)',   value: sev_label,                klass: 'red',
      delta: sev_ctx, smaller: true },
  ];
  const host = $('#kpi-grid');
  if (host) {
    host.innerHTML = kpis.map(x => `
      <div class="kpi ${x.klass}">
        <div class="label">${x.label}</div>
        <div class="value${x.smaller ? ' smaller' : ''}">${x.value}</div>
        ${x.delta ? `<div class="delta">${x.delta}</div>` : ''}
      </div>`).join('');
  }

  // Contadores de tabs
  const ids = { all: 'tabct-all', voltage: 'tabct-voltage', current: 'tabct-current', power: 'tabct-power' };
  const counts = { all: k.viol, voltage: k.voltage, current: k.current, power: k.power };
  Object.entries(ids).forEach(([key, id]) => {
    const el = $('#' + id);
    if (el) el.textContent = counts[key].toLocaleString();
  });
}
