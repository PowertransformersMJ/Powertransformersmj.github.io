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
import { devanadosDe } from './scada_carga_devanados.js';
// Suma de circuitos (2026-10-24): archivo NUEVO; sin suma en la decisión, nada de esto cambia una cifra (L-102).
import { especSuma, estadoSumaNivel, componerResumen, textoSuma } from './scada_carga_suma.js';
// Sobrecarga por devanado (2026-10-26): archivo NUEVO; solo NOMBRA las marcas de siempre y evalúa los circuitos sin confirmar.
import { sobrecargaDeMes, tieneSobrecarga } from './scada_carga_sobrecarga.js';
// Cambio de medida desde un mes (2026-10-26): archivo NUEVO; sin medidas anteriores devuelve la MISMA fila (nada cambia).
import { filaDelMes, filasDelMes, motivoSinCarga } from './scada_carga_cambio_medida.js';
// Filtro «Devanado sobrecargado» (2026-10-27): archivo NUEVO; sin devanados elegidos no filtra nada.
import { pasaFiltroDevanado } from './scada_carga_filtro_devanado.js';
// El umbral de sobrecarga SEVERA (R4) del panel DGA, para la señal de cada devanado en `firmeza` (2026-10-27).
import { SEVERA_PCT } from './scada_carga_dga.js';
// Fase sin carga por diseño (banco de dos monofásicas, 2026-10-28): archivo NUEVO; sin la marca en la decisión, nada cambia.
import { faseSinCarga, faseSinCargaMide } from './scada_carga_fase_sin_carga.js';
// Unidad de reserva (2026-10-28): archivo NUEVO; sin la marca en la decisión, nada cambia.
import { esUnidadReserva, mesEnReserva, MOTIVO_RESERVA, horasNoCargadasDelMes } from './scada_carga_reserva.js';

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
 * —77 equipos en septiembre de 2026—; con el resumen se nombra la que se sabe. Mandan los niveles CON devanado (un nivel
 * sin devanado no decide: su ruido daba «llega la potencia» a un equipo sin carga); si no hay ninguno, todos.
 *   · ninguna hora de corriente llegó (sin resumen; resumen sin corriente —solo tensiones—; en el detalle, `arch` = 0):
 *     antes del primer mes del punto → aún no aparecía en el exporte; si no → no vino en el exporte;
 *   · la potencia sí llega (sP99 > 0) → la corriente no llega válida;
 *   · corriente en cero CON tensión al menos `horasMinSinCarga` horas → sin carga (fuera de servicio o en reserva);
 *   · si no, lo que queda: valores en cero sin tensión, congelados o que el propio SCADA marcó no válidos.
 */
function motivoSinHoras(resumenPorNivel, niveles, { mes = null, punto = null } = {}) {
  const conDev = new Set((niveles || []).filter((n) => n.devanado).map((n) => n.nivel));
  const todos = Object.entries(resumenPorNivel || {}).filter(([, r]) => r && typeof r === 'object');
  const usar = conDev.size ? todos.filter(([nv]) => conDev.has(nv)) : todos;
  const rs = usar.map(([, r]) => r).filter((r) => (r.arch ?? r.horas) > 0);
  if (!rs.length) {
    const meses = (punto && punto.meses) || [];
    return mes && meses.length && mes < [...meses].sort()[0] ? 'el punto SCADA aún no aparecía en el exporte' : 'no vino en el exporte del SCADA';
  }
  if (rs.some((r) => r.sP99 > 0)) return 'sin corriente válida (sí llega la potencia)';
  if (rs.some((r) => (r.des || 0) >= CALCULO.horasMinSinCarga)) return 'sin carga (fuera de servicio o en reserva)';
  return 'medida en cero, congelada o marcada no válida por el SCADA';
}

/**
 * Señal de sobrecarga de UN nivel (2026-10-27): 0 nada · 1 sostenida sobre el 100 % (o en el borde) · 2 severa (sobre
 * `SEVERA_PCT`, la de R4) · 3 horas imposibles (> 3 × ampacidad). Con la misma tolerancia de redondeo que la sostenida.
 */
function senalSobrecarga(n) {
  const tol = (100 * 0.0005) / n.A;
  if (n.picoPct != null && n.picoPct + tol > CALCULO.topeFisicoXAmpacidad * 100) return 3;
  if (n.sostenidaPct == null) return 0;
  if (n.sostenidaPct > SEVERA_PCT) return 2;
  return n.sostenidaPct + tol > CALCULO.sobrecargaPct ? 1 : 0;
}

/**
 * Cálculo de UN transformador para un periodo con resúmenes por nivel (físicos, en A).
 * Lo usa la lista (resumen del mes guardado) y el detalle (resumen del rango calculado).
 */
export function calcularEquipo({ tx, fila, punto, resumenPorNivel, conteos, umbrales, estadistico = CALCULO.estadistico, mesesFallidos = [], mes = null, firmezaPeriodo = null, fueraMes = 0 }) {
  const placa = placaDe(tx);
  const clave = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
  const esCircuito = !!clave && !esElementoTransformador(clave.elem);
  const { avisos, mapa, relacion } = fila ? avisosFila(fila, { ...conteos, tx, punto, resumenPorNivel }) : { avisos: [], mapa: null, relacion: null };
  const estado = estadoEfectivo(fila, avisos);
  // Suma de circuitos: un nivel que la decisión manda SUMAR solo da cifra con su derivado válido (el del mes, el del
  // periodo o el del rango del detalle); si no, queda sin cifra con su motivo. NUNCA la medida propia del transformador.
  const spec = especSuma(fila);
  const sumaNiveles = []; const motivosSuma = []; const avisosSuma = [];
  const niveles = [];
  const devanados = [];
  const nivelesReserva = [];
  for (const nv of Object.keys((punto && punto.niveles) || {}).sort((a, b) => NIVELES[b].kv - NIVELES[a].kv)) {
    const d = mapa ? mapa[nv] || null : null;
    const r = resumenPorNivel ? resumenPorNivel[nv] : null;
    const A = d ? placa[d].A : null;
    const sp = spec && d ? spec.porNivel[nv] || null : null;
    const es = sp && r ? estadoSumaNivel(r, sp) : null;   // sin resumen del nivel no hay cifra que bloquear
    const bloqueado = !!(es && es.estado !== 'ok');
    const escala = r && d ? atribuirEscala(r, A) : (r ? 'sin_devanado' : 'sin_dato');
    let pct = d && r && !bloqueado ? cargabilidad(r, A, estadistico) : null;
    if (escala === 'ESCALA_I' || escala === 'ESCALA_INDETERMINADA') pct = null;
    const sostPct = d && r && !bloqueado && r.sost && A > 0 ? 100 * r.sost.v / A : null;
    const picoPct = d && r && !bloqueado && r.i && r.i.max != null && A > 0 ? 100 * r.i.max / A : null;
    // Banco de dos monofásicas (marca del Ingeniero): la fase marcada no existe. Con suma de circuitos no aplica.
    const fsc = d && !sp ? faseSinCarga(fila, nv) : null;
    const fila1 = {
      nivel: nv, etiqueta: sp ? NIVELES[nv].etiqueta + ' · suma de circuitos' : NIVELES[nv].etiqueta, devanado: d, nombreDevanado: d ? DEVANADO[d] : null, A,
      pct, escala, cobertura: r ? r.cob : null, n: r && r.i ? r.i.n : 0, sostenidaPct: sostPct, picoPct,
      sinDatos: !r || !r.i || r.i.n === 0,
      ...(fsc ? { faseSinCarga: fsc } : {}),
      ...(sp ? { suma: { de: sp.elems, estado: es ? es.estado : null, veredicto: es ? es.veredicto : null } } : {})
    };
    if (sp) {
      sumaNiveles.push({ nivel: nv, etiqueta: NIVELES[nv].etiqueta, devanado: d, de: sp.elems, estado: es ? es.estado : null, veredicto: es ? es.veredicto : null, derivado: (r && r.derivado) || null });
      if (es && es.motivo) motivosSuma.push(es.motivo);
      if (es && es.aviso) avisosSuma.push(es.aviso);
    }
    niveles.push(fila1);
    nivelesReserva.push({ devanado: d, n: fila1.n, pct, pctMax: picoPct, horas: r && r.horas != null ? r.horas : null, servicio: r && r.servicio != null ? r.servicio : null });
    // Varios meses (2026-10-27): la cobertura del devanado en los meses en que midió y cuántos midió (ver `firmeza`).
    const fp = d && firmezaPeriodo ? firmezaPeriodo[d] || null : null;
    // Con la marca, sus horas de dos fases no son «falta una fase». El resguardo se mira también mes a mes (varios meses).
    const unaFalta = r && r.i ? r.i.unaFalta || 0 : 0;
    if (d) devanados.push({ d, A, pct, cobertura: fila1.cobertura, n: fila1.n, escala, unaFalta: fsc ? 0 : unaFalta,
      ...(fsc ? { faseSinCarga: fsc, faseSinCargaMide: faseSinCargaMide(fila1.n, unaFalta) || !!(fp && fp.faseSinCargaMideMes) } : {}),
      // Unidad de reserva: las 72 h y «falta una fase» con las horas de los meses que cuentan (campos nuevos, con guarda).
      ...(fp && fp.mesesReserva ? { mesesReserva: fp.mesesReserva, nFirmeza: fp.nFirmeza, unaFaltaFirmeza: fsc ? 0 : fp.unaFaltaFirmeza } : {}),
      servicio: r && r.servicio != null ? r.servicio : null, horas: r && r.horas != null ? r.horas : null,
      ...(fp ? { coberturaFirmeza: fp.coberturaFirmeza, mesesMedidos: fp.mesesMedidos, mesesTotal: fp.mesesTotal } : {}) });
  }
  // Señal de sobrecarga de cada devanado para `firmeza` (lo que solo muestra un devanado que mide poco no se da por firme).
  for (const x of devanados) x.sobre = Math.max(0, ...niveles.filter((n) => n.devanado === x.d && n.A > 0).map(senalSobrecarga));
  const conPct = devanados.filter((x) => x.pct != null);
  let pctEq = conPct.length ? Math.max(...conPct.map((x) => x.pct)) : null;
  const devMax = conPct.length ? conPct.reduce((a, b) => (b.pct > a.pct ? b : a)).d : null;
  const f0 = firmeza({ estadoHomologacion: estado, esCircuito, devanados, placa, mesesFallidos });
  // La suma agrega sus motivos (D4: no cuadra → provisional); sin suma, `f` es exactamente la firmeza de siempre.
  const extraSuma = [...new Set([...motivosSuma, ...avisosSuma])];
  const f = extraSuma.length ? { firme: false, motivos: [...f0.motivos, ...extraSuma] } : f0;
  // Un circuito sin confirmar o una homologación excluida NO dan número (decisión del Ingeniero).
  let motivoNulo = null;
  if (estado === 'excluida') { pctEq = null; motivoNulo = 'homologación excluida'; }
  else if (estado === 'sin_homologacion') { pctEq = null; motivoNulo = 'sin homologación'; }
  else if (esCircuito && estado !== 'confirmada') { pctEq = null; motivoNulo = 'se mide un circuito, no el transformador'; }
  else if (!clave) motivoNulo = 'la homologación no trae punto SCADA';
  else if (!punto) motivoNulo = 'sin datos SCADA cargados';
  else if (pctEq == null && motivosSuma.length) motivoNulo = motivosSuma[0];
  else if (pctEq == null) motivoNulo = devanados.some((x) => x.escala === 'ESCALA_I' || x.escala === 'ESCALA_INDETERMINADA')
    ? 'escala de la corriente sospechosa'
    : (devanados.some((x) => !(x.A > 0)) ? 'sin ampacidad del devanado'
      // Hay horas medidas pero ningún devanado asignado: decir «sin horas válidas» engañaba. Se nombra la causa.
      : (!devanados.length && niveles.some((n) => !n.sinDatos) ? motivoSinDevanado(avisos, placa) : motivoSinHoras(resumenPorNivel, niveles, { mes, punto })));
  // Unidad de reserva (marca del Ingeniero): un mes (o rango) sin carga apreciable queda sin cifra «en reserva» y no cuenta
  // para la firmeza de varios meses. Solo con la medida aceptada y datos del punto; si ese mes llevó carga, todo igual.
  const enReserva = esUnidadReserva(fila) && !!clave && !!punto && estado !== 'excluida' && estado !== 'sin_homologacion'
    && !(esCircuito && estado !== 'confirmada') && mesEnReserva(nivelesReserva, fueraMes);
  if (enReserva) { pctEq = null; motivoNulo = MOTIVO_RESERVA; }
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
    delta: pctEq != null && oficialDev != null ? pctEq - oficialDev : null,
    ...(enReserva ? { enReserva: true } : {}),
    // Campo NUEVO, solo con suma (cada consumidor lo lee con guarda: un módulo viejo en caché no lo trae).
    ...(spec ? { suma: { niveles: sumaNiveles, texto: textoSuma(spec), veredicto: peorVeredicto(sumaNiveles) } } : {})
  };
}

/** El peor veredicto de los niveles sumados con derivado válido (null si ninguno lo tiene). */
function peorVeredicto(ns) {
  const peso = { ok: 0, sin_contraste: 1, no_cuadra: 2 };
  return ns.reduce((a, n) => (n.estado === 'ok' && n.veredicto && (a == null || peso[n.veredicto] > peso[a]) ? n.veredicto : a), null);
}

/**
 * Filas de la lista para un mes.
 * @param {{parque: object[], homologacion: object|null, catalogo: object|null, resumenMes: object|null, umbrales?: object}} ctx
 */
export function filasLista({ parque, homologacion, catalogo, resumenMes, umbrales, estadistico }) {
  const filasH = (homologacion && homologacion.filas) || {};
  const porMat = indicePorMatricula(filasH);
  // Cada mes se calcula con la medida que regía ESE mes (cambio de medida); sin cambios, las mismas filas de siempre.
  const mesLista = resumenMes && resumenMes.mes ? resumenMes.mes : null;
  // Días del mes que el parque aún no cargó (solo los usa la unidad de reserva: no son horas «en servicio»).
  const fueraMes = horasNoCargadasDelMes(catalogo, mesLista);
  const conteos = conteosHomologacion(filasDelMes(filasH, mesLista));
  const puntos = (catalogo && catalogo.puntos) || {};
  const claves = (resumenMes && resumenMes.claves) || {};
  return (parque || []).map((tx) => {
    const base = filaDeTransformador(tx, porMat);
    const fila = base ? filaDelMes(base, mesLista) : null;
    const k = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
    const cid = k ? claveId(k.est, k.elem) : null;
    const punto = cid ? puntos[cid] || null : null;
    // Con suma de circuitos, el nivel sumado es su resumen DERIVADO (o un registro sin cifra); sin suma, el mismo objeto.
    // Con el catálogo: si otro transformador de la estación mide esa barra (D5), el nivel queda sin cifra.
    const r = cid ? componerResumen(claves, cid, fila, puntos) || null : null;
    const c = calcularEquipo({ tx, fila, punto, resumenPorNivel: r, conteos, umbrales, estadistico, mes: resumenMes && resumenMes.mes, fueraMes });
    const x = {
      id: tx.id,
      matricula: leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo || '',
      subestacion: leer(tx, 'ubicacion.subestacion_nombre') || (fila && fila.subestacion) || '',
      zona: leer(tx, 'ubicacion.zona') || '', departamento: leer(tx, 'ubicacion.departamento') || '',
      potenciaKva: Number(leer(tx, 'placa.potencia_kva')) || null,
      filaId: fila ? fila.id : null, claveId: cid, tienePunto: !!punto,
      ...c,
      // Todos los devanados de placa con su potencia, su ampacidad y su carga (pedido del Ingeniero, 2026-10-22).
      devanadosPlaca: devanadosDe(tx, c),
      // Cambio de medida (campo NUEVO, solo en equipos con medidas anteriores; se lee con guarda). «Sin carga»: sin cifra
      // con su motivo propio, nunca 0 % ni «excluida por el Ingeniero».
      ...(fila && fila.cambioMedida ? { cambioMedida: fila.cambioMedida } : {}),
      ...(fila && fila.cambioMedida && fila.cambioMedida.tipo === 'sin_carga' ? { motivoNulo: motivoSinCarga(fila.cambioMedida), sinCarga: true } : {})
    };
    // Qué devanado se sobrecarga y de qué tipo (firme · posible · circuito sin confirmar). Campo NUEVO: se lee con guarda.
    return { ...x, sobrecarga: sobrecargaDeMes(x) };
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
    // «Con sobrecarga sostenida»: firmes, posibles (cifra provisional) y medidos por un circuito sin confirmar (2026-10-26).
    // …y los que la tuvieron antes de un cambio de medida (periodo, `sobrecargaAnterior`, 2026-10-26).
    if (f.soloSostenida && !tieneSobrecarga(x) && !x.sobrecargaAnterior) return false;
    // Devanado sobrecargado: el de su sobrecarga sostenida (o la de antes de un cambio de medida) está entre los elegidos.
    if (!pasaFiltroDevanado(x, f.devSobre)) return false;
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
