// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Panel «Firmas en Órdenes E/S: quién más puede usarlas» (solo custodio) · `99 §117`
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-28): «que los usuarios de Carlos Martelo y Jorge
// Rhenals, al exportar la orden, salgan las firmas de ellos y la mía; yo
// autorizo». Aquí el custodio:
//   1. copia SU firma propia («Mi firma») al directorio, para que salga en
//      «AUTORIZADO POR» cuando exporta otro usuario (con huella y registro);
//   2. da o retira, usuario por usuario, el permiso de usar en Órdenes E/S las
//      firmas que marque, con la fecha y el medio de la autorización de cada titular;
//   3. ve los últimos documentos que otros usuarios emitieron con esas firmas.
// Todo texto que viene del usuario se pinta con textContent. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { PERSONAS_EQUIPO, hoyLocalISO, validarAutorizacion, nombreDePersona } from '../../domain/firmas_equipo.js';
import { lineaDeLaSesion } from '../../domain/firmas_sesion.js';

const MEDIO_POR_DEFECTO = 'Autorización verbal al Ing. Miguel Jimenez';
const MEDIO_PROPIO = 'Firma propia del custodio (copia de «Mi firma»)';
const TOPE_BYTES = 512 * 1024;
const LINEA_DE = { MIGUEL_JIMENEZ: '«Autorizado por»', CARLOS_MARTELO: '«Entregado por»', JORGE_RHENALS: '«Entregado por»' };

const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
const fechaDMA = (iso) => String(iso || '').split('-').reverse().join('/');
function bytesDeDataUrl(u) {
  const b = atob(String(u || '').split(',')[1] || '');
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
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

/**
 * Monta el panel.
 * @param {HTMLElement} contenedor
 * @param {{datosEquipo: object, datosDelegaciones: object, datosFirma: object, nombreSesion: string, alCambiar?: Function}} opts
 *   datosEquipo: data/firmas_equipo.js · datosDelegaciones: data/delegaciones_firmas.js · datosFirma: data/firmas.js
 */
export function montarFirmasDelegadas(contenedor, opts = {}) {
  if (!contenedor) return null;
  const { datosEquipo, datosDelegaciones: dd, datosFirma } = opts;
  const alCambiar = typeof opts.alCambiar === 'function' ? opts.alCambiar : () => {};
  const miClave = claveDeLaSesion(opts.nombreSesion);

  contenedor.textContent = '';
  const caja = el('div', 'fe-caja fd-caja');
  caja.appendChild(el('h4', 'fd-titulo', 'Órdenes de Entrada/Salida: quién más puede usar estas firmas'));
  caja.appendChild(el('p', 'fe-ayuda',
    'Los usuarios que usted autorice aquí, al exportar una orden en PDF o Excel, estampan las firmas que marque, cada una '
    + 'solo en su línea: la suya en «Autorizado por» y la de Carlos Martelo o Jorge Rhenals en «Entregado por». Cada '
    + 'documento queda registrado con folio (quién lo emitió y con qué firmas). Tenga presente que quien puede usar una '
    + 'firma puede también copiar su imagen: el registro cubre lo que se emite desde la plataforma, no las copias.'));

  // ── 1. Su firma en el directorio ──
  const sec1 = el('div', 'fd-seccion');
  sec1.appendChild(el('p', 'fd-sub', 'Su firma para «Autorizado por» cuando exporta otro usuario'));
  const est1 = el('p', 'fe-estado', 'Consultando…');
  const acc1 = el('div', 'fe-acciones');
  const bCopiar = el('button', 'ftm-btn', 'Copiar mi firma propia'); bCopiar.type = 'button';
  const bQuitarCopia = el('button', 'ftm-btn', 'Retirar la copia'); bQuitarCopia.type = 'button'; bQuitarCopia.hidden = true;
  acc1.append(bCopiar, bQuitarCopia);
  const msg1 = el('p', 'fe-msg fe-aviso'); msg1.setAttribute('aria-live', 'polite');
  sec1.append(est1, acc1, msg1);
  caja.appendChild(sec1);

  // ── 2. Permisos por usuario ──
  const sec2 = el('div', 'fd-seccion');
  sec2.appendChild(el('p', 'fd-sub', 'Usuarios autorizados'));
  const lista = el('div', 'fd-lista');
  sec2.appendChild(lista);
  caja.appendChild(sec2);

  // ── 3. Últimos usos ──
  const sec3 = el('div', 'fd-seccion');
  sec3.appendChild(el('p', 'fd-sub', 'Últimos documentos emitidos por otros usuarios con estas firmas'));
  const usos = el('div', 'fd-usos', 'Consultando…');
  sec3.appendChild(usos);
  caja.appendChild(sec3);
  contenedor.appendChild(caja);

  if (!miClave) {
    est1.textContent = 'Su nombre de perfil no está en la lista de firmantes: no hay firma suya que copiar.';
    bCopiar.hidden = true;
  }

  async function pintarCopia() {
    if (!miClave) return;
    msg1.textContent = '';
    const [copia, propiaUrl] = await Promise.all([datosEquipo.leerFirma(miClave), datosFirma.miFirma()]);
    if (copia && copia.error) { est1.textContent = 'No se pudo consultar la copia (revise la conexión).'; return; }
    const huellaPropia = propiaUrl ? await datosEquipo.huellaDe(bytesDeDataUrl(propiaUrl)) : null;
    if (!copia) {
      est1.textContent = propiaUrl ? 'Su firma aún NO está en el directorio: cuando exporte otro usuario, «Autorizado por» saldrá en blanco.'
        : 'Aún no ha cargado «Mi firma» (arriba). Cárguela primero y luego cópiela aquí.';
      bCopiar.textContent = 'Copiar mi firma propia'; bCopiar.disabled = !propiaUrl; bQuitarCopia.hidden = true;
      return;
    }
    const igual = huellaPropia && copia.huella === huellaPropia;
    est1.textContent = 'Copiada el ' + fechaDMA(copia.autorizacion && copia.autorizacion.fecha)
      + (igual ? ' · es su firma actual.' : (huellaPropia ? ' · OJO: ya no es su firma actual de «Mi firma»; actualícela.' : '.'));
    bCopiar.textContent = 'Actualizar la copia'; bCopiar.disabled = !propiaUrl || !!igual; bQuitarCopia.hidden = false;
  }
  bCopiar.addEventListener('click', async () => {
    bCopiar.disabled = true; msg1.textContent = 'Copiando…';
    try {
      const url = await datosFirma.miFirma();
      if (!url) { msg1.textContent = 'No hay «Mi firma» cargada.'; return; }
      const png = bytesDeDataUrl(url);
      if (png.length > TOPE_BYTES) { msg1.textContent = 'Su firma pesa ' + Math.round(png.length / 1024) + ' KB (máximo 512): vuelva a cargarla en «Mi firma», recortada.'; return; }
      // Los bytes EXACTOS: así la huella de la copia es la de «Mi firma» y se nota si cambia.
      const r = await datosEquipo.subirFirma(miClave, png, { fecha: hoyLocalISO(), medio: MEDIO_PROPIO });
      msg1.textContent = r.ok ? 'Copiada.' : r.motivo;
      if (r.ok) alCambiar();
    } catch (e) {
      msg1.textContent = (e && e.message) || 'No se pudo copiar.';
    } finally {
      await pintarCopia();
    }
  });
  bQuitarCopia.addEventListener('click', async () => {
    if (!globalThis.confirm('¿Retirar la copia de su firma del directorio? Los usuarios autorizados dejarán de estamparla en «Autorizado por».')) return;
    bQuitarCopia.disabled = true;
    const r = await datosEquipo.quitarFirma(miClave);
    bQuitarCopia.disabled = false;
    msg1.textContent = r.ok ? 'Retirada.' : (r.motivo || 'No se pudo retirar.');
    await pintarCopia();
    alCambiar();
  });

  /** Una fila por usuario: quién es en la lista, qué firmas y con qué autorización. */
  function filaUsuario(u, vigente) {
    const f = el('div', 'fd-fila');
    const cab = el('div', 'fd-cab');
    cab.appendChild(el('b', 'fe-nombre', u.nombre));
    const estado = el('span', 'fe-estado', vigente
      ? 'Con permiso: ' + (vigente.personas || []).map(nombreDePersona).join(', ') + '.'
      : 'Sin permiso.');
    cab.appendChild(estado);
    f.appendChild(cab);

    const form = el('form', 'fe-form fd-form');
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
      const lbl = el('label', null, ' Firma de ' + nombreDePersona(p) + ' en ' + LINEA_DE[p]); lbl.prepend(chk);
      const inF = el('input'); inF.type = 'date'; inF.max = hoyLocalISO(); inF.value = (a && a.fecha) || hoyLocalISO();
      const inM = el('input'); inM.type = 'text'; inM.maxLength = 200;
      inM.value = (a && a.medio) || (p === miClave ? 'Autorización del custodio' : MEDIO_POR_DEFECTO);
      const lf = el('label', null, 'autorizada el '); lf.appendChild(inF);
      const lm = el('label', null, 'medio '); lm.appendChild(inM);
      linea.append(lbl, lf, lm);
      form.appendChild(linea);
      marcas[p] = { chk, inF, inM };
    }
    const bGuardar = el('button', 'ftm-btn ftm-btn--primary', vigente ? 'Guardar cambios' : 'Dar permiso'); bGuardar.type = 'submit';
    const bRetirar = el('button', 'ftm-btn', 'Retirar permiso'); bRetirar.type = 'button'; bRetirar.hidden = !vigente;
    const msg = el('p', 'fe-msg'); msg.setAttribute('aria-live', 'polite');
    const botones = el('div', 'fd-botones'); botones.append(bGuardar, bRetirar);
    form.append(botones, msg);
    f.appendChild(form);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      msg.textContent = '';
      if (!sel.value) { msg.textContent = 'Elija quién es este usuario en la lista.'; return; }
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
      if (!globalThis.confirm('¿Retirar el permiso de ' + u.nombre + '? Desde su próxima descarga ya no podrá usar estas firmas.')) return;
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
      if (!usuarios.length) { lista.textContent = 'No hay otros usuarios activos.'; return; }
      for (const u of usuarios) lista.appendChild(filaUsuario(u, vigentes.get(u.uid) || null));
    } catch (e) {
      console.warn('[firmas-delegadas] usuarios:', e);
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
      for (const h of ['Fecha', 'Emitió', 'Orden', 'Formato', 'Firmas del directorio', 'Folio']) cab.appendChild(el('th', null, h));
      t.appendChild(cab);
      for (const x of filas) {
        const tr = el('tr');
        const firmas = x.casillas.filter((c) => c.origen === 'equipo').map((c) => nombreDePersona(c.persona) || c.nombre).join(', ');
        for (const v of [x.en ? x.en.toLocaleString('es-CO') : '—', x.emisorNombre, (x.orden.tipo || '') + ' N.º ' + (x.orden.numero || ''),
          x.formato.toUpperCase(), firmas || '—', x.folio]) tr.appendChild(el('td', null, v));
        t.appendChild(tr);
      }
      usos.appendChild(t);
    } catch (e) {
      console.warn('[firmas-delegadas] usos:', e);
      usos.textContent = 'No se pudo consultar (revise la conexión).';
    }
  }

  async function refrescar() { await Promise.all([pintarCopia(), pintarUsuarios(), pintarUsos()]); }
  return { refrescar };
}
