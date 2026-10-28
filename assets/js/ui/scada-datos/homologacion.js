// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Datos SCADA · pestaña «Homologación» · `99 §122`
// ──────────────────────────────────────────────────────────────
// 1) Cargar el Excel (hoja «Homologacion de Transformadores»): vista previa y diferencias
//    con la vigente; al guardar se FUNDE con la vigente fresca (las decisiones se conservan).
// 2) Tabla de filas con su estado efectivo y sus avisos; «Revisar» abre la evidencia y
//    permite CONFIRMAR o EXCLUIR la fila, con nota (decisión del Ingeniero: una por una).
// Todo texto externo con textContent. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from '../cargabilidad-scada/dom.js';
import {
  leerFilasHomologacion, fusionarHomologacion, conteosHomologacion, avisosFila, estadoEfectivo, AVISOS, claveEfectiva,
  analizarClaveHomologada, placaDe, mapaNivelDevanado, normalizarMatricula, mapaDeDecision
} from '../../domain/scada_carga_homologacion.js';
import { claveId, normalizarTexto, esElementoTransformador } from '../../domain/scada_carga_csv.js';
import { NIVELES, DEVANADO } from '../../domain/scada_carga_config.js';
import { mesPorDefecto } from '../../domain/scada_carga_vista.js';
import { guardarHomologacion, decidirFila } from '../../data/scada_carga_admin.js';
import { leerResumenMes } from '../../data/scada_carga.js';
import { nombreMes } from '../../domain/scada_carga_fecha.js';
// Suma de circuitos (2026-10-24): archivo NUEVO. Sin suma en la decisión, el diálogo evalúa y guarda lo de siempre.
import { SUMA, erroresSuma, componerResumen, claveSuma, firmaSuma, textoCuadre, claveEnSumaAjena } from '../../domain/scada_carga_suma.js';
// Cambio de medida desde un mes (2026-10-26): archivo NUEVO. «Revisar» CONSERVA las medidas anteriores (el diálogo rehace la
// decisión desde cero: sin esto las borraría) y «Reabrir» avisa antes de borrarlas. Sin medidas anteriores, todo igual.
import { tieneCambiosDeMedida, tienePreviasGuardadas, llavesPrevias, erroresCambioMedida, textoMes, segmentos as segmentosDeFila, textoVentana } from '../../domain/scada_carga_cambio_medida.js';

const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const SHEETJS_SRI = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
let sheetjs = null;
function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (sheetjs) return sheetjs;
  sheetjs = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SHEETJS; s.integrity = SHEETJS_SRI; s.crossOrigin = 'anonymous'; s.async = true;
    s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error('El lector de Excel no quedó disponible.')));
    s.onerror = () => { sheetjs = null; rej(new Error('No se pudo descargar el lector de Excel (revise la conexión).')); };
    document.head.appendChild(s);
  });
  return sheetjs;
}

const MAX_FILAS = 400;   // = firestore.rules (scada_homologacion: filas.size() <= 400)
const sinTildes = (s) => normalizarTexto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ETIQUETA_ESTADO = { automatica: 'Automática', confirmada: 'Confirmada', pendiente: 'Pendiente', excluida: 'Excluida', sin_homologacion: 'Sin homologación' };
const CHIP_ESTADO = { automatica: 'chip chip--teal', confirmada: 'chip chip--success', pendiente: 'chip chip--warn', excluida: 'chip chip--neutro', sin_homologacion: 'chip chip--neutro' };

export function montarHomologacion(cont, { alCambiar }) {
  let est = null;
  let previa = null;          // filas leídas del Excel, sin guardar
  let soloPendientes = true;
  let resumenUltimo = null;
  let mesResumen = null;
  let cargaResumen = null;   // la carga del catálogo con que se leyó: tras cargar ese MISMO mes, se vuelve a leer
  let avisoGuardado = '';   // sobrevive al repintado que sigue a un guardado

  function contexto() {
    const filas = (est.homologacion && est.homologacion.filas) || {};
    const conteos = conteosHomologacion(filas);
    const txPorMat = new Map();
    for (const tx of est.parque) {
      const m = normalizarMatricula((tx.identificacion && (tx.identificacion.matricula || tx.identificacion.codigo)) || tx.codigo);
      if (!txPorMat.has(m)) txPorMat.set(m, []);
      txPorMat.get(m).push(tx);
    }
    return { filas, conteos, txPorMat, puntos: (est.catalogo && est.catalogo.puntos) || {} };
  }
  function txDeFila(f, ctx) {
    const lista = ctx.txPorMat.get(normalizarMatricula(f.matricula)) || [];
    if (lista.length <= 1) return lista[0] || null;
    const sub = sinTildes(f.subestacion);
    return lista.find((t) => sinTildes(t.ubicacion && t.ubicacion.subestacion_nombre) === sub) || lista[0];
  }
  function evaluar(f, ctx, decisionPrueba) {
    const fila = decisionPrueba !== undefined ? { ...f, decision: decisionPrueba } : f;
    const k = analizarClaveHomologada(claveEfectiva(fila));
    const cid = k ? claveId(k.est, k.elem) : null;
    const punto = cid ? ctx.puntos[cid] || null : null;
    // Con suma de circuitos, el nivel sumado se evalúa con su resumen DERIVADO (como en la página); sin suma, el mismo objeto.
    const r = cid && resumenUltimo && resumenUltimo.claves ? componerResumen(resumenUltimo.claves, cid, fila, ctx.puntos) : null;
    const tx = txDeFila(fila, ctx);
    const a = avisosFila(fila, { ...ctx.conteos, tx, punto, resumenPorNivel: r });
    return { ...a, estado: estadoEfectivo(fila, a.avisos), tx, punto, cid, r };
  }

  function seccionExcel() {
    const sec = el('div', { class: 'cs-panel' });
    sec.appendChild(el('h2', {}, 'Cargar el Excel de homologación'));
    sec.appendChild(el('p', { class: 'cs-ayuda' }, 'Se lee la hoja «Homologacion de Transformadores» (columnas SUBESTACION, MATRICULA y la del punto swTrafo). Las decisiones que ya tomó se conservan; una fila que ya no esté en el Excel queda «retirada», no se borra.'));
    const input = el('input', { type: 'file', accept: '.xlsx,.xls', id: 'excelHomologacion' });
    const msg = el('p', { class: 'cs-ayuda', role: 'status', 'aria-live': 'polite' }, avisoGuardado);
    avisoGuardado = '';
    const zona = el('div');
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      msg.textContent = 'Leyendo ' + f.name + '…';
      try {
        const XLSX = await cargarSheetJS();
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
        const nombreHoja = wb.SheetNames.find((n) => /homolog/i.test(n)) || wb.SheetNames[0];
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header: 1, raw: false, defval: '' });
        const r = leerFilasHomologacion(aoa);
        if (!r.ok) { msg.textContent = r.motivo; previa = null; poner(zona); return; }
        previa = { filas: r.filas, archivo: f.name, hoja: nombreHoja };
        const fz = fusionarHomologacion(r.filas, est.homologacion);
        const conClave = r.filas.filter((x) => x.clave).length;
        const circuitos = r.filas.filter((x) => x.clave && !/^sw(tr|auto)/i.test(x.clave.elem)).length;
        const total = Object.keys(fz.filas).length;
        const demasiadas = total > MAX_FILAS;   // tope de las reglas: las filas retiradas no se borran
        msg.textContent = '';
        poner(zona,
          el('ul', { class: 'cs-avisos' },
            el('li', {}, r.filas.length + ' filas; ' + conClave + ' con punto SCADA (' + circuitos + ' a un circuito) y ' + (r.filas.length - conClave) + ' sin punto.'),
            el('li', {}, 'Frente a lo vigente: ' + fz.nuevas + ' nuevas, ' + fz.cambiadas + ' cambiadas, ' + fz.retiradas + ' retiradas.'),
            fz.colisiones.length ? el('li', { class: 'cs-error' }, 'Matrículas repetidas en la misma subestación: ' + fz.colisiones.join(', ') + '. Corríjalas en el Excel.') : null,
            demasiadas ? el('li', { class: 'cs-error' }, 'Con las retiradas serían ' + total + ' filas y la base admite hasta ' + MAX_FILAS + '. Avise al equipo técnico antes de guardar.') : null),
          el('div', { class: 'cs-acciones' }, el('button', { type: 'button', class: 'btn btn--primary', disabled: fz.colisiones.length > 0 || demasiadas, onclick: guardar }, 'Guardar homologación')));
      } catch (e) {
        msg.textContent = (e && e.message) || 'No se pudo leer el archivo.';
      }
    });
    async function guardar(ev) {
      if (!previa) return;
      ev.target.disabled = true;
      msg.textContent = 'Guardando…';
      const r = await guardarHomologacion(previa.filas, { archivo: previa.archivo.slice(0, 120), hoja: previa.hoja.slice(0, 80), filas: previa.filas.length, cargadaEn: new Date().toISOString() });
      if (!r.ok) { msg.textContent = r.motivo; ev.target.disabled = false; return; }
      avisoGuardado = 'Homologación guardada (versión ' + r.rev + '): ' + r.resumen.nuevas + ' nuevas, ' + r.resumen.cambiadas + ' cambiadas, ' + r.resumen.retiradas + ' retiradas.';
      msg.textContent = avisoGuardado;
      previa = null; input.value = '';
      await alCambiar();
    }
    sec.append(el('label', { for: 'excelHomologacion', class: 'cs-campo' }, 'Archivo Excel'), input, msg, zona);
    return sec;
  }

  function dialogoRevisar(f, ctx) {
    const ev0 = evaluar(f, ctx);
    const placa = placaDe(ev0.tx);
    const niveles = Object.keys((ev0.punto && ev0.punto.niveles) || {}).sort((a, b) => NIVELES[b].kv - NIVELES[a].kv);
    const auto = mapaNivelDevanado(niveles, placa);
    const dlg = el('dialog', { class: 'cscada cs-dialogo', 'aria-labelledby': 'dlgTitulo' });
    const cerrar = () => { dlg.close(); dlg.remove(); };
    // Puntos de la misma estación (para cambiar la clave a otro swTrafo ya guardado).
    const k = analizarClaveHomologada(claveEfectiva(f));
    const estN = k ? normalizarTexto(k.est) : null;
    const candidatos = Object.values(ctx.puntos).filter((p) => estN && normalizarTexto(p.est) === estN).map((p) => '/' + p.est + '/' + p.elem);
    const opcionesClave = [...new Set([f.clave_excel, claveEfectiva(f), ...candidatos].filter(Boolean))];
    const selClave = el('select', { id: 'dlgClave' }, opcionesClave.map((c) => el('option', { value: c, selected: c === claveEfectiva(f) }, c)));
    const mapaSel = {};
    // Suma de circuitos, por nivel: «Medir con: la medida del transformador | la suma de circuitos» (D5: con la casilla de
    // barra propia). Los nombres de los circuitos se escriben (pueden no estar aún en los datos cargados) o se toman de las
    // sugerencias: los puntos de esta estación que no son un transformador.
    const sumaGuardada = (f.decision && f.decision.tipo === 'usar' && f.decision.suma && typeof f.decision.suma === 'object') ? f.decision.suma : {};
    // Fase sin carga por diseño (banco de dos monofásicas, 2026-10-28, `99 §191`): el diálogo no la fija; la muestra y la
    // conserva al guardar con el mismo punto y el nivel asignado (sin esto, «Guardar» la borraba).
    const fscGuardada = (f.decision && f.decision.tipo === 'usar' && f.decision.fases_sin_carga && typeof f.decision.fases_sin_carga === 'object') ? f.decision.fases_sin_carga : null;
    // Unidad de reserva (2026-10-28, `99 §192`): igual que la fase sin carga, se muestra y se conserva con el mismo punto.
    const reservaGuardada = !!(f.decision && f.decision.tipo === 'usar' && f.decision.unidad_reserva === true);
    const rPropio = ev0.cid && resumenUltimo && resumenUltimo.claves ? resumenUltimo.claves[ev0.cid] || null : null;
    const derUltimo = ev0.cid && resumenUltimo && resumenUltimo.claves ? resumenUltimo.claves[claveSuma(ev0.cid)] || null : null;
    const sugeridos = [...new Set(Object.values(ctx.puntos).filter((p) => estN && normalizarTexto(p.est) === estN && !esElementoTransformador(p.elem)).map((p) => p.elem))]
      .sort((x, y) => x.localeCompare(y, 'es'));
    const listaDe = (t) => String(t || '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
    const medirSel = {}; const sumaUI = {};
    const VEREDICTO = { ok: 'cuadra', no_cuadra: 'no cuadra: la cifra saldrá provisional', sin_contraste: 'sin contraste: la cifra saldrá provisional' };
    const textoCuadreUltimo = (nv, lista) => {
      const r = derUltimo && derUltimo[nv]; const d = r && r.derivado;
      const cids = k ? lista.map((e) => claveId(k.est, e)) : [];
      if (d && d.estado === 'ok' && cids.length && d.firma === firmaSuma(nv, cids, SUMA.fases)) {
        return 'Último mes cargado (' + nombreMes(mesResumen) + '): suma ' + (r.i && r.i.p99 != null ? num(r.i.p99, 0) + ' A (p99)' : 'sin horas válidas')
          + ' · transformador ÷ suma: ' + (textoCuadre(d) || '—') + ' (' + (VEREDICTO[d.veredicto] || d.veredicto) + ').';
      }
      return 'El cuadre con el transformador se calculará al volver a cargar los meses.';
    };
    function bloqueSuma(nv) {
      const g = sumaGuardada[nv] || {};
      const idDe = 'dlgSumaDe-' + nv; const idBarra = 'dlgSumaBarra-' + nv;
      const de = el('input', { type: 'text', id: idDe, maxlength: 200, autocomplete: 'off', style: 'width:100%', placeholder: 'nombres de los circuitos, separados por comas' });
      de.value = (Array.isArray(g.de) ? g.de : []).join(', ');
      const barra = el('input', { type: 'checkbox', id: idBarra, checked: g.barra_propia === true });
      const cuadre = el('p', { class: 'cs-ayuda', role: 'status', 'aria-live': 'polite' });
      const pintarCuadre = () => { cuadre.textContent = textoCuadreUltimo(nv, listaDe(de.value)); };
      de.addEventListener('input', pintarCuadre);
      pintarCuadre();
      const agregar = (e) => {
        const l = listaDe(de.value);
        if (!l.some((x) => normalizarTexto(x) === normalizarTexto(e))) { de.value = [...l, e].join(', '); pintarCuadre(); }
      };
      sumaUI[nv] = { de, barra };
      // Envuelto en un div: `hidden` en el fieldset no basta (la hoja de estilos le da display:flex a .cs-rango).
      return el('div', {}, el('fieldset', { class: 'cs-rango', style: 'margin-top:8px' }, el('legend', {}, NIVELES[nv].etiqueta + ' · suma de circuitos'),
        el('p', { class: 'cs-ayuda' }, 'Las corrientes de este nivel salen de la suma, hora por hora, de los circuitos de su barra (una hora vale solo si valen todos). La tensión, P y Q siguen siendo las del transformador. La medida propia del transformador se conserva, pero no se usa.'),
        el('label', { for: idDe, class: 'cs-campo' }, 'Circuitos (como los escribe el SCADA, separados por comas)', de),
        sugeridos.length
          ? el('p', { class: 'cs-ayuda' }, 'Circuitos de esta estación en los datos cargados: ', ...sugeridos.map((e) => el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => agregar(e) }, '+ ' + e)))
          : el('p', { class: 'cs-ayuda' }, 'Los circuitos de esta estación todavía no están en los datos cargados: escriba sus nombres; entran al volver a cargar los meses.'),
        el('label', { class: 'cs-check', for: idBarra }, barra, ' La barra de este nivel la alimenta solo este transformador (obligatorio para usar la suma)'),
        cuadre));
    }
    const bloquesSuma = [];
    const filasMapa = niveles.map((nv) => {
      const s = el('select', { 'aria-label': 'Devanado del nivel ' + NIVELES[nv].etiqueta },
        el('option', { value: '' }, 'No usar'),
        ['P', 'S', 'T'].filter((d) => placa[d] && placa[d].kv).map((d) => el('option', { value: d, selected: (mapaDeDecision(f) || auto.mapa)[nv] === d },
          DEVANADO[d] + (placa[d] && placa[d].kv ? ' (' + num(placa[d].kv, 1) + ' kV, ' + (placa[d].A ? num(placa[d].A, 0) + ' A' : 'sin ampacidad') + ')' : ''))));
      mapaSel[nv] = s;
      // El p99 del último mes es el de la medida PROPIA del transformador (el de la suma va en su bloque, con su cuadre).
      const r = rPropio ? rPropio[nv] : null;
      const medir = el('select', { id: 'dlgMedir-' + nv, 'aria-label': 'Con qué se mide el nivel ' + NIVELES[nv].etiqueta },
        el('option', { value: 'medida' }, 'Medir con la medida del transformador'),
        el('option', { value: 'suma', selected: !!sumaGuardada[nv] }, 'Medir con la suma de circuitos'));
      medirSel[nv] = medir;
      const bloque = bloqueSuma(nv);
      const celdaP99 = el('td', {});
      // Un nivel en «No usar» no se mide con nada: el selector queda inactivo (y su suma, si la había, no se guarda).
      // Con la suma, la celda dice que el p99 es el de la medida PROPIA del transformador (no el que se usa).
      const sincronizar = () => {
        medir.disabled = !s.value;
        bloque.hidden = medir.disabled || medir.value !== 'suma';
        celdaP99.textContent = r && r.i && r.i.p99 != null
          ? num(r.i.p99, 0) + ' A (p99 del último mes' + (!medir.disabled && medir.value === 'suma' ? ', de la medida propia del transformador: no se usa' : '') + ')'
          : 'sin datos del último mes';
      };
      medir.addEventListener('change', sincronizar);
      s.addEventListener('change', sincronizar);
      sincronizar();
      bloquesSuma.push(bloque);
      return el('tr', {}, el('td', {}, NIVELES[nv].etiqueta), el('td', {}, s), el('td', {}, medir), celdaP99);
    });
    const tipo = el('select', { id: 'dlgTipo' }, el('option', { value: 'usar' }, 'Confirmar: usar esta medida'), el('option', { value: 'no_usar' }, 'Excluir: no calcular este transformador'));
    if (f.decision && f.decision.tipo === 'no_usar') tipo.value = 'no_usar';
    const nota = el('textarea', { id: 'dlgNota', rows: 3, maxlength: 300, style: 'width:100%' });
    nota.value = (f.decision && f.decision.nota) || '';
    const msg = el('p', { class: 'cs-error', role: 'alert' });
    async function confirmar() {
      if (nota.value.trim().length < 10) { msg.textContent = 'Escriba una nota de al menos 10 caracteres (por qué se confirma o se excluye).'; nota.focus(); return; }
      const mapa = {};
      for (const [nv, s] of Object.entries(mapaSel)) if (s.value) mapa[nv] = s.value;
      // «Usar esta medida» con TODOS los niveles en «No usar» se contradice: eso es «Excluir».
      if (tipo.value === 'usar' && niveles.length && !Object.keys(mapa).length) {
        msg.textContent = 'Ningún nivel quedó asignado a un devanado. Si esta medida no es de este transformador, elija «Excluir».';
        return;
      }
      // Sin niveles que mostrar (aún no hay meses) no se guarda mapa: manda el automático (mapaDeDecision).
      // niveles_vistos: los que se revisaron; un nivel que aparezca después vuelve a pedir revisión.
      const decision = { tipo: tipo.value, clave: selClave.value || null, mapa: niveles.length ? mapa : null, niveles_vistos: niveles,
        nota: nota.value.trim(), clave_excel_vista: f.clave_excel || null, avisos_vistos: [] };
      // Medidas anteriores (cambio de medida): se copian TAL CUAL; la medida de hoy no puede ser una exclusión.
      if (tienePreviasGuardadas(f.decision)) {
        if (tipo.value !== 'usar') { msg.textContent = 'Esta fila tiene un cambio de medida (' + llavesPrevias(f.decision).map((k) => 'hasta ' + textoMes(k)).join(', ') + '): la medida de hoy debe ser «usar». Para excluirla: «Reabrir» (borra la decisión con su cambio de medida; queda en el registro) y luego «Excluir».'; return; }
        decision.previas = f.decision.previas;
      }
      if (fscGuardada && tipo.value === 'usar' && (selClave.value || null) === (claveEfectiva(f) || null)) {
        const fsc = Object.fromEntries(Object.entries(fscGuardada).filter(([nv]) => decision.mapa && decision.mapa[nv]));
        if (Object.keys(fsc).length) decision.fases_sin_carga = fsc;
      }
      if (reservaGuardada && tipo.value === 'usar' && (selClave.value || null) === (claveEfectiva(f) || null)) decision.unidad_reserva = true;
      // Suma de circuitos: solo con «Confirmar: usar esta medida» y solo los niveles marcados (sin suma, la decisión de siempre).
      const suma = {};
      if (tipo.value === 'usar') {
        for (const nv of niveles) {
          if (!medirSel[nv] || medirSel[nv].disabled || medirSel[nv].value !== 'suma') continue;
          suma[nv] = { de: listaDe(sumaUI[nv].de.value), fases: [...SUMA.fases], barra_propia: !!sumaUI[nv].barra.checked };
        }
      }
      // Sin los niveles a la vista (no se leyeron los datos cargados), guardar borraría la suma de circuitos que ya tiene.
      // Tampoco con un mapa decidido (un nivel en «No usar»): guardar sin niveles lo cambiaría por el automático.
      const mapaGuardado = !!(f.decision && f.decision.tipo === 'usar' && f.decision.mapa && Object.keys(f.decision.mapa).length);
      if (tipo.value === 'usar' && !niveles.length && (Object.keys(sumaGuardada).length || fscGuardada || mapaGuardado)) {
        msg.textContent = 'No se pudieron ver los niveles de este punto (no se leyeron los datos cargados): recargue la página antes de guardar, para no perder su '
          + (Object.keys(sumaGuardada).length ? 'suma de circuitos' : (fscGuardada ? 'fase sin carga' : 'asignación de niveles')) + '.';
        return;
      }
      // La medida elegida no puede ser un circuito que otra fila ya suma: la misma corriente contaría en dos equipos.
      const ajena = tipo.value === 'usar' ? claveEnSumaAjena(selClave.value || null, ctx.filas, f.id) : null;
      if (ajena) {
        msg.textContent = '«' + selClave.value + '» es un circuito de la suma de circuitos de otra fila (' + ajena + '): no puede ser también la medida de esta fila. Elija otro punto SCADA.';
        return;
      }
      if (decision.previas) {
        const errCambio = erroresCambioMedida(f, { ...decision, ...(Object.keys(suma).length ? { suma } : {}) });
        if (errCambio.length) { msg.textContent = errCambio.join(' '); return; }
      }
      if (Object.keys(suma).length) {
        // Con otra clave elegida, la suma sería de otro punto: se exige la misma clave con que se revisaron los niveles.
        if ((selClave.value || null) !== (claveEfectiva(f) || null)) {
          msg.textContent = 'La suma de circuitos se define sobre el punto SCADA revisado. Para cambiar de punto: ponga primero «Medir con la medida del transformador» en el nivel sumado, guarde, y vuelva a abrir «Revisar» para definir la suma sobre el punto nuevo.';
          return;
        }
        decision.suma = suma;
        const errores = erroresSuma(f, decision, { filas: ctx.filas, puntos: ctx.puntos, filaId: f.id });
        if (errores.length) { msg.textContent = errores.join(' '); return; }
      }
      const evD = evaluar(f, ctx, decision);
      const bloq = new Set([...ev0.avisos, ...evD.avisos].filter((a) => AVISOS[a] && AVISOS[a].bloquea));
      // NIVEL_NO_REVISADO lo resuelve esta misma decisión (niveles_vistos): no se marca como visto para siempre.
      decision.avisos_vistos = [...bloq].filter((x) => x !== 'NIVEL_NO_REVISADO');
      msg.textContent = 'Guardando…';
      const r = await decidirFila(f.id, decision);
      if (!r.ok) { msg.textContent = r.motivo; return; }
      cerrar();
      await alCambiar();
    }
    let reabrirConfirmado = false;
    async function reabrir() {
      // Reabrir borra TODA la decisión, también las medidas anteriores (quedan en el registro): se pide un segundo clic.
      if (tieneCambiosDeMedida(f.decision) && !reabrirConfirmado) {
        reabrirConfirmado = true;
        msg.textContent = 'Esta fila tiene un cambio de medida (' + llavesPrevias(f.decision).map((k) => 'hasta ' + textoMes(k)).join(', ') + '). Reabrir lo borra junto con la decisión (queda en el registro). Pulse otra vez «Reabrir» para confirmar.';
        return;
      }
      msg.textContent = 'Guardando…';
      const r = await decidirFila(f.id, null);
      if (!r.ok) { msg.textContent = r.motivo; return; }
      cerrar(); await alCambiar();
    }
    const rel = ev0.relacion;
    dlg.append(...[
      el('h2', { id: 'dlgTitulo' }, 'Revisar ' + f.matricula + ' · ' + f.subestacion),
      el('p', { class: 'cs-dato' }, el('b', {}, 'En el Excel: '), f.texto_excel || '(sin punto)'),
      el('ul', { class: 'cs-avisos' }, ev0.avisos.length ? ev0.avisos.map((a) => el('li', {}, (AVISOS[a] ? AVISOS[a].texto : a) + (AVISOS[a] && AVISOS[a].bloquea ? '' : ' (informativo)'))) : el('li', {}, 'Sin avisos.')),
      rel ? el('p', { class: 'cs-ayuda' }, 'Relación de corrientes entre los dos lados: medida ' + num(rel.medido, 2) + ' frente a ' + num(rel.esperado, 2) + ' esperada por las tensiones de placa.') : null,
      reservaGuardada ? el('p', { class: 'cs-ayuda' }, 'Unidad de reserva: un mes sin carga apreciable queda «en reserva» y no cuenta para la firmeza. Se conserva al guardar con el mismo punto; «Excluir» o «Reabrir» la quitan.') : null,
      fscGuardada ? el('p', { class: 'cs-ayuda' }, 'Fase sin carga (p. ej., banco de dos monofásicas o red de dos fases): '
        + Object.entries(fscGuardada).map(([nv, ph]) => (NIVELES[nv] ? NIVELES[nv].etiqueta : nv) + ', fase ' + String(ph).slice(1)).join(' · ')
        + '. Se conserva al guardar con el mismo punto y ese nivel asignado; «Excluir» o «Reabrir» la quitan.') : null,
      el('div', { class: 'cs-filtros', style: 'margin-top:10px' },
        el('label', {}, 'Decisión', tipo),
        el('label', { for: 'dlgClave' }, 'Punto SCADA', selClave)),
      niveles.length ? el('table', { class: 'cs-sec', style: 'margin-top:10px' }, el('caption', { class: 'cs-ayuda' }, 'Nivel medido → devanado (la cargabilidad se compara con la ampacidad de ese devanado)'),
        el('tbody', {}, filasMapa)) : el('p', { class: 'cs-ayuda' }, 'Este punto todavía no tiene datos cargados: el mapa de niveles se podrá revisar después de cargar un mes.'),
      ...bloquesSuma,
      el('label', { for: 'dlgNota', class: 'cs-campo', style: 'margin-top:10px' }, 'Nota (obligatoria)'), nota, msg,
      el('div', { class: 'cs-acciones' },
        el('button', { type: 'button', class: 'btn btn--primary', onclick: confirmar }, 'Guardar decisión'),
        f.decision ? el('button', { type: 'button', class: 'btn btn--glass', onclick: reabrir }, 'Reabrir (quitar la decisión)') : null,
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: cerrar }, 'Cancelar'))].filter(Boolean));
    dlg.addEventListener('cancel', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  function seccionTabla() {
    const sec = el('div', { class: 'cs-panel' });
    const ctx = contexto();
    const filas = Object.entries(ctx.filas).map(([id, f]) => ({ ...f, id })).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if (!filas.length) { sec.append(el('h2', {}, 'Filas de la homologación'), el('div', { class: 'cs-estado' }, 'Todavía no hay homologación cargada. Cargue el Excel arriba.')); return sec; }
    const evaluadas = filas.map((f) => ({ f, e: evaluar(f, ctx) }));
    const pend = evaluadas.filter((x) => x.e.estado === 'pendiente').length;
    const chk = el('input', { type: 'checkbox', id: 'soloPend', checked: soloPendientes });
    chk.addEventListener('change', () => { soloPendientes = chk.checked; pintar(est); });
    const visibles = evaluadas.filter((x) => !soloPendientes || x.e.estado === 'pendiente');
    const tabla = el('table', { class: 'cs-tabla' },
      el('caption', {}, pend + ' pendientes de ' + filas.length + ' filas. La cargabilidad de una fila pendiente se muestra como provisional hasta que la confirme.'),
      el('thead', {}, el('tr', {}, ['Matrícula', 'Subestación', 'Punto SCADA', 'Estado', 'Avisos', ''].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, visibles.map(({ f, e }) => el('tr', {},
        el('td', {}, f.matricula), el('td', {}, f.subestacion), el('td', {}, claveEfectiva(f) || '(sin punto)'),
        el('td', {}, el('span', { class: CHIP_ESTADO[e.estado] }, ETIQUETA_ESTADO[e.estado] || e.estado),
          f.decision && f.decision.por ? el('span', { class: 'cs-sub' }, (f.decision.tipo === 'no_usar' ? 'Excluida' : 'Confirmada') + ' por ' + f.decision.por.nombre) : null,
          // Cambio de medida: cada configuración anterior, con su ventana (la de hoy es la de esta fila).
          tieneCambiosDeMedida(f.decision) ? segmentosDeFila(f).filter((x) => x.tipo !== 'vigente').map((x) => el('span', { class: 'cs-sub' },
            (x.tipo === 'sin_carga' ? 'Sin carga ' : 'Medida anterior (' + (claveEfectiva(x.fila) || 'sin punto') + ') ') + textoVentana(x))) : null),
        el('td', {}, e.avisos.length ? e.avisos.map((a) => el('span', { class: 'cs-sub' }, '• ' + (AVISOS[a] ? AVISOS[a].texto : a))) : '—'),
        el('td', {}, el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => dialogoRevisar(f, ctx) }, 'Revisar'))))));
    sec.append(el('h2', {}, 'Filas de la homologación'),
      el('label', { class: 'cs-check', for: 'soloPend' }, chk, ' Solo pendientes'),
      el('p', { class: 'cs-contador', 'aria-live': 'polite' }, visibles.length + ' filas visibles'),
      el('div', { class: 'cs-tabla-caja' }, tabla));
    return sec;
  }

  async function pintar(estado) {
    est = estado;
    const mes = mesPorDefecto(est.catalogo);
    // También tras una carga nueva del MISMO mes (otro `cargaId`): su resumen trae la suma recién calculada.
    const carga = (est.catalogo && est.catalogo.cargaId) || null;
    if (mes !== mesResumen || carga !== cargaResumen) {
      const r = mes ? await leerResumenMes(mes) : null;
      resumenUltimo = r && r.estado === 'ok' ? r.datos : null;
      mesResumen = r && r.estado === 'fallo' ? null : mes;
      cargaResumen = r && r.estado === 'fallo' ? null : carga;
    }
    const avisoError = est.errorHomologacion ? el('div', { class: 'cs-panel', role: 'alert' }, 'No se pudo leer la homologación vigente (revise la conexión): no guarde un Excel hasta poder verla.') : null;
    poner(cont, avisoError, seccionExcel(), seccionTabla());
  }
  return { pintar };
}
