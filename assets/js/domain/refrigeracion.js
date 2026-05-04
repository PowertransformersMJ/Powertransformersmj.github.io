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

/**
 * Catálogo de contactores ABB AF (control AC-3 trifásico, 400 V).
 * Selección por corriente AC-3 ≥ FLC × 1.15 (margen de servicio).
 * Bobina universal AC/DC.
 */
export const CONTACTOR_AF_DB = Object.freeze([
  { model: 'AF09', ac3_a:  9, kw_400v:  4.0, pid: '1SBL137001R1300', bobina: '24-60V AC/DC · universal' },
  { model: 'AF12', ac3_a: 12, kw_400v:  5.5, pid: '1SBL157001R1300', bobina: '24-60V AC/DC · universal' },
  { model: 'AF16', ac3_a: 16, kw_400v:  7.5, pid: '1SBL177001R1300', bobina: '24-60V AC/DC · universal' },
  { model: 'AF26', ac3_a: 26, kw_400v: 11.0, pid: '1SBL237001R1300', bobina: '100-250V AC/DC · universal' },
  { model: 'AF38', ac3_a: 38, kw_400v: 18.5, pid: '1SBL297001R1300', bobina: '100-250V AC/DC · universal' },
  { model: 'AF65', ac3_a: 65, kw_400v: 30.0, pid: '1SBL387001R1300', bobina: '100-250V AC/DC · universal' },
  { model: 'AF80', ac3_a: 80, kw_400v: 37.0, pid: '1SBL437001R1300', bobina: '100-250V AC/DC · universal' }
]);

/**
 * Tags SCADA estándar para integración con sistema de control.
 * Cada tag mapea una señal eléctrica a un contacto NO/NC físico.
 * Aplica conforme IEEE C37.91 (protección de transformadores).
 */
export const TAGS_SCADA = Object.freeze([
  { tag: 'RUN',    contacto: 'NO contactor',     descripcion: 'Cerrado cuando contactor energizado · indica motor en marcha' },
  { tag: 'FAULT',  contacto: 'NO guardamotor',   descripcion: 'Cerrado cuando guardamotor disparó · alarma de sobrecarga térmica' },
  { tag: 'TRIP',   contacto: 'NC breaker aux',   descripcion: 'Abierto cuando breaker disparó · falla mayor o cortocircuito' },
  { tag: 'READY',  contacto: 'NC guardamotor',   descripcion: 'Abierto si hay falla · sistema listo para arranque cuando cerrado' }
]);

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
 * Selecciona contactor ABB AF cuya corriente AC-3 cubre FLC × factor
 * de servicio (default 1.15 conforme AC-3 IEC 60947-4-1).
 *
 * @param {number} flc · corriente nominal del motor (FLC, A)
 * @param {number} factor · margen de servicio (default 1.15)
 * @returns {{model, ac3_a, kw_400v, pid, bobina, margen_pct}|null}
 */
export function seleccionarContactor(flc, factor = 1.15) {
  const i = Number(flc);
  const f = Number(factor) || 1.15;
  if (!Number.isFinite(i) || i <= 0) return null;
  const corrienteRequerida = i * f;
  const sel = CONTACTOR_AF_DB.find(c => c.ac3_a >= corrienteRequerida);
  if (!sel) return null;
  return {
    ...sel,
    margen_pct: +((sel.ac3_a - i) / i * 100).toFixed(1)
  };
}

/**
 * Calcula la corriente nominal de un motor trifásico (FLC) a partir
 * de su potencia, tensión, factor de potencia y eficiencia. Devuelve
 * el FLC + memoria de cálculo (fórmula con valores reales sustituidos)
 * para mostrar al usuario.
 *
 * Si se pasa `amps_directo` (lectura directa de placa), se usa ese
 * valor y la memoria documenta "lectura directa de placa".
 *
 * Fórmula: FLC = P / (√3 × V × cos φ × η)
 *   · P en watts (si se pasa hp se convierte: P = HP × 746)
 *   · V tensión de línea (V)
 *   · cos φ factor de potencia
 *   · η eficiencia (0..1)
 *
 * @param {{
 *   p_w?: number,
 *   hp?: number,
 *   voltaje?: number,
 *   cosphi?: number,
 *   eficiencia?: number,
 *   amps_directo?: number|null
 * }} input
 * @returns {{
 *   flc_a: number|null,
 *   fuente: 'placa' | 'calculo' | 'sin_datos',
 *   memoria: string,
 *   parametros: object
 * }}
 */
export function calcularFLC({ p_w, hp, voltaje, cosphi, eficiencia, amps_directo } = {}) {
  // Ruta 1 · lectura directa de placa
  const ad = Number(amps_directo);
  if (Number.isFinite(ad) && ad > 0) {
    return {
      flc_a:      +ad.toFixed(2),
      fuente:     'placa',
      memoria:    `FLC = ${ad.toFixed(2)} A (lectura directa de placa del motor · tag fan_amp del catálogo certificado)`,
      parametros: { amps_directo: ad }
    };
  }
  // Ruta 2 · cálculo desde potencia
  const Pw = Number(p_w) > 0 ? Number(p_w) : (Number(hp) > 0 ? Number(hp) * 746 : 0);
  const V  = Number(voltaje)    || 0;
  const cf = Number(cosphi)     || 0;
  const eta= Number(eficiencia) || 0;
  if (Pw > 0 && V > 0 && cf > 0 && eta > 0) {
    const sqrt3 = Math.sqrt(3);
    const flc = Pw / (sqrt3 * V * cf * eta);
    const HPeq = (Pw / 746).toFixed(2);
    return {
      flc_a:      +flc.toFixed(2),
      fuente:     'calculo',
      memoria:    `FLC = P / (√3 × V × cos φ × η) = ${Pw.toFixed(0)} W / (√3 × ${V} V × ${cf} × ${eta}) → ${flc.toFixed(2)} A · equivalente ${HPeq} HP`,
      parametros: { p_w: Pw, voltaje: V, cosphi: cf, eficiencia: eta, hp_eq: +HPeq }
    };
  }
  return {
    flc_a:      null,
    fuente:     'sin_datos',
    memoria:    'Sin datos suficientes para calcular FLC · faltan campos: ' + [
      Pw <= 0 ? 'potencia (P_w o HP)' : null,
      V  <= 0 ? 'voltaje' : null,
      cf <= 0 ? 'cos φ'   : null,
      eta<= 0 ? 'eficiencia (η)' : null
    ].filter(Boolean).join(', '),
    parametros: { p_w: Pw, voltaje: V, cosphi: cf, eficiencia: eta }
  };
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
    contactor:       seleccionarContactor(iF),
    breaker:         seleccionarBreaker(iM),
    aux_guardamotor: AUX_GUARDAMOTOR,
    aux_breaker:     AUX_BREAKER,
    tags_scada:      TAGS_SCADA
  };
}

/* ─── Mix de ventiladores (multi-modelo · cantidades) ────────── */

/** Estados de la evaluación del mix. */
export const MIX_ESTADO = Object.freeze({
  APROBADO:    'aprobado',
  NO_APROBADO: 'no_aprobado',
  SIN_DATOS:   'sin_datos'
});

/**
 * Evalúa una combinación de modelos de ventilador (cada uno con su
 * CFM unitario y la cantidad seleccionada) contra el CFM requerido.
 * Permite mezclar modelos distintos en el mismo transformador (ej.:
 * 4 × FN-050 + 8 × FN-063 + 12 × Krenz F20).
 *
 * Tolerancia: si `tolerancia_pct > 0` el umbral de aprobación se
 * relaja a `cfm_requerido × (1 − tol/100)`. Útil para casos donde el
 * proyecto admite cobertura mínima ej. 95% (tol=5).
 *
 * @param {{
 *   items: Array<{key?:string, modelo?:string, marca?:string,
 *                 cfm_unitario:number, cantidad:number}>,
 *   cfm_requerido: number,
 *   tolerancia_pct?: number
 * }} input
 * @returns {{
 *   items: Array<{key, modelo, marca, cfm_unitario, cantidad,
 *                 cfm_aporte, aporte_pct}>,
 *   cfm_aporte_total: number,
 *   cfm_requerido: number,
 *   cfm_umbral: number,
 *   tolerancia_pct: number,
 *   deficit: number,
 *   exceso: number,
 *   cobertura_pct: number|null,
 *   n_unidades_total: number,
 *   aprobado: boolean,
 *   estado: 'aprobado'|'no_aprobado'|'sin_datos',
 *   mensaje: string
 * }}
 */
export function evaluarMixVentiladores({ items, cfm_requerido, tolerancia_pct = 0 }) {
  const req = Number(cfm_requerido) || 0;
  const tol = Math.max(0, Math.min(100, Number(tolerancia_pct) || 0));
  const umbral = +(req * (1 - tol / 100)).toFixed(2);
  const list = Array.isArray(items) ? items : [];
  const detalle = list.map(it => {
    const cfmU = Math.max(0, Number(it.cfm_unitario) || 0);
    const cant = Math.max(0, Math.floor(Number(it.cantidad) || 0));
    return {
      key:          it.key || '',
      modelo:       it.modelo || '',
      marca:        it.marca || '',
      cfm_unitario: cfmU,
      cantidad:     cant,
      cfm_aporte:   +(cfmU * cant).toFixed(2),
      aporte_pct:   null
    };
  });
  const total = +detalle.reduce((s, x) => s + x.cfm_aporte, 0).toFixed(2);
  const nTotal = detalle.reduce((s, x) => s + x.cantidad, 0);
  detalle.forEach(d => {
    d.aporte_pct = total > 0 ? +(d.cfm_aporte / total * 100).toFixed(1) : null;
  });
  if (req <= 0 || total <= 0) {
    return {
      items: detalle, cfm_aporte_total: total, cfm_requerido: req,
      cfm_umbral: umbral, tolerancia_pct: tol,
      deficit: 0, exceso: 0, cobertura_pct: null, n_unidades_total: nTotal,
      aprobado: false, estado: MIX_ESTADO.SIN_DATOS,
      mensaje: 'Cargue al menos un modelo con cantidad y defina el CFM requerido.'
    };
  }
  const cob = +(total / req * 100).toFixed(1);
  const aprobado = total >= umbral;
  const def = aprobado ? 0 : +(umbral - total).toFixed(2);
  const exc = aprobado ? +(total - req).toFixed(2) : 0;
  const tolMsg = tol > 0 ? ` (umbral ${(100 - tol).toFixed(1)}% con tolerancia ${tol.toFixed(1)}%)` : '';
  return {
    items: detalle, cfm_aporte_total: total, cfm_requerido: req,
    cfm_umbral: umbral, tolerancia_pct: tol,
    deficit: def, exceso: exc, cobertura_pct: cob, n_unidades_total: nTotal,
    aprobado,
    estado: aprobado ? MIX_ESTADO.APROBADO : MIX_ESTADO.NO_APROBADO,
    mensaje: aprobado
      ? `Mix aprobado${tolMsg} · cobertura ${cob}% · ${exc > 0 ? `exceso ${exc.toFixed(0)} CFM sobre el requerido` : 'cubre el umbral exacto'}.`
      : `Mix NO aprobado · faltan ${def.toFixed(0)} CFM para alcanzar el umbral${tolMsg} (cobertura ${cob}%). Ajuste cantidades, agregue modelos o suba la tolerancia.`
  };
}

/**
 * Genera sugerencias para alcanzar el CFM requerido cuando el mix
 * actual no aprueba. Aplica hasta cinco estrategias y devuelve hasta
 * `max_sugerencias` ordenadas por factibilidad (alta > media > baja)
 * y luego por menor exceso.
 *
 * Estrategias:
 *   1. agregar_unidades — agrega N unidades del modelo con mayor
 *      CFM unitario ya en el mix.  [factibilidad: alta]
 *   2. sustituir — sustituye el modelo de menor CFM unitario del
 *      mix por otro modelo del catálogo con mayor CFM.  [media]
 *   3. agregar_modelo — agrega N unidades de un modelo del catálogo
 *      que NO esté en el mix actual.  [media]
 *   4. vfd_uprate — operar con variador de frecuencia a mayor RPM.
 *      Si existe variante de mayor frecuencia/RPM en el catálogo
 *      (ej. fn063_50 → fn063_60) usa el CFM exacto de esa variante;
 *      si no, asume factor 1.20 sobre el CFM nominal.  [baja]
 *   5. optimizacion_aerodinamica — sugerencia informativa cuando el
 *      déficit es > 10% del requerido. Estima +5–10% adicional al
 *      optimizar toma de aire / reducir codos y restricciones.
 *      [baja, sin cambios mecánicos cuantitativos]
 *
 * Cada sugerencia incluye:
 *   - impacto_estimado_cfm: delta CFM versus el mix actual
 *   - implicaciones: texto breve sobre coste y consideraciones
 *     operativas
 *   - factibilidad: 'alta' | 'media' | 'baja'
 *
 * @param {{
 *   items: Array<{key, modelo, marca, cfm_unitario, cantidad}>,
 *   cfm_requerido: number,
 *   fan_db: Record<string, {fan_marca, fan_modelo, fan_cfm_nom, fan_hz, fan_rpm}>,
 *   max_sugerencias?: number,
 *   tolerancia_pct?: number
 * }} input
 * @returns {Array<{
 *   estrategia: string,
 *   descripcion: string,
 *   cambios: Array<{accion, key, modelo, marca, cantidad, cfm_unitario}>,
 *   cfm_aporte_total: number,
 *   cobertura_pct: number,
 *   exceso: number,
 *   aprobado: boolean,
 *   impacto_estimado_cfm: number,
 *   implicaciones: string,
 *   factibilidad: 'alta'|'media'|'baja'
 * }>}
 */
export function sugerirMejoras({ items, cfm_requerido, fan_db, max_sugerencias = 5, tolerancia_pct = 0 }) {
  const req = Number(cfm_requerido) || 0;
  const tol = Math.max(0, Math.min(100, Number(tolerancia_pct) || 0));
  const umbral = req * (1 - tol / 100);
  const mix = Array.isArray(items) ? items.filter(it => (it.cantidad | 0) > 0 && (it.cfm_unitario || 0) > 0) : [];
  const db  = (fan_db && typeof fan_db === 'object') ? fan_db : {};
  if (req <= 0) return [];
  const total = mix.reduce((s, it) => s + (it.cfm_unitario || 0) * (it.cantidad | 0), 0);
  if (total >= umbral) return [];
  const deficit = req - total;
  const sugerencias = [];

  // ── 1) Agregar unidades del modelo más eficiente ya en el mix ──
  if (mix.length > 0) {
    const mejor = mix.reduce((a, b) => (b.cfm_unitario > a.cfm_unitario ? b : a));
    if (mejor.cfm_unitario > 0) {
      const deficitUmbral = umbral - total;
      const nExtra = Math.ceil(deficitUmbral / mejor.cfm_unitario);
      const nuevoTotal = total + nExtra * mejor.cfm_unitario;
      sugerencias.push({
        estrategia:  'agregar_unidades',
        descripcion: `Agrega ${nExtra} unidad${nExtra === 1 ? '' : 'es'} más de ${mejor.marca || ''} ${mejor.modelo || mejor.key} (cantidad pasa de ${mejor.cantidad} a ${mejor.cantidad + nExtra}).`,
        cambios: [{
          accion: 'agregar', key: mejor.key, modelo: mejor.modelo, marca: mejor.marca,
          cantidad: nExtra, cfm_unitario: mejor.cfm_unitario
        }],
        cfm_aporte_total:     +nuevoTotal.toFixed(2),
        cobertura_pct:        +(nuevoTotal / req * 100).toFixed(1),
        exceso:               +(nuevoTotal - req).toFixed(2),
        aprobado:             nuevoTotal >= umbral,
        impacto_estimado_cfm: +(nExtra * mejor.cfm_unitario).toFixed(2),
        implicaciones:        `Coste lineal por unidad. No requiere cambios de diseño ni reingeniería del montaje. Mismo guardamotor MS116 + auxiliares SCADA del modelo existente. Mayor consumo de espacio físico en gabinete.`,
        factibilidad:         'alta'
      });
    }
  }

  // ── 2) Sustituir el modelo más débil del mix por uno mayor ──
  if (mix.length > 0 && Object.keys(db).length > 0) {
    const debil = mix.reduce((a, b) => (b.cfm_unitario < a.cfm_unitario ? b : a));
    const candidatos = Object.entries(db)
      .map(([k, d]) => ({ key: k, cfm: +d.fan_cfm_nom || 0, modelo: d.fan_modelo || '', marca: d.fan_marca || '' }))
      .filter(c => c.cfm > debil.cfm_unitario && c.key !== debil.key);
    if (candidatos.length > 0) {
      candidatos.sort((a, b) => a.cfm - b.cfm);
      for (const c of candidatos) {
        const nuevoTotal = total - debil.cantidad * debil.cfm_unitario + debil.cantidad * c.cfm;
        if (nuevoTotal >= umbral) {
          sugerencias.push({
            estrategia:  'sustituir',
            descripcion: `Sustituye los ${debil.cantidad} × ${debil.marca || ''} ${debil.modelo || debil.key} por ${debil.cantidad} × ${c.marca} ${c.modelo} (mayor CFM unitario: ${Math.round(c.cfm)} vs ${Math.round(debil.cfm_unitario)}).`,
            cambios: [
              { accion: 'quitar',   key: debil.key, modelo: debil.modelo, marca: debil.marca, cantidad: debil.cantidad, cfm_unitario: debil.cfm_unitario },
              { accion: 'agregar',  key: c.key,     modelo: c.modelo,     marca: c.marca,     cantidad: debil.cantidad, cfm_unitario: c.cfm }
            ],
            cfm_aporte_total:     +nuevoTotal.toFixed(2),
            cobertura_pct:        +(nuevoTotal / req * 100).toFixed(1),
            exceso:               +(nuevoTotal - req).toFixed(2),
            aprobado:             true,
            impacto_estimado_cfm: +(debil.cantidad * (c.cfm - debil.cfm_unitario)).toFixed(2),
            implicaciones:        `Requiere recalcular protección eléctrica del modelo nuevo (corriente, guardamotor MS116, breaker). Diámetro y montaje pueden ser distintos: verificar compatibilidad mecánica con el cuerpo de radiador (sec. 7). Mismo conteo de unidades.`,
            factibilidad:         'media'
          });
          break;
        }
      }
    }
  }

  // ── 3) Agregar un modelo nuevo del catálogo (no en el mix) ──
  const enMix = new Set(mix.map(m => m.key).filter(Boolean));
  const candidatosNuevos = Object.entries(db)
    .map(([k, d]) => ({ key: k, cfm: +d.fan_cfm_nom || 0, modelo: d.fan_modelo || '', marca: d.fan_marca || '' }))
    .filter(c => c.cfm > 0 && !enMix.has(c.key));
  candidatosNuevos.sort((a, b) => b.cfm - a.cfm);
  for (const c of candidatosNuevos) {
    const deficitUmbral = Math.max(0, umbral - total);
    const nExtra = Math.ceil(deficitUmbral / c.cfm);
    const nuevoTotal = total + nExtra * c.cfm;
    sugerencias.push({
      estrategia:  'agregar_modelo',
      descripcion: `Agrega ${nExtra} × ${c.marca} ${c.modelo} (modelo no incluido en el mix actual · ${Math.round(c.cfm)} CFM/u).`,
      cambios: [{
        accion: 'agregar', key: c.key, modelo: c.modelo, marca: c.marca,
        cantidad: nExtra, cfm_unitario: c.cfm
      }],
      cfm_aporte_total:     +nuevoTotal.toFixed(2),
      cobertura_pct:        +(nuevoTotal / req * 100).toFixed(1),
      exceso:               +(nuevoTotal - req).toFixed(2),
      aprobado:             nuevoTotal >= umbral,
      impacto_estimado_cfm: +(nExtra * c.cfm).toFixed(2),
      implicaciones:        `Aumenta diversidad de repuestos en inventario (un SKU adicional). Requiere guardamotor MS116 dedicado + auxiliar SCADA por unidad nueva. Verificar compatibilidad mecánica con el radiador del lado donde se instalará.`,
      factibilidad:         'media'
    });
    if (sugerencias.filter(s => s.estrategia === 'agregar_modelo').length >= 2) break;
  }

  // ── 4) VFD / uprate por frecuencia o asunción +20% ──
  // Busca variante del mismo modelo a mayor frecuencia (ej. _50 → _60).
  if (mix.length > 0) {
    const mejor = mix.reduce((a, b) => (b.cfm_unitario > a.cfm_unitario ? b : a));
    const dbEntries = Object.entries(db);
    // Heurística: el mismo modelo con clave que comparte prefijo
    // (zn045_50, zn045_60, zn045_60h) y mayor CFM nominal.
    const baseKey = (mejor.key || '').replace(/_(50|60|60h)$/, '');
    const variantes = dbEntries
      .map(([k, d]) => ({ key: k, cfm: +d.fan_cfm_nom || 0, modelo: d.fan_modelo || '', marca: d.fan_marca || '', hz: String(d.fan_hz || ''), rpm: +d.fan_rpm || 0 }))
      .filter(v => v.key.startsWith(baseKey) && v.key !== mejor.key && v.cfm > mejor.cfm_unitario);
    variantes.sort((a, b) => a.cfm - b.cfm);
    const variante = variantes[0] || null;
    let aporteVfd, descVfd, implicVfd, factor;
    if (variante) {
      aporteVfd = +(mejor.cantidad * (variante.cfm - mejor.cfm_unitario)).toFixed(2);
      factor = +(variante.cfm / mejor.cfm_unitario).toFixed(2);
      descVfd = `Operar el modelo ${mejor.marca} ${mejor.modelo} a ${variante.hz} Hz (variante ${variante.modelo} del catálogo: ${variante.rpm} RPM) con variador de frecuencia. CFM unitario sube de ${Math.round(mejor.cfm_unitario)} a ${Math.round(variante.cfm)} (factor ${factor}×).`;
      implicVfd = `Requiere 1 VFD ABB ACS580 (o equiv.) por motor (~USD 800–1.500/u dependiendo HP). Mayor consumo eléctrico (~8% con uprate) + ruido + desgaste mecánico de aspas. Coordinar rampa de arranque con SCADA. Verificar tensión nominal del motor (algunas variantes 60h requieren 460 V).`;
    } else {
      // Asunción genérica: +20% CFM con VFD
      factor = 1.20;
      aporteVfd = +(mejor.cantidad * mejor.cfm_unitario * 0.20).toFixed(2);
      descVfd = `Operar el modelo ${mejor.marca} ${mejor.modelo} con variador de frecuencia (VFD) para incrementar RPM ~20% (factor estimado 1.20×). CFM unitario estimado: ${Math.round(mejor.cfm_unitario)} → ${Math.round(mejor.cfm_unitario * 1.20)}.`;
      implicVfd = `Requiere 1 VFD por motor + ingeniería específica para confirmar margen de RPM seguro del modelo (sin exceder rpm_max del rotor). Mayor consumo eléctrico, ruido y desgaste. Coordinar con fabricante del motor antes de implementar.`;
    }
    const nuevoTotalVfd = total + aporteVfd;
    sugerencias.push({
      estrategia:  'vfd_uprate',
      descripcion: descVfd,
      cambios: variante
        ? [
            { accion: 'quitar',  key: mejor.key,     modelo: mejor.modelo,    marca: mejor.marca,    cantidad: mejor.cantidad, cfm_unitario: mejor.cfm_unitario },
            { accion: 'agregar', key: variante.key, modelo: variante.modelo, marca: variante.marca, cantidad: mejor.cantidad, cfm_unitario: variante.cfm }
          ]
        : [],   // sugerencia genérica · sin cambio aplicable mecánicamente
      cfm_aporte_total:     +nuevoTotalVfd.toFixed(2),
      cobertura_pct:        +(nuevoTotalVfd / req * 100).toFixed(1),
      exceso:               +(nuevoTotalVfd - req).toFixed(2),
      aprobado:             nuevoTotalVfd >= umbral,
      impacto_estimado_cfm: aporteVfd,
      implicaciones:        implicVfd,
      factibilidad:         'baja'
    });
  }

  // ── 5) Optimización aerodinámica (informativa, déficit > 10%) ──
  if (deficit / req > 0.10) {
    const aporteAero = +(total * 0.075).toFixed(2);  // estimación 7.5% promedio (5–10%)
    const nuevoTotalAero = total + aporteAero;
    sugerencias.push({
      estrategia:  'optimizacion_aerodinamica',
      descripcion: `Optimizar la aerodinámica del flujo: rediseñar toma de aire del compartimiento, reducir codos y restricciones del ducto interno del transformador. Estimación de ganancia: 5–10% del CFM nominal sin cambios al motoventilador.`,
      cambios:     [],   // sin cambios al mix; requiere ingeniería específica
      cfm_aporte_total:     +nuevoTotalAero.toFixed(2),
      cobertura_pct:        +(nuevoTotalAero / req * 100).toFixed(1),
      exceso:               +(nuevoTotalAero - req).toFixed(2),
      aprobado:             nuevoTotalAero >= umbral,
      impacto_estimado_cfm: aporteAero,
      implicaciones:        `Sin cambios al motoventilador ni a la protección eléctrica. Requiere análisis CFD o intervención mecánica del cuerpo del transformador. Coste medio (USD 2.000–8.000) según alcance. Considerar solo si déficit es alto y el resto de estrategias no son viables.`,
      factibilidad:         'baja'
    });
  }

  // Ordena: aprobado=true primero, luego por factibilidad alta>media>baja,
  // luego por menor exceso (ajuste más fino).
  const fOrden = { alta: 0, media: 1, baja: 2 };
  return sugerencias
    .sort((a, b) => {
      if (a.aprobado !== b.aprobado) return a.aprobado ? -1 : 1;
      const f = (fOrden[a.factibilidad] ?? 99) - (fOrden[b.factibilidad] ?? 99);
      if (f !== 0) return f;
      return Math.abs(a.exceso) - Math.abs(b.exceso);
    })
    .slice(0, max_sugerencias);
}

/**
 * Cálculo de protección eléctrica para un mix de modelos. Cada
 * modelo tiene su propio guardamotor (dimensionado a la corriente
 * por unidad), y hay un único breaker principal dimensionado a la
 * corriente total del sistema con factor de seguridad NEC 430.
 *
 * @param {{
 *   items: Array<{key, modelo, marca, cantidad, amps_unitario,
 *                 kw_unitario?:number, peso_unitario?:number}>,
 *   factor_seguridad?: number
 * }} input
 * @returns {{
 *   grupos: Array<{key, modelo, marca, cantidad, amps_unitario,
 *                  amps_grupo, kw_grupo, peso_grupo,
 *                  guardamotor, aux_guardamotor}>,
 *   n_total: number,
 *   amps_totales: number,
 *   amps_min_breaker: number,
 *   kw_totales: number,
 *   peso_total: number,
 *   breaker: object|null,
 *   aux_breaker: object
 * }}
 */
export function calcularProteccionMix({ items, factor_seguridad = 1.25 }) {
  const fs = Number(factor_seguridad) || 1.25;
  const list = Array.isArray(items) ? items : [];
  const grupos = list
    .filter(it => (it.cantidad | 0) > 0 && Number(it.amps_unitario) > 0)
    .map(it => {
      const cant = Math.floor(Number(it.cantidad) || 0);
      const iU   = Number(it.amps_unitario) || 0;
      const kwU  = Number(it.kw_unitario)   || 0;
      const pU   = Number(it.peso_unitario) || 0;
      return {
        key:    it.key || '',
        modelo: it.modelo || '',
        marca:  it.marca || '',
        cantidad: cant,
        amps_unitario: iU,
        amps_grupo: +(cant * iU).toFixed(2),
        kw_grupo:   +(cant * kwU).toFixed(2),
        peso_grupo: +(cant * pU).toFixed(2),
        guardamotor:     seleccionarGuardamotor(iU),
        contactor:       seleccionarContactor(iU),
        aux_guardamotor: AUX_GUARDAMOTOR
      };
    });
  const nTotal = grupos.reduce((s, g) => s + g.cantidad, 0);
  const iTot   = +grupos.reduce((s, g) => s + g.amps_grupo, 0).toFixed(2);
  const iMin   = +(iTot * fs).toFixed(2);
  const kwTot  = +grupos.reduce((s, g) => s + g.kw_grupo, 0).toFixed(2);
  const pTot   = +grupos.reduce((s, g) => s + g.peso_grupo, 0).toFixed(2);
  return {
    grupos,
    n_total:          nTotal,
    amps_totales:     iTot,
    amps_min_breaker: iMin,
    kw_totales:       kwTot,
    peso_total:       pTot,
    breaker:          seleccionarBreaker(iMin),
    aux_breaker:      AUX_BREAKER,
    tags_scada:       TAGS_SCADA
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
