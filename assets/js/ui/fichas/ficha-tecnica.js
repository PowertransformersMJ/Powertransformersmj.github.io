// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · FICHA DEL TRANSFORMADOR
// ──────────────────────────────────────────────────────────────
// Porta `buildFichaTecnica` (+ su núcleo `fichaCore`) del módulo suelto
// `Modulo_Fichas_Tecnicas_v22.html` al repo, como módulo ES6.
//
// FUNCIÓN PURA: recibe el registro del transformador y DEVUELVE UN STRING
// de HTML. No toca el DOM, no lee Firestore, no usa `window` ni `document`.
// Quien la llame decide dónde pintarlo (modal, hoja de impresión, iframe).
//
// La ficha tiene siete bloques:
//   1  Identificación               5  Insumo del Salud de Activos
//   2  Datos técnicos / placa       6  Plan de acción propuesto
//   2b Diagnóstico medido           (pie con la trazabilidad del origen)
//   3  Clasificación UUCC (CREG 015/2018)
//   4  Estado de salud (1–5) y estrategia asociada
//
// DE DÓNDE SALE CADA COSA (y qué NO se inventa aquí):
//   · El bloque 2b lo redacta `assets/js/domain/fichas_diagnostico.js`
//     (furanos, DP por curva de Chendong, DGA, modo de degradación). Este
//     módulo NO lo reimplementa: lo inyecta. Ver `fijarRenderDiagnostico()`.
//   · La clasificación UUCC sale de `assets/js/domain/fichas_creg_uc.js`
//     (Tablas 51/52 de la CREG 015/2018) y sólo se calcula si el registro
//     no la trae ya resuelta.
//   · El plan de acción sale de la macroactividad/subactividades REGISTRADAS.
//     Cuando el equipo no tiene ninguna, se propone una línea base por
//     condición y la ficha lo declara como tal: no se disfraza de dato real.
//
// PIEL: clases `.ftm-*` de `assets/css/fichas-tecnicas.css`. Los únicos
// estilos en línea son los que dependen del DATO (color de la condición y
// de la categoría de acción), porque no pueden vivir en una clase fija.
// ══════════════════════════════════════════════════════════════

import { clasificarUC } from '../../domain/fichas_creg_uc.js';

// ── Escala de condición (estado de salud) ─────────────────────
// Los colores coinciden con los tokens --ftm-c1..c5 de la hoja de estilos;
// se escriben literales porque la ficha también se imprime como documento
// suelto, fuera del contenedor `.ftm-root` donde viven esas variables.
export const COLOR_CONDICION = Object.freeze({
  1: '#1cc870', 2: '#79c66a', 3: '#ffb800', 4: '#ff9500', 5: '#ff3b30', na: '#8093ad'
});

export const NOMBRE_CONDICION = Object.freeze({
  1: 'Muy bueno', 2: 'Bueno', 3: 'Medio', 4: 'Pobre', 5: 'Muy pobre'
});

/** Nombre de la condición 1–5 ('Sin dato' si no hay). */
export function nombreCondicion(ci) {
  return ci == null ? 'Sin dato' : (NOMBRE_CONDICION[ci] || ('Condición ' + ci));
}

/** Color de la condición 1–5 (gris si no hay dato). */
export function colorCondicion(ci) {
  return COLOR_CONDICION[ci == null ? 'na' : ci] || COLOR_CONDICION.na;
}

// ── Categorías funcionales de las acciones ────────────────────
// `tier` = prioridad relativa: ordena el plan de más a menos determinante.
export const CATEGORIAS_ACCION = Object.freeze({
  INV:  { lbl: 'Inversión / Reposición',    c: '#d64545', tier: 4 },
  MIT:  { lbl: 'Mitigación operativa',      c: '#e0a800', tier: 3 },
  MEJ:  { lbl: 'Recuperación / Mejora',     c: '#1f9d57', tier: 3 },
  CORR: { lbl: 'Mantenimiento correctivo',  c: '#b0742c', tier: 2 },
  DIAG: { lbl: 'Monitoreo / Diagnóstico',   c: '#0f6f8c', tier: 1 }
});

/**
 * Clasifica una subactividad escrita en lenguaje de campo dentro de una de
 * las cinco categorías funcionales. Heurística por texto (el registro de
 * origen no trae categoría), conservadora: lo que no encaja es diagnóstico.
 * @param {string} s
 * @returns {'INV'|'MIT'|'MEJ'|'CORR'|'DIAG'}
 */
export function clasificarAccion(s) {
  const u = (s || '').toUpperCase();
  if (/(PLAN DE INVERSION|\bPI\b|AUMENTO DE CAPACIDAD|INSTALACION DE UNIDAD|REPOSICION|REEMPLAZO)/.test(u)) return 'INV';
  if (/(MITIGACION|SOBRECARGA)/.test(u)) return 'MIT';
  if (/(RECUPERACION DE AISLAM|ACTUALIZACION DEL SISTEMA DE REFRIG|REPOTENCIACION|REGENERACION|SECADO)/.test(u)) return 'MEJ';
  if (/(CORRECCION DE FUGAS|MANTENIMIENTO OLTC|ACTUALIZACION DE ACCESORIOS|PINTURA|\bMANTENIMIENTO\b)/.test(u)) return 'CORR';
  return 'DIAG';
}

/** Estrategia de intervención asociada a cada condición de salud. */
export const ESTRATEGIA_POR_CONDICION = Object.freeze({
  1: { obj: 'Conservar el estado sano del activo', prio: 'Baja', horiz: 'Programa anual', foco: ['DIAG'] },
  2: { obj: 'Sostener el desempeño y prevenir deterioro', prio: 'Baja–media', horiz: 'Programa anual con inspección reforzada', foco: ['DIAG', 'CORR'] },
  3: { obj: 'Frenar el deterioro y recuperar márgenes de operación', prio: 'Media', horiz: 'Intervención dentro del ciclo vigente (≤ 12 meses)', foco: ['CORR', 'MEJ', 'DIAG'] },
  4: { obj: 'Contener el riesgo y preparar la inversión de reposición', prio: 'Alta', horiz: 'Intervención prioritaria (≤ 6 meses) y evaluación de reposición', foco: ['MIT', 'MEJ', 'INV'] },
  5: { obj: 'Mitigar riesgo de falla — activo en fin de vida técnica', prio: 'Crítica', horiz: 'Reposición prioritaria (inmediata)', foco: ['INV', 'MIT'] }
});

/**
 * Línea base por condición: qué se propone cuando la fuente NO trae
 * macroactividad para el equipo. Siempre se rotula como referencial.
 */
export const LINEA_BASE_POR_CONDICION = Object.freeze({
  1: ['INSPECCION TERMOGRAFICA', 'INSPECCION OCULAR DETALLADA', 'MUESTREO DE ACEITE'],
  2: ['INSPECCION TERMOGRAFICA', 'MUESTREO DE ACEITE', 'VERIFICACION DE SISTEMAS DE REFRIGERACION', 'CORRECCION DE FUGAS POR ACCESORIOS'],
  3: ['MUESTREO DE ACEITE', 'RECUPERACION DE AISLAMIENTOS', 'ACTUALIZACION DEL SISTEMA DE REFRIGERACION', 'CORRECCION DE FUGAS POR ACCESORIOS'],
  4: ['PLAN DE MITIGACION POR SOBRECARGA', 'RECUPERACION DE AISLAMIENTOS', 'PROPUESTA A PLAN DE INVERSION (PI)'],
  5: ['PROPUESTA A PLAN DE INVERSION (PI)', 'INSTALACION DE UNIDAD DE TRANSFORMACION ADICIONAL']
});

// ── utilidades internas ───────────────────────────────────────

/** Escapa para HTML. Los datos vienen de Firestore: NUNCA se interpolan crudos. */
function esc(x) {
  return (x == null ? '' : String(x))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Colapsa espacios y recorta. */
export function limpiarTexto(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** Lee la primera ruta con valor útil ('a.b' admitido). */
function leer(obj, ...rutas) {
  for (const ruta of rutas) {
    let v = obj;
    for (const paso of String(ruta).split('.')) {
      if (v == null || typeof v !== 'object') { v = undefined; break; }
      v = v[paso];
    }
    if (v != null && v !== '') return v;
  }
  return null;
}

/** Fila clave–valor de la ficha. El guion largo marca el dato ausente. */
function filaKV(k, v) {
  const vacio = (v == null || v === '');
  return '<div class="ftm-kv-row"><span class="ftm-kv-k">' + esc(k) + '</span>'
    + '<span class="ftm-kv-v">' + (vacio ? '—' : esc(v)) + '</span></div>';
}

/** Fila con HTML ya construido en el valor (para chips y enlaces). */
function filaKVHtml(k, html) {
  return '<div class="ftm-kv-row"><span class="ftm-kv-k">' + esc(k) + '</span>'
    + '<span class="ftm-kv-v">' + html + '</span></div>';
}

/** Título de sección (banda petróleo). */
function seccion(t) {
  return '<h2 class="ftm-ficha-seccion">' + esc(t) + '</h2>';
}

/** Nota al pie de un bloque (cursiva, gris). */
function nota(t, alerta) {
  return '<div class="ftm-ficha-nota"'
    + (alerta ? ' style="color:#b04a2c;font-style:normal"' : '') + '>' + t + '</div>';
}

// ── Bloque 2b · Diagnóstico medido (INYECTADO, no reimplementado) ──
// El cálculo del DP / vida del aislamiento vive en el dominio
// (`salud_activos.js` → calcularDP · calcularVidaUtilizada ·
// calcularVidaRemanente) y su redacción en `fichas_diagnostico.js`.
// Aquí sólo se pide el HTML ya armado.
let _renderDiagnostico = null;

/**
 * Registra el generador del bloque de diagnóstico.
 * @param {(equipo:object)=>string} fn  devuelve HTML (string vacío si no hay ensayos)
 */
export function fijarRenderDiagnostico(fn) {
  _renderDiagnostico = (typeof fn === 'function') ? fn : null;
  return _renderDiagnostico != null;
}

/**
 * Engancha automáticamente `domain/fichas_diagnostico.js` si está publicado.
 * Es ASÍNCRONA y OPCIONAL: llámala una vez al arrancar la página, antes de
 * pintar la primera ficha. Si el módulo no existe todavía, la ficha se
 * construye igual — simplemente sin el bloque 2b (no se inventa nada).
 *
 * Se hace por import dinámico y no con un `import` estático a propósito:
 * un import estático a un archivo aún no publicado rompería TODA la página.
 *
 * @returns {Promise<boolean>} true si quedó enganchado
 */
export async function prepararDiagnostico() {
  if (_renderDiagnostico) return true;
  try {
    const m = await import('../../domain/fichas_diagnostico.js');
    const candidatos = ['bloqueDiagnosticoHTML', 'construirBloqueDiagnostico',
      'diagnosticoHTML', 'construirDiagnostico', 'ftDiagHTML', 'default'];
    for (const n of candidatos) {
      if (typeof m[n] === 'function') { _renderDiagnostico = m[n]; return true; }
    }
    console.warn('[fichas/ficha-tecnica] fichas_diagnostico.js no expone un generador reconocible');
  } catch (e) {
    console.info('[fichas/ficha-tecnica] sin módulo de diagnóstico; la ficha omite el bloque 2b');
  }
  return false;
}

/** Resuelve el bloque 2b: opción explícita → generador registrado → nada. */
function bloqueDiagnostico(equipo, opciones) {
  const d = opciones && opciones.diagnostico;
  try {
    if (typeof d === 'string') return d;
    if (typeof d === 'function') return d(equipo) || '';
    if (_renderDiagnostico) return _renderDiagnostico(equipo) || '';
  } catch (e) {
    console.warn('[fichas/ficha-tecnica] el bloque de diagnóstico falló:', e);
  }
  return '';
}

// ── Núcleo: condición, estrategia y plan ──────────────────────

/**
 * Calcula el núcleo de la ficha (sin HTML): condición, estrategia, acciones
 * ordenadas por prioridad, si se usó línea base y la brecha detectada.
 * Útil también para pruebas y para otros consumidores (tablero, exportador).
 *
 * @param {object} equipo  registro del transformador
 * @returns {{ci:number|null, cn:string, estrategia:object|null,
 *            acciones:Array<{s:string,cat:string,tier:number}>,
 *            baseUsada:boolean, brecha:string}}
 */
export function nucleoFicha(equipo) {
  const f = equipo || {};
  const crudo = leer(f, 'cond_int', 'condicion', 'salud_actual.hi_final');
  let ci = (crudo == null) ? null : Math.round(parseFloat(String(crudo).replace(',', '.')));
  if (!Number.isFinite(ci)) ci = null;
  if (ci != null) ci = Math.min(5, Math.max(1, ci));

  const cn = nombreCondicion(ci);
  const estrategia = (ci != null && ESTRATEGIA_POR_CONDICION[ci]) ? ESTRATEGIA_POR_CONDICION[ci] : null;

  const subacts = Array.isArray(f.subacts) ? f.subacts
    : (Array.isArray(f.subactividades) ? f.subactividades : []);
  let items = subacts.map(limpiarTexto).filter(Boolean);

  const baseUsada = items.length === 0;
  if (baseUsada && ci != null && LINEA_BASE_POR_CONDICION[ci]) {
    items = LINEA_BASE_POR_CONDICION[ci].slice();
  }

  const acciones = items.map((s) => {
    const cat = clasificarAccion(s);
    return { s, cat, tier: CATEGORIAS_ACCION[cat].tier };
  });
  acciones.sort((a, b) => b.tier - a.tier);

  // Brecha: condición severa cuyo plan REGISTRADO no contempla inversión.
  let brecha = '';
  if (estrategia && !baseUsada && estrategia.foco.indexOf('INV') >= 0
      && !acciones.some((r) => r.cat === 'INV')) {
    brecha = 'El plan registrado no incluye una acción de inversión/reposición pese a la condición '
      + ci + ' (' + cn + '); se recomienda evaluar su incorporación.';
  }

  return { ci, cn, estrategia, acciones, baseUsada, brecha };
}

/**
 * Clasificación UUCC del equipo. Si el registro ya la trae resuelta se
 * respeta; si no, se calcula con el catálogo CREG (`fichas_creg_uc.js`).
 * NO se duplica la regla: se delega.
 */
function clasificacionUC(f) {
  const registrada = leer(f, 'uucc_registrada');
  let calculada = leer(f, 'uucc_calculada');
  let nivel = leer(f, 'nivel');
  let nivelLbl = leer(f, 'nivel_lbl');
  let banda = leer(f, 'banda');
  let catalogo = leer(f, 'reg_catalogo');

  if (calculada == null) {
    const kva = leer(f, 'potencia_kva', 'placa.potencia_kva');
    const kvp = leer(f, 'kv_prim', 'tension_primaria_kv', 'electrico.tension_primaria_kv');
    const kvt = leer(f, 'kv_terc', 'tension_terciaria_kv', 'electrico.tension_terciaria_kv');
    const reg = leer(f, 'regulacion', 'tipo_tap', 'electrico.tipo_tap');
    if (kva != null || kvp != null) {
      const c = clasificarUC(kva, kvp, kvt, reg);
      calculada = c.uucc_calc; nivel = nivel ?? c.nivel;
      nivelLbl = nivelLbl ?? c.nivel_lbl; banda = banda ?? c.banda;
      catalogo = catalogo ?? c.reg_catalogo;
    }
  }
  return { registrada, calculada, nivel, nivelLbl, banda, catalogo };
}

// ── La ficha ──────────────────────────────────────────────────

/**
 * Construye el HTML de la ficha técnica del transformador.
 * FUNCIÓN PURA (salvo la fecha de generación, que puede fijarse por opción).
 *
 * @param {object} equipo  registro del transformador. Se aceptan tanto el
 *        registro plano del módulo de fichas (subestacion, kv_prim, cond_int,
 *        subacts…) como el documento v2 de `/transformadores` (identificacion,
 *        placa, electrico, ubicacion…): cada campo se busca en ambos sitios.
 * @param {object} [opciones]
 * @param {string|function} [opciones.diagnostico]  HTML del bloque 2b, o
 *        generador `(equipo)=>string`. Si se omite se usa el registrado con
 *        `fijarRenderDiagnostico()` / `prepararDiagnostico()`.
 * @param {boolean} [opciones.envolver=true]  envuelve en `.ftm-ficha` (el papel).
 * @param {Date}   [opciones.fecha]  fecha de generación (por defecto, hoy).
 * @param {string} [opciones.origen] texto de trazabilidad del pie.
 * @returns {string} HTML
 */
export function construirFichaTecnica(equipo, opciones = {}) {
  const f = equipo || {};
  const { ci, cn, estrategia, acciones, baseUsada, brecha } = nucleoFicha(f);
  const col = colorCondicion(ci);
  const uc = clasificacionUC(f);

  const planHtml = acciones.length
    ? acciones.map((r) => {
      const C = CATEGORIAS_ACCION[r.cat];
      return '<li><span class="ftm-plan-cat" style="background:' + C.c + '">' + esc(C.lbl) + '</span>'
        + '<span class="ftm-plan-act">' + esc(r.s) + '</span></li>';
    }).join('')
    : '<li><span class="ftm-plan-act">Sin acciones registradas ni línea base aplicable.</span></li>';

  const focoHtml = estrategia
    ? estrategia.foco.map((k) => '<span class="ftm-ficha-pill" style="border-color:'
      + CATEGORIAS_ACCION[k].c + ';color:' + CATEGORIAS_ACCION[k].c + '">'
      + esc(CATEGORIAS_ACCION[k].lbl) + '</span>').join('')
    : '';

  const descCatalogo = limpiarTexto(uc.catalogo || '');
  const fecha = (opciones.fecha instanceof Date) ? opciones.fecha : new Date();
  const hoy = fecha.toLocaleDateString('es-CO');

  const kvTerc = leer(f, 'kv_terc', 'tension_terciaria_kv', 'electrico.tension_terciaria_kv');
  const devanado = leer(f, 'devanado');
  const macro = leer(f, 'macro_raw', 'macroactividad');

  const idEquipo = leer(f, 'codigo', 'identificacion.codigo', 'id', 'matricula', 'fila');
  const origen = opciones.origen
    || ('Origen: Salud de Activos · TX_Potencia' + (idEquipo ? ' (' + idEquipo + ')' : '')
      + ' · Regla CREG 015/2018');

  const cuerpo =
    // ── cabecera ──────────────────────────────────────────────
    '<div class="ftm-ficha-head">'
      + '<div><h1 class="ftm-ficha-t">FICHA TÉCNICA DEL TRANSFORMADOR</h1>'
      + '<div class="ftm-ficha-sub">Plan de acciones según estado de salud · CREG 015/2018 · Metodología de Salud de Activos</div></div>'
      + '<div style="text-align:right"><div class="ftm-ficha-logo">afinia</div>'
      + '<div class="ftm-ficha-sub">Grupo EPM</div></div>'
    + '</div>'

    // ── 1 · Identificación ────────────────────────────────────
    + seccion('1 · Identificación')
    + '<div class="ftm-kv">'
      + filaKV('Subestación', leer(f, 'subestacion', 'ubicacion.subestacion_nombre'))
      + filaKV('Código S/E', leer(f, 'cod_subestacion', 'ubicacion.subestacionId'))
      + filaKV('Serie', leer(f, 'serie', 'identificacion.numero_serie'))
      + filaKV('Matrícula', leer(f, 'matricula', 'identificacion.matricula'))
      + filaKV('Grupo', leer(f, 'grupo'))
      + filaKV('Zona', leer(f, 'zona', 'ubicacion.zona'))
      + filaKV('Departamento', leer(f, 'departamento', 'ubicacion.departamento'))
      + filaKV('Identificador (fuente)', idEquipo)
    + '</div>'

    // ── 2 · Datos técnicos / placa ────────────────────────────
    + seccion('2 · Datos técnicos / placa')
    + '<div class="ftm-kv">'
      + filaKV('Potencia (kVA)', leer(f, 'potencia_kva', 'placa.potencia_kva'))
      + filaKV('Capacidad (MVA)', leer(f, 'mva'))
      + filaKV('Tensión primaria (kV)', leer(f, 'kv_prim', 'tension_primaria_kv', 'electrico.tension_primaria_kv'))
      + filaKV('Tensión secundaria (kV)', leer(f, 'kv_sec', 'tension_secundaria_kv', 'electrico.tension_secundaria_kv'))
      + filaKV('Tensión terciaria (kV)',
        (kvTerc == null || String(kvTerc).toUpperCase() === 'N/A') ? 'N/A' : kvTerc)
      + filaKV('Configuración', devanado == null ? null : (devanado === 'tri' ? 'Tridevanado' : 'Bidevanado'))
      + filaKV('Refrigeración', leer(f, 'refrigeracion', 'mecanico.tipo_refrigeracion'))
      + filaKV('Regulación', leer(f, 'regulacion', 'tipo_tap', 'electrico.tipo_tap'))
      + filaKV('Año de fabricación', leer(f, 'anio_fab', 'identificacion.ano_fabricacion'))
      + filaKV('Edad (años)', leer(f, 'edad'))
    + '</div>'

    // ── 2b · Diagnóstico medido (módulo de diagnóstico) ───────
    + bloqueDiagnostico(f, opciones)

    // ── 3 · Clasificación UUCC ────────────────────────────────
    + seccion('3 · Clasificación UUCC (CREG 015/2018)')
    + '<div class="ftm-kv">'
      + filaKV('UUCC registrada', uc.registrada || 'N/D')
      + filaKV('UUCC calculada', uc.calculada || 'N/D')
      + filaKV('Nivel de tensión', (uc.nivel || '—') + (uc.nivelLbl ? (' · ' + uc.nivelLbl) : ''))
      + filaKV('Banda de capacidad', uc.banda || '—')
      + filaKV('Estado de clasificación', leer(f, 'estado'))
      + filaKV('', ' ')
    + '</div>'
    + (descCatalogo
      ? '<div class="ftm-kv ftm-kv--una">' + filaKV('Descripción de catálogo', descCatalogo) + '</div>'
      : '')

    // ── 4 · Estado de salud ───────────────────────────────────
    + seccion('4 · Estado de salud')
    + '<div style="display:flex;gap:16px;align-items:center;margin-bottom:6px">'
      + '<div class="ftm-ficha-badge"><span class="ftm-ficha-chip" style="background:' + col + '">'
        + (ci != null ? ci : 's/d') + '</span>'
      + '<span class="ftm-ficha-badge-n" style="color:' + col + '">' + esc(cn) + '</span></div>'
      + '<div class="ftm-kv" style="flex:1">'
        + filaKV('Estado de salud (1–5)', ci != null ? (ci + ' — ' + cn) : 'Sin dato')
        + filaKV('Escala', '1 Muy bueno → 5 Muy pobre')
      + '</div>'
    + '</div>'
    + (estrategia
      ? '<div class="ftm-ficha-strip">'
          + '<span class="ftm-ficha-pill"><b>Objetivo:</b> ' + esc(estrategia.obj) + '</span>'
          + '<span class="ftm-ficha-pill"><b>Prioridad:</b> ' + esc(estrategia.prio) + '</span>'
          + '<span class="ftm-ficha-pill"><b>Horizonte:</b> ' + esc(estrategia.horiz) + '</span>'
        + '</div>'
        + '<div class="ftm-ficha-nota" style="font-style:normal">Enfoque de intervención acorde a la condición '
          + ci + ': ' + focoHtml + '</div>'
      : nota('Sin clasificación de salud en la fuente; el enfoque se definirá tras la evaluación de condición.'))

    // ── 5 · Insumo del Salud de Activos ───────────────────────
    + seccion('5 · Insumo del Salud de Activos (macroactividad y subactividades)')
    + '<div class="ftm-ficha-fuente">'
      + (macro ? esc(macro) : '(Sin macroactividad registrada para este equipo en TX_Potencia.)')
    + '</div>'
    + '<div class="ftm-kv" style="margin-top:8px">'
      + filaKV('Repotenciación de refrigeración', leer(f, 'refrig') || '—')
      + filaKV('Ubicación de fugas', leer(f, 'fugas') || '—')
      + filaKV('Usuarios asociados', leer(f, 'usuarios', 'usuarios_aguas_abajo',
        'criticidad.usuarios_aguas_abajo') || '—')
      + filaKV('', ' ')
    + '</div>'

    // ── 6 · Plan de acción ────────────────────────────────────
    + seccion('6 · Plan de acción propuesto')
    + (baseUsada
      ? (acciones.length
        ? nota('Este equipo no tiene macroactividad registrada en la fuente; se propone una '
          + '<b>línea base por condición ' + ci + '</b> (referencial, sujeta a validación en campo).')
        : nota('Este equipo no tiene macroactividad registrada en la fuente ni condición de salud '
          + 'para derivar una línea base; registre las actividades o asigne la condición.'))
      : '')
    + '<ul class="ftm-plan">' + planHtml + '</ul>'
    + (brecha ? nota('▸ ' + esc(brecha), true) : '')
    + nota('Las acciones provienen de la macroactividad/subactividades registradas en el Salud de '
      + 'Activos (TX_Potencia); su orden refleja la prioridad asociada al estado de salud. La categoría '
      + 'es una clasificación funcional automática. No se incorporan acciones no sustentadas en el registro.')

    // ── pie ───────────────────────────────────────────────────
    + '<div class="ftm-ficha-foot"><span>' + esc(origen) + '</span>'
      + '<span>Generado: ' + esc(hoy) + ' · Afinia / Grupo EPM</span></div>';

  return (opciones.envolver === false) ? cuerpo : '<div class="ftm-ficha">' + cuerpo + '</div>';
}

export default construirFichaTecnica;
