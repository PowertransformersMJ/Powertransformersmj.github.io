// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Bloques de análisis (modelo de datos FLEXIBLE)
// ──────────────────────────────────────────────────────────────
// Contrato genérico para que la IA exprese SIN LÍMITES su interpretación
// de un informe: cada prueba se modela como un "bloque" con sus series de
// puntos (curvas/barras) + su tabla de detalle + metadatos. El tablero
// grafica cualquier bloque de forma genérica → soportar un formato nuevo
// (DGA, SFRA, bushing, n posiciones de TAP, etc.) NO requiere tocar código.
//
// Decisión de arquitectura (ADR-006):
//   · El RESUMEN normativo (matriz/semáforo) sigue en el doc del informe
//     (liviano, va en el onSnapshot en vivo).
//   · Estos BLOQUES (detalle pesado: 17 TAPs × fases × tablas) NO inflan el
//     doc Firestore: se persisten como JSON en Storage y se cargan perezosamente
//     al abrir el tablero (desacople lectura ligera ↔ detalle pesado).
//
// Seguridad/escala: este sanitizador es DEFENSIVO y ACOTADO (caps) — la salida
// del LLM es semi-confiable; nunca se persiste sin acotar (protege Firestore,
// Storage y el render de payloads abusivos).
//
// Funciones puras, sin DOM ni Firestore. Testeable con node --test.
// ══════════════════════════════════════════════════════════════

export const BLOQUES_SCHEMA_VERSION = 1;

// Topes duros (escala + seguridad): un informe real cabe holgado debajo.
export const LIMITES = Object.freeze({
  BLOQUES: 24,   // familias de prueba × variantes por informe
  SERIES: 16,    // p.ej. 3 fases × pares de devanado
  PUNTOS: 64,    // p.ej. 17 posiciones de TAP (margen amplio)
  FILAS: 80,     // filas de la tabla de detalle
  COLS: 18,      // columnas de la tabla
  TXT: 240       // tope de longitud de un texto libre (título, observación)
});

export const TIPOS_GRAFICA = Object.freeze(['linea', 'barra', 'dispersion']);

/* ─── helpers puros ──────────────────────────────────────────── */
const str = (v, max = LIMITES.TXT) => {
  const s = (v == null) ? '' : String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
};
const num = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') v = v.replace(/,/g, '.');
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arr = (v) => Array.isArray(v) ? v : [];

/* ─── Punto de una serie: x puede ser número (TAP) o etiqueta (par) ─ */
export function sanitizarPunto(p) {
  const src = p || {};
  const xNum = num(src.x);
  const out = {
    x: xNum != null ? xNum : str(src.x, 40), // número si se puede; si no, etiqueta
    y: num(src.y)
  };
  // "verificar": el informe marca este valor como dudoso / a confirmar → el
  // render lo dibuja RAYADO (hatch). Se omite cuando es false para mantener
  // los puntos limpios ({x,y}) y el JSON liviano.
  if (src.verificar === true) out.verificar = true;
  // "extra": valores secundarios del informe que NO se grafican pero SÍ van a la
  // tabla de detalle (p.ej. Potencia W, tensión aplicada, R.Referencia). La IA
  // los adjunta INLINE al punto que ya extrae — más fiable que re-emitir toda la
  // tabla. Mapa {etiqueta: número}, acotado.
  if (src.extra && typeof src.extra === 'object' && !Array.isArray(src.extra)) {
    const e = {};
    for (const k of Object.keys(src.extra).slice(0, 8)) {
      const v = num(src.extra[k]);
      if (v != null) e[str(k, 40)] = v;
    }
    if (Object.keys(e).length) out.extra = e;
  }
  return out;
}

/* ─── Serie (una línea / un grupo de barras) ─────────────────── */
export function sanitizarSerie(s) {
  const src = s || {};
  const puntos = arr(src.puntos)
    .slice(0, LIMITES.PUNTOS)
    .map(sanitizarPunto)
    .filter((pt) => pt.y != null || pt.x !== '');
  return {
    nombre: str(src.nombre, 60),
    color: str(src.color, 24),  // opcional; el render asigna paleta si falta
    puntos
  };
}

/* ─── Tabla de detalle (genérica, acotada) ───────────────────── */
export function sanitizarTabla(t) {
  const src = t || {};
  const columnas = arr(src.columnas).slice(0, LIMITES.COLS).map((c) => str(c, 60));
  const filas = arr(src.filas).slice(0, LIMITES.FILAS).map((fila) =>
    arr(fila).slice(0, LIMITES.COLS).map((cell) => str(cell, 80)));
  return { columnas, filas };
}

/* ─── Bloque de análisis (una prueba / una visualización) ────── */
export function sanitizarBloque(b) {
  const src = b || {};
  const grafica = TIPOS_GRAFICA.includes(str(src.grafica)) ? str(src.grafica) : 'linea';
  const series = arr(src.series).slice(0, LIMITES.SERIES).map(sanitizarSerie)
    .filter((s) => s.puntos.length);
  const tabla = sanitizarTabla(src.tabla);
  return {
    prueba:        str(src.prueba, 60),     // clave de familia (excitacion, bushing, …)
    titulo:        str(src.titulo),         // título visible del bloque
    unidad:        str(src.unidad, 24),     // "mA" | "GΩ" | "pF" | "%" …
    eje_x:         str(src.eje_x, 60),      // "Posición del TAP" | "Buje" …
    grafica,
    series,
    tabla,
    limite:        num(src.limite),         // línea roja (límite normativo)
    guia:          num(src.guia),           // línea ámbar (guía)
    limite_desbalance: num(src.limite_desbalance), // criterio de desbalance entre fases (%)
    invertir:      src.invertir === true,   // límite es MÍNIMO (p.ej. aislamiento ≥1 GΩ)
    calif:         str(src.calif, 40),      // calificación global del bloque
    observaciones: str(src.observaciones, 1200) // análisis crítico de la IA (cap amplio: el tope TXT de 240 lo cortaba a media frase)
  };
}

/**
 * Sanitiza el arreglo de bloques que produce la IA. Descarta bloques sin
 * título o sin datos (ni series ni tabla). ACOTADO por LIMITES.
 * @param {Array} input
 * @returns {{schema_version:number, bloques:Array}}
 */
export function sanitizarBloques(input) {
  const bloques = arr(input)
    .slice(0, LIMITES.BLOQUES)
    .map(sanitizarBloque)
    .filter((b) => b.titulo && (b.series.length || b.tabla.filas.length));
  return { schema_version: BLOQUES_SCHEMA_VERSION, bloques };
}

/* ─── Tabla de detalle COMPLETA derivada de las series (curvas por TAP) ──
 * La IA emite las curvas en `series` ({x:TAP, y:valor}) pero NO re-emite la
 * tabla ancha del informe (probado: omite `tabla` en bloques de curva). Por eso
 * la construimos AQUÍ, de forma DETERMINISTA, para "ir más allá" del valor por
 * fase. Columnas: TAP · valor por fase · [columnas `extra` que la IA adjunte al
 * punto: Potencia W, tensión, R.Ref…] · Desviación % (derivada, física por
 * prueba) · Evaluación (derivada del umbral de desbalance). Función pura.
 * @param {object} bloque  bloque sanitizado (con series)
 * @returns {{columnas:string[], filas:Array<Array>}}
 */
export function derivarTablaTAP(bloque) {
  const series = (bloque && bloque.series || []).filter((s) => (s.puntos || []).length);
  if (!series.length) return { columnas: [], filas: [] };

  // Orden de categorías X (TAPs): numérico si todas lo son.
  const xs = []; const vistos = new Set(); let allNum = true;
  for (const s of series) for (const p of s.puntos) {
    const k = String(p.x);
    if (!vistos.has(k)) { vistos.add(k); xs.push(p.x); }
    if (typeof p.x !== 'number') allNum = false;
  }
  if (allNum) xs.sort((a, b) => a - b);

  const mapY = series.map((s) => new Map((s.puntos || []).map((p) => [String(p.x), p.y])));
  const mapEx = series.map((s) => new Map((s.puntos || []).map((p) => [String(p.x), p.extra || null])));
  const phaseNames = series.map((s) => s.nombre || '—');

  // Claves `extra` en orden de aparición (Potencia W, tensión, R.Ref…).
  const extraKeys = []; const ek = new Set();
  for (const s of series) for (const p of s.puntos) if (p.extra) for (const k of Object.keys(p.extra)) {
    if (!ek.has(k)) { ek.add(k); extraKeys.push(k); }
  }

  // Clave `extra` que YA es la desviación reportada por el informe (p.ej. "%DIF"
  // en relación = desviación vs placa). Si existe, la columna Desv. la usa en vez
  // de derivarla vs promedio (consistente con la gráfica de desviación).
  const devKey = extraKeys.find((k) => /%?\s*dif|desviaci|\bdesv\b/i.test(k)) || null;

  const esMultiFase = series.length >= 2;
  const addDesv = esMultiFase;
  // NO se añade columna de veredicto/Evaluación: el VEREDICTO es del panel
  // multi-norma (valor vs cada norma + consolidado), nunca un "OK" por fila
  // (ni de la IA ni derivado) — L-36/L-42. La tabla es DATOS (incl. Desv. %).

  const columnas = [bloque.eje_x || 'X', ...phaseNames];
  for (const k of extraKeys) for (const pn of phaseNames) columnas.push(`${k} · ${pn}`);
  if (addDesv) columnas.push('Desv. %');

  const filas = xs.map((x) => {
    const key = String(x);
    const vals = mapY.map((m) => { const v = m.get(key); return v == null ? null : v; });
    const row = [key, ...vals.map((v) => v == null ? '' : v)];
    for (const k of extraKeys) for (let si = 0; si < series.length; si++) {
      const ex = mapEx[si].get(key);
      row.push(ex && ex[k] != null ? ex[k] : '');
    }
    if (addDesv) {
      const nums = vals.filter((v) => v != null);
      let d = null;
      if (devKey) {
        // El informe ya reporta la desviación por fila (%DIF vs placa): el peor
        // caso entre fases (mayor magnitud, conservando el signo) define la celda.
        let worst = null;
        for (let si = 0; si < series.length; si++) {
          const ex = mapEx[si].get(key);
          const dv = ex && typeof ex[devKey] === 'number' ? ex[devKey] : null;
          if (dv != null && (worst == null || Math.abs(dv) > Math.abs(worst))) worst = dv;
        }
        d = worst;
      } else if (nums.length >= 2) {
        if (bloque.prueba === 'excitacion') {
          // Criterio IEEE: % entre las DOS corrientes laterales (mayores) —
          // Δ = (I_mayor − I_2ª) / I_mayor × 100. Se divide entre la MAYOR (como
          // el informe del laboratorio). La fase central es naturalmente menor
          // (núcleo de 3 columnas) → se excluye del cálculo.
          const sorted = nums.slice().sort((a, b) => b - a);
          d = sorted[0] ? ((sorted[0] - sorted[1]) / Math.abs(sorted[0])) * 100 : null;
        } else {
          // Relación / resistencia: máxima desviación de una fase vs el promedio.
          const prom = nums.reduce((a, b) => a + b, 0) / nums.length;
          d = prom ? Math.max(...nums.map((v) => Math.abs((v - prom) / prom) * 100)) : null;
        }
      }
      row.push(d == null ? '' : +d.toFixed(3));
    }
    return row.slice(0, LIMITES.COLS);
  });

  return { columnas: columnas.slice(0, LIMITES.COLS), filas };
}

/* ─── Quitar columnas de VEREDICTO de una tabla (L-42) ──────────
 * El veredicto sale del panel multi-norma (valor vs cada norma), NUNCA de un
 * "OK"/"Correcto" por fila que ponga la IA o el laboratorio. Cada laboratorio
 * nombra distinto esa columna ("Evaluación", "Resultado", "Concepto"…), así que
 * se detecta por DOS vías: el encabezado, O que TODAS sus celdas no vacías sean
 * palabras de veredicto (OK/Correcto/Satisfactorio/Investigar/…). Pura, testeable. */
const COL_VEREDICTO_HEADER = /evaluaci|calificaci|veredicto|resultado|concepto|dictamen|diagn[oó]stic|^\s*eval\.?\s*$/i;
const CELDA_VEREDICTO = /^(ok|correcto|satisfactorio|bueno|aprueba|aprobado|rechaza|rechazado|investigar|vigilar|a\s+vigilar|verificar|pobre|deficiente|aceptable|favorable|no\s+ok|n\s*\/?\s*[ad])$/i;
function esColumnaVeredicto(header, celdas) {
  if (COL_VEREDICTO_HEADER.test(String(header == null ? '' : header))) return true;
  const noVacias = (celdas || []).map((c) => String(c == null ? '' : c).trim()).filter((c) => c !== '');
  return noVacias.length > 0 && noVacias.every((c) => CELDA_VEREDICTO.test(c));
}

/**
 * Devuelve {columnas, filas} sin las columnas de veredicto (L-42).
 * @param {{columnas:string[], filas:Array<Array>}} tabla
 * @returns {{columnas:string[], filas:Array<Array>}}
 */
export function quitarColumnasVeredicto(tabla) {
  const cols = (tabla && tabla.columnas) || [];
  const filas = (tabla && tabla.filas) || [];
  if (!cols.length) return { columnas: cols, filas };
  const drop = [];
  for (let i = 0; i < cols.length; i++) {
    if (esColumnaVeredicto(cols[i], filas.map((f) => f[i]))) drop.push(i);
  }
  if (!drop.length) return { columnas: cols, filas };
  const quitar = (arr) => arr.filter((_, i) => !drop.includes(i));
  return { columnas: quitar(cols), filas: filas.map(quitar) };
}

/**
 * Deriva el FP de bujes CANÓNICO (peor tan δ y peor desviación de C1 vs placa)
 * a partir de los bloques de bushing/buje (ADR-013). Puro y portable: lo usan
 * el shell (carga/reproceso cliente) y la Cloud Function (reproceso server-side)
 * → una sola fuente de verdad. `null` si el informe no trae bujes.
 * @param {Array} bloques
 * @returns {{fp_max_pct:number|null, dc1_max_pct:number|null}|null}
 */
export function derivarBushing(bloques) {
  const bs = (Array.isArray(bloques) ? bloques : []).filter((b) => b && /bushing|buje/i.test(b.prueba || ''));
  if (!bs.length) return null;
  let fpMax = null, dc1Max = null;
  for (const b of bs) {
    for (const s of (b.series || [])) {
      for (const p of (s.puntos || [])) {
        if (typeof p.y === 'number') fpMax = (fpMax == null) ? p.y : Math.max(fpMax, p.y);
        const ex = p.extra || {};
        const placa = Number(ex['Cap. placa (pF)'] ?? ex['Cap placa (pF)']);
        const med = Number(ex['Cap. medida (pF)'] ?? ex['Cap medida (pF)']);
        if (Number.isFinite(placa) && placa && Number.isFinite(med)) {
          const d = Math.abs((med - placa) / placa) * 100;
          dc1Max = (dc1Max == null) ? d : Math.max(dc1Max, d);
        }
      }
    }
  }
  if (fpMax == null && dc1Max == null) return null;
  return {
    fp_max_pct: fpMax != null ? +fpMax.toFixed(4) : null,
    dc1_max_pct: dc1Max != null ? +dc1Max.toFixed(3) : null
  };
}

// Familias de prueba para la vista MULTI-AÑO (clave canónica + dirección del
// "peor caso" + si su gráfica es de barras). `inv:true` = peor es el MÍNIMO
// (aislamiento: bajar es malo); el resto, peor = MÁXIMO.
const FAMILIAS_MA = [
  { key: 'tand',        re: /tan|fp.*(devan|aisl|transform)|factor de potencia(?!.*buje)/i, inv: false },
  { key: 'bushing',     re: /bushing|buje/i,                inv: false },
  { key: 'excitacion',  re: /excitaci/i,                    inv: false },
  { key: 'relacion',    re: /relaci/i,                      inv: false },
  { key: 'resistencia', re: /resist.*(devan|arroll)|^resistencia/i, inv: false },
  { key: 'aislamiento', re: /aislamiento|megado|\bIR\b/i,   inv: true },
  { key: 'collar',      re: /collar/i,                      inv: false }
];

// Pruebas que NO son ELÉCTRICAS: análisis FÍSICO-QUÍMICO del aceite (DGA/gases
// disueltos, fisicoquímicos, furanos, humedad del papel…). Este tablero es de
// PRUEBAS ELÉCTRICAS (el director: "esto es pruebas eléctricas y no análisis de
// aceite"). Aunque la IA llegara a extraer una tabla de aceite de un informe
// mixto, NO debe contaminar el tablero eléctrico → se excluye del multi-año.
const ES_NO_ELECTRICA = /\bdga\b|gas(es)?\s*disuelt|cromatograf|aceite|fisicoqu[ií]mic|\bfisico\b|furan|humedad.*papel|tensi[oó]n\s*interfacial|\bift\b|acidez/i;

export function familiaMA(bloque) {
  const p = String((bloque && (bloque.prueba || bloque.titulo)) || '').toLowerCase();
  // Coincidencia directa por clave canónica primero.
  const directa = FAMILIAS_MA.find((f) => f.key === p);
  if (directa) return directa;
  const reMatch = FAMILIAS_MA.find((f) => f.re.test(p));
  if (reMatch) return reMatch;
  // Excluir análisis de aceite (no es prueba eléctrica) — ver ES_NO_ELECTRICA.
  if (ES_NO_ELECTRICA.test(p)) return null;
  // Fallback GENÉRICO (ADR-027): cualquier OTRA prueba ELÉCTRICA presente en el
  // informe (SFRA, reactancia de dispersión, IR de núcleo, LTC/DRM, DFR…) NO se
  // descarta — obtiene su PROPIA familia keyed por su clave canónica/título, para
  // que TODA prueba eléctrica ejecutada en cualquier año se aprecie en el multi-
  // año (el director: "todos se puedan apreciar en el tablero"). La gráfica
  // genérica (`svgBloque`) ya pinta cualquier {x,y} + su límite/guía si la trae.
  const base = p.trim().replace(/\s+/g, ' ');
  return base ? { key: `otros:${base}`, inv: false, generic: true } : null;
}

// Discriminador ESTRUCTURAL de un bloque para el multi-año: identifica la
// SUB-PRUEBA por su PAR DE DEVANADOS (AT/MT vs AT/BT…) + tipo de gráfica,
// IGNORANDO números (kV, °C, TAP) y redacción del laboratorio. Así la MISMA
// sub-prueba se superpone entre años aunque el trafo MÓVIL se haya desplegado a
// tensiones DISTINTAS (2021: 63.5/13.8 kV · 2023: 110/34.5/13.8 · 2024: 66/…,
// ADR-014) o el informe titule distinto ("…referida a 75 °C", "AT 66 kV"…); pero
// sub-pruebas DISTINTAS del mismo informe (relación AT/MT vs AT/BT; resistencia
// AT en Ω vs MT/BT en mΩ) van a gráficas SEPARADAS (no se fusionan escalas/uds).
// Pura. El par de devanados es estable año a año; el título completo NO lo es.
// Normaliza la fecha de un informe a "DD/MM/YYYY" para una etiqueta UNIFORME en
// los chips/leyenda. Los informes vienen con formatos dispares según el lab/IA
// ("18/01/2022", "2022/05/02", "Enero 19 del 2024", "19 de enero de 2024") → sin
// esto el MISMO día se ve como informes distintos. Si no reconoce el formato,
// devuelve el texto tal cual (o el año). Pura.
const _MESES_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const _pad2 = (n) => String(n).padStart(2, '0');
export function etiquetaFecha(fecha, ano) {
  const s = String(fecha == null ? '' : fecha).trim();
  if (!s) return ano != null ? String(ano) : 's/a';
  let m;
  if ((m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/))) return `${_pad2(m[1])}/${_pad2(m[2])}/${m[3]}`;      // DD/MM/YYYY
  if ((m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/))) return `${_pad2(m[3])}/${_pad2(m[2])}/${m[1]}`;      // YYYY/MM/DD
  const low = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');                                       // con nombre de mes (es)
  const mes = Object.keys(_MESES_ES).find((k) => low.includes(k));
  const dia = low.match(/\b(\d{1,2})\b/), anio = low.match(/\b(\d{4})\b/);
  if (mes && dia && anio) return `${_pad2(dia[1])}/${_pad2(_MESES_ES[mes])}/${anio[1]}`;
  return s;
}

// Orden CRONOLÓGICO real de un informe por su etiqueta "DD/MM/YYYY" → AAAAMMDD.
// Sin esto, ordenar por string pone "02/05/2022" ANTES que "18/01/2022" (mayo
// antes que enero) — orden lexicográfico, no de fecha. Cae al año si no matchea.
export function ordenInforme(repLabel, ano) {
  // Match del PREFIJO de fecha (sin anclar al final): la etiqueta puede llevar un
  // sufijo de config (" · estrella") cuando dos informes coinciden en fecha.
  const m = String(repLabel == null ? '' : repLabel).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  return (Number(ano) || 0) * 10000;
}

// Etiqueta corta de CONFIGURACIÓN de un informe para desambiguar dos del MISMO día
// (trafo móvil: misma prueba el mismo día en estrella vs delta, ADR-014/028).
// Prioridad: (1) `config` explícito; (2) un rótulo "estrella/delta" hallado en los
// textos del informe (nombre de archivo, título…) — la config de DESPLIEGUE vive ahí,
// NO en el grupo de placa (nameplate), que es del DISEÑO y puede no coincidir; (3) como
// último recurso, el grupo de conexión (HV: D→delta, Y→estrella). '' si no hay nada.
const _id = (it) => (it && it.identidad) || {};
export function configInforme(it) {
  const c = (it && it.config != null) ? String(it.config).trim() : '';
  if (c) return c;
  const id = _id(it);
  const textos = [it && it.nombre, it && it.archivo, it && it.pdf, it && it.titulo, it && it.tipo_prueba,
    id.configuracion, id.conexion, id.montaje].map((t) => String(t == null ? '' : t).toLowerCase())
    .join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // TIPO de ensayo ESPECIAL: cuando un mismo día hay varios PDFs (un libro de
  // pruebas eléctricas Y un libro de SFRA aparte) comparten fecha+config → hay que
  // distinguir también por el tipo de ensayo del nombre/título.
  let tipo = '';
  if (/\bsfra\b|respuesta en frecuencia/.test(textos)) tipo = 'SFRA';
  else if (/\bdfr\b/.test(textos)) tipo = 'DFR';
  // CONFIG de conexión: rótulo del texto (despliegue) primero; el grupo de placa
  // (nameplate) es del DISEÑO y puede no coincidir → solo como último recurso.
  let conf = '';
  if (/\bdelta\b/.test(textos)) conf = 'delta';
  else if (/\bestrella\b|\bwye\b|\bstar\b/.test(textos)) conf = 'estrella';
  if (!conf) {
    const gc = String((it && it.grupo_conexion) || id.grupo_conexion || '').trim();
    if (gc) {
      const h = gc[0].toUpperCase();
      conf = h === 'D' ? 'delta' : h === 'Y' ? 'estrella' : (gc.split(/[^A-Za-z0-9]/)[0] || '');
    }
  }
  return [tipo, conf].filter(Boolean).join(' ');
}

const DEVANADOS = ['at', 'mt', 'bt'];
function discriminadorBloque(b) {
  const t = String((b && (b.titulo || b.prueba)) || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Par de devanados del título. Si el informe NO lo declara (algunos laboratorios
  // titulan "Corriente de excitación por TAP" sin "AT"), se asume AT = lado
  // PRIMARIO (el más ensayado) → así la MISMA prueba AT no se fragmenta entre años
  // por una diferencia de redacción; la excitación/relación MT sí se distingue
  // porque SÍ trae "MT" en el título.
  const w = DEVANADOS.filter((k) => new RegExp(`\\b${k}\\b`).test(t)).join('') || 'at';
  const g = (b && b.grafica === 'barra') ? 'barra' : 'linea';
  return `${w}|${g}`;
}

/**
 * Construye UN bloque multi-año por SUB-PRUEBA (familia + identidad de título),
 * superponiendo TODOS los INFORMES del libro. Dos claves de identidad:
 *  · El GRUPO (qué gráfica) = familia + título estructural → sub-pruebas distintas
 *    (relación AT/MT vs AT/BT; resistencia AT en Ω vs MT/BT en mΩ) van a gráficas
 *    SEPARADAS, nunca fusionadas con escalas/uds mezcladas (ADR-028).
 *  · La SERIE (qué línea) = el INFORME (no el año), para que DOS informes del MISMO
 *    año NO se colapsen (serie 450108 con 2 ensayos en 2021, ADR-026).
 * Conserva CADA FASE de cada informe como su propia serie (valores REALES, sin
 * reducir), etiquetada con `_rep`/`_repLabel`/`_ano`/`_fase` (filtrable). El nombre
 * visible es "<fecha|año> · <fase>".
 * @param {Array<{ano:(number|null), fecha?:string, id?:string, bloques:Array}>} items
 * @returns {Array<object>} bloques multi-informe (uno por sub-prueba con datos)
 */
export function bloquesMultiAno(items) {
  const fam = new Map();
  const repMeta = new Map(); // rep → {label, config, ano} para desambiguar colisiones de fecha
  for (const it of (Array.isArray(items) ? items : [])) {
    const ano = it && it.ano;
    const repLabel = etiquetaFecha(it && it.fecha, ano); // etiqueta UNIFORME DD/MM/YYYY
    // Identidad ÚNICA por informe: id > fecha cruda > etiqueta. Sin esto, dos
    // informes del mismo año compartirían clave y se solaparían. (La identidad usa
    // la fecha CRUDA, no la normalizada, para no fundir estrella+delta del mismo día.)
    const rep = (it && it.id != null && String(it.id)) || (it && it.fecha) || repLabel;
    if (!repMeta.has(rep)) repMeta.set(rep, { label: repLabel, config: configInforme(it), ano });
    for (const b of ((it && it.bloques) || [])) {
      const f = familiaMA(b);
      if (!f) continue;
      // Clave de GRUPO fina: familia + par de devanados + tipo de gráfica (no
      // solo la familia) → separa sub-pruebas con escalas/uds distintas, pero
      // superpone la MISMA sub-prueba entre años (tensiones/títulos distintos).
      const gkey = `${f.key}|${discriminadorBloque(b)}`;
      if (!fam.has(gkey)) {
        fam.set(gkey, {
          prueba: f.key, titulo: b.titulo || f.key, unidad: b.unidad || '',
          eje_x: b.eje_x || '', grafica: b.grafica === 'barra' ? 'barra' : 'linea',
          limite: b.limite != null ? b.limite : null, guia: b.guia != null ? b.guia : null,
          limite_desbalance: b.limite_desbalance != null ? b.limite_desbalance : null,
          _ord: fam.size, _tAno: (ano != null ? ano : -Infinity), _series: []
        });
      }
      const g = fam.get(gkey);
      // El encabezado del grupo usa el título/metadatos del informe MÁS RECIENTE
      // que APORTE datos graficables (el despliegue vigente del trafo móvil) — un
      // bloque sin series numéricas (p.ej. "Resultados SFRA por devanado", todo
      // cualitativo) NO debe ganar el título sobre el de datos ("Coeficientes…").
      const tieneDatos = (b.series || []).some((s) => (s.puntos || []).some((p) => p && p.x != null && typeof p.y === 'number'));
      if (tieneDatos && ano != null && ano >= g._tAno) {
        g._tAno = ano;
        if (b.titulo) g.titulo = b.titulo;
        if (b.unidad) g.unidad = b.unidad;
        if (b.eje_x) g.eje_x = b.eje_x;
        if (b.limite != null) g.limite = b.limite;
        if (b.guia != null) g.guia = b.guia;
        if (b.limite_desbalance != null) g.limite_desbalance = b.limite_desbalance;
      }
      for (const s of (b.series || [])) {
        const puntos = (s.puntos || []).filter((p) => p && p.x != null && typeof p.y === 'number');
        if (!puntos.length) continue;
        g._series.push({ rep, ano, fase: String(s.nombre || ''), puntos });
      }
    }
  }
  // Etiqueta FINAL por informe: si dos+ informes comparten la misma fecha (trafo
  // móvil: estrella y delta el MISMO día), se les añade la config para distinguir
  // los chips ("19/01/2024 · estrella" vs "· delta"). Si la fecha es única, queda
  // limpia. Sin config disponible para desempatar, se deja la fecha tal cual.
  const porFecha = new Map();
  for (const [rep, m] of repMeta) {
    if (!porFecha.has(m.label)) porFecha.set(m.label, []);
    porFecha.get(m.label).push(rep);
  }
  const etiqFinal = (rep) => {
    const m = repMeta.get(rep) || {};
    const colisiona = (porFecha.get(m.label) || []).length > 1;
    return (colisiona && m.config) ? `${m.label} · ${m.config}` : (m.label || rep);
  };
  return [...fam.values()]
    .map((g) => {
      const series = g._series
        .slice().sort((a, b) => ordenInforme(etiqFinal(a.rep), a.ano) - ordenInforme(etiqFinal(b.rep), b.ano))
        .map((s) => {
          const lbl = etiqFinal(s.rep);
          return {
            nombre: s.fase ? `${lbl} · ${s.fase}` : lbl,
            _rep: s.rep, _repLabel: lbl, _ano: s.ano != null ? String(s.ano) : 's/a',
            _fase: s.fase, puntos: s.puntos
          };
        });
      const { _series, _ord, _tAno, ...resto } = g;
      void _ord; void _tAno;
      return { ...resto, series };
    })
    .filter((b) => b.series.length);
}
