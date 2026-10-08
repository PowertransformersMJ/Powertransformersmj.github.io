// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Inventario (Fase 6)
// Controlador de la tabla + modal CRUD sobre /transformadores.
// ══════════════════════════════════════════════════════════════

import {
  listar, obtener, crear, actualizarCampos, eliminar,
  ESTADOS, DEPARTAMENTOS, estadoLabel, departamentoLabel, isReady
} from '../data/transformadores.js';
import {
  valoresFormulario, entradaDesdeFormulario, parcheEdicionInventario
} from '../domain/inventario_edicion.js';
import { logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';
import { bucketColor } from '../ui-helpers.js';

// ── Elementos ──
const $ = (id) => document.getElementById(id);
const tbody    = $('tbody');
const info     = $('infoBox');
const modal    = $('modal');
const modalTitle = $('modalTitle');
const form     = $('form');
const fId      = $('fId');
const fCodigo  = $('fCodigo');
const fNombre  = $('fNombre');
const fDeptMain= $('fDeptMain');
const fEstadoMain = $('fEstadoMain');
const fMun     = $('fMun');
const fSub     = $('fSub');
const fPot     = $('fPot');
const fTp      = $('fTp');
const fTs      = $('fTs');
const fMarca   = $('fMarca');
const fModelo  = $('fModelo');
const fSerial  = $('fSerial');
const fFf      = $('fFf');
const fFi      = $('fFi');
const fLat     = $('fLat');
const fLng     = $('fLng');
const fObs     = $('fObs');
// v2 fields (F16+)
const fTipoActivo = $('fTipoActivo');
const fUUCC       = $('fUUCC');
const fGrupo      = $('fGrupo');
const fZona       = $('fZona');
const formMsg  = $('formMsg');
const btnSave  = $('btnSave');
const fDeptFilter  = $('fDept');
const fEstadoFilter = $('fEstado');

// Equipo abierto para editar: su id y la foto del formulario al abrirlo.
// Al guardar se escribe solo lo que cambió respecto a esa foto (ADR-154).
let edicion = null;

// ── Poblar selects ──
function fillSelects() {
  for (const d of DEPARTAMENTOS) {
    fDeptFilter.insertAdjacentHTML('beforeend', `<option value="${d.value}">${d.label}</option>`);
    fDeptMain.insertAdjacentHTML('beforeend', `<option value="${d.value}">${d.label}</option>`);
  }
  for (const e of ESTADOS) {
    fEstadoFilter.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
    fEstadoMain.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
  }
}

// ── UI helpers ──
function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}
function formatoPotencia(t) {
  return (t.potencia_kva != null) ? `${t.potencia_kva} kVA` : '—';
}
function formatoTension(t) {
  const p = t.tension_primaria_kv;
  const s = t.tension_secundaria_kv;
  if (p == null && s == null) return '—';
  return `${p ?? '—'} / ${s ?? '—'} kV`;
}
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function render(rows) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Sin transformadores registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((t) => {
    const id    = t.identificacion || {};
    const ub    = t.ubicacion || {};
    const salud = t.salud_actual || {};
    const tipo  = id.tipo_activo || 'POTENCIA';
    const zona  = ub.zona || '—';
    const hi    = salud.hi_final;
    const bucket = salud.bucket || '';
    const vidaRem = salud.vida_remanente_pct;
    return `
    <tr data-id="${t.id}">
      <td><code>${escHtml(t.codigo)}</code></td>
      <td><small style="opacity:.7">${escHtml(tipo)}</small></td>
      <td>${escHtml(t.nombre)}<br><small style="opacity:.6">${escHtml(t.subestacion || '')}</small></td>
      <td>${escHtml(zona)}<br><small style="opacity:.6">${escHtml(departamentoLabel(t.departamento))}</small></td>
      <td>${formatoPotencia(t)}<br><small style="opacity:.6">${formatoTension(t)}</small></td>
      <td><span class="estado-pill ${escHtml(t.estado)}">${escHtml(estadoLabel(t.estado))}</span></td>
      <td>${hi != null
        ? `<strong style="color:${bucketColor(bucket)}">${hi.toFixed(2)}</strong><br><small style="opacity:.7">${escHtml(bucket || '—')}</small>`
        : '—'}</td>
      <td>${vidaRem != null ? vidaRem.toFixed(0) + ' %' : '—'}</td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${t.id}" title="Editar" aria-label="Editar"><i data-lucide="pencil"></i></button>
        <button class="row-btn danger" data-act="del" data-id="${t.id}" title="Eliminar" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>
  `;
  }).join('');
  // Re-render iconos Lucide tras inyectar filas (debounced, no-loop).
  window.sgmRefreshIcons?.();
}

// ── Modal ──
function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar transformador' : 'Nuevo transformador';
  formMsg.className = 'msg';
  formMsg.textContent = '';
  modal.style.display = 'flex';
  setTimeout(() => fCodigo.focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  edicion = null;
}
function fillForm(t) {
  const v = valoresFormulario(t);
  fId.value     = t.id || '';
  fCodigo.value = v.codigo;
  fNombre.value = v.nombre;
  fDeptMain.value = v.departamento;
  fEstadoMain.value = v.estado;
  fMun.value    = v.municipio;
  fSub.value    = v.subestacion;
  fPot.value    = v.potencia_kva;
  fTp.value     = v.tension_primaria_kv;
  fTs.value     = v.tension_secundaria_kv;
  fMarca.value  = v.marca;
  fModelo.value = v.modelo;
  fSerial.value = v.serial;
  fFf.value     = v.fecha_fabricacion;
  fFi.value     = v.fecha_instalacion;
  fLat.value    = v.latitud;
  fLng.value    = v.longitud;
  fObs.value    = v.observaciones;
  // v2 fields
  fTipoActivo.value = v.tipo_activo;
  fUUCC.value       = v.uucc;
  fGrupo.value      = v.grupo;
  fZona.value       = v.zona;
}
function readForm() {
  return entradaDesdeFormulario({
    codigo: fCodigo.value,
    nombre: fNombre.value,
    departamento: fDeptMain.value,
    estado: fEstadoMain.value,
    municipio: fMun.value,
    subestacion: fSub.value,
    potencia_kva: fPot.value,
    tension_primaria_kv: fTp.value,
    tension_secundaria_kv: fTs.value,
    marca: fMarca.value,
    modelo: fModelo.value,
    serial: fSerial.value,
    fecha_fabricacion: fFf.value,
    fecha_instalacion: fFi.value,
    latitud: fLat.value,
    longitud: fLng.value,
    observaciones: fObs.value,
    tipo_activo: fTipoActivo.value,
    uucc: fUUCC.value,
    grupo: fGrupo.value,
    zona: fZona.value
  });
}

// ── Cargar ──
async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. Completa assets/js/firebase-config.js para habilitar el inventario.', 'err');
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Sin conexión con Firestore.</td></tr>';
    return;
  }
  try {
    showInfo('');
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Cargando…</td></tr>';
    const rows = await listar({
      departamento: fDeptFilter.value || undefined,
      estado:       fEstadoFilter.value || undefined
    });
    render(rows);
  } catch (err) {
    console.error(err);
    showInfo('Error al listar: ' + (err.message || err), 'err');
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Error de carga.</td></tr>';
  }
}

// ── Eventos tabla ──
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id  = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'edit') {
    try {
      const t = await obtener(id);
      if (!t) return showInfo('Registro no encontrado.', 'err');
      fillForm(t);
      // La foto se toma de lo que QUEDÓ en pantalla (un <select> o una
      // fecha que no acepta el valor guardado queda vacío): así lo que el
      // usuario no toca nunca se escribe.
      edicion = { id: t.id, inicial: readForm() };
      openModal(true);
    } catch (err) { showInfo('Error al cargar: ' + err.message, 'err'); }
    return;
  }

  if (act === 'del') {
    const t = await obtener(id);
    const label = t ? `${t.codigo} · ${t.nombre}` : id;
    if (!confirm(`¿Eliminar definitivamente el transformador ${label}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await eliminar(id);
      showInfo('✓ Registro eliminado.', 'ok');
      await cargar();
    } catch (err) { showInfo('Error al eliminar: ' + err.message, 'err'); }
  }
});

// ── Submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'msg';
  formMsg.textContent = '';
  btnSave.disabled = true;
  const orig = btnSave.textContent;
  btnSave.textContent = 'GUARDANDO…';

  try {
    const data = readForm();
    const uid = (window.__sgmAdmin && window.__sgmAdmin.uid) || null;
    if (fId.value) {
      if (!edicion || edicion.id !== fId.value) {
        throw new Error('No se sabe qué equipo se está editando. Cierra y vuelve a abrirlo con el lápiz.');
      }
      const { parche, diff, errores } = parcheEdicionInventario(edicion.inicial, data);
      if (errores.length > 0) throw new Error('Validación v2 falló:\n  · ' + errores.join('\n  · '));
      const escribio = await actualizarCampos(fId.value, parche, { uid, diff });
      showInfo(escribio ? `✓ Transformador ${data.codigo} actualizado.` : `Sin cambios en ${data.codigo}.`, 'ok');
    } else {
      await crear(data, uid);
      showInfo(`✓ Transformador ${data.codigo} creado.`, 'ok');
    }
    closeModal();
    await cargar();
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = orig;
  }
});

// ── Eventos UI ──
$('btnNuevo').addEventListener('click', () => { form.reset(); fId.value = ''; edicion = null; openModal(false); });
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
$('btnReload').addEventListener('click', cargar);
fDeptFilter.addEventListener('change', cargar);
fEstadoFilter.addEventListener('change', cargar);

$('btnLogout')?.addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
if($('yr'))$('yr').textContent = new Date().getFullYear();

// ── Init ──
fillSelects();
cargar();
