// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · una ODT: datos, constancia y acciones
// ──────────────────────────────────────────────────────────────────────────────
// Se lee SIEMPRE del servidor y el original se verifica por huella antes de
// mostrar nada (si no cuadra, no se muestra ni se firma). Acciones según el turno:
//   · Firmar (si le toca) y «No firmo: devolver con motivo» (una devolución por turno);
//   · Descargar (si está LISTA o CERRADA): componer → huella → registrar → entregar ESE Blob;
//   · Anular (administrador, con motivo, SOLO desde PENDIENTE_AZT o PENDIENTE_RESPONSABLE:
//     una ODT LISTA no se anula, D6 del 20-11);
//   · Reemplazar (administrador, con motivo y confirmación en dos pasos, SOLO una LISTA;
//     2026-11-21, revierte D6 con su visto bueno): queda REEMPLAZADA, nada se borra y su
//     N.º se puede volver a publicar;
//   · Registrar cierre en Afinia (administrador, fecha y soporte, confirmación; SOLO una
//     LISTA): queda CERRADA y «reposa» en la página (final).
// Una REEMPLAZADA muestra su motivo; una CERRADA, «Cerrada en Afinia el … · soporte … ·
// registró …»; una ODT publicada sobre un N.º liberado, «Reemplaza a la versión publicada el …».
// Lo nuevo sale de domain/odt_afinia_cierre.js (archivo nuevo) y, si el repositorio quedó
// viejo en la caché (sin reemplazar / registrarCierreAfinia), se pide recargar (L-102).
// Salidas del documento (L-107): la vista en pantalla (verificada contra la huella
// que vieron los firmantes; no se imprime: CSS @media print; sin menú contextual ni
// arrastre en los lienzos) y la descarga registrada. No hay otra.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ROL, TOPES, idDevolucion } from '../../domain/odt_afinia_rutas.js';
import { ETIQUETA_ESTADO, esMiTurno, rolDe, puedeAnular } from '../../domain/odt_afinia_estados.js';
import { fechaBogota } from '../../domain/odt_afinia_textos.js';
import {
  ESTADOS_CIERRE, SOPORTE, MSG_RECARGAR, etiquetaEstado, puedeDescargar, puedeReemplazar, puedeCerrarAfinia,
  textoCierreAfinia, errorCierreAfinia
} from '../../domain/odt_afinia_cierre.js';
import { h, vaciar, aviso, mensajeDe, cargarPdfLib, entregarBlob, huellaCorta, fechaHora } from './comun.js';
import { constancia } from './constancia.js';
import { montarFirmar } from './firmar.js';
import { descargarOdt, componerParaVer } from './preparar.js';
import { pintarPdf } from './vista-pdf.js';

/** Qué se muestra en «Ver la ODT en pantalla», según cuántas firmas se comprobaron. */
const TITULO_VISTA = Object.freeze([
  'El original publicado, sin firmas (no se imprime desde aquí)',
  'Con la firma del AZT, comprobada contra lo que él vio (no se imprime desde aquí)',
  'Con las dos firmas, comprobada contra lo que vio el Responsable (para entregarla, use «Descargar»)'
]);
/** Con las dos firmas pero sin «Descargar» (una REEMPLAZADA): se conserva para consultarla, no se entrega. */
const TITULO_VISTA_SIN_DESCARGA = 'Con las dos firmas, comprobada contra lo que vio el Responsable (versión reemplazada: se conserva para consulta; ya no se entrega ni se descarga)';
/** Título de «Ver la ODT» según las firmas comprobadas y si esa ODT se puede descargar (LISTA o CERRADA). */
const tituloVista = (firmas, descargable) => (firmas === 2 && !descargable ? TITULO_VISTA_SIN_DESCARGA : (TITULO_VISTA[firmas] || TITULO_VISTA[0]));

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, cuenta:object, sesion:object, odtId:string, miFirmaOdt:()=>Promise<object>,
 *          alVolver:()=>void, alCambiar:(mensaje?:string)=>void, mensaje?:string,
 *          pdfLib?:()=>Promise<object>, pintar?:Function}} p   pdfLib y pintar: inyectables (pruebas)
 */
export async function montarDetalle(contenedor, { repo, cuenta, sesion, odtId, miFirmaOdt, alVolver, alCambiar, mensaje, pdfLib = cargarPdfLib, pintar = pintarPdf }) {
  vaciar(contenedor);
  const volver = h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: '← Volver a la bandeja', onclick: alVolver });
  contenedor.appendChild(h('div', { class: 'odt-acciones' }, volver));
  if (mensaje) contenedor.appendChild(aviso(mensaje, 'ok'));
  const cargando = h('p', { class: 'odt-cargando', text: 'Leyendo la ODT del servidor y comprobando su huella…' });
  contenedor.appendChild(cargando);

  let odt; let bytesV0; let actos = {}; let devoluciones = []; let errorDevoluciones = null;
  try {
    ({ odt, bytesV0 } = await repo.leerOdt(odtId));
    actos = await repo.leerActos(odtId);
  } catch (e) {
    cargando.remove();
    contenedor.appendChild(aviso(mensajeDe(e), 'error'));
    return;
  }
  try { devoluciones = await repo.leerDevoluciones(odtId); } catch (e) { devoluciones = []; errorDevoluciones = mensajeDe(e); }
  cargando.remove();

  // «Reemplaza a la versión publicada el …»: la fecha se lee de la anterior si esta persona puede leerla.
  let reemplazaA = null;
  if (odt.reemplaza) {
    reemplazaA = 'Reemplaza a una versión anterior publicada con el mismo N.º.';
    try {
      const previa = await repo.leerOdtDoc(odt.reemplaza);
      if (previa && Number.isFinite(previa.publicadoEnMs)) reemplazaA = 'Reemplaza a la versión publicada el ' + fechaHora(previa.publicadoEnMs) + '.';
    } catch (_) { /* sin permiso para leer la anterior: queda el texto general */ }
  }

  const rol = rolDe(odt, sesion.uid);
  contenedor.appendChild(h('header', { class: 'odt-cabecera' },
    h('h2', { class: 'odt-titulo', text: 'ODT N.º ' + odt.nro }),
    h('span', { class: 'odt-chip odt-chip--' + String(odt.estado).toLowerCase(), text: etiquetaEstado(odt.estado, ETIQUETA_ESTADO) }),
    h('dl', { class: 'odt-datos odt-datos--fila' },
      dato('Subestación', odt.subestacion), dato('Equipo', odt.equipo), dato('Fecha prevista de la orden', odt.fechaTrabajo),
      dato('Consignación', odt.consignacion || '—'),
      dato(ETIQUETA_ROL.azt, odt.firmantes.azt.nombre), dato(ETIQUETA_ROL.responsable, odt.firmantes.responsable.nombre),
      rol ? dato('Usted firma como', ETIQUETA_ROL[rol]) : null)));
  if (odt.cierreAfinia) contenedor.appendChild(h('p', { class: 'odt-cerrada', role: 'status', text: textoCierreAfinia(odt.cierreAfinia) }));
  if (odt.estado === ESTADOS_CIERRE.REEMPLAZADA) {
    contenedor.appendChild(aviso('Esta ODT fue REEMPLAZADA: ya no se firma ni se descarga. Se conserva tal cual (firmas y constancia); el motivo está en la constancia.', 'aviso'));
  }
  if (reemplazaA) contenedor.appendChild(h('p', { class: 'odt-mini odt-reemplaza', text: reemplazaA }));

  contenedor.appendChild(constancia({ odt, actos, devoluciones, errorDevoluciones }));

  // ── Firmar (si le toca) ──
  if (esMiTurno(odt, sesion.uid)) {
    const zFirmar = h('section', { class: 'odt-bloque odt-bloque--firmar' });
    contenedor.appendChild(zFirmar);
    montarFirmar(zFirmar, {
      repo, cuenta, sesion, odt, bytesV0, actos, miFirmaOdt,
      alFirmar: (m) => alCambiar(m)
    });
    contenedor.appendChild(bloqueDevolver());
  }

  // ── Descargar (LISTA o CERRADA) ──
  if (puedeDescargar(odt)) contenedor.appendChild(bloqueDescargar());

  // ── Ver la ODT en pantalla (lo compuesto hasta ahora, verificado; no se imprime) ──
  if (!esMiTurno(odt, sesion.uid)) contenedor.appendChild(bloqueVer());

  // ── Anular (administrador; D6: nunca una LISTA) ──
  if (sesion.esAdmin && !sesion.legacy && puedeAnular(odt)) contenedor.appendChild(bloqueAnular());

  // ── Una LISTA: registrar su cierre en Afinia o reemplazarla (administrador) ──
  if (sesion.esAdmin && !sesion.legacy && puedeCerrarAfinia(odt)) contenedor.appendChild(bloqueCerrarAfinia());
  if (sesion.esAdmin && !sesion.legacy && puedeReemplazar(odt)) contenedor.appendChild(bloqueReemplazar());

  function dato(etq, valor) {
    return h('div', { class: 'odt-dato' }, h('dt', { text: etq }), h('dd', { text: valor == null || valor === '' ? '—' : String(valor) }));
  }

  function bloqueVer() {
    const zona = h('div', { class: 'odt-vista' });
    const btn = h('button', { type: 'button', class: 'odt-btn', text: 'Ver la ODT en pantalla' });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const PDFLib = await pdfLib();
        // Verificada como la descarga: con firmas, debe salir la huella que vieron los firmantes.
        const r = await componerParaVer({ odt, bytesV0, actos, PDFLib });
        await pintar(r.bytes, zona, { titulo: tituloVista(r.firmas, puedeDescargar(odt)), huella: r.huella });
      } catch (e) {
        vaciar(zona); zona.appendChild(aviso(mensajeDe(e), 'error'));
      } finally { btn.disabled = false; }
    });
    return h('section', { class: 'odt-bloque' }, h('div', { class: 'odt-acciones' }, btn), zona);
  }

  function bloqueDescargar() {
    const st = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Descargar la ODT firmada' });
    btn.addEventListener('click', async () => {
      btn.disabled = true; vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Armando la ODT firmada y comprobando su huella…' }));
      try {
        const PDFLib = await pdfLib();
        const r = await descargarOdt({
          odt, bytesV0, actos, PDFLib,
          registrar: (id, hx) => repo.registrarDescarga(id, hx),
          entregar: entregarBlob
        });
        vaciar(st); st.appendChild(aviso('Descargada «' + r.nombre + '» (huella ' + huellaCorta(r.huella) + ', la misma que vio el Responsable). La descarga quedó registrada.', 'ok'));
      } catch (e) {
        vaciar(st); st.appendChild(aviso(mensajeDe(e), 'error'));
      } finally { btn.disabled = false; }
    });
    return h('section', { class: 'odt-bloque' },
      h('h3', { class: 'odt-subtitulo', text: 'Descargar' }),
      h('p', { class: 'odt-mini', text: 'Se arma el PDF con las dos firmas, se comprueba que es exactamente el que firmó el Responsable y se registra quién lo descargó.' }),
      h('div', { class: 'odt-acciones' }, btn), st);
  }

  function areaMotivo(id, etiqueta) {
    const ta = h('textarea', { id, class: 'odt-campo', rows: 3, maxLength: TOPES.motivoMax, placeholder: 'Entre ' + TOPES.motivoMin + ' y ' + TOPES.motivoMax + ' caracteres' });
    return { ta, el: h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: etiqueta }), ta) };
  }

  function bloqueDevolver() {
    const resumen = h('summary', { text: 'No firmo: devolver con motivo' });
    // Una devolución por turno (id «rol_rev»): si ya está, se dice y no se ofrece otra.
    let yaDevolvio = false;
    try { yaDevolvio = devoluciones.some((d) => d.id === idDevolucion(rol, odt.rev)); } catch (_) { yaDevolvio = false; }
    if (yaDevolvio) {
      return h('details', { class: 'odt-bloque odt-detalles', open: true }, resumen,
        aviso('Ya devolvió esta ODT en este turno (está en la constancia). El administrador decide si la anula y la vuelve a publicar.', 'info'));
    }
    const m = areaMotivo('odtMotivoDevolver', 'Motivo para no firmar');
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn', text: 'Devolver sin firmar' });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await repo.devolver(odt.id, rol, m.ta.value, odt.rev);
        alCambiar('Quedó registrada su devolución con el motivo. El administrador la verá en la constancia.');
      } catch (e) {
        st.textContent = mensajeDe(e);
        btn.disabled = e && e.codigo === 'devuelta';   // la segunda del mismo turno no se reintenta
      }
    });
    return h('details', { class: 'odt-bloque odt-detalles' }, resumen,
      h('p', { class: 'odt-mini', text: 'Si algo de la ODT no es correcto, déjelo escrito aquí en lugar de firmar. Queda registrado, no se puede borrar y es una sola vez por turno.' }),
      m.el, h('div', { class: 'odt-acciones' }, btn), st);
  }

  function bloqueAnular() {
    const m = areaMotivo('odtMotivoAnular', 'Motivo de la anulación');
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Anular la ODT' });
    const confirmar = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Sí, anularla (no se puede deshacer)', hidden: true });
    btn.addEventListener('click', () => { confirmar.hidden = false; st.textContent = 'La ODT queda anulada para siempre (se conserva, no se borra). Para publicarla de nuevo, se publica otra con el mismo N.º.'; });
    confirmar.addEventListener('click', async () => {
      confirmar.disabled = true; btn.disabled = true;
      try {
        await repo.anular(odt.id, m.ta.value);
        alCambiar('ODT N.º ' + odt.nro + ' anulada.');
      } catch (e) { st.textContent = mensajeDe(e); confirmar.disabled = false; btn.disabled = false; }
    });
    return h('details', { class: 'odt-bloque odt-detalles' },
      h('summary', { text: 'Anular (administrador)' }),
      h('p', { class: 'odt-mini', text: 'Solo mientras falte alguna firma: una ODT con las dos firmas no se anula.' }),
      m.el, h('div', { class: 'odt-acciones' }, btn, confirmar), st);
  }

  /** El repositorio de la caché puede ser de antes de esta acción (L-102): entonces se pide recargar. */
  function sinAccion(nombre) {
    return typeof repo[nombre] !== 'function';
  }

  function bloqueReemplazar() {
    const resumen = h('summary', { text: 'Reemplazar (administrador)' });
    if (sinAccion('reemplazar')) return h('details', { class: 'odt-bloque odt-detalles' }, resumen, aviso(MSG_RECARGAR, 'aviso'));
    const m = areaMotivo('odtMotivoReemplazar', 'Motivo del reemplazo');
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Reemplazar la ODT' });
    const confirmar = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Sí, reemplazarla (no se puede deshacer)', hidden: true });
    btn.addEventListener('click', () => {
      confirmar.hidden = false;
      st.textContent = 'La ODT queda REEMPLAZADA para siempre. No se borra nada: sus firmas y su constancia se conservan y se pueden leer. Su N.º queda libre para publicar la versión corregida en «Publicar ODT».';
    });
    confirmar.addEventListener('click', async () => {
      confirmar.disabled = true; btn.disabled = true;
      try {
        await repo.reemplazar(odt.id, m.ta.value);
        alCambiar('ODT N.º ' + odt.nro + ' reemplazada. Ya puede publicar la versión corregida con el mismo N.º en «Publicar ODT».');
      } catch (e) { st.textContent = mensajeDe(e); confirmar.disabled = false; btn.disabled = false; }
    });
    return h('details', { class: 'odt-bloque odt-detalles' }, resumen,
      h('p', { class: 'odt-mini', text: 'Solo para una ODT con las dos firmas que hay que corregir: queda reemplazada (no se anula ni se borra) y se publica otra con el mismo N.º.' }),
      m.el, h('div', { class: 'odt-acciones' }, btn, confirmar), st);
  }

  function bloqueCerrarAfinia() {
    const resumen = h('summary', { text: 'Registrar cierre en Afinia (administrador)' });
    if (sinAccion('registrarCierreAfinia')) return h('details', { class: 'odt-bloque odt-detalles' }, resumen, aviso(MSG_RECARGAR, 'aviso'));
    const fecha = h('input', { id: 'odtFechaCierreAfinia', class: 'odt-campo', type: 'text', maxLength: 10, value: fechaBogota(), placeholder: 'dd/mm/aaaa' });
    const soporte = h('input', { id: 'odtSoporteAfinia', class: 'odt-campo', type: 'text', maxLength: SOPORTE.max, placeholder: 'p. ej. SOPORTE_ODT_06.pdf' });
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Registrar cierre en Afinia' });
    const confirmar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, registrar el cierre (queda CERRADA)', hidden: true });
    const datos = () => ({ fecha: fecha.value.trim(), soporte: soporte.value.trim() });
    const ocultar = () => { confirmar.hidden = true; };
    fecha.addEventListener('input', ocultar); soporte.addEventListener('input', ocultar);
    btn.addEventListener('click', () => {
      const err = errorCierreAfinia(datos(), { fechaTrabajo: odt.fechaTrabajo });
      if (err) { confirmar.hidden = true; st.textContent = err; return; }
      const d = datos();
      confirmar.hidden = false;
      st.textContent = 'Se registra que la ODT N.º ' + odt.nro + ' quedó cerrada en Afinia el ' + d.fecha + ' con el soporte «' + d.soporte + '». Queda CERRADA para siempre: ya no se reemplaza ni se anula; se sigue viendo y descargando.';
    });
    confirmar.addEventListener('click', async () => {
      confirmar.disabled = true; btn.disabled = true;
      try {
        await repo.registrarCierreAfinia(odt.id, datos());
        alCambiar('ODT N.º ' + odt.nro + ' registrada como cerrada en Afinia.');
      } catch (e) { st.textContent = mensajeDe(e); confirmar.disabled = false; btn.disabled = false; }
    });
    return h('details', { class: 'odt-bloque odt-detalles' }, resumen,
      h('p', { class: 'odt-mini', text: 'Cuando la ODT ya quedó cerrada en Afinia: la fecha del cierre (entre la fecha prevista de la orden, ' + odt.fechaTrabajo + ', y hoy) y el soporte con que se cerró.' }),
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtFechaCierreAfinia', text: 'Fecha del cierre en Afinia (dd/mm/aaaa)' }), fecha),
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtSoporteAfinia', text: 'Soporte del cierre (' + SOPORTE.min + ' a ' + SOPORTE.max + ' caracteres)' }), soporte),
      h('div', { class: 'odt-acciones' }, btn, confirmar), st);
  }

  return { odt, actos };
}
