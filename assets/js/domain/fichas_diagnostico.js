// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · Diagnóstico y redacción automática
// ─────────────────────────────────────────────────────────────────────────────
// Deriva, a partir de los valores MEDIDOS del equipo (Salud de Activos), el
// modo de degradación dominante y la redacción del Alcance y los Beneficios de
// la Ficha Técnica de Planificación.
//
// ── POR QUÉ ESTE MÓDULO EXISTE ───────────────────────────────────────────────
// El texto se arma con las cifras REALES del equipo y con SU modo de
// degradación. Un equipo con el papel sano NUNCA debe recibir el argumento de
// "fin de vida por furanos": esa es la regla que evita firmar un documento
// indefendible ante el regulador. Por la misma razón, cuando el campo CAUSANTE
// de la fuente contradice los ensayos medidos, la ficha lo ADVIERTE en lugar de
// silenciarlo.
//
// ── DE DÓNDE SALEN LAS FÓRMULAS ──────────────────────────────────────────────
// El DP y el % de vida NO se reimplementan aquí: se importan de
// `salud_activos.js` (curva de Chendong, CIGRÉ 445), que es su dueño único.
// Este módulo solo les pone los TOPES de reporte: por encima de 100 % se
// informa "≥100" y por debajo de 0 se informa "<1", porque la curva pierde
// sentido fuera de su rango de validez y un número falso en una ficha firmada
// es peor que un rango honesto.
//
// Funciones PURAS: cero Firebase, cero DOM, cero I/O.
//
// ── FORMA DE LOS DATOS DE ENTRADA ────────────────────────────────────────────
// `equipo` — identidad y contexto del activo:
//   { subestacion, matricula, serie, mva, potencia_kva, mvaProyecto, edad,
//     anio_fab, usuarios, cond_int, cond_lbl, fugas, fila }
// `diag` — valores medidos (una fila de Salud de Activos):
//   { fur, efur, h2, ch4, c2h4, c2h6, c2h2, co, co2, rig, hum, nn, tif, ic,
//     crg, eadfq, erig, eic, eherm, ecrg, eedad, causa }
//   e* = calificaciones 1–5 · fur en ppb · gases en ppm · crg en %.
// ═════════════════════════════════════════════════════════════════════════════

import { calcularDP, calcularVidaUtilizada } from './salud_activos.js';

// ── Utilidades internas ──────────────────────────────────────────────────────

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Formato numérico colombiano (1.234.567 · 63,4) SIN depender del ICU del
 * entorno: el dominio debe dar el mismo texto en Node, en el navegador y en
 * una Cloud Function.
 */
export function numES(n, dec) {
  const v = num(n);
  if (v == null) return '';
  const d = dec || 0;
  const fijo = Math.abs(v).toFixed(d);
  const [ent, frac] = fijo.split('.');
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + conPuntos + (frac ? ',' + frac : '');
}

const mvaDe = (equipo) => {
  if (!equipo) return null;
  const p = num(equipo.mvaProyecto);
  if (p != null) return p;
  const m = num(equipo.mva);
  if (m != null) return m;
  const kva = num(equipo.potencia_kva);
  return kva != null ? kva / 1000 : null;
};

/** Potencia legible: 40 → "40" · 31,5 → "31,5" (hasta 2 decimales, sin ceros de relleno). */
const mvaTxt = (mva) => {
  if (mva == null) return '—';
  const r = Math.round(mva * 100) / 100;
  const dec = Number.isInteger(r) ? 0 : (Number.isInteger(r * 10) ? 1 : 2);
  return numES(r, dec);
};

// ── DP y vida útil del aislamiento ───────────────────────────────────────────

/**
 * Estimación de la vida del aislamiento a partir de los furanos (2-FAL).
 *
 * @param {object} diag — fila de valores medidos (necesita `fur` en ppb).
 * @returns {{ppb:number, dp:number, vidaUsada:number, vidaTxt:string,
 *            remanente:number, fueraRango:boolean, papelSano:boolean}|null}
 *   fueraRango  el % de vida consumida se salió por arriba (≥100) — papel agotado.
 *   papelSano   el % salió por debajo de 0 — el papel no sostiene un argumento
 *               de fin de vida. Es la bandera que protege la ficha.
 */
export function dpInfo(diag) {
  if (!diag || diag.fur == null || diag.fur === '') return null;
  const ppb = num(diag.fur);
  if (ppb == null || ppb <= 0) return null;      // fuera del dominio de la curva

  const dp = calcularDP(ppb);
  const vu = calcularVidaUtilizada(dp);
  if (dp == null || vu == null) return null;

  const agotado = vu >= 100;
  const sano = vu <= 0;
  return {
    ppb,
    dp: Math.round(dp),
    vidaUsada: Math.min(100, Math.max(0, vu)),
    vidaTxt: agotado ? '≥100' : (sano ? '<1' : numES(Math.round(vu * 10) / 10, 1)),
    remanente: agotado ? 0 : (sano ? 100 : Math.round((100 - vu) * 10) / 10),
    fueraRango: agotado,
    papelSano: sano
  };
}

// ── Modo de degradación dominante ────────────────────────────────────────────
// Se decide por los VALORES medidos, no por el texto del campo CAUSANTE de la
// fuente (que en varias filas viene copiado de otro equipo). Cuando ambos se
// contradicen, la ficha lo advierte.

/**
 * @param {object} equipo — identidad y contexto del activo.
 * @param {object} diag — valores medidos.
 * @returns {{dominante:object, todos:object[], alerta:string|null, causa:string}|null}
 *   Cada hallazgo es { k, t, e, n }: clave, título, evidencia redactada con las
 *   cifras reales y norma de referencia. `dominante` es el primero de la lista
 *   (el orden de evaluación es el orden de prioridad).
 */
export function modoDegradacion(equipo, diag) {
  const d = diag;
  if (!d) return null;
  const di = dpInfo(d);
  const M = [];

  const g = (k) => num(d[k]);
  const papel = (g('efur') != null && g('efur') >= 4) || (g('fur') != null && g('fur') >= 2500);
  const arco = g('c2h2') != null && g('c2h2') >= 15;
  const descP = g('h2') != null && g('h2') >= 1000 && (g('c2h4') == null || g('c2h4') < 100);
  const termi = g('c2h4') != null && g('c2h4') >= 500;
  const aceit = (g('eadfq') != null && g('eadfq') >= 4) || (g('erig') != null && g('erig') >= 4) ||
                (g('eic') != null && g('eic') >= 4);
  const herme = g('eherm') != null && g('eherm') >= 4;
  const carga = g('ecrg') != null && g('ecrg') >= 4;
  const edadA = g('eedad') != null && g('eedad') >= 4;

  if (papel && di) {
    M.push({
      k: 'papel',
      t: 'Degradación del aislamiento sólido (celulosa)',
      e: `contenido de compuestos furánicos (2-FAL) de ${numES(d.fur)} ppb, equivalente a un grado de ` +
         `polimerización (DP) estimado de ${di.dp} y a un ${di.vidaTxt} % de la vida del aislamiento ya consumida`,
      n: 'ASTM D5837 · IEC 61198 · CIGRÉ 445 (curva de Chendong)'
    });
  }
  if (termi) {
    M.push({
      k: 'termico',
      t: 'Falla térmica en el aislamiento',
      e: `etileno (C₂H₄) en ${numES(d.c2h4)} ppm` +
         (d.ch4 != null ? ` y metano (CH₄) en ${numES(d.ch4)} ppm` : '') +
         ', firma de sobrecalentamiento por superación de la temperatura del punto más caliente (hot-spot)',
      n: 'IEEE C57.104 · IEC 60599'
    });
  }
  if (arco) {
    M.push({
      k: 'arco',
      t: 'Descarga de alta energía (arco)',
      e: `acetileno (C₂H₂) en ${numES(d.c2h2, 1)} ppm, gas que solo se genera por arco eléctrico`,
      n: 'IEEE C57.104 · IEC 60599 · triángulo de Duval'
    });
  }
  if (descP) {
    M.push({
      k: 'descargas',
      t: 'Descargas parciales / falla de baja energía',
      e: `hidrógeno (H₂) en ${numES(d.h2)} ppm` +
         (d.ch4 != null ? ` y metano (CH₄) en ${numES(d.ch4)} ppm` : '') +
         `, con etileno prácticamente ausente (${numES(d.c2h4, 1)} ppm) — firma compatible con descargas ` +
         'parciales, no con envejecimiento térmico del papel',
      n: 'IEEE C57.104 · IEC 60599 · triángulo de Duval (confirmar con muestreo dirigido)'
    });
  }
  if (aceit) {
    M.push({
      k: 'aceite',
      t: 'Degradación del aceite dieléctrico',
      e: `rigidez dieléctrica de ${numES(d.rig)} kV, humedad de ${numES(d.hum)} %, tensión interfacial de ` +
         `${numES(d.tif, 1)} mN/m e índice de neutralización de ${numES(d.nn, 2)} mgKOH/g`,
      n: 'IEC 60422 · ASTM D1816/D971/D974'
    });
  }
  if (herme) {
    const fugas = equipo && equipo.fugas && String(equipo.fugas).trim()
      ? String(equipo.fugas).toLowerCase()
      : 'la cuba y/o accesorios';
    M.push({
      k: 'hermeticidad',
      t: 'Pérdida de hermeticidad',
      e: `fugas confirmadas en ${fugas}, con ingreso de humedad y oxígeno que acelera el envejecimiento`,
      n: 'IEC 60076-1'
    });
  }
  if (carga) {
    M.push({
      k: 'carga',
      t: 'Cargabilidad en el límite',
      e: `cargabilidad del ${numES(d.crg)} % de la capacidad nominal, sin margen para maniobra ni contingencia`,
      n: 'IEEE C57.91 · IEC 60076-7'
    });
  }
  if (edadA) {
    const edad = equipo ? num(equipo.edad) : null;
    M.push({
      k: 'edad',
      t: 'Obsolescencia por edad',
      e: edad != null
        ? `${edad} años de servicio (fabricación ${(equipo && equipo.anio_fab) || 's/d'}), por encima de la vida técnica de diseño`
        : 'edad por encima de la vida técnica de diseño',
      n: 'IEC 60076-7'
    });
  }

  if (!M.length) return null;

  // Coherencia: ¿el CAUSANTE de la fuente habla de papel y los furanos lo desmienten?
  const causa = (d.causa || '');
  let alerta = null;
  if (/PAPEL|CELULOSA|FURAN/i.test(causa) && g('efur') != null && g('efur') <= 2) {
    alerta = 'El campo CAUSANTE de la fuente atribuye la condición al envejecimiento del papel, pero los ' +
      `furanos medidos (${numES(d.fur)} ppb, calificación ${d.efur}) no lo respaldan. La evidencia apunta a ` +
      `${M[0].t.toLowerCase()}. Verificar antes de emitir la ficha.`;
  }
  return { dominante: M[0], todos: M, alerta, causa };
}

// ── Redacción automática anclada en los datos medidos ────────────────────────

/**
 * Texto del ALCANCE del proyecto (celda B17 de la ficha).
 * @param {object} equipo
 * @param {object} diag
 * @returns {string}
 */
export function redaccionAlcance(equipo, diag) {
  const f = equipo || {};
  const d = diag || null;
  const md = modoDegradacion(f, d);
  const mva = mvaDe(f);
  const sub = f.subestacion || '';
  const ci = f.cond_int != null ? f.cond_int : null;
  const cl = f.cond_lbl || '';

  let t = `El alcance del proyecto comprende la adquisición y reposición del transformador de potencia de ` +
    `${mvaTxt(mva)} MVA` +
    (f.matricula ? ` (matrícula ${f.matricula}${f.serie ? `, serie ${f.serie}` : ''})` : '') +
    ` que opera actualmente en la subestación ${sub}. `;

  t += 'Bajo la metodología de salud de activos el equipo se encuentra en condición ' +
    (ci != null ? `${ci} de 5${cl ? ` — ${cl}` : ''}` : 'no clasificada') +
    (f.edad != null ? `, con ${f.edad} años de servicio${f.anio_fab ? ` (fabricación ${f.anio_fab})` : ''}` : '') + '. ';

  if (md) {
    t += `El diagnóstico dominante es ${md.dominante.t.toLowerCase()}: ${md.dominante.e}, conforme a ${md.dominante.n}. `;
    if (md.todos.length > 1) {
      t += 'De forma concurrente se registra ' +
        md.todos.slice(1).map((m) => `${m.t.toLowerCase()} — ${m.e}`).join('; ') + '. ';
    }
  }
  if (d && num(d.crg) != null && num(d.crg) >= 90) {
    t += `La unidad opera al ${numES(d.crg)} % de su capacidad nominal, de modo que no existe margen para ` +
      'atender la carga por otra vía ante una salida del equipo. ';
  }
  if (f.usuarios != null) {
    t += `La afectación asociada a una falla del activo alcanza ${numES(f.usuarios)} usuarios. `;
  }
  t += 'En consecuencia, y en el marco de la gestión de activos (ISO 55001), la reposición por una unidad de ' +
    'igual capacidad y mejor estado de salud se establece como medida prioritaria de mitigación de riesgo, ' +
    'orientada a garantizar la disponibilidad, la seguridad operacional y la sostenibilidad del suministro en ' +
    'la zona de influencia.';
  return t;
}

/**
 * Texto de los BENEFICIOS del proyecto (celda B23 de la ficha), en viñetas.
 *
 * ⚠️ El argumento de "vida útil agotada" solo se usa cuando los furanos lo
 * sostienen. Si el papel está sano, incluirlo sería un argumento falso y
 * tumbaría la ficha.
 *
 * @param {object} equipo
 * @param {object} diag
 * @returns {string} viñetas separadas por salto de línea.
 */
export function redaccionBeneficios(equipo, diag) {
  const f = equipo || {};
  const d = diag || null;
  const md = modoDegradacion(f, d);
  const di = dpInfo(d);
  const mva = mvaDe(f);
  const L = [];

  L.push('· Mayor confiabilidad operativa: la sustitución por una unidad de igual capacidad ' +
    `(${mvaTxt(mva)} MVA) con índice de salud óptimo reduce sustancialmente la probabilidad de falla y de ` +
    'salidas intempestivas de servicio' +
    (md ? `, al retirar de operación el modo de falla identificado: ${md.dominante.t.toLowerCase().replace(/\s*\([^)]*\)/g, '')}` : '') + '.');

  if (di && di.fueraRango) {
    L.push(`· Restablecimiento de la vida útil: el aislamiento del activo actual está agotado (2-FAL de ${numES(di.ppb)} ppb, ` +
      `DP estimado ${di.dp}); la unidad nueva reinicia la curva de vida y recupera margen de sobrecarga de emergencia.`);
  } else if (di && !di.papelSano && di.vidaUsada >= 50) {
    L.push(`· Restablecimiento de la vida útil: el activo actual tiene el ${di.vidaTxt} % de la vida de su aislamiento ` +
      `consumida (DP estimado ${di.dp}); la unidad nueva reinicia la curva de vida y recupera margen de sobrecarga de emergencia.`);
  }

  L.push('· Aumento de la disponibilidad del suministro: menor frecuencia y duración de interrupciones, con ' +
    'impacto directo en la continuidad del servicio y en los indicadores de calidad (SAIDI/SAIFI) de la zona ' +
    'de influencia' + (f.usuarios != null ? `, que atiende ${numES(f.usuarios)} usuarios` : '') + '.');

  if (d && num(d.crg) != null && num(d.crg) >= 90) {
    L.push(`· Recuperación del margen de capacidad: hoy la unidad opera al ${numES(d.crg)} % de su capacidad ` +
      'nominal; la reposición devuelve margen para maniobra, contingencia y crecimiento de la demanda.');
  }

  L.push('· Reducción del riesgo operativo y de seguridad: elimina el escenario de falla violenta del activo ' +
    'en fin de vida, protegiendo al personal y a los equipos adyacentes de la subestación.');
  L.push('· Menor costo total de propiedad (TCO): reduce el gasto por mantenimiento correctivo, ensayos de ' +
    'emergencia y compensaciones por indisponibilidad, y optimiza el plan de mantenimiento preventivo.');
  L.push('· Eficiencia energética y calidad: una unidad diseñada bajo la normativa de eficiencia vigente opera ' +
    'con menores pérdidas y mejor comportamiento térmico (ISO 50001), con mayor estabilidad de tensión para ' +
    'cargas sensibles.');
  return L.join('\n');
}
