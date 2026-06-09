// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Modal de previsualización al colisionar por fecha (ADR-021/030)
// ──────────────────────────────────────────────────────────────
// Cuando se carga un informe cuya FECHA ya existe en el libro, este modal muestra
// el informe YA GUARDADO vs el NUEVO lado a lado (fecha, ejecutante, equipos, serie
// en PDF, pruebas) y permite ABRIR AMBOS PDFs (el guardado por su downloadURL; el
// nuevo —aún sin subir— por un blob URL del File local) para que el director
// constate si es el MISMO informe (reemplazar) o uno DISTINTO en la misma fecha
// (crear nuevo) — caso real del trafo móvil: mismo día, ensayos/configs distintos.
// Devuelve 'reemplazar' | 'nuevo'. Escape/fondo = 'nuevo' (no destructivo).
// Estilos inline → no depende de CSS. DOM puro.
// ══════════════════════════════════════════════════════════════

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object} prev  informe ya guardado (con prev.pdf.downloadURL para abrirlo)
 * @param {object} nuevo informe nuevo (metadatos; nuevo.pdf.downloadURL opcional)
 * @param {string} serie serie del libro
 * @param {object} item  contexto de carga; item.file = File local del PDF nuevo
 * @returns {Promise<'reemplazar'|'nuevo'>}
 */
export function confirmarUpsert(prev, nuevo, serie, item) {
  return new Promise((resolve) => {
    const fmt = (v) => esc(v == null || v === '' ? '—' : String(v));
    const pruebas = (inf) => fmt(String(inf.tipo_prueba || '').replace(/_/g, ' ') || '—');
    const filename = (item && item.file && item.file.name) || (nuevo.pdf && nuevo.pdf.filename) || '—';
    const fila = (k, v) =>
      `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #f1f5f9">` +
      `<span style="min-width:96px;color:#64748b;font-size:12px">${k}</span>` +
      `<span style="font-size:13px;color:#0f172a;word-break:break-word">${v}</span></div>`;
    const col = (titulo, inf, extra) =>
      `<div style="flex:1;min-width:240px;border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff">` +
      `<div style="font-weight:700;font-size:12px;letter-spacing:.04em;color:#334155;margin-bottom:8px">${titulo}</div>` +
      fila('Fecha', fmt(inf.fecha || inf.ano)) +
      fila('Ejecutante', fmt(inf.ejecutante)) +
      fila('Equipos', fmt(inf.equipo)) +
      fila('Serie en PDF', fmt(inf.serie_en_pdf)) +
      fila('Pruebas', pruebas(inf)) +
      (extra ? `<div style="margin-top:10px">${extra}</div>` : '') +
      `</div>`;
    const abrirPrev = (prev.pdf && prev.pdf.downloadURL)
      ? `<a class="btn btn-ghost btn-sm" href="${esc(prev.pdf.downloadURL)}" target="_blank" rel="noopener">↗ Abrir PDF guardado</a>`
      : '<span style="color:#94a3b8;font-size:12px">PDF no disponible</span>';
    // PDF NUEVO (a cargar): es un File local (item.file) aún sin subir → se abre con
    // un blob URL al hacer clic; si no hay File pero ya tiene downloadURL, se usa ese.
    const nuevoPdfUrl = (nuevo.pdf && nuevo.pdf.downloadURL) || null;
    const puedeAbrirNuevo = !!(item && item.file) || !!nuevoPdfUrl;
    const abrirNuevo = puedeAbrirNuevo
      ? '<button type="button" class="btn btn-ghost btn-sm" data-abrir-nuevo="1">↗ Abrir PDF a cargar</button>'
      : '<span style="color:#94a3b8;font-size:12px">PDF no disponible</span>';
    const ov = document.createElement('div');
    ov.setAttribute('style',
      'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);' +
      'display:flex;align-items:center;justify-content:center;padding:20px');
    ov.innerHTML =
      `<div role="dialog" aria-modal="true" aria-label="Confirmar carga de informe" ` +
      `style="background:#fff;border-radius:14px;max-width:680px;width:100%;` +
      `box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;font-family:inherit">` +
        `<div style="padding:16px 20px;border-bottom:1px solid #e2e8f0">` +
          `<div style="font-weight:700;color:#0f172a">Misma fecha (${fmt(nuevo.fecha || nuevo.ano)}) · serie ${esc(serie)}</div>` +
          `<div style="color:#64748b;font-size:12px;margin-top:4px">Ya hay un informe con esta fecha. <b>Abre ambos PDFs</b> para comparar y decide si es el ` +
          `<b>mismo</b> (reemplazar) o uno <b>distinto</b> en la misma fecha (crear nuevo).</div>` +
        `</div>` +
        `<div style="display:flex;gap:14px;flex-wrap:wrap;padding:16px 20px;background:#f8fafc">` +
          col('YA GUARDADO', prev, abrirPrev) +
          col('NUEVO (a cargar)', nuevo, `<div style="color:#64748b;font-size:12px;margin-bottom:8px">Archivo: ${fmt(filename)}</div>${abrirNuevo}`) +
        `</div>` +
        `<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #e2e8f0;flex-wrap:wrap">` +
          `<button type="button" class="btn btn-ghost" data-ups="nuevo">Son distintos · crear nuevo</button>` +
          `<button type="button" class="btn btn-primary" data-ups="reemplazar">Es el mismo · reemplazar</button>` +
        `</div>` +
      `</div>`;
    let nuevoBlobUrl = null;
    const cerrar = (val) => { document.removeEventListener('keydown', onKey); if (nuevoBlobUrl) URL.revokeObjectURL(nuevoBlobUrl); ov.remove(); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar('nuevo'); };
    ov.addEventListener('click', (e) => {
      // Abrir el PDF NUEVO (a cargar) en otra pestaña, SIN cerrar el modal — así se
      // comparan ambos PDFs (guardado + nuevo) antes de decidir iguales/distintos.
      if (e.target.closest('[data-abrir-nuevo]')) {
        e.preventDefault();
        if (item && item.file) { nuevoBlobUrl = nuevoBlobUrl || URL.createObjectURL(item.file); window.open(nuevoBlobUrl, '_blank', 'noopener'); }
        else if (nuevoPdfUrl) window.open(nuevoPdfUrl, '_blank', 'noopener');
        return;
      }
      const b = e.target.closest('[data-ups]');
      if (b) return cerrar(b.getAttribute('data-ups'));
      if (e.target === ov) cerrar('nuevo'); // clic en el fondo = no destructivo
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  });
}
