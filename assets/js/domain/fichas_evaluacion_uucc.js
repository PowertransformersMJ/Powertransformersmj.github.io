/**
 * Evaluación masiva de UUCC contra el catálogo de la Resolución CREG 015 de 2018.
 *
 * Qué hace: recibe un listado de transformadores (el que sale de cualquier
 * exportación del parque) y, fila por fila, recalcula la Unidad Constructiva que
 * le corresponde por sus datos de placa y la contrasta con la UUCC registrada.
 *
 * Por qué vive en `domain/`: no toca el DOM, no lee archivos y no depende de
 * Firebase ni de SheetJS. Recibe una matriz de celdas y devuelve el veredicto,
 * de modo que se puede probar con `node --test` sin navegador. La lectura del
 * .xlsx y el pintado son responsabilidad de `ui/fichas/evaluacion-masiva.js`.
 *
 * Regla del proyecto: el veredicto sale del VALOR contra la NORMA, nunca de un
 * texto libre. Si falta un dato para decidir, se dice — no se rellena.
 */

import { clasificarUC, buscarUC } from './fichas_creg_uc.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADOS DEL VEREDICTO
   ═══════════════════════════════════════════════════════════════════════════ */

export const ESTADOS = Object.freeze({
  CONCORDANTE: 'CONCORDANTE',
  DISCREPANCIA: 'DISCREPANCIA',
  FALTA_REGISTRO: 'FALTA REGISTRO',
  SIN_CALCULO: 'SIN CALCULO'
});

/** Orden de gravedad, para ordenar la tabla por «lo que exige decisión primero». */
export const GRAVEDAD = Object.freeze({
  [ESTADOS.DISCREPANCIA]: 0,
  [ESTADOS.FALTA_REGISTRO]: 1,
  [ESTADOS.SIN_CALCULO]: 2,
  [ESTADOS.CONCORDANTE]: 3
});

/* ═══════════════════════════════════════════════════════════════════════════
   DETECCIÓN DE COLUMNAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Quita tildes, signos y dobles espacios para comparar encabezados. */
export function normalizarEncabezado(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Sinónimos aceptados por campo. Se listan los que aparecen de verdad en las
 * exportaciones del parque (incluida la errata «TERCEARIO», que viene así en la
 * fuente oficial y no se corrige silenciosamente: se reconoce).
 */
const SINONIMOS = Object.freeze({
  subestacion:  ['SUBESTACION', 'S E', 'NOMBRE SUBESTACION', 'SE'],
  matricula:    ['MATRICULA', 'MATRICULA EQUIPO', 'TAG'],
  serie:        ['SERIE', 'NUMERO DE SERIE', 'N SERIE', 'SERIAL'],
  potenciaKva:  ['POTENCIA KVA', 'POTENCIA', 'KVA', 'CAPACIDAD KVA', 'POTENCIA NOMINAL KVA'],
  kvPrim:       ['NIVEL DE TENSION PRIMARIO KV', 'TENSION PRIMARIA KV', 'TENSION PRIMARIA',
                 'KV PRIMARIO', 'NIVEL DE TENSION PRIMARIO', 'VP'],
  kvSec:        ['NIVEL DE TENSION SECUNDARIO KV', 'TENSION SECUNDARIA KV', 'KV SECUNDARIO',
                 'NIVEL DE TENSION SECUNDARIO', 'VS'],
  kvTerc:       ['NIVEL DE TENSION TERCEARIO KV', 'NIVEL DE TENSION TERCIARIO KV',
                 'TENSION TERCIARIA KV', 'KV TERCIARIO', 'NIVEL DE TENSION TERCEARIO',
                 'NIVEL DE TENSION TERCIARIO', 'VT'],
  regulacion:   ['REGULACION', 'REGULACION ESTADO', 'TIPO DE REGULACION', 'CAMBIADOR'],
  uucc:         ['UUCC', 'UC', 'UUCC REGISTRADA', 'UC REGISTRADA', 'UNIDAD CONSTRUCTIVA'],
  zona:         ['ZONA'],
  departamento: ['DEPARTAMENTO', 'DPTO']
});

/**
 * Empareja los encabezados del archivo con los campos que necesitamos.
 * @param {Array<string>} encabezados fila de títulos, tal cual viene del archivo
 * @returns {{mapa:Object, faltantes:Array<string>, columnas:Array<string>}}
 *   `mapa` va de campo → índice de columna. `faltantes` son los campos
 *   imprescindibles que no se encontraron.
 */
export function mapearColumnas(encabezados) {
  const cols = (Array.isArray(encabezados) ? encabezados : []).map(normalizarEncabezado);
  const mapa = {};

  for (const [campo, alias] of Object.entries(SINONIMOS)) {
    // 1) coincidencia exacta; 2) el encabezado empieza por el alias. En ese
    // orden, para que «POTENCIA KVA» no se lleve la columna de «POTENCIA».
    let idx = -1;
    for (const a of alias) { idx = cols.indexOf(a); if (idx !== -1) break; }
    if (idx === -1) {
      for (const a of alias) {
        idx = cols.findIndex((c) => c && (c.startsWith(a + ' ') || c === a));
        if (idx !== -1) break;
      }
    }
    if (idx !== -1 && mapa[campo] === undefined) mapa[campo] = idx;
  }

  // Sin potencia y sin tensión primaria no hay forma de calcular la UC.
  const faltantes = [];
  if (mapa.potenciaKva === undefined) faltantes.push('POTENCIA (KVA)');
  if (mapa.kvPrim === undefined) faltantes.push('NIVEL DE TENSION PRIMARIO (KV)');

  return { mapa, faltantes, columnas: cols };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVALUACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

function celda(fila, i) {
  if (i === undefined || i === null || !Array.isArray(fila)) return null;
  const v = fila[i];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NA' || s === '-') return null;
  return s;
}

/** Normaliza un código de UC para comparar: sin espacios ni guiones, en mayúsculas. */
export function normalizarCodigoUC(v) {
  const s = String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s || null;
}

/**
 * Evalúa UNA fila del listado.
 * @param {Array} fila celdas de la fila
 * @param {Object} mapa campo → índice, de `mapearColumnas`
 * @returns {object} veredicto de la fila, con la traza del cálculo
 */
export function evaluarFila(fila, mapa) {
  const m = mapa || {};
  const subestacion  = celda(fila, m.subestacion);
  const matricula    = celda(fila, m.matricula);
  const serie        = celda(fila, m.serie);
  const potenciaKva  = celda(fila, m.potenciaKva);
  const kvPrim       = celda(fila, m.kvPrim);
  const kvSec        = celda(fila, m.kvSec);
  const kvTerc       = celda(fila, m.kvTerc);
  const regulacion   = celda(fila, m.regulacion);
  const uuccBruta    = celda(fila, m.uucc);
  const zona         = celda(fila, m.zona);
  const departamento = celda(fila, m.departamento);

  const registrada = normalizarCodigoUC(uuccBruta);
  const r = clasificarUC(potenciaKva, kvPrim, kvTerc, regulacion);
  const calculada = normalizarCodigoUC(r.uucc_calc);

  let estado;
  let motivo = '';
  if (!calculada) {
    estado = ESTADOS.SIN_CALCULO;
    motivo = (r.notas && r.notas[0])
      ? r.notas[0]
      : 'Faltan datos de placa para asignar una Unidad Constructiva.';
  } else if (!registrada) {
    estado = ESTADOS.FALTA_REGISTRO;
    motivo = `El equipo no trae UUCC registrada; por placa le corresponde ${calculada}.`;
  } else if (registrada === calculada) {
    estado = ESTADOS.CONCORDANTE;
    motivo = 'La UUCC registrada coincide con la calculada por placa.';
  } else {
    estado = ESTADOS.DISCREPANCIA;
    const reg = buscarUC(registrada);
    const cal = buscarUC(calculada);
    motivo = `Registrada ${registrada}${reg && reg.fila ? ` (${reg.fila.cap})` : ''}`
      + ` vs. calculada ${calculada}${cal && cal.fila ? ` (${cal.fila.cap})` : ''}.`;
  }

  return {
    subestacion, matricula, serie, zona, departamento,
    potenciaKva, kvPrim, kvSec, kvTerc, regulacion,
    mva: r.mva ?? null,
    nivel: r.nivel ?? null,
    devanado: r.devanado ?? null,
    banda: r.banda ?? null,
    regCatalogo: r.reg_catalogo ?? null,
    uuccRegistrada: registrada,
    uuccCalculada: calculada,
    estado,
    motivo,
    // La traza: por qué el clasificador llegó a ese código. Es lo que hace
    // auditable el veredicto, en vez de pedir fe.
    pasos: Array.isArray(r.pasos) ? r.pasos : [],
    notas: Array.isArray(r.notas) ? r.notas : []
  };
}

/**
 * Evalúa un listado completo.
 * @param {Array<Array>} matriz filas del archivo; la primera es el encabezado
 * @returns {{filas:Array, resumen:object, mapa:object, faltantes:Array<string>,
 *            encabezados:Array, descartadas:number}}
 */
export function evaluarListado(matriz) {
  const datos = Array.isArray(matriz) ? matriz : [];
  if (!datos.length) {
    return {
      filas: [], mapa: {}, faltantes: ['(archivo vacío)'],
      encabezados: [], descartadas: 0, resumen: resumir([])
    };
  }

  const encabezados = datos[0] || [];
  const { mapa, faltantes } = mapearColumnas(encabezados);

  const filas = [];
  let descartadas = 0;
  for (let i = 1; i < datos.length; i += 1) {
    const f = datos[i];
    // Fila vacía o sin ninguna celda con contenido: no cuenta.
    if (!Array.isArray(f) || !f.some((c) => c != null && String(c).trim() !== '')) {
      descartadas += 1;
      continue;
    }
    const ev = evaluarFila(f, mapa);
    ev.fila = i + 1; // número de fila tal como se ve en Excel (1-based + encabezado)
    filas.push(ev);
  }

  return { filas, mapa, faltantes, encabezados, descartadas, resumen: resumir(filas) };
}

/** Contadores por estado, con porcentaje sobre el total evaluado. */
export function resumir(filas) {
  const lista = Array.isArray(filas) ? filas : [];
  const total = lista.length;
  const cuenta = {
    [ESTADOS.CONCORDANTE]: 0,
    [ESTADOS.DISCREPANCIA]: 0,
    [ESTADOS.FALTA_REGISTRO]: 0,
    [ESTADOS.SIN_CALCULO]: 0
  };
  for (const f of lista) {
    if (cuenta[f.estado] !== undefined) cuenta[f.estado] += 1;
  }
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const conformes = cuenta[ESTADOS.CONCORDANTE];
  return {
    total,
    concordantes: conformes,
    discrepancias: cuenta[ESTADOS.DISCREPANCIA],
    faltaRegistro: cuenta[ESTADOS.FALTA_REGISTRO],
    sinCalculo: cuenta[ESTADOS.SIN_CALCULO],
    pctConcordantes: pct(conformes),
    pctDiscrepancias: pct(cuenta[ESTADOS.DISCREPANCIA]),
    // Conformidad = concordantes sobre los que SÍ se pudieron evaluar.
    // Contar como incumplimiento un equipo al que le falta la placa sería
    // culparlo de un vacío de datos, no de una mala clasificación.
    evaluables: total - cuenta[ESTADOS.SIN_CALCULO],
    conformidad: (total - cuenta[ESTADOS.SIN_CALCULO])
      ? Math.round((conformes / (total - cuenta[ESTADOS.SIN_CALCULO])) * 1000) / 10
      : 0
  };
}

/** Ordena por gravedad y, dentro de cada grupo, por subestación. */
export function ordenarPorGravedad(filas) {
  return [...(filas || [])].sort((a, b) => {
    const g = (GRAVEDAD[a.estado] ?? 9) - (GRAVEDAD[b.estado] ?? 9);
    if (g !== 0) return g;
    return String(a.subestacion || '').localeCompare(String(b.subestacion || ''), 'es');
  });
}

/** Filas listas para exportar: cabecera + datos, sin objetos anidados. */
export function filasParaExportar(filas) {
  const cab = ['Fila', 'Subestación', 'Matrícula', 'Serie', 'Zona', 'Departamento',
    'Potencia (kVA)', 'MVA', 'V primaria (kV)', 'V terciaria (kV)', 'Regulación',
    'Nivel', 'Devanado', 'Banda', 'UUCC registrada', 'UUCC calculada', 'Estado',
    'Motivo', 'Traza del cálculo', 'Advertencias'];
  const cuerpo = (filas || []).map((f) => [
    f.fila ?? '', f.subestacion ?? '', f.matricula ?? '', f.serie ?? '',
    f.zona ?? '', f.departamento ?? '', f.potenciaKva ?? '', f.mva ?? '',
    f.kvPrim ?? '', f.kvTerc ?? '', f.regulacion ?? '',
    f.nivel ?? '', f.devanado === 'tri' ? 'Tridevanado' : (f.devanado === 'bi' ? 'Bidevanado' : ''),
    f.banda ?? '', f.uuccRegistrada ?? '', f.uuccCalculada ?? '', f.estado ?? '',
    f.motivo ?? '', (f.pasos || []).join(' · '), (f.notas || []).join(' · ')
  ]);
  return [cab, ...cuerpo];
}
