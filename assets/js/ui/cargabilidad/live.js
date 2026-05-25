// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · SIMULACIÓN TIEMPO REAL
// Cuando el usuario activa "Tiempo real", la carga de cada
// devanado se mueve con un pequeño jitter cada 4s para simular
// telemetría. Cuando Firestore esté poblado en realtime, este
// módulo se desactivará automáticamente (no tiene sentido
// simular cuando hay datos verdaderos llegando).
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { recompute } from '../../domain/cargabilidad_severidad.js';

let _timer = null;
const PERIODO_MS = 4000;

function jitter() {
  const rows = store.state.rows;
  if (!rows || !rows.length) return;
  rows.forEach(d => {
    if (!d._base) return;
    ['P', 'S', 'T'].forEach(w => {
      const b = d._base[w];
      if (b == null) return;
      const step = (Math.random() - 0.48) * b * 0.04;
      d[w].car = Math.max(0, +(d[w].car + step).toFixed(2));
      // Re-anclar ocasionalmente para evitar deriva
      if (Math.random() < 0.06) {
        d[w].car = +(b * (0.92 + Math.random() * 0.18)).toFixed(2);
      }
    });
    recompute(d);
  });
  store.setLastTs(Date.now());
  // Re-emitir el store para que los renderers refresquen
  store.setRows(rows, store.state.source);
}

export function toggleLive() {
  const nuevo = !store.state.live;
  store.setLive(nuevo);
  if (nuevo) {
    _timer = setInterval(jitter, PERIODO_MS);
  } else {
    if (_timer) clearInterval(_timer);
    _timer = null;
  }
  return nuevo;
}

export function detenerLive() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  store.setLive(false);
}

// Establece los valores _base (snapshot inicial) sobre cada
// trafo · usado en boot tras hidratar el store.
export function fijarBase(rows) {
  if (!Array.isArray(rows)) return rows;
  rows.forEach((d, i) => {
    d._i = i;
    d._base = { P: d.P?.car ?? null, S: d.S?.car ?? null, T: d.T?.car ?? null };
  });
  return rows;
}
