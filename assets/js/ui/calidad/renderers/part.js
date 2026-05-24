// Renderer · Participación acumulada por categoría (barras h)

import { layoutBase, plotlyCfg, categoriaColor, fmt, metricaLabel, metricasActivas, METRIC_COLOR } from './_helpers.js';
import { catTotals } from '../../../domain/saidi_calculo.js';

export function renderPart(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  layout.margin = { l: 200, r: 30, t: 6, b: 30 };
  layout.yaxis = { ...layout.yaxis, tickfont: { size: 9 }, automargin: true };

  let traces;
  if (isAmbos) {
    // Una serie por métrica · barras agrupadas horizontalmente
    // Para no mezclar escalas, usamos categorías unión (ambas métricas
    // ordenadas por SAIDI). El eje X queda con título genérico.
    const tSaidi = catTotals(dataset, zona, 'saidi');
    const tSaifi = catTotals(dataset, zona, 'saifi');
    const orden = tSaidi.map(d => d.cat).slice().reverse();
    const mapSaidi = Object.fromEntries(tSaidi.map(d => [d.cat, d.tot]));
    const mapSaifi = Object.fromEntries(tSaifi.map(d => [d.cat, d.tot]));
    traces = [
      {
        x: orden.map(c => mapSaidi[c] || 0), y: orden,
        type: 'bar', orientation: 'h',
        name: 'SAIDI_E (h-eq)',
        marker: { color: METRIC_COLOR.saidi },
        text: orden.map(c => fmt(mapSaidi[c] || 0, 3)),
        textposition: 'outside', textfont: { size: 9 },
      },
      {
        x: orden.map(c => mapSaifi[c] || 0), y: orden,
        type: 'bar', orientation: 'h',
        name: 'SAIFI_E (int-eq)',
        marker: { color: METRIC_COLOR.saifi },
        text: orden.map(c => fmt(mapSaifi[c] || 0, 3)),
        textposition: 'outside', textfont: { size: 9 },
      },
    ];
    layout.barmode = 'group';
    layout.xaxis = { ...layout.xaxis, title: { text: 'Acumulado · SAIDI_E (h-eq) + SAIFI_E (int-eq)', font: { size: 10 } } };
  } else {
    const t = catTotals(dataset, zona, met).slice().reverse();
    traces = [{
      x: t.map(d => d.tot), y: t.map(d => d.cat),
      type: 'bar', orientation: 'h',
      marker: { color: t.map(d => categoriaColor(d.cat)) },
      text: t.map(d => fmt(d.tot, 3)), textposition: 'outside', textfont: { size: 9 },
    }];
    layout.xaxis = { ...layout.xaxis, title: { text: metricaLabel(met) + ' acumulado', font: { size: 10 } } };
  }
  Plotly.react('chart-part', traces, layout, plotlyCfg());
}
