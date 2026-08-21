// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Dominio puro: cargabilidad desde el parque
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE MÓDULO
// La pantalla de cargabilidad mostraba TRES transformadores
// inventados («SUB-DEMO-NORTE», matrícula «TD-01») como si fueran
// el parque. No era un fallo del render: el archivo que leía es un
// baseline de DEMOSTRACIÓN, puesto cuando se retiraron los datos
// reales por confidencialidad, y la colección de Firestore que
// debía sustituirlo nunca se pobló. El comentario de la propia
// página seguía diciendo «206 trafos» mientras servía 3 ficticios.
//
// El dato real SÍ existe: el Excel de Salud de Activos trae, por
// devanado, la ampacidad y la carga medida, más el porcentaje de
// cargabilidad oficial de Planificación. Este módulo deriva las
// filas del tablero desde los transformadores del parque, sin
// inventar nada (ADR-067).
//
// SOBRE LA COHERENCIA DE LA FUENTE
// En 64 de 208 equipos el cociente carga/ampacidad NO coincide con
// el porcentaje oficial, y en 5 la carga supera a la ampacidad. No
// se corrige ni se oculta: manda el porcentaje oficial (decisión
// del Ingeniero, 2026-07-27) y la discrepancia se marca para que
// se pueda revisar la fuente.
// ══════════════════════════════════════════════════════════════

/** Tolerancia en puntos porcentuales antes de marcar desacuerdo. */
export const TOLERANCIA_PCT = 5;

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = (v) => (v == null ? '' : String(v).trim());

/** Lee una ruta anidada sin reventar si falta un tramo. */
function leer(obj, ...rutas) {
  for (const ruta of rutas) {
    let v = obj;
    for (const paso of ruta.split('.')) {
      if (v == null) break;
      v = v[paso];
    }
    if (v != null && v !== '') return v;
  }
  return undefined;
}

/**
 * Porcentaje de un devanado. Manda el oficial; si no hay, se calcula
 * el cociente. Devuelve también si ambos se contradicen.
 *
 * @returns {{amp:number|null, car:number|null, pct:number|null,
 *            cociente:number|null, desacuerdo:boolean}}
 */
export function devanado(amp, car, pctOficial) {
  const a = num(amp);
  const c = num(car);
  const of = num(pctOficial);
  const cociente = (a != null && c != null && a > 0)
    ? Math.round((c / a) * 1000) / 10
    : null;
  const pct = of != null ? of : cociente;
  const desacuerdo = (of != null && cociente != null)
    && Math.abs(of - cociente) > TOLERANCIA_PCT;
  return { amp: a, car: c, pct, cociente, desacuerdo };
}

/**
 * Convierte un transformador del parque en una fila del tablero de
 * cargabilidad. Devuelve null si el equipo no aporta NINGÚN dato de
 * carga: es preferible una flota más corta que una fila hueca.
 *
 * @param {object} tx documento del parque (v2 o proyección plana)
 * @returns {object|null}
 */
export function filaCargabilidad(tx) {
  if (!tx) return null;
  const pctOficial = num(leer(tx, 'salud_actual.crg_pct_medido', 'crg_pct_medido',
    'cargabilidad', 'crg_pct'));

  const P = devanado(
    leer(tx, 'electrico.corriente_nominal_primaria_a', 'ampacidad_primaria'),
    leer(tx, 'electrico.corriente_medida_primaria_a', 'carga_primaria'),
    pctOficial
  );
  const S = devanado(
    leer(tx, 'electrico.corriente_nominal_secundaria_a', 'ampacidad_secundaria'),
    leer(tx, 'electrico.corriente_medida_secundaria_a', 'carga_secundaria'),
    pctOficial
  );
  const T = devanado(
    leer(tx, 'electrico.corriente_nominal_terciaria_a', 'ampacidad_terciaria'),
    leer(tx, 'electrico.corriente_medida_terciaria_a', 'carga_terciaria'),
    pctOficial
  );

  // Sin ampacidad, sin carga y sin porcentaje no hay nada que ilustrar.
  if (P.amp == null && P.car == null && S.amp == null && S.car == null && pctOficial == null) {
    return null;
  }

  const kva = num(leer(tx, 'placa.potencia_kva', 'potencia_kva'));
  return {
    id:     txt(leer(tx, 'identificacion.matricula', 'matricula', 'identificacion.codigo', 'codigo', 'id')),
    serie:  txt(leer(tx, 'identificacion.numero_serie', 'placa.serial', 'serie')),
    sub:    txt(leer(tx, 'ubicacion.subestacion_nombre', 'subestacion')),
    zona:   txt(leer(tx, 'ubicacion.zona', 'zona')),
    dep:    txt(leer(tx, 'ubicacion.departamento', 'departamento')),
    grupo:  txt(leer(tx, 'identificacion.grupo', 'grupo')),
    pot:    kva,
    refrig: txt(leer(tx, 'refrigeracion.tipo', 'refrigeracion')),
    cond:   txt(leer(tx, 'salud_actual.bucket', 'cond_lbl', 'condicion')) || 'N/D',
    reg:    txt(leer(tx, 'electrico.tipo_tap', 'regulacion')),
    vp:     txt(leer(tx, 'electrico.tension_primaria_kv', 'kv_prim')),
    vs:     txt(leer(tx, 'electrico.tension_secundaria_kv', 'kv_sec')),
    vt:     txt(leer(tx, 'electrico.tension_terciaria_kv', 'kv_terc')) || 'N/A',
    uucc:   txt(leer(tx, 'identificacion.uucc', 'uucc_registrada', 'uucc')),
    us:     num(leer(tx, 'criticidad.usuarios_aguas_abajo', 'servicio.usuarios_aguas_abajo', 'usuarios')),
    P: { amp: P.amp, car: P.car, l1: null, l2: null, pct: P.pct },
    S: { amp: S.amp, car: S.car, l1: null, l2: null, pct: S.pct },
    T: { amp: T.amp, car: T.car, l1: null, l2: null, pct: T.pct },
    // Trazabilidad de la fuente: no se corrige el dato, se señala.
    pct_oficial: pctOficial,
    cociente_primario: P.cociente,
    desacuerdo_fuente: P.desacuerdo || S.desacuerdo || T.desacuerdo,
    sobrecarga_medida: [P, S, T].some((d) => d.cociente != null && d.cociente > 100)
  };
}

/**
 * Deriva el tablero completo desde el parque.
 * @param {Array<object>} parque
 * @returns {{filas: object[], resumen: object}}
 */
export function cargabilidadDeParque(parque) {
  const lista = Array.isArray(parque) ? parque : [];
  const filas = lista.map(filaCargabilidad).filter(Boolean);
  const desacuerdos = filas.filter((f) => f.desacuerdo_fuente).length;
  const sobrecargas = filas.filter((f) => f.sobrecarga_medida).length;
  const conPct = filas.filter((f) => f.P.pct != null).length;
  return {
    filas,
    resumen: {
      total: lista.length,
      conDatos: filas.length,
      sinDatos: lista.length - filas.length,
      conPorcentaje: conPct,
      desacuerdosFuente: desacuerdos,
      sobrecargasMedidas: sobrecargas
    }
  };
}

export default { cargabilidadDeParque, filaCargabilidad, devanado, TOLERANCIA_PCT };
