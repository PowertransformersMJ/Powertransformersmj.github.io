// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Placas características · carga del paquete (administración) · TODO-69, ADR-166
// ──────────────────────────────────────────────────────────────
// 1) Elegir los archivos del paquete (se pueden elegir de a uno: se ACUMULAN por número de parte).
// 2) Revisar cada placa contra el parque vivo y lo que ya hay guardado → simulación.
// 3) Guardar SOLO nuevas y cambiadas, con confirmación. 4) Volver a leer y decir cuántas quedaron.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, esperarSesion } from '../cargabilidad-scada/dom.js';
import { listarV2 } from '../../data/transformadores.js';
import { FORMATO_PAQUETE, revisarPlacaPaquete } from '../../domain/placa_caracteristica.js';
import { esAdministrador, estadoActual, guardarPlacas } from '../../data/placas_caracteristicas_admin.js';
import { leerFoto } from '../../data/placas_caracteristicas.js';

const cont = document.getElementById('placasCarga');
const partes = new Map();   // número de parte → {nombre, paquete, de, placas}
let parquePorId = null; let simulacion = null;

function input() {
  const i = el('input', { type: 'file', id: 'placasArchivos', accept: '.json,application/json', multiple: true });
  i.addEventListener('change', async () => {
    for (const f of [...i.files]) {
      try {
        const j = JSON.parse(await f.text());
        if (j.formato !== FORMATO_PAQUETE || !Array.isArray(j.placas)) { avisar('«' + f.name + '» no es un paquete de placas.'); continue; }
        partes.set(j.parte, { nombre: f.name, paquete: j.paquete, de: j.de, placas: j.placas });
      } catch (e) { avisar('No se pudo leer «' + f.name + '».'); }
    }
    i.value = '';
    pintar();
  });
  return i;
}
let aviso = '';
function avisar(t) { aviso = t; }

async function simular() {
  const todas = [...partes.values()].flatMap((p) => p.placas);
  const revisadas = todas.map((p) => revisarPlacaPaquete(p, parquePorId));
  const ok = revisadas.filter((r) => r.ok);
  poner(cont, el('div', { class: 'cs-estado', role: 'status' }, 'Comparando ' + ok.length + ' placas con lo guardado…'));
  const estados = await Promise.all(ok.map((r) => estadoActual(r.id)));
  const clases = { nueva: [], cambia: [], igual: [], error: [] };
  ok.forEach((r, k) => {
    const e = estados[k];
    if (e.error) clases.error.push({ ...r, motivo: 'no se pudo leer lo guardado (' + e.codigo + ')' });
    else if (!e.hay) clases.nueva.push({ ...r, reemplazo: false });
    else if (e.huella === ((r.meta.foto && r.meta.foto.huella) || null) && e.huellaDatos === r.meta.fuente.huella_datos) clases.igual.push(r);
    else clases.cambia.push({ ...r, reemplazo: true });
  });
  simulacion = { clases, rechazadas: revisadas.filter((r) => !r.ok), total: todas.length };
  pintar();
}

function pintar() {
  const lista = [...partes.entries()].sort((a, b) => a[0] - b[0]);
  const de = lista.length ? lista[0][1].de : null; const paquete = lista.length ? lista[0][1].paquete : '';
  const completo = de != null && lista.length === de;
  const bloques = [
    el('h2', {}, '1 · Archivos del paquete'),
    el('p', { class: 'cs-ayuda' }, 'Elija los archivos «placas-parte-NN.json» del paquete (puede elegirlos de a uno; se van sumando).'),
    el('label', { class: 'cs-campo', for: 'placasArchivos' }, 'Archivos del paquete', input()),
    aviso ? el('p', { class: 'cs-error', role: 'alert' }, aviso) : null,
    lista.length ? el('p', { class: 'cs-ayuda' }, 'Paquete «' + paquete + '»: ' + lista.length + ' de ' + de + ' partes (' + lista.reduce((a, [, p]) => a + p.placas.length, 0) + ' placas)'
      + (completo ? '.' : ' — faltan partes.')) : null,
    completo && !simulacion ? el('button', { type: 'button', id: 'placasSimular', class: 'btn btn--primary btn--sm', onclick: simular }, 'Revisar y simular') : null
  ];
  if (simulacion) {
    const c = simulacion.clases; const aGuardar = [...c.nueva, ...c.cambia];
    bloques.push(el('h2', {}, '2 · Simulación (todavía no se ha guardado nada)'),
      el('ul', {}, el('li', {}, el('b', {}, String(c.nueva.length)), ' nuevas'), el('li', {}, el('b', {}, String(c.cambia.length)), ' cambian'),
        el('li', {}, el('b', {}, String(c.igual.length)), ' iguales (no se tocan)'),
        el('li', {}, el('b', {}, String(simulacion.rechazadas.length + c.error.length)), ' rechazadas')),
      simulacion.rechazadas.length || c.error.length ? el('details', {}, el('summary', {}, 'Ver rechazadas'),
        el('ul', {}, [...simulacion.rechazadas, ...c.error].map((r) => el('li', {}, (r.matricula || r.id) + ': ' + r.motivo)))) : null,
      aGuardar.length ? el('button', { type: 'button', id: 'placasGuardar', class: 'btn btn--primary btn--sm', onclick: () => guardar(aGuardar, paquete) },
        'Guardar ' + aGuardar.length + ' placas en la plataforma') : el('p', { class: 'cs-ayuda' }, 'No hay nada que guardar.'));
  }
  poner(cont, ...bloques);
}

async function guardar(aGuardar, paquete) {
  if (!window.confirm('Se guardarán ' + aGuardar.length + ' placas (foto y lectura) en la plataforma. Ningún dato del inventario cambia. ¿Continuar?')) return;
  const estado = el('p', { class: 'cs-ayuda', role: 'status', id: 'placasProgreso' }, 'Guardando…');
  poner(cont, el('h2', {}, '3 · Guardando'), estado);
  let r;
  // Identificador único de ESTA carga (la regla exige uno nuevo por cambio): paquete + fecha y hora.
  const idCarga = (String(paquete).replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) + '-' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12)).slice(0, 40);
  try { r = await guardarPlacas(aGuardar, { paquete: idCarga, alAvanzar: (h, t) => { estado.textContent = 'Guardadas ' + h + ' de ' + t + '…'; } }); }
  catch (e) { poner(cont, el('p', { class: 'cs-error', role: 'alert' }, (e && e.message) || 'No se pudo guardar.')); return; }
  // Verificación por BYTES: se vuelve a leer cada foto guardada, se unen sus partes y se recalcula su huella.
  const verificadas = [];
  for (const p of aGuardar.filter((x) => r.escritas.includes(x.id))) {
    estado.textContent = 'Verificando ' + (verificadas.length + 1) + ' de ' + r.escritas.length + '…';
    const e = await estadoActual(p.id);
    if (!e.hay || e.huellaDatos !== p.meta.fuente.huella_datos) continue;
    if (!p.meta.foto) { verificadas.push(p.id); continue; }
    const f = await leerFoto(p.id, { ...p.meta.foto });
    if (!f.error) verificadas.push(p.id);
  }
  const bien = verificadas.length;
  poner(cont, el('h2', {}, '4 · Resultado'),
    el('p', { class: 'cs-num', id: 'placasResultado' }, bien + ' de ' + aGuardar.length + ' placas guardadas y verificadas (foto leída de vuelta y huella recalculada). Carga «' + idCarga + '».'),
    r.fallos.length ? el('details', { open: true }, el('summary', {}, r.fallos.length + ' no se guardaron'), el('ul', {}, r.fallos.map((f) => el('li', {}, f.id + ': ' + f.motivo)))) : null,
    el('p', { class: 'cs-ayuda' }, 'Véalas en Cargabilidad SCADA → abrir un transformador → «Placa característica».'));
}

(async function arrancar() {
  await esperarSesion();
  if (!esAdministrador()) { poner(cont, el('p', { class: 'cs-error', role: 'alert' }, 'Solo un administrador puede cargar las placas.')); return; }
  try {
    const parque = await listarV2({ limite: 500 });
    parquePorId = new Map(parque.map((t) => [t.id, t]));
  } catch (e) { poner(cont, el('p', { class: 'cs-error', role: 'alert' }, 'No se pudo leer el parque de transformadores.')); return; }
  pintar();
})();
