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

/**
 * Números de un texto de placa con coma o punto decimal y espacio o punto de miles («13 800», «34,5», «1.255,1»).
 * Un espacio solo une miles si el grupo anterior NO va pegado a un rótulo («pos 6 219» no es 6219).
 */
export function numeros(txt) {
  const s0 = String(txt || '').replace(/[  ]/g, ' ');
  const s = s0.replace(/(\d{1,3}) (\d{3})(?![\d,.]?\d)/g, (m, a, b2, off, str) => {
    const prev = str[off - 1] || '';
    if (/[\d.,]/.test(prev)) return m;                                               // no es un entero suelto
    if (/[A-Za-z][\s:]?$/.test(str.slice(Math.max(0, off - 3), off))) return m;     // «pos 6 219»: rótulo pegado
    return a + b2;
  });
  const out = [];
  for (const m of s.matchAll(/\d+(?:[.,]\d+)*/g)) {
    let g = m[0];
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(g)) g = g.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+$/.test(g) && !/^\d+,\d{1,2}$/.test(g)) g = g.replace(/,/g, '');
    else g = g.replace(',', '.');
    const v = Number(g);
    if (Number.isFinite(v)) out.push({ v, i: m.index, fin: m.index + m[0].length, s });
  }
  return out;
}

const RANGO_PAL = /(pos|posici|conmut|oltc|rango|tap|toma|±|\+\/-)/i;
/**
 * Tensiones de un texto de placa: la NOMINAL (número con unidad V/kV fuera de paréntesis y antes de hablar del
 * cambiador; «13,8/7,96 kV» da las dos) y el RANGO del cambiador (extremos con unidad y «±n×p %»).
 * @returns {{nominal:number[], min:number|null, max:number|null}}
 */
export function tensionesPlaca(txt) {
  const s = String(txt || '');
  const corte = s.search(RANGO_PAL);
  const cabeza = (corte >= 0 ? s.slice(0, corte) : s).replace(/\(.*?\)/g, ' ');
  const conUnidad = (t, rango = false) => {
    const out = [];
    const re = rango ? /((?:\d[\d.,\s]*?)(?:\s*(?:\/|–|-|\ba\b)\s*\d[\d.,\s]*?)*)\s*(kV|KV|kv|V)\b/g : /((?:\d[\d.,\s]*?)(?:\s*\/\s*\d[\d.,\s]*?)*)\s*(kV|KV|kv|V)\b/g;
    for (const m of t.replace(/[\u00a0\u202f]/g, ' ').matchAll(re)) {
      const k = /k/i.test(m[2]);
      for (const n of numeros(m[1])) { const v = k ? n.v : n.v / 1000; if (v > 0.1 && v <= 800) out.push(v); }
    }
    return out;
  };
  const nominal = conUnidad(cabeza);
  const todas = conUnidad(s, true);
  const pm = s.match(/±\s*(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (pm && nominal.length) { const f = (+pm[1]) * Number(pm[2].replace(',', '.')) / 100; todas.push(nominal[0] * (1 + f), nominal[0] * (1 - f)); }
  return { nominal, min: todas.length ? Math.min(...todas) : null, max: todas.length ? Math.max(...todas) : null };
}
/** Compatibilidad: todas las tensiones en kV que nombra el texto (nominal y extremos). */
export function tensionesKv(txt) { const t = tensionesPlaca(txt); return [...t.nominal, ...(t.min != null ? [t.min, t.max] : [])]; }

/** Corrientes en amperios impresas en un texto («627,6/836,7 A»); descarta relaciones de TC («200/5 A»). */
export function corrientesA(txt) {
  const s = String(txt || '');
  const out = [];
  for (const m of s.matchAll(/(\d[\d.,\s/]*?)\s*A\b/g)) {
    if (/\/\s*[15]\s*$/.test(m[1])) continue;
    for (const n of numeros(m[1])) if (n.v > 0) out.push(n.v);
  }
  return out;
}

/** Potencia mayor de la placa (kVA) entre sus etapas. */
export function topePlacaKva(datos) {
  const v = Object.values((datos && datos.etapas_kva) || {}).map(pos).filter(Boolean);
  return v.length ? Math.max(...v) : null;
}

function distancia(a, b) {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const fmtA = (x) => Number(x).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/**
 * Revisión de la placa contra la plataforma: lo que difiere, lo que se comparó y lo que no se pudo comparar.
 * Solo se muestra; nada cambia un dato oficial.
 * @returns {{difs:Array<{campo, placa, plataforma, nota, grave}>, comparados:string[], sinComparar:string[]}}
 */
export function revisionPlaca(placa, tx) {
  const d = (placa && placa.datos) || {};
  const e = (tx && tx.electrico) || {}; const pl = (tx && tx.placa) || {};
  const difs = []; const comparados = []; const sinComparar = [];
  const add = (campo, vPlaca, vPlat, nota, grave = false) => difs.push({ campo, placa: String(vPlaca), plataforma: String(vPlat), nota, grave });
  // Serie: por partes (WEG imprime «CP 40917725 / serie 2088316450»; el parque guarda una de las dos), sin las
  // anotaciones del lector; un comienzo común es lectura incompleta y 1–2 caracteres, posible error de digitación.
  const partesSerie = (x) => String(x || '').toUpperCase().replace(/\(.*?\)/g, ' ').replace(/\b(CP|OP|SERIE|SERIAL|NS|N[°º]|OTHV\d|GTHV\d)\b/g, ' ')
    .split(/[^A-Z0-9]+/).filter((y) => y.length >= 4);
  const pP = partesSerie(d.serie); const pT = partesSerie(pl.serial || (tx && tx.serial));
  if (pP.length && pT.length) {
    comparados.push('serie');
    const igual = pP.some((x) => pT.some((y) => x === y || (x.length >= 6 && y.length >= 6 && (x.endsWith(y) || y.endsWith(x)))))
      || (pP.join('').length >= 6 && pT.join('').length >= 6 && (pP.join('').includes(pT.join('')) || pT.join('').includes(pP.join(''))));
    if (!igual) {
      const pares = pP.flatMap((x) => pT.map((y) => [x, y]));
      if (pares.some(([x, y]) => x.startsWith(y) || y.startsWith(x))) add('Serie', d.serie, pl.serial || tx.serial, 'la lectura de la placa está incompleta (coincide el comienzo)');
      else if (pares.some(([x, y]) => distancia(x, y) <= 2)) add('Serie', d.serie, pl.serial || tx.serial, 'difiere en uno o dos caracteres: posible error de lectura o de digitación');
      else add('Serie', d.serie, pl.serial || tx.serial, 'la foto podría ser de otro equipo: confirmar', true);
    }
  } else sinComparar.push('serie');
  // Potencia
  const tope = topePlacaKva(d); const kva = pos(pl.potencia_kva);
  if (tope && kva) {
    comparados.push('potencia');
    if (!cerca(tope, kva, 0.01)) {
      const etapa = Object.entries(d.etapas_kva || {}).find(([, v]) => cerca(pos(v), kva, 0.01));
      if (etapa) add('Potencia', tope.toLocaleString('es-CO') + ' kVA (mayor etapa)', kva.toLocaleString('es-CO') + ' kVA', 'la plataforma tiene la etapa ' + etapa[0]);
      else add('Potencia', tope.toLocaleString('es-CO') + ' kVA', kva.toLocaleString('es-CO') + ' kVA', 'no coincide con ninguna etapa de la placa', true);
    }
  } else sinComparar.push('potencia');
  // Año
  const anioT = Number((tx && tx.fabricacion && tx.fabricacion.ano_fabricacion) || (tx && tx.ano_fabricacion)) || null;
  if (pos(d.anio) && anioT) { comparados.push('año'); if (Number(d.anio) !== anioT) add('Año de fabricación', d.anio, anioT, 'no coincide (la placa puede ser de una reparación)'); }
  // Fases: solo si la plataforma dice OTRA cosa.
  const fP = Number(d.fases); const fT = Number(e.fases);
  if ((fP === 1 || fP === 3) && (fT === 1 || fT === 3) && fP !== fT) add('Fases', fP, fT, 'no coincide', true);
  // Tensiones por devanado: nominal, rango del cambiador o fuera.
  const t = d.tension || {}; const kvPlaca = {};
  for (const k of ['P', 'S', 'T']) {
    const kv = pos(e[CAMPO_KV[k]]); const tp = tensionesPlaca(t[k]); kvPlaca[k] = tp.nominal;
    if (!kv) continue;
    if (!tp.nominal.length) { if (t[k]) sinComparar.push('tensión ' + DEV[k].toLowerCase()); continue; }
    comparados.push('tensión ' + DEV[k].toLowerCase());
    if (tp.nominal.some((c) => cerca(c, kv, 0.005) || cerca(c * R3, kv, 0.005))) continue;
    // Placa RECONECTABLE («110 kV … (religable a 67 kV …)», «reconectable a 66 kV»): la plataforma puede estar en la otra
    // conexión que la placa nombra; no es error, se anota (2026-10-23, Bosque T2).
    const alternas = [...String(t[k] || '').matchAll(/(?:religable|reconectable|conexi[oó]n\s+alternativa)\s*(?:a\s*)?(\d+(?:[.,]\d+)?)\s*kV/gi)]
      .map((m) => Number(m[1].replace(',', '.')));
    if (alternas.some((c) => cerca(c, kv, 0.02))) add('Tensión ' + DEV[k].toLowerCase(), t[k], kv + ' kV', 'la plataforma está en la conexión alternativa que nombra la placa (reconectable)');
    else if (tp.min != null && kv >= tp.min * 0.995 && kv <= tp.max * 1.005) add('Tensión ' + DEV[k].toLowerCase(), t[k], kv + ' kV', 'la plataforma tiene una toma del cambiador, no la tensión nominal');
    else add('Tensión ' + DEV[k].toLowerCase(), t[k], kv + ' kV', 'no coincide con la placa', true);
  }
  // Ampacidades: contra las corrientes impresas en el texto de ESE devanado y las que dan las etapas de la placa
  // a su tensión (la de la plataforma y la nominal de la placa). En los de tres devanados, S y T solo por ×10.
  const etapas = Object.values(d.etapas_kva || {}).map(pos).filter(Boolean);
  const mono = fP === 1 || fT === 1; const tres = !!pos(e.tension_terciaria_kv);
  const esperadas = (kv) => (kv ? etapas.flatMap((kVA) => (mono ? [kVA / kv, kVA / (kv / R3)] : [kVA / (R3 * kv)])) : []);
  for (const k of ['P', 'S', 'T']) {
    const A = pos(e[CAMPO_A[k]]); const kv = pos(e[CAMPO_KV[k]]);
    if (!A || !kv) continue;
    const impresas = corrientesA(t[k]);
    const conPlat = [...impresas, ...esperadas(kv)];
    const conPlaca = (kvPlaca[k] || []).flatMap((x) => esperadas(x));
    if (!conPlat.length && !conPlaca.length) { sinComparar.push('ampacidad ' + DEV[k].toLowerCase()); continue; }
    comparados.push('ampacidad ' + DEV[k].toLowerCase());
    if (conPlat.some((x) => cerca(x, A, 0.02))) continue;
    if (conPlaca.some((x) => cerca(x, A, 0.02))) { add('Ampacidad ' + DEV[k].toLowerCase(), 'cuadra con la tensión de la placa', fmtA(A) + ' A', 'la ampacidad es de placa; lo que difiere es la tensión: revisar la tensión'); continue; }
    const x10 = conPlat.find((x) => cerca(x * 10, A, 0.02) || cerca(x / 10, A, 0.02));
    if (x10) add('Ampacidad ' + DEV[k].toLowerCase(), fmtA(x10) + ' A', fmtA(A) + ' A', 'posible errata ×10: corregir ampacidad y carga juntas', true);
    else if (k === 'P' || (!tres && k === 'S')) {
      add('Ampacidad ' + DEV[k].toLowerCase(), [...new Set(conPlat.map(fmtA))].join(' · ') + ' A', fmtA(A) + ' A', 'no cuadra con la placa: la ampacidad parece de otra potencia', true);
    }
  }
  return { difs, comparados, sinComparar: [...new Set(sinComparar)] };
}

/** Diferencias entre la placa leída y la plataforma (compatibilidad: solo la lista). */
export function diferencias(placa, tx) { return revisionPlaca(placa, tx).difs; }

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

// ── Paquete de carga (lo arma el preparador en el computador del Ingeniero; nunca va al repo) ─────────
export const FORMATO_PAQUETE = 'sgm-placas-caracteristicas';
const b64aBytes = (s) => { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

/**
 * Revisa una placa del paquete contra el parque vivo: forma, partes y equipo. No toca la red.
 * @returns {{ok:boolean, motivo?:string, id:string, matricula:string, meta?:object, partes?:Uint8Array[]}}
 */
export function revisarPlacaPaquete(p, parquePorId) {
  const id = String((p && p.id) || '');
  const mal = (motivo) => ({ ok: false, motivo, id, matricula: (p && p.matricula) || '' });
  if (!/^[A-Za-z0-9]{6,64}$/.test(id)) return mal('id inválido');
  const tx = parquePorId.get(id);
  if (!tx) return mal('el transformador no está en el parque');
  // Se compara sin espacios ni mayúsculas, pero se guarda la del inventario TAL CUAL (la regla la exige idéntica).
  const crudo = String((tx.identificacion && tx.identificacion.matricula) || '');
  const mat = crudo.trim().toUpperCase();
  if (!p.meta || p.meta.schema !== 1 || !p.meta.datos || !p.meta.fuente) return mal('placa sin datos');
  if (!/^[0-9a-f]{64}$/.test(String(p.meta.fuente.huella_datos || ''))) return mal('placa sin huella de sus datos');
  if (String(p.meta.matricula || '').trim().toUpperCase() !== mat) return mal('la matrícula no coincide con el parque (' + mat + ')');
  const foto = p.meta.foto || null;
  let partes = [];
  if (foto) {
    if (!(foto.partes >= 1 && foto.partes <= PARTES_MAX) || !Array.isArray(p.partes) || p.partes.length !== foto.partes) return mal('foto incompleta');
    try { partes = p.partes.map((x) => { if (x.lote !== foto.lote) throw new Error('lote'); return b64aBytes(x.b64); }); } catch (e) { return mal('foto ilegible'); }
    if (partes.some((b) => !b.length || b.length > TOPE_PARTE)) return mal('una parte de la foto pesa más de 900 KB');
    if (partes.reduce((a, b) => a + b.length, 0) !== foto.bytes) return mal('el tamaño de la foto no coincide');
    const u = unir(partes);
    if (!(u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF)) return mal('la foto no es JPEG');
    // Sin metadatos de cámara: ni APP1 (Exif/XMP, donde va el GPS), ni APP13, ni comentarios.
    for (let i = 2; i < Math.min(u.length - 1, 65536);) {
      if (u[i] !== 0xFF) break;
      const mk = u[i + 1];
      if (mk === 0xDA) break;
      if (mk === 0xE1 || mk === 0xED || mk === 0xFE) return mal('la foto trae metadatos de cámara');
      i += 2 + ((u[i + 2] << 8) | u[i + 3]);
    }
  }
  if (crudo.trim().length < 3 || crudo.length > 40) return mal('la matrícula del inventario no sirve para la placa (' + crudo + ')');
  return { ok: true, id, matricula: crudo, meta: { ...p.meta, matricula: crudo }, partes };
}
