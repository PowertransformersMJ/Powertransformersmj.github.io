// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Datos SCADA · pestaña «Cargar mes» · `99 §122`
// ──────────────────────────────────────────────────────────────
// 1) Se arrastra (o se elige) la carpeta del mes. Un worker la lee EN ESTE COMPUTADOR:
//    nada se sube como archivo.
// 2) Veredicto en lenguaje llano + meses encontrados (el principal marcado; un día suelto
//    traspapelado o un año distinto NO se marcan).
// 3) «Simular»: se leen las series ya guardadas de esos meses, se funden (completar: lo
//    guardado manda; reemplazar: lo nuevo sustituye las horas que trae; nada se borra), se
//    limpian y se arma el plan de escritura. Hasta aquí no se ha escrito nada.
// 4) «Guardar»: registro 'iniciada' → series en lotes → resúmenes → catálogo (el punto de
//    compromiso: la página no ve un mes a medio cargar) → registro cerrado.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from '../cargabilidad-scada/dom.js';
import { informeSimulacion, planLotes, tamanoDoc } from '../../domain/scada_carga_importacion.js';
import { analizarClaveHomologada, claveEfectiva, objetivoImportacion } from '../../domain/scada_carga_homologacion.js';
import { claveId } from '../../domain/scada_carga_csv.js';
import { PAQUETE, analizarNombreParte, juntarPartes, leerContenedor, estacionesFaltantes } from '../../domain/scada_carga_paquete.js';
import { ESCRITURA, CODIGO, MOTIVO } from '../../domain/scada_carga_config.js';
import { nombreMes } from '../../domain/scada_carga_fecha.js';
import { leerSeriesPunto, leerCatalogo, olvidarCache } from '../../data/scada_carga.js';
import { abrirCarga, cerrarCarga, escribirSeries, escribirResumen, escribirCatalogo, cargaIdDelCatalogo } from '../../data/scada_carga_admin.js';

const MAX_ARCHIVOS = 20000;
const LECTURAS_SIMULTANEAS = 6;

/** Recorre una entrada arrastrada (carpeta o archivo) y junta {file, ruta, nombre}. */
async function leerEntrada(entry, ruta, out) {
  if (out.length > MAX_ARCHIVOS) return;
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, ruta: ruta + file.name, nombre: file.name });
  } else if (entry.isDirectory) {
    const lector = entry.createReader();
    for (;;) {
      const lote = await new Promise((res, rej) => lector.readEntries(res, rej));
      if (!lote.length) break;
      for (const e of lote) await leerEntrada(e, ruta + entry.name + '/', out);
    }
  }
}

/** Huella SHA-256 (hex) de unos bytes. */
async function huella(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Descomprime gzip con lo que trae el navegador (sin librerías). */
async function descomprimir(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Ejecuta tareas con un máximo de N a la vez. */
async function enParalelo(tareas, n) {
  const out = new Array(tareas.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => {
    while (i < tareas.length) { const k = i++; out[k] = await tareas[k](); }
  }));
  return out;
}

export function montarCargaMes(cont, { alTerminar }) {
  let est = null;
  let worker = null;
  let fase = 'inicio';            // inicio | leyendo | analizado | simulando | plan | escribiendo | fin
  let carpeta = '';
  let analisis = null;            // mensaje 'analizado' + informe
  let mesesElegidos = new Set();
  let modo = 'completar';
  let plan = null;                // {docs, lotes, resumen, catalogo, conteos, conflictos, sinCambios, resumenesFundidos, catalogoFundido}
  let progreso = { hechos: 0, total: 0, texto: '' };
  let mensaje = '';
  let resultado = null;
  // Paquete preparado: partes recibidas por huella → {carpeta, n, partes: Map(i → bytes)}.
  const paquetes = new Map();
  let estadoPaquete = '';

  const salirConCuidado = (ev) => { ev.preventDefault(); ev.returnValue = ''; };

  function nuevoWorker() {
    if (worker) worker.terminate();
    worker = new Worker(new URL('../../workers/scada_carga_importar.worker.js', import.meta.url), { type: 'module' });
    worker.onerror = (e) => { mensaje = 'El lector de archivos falló: ' + ((e && e.message) || 'error'); fase = 'inicio'; dibujar(); };
    return worker;
  }

  function filasHomologacion() { return (est.homologacion && est.homologacion.filas) || {}; }
  /** Filas que se calculan (sin retiradas ni excluidas): las que lee el worker y las que exige la guarda del paquete. */
  function filasVigentes() {
    return Object.fromEntries(Object.entries(filasHomologacion()).filter(([, f]) => !f.retirada && !(f.decision && f.decision.tipo === 'no_usar')));
  }
  function clavesHomologadas() {
    const s = new Set();
    for (const f of Object.values(filasHomologacion())) {
      if (f.retirada || (f.decision && f.decision.tipo === 'no_usar')) continue;
      const k = analizarClaveHomologada(claveEfectiva(f));
      if (k) s.add(claveId(k.est, k.elem));
    }
    return [...s];
  }

  // ── 1) Leer la carpeta ─────────────────────────────────────────────────────────
  function analizar(archivos, nombreCarpeta) {
    if (!archivos.length) { mensaje = 'La carpeta no trae archivos.'; dibujar(); return; }
    if (archivos.length > MAX_ARCHIVOS) { mensaje = 'Son demasiados archivos (más de ' + MAX_ARCHIVOS + '): cargue un mes a la vez.'; dibujar(); return; }
    // Una subcarpeta que empieza por «_» no es de un mes (en la carpeta madre hay datos de otro proyecto).
    if (archivos.some((a) => String(a.ruta || '').split('/').slice(0, -1).some((p) => p.startsWith('_')))) {
      mensaje = 'La carpeta trae subcarpetas que empiezan por «_», que no son de un mes: arrastre solo la carpeta del mes (por ejemplo «Agosto»).';
      dibujar(); return;
    }
    carpeta = nombreCarpeta; analisis = null; plan = null; resultado = null; mensaje = '';
    paquetes.clear(); estadoPaquete = '';
    fase = 'leyendo'; progreso = { hechos: 0, total: archivos.length, texto: 'Leyendo archivos…' };
    dibujar();
    const w = nuevoWorker();
    w.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.tipo === 'progreso') { progreso.hechos = m.hechos; progreso.total = m.total; actualizarProgreso(); }
      else if (m.tipo === 'cancelado') { fase = 'inicio'; mensaje = 'Lectura cancelada.'; dibujar(); }
      else if (m.tipo === 'error') { fase = 'inicio'; mensaje = 'No se pudo leer la carpeta: ' + m.mensaje; dibujar(); }
      else if (m.tipo === 'analizado') {
        // Varios meses completos a la vez = se arrastró la carpeta madre: se carga un mes por vez.
        const completos = m.meses.filter((x) => !x.nota && x.dias > 3);
        if (completos.length > 1) {
          fase = 'inicio';
          mensaje = 'La carpeta trae varios meses (' + completos.map((x) => nombreMes(x.mes)).join(', ') + '): cargue un mes a la vez, arrastrando solo la carpeta de ese mes.';
          dibujar(); return;
        }
        const claves = clavesHomologadas();
        const informe = informeSimulacion({
          acc: { archivos: m.archivos, discrepancias: m.discrepancias }, meses: m.meses, clavesHomologadas: claves,
          puntosHallados: new Set(m.puntos.map((p) => p.cid)), conflictos: 0, homologacionVigente: !!est.homologacion
        });
        analisis = { ...m, informe };
        mesesElegidos = new Set(m.meses.filter((x) => x.marcado).map((x) => x.mes));
        fase = 'analizado';
        dibujar();
      }
    };
    w.postMessage({ tipo: 'analizar', archivos, filas: filasVigentes() });
  }

  // ── 1b) Paquete preparado: juntar partes, comprobar y entregar al MISMO lector ──────
  async function recibirPartes(files) {
    mensaje = '';
    const ajenos = []; const tocados = new Set();
    for (const f of files) {
      const d = analizarNombreParte(f.name);
      if (!d) { ajenos.push(f.name); continue; }
      tocados.add(d.sha);
      if (!paquetes.has(d.sha)) paquetes.set(d.sha, { carpeta: d.carpeta, n: d.n, partes: new Map() });
      const p = paquetes.get(d.sha);
      if (p.n !== d.n) { ajenos.push(f.name); continue; }
      p.partes.set(d.i, new Uint8Array(await f.arrayBuffer()));
    }
    if (ajenos.length) mensaje = 'No son partes de un paquete preparado: ' + ajenos.slice(0, 3).join(', ') + (ajenos.length > 3 ? '…' : '') + '.';
    // Solo cuenta un paquete que se completó con ESTA subida, y uno a la vez.
    const completos = [...tocados].map((sha) => [sha, paquetes.get(sha)])
      .filter(([sha, p]) => p && juntarPartes([...p.partes.entries()].map(([i, bytes]) => ({ i, n: p.n, sha, bytes }))).completo);
    if (completos.length > 1) {
      for (const [sha] of completos) paquetes.delete(sha);
      estadoPaquete = '';
      mensaje = 'Se completaron ' + completos.length + ' paquetes a la vez (' + completos.map(([, p]) => p.carpeta).join(', ') + '): suba las partes de un mes a la vez.';
      dibujar(); return;
    }
    for (const [sha, p] of completos) {
      const j = juntarPartes([...p.partes.entries()].map(([i, bytes]) => ({ i, n: p.n, sha, bytes })));
      paquetes.delete(sha);
      estadoPaquete = 'Comprobando el paquete «' + p.carpeta + '»…';
      dibujar();
      try {
        if (await huella(j.bytes) !== sha) throw new Error('La huella del paquete «' + p.carpeta + '» no coincide: una parte llegó dañada. Súbalas otra vez.');
        let contenedor;
        try { contenedor = await descomprimir(j.bytes); } catch (_) { throw new Error('No se pudo descomprimir el paquete «' + p.carpeta + '»: está dañado.'); }
        const { manifiesto, archivos } = leerContenedor(contenedor);
        // El paquete solo trae las estaciones de la homologación con que se preparó: si la vigente pide
        // otra, faltarían sus datos en silencio. Se detiene aquí (guardia de omitidos, W-13).
        // Las mismas filas que lee el worker (filasVigentes): carpeta y paquete leen lo mismo.
        const faltan = estacionesFaltantes(objetivoImportacion(filasVigentes()).estaciones, manifiesto.estaciones);
        if (faltan.length) {
          throw new Error('El paquete «' + manifiesto.carpeta + '» se preparó con otra homologación: no trae ' + faltan.length + (faltan.length === 1 ? ' estación' : ' estaciones') +
            ' que la vigente necesita (' + faltan.slice(0, 6).join(', ') + (faltan.length > 6 ? '…' : '') + '). Hay que preparar uno nuevo que las incluya.');
        }
        estadoPaquete = '';
        const lista = archivos.map((a) => ({ file: new File([a.contenido], a.nombre), ruta: a.ruta, nombre: a.nombre, tamano: a.tamano }));
        analizar(lista, manifiesto.carpeta + ' (paquete preparado)');
      } catch (e) {
        estadoPaquete = '';
        mensaje = (e && e.message) || 'No se pudo leer el paquete.';
        dibujar();
      }
      return;
    }
    const pendientes = [...paquetes.values()].map((p) => '«' + p.carpeta + '»: ' + p.partes.size + ' de ' + p.n + (p.n === 1 ? ' parte' : ' partes'));
    estadoPaquete = pendientes.length ? 'Partes recibidas — ' + pendientes.join(' · ') + '. Faltan las demás.' : '';
    dibujar();
  }

  // ── 3) Simular: leer lo guardado, fundir, limpiar, armar el plan ──────────────────
  async function simular() {
    const meses = [...mesesElegidos].sort();
    if (!meses.length) { mensaje = 'Marque al menos un mes.'; dibujar(); return; }
    fase = 'simulando'; mensaje = ''; progreso = { hechos: 0, total: 0, texto: 'Leyendo lo ya guardado de esos meses…' };
    dibujar();
    try {
      olvidarCache();   // lo guardado se lee fresco: otra pestaña pudo cargar algo
      const cat = await leerCatalogo();
      if (cat.estado === 'fallo') throw new Error('No se pudo leer qué hay guardado (revise la conexión).');
      const catalogo = cat.estado === 'ok' ? cat.datos : null;
      // TODOS los pares punto-mes, estén o no en el catálogo: una carga interrumpida deja series
      // escritas que el catálogo aún no nombra, y no se pueden pisar sin fundirlas (revisión de §122).
      const pares = [];
      for (const p of analisis.puntos) for (const mes of meses) pares.push([p.cid, mes]);
      progreso.total = pares.length;
      actualizarProgreso();
      const guardados = {};
      await enParalelo(pares.map(([cid, mes]) => async () => {
        const r = await leerSeriesPunto(cid, [mes]);
        const x = r.porMes[mes];
        if (x.estado === 'fallo') throw new Error('No se pudo leer lo guardado de un punto (revise la conexión): no se puede fundir sin verlo.');
        if (x.estado === 'ok') guardados[cid + '|' + mes] = x.serie;
        progreso.hechos++; actualizarProgreso();
      }), LECTURAS_SIMULTANEAS);
      progreso.texto = 'Fundiendo y limpiando…'; actualizarProgreso();
      const procesado = await new Promise((res, rej) => {
        worker.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.tipo === 'procesado') res(m);
          else if (m.tipo === 'error') rej(new Error(m.mensaje));
        };
        worker.postMessage({ tipo: 'procesar', meses, guardados, modo });
      });
      const tamanos = procesado.docs.map(tamanoDoc);
      const grande = Math.max(0, ...tamanos);
      // El resumen y el catálogo se funden al GUARDAR, en una transacción con lo guardado en ese
      // instante. `cargaIdBase` detecta si otra carga terminó entre la simulación y el guardado.
      plan = {
        ...procesado, meses, tamanoTotal: tamanos.reduce((a, b) => a + b, 0), tamanoMax: grande,
        lotes: planLotes(procesado.docs), cargaIdBase: catalogo ? catalogo.cargaId || null : null, propias: []
      };
      fase = 'plan';
    } catch (e) {
      fase = 'analizado';
      mensaje = (e && e.message) || 'No se pudo simular.';
    }
    dibujar();
  }

  // ── 4) Guardar ─────────────────────────────────────────────────────────────────
  async function guardar() {
    if (!plan || plan.tamanoMax > ESCRITURA.docMaxBytes) return;
    fase = 'escribiendo'; mensaje = '';
    progreso = { hechos: 0, total: plan.lotes.length, texto: 'Guardando series…' };
    dibujar();
    window.addEventListener('beforeunload', salirConCuidado);
    const t0 = performance.now();
    let id = null; let escritos = 0; let resumenes = 0; let catalogoEscrito = false;
    try {
      const vigente = await cargaIdDelCatalogo();
      if (vigente !== plan.cargaIdBase && !plan.propias.includes(vigente)) {
        const err = new Error('Otra carga terminó mientras usted simulaba: vuelva a simular para fundir lo que ella guardó');
        err.resimular = true;
        throw err;
      }
      id = await abrirCarga({
        modo, meses: plan.meses, carpeta,
        plan: { series: plan.docs.length, lotes: plan.lotes.length, sinCambios: plan.sinCambios, bytes: plan.tamanoTotal },
        simulacion: { veredicto: analisis.informe.veredicto, avisos: analisis.informe.avisos.length, conflictos: plan.conflictos, claves: analisis.informe.claves, halladas: analisis.informe.hallados }
      });
      escritos = await escribirSeries(plan.lotes, id, { alAvanzar: (i, n) => { progreso.hechos = i; progreso.total = n; actualizarProgreso(); } });
      progreso.texto = 'Guardando resúmenes y catálogo…'; actualizarProgreso();
      plan.propias.push(id);
      for (const mes of plan.meses) { await escribirResumen(mes, plan.resumen[mes] || {}, id); resumenes++; }
      await escribirCatalogo(plan.catalogo, id);
      catalogoEscrito = true;
      await cerrarCarga(id, { estado: 'completa', escrituras: { series: escritos, resumenes, catalogo: 1 }, duracion_ms: Math.round(performance.now() - t0) });
      resultado = { ok: true, escritos, resumenes };
      fase = 'fin';
    } catch (e) {
      console.warn('[scada-datos] carga', e);
      if (e && e.escritos != null) escritos = e.escritos;
      const texto = (e && e.message) || 'error';
      if (id) {
        try {
          await cerrarCarga(id, { estado: escritos || resumenes || catalogoEscrito ? 'parcial' : 'fallida', escrituras: { series: escritos, resumenes, catalogo: catalogoEscrito ? 1 : 0 }, duracion_ms: Math.round(performance.now() - t0), error: texto });
        } catch (_) { /* el registro queda 'iniciada' y el Registro lo muestra como interrumpida */ }
      }
      resultado = { ok: false, escritos, resumenes, texto, sinRegistro: !id, catalogoEscrito, resimular: !!(e && e.resimular) };
      fase = 'fin';
    } finally {
      window.removeEventListener('beforeunload', salirConCuidado);
      olvidarCache();
    }
    dibujar();
    if (resultado && resultado.ok) await alTerminar();
  }

  // ── Pintura ────────────────────────────────────────────────────────────────────
  let barra = null; let barraTexto = null;
  function actualizarProgreso() {
    if (!barra) return;
    if (progreso.total) { barra.max = progreso.total; barra.value = progreso.hechos; } else barra.removeAttribute('value');
    barraTexto.textContent = progreso.texto + (progreso.total ? ' ' + progreso.hechos + ' de ' + progreso.total : '');
  }
  function bloqueProgreso(conCancelar) {
    barra = el('progress', { 'aria-label': 'Avance' });
    barraTexto = el('p', { class: 'cs-ayuda', role: 'status', 'aria-live': 'polite' });
    actualizarProgreso();
    return el('div', { class: 'cs-panel' }, barraTexto, barra,
      conCancelar ? el('div', { class: 'cs-acciones' }, el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => worker && worker.postMessage({ tipo: 'cancelar' }) }, 'Cancelar')) : null,
      fase === 'escribiendo' ? el('p', { class: 'cs-ayuda' }, 'No cierre esta página hasta que termine.') : null);
  }

  function zonaArrastre() {
    const input = el('input', { type: 'file', id: 'carpetaMes', multiple: true, webkitdirectory: true, hidden: true });
    input.addEventListener('change', () => {
      const files = [...(input.files || [])];
      if (files.length && files.every((x) => analizarNombreParte(x.name))) { input.value = ''; recibirPartes(files); return; }
      const lista = files.map((file) => ({ file, ruta: file.webkitRelativePath || file.name, nombre: file.name }));
      const raiz = lista.length && String(lista[0].ruta).includes('/') ? String(lista[0].ruta).split('/')[0] : lista.length + ' archivos';
      input.value = '';
      analizar(lista, raiz);
    });
    const zona = el('div', { class: 'cs-arrastre', tabindex: '0', role: 'button', 'aria-label': 'Arrastre aquí la carpeta del mes o pulse para elegirla' },
      el('p', {}, el('b', {}, 'Arrastre aquí la carpeta del mes')),
      el('p', { class: 'cs-ayuda' }, 'La carpeta con las subcarpetas de cada día. Los archivos se leen en este computador; a la base solo va el resultado.'),
      el('button', { type: 'button', class: 'btn btn--glass', onclick: (ev) => { ev.stopPropagation(); input.click(); } }, 'Elegir carpeta'));
    zona.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); } });
    zona.addEventListener('dragover', (ev) => { ev.preventDefault(); zona.classList.add('is-sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('is-sobre'));
    zona.addEventListener('drop', async (ev) => {
      ev.preventDefault(); zona.classList.remove('is-sobre');
      const items = [...(ev.dataTransfer.items || [])].map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
      if (!items.length) { mensaje = 'Este navegador no permite arrastrar carpetas: use «Elegir carpeta».'; dibujar(); return; }
      const lista = [];
      try { for (const e of items) await leerEntrada(e, '', lista); }
      catch (e) { mensaje = 'No se pudo recorrer la carpeta.'; dibujar(); return; }
      // Si lo que se soltó son partes de un paquete preparado, van por su camino.
      if (lista.length && lista.every((x) => analizarNombreParte(x.nombre))) { recibirPartes(lista.map((x) => x.file)); return; }
      analizar(lista, items.length === 1 ? items[0].name : items.length + ' elementos');
    });
    return el('div', {}, el('div', { class: 'cs-panel' }, zona, input), bloquePaquete());
  }

  function bloquePaquete() {
    const input = el('input', { type: 'file', id: 'paqueteMes', multiple: true, accept: PAQUETE.extension });
    input.addEventListener('change', async () => {
      const files = [...(input.files || [])];
      input.value = '';
      if (files.length) await recibirPartes(files);
    });
    return el('div', { class: 'cs-panel' },
      el('h3', {}, 'Paquete preparado'),
      el('p', { class: 'cs-ayuda' }, 'Si el mes viene preparado en partes (' + PAQUETE.extension + '), súbalas aquí, juntas o de a una: se juntan, se comprueba su huella y siguen el mismo camino que la carpeta (veredicto, simulación y guardado).'),
      el('label', { class: 'cs-campo', for: 'paqueteMes' }, 'Partes del paquete', input),
      estadoPaquete ? el('p', { class: 'cs-ayuda', role: 'status', 'aria-live': 'polite' }, estadoPaquete) : null);
  }

  function bloqueVeredicto() {
    const inf = analisis.informe;
    const a = analisis.archivos;
    const clase = { bloqueado: 'cs-veredicto--bloqueado', listo_con_avisos: 'cs-veredicto--avisos', listo: 'cs-veredicto--listo' }[inf.veredicto];
    const titulo = { bloqueado: 'No se puede guardar', listo_con_avisos: 'Se puede guardar, con avisos', listo: 'Todo en orden' }[inf.veredicto];
    const mesesUI = analisis.meses.map((m) => {
      const chk = el('input', { type: 'checkbox', id: 'mes-' + m.mes, checked: mesesElegidos.has(m.mes), disabled: fase === 'simulando' });
      chk.addEventListener('change', () => { if (chk.checked) mesesElegidos.add(m.mes); else mesesElegidos.delete(m.mes); plan = null; if (fase === 'plan') { fase = 'analizado'; dibujar(); } });
      return el('label', { class: 'cs-check', for: 'mes-' + m.mes }, chk, ' ' + nombreMes(m.mes) + ' — ' + m.dias + ' de ' + Math.round(m.diasMes) + ' días' + (m.nota ? ' (' + m.nota + ')' : ''));
    });
    const selModo = el('select', { id: 'modoCarga', disabled: fase === 'simulando' },
      el('option', { value: 'completar', selected: modo === 'completar' }, 'Completar: lo ya guardado se conserva; solo se llenan horas vacías'),
      el('option', { value: 'reemplazar', selected: modo === 'reemplazar' }, 'Reemplazar: lo nuevo sustituye las horas que trae (nada se borra)'));
    selModo.addEventListener('change', () => { modo = selModo.value; plan = null; if (fase === 'plan') { fase = 'analizado'; dibujar(); } });
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-veredicto ' + clase, role: 'status' }, el('b', {}, titulo),
        el('span', { class: 'cs-sub' }, 'Carpeta «' + carpeta + '»: ' + a.average + ' archivos de promedios y ' + a.quality + ' de calidad leídos; ' + inf.hallados + ' de ' + inf.claves + ' claves homologadas encontradas.')),
      inf.bloqueos.length ? el('ul', { class: 'cs-avisos cs-error' }, inf.bloqueos.map((t) => el('li', {}, t))) : null,
      inf.avisos.length || analisis.conflictos ? el('ul', { class: 'cs-avisos' }, inf.avisos.map((t) => el('li', {}, t)),
        analisis.conflictos ? el('li', {}, analisis.conflictos + (analisis.conflictos === 1 ? ' hora aparece' : ' horas aparecen') + ' dos veces en la carpeta con valores distintos: se usó el del primer archivo leído.') : null) : null,
      el('details', {}, el('summary', {}, 'Detalle de los archivos'),
        el('ul', { class: 'cs-avisos' },
          el('li', {}, ((a.max || 0) + (a.min || 0) + (a.current || 0)) + ' archivos de máximo, mínimo o instantáneo leídos (solo para ver las curvas; no entran en la cifra)' + (a.extrasInvalidos ? ' · ' + a.extrasInvalidos + ' con el encabezado dañado' : '')),
          el('li', {}, (a.noCsv || 0) + ' archivos que no son CSV (no se usan)'),
          el('li', {}, (a.vacios || 0) + ' archivos vacíos'),
          el('li', {}, (a.encabezadoInvalido || 0) + ' con el encabezado de fechas dañado'),
          analisis.invalidos.length ? el('li', {}, 'Ejemplos: ' + analisis.invalidos.slice(0, 5).join(' · ')) : null)),
      inf.veredicto === 'bloqueado' ? null : el('fieldset', { class: 'cs-rango' }, el('legend', {}, 'Meses a guardar'), mesesUI),
      inf.veredicto === 'bloqueado' ? null : el('label', { class: 'cs-campo', for: 'modoCarga' }, 'Si un mes ya tiene datos guardados', selModo),
      el('div', { class: 'cs-acciones' },
        inf.veredicto === 'bloqueado' ? null : el('button', { type: 'button', class: 'btn btn--primary', disabled: fase !== 'analizado', onclick: simular }, 'Simular'),
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { fase = 'inicio'; analisis = null; plan = null; dibujar(); } }, 'Elegir otra carpeta')));
  }

  function bloquePlan() {
    const c = plan.conteos || {};
    const total = Object.values(c).reduce((x, y) => x + y, 0);
    const validas = (c[CODIGO.VALIDO] || 0) + (c[CODIGO.RETENIDO] || 0);
    const leidas = total - (c[CODIGO.SIN_ARCHIVO] || 0);   // las horas de días sin archivo no son «descartadas»
    const grande = plan.tamanoMax > ESCRITURA.docMaxBytes;
    const nuevos = Object.keys(plan.catalogo.puntos).length;
    const filasCod = Object.entries(c).filter(([k]) => +k !== CODIGO.VALIDO).sort((x, y) => y[1] - x[1])
      .map(([k, v]) => el('tr', {}, el('td', {}, MOTIVO[k] || ('código ' + k)), el('td', { class: 'cs-num' }, v.toLocaleString('es-CO')), el('td', { class: 'cs-num' }, num(100 * v / (total || 1), 1) + ' %')));
    return el('div', { class: 'cs-panel' },
      el('h2', {}, 'Simulación (todavía no se ha guardado nada)'),
      el('ul', { class: 'cs-avisos' },
        el('li', {}, plan.docs.length + ' series punto-mes por guardar en ' + plan.lotes.length + (plan.lotes.length === 1 ? ' lote' : ' lotes') + ' (' + num(plan.tamanoTotal / 1048576, 1) + ' MB); ' + plan.sinCambios + ' ya estaban iguales y no se reescriben.'),
        el('li', {}, nuevos + ' puntos SCADA en ' + plan.meses.map(nombreMes).join(', ') + '.'),
        el('li', {}, num(100 * validas / (leidas || 1), 1) + ' % de las horas-dato leídas quedaron válidas tras la limpieza' + (c[CODIGO.SIN_ARCHIVO] ? ' (las horas de días sin archivo quedan como hueco).' : '.')),
        plan.conflictos ? el('li', {}, plan.conflictos + ' horas traen un valor distinto al guardado: ' + (modo === 'completar' ? 'se conserva el guardado.' : 'se usa el nuevo.')) : null,
        grande ? el('li', { class: 'cs-error' }, 'Una serie supera el tamaño admitido por la base: no se puede guardar. Avise al equipo técnico.') : null),
      filasCod.length ? el('details', {}, el('summary', {}, 'Qué se descartó y por qué'),
        el('table', { class: 'cs-sec' }, el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Motivo'), el('th', { scope: 'col' }, 'Horas-dato'), el('th', { scope: 'col' }, '%'))), el('tbody', {}, filasCod))) : null,
      el('div', { class: 'cs-acciones' },
        el('button', { type: 'button', class: 'btn btn--primary', disabled: grande || (!plan.docs.length && !plan.sinCambios), onclick: guardar }, 'Guardar en la base'),
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { fase = 'analizado'; plan = null; dibujar(); } }, 'Volver')));
  }

  function bloqueResultado() {
    const r = resultado;
    if (r.ok) {
      return el('div', { class: 'cs-panel' }, el('div', { class: 'cs-veredicto cs-veredicto--listo', role: 'status' }, el('b', {}, 'Carga guardada'),
        el('span', { class: 'cs-sub' }, r.escritos + (r.escritos === 1 ? ' serie y ' : ' series y ') + r.resumenes + (r.resumenes === 1 ? ' resumen' : ' resúmenes') + '. La página «Cargabilidad SCADA» ya muestra ' + plan.meses.map(nombreMes).join(', ') + '.')),
        el('div', { class: 'cs-acciones' }, el('a', { class: 'btn btn--glass', href: '../pages/cargabilidad-scada.html' }, 'Ver Cargabilidad SCADA'),
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { fase = 'inicio'; analisis = null; plan = null; resultado = null; dibujar(); } }, 'Cargar otro mes')));
    }
    if (r.resimular) {
      return el('div', { class: 'cs-panel' }, el('div', { class: 'cs-veredicto cs-veredicto--avisos', role: 'alert' }, el('b', {}, 'No se guardó nada'),
        el('span', { class: 'cs-sub' }, String(r.texto).replace(/\.+$/, '') + '.')),
        el('div', { class: 'cs-acciones' }, el('button', { type: 'button', class: 'btn btn--primary', onclick: () => { resultado = null; plan = null; fase = 'analizado'; simular(); } }, 'Volver a simular')));
    }
    const queda = r.catalogoEscrito
      ? 'El mes ya quedó visible en la página; solo falló el cierre del registro.'
      : 'La página no muestra el mes hasta que la carga termine: vuelva a intentarlo (lo ya guardado se funde, no se duplica).';
    return el('div', { class: 'cs-panel' }, el('div', { class: 'cs-veredicto cs-veredicto--bloqueado', role: 'alert' }, el('b', {}, 'La carga no terminó'),
      el('span', { class: 'cs-sub' }, String(r.texto).replace(/\.+$/, '') + '. Se guardaron ' + r.escritos + (r.escritos === 1 ? ' serie' : ' series') + (r.resumenes ? ' y ' + r.resumenes + (r.resumenes === 1 ? ' resumen' : ' resúmenes') : '') + '. ' + queda)),
      el('div', { class: 'cs-acciones' }, el('button', { type: 'button', class: 'btn btn--primary', onclick: () => { resultado = null; fase = 'plan'; dibujar(); } }, 'Reintentar')));
  }

  function dibujar() {
    if (!est) return;
    barra = null;
    if (!est.homologacion) {
      poner(cont, el('div', { class: 'cs-estado', role: 'status' }, est.errorHomologacion
        ? 'No se pudo leer la homologación (revise la conexión).'
        : 'Primero cargue la homologación en la pestaña «Homologación»: sin ella no se sabe qué puntos leer.'));
      return;
    }
    const aviso = mensaje ? el('div', { class: 'cs-panel cs-error', role: 'alert' }, mensaje) : null;
    if (fase === 'inicio') poner(cont, aviso, zonaArrastre());
    else if (fase === 'leyendo') poner(cont, bloqueProgreso(true));
    else if (fase === 'analizado') poner(cont, aviso, bloqueVeredicto());
    else if (fase === 'simulando') poner(cont, bloqueVeredicto(), bloqueProgreso(false));
    else if (fase === 'plan') poner(cont, aviso, bloqueVeredicto(), bloquePlan());
    else if (fase === 'escribiendo') poner(cont, bloqueProgreso(false));
    else if (fase === 'fin') poner(cont, bloqueResultado());
  }

  function pintar(estado) {
    est = estado;
    if (fase === 'escribiendo' || fase === 'simulando' || fase === 'leyendo') return;   // no interrumpe una operación en curso
    dibujar();
  }
  return { pintar };
}
