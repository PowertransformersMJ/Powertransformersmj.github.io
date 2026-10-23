// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — PLACA CARACTERÍSTICA de cada transformador · reglas puras (TODO-69)
// ──────────────────────────────────────────────────────────────
// La placa (foto + lo que se leyó de ella) vive APARTE del inventario: `placas_caracteristicas/{idTransformador}`
// (meta y datos) + `partes/{0..2}` (la foto en trozos ≤ 900 KB, el método de Fichas `fichas_adjunto.js`;
// Storage no entrega descargas, `99 §100`). Nada de aquí cambia un dato oficial: las diferencias se MUESTRAN
// y el Ingeniero decide cada corrección (ampacidad y carga juntas, `53 §3`).
// Dominio puro: sin DOM ni Firebase. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

export const COLECCION = 'placas_caracteristicas';
export const TOPE_PARTE = 900 * 1024;
export const PARTES_MAX = 3;
const R3 = Math.sqrt(3);
const DEV = { P: 'Primario', S: 'Secundario', T: 'Terciario' };
const CAMPO_KV = { P: 'tension_primaria_kv', S: 'tension_secundaria_kv', T: 'tension_terciaria_kv' };
const CAMPO_A = { P: 'corriente_nominal_primaria_a', S: 'corriente_nominal_secundaria_a', T: 'corriente_nominal_terciaria_a' };

const pos = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : null; };
const cerca = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));
const normSerie = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Números de un texto de placa con coma o punto decimal y espacio o punto de miles («13 800», «34,5», «1.255,1»). */
export function numeros(txt) {
  const s = String(txt || '').replace(/[  ]/g, ' ').replace(/(\d) (?=\d{3}\b)/g, '$1');
  const out = [];
  for (const m of s.matchAll(/\d+(?:[.,]\d+)*/g)) {
    let g = m[0];
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(g)) g = g.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+$/.test(g) && !/^\d+,\d{1,2}$/.test(g)) g = g.replace(/,/g, '');
    else g = g.replace(',', '.');
    const v = Number(g);
    if (Number.isFinite(v)) out.push({ v, i: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/** Tensiones en kV que nombra un texto de placa («34,5 kV», «13 800 V», «66/13,8 kV», «115.5-93.5 kV»). */
export function tensionesKv(txt) {
  const s = String(txt || '');
  const out = [];
  for (const n of numeros(s)) {
    const cola = s.slice(n.fin, n.fin + 6).replace(/\s+/g, '').toLowerCase();
    if (/^kv/.test(cola) || /^[/–-]\d/.test(cola) && /kv/.test(s.slice(n.fin, n.fin + 14).toLowerCase())) out.push(n.v);
    else if (/^v\b|^v$|^v[^a-z]/.test(cola) || n.v >= 1000) out.push(n.v / 1000);
    else if (n.v > 0.2 && n.v <= 500 && /kv/i.test(s)) out.push(n.v);
  }
  return out.filter((v) => v > 0.1 && v <= 800);
}

/** Corrientes en amperios impresas en un texto («627,6/836,7 A», «AT 251,0 A»). */
export function corrientesA(txt) {
  const s = String(txt || '');
  const out = [];
  for (const m of s.matchAll(/(\d[\d.,\s/]*?)\s*A\b/g)) for (const n of numeros(m[1])) if (n.v > 0) out.push(n.v);
  return out;
}

/** Potencia mayor de la placa (kVA) entre sus etapas. */
export function topePlacaKva(datos) {
  const v = Object.values((datos && datos.etapas_kva) || {}).map(pos).filter(Boolean);
  return v.length ? Math.max(...v) : null;
}

/**
 * Diferencias entre la placa leída y lo que tiene la plataforma (solo se muestran).
 * @returns {Array<{campo:string, placa:string, plataforma:string, nota:string, grave:boolean}>}
 */
export function diferencias(placa, tx) {
  const d = (placa && placa.datos) || {};
  const e = (tx && tx.electrico) || {}; const pl = (tx && tx.placa) || {};
  const out = [];
  const add = (campo, vPlaca, vPlat, nota, grave = false) => out.push({ campo, placa: String(vPlaca), plataforma: String(vPlat), nota, grave });
  // Serie
  const sP = normSerie(d.serie); const sT = normSerie(pl.serial || tx && tx.serial);
  if (sP && sT && sP !== sT && !sP.includes(sT) && !sT.includes(sP)) add('Serie', d.serie, pl.serial || tx.serial, 'la foto podría ser de otro equipo: confirmar', true);
  // Potencia
  const tope = topePlacaKva(d); const kva = pos(pl.potencia_kva);
  if (tope && kva && !cerca(tope, kva, 0.01)) {
    const onan = pos((d.etapas_kva || {}).ONAN);
    if (onan && cerca(onan, kva, 0.01)) add('Potencia', tope + ' kVA (mayor etapa)', kva + ' kVA', 'la plataforma tiene la potencia ONAN');
    else add('Potencia', tope + ' kVA', kva + ' kVA', 'no coincide', true);
  }
  // Año
  if (pos(d.anio) && pos((tx && tx.fabricacion && tx.fabricacion.ano_fabricacion) || (tx && tx.ano_fabricacion)) && Number(d.anio) !== Number((tx.fabricacion && tx.fabricacion.ano_fabricacion) || tx.ano_fabricacion)) {
    add('Año de fabricación', d.anio, (tx.fabricacion && tx.fabricacion.ano_fabricacion) || tx.ano_fabricacion, 'no coincide');
  }
  // Fases: solo si la plataforma dice OTRA cosa (que no lo tenga no es una diferencia: la tabla muestra el de la placa).
  if ((d.fases === 1 || d.fases === 3) && (e.fases === 1 || e.fases === 3) && e.fases !== d.fases) add('Fases', d.fases, e.fases, 'no coincide', true);
  // Tensiones por devanado
  const t = d.tension || {};
  for (const k of ['P', 'S', 'T']) {
    const kv = pos(e[CAMPO_KV[k]]); const cands = tensionesKv(t[k]);
    if (!kv || !cands.length) continue;
    if (!cands.some((c) => cerca(c, kv, 0.02) || cerca(c * R3, kv, 0.02))) add('Tensión ' + DEV[k].toLowerCase(), t[k], kv + ' kV', 'no coincide con la placa', true);
  }
  // Ampacidades: cuadran si coinciden con una corriente IMPRESA en la placa o con la que da su potencia
  // (mayor etapa u ONAN) a la tensión del devanado. Conservador: en los de tres devanados el secundario y el
  // terciario tienen su propia potencia y solo se avisa la errata ×10.
  const impresas = corrientesA([t.P, t.S, t.T, d.potencias_texto, d.notas].filter(Boolean).join(' '));
  const onan = pos((d.etapas_kva || {}).ONAN);
  const fases = d.fases === 1 || e.fases === 1 ? 1 : 3;
  const tres = !!pos(e.tension_terciaria_kv);
  for (const k of ['P', 'S', 'T']) {
    const A = pos(e[CAMPO_A[k]]); const kv = pos(e[CAMPO_KV[k]]);
    if (!A || !kv) continue;
    const esperadas = [tope, onan].filter(Boolean).flatMap((kVA) => (fases === 1 ? [kVA / kv, kVA / (kv / R3)] : [kVA / (R3 * kv)]));
    const cand = [...impresas, ...esperadas];
    if (!cand.length || cand.some((x) => cerca(x, A, 0.02))) continue;
    const x10 = cand.find((x) => cerca(x * 10, A, 0.02) || cerca(x / 10, A, 0.02));
    if (x10) add('Ampacidad ' + DEV[k].toLowerCase(), x10.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' A', A.toLocaleString('es-CO') + ' A', 'posible errata ×10: corregir ampacidad y carga juntas', true);
    else if (k === 'P' || (!tres && k === 'S')) {
      add('Ampacidad ' + DEV[k].toLowerCase(), [...new Set(cand.map((x) => x.toLocaleString('es-CO', { maximumFractionDigits: 1 })))].join(' · ') + ' A', A.toLocaleString('es-CO') + ' A',
        'no cuadra con la placa: la ampacidad parece de otra potencia', true);
    }
  }
  return out;
}

/** Filas para mostrar, agrupadas: [{titulo, filas:[[etiqueta, valor]]}] (solo lo que la placa trae). */
export function seccionesPlaca(placa) {
  const d = (placa && placa.datos) || {};
  const f = (v, u = '') => (v == null || v === '' ? null : (typeof v === 'number' ? v.toLocaleString('es-CO') : String(v)) + u);
  const etapas = Object.entries(d.etapas_kva || {}).map(([k, v]) => k + ' ' + Number(v).toLocaleString('es-CO') + ' kVA').join(' · ');
  const secc = [
    { titulo: 'Identificación', filas: [['Fabricante', f(d.fabricante)], ['Serie', f(d.serie)], ['Año', d.anio ? String(d.anio) : null], ['Norma', f(d.norma)], ['Fases', f(d.fases)]] },
    { titulo: 'Potencia y refrigeración', filas: [['Etapas', etapas || null], ['Texto de la placa', f(d.potencias_texto)], ['Ventiladores', f(d.ventiladores)]] },
    { titulo: 'Tensiones', filas: [['Primario', f(d.tension && d.tension.P)], ['Secundario', f(d.tension && d.tension.S)], ['Terciario', f(d.tension && d.tension.T)]] },
    { titulo: 'Impedancia y pérdidas', filas: [['Impedancia', d.impedancia_pct != null ? f(d.impedancia_pct, ' %') + (d.impedancia_base_kva ? ' (base ' + f(d.impedancia_base_kva, ' kVA') + ')' : '') : null],
      ['Pérdidas en carga', d.perdidas_carga_w != null ? f(d.perdidas_carga_w, ' W') + (d.perdidas_base_kva ? ' a ' + f(d.perdidas_base_kva, ' kVA') : '') + (d.perdidas_temp_c ? ', ' + f(d.perdidas_temp_c, ' °C') : '') : null],
      ['Pérdidas en vacío', f(d.perdidas_vacio_w, ' W')]] },
    { titulo: 'Temperaturas y sitio', filas: [['Elevación del devanado', f(d.elevacion_devanado_c, ' °C')], ['Elevación del aceite', f(d.elevacion_aceite_c, ' °C')],
      ['Ambiente máximo', f(d.ambiente_max_c, ' °C')], ['Altitud', f(d.altitud_m, ' m')]] },
    { titulo: 'Masas', filas: [['Masa total', f(d.masa_total_kg, ' kg')], ['Aceite', f(d.aceite_l, ' L')]] }
  ];
  return secc.map((s) => ({ titulo: s.titulo, filas: s.filas.filter(([, v]) => v != null) })).filter((s) => s.filas.length);
}

/** Une las partes de la foto. */
export function unir(partes) {
  const n = partes.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n); let k = 0;
  for (const p of partes) { out.set(p, k); k += p.length; }
  return out;
}
