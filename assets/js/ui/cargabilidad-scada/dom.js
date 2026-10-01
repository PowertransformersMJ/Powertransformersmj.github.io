// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · utilidades de DOM (todo texto con textContent) · `99 §122`
// ══════════════════════════════════════════════════════════════

/**
 * Crea un elemento. `attrs`: atributos (class, id, aria-*, data-*, type…) y `on*` para eventos.
 * Los hijos pueden ser nodos o texto (siempre como texto, nunca HTML).
 */
export function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'hidden') e.hidden = !!v;
    else if (k === 'disabled') e.disabled = !!v;
    else if (k === 'checked') e.checked = !!v;
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    e.appendChild(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return e;
}

/** Vacía un contenedor y le pone los hijos. */
export function poner(cont, ...hijos) {
  cont.textContent = '';
  for (const h of hijos.flat()) if (h) cont.appendChild(h instanceof Node ? h : document.createTextNode(String(h)));
  return cont;
}

/** Número en español con decimales fijos ('—' si no hay). */
export function num(v, dec = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Pestañas accesibles (flechas izquierda/derecha, Inicio/Fin). */
export function pestanas(lista, alCambiar) {
  const tabs = [...lista.querySelectorAll('[role="tab"]')];
  const activar = (t, foco = false) => {
    for (const x of tabs) {
      const sel = x === t;
      x.setAttribute('aria-selected', String(sel));
      x.tabIndex = sel ? 0 : -1;
      const p = document.getElementById(x.getAttribute('aria-controls'));
      if (p) p.hidden = !sel;
    }
    if (foco) t.focus();
    if (alCambiar) alCambiar(t.id);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activar(t));
    t.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = tabs.length - 1;
      if (j != null) { ev.preventDefault(); activar(tabs[j], true); }
    });
  });
  return { activar: (id) => { const t = tabs.find((x) => x.id === id); if (t) activar(t); } };
}

/**
 * Repinta conservando el foco: si el control enfocado tenía id y sigue existiendo tras `fn`,
 * vuelve a él (un repintado no debe dejar al usuario de teclado en <body>).
 */
export function conservarFoco(fn) {
  const a = document.activeElement;
  const id = a && a !== document.body ? a.id : null;
  const r = fn();
  if (id) { const e = document.getElementById(id); if (e && e !== document.activeElement) e.focus({ preventScroll: true }); }
  return r;
}

/** Espera a que el guardián de sesión publique la sesión. */
export function esperarSesion(ms = 30000) {
  if (window.__sgmSession) return Promise.resolve(window.__sgmSession);
  return new Promise((res) => {
    const t = setTimeout(() => res(window.__sgmSession || null), ms);
    window.addEventListener('sgm:session-ready', () => { clearTimeout(t); res(window.__sgmSession || null); }, { once: true });
  });
}

/** Celda CSV (separador ';', decimales con coma como los lee Excel en español). */
export function celdaCSV(x, dec = 3) {
  if (x == null || (typeof x === 'number' && !Number.isFinite(x))) return '';
  if (typeof x === 'number') return String(Math.round(x * 10 ** dec) / 10 ** dec).replace('.', ',');
  let t = String(x);
  // Un texto que empieza por = + - @ lo ejecutaría Excel como fórmula: se antepone un apóstrofo.
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

/** Descarga un CSV (con BOM para que Excel respete las tildes). */
export function descargarCSV(nombre, encabezado, filas) {
  const lineas = [encabezado.map((x) => celdaCSV(x)).join(';')];
  for (const f of filas) lineas.push(f.map((x) => celdaCSV(x)).join(';'));
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
