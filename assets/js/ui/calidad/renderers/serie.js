// Renderer · Serie temporal SAIDI_E + SAIFI_E

import { $, COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';
import { totalSerieDeZona, serieDiariaDeZona } from '../../../domain/saidi_calculo.js';
import { MESES_CANON } from '../../../domain/saidi_datos.js';

// Suma acumulada mes a mes: [a, b, c] → [a, a+b, a+b+c].
function acumular(serie) {
  let s = 0;
  return (serie || []).map(v => (s += (+v || 0)));
}

// Serie de la zona ya transformada según el modo ('mes' | 'acum').
function serieModoZona(dataset, zona, m, modo) {
  const base = totalSerieDeZona(dataset, zona, m);
  return modo === 'acum' ? acumular(base) : base;
}

export function renderSerie(dataset, zona, met = 'saidi', modo = 'mes', mesIdx = null) {
  if (typeof Plotly === 'undefined' || !dataset) return;

  // Vista día a día de un mes-calendario específico (0–11). Solo aplica
  // si el dataset trae detalle diario (path crudo de la hoja DATOS).
  if (mesIdx != null) {
    renderDiaria(dataset, zona, met, modo, mesIdx);
    return;
  }
  const acum = modo === 'acum';
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  const traces = [];

  // Sufijo del eje y de la leyenda según el modo.
  const sufSAIDI = acum ? 'SAIDI_E acum. (h-eq)'   : 'SAIDI_E (h-eq)';
  const sufSAIFI = acum ? 'SAIFI_E acum. (int-eq)' : 'SAIFI_E (int-eq)';

  if (isAmbos) {
    // Doble eje Y: SAIDI a la izquierda (azul), SAIFI a la derecha (ámbar)
    layout.yaxis  = { ...layout.yaxis, title: { text: sufSAIDI, font: { size: 10, color: '#2563EB' } } };
    layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                      title: { text: sufSAIFI, font: { size: 10, color: '#F59E0B' } } };
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, 'saidi', modo),
      name: sufSAIDI,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 3 }, marker: { size: 7 },
    });
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, 'saifi', modo),
      name: sufSAIFI, yaxis: 'y2',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.AMBER, width: 3 }, marker: { size: 7, symbol: 'square' },
    });
  } else {
    // Una sola serie · eje Y único con el label de la métrica activa
    const m = mets[0];
    const isSAIDI = m === 'saidi';
    const color = isSAIDI ? COLORS.BLUE : COLORS.AMBER;
    const label = isSAIDI ? sufSAIDI : sufSAIFI;
    layout.yaxis = { ...layout.yaxis, title: { text: label, font: { size: 10, color } } };
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, m, modo),
      name: label,
      type: 'scatter', mode: 'lines+markers',
      line: { color, width: 3 },
      marker: { size: 7, symbol: isSAIDI ? 'circle' : 'square' },
    });
  }

  Plotly.react('chart-serie', traces, layout, plotlyCfg());

  // Pill del título: refleja qué serie(s) se está(n) mostrando + el modo
  const pill = $('#serie-pill');
  if (pill) {
    const metTxt = isAmbos
      ? 'SAIDI_E (h-eq) + SAIFI_E (int-eq)'
      : (mets[0] === 'saidi' ? 'SAIDI_E (h-eq)' : 'SAIFI_E (int-eq)');
    pill.textContent = acum ? `${metTxt} · acumulado` : metTxt;
  }
}

// Último día (1–31) con dato en cualquiera de las dos series; mínimo 1.
function ultimoDiaConDato(...series) {
  let last = 0;
  for (const s of series) {
    if (!Array.isArray(s)) continue;
    for (let i = s.length - 1; i >= 0; i--) {
      if ((+s[i] || 0) !== 0) { last = Math.max(last, i + 1); break; }
    }
  }
  return Math.max(last, 1);
}

// Renderiza el detalle día a día de un mes-calendario (mesIdx 0–11).
function renderDiaria(dataset, zona, met, modo, mesIdx) {
  const acum = modo === 'acum';
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const mesNombre = MESES_CANON[mesIdx] || `Mes ${mesIdx + 1}`;
  const pill = $('#serie-pill');

  const saidiDia = serieDiariaDeZona(dataset, zona, 'saidi', mesIdx);
  const saifiDia = serieDiariaDeZona(dataset, zona, 'saifi', mesIdx);

  // Sin detalle diario para este mes → estado vacío amable.
  if (!saidiDia && !saifiDia) {
    const layout = layoutBase();
    layout.annotations = [{
      text: `Sin detalle diario para ${mesNombre}<br><span style="font-size:11px">carga el Excel de origen (hoja DATOS) para ver el día a día</span>`,
      showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5,
      font: { size: 14, color: '#64748B' }, align: 'center',
    }];
    layout.xaxis = { ...layout.xaxis, visible: false };
    layout.yaxis = { ...layout.yaxis, visible: false };
    Plotly.react('chart-serie', [], layout, plotlyCfg());
    if (pill) pill.textContent = `${mesNombre} · sin detalle diario`;
    return;
  }

  const lastDay = ultimoDiaConDato(saidiDia, saifiDia);
  const dias = [];
  for (let d = 1; d <= lastDay; d++) dias.push(String(d));
  const recorte = (s) => (s || new Array(31).fill(0)).slice(0, lastDay);
  const transform = (s) => acum ? acumular(recorte(s)) : recorte(s);

  const layout = layoutBase();
  layout.xaxis = { ...layout.xaxis, title: { text: `Día de ${mesNombre}`, font: { size: 10 } } };
  const traces = [];

  const sufSAIDI = acum ? 'SAIDI_E acum. (h-eq)'   : 'SAIDI_E (h-eq)';
  const sufSAIFI = acum ? 'SAIFI_E acum. (int-eq)' : 'SAIFI_E (int-eq)';

  if (isAmbos) {
    layout.yaxis  = { ...layout.yaxis, title: { text: sufSAIDI, font: { size: 10, color: '#2563EB' } } };
    layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                      title: { text: sufSAIFI, font: { size: 10, color: '#F59E0B' } } };
    traces.push({
      x: dias, y: transform(saidiDia), name: sufSAIDI,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 3 }, marker: { size: 6 },
    });
    traces.push({
      x: dias, y: transform(saifiDia), name: sufSAIFI, yaxis: 'y2',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.AMBER, width: 3 }, marker: { size: 6, symbol: 'square' },
    });
  } else {
    const m = mets[0];
    const isSAIDI = m === 'saidi';
    const color = isSAIDI ? COLORS.BLUE : COLORS.AMBER;
    const label = isSAIDI ? sufSAIDI : sufSAIFI;
    layout.yaxis = { ...layout.yaxis, title: { text: label, font: { size: 10, color } } };
    traces.push({
      x: dias, y: transform(isSAIDI ? saidiDia : saifiDia), name: label,
      type: 'scatter', mode: 'lines+markers',
      line: { color, width: 3 },
      marker: { size: 6, symbol: isSAIDI ? 'circle' : 'square' },
    });
  }

  Plotly.react('chart-serie', traces, layout, plotlyCfg());

  if (pill) {
    const metTxt = isAmbos
      ? 'SAIDI_E (h-eq) + SAIFI_E (int-eq)'
      : (mets[0] === 'saidi' ? 'SAIDI_E (h-eq)' : 'SAIFI_E (int-eq)');
    pill.textContent = `${mesNombre} · día a día · ${acum ? metTxt + ' · acumulado' : metTxt}`;
  }
}
