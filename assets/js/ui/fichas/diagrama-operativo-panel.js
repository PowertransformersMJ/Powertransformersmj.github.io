// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · pestaña «DIAGRAMA OPERATIVO» (`99 §112`)
// ──────────────────────────────────────────────────────────────────────────────
// Adjuntar a la ficha de Mantenimiento un Excel (su hoja, p. ej. «Cronograma
// trabajos») o una imagen. El archivo se DIBUJA AQUÍ UNA VEZ, se muestra tal como
// irá al papel, y solo si el administrador lo aprueba se guarda en el sistema
// (Firestore) la IMAGEN aprobada. Un adjunto por transformador.
//
// Estados: sin identidad · consultando · no se pudo consultar · sin adjunto ·
// procesando · propuesta (aprobar / cancelar) · guardado (reemplazar / quitar).
// Todo el DOM con createElement/textContent: nada del archivo entra como HTML.
// ══════════════════════════════════════════════════════════════════════════════

import { identidadAdjunto, clasificarArchivo, TOPE_TOTAL, encajar } from '../../domain/fichas_adjunto.js';
import { mismaIdentidad } from '../../domain/fichas_identidad.js';
import { leerHojaAdjunta, hojasDelLibro } from './diagrama-operativo-lector.js';
import { dibujarHojaAdjunta, LETRA_MINIMA } from './diagrama-operativo-dibujo.js';

/** Marco de la hoja en el Excel (px), el de la plantilla (prueba: cajaOperativo). */
export const CAJA_OPERATIVO = Object.freeze({ w: 1226, h: 611 });
const LADO_MAX = 3000;

const el = (tag, cls, texto) => { const d = document.createElement(tag); if (cls) d.className = cls; if (texto != null) d.textContent = texto; return d; };
const boton = (texto, principal) => { const b = el('button', 'ftm-btn' + (principal ? ' ftm-btn--primario' : ''), texto); b.type = 'button'; return b; };
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const fecha = (d) => (d instanceof Date && !isNaN(d) ? d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** Lienzo → bytes. */
const aBytes = (canvas, mime, calidad) => new Promise((res, rej) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((ab) => res(new Uint8Array(ab)), rej) : rej(new Error('No se pudo convertir la imagen.'))), mime, calidad));

/** Imagen (cualquier formato que el navegador lea) → PNG/JPEG sobre blanco, derecha y sin metadatos. */
async function normalizarImagen(bytes, tipo) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  let w = bmp.width; let h = bmp.height;
  const s = Math.min(1, LADO_MAX / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'); cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  // Las fotos siguen en JPEG; lo demás (capturas, diagramas) en PNG, sin pérdida.
  let mime = tipo === 'jpeg' ? 'image/jpeg' : 'image/png';
  let out = await aBytes(c, mime, 0.92);
  const avisos = [];
  if (out.length > TOPE_TOTAL && mime === 'image/png') { mime = 'image/jpeg'; out = await aBytes(c, mime, 0.92); avisos.push('La imagen se guardó en JPG para que quepa (2,6 MB como máximo).'); }
  if (out.length > TOPE_TOTAL) { out = await aBytes(c, 'image/jpeg', 0.8); mime = 'image/jpeg'; }
  if (out.length > TOPE_TOTAL) throw new Error('La imagen es demasiado pesada aun reducida (' + kb(out.length) + '; máximo 2,6 MB).');
  if (s < 1) avisos.push('La imagen se redujo a ' + w + ' × ' + h + ' px (máximo ' + LADO_MAX + ' por lado).');
  return { bytes: out, mime, anchoPx: w, altoPx: h, avisos };
}

/**
 * Procesa el archivo elegido: {tipo, bytes, mime, ancho, alto, letraPrevista, inventario, hojas, hoja, avisos, origen}.
 * `ancho/alto`: tamaño con que se verá dentro del marco del Excel (px).
 */
export async function procesarArchivo(bytes, nombre, op = {}) {
  const cl = clasificarArchivo(bytes);
  if (!cl.ok) throw new Error(cl.mensaje);
  if (cl.clase === 'imagen') {
    const n = await normalizarImagen(bytes, cl.tipo);
    const e = encajar(n.anchoPx, n.altoPx, CAJA_OPERATIVO);
    return { tipo: 'imagen', bytes: n.bytes, mime: n.mime, ancho: e.ancho, alto: e.alto, letraPrevista: null, inventario: [], hojas: [], hoja: '', avisos: n.avisos, origen: { nombre } };
  }
  const modelo = await leerHojaAdjunta(bytes, op.hoja ? { hoja: op.hoja } : {});
  const hojas = modelo.hojas.filter((h) => h.visible).map((h) => h.nombre);
  const soloImagen = modelo.imagenes.length === 1 && !modelo.celdas.some((c) => String(c.texto || '').trim()) && !modelo.formas.length;
  if (soloImagen) {
    // El Excel trae SOLO una imagen: va la imagen original (mejor calidad que redibujarla).
    const bin = atob(modelo.imagenes[0].base64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const n = await normalizarImagen(u, modelo.imagenes[0].mime === 'image/jpeg' ? 'jpeg' : 'png');
    const e = encajar(n.anchoPx, n.altoPx, CAJA_OPERATIVO);
    return { tipo: 'excel', bytes: n.bytes, mime: n.mime, ancho: e.ancho, alto: e.alto, letraPrevista: null, inventario: modelo.inventario, hojas, hoja: modelo.hoja, avisos: n.avisos, origen: { nombre, hoja: modelo.hoja } };
  }
  const d = await dibujarHojaAdjunta(modelo, CAJA_OPERATIVO);
  let out = d.png; let mime = 'image/png'; const avisos = [];
  if (out.length > TOPE_TOTAL) {
    const bmp = await createImageBitmap(new Blob([out], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    out = await aBytes(c, 'image/jpeg', 0.9); mime = 'image/jpeg';
    avisos.push('El dibujo se guardó en JPG para que quepa (2,6 MB como máximo).');
    if (out.length > TOPE_TOTAL) throw new Error('La hoja es demasiado grande para guardarla (' + kb(out.length) + '). Defina un área de impresión más pequeña en su Excel.');
  }
  if (d.compactado) avisos.push('Las columnas de fechas se angostaron y la fecha va en vertical para que el cronograma completo se lea en la página.');
  return { tipo: 'excel', bytes: out, mime, ancho: d.ancho, alto: d.alto, letraPrevista: d.letraPrevista, inventario: modelo.inventario, hojas, hoja: modelo.hoja, avisos, origen: { nombre, hoja: modelo.hoja } };
}

/**
 * Monta la pestaña dentro de `caja`.
 * @param {HTMLElement} caja
 * @param {{equipo: object, datos: object, alCambiar?: (meta: object|null) => void}} op
 *   datos: { leerMeta(id), leerImagen(id, meta), guardar(ident, datos, reemplazo), quitar(ident, meta), puedeEscribir() }
 */
export function montarDiagramaOperativo(caja, op) {
  const { equipo, datos } = op;
  let vivo = true;
  let urls = []; let nuevas = [];   // imágenes en pantalla / recién creadas para la próxima
  let ident = null; let meta = null; let escribe = false;
  const limpiarUrl = (todas) => { for (const u of urls) URL.revokeObjectURL(u); urls = []; if (todas) { for (const u of nuevas) URL.revokeObjectURL(u); nuevas = []; } };
  // Al repintar se liberan las imágenes de la pantalla ANTERIOR, no las recién creadas.
  const pintar = (...nodos) => { if (!vivo) return; limpiarUrl(false); urls = nuevas; nuevas = []; caja.replaceChildren(...nodos); };
  const aviso = (t, clase) => el('div', clase || 'ftm-nota', t);
  const imagen = (bytes, mime, alt) => {
    const marco = el('div', 'ftm-op-marco');
    const img = el('img', 'ftm-op-img'); img.alt = alt || 'Diagrama Operativo';
    const u = URL.createObjectURL(new Blob([bytes], { type: mime })); nuevas.push(u); img.src = u;
    marco.appendChild(img); return marco;
  };
  const elegir = (alElegir) => {
    const i = el('input'); i.type = 'file'; i.accept = '.xlsx,.xlsm,.png,.jpg,.jpeg,.gif,.webp,.bmp'; i.hidden = true;
    i.addEventListener('change', () => { const f = i.files && i.files[0]; if (f) alElegir(f); });
    document.body.appendChild(i); i.click(); setTimeout(() => i.remove(), 60000);
  };

  async function consultar() {
    pintar(aviso('Consultando el Diagrama Operativo de este transformador…'));
    ident = await identidadAdjunto(equipo);
    if (!vivo) return;
    if (!ident) { pintar(aviso('Este equipo no tiene matrícula ni serie registradas: sin ellas no se puede guardar su Diagrama Operativo.', 'ftm-aviso')); return; }
    try { escribe = !!(await datos.puedeEscribir()); } catch (_) { escribe = false; }
    const r = await datos.leerMeta(ident.id);
    if (!vivo) return;
    if (r.error) {
      const b = boton('Reintentar'); b.addEventListener('click', consultar);
      pintar(aviso('No se pudo consultar el Diagrama Operativo (revise la conexión).', 'ftm-aviso'), b); return;
    }
    meta = r.hay ? r.meta : null;
    if (meta && !mismaIdentidad({ clave: meta.clave, matricula: meta.matricula, serie: meta.serie }, { clave: ident.clave, matricula: ident.matricula, serie: ident.serie })) {
      pintar(aviso('El Diagrama Operativo guardado es de otro aparato con la misma matrícula (otra serie): no se usa.', 'ftm-aviso')); meta = null; return;
    }
    if (op.alCambiar) op.alCambiar(meta);
    return meta ? mostrarGuardado() : mostrarVacio();
  }

  function mostrarVacio() {
    const nodos = [aviso('Esta ficha no tiene Diagrama Operativo: el Excel sale sin esa hoja.')];
    if (escribe) {
      const b = boton('Adjuntar Excel o imagen', true);
      b.addEventListener('click', () => elegir((f) => proponer(f, {})));
      nodos.push(b, aviso('Excel (.xlsx) con su cronograma, o una imagen (PNG, JPG). Antes de guardarlo verá cómo queda en la hoja.', 'ftm-nota-ref'));
    } else nodos.push(aviso('Solo un administrador puede adjuntarlo.', 'ftm-nota-ref'));
    pintar(...nodos);
  }

  async function mostrarGuardado() {
    pintar(aviso('Cargando la imagen guardada…'));
    const r = await datos.leerImagen(ident.id, meta);
    if (!vivo) return;
    const sello = aviso('Guardado en el sistema · ' + (meta.origen && meta.origen.nombre || '') + (meta.origen && meta.origen.hoja ? ' (hoja «' + meta.origen.hoja + '»)' : '')
      + ' · ' + fecha(meta.en) + ' · ' + ((meta.subidoPor && meta.subidoPor.nombre) || '') + '. Lo ven y lo exportan todos; «Descartar» el borrador de la ficha no lo quita.', 'ftm-nota');
    const nodos = [sello];
    if (r.error) nodos.push(aviso(r.mensaje || 'No se pudo leer la imagen guardada.', 'ftm-aviso'));
    else nodos.push(imagen(r.bytes, meta.mime, 'Diagrama Operativo guardado'));
    if (escribe) {
      const rem = boton('Reemplazar'); const qui = boton('Quitar');
      rem.addEventListener('click', () => elegir((f) => proponer(f, {})));
      qui.addEventListener('click', quitar);
      const fila = el('div', 'ftm-op-acciones'); fila.append(rem, qui); nodos.push(fila);
    }
    pintar(...nodos);
  }

  async function proponer(archivo, opc) {
    pintar(aviso('Leyendo «' + archivo.name + '» y dibujándolo como irá en la hoja…'));
    let p;
    try {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      p = await procesarArchivo(bytes, archivo.name, opc);
      p.archivo = archivo;
    } catch (e) {
      const b = boton('Elegir otro archivo'); b.addEventListener('click', () => elegir((f) => proponer(f, {})));
      const v = boton('Volver'); v.addEventListener('click', () => (meta ? mostrarGuardado() : mostrarVacio()));
      pintar(aviso('No se pudo usar el archivo: ' + (e && e.message ? e.message : e), 'ftm-aviso'), b, v); return;
    }
    if (!vivo) return;
    const nodos = [aviso('Así irá en la hoja «Diagrama Operativo» del Excel (página final). Revísela y apruébela.', 'ftm-nota')];
    if (p.hojas.length > 1) {
      const lbl = el('label', 'ftm-op-hoja', 'Hoja del Excel: ');
      const sel = el('select'); for (const n of p.hojas) { const o = el('option', null, n); o.value = n; if (n === p.hoja) o.selected = true; sel.appendChild(o); }
      sel.addEventListener('change', () => proponer(archivo, { hoja: sel.value }));
      lbl.appendChild(sel); nodos.push(lbl);
    }
    nodos.push(imagen(p.bytes, p.mime, 'Vista del Diagrama Operativo'));
    const datosTxt = ['Archivo: ' + p.origen.nombre + (p.hoja ? ' · hoja «' + p.hoja + '»' : ''), 'Peso guardado: ' + kb(p.bytes.length)];
    if (p.letraPrevista != null) datosTxt.push('Letra en el papel: ~' + String(p.letraPrevista).replace('.', ',') + ' pt');
    nodos.push(aviso(datosTxt.join(' · '), 'ftm-nota-ref'));
    for (const a of p.avisos) nodos.push(aviso(a, 'ftm-nota-ref'));
    if (p.letraPrevista != null && p.letraPrevista < LETRA_MINIMA) nodos.push(aviso('Ojo: la letra quedará pequeña en el papel. Si puede, defina en su Excel un área de impresión solo con lo necesario.', 'ftm-aviso'));
    if (p.inventario.length) nodos.push(aviso('No se puede reproducir y NO saldrá: ' + p.inventario.join(', ') + '. En Excel: «Copiar como imagen» y adjunte la imagen, si lo necesita.', 'ftm-aviso'));
    const ok = boton(meta ? 'Guardar y reemplazar el actual' : 'Guardar en el sistema', true); const no = boton('Cancelar');
    ok.addEventListener('click', () => guardar(p, ok, no));
    no.addEventListener('click', () => (meta ? mostrarGuardado() : mostrarVacio()));
    const fila = el('div', 'ftm-op-acciones'); fila.append(ok, no); nodos.push(fila);
    pintar(...nodos);
  }

  async function guardar(p, ok, no) {
    if (p.inventario.length && !globalThis.confirm('Hay partes del Excel que NO saldrán (' + p.inventario.join(', ') + '). ¿Guardar así?')) return;
    if (meta && !globalThis.confirm('Se reemplaza «' + ((meta.origen && meta.origen.nombre) || 'el actual') + '» por «' + p.origen.nombre + '». El anterior no se conserva (queda anotado en el registro). ¿Continuar?')) return;
    ok.disabled = true; no.disabled = true; ok.textContent = 'Guardando…';
    try {
      meta = await datos.guardar(ident, { tipo: p.tipo, origen: p.origen, mime: p.mime, ancho: p.ancho, alto: p.alto, bytes: p.bytes }, !!meta);
      if (op.alCambiar) op.alCambiar(meta);
      await mostrarGuardado();
    } catch (e) {
      ok.disabled = false; no.disabled = false; ok.textContent = 'Guardar en el sistema';
      caja.appendChild(aviso('No se guardó: ' + (e && e.message ? e.message : e), 'ftm-aviso'));
    }
  }

  async function quitar() {
    if (!globalThis.confirm('¿Quitar el Diagrama Operativo de este transformador? El Excel saldrá sin esa hoja. Queda anotado en el registro quién lo quitó y cuándo.')) return;
    try {
      await datos.quitar(ident, meta);
      meta = null;
      if (op.alCambiar) op.alCambiar(null);
      mostrarVacio();
    } catch (e) { caja.appendChild(aviso('No se quitó: ' + (e && e.message ? e.message : e), 'ftm-aviso')); }
  }

  consultar();
  return { destruir() { vivo = false; limpiarUrl(true); } };
}

/** Las hojas de un Excel (para quien quiera el listado sin dibujar). */
export { hojasDelLibro };
