// ══════════════════════════════════════════════════════════════
// CONSOLIDADO · Acciones del Sistema de Refrigeración
// ──────────────────────────────────────────────────────────────
// UI binding de pages/consolidado-refrigeracion.html · suscribe a
// la colección `acciones_refrigeracion` con onSnapshot, aplica
// filtros cliente-side, calcula KPIs agregados, renderiza la
// tabla en realtime y permite exportar CSV / eliminar (admin).
//
// Importa el data layer assets/js/data/acciones_refrigeracion.js.
// ══════════════════════════════════════════════════════════════

import {
  suscribir, eliminar, actualizarEstado, ESTADOS_ACCION, labelEstado, isReady
} from './data/acciones_refrigeracion.js';

const $ = (id) => document.getElementById(id);

const state = {
  rows:       [],          // todas las filas suscritas
  unsub:      null,
  subestaciones: new Set() // para poblar el filtro
};

function fmtNum(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function escaparHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function esAdmin() {
  const session = window.__sgmSession || {};
  return (session.profile?.rol || session.role) === 'admin';
}

/* ─── Filtros cliente-side ──────────────────────────────────── */

function leerFiltros() {
  return {
    q:           ($('q').value || '').trim().toLowerCase(),
    estado:      $('f-estado').value,
    subestacion: $('f-subestacion').value,
    zona:        $('f-zona').value,
    from:        $('f-from').value,
    to:          $('f-to').value
  };
}

function aplicarFiltros(rows, f) {
  return rows.filter(r => {
    if (f.estado      && r.estado_accion !== f.estado)            return false;
    if (f.subestacion && r.subestacion   !== f.subestacion)       return false;
    if (f.zona        && r.zona          !== f.zona)              return false;
    if (f.from        && r.fecha_accion < f.from)                  return false;
    if (f.to          && r.fecha_accion > f.to)                    return false;
    if (f.q) {
      const hay = (r.matricula + ' ' + r.proyecto + ' ' +
                   r.accion_descripcion + ' ' + r.responsable_nombre +
                   ' ' + r.subestacion).toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

/* ─── KPIs ──────────────────────────────────────────────────── */

function actualizarKpis(rows) {
  const total = rows.length;
  const aprobadas = rows.filter(r =>
    r.estado_accion === 'aprobada' || r.estado_accion === 'ejecutada').length;
  const pendientes = rows.filter(r =>
    r.estado_accion === 'planificada' || r.estado_accion === 'pendiente_aprobacion').length;
  const sumKva = rows.reduce((s, r) => s + (Number(r.kva_onaf) || 0), 0);
  const sumVent = rows.reduce((s, r) => s + (r.evaluacion?.n_unidades_total || 0), 0);

  $('kpi-total').textContent        = fmtNum(total);
  $('kpi-aprobadas').textContent    = fmtNum(aprobadas);
  $('kpi-pendientes').textContent   = fmtNum(pendientes);
  $('kpi-kva').textContent          = fmtNum(sumKva);
  $('kpi-ventiladores').textContent = fmtNum(sumVent);
}

/* ─── Tabla ─────────────────────────────────────────────────── */

function renderTabla(rows) {
  const tbody = $('consol-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="15" class="empty-row">
      Sin acciones registradas con los filtros actuales.
    </td></tr>`;
    return;
  }
  const adm = esAdmin();
  tbody.innerHTML = rows.map(r => {
    const ev = r.evaluacion || {};
    const aprobado = !!ev.aprobado;
    const cobertura = ev.cobertura_pct !== undefined && ev.cobertura_pct !== null
      ? ev.cobertura_pct.toFixed(1) + '%' : '—';
    const mixDesc = (Array.isArray(r.mix) ? r.mix : [])
      .map(it => `${it.cantidad}× ${it.marca || ''} ${it.modelo || ''}`.trim())
      .join(' + ') || '—';
    return `<tr data-id="${r.id}">
      <td class="mono">${escaparHtml(r.fecha_accion || '—')}</td>
      <td><strong>${escaparHtml(r.matricula || '—')}</strong></td>
      <td>${escaparHtml(r.proyecto || '—')}</td>
      <td>${escaparHtml(r.subestacion || '—')}</td>
      <td>${escaparHtml(r.zona || '—')}</td>
      <td class="tr mono">${fmtNum(r.kva_onan)}</td>
      <td class="tr mono">${fmtNum(r.kva_onaf)}</td>
      <td>${escaparHtml(mixDesc)}</td>
      <td class="tr mono">${fmtNum(ev.cfm_aporte_total)}</td>
      <td class="tc mono">${cobertura}</td>
      <td class="tc"><span class="aprobado-pill ${aprobado ? 'si' : 'no'}">${aprobado ? '✓' : '✗'}</span></td>
      <td><span class="estado-pill ${r.estado_accion || ''}">${escaparHtml(labelEstado(r.estado_accion))}</span></td>
      <td>${escaparHtml(r.responsable_nombre || r.responsable_email || '—')}</td>
      <td title="${escaparHtml(r.accion_descripcion || '')}">${escaparHtml((r.accion_descripcion || '').slice(0, 80))}${(r.accion_descripcion || '').length > 80 ? '…' : ''}</td>
      <td class="row-actions">
        ${adm ? `
          <button type="button" data-action="estado" data-id="${r.id}" title="Cambiar estado">⇆</button>
          <button type="button" class="danger" data-action="eliminar" data-id="${r.id}" title="Eliminar">✕</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
}

/* ─── Filtro de subestaciones (poblado dinámico) ───────────── */

function poblarSubestaciones(rows) {
  const set = new Set();
  for (const r of rows) {
    if (r.subestacion && r.subestacion.trim()) set.add(r.subestacion.trim());
  }
  // Solo regenera si cambió el conjunto
  const arr = Array.from(set).sort();
  if (arr.length === state.subestaciones.size &&
      arr.every(s => state.subestaciones.has(s))) return;
  state.subestaciones = new Set(arr);
  const sel = $('f-subestacion');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Todas —</option>' +
    arr.map(s => `<option value="${escaparHtml(s)}"${s === cur ? ' selected' : ''}>${escaparHtml(s)}</option>`).join('');
}

/* ─── Aplicar render completo ───────────────────────────────── */

function aplicar() {
  const filtrados = aplicarFiltros(state.rows, leerFiltros());
  actualizarKpis(filtrados);
  renderTabla(filtrados);
}

/* ─── Acciones de fila ──────────────────────────────────────── */

async function onTbodyClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'eliminar') {
    if (!confirm('¿Eliminar esta acción de mantenimiento?\n\nEsta operación no se puede deshacer.')) return;
    try {
      await eliminar(id);
      $('errBar').hidden = true;
    } catch (err) {
      mostrarError('No se pudo eliminar: ' + (err?.message || err));
    }
  } else if (action === 'estado') {
    const opciones = Object.values(ESTADOS_ACCION).map(e => labelEstado(e)).join(' / ');
    const nuevo = prompt('Nuevo estado: ' + opciones + '\n\n(Escriba: planificada, pendiente_aprobacion, aprobada, ejecutada, cancelada)');
    if (!nuevo) return;
    const valor = nuevo.trim().toLowerCase();
    if (!Object.values(ESTADOS_ACCION).includes(valor)) {
      mostrarError('Estado no válido: ' + valor);
      return;
    }
    try {
      await actualizarEstado(id, valor);
      $('errBar').hidden = true;
    } catch (err) {
      mostrarError('No se pudo cambiar estado: ' + (err?.message || err));
    }
  }
}

function mostrarError(msg) {
  const bar = $('errBar');
  bar.textContent = msg;
  bar.hidden = false;
}

/* ─── Export CSV ────────────────────────────────────────────── */

function exportarCsv() {
  const rows = aplicarFiltros(state.rows, leerFiltros());
  if (rows.length === 0) {
    alert('No hay filas para exportar con los filtros actuales.');
    return;
  }
  const headers = [
    'fecha_accion', 'matricula', 'proyecto', 'subestacion', 'zona',
    'departamento', 'grupo', 'kva_onan', 'kva_onaf', 'pct', 'altitud',
    'cfm_requerido', 'cfm_corregido',
    'mix_resumen', 'n_modelos', 'n_unidades_total',
    'cfm_aporte_total', 'cobertura_pct', 'aprobado',
    'amps_totales', 'kw_totales', 'peso_total',
    'estado_accion', 'responsable_nombre', 'responsable_email',
    'accion_descripcion', 'observaciones', 'fecha_ejecucion'
  ];
  const escCsv = (v) => {
    const s = (v == null) ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lineas = [headers.join(',')];
  for (const r of rows) {
    const ev = r.evaluacion || {};
    const pr = r.proteccion || {};
    const mixResumen = (Array.isArray(r.mix) ? r.mix : [])
      .map(it => `${it.cantidad}x ${it.marca || ''} ${it.modelo || ''}`.trim())
      .join(' + ');
    const fila = [
      r.fecha_accion, r.matricula, r.proyecto, r.subestacion, r.zona,
      r.departamento, r.grupo, r.kva_onan, r.kva_onaf, r.pct, r.altitud,
      r.cfm_requerido, r.cfm_corregido,
      mixResumen, (r.mix || []).length, ev.n_unidades_total,
      ev.cfm_aporte_total, ev.cobertura_pct, ev.aprobado,
      pr.amps_totales, pr.kw_totales, pr.peso_total,
      r.estado_accion, r.responsable_nombre, r.responsable_email,
      r.accion_descripcion, r.observaciones, r.fecha_ejecucion
    ];
    lineas.push(fila.map(escCsv).join(','));
  }
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `consolidado-refrigeracion-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

/* ─── Bootstrap ─────────────────────────────────────────────── */

function bindFilterEvents() {
  ['q', 'f-estado', 'f-subestacion', 'f-zona', 'f-from', 'f-to'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', aplicar);
    el.addEventListener('change', aplicar);
  });
  $('btnReset').addEventListener('click', () => {
    ['q', 'f-estado', 'f-subestacion', 'f-zona', 'f-from', 'f-to'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
    aplicar();
  });
  $('btnExportCsv').addEventListener('click', exportarCsv);
  $('consol-tbody').addEventListener('click', onTbodyClick);
}

function init() {
  bindFilterEvents();
  if (!isReady()) {
    mostrarError('Firebase no está configurado · contacte al administrador.');
    $('consol-status').textContent = 'Firebase no inicializado.';
    return;
  }
  $('consol-status').textContent = 'Sincronizando…';
  state.unsub = suscribir({}, (rows) => {
    state.rows = rows;
    poblarSubestaciones(rows);
    aplicar();
    $('consol-status').textContent = `${rows.length} acción${rows.length === 1 ? '' : 'es'} sincronizada${rows.length === 1 ? '' : 's'} en realtime.`;
  }, (err) => {
    console.error('[consolidado] suscripción falló:', err);
    if (err?.code === 'permission-denied') {
      mostrarError('Permiso denegado · ejecute "firebase deploy --only firestore:rules" desde la Mac del administrador.');
    } else if (err?.code === 'failed-precondition') {
      mostrarError('Falta el índice compuesto · ejecute "firebase deploy --only firestore:indexes" desde la Mac del administrador.');
    } else {
      mostrarError('Error de sincronización: ' + (err?.message || err));
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.unsub) state.unsub();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Lucide icons
window.addEventListener('load', () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
