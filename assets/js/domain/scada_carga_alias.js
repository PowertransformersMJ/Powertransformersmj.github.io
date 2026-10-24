// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · alias de elemento (dominio puro) · 2026-10-24
// ──────────────────────────────────────────────────────────────────────────────
// A veces el SCADA exporta UN nivel de un transformador bajo un elemento con otro nombre (una errata
// del nombre). Ese nivel no pasa el filtro de transformadores y, aunque pasara, sería OTRO punto: el
// devanado queda «sin medida». Un alias, que confirma el Ingeniero y vive en la hoja «Alias de elemento»
// del Excel de la homologación (o en `--alias`), escribe esas filas con el elemento homologado para que
// su nivel se sume al MISMO punto. Reglas:
//   · nunca dos filas para una misma medida: si el MISMO archivo ya trae el elemento homologado con ese nivel
//     y esa variable (o otro alias ya la trajo), la fila del alias se funde en ella y solo llena sus horas
//     vacías; en las horas con valor gana la real;
//   · el alias solo apunta a un elemento homologado de su estación, y el elemento con errata no puede ser
//     el de ninguna fila de la homologación (lo escondería);
//   · solo el paquete preparado lo aplica, después de los relevos de estación (`99 §158`). El empaquetador
//     valida contra el Excel (no ve las decisiones de la página); la página vuelve a validar el manifiesto
//     contra la homologación vigente, con sus decisiones, antes de leer el paquete (`99 §181`).
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
 * Escribe las filas de cada elemento con errata con el nombre del elemento homologado. Nunca deja dos filas para una
 * misma medida (estación + nivel + elemento homologado + variable): si el archivo ya trae esa medida —la fila REAL, u
 * otra fila de alias ya renombrada—, la del alias se funde en ella y solo LLENA sus horas vacías («null» o en blanco);
 * en las horas con valor gana la que ya estaba (la real siempre, aunque venga después en el archivo). Así el día en que
 * el SCADA corrija el nombre a mitad de jornada no se pierden horas (revisión adversarial 2026-10-24).
 * @param {string} texto  un archivo del exporte (encabezado + filas)
 * @param {Array<{est: string, de: string, a: string}>} alias  ya validados
 * @returns {{texto: string, renombradas: number, descartadas: number, horasRellenadas: number}}
 *          descartadas = filas del alias fundidas en otra fila de la misma medida
 */
export function aplicarAliasElemento(texto, alias) {
  const t = String(texto || '');
  if (!alias || !alias.length) return { texto: t, renombradas: 0, descartadas: 0, horasRellenadas: 0 };
  const A = alias.map((x) => ({ est: normalizarTexto(x.est), de: normalizarTexto(x.de), a: normalizarTexto(x.a), aTxt: String(x.a).trim() }));
  const lineas = t.split('\n');
  const partes = lineas.map((l, i) => {
    if (i === 0) return null;
    const coma = l.indexOf(',');
    const segs = coma < 0 ? null : l.slice(0, coma).split('/');
    return segs && segs.length >= 6 ? { coma, segs, est: normalizarTexto(segs[1]), elem: normalizarTexto(segs[3]) } : null;
  });
  const medida = (est, nivel, elem, variable) => est + '|' + niv(nivel) + '|' + elem + '|' + tok(variable);
  // 1.ª pasada: la fila REAL de cada medida del elemento homologado (la primera, si el archivo trae dos).
  const duena = new Map();   // medida → índice de la línea que la lleva
  for (let i = 1; i < lineas.length; i++) {
    const p = partes[i];
    if (!p || !A.some((x) => x.est === p.est && x.a === p.elem)) continue;
    const k = medida(p.est, p.segs[2], p.elem, p.segs[4]);
    if (!duena.has(k)) duena.set(k, i);
  }
  // 2.ª pasada: renombrar, o fundir en la fila que ya lleva esa medida.
  const out = lineas.slice();   // null = línea quitada
  let renombradas = 0; let descartadas = 0; let horasRellenadas = 0;
  for (let i = 1; i < lineas.length; i++) {
    const p = partes[i];
    const x = p ? A.find((y) => y.est === p.est && y.de === p.elem) : null;
    if (!x) continue;
    const k = medida(x.est, p.segs[2], x.a, p.segs[4]);
    const j = duena.get(k);
    if (j == null) {
      const segs = p.segs.slice();
      segs[3] = segs[3].replace(segs[3].trim(), x.aTxt);
      out[i] = segs.join('/') + lineas[i].slice(p.coma);
      duena.set(k, i);
      renombradas++;
      continue;
    }
    out[i] = null;
    descartadas++;
    horasRellenadas += llenarHorasVacias(out, j, lineas[i].slice(p.coma + 1));
  }
  return { texto: out.filter((l) => l !== null).join('\n'), renombradas, descartadas, horasRellenadas };
}

const vacia = (c) => { const s = String(c == null ? '' : c).trim(); return s === '' || /^null$/i.test(s); };

/** Llena las celdas vacías de la línea `j` de `out` con las de `otras` (texto de celdas). Devuelve cuántas llenó. */
function llenarHorasVacias(out, j, otras) {
  const l = out[j];
  const coma = l.indexOf(',');
  const cr = l.endsWith('\r') ? '\r' : '';
  const celdas = l.slice(coma + 1, cr ? -1 : undefined).split(',');
  const de = String(otras).replace(/\r$/, '').split(',');
  let n = 0;
  for (let h = 0; h < Math.min(celdas.length, de.length); h++) if (vacia(celdas[h]) && !vacia(de[h])) { celdas[h] = de[h]; n++; }
  if (n) out[j] = l.slice(0, coma + 1) + celdas.join(',') + cr;
  return n;
}
