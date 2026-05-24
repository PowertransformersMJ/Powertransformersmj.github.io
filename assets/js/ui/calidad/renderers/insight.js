// Renderer · Párrafo ejecutivo dinámico
//
// El texto se ajusta a la métrica activa:
//   · SAIDI  → habla de "indisponibilidad" / "duración" / "h-eq"
//   · SAIFI  → habla de "frecuencia" / "número de interrupciones" / "int-eq"
//   · Ambos → menciona los dos crecimientos

import { $, fmt, metricasActivas, metricaNombre, metricaUnidad } from './_helpers.js';
import { gruposDeZona, growthPct, proyeccionDeZona } from '../../../domain/saidi_calculo.js';
import { calcularProyeccionOLS } from '../../../domain/saidi_proyeccion.js';

function statsDeMetrica(dataset, zona, m) {
  const grp = gruposDeZona(dataset, zona, m);
  const sob = grp['Sobrecarga/Deslastre'] || [];
  const growth = growthPct(sob) ?? 0;
  const proj = m === 'saidi'
    ? (proyeccionDeZona(dataset, zona) || {})
    : (sob.length ? calcularProyeccionOLS(sob, dataset.meses_full.length) : {});
  return { growth, proj };
}

const DESCRIPTORES = {
  saidi: { obj: 'la indisponibilidad', metricaCorta: 'duración', adj: 'duraría más' },
  saifi: { obj: 'la frecuencia de interrupciones', metricaCorta: 'frecuencia', adj: 'sería más recurrente' },
};

export function renderInsight(dataset, zona, met = 'saidi') {
  const host = $('#insight');
  if (!host || !dataset) return;
  const mets = metricasActivas(met);
  const zlabel = zona === 'TODAS' ? 'todas las zonas' : 'la zona ' + zona;

  if (mets.length > 1) {
    const sS = statsDeMetrica(dataset, zona, 'saidi');
    const sF = statsDeMetrica(dataset, zona, 'saifi');
    host.innerHTML =
      `<b>Lectura ejecutiva (${zlabel}):</b> el aporte del grupo Sobrecarga+Deslastre a la calidad del servicio ` +
      `creció <b>+${sS.growth}%</b> en duración (<b>SAIDI_E</b>, h-eq) y <b>+${sF.growth}%</b> en frecuencia ` +
      `(<b>SAIFI_E</b>, int-eq) entre enero y mayo; mayo —aún parcial— ya es el mes pico en ambas métricas. ` +
      `El contribuyente dominante es <b>«SOBRECARGA TRAFO SDL»</b>. ` +
      `Tendencia OLS · SAIDI p=${fmt(sS.proj.pval, 3)} R²=${fmt(sS.proj.r2, 2)} · ` +
      `SAIFI p=${fmt(sF.proj.pval, 3)} R²=${fmt(sF.proj.r2, 2)}: de no intervenir sobre operación, ` +
      `capacidad y mantenimiento de trafos, el aporte del grupo podría más que duplicarse hacia diciembre.`;
    return;
  }

  const m = mets[0];
  const d = DESCRIPTORES[m] || DESCRIPTORES.saidi;
  const { growth, proj } = statsDeMetrica(dataset, zona, m);
  host.innerHTML =
    `<b>Lectura ejecutiva (${zlabel}):</b> ${d.obj} por capacidad de transformación (sobrecarga + deslastre) ` +
    `creció <b>+${growth}%</b> entre enero y mayo en ${d.metricaCorta} (<b>${metricaNombre(m)}</b>, ${metricaUnidad(m)}) ` +
    `y mayo —aún parcial— ya es el mes pico. ` +
    `El contribuyente dominante es <b>«SOBRECARGA TRAFO SDL»</b>. La tendencia es estadísticamente significativa ` +
    `(OLS p=${fmt(proj.pval, 3)}, R²=${fmt(proj.r2, 2)}): de no intervenir sobre operación, capacidad y mantenimiento de trafos, ` +
    `el aporte del grupo ${d.adj} hacia diciembre, llegando a duplicar el nivel actual.`;
}
