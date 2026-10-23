// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · panel «PLACA CARACTERÍSTICA» del equipo · TODO-69
// ──────────────────────────────────────────────────────────────
// Foto de la placa (ampliar, girar, abrir aparte) + lo que se leyó de ella + las diferencias con la
// plataforma. Solo se MUESTRA: ningún dato oficial cambia desde aquí. Archivo NUEVO (L-102), cargado con
// import() desde detalle.js: si falla, su ranura queda oculta y el detalle sigue igual.
// ══════════════════════════════════════════════════════════════

import { el, poner } from './dom.js';
import { leerPlaca, leerFoto } from '../../data/placas_caracteristicas.js';
import { diferencias, seccionesPlaca } from '../../domain/placa_caracteristica.js';

let urlVigente = null;
const FECHA = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return m ? +m[3] + '-' + MES[+m[2] - 1] + '-' + m[1] : (iso || ''); };

/** Visor a pantalla completa con giro (transform, sin animar el layout). */
function abrirVisor(url, titulo) {
  let giro = 0;
  const img = el('img', { src: url, alt: 'Placa característica de ' + titulo, class: 'cs-placa-grande' });
  const girar = (k) => { giro = (giro + k + 360) % 360; img.style.transform = 'rotate(' + giro + 'deg)'; };
  const dlg = el('dialog', { class: 'cs-placa-visor', 'aria-label': 'Placa característica de ' + titulo },
    el('div', { class: 'cs-placa-visor-barra' },
      el('b', {}, 'Placa · ' + titulo),
      el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => girar(-90) }, '⟲ Girar'),
      el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => girar(90) }, 'Girar ⟳'),
      el('a', { href: url, target: '_blank', rel: 'noopener', class: 'btn btn--glass btn--sm' }, 'Abrir en otra pestaña'),
      el('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => dlg.close() }, 'Cerrar')),
    el('div', { class: 'cs-placa-visor-lienzo' }, img));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

/**
 * Pinta el panel en su ranura.
 * @param {HTMLElement} nodo  la sección `#csPlaca` del equipo
 * @param {{tx: object, titulo: string, vigente: () => boolean}} ctx
 */
export async function pintarPlaca(nodo, { tx, titulo, vigente = () => true }) {
  nodo.hidden = false;
  const cab = el('h2', { id: 'csPlacaTitulo' }, 'Placa característica');
  poner(nodo, cab, el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo la placa…'));
  const r = await leerPlaca(tx && tx.id);
  if (!vigente()) return;
  if (r.error) {
    poner(nodo, cab, el('p', { class: 'cs-ayuda', role: 'alert' }, r.mensaje || 'No se pudo leer la placa.',
      ' ', el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => pintarPlaca(nodo, { tx, titulo, vigente }) }, 'Reintentar')));
    return;
  }
  if (!r.hay) {
    poner(nodo, cab, el('p', { class: 'cs-ayuda' }, 'Este transformador no tiene placa registrada (sin foto en la carpeta de placas o sin lectura).'));
    return;
  }
  const placa = r.placa; const fuente = placa.fuente || {};
  const difs = diferencias(placa, tx);
  const caja = el('div', { class: 'cs-placa-foto' }, el('div', { class: 'cs-esqueleto', style: 'height:220px' }));
  const datos = el('div', { class: 'cs-placa-datos' },
    seccionesPlaca(placa).map((s) => el('table', { class: 'cs-tabla cs-tabla-placa' },
      el('caption', {}, s.titulo),
      el('tbody', {}, s.filas.map(([k, v]) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, v)))))));
  const listaDif = difs.length
    ? el('div', { class: 'cs-placa-dif' }, el('h3', {}, 'Diferencias con la plataforma (' + difs.length + ')'),
      el('ul', {}, difs.map((d) => el('li', { class: d.grave ? 'cs-placa-dif--grave' : null },
        el('b', {}, d.campo + ': '), 'placa ' + d.placa + ' · plataforma ' + d.plataforma, el('span', { class: 'cs-sub' }, d.nota)))),
      el('p', { class: 'cs-ayuda' }, 'Solo se muestran: los datos oficiales no cambian desde aquí. Cada corrección se decide aparte (la ampacidad, siempre junto con su carga).'))
    : el('p', { class: 'cs-ayuda cs-placa-ok' }, 'La placa coincide con la plataforma en serie, potencia, tensiones y ampacidades.');
  const nota = el('p', { class: 'cs-ayuda' }, 'Datos leídos de la foto el ' + FECHA(fuente.fecha) + (fuente.lecturas ? ' por ' + fuente.lecturas + (fuente.lecturas === 1 ? ' lector' : ' lectores') : '')
    + (fuente.confianza ? ' · confianza ' + fuente.confianza : '') + (placa.datos && placa.datos.notas ? '. ' : ''), placa.datos && placa.datos.notas
    ? el('details', { class: 'cs-placa-notas' }, el('summary', {}, 'Notas de la lectura'), el('p', {}, placa.datos.notas)) : null);
  poner(nodo, cab, el('div', { class: 'cs-placa-grid' }, caja, datos), listaDif, nota);
  if (!placa.foto) { poner(caja, el('p', { class: 'cs-ayuda' }, 'Sin foto guardada de esta placa.')); return; }
  const f = await leerFoto(tx.id, placa.foto);
  if (!vigente()) return;
  if (f.error) { poner(caja, el('p', { class: 'cs-ayuda', role: 'alert' }, f.mensaje)); return; }
  if (urlVigente) URL.revokeObjectURL(urlVigente);
  urlVigente = URL.createObjectURL(new Blob([f.bytes], { type: placa.foto.mime || 'image/jpeg' }));
  const url = urlVigente;
  poner(caja,
    el('button', { type: 'button', class: 'cs-placa-mini', onclick: () => abrirVisor(url, titulo), 'aria-label': 'Ampliar la placa de ' + titulo },
      el('img', { src: url, alt: 'Placa característica de ' + titulo, loading: 'lazy', decoding: 'async' })),
    el('p', { class: 'cs-ayuda' }, (placa.foto.origen === 'pdf' ? 'Página del PDF de la placa' : 'Foto de la placa') + ' · toque para ampliar y girar'));
}
