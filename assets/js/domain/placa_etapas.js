// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: potencias de PLACA por devanado (ONAN / ONAF) · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): «valida las potencias, recuerda que todo es con base a la placa; me gustaría que en
// las gráficas ubiques umbrales de potencia ONAN y ONAF». Las potencias por devanado salen de la LECTURA de la placa
// (`placas_caracteristicas`, ADR-166), nunca de la ampacidad de la plataforma:
//   · dos devanados: las etapas del equipo (`etapas_kva`) valen para los dos;
//   · tres devanados: se leen del texto de potencias de la placa, que viene escrito de muchas formas («AT 30,0/40,0; MT
//     12,0/16,0; BT 24,0/32,0», «ONAN 24000/9000/21000 kVA», «18/8/14 MVA OA», «5-2-3/7-3-4»…). Comprobación: el primario
//     leído debe ser el de las etapas del equipo; si no cuadra, o un devanado no se entiende, queda «sin dato» (no se inventa).
// En cada devanado: las etapas en kVA ordenadas (la menor es ONAN; la mayor, la de todos los ventiladores) y la corriente de
// cada etapa a la tensión de placa de su conexión. Funciones PURAS. Archivo NUEVO (L-102). Los ejemplos de formato de este
// archivo y de su prueba son SINTÉTICOS (misma forma de escritura, cifras inventadas): el repo es público.
// ══════════════════════════════════════════════════════════════

import { tensionesPlaca, corrientesA } from './placa_caracteristica.js';

const R3 = Math.sqrt(3);
const ETAPAS = ['ONAN', 'ONAF1', 'ONAF2'];
const KV_PLATAFORMA = { P: 'tension_primaria_kv', S: 'tension_secundaria_kv', T: 'tension_terciaria_kv' };
const NOMBRE_DEV = { P: 'primario', S: 'secundario', T: 'terciario' };
const COMPENSACION = /compensaci[oó]n|estabilizaci[oó]n|no\s+cargable/i;
// Marcas de la FUENTE de la lectura, escritas en sus notas al cotejarla con los archivos (2026-10-23).
const MARCA_PLANO = /\[documento: plano del fabricante\]/i;
const MARCA_FUTURO = /\[equipo FUTURO\]/i;

/**
 * La corriente que la placa IMPRIME para una etapa, si la trae: se busca entre las corrientes escritas en la lectura (la
 * tensión del devanado, las notas y el texto de potencias) la que cuadra con la calculada — a ±0,6 % o, si la placa la graba
 * en entero, a medio amperio. Una toma distinta de la nominal cae fuera (difiere ≥ 1 %). Sin coincidencia → null.
 */
function impresaDe(calc, impresas) {
  let mejor = null;
  for (const v of impresas) {
    const dif = Math.abs(v - calc);
    if ((dif <= 0.006 * calc || (Number.isInteger(v) && dif <= 0.5)) && (mejor == null || dif < Math.abs(mejor - calc))) mejor = v;
  }
  return mejor;
}

/** Etapas del equipo de la placa ({ONAN, ONAF1, ONAF2…} kVA) → lista ascendente de kVA. */
function etapasEquipo(datos) {
  const e = (datos && datos.etapas_kva) || {};
  return [...new Set(Object.values(e).map(Number).filter((v) => Number.isFinite(v) && v > 0))].sort((a, b) => a - b);
}

// Números del texto con su posición: «22,5» · «45 000» · «12.500» y «31.250» (punto de miles: ≥ 10.000) · «2.500» y «40.0»
// (decimales).
function numerosCon(texto) {
  const out = [];
  const re = /\d{1,3}(?:[ \u00a0]\d{3})+(?![\d,.])|\d+(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(texto))) {
    let s = m[0].replace(/[ \u00a0]/g, '');
    if (/^\d{1,3}\.\d{3}$/.test(s) && Number(s.replace('.', '')) >= 10000) s = s.replace('.', '');
    out.push({ v: Number(s.replace(',', '.')), i: m.index, f: m.index + m[0].length });
  }
  return out;
}
/** Valor → kVA (los MVA vienen por debajo de 1.000; los kVA de un devanado de potencia, por encima). */
const aKva = (v) => (v < 1000 ? v * 1000 : v);
const cerca = (a, b, tol = 0.012) => a > 0 && b > 0 && Math.abs(a - b) / b <= tol;

// Rótulos de devanado. «BT» es el secundario cuando no hay «MT» (AT/BT/TERC) y el terciario cuando sí lo hay (AT/MT/BT).
const ROTULOS = [
  { k: 'AT', re: /alta\s+tensi[oó]n|\bA\.\s?T\.|\bAT\b|\bprimario\b|\b1N\b/gi },
  { k: 'MT', re: /media\s+tensi[oó]n|\bM\.\s?T\.|\bMT\b|\bsecundario\b|\bsegundario\b|\bBT1\b|\b2N\b/gi },
  { k: 'BT', re: /baja\s+tensi[oó]n|\bB\.\s?T\.|\bBT\b(?![12])/gi },
  { k: 'TE', re: /\bterciario\b|\bterc\b\.?|\bBT2\b|\bLV\b|\b3[RU]\b/gi }
];

/** Estrategia A: grupos de cifras tras cada rótulo de devanado. */
function porRotulo(texto) {
  const marcas = [];
  for (const { k, re } of ROTULOS) { re.lastIndex = 0; let m; while ((m = re.exec(texto))) marcas.push({ k, i: m.index, f: m.index + m[0].length }); }
  marcas.sort((a, b) => a.i - b.i);
  // Una marca por rótulo: la primera que tenga cifras propias (las de «(AT/MT/BT)» al final no traen cifras).
  const nums = numerosCon(texto);
  const grupos = {};
  marcas.forEach((m, j) => {
    if (grupos[m.k]) return;
    const fin = j + 1 < marcas.length ? marcas[j + 1].i : texto.length;
    const tramo = texto.slice(m.f, fin);
    if (/^\s*(y|e)\s/i.test(tramo)) return;                       // «primario y secundario»: comparte las cifras de otro
    const vals = nums.filter((n) => n.i >= m.f && n.f <= fin).map((n) => n.v)
      .filter((v) => !(v === 110 || v === 34.5 || v === 13.8 || v === 66 || v === 115 || v === 13.2 || v === 1 || v === 2 || v === 3));
    if (vals.length >= 2) grupos[m.k] = vals;
  });
  const hayMT = !!grupos.MT;
  const P = grupos.AT || null;
  const S = hayMT ? grupos.MT : (grupos.BT || null);
  const T = hayMT ? (grupos.BT || grupos.TE || null) : (grupos.TE || null);
  return { P, S, T };
}

/** Estrategia B: una terna por etapa («ONAN 24000/9000/21000», «18/8/14 MVA OA», «ONAF 1: AT 44000 / BT 22000 / Terc. 26000»). */
function porEtapa(texto) {
  const nums = numerosCon(texto).filter((n) => !(n.v === 110 || n.v === 34.5 || n.v === 13.8 || n.v === 66 || n.v === 115));
  // Ternas: tres cifras seguidas separadas solo por «/», «-», espacios, rótulos cortos o paréntesis.
  const ternas = [];
  for (let j = 0; j + 2 < nums.length; j++) {
    const a = nums[j]; const b = nums[j + 1]; const c = nums[j + 2];
    const s1 = texto.slice(a.f, b.i); const s2 = texto.slice(b.f, c.i);
    const sep = (s) => s.length <= 22 && /^[\s/\-·:()A-Za-zÁÉÍÓÚáéíóú.]*$/.test(s) && /[/\-]|\bBT\b|\bTerc|\bMT\b/i.test(s) && !/;/.test(s);
    if (sep(s1) && sep(s2)) { ternas.push([a.v, b.v, c.v]); j += 2; }
  }
  if (ternas.length < 2) return null;
  // Cada terna es una etapa (P, S, T en orden); por devanado, sus valores de las distintas etapas.
  return { P: ternas.map((t) => t[0]), S: ternas.map((t) => t[1]), T: ternas.map((t) => t[2]) };
}

/** Estrategia C: «5-2-3/7-3-4». */
function porGuiones(texto) {
  const m = texto.match(/(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = m.slice(1).map((x) => Number(x.replace(',', '.')));
  return { P: [v[0], v[3]], S: [v[1], v[4]], T: [v[2], v[5]] };
}

const etapasDe = (vals) => (vals && vals.length >= 2 ? [...new Set(vals.map(aKva))].sort((a, b) => a - b) : null);

/** Estrategia D: «AT-MT-BT 21000/28000 14000/18000 7000/9000 kVA». */
function porParesSeguidos(texto) {
  const m = texto.match(/AT\s*[-/]\s*MT\s*[-/]\s*BT\s+([\d.,]+)\s*\/\s*([\d.,]+)\s+([\d.,]+)\s*\/\s*([\d.,]+)\s+([\d.,]+)\s*\/\s*([\d.,]+)/i);
  if (!m) return null;
  const v = m.slice(1).map((x) => numerosCon(x)[0].v);
  return { P: [v[0], v[1]], S: [v[2], v[3]], T: [v[4], v[5]] };
}

/** La potencia escrita junto a la tensión del devanado: «13800 V (2,5/3 MVA)» · «… 4500/6000 kVA». */
function deLaTension(t) {
  const m = String(t || '').match(/(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)\s*(kVA|MVA)/i);
  if (!m) return null;
  const a = numerosCon(m[1])[0]; const b = numerosCon(m[2])[0];
  if (!a || !b) return null;
  const k = /MVA/i.test(m[3]) ? 1000 : 1;
  return [a.v * k, b.v * k].sort((x, y) => x - y);
}

/** Si el texto trae VARIAS placas («Placa 115 kV: … Placa 66 kV: …»), el tramo de la que corresponde a la tensión del equipo. */
function tramoDeLaPlaca(texto, kvPrimario) {
  const partes = [...texto.matchAll(/placa\s+(\d+(?:[.,]\d+)?)\s*kV\s*:/gi)];
  if (partes.length < 2 || !kvPrimario) return texto;
  let mejor = 0; let dif = Infinity;
  partes.forEach((p, k) => { const d = Math.abs(Number(p[1].replace(',', '.')) - kvPrimario); if (d < dif) { dif = d; mejor = k; } });
  const ini = partes[mejor].index; const fin = mejor + 1 < partes.length ? partes[mejor + 1].index : texto.length;
  return texto.slice(ini, fin) + ' ' + (texto.match(/\(cifras[^)]*\)/i) || [''])[0];
}

/**
 * Potencias de placa por devanado.
 * @param {object} datos  `placas_caracteristicas/{id}.datos`
 * @param {{tres?: boolean, kvPrimario?: number}} opc  el equipo tiene terciario (en la plataforma) y su tensión primaria
 * @returns {{P: number[]|null, S: number[]|null, T: number[]|null, fuente: 'etapas'|'texto'|'sin_dato', nota: string|null}}
 *   cada devanado: kVA ascendentes (ONAN primero) o null si la placa leída no lo trae de forma legible
 */
export function etapasPorDevanado(datos, { tres = false, kvPrimario = null } = {}) {
  const eq = etapasEquipo(datos);
  if (!eq.length) return { P: null, S: null, T: null, fuente: 'sin_dato', nota: 'la placa leída no trae sus etapas de potencia' };
  if (!tres) return { P: eq, S: eq, T: null, fuente: 'etapas', nota: null };
  // Se quitan las tensiones y porcentajes entre paréntesis que interrumpen las cifras: «24000 (110 kV) / 15000 (34,5 kV)».
  const crudo = tramoDeLaPlaca(String((datos && datos.potencias_texto) || ''), kvPrimario);
  const texto = crudo.replace(/\(\s*\d+(?:[.,]\d+)?\s*(?:kV|%)\s*\)/gi, ' ');
  const tension = (datos && datos.tension) || {};
  const comparte = /(primario|alta(\s+tensi[oó]n)?)\s+y\s+(secundario|media\s+tensi[oó]n)/i.test(texto);
  const compensa = /compensaci[oó]n/i.test(String(tension.T || '') + ' ' + texto);
  let mejor = null;
  for (const r of [porParesSeguidos(texto), porGuiones(texto), porRotulo(texto), porEtapa(texto)].filter(Boolean)) {
    const P = etapasDe(r.P) || eq;
    if (!cerca(P[P.length - 1], eq[eq.length - 1])) continue;       // el primario leído debe ser el del equipo
    const cand = { P, S: etapasDe(r.S), T: etapasDe(r.T) };
    if (cand.S && cand.T) { mejor = cand; break; }
    if (!mejor) mejor = cand;
  }
  const P = (mejor && mejor.P) || eq;
  let S = (mejor && mejor.S) || null; let T = (mejor && mejor.T) || null;
  if (!S && comparte) S = P;
  if (!S) S = deLaTension(tension.S);
  if (!T) T = deLaTension(tension.T);
  const faltan = [!S && 'secundario', !T && (compensa ? 'terciario (de compensación)' : 'terciario')].filter(Boolean);
  return { P, S, T, fuente: S || T ? 'texto' : 'etapas',
    nota: faltan.length ? 'la placa leída no trae de forma legible la potencia del ' + faltan.join(' ni del ') : null };
}

/**
 * La tensión de placa (kV) que corresponde a la conexión del devanado. La placa puede nombrar varias: línea y fase
 * («13800/7967 V», «115000GrdY/66395 V», «12470Y/7200 V»), o dos conexiones («Y 115 000 V – Δ 66 400 V», «115 kV … (religable
 * a 69 kV …)», «reconectable a 69 kV»). Se toma la que esté a menos del 10 % de la tensión del equipo en la plataforma; si
 * ninguna lo está (o la plataforma no la trae), la primera de línea que nombra la placa. Nunca la de FASE de otra que
 * también nombra (la de línea ÷ √3). Antes se normalizan la tolerancia del cambiador escrita entre la cifra y la unidad
 * («66,0 +5/-19x0,96% kV») y los miles con espacio y decimales con coma («7 621,023 V»). Sin tensión legible → null.
 * Nota: si la plataforma registra una tensión que la placa solo nombra como conexión alternativa tras « / », se toma la
 * primera (la medida del SCADA lo confirmó en el único caso del parque: la relación de corrientes era la de la primera).
 * @param {string} texto          tensión del devanado en la placa leída
 * @param {number|null} kvPlataforma  tensión del devanado en la plataforma (kV)
 * @returns {number|null}
 */
export function kvDePlaca(texto, kvPlataforma = null) {
  const s = String(texto || '')
    .replace(/(\d{1,3})[ \u00a0](\d{3}),(\d+)/g, '$1$2.$3')
    .replace(/(\d)\s*[+±]\s*\d+\s*(?:\/\s*[-−–]\s*\d+)?\s*[x×]\s*[\d.,]+\s*%\s*(?=k?V\b)/gi, '$1 ');
  const deLinea = [...s.matchAll(/(\d{4,6}(?:[.,]\d+)?)\s*(?:GrdY|Y)\s*\//gi)].map((m) => Number(m[1].replace(',', '.')) / 1000);
  const alternas = [...s.matchAll(/(?:religable|reconectable|conexi[oó]n\s+alternativa)\s*(?:a\s*)?(\d+(?:[.,]\d+)?)\s*kV/gi)]
    .map((m) => Number(m[1].replace(',', '.')));
  // Fuera la tensión de FASE escrita como par «línea/fase» de la MISMA conexión («13800/7967 V», «115000GrdY/66395 V»). Una
  // conexión Y–Δ reconectable («Y 115 000 V – Δ 66 400 V») también guarda √3 entre sus dos tensiones, pero no va en par «/».
  const fase = [];
  for (const m of s.matchAll(/(\d[\d.,]*)\s*(?:GrdY|Y)?\s*\/\s*(\d[\d.,]*)\s*(kV|V)\b/gi)) {
    const [a, b] = [m[1], m[2]].map((x) => (numerosCon(x)[0] || {}).v);
    const k = /k/i.test(m[3]) ? 1 : 1 / 1000;
    if (a > 0 && b > 0 && Math.abs(a / R3 / b - 1) < 0.015) fase.push(b * k);
  }
  const cands = [...deLinea, ...(tensionesPlaca(s).nominal || []), ...alternas]
    .filter((v) => v > 0.1 && !fase.some((f) => Math.abs(v / f - 1) < 0.002));
  if (!cands.length) return null;
  const ref = Number(kvPlataforma) || 0;
  if (ref > 0) {
    const cerca = cands.filter((v) => Math.abs(v / ref - 1) <= 0.1).sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref));
    if (cerca.length) return cerca[0];
  }
  return cands[0];
}

/**
 * Límites de placa de cada devanado para las gráficas: etapas (kVA) y su corriente a la tensión de placa de su conexión
 * (`kvDePlaca`).
 * @param {object|null} placa  `{datos}` de la placa leída
 * @param {object} tx          transformador (para saber si tiene terciario y su número de fases)
 * @returns {{P?: object, S?: object, T?: object, nota: string|null, documento: 'plano'|'placa', futuro: boolean}}  por devanado:
 *   {kva: [..], nombres: [..], kv, A: [..], origenA: ['impresa'|'calculada'…], kvPlataforma, difKv (la tensión de placa no
 *   es la de la plataforma, más del 5 %), compensa (terciario de compensación/estabilización: SIN límite de carga →
 *   `sinLimite`, A null)}; `nota` explica lo que la placa no trae legible (ese devanado usa la plataforma). `A` = la corriente
 *   IMPRESA cuando la placa la trae y coincide; si no, la calculada (kVA / (√3·kV)). `documento`/`futuro`: la lectura viene de
 *   un plano del fabricante o de la placa de un equipo marcado «futuro» (marcas en las notas).
 */
export function limitesDePlaca(placa, tx) {
  const datos = (placa && placa.datos) || null;
  const e = (tx && tx.electrico) || {};
  const tres = !!(e.tension_terciaria_kv);
  const r = etapasPorDevanado(datos, { tres, kvPrimario: Number(e.tension_primaria_kv) || null });
  const mono = Number((datos && datos.fases) || e.fases) === 1;
  const notas = String((datos && datos.notas) || '');
  const out = { nota: r.nota, fuente: r.fuente, documento: MARCA_PLANO.test(notas) ? 'plano' : 'placa', futuro: MARCA_FUTURO.test(notas) };
  const tension = (datos && datos.tension) || {};
  const sinTension = [];
  for (const d of ['P', 'S', 'T']) {
    const kva = r[d];
    const compensa = d === 'T' && COMPENSACION.test(String(tension.T || ''));
    // Terciario de compensación: la placa no le da carga → sin límite (aunque el protocolo traiga su potencia térmica).
    if (compensa) { out.T = { kva: null, nombres: [], kv: kvDePlaca(tension.T, Number(e[KV_PLATAFORMA.T]) || null), A: null, origenA: [],
      kvPlataforma: Number(e[KV_PLATAFORMA.T]) || null, difKv: false, compensa: true, sinLimite: true }; continue; }
    if (!kva) continue;
    const kvPlat = Number(e[KV_PLATAFORMA[d]]) || null;
    const kv = kvDePlaca(tension[d], kvPlat);
    if (!kv) sinTension.push(NOMBRE_DEV[d]);
    // Monofásico: la placa da la tensión de fase y la plataforma la de línea (13,8 kV ↔ 7,967 kV): no es diferencia.
    const fase = mono && kv && kvPlat && Math.abs(kv * R3 / kvPlat - 1) < 0.02;
    const calc = kv ? kva.map((s) => (mono ? s / kv : s / (R3 * kv))) : null;
    // Las corrientes que la lectura trae escritas: primero las de la tensión del devanado, luego notas y potencias.
    const impresas = [tension[d], notas, datos && datos.potencias_texto].flatMap((x) => corrientesA(String(x || '')));
    const imp = calc ? calc.map((c) => impresaDe(c, impresas)) : null;
    out[d] = {
      kva, nombres: kva.map((_, k) => (kva.length === 1 ? 'ONAN' : ETAPAS[Math.min(k, ETAPAS.length - 1)])), kv,
      A: calc ? calc.map((c, k) => (imp[k] != null ? imp[k] : c)) : null,
      origenA: calc ? imp.map((v) => (v != null ? 'impresa' : 'calculada')) : [],
      kvPlataforma: kvPlat, difKv: !!(kv && kvPlat && !fase && Math.abs(kv / kvPlat - 1) > 0.05),
      compensa: false
    };
  }
  if (sinTension.length) {
    out.nota = [out.nota, 'la placa leída no trae legible la tensión del ' + sinTension.join(' ni del ')].filter(Boolean).join('; ');
  }
  return out;
}
