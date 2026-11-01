// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Panel «Actividad del visitante» (admin) · `99 §199`
// ──────────────────────────────────────────────────────────────
// Lee `actividad_visitante/{uid}/eventos` (solo el admin puede) SOLO del periodo elegido (el servidor
// filtra por fecha) y lo resume con domain/rastro_visitante.js: inicios de sesión, visitas, equipos
// más consultados, uso por día, intentos y la línea de tiempo; descarga en CSV y borrado del rastro.
// Lista a los visitantes primero y después a las demás cuentas (alguien que dejó de ser visitante
// conserva su rastro). Lo que se pinta lo escribió el navegador del visitante: TODO va como texto.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { getDbSafe } from '../firebase-init.js';
import { resumirActividad, describirEvento, filasCSV, fechaDe } from '../domain/rastro_visitante.js';
import { esRolVisitante } from '../domain/acceso_por_rol.js';
import { leerEventos, borrarRastro } from '../data/actividad_visitante.js';
import { descargarCSV } from '../ui/cargabilidad-scada/dom.js';

const FS = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const TOPE_VISTA = 2000;      // acciones leídas por periodo
const TOPE_TODO = 5000;       // «Todo»: techo de una lectura manual (limites_lectura.js)
const TOPE_LINEA = 500;       // filas visibles en la línea de tiempo
const $ = (id) => document.getElementById(id);
const NOMBRE_PAGINA = { 'cargabilidad-scada': 'Cargabilidad SCADA', 'mapa-v2': 'Mapa' };

let eventos = [];
let cuentas = [];
let turno = 0;   // una respuesta vieja (otro visitante u otro periodo) no pisa la vigente

/** Hora de Colombia (UTC−5) en texto. */
const co = (f, conHora = true) => f ? new Date(f.getTime() - 5 * 3600000).toISOString().replace('T', ' ').slice(0, conHora ? 16 : 10) : '—';

function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto == null || texto === '' ? '—' : String(texto);
  if (clase) td.className = clase;
  return td;
}
function fila(...celdas) { const tr = document.createElement('tr'); celdas.forEach((c) => tr.appendChild(c)); return tr; }
function llenar(id, filas, vacio) {
  const tb = $(id).querySelector('tbody');
  tb.replaceChildren(...(filas.length ? filas : [fila(Object.assign(celda(vacio, 'av-vacio'), { colSpan: $(id).querySelectorAll('thead th').length }))]));
}
function aviso(texto, clase = '') {
  const m = $('avMsg');
  m.hidden = !texto; m.textContent = texto || ''; m.className = 'info-msg' + (clase ? ' ' + clase : '');
}

function esperarSesion(ms = 30000) {
  if (window.__sgmSession) return Promise.resolve(window.__sgmSession);
  return new Promise((res) => {
    const t = setTimeout(() => res(window.__sgmSession || null), ms);
    window.addEventListener('sgm:session-ready', () => { clearTimeout(t); res(window.__sgmSession); }, { once: true });
  });
}

/** Todas las cuentas (son pocas): los visitantes primero, con el mismo criterio de rol que las reglas. */
async function cargarCuentas() {
  const { collection, query, getDocs, limit } = await import(FS);
  const snap = await getDocs(query(collection(getDbSafe(), 'usuarios'), limit(200)));
  const nombre = (c) => String(c.nombre || c.email || c.uid);
  cuentas = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
    .map((c) => ({ ...c, visitante: esRolVisitante(c.rol) }))
    .sort((a, b) => (b.visitante - a.visitante) || nombre(a).localeCompare(nombre(b), 'es'));
  const sel = $('fVisitante');
  const grupo = (titulo, lista) => {
    const g = document.createElement('optgroup');
    g.label = titulo;
    lista.forEach((c) => g.appendChild(Object.assign(document.createElement('option'), {
      value: c.uid, textContent: nombre(c) + (c.activo === false ? ' (desactivada)' : '') })));
    return g;
  };
  const vis = cuentas.filter((c) => c.visitante);
  const otras = cuentas.filter((c) => !c.visitante);
  sel.replaceChildren(...[
    vis.length ? grupo('Visitantes', vis) : Object.assign(document.createElement('option'), { value: '', textContent: 'No hay cuentas con rol Visitante' }),
    otras.length ? grupo('Otras cuentas (por si antes fueron visitantes)', otras) : null,
  ].filter(Boolean));
}

async function cargarEventos() {
  const uid = $('fVisitante').value;
  const dias = Number($('fRango').value);
  const mio = ++turno;
  eventos = [];
  $('btnCsv').disabled = true; $('btnBorrar').disabled = true;
  if (!uid) { pintar(); return; }
  aviso('Leyendo la actividad…');
  const r = await leerEventos(uid, { desdeMs: dias ? Date.now() - dias * 86400000 : 0, tope: dias ? TOPE_VISTA : TOPE_TODO });
  if (mio !== turno) return;   // ya se pidió otra cosa
  eventos = r.eventos;
  aviso(r.truncado ? `Se muestran las ${eventos.length} acciones más recientes del periodo.` : '');
  $('btnCsv').disabled = !eventos.length; $('btnBorrar').disabled = !eventos.length;
  pintar();
}

function pintar() {
  const r = resumirActividad(eventos);
  $('kIngresos').textContent = String(r.totalIngresos);
  $('kVisitas').textContent = String(r.totalVisitas);
  $('kUltimo').textContent = r.ultimo ? co(r.ultimo) : '—';
  $('kEquipos').textContent = String(r.equiposMasVistos.length);
  $('kIntentos').textContent = String(r.intentos);
  $('kEventos').textContent = String(r.totalEventos);

  llenar('tablaIngresos', r.visitas.map((v) => fila(celda(v.dia), celda(co(v.inicio).slice(11)), celda(co(v.fin).slice(11)),
    celda(v.duracionMin < 1 ? 'menos de 1 min' : v.duracionMin + ' min'), celda(v.paginas.join(' · ')),
    celda(v.equipos.join(', '), 'av-equipos'), celda(v.disp ? [v.disp.nav, v.disp.so, v.disp.tipo].filter(Boolean).join(' · ') : ''))),
  'Sin visitas en este periodo.');
  llenar('tablaEquipos', r.equiposMasVistos.map((q) => fila(celda(q.mat, 'av-mono'), celda(q.veces, 'av-n'), celda(co(q.ultimo)))),
    'Todavía no ha consultado ningún equipo.');
  llenar('tablaDias', r.porDia.map((d) => fila(celda(d.dia), celda(d.visitas, 'av-n'), celda(d.minutos, 'av-n'))), '—');

  const recientes = eventos.map((e) => ({ ...e, fecha: fechaDe(e.en) })).filter((e) => e.fecha).sort((a, b) => b.fecha - a.fecha);
  llenar('tablaLinea', recientes.slice(0, TOPE_LINEA).map((e) => fila(celda(co(e.fecha)), celda(NOMBRE_PAGINA[e.pagina] || e.pagina),
    celda(describirEvento(e)))), 'Sin actividad en este periodo.');
  $('notaLinea').textContent = recientes.length > TOPE_LINEA
    ? `Se ven las ${TOPE_LINEA} más recientes de ${recientes.length}; la descarga trae todas las del periodo.` : '';
}

async function borrar() {
  const uid = $('fVisitante').value;
  const c = cuentas.find((x) => x.uid === uid);
  if (!uid || !confirm(`¿Borrar TODO el rastro de actividad de ${c ? (c.nombre || c.email) : uid}? No se puede deshacer.`)) return;
  aviso('Borrando…');
  const s = window.__sgmSession;
  const total = await borrarRastro(uid, { actorUid: s && s.user && s.user.uid });
  aviso(`Se borraron ${total} acciones (queda anotado en Auditoría).`, 'ok');
  await cargarEventos();
}

const fallo = (e) => { console.warn('[actividad-visitante]', e); aviso('No se pudo leer la actividad (revise la conexión).', 'err'); };

async function arrancar() {
  const s = await esperarSesion();
  if (!s) { aviso('No se pudo verificar la sesión.', 'err'); return; }
  try { await cargarCuentas(); await cargarEventos(); } catch (e) { fallo(e); }
  $('fVisitante').addEventListener('change', () => cargarEventos().catch(fallo));
  $('fRango').addEventListener('change', () => cargarEventos().catch(fallo));
  $('btnRecargar').addEventListener('click', () => cargarEventos().catch(fallo));
  $('btnCsv').addEventListener('click', () => {
    const c = cuentas.find((x) => x.uid === $('fVisitante').value);
    const nombre = String((c && (c.nombre || c.email)) || 'visitante').replace(/[^a-z0-9]+/gi, '_');
    descargarCSV(`actividad_${nombre}.csv`, ['Fecha_hora_Colombia', 'Pagina', 'Que_hizo', 'Inicio_de_sesion', 'Navegador'], filasCSV(eventos));
  });
  $('btnBorrar').addEventListener('click', () => borrar().catch((e) => { console.warn(e); aviso('No se pudo borrar.', 'err'); }));
}

arrancar();
