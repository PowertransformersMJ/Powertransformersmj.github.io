// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · MEDIDA COMÚN de transformadores en paralelo (dominio puro) · 2026-11-06
// ──────────────────────────────────────────────────────────────────────────────
// Dos (o más) transformadores gemelos trabajan EN PARALELO detrás de las MISMAS bahías de un nivel: el punto SCADA de ese
// nivel mide la SUMA de todos (se prueba con la reactiva consumida: la impedancia vista es la de los equipos juntos).
// Comparar esa medida con la placa de UNO solo da una cifra del doble. Decisión del Ingeniero (2026-11-06): «mitad de la
// medida común» — cada transformador sale con la medida común dividida entre los n equipos en paralelo, PROVISIONAL y con
// su motivo a la vista: puede ir más cargado si circula corriente entre ellos o si otro sale de servicio.
// La marca: `decision.medida_comun = { <nivel>: valor }` en CADA fila que comparte el punto; la escribe Claude con los datos
// (el diálogo «Revisar» solo la muestra y la conserva). El valor de un nivel tiene DOS formas:
//   · un entero n de 2 a 4 → partes iguales: a cada uno le toca la medida ÷ n;
//   · `{ parte: x, de: n }` → la parte de ESTE transformador (x mayor que 0 y menor que 1, con 3 decimales como mucho) de
//     una medida que comparten n (de 2 a 4). Criterio del Ingeniero (2026-11-06, dos transformadores en paralelo en dos
//     niveles con un tercer nivel que es solo de uno): el nivel de entrada se reparte por el flujo de potencia (la parte del
//     que alimenta además el nivel propio es mayor), así que no es la mitad.
// Nada se escribe multiplicado: la medida guardada es la del SCADA, tal cual; la parte de cada uno se calcula al LEER, en
// dos puntos (`componerResumen` para los resúmenes y `leerSeriesEquipo` para las curvas), así lista, periodo, historia,
// detalle, panel del mes, sobrecarga, DGA/térmico y CSV ven lo mismo.
// Qué lleva la parte: todas las corrientes (percentiles, máximo, promedio, sostenida, horas más altas, extras) y P y Q (de
// ellas salen S y el factor de potencia: con las dos por el mismo factor, el factor de potencia queda igual y S sale por ese
// factor). Nunca las tensiones, ni los conteos de horas, ni las razones sin unidad (rUI) ni los signos, ni un TOPE del
// sistema (`esCentinela`: cambiado dejaría de reconocerse y se vería como un valor real).
// Grupo que ya no cuadra (revisión adversarial 2026-11-06): si una fila del punto declara la marca y el grupo no es
// coherente (falta una fila, otra no la tiene, la tiene en otra forma o con otro número de transformadores, hay más filas
// que ese número, o las partes no suman 100 %), TODAS las filas vigentes de ese punto llevan MEDIDA_COMUN_INCOMPLETA, que
// bloquea y no se puede «ver»: se resuelve arreglando el grupo. Banda muerta o fase sin carga en un nivel común todavía no
// está resuelto: no se deja guardar y ese nivel no se toca.
// Funciones PURAS: ninguna modifica lo que recibe. Archivo NUEVO (L-102): solo importa exportaciones ya publicadas, y no
// importa la homologación (ella lo importa a él, para CLAVE_COMPARTIDA y MEDIDA_COMUN_INCOMPLETA: sin ciclo). Aquí no hay
// ningún nombre real.
// ══════════════════════════════════════════════════════════════════════════════

import { NIVELES, FAMILIAS_I } from './scada_carga_config.js';
import { EXTRAS } from './scada_carga_extras.js';
import { deBytesF32 } from './scada_carga_series.js';
import { esCentinela } from './scada_carga_limpieza.js';

/**
 * Límites de la marca: cuántos transformadores pueden compartir una medida (`min`–`max`), cuántos decimales lleva una
 * parte y entre qué valores debe quedar la suma de las partes de un grupo completo (`sumaMin`–`sumaMax`).
 */
export const MEDIDA_COMUN = Object.freeze({ min: 2, max: 4, tipo: 'medida_comun', decimales: 3, sumaMin: 0.99, sumaMax: 1.01 });

/** Familias de una serie que llevan la parte: las corrientes y las potencias (las tensiones no). */
const FAMILIAS_DIVIDIDAS = Object.freeze([...FAMILIAS_I, 'P', 'Q']);
const esMapa = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const nValido = (n) => typeof n === 'number' && Number.isInteger(n) && n >= MEDIDA_COMUN.min && n <= MEDIDA_COMUN.max;
const ESCALA_DECIMALES = 10 ** MEDIDA_COMUN.decimales;
/** ¿Una parte válida? Número finito mayor que 0 y menor que 1, con 3 decimales como mucho (0,58 sí; 0,5555 no). */
const parteValida = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1
  && Math.abs(x * ESCALA_DECIMALES - Math.round(x * ESCALA_DECIMALES)) < 1e-6;
/** La forma del valor de un nivel: 'entero' (número), 'parte' (mapa) u 'otra' (texto, lista…: nunca válida). */
const formaDe = (v) => (typeof v === 'number' ? 'entero' : esMapa(v) ? 'parte' : 'otra');
const etiquetaDe = (nv) => (NIVELES[nv] ? NIVELES[nv].etiqueta : String(nv));
/** El mapa nivel → devanado DECIDIDO (como `mapaDeDecision`: uno vacío no cuenta). */
const mapaDe = (d) => (d && esMapa(d.mapa) && Object.keys(d.mapa).length ? d.mapa : null);
/** ¿La decisión trae algo en `previas` (cambio de medida)? (como `tienePreviasGuardadas`, sin importar ese archivo). */
const conPrevias = (d) => !!(d && esMapa(d.previas) && Object.keys(d.previas).length);
const enModo = (d, modo, nv) => !!(d && esMapa(d[modo]) && esMapa(d[modo][nv]));
const nombreDe = (g, idPropio) => (idPropio != null && g.id === idPropio ? 'esta fila' : 'la fila ' + (g.matricula || g.id || '(sin matrícula)'));
const mayuscula = (s) => s.replace(/^./, (c) => c.toUpperCase());
const vigente = (g) => !!g && !g.retirada && !(g.decision && g.decision.tipo === 'no_usar');
/** ¿La decisión trae otra marca por nivel (`banda_muerta`, `fases_sin_carga`) en ese nivel? Con la medida común, no resuelto. */
const conMarcaEn = (d, campo, nv) => !!(d && esMapa(d[campo]) && d[campo][nv] != null);
/** Las marcas por nivel que todavía no se combinan con la medida común. */
const MARCAS_SIN_RESOLVER = Object.freeze(['banda_muerta', 'fases_sin_carga']);

/**
 * El valor de UN nivel de la marca, tal como está guardado, normalizado: `{n, parte}` —`parte` null con el entero (la medida
 * ÷ n)— o null si no es válido. Formas: un entero n de 2 a 4, o `{parte, de}` con la parte de este transformador (mayor que
 * 0 y menor que 1, hasta 3 decimales) y `de` = entre cuántos transformadores se reparte (entero de 2 a 4).
 * @returns {null|{n: number, parte: number|null}}
 */
export function repartoMedidaComun(v) {
  if (nValido(v)) return { n: v, parte: null };
  if (esMapa(v) && parteValida(v.parte) && nValido(v.de)) return { n: v.de, parte: v.parte };
  return null;
}

/**
 * El reparto de lo que reciben las funciones de división y de texto: un entero n, el valor guardado `{parte, de}`, o lo ya
 * normalizado (`{n, parte?}`: una entrada de `especMedidaComun` o el `medidaComun` de un nivel de la vista). null si no vale.
 */
function repDe(x) {
  if (esMapa(x) && 'n' in x && !('de' in x)) {
    if (!nValido(x.n)) return null;
    if (x.parte == null) return { n: x.n, parte: null };
    return parteValida(x.parte) ? { n: x.n, parte: x.parte } : null;
  }
  return repartoMedidaComun(x);
}

/**
 * La medida común que decidió el Ingeniero para una fila, normalizada; null sin la marca. Solo con decisión «usar», fila
 * no retirada, sin medidas anteriores y en niveles ASIGNADOS a un devanado en su mapa, con un valor válido (entero de 2 a
 * 4, o `{parte, de}`) y sin suma de circuitos, diferencia de barra ni banda muerta en ese nivel (un nivel que no cumple se
 * ignora —con banda muerta, para que una combinación vieja no salga con el escalón mal calculado—: `erroresMedidaComun` no
 * deja guardarlo así). Cada nivel lleva `n` (los transformadores que comparten la medida) y, solo en la forma por partes,
 * `parte` (la de este transformador).
 * @returns {null|{porNivel: Object<string, {nivel: string, n: number, devanado: string, parte?: number}>}}
 */
export function especMedidaComun(fila) {
  const d = fila && fila.decision;
  if (!fila || fila.retirada || !d || d.tipo !== 'usar' || !esMapa(d.medida_comun) || conPrevias(d)) return null;
  const mapa = mapaDe(d);
  if (!mapa) return null;
  const porNivel = {};
  for (const nv of Object.keys(d.medida_comun).sort()) {
    const rep = repartoMedidaComun(d.medida_comun[nv]);
    if (!NIVELES[nv] || !rep || !mapa[nv] || enModo(d, 'suma', nv) || enModo(d, 'diferencia', nv) || conMarcaEn(d, 'banda_muerta', nv)) continue;
    porNivel[nv] = { nivel: nv, n: rep.n, devanado: mapa[nv], ...(rep.parte != null ? { parte: rep.parte } : {}) };
  }
  return Object.keys(porNivel).length ? { porNivel } : null;
}

// ── La parte de cada uno (copias nuevas) ─────────────────────────────────────────────────────────────────────────────

/** Un número con la parte de este transformador: × parte (forma por partes) o ÷ n (partes iguales). Lo demás, tal cual. */
const aplicar = (x, rep) => (typeof x === 'number' && Number.isFinite(x) ? (rep.parte != null ? x * rep.parte : x / rep.n) : x);
/** Horas más altas guardadas (lista de números, o bytes de una versión vieja) → lista NUEVA de números con la parte. */
function topDividido(t, rep) {
  if (t == null) return t;
  if (Array.isArray(t)) return t.map((x) => aplicar(x, rep));
  if (typeof t.toUint8Array === 'function') return Array.from(deBytesF32(t.toUint8Array()), (x) => aplicar(x, rep));
  if (t instanceof Uint8Array) return Array.from(deBytesF32(t), (x) => aplicar(x, rep));
  return t;
}

/**
 * El resumen de UN nivel con la parte de este transformador: copia con TODAS las corrientes y potencias ÷ n o × parte
 * (`i`: p50, p95, p98, p99, máx, mín y promedio; la sostenida; las horas más altas `top`; S máxima y p99; y lo de «sin
 * meses casi sin medida» si lo trae). Quedan igual: horas, conteos, posiciones (`iMax`, `idx`, `desde`), cobertura, tensión,
 * rUI (razón sin unidad: corriente y potencia llevan el mismo factor), signo y flujo inverso. No modifica lo que recibe.
 * @param {number|{parte: number, de: number}|{n: number, parte?: number}} reparto  el entero n o la parte
 */
export function dividirResumenNivel(r, reparto) {
  const rep = repDe(reparto);
  if (!r || typeof r !== 'object' || !rep) return r;
  const out = { ...r };
  if (r.i && typeof r.i === 'object') {
    out.i = { ...r.i };
    for (const k of ['p50', 'p95', 'p98', 'p99', 'max', 'min', 'prom']) if (k in r.i) out.i[k] = aplicar(r.i[k], rep);
  }
  if (r.sost && typeof r.sost === 'object') out.sost = { ...r.sost, v: aplicar(r.sost.v, rep) };
  for (const k of ['sMax', 'sP99']) if (k in r) out[k] = aplicar(r[k], rep);
  if ('top' in r) out.top = topDividido(r.top, rep);
  if (r.sinMesesCasi && typeof r.sinMesesCasi === 'object') {
    out.sinMesesCasi = { ...r.sinMesesCasi, p99: aplicar(r.sinMesesCasi.p99, rep), sost: aplicar(r.sinMesesCasi.sost, rep), max: aplicar(r.sinMesesCasi.max, rep) };
  }
  return out;
}

/**
 * El resumen guardado de un punto (sus niveles) con la parte de este transformador en los niveles de la medida común.
 * Copia nueva (los demás niveles, el mismo objeto de cada uno). Sin `spec`, devuelve lo mismo que recibe.
 */
export function dividirResumen(resumen, spec) {
  if (!resumen || !spec || !spec.porNivel) return resumen;
  const out = { ...resumen };
  for (const [nv, x] of Object.entries(spec.porNivel)) if (resumen[nv]) out[nv] = dividirResumenNivel(resumen[nv], x);
  return out;
}

/** Un valor horario con la parte, salvo un TOPE del sistema: se queda tal cual para que se siga reconociendo (y ocultando). */
const parteHoraria = (rep) => (x) => (esCentinela(x) ? x : (rep.parte != null ? x * rep.parte : x / rep.n));
/** Copia de una familia con su valor y sus extras con la parte, sin tocar los topes del sistema (códigos y banderas, tal cual). */
function familiaDividida(s, rep) {
  const out = { ...s, v: Float32Array.from(s.v, parteHoraria(rep)) };
  if (s.m) out.m = new Uint8Array(s.m);
  if (s.b) out.b = new Uint8Array(s.b);
  for (const k of EXTRAS) if (s[k]) out[k] = Float32Array.from(s[k], parteHoraria(rep));
  return out;
}
/** Copia de una familia sin tocar (las tensiones): arreglos nuevos, nunca los de la caché. */
function familiaCopia(s) {
  const out = { ...s };
  for (const k of ['v', 'm', 'b', ...EXTRAS]) if (s[k] && ArrayBuffer.isView(s[k])) out[k] = s[k].slice();
  return out;
}

/**
 * Las familias de UN nivel con la parte de este transformador: IR, IS, IT (y sus máximo, mínimo e instantáneo), P y Q ÷ n
 * o × parte, salvo los topes del sistema (`esCentinela`), que quedan como vinieron; las tensiones, copiadas sin tocar. Con
 * P y Q por el mismo factor el factor de potencia queda igual y S sale por ese factor. Objeto y arreglos nuevos: nunca se
 * toca lo que recibe (la caché de la sesión).
 * @param {Object<string, {v, m, b, max?, min?, ins?}>} fam
 * @param {number|{parte: number, de: number}|{n: number, parte?: number}} reparto  el entero n o la parte
 */
export function dividirFamilias(fam, reparto) {
  const rep = repDe(reparto);
  if (!fam || typeof fam !== 'object' || !rep) return fam;
  const out = {};
  for (const [f, s] of Object.entries(fam)) {
    if (!s || !s.v) { out[f] = s; continue; }
    out[f] = FAMILIAS_DIVIDIDAS.includes(f) ? familiaDividida(s, rep) : familiaCopia(s);
  }
  return out;
}

/** Una serie de un mes (`{niveles: {nv: {kv, fam}}}`) con la parte en sus niveles de medida común. Copia nueva. */
export function dividirSerie(serie, spec) {
  if (!serie || !serie.niveles || !spec || !spec.porNivel) return serie;
  const niveles = { ...serie.niveles };
  for (const [nv, x] of Object.entries(spec.porNivel)) {
    const nivel = serie.niveles[nv];
    if (nivel && nivel.fam) niveles[nv] = { ...nivel, fam: dividirFamilias(nivel.fam, x) };
  }
  return { ...serie, niveles };
}

/** Lo leído de un punto (`{porMes: {mes: {estado, serie?}}}`) con cada mes leído con la parte. Copia nueva. */
export function dividirLectura(lectura, spec) {
  if (!lectura || !lectura.porMes || !spec) return lectura;
  const porMes = {};
  for (const [mes, x] of Object.entries(lectura.porMes)) porMes[mes] = x && x.estado === 'ok' && x.serie ? { ...x, serie: dividirSerie(x.serie, spec) } : x;
  return { ...lectura, porMes };
}

// ── Validación y coherencia entre las filas que comparten la medida ──────────────────────────────────────────────

/** Errores del valor de UN nivel (`et` = su etiqueta). Vacío si es un entero de 2 a 4 o una parte `{parte, de}` válida. */
function erroresValor(v, et) {
  if (esMapa(v)) {
    const e = [];
    if (typeof v.parte !== 'number' || !Number.isFinite(v.parte) || v.parte <= 0 || v.parte >= 1) {
      e.push('La parte de la medida común de ' + et + ' debe ser un número mayor que 0 y menor que 1 (por ejemplo, 0,58 = el 58 %).');
    } else if (!parteValida(v.parte)) {
      e.push('La parte de la medida común de ' + et + ' lleva como mucho ' + MEDIDA_COMUN.decimales + ' decimales (por ejemplo, 0,58).');
    }
    if (v.de === undefined || v.de === null) e.push('La parte de la medida común de ' + et + ' debe decir entre cuántos transformadores se reparte la medida («de», de 2 a 4).');
    else if (!nValido(v.de)) e.push('La medida común de ' + et + ' se reparte entre 2 y 4 transformadores: «de» debe ser un número entero de 2 a 4.');
    return e;
  }
  return nValido(v) ? [] : ['La medida común de ' + et + ' debe ser un número entero de 2 a 4 (los transformadores en paralelo detrás de esa medida) '
    + 'o la parte de este transformador con entre cuántos se reparte ({ parte, de }).'];
}

/** Errores de la marca de UNA decisión (sin mirar las otras filas). Vacío sin la marca o si está bien. */
function erroresMarca(d) {
  if (!d || d.medida_comun === undefined || d.medida_comun === null) return [];
  const mc = d.medida_comun;
  if (!esMapa(mc) || !Object.keys(mc).length) return ['La medida común debe ser un mapa por nivel con el número de transformadores en paralelo (de 2 a 4) o la parte de este transformador.'];
  const err = [];
  if (d.tipo !== 'usar') err.push('La medida común solo se usa con «Confirmar: usar esta medida».');
  if (conPrevias(d)) err.push('Una fila con cambio de medida (medidas anteriores) no puede declarar la medida común.');
  const mapa = mapaDe(d) || {};
  for (const nv of Object.keys(mc).sort()) {
    if (!NIVELES[nv]) { err.push('Nivel desconocido en la medida común: ' + nv + '.'); continue; }
    const et = etiquetaDe(nv);
    err.push(...erroresValor(mc[nv], et));
    if (!mapa[nv]) err.push('El nivel ' + et + ' tiene medida común pero no está asignado a ningún devanado.');
    if (enModo(d, 'suma', nv)) err.push('El nivel ' + et + ' no puede ir a la vez con medida común y con suma de circuitos.');
    if (enModo(d, 'diferencia', nv)) err.push('El nivel ' + et + ' no puede ir a la vez con medida común y por diferencia de barra.');
  }
  return err;
}
/** La marca de una decisión tal como está guardada (mapa nivel → valor), o null. */
const marcaDe = (d) => (d && esMapa(d.medida_comun) && Object.keys(d.medida_comun).length ? d.medida_comun : null);
/** El número de transformadores que dice un valor guardado (el entero, o `de` de la parte), o null. */
const nDe = (v) => (formaDe(v) === 'entero' ? v : formaDe(v) === 'parte' ? v.de : null);
/** Texto corto de un valor guardado para los errores: «÷ 2» o «por partes entre 2». */
const valorCorto = (v) => (formaDe(v) === 'entero' ? '÷ ' + v : formaDe(v) === 'parte' ? 'por partes entre ' + v.de : 'no válida');
/** «58 %», «42,5 %»: la parte en porcentaje, con coma decimal. */
const pctTexto = (parte) => String(Math.round(parte * 1000) / 10).replace('.', ',') + ' %';
/** La parte en porcentaje para los textos de la pantalla: 0,58 → «58 %», 0,425 → «42,5 %». */
export function porcentajeParte(parte) { return pctTexto(parte); }
/** ¿La suma de las partes de un grupo completo queda entre 99 % y 101 %? (con margen para los decimales del computador) */
const sumaCuadra = (s) => s >= MEDIDA_COMUN.sumaMin - 1e-9 && s <= MEDIDA_COMUN.sumaMax + 1e-9;

/**
 * Lo que hace incoherente a un GRUPO de filas vigentes que comparten la misma medida (vacío = coherente). Reglas: cada fila
 * declara una marca válida; todas declaran los MISMOS niveles, cada nivel en la MISMA forma (todas con el entero o todas por
 * partes) y con el MISMO número de transformadores; en cada nivel común, las filas que comparten la medida no pasan de ese
 * número; por partes, las de un grupo completo suman entre 99 % y 101 % (y las de uno a medio escribir no pasan de 101 %);
 * ninguna fila trae banda muerta ni fase sin carga en un nivel común (todavía no está resuelto); y ningún nivel FUERA de la
 * marca lo usan (asignado en su mapa) dos filas o más (la misma corriente contaría completa en cada una). Que FALTEN filas
 * (menos que el número) no es un error al guardar —la marca se escribe fila por fila—, pero sí deja el grupo sin cuadrar
 * para los avisos (`grupoCuadra`). `idPropio` = la fila que se está guardando (los textos le dicen «esta fila»).
 * @param {Array<object>} grupo  filas con `decision` (y `id`, `matricula`)
 */
function problemasGrupo(grupo, idPropio = null) {
  const err = [];
  const filas = (grupo || []).filter(Boolean);
  const nombre = (g) => nombreDe(g, idPropio);
  for (const g of filas) {
    const m = marcaDe(g.decision);
    if (!m) { err.push('Comparten la misma medida pero ' + nombre(g) + ' no declara la medida común: todas las filas en paralelo deben declararla, en los mismos niveles y con el mismo número de transformadores.'); continue; }
    if (g.id !== idPropio && erroresMarca(g.decision).length) err.push('La medida común de ' + nombre(g) + ' no es válida: revísela antes.');
  }
  // Mismos niveles, en la misma forma y con el mismo número de transformadores en todas (cada diferencia, una vez, contra
  // la fila que se guarda o la primera con la marca). Las partes de cada fila son distintas a propósito: no se comparan.
  const conMarca = filas.filter((g) => marcaDe(g.decision));
  const ref = conMarca.find((g) => g.id === idPropio) || conMarca[0];
  if (ref) {
    const mr = marcaDe(ref.decision);
    for (const g of conMarca) {
      if (g === ref) continue;
      const mg = marcaDe(g.decision);
      for (const nv of [...new Set([...Object.keys(mr), ...Object.keys(mg)])].sort()) {
        const a = mr[nv]; const b = mg[nv];
        const et = etiquetaDe(nv);
        if (b === undefined) { err.push(mayuscula(nombre(g)) + ' usa la misma medida y no declara la medida común de ' + et + ' (' + valorCorto(a) + ').'); continue; }
        if (a === undefined) { err.push(mayuscula(nombre(g)) + ' declara la medida común de ' + et + ' (' + valorCorto(b) + ') y ' + nombre(ref) + ' no: las filas en paralelo deben declararla en los mismos niveles.'); continue; }
        if (formaDe(a) !== formaDe(b)) {
          const como = (v) => (formaDe(v) === 'parte' ? 'la reparte por partes' : formaDe(v) === 'entero' ? 'la divide en partes iguales (÷ ' + v + ')' : 'no trae un valor válido');
          err.push('La medida común de ' + et + ' no coincide: ' + nombre(ref) + ' ' + como(a) + ' y ' + nombre(g) + ' ' + como(b) + ': todas las filas deben declararla de la misma forma.');
          continue;
        }
        if (formaDe(a) === 'entero' && a !== b) { err.push('La medida común de ' + et + ' no coincide: ' + nombre(ref) + ' dice ÷ ' + a + ' y ' + nombre(g) + ' dice ÷ ' + b + '.'); continue; }
        if (formaDe(a) === 'parte' && a.de !== b.de) err.push('La medida común de ' + et + ' no coincide: ' + nombre(ref) + ' dice que la comparten ' + a.de + ' transformadores y ' + nombre(g) + ' dice ' + b.de + '.');
      }
    }
    // En cada nivel común, cuántas filas comparten la medida frente al número que dice la marca.
    for (const [nv, v] of Object.entries(mr)) {
      const n = nDe(v);
      if (nValido(n) && filas.length > n) err.push('La medida de ' + etiquetaDe(nv) + ' la comparten ' + filas.length + ' filas y la medida común dice ' + n + ' transformadores en paralelo.');
    }
    // Por partes: las de las filas con la misma forma y el mismo número suman 100 % (grupo completo) o no pasan de 101 %.
    for (const [nv, v] of Object.entries(mr)) {
      const rep = repartoMedidaComun(v);
      if (!rep || rep.parte == null) continue;
      const iguales = conMarca.map((g) => ({ g, r: repartoMedidaComun(marcaDe(g.decision)[nv]) })).filter((x) => x.r && x.r.parte != null && x.r.n === rep.n);
      const suma = iguales.reduce((s, x) => s + x.r.parte, 0);
      const detalle = ' (' + iguales.map((x) => nombre(x.g) + ' ' + pctTexto(x.r.parte)).join(' + ') + ')';
      if (iguales.length === rep.n && !sumaCuadra(suma)) err.push('Las partes de la medida común de ' + etiquetaDe(nv) + ' suman ' + pctTexto(suma) + detalle + ': entre los ' + rep.n + ' transformadores deben sumar 100 %.');
      else if (iguales.length < rep.n && suma > MEDIDA_COMUN.sumaMax + 1e-9) {
        const faltan = rep.n - iguales.length;
        err.push('Las partes de la medida común de ' + etiquetaDe(nv) + ' ya suman ' + pctTexto(suma) + detalle + ' y todavía ' + (faltan === 1 ? 'falta un transformador' : 'faltan ' + faltan + ' transformadores') + ': entre todos deben sumar 100 %.');
      }
    }
  }
  // Banda muerta o fase sin carga en un nivel común (en cualquier fila del grupo): todavía no está resuelto.
  const comunes = new Set(conMarca.flatMap((g) => Object.keys(marcaDe(g.decision))));
  for (const g of filas) {
    for (const nv of [...comunes].sort()) {
      if (MARCAS_SIN_RESOLVER.some((c) => conMarcaEn(g.decision, c, nv))) {
        err.push('Banda muerta / fases sin carga junto con medida común en ' + etiquetaDe(nv) + ' (' + nombre(g) + '): todavía no está resuelto.');
      }
    }
  }
  // Un nivel fuera de la marca no lo pueden usar dos filas con la misma medida.
  const usan = {};
  for (const g of filas) for (const nv of Object.keys(mapaDe(g.decision) || {})) if (!comunes.has(nv)) (usan[nv] = usan[nv] || []).push(g);
  for (const [nv, gs] of Object.entries(usan)) {
    if (gs.length > 1) err.push('El nivel ' + etiquetaDe(nv) + ' lo usan ' + gs.map(nombre).join(' y ') + ' con la misma medida y sin medida común: la misma corriente contaría completa en cada una.');
  }
  return [...new Set(err)];
}

/**
 * ¿El grupo CUADRA? Sin nada de `problemasGrupo` y, en cada nivel común, tantas filas con la marca válida en la MISMA forma
 * y con el MISMO número como dice ese número (ni menos —falta una, otra sin la marca, en otra forma o con otro número— ni
 * más) y, por partes, que sumen entre 99 % y 101 %.
 */
function grupoCuadra(filas) {
  if (problemasGrupo(filas).length) return false;
  for (const g of filas) {
    for (const [nv, v] of Object.entries(marcaDe(g.decision) || {})) {
      const rep = repartoMedidaComun(v);
      if (!rep) return false;
      const iguales = filas.map((h) => (marcaDe(h.decision) || {})[nv]).filter((vh) => formaDe(vh) === formaDe(v) && repartoMedidaComun(vh) && repartoMedidaComun(vh).n === rep.n);
      if (iguales.length !== rep.n) return false;
      if (rep.parte != null && !sumaCuadra(iguales.reduce((s, vh) => s + vh.parte, 0))) return false;
    }
  }
  return true;
}

/**
 * Los puntos (cid) con medida común, separados en los que CUADRAN (`coherentes`: varias filas, todas con la marca en la
 * misma forma y tantas como dice su número; por partes, sumando 100 %; compartir la medida no es el aviso CLAVE_COMPARTIDA)
 * y los que NO (`incompletas`: alguna fila vigente declara la marca y el grupo no cuadra; todas sus filas vigentes llevan
 * MEDIDA_COMUN_INCOMPLETA). Un punto sin ninguna marca no sale en ninguno (CLAVE_COMPARTIDA, como siempre).
 * @param {Map<string, object[]>} grupos  cid → filas vigentes (no retiradas ni excluidas) con esa clave
 * @returns {{coherentes: Set<string>, incompletas: Set<string>}}
 */
export function gruposMedidaComun(grupos) {
  const coherentes = new Set(); const incompletas = new Set();
  for (const [cid, filas] of grupos || []) {
    if (!Array.isArray(filas) || !filas.some((g) => marcaDe(g && g.decision))) continue;
    const gs = filas.filter(Boolean).map((g, i) => ({ ...g, id: g.id || String(i) }));
    if (gs.length >= 2 && grupoCuadra(gs)) coherentes.add(cid);
    else incompletas.add(cid);
  }
  return { coherentes, incompletas };
}

/**
 * Las claves (cid) compartidas por varias filas vigentes cuya medida común CUADRA en todas (`gruposMedidaComun`): para
 * esas, compartir la medida no es el aviso CLAVE_COMPARTIDA. Sin ninguna marca, el conjunto sale vacío.
 * @param {Map<string, object[]>} grupos  cid → filas vigentes (no retiradas ni excluidas) con esa clave
 * @returns {Set<string>}
 */
export function clavesConMedidaComun(grupos) {
  return gruposMedidaComun(grupos).coherentes;
}

/** El aviso del grupo que ya no cuadra (su texto vive en `AVISOS` de la homologación). */
export const AVISO_INCOMPLETA = 'MEDIDA_COMUN_INCOMPLETA';

/**
 * Los avisos que el diálogo «Revisar» puede dejar como VISTOS al guardar esta decisión: nunca MEDIDA_COMUN_INCOMPLETA (se
 * resuelve arreglando el grupo, no confirmándolo) y, si la decisión trae la medida común, tampoco CLAVE_COMPARTIDA (con
 * la marca, compartir la medida solo es aceptable si el grupo cuadra). Lista nueva; no modifica la que recibe.
 */
export function avisosQueSePuedenVer(avisos, decision) {
  const conMarca = !!marcaDe(decision);
  return (avisos || []).filter((a) => a !== AVISO_INCOMPLETA && !(conMarca && a === 'CLAVE_COMPARTIDA'));
}

/**
 * Errores (texto llano) de la medida común de una decisión ANTES de guardarla; vacío = se puede guardar. Mira la marca de
 * esta decisión (en cada nivel, un entero de 2 a 4 o una parte `{parte, de}` válida; nivel asignado, sin suma ni diferencia
 * en ese nivel, sin medidas anteriores) y la coherencia con las OTRAS filas vigentes que usan la misma clave (que declaren
 * la medida común en la misma forma y con el mismo número, que no pasen de ese número, que por partes sumen 100 % con el
 * grupo completo y que ningún nivel fuera de la marca lo usen dos). Sin la marca aquí ni en las otras filas de la misma
 * clave, vacío.
 * @param {object} fila      la fila de la homologación
 * @param {object} decision  la decisión que se va a guardar
 * @param {{filas?: Object<string, object>, filaId?: string, cidDe: (fila: object) => string|null}} ctx
 *   `cidDe` = la clave de una fila (la de su decisión o la del Excel), como la calcula la homologación
 */
export function erroresMedidaComun(fila, decision, { filas = {}, filaId = null, cidDe = null } = {}) {
  if (!decision || decision.tipo !== 'usar' || typeof cidDe !== 'function') return [];
  const id = filaId || (fila && fila.id) || 'esta';
  const propia = { ...(fila || {}), id, decision };
  const cid = cidDe(propia);
  const otras = cid ? Object.entries(filas || {}).filter(([fid, g]) => fid !== id && vigente(g) && cidDe(g) === cid).map(([fid, g]) => ({ ...g, id: fid })) : [];
  if (!marcaDe(decision) && !otras.some((g) => marcaDe(g.decision))) return erroresMarca(decision);
  if (!cid) return ['La fila no tiene un punto SCADA: no se puede declarar una medida común.'];
  return [...new Set([...erroresMarca(decision), ...problemasGrupo([propia, ...otras], id)])];
}

/**
 * Copia de la marca guardada para volver a escribirla (el diálogo «Revisar» la conserva): el entero tal cual y la parte como
 * `{parte, de}` NUEVO con solo esos dos campos (nada más se arrastra; un campo que falte no se escribe como `undefined`:
 * `erroresMedidaComun` no deja guardar una parte sin «de»). Mapa nuevo; no modifica lo que recibe.
 */
export function copiaMedidaComun(mc) {
  if (!esMapa(mc)) return mc;
  const out = {};
  for (const [nv, v] of Object.entries(mc)) {
    if (!esMapa(v)) { out[nv] = v; continue; }
    const x = {};
    if (v.parte !== undefined) x.parte = v.parte;
    if (v.de !== undefined) x.de = v.de;
    out[nv] = x;
  }
  return out;
}

// ── Textos ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Las partes iguales en palabras. */
const FRACCION = Object.freeze({ 2: 'la mitad', 3: 'un tercio', 4: 'la cuarta parte' });
/** Las partes iguales de n transformadores en palabras: 2 → «la mitad», 3 → «un tercio», 4 → «la cuarta parte» (la misma
 * palabra del motivo, para la celda del p99 del diálogo «Revisar»). */
export function fraccionMedidaComun(n) { return FRACCION[n] || '1/' + n; }
/** Lo que le corresponde a este transformador, para el motivo: «la mitad», «un tercio», «el 58 %». */
const loQueLeToca = (rep) => (rep.parte != null ? 'el ' + pctTexto(rep.parte) : fraccionMedidaComun(rep.n));
/** «a, b y c». */
const unir = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

/** El rótulo de la medida común de un nivel: «medida común ÷ 2» (partes iguales) o «58 % de la medida común» (por partes). */
export function rotuloMedidaComun(reparto) {
  const rep = repDe(reparto);
  if (!rep) return 'medida común';
  return rep.parte != null ? pctTexto(rep.parte) + ' de la medida común' : 'medida común ÷ ' + rep.n;
}

/** «110 kV · medida común ÷ 2» o «110 kV · 58 % de la medida común» (el rótulo del nivel). */
export function etiquetaMedidaComun(nv, reparto) { return etiquetaDe(nv) + ' · ' + rotuloMedidaComun(reparto); }

/**
 * El motivo de la cifra PROVISIONAL, UNA sola frase aunque haya varios niveles (y en formas distintas): «medida común de 2
 * transformadores en paralelo: a este le corresponde el 58 % en 110 kV y la mitad en 66 kV; puede ir más cargado si circula
 * corriente entre ellos o si otro sale de servicio». De mayor a menor tensión; los niveles VECINOS con la misma parte van
 * juntos («la mitad en 110 kV y 66 kV»; con tres, «la mitad en 110 kV, 34,5 kV y 13,8 kV»).
 * @param {Array<{nivel: string, n: number, parte?: number}>|Object<string, {nivel?: string, n: number, parte?: number}>|number} niveles
 *   los niveles comunes (una lista, o `porNivel` de `especMedidaComun`); un número solo = partes iguales sin decir el nivel
 */
export function motivoMedidaComun(niveles) {
  const cola = '; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';
  if (typeof niveles === 'number') {
    const rep = repDe(niveles);
    return 'medida común de ' + niveles + ' transformadores en paralelo: a este le corresponde ' + (rep ? loQueLeToca(rep) : '1/' + niveles) + cola;
  }
  const lista = (Array.isArray(niveles) ? niveles : Object.entries(niveles || {}).map(([nv, x]) => ({ ...x, nivel: x.nivel || nv })))
    .map((x) => ({ nivel: x.nivel, rep: repDe(x) })).filter((x) => x.nivel && x.rep)
    .sort((a, b) => (NIVELES[b.nivel] ? NIVELES[b.nivel].kv : 0) - (NIVELES[a.nivel] ? NIVELES[a.nivel].kv : 0));
  if (!lista.length) return '';
  const ns = [...new Set(lista.map((x) => x.rep.n))];
  const cabeza = ns.length === 1 ? 'medida común de ' + ns[0] + ' transformadores en paralelo'
    : 'medida común de transformadores en paralelo (' + unir(lista.map((x) => x.rep.n + ' en ' + etiquetaDe(x.nivel))) + ')';
  // Solo se juntan niveles VECINOS con la misma parte: así se conserva el orden de mayor a menor tensión («la mitad en
  // 110 kV, el 58 % en 66 kV y la mitad en 13,8 kV») y cada lista lleva una sola «y» («la mitad en 110 kV, 34,5 kV y 13,8 kV»).
  const grupos = [];
  for (const x of lista) {
    const t = loQueLeToca(x.rep);
    const g = grupos[grupos.length - 1];
    if (g && g.t === t) g.nv.push(etiquetaDe(x.nivel)); else grupos.push({ t, nv: [etiquetaDe(x.nivel)] });
  }
  return cabeza + ': a este le corresponde ' + unir(grupos.map((g) => g.t + ' en ' + unir(g.nv))) + cola;
}

/** La nota bajo las curvas del detalle (partes iguales: la de siempre; por partes: la de este transformador). */
export function notaCurvasMedidaComun(reparto) {
  const rep = repDe(reparto);
  const cola = '; puede ir más cargado si circula corriente entre ellos o si otro sale de servicio';
  if (!rep) return 'medida común de transformadores en paralelo' + cola;
  if (rep.parte != null) return 'medida común de los ' + rep.n + ' transformadores en paralelo; se muestra la parte de este transformador: ' + pctTexto(rep.parte) + ' de la medida común' + cola;
  return 'medida común de los ' + rep.n + ' transformadores en paralelo: se muestra la parte de cada uno (1/' + rep.n + ')' + cola;
}

/** Qué lleva la parte en las curvas del detalle (la frase que sigue a la nota). */
export function alcanceCurvasMedidaComun(reparto) {
  const rep = repDe(reparto);
  if (rep && rep.parte != null) return 'Las corrientes (con su máximo, mínimo e instantáneo), P y Q van al ' + pctTexto(rep.parte) + ' de lo medido; la tensión es la medida común, tal cual.';
  return 'Se dividen las corrientes (con su máximo, mínimo e instantáneo), P y Q; la tensión es la medida común sin dividir.';
}

/** El valor de la fila «Medida común» de la tabla del detalle (el rótulo ya lo dice: el valor no lo repite). */
export function textoDetalleMedidaComun(reparto) {
  const rep = repDe(reparto) || { n: Number(reparto) || 0, parte: null };
  const cola = ' Puede ir más cargado si circula corriente entre ellos o si otro sale de servicio · cifra provisional';
  if (rep.parte != null) {
    return 'Se muestra la parte de este transformador: ' + pctTexto(rep.parte) + ' de la medida común de los ' + rep.n + ' transformadores en paralelo '
      + '(el ' + pctTexto(rep.parte) + ' de las corrientes, de P y de Q; la tensión no cambia).' + cola;
  }
  return 'Se muestra la parte de cada uno de los ' + rep.n + ' transformadores en paralelo (1/' + rep.n + '): se dividen las corrientes, P y Q; '
    + 'la tensión no.' + cola;
}

/** La columna «Origen» del CSV de un nivel con medida común (dice la parte). */
export function origenCsvMedidaComun(reparto) {
  const rep = repDe(reparto) || { n: Number(reparto) || 0, parte: null };
  if (rep.parte != null) {
    return 'IR, IS, IT, P y Q = ' + pctTexto(rep.parte) + ' de la medida común de los ' + rep.n + ' transformadores en paralelo (la parte de este transformador); U = la medida común, tal cual';
  }
  return 'IR, IS, IT, P y Q = medida común de los ' + rep.n + ' transformadores en paralelo ÷ ' + rep.n + ' (la parte de cada uno); U = la medida común, sin dividir';
}

/**
 * El párrafo del diálogo «Revisar» con la marca guardada (mapa nivel → valor, tal como está en la decisión). Todo con el
 * entero: «110 kV ÷ 2 · 66 kV ÷ 2». Con algún nivel por partes, todos los niveles en las mismas palabras: «110 kV: a este le
 * corresponde el 58 % (de 2 en paralelo) · 66 kV: a este le corresponde la mitad (de 2 en paralelo)».
 */
export function textoMedidaComunGuardada(mc) {
  if (!esMapa(mc) || !Object.keys(mc).length) return '';
  const conParte = Object.values(mc).some((v) => formaDe(v) === 'parte');
  const partes = Object.keys(mc).sort((a, b) => (NIVELES[b] ? NIVELES[b].kv : 0) - (NIVELES[a] ? NIVELES[a].kv : 0))
    .map((nv) => {
      const v = mc[nv];
      if (formaDe(v) === 'parte') {
        const rep = repartoMedidaComun(v);
        return rep ? etiquetaDe(nv) + ': a este le corresponde el ' + pctTexto(rep.parte) + ' (de ' + rep.n + ' en paralelo)' : etiquetaDe(nv) + ': parte no válida';
      }
      return conParte && nValido(v) ? etiquetaDe(nv) + ': a este le corresponde ' + fraccionMedidaComun(v) + ' (de ' + v + ' en paralelo)' : etiquetaDe(nv) + ' ÷ ' + v;
    });
  return 'Medida común de transformadores en paralelo: ' + partes.join(' · ') + '. En esos niveles el punto SCADA mide la suma de los '
    + 'transformadores que trabajan en paralelo detrás de las mismas bahías; cada uno sale con su parte (la medida ÷ el número de '
    + 'transformadores o, si se reparte por partes, el porcentaje que le toca) y la cifra es provisional: si circula corriente entre ellos, cada uno puede ir más cargado que esa parte. Todas las filas que '
    + 'comparten la medida deben declararla en los mismos niveles, de la misma forma y con el mismo número de transformadores (por partes, '
    + 'entre todas suman 100 %). No se arma desde aquí: se conserva al guardar con el mismo punto, ese nivel asignado '
    + 'y «Medir con la medida del transformador»; «Excluir» o «Reabrir» la quitan.';
}
