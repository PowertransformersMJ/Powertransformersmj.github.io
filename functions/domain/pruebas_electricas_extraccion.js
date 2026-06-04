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

function esTokenNumerico(tok) {
  return /^-?\d[\d.,]*$/.test(tok);
}

// Busca el % de tan δ de un código: la primera ocurrencia del alias
// seguida (hasta ~24 chars) de un número en rango plausible [0, 10] y
// rematado por "%". Exigir el "%" evita capturar tensiones ("10 kV") o
// fechas ("10/09/2023") como si fueran factor de potencia (regla de
// confiabilidad: mejor vacío que un color equivocado).
function tandDeCodigo(texto, alias) {
  for (const a of alias) {
    const tok = escapeRe(a);
    // límite de palabra a ambos lados para alias cortos tipo "cl".
    // El '+' también delimita: en una fila combinada "CH + CHL" el
    // "ch" precede a un '+' y el "chl" sigue a un '+'; ninguno debe
    // tomarse como medición aislada (su número es de la combinación).
    const re = new RegExp(`(?:^|[^a-z0-9+])${tok}(?![a-z0-9+])[^\\d\\n]{0,24}?${NUM}\\s*%`, 'i');
    const m = texto.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v != null && v >= 0 && v <= 10) return { valor_pct: v, alias: a };
    }
  }
  return null;
}

/* ─── tan δ · puente de capacitancia (Omicron / familias 2020-23) ── */
// Estas familias linearizan cada fila aislada así:
//   "<CODE> <Capacitancia>(p|n)F <tanδ> (%|OK)"
// El código antecede a la capacitancia; el tan δ es el SEGUNDO número
// (tras "pF"/"nF"). El informe repite cada código por paso de tensión
// (2 kV y 10 kV): la ÚLTIMA ocurrencia (mayor tensión) es la definitiva.
// Variantes cubiertas en un solo patrón:
//   · unidad pico- o nano-faradios ("2621.2pF" pegado o "6.1222 nF").
//   · delimitador final "%" (informes 3 y 7) u "OK" (informe 5).
// Se descartan filas combinadas ("X + Y") por el lookbehind/lookahead de
// '+', y los códigos redundantes "CLH"/"CTL" no entran en la alternancia
// (sus números repiten una configuración ya medida). "CTH" ≡ CHT.
function extraerTandPuente(texto) {
  const re = new RegExp(
    '(?:^|[^a-z0-9+])(c\\s*h\\s*l|c\\s*l\\s*t|c\\s*t\\s*h|c\\s*h\\s*t|c\\s*h|c\\s*l|c\\s*t)' +
    `(?![a-z0-9+])\\s+${NUM}\\s*(?:p|n)\\s*f\\s+${NUM}\\s*(?:%|ok\\b)`, 'gi');
  const out = {};
  let m;
  while ((m = re.exec(texto)) != null) {
    let code = m[1].replace(/\s+/g, '').toUpperCase();
    if (code === 'CTH') code = 'CHT';
    const v = parseNum(m[3]);          // m[2] = capacitancia · m[3] = tan δ
    if (v != null && v >= 0 && v <= 10) out[code] = v;   // la última gana
  }
  return out;
}

/* ─── tan δ · formato columnar Doble (M-4100, 2012/2014) ──────────── */
// Firma EXCLUSIVA de esta familia: el token "fctr" (de "Corr Fctr").
// El bloque dieléctrico mide 12 configuraciones por paso de tensión en
// el orden canónico:
//   [CH+CHL, CH, CHL(UST), CHL, CL+CLT, CL, CLT(UST), CLT,
//    CT+CHT, CT, CHT(UST), CHT]
// Las mediciones de aislamiento puro quedan en los índices [1,3,5,7,9,11]
// (las pares son combinadas o auxiliares UST). El primer bloque de 12 es
// el de mayor tensión (10 kV). La columna "%PF corr" = tan δ.
//   · Layout A (informe 9): la cabecera "%PF corr" precede DIRECTAMENTE a
//     su columna de números → se leen los 12 primeros tras el ancla.
//   · Layout B (informe 8): todas las cabeceras van primero y luego todas
//     las columnas; la columna "Corr Fctr" es ~constante (0.92 ó 1.0), así
//     que los 12 números justo ANTES de esa ventana constante son el %PF.
const MAPA_DOBLE = [null, 'CH', null, 'CHL', null, 'CL', null, 'CLT', null, 'CT', null, 'CHT'];

function mapearDoble(nums) {
  const out = {};
  for (let k = 0; k < 12; k++) {
    const code = MAPA_DOBLE[k];
    if (!code) continue;
    const v = nums[k];
    if (v != null && v >= 0 && v <= 10) out[code] = v;
  }
  return out;
}

function extraerTandDoble(texto) {
  if (!/fctr/i.test(texto)) return {};
  // Layout A · columna inmediatamente tras "%PF corr".
  const mA = texto.match(/%\s*pf\s+corr\b([\s\S]{0,600})/i);
  if (mA) {
    const run = [];
    for (const tk of mA[1].trim().split(/\s+/)) {
      if (esTokenNumerico(tk)) run.push(parseNum(tk)); else break;
    }
    if (run.length >= 12) {
      const res = mapearDoble(run.slice(0, 12));
      if (Object.keys(res).length >= 4) return res;
    }
  }
  // Layout B · todas las cabeceras van primero y luego TODAS las columnas;
  // la columna "Corr Fctr" es ~constante (0.92 ó 1.0). Los 12 números justo
  // ANTES de esa ventana constante son el %PF. Se ancla en la cabecera de
  // datos "%PF corr" (no en el título "ensayos dieléctricos", que aparece
  // en la portada/índice lejos de los datos).
  const pf = texto.search(/%\s*pf\s+corr/i);
  const reg = pf >= 0 ? texto.slice(pf, pf + 2200) : '';
  const nums = (reg.match(new RegExp(NUM, 'g')) || []).map(parseNum).filter((v) => v != null);
  for (let i = 12; i + 12 <= nums.length; i++) {
    const win = nums.slice(i, i + 12);
    const mn = Math.min(...win), mx = Math.max(...win);
    if (mn >= 0.85 && mx <= 1.05 && (mx - mn) <= 0.1) {
      const res = mapearDoble(nums.slice(i - 12, i));
      if (Object.keys(res).length >= 4) return res;
    }
  }
  return {};
}

/* ─── tan δ · columnar por fila (3º número desde el final) ─────── */
// Cuando pdf.js lineariza una fila Doble "CODE [kV] mA Watts %PF CorrFctr
// Cap" sin que sobreviva la cabecera "Corr Fctr", el %PF (= tan δ) es el
// TERCER número desde el final de la corrida numérica de una fila de
// código AISLADO. Se descartan filas combinadas ("X + Y"). Es ruta de
// respaldo: sólo corre si los handlers de tabla (doble/puente) no
// engancharon, para no pisar sus resultados calibrados.
const CODES_TAND = ['ch', 'chl', 'cl', 'clt', 'ct', 'cht'];

function extraerTandColumnar(texto) {
  const toks = texto.split(/\s+/).filter(Boolean);
  const out = {};
  for (let i = 0; i < toks.length; i++) {
    const code = toks[i];
    if (!CODES_TAND.includes(code)) continue;
    const up = code.toUpperCase();
    if (out[up] != null) continue;                  // primera fila aislada gana
    const prev = i > 0 ? toks[i - 1] : '';
    const next = i + 1 < toks.length ? toks[i + 1] : '';
    if (prev === '+' || next === '+') continue;      // fila combinada "X + Y"
    if (!esTokenNumerico(next)) continue;            // debe iniciar corrida numérica
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
  const doble = /fctr/i.test(texto) ? extraerTandDoble(texto) : {};
  const puente = Object.keys(doble).length ? {} : extraerTandPuente(texto);
  const yaHay = Object.keys(doble).length || Object.keys(puente).length;
  const columnar = yaHay ? {} : extraerTandColumnar(texto);
  for (const code of Object.keys(ALIAS_TAND)) {
    if (doble[code] != null) {
      out.push({ code, valor_pct: doble[code] });
      traza[code] = `${doble[code]}% (columnar Doble)`;
      continue;
    }
    if (puente[code] != null) {
      out.push({ code, valor_pct: puente[code] });
      traza[code] = `${puente[code]}% (puente capacitancia)`;
      continue;
    }
    if (columnar[code] != null) {
      out.push({ code, valor_pct: columnar[code] });
      traza[code] = `${columnar[code]}% (columnar 3º-final)`;
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
  let fases = null;

  // (a) Δ% declarado explícitamente cerca de "excitacion".
  const reDelta = new RegExp(
    `(?:corriente de )?excitacion[^%]{0,80}?(?:delta|diferencia|desbalance|variacion|%\\s*dif)[^\\d]{0,20}?${NUM}\\s*%`, 'i');
  const md = texto.match(reDelta);
  if (md) { delta = parseNum(md[1]); traza.delta = `${delta}% (declarado)`; }

  // Región de datos: el título "excitación" aparece primero en el
  // índice/portada; la tabla de datos vive en la ÚLTIMA ocurrencia.
  const reExc = /excitacion/gi; let me; let lastExc = -1;
  while ((me = reExc.exec(texto)) != null) lastExc = me.index;
  const region = lastExc >= 0 ? texto.slice(lastExc, lastExc + 400) : '';

  // (b) Omicron / puente: tabla "desviación % evaluación" con filas
  //     "<tap> <H1mA> <H1W> w <H2mA> <H2W> w <H3mA> <H3W> w <desv> ok".
  //     Tras descartar el tap (primero) y la desviación (último), las
  //     mA son el primer número de cada par.
  if (fases == null) {
    const mo = texto.match(/desviacion\s*%\s*evaluacion([\s\S]{0,140}?)\bok\b/i);
    if (mo) {
      const ns = [...mo[1].matchAll(new RegExp(NUM, 'g'))].map((x) => parseNum(x[1])).filter((v) => v != null);
      if (ns.length >= 8) {
        const cuerpo = ns.slice(1, ns.length - 1);          // sin tap ni desviación
        const mas = cuerpo.filter((_, k) => k % 2 === 0);   // primer número de cada par (mA)
        const tres = mas.slice(0, 3).filter((v) => v >= 0 && v < 100000);
        if (tres.length === 3) { fases = tres; traza.fuente = 'Omicron desviación%'; }
      }
    }
  }

  // (c) Doble combinado: cabecera "mA Watts X mA Watts X mA Watts X"
  //     seguida de "<testkV> <H1mA> <H1W> X <H2mA> <H2W> X <H3mA> <H3W> X".
  //     Cada terna "<mA> <W> <letra>" expone la mA como primer número.
  if (fases == null && region) {
    const mc = region.match(/(?:m\s*a\s+watts\s*(?:[a-z](?![a-z])\s*)?){3}([\s\S]{0,110})/i);
    if (mc) {
      const trip = [...mc[1].matchAll(new RegExp(`${NUM}\\s+${NUM}\\s+[a-z](?![a-z])`, 'gi'))]
        .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
      if (trip.length >= 3) { fases = trip.slice(0, 3); traza.fuente = 'Doble combinado'; }
    }
  }

  // (d) Doble separado: tres "mA Watts <mA> <W>" consecutivos.
  if (fases == null && region) {
    const mas = [...region.matchAll(new RegExp(`m\\s*a\\s+watts\\s+${NUM}\\s+${NUM}`, 'gi'))]
      .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
    if (mas.length >= 3) { fases = mas.slice(0, 3); traza.fuente = 'Doble separado'; }
  }

  // (e) Genérico: tres o más valores "NUM mA" en la región (formato
  //     simple "H1 10 mA H2 11 mA H3 12 mA"). Último recurso.
  if (fases == null && region) {
    const mas = [...region.matchAll(new RegExp(`${NUM}\\s*m\\s*a\\b`, 'gi'))]
      .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
    if (mas.length >= 3) { fases = mas.slice(0, 3); traza.fuente = 'genérico mA'; }
  }

  if (fases && fases.length === 3) {
    corriente_ma = Math.max(...fases);
    if (delta == null) delta = deltaDosMayores(fases);
    traza.delta = `${delta}% (fases ${fases.join('/')} mA · ${traza.fuente || ''})`;
    traza.corriente_ma = `${corriente_ma} mA`;
  }

  return { excitacion: { delta_pct: delta, corriente_ma }, traza };
}

/* ─── Relación de transformación · desviación % ───────────────── */
// (a) Etiqueta directa "error/desviacion … NUM %" cerca de relación.
// (b) Tabla column-major: la relación se reconoce por la cabecera
//     "% dif" precedida de "relacion". pdf.js/pdftotext intercala las
//     relaciones medidas (≥1.5) con sus desviaciones (decimales <1.5).
//     Tomamos la MAYOR desviación en magnitud, recortando antes de
//     "observaciones / norma aplicable" para no capturar el umbral
//     normativo "±0,5%". La excitación usa "desviacion %" (no "% dif"),
//     de modo que su tabla no contamina este extractor.
function extraerRelacion(texto) {
  const traza = {};
  let desviacion_pct = null;

  const hit = tras(texto, [
    'relacion de transformacion[^%]{0,120}?(?:error|desviacion|%\\s*error|deviation)',
    '(?:ttr|relacion de vueltas)[^%]{0,80}?(?:error|desviacion)',
    'error de relacion'
  ], { min: -10, max: 10 });
  if (hit) {
    desviacion_pct = Math.abs(hit.valor);
    traza.desviacion = `${desviacion_pct}% (${hit.etiqueta.slice(0, 24)}…)`;
  }

  if (desviacion_pct == null) {
    const reDif = /%\s*dif/gi;
    let m; const candidatos = [];
    while ((m = reDif.exec(texto)) != null) {
      const previo = texto.slice(Math.max(0, m.index - 400), m.index);
      if (!/relacion/.test(previo)) continue;            // sólo tablas de relación
      const resto = texto.slice(m.index);
      const finObs = resto.search(/observacion|norma aplicable/i);
      const region = resto.slice(0, finObs >= 0 ? Math.min(finObs, 1500) : 1500);
      for (const x of region.matchAll(new RegExp(NUM, 'g'))) {
        const tok = x[1];
        if (!/[.,]/.test(tok)) continue;                 // sólo decimales (excluye taps/voltajes enteros)
        const a = Math.abs(parseNum(tok));
        if (a > 0 && a < 1.5) candidatos.push(a);         // desviaciones (excluye relaciones ≥1.5)
      }
    }
    if (candidatos.length) {
      desviacion_pct = Math.round(Math.max(...candidatos) * 100) / 100;
      traza.desviacion = `${desviacion_pct}% (tabla %dif · ${candidatos.length} valores)`;
    }
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
  // (a) GΩ directo (global). MÍN de todos los "NUM gω", saltando los
  //     valores que son umbral/referencia (precedidos de signo > < ≥
  //     o de palabras "minimo"/"maximo").
  const reG = new RegExp(`([<>≥])?\\s*${NUM}\\s*g\\s*(?:ohm|ω)`, 'gi');
  const valsG = [];
  let mg;
  while ((mg = reG.exec(texto)) != null) {
    if (mg[1]) continue; // signo de comparación → es umbral
    const prev = texto.slice(Math.max(0, mg.index - 16), mg.index);
    if (/minim|maxim/.test(prev)) continue; // "(valor minimo 1gω)"
    const v = parseNum(mg[2]);
    if (v != null && v >= 0 && v < 100000) valsG.push(v);
  }
  if (valsG.length) { gohm = Math.min(...valsG); traza.aislamiento = `${gohm} GΩ (mín de ${valsG.length})`; }
  // (b) Tabla "aislamiento en gω … 1 min NUM NUM" (Omicron): MÍN del
  //     primer número tras cada "min".
  if (gohm == null && /aislamiento\s+en\s+g\s*(?:ohm|ω)/i.test(texto)) {
    const reMin = new RegExp(`\\bmin\\s+${NUM}\\s+${NUM}`, 'gi');
    const valsM = [];
    let mm;
    while ((mm = reMin.exec(texto)) != null) {
      const v = parseNum(mm[1]);
      if (v != null && v >= 0 && v < 100000) valsM.push(v);
    }
    if (valsM.length) { gohm = Math.min(...valsM); traza.aislamiento = `${gohm} GΩ (mín tabla, ${valsM.length})`; }
  }
  // (c) Fallback MΩ → GΩ.
  if (gohm == null) {
    const m = texto.match(new RegExp(
      `(?:resistencia de aislamiento|aislamiento|insulation resistance|megger)[^\\d\\n]{0,40}?${NUM}\\s*m\\s*(?:ohm|ω)`, 'i'));
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
  // Región: 700 chars tras la ÚLTIMA mención de collar.
  const reCol = /collar caliente|hot collar|\bcollar\b/gi;
  let lastCol = -1;
  let mc;
  while ((mc = reCol.exec(texto)) != null) lastCol = mc.index;
  const region = lastCol >= 0 ? texto.slice(lastCol, lastCol + 700) : '';
  // (a) Valores en mW explícitos → máx.
  const mws = [...region.matchAll(new RegExp(`${NUM}\\s*m\\s*w\\b`, 'gi'))]
    .map((x) => parseNum(x[1])).filter((v) => v != null && v >= 0 && v < 100000);
  if (mws.length) { mw = Math.max(...mws); traza.collar = `${mw} mW (máx de ${mws.length})`; }
  // (b) Tabla Watts: capturar la corrida de números tras "(mA )?watts".
  if (mw == null) {
    const mh = region.match(new RegExp(`(m\\s*a\\s+)?watts\\b([\\s\\S]{0,260})`, 'i'));
    if (mh) {
      const combinado = !!mh[1]; // "mA watts …" → mitad corriente + mitad watts
      const cuerpo = mh[2];
      // Corrida de tokens numéricos; corta al primer no-numérico.
      const toks = cuerpo.trim().split(/\s+/);
      const run = [];
      for (const tk of toks) { if (esTokenNumerico(tk)) run.push(parseNum(tk)); else break; }
      let watts = run.filter((v) => v != null);
      if (combinado && watts.length >= 4 && watts.length % 2 === 0) {
        watts = watts.slice(watts.length / 2); // 2ª mitad = watts
      }
      const validos = watts.filter((v) => v >= 0 && v < 100000);
      if (validos.length) {
        const wmax = Math.max(...validos);
        mw = Math.round(wmax * 1000 * 100) / 100;
        traza.collar = `${mw} mW (de ${wmax} W, ${validos.length} valores)`;
      }
    }
  }
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
