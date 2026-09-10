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
import { sustentoDeAccion } from './acciones_tecnicas.js';
import { condicionesPresentes, CIERRE_CONDICIONES } from './condiciones_deterioro.js';

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
/**
 * Enumera SOLO los valores que existen. Las calificaciones (1–5) llegan
 * siempre; los valores medidos (`det`/`ensayos`) no. Cuando faltaban, la
 * evidencia salía con el hueco a la vista —«rigidez dieléctrica de  kV»— en un
 * documento que se firma. Ahora se dice lo que hay, y si no hay nada se dice
 * de dónde sale la calificación en vez de fingir una medida.
 *
 * @param {Array<[string, *]>} pares — [texto con la cifra ya formateada, valor]
 * @returns {string} lista en castellano, o '' si no se midió nada.
 */
function soloMedido(pares) {
  // La hoja de Salud de Activos usa el 0 como relleno de «no lo sé». En estas
  // variables el cero NO es una medida posible en un equipo en servicio: una
  // rigidez dieléctrica de 0 kV sería un cortocircuito y una tensión
  // interfacial de 0,0 mN/m no existe. Colarlo imprimía un ensayo inventado en
  // un documento que se firma —y empujaba «degradación del aceite» como
  // hallazgo dominante, que en el documento de mantenimiento se traduce en
  // comprar tratamiento de aceite por un dato que nunca se midió. Es la misma
  // defensa que el módulo ya aplica a la potencia, al terciario y a la
  // condición. Sin nada medido, cae solo en su texto honesto.
  const hay = pares.filter(([, v]) => v != null && v !== '' && Number(v) !== 0).map(([t]) => t);
  if (!hay.length) return '';
  if (hay.length === 1) return hay[0];
  return hay.slice(0, -1).join(', ') + ' y ' + hay[hay.length - 1];
}

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

  // El argumento de fin de vida del papel NO puede sostenerse si la propia
  // medición de furanos dice que el papel está sano: es el escenario exacto
  // que este módulo existe para evitar (un `efur` copiado de otra fila metía
  // «degradación del aislamiento sólido» en una ficha que se firma, con la
  // evidencia contradiciéndose dentro de la misma frase). ADR-066.
  if (papel && di && !di.papelSano) {
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
         (g('c2h4') != null ? `, con etileno prácticamente ausente (${numES(d.c2h4, 1)} ppm)` : ', sin etileno relevante') +
         ' — firma compatible con descargas parciales, no con envejecimiento térmico del papel',
      n: 'IEEE C57.104 · IEC 60599 · triángulo de Duval (confirmar con muestreo dirigido)'
    });
  }
  if (aceit) {
    M.push({
      k: 'aceite',
      t: 'Degradación del aceite dieléctrico',
      e: soloMedido([
        [`rigidez dieléctrica de ${numES(d.rig)} kV`, g('rig')],
        [`humedad de ${numES(d.hum)} %`, g('hum')],
        [`tensión interfacial de ${numES(d.tif, 1)} mN/m`, g('tif')],
        [`índice de neutralización de ${numES(d.nn, 2)} mgKOH/g`, g('nn')]
      ]) || `calificación ${[g('eadfq'), g('erig'), g('eic')].filter((x) => x != null && x >= 4)[0]} ` +
        'de 5 en el ensayo físico-químico del aceite (valores de laboratorio no cargados en el activo)',
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
      e: (g('crg') != null
        ? `cargabilidad del ${numES(d.crg)} % de la capacidad nominal`
        : `calificación ${g('ecrg')} de 5 en cargabilidad`) +
        ', sin margen para maniobra ni contingencia',
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
  // Incoherencia inversa: la CALIFICACIÓN dice papel degradado y la MEDICIÓN
  // dice papel sano. No se elige ese modo (arriba), pero el dato de origen
  // está mal y alguien tiene que mirarlo antes de firmar nada.
  if (papel && di && di.papelSano) {
    alerta = `La calificación de furanos (${d.efur}) indica degradación avanzada del papel, pero el `
      + `furano medido (${numES(d.fur)} ppb) sitúa el consumo de vida del aislamiento por debajo de `
      + 'cero. El dato de origen es incoherente: verifíquelo antes de sustentar una reposición con '
      + 'el argumento de fin de vida del aislamiento.';
  } else if (/PAPEL|CELULOSA|FURAN/i.test(causa) && g('efur') != null && g('efur') <= 2) {
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
  // `> 0` y no `!= null`: con 0 usuarios la frase se autodestruye —«si no
  // afecta a nadie, nadie firma»— y contradice a la propia ficha, que dos
  // párrafos más abajo imprime «—» para ese mismo campo. Con el dato ausente
  // no se escribe, que es lo único cierto.
  if (f.usuarios > 0) {
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
    'de influencia' + (f.usuarios > 0 ? `, que atiende ${numES(f.usuarios)} usuarios` : '') + '.');

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

// ── Redacción automática del documento de MANTENIMIENTO ESPECIALIZADO ────────
// Mismo diagnóstico, otra decisión. El PI concluye «reponer el activo»; este
// documento concluye «intervenir el activo que sigue en servicio». Por eso la
// evidencia se comparte (`modoDegradacion` es el dueño único) pero la acción
// no: cada modo de degradación tiene su trabajo, y hay uno —la celulosa— que
// NINGÚN mantenimiento revierte. Decirlo es lo que separa un documento que se
// puede firmar de uno que promete lo que no puede cumplir.

/**
 * Trabajo que corresponde a cada modo de degradación.
 * `rev: true` marca los modos que el mantenimiento NO revierte: se vigilan y se
 * frena su avance, pero el activo no vuelve atrás.
 */
const TRABAJO_POR_MODO = Object.freeze({
  papel: {
    rev: false,
    a: 'seguimiento dirigido del envejecimiento del aislamiento sólido (furanos y CO/CO₂ con '
     + 'periodicidad acortada) y reducción del esfuerzo térmico sobre el devanado',
    n: 'ASTM D5837 · CIGRÉ 445'
  },
  termico: {
    rev: true,
    a: 'intervención del sistema de refrigeración y de las conexiones: termografía bajo carga, '
     + 'verificación de ventiladores, bombas, radiadores e indicadores de temperatura, y revisión '
     + 'del apriete y del estado de bornes y conexiones de alta y baja',
    n: 'IEEE C57.104 · IEC 60599 · IEC 60076-7'
  },
  arco: {
    rev: true,
    a: 'inspección interna dirigida al origen del arco —con revisión del conmutador bajo carga '
     + '(OLTC) y de sus contactos— y muestreo de gases con periodicidad acortada hasta descartar '
     + 'la evolución del defecto',
    n: 'IEEE C57.104 · IEC 60599 · triángulo de Duval'
  },
  descargas: {
    rev: true,
    a: 'medición de descargas parciales (eléctrica y acústica/UHF) para localizar el defecto, '
     + 'con muestreo de gases dirigido antes y después de la intervención',
    n: 'IEC 60270 · IEEE C57.127'
  },
  aceite: {
    rev: true,
    a: 'tratamiento del aceite dieléctrico —termovacío o regeneración según el nivel de acidez y '
     + 'tensión interfacial—, cambio del deshidratante del respirador y verificación del sistema '
     + 'de preservación',
    n: 'IEC 60422 · ASTM D1816/D971/D974'
  },
  hermeticidad: {
    rev: true,
    a: 'reparación de fugas y restitución de la hermeticidad: empaquetaduras, bridas, válvulas y '
     + 'sistema de preservación, con prueba de estanqueidad posterior',
    n: 'IEC 60076-1'
  },
  carga: {
    rev: false,
    a: 'seguimiento de la cargabilidad y del perfil térmico en operación, con gestión de la carga '
     + 'y de las maniobras de contingencia mientras se recupera margen por otra vía',
    n: 'IEEE C57.91 · IEC 60076-7'
  },
  edad: {
    rev: false,
    a: 'mantenimiento mayor sobre los subsistemas que sí se renuevan (conmutador, bujes, '
     + 'refrigeración, protecciones e instrumentación) y vigilancia reforzada del núcleo activo',
    n: 'IEC 60076-7'
  }
});

/**
 * Texto del ALCANCE del documento de Mantenimiento Especializado.
 *
 * Se apoya en los mismos valores medidos que el PI, pero concluye intervención
 * y no reposición. Si el modo dominante es irreversible, lo dice: el alcance
 * pasa a ser contener y vigilar, no «recuperar» el activo.
 *
 * @param {object} equipo
 * @param {object} diag
 * @returns {string}
 */
/**
 * Las condiciones de deterioro que el activo PRESENTA, definidas.
 *
 * Encargo del Ingeniero (2026-09-10) con su propia redacción: el alcance
 * nombraba el hallazgo pero no lo DEFINÍA, ni decía qué riesgo supone para el
 * equipo, ni cómo puede afectar al cliente.
 *
 * Solo las que el motor declaró a partir de valores MEDIDOS —decisión suya—:
 * escribir las cinco por defecto sería afirmar condiciones que el equipo no
 * tiene, en un papel que se firma. Si no hay ninguna, no se escribe el bloque
 * ni el cierre.
 *
 * @param {object|null} md salida de `modoDegradacion`
 * @returns {string} '' si el activo no presenta ninguna
 */
function bloqueCondiciones(md) {
  const cs = condicionesPresentes(md);
  if (!cs.length) return '';
  const renglones = cs.map((c) => `• ${c.condicion}. ${c.definicion}\n`
    + `  Riesgo para el equipo: ${c.riesgoEquipo}\n`
    + `  Posible afectación a clientes: ${c.afectacionClientes}`);
  return 'CONDICIONES QUE PRESENTA EL ACTIVO\n'
    + renglones.join('\n')
    + '\n' + CIERRE_CONDICIONES;
}

/** Primera letra en mayúscula, sin tocar el resto (siglas incluidas). */
function may(t) {
  const x = String(t || '').trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : '';
}

/** Cierra una frase con punto si no lo trae ya. */
function pto(t) {
  const x = String(t || '').trim();
  if (!x) return '';
  return /[.;:!?]$/.test(x) ? x + ' ' : x + '. ';
}

/**
 * Las actividades escogidas, ARGUMENTADAS una por una.
 *
 * Encargo del Ingeniero (2026-09-10): *«la descripción en el alcance la
 * necesito en un contexto técnico, donde se argumentan las actividades que se
 * van a desarrollar al activo»*. Hasta aquí el alcance las ENUMERABA —«el
 * alcance comprende regeneración de aceite, pintura parcial y…»— sin decir de
 * ninguna por qué se le hace al activo.
 *
 * Cada renglón dice sobre qué SUBSISTEMA actúa, qué VARIABLE la motiva, qué
 * deja al cierre y qué NO devuelve. Lo que reinicia la línea base se advierte
 * UNA vez al final, no en cada renglón: repetirlo cinco veces es un sello.
 *
 * Una actividad sin ficha (viene del plan registrado, que es texto libre de
 * Salud de Activos) se enumera igual, pero NO se le inventa un argumento.
 *
 * @param {Array<{txt:string, codigo?:string}>} escogidas
 * @returns {string} '' si no hay ninguna — quien llame decide qué poner
 */
function argumentoDeAcciones(escogidas) {
  const lista = Array.isArray(escogidas) ? escogidas : [];
  if (!lista.length) return '';

  const reinician = [];
  const renglones = lista.map((a) => {
    const nom = String(a && a.txt ? a.txt : '').trim();
    if (!nom) return '';
    const f = sustentoDeAccion(a);
    if (!f) {
      return `• ${may(nom)}. Actividad tomada del plan registrado del activo; su sustento técnico se `
        + 'incorpora con el resultado del diagnóstico.';
    }
    if (f.reiniciaLineaBase) reinician.push(nom.toLowerCase());
    // `motiva` es una frase completa en minúscula, no un complemento: encajarla
    // tras «la motiva» daba «La motiva el ensayo físico-químico ubica…», que no
    // concuerda. Va como oración propia, que además se lee mejor.
    let t = `• ${may(nom)} — actúa sobre ${f.subsistema}. `;
    t += pto(may(f.motiva));
    t += 'Al cierre, ' + pto(f.resultado);
    if (f.noRevierte) t += may(f.noRevierte).replace(/^No /, 'No ') + (/[.]$/.test(f.noRevierte) ? ' ' : '. ');
    if (f.referencia) t += `Referencia: ${f.referencia}.`;
    return t.trim();
  }).filter(Boolean);

  if (!renglones.length) return '';

  let t = 'Las actividades contratadas y su sustento técnico son las siguientes.\n'
    + renglones.join('\n');
  if (reinician.length) {
    t += '\nAdvertencia de línea base: '
      + (reinician.length === 1 ? `la ${reinician[0]} reinicia` : 'las siguientes actividades reinician')
      + (reinician.length === 1 ? '' : ` —${reinician.join(', ')}— `)
      + ' la línea base de gases disueltos y de compuestos furánicos: toda evaluación posterior se '
      + 'contrasta contra ese nuevo cero, no contra la serie anterior.';
  }
  return t;
}

export function redaccionAlcanceMtto(equipo, diag, escogidas) {
  const f = equipo || {};
  const d = diag || null;
  const md = modoDegradacion(f, d);
  const mva = mvaDe(f);
  const sub = f.subestacion || '';
  const ci = f.cond_int != null ? f.cond_int : null;
  const cl = f.cond_lbl || '';

  let t = 'El presente documento tiene por alcance la ejecución de mantenimiento especializado sobre el '
    + `transformador de potencia de ${mvaTxt(mva)} MVA`
    + (f.matricula ? ` (matrícula ${f.matricula}${f.serie ? `, serie ${f.serie}` : ''})` : '')
    + ` que opera en la subestación ${sub}. `;

  t += 'Bajo la metodología de salud de activos el equipo se encuentra en condición '
    + (ci != null ? `${ci} de 5${cl ? ` — ${cl}` : ''}` : 'no clasificada')
    + (f.edad != null ? `, con ${f.edad} años de servicio${f.anio_fab ? ` (fabricación ${f.anio_fab})` : ''}` : '')
    + '. ';

  if (md) {
    const w = TRABAJO_POR_MODO[md.dominante.k];
    t += `El hallazgo que gobierna la intervención es ${md.dominante.t.toLowerCase()}: ${md.dominante.e}, `
      + `conforme a ${md.dominante.n}. `;
    if (w) {
      t += `En consecuencia, el trabajo comprende ${w.a} (${w.n}). `;
      if (!w.rev) {
        t += 'Se advierte que este modo de degradación NO se revierte con mantenimiento: la intervención '
          + 'contiene su avance y sostiene la operación con riesgo controlado, pero no devuelve al activo '
          + 'la vida de aislamiento ya consumida. ';
      }
    }
    if (md.todos.length > 1) {
      const otros = md.todos.slice(1)
        .map((m) => TRABAJO_POR_MODO[m.k] ? `${m.t.toLowerCase()} — ${TRABAJO_POR_MODO[m.k].a}` : m.t.toLowerCase());
      t += 'De forma concurrente se atiende ' + otros.join('; ') + '. ';
    }
  } else {
    t += 'No se identifican modos de degradación activos en los ensayos disponibles, de modo que el '
      + 'alcance corresponde al mantenimiento especializado programado del activo y a la actualización '
      + 'de su línea base de ensayos. ';
  }

  if (d && num(d.crg) != null && num(d.crg) >= 90) {
    t += `La unidad opera al ${numES(d.crg)} % de su capacidad nominal, por lo que la intervención debe `
      + 'programarse con la indisponibilidad coordinada y el respaldo de carga previsto. ';
  }
  // `> 0` y no `!= null`: con 0 usuarios la frase se autodestruye —«si no
  // afecta a nadie, nadie firma»— y contradice a la propia ficha, que dos
  // párrafos más abajo imprime «—» para ese mismo campo. Con el dato ausente
  // no se escribe, que es lo único cierto.
  if (f.usuarios > 0) {
    t += `La afectación asociada a una falla del activo alcanza ${numES(f.usuarios)} usuarios. `;
  }

  t += 'El alcance incluye los ensayos eléctricos de verificación antes y después de la intervención, la '
    + 'actualización del historial del activo y la reevaluación de su índice de salud con los resultados '
    + 'obtenidos.';

  // El argumento por ACTIVIDAD va al final y en bloque aparte: arriba queda el
  // porqué del activo (condición y hallazgo dominante), aquí el porqué de cada
  // trabajo. Si no hay nada marcado no se escribe nada — no se rellena con un
  // catálogo que el Ingeniero no escogió.
  // Orden del documento: primero QUÉ le pasa al activo (condición definida,
  // riesgo y afectación), después QUÉ se le va a hacer y por qué. Es el orden
  // en que lo lee quien firma.
  const cond = bloqueCondiciones(md);
  if (cond) t += '\n\n' + cond;

  const arg = argumentoDeAcciones(escogidas);
  if (arg) t += '\n\n' + arg;
  return t;
}

/**
 * Texto de los BENEFICIOS del documento de Mantenimiento Especializado.
 *
 * ⚠️ No promete «reinicio de la vida útil»: eso solo lo da un activo nuevo. El
 * beneficio de mantener es frenar el deterioro, recuperar lo que sí se recupera
 * y comprar tiempo de decisión con el riesgo bajo control.
 *
 * @param {object} equipo
 * @param {object} diag
 * @returns {string} viñetas separadas por salto de línea.
 */
export function redaccionBeneficiosMtto(equipo, diag) {
  const f = equipo || {};
  const d = diag || null;
  const md = modoDegradacion(f, d);
  const di = dpInfo(d);
  const L = [];

  L.push('· Atención dirigida al modo de falla identificado: la intervención actúa sobre '
    + (md ? md.dominante.t.toLowerCase().replace(/\s*\([^)]*\)/g, '') : 'la condición registrada del activo')
    + ', y no sobre una rutina genérica, con lo que el esfuerzo de mantenimiento se concentra donde está '
    + 'el riesgo real.');

  const w = md && TRABAJO_POR_MODO[md.dominante.k];
  if (w && w.rev) {
    L.push('· Recuperación efectiva de la condición: el hallazgo dominante es reversible mediante '
      + 'mantenimiento, de modo que se espera una mejora medible del índice de salud tras la intervención, '
      + 'verificable con los ensayos de comprobación.');
  } else if (w) {
    L.push('· Contención del deterioro y tiempo de decisión: el hallazgo dominante no se revierte con '
      + 'mantenimiento, pero la intervención frena su avance y permite operar con riesgo controlado '
      + 'mientras se estructura la reposición del activo, evitando una salida no programada.');
  }

  if (di && di.fueraRango) {
    L.push(`· Vigilancia proporcional al riesgo: con 2-FAL de ${numES(di.ppb)} ppb y DP estimado ${di.dp}, `
      + 'el aislamiento sólido exige seguimiento con periodicidad acortada; el documento deja programada esa '
      + 'vigilancia en lugar de dejarla al criterio de cada visita.');
  } else if (di && !di.papelSano && di.vidaUsada >= 50) {
    L.push(`· Vigilancia proporcional al riesgo: con el ${di.vidaTxt} % de la vida del aislamiento consumida `
      + `(DP estimado ${di.dp}), la intervención fija la periodicidad de seguimiento acorde a esa condición.`);
  }

  L.push('· Disponibilidad del suministro: reduce la probabilidad de una salida intempestiva y de la '
    + 'energía no suministrada asociada, con efecto directo en los indicadores de continuidad (SAIDI/SAIFI)'
    + (f.usuarios > 0 ? ` de los ${numES(f.usuarios)} usuarios atendidos` : ' de la zona de influencia') + '.');

  if (d && num(d.crg) != null && num(d.crg) >= 90) {
    L.push(`· Operación segura en el límite de carga: con una cargabilidad del ${numES(d.crg)} %, mantener el `
      + 'activo en condición controlada es lo que evita que una contingencia se convierta en interrupción, '
      + 'mientras no exista margen por otra vía.');
  }

  L.push('· Seguridad de personas e instalaciones: la intervención retira las condiciones que derivan en '
    + 'fallas violentas —fugas, sobrecalentamiento y defectos internos en evolución—, protegiendo al '
    + 'personal y a los equipos adyacentes de la subestación.');
  L.push('· Costo evitado: el mantenimiento programado sobre un modo de falla conocido cuesta una fracción '
    + 'de la atención correctiva de emergencia, del alquiler de respaldo y de las compensaciones por '
    + 'indisponibilidad que acarrea una salida no prevista.');
  L.push('· Decisión soportada: los ensayos de comprobación actualizan el índice de salud del activo con '
    + 'medición propia, dejando trazabilidad para sustentar la próxima decisión —continuar en operación, '
    + 'repotenciar o reponer— ante la Empresa y ante el regulador.');
  return L.join('\n');
}
