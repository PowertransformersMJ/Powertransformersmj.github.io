// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Exportadores (XLSX)
// ──────────────────────────────────────────────────────────────
// Genera el archivo Excel descargable con todas las filas + un
// resumen por zona. SheetJS se carga LAZY (no en el bundle).
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { critNivel, duvalDashboard } from '../../domain/parque_salud_calc.js';
import { loadSheetJS } from '../../data/parque_salud_excel.js';

// Aplana cada activo al shape tabular del Excel exportado.
export function exportRows() {
  return store.state.rows.map(a => {
    const d = a.det || {};
    const dv = (d.ch4 != null && d.c2h4 != null && d.c2h2 != null && (d.ch4 + d.c2h4 + d.c2h2) >= 1)
      ? duvalDashboard(d.ch4, d.c2h4, d.c2h2)
      : null;
    return {
      'Código': a.codigo,
      'Matrícula': a.matricula,
      'Serie': a.serie || '',
      'Tipo': a.tipo_activo,
      'Zona': a.zona,
      'Departamento': a.departamento,
      'Subestación': a.subestacion || '',
      'MVA': a.mva,
      'Usuarios': a.usuarios_aguas_abajo,
      'Criticidad': critNivel(a.usuarios_aguas_abajo),
      'Condición (entera)': a.hi,
      'Condición (decimal)': a.condicion_raw,
      'Estado': a.bucket.label,
      'DGA': a.calif_dga,
      'ADFQ': a.calif_adfq,
      'Furanos': a.calif_fur,
      'Cargabilidad': a.calif_crg,
      'P&T': a.calif_pyt,
      'Edad (eval)': a.calif_edad,
      'Hermeticidad': a.calif_her,
      'Duval': dv ? dv.zone : '',
      'TDGC': d.tdgc ?? '',
      'H2':  d.h2  ?? '',
      'CH4': d.ch4 ?? '',
      'C2H4': d.c2h4 ?? '',
      'C2H6': d.c2h6 ?? '',
      'CO':  d.co  ?? '',
      'CO2': d.co2 ?? '',
      'C2H2': d.c2h2 ?? '',
      'Rigidez (kV)': d.rigidez ?? '',
      'IC': d.ic ?? '',
      '2FAL (ppb)': d.fur2fal ?? '',
      'Carga (%)':  d.carga ?? '',
      'Edad (años)': d.edad_anos ?? '',
      'Año fab.':    d.anio ?? '',
      'Refrigeración': d.refrig || '',
      'Ventilación':   d.ventil || '',
      'Aliado': a.aliado || '',
      'Causante': a.causante || '',
      'Macroactividad': a.macroactividad || '',
    };
  });
}

// Descarga "Salud_de_Activos_export_YYYYMMDD.xlsx"
export async function exportXlsx() {
  if (!store.state.rows.length) {
    alert('No hay datos cargados para exportar.');
    return;
  }
  let XLSX;
  try {
    XLSX = await loadSheetJS();
  } catch (e) {
    alert('No se pudo cargar el generador de Excel (SheetJS). Verifica la conexión a internet.');
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows()), 'Activos');

  // Resumen por zona
  const z = {};
  store.state.rows.forEach(a => {
    const k = a.zona;
    (z[k] = z[k] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, sin: 0 })[a.hi == null ? 'sin' : a.bucket.cls]++;
  });
  const res = Object.keys(z).sort().map(k => ({
    Zona: k,
    'Muy Bueno (1)': z[k][1],
    'Bueno (2)':     z[k][2],
    'Medio (3)':     z[k][3],
    'Pobre (4)':     z[k][4],
    'Muy Pobre (5)': z[k][5],
    'Sin evaluación': z[k].sin,
    Total: [1, 2, 3, 4, 5, 'sin'].reduce((s, c) => s + z[k][c], 0),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res), 'Resumen por zona');

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, 'Salud_de_Activos_export_' + ts + '.xlsx');
}
