// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · UPLOAD HANDLER
// ──────────────────────────────────────────────────────────────
// Acepta archivos JSON (con shape del baseline), Excel
// (XLSX/XLS/XLSB/XLSM con las 4 hojas pre-agregadas) o CSV (una
// sola tabla tipo hoja "ZONAS") y reemplaza el dataset del
// dashboard. Persiste en IndexedDB para que se mantenga entre
// recargas y permite "Reiniciar al baseline" para descartar.
//
// FORMATO JSON (preferido)
//   Mismo shape exacto que assets/data/indicadores-calidad-baseline.json:
//   { meses, meses_full, zonas: {TODAS, BOLIVAR, …}, cats_order, kpi, proj_global }
//
// FORMATO EXCEL (.xlsx / .xls / .xlsb / .xlsm)
//   Hoja "META":  A1=meses[0..N], B1=meses_full[0..N]
//   Hoja "KPI":   pares clave-valor (saidi_tot, sob_pct, etc.)
//   Hoja "ZONAS": filas por zona con columnas total_saidi_ene..,
//                 total_saifi_ene.., grp_sob_ene.., grp_rac_ene..,
//                 grp_otr_ene..
//   Hoja "PROYECCION": filas por zona con base[0..11], opt[0..11], pes[0..11],
//                       ci_inf, ci_sup, r2, slope, pval
//
//   Si el Excel no tiene este formato, el parser intenta inferir
//   con tolerancia y reporta qué falta. Los .xlsm (Excel con
//   macros) se leen igual que un .xlsx — las macros se ignoran.
//
// FORMATO CSV (una sola tabla = hoja "ZONAS")
//   Mismo criterio que la hoja ZONAS del Excel, en una sola tabla
//   plana. Cabecera opcional:  zona,tipo,Ene,Feb,Mar,Abr,May
//   Filas:  TODAS,total_saidi,1.2,1.3,…
//           TODAS,grp_saidi_Sobrecarga/Deslastre,…
//           TODAS,cat_saidi_SOBRECARGA TRAFO SDL,…
//   Como un CSV no puede llevar las 4 hojas, el parser deriva
//   `meses` de la cabecera (o por posición), `cats_order` de las
//   filas cat_saidi de TODAS y recalcula la proyección OLS por
//   zona con calcularProyeccionOLS — manteniendo el mismo criterio
//   del módulo.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { calcularProyeccionOLS } from '../../domain/saidi_proyeccion.js';
import {
  MESES_CANON,
  nuevaZona,
  aplicarTipoZona,
  derivarGruposDesdeCategorias,
  agregarDatosCrudos,
  agregarMetaProg,
} from '../../domain/saidi_datos.js';

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

// ── Helpers de zona (importados de domain/saidi_datos.js) ────
// MESES_CANON, nuevaZona, aplicarTipoZona, derivarGruposDesdeCategorias
// viven ahora en el módulo de dominio puro para poder testearlos sin DOM.

// ── Parser Excel ─────────────────────────────────────────────
// Dos formatos soportados:
//   1. PRE-AGREGADO · 4 hojas META/KPI/ZONAS/PROYECCION → parsearExcelPreAgregado
//   2. CRUDO · hoja DATOS con registros evento a evento  → agregarDatosCrudos
// Detecta cuál según las hojas presentes.
async function parsearExcel(file) {
  const XLSX = await loadSheetJS();
  const buf = await file.arrayBuffer();

  // Primera lectura ligera para inspeccionar nombres de hojas.
  const wbProbe = XLSX.read(buf, { type: 'array', cellDates: false, sheetRows: 1, bookSheets: true });
  const upper = {};
  for (const name of wbProbe.SheetNames) upper[name.toUpperCase()] = name;

  const tienePreAgg = ['META', 'KPI', 'ZONAS', 'PROYECCION'].every(n => upper[n]);
  if (tienePreAgg) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    return parsearExcelPreAgregado(XLSX, wb, upper);
  }

  // Vía rápida · hoja META plana (PERIODO × ZONA × CLASIFICACION_CREG_063
  // con META SAIDI_E / SAIFI_E). Es la fuente del aporte programado /
  // no-programado por zona y mes (la hoja DASHBOARD es su pivote). Se lee
  // SOLO esa hoja para no parsear la hoja DATOS (54 MB) cuando lo que se
  // necesita es el segmento prog/no-prog filtrable por zona/mes/métrica.
  if (upper.META) {
    const wbMeta = XLSX.read(buf, { type: 'array', cellDates: false, sheets: [upper.META] });
    const metaRows = XLSX.utils.sheet_to_json(
      wbMeta.Sheets[upper.META], { header: 1, blankrows: false, defval: '' });
    const head = (metaRows[0] || []).map(h => String(h || '').toUpperCase());
    const esMetaProg = head.some(h => h.includes('PERIODO'))
      && head.some(h => h.includes('CLASIFIC'));
    if (esMetaProg) {
      const dataset = agregarMetaProg(metaRows);
      console.info('[calidad/upload] META prog/no-prog agregado · meses:', dataset.meses.length);
      return dataset;
    }
  }

  // Hoja DATOS: nombre exacto o cualquier hoja que lo contenga
  // ("BASE DATOS", "DATOS 2026", …).
  const nombreDatos = upper.DATOS
    || wbProbe.SheetNames.find(n => /datos/i.test(n));
  if (nombreDatos) {
    // Documento real de trabajo: leemos la hoja DATOS cruda con fechas
    // nativas y la agregamos con el criterio de extracción.
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombreDatos], { header: 1, blankrows: false });
    const { dataset, reporte } = agregarDatosCrudos(rows);
    console.info('[calidad/upload] DATOS agregado:', reporte);
    return dataset;
  }

  throw new Error(
    'Excel sin formato reconocido · se esperaba la hoja "DATOS" (documento de ' +
    'trabajo) o las 4 hojas META/KPI/ZONAS/PROYECCION (pre-agregado) · ' +
    'hojas detectadas: ' + wbProbe.SheetNames.join(', ')
  );
}

// ── Parser Excel · formato pre-agregado (4 hojas) ────────────
function parsearExcelPreAgregado(XLSX, wb, sheetByName) {
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
    if (!zonas[zona]) zonas[zona] = nuevaZona();
    aplicarTipoZona(zonas[zona], tipo, valores);
  }

  // Criterio de extracción: si una zona trae solo categorías, derivar
  // sus grupos + total para que el documento se aprecie completo.
  for (const z of Object.values(zonas)) derivarGruposDesdeCategorias(z, N);

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

// ── Parser CSV ───────────────────────────────────────────────
// Una sola tabla plana equivalente a la hoja ZONAS del Excel.
// Cabecera opcional (col A == "zona"). Deriva meses, cats_order y
// recalcula la proyección OLS por zona — manteniendo el criterio
// del módulo (kpi queda vacío; los renderers lo computan de zonas).
async function parsearCSV(file) {
  const XLSX = await loadSheetJS();
  const text = await file.text();
  const wb = XLSX.read(text, { type: 'string' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('CSV vacío o ilegible');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (!rows.length) throw new Error('CSV sin filas');

  // Detectar cabecera (col A == "zona") para derivar `meses`.
  let meses = null;
  let dataRows = rows;
  if (String(rows[0][0] || '').trim().toLowerCase() === 'zona') {
    meses = rows[0].slice(2).filter(v => v != null && v !== '').map(String);
    dataRows = rows.slice(1);
  }

  // Inferir N (cantidad de meses) de la fila de datos más ancha.
  let N = meses ? meses.length : 0;
  if (!N) {
    for (const row of dataRows) N = Math.max(N, row.length - 2);
    meses = MESES_CANON.slice(0, N);
  }
  if (N < 1) throw new Error('CSV sin columnas de meses · usa zona,tipo,Ene,Feb,…');

  const zonas = {};
  for (const row of dataRows) {
    const zona = String(row[0] || '').trim().toUpperCase();
    const tipo = String(row[1] || '').trim();
    if (!zona || !tipo) continue;
    const valores = row.slice(2, 2 + N).map(v => +v || 0);
    if (!zonas[zona]) zonas[zona] = nuevaZona();
    aplicarTipoZona(zonas[zona], tipo, valores);
  }
  if (!zonas.TODAS) {
    throw new Error('CSV · falta la zona "TODAS" (fila con col A = TODAS)');
  }

  // Criterio de extracción: si el CSV solo trae categorías (las 13
  // causas u otras), derivar grupos + total por zona con el
  // clasificador canónico — manteniendo la forma de ilustrar.
  for (const z of Object.values(zonas)) derivarGruposDesdeCategorias(z, N);

  // meses_full = 12 meses canónicos (el módulo proyecta a Diciembre).
  const meses_full = MESES_CANON.slice();
  const cats_order = Object.keys(zonas.TODAS.cat_saidi || {});

  // Recalcular proyección OLS por zona sobre SAIDI grupo Sob/Desl.
  for (const z of Object.values(zonas)) {
    const serie = z.grp_saidi['Sobrecarga/Deslastre'] || [];
    z.proj = serie.length >= 2
      ? calcularProyeccionOLS(serie, meses_full.length)
      : null;
  }

  return {
    meses,
    meses_full,
    zonas,
    cats_order,
    kpi: {},
    proj_global: zonas.TODAS.proj || null,
  };
}

// Dispatcher por extensión → dataset parseado.
async function parsearArchivo(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'json') return parsearJSON(file);
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsb' || ext === 'xlsm') return parsearExcel(file);
  if (ext === 'csv') return parsearCSV(file);
  throw new Error(`Extensión no soportada (${file.name}) · usa .json, .xlsx, .xlsm o .csv`);
}

// Combina N datasets en uno solo (p. ej. un .xlsm + un .csv
// complementarios). Estrategia "no pisar lo no vacío":
//   - totals / grupos: gana la serie no vacía (archivos complementarios
//     por métrica o por zona se unen sin colisión)
//   - categorías: unión por nombre (la última gana ante mismo nombre)
//   - tras unir, deriva grupos+total para métricas aún vacías y
//     recalcula la proyección OLS por zona
function mergeZona(dest, src) {
  for (const k of ['total_saidi', 'total_saifi']) {
    if (Array.isArray(src[k]) && src[k].length) dest[k] = src[k];
  }
  for (const gk of ['grp_saidi', 'grp_saifi']) {
    for (const g of Object.keys(src[gk] || {})) {
      if (Array.isArray(src[gk][g]) && src[gk][g].length) dest[gk][g] = src[gk][g];
    }
  }
  for (const ck of ['cat_saidi', 'cat_saifi']) {
    for (const c of Object.keys(src[ck] || {})) dest[ck][c] = src[ck][c];
  }
  if (src.proj && !dest.proj) dest.proj = src.proj;
}

function combinarDatasets(list) {
  const meses_full = MESES_CANON.slice();
  let meses = [];
  for (const d of list) if ((d.meses || []).length > meses.length) meses = d.meses;
  const N = meses.length || MESES_CANON.length;

  const zonas = {};
  for (const d of list) {
    for (const [zname, zsrc] of Object.entries(d.zonas || {})) {
      if (!zonas[zname]) zonas[zname] = nuevaZona();
      mergeZona(zonas[zname], zsrc);
    }
  }
  if (!zonas.TODAS) {
    throw new Error('Los archivos combinados no incluyen la zona "TODAS"');
  }

  for (const z of Object.values(zonas)) derivarGruposDesdeCategorias(z, N);
  for (const z of Object.values(zonas)) {
    if (z.proj) continue;
    const serie = z.grp_saidi['Sobrecarga/Deslastre'] || [];
    z.proj = serie.length >= 2 ? calcularProyeccionOLS(serie, meses_full.length) : null;
  }

  const cats_order = Object.keys(zonas.TODAS.cat_saidi || {});
  return {
    meses: meses.length ? meses : MESES_CANON.slice(0, N),
    meses_full,
    zonas,
    cats_order,
    kpi: {},
    proj_global: zonas.TODAS.proj || null,
  };
}

// ── handleFile (un solo archivo) ─────────────────────────────
export async function handleFile(file) {
  const dataset = await parsearArchivo(file);
  const meta = {
    nombre: file.name,
    size: file.size,
    cargadoAt: new Date().toISOString(),
  };
  await persistirDataset(dataset, meta);
  store.setDataset(dataset, 'upload');
  return { dataset, meta };
}

// ── handleFiles (uno o varios · p. ej. .xlsm + .csv juntos) ───
export async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) throw new Error('No se seleccionó ningún archivo');
  if (files.length === 1) return handleFile(files[0]);

  const datasets = [];
  for (const f of files) datasets.push(await parsearArchivo(f));
  const dataset = combinarDatasets(datasets);
  const meta = {
    nombre: files.map(f => f.name).join(' + '),
    size: files.reduce((a, f) => a + (f.size || 0), 0),
    cargadoAt: new Date().toISOString(),
    archivos: files.length,
  };
  await persistirDataset(dataset, meta);
  store.setDataset(dataset, 'upload');
  return { dataset, meta };
}
