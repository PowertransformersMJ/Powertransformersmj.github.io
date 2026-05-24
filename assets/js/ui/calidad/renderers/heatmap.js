// Renderer · Heatmap categoría × mes

import { $, layoutBase, plotlyCfg, metricaLabel, metricaNombre, metricaUnidad, metricasActivas } from './_helpers.js';
import { catTotals, categoriasDeZona } from '../../../domain/saidi_calculo.js';

// Paleta de calor legible para valores bajos:
//   mint (0%) → amber-50 → amber-200 → amber-400 → orange-500 →
//   red-500 → red-900 (pico crítico).
const HEAT_COLORSCALE = [
  [0.00, '#ECFDF5'],
  [0.05, '#FEF3C7'],
  [0.20, '#FDE68A'],
  [0.40, '#FBBF24'],
  [0.60, '#F97316'],
  [0.80, '#EF4444'],
  [1.00, '#7F1D1D'],
];

// Construye un trace heatmap a partir de una métrica concreta
function buildHeatTrace(dataset, zona, m, opts = {}) {
  const src = categoriasDeZona(dataset, zona, m);
  const cats = catTotals(dataset, zona, m).map(d => d.cat);
  const z = cats.map(c => src[c] || []);
  const text = z.map(row => row.map(v => (v == null || +v < 0.005) ? '' : (+v).toFixed(2)));
  const unidad = metricaUnidad(m);
  return {
    z, x: dataset.meses, y: cats, type: 'heatmap',
    colorscale: HEAT_COLORSCALE,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#1E293B', family: 'Inter, sans-serif' },
    hovertemplate: `<b>%{y}</b><br>%{x}: %{z:.4f} ${unidad}<extra>${metricaNombre(m)}</extra>`,
    xgap: 2, ygap: 2,
    colorbar: {
      title: { text: `${metricaNombre(m)} (${unidad})`, side: 'right', font: { size: 10 } },
      thickness: 14, tickfont: { size: 9 }, outlinewidth: 0,
      ...(opts.colorbar || {}),
    },
    xaxis: opts.xaxis || 'x',
    yaxis: opts.yaxis || 'y',
  };
}

export function renderHeatmap(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  const pill = $('#heat-pill');

  if (isAmbos) {
    // En modo "ambos" apilamos los heatmaps VERTICALMENTE (uno sobre
    // otro) en lugar de lado a lado. Las etiquetas largas de las
    // categorías en el eje Y necesitan todo el ancho izquierdo y se
    // solapaban con la colorbar del panel vecino en layout horizontal.
    const trSaidi = buildHeatTrace(dataset, zona, 'saidi', {
      xaxis: 'x',  yaxis: 'y',
      colorbar: { x: 1.02, y: 0.78, len: 0.42, yanchor: 'middle' },
    });
    const trSaifi = buildHeatTrace(dataset, zona, 'saifi', {
      xaxis: 'x2', yaxis: 'y2',
      colorbar: { x: 1.02, y: 0.22, len: 0.42, yanchor: 'middle' },
    });
    // Crece la altura para acomodar dos paneles cómodos
    layout.height = 760;
    layout.margin = { l: 240, r: 110, t: 60, b: 30 };
    // Grid 2 filas × 1 columna · ygap genera el espacio para los
    // títulos de cada panel y los meses repetidos arriba del SAIFI.
    layout.xaxis  = { anchor: 'y',  side: 'top', tickfont: { size: 11, color: '#0F172A' },
                      title: { text: 'SAIDI_E (h-eq) · meses', font: { size: 11, color: '#2563EB' }, standoff: 12 } };
    layout.yaxis  = { domain: [0.56, 1.00], anchor: 'x', tickfont: { size: 9 }, automargin: true };
    layout.xaxis2 = { anchor: 'y2', side: 'top', tickfont: { size: 11, color: '#0F172A' },
                      title: { text: 'SAIFI_E (int-eq) · meses', font: { size: 11, color: '#F59E0B' }, standoff: 12 } };
    layout.yaxis2 = { domain: [0.00, 0.44], anchor: 'x2', tickfont: { size: 9 }, automargin: true };
    Plotly.react('chart-heat', [trSaidi, trSaifi], layout, plotlyCfg());
    // Ajusta el contenedor para que respete la altura mayor
    const host = document.getElementById('chart-heat');
    if (host) host.style.height = '760px';
    if (pill) pill.textContent = 'SAIDI_E (h-eq) + SAIFI_E (int-eq)';
  } else {
    layout.margin = { l: 240, r: 70, t: 50, b: 20 };
    layout.yaxis = { tickfont: { size: 9 }, automargin: true };
    layout.xaxis = { side: 'top', tickfont: { size: 12, color: '#0F172A' }, ticks: 'outside', ticklen: 4, automargin: true };
    Plotly.react('chart-heat', [buildHeatTrace(dataset, zona, met)], layout, plotlyCfg());
    // Vuelve a la altura del .chart-tall (420px del CSS) tras estar en modo dual
    const host = document.getElementById('chart-heat');
    if (host) host.style.height = '';
    if (pill) pill.textContent = metricaLabel(met) + ' absoluto';
  }
}
