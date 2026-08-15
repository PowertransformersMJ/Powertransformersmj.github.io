/**
 * Segmento «Evaluación masiva de UUCC» — adjuntar un listado y contrastarlo
 * contra el catálogo de Unidades Constructivas de la Resolución CREG 015 de 2018.
 *
 * El archivo NO se sube a ningún servidor: se lee en el navegador con SheetJS y
 * se evalúa en memoria. Es material del parque, así que no debe salir del equipo
 * de quien lo abre.
 *
 * Reparto de responsabilidades: aquí solo hay lectura de archivo y pintado. El
 * veredicto lo emite `domain/fichas_evaluacion_uucc.js`, que es dominio puro y
 * está cubierto por pruebas.
 *
 * Todo el marcado que produce este archivo vive bajo el prefijo `.ftm-`.
 */

import {
  ESTADOS, evaluarListado, ordenarPorGravedad, filasParaExportar
} from '../../domain/fichas_evaluacion_uucc.js';

/** Mismo CDN de SheetJS que ya usan `ui/calidad/upload.js` y `data/seguimiento_scada_excel.js`. */
const SHEETJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/** Extensiones aceptadas. El .csv se lee igual con SheetJS. */
const EXTENSIONES = ['.xlsx', '.xlsm', '.xls', '.csv'];

/* ═══════════════════════════════════════════════════════════════════════════
   CARGA PEREZOSA DE SHEETJS
   Abrir la página no descarga nada: solo se pide al adjuntar el primer archivo.
   ═══════════════════════════════════════════════════════════════════════════ */

let promesaSheetJS = null;

function cargarSheetJS() {
  if (typeof window !== 'undefined' && window.XLSX) return Promise.resolve(window.XLSX);
  if (promesaSheetJS) return promesaSheetJS;
  promesaSheetJS = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_CDN;
    s.async = true;
    s.onload = () => (window.XLSX
      ? resolve(window.XLSX)
      : reject(new Error('SheetJS cargó pero no expuso XLSX.')));
    s.onerror = () => reject(new Error(
      'No se pudo cargar la librería de lectura de Excel. Revise la conexión e intente de nuevo.'
    ));
    document.head.appendChild(s);
  });
  return promesaSheetJS;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES DE PINTADO
   ═══════════════════════════════════════════════════════════════════════════ */

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Modificador de la píldora de estado (reusa los colores ya definidos en el CSS). */
const CLASE_ESTADO = {
  [ESTADOS.CONCORDANTE]: 'ok',
  [ESTADOS.DISCREPANCIA]: 'err',
  [ESTADOS.FALTA_REGISTRO]: 'falta',
  [ESTADOS.SIN_CALCULO]: 'sin'
};

/** Modificador de la FILA. El CSS ya trae `--disc`, `--falta` y `--sin`;
 *  la fila concordante no lleva modificador (fondo normal). */
const CLASE_FILA = {
  [ESTADOS.CONCORDANTE]: '',
  [ESTADOS.DISCREPANCIA]: 'ftm-row--disc',
  [ESTADOS.FALTA_REGISTRO]: 'ftm-row--falta',
  [ESTADOS.SIN_CALCULO]: 'ftm-row--sin'
};

function tarjeta(valor, etiqueta, sufijo, mod) {
  return '<div class="ftm-kpi ftm-kpi--' + mod + '">'
    + '<div class="ftm-kpi-num">' + esc(valor) + '</div>'
    + '<div class="ftm-kpi-lbl">' + esc(etiqueta) + '</div>'
    + (sufijo ? '<div class="ftm-kpi-pct">' + esc(sufijo) + '</div>' : '')
    + '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Monta el segmento de evaluación masiva.
 * @param {HTMLElement|string} contenedor elemento o id
 * @param {object} [opts]
 * @param {number} [opts.maxFilasTabla=400] tope de filas pintadas (la exportación las lleva todas)
 * @returns {{destruir:Function, resultado:Function}}
 */
export function montarEvaluacionMasiva(contenedor, opts = {}) {
  const raiz = typeof contenedor === 'string'
    ? document.getElementById(contenedor)
    : contenedor;
  if (!raiz) throw new Error('montarEvaluacionMasiva: contenedor no encontrado.');

  const MAX_TABLA = Number(opts.maxFilasTabla) || 400;
  let ultimo = null;      // último resultado completo
  let filtro = null;      // estado por el que se está filtrando, o null

  raiz.classList.add('ftm-root');
  raiz.innerHTML = plantillaInicial();

  const zona    = raiz.querySelector('[data-ftm="zona"]');
  const input   = raiz.querySelector('[data-ftm="input"]');
  const salida  = raiz.querySelector('[data-ftm="salida"]');
  const estado  = raiz.querySelector('[data-ftm="estado"]');

  function plantillaInicial() {
    return ''
      + '<section class="ftm-eval">'
      +   '<header class="ftm-eval-head">'
      +     '<h2 class="ftm-eval-titulo">Evaluación masiva de UUCC</h2>'
      +     '<p class="ftm-eval-sub">Adjunte el listado de transformadores y se contrastará, '
      +       'equipo por equipo, la Unidad Constructiva registrada contra la que le corresponde '
      +       'por placa según la <b>Resolución CREG 015 de 2018</b>.</p>'
      +   '</header>'
      +   '<div class="ftm-eval-zona" data-ftm="zona" tabindex="0" role="button" '
      +        'aria-label="Adjuntar listado de transformadores">'
      +     '<div class="ftm-eval-icono" aria-hidden="true">📄</div>'
      +     '<div class="ftm-eval-txt"><b>Arrastre aquí el listado</b> o pulse para elegirlo</div>'
      +     '<div class="ftm-eval-hint">Excel o CSV · se lee en su equipo, no se envía a ningún servidor</div>'
      +     '<input type="file" data-ftm="input" accept="' + EXTENSIONES.join(',') + '" hidden>'
      +   '</div>'
      +   '<div class="ftm-eval-estado" data-ftm="estado" role="status" aria-live="polite"></div>'
      +   '<div data-ftm="salida"></div>'
      + '</section>';
  }

  function decir(msg, tono) {
    estado.className = 'ftm-eval-estado' + (tono ? ' is-' + tono : '');
    estado.innerHTML = msg ? esc(msg) : '';
  }

  /* ── Lectura del archivo ─────────────────────────────────── */

  async function procesar(file) {
    if (!file) return;
    const nombre = file.name || 'archivo';
    const ext = nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
    if (!EXTENSIONES.includes(ext)) {
      decir('Formato no admitido (' + ext + '). Adjunte un archivo ' + EXTENSIONES.join(', ') + '.', 'warn');
      return;
    }

    decir('⋯ Leyendo ' + nombre + '…', 'info');
    let XLSX;
    try {
      XLSX = await cargarSheetJS();
    } catch (err) {
      decir(err.message, 'warn');
      return;
    }

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Se evalúa la primera hoja con contenido; si hay varias, se avisa.
      const hojas = wb.SheetNames || [];
      let usada = null;
      let matriz = [];
      for (const h of hojas) {
        const m = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, raw: false, defval: '' });
        if (m && m.length > 1) { usada = h; matriz = m; break; }
      }
      if (!usada) { decir('El archivo no tiene ninguna hoja con datos.', 'warn'); return; }

      ultimo = evaluarListado(matriz);
      ultimo.archivo = nombre;
      ultimo.hoja = usada;
      ultimo.hojas = hojas;
      filtro = null;
      pintar();

      if (ultimo.faltantes.length) {
        decir('Faltan columnas imprescindibles: ' + ultimo.faltantes.join(', ')
          + '. Sin ellas no se puede calcular la Unidad Constructiva.', 'warn');
      } else {
        decir(nombre + ' · hoja «' + usada + '» · ' + ultimo.filas.length + ' equipos evaluados'
          + (hojas.length > 1 ? ' (el archivo tiene ' + hojas.length + ' hojas; se evaluó la primera con datos)' : ''),
          'ok');
      }
    } catch (err) {
      decir('No se pudo leer el archivo: ' + err.message, 'warn');
    }
  }

  /* ── Pintado del resultado ───────────────────────────────── */

  function pintar() {
    if (!ultimo) { salida.innerHTML = ''; return; }
    const r = ultimo.resumen;

    let h = '<div class="ftm-kpis">'
      + tarjeta(r.total, 'Equipos evaluados', ultimo.descartadas ? ultimo.descartadas + ' filas vacías omitidas' : '', 'total')
      + tarjeta(r.concordantes, 'Concordantes', r.pctConcordantes + ' %', 'ok')
      + tarjeta(r.discrepancias, 'Discrepancias', 'requieren decisión', 'err')
      + tarjeta(r.faltaRegistro, 'Falta registro', 'sin UUCC en la fuente', 'falta')
      + tarjeta(r.sinCalculo, 'Sin cálculo', 'placa incompleta', 'sin')
      + '</div>';

    h += '<div class="ftm-eval-conf">Conformidad sobre los <b>' + r.evaluables + '</b> equipos '
      + 'con placa suficiente: <b>' + r.conformidad + ' %</b>. '
      + '<span class="ftm-eval-nota">Los equipos sin placa completa no cuentan como incumplimiento: '
      + 'son un vacío de datos, no una mala clasificación.</span></div>';

    // Filtros por estado
    h += '<div class="ftm-eval-filtros">'
      + botonFiltro(null, 'Todos', r.total)
      + botonFiltro(ESTADOS.DISCREPANCIA, 'Discrepancias', r.discrepancias)
      + botonFiltro(ESTADOS.FALTA_REGISTRO, 'Falta registro', r.faltaRegistro)
      + botonFiltro(ESTADOS.SIN_CALCULO, 'Sin cálculo', r.sinCalculo)
      + botonFiltro(ESTADOS.CONCORDANTE, 'Concordantes', r.concordantes)
      + '<span class="ftm-eval-acciones">'
      +   '<button type="button" class="ftm-btn" data-ftm="csv">Exportar CSV</button> '
      +   '<button type="button" class="ftm-btn ftm-btn--primary" data-ftm="xlsx">Exportar Excel</button>'
      + '</span></div>';

    const visibles = ordenarPorGravedad(
      filtro ? ultimo.filas.filter((f) => f.estado === filtro) : ultimo.filas
    );
    const recorte = visibles.slice(0, MAX_TABLA);

    h += '<div class="ftm-tabla-scroll"><table class="ftm-tabla ftm-flota">'
      + '<thead><tr>'
      + '<th>Fila</th><th>Subestación</th><th>Matrícula</th><th>kVA</th><th>MVA</th>'
      + '<th>V prim.</th><th>Nivel</th><th>Registrada</th><th>Calculada</th>'
      + '<th>Estado</th><th>Motivo</th>'
      + '</tr></thead><tbody>';

    if (!recorte.length) {
      h += '<tr><td colspan="11" class="ftm-eval-vacio">Sin equipos en esta categoría.</td></tr>';
    } else {
      for (const f of recorte) {
        const cls = CLASE_ESTADO[f.estado] || 'sin';
        h += '<tr class="' + (CLASE_FILA[f.estado] || '') + '">'
          + '<td>' + esc(f.fila) + '</td>'
          + '<td><b>' + esc(f.subestacion || '—') + '</b></td>'
          + '<td>' + esc(f.matricula || '—') + '</td>'
          + '<td>' + esc(f.potenciaKva || '—') + '</td>'
          + '<td>' + esc(f.mva != null ? f.mva : '—') + '</td>'
          + '<td>' + esc(f.kvPrim || '—') + '</td>'
          + '<td>' + esc(f.nivel || '—') + '</td>'
          + '<td>' + esc(f.uuccRegistrada || '—') + '</td>'
          + '<td>' + esc(f.uuccCalculada || '—') + '</td>'
          + '<td><span class="ftm-pill--' + cls + '">' + esc(f.estado) + '</span></td>'
          + '<td class="ftm-eval-motivo" title="' + esc((f.pasos || []).join(' · ')) + '">'
          +   esc(f.motivo) + '</td>'
          + '</tr>';
      }
    }
    h += '</tbody></table></div>';

    if (visibles.length > recorte.length) {
      h += '<div class="ftm-eval-nota">Se muestran ' + recorte.length + ' de ' + visibles.length
        + ' equipos para no saturar la pantalla; la exportación los lleva todos.</div>';
    }
    h += '<div class="ftm-eval-nota">Pase el cursor sobre el motivo para ver la traza del cálculo '
      + '(cómo se llegó a esa Unidad Constructiva).</div>';

    salida.innerHTML = h;
  }

  function botonFiltro(valor, etiqueta, n) {
    const activo = (filtro === valor) ? ' is-on' : '';
    return '<button type="button" class="ftm-btn ftm-eval-filtro' + activo + '" '
      + 'data-ftm="filtro" data-valor="' + esc(valor == null ? '' : valor) + '">'
      + esc(etiqueta) + ' <span class="ftm-eval-n">' + esc(n) + '</span></button>';
  }

  /* ── Exportación ─────────────────────────────────────────── */

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function nombreSalida(ext) {
    const base = (ultimo && ultimo.archivo ? ultimo.archivo.replace(/\.[^.]+$/, '') : 'listado');
    return 'Evaluacion_UUCC_' + base.replace(/[^\w-]+/g, '_') + '.' + ext;
  }

  function exportarCSV() {
    if (!ultimo) return;
    const filas = filasParaExportar(ordenarPorGravedad(ultimo.filas));
    const csv = filas.map((f) => f.map((c) => {
      const s = String(c == null ? '' : c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    // BOM para que Excel en español respete las tildes.
    descargar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), nombreSalida('csv'));
  }

  async function exportarXLSX() {
    if (!ultimo) return;
    let XLSX;
    try { XLSX = await cargarSheetJS(); } catch (err) { decir(err.message, 'warn'); return; }
    const filas = filasParaExportar(ordenarPorGravedad(ultimo.filas));
    const ws = XLSX.utils.aoa_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluación UUCC');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    descargar(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      nombreSalida('xlsx')
    );
  }

  /* ── Eventos ─────────────────────────────────────────────── */

  const onClickZona = () => input.click();
  const onTeclaZona = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  };
  const onCambio = (e) => { procesar(e.target.files && e.target.files[0]); e.target.value = ''; };
  const onDragOver = (e) => { e.preventDefault(); zona.classList.add('is-drag'); };
  const onDragLeave = () => zona.classList.remove('is-drag');
  const onDrop = (e) => {
    e.preventDefault(); zona.classList.remove('is-drag');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    procesar(f);
  };
  const onClickSalida = (e) => {
    const b = e.target.closest('[data-ftm]');
    if (!b) return;
    const q = b.getAttribute('data-ftm');
    if (q === 'filtro') {
      const v = b.getAttribute('data-valor');
      filtro = v === '' ? null : v;
      pintar();
    } else if (q === 'csv') { exportarCSV(); }
    else if (q === 'xlsx') { exportarXLSX(); }
  };

  zona.addEventListener('click', onClickZona);
  zona.addEventListener('keydown', onTeclaZona);
  input.addEventListener('change', onCambio);
  zona.addEventListener('dragover', onDragOver);
  zona.addEventListener('dragleave', onDragLeave);
  zona.addEventListener('drop', onDrop);
  salida.addEventListener('click', onClickSalida);

  return {
    resultado: () => ultimo,
    destruir() {
      zona.removeEventListener('click', onClickZona);
      zona.removeEventListener('keydown', onTeclaZona);
      input.removeEventListener('change', onCambio);
      zona.removeEventListener('dragover', onDragOver);
      zona.removeEventListener('dragleave', onDragLeave);
      zona.removeEventListener('drop', onDrop);
      salida.removeEventListener('click', onClickSalida);
      raiz.innerHTML = '';
    }
  };
}

export default montarEvaluacionMasiva;
