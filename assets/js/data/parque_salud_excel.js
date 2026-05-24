// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque · Adapter Excel (fallback / upload)
// ──────────────────────────────────────────────────────────────
// Lectura del archivo "Salud de Activos 2026.xlsx" (cliente).
// Conserva el mapeo por POSICIÓN de columnas definido en
// `domain/parque_salud_config.js#XLS_SHEETS`.
//
// SheetJS se carga LAZY desde CDN cuando el usuario activa el
// upload — no se trae en el bundle inicial. Cuando el archivo
// se sube, el dashboard refresca el estado con `normalize`.
//
// Esta ruta de carga es el FALLBACK de la regla §0.1.2.4:
// no se elimina porque el director puede necesitar actualizar
// el dataset desde Excel mientras la población de Firestore
// está en curso.
// ══════════════════════════════════════════════════════════════

import { XLS_SHEETS } from '../domain/parque_salud_config.js';
import { bucketOf } from '../domain/parque_salud_calc.js';

const SHEETJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _sheetjsPromise = null;

// ── Helpers de parseo (puros) ─────────────────────────────────
export function _num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s || ['N/A', '#DIV/0!', '#VALUE!', '#REF!', 'NA'].includes(s.toUpperCase())) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

export function _txt(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return (s && !['N/A', 'NONE'].includes(s.toUpperCase())) ? s : null;
}

// Conversión a MVA según tipo de activo (origen del Excel).
export function _mva(tipo, raw) {
  if (raw == null || raw instanceof Date) return null;
  if (typeof raw === 'string') {
    const m = raw.replace(',', '.').match(/[\d.]+/);
    if (!m) return null;
    const v = parseFloat(m[0]);
    return v < 100 ? Math.round(v * 1000) / 1000 : Math.round(v) / 1000;
  }
  if (typeof raw === 'number') {
    if (tipo === 'TX_Potencia' || tipo === 'TPT_Servicio') return Math.round(raw) / 1000;
    return raw < 100 ? Math.round(raw * 1000) / 1000 : Math.round(raw) / 1000;
  }
  return null;
}

// ── Normalizador del dataset (puro) ───────────────────────────
// Acepta filas con campos `calif_*` + `condicion` y devuelve
// activos enriquecidos con `hi`, `bucket`, `condicion_raw`,
// `usuarios_aguas_abajo` numérico, `mva` numérico, zona/depto
// normalizados en mayúsculas, y `matricula` con fallback al
// código.
export function normalize(rows) {
  return rows.map(r => {
    const out = { ...r };
    ['dga', 'adfq', 'fur', 'crg', 'pyt', 'edad', 'her'].forEach(k => {
      const v = out['calif_' + k];
      out['calif_' + k] = (v === '' || v === null || v === undefined)
        ? null
        : (Number.isNaN(+v) ? null : +v);
    });
    const rawCond = out.condicion != null && !Number.isNaN(+out.condicion) ? +out.condicion : null;
    const cond = rawCond != null ? Math.round(rawCond) : null;
    out.condicion_raw = rawCond;
    out.hi = cond;
    out.bucket = bucketOf(cond);
    out.usuarios_aguas_abajo = +out.usuarios_aguas_abajo || 0;
    out.mva = (out.mva != null && !Number.isNaN(+out.mva)) ? +out.mva : null;
    out.zona = (out.zona || '').toString().trim().toUpperCase() || 'SIN ZONA';
    out.departamento = (out.departamento || '').toString().trim().toUpperCase() || 'SIN DEPTO';
    out.matricula = out.matricula || out.codigo || '—';
    return out;
  });
}

// ── Parser de workbook SheetJS ────────────────────────────────
// Recibe un workbook ya leído por XLSX.read() y devuelve
// { rows, found } sin pasar por normalize (lo aplica el caller).
export function parseWorkbook(wb, XLSX) {
  const out = [];
  const found = [];
  XLS_SHEETS.forEach(cfg => {
    const ws = wb.Sheets[cfg.sheet];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    let n = 0;
    for (let i = cfg.hr + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => c == null)) continue;
      const g = (k) => {
        const idx = cfg.cm[k];
        return (idx != null && idx < r.length) ? r[idx] : null;
      };
      const mat = _txt(g('matricula'));
      const cod = _txt(g('codigo'));
      if (!mat && !cod) continue;
      out.push({
        codigo: cod || '',
        serie: _txt(g('serie')),
        matricula: mat || (cod || ''),
        subestacion: _txt(g('subestacion')),
        zona: _txt(g('zona')),
        departamento: _txt(g('departamento')),
        tipo_activo: cfg.tipo,
        mva: _mva(cfg.tipo, g('potencia')),
        calif_dga: _num(g('dga')),
        calif_adfq: _num(g('adfq')),
        calif_fur: _num(g('fur')),
        calif_crg: _num(g('crg')),
        calif_her: _num(g('her')),
        calif_edad: _num(g('edad')),
        calif_pyt: _num(g('pyt')),
        condicion: _num(g('condicion')),
        usuarios_aguas_abajo: _num(g('usuarios')) || 0,
        aliado: _txt(g('aliado')),
        causante: _txt(g('causante')),
        macroactividad: _txt(g('macro')),
      });
      n++;
    }
    found.push(cfg.sheet + ' (' + n + ')');
  });
  return { rows: out, found };
}

// ── Cargador lazy de SheetJS (CDN) ────────────────────────────
// El navegador solo descarga el script cuando el usuario activa
// el upload. Cachea la promesa para no descargar dos veces.
export function loadSheetJS() {
  if (typeof window !== 'undefined' && typeof window.XLSX !== 'undefined') {
    return Promise.resolve(window.XLSX);
  }
  if (_sheetjsPromise) return _sheetjsPromise;
  _sheetjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_CDN;
    s.async = true;
    s.onload = () => {
      if (typeof window.XLSX === 'undefined') {
        reject(new Error('SheetJS cargó pero XLSX no está disponible.'));
      } else {
        resolve(window.XLSX);
      }
    };
    s.onerror = () => reject(new Error('No se pudo descargar SheetJS desde CDN.'));
    document.head.appendChild(s);
  });
  return _sheetjsPromise;
}

// ── Handler completo: archivo → filas normalizadas ───────────
// Devuelve { rows, found, fileName } o lanza error con mensaje
// humano cuando algo falla (sin red, hojas faltantes, etc.).
export async function leerExcel(file) {
  let XLSX;
  try {
    XLSX = await loadSheetJS();
  } catch (e) {
    throw new Error('No se pudo cargar el lector de Excel (sin conexión a internet para SheetJS).');
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const { rows, found } = parseWorkbook(wb, XLSX);
  if (!rows.length) {
    throw new Error(
      'Sin datos. El archivo debe tener hojas llamadas TX_Potencia, TPT_Servicio o TX_Respaldo. ' +
      'Hojas encontradas: ' + wb.SheetNames.join(', ')
    );
  }
  return { rows: normalize(rows), found, fileName: file.name };
}
