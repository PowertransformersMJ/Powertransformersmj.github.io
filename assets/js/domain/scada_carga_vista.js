// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · lo que muestra la lista y el detalle (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Una fila por transformador del parque, con la cargabilidad SCADA del mes (resumen guardado
// por el importador ÷ ampacidad EN VIVO del parque), su calificación CRG (bandas ratificadas
// del MO.00418), si la cifra es FIRME o PROVISIONAL (y por qué) y la cifra OFICIAL del Excel
// de Salud de Activos al lado, con su diferencia (L-81: una discrepancia se muestra, no se
// esconde; el módulo NO escribe nada en el parque).
// REGLA VISUAL: solo una cifra FIRME lleva color de severidad; lo provisional va neutro y debajo.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO, NIVELES, DEVANADO } from './scada_carga_config.js';
import { normalizarTexto, claveId, esElementoTransformador } from './scada_carga_csv.js';
import {
  analizarClaveHomologada, claveEfectiva, avisosFila, estadoEfectivo, conteosHomologacion, normalizarMatricula, placaDe
} from './scada_carga_homologacion.js';
import { cargabilidad, atribuirEscala, califCRG, firmeza } from './scada_carga_kpis.js';
import { filaCargabilidad } from './cargabilidad_parque.js';

const sinTildes = (s) => normalizarTexto(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

/** Elige la fila de la homologación de un transformador (por matrícula; si se repite, por subestación). */
export function filaDeTransformador(tx, porMatricula) {
  const mat = normalizarMatricula(leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo);
  if (!mat) return null;   // sin matrícula no se adivina la fila
  const filas = porMatricula.get(mat) || [];
  if (filas.length <= 1) return filas[0] || null;
  const sub = sinTildes(leer(tx, 'ubicacion.subestacion_nombre'));
  return filas.find((f) => sinTildes(f.subestacion) === sub) || filas[0];
}

/** Índice matrícula → filas (las retiradas no cuentan). */
export function indicePorMatricula(filas) {
  const m = new Map();
  for (const [id, f] of Object.entries(filas || {})) {
    if (f.retirada) continue;
    const k = normalizarMatricula(f.matricula);
    if (!k) continue;   // una fila sin matrícula no se asigna a ningún equipo
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ ...f, id });
  }
  return m;
}

/** Por qué un nivel con horas medidas no tiene devanado: la causa, no un genérico. */
function motivoSinDevanado(avisos, placa) {
  if (!['P', 'S', 'T'].some((x) => placa[x] && placa[x].kv)) return 'la placa del parque no trae tensiones';
  if ((avisos || []).includes('NIVEL_AMBIGUO')) return 'el nivel medido coincide con más de un devanado';
  return 'el nivel medido no coincide con la placa';
}

/**
 * Por qué un punto con datos cargados no da NINGUNA hora válida (`99 §158`). «Sin horas válidas» juntaba causas distintas
 * —77 equipos en septiembre de 2026—; con el resumen guardado se nombra la que se sabe:
 *   · el periodo no trae su corriente (sin resumen, o resumen sin horas de corriente: solo tensiones) → no vino en el exporte;
 *   · la potencia sí llega (sP99 > 0) → la corriente no llega válida;
 *   · corriente en cero CON tensión al menos `horasMinSinCarga` horas → sin carga (fuera de servicio o en reserva);
 *   · si no, lo que queda: valores congelados, en cero o que el propio SCADA marcó no válidos.
 */
function motivoSinHoras(resumenPorNivel) {
  const rs = Object.values(resumenPorNivel || {}).filter((r) => r && typeof r === 'object' && r.horas > 0);
  if (!rs.length) return 'no vino en el exporte del SCADA';
  if (rs.some((r) => r.sP99 > 0)) return 'sin corriente válida (sí llega la potencia)';
  if (rs.some((r) => (r.des || 0) >= CALCULO.horasMinSinCarga)) return 'sin carga (fuera de servicio o en reserva)';
  return 'medida congelada o marcada no válida por el SCADA';
}

/**
 * Cálculo de UN transformador para un periodo con resúmenes por nivel (físicos, en A).
 * Lo usa la lista (resumen del mes guardado) y el detalle (resumen del rango calculado).
 */
export function calcularEquipo({ tx, fila, punto, resumenPorNivel, conteos, umbrales, estadistico = CALCULO.estadistico, mesesFallidos = [] }) {
  const placa = placaDe(tx);
  const clave = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
  const esCircuito = !!clave && !esElementoTransformador(clave.elem);
  const { avisos, mapa, relacion } = fila ? avisosFila(fila, { ...conteos, tx, punto, resumenPorNivel }) : { avisos: [], mapa: null, relacion: null };
  const estado = estadoEfectivo(fila, avisos);
  const niveles = [];
  const devanados = [];
  for (const nv of Object.keys((punto && punto.niveles) || {}).sort((a, b) => NIVELES[b].kv - NIVELES[a].kv)) {
    const d = mapa ? mapa[nv] || null : null;
    const r = resumenPorNivel ? resumenPorNivel[nv] : null;
    const A = d ? placa[d].A : null;
    const escala = r && d ? atribuirEscala(r, A) : (r ? 'sin_devanado' : 'sin_dato');
    let pct = d && r ? cargabilidad(r, A, estadistico) : null;
    if (escala === 'ESCALA_I' || escala === 'ESCALA_INDETERMINADA') pct = null;
    const sostPct = d && r && r.sost && A > 0 ? 100 * r.sost.v / A : null;
    const picoPct = d && r && r.i && r.i.max != null && A > 0 ? 100 * r.i.max / A : null;
    const fila1 = {
      nivel: nv, etiqueta: NIVELES[nv].etiqueta, devanado: d, nombreDevanado: d ? DEVANADO[d] : null, A,
      pct, escala, cobertura: r ? r.cob : null, n: r && r.i ? r.i.n : 0, sostenidaPct: sostPct, picoPct,
      sinDatos: !r || !r.i || r.i.n === 0
    };
    niveles.push(fila1);
    if (d) devanados.push({ d, A, pct, cobertura: fila1.cobertura, n: fila1.n, escala, unaFalta: r && r.i ? r.i.unaFalta || 0 : 0 });
  }
  const conPct = devanados.filter((x) => x.pct != null);
  let pctEq = conPct.length ? Math.max(...conPct.map((x) => x.pct)) : null;
  const devMax = conPct.length ? conPct.reduce((a, b) => (b.pct > a.pct ? b : a)).d : null;
  const f = firmeza({ estadoHomologacion: estado, esCircuito, devanados, placa, mesesFallidos });
  // Un circuito sin confirmar o una homologación excluida NO dan número (decisión del Ingeniero).
  let motivoNulo = null;
  if (estado === 'excluida') { pctEq = null; motivoNulo = 'homologación excluida'; }
  else if (estado === 'sin_homologacion') { pctEq = null; motivoNulo = 'sin homologación'; }
  else if (esCircuito && estado !== 'confirmada') { pctEq = null; motivoNulo = 'se mide un circuito, no el transformador'; }
  else if (!clave) motivoNulo = 'la homologación no trae punto SCADA';
  else if (!punto) motivoNulo = 'sin datos SCADA cargados';
  else if (pctEq == null) motivoNulo = devanados.some((x) => x.escala === 'ESCALA_I' || x.escala === 'ESCALA_INDETERMINADA')
    ? 'escala de la corriente sospechosa'
    : (devanados.some((x) => !(x.A > 0)) ? 'sin ampacidad del devanado'
      // Hay horas medidas pero ningún devanado asignado: decir «sin horas válidas» engañaba. Se nombra la causa.
      : (!devanados.length && niveles.some((n) => !n.sinDatos) ? motivoSinDevanado(avisos, placa) : motivoSinHoras(resumenPorNivel)));
  // Sobrecarga sostenida y pico (`99 §129`). Cuentan SOLO los devanados con cifra válida (no los de escala sospechosa ni
  // sin ampacidad) y nada si el equipo no tiene cifra. El resumen guardado es de la corriente EN BRUTO: es exacto si el mes
  // no trae horas imposibles (> 3 × ampacidad) en ese nivel —se sabe por su máximo— y así se usa (probado con los 8 meses
  // reales: 313 de 313 iguales a la curva limpia). Si las trae, el resumen no alcanza: el nivel queda en
  // `sobrecargaPorVerificar` y la lista lo decide con la curva del mes (scada_carga_sostenida.js). Antes, esas horas y los
  // devanados de escala sospechosa marcaban «sostenida» o «pico» falsos (T1-A/M-GBT, T1-M/M-PBN, T1-M/M-MAJ).
  // El resumen guarda los amperios redondeados a 0,001 (medio paso = 0,0005 A): un valor que cae dentro de ese medio paso
  // de un umbral (3 × A o el 100 %) tampoco se decide con el resumen; va a la curva, como las horas imposibles.
  const topeImposible = CALCULO.topeFisicoXAmpacidad * 100;
  const SOBRE = CALCULO.sobrecargaPct;
  const tol = (n) => (100 * 0.0005) / n.A;
  const cuentan = pctEq != null ? niveles.filter((n) => n.devanado && n.pct != null && n.A > 0) : [];
  const sinImposibles = (n) => n.picoPct == null || n.picoPct + tol(n) <= topeImposible;
  const pasa = (v, n) => v != null && v - tol(n) > SOBRE;          // seguro por encima del 100 %
  const enElBorde = (v, n) => v != null && Math.abs(v - SOBRE) < tol(n);
  const limpios = cuentan.filter(sinImposibles);
  const sostenida = limpios.some((n) => pasa(n.sostenidaPct, n));
  const pico = limpios.some((n) => pasa(n.picoPct, n));
  const porVerificar = sostenida ? [] : cuentan
    .filter((n) => !sinImposibles(n) || enElBorde(n.sostenidaPct, n) || (!pico && enElBorde(n.picoPct, n)))
    .map((n) => ({ nivel: n.nivel, devanado: n.devanado, A: n.A }));
  const crg = califCRG(pctEq, umbrales);
  const clase = pctEq == null ? 'nulo' : (f.firme ? 'firme' : 'provisional');
  // Cifra oficial (Excel de Salud de Activos), por devanado y de equipo.
  const of = filaCargabilidad(tx);
  const oficialEq = of ? of.pct_oficial : null;
  const oficialDev = devMax && of ? of[devMax].pct : null;
  return {
    estado, avisos, relacion, esCircuito, mapa, niveles, devanados, devMax,
    pct: pctEq, crg, firme: clase === 'firme', motivos: f.motivos, motivoNulo, clase,
    sobrecargaSostenida: clase === 'firme' && sostenida, sobrecargaProvisional: clase !== 'firme' && sostenida,
    picoAislado: !sostenida && pico, sobrecargaPorVerificar: porVerificar,
    oficial: { pct: oficialEq, calif: leer(tx, 'salud_actual.calif_crg') ?? null, porDevanado: of ? { P: of.P.pct, S: of.S.pct, T: of.T.pct } : null },
    delta: pctEq != null && oficialDev != null ? pctEq - oficialDev : null
  };
}

/**
 * Filas de la lista para un mes.
 * @param {{parque: object[], homologacion: object|null, catalogo: object|null, resumenMes: object|null, umbrales?: object}} ctx
 */
export function filasLista({ parque, homologacion, catalogo, resumenMes, umbrales, estadistico }) {
  const filasH = (homologacion && homologacion.filas) || {};
  const porMat = indicePorMatricula(filasH);
  const conteos = conteosHomologacion(filasH);
  const puntos = (catalogo && catalogo.puntos) || {};
  const claves = (resumenMes && resumenMes.claves) || {};
  return (parque || []).map((tx) => {
    const fila = filaDeTransformador(tx, porMat);
    const k = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
    const cid = k ? claveId(k.est, k.elem) : null;
    const punto = cid ? puntos[cid] || null : null;
    const r = cid ? claves[cid] || null : null;
    const c = calcularEquipo({ tx, fila, punto, resumenPorNivel: r, conteos, umbrales, estadistico });
    return {
      id: tx.id,
      matricula: leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo || '',
      subestacion: leer(tx, 'ubicacion.subestacion_nombre') || (fila && fila.subestacion) || '',
      zona: leer(tx, 'ubicacion.zona') || '', departamento: leer(tx, 'ubicacion.departamento') || '',
      potenciaKva: Number(leer(tx, 'placa.potencia_kva')) || null,
      filaId: fila ? fila.id : null, claveId: cid, tienePunto: !!punto,
      ...c
    };
  });
}

const RANGO_CLASE = { firme: 0, provisional: 1, nulo: 2 };

/** Filtra la lista. */
export function filtrarFilas(filas, f = {}) {
  const q = sinTildes(f.texto || '');
  // Zona y CRG admiten VARIAS a la vez (lista); un texto suelto sigue valiendo; vacío = todas.
  const lista = (v) => (Array.isArray(v) ? v : (v === '' || v == null ? [] : [v])).map(String);
  const zonas = new Set(lista(f.zona)); const crgs = new Set(lista(f.crg));
  return filas.filter((x) => {
    if (q && !sinTildes(x.matricula + ' ' + x.subestacion + ' ' + x.zona + ' ' + x.departamento).includes(q)) return false;
    if (zonas.size && !zonas.has(String(x.zona))) return false;
    if (f.estado && x.estado !== f.estado) return false;
    if (crgs.size && !crgs.has(String(x.crg))) return false;
    if (f.soloSostenida && !x.sobrecargaSostenida) return false;
    if (f.soloFirmes && x.clase !== 'firme') return false;
    return true;
  });
}

/** Ordena: por defecto firmes > provisionales > nulos y, dentro, por cargabilidad descendente. */
export function ordenarFilas(filas, campo = 'pct', dir = 'desc') {
  const s = dir === 'asc' ? 1 : -1;
  const val = (x) => {
    if (campo === 'pct') return x.pct;
    if (campo === 'oficial') return x.oficial ? x.oficial.pct : null;
    if (campo === 'potencia') return x.potenciaKva;
    if (campo === 'matricula') return x.matricula;
    if (campo === 'subestacion') return x.subestacion;
    return x[campo];
  };
  return [...filas].sort((a, b) => {
    if (campo === 'pct' && RANGO_CLASE[a.clase] !== RANGO_CLASE[b.clase]) return RANGO_CLASE[a.clase] - RANGO_CLASE[b.clase];
    const va = val(a); const vb = val(b);
    if (va == null && vb == null) return String(a.matricula).localeCompare(String(b.matricula));
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return s * va.localeCompare(vb, 'es');
    return s * (va - vb) || String(a.matricula).localeCompare(String(b.matricula));
  });
}

/** Mes por defecto: el último mes COMPLETO del catálogo (o el último cargado). */
export function mesPorDefecto(catalogo) {
  const meses = Object.entries((catalogo && catalogo.meses) || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const completo = meses.find(([, m]) => m && m.completo);
  return completo ? completo[0] : (meses[0] ? meses[0][0] : null);
}
