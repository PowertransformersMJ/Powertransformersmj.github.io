// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Panel «Firmas del equipo» (solo custodio) · ADR-099
// ──────────────────────────────────────────────────────────────
// El custodio (administrador) sube, reemplaza o retira la firma de cada
// persona de la lista, DECLARANDO la fecha y el medio de la autorización de
// su titular. La imagen se normaliza en el navegador (PNG real, fondo claro
// transparente, sin metadatos) antes de subirla. Nada pasa por el repo.
// Todo texto que viene del usuario se pinta con textContent.
// ══════════════════════════════════════════════════════════════

import { PERSONAS_EQUIPO, validarAutorizacion, hoyLocalISO } from '../../domain/firmas_equipo.js';
import { firmaAplicaA } from '../../domain/firmas.js';

const ANCHO_MAX = 1200;
const ALTO_MAX = 400;
const ANCHO_MIN_NITIDO = 300;
const TOPE_BYTES = 512 * 1024;
// Decisión del Ingeniero (§99.11): «yo autorizo verbalmente». En una firma NUEVA
// la fecha y el medio vienen llenos por defecto; al REEMPLAZAR se conserva la
// autorización que ya estaba declarada. Quedan en el registro y se pueden corregir.
const MEDIO_POR_DEFECTO = 'Autorización verbal';

/**
 * Imagen elegida → PNG normalizado (Uint8Array): fondo claro transparente,
 * RECORTADA al trazo (una foto o una hoja escaneada no se sube entera) y con
 * ancho y alto acotados (revisión de `§99`).
 */
async function normalizarImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen (use PNG o JPG).'));
      i.src = url;
    });
    // 1) A tamaño de trabajo, con el fondo claro vuelto transparente.
    const esc0 = Math.min(1, 2400 / img.naturalWidth);
    const W = Math.max(1, Math.round(img.naturalWidth * esc0));
    const H = Math.max(1, Math.round(img.naturalHeight * esc0));
    const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
    const x0 = c0.getContext('2d');
    x0.drawImage(img, 0, 0, W, H);
    const px = x0.getImageData(0, 0, W, H);
    const d = px.data;
    let minX = W; let minY = H; let maxX = -1; let maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        const a = Math.min(d[i + 3], lum >= 235 ? 0 : (lum <= 120 ? 255 : Math.round(255 * (235 - lum) / 115)));
        d[i + 3] = a;
        if (a > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    if (maxX < 0) throw new Error('No se encontró el trazo de la firma: use una imagen con la firma en tinta oscura sobre fondo claro.');
    x0.putImageData(px, 0, 0);
    // 2) Recortada al trazo (con un margen) y acotada en ancho y alto.
    const m = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03) + 2;
    const cx = Math.max(0, minX - m); const cy = Math.max(0, minY - m);
    const cw = Math.min(W, maxX + m + 1) - cx; const ch = Math.min(H, maxY + m + 1) - cy;
    const esc = Math.min(1, ANCHO_MAX / cw, ALTO_MAX / ch);
    const w = Math.max(1, Math.round(cw * esc)); const h = Math.max(1, Math.round(ch * esc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(c0, cx, cy, cw, ch, 0, 0, w, h);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    const png = new Uint8Array(await blob.arrayBuffer());
    if (png.length > TOPE_BYTES) {
      throw new Error('La firma recortada pesa ' + Math.round(png.length / 1024) + ' KB (máximo 512): '
        + 'escanéela sobre papel blanco, recortada a la firma.');
    }
    return { png, ancho: Math.round(cw / esc0) };
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
    + 'Cada subida queda registrada con su fecha (por defecto, como autorización verbal). '
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
    // Aviso de la fila fuera del formulario: `pintar` no lo toca, así un error de
    // «Retirar» o de «Guardar» no se borra al instante (revisión de §99).
    const aviso = document.createElement('p'); aviso.className = 'fe-msg fe-aviso'; aviso.setAttribute('aria-live', 'polite');
    f.append(nom, vista, est, acc, form, aviso);

    bSubir.addEventListener('click', () => {
      form.hidden = false; msg.textContent = '';
      const previa = (filas.get(p.id) || {}).aut;
      inF.max = hoyLocalISO();
      if (!inF.value) inF.value = (previa && previa.fecha) || hoyLocalISO();
      if (!inM.value) inM.value = (previa && previa.medio) || MEDIO_POR_DEFECTO;
      inA.focus();
    });
    bCancelar.addEventListener('click', () => { form.hidden = true; form.reset(); bSubir.focus(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const archivo = inA.files && inA.files[0];
      if (!archivo) { msg.textContent = 'Elija la imagen de la firma.'; return; }
      const aut = { fecha: inF.value, medio: inM.value };
      const v = validarAutorizacion(aut);
      if (!v.ok) { msg.textContent = v.motivo; return; }
      bGuardar.disabled = true; bCancelar.disabled = true; msg.textContent = 'Guardando…';
      aviso.textContent = '';
      try {
        const { png, ancho } = await normalizarImagen(archivo);
        const r = await datos.subirFirma(p.id, png, aut);
        await pintar(p);                       // SIEMPRE: la fila dice el estado real
        if (!r.ok) { msg.textContent = r.motivo; return; }
        form.hidden = true; form.reset();
        msg.textContent = '';
        aviso.textContent = ancho < ANCHO_MIN_NITIDO ? 'Guardada. Imagen pequeña: se verá pixelada al imprimir.' : 'Guardada.';
        bSubir.focus();
        alCambiar();
      } catch (e) {
        msg.textContent = (e && e.message) || 'No se pudo guardar la firma.';
      } finally {
        bGuardar.disabled = false; bCancelar.disabled = false;
      }
    });
    bQuitar.addEventListener('click', async () => {
      if (!globalThis.confirm('¿Retirar la firma de ' + p.nombre + '? Solo afecta a las descargas futuras.')) return;
      bQuitar.disabled = true;
      const r = await datos.quitarFirma(p.id);
      bQuitar.disabled = false;
      await pintar(p);
      aviso.textContent = r.motivo || (r.ok ? 'Retirada.' : 'No se pudo retirar la firma.');
      bSubir.focus();
      alCambiar();
    });
    filas.set(p.id, { f, vista, est, bSubir, bQuitar, turno: 0, aut: null });
    return f;
  }

  async function pintar(p) {
    const x = filas.get(p.id);
    if (!x) return;
    // Turno: si empieza un pintado más nuevo, este se descarta (dos refrescos
    // superpuestos dejaban la imagen duplicada, revisión de §99).
    const turno = ++x.turno;
    // UNA lectura: el documento trae la imagen y la autorización (ADR-100).
    const leida = await datos.leerFirma(p.id);
    const e = leida && !leida.error
      ? { hay: true, autorizacion: leida.autorizacion }
      : { hay: false, error: !!(leida && leida.error) };
    if (turno !== x.turno) return;
    x.aut = e.hay ? e.autorizacion : null;
    x.vista.textContent = '';
    if (e.hay) {
      if (leida && !leida.error) {
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
