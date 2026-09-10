// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Municipio de cada subestación
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// La ficha técnica imprime el MUNICIPIO en el bloque «Emplazamiento físico del
// proyecto», y el registro del parque no siempre lo trae: el campo salía vacío
// y había que teclearlo a mano en cada ficha. El municipio de una subestación
// no es un dato que cambie: es geografía. Encargo del Ingeniero (2026-09-10),
// con su tabla oficial.
//
// FUENTE: `Municipios.xlsx` del Ingeniero (hoja `Hoja1`), 2026-09-10.
// 153 subestaciones · 83 municipios · sin códigos repetidos ni municipios
// vacíos, comprobado al importarla.
//
// CÓMO ACTUALIZARLA: es una tabla literal a propósito —cero I/O, cero lecturas
// de Firestore, cero costo—. Si llega una subestación nueva, se añade su
// renglón `[código, nombre, municipio]` y se deja aquí. NO se convierte en
// colección: son 153 filas que no cambian y leerlas costaría cuota.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

/** `[código SE_, nombre de la subestación, municipio]`. Orden alfabético. */
export const SUBESTACIONES = Object.freeze([
  ['ABA', 'AGUAS BLANCAS', 'VALLEDUPAR'],
  ['AGB', 'ALGARROBO', 'ALGARROBO'],
  ['ANB', 'ANIMAS BAJAS', 'SIMITI'],
  ['ARG', 'ARGOS', 'CARTAGENA'],
  ['ARN', 'ARIGUANI', 'ARIGUANI'],
  ['ARJ', 'ARJONA', 'ASTREA'],
  ['AST', 'ASTREA', 'ASTREA'],
  ['AYA', 'AYAPEL', 'AYAPEL'],
  ['BDL', 'BARRANCO DE LOBA', 'BARRANCO DE LOBA'],
  ['BYC', 'BAYUNCA', 'CARTAGENA'],
  ['BEC', 'BECERRIL', 'BECERRIL'],
  ['BER', 'BERRUGAS', 'SAN ONOFRE'],
  ['BOU', 'BOCA DE URE', 'MONTELIBANO'],
  ['BCG', 'BOCAGRANDE', 'CARTAGENA'],
  ['BOA', 'BOSCONIA', 'BOSCONIA'],
  ['BQE', 'BOSQUE', 'CARTAGENA'],
  ['BST', 'BOSTON', 'SINCELEJO'],
  ['BUE', 'BUENA VISTA', 'BUENAVISTA'],
  ['CMR', 'CALAMAR', 'CALAMAR'],
  ['CNB', 'CANABRAVAL', 'SAN PABLO'],
  ['CDR', 'CANDELARIA', 'CARTAGENA'],
  ['CAZ', 'CASA DE ZINC', 'EL PASO'],
  ['CAC', 'CASACARA', 'AGUSTIN CODAZZI'],
  ['CTA', 'CENTRO ALEGRE', 'PLANETA RICA'],
  ['CER', 'CERETE', 'CERETE'],
  ['CMB', 'CHAMBACU', 'CARTAGENA'],
  ['CPA', 'CHINU PLANTA', 'CHINU'],
  ['CHG', 'CHIRIGUANA', 'CHIRIGUANA'],
  ['CIR', 'CIENAGA DE ORO', 'CIENAGA DE ORO'],
  ['COZ', 'CODAZZI', 'AGUSTIN CODAZZI'],
  ['CBY', 'COLOMBOY', 'SAHAGUN'],
  ['COR', 'COROZAL', 'COROZAL'],
  ['COS', 'COSPIQUE', 'CARTAGENA'],
  ['CRR', 'COTORRA', 'COTORRA'],
  ['COV', 'COVEÑAS', 'SAN ANTERO'],
  ['CVA', 'CUIVA', 'SAN BENITO ABAD'],
  ['CUR', 'CURUMANI', 'CURUMANI'],
  ['EBA', 'EL BANCO', 'EL BANCO'],
  ['BTE', 'EL BRILLANTE', 'PUERTO LIBERTADOR'],
  ['EBU', 'EL BURRO', 'PAILITAS'],
  ['ECA', 'EL CARMEN', 'EL CARMEN DE BOLIVAR'],
  ['COP', 'EL COPEY', 'EL COPEY'],
  ['ECJ', 'EL CORTIJO', 'SINCELEJO'],
  ['EDE', 'EL DESASTRE', 'SAN DIEGO'],
  ['EDF', 'EL DIFICIL', 'ARIGUANI'],
  ['PAR', 'EL PARAISO', 'ASTREA'],
  ['EPA', 'EL PASO', 'EL PASO'],
  ['EVJ', 'EL VIAJANO', 'SAHAGUN'],
  ['FRR', 'FERROCARRIL', 'LA GLORIA'],
  ['GAL', 'GALERAS', 'GALERAS'],
  ['GBT', 'GAMBOTE', 'ARJONA'],
  ['GUM', 'GUAMAL', 'GUAMAL'],
  ['GRA', 'GUARANDA', 'GUARANDA'],
  ['GUP', 'GUATAPURI', 'VALLEDUPAR'],
  ['HDL', 'HATILLO DE LOBA', 'HATILLO DE LOBA'],
  ['LPR', 'LA APARTADA', 'LA APARTADA'],
  ['LAR', 'LA AURORA', 'CHIRIGUANA'],
  ['LEA', 'LA EUROPA', 'AGUSTIN CODAZZI'],
  ['LJA', 'LA JAGUA', 'LA JAGUA DE IBIRICO'],
  ['LLO', 'LA LOMA', 'EL PASO'],
  ['LMT', 'LA MATA', 'LA GLORIA'],
  ['LMJ', 'LA MOJANA', 'MAJAGUAL'],
  ['LPZ', 'LA PAZ', 'LA PAZ'],
  ['UNN', 'LA UNION (SUCRE)', 'LA UNION'],
  ['LYE', 'LA YE', 'SAHAGUN'],
  ['LDE', 'LAS DELICIAS', 'AYAPEL'],
  ['LPA', 'LAS PALOMAS', 'MONTERIA'],
  ['LLE', 'LLERASCA', 'AGUSTIN CODAZZI'],
  ['LBS', 'LOMA DEL BALSAMO', 'ALGARROBO'],
  ['LOR', 'LORICA', 'LORICA'],
  ['LCB', 'LOS CORDOBAS', 'LOS CORDOBAS'],
  ['MGE', 'MAGANGUE', 'MAGANGUE'],
  ['MAJ', 'MAJAGUAL', 'MAJAGUAL'],
  ['MAM', 'MAMONAL', 'CARTAGENA'],
  ['MNC', 'MANAURE BALCON DEL CESAR', 'MANAURE'],
  ['MAN', 'MANDINGUILLA', 'CHIMICHAGUA'],
  ['MNZ', 'MANZANILLO', 'CARTAGENA'],
  ['MAY', 'MARACAYO', 'MONTERIA'],
  ['MBJ', 'MARIA LA BAJA', 'MARIA LA BAJA'],
  ['MAR', 'MARIANGOLA', 'VALLEDUPAR'],
  ['MAT', 'MATA DE CANA', 'EL BANCO'],
  ['MBR', 'MEMBRILLAL', 'CARTAGENA'],
  ['MOM', 'MOMIL', 'MOMIL'],
  ['MOX', 'MOMPOX', 'MOMPOS'],
  ['MTB', 'MONTELIBANO', 'MONTELIBANO'],
  ['MON', 'MONTERIA', 'MONTERIA'],
  ['MTE', 'MONTERREY', 'SIMITI'],
  ['MNT', 'MOÑITOS', 'MOñITOS'],
  ['NCO', 'NUEVA COSPIQUE', 'CARTAGENA'],
  ['NGR', 'NUEVA GRANADA', 'NUEVA GRANADA'],
  ['NLLO', 'NUEVA LA LOMA', 'EL PASO'],
  ['NMO', 'NUEVA MONTERIA', 'MONTERIA'],
  ['OVE', 'OVEJAS', 'OVEJAS'],
  ['PAI', 'PAILITAS', 'PAILITAS'],
  ['PGU', 'PANCEGUITAS', 'MAGANGUE'],
  ['PLY', 'PELAYA', 'PELAYA'],
  ['PRC', 'PLANETA RICA', 'PLANETA RICA'],
  ['PZL', 'POZO AZUL', 'SAN PABLO'],
  ['PRA', 'PRADERA', 'MONTERIA'],
  ['PBN', 'PUEBLO NUEVO', 'PUEBLO NUEVO'],
  ['PLO', 'PUEBLO NUEVO (MAGDALENA)', 'ARIGUANI'],
  ['PBD', 'PUERTO BADEL', 'ARJONA'],
  ['PTE', 'PUERTO ESCONDIDO', 'LOS CORDOBAS'],
  ['PUL', 'PUERTO LIBERTADOR', 'PUERTO LIBERTADOR'],
  ['RSI', 'RIO SINU', 'MONTERIA'],
  ['RVJ', 'RIO VIEJO', 'RIO VIEJO'],
  ['SHA', 'SAHAGUN', 'SAHAGUN'],
  ['SGE', 'SALGUERO', 'VALLEDUPAR'],
  ['SAM', 'SAMPUES', 'SAMPUES'],
  ['SAS', 'SAN ANDRES DE SOTAVENTO', 'SAN ANDRES SOTAVENTO'],
  ['SAT', 'SAN ANTERO', 'SAN ANTERO'],
  ['SBA', 'SAN BENITO DE ABAD', 'SAN BENITO ABAD'],
  ['SBE', 'SAN BERNARDO DEL VIENTO', 'SAN BERNARDO DEL VIENTO'],
  ['SCL', 'SAN CARLOS', 'SAN CARLOS'],
  ['SEO', 'SAN ESTANISLAO', 'SAN ESTANISLAO'],
  ['SFE', 'SAN FELIPE', 'EL BANCO'],
  ['SJA', 'SAN JACINTO', 'SAN JACINTO'],
  ['SJN', 'SAN JUAN NEPOMUCENO', 'SAN JUAN NEPOMUCENO'],
  ['SLS', 'SAN LUIS', 'SIMITI'],
  ['SMC', 'SAN MARCOS', 'SAN MARCOS'],
  ['SML', 'SAN MARTIN DE LOBA', 'SAN MARTIN DE LOBA'],
  ['SOF', 'SAN ONOFRE', 'SAN ONOFRE'],
  ['SPD', 'SAN PEDRO', 'SAN PEDRO'],
  ['SPY', 'SAN PELAYO', 'SAN PELAYO'],
  ['SRO', 'SAN ROQUE', 'CURUMANI'],
  ['STE', 'SANTA ELENA', 'CHIMICHAGUA'],
  ['SAI', 'SANTA INES', 'SAN MARCOS'],
  ['SLC', 'SANTA LUCIA (CORDOBA)', 'MONTERIA'],
  ['SRS', 'SANTA ROSA', 'CHINU'],
  ['SAR', 'SANTA ROSA DEL SUR', 'SANTA ROSA DEL SUR'],
  ['STR', 'SANTA TERESA', 'REGIDOR'],
  ['ESA', 'SENA', 'MONTERIA'],
  ['SIE', 'SIERRA FLOR', 'SINCELEJO'],
  ['SMN', 'SIMA?A', 'LA GLORIA'],
  ['SIM', 'SIMITI', 'SIMITI'],
  ['SCE', 'SINCE', 'SAN LUIS DE SINCE'],
  ['SPA', 'SINCELEJO PLANTA', 'SINCELEJO'],
  ['SUC', 'SUCRE', 'SUCRE'],
  ['TLG', 'TALAIGUA NUEVO', 'TALAIGUA NUEVO'],
  ['TAN', 'TAMALAMEQUE', 'TAMALAMEQUE'],
  ['CTG', 'TERMOCARTAGENA', 'CARTAGENA'],
  ['TER', 'TERNERA', 'CARTAGENA'],
  ['TIE', 'TIERRALTA', 'TIERRALTA'],
  ['TOL', 'TOLU', 'SANTIAGO DE TOLU'],
  ['TVJ', 'TOLU VIEJO', 'TOLU VIEJO'],
  ['TRE', 'TRES ESQUINAS', 'ARIGUANI'],
  ['TPS', 'TRES PALMAS', 'MONTERIA'],
  ['URR', 'URRA', 'TIERRALTA'],
  ['VAA', 'VALENCIA', 'VALLEDUPAR'],
  ['VAC', 'VALENCIA (CORDOBA)', 'VALENCIA'],
  ['VIE', 'VILLA ESTRELLA', 'CARTAGENA'],
  ['ZMB', 'ZAMBRANO', 'ZAMBRANO'],
  ['ZRG', 'ZARAGOCILLA', 'CARTAGENA'],
].map(Object.freeze));

/** Normaliza para comparar: sin tildes, sin puntuación, espacios colapsados. */
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Código de subestación que se pueda leer de una matrícula.
 *
 * Las matrículas del parque traen el código al final («T4-A/A-BQE» → `BQE`),
 * pero NO siempre coincide con el del catálogo: Candelaria es `CDR` en la
 * tabla y aparece como `KDR` en alguna matrícula. Por eso el código es
 * RESPALDO del nombre, nunca al revés.
 */
function codigoDeMatricula(matricula) {
  const m = norm(matricula).match(/([A-Z]{2,4})\s*\d*$/);
  return m ? m[1] : '';
}

/**
 * Municipio de la subestación de un equipo. `null` si no se puede resolver
 * SIN ADIVINAR.
 *
 * Orden: (1) nombre exacto normalizado; (2) código de la matrícula. Si una
 * búsqueda deja más de un candidato NO se elige ninguno: «COSPIQUE» y «NUEVA
 * COSPIQUE» son subestaciones distintas en municipios que podrían diferir, y
 * este dato se imprime en un documento que se firma. Ante la duda, el campo se
 * queda vacío y lo llena el Ingeniero, que es lo que pasa hoy.
 *
 * @param {{subestacion?:string, matricula?:string}} equipo
 * @returns {string|null} municipio, o `null` si no hay una única respuesta
 */
export function municipioDeSubestacion(equipo) {
  const e = equipo || {};
  const nombre = norm(e.subestacion);
  if (nombre) {
    const porNombre = SUBESTACIONES.filter((f) => norm(f[1]) === nombre);
    if (porNombre.length === 1) return porNombre[0][2];
    if (porNombre.length > 1) return null;
  }
  const cod = codigoDeMatricula(e.matricula);
  if (cod) {
    const porCodigo = SUBESTACIONES.filter((f) => f[0] === cod);
    if (porCodigo.length === 1) return porCodigo[0][2];
  }
  return null;
}
