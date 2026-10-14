// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · «VER HOJAS» + PDF y WORD
// ──────────────────────────────────────────────────────────────
// Lo que se ve aquí es lo que se imprime: el Documento del dominio
// (`construirDocumento`) dibujado por el MISMO motor de papel (`papel.js`).
//   · «Imprimir / Guardar PDF»: impresión del navegador en carta, sin márgenes,
//     con el título «INFORME <matrícula con _>» (nombre del archivo).
//   · «Descargar Word»: el .docx sale del MISMO Documento (`exportar-word.js`).
//   · En borrador cada hoja lleva «BORRADOR · SIN EMITIR»; emitido, sin marca y
//     con las firmas que se estamparon al emitir (decisión 4).
// Si este computador no tiene Arial Narrow o Tahoma, se avisa (no se bloquea).
// ══════════════════════════════════════════════════════════════

const AJUSTES_IMPRESION = 'Destino: Guardar como PDF · Tamaño: Carta · Márgenes: Ninguno · Escala: Predeterminada';

/**
 * @param {HTMLElement} cont
 * @param {{ ctx, obtener: () => Promise<{contenido, estado, version, versionDoc, matricula, etiqueta}>, alVolverAlInforme: () => void }} o
 * @returns {{ pintar: () => Promise<void>, destruir: () => void }}
 */
export function montarVista(cont, { ctx, obtener, alVolverAlInforme }) {
  const dep = ctx.dep;
  const F = dep.formulario;
  const fmt = dep.formato;
  const esc = F.escaparHtml;

  let actual = null;        // { documento, urlDe, titulo, contenido, versionDoc }
  let papel = null;
  let desconectarCmdP = null;
  let turno = 0;
  let ocupado = false;

  cont.innerHTML = ''
    + '<div class="ibr-vista-barra">'
    +   '<button type="button" class="ibr-btn ibr-btn--primario" data-vista-accion="pdf" disabled>Imprimir / Guardar PDF</button>'
    +   '<button type="button" class="ibr-btn" data-vista-accion="word" disabled>Descargar Word</button>'
    +   '<button type="button" class="ibr-btn" data-vista-accion="repintar">Volver a dibujar</button>'
    +   '<span class="ibr-vista-ajustes">' + esc(AJUSTES_IMPRESION) + '</span>'
    + '</div>'
    + '<div data-vista="version"></div>'
    + '<div data-vista="fuentes"></div>'
    + '<div data-vista="avisos" role="status" aria-live="polite"></div>'
    + '<div class="ibr-vista-hojas" data-vista="hojas"><p class="ibr-nota">Dibujando las hojas…</p></div>';
  const $ = (s) => cont.querySelector('[data-vista="' + s + '"]');
  const boton = (a) => cont.querySelector('[data-vista-accion="' + a + '"]');

  function pintarAvisos(lista) {
    const unicos = [...new Set((lista || []).filter(Boolean))];
    $('avisos').innerHTML = unicos.length
      ? '<ul class="ibr-vista-avisos">' + unicos.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>'
      : '';
  }
  function agregarAviso(t) {
    const ul = $('avisos').querySelector('ul') || (() => { const u = document.createElement('ul'); u.className = 'ibr-vista-avisos'; $('avisos').appendChild(u); return u; })();
    if ([...ul.children].some((li) => li.textContent === t)) return;
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  }

  function pintarFuentes() {
    if (!papel || typeof papel.fuentesDisponibles !== 'function') { $('fuentes').innerHTML = ''; return; }
    const f = papel.fuentesDisponibles();
    const faltan = [];
    if (!f.arialNarrow) faltan.push('Arial Narrow');
    if (!f.tahoma) faltan.push('Tahoma');
    $('fuentes').innerHTML = faltan.length
      ? '<div class="ibr-banda ibr-banda--aviso">Este computador no tiene ' + esc(faltan.join(' ni ')) + ': el papel puede cortar distinto. '
        + 'El Word usará la fuente del computador donde se abra.</div>'
      : '';
  }

  async function pintar() {
    const mio = ++turno;
    boton('pdf').disabled = true;
    boton('word').disabled = true;
    $('hojas').innerHTML = '<p class="ibr-nota">Dibujando las hojas…</p>';
    pintarAvisos([]);
    try {
      const e = await obtener();
      if (mio !== turno) return;
      $('version').innerHTML = e.etiqueta
        ? '<div class="ibr-banda ibr-banda--info">Viendo la <b>' + esc(e.etiqueta) + '</b> (congelada). '
          + '<button type="button" class="ibr-btn ibr-btn--chico" data-vista-accion="volver-informe">Volver al informe</button></div>'
        : '';
      if (e.errorVersion) {
        // Un emitido sin su versión congelada saldría SIN firmas y con los logos de hoy: no se dibuja ni se imprime.
        actual = null;
        $('hojas').innerHTML = '<div class="ibr-banda ibr-banda--mal" role="alert"><b>' + esc(e.errorVersion) + '</b> '
          + 'Sin ella, el PDF y el Word saldrían sin las firmas de la emisión. '
          + '<button type="button" class="ibr-btn ibr-btn--chico" data-vista-accion="repintar">Reintentar</button></div>';
        return;
      }
      const documento = dep.documento.construirDocumento(e.contenido, { estado: e.estado, version: e.version, versionDoc: e.versionDoc || null });
      const refs = dep.documento.refsDelDocumento(documento);
      const urls = await ctx.resolverUrls(refs, { contenido: e.contenido, versionDoc: e.versionDoc || null });
      if (mio !== turno) return;
      papel = await dep.cargar('papel');
      if (mio !== turno) return;
      const urlDe = (ref) => (urls && urls.get(ref)) || null;
      const r = await papel.renderizarPapel($('hojas'), documento, urlDe, { alAviso: agregarAviso });
      if (mio !== turno) return;
      const titulo = 'INFORME ' + fmt.matriculaArchivo(e.matricula || (documento.meta && documento.meta.matricula) || '');
      actual = { documento, urlDe, titulo, contenido: e.contenido, versionDoc: e.versionDoc || null };
      pintarAvisos([...((urls && urls.avisos) || []), ...((r && r.avisos) || [])]);
      pintarFuentes();
      if (!desconectarCmdP && typeof papel.activarImpresionRapida === 'function') {
        // Cmd + P sin el botón: se imprimen las hojas ya dibujadas (solo si esta pestaña está a la vista).
        desconectarCmdP = papel.activarImpresionRapida(() => (cont.hidden || !actual ? null : { contenedor: $('hojas'), titulo: actual.titulo }));
      }
      boton('pdf').disabled = false;
      boton('word').disabled = false;
    } catch (err) {
      if (mio !== turno) return;
      console.error('[informe-brigada] vista:', err);
      $('hojas').innerHTML = '<p class="ibr-nota ibr-nota--error">No se pudieron dibujar las hojas: ' + esc((err && err.message) || err)
        + '. Recargue con Cmd + Shift + R.</p>';
    }
  }

  async function imprimir() {
    if (!actual || !papel || ocupado) return;
    ocupado = true;
    boton('pdf').disabled = true;
    boton('pdf').textContent = 'Preparando…';
    try {
      const r = await papel.imprimirPapel(actual.documento, actual.urlDe, { titulo: actual.titulo });
      if (r && r.avisos && r.avisos.length) r.avisos.forEach(agregarAviso);
    } catch (err) {
      ctx.avisar('No se pudo preparar la impresión: ' + ((err && err.message) || err), 'error', 0);
    } finally {
      ocupado = false;
      boton('pdf').disabled = false;
      boton('pdf').textContent = 'Imprimir / Guardar PDF';
    }
  }

  async function word() {
    if (!actual || ocupado) return;
    ocupado = true;
    const b = boton('word');
    b.disabled = true;
    b.textContent = 'Armando el Word…';
    try {
      const W = await dep.cargar('word');
      const r = await W.exportarWord({
        documento: actual.documento,
        resolverBytes: (refs) => ctx.resolverBytes(refs, { contenido: actual.contenido, versionDoc: actual.versionDoc })
      });
      W.descargar(r.blob, r.nombre);
      (r.avisos || []).forEach(agregarAviso);
      ctx.avisar('Word listo: ' + r.nombre, 'ok');
    } catch (err) {
      console.error('[informe-brigada] Word:', err);
      ctx.avisar('No se pudo armar el Word: ' + ((err && err.message) || err), 'error', 0);
    } finally {
      ocupado = false;
      b.disabled = false;
      b.textContent = 'Descargar Word';
    }
  }

  cont.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-vista-accion]');
    if (!b || b.disabled) return;
    const a = b.getAttribute('data-vista-accion');
    if (a === 'pdf') imprimir();
    else if (a === 'word') word();
    else if (a === 'repintar') pintar();
    else if (a === 'volver-informe' && typeof alVolverAlInforme === 'function') alVolverAlInforme();
  });

  return {
    pintar,
    destruir() {
      turno += 1;
      if (desconectarCmdP) { desconectarCmdP(); desconectarCmdP = null; }
      actual = null;
    }
  };
}
