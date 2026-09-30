// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Panel «Fichas Técnicas: quién más puede exportar con estas firmas» (solo custodio) · `99 §119`
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-30): «necesito que en el módulo de fichas técnicas
// Jorge y Carlos puedan exportar el archivo Excel con todas las firmas. Yo lo
// autorizo». Aquí el custodio:
//   1. ve qué firmas hay HOY en su directorio (la suya sale de la copia de «Mi firma»
//      que se hace en la sección de Órdenes E/S: una sola copia para los dos usos);
//   2. da o retira, usuario por usuario, el permiso de exportar el Excel con las firmas
//      que marque, con la fecha y el medio de la autorización de cada titular;
//   3. ve los últimos Excel que otros usuarios emitieron con esas firmas (folio).
// Espejo del panel de Órdenes (`firmas-delegadas-panel.js`, `99 §117`), que queda
// INTACTO. Todo texto que viene del usuario se pinta con textContent. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { PERSONAS_EQUIPO, hoyLocalISO, validarAutorizacion, nombreDePersona } from '../../domain/firmas_equipo.js';
import { lineaDeLaSesion } from '../../domain/firmas_sesion.js';
import { personasPorCasilla } from '../../domain/fichas_firmas_delegadas.js';

const MEDIO_POR_DEFECTO = 'Autorización verbal al Ing. Miguel Jimenez';
const ROL = { elab: 'Elaboración', rev: 'Revisión', apr: 'Aprobación', apr2: 'segunda Aprobación', rec: 'Recibe' };

const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
const fechaDMA = (iso) => String(iso || '').split('-').reverse().join('/');
/** Clave de la lista de la persona que tiene la sesión (por la lista cerrada de nombres), o null. */
function claveDeLaSesion(nombreSesion) {
  const p = PERSONAS_EQUIPO.find((x) => x.nombres.some((n) => lineaDeLaSesion(n, nombreSesion)));
  return p ? p.id : null;
}
/** Sugerencia (solo para la pantalla) de quién es un usuario en la lista, por su nombre de perfil. */
function sugerirPropia(nombrePerfil) {
  const n = String(nombrePerfil || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (/\bCARLOS\b/.test(n) && /\bMARTELO\b/.test(n)) return 'CARLOS_MARTELO';
  if (/\bJORGE\b/.test(n) && /\bRHENALS\b/.test(n)) return 'JORGE_RHENALS';
  return '';
}
/** Casillas de la ficha donde puede ir la firma de `id` («Revisión y Aprobación»). */
function casillasDe(id) {
  const pc = personasPorCasilla();
  const ks = Object.keys(pc).filter((k) => pc[k].includes(id)).map((k) => ROL[k]);
  return ks.length > 1 ? ks.slice(0, -1).join(', ') + ' y ' + ks[ks.length - 1] : (ks[0] || '');
}

/**
 * Monta el panel.
 * @param {HTMLElement} contenedor
 * @param {{datosEquipo: object, datosDelegaciones: object, nombreSesion: string, alCambiar?: Function}} opts
 *   datosEquipo: data/firmas_equipo.js · datosDelegaciones: data/delegaciones_fichas.js
 */
export function montarFirmasDelegadasFichas(contenedor, opts = {}) {
  if (!contenedor) return null;
  const { datosEquipo, datosDelegaciones: dd } = opts;
  const alCambiar = typeof opts.alCambiar === 'function' ? opts.alCambiar : () => {};
  const miClave = claveDeLaSesion(opts.nombreSesion);

  contenedor.textContent = '';
  const caja = el('div', 'fe-caja fd-caja');
  caja.appendChild(el('h4', 'fd-titulo', 'Fichas Técnicas: quién más puede exportar el Excel con estas firmas'));
  caja.appendChild(el('p', 'fe-ayuda',
    'Los usuarios que usted autorice aquí, al pulsar «Exportar Excel» en una ficha, sacan el PE.02081 con las firmas '
    + 'que marque, cada una en su casilla (la misma lista de firmantes de la ficha). En la casilla de ellos va su «Mi firma» '
    + 'si la cargaron; si no, su firma del directorio, si usted se la marca. Cada descarga queda registrada con folio: quién '
    + 'la emitió, de qué transformador y con qué firmas. '
    + 'Tenga presente que quien puede usar una firma puede también copiar su imagen: el registro cubre lo que se emite '
    + 'desde la plataforma, no las copias.'));

  // ── 1. Qué hay hoy en el directorio ──
  const sec1 = el('div', 'fd-seccion');
  sec1.appendChild(el('p', 'fd-sub', 'Firmas que hoy están en su directorio (las que pueden salir)'));
  const estadoDir = el('ul', 'fd-dir');
  sec1.appendChild(estadoDir);
  caja.appendChild(sec1);

  // ── 2. Permisos por usuario ──
  const sec2 = el('div', 'fd-seccion');
  sec2.appendChild(el('p', 'fd-sub', 'Usuarios autorizados en Fichas'));
  const lista = el('div', 'fd-lista');
  sec2.appendChild(lista);
  caja.appendChild(sec2);

  // ── 3. Últimos usos ──
  const sec3 = el('div', 'fd-seccion');
  sec3.appendChild(el('p', 'fd-sub', 'Últimos Excel emitidos por otros usuarios con estas firmas'));
  const usos = el('div', 'fd-usos', 'Consultando…');
  sec3.appendChild(usos);
  caja.appendChild(sec3);
  contenedor.appendChild(caja);

  let pintado = false;
  async function pintarDirectorio() {
    pintado = true;
    estadoDir.textContent = 'Consultando…';
    const estados = await Promise.all(dd.DELEGABLES.map(async (id) => {
      try { return [id, await datosEquipo.estadoFirma(id)]; } catch (_) { return [id, { hay: false, error: true }]; }
    }));
    estadoDir.textContent = '';
    for (const [id, e] of estados) {
      let t;
      if (e && e.error) t = 'no se pudo consultar (revise la conexión).';
      else if (e && e.hay) t = 'está (desde el ' + fechaDMA(e.autorizacion && e.autorizacion.fecha) + ').';
      else if (id === miClave) t = 'FALTA: cópiela con «Copiar mi firma propia», en la sección de Órdenes E/S de arriba (la misma copia sirve para los dos).';
      else t = 'FALTA: súbala arriba, en la lista del directorio. Mientras falte, su casilla sale en blanco.';
      estadoDir.appendChild(el('li', null, nombreDePersona(id) + ' (' + casillasDe(id) + '): ' + t));
    }
  }

  /** «Retirar permiso» suelto (usuario sin nombre o que ya no está activo): el retiro no depende del nombre. */
  function botonRetirar(uid, etiqueta, lote) {
    const caja = el('div', 'fd-botones');
    const b = el('button', 'ftm-btn', 'Retirar permiso'); b.type = 'button';
    const m = el('p', 'fe-msg'); m.setAttribute('aria-live', 'polite');
    b.addEventListener('click', async () => {
      if (!globalThis.confirm('¿Retirar el permiso de ' + etiqueta + ' en Fichas?')) return;
      b.disabled = true; const r = await dd.retirar(uid, lote); b.disabled = false;
      m.textContent = r.ok ? '' : r.motivo;
      if (r.ok) { await refrescar(); alCambiar(); }
    });
    caja.append(b, m);
    return caja;
  }

  /** Una fila por usuario: quién es en la lista, qué firmas y con qué autorización. */
  function filaUsuario(u, vigente, vigentes) {
    const f = el('div', 'fd-fila');
    const cab = el('div', 'fd-cab');
    cab.appendChild(el('b', 'fe-nombre', u.etiqueta || u.nombre));
    cab.appendChild(el('span', 'fe-estado', vigente
      ? 'Con permiso en Fichas: ' + (vigente.personas || []).map(nombreDePersona).join(', ') + '.'
      : 'Sin permiso en Fichas.'));
    f.appendChild(cab);

    if (!u.nombre) {
      // La regla compara con el nombre del perfil: sin nombre no se le puede dar permiso (pero sí retirarlo).
      f.appendChild(el('p', 'fe-msg', 'Este usuario no tiene nombre en su perfil: póngaselo en Administración › Usuarios para poder darle permiso.'));
      if (vigente) f.appendChild(botonRetirar(u.uid, u.etiqueta || u.uid, vigente.lote));
      return f;
    }
    const form = el('form', 'fe-form fd-form');
    form.setAttribute('aria-label', 'Permiso de ' + (u.etiqueta || u.nombre) + ' para exportar fichas con firmas del equipo');
    const lblQuien = el('label', null, 'Este usuario es, en la lista: ');
    const sel = el('select');
    for (const [v, t] of [['', '— elija —'], ['CARLOS_MARTELO', 'CARLOS MARTELO'], ['JORGE_RHENALS', 'JORGE RHENALS']]) {
      const o = el('option', null, t); o.value = v; sel.appendChild(o);
    }
    sel.value = (vigente && vigente.personaPropia) || sugerirPropia(u.nombre);
    lblQuien.appendChild(sel);
    form.appendChild(lblQuien);

    const marcas = {};
    for (const p of dd.DELEGABLES) {
      const a = (vigente && vigente.autorizaciones && vigente.autorizaciones[p]) || null;
      const linea = el('div', 'fd-persona');
      const chk = el('input'); chk.type = 'checkbox'; chk.checked = vigente ? (vigente.personas || []).includes(p) : true;
      const lbl = el('label', null, ' Firma de ' + nombreDePersona(p) + ' (' + casillasDe(p) + ')'); lbl.prepend(chk);
      const inF = el('input'); inF.type = 'date'; inF.max = hoyLocalISO(); inF.value = (a && a.fecha) || hoyLocalISO();
      const inM = el('input'); inM.type = 'text'; inM.maxLength = 200;
      inM.value = (a && a.medio) || (p === miClave ? 'Autorización del custodio' : MEDIO_POR_DEFECTO);
      chk.setAttribute('aria-label', 'Firma de ' + nombreDePersona(p) + ' para ' + (u.etiqueta || u.nombre));
      inF.setAttribute('aria-label', 'Fecha de la autorización de ' + nombreDePersona(p));
      inM.setAttribute('aria-label', 'Medio de la autorización de ' + nombreDePersona(p));
      const lf = el('label', null, 'autorizada el '); lf.appendChild(inF);
      const lm = el('label', null, 'medio '); lm.appendChild(inM);
      linea.append(lbl, lf, lm);
      form.appendChild(linea);
      marcas[p] = { chk, inF, inM };
    }
    const bGuardar = el('button', 'ftm-btn ftm-btn--primary', vigente ? 'Guardar cambios' : 'Dar permiso en Fichas'); bGuardar.type = 'submit';
    const bRetirar = el('button', 'ftm-btn', 'Retirar permiso'); bRetirar.type = 'button'; bRetirar.hidden = !vigente;
    const msg = el('p', 'fe-msg'); msg.setAttribute('aria-live', 'polite');
    const botones = el('div', 'fd-botones'); botones.append(bGuardar, bRetirar);
    form.append(botones, msg);
    f.appendChild(form);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      msg.textContent = '';
      if (!sel.value) { msg.textContent = 'Elija quién es este usuario en la lista.'; return; }
      // Dos usuarios con la misma clave: el registro diría que las dos casillas son de uno.
      const otro = [...(vigentes || new Map())].find(([uid, x]) => uid !== u.uid && x && x.personaPropia === sel.value);
      if (otro) { msg.textContent = 'Otro usuario (' + (otro[1].delegadoNombre || otro[0]) + ') ya figura como ' + nombreDePersona(sel.value) + '. Corríjalo primero.'; return; }
      const personas = dd.DELEGABLES.filter((p) => marcas[p].chk.checked);
      if (!personas.length) { msg.textContent = 'Marque al menos una firma (o retire el permiso).'; return; }
      const autorizaciones = {};
      for (const p of personas) {
        const a = { fecha: marcas[p].inF.value, medio: marcas[p].inM.value };
        const v = validarAutorizacion(a);
        if (!v.ok) { msg.textContent = nombreDePersona(p) + ': ' + v.motivo; return; }
        autorizaciones[p] = a;
      }
      bGuardar.disabled = true; msg.textContent = 'Guardando…';
      const r = await dd.otorgar(u.uid, { delegadoNombre: u.nombre, personaPropia: sel.value, personas, autorizaciones }, vigente);
      bGuardar.disabled = false;
      msg.textContent = r.ok ? '' : r.motivo;
      if (r.ok) { await refrescar(); alCambiar(); }
    });
    bRetirar.addEventListener('click', async () => {
      if (!globalThis.confirm('¿Retirar el permiso de ' + (u.etiqueta || u.nombre) + ' en Fichas? Desde su próxima descarga ya no podrá usar estas firmas.')) return;
      bRetirar.disabled = true; msg.textContent = 'Retirando…';
      const r = await dd.retirar(u.uid, vigente.lote);
      bRetirar.disabled = false;
      msg.textContent = r.ok ? '' : r.motivo;
      if (r.ok) { await refrescar(); alCambiar(); }
    });
    return f;
  }

  async function pintarUsuarios() {
    lista.textContent = 'Consultando…';
    try {
      const [usuarios, vigentes] = await Promise.all([dd.usuariosParaDelegar(), dd.delegacionesVigentes()]);
      lista.textContent = '';
      for (const u of usuarios) lista.appendChild(filaUsuario(u, vigentes.get(u.uid) || null, vigentes));
      // Un permiso de alguien que ya no está activo sigue ahí: se muestra para poder retirarlo.
      const activos = new Set(usuarios.map((u) => u.uid));
      for (const [uid, v] of vigentes) {
        if (activos.has(uid)) continue;
        const f = el('div', 'fd-fila');
        f.appendChild(el('b', 'fe-nombre', (v.delegadoNombre || uid) + ' (usuario inactivo o que ya no está)'));
        f.appendChild(el('p', 'fe-estado', 'Conserva permiso en Fichas para: ' + (v.personas || []).map(nombreDePersona).join(', ') + '. Si lo reactivan, podría volver a usarlas.'));
        f.appendChild(botonRetirar(uid, v.delegadoNombre || uid, v.lote));
        lista.appendChild(f);
      }
      if (!lista.childElementCount) lista.textContent = 'No hay otros usuarios activos.';
    } catch (e) {
      console.warn('[firmas-delegadas-fichas] usuarios:', e);
      lista.textContent = 'No se pudo consultar (revise la conexión).';
    }
  }

  async function pintarUsos() {
    try {
      const filas = await dd.ultimosUsos();
      usos.textContent = '';
      if (!filas.length) { usos.textContent = 'Todavía ninguno.'; return; }
      const t = el('table', 'fd-tabla');
      const cab = el('tr');
      for (const h of ['Fecha', 'Emitió', 'Transformador', 'Firmas del directorio', 'Folio']) cab.appendChild(el('th', null, h));
      t.appendChild(cab);
      for (const x of filas) {
        const tr = el('tr');
        const firmas = x.casillas.filter((c) => c.origen === 'equipo').map((c) => nombreDePersona(c.persona) || c.nombre);
        const eq = [x.equipo.subestacion, x.equipo.matricula].filter(Boolean).join(' · ');
        for (const v of [x.en ? x.en.toLocaleString('es-CO') : '—', x.emisorNombre, eq || '—',
          [...new Set(firmas)].join(', ') || '—', x.folio]) tr.appendChild(el('td', null, v));
        t.appendChild(tr);
      }
      usos.appendChild(t);
    } catch (e) {
      console.warn('[firmas-delegadas-fichas] usos:', e);
      usos.textContent = 'No se pudo consultar (revise la conexión).';
    }
  }

  async function refrescar() { await Promise.all([pintarDirectorio().catch(() => {}), pintarUsuarios(), pintarUsos()]); }
  // Si cambia el directorio (o la copia de «Mi firma») después de verlo, su estado se actualiza.
  globalThis.addEventListener('sgm:firmas-equipo-cambiadas', () => { if (pintado && contenedor.isConnected) pintarDirectorio().catch(() => {}); });
  return { refrescar };
}
