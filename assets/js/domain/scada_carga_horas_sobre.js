// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · horas sobre el 100 % y fuerza de la sobrecarga (dominio puro) · 2026-11-17
// ──────────────────────────────────────────────────────────────────────────────
// Lo vio el Ingeniero en vivo (2026-11-17): con «Solo con sobrecarga sostenida» salían equipos con cifra bajo el 100 %.
// Es por definición —la cifra es el p99 (deja fuera su 1 % de horas más altas, ~7 h en un mes) y la sostenida es su
// criterio de 2 h seguidas sobre el 100 % (`99 §122.2`)—, pero confunde. Aprobó tres ajustes («Sí, ajústalo») que NO
// cambian ninguna cifra, marca ni conteo:
//   1. cuántas horas pasó del 100 % el devanado con sostenida. Se cuentan en las horas más altas que el resumen del mes ya
//      guarda (`top`: las TOP_HORAS = 90 de la fase más cargada, horas válidas, serie limpia, `99 §159`), con el mismo medio
//      paso de redondeo de la sostenida (el resumen guarda los amperios a 0,001 A). Si las 90 pasan → «90 h o más»; sin
//      `top` usable (mes cargado antes de §159, nivel sin horas) no se dice nada: nunca se inventa;
//   2. el máximo sostenido sin un redondeo engañoso: si pasa del 100 % pero a 1 decimal se vería «100,0 %», más decimales;
//   3. con el filtro marcado, el orden por la FUERZA de la sobrecarga (máximo sostenido 2 h) y una nota que explica por qué
//      la cifra puede quedar bajo el 100 %.
// Las horas son TODAS las MEDIDAS del mes sobre el 100 % (seguidas o sueltas), no solo las de las rachas de 2 h: el texto lo
// dice. Si el mes dejó horas en servicio sin medida válida (huecos, mes en curso), las que no se midieron también pudieron
// pasar: «al menos N h».
// Suma de circuitos, diferencia de barra y medida común traen su `top` con la misma corriente que su sostenida y su cifra
// (resumen derivado armado con `resumirParaGuardar`; la medida común lo divide como al p99), así que también cuentan.
// Revisión adversarial (2026-11-17): «al menos» con horas sin medir; horas imposibles fuera; el desempate por horas es el
// del devanado que da la fuerza; al desmarcar vuelve SIEMPRE a la cifra (y con el filtro marcado, el orden de respaldo de
// un modo es la fuerza); la regla dice «seguidas» junto a las horas «en total»; el detalle también usa el máximo sin
// redondeo engañoso.
// Funciones PURAS. Archivo NUEVO a propósito (L-102 (3)): solo importa exportaciones ya publicadas, y la lista, la vista,
// la sobrecarga y la historia lo importan sin riesgo (no hay copia vieja en caché a la que le falte algo).
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO } from './scada_carga_config.js';
import { deBytesF32 } from './scada_carga_series.js';

// = TOP_HORAS del importador (`scada_carga_importacion.js`); aquí solo para saber si el `top` de un mes está completo. No
// se importa a propósito: arrastraría todo el importador a la lista (lo mismo hace `scada_carga_periodo.js`).
const TOP_MIN = 90;
// Medio paso de redondeo del resumen guardado (los amperios van a 0,001 A), en puntos de la ampacidad: el de la sostenida.
const tolPct = (A) => (100 * 0.0005) / A;

/** Horas más altas guardadas → lista de números; null si no hay. Acepta lista, Bytes de Firestore o Uint8Array (L-102 (4)). */
function listaTop(t) {
  if (t == null) return null;
  if (Array.isArray(t)) return t;
  if (typeof t.toUint8Array === 'function') return Array.from(deBytesF32(t.toUint8Array()));
  if (t instanceof Uint8Array) return Array.from(deBytesF32(t));
  return null;
}

/**
 * ¿Se midieron TODAS las horas en servicio del mes? Las desenergizadas no cuentan (sin corriente no pasan del 100 %); un hueco
 * o las horas que aún no llegan de un mes en curso sí: pudieron pasar y no se ven. `servicio` se guarda desde el primer
 * importador (antes que `top`); si falta, se mira la cobertura (n ÷ servicio, a 0,001), y sin ninguna de las dos no se da
 * por completo (nunca se afirma una cuenta exacta que no se puede comprobar).
 */
function midioTodo(r, n) {
  if (Number.isFinite(r.servicio)) return n >= r.servicio;
  return Number.isFinite(r.cob) && r.cob >= 1;
}

/**
 * Horas de UN nivel sobre el 100 % de la ampacidad en el mes, contadas en su `top`.
 * @param {object|null} r  resumen del nivel en el mes (con `i.n`, `servicio` y `top`), ya compuesto (suma, diferencia o
 *   medida común)
 * @param {number} A       ampacidad del devanado (A)
 * @returns {null | {horas: number, cota: null|'tope'|'borde'|'parcial'}}
 *   null = sin `top` usable: no se dice nada (mes viejo sin `top`, `top` incompleto, sin horas válidas, sin ampacidad);
 *   horas = las MEDIDAS que pasan del 100 % SEGURO (fuera del medio paso de redondeo);
 *   cota 'tope'    = las horas guardadas pasan todas y el mes tiene más horas válidas: «N h o más»;
 *   cota 'borde'   = alguna hora cae dentro del medio paso de redondeo del 100 %: «al menos N h»;
 *   cota 'parcial' = el mes dejó horas en servicio sin medida válida, que también pudieron pasar: «al menos N h».
 */
export function horasSobreDeNivel(r, A) {
  if (!r || !r.i || !(A > 0)) return null;
  const n = Number(r.i.n) || 0;
  const top = listaTop(r.top);
  if (!n || !top) return null;
  const v = top.filter((x) => typeof x === 'number' && Number.isFinite(x));
  // Un `top` con menos horas de las que debe guardar no alcanza para contar (como en el p99 del periodo).
  if (v.length < Math.min(n, TOP_MIN)) return null;
  const tol = tolPct(A); const SOBRE = CALCULO.sobrecargaPct;
  let seguras = 0; let borde = 0;
  for (const x of v) {
    const pct = (100 * x) / A;
    if (pct - tol > SOBRE) seguras++;
    else if (pct + tol > SOBRE) borde++;
  }
  // Si TODAS las guardadas pasan (o pueden pasar) y el mes tiene más horas válidas, las que no se guardaron también pueden.
  const todas = seguras + borde === v.length && n > v.length;
  // «o más» ya dice que pueden ser más; si no, unas horas sin medir vuelven la cuenta un mínimo («al menos»).
  return { horas: seguras, cota: borde ? 'borde' : (todas ? 'tope' : (midioTodo(r, n) ? null : 'parcial')) };
}

/**
 * Los niveles de una fila de la lista del mes con `horasSobre` donde el resumen trae `top` usable Y alguna hora pasa (o puede
 * pasar por el redondeo) del 100 % (copias nuevas). Los demás, el mismo objeto: una fila sin ninguna hora sobre el 100 %
 * queda idéntica a la de antes (las pruebas de no regresión comparan la lista con `calcularEquipo` campo a campo).
 * Se miran los niveles con devanado, cifra y ampacidad, y SIN horas imposibles (> 3 × ampacidad, las mismas compuertas de
 * `calcularEquipo`): con ellas, su `top` está contaminado y contar sería un número sin sentido. Que el nivel tenga además
 * sostenida (2 h seguidas) lo decide `sobrecargaDeMes`, que solo dice las horas de los niveles que pasan: un nivel con horas
 * sueltas sobre el 100 % y sin racha de 2 h las trae, pero nadie las muestra.
 * @param {Array<object>} niveles      `calcularEquipo(...).niveles`
 * @param {object|null} resumenPorNivel el resumen del mes con que se calculó (el de `componerResumen`)
 */
export function nivelesConHoras(niveles, resumenPorNivel) {
  if (!Array.isArray(niveles) || !resumenPorNivel) return niveles;
  const tope = CALCULO.topeFisicoXAmpacidad * 100;
  return niveles.map((n) => {
    if (!n || !n.devanado || n.pct == null || !(n.A > 0)) return n;
    if (n.picoPct != null && n.picoPct + tolPct(n.A) > tope) return n;
    const h = horasSobreDeNivel(resumenPorNivel[n.nivel], n.A);
    // Solo si alguna hora pasa (o puede pasar): «parcial» con 0 horas no es nada que decir y dejaría la fila distinta.
    return h && (h.horas > 0 || h.cota === 'borde') ? { ...n, horasSobre: h } : n;
  });
}

/**
 * Las horas de un nivel tal como las puede usar la sobrecarga de un mes, o null. Con guarda (L-102 (6)): un nivel de un
 * dominio viejo no las trae; y si dicen menos horas de las de la propia regla (2 h seguidas), algo no cuadra y no se dicen.
 */
export function horasValidas(h) {
  if (!h || typeof h !== 'object' || !Number.isFinite(h.horas) || h.horas < CALCULO.sobrecargaMinH) return null;
  return { horas: h.horas, cota: h.cota === 'tope' || h.cota === 'borde' || h.cota === 'parcial' ? h.cota : null };
}

/**
 * Las horas de UN devanado en varios meses: la suma de las que se conocen.
 * @param {Array<{horas: number, cota: string|null}|null>} porMes  una entrada por mes con sostenida en ese devanado; null =
 *   ese mes no las tiene (sin `top`, o lo decidió la curva del mes)
 * @returns {null | {horas: number, cota: null|'tope'|'falta'}}  null si ningún mes las tiene; 'falta' = algún mes sin horas,
 *   en el borde del redondeo o con horas sin medir («al menos N h»); 'tope' = algún mes llegó a las 90 guardadas («N h o más»)
 */
export function sumarHorasSobre(porMes) {
  const xs = porMes || [];
  const conHoras = xs.map(horasValidas).filter(Boolean);
  if (!conHoras.length) return null;
  const horas = conHoras.reduce((s, h) => s + h.horas, 0);
  const falta = conHoras.length < xs.length || conHoras.some((h) => h.cota === 'borde' || h.cota === 'parcial');
  return { horas, cota: falta ? 'falta' : (conHoras.some((h) => h.cota === 'tope') ? 'tope' : null) };
}

/**
 * «14 h en total sobre el 100 %» · «90 h o más en total sobre el 100 %» · «al menos 40 h en total sobre el 100 %»; '' si no
 * hay horas que decir. «En total»: son todas las horas sobre el 100 %, no solo las de las rachas de 2 h seguidas.
 */
export function textoHorasSobre(h) {
  if (!h || !Number.isFinite(h.horas) || h.horas <= 0) return '';
  const antes = h.cota === 'borde' || h.cota === 'falta' || h.cota === 'parcial' ? 'al menos ' : '';
  const despues = h.cota === 'tope' ? ' o más' : '';
  return antes + h.horas.toLocaleString('es-CO') + ' h' + despues + ' en total sobre el ' + CALCULO.sobrecargaPct + ' %';
}

/** Un número 'es-CO' con `d` decimales, y su valor tal como se lee (para saber qué se VE). */
const conDecimales = (v, d) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const comoSeLee = (t) => Number(t.replace(/\./g, '').replace(',', '.'));

/**
 * Un máximo sostenido en % («119,4 %»). Si pasa del 100 % pero a 1 decimal se vería «100,0 %» (o menos), con los decimales
 * que hagan falta para que se vea que pasó: «100,04 %», y «100,004 %» si con 2 aún no se ve. Lo demás, a 1 decimal.
 */
export function pctSostenidaTxt(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const SOBRE = CALCULO.sobrecargaPct;
  let d = 1;
  // Tope de 6 decimales por si acaso: con la resolución del resumen (0,001 A) basta con 2 o 3.
  if (v > SOBRE) while (d < 6 && comoSeLee(conDecimales(v, d)) <= SOBRE) d++;
  return conDecimales(v, d) + ' %';
}

// ── Orden «por fuerza de la sobrecarga» (solo con el filtro «Solo con sobrecarga sostenida») ─────────────────────────

/** Lo que dice la línea «Ordenado por …» de la tabla. */
export const TEXTO_ORDEN_FUERZA = 'fuerza de la sobrecarga (máximo sostenido ' + CALCULO.sobrecargaMinH + ' h)';
const ORDEN_CIFRA = Object.freeze({ campo: 'pct', dir: 'desc' });
const esOrdenCifra = (o) => !o || (o.campo === ORDEN_CIFRA.campo && o.dir === ORDEN_CIFRA.dir);

/**
 * El orden de la lista al marcar o desmarcar «Solo con sobrecarga sostenida» (lo aprobado: «si el usuario pulsa otra columna,
 * manda su elección; al desmarcar, vuelve a la cifra»). Al marcar, si estaba en el de siempre (la cifra, de mayor a menor),
 * pasa a la fuerza de la sobrecarga; si el usuario eligió otra columna, manda su elección. Al desmarcar, vuelve SIEMPRE a la
 * cifra, también si con el filtro marcado se pulsó otra columna: así, desmarcar y volver a marcar recupera el orden por
 * fuerza (que no tiene cabecera que pulsar). Revisión adversarial: antes, la columna elegida se quedaba al desmarcar y no
 * había cómo volver a la fuerza.
 * También da el orden de respaldo de un modo («Un mes» / «Varios meses») cuya columna no existe: `ordenConSostenida(cifra,
 * marcado)` es la fuerza con el filtro marcado y la cifra sin él.
 * @param {{campo: string, dir: string}} orden
 * @param {boolean} marcado
 */
export function ordenConSostenida(orden, marcado) {
  if (marcado) return esOrdenCifra(orden) ? { campo: 'fuerza', dir: 'desc' } : orden;
  return { ...ORDEN_CIFRA };
}

const devanadosDe = (s) => (s && Array.isArray(s.devanados) ? s.devanados.filter(Boolean) : []);
/** La sobrecarga que muestra la fila: la de hoy; si no tiene, la de antes de un cambio de medida (la que la hace entrar). */
const sobrecargaQueSeVe = (x) => (x && x.sobrecarga && x.sobrecarga.tipo ? x.sobrecarga : (x && x.sobrecargaAnterior) || null);

/** Fuerza de la sobrecarga de una fila: el mayor máximo sostenido 2 h (%) de sus devanados; null si no se sabe (curva). */
export function fuerzaSobrecarga(x) {
  const v = devanadosDe(sobrecargaQueSeVe(x)).map((d) => d.pct).filter((p) => typeof p === 'number' && Number.isFinite(p));
  return v.length ? Math.max(...v) : null;
}

/**
 * Horas sobre el 100 % de la fila para desempatar: las del devanado que da la FUERZA (el de mayor máximo sostenido; si dos
 * empatan, el que más horas tiene), no las de otro devanado más flojo. Revisión adversarial: con «S 105 % y 3 h + P 104 % y
 * 80 h» frente a «S 105 % y 20 h», las 80 h del primario ponían primero al de 3 h en su devanado más fuerte. null si ese
 * devanado no las trae (o si la fuerza no se sabe).
 */
export function horasSobrecarga(x) {
  const f = fuerzaSobrecarga(x);
  if (f == null) return null;
  const v = devanadosDe(sobrecargaQueSeVe(x)).filter((d) => d.pct === f)
    .map((d) => (d.horasSobre && Number.isFinite(d.horasSobre.horas) ? d.horasSobre.horas : null)).filter((h) => h != null);
  return v.length ? Math.max(...v) : null;
}

// = RANGO_CLASE de `scada_carga_vista.js` (no exportado): firme antes que provisional, y estos antes que sin cifra.
const RANGO_CLASE = { firme: 0, provisional: 1, nulo: 2 };
const mayorPrimero = (a, b) => (a == null && b == null ? 0 : (a == null ? 1 : (b == null ? -1 : b - a)));

/**
 * Orden por la FUERZA de la sobrecarga: por clase como siempre (firme · provisional · sin cifra o circuito); dentro, el
 * máximo sostenido 2 h del devanado más alto (de mayor a menor), luego las horas sobre el 100 % de ESE devanado, luego la
 * cifra y por último la matrícula. Lo que no se sabe (devanado decidido por la curva, sin horas) va después de lo que sí. Copia nueva.
 */
export function ordenarPorFuerza(filas) {
  const k = new Map((filas || []).map((x) => [x, { c: RANGO_CLASE[x && x.clase] ?? 3, f: fuerzaSobrecarga(x), h: horasSobrecarga(x) }]));
  return [...(filas || [])].sort((a, b) => {
    const ka = k.get(a); const kb = k.get(b);
    return ka.c - kb.c || mayorPrimero(ka.f, kb.f) || mayorPrimero(ka.h, kb.h) || mayorPrimero(a.pct, b.pct)
      || String(a.matricula).localeCompare(String(b.matricula));
  });
}

/**
 * La nota que se ve con el filtro marcado: por qué un equipo puede tener cifra bajo el 100 % y aun así sobrecarga sostenida.
 * @param {boolean} periodo  «Varios meses»: la carga del periodo es el p99 de TODAS sus horas
 * @returns {{titulo: string, texto: string}}
 */
export function notaSostenida(periodo) {
  const h = CALCULO.sobrecargaMinH; const p = CALCULO.sobrecargaPct;
  if (periodo) {
    return {
      titulo: 'Carga del periodo bajo el ' + p + ' % y aun así con sobrecarga sostenida: ',
      // «De los meses con sobrecarga sostenida»: lo que suma `sobrecargaDelPeriodo` (revisión adversarial: «esos meses» no
      // decía cuáles).
      texto: 'la carga del periodo es el p99 de todas sus horas, que deja fuera su 1 % más alto (unas 7 horas por cada mes); '
        + 'la sobrecarga sostenida mira si hubo ' + h + ' h seguidas sobre el ' + p + ' % en algún mes. Las horas sobre el ' + p
        + ' % que se indican son todas las medidas en los meses con sobrecarga sostenida, seguidas o sueltas.'
    };
  }
  return {
    titulo: 'Cifra bajo el ' + p + ' % y aun así con sobrecarga sostenida: ',
    texto: 'la cifra es el p99 del mes, que deja fuera su 1 % de horas más altas (unas 7 en un mes completo); la sobrecarga '
      + 'sostenida mira si hubo ' + h + ' h seguidas sobre el ' + p + ' % en cualquier momento del mes. Las horas sobre el ' + p
      + ' % que se indican son todas las medidas en el mes, seguidas o sueltas.'
  };
}
