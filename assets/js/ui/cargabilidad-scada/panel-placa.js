// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · panel «PLACA CARACTERÍSTICA» del equipo · TODO-69, ADR-166
// ──────────────────────────────────────────────────────────────
// ABIERTO por defecto, como en la vista previa que aprobó el Ingeniero (2026-10-22; plegarlo lo escondía, 2026-10-23);
// se puede plegar, y el resumen dice cuántas diferencias tiene. Dentro: la foto (ampliar, girar, tamaño real, abrir
// aparte), lo que se leyó de la placa y las diferencias con la plataforma, con lo que se comparó y lo que no. Solo se
// MUESTRA: ningún dato oficial cambia desde aquí.
// Archivo NUEVO (L-102), cargado con import() desde detalle.js: si falla, su ranura queda oculta.
// ══════════════════════════════════════════════════════════════

import { el, poner } from './dom.js';
import { leerPlaca, leerFoto } from '../../data/placas_caracteristicas.js';
import { revisionPlaca, seccionesPlaca } from '../../domain/placa_caracteristica.js';

let visor = null;   // el visor abierto (uno a la vez)
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const FECHA = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + '-' + MES[+m[2] - 1] + '-' + m[1] : (iso || ''); };

/** Cierra el visor abierto (al pintar otro equipo o al cambiar la dirección). */
export function cerrarVisor() { if (visor) { try { visor.close(); } catch (e) { /* ya cerrado */ } visor = null; } }
window.addEventListener('hashchange', cerrarVisor);

/** Visor a pantalla completa: girar sin recortar (se intercambian los topes) y tamaño real con desplazamiento. */
function abrirVisor(url, titulo, origen) {
  cerrarVisor();
  let giro = 0; let real = false;
  const img = el('img', { src: url, alt: 'Placa característica de ' + titulo, class: 'cs-placa-grande' });
  const lienzo = el('div', { class: 'cs-placa-visor-lienzo' }, img);
  const ajustar = () => {
    const r = lienzo.getBoundingClientRect(); const deLado = giro % 180 !== 0;
    img.style.transform = 'rotate(' + giro + 'deg)';
    if (real) { img.style.maxWidth = 'none'; img.style.maxHeight = 'none'; }
    else { img.style.maxWidth = (deLado ? r.height : r.width) - 8 + 'px'; img.style.maxHeight = (deLado ? r.width : r.height) - 8 + 'px'; }
  };
  const girar = (k) => { giro = (giro + k + 360) % 360; ajustar(); };
  const dlg = el('dialog', { class: 'cs-placa-visor', 'aria-label': 'Placa característica de ' + titulo },
    el('div', { class: 'cs-placa-visor-barra' },
      el('b', {}, 'Placa · ' + titulo + (origen === 'pdf' ? ' (página del PDF)' : '')),
      el('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Girar a la izquierda', onclick: () => girar(-90) }, '⟲ Girar'),
      el('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Girar a la derecha', onclick: () => girar(90) }, 'Girar ⟳'),
      el('button', { type: 'button', class: 'btn btn--sm', 'aria-pressed': 'false', onclick: (ev) => { real = !real; ev.currentTarget.setAttribute('aria-pressed', String(real)); ajustar(); } }, 'Tamaño real'),
      el('a', { href: url, target: '_blank', rel: 'noopener', class: 'btn btn--sm' }, 'Abrir en otra pestaña'),
      el('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => dlg.close() }, 'Cerrar')),
    lienzo);
  dlg.addEventListener('close', () => { dlg.remove(); if (visor === dlg) visor = null; });
  document.body.appendChild(dlg);
  visor = dlg;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  requestAnimationFrame(ajustar);
}

/** Texto honesto de lo que se comparó (y lo que no). */
function textoComparado(r) {
  const c = r.comparados.length ? 'Se comparó: ' + r.comparados.join(', ') + '.' : 'No hubo datos de la plataforma para comparar.';
  return c + (r.sinComparar.length ? ' Sin comparar (falta el dato en la placa o en la plataforma): ' + r.sinComparar.join(', ') + '.' : '');
}

/**
 * Pinta el panel en su ranura. Devuelve {ok:true} o {error:true} (con error, el detalle deja reintentar al reabrir).
 * @param {HTMLElement} nodo  la sección `#csPlaca` del equipo
 * @param {{tx: object, titulo: string, vigente: () => boolean}} ctx
 */
export async function pintarPlaca(nodo, { tx, titulo, vigente = () => true }) {
  cerrarVisor();
  nodo.hidden = false;
  const resumen = el('summary', {}, el('span', { id: 'csPlacaTitulo', class: 'cs-placa-tit' }, 'Placa característica'), el('span', { class: 'cs-sub cs-placa-res' }, 'leyendo…'));
  const cuerpo = el('div', { class: 'cs-placa-cuerpo' }, el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo la placa…'));
  const det = el('details', { class: 'cs-placa-det', open: true }, resumen, cuerpo);
  poner(nodo, det);
  const ponerRes = (t) => { resumen.lastChild.textContent = t; };
  const r = await leerPlaca(tx && tx.id);
  if (!vigente()) return { ok: true };
  if (r.error) {
    ponerRes('no se pudo leer');
    const b = el('button', { type: 'button', class: 'btn btn--glass btn--sm' }, 'Reintentar');
    b.addEventListener('click', () => { b.disabled = true; pintarPlaca(nodo, { tx, titulo, vigente }); });
    poner(cuerpo, el('p', { class: 'cs-ayuda', role: 'alert' }, r.mensaje || 'No se pudo leer la placa.', ' ', b));
    return { error: true };
  }
  if (!r.hay) {
    ponerRes('sin placa registrada');
    poner(cuerpo, el('p', { class: 'cs-ayuda' }, 'Este transformador no tiene placa registrada (sin foto en la carpeta de placas o sin lectura).'));
    return { ok: true };
  }
  const placa = r.placa; const fuente = placa.fuente || {};
  const rev = revisionPlaca(placa, tx); const difs = rev.difs; const graves = difs.filter((d) => d.grave).length;
  ponerRes(difs.length ? difs.length + (difs.length === 1 ? ' diferencia' : ' diferencias') + ' con la plataforma' + (graves ? ' (' + graves + ' importante' + (graves === 1 ? ')' : 's)') : '')
    : 'coincide en lo comparado');
  if (graves) det.classList.add('cs-placa-det--grave');
  const caja = el('div', { class: 'cs-placa-foto' }, el('div', { class: 'cs-esqueleto', style: 'height:220px' }));
  const datos = el('div', { class: 'cs-placa-datos' },
    seccionesPlaca(placa).map((s) => el('table', { class: 'cs-tabla cs-tabla-placa' },
      el('caption', {}, s.titulo),
      el('tbody', {}, s.filas.map(([k, v]) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, v)))))));
  const listaDif = difs.length
    ? el('div', { class: 'cs-placa-dif' }, el('h3', {}, 'Diferencias con la plataforma (' + difs.length + ')'),
      el('ul', {}, difs.map((d) => el('li', { class: d.grave ? 'cs-placa-dif--grave' : null },
        el('b', {}, d.campo + ': '), 'placa ' + d.placa + ' · plataforma ' + d.plataforma, el('span', { class: 'cs-sub' }, d.nota)))),
      el('p', { class: 'cs-ayuda' }, textoComparado(rev) + ' Solo se muestran: los datos oficiales no cambian desde aquí. Cada corrección se decide aparte (la ampacidad, siempre junto con su carga).'))
    : el('p', { class: 'cs-ayuda cs-placa-ok' }, 'Sin diferencias en lo comparado. ' + textoComparado(rev));
  const nota = el('p', { class: 'cs-ayuda' }, 'Datos leídos de la foto el ' + FECHA(fuente.fecha) + (fuente.lecturas ? ' por ' + fuente.lecturas + (fuente.lecturas === 1 ? ' lector' : ' lectores') : '')
    + (fuente.confianza ? ' · confianza ' + fuente.confianza : '') + '.', placa.datos && placa.datos.notas
    ? el('details', { class: 'cs-placa-notas' }, el('summary', {}, 'Notas de la lectura'), el('p', {}, placa.datos.notas)) : null);
  poner(cuerpo, listaDif, el('div', { class: 'cs-placa-grid' }, caja, datos), nota);
  if (!placa.foto) { poner(caja, el('p', { class: 'cs-ayuda' }, 'Sin foto guardada de esta placa.')); return { ok: true }; }
  const pintarFoto = async () => {
    poner(caja, el('div', { class: 'cs-esqueleto', style: 'height:220px' }));
    const f = await leerFoto(tx.id, placa.foto);
    if (!vigente()) return { ok: true };
    if (f.error) {
      const b = el('button', { type: 'button', class: 'btn btn--glass btn--sm' }, 'Reintentar');
      b.addEventListener('click', () => { b.disabled = true; pintarFoto(); });
      poner(caja, el('p', { class: 'cs-ayuda', role: 'alert' }, f.mensaje, ' ', b));
      return { error: true };
    }
    // Una URL por ranura: se libera la anterior de ESTA ranura, nunca la de otra.
    if (nodo._urlPlaca) URL.revokeObjectURL(nodo._urlPlaca);
    const url = nodo._urlPlaca = URL.createObjectURL(new Blob([f.bytes], { type: placa.foto.mime || 'image/jpeg' }));
    poner(caja,
      el('button', { type: 'button', class: 'cs-placa-mini', onclick: () => abrirVisor(url, titulo, placa.foto.origen), 'aria-label': 'Ampliar la placa de ' + titulo },
        el('img', { src: url, alt: 'Placa característica de ' + titulo, decoding: 'async', style: 'max-width:100%;height:auto' })),
      el('p', { class: 'cs-ayuda' }, (placa.foto.origen === 'pdf' ? 'Página del PDF de la placa' : 'Foto de la placa') + ' · toque para ampliar y girar'));
    return { ok: true };
  };
  return pintarFoto();
}
