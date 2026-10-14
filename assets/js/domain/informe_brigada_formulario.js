// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · FORMULARIO por secciones (dominio puro)
// ──────────────────────────────────────────────────────────────
// Qué se pide en cada sección del papel F60-ADM y dónde vive cada dato dentro
// del `contenido` del informe (esquema `ibr@1`, lo define el dominio del
// informe). La pantalla (`ui/informe-brigada/editor.js`) dibuja estas
// secciones; aquí NO hay DOM ni Firebase: se prueba con `node --test`
// (tests/informe_brigada_formulario.test.js).
//
// Los ids de sección son los mismos que usa `faltantes()` del dominio del
// informe, para que cada faltante lleve a su sección.
// ══════════════════════════════════════════════════════════════

import * as P from './informe_brigada_plantilla.js';

/** De dónde llegó un dato, dicho para el usuario (sin jerga). */
export const ETIQUETA_FUENTE = Object.freeze({
  inventario: 'Inventario',
  salud: 'Salud de Activos',
  accion: 'Acción de refrigeración',
  configuracion: 'Configuración',
  plantilla: 'Plantilla',
  fijo: 'Fijo',
  manual: 'Escrito a mano'
});

// Opciones, orden de figuras y disposiciones: una sola fuente, la plantilla F60 (dominio del informe).
/** Unidades sugeridas en las Tablas 2 a 4 (se puede escribir otra). */
export const UNIDADES = P.UNIDADES;
/** Tipos de consignación sugeridos (se puede escribir otro). */
export const TIPOS_CONSIGNACION = P.TIPOS_CONSIGNACION;
/** Conexión de los ventiladores nuevos. */
export const CONEXIONES = P.CONEXIONES;
/** Orden de las secciones de figuras en el papel (la numeración las recorre así). */
export const ORDEN_FIGURAS = P.SECCIONES_FIGURAS;
/** Forma de cada disposición de fotos: cuántas figuras y cuántas fotos por figura (plan §4.6). */
export const FORMA_DISPOSICION = Object.freeze(Object.fromEntries(Object.entries(P.DISPOSICIONES).map(([k, d]) => [
  k, Object.freeze({ figuras: d.figuras, fotosPorFigura: d.fotosPorFigura, nombre: d.nombre || k })
])));

const T = (ruta, etiqueta, tipo, extra = {}) => Object.freeze({ ruta, etiqueta, tipo, ...extra });
const TXT = (id, etiqueta) => T('textos.' + id, etiqueta, 'texto_plantilla', { plantilla: id });
const FIG = (clave, etiqueta) => T('figuras.' + clave, etiqueta, 'figuras', { clave });

const COLS_LISTA = Object.freeze([
  Object.freeze({ clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', ancho: 'ancho' }),
  Object.freeze({ clave: 'unidad', etiqueta: 'Unidad', tipo: 'texto', sugerencias: 'unidades' }),
  Object.freeze({ clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero' })
]);

/**
 * Secciones del editor, en el orden del papel.
 * tipo de campo: 'texto' | 'numero' | 'fecha' | 'lista' | 'lista_textos' | 'tabla' | 'figuras'
 *              | 'texto_plantilla' | 'firmante' | 'casilla' | 'salud' | 'vinetas' | 'anexos'
 * (los cuatro últimos amplían el plan §3.9: los pide el contenido —confirmación de potencia,
 *  estado de salud con su texto, conclusiones/recomendaciones y anexos—).
 */
export const SECCIONES = Object.freeze([
  Object.freeze({
    id: 'portada', titulo: 'Portada',
    ayuda: 'Contrato y asunto de la portada. Los logos de Applus, Together y AFINIA los sube un administrador una sola vez.',
    campos: Object.freeze([
      T('portada.contrato', 'Contrato', 'texto', { max: 20, ayuda: 'Lo deja un administrador en la configuración; se puede cambiar en este informe.' }),
      T('portada.asunto', 'Asunto', 'texto')
    ])
  }),
  Object.freeze({
    id: 's1', titulo: '1. Introducción',
    ayuda: 'El primer y el tercer párrafo son fijos de la plantilla; el segundo usa el hallazgo, la subestación, la potencia ONAF y el estado de salud.',
    campos: Object.freeze([
      T('salud.numero', 'Estado de salud', 'salud', { ayuda: 'Sale de Salud de Activos; en la portada va como «2 (BUENO)».' }),
      T('hallazgo.texto', 'Lo que se identificó', 'texto', { ayuda: '«… se identificó [esto] en el transformador …»' }),
      T('hallazgo.causa', 'Por qué', 'texto', { ayuda: '«… de N MVA [por esto]. Estos hallazgos …»' }),
      TXT('intro_p1', 'Párrafo 1'), TXT('intro_p2', 'Párrafo 2'), TXT('intro_p3', 'Párrafo 3')
    ])
  }),
  Object.freeze({
    id: 's2_1', titulo: '2.1 Objetivo',
    ayuda: 'Los objetivos usan la matrícula, la potencia ONAF, la subestación y cuántos ventiladores hay antes y después.',
    campos: Object.freeze([
      TXT('obj_general', 'Objetivo general'),
      TXT('obj_esp_1', 'Objetivo específico 1'), TXT('obj_esp_2', 'Objetivo específico 2'), TXT('obj_esp_3', 'Objetivo específico 3')
    ])
  }),
  Object.freeze({
    id: 's2_2', titulo: '2.2 Personal y fechas',
    campos: Object.freeze([
      T('personal.ingeniero', 'Ingeniero', 'texto'),
      T('personal.tecnicos', 'Técnicos', 'lista_textos', { agregar: 'Agregar técnico' }),
      T('trabajo.fecha_inicio', 'Fecha de inicio', 'fecha'),
      T('trabajo.fecha_fin', 'Fecha de fin', 'fecha', { ayuda: 'Sale en la portada como «FECHA DE EJECUCIÓN».' }),
      TXT('personal', 'Párrafo del personal')
    ])
  }),
  Object.freeze({
    id: 's2_3', titulo: '2.3 Alcance',
    campos: Object.freeze([TXT('alcance', 'Párrafo del alcance'), FIG('alcance', 'Figuras del alcance')])
  }),
  Object.freeze({
    id: 's3', titulo: '3. Información característica',
    ayuda: 'La Tabla 1 («Características del activo») y la portada salen de estos datos. Llegan del inventario y se pueden corregir.',
    campos: Object.freeze([
      T('equipo.matricula', 'Matrícula', 'texto'),
      T('equipo.subestacion', 'Subestación', 'texto'),
      T('equipo.zona', 'Zona', 'texto'),
      T('equipo.departamento', 'Departamento', 'texto', { sugerencias: 'departamentos', ayuda: 'Como sale en el papel: en mayúsculas y con tilde.' }),
      T('equipo.fabricante', 'Fabricante (marca)', 'texto', { ayuda: 'El inventario todavía no lo tiene: tómelo de la placa.' }),
      T('equipo.serie', 'Serie', 'texto'),
      T('equipo.anio_fabricacion', 'Año de fabricación', 'numero', { entero: true }),
      T('equipo.potencia_onan_mva', 'Potencia ONAN (MVA)', 'numero'),
      T('equipo.potencia_onaf_mva', 'Potencia ONAF (MVA)', 'numero'),
      T('confirmaciones.potencia', 'Confirmo ONAN y ONAF de este equipo', 'casilla', {
        ayuda: 'El inventario guarda una sola potencia y en los equipos ONAF es la ONAF. Si cambia una potencia, hay que volver a confirmar.'
      }),
      T('equipo.tension_primaria_v', 'Tensión primaria (V)', 'numero'),
      T('equipo.tension_secundaria_v', 'Tensión secundaria (V)', 'numero'),
      T('equipo.grupo_conexion', 'Grupo de conexión', 'texto', { ayuda: 'El inventario todavía no lo tiene: tómelo de la placa.' }),
      T('equipo.frecuencia_hz', 'Frecuencia (Hz)', 'numero'),
      T('tablas.material', 'Tabla 2 · Material utilizado', 'tabla', { columnas: COLS_LISTA, regenerar: true, nuevaFila: { descripcion: '', unidad: 'UND', cantidad: null, auto: false } }),
      T('tablas.herramientas', 'Tabla 3 · Herramientas y logística utilizada', 'tabla', { columnas: COLS_LISTA, nuevaFila: { descripcion: '', unidad: 'UND', cantidad: null } }),
      T('tablas.sst', 'Tabla 4 · Elementos SST', 'tabla', { columnas: COLS_LISTA, nuevaFila: { descripcion: '', unidad: 'UND', cantidad: null } })
    ])
  }),
  Object.freeze({
    id: 's4_1', titulo: '4.1 Ingreso a la subestación',
    campos: Object.freeze([
      T('consignacion.numero', 'Número de consignación', 'texto'),
      T('consignacion.tipo', 'Tipo de consignación', 'lista', { opciones: TIPOS_CONSIGNACION, libre: true }),
      T('odt', 'Órdenes de Trabajo (ODT)', 'lista_textos', { agregar: 'Agregar ODT' }),
      TXT('ingreso', 'Párrafo del ingreso'),
      FIG('ingreso', 'Figuras del ingreso')
    ])
  }),
  Object.freeze({
    id: 's4_2', titulo: '4.2 Condiciones iniciales',
    campos: Object.freeze([
      TXT('cond_iniciales', 'Párrafo de condiciones iniciales'),
      FIG('condiciones_iniciales', 'Figuras de condiciones iniciales')
    ])
  }),
  Object.freeze({
    id: 's4_3', titulo: '4.3 Montaje de ventiladores',
    ayuda: 'Las dos tablas de ventiladores llenan el texto del montaje, las Tablas 2 y 5 y el anexo «CÁLCULO DE VENTILADORES».',
    campos: Object.freeze([
      T('ventiladores.actual', 'Ventiladores actuales', 'tabla', {
        columnas: Object.freeze([
          Object.freeze({ clave: 'modelo', etiqueta: 'Tipo / modelo', tipo: 'texto', ancho: 'ancho' }),
          Object.freeze({ clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', entero: true }),
          Object.freeze({ clave: 'cfm_unitario', etiqueta: 'CFM por unidad', tipo: 'numero' })
        ]),
        minFilas: 1, totales: true, nuevaFila: { modelo: '', cantidad: null, cfm_unitario: null }
      }),
      T('ventiladores.nuevo', 'Ventiladores nuevos (proyectados)', 'tabla', {
        columnas: Object.freeze([
          Object.freeze({ clave: 'marca', etiqueta: 'Marca', tipo: 'texto' }),
          Object.freeze({ clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto', ancho: 'ancho' }),
          Object.freeze({ clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', entero: true }),
          Object.freeze({ clave: 'cfm_unitario', etiqueta: 'CFM por unidad', tipo: 'numero' })
        ]),
        minFilas: 1, totales: true, accion: true, nuevaFila: { marca: '', modelo: '', cantidad: null, cfm_unitario: null }
      }),
      T('ventiladores.conexion', 'Conexión de los ventiladores nuevos', 'lista', { opciones: CONEXIONES }),
      TXT('montaje', 'Párrafo del montaje'),
      FIG('montaje', 'Figuras del montaje')
    ])
  }),
  Object.freeze({
    id: 's4_4', titulo: '4.4 Prueba de funcionamiento y sentido de giro',
    campos: Object.freeze([
      TXT('pruebas_1', 'Párrafo de pruebas (consumo)'),
      T('corrientes.filas', 'Tabla 5 · Corriente por ventilador (A)', 'tabla', {
        columnas: Object.freeze([
          Object.freeze({ clave: 'ventilador', etiqueta: 'Ventilador', tipo: 'texto', ancho: 'ancho' }),
          Object.freeze({ clave: 'r', etiqueta: 'Fase R (A)', tipo: 'numero' }),
          Object.freeze({ clave: 's', etiqueta: 'Fase S (A)', tipo: 'numero' }),
          Object.freeze({ clave: 't', etiqueta: 'Fase T (A)', tipo: 'numero' })
        ]),
        regenerar: true, nuevaFila: { ventilador: '', r: null, s: null, t: null, auto: false }
      }),
      T('corrientes.nominal.etiqueta', 'Fila nominal · rótulo', 'texto'),
      T('corrientes.nominal.r', 'Nominal fase R (A)', 'numero'),
      T('corrientes.nominal.s', 'Nominal fase S (A)', 'numero'),
      T('corrientes.nominal.t', 'Nominal fase T (A)', 'numero'),
      FIG('pruebas_consumo', 'Figuras de consumo y tensión'),
      TXT('pruebas_2', 'Párrafo de pruebas (sentido de giro)'),
      FIG('pruebas_giro', 'Figuras del sentido de giro')
    ])
  }),
  Object.freeze({
    id: 's4_final', titulo: 'Estado final',
    campos: Object.freeze([FIG('estado_final', 'Figura del estado final')])
  }),
  Object.freeze({
    id: 's5', titulo: '5. Recomendaciones y conclusiones',
    campos: Object.freeze([
      T('conclusiones', 'Conclusiones', 'vinetas', { prefijo: 'c' }),
      T('recomendaciones', 'Recomendaciones', 'vinetas', { prefijo: 'r' })
    ])
  }),
  Object.freeze({
    id: 'anexos', titulo: 'Anexos',
    ayuda: 'Pantallazo de la consignación, fichas técnicas de los ventiladores (de la biblioteca) y el cálculo de ventiladores, que sale solo de las tablas de 4.3.',
    campos: Object.freeze([
      T('portada.subtitulo_anexos', 'Subtítulo de los anexos en la portada', 'texto'),
      T('anexos', 'Anexos', 'anexos')
    ])
  }),
  Object.freeze({
    id: 'firmas', titulo: 'Firmas',
    ayuda: 'Las firmas solo se estampan al EMITIR, y solo si el nombre de la línea es el del firmante. En borrador nunca.',
    campos: Object.freeze([
      T('firmas.elaborado', 'Elaborado por', 'firmante', { rol: 'elaborado' }),
      T('firmas.revisado', 'Revisado por', 'firmante', { rol: 'revisado' }),
      T('firmas.aprobado', 'Aprobado por', 'firmante', { rol: 'aprobado' })
    ])
  })
]);

export const IDS_SECCION = Object.freeze(SECCIONES.map((s) => s.id));

/** Dónde vive lo que no tiene un campo propio en SECCIONES (prefijos, el más largo gana). */
const RESPALDO = Object.freeze([
  ['portada', 'portada'], ['marca', 'portada'], ['config', 'portada'], ['logos', 'portada'],
  ['salud', 's1'], ['hallazgo', 's1'], ['textos.intro_', 's1'], ['textos.obj_', 's2_1'],
  ['personal', 's2_2'], ['trabajo', 's2_2'],
  ['equipo', 's3'], ['confirmaciones', 's3'], ['tablas', 's3'],
  ['consignacion', 's4_1'], ['odt', 's4_1'],
  ['ventiladores', 's4_3'],
  ['corrientes', 's4_4'],
  ['figuras.alcance', 's2_3'], ['figuras.ingreso', 's4_1'], ['figuras.condiciones_iniciales', 's4_2'],
  ['figuras.montaje', 's4_3'], ['figuras.pruebas_', 's4_4'], ['figuras.estado_final', 's4_final'],
  ['conclusiones', 's5'], ['recomendaciones', 's5'],
  ['anexos', 'anexos'], ['archivos', 'anexos'], ['fichas', 'anexos'],
  ['firmas', 'firmas'], ['firmantes', 'firmas']
]);

function empiezaPor(ruta, pref) {
  if (pref.endsWith('_') || pref.endsWith('.')) return ruta.startsWith(pref);
  return ruta === pref || ruta.startsWith(pref + '.');
}

/** Sección exacta de una ruta, o null si no se reconoce. */
export function buscarSeccion(ruta) {
  const r = String(ruta == null ? '' : ruta).trim();
  if (!r) return null;
  let mejor = null; let largo = -1;
  for (const s of SECCIONES) {
    for (const c of s.campos) {
      if (empiezaPor(r, c.ruta) && c.ruta.length > largo) { mejor = s.id; largo = c.ruta.length; }
    }
  }
  if (mejor) return mejor;
  for (const [pref, sec] of RESPALDO) {
    if (empiezaPor(r, pref) && pref.length > largo) { mejor = sec; largo = pref.length; }
  }
  return mejor;
}

/** Sección a la que lleva una ruta (siempre una sección válida; si no se reconoce, la portada). */
export function seccionDeRuta(ruta) {
  return buscarSeccion(ruta) || 'portada';
}

/** Sección de un faltante: manda dónde se DIBUJA el campo; si no se reconoce, la que trae el faltante. */
export function seccionDeFaltante(f) {
  if (!f) return 'portada';
  const s = buscarSeccion(f.ruta);
  if (s) return s;
  return IDS_SECCION.includes(f.seccion) ? f.seccion : 'portada';
}

/** Cuenta faltantes por sección: Map<id, { bloquea, avisos }>. */
export function contarFaltantesPorSeccion(lista) {
  const m = new Map(IDS_SECCION.map((id) => [id, { bloquea: 0, avisos: 0 }]));
  for (const f of (Array.isArray(lista) ? lista : [])) {
    const r = m.get(seccionDeFaltante(f));
    if (!r) continue;
    if (f.bloquea) r.bloquea += 1; else r.avisos += 1;
  }
  return m;
}

/** Lee un valor por ruta con puntos e índices ('tablas.material.2.cantidad'). undefined si no existe. */
export function valorEnRuta(obj, ruta) {
  let v = obj;
  for (const p of String(ruta || '').split('.').filter((x) => x !== '')) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[p];
  }
  return v;
}

/** ¿Existe la ruta (aunque valga null)? */
export function existeRuta(obj, ruta) {
  const partes = String(ruta || '').split('.').filter((x) => x !== '');
  let v = obj;
  for (const p of partes) {
    if (v == null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, p)) return false;
    v = v[p];
  }
  return partes.length > 0;
}

/**
 * Lee un número escrito por una persona: «2,03», «2.03», «34.500» (miles), «1.234,5».
 * Vacío → null (vacío no es cero, L-104). Algo que no es número → NaN.
 */
export function leerNumero(texto) {
  if (texto == null) return null;
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : NaN;
  let s = String(texto).trim().replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Cómo se muestra un número dentro de una casilla: con coma decimal y sin puntos de miles. */
export function numeroEnCasilla(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '';
  return String(Number(n)).replace('.', ',');
}

/** Suma de cantidades y de CFM de una tabla de ventiladores (vacíos no suman). */
export function totalesVentiladores(filas) {
  let cantidad = 0; let cfm = 0; let completas = true;
  for (const f of (Array.isArray(filas) ? filas : [])) {
    const n = f && f.cantidad != null && f.cantidad !== '' ? Number(f.cantidad) : null;
    const u = f && f.cfm_unitario != null && f.cfm_unitario !== '' ? Number(f.cfm_unitario) : null;
    if (n == null || u == null || !Number.isFinite(n) || !Number.isFinite(u)) { completas = false; if (Number.isFinite(n)) cantidad += n; continue; }
    cantidad += n; cfm += n * u;
  }
  return { cantidad, cfm, completas };
}

/* ── Figuras ─────────────────────────────────────────────────── */

/** Número de cada figura (id → número), 1..N en el orden del papel. Una figura cuenta una vez, tenga las fotos que tenga. */
export function numeracionFiguras(contenido) {
  const m = new Map();
  let n = 0;
  const figs = (contenido && contenido.figuras) || {};
  for (const clave of ORDEN_FIGURAS) {
    for (const g of (Array.isArray(figs[clave]) ? figs[clave] : [])) {
      for (const f of ((g && Array.isArray(g.figuras)) ? g.figuras : [])) { n += 1; if (f && f.id) m.set(f.id, n); }
    }
  }
  return m;
}

/** Todos los ids de cuadrícula y de figura que ya existen en el contenido. */
export function idsUsados(contenido) {
  const s = new Set();
  const figs = (contenido && contenido.figuras) || {};
  for (const clave of Object.keys(figs)) {
    for (const g of (Array.isArray(figs[clave]) ? figs[clave] : [])) {
      if (g && g.id) s.add(g.id);
      for (const f of ((g && Array.isArray(g.figuras)) ? g.figuras : [])) if (f && f.id) s.add(f.id);
    }
  }
  return s;
}

/** Siguiente id libre con ese prefijo: 'g' → 'g15' si el mayor es 'g14'. */
export function siguienteId(prefijo, usados) {
  let max = 0;
  const re = new RegExp('^' + prefijo + '(\\d+)$');
  for (const id of (usados || [])) {
    const m = re.exec(String(id));
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  return prefijo + (n < 10 ? '0' + n : String(n));
}

/**
 * Cambia la disposición de una cuadrícula conservando, en orden, las fotos y los pies que ya tenía.
 * @returns {{ cuadricula, sobrantes: Array<{archivo, marcas}> }}  `sobrantes` = fotos con archivo que ya no caben
 */
export function reestructurarCuadricula(cuadricula, disposicion, usados = new Set()) {
  const forma = FORMA_DISPOSICION[disposicion];
  if (!forma || !cuadricula) return { cuadricula, sobrantes: [] };
  const viejas = Array.isArray(cuadricula.figuras) ? cuadricula.figuras : [];
  for (const f of viejas) if (f && f.id) usados.add(f.id);
  if (cuadricula.id) usados.add(cuadricula.id);
  const fotos = [];
  for (const f of viejas) for (const ft of ((f && Array.isArray(f.fotos)) ? f.fotos : [])) if (ft && ft.archivo) fotos.push({ archivo: ft.archivo, marcas: Array.isArray(ft.marcas) ? ft.marcas.map((m) => ({ ...m })) : [] });
  const figuras = [];
  let k = 0;
  for (let i = 0; i < forma.figuras; i++) {
    const vieja = viejas[i];
    const fid = vieja && vieja.id ? vieja.id : siguienteId('fg', usados);
    usados.add(fid);
    const lista = [];
    for (let j = 0; j < forma.fotosPorFigura; j++) {
      lista.push(k < fotos.length ? fotos[k] : { archivo: null, marcas: [] });
      k += 1;
    }
    // La figura que sigue existiendo conserva lo suyo (pie y, si lo tiene, el pie sugerido de la plantilla).
    figuras.push({ ...(vieja || {}), id: fid, pie: vieja && typeof vieja.pie === 'string' ? vieja.pie : '', fotos: lista });
  }
  // El ajuste fino del modelo era para la disposición anterior: con otra disposición no aplica.
  const { ajuste, ...resto } = cuadricula;
  const nueva = { ...resto, disposicion, figuras };
  if (ajuste && cuadricula.disposicion === disposicion) nueva.ajuste = ajuste;
  return { cuadricula: nueva, sobrantes: fotos.slice(k) };
}

/* ── Utilidades de texto para la pantalla (puras) ───────────────────────── */

/** Escapa un texto para meterlo en HTML (contenido o atributo). Lo que escribe una persona NUNCA se interpreta. */
export function escaparHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Quita las marcas de la plantilla ([b]…[/b], [m]…[/m]) para mostrar o editar el texto plano. */
export function sinMarcas(t) {
  return String(t == null ? '' : t).replace(/\[\/?(?:b|m)\]/g, '');
}

/** «hace 5 s», «hace 3 min», «hace 2 h» o la fecha corta (dd/mm/aaaa hh:mm). */
export function haceCuanto(iso, ahora = Date.now()) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'hace ' + s + ' s';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return fechaHora(t);
}

/** dd/mm/aaaa hh:mm en hora local. '' si no hay fecha. */
export function fechaHora(iso) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** ¿Hay algún faltante que impida emitir? */
export function puedeEmitir(lista) {
  return !(Array.isArray(lista) ? lista : []).some((f) => f && f.bloquea);
}
