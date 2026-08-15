// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · UNIFILAR (Diagrama Actual / Futuro)
// ──────────────────────────────────────────────────────────────
// Porta `buildUnifilar` + el estado de diagramas del módulo suelto
// `Modulo_Fichas_Tecnicas_v22.html` (v22.1) al repo, como módulo ES6
// SIN dependencias: no toca el DOM, no lee Firestore, no usa `window`.
// Devuelve texto (SVG) y objetos planos; quien pinta es la página.
//
// REGLA DE ORO DEL MÓDULO (pedido explícito del dueño — no se puede perder):
//   El DIAGRAMA ACTUAL y el DIAGRAMA FUTURO son INDEPENDIENTES.
//   Cada uno tiene su propio juego de parámetros, su propio SVG y sus
//   propias notas, de modo que el futuro puede reflejar el equipo
//   propuesto (otra potencia, otra regulación, otro grupo de conexión)
//   sin alterar el diagrama de la situación actual. El estado se guarda
//   POR EQUIPO y POR DIAGRAMA.
//   La única pasarela entre ambos es `copiarActualAFuturo()`, que copia
//   los parámetros técnicos y NUNCA pisa las notas del futuro.
//
// DIFERENCIAS DELIBERADAS CON EL MÓDULO ORIGINAL (mejoras, no cambios de forma):
//   1. El original identificaba el equipo por `fila` (índice de una hoja de
//      cálculo). Aquí la clave se deriva del equipo (id · codigo · matrícula…)
//      porque los datos ya vienen de Firestore, no de un Excel.
//   2. `parametrosDiagrama()` devuelve una COPIA: el estado sólo se cambia
//      por `fijarParametro()` / `copiarActualAFuturo()`. Así ningún render
//      puede corromper el estado por descuido.
//   3. Los nombres de diagrama son 'actual' | 'futuro' (antes 'diagA'/'diagF');
//      se aceptan los antiguos como alias para no romper un porte parcial.
//
// El SVG se emite con colores literales A PROPÓSITO: el mismo texto se
// serializa a PNG (canvas) para incrustarlo en la plantilla oficial, y ahí
// no existe la hoja de estilos del sitio — un `var(--ftm-…)` saldría negro.
// ══════════════════════════════════════════════════════════════

/** Paleta del unifilar (institucional del formato de planificación). */
export const PALETA_UNIFILAR = Object.freeze({
  rojo:  '#7a1f1f',   // rótulos del equipo
  verde: '#2E7D00',   // lado de alta / devanado primario
  ambar: '#C77F0A',   // lado de media / barra y salidas
  gris:  '#44555F'    // impedancia y flecha del cambiador bajo carga
});

/** Campos editables de un diagrama, en el orden en que se muestran. */
export const CAMPOS_DIAGRAMA = Object.freeze([
  'matricula',  // matrícula del equipo
  'potONAN',    // potencia ONAN (MVA)
  'potONAF',    // potencia ONAF (MVA)
  'grupo',      // grupo de conexión (Dyn11, YNyn0…)
  'imped',      // impedancia de cortocircuito (%)
  'kvPrim',     // tensión primaria (kV)
  'kvSec',      // tensión secundaria (kV)
  'reg'         // regulación: OLTC / NLTC / FIJO
]);

/** Los dos diagramas independientes. */
export const DIAGRAMAS = Object.freeze(['actual', 'futuro']);

/** Etiqueta para la cabecera de cada hoja. */
export const TITULO_DIAGRAMA = Object.freeze({
  actual: 'DIAGRAMA ACTUAL',
  futuro: 'DIAGRAMA FUTURO'
});

// ── utilidades internas ───────────────────────────────────────

/** Escapa texto para incrustarlo en el SVG/HTML. */
function esc(x) {
  return (x == null ? '' : String(x))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Lee la primera ruta con valor útil ('a.b.c' admitido). */
function leer(obj, ...rutas) {
  for (const ruta of rutas) {
    let v = obj;
    for (const paso of String(ruta).split('.')) {
      if (v == null || typeof v !== 'object') { v = undefined; break; }
      v = v[paso];
    }
    if (v != null && v !== '') return v;
  }
  return null;
}

/** Convierte a texto plano (los inputs escriben strings; Firestore, números). */
function texto(v) {
  return (v == null || v === '') ? '' : String(v);
}

/** kVA → MVA en texto corto (2000 → "2", 31500 → "31.5"). */
function mvaDesdeKva(kva) {
  const n = Number(kva);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mva = n / 1000;
  return String(Math.round(mva * 1000) / 1000);
}

/**
 * Normaliza el nombre del diagrama.
 * Acepta 'actual'|'futuro' y los alias del módulo original 'diagA'|'diagF'.
 */
export function normalizarDiagrama(cual) {
  const c = String(cual == null ? '' : cual).trim().toLowerCase();
  if (c === 'futuro' || c === 'diagf' || c === 'f') return 'futuro';
  return 'actual';
}

/**
 * Clave de estado del equipo. El módulo original usaba la fila del Excel;
 * aquí se prefiere el identificador real del documento.
 * @param {object|string|number} equipo
 * @returns {string} clave estable, '' si no hay nada identificable
 */
// Clave de respaldo por objeto: si un equipo no trae NINGÚN identificador, dos
// equipos distintos compartirían la clave '' y editar el diagrama de uno pisaría
// el del otro. Se le asigna entonces una clave propia, atada a esa instancia.
const CLAVES_ANONIMAS = new WeakMap();
let contadorAnonimo = 0;

export function claveEquipo(equipo) {
  if (equipo == null) return '';
  if (typeof equipo === 'string' || typeof equipo === 'number') return String(equipo);
  const k = leer(equipo,
    'id', 'codigo', 'identificacion.codigo', 'matricula', 'identificacion.matricula',
    'serie', 'identificacion.numero_serie', 'fila');
  if (k != null) return String(k);
  if (typeof equipo !== 'object') return '';
  if (!CLAVES_ANONIMAS.has(equipo)) {
    CLAVES_ANONIMAS.set(equipo, `sin-id:${++contadorAnonimo}`);
  }
  return CLAVES_ANONIMAS.get(equipo);
}

// ── estado por equipo y por diagrama ──────────────────────────
// Map<claveEquipo, { actual:{…}, futuro:{…} }>. Vive en memoria: es el
// borrador de la sesión. Persistirlo (Firestore) es responsabilidad de
// quien llame — para eso están `exportarDiagramas` / `importarDiagramas`.
const ESTADO = new Map();

/**
 * Semilla de un diagrama a partir de los datos reales del equipo.
 * Ambos diagramas arrancan igual; a partir de ahí cada uno evoluciona solo.
 */
function semilla(equipo) {
  const e = (equipo && typeof equipo === 'object') ? equipo : {};
  // Las potencias de PLACA viajan en kVA en el esquema v2; el unifilar habla MVA.
  // Por eso cada origen se lee por separado: nunca se adivina la unidad.
  const onanMva = leer(e, 'potONAN', 'mva_onan');
  const onanKva = leer(e, 'potencia_onan_kva', 'placa.potencia_onan_kva');
  const onafMva = leer(e, 'potONAF', 'mva_onaf', 'mva');
  const onafKva = leer(e, 'potencia_onaf_kva', 'placa.potencia_onaf_kva',
                          'potencia_kva', 'placa.potencia_kva');
  return {
    matricula: texto(leer(e, 'matricula', 'identificacion.matricula', 'codigo')),
    potONAN: onanMva != null ? texto(onanMva) : mvaDesdeKva(onanKva),
    potONAF: onafMva != null ? texto(onafMva) : mvaDesdeKva(onafKva),
    grupo: texto(leer(e, 'grupo_conexion', 'electrico.grupo_conexion')),
    imped: texto(leer(e, 'impedancia_cc_pct', 'electrico.impedancia_cc_pct')),
    kvPrim: texto(leer(e, 'kv_prim', 'tension_primaria_kv', 'electrico.tension_primaria_kv')),
    kvSec: texto(leer(e, 'kv_sec', 'tension_secundaria_kv', 'electrico.tension_secundaria_kv')),
    // Editable: el diagrama futuro puede proponer otro tipo de regulación.
    reg: texto(leer(e, 'regulacion', 'tipo_tap', 'electrico.tipo_tap')),
    notas: ''
  };
}

/** Contenedor {actual, futuro} del equipo, creándolo con su semilla. */
function contenedor(equipo) {
  const k = claveEquipo(equipo);
  let cont = ESTADO.get(k);
  if (!cont) {
    cont = { actual: semilla(equipo), futuro: semilla(equipo) };
    ESTADO.set(k, cont);
  }
  return cont;
}

/**
 * Parámetros vigentes de UN diagrama del equipo (copia).
 * Si es la primera vez, se siembran con los datos reales del equipo.
 * @param {object} equipo  registro del transformador
 * @param {'actual'|'futuro'} cual
 * @returns {object} {matricula, potONAN, potONAF, grupo, imped, kvPrim, kvSec, reg, notas}
 */
export function parametrosDiagrama(equipo, cual) {
  return { ...contenedor(equipo)[normalizarDiagrama(cual)] };
}

/**
 * Fija UN parámetro de UN diagrama. No afecta al otro diagrama.
 * @param {object} equipo
 * @param {'actual'|'futuro'} cual
 * @param {string} clave  uno de CAMPOS_DIAGRAMA, o 'notas'
 * @param {*} valor
 * @returns {object} los parámetros ya actualizados (copia), listos para redibujar
 */
export function fijarParametro(equipo, cual, clave, valor) {
  const w = normalizarDiagrama(cual);
  const d = contenedor(equipo)[w];
  if (clave === 'notas' || CAMPOS_DIAGRAMA.includes(clave)) {
    d[clave] = texto(valor);
  } else {
    console.warn('[fichas/unifilar] campo de diagrama desconocido:', clave);
  }
  return { ...d };
}

/**
 * Copia los parámetros TÉCNICOS del Diagrama Actual al Diagrama Futuro.
 * Las NOTAS del futuro se respetan (son propias de la propuesta).
 * @returns {object} parámetros del futuro tras la copia (copia)
 */
export function copiarActualAFuturo(equipo) {
  const cont = contenedor(equipo);
  CAMPOS_DIAGRAMA.forEach((k) => { cont.futuro[k] = cont.actual[k]; });
  return { ...cont.futuro };
}

/**
 * Devuelve un diagrama (o los dos) a la semilla del equipo, descartando
 * las ediciones de la sesión.
 * @param {object} equipo
 * @param {'actual'|'futuro'|null} [cual]  null/omitido = ambos
 */
export function restablecerDiagrama(equipo, cual) {
  const cont = contenedor(equipo);
  if (cual == null) {
    cont.actual = semilla(equipo);
    cont.futuro = semilla(equipo);
  } else {
    cont[normalizarDiagrama(cual)] = semilla(equipo);
  }
  return { actual: { ...cont.actual }, futuro: { ...cont.futuro } };
}

/**
 * Estado completo de los dos diagramas del equipo, serializable
 * (para guardarlo junto a la ficha cuando se implemente la persistencia).
 */
export function exportarDiagramas(equipo) {
  const cont = contenedor(equipo);
  return { actual: { ...cont.actual }, futuro: { ...cont.futuro } };
}

/**
 * Restaura un estado previamente exportado (p. ej. leído de Firestore).
 * Sólo se admiten los campos conocidos: nada de basura en el estado.
 */
export function importarDiagramas(equipo, estado) {
  const cont = contenedor(equipo);
  const src = (estado && typeof estado === 'object') ? estado : {};
  DIAGRAMAS.forEach((w) => {
    const origen = src[w] || src[w === 'actual' ? 'diagA' : 'diagF'];
    if (!origen || typeof origen !== 'object') return;
    CAMPOS_DIAGRAMA.concat('notas').forEach((k) => {
      if (origen[k] != null) cont[w][k] = texto(origen[k]);
    });
  });
  return exportarDiagramas(equipo);
}

/** Vacía el estado en memoria (útil al cambiar de sesión o en pruebas). */
export function olvidarDiagramas(equipo) {
  if (equipo === undefined) { ESTADO.clear(); return; }
  ESTADO.delete(claveEquipo(equipo));
}

// ── el dibujo ─────────────────────────────────────────────────

/**
 * Construye el SVG del unifilar a partir de un juego de parámetros.
 * FUNCIÓN PURA: mismos parámetros → mismo SVG. No consulta el estado.
 *
 * Lectura del dibujo (de arriba abajo):
 *   · línea verde vertical  = acometida de alta, rotulada con la tensión primaria;
 *   · dos círculos          = devanados del transformador (verde = primario,
 *                             ámbar = secundario);
 *   · flecha diagonal gris  = cambiador de tomas BAJO CARGA — sólo aparece si la
 *                             regulación es OLTC (un NLTC no se representa así);
 *   · barra ámbar "B1"      = barraje de media tensión, rotulado con la secundaria;
 *   · cuatro salidas        = circuitos de media (representación esquemática);
 *   · bloque de texto rojo  = matrícula, potencia, grupo de conexión e impedancia.
 *
 * @param {object} params  ver CAMPOS_DIAGRAMA
 * @returns {string} SVG (viewBox 0 0 640 470), listo para innerHTML o para
 *                   serializar a PNG. Empieza literalmente por '<svg ' porque
 *                   el exportador a PNG inyecta ahí width/height.
 */
export function construirUnifilar(params) {
  const p = (params && typeof params === 'object') ? params : {};
  const { rojo, verde, ambar, gris } = PALETA_UNIFILAR;
  const oltc = /OLTC/i.test(texto(p.reg));

  const onan = texto(p.potONAN), onaf = texto(p.potONAF);
  const pot = (onan && onaf)
    ? (onan + '/ ' + onaf + ' MVA')
    : ((onaf || onan) ? ((onaf || onan) + ' MVA') : '');

  const cx = 450;
  const salidas = [-63, -21, 21, 63].map((dx) =>
    '<line x1="' + (cx + dx) + '" y1="365" x2="' + (cx + dx) + '" y2="398" stroke="' + ambar + '" stroke-width="2"/>' +
    '<path d="M ' + (cx + dx - 6) + ' 398 l 12 0 l -6 11 z" fill="none" stroke="' + ambar + '" stroke-width="1.6"/>'
  ).join('');

  const rotulo = ['Diagrama unifilar', texto(p.matricula), pot, texto(p.grupo)]
    .filter(Boolean).join(' · ');

  return '<svg viewBox="0 0 640 470" xmlns="http://www.w3.org/2000/svg"'
    + ' font-family="Arial,Helvetica,sans-serif" role="img" aria-label="' + esc(rotulo) + '">'
    + '<title>' + esc(rotulo) + '</title>'
    // acometida de alta
    + '<line x1="' + cx + '" y1="42" x2="' + cx + '" y2="150" stroke="' + verde + '" stroke-width="2.6"/>'
    + (p.kvPrim ? '<text x="' + (cx + 12) + '" y="86" font-size="15" fill="' + rojo + '">' + esc(p.kvPrim) + ' kV</text>' : '')
    // devanados
    + '<circle cx="' + cx + '" cy="184" r="33" fill="none" stroke="' + verde + '" stroke-width="2.6"/>'
    + '<circle cx="' + cx + '" cy="220" r="33" fill="none" stroke="' + ambar + '" stroke-width="2.6"/>'
    // cambiador bajo carga (sólo OLTC)
    + (oltc
      ? '<line x1="' + (cx - 46) + '" y1="248" x2="' + (cx + 46) + '" y2="158" stroke="' + gris + '" stroke-width="2"/>'
        + '<path d="M ' + (cx + 38) + ' 158 l 10 1 l -4 8 z" fill="' + gris + '"/>'
      : '')
    // bajante y barraje de media
    + '<line x1="' + cx + '" y1="253" x2="' + cx + '" y2="358" stroke="' + ambar + '" stroke-width="2.6"/>'
    + '<rect x="' + (cx - 92) + '" y="358" width="184" height="7" fill="' + ambar + '"/>'
    + '<text x="' + (cx - 124) + '" y="372" font-size="19" fill="' + rojo + '" font-weight="700">B1</text>'
    + (p.kvSec ? '<text x="' + (cx - 46) + '" y="350" font-size="15" fill="' + rojo + '">' + esc(p.kvSec) + ' kV</text>' : '')
    + salidas
    // rótulos del equipo
    + '<text x="55" y="168" font-size="25" fill="' + rojo + '" font-weight="700">' + esc(p.matricula || '') + '</text>'
    + '<text x="55" y="203" font-size="23" fill="' + rojo + '" font-weight="700">' + esc(pot) + '</text>'
    + '<text x="55" y="237" font-size="23" fill="' + rojo + '" font-weight="700">' + esc(p.grupo || '') + '</text>'
    + (p.imped ? '<text x="55" y="268" font-size="16" fill="' + gris + '">Z = ' + esc(p.imped) + ' %</text>' : '')
    + '</svg>';
}

/**
 * Atajo de conveniencia: SVG del diagrama guardado de un equipo.
 * Equivale a `construirUnifilar(parametrosDiagrama(equipo, cual))`.
 */
export function unifilarDeEquipo(equipo, cual) {
  return construirUnifilar(parametrosDiagrama(equipo, cual));
}
