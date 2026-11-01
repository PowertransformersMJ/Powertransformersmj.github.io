// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Rastro de actividad del visitante (lógica pura) · `99 §199`
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-01): «este perfil de visitante necesito rastrearlo, cuántas veces
// inicia sesión, en qué se ubica, qué consulta, todo». Sus decisiones: módulo y equipo (sin
// ubicación física), control interno, panel en Administración, se conserva mientras la cuenta exista.
// Aquí: qué se guarda de cada evento (forma acotada, la misma que exigen las reglas de
// `actividad_visitante/{uid}/eventos`) y cómo se resume en el panel. Sin DOM ni Firebase.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

export const TIPOS_EVENTO = Object.freeze(['pagina', 'equipo', 'ruta', 'control', 'clic', 'seleccion', 'intento']);
/** Una VISITA se corta tras este tiempo sin actividad (o al cambiar de día en Colombia). */
export const PAUSA_VISITA_MS = 30 * 60000;
export const CLAVES_DETALLE = Object.freeze(['mat', 'mes', 'desde', 'hasta', 'periodo', 'control', 'valor', 'texto', 'tipo', 'nombre']);
export const CLAVES_DISPOSITIVO = Object.freeze(['nav', 'so', 'tipo', 'pantalla']);
/** Topes de texto (los mismos de las reglas). */
export const TOPE_TEXTO = 160;
export const TOPE_CLAVE = 40;

const NOMBRE_PAGINA = { 'cargabilidad-scada': 'Cargabilidad SCADA', 'mapa-v2': 'Mapa' };

/** Texto de una línea, sin caracteres de control, recortado. */
export function recortar(v, tope = TOPE_TEXTO) {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > tope ? s.slice(0, tope - 1) + '…' : s;
}

/** Solo las claves conocidas, como texto acotado; las vacías no viajan. */
export function detalleLimpio(obj) {
  const d = {};
  for (const k of CLAVES_DETALLE) {
    if (!obj || obj[k] == null) continue;
    const v = recortar(obj[k]);
    if (v) d[k] = v;
  }
  return d;
}

/** 'cargabilidad-scada' | 'mapa-v2' | el nombre de la página (sin carpeta ni .html). */
export function paginaDe(pathname) {
  const ultimo = String(pathname ?? '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
  return recortar(ultimo.replace(/\.html$/i, '').toLowerCase(), TOPE_CLAVE) || 'inicio';
}

/**
 * La ruta de Cargabilidad SCADA (`#mat=…&mes=…|desde=…&hasta=…`, `#mes=…`, `#periodo=…`) como evento:
 * abrir un equipo o cambiar el mes/periodo de la lista. Nada → null.
 */
export function eventoDeRuta(hash) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const mat = p.get('mat');
  if (mat) return { tipo: 'equipo', detalle: detalleLimpio({ mat, mes: p.get('mes'), desde: p.get('desde'), hasta: p.get('hasta') }) };
  const mes = p.get('mes'); const periodo = p.get('periodo');
  if (mes || periodo) return { tipo: 'ruta', detalle: detalleLimpio({ mes, periodo }) };
  return null;
}

/** Navegador, sistema y tipo de equipo a partir del user-agent (sin huella digital: solo lo legible). */
export function describirDispositivo(ua, { ancho, alto, tactil } = {}) {
  const u = String(ua ?? '');
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox'
    : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Otro';
  const so = /Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows'
    : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : 'Otro';
  // El iPad se presenta como Mac (con pantalla táctil); una tableta Android no dice «Mobile».
  const ipad = /iPad/.test(u) || (so === 'macOS' && !!tactil);
  const tableta = ipad || /Tablet/.test(u) || (so === 'Android' && !/Mobile/.test(u));
  const tipo = tableta ? 'Tableta' : /Mobi|iPhone|iPod/.test(u) ? 'Celular' : 'Computador';
  const pantalla = ancho && alto ? `${Math.round(ancho)}×${Math.round(alto)}` : '';
  const d = { nav, so: ipad ? 'iPadOS' : so, tipo };
  if (pantalla) d.pantalla = pantalla;
  return d;
}

/** Fecha de un evento: Timestamp de Firestore, Date o milisegundos. */
export function fechaDe(en) {
  if (!en) return null;
  if (typeof en.toDate === 'function') return en.toDate();
  if (en instanceof Date) return en;
  if (typeof en === 'number') return new Date(en);
  if (typeof en.seconds === 'number') return new Date(en.seconds * 1000);
  return null;
}

/** El evento en palabras, para la línea de tiempo del panel. */
export function describirEvento(e) {
  const d = (e && e.detalle) || {};
  const pagina = NOMBRE_PAGINA[e && e.pagina] || (e && e.pagina) || '';
  switch (e && e.tipo) {
    case 'pagina': return 'Abrió ' + pagina;
    case 'equipo': return 'Consultó el equipo ' + (d.mat || '¿?')
      + (d.desde && d.hasta ? ` (rango ${d.desde} a ${d.hasta})` : d.mes ? ` (mes ${d.mes})` : '');
    case 'ruta': return d.periodo ? 'Vio el periodo ' + d.periodo : 'Vio el mes ' + (d.mes || '¿?');
    case 'control': return `Cambió «${d.control || 'un filtro'}»` + (d.valor ? ` a «${d.valor}»` : '');
    case 'clic': return `Pulsó «${d.texto || d.control || 'un botón'}»`;
    case 'intento': return 'Intentó abrir una página que no tiene permitida' + (d.texto ? ` (${d.texto})` : '') + ': volvió a su inicio';
    case 'seleccion': return 'Seleccionó en el mapa ' + ({ subestacion: 'la subestación', municipio: 'el municipio', departamento: 'el departamento' }[d.tipo] || '')
      + ' ' + (d.nombre || '¿?') + (d.mat ? ` (transformador ${d.mat})` : '');
    default: return 'Evento';
  }
}

const diaCO = (f) => new Date(f.getTime() - 5 * 3600000).toISOString().slice(0, 10);   // día de Colombia (UTC−5)

/**
 * Resumen para el panel.
 * - INICIO DE SESIÓN: la marca `ingreso` (hora del último inicio de sesión que da Firebase Auth) cambia solo al
 *   volver a escribir la clave, no al recargar. Una sesión puede quedar abierta varios días.
 * - VISITA: un tramo de uso continuo: se corta tras PAUSA_VISITA_MS sin actividad, al cambiar de día (Colombia)
 *   o al cambiar el inicio de sesión. Duración y días se cuentan por visitas.
 * Es un registro que anota el navegador del visitante: muestra lo que hizo en la pantalla.
 * @param {Array} eventos  { tipo, pagina, detalle, ingreso, sesion, disp, en }
 */
export function resumirActividad(eventos) {
  const lista = (eventos || []).map((e) => ({ ...e, fecha: fechaDe(e.en) })).filter((e) => e.fecha)
    .sort((a, b) => a.fecha - b.fecha);
  const visitas = [];
  const ingresos = new Set();
  const equipos = new Map();
  let v = null;
  for (const e of lista) {
    const k = e.ingreso || '(sin marca)';
    ingresos.add(k);
    if (!v || v.ingreso !== k || e.fecha - v.fin > PAUSA_VISITA_MS || diaCO(e.fecha) !== diaCO(v.inicio)) {
      v = { ingreso: k, inicio: e.fecha, fin: e.fecha, eventos: 0, paginas: new Set(), equipos: new Set(), intentos: 0, disp: null };
      visitas.push(v);
    }
    v.fin = e.fecha; v.eventos++;
    if (e.pagina) v.paginas.add(NOMBRE_PAGINA[e.pagina] || e.pagina);
    if (e.disp && !v.disp) v.disp = e.disp;
    if (e.tipo === 'intento') v.intentos++;
    const mat = (e.tipo === 'equipo' || e.tipo === 'seleccion') ? e.detalle && e.detalle.mat : null;
    if (mat) {
      v.equipos.add(mat);
      const q = equipos.get(mat) || { mat, veces: 0, ultimo: null };
      q.veces++; q.ultimo = e.fecha;
      equipos.set(mat, q);
    }
  }
  const lasVisitas = visitas.map((x) => ({
    ...x, paginas: [...x.paginas], equipos: [...x.equipos], dia: diaCO(x.inicio),
    duracionMin: Math.max(0, Math.round((x.fin - x.inicio) / 60000)),
  })).sort((a, b) => b.inicio - a.inicio);
  const dias = new Map();
  for (const x of lasVisitas) {
    const d = dias.get(x.dia) || { dia: x.dia, visitas: 0, minutos: 0 };
    d.visitas++; d.minutos += x.duracionMin;
    dias.set(x.dia, d);
  }
  return {
    totalEventos: lista.length,
    totalIngresos: ingresos.size,
    totalVisitas: lasVisitas.length,
    intentos: lista.filter((e) => e.tipo === 'intento').length,
    ultimo: lista.length ? lista[lista.length - 1].fecha : null,
    visitas: lasVisitas,
    porDia: [...dias.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1)),
    equiposMasVistos: [...equipos.values()].sort((a, b) => b.veces - a.veces || b.ultimo - a.ultimo),
  };
}

/** Filas para descargar (CSV): fecha y hora de Colombia, página, qué hizo, detalle, navegador. */
export function filasCSV(eventos) {
  const co = (f) => new Date(f.getTime() - 5 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  return (eventos || []).map((e) => ({ ...e, fecha: fechaDe(e.en) })).filter((e) => e.fecha)
    .sort((a, b) => a.fecha - b.fecha)
    .map((e) => [co(e.fecha), NOMBRE_PAGINA[e.pagina] || e.pagina || '', describirEvento(e), e.ingreso || '',
      e.disp ? [e.disp.nav, e.disp.so, e.disp.tipo, e.disp.pantalla].filter(Boolean).join(' · ') : '']);
}
