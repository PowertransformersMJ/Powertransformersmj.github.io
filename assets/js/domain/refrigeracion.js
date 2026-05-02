// ═══════════════════════════════════════════════════════════════
// REFRIGERACIÓN ONAF — dominio puro (sin DOM)
// ───────────────────────────────────────────────────────────────
// Cálculo del flujo de aire requerido (CFM) para selección de
// motoventiladores en conversión de enfriamiento ONAN → ONAF.
//
// Referencias normativas:
//   · IEEE C57.12.00-2015  · transformadores de potencia.
//   · ANSI C57.12.91       · pruebas de transformadores ONAF.
//   · IEEE C57.91-2011     · cargas continuas de transformadores.
//   · Westinghouse T&D Reference (calibración pendientes).
//
// Calibración Westinghouse (pendientes CFM/kVA_ONAN):
//   115% → 1.20 · 125% → 2.00 · 133% → 2.65 · 166% → 4.25
//   Verificación: 24 MVA × 125% → 48.000 CFM (caso de control).
//
// Todas las funciones son puras: reciben input y devuelven output
// determinístico. Sin lecturas/escrituras de DOM, ni de Firestore,
// ni state mutable. Diseñado para tests con node --test.
// ═══════════════════════════════════════════════════════════════

/* ─── Calibración Westinghouse (constantes inmutables) ──────── */

/** Pares [%ONAF/ONAN, pendiente CFM/kVA_ONAN] · MO Westinghouse. */
export const PENDIENTES_WESTINGHOUSE = Object.freeze([
  [115, 1.20],
  [125, 2.00],
  [133, 2.65],
  [166, 4.25]
]);

/** Conversiones a CFM (ft³/min) por unidad de entrada de caudal. */
export const FACTORES_CAUDAL = Object.freeze({
  m3s:   2118.88,    // m³/s × 2118.88 = CFM
  m3min: 35.3147,    // m³/min × 35.3147 = CFM
  m3h:   0.58858,    // m³/h × 0.58858 = CFM (≡ ÷ 1.69901)
  cfm:   1.0,
  cfs:   60.0        // ft³/s × 60 = CFM
});

/** Etiqueta humanizada de cada unidad. */
export const ETIQUETAS_CAUDAL = Object.freeze({
  m3s:   'm³/s',
  m3min: 'm³/min',
  m3h:   'm³/h',
  cfm:   'CFM (ft³/min)',
  cfs:   'CFS (ft³/s)'
});

/** Altura de escala atmosférica (ISA), en metros. */
export const ALTURA_ESCALA_ISA = 8500;

/** Eje X canónico del gráfico: 281 puntos cada 500 kVA → 0–140 MVA. */
export const EJE_X_KVA = Object.freeze(
  Array.from({ length: 281 }, (_, i) => i * 500)
);

/** Curvas oficiales del gráfico (%ONAF/ONAN, color, grosor px). */
export const CURVAS_GRAFICO = Object.freeze([
  { pct: 115, color: '#1565C0', w: 1.8 },
  { pct: 125, color: '#1B5E20', w: 1.8 },
  { pct: 133, color: '#E65100', w: 2.0 },
  { pct: 166, color: '#B71C1C', w: 1.8 }
]);

/* ─── Núcleo de cálculo ─────────────────────────────────────── */

/**
 * Interpola la pendiente CFM/kVA_ONAN para un porcentaje arbitrario
 * usando los puntos de calibración Westinghouse. Fuera de rango se
 * recorta a los extremos (115% y 166%).
 *
 * @param {number} pct  Porcentaje ONAF/ONAN (ej. 133)
 * @returns {number}    Pendiente en CFM por kVA_ONAN
 */
export function interpolarPendiente(pct) {
  const tabla = PENDIENTES_WESTINGHOUSE;
  if (pct <= tabla[0][0]) return tabla[0][1];
  if (pct >= tabla[tabla.length - 1][0]) return tabla[tabla.length - 1][1];
  for (let i = 0; i < tabla.length - 1; i++) {
    const [p1, s1] = tabla[i];
    const [p2, s2] = tabla[i + 1];
    if (pct >= p1 && pct <= p2) {
      return s1 + (s2 - s1) * (pct - p1) / (p2 - p1);
    }
  }
  return 2.65;
}

/**
 * Convierte un caudal a CFM a partir de su unidad de entrada.
 * Devuelve `null` si el valor es inválido (no numérico o ≤ 0).
 *
 * @param {{valor: number, unidad: string}} input
 * @returns {number|null}  CFM (ft³/min)
 */
export function convertirCaudalACFM({ valor, unidad }) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0) return null;
  const factor = FACTORES_CAUDAL[unidad];
  if (factor === undefined) return null;
  return Math.round(v * factor);
}

/**
 * Conversión directa CFM → m³/s (recíproca al factor m3s).
 * @param {number} cfm
 * @returns {number}
 */
export function cfmAM3s(cfm) {
  const v = Number(cfm);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v / FACTORES_CAUDAL.m3s;
}

/**
 * Corrección de caudal por densidad atmosférica (modelo ISA
 * exponencial barométrico). A nivel del mar el factor es 1.0;
 * a 1 500 m es ≈ 1.193; a 3 000 m es ≈ 1.423.
 *
 * Justificación: a menor densidad del aire, se requiere mayor
 * volumen para transportar la misma masa térmica.
 *
 * @param {number} altitud_m  altitud en metros sobre el nivel del mar
 * @returns {number}          factor multiplicativo (≥ 1)
 */
export function factorCorreccionAltitud(altitud_m) {
  const alt = Math.max(0, Number(altitud_m) || 0);
  return Math.exp(alt / ALTURA_ESCALA_ISA);
}

/**
 * Cálculo principal de refrigeración.
 *
 * @param {{kva_onan: number, pct: number, alt?: number}} input
 * @returns {{
 *   onan: number,            // kVA ONAN base
 *   onaf: number,            // kVA ONAF objetivo
 *   delta: number,           // ΔPotencia (kVA)
 *   pendiente: number,       // CFM/kVA_ONAN
 *   cfm_nivel_mar: number,   // CFM requerido a 0 m s.n.m.
 *   cfm_corregido: number,   // CFM corregido por altitud
 *   factor_altitud: number   // factor de corrección aplicado
 * }}
 */
export function calcularRefrigeracion({ kva_onan, pct, alt = 0 }) {
  const onan = Math.max(0, Number(kva_onan) || 0);
  const p    = Math.max(0, Number(pct) || 0);
  const slope = interpolarPendiente(p);
  const onaf = onan * p / 100;
  const cfm  = slope * onan;
  const fAlt = factorCorreccionAltitud(alt);
  const cfmA = cfm * fAlt;
  return {
    onan,
    onaf,
    delta: onaf - onan,
    pendiente: slope,
    cfm_nivel_mar: cfm,
    cfm_corregido: cfmA,
    factor_altitud: fAlt
  };
}

/**
 * Calcula la cantidad de ventiladores necesarios para cubrir un
 * caudal total dado, redondeando siempre hacia arriba (techo).
 *
 * Devuelve `null` en cualquier campo si los datos son insuficientes.
 *
 * @param {{cfm_total: number, cfm_fan: number}} input
 * @returns {{
 *   n: number|null,         // unidades requeridas
 *   cfm_logrado: number,    // CFM total alcanzado con N ventiladores
 *   cobertura_pct: number|null,
 *   exceso: number,         // CFM por encima del requerido
 *   ok: boolean
 * }}
 */
export function calcularUnidadesRequeridas({ cfm_total, cfm_fan }) {
  const tot = Number(cfm_total) || 0;
  const fan = Number(cfm_fan)   || 0;
  if (fan <= 0 || tot <= 0) {
    return { n: null, cfm_logrado: 0, cobertura_pct: null, exceso: 0, ok: false };
  }
  const n = Math.ceil(tot / fan);
  const logrado = n * fan;
  const cob = +(logrado / tot * 100).toFixed(1);
  return { n, cfm_logrado: logrado, cobertura_pct: cob, exceso: logrado - tot, ok: logrado >= tot };
}

/* ─── Curva: generación de puntos ───────────────────────────── */

/**
 * Genera el dataset de una curva (puntos {x, y}) para una pendiente
 * dada, usando el eje X canónico (`EJE_X_KVA`) o uno custom.
 *
 * @param {number} pct
 * @param {number[]} [xs=EJE_X_KVA]
 * @returns {{x: number, y: number}[]}
 */
export function generarCurva(pct, xs = EJE_X_KVA) {
  const slope = interpolarPendiente(pct);
  return xs.map(x => ({ x, y: slope * x }));
}

/* ─── Sincronización ONAN ↔ ONAF ↔ % ────────────────────────── */

/** Calcula ONAF a partir de ONAN y porcentaje. */
export function deduceOnafDesdeOnanYPct(onan, pct) {
  const o = Math.max(0, Number(onan) || 0);
  const p = Math.max(0, Number(pct) || 0);
  return Math.round(o * p / 100);
}

/** Calcula porcentaje a partir de ONAN y ONAF (1 decimal). */
export function deducePctDesdeOnanYOnaf(onan, onaf) {
  const o = Number(onan) || 0;
  const n = Number(onaf) || 0;
  if (o <= 0 || n <= o) return null;
  return +(n / o * 100).toFixed(1);
}

/* ─── Selección de protecciones ABB ─────────────────────────── */

/** Catálogo guardamotores ABB MS116 (rango ajuste vs. corriente). */
export const MS116_DB = Object.freeze([
  { model: 'MS116-0.16', min: 0.10, max: 0.16, pid: '1SAM250000R1001' },
  { model: 'MS116-0.25', min: 0.16, max: 0.25, pid: '1SAM250000R1002' },
  { model: 'MS116-0.4',  min: 0.25, max: 0.40, pid: '1SAM250000R1003' },
  { model: 'MS116-0.63', min: 0.40, max: 0.63, pid: '1SAM250000R1004' },
  { model: 'MS116-1.0',  min: 0.63, max: 1.00, pid: '1SAM250000R1005' },
  { model: 'MS116-1.6',  min: 1.00, max: 1.60, pid: '1SAM250000R1006' },
  { model: 'MS116-2.5',  min: 1.60, max: 2.50, pid: '1SAM250000R1007' },
  { model: 'MS116-4.0',  min: 2.50, max: 4.00, pid: '1SAM250000R1008' },
  { model: 'MS116-6.3',  min: 4.00, max: 6.30, pid: '1SAM250000R1009' },
  { model: 'MS116-10',   min: 6.30, max: 10.0, pid: '1SAM250000R1010' },
  { model: 'MS116-16',   min: 10.0, max: 16.0, pid: '1SAM250000R1011' },
  { model: 'MS116-25',   min: 16.0, max: 25.0, pid: '1SAM250000R1012' },
  { model: 'MS116-32',   min: 20.0, max: 32.0, pid: '1SAM250000R1013' }
]);

/** Catálogo breakers ABB S203 (3P, Curva C, 6 kA). */
export const S203_DB = Object.freeze([
  { model: 'S203-C16 MTB', in: 16, pid: '2CDS253001U0164', power_w: 7.5 },
  { model: 'S203-C25',     in: 25, pid: '2CDS253001R0254', power_w: 9.6 },
  { model: 'S203-C40',     in: 40, pid: '2CDS253001R0404', power_w: 14.4 },
  { model: 'S203-C50',     in: 50, pid: '2CDS253001R0504', power_w: 9.75 }
]);

/** Contacto auxiliar SCADA para guardamotor MS116. */
export const AUX_GUARDAMOTOR = Object.freeze({
  model: 'HK1-11',
  pid:   '1SAM201902R1001',
  desc:  '1NO+1NC · Clip-on MS116 · IEC/EN 60947-5-1'
});

/** Contacto auxiliar SCADA para breaker S203. */
export const AUX_BREAKER = Object.freeze({
  model: 'S2C-H11L',
  pid:   '2CDS200936R0001',
  desc:  '1NO+1NC · Montaje lateral izquierdo S200'
});

/**
 * Extrae la corriente (A) de un string tipo "1.60 / 0.92 A (D/Y)"
 * o un valor único "1.13 A". Para conexión D devuelve la primera
 * lectura, para Y la segunda. Si solo hay un valor, lo devuelve.
 */
export function extraerCorrienteFan(strAmp, conexion = 'D') {
  if (!strAmp || typeof strAmp !== 'string') return null;
  const m = strAmp.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (m) return conexion === 'D' ? parseFloat(m[1]) : parseFloat(m[2]);
  const m2 = strAmp.match(/([\d.]+)/);
  return m2 ? parseFloat(m2[1]) : null;
}

/**
 * Selecciona el guardamotor MS116 cuyo rango cubre la corriente del
 * ventilador. Tolera 5 % por debajo del mínimo de cada modelo.
 *
 * @param {number} amperaje
 * @returns {object|null}  ficha del MS116 o `null` si fuera de catálogo
 */
export function seleccionarGuardamotor(amperaje) {
  const i = Number(amperaje);
  if (!Number.isFinite(i) || i <= 0) return null;
  return MS116_DB.find(g => i >= g.min * 0.95 && i <= g.max) || null;
}

/**
 * Selecciona el breaker principal S203 con corriente nominal ≥ a la
 * corriente total mínima requerida (1.25 × I_total).
 *
 * @param {number} amperaje_min
 * @returns {object|null}  ficha del S203 o `null` si excede el catálogo
 */
export function seleccionarBreaker(amperaje_min) {
  const i = Number(amperaje_min);
  if (!Number.isFinite(i) || i <= 0) return null;
  return S203_DB.find(b => b.in >= i) || null;
}

/**
 * Cálculo completo de protección eléctrica para un sistema de N
 * ventiladores idénticos.
 *
 * @param {{
 *   amps_por_fan: number,
 *   n_fans: number,
 *   factor_seguridad?: number  // por defecto 1.25 (NEC 430)
 * }} input
 * @returns {{
 *   amps_por_fan: number,
 *   n_fans: number,
 *   amps_totales: number,
 *   amps_min_breaker: number,
 *   guardamotor: object|null,
 *   breaker: object|null,
 *   aux_guardamotor: object,
 *   aux_breaker: object
 * }}
 */
export function calcularProteccionElectrica({ amps_por_fan, n_fans, factor_seguridad = 1.25 }) {
  const iF = Number(amps_por_fan) || 0;
  const n  = Math.max(0, Math.floor(Number(n_fans) || 0));
  const iT = +(n * iF).toFixed(2);
  const iM = +(iT * factor_seguridad).toFixed(2);
  return {
    amps_por_fan:    iF,
    n_fans:          n,
    amps_totales:    iT,
    amps_min_breaker: iM,
    guardamotor:     seleccionarGuardamotor(iF),
    breaker:         seleccionarBreaker(iM),
    aux_guardamotor: AUX_GUARDAMOTOR,
    aux_breaker:     AUX_BREAKER
  };
}

/* ─── Compatibilidad mecánica ───────────────────────────────── */

/** Estados posibles de cada criterio de compatibilidad. */
export const COMPAT_ESTADO = Object.freeze({
  OK:   'ok',    // óptimo
  WARN: 'warn',  // requiere verificación
  ERR:  'err',   // incompatibilidad
  ND:   'nd'     // datos insuficientes
});

/** Disposiciones mecánicas válidas del ventilador sobre el radiador. */
export const DISPOSICIONES = Object.freeze({
  LATERAL:     'lateral',
  VERTICAL_1:  'vertical_1',
  VERTICAL_2:  'vertical_2'
});

/**
 * Mensaje informativo según la disposición seleccionada.
 */
export function mensajeDisposicion(disp) {
  const msgs = {
    lateral:    'Disposición LATERAL: el ventilador sopla horizontalmente a través de las obleas. La cobertura depende de B (span de obleas ≥ Ø ventilador).',
    vertical_1: 'Disposición VERTICAL ↑ (1 cuerpo): el ventilador impulsa aire de abajo hacia arriba por UN cuerpo de radiador. Dimensión crítica: A (altura) vs Ø.',
    vertical_2: 'Disposición VERTICAL ↑ (2 cuerpos): el ventilador cubre DOS cuerpos de radiador de abajo hacia arriba. Dimensión crítica: 2×A vs Ø.'
  };
  return msgs[disp] || '';
}

/**
 * Evaluación geométrica de compatibilidad ventilador↔radiador.
 * Cuatro criterios independientes (cards C1–C4 del UI). Cada uno
 * devuelve `{val, desc, estado}`.
 *
 * @param {{
 *   A: number|null,            // altura cuerpo radiador (mm)
 *   B: number|null,            // span obleas ini-fin (mm)
 *   C: number|null,            // ancho frente cuerpo (mm)
 *   diametro_mm: number|null,  // Ø ventilador (mm)
 *   distancia_mm: number|null, // separación ventilador-radiador (mm)
 *   disposicion: string        // DISPOSICIONES.*
 * }} input
 * @returns {{
 *   c1: {val, desc, estado, label},  // cobertura panel
 *   c2: {val, desc, estado, title},  // sección de flujo / altura
 *   c3: {val, desc, estado},         // holgura
 *   c4: {val, desc, estado},         // relación A/Ø o B/Ø
 *   resumen: {ok, warn, err, nd, mensaje}
 * }}
 */
export function evaluarCompatibilidad({ A, B, C, diametro_mm, distancia_mm, disposicion }) {
  const num = (x) => (Number.isFinite(Number(x)) && Number(x) > 0) ? Number(x) : null;
  const a = num(A), b = num(B), c = num(C), diam = num(diametro_mm), dist = (Number.isFinite(Number(distancia_mm)) && Number(distancia_mm) >= 0) ? Number(distancia_mm) : null;
  const disp = disposicion || '';

  // Dimensión de cobertura según disposición.
  let covDim = b;
  let covLabel = 'B (span obleas)';
  if (disp === DISPOSICIONES.VERTICAL_1) { covDim = a; covLabel = 'A (altura 1 cuerpo)'; }
  if (disp === DISPOSICIONES.VERTICAL_2) { covDim = a ? 2 * a : null; covLabel = '2×A (altura 2 cuerpos)'; }

  // C1 · cobertura del panel (covDim vs Ø)
  let c1;
  if (covDim && diam) {
    const diff = covDim - diam;
    const pct  = +(covDim / diam * 100).toFixed(1);
    if (covDim >= diam * 1.05) {
      c1 = { val: `${covLabel}=${covDim} mm · Ø=${diam} mm`, desc: `Cobertura ${pct}% — Margen ${Math.round(diff)} mm — ÓPTIMO`, estado: COMPAT_ESTADO.OK, label: covLabel };
    } else if (covDim >= diam * 0.95) {
      c1 = { val: `${covLabel}=${covDim} mm · Ø=${diam} mm`, desc: `Cobertura ${pct}% — Margen mínimo — VERIFICAR`, estado: COMPAT_ESTADO.WARN, label: covLabel };
    } else {
      c1 = { val: `${covLabel}=${covDim} mm < Ø=${diam} mm`, desc: `Déficit ${Math.round(diam - covDim)} mm — NO COMPATIBLE`, estado: COMPAT_ESTADO.ERR, label: covLabel };
    }
  } else {
    c1 = { val: '—', desc: disp ? `Ingrese ${covLabel} y Ø ventilador` : 'Seleccione disposición mecánica primero', estado: COMPAT_ESTADO.ND, label: covLabel };
  }

  // C2 · sección de flujo / altura
  let c2;
  if (disp === DISPOSICIONES.LATERAL) {
    if (a && diam) {
      const ratio = +(a / diam * 100).toFixed(1);
      if (a >= diam * 1.2)  c2 = { val: `A=${a} mm · Ø=${diam} mm`, desc: `Altura ${ratio}% del Ø — Espacio suficiente — COMPATIBLE`, estado: COMPAT_ESTADO.OK,   title: 'Altura disponible vs Ø' };
      else if (a >= diam)   c2 = { val: `A=${a} mm · Ø=${diam} mm`, desc: 'Altura ajustada — Verificar espacio libre', estado: COMPAT_ESTADO.WARN, title: 'Altura disponible vs Ø' };
      else                   c2 = { val: `A=${a} mm < Ø=${diam} mm`, desc: 'Altura radiador insuficiente para Ø ventilador', estado: COMPAT_ESTADO.ERR, title: 'Altura disponible vs Ø' };
    } else {
      c2 = { val: '—', desc: 'Lateral: verificar A (altura) vs Ø. C (profundidad) no es la dimensión crítica', estado: COMPAT_ESTADO.ND, title: 'Sección de flujo / altura vs Ø' };
    }
  } else if (c && diam) {
    const ratio = +(c / diam * 100).toFixed(1);
    if (c >= diam)             c2 = { val: `C=${c} mm · Ø=${diam} mm`, desc: `Sección libre ${ratio}% — COMPATIBLE`, estado: COMPAT_ESTADO.OK,   title: 'Sección de flujo / C vs Ø' };
    else if (c >= diam * 0.85) c2 = { val: `C=${c} mm · Ø=${diam} mm`, desc: 'Requiere marco adaptador — VERIFICAR', estado: COMPAT_ESTADO.WARN, title: 'Sección de flujo / C vs Ø' };
    else                        c2 = { val: `C=${c} mm — INSUFICIENTE`, desc: 'Ventilador no cabe en frente — NO COMPATIBLE', estado: COMPAT_ESTADO.ERR, title: 'Sección de flujo / C vs Ø' };
  } else {
    c2 = { val: '—', desc: 'Ingrese C y Ø ventilador (disposición vertical)', estado: COMPAT_ESTADO.ND, title: 'Sección de flujo / altura vs Ø' };
  }

  // C3 · holgura ventilador↔radiador
  let c3;
  if (dist !== null && diam) {
    const minD = diam * 0.05;
    const recD = Math.max(50, diam * 0.10);
    if (dist >= recD)      c3 = { val: `${dist} mm libre`, desc: 'Holgura recomendada — ÓPTIMO', estado: COMPAT_ESTADO.OK };
    else if (dist >= minD) c3 = { val: `${dist} mm libre`, desc: `Mín. ${Math.round(minD)} mm — Riesgo recirculación — VERIFICAR`, estado: COMPAT_ESTADO.WARN };
    else                    c3 = { val: `${dist} mm — CRÍTICO`, desc: 'Holgura insuficiente — RIESGO ALTO', estado: COMPAT_ESTADO.ERR };
  } else {
    c3 = { val: '—', desc: 'Ingrese separación libre y Ø', estado: COMPAT_ESTADO.ND };
  }

  // C4 · relación A/Ø o B/Ø según disposición
  let c4;
  if (disp === DISPOSICIONES.VERTICAL_1 || disp === DISPOSICIONES.VERTICAL_2) {
    if (a && diam) {
      const r = +(a / diam).toFixed(2);
      if (r >= 1.5)      c4 = { val: `A/Ø = ${r}`, desc: `Altura ${a} mm — Flujo uniforme — ÓPTIMO`, estado: COMPAT_ESTADO.OK };
      else if (r >= 1.0) c4 = { val: `A/Ø = ${r}`, desc: 'Aceptable — Verificar distribución de flujo', estado: COMPAT_ESTADO.WARN };
      else                c4 = { val: `A/Ø = ${r}`, desc: 'A < Ø — Flujo posiblemente no uniforme', estado: COMPAT_ESTADO.WARN };
    } else {
      c4 = { val: '—', desc: 'Ingrese A y Ø ventilador (disposición vertical)', estado: COMPAT_ESTADO.ND };
    }
  } else if (disp === DISPOSICIONES.LATERAL) {
    if (b && diam) {
      const r = +(b / diam).toFixed(2);
      const ok = r >= 1.0;
      c4 = { val: `B/Ø = ${r}`, desc: `Lateral: B=${b} mm — ${ok ? 'Cobertura completa' : 'Cobertura parcial'}`, estado: ok ? COMPAT_ESTADO.OK : COMPAT_ESTADO.WARN };
    } else {
      c4 = { val: '—', desc: 'Ingrese B y Ø (disposición lateral)', estado: COMPAT_ESTADO.ND };
    }
  } else {
    c4 = { val: '—', desc: 'Seleccione disposición mecánica', estado: COMPAT_ESTADO.ND };
  }

  // Resumen agregado
  const cards = [c1, c2, c3, c4];
  const ok    = cards.filter(x => x.estado === COMPAT_ESTADO.OK).length;
  const warn  = cards.filter(x => x.estado === COMPAT_ESTADO.WARN).length;
  const err   = cards.filter(x => x.estado === COMPAT_ESTADO.ERR).length;
  const nd    = cards.filter(x => x.estado === COMPAT_ESTADO.ND).length;
  let mensaje = '';
  if (!disp)              mensaje = 'Seleccione la disposición mecánica del ventilador para obtener el análisis completo.';
  else if (nd === cards.length) mensaje = 'Complete las medidas del radiador y del ventilador.';
  else if (err > 0)       mensaje = `${err} incompatibilidad(es) — Revisar criterios en rojo antes de proceder al montaje.`;
  else if (warn > 0)      mensaje = `${ok} criterio(s) cumplido(s) · ${warn} requieren verificación. Consultar fabricante antes de montar.`;
  else                     mensaje = 'Todos los criterios geométricos son favorables para la disposición seleccionada.';

  return { c1, c2, c3, c4, resumen: { ok, warn, err, nd, mensaje } };
}

/* ─── Heurísticas del gráfico ───────────────────────────────── */

/**
 * Determina el step del eje Y según el rango total visible. Tabla
 * empírica calibrada para mantener entre 5 y 20 ticks visibles.
 *
 * @param {number} yMax
 * @returns {number}
 */
export function calcularYStep(yMax) {
  const r = Number(yMax) || 0;
  if (r <= 5000)   return 500;
  if (r <= 15000)  return 1000;
  if (r <= 30000)  return 2000;
  if (r <= 80000)  return 5000;
  if (r <= 200000) return 10000;
  if (r <= 500000) return 20000;
  return 50000;
}

/**
 * Auto-rango del gráfico: ajusta X e Y para mostrar la curva 166 %
 * con un techo cómodo a partir de la potencia ONAN.
 *
 * @param {number} kva_onan
 * @returns {{xMin, xMax, yMin, yMax, yStep}}  todo en kVA / CFM
 */
export function calcularAutoRango(kva_onan) {
  const onan = Math.max(0, Number(kva_onan) || 0);
  const xMva  = Math.min(Math.ceil(onan * 1.6 / 10000) * 10, 140);
  const xMax  = xMva * 1000; // kVA
  const yMax  = Math.ceil(interpolarPendiente(166) * xMax / 50000) * 50000;
  return { xMin: 0, xMax, yMin: 0, yMax, yStep: calcularYStep(yMax) };
}

/* ─── Formato (helpers de presentación, puros) ─────────────── */

/**
 * Formato numérico es-CO con redondeo a entero. No depende del DOM
 * (usa `Intl` que está disponible en node).
 */
export function formatearNumero(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CO').format(Math.round(n));
}

/** Escape de HTML básico para inserción segura en innerHTML. */
export function escaparHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
