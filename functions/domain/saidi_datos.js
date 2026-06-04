// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · AGREGADOR DE DATOS CRUDOS
// ──────────────────────────────────────────────────────────────
// Lee la hoja "DATOS" del documento real de trabajo (registros
// evento por evento) y la agrega a la estructura que consume el
// dashboard: { meses, meses_full, zonas, cats_order, ... }.
//
// Mapeo de columnas (provisto por el director · 0-based):
//   · Causa 2     → columna N  (idx 13)
//   · PERIODO     → columna AC (idx 28)  ← mes del evento
//   · SAIFI_E     → columna AJ (idx 35)
//   · SAIDI_E     → columna AK (idx 36)
//   · DIA         → columna BB (idx 53)  ← día del mes del evento
//   · ZONA        → columna BG (idx 58)
//   · NB_SUBEST   → columna AW (idx 48)  ← nombre de la subestación
//   · Mes/Día     → de PERIODO (AC) y DIA (BB). Si faltan, se cae a
//                   una columna de fecha única autodetectada (fecha:-1).
//
// Cada registro suma su SAIDI_E / SAIFI_E al mes × zona × causa.
// La causa cruda se preserva como nombre de categoría (no se renombra)
// para "mantener la forma de ilustrar". Los 3 grupos canónicos y el
// total se derivan después con clasificarGrupoCausa, y la proyección
// con calcularProyeccionOLS.
//
// Funciones PURAS · sin DOM · sin I/O · testeables con node --test.
// ══════════════════════════════════════════════════════════════

import { clasificarGrupoCausa, esCausaCanonica, esCausaSobrecarga } from './saidi_config.js';
import { calcularProyeccionOLS } from './saidi_proyeccion.js';

// Sentinel del filtro madre "SOBRECARGA" (CAUSA2). Distinto de cualquier
// nombre de causa real (incl. 'Sobrecarga') para no colisionar al elegir
// una causa individual en el selector.
export const CAUSA2_TODAS = '';
export const CAUSA2_SOBRECARGA = '__SOBRECARGA__';

// 12 meses canónicos (orden del eje del dashboard).
export const MESES_CANON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Defaults de columnas (0-based) del documento real de trabajo.
export const COLS_DATOS_DEFAULT = Object.freeze({
  causa:   13,  // N
  periodo: 28,  // AC — mes del evento (1–12, nombre, o fecha)
  saifi:   35,  // AJ
  saidi:   36,  // AK
  dia:     53,  // BB — día del mes (1–31)
  zona:    58,  // BG
  subest:  48,  // AW — NB_SUBESTACION
  fecha:   -1,  // -1 = autodetectar columna de fecha única (fallback)
});

// Convierte letras de columna Excel ("A", "N", "AJ", "BG") a índice
// 0-based. "A"→0, "N"→13, "AJ"→35, "AK"→36, "BG"→58.
export function colIdx(letters) {
  const s = String(letters || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

// ── Mes desde un valor de celda ──────────────────────────────
// Acepta:
//   · Date nativo (cellDates:true)        → getMonth()
//   · número serial Excel (~30000–60000)  → convierte a fecha
//   · "dd/mm/yyyy" o "dd-mm-yyyy"          → 2º grupo = mes
//   · "yyyy-mm-dd"                          → 2º grupo = mes
//   · "mm/yyyy"                             → 1º grupo = mes
//   · nombre/abreviatura de mes en español → match canónico
// Devuelve índice de mes 0–11, o null si no se puede interpretar.
export function mesDesdeValor(v) {
  if (v == null || v === '') return null;

  // Date nativo
  if (v instanceof Date && !isNaN(v.getTime())) return v.getMonth();

  // Número serial de Excel (días desde 1899-12-30). Exigimos un piso
  // alto (~año 1954) para no confundir valores pequeños de SAIDI/SAIFI
  // (0.8, 1.2, …) con fechas seriales durante la autodetección.
  if (typeof v === 'number' && isFinite(v)) {
    if (v >= 20000 && v < 100000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.getUTCMonth();
    }
    return null;
  }

  const s = String(v).trim();
  if (!s) return null;

  // yyyy-mm-dd  o  yyyy/mm/dd
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) { const mes = +m[2]; return mes >= 1 && mes <= 12 ? mes - 1 : null; }

  // dd/mm/yyyy  o  dd-mm-yyyy
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) { const mes = +m[2]; return mes >= 1 && mes <= 12 ? mes - 1 : null; }

  // mm/yyyy
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) { const mes = +m[1]; return mes >= 1 && mes <= 12 ? mes - 1 : null; }

  // Nombre o abreviatura de mes en español (con/sin acentos)
  const norm = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const NOMBRES = [
    ['ene', 'enero'], ['feb', 'febrero'], ['mar', 'marzo'], ['abr', 'abril'],
    ['may', 'mayo'], ['jun', 'junio'], ['jul', 'julio'], ['ago', 'agosto'],
    ['sep', 'set', 'septiembre', 'setiembre'], ['oct', 'octubre'],
    ['nov', 'noviembre'], ['dic', 'diciembre'],
  ];
  for (let i = 0; i < NOMBRES.length; i++) {
    for (const alias of NOMBRES[i]) {
      if (norm === alias || norm.startsWith(alias)) return i;
    }
  }
  return null;
}

// ── Día del mes desde un valor de celda ──────────────────────
// Misma lógica de interpretación que mesDesdeValor, pero devuelve el
// día del mes (1–31) cuando el valor lleva fecha con día explícito.
// Los formatos sin día (mm/yyyy, nombre de mes) devuelven null porque
// no aportan resolución diaria. Devuelve 1–31 o null.
export function diaDesdeValor(v) {
  if (v == null || v === '') return null;

  if (v instanceof Date && !isNaN(v.getTime())) return v.getDate();

  if (typeof v === 'number' && isFinite(v)) {
    if (v >= 20000 && v < 100000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.getUTCDate();
    }
    return null;
  }

  const s = String(v).trim();
  if (!s) return null;

  // yyyy-mm-dd  o  yyyy/mm/dd  → 3er grupo = día
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) { const dia = +m[3]; return dia >= 1 && dia <= 31 ? dia : null; }

  // dd/mm/yyyy  o  dd-mm-yyyy  → 1er grupo = día
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) { const dia = +m[1]; return dia >= 1 && dia <= 31 ? dia : null; }

  // mm/yyyy y nombres de mes no tienen día.
  return null;
}

// ── Mes desde la columna PERIODO (AC) ────────────────────────
// La hoja DATOS parte la fecha en dos columnas: PERIODO (mes) y DIA.
// PERIODO puede venir como entero 1–12, como "1".."12", como nombre de
// mes, o como una fecha completa. Devuelve índice 0–11 o null.
export function mesDesdePeriodo(v) {
  if (v == null || v === '') return null;

  // Date nativo → intérprete general.
  if (v instanceof Date) return mesDesdeValor(v);

  // Entero 1–12 directo (caso más común de la columna PERIODO).
  if (typeof v === 'number' && isFinite(v)) {
    if (Number.isInteger(v) && v >= 1 && v <= 12) return v - 1;
    // Serial Excel o cualquier otro número → delega a mesDesdeValor.
    return mesDesdeValor(v);
  }

  const s = String(v).trim();
  if (!s) return null;

  // "1".."12" como texto plano (sin separadores de fecha).
  if (/^\d{1,2}$/.test(s)) {
    const mes = +s;
    return mes >= 1 && mes <= 12 ? mes - 1 : null;
  }

  // Fecha completa o nombre de mes → reusa el intérprete general.
  return mesDesdeValor(s);
}

// ── Día desde la columna DIA (BB) ────────────────────────────
// DIA suele venir como entero 1–31. Acepta también "1".."31" texto, o
// una fecha completa (delega a diaDesdeValor). Devuelve 1–31 o null.
export function diaDesdeColumna(v) {
  if (v == null || v === '') return null;

  // Date nativo → intérprete general.
  if (v instanceof Date) return diaDesdeValor(v);

  if (typeof v === 'number' && isFinite(v)) {
    if (Number.isInteger(v) && v >= 1 && v <= 31) return v;
    return diaDesdeValor(v);
  }

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{1,2}$/.test(s)) {
    const dia = +s;
    return dia >= 1 && dia <= 31 ? dia : null;
  }

  return diaDesdeValor(s);
}

// ── Autodetección de la columna de fecha ─────────────────────
// Puntúa cada columna por tasa de celdas interpretables como fecha
// (mesDesdeValor != null) sobre una muestra, más un bonus si el
// encabezado contiene "fecha"/"periodo"/"mes". Devuelve el índice de
// la columna ganadora, o -1 si ninguna supera el umbral.
export function detectarColumnaFecha(rows, { muestra = 400, umbral = 0.5 } = {}) {
  if (!Array.isArray(rows) || rows.length < 2) return -1;

  // Encabezado en las primeras filas para el bonus por palabra clave.
  const headerTxt = [];
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      headerTxt[c] = (headerTxt[c] || '') + ' ' +
        String(row[c] ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
  }

  // Ancho máximo de columnas.
  let ancho = 0;
  for (const row of rows) ancho = Math.max(ancho, (row || []).length);

  // Saltar fila de encabezado para el muestreo de datos.
  const dataStart = 1;
  const total = Math.min(muestra, rows.length - dataStart);
  if (total <= 0) return -1;

  let mejorCol = -1;
  let mejorScore = 0;
  for (let c = 0; c < ancho; c++) {
    let ok = 0;
    let vistos = 0;
    for (let r = dataStart; r < dataStart + total; r++) {
      const cell = (rows[r] || [])[c];
      if (cell == null || cell === '') continue;
      vistos++;
      if (mesDesdeValor(cell) != null) ok++;
    }
    if (!vistos) continue;
    const rate = ok / vistos;
    const bonus = /fecha|periodo|\bmes\b/.test(headerTxt[c] || '') ? 0.25 : 0;
    const score = rate + bonus;
    if (rate >= umbral && score > mejorScore) { mejorScore = score; mejorCol = c; }
  }
  return mejorCol;
}

// ── Detección de columna por nombre de encabezado ────────────
// Escanea las primeras filas (encabezado puede no estar en la 0) buscando
// una celda cuyo texto normalizado (sin tildes, lower) matchee `regex`.
// Devuelve el índice 0-based de la columna, o -1 si no hay match. Se usa
// como fallback robusto cuando la columna no está en la posición fija
// esperada (p. ej. NB_SUBESTACION fuera de AW por un Excel reordenado).
export function detectarColumnaPorHeader(rows, regex, { filas = 6 } = {}) {
  if (!Array.isArray(rows) || rows.length < 1) return -1;
  const tope = Math.min(filas, rows.length);
  for (let r = 0; r < tope; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (txt && regex.test(txt)) return c;
    }
  }
  return -1;
}

// ── Helpers de zona (compartidos con el upload handler) ──────
export function nuevaZona() {
  return {
    total_saidi: [], total_saifi: [],
    grp_saidi: { 'Sobrecarga/Deslastre': [], 'Racionamiento/Deficit': [], 'Otras causas': [] },
    grp_saifi: { 'Sobrecarga/Deslastre': [], 'Racionamiento/Deficit': [], 'Otras causas': [] },
    cat_saidi: {}, cat_saifi: {},
    proj: null,
  };
}

// Aplica una fila `tipo` con sus valores mensuales a la zona z.
export function aplicarTipoZona(z, tipo, valores) {
  if (tipo === 'total_saidi')        z.total_saidi = valores;
  else if (tipo === 'total_saifi')   z.total_saifi = valores;
  else if (/^grp_saidi_/.test(tipo)) z.grp_saidi[tipo.replace(/^grp_saidi_/, '')] = valores;
  else if (/^grp_saifi_/.test(tipo)) z.grp_saifi[tipo.replace(/^grp_saifi_/, '')] = valores;
  else if (/^cat_saidi_/.test(tipo)) z.cat_saidi[tipo.replace(/^cat_saidi_/, '')] = valores;
  else if (/^cat_saifi_/.test(tipo)) z.cat_saifi[tipo.replace(/^cat_saifi_/, '')] = valores;
}

// Suma elemento a elemento la serie `src` sobre `dest`.
export function sumarSeries(dest, src) {
  for (let i = 0; i < src.length; i++) dest[i] = (dest[i] || 0) + (+src[i] || 0);
  return dest;
}

// Deriva los 3 grupos canónicos (y el total) sumando las categorías
// cargadas con el CLASIFICADOR CANÓNICO. No pisa grupos/total provistos.
export function derivarGruposDesdeCategorias(z, N) {
  for (const met of ['saidi', 'saifi']) {
    const cats = z[`cat_${met}`] || {};
    const catNames = Object.keys(cats);
    if (!catNames.length) continue;

    const grpVacio = Object.values(z[`grp_${met}`]).every(s => !s || !s.length);
    const totVacio = !z[`total_${met}`] || !z[`total_${met}`].length;
    if (!grpVacio && !totVacio) continue;

    const acumGrp = {
      'Sobrecarga/Deslastre':  new Array(N).fill(0),
      'Racionamiento/Deficit': new Array(N).fill(0),
      'Otras causas':          new Array(N).fill(0),
    };
    const acumTot = new Array(N).fill(0);
    for (const cat of catNames) {
      const serie = cats[cat] || [];
      sumarSeries(acumGrp[clasificarGrupoCausa(cat)], serie);
      sumarSeries(acumTot, serie);
    }
    if (grpVacio) z[`grp_${met}`] = acumGrp;
    if (totVacio) z[`total_${met}`] = acumTot;
  }
}

// ── Filtro de las 13 causas canónicas a nivel de DATASET ─────
// Garantía de extracción independiente del formato de origen: dado un
// dataset YA construido (baseline, pre-agregado, CSV, caché de IndexedDB
// o DATOS crudo), descarta de cada zona toda categoría que NO sea una de
// las 13 causas del catálogo y RE-DERIVA grupos + total + proyección +
// cats_order desde las categorías filtradas. Así el módulo SOLO muestra
// las 13 causas, sin importar de dónde venga el dataset.
//
// Si una zona no trae categorías (solo grupos/total pre-agregados sin
// desglose), se preserva tal cual — no hay con qué filtrar.
export function filtrarCausasCanonicas(dataset) {
  if (!dataset || !dataset.zonas || typeof dataset.zonas !== 'object') return dataset;

  // N = nº de meses. Preferimos meses; si falta, inferimos del serie más larga.
  let N = Array.isArray(dataset.meses) ? dataset.meses.length : 0;
  if (!N) {
    for (const z of Object.values(dataset.zonas)) {
      for (const met of ['saidi', 'saifi']) {
        for (const serie of Object.values(z?.[`cat_${met}`] || {})) {
          if (Array.isArray(serie)) N = Math.max(N, serie.length);
        }
        const tot = z?.[`total_${met}`];
        if (Array.isArray(tot)) N = Math.max(N, tot.length);
      }
    }
  }
  const Mfull = Array.isArray(dataset.meses_full) ? dataset.meses_full.length : MESES_CANON.length;

  const zonas = {};
  for (const [zname, z] of Object.entries(dataset.zonas)) {
    const zf = nuevaZona();
    let tieneCats = false;

    for (const met of ['saidi', 'saifi']) {
      const cats = z?.[`cat_${met}`] || {};
      for (const [cat, serie] of Object.entries(cats)) {
        if (esCausaCanonica(cat)) {
          zf[`cat_${met}`][cat] = Array.isArray(serie) ? serie.slice() : [];
          tieneCats = true;
        }
      }
    }

    if (tieneCats) {
      // Re-derivar grupos + total SOLO desde las categorías canónicas.
      derivarGruposDesdeCategorias(zf, N);
      const sob = zf.grp_saidi['Sobrecarga/Deslastre'] || [];
      zf.proj = sob.length >= 2 ? calcularProyeccionOLS(sob, Mfull) : (z.proj || null);
    } else {
      // Sin desglose por categoría: no hay forma de filtrar; preservar.
      zf.total_saidi = Array.isArray(z?.total_saidi) ? z.total_saidi.slice() : [];
      zf.total_saifi = Array.isArray(z?.total_saifi) ? z.total_saifi.slice() : [];
      for (const gk of ['grp_saidi', 'grp_saifi']) {
        for (const g of Object.keys(z?.[gk] || {})) {
          zf[gk][g] = Array.isArray(z[gk][g]) ? z[gk][g].slice() : [];
        }
      }
      zf.proj = z?.proj || null;
    }
    zonas[zname] = zf;
  }

  // cats_order desde TODAS, por aporte SAIDI descendente.
  const catsTodas = zonas.TODAS?.cat_saidi || {};
  const cats_order = Object.keys(catsTodas).sort((a, b) => {
    const sa = (catsTodas[a] || []).reduce((x, y) => x + (+y || 0), 0);
    const sb = (catsTodas[b] || []).reduce((x, y) => x + (+y || 0), 0);
    return sb - sa;
  });

  return {
    ...dataset,
    zonas,
    cats_order,
    proj_global: zonas.TODAS?.proj || dataset.proj_global || null,
  };
}

// ── Filtro CAUSA2 a nivel de DATASET ─────────────────────────
// Estrecha el dataset (ya filtrado a las 13 causas canónicas) a un
// subconjunto de categorías según el selector CAUSA2:
//   · CAUSA2_TODAS ('')            → sin filtro (devuelve el dataset tal cual)
//   · CAUSA2_SOBRECARGA            → filtro madre: las 13 causas de
//                                     sobrecarga/deslastre de transporte
//                                     (esCausaSobrecarga), sin Racionamiento
//   · '<nombre de causa>'          → una sola causa exacta
// Re-deriva grupos + total + proyección + cats_order desde las categorías
// que sobreviven. El spread `...dataset` preserva dias / subests / meses /
// mesesIdx / progCat. El aporte `prog` (programado/no-programado) SÍ se
// re-agrega: se recalcula desde progCat sumando solo las causas incluidas,
// para que el filtro CAUSA2 aísle el impacto prog/no-prog por causa.
export function filtrarPorCausa2(dataset, causa2) {
  const sel = causa2 == null ? CAUSA2_TODAS : causa2;
  if (sel === CAUSA2_TODAS) return dataset;
  if (!dataset || !dataset.zonas || typeof dataset.zonas !== 'object') return dataset;

  let N = Array.isArray(dataset.meses) ? dataset.meses.length : 0;
  if (!N) {
    for (const z of Object.values(dataset.zonas)) {
      for (const serie of Object.values(z?.cat_saidi || {})) {
        if (Array.isArray(serie)) N = Math.max(N, serie.length);
      }
    }
  }
  const Mfull = Array.isArray(dataset.meses_full) ? dataset.meses_full.length : MESES_CANON.length;

  // Predicado de pertenencia: filtro madre vs causa única exacta.
  const incluir = sel === CAUSA2_SOBRECARGA
    ? (cat) => esCausaSobrecarga(cat)
    : (cat) => cat === sel;

  const zonas = {};
  for (const [zname, z] of Object.entries(dataset.zonas)) {
    const zf = nuevaZona();
    for (const met of ['saidi', 'saifi']) {
      const cats = z?.[`cat_${met}`] || {};
      for (const [cat, serie] of Object.entries(cats)) {
        if (incluir(cat)) zf[`cat_${met}`][cat] = Array.isArray(serie) ? serie.slice() : [];
      }
    }
    derivarGruposDesdeCategorias(zf, N);
    const sob = zf.grp_saidi['Sobrecarga/Deslastre'] || [];
    zf.proj = sob.length >= 2 ? calcularProyeccionOLS(sob, Mfull) : null;
    zonas[zname] = zf;
  }

  const catsTodas = zonas.TODAS?.cat_saidi || {};
  const cats_order = Object.keys(catsTodas).sort((a, b) => {
    const sa = (catsTodas[a] || []).reduce((x, y) => x + (+y || 0), 0);
    const sb = (catsTodas[b] || []).reduce((x, y) => x + (+y || 0), 0);
    return sb - sa;
  });

  // Re-agrega el aporte programado/no-programado sumando SOLO las causas
  // incluidas por el filtro CAUSA2. Si el dataset no trae progCat (baseline
  // o ruta vieja), conserva el prog original intacto (vía spread).
  const prog = dataset.progCat
    ? reagregarProgPorCausa(dataset.progCat, incluir)
    : dataset.prog;

  return {
    ...dataset,
    zonas,
    cats_order,
    prog,
    proj_global: zonas.TODAS?.proj || null,
  };
}

// Suma el desglose prog/no-prog (progCat[zonaKey][causa]) sobre las causas
// que cumplen el predicado `incluir`, devolviendo el shape prog estándar
// (prog[zonaKey] = { programado:{saidi,saifi}, no_programado:{...} }).
function reagregarProgPorCausa(progCat, incluir) {
  const out = {};
  for (const [zk, porCausa] of Object.entries(progCat || {})) {
    let N = 0;
    for (const pc of Object.values(porCausa)) {
      N = Math.max(N, (pc?.programado?.saidi || []).length);
    }
    const acc = nuevaProg(N);
    for (const [causa, pc] of Object.entries(porCausa)) {
      if (!incluir(causa)) continue;
      for (const pk of ['programado', 'no_programado']) {
        for (const met of ['saidi', 'saifi']) {
          const src = pc?.[pk]?.[met] || [];
          for (let i = 0; i < src.length; i++) acc[pk][met][i] += (+src[i] || 0);
        }
      }
    }
    out[zk] = acc;
  }
  return out;
}

// Normaliza el texto de zona a una de las claves canónicas o '' si no
// corresponde a ninguna (en cuyo caso solo cuenta para TODAS).
function normalizarZona(raw) {
  const n = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (n.includes('BOLIVAR')) return 'BOLIVAR';
  if (n.includes('ORIENTE')) return 'ORIENTE';
  if (n.includes('OCCIDENTE')) return 'OCCIDENTE';
  return '';
}

// Normaliza el valor de una celda de filtro: sin tildes, MAYÚSCULAS,
// espacios colapsados, recortado. Así "Transporte", "TRANSPORTE " y
// "transporte" comparan igual contra el valor esperado.
function normalizarFiltro(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// Catálogo de filtros opcionales a nivel de fila (hoja DATOS real). Cada
// uno se aplica SOLO si su columna se resuelve (override explícito en
// `opts` o encabezado detectado). Si la columna no existe (hojas viejas,
// tests), el filtro queda inactivo y no descarta nada.
//   · CLASIFICACION_CREG_063 (BC) ∈ {NO PROGRAMADA NO EXCLUIDA, PROGRAMADA NO EXCLUIDA}
//   · SUI = SI
//   · AREA_GESTION_MACRO (BD) = TRANSPORTE
//   · MIN (BE) = INC
const FILTROS_FILA_SPEC = [
  { key: 'clas_creg',  regex: /clasificacion.*creg|clasificacion.*063/, valores: ['NO PROGRAMADA NO EXCLUIDA', 'PROGRAMADA NO EXCLUIDA'] },
  { key: 'sui',        regex: /^sui$/,                                   valores: ['SI'] },
  { key: 'area_macro', regex: /area.*gestion.*macro/,                   valores: ['TRANSPORTE'] },
  { key: 'min',        regex: /^min$/,                                  valores: ['INC'] },
];

// Resuelve qué filtros de fila están activos: override explícito en opts
// (índice numérico) o detección por encabezado. Devuelve [{key, col,
// valores:Set}] solo para los que tienen columna resuelta.
function resolverFiltrosFila(rows, opts) {
  const activos = [];
  for (const spec of FILTROS_FILA_SPEC) {
    let col = -1;
    if (typeof opts[spec.key] === 'number' && opts[spec.key] >= 0) {
      col = opts[spec.key];
    } else if (opts[spec.key] !== -1) {
      col = detectarColumnaPorHeader(rows, spec.regex);
    }
    if (col >= 0) {
      activos.push({ key: spec.key, col, valores: new Set(spec.valores.map(normalizarFiltro)) });
    }
  }
  return activos;
}

// Shape de aporte programado / no-programado por zona × mes-calendario.
// prog[zonaKey] = { programado: {saidi[12],saifi[12]}, no_programado: {...} }.
// La clasificación sale de CLASIFICACION_CREG_063 (BC): un valor que
// empieza por "PROGRAMADA" cuenta como programado; "NO PROGRAMADA" como
// no programado. Solo se puebla si la columna está resuelta.
function nuevaProg(N) {
  return {
    programado:    { saidi: new Array(N).fill(0), saifi: new Array(N).fill(0) },
    no_programado: { saidi: new Array(N).fill(0), saifi: new Array(N).fill(0) },
  };
}

// ── Agregador principal ──────────────────────────────────────
// `rows` es un array-of-arrays (XLSX.utils.sheet_to_json header:1) de la
// hoja DATOS, incluyendo la fila de encabezado. `opts` permite override
// de columnas; las que falten usan COLS_DATOS_DEFAULT, y `fecha:-1`
// dispara la autodetección.
//
// Devuelve { dataset, reporte } donde dataset tiene el shape del
// baseline y reporte trae trazabilidad (columna de fecha detectada,
// filas procesadas/descartadas, meses presentes, nº de causas).
export function agregarDatosCrudos(rows, opts = {}) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error('Hoja DATOS vacía o sin registros (se esperaba encabezado + filas).');
  }

  const cIdx = {
    causa:   opts.causa   != null ? opts.causa   : COLS_DATOS_DEFAULT.causa,
    periodo: opts.periodo != null ? opts.periodo : COLS_DATOS_DEFAULT.periodo,
    saifi:   opts.saifi   != null ? opts.saifi   : COLS_DATOS_DEFAULT.saifi,
    saidi:   opts.saidi   != null ? opts.saidi   : COLS_DATOS_DEFAULT.saidi,
    dia:     opts.dia     != null ? opts.dia     : COLS_DATOS_DEFAULT.dia,
    zona:    opts.zona    != null ? opts.zona    : COLS_DATOS_DEFAULT.zona,
    subest:  opts.subest  != null ? opts.subest  : COLS_DATOS_DEFAULT.subest,
    fecha:   opts.fecha   != null ? opts.fecha   : COLS_DATOS_DEFAULT.fecha,
  };

  // NB_SUBESTACION (AW por defecto) · fallback robusto por nombre de
  // encabezado. Si el llamador no fijó la columna explícitamente y la
  // posición fija AW no trae el encabezado NB_SUBESTACION, escaneamos las
  // primeras filas buscando /NB[_ ]?SUBEST/ y usamos esa columna. Así el
  // ranking puebla aunque el Excel venga reordenado. Sin match, queda AW.
  if (opts.subest == null) {
    const detectada = detectarColumnaPorHeader(rows, /nb[_ ]?subest/);
    if (detectada >= 0) cIdx.subest = detectada;
  }

  // Filtros opcionales a nivel de fila (CLASIFICACION_CREG_063, SUI,
  // AREA_GESTION_MACRO, MIN). Solo recortan la extracción si su columna
  // se resuelve por encabezado u override; si faltan, quedan inactivos.
  const filtrosFila = resolverFiltrosFila(rows, opts);

  // Columna de CLASIFICACION_CREG_063 para el desglose programado /
  // no-programado, independiente de que el filtro esté activo.
  const colClas = (() => {
    const f = filtrosFila.find(x => x.key === 'clas_creg');
    if (f) return f.col;
    if (typeof opts.clas_creg === 'number' && opts.clas_creg >= 0) return opts.clas_creg;
    return detectarColumnaPorHeader(rows, /clasificacion.*creg|clasificacion.*063/);
  })();

  // El mes sale de PERIODO (AC) y el día de DIA (BB). Si esas columnas
  // no resuelven, caemos a una columna de fecha única autodetectada.
  // Solo intentamos autodetectar fecha si PERIODO no es utilizable, para
  // no fallar cuando la hoja sí trae PERIODO/DIA pero ninguna fecha única.
  const ancho = rows.reduce((w, row) => Math.max(w, (row || []).length), 0);
  const periodoUsable = cIdx.periodo >= 0 && cIdx.periodo < ancho;
  if (cIdx.fecha == null || cIdx.fecha < 0) {
    cIdx.fecha = detectarColumnaFecha(rows);
  }
  if (cIdx.fecha < 0 && !periodoUsable) {
    throw new Error(
      'No se pudo obtener el mes en la hoja DATOS · ' +
      'se esperaba la columna PERIODO (AC) o una columna de fecha ' +
      '(dd/mm/yyyy, yyyy-mm-dd).'
    );
  }

  const N = MESES_CANON.length;  // acumulamos a 12 meses; recortamos al final
  const zonas = { TODAS: nuevaZona() };
  // Pre-creamos las 3 zonas operativas para que el selector las muestre.
  for (const zk of ['BOLIVAR', 'ORIENTE', 'OCCIDENTE']) zonas[zk] = nuevaZona();

  // Detalle diario por zona × mes-calendario (0–11) × día (1–31).
  // dias[zonaKey][mesIdx] = { saidi: number[31], saifi: number[31] }.
  // Solo lo produce este path crudo (la hoja DATOS trae la fecha
  // exacta del evento); baseline/CSV/pre-agregado no lo tienen.
  const dias = { TODAS: {}, BOLIVAR: {}, ORIENTE: {}, OCCIDENTE: {} };
  function diaSerie(zk, met, mIdx) {
    const z = dias[zk];
    if (!z[mIdx]) z[mIdx] = { saidi: new Array(31).fill(0), saifi: new Array(31).fill(0) };
    return z[mIdx][met];
  }

  // Aporte por subestación (NB_SUBESTACION · AW) por zona × mes-calendario.
  // subests[zonaKey][nombreSubest] = { saidi: number[12], saifi: number[12] }
  // (indexado por mes-calendario 0–11). Alimenta el ranking TOP 10
  // filtrable por mes y zona. Solo lo produce este path crudo.
  const subests = { TODAS: {}, BOLIVAR: {}, ORIENTE: {}, OCCIDENTE: {} };
  function subSerie(zk, sub, met) {
    const z = subests[zk];
    if (!z[sub]) z[sub] = { saidi: new Array(N).fill(0), saifi: new Array(N).fill(0) };
    return z[sub][met];
  }

  // Aporte programado / no-programado por zona × mes-calendario (0–11).
  // Solo se puebla si CLASIFICACION_CREG_063 (colClas) está resuelta.
  // Alimenta la gráfica programado vs no-programado con línea META.
  const prog = {
    TODAS:     nuevaProg(N),
    BOLIVAR:   nuevaProg(N),
    ORIENTE:   nuevaProg(N),
    OCCIDENTE: nuevaProg(N),
  };

  // Mismo desglose programado/no-programado pero abierto POR CAUSA, para
  // que el filtro CAUSA2 pueda re-agregar el aporte prog/no-prog sumando
  // solo las causas incluidas. progCat[zonaKey][causa] = nuevaProg(N).
  const progCat = { TODAS: {}, BOLIVAR: {}, ORIENTE: {}, OCCIDENTE: {} };
  function progCatSerie(zk, causa) {
    const z = progCat[zk];
    if (!z[causa]) z[causa] = nuevaProg(N);
    return z[causa];
  }

  const mesesPresentes = new Set();
  let procesadas = 0;
  let descartadasMes = 0;
  let descartadasCausa = 0;
  let descartadasFiltro = 0;
  let descartadasFiltroFila = 0;

  // Asegura que una zona tenga la categoría inicializada a 12 ceros.
  function catSerie(z, met, cat) {
    const key = `cat_${met}`;
    if (!z[key][cat]) z[key][cat] = new Array(N).fill(0);
    return z[key][cat];
  }

  const tieneFecha = cIdx.fecha >= 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    // Mes: primero PERIODO (AC); si no resuelve, la fecha única.
    let mIdx = cIdx.periodo >= 0 ? mesDesdePeriodo(row[cIdx.periodo]) : null;
    if (mIdx == null && tieneFecha) mIdx = mesDesdeValor(row[cIdx.fecha]);
    if (mIdx == null) { descartadasMes++; continue; }

    const causa = String(row[cIdx.causa] ?? '').trim();
    if (!causa) { descartadasCausa++; continue; }

    // Filtros opcionales a nivel de fila (CLASIFICACION_CREG_063, SUI,
    // AREA_GESTION_MACRO, MIN). El evento solo entra si cumple TODOS los
    // filtros activos. Inactivos cuando su columna no se resolvió.
    let descartarFila = false;
    for (const f of filtrosFila) {
      if (!f.valores.has(normalizarFiltro(row[f.col]))) { descartarFila = true; break; }
    }
    if (descartarFila) { descartadasFiltroFila++; continue; }

    // Único criterio de extracción: solo las 13 causas canónicas.
    // Cualquier otra (Lluvias, Mantenimiento, Red de BT, …) se descarta.
    if (!esCausaCanonica(causa)) { descartadasFiltro++; continue; }

    const saidi = +row[cIdx.saidi] || 0;
    const saifi = +row[cIdx.saifi] || 0;

    // Programado / no-programado desde CLASIFICACION_CREG_063: un valor
    // que empieza por "NO PROGRAMADA" es no-programado; por "PROGRAMADA",
    // programado. Cualquier otro (o columna ausente) no se desglosa.
    const clasN = colClas >= 0 ? normalizarFiltro(row[colClas]) : '';
    const progKey = clasN.startsWith('NO PROGRAMADA') ? 'no_programado'
      : (clasN.startsWith('PROGRAMADA') ? 'programado' : null);

    mesesPresentes.add(mIdx);
    // Día: primero DIA (BB); si no resuelve, lo extrae de la fecha única.
    let dia = cIdx.dia >= 0 ? diaDesdeColumna(row[cIdx.dia]) : null;
    if (dia == null && tieneFecha) dia = diaDesdeValor(row[cIdx.fecha]);  // 1–31 o null
    const zonaKey = normalizarZona(row[cIdx.zona]);
    const zonaKeys = zonaKey ? ['TODAS', zonaKey] : ['TODAS'];
    const sub = cIdx.subest >= 0 ? String(row[cIdx.subest] ?? '').trim() : '';
    for (const zk of zonaKeys) {
      const z = zonas[zk];
      catSerie(z, 'saidi', causa)[mIdx] += saidi;
      catSerie(z, 'saifi', causa)[mIdx] += saifi;
      if (dia != null) {
        diaSerie(zk, 'saidi', mIdx)[dia - 1] += saidi;
        diaSerie(zk, 'saifi', mIdx)[dia - 1] += saifi;
      }
      if (sub) {
        subSerie(zk, sub, 'saidi')[mIdx] += saidi;
        subSerie(zk, sub, 'saifi')[mIdx] += saifi;
      }
      if (progKey) {
        prog[zk][progKey].saidi[mIdx] += saidi;
        prog[zk][progKey].saifi[mIdx] += saifi;
        const pc = progCatSerie(zk, causa);
        pc[progKey].saidi[mIdx] += saidi;
        pc[progKey].saifi[mIdx] += saifi;
      }
    }
    procesadas++;
  }

  if (!procesadas) {
    throw new Error(
      'La hoja DATOS no produjo registros de las 13 causas filtradas · ' +
      `descartadas: ${descartadasFiltro} por causa fuera del catálogo, ` +
      `${descartadasMes} sin mes, ${descartadasCausa} sin causa · ` +
      `revisa el mapeo de columnas (causa=${cIdx.causa}, periodo=${cIdx.periodo}, ` +
      `saidi=${cIdx.saidi}, saifi=${cIdx.saifi}, dia=${cIdx.dia}, ` +
      `zona=${cIdx.zona}, fecha=${cIdx.fecha}).`
    );
  }

  // Recortamos las series al rango de meses realmente presentes
  // [min..max] para que el eje no muestre meses futuros vacíos.
  const mesesIdx = [...mesesPresentes].sort((a, b) => a - b);
  const minMes = mesesIdx[0];
  const maxMes = mesesIdx[mesesIdx.length - 1];
  const span = maxMes - minMes + 1;
  const meses = MESES_CANON.slice(minMes, maxMes + 1);

  function recortar(serie) {
    return (serie || new Array(N).fill(0)).slice(minMes, maxMes + 1);
  }

  for (const z of Object.values(zonas)) {
    for (const met of ['saidi', 'saifi']) {
      const cats = z[`cat_${met}`];
      for (const cat of Object.keys(cats)) cats[cat] = recortar(cats[cat]);
    }
  }

  // Recortar las series programado/no-programado al mismo rango [min..max].
  for (const zk of Object.keys(prog)) {
    for (const pk of ['programado', 'no_programado']) {
      prog[zk][pk].saidi = recortar(prog[zk][pk].saidi);
      prog[zk][pk].saifi = recortar(prog[zk][pk].saifi);
    }
  }

  // Recortar el desglose prog/no-prog por causa al mismo rango.
  for (const zk of Object.keys(progCat)) {
    for (const causa of Object.keys(progCat[zk])) {
      for (const pk of ['programado', 'no_programado']) {
        progCat[zk][causa][pk].saidi = recortar(progCat[zk][causa][pk].saidi);
        progCat[zk][causa][pk].saifi = recortar(progCat[zk][causa][pk].saifi);
      }
    }
  }

  // Derivar los 3 grupos + total por zona con el clasificador canónico.
  for (const z of Object.values(zonas)) derivarGruposDesdeCategorias(z, span);

  // Proyección OLS por zona sobre SAIDI grupo Sobrecarga/Deslastre,
  // a 12 meses (Ene–Dic) — mismo criterio que el CSV.
  const meses_full = MESES_CANON.slice();
  for (const z of Object.values(zonas)) {
    const serie = z.grp_saidi['Sobrecarga/Deslastre'] || [];
    z.proj = serie.length >= 2 ? calcularProyeccionOLS(serie, meses_full.length) : null;
  }

  // cats_order = categorías presentes en TODAS, ordenadas por aporte
  // SAIDI descendente (las causas con más impacto primero).
  const catsTodas = zonas.TODAS.cat_saidi || {};
  const cats_order = Object.keys(catsTodas).sort((a, b) => {
    const sa = (catsTodas[a] || []).reduce((x, y) => x + (+y || 0), 0);
    const sb = (catsTodas[b] || []).reduce((x, y) => x + (+y || 0), 0);
    return sb - sa;
  });

  // Índices de calendario (0–11) paralelos a `meses` para mapear el
  // selector de mes al detalle diario, que está keyed por mes-calendario.
  const mesesIdxFull = meses.map((_, i) => minMes + i);

  const dataset = {
    meses,
    meses_full,
    mesesIdx: mesesIdxFull,
    zonas,
    cats_order,
    dias,
    subests,
    prog,
    progCat,
    kpi: {},
    proj_global: zonas.TODAS.proj || null,
  };

  const reporte = {
    columnaFecha: cIdx.fecha,
    columnas: cIdx,
    procesadas,
    descartadasMes,
    descartadasCausa,
    descartadasFiltro,
    descartadasFiltroFila,
    meses,
    causas: cats_order.length,
    subestaciones: Object.keys(subests.TODAS).length,
  };

  return { dataset, reporte };
}

// ── Agregador · hoja META (tabla plana prog/no-prog por PERIODO×ZONA) ──
// La hoja META de "Data de Analisis.xlsx" trae una fila por
// PERIODO (YYYYMM) × ZONA × CLASIFICACION_CREG_063 con META SAIDI_E y
// META SAIFI_E. Es la fuente autoritativa del aporte programado /
// no-programado: la hoja DASHBOARD es solo su pivote visual. Se parsea
// como vía rápida para poblar `dataset.prog` SIN tocar la hoja DATOS
// (54 MB, impracticable en navegador). Deriva además los totales por
// zona (programado + no-programado) para que serie/KPI no queden vacías;
// las categorías y el cruce CAUSA2 quedan vacíos (la META no los trae).
//
// `rows` es array-of-arrays (XLSX header:1) incluyendo el encabezado.
//
// Builder compartido · construye el desglose prog/no-prog a 12 meses
// (índice absoluto Ene=0 … Dic=11) por zona desde la tabla plana META.
// Lo usan `agregarMetaProg` (fallback META-only) y `extraerMetaObjetivo`
// (overlay sobre el dataset DATOS). Devuelve arrays a 12 posiciones sin
// recortar y el set de meses con al menos una fila válida.
function _construirProgMeta(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('Hoja META vacía o sin filas de datos');
  }
  const N = MESES_CANON.length;

  // Detección de columnas por encabezado (tolerante a orden y acentos).
  const head = (rows[0] || []).map(h => String(h || '').trim().toUpperCase());
  const findCol = (...pats) => head.findIndex(h => pats.some(p => h.includes(p)));
  const cPeriodo = findCol('PERIODO');
  const cZona    = findCol('ZONA');
  const cClas    = findCol('CLASIFIC');
  const cSaidi   = findCol('SAIDI');
  const cSaifi   = findCol('SAIFI');
  if (cPeriodo < 0 || cZona < 0 || cClas < 0 || (cSaidi < 0 && cSaifi < 0)) {
    throw new Error(
      'Hoja META · faltan columnas PERIODO / ZONA / CLASIFICACION / SAIDI_E / SAIFI_E'
    );
  }

  const prog = {
    TODAS:     nuevaProg(N),
    BOLIVAR:   nuevaProg(N),
    ORIENTE:   nuevaProg(N),
    OCCIDENTE: nuevaProg(N),
  };
  const ZONAS_VALIDAS = new Set(['BOLIVAR', 'ORIENTE', 'OCCIDENTE']);
  const mesesPresentes = new Set();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const per = String(row[cPeriodo] == null ? '' : row[cPeriodo]).trim();
    const mm = /^(\d{4})(\d{2})$/.exec(per);
    if (!mm) continue;
    const mIdx = (+mm[2]) - 1;
    if (mIdx < 0 || mIdx > 11) continue;

    const zk = String(row[cZona] || '').trim().toUpperCase();
    if (!ZONAS_VALIDAS.has(zk)) continue;

    // "NO PROGRAMADA…" → no_programado; "PROGRAMADA(S)…" → programado.
    const clas = String(row[cClas] || '').trim().toUpperCase();
    const progKey = clas.startsWith('NO PROGRAMADA') ? 'no_programado'
                  : clas.startsWith('PROGRAMADA')    ? 'programado'
                  : null;
    if (!progKey) continue;

    const saidi = cSaidi >= 0 ? (+row[cSaidi] || 0) : 0;
    const saifi = cSaifi >= 0 ? (+row[cSaifi] || 0) : 0;
    for (const z of [zk, 'TODAS']) {
      prog[z][progKey].saidi[mIdx] += saidi;
      prog[z][progKey].saifi[mIdx] += saifi;
    }
    mesesPresentes.add(mIdx);
  }

  if (!mesesPresentes.size) {
    throw new Error(
      'Hoja META · ninguna fila válida (se esperaba PERIODO YYYYMM + ZONA + CLASIFICACION_CREG_063)'
    );
  }
  return { prog, mesesPresentes };
}

export function agregarMetaProg(rows) {
  const { prog, mesesPresentes } = _construirProgMeta(rows);

  // Recorte al rango de meses con datos (primer..último mes presente).
  const minMes = Math.min(...mesesPresentes);
  const maxMes = Math.max(...mesesPresentes);
  const meses = MESES_CANON.slice(minMes, maxMes + 1);
  const mesesIdx = [];
  for (let i = minMes; i <= maxMes; i++) mesesIdx.push(i);

  const recortar = (arr) => arr.slice(minMes, maxMes + 1);
  for (const zk of Object.keys(prog)) {
    for (const pk of ['programado', 'no_programado']) {
      prog[zk][pk].saidi = recortar(prog[zk][pk].saidi);
      prog[zk][pk].saifi = recortar(prog[zk][pk].saifi);
    }
  }

  // Totales por zona = programado + no-programado por mes. Las categorías
  // quedan vacías (la META no las desglosa); serie/KPI muestran el total.
  const zonas = {};
  for (const zk of Object.keys(prog)) {
    const z = nuevaZona();
    const p = prog[zk];
    z.total_saidi = p.programado.saidi.map((v, i) => v + p.no_programado.saidi[i]);
    z.total_saifi = p.programado.saifi.map((v, i) => v + p.no_programado.saifi[i]);
    zonas[zk] = z;
  }

  return {
    meses,
    meses_full: MESES_CANON.slice(),
    mesesIdx,
    zonas,
    cats_order: [],
    prog,
    kpi: {},
    proj_global: null,
  };
}

// ── Overlay META · objetivo por mes para el segmento prog/no-prog ──
// Extrae de la hoja META el objetivo (META SAIDI_E / META SAIFI_E) a 12
// meses absolutos por zona, SIN recortar. Es la fuente de la línea META
// que se superpone sobre las barras causadas (desde DATOS) para que el
// director vea "el match entre la meta y lo causado hasta la fecha".
// Estructura: `{ ZONA: { programado:{saidi[12],saifi[12]},
//   no_programado:{saidi[12],saifi[12]} } }` + `mesesIdx` (meses con dato).
export function extraerMetaObjetivo(rows) {
  const { prog, mesesPresentes } = _construirProgMeta(rows);
  const mesesIdx = [...mesesPresentes].sort((a, b) => a - b);
  return { metaObjetivo: prog, mesesIdx };
}

// Adjunta el overlay META a un dataset ya agregado desde DATOS, alineando
// el objetivo a 12 meses absolutos a las posiciones de `dataset.meses`
// (que pueden estar recortadas). Tolera fallos de parseo de la META: si
// la hoja no se puede leer, deja el dataset intacto y registra el motivo.
export function adjuntarMetaObjetivo(dataset, metaRows) {
  if (!dataset || !Array.isArray(metaRows)) return dataset;
  let metaObjetivo;
  try {
    ({ metaObjetivo } = extraerMetaObjetivo(metaRows));
  } catch (err) {
    dataset.metaObjetivoMotivo = String(err && err.message || err);
    return dataset;
  }
  // Índices absolutos paralelos a dataset.meses (Ene=0 … Dic=11).
  const idxAbs = Array.isArray(dataset.mesesIdx) && dataset.mesesIdx.length
    ? dataset.mesesIdx
    : (dataset.meses || []).map((mm) => MESES_CANON.indexOf(mm));

  const alinear = (arr12) => idxAbs.map((abs) => (abs >= 0 ? (+arr12[abs] || 0) : 0));
  const overlay = {};
  for (const zk of Object.keys(metaObjetivo)) {
    const p = metaObjetivo[zk];
    overlay[zk] = {
      programado:    { saidi: alinear(p.programado.saidi),    saifi: alinear(p.programado.saifi) },
      no_programado: { saidi: alinear(p.no_programado.saidi), saifi: alinear(p.no_programado.saifi) },
    };
  }
  dataset.metaObjetivo = overlay;
  return dataset;
}
