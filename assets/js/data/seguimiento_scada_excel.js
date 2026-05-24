// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · PARSERS DE ARCHIVOS
// ──────────────────────────────────────────────────────────────
// Parseo de archivos .xlsb / .xlsx / .xls / .csv / .jsonl con
// eventos SOE. Replica la lógica del extractor Python para que
// los event_id (MD5 hex 16) coincidan y la deduplicación funcione
// cuando se recarga el mismo archivo.
//
// SheetJS y SparkMD5 se cargan LAZY desde CDN al primer uso.
// ══════════════════════════════════════════════════════════════

import {
  ELEM_MAP, DESC_PATTERN, SOE_HEADERS,
} from '../domain/scada_config.js';
import { loadSparkMD5, md5hex16 } from './seguimiento_scada_storage.js';

const SHEETJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _sheetjsPromise = null;

export function loadSheetJS() {
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

// ── parseExcelDateParts ───────────────────────────────────────
// Devuelve {iso:'YYYY-MM-DDTHH:MM:SS', date:'YYYY-MM-DD'} sin pasar
// por UTC. Replica convert_date() de pyxlsb (datetime naive en hora
// local del SOE).
export function parseExcelDateParts(v) {
  if (v === null || v === undefined || v === '') return null;
  const pad = (n) => String(n).padStart(2, '0');

  if (typeof v === 'number') {
    // Serial Excel: días desde 1899-12-30. pyxlsb redondea al segundo
    // más cercano; replicamos ese redondeo para que el event_id coincida.
    let ms = (v - 25569) * 86400 * 1000;
    ms = Math.round(ms / 1000) * 1000;
    const d = new Date(ms);
    const Y = d.getUTCFullYear(), Mo = d.getUTCMonth() + 1, Da = d.getUTCDate();
    const H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
    return {
      iso:  `${Y}-${pad(Mo)}-${pad(Da)}T${pad(H)}:${pad(Mi)}:${pad(S)}`,
      date: `${Y}-${pad(Mo)}-${pad(Da)}`,
    };
  }
  if (v instanceof Date) {
    const Y = v.getFullYear(), Mo = v.getMonth() + 1, Da = v.getDate();
    const H = v.getHours(), Mi = v.getMinutes(), S = v.getSeconds();
    return {
      iso:  `${Y}-${pad(Mo)}-${pad(Da)}T${pad(H)}:${pad(Mi)}:${pad(S)}`,
      date: `${Y}-${pad(Mo)}-${pad(Da)}`,
    };
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(' ', 'T');
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(s);
    if (m) return { iso: `${m[1]}T${m[2]}`, date: m[1] };
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const Y = d.getFullYear(), Mo = d.getMonth() + 1, Da = d.getDate();
      const H = d.getHours(), Mi = d.getMinutes(), S = d.getSeconds();
      return {
        iso:  `${Y}-${pad(Mo)}-${pad(Da)}T${pad(H)}:${pad(Mi)}:${pad(S)}`,
        date: `${Y}-${pad(Mo)}-${pad(Da)}`,
      };
    }
  }
  return null;
}

// ── parseSOERows ──────────────────────────────────────────────
// Acepta hojas de Excel (xlsb/xlsx) con cabeceras SOE_HEADERS.
// applyFilter: true → aplica filtro SOE (F=swTr* · col.A vacía ·
// APPEAR · U1/U2). false → conserva todas las filas válidas.
export async function parseSOERows(rows, applyFilter) {
  const header = rows[0] ? rows[0].map(c => (c === undefined ? '' : String(c).trim())) : [];
  const idx = (name) => header.findIndex(h => h === name);
  const iA   = idx('A');
  const iRTU = idx('FECHA_RTU');
  const iB1  = idx('B1');
  const iB2  = idx('B2');
  const iB3  = idx('B3');
  const iELEM = idx('ELEMENT');
  const iDESC = idx('DESCRIPTION');
  const iSTAT = idx('STATUS');
  const iB1N  = idx('B1_NAME');
  const iTAG  = idx('TAG');
  const iZONA = idx('ZONA');

  const required = SOE_HEADERS.REQUIRED;
  if (iRTU < 0 || iB3 < 0 || iDESC < 0 || iSTAT < 0 || iTAG < 0) {
    throw new Error(
      'Estructura SOE no reconocida. Cabeceras esperadas: ' + required.join(', ')
    );
  }

  // SparkMD5 debe estar cargado antes de invocar md5hex16
  await loadSparkMD5();

  const out = [];
  let scanned = 0, filtered = 0, unparseable = 0, droppedByA = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    scanned++;
    const b3   = String(row[iB3]   ?? '').trim();
    const stat = String(row[iSTAT] ?? '').trim();
    const tag  = String(row[iTAG]  ?? '').trim();
    const aVal = iA >= 0 ? row[iA] : '';
    const aEmpty = (aVal === null || aVal === undefined || String(aVal).trim() === '');
    if (applyFilter) {
      if (!b3.startsWith('swTr'))            continue;
      if (!aEmpty) { droppedByA++;           continue; }
      if (stat !== 'APPEAR')                 continue;
      if (tag !== 'U1' && tag !== 'U2')      continue;
    }
    const desc = String(row[iDESC] ?? '').trim();
    const m = DESC_PATTERN.exec(desc);
    if (!m) { unparseable++; continue; }
    const measured = parseFloat(m[1]);
    const limit    = parseFloat(m[2]);
    const unit_phys = m[3];
    if (measured === 0 && limit === 0) continue;

    const elem = String(row[iELEM] ?? '').trim();
    const [parameter, expected_uom] = ELEM_MAP[elem] || [elem, unit_phys];
    const b1n  = String(row[iB1N]  ?? '').trim();
    const b2   = String(row[iB2]   ?? '').trim();
    const zona = String(row[iZONA] ?? '').trim();

    const parts = parseExcelDateParts(row[iRTU]);
    if (!parts) continue;
    const tsISO = parts.iso;
    const dateStr = parts.date;

    const swtrafo_id = `${b1n}__${b3}__${b2}`.replace(/\s+/g, '');
    const violation  = measured - limit;
    const is_violation = violation > 0;
    const seed = `${tsISO}|${b3}|${b1n}|${elem}|${tag}`;
    const id = md5hex16(seed);

    out.push({
      id, ts: tsISO, date: dateStr,
      sid: swtrafo_id, sub: b1n, asset: b3, kv: b2, zona,
      u: tag, param: parameter, uom: unit_phys,
      m: measured, l: limit,
      v:  Math.round(violation * 10000) / 10000,
      vp: limit !== 0 ? Math.round((100 * violation / limit) * 1000) / 1000 : null,
      viol: is_violation ? 1 : 0,
    });
    filtered++;
  }
  return { events: out, scanned, filtered, unparseable, droppedByA };
}

// ── normalizeJsonRow ──────────────────────────────────────────
// Acepta el formato del CSV/JSONL exportado por el sistema y lo
// convierte al shape interno del dashboard.
export function normalizeJsonRow(r) {
  const ts = r.timestamp_rtu || r.ts || r.timestamp;
  if (!ts) return null;
  const measured = parseFloat(r.measured_value ?? r.m);
  const limit    = parseFloat(r.limit_value ?? r.l);
  const violation = (!Number.isNaN(measured) && !Number.isNaN(limit))
    ? (measured - limit)
    : parseFloat(r.violation_amount ?? r.v);
  const rawViol = r.is_violation ?? r.viol;
  let isViol;
  if (rawViol !== undefined && rawViol !== null && rawViol !== '') {
    const s = String(rawViol).toLowerCase().trim();
    isViol = (s === 'true' || s === '1' || s === 'yes' || s === 'si' || rawViol === true || rawViol === 1);
  } else {
    isViol = violation > 0;
  }
  return {
    id: r.event_id || r.id,
    ts: typeof ts === 'string' ? ts.slice(0, 19) : new Date(ts).toISOString().slice(0, 19),
    date: r.date || (typeof ts === 'string' ? ts.slice(0, 10) : new Date(ts).toISOString().slice(0, 10)),
    sid: r.swtrafo_id || r.sid,
    sub: r.substation || r.sub,
    asset: r.asset,
    kv: r.voltage_level || r.kv,
    zona: r.zona || '',
    u: r.unit || r.u,
    param: r.parameter || r.param,
    uom: r.unit_of_measure || r.uom,
    m: measured,
    l: limit,
    v:  Math.round(violation * 10000) / 10000,
    vp: r.violation_pct !== undefined ? parseFloat(r.violation_pct)
       : (r.vp !== undefined ? parseFloat(r.vp)
       : (limit !== 0 ? Math.round((100 * violation / limit) * 1000) / 1000 : null)),
    viol: isViol ? 1 : 0,
  };
}

// ── parseCSV ──────────────────────────────────────────────────
export function parseCSVLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length !== header.length) continue;
    const obj = {};
    header.forEach((h, j) => { obj[h] = cols[j]; });
    const ev = normalizeJsonRow(obj);
    if (ev) events.push(ev);
  }
  return events;
}

// ── parseOneFile ──────────────────────────────────────────────
// Detecta extensión y delega al parser correspondiente. Lazy carga
// SheetJS solo si el archivo lo requiere.
export async function parseOneFile(file, applyFilter, onLog) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'jsonl' || ext === 'json') {
    const text = await file.text();
    const events = [];
    const lines = ext === 'json' ? [text] : text.split(/\r?\n/);
    let scanned = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      scanned++;
      let obj;
      try { obj = JSON.parse(trimmed); } catch (_) { continue; }
      const items = Array.isArray(obj) ? obj : [obj];
      for (const r of items) {
        const ev = normalizeJsonRow(r);
        if (ev) events.push(ev);
      }
    }
    return { events, scanned, filtered: events.length, unparseable: 0, droppedByA: 0 };
  }
  if (ext === 'csv') {
    const text = await file.text();
    const events = parseCSV(text);
    return { events, scanned: events.length, filtered: events.length, unparseable: 0, droppedByA: 0 };
  }
  if (ext === 'xlsb' || ext === 'xlsx' || ext === 'xls') {
    const XLSX = await loadSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames.includes('SOE') ? 'SOE' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (onLog) onLog('info', `  hoja: '${sheetName}' · ${rows.length.toLocaleString()} filas`);
    return await parseSOERows(rows, applyFilter);
  }
  throw new Error('Extensión no soportada: .' + ext);
}
