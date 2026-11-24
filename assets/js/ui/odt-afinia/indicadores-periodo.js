// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · el bloque «Periodo (fecha prevista)»
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): «necesito que también exista un calendario para yo poder escoger a mi voluntad
// periodos a lo largo del año 2026». En la vista de un corte, junto a los filtros:
//   · «Periodo rápido» (un selector, que se usa con el teclado): sin periodo, «Este mes», «Mes pasado», todo 2026, cada
//     mes, cada trimestre y cada semestre. Al elegir uno se llenan «Desde» y «Hasta»;
//   · «Desde» y «Hasta»: dos campos de fecha con el calendario del navegador, solo días de 2026 (min/max). Uno vacío
//     deja ese lado abierto. Si se escriben a mano, el selector muestra el periodo rápido que coincide (o «Fechas a la medida»);
//   · una línea clara si el periodo no se aplica (Desde después de Hasta, una fecha fuera de 2026 o a medio escribir).
//     Las fechas se leen con «input» y «change» y también al soltar una tecla y al salir del campo (Chrome no avisa al
//     vaciar una fecha con la tecla de borrar ni al escribir solo el día).
// El periodo filtra por la FECHA PREVISTA DE INICIO de cada ODT (dominio: odt_afinia_indicadores_periodo.js). Este
// bloque no se repinta al cambiar una fecha (la vista solo repinta lo de abajo): el foco se queda en el campo.
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h } from './comun.js';
import { fechaBogota } from '../../domain/odt_afinia_textos.js';
import {
  PERIODO_MIN, PERIODO_MAX, SIN_PERIODO, GRUPOS_RAPIDOS, CLAVE_MEDIDA, periodosRapidos, validarPeriodo, rapidoDe, leerFecha
} from '../../domain/odt_afinia_indicadores_periodo.js';

export const TITULO_PERIODO = 'Periodo (fecha prevista)';
export const AYUDA_PERIODO = 'Cuenta las ODT por su fecha prevista de inicio (la misma con la que Afinia arma el informe); los dos días se incluyen. Deje «Desde» o «Hasta» vacío para no poner ese límite.';
export const TEXTO_SIN_PERIODO = 'Sin periodo (todas las fechas)';
export const TEXTO_MEDIDA = 'Fechas a la medida';
export const IDS_PERIODO = Object.freeze({
  rapido: 'odtIndPeriodoRapido', desde: 'odtIndDesde', hasta: 'odtIndHasta', ayuda: 'odtIndPeriodoAyuda', error: 'odtIndPeriodoError'
});

/** Hoy en Colombia, 'aaaa-mm-dd' ('' si no se puede saber: entonces no salen «Este mes» ni «Mes pasado»). */
export function hoyEnColombia(instante = new Date()) {
  try { return leerFecha(fechaBogota(instante)) || ''; } catch (_) { return ''; }
}

/**
 * Arma el bloque. `alCambiar` recibe el periodo validado ({desde, hasta, activo, error}) cada vez que cambia.
 * @param {{alCambiar:(periodo:object)=>void, hoy?:string}} p
 * @returns {{elemento:HTMLElement, periodo:()=>object, poner:(p:{desde:string, hasta:string})=>void, limpiar:()=>void,
 *            enfocar:()=>void, rapidos:ReadonlyArray<object>}}
 */
export function crearBloquePeriodo({ alCambiar, hoy } = {}) {
  const rapidos = periodosRapidos(hoy == null ? hoyEnColombia() : hoy);
  const id = IDS_PERIODO;
  const rapido = h('select', { id: id.rapido, class: 'odt-campo', 'aria-describedby': id.ayuda },
    h('option', { value: '', text: TEXTO_SIN_PERIODO }),
    // Solo se muestra cuando las fechas escritas no son un periodo rápido: no se elige de la lista.
    h('option', { value: CLAVE_MEDIDA, text: TEXTO_MEDIDA, disabled: true }),
    GRUPOS_RAPIDOS.map((g) => {
      const xs = rapidos.filter((r) => r.grupo === g);
      return xs.length ? h('optgroup', { label: g }, xs.map((r) => h('option', { value: r.clave, text: r.texto }))) : null;
    }));
  const fecha = (idCampo) => h('input', {
    id: idCampo, type: 'date', class: 'odt-campo odt-ind-fecha', min: PERIODO_MIN, max: PERIODO_MAX,
    'aria-describedby': id.ayuda + ' ' + id.error
  });
  const desde = fecha(id.desde);
  const hasta = fecha(id.hasta);
  // role=status (no alert): mientras se escribe el año, el aviso puede cambiar varias veces; no interrumpe.
  const error = h('p', { id: id.error, class: 'odt-ind-periodo-error', role: 'status' });
  const elemento = h('fieldset', { class: 'odt-ind-periodo' },
    h('legend', { class: 'odt-ind-periodo-titulo', text: TITULO_PERIODO }),
    // Sin consultas de contenedor aquí: dentro de un fieldset, Chrome dejaba sin dibujar los campos al aparecer o irse
    // la línea del error (medido en el arnés). La rejilla se acomoda sola al ancho (CSS: auto-fit).
    h('div', { class: 'odt-ind-periodo-campos' },
      h('div', { class: 'odt-campo-fila odt-ind-periodo-rapido' }, h('label', { htmlFor: id.rapido, text: 'Periodo rápido' }), rapido),
      h('div', { class: 'odt-ind-periodo-fechas' },
        h('div', { class: 'odt-campo-fila odt-ind-periodo-fecha' }, h('label', { htmlFor: id.desde, text: 'Desde' }), desde),
        h('div', { class: 'odt-campo-fila odt-ind-periodo-fecha' }, h('label', { htmlFor: id.hasta, text: 'Hasta' }), hasta))),
    h('p', { id: id.ayuda, class: 'odt-mini odt-ind-periodo-ayuda', text: AYUDA_PERIODO }),
    error);

  /** Un campo a medio escribir (o con un día que no existe) entrega '' y lo marca el navegador. */
  const ilegible = (el) => !!(el && el.validity && el.validity.badInput === true);
  const leer = () => validarPeriodo({ desde: desde.value, hasta: hasta.value, ilegible: { desde: ilegible(desde), hasta: ilegible(hasta) } });
  const huella = (p) => [p.desde, p.hasta, p.error].join('|');
  let actual = { ...SIN_PERIODO };
  /**
   * Aplica lo escrito si cambió; `sincronizar`: el selector pasa al periodo rápido que coincide (al escribir las fechas
   * a mano). Si nada cambió no toca nada: el navegador avisa con «input» y con «change», y además se vuelve a leer al
   * soltar una tecla y al salir del campo; así se recalcula una sola vez y pasar por un campo con Tab no cambia el
   * selector (p. ej. «Este mes» no pasa a «Noviembre 2026»).
   */
  function aplicar(sincronizar) {
    const p = leer();
    if (huella(p) === huella(actual)) return;
    error.textContent = p.error;
    if (sincronizar) rapido.value = p.error ? CLAVE_MEDIDA : rapidoDe(p, rapidos);
    actual = p;
    if (typeof alCambiar === 'function') alCambiar(p);
  }
  for (const el of [desde, hasta]) {
    el.addEventListener('change', () => aplicar(true));
    el.addEventListener('input', () => aplicar(true));
    // Chrome no avisa con «input» ni con «change» en dos casos: al vaciar una fecha con la tecla de borrar (solo avisa
    // en el primer borrado, con el campo «a medio escribir») y al escribir solo una parte (el día) en un campo vacío. Por
    // eso se vuelve a leer al soltar cada tecla y al salir del campo: un campo vaciado deja ese lado abierto (y se va la
    // línea de error), y uno a medio escribir lo dice.
    el.addEventListener('keyup', () => aplicar(true));
    el.addEventListener('blur', () => aplicar(true));
  }
  rapido.addEventListener('change', () => {
    const r = rapidos.find((x) => x.clave === rapido.value);
    if (!r && rapido.value !== '') { aplicar(true); return; }
    desde.value = r ? r.desde : ''; hasta.value = r ? r.hasta : '';
    aplicar(false);
  });

  return {
    elemento, rapidos,
    periodo: () => actual,
    /** Pone unas fechas (p. ej. el mes pulsado en el gráfico) y avisa el cambio. */
    poner(p) {
      desde.value = (p && p.desde) || ''; hasta.value = (p && p.hasta) || '';
      aplicar(true);
    },
    /** Sin periodo (lo usa «Quitar filtros», que repinta por su cuenta: aquí no se avisa). */
    limpiar() {
      desde.value = ''; hasta.value = ''; rapido.value = ''; error.textContent = '';
      actual = { ...SIN_PERIODO };
    },
    enfocar() { if (typeof rapido.focus === 'function') { try { rapido.focus(); } catch (_) { /* sin foco */ } } }
  };
}
