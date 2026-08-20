// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas: gestión de novedades y acta
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE MÓDULO
// El tablero detecta que un equipo no concuerda con el catálogo CREG,
// pero detectar no es gestionar: alguien tiene que DECIDIR qué se hace
// con cada novedad, dejar constancia de quién lo decidió y cuándo, y
// poder entregar esa constancia. Eso es el flujo de correcciones del
// módulo v22, que el port de ADR-061/064 no había traído (ADR-065).
//
// DOS REGLAS QUE NO SE TOCAN (heredadas del original):
//  1. La UUCC CALCULADA por la regla CREG **nunca** se modifica. Una
//     decisión cambia la UUCC REGISTRADA y el estado, jamás el veredicto
//     de la norma: si se pudiera editar el cálculo, el tablero dejaría
//     de ser una auditoría.
//  2. Corregir datos de PLACA (potencia, tensiones, regulación)
//     RECLASIFICA por la regla; corregir datos de IDENTIFICACIÓN
//     (serie, matrícula, zona…) no altera la clasificación.
//
// NADA DE ESTO SE GUARDA EN FIRESTORE. Es trabajo de escritorio sobre
// la pantalla: se exporta como acta y, cuando el acta esté firmada, el
// parque se actualiza por su ruta propia (`admin/importar.html`).
// ══════════════════════════════════════════════════════════════

import { GRUPOS_UC } from '../../domain/fichas_creg_uc.js';

/* ─── Modelo de la decisión ────────────────────────────────────── */

/** Las tres salidas posibles de una novedad (las del módulo original). */
export const DECISIONES = Object.freeze([
  { id: 'Aceptar UUCC calculada',
    ayuda: 'La registrada estaba mal: se adopta la que dicta la regla CREG.' },
  { id: 'Mantener UUCC registrada',
    ayuda: 'La registrada es correcta pese a la diferencia (se sustenta en la observación).' },
  { id: 'Corregir a otra UUCC',
    ayuda: 'Ni una ni otra: se asigna una tercera unidad constructiva.' }
]);

/** Campos que se pueden corregir. `tec: true` ⇒ reclasifica por regla CREG. */
export const CAMPOS_EDITABLES = Object.freeze([
  { k: 'subestacion',   lbl: 'Subestación',            tipo: 'text' },
  { k: 'matricula',     lbl: 'Matrícula',              tipo: 'text' },
  { k: 'serie',         lbl: 'Serie',                  tipo: 'text' },
  { k: 'zona',          lbl: 'Zona',                   tipo: 'text' },
  { k: 'departamento',  lbl: 'Departamento',           tipo: 'text' },
  { k: 'potencia_kva',  lbl: 'Potencia (kVA)',         tipo: 'number', tec: true },
  { k: 'kv_prim',       lbl: 'Tensión primaria (kV)',  tipo: 'number', tec: true },
  { k: 'kv_sec',        lbl: 'Tensión secundaria (kV)', tipo: 'number', tec: true },
  { k: 'kv_terc',       lbl: 'Tensión terciaria (kV)', tipo: 'number', tec: true },
  { k: 'regulacion',    lbl: 'Regulación',             tipo: 'text',   tec: true },
  { k: 'refrigeracion', lbl: 'Refrigeración',          tipo: 'text' }
]);

/** Columnas del acta, en el orden del original. */
export const COLUMNAS_ACTA = Object.freeze([
  'Fila', 'Serie', 'Subestación', 'Matrícula', 'Zona', 'Departamento',
  'Potencia (kVA)', 'Vp (kV)', 'Nivel', 'UUCC registrada', 'UUCC calculada',
  'Estado', 'Datos corregidos', 'Decisión', 'UUCC final',
  'Responsable', 'Fecha', 'Observación'
]);

/* ─── helpers ─────────────────────────────────────────────────── */

function esc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** ¿Este equipo es una novedad que hay que gestionar? */
export function esNovedad(e) {
  return !!e && e.estado !== 'CONCORDANTE';
}

/** Resumen de la barra: cuántas novedades hay y cuántas están gestionadas. */
export function resumenNovedades(equipos, edits, dec) {
  const nov = (equipos || []).filter(esNovedad);
  const gestionadas = nov.filter((e) => dec[e.fila] || edits[e.fila]).length;
  return { novedades: nov.length, gestionadas, pendientes: nov.length - gestionadas };
}

/** Texto legible de las correcciones de datos de un equipo. */
export function textoEdiciones(edits, fila) {
  const e = edits[fila];
  if (!e) return '';
  return Object.entries(e)
    .map(([k, v]) => {
      const c = CAMPOS_EDITABLES.find((x) => x.k === k);
      return (c ? c.lbl : k) + '=' + (v == null || v === '' ? '(vacío)' : v);
    })
    .join(' · ');
}

/* ─── Barra de correcciones (vive en el tablero) ───────────────── */

export function barraCorreccionesHTML(res, aplicado) {
  const pill = (lbl, n, mod) =>
    '<span class="ftm-corr-pill ' + (mod || '') + '"><small>' + lbl + '</small> <b>' + n + '</b></span>';
  return ''
    + '<div class="ftm-corr">'
    +   '<div class="ftm-corr-t">Gestión de novedades'
    +     (aplicado ? ' <span class="ftm-dec-badge ftm-dec-badge--done">correcciones aplicadas</span>' : '')
    +   '</div>'
    +   pill('Novedades', res.novedades)
    +   pill('Gestionadas', res.gestionadas, 'ftm-nov-st--ok')
    +   pill('Pendientes', res.pendientes, res.pendientes ? 'ftm-nov-st--pend' : '')
    +   '<span class="ftm-corr-acts">'
    +     '<button type="button" class="ftm-btn ftm-btn--primary" data-ftm="corr-aplicar"'
    +       (res.gestionadas ? '' : ' disabled title="Primero gestione al menos una novedad"') + '>'
    +       (aplicado ? 'Correcciones aplicadas ✓' : 'Aplicar correcciones al módulo') + '</button>'
    +     (aplicado
        ? '<button type="button" class="ftm-btn" data-ftm="corr-revertir">Revertir a estado inicial</button>'
        : '')
    +     '<button type="button" class="ftm-btn" data-ftm="corr-exportar">Exportar acta</button>'
    +     '<label class="ftm-btn" title="Recupera decisiones de un acta exportada antes">'
    +       'Importar acta<input type="file" accept=".xlsx,.xls" hidden data-ftm="corr-importar"></label>'
    +   '</span>'
    +   '<div class="ftm-hint ftm-hint--p">Decidir una novedad NO escribe en la base de datos: queda '
    +   'en esta pantalla y se entrega como acta. La UUCC <b>calculada</b> por la regla CREG nunca '
    +   'cambia — una decisión ajusta la <b>registrada</b> y el estado.</div>'
    + '</div>';
}

/* ─── Cajón de gestión de un equipo ────────────────────────────── */

export function cajonHTML(equipo, edits, dec) {
  if (!equipo) return '';
  const ed = edits[equipo.fila] || {};
  const d = dec[equipo.fila] || {};
  const hoy = (d.fecha || '');

  const campos = CAMPOS_EDITABLES.map((c) => {
    const actual = ed[c.k] != null ? ed[c.k] : (equipo[c.k] != null ? equipo[c.k] : '');
    return '<label class="ftm-campo">'
      + '<span class="ftm-campo-lbl">' + esc(c.lbl)
      + (c.tec ? ' <span class="ftm-badge ftm-badge--dir" title="Cambiar este dato reclasifica el equipo por la regla CREG">reclasifica</span>' : '')
      + '</span>'
      + '<input class="ftm-campo-input" data-edit="' + c.k + '" type="' + c.tipo + '"'
      + (c.tipo === 'number' ? ' step="any"' : '')
      + ' value="' + esc(actual) + '">'
      + '</label>';
  }).join('');

  const opciones = DECISIONES.map((o) =>
    '<option value="' + esc(o.id) + '"' + (d.decision === o.id ? ' selected' : '') + '>'
    + esc(o.id) + '</option>').join('');

  // Catálogo completo de UC para «Corregir a otra UUCC».
  const ucs = GRUPOS_UC.flatMap((g) => g.rows.map((r) => r.uc));
  const opcUC = [...new Set(ucs)].sort().map((u) =>
    '<option value="' + esc(u) + '"' + (d.final === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('');

  return ''
    + '<div class="ftm-drawer-head">'
    +   '<div><b>' + esc(equipo.subestacion || '—') + '</b>'
    +     '<div class="ftm-drawer-meta ftm-mono">' + esc(equipo.matricula || equipo.serie || equipo.codigo || '') + '</div></div>'
    +   '<button type="button" class="ftm-close" data-ftm="corr-cerrar" aria-label="Cerrar">✕</button>'
    + '</div>'
    + '<div class="ftm-drawer-body">'
    +   '<div class="ftm-veredicto">'
    +     '<span class="ftm-vbox ftm-vbox--reg"><small>UUCC registrada</small>'
    +       '<span class="ftm-vbox-val">' + esc(equipo.uucc_registrada || '—') + '</span></span>'
    +     '<span class="ftm-vbox ftm-vbox--calc"><small>UUCC calculada (regla CREG)</small>'
    +       '<span class="ftm-vbox-val">' + esc(equipo.uucc_calculada || '—') + '</span></span>'
    +     '<span class="ftm-pill">' + esc(equipo.estado) + '</span>'
    +   '</div>'

    +   '<div class="ftm-sect"><div class="ftm-sect-t">1 · Corregir datos</div>'
    +     '<div class="ftm-hint ftm-hint--p">Los marcados como <b>reclasifica</b> vuelven a pasar por la '
    +     'regla CREG al guardar; los demás solo corrigen la ficha.</div>'
    +     '<div class="ftm-form-grid">' + campos + '</div>'
    +   '</div>'

    +   '<div class="ftm-sect"><div class="ftm-sect-t">2 · Decisión sobre la UUCC</div>'
    +     '<div class="ftm-form-grid">'
    +       '<label class="ftm-campo"><span class="ftm-campo-lbl">Decisión</span>'
    +         '<select class="ftm-campo-input" data-dec="decision">'
    +           '<option value="">— sin decidir —</option>' + opciones + '</select></label>'
    +       '<label class="ftm-campo" data-dec-final' + (d.decision === 'Corregir a otra UUCC' ? '' : ' hidden') + '>'
    +         '<span class="ftm-campo-lbl">UUCC final</span>'
    +         '<select class="ftm-campo-input" data-dec="final">'
    +           '<option value="">— elija —</option>' + opcUC + '</select></label>'
    +       '<label class="ftm-campo"><span class="ftm-campo-lbl">Responsable</span>'
    +         '<input class="ftm-campo-input" data-dec="resp" type="text" value="' + esc(d.resp || '') + '"></label>'
    +       '<label class="ftm-campo"><span class="ftm-campo-lbl">Fecha</span>'
    +         '<input class="ftm-campo-input" data-dec="fecha" type="date" value="' + esc(hoy) + '"></label>'
    +     '</div>'
    +     '<label class="ftm-campo"><span class="ftm-campo-lbl">Observación (sustento)</span>'
    +       '<textarea class="ftm-campo-area" data-dec="obs" rows="3">' + esc(d.obs || '') + '</textarea></label>'
    +   '</div>'

    +   '<div class="ftm-edit-acts">'
    +     '<button type="button" class="ftm-btn ftm-btn--primary" data-ftm="corr-guardar">Guardar gestión</button>'
    +     '<button type="button" class="ftm-btn" data-ftm="corr-descartar">Descartar cambios de este equipo</button>'
    +   '</div>'
    + '</div>';
}

/* ─── Acta ─────────────────────────────────────────────────────── */

/** Filas del acta, como objetos con las claves de COLUMNAS_ACTA. */
export function filasActa(equipos, edits, dec) {
  return (equipos || [])
    .filter((e) => esNovedad(e) || edits[e.fila] || dec[e.fila])
    .map((e) => {
      const d = dec[e.fila] || {};
      return {
        'Fila': e.fila,
        'Serie': e.serie || '',
        'Subestación': e.subestacion || '',
        'Matrícula': e.matricula || '',
        'Zona': e.zona || '',
        'Departamento': e.departamento || '',
        'Potencia (kVA)': e.potencia_kva != null ? e.potencia_kva : '',
        'Vp (kV)': e.kv_prim != null ? e.kv_prim : '',
        'Nivel': e.nivel || '',
        'UUCC registrada': e.uucc_registrada || '',
        'UUCC calculada': e.uucc_calculada || '',
        'Estado': e.estado || '',
        'Datos corregidos': textoEdiciones(edits, e.fila),
        'Decisión': d.decision || '',
        'UUCC final': d.final || '',
        'Responsable': d.resp || '',
        'Fecha': d.fecha || '',
        'Observación': d.obs || ''
      };
    });
}

/**
 * Relee un acta exportada y recupera sus decisiones.
 * @param {Array<Array>} matriz  filas del Excel (fila 0 = cabecera)
 * @returns {{dec: object, leidas: number, ignoradas: number}}
 */
export function decisionesDesdeActa(matriz) {
  const out = { dec: {}, leidas: 0, ignoradas: 0 };
  if (!Array.isArray(matriz) || matriz.length < 2) return out;
  const hdr = (matriz[0] || []).map((x) => String(x == null ? '' : x).trim());
  const col = (n) => hdr.indexOf(n);
  const iFila = col('Fila');
  const iDec = col('Decisión');
  if (iFila < 0 || iDec < 0) return out;
  const iFinal = col('UUCC final'); const iResp = col('Responsable');
  const iFecha = col('Fecha'); const iObs = col('Observación');
  const valida = new Set(DECISIONES.map((d) => d.id));

  for (const fila of matriz.slice(1)) {
    if (!fila) continue;
    const nf = Number(fila[iFila]);
    const decision = String(fila[iDec] == null ? '' : fila[iDec]).trim();
    if (!isFinite(nf) || !decision) { continue; }
    if (!valida.has(decision)) { out.ignoradas += 1; continue; }
    const txt = (i) => (i >= 0 && fila[i] != null ? String(fila[i]).trim() : '');
    out.dec[nf] = {
      decision,
      final: txt(iFinal),
      resp: txt(iResp),
      fecha: txt(iFecha).slice(0, 10),
      obs: txt(iObs)
    };
    out.leidas += 1;
  }
  return out;
}

/**
 * Aplica las decisiones sobre los equipos YA normalizados. Muta
 * `uucc_registrada` y `estado`; jamás `uucc_calculada`.
 * @returns {{subsanadas:number, aceptadas:number, enGestion:number}}
 */
export function aplicarDecisiones(equipos, dec) {
  let subsanadas = 0; let aceptadas = 0; let enGestion = 0;
  for (const e of (equipos || [])) {
    const d = dec[e.fila];
    if (!d || !d.decision) continue;
    e.gestion = d.decision;
    if (d.decision === 'Aceptar UUCC calculada' && e.uucc_calculada) {
      e.uucc_registrada = e.uucc_calculada;
    } else if (d.decision === 'Corregir a otra UUCC' && d.final) {
      e.uucc_registrada = d.final;
    }
    if (e.uucc_calculada && e.uucc_registrada) {
      e.estado = (String(e.uucc_registrada) === String(e.uucc_calculada))
        ? 'CONCORDANTE' : 'DISCREPANCIA';
    }
    if (d.decision === 'Mantener UUCC registrada') aceptadas += 1;
    else if (e.estado === 'CONCORDANTE') subsanadas += 1;
    else enGestion += 1;
  }
  return { subsanadas, aceptadas, enGestion };
}

export default {
  DECISIONES, CAMPOS_EDITABLES, COLUMNAS_ACTA,
  esNovedad, resumenNovedades, textoEdiciones,
  barraCorreccionesHTML, cajonHTML, filasActa, decisionesDesdeActa, aplicarDecisiones
};
