// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Panel «Firmas del equipo» (solo custodio) · ADR-099
// ──────────────────────────────────────────────────────────────
// El custodio (administrador) sube, reemplaza o retira la firma de cada
// persona de la lista, DECLARANDO la fecha y el medio de la autorización de
// su titular. La imagen se normaliza en el navegador (PNG real, fondo claro
// transparente, sin metadatos) antes de subirla. Nada pasa por el repo.
// Todo texto que viene del usuario se pinta con textContent.
// ══════════════════════════════════════════════════════════════

import { PERSONAS_EQUIPO, validarAutorizacion } from '../../domain/firmas_equipo.js';
import { firmaAplicaA } from '../../domain/firmas.js';

const ANCHO_MAX = 1200;
const ANCHO_MIN_NITIDO = 300;

/** Imagen elegida → PNG normalizado (Uint8Array) con fondo claro transparente. */
async function normalizarImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen (use PNG o JPG).'));
      i.src = url;
    });
    const esc = Math.min(1, ANCHO_MAX / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * esc));
    const h = Math.max(1, Math.round(img.naturalHeight * esc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      const a = lum >= 235 ? 0 : (lum <= 120 ? 255 : Math.round(255 * (235 - lum) / 115));
      d[i + 3] = Math.min(d[i + 3], a);
    }
    ctx.putImageData(px, 0, 0);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    return { png: new Uint8Array(await blob.arrayBuffer()), ancho: img.naturalWidth };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Monta el panel.
 * @param {HTMLElement} contenedor
 * @param {{ datos: object, nombreSesion: string, alCambiar?: Function }} opts
 *        `datos`: el módulo data/firmas_equipo.js
 */
export function montarFirmasEquipo(contenedor, opts = {}) {
  if (!contenedor) return null;
  const datos = opts.datos;
  const alCambiar = typeof opts.alCambiar === 'function' ? opts.alCambiar : () => {};
  // La firma PROPIA del custodio no se custodia aquí: sale de «Mi firma» (§71).
  const personas = PERSONAS_EQUIPO.filter((p) => !p.nombres.some((n) => firmaAplicaA(n, opts.nombreSesion)));

  contenedor.textContent = '';
  const caja = document.createElement('div');
  caja.className = 'fe-caja';
  const ayuda = document.createElement('p');
  ayuda.className = 'fe-ayuda';
  ayuda.textContent = 'Solo usted ve y usa estas firmas: quedan en su espacio privado, no en la página. '
    + 'Al subir cada una declare la fecha y el medio de la autorización de su titular. '
    + 'Retirar una firma solo afecta a las descargas futuras: los Excel ya enviados la conservan.';
  caja.appendChild(ayuda);
  const lista = document.createElement('div');
  lista.className = 'fe-lista';
  caja.appendChild(lista);
  contenedor.appendChild(caja);

  const filas = new Map();

  function fila(p) {
    const f = document.createElement('div');
    f.className = 'fe-fila';
    const nom = document.createElement('div'); nom.className = 'fe-nombre'; nom.textContent = p.nombre;
    const vista = document.createElement('div'); vista.className = 'fe-vista';
    const est = document.createElement('div'); est.className = 'fe-estado'; est.textContent = 'Consultando…';
    const acc = document.createElement('div'); acc.className = 'fe-acciones';
    const bSubir = document.createElement('button'); bSubir.type = 'button'; bSubir.className = 'ftm-btn'; bSubir.textContent = 'Subir';
    const bQuitar = document.createElement('button'); bQuitar.type = 'button'; bQuitar.className = 'ftm-btn'; bQuitar.textContent = 'Retirar'; bQuitar.hidden = true;
    acc.append(bSubir, bQuitar);
    const form = document.createElement('form'); form.className = 'fe-form'; form.hidden = true;
    const lblA = document.createElement('label'); lblA.textContent = 'Imagen de la firma (PNG o JPG) ';
    const inA = document.createElement('input'); inA.type = 'file'; inA.accept = 'image/png,image/jpeg'; lblA.appendChild(inA);
    const lblF = document.createElement('label'); lblF.textContent = 'Fecha de la autorización ';
    const inF = document.createElement('input'); inF.type = 'date'; lblF.appendChild(inF);
    const lblM = document.createElement('label'); lblM.textContent = 'Medio de la autorización ';
    const inM = document.createElement('input'); inM.type = 'text'; inM.maxLength = 200; inM.placeholder = 'p. ej. correo del 25/09/2026'; lblM.appendChild(inM);
    const bGuardar = document.createElement('button'); bGuardar.type = 'submit'; bGuardar.className = 'ftm-btn ftm-btn--primary'; bGuardar.textContent = 'Guardar firma';
    const bCancelar = document.createElement('button'); bCancelar.type = 'button'; bCancelar.className = 'ftm-btn'; bCancelar.textContent = 'Cancelar';
    const msg = document.createElement('p'); msg.className = 'fe-msg'; msg.setAttribute('aria-live', 'polite');
    form.append(lblA, lblF, lblM, bGuardar, bCancelar, msg);
    f.append(nom, vista, est, acc, form);

    bSubir.addEventListener('click', () => { form.hidden = false; msg.textContent = ''; inA.focus(); });
    bCancelar.addEventListener('click', () => { form.hidden = true; form.reset(); bSubir.focus(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const archivo = inA.files && inA.files[0];
      if (!archivo) { msg.textContent = 'Elija la imagen de la firma.'; return; }
      const aut = { fecha: inF.value, medio: inM.value };
      const v = validarAutorizacion(aut);
      if (!v.ok) { msg.textContent = v.motivo; return; }
      bGuardar.disabled = true; msg.textContent = 'Guardando…';
      try {
        const { png, ancho } = await normalizarImagen(archivo);
        const r = await datos.subirFirma(p.id, png, aut);
        if (!r.ok) { msg.textContent = r.motivo; return; }
        form.hidden = true; form.reset();
        msg.textContent = '';
        await pintar(p);
        if (ancho < ANCHO_MIN_NITIDO) est.textContent += ' · Imagen pequeña: se verá pixelada al imprimir.';
        alCambiar();
      } catch (e) {
        msg.textContent = (e && e.message) || 'No se pudo guardar la firma.';
      } finally {
        bGuardar.disabled = false;
      }
    });
    bQuitar.addEventListener('click', async () => {
      if (!globalThis.confirm('¿Retirar la firma de ' + p.nombre + '? Solo afecta a las descargas futuras.')) return;
      bQuitar.disabled = true;
      const r = await datos.quitarFirma(p.id);
      bQuitar.disabled = false;
      if (r.motivo) est.textContent = r.motivo;
      await pintar(p);
      alCambiar();
    });
    filas.set(p.id, { f, vista, est, bSubir, bQuitar });
    return f;
  }

  async function pintar(p) {
    const x = filas.get(p.id);
    if (!x) return;
    const e = await datos.estadoFirma(p.id);
    x.vista.textContent = '';
    if (e.hay) {
      const leida = await datos.leerFirma(p.id);
      if (leida) {
        const img = document.createElement('img');
        img.alt = 'Firma de ' + p.nombre; img.src = leida.dataUrl; img.className = 'fe-img';
        x.vista.appendChild(img);
      }
      x.est.textContent = 'Autorizada el ' + e.autorizacion.fecha.split('-').reverse().join('/') + ' · ' + e.autorizacion.medio;
      x.bSubir.textContent = 'Reemplazar';
      x.bQuitar.hidden = false;
    } else {
      x.est.textContent = e.error ? 'No se pudo consultar (revise la conexión).' : 'Sin firma.';
      x.bSubir.textContent = 'Subir';
      x.bQuitar.hidden = true;
    }
  }

  personas.forEach((p) => lista.appendChild(fila(p)));
  return {
    /** Consulta el estado de cada persona (se llama al abrir el panel). */
    async refrescar() { for (const p of personas) await pintar(p); }
  };
}
