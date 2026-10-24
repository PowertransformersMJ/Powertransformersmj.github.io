// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · alias de elemento (dominio puro) · 2026-10-24
// ──────────────────────────────────────────────────────────────────────────────
// A veces el SCADA exporta UN nivel de un transformador bajo un elemento con otro nombre (una errata
// del nombre). Ese nivel no pasa el filtro de transformadores y, aunque pasara, sería OTRO punto: el
// devanado queda «sin medida». Un alias, que confirma el Ingeniero y vive en la hoja «Alias de elemento»
// del Excel de la homologación (o en `--alias`), escribe esas filas con el elemento homologado para que
// su nivel se sume al MISMO punto. Reglas:
//   · gana siempre la fila real: si el MISMO archivo ya trae el elemento homologado con ese nivel y esa
//     variable, la fila del alias se descarta (nunca dos filas para una misma medida);
//   · el alias solo apunta a un elemento homologado de su estación, y el elemento con errata no puede ser
//     el de ninguna fila de la homologación (lo escondería);
//   · solo el paquete preparado lo aplica, después de los relevos de estación (`99 §158`).
// Funciones PURAS. Archivo NUEVO (L-102): solo importa exportaciones ya publicadas. Sin nombres reales.
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarTexto, nivelDe } from './scada_carga_csv.js';
import { analizarClaveHomologada, claveEfectiva } from './scada_carga_homologacion.js';

const tok = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const niv = (s) => nivelDe(s) || normalizarTexto(s);

/**
 * Valida una lista de alias contra la homologación. Lanza un Error con texto llano.
 * @param {Array<{est: string, de: string, a: string}>} alias
 * @param {Object<string, object>} filas  filas de la homologación (fusionarHomologacion(...).filas)
 * @returns {Array<{est, de, a}>} los alias limpios (sin espacios a los lados)
 */
export function validarAlias(alias, filas) {
  const homologados = new Map();   // est → Set(elem) de las filas vigentes
  for (const f of Object.values(filas || {})) {
    if (f.retirada || (f.decision && f.decision.tipo === 'no_usar')) continue;
    for (const t of [f.clave_excel, claveEfectiva(f)]) {
      const k = analizarClaveHomologada(t);
      if (!k) continue;
      const e = normalizarTexto(k.est);
      if (!homologados.has(e)) homologados.set(e, new Set());
      homologados.get(e).add(normalizarTexto(k.elem));
    }
  }
  const out = [];
  for (const x of alias || []) {
    const est = String(x.est || '').trim(); const de = String(x.de || '').trim(); const a = String(x.a || '').trim();
    const donde = 'Alias ' + est + '/' + de + '→' + a;
    if (!est || !de || !a) throw new Error(donde + ': faltan la estación, el elemento o el elemento homologado.');
    if (normalizarTexto(de) === normalizarTexto(a)) throw new Error(donde + ': el elemento y el homologado deben ser distintos.');
    const h = homologados.get(normalizarTexto(est));
    if (!h) throw new Error(donde + ': «' + est + '» no es una estación de la homologación.');
    if (!h.has(normalizarTexto(a))) throw new Error(donde + ': «' + a + '» no es un punto homologado de esa estación.');
    if (h.has(normalizarTexto(de))) throw new Error(donde + ': «' + de + '» ya es un punto homologado; el alias lo escondería.');
    if (out.some((y) => normalizarTexto(y.est) === normalizarTexto(est) && normalizarTexto(y.de) === normalizarTexto(de))) {
      throw new Error(donde + ': hay dos alias para el mismo elemento.');
    }
    out.push({ est, de, a });
  }
  return out;
}

/**
 * Escribe las filas de cada elemento con errata con el nombre del elemento homologado. Gana la fila real.
 * @param {string} texto  un archivo del exporte (encabezado + filas)
 * @param {Array<{est: string, de: string, a: string}>} alias  ya validados
 * @returns {{texto: string, renombradas: number, descartadas: number}}
 */
export function aplicarAliasElemento(texto, alias) {
  const t = String(texto || '');
  if (!alias || !alias.length) return { texto: t, renombradas: 0, descartadas: 0 };
  const A = alias.map((x) => ({ est: normalizarTexto(x.est), de: normalizarTexto(x.de), a: normalizarTexto(x.a), aTxt: String(x.a).trim() }));
  const lineas = t.split('\n');
  const partes = lineas.map((l, i) => {
    if (i === 0) return null;
    const coma = l.indexOf(',');
    const segs = coma < 0 ? null : l.slice(0, coma).split('/');
    return segs && segs.length >= 6 ? { coma, segs, est: normalizarTexto(segs[1]), elem: normalizarTexto(segs[3]) } : null;
  });
  // 1.ª pasada: qué medidas REALES del elemento homologado trae este archivo (nivel + variable).
  const reales = new Set();
  for (const p of partes) {
    if (!p) continue;
    if (A.some((x) => x.est === p.est && x.a === p.elem)) reales.add(p.est + '|' + niv(p.segs[2]) + '|' + p.elem + '|' + tok(p.segs[4]));
  }
  // 2.ª pasada: renombrar (o descartar si la real ya está).
  const out = [lineas[0]];
  let renombradas = 0; let descartadas = 0;
  for (let i = 1; i < lineas.length; i++) {
    const p = partes[i];
    const x = p ? A.find((y) => y.est === p.est && y.de === p.elem) : null;
    if (!x) { out.push(lineas[i]); continue; }
    if (reales.has(x.est + '|' + niv(p.segs[2]) + '|' + x.a + '|' + tok(p.segs[4]))) { descartadas++; continue; }
    const segs = p.segs.slice();
    segs[3] = segs[3].replace(segs[3].trim(), x.aTxt);
    out.push(segs.join('/') + lineas[i].slice(p.coma));
    renombradas++;
  }
  return { texto: out.join('\n'), renombradas, descartadas };
}
