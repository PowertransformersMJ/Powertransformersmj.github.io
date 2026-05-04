// ══════════════════════════════════════════════════════════════
// CATÁLOGO · Materiales de montaje del sistema de refrigeración
// ──────────────────────────────────────────────────────────────
// Datos extraídos del archivo oficial AFINIA:
//   `Materiales_montaje_sistema_refrigeracion_AFINIA.xlsx`
//
// Las cantidades indicadas son POR VENTILADOR para los conjuntos
// "Montaje Mecánico" y "Montaje Eléctrico". Cuando una cantidad
// es `null` significa que la cantidad varía según el caso (ej.
// metros de cable según distancia · n. de terminales según puntos
// de conexión) y NO se totaliza automáticamente.
//
// Las "Herramientas e Insumos" y "Elementos de Protección Personal"
// son estándar — su cantidad NO se multiplica por número de
// ventiladores (un solo kit cubre toda la operación).
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {object} ItemMaterial
 * @property {string} producto
 * @property {string} spec
 * @property {string} unidad
 * @property {number|null} cantidad · null = variable / "según caso"
 */

/** Herramientas e insumos · estándar (no multiplica por N ventiladores). */
export const HERRAMIENTAS_INSUMOS = Object.freeze([
  { producto: 'Cinta aislante #33',           spec: 'Rollo estándar',     unidad: 'Unidad',  cantidad: 1 },
  { producto: 'Pinza voltiamperimétrica',     spec: 'Fluke',              unidad: 'unidad',  cantidad: 1 },
  { producto: 'Pelacables',                   spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Ponchadora de canutillo',      spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Juego de destornilladores',    spec: 'Aislados 1000 V',    unidad: 'unidad',  cantidad: 1 },
  { producto: 'Juego de copas rachet',        spec: 'Stanley',            unidad: 'unidad',  cantidad: 1 },
  { producto: 'Juego de llaves hexagonales',  spec: 'Stanley',            unidad: 'unidad',  cantidad: 1 },
  { producto: 'Cortafrío',                    spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Alicate',                      spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Pinza de punta',               spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Taladro',                      spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Sierra copa',                  spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Pulidora',                     spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Disco de corte',               spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Broca 3/8" metal',             spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Broca 1/2" metal',             spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Termohigrómetro',              spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Grata',                        spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Belzona',                      spec: 'Kit 1212',           unidad: 'unidad',  cantidad: 1 },
  { producto: 'Alcohol',                      spec: 'N/A',                unidad: 'litros',  cantidad: 2 },
  { producto: 'Desengrasante',                spec: 'N/A',                unidad: 'litros',  cantidad: 2 },
  { producto: 'Escalera de tijera',           spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Mesa de trabajo',              spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Marquilladora',                spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Sacabocados',                  spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Lijas',                        spec: 'Grano 80, 120, 220', unidad: 'unidad',  cantidad: 3 },
  { producto: 'Bisturí',                      spec: 'N/A',                unidad: 'unidad',  cantidad: 1 },
  { producto: 'Martillo / Porra',             spec: 'N/A',                unidad: 'unidad',  cantidad: 1 }
]);

/** Elementos de Protección Personal · estándar (no multiplica). */
export const EPP_ELEMENTOS = Object.freeze([
  'Punto ecológico',
  'Carpa de sol',
  'Punto de hidratación',
  'Casco de seguridad con barbuquejo',
  'Gafas de seguridad',
  'Guantes de seguridad',
  'Botas de seguridad',
  'Traje ignífugo',
  'Arnés',
  'Eslingas',
  'Camilla',
  'Botiquín',
  'Kit antiderrames'
]);

/** Material para montaje MECÁNICO por ventilador.
 *  Items con cantidad numérica se totalizan multiplicando por N.
 *  Items con `cantidad: null` se mantienen sin total (variable). */
export const MONTAJE_MECANICO_POR_VENTILADOR = Object.freeze([
  { producto: 'Espárrago',                            spec: '3/8"',                        unidad: 'metros',  cantidad: null },
  { producto: 'Platina acero inoxidable',             spec: '38 mm × 4 mm × 100 mm',       unidad: 'unidad',  cantidad: 8 },
  { producto: 'Empaque de neopreno',                  spec: '38 mm × 4 mm × 100 mm',       unidad: 'unidad',  cantidad: 8 },
  { producto: 'Arandela plana',                       spec: '3/8"',                        unidad: 'unidad',  cantidad: 20 },
  { producto: 'Arandela de presión',                  spec: '3/8"',                        unidad: 'unidad',  cantidad: 20 },
  { producto: 'Tuerca',                               spec: '3/8"',                        unidad: 'unidad',  cantidad: 20 },
  { producto: 'Coraza liquid tight',                  spec: '1/2"',                        unidad: 'metros',  cantidad: 3 },
  { producto: 'Riel DIN',                             spec: 'TH35',                        unidad: 'metros',  cantidad: 0.30 },
  { producto: 'Conector liquid tight recto',          spec: '1/2"',                        unidad: 'unidad',  cantidad: 1 },
  { producto: 'Conector liquid tight curvo',          spec: '1/2"',                        unidad: 'unidad',  cantidad: 1 },
  { producto: 'Abrazadera / soporte para coraza',     spec: '1/2"',                        unidad: 'unidad',  cantidad: 4 }
]);

/** Material para montaje ELÉCTRICO por ventilador. */
export const MONTAJE_ELECTRICO_POR_VENTILADOR = Object.freeze([
  { producto: 'Cable de cobre encauchetado',  spec: '4 × 16 AWG',  unidad: 'metros',  cantidad: null },
  { producto: 'Terminal de canutillo',        spec: '16 AWG',      unidad: 'unidad',  cantidad: 4 },
  { producto: 'Terminal de canutillo',        spec: '12 AWG',      unidad: 'unidad',  cantidad: null },
  { producto: 'Terminal de ojo',              spec: '16 AWG',      unidad: 'unidad',  cantidad: 4 },
  { producto: 'Terminal de canutillo',        spec: '10 AWG',      unidad: 'unidad',  cantidad: null },
  { producto: 'Terminal de canutillo',        spec: '8 AWG',       unidad: 'unidad',  cantidad: null },
  { producto: 'Cable 600 V',                  spec: '10 AWG',      unidad: 'metros',  cantidad: null },
  { producto: 'Cable 600 V',                  spec: '8 AWG',       unidad: 'metros',  cantidad: null },
  { producto: 'Amarras plásticas UV',         spec: 'Uso exterior',unidad: 'unidad',  cantidad: null },
  { producto: 'Bornera riel DIN',             spec: '4 mm²',       unidad: 'unidad',  cantidad: null }
]);

/**
 * Calcula el total consolidado de un catálogo "por ventilador"
 * multiplicando las cantidades numéricas por N. Items con
 * `cantidad: null` se devuelven con `total: null` para que se
 * muestren como "variable" en el informe.
 *
 * @param {Array<ItemMaterial>} catalogo
 * @param {number} nVentiladores
 * @returns {Array<{producto, spec, unidad, cantidad_unitaria, total}>}
 */
export function consolidarMateriales(catalogo, nVentiladores) {
  const n = Math.max(0, Math.floor(Number(nVentiladores) || 0));
  return catalogo.map(it => ({
    producto:           it.producto,
    spec:               it.spec,
    unidad:             it.unidad,
    cantidad_unitaria:  it.cantidad,
    total:              (it.cantidad === null || it.cantidad === undefined)
                          ? null
                          : +(it.cantidad * n).toFixed(2)
  }));
}
