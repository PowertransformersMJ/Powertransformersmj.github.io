// Helpers comunes para los renderers de Cargabilidad

export const $  = (sel) => document.querySelector(sel);
export const $$ = (sel) => [...document.querySelectorAll(sel)];

export function fmt(n, d = 0) {
  if (n == null || !Number.isFinite(+n)) return '—';
  return Number(n).toLocaleString('es-CO', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

// Capitaliza "BOLIVAR" → "Bolivar"
export function cap(s) {
  if (!s) return s;
  const str = String(s);
  return str[0] + str.slice(1).toLowerCase();
}
