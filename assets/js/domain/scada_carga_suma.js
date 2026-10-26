// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · medida de un nivel por SUMA DE CIRCUITOS (dominio puro) · 2026-10-24
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero: cuando la medida propia de un transformador en un nivel no sirve (una fase leída al doble, por
// ejemplo), ese nivel se mide con la SUMA de los circuitos de su barra, hora por hora y fase por fase, «para tener datos
// reales». Sus decisiones (2026-10-24, las cinco recomendadas):
//   · D1 banda muerta: el valor «congelado» (5) de un circuito cuenta como retenido (10) SOLO en corrientes y SOLO en las
//     horas en que la suma con ese valor queda a ±10 % de TODAS las fases de referencia válidas del transformador (dos
//     pasadas: la primera, estricta, calcula el cuadre y las fases de referencia del mes);
//   · D2 las tres fases salen de la suma;
//   · D3 un circuito con sus tres corrientes en cero y la tensión del transformador válida APORTA 0 (todos abiertos con
//     tensión → fuera de servicio, 9; sin tensión → cero, 6);
//   · D4 un mes cuya suma no cuadra (menos de 2 fases a ±10 %) da cifra PROVISIONAL con su motivo;
//   · D5 solo con la casilla «la barra de este nivel la alimenta solo este transformador», y nunca si otro transformador
//     de la estación mide ese nivel.
// Dónde vive: los circuitos se importan como medidas REALES con su nombre; la suma se calcula al importar y se guarda
// SOLO como resumen mensual derivado, aparte (`scada_resumen/{mes}.claves['<cid>--suma']`, con su sello `derivado`).
// Nunca se escribe en la clave del transformador, ni como serie, ni como punto del catálogo. Las curvas se suman al leer
// con estas MISMAS funciones (la cifra del mes es la misma en la lista y en el detalle).
// Tensión, P y Q del nivel = las del transformador (rotuladas): así el chequeo potencia/corriente hace de testigo.
// Los nombres de los circuitos salen SIEMPRE de la decisión guardada en la base: aquí no hay ningún nombre real.
// Funciones PURAS: ninguna modifica lo que recibe. Archivo NUEVO (L-102): solo importa exportaciones ya publicadas.
// ══════════════════════════════════════════════════════════════════════════════

import { CODIGO, CODIGOS_VALIDOS, FAMILIAS_I, FAMILIAS_U, NIVELES, DEVANADO } from './scada_carga_config.js';
import { normalizarTexto, claveId, esElementoTransformador } from './scada_carga_csv.js';
import { analizarClaveHomologada, claveEfectiva, objetivoImportacion, mapaDeDecision } from './scada_carga_homologacion.js';
import { resumenFisico, percentilOrdenado } from './scada_carga_kpis.js';
import { resumirParaGuardar } from './scada_carga_importacion.js';
import { validos } from './scada_carga_limpieza.js';
import { horasMes } from './scada_carga_series.js';
import { nombreMes } from './scada_carga_fecha.js';

/** Parámetros de la suma. Cambiar uno exige subir `version` (los derivados viejos dejan de leerse y se recargan). */
export const SUMA = Object.freeze({
  version: 1,
  tipo: 'suma_circuitos',
  sufijo: '--suma',
  tolCuadre: 0.10,        // una fase del transformador «cuadra» si transformador ÷ suma está a ±10 % de 1
  pisoCuadre: 0.05,       // horas de comparación: suma ≥ 5 % de su p99 (con carga apreciable)
  minHorasCuadre: 24,
  minFasesCuadran: 2,
  bandaMuerta: true,      // D1
  abiertoAporta0: true,   // D3
  maxCircuitos: 8,
  fases: Object.freeze(['IR', 'IS', 'IT'])   // D2: las tres
});

const CRITERIO = 'corrientes: suma hora por hora de los circuitos (todos válidos; circuito abierto con tensión = 0; banda muerta '
  + 'validada a ±10 % con las fases de referencia del transformador); tensión, P y Q: del transformador';
const valida = (c) => CODIGOS_VALIDOS.includes(c);
const red3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const ordenado = (a) => [...a].sort((x, y) => x - y);
const FASE_CORTA = { IR: 'R', IS: 'S', IT: 'T' };
const coma = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
/** Rango «a–b» con los números YA formateados: si se leen iguales, uno solo (nunca «1,00–1,00»). */
const rango = (min, max) => (coma(min) === coma(max) ? coma(min) : coma(min) + '–' + coma(max));

/**
 * Huella de la medida del transformador en un nivel: horas válidas y p99 de su resumen de siempre (el mismo cálculo que
 * `procesarPuntoMes`). Un derivado compuesto con OTRA medida del transformador (se recargó el mes sin la suma) ya no vale.
 */
const huellaDe = (r) => (r && r.i ? { n: r.i.n == null ? null : r.i.n, p99: r.i.p99 == null ? null : r.i.p99 } : null);
const huellaBarra = (barra, nv) => (barra ? huellaDe(resumirParaGuardar(resumenFisico(barra, NIVELES[nv].kv), barra)) : null);
const mismaHuella = (a, b) => (a == null && b == null) || (!!a && !!b && a.n === b.n && a.p99 === b.p99);

/** D5: otros transformadores (sw*) de la estación que miden ese nivel en el catálogo (sus elementos, en orden). */
function otrosTransformadores(puntos, cidTrafo, est, nv) {
  const e = normalizarTexto(est); const out = [];
  for (const [cid, p] of Object.entries(puntos || {})) {
    if (cid === cidTrafo || !p || normalizarTexto(p.est) !== e || !esElementoTransformador(p.elem)) continue;
    if (p.niveles && p.niveles[nv]) out.push(p.elem);
  }
  return out.sort((a, b) => normalizarTexto(a).localeCompare(normalizarTexto(b)));
}

/** Clave del resumen derivado de un punto: '<cid>--suma'. */
export function claveSuma(cid) { return cid + SUMA.sufijo; }

/** Firma de una suma: la versión, el nivel, los circuitos y las fases (el orden y las mayúsculas no la cambian). */
export function firmaSuma(nv, cids, fases) {
  const c = [...new Set((cids || []).map((x) => normalizarTexto(x)))].sort();
  const f = FAMILIAS_I.filter((x) => (fases || []).map((y) => String(y).toUpperCase()).includes(x));
  return 'v' + SUMA.version + '|' + nv + '|' + c.join('+') + '|' + f.join(',');
}

/**
 * Elementos de la lista `de` de una decisión, sin repetidos (por texto comparable) y en orden. Un '/estación/elemento' de
 * la MISMA estación vale por su elemento; cualquier otra cosa se conserva tal cual (no se descarta en silencio: queda como
 * un circuito que nunca llega y el nivel sale sin cifra, y `erroresSuma` lo señala al guardar).
 */
function elementosDe(de, est) {
  const vistos = new Set(); const out = [];
  for (const x of Array.isArray(de) ? de : []) {
    let t = String(x == null ? '' : x).trim();
    if (!t) continue;
    const k = analizarClaveHomologada(t);
    if (k && normalizarTexto(k.est) === normalizarTexto(est)) t = k.elem;
    const n = normalizarTexto(t);
    if (vistos.has(n)) continue;
    vistos.add(n); out.push(t);
  }
  return out.sort((a, b) => normalizarTexto(a).localeCompare(normalizarTexto(b)));
}
const fasesDe = (x) => {
  const f = FAMILIAS_I.filter((y) => (Array.isArray(x) ? x : []).map((z) => String(z).toUpperCase()).includes(y));
  return f.length ? f : [...SUMA.fases];
};

/**
 * La suma que decidió el Ingeniero para una fila, normalizada; null si no hay. Solo con decisión «usar», fila no
 * retirada y en niveles ASIGNADOS a un devanado en su mapa.
 * @returns {null|{cid, est, elem, porNivel: Object<string, {nivel, devanado, elems: string[], cids: string[],
 *   fases: string[], firma: string, barraPropia: boolean}>}}
 */
export function especSuma(fila) {
  const d = fila && fila.decision;
  if (!fila || fila.retirada || !d || d.tipo !== 'usar' || !d.suma || typeof d.suma !== 'object') return null;
  const k = analizarClaveHomologada(claveEfectiva(fila));
  if (!k) return null;
  const mapa = mapaDeDecision(fila) || {};
  const porNivel = {};
  for (const nv of Object.keys(d.suma).sort()) {
    const s = d.suma[nv];
    if (!NIVELES[nv] || !mapa[nv] || !s || typeof s !== 'object') continue;
    const elems = elementosDe(s.de, k.est);
    if (!elems.length) continue;
    const cids = elems.map((e) => claveId(k.est, e));
    const fases = fasesDe(s.fases);
    porNivel[nv] = { nivel: nv, devanado: mapa[nv], elems, cids, fases, firma: firmaSuma(nv, cids, fases), barraPropia: s.barra_propia === true };
  }
  return Object.keys(porNivel).length ? { cid: claveId(k.est, k.elem), est: k.est, elem: k.elem, porNivel } : null;
}

/**
 * Objetivo de la importación con las sumas: el de siempre (`objetivoImportacion`, mismas estaciones) MÁS los circuitos de
 * cada suma, que son de la misma estación. Las filas «no usar» y las retiradas no aportan circuitos.
 */
export function objetivoConSumas(filas) {
  const base = objetivoImportacion(filas);
  const extra = new Map();
  for (const f of Object.values(filas || {})) {
    const s = especSuma(f);
    if (!s) continue;
    const est = normalizarTexto(s.est);
    if (!extra.has(est)) extra.set(est, new Set());
    for (const x of Object.values(s.porNivel)) for (const e of x.elems) extra.get(est).add(normalizarTexto(e));
  }
  return {
    estaciones: base.estaciones,
    quiere(est, elem) { return base.quiere(est, elem) || (extra.has(est) && extra.get(est).has(elem)); }
  };
}

/** ¿Alguna tensión del transformador vale en esa hora? */
const tensionValida = (barra, h) => !!barra && FAMILIAS_U.some((f) => barra[f] && valida(barra[f].m[h]));

/**
 * Circuito ABIERTO en la hora h (D3): sus tres corrientes en cero (6) —o fuera de servicio por su propia tensión (9)— y la
 * tensión del transformador en ese nivel válida. Sin tensión no se sabe: es un cero sin explicación (hueco).
 */
function abierto(s, barra, h) {
  if (!s || !FAMILIAS_I.every((f) => s[f])) return false;
  let todas9 = true;
  for (const f of FAMILIAS_I) {
    const c = s[f].m[h];
    if (c !== CODIGO.CERO && c !== CODIGO.DESENERGIZADO) return false;
    if (c !== CODIGO.DESENERGIZADO) todas9 = false;
  }
  return todas9 || tensionValida(barra, h);
}

const largoDe = (fuentes, barra) => {
  for (const x of [barra, ...(fuentes || [])]) {
    const s = x && (x.IR || x.IS || x.IT || Object.values(x)[0]);
    if (s && s.v) return s.v.length;
  }
  return 0;
};

/**
 * Corrientes de UN nivel como suma de los circuitos, hora por hora y fase por fase (siempre las tres: el cuadre las usa
 * todas; `componerNivel` decide cuáles salen de la suma). Reglas:
 *   · la hora vale en una fase si TODOS los circuitos valen en ella (0 o 10): el valor es la suma y el código el peor;
 *   · si a un circuito le falta el dato o falla, la hora queda como hueco con el código de ESE circuito (1 si no hay
 *     documento): nunca una suma parcial (subestima en silencio);
 *   · circuito abierto (D3) aporta 0; todos abiertos → fuera de servicio (9);
 *   · con `referencias` (D1, segunda pasada): un «congelado» (5) cuenta como retenido (10) solo en las horas en que la
 *     suma con ese valor queda a ±10 % de TODAS las fases de referencia válidas del transformador; sin referencia, hueco.
 * Las fases sumadas no llevan máximo, mínimo ni instantáneo (los picos de los circuitos no coinciden). Arreglos nuevos.
 * @param {Array<Object<string, {v, m, b}>|null>} fuentes  familias de cada circuito en ese nivel (null = sin documento)
 * @param {Object<string, {v, m, b}>|null} barra  familias del transformador en ese nivel
 * @param {{n?: number, referencias?: string[]|null}} [op]
 * @returns {{fam: {IR, IS, IT}, horas: {total, completas, bandaMuerta, rechazadas, abiertas, fueraServicio, hueco}}}
 */
export function sumarNivel(fuentes, barra, { n = null, referencias = null } = {}) {
  const fs = Array.isArray(fuentes) ? fuentes : [];
  const N = n != null ? n : largoDe(fs, barra);
  const fam = {};
  for (const F of FAMILIAS_I) fam[F] = { v: new Float32Array(N).fill(NaN), m: new Uint8Array(N).fill(CODIGO.SIN_ARCHIVO), b: new Uint8Array(N) };
  const horas = { total: N, completas: 0, bandaMuerta: 0, rechazadas: 0, abiertas: 0, fueraServicio: 0, hueco: 0 };
  const refs = Array.isArray(referencias) && referencias.length ? referencias : null;
  const tol = SUMA.tolCuadre;
  let ab = [];
  // Suma de una fase en la hora h; `conCongelado` = segunda pasada (D1).
  const sumaHora = (F, h, conCongelado) => {
    let suma = 0; let b = 0; let codigo = null; let ret = false;
    for (let i = 0; i < fs.length; i++) {
      const x = fs[i] && fs[i][F];
      if (x && valida(x.m[h])) { suma += x.v[h]; if (x.b[h] > b) b = x.b[h]; if (x.m[h] === CODIGO.RETENIDO) ret = true; continue; }
      if (ab[i]) continue;   // abierto: aporta 0
      if (conCongelado && x && x.m[h] === CODIGO.CONGELADO && Number.isFinite(x.v[h])) { suma += x.v[h]; if (x.b[h] > b) b = x.b[h]; ret = true; continue; }
      if (codigo == null) codigo = x ? x.m[h] : CODIGO.SIN_ARCHIVO;
    }
    return { suma, b, codigo, ret };
  };
  // ¿La hora cuadra con TODAS las fases de referencia válidas del transformador (con los congelados aceptados)?
  const horaValidada = (h) => {
    let k = 0;
    for (const G of refs) {
      const r = barra && barra[G];
      if (!r || !valida(r.m[h])) continue;
      const y = sumaHora(G, h, true);
      if (y.codigo != null || !(y.suma > 0) || Math.abs(r.v[h] / y.suma - 1) > tol) return false;
      k++;
    }
    return k > 0;
  };
  for (let h = 0; h < N; h++) {
    ab = SUMA.abiertoAporta0 ? fs.map((s) => abierto(s, barra, h)) : fs.map(() => false);
    const abiertos = ab.filter(Boolean).length;
    if (fs.length && abiertos === fs.length) {
      for (const F of FAMILIAS_I) {
        fam[F].v[h] = 0; fam[F].m[h] = CODIGO.DESENERGIZADO;
        for (const s of fs) if (s && s[F] && s[F].b[h] > fam[F].b[h]) fam[F].b[h] = s[F].b[h];
      }
      horas.fueraServicio++;
      continue;
    }
    let validada = -1; let bm = false; let rech = false; let hueco = false;
    for (const F of FAMILIAS_I) {
      let x = sumaHora(F, h, false);
      let porBanda = false;
      if (x.codigo === CODIGO.CONGELADO && refs) {
        const y = sumaHora(F, h, true);
        if (y.codigo == null) {
          if (validada < 0) validada = horaValidada(h) ? 1 : 0;
          if (validada) { x = y; porBanda = true; } else rech = true;
        }
      }
      if (x.codigo == null) {
        fam[F].v[h] = x.suma; fam[F].m[h] = x.ret ? CODIGO.RETENIDO : CODIGO.VALIDO; fam[F].b[h] = x.b;
        if (porBanda) bm = true;
      } else { fam[F].m[h] = x.codigo; hueco = true; }
    }
    // La banda muerta y los circuitos abiertos se cuentan SOLO en las horas con las tres fases: son parte de las completas.
    if (!hueco) {
      horas.completas++;
      if (bm) horas.bandaMuerta++;
      if (abiertos > 0) horas.abiertas++;
    } else horas.hueco++;
    if (rech) horas.rechazadas++;
  }
  return { fam, horas };
}

/**
 * Cuadre de la suma con la medida del PROPIO transformador en ese nivel, por fase: mediana de (transformador ÷ suma) en
 * las horas con las dos válidas y la suma ≥ 5 % de su p99, con al menos 24 horas. Una fase cuadra si está a ±10 % de 1.
 * Veredicto: 'ok' con al menos 2 fases que cuadran; 'no_cuadra' si se compararon 2 o más y cuadran menos de 2;
 * 'sin_contraste' con menos de 2 fases comparables. Las que cuadran son las fases de REFERENCIA del mes (D1).
 * @returns {{porFase: Object<string, {n, razon, p10, p90, cuadra: boolean|null, nota}>, comparadas, cuadran,
 *   referencias: string[], veredicto: 'ok'|'no_cuadra'|'sin_contraste'}}
 */
export function cuadreSuma(suma, barra) {
  const porFase = {};
  for (const F of FAMILIAS_I) {
    const d = suma && suma[F]; const r = barra && barra[F];
    if (!d || !r) { porFase[F] = { n: 0, razon: null, p10: null, p90: null, cuadra: null, nota: 'sin_dato' }; continue; }
    const abs = [];
    for (let h = 0; h < d.v.length; h++) if (valida(d.m[h]) && Number.isFinite(d.v[h])) abs.push(Math.abs(d.v[h]));
    const piso = SUMA.pisoCuadre * (percentilOrdenado(ordenado(abs), 0.99) || 0);
    const raz = [];
    for (let h = 0; h < d.v.length; h++) {
      if (!valida(d.m[h]) || !valida(r.m[h]) || !Number.isFinite(r.v[h])) continue;
      if (!(Math.abs(d.v[h]) > piso)) continue;
      raz.push(r.v[h] / d.v[h]);
    }
    const o = ordenado(raz);
    const md = percentilOrdenado(o, 0.5);
    if (raz.length < SUMA.minHorasCuadre) { porFase[F] = { n: raz.length, razon: red3(md), p10: null, p90: null, cuadra: null, nota: 'pocas_horas' }; continue; }
    const cuadra = Math.abs(md - 1) <= SUMA.tolCuadre;
    porFase[F] = { n: raz.length, razon: red3(md), p10: red3(percentilOrdenado(o, 0.1)), p90: red3(percentilOrdenado(o, 0.9)), cuadra, nota: cuadra ? 'cuadra' : 'distinta' };
  }
  const comparadas = FAMILIAS_I.filter((F) => porFase[F].cuadra != null);
  const referencias = comparadas.filter((F) => porFase[F].cuadra);
  const veredicto = comparadas.length < SUMA.minFasesCuadran ? 'sin_contraste' : (referencias.length >= SUMA.minFasesCuadran ? 'ok' : 'no_cuadra');
  return { porFase, comparadas: comparadas.length, cuadran: referencias.length, referencias, veredicto };
}

/** Copia de una serie limpia (valor, código, bandera y extras): nunca se toca la de la caché. */
function copia(s) {
  const out = { v: new Float32Array(s.v), m: new Uint8Array(s.m), b: new Uint8Array(s.b) };
  for (const k of ['max', 'min', 'ins']) if (s[k]) out[k] = new Float32Array(s[k]);
  return out;
}

/** Signo de la mediana de la P válida de cada circuito (1, −1; 0 sin dato). Solo informa: la cifra usa corrientes. */
function signosP(fuentes) {
  return (fuentes || []).map((s) => {
    if (!s || !s.P) return 0;
    const v = []; const x = validos(s.P);
    for (let h = 0; h < x.length; h++) if (Number.isFinite(x[h])) v.push(x[h]);
    const md = percentilOrdenado(ordenado(v), 0.5);
    return md == null || md === 0 ? 0 : Math.sign(md);
  });
}

/**
 * Nivel DERIVADO completo, en dos pasadas (D1): la primera, estricta, da el cuadre y las fases de referencia; la segunda
 * acepta la banda muerta validada. Las fases de `fases` (D2) salen de la suma; las demás, del transformador. Tensión, P y Q
 * del transformador (copias). Sin barra (el transformador no trajo ese nivel ese mes) quedan solo las corrientes sumadas.
 * @returns {{fam, horas, cuadre, referencias: string[], veredicto, signosP: number[]}}
 */
export function componerNivel({ fuentes, barra, n = null, fases = SUMA.fases }) {
  const N = n != null ? n : largoDe(fuentes, barra);
  const estricta = sumarNivel(fuentes, barra, { n: N });
  const cuadre = cuadreSuma(estricta.fam, barra);
  const final = SUMA.bandaMuerta && cuadre.referencias.length ? sumarNivel(fuentes, barra, { n: N, referencias: cuadre.referencias }) : estricta;
  const fam = {};
  const usar = fasesDe(fases);
  for (const F of FAMILIAS_I) {
    if (usar.includes(F)) fam[F] = final.fam[F];
    else if (barra && barra[F]) fam[F] = copia(barra[F]);
  }
  for (const F of [...FAMILIAS_U, 'P', 'Q']) if (barra && barra[F]) fam[F] = copia(barra[F]);
  return { fam, horas: final.horas, cuadre, referencias: cuadre.referencias, veredicto: cuadre.veredicto, signosP: signosP(fuentes) };
}

const sello = (sp, base) => ({ tipo: SUMA.tipo, v: SUMA.version, firma: sp.firma, de: [...sp.elems], fases: [...sp.fases], base });
/** Lo que se guarda del cuadre (mapas y números: nada de listas dentro de listas, L-30). */
const cuadreGuardado = (c) => ({ porFase: c.porFase, comparadas: c.comparadas, cuadran: c.cuadran, veredicto: c.veredicto });
/**
 * Registro de reemplazo de un nivel sin suma válida: tapa el derivado viejo (nunca queda uno desactualizado). `extra` =
 * listas de texto que explican el estado: `faltan` (no llegaron), `sinNivel` (llegaron sin ese nivel), `otros` (otros
 * transformadores que miden la barra, D5). Solo se guardan las listas con algo (Firestore no admite `undefined`).
 */
function registroSinSuma(selloNivel, estado, extra = {}) {
  const d = { ...selloNivel, estado };
  for (const [k, v] of Object.entries(extra || {})) if (Array.isArray(v) && v.length) d[k] = [...v];
  return { i: { n: 0 }, derivado: d };
}

/**
 * Familias de cada circuito en el nivel (null = no llegó o no trae el nivel). `faltan` = los que no llegaron (sin serie);
 * `sinNivel` = los que llegaron pero no miden ese nivel (nivel o nombre mal escrito en la decisión).
 */
function fuentesDe(sp, nv, serieDe) {
  const series = sp.cids.map((c) => serieDe(c) || null);
  const fuentes = series.map((s) => (s && s.niveles && s.niveles[nv] && s.niveles[nv].fam ? s.niveles[nv].fam : null));
  return { fuentes, faltan: sp.elems.filter((e, i) => !series[i]), sinNivel: sp.elems.filter((e, i) => series[i] && !fuentes[i]) };
}

/** El nivel sumado ya compuesto, en su derivado: estado 'ok' o el registro sin cifra (falta / sin_nivel). */
function derivadoCompuesto(se, c, faltan, sinNivel, barra, nv) {
  if (faltan.length) return registroSinSuma(se, 'falta', { faltan }).derivado;
  if (sinNivel.length) return registroSinSuma(se, 'sin_nivel', { sinNivel }).derivado;
  return { ...se, estado: 'ok', base_i: huellaBarra(barra, nv), horas: c.horas, cuadre: cuadreGuardado(c.cuadre), referencias: c.referencias, veredicto: c.veredicto, signosP: c.signosP, criterio: CRITERIO };
}

/**
 * Resúmenes DERIVADOS de un mes, al final de la importación. Por cada fila con suma cuyo transformador vino en la carga:
 * `{'<cid>--suma': {nivel: {...resumen de siempre (con `top`), derivado: {tipo, v, firma, de, fases, base, estado:'ok',
 * base_i, horas, cuadre, referencias, veredicto, signosP, criterio}}}}` (`base_i` = la huella de la medida del
 * transformador con que se compuso). Si falta un circuito: `{i: {n: 0}, derivado: {…, estado: 'falta', faltan}}`; si un
 * circuito llegó sin ese nivel: `estado: 'sin_nivel'`. Si llegaron circuitos de la suma SIN el transformador, sus series
 * cambian y el derivado guardado quedaría viejo: se tapa con `estado: 'falta'` y el transformador en `faltan`.
 * NUNCA toca la clave del transformador (ni nada de lo que recibe).
 * @param {{mes: string, porCid: Object<string, {niveles: Object<string, {fam}>}>, filas: Object<string, object>}} p
 */
export function derivadosDelMes({ mes, porCid, filas }) {
  const out = {};
  const n = horasMes(mes);
  for (const f of Object.values(filas || {})) {
    const s = especSuma(f);
    if (!s || !porCid) continue;
    const trafo = porCid[s.cid] || null;
    const reg = {};
    if (!trafo) {
      // Sin el transformador no se puede recalcular; si tampoco llegó ningún circuito de la suma, no cambió nada.
      if (!Object.values(s.porNivel).some((sp) => sp.cids.some((c) => porCid[c]))) continue;
      for (const [nv, sp] of Object.entries(s.porNivel)) reg[nv] = registroSinSuma(sello(sp, s.cid), 'falta', { faltan: [s.elem] });
      out[claveSuma(s.cid)] = reg;
      continue;
    }
    for (const [nv, sp] of Object.entries(s.porNivel)) {
      const se = sello(sp, s.cid);
      const { fuentes, faltan, sinNivel } = fuentesDe(sp, nv, (c) => porCid[c]);
      if (faltan.length || sinNivel.length) { reg[nv] = { i: { n: 0 }, derivado: derivadoCompuesto(se, null, faltan, sinNivel) }; continue; }
      const barra = trafo.niveles && trafo.niveles[nv] ? trafo.niveles[nv].fam : null;
      const c = componerNivel({ fuentes, barra, n, fases: sp.fases });
      reg[nv] = {
        ...resumirParaGuardar(resumenFisico(c.fam, NIVELES[nv].kv), c.fam),
        derivado: derivadoCompuesto(se, c, faltan, sinNivel, barra, nv)
      };
    }
    if (Object.keys(reg).length) out[claveSuma(s.cid)] = reg;
  }
  return out;
}

/**
 * Serie de UN mes del transformador con sus niveles sumados (para VER: detalle, historia y verificación de sobrecarga).
 * Se compone con el mes COMPLETO, antes de cualquier recorte de rango, con las mismas funciones del importador.
 * Con `guardadas` (las claves del resumen GUARDADO de ese mes) rige el mismo candado de la lista: si el derivado guardado
 * no vale (falta, otra firma, otra versión, medida del transformador distinta), el derivado del mes es ese registro sin
 * cifra, aunque las curvas se puedan sumar. Con `puntos` (el catálogo), D5: si otro transformador de la estación mide
 * ese nivel, el derivado del mes queda en 'barra_compartida'.
 * @param {{mes: string, trafo: {niveles}, circuitos: Object<string, {niveles}|null>, spec: object, guardadas?: object,
 *   puntos?: object}} p
 * @returns {{serie: object, derivado: Object<string, object>}}  la serie es un objeto nuevo; sus niveles sumados, copias
 */
export function componerSerieMes({ mes, trafo, circuitos, spec, guardadas = null, puntos = null }) {
  const n = horasMes(mes);
  const niveles = { ...((trafo && trafo.niveles) || {}) };
  const derivado = {};
  for (const [nv, sp] of Object.entries((spec && spec.porNivel) || {})) {
    const se = sello(sp, spec.cid);
    const { fuentes, faltan, sinNivel } = fuentesDe(sp, nv, (c) => (circuitos ? circuitos[c] : null));
    const barra = niveles[nv] && niveles[nv].fam ? niveles[nv].fam : null;
    const c = componerNivel({ fuentes, barra, n, fases: sp.fases });
    niveles[nv] = { kv: NIVELES[nv].kv, fam: c.fam };
    derivado[nv] = derivadoCompuesto(se, c, faltan, sinNivel, barra, nv);
    const otros = otrosTransformadores(puntos, spec.cid, spec.est, nv);
    if (otros.length) derivado[nv] = registroSinSuma(se, 'barra_compartida', { otros }).derivado;
    else if (guardadas) {
      const g = nivelGuardado(guardadas, spec.cid, sp);
      if (g.derivado.estado !== 'ok') derivado[nv] = g.derivado;
    }
  }
  return { serie: { ...(trafo || {}), niveles }, derivado };
}

/**
 * Estado de la suma de un nivel en un resumen (mensual, del periodo o del rango del detalle).
 * @param {object|null} r   resumen del nivel (con `derivado`)
 * @param {object} sp       `especSuma(fila).porNivel[nivel]`
 * @returns {{estado: 'ok'|'falta'|'otra_firma'|'otra_version'|'sin_barra'|'sin_nivel'|'barra_compartida'|'desfasado',
 *   veredicto: string|null, motivo: string|null, aviso: string|null}}
 *   `motivo` = por qué el nivel no da cifra; `aviso` = por qué la cifra es provisional (D4)
 */
export function estadoSumaNivel(r, sp) {
  const et = sp && NIVELES[sp.nivel] ? NIVELES[sp.nivel].etiqueta : 'este nivel';
  const no = (estado, motivo) => ({ estado, veredicto: null, motivo, aviso: null });
  if (sp && !sp.barraPropia) return no('sin_barra', 'falta confirmar que la barra de ' + et + ' la alimenta solo este transformador');
  const d = r && r.derivado;
  const falta = (meses, faltan) => {
    if (meses && meses.length) return 'falta calcular la suma de circuitos de ' + meses.map(nombreMes).join(', ') + ': vuelva a ' + (meses.length === 1 ? 'cargarlo' : 'cargarlos');
    if (faltan && faltan.length) return 'falta calcular la suma de circuitos de este mes (no llegó ' + faltan.join(' ni ') + '): vuelva a cargarlo con ' + (faltan.length === 1 ? 'esa medida' : 'esas medidas');
    return 'falta calcular la suma de circuitos de este mes: vuelva a cargarlo';
  };
  if (!d) return no('falta', falta());
  if (d.v !== SUMA.version) return no('otra_version', falta(d.meses));
  if (sp && d.firma !== sp.firma) return no('otra_firma', falta(d.meses));
  // D5 después de guardar: apareció otro transformador de la estación que mide la barra.
  if (d.estado === 'barra_compartida') {
    const o = Array.isArray(d.otros) && d.otros.length ? ' (' + d.otros.join(', ') + ')' : '';
    return no('barra_compartida', 'otro transformador de la estación' + o + ' también mide ' + et + ': la barra puede ser compartida y la suma de circuitos no se puede usar');
  }
  // Un circuito que SÍ llegó pero no mide el nivel: volver a cargar no lo arregla (es la decisión la que está mal).
  if (d.estado === 'sin_nivel') {
    const s = Array.isArray(d.sinNivel) ? d.sinNivel : [];
    return no('sin_nivel', (s.length ? s.join(' y ') + (s.length === 1 ? ' llegó pero no mide ' : ' llegaron pero no miden ') : 'un circuito de la suma no mide ')
      + et + ': revise el nivel o el nombre del circuito en la homologación');
  }
  if (d.estado !== 'ok') return no(d.estado === 'falta' ? 'falta' : String(d.estado || 'falta'), falta(d.meses, d.faltan));
  const veredicto = d.veredicto || null;
  const aviso = veredicto === 'no_cuadra' ? 'la suma de circuitos no cuadra con el transformador'
    : (veredicto === 'sin_contraste' ? 'la suma de circuitos no se pudo contrastar con el transformador' : null);
  return { estado: 'ok', veredicto, motivo: null, aviso };
}

/**
 * El nivel sumado de un mes en un resumen guardado: su derivado VÁLIDO (misma firma, versión y huella de la medida del
 * transformador) o, si no, un registro sin cifra que dice por qué. Con `puntos`, D5 (otro transformador mide la barra).
 */
function nivelGuardado(claves, cid, sp, puntos = null, est = null) {
  const der = (claves && claves[claveSuma(cid)]) || {};
  const r = der[sp.nivel] || null;
  const se = sello(sp, cid);
  const otros = puntos ? otrosTransformadores(puntos, cid, est, sp.nivel) : [];
  if (otros.length) return registroSinSuma(se, 'barra_compartida', { otros });
  const e = estadoSumaNivel(r, { ...sp, barraPropia: true });
  const d0 = r && r.derivado;
  if (e.estado !== 'ok') return registroSinSuma(se, e.estado, d0 && d0.estado === e.estado ? { faltan: d0.faltan, sinNivel: d0.sinNivel, otros: d0.otros } : {});
  // La medida del transformador cambió después de calcular la suma (se recargó el mes sin ella): ya no vale.
  const base = claves && claves[cid] ? claves[cid][sp.nivel] || null : null;
  if (!mismaHuella(d0.base_i == null ? null : d0.base_i, huellaDe(base))) return registroSinSuma(se, 'desfasado');
  return r;
}

/**
 * Resumen guardado de un punto con sus niveles sumados: el del transformador con cada nivel de la suma reemplazado por
 * su derivado VÁLIDO (misma firma, versión y medida del transformador) o, si no lo hay, por un registro sin cifra que
 * dice por qué. Con `puntos` (el catálogo) aplica D5 también después de guardar la decisión. Sin suma devuelve
 * EXACTAMENTE lo mismo que recibe (el mismo objeto). Nunca modifica `claves`.
 */
export function componerResumen(claves, cid, fila, puntos = null) {
  const base = claves && cid ? claves[cid] || null : null;
  const s = especSuma(fila);
  if (!s || !base || s.cid !== cid) return base;
  const out = { ...base };
  for (const sp of Object.values(s.porNivel)) out[sp.nivel] = nivelGuardado(claves, cid, sp, puntos, s.est);
  return out;
}

const PESO_VEREDICTO = { ok: 0, sin_contraste: 1, no_cuadra: 2 };
// Estados que volver a cargar NO arregla: pasan al periodo con su propio motivo (no «falta calcular…»).
const BLOQUEOS = ['barra_compartida', 'sin_nivel'];

/**
 * Derivado de VARIOS meses (periodo de la lista o rango del detalle): válido solo si cada mes con datos del transformador
 * trae su derivado válido; si no, `estado: 'falta'` con esos meses (o el bloqueo que traiga alguno: barra compartida o
 * circuito sin ese nivel, con sus nombres). El veredicto es el peor de los meses.
 * @param {Array<{mes: string, derivado: object|null}>} meses  solo los meses con datos del transformador
 * @param {object} sp  `especSuma(fila).porNivel[nivel]`
 */
export function derivadoDeMeses(meses, sp) {
  const faltan = []; let peor = null; const noCuadran = [];
  const razones = {}; const horas = { completas: 0, bandaMuerta: 0, rechazadas: 0, abiertas: 0, fueraServicio: 0, hueco: 0 };
  let bloqueo = null; const otros = new Set(); const sinNivel = new Set();
  for (const { mes, derivado: d } of meses || []) {
    if (!d || d.estado !== 'ok' || d.v !== SUMA.version || d.firma !== sp.firma) {
      faltan.push(mes);
      if (d && d.v === SUMA.version && d.firma === sp.firma && BLOQUEOS.includes(d.estado)) {
        if (bloqueo == null || BLOQUEOS.indexOf(d.estado) < BLOQUEOS.indexOf(bloqueo)) bloqueo = d.estado;
        for (const x of d.otros || []) otros.add(x);
        for (const x of d.sinNivel || []) sinNivel.add(x);
      }
      continue;
    }
    const v = d.veredicto || 'sin_contraste';
    if (peor == null || PESO_VEREDICTO[v] > PESO_VEREDICTO[peor]) peor = v;
    if (v !== 'ok') noCuadran.push(mes);
    for (const k of Object.keys(horas)) horas[k] += (d.horas && d.horas[k]) || 0;
    const pf = (d.cuadre && d.cuadre.porFase) || {};
    for (const F of FAMILIAS_I) {
      const x = pf[F] && pf[F].razon;
      if (x == null || !Number.isFinite(x)) continue;
      const g = razones[F] || (razones[F] = { min: x, max: x });
      g.min = Math.min(g.min, x); g.max = Math.max(g.max, x);
    }
  }
  return {
    tipo: SUMA.tipo, v: SUMA.version, firma: sp.firma, de: [...sp.elems], fases: [...sp.fases],
    estado: faltan.length ? (bloqueo || 'falta') : 'ok', ...(faltan.length ? { meses: faltan.sort() } : {}),
    ...(bloqueo === 'barra_compartida' && otros.size ? { otros: [...otros].sort() } : {}),
    ...(bloqueo === 'sin_nivel' && sinNivel.size ? { sinNivel: [...sinNivel].sort() } : {}),
    veredicto: peor, mesesNoCuadran: noCuadran.sort(), razones, horas
  };
}

/**
 * Errores (texto llano) de las sumas de una decisión ANTES de guardarla; vacío = se puede guardar (D5 incluida).
 * @param {object} fila      la fila de la homologación (con su clave)
 * @param {object} decision  la decisión que se va a guardar (con `mapa` y `suma`)
 * @param {{filas?: Object<string, object>, puntos?: Object<string, object>, filaId?: string}} ctx
 *   `filas` = toda la homologación vigente; `puntos` = el catálogo; `filaId` = el id de esta fila
 */
export function erroresSuma(fila, decision, { filas = {}, puntos = {}, filaId = null } = {}) {
  const err = [];
  if (!decision || decision.tipo !== 'usar' || !decision.suma || typeof decision.suma !== 'object') return err;
  const k = analizarClaveHomologada(claveEfectiva({ ...fila, decision }));
  if (!k) { err.push('La fila no tiene un punto SCADA: no se puede medir con la suma de circuitos.'); return err; }
  const est = normalizarTexto(k.est);
  const cidTrafo = claveId(k.est, k.elem);
  const mapa = decision.mapa || {};
  const id = filaId || (fila && fila.id) || null;
  // Lo que ya usan las OTRAS filas vigentes: sus claves y sus circuitos sumados.
  const claveDe = new Map(); const sumadoEn = new Map(); const sumaDe = new Map();
  for (const [fid, g] of Object.entries(filas || {})) {
    if (fid === id || g.retirada || (g.decision && g.decision.tipo === 'no_usar')) continue;
    const kg = analizarClaveHomologada(claveEfectiva(g));
    if (kg) claveDe.set(claveId(kg.est, kg.elem), g.matricula || fid);
    const sg = especSuma(g);
    if (!sg) continue;
    sumaDe.set(sg.cid, g.matricula || fid);
    for (const x of Object.values(sg.porNivel)) for (const c of x.cids) sumadoEn.set(c, g.matricula || fid);
  }
  if (sumaDe.has(cidTrafo)) err.push('Otra fila con la misma medida (' + sumaDe.get(cidTrafo) + ') ya tiene una suma de circuitos.');
  const nivelDe = new Map();   // circuito (texto comparable) → etiqueta del nivel donde ya se sumó en ESTA decisión
  for (const nv of Object.keys(decision.suma).sort()) {
    const s = decision.suma[nv];
    if (!s || typeof s !== 'object') continue;
    const et = NIVELES[nv] ? NIVELES[nv].etiqueta : nv;
    if (!NIVELES[nv]) { err.push('Nivel desconocido: ' + nv + '.'); continue; }
    if (!mapa[nv]) err.push('El nivel ' + et + ' se mide con la suma de circuitos pero no está asignado a ningún devanado.');
    const crudos = (Array.isArray(s.de) ? s.de : []).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    if (!crudos.length) { err.push('Escriba al menos un circuito para el nivel ' + et + '.'); continue; }
    if (crudos.length > SUMA.maxCircuitos) err.push('El nivel ' + et + ' tiene más de ' + SUMA.maxCircuitos + ' circuitos: revise la lista.');
    const vistos = new Set();
    for (const t of crudos) {
      let elem = t;
      const kk = analizarClaveHomologada(t);
      if (kk) {
        if (normalizarTexto(kk.est) !== est) { err.push('«' + t + '» es de otra estación: los circuitos deben ser de la misma estación del transformador.'); continue; }
        elem = kk.elem;
      } else if (t.includes('/')) { err.push('«' + t + '» no es el nombre de un circuito: escriba solo el nombre (sin barras).'); continue; }
      const n = normalizarTexto(elem);
      if (vistos.has(n)) { err.push('«' + elem + '» está repetido en el nivel ' + et + '.'); continue; }
      vistos.add(n);
      if (n === normalizarTexto(k.elem)) { err.push('«' + elem + '» es el propio transformador: no se suma a sí mismo.'); continue; }
      if (esElementoTransformador(elem)) { err.push('«' + elem + '» es un transformador, no un circuito.'); continue; }
      // Un circuito es de UNA barra: en dos niveles de la misma decisión, uno de los dos está mal.
      if (nivelDe.has(n)) { err.push('«' + elem + '» está en la suma de ' + nivelDe.get(n) + ' y de ' + et + ': un circuito es de una sola barra.'); continue; }
      nivelDe.set(n, et);
      const c = claveId(k.est, elem);
      if (sumadoEn.has(c)) err.push('«' + elem + '» ya está en la suma de otra fila (' + sumadoEn.get(c) + ').');
      if (claveDe.has(c)) err.push('«' + elem + '» es la medida de otra fila (' + claveDe.get(c) + ').');
      // Ya está en los datos cargados pero en otro nivel: su suma nunca daría cifra (nivel o nombre equivocado).
      const pc = puntos ? puntos[c] : null;
      if (pc && pc.niveles && Object.keys(pc.niveles).length && !pc.niveles[nv]) {
        const mide = Object.keys(pc.niveles).filter((x) => NIVELES[x]).map((x) => NIVELES[x].etiqueta);
        err.push('«' + elem + '» está en los datos cargados pero no mide ' + et + (mide.length ? ' (mide ' + mide.join(' y ') + ')' : '') + ': revise el nivel o el nombre.');
      }
    }
    // D5: si otro transformador de la estación mide ese nivel, la barra puede ser compartida: no se puede atribuir.
    for (const otro of otrosTransformadores(puntos, cidTrafo, k.est, nv)) {
      err.push('Otro transformador de la estación (' + otro + ') también mide ' + et + ': la barra puede ser compartida y la suma no se puede usar.');
    }
    if (s.barra_propia !== true) err.push('Confirme que la barra de ' + et + ' la alimenta solo este transformador (casilla obligatoria).');
  }
  return err;
}

/**
 * ¿La clave que se va a confirmar para una fila es un circuito que OTRA fila vigente ya suma? Entonces la misma corriente
 * contaría en dos equipos. Devuelve la matrícula (o el id) de esa otra fila, o null. (El caso al revés —sumar un circuito
 * que es la medida de otra fila— lo revisa `erroresSuma`.)
 * @param {string|null} clave  la clave '/estación/elemento' elegida
 * @param {Object<string, object>} filas  la homologación vigente
 * @param {string|null} filaId  el id de la fila que se decide (sus propias sumas no cuentan)
 */
export function claveEnSumaAjena(clave, filas, filaId = null) {
  const k = analizarClaveHomologada(clave);
  if (!k) return null;
  const cid = claveId(k.est, k.elem);
  for (const [fid, g] of Object.entries(filas || {})) {
    if (fid === filaId) continue;
    const s = especSuma(g);
    if (s && Object.values(s.porNivel).some((x) => x.cids.includes(cid))) return g.matricula || fid;
  }
  return null;
}

/**
 * Un alias de elemento (paquete preparado, `99 §181`) no puede tocar un circuito de una suma: lo renombraría o lo
 * escondería en otro punto. Lanza un Error con texto llano; si no toca ninguno, no hace nada.
 * @param {Array<{est, de, a}>} alias
 * @param {Object<string, object>} filas  la homologación vigente (con decisiones)
 */
export function aliasTocaSuma(alias, filas) {
  const sumados = new Map();   // est → Set(elem)
  for (const f of Object.values(filas || {})) {
    const s = especSuma(f);
    if (!s) continue;
    const est = normalizarTexto(s.est);
    if (!sumados.has(est)) sumados.set(est, new Set());
    for (const x of Object.values(s.porNivel)) for (const e of x.elems) sumados.get(est).add(normalizarTexto(e));
  }
  for (const x of alias || []) {
    const set = sumados.get(normalizarTexto(x && x.est));
    if (!set) continue;
    for (const e of [x.de, x.a]) {
      if (set.has(normalizarTexto(e))) {
        throw new Error('Alias ' + String(x.est).trim() + '/' + String(x.de).trim() + '→' + String(x.a).trim() + ': «' + String(e).trim()
          + '» es un circuito de una suma de circuitos; el alias lo cambiaría. Quite el alias o la suma antes de cargar.');
      }
    }
  }
}

/** Cuadre en texto: «R 1,00 · S 2,02 · T 0,99» (un mes) o «S 2,01–2,03» (varios meses). */
export function textoCuadre(derivado) {
  if (!derivado) return null;
  const pf = derivado.cuadre && derivado.cuadre.porFase;
  const rz = derivado.razones;
  const partes = FAMILIAS_I.map((F) => {
    if (rz && rz[F]) return FASE_CORTA[F] + ' ' + rango(rz[F].min, rz[F].max);
    if (pf && pf[F] && pf[F].razon != null) return FASE_CORTA[F] + ' ' + coma(pf[F].razon);
    return null;
  }).filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/**
 * Rótulo llano de una suma: «Secundario por suma de circuitos A + B» (de un nivel o de todos los sumados). Con
 * `derivado`, agrega el cuadre con el transformador y su veredicto.
 */
export function textoSuma(spec, nv = null, { derivado = null } = {}) {
  if (!spec || !spec.porNivel) return null;
  const niveles = (nv ? [nv] : Object.keys(spec.porNivel)).filter((x) => spec.porNivel[x]);
  const partes = niveles.map((x) => {
    const sp = spec.porNivel[x];
    return (sp.devanado && DEVANADO[sp.devanado] ? DEVANADO[sp.devanado] : NIVELES[x].etiqueta) + ' por suma de circuitos ' + sp.elems.join(' + ');
  });
  if (!partes.length) return null;
  let t = partes.join('; ');
  const c = textoCuadre(derivado);
  if (c) {
    const v = { ok: 'cuadra', no_cuadra: 'no cuadra', sin_contraste: 'sin contraste' }[derivado.veredicto] || null;
    t += ' · transformador ÷ suma: ' + c + (v ? ' (' + v + ')' : '');
  }
  return t;
}
