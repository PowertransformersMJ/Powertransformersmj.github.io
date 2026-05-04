// Tests del dominio puro de refrigeración (módulo Mantenimiento Brigada).
//
// Cubre las constantes de calibración Westinghouse, las conversiones de
// caudal, el cálculo principal CFM/altitud, la selección de protección
// ABB MS116/S203 y los 4 criterios de compatibilidad mecánica.
//
// Casos golden tomados directamente de la calibración del archivo
// legacy: 24 MVA × 125 % → 48.000 CFM (verificación oficial AFINIA).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PENDIENTES_WESTINGHOUSE,
  FACTORES_CAUDAL,
  EJE_X_KVA,
  CURVAS_GRAFICO,
  ALTURA_ESCALA_ISA,
  COMPAT_ESTADO,
  DISPOSICIONES,
  MS116_DB,
  S203_DB,
  AUX_GUARDAMOTOR,
  AUX_BREAKER,
  interpolarPendiente,
  convertirCaudalACFM,
  cfmAM3s,
  factorCorreccionAltitud,
  calcularRefrigeracion,
  calcularUnidadesRequeridas,
  generarCurva,
  deduceOnafDesdeOnanYPct,
  deducePctDesdeOnanYOnaf,
  extraerCorrienteFan,
  seleccionarGuardamotor,
  seleccionarBreaker,
  calcularProteccionElectrica,
  evaluarCompatibilidad,
  mensajeDisposicion,
  calcularYStep,
  calcularAutoRango,
  formatearNumero,
  escaparHtml,
  MIX_ESTADO,
  evaluarMixVentiladores,
  sugerirMejoras,
  calcularProteccionMix,
  CONTACTOR_AF_DB,
  TAGS_SCADA,
  seleccionarContactor,
  calcularFLC,
  detectarFaltantes,
  construirResumenJSON
} from '../assets/js/domain/refrigeracion.js';

/* ─── Constantes inmutables ─────────────────────────────────── */

test('PENDIENTES_WESTINGHOUSE contiene los 4 puntos de calibración oficiales', () => {
  assert.equal(PENDIENTES_WESTINGHOUSE.length, 4);
  assert.deepEqual(PENDIENTES_WESTINGHOUSE[0], [115, 1.20]);
  assert.deepEqual(PENDIENTES_WESTINGHOUSE[1], [125, 2.00]);
  assert.deepEqual(PENDIENTES_WESTINGHOUSE[2], [133, 2.65]);
  assert.deepEqual(PENDIENTES_WESTINGHOUSE[3], [166, 4.25]);
});

test('PENDIENTES_WESTINGHOUSE es inmutable (Object.freeze)', () => {
  assert.throws(() => { PENDIENTES_WESTINGHOUSE[0] = [999, 999]; }, TypeError);
});

test('FACTORES_CAUDAL preserva la calibración original CFM/unidad', () => {
  assert.equal(FACTORES_CAUDAL.m3s,   2118.88);
  assert.equal(FACTORES_CAUDAL.m3min, 35.3147);
  assert.equal(FACTORES_CAUDAL.m3h,   0.58858);
  assert.equal(FACTORES_CAUDAL.cfm,   1.0);
  assert.equal(FACTORES_CAUDAL.cfs,   60.0);
});

test('EJE_X_KVA tiene 281 puntos cada 500 kVA (0–140.000 kVA)', () => {
  assert.equal(EJE_X_KVA.length, 281);
  assert.equal(EJE_X_KVA[0], 0);
  assert.equal(EJE_X_KVA[1], 500);
  assert.equal(EJE_X_KVA[280], 140_000);
});

test('CURVAS_GRAFICO tiene los 4 porcentajes oficiales', () => {
  assert.equal(CURVAS_GRAFICO.length, 4);
  assert.deepEqual(CURVAS_GRAFICO.map(c => c.pct), [115, 125, 133, 166]);
});

test('ALTURA_ESCALA_ISA es 8500 m (modelo barométrico estándar)', () => {
  assert.equal(ALTURA_ESCALA_ISA, 8500);
});

test('catálogos ABB MS116 y S203 traen el rango completo', () => {
  assert.equal(MS116_DB.length, 13);
  assert.equal(S203_DB.length, 4);
  assert.equal(MS116_DB[0].model, 'MS116-0.16');
  assert.equal(MS116_DB[12].model, 'MS116-32');
  assert.equal(S203_DB[0].model, 'S203-C16 MTB');
  assert.equal(AUX_GUARDAMOTOR.model, 'HK1-11');
  assert.equal(AUX_BREAKER.model, 'S2C-H11L');
});

/* ─── Interpolación Westinghouse ────────────────────────────── */

test('interpolarPendiente devuelve los valores exactos en los puntos de calibración', () => {
  assert.equal(interpolarPendiente(115), 1.20);
  assert.equal(interpolarPendiente(125), 2.00);
  assert.equal(interpolarPendiente(133), 2.65);
  assert.equal(interpolarPendiente(166), 4.25);
});

test('interpolarPendiente clampa fuera de los extremos', () => {
  assert.equal(interpolarPendiente(50), 1.20);   // por debajo de 115%
  assert.equal(interpolarPendiente(200), 4.25);  // por encima de 166%
});

test('interpolarPendiente interpola linealmente entre puntos', () => {
  // 120% está a mitad entre 115 (1.20) y 125 (2.00) → 1.60
  assert.equal(interpolarPendiente(120), 1.60);
  // 145% está entre 133 (2.65) y 166 (4.25); avance = (145-133)/(166-133) = 12/33
  // y = 2.65 + (4.25-2.65) * 12/33 = 2.65 + 1.6 * 0.36363... ≈ 3.2318
  assert.ok(Math.abs(interpolarPendiente(145) - 3.231818) < 1e-4);
});

/* ─── Conversiones de caudal ────────────────────────────────── */

test('convertirCaudalACFM aplica los 5 factores correctamente', () => {
  // 2.80 m³/s × 2118.88 ≈ 5933 CFM (golden FN063 50Hz)
  assert.equal(convertirCaudalACFM({ valor: 2.80, unidad: 'm3s' }), 5933);
  // 3.00 m³/s × 2118.88 ≈ 6357 CFM (golden FN063 60Hz)
  assert.equal(convertirCaudalACFM({ valor: 3.00, unidad: 'm3s' }), 6357);
  // CFM directo
  assert.equal(convertirCaudalACFM({ valor: 5933, unidad: 'cfm' }), 5933);
  // m³/min: 100 × 35.3147 ≈ 3531
  assert.equal(convertirCaudalACFM({ valor: 100, unidad: 'm3min' }), 3531);
  // CFS: 100 × 60 = 6000
  assert.equal(convertirCaudalACFM({ valor: 100, unidad: 'cfs' }), 6000);
  // m³/h: 1000 × 0.58858 ≈ 589
  assert.equal(convertirCaudalACFM({ valor: 1000, unidad: 'm3h' }), 589);
});

test('convertirCaudalACFM devuelve null para entradas inválidas', () => {
  assert.equal(convertirCaudalACFM({ valor: 0,    unidad: 'cfm' }), null);
  assert.equal(convertirCaudalACFM({ valor: -1,   unidad: 'cfm' }), null);
  assert.equal(convertirCaudalACFM({ valor: NaN,  unidad: 'cfm' }), null);
  assert.equal(convertirCaudalACFM({ valor: 100,  unidad: 'xxx' }), null);
});

test('cfmAM3s es la inversa de m3s → CFM', () => {
  // 5933 CFM ÷ 2118.88 ≈ 2.80 m³/s
  assert.ok(Math.abs(cfmAM3s(5933) - 2.7999) < 0.01);
  assert.equal(cfmAM3s(0), 0);
  assert.equal(cfmAM3s(-1), 0);
});

/* ─── Corrección por altitud ────────────────────────────────── */

test('factorCorreccionAltitud es 1.0 a nivel del mar', () => {
  assert.equal(factorCorreccionAltitud(0), 1.0);
  assert.equal(factorCorreccionAltitud(-100), 1.0); // clamp a 0
});

test('factorCorreccionAltitud crece exponencialmente con la altitud', () => {
  const f1500 = factorCorreccionAltitud(1500);  // ~1.193
  const f3000 = factorCorreccionAltitud(3000);  // ~1.423
  assert.ok(f1500 > 1 && f1500 < 1.25);
  assert.ok(f3000 > 1.4 && f3000 < 1.45);
  // Comprobación exacta: e^(3000/8500)
  assert.ok(Math.abs(f3000 - Math.exp(3000 / 8500)) < 1e-9);
});

/* ─── Cálculo principal de refrigeración ────────────────────── */

test('calcularRefrigeracion · golden 24 MVA × 125% = 48.000 CFM (verificación AFINIA)', () => {
  const r = calcularRefrigeracion({ kva_onan: 24000, pct: 125, alt: 0 });
  assert.equal(r.cfm_nivel_mar, 48000);
  assert.equal(r.onaf, 30000);
  assert.equal(r.delta, 6000);
  assert.equal(r.pendiente, 2.00);
  assert.equal(r.factor_altitud, 1.0);
  assert.equal(r.cfm_corregido, 48000);
});

test('calcularRefrigeracion · default 60 MVA × 133% = 159.000 CFM', () => {
  const r = calcularRefrigeracion({ kva_onan: 60000, pct: 133 });
  assert.equal(r.cfm_nivel_mar, 159000); // 2.65 × 60000
  assert.equal(r.onaf, 79800);
  assert.equal(r.delta, 19800);
});

test('calcularRefrigeracion aplica la corrección de altitud', () => {
  const r = calcularRefrigeracion({ kva_onan: 60000, pct: 133, alt: 1500 });
  assert.equal(r.cfm_nivel_mar, 159000);
  assert.ok(r.cfm_corregido > 189000 && r.cfm_corregido < 191000); // ~189.700
});

test('calcularRefrigeracion tolera entradas inválidas (devuelve 0)', () => {
  const r = calcularRefrigeracion({ kva_onan: -1, pct: 'foo', alt: NaN });
  assert.equal(r.onan, 0);
  assert.equal(r.cfm_nivel_mar, 0);
});

/* ─── Unidades requeridas (N = ⌈ CFM_total / CFM_fan ⌉) ─────── */

test('calcularUnidadesRequeridas · ceil estricto', () => {
  // 159000 / 5933 = 26.80 → 27
  const r = calcularUnidadesRequeridas({ cfm_total: 159000, cfm_fan: 5933 });
  assert.equal(r.n, 27);
  assert.equal(r.cfm_logrado, 27 * 5933);
  assert.equal(r.ok, true);
  // exceso = 27 × 5933 - 159000 = 160191 - 159000 = 1191
  assert.equal(r.exceso, 1191);
});

test('calcularUnidadesRequeridas · cobertura justa cuando es múltiplo exacto', () => {
  const r = calcularUnidadesRequeridas({ cfm_total: 12000, cfm_fan: 4000 });
  assert.equal(r.n, 3);
  assert.equal(r.cfm_logrado, 12000);
  assert.equal(r.cobertura_pct, 100);
  assert.equal(r.exceso, 0);
});

test('calcularUnidadesRequeridas · datos insuficientes → null', () => {
  const r = calcularUnidadesRequeridas({ cfm_total: 0, cfm_fan: 5000 });
  assert.equal(r.n, null);
  assert.equal(r.ok, false);
});

/* ─── Generación de curva ───────────────────────────────────── */

test('generarCurva 133% en 0/10 MVA da los puntos esperados', () => {
  const pts = generarCurva(133, [0, 10000, 60000, 100000]);
  assert.equal(pts.length, 4);
  assert.deepEqual(pts[0], { x: 0,      y: 0 });
  assert.deepEqual(pts[1], { x: 10000,  y: 26500 });
  assert.deepEqual(pts[2], { x: 60000,  y: 159000 });
  assert.deepEqual(pts[3], { x: 100000, y: 265000 });
});

/* ─── Sincronización ONAN/ONAF/% ────────────────────────────── */

test('deduceOnafDesdeOnanYPct redondea al kVA más cercano', () => {
  assert.equal(deduceOnafDesdeOnanYPct(60000, 133), 79800);
  assert.equal(deduceOnafDesdeOnanYPct(24000, 125), 30000);
  assert.equal(deduceOnafDesdeOnanYPct(0, 133), 0);
});

test('deducePctDesdeOnanYOnaf devuelve 1 decimal y null para entradas inválidas', () => {
  assert.equal(deducePctDesdeOnanYOnaf(60000, 79800), 133.0);
  assert.equal(deducePctDesdeOnanYOnaf(24000, 30000), 125.0);
  assert.equal(deducePctDesdeOnanYOnaf(60000, 60000), null); // ONAF debe ser > ONAN
  assert.equal(deducePctDesdeOnanYOnaf(0, 100), null);
});

/* ─── Protección ABB ────────────────────────────────────────── */

test('extraerCorrienteFan parsea "1.60 / 0.92 A (D/Y)" según conexión', () => {
  assert.equal(extraerCorrienteFan('1.60 / 0.92 A (D/Y)', 'D'), 1.60);
  assert.equal(extraerCorrienteFan('1.60 / 0.92 A (D/Y)', 'Y'), 0.92);
  assert.equal(extraerCorrienteFan('2.80 / 1.60 A (D/Y)', 'D'), 2.80);
});

test('extraerCorrienteFan tolera valor único (sin D/Y)', () => {
  assert.equal(extraerCorrienteFan('1.13 A KRENZ', 'D'), 1.13);
  assert.equal(extraerCorrienteFan('1.13 A KRENZ', 'Y'), 1.13);
});

test('extraerCorrienteFan devuelve null para entradas vacías', () => {
  assert.equal(extraerCorrienteFan('', 'D'), null);
  assert.equal(extraerCorrienteFan(null, 'D'), null);
});

test('seleccionarGuardamotor escoge MS116 dentro del rango (con tolerancia 5%)', () => {
  const g = seleccionarGuardamotor(1.60);
  assert.equal(g.model, 'MS116-1.6'); // 1.60 ∈ [1.00, 1.60]
  const g2 = seleccionarGuardamotor(0.92);
  assert.equal(g2.model, 'MS116-1.0'); // 0.92 ∈ [0.63, 1.00]
  const g3 = seleccionarGuardamotor(2.80);
  assert.equal(g3.model, 'MS116-4.0'); // 2.80 ∈ [2.50, 4.00]
});

test('seleccionarGuardamotor devuelve null fuera del rango catálogo (0.10–32 A)', () => {
  assert.equal(seleccionarGuardamotor(50), null);
  assert.equal(seleccionarGuardamotor(0), null);
  assert.equal(seleccionarGuardamotor(-1), null);
});

test('seleccionarBreaker escoge S203 con corriente nominal ≥ requerida', () => {
  assert.equal(seleccionarBreaker(10).model, 'S203-C16 MTB');
  assert.equal(seleccionarBreaker(20).model, 'S203-C25');
  assert.equal(seleccionarBreaker(30).model, 'S203-C40');
  assert.equal(seleccionarBreaker(45).model, 'S203-C50');
});

test('seleccionarBreaker devuelve null si excede el catálogo (> 50 A)', () => {
  assert.equal(seleccionarBreaker(60), null);
});

test('calcularProteccionElectrica · sistema completo 27 fans × 1.60 A', () => {
  const r = calcularProteccionElectrica({ amps_por_fan: 1.60, n_fans: 27 });
  assert.equal(r.amps_totales, 43.20);
  assert.equal(r.amps_min_breaker, 54.00); // 43.20 × 1.25
  assert.equal(r.guardamotor.model, 'MS116-1.6');
  // 54 A > 50 A → no hay S203 que cubra → null
  assert.equal(r.breaker, null);
  assert.equal(r.aux_guardamotor.model, 'HK1-11');
});

test('calcularProteccionElectrica · sistema 4 fans × 1.60 A', () => {
  const r = calcularProteccionElectrica({ amps_por_fan: 1.60, n_fans: 4 });
  assert.equal(r.amps_totales, 6.40);
  assert.equal(r.amps_min_breaker, 8.00);
  assert.equal(r.breaker.model, 'S203-C16 MTB');
});

/* ─── Compatibilidad mecánica ───────────────────────────────── */

test('evaluarCompatibilidad sin datos → 4 cards en estado ND', () => {
  const r = evaluarCompatibilidad({ A: null, B: null, C: null, diametro_mm: null, distancia_mm: null, disposicion: '' });
  assert.equal(r.c1.estado, COMPAT_ESTADO.ND);
  assert.equal(r.c2.estado, COMPAT_ESTADO.ND);
  assert.equal(r.c3.estado, COMPAT_ESTADO.ND);
  assert.equal(r.c4.estado, COMPAT_ESTADO.ND);
  assert.equal(r.resumen.nd, 4);
  assert.match(r.resumen.mensaje, /Seleccione la disposición mecánica/);
});

test('evaluarCompatibilidad con datos pero sin disposición · solo C4 forzosamente ND', () => {
  // Replica el comportamiento del archivo legacy: covDim cae al default B,
  // así que C1 puede calcular aún sin disposición. Solo C4 requiere
  // disposición explícita para emitir veredicto.
  const r = evaluarCompatibilidad({ A: 1650, B: 640, C: 380, diametro_mm: 630, distancia_mm: 50, disposicion: '' });
  assert.equal(r.c4.estado, COMPAT_ESTADO.ND);
  assert.match(r.resumen.mensaje, /Seleccione la disposición mecánica/);
});

test('evaluarCompatibilidad lateral con cobertura óptima', () => {
  const r = evaluarCompatibilidad({ A: 1650, B: 700, C: 380, diametro_mm: 630, distancia_mm: 80, disposicion: 'lateral' });
  // C1: 700 mm (B) vs 630 (Ø) → 700 ≥ 630 × 1.05 (661.5)? sí → OK
  assert.equal(r.c1.estado, COMPAT_ESTADO.OK);
  // C2 lateral: A=1650 vs Ø=630, ratio 2.62 → OK (>= 1.2 × Ø = 756)
  assert.equal(r.c2.estado, COMPAT_ESTADO.OK);
  // C3: 80 mm vs recomendado max(50, 63) = 63 → OK
  assert.equal(r.c3.estado, COMPAT_ESTADO.OK);
  // C4 lateral: B/Ø = 700/630 = 1.11 → OK
  assert.equal(r.c4.estado, COMPAT_ESTADO.OK);
  assert.equal(r.resumen.ok, 4);
});

test('evaluarCompatibilidad detecta incompatibilidad por cobertura insuficiente', () => {
  const r = evaluarCompatibilidad({ A: 800, B: 400, C: 380, diametro_mm: 630, distancia_mm: 100, disposicion: 'vertical_1' });
  // C1: covDim = A = 800, Ø=630 → 800 ≥ 630 × 1.05 (661.5)? sí → OK
  assert.equal(r.c1.estado, COMPAT_ESTADO.OK);
  // C2 vertical (no lateral, usa C): C=380 < 630 × 0.85 (535.5) → ERR
  assert.equal(r.c2.estado, COMPAT_ESTADO.ERR);
  // C4 vertical: A/Ø = 800/630 = 1.27 → WARN (entre 1.0 y 1.5)
  assert.equal(r.c4.estado, COMPAT_ESTADO.WARN);
  assert.ok(r.resumen.err >= 1);
});

test('evaluarCompatibilidad · holgura crítica (< 5% del Ø)', () => {
  const r = evaluarCompatibilidad({ A: null, B: null, C: null, diametro_mm: 630, distancia_mm: 10, disposicion: 'lateral' });
  // 10 mm < 630 × 0.05 = 31.5 → ERR
  assert.equal(r.c3.estado, COMPAT_ESTADO.ERR);
  assert.match(r.c3.desc, /CRÍTICO|RIESGO/i);
});

test('mensajeDisposicion devuelve string informativo o vacío', () => {
  assert.match(mensajeDisposicion('lateral'), /LATERAL/);
  assert.match(mensajeDisposicion('vertical_1'), /VERTICAL ↑/);
  assert.equal(mensajeDisposicion(''), '');
  assert.equal(mensajeDisposicion('xxx'), '');
});

/* ─── Heurísticas del gráfico ───────────────────────────────── */

test('calcularYStep escoge step apropiado por rango', () => {
  assert.equal(calcularYStep(3000),    500);
  assert.equal(calcularYStep(20000),   2000);
  assert.equal(calcularYStep(50000),   5000);
  assert.equal(calcularYStep(150000),  10000);
  assert.equal(calcularYStep(400000),  20000);
  assert.equal(calcularYStep(800000),  50000);
});

test('calcularAutoRango ajusta techo Y a múltiplo de 50.000', () => {
  const r = calcularAutoRango(60000);
  assert.equal(r.xMin, 0);
  assert.ok(r.xMax > 60000); // por encima del ONAN
  assert.equal(r.yMin, 0);
  assert.equal(r.yMax % 50000, 0);
  assert.ok(r.yMax >= 4.25 * r.xMax); // alcanza la curva 166%
});

/* ─── Helpers de presentación ───────────────────────────────── */

test('formatearNumero usa formato es-CO con redondeo', () => {
  assert.equal(formatearNumero(1234.567), '1.235');
  assert.equal(formatearNumero(48000), '48.000');
  assert.equal(formatearNumero(NaN), '—');
  assert.equal(formatearNumero(undefined), '—');
});

test('escaparHtml escapa caracteres peligrosos', () => {
  assert.equal(escaparHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escaparHtml(null), '');
  assert.equal(escaparHtml(undefined), '');
  assert.equal(escaparHtml(123), '123');
});

/* ─── Mix de ventiladores · multi-modelo con cantidades ──────── */

test('MIX_ESTADO expone los 3 estados', () => {
  assert.equal(MIX_ESTADO.APROBADO, 'aprobado');
  assert.equal(MIX_ESTADO.NO_APROBADO, 'no_aprobado');
  assert.equal(MIX_ESTADO.SIN_DATOS, 'sin_datos');
});

test('evaluarMixVentiladores: mix vacío o sin requerido devuelve sin_datos', () => {
  const r1 = evaluarMixVentiladores({ items: [], cfm_requerido: 50000 });
  assert.equal(r1.estado, 'sin_datos');
  assert.equal(r1.aprobado, false);
  const r2 = evaluarMixVentiladores({ items: [{ key: 'a', cfm_unitario: 5000, cantidad: 4 }], cfm_requerido: 0 });
  assert.equal(r2.estado, 'sin_datos');
});

test('evaluarMixVentiladores: suma aportes y aprueba si cubre el requerido', () => {
  const r = evaluarMixVentiladores({
    items: [
      { key: 'fn050', marca: 'ZIEHL-ABEGG', modelo: 'FN050', cfm_unitario: 4200, cantidad: 4 },
      { key: 'fn063', marca: 'ZIEHL-ABEGG', modelo: 'FN063', cfm_unitario: 5933, cantidad: 8 },
      { key: 'krenz', marca: 'KRENZ',       modelo: 'F20',   cfm_unitario: 7800, cantidad: 12 }
    ],
    cfm_requerido: 150000
  });
  assert.equal(r.cfm_aporte_total, 16800 + 47464 + 93600);
  assert.equal(r.n_unidades_total, 24);
  assert.equal(r.aprobado, true);
  assert.equal(r.estado, 'aprobado');
  assert.ok(r.cobertura_pct > 100);
  assert.equal(r.deficit, 0);
  assert.ok(r.exceso > 0);
  assert.ok(r.mensaje.includes('aprobado'));
});

test('evaluarMixVentiladores: reporta no_aprobado con déficit cuando no cubre', () => {
  const r = evaluarMixVentiladores({
    items: [
      { key: 'fn050', cfm_unitario: 4200, cantidad: 4 },
      { key: 'fn063', cfm_unitario: 5933, cantidad: 8 }
    ],
    cfm_requerido: 159000
  });
  assert.equal(r.aprobado, false);
  assert.equal(r.estado, 'no_aprobado');
  assert.ok(r.deficit > 0);
  assert.equal(r.exceso, 0);
  assert.ok(r.cobertura_pct < 100);
  assert.ok(r.mensaje.includes('NO aprobado'));
});

test('evaluarMixVentiladores: aporte_pct refleja contribución de cada modelo', () => {
  const r = evaluarMixVentiladores({
    items: [
      { key: 'a', cfm_unitario: 5000, cantidad: 2 },
      { key: 'b', cfm_unitario: 5000, cantidad: 2 }
    ],
    cfm_requerido: 10000
  });
  assert.equal(r.items[0].aporte_pct, 50.0);
  assert.equal(r.items[1].aporte_pct, 50.0);
});

test('evaluarMixVentiladores: clamp de cantidades negativas a 0', () => {
  const r = evaluarMixVentiladores({
    items: [{ key: 'x', cfm_unitario: 4000, cantidad: -3 }],
    cfm_requerido: 10000
  });
  assert.equal(r.items[0].cantidad, 0);
  assert.equal(r.cfm_aporte_total, 0);
  assert.equal(r.estado, 'sin_datos');
});

test('evaluarMixVentiladores: tolerancia=0 (default) exige cobertura ≥100%', () => {
  const r = evaluarMixVentiladores({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 9 }],   // 45000
    cfm_requerido: 50000,
    tolerancia_pct: 0
  });
  assert.equal(r.aprobado, false);
  assert.equal(r.estado, 'no_aprobado');
  assert.equal(r.cfm_umbral, 50000);
  assert.equal(r.tolerancia_pct, 0);
  assert.equal(r.deficit, 5000);
  // Cuando tol=0 el mensaje NO debe llevar el bloque parentizado del umbral relajado
  assert.ok(!r.mensaje.includes('con tolerancia'));
});

test('evaluarMixVentiladores: tolerancia=5 acepta cobertura ≥95%', () => {
  const r = evaluarMixVentiladores({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 10 }],  // 50000 vs req 52000 → 96.2%
    cfm_requerido: 52000,
    tolerancia_pct: 5
  });
  assert.equal(r.aprobado, true);                            // 50000 ≥ 52000 × 0.95 = 49400
  assert.equal(r.estado, 'aprobado');
  assert.equal(r.cfm_umbral, 49400);
  assert.equal(r.tolerancia_pct, 5);
  assert.ok(r.cobertura_pct < 100);                          // sigue por debajo del 100% nominal
  assert.ok(r.mensaje.includes('umbral 95'));                // "(umbral 95.0% con tolerancia 5.0%)"
  assert.ok(r.mensaje.includes('tolerancia 5'));
});

test('evaluarMixVentiladores: tolerancia=5 rechaza cobertura <95%', () => {
  const r = evaluarMixVentiladores({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 9 }],   // 45000 vs req 50000 → 90%
    cfm_requerido: 50000,
    tolerancia_pct: 5
  });
  assert.equal(r.aprobado, false);                           // 45000 < 50000 × 0.95 = 47500
  assert.equal(r.cfm_umbral, 47500);
  assert.equal(r.deficit, 2500);                             // umbral − total
  assert.ok(r.mensaje.includes('umbral 95'));
});

test('evaluarMixVentiladores: clamp de tolerancia fuera de rango', () => {
  const r1 = evaluarMixVentiladores({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 10 }],
    cfm_requerido: 50000,
    tolerancia_pct: -10   // negativa → 0
  });
  assert.equal(r1.tolerancia_pct, 0);
  const r2 = evaluarMixVentiladores({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 1 }],
    cfm_requerido: 50000,
    tolerancia_pct: 999   // > 100 → clamp a 100
  });
  assert.equal(r2.tolerancia_pct, 100);
  assert.equal(r2.aprobado, true);                           // umbral = 0 → cualquier cosa cubre
});

test('sugerirMejoras: devuelve [] cuando el mix ya cubre', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 30 }],
    cfm_requerido: 100000,
    fan_db: { a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 5000 } }
  });
  assert.deepEqual(sugs, []);
});

test('sugerirMejoras: devuelve [] sin cfm_requerido válido', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 4 }],
    cfm_requerido: 0,
    fan_db: {}
  });
  assert.deepEqual(sugs, []);
});

test('sugerirMejoras: estrategia agregar_unidades del modelo más eficiente del mix', () => {
  const sugs = sugerirMejoras({
    items: [
      { key: 'fn050', marca: 'ZIEHL', modelo: 'FN050', cfm_unitario: 4200, cantidad: 4 },
      { key: 'fn063', marca: 'ZIEHL', modelo: 'FN063', cfm_unitario: 5933, cantidad: 8 }
    ],
    cfm_requerido: 80000,
    fan_db: {
      fn050: { fan_marca: 'ZIEHL', fan_modelo: 'FN050', fan_cfm_nom: 4200 },
      fn063: { fan_marca: 'ZIEHL', fan_modelo: 'FN063', fan_cfm_nom: 5933 }
    }
  });
  const agregar = sugs.find(s => s.estrategia === 'agregar_unidades');
  assert.ok(agregar, 'debe haber sugerencia agregar_unidades');
  // El mejor del mix es FN063 (5933 CFM/u), no FN050
  assert.equal(agregar.cambios[0].key, 'fn063');
  assert.ok(agregar.aprobado);
});

test('sugerirMejoras: estrategia sustituir cambia el modelo más débil', () => {
  const sugs = sugerirMejoras({
    items: [
      { key: 'small', marca: 'X', modelo: 'Small', cfm_unitario: 2000, cantidad: 10 }
    ],
    cfm_requerido: 50000,
    fan_db: {
      small:  { fan_marca: 'X', fan_modelo: 'Small',  fan_cfm_nom: 2000 },
      medium: { fan_marca: 'X', fan_modelo: 'Medium', fan_cfm_nom: 4000 },
      large:  { fan_marca: 'X', fan_modelo: 'Large',  fan_cfm_nom: 6000 }
    },
    max_sugerencias: 10
  });
  const sub = sugs.find(s => s.estrategia === 'sustituir');
  assert.ok(sub, 'debe haber sugerencia sustituir');
  assert.equal(sub.cambios.length, 2);
  assert.equal(sub.cambios[0].accion, 'quitar');
  assert.equal(sub.cambios[0].key, 'small');
  assert.equal(sub.cambios[1].accion, 'agregar');
  // El primer candidato que cubre debe ser medium (10 × 4000 = 40k < 50k → no cubre)
  // entonces escoge large (10 × 6000 = 60k ≥ 50k → cubre)
  assert.equal(sub.cambios[1].key, 'large');
  assert.ok(sub.aprobado);
});

test('sugerirMejoras: estrategia agregar_modelo trae modelos que NO están en el mix', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'fn050', marca: 'ZIEHL', modelo: 'FN050', cfm_unitario: 4200, cantidad: 4 }],
    cfm_requerido: 80000,
    fan_db: {
      fn050: { fan_marca: 'ZIEHL', fan_modelo: 'FN050', fan_cfm_nom: 4200 },
      fn063: { fan_marca: 'ZIEHL', fan_modelo: 'FN063', fan_cfm_nom: 5933 },
      krenz: { fan_marca: 'KRENZ', fan_modelo: 'F20',   fan_cfm_nom: 7800 }
    }
  });
  const agregarMod = sugs.filter(s => s.estrategia === 'agregar_modelo');
  assert.ok(agregarMod.length > 0, 'debe haber al menos una sugerencia agregar_modelo');
  // Las sugerencias agregar_modelo NO deben mencionar fn050 (ya está en el mix)
  for (const s of agregarMod) {
    assert.notEqual(s.cambios[0].key, 'fn050');
  }
});

test('sugerirMejoras: respeta max_sugerencias', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'small', cfm_unitario: 2000, cantidad: 4 }],
    cfm_requerido: 100000,
    fan_db: {
      small:  { fan_marca: 'X', fan_modelo: 'S', fan_cfm_nom: 2000 },
      medium: { fan_marca: 'X', fan_modelo: 'M', fan_cfm_nom: 4000 },
      large:  { fan_marca: 'X', fan_modelo: 'L', fan_cfm_nom: 6000 },
      xl:     { fan_marca: 'X', fan_modelo: 'XL', fan_cfm_nom: 8000 }
    },
    max_sugerencias: 2
  });
  assert.ok(sugs.length <= 2);
});

test('sugerirMejoras: ordena por factibilidad alta>media>baja, luego por menor exceso', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 4000, cantidad: 5 }],
    cfm_requerido: 30000,
    fan_db: {
      a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 4000, fan_hz: '50', fan_rpm: 1000 },
      b: { fan_marca: 'X', fan_modelo: 'B', fan_cfm_nom: 5000, fan_hz: '50', fan_rpm: 1000 },
      c: { fan_marca: 'X', fan_modelo: 'C', fan_cfm_nom: 6000, fan_hz: '50', fan_rpm: 1000 }
    }
  });
  // Las primeras posiciones deben ser de factibilidad 'alta' antes que 'media'/'baja'
  const fOrden = { alta: 0, media: 1, baja: 2 };
  for (let i = 1; i < sugs.length; i++) {
    if (sugs[i - 1].aprobado === sugs[i].aprobado) {
      assert.ok(
        fOrden[sugs[i - 1].factibilidad] <= fOrden[sugs[i].factibilidad],
        `Orden por factibilidad roto: ${sugs[i - 1].factibilidad} antes que ${sugs[i].factibilidad}`
      );
    }
  }
});

test('sugerirMejoras: cada sugerencia trae los 3 campos enriquecidos', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 4000, cantidad: 5 }],
    cfm_requerido: 30000,
    fan_db: {
      a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 4000, fan_hz: '50', fan_rpm: 1000 }
    }
  });
  for (const s of sugs) {
    assert.ok(typeof s.impacto_estimado_cfm === 'number', `${s.estrategia} debe tener impacto_estimado_cfm numérico`);
    assert.ok(typeof s.implicaciones === 'string' && s.implicaciones.length > 10, `${s.estrategia} debe tener implicaciones string descriptivas`);
    assert.ok(['alta', 'media', 'baja'].includes(s.factibilidad), `${s.estrategia} debe tener factibilidad válida`);
  }
});

test('sugerirMejoras: estrategia vfd_uprate con variante en catálogo (50→60 Hz)', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'fn063_50', marca: 'ZIEHL', modelo: 'FN063', cfm_unitario: 5933, cantidad: 8 }],
    cfm_requerido: 80000,
    fan_db: {
      fn063_50: { fan_marca: 'ZIEHL', fan_modelo: 'FN063', fan_cfm_nom: 5933, fan_hz: '50', fan_rpm: 830 },
      fn063_60: { fan_marca: 'ZIEHL', fan_modelo: 'FN063', fan_cfm_nom: 6357, fan_hz: '60', fan_rpm: 820 }
    }
  });
  const vfd = sugs.find(s => s.estrategia === 'vfd_uprate');
  assert.ok(vfd, 'debe haber sugerencia vfd_uprate');
  assert.equal(vfd.factibilidad, 'baja');
  assert.equal(vfd.cambios.length, 2);
  assert.equal(vfd.cambios[0].accion, 'quitar');
  assert.equal(vfd.cambios[0].key, 'fn063_50');
  assert.equal(vfd.cambios[1].accion, 'agregar');
  assert.equal(vfd.cambios[1].key, 'fn063_60');
  assert.ok(vfd.implicaciones.includes('VFD'));
  assert.ok(vfd.impacto_estimado_cfm > 0);
});

test('sugerirMejoras: estrategia vfd_uprate genérica (sin variante en catálogo)', () => {
  const sugs = sugerirMejoras({
    items: [{ key: 'unico', marca: 'X', modelo: 'Solo', cfm_unitario: 5000, cantidad: 4 }],
    cfm_requerido: 40000,
    fan_db: {
      unico: { fan_marca: 'X', fan_modelo: 'Solo', fan_cfm_nom: 5000, fan_hz: '60', fan_rpm: 1200 }
    }
  });
  const vfd = sugs.find(s => s.estrategia === 'vfd_uprate');
  assert.ok(vfd, 'debe haber sugerencia vfd_uprate genérica');
  assert.equal(vfd.cambios.length, 0, 'genérica no aplica cambios mecánicos automáticos');
  // Factor 1.20 sobre 4 × 5000 = 20000 → impacto = 0.20 × 20000 = 4000
  assert.equal(vfd.impacto_estimado_cfm, 4000);
  assert.ok(vfd.descripcion.includes('1.20'));
});

test('sugerirMejoras: estrategia optimizacion_aerodinamica solo aparece con déficit > 10%', () => {
  // Caso 1: déficit ~5% → no aparece
  const sugsBajoDeficit = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 9 }],   // 45000 / 47000 → 4.3% déficit
    cfm_requerido: 47000,
    fan_db: { a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 5000 } }
  });
  assert.equal(sugsBajoDeficit.find(s => s.estrategia === 'optimizacion_aerodinamica'), undefined);

  // Caso 2: déficit ~30% → SÍ aparece
  const sugsAltoDeficit = sugerirMejoras({
    items: [{ key: 'a', cfm_unitario: 5000, cantidad: 7 }],   // 35000 / 50000 → 30% déficit
    cfm_requerido: 50000,
    fan_db: { a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 5000 } }
  });
  const aero = sugsAltoDeficit.find(s => s.estrategia === 'optimizacion_aerodinamica');
  assert.ok(aero, 'con déficit alto debe aparecer optimizacion_aerodinamica');
  assert.equal(aero.factibilidad, 'baja');
  assert.equal(aero.cambios.length, 0);
  assert.ok(aero.implicaciones.includes('CFD') || aero.implicaciones.includes('mecánica'));
});

test('sugerirMejoras: respeta tolerancia_pct al evaluar aprobación de cada sugerencia', () => {
  // Mix actual está al 90% del requerido. Con tolerancia=0 ninguna sugerencia
  // de "agregar 1 unidad mínima" aprueba. Con tolerancia=15% sí.
  const items = [{ key: 'a', cfm_unitario: 5000, cantidad: 9 }];   // 45000
  const fanDb = { a: { fan_marca: 'X', fan_modelo: 'A', fan_cfm_nom: 5000 } };

  const sugsTol0 = sugerirMejoras({ items, cfm_requerido: 50000, fan_db: fanDb, tolerancia_pct: 0 });
  // Con tol=0, agregar_unidades sugiere 1 extra (50000 ≥ 50000) → aprueba
  const agregar0 = sugsTol0.find(s => s.estrategia === 'agregar_unidades');
  assert.equal(agregar0.cambios[0].cantidad, 1);

  const sugsTol15 = sugerirMejoras({ items, cfm_requerido: 50000, fan_db: fanDb, tolerancia_pct: 15 });
  // Con tol=15, mix actual ya cubre umbral (45000 ≥ 42500) → no debería sugerir nada
  assert.deepEqual(sugsTol15, []);
});

test('calcularProteccionMix: mix vacío devuelve grupos vacío y totales en 0', () => {
  const r = calcularProteccionMix({ items: [] });
  assert.deepEqual(r.grupos, []);
  assert.equal(r.n_total, 0);
  assert.equal(r.amps_totales, 0);
  assert.equal(r.amps_min_breaker, 0);
  assert.equal(r.breaker, null);
});

test('calcularProteccionMix: agrupa por modelo · cada grupo lleva su guardamotor', () => {
  const r = calcularProteccionMix({
    items: [
      { key: 'fn050', marca: 'ZIEHL', modelo: 'FN050', cantidad: 4, amps_unitario: 0.65, kw_unitario: 0.18, peso_unitario: 8.5 },
      { key: 'fn063', marca: 'ZIEHL', modelo: 'FN063', cantidad: 8, amps_unitario: 1.13, kw_unitario: 0.30, peso_unitario: 14.2 }
    ]
  });
  assert.equal(r.grupos.length, 2);
  assert.equal(r.n_total, 12);
  assert.ok(r.grupos[0].guardamotor); // 0.65 A → MS116-1.0
  assert.ok(r.grupos[1].guardamotor); // 1.13 A → MS116-1.6
  assert.equal(r.grupos[0].amps_grupo, +(4 * 0.65).toFixed(2));
  assert.equal(r.grupos[1].amps_grupo, +(8 * 1.13).toFixed(2));
  assert.equal(r.amps_totales, +(4 * 0.65 + 8 * 1.13).toFixed(2));
  assert.equal(r.amps_min_breaker, +(r.amps_totales * 1.25).toFixed(2));
  assert.ok(r.breaker, 'debe seleccionar un breaker S203');
});

test('calcularProteccionMix: kw y peso totales agregados', () => {
  const r = calcularProteccionMix({
    items: [
      { key: 'a', cantidad: 4, amps_unitario: 1.0, kw_unitario: 0.20, peso_unitario: 10 },
      { key: 'b', cantidad: 6, amps_unitario: 1.5, kw_unitario: 0.30, peso_unitario: 12 }
    ]
  });
  assert.equal(r.kw_totales, +(4 * 0.20 + 6 * 0.30).toFixed(2));
  assert.equal(r.peso_total, +(4 * 10 + 6 * 12).toFixed(2));
});

test('calcularProteccionMix: factor_seguridad personalizado', () => {
  const r = calcularProteccionMix({
    items: [{ key: 'a', cantidad: 4, amps_unitario: 1.0 }],
    factor_seguridad: 1.5
  });
  assert.equal(r.amps_min_breaker, +(4.0 * 1.5).toFixed(2));
});

test('calcularProteccionMix: descarta items con cantidad o amperaje no positivos', () => {
  const r = calcularProteccionMix({
    items: [
      { key: 'a', cantidad: 4, amps_unitario: 1.0 },
      { key: 'b', cantidad: 0, amps_unitario: 2.0 },
      { key: 'c', cantidad: 4, amps_unitario: 0 }
    ]
  });
  assert.equal(r.grupos.length, 1);
  assert.equal(r.grupos[0].key, 'a');
});

/* ─── Microfase 3 · Contactores ABB AF + tags SCADA + FLC ────── */

test('CONTACTOR_AF_DB tiene 7 modelos ordenados por corriente AC-3', () => {
  assert.equal(CONTACTOR_AF_DB.length, 7);
  for (let i = 1; i < CONTACTOR_AF_DB.length; i++) {
    assert.ok(CONTACTOR_AF_DB[i].ac3_a > CONTACTOR_AF_DB[i - 1].ac3_a,
      'catálogo debe estar ordenado por ac3_a ASC');
  }
  assert.equal(CONTACTOR_AF_DB[0].model, 'AF09');
  assert.equal(CONTACTOR_AF_DB[6].model, 'AF80');
  for (const c of CONTACTOR_AF_DB) {
    assert.ok(c.model && c.ac3_a > 0 && c.kw_400v > 0 && c.pid && c.bobina);
  }
});

test('TAGS_SCADA expone los 4 tags estándar (RUN/FAULT/TRIP/READY)', () => {
  assert.equal(TAGS_SCADA.length, 4);
  const tags = TAGS_SCADA.map(t => t.tag);
  assert.deepEqual(tags, ['RUN', 'FAULT', 'TRIP', 'READY']);
  for (const t of TAGS_SCADA) {
    assert.ok(t.contacto && t.descripcion);
  }
});

test('seleccionarContactor: cubre FLC × 1.15 (factor de servicio AC-3)', () => {
  // FLC 0.65 A → × 1.15 = 0.75 → AF09 cubre con margen amplio
  const c1 = seleccionarContactor(0.65);
  assert.equal(c1.model, 'AF09');
  assert.ok(c1.margen_pct > 1000);

  // FLC 8 A → × 1.15 = 9.2 → AF12 (12 A) — no AF09 (9 A)
  const c2 = seleccionarContactor(8);
  assert.equal(c2.model, 'AF12');

  // FLC 25 A → × 1.15 = 28.75 → AF38 (38 A) — AF26 (26 A) no alcanza
  const c3 = seleccionarContactor(25);
  assert.equal(c3.model, 'AF38');
});

test('seleccionarContactor: factor personalizable', () => {
  // Sin margen (factor=1) → AF26 cubre 25 A directo
  const c = seleccionarContactor(25, 1);
  assert.equal(c.model, 'AF26');
});

test('seleccionarContactor: fuera de catálogo devuelve null', () => {
  assert.equal(seleccionarContactor(100), null);
  assert.equal(seleccionarContactor(0), null);
  assert.equal(seleccionarContactor(-1), null);
});

test('calcularFLC: ruta 1 con lectura directa de placa', () => {
  const r = calcularFLC({ amps_directo: 1.13 });
  assert.equal(r.flc_a, 1.13);
  assert.equal(r.fuente, 'placa');
  assert.ok(r.memoria.includes('lectura directa'));
});

test('calcularFLC: ruta 2 con cálculo desde potencia', () => {
  // Motor 250 W · 400 V · cos φ 0.79 · η 0.85 → FLC ≈ 0.54 A
  const r = calcularFLC({ p_w: 250, voltaje: 400, cosphi: 0.79, eficiencia: 0.85 });
  assert.equal(r.fuente, 'calculo');
  assert.ok(r.flc_a > 0.45 && r.flc_a < 0.65);
  assert.ok(r.memoria.includes('√3') && r.memoria.includes('250'));
  assert.ok(r.parametros.hp_eq > 0);
});

test('calcularFLC: acepta HP en lugar de p_w (conversión × 746)', () => {
  // 1 HP @ 400 V · cos φ 0.85 · η 0.85 → FLC ≈ 1.49 A
  const r = calcularFLC({ hp: 1, voltaje: 400, cosphi: 0.85, eficiencia: 0.85 });
  assert.equal(r.fuente, 'calculo');
  assert.equal(r.parametros.p_w, 746);
  assert.ok(r.flc_a > 1 && r.flc_a < 2);
});

test('calcularFLC: ruta 3 (sin datos) reporta campos faltantes', () => {
  const r = calcularFLC({ p_w: 0, voltaje: 0, cosphi: 0, eficiencia: 0 });
  assert.equal(r.flc_a, null);
  assert.equal(r.fuente, 'sin_datos');
  assert.ok(r.memoria.includes('faltan'));
  assert.ok(r.memoria.includes('potencia'));
});

test('calcularFLC: amps_directo tiene precedencia sobre cálculo', () => {
  const r = calcularFLC({ amps_directo: 2.5, p_w: 1000, voltaje: 400, cosphi: 0.85, eficiencia: 0.85 });
  assert.equal(r.flc_a, 2.5);
  assert.equal(r.fuente, 'placa');
});

test('calcularProteccionMix incluye contactor por grupo + tags_scada', () => {
  const r = calcularProteccionMix({
    items: [
      { key: 'a', marca: 'X', modelo: 'A', cantidad: 4, amps_unitario: 0.65 },
      { key: 'b', marca: 'X', modelo: 'B', cantidad: 8, amps_unitario: 1.13 }
    ]
  });
  assert.ok(r.grupos[0].contactor, 'grupo 0 debe tener contactor');
  assert.ok(r.grupos[1].contactor, 'grupo 1 debe tener contactor');
  assert.equal(r.grupos[0].contactor.model, 'AF09');
  assert.equal(r.grupos[1].contactor.model, 'AF09');
  assert.equal(r.tags_scada.length, 4);
});

test('calcularProteccionElectrica (legacy) también incluye contactor + tags_scada', () => {
  const r = calcularProteccionElectrica({ amps_por_fan: 1.13, n_fans: 8 });
  assert.ok(r.contactor, 'debe haber contactor');
  assert.equal(r.contactor.model, 'AF09');
  assert.equal(r.tags_scada.length, 4);
});

/* ─── Microfase 4 · Detección de faltantes ───────────────────── */

test('detectarFaltantes: mix vacío devuelve []', () => {
  assert.deepEqual(detectarFaltantes({ mix: [] }), []);
  assert.deepEqual(detectarFaltantes({ mix: undefined }), []);
});

test('detectarFaltantes: ficha completa no genera faltantes', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'a', marca: 'X', modelo: 'A', cantidad: 4,
      ficha: { fan_amp: '1.13 A', fan_kw: 300, fan_volt: '230/400V', fan_cosphi: 0.85, fan_peso: 14.2 }
    }]
  });
  assert.deepEqual(r, []);
});

test('detectarFaltantes: severidad crítico cuando no hay placa ni datos para derivar', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'a', marca: 'X', modelo: 'A', cantidad: 4,
      ficha: { /* todo vacío */ }
    }]
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].severidad, 'critico');
  assert.equal(r[0].campo, 'fan_amp');
});

test('detectarFaltantes: aviso cuando falta cos φ (asume 0.85)', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'a', marca: 'X', modelo: 'A', cantidad: 4,
      ficha: { fan_amp: '1.13 A', fan_kw: 300, fan_volt: '400V', fan_peso: 14 }
    }]
  });
  const fCos = r.find(x => x.campo === 'fan_cosphi');
  assert.ok(fCos, 'debe reportar fan_cosphi faltante');
  assert.equal(fCos.severidad, 'aviso');
  assert.equal(fCos.sustituto, 0.85);
  assert.ok(fCos.mensaje.includes('0.85'));
});

test('detectarFaltantes: info cuando falta peso (no bloquea cálculo)', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'a', marca: 'X', modelo: 'A', cantidad: 4,
      ficha: { fan_amp: '1.13 A', fan_kw: 300, fan_volt: '400V', fan_cosphi: 0.85 }
    }]
  });
  const fPeso = r.find(x => x.campo === 'fan_peso');
  assert.ok(fPeso, 'debe reportar fan_peso faltante');
  assert.equal(fPeso.severidad, 'info');
});

test('detectarFaltantes: omite items con cantidad <= 0', () => {
  const r = detectarFaltantes({
    mix: [
      { key: 'a', marca: 'X', modelo: 'A', cantidad: 0, ficha: {} },
      { key: 'b', marca: 'X', modelo: 'B', cantidad: 4, ficha: {} }
    ]
  });
  assert.equal(r.length, 1);                 // solo 'b'
  assert.equal(r[0].modelo, 'B');
});

test('detectarFaltantes: agrupa varios faltantes del mismo modelo', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'a', marca: 'X', modelo: 'A', cantidad: 4,
      ficha: { fan_amp: '1.13 A' /* falta cos φ, kw, volt, peso */ }
    }]
  });
  const campos = r.map(x => x.campo).sort();
  assert.deepEqual(campos, ['fan_cosphi', 'fan_kw', 'fan_peso']);
  // (fan_volt no aparece porque tieneP=false → no se evalúa la rama de aviso de voltaje)
});

test('detectarFaltantes: mensajes incluyen marca + modelo para identificar', () => {
  const r = detectarFaltantes({
    mix: [{
      key: 'fn063', marca: 'ZIEHL-ABEGG', modelo: 'FN063-6DL', cantidad: 8,
      ficha: { fan_amp: '1.13 A' }
    }]
  });
  for (const f of r) {
    assert.ok(f.mensaje.includes('ZIEHL-ABEGG'));
    assert.ok(f.mensaje.includes('FN063-6DL'));
  }
});

/* ─── Microfase 5 · construirResumenJSON ──────────────────────── */

test('construirResumenJSON: shape canónico con todas las claves del prompt', () => {
  const r = construirResumenJSON({
    mix: [
      { key: 'a', marca: 'ZIEHL', modelo: 'FN050', cfm_unitario: 4873, cantidad: 4,
        ficha: { fan_kw: 250, fan_amp: '0.65 A', fan_cosphi: 0.79 } }
    ],
    evaluacion: {
      aprobado: true, estado: 'aprobado',
      cfm_aporte_total: 19492, cfm_requerido: 18000, cfm_umbral: 18000,
      cobertura_pct: 108.3, deficit: 0, exceso: 1492,
      n_unidades_total: 4, tolerancia_pct: 0
    },
    proteccion: {
      grupos: [{
        key: 'a', marca: 'ZIEHL', modelo: 'FN050', cantidad: 4,
        amps_unitario: 0.65, amps_grupo: 2.6,
        guardamotor: { model: 'MS116-1.0', min: 0.63, max: 1.0, pid: '1SAM250000R1005' },
        contactor:   { model: 'AF09', ac3_a: 9, kw_400v: 4, pid: 'PID-X', bobina: 'univ', margen_pct: 1284.6 },
        aux_guardamotor: { model: 'HK1-11', pid: 'AUX-X', desc: '1NO+1NC' }
      }],
      breaker: { model: 'S203-C16 MTB', in: 16, pid: 'BRK-X', power_w: 7.5 },
      aux_breaker: { model: 'S2C-H11L', pid: 'AUXB-X', desc: '1NO+1NC' }
    },
    sugerencias: [],
    faltantes:   [],
    metadatos:   { transformador_id: '4123XXX', matricula: '4123XXX' }
  });
  // Claves exigidas por el prompt
  assert.ok(Array.isArray(r.selecciones));
  assert.ok(typeof r.cfm_requerido === 'number');
  assert.ok(typeof r.cfm_total === 'number');
  assert.ok(['APROBADO', 'REQUIERE AJUSTE'].includes(r.evaluacion));
  assert.ok(typeof r.razon === 'string');
  assert.ok(Array.isArray(r.estrategias_sugeridas));
  assert.ok(Array.isArray(r.seleccion_electrica));
  assert.ok(Array.isArray(r.faltantes));
  assert.ok(typeof r.metadatos === 'object');
});

test('construirResumenJSON: selecciones tiene la estructura correcta por modelo', () => {
  const r = construirResumenJSON({
    mix: [
      { key: 'fn063', marca: 'ZIEHL', modelo: 'FN063', cfm_unitario: 5933, cantidad: 8 }
    ],
    evaluacion: { aprobado: true, cfm_aporte_total: 47464, cfm_requerido: 40000 },
    proteccion: { grupos: [], breaker: null, aux_breaker: null }
  });
  assert.equal(r.selecciones.length, 1);
  assert.deepEqual(r.selecciones[0], {
    id: 'fn063', marca: 'ZIEHL', modelo: 'FN063',
    cantidad: 8, cfm_unit: 5933, cfm_total: 47464
  });
});

test('construirResumenJSON: evaluación APROBADO vs REQUIERE AJUSTE', () => {
  const r1 = construirResumenJSON({
    mix: [], evaluacion: { aprobado: true, cobertura_pct: 110 },
    proteccion: { grupos: [], breaker: null, aux_breaker: null }
  });
  assert.equal(r1.evaluacion, 'APROBADO');

  const r2 = construirResumenJSON({
    mix: [], evaluacion: { aprobado: false, deficit: 5000, cobertura_pct: 80 },
    proteccion: { grupos: [], breaker: null, aux_breaker: null }
  });
  assert.equal(r2.evaluacion, 'REQUIERE AJUSTE');
});

test('construirResumenJSON: seleccion_electrica trae guardamotor + contactor + breaker por grupo', () => {
  const r = construirResumenJSON({
    mix: [{ key: 'a', marca: 'ZIEHL', modelo: 'FN050', cfm_unitario: 4873, cantidad: 4,
            ficha: { fan_kw: 250 } }],
    evaluacion: { aprobado: true, cfm_aporte_total: 19492, cfm_requerido: 18000 },
    proteccion: {
      grupos: [{
        key: 'a', marca: 'ZIEHL', modelo: 'FN050', cantidad: 4,
        amps_unitario: 0.65, amps_grupo: 2.6,
        guardamotor: { model: 'MS116-1.0', min: 0.63, max: 1.0, pid: 'GM-PID' },
        contactor:   { model: 'AF09', ac3_a: 9, kw_400v: 4, pid: 'CT-PID', bobina: 'univ', margen_pct: 1284 },
        aux_guardamotor: { model: 'HK1-11', pid: 'AUX-PID', desc: '1NO+1NC' }
      }],
      breaker: { model: 'S203-C16', in: 16, pid: 'BRK-PID', power_w: 7.5 },
      aux_breaker: { model: 'S2C-H11L', pid: 'AUXB-PID', desc: '1NO+1NC' }
    }
  });
  const se = r.seleccion_electrica[0];
  assert.equal(se.id_ventilador, 'a');
  assert.equal(se.flc_A, 0.65);
  assert.equal(se.guardamotor.tipo, 'ABB MS116-1.0');
  assert.equal(se.contactor.modelo_sugerido, 'ABB AF09');
  assert.deepEqual(se.contactor.tags_SCADA, ['RUN', 'FAULT', 'READY']);
  // Breaker está a nivel raíz (1 ud para todo el sistema)
  assert.equal(r.breaker_sistema.modelo_sugerido, 'ABB S203-C16');
  assert.equal(r.breaker_sistema.curva, 'C');
  assert.equal(r.breaker_sistema.poder_de_corte_kA, 6);
  assert.equal(r.breaker_sistema.auxiliar_SCADA.tag, 'TRIP');
});

test('construirResumenJSON: faltantes se mapean a strings con severidad', () => {
  const r = construirResumenJSON({
    mix: [], evaluacion: { aprobado: true },
    proteccion: { grupos: [], breaker: null, aux_breaker: null },
    faltantes: [
      { campo: 'fan_cosphi', severidad: 'aviso', modelo: 'FN050', mensaje: 'falta cos φ' }
    ]
  });
  assert.equal(r.faltantes.length, 1);
  assert.ok(r.faltantes[0].includes('[AVISO]'));
  assert.ok(r.faltantes[0].includes('fan_cosphi'));
  assert.ok(r.faltantes[0].includes('FN050'));
});

test('construirResumenJSON: metadatos incluye fecha_generacion + version_resumen', () => {
  const r = construirResumenJSON({
    mix: [], evaluacion: { aprobado: true },
    proteccion: { grupos: [], breaker: null, aux_breaker: null }
  });
  assert.ok(r.metadatos.fecha_generacion.match(/^\d{4}-\d{2}-\d{2}T/));
  assert.equal(r.metadatos.version_resumen, '1.0');
  assert.ok(r.metadatos.norma_referencia.includes('IEEE'));
});

test('construirResumenJSON: razón refleja tolerancia cuando aplica', () => {
  const r = construirResumenJSON({
    mix: [],
    evaluacion: { aprobado: true, cobertura_pct: 96.2, tolerancia_pct: 5 },
    proteccion: { grupos: [], breaker: null, aux_breaker: null }
  });
  assert.ok(r.razon.includes('tolerancia 5'));
});
