// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Página Información Contractual (Fase 3 · 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Controla la nube documental: lee el contrato_id del query, llama
// al data layer para obtener los documentos, los renderiza agrupados
// por categoría con buscador, y al click pinta el PDF en un iframe
// embebido (sin abrir nueva pestaña).
//
// Decisiones técnicas:
//   · Visor: <iframe> nativo. Los navegadores modernos renderizan
//     PDF nativamente (Chrome PDF Viewer, Safari/Firefox built-in).
//     Cero dependencias.
//   · Estado URL: el slug del documento seleccionado se persiste en
//     el hash (#doc=slug) para que un refresh o un share-link
//     restaure la selección.
//   · Búsqueda: filtra in-memory (cliente) por título sin tildes,
//     case-insensitive.
//   · Pantalla completa: requiere usar la Fullscreen API si está
//     disponible; fallback a una clase CSS .is-fullscreen.
// ══════════════════════════════════════════════════════════════

import {
  listarDocumentos,
  agruparPorCategoria,
  formatearPeso,
  subirDocumento,
  eliminarDocumento,
  CATEGORIAS_DOC
} from './data/documentos_contractuales.js';

const $ = (id) => document.getElementById(id);

// Lee el contrato_id del query.
const params = new URLSearchParams(window.location.search);
const contratoId = (params.get('id') || '').trim();

if (!contratoId) {
  // Sin id, vuelve al índice de contratos.
  window.location.replace('contratos.html');
}

const META_CONTRATO = {
  '4123000081': 'Contrato 4123000081',
  '4125000143': 'Contrato 4125000143'
};
$('bcContrato').textContent = META_CONTRATO[contratoId] || contratoId;

const state = {
  documentos: [],
  filtrados: [],
  seleccionado: null
};

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderLista(docs) {
  const list = $('docList');
  if (!docs || docs.length === 0) {
    list.innerHTML = '<div class="cloud-empty">No hay documentos que coincidan con tu búsqueda.</div>';
    return;
  }
  const grupos = agruparPorCategoria(docs);
  const html = grupos.map((g) => `
    <div class="cloud-group" data-cat="${escHtml(g.categoria)}">
      <div class="cloud-group-title">
        <i data-lucide="${escHtml(g.icon)}" aria-hidden="true"></i>
        ${escHtml(g.label)}
      </div>
      ${g.docs.map((d) => `
        <div class="cloud-doc-wrap" data-archivo="${escHtml(d.archivo)}">
          <button type="button" class="cloud-doc${state.seleccionado === d.archivo ? ' is-selected' : ''}"
                  aria-pressed="${state.seleccionado === d.archivo ? 'true' : 'false'}"
                  data-archivo="${escHtml(d.archivo)}">
            <span class="cloud-doc-icon" aria-hidden="true">
              <i data-lucide="${escHtml(CATEGORIAS_DOC[d.categoria]?.icon || 'file-text')}"></i>
            </span>
            <span class="cloud-doc-body">
              <span class="cloud-doc-title">${escHtml(d.titulo)}</span>
              <span class="cloud-doc-meta">${formatearPeso(d.peso_bytes)}</span>
            </span>
          </button>
          <button type="button" class="cloud-doc-delete" data-archivo="${escHtml(d.archivo)}" data-titulo="${escHtml(d.titulo)}" title="Eliminar documento" aria-label="Eliminar ${escHtml(d.titulo)}">
            <i data-lucide="trash-2" aria-hidden="true"></i>
          </button>
        </div>
      `).join('')}
    </div>
  `).join('');
  list.innerHTML = html;
  // Re-inicializa íconos Lucide.
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons({ root: list });
  }
  // Wire click en cada doc (selección).
  for (const btn of list.querySelectorAll('.cloud-doc')) {
    btn.addEventListener('click', (ev) => {
      // Si el target es el delete (o un descendiente), no seleccionar.
      if (ev.target.closest('.cloud-doc-delete')) return;
      seleccionar(btn.dataset.archivo);
    });
  }
  // Wire click en cada delete (admin).
  for (const del of list.querySelectorAll('.cloud-doc-delete')) {
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      pedirEliminar(del.dataset.archivo, del.dataset.titulo);
    });
  }
}

function actualizarCounter(total, visibles) {
  if (total === visibles) {
    $('docCounter').textContent = `${total} documento${total === 1 ? '' : 's'}`;
  } else {
    $('docCounter').textContent = `${visibles} de ${total}`;
  }
}

function actualizarSubtitle(total) {
  if (total === 0) {
    $('docSubtitle').textContent = 'Aún no hay documentos contractuales subidos para este contrato.';
  } else {
    const meta = META_CONTRATO[contratoId] || contratoId;
    $('docSubtitle').textContent = `${total} documento${total === 1 ? '' : 's'} disponible${total === 1 ? '' : 's'} para el ${meta}.`;
  }
}

function seleccionar(archivo) {
  const doc = state.filtrados.find((d) => d.archivo === archivo) || state.documentos.find((d) => d.archivo === archivo);
  if (!doc) return;
  state.seleccionado = archivo;
  // Actualiza hash sin recargar.
  history.replaceState(null, '', `#doc=${encodeURIComponent(archivo)}`);
  // Toolbar.
  $('viewerToolbar').hidden = false;
  $('viewerEmpty').hidden = true;
  $('viewerFrame').hidden = false;
  $('viewerTitle').textContent = doc.titulo;
  $('viewerSize').textContent = formatearPeso(doc.peso_bytes);
  const cat = CATEGORIAS_DOC[doc.categoria] || CATEGORIAS_DOC.otros;
  $('viewerCatLabel').textContent = cat.label;
  $('viewerCat').querySelector('i, svg')?.setAttribute('data-lucide', cat.icon);
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons({ root: $('viewerCat') });
  }
  // Botones de acción.
  $('btnDownload').setAttribute('href', doc.url);
  $('btnDownload').setAttribute('download', doc.titulo + '.pdf');
  $('btnOpenNewTab').setAttribute('href', doc.url);
  // Iframe sin hash params — el visor nativo del navegador (Chrome PDF
  // Viewer / Safari built-in / Firefox PDF.js) muestra el documento
  // completo con scroll vertical funcional. El #view=FitH anterior
  // hacía fit-horizontal y bloqueaba el scroll del wheel en algunos
  // navegadores (bug reportado por el director: 'no me permite bajar
  // con el scroll del mouse para apreciar todas las páginas').
  $('viewerFrame').setAttribute('src', doc.url);
  // Re-render lista para actualizar selección visual.
  renderLista(state.filtrados);
}

function aplicarBusqueda(q) {
  const norm = normalize(q);
  if (!norm) {
    state.filtrados = state.documentos;
  } else {
    state.filtrados = state.documentos.filter((d) =>
      normalize(d.titulo).includes(norm) ||
      normalize(CATEGORIAS_DOC[d.categoria]?.label || '').includes(norm)
    );
  }
  renderLista(state.filtrados);
  actualizarCounter(state.documentos.length, state.filtrados.length);
}

// Pantalla completa.
$('btnFullscreen').addEventListener('click', () => {
  const wrap = document.querySelector('.cloud-shell');
  if (!wrap) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
    wrap.classList.remove('is-fullscreen');
  } else {
    if (wrap.requestFullscreen) {
      wrap.requestFullscreen().catch(() => wrap.classList.add('is-fullscreen'));
    } else {
      wrap.classList.add('is-fullscreen');
    }
  }
});
document.addEventListener('fullscreenchange', () => {
  const wrap = document.querySelector('.cloud-shell');
  if (!wrap) return;
  if (!document.fullscreenElement) wrap.classList.remove('is-fullscreen');
});

// Buscador.
$('docSearch').addEventListener('input', (e) => {
  aplicarBusqueda(e.target.value);
});

// Carga inicial.
async function cargar() {
  try {
    state.documentos = await listarDocumentos(contratoId);
    state.filtrados = state.documentos;
    actualizarSubtitle(state.documentos.length);
    actualizarCounter(state.documentos.length, state.documentos.length);
    renderLista(state.filtrados);
    // Restaura selección desde hash si existe.
    const hashMatch = (location.hash || '').match(/^#doc=(.+)$/);
    if (hashMatch) {
      const archivo = decodeURIComponent(hashMatch[1]);
      if (state.documentos.some((d) => d.archivo === archivo)) {
        seleccionar(archivo);
        return;
      }
    }
    // Sin hash, NO auto-selecciona — el director ve el placeholder
    // y elige cuál abrir conscientemente.
  } catch (err) {
    console.error('[contrato-info] error cargando documentos:', err);
    $('docList').innerHTML = `<div class="cloud-empty">Error cargando documentos: ${escHtml(err.message)}</div>`;
    actualizarSubtitle(0);
  }
}

cargar();

// ══════════════════════════════════════════════════════════════
// ADMIN — Upload + Delete (Fase C)
// ══════════════════════════════════════════════════════════════

/**
 * Activa los controles de admin si la sesión los permite.
 * Lee window.__sgmSession (lo expone session-guard.js + aqua-shell).
 */
function aplicarRolAdmin() {
  const sess = window.__sgmSession || {};
  const role = sess.role || (sess.profile && sess.profile.rol) || 'tecnico';
  if (role === 'admin') {
    document.body.classList.add('is-admin');
    $('btnAddDoc').hidden = false;
  }
}
if (window.__sgmSession) {
  aplicarRolAdmin();
} else {
  window.addEventListener('sgm:session-ready', aplicarRolAdmin, { once: true });
}

// ── Modal de Upload ──────────────────────────────────────────
function abrirUpload() {
  $('uploadForm').reset();
  $('upMsg').textContent = '';
  $('upMsg').className = 'upload-msg';
  $('upProgress').hidden = true;
  $('upProgressFill').style.width = '0%';
  $('btnSubmitUpload').disabled = false;
  $('uploadModalBg').hidden = false;
  setTimeout(() => $('upTitulo').focus(), 50);
}
function cerrarUpload() {
  $('uploadModalBg').hidden = true;
}
$('btnAddDoc').addEventListener('click', abrirUpload);
$('btnCloseUpload').addEventListener('click', cerrarUpload);
$('btnCancelUpload').addEventListener('click', cerrarUpload);
$('uploadModalBg').addEventListener('click', (ev) => {
  if (ev.target === $('uploadModalBg')) cerrarUpload();
});

$('uploadForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const titulo = $('upTitulo').value.trim();
  const categoria = $('upCategoria').value;
  const fileInput = $('upArchivo');
  const file = fileInput.files && fileInput.files[0];
  if (!titulo || !file) return;

  const sess = window.__sgmSession || {};
  const uid = sess.user && sess.user.uid;

  $('btnSubmitUpload').disabled = true;
  $('upMsg').textContent = '';
  $('upMsg').className = 'upload-msg';
  $('upProgress').hidden = false;
  $('upProgressFill').style.width = '0%';
  $('upProgressText').textContent = '⋯ subiendo';

  try {
    await subirDocumento({
      cid: contratoId,
      titulo,
      categoria,
      file,
      uid,
      onProgress: (pct) => {
        $('upProgressFill').style.width = pct + '%';
        $('upProgressText').textContent = `⋯ subiendo ${pct}%`;
      }
    });
    $('upProgressText').textContent = '✓ subido';
    $('upMsg').textContent = `✓ '${titulo}' agregado correctamente.`;
    $('upMsg').className = 'upload-msg is-ok';
    // Refresca la lista (mergea Firestore override sobre manifest).
    await cargar();
    setTimeout(cerrarUpload, 1200);
  } catch (err) {
    console.error('[contrato-info] upload fallo:', err);
    let msg = err.message || 'Error desconocido al subir';
    // Pista útil cuando las storage rules no están deployadas
    if (/permission-denied|unauthorized/i.test(msg)) {
      msg += ' · Verifica que se haya hecho `firebase deploy --only storage` en la Mac (CLAUDE.md §0.1.1).';
    }
    $('upMsg').textContent = '✕ ' + msg;
    $('upMsg').className = 'upload-msg is-err';
    $('upProgress').hidden = true;
    $('btnSubmitUpload').disabled = false;
  }
});

// ── Modal de Delete ──────────────────────────────────────────
let deleteTarget = null;

function pedirEliminar(archivo, titulo) {
  deleteTarget = { archivo, titulo };
  $('deleteDocName').textContent = titulo;
  $('deleteMsg').textContent = '';
  $('deleteMsg').className = 'upload-msg';
  $('btnConfirmDelete').disabled = false;
  $('deleteModalBg').hidden = false;
}
function cerrarDelete() {
  deleteTarget = null;
  $('deleteModalBg').hidden = true;
}
$('btnCancelDelete').addEventListener('click', cerrarDelete);
$('deleteModalBg').addEventListener('click', (ev) => {
  if (ev.target === $('deleteModalBg')) cerrarDelete();
});

$('btnConfirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  const { archivo, titulo } = deleteTarget;
  $('btnConfirmDelete').disabled = true;
  $('deleteMsg').textContent = '⋯ eliminando…';
  $('deleteMsg').className = 'upload-msg';
  try {
    await eliminarDocumento({ cid: contratoId, archivo });
    $('deleteMsg').textContent = `✓ '${titulo}' eliminado.`;
    $('deleteMsg').className = 'upload-msg is-ok';
    // Si el doc eliminado era el seleccionado, vuelve al placeholder.
    if (state.seleccionado === archivo) {
      state.seleccionado = null;
      $('viewerToolbar').hidden = true;
      $('viewerEmpty').hidden = false;
      $('viewerFrame').hidden = true;
      $('viewerFrame').setAttribute('src', '');
      history.replaceState(null, '', location.pathname + location.search);
    }
    await cargar();
    setTimeout(cerrarDelete, 1200);
  } catch (err) {
    console.error('[contrato-info] delete fallo:', err);
    let msg = err.message || 'Error al eliminar';
    if (/permission-denied|unauthorized/i.test(msg)) {
      msg += ' · Verifica que se haya hecho `firebase deploy --only storage` en la Mac.';
    }
    $('deleteMsg').textContent = '✕ ' + msg;
    $('deleteMsg').className = 'upload-msg is-err';
    $('btnConfirmDelete').disabled = false;
  }
});

// ESC cierra cualquier modal abierto.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (!$('uploadModalBg').hidden) cerrarUpload();
  if (!$('deleteModalBg').hidden) cerrarDelete();
});
