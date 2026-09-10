// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · Acciones de mantenimiento escogibles
// ─────────────────────────────────────────────────────────────────────────────
// El alcance del documento de Mantenimiento Especializado ya no es un texto
// cerrado: el Ingeniero escoge QUÉ acciones se ejecutan y la redacción se
// compone con esa selección. Este módulo arma la lista de lo que puede escoger.
//
// ── DE DÓNDE SALEN LAS ACCIONES (y por qué importa el orden) ─────────────────
// Hay dos fuentes y NO valen lo mismo:
//   1. Las REGISTRADAS para el equipo (su macroactividad/subactividades en Salud
//      de Activos). Son el plan de récord: vienen marcadas por defecto.
//   2. El CATÁLOGO oficial `MO.00418 §4.3` de su condición. Son lo que la norma
//      contempla para esa banda y el equipo todavía no tiene: se ofrecen sin
//      marcar, para añadir.
// Cuando el equipo no trae acciones registradas, `nucleoFicha` sustituye por la
// línea base de la condición y lo rotula como referencial; ese origen viaja
// hasta aquí para que la ficha pueda decir de dónde salió cada renglón. Fabricar
// un plan y presentarlo como registrado sería exactamente lo que ADR-066 prohíbe.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

import { MACROACTIVIDADES_BASELINE, SUBACTIVIDADES_BASELINE } from './catalogos_baseline.js';

/** Normaliza para comparar: sin tildes, sin dobles espacios, en mayúsculas. */
export function normalizarAccion(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Identificador estable de una acción, para guardar la selección sin depender
 * de la posición en la lista (que cambia según lo que traiga el equipo).
 */
export function idAccion(s) {
  return normalizarAccion(s).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/** Palabras que no distinguen una acción de otra. */
const VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'O', 'POR', 'CON', 'A', 'EN', 'SU']);

/**
 * Huella de contenido de una acción: sus palabras significativas, sin números.
 * Sirve para detectar la MISMA acción escrita de dos formas — el registro de
 * Salud de Activos dice «PLAN DE MITIGACION POR SOBRECARGA» y el catálogo dice
 * «Plan de mitigación sobrecarga 90-110 %». Ofrecer las dos, una marcada y otra
 * no, invita a contratar dos veces el mismo trabajo.
 */
export function huellaAccion(s) {
  return new Set(normalizarAccion(s).split(/[^A-Z0-9]+/)
    .filter((w) => w && !VACIAS.has(w) && !/^[0-9]+$/.test(w)));
}

/** ¿La menor está contenida en la mayor? Entonces nombran la misma acción. */
function mismaAccion(a, b) {
  const [chica, grande] = a.size <= b.size ? [a, b] : [b, a];
  if (chica.size < 2) return false;          // una sola palabra distingue poco
  for (const w of chica) if (!grande.has(w)) return false;
  return true;
}

/**
 * Quita del nombre del catálogo el paréntesis de PERIODICIDAD, y solo ese.
 *
 * El encargo prohíbe desarrollar frecuencias, así que se ofrece la actividad y
 * no su ciclo. Pero antes se recortaba TODO paréntesis final, y eso se comía
 * calificativos de proceso: «Regeneración aceite (frío)» salía como
 * «Regeneración aceite», indistinguible en la prosa firmada de la regeneración
 * completa de la banda 4 — que es otro trabajo y otro precio.
 */
function sinPeriodicidad(nombre) {
  return String(nombre || '')
    .replace(/\s*\((?:diaria|semanal|quincenal|mensual|bimestral|trimestral|cuatrimestral|semestral|anual|bienal)\)\s*$/i, '')
    .trim();
}

/** Subactividades que el catálogo oficial asigna a una condición. */
export function catalogoCondicion(ci) {
  if (ci == null) return [];
  return SUBACTIVIDADES_BASELINE
    .filter((x) => x.condicion_objetivo === ci)
    .map((x) => ({ codigo: x.codigo, nombre: sinPeriodicidad(x.nombre),
                   mitigacion: !!x.mitigacion }));
}

/**
 * El catálogo `MO.00418 §4.3` ENTERO, agrupado por macroactividad.
 *
 * Encargo del Ingeniero (2026-09-10): *«aquí me gustaría que aparezcan todas
 * las macroactividades por condición»*. Hasta ahora el selector solo ofrecía la
 * banda del equipo, así que un correctivo menor que conviniera adelantar —o una
 * mitigación de otra banda— no estaba a la vista siquiera para descartarla.
 *
 * El orden es el de la norma leída de arriba abajo: cada condición con su
 * macroactividad y, pegada a ella, su mitigación cuando la tiene (C3 y C4).
 *
 * @returns {Array<{codigo:string, nombre:string, condicion:number,
 *                  referencia:string, esMitigacion:boolean,
 *                  subs:Array<{codigo:string, nombre:string, mitigacion:boolean}>}>}
 */
export function macroactividadesCatalogo() {
  const de = (cod) => MACROACTIVIDADES_BASELINE.find((m) => m.codigo === cod);
  const orden = ['MACRO-PSM', 'MACRO-ST', 'MACRO-CM', 'MACRO-MIT-C3',
                 'MACRO-CMA', 'MACRO-MIT-C4', 'MACRO-REP'];
  return orden.map(de).filter(Boolean).map((m) => ({
    codigo: m.codigo,
    nombre: m.nombre,
    condicion: m.condicion_objetivo,
    referencia: m.referencia || '',
    esMitigacion: /^MACRO-MIT/.test(m.codigo),
    subs: (m.subactividades || []).map((cod) => {
      const x = SUBACTIVIDADES_BASELINE.find((y) => y.codigo === cod);
      if (!x) return null;
      // El nombre del catálogo lleva la periodicidad entre paréntesis; el
      // encargo prohíbe desarrollar frecuencias, así que se ofrece la
      // actividad y no su ciclo (mismo criterio que `catalogoCondicion`).
      return { codigo: x.codigo, mitigacion: !!x.mitigacion,
               nombre: String(x.nombre).replace(/\s*\([^)]*\)\s*$/, '').trim() };
    }).filter(Boolean)
  }));
}

/**
 * Línea base de una condición: qué propone la norma cuando el equipo NO trae
 * macroactividad registrada en Salud de Activos. Siempre referencial.
 *
 * Son las subactividades de la macroactividad PRINCIPAL de esa banda —no las
 * de su mitigación—. La mitigación se ofrece en el selector pero NO se marca
 * sola: depende de la causa, no de la banda, y marcarla por defecto metería
 * «aumento de caudal de refrigeración» en el alcance de todo equipo en
 * condición 3 sin que nadie lo haya decidido.
 *
 * Sustituye a la lista escrita a mano que vivía en `ficha-tecnica.js`
 * (`LINEA_BASE_POR_CONDICION`): eran DOS catálogos para lo mismo, y el de a
 * mano mezclaba bandas —por eso un equipo de condición 2 aparecía con marcas
 * en C1 y C3 y ninguna en la suya—. El agujero peor lo tenía la condición 5:
 * sus dos únicas actividades eran inversión, así que un activo en fin de vida
 * sin plan registrado se quedaba con el alcance VACÍO. Decisión del Ingeniero,
 * 2026-09-10, con el antes/después a la vista.
 *
 * @param {number|null} ci condición 1-5
 * @returns {string[]} nombres de las subactividades, en el orden de la norma
 */
export function lineaBaseCondicion(ci) {
  if (ci == null) return [];
  const m = macroactividadesCatalogo()
    .find((x) => x.condicion === ci && !x.esMitigacion);
  return m ? m.subs.map((s) => s.nombre) : [];
}

/**
 * Lista completa de acciones escogibles para un equipo.
 *
 * @param {number|null} ci  condición de salud 1–5.
 * @param {Array<{s:string, cat:string}>} registradas  acciones que ya trae el
 *        equipo (salida de `nucleoFicha`), en su orden de prioridad.
 * @param {boolean} esLineaBase  true si `registradas` NO son del registro sino
 *        la línea base de la condición (lo dice `nucleoFicha().baseUsada`).
 * @param {Function} clasificar  clasificador funcional de la acción (INV/MIT/…).
 * @returns {Array<{id:string, txt:string, cat:string, origen:string, mitigacion:boolean}>}
 *   `origen`: 'registro' · 'base' · 'catalogo'. Las dos primeras van marcadas
 *   por defecto; la tercera se ofrece para añadir.
 */
export function accionesDisponibles(ci, registradas, esLineaBase, clasificar, opts) {
  const cls = typeof clasificar === 'function' ? clasificar : () => 'DIAG';
  const huellas = [];
  const salida = [];
  const yaEsta = (txt) => {
    const h = huellaAccion(txt);
    if (huellas.some((v) => mismaAccion(v, h))) return true;
    huellas.push(h);
    return false;
  };

  for (const r of (Array.isArray(registradas) ? registradas : [])) {
    const txt = String(r && r.s != null ? r.s : r || '').trim();
    if (!txt || yaEsta(txt)) continue;
    salida.push({
      id: idAccion(txt), txt, cat: r && r.cat ? r.cat : cls(txt),
      origen: esLineaBase ? 'base' : 'registro', mitigacion: false
    });
  }

  // MODO COMPLETO (`opts.todasLasCondiciones`): se ofrece el catálogo ENTERO
  // agrupado por macroactividad, no solo la banda del equipo. Aquí NO se
  // deduplica contra lo registrado: un grupo con huecos se leería como un error
  // del sistema, no como que ese renglón ya está marcado más arriba. La norma
  // repite dos subactividades en C1 y C2 («Pruebas eléctricas», «Inspección
  // ocular detallada»); comparten `id` a propósito, porque son la MISMA acción,
  // y quien las pinte debe mantenerlas sincronizadas.
  if (opts && opts.todasLasCondiciones) {
    for (const m of macroactividadesCatalogo()) {
      for (const sub of m.subs) {
        salida.push({
          id: idAccion(sub.nombre), txt: sub.nombre, codigo: sub.codigo,
          cat: sub.mitigacion ? 'MIT' : cls(sub.nombre),
          origen: 'catalogo', mitigacion: sub.mitigacion,
          macro: m.codigo, macroNombre: m.nombre, cond: m.condicion,
          referencia: m.referencia, esMitigacion: m.esMitigacion
        });
      }
    }
    return salida;
  }

  for (const c of catalogoCondicion(ci)) {
    if (yaEsta(c.nombre)) continue;
    // Que una subactividad sea de mitigación lo dice el CATÁLOGO, no una
    // heurística sobre su nombre: se respeta esa marca antes de clasificar.
    salida.push({
      id: idAccion(c.nombre), txt: c.nombre, codigo: c.codigo,
      cat: c.mitigacion ? 'MIT' : cls(c.nombre),
      origen: 'catalogo', mitigacion: c.mitigacion
    });
  }

  return salida;
}

/**
 * ¿Esta acción es INVERSIÓN? Orden del Ingeniero (2026-09-09): «todo lo
 * referente a inversión queda en PI», así que el documento de Mantenimiento
 * Especializado no la ofrece.
 *
 * Se decide con una lista EXPLÍCITA y no con la categoría funcional, que es
 * demasiado gruesa para esto: `clasificarAccion` mandaba a «INV» cualquier cosa
 * que dijera «reemplazo», y reemplazar un buje es correctivo mayor, no
 * inversión. Lo que sí lo es: crear o sustituir capacidad de transformación.
 */
export function esInversion(txt) {
  return /PLAN DE INVERSION|\bPI\b|REPOSICION|REEMPLAZO (DEL? |DE LA )?(TRANSFORMADOR|UNIDAD|ACTIVO)|AUMENTO DE CAPACIDAD DE TRANSFORMACION|INSTALACION (DE )?UNIDAD|REPOTENCIACION/
    .test(normalizarAccion(txt));
}

/**
 * Los ids que van marcados de entrada.
 *
 * DOS reglas, porque las dos fuentes NO valen lo mismo:
 *
 *  · **Plan REGISTRADO** (`origen:'registro'`): es el plan de récord del
 *    equipo, aprobado por alguien. Se marca entero.
 *  · **LÍNEA BASE** (`origen:'base'`): es REFERENCIAL. El `MO.00418 §4.3`
 *    lista por banda lo que PUEDE aplicar, no lo que todo equipo de esa banda
 *    necesita. Marcarla entera convierte un menú en un contrato: en condición
 *    3 contrataría a la vez secado de aceite, regeneración de aceite y
 *    recuperación de aislamientos —tratamientos ALTERNATIVOS del mismo aceite
 *    y del mismo papel—, y en condición 5 prometería recuperar el aislamiento
 *    de un activo que el propio documento declara irrecuperable. Así que se
 *    marca solo lo de DIAGNÓSTICO y verificación: lo que se hace siempre y no
 *    compromete plata de intervención. Lo intrusivo se ofrece SIN marcar y se
 *    escoge contra el hallazgo — que es justo lo que la plantilla del alcance
 *    afirma («cada actividad se escoge contra la variable que la motiva»).
 *    En C1 y C2, que son programas de seguimiento, todo es diagnóstico: se
 *    marcan enteras, como antes.
 *
 * Si no queda nada marcado, la plantilla cae sola en su texto de reserva
 * («las acciones que se definan según los resultados del diagnóstico»), que es
 * lo único cierto en ese momento. Un alcance vacío NO es un agujero.
 */
export function seleccionPorDefecto(acciones) {
  const propias = (Array.isArray(acciones) ? acciones : [])
    .filter((a) => a.origen !== 'catalogo');
  if (propias.some((a) => a.origen === 'registro')) return propias.map((a) => a.id);
  return propias.filter((a) => a.cat === 'DIAG').map((a) => a.id);
}

/**
 * Las acciones escogidas, en prosa, para inyectar en la plantilla del alcance.
 *
 * El catálogo viene en MAYÚSCULAS de fuente («CORRECCION DE FUGAS POR
 * ACCESORIOS»); dentro de una frase eso grita. Se pasa a minúscula respetando
 * las siglas que sí van en mayúscula, y se cierra la enumeración con «y».
 *
 * @param {Array<{txt:string}>} escogidas
 * @returns {string} '' si no hay ninguna — quien llame decide qué hacer con eso.
 */
export function prosaAcciones(escogidas) {
  // Se decide RUN POR RUN de letras, no palabra por palabra: «OLTC/NLTC» son
  // dos siglas en un mismo token, y «(PI)» va entre paréntesis. Bajar el token
  // entero convertiría ambos en «oltc/nltc» y «(pi)» dentro de un documento
  // que se firma.
  const SIGLAS = new Set(['PI', 'OLTC', 'NLTC', 'DPS', 'SCADA', 'DGA', 'AT', 'MT', 'BT', 'TX', 'ONAN', 'ONAF']);
  const partes = (Array.isArray(escogidas) ? escogidas : [])
    .map((a) => String(a && a.txt != null ? a.txt : a || '').trim())
    .filter(Boolean)
    .map((t) => t.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (run) =>
      (run === run.toLocaleUpperCase('es') && SIGLAS.has(run.toLocaleUpperCase('es')))
        ? run : run.toLocaleLowerCase('es')));

  if (!partes.length) return '';
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}
