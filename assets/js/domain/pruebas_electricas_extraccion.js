// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — extracción automática desde el texto del PDF
// ──────────────────────────────────────────────────────────────
// Lee el texto plano que pdf.js extrae de un informe de pruebas
// eléctricas y deduce las mediciones de las 6 pruebas del tablero:
//   · tan δ (6 configuraciones de aislamiento)
//   · corriente de excitación (Δ entre fases)
//   · relación de transformación (desviación %)
//   · resistencia de devanados (desbalance %)
//   · resistencia de aislamiento (GΩ)
//   · collar caliente / bujes (mW)
//
// Política de confiabilidad (crítica para un semáforo normativo):
//   · solo se emite un valor cuando un patrón etiquetado coincide
//     con una magnitud plausible; si no, el campo queda en null y el
//     semáforo lo pinta "n/d" (mejor vacío que un color equivocado).
//   · cada campo deja traza en `_diagnostico` (qué se halló y de
//     dónde), para depurar contra PDFs reales sin adivinar.
//
// Funciones puras, sin DOM ni Firestore. Testeable con node --test.
// ══════════════════════════════════════════════════════════════

/* ─── Normalización de texto ──────────────────────────────────── */
// Quita acentos, colapsa espacios y baja a minúsculas. Conserva
// dígitos, separadores decimales, '%', letras y guiones.
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .toLowerCase();
}

/* ─── Parseo numérico tolerante (coma o punto decimal) ────────── */
// "0,39" → 0.39 · "1.234,5" → 1234.5 · "1,234.5" → 1234.5 · "0.39" → 0.39
export function parseNum(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/\s/g, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // El último separador es el decimal; el otro es de miles.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Patrón de número (con coma o punto, opcional signo).
const NUM = '(-?\\d{1,4}(?:[.,]\\d{1,4})*(?:[.,]\\d+)?)';

/* ─── tan δ · 6 configuraciones de aislamiento ────────────────── */
// Cada código del tablero con sus alias de etiquetado vistos en los
// informes (terminología distinta entre fabricantes/años, §tablero).
const ALIAS_TAND = {
  CH:  ['ch', 'chg', 'at-tierra', 'at a tierra', 'at-t', 'hi-gnd', 'hg', 'h-g'],
  CHL: ['chl', 'at-mt', 'at a mt', 'hi-lo', 'h-l'],
  CL:  ['cl', 'clg', 'mt-tierra', 'mt a tierra', 'mt-t', 'lo-gnd', 'lg', 'l-g'],
  CLT: ['clt', 'mt-bt', 'mt a bt', 'lo-ter', 'l-t'],
  CT:  ['ct', 'ctg', 'bt-tierra', 'bt a tierra', 'bt-t', 'ter-gnd', 'tg', 't-g'],
  CHT: ['cht', 'at-bt', 'at a bt', 'hi-ter', 'h-t']
};

// Códigos cortos que deben matchear como token aislado (evita que
// "cl" matchee dentro de "clase" o "ct" dentro de "contacto").
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'); }

// Busca el % de tan δ de un código: la primera ocurrencia del alias
// seguida (hasta ~24 chars) de un número en rango plausible [0, 10].
function tandDeCodigo(texto, alias) {
  for (const a of alias) {
    const tok = escapeRe(a);
    // límite de palabra a ambos lados para alias cortos tipo "cl".
    // El '+' también delimita: en una fila combinada "CH + CHL" el
    // "ch" precede a un '+' y el "chl" sigue a un '+'; ninguno debe
    // tomarse como medición aislada (su número es de la combinación).
    const re = new RegExp(`(?:^|[^a-z0-9+])${tok}(?![a-z0-9+])[^\\d\\n]{0,24}?${NUM}\\s*%?`, 'i');
    const m = texto.match(re);
    if (m) {
      const v = parseNum(m[1]);
      // Rechaza capacitancias (formato GST/UST "… nF …"): el número
      // tomado no debe ir seguido de "nF" (eso sería pico-faradios,
      // no el factor de potencia). Evita el falso positivo 8.85.
      const resto = texto.slice(m.index + m[0].length, m.index + m[0].length + 6);
      if (/^\s*n\s*f/i.test(resto)) continue;
      if (v != null && v >= 0 && v <= 10) return { valor_pct: v, alias: a };
    }
  }
  return null;
}

/* ─── tan δ · formato puente capacitancia GST/UST (vendor 2020) ──── */
// Otra familia de informe lineariza así:
//   "<CODE> <Capacitancia> nF <tanδ> %"
// donde el tan δ es el número JUSTO ANTES de "%". pdf.js parte algunos
// códigos ("c hl"→CHL, "c l"→CL, "cl t"→CLT) y el informe los repite
// por pasos de tensión: la ÚLTIMA ocurrencia es la definitiva. Las
// filas combinadas ("X + Y") se descartan (no son aislamiento puro) y
// el código "CTH" del informe equivale a CHT (AT-BT) del tablero.
const TAND_GSTUST = {
  CH:  ['c\\s*h'],
  CHL: ['c\\s*h\\s*l'],
  CL:  ['c\\s*l'],
  CLT: ['c\\s*l\\s*t'],
  CT:  ['c\\s*t'],
  CHT: ['c\\s*t\\s*h', 'c\\s*h\\s*t']
};

function extraerTandGstUst(texto) {
  if (!/\bn\s*f\b/i.test(texto)) return {};   // formato no presente
  const out = {};
  for (const code of Object.keys(TAND_GSTUST)) {
    let val = null;
    for (const pat of TAND_GSTUST[code]) {
      // grupo 1 = capacitancia (nF) · grupo 2 = tan δ (% antes de "%")
      const re = new RegExp(`(?:^|[^a-z0-9+])${pat}\\s+${NUM}\\s*n\\s*f\\s+${NUM}\\s*%`, 'gi');
      let m;
      while ((m = re.exec(texto)) != null) {
        const v = parseNum(m[2]);
        if (v != null && v >= 0 && v <= 10) val = v;   // la última gana
      }
    }
    if (val != null) out[code] = val;
  }
  return out;
}

/* ─── tan δ · formato columnar Doble (M-series 2012/2014) ──────── */
// pdf.js linealiza la tabla del informe Doble en orden de fila:
//   "CODE [kV] mA Watts %PF CorrFctr Cap"
// El %PF (factor de potencia corregido = tan δ) es el TERCER número
// desde el final de la corrida numérica de una fila de código AISLADO.
// Deben descartarse las filas combinadas ("X + Y") y las de medición
// auxiliar ("X(UST)" → token "chl(ust)" ≠ "chl"). La regla del tercio
// final es robusta a que la columna kV aparezca o no en la fila.
const CODES_TAND = ['ch', 'chl', 'cl', 'clt', 'ct', 'cht'];

function esTokenNumerico(tok) {
  return /^-?\d[\d.,]*$/.test(tok);
}

function extraerTandColumnar(texto) {
  const toks = texto.split(/\s+/).filter(Boolean);
  const out = {};
  for (let i = 0; i < toks.length; i++) {
    const code = toks[i];
    if (!CODES_TAND.includes(code)) continue;
    const up = code.toUpperCase();
    if (out[up] != null) continue;                 // primera fila aislada gana
    const prev = i > 0 ? toks[i - 1] : '';
    const next = i + 1 < toks.length ? toks[i + 1] : '';
    if (prev === '+' || next === '+') continue;     // fila combinada "X + Y"
    if (!esTokenNumerico(next)) continue;           // debe iniciar corrida numérica
    const run = [];
    let j = i + 1;
    while (j < toks.length && esTokenNumerico(toks[j])) { run.push(toks[j]); j++; }
    if (run.length < 3) continue;
    const pf = parseNum(run[run.length - 3]);
    if (pf != null && pf >= 0 && pf <= 10) out[up] = pf;
  }
  return out;
}

function extraerTand(texto) {
  const out = [];
  const traza = {};
  const col = extraerTandColumnar(texto);
  const gst = extraerTandGstUst(texto);
  for (const code of Object.keys(ALIAS_TAND)) {
    if (col[code] != null) {
      out.push({ code, valor_pct: col[code] });
      traza[code] = `${col[code]}% (columnar Doble)`;
      continue;
    }
    if (gst[code] != null) {
      out.push({ code, valor_pct: gst[code] });
      traza[code] = `${gst[code]}% (puente GST/UST)`;
      continue;
    }
    const hit = tandDeCodigo(texto, ALIAS_TAND[code]);
    if (hit) {
      out.push({ code, valor_pct: hit.valor_pct });
      traza[code] = `${hit.valor_pct}% (alias "${hit.alias}")`;
    }
  }
  return { tand: out, traza };
}

/* ─── Helper: número plausible tras una etiqueta ──────────────── */
// Busca `etiqueta … número unidad?` y valida el rango. Devuelve el
// número o null. `unidad` es un patrón opcional que debe seguir.
function tras(texto, etiquetas, { min, max, unidad } = {}) {
  for (const et of etiquetas) {
    const u = unidad ? `\\s*(?:${unidad})` : '';
    const re = new RegExp(`${et}[^\\d\\n]{0,40}?${NUM}${u}`, 'i');
    const m = texto.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v != null && (min == null || v >= min) && (max == null || v <= max)) {
        return { valor: v, etiqueta: et };
      }
    }
  }
  return null;
}

/* ─── Corriente de excitación · Δ entre fases ─────────────────── */
// El desbalance normativo es entre las DOS fases mayores del devanado
// AT (la fase central cae naturalmente más baja): Δ = (mayor − 2ª
// mayor) / mayor · 100. NO (max−min)/max.
function deltaDosMayores(corrientes) {
  const desc = corrientes.slice().sort((a, b) => b - a);
  if (desc.length < 2 || desc[0] <= 0) return null;
  return Math.round(((desc[0] - desc[1]) / desc[0]) * 100 * 100) / 100;
}

function extraerExcitacion(texto) {
  const traza = {};
  let delta = null;
  let corriente_ma = null;

  // (a) Δ% declarado explícitamente cerca de "excitacion".
  const reDelta = new RegExp(
    `(?:corriente de )?excitacion[^%]{0,80}?(?:delta|diferencia|desbalance|variacion|%\\s*dif)[^\\d]{0,20}?${NUM}\\s*%`, 'i');
  const md = texto.match(reDelta);
  if (md) { delta = parseNum(md[1]); traza.delta = `${delta}% (declarado)`; }

  // (b) Formato columnar Doble: la cabecera "mA Watts mA Watts mA
  //     Watts" precede a la fila "<test> <kV> <H1mA> <H1W> <H2mA>
  //     <H2W> <H3mA> <H3W>". Las corrientes son las columnas mA
  //     (offsets 2,4,6 del run). Se busca en TODO el texto: el bloque
  //     de datos vive lejos del primer título "excitación".
  if (delta == null) {
    // La cabecera puede traer una columna divisoria de una letra entre
    // grupos ("mA Watts X mA Watts X …", vista en informes 2014); se
    // tolera como token opcional de una sola letra.
    const div = '(?:\\s+[a-z](?![a-z]))?';
    const mh = texto.match(new RegExp(
      `m\\s*a\\s+watts${div}\\s+m\\s*a\\s+watts${div}\\s+m\\s*a\\s+watts${div}([\\s\\S]{0,160})`, 'i'));
    if (mh) {
      const nums = [...mh[1].matchAll(new RegExp(NUM, 'g'))]
        .map((x) => parseNum(x[1])).filter((v) => v != null);
      if (nums.length >= 8) {
        const fases = [nums[2], nums[4], nums[6]].filter((v) => v >= 0 && v < 100000);
        if (fases.length === 3) {
          corriente_ma = Math.max(...fases);
          delta = deltaDosMayores(fases);
          if (delta != null) {
            traza.delta = `${delta}% (columnar Doble · fases ${fases.join('/')} mA)`;
            traza.corriente_ma = `${corriente_ma} mA`;
          }
        }
      }
    }
  }

  // (c) Fallback: corrientes etiquetadas con "mA" cerca de excitación.
  if (delta == null || corriente_ma == null) {
    const reBloque = new RegExp(`excitacion[\\s\\S]{0,200}`, 'i');
    const blk = (texto.match(reBloque) || [''])[0];
    const mas = [...blk.matchAll(new RegExp(`${NUM}\\s*m\\s*a\\b`, 'gi'))]
      .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
    if (mas.length >= 3) {
      const tres = mas.slice(0, 3);
      corriente_ma = Math.max(...tres);
      if (delta == null) {
        delta = deltaDosMayores(tres);
        if (delta != null) traza.delta = `${delta}% (calculado de ${tres.join('/')} mA)`;
      }
      traza.corriente_ma = `${corriente_ma} mA`;
    } else if (mas.length && corriente_ma == null) {
      corriente_ma = Math.max(...mas);
      traza.corriente_ma = `${corriente_ma} mA`;
    }
  }

  return { excitacion: { delta_pct: delta, corriente_ma }, traza };
}

/* ─── Relación de transformación · desviación % ───────────────── */
function extraerRelacion(texto) {
  const traza = {};
  const hit = tras(texto, [
    'relacion de transformacion[^%]{0,120}?(?:error|desviacion|%\\s*error|deviation)',
    '(?:ttr|relacion de vueltas)[^%]{0,80}?(?:error|desviacion)',
    'error de relacion'
  ], { min: -10, max: 10 });
  let desviacion_pct = null;
  if (hit) {
    desviacion_pct = Math.abs(hit.valor);
    traza.desviacion = `${desviacion_pct}% (${hit.etiqueta.slice(0, 24)}…)`;
  }
  return { relacion: { desviacion_pct }, traza };
}

/* ─── Resistencia de devanados · desbalance % ─────────────────── */
function extraerResistencia(texto) {
  const traza = {};
  const hit = tras(texto, [
    'resistencia de devanado[s]?[^%]{0,120}?(?:desbalance|desequilibrio|maximo|max\\.?|%\\s*dif)',
    'desbalance[^%]{0,40}?(?:de devanado|resistencia)',
    'winding resistance[^%]{0,120}?(?:imbalance|max)'
  ], { min: 0, max: 50 });
  let desbalance_pct = null;
  if (hit) { desbalance_pct = hit.valor; traza.desbalance = `${desbalance_pct}% (${hit.etiqueta.slice(0, 24)}…)`; }
  // Marca "verificar" si el informe lo dice cerca de resistencia.
  const verificar = /resistencia[\s\S]{0,160}?(verificar|revisar|a confirmar|dudoso|error de digitaci)/i.test(texto);
  if (verificar) traza.verificar = 'sí (texto lo señala)';
  return { resistencia: { desbalance_pct, verificar }, traza };
}

/* ─── Resistencia de aislamiento · GΩ (acepta MΩ y normaliza) ─── */
function extraerAislamiento(texto) {
  const traza = {};
  let gohm = null;
  // GΩ directo.
  let hit = tras(texto, [
    'resistencia de aislamiento', 'aislamiento', 'insulation resistance', 'megger', 'ir\\b'
  ], { min: 0, max: 100000, unidad: 'g\\s*(?:ohm|Ω|o)' });
  if (hit) { gohm = hit.valor; traza.aislamiento = `${gohm} GΩ`; }
  if (gohm == null) {
    // MΩ → GΩ.
    const m = texto.match(new RegExp(
      `(?:resistencia de aislamiento|aislamiento|insulation resistance|megger)[^\\d\\n]{0,40}?${NUM}\\s*m\\s*(?:ohm|Ω|o)`, 'i'));
    if (m) {
      const mohm = parseNum(m[1]);
      if (mohm != null && mohm >= 0) { gohm = mohm / 1000; traza.aislamiento = `${gohm} GΩ (de ${mohm} MΩ)`; }
    }
  }
  return { aislamiento: { gohm }, traza };
}

/* ─── Collar caliente / bujes · mW ────────────────────────────── */
function extraerCollar(texto) {
  const traza = {};
  let mw = null;
  // Mayor valor en mW cerca de "collar"/"bujes"/"hot collar".
  const reBloque = /(?:collar caliente|hot collar|collar|bujes|bushing)[\s\S]{0,240}/i;
  const blk = (texto.match(reBloque) || [''])[0];
  const mws = [...blk.matchAll(new RegExp(`${NUM}\\s*m\\s*w\\b`, 'gi'))]
    .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
  if (mws.length) { mw = Math.max(...mws); traza.collar = `${mw} mW (máx de ${mws.length})`; }
  return { collar: { mw }, traza };
}

/* ─── Orquestador ─────────────────────────────────────────────── */
/**
 * Extrae las mediciones de las 6 pruebas desde el texto del PDF.
 * @param {string} textoPdf texto plano extraído del informe
 * @returns {{ tand, excitacion, relacion, resistencia, aislamiento,
 *             collar, _diagnostico:{ campos:string[], traza:object } }}
 *          Campos no hallados quedan null/[]; `_diagnostico.campos`
 *          lista las pruebas con al menos un dato extraído.
 */
export function extraerMediciones(textoPdf) {
  const t = normalizar(textoPdf);
  const { tand, traza: tzTand } = extraerTand(t);
  const { excitacion, traza: tzExc } = extraerExcitacion(t);
  const { relacion, traza: tzRel } = extraerRelacion(t);
  const { resistencia, traza: tzRes } = extraerResistencia(t);
  const { aislamiento, traza: tzAis } = extraerAislamiento(t);
  const { collar, traza: tzCol } = extraerCollar(t);

  const campos = [];
  if (tand.length) campos.push('tand');
  if (excitacion.delta_pct != null || excitacion.corriente_ma != null) campos.push('excitacion');
  if (relacion.desviacion_pct != null) campos.push('relacion');
  if (resistencia.desbalance_pct != null || resistencia.verificar) campos.push('resistencia');
  if (aislamiento.gohm != null) campos.push('aislamiento');
  if (collar.mw != null) campos.push('collar');

  return {
    tand, excitacion, relacion, resistencia, aislamiento, collar,
    _diagnostico: {
      campos,
      traza: { tand: tzTand, excitacion: tzExc, relacion: tzRel, resistencia: tzRes, aislamiento: tzAis, collar: tzCol }
    }
  };
}
