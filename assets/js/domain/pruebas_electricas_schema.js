// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — schema de dominio (sanitizar / validar)
// ──────────────────────────────────────────────────────────────
// Modelo de datos del módulo "Mantenimiento Predictivo · Pruebas
// Eléctricas". El detalle de cada informe es EXHAUSTIVO y replica
// "tal cual" la estructura del tablero de referencia
// (Tablero Dinamico de Pruebas Electricas.html): cada prueba guarda
// sus mediciones por fase / sección / buje, con etiquetas de
// terminal reales, TAP y la calificación según los criterios
// normativos. NO se inventan datos: la captura es informe a informe.
//
// Estructura:
//   /pruebas_electricas/{unidadId}            → identidad de la unidad
//     · subcol /informes/{informeId}          → un informe por año/visita
//
// Cada informe contiene las mediciones crudas de las 6 pruebas:
//   1. Tangente δ        → por sección de aislamiento (CH/CHL/CL/…)
//   2. Corriente excit.  → por fase A/B/C del devanado AT (+ TAP)
//   3. Relación transf.  → filas por par de devanados (fases o global)
//   4. Resistencia dev.  → filas AT/MT/BT con fases en mΩ
//   5. Aislamiento (CC)  → por par de devanados / a tierra en GΩ
//   6. Collar / bujes    → pérdida máx + detalle por buje
//
// El semáforo y las gráficas de tendencia consumen estas estructuras.
// El PDF original vive en Firebase Storage; aquí se guarda solo la ref.
//
// Funciones puras, sin DOM ni Firestore. Testeable con node --test.
// ══════════════════════════════════════════════════════════════

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') v = v.replace(/,/g, '.');
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => (v === true || v === 'true' || v === 1 || v === '1');
const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};

/**
 * Familias de prueba que puede contener un informe. No todos los
 * números de serie reciben la misma batería: unos llevan el predictivo
 * completo (las 6 pruebas centradas en tan δ), otros solo DRM del
 * conmutador, otros relación (TTR) o resistencia óhmica de devanados.
 * El discriminador `tipo_prueba` del informe describe QUÉ se midió.
 */
export const TIPOS_PRUEBA = Object.freeze({
  PREDICTIVO_COMPLETO:   'predictivo_completo', // tan δ + excit + rel + res + aisl + collar
  TAN_DELTA:             'tan_delta',
  DRM_OLTC:              'drm_oltc',             // resistencia dinámica del conmutador
  RESISTENCIA_DEVANADOS: 'resistencia_devanados',
  TTR:                   'ttr',                  // relación de transformación
  MIXTO:                 'mixto'                 // combinación (p. ej. DRM + TTR + R)
});

const TIPOS_PRUEBA_SET = new Set(Object.values(TIPOS_PRUEBA));

/** Configuraciones de aislamiento para tan δ (códigos del tablero). */
export const CONFIGS_TAND = Object.freeze([
  { code: 'CH',  entre: 'AT ↔ tierra' },
  { code: 'CHL', entre: 'AT ↔ MT'     },
  { code: 'CL',  entre: 'MT ↔ tierra' },
  { code: 'CLT', entre: 'MT ↔ BT'     },
  { code: 'CT',  entre: 'BT ↔ tierra' },
  { code: 'CHT', entre: 'AT ↔ BT'     }
]);

/* ─── Criterios de evaluación (normativos · §criterios del tablero) ─ */

export const CRITERIOS = Object.freeze({
  tand:        '≤0.5% bueno · 0.5–0.7 normal · 0.7–1 investigar · >1 excesivo',
  excitacion:  'I<50 mA → Δ<10% · I>50 mA → Δ<5% (2 fases mayores)',
  relacion:    'Desviación ≤ ±0.5% respecto a placa',
  resistencia: 'Desbalance entre fases ≤ 5% (corregido por temperatura)',
  aislamiento: 'Mínimo según clase de tensión (≥1 GΩ en este equipo)',
  collar:      'Pérdidas < 100 mW',
  drm:         'Tiempo de transición del conmutador 40–70 ms · sin discontinuidades'
});

/* ─── Criterio VERIFICABLE por familia (fórmula + umbral + norma) ───
 * Lo consume el tablero de bloques (grafico-generico) para que el cliente
 * pueda CONFIRMAR por qué cada prueba recibe su calificación: muestra la
 * fórmula aplicada, el umbral usado por el scorecard y la norma de respaldo.
 * Fuente: normas citadas en los informes + UMBRALES del semáforo. El umbral
 * coincide a propósito con el que evalúa el scorecard (consistencia). */
export const CRITERIOS_NORMA = Object.freeze({
  tand:        { formula: 'tan δ % = pérdidas / (V·I) × 100, por sección de aislamiento', umbral: '≤1% (≤0.5 bueno · 0.5–0.7 normal · 0.7–1 investigar)', norma: 'IEEE 62 · ANSI/IEEE C57.12.90' },
  excitacion:  { formula: 'Δ% = (I_lateral_mayor − I_lateral_menor) / I_lateral_menor × 100', umbral: 'Δ<10% (I<50 mA) · Δ<5% (I≥50 mA)', norma: 'IEEE Std 62 · ANSI/IEEE C57.12.90' },
  relacion:    { formula: '%DIF = (relación medida − relación teórica) / relación teórica × 100', umbral: '±0.5% respecto a placa', norma: 'IEEE C57.152-2013 §7.2.10' },
  resistencia: { formula: 'Δ% = (R_fase − R_promedio) / R_promedio × 100 (corregida a 75 °C)', umbral: '≤5% entre fases', norma: 'IEEE C57.152-2013 · IEEE 62.2-2004' },
  aislamiento: { formula: 'R_aisl a 1 min ≥ mínimo NETA por clase de tensión · DAR = R(1 min)/R(30 s)', umbral: 'mín. por clase: 13.8 kV → 5 GΩ · 34.5 kV → 15 GΩ · 110 kV → 30 GΩ', norma: 'ANSI/NETA 2021 tabla 100.5' },
  bushing:     { formula: 'tan δ del buje % · Capacitancia medida vs valor de placa', umbral: 'tan δ <1% · Cap dentro de ±5–10% de placa', norma: 'IEEE C57.19.100' },
  collar:      { formula: 'Pérdida del collar caliente por buje (mW)', umbral: '<100 mW', norma: 'Test Data Reference Book' },
  drm:         { formula: 'Tiempo de transición del conmutador por paso (ms)', umbral: '40–70 ms · sin discontinuidades', norma: 'IEEE C57.152-2013' }
});

/* ─── Umbral de desbalance entre fases por familia (% MÁXIMO) ───────
 * Criterio normativo del desbalance entre fases en las curvas por TAP. Es
 * DOMINIO (no se delega a la IA): el shell lo adjunta a cada bloque como
 * `limite_desbalance` si la IA no lo emitió, para que el tablero grafique la
 * desviación contra su límite y derive la columna Evaluación. excitación 10%
 * (I<50 mA), relación ±0.5%, resistencia ≤5% (IEEE 62.2/C57.152). */
export const UMBRAL_DESBALANCE = Object.freeze({
  excitacion: 10,
  relacion: 0.5,
  resistencia: 5
});

/* ─── Resistencia de aislamiento: mínimo NETA por clase de tensión ──────
 * ANSI/NETA MTS tabla 100.5: el mínimo recomendado de resistencia de aislamiento
 * ESCALA con la tensión nominal del devanado. El genérico ≥1 GΩ solo aplica a
 * clases bajas; para 110 kV el mínimo es del orden de decenas de GΩ → por eso un
 * transformador de 110 kV con 5–6 GΩ se considera POBRE (no "aceptable"). Valores
 * (GΩ) de la tabla estándar por clase de tensión nominal (kV). */
export const NETA_IR_MIN_GOHM = Object.freeze([
  { kv: 1, gohm: 0.1 }, { kv: 2.5, gohm: 0.5 }, { kv: 5, gohm: 1 },
  { kv: 8, gohm: 2 }, { kv: 15, gohm: 5 }, { kv: 25, gohm: 10 },
  { kv: 34.5, gohm: 15 }, { kv: 46, gohm: 20 }, { kv: 69, gohm: 25 }, { kv: 115, gohm: 30 }
]);

/** Mínimo NETA (GΩ) para una tensión nominal (kV). El equipo se clasifica por su
 * CLASE: se redondea hacia ARRIBA al escalón ≥ kv (un devanado de 13.8 kV es
 * clase 15 kV; uno de 110 kV es clase 115 kV). */
export function minNetaGohm(kv) {
  const v = num(kv);
  if (v == null) return null;
  for (const r of NETA_IR_MIN_GOHM) if (v <= r.kv) return r.gohm;
  return NETA_IR_MIN_GOHM[NETA_IR_MIN_GOHM.length - 1].gohm; // por encima del máximo tabulado
}

/** Extrae la tensión AT (kV, el primer/mayor valor) de "110 / 34.5 / 13.8 kV". */
export function kvAT(tensiones) {
  const nums = String(tensiones == null ? '' : tensiones).match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  return Math.max(...nums.map(Number));
}

/* ─── Calificadores puros (devuelven una etiqueta de semáforo) ───── */

/** tan δ (%) → bueno | normal | investigar | excesivo */
export function calificarTand(valor_pct) {
  const v = num(valor_pct);
  if (v == null) return 'n/d';
  if (v <= 0.5) return 'bueno';
  if (v <= 0.7) return 'normal';
  if (v <= 1.0) return 'investigar';
  return 'excesivo';
}

/** desbalance de excitación (%) → normal | revisar; depende de I < 50 mA */
export function calificarExcitacion(delta_pct, corriente_max_ma) {
  const d = num(delta_pct);
  if (d == null) return 'n/d';
  const i = num(corriente_max_ma);
  const limite = (i != null && i > 50) ? 5 : 10;
  return d < limite ? 'normal' : 'revisar';
}

/** desviación de relación (%) → OK | fuera */
export function calificarRelacion(desviacion_pct) {
  const d = num(desviacion_pct);
  if (d == null) return 'n/d';
  return Math.abs(d) <= 0.5 ? 'OK' : 'fuera';
}

/** desbalance de resistencia (%) → OK | verificar */
export function calificarResistencia(delta_max_pct) {
  const d = num(delta_max_pct);
  if (d == null) return 'n/d';
  return d <= 5 ? 'OK' : 'verificar';
}

/** aislamiento (GΩ) → OK | bajo */
export function calificarAislamiento(gohm) {
  const v = num(gohm);
  if (v == null) return 'n/d';
  return v >= 1 ? 'OK' : 'bajo';
}

/** pérdida collar (mW) → OK | alto */
export function calificarCollar(mw) {
  const v = num(mw);
  if (v == null) return 'n/d';
  return v < 100 ? 'OK' : 'alto';
}

/* Rango normal del tiempo de transición del conmutador (ms). El DRM
 * (resistencia dinámica) valida que el paso entre tomas sea limpio y
 * dentro de ventana; fuera de [40, 70] ms hay riesgo de contacto. */
export const DRM_TIEMPO_MS = Object.freeze({ min: 40, max: 70 });

/** tiempo de transición DRM (ms) → OK | fuera */
export function calificarDrmTiempo(ms) {
  const v = num(ms);
  if (v == null) return 'n/d';
  return (v >= DRM_TIEMPO_MS.min && v <= DRM_TIEMPO_MS.max) ? 'OK' : 'fuera';
}

/**
 * Calificación global del DRM a partir de la ventana de tiempos de
 * transición medida (min/max). Si cualquier extremo cae fuera de
 * [40,70] ms → 'fuera'; si no hay datos → 'n/d'.
 */
export function calificarDrm(tiempo_min_ms, tiempo_max_ms) {
  const lo = num(tiempo_min_ms);
  const hi = num(tiempo_max_ms);
  if (lo == null && hi == null) return 'n/d';
  const cLo = lo == null ? 'OK' : calificarDrmTiempo(lo);
  const cHi = hi == null ? 'OK' : calificarDrmTiempo(hi);
  return (cLo === 'OK' && cHi === 'OK') ? 'OK' : 'fuera';
}

/* ─── Identidad de la unidad ──────────────────────────────────── */

export function sanitizarUnidad(input) {
  const src = input || {};
  return {
    schema_version: 2,
    serie:        str(src.serie),
    fabricante:   str(src.fabricante),
    ano_fabricacion: int(src.ano_fabricacion),
    potencia:     str(src.potencia),       // ej. "22.5 / 30 MVA"
    tensiones:    str(src.tensiones),      // ej. "110/34.5/13.8 kV"
    grupo_conexion: str(src.grupo_conexion),
    refrigeracion: str(src.refrigeracion),
    frecuencia:   str(src.frecuencia),
    fases:        str(src.fases),          // ej. "3φ"
    cliente:      str(src.cliente),
    ubicacion:    str(src.ubicacion),
    subestacion:  str(src.subestacion),
    nomenclatura: sanitizarNomenclatura(src.nomenclatura),
    transformadorId: str(src.transformadorId) // FK opcional al inventario
  };
}

/**
 * Convención de devanados/fases/terminales (sección "Nomenclatura"
 * del tablero). Arreglo de filas por devanado.
 */
function sanitizarNomenclatura(input) {
  if (!Array.isArray(input)) return [];
  return input.map((r) => ({
    devanado:  str(r.devanado),    // AT / MT / BT
    rol:       str(r.rol),         // Primario / Secundario / Terciario
    tension:   str(r.tension),     // "110 kV"
    conexion:  str(r.conexion),    // "YN (estrella)"
    fase_a:    str(r.fase_a),
    fase_b:    str(r.fase_b),
    fase_c:    str(r.fase_c),
    neutro:    str(r.neutro)
  })).filter((r) => r.devanado);
}

export function validarUnidad(u) {
  const errs = [];
  const s = sanitizarUnidad(u);
  if (!s.serie) errs.push('La serie es obligatoria.');
  if (s.ano_fabricacion != null &&
      (s.ano_fabricacion < 1900 || s.ano_fabricacion > 2100)) {
    errs.push('Año de fabricación fuera de rango (1900–2100).');
  }
  return errs;
}

/* ─── Sanitizadores por prueba (detalle exhaustivo) ───────────── */

/** Fase individual con etiqueta de terminal real (ej. "H1–PN"). */
function sanitizarFase(f) {
  return {
    fase:      str(f.fase),       // A / B / C
    valor:     num(f.valor),
    term:      str(f.term),       // terminal(es) ej. "H1–PN", "r–s"
    verificar: bool(f.verificar)  // marca de dato a confirmar (§dato a verificar)
  };
}

/**
 * 1) Tangente δ — por sección de aislamiento. Cada entrada lleva su
 * código (CH/CHL/CL/CLT/CT/CHT), el aislamiento entre, el valor en %
 * y la calificación. NO es por fase: se mide por sección completa.
 */
function sanitizarTand(input) {
  if (!Array.isArray(input)) return [];
  return input.map((t) => {
    const code = str(t.code).toUpperCase();
    const cfg = CONFIGS_TAND.find((c) => c.code === code);
    const valor_pct = num(t.valor_pct);
    return {
      code,
      entre:     str(t.entre) || (cfg ? cfg.entre : ''),
      valor_pct,
      calif:     str(t.calif) || calificarTand(valor_pct)
    };
  }).filter((t) => t.code);
}

/**
 * 2) Corriente de excitación — por fase A/B/C del devanado AT,
 * referida al neutro, con TAP. El criterio es el desbalance entre
 * las dos fases externas (Δ ext.).
 */
function sanitizarExcitacion(input) {
  const src = input || {};
  const fases = Array.isArray(src.fases) ? src.fases.map(sanitizarFase) : [];
  const delta_ext_pct = num(src.delta_ext_pct ?? src.delta_pct);
  const corrienteMax = fases.reduce((mx, f) =>
    (f.valor != null && f.valor > mx) ? f.valor : mx, 0);
  return {
    devanado:      str(src.devanado) || 'AT',
    ref:           str(src.ref),       // "N (H0)"
    tap:           str(src.tap),
    fases,
    delta_ext_pct,
    calif:         str(src.calif) || calificarExcitacion(delta_ext_pct, corrienteMax)
  };
}

/**
 * 3) Relación de transformación — filas por par de devanados. Cada
 * fila reporta 3 fases o un valor global (ej. 2020 reporta global por
 * par). Calificada contra ±0.5%.
 */
function sanitizarRelacion(input) {
  if (!Array.isArray(input)) return [];
  return input.map((r) => {
    const fases = Array.isArray(r.fases) ? r.fases.map(sanitizarFase) : [];
    const desviacion_pct = num(r.desviacion_pct);
    return {
      devanado:       str(r.devanado) || 'AT',
      asociado:       str(r.asociado),      // "MT", "BT (Terc.)", "MT (YNyn0)"
      tap:            str(r.tap),
      fases,
      global:         num(r.global),        // valor global cuando no hay 3 fases
      global_term:    str(r.global_term),   // "H–X (global)"
      desviacion_pct,
      calif:          str(r.calif) || calificarRelacion(desviacion_pct)
    };
  }).filter((r) => r.devanado || r.asociado);
}

/**
 * 4) Resistencia de devanados — filas AT/MT/BT con fases en mΩ. El
 * criterio es el desbalance entre fases ≤ 5%. Conserva la marca
 * `verificar` (§dato a verificar) y `no_medido`.
 */
function sanitizarResistencia(input) {
  if (!Array.isArray(input)) return [];
  return input.map((r) => {
    const fases = Array.isArray(r.fases) ? r.fases.map(sanitizarFase) : [];
    const delta_max_pct = num(r.delta_max_pct);
    const verificar = bool(r.verificar) || fases.some((f) => f.verificar);
    const no_medido = bool(r.no_medido);
    let calif = str(r.calif);
    if (!calif) {
      if (no_medido) calif = 'no medido';
      else if (verificar) calif = 'verificar';
      else calif = calificarResistencia(delta_max_pct);
    }
    return {
      ano_tap:       str(r.ano_tap),        // "2012 (7) mΩ", "2014 (8) corr."
      devanado:      str(r.devanado),
      conexion:      str(r.conexion),       // "fase–N", "fase–fase (Δ)"
      unidad:        str(r.unidad) || 'mΩ',
      fases,
      delta_max_pct,
      verificar,
      no_medido,
      calif
    };
  }).filter((r) => r.devanado);
}

/**
 * 5) Resistencia de aislamiento (CC) — por par de devanados / a
 * tierra en GΩ. Mínimo aceptable 1 GΩ.
 */
function sanitizarAislamiento(input) {
  if (!Array.isArray(input)) return [];
  return input.map((a) => {
    const gohm = num(a.gohm);
    return {
      devanado:  str(a.devanado),
      asociado:  str(a.asociado),     // "Tierra", "MT", "BT"
      gohm,
      calif:     str(a.calif) || calificarAislamiento(gohm)
    };
  }).filter((a) => a.devanado);
}

/**
 * 6) Collar caliente / bujes — pérdida máxima del año + detalle por
 * buje (I de salida µA + pérdida mW + fase + devanado). Límite 100 mW.
 */
function sanitizarCollar(input) {
  const src = input || {};
  const bujes = Array.isArray(src.bujes) ? src.bujes.map((b) => {
    const mw = num(b.mw);
    return {
      buje:        str(b.buje),       // "H0", "X1", "Y3"
      fase:        str(b.fase),       // A / B / C / N
      fase_label:  str(b.fase_label), // "Fase A", "Neutro"
      devanado:    str(b.devanado),   // AT / MT / BT
      i_ua:        num(b.i_ua),
      mw,
      calif:       str(b.calif) || calificarCollar(mw)
    };
  }).filter((b) => b.buje) : [];
  let max_mw = num(src.max_mw);
  if (max_mw == null && bujes.length) {
    // Solo derivar max_mw si AL MENOS un buje trae mw real. Antes el reduce
    // arrancaba en 0 → con bujes sin mw (informe sin hot-collar, p.ej. PF C1)
    // devolvía 0 → "OK" falso. Sin mw real, max_mw queda null → n/d.
    const conMw = bujes.filter((b) => b.mw != null);
    max_mw = conMw.length ? conMw.reduce((mx, b) => (b.mw > mx ? b.mw : mx), 0) : null;
  }
  return {
    max_mw,
    calif: str(src.calif) || (max_mw != null ? calificarCollar(max_mw) : ''),
    bujes
  };
}

/**
 * 7) DRM — Resistencia Dinámica del conmutador (OLTC). Guarda la
 * identidad del conmutador (fabricante, tipo, serial, posiciones,
 * operaciones, posición nominal, datos eléctricos), la ventana de
 * tiempos de transición (min/max en ms) y un detalle opcional por
 * fase/posición. NO se inventan números: cuando solo se conoce el
 * resumen (rango de tiempos), `transiciones[]` queda vacío.
 */
function sanitizarTransicionDrm(t) {
  const tiempo_ms = num(t.tiempo_ms);
  return {
    posicion:   str(t.posicion),     // "10→11", "11→12"
    fase:       str(t.fase),         // A / B / C
    tiempo_ms,
    sentido:    str(t.sentido),      // "subir" / "bajar"
    calif:      str(t.calif) || calificarDrmTiempo(tiempo_ms)
  };
}

function sanitizarDrm(input) {
  const src = input || {};
  const transiciones = Array.isArray(src.transiciones)
    ? src.transiciones.map(sanitizarTransicionDrm).filter((t) => t.tiempo_ms != null || t.posicion)
    : [];
  let tiempo_min_ms = num(src.tiempo_min_ms);
  let tiempo_max_ms = num(src.tiempo_max_ms);
  // Si hay detalle por transición pero no se dieron los extremos, derivarlos.
  const medidos = transiciones.map((t) => t.tiempo_ms).filter((v) => v != null);
  if (tiempo_min_ms == null && medidos.length) tiempo_min_ms = Math.min(...medidos);
  if (tiempo_max_ms == null && medidos.length) tiempo_max_ms = Math.max(...medidos);
  return {
    conmutador: {
      fabricante:   str(src.conmutador && src.conmutador.fabricante),   // "MR"
      tipo:         str(src.conmutador && src.conmutador.tipo),         // "V III 200 Y-76"
      serial:       str(src.conmutador && src.conmutador.serial),       // "145981"
      posiciones:   int(src.conmutador && src.conmutador.posiciones),   // 21
      operaciones:  int(src.conmutador && src.conmutador.operaciones),  // 383208
      pos_nominal:  int(src.conmutador && src.conmutador.pos_nominal),  // 11
      tension_ui_v: num(src.conmutador && src.conmutador.tension_ui_v), // 220
      corriente_iu_a: num(src.conmutador && src.conmutador.corriente_iu_a), // 322
      r_conmutacion_ohm: num(src.conmutador && src.conmutador.r_conmutacion_ohm) // 1.1
    },
    tiempo_min_ms,
    tiempo_max_ms,
    transiciones,
    calif: str(src.calif) || calificarDrm(tiempo_min_ms, tiempo_max_ms)
  };
}

/* ─── Informe individual (un año / una visita) ────────────────── */

/**
 * Deriva el tipo_prueba a partir de qué mediciones trae el informe,
 * cuando el origen no lo declara explícitamente. Un informe con las
 * 6 pruebas centradas en tan δ es 'predictivo_completo'; uno que solo
 * trae DRM es 'drm_oltc'; varias familias sin tan δ → 'mixto'.
 */
function inferirTipoPrueba(s) {
  const fams = [];
  if (s.tand.length) fams.push('tand');
  if (s.excitacion.fases.length || s.excitacion.delta_ext_pct != null) fams.push('exc');
  if (s.relacion.length) fams.push('rel');
  if (s.resistencia.length) fams.push('res');
  if (s.aislamiento.length) fams.push('aisl');
  if (s.collar.bujes.length || s.collar.max_mw != null) fams.push('collar');
  const tieneDrm = (s.drm.tiempo_min_ms != null || s.drm.tiempo_max_ms != null ||
                    s.drm.transiciones.length || s.drm.conmutador.serial);
  if (tieneDrm) fams.push('drm');
  if (!fams.length) return TIPOS_PRUEBA.PREDICTIVO_COMPLETO;
  if (fams.includes('tand')) return TIPOS_PRUEBA.PREDICTIVO_COMPLETO;
  if (fams.length === 1) {
    if (fams[0] === 'drm') return TIPOS_PRUEBA.DRM_OLTC;
    if (fams[0] === 'rel') return TIPOS_PRUEBA.TTR;
    if (fams[0] === 'res') return TIPOS_PRUEBA.RESISTENCIA_DEVANADOS;
  }
  return TIPOS_PRUEBA.MIXTO;
}

export function sanitizarInforme(input) {
  const src = input || {};
  const tand        = sanitizarTand(src.tand);
  const excitacion  = sanitizarExcitacion(src.excitacion);
  const relacion    = sanitizarRelacion(src.relacion);
  const resistencia = sanitizarResistencia(src.resistencia);
  const aislamiento = sanitizarAislamiento(src.aislamiento);
  const collar      = sanitizarCollar(src.collar);
  const drm         = sanitizarDrm(src.drm);
  const tipoDecl = str(src.tipo_prueba).toLowerCase();
  const tipo_prueba = TIPOS_PRUEBA_SET.has(tipoDecl)
    ? tipoDecl
    : inferirTipoPrueba({ tand, excitacion, relacion, resistencia, aislamiento, collar, drm });
  return {
    schema_version: 2,
    unidadId:   str(src.unidadId),
    serie:      str(src.serie),
    ano:        int(src.ano),
    fecha:      str(src.fecha),          // dateLabel "23/08/2012"
    ejecutante: str(src.ejecutante),     // executor "Applus"
    equipo:     str(src.equipo ?? src.equipment), // "DOBLE M4100 · …"
    serie_en_pdf: str(src.serie_en_pdf), // serie detectada en el PDF (o '')
    tipo:       str(src.tipo) || 'informe', // base | informe
    tipo_prueba,                            // qué familia(s) de prueba contiene
    // ── mediciones por prueba (detalle exhaustivo) ──
    tand,
    excitacion,
    relacion,
    resistencia,
    aislamiento,
    collar,
    drm,
    // ── PDF original (Firebase Storage o ruta del repo) ──
    pdf: {
      storagePath: str(src.pdf && src.pdf.storagePath),
      downloadURL: str(src.pdf && src.pdf.downloadURL),
      filename:    str(src.pdf && src.pdf.filename),
      size:        int(src.pdf && src.pdf.size),
      estado:      str(src.pdf && src.pdf.estado) || 'cargado'
    }
  };
}

export function validarInforme(inf) {
  const errs = [];
  const s = sanitizarInforme(inf);
  if (!s.serie) errs.push('La serie del informe es obligatoria.');
  if (s.ano == null) errs.push('El año del informe es obligatorio.');
  else if (s.ano < 1950 || s.ano > 2100) {
    errs.push('Año del informe fuera de rango (1950–2100).');
  }
  for (const t of s.tand) {
    if (t.valor_pct != null && t.valor_pct < 0) {
      errs.push(`tan δ ${t.code} no puede ser negativa.`);
    }
  }
  for (const a of s.aislamiento) {
    if (a.gohm != null && a.gohm < 0) {
      errs.push(`Aislamiento ${a.devanado}↔${a.asociado} no puede ser negativo.`);
    }
  }
  if (s.drm.tiempo_min_ms != null && s.drm.tiempo_min_ms < 0) {
    errs.push('El tiempo de transición DRM no puede ser negativo.');
  }
  if (s.drm.tiempo_min_ms != null && s.drm.tiempo_max_ms != null &&
      s.drm.tiempo_max_ms < s.drm.tiempo_min_ms) {
    errs.push('El tiempo máximo DRM no puede ser menor que el mínimo.');
  }
  return errs;
}

/**
 * Clave canónica de un número de serie: sin espacios ni guiones (incluye los
 * guiones Unicode \u2010-\u2015) y en mayúsculas. Dos formatos del MISMO serie
 * (`173523-15510` vs `17352315510`) colapsan a la misma clave → permite agrupar
 * informes del mismo transformador aunque se teclee con distinto formato.
 * NO se usa como docId (no rompe datos existentes): solo para COMPARAR.
 * @param {string} serie
 * @returns {string}
 */
export function normalizarSerie(serie) {
  return str(serie).replace(/[\s\u2010-\u2015-]/g, '').toUpperCase();
}

/**
 * Verifica que la serie detectada en el PDF coincide con la ingresada
 * por el usuario (paso 3 del flujo de carga del tablero original).
 * @param {string} serieIngresada serie tecleada antes de cargar
 * @param {string} textoPdf texto extraído del PDF
 * @returns {{coincide:boolean, serieIngresada:string, encontrada:boolean}}
 */
export function confirmarSerie(serieIngresada, textoPdf) {
  const serie = str(serieIngresada);
  const texto = str(textoPdf);
  if (!serie) return { coincide: false, serieIngresada: serie, encontrada: false };
  const encontrada = normalizarSerie(texto).includes(normalizarSerie(serie));
  return { coincide: encontrada, serieIngresada: serie, encontrada };
}

const ANO_MIN = 1950;
const ANO_MAX = 2100;

/** ¿es un año plausible para un informe? */
function anoValido(y) {
  return Number.isInteger(y) && y >= ANO_MIN && y <= ANO_MAX;
}

/** Convierte una fecha compacta (YYYYMMDD o YYMMDD) en su año, o null. */
function anoDeFechaCompacta(digits) {
  let y, m, d;
  if (digits.length === 8) {
    y = +digits.slice(0, 4); m = +digits.slice(4, 6); d = +digits.slice(6, 8);
  } else if (digits.length === 6) {
    y = 2000 + +digits.slice(0, 2); m = +digits.slice(2, 4); d = +digits.slice(4, 6);
  } else {
    return null;
  }
  if (!anoValido(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return y;
}

/**
 * Detecta el año del informe SIN pedírselo al usuario. Prioriza la
 * fecha compacta con la que arrancan los nombres de archivo del
 * tablero (YYMMDD o YYYYMMDD, ej. "130823-…" → 2013, "20250510 …" →
 * 2025) por ser determinista, y cae al texto del PDF (fechas
 * dd/mm/aaaa o aaaa-mm-dd, y como último recurso el año de 4 cifras
 * más reciente dentro del rango).
 * @param {{texto?:string, filename?:string}} src
 * @returns {{ano:number|null, fuente:'filename'|'texto-fecha'|'texto-ano'|null}}
 */
export function detectarAno(src) {
  const filename = str(src && src.filename);
  const texto = str(src && src.texto);

  // 1) Fecha compacta al inicio del nombre de archivo.
  const mPref = filename.match(/^\s*(\d{6,8})/);
  if (mPref) {
    const y = anoDeFechaCompacta(mPref[1]);
    if (y != null) return { ano: y, fuente: 'filename' };
  }

  // 2) Fecha completa en el texto (dd/mm/aaaa, dd-mm-aaaa o aaaa-mm-dd).
  let m;
  const dmy = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
  while ((m = dmy.exec(texto))) {
    const y = +m[3];
    if (anoValido(y)) return { ano: y, fuente: 'texto-fecha' };
  }
  const ymd = /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g;
  while ((m = ymd.exec(texto))) {
    const y = +m[1];
    if (anoValido(y)) return { ano: y, fuente: 'texto-fecha' };
  }

  // 3) Cualquier año de 4 cifras en rango: el más reciente.
  const sueltos = [];
  const re = /\b(19[5-9]\d|20\d\d|2100)\b/g;
  while ((m = re.exec(texto))) sueltos.push(+m[1]);
  if (sueltos.length) {
    return { ano: Math.max(...sueltos), fuente: 'texto-ano' };
  }

  return { ano: null, fuente: null };
}
