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

// Suma corrida mes a mes (aporte acumulado a la fecha).
function acumular(arr) {
  let s = 0;
  return arr.map(v => (s += (+v || 0)));
}

export function renderProg(dataset, zona, met = 'saidi', metaSaidi = null, metaSaifi = null, progModo = 'mes') {
  if (typeof Plotly === 'undefined' || !dataset) return;

  const pill = $('#chart-prog-pill');
  const p = progDeZona(dataset, zona);

  // El prog chart traza UNA métrica. En modo 'ambos' usa SAIDI_E como
  // métrica principal (la META suele expresarse en SAIDI). El selector
  // de métrica sigue mandando para el resto de gráficas.
  const m = metricasActivas(met)[0];
  const meses = dataset.meses || [];
  const meta  = m === 'saidi' ? metaSaidi : metaSaifi;

  // La META es independiente del desglose programado/no-programado: se
  // dibuja como línea de referencia siempre que haya un valor finito > 0.
  const metaNum = (meta == null || meta === '') ? null : +meta;
  const metaValida = metaNum != null && Number.isFinite(metaNum) && metaNum > 0 && meses.length;

  // Traza reutilizable de la línea META (horizontal, dashed).
  const trazaMeta = () => ({
    x: meses, y: meses.map(() => metaNum),
    name: `META (${metaNum})`,
    type: 'scatter', mode: 'lines',
    line: { color: COLORS.RED, width: 2, dash: 'dash' },
    hovertemplate: `META: ${metaNum}<extra></extra>`,
  });

  if (!p) {
    // Sin desglose programado/no-programado (baseline o pre-agregado, sin
    // la hoja DATOS). Si hay META la dibujamos igual para que sea
    // apreciable; las barras requieren cargar el Excel de origen.
    if (metaValida) {
      const layout = layoutBase();
      layout.yaxis = { ...layout.yaxis, title: { text: SUF[m], font: { size: 10 } } };
      layout.annotations = [{
        text: 'Línea META · el desglose programado / no-programado requiere el Excel de origen (hoja DATOS)',
        showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 1.06,
        font: { size: 10, color: '#64748B' }, align: 'center',
      }];
      Plotly.react('chart-prog', [trazaMeta()], layout, plotlyCfg());
      if (pill) pill.textContent = `META ${metaNum} · sin desglose`;
      return;
    }
    vacio('Sin desglose programado / no-programado<br>' +
          '<span style="font-size:11px">carga el Excel de origen (hoja DATOS · columna CLASIFICACION_CREG_063)</span>');
    if (pill) pill.textContent = 'sin detalle';
    return;
  }

  const progMes = (p.programado?.[m]    || []).map(v => +v || 0);
  const nopMes  = (p.no_programado?.[m] || []).map(v => +v || 0);

  // 'acum' → aporte a la fecha (suma corrida); 'mes' → aporte del mes.
  const acum  = progModo === 'acum';
  const progS = acum ? acumular(progMes) : progMes;
  const nopS  = acum ? acumular(nopMes)  : nopMes;
  const sufModo = acum ? ' · acumulado' : '';

  const layout = layoutBase();
  layout.barmode = 'group';
  layout.yaxis = { ...layout.yaxis, title: { text: SUF[m] + sufModo, font: { size: 10 } } };

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
  if (metaValida) traces.push(trazaMeta());

  Plotly.react('chart-prog', traces, layout, plotlyCfg());

  if (pill) {
    // Totales a la fecha (independiente del modo, son las sumas completas).
    const tot = (a) => a.reduce((x, y) => x + y, 0);
    const tp = tot(progMes), tn = tot(nopMes);
    const total = tp + tn;
    const pctN = total > 0 ? Math.round((tn / total) * 100) : 0;
    pill.textContent = `${SUF[m]} · no-prog ${pctN}%${sufModo}`;
  }
}
