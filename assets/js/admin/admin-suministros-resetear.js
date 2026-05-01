// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Resetear Movimientos (PM7 · 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Bulk-delete de /movimientos filtrado por contrato_id activo.
// Acción destructiva con doble confirmación (texto literal +
// botón). Cada delete deja entrada en /auditoria con uid + ts.
//
// El stock vuelve automáticamente al stock_inicial porque el motor
// de stock (assets/js/domain/stock_calculo.js) calcula
// stock_actual = stock_inicial + Σ ingresos − Σ egresos. Sin
// movimientos, la suma es 0 y stock_actual = stock_inicial.
//
// Implementación con `writeBatch` de hasta 500 deletes por batch
// (límite de Firestore). Si hay más de 500, se procesa en chunks.
// ══════════════════════════════════════════════════════════════

import {
  collection, query, where, getDocs, writeBatch, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { getContratoActivo } from '../ui/contrato-context.js';

const $ = (id) => document.getElementById(id);

const COL_MOV   = 'movimientos';
const COL_AUDIT = 'auditoria';
const BATCH_LIMIT = 450;

const statContrato  = $('statContrato');
const statCount     = $('statCount');
const confirmInput  = $('confirmText');
const btnResetear   = $('btnResetear');
const resetMsg      = $('resetMsg');

const cid = getContratoActivo();

if (!cid) {
  resetMsg.className = 'reset-msg is-err';
  resetMsg.textContent = '✕ No se detectó el contrato_id activo. Abre esta pestaña desde la página de un contrato.';
  btnResetear.disabled = true;
  statContrato.textContent = '—';
  statCount.textContent = '—';
} else {
  statContrato.textContent = cid;
}

// ── Conteo realtime de movimientos a borrar ───────────────────
async function refrescarConteo() {
  if (!isFirebaseConfigured) {
    statCount.textContent = '—';
    return;
  }
  const db = getDbSafe();
  if (!db || !cid) return;
  try {
    const snap = await getDocs(
      query(collection(db, COL_MOV), where('contrato_id', '==', cid))
    );
    statCount.textContent = String(snap.size);
    if (snap.size === 0) {
      btnResetear.disabled = true;
      btnResetear.title = 'No hay movimientos para borrar';
      confirmInput.disabled = true;
      confirmInput.placeholder = 'No hay nada que resetear';
    }
  } catch (err) {
    console.error('[resetear] no se pudo contar movimientos:', err);
    statCount.textContent = '?';
  }
}

// ── Validación del texto de confirmación ──────────────────────
const TEXTO_CONFIRMACION = 'RESETEAR';
confirmInput.addEventListener('input', () => {
  const valida = confirmInput.value.trim().toUpperCase() === TEXTO_CONFIRMACION;
  // Solo se habilita si: hay cid, hay movimientos > 0 (statCount no es 0/—)
  // y el texto coincide.
  const hayMovs = /^\d+$/.test(statCount.textContent || '') && parseInt(statCount.textContent, 10) > 0;
  btnResetear.disabled = !(valida && cid && hayMovs);
  btnResetear.title = btnResetear.disabled ? 'Escribe RESETEAR para habilitar' : 'Borrar todos los movimientos';
});

// ── Ejecución del reset ───────────────────────────────────────
btnResetear.addEventListener('click', async () => {
  if (!cid) return;
  if (!isFirebaseConfigured) {
    resetMsg.className = 'reset-msg is-err';
    resetMsg.textContent = '✕ Firebase no está configurado.';
    return;
  }
  const db = getDbSafe();
  if (!db) return;

  // Confirmación adicional con confirm() — el director debe presionar
  // OK explícitamente además de haber escrito RESETEAR.
  const total = parseInt(statCount.textContent, 10) || 0;
  if (!confirm(`¿Confirmas borrar ${total} movimiento${total === 1 ? '' : 's'} del contrato ${cid}?\n\nEsta acción NO se puede deshacer.`)) {
    return;
  }

  btnResetear.disabled = true;
  confirmInput.disabled = true;
  resetMsg.className = 'reset-msg is-progress';
  resetMsg.textContent = '⋯ leyendo movimientos del contrato…';

  try {
    const snap = await getDocs(
      query(collection(db, COL_MOV), where('contrato_id', '==', cid))
    );
    const docs = snap.docs;
    if (docs.length === 0) {
      resetMsg.className = 'reset-msg is-ok';
      resetMsg.textContent = '✓ No había movimientos para borrar — listo.';
      return;
    }

    // Procesa en chunks de BATCH_LIMIT.
    let borrados = 0;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const d of chunk) batch.delete(d.ref);
      resetMsg.textContent = `⋯ borrando ${i + 1}-${Math.min(i + BATCH_LIMIT, docs.length)} de ${docs.length}…`;
      await batch.commit();
      borrados += chunk.length;
    }

    // Audit entry — una sola, agregando el resumen.
    const sess = window.__sgmSession || {};
    const uid = sess.user && sess.user.uid;
    try {
      await addDoc(collection(db, COL_AUDIT), {
        accion: 'reset_movimientos',
        contrato_id: cid,
        movimientos_borrados: borrados,
        uid: uid || null,
        at: serverTimestamp(),
        at_iso: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[resetear] audit fallo (no bloqueante):', err);
    }

    resetMsg.className = 'reset-msg is-ok';
    resetMsg.textContent = `✓ ${borrados} movimiento${borrados === 1 ? '' : 's'} eliminado${borrados === 1 ? '' : 's'}. Stock vuelve al stock_inicial de cada suministro.`;
    statCount.textContent = '0';
    confirmInput.value = '';
    btnResetear.disabled = true;
    btnResetear.title = 'No hay movimientos para borrar';
    // Refresca el conteo (debería ser 0 ahora).
    setTimeout(refrescarConteo, 500);
  } catch (err) {
    console.error('[resetear] fallo:', err);
    resetMsg.className = 'reset-msg is-err';
    let msg = err.message || 'Error desconocido';
    if (/permission-denied|unauthorized/i.test(msg)) {
      msg += ' · Verifica que tu rol sea admin y que las reglas de Firestore permitan delete sobre /movimientos.';
    }
    resetMsg.textContent = '✕ ' + msg;
    btnResetear.disabled = false;
    confirmInput.disabled = false;
  }
});

// ── Init ──────────────────────────────────────────────────────
refrescarConteo();
