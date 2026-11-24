// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · «POR SUBSANAR» · DESCARGAR EXCEL
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): «que en las ODT por subsanar me permitas descargar un documento excel donde
// esté el detalle de cada ODT de lo que se necesita corregir para que esté conforme, sea control previo o registro
// fotográfico». Un bloque en la lista de «Por subsanar» (lo ve quien ve la pestaña: el administrador, todas; el AZT,
// las suyas, porque repoObs.listar y repoObs.leer ya traen solo lo que la sesión puede leer):
//   · «Descargar Excel» + casilla «Incluir las ya resueltas» (desmarcada: solo las ABIERTAS).
//   · Al pulsar: consulta la lista DEL SERVIDOR, lee cada ODT con sus puntos (de a LECTURAS_A_LA_VEZ, con el avance
//     «Preparando… n de N»), arma las dos hojas (domain/odt_afinia_obs_excel.js) y entrega
//     ODT_por_subsanar_AAAA-MM-DD.xlsx (fecha de Colombia). Si una lectura falla, NO se descarga nada (un Excel a
//     medias engañaría) y se dice cuál y por qué; el botón vuelve a quedar disponible.
//   · Cada hoja abre LISTA para filtrar: el encabezado en la fila 1 (sin título encima), el filtro en todo el rango,
//     anchos de columna razonables y las fechas como fechas.
//   · SheetJS 0.18.5 (la gratuita) no escribe estilos: cada texto va COMPLETO en su celda, pero sin «Ajustar texto»;
//     la explicación del bloque dice cómo activarlo en Excel.
// SheetJS 0.18.5 del CDN (el mismo de los demás Excel de SGM), con su huella SRI, solo cuando se pulsa el botón.
// El archivo lo entrega SheetJS (XLSX.writeFile): aquí no se crean enlaces a Blobs (L-107: eso vive en comun.js).
// Lectura, librería y entrega se pueden INYECTAR (las pruebas usan la SheetJS de node_modules y capturan el libro).
// por-subsanar.js carga este archivo con import() y pregunta si existe bloqueDescargaExcel (L-102): si no carga, la
// lista sigue igual. Archivo NUEVO a propósito (L-102): a comun.js y a domain/odt_afinia_obs.js solo les pide nombres
// que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, mensajeDe, aviso, vaciar } from './comun.js';
import { TOPES_OBS } from '../../domain/odt_afinia_obs.js';
import { armarHojas, obsParaExportar, nombreArchivoExcel } from '../../domain/odt_afinia_obs_excel.js';

export const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
/** SRI del mismo archivo (== node_modules/xlsx/dist/xlsx.full.min.js 0.18.5; la prueba estática lo compara). */
export const SHEETJS_SRI = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
/** Cuántas ODT se leen del servidor a la vez. */
export const LECTURAS_A_LA_VEZ = 4;

const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
/** El mensaje de un error con «Vuelva a intentarlo.» solo si no lo pide ya («…inténtelo de nuevo.», «Recargue…»). */
const conReintento = (m) => {
  const t = String(m || '').trim();
  const conPunto = /[.!?]$/.test(t) ? t : t + '.';
  return /int[eé]nt(?:elo|arlo)|recargue/i.test(t) ? conPunto : conPunto + ' Vuelva a intentarlo.';
};
export const TEXTOS_EXCEL = Object.freeze({
  boton: 'Descargar Excel',
  casilla: 'Incluir las ya resueltas',
  explicacion: 'Un archivo de Excel con una fila por punto: qué hay que corregir en cada ODT y en qué documento (control previo, '
    + 'registro fotográfico u ODT). Abre listo para filtrar. Sin marcar la casilla, solo trae las ODT abiertas. '
    + 'Lo que hay que corregir va completo en la última columna.',
  consultando: 'Consultando las ODT por subsanar…',
  preparando: (n, total) => 'Preparando… ' + n + ' de ' + total,
  armando: 'Armando el archivo de Excel…',
  listo: (nombre, odts, puntos) => 'Listo: se descargó «' + nombre + '» con ' + plural(odts, 'ODT', 'ODT') + ' y ' + plural(puntos, 'punto', 'puntos') + '.',
  tope: ' Solo trae las ' + TOPES_OBS.listado + ' ODT más recientes de la lista.',
  sinNada: 'No hay ODT por subsanar para descargar.',
  sinAbiertas: (resueltas) => 'No hay ODT abiertas por subsanar. Hay ' + plural(resueltas, 'ODT resuelta', 'ODT resueltas')
    + ': marque «Incluir las ya resueltas» para ' + (resueltas === 1 ? 'descargarla.' : 'descargarlas.'),
  sinLector: 'No se pudo descargar el lector de Excel. Revise la conexión y vuelva a intentarlo.',
  error: (m) => 'No se pudo preparar el Excel y no se descargó nada. ' + conReintento(m),
  errorObs: (nro, m) => 'No se pudo leer la ODT N.º ' + nro + ' del servidor y no se descargó nada. ' + conReintento(m)
});

// ── SheetJS (solo al pulsar el botón) ──────────────────────────────────────────
let _sheetjs = null;
/** SheetJS 0.18.5 del CDN con su SRI (una sola vez por página; si falla, se puede reintentar). */
export function cargarSheetJS() {
  if (typeof window !== 'undefined' && window.XLSX) return Promise.resolve(window.XLSX);
  if (_sheetjs) return _sheetjs;
  _sheetjs = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SHEETJS_CDN; s.integrity = SHEETJS_SRI; s.crossOrigin = 'anonymous'; s.async = true;
    s.onload = () => { if (window.XLSX) res(window.XLSX); else { _sheetjs = null; rej(new Error(TEXTOS_EXCEL.sinLector)); } };
    s.onerror = () => { _sheetjs = null; rej(new Error(TEXTOS_EXCEL.sinLector)); };
    document.head.appendChild(s);
  });
  return _sheetjs;
}

/**
 * El libro de SheetJS de las hojas armadas por el dominio: encabezado en la fila 1, filtro en TODO el rango
 * (A1 hasta la última columna y la última fila), anchos de columna y formato de fecha en las columnas de fecha.
 * @param {object} XLSX  la librería SheetJS
 * @param {Array<{nombre:string, columnas:Array<{titulo:string, ancho:number, formato?:string}>, filas:Array<Array>}>} hojas
 */
export function armarLibro(XLSX, hojas) {
  const wb = XLSX.utils.book_new();
  for (const hoja of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas);
    hoja.columnas.forEach((col, c) => {
      if (!col.formato) return;
      for (let r = 1; r < hoja.filas.length; r++) {
        const celda = ws[XLSX.utils.encode_cell({ r, c })];
        if (celda && celda.t === 'n') celda.z = col.formato;
      }
    });
    const rango = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(hoja.filas.length - 1, 0), c: hoja.columnas.length - 1 } });
    ws['!ref'] = rango;
    ws['!autofilter'] = { ref: rango };
    ws['!cols'] = hoja.columnas.map((col) => ({ wch: col.ancho }));
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre);
  }
  return wb;
}

/** Entrega el libro como .xlsx (SheetJS arma el archivo y lo descarga en el navegador). */
export function entregarLibro(XLSX, wb, nombre) {
  XLSX.writeFile(wb, nombre, { bookType: 'xlsx', compression: true });
}

/**
 * Lee del servidor cada obs con sus puntos, de a `aLaVez`, en el MISMO orden de `lista`.
 * Si una falla, lanza un Error con el N.º de esa ODT y no sigue pidiendo las demás.
 * @param {{leer:(id:string)=>Promise<{obs:object, puntos:Array}>}} repoObs
 * @param {Array<{id:string, nro?:string}>} lista
 * @param {{aLaVez?:number, alAvanzar?:(hechas:number, total:number)=>void}} [op]
 */
export async function leerRegistros(repoObs, lista, { aLaVez = LECTURAS_A_LA_VEZ, alAvanzar } = {}) {
  const out = new Array(lista.length);
  let siguiente = 0; let hechas = 0; let fallo = null;
  async function trabajador() {
    while (!fallo && siguiente < lista.length) {
      const i = siguiente++;
      try {
        out[i] = await repoObs.leer(lista[i].id);
      } catch (e) {
        if (!fallo) fallo = { obs: lista[i], e };
        return;
      }
      hechas++;
      if (typeof alAvanzar === 'function') alAvanzar(hechas, lista.length);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(aLaVez, lista.length)) }, trabajador));
  if (fallo) throw new Error(TEXTOS_EXCEL.errorObs(fallo.obs.nro || '—', mensajeDe(fallo.e)));
  return out;
}

/**
 * Todo el camino del botón: lista del servidor → lectura de cada ODT → hojas → libro → entrega.
 * @returns {Promise<{descargado:boolean, mensaje:string, nombre?:string, odts?:number, puntos?:number}>}
 */
export async function descargarExcel({ repoObs, incluirResueltas = false, cargarXlsx = cargarSheetJS, entregar = entregarLibro,
  ahora = () => new Date(), aLaVez = LECTURAS_A_LA_VEZ, alEstado = () => {} } = {}) {
  // La librería se pide desde ya (en paralelo con las lecturas); su error se atiende al usarla.
  const lector = Promise.resolve().then(() => cargarXlsx());
  lector.catch(() => {});
  alEstado(TEXTOS_EXCEL.consultando);
  const { lista = [], tope = false } = await repoObs.listar();
  const elegidas = obsParaExportar(lista, { incluirResueltas });
  if (!elegidas.length) {
    const resueltas = obsParaExportar(lista, { incluirResueltas: true }).length;
    return { descargado: false, mensaje: !incluirResueltas && resueltas ? TEXTOS_EXCEL.sinAbiertas(resueltas) : TEXTOS_EXCEL.sinNada };
  }
  alEstado(TEXTOS_EXCEL.preparando(0, elegidas.length));
  const registros = await leerRegistros(repoObs, elegidas, { aLaVez, alAvanzar: (n, total) => alEstado(TEXTOS_EXCEL.preparando(n, total)) });
  const { hojas, odts, puntos } = armarHojas(registros, { incluirResueltas });
  alEstado(TEXTOS_EXCEL.armando);
  let XLSX;
  try { XLSX = await lector; } catch (_) { throw new Error(TEXTOS_EXCEL.sinLector); }
  const nombre = nombreArchivoExcel(ahora());
  await entregar(XLSX, armarLibro(XLSX, hojas), nombre);
  return { descargado: true, nombre, odts, puntos, mensaje: TEXTOS_EXCEL.listo(nombre, odts, puntos) + (tope ? TEXTOS_EXCEL.tope : '') };
}

/**
 * El bloque «Descargar Excel» de la lista de «Por subsanar».
 * @param {{repoObs:object, cargarXlsx?:Function, entregar?:Function, ahora?:()=>Date, aLaVez?:number}} p
 *   repoObs: el de la sesión (exporta lo que ella puede leer); lo demás, inyectable (pruebas)
 * @returns {HTMLElement}
 */
export function bloqueDescargaExcel({ repoObs, cargarXlsx, entregar, ahora, aLaVez } = {}) {
  const idCasilla = 'odtObsExcelResueltas';
  const casilla = h('input', { type: 'checkbox', id: idCasilla, class: 'odt-casilla' });
  casilla.checked = false;                    // por defecto, solo las abiertas
  // Botón secundario (blanco): no compite con «Registrar ODT por subsanar», la acción principal del administrador.
  const btn = h('button', { type: 'button', class: 'odt-btn', text: TEXTOS_EXCEL.boton });
  // Como la otra descarga del módulo (detalle.js): el avance en texto; el resultado y los errores, con su color (aviso).
  const st = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
  const mostrar = (texto, tipo) => { vaciar(st); st.appendChild(aviso(texto, tipo)); };
  let ocupado = false;
  btn.addEventListener('click', async () => {
    if (ocupado) return;
    // Al deshabilitarse, el botón pierde el foco: si lo tenía (se pulsó con el teclado), se le devuelve al terminar.
    const teniaFoco = typeof document !== 'undefined' && document.activeElement === btn;
    ocupado = true; btn.disabled = true; casilla.disabled = true;
    st.setAttribute('aria-busy', 'true');       // el lector de pantalla anuncia el final, no cada «n de N»
    try {
      const r = await descargarExcel({
        repoObs, incluirResueltas: casilla.checked === true, cargarXlsx, entregar, ahora, aLaVez,
        alEstado: (t) => { st.textContent = t; }
      });
      mostrar(r.mensaje, r.descargado ? 'ok' : 'info');
    } catch (e) {
      const m = mensajeDe(e);
      mostrar(/^No se (pudo leer la ODT|pudo descargar el lector)/.test(m) ? m : TEXTOS_EXCEL.error(m), 'error');
    } finally {
      ocupado = false; btn.disabled = false; casilla.disabled = false;
      st.setAttribute('aria-busy', 'false');
      if (teniaFoco && typeof btn.focus === 'function') { try { btn.focus({ preventScroll: true }); } catch (_) { /* sin foco: no pasa nada */ } }
    }
  });
  return h('section', { class: 'odt-obs-excel', 'aria-label': 'Descargar en Excel' },
    h('div', { class: 'odt-acciones' }, btn,
      h('label', { class: 'odt-obs-excel-opcion', htmlFor: idCasilla }, casilla, TEXTOS_EXCEL.casilla)),
    h('p', { class: 'odt-mini', text: TEXTOS_EXCEL.explicacion }),
    st);
}
