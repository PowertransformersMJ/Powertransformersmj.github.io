// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Triángulo de Duval 1 (aceite mineral) · `99 §131`
// ──────────────────────────────────────────────────────────────────────────────
// Fronteras de Duval, IEEE Electrical Insulation Magazine 18(3):8-17, 2002, Fig. 1 (las mismas de IEEE C57.104-2019
// §6.2.3): PD en 98 % de CH₄; C₂H₄ en 20/23/40/50 %; C₂H₂ en 4/13/15/29 %. Verificadas contra una malla de 80.601 puntos
// (0 diferencias con la regla de pages/parque-transformadores.html, que ya era correcta). La regla vieja de
// dga_diagnostico.js clasificaba mal ~51 % del área; ahora delega aquí.
// El triángulo dice QUÉ TIPO de falla sugieren los gases, no SI hay falla (USBR FIST 3-31, jun-2003, §5.3: «la
// mostrará en todo transformador, la tenga o no»): solo se colorea con gas significativo (`significancia`).
// Archivo NUEVO a propósito (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { calcularCalifTDGC, calcularCalifCO, calcularCalifCO2, calcularCalifC2H2 } from './salud_activos.js';

export const GASES_DGA = Object.freeze(['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2']);

/** Zonas con su nombre, la banda de temperatura de la zona y cómo responde a la CARGA (criterio con fuente). */
export const ZONAS_DUVAL1 = Object.freeze({
  PD: Object.freeze({ nombre: 'Descargas parciales', banda: null, familia: 'descarga',
    carga: 'La carga no cambia este tipo de defecto: depende de la tensión y del campo eléctrico. El triángulo 1 no usa el hidrógeno: véalo en los ppm y en las pruebas eléctricas.' }),
  T1: Object.freeze({ nombre: 'Falla térmica de baja temperatura', banda: 'menos de 300 °C', familia: 'termica',
    carga: 'Más carga trae más calor de fondo y el papel envejece más rápido. En servicio suele ser papel; en papel el punto se queda en T1 o T2 aunque suba la temperatura (Duval 2002).' }),
  T2: Object.freeze({ nombre: 'Falla térmica de temperatura media', banda: '300 a 700 °C', familia: 'termica',
    carga: 'Más carga trae más calor de fondo y el papel envejece más rápido. En servicio suele ser papel; en papel el punto se queda en T1 o T2 aunque suba la temperatura (Duval 2002).' }),
  T3: Object.freeze({ nombre: 'Falla térmica de alta temperatura', banda: 'más de 700 °C', familia: 'termica',
    carga: 'Depende del origen: si es una conexión, un contacto o calentamiento por flujo disperso, crece con el cuadrado de la corriente; si es el núcleo, no (depende de la tensión). Lo aclaran la resistencia de devanados y la corriente de excitación.' }),
  DT: Object.freeze({ nombre: 'Mezcla de falla térmica y eléctrica', banda: null, familia: 'mixta',
    carga: 'Mixto: la parte térmica puede crecer con la carga y la parte eléctrica no. Si el cambiador comparte aceite con la cuba, puede ser contaminación del cambiador (Duval 2002).' }),
  D1: Object.freeze({ nombre: 'Descargas de baja energía', banda: null, familia: 'descarga',
    carga: 'La carga no cambia este tipo de defecto: depende de la tensión. Vigilar con muestras y pruebas eléctricas.' }),
  D2: Object.freeze({ nombre: 'Descargas de alta energía (arco)', banda: null, familia: 'descarga',
    carga: 'La carga no produce el arco; con más corriente, un contacto con arco trabaja más exigido. Vigilar con muestras y pruebas eléctricas.' }),
});

/** Vértices de cada zona en porcentajes (CH₄, C₂H₄, C₂H₂): para dibujar el triángulo. */
export const POLIGONOS_DUVAL1 = Object.freeze({
  PD: [[100, 0, 0], [98, 2, 0], [98, 0, 2]],
  T1: [[98, 2, 0], [80, 20, 0], [76, 20, 4], [96, 0, 4], [98, 0, 2]],
  T2: [[80, 20, 0], [50, 50, 0], [46, 50, 4], [76, 20, 4]],
  T3: [[50, 50, 0], [0, 100, 0], [0, 85, 15], [35, 50, 15]],
  DT: [[96, 0, 4], [46, 50, 4], [35, 50, 15], [0, 85, 15], [0, 71, 29], [31, 40, 29], [47, 40, 13], [87, 0, 13]],
  D1: [[87, 0, 13], [64, 23, 13], [0, 23, 77], [0, 0, 100]],
  D2: [[64, 23, 13], [47, 40, 13], [31, 40, 29], [0, 71, 29], [0, 23, 77]],
});

/**
 * Gas significativo para leer el triángulo: USBR FIST 3-31 (jun-2003) Tabla 3, límites L1, en ppm. FIST pide además una
 * velocidad de aumento (G2) que con UNA muestra no se puede calcular: se dice en pantalla. La suma mínima de los tres gases
 * del triángulo (10 ppm) es criterio de ingeniería: por debajo, los porcentajes son ruido.
 */
export const REFERENCIA_SIGNIFICANCIA = Object.freeze({
  fuente: 'USBR FIST 3-31 (2003), Tabla 3, límites L1',
  L1: Object.freeze({ H2: 100, CH4: 75, C2H2: 3, C2H4: 75, C2H6: 75 }),
  sumaMinTriangulo: 10,
});

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const red = (x) => Math.round(x * 1e9) / 1e9;   // 29 % exacto no puede quedar en 28,999999999999996

/** Zona por porcentajes (suman 100). Orden sin huecos ni solapes. */
function zonaPorPct(M, E, A) {
  if (M >= 98) return 'PD';
  if (A < 4) return E < 20 ? 'T1' : (E < 50 ? 'T2' : 'T3');
  if (E >= 50 && A < 15) return 'T3';
  if (A < 13) return 'DT';
  if (E < 23) return 'D1';
  if (A >= 29) return 'D2';
  if (E < 40) return 'D2';
  return 'DT';
}

/**
 * Zona del triángulo de Duval 1. Un gas que falta NO es cero: sin los tres no hay punto.
 * @returns {null | {zona:string, pct:{CH4,C2H4,C2H2}, suma:number}}
 */
export function zonaDuval1(ch4, c2h4, c2h2) {
  const m = num(ch4); const e = num(c2h4); const a = num(c2h2);
  if (m == null || e == null || a == null || m < 0 || e < 0 || a < 0) return null;
  const s = m + e + a;
  if (!(s > 0)) return null;
  const M = red((100 * m) / s); const E = red((100 * e) / s); const A = red((100 * a) / s);
  return { zona: zonaPorPct(M, E, A), pct: { CH4: M, C2H4: E, C2H2: A }, suma: s };
}

/**
 * Distancia (en puntos porcentuales) a la zona vecina más cercana, moviendo gas entre dos de los tres componentes.
 * Es un hecho geométrico: dice cuánto tendría que cambiar la medida para cambiar de zona.
 * @returns {null | {puntos:number, zona:string}}
 */
export function distanciaFrontera(pct, paso = 0.05, max = 40) {
  if (!pct) return null;
  const base = zonaPorPct(pct.CH4, pct.C2H4, pct.C2H2);
  const dirs = [[1, -1, 0], [-1, 1, 0], [1, 0, -1], [-1, 0, 1], [0, 1, -1], [0, -1, 1]];
  for (let d = paso; d <= max + 1e-9; d += paso) {
    for (const [x, y, z] of dirs) {
      const M = red(pct.CH4 + x * d); const E = red(pct.C2H4 + y * d); const A = red(pct.C2H2 + z * d);
      if (M < 0 || E < 0 || A < 0 || M > 100 || E > 100 || A > 100) continue;
      const zona = zonaPorPct(M, E, A);
      if (zona !== base) return { puntos: Math.round(d * 100) / 100, zona };
    }
  }
  return null;
}

/**
 * ¿Hay gas suficiente para leer el triángulo? (USBR FIST 3-31 Tabla 3, L1 + suma mínima de criterio).
 * `sumaBaja`: los tres gases del triángulo son tan pocos que sus proporciones no son fiables, AUNQUE otro gas pase su L1
 * (entonces no es «nivel de fondo»: la pantalla lo dice y nombra `sobreL1`).
 * @returns {{significativo:boolean, sobreL1:string[], sumaBaja:boolean, motivo:string}}
 */
export function significancia(gases, ref = REFERENCIA_SIGNIFICANCIA) {
  const g = gases || {};
  const sobreL1 = Object.entries(ref.L1).filter(([k, v]) => num(g[k]) != null && g[k] >= v).map(([k]) => k);
  const suma = [g.CH4, g.C2H4, g.C2H2].every((x) => num(x) != null) ? g.CH4 + g.C2H4 + g.C2H2 : null;
  if (suma == null) return { significativo: false, sobreL1, sumaBaja: false, motivo: 'faltan gases del triángulo' };
  if (suma < ref.sumaMinTriangulo) return { significativo: false, sobreL1, sumaBaja: true, motivo: 'metano, etileno y acetileno suman menos de ' + ref.sumaMinTriangulo + ' ppm' };
  if (!sobreL1.length) return { significativo: false, sobreL1, sumaBaja: false, motivo: 'ningún gas llega a su límite L1' };
  return { significativo: true, sobreL1, sumaBaja: false, motivo: '' };
}

/**
 * Última DGA en ppm guardada en el documento del transformador (campo `ultima_dga` en la RAÍZ: así no lo tocan ni el
 * recálculo de salud ni la edición de inventario). Un gas sin valor queda null (nunca 0).
 * @returns {null | {gases:Object, fuente:string, archivo:string, importado_en:string, fecha_toma:string|null}}
 */
export function leerUltimaDGA(tx) {
  const u = tx && tx.ultima_dga;
  if (!u || typeof u !== 'object' || !u.gases || typeof u.gases !== 'object') return null;
  const gases = {};
  for (const k of GASES_DGA) gases[k] = num(u.gases[k]);
  if (!GASES_DGA.some((k) => gases[k] != null)) return null;
  return { gases, fuente: u.fuente || '', archivo: u.archivo || '', importado_en: u.importado_en || '', fecha_toma: u.fecha_toma || null };
}

/**
 * ¿Los ppm guardados corresponden a la calificación vigente del equipo? Se recalculan las cuatro calificaciones con la
 * MISMA regla del importador y los umbrales vigentes; si alguna difiere, los ppm son de otro archivo.
 * @returns {{coherente:boolean, diferencias:string[]}}
 */
export function coherenciaConCalificaciones(gases, saludActual, umbrales) {
  const g = gases || {}; const sa = saludActual || {}; const dif = [];
  const pares = [
    ['calif_tdgc', [g.H2, g.CH4, g.C2H4, g.C2H6].every((x) => x != null) ? calcularCalifTDGC({ H2: g.H2, CH4: g.CH4, C2H4: g.C2H4, C2H6: g.C2H6 }, umbrales) : null],
    ['calif_c2h2', g.C2H2 != null ? calcularCalifC2H2(g.C2H2, umbrales) : null],
    ['calif_co', g.CO != null ? calcularCalifCO(g.CO, umbrales) : null],
    ['calif_co2', g.CO2 != null ? calcularCalifCO2(g.CO2, umbrales) : null],
  ];
  for (const [k, v] of pares) {
    const guardada = sa[k] == null ? null : Number(sa[k]);
    if (v != null && guardada != null && v !== guardada) dif.push(k);
  }
  return { coherente: dif.length === 0, diferencias: dif };
}

/** Todo lo que la vista necesita de los gases de un equipo. */
export function duvalDeEquipo(tx, umbrales) {
  const u = leerUltimaDGA(tx);
  if (!u) return { estado: 'sin_ppm' };
  const g = u.gases;
  const faltan = ['CH4', 'C2H4', 'C2H2'].filter((k) => g[k] == null);
  if (faltan.length) return { estado: 'faltan', faltan, ultima: u };
  const z = zonaDuval1(g.CH4, g.C2H4, g.C2H2);
  if (!z) return { estado: 'sin_punto', ultima: u };
  const coh = coherenciaConCalificaciones(g, tx && tx.salud_actual, umbrales);
  const sig = significancia(g);
  return {
    estado: !coh.coherente ? 'incoherente' : (sig.significativo ? 'ok' : 'no_concluyente'),
    ultima: u, zona: z.zona, pct: z.pct, suma: z.suma, info: ZONAS_DUVAL1[z.zona],
    significancia: sig, coherencia: coh, frontera: distanciaFrontera(z.pct),
  };
}
