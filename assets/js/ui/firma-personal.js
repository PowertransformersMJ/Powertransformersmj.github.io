// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — «Mi firma»: alta autoservicio (ADR-071)
// ──────────────────────────────────────────────────────────────
// Panel reutilizable: cada persona sube, ve, reemplaza o borra SU firma.
// No hay forma de tocar la de otro — ni en esta pantalla ni en el servidor.
// Clases con prefijo `fp-` para poder montarlo en cualquier página sin
// chocar con los estilos del módulo que lo aloja.
// ══════════════════════════════════════════════════════════════

import { miFirma, guardarMiFirma, borrarMiFirma, firmasDisponibles } from '../data/firmas.js';
import { MAX_BYTES } from '../domain/firmas.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Monta el panel dentro de `contenedor`.
 * @param {HTMLElement} contenedor
 * @param {{ onCambio?: () => void }} [opts] — se llama tras guardar o borrar,
 *        para que el módulo que aloja el panel repinte lo que dependa de la firma.
 */
export function montarFirmaPersonal(contenedor, opts = {}) {
  if (!contenedor) return null;
  const onCambio = typeof opts.onCambio === 'function' ? opts.onCambio : () => {};

  contenedor.innerHTML = `
    <div class="fp-caja">
      <div class="fp-cab">
        <h3 class="fp-titulo">Mi firma</h3>
        <p class="fp-ayuda">
          Se guarda en su cuenta, no en la página: <strong>solo usted puede verla y usarla</strong>.
          Se estampa únicamente en la línea que lleva su nombre; las demás salen en blanco
          para firmar a mano.
        </p>
      </div>
      <div class="fp-cuerpo">
        <div class="fp-vista" id="fpVista" aria-live="polite"></div>
        <div class="fp-acciones">
          <label class="fp-btn fp-btn--primario">
            <span id="fpEtiquetaSubir">Subir mi firma</span>
            <input type="file" id="fpArchivo" accept="image/png" class="fp-oculto">
          </label>
          <button type="button" class="fp-btn" id="fpBorrar" hidden>Quitar mi firma</button>
        </div>
        <p class="fp-nota">
          Debe ser un <strong>PNG con fondo transparente</strong>, recortado dejando solo el trazo,
          de menos de 1 MB. Un JPG llega con fondo blanco y taparía la línea del formato.
        </p>
        <p class="fp-estado" id="fpEstado" role="status" aria-live="polite"></p>
      </div>
    </div>`;

  const $ = (s) => contenedor.querySelector(s);
  const vista = $('#fpVista');
  const estado = $('#fpEstado');
  const btnBorrar = $('#fpBorrar');
  const etiqueta = $('#fpEtiquetaSubir');
  const input = $('#fpArchivo');

  function decir(msg, tipo) {
    estado.textContent = msg || '';
    estado.className = 'fp-estado' + (tipo ? ' fp-estado--' + tipo : '');
  }

  async function pintar() {
    if (!firmasDisponibles()) {
      vista.innerHTML = '<p class="fp-vacio">Inicie sesión para cargar su firma.</p>';
      btnBorrar.hidden = true;
      input.disabled = true;
      return;
    }
    const dataUrl = await miFirma();
    if (dataUrl) {
      vista.innerHTML = `<img src="${esc(dataUrl)}" alt="Su firma registrada" class="fp-img">`;
      etiqueta.textContent = 'Reemplazar mi firma';
      btnBorrar.hidden = false;
    } else {
      vista.innerHTML = '<p class="fp-vacio">Aún no ha cargado su firma. '
                      + 'Mientras tanto, el documento sale con la línea en blanco.</p>';
      etiqueta.textContent = 'Subir mi firma';
      btnBorrar.hidden = true;
    }
  }

  input.addEventListener('change', async (ev) => {
    const archivo = ev.target.files && ev.target.files[0];
    ev.target.value = '';                      // permite volver a elegir el mismo archivo
    if (!archivo) return;
    decir('Guardando…');
    const r = await guardarMiFirma(archivo);
    decir(r.ok ? 'Firma guardada.' : r.motivo, r.ok ? 'ok' : 'error');
    if (r.ok) { await pintar(); onCambio(); }
  });

  btnBorrar.addEventListener('click', async () => {
    decir('Quitando…');
    const r = await borrarMiFirma();
    decir(r.ok ? 'Firma retirada. El documento saldrá con la línea en blanco.' : r.motivo,
          r.ok ? 'ok' : 'error');
    if (r.ok) { await pintar(); onCambio(); }
  });

  pintar();
  return { refrescar: pintar, MAX_BYTES };
}
