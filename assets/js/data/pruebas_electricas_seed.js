// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — seed curado (datos REALES · tal cual HTML)
// ──────────────────────────────────────────────────────────────
// Reproduce, valor por valor, la unidad y los 3 informes base del
// tablero de referencia "Tablero Dinamico de Pruebas Electricas.html".
// NO hay datos inventados: el tablero solo publica los valores de
// resumen por gráfica (no el detalle crudo por fase), así que el seed
// carga EXACTAMENTE esos valores de resumen.
//
// Este seed existe porque la capa de datos (pruebas_electricas.js)
// emite listas VACÍAS cuando Firebase no está configurado ("solo
// datos reales"). Los 3 informes base SON datos reales históricos,
// así que el shell los inyecta como punto de partida; al subir un
// informe nuevo del mismo número de serie se anexa a la tendencia.
//
// Todo pasa por sanitizarUnidad / sanitizarInforme antes de usarse.
// ══════════════════════════════════════════════════════════════

import { sanitizarUnidad, sanitizarInforme } from '../domain/pruebas_electricas_schema.js';

const UNIDAD_ID = '173523-15510';
const DOCS = `../assets/docs/pruebas/${UNIDAD_ID}`;

/* ─── Identidad de la unidad (UNIT del tablero) ───────────────── */
const UNIDAD_RAW = {
  serie:           UNIDAD_ID,
  fabricante:      'Siemens',
  ano_fabricacion: 1998,
  potencia:        '22.5 / 30 MVA',
  tensiones:       '110 / 34.5 / 13.8 kV',
  grupo_conexion:  'YNyn0d1',
  refrigeracion:   'ONAN / ONAF',
  fases:           '3',
  cliente:         'Electricaribe',
  ubicacion:       'S/E La Jagua, Cesar',
  subestacion:     'S/E La Jagua'
};

/* ─── Helpers de armado por prueba (solo valores de resumen) ──── */

// tan δ por sección (CH/CHL/CL/CLT/CT/CHT) — un valor % por config.
function tand(ch, chl, cl, clt, ct, cht) {
  return [
    { code: 'CH',  valor_pct: ch  },
    { code: 'CHL', valor_pct: chl },
    { code: 'CL',  valor_pct: cl  },
    { code: 'CLT', valor_pct: clt },
    { code: 'CT',  valor_pct: ct  },
    { code: 'CHT', valor_pct: cht }
  ];
}

/* ─── Los 3 informes base (STATE.reports del tablero) ─────────── */

const INFORMES_RAW = [
  {
    id:           'r2012',
    unidadId:     UNIDAD_ID,
    serie:        UNIDAD_ID,
    ano:          2012,
    fecha:        '23/08/2012',
    ejecutante:   'Applus',
    equipo:       'DOBLE M4100 · Vanguard TTR/WRM10',
    serie_en_pdf: UNIDAD_ID,
    tipo:         'base',
    tand:         tand(0.39, 0.27, 1.23, 0.24, 0.49, 0.54),
    excitacion:   { devanado: 'AT', delta_ext_pct: 4.41 },
    relacion:     [{ devanado: 'AT', asociado: 'MT', desviacion_pct: 0.13 }],
    resistencia:  [
      { devanado: 'AT', delta_max_pct: 0.76 },
      { devanado: 'MT', delta_max_pct: 0.95 },
      { devanado: 'BT', delta_max_pct: 1.01 }
    ],
    aislamiento:  [],
    collar:       { max_mw: 49 },
    pdf: {
      filename:    '130823-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf',
      downloadURL: `${DOCS}/130823-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf`,
      storagePath: `pruebas_electricas/${UNIDAD_ID}/130823-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf`,
      size:        157860,
      estado:      'procesado'
    }
  },
  {
    id:           'r2014',
    unidadId:     UNIDAD_ID,
    serie:        UNIDAD_ID,
    ano:          2014,
    fecha:        '09/06/2014',
    ejecutante:   'Applus',
    equipo:       'CPC100 + CP TD1 · DOBLE M4100 · Megger MIT 520',
    serie_en_pdf: UNIDAD_ID,
    tipo:         'base',
    tand:         tand(0.42, 0.34, 1.52, 0.32, 0.67, 0.66),
    excitacion:   { devanado: 'AT', delta_ext_pct: 4.83 },
    relacion:     [
      { devanado: 'AT', asociado: 'MT',    desviacion_pct: 0.09 },
      { devanado: 'AT', asociado: 'Terc.', desviacion_pct: 0.31 }
    ],
    resistencia:  [
      { devanado: 'AT', delta_max_pct: 0.22 },
      { devanado: 'MT', delta_max_pct: 0.15 },
      { devanado: 'BT', delta_max_pct: 0.35 }
    ],
    aislamiento:  [],
    collar:       { max_mw: 56 },
    pdf: {
      filename:    '140609-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf',
      downloadURL: `${DOCS}/140609-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf`,
      storagePath: `pruebas_electricas/${UNIDAD_ID}/140609-2100-MPRD-LJA-T1-173523-15510_PRUEBA_TRAFO_30MVA.pdf`,
      size:        611323,
      estado:      'procesado'
    }
  },
  {
    id:           'r2020',
    unidadId:     UNIDAD_ID,
    serie:        UNIDAD_ID,
    ano:          2020,
    fecha:        '09/08/2020',
    ejecutante:   'Applus',
    equipo:       'CPC100 + CP TD1 · Megger MIT 1025',
    serie_en_pdf: '',
    tipo:         'base',
    tand:         tand(0.146, 0.100, 0.192, 0.089, 0.334, 0.054),
    excitacion:   { devanado: 'AT', delta_ext_pct: 3.02 },
    relacion:     [
      { devanado: 'AT', asociado: 'MT',    desviacion_pct: 0.14 },
      { devanado: 'AT', asociado: 'Terc.', desviacion_pct: 0.23 }
    ],
    resistencia:  [
      { devanado: 'AT', delta_max_pct: 0.04, verificar: true },
      { devanado: 'MT', delta_max_pct: 0.20 },
      { devanado: 'BT', no_medido: true }
    ],
    // Aislamiento es una FOTO del informe más reciente (2020), por par.
    aislamiento:  [
      { devanado: 'P', asociado: 'Tierra', gohm: 3.50 },
      { devanado: 'P', asociado: 'Sec',    gohm: 2.50 },
      { devanado: 'P', asociado: 'Terc',   gohm: 3.56 },
      { devanado: 'S', asociado: 'Tierra', gohm: 2.20 },
      { devanado: 'S', asociado: 'Terc',   gohm: 1.54 },
      { devanado: 'T', asociado: 'Tierra', gohm: 1.42 }
    ],
    collar:       { max_mw: 57.9 },
    pdf: {
      filename:    '200622-21-MPRD-_SE_LA_JAGUA_-_TRANSFORMADOR_2_-_PYE_.pdf',
      downloadURL: `${DOCS}/200622-21-MPRD-_SE_LA_JAGUA_-_TRANSFORMADOR_2_-_PYE_.pdf`,
      storagePath: `pruebas_electricas/${UNIDAD_ID}/200622-21-MPRD-_SE_LA_JAGUA_-_TRANSFORMADOR_2_-_PYE_.pdf`,
      size:        796647,
      estado:      'procesado'
    }
  }
];

/* ─── API del seed ────────────────────────────────────────────── */

/** Unidad base sanitizada (con id para el grid de parque). */
export function unidadSeed() {
  return { id: UNIDAD_ID, ...sanitizarUnidad(UNIDAD_RAW) };
}

/** Lista de unidades base (hoy: una sola). */
export function unidadesSeed() {
  return [unidadSeed()];
}

/**
 * Informes base de una unidad, sanitizados y ordenados por año asc.
 * Devuelve [] si la serie no es la base.
 */
export function informesSeed(unidadId) {
  if (unidadId && unidadId !== UNIDAD_ID) return [];
  return INFORMES_RAW
    .map((r) => ({ id: r.id, ...sanitizarInforme(r) }))
    .sort((a, b) => (a.ano || 0) - (b.ano || 0));
}

export const SEED_UNIDAD_ID = UNIDAD_ID;
