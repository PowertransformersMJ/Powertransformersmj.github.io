// Renderer · Heatmap categoría × mes

import { $, layoutBase, plotlyCfg, metricaNombre } from './_helpers.js';
import { catTotals, categoriasDeZona } from '../../../domain/saidi_calculo.js';

// Paleta de calor más legible para valores bajos:
//   verde claro (0%) → amarillo (20%) → ámbar (45%) → naranja (70%) →
//   rojo (90%) → rojo oscuro (100%).
// Las celdas con valor 0 quedan en verde-mint suave (visible pero suave);
// los picos rojos resaltan claramente.
const HEAT_COLORSCALE = [
  [0.00, '#ECFDF5'],   // mint muy claro · "sin violaciones"
  [0.05, '#FEF3C7'],   // amber-50
  [0.20, '#FDE68A'],   // amber-200
  [0.40, '#FBBF24'],   // amber-400
  [0.60, '#F97316'],   // orange-500
  [0.80, '#EF4444'],   // red-500
  [1.00, '#7F1D1D'],   // red-900 · pico crítico
];

export function renderHeatmap(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const src = categoriasDeZona(dataset, zona, met);
  const cats = catTotals(dataset, zona, met).map(d => d.cat);
  const z = cats.map(c => src[c] || []);
  // Etiquetas de valor visibles en cada celda (oculta los ceros y
  // los valores < 0.005 para no ensuciar visualmente).
  const text = z.map(row => row.map(v => (v == null || +v < 0.005) ? '' : (+v).toFixed(2)));
  const layout = layoutBase();
  // Margen superior generoso porque los ticks de meses van arriba
  // (side:'top'); 50px deja espacio cómodo para "Ene/Feb/Mar/Abr/May".
  layout.margin = { l: 240, r: 70, t: 50, b: 20 };
  layout.yaxis = { tickfont: { size: 9 }, automargin: true };
  layout.xaxis = { side: 'top', tickfont: { size: 12, color: '#0F172A' }, ticks: 'outside', ticklen: 4, automargin: true };
  Plotly.react('chart-heat', [{
    z, x: dataset.meses, y: cats, type: 'heatmap',
    colorscale: HEAT_COLORSCALE,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#1E293B', family: 'Inter, sans-serif' },
    hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.4f}<extra></extra>',
    xgap: 2, ygap: 2,                // separadores blancos entre celdas
    colorbar: {
      title: { text: metricaNombre(met), side: 'right', font: { size: 10 } },
      thickness: 14,
      tickfont: { size: 9 },
      outlinewidth: 0,
    },
  }], layout, plotlyCfg());
  const pill = $('#heat-pill');
  if (pill) pill.textContent = metricaNombre(met) + ' absoluto';
}
