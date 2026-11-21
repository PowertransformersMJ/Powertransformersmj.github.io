// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · CONSTANCIA DE FIRMAS (tarjeta)
// ──────────────────────────────────────────────────────────────────────────────
// La prueba de quién firmó no es la imagen del PDF (R4): es el ACTO guardado en
// SGM. Esta tarjeta lo muestra completo: quién, con qué cuenta, cuándo firmó,
// cuándo escribió su contraseña, qué declaró y las huellas de lo que vio.
// También la anulación y las devoluciones («no firmo»), si las hay.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ROL, ROLES } from '../../domain/odt_afinia_rutas.js';
import { ETIQUETA_ESTADO } from '../../domain/odt_afinia_estados.js';
import { h, aviso, fechaHora, horaAutenticacion, huellaCorta } from './comun.js';

const fila = (etq, valor, titulo) => h('div', { class: 'odt-dato' },
  h('dt', { text: etq }), h('dd', { text: valor == null || valor === '' ? '—' : String(valor), title: titulo || null }));

/** Tarjeta de un acto (o «pendiente»). */
export function tarjetaActo(rol, acto, odt) {
  const asignado = odt && odt.firmantes && odt.firmantes[rol];
  if (!acto) {
    return h('article', { class: 'odt-acto odt-acto--pendiente' },
      h('h4', { text: ETIQUETA_ROL[rol] }),
      h('p', { class: 'odt-mini', text: 'Sin firmar. Asignado a: ' + (asignado ? asignado.nombre + ' (' + asignado.correo + ')' : '—') }));
  }
  const datos = [
    fila('Firmó', acto.nombre),
    fila('Con la cuenta', acto.correo),
    fila('Fecha y hora de la firma', fechaHora(acto.enMs)),
    fila('Escribió su contraseña', horaAutenticacion(acto.authTime)),
    fila('N.º de ODT', acto.nro)
  ];
  if (rol === 'responsable' && acto.cierre) datos.push(fila('Fecha de cierre declarada', acto.cierre.fecha));
  datos.push(
    fila('Huella de su firma (imagen)', huellaCorta(acto.huellaImagen), acto.huellaImagen),
    fila('Huella del original', huellaCorta(acto.huellaBase), acto.huellaBase),
    fila('Huella de lo que vio al firmar', huellaCorta(acto.huellaVista), acto.huellaVista),
    fila('Compositor', acto.compositor)
  );
  return h('article', { class: 'odt-acto' },
    h('h4', { text: ETIQUETA_ROL[rol] }),
    h('dl', { class: 'odt-datos' }, datos),
    h('details', { class: 'odt-detalles' },
      h('summary', { text: 'Declaración que aceptó (' + (acto.declaracionVersion || '') + ')' }),
      h('blockquote', { class: 'odt-declaracion-texto', text: acto.declaracion || '' })));
}

/**
 * Constancia completa. Si las devoluciones no se pudieron leer, se DICE (la Constancia es
 * la prueba: un hueco silencioso haría creer que nadie devolvió).
 * @param {{odt:object, actos:{azt?:object, responsable?:object}, devoluciones?:Array, errorDevoluciones?:string|null}} p
 */
export function constancia({ odt, actos = {}, devoluciones = [], errorDevoluciones = null }) {
  const partes = [
    h('h3', { class: 'odt-subtitulo', text: 'Constancia de firmas' }),
    h('p', { class: 'odt-mini', text: 'La prueba de cada firma es este registro en SGM (no la imagen del PDF). Nadie puede editarlo ni borrarlo.' }),
    h('dl', { class: 'odt-datos odt-datos--fila' },
      fila('Estado', ETIQUETA_ESTADO[odt.estado] || odt.estado),
      fila('Publicada por', odt.publicadoPor && odt.publicadoPor.nombre),
      fila('Publicada', fechaHora(odt.publicadoEnMs)),
      fila('Huella del original', huellaCorta(odt.huella), odt.huella)),
    h('div', { class: 'odt-actos' }, ROLES.map((rol) => tarjetaActo(rol, actos[rol], odt)))
  ];
  if (odt.anulacion) {
    const a = odt.anulacion;
    partes.push(h('div', { class: 'odt-anulada' },
      h('strong', { text: 'Anulada' }),
      h('span', { text: ' por ' + ((a.por && a.por.nombre) || '—') + ', ' + fechaHora(a.en && typeof a.en.toMillis === 'function' ? a.en.toMillis() : null) + '. Motivo: ' }),
      h('span', { text: a.motivo || '' })));
  }
  if (errorDevoluciones) {
    partes.push(aviso('No se pudieron leer las devoluciones («no firmo») de esta ODT: ' + errorDevoluciones + ' Recargue antes de decidir.', 'error'));
  }
  if (devoluciones.length) {
    partes.push(h('div', { class: 'odt-devoluciones' },
      h('h4', { text: 'Devoluciones («no firmo»)' }),
      h('ul', {}, devoluciones.map((d) => h('li', {},
        h('strong', { text: (ETIQUETA_ROL[d.rol] || d.rol) + ' · ' + fechaHora(d.enMs) + ': ' }),
        h('span', { text: d.motivo || '' }))))));
  }
  return h('section', { class: 'odt-constancia', 'aria-label': 'Constancia de firmas' }, partes);
}
