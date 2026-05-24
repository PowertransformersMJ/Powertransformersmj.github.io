// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · UPLOAD HANDLER
// ──────────────────────────────────────────────────────────────
// Acepta archivos JSON (con shape del baseline) o Excel XLSX
// (con hoja "ZONAS" pre-agregada) y reemplaza el dataset del
// dashboard. Persiste en IndexedDB para que se mantenga entre
// recargas y permite "Reiniciar al baseline" para descartar.
//
// FORMATO JSON (preferido)
//   Mismo shape exacto que assets/data/indicadores-calidad-baseline.json:
//   { meses, meses_full, zonas: {TODAS, BOLIVAR, …}, cats_order, kpi, proj_global }
//
// FORMATO EXCEL (opcional)
//   Hoja "META":  A1=meses[0..N], B1=meses_full[0..N]
//   Hoja "KPI":   pares clave-valor (saidi_tot, sob_pct, etc.)
//   Hoja "ZONAS": filas por zona con columnas total_saidi_ene..,
//                 total_saifi_ene.., grp_sob_ene.., grp_rac_ene..,
//                 grp_otr_ene..
//   Hoja "PROYECCION": filas por zona con base[0..11], opt[0..11], pes[0..11],
//                       ci_inf, ci_sup, r2, slope, pval
//
//   Si el Excel no tiene este formato, el parser intenta inferir
//   con tolerancia y reporta qué falta.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';

const SHEETJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _sheetjsPromise = null;
function loadSheetJS() {
  if (typeof window !== 'undefined' && typeof window.XLSX !== 'undefined') {
    return Promise.resolve(window.XLSX);
  }
  if (_sheetjsPromise) return _sheetjsPromise;
  _sheetjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_CDN;
    s.async = true;
    s.onload  = () => typeof window.XLSX === 'undefined'
      ? reject(new Error('SheetJS cargó pero XLSX no está disponible.'))
      : resolve(window.XLSX);
    s.onerror = () => reject(new Error('No se pudo descargar SheetJS desde CDN.'));
    document.head.appendChild(s);
  });
  return _sheetjsPromise;
}

// ── IndexedDB ────────────────────────────────────────────────
const DB_NAME = 'calidad_db_v1';
const DB_STORE = 'kv';
const K_DATASET = 'dataset';
const K_META = 'meta';
let _idb = null;
let _persistMode = '?';

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no soportado'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error || new Error('IndexedDB open error'));
  });
}
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function idbSet(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}
function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

export async function inicializarPersistencia() {
  try {
    _idb = await idbOpen();
    _persistMode = 'indexeddb';
    const dataset = await idbGet(_idb, K_DATASET);
    const meta = await idbGet(_idb, K_META);
    return { mode: 'indexeddb', dataset: dataset || null, meta: meta || null };
  } catch (_) {
    _persistMode = 'none';
    return { mode: 'none', dataset: null, meta: null };
  }
}

export async function persistirDataset(dataset, meta) {
  if (_persistMode !== 'indexeddb' || !_idb) return false;
  try {
    await idbSet(_idb, K_DATASET, dataset);
    await idbSet(_idb, K_META, meta || {});
    return true;
  } catch (e) {
    console.error('[calidad/upload] persistir falló:', e);
    return false;
  }
}

export async function limpiarPersistencia() {
  if (_persistMode !== 'indexeddb' || !_idb) return false;
  try {
    await idbDelete(_idb, K_DATASET);
    await idbDelete(_idb, K_META);
    return true;
  } catch (_) {
    return false;
  }
}

// ── Validador de shape ──────────────────────────────────────
function validarShape(d) {
  const errs = [];
  if (!d || typeof d !== 'object')       errs.push('dataset vacío o inválido');
  if (!Array.isArray(d?.meses))          errs.push('falta `meses` (array)');
  if (!Array.isArray(d?.meses_full))     errs.push('falta `meses_full` (array)');
  if (!d?.zonas || typeof d.zonas !== 'object') errs.push('falta `zonas` (objeto)');
  if (!Array.isArray(d?.cats_order))     errs.push('falta `cats_order` (array)');
  if (!d?.zonas?.TODAS)                  errs.push('falta zona "TODAS"');
  return errs;
}

// ── Parser JSON ──────────────────────────────────────────────
async function parsearJSON(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); }
  catch (e) { throw new Error('JSON inválido: ' + e.message); }
  const errs = validarShape(obj);
  if (errs.length) throw new Error('Shape JSON incorrecto · ' + errs.join(' · '));
  return obj;
}

// ── Parser Excel ─────────────────────────────────────────────
// Espera 4 hojas: META, KPI, ZONAS, PROYECCION (case-insensitive).
// Si alguna falta, lanza error indicando cuál.
async function parsearExcel(file) {
  const XLSX = await loadSheetJS();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });

  // Localizar hojas (case-insensitive)
  const sheetByName = {};
  for (const name of wb.SheetNames) sheetByName[name.toUpperCase()] = name;
  const need = ['META', 'KPI', 'ZONAS', 'PROYECCION'];
  const missing = need.filter(n => !sheetByName[n]);
  if (missing.length) {
    throw new Error(
      'Excel sin formato esperado · faltan hojas: ' + missing.join(', ') + ' · ' +
      'hojas detectadas: ' + wb.SheetNames.join(', ')
    );
  }

  // META → meses + meses_full
  const metaRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetByName.META], { header: 1 });
  const meses      = (metaRows.find(r => /meses$/i.test(String(r[0]))) || []).slice(1).filter(Boolean).map(String);
  const meses_full = (metaRows.find(r => /meses_full/i.test(String(r[0]))) || []).slice(1).filter(Boolean).map(String);
  if (!meses.length || !meses_full.length) {
    throw new Error('Hoja META · falta fila "meses" o "meses_full" con valores');
  }

  // KPI → pares clave/valor
  const kpiRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetByName.KPI], { header: 1 });
  const kpi = {};
  for (const row of kpiRows) {
    if (!row[0]) continue;
    const k = String(row[0]).trim();
    const v = row[1];
    kpi[k] = (typeof v === 'number') ? v : (Number.isFinite(+v) ? +v : v);
  }

  // ZONAS → filas por zona con columnas zona,grupo,métrica,ene..,feb..,etc.
  // Formato esperado:
  //   col A: zona
  //   col B: tipo (total_saidi | total_saifi | grp_saidi_<grupo> | grp_saifi_<grupo> | cat_saidi_<cat> | cat_saifi_<cat>)
  //   col C..C+N-1: valores por mes (ene..may)
  const zonasRowsRaw = XLSX.utils.sheet_to_json(wb.Sheets[sheetByName.ZONAS], { header: 1 });
  if (!zonasRowsRaw.length) throw new Error('Hoja ZONAS está vacía');
  const N = meses.length;
  const zonas = {};
  for (const row of zonasRowsRaw) {
    const zona = String(row[0] || '').trim().toUpperCase();
    const tipo = String(row[1] || '').trim();
    if (!zona || !tipo) continue;
    const valores = row.slice(2, 2 + N).map(v => +v || 0);
    if (!zonas[zona]) {
      zonas[zona] = {
        total_saidi: [], total_saifi: [],
        grp_saidi: { 'Sobrecarga/Deslastre': [], 'Racionamiento/Deficit': [], 'Otras causas': [] },
        grp_saifi: { 'Sobrecarga/Deslastre': [], 'Racionamiento/Deficit': [], 'Otras causas': [] },
        cat_saidi: {}, cat_saifi: {},
        proj: null,
      };
    }
    const z = zonas[zona];
    if (tipo === 'total_saidi')      z.total_saidi = valores;
    else if (tipo === 'total_saifi') z.total_saifi = valores;
    else if (/^grp_saidi_/.test(tipo)) {
      const grupo = tipo.replace(/^grp_saidi_/, '');
      z.grp_saidi[grupo] = valores;
    } else if (/^grp_saifi_/.test(tipo)) {
      const grupo = tipo.replace(/^grp_saifi_/, '');
      z.grp_saifi[grupo] = valores;
    } else if (/^cat_saidi_/.test(tipo)) {
      z.cat_saidi[tipo.replace(/^cat_saidi_/, '')] = valores;
    } else if (/^cat_saifi_/.test(tipo)) {
      z.cat_saifi[tipo.replace(/^cat_saifi_/, '')] = valores;
    }
  }

  // PROYECCION → filas por zona con base, opt, pes, ci_inf, ci_sup, r2, slope, pval
  const proyRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetByName.PROYECCION], { header: 1 });
  const Mfull = meses_full.length;
  for (const row of proyRows) {
    const zona = String(row[0] || '').trim().toUpperCase();
    const tipo = String(row[1] || '').trim();
    if (!zona || !tipo) continue;
    if (!zonas[zona]) continue;
    if (!zonas[zona].proj) zonas[zona].proj = { real: [], base: [], opt: [], pes: [], ci_inf: [], ci_sup: [], r2: 0, slope: 0, pval: 1 };
    const p = zonas[zona].proj;
    if (['real', 'base', 'opt', 'pes', 'ci_inf', 'ci_sup'].includes(tipo)) {
      p[tipo] = row.slice(2, 2 + Mfull).map(v => v == null || v === '' ? null : (+v || 0));
    } else if (['r2', 'slope', 'pval'].includes(tipo)) {
      p[tipo] = +row[2] || 0;
    }
  }

  // Categorías canónicas: deducir de cat_saidi de TODAS
  const todasCats = zonas.TODAS?.cat_saidi || {};
  const cats_order = Object.keys(todasCats);

  return {
    meses,
    meses_full,
    zonas,
    cats_order,
    kpi,
    proj_global: zonas.TODAS?.proj || null,
  };
}

// ── handleFile (punto de entrada) ────────────────────────────
export async function handleFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  let dataset;
  if (ext === 'json') {
    dataset = await parsearJSON(file);
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsb') {
    dataset = await parsearExcel(file);
  } else {
    throw new Error('Extensión no soportada · usa .json o .xlsx');
  }
  const meta = {
    nombre: file.name,
    size: file.size,
    cargadoAt: new Date().toISOString(),
  };
  await persistirDataset(dataset, meta);
  store.setDataset(dataset, 'upload');
  return { dataset, meta };
}
