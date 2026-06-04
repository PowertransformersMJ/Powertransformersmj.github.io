// Renderer · Programado vs No-programado + línea META
// ──────────────────────────────────────────────────────────────
// Desglosa el aporte SAIDI_E / SAIFI_E entre eventos PROGRAMADOS y
// NO PROGRAMADOS (clasificación CLASIFICACION_CREG_063 de la hoja
// DATOS) por mes-calendario, con una línea META interactiva editable
// desde los inputs del card. El dato `prog` es a nivel de fila y solo
// existe cuando se carga el Excel crudo (hoja DATOS); el baseline
// pre-agregado no lo trae → estado vacío amable.

import { $, COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';

// Etiquetas por métrica del eje y de la leyenda.
const SUF = {
  saidi: 'SAIDI_E (h-eq)',
  saifi: 'SAIFI_E (int-eq)',
};

// ¿El dataset trae el desglose programado/no-programado para esta zona?
function progDeZona(dataset, zona) {
  const p = dataset?.prog?.[zona];
  if (!p) return null;
  const prog = p.programado || {};
  const nop  = p.no_programado || {};
  const algo = [prog.saidi, prog.saifi, nop.saidi, nop.saifi].some(
    s => Array.isArray(s) && s.some(v => (+v || 0) !== 0)
  );
  return algo ? p : null;
}

// Estado vacío amable (sin detalle programado/no-programado).
function vacio(motivo) {
  const layout = layoutBase();
  layout.annotations = [{
    text: motivo,
    showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5,
    font: { size: 13, color: '#64748B' }, align: 'center',
  }];
  layout.xaxis = { ...layout.xaxis, visible: false };
  layout.yaxis = { ...layout.yaxis, visible: false };
  Plotly.react('chart-prog', [], layout, plotlyCfg());
}

export function renderProg(dataset, zona, met = 'saidi', metaSaidi = null, metaSaifi = null) {
  if (typeof Plotly === 'undefined' || !dataset) return;

  const pill = $('#chart-prog-pill');
  const p = progDeZona(dataset, zona);
  if (!p) {
    vacio('Sin desglose programado / no-programado<br>' +
          '<span style="font-size:11px">carga el Excel de origen (hoja DATOS · columna CLASIFICACION_CREG_063)</span>');
    if (pill) pill.textContent = 'sin detalle';
    return;
  }

  // El prog chart traza UNA métrica. En modo 'ambos' usa SAIDI_E como
  // métrica principal (la META suele expresarse en SAIDI). El selector
  // de métrica sigue mandando para el resto de gráficas.
  const m = metricasActivas(met)[0];
  const meses = dataset.meses || [];
  const progS = (p.programado?.[m]    || []).map(v => +v || 0);
  const nopS  = (p.no_programado?.[m] || []).map(v => +v || 0);
  const meta  = m === 'saidi' ? metaSaidi : metaSaifi;

  const layout = layoutBase();
  layout.barmode = 'group';
  layout.yaxis = { ...layout.yaxis, title: { text: SUF[m], font: { size: 10 } } };

  const traces = [
    {
      x: meses, y: nopS, name: 'No programado',
      type: 'bar', marker: { color: COLORS.AMBER },
    },
    {
      x: meses, y: progS, name: 'Programado',
      type: 'bar', marker: { color: COLORS.TEAL },
    },
  ];

  // Línea META (horizontal, dashed) cuando hay un valor finito > 0.
  const metaNum = (meta == null || meta === '') ? null : +meta;
  if (metaNum != null && Number.isFinite(metaNum) && metaNum > 0 && meses.length) {
    traces.push({
      x: meses, y: meses.map(() => metaNum),
      name: `META (${metaNum})`,
      type: 'scatter', mode: 'lines',
      line: { color: COLORS.RED, width: 2, dash: 'dash' },
      hovertemplate: `META: ${metaNum}<extra></extra>`,
    });
  }

  Plotly.react('chart-prog', traces, layout, plotlyCfg());

  if (pill) {
    const tot = (a) => a.reduce((x, y) => x + y, 0);
    const tp = tot(progS), tn = tot(nopS);
    const total = tp + tn;
    const pctN = total > 0 ? Math.round((tn / total) * 100) : 0;
    pill.textContent = `${SUF[m]} · no-prog ${pctN}%`;
  }
}
