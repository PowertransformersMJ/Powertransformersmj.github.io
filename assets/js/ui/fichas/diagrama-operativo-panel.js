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
import { hojasDelLibro } from './diagrama-operativo-lector.js';
import { planoHomologado, svgDeHoja, LETRA_MINIMA } from './diagrama-operativo-dibujo.js';
import { leerEnTrabajador, rasterizarSvg, revisarPesoSvg } from './diagrama-operativo-seguro.js';

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
  // Leer y calcular el dibujo, en otro hilo con tiempo límite (CF-40): la página nunca se traba.
  const { modelo, dibujo } = await leerEnTrabajador({ tipo: 'leer', bytes, hoja: op.hoja || '', caja: CAJA_OPERATIVO }, { senal: op.senal });
  const hojas = modelo.hojas.filter((h) => h.visible).map((h) => h.nombre);
  const soloImagen = modelo.imagenes.length === 1 && !modelo.celdas.some((c) => String(c.texto || '').trim()) && !modelo.formas.length;
  if (soloImagen) {
    // El Excel trae SOLO una imagen: va la imagen original (mejor calidad que redibujarla).
    const bin = atob(modelo.imagenes[0].base64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const n = await normalizarImagen(u, modelo.imagenes[0].mime === 'image/jpeg' ? 'jpeg' : 'png');
    const e = encajar(n.anchoPx, n.altoPx, CAJA_OPERATIVO);
    return { tipo: 'excel', bytes: n.bytes, mime: n.mime, ancho: e.ancho, alto: e.alto, letraPrevista: null, inventario: modelo.inventario, hojas, hoja: modelo.hoja, avisos: n.avisos, origen: { nombre, hoja: modelo.hoja } };
  }
  let g = dibujo;
  if (!g) {
    // Respaldo (el trabajador no pudo medir textos o no arrancó): lo mismo que `dibujarHojaAdjunta`, con el peso revisado.
    const plano = planoHomologado(modelo, CAJA_OPERATIVO); const r = svgDeHoja(modelo, plano);
    revisarPesoSvg(r.svg); g = { svg: r.svg, w: r.w, h: r.h, plano };
  }
  if (op.senal && op.senal.aborted) { const x = new Error('Lectura cancelada.'); x.cancelado = true; throw x; }
  const d = { ...(await rasterizarSvg(g.svg, g.w, g.h, g.plano.s)), letraPrevista: g.plano.letraPrevista, compactado: g.plano.compactado };
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
 *   datos: { leerMeta(id), leerImagen(id, meta), guardar(ident, datos, reemplazo), quitar(ident, meta), puedeEscribir(), puedeQuitar()? }
 *   (puedeEscribir: adjuntar y reemplazar — admin o con permiso, `99 §118`; puedeQuitar: solo admin)
 */
export function montarDiagramaOperativo(caja, op) {
  const { equipo, datos } = op;
  let vivo = true;
  let lectura = null;   // AbortController de la lectura en curso (CF-40: cerrar la pestaña o elegir otro archivo la cancela)
  let urls = []; let nuevas = [];   // imágenes en pantalla / recién creadas para la próxima
  let ident = null; let meta = null; let escribe = false; let quita = false;
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

  let ajena = null;              // meta de OTRO aparato con la misma matrícula (repuesto)
  let nodoError = null;
  const mostrarError = (t) => {
    if (nodoError && nodoError.isConnected) nodoError.textContent = t;
    else { nodoError = aviso(t, 'ftm-aviso'); caja.appendChild(nodoError); }
  };
  /** Mensaje en español de un error de Firebase o de red. */
  const traducir = (e) => {
    const code = e && e.code ? String(e.code) : '';
    if (/permission-denied/.test(code)) return 'no tiene permiso para esta acción (solo un administrador, o quien él autorice). Si se lo acaban de dar o quitar, recargue la página.';
    if (/unavailable|deadline-exceeded|network/.test(code)) return 'sin conexión con el sistema; vuelva a intentarlo.';
    return e && e.message ? e.message : String(e);
  };
  /** Una escritura sin red no termina nunca (Firestore la deja pendiente): tope de 30 s. */
  const conTope = (promesa) => Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error('sin conexión: no se completó en 30 segundos. Vuelva a intentarlo cuando tenga red.')), 30000))]);

  async function consultar() {
    pintar(aviso('Consultando el Diagrama Operativo de este transformador…'));
    let r;
    try {
      ident = await identidadAdjunto(equipo);
      if (!vivo) return;
      if (!ident) { pintar(aviso('Este equipo no tiene matrícula ni serie registradas: sin ellas no se puede guardar su Diagrama Operativo.', 'ftm-aviso')); return; }
      try { escribe = !!(await datos.puedeEscribir()); } catch (_) { escribe = false; }
      // Si la página (caché vieja) no trae puedeQuitar, «Quitar» queda oculto: el admin lo recupera al recargar.
      try { quita = escribe && (typeof datos.puedeQuitar === 'function' ? !!(await datos.puedeQuitar()) : false); } catch (_) { quita = false; }
      r = await datos.leerMeta(ident.id);
    } catch (e) { r = { error: true }; }
    if (!vivo) return;
    if (r.error) {
      const b = boton('Reintentar'); b.addEventListener('click', consultar);
      pintar(aviso(r.mensaje || 'No se pudo consultar el Diagrama Operativo (revise la conexión).', 'ftm-aviso'), b); return;
    }
    meta = r.hay ? r.meta : null; ajena = null;
    if (meta && !mismaIdentidad({ clave: meta.clave, matricula: meta.matricula, serie: meta.serie }, { clave: ident.clave, matricula: ident.matricula, serie: ident.serie })) {
      ajena = meta; meta = null;
    }
    if (op.alCambiar) op.alCambiar(meta);
    if (ajena) return mostrarAjeno();
    return meta ? mostrarGuardado() : mostrarVacio();
  }

  /** Transformador REPUESTO que heredó la matrícula: el adjunto guardado es del aparato anterior. */
  function mostrarAjeno() {
    const nodos = [aviso('El Diagrama Operativo guardado con esta matrícula es de otro aparato (serie ' + (ajena.serie || 'sin serie') + '): no se usa en esta ficha.', 'ftm-aviso')];
    if (escribe) {
      const adj = boton('Adjuntar el de este equipo', true);
      adj.addEventListener('click', () => elegir((f) => proponer(f, {})));
      const fila = el('div', 'ftm-op-acciones'); fila.append(adj);
      if (quita) { const qui = boton('Quitar el del aparato anterior'); qui.addEventListener('click', () => quitar(qui)); fila.append(qui); }
      nodos.push(fila);
    } else nodos.push(aviso('Solo un administrador, o quien él autorice, puede cambiarlo (si se lo acaban de autorizar, recargue la página).', 'ftm-nota-ref'));
    pintar(...nodos);
  }

  function mostrarVacio() {
    const nodos = [aviso('Esta ficha no tiene Diagrama Operativo: el Excel sale sin esa hoja.')];
    if (escribe) {
      const b = boton('Adjuntar Excel o imagen', true);
      b.addEventListener('click', () => elegir((f) => proponer(f, {})));
      nodos.push(b, aviso('Excel (.xlsx) con su cronograma, o una imagen (PNG, JPG). Antes de guardarlo verá cómo queda en la hoja.', 'ftm-nota-ref'));
    } else nodos.push(aviso('Solo un administrador, o quien él autorice, puede adjuntarlo (si se lo acaban de autorizar, recargue la página).', 'ftm-nota-ref'));
    pintar(...nodos);
  }

  async function mostrarGuardado() {
    pintar(aviso('Cargando la imagen guardada…'));
    let r;
    try { r = await datos.leerImagen(ident.id, meta); } catch (e) { r = { error: true, mensaje: 'No se pudo leer la imagen guardada (' + traducir(e) + ')' }; }
    if (!vivo) return;
    const sello = aviso('Guardado en el sistema · ' + (meta.origen && meta.origen.nombre || '') + (meta.origen && meta.origen.hoja ? ' (hoja «' + meta.origen.hoja + '»)' : '')
      + ' · ' + fecha(meta.en) + ' · ' + ((meta.subidoPor && meta.subidoPor.nombre) || '') + '. Lo ven y lo exportan todos; «Descartar» el borrador de la ficha no lo quita.', 'ftm-nota');
    const nodos = [sello];
    if (r.error) nodos.push(aviso(r.mensaje || 'No se pudo leer la imagen guardada.', 'ftm-aviso'));
    else nodos.push(imagen(r.bytes, meta.mime, 'Diagrama Operativo guardado'));
    if (escribe) {
      const rem = boton('Reemplazar');
      rem.addEventListener('click', () => elegir((f) => proponer(f, {})));
      const fila = el('div', 'ftm-op-acciones'); fila.append(rem);
      // Quitar (borra la imagen) es solo del administrador (`99 §118`); corregir = reemplazar.
      if (quita) { const qui = boton('Quitar'); qui.addEventListener('click', () => quitar(qui, rem)); fila.append(qui); }
      nodos.push(fila);
    }
    pintar(...nodos);
  }

  /** Selector de hojas visibles (también cuando la hoja por defecto no se pudo leer). */
  function selectorHojas(archivo, hojas, actualNombre) {
    const lbl = el('label', 'ftm-op-hoja', 'Hoja del Excel: ');
    const sel = el('select');
    for (const n of hojas) { const o = el('option', null, n); o.value = n; if (n === actualNombre) o.selected = true; sel.appendChild(o); }
    sel.addEventListener('change', () => proponer(archivo, { hoja: sel.value }));
    lbl.appendChild(sel); return lbl;
  }

  async function proponer(archivo, opc) {
    pintar(aviso('Leyendo «' + archivo.name + '» y dibujándolo como irá en la hoja…'));
    if (lectura) lectura.abort();
    lectura = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const senal = lectura ? lectura.signal : undefined;
    let p; let bytes = null;
    try {
      bytes = new Uint8Array(await archivo.arrayBuffer());
      p = await procesarArchivo(bytes, archivo.name, { ...opc, senal });
      p.archivo = archivo;
    } catch (e) {
      // Si es un Excel con varias hojas, se puede elegir OTRA aunque esta haya fallado.
      let hojas = [];
      if (e && e.cancelado) return;
      // Listar las hojas es barato (solo el libro); tras un tiempo agotado, con límite corto.
      try { if (bytes && clasificarArchivo(bytes).clase === 'excel') hojas = (await leerEnTrabajador({ tipo: 'hojas', bytes }, { senal, limite: e && e.tiempo ? 5000 : undefined })).hojas.filter((h) => h.visible).map((h) => h.nombre); } catch (_) { hojas = []; }
      if (!vivo) return;
      const nodos = [aviso('No se pudo usar ' + (opc.hoja ? 'la hoja «' + opc.hoja + '»' : 'el archivo') + ': ' + traducir(e), 'ftm-aviso')];
      if (hojas.length > 1) { nodos.push(aviso('Puede elegir otra hoja del mismo Excel:', 'ftm-nota-ref')); nodos.push(selectorHojas(archivo, hojas, opc.hoja || '')); }
      const b = boton('Elegir otro archivo'); b.addEventListener('click', () => elegir((f) => proponer(f, {})));
      const v = boton('Volver'); v.addEventListener('click', () => (meta ? mostrarGuardado() : ajena ? mostrarAjeno() : mostrarVacio()));
      const fila = el('div', 'ftm-op-acciones'); fila.append(b, v); nodos.push(fila);
      pintar(...nodos); return;
    }
    if (!vivo) return;
    const nodos = [aviso('Así irá en la hoja «Diagrama Operativo» del Excel (página final). Revísela y apruébela.', 'ftm-nota')];
    if (p.hojas.length > 1) nodos.push(selectorHojas(archivo, p.hojas, p.hoja));
    nodos.push(imagen(p.bytes, p.mime, 'Vista del Diagrama Operativo'));
    const datosTxt = ['Archivo: ' + p.origen.nombre + (p.hoja ? ' · hoja «' + p.hoja + '»' : ''), 'Peso guardado: ' + kb(p.bytes.length)];
    if (p.letraPrevista != null) datosTxt.push('Letra en el papel: ~' + String(p.letraPrevista).replace('.', ',') + ' pt');
    nodos.push(aviso(datosTxt.join(' · '), 'ftm-nota-ref'));
    for (const a of p.avisos) nodos.push(aviso(a, 'ftm-nota-ref'));
    if (p.letraPrevista != null && p.letraPrevista < LETRA_MINIMA) nodos.push(aviso('Ojo: la letra quedará en ~' + String(p.letraPrevista).replace('.', ',') + ' pt, pequeña para leerla en el papel. Si puede, defina en su Excel un área de impresión solo con lo necesario (menos actividades o menos días por hoja).', 'ftm-aviso'));
    if (p.inventario.length) nodos.push(aviso('No se puede reproducir y NO saldrá: ' + p.inventario.join(', ') + '. En Excel: «Copiar como imagen» y adjunte la imagen, si lo necesita.', 'ftm-aviso'));
    const previo = meta || ajena;
    const ok = boton(previo ? 'Guardar y reemplazar el actual' : 'Guardar en el sistema', true); const no = boton('Cancelar');
    ok.addEventListener('click', () => guardar(p, ok, no));
    no.addEventListener('click', () => (meta ? mostrarGuardado() : ajena ? mostrarAjeno() : mostrarVacio()));
    const fila = el('div', 'ftm-op-acciones'); fila.append(ok, no); nodos.push(fila);
    pintar(...nodos);
  }

  async function guardar(p, ok, no) {
    const previo = meta || ajena;
    if (p.letraPrevista != null && p.letraPrevista < LETRA_MINIMA && !globalThis.confirm('La letra quedará en ~' + String(p.letraPrevista).replace('.', ',') + ' pt en el papel, pequeña para leerla. ¿Guardar así?')) return;
    if (p.inventario.length && !globalThis.confirm('Hay partes del Excel que NO saldrán (' + p.inventario.join(', ') + '). ¿Guardar así?')) return;
    if (previo && !globalThis.confirm('Se reemplaza «' + ((previo.origen && previo.origen.nombre) || 'el actual') + '» por «' + p.origen.nombre + '». El anterior no se conserva (queda anotado en el registro). ¿Continuar?')) return;
    ok.disabled = true; no.disabled = true; ok.textContent = 'Guardando…';
    try {
      meta = await conTope(datos.guardar(ident, { tipo: p.tipo, origen: p.origen, mime: p.mime, ancho: p.ancho, alto: p.alto, bytes: p.bytes }, previo));
      ajena = null;
      if (op.alCambiar) op.alCambiar(meta);
      await mostrarGuardado();
    } catch (e) {
      ok.disabled = false; no.disabled = false; ok.textContent = previo ? 'Guardar y reemplazar el actual' : 'Guardar en el sistema';
      // Con varios que adjuntan (`99 §118`): si otro guardó mientras tanto, decirlo (no «sin permiso»).
      if (e && /permission-denied/.test(String(e.code || ''))) {
        let ahora = null;
        try { const r = await datos.leerMeta(ident.id); ahora = r && r.hay ? r.meta : (r && r.error ? undefined : null); } catch (_) { ahora = undefined; }
        const antes = previo ? previo.lote : null; const despues = ahora ? ahora.lote : (ahora === null ? null : antes);
        if (despues !== antes) {
          mostrarError('No se guardó: mientras tanto otra persona cambió el Diagrama Operativo de este equipo. Recargue la página para verlo y, si hace falta, reemplácelo.');
          return;
        }
      }
      mostrarError('No se guardó: ' + traducir(e));
    }
  }

  async function quitar(...botones) {
    const previo = meta || ajena;
    if (!previo) return;
    if (!globalThis.confirm('¿Quitar el Diagrama Operativo ' + (ajena && !meta ? 'del aparato anterior' : 'de este transformador') + '? El Excel saldrá sin esa hoja. Queda anotado en el registro quién lo quitó y cuándo.')) return;
    const textos = botones.map((b) => b.textContent);
    botones.forEach((b) => { b.disabled = true; }); if (botones[0]) botones[0].textContent = 'Quitando…';
    try {
      await conTope(datos.quitar(ident, previo));
      meta = null; ajena = null;
      if (op.alCambiar) op.alCambiar(null);
      mostrarVacio();
    } catch (e) {
      botones.forEach((b, k) => { if (b.isConnected) { b.disabled = false; b.textContent = textos[k]; } });
      mostrarError('No se quitó: ' + traducir(e));
    }
  }

  consultar();
  return { destruir() { vivo = false; if (lectura) lectura.abort(); limpiarUrl(true); } };
}

/** Las hojas de un Excel (para quien quiera el listado sin dibujar). */
export { hojasDelLibro };
