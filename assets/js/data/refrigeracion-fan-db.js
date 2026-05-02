// ═══════════════════════════════════════════════════════════════
// REFRIGERACIÓN · DATOS · base de motoventiladores (FAN_DB)
// ───────────────────────────────────────────────────────────────
// Catálogo congelado de motoventiladores certificados ZIEHL-ABEGG +
// KRENZ usado por el módulo Mantenimiento Brigada · Selección ONAF.
// Caudal SIEMPRE en CFM (ft³/min). Preserva nombres de campo del
// archivo legacy (fan_marca, fan_modelo, fan_diam, etc.) para que
// la UI los pueda volcar 1:1 a los inputs del formulario sin mapeo.
//
// Fuente: fichas ZIEHL-ABEGG ZAplus + serie estándar (50 / 60 Hz,
// 230/400 V D/Y) y catálogo KRENZ F20.
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} VentiladorFicha
 * @property {string} fan_marca
 * @property {string} fan_modelo
 * @property {string} fan_nserie
 * @property {string} fan_tipo_pala
 * @property {number} fan_diam        · Ø nominal (mm)
 * @property {number} fan_aspas
 * @property {number} fan_rpm
 * @property {string} fan_montaje
 * @property {number} fan_peso        · kg
 * @property {number} fan_flow_val    · valor de caudal en la unidad de entrada
 * @property {number} fan_cfm_nom     · CFM nominal (ft³/min)
 * @property {number} fan_m3s         · m³/s equivalente
 * @property {string} fan_volt
 * @property {string} fan_hz          · '50' | '60'
 * @property {number} fan_kw          · potencia absorbida P1 (W)
 * @property {string} fan_amp         · ej. "1.60 / 0.92 A (D/Y)"
 * @property {number} fan_cosphi
 * @property {string} fan_aislam
 * @property {string} fan_protmotor
 * @property {string} fan_material
 * @property {string} fan_sentido
 * @property {number} fan_tmin        · °C
 * @property {string} fan_cert
 * @property {string} fan_ip
 * @property {string} fan_flow_unit   · clave de FACTORES_CAUDAL
 */

/** @type {Readonly<Record<string, VentiladorFicha>>} */

export const FAN_DB = Object.freeze({
  // ── ZN045-4DL.2F.V7P2  N°180015  Ø450mm ──────────────────────────────────
  // CFM libre Pstat=0: 60Hz≈6900m³/h(de curva ISO5801)→4060CFM | 50Hz ratio rpm→3850CFM
  zn045_50: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN045-4DL.2F.V7P2', fan_nserie:'180015',
    fan_tipo_pala:'ZAplus axial fan with sickle blades · Material compuesto HP',
    fan_diam:450, fan_aspas:4, fan_rpm:1260, fan_montaje:'H/Vu/Vo',
    fan_flow_val:3850, fan_flow_unit:'cfm', fan_cfm_nom:3850, fan_m3s:1.818,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'50',
    fan_kw:350, fan_amp:'1.10 / 0.64 A (D/Y)', fan_cosphi:0.79,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F) · Protección corrosión tipo 1',
    fan_protmotor:'Contacto térmico (thermal contact)',
    fan_material:'Aluminio RAL 9005 negro · Palas compuesto HP sin pintura',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:10.30,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  zn045_60: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN045-4DL.2F.V7P2', fan_nserie:'180015',
    fan_tipo_pala:'ZAplus axial fan with sickle blades · Material compuesto HP',
    fan_diam:450, fan_aspas:4, fan_rpm:1330, fan_montaje:'H/Vu/Vo',
    fan_flow_val:4060, fan_flow_unit:'cfm', fan_cfm_nom:4060, fan_m3s:1.917,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'60',
    fan_kw:480, fan_amp:'1.35 / 0.78 A (D/Y)', fan_cosphi:0.90,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F) · Protección corrosión tipo 1',
    fan_protmotor:'Contacto térmico (thermal contact)',
    fan_material:'Aluminio RAL 9005 negro · Palas compuesto HP sin pintura',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:10.30,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  zn045_60h: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN045-4DL.2F.V7P2', fan_nserie:'180015',
    fan_tipo_pala:'ZAplus axial fan with sickle blades · Material compuesto HP',
    fan_diam:450, fan_aspas:4, fan_rpm:1430, fan_montaje:'H/Vu/Vo',
    fan_flow_val:4365, fan_flow_unit:'cfm', fan_cfm_nom:4365, fan_m3s:2.060,
    fan_volt:'3~265/460V ±10% D/Y', fan_hz:'60',
    fan_kw:540, fan_amp:'1.35 / 0.78 A (D/Y)', fan_cosphi:0.87,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F) · Protección corrosión tipo 1',
    fan_protmotor:'Contacto térmico (thermal contact)',
    fan_material:'Aluminio RAL 9005 negro · Palas compuesto HP sin pintura',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:10.30,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  // ── FN050-4DH.4I.A7P1  N°163869/02  Ø500mm ───────────────────────────────
  // CFM libre Pstat=0: extraído directamente de ficha técnica (m³/s × 2118.88)
  fn050_50: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN050-4DH.4I.A7P1', fan_nserie:'163869/02',
    fan_tipo_pala:'Axial fan with sickle blades',
    fan_diam:500, fan_aspas:4, fan_rpm:1290, fan_montaje:'H/Vu/Vo',
    fan_flow_val:4873, fan_flow_unit:'cfm', fan_cfm_nom:4873, fan_m3s:2.30,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'50',
    fan_kw:690, fan_amp:'2.80 / 1.60 A (D/Y)', fan_cosphi:0.62,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9006 blanco aluminio (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:20.20,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  fn050_60: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN050-4DH.4I.A7P1', fan_nserie:'163869/02',
    fan_tipo_pala:'Axial fan with sickle blades',
    fan_diam:500, fan_aspas:4, fan_rpm:1400, fan_montaje:'H/Vu/Vo',
    fan_flow_val:5403, fan_flow_unit:'cfm', fan_cfm_nom:5403, fan_m3s:2.55,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'60',
    fan_kw:950, fan_amp:'3.00 / 1.75 A (D/Y)', fan_cosphi:0.79,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9006 blanco aluminio (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:20.20,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  fn050_60h: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN050-4DH.4I.A7P1', fan_nserie:'163869/02',
    fan_tipo_pala:'Axial fan with sickle blades',
    fan_diam:500, fan_aspas:4, fan_rpm:1480, fan_montaje:'H/Vu/Vo',
    fan_flow_val:5721, fan_flow_unit:'cfm', fan_cfm_nom:5721, fan_m3s:2.70,
    fan_volt:'3~265/460V ±10% D/Y', fan_hz:'60',
    fan_kw:1050, fan_amp:'3.20 / 1.85 A (D/Y)', fan_cosphi:0.73,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9006 blanco aluminio (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:20.20,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  // ── FN063-6DL.4I.A7P1  N°174897/03  Ø630mm ───────────────────────────────
  // CFM libre Pstat=0: extraído directamente de ficha técnica (m³/s × 2118.88)
  fn063_50: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN063-6DL.4I.A7P1', fan_nserie:'174897/03',
    fan_tipo_pala:'Axial fan with sickle blades (paletas en hoz)',
    fan_diam:630, fan_aspas:6, fan_rpm:830, fan_montaje:'H/Vu/Vo',
    fan_flow_val:5933, fan_flow_unit:'cfm', fan_cfm_nom:5933, fan_m3s:2.80,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'50',
    fan_kw:540, fan_amp:'1.60 / 0.92 A (D/Y)', fan_cosphi:0.85,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F)',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 7035 gris claro (3 capas)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:26.90,
    fan_cert:'UL/CSA E111399 ZA-155 · EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  fn063_60: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN063-6DL.4I.A7P1', fan_nserie:'174897/03',
    fan_tipo_pala:'Axial fan with sickle blades (paletas en hoz)',
    fan_diam:630, fan_aspas:6, fan_rpm:820, fan_montaje:'H/Vu/Vo',
    fan_flow_val:6357, fan_flow_unit:'cfm', fan_cfm_nom:6357, fan_m3s:3.00,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'60',
    fan_kw:740, fan_amp:'2.20 / 1.25 A (D/Y)', fan_cosphi:0.88,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F)',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 7035 gris claro (3 capas)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:26.90,
    fan_cert:'UL/CSA E111399 ZA-155 · EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  fn063_60h: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'FN063-6DL.4I.A7P1', fan_nserie:'174897/03',
    fan_tipo_pala:'Axial fan with sickle blades (paletas en hoz)',
    fan_diam:630, fan_aspas:6, fan_rpm:900, fan_montaje:'H/Vu/Vo',
    fan_flow_val:6569, fan_flow_unit:'cfm', fan_cfm_nom:6569, fan_m3s:3.10,
    fan_volt:'3~265/460V ±10% D/Y', fan_hz:'60',
    fan_kw:840, fan_amp:'2.10 / 1.20 A (D/Y)', fan_cosphi:0.88,
    fan_ip:'IP54', fan_aislam:'THCL155 (equiv. Clase F)',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 7035 gris claro (3 capas)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:26.90,
    fan_cert:'UL/CSA E111399 ZA-155 · EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  // ── ZN063-6DL.4I.V7P1  N°172238  Ø630mm ──────────────────────────────────
  // CFM libre Pstat=0: de curva ISO5801 (3~230V 60Hz D) ≈11700m³/h → 6886CFM
  zn063_50: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN063-6DL.4I.V7P1', fan_nserie:'172238',
    fan_tipo_pala:'ZAplus axial fan with sickle blades',
    fan_diam:630, fan_aspas:6, fan_rpm:890, fan_montaje:'H/Vu/Vo',
    fan_flow_val:6520, fan_flow_unit:'cfm', fan_cfm_nom:6520, fan_m3s:3.078,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'50',
    fan_kw:600, fan_amp:'2.20 / 1.30 A (D/Y)', fan_cosphi:0.67,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9005 negro (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:22.00,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  zn063_60: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN063-6DL.4I.V7P1', fan_nserie:'172238',
    fan_tipo_pala:'ZAplus axial fan with sickle blades',
    fan_diam:630, fan_aspas:6, fan_rpm:940, fan_montaje:'H/Vu/Vo',
    fan_flow_val:6886, fan_flow_unit:'cfm', fan_cfm_nom:6886, fan_m3s:3.250,
    fan_volt:'3~230/400V ±10% D/Y', fan_hz:'60',
    fan_kw:860, fan_amp:'2.80 / 1.60 A (D/Y)', fan_cosphi:0.77,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9005 negro (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:22.00,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  zn063_60h: {
    fan_marca:'ZIEHL-ABEGG', fan_modelo:'ZN063-6DL.4I.V7P1', fan_nserie:'172238',
    fan_tipo_pala:'ZAplus axial fan with sickle blades',
    fan_diam:630, fan_aspas:6, fan_rpm:1010, fan_montaje:'H/Vu/Vo',
    fan_flow_val:7403, fan_flow_unit:'cfm', fan_cfm_nom:7403, fan_m3s:3.494,
    fan_volt:'3~265/460V ±10% D/Y', fan_hz:'60',
    fan_kw:940, fan_amp:'2.80 / 1.60 A (D/Y)', fan_cosphi:0.75,
    fan_ip:'IP54', fan_aislam:'THCL155 · Impreg. especial HV · Protección corrosión tipo 3',
    fan_protmotor:'Contacto térmico',
    fan_material:'Aluminio RAL 9005 negro (3 capas clase 4)',
    fan_sentido:'Horario (CW) visto desde motor', fan_tmin:-40, fan_peso:22.00,
    fan_cert:'EU EMC 2014/30 · LVD 2014/35 · ErP 2009/125',
  },
  // ── KRENZ F20-A10069  Ø559mm ──────────────────────────────────────────────
  // CFM=6200 medidos directamente en ft³/min (horizontal airflow sobre radiador 15")
  krenz_f20: {
    fan_marca:'KRENZ & CO., INC.', fan_modelo:'F20-A10069', fan_nserie:'F20-A10069',
    fan_tipo_pala:'5 aspas acero fabricado, alas galvanizadas, cubo pintado',
    fan_diam:559, fan_aspas:5, fan_rpm:1140, fan_montaje:'Horizontal — descarga libre',
    fan_flow_val:6200, fan_flow_unit:'cfm', fan_cfm_nom:6200, fan_m3s:2.927,
    fan_volt:'3~208-230V', fan_hz:'60',
    fan_kw:348, fan_amp:'1.13 A (208V) / 1.40 A FLA', fan_cosphi:0.77,
    fan_ip:'IP54', fan_aislam:'Clase F (Clase B temperatura rise)',
    fan_protmotor:'Relé sobrecarga reset automático + 4 tapones drenaje 1/8" NPT',
    fan_material:'Acero galvanizado hot-dip — carcasa ANSI 70 gris',
    fan_sentido:'Antihorario (CCW) visto desde inlet side',
    fan_tmin:-20, fan_peso:0,
    fan_cert:'OSHA compliant · NEMA 48 frame · Eje SS-416 Ø15.9mm · AMCA 300-08',
  },
});



/** Devuelve la ficha del ventilador por clave o `null`. */
export function buscarFan(key) {
  if (!key) return null;
  return FAN_DB[key] || null;
}

/** Lista todas las claves disponibles, en el orden de definición. */
export function listarFans() {
  return Object.keys(FAN_DB);
}
