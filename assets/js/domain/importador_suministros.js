// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: importador suministros (Fase 42 + polish 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Parser puro (cero I/O Firebase, cero SheetJS aquí — los rows
// del .xlsm los extrae el data layer y los pasa ya tipados).
//
// Fuente única (canal Excel):
//   · .xlsm Sheet2 "Catalogo_Suministros" → /suministros
//   · .xlsm Sheet3 "Marcas"               → /marcas + sync marcas_disponibles
//
// El canal JSX (control_suministros-2.jsx) fue retirado en 2026-04-27 PM:
// ya no se sincronizan /transformadores ni /correcciones desde la
// importación de suministros. Esos datos son one-time bootstraps que
// ya viven en Firestore desde imports anteriores; las ediciones se
// hacen ahora desde admin/inventario.html y admin/auditoria.html.
// ══════════════════════════════════════════════════════════════

import {
  sanitizarSuministro, validarSuministro
} from './suministro_schema.js';
import {
  sanitizarMarca, validarMarca
} from './marca_schema.js';
import { UNIDADES, enValores } from './schema.js';

// ── Helpers internos ───────────────────────────────────────────
const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  // SheetJS con `raw:false` devuelve strings con comas/espacios.
  const cleaned = typeof v === 'string' ? v.replace(/[\s,]/g, '') : v;
  const n = +cleaned;
  return Number.isFinite(n) ? n : null;
};

/**
 * Normaliza encabezados del .xlsm a las keys canónicas del schema.
 * SheetJS usa los textos de la fila 1 (o el `header` row) como keys
 * del objeto. Los encabezados oficiales de F40 (.xlsm fuente) son:
 *   Sheet2: ID | Nombre | Unidad | Stock_Inicial | Total_Ingresado
 *           | Total_Egresado | Stock_Actual | Alerta | Marcas_Disponibles
 *   Sheet3: ID_Suministro | Nombre_Suministro | Marca
 *   Sheet5: Equipo_ID | Descripcion | Zona | Departamento |
 *           Subestacion | Matricula | Potencia_KVA | Grupo | Display
 */
function pickKey(row, ...candidatos) {
  for (const k of candidatos) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return undefined;
}

// ── 1. Parser de Sheet2 (Catalogo_Suministros) ─────────────────
export function parsearCatalogoRows(rows) {
  const out = [];
  const errores = [];
  if (!Array.isArray(rows)) return { suministros: out, errores: ['rows no es array'] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const codigo = str(pickKey(r, 'ID', 'Id', 'id', 'Codigo', 'codigo'));
    if (!codigo) continue;  // fila vacía o totalsRow
    if (!/^S\d{2}$/i.test(codigo)) continue;  // header residual o totals
    const nombre = str(pickKey(r, 'Nombre', 'nombre', 'Descripcion', 'desc'));
    const unidadRaw = str(pickKey(r, 'Unidad', 'unidad', 'Unid', 'unid'));
    // Normalización de unidades comunes del fuente al enum F38.
    const unidadNorm = normalizarUnidad(unidadRaw);
    const stockInicial = num(pickKey(r, 'Stock_Inicial', 'StockInicial', 'stock_inicial', 'stock'));
    const valorUnit = num(pickKey(r, 'Valor_Unitario', 'ValorUnit', 'valU', 'valor_unitario'));
    const sane = sanitizarSuministro({
      codigo: codigo.toUpperCase(),
      nombre,
      unidad: unidadNorm,
      stock_inicial: stockInicial == null ? 0 : stockInicial,
      valor_unitario: valorUnit == null ? 0 : valorUnit
    });
    const errs = validarSuministro(sane);
    if (errs.length > 0) {
      errores.push({ fila: i + 2, codigo: sane.codigo, errores: errs });
      continue;
    }
    out.push(sane);
  }
  return { suministros: out, errores };
}

function normalizarUnidad(raw) {
  const u = str(raw);
  if (!u) return 'Und';
  const upper = u.toUpperCase();
  // Mapeo de variantes comunes al enum oficial.
  if (['UND', 'UN', 'U', 'UNIDAD', 'UNIDADES'].includes(upper)) return 'Und';
  if (['LT', 'L', 'LITRO', 'LITROS'].includes(upper))           return 'Lt';
  if (['KG', 'K', 'KILO', 'KILOS'].includes(upper))             return 'Kg';
  if (['M', 'MT', 'MTS', 'METRO', 'METROS'].includes(upper))    return 'Mt';
  if (['GAL', 'GALON', 'GALONES'].includes(upper))              return 'Gal';
  return enValores(UNIDADES, u) ? u : 'Otro';
}

// ── 2. Parser de Sheet3 (Marcas) ───────────────────────────────
export function parsearMarcasRows(rows) {
  const out = [];
  const errores = [];
  if (!Array.isArray(rows)) return { marcas: out, errores: ['rows no es array'] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const sumId = str(pickKey(r, 'ID_Suministro', 'id_suministro', 'IDSuministro', 'suministro_id'));
    if (!sumId || !/^S\d{2}$/i.test(sumId)) continue;
    const sane = sanitizarMarca({
      suministro_id:     sumId.toUpperCase(),
      suministro_nombre: str(pickKey(r, 'Nombre_Suministro', 'nombre_suministro', 'NombreSuministro')),
      marca:             str(pickKey(r, 'Marca', 'marca'))
    });
    const errs = validarMarca(sane);
    if (errs.length > 0) {
      errores.push({ fila: i + 2, suministro_id: sane.suministro_id, errores: errs });
      continue;
    }
    // Skip placeholders del .xlsm fuente — el item del catálogo
    // queda sin marca persistible hasta que el director edite.
    const placeholders = ['POR DEFINIR', '(EDITE)', 'EDITE', '—', '-'];
    if (placeholders.includes(sane.marca.toUpperCase())) continue;
    out.push(sane);
  }
  return { marcas: out, errores };
}

// ── 3. Plan de importación ─────────────────────────────────────
/**
 * Genera el plan que el data layer ejecuta. Idempotente: re-ejecutar
 * con los mismos inputs produce el mismo plan.
 *
 * Args:
 *   parsed        — { suministros, marcas } (canal Excel únicamente)
 *   existentes    — { suministrosIds: Set, marcasKeys: Set }
 *
 * Returns:
 *   {
 *     suministros: { crear: [...], actualizar: [...], skip: [], huerfanos: [...] },
 *     marcas:      { crear: [...], skip: [] },
 *     resumen: { ... }
 *   }
 */
export function prepararPlanImportacion(parsed, existentes) {
  const ex = existentes || {};
  const exSumIds = ex.suministrosIds instanceof Set ? ex.suministrosIds : new Set();
  const exMarKeys = ex.marcasKeys instanceof Set ? ex.marcasKeys : new Set();

  const sumCrear = [], sumActualizar = [];
  for (const s of (parsed.suministros || [])) {
    if (exSumIds.has(s.codigo)) sumActualizar.push(s);
    else sumCrear.push(s);
  }

  const marCrear = [];
  for (const m of (parsed.marcas || [])) {
    const k = `${m.suministro_id}::${m.marca}`;
    if (!exMarKeys.has(k)) marCrear.push(m);
  }

  // Huérfanos: existentes en Firestore que no aparecen en el plan.
  // Se reportan en summary; NO se eliminan (decisión 2·A no autoriza DELETE).
  const sumIdsPlan = new Set((parsed.suministros || []).map((s) => s.codigo));
  const sumHuerfanos = [...exSumIds].filter((id) => !sumIdsPlan.has(id));

  return {
    suministros: { crear: sumCrear, actualizar: sumActualizar, skip: [], huerfanos: sumHuerfanos },
    marcas:      { crear: marCrear, skip: [] },
    resumen: {
      suministros: { total: (parsed.suministros || []).length, crear: sumCrear.length, actualizar: sumActualizar.length, huerfanos: sumHuerfanos.length },
      marcas:      { total: (parsed.marcas || []).length, crear: marCrear.length }
    }
  };
}
