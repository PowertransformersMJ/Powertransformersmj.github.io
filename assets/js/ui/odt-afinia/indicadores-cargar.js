// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «CARGAR UN CORTE» (#indicadores-cargar, solo admin)
// ──────────────────────────────────────────────────────────────────────────────
// 1) Se elige el .csv del «Informe Seguimiento de Órdenes de Trabajo» de Afinia. Se lee EN EL NAVEGADOR (no se
//    sube el archivo: se guardan solo los números y las ODT del responsable elegido), por pasos y con «Leyendo…»
//    y su avance, para no congelar la pantalla con archivos grandes (decenas de MB).
// 2) Vista previa: filas, ODT distintas, responsables con su conteo, el responsable del corte (por defecto el del
//    perfil del administrador si aparece en el archivo), la fecha de sus datos, su rango de fechas previstas, sus
//    totales y su tabla por contratista, la huella SHA-256 del archivo y los avisos de filas raras (columnas de más
//    o de menos, filas partidas, N.º con estados distintos o con dos responsables, estados desconocidos…).
//    Con el servidor se revisa además si ESE archivo ya se guardó para ese responsable (por su huella, en todos los
//    cortes, no solo en los 50 del historial) y si trae datos más viejos que el último corte de ese responsable.
//    Un archivo que no es el informe de Afinia (p. ej. abierto y guardado en Excel, que cambia la «|» por «;») se
//    dice así, sin pintar filas ni responsables en cero.
// 3) «Guardar corte» en DOS pasos («Guardar corte» → «Sí, guardar el corte»), como el resto del módulo; un lote que
//    no responde a tiempo («NO repita») no vuelve a ofrecer el botón y se espera su desenlace. Al guardar, abre el
//    corte guardado.
// El selector del responsable se crea UNA vez por archivo (cambiarlo solo repinta lo de abajo: el foco no se pierde);
// el foco pasa a «Sí, guardar el corte» al pedir confirmación y vuelve a «Guardar corte» con «Cancelar». Mientras se
// lee, el campo del archivo queda deshabilitado (y el navegador le quita el foco): al terminar, el foco pasa al
// título «Vista previa» (o al mensaje de error), no al principio de la página.
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían (comun.js: h,
// vaciar, aviso, mensajeDe, fechaHora; domain/odt_afinia_partes.js: huella).
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe, fechaHora } from './comun.js';
import { huella } from '../../domain/odt_afinia_partes.js';
import {
  decodificar, leerCsvPorPasos, analizarResponsable, buscarResponsable, avisosDeLectura, normalizarNombre,
  textoCierre, fechaDMA, ETIQUETA_CLAVE, TOPES_CORTE, esOtroArchivo, MSG_OTRO_ARCHIVO, fechaDatosDe, fechaDatosDeCorte,
  textoFechaDatos, corteMasReciente
} from '../../domain/odt_afinia_indicadores.js';

const num = (n) => Number(n || 0).toLocaleString('es-CO');
const mb = (n) => (Number(n || 0) / 1048576).toFixed(1).replace('.', ',') + ' MB';
/** Deja respirar al navegador entre pasos de la lectura. */
const pausaNavegador = () => new Promise((r) => setTimeout(r, 0));
const sigueEn = (nodo, contenedor) => { for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true; return false; };
const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
const dato = (t, v, attrs = {}) => h('div', { class: 'odt-dato' }, h('dt', { text: t }), h('dd', { ...attrs, text: v }));
/** Las columnas de la tabla por contratista de la vista previa (las mismas de la vista de un corte; «Otro estado» solo si hay). */
const COLS_PREVIA = Object.freeze(['total', 'generada', 'ejecutada', 'noEjecutada', 'cerrada', 'inactiva']);

export const AYUDA_DESCARGA = 'En Afinia: Reportes → «Informe Seguimiento de Órdenes de Trabajo» → Nro. de registros: Todos → fechas previstas del 01/01/2026 a hoy → descargar en CSV (INFORME_ODT_….csv). El archivo se lee aquí, en su navegador: no se sube; se guardan solo los números y las ODT del responsable que elija.';
/** Si el archivo no viene en la codificación de letras de Afinia (latin-1): se dice en llano, sin el nombre técnico. */
export const AVISO_OTRO_PROGRAMA = 'El archivo no viene tal como lo entrega Afinia (parece guardado de nuevo en otro programa). Se leyó igual: revise que los nombres con tildes se vean bien.';

/**
 * @param {HTMLElement} contenedor
 * @param {{repoCortes:object, sesion:object, historial?:object[], alIr:(ancla:string, mensaje?:string)=>void,
 *          pausa?:()=>Promise<void>, calcularHuella?:(bytes:Uint8Array)=>Promise<string>}} p
 *   pausa y calcularHuella: inyectables (pruebas); la página usa setTimeout 0 y la SHA-256 del módulo.
 */
export function montarCargar(contenedor, { repoCortes, sesion, historial = [], alIr, pausa = pausaNavegador, calcularHuella = huella }) {
  vaciar(contenedor);
  contenedor.appendChild(h('div', { class: 'odt-acciones' },
    h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: '← Volver a los indicadores', onclick: () => alIr('indicadores') })));
  contenedor.appendChild(h('h2', { class: 'odt-subtitulo odt-ind-titulo', tabindex: '-1', text: 'Cargar un corte de indicadores' }));
  contenedor.appendChild(h('p', { class: 'odt-mini', text: AYUDA_DESCARGA }));
  if (!sesion || !sesion.esAdmin || sesion.legacy) {
    contenedor.appendChild(aviso(sesion && sesion.legacy ? 'Su cuenta de administrador no tiene perfil en la plataforma: créelo antes de guardar cortes.' : 'Solo un administrador carga cortes de indicadores.', 'aviso'));
    return null;
  }

  const entrada = h('input', { id: 'odtIndArchivo', class: 'odt-campo', type: 'file', accept: '.csv,text/csv' });
  const st = h('div', { class: 'odt-estado odt-ind-estado', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const previa = h('div', { class: 'odt-ind-previa' });
  const btnGuardar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Guardar corte' });
  const btnSi = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, guardar el corte' });
  const btnNo = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
  const lineaConfirmar = h('p', { class: 'odt-parrafo' });
  // Contenedores sin `display` propio (o la caja .odt-confirmar): `hidden` sí los esconde en el navegador.
  const pasoGuardar = h('div', { hidden: true }, h('div', { class: 'odt-acciones' }, btnGuardar));
  const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar el corte', hidden: true },
    lineaConfirmar, h('div', { class: 'odt-acciones' }, btnSi, btnNo));
  contenedor.append(
    h('div', { class: 'odt-bloque' }, h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtIndArchivo', text: 'Archivo CSV del informe de Afinia' }), entrada)),
    st, previa, pasoGuardar, caja);

  /** Lo leído: {archivo:{nombre, bytes, sha256}, codificacion, lectura}; y lo que se guardaría: {archivo, lectura, analisis}. */
  let leido = null;
  let listo = null;
  let leyendo = false;
  let guardando = false;
  /** Sube con cada archivo elegido: una lectura (o una consulta) vieja que termina tarde no pinta encima de la nueva. */
  let version = 0;
  /** Del servidor: los cortes ya guardados con la huella de este archivo (null = no se sabe) y el último de cada responsable. */
  let yaGuardados = null;
  const ultimos = new Map();
  /** Lo que se repinta al cambiar de responsable (el selector queda fuera: no pierde el foco). */
  let selResp = null;
  let zonaAnalisis = null;
  let zonaServidor = null;
  let analisisActual = null;

  const ocultarGuardar = () => { listo = null; pasoGuardar.hidden = true; caja.hidden = true; };

  async function leerArchivo(archivo) {
    if (guardando) return;
    const miVersion = ++version;
    ocultarGuardar(); leido = null; analisisActual = null; yaGuardados = null; ultimos.clear();
    vaciar(previa); vaciar(st);
    if (!archivo) return;
    leyendo = true; entrada.disabled = true;
    const estado = h('p', { class: 'odt-cargando', text: 'Leyendo el archivo…' });
    st.appendChild(estado);
    try {
      if (!/\.csv$/i.test(String(archivo.name || ''))) st.appendChild(aviso('El archivo no termina en .csv: se intenta leer igual.', 'aviso'));
      if (!(archivo.size > 0)) throw new Error('El archivo está vacío.');
      if (archivo.size > TOPES_CORTE.archivoBytesMax) throw new Error('El archivo pesa ' + mb(archivo.size) + ': el máximo es ' + mb(TOPES_CORTE.archivoBytesMax) + '.');
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (miVersion !== version) return;
      estado.textContent = 'Leyendo… calculando la huella del archivo.';
      const sha256 = await calcularHuella(bytes);
      if (miVersion !== version) return;
      estado.textContent = 'Leyendo… 0 %';
      await pausa();
      const { texto, codificacion } = decodificar(bytes);
      const lectura = await leerCsvPorPasos(texto, {
        pausa, cada: 3000, alAvance: (f) => { estado.textContent = 'Leyendo… ' + Math.round(f * 100) + ' %'; }
      });
      if (miVersion !== version) return;
      leido = { archivo: { nombre: String(archivo.name || 'archivo.csv'), bytes: bytes.length, sha256 }, codificacion, lectura };
      vaciar(st);
      pintarPrevia();
      if (lectura.ok) consultarHuella(miVersion, sha256);
    } catch (e) {
      if (miVersion !== version) return;
      vaciar(st); st.appendChild(aviso('No se pudo leer el archivo: ' + mensajeDe(e), 'error'));
    } finally {
      if (miVersion === version) {
        leyendo = false; entrada.disabled = false;
        // Al deshabilitarse, el campo perdió el foco (quedó en la página): pasa al resultado de la lectura.
        if (focoPerdido()) enfocar(previa.querySelectorAll('.odt-ind-previa-titulo')[0] || (st.firstChild ? st : entrada));
      }
    }
  }
  /** ¿El foco quedó en ningún sitio (en el cuerpo de la página)? Si la persona lo llevó a otra parte, no se toca. */
  function focoPerdido() {
    const d = globalThis.document;
    const a = d && d.activeElement;
    return !a || a === d.body;
  }
  entrada.addEventListener('change', () => leerArchivo(entrada.files && entrada.files[0]));

  /** Los cortes ya guardados con la huella de este archivo (cualquier responsable; no depende del historial de 50). */
  function consultarHuella(miVersion, sha256) {
    if (!repoCortes || typeof repoCortes.porHuella !== 'function') return;
    Promise.resolve().then(() => repoCortes.porHuella(sha256))
      .then((xs) => { if (miVersion === version) { yaGuardados = Array.isArray(xs) ? xs : []; pintarServidor(); } }, () => { /* sin red: queda el historial */ });
  }
  /** El último corte guardado del responsable (con su propia consulta; si falla, lo que diga el historial). */
  function consultarUltimo(analisis) {
    const k = analisis.clave;
    if (ultimos.has(k) || !repoCortes || typeof repoCortes.ultimoDe !== 'function') return;
    const miVersion = version;
    ultimos.set(k, null);
    Promise.resolve().then(() => repoCortes.ultimoDe(analisis.responsable))
      .then((c) => { if (miVersion === version) { ultimos.set(k, c || null); pintarServidor(); } }, () => { /* sin red: queda el historial */ });
  }

  /** La vista previa del archivo (una vez por archivo) y la del responsable del perfil, si aparece. */
  function pintarPrevia() {
    ocultarGuardar(); vaciar(previa); selResp = null; zonaAnalisis = null; zonaServidor = null; analisisActual = null;
    if (!leido) return;
    const { archivo, lectura } = leido;
    previa.appendChild(h('h3', { class: 'odt-subtitulo odt-ind-previa-titulo', tabindex: '-1', text: 'Vista previa' }));
    if (!lectura.ok) {
      previa.appendChild(h('dl', { class: 'odt-datos odt-datos--fila' },
        dato('Archivo', archivo.nombre, { class: 'odt-romper' }),
        dato('Tamaño', mb(archivo.bytes))));
      previa.appendChild(aviso(esOtroArchivo(lectura)
        ? MSG_OTRO_ARCHIVO
        : 'Al archivo le faltan columnas que se necesitan: ' + lectura.faltan.join(', ') + '. Descargue el «Informe Seguimiento de Órdenes de Trabajo» completo (con todas sus columnas).', 'error'));
      return;
    }
    previa.appendChild(h('dl', { class: 'odt-datos odt-datos--fila' },
      dato('Archivo', archivo.nombre, { class: 'odt-romper' }),
      dato('Tamaño', mb(archivo.bytes)),
      dato('Huella SHA-256 (identifica este archivo exacto)', archivo.sha256, { class: 'odt-mono odt-romper' }),
      dato('Filas leídas', num(lectura.filas)),
      dato('ODT distintas en el archivo', num(lectura.odtsArchivo)),
      dato('Responsables O.D.T.', num(lectura.responsables.length))));
    // ── El responsable del corte (el selector se crea una sola vez por archivo) ──
    const dePerfil = buscarResponsable(lectura, sesion.nombre);
    const sel = h('select', { id: 'odtIndResponsable', class: 'odt-campo' },
      h('option', { value: '', text: 'Elija el responsable…' }),
      lectura.responsables.map((r) => h('option', { value: r.clave, text: r.nombre + ' · ' + num(r.odts) + ' ODT' })));
    sel.value = dePerfil ? dePerfil.clave : '';
    selResp = sel;
    sel.addEventListener('change', () => { if (!guardando) pintarAnalisis(sel.value); });
    previa.appendChild(h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtIndResponsable', text: 'Responsable O.D.T. del corte' }), sel));
    if (!dePerfil) {
      previa.appendChild(aviso('Su nombre de perfil' + (sesion.nombre ? ' («' + sesion.nombre + '»)' : '') + ' no aparece como RESPONSABLE O.D.T. en el archivo: elija el responsable de la lista.', 'aviso'));
    }
    previa.appendChild(h('details', { class: 'odt-detalles' },
      h('summary', { text: 'Responsables del archivo (' + num(lectura.responsables.length) + ')' }),
      h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla' },
        h('caption', { class: 'odt-oculto', text: 'Responsables del archivo' }),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Responsable O.D.T.' }), h('th', { scope: 'col', class: 'odt-ind-n', text: 'Filas' }), h('th', { scope: 'col', class: 'odt-ind-n', text: 'ODT' }))),
        h('tbody', {}, lectura.responsables.map((r) => h('tr', {},
          h('th', { scope: 'row', text: r.nombre }), h('td', { class: 'odt-ind-n', text: num(r.filas) }), h('td', { class: 'odt-ind-n', text: num(r.odts) }))))))));
    zonaAnalisis = h('div', { class: 'odt-ind-analisis' });
    previa.appendChild(zonaAnalisis);
    pintarAnalisis(sel.value);
  }

  /** Lo del responsable elegido (clave normalizada; '' = ninguno): datos, totales, tabla, avisos y el paso de guardar. */
  function pintarAnalisis(clave) {
    ocultarGuardar();
    if (!leido || !zonaAnalisis) return;
    vaciar(zonaAnalisis);
    const { archivo, codificacion, lectura } = leido;
    const analisis = clave ? analizarResponsable(lectura, clave) : null;
    analisisActual = analisis;
    const avisos = avisosDeLectura(lectura, analisis);
    if (codificacion !== 'ISO-8859-1') avisos.unshift(AVISO_OTRO_PROGRAMA);
    if (analisis) {
      const t = analisis.totales;
      // Con estados que la página no conoce, su columna (si no, las filas no suman el total).
      const cols = t.otro > 0 ? [...COLS_PREVIA, 'otro'] : COLS_PREVIA;
      zonaAnalisis.appendChild(h('h4', { class: 'odt-ind-h4', text: analisis.responsable }));
      zonaAnalisis.appendChild(h('dl', { class: 'odt-datos odt-datos--fila' },
        dato('Fecha de los datos', textoFechaDatos({ archivo: { nombre: archivo.nombre }, rango: analisis.rango })),
        dato('Filas del responsable', num(analisis.filasResponsable)),
        dato('ODT distintas', num(analisis.odts.length) + (analisis.repetidas ? ' (' + num(analisis.repetidas) + ' filas repetidas de la misma ODT)' : '')),
        dato('Fechas previstas', 'del ' + fechaDMA(analisis.rango.desde) + ' al ' + fechaDMA(analisis.rango.hasta)),
        dato(ETIQUETA_CLAVE.generada, num(t.generada)),
        dato(ETIQUETA_CLAVE.ejecutada, num(t.ejecutada)),
        dato(ETIQUETA_CLAVE.cerrada, num(t.cerrada)),
        dato(ETIQUETA_CLAVE.noEjecutadaInactiva, num(t.noEjecutada + t.inactiva)),
        t.otro ? dato(ETIQUETA_CLAVE.otro, num(t.otro)) : null,
        dato('% de cierre', textoCierre(t))));
      zonaAnalisis.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas' },
        h('caption', { class: 'odt-ind-caption', text: 'Por contratista' }),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Contratista' }),
          cols.map((k) => h('th', { scope: 'col', class: 'odt-ind-n', text: ETIQUETA_CLAVE[k] })),
          h('th', { scope: 'col', class: 'odt-ind-n', text: '% de cierre' }))),
        h('tbody', {}, analisis.porEmpresa.map((f) => h('tr', {},
          h('th', { scope: 'row', text: f.clave }),
          cols.map((k) => h('td', { class: 'odt-ind-n', 'data-etq': ETIQUETA_CLAVE[k], text: num(f[k]) })),
          h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(f) })))),
        h('tfoot', {}, h('tr', { class: 'odt-ind-total' }, h('th', { scope: 'row', text: 'Total' }),
          cols.map((k) => h('td', { class: 'odt-ind-n', 'data-etq': ETIQUETA_CLAVE[k], text: num(t[k]) })),
          h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(t) }))))));
    }
    if (avisos.length) {
      zonaAnalisis.appendChild(h('div', { class: 'odt-aviso odt-aviso--aviso', role: 'status' },
        h('strong', { text: 'Avisos de la lectura' }),
        h('ul', { class: 'odt-ind-avisos' }, avisos.map((x) => h('li', { text: x })))));
    } else if (analisis) {
      zonaAnalisis.appendChild(aviso('Sin filas raras: todas las filas traen las ' + lectura.columnas + ' columnas y cada ODT un solo estado.', 'ok'));
    }
    zonaServidor = h('div', { class: 'odt-ind-avisos-guardado' });
    zonaAnalisis.appendChild(zonaServidor);
    if (!analisis) return;
    if (!analisis.odts.length) { zonaAnalisis.appendChild(aviso('El responsable elegido no tiene ODT en el archivo: no hay corte que guardar.', 'aviso')); return; }
    if (!analisis.rango.desde) { zonaAnalisis.appendChild(aviso('Ninguna ODT del responsable trae una fecha prevista legible: no se puede fechar el corte.', 'error')); return; }
    pintarServidor();
    consultarUltimo(analisis);
    listo = { archivo: { ...archivo }, lectura, analisis };
    lineaConfirmar.textContent = 'Se guarda el corte de ' + analisis.responsable + ': ' + num(analisis.odts.length) + ' ODT (' + num(analisis.totales.cerrada) + ' cerradas), con datos del ' + textoFechaDatos({ archivo: { nombre: archivo.nombre }, rango: analisis.rango }) + ' y la huella del archivo. Un corte no se modifica ni se borra después.';
    pasoGuardar.hidden = false;
  }

  /** Lo que se sabe del historial guardado: el mismo archivo ya guardado y datos más viejos que el último corte. */
  function pintarServidor() {
    if (!zonaServidor || !leido || !analisisActual || !analisisActual.odts.length) return;
    vaciar(zonaServidor);
    const a = analisisActual;
    const { archivo } = leido;
    const conocidos = [...(yaGuardados || []), ...(historial || [])].filter((x) => x && x.archivo);
    const repetido = conocidos.find((x) => x.archivo.sha256 === archivo.sha256 && normalizarNombre(x.responsable) === a.clave);
    if (repetido) zonaServidor.appendChild(aviso('Este mismo archivo ya se guardó como corte de este responsable el ' + fechaHora(repetido.creadoEnMs) + '. Si lo guarda otra vez, quedan dos cortes iguales en el historial.', 'aviso'));
    const ultimo = corteMasReciente([ultimos.get(a.clave), ...(historial || [])].filter(Boolean), a.responsable);
    const fdArchivo = fechaDatosDe(archivo.nombre, a.rango).valor;
    const fdUltimo = ultimo ? fechaDatosDeCorte(ultimo) : '';
    if (fdArchivo && fdUltimo && fdArchivo < fdUltimo) {
      zonaServidor.appendChild(aviso('Este archivo trae datos del ' + textoFechaDatos({ archivo: { nombre: archivo.nombre }, rango: a.rango })
        + ', más viejos que el último corte guardado de este responsable (datos del ' + textoFechaDatos(ultimo) + '). Puede guardarlo para completar el historial: queda en su fecha y no pasa a ser el último corte.', 'aviso'));
    }
  }

  btnGuardar.addEventListener('click', () => {
    if (guardando || leyendo || !listo || pasoGuardar.hidden) return;
    pasoGuardar.hidden = true; caja.hidden = false;
    enfocar(btnSi);
  });
  btnNo.addEventListener('click', () => {
    if (guardando) return;
    caja.hidden = true;
    if (listo) { pasoGuardar.hidden = false; enfocar(btnGuardar); }
  });
  btnSi.addEventListener('click', async () => {
    if (guardando || leyendo || !listo || caja.hidden) return;
    // La copia de lo validado: elegir otro archivo o responsable mientras se guarda no la cambia.
    const envio = listo;
    const liberar = () => { guardando = false; btnSi.disabled = false; btnNo.disabled = false; entrada.disabled = false; };
    guardando = true; btnSi.disabled = true; btnNo.disabled = true; entrada.disabled = true;
    vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Guardando el corte…' }));
    const hecho = 'Corte guardado: ' + envio.analisis.responsable + ', ' + num(envio.analisis.odts.length) + ' ODT.';
    try {
      const r = await repoCortes.guardar(envio);
      alIr('indicadores=' + r.id, hecho);
    } catch (e) {
      const pendiente = !!e && e.codigo === 'pendiente';
      vaciar(st); st.appendChild(aviso(mensajeDe(e), pendiente ? 'aviso' : 'error'));
      enfocar(st);
      // «NO repita»: el botón sigue bloqueado hasta saber el desenlace del lote; si entró, se abre el corte.
      if (pendiente && e.final && typeof e.final.then === 'function') {
        e.final.then(() => { if (sigueEn(st, contenedor)) alIr('indicadores=' + e.id, hecho); },
          (x) => { if (!sigueEn(st, contenedor)) return; vaciar(st); st.appendChild(aviso(mensajeDe(x), 'error')); liberar(); }).catch(() => {});
        return;
      }
      if (pendiente) return;
      liberar();
    }
  });

  /** Elegir el responsable desde fuera (como si se eligiera en la lista). */
  const elegir = (clave) => { if (guardando) return; if (selResp) selResp.value = clave; pintarAnalisis(clave); };
  return { leerArchivo, elegir, estado: () => ({ leido, listo, leyendo, guardando }) };
}
