// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · EXPORT CSV
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { aplicarFiltros } from '../../domain/cargabilidad_filtros.js';
import { sev, metricPct } from '../../domain/cargabilidad_severidad.js';
import { SEVLBL, DEV_LABEL } from '../../domain/cargabilidad_config.js';

const CSV_HEAD = [
  'Matricula', 'Subestacion', 'Zona', 'Departamento', 'Grupo',
  'Potencia_kVA', 'Devanado_critico', 'I_medida_A', 'Ampacidad_A',
  'Pct_Ampacidad', 'Limite1_SCADA_A', 'Limite2_SCADA_A', 'Estado',
  'Condicion', 'Usuarios',
];

function devCodigo(dev) {
  if (dev === DEV_LABEL.P) return 'P';
  if (dev === DEV_LABEL.S) return 'S';
  if (dev === DEV_LABEL.T) return 'T';
  return 'P';
}

export function exportarCSV() {
  const { rows, filtros } = store.state;
  const filtradas = aplicarFiltros(rows, filtros)
    .filter(d => d.cmax != null)
    .sort((a, b) => (metricPct(b, filtros.dev) || 0) - (metricPct(a, filtros.dev) || 0));

  const lines = [CSV_HEAD.join(';')];
  filtradas.forEach(d => {
    const o = d[devCodigo(d.dev)] || d.P;
    const fila = [
      d.id, d.sub, d.zona, d.dep, d.grupo, d.pot, d.dev,
      o.car, o.amp, d.cmax, o.l1, o.l2,
      SEVLBL[sev(d.cmax)], d.cond, d.us,
    ].map(x => x == null ? '' : String(x).replace(/;/g, ','));
    lines.push(fila.join(';'));
  });
  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cargabilidad_tx_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return filtradas.length;
}
