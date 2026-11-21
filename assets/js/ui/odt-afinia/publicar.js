// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · PUBLICAR (solo administrador)
// ──────────────────────────────────────────────────────────────────────────────
//   1. Elegir el PDF → se leen sus bytes UNA vez y se muestra su huella SHA-256
//      (para compararla con la del archivo en el equipo). Cada elección lleva un
//      TOKEN de generación: si se elige otro archivo mientras el anterior se procesa,
//      el viejo no pinta nada y su lectura de pdf.js se cierra.
//   2. pdf.js extrae texto, anotaciones y tinta; pdf-lib (vendorizado) su estructura.
//      El dominio valida el formato (2 páginas Carta, título, pie, etiquetas, N.º)
//      y que las cuatro casillas lleguen VACÍAS, con DOS revisiones: la tinta del
//      raster (pdf.js) y la ESTRUCTURAL del contenido (pdf-lib: imágenes, trazos,
//      texto y anotaciones dentro de cada casilla).
//   3. Datos de la ODT y firmantes: SOLO de la lista blanca de su rol
//      (odt_afinia_config/firmantes, la escribe el Ingeniero en la consola), entre los
//      habilitados con perfil activo; distintos entre sí y el AZT nunca es quien publica
//      (el Responsable sí puede ser el admin: D5).
//      Al validar se consulta si el N.º ya se publicó: con la vigente ANULADA o REEMPLAZADA
//      se puede volver a publicar (la nueva guarda `reemplaza` = la anterior); con la vigente
//      pendiente, LISTA o CERRADA se dice por qué no, antes de enviar nada (2026-11-21).
//   4. Publicar: un lote (ODT + partes + candado del N.º). Después se RELEE del
//      servidor y se compara la huella. Si el lote no responde a tiempo queda
//      «pendiente» (NO repita) y se espera su desenlace.
//      Sin el aviso D5 de «5 minutos» antes de publicar (quitado el 2026-11-21): desde la
//      decisión del Ingeniero de pedir la contraseña solo al iniciar sesión, cualquier sesión
//      abierta con correo y contraseña puede firmar, a cualquier hora; esperar ya no
//      protegía nada y el aviso decía algo falso. Queda el compromiso: Claude nunca pulsa
//      «Firmar» ni «Confirmar firma» en ninguna sesión.
// Publicar NO pide contraseña (D4: publicar sí, firmar nunca).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ROL, esNro } from '../../domain/odt_afinia_rutas.js';
import { errorFirmantes, ETIQUETA_ESTADO } from '../../domain/odt_afinia_estados.js';
import { etiquetaEstado } from '../../domain/odt_afinia_cierre.js';
import { estructuraConPdfLib, conTextos, validarOdt, nrosEnTexto } from '../../domain/odt_afinia_formato.js';
import { textoDePagina, CLAVES_ZONA, ANCLAS_CALIBRADAS } from '../../domain/odt_afinia_zonas.js';
import { revisarCasillas } from '../../domain/odt_afinia_casilla.js';
import { revisarEstructura } from '../../domain/odt_afinia_estructura.js';
import { esPdf, prepararPartes, presupuesto, huella } from '../../domain/odt_afinia_partes.js';
import { esFechaDMA } from '../../domain/odt_afinia_textos.js';
import { MSG_FALTA_LISTA_BLANCA } from '../../data/odt_afinia.js';
import { h, vaciar, aviso, mensajeDe, cargarPdfLib, fechaHora } from './comun.js';
import { pintarPdf, leerParaPublicar } from './vista-pdf.js';

const NOMBRES_CASILLA = { azt: 'AZT EN SITIO', responsable: 'RESPONSABLE O.D.T.', si: 'SI', fecha: 'FECHA CIERRE' };

const LLANO = Object.freeze({ imagen: 'una imagen', trazo: 'trazos dibujados', texto: 'texto escrito' });

/** Texto de los motivos de una casilla ocupada (tinta del raster y revisión estructural). */
export function motivosEnLlano(motivos) {
  const partes = [];
  for (const m of motivos) {
    let t;
    if (m.startsWith('anotacion:')) t = 'una anotación (' + m.slice(10) + ')';
    else if (m.startsWith('tinta')) t = 'tinta';
    else if (m.startsWith('formulario:')) t = 'un formulario incrustado con ' + (LLANO[m.slice(11)] || m.slice(11));
    else t = LLANO[m] || m;
    if (!partes.includes(t)) partes.push(t);
  }
  return 'trae ' + partes.join(' y ');
}

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, sesion:object, alPublicar:(odtId:string)=>void}} p
 *        (app.js aún pasa `cuenta`: ya no se usa aquí desde que salió el aviso D5, 2026-11-21).
 */
export async function montarPublicar(contenedor, { repo, sesion, alPublicar }) {
  vaciar(contenedor);
  if (!sesion.esAdmin || sesion.legacy) {
    contenedor.appendChild(aviso(sesion.legacy
      ? 'Su cuenta de administrador no tiene perfil en la plataforma: créelo antes de publicar.'
      : 'Solo un administrador publica ODT.', 'error'));
    return;
  }

  /** Estado de ESTA publicación (se reinicia al elegir otro archivo). */
  let st = null;
  /** Token de generación: cada archivo elegido sube el número; lo viejo no pinta. */
  let gen = 0;
  /** La lectura de pdf.js abierta (la de la generación vigente): se cierra al cambiar o publicar. */
  let lecturaViva = null;
  const cerrarLectura = () => { if (lecturaViva) { const l = lecturaViva; lecturaViva = null; l.cerrar(); } };

  const entrada = h('input', { type: 'file', accept: 'application/pdf', id: 'odtArchivo', class: 'odt-oculto' });
  const zonaArchivo = h('div', { class: 'odt-bloque' });
  const zonaDatos = h('div', { class: 'odt-bloque' });
  const zonaVista = h('div', { class: 'odt-vista' });
  // Sin nulos en append(): el navegador los pintaría como el texto «null» (99 §231.12).
  contenedor.append(...[
    h('p', { class: 'odt-parrafo', text: 'Publique la ODT tal como la va a entregar: el PDF original de 2 páginas, sin firmas. Después la firman el AZT y el Responsable, cada uno desde su cuenta.' }),
    ANCLAS_CALIBRADAS ? null : aviso('Las posiciones de las casillas todavía no se han calibrado con ODT reales: si una ODT verdadera se rechaza por «etiquetas», avise para calibrarlas.', 'aviso'),
    h('div', { class: 'odt-acciones' }, h('label', { class: 'odt-btn odt-btn--primario', htmlFor: 'odtArchivo', text: 'Elegir el PDF de la ODT' }), entrada),
    zonaArchivo, zonaDatos, zonaVista].filter(Boolean));

  entrada.addEventListener('change', async () => {
    const archivo = entrada.files && entrada.files[0];
    entrada.value = '';
    if (!archivo) return;
    const g = ++gen;
    cerrarLectura();                               // libera el PDF anterior en pdf.js
    st = null;
    const vigente = () => g === gen;
    vaciar(zonaArchivo); vaciar(zonaDatos); vaciar(zonaVista);
    zonaArchivo.appendChild(h('p', { class: 'odt-cargando', text: 'Leyendo el archivo…' }));
    let lectura = null;
    try {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (!vigente()) return;
      if (!esPdf(bytes)) throw new Error('El archivo no es un PDF.');
      const pres = presupuesto(bytes.length);
      if (!pres.ok) throw new Error(pres.mensaje);
      const preparado = await prepararPartes(bytes);
      const PDFLib = await cargarPdfLib();
      const estructura = await estructuraConPdfLib(bytes.slice(), PDFLib);
      if (!vigente()) return;
      lectura = await leerParaPublicar(bytes);
      if (!vigente()) { lectura.cerrar(); return; }
      lecturaViva = lectura;
      const doc = conTextos(estructura, lectura.itemsPorPagina);
      const nrosLeidos = nrosEnTexto(textoDePagina(lectura.itemsPorPagina[0] || []));
      st = { bytes, preparado, doc, lectura, PDFLib, nrosLeidos, nombreArchivo: archivo.name, gen: g };
      vaciar(zonaArchivo);
      zonaArchivo.append(
        h('h3', { class: 'odt-subtitulo', text: '1. Archivo elegido' }),
        h('dl', { class: 'odt-datos' },
          h('div', { class: 'odt-dato' }, h('dt', { text: 'Archivo' }), h('dd', { text: archivo.name })),
          h('div', { class: 'odt-dato' }, h('dt', { text: 'Tamaño' }), h('dd', { text: (bytes.length / 1024).toFixed(0) + ' KB en ' + preparado.partes.length + ' parte(s)' })),
          h('div', { class: 'odt-dato' }, h('dt', { text: 'Huella SHA-256' }), h('dd', { class: 'odt-mono odt-romper', text: preparado.huella }))),
        h('p', { class: 'odt-mini', text: 'Esta huella identifica el archivo byte a byte: compárela con la del archivo en su equipo antes de publicar.' }));
      // Un contenedor NUEVO por elección: una vista vieja que termine tarde pinta en un nodo retirado.
      const vista = h('div', { class: 'odt-vista-archivo' });
      vaciar(zonaVista); zonaVista.appendChild(vista);
      await Promise.all([pintarFormulario(g), pintarPdf(bytes, vista, { titulo: 'Vista previa del original (no se imprime)' })]);
    } catch (e) {
      if (lectura && lectura !== lecturaViva) lectura.cerrar();
      if (!vigente()) return;
      cerrarLectura(); st = null;
      vaciar(zonaArchivo); vaciar(zonaDatos); vaciar(zonaVista);
      zonaArchivo.appendChild(aviso(mensajeDe(e), 'error'));
    }
  });

  function campo(id, etiqueta, attrs = {}) {
    const inp = h('input', { id, class: 'odt-campo', type: 'text', ...attrs });
    return { inp, el: h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: etiqueta }), inp) };
  }

  async function pintarFormulario(g) {
    const vigente = () => g === gen && st && st.gen === g;
    vaciar(zonaDatos);
    zonaDatos.appendChild(h('h3', { class: 'odt-subtitulo', text: '2. Datos y firmantes' }));
    const leyendo = h('p', { class: 'odt-cargando', text: 'Leyendo la lista blanca de firmantes…' });
    zonaDatos.appendChild(leyendo);
    let cand;
    try {
      cand = await repo.candidatos();
    } catch (e) {
      if (!vigente()) return;
      leyendo.remove();
      zonaDatos.appendChild(aviso('No se pudo leer la lista de firmantes: ' + mensajeDe(e), 'error'));
      return;
    }
    if (!vigente()) return;
    leyendo.remove();
    if (!cand.config) { zonaDatos.appendChild(aviso(MSG_FALTA_LISTA_BLANCA, 'error')); return; }
    if (!cand.azt.length || !cand.responsable.length) {
      zonaDatos.appendChild(aviso('Falta alguien que se pueda elegir: hace falta al menos una persona HABILITADA en la lista blanca de AZT EN SITIO y otra en la de RESPONSABLE O.D.T. (la lista blanca la cambia el Ingeniero en la consola; cada persona se habilita en «Habilitarme»).', 'aviso'));
    }
    if (cand.fuera.length) {
      zonaDatos.appendChild(aviso('Habilitados que no se ofrecen: ' + cand.fuera.map((f) => (f.nombre || 'sin nombre') + ' (' + f.motivo + ')').join('; ') + '.', 'info'));
    }

    const fNro = campo('odtNro', 'N.º de ODT (8 dígitos, confírmelo contra el PDF)', { inputmode: 'numeric', maxLength: 8, value: st.nrosLeidos.length === 1 ? st.nrosLeidos[0] : '' });
    const fCons = campo('odtConsignacion', 'Consignación (opcional)', { maxLength: 60 });
    const fSub = campo('odtSubestacion', 'Subestación', { maxLength: 120 });
    const fEq = campo('odtEquipo', 'Equipo', { maxLength: 120 });
    const fFecha = campo('odtFechaTrabajo', 'Fecha prevista de la orden (dd/mm/aaaa)', { maxLength: 10, placeholder: 'dd/mm/aaaa' });
    const opciones = (lista) => [h('option', { value: '', text: '— elija —' }),
      ...lista.map((x) => h('option', { value: x.uid, text: x.nombre + ' · ' + x.correo }))];
    const sAzt = h('select', { id: 'odtAzt', class: 'odt-campo' }, opciones(cand.azt));
    const sResp = h('select', { id: 'odtResp', class: 'odt-campo' }, opciones(cand.responsable));
    const estado = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
    const btnValidar = h('button', { type: 'button', class: 'odt-btn', text: 'Validar la ODT' });
    const btnPublicar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Publicar', disabled: true });

    if (st.nrosLeidos.length > 1) zonaDatos.appendChild(aviso('En la página 1 aparecen varios números de 8 dígitos (' + st.nrosLeidos.join(', ') + '): escriba el de la ODT.', 'info'));
    zonaDatos.append(fNro.el, fCons.el, fSub.el, fEq.el, fFecha.el,
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtAzt', text: ETIQUETA_ROL.azt + ' (lista blanca; nunca quien publica)' }), sAzt),
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtResp', text: ETIQUETA_ROL.responsable + ' (lista blanca)' }), sResp),
      h('div', { class: 'odt-acciones' }, btnValidar, btnPublicar), estado);

    let validado = null;
    const invalidar = () => { validado = null; btnPublicar.disabled = true; };
    for (const x of [fNro.inp, fCons.inp, fSub.inp, fEq.inp, fFecha.inp, sAzt, sResp]) x.addEventListener('input', invalidar);
    for (const x of [sAzt, sResp]) x.addEventListener('change', invalidar);

    btnValidar.addEventListener('click', async () => {
      invalidar(); vaciar(estado);
      if (!vigente()) return;
      const form = { nro: fNro.inp.value.trim(), consignacion: fCons.inp.value.trim(), subestacion: fSub.inp.value.trim(), equipo: fEq.inp.value.trim(), fechaTrabajo: fFecha.inp.value.trim() };
      const errores = [];
      const v = validarOdt(st.doc, { nro: form.nro });
      if (!v.ok) errores.push(...v.errores.map((e) => e.mensaje));
      if (!form.subestacion) errores.push('Escriba la subestación.');
      if (!form.equipo) errores.push('Escriba el equipo.');
      if (!esFechaDMA(form.fechaTrabajo)) errores.push('La fecha prevista de la orden debe ser dd/mm/aaaa (es la FECHA CIERRE que estampa el Responsable).');
      // ¿El N.º ya se publicó? Libre si la vigente está ANULADA o REEMPLAZADA; si no, se dice ya.
      let previa = null;
      if (esNro(form.nro) && typeof repo.previaDelNro === 'function') {
        try { previa = await repo.previaDelNro(form.nro); } catch (e) { errores.push('No se pudo comprobar si el N.º ya está publicado: ' + mensajeDe(e)); }
      }
      if (previa && !previa.libre) errores.push(previa.mensaje);
      const azt = cand.azt.find((x) => x.uid === sAzt.value); const responsable = cand.responsable.find((x) => x.uid === sResp.value);
      const errF = errorFirmantes({ azt, responsable }, sesion.uid);
      if (errF) errores.push(errF);
      if (v.ok) {
        // Dos revisiones de las casillas: tinta del raster (pdf.js) y ESTRUCTURA del contenido (pdf-lib).
        const ocupadas = new Map();
        const anotar = (lista) => { for (const o of lista) ocupadas.set(o.clave, [...(ocupadas.get(o.clave) || []), ...o.motivos]); };
        try {
          const tintas = await st.lectura.medirTintas(v.zonas, CLAVES_ZONA);
          const rc = revisarCasillas(v.zonas, { anotaciones: st.lectura.anotaciones, tintas });
          anotar(rc.ocupadas);
          for (const c of rc.sinMedir) errores.push('No se pudo medir la tinta de la casilla «' + NOMBRES_CASILLA[c] + '».');
        } catch (e) { errores.push('No se pudo medir la tinta de las casillas: ' + mensajeDe(e)); }
        try {
          const re = await revisarEstructura(st.bytes, v.zonas, st.PDFLib, { claves: CLAVES_ZONA });
          if (re.error) errores.push(re.error + ' No se publica sin revisar las casillas.');
          anotar(re.ocupadas);
        } catch (e) { errores.push('No se pudo revisar el contenido de las casillas: ' + mensajeDe(e)); }
        for (const [clave, motivos] of ocupadas) {
          errores.push('La casilla «' + NOMBRES_CASILLA[clave] + '» ya ' + motivosEnLlano(motivos) + ': publique el PDF sin firmas ni marcas en las casillas.');
        }
      }
      if (!vigente()) return;
      if (errores.length) { estado.appendChild(h('ul', { class: 'odt-errores' }, errores.map((t) => h('li', { text: t })))); return; }
      validado = { form, zonas: v.zonas, firmantes: { azt, responsable } };
      estado.appendChild(aviso('La ODT cumple el formato y sus casillas están vacías (tinta y contenido). AZT: ' + azt.nombre + ' · Responsable: ' + responsable.nombre + '. Ya puede publicarla.', 'ok'));
      if (previa && previa.libre) {
        estado.appendChild(aviso('Este N.º ya se publicó antes (' + etiquetaEstado(previa.estado, ETIQUETA_ESTADO).toLowerCase()
          + (Number.isFinite(previa.publicadoEnMs) ? ', publicada el ' + fechaHora(previa.publicadoEnMs) : '') + '): la nueva publicación queda como su reemplazo.', 'info'));
      }
      btnPublicar.disabled = false;
    });

    btnPublicar.addEventListener('click', async () => {
      if (!validado || !vigente()) return;
      // Botones ocupados desde el primer clic: no hay doble envío. Sin aviso D5 (2026-11-21, ver cabecera).
      btnPublicar.disabled = true; btnValidar.disabled = true;
      await publicarYa();
    });

    async function publicarYa() {
      if (!validado || !vigente()) return;
      const pub = validado; const preparado = st.preparado;
      vaciar(estado); estado.appendChild(h('p', { class: 'odt-cargando', text: 'Publicando…' }));
      const fallo = (e) => {
        if (!vigente()) return;
        vaciar(estado); estado.appendChild(aviso(mensajeDe(e), 'error'));
        btnValidar.disabled = false;
      };
      const comprobarYSalir = async (id) => {
        vaciar(estado); estado.appendChild(h('p', { class: 'odt-cargando', text: 'Publicada. Comprobando en el servidor…' }));
        const leida = await repo.leerOdt(id);
        const hx = await huella(leida.bytesV0);
        if (hx !== preparado.huella) throw new Error('La ODT quedó publicada pero lo leído del servidor no coincide con el archivo. Avise al administrador.');
        if (!vigente()) return;
        vaciar(estado); estado.appendChild(aviso('ODT N.º ' + pub.form.nro + ' publicada y comprobada en el servidor (misma huella). Ahora la firma el AZT desde su cuenta.', 'ok'));
        cerrarLectura(); st = null;               // libera pdf.js antes de cambiar de vista
        alPublicar(id);
      };
      try {
        const r = await repo.publicar({ ...pub, preparado });
        if (r && r.estado === 'pendiente') {
          // El lote sigue en cola: NO se ofrece publicar otra vez hasta que termine.
          vaciar(estado); estado.appendChild(aviso(r.mensaje, 'aviso'));
          r.final.then(() => comprobarYSalir(r.id)).catch(fallo);
          return;
        }
        await comprobarYSalir(r.id);
      } catch (e) { fallo(e); }
    }
  }
}
