// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · MODELO del informe («contenido»)
// ──────────────────────────────────────────────────────────────────────────────
// El informe es un JSON puro (esquema «ibr@1»): sin fechas de JavaScript, sin
// `undefined` y sin listas dentro de listas (L-30). Aquí vive todo lo que se le
// hace sin pantalla ni red:
//   · nace vacío desde la plantilla (`informeVacio`) o prellenado con lo que sabe
//     la plataforma (`prellenar`, decisión 10): inventario, salud, 60 Hz y el
//     contrato que deja un administrador; cada dato guarda su ORIGEN;
//   · la acción de refrigeración es OPCIONAL y solo se LEE (decisión 12): nunca
//     se modifica el objeto que llega;
//   · la potencia se confirma en cada informe (decisión 8): cambiar ONAN u ONAF
//     quita la confirmación;
//   · `faltantes` dice qué impide emitir y en qué sección se arregla.
// Todas las funciones que cambian algo devuelven una COPIA (nunca mutan).
// ══════════════════════════════════════════════════════════════════════════════

import { huellaHex } from './fichas_adjunto.js';
import { numES, listaY, fechaDMA, rangoFechas, ordinalEs, mayusculasEs, tipoTituloEs, departamentoPapel, departamentoConocido } from './informe_brigada_formato.js';
import {
  ACTIVIDAD_REFRIGERACION, MODELOS, modeloDeActividad, FORMATO, TEXTOS, IDS_TEXTOS, FRASES, CONCLUSIONES, RECOMENDACIONES,
  DISPOSICIONES, FIGURAS_DEFECTO, SECCIONES_FIGURAS, MATERIAL_DEFECTO, HERRAMIENTAS_DEFECTO, SST_DEFECTO, PERSONAS_DEFECTO,
  HALLAZGO_DEFECTO, ANEXOS_DEFECTO, MARCA_CLAVES, MARCA_GEOMETRIA, NOMBRE_CONDICION, ROLES_FIRMA, AJUSTES_CUADRICULA, rellenar,
  ACTIVIDADES_POR_CLASE
} from './informe_brigada_plantilla.js';

export const ESQUEMA = 'ibr@1';

/* ── utilidades ───────────────────────────────────────────────────────────── */
const copia = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
const txt = (v) => (v == null ? '' : String(v).trim());
const lleno = (v) => v != null && String(v).trim() !== '';

/** Número finito o null (acepta coma decimal y texto). */
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
/** Redondeo que borra el ruido binario (34.5 × 1000 = 34500, no 34499,99…). */
const limpio = (n) => (n == null ? null : Math.round(n * 1e6) / 1e6);

/** Primera ruta con valor útil ('a.b.c'). */
function leer(obj, ...rutas) {
  for (const ruta of rutas) {
    let v = obj;
    for (const paso of ruta.split('.')) {
      if (v == null || typeof v !== 'object') { v = undefined; break; }
      v = v[paso];
    }
    if (v != null && v !== '') return v;
  }
  return null;
}

/** Condición 1–5 entera desde el HI. Fuera de 0,5–5,49 = sin calificación (misma regla que Fichas, `ui/fichas/panel.js` condEntera). */
export function condicionEntera(hi) {
  const n = num(hi);
  if (n == null) return null;
  if (n < 0.5 || n > 5.49) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

const PROHIBIDAS = new Set(['__proto__', 'prototype', 'constructor']);
function pasos(ruta) {
  const p = String(ruta == null ? '' : ruta).split('.');
  if (!p.length || p.some((x) => x === '' || PROHIBIDAS.has(x))) throw new Error('Ruta de campo no válida: «' + ruta + '».');
  return p.map((x) => (/^\d+$/.test(x) ? Number(x) : x));
}
function obtener(obj, ruta) {
  let v = obj;
  for (const k of pasos(ruta)) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[k];
  }
  return v;
}
function poner(obj, ruta, valor) {
  const p = pasos(ruta);
  let v = obj;
  for (let i = 0; i < p.length - 1; i++) {
    const k = p[i];
    if (v[k] == null || typeof v[k] !== 'object') {
      if (Array.isArray(v) && typeof k !== 'number') throw new Error('Ruta de campo no válida: «' + ruta + '».');
      v[k] = typeof p[i + 1] === 'number' ? [] : {};
    }
    v = v[k];
  }
  const ult = p[p.length - 1];
  if (Array.isArray(v) && typeof ult !== 'number') throw new Error('Ruta de campo no válida: «' + ruta + '».');
  v[ult] = valor;
}

/* ── identificadores y huellas ────────────────────────────────────────────── */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Id aleatorio [A-Za-z0-9]{n} (sin sesgo: descarta bytes ≥ 248). */
export function nuevoId(prefijo = '', n = 20) {
  const out = [];
  while (out.length < n) {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(n * 2));
    for (const x of b) {
      if (x < 248) out.push(ALFABETO[x % 62]);
      if (out.length === n) break;
    }
  }
  return prefijo + out.join('');
}

/** JSON con las claves ordenadas y sin espacios: el mismo contenido da siempre el mismo texto (y la misma huella). */
export function jsonCanonico(valor) {
  if (valor === null || valor === undefined || typeof valor === 'function') return 'null';
  if (typeof valor === 'number') return Number.isFinite(valor) ? JSON.stringify(valor) : 'null';
  if (typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return '[' + valor.map((x) => jsonCanonico(x)).join(',') + ']';
  const claves = Object.keys(valor).filter((k) => valor[k] !== undefined && typeof valor[k] !== 'function').sort();
  return '{' + claves.map((k) => JSON.stringify(k) + ':' + jsonCanonico(valor[k])).join(',') + '}';
}

/** Huella SHA-256 (64 hex) del contenido canónico: la que se congela al emitir. */
export async function huellaContenido(contenido) {
  return huellaHex(jsonCanonico(contenido));
}

/** ¿Este uid arma informes? (decisión 3: lista de uid en la configuración, nunca nombres en el código). */
export function esEditor(config, uid) {
  return !!uid && !!config && Array.isArray(config.editores) && config.editores.includes(uid);
}

/* ── inventario → equipo ─────────────────────────────────────────────────── */
/**
 * Documento v2 de /transformadores → datos del equipo para el informe. Rutas
 * verificadas en `domain/transformador_schema.js` (sanitize*) y `domain/parque_salud.js`.
 * La matrícula NUNCA sale de `codigo` (es el de la subestación). Lo que no viene, viaja vacío.
 */
export function equipoDesdeInventario(tx) {
  const t = tx || {};
  const hi = leer(t, 'salud_actual.hi_final');
  const n = condicionEntera(hi);
  const fuente = leer(t, 'salud_actual.condicion_fuente');
  return {
    transformador_id: txt(t.id),
    matricula: txt(leer(t, 'identificacion.matricula', 'matricula')),
    subestacion: txt(leer(t, 'ubicacion.subestacion_nombre', 'subestacion')),
    zona: txt(leer(t, 'ubicacion.zona', 'zona')),
    departamento: txt(leer(t, 'ubicacion.departamento', 'departamento')),
    municipio: txt(leer(t, 'ubicacion.municipio', 'municipio')),
    fabricante: txt(leer(t, 'placa.marca', 'identificacion.marca', 'marca')),
    serie: txt(leer(t, 'identificacion.numero_serie', 'identificacion.serie', 'placa.serial', 'serial', 'serie')),
    anio_fabricacion: num(leer(t, 'fabricacion.ano_fabricacion', 'anio_fab', 'ano_fabricacion')),
    potencia_kva: num(leer(t, 'placa.potencia_kva', 'potencia_kva')),
    potencia_onan_kva: num(leer(t, 'placa.potencia_onan_kva', 'potencia_onan_kva')),
    potencia_onaf_kva: num(leer(t, 'placa.potencia_onaf_kva', 'potencia_onaf_kva')),
    tension_primaria_kv: num(leer(t, 'electrico.tension_primaria_kv', 'tension_primaria_kv', 'placa.tension_primaria_kv')),
    tension_secundaria_kv: num(leer(t, 'electrico.tension_secundaria_kv', 'tension_secundaria_kv', 'placa.tension_secundaria_kv')),
    grupo_conexion: txt(leer(t, 'electrico.grupo_conexion', 'grupo_conexion')),
    salud: {
      numero: n,
      texto: n ? NOMBRE_CONDICION[n].toLocaleLowerCase('es-CO') : '',
      fuente: fuente === 'motor' || fuente === 'excel' ? fuente : '',
      hi: num(hi)
    }
  };
}

/** ¿Es un documento crudo del inventario (y no un equipo ya normalizado)? */
function esDocInventario(x) {
  return !!x && (typeof x.identificacion === 'object' || typeof x.placa === 'object' || typeof x.ubicacion === 'object' || typeof x.salud_actual === 'object');
}

/* ── ventiladores: totales y textos ───────────────────────────────────────── */
function sumaCantidades(filas) {
  const v = (Array.isArray(filas) ? filas : []).map((f) => num(f && f.cantidad)).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
function distintos(arr) {
  const out = [];
  arr.forEach((x) => { const s = txt(x); if (s && !out.some((y) => y.toLowerCase() === s.toLowerCase())) out.push(s); });
  return out;
}
const modelos = (filas) => distintos((Array.isArray(filas) ? filas : []).map((f) => f && f.modelo));
const marcasModelos = (filas) => distintos((Array.isArray(filas) ? filas : []).map((f) => [txt(f && f.marca), txt(f && f.modelo)].filter(Boolean).join(' ')));
const espacios = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Todas las variables de la plantilla para este informe. `null` = falta (el borrador
 * muestra un hueco «[…]»); '' = vacío legítimo (p. ej. sin ventiladores adicionales).
 */
export function variablesDelInforme(c) {
  const e = (c && c.equipo) || {};
  const p = (c && c.portada) || {};
  const s = (c && c.salud) || {};
  const tr = (c && c.trabajo) || {};
  const pe = (c && c.personal) || {};
  const co = (c && c.consignacion) || {};
  const ve = (c && c.ventiladores) || {};
  const h = (c && c.hallazgo) || {};
  const o = (v) => (lleno(v) ? String(v).trim() : null);
  const n = (v) => (num(v) == null ? null : numES(num(v)));
  const tecnicos = (Array.isArray(pe.tecnicos) ? pe.tecnicos : []).map(txt).filter(Boolean);
  const nAct = sumaCantidades(ve.actual);
  const nNue = sumaCantidades(ve.nuevo);
  let fraseAd = '';
  if (nAct != null && nNue != null) {
    const k = nNue - nAct;
    if (k === 1) fraseAd = FRASES.adicionalUno.replace('{ordinal}', ordinalEs(nNue));
    else if (k >= 2) fraseAd = FRASES.adicionalesVarios.replace('{k}', numES(k));
  }
  const odt = (Array.isArray(c && c.odt) ? c.odt : []).map(txt).filter(Boolean);
  const rango = rangoFechas(tr.fecha_inicio, tr.fecha_fin);
  const saludN = num(s.numero);
  return {
    clase: o(p.clase), titulo: o(p.titulo), asunto: o(p.asunto), subtitulo_anexos: o(p.subtitulo_anexos),
    actividades_clase: lleno(p.clase) ? (ACTIVIDADES_POR_CLASE[String(p.clase).trim().toUpperCase()] || null) : null,
    cliente: FORMATO.cliente, contrato: o(p.contrato),
    matricula: o(e.matricula), subestacion: o(e.subestacion),
    // Zona y departamento van en MAYÚSCULAS en el papel (el departamento con su tilde), se escriban como se escriban.
    zona: lleno(e.zona) ? mayusculasEs(String(e.zona).trim()) : null,
    departamento: lleno(e.departamento) ? departamentoPapel(e.departamento) : null,
    fabricante: o(e.fabricante), serie: o(e.serie), anio: n(e.anio_fabricacion),
    onan: n(e.potencia_onan_mva), onaf: n(e.potencia_onaf_mva),
    v1: n(e.tension_primaria_v), v2: n(e.tension_secundaria_v), grupo: o(e.grupo_conexion), hz: n(e.frecuencia_hz),
    salud_numero: saludN == null ? null : numES(saludN),
    salud_texto: lleno(s.texto) ? String(s.texto).trim().toLocaleLowerCase('es-CO') : null,
    salud_texto_mayus: lleno(s.texto) ? mayusculasEs(String(s.texto).trim()) : null,
    hallazgo_texto: o(h.texto), hallazgo_causa: o(h.causa),
    fecha_fin: fechaDMA(tr.fecha_fin) || null,
    rango_fechas: rango || null,
    ingeniero: o(pe.ingeniero),
    frase_tecnicos: tecnicos.length >= 2 ? FRASES.tecnicosVarios.replace('{lista}', listaY(tecnicos))
      : tecnicos.length === 1 ? FRASES.tecnicoUno.replace('{lista}', tecnicos[0]) : '',
    consignacion_tipo: o(co.tipo), consignacion_numero: o(co.numero),
    odt: odt.length ? odt.join(' Y ') : null,
    n_actual: nAct == null ? null : numES(nAct), n_nuevo: nNue == null ? null : numES(nNue),
    modelos_actual: listaY(modelos(ve.actual)) || null,
    modelos_nuevo: listaY(modelos(ve.nuevo)) || null,
    marcas_modelos_nuevo: listaY(marcasModelos(ve.nuevo)) || null,
    conexion: o(ve.conexion),
    frase_adicionales: fraseAd
  };
}

/** Pie sugerido: {actual}, {nuevo} y {conexion} con los ventiladores del informe (sin dobles espacios).
 *  {Conexion} va con mayúscula inicial (el pie del modelo dice «en Delta»; el párrafo, «configuración delta»). */
function resolverPie(plantilla, c) {
  const ve = (c && c.ventiladores) || {};
  const cx = txt(ve.conexion);
  return espacios(String(plantilla)
    .replace(/\{actual\}/g, listaY(modelos(ve.actual)))
    .replace(/\{nuevo\}/g, listaY(modelos(ve.nuevo)))
    .replace(/\{Conexion\}/g, cx ? cx.charAt(0).toLocaleUpperCase('es-CO') + cx.slice(1) : '')
    .replace(/\{conexion\}/g, cx));
}

/** Ajuste fino de una cuadrícula (AJUSTES_CUADRICULA): solo claves y números admitidos; null si no queda nada. */
export function ajusteLimpio(ajuste) {
  if (!ajuste || typeof ajuste !== 'object' || Array.isArray(ajuste)) return null;
  const out = {};
  for (const [k, regla] of Object.entries(AJUSTES_CUADRICULA)) {
    const v = ajuste[k];
    if (v == null) continue;
    if (k === 'alinearV') { if (regla.includes(v)) out[k] = v; continue; }
    if (k === 'anchosCol') {
      if (Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every((x) => typeof x === 'number' && x >= regla[0] && x <= regla[1])) out[k] = v.slice();
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v) && v >= regla[0] && v <= regla[1]) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/* ── cuadrículas de fotos ─────────────────────────────────────────────────── */
function siguienteNumero(c, prefijo) {
  let max = 0;
  const re = new RegExp('^' + prefijo + '(\\d+)$');
  SECCIONES_FIGURAS.forEach((s) => ((c.figuras && c.figuras[s]) || []).forEach((g) => {
    const mg = re.exec(g.id || ''); if (mg) max = Math.max(max, +mg[1]);
    (g.figuras || []).forEach((f) => { const mf = re.exec(f.id || ''); if (mf) max = Math.max(max, +mf[1]); });
  }));
  return max + 1;
}
const dos = (n) => String(n).padStart(2, '0');

/** Cuadrícula nueva con sus huecos de foto vacíos (los pies pueden traer {actual}/{nuevo}/{conexion}).
 *  `ajuste`: el ajuste fino del modelo para esa cuadrícula (solo las de la plantilla lo traen). */
function cuadriculaNueva(c, disposicion, pies = [], ajuste = null) {
  const d = DISPOSICIONES[disposicion];
  if (!d) throw new Error('Disposición de fotos desconocida: «' + disposicion + '».');
  let ng = siguienteNumero(c, 'g');
  let nf = siguienteNumero(c, 'fg');
  const figuras = [];
  for (let i = 0; i < d.figuras; i++) {
    const tpl = pies[i] != null ? String(pies[i]) : '';
    const fig = { id: 'fg' + dos(nf++), pie: resolverPie(tpl, c), fotos: [] };
    if (/\{(actual|nuevo|conexion|Conexion)\}/.test(tpl)) fig.pie_plantilla = tpl;
    for (let k = 0; k < d.fotosPorFigura; k++) fig.fotos.push({ archivo: null, marcas: [] });
    figuras.push(fig);
  }
  const g = { id: 'g' + dos(ng++), disposicion, figuras };
  const aj = ajusteLimpio(ajuste);
  if (aj) g.ajuste = aj;
  return g;
}

/* ── tablas automáticas ───────────────────────────────────────────────────── */
function personas(c) {
  const pe = (c && c.personal) || {};
  const n = (lleno(pe.ingeniero) ? 1 : 0) + (Array.isArray(pe.tecnicos) ? pe.tecnicos.filter(lleno).length : 0);
  return n || PERSONAS_DEFECTO;
}

function descripcionVentilador(f) {
  const cfm = num(f.cfm_unitario);
  return espacios(['VENTILADOR', txt(f.marca), txt(f.modelo)].filter(Boolean).join(' ') + (cfm != null ? ' (' + numES(cfm) + ' CFM)' : ''));
}

const TOPE_FILAS_AUTO = 60;

/** Sincroniza lo que se deriva de los ventiladores y del personal (mutando `c`, que ya es una copia). */
function sincronizar(c) {
  c.tablas = c.tablas || {};
  c.corrientes = c.corrientes || { filas: [], nominal: null };
  const ve = c.ventiladores || {};
  const nuevos = (Array.isArray(ve.nuevo) ? ve.nuevo : []).filter((f) => f && lleno(f.modelo));
  // Tabla 2: una fila automática por ventilador nuevo; las filas escritas a mano se conservan después.
  const material = (c.tablas && Array.isArray(c.tablas.material)) ? c.tablas.material : [];
  const manuales = material.filter((r) => !r.auto);
  const yaEscritas = new Set(manuales.flatMap((r) => [txt(r.descripcion), txt(r.reemplaza)]).filter(Boolean).map((t) => t.toLowerCase()));
  const auto = nuevos
    .map((f) => ({ descripcion: descripcionVentilador(f), unidad: 'UND', cantidad: num(f.cantidad), auto: true }))
    .filter((r) => !yaEscritas.has(r.descripcion.toLowerCase()));
  c.tablas.material = auto.concat(manuales);

  // Tabla 5: V1…Vn por cada ventilador nuevo; las mediciones escritas se conservan por su rótulo.
  const filas = (c.corrientes && Array.isArray(c.corrientes.filas)) ? c.corrientes.filas : [];
  const porRotulo = new Map(filas.map((f) => [txt(f.ventilador), f]));
  const usadas = new Set();
  const nuevasFilas = [];
  let k = 0;
  nuevos.forEach((f) => {
    const n = Math.max(0, Math.floor(num(f.cantidad) || 0));
    for (let i = 0; i < n && nuevasFilas.length < TOPE_FILAS_AUTO; i++) {
      k += 1;
      const rot = 'V' + k + ' ' + txt(f.modelo);
      const prev = porRotulo.get(rot);
      if (prev) usadas.add(rot);
      nuevasFilas.push({ ventilador: rot, r: prev ? prev.r : null, s: prev ? prev.s : null, t: prev ? prev.t : null, auto: true });
    }
  });
  // Una fila automática que ya no corresponde pero tiene mediciones NO se borra: pasa a «a mano».
  const conDatos = (f) => ['r', 's', 't'].some((k) => f[k] != null && f[k] !== '');
  const sueltas = filas
    .filter((f) => !usadas.has(txt(f.ventilador)) && (!f.auto || conDatos(f)))
    .map((f) => (f.auto ? { ...f, auto: false } : f));
  c.corrientes.filas = nuevasFilas.concat(sueltas);
  if (!c.corrientes.nominal || c.corrientes.nominal.auto !== false) {
    const mods = modelos(nuevos);
    const prevN = c.corrientes.nominal || {};
    c.corrientes.nominal = { etiqueta: mods.length ? 'NOMINAL ' + mods.join(' / ') : 'NOMINAL', r: prevN.r ?? null, s: prevN.s ?? null, t: prevN.t ?? null };
  }

  // Pies sugeridos que nadie ha cambiado.
  SECCIONES_FIGURAS.forEach((s) => ((c.figuras && c.figuras[s]) || []).forEach((g) => (g.figuras || []).forEach((f) => {
    if (f.pie_plantilla) f.pie = resolverPie(f.pie_plantilla, c);
  })));

  // Tabla 4: lo que va «por persona» sigue al personal mientras nadie lo cambie.
  const np = personas(c);
  ((c.tablas && c.tablas.sst) || []).forEach((r) => { if (r.por_persona) r.cantidad = np; });
  return c;
}

/* ── informe vacío y prellenado ───────────────────────────────────────────── */
function origen(c, ruta, fuente, original, extra) {
  c.origenes = (c.origenes || []).filter((o) => o.ruta !== ruta);
  const o = { ruta, fuente, original: original === undefined ? null : copia(original) };
  if (extra) Object.assign(o, extra);
  c.origenes.push(o);
}

/**
 * Informe nuevo desde la plantilla de su actividad. Solo «Actualización y repotenciación
 * del sistema de refrigeración.» tiene modelo hoy (decisión 2); otra actividad → error.
 */
export function informeVacio({ actividad = ACTIVIDAD_REFRIGERACION } = {}) {
  const id = modeloDeActividad(actividad);
  if (!id) throw new Error('La actividad «' + txt(actividad) + '» todavía no tiene modelo de informe.');
  const m = MODELOS[id];
  const c = {
    esquema: ESQUEMA,
    modelo: id,
    actividad: m.actividad,
    portada: { clase: m.tipo.clase, titulo: m.tipo.titulo, asunto: m.tipo.asunto, subtitulo_anexos: m.tipo.subtitulo_anexos, contrato: '' },
    equipo: {
      transformador_id: '', matricula: '', subestacion: '', zona: '', departamento: '',
      fabricante: '', serie: '', anio_fabricacion: null,
      potencia_onan_mva: null, potencia_onaf_mva: null,
      tension_primaria_v: null, tension_secundaria_v: null,
      grupo_conexion: '', frecuencia_hz: 60
    },
    salud: { numero: null, texto: '', fuente: '' },
    confirmaciones: { potencia: false },
    hallazgo: { texto: HALLAZGO_DEFECTO.texto, causa: HALLAZGO_DEFECTO.causa },
    trabajo: { fecha_inicio: '', fecha_fin: '' },
    personal: { ingeniero: '', tecnicos: [] },
    consignacion: { numero: '', tipo: 'con riesgo de disparo' },
    odt: [],
    ventiladores: {
      actual: [{ modelo: '', cantidad: null, cfm_unitario: null }],
      nuevo: [{ marca: '', modelo: '', cantidad: null, cfm_unitario: null }],
      conexion: 'delta',
      accion_id: null,
      accion_fecha: null
    },
    tablas: {
      material: MATERIAL_DEFECTO.map((r) => ({ descripcion: r.descripcion, unidad: r.unidad, cantidad: r.cantidad, auto: false })),
      herramientas: HERRAMIENTAS_DEFECTO.map((r) => ({ descripcion: r.descripcion, unidad: r.unidad, cantidad: r.cantidad })),
      sst: SST_DEFECTO.map((r) => (r.por_persona
        ? { descripcion: r.descripcion, unidad: r.unidad, cantidad: PERSONAS_DEFECTO, por_persona: true }
        : { descripcion: r.descripcion, unidad: r.unidad, cantidad: r.cantidad }))
    },
    corrientes: { filas: [], nominal: { etiqueta: 'NOMINAL', r: null, s: null, t: null } },
    figuras: {},
    archivos: {},
    anexos: ANEXOS_DEFECTO.map((a) => (a.tipo === 'calculo'
      ? { clave: a.clave, tipo: a.tipo, titulo: null, titulo_portada: null }
      : a.tipo === 'ficha'
        ? { clave: a.clave, tipo: a.tipo, titulo: null, titulo_portada: null, archivo: null, ficha: null }
        : { clave: a.clave, tipo: a.tipo, titulo: null, titulo_portada: null, archivo: null })),
    textos: Object.fromEntries(IDS_TEXTOS.map((k) => [k, null])),
    conclusiones: CONCLUSIONES.map((x) => ({ plantilla: x.id, texto: null })),
    recomendaciones: RECOMENDACIONES.map((x) => ({ plantilla: x.id, texto: null })),
    firmas: Object.fromEntries(ROLES_FIRMA.map((r) => [r, { nombre: '', firmante: null }])),
    origenes: []
  };
  SECCIONES_FIGURAS.forEach((s) => {
    c.figuras[s] = [];
    FIGURAS_DEFECTO[s].forEach((g) => c.figuras[s].push(cuadriculaNueva(c, g.disposicion, g.pies, g.ajuste)));
  });
  ['clase', 'titulo', 'asunto', 'subtitulo_anexos'].forEach((k) => origen(c, 'portada.' + k, 'plantilla', c.portada[k]));
  origen(c, 'hallazgo.texto', 'plantilla', c.hallazgo.texto);
  origen(c, 'hallazgo.causa', 'plantilla', c.hallazgo.causa);
  origen(c, 'consignacion.tipo', 'plantilla', c.consignacion.tipo);
  origen(c, 'ventiladores.conexion', 'plantilla', c.ventiladores.conexion);
  origen(c, 'equipo.frecuencia_hz', 'fijo', 60);
  return sincronizar(c);
}

/**
 * Informe nuevo, prellenado con lo que ya sabe la plataforma (decisión 10). Cada dato
 * guarda su origen para que la pantalla diga «Inventario», «Salud de Activos», etc.
 * @param {object} p
 * @param {object} p.equipo   documento del inventario (o el resultado de `equipoDesdeInventario`)
 * @param {object} [p.config] configuración del informe (contrato por defecto)
 * @param {object} [p.accion] acción de refrigeración ELEGIDA por el usuario (opcional; solo se lee)
 */
export function prellenar({ equipo, config = null, accion = null, actividad = ACTIVIDAD_REFRIGERACION } = {}) {
  const c = informeVacio({ actividad });
  const q = esDocInventario(equipo) ? equipoDesdeInventario(equipo) : (equipo || {});
  const e = c.equipo;
  e.transformador_id = txt(q.transformador_id);
  const desde = (campo, valor, fuente, extra) => {
    if (valor == null || valor === '') return;
    e[campo] = valor;
    origen(c, 'equipo.' + campo, fuente, valor, extra);
  };
  desde('matricula', txt(q.matricula), 'inventario');
  const subCruda = txt(q.subestacion);
  desde('subestacion', tipoTituloEs(subCruda), 'inventario', subCruda && tipoTituloEs(subCruda) !== subCruda ? { crudo: subCruda } : null);
  desde('zona', mayusculasEs(txt(q.zona)), 'inventario');
  const depCrudo = txt(q.departamento);
  desde('departamento', departamentoPapel(depCrudo), 'inventario', depCrudo && departamentoPapel(depCrudo) !== depCrudo ? { crudo: depCrudo } : null);
  desde('fabricante', txt(q.fabricante), 'inventario');
  desde('serie', txt(q.serie), 'inventario');
  desde('anio_fabricacion', num(q.anio_fabricacion), 'inventario');
  // Potencia (decisión 8): el inventario guarda UN número y en un ONAF es la ONAF (L-142).
  // ONAN y ONAF separadas solo si el inventario las trae; la confirmación arranca en «no».
  const onaf = num(q.potencia_onaf_kva) ?? num(q.potencia_kva);
  desde('potencia_onaf_mva', onaf != null && onaf > 0 ? limpio(onaf / 1000) : null, 'inventario');
  const onan = num(q.potencia_onan_kva);
  desde('potencia_onan_mva', onan != null && onan > 0 ? limpio(onan / 1000) : null, 'inventario');
  const v1 = num(q.tension_primaria_kv); const v2 = num(q.tension_secundaria_kv);
  desde('tension_primaria_v', v1 != null && v1 > 0 ? limpio(v1 * 1000) : null, 'inventario');
  desde('tension_secundaria_v', v2 != null && v2 > 0 ? limpio(v2 * 1000) : null, 'inventario');
  desde('grupo_conexion', txt(q.grupo_conexion), 'inventario');
  c.confirmaciones.potencia = false;

  const s = q.salud || {};
  const n0 = num(s.numero);
  const sn = Number.isInteger(n0) && n0 >= 1 && n0 <= 5 ? n0 : null;
  c.salud = { numero: sn, texto: sn ? txt(s.texto) || NOMBRE_CONDICION[sn].toLocaleLowerCase('es-CO') : '', fuente: txt(s.fuente) };
  // Siempre se anota el origen de la salud: si llegó vacía, «sin calificación» queda a la vista.
  origen(c, 'salud.numero', 'salud', sn);
  if (sn) origen(c, 'salud.texto', 'salud', c.salud.texto);

  const contrato = txt(config && config.contrato_defecto);
  if (contrato) { c.portada.contrato = contrato; origen(c, 'portada.contrato', 'configuracion', contrato); }

  // Firmantes por defecto (Elaborado / Revisado / Aprobado) de la configuración: llegan llenos y se pueden cambiar.
  const firmantes = (config && Array.isArray(config.firmantes)) ? config.firmantes : [];
  c.firmas = c.firmas || {};
  for (const rol of ROLES_FIRMA) {
    const f = firmantes.find((x) => x && x.rol === rol && lleno(x.nombre));
    if (!f) continue;
    const nombre = mayusculasEs(String(f.nombre).trim());
    c.firmas[rol] = { nombre, firmante: lleno(f.clave) ? String(f.clave) : null };
    origen(c, 'firmas.' + rol + '.nombre', 'configuracion', nombre);
  }

  const listo = accion ? aplicarAccion(c, accion) : sincronizar(c);
  // Los pies de la plantilla se resuelven al crear con lo que ya se sabe.
  return listo;
}

/**
 * Llena los ventiladores nuevos y las potencias con una acción de refrigeración
 * (decisión 12). La acción NO se toca: solo se leen `kva_onan`, `kva_onaf`, `mix`,
 * `id` y `fecha_accion`. Ventiladores del mismo modelo se suman en una fila.
 */
export function aplicarAccion(contenido, accion) {
  const c = copia(contenido);
  if (!accion || typeof accion !== 'object') return sincronizar(c);
  const mix = Array.isArray(accion.mix) ? accion.mix : [];
  const filas = [];
  mix.forEach((m) => {
    if (!m || typeof m !== 'object') return;
    const marca = txt(m.marca); const modelo = txt(m.modelo);
    if (!marca && !modelo) return;
    const cfm = num(m.cfm_unitario); const cant = num(m.cantidad);
    const igual = filas.find((f) => f.marca.toLowerCase() === marca.toLowerCase() && f.modelo.toLowerCase() === modelo.toLowerCase() && f.cfm_unitario === cfm);
    if (igual) igual.cantidad = (igual.cantidad || 0) + (cant || 0);
    else filas.push({ marca, modelo, cantidad: cant, cfm_unitario: cfm });
  });
  if (filas.length) {
    c.origenes = (c.origenes || []).filter((o) => !o.ruta.startsWith('ventiladores.nuevo.'));
    c.ventiladores.nuevo = filas;
    filas.forEach((f, i) => ['marca', 'modelo', 'cantidad', 'cfm_unitario'].forEach((k) => {
      if (f[k] != null && f[k] !== '') origen(c, 'ventiladores.nuevo.' + i + '.' + k, 'accion', f[k]);
    }));
  }
  const kOnan = num(accion.kva_onan); const kOnaf = num(accion.kva_onaf);
  if (kOnan != null && kOnan > 0) { c.equipo.potencia_onan_mva = limpio(kOnan / 1000); origen(c, 'equipo.potencia_onan_mva', 'accion', c.equipo.potencia_onan_mva); }
  if (kOnaf != null && kOnaf > 0) { c.equipo.potencia_onaf_mva = limpio(kOnaf / 1000); origen(c, 'equipo.potencia_onaf_mva', 'accion', c.equipo.potencia_onaf_mva); }
  c.confirmaciones.potencia = false;
  c.ventiladores.accion_id = lleno(accion.id) ? String(accion.id) : null;
  c.ventiladores.accion_fecha = lleno(accion.fecha_accion) ? String(accion.fecha_accion) : null;
  return sincronizar(c);
}

/* ── edición ──────────────────────────────────────────────────────────────── */
/**
 * Cambia un campo y devuelve una COPIA. Rutas con puntos e índices: `equipo.fabricante`,
 * `tablas.material.2.cantidad`, `figuras.montaje.1.figuras.0.pie`, `textos.intro_p2`…
 * Efectos que cuida el dominio:
 *  · tocar ONAN u ONAF quita la confirmación de la potencia (decisión 8);
 *  · tocar los ventiladores regenera las filas automáticas (Tabla 2, Tabla 5 y pies sugeridos);
 *  · tocar el personal ajusta lo «por persona» de la Tabla 4;
 *  · escribir a mano un pie, una fila automática o un nombre de firma lo vuelve «a mano»
 *    (y el nombre escrito a mano suelta al firmante: una firma solo se estampa con SU nombre).
 */
export function cambiarCampo(contenido, ruta, valor) {
  const c = copia(contenido);
  const v = valor === undefined ? null : copia(valor);
  poner(c, ruta, v);
  const r = String(ruta);
  let m;
  if (r.startsWith('equipo.potencia_')) c.confirmaciones.potencia = false;
  if ((m = /^figuras\.([a-z_]+)\.(\d+)\.figuras\.(\d+)\.pie$/.exec(r))) {
    const f = obtener(c, 'figuras.' + m[1] + '.' + m[2] + '.figuras.' + m[3]);
    if (f) delete f.pie_plantilla;
  }
  if ((m = /^tablas\.material\.(\d+)\.(descripcion|unidad|cantidad)$/.exec(r))) {
    const fila = c.tablas.material[+m[1]];
    if (fila) {
      // La fila automática que se escribe a mano RECUERDA de qué ventilador salía: si luego se
      // cambia su descripción (p. ej. con el código completo del modelo), no se vuelve a generar
      // la automática al lado (fila repetida en la Tabla 2).
      const antes = obtener(contenido, 'tablas.material.' + m[1]);
      if (antes && antes.auto && !fila.reemplaza) fila.reemplaza = txt(antes.descripcion);
      fila.auto = false;
    }
  }
  if ((m = /^tablas\.sst\.(\d+)\.cantidad$/.exec(r))) {
    const fila = c.tablas.sst[+m[1]]; if (fila) delete fila.por_persona;
  }
  if ((m = /^corrientes\.filas\.(\d+)\.ventilador$/.exec(r))) {
    const fila = c.corrientes.filas[+m[1]]; if (fila) fila.auto = false;
  }
  if (r === 'corrientes.nominal.etiqueta' && c.corrientes.nominal) c.corrientes.nominal.auto = false;
  if ((m = /^firmas\.([a-z]+)\.nombre$/.exec(r)) && c.firmas[m[1]]) c.firmas[m[1]].firmante = null;
  if (r === 'salud.numero') {
    // La condición escrita a mano trae su nombre de la escala (1 Muy bueno … 5 Muy pobre); ya no es la del archivo.
    const n = num(v);
    const valida = Number.isInteger(n) && n >= 1 && n <= 5;
    c.salud = { ...(c.salud || {}), numero: valida ? n : (v == null || v === '' ? null : v), texto: valida ? NOMBRE_CONDICION[n].toLocaleLowerCase('es-CO') : '', fuente: '' };
  }
  return sincronizar(c);
}

/** Origen y estado de un campo: { fuente, original, cambiado, vacio }. */
export function estadoCampo(contenido, ruta) {
  const valor = obtener(contenido, ruta);
  const vacio = valor == null || (typeof valor === 'string' && valor.trim() === '') || (Array.isArray(valor) && valor.length === 0);
  const o = ((contenido && contenido.origenes) || []).find((x) => x.ruta === ruta);
  if (o) {
    const cambiado = jsonCanonico(valor ?? null) !== jsonCanonico(o.original ?? null);
    return { fuente: o.fuente, original: o.original ?? null, cambiado, vacio };
  }
  let m;
  if ((m = /^textos\.([a-z0-9_]+)$/.exec(ruta)) && TEXTOS[m[1]] != null) {
    return { fuente: valor == null ? 'plantilla' : 'manual', original: textoPlantilla(m[1], contenido), cambiado: valor != null, vacio: valor != null && vacio };
  }
  if ((m = /^(conclusiones|recomendaciones)\.(\d+)\.texto$/.exec(ruta))) {
    const it = ((contenido && contenido[m[1]]) || [])[+m[2]];
    const pl = it && it.plantilla;
    return { fuente: valor == null && pl ? 'plantilla' : 'manual', original: pl ? textoPlantilla(pl, contenido) : null, cambiado: valor != null && !!pl, vacio: valor != null && vacio };
  }
  if ((m = /^figuras\.([a-z_]+)\.(\d+)\.figuras\.(\d+)\.pie$/.exec(ruta))) {
    const f = obtener(contenido, 'figuras.' + m[1] + '.' + m[2] + '.figuras.' + m[3]);
    if (f && f.pie_plantilla) return { fuente: 'plantilla', original: valor ?? null, cambiado: false, vacio };
  }
  return { fuente: vacio ? '' : 'manual', original: null, cambiado: false, vacio };
}

export function confirmarPotencia(contenido, si = true) {
  const c = copia(contenido);
  c.confirmaciones = c.confirmaciones || {};
  c.confirmaciones.potencia = !!si;
  return c;
}

/** Pone en una línea de firma a un firmante de la configuración (nombre en MAYÚSCULAS), o la limpia con null. */
export function asignarFirmante(contenido, rol, firmante) {
  if (!ROLES_FIRMA.includes(rol)) throw new Error('Rol de firma desconocido: «' + rol + '».');
  const c = copia(contenido);
  c.firmas = c.firmas || {};
  c.firmas[rol] = firmante && lleno(firmante.nombre)
    ? { nombre: mayusculasEs(String(firmante.nombre).trim()), firmante: lleno(firmante.clave) ? String(firmante.clave) : null }
    : { nombre: '', firmante: null };
  return c;
}

/** Regenera lo automático: filas de ventiladores de la Tabla 2, filas V1…Vn de la Tabla 5, pies sugeridos y Tabla 4 por persona. */
export function regenerarFilasAuto(contenido) {
  return sincronizar(copia(contenido));
}

/** Registra un archivo subido (foto o anexo) en el informe. */
export function registrarArchivo(contenido, archivoId, meta) {
  const id = String(archivoId == null ? '' : archivoId);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Identificador de archivo no válido.');
  const m = meta || {};
  const c = copia(contenido);
  c.archivos = c.archivos || {};
  c.archivos[id] = {
    almacen: txt(m.almacen) || 'storage', ruta: txt(m.ruta), mime: txt(m.mime) || 'image/jpeg',
    ancho: num(m.ancho) || 0, alto: num(m.alto) || 0, tamano: num(m.tamano) || 0, huella: txt(m.huella),
    subidoPor: { uid: txt(m.subidoPor && m.subidoPor.uid), nombre: txt(m.subidoPor && m.subidoPor.nombre) },
    en: txt(m.en)
  };
  return c;
}

/** Pone (o quita, con null) la foto de un hueco: { seccion, g: cuadrícula, f: figura, k: foto }. Cambiar la foto borra sus óvalos. */
export function ponerFoto(contenido, { seccion, g, f, k } = {}, archivoId) {
  const c = copia(contenido);
  const fotos = obtener(c, 'figuras.' + seccion + '.' + g + '.figuras.' + f + '.fotos');
  if (!Array.isArray(fotos) || k == null || k < 0 || k >= fotos.length) throw new Error('Hueco de foto no válido.');
  fotos[k] = { archivo: archivoId == null ? null : String(archivoId), marcas: [] };
  return c;
}

/** Agrega al final de una sección una cuadrícula vacía ('2x1', '1x1', '3f' o '2x2f'). */
export function agregarCuadricula(contenido, seccion, disposicion) {
  if (!SECCIONES_FIGURAS.includes(seccion)) throw new Error('Sección de fotos desconocida: «' + seccion + '».');
  const c = copia(contenido);
  c.figuras[seccion] = c.figuras[seccion] || [];
  c.figuras[seccion].push(cuadriculaNueva(c, disposicion));
  return c;
}
/** Quita una cuadrícula (sus fotos siguen registradas en `archivos`). */
export function quitarCuadricula(contenido, seccion, g) {
  const c = copia(contenido);
  const lista = (c.figuras && c.figuras[seccion]) || [];
  if (g < 0 || g >= lista.length) throw new Error('Cuadrícula no válida.');
  lista.splice(g, 1);
  return c;
}
/** Mueve una cuadrícula dentro de su sección (delta −1 sube, +1 baja). */
export function moverCuadricula(contenido, seccion, g, delta) {
  const c = copia(contenido);
  const lista = (c.figuras && c.figuras[seccion]) || [];
  const d = g + delta;
  if (g < 0 || g >= lista.length || d < 0 || d >= lista.length) return c;
  const [x] = lista.splice(g, 1);
  lista.splice(d, 0, x);
  return c;
}
/** Agrega un anexo de ficha técnica más (mezcla de modelos), antes del de cálculo. */
export function agregarAnexoFicha(contenido) {
  const c = copia(contenido);
  let n = 1;
  while (c.anexos.some((a) => a.clave === 'ficha_' + n)) n += 1;
  const nuevo = { clave: 'ficha_' + n, tipo: 'ficha', titulo: null, titulo_portada: null, archivo: null, ficha: null };
  const iCalc = c.anexos.findIndex((a) => a.tipo === 'calculo');
  if (iCalc >= 0) c.anexos.splice(iCalc, 0, nuevo); else c.anexos.push(nuevo);
  return c;
}

/** Texto de la plantilla con las variables de este informe (para «ver el original»). */
export function textoPlantilla(id, contenido) {
  const vars = variablesDelInforme(contenido);
  if (TEXTOS[id] != null) return rellenar(TEXTOS[id], vars);
  const it = CONCLUSIONES.concat(RECOMENDACIONES).find((x) => x.id === id);
  return it ? rellenar(it.texto, vars) : '';
}

/* ── lo que falta para emitir ─────────────────────────────────────────────── */
const SECCION_TEXTO = {
  intro_p1: 's1', intro_p2: 's1', intro_p3: 's1', obj_general: 's2_1', obj_esp_1: 's2_1', obj_esp_2: 's2_1', obj_esp_3: 's2_1',
  personal: 's2_2', alcance: 's2_3', ingreso: 's4_1', cond_iniciales: 's4_2', montaje: 's4_3', pruebas_1: 's4_4', pruebas_2: 's4_4'
};
const NOMBRE_TEXTO = {
  intro_p1: 'Introducción, párrafo 1', intro_p2: 'Introducción, párrafo 2', intro_p3: 'Introducción, párrafo 3',
  obj_general: 'Objetivo general', obj_esp_1: 'Objetivo específico 1', obj_esp_2: 'Objetivo específico 2', obj_esp_3: 'Objetivo específico 3',
  personal: 'Párrafo de personal', alcance: 'Párrafo de alcance', ingreso: 'Párrafo de ingreso a la subestación',
  cond_iniciales: 'Párrafo de condiciones iniciales', montaje: 'Párrafo de montaje', pruebas_1: 'Párrafo de pruebas de consumo',
  pruebas_2: 'Párrafo de prueba de sentido de giro'
};
/** Sección del formulario donde se arregla cada grupo de fotos. */
export const SECCION_FIGURAS = Object.freeze({
  alcance: 's2_3', ingreso: 's4_1', condiciones_iniciales: 's4_2', montaje: 's4_3', pruebas_consumo: 's4_4', pruebas_giro: 's4_4', estado_final: 's4_final'
});
const NOMBRE_TABLA = { material: 'Tabla 2 (material)', herramientas: 'Tabla 3 (herramientas)', sst: 'Tabla 4 (SST)' };

/**
 * Lo que falta (o está mal) para emitir: [{ seccion, ruta, etiqueta, bloquea }].
 * `bloquea: true` impide emitir; `bloquea: false` es un aviso. Las secciones son las del
 * formulario: portada, s1, s2_1, s2_2, s2_3, s3, s4_1, s4_2, s4_3, s4_4, s4_final, s5, anexos, firmas.
 * `archivoDisponible(meta)` (opcional): dice si los bytes de una imagen siguen al alcance. En el modo
 * local las fotos viven en la memoria de la pestaña: tras recargar, una foto registrada ya no existe y
 * NO se puede emitir con su recuadro «Foto pendiente».
 */
export function faltantes(contenido, { config = null, archivoDisponible = null } = {}) {
  const c = contenido || {};
  const out = [];
  const perdido = (meta) => !!(meta && typeof archivoDisponible === 'function' && !archivoDisponible(meta));
  const PERDIDO = ': la imagen se perdió al recargar (modo local): vuelva a cargarla';
  const falta = (seccion, ruta, etiqueta) => out.push({ seccion, ruta, etiqueta, bloquea: true });
  const aviso = (seccion, ruta, etiqueta) => out.push({ seccion, ruta, etiqueta, bloquea: false });
  const e = c.equipo || {};
  const positivo = (v) => num(v) != null && num(v) > 0;

  // Portada
  if (!lleno(c.portada && c.portada.contrato)) falta('portada', 'portada.contrato', 'Número de contrato');
  MARCA_CLAVES.forEach((k) => {
    if (!(config && config.marca && config.marca[k])) falta('portada', 'config.marca.' + k, 'Falta el ' + MARCA_GEOMETRIA[k].nombre + ' (lo sube un administrador)');
    else if (perdido(config.marca[k])) falta('portada', 'config.marca.' + k, MARCA_GEOMETRIA[k].nombre + PERDIDO);
  });

  // 1. Introducción
  const sn = num(c.salud && c.salud.numero);
  if (sn == null || !Number.isInteger(sn) || sn < 1 || sn > 5) {
    falta('s1', 'salud.numero', 'Estado de salud (condición 1 a 5)');
    const o = (c.origenes || []).find((x) => x.ruta === 'salud.numero' && x.fuente === 'salud');
    if (o && o.original == null) aviso('s1', 'salud.numero', 'Salud de Activos no trae calificación para este equipo: escríbala a mano');
  } else if (!lleno(c.salud.texto)) falta('s1', 'salud.texto', 'Nombre de la condición de salud');
  if (!lleno(c.hallazgo && c.hallazgo.texto)) falta('s1', 'hallazgo.texto', 'Hallazgo que motiva la intervención');
  if (!lleno(c.hallazgo && c.hallazgo.causa)) falta('s1', 'hallazgo.causa', 'Causa del hallazgo');

  // 2.2 Personal y fechas
  const tr = c.trabajo || {};
  const ini = fechaDMA(tr.fecha_inicio); const fin = fechaDMA(tr.fecha_fin);
  if (!ini) falta('s2_2', 'trabajo.fecha_inicio', 'Fecha de inicio de los trabajos');
  if (!fin) falta('s2_2', 'trabajo.fecha_fin', 'Fecha de fin de los trabajos');
  if (ini && fin && String(tr.fecha_fin) < String(tr.fecha_inicio)) falta('s2_2', 'trabajo.fecha_fin', 'La fecha de fin es anterior a la de inicio');
  const pe = c.personal || {};
  if (!lleno(pe.ingeniero)) falta('s2_2', 'personal.ingeniero', 'Ingeniero a cargo');
  const tec = Array.isArray(pe.tecnicos) ? pe.tecnicos : [];
  if (!tec.some(lleno)) falta('s2_2', 'personal.tecnicos', 'Al menos un técnico');
  tec.forEach((t, i) => { if (!lleno(t)) falta('s2_2', 'personal.tecnicos.' + i, 'Técnico ' + (i + 1) + ' sin nombre'); });

  // 3. Información característica (Tabla 1) y Tablas 2–4
  const req = [
    ['matricula', 'Matrícula'], ['subestacion', 'Subestación'], ['zona', 'Zona'], ['departamento', 'Departamento'],
    ['fabricante', 'Fabricante (marca)'], ['serie', 'Serie'], ['grupo_conexion', 'Grupo de conexión']
  ];
  req.forEach(([k, et]) => { if (!lleno(e[k])) falta('s3', 'equipo.' + k, et); });
  if (!positivo(e.anio_fabricacion)) falta('s3', 'equipo.anio_fabricacion', 'Año de fabricación');
  if (!positivo(e.potencia_onan_mva)) falta('s3', 'equipo.potencia_onan_mva', 'Potencia ONAN (MVA)');
  if (!positivo(e.potencia_onaf_mva)) falta('s3', 'equipo.potencia_onaf_mva', 'Potencia ONAF (MVA)');
  if (positivo(e.potencia_onan_mva) && positivo(e.potencia_onaf_mva) && num(e.potencia_onan_mva) > num(e.potencia_onaf_mva)) {
    falta('s3', 'equipo.potencia_onan_mva', 'La potencia ONAN no puede ser mayor que la ONAF');
  }
  if (!(c.confirmaciones && c.confirmaciones.potencia === true)) falta('s3', 'confirmaciones.potencia', 'Confirme ONAN y ONAF de este equipo');
  if (!positivo(e.tension_primaria_v)) falta('s3', 'equipo.tension_primaria_v', 'Tensión primaria (V)');
  if (!positivo(e.tension_secundaria_v)) falta('s3', 'equipo.tension_secundaria_v', 'Tensión secundaria (V)');
  if (!positivo(e.frecuencia_hz)) falta('s3', 'equipo.frecuencia_hz', 'Frecuencia (Hz)');
  if (lleno(e.departamento) && !departamentoConocido(e.departamento)) aviso('s3', 'equipo.departamento', 'El departamento no está en la lista de departamentos cubiertos');
  ['material', 'herramientas', 'sst'].forEach((t) => {
    const filas = (c.tablas && Array.isArray(c.tablas[t])) ? c.tablas[t] : [];
    if (!filas.length) falta('s3', 'tablas.' + t, NOMBRE_TABLA[t] + ': sin filas');
    filas.forEach((f, i) => {
      if (!lleno(f && f.descripcion)) falta('s3', 'tablas.' + t + '.' + i + '.descripcion', NOMBRE_TABLA[t] + ', fila ' + (i + 1) + ': descripción');
      if (!lleno(f && f.unidad)) falta('s3', 'tablas.' + t + '.' + i + '.unidad', NOMBRE_TABLA[t] + ', fila ' + (i + 1) + ': unidad');
      if (!positivo(f && f.cantidad)) falta('s3', 'tablas.' + t + '.' + i + '.cantidad', NOMBRE_TABLA[t] + ', fila ' + (i + 1) + ': cantidad');
    });
  });

  // 4.1 Consignación y ODT
  const co = c.consignacion || {};
  if (!lleno(co.numero)) falta('s4_1', 'consignacion.numero', 'Número de la consignación');
  if (!lleno(co.tipo)) falta('s4_1', 'consignacion.tipo', 'Tipo de consignación');
  const odt = Array.isArray(c.odt) ? c.odt : [];
  if (!odt.some(lleno)) falta('s4_1', 'odt', 'Al menos una Orden de Trabajo (ODT)');
  odt.forEach((x, i) => { if (!lleno(x)) falta('s4_1', 'odt.' + i, 'ODT ' + (i + 1) + ' vacía'); });

  // 4.3 Ventiladores
  const ve = c.ventiladores || {};
  [['actual', 'Ventilador actual'], ['nuevo', 'Ventilador nuevo']].forEach(([k, et]) => {
    const filas = Array.isArray(ve[k]) ? ve[k] : [];
    if (!filas.length) falta('s4_3', 'ventiladores.' + k, et + ': falta al menos uno');
    filas.forEach((f, i) => {
      const pre = filas.length > 1 ? et + ' ' + (i + 1) : et;
      if (!lleno(f && f.modelo)) falta('s4_3', 'ventiladores.' + k + '.' + i + '.modelo', pre + ': tipo o modelo');
      const n = num(f && f.cantidad);
      if (n == null || n <= 0 || !Number.isInteger(n)) falta('s4_3', 'ventiladores.' + k + '.' + i + '.cantidad', pre + ': cantidad');
      if (!positivo(f && f.cfm_unitario)) falta('s4_3', 'ventiladores.' + k + '.' + i + '.cfm_unitario', pre + ': CFM por unidad');
    });
  });
  if (!lleno(ve.conexion)) falta('s4_3', 'ventiladores.conexion', 'Conexión de los ventiladores (delta o estrella)');

  // 4.4 Corrientes (Tabla 5)
  const co5 = c.corrientes || {};
  const filas5 = Array.isArray(co5.filas) ? co5.filas : [];
  if (!filas5.length) falta('s4_4', 'corrientes.filas', 'Tabla 5: sin ventiladores medidos');
  const medida = (v) => num(v) != null && num(v) >= 0;
  filas5.forEach((f, i) => {
    if (!lleno(f && f.ventilador)) falta('s4_4', 'corrientes.filas.' + i + '.ventilador', 'Tabla 5, fila ' + (i + 1) + ': ventilador');
    ['r', 's', 't'].forEach((fa) => {
      if (!medida(f && f[fa])) falta('s4_4', 'corrientes.filas.' + i + '.' + fa, 'Tabla 5, ' + (txt(f && f.ventilador) || 'fila ' + (i + 1)) + ': corriente fase ' + fa.toUpperCase());
    });
  });
  const no = co5.nominal || {};
  ['r', 's', 't'].forEach((fa) => { if (!medida(no[fa])) falta('s4_4', 'corrientes.nominal.' + fa, 'Tabla 5, nominal: corriente fase ' + fa.toUpperCase()); });
  filas5.forEach((f, i) => ['r', 's', 't'].forEach((fa) => {
    if (medida(f && f[fa]) && medida(no[fa]) && num(f[fa]) > num(no[fa])) {
      aviso('s4_4', 'corrientes.filas.' + i + '.' + fa, 'Tabla 5, ' + (txt(f.ventilador) || 'fila ' + (i + 1)) + ': la corriente de la fase ' + fa.toUpperCase() + ' (' + numES(num(f[fa])) + ' A) supera la nominal (' + numES(num(no[fa])) + ' A)');
    }
  }));

  // Fotos (numeradas como en el papel)
  const archivos = c.archivos || {};
  let nfig = 0;
  SECCIONES_FIGURAS.forEach((s) => {
    const sec = SECCION_FIGURAS[s];
    ((c.figuras && c.figuras[s]) || []).forEach((g, gi) => {
      const d = DISPOSICIONES[g && g.disposicion];
      const base = 'figuras.' + s + '.' + gi;
      if (!d) { falta(sec, base + '.disposicion', 'Cuadrícula de fotos con una disposición desconocida'); return; }
      const figs = Array.isArray(g.figuras) ? g.figuras : [];
      if (figs.length !== d.figuras) falta(sec, base + '.figuras', 'Cuadrícula de fotos incompleta');
      const numeros = d.unaFigura ? [++nfig] : figs.map(() => ++nfig);
      figs.forEach((f, fi) => {
        const nro = d.unaFigura ? numeros[0] : numeros[fi];
        if (!lleno(f && f.pie)) falta(sec, base + '.figuras.' + fi + '.pie', 'Figura ' + nro + ': falta el pie');
        const fotos = Array.isArray(f && f.fotos) ? f.fotos : [];
        if (fotos.length !== d.fotosPorFigura) falta(sec, base + '.figuras.' + fi + '.fotos', 'Figura ' + nro + ': número de fotos distinto al de la cuadrícula');
        fotos.forEach((ft, k) => {
          const ruta = base + '.figuras.' + fi + '.fotos.' + k + '.archivo';
          const quien = d.fotosPorFigura > 1 ? 'Figura ' + nro + ', foto ' + (k + 1) : 'Figura ' + nro;
          if (!lleno(ft && ft.archivo)) falta(sec, ruta, quien + ': falta la foto');
          else if (!archivos[ft.archivo]) falta(sec, ruta, quien + ': la foto no está registrada en el informe');
          else if (perdido(archivos[ft.archivo])) falta(sec, ruta, quien + PERDIDO);
        });
      });
    });
  });

  // 5. Conclusiones y recomendaciones
  [['conclusiones', 'Conclusión'], ['recomendaciones', 'Recomendación']].forEach(([k, et]) => {
    const lista = Array.isArray(c[k]) ? c[k] : [];
    if (!lista.length) falta('s5', k, 'Al menos una ' + et.toLowerCase());
    lista.forEach((it, i) => {
      if (!it || (it.texto == null && !it.plantilla)) falta('s5', k + '.' + i + '.texto', et + ' ' + (i + 1) + ' vacía');
      else if (it.texto != null && !lleno(it.texto)) falta('s5', k + '.' + i + '.texto', et + ' ' + (i + 1) + ' vacía');
      else if (it.texto != null) aviso('s5', k + '.' + i + '.texto', et + ' ' + (i + 1) + (it.plantilla ? ' cambiada a mano' : ' escrita a mano'));
    });
  });

  // Textos de plantilla cambiados a mano (aviso) o vaciados (bloquea)
  IDS_TEXTOS.forEach((id) => {
    const v = c.textos && c.textos[id];
    if (v == null) return;
    if (!lleno(v)) falta(SECCION_TEXTO[id], 'textos.' + id, NOMBRE_TEXTO[id] + ': quedó vacío');
    else aviso(SECCION_TEXTO[id], 'textos.' + id, NOMBRE_TEXTO[id] + ': escrito a mano (no sigue la plantilla)');
  });

  // Anexos
  (Array.isArray(c.anexos) ? c.anexos : []).forEach((a, i) => {
    if (!a || a.tipo === 'calculo') return;
    const ruta = 'anexos.' + i;
    const nombre = a.clave === 'consignacion' ? 'Imagen de la consignación'
      : a.clave === 'ficha_actual' ? 'Ficha técnica del ventilador actual'
        : a.clave === 'ficha_nuevo' ? 'Ficha técnica del ventilador nuevo' : 'Ficha técnica (anexo ' + (i + 1) + ')';
    if (a.tipo === 'ficha') {
      if (!a.ficha && !lleno(a.archivo)) falta('anexos', ruta + '.ficha', nombre);
      else if (!a.ficha && !archivos[a.archivo]) falta('anexos', ruta + '.archivo', nombre + ': el archivo no está registrado');
      else if (a.ficha && perdido(a.ficha)) falta('anexos', ruta + '.ficha', nombre + PERDIDO);
      else if (!a.ficha && perdido(archivos[a.archivo])) falta('anexos', ruta + '.archivo', nombre + PERDIDO);
    } else if (!lleno(a.archivo)) falta('anexos', ruta + '.archivo', nombre);
    else if (!archivos[a.archivo]) falta('anexos', ruta + '.archivo', nombre + ': el archivo no está registrado');
    else if (perdido(archivos[a.archivo])) falta('anexos', ruta + '.archivo', nombre + PERDIDO);
  });

  // Firmas
  [['elaborado', 'Elaborado por'], ['revisado', 'Revisado por'], ['aprobado', 'Aprobado por']].forEach(([r, et]) => {
    if (!lleno(c.firmas && c.firmas[r] && c.firmas[r].nombre)) falta('firmas', 'firmas.' + r + '.nombre', et + ': nombre');
  });
  return out;
}

/** Solo lo que impide emitir. */
export function faltantesQueBloquean(contenido, opciones) {
  return faltantes(contenido, opciones).filter((f) => f.bloquea);
}

/* ── recuperar un respaldo sin pisar a otra persona ───────────────────────── */
const igualJson = (a, b) => jsonCanonico(a === undefined ? null : a) === jsonCanonico(b === undefined ? null : b);
const esObjeto = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** Rutas (con puntos) donde `mio` cambió frente a `base`. Objetos: por clave; listas del mismo largo: por posición;
 *  una lista que creció o se achicó cuenta como UN cambio entero (filas agregadas o quitadas). */
function rutasCambiadas(base, mio, prefijo = '', out = []) {
  if (igualJson(base, mio)) return out;
  if (esObjeto(base) && esObjeto(mio)) {
    const claves = new Set([...Object.keys(base), ...Object.keys(mio)]);
    for (const k of claves) {
      if (PROHIBIDAS.has(k) || k.includes('.')) continue;
      rutasCambiadas(base[k], mio[k], prefijo ? prefijo + '.' + k : k, out);
    }
    return out;
  }
  if (Array.isArray(base) && Array.isArray(mio) && base.length === mio.length && prefijo) {
    for (let i = 0; i < base.length; i++) rutasCambiadas(base[i], mio[i], prefijo + '.' + i, out);
    return out;
  }
  if (prefijo) out.push(prefijo);
  return out;
}
function leerRuta(obj, ruta) { try { return obtener(obj, ruta); } catch (_) { return undefined; } }
function ponerRuta(obj, ruta, valor) {
  const p = pasos(ruta);
  let v = obj;
  for (let i = 0; i < p.length - 1; i++) {
    if (v[p[i]] == null || typeof v[p[i]] !== 'object') return false;   // la otra persona quitó ese bloque: no se rehace a ciegas
    v = v[p[i]];
  }
  if (valor === undefined) { if (Array.isArray(v)) return false; delete v[p[p.length - 1]]; } else v[p[p.length - 1]] = copia(valor);
  return true;
}

/**
 * Fusión de tres vías para «Recuperar mis cambios» después de un choque:
 *  · `base`   = el informe del que partió esta pantalla (lo último que leyó o guardó en la plataforma);
 *  · `mio`    = lo que tenía esta pantalla (el respaldo);
 *  · `actual` = lo que hay hoy en la plataforma (con los cambios de la otra persona).
 * Se aplican sobre `actual` SOLO las rutas que esta pantalla cambió frente a `base`. Si la otra persona
 * cambió esa MISMA ruta a otra cosa, es un choque: con `ganaMio` se usa lo de esta pantalla; sin él, se
 * deja lo de la otra persona. Lo que la otra persona cambió y esta pantalla no tocó, se respeta siempre.
 * @returns {{ contenido: object, aplicadas: string[], choques: string[], omitidas: string[] }}
 */
export function fusionarRespaldo(base, mio, actual, { ganaMio = false } = {}) {
  const out = copia(actual) || {};
  const aplicadas = []; const choques = []; const omitidas = [];
  if (!esObjeto(base)) {
    // Respaldo viejo sin su base: no se sabe qué cambió esta pantalla; todo lo distinto cuenta como choque.
    const todas = rutasCambiadas(actual, mio);
    if (!ganaMio) return { contenido: sincronizar(out), aplicadas, choques: todas, omitidas };
    return { contenido: sincronizar(copia(mio)), aplicadas: todas, choques: todas, omitidas };
  }
  for (const r of rutasCambiadas(base, mio)) {
    const vb = leerRuta(base, r); const vm = leerRuta(mio, r); const va = leerRuta(out, r);
    if (igualJson(va, vm)) continue;                                   // ya está igual
    const choque = !igualJson(va, vb);                                 // la otra persona también lo cambió
    if (choque) choques.push(r);
    if (choque && !ganaMio) continue;
    if (ponerRuta(out, r, vm)) aplicadas.push(r); else omitidas.push(r);
  }
  return { contenido: sincronizar(out), aplicadas, choques, omitidas };
}
