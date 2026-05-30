// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — schema de dominio (sanitizar / validar)
// ──────────────────────────────────────────────────────────────
// Modelo de datos del módulo "Mantenimiento Predictivo · Pruebas
// Eléctricas". Reemplaza el archivo estático por documentos
// Firestore consumibles en tiempo real.
//
// Estructura:
//   /pruebas_electricas/{unidadId}            → identidad de la unidad
//     · subcol /informes/{informeId}          → un informe por año/visita
//
// Cada informe contiene las mediciones crudas de las 6 pruebas; el
// semáforo (pruebas_electricas_semaforo.js) las califica. El PDF
// original vive en Firebase Storage; aquí se guarda solo la ref.
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

/** Configuraciones de aislamiento para tan δ (códigos del tablero). */
export const CONFIGS_TAND = Object.freeze([
  { code: 'CH',  entre: 'AT ↔ tierra' },
  { code: 'CHL', entre: 'AT ↔ MT'     },
  { code: 'CL',  entre: 'MT ↔ tierra' },
  { code: 'CLT', entre: 'MT ↔ BT'     },
  { code: 'CT',  entre: 'BT ↔ tierra' },
  { code: 'CHT', entre: 'AT ↔ BT'     }
]);

/* ─── Identidad de la unidad ──────────────────────────────────── */

export function sanitizarUnidad(input) {
  const src = input || {};
  return {
    schema_version: 1,
    serie:        str(src.serie),
    fabricante:   str(src.fabricante),
    ano_fabricacion: int(src.ano_fabricacion),
    potencia:     str(src.potencia),       // ej. "22.5 / 30 MVA"
    tensiones:    str(src.tensiones),      // ej. "110/34.5/13.8 kV"
    grupo_conexion: str(src.grupo_conexion),
    refrigeracion: str(src.refrigeracion),
    frecuencia:   str(src.frecuencia),
    cliente:      str(src.cliente),
    ubicacion:    str(src.ubicacion),
    subestacion:  str(src.subestacion),
    transformadorId: str(src.transformadorId) // FK opcional al inventario
  };
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

/* ─── Informe individual (un año / una visita) ────────────────── */

export function sanitizarInforme(input) {
  const src = input || {};
  // tan δ: arreglo de configs medidas { code, valor_pct }
  const tand = Array.isArray(src.tand)
    ? src.tand.map((t) => ({
        code: str(t.code).toUpperCase(),
        valor_pct: num(t.valor_pct)
      })).filter((t) => t.code)
    : [];
  return {
    schema_version: 1,
    unidadId:   str(src.unidadId),
    serie:      str(src.serie),
    ano:        int(src.ano),
    fecha:      str(src.fecha),
    ejecutante: str(src.ejecutante),
    equipos:    Array.isArray(src.equipos)
      ? src.equipos.map(str).filter(Boolean) : [],
    // ── mediciones por prueba ──
    tand,
    excitacion: {
      delta_pct:    num(src.excitacion && src.excitacion.delta_pct),
      corriente_ma: num(src.excitacion && src.excitacion.corriente_ma)
    },
    relacion: {
      desviacion_pct: num(src.relacion && src.relacion.desviacion_pct)
    },
    resistencia: {
      desbalance_pct: num(src.resistencia && src.resistencia.desbalance_pct),
      verificar:      bool(src.resistencia && src.resistencia.verificar)
    },
    aislamiento: {
      gohm: num(src.aislamiento && src.aislamiento.gohm)
    },
    collar: {
      mw: num(src.collar && src.collar.mw)
    },
    // ── PDF original (Firebase Storage) ──
    pdf: {
      storagePath: str(src.pdf && src.pdf.storagePath),
      downloadURL: str(src.pdf && src.pdf.downloadURL),
      filename:    str(src.pdf && src.pdf.filename),
      size:        int(src.pdf && src.pdf.size),
      estado:      str(src.pdf && src.pdf.estado) || 'pendiente_extraccion'
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
  return errs;
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
  const norm = (x) => x.replace(/[\s\u2010-\u2015-]/g, '').toUpperCase();
  const encontrada = norm(texto).includes(norm(serie));
  return { coincide: encontrada, serieIngresada: serie, encontrada };
}
