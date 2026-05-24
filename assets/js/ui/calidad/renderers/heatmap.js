// ══════════════════════════════════════════════════════════════
// Renderer · Heatmap categoría × mes
// ──────────────────────────────────────────────────────────────
// Cuando el usuario selecciona "Ambos" se muestran DOS heatmaps
// apilados verticalmente, cada uno en su propio div independiente
// (no como Plotly subplots). Esto evita conflictos con la grilla
// del resto del dashboard y mantiene cada chart con su altura
// estándar de 420px.
// ══════════════════════════════════════════════════════════════

import { $, layoutBase, plotlyCfg, metricaLabel, metricaNombre, metricaUnidad, metricasActivas } from './_helpers.js';
import { catTotals, categoriasDeZona } from '../../../domain/saidi_calculo.js';

// Paleta del heatmap (7 stops mint → rojo oscuro)
const HEAT_COLORSCALE = [
  [0.00, '#ECFDF5'],
  [0.05, '#FEF3C7'],
  [0.20, '#FDE68A'],
  [0.40, '#FBBF24'],
  [0.60, '#F97316'],
  [0.80, '#EF4444'],
  [1.00, '#7F1D1D'],
];

// Construye el trace heatmap para una métrica concreta
function buildHeatTrace(dataset, zona, m) {
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
    },
  };
}

// Renderiza UN heatmap en un div con id específico
function renderUnHeatmap(divId, dataset, zona, m) {
  const layout = layoutBase();
  layout.margin = { l: 240, r: 70, t: 50, b: 20 };
  layout.yaxis = { tickfont: { size: 9 }, automargin: true };
  layout.xaxis = { side: 'top', tickfont: { size: 12, color: '#0F172A' }, ticks: 'outside', ticklen: 4, automargin: true };
  Plotly.react(divId, [buildHeatTrace(dataset, zona, m)], layout, plotlyCfg());
}

// Asegura que exista (o no exista) el div secundario para el modo dual.
// Lo inserta como hermano de #chart-heat dentro del mismo card, con
// un subtítulo entre ambos para identificar cada panel.
function ensureSecondHeatDiv(visible) {
  const principal = document.getElementById('chart-heat');
  if (!principal) return null;
  let titulo1 = document.getElementById('chart-heat-titulo-1');
  let titulo2 = document.getElementById('chart-heat-titulo-2');
  let host2   = document.getElementById('chart-heat-saifi');

  if (visible) {
    if (!titulo1) {
      titulo1 = document.createElement('div');
      titulo1.id = 'chart-heat-titulo-1';
      titulo1.className = 'heat-subtitle';
      titulo1.innerHTML = '<span style="color:#2563EB">▮</span> SAIDI_E · duración (h-eq)';
      principal.insertAdjacentElement('beforebegin', titulo1);
    }
    if (!titulo2) {
      titulo2 = document.createElement('div');
      titulo2.id = 'chart-heat-titulo-2';
      titulo2.className = 'heat-subtitle';
      titulo2.style.marginTop = '24px';
      titulo2.innerHTML = '<span style="color:#F59E0B">▮</span> SAIFI_E · frecuencia (int-eq)';
      principal.insertAdjacentElement('afterend', titulo2);
    } else {
      titulo2.style.display = '';
    }
    if (!host2) {
      host2 = document.createElement('div');
      host2.id = 'chart-heat-saifi';
      host2.className = 'chart-tall';
      titulo2.insertAdjacentElement('afterend', host2);
    } else {
      host2.style.display = '';
    }
  } else {
    if (titulo1) titulo1.remove();
    if (titulo2) titulo2.style.display = 'none';
    if (host2)   host2.style.display = 'none';
  }
  return host2;
}

export function renderHeatmap(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const pill = $('#heat-pill');

  if (isAmbos) {
    ensureSecondHeatDiv(true);
    renderUnHeatmap('chart-heat',       dataset, zona, 'saidi');
    renderUnHeatmap('chart-heat-saifi', dataset, zona, 'saifi');
    if (pill) pill.textContent = 'SAIDI_E (h-eq) + SAIFI_E (int-eq)';
  } else {
    ensureSecondHeatDiv(false);
    renderUnHeatmap('chart-heat', dataset, zona, met);
    if (pill) pill.textContent = metricaLabel(met) + ' absoluto';
  }
}
