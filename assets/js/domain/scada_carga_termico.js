// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · punto caliente ESTIMADO y ritmo de cada gas con más carga · `99 §132`
// ──────────────────────────────────────────────────────────────────────────────
// ESCENARIO, NO MEDIDO. El SCADA no trae temperaturas: se estiman con el modelo térmico de IEC 60076-7 (ecuaciones en
// diferencias §8.2.3, régimen variable) sobre la corriente horaria MEDIDA del devanado que manda, con las constantes de la
// norma para ONAF (Tabla 4 y el ejemplo de la Tabla K.1; no las del protocolo de cada equipo) y un ambiente supuesto. De
// ahí sale cuánto más rápido envejecería el papel (IEC 60076-7 §6.3) y un RANGO para el CO y el CO₂ (ninguna norma da su
// ritmo: IEC 60599 §4.2 solo dice que crece con la temperatura, el oxígeno y la humedad), y cuánto más energía disiparía
// una falla en una conexión o contacto (al menos ∝ I², física de Joule). NUNCA da ppm: con una sola muestra sin fecha no
// hay ritmo de hoy (pedido del Ingeniero 2026-10-02: «ritmo por gas + flecha»; los ppm proyectados se descartaron).
// Fuentes verificadas en el texto de la norma: bóveda 2026-10-02-duval-proyeccion, paso 5.
// Archivo NUEVO a propósito (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Constantes ONAF de IEC 60076-7:2018: x, y, k11, k21, k22, τo, τw de la Tabla 4 (columna ONAF, flujo no restringido);
 * R, Δθor y Δθhr (= H·gr) del ejemplo ONAF de la Tabla K.1 (20 + 52 + 26 = 98 °C a carga nominal y 20 °C de ambiente).
 * La norma pide los del ensayo de calentamiento de cada equipo cuando existan: aquí no los hay.
 */
export const TERMICO_ONAF = Object.freeze({
  fuente: 'IEC 60076-7:2018, Tabla 4 (ONAF) y Tabla K.1',
  x: 0.8, y: 1.3, R: 6, dThetaOr: 52, dThetaHr: 26, k11: 0.5, k21: 2.0, k22: 2.0, tauO: 150, tauW: 7,
  dThetaOmr: 43, gr: 20, // K.1: subida del aceite PROMEDIO 43 K; gr = Δθhr / H = 26 / 1,3 (temperatura media del devanado)
});
/** Un hueco del SCADA de hasta estas horas se rellena con la hora anterior; uno más largo queda FUERA del cálculo. */
export const HUECO_MAX_H = 2;
/** Ambiente supuesto (sin medición): el mismo de sobrecarga_admisible.js para el trópico. */
export const AMBIENTE_SUPUESTO = 30;
/** IEC 60076-7:2018 Tabla 2, transformadores de potencia medianos (≤ 100 MVA): punto caliente del devanado, °C. */
export const LIMITES_PUNTO_CALIENTE = Object.freeze({ cicloNormal: 120, emergenciaLarga: 140, emergenciaCorta: 160 });
/** IEC 60076-7:2018 Tabla 3, medianos: corriente máxima de emergencia de corta duración (p.u.). Más allá, fuera de rango. */
export const CORRIENTE_MAX_PU = 1.8;
/** Energía de activación de CO + CO₂ medida en papel Kraft (≤ 110 °C): 10.500–10.700 cal/mol (patente US6276222B1). */
export const EA_CO_CO2_KJ = 44.4;
const R_GAS = 8.314e-3; // kJ/(mol·K)

/** Ritmo relativo de Arrhenius a θ (°C) con energía de activación Ea (kJ/mol), referido a 98 °C. */
export function arrheniusRelativo(theta, eaKJ) {
  return Number.isFinite(theta) ? Math.exp((eaKJ / R_GAS) * (1 / (98 + 273.15) - 1 / (theta + 273.15))) : null;
}

/** Velocidad relativa de envejecimiento del papel (IEC 60076-7 §6.3 Ec. 2): no mejorado térmicamente, V = 2^((θh − 98)/6). */
export function envejecimientoRelativo(thetaH) {
  return Number.isFinite(thetaH) ? Math.pow(2, (thetaH - 98) / 6) : null;
}

/**
 * Simula el aceite superior y el punto caliente hora a hora con las ecuaciones en diferencias de IEC 60076-7 (paso de
 * 1 min; la corriente se toma constante dentro de cada hora). Un hueco de hasta HUECO_MAX_H horas se rellena con la hora
 * anterior (`rellenadas`); uno más largo (equipo apagado, mes sin datos) queda FUERA de máximos, horas y promedios
 * (`sinDato`) y el cálculo vuelve a arrancar en régimen permanente con la hora válida siguiente — nunca se inventan horas
 * calientes (revisión adversarial 2026-10-02). El CO + CO₂ se evalúa con la temperatura MEDIA del devanado (todo el
 * papel; IEEE C57.104-2019 §4), no con el punto caliente.
 * @param {ArrayLike<number>} serie  carga horaria en % de la ampacidad ONAF (NaN = sin dato)
 * @param {number} f  factor de escenario (1 = la curva medida; 1,2 = +20 % parejo en todas las horas)
 * @returns {null | {horas, sinDato, rellenadas, thetaHMax, thetaOMax, horasSobre:Object, vMedio, coMedio, kMax}}  vMedio =
 *   envejecimiento medio en el punto caliente (IEC 60076-7); coMedio = Arrhenius medio con la Ea del CO + CO₂ a la
 *   temperatura media del devanado; kMax = corriente máxima en p.u. de las horas calculadas.
 */
export function simularTermico(serie, f = 1, { thetaA = AMBIENTE_SUPUESTO, p = TERMICO_ONAF, pasoMin = 1 } = {}) {
  if (!serie || !serie.length || !(f > 0)) return null;
  const n = serie.length;
  let h0 = -1;
  for (let h = 0; h < n; h++) if (Number.isFinite(serie[h])) { h0 = h; break; }
  if (h0 < 0) return null;
  const dThetaHr = p.dThetaHr;
  const subida = (K) => p.dThetaOr * Math.pow((1 + p.R * K * K) / (1 + p.R), p.x);
  let K = 0; let thetaO = 0; let dh1 = 0; let dh2 = 0;
  const arrancar = (k) => { K = k; thetaO = thetaA + subida(K); dh1 = p.k21 * dThetaHr * Math.pow(K, p.y); dh2 = (p.k21 - 1) * dThetaHr * Math.pow(K, p.y); };
  arrancar((serie[h0] / 100) * f);
  const pasos = Math.round(60 / pasoMin);
  const umbrales = Object.values(LIMITES_PUNTO_CALIENTE);
  const horasSobre = Object.fromEntries(umbrales.map((u) => [u, 0]));
  const fracOm = p.dThetaOmr / p.dThetaOr;
  let thetaHMax = -Infinity; let thetaOMax = -Infinity; let sumaV = 0; let sumaCO = 0; let horas = 0; let sinDato = 0; let rellenadas = 0; let kMax = 0;
  for (let h = h0; h < n; h++) {
    if (Number.isFinite(serie[h])) K = (serie[h] / 100) * f;
    else {
      let fin = h; while (fin < n && !Number.isFinite(serie[fin])) fin++;
      const largo = fin - h;
      if (largo > HUECO_MAX_H || fin >= n) { sinDato += largo; if (fin < n) arrancar((serie[fin] / 100) * f); h = fin - 1; continue; }
      rellenadas++;
    }
    if (K > kMax) kMax = K;
    const Ky = Math.pow(K, p.y); const objO = subida(K);
    let maxH = -Infinity; let sumaVh = 0; let sumaCOh = 0;
    for (let s = 0; s < pasos; s++) {
      thetaO += (pasoMin / (p.k11 * p.tauO)) * (objO - (thetaO - thetaA));
      dh1 += (pasoMin / (p.k22 * p.tauW)) * (p.k21 * dThetaHr * Ky - dh1);
      dh2 += (pasoMin / (p.tauO / p.k22)) * ((p.k21 - 1) * dThetaHr * Ky - dh2);
      const thetaH = thetaO + dh1 - dh2;
      const thetaW = thetaA + (thetaO - thetaA) * fracOm + p.gr * Ky; // media del devanado (aceite promedio + gr·K^y)
      if (thetaH > maxH) maxH = thetaH;
      sumaVh += envejecimientoRelativo(thetaH); sumaCOh += arrheniusRelativo(thetaW, EA_CO_CO2_KJ);
    }
    if (maxH > thetaHMax) thetaHMax = maxH;
    if (thetaO > thetaOMax) thetaOMax = thetaO;
    for (const u of umbrales) if (maxH > u) horasSobre[u]++;
    sumaV += sumaVh / pasos; sumaCO += sumaCOh / pasos; horas++;
  }
  if (!horas) return null;
  return { horas, sinDato, rellenadas, thetaHMax, thetaOMax, horasSobre, vMedio: sumaV / horas, coMedio: sumaCO / horas, kMax };
}

/** Familia del defecto según la zona de Duval: qué gases dependen de la corriente. */
const FAMILIA = Object.freeze({ T1: 'termica', T2: 'termica', T3: 'termica', DT: 'mixta', PD: 'descarga', D1: 'descarga', D2: 'descarga' });
const DE_FALLA = Object.freeze(['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2']);

/**
 * Cuántas veces más rápido se formaría cada gas con la carga × f (escenario rotulado). Origen por gas:
 *  · 'papel' (CO, CO₂): RANGO [Arrhenius con la Ea del CO + CO₂, envejecimiento del papel IEC 60076-7] frente a hoy —
 *    ninguna norma da su ritmo; también dependen del oxígeno, la humedad y todo el volumen de papel;
 *  · 'corriente' (gases de una falla TÉRMICA): la ubicación es un SUPUESTO, así que va un rango [× 1 si es el núcleo
 *    (flujo principal: tensión), AL MENOS × f² si es una conexión, contacto o pieza calentada por flujo disperso (Joule;
 *    la resistencia de un contacto sube con el calor)] — `rango` + `altoEsMinimo: true`;
 *  · 'descarga' (PD, D1, D2; y el H₂ y el C₂H₂ de DT): × 1, la carga no la mueve;
 *  · 'sin_falla' (sin gas suficiente): no se proyecta un ritmo de falla que no está.
 * @param {{zona:string|null, concluyente:boolean, f:number, rangoPapel:[number,number]|null}} a
 * @returns {Object<string, {origen:string, factor:number|null, rango?:[number,number]|null, altoEsMinimo?:boolean}>}
 */
export function ritmoGases({ zona, concluyente, f, rangoPapel }) {
  const fam = concluyente ? FAMILIA[zona] || null : null;
  const papel = { origen: 'papel', factor: null, rango: rangoPapel || null };
  const out = { CO: { ...papel }, CO2: { ...papel } };
  for (const g of DE_FALLA) {
    let origen = 'sin_falla';
    if (fam === 'termica') origen = 'corriente';
    else if (fam === 'descarga') origen = 'descarga';
    else if (fam === 'mixta') origen = g === 'H2' || g === 'C2H2' ? 'descarga' : 'corriente';
    out[g] = origen === 'corriente' ? { origen, factor: null, rango: [1, f * f], altoEsMinimo: true } : { origen, factor: origen === 'descarga' ? 1 : null };
  }
  return out;
}

/** ¿Hacia dónde tendería el punto con más calor? Solo dirección cualitativa (Halstead 1973; Duval 2002), nunca posición. */
export function tendenciaDuval(zona, concluyente) {
  if (!concluyente || !zona) return null;
  const fam = FAMILIA[zona];
  if (fam === 'descarga') return { tipo: 'quieto', texto: 'La carga no mueve este tipo de defecto: depende de la tensión.' };
  if (zona === 'T3') return { tipo: 'flecha', destino: 'T3', texto: 'Con más calor en el aceite se queda en T3 y se corre hacia el etileno.' };
  if (fam === 'mixta') return { tipo: 'flecha', destino: 'T3', texto: 'La parte térmica, si está en el aceite, tiende hacia más etileno (T3); la parte de descarga no la mueve la carga.' };
  return { tipo: 'flecha', destino: 'T3', texto: 'Si la falla está en el aceite, con más calor el punto tiende hacia T3 (más etileno); si está en el papel, se queda en T1 o T2.' };
}
