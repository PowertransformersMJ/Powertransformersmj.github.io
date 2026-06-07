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
  const lim = num(bloque.limite_desbalance);
  const addDesv = esMultiFase;
  const addEval = esMultiFase && lim != null;

  const columnas = [bloque.eje_x || 'X', ...phaseNames];
  for (const k of extraKeys) for (const pn of phaseNames) columnas.push(`${k} · ${pn}`);
  if (addDesv) columnas.push('Desv. %');
  if (addEval) columnas.push('Eval.');

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
      if (addEval) row.push(d == null ? '' : (Math.abs(d) <= lim ? 'OK' : 'verificar'));
    }
    return row.slice(0, LIMITES.COLS);
  });

  return { columnas: columnas.slice(0, LIMITES.COLS), filas };
}
