// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Panel de Corriente de Excitación
// ──────────────────────────────────────────────────────────────
// Vista ÚNICA y CONDENSADA de la corriente de excitación (espejo del panel
// tan δ, ADR-029). Un informe puede traer VARIOS bloques de excitación medidos
// a distinto NIVEL DE TENSIÓN (devanado + tensión de prueba: AT·66 kV, AT·10 kV,
// MT·34.5 kV) — cada nivel se evalúa con el MISMO criterio (IEEE Std 62: Δ entre
// fases externas < 10% si I<50 mA / < 5% si I≥50 mA) y el patrón 2+1 del núcleo.
//
// Panel de filtros (año/informe · grupo de conexión · NIVEL DE TENSIÓN · fase) y
// tres vistas:
//   · PATRÓN DE FASES (eje X = fase A/B/C): barras por informe — muestra la forma
//     del patrón (HLH estrella / LHL delta) y deja comparar informes.
//   · TENDENCIA año tras año (eje X = informe): barras por fase — la misma fase
//     alineada entre años detecta deriva de UNA fase (espira) vs subida UNIFORME
//     (magnetismo residual / núcleo).
//   · POR NIVEL DE TENSIÓN (eje X = nivel): Δ entre externas vs guía 5% / límite 10%.
//
// Sin estado global; el estado de filtros vive en la closure. DOM puro. Helpers
// puros y testeables: `nivelDe`, `evaluarPatron`, `analizarExcitacion`.
// El criterio normativo se REUTILIZA de `pruebas_electricas_semaforo.js` (misma
// fuente de verdad que el scorecard) — no se duplica el umbral.
// ══════════════════════════════════════════════════════════════

import { UMBRALES } from '../../domain/pruebas_electricas_semaforo.js';

const U = UMBRALES.excitacion; // { corrienteUmbralMA, deltaBajaCorriente, deltaAltaCorriente, limite, guia }

// Paleta EJECUTIVA / gerencial (igual que el panel tan δ).
const COLORES = ['#1f3a5f', '#2c6e72', '#6d597a', '#a4694f', '#46734b', '#5d6d7e', '#7a5c4b', '#355c7d', '#4a7c59', '#8c5a6e'];
// Color por FASE (estable entre vistas): A / B (central) / C.
const COL_FASE = { A: '#1f3a5f', B: '#a4694f', C: '#2c6e72' };
// Catálogo MULTI-NORMA de la excitación (emblemas ESTILIZADOS propios, no logos
// oficiales). NETA fija el criterio CUALITATIVO de patrón; IEEE el comparativo.
const NORMAS_EXC = [
  { id: 'neta', acron: 'NETA', nom: 'ANSI/NETA', sub: 'ATS §7.2.2.D.6', criterio: 'patrón 2+1', color: '#2c6e72' },
  { id: 'ieee', acron: 'IEEE', nom: 'IEEE', sub: 'Std 62 / C57.152', criterio: `Δ ext ≤ ${U.guia}–${U.limite}%`, color: '#1f3a5f' },
];
const CRIT = { guia: U.guia, limite: U.limite, norma: 'IEEE Std 62 / C57.152' };

const ORDEN_FASE = ['A', 'B', 'C'];
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null));
const round = (v, d = 2) => { const f = 10 ** d; return Math.round(v * f) / f; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

// ── Helpers de dominio (puros, testeables) ───────────────────────

// Nivel de tensión de un bloque de excitación = DEVANADO + su tensión NOMINAL.
// OJO: el "kV" del título es ambiguo — a veces es la tensión de PRUEBA (excitación
// aplicada, típico 10 kV) y a veces la NOMINAL del devanado. La nominal real se
// deriva del DEVANADO + el GRUPO VECTORIAL (config): trafo móvil 110/34.5/13.8
// (estrella) ó 66/34.5/13.8 (delta). El kV ≤ ~20 del título se interpreta como
// tensión de ensayo (condición), no como identidad del nivel.
// "AT por TAP - 66 kV" + delta    → { dev:'AT', kv:66,   testKv:null, label:'AT · 66 kV' }
// "AT por TAP - 10 kV" + estrella → { dev:'AT', kv:110,  testKv:10,   label:'AT · 110 kV' }
// "MT por TAP - 34.5 kV"          → { dev:'MT', kv:34.5, testKv:null, label:'MT · 34.5 kV' }
export function nivelDe(titulo, config) {
  const t = String(titulo || '');
  const md = t.match(/\b(AT|MT|BT|terciario|terc)\b/i);
  let dev = md ? md[1].toUpperCase() : 'AT';
  if (/^TERC/.test(dev)) dev = 'Terciario';
  const mk = t.match(/([\d.]+)\s*kV/i);
  const tituloKv = mk ? parseFloat(mk[1]) : null;
  const esDelta = /delta/i.test(config || '');
  const esEstrella = /estrella|wye|star/i.test(config || '');
  const esEnsayo = tituloKv != null && tituloKv <= 20; // 10 kV ⇒ tensión de prueba
  let kv = null, testKv = esEnsayo ? tituloKv : null;
  if (dev === 'AT') kv = esDelta ? 66 : esEstrella ? 110 : (esEnsayo ? null : tituloKv);
  else if (dev === 'MT') kv = esEnsayo ? 34.5 : (tituloKv ?? 34.5);
  else if (dev === 'BT' || dev === 'Terciario') kv = esEnsayo ? 13.8 : (tituloKv ?? 13.8);
  else kv = esEnsayo ? null : tituloKv;
  return { dev, kv, testKv, label: kv != null ? `${dev} · ${kv} kV` : dev };
}

// Lecturas {A,B,C} (mA) de un bloque de excitación para un TAP dado (o agregadas:
// promedio por fase si el bloque tiene varias posiciones de TAP). Las series son
// "Fase A/B/C"; los puntos {x:TAP, y:mA}.
export function fasesDe(bloque, tap) {
  const out = {};
  (bloque.series || []).forEach((s) => {
    const letra = (String(s.nombre).match(/\b([ABC])\b/) || [])[1] || (String(s.nombre).match(/Fase\s*([A-Z])/i) || [])[1];
    if (!letra) return;
    const pts = (s.puntos || []).filter((p) => num(p.y) != null && (tap == null || String(p.x) === String(tap)));
    if (!pts.length) return;
    out[letra.toUpperCase()] = pts.reduce((a, p) => a + num(p.y), 0) / pts.length;
  });
  return out;
}

// Pérdidas (W) {A,B,C} de un bloque de excitación para un TAP dado. La potencia
// vive en el `extra` de cada punto (clave "P (W)" en los informes reales; se
// aceptan variantes). I_exc = I_magnetizante + I_pérdidas (histéresis + Foucault):
// la potencia es la COMPONENTE resistiva del ensayo — sin umbral duro propio, se
// juzga por COMPARACIÓN (vs fábrica / ensayos previos / fases hermanas), igual que
// la corriente (skill 01-teoria / 03-criterios). Devuelve {} si el informe no la trae.
const KEYS_W = ['P (W)', 'P(W)', 'P (w)', 'Pérdidas (W)', 'Perdidas (W)', 'W', 'Pérdidas', 'Perdidas'];
function wattDe(extra) {
  if (!extra) return null;
  for (const k of KEYS_W) { if (extra[k] != null && num(extra[k]) != null) return num(extra[k]); }
  const hit = Object.keys(extra).find((k) => /\bW\b|p[eé]rdid/i.test(k) && num(extra[k]) != null);
  return hit ? num(extra[hit]) : null;
}
export function perdidasDe(bloque, tap) {
  const out = {};
  (bloque.series || []).forEach((s) => {
    const letra = (String(s.nombre).match(/\b([ABC])\b/) || [])[1] || (String(s.nombre).match(/Fase\s*([A-Z])/i) || [])[1];
    if (!letra) return;
    const ws = (s.puntos || [])
      .filter((p) => (tap == null || String(p.x) === String(tap)))
      .map((p) => wattDe(p.extra)).filter((w) => w != null);
    if (ws.length) out[letra.toUpperCase()] = ws.reduce((a, w) => a + w, 0) / ws.length;
  });
  return out;
}

// TAPs distintos presentes en un bloque de excitación (ordenados numéricamente).
export function tapsDe(bloque) {
  const set = new Set();
  (bloque.series || []).forEach((s) => (s.puntos || []).forEach((p) => { if (num(p.y) != null) set.add(String(p.x)); }));
  return [...set].sort((a, b) => (num(a) ?? 0) - (num(b) ?? 0));
}

// Evalúa el patrón 2+1 de un trío de fases (mA). Externas = A y C (columnas
// laterales); central = B (columna central). El patrón SANO es 2+1: las dos
// externas similares + la central distinta. En un núcleo de 3 columnas la central
// suele ser la MENOR (HLH) porque su camino magnético es el más corto — y eso lo
// gobierna la GEOMETRÍA del núcleo, NO la conexión: en esta unidad real la central
// es la menor tanto en estrella como en delta (verificado, datos 450108). Por eso
// el criterio de APROBACIÓN es la FORMA 2+1 (externas simétricas + central como
// extremo distinto); la dirección HLH/LHL vs la conexión es solo INFORMATIVA.
// Simetría entre externas = el MISMO umbral del scorecard (IEEE Std 62, según I).
// @returns {null|{A,B,C,deltaExt,ratioCentral,corrMax,admisible,externasSimilares,patron,formaOk,dirEsperada,dirCoincide,ok,estado,faseAlta}}
export function evaluarPatron(fases, config) {
  const A = num(fases && fases.A), B = num(fases && fases.B), C = num(fases && fases.C);
  if (A == null || B == null || C == null) return null;
  const promExt = (A + C) / 2;
  const deltaExt = promExt ? Math.abs(A - C) / promExt * 100 : 0;
  const ratioCentral = promExt ? B / promExt * 100 : 0;
  const corrMax = Math.max(A, B, C);
  const admisible = corrMax >= U.corrienteUmbralMA ? U.deltaAltaCorriente : U.deltaBajaCorriente;
  const externasSimilares = deltaExt <= admisible;
  const esDelta = /delta/i.test(config || '');
  const esEstrella = /estrella|wye|star/i.test(config || '');
  const centralEsMenor = B < A && B < C;
  const centralEsMayor = B > A && B > C;
  const formaOk = centralEsMenor || centralEsMayor; // 2+1 presente: central es el extremo distinto
  const patron = centralEsMenor ? 'HLH' : centralEsMayor ? 'LHL' : 'plano';
  const dirEsperada = esEstrella ? 'HLH' : esDelta ? 'LHL' : null; // referencia de libro
  const dirCoincide = dirEsperada ? patron === dirEsperada : true;
  const ok = externasSimilares && formaOk; // dirección NO entra al criterio
  const faseAlta = A >= C ? 'A' : 'C'; // externa más alta (candidata a espira si rompe)
  return {
    A, B, C, deltaExt: round(deltaExt), ratioCentral: round(ratioCentral), corrMax: round(corrMax),
    admisible, externasSimilares, patron, formaOk, dirEsperada, dirCoincide, ok,
    estado: ok ? 'ok' : (!externasSimilares ? 'roto' : 'plano'), faseAlta,
  };
}

// Causa probable + corroboración para un patrón evaluado (skill 04-diagnostico).
export function causaPatron(ev, tendNivel) {
  if (!ev) return '';
  if (!ev.externasSimilares) {
    return `externas ${ev.faseAlta === 'A' ? 'A>C' : 'C>A'} desbalanceadas (Δ=${ev.deltaExt}%): posible espira en cortocircuito en la fase alta — corroborar con relación (TTR) y resistencia de devanados; defecto de núcleo si la TTR está OK`;
  }
  if (!ev.formaOk) return 'patrón plano (la central NO se distingue de las externas): se pierde el 2+1 esperado — verificar conexión/desmagnetización antes de medir';
  if (tendNivel && tendNivel.uniforme) return 'las 3 fases suben uniformemente vs baseline: probable magnetismo residual (desmagnetizar y repetir) o cambio global de núcleo';
  if (tendNivel && tendNivel.unaFase) return `solo ${tendNivel.unaFase} se aparta del baseline: vigilar esa fase — cruzar con TTR y R de devanados`;
  return 'patrón 2+1 coherente y externas simétricas: sano';
}

// Análisis MULTI-NORMA de la excitación a partir de las mediciones VISIBLES.
// `medsVis` = [{ rep, nivel, tap, fases:{A,B,C}, ev }]. Puro, no toca el DOM.
export function analizarExcitacion(medsVis) {
  const M = (medsVis || []).filter((m) => m.ev);
  if (!M.length) return null;
  const peor = M.reduce((a, b) => (b.ev.deltaExt > a.ev.deltaExt ? b : a));
  const okPatron = M.filter((m) => m.ev.ok).length;
  const okIeee = M.filter((m) => m.ev.externasSimilares).length;
  const porNorma = [
    { nm: NORMAS_EXC[0], cumplen: okPatron, superan: M.length - okPatron, total: M.length },
    { nm: NORMAS_EXC[1], cumplen: okIeee, superan: M.length - okIeee, total: M.length },
  ];
  // Tendencia por nivel: corriente media por fase del baseline (informe + antiguo) al último.
  const niveles = [...new Set(M.map((m) => m.nivel))];
  const tendencias = niveles.map((nivel) => {
    const serie = M.filter((m) => m.nivel === nivel);
    const porRep = [...new Map(serie.map((m) => [m.rep.id, m])).values()];
    if (porRep.length < 2) return { nivel, n: porRep.length };
    const ini = porRep[0].ev, fin = porRep[porRep.length - 1].ev;
    const camb = (a, b) => (a ? round((b - a) / a * 100) : null);
    const dA = camb(ini.A, fin.A), dB = camb(ini.B, fin.B), dC = camb(ini.C, fin.C);
    const cambios = [dA, dB, dC].filter((v) => v != null);
    const todasSuben = cambios.length === 3 && cambios.every((v) => v > 15);
    const uniforme = todasSuben && (Math.max(...cambios) - Math.min(...cambios) <= 10);
    const fuera = [['A', dA], ['B', dB], ['C', dC]].filter(([, v]) => v != null && Math.abs(v) > 15);
    const unaFase = fuera.length === 1 ? fuera[0][0] : null;
    // Pérdidas totales (W) del trío por informe (componente resistiva). null si ese
    // informe NO trae W — así no se compara contra 0 (evita falso Δ -100%).
    const wTot = (m) => { const fs = ORDEN_FASE.filter((f) => m.wfases && m.wfases[f] != null); return fs.length ? round(fs.reduce((a, f) => a + m.wfases[f], 0), 2) : null; };
    const wIni = wTot(porRep[0]), wFin = wTot(porRep[porRep.length - 1]);
    const dW = (wIni != null && wFin != null) ? camb(wIni, wFin) : null;
    const hayW = wIni != null && wFin != null;
    return { nivel, n: porRep.length, iniRep: porRep[0].rep, finRep: porRep[porRep.length - 1].rep, dA, dB, dC, uniforme, unaFase, todasSuben, wIni, wFin, dW, hayW };
  });
  // Localización del hallazgo: mediciones con patrón no-OK → causa probable.
  const hallazgos = M.filter((m) => !m.ev.ok)
    .sort((a, b) => b.ev.deltaExt - a.ev.deltaExt)
    .map((m) => ({ ...m, tend: tendencias.find((t) => t.nivel === m.nivel), causa: causaPatron(m.ev, tendencias.find((t) => t.nivel === m.nivel)) }));
  const baseline = niveles.map((nivel) => {
    const reps = [...new Map(M.filter((m) => m.nivel === nivel).map((m) => [m.rep.id, m.rep])).values()];
    return reps.length >= 2 ? { nivel, rep: reps[0] } : null;
  }).filter(Boolean);
  return { M, peor, porNorma, tendencias, hallazgos, baseline, niveles };
}

// ── UI ───────────────────────────────────────────────────────────

const chip = (txt, on, onClick, color) => {
  const b = document.createElement('button'); b.type = 'button';
  b.className = 'pe-fase-chip' + (on ? ' is-on' : ''); b.textContent = txt;
  if (color) b.style.setProperty('--c', color);
  b.dataset.k = txt;
  b.addEventListener('click', () => onClick(b)); return b;
};

function medallaNorma(color, acron) {
  const s = el('svg', { viewBox: '0 0 48 58', width: '44', height: '54', 'aria-hidden': 'true' });
  s.appendChild(el('path', { d: 'M17 39 L13 56 L24 50 L35 56 L31 39 Z', fill: color, opacity: '0.85' }));
  s.appendChild(el('circle', { cx: '24', cy: '22', r: '20', fill: '#fff', stroke: color, 'stroke-width': '2.5' }));
  s.appendChild(el('circle', { cx: '24', cy: '22', r: '15.5', fill: 'none', stroke: color, 'stroke-width': '1', opacity: '0.45' }));
  const t = el('text', { x: '24', y: '26', 'text-anchor': 'middle', 'font-size': acron.length > 4 ? '8.5' : '10.5', 'font-weight': '800', fill: color, 'font-family': 'system-ui, sans-serif' });
  t.textContent = acron; s.appendChild(t);
  return s;
}

function renderAnalisis(box, datos) {
  box.innerHTML = '';
  if (!datos) { box.innerHTML = '<p class="muted small">Sin mediciones de excitación para analizar con los filtros activos.</p>'; return; }
  const { M, peor, porNorma, tendencias, hallazgos, baseline } = datos;
  const card = document.createElement('div'); card.className = 'pe-analisis';
  const head = document.createElement('div'); head.className = 'pe-analisis-head';
  head.innerHTML = `<span>Análisis conforme a norma</span><span class="pe-analisis-n">${M.length} mediciones (informe×nivel) evaluadas</span>`;
  card.appendChild(head);
  // Sellos por norma.
  const sellos = document.createElement('div'); sellos.className = 'pe-sellos';
  porNorma.forEach(({ nm, cumplen, superan, total }) => {
    const c = document.createElement('div'); c.className = 'pe-sello-card'; c.style.setProperty('--c', nm.color);
    c.appendChild(medallaNorma(nm.color, nm.acron));
    const cls = superan === 0 ? 'ok' : (cumplen / total >= 0.8 ? 'warn' : 'bad');
    const info = document.createElement('div'); info.className = 'pe-sello-info';
    info.innerHTML =
      `<div class="pe-sello-nom">${esc(nm.nom)}</div>` +
      `<div class="pe-sello-sub">${esc(nm.sub)}</div>` +
      `<div class="pe-sello-crit">${esc(nm.criterio)}</div>` +
      `<div class="pe-sello-res pe-${cls}"><b>${cumplen}/${total}</b> cumplen${superan ? ` · ${superan} a revisar` : ''}</div>`;
    c.appendChild(info); sellos.appendChild(c);
  });
  card.appendChild(sellos);
  // Conclusión: peor caso.
  let nivel, frase;
  const rotos = M.filter((m) => !m.ev.ok).length;
  if (rotos === 0) { nivel = 'ok'; frase = 'Patrón 2+1 coherente y externas simétricas en todas las mediciones: excitación SANA (sin defecto evidente de núcleo ni espira).'; }
  else { nivel = peor.ev.deltaExt > peor.ev.admisible * 2 ? 'bad' : 'warn';
    frase = `${rotos} medición(es) con patrón fuera de criterio. La excitación SOLA = INVESTIGAR; se vuelve diagnóstico de espira en corto solo si converge con TTR desviada y/o R de devanados anómala (skill 04).`; }
  const concl = document.createElement('div'); concl.className = `pe-conclusion pe-${nivel}`;
  const l1 = document.createElement('div'); l1.className = 'pe-concl-frase'; l1.textContent = frase;
  const l2 = document.createElement('div'); l2.className = 'pe-concl-meta';
  l2.textContent = `Peor caso: Δ externas ${peor.ev.deltaExt}% (admisible ${peor.ev.admisible}% · I máx ${peor.ev.corrMax} mA) · ${peor.nivel} · ${peor.rep.label}${peor.rep.config ? ' (' + peor.rep.config + ')' : ''} · patrón ${peor.ev.patron}.`;
  concl.append(l1, l2); card.appendChild(concl);
  // Localización del hallazgo.
  const loc = document.createElement('div'); loc.className = 'pe-analisis-loc';
  if (hallazgos.length) {
    const items = hallazgos.slice(0, 5).map((x) =>
      `<li><b>${esc(x.nivel)}</b> · ${esc(x.rep.label)} — Δ ${x.ev.deltaExt}% (A=${x.ev.A}, B=${x.ev.B}, C=${x.ev.C} mA): ${esc(x.causa)}</li>`).join('');
    loc.innerHTML = `<div class="pe-loc-h">Localización del hallazgo — patrón fuera de criterio</div><ul>${items}</ul>`;
  } else {
    loc.innerHTML = `<div class="pe-loc-h">Localización</div><p>Ningún patrón roto: las externas se mantienen simétricas y la central conserva su posición. Excitación homogénea.</p>`;
  }
  card.appendChild(loc);
  // Tendencia por nivel (deriva de una fase vs subida uniforme).
  const tconDato = tendencias.filter((t) => t.n >= 2);
  if (tconDato.length) {
    const td = document.createElement('div'); td.className = 'pe-analisis-extra';
    const partes = tconDato.map((t) => {
      const dir = t.uniforme ? 'las 3 fases ↑ uniforme (posible magnetismo residual)' : t.unaFase ? `solo ${t.unaFase} se aparta (vigilar esa fase)` : 'estable / cambios menores';
      const wTxt = t.hayW ? ` · pérdidas Σ ${t.wIni}→${t.wFin} W (Δ ${t.dW}%)` : '';
      return `<b>${esc(t.nivel)}</b>: ΔA=${t.dA}%, ΔB=${t.dB}%, ΔC=${t.dC}% (${esc(t.iniRep.label)}→${esc(t.finRep.label)}) — ${dir}${wTxt}`;
    }).join('<br>');
    td.innerHTML = `<b>Tendencia vs baseline</b> (cambio de decenas de % = alarma aunque el patrón parezca correcto, IEEE C57.152):<br>${partes}`;
    card.appendChild(td);
  }
  // Caveat.
  const cav = document.createElement('div'); cav.className = 'pe-analisis-cav';
  cav.innerHTML = '⚠️ <b>Comparar solo a IGUAL devanado y tensión de prueba</b> (por eso se discrimina por nivel): el nivel = devanado + su nominal según el grupo vectorial (AT 110 kV estrella / AT 66 kV delta · MT 34.5 kV · BT 13.8 kV); el "10 kV" de algunos títulos es la <b>tensión de ensayo</b>, no el nivel. ' +
    'La prueba es muy sensible al <b>magnetismo residual</b> — debe desmagnetizarse antes de medir, sobre todo tras pruebas DC (IR, R de devanados). ' +
    'El patrón sano es <b>2+1</b> (externas A–C simétricas + central distinta); en este núcleo de 3 columnas la <b>central (B) es la menor</b> en estrella Y en delta (lo gobierna la geometría del núcleo, no la conexión), por eso la dirección HLH/LHL es informativa, no criterio. ' +
    `Umbrales Δ ${U.guia}–${U.limite}% ⚠️ a verificar contra la edición de norma del director / dato de fábrica.`;
  card.appendChild(cav);
  box.appendChild(card);
}

/**
 * Monta el panel de corriente de excitación en `cont`.
 * @param {HTMLElement} cont
 * @param {Array<{id,label,ano,config,excs:Array<{titulo,bloque}>}>} items
 *   Un item por INFORME; `excs` = sus bloques de excitación (uno por nivel de tensión).
 */
export function montarPanelExcitacion(cont, items) {
  // Aplana a mediciones {rep, nivel, tap, fases, ev}. Una por (informe × nivel × TAP).
  const reps = (Array.isArray(items) ? items : [])
    .filter((it) => it && Array.isArray(it.excs) && it.excs.length)
    .map((it, i) => ({ id: it.id, label: it.label, ano: it.ano, config: it.config || '', color: COLORES[i % COLORES.length], excs: it.excs }));
  if (!reps.length) { cont.innerHTML = '<p class="muted small">Aún no hay corriente de excitación extraída para esta unidad.</p>'; return; }

  const meds = [];
  reps.forEach((r) => r.excs.forEach((ex) => {
    const niv = nivelDe(ex.titulo, r.config);
    const taps = tapsDe(ex.bloque);
    const lista = taps.length ? taps : [null];
    lista.forEach((tap) => {
      const fases = fasesDe(ex.bloque, tap);
      const wfases = perdidasDe(ex.bloque, tap);
      const ev = evaluarPatron(fases, r.config);
      meds.push({ rep: r, nivel: niv.label, dev: niv.dev, kv: niv.kv, testKv: niv.testKv, tap, fases, wfases, ev });
    });
  }));

  const niveles = [...new Set(meds.map((m) => m.nivel))].sort();
  const grupos = [...new Set(reps.map((r) => r.config).filter(Boolean))];
  const fasesAll = ORDEN_FASE.filter((f) => meds.some((m) => m.fases[f] != null));

  const sel = { rep: new Set(reps.map((r) => r.id)), grupo: new Set(grupos), nivel: new Set(niveles), fase: new Set(fasesAll) };
  let modo = 'desviacion';
  let tablaMag = 'ambos'; // 'mA' | 'W' | 'ambos' — magnitud de la Tabla de valores

  cont.innerHTML = '';
  const card = document.createElement('div'); card.className = 'pe-filtros';
  const head = document.createElement('div'); head.className = 'pe-filtros-head';
  head.innerHTML = '<span class="ttl"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>Filtros</span>';
  const reset = document.createElement('button'); reset.className = 'pe-reset'; reset.textContent = 'Restablecer';
  head.appendChild(reset); card.appendChild(head);

  const cap = Object.assign(document.createElement('p'), { className: 'muted small', style: 'margin:2px 0 8px' });
  const chartBox = document.createElement('div'); chartBox.className = 'chartbox';
  const analisisBox = document.createElement('div'); analisisBox.className = 'pe-analisis-box';
  const contadores = [];

  const repsVis = () => reps.filter((r) => sel.rep.has(r.id) && (!grupos.length || sel.grupo.has(r.config)));
  const medsVis = () => {
    const ids = new Set(repsVis().map((r) => r.id));
    return meds.filter((m) => ids.has(m.rep.id) && sel.nivel.has(m.nivel));
  };
  // Mediciones agregadas por (rep × nivel) — promedio por fase sobre TAPs visibles —
  // para las vistas de patrón/tendencia (una barra-trío por informe×nivel).
  const medsAgg = () => {
    const vis = medsVis();
    const byKey = new Map();
    vis.forEach((m) => {
      const k = m.rep.id + '|' + m.nivel;
      if (!byKey.has(k)) byKey.set(k, { rep: m.rep, nivel: m.nivel, acc: { A: [], B: [], C: [] }, accW: { A: [], B: [], C: [] } });
      ORDEN_FASE.forEach((f) => { if (m.fases[f] != null) byKey.get(k).acc[f].push(m.fases[f]); if (m.wfases && m.wfases[f] != null) byKey.get(k).accW[f].push(m.wfases[f]); });
    });
    return [...byKey.values()].map((g) => {
      const fases = {}, wfases = {};
      ORDEN_FASE.forEach((f) => { if (g.acc[f].length) fases[f] = g.acc[f].reduce((a, b) => a + b, 0) / g.acc[f].length; if (g.accW[f].length) wfases[f] = g.accW[f].reduce((a, b) => a + b, 0) / g.accW[f].length; });
      return { rep: g.rep, nivel: g.nivel, fases, wfases, ev: evaluarPatron(fases, g.rep.config) };
    });
  };

  // ── Vista PATRÓN DE FASES: eje X = fase (A/B/C), barras por informe (color por
  // informe). Para el/los nivel(es) visibles. Muestra la forma HLH/LHL. ──
  function svgPatron(agg, fasesList) {
    const groups = agg.filter((g) => fasesList.some((f) => g.fases[f] != null));
    if (!groups.length || !fasesList.length) return null;
    const allY = groups.flatMap((g) => fasesList.map((f) => g.fases[f]).filter((v) => v != null));
    if (!allY.length) return null;
    const W = 920, L = 54, R = 16, B = 60;
    const legItems = groups.map((g) => ({ color: g.rep.color, txt: `${g.rep.label}${g.rep.config ? ' · ' + g.rep.config : ''} · ${g.nivel}` }));
    const legRows = []; let row = [], lx = L;
    legItems.forEach((it) => { const w = 18 + it.txt.length * 6 + 16; if (lx + w > W - R && row.length) { legRows.push(row); row = []; lx = L; } row.push({ ...it, x: lx }); lx += w; });
    if (row.length) legRows.push(row);
    const T = legRows.length * 16 + 12, H = T + 250;
    const ymax = Math.max(...allY) * 1.14;
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = fasesList.length, innerW = W - L - R, X = (i) => L + (i + 0.5) * (innerW / n);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    legRows.forEach((r, ri) => { const y = 12 + ri * 16; r.forEach((it) => {
      svg.appendChild(el('rect', { x: it.x, y: y - 8, width: 11, height: 11, rx: 2, fill: it.color }));
      const tx = el('text', { x: it.x + 16, y: y + 1, fill: '#5b6876', 'font-size': 10 }); tx.textContent = it.txt; svg.appendChild(tx); }); });
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(1); svg.appendChild(tx); }
    fasesList.forEach((f, i) => { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#5b6876', 'font-size': 11, 'font-weight': 600, 'text-anchor': 'middle' }); tx.textContent = 'Fase ' + f + (f === 'B' ? ' (central)' : ''); svg.appendChild(tx); });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: 'Fase (patrón esperado 2+1: central ≠ externas; externas similares) — mA →' }));
    const slotW = innerW / Math.max(n, 1), nb = groups.length, bw = Math.min(slotW * 0.82 / Math.max(nb, 1), 26), y0 = Y(0);
    fasesList.forEach((f, i) => { groups.forEach((g, k) => {
      const v = g.fases[f]; if (v == null) return;
      const cx = X(i) - (nb * bw) / 2 + (k + 0.5) * bw, yy = Y(v);
      const roto = g.ev && !g.ev.ok;
      const rect = el('rect', { x: cx - bw / 2, y: yy, width: Math.max(bw - 1, 1), height: Math.max(y0 - yy, 0), fill: roto ? '#c0392b' : g.rep.color, rx: 1 });
      if (roto) { rect.setAttribute('stroke', '#7f1d1d'); rect.setAttribute('stroke-width', '1'); }
      rect.appendChild(el('title', {})).textContent = `${g.nivel} · ${g.rep.label} · Fase ${f}: ${round(v, 2)} mA — patrón ${g.ev ? g.ev.patron : '—'} (Δ ext ${g.ev ? g.ev.deltaExt : '—'}%)`;
      svg.appendChild(rect); }); });
    return svg;
  }

  // ── Vista TENDENCIA: eje X = informe, barras por fase (color por fase), para el
  // nivel visible. La misma fase alineada entre años. ──
  function svgTendencia(agg, fasesList) {
    const byNivel = [...new Set(agg.map((g) => g.nivel))];
    if (!byNivel.length) return null;
    // Si hay varios niveles visibles, usa el primero (el caption lo avisa).
    const nivel = byNivel[0];
    const groups = agg.filter((g) => g.nivel === nivel).sort((a, b) => (a.rep.ano || 0) - (b.rep.ano || 0));
    if (groups.length < 1) return null;
    const allY = groups.flatMap((g) => fasesList.map((f) => g.fases[f]).filter((v) => v != null));
    if (!allY.length) return null;
    const W = 920, H = 320, L = 54, R = 16, T = 28, B = 60;
    const ymax = Math.max(...allY) * 1.14;
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = groups.length, innerW = W - L - R, X = (i) => L + (i + 0.5) * (innerW / n);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    // Leyenda por fase.
    let lx = L; fasesList.forEach((f) => { svg.appendChild(el('rect', { x: lx, y: 6, width: 11, height: 11, rx: 2, fill: COL_FASE[f] }));
      const tx = el('text', { x: lx + 16, y: 15, fill: '#5b6876', 'font-size': 10 }); tx.textContent = 'Fase ' + f + (f === 'B' ? ' (central)' : ''); svg.appendChild(tx); lx += 110; });
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(1); svg.appendChild(tx); }
    groups.forEach((g, i) => { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = g.rep.label; svg.appendChild(tx); });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: `${nivel} · informe en el tiempo — mA por fase →` }));
    const slotW = innerW / Math.max(n, 1), nb = fasesList.length, bw = Math.min(slotW * 0.8 / Math.max(nb, 1), 22), y0 = Y(0);
    groups.forEach((g, i) => { fasesList.forEach((f, k) => {
      const v = g.fases[f]; if (v == null) return;
      const cx = X(i) - (nb * bw) / 2 + (k + 0.5) * bw, yy = Y(v);
      const rect = el('rect', { x: cx - bw / 2, y: yy, width: Math.max(bw - 1, 1), height: Math.max(y0 - yy, 0), fill: COL_FASE[f], rx: 1 });
      rect.appendChild(el('title', {})).textContent = `${g.rep.label} · Fase ${f}: ${round(v, 2)} mA`;
      svg.appendChild(rect); }); });
    return { svg, nivel, varios: byNivel.length > 1 };
  }

  // ── Vista POR NIVEL DE TENSIÓN: eje X = nivel, barras por informe = Δ externas (%)
  // vs guía 5% / límite 10%. ──
  function svgPorNivel(agg) {
    const nivs = [...new Set(agg.map((g) => g.nivel))].sort();
    const groups = agg.filter((g) => g.ev);
    if (!nivs.length || !groups.length) return null;
    const repsCon = [...new Map(groups.map((g) => [g.rep.id, g.rep])).values()];
    const W = 920, L = 54, R = 16, B = 60;
    const legItems = repsCon.map((r) => ({ color: r.color, txt: `${r.label}${r.config ? ' · ' + r.config : ''}` }));
    const legRows = []; let row = [], lx = L;
    legItems.forEach((it) => { const w = 18 + it.txt.length * 6 + 16; if (lx + w > W - R && row.length) { legRows.push(row); row = []; lx = L; } row.push({ ...it, x: lx }); lx += w; });
    if (row.length) legRows.push(row);
    const T = legRows.length * 16 + 12, H = T + 250;
    const allY = groups.map((g) => g.ev.deltaExt);
    const ymax = Math.max(Math.max(...allY) * 1.2, CRIT.limite * 1.15);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = nivs.length, innerW = W - L - R, X = (i) => L + (i + 0.5) * (innerW / n);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    legRows.forEach((r, ri) => { const y = 12 + ri * 16; r.forEach((it) => {
      svg.appendChild(el('rect', { x: it.x, y: y - 8, width: 11, height: 11, rx: 2, fill: it.color }));
      const tx = el('text', { x: it.x + 16, y: y + 1, fill: '#5b6876', 'font-size': 10 }); tx.textContent = it.txt; svg.appendChild(tx); }); });
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(1); svg.appendChild(tx); }
    [[CRIT.limite, '#c0392b', `límite ${CRIT.limite}% · ${CRIT.norma}`], [CRIT.guia, '#b07d12', `guía ${CRIT.guia}%`]].forEach(([v, c, lbl]) => { if (v <= ymax) {
      svg.appendChild(el('line', { x1: L, y1: Y(v), x2: W - R, y2: Y(v), stroke: c, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
      const tx = el('text', { x: W - R, y: Y(v) - 4, fill: c, 'font-size': 9, 'text-anchor': 'end' }); tx.textContent = lbl; svg.appendChild(tx); } });
    nivs.forEach((nv, i) => { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }); tx.textContent = nv; svg.appendChild(tx); });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: 'Nivel de tensión — Δ entre externas (%) →' }));
    const slotW = innerW / Math.max(n, 1), nb = repsCon.length, bw = Math.min(slotW * 0.82 / Math.max(nb, 1), 20), y0 = Y(0);
    let total = 0, sobre = 0, enGuia = 0;
    nivs.forEach((nv, i) => { repsCon.forEach((r, k) => {
      const g = groups.find((x) => x.nivel === nv && x.rep.id === r.id); if (!g) return;
      const v = g.ev.deltaExt; total++; const over = v > CRIT.limite, warn = !over && v > CRIT.guia; if (over) sobre++; else if (warn) enGuia++;
      const cx = X(i) - (nb * bw) / 2 + (k + 0.5) * bw, yy = Y(v);
      const rect = el('rect', { x: cx - bw / 2, y: yy, width: Math.max(bw - 1, 1), height: Math.max(y0 - yy, 0), fill: over ? '#c0392b' : r.color, rx: 1 });
      if (over) { rect.setAttribute('stroke', '#7f1d1d'); rect.setAttribute('stroke-width', '1'); }
      const estado = over ? `SUPERA límite (${CRIT.limite}%)` : warn ? `sobre guía (${CRIT.guia}%)` : 'dentro de norma';
      rect.appendChild(el('title', {})).textContent = `${nv} · ${r.label}: Δ ${v}% (admisible ${g.ev.admisible}%, I máx ${g.ev.corrMax} mA) — ${estado}`;
      svg.appendChild(rect); }); });
    return { svg, total, sobre, guia: enGuia };
  }

  // ── Vista Δ POR POSICIÓN DE TAP: eje X = posición del TAP, eje Y = Δ entre fases
  // laterales (externas A–C, %), una LÍNEA por informe (color por informe) para el
  // nivel visible. Mismo criterio por nivel y por posición + tendencia entre años.
  // Es la gráfica "Desviación entre fases laterales por TAP" condensada multi-año. ──
  function svgDesviacionTAP(medsPerTap) {
    const conEv = medsPerTap.filter((m) => m.ev && m.tap != null);
    const nivs = [...new Set(conEv.map((m) => m.nivel))];
    if (!nivs.length) return null;
    const nivel = nivs[0];
    const serie = conEv.filter((m) => m.nivel === nivel);
    const byRep = new Map();
    serie.forEach((m) => { if (!byRep.has(m.rep.id)) byRep.set(m.rep.id, { rep: m.rep, pts: [] }); byRep.get(m.rep.id).pts.push({ tap: String(m.tap), d: m.ev.deltaExt, A: m.ev.A, B: m.ev.B, C: m.ev.C }); });
    const groups = [...byRep.values()].sort((a, b) => (a.rep.ano || 0) - (b.rep.ano || 0));
    groups.forEach((g) => g.pts.sort((a, b) => (num(a.tap) ?? 0) - (num(b.tap) ?? 0)));
    const taps = [...new Set(serie.map((m) => String(m.tap)))].sort((a, b) => (num(a) ?? 0) - (num(b) ?? 0));
    if (!taps.length) return null;
    const allD = serie.map((m) => m.ev.deltaExt);
    const W = 920, L = 54, R = 16, B = 60;
    const legItems = groups.map((g) => ({ color: g.rep.color, txt: `${g.rep.label}${g.rep.config ? ' · ' + g.rep.config : ''}` }));
    const legRows = []; let row = [], lx = L;
    legItems.forEach((it) => { const w = 18 + it.txt.length * 6 + 16; if (lx + w > W - R && row.length) { legRows.push(row); row = []; lx = L; } row.push({ ...it, x: lx }); lx += w; });
    if (row.length) legRows.push(row);
    const T = legRows.length * 16 + 12, H = T + 260;
    const ymax = Math.max(Math.max(...allD) * 1.2, CRIT.limite * 1.15);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = taps.length, innerW = W - L - R, X = (i) => L + (n === 1 ? innerW / 2 : (i) * (innerW / (n - 1)));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    legRows.forEach((r, ri) => { const y = 12 + ri * 16; r.forEach((it) => {
      svg.appendChild(el('rect', { x: it.x, y: y - 8, width: 11, height: 11, rx: 2, fill: it.color }));
      const tx = el('text', { x: it.x + 16, y: y + 1, fill: '#5b6876', 'font-size': 10 }); tx.textContent = it.txt; svg.appendChild(tx); }); });
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(2); svg.appendChild(tx); }
    [[CRIT.limite, '#c0392b', `límite ${CRIT.limite}% · ${CRIT.norma}`], [CRIT.guia, '#b07d12', `guía ${CRIT.guia}%`]].forEach(([v, c, lbl]) => { if (v <= ymax) {
      svg.appendChild(el('line', { x1: L, y1: Y(v), x2: W - R, y2: Y(v), stroke: c, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
      const tx = el('text', { x: W - R, y: Y(v) - 4, fill: c, 'font-size': 9, 'text-anchor': 'end' }); tx.textContent = lbl; svg.appendChild(tx); } });
    const tapIdx = new Map(taps.map((t, i) => [t, i]));
    taps.forEach((t, i) => { if (n <= 24 || i % 2 === 0) { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = t; svg.appendChild(tx); } });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: `${nivel} · Posición del TAP — Δ entre fases laterales (A–C, %) →` }));
    groups.forEach((g) => {
      const pts = g.pts.filter((p) => tapIdx.has(p.tap));
      if (!pts.length) return;
      const d = pts.map((p) => `${X(tapIdx.get(p.tap))},${Y(p.d)}`).join(' ');
      svg.appendChild(el('polyline', { points: d, fill: 'none', stroke: g.rep.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      pts.forEach((p) => { const over = p.d > CRIT.limite, warn = !over && p.d > CRIT.guia;
        const c = el('circle', { cx: X(tapIdx.get(p.tap)), cy: Y(p.d), r: over ? 3.6 : 2.8, fill: over ? '#c0392b' : g.rep.color, stroke: '#fff', 'stroke-width': over ? 1 : 0.6 });
        c.appendChild(el('title', {})).textContent = `${g.rep.label} · TAP ${p.tap}: Δ ${p.d}% (A=${round(p.A, 2)}, B=${round(p.B, 2)}, C=${round(p.C, 2)} mA)${over ? ' — SUPERA límite' : warn ? ' — sobre guía' : ''}`;
        svg.appendChild(c); });
    });
    const total = serie.length, sobre = serie.filter((m) => m.ev.deltaExt > CRIT.limite).length, guia = serie.filter((m) => m.ev.deltaExt > CRIT.guia && m.ev.deltaExt <= CRIT.limite).length;
    return { svg, nivel, varios: nivs.length > 1, total, sobre, guia };
  }

  // ── Vista TABLA DE VALORES: los valores CRUDOS del informe (corriente mA y/o
  // pérdidas W por fase y por TAP), una tabla por (informe × nivel). Respeta el
  // filtro de fase. `mag` ∈ {'mA','W','ambos'} elige las columnas — las pérdidas
  // (W) son la componente resistiva del ensayo, faithful a la tabla del informe.
  // Es la forma tabular de "toda la información de excitación" — sin dejar nada
  // suelto: corriente, pérdidas y Δ de patrón. ──
  function tablaValores(medsPerTap, fasesList, mag) {
    const conDato = medsPerTap.filter((m) => m.tap != null && fasesList.some((f) => m.fases[f] != null || (m.wfases && m.wfases[f] != null)));
    if (!conDato.length || !fasesList.length) return null;
    const verMa = mag !== 'W', verW = mag !== 'mA';
    const byKey = new Map();
    conDato.forEach((m) => { const k = m.rep.id + '|' + m.nivel; if (!byKey.has(k)) byKey.set(k, { rep: m.rep, nivel: m.nivel, rows: [] }); byKey.get(k).rows.push(m); });
    const groups = [...byKey.values()].sort((a, b) => (a.rep.ano || 0) - (b.rep.ano || 0) || a.nivel.localeCompare(b.nivel));
    const wrap = document.createElement('div'); wrap.className = 'pe-tabla-wrap';
    groups.forEach((g) => {
      g.rows.sort((a, b) => (num(a.tap) ?? 0) - (num(b.tap) ?? 0));
      const tieneW = g.rows.some((m) => m.wfases && fasesList.some((f) => m.wfases[f] != null));
      const card = document.createElement('div'); card.className = 'pe-tabla-card';
      const cab = document.createElement('div'); cab.className = 'pe-tabla-cab';
      const peor = g.rows.reduce((a, b) => (b.ev && (!a.ev || b.ev.deltaExt > a.ev.deltaExt) ? b : a), g.rows[0]);
      const estado = peor.ev ? (!peor.ev.ok ? (peor.ev.deltaExt > peor.ev.admisible * 2 ? 'bad' : 'warn') : 'ok') : 'ok';
      const wNota = (verW && !tieneW) ? '<span class="pe-tabla-badge is-warn">sin pérdidas (W) en este informe</span>' : '';
      cab.innerHTML = `<div class="pe-tabla-ttl">${esc(g.rep.label)}${g.rep.config ? ' · ' + esc(g.rep.config) : ''} <span class="niv">${esc(g.nivel)}</span></div>` +
        `<div class="pe-tabla-meta">${wNota}<span class="pe-tabla-badge is-${estado}">Δ ext máx ${peor.ev ? peor.ev.deltaExt : '—'}% · patrón ${peor.ev ? peor.ev.patron : '—'}</span></div>`;
      card.appendChild(cab);
      const scroll = document.createElement('div'); scroll.className = 'pe-tabla-scroll';
      const tabla = document.createElement('table'); tabla.className = 'pe-tabla';
      // Cabecera: por cada fase, columna(s) mA y/o W. + Δ ext (%) cuando hay mA.
      const colsFase = []; // {f, tipo:'mA'|'W'}
      fasesList.forEach((f) => { if (verMa) colsFase.push({ f, tipo: 'mA' }); if (verW) colsFase.push({ f, tipo: 'W' }); });
      const ths = ['<th>TAP</th>'].concat(colsFase.map((c) =>
        `<th${c.f === 'B' ? ' class="col-b"' : ''}>Fase ${c.f}${c.f === 'B' ? ' (central)' : ''} (${c.tipo})</th>`));
      if (verMa) ths.push('<th>Δ ext (%)</th>');
      if (verW) ths.push('<th>Σ pérd. (W)</th>');
      tabla.innerHTML = `<thead><tr>${ths.join('')}</tr></thead>`;
      const tb = document.createElement('tbody');
      const sumMa = {}, sumW = {}; fasesList.forEach((f) => { sumMa[f] = []; sumW[f] = []; });
      g.rows.forEach((m) => {
        const ev = m.ev; const dcls = !ev ? '' : ev.deltaExt > CRIT.limite ? 'd-bad' : ev.deltaExt > CRIT.guia ? 'd-warn' : 'd-ok';
        const wf = m.wfases || {};
        let sumWtap = 0, hayW = false;
        const cels = colsFase.map((c) => {
          if (c.tipo === 'mA') { const v = m.fases[c.f]; if (v != null) sumMa[c.f].push(v); return `<td${c.f === 'B' ? ' class="col-b"' : ''}>${v != null ? round(v, 2) : '—'}</td>`; }
          const w = wf[c.f]; if (w != null) { sumW[c.f].push(w); sumWtap += w; hayW = true; }
          return `<td${c.f === 'B' ? ' class="col-b"' : ''}>${w != null ? round(w, 2) : '—'}</td>`;
        }).join('');
        const tail = (verMa ? `<td class="${dcls}">${ev ? ev.deltaExt : '—'}</td>` : '') + (verW ? `<td>${hayW ? round(sumWtap, 2) : '—'}</td>` : '');
        tb.innerHTML += `<tr><td>${esc(String(m.tap))}</td>${cels}${tail}</tr>`;
      });
      tabla.appendChild(tb);
      const prom = (arr) => (arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length, 2) : '—');
      const footCels = colsFase.map((c) => `<td${c.f === 'B' ? ' class="col-b"' : ''}>${prom(c.tipo === 'mA' ? sumMa[c.f] : sumW[c.f])}</td>`).join('');
      const sumWtot = fasesList.reduce((a, f) => a + (sumW[f].length ? sumW[f].reduce((x, y) => x + y, 0) / sumW[f].length : 0), 0);
      const hayWtot = fasesList.some((f) => sumW[f].length);
      const footTail = (verMa ? '<td></td>' : '') + (verW ? `<td>${hayWtot ? round(sumWtot, 2) : '—'}</td>` : '');
      tabla.innerHTML += `<tfoot><tr><td>Promedio</td>${footCels}${footTail}</tr></tfoot>`;
      scroll.appendChild(tabla); card.appendChild(scroll); wrap.appendChild(card);
    });
    return wrap;
  }

  const pintar = () => {
    chartBox.innerHTML = '';
    const agg = medsAgg(), fasesList = fasesAll.filter((f) => sel.fase.has(f));
    magBar.style.display = modo === 'tabla' ? 'flex' : 'none';
    if (modo === 'tabla') {
      const t = tablaValores(medsVis(), fasesList, tablaMag);
      const queMide = tablaMag === 'mA' ? 'corriente de excitación (mA)' : tablaMag === 'W' ? 'pérdidas (W)' : 'corriente (mA) Y pérdidas (W)';
      cap.textContent = `Tabla de valores: ${queMide} CRUDA del informe por fase y por posición de TAP, una tabla por informe × nivel. ` +
        `Δ ext = desviación entre fases laterales (A–C) por posición; Σ pérd. = pérdidas totales del trío en ese TAP. ` +
        `Las pérdidas (W) son la componente resistiva del ensayo (I_exc = magnetizante + pérdidas) — se juzgan por COMPARACIÓN (vs fábrica / ensayos previos / fases hermanas), sin umbral duro propio. Filtra por nivel, año o fase para acotar.`;
      if (t) chartBox.appendChild(t); else chartBox.innerHTML = '<p class="muted small">Sin valores de excitación para los filtros activos.</p>';
      renderAnalisis(analisisBox, analizarExcitacion(agg));
      contadores.forEach((fn) => fn());
      return;
    }
    const datos = analizarExcitacion(agg);
    let svg = null;
    if (modo === 'desviacion') {
      const r = svgDesviacionTAP(medsVis()); svg = r && r.svg;
      if (r) { const ok = r.total - r.sobre - r.guia; const partes = [`${ok}/${r.total} posiciones dentro de norma`];
        if (r.guia) partes.push(`${r.guia} sobre guía`); if (r.sobre) partes.push(`${r.sobre} SUPERA límite`);
        cap.textContent = `Δ por posición de TAP (${r.nivel}): eje X = TAP, eje Y = Δ entre fases laterales (A–C); una línea por informe (color por año) — mismo criterio por nivel y por posición (IEEE Std 62 / C57.12.90: ≤ ${CRIT.limite}%). La forma de la curva y su deriva entre años condensan la tendencia. Veredicto: ${partes.join(' · ')}.${r.varios ? ' (Varios niveles seleccionados: se grafica el primero — filtra a un nivel para ver otro.)' : ''}`; }
    } else if (modo === 'tendencia') {
      const r = svgTendencia(agg, fasesList); svg = r && r.svg;
      cap.textContent = `Tendencia año tras año (${r ? r.nivel : '—'}): eje X = informe, BARRAS por fase (color por fase) — la misma fase alineada entre años. Una sola fase que se aparta sugiere espira/defecto local; las 3 subiendo a la vez, magnetismo residual.${r && r.varios ? ' (Varios niveles seleccionados: se grafica el primero — filtra a un nivel para ver otro.)' : ''}`;
    } else if (modo === 'nivel') {
      const r = svgPorNivel(agg); svg = r && r.svg;
      if (r) { const ok = r.total - r.sobre - r.guia; const partes = [`${ok}/${r.total} dentro de norma`];
        if (r.guia) partes.push(`${r.guia} sobre guía`); if (r.sobre) partes.push(`${r.sobre} SUPERA límite (rojo)`);
        cap.textContent = `Por nivel de tensión: eje X = nivel (devanado + tensión de prueba); barras por informe = Δ entre externas. Mismo criterio en cada nivel (IEEE Std 62: Δ<${CRIT.guia}% si I≥50 mA, <${CRIT.limite}% si I<50 mA). Veredicto: ${partes.join(' · ')}.`; }
    } else {
      svg = svgPatron(agg, fasesList);
      cap.textContent = `Patrón de fases: eje X = fase (A/B/C), barras por informe×nivel (color por informe; ROJO = patrón fuera de criterio). El patrón sano es 2 externas similares + 1 central distinta (HLH en estrella, LHL en delta). Pasa el cursor por cada barra para Δ y patrón.`;
    }
    if (svg) chartBox.appendChild(svg);
    else chartBox.innerHTML = '<p class="muted small">Sin datos de excitación para los filtros activos.</p>';
    renderAnalisis(analisisBox, datos);
    contadores.forEach((fn) => fn());
  };

  function grupoFiltro(label, gitems, setSel, opts = {}) {
    const g = document.createElement('div'); g.className = 'pe-fgrupo';
    const cab = document.createElement('div'); cab.className = 'pe-fgrupo-cab';
    cab.appendChild(Object.assign(document.createElement('span'), { className: 'pe-fgrupo-lbl', textContent: label }));
    const meta = document.createElement('div'); meta.className = 'pe-fgrupo-meta';
    const cnt = Object.assign(document.createElement('span'), { className: 'pe-fgrupo-cnt' });
    const todos = Object.assign(document.createElement('button'), { className: 'pe-fgrupo-todos', textContent: 'todos' });
    meta.append(cnt, todos); cab.appendChild(meta); g.appendChild(cab);
    const chipsWrap = document.createElement('div'); chipsWrap.className = 'pe-fgrupo-chips';
    const btns = new Map();
    const all = () => (opts.keys || gitems.map((it) => it.key ?? it));
    const onToggle = (key, btn) => { if (setSel.has(key)) { if (setSel.size > 1) setSel.delete(key); } else setSel.add(key); btn.classList.toggle('is-on', setSel.has(key)); pintar(); };
    if (opts.todosChip) { const tb = chip(opts.todosChip, setSel.size === all().length, () => { all().forEach((k) => setSel.add(k)); btns.forEach((b, k) => b.classList.toggle('is-on', setSel.has(k))); pintar(); });
      tb.style.fontWeight = '700'; tb.dataset.todos = '1'; chipsWrap.appendChild(tb); contadores.push(() => tb.classList.toggle('is-on', setSel.size === all().length)); }
    gitems.forEach((it) => { const key = it.key ?? it; const b = chip(it.label ?? it, setSel.has(key), (btn) => onToggle(key, btn), it.color); btns.set(key, b); chipsWrap.appendChild(b); });
    g.appendChild(chipsWrap);
    todos.addEventListener('click', () => { const A = all(); const full = setSel.size === A.length; setSel.clear(); if (!full) A.forEach((k) => setSel.add(k)); else setSel.add(A[A.length - 1]); btns.forEach((b, k) => b.classList.toggle('is-on', setSel.has(k))); pintar(); });
    contadores.push(() => { cnt.textContent = `${setSel.size}/${all().length}`; });
    card.appendChild(g);
    return btns;
  }

  const bRep = grupoFiltro('Año / informe', reps.map((r) => ({ key: r.id, label: `${r.label}${r.config ? ' · ' + r.config : ''}`, color: r.color })), sel.rep, { keys: reps.map((r) => r.id), todosChip: 'Todos los años' });
  const bGr = grupos.length ? grupoFiltro('Grupo de conexión', grupos, sel.grupo, { keys: grupos }) : new Map();
  const bNiv = grupoFiltro('Nivel de tensión', niveles, sel.nivel, { keys: niveles });
  const bFase = grupoFiltro('Fase', fasesAll.map((f) => ({ key: f, label: 'Fase ' + f, color: COL_FASE[f] })), sel.fase, { keys: fasesAll });

  reset.addEventListener('click', () => {
    sel.rep = new Set(reps.map((r) => r.id)); sel.grupo = new Set(grupos); sel.nivel = new Set(niveles); sel.fase = new Set(fasesAll);
    bRep.forEach((b, k) => b.classList.toggle('is-on', sel.rep.has(k)));
    bGr.forEach((b, k) => b.classList.toggle('is-on', sel.grupo.has(k)));
    bNiv.forEach((b, k) => b.classList.toggle('is-on', sel.nivel.has(k)));
    bFase.forEach((b, k) => b.classList.toggle('is-on', sel.fase.has(k)));
    pintar();
  });

  const vistaBar = document.createElement('div'); vistaBar.className = 'pe-fase-chips'; vistaBar.style.cssText = 'display:flex;gap:6px;align-items:center;margin:0 0 6px';
  vistaBar.appendChild(Object.assign(document.createElement('span'), { textContent: 'Vista:', style: 'font-size:12px;font-weight:600;color:#475569;margin-right:4px' }));
  const mkVista = (key, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pe-fase-chip' + (modo === key ? ' is-on' : ''); b.textContent = txt;
    b.addEventListener('click', () => { modo = key; [...vistaBar.querySelectorAll('.pe-fase-chip')].forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on'); pintar(); }); return b; };
  vistaBar.append(mkVista('desviacion', 'Δ por posición (TAP)'), mkVista('patron', 'Patrón de fases'), mkVista('tendencia', 'Tendencia (años en X)'), mkVista('nivel', 'Por nivel de tensión'), mkVista('tabla', 'Tabla de valores'));

  // Sub-toggle de magnitud, SOLO visible en la Tabla de valores: corriente / pérdidas / ambos.
  const magBar = document.createElement('div'); magBar.className = 'pe-fase-chips'; magBar.style.cssText = 'display:none;gap:6px;align-items:center;margin:0 0 6px';
  magBar.appendChild(Object.assign(document.createElement('span'), { textContent: 'Magnitud:', style: 'font-size:12px;font-weight:600;color:#475569;margin-right:4px' }));
  const mkMag = (key, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pe-fase-chip' + (tablaMag === key ? ' is-on' : ''); b.textContent = txt;
    b.addEventListener('click', () => { tablaMag = key; [...magBar.querySelectorAll('.pe-fase-chip')].forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on'); pintar(); }); return b; };
  magBar.append(mkMag('mA', 'Corriente (mA)'), mkMag('W', 'Pérdidas (W)'), mkMag('ambos', 'Ambos'));

  cont.appendChild(card);
  cont.appendChild(vistaBar);
  cont.appendChild(magBar);
  cont.appendChild(cap);
  cont.appendChild(chartBox);
  cont.appendChild(analisisBox);
  pintar();
}
