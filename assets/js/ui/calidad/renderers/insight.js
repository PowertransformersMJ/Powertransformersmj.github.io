// Renderer · Párrafo ejecutivo dinámico

import { $, fmt } from './_helpers.js';
import { gruposDeZona, growthPct, proyeccionDeZona } from '../../../domain/saidi_calculo.js';

export function renderInsight(dataset, zona) {
  const host = $('#insight');
  if (!host || !dataset) return;
  const grp = gruposDeZona(dataset, zona, 'saidi');
  const sob = grp['Sobrecarga/Deslastre'] || [];
  const growth = growthPct(sob) ?? 0;
  const pj = proyeccionDeZona(dataset, zona) || {};
  const zlabel = zona === 'TODAS' ? 'todas las zonas' : 'la zona ' + zona;
  host.innerHTML =
    `<b>Lectura ejecutiva (${zlabel}):</b> la indisponibilidad por capacidad de transformación (sobrecarga + deslastre) ` +
    `creció <b>+${growth}%</b> entre enero y mayo y mayo —aún parcial— ya es el mes pico. ` +
    `El contribuyente dominante es <b>«SOBRECARGA TRAFO SDL»</b>. La tendencia es estadísticamente significativa ` +
    `(OLS p=${fmt(pj.pval, 3)}, R²=${fmt(pj.r2, 2)}): de no intervenir sobre operación, capacidad y mantenimiento de trafos, ` +
    `el aporte del grupo podría más que duplicarse hacia diciembre.`;
}
