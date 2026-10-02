// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · «Triángulo de Duval: hoy y con más carga» del detalle · `99 §131`
// ──────────────────────────────────────────────────────────────
// HOY: el triángulo de Duval 1 con los ppm de la última DGA (2025 según el área) y las fronteras de Duval 2002; solo se
// colorea con gas significativo (USBR FIST 3-31). CON MÁS CARGA: el punto NO se mueve (ninguna norma da su trayectoria);
// se proyecta la carga medida del rango: márgenes exactos hasta cada nivel de la tabla de atención (§127), escenarios y
// pérdidas por corriente. Se carga con import() desde detalle.js: si falla, la ficha queda igual. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from './dom.js';
import { CALCULO } from '../../domain/scada_carga_config.js';
import { NIVELES_ATENCION, filasCarga, entradaCarga, leerGases, columnaGases, nivelAtencion } from '../../domain/scada_carga_dga.js';
import { TEXTO_FECHA_MUESTRA } from '../../domain/scada_carga_dga_textos.js';
import { POLIGONOS_DUVAL1, ZONAS_DUVAL1, REFERENCIA_SIGNIFICANCIA, GASES_DGA, duvalDeEquipo } from '../../domain/dga_duval.js';
import { margenesCarga, escenarioCarga, corrienteReferencia, ESCENARIOS_FIJOS, ESCENARIO_LIBRE_MAX } from '../../domain/scada_carga_proyeccion.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 280; const H = (W * Math.sqrt(3)) / 2; const X0 = 34; const Y0 = 24;
const NOMBRE_GAS = { H2: 'Hidrógeno (H₂)', CH4: 'Metano (CH₄)', C2H4: 'Etileno (C₂H₄)', C2H6: 'Etano (C₂H₆)', C2H2: 'Acetileno (C₂H₂)', CO: 'Monóxido de carbono (CO)', CO2: 'Dióxido de carbono (CO₂)' };
const CORTO = { CH4: 'CH₄', C2H4: 'C₂H₄', C2H2: 'C₂H₂', H2: 'H₂', C2H6: 'C₂H₆' };
const CALIF = { calif_tdgc: 'gases combustibles', calif_c2h2: 'acetileno', calif_co: 'CO', calif_co2: 'CO₂' };
const lista = (xs, dic) => xs.map((k) => dic[k] || k).join(', ').replace(/, ([^,]*)$/, ' y $1');

function svg(tag, attrs = {}, ...hijos) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const h of hijos.flat(Infinity)) if (h != null) e.appendChild(h instanceof Node ? h : document.createTextNode(String(h)));
  return e;
}
/** (CH₄, C₂H₄, C₂H₂) en % → coordenadas: CH₄ arriba, C₂H₄ abajo a la derecha, C₂H₂ abajo a la izquierda. */
const xy = ([m, e]) => [X0 + ((e + m / 2) / 100) * W, Y0 + H - (m / 100) * H];

function triangulo(d) {
  const color = d.estado === 'ok';
  const centro = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  const zonas = Object.entries(POLIGONOS_DUVAL1).map(([z, pts]) => {
    const p = pts.map(xy);
    const [cx, cy] = z === 'PD' ? [xy([100, 0])[0] + 16, xy([100, 0])[1] + 2] : centro(p);
    return [svg('polygon', { points: p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '), class: 'cs-duval-z ' + (color ? 'cs-duval-z-' + z : 'is-gris') + (color && d.zona === z ? ' is-aqui' : '') }),
      svg('text', { x: cx.toFixed(1), y: (cy + 4).toFixed(1), class: 'cs-duval-rot', 'text-anchor': 'middle' }, z)];
  });
  const [ax, ay] = xy([100, 0]); const [bx, by] = xy([0, 100]); const [cx, cy] = xy([0, 0]);
  const punto = d.pct ? (() => { const [px, py] = xy([d.pct.CH4, d.pct.C2H4]); return svg('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 6, class: 'cs-duval-punto' + (color ? '' : ' is-gris') }); })() : null;
  const desc = d.zona ? 'Punto en la zona ' + d.zona + (color ? '' : d.estado === 'incoherente' ? ' (no confiable)' : ' (no concluyente)') : 'Sin punto';
  return svg('svg', { viewBox: '0 0 350 290', class: 'cs-duval-svg', role: 'img', 'aria-label': 'Triángulo de Duval 1. ' + desc },
    zonas, svg('polygon', { points: [ax, ay, bx, by, cx, cy].map((v) => v.toFixed(1)).join(' '), class: 'cs-duval-borde' }),
    svg('text', { x: ax, y: ay - 8, 'text-anchor': 'middle', class: 'cs-duval-eje' }, '100 % CH₄'),
    svg('text', { x: bx, y: by + 18, 'text-anchor': 'end', class: 'cs-duval-eje' }, '100 % C₂H₄'),
    svg('text', { x: cx, y: cy + 18, 'text-anchor': 'start', class: 'cs-duval-eje' }, '100 % C₂H₂'),
    punto);
}

function hoy(d) {
  const p = (t, cl) => el('p', { class: cl || 'cs-dga-sub' }, t);
  const partes = [];
  if (d.estado === 'sin_ppm') partes.push(p('Este equipo aún no tiene en la plataforma las partes por millón (ppm) de cada gas: el triángulo aparece cuando se carguen los gases del archivo de Salud de Activos.', 'cs-dga-aviso'));
  else if (d.estado === 'faltan') partes.push(p('Falta ' + d.faltan.map((k) => CORTO[k] || k).join(', ') + ' en el archivo: el triángulo necesita metano, etileno y acetileno (no se supone cero).', 'cs-dga-aviso'));
  else if (d.estado === 'sin_punto') partes.push(p('Sin metano, etileno ni acetileno detectados: no hay punto.'));
  else if (d.estado === 'incoherente') partes.push(p('Punto no confiable: estos ppm no dan la misma calificación que tiene el equipo en ' + lista(d.coherencia.diferencias, CALIF) + '. Pueden ser de otra muestra, o los umbrales cambiaron después de importar. Vuelva a importar el archivo de Salud de Activos completo (calificaciones y gases del mismo archivo) o revise los umbrales.', 'cs-dga-aviso'));
  if (d.zona) {
    const info = d.info;
    if (d.estado === 'ok') {
      partes.push(el('p', { class: 'cs-duval-zona' }, el('b', {}, d.zona + ' · ' + info.nombre)));
      if (info.banda) partes.push(p('Zona de ' + info.banda + ' si la falla está en el aceite; si está en el papel, la zona no indica la temperatura (Duval 2002). No es una temperatura medida.'));
      partes.push(p('Gas suficiente: ' + d.significancia.sobreL1.map((k) => CORTO[k] || k).join(', ') + ' en su límite L1 o más (' + REFERENCIA_SIGNIFICANCIA.fuente + ').'));
    } else if (d.estado === 'no_concluyente') {
      partes.push(el('p', { class: 'cs-duval-zona' }, el('b', {}, 'No concluyente'), ' · el punto cae en ' + d.zona));
      const sg = d.significancia;
      if (!sg.sobreL1.length) partes.push(p('Gases en nivel de fondo (ningún gas llega a su límite L1' + (sg.sumaBaja ? ', y metano, etileno y acetileno suman menos de ' + REFERENCIA_SIGNIFICANCIA.sumaMinTriangulo + ' ppm' : '') + '). El triángulo da una zona en cualquier transformador, tenga o no falla (USBR FIST 3-31 §5.3): por eso no se colorea.'));
      else partes.push(p('Metano, etileno y acetileno suman menos de ' + REFERENCIA_SIGNIFICANCIA.sumaMinTriangulo + ' ppm: muy poco para leer sus proporciones con confianza, por eso no se colorea. Pero ' + lista(sg.sobreL1, CORTO) + (sg.sobreL1.length > 1 ? ' pasan' : ' pasa') + ' su límite L1: no es nivel de fondo; vea los ppm y el panel de gases y carga.', 'cs-dga-sub cs-dga-aviso'));
    }
    partes.push(p('CH₄ ' + num(d.pct.CH4, 1) + ' % · C₂H₄ ' + num(d.pct.C2H4, 1) + ' % · C₂H₂ ' + num(d.pct.C2H2, 1) + ' %'));
    if (d.estado === 'ok' && d.frontera) partes.push(p('A ' + num(d.frontera.puntos, 1) + ' puntos de la zona ' + d.frontera.zona + (d.frontera.puntos < 2 ? ': una diferencia entre laboratorios puede cambiarla.' : '.')));
    if (d.estado === 'ok') partes.push(p('Una sola muestra: no dice si el defecto está activo ni si crece (no hay velocidad de aumento).'));
  }
  if (d.ultima) {
    const fecha = d.ultima.importado_en ? new Date(d.ultima.importado_en) : null;
    partes.push(el('details', { class: 'cs-dga-mas', 'data-k': 'ppm' }, el('summary', { id: 'csDuvalSum-ppm' }, 'Los siete gases (ppm)'),
      el('ul', { class: 'cs-dga-grupos' }, GASES_DGA.map((k) => el('li', {}, el('span', {}, NOMBRE_GAS[k]), el('b', {}, d.ultima.gases[k] == null ? '—' : num(d.ultima.gases[k], 1)))))));
    partes.push(p(TEXTO_FECHA_MUESTRA + (fecha && !Number.isNaN(fecha.getTime()) ? ' Cargados en la plataforma el ' + fecha.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) + '.' : '')));
  }
  return el('div', { class: 'cs-dga-tarjeta' }, el('h3', {}, 'Hoy · lo que dice el gas'), triangulo(d), partes);
}

function conMasCarga(nodo, args, d) {
  const { estado, calc, porNivel, umbrales, tx } = args;
  const caja = (...h) => el('div', { class: 'cs-dga-tarjeta' }, el('h3', {}, 'Con más carga · escenario, no medido'), ...h);
  const p = (t, cl) => el('p', { class: cl || 'cs-dga-sub' }, t);
  if (estado.estado === 'leyendo') return caja(p('Calculando la carga del rango…'));
  if (estado.estado === 'error') return caja(p('No se pudo leer este rango.'));
  if (estado.estado === 'sin_scada') return caja(p(estado.motivo || 'Sin medición SCADA.'), p('La cifra del Excel no reemplaza a la medida.'));
  const entrada = entradaCarga(calc, porNivel);
  if (entrada.pct == null) return caja(p('Sin cifra de carga medida: ' + (entrada.motivoNulo || 'sin horas válidas') + '.'));
  const filas = filasCarga(umbrales);
  const cg = columnaGases(leerGases(tx));
  const iRef = corrienteReferencia(calc);
  const prov = entrada.clase !== 'firme';
  const palabra = (n) => (n ? NIVELES_ATENCION[n - 1].palabra + ' (' + n + ')' : '—');
  const margenes = margenesCarga(entrada, umbrales).map((m) => {
    const nv = nivelAtencion(m.fila, cg.col, entrada.clase);
    return el('li', {}, el('span', {}, filas[m.fila].replace(/:.*/, '') + (nv ? ' → ' + palabra(nv.n) : '')),
      el('b', {}, m.superada ? 'ya está por encima' : m.ya ? 'ya está en esta franja' : (m.pct == null ? '—' : 'más de +' + num(m.pct, 1) + ' %' + (iRef ? ' (≈ +' + num(iRef * (m.f - 1), 0) + ' A)' : ''))));
  });
  if (!nodo._duvalLibre) nodo._duvalLibre = '';
  const libreTxt = String(nodo._duvalLibre).trim();
  const libre = Math.round(Number(libreTxt.replace(',', '.')));
  const libreOk = libreTxt !== '' && Number.isFinite(libre) && libre >= 1 && libre <= ESCENARIO_LIBRE_MAX;
  const columnas = [0, ...ESCENARIOS_FIJOS, ...(libreOk ? [libre] : [])].map((x) => escenarioCarga(entrada, calc, porNivel, cg, x, umbrales));
  const fila = (t, f) => el('tr', {}, el('th', { scope: 'row' }, t), columnas.map((c) => el('td', { class: 'cs-num' }, f(c))));
  const input = el('input', { type: 'number', id: 'csDuvalLibre', min: 1, max: ESCENARIO_LIBRE_MAX, step: 1, value: nodo._duvalLibre, 'aria-label': 'Aumento de carga a elegir, en %', class: 'cs-duval-libre' });
  input.addEventListener('change', () => { nodo._duvalLibre = input.value; pintarPanelDuval(nodo, nodo._duvalArgs); });
  const zonaTxt = d.estado === 'ok' ? d.zona + ' en todas: la carga no mueve el punto; solo una muestra nueva lo dice'
    : d.estado === 'no_concluyente' ? 'no concluyente en todas (' + (d.significancia.sobreL1.length ? 'muy pocos ppm para el triángulo' : 'gases de fondo') + '): solo una muestra nueva lo dice'
      : d.estado === 'incoherente' ? 'punto no confiable (los ppm no dan la calificación vigente)' : 'sin punto';
  return caja(
    p('La misma curva horaria medida del rango, aumentada parejo en todas las horas.' + (prov ? ' Cifra provisional: tómelo con reserva.' : '')),
    el('p', { class: 'cs-duval-sub-t' }, '¿Cuánto más aguanta antes de subir de franja?'),
    el('ul', { class: 'cs-dga-grupos cs-duval-margenes' }, margenes),
    el('div', { class: 'cs-tabla-caja', style: 'margin-top:8px' },
      el('table', { class: 'cs-tabla cs-duval-tabla' },
        el('caption', {}, 'Escenarios de carga (criterio del área para el nivel; la tabla es la del panel de arriba).'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, ''), columnas.map((c, i) => el('th', { scope: 'col' }, i === 0 ? 'Hoy' : '+' + num(c.aumentoPct, 0) + ' %')))),
        el('tbody', {},
          fila('Carga (cifra)', (c) => num(c.pct, 1) + ' %'),
          fila('Máx. sostenido ' + CALCULO.sobrecargaMinH + ' h', (c) => (c.max2h == null ? '—' : num(c.max2h, 1) + ' %')),
          fila('Horas sobre el ' + CALCULO.sobrecargaPct + ' % (' + CALCULO.sobrecargaMinH + ' h o más)', (c) => String(c.horasSobre100) + ' h'),
          fila('Pérdidas por corriente', (c) => '×' + num(c.perdidas, 2)),
          fila('Nivel de atención', (c) => (c.fila === 'R0' ? 'carga normal' : palabra(c.nivel && c.nivel.n))),
          el('tr', {}, el('th', { scope: 'row' }, 'Zona de Duval'), el('td', { colspan: columnas.length }, zonaTxt))))),
    el('label', { class: 'cs-campo', for: 'csDuvalLibre', style: 'margin-top:8px;max-width:260px' }, 'Otro aumento (1 a ' + ESCENARIO_LIBRE_MAX + ' %)', input),
    libreTxt !== '' && !libreOk ? p('Escriba un número entero de 1 a ' + ESCENARIO_LIBRE_MAX + '.', 'cs-dga-sub cs-dga-aviso') : null,
    p('Pérdidas por corriente: las del devanado y las conexiones crecen con el cuadrado de la corriente; las del núcleo no cambian. No es una temperatura.'),
    d.estado === 'ok' ? el('p', { class: 'cs-dga-sub' }, el('b', {}, '¿Le afecta la carga? '), d.info.carga) : null,
    p('Capacidad con ventiladores (ONAF): si una etapa no arranca, el margen real es menor.', 'cs-dga-sub cs-dga-aviso'));
}

/**
 * Pinta la sección en `nodo` (un nodo por equipo; se repinta con cada estado del rango).
 * @param {{tx, estado:{estado:string, motivo?:string}, calc?, porNivel?, umbrales?, rango?:string}} args
 */
export function pintarPanelDuval(nodo, args) {
  nodo._duvalArgs = args;
  const d = duvalDeEquipo(args.tx, args.umbrales);
  const abiertos = nodo._duvalAbiertos || (nodo._duvalAbiertos = new Set());
  const focoId = nodo.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null;
  poner(nodo,
    el('div', { class: 'cs-dga-titulo' }, el('h2', { id: 'csDuvalTitulo' }, 'Triángulo de Duval: hoy y con más carga'),
      el('span', { class: 'cs-dga-borrador' }, 'Borrador · pendiente del Ingeniero')),
    args.rango ? el('p', { class: 'cs-ayuda', style: 'margin:0 0 6px' }, 'Carga del rango ' + args.rango + ' (SCADA); gases de la última muestra.') : null,
    el('div', { class: 'cs-dga-medido cs-duval-medido' }, hoy(d), conMasCarga(nodo, args, d)),
    el('details', { class: 'cs-dga-mas', 'data-k': 'como' }, el('summary', { id: 'csDuvalSum-como' }, 'Cómo se calcula'),
      el('ul', { class: 'cs-dga-lista' },
        el('li', {}, 'Triángulo de Duval 1 (aceite mineral) con metano, etileno y acetileno; fronteras de Duval, IEEE Electrical Insulation Magazine 18(3), 2002, Fig. 1 (las mismas de IEEE C57.104-2019 §6.2.3).'),
        el('li', {}, 'Gas suficiente: algún gas en su límite L1 de ' + REFERENCIA_SIGNIFICANCIA.fuente + ' (H₂ 100, CH₄ 75, C₂H₂ 3, C₂H₄ 75, C₂H₆ 75 ppm) y metano + etileno + acetileno de ' + REFERENCIA_SIGNIFICANCIA.sumaMinTriangulo + ' ppm o más (criterio). La norma pide además una velocidad de aumento que con una sola muestra no se puede calcular.'),
        el('li', {}, 'Margen hasta cada franja: cuenta exacta sobre la curva medida aumentada parejo (cifra × f hasta pasar la banda CRG; máximo sostenido de 2 h × f hasta pasar el 100 % o el 130 %).'),
        el('li', {}, 'Nivel de atención: la misma tabla del panel de gases y carga, con los gases de hoy (criterio del área).'))),
    el('details', { class: 'cs-dga-mas', 'data-k': 'limites' }, el('summary', { id: 'csDuvalSum-limites' }, 'Lo que esta vista no puede saber'),
      el('ul', { class: 'cs-dga-lista' },
        el('li', {}, 'A dónde se movería el punto si sube la carga: ninguna norma ni estudio da esa trayectoria; en el papel, el punto se queda en T1 o T2 aunque suba la temperatura (Duval 2002).'),
        el('li', {}, 'Dónde está el defecto ni si está activo o creciendo: hay una sola muestra, sin fecha de toma.'),
        el('li', {}, 'La temperatura del defecto, del aceite o del devanado: el SCADA no trae temperaturas.'),
        el('li', {}, 'Qué carga tenía el equipo cuando se tomó la muestra: el archivo no trae la fecha de toma.'),
        el('li', {}, 'Si los ventiladores estaban en marcha.'))),
    el('details', { class: 'cs-dga-mas', 'data-k': 'saber' }, el('summary', { id: 'csDuvalSum-saber' }, 'Cómo saberlo de verdad'),
      el('ul', { class: 'cs-dga-lista' },
        el('li', {}, 'Tomar una muestra de seguimiento después de un periodo de carga alta, con fecha y ppm de cada gas, y compararla con la anterior: la velocidad de aumento es la única «proyección» medida.'),
        el('li', {}, 'En T3, la resistencia de devanados y la corriente de excitación ayudan a separar una conexión o contacto (sensible a la corriente) del núcleo (sensible a la tensión).'),
        el('li', {}, 'En PD, T1, T2 o T3, el laboratorio puede afinarlo con los Triángulos 4 y 5 de Duval (Duval 2008), que usan también el hidrógeno y el etano: separan, entre otros, las descargas parciales del gaseo del propio aceite a temperatura de servicio, que se parece a PD en el Triángulo 1 y sí crece con la temperatura del aceite.'))),
    el('p', { class: 'cs-ayuda' }, 'Apoya la decisión de operación y de mantenimiento; no autoriza ni prohíbe maniobras.'));
  for (const det of nodo.querySelectorAll('details[data-k]')) {
    const k = det.dataset.k;
    if (abiertos.has(k)) det.open = true;
    det.addEventListener('toggle', () => { if (det.open) abiertos.add(k); else abiertos.delete(k); });
  }
  if (focoId) { const e = document.getElementById(focoId); if (e && e !== document.activeElement) e.focus({ preventScroll: true }); }
  nodo.hidden = false;
}
