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

// Overlay META por mes (objetivo) para una zona/métrica/serie, alineado a
// `dataset.meses`. Devuelve el array de objetivo o null si no hay overlay.
function metaSerie(dataset, zona, m, serieKey) {
  const o = dataset?.metaObjetivo?.[zona]?.[serieKey]?.[m];
  if (!Array.isArray(o)) return null;
  return o.some(v => (+v || 0) !== 0) ? o.map(v => +v || 0) : null;
}

export function renderProg(
  dataset, zona, met = 'saidi',
  metaSaidi = null, metaSaifi = null, progModo = 'mes',
  series = { prog: true, nop: true },
) {
  if (typeof Plotly === 'undefined' || !dataset) return;

  const verProg = series?.prog !== false;
  const verNop  = series?.nop  !== false;

  const pill = $('#chart-prog-pill');
  const p = progDeZona(dataset, zona);

  // El prog chart traza UNA métrica. En modo 'ambos' usa SAIDI_E como
  // métrica principal (la META suele expresarse en SAIDI). El selector
  // de métrica sigue mandando para el resto de gráficas.
  const m = metricasActivas(met)[0];
  const meses = dataset.meses || [];
  const meta  = m === 'saidi' ? metaSaidi : metaSaifi;
  const acum  = progModo === 'acum';
  const aplicar = (arr) => acum ? acumular(arr) : arr;

  // Objetivo manual (input del card): línea horizontal de referencia.
  const metaNum = (meta == null || meta === '') ? null : +meta;
  const metaManualOk = metaNum != null && Number.isFinite(metaNum) && metaNum > 0 && meses.length;
  const trazaMetaManual = () => ({
    x: meses, y: meses.map(() => metaNum),
    name: `Objetivo manual (${metaNum})`,
    type: 'scatter', mode: 'lines',
    line: { color: COLORS.RED, width: 2, dash: 'dot' },
    hovertemplate: `Objetivo: ${metaNum}<extra></extra>`,
  });

  if (!p) {
    // Sin desglose programado/no-programado (baseline o pre-agregado, sin
    // la hoja DATOS). Si hay objetivo manual lo dibujamos igual.
    if (metaManualOk) {
      const layout = layoutBase();
      layout.yaxis = { ...layout.yaxis, title: { text: SUF[m], font: { size: 10 } } };
      layout.annotations = [{
        text: 'Objetivo manual · el desglose programado / no-programado requiere el Excel de origen (hoja DATOS)',
        showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 1.06,
        font: { size: 10, color: '#64748B' }, align: 'center',
      }];
      Plotly.react('chart-prog', [trazaMetaManual()], layout, plotlyCfg());
      if (pill) pill.textContent = `objetivo ${metaNum} · sin desglose`;
      return;
    }
    vacio('Sin desglose programado / no-programado<br>' +
          '<span style="font-size:11px">carga el Excel de origen (hoja DATOS · columna CLASIFICACION_CREG_063)</span>');
    if (pill) pill.textContent = 'sin detalle';
    return;
  }

  const progMes = (p.programado?.[m]    || []).map(v => +v || 0);
  const nopMes  = (p.no_programado?.[m] || []).map(v => +v || 0);
  const sufModo = acum ? ' · acumulado' : '';

  const layout = layoutBase();
  layout.barmode = 'group';
  layout.yaxis = { ...layout.yaxis, title: { text: SUF[m] + sufModo, font: { size: 10 } } };

  // META por mes desde el overlay (objetivo de la hoja META), alineada a
  // las barras causadas → "el match entre la meta y lo causado".
  const metaNop  = metaSerie(dataset, zona, m, 'no_programado');
  const metaProg = metaSerie(dataset, zona, m, 'programado');
  let hayOverlay = false;

  const traces = [];
  if (verNop) {
    traces.push({
      x: meses, y: aplicar(nopMes), name: 'No programado (causado)',
      type: 'bar', marker: { color: COLORS.AMBER },
    });
    if (metaNop) {
      hayOverlay = true;
      traces.push({
        x: meses, y: aplicar(metaNop), name: 'META No programado',
        type: 'scatter', mode: 'lines+markers',
        line: { color: COLORS.AMBER, width: 2, dash: 'dash' },
        marker: { size: 5, color: COLORS.AMBER },
        hovertemplate: 'META no-prog: %{y:.4f}<extra></extra>',
      });
    }
  }
  if (verProg) {
    traces.push({
      x: meses, y: aplicar(progMes), name: 'Programado (causado)',
      type: 'bar', marker: { color: COLORS.TEAL },
    });
    if (metaProg) {
      hayOverlay = true;
      traces.push({
        x: meses, y: aplicar(metaProg), name: 'META Programado',
        type: 'scatter', mode: 'lines+markers',
        line: { color: COLORS.TEAL, width: 2, dash: 'dash' },
        marker: { size: 5, color: COLORS.TEAL },
        hovertemplate: 'META prog: %{y:.4f}<extra></extra>',
      });
    }
  }

  // Objetivo manual (input) como línea de referencia adicional.
  if (metaManualOk) traces.push(trazaMetaManual());

  Plotly.react('chart-prog', traces, layout, plotlyCfg());

  if (pill) {
    const tot = (a) => a.reduce((x, y) => x + y, 0);
    const tp = tot(progMes), tn = tot(nopMes);
    const total = tp + tn;
    const pctN = total > 0 ? Math.round((tn / total) * 100) : 0;
    const tagMeta = hayOverlay ? ' · META vs causado' : '';
    pill.textContent = `${SUF[m]} · no-prog ${pctN}%${sufModo}${tagMeta}`;
  }
}
