// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Carga perezosa de Plotly 2.35.2 con integridad (SRI) · `99 §122`
// ──────────────────────────────────────────────────────────────
// Una sola descarga por página (promesa memoizada), con `integrity` (huella sha384
// verificada el 2026-09-30; cdn.plot.ly responde Access-Control-Allow-Origin: *) y el
// idioma español registrado en línea (sin segunda descarga). Archivo NUEVO (L-102): las
// copias privadas de seguimiento-shell.js y calidad-shell.js no se tocan.
// ══════════════════════════════════════════════════════════════

const URL_PLOTLY = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
const SRI_PLOTLY = 'sha384-cCVCZkAjYNxaYKbM8lsArLznDF/SvMFr1jcZrvOpSTCa0W40ZAdLzHCEulnUa5i7';
let promesa = null;

function registrarEspanol(Plotly) {
  try {
    Plotly.register({
      moduleType: 'locale', name: 'es',
      dictionary: { 'Autoscale': 'Escala automática', 'Reset axes': 'Restablecer ejes', 'Zoom in': 'Acercar', 'Zoom out': 'Alejar', 'Pan': 'Desplazar', 'Zoom': 'Zoom', 'Download plot as a png': 'Descargar como PNG', 'Double-click to zoom back out': 'Doble clic para volver' },
      format: {
        days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
        shortDays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
        months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
        shortMonths: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
        date: '%d/%m/%Y', decimal: ',', thousands: '.'
      }
    });
  } catch (_) { /* sin idioma: las fechas salen en inglés, el gráfico funciona */ }
}

/** Carga Plotly una sola vez; rechaza con un error claro si no se pudo. */
export function loadPlotly() {
  if (typeof window !== 'undefined' && window.Plotly) { registrarEspanol(window.Plotly); return Promise.resolve(window.Plotly); }
  if (promesa) return promesa;
  promesa = new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = URL_PLOTLY; s.async = true; s.integrity = SRI_PLOTLY; s.crossOrigin = 'anonymous';
    s.onload = () => {
      if (!window.Plotly) { promesa = null; rechazar(new Error('La librería de gráficos cargó, pero no quedó disponible.')); return; }
      registrarEspanol(window.Plotly);
      resolver(window.Plotly);
    };
    s.onerror = () => { promesa = null; rechazar(new Error('No se pudo descargar la librería de gráficos (revise la conexión).')); };
    document.head.appendChild(s);
  });
  return promesa;
}
