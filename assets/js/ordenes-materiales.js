// ══════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales SSEE
// Formato IT.05801.MA-MNP-FO.01 Ed:01 — entrada y/o salida de materiales
// --------------------------------------------------------------------------
// Port del módulo suelto `~/Desktop/GitHub-MJ/Modulo_Ordenes_SSEE`. El código
// de dibujo es el original y NO se ha tocado: la geometría del documento está
// medida sobre el PDF real a 300 ppp y vista previa y PDF salen de la misma
// lista de primitivas, así que no pueden divergir. Tocarlo a ojo lo rompe.
//
// Qué cambia respecto del módulo suelto, y por qué:
//   · Sin firmas escaneadas y sin cédulas — repo PÚBLICO (ver abajo y `99 §70`).
//   · Se carga como módulo ES: el marcado no usa manejadores en línea, así que
//     nada depende de que estas funciones sean globales.
//   · Sus estilos viven bajo `.oms-scope` porque sus nombres son genéricos
//     (.btn, .campo, .modal) y chocarían con los del sitio.
// Los IDs se conservan: se comprobó que ninguno de los 136 choca con el armazón.
// ══════════════════════════════════════════════════════════════════════════

/* ==========================================================================
   MÓDULO ÓRDENES DE ENTRADA Y SALIDA DE MATERIALES SSEE
   --------------------------------------------------------------------------
   Formato base : IT.05801.MA-MNP-FO.01  Ed: 01
   Librerías    : jsPDF 2.5.1 · ExcelJS 4.4.0 · SheetJS 0.18.5 · FileSaver 2.0.5
   --------------------------------------------------------------------------
   ▓▓▓ BLOQUE 1 — CONFIGURACIÓN ▓▓▓
   Todo lo que normalmente se necesita cambiar (listas, datos fijos, textos,
   colores del documento, logotipo) está en el objeto CONFIG de abajo.
   No hace falta tocar ninguna otra parte del código.
   ========================================================================== */
'use strict';

const CONFIG = {

  /* --- Textos fijos del formato -------------------------------------- */
  documento: {
    titulo:  'ENTRADA Y/O SALIDA DE MATERIALES SSEE',
    codigo:  'IT.05801.MA-MNP-FO.01',
    edicion: 'Ed: 01'
  },

  /* --- Logotipo (PNG en base64). Para cambiarlo, reemplace la cadena por
         otra imagen codificada en base64 y ajuste `logoRelAspecto`
         (ancho/alto) para que no se deforme. ------------------------------ */
  logo: 'data:image/png;base64,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',
  logoRelAspecto: 480 / 279,      // proporción del PNG incluido

    // ── SIN FIRMAS DIGITALIZADAS EN LA WEB ────────────────────────────────────
  // El módulo suelto traía 3 firmas manuscritas escaneadas incrustadas aquí.
  // Este repositorio es PÚBLICO y se sirve como archivos estáticos: cualquiera
  // podría descargarlas y falsificar documentos a nombre de esas personas, y el
  // guard de sesión NO lo impide (esconde la página, no el contenido del
  // archivo). Se retiran a propósito: `firmaDe()` devuelve null y el documento
  // sale con la línea de firma en blanco, que es lo que hace el formato en
  // papel. Si algún día se quieren automáticas, van a Firebase Storage bajo
  // `firmas/{uid}` con reglas que exijan sesión, y cada quien descarga SOLO la
  // suya. Nunca un archivo estático compartido. Ver `99 §70`.,
  firmas: {},

  autorizadoPor: { nombre: 'MIGUEL JIMENEZ', cedula: '' },

  entregadoPor: [
    { nombre: 'CARLOS MARTELO', cedula: '' },
    { nombre: 'JUAN CARDONA',   cedula: '' }
  ],

  recibidoPor: [
    { nombre: 'GERARDO RAMIREZ', cedula: '' },
    { nombre: 'RAMON ROMERO',    cedula: '' },
    { nombre: 'BREHINER REYES',  cedula: ''   },
    { nombre: 'JHON BAUTISTA',   cedula: ''   },
    { nombre: 'JOHAN CASTRO',    cedula: ''   }
  ],

  /* --- Motivos de entrada y/o salida (lista cerrada) ------------------ */
  motivos: [
    'Actualización y repotenciación del sistema de refrigeración.',
    'Medida de mitigación por capacidad de transformación.',
    'Reposición de unidad de refrigeración fallada.',
    'Actualización de protección mecánica.',
    'Mantenimiento de rutina PSM.',
    'Actualización de accesorios.',
    'Reemplazo de unidad o unidades de disipación de pérdidas naturales del transformador.',
    'Plan de mitigación por estado de salud y/o emergencia.'
  ],

  /* Opción abierta del desplegable de motivo. Al elegirla se habilita un campo
     de texto obligatorio y es ESE texto —no la etiqueta— el que se imprime en
     el documento. Cambie la etiqueta aquí si prefiere otra redacción. */
  motivoOtro: 'Otro (especificar)',

  /* --- Zonas sugeridas (el campo admite texto libre) ------------------ */
  zonas: ['BOLIVAR', 'ORIENTE', 'OCCIDENTE'],

  /* --- Empresas de vigilancia sugeridas ------------------------------- */
  empresasVigilancia: ['AGUILA DE ORO'],

  /* --- LISTAS PRECARGADAS ---------------------------------------------
     Provienen del archivo OrigenDestino.xlsx suministrado:
       · origenDestino → hoja «Origen_Destino», columna ORIGEN/DESTINO
       · materiales    → hoja «Accesorios»      (Ítem + Unidad)
                       + hoja «Transformadores» (UC + descripción CREG 015-2018)

     Cada material admite: descripcion, unidad, grupo, codigo, y para los
     transformadores además nivel, tipo y cambiador (se conservan tal como
     vienen de la CREG, aunque no se impriman todos).
     El campo `grupo` separa el desplegable en secciones; si se omite, el
     material aparece suelto al principio de la lista.
     Se pueden editar aquí o reemplazar importando un archivo (sección 5).
     -------------------------------------------------------------------- */
  origenDestino: [
    "AGUAS BLANCAS", "ALGARROBO", "ANIMAS BAJAS", "ARIGUANI",
    "ARJONA", "ASTREA", "AYAPEL", "BARRANCO DE LOBA",
    "BAYUNCA", "BECERRIL", "BERRUGAS", "BOCAGRANDE",
    "BOCAS DE URE", "BOSCONIA", "BOSQUE", "BOSTON",
    "BUENAVISTA", "CALAMAR", "CANDELARIA", "CASA DE ZINC",
    "CASACARA", "CAÑABRAVAL", "CENTRO ALEGRE", "CERETE",
    "CHAMBACU", "CHINU PLANTA", "CHIRIGUANA", "CIENAGA DE ORO",
    "CODAZZI", "COLOMBOY", "COROZAL", "COSPIQUE",
    "COTORRA", "COVEÑAS", "CUIVA", "CURUMANÍ",
    "EL BANCO", "EL BRILLANTE", "EL BURRO", "EL CARMEN",
    "EL CORTIJO", "EL DESASTRE", "EL DIFICIL", "EL PARAISO",
    "EL PASO", "EL VIAJANO", "FERROCARRIL", "GALERAS",
    "GAMBOTE", "GUAMAL", "GUARANDA", "GUATAPURI",
    "HATILLO DE LOBA", "LA APARTADA", "LA AURORA", "LA EUROPA",
    "LA JAGUA", "LA MOJANA", "LA PAZ", "LA POLVORITA",
    "LA SALVACION", "LA UNION", "LA YE", "LAS DELICIAS",
    "LAS PALOMAS", "LLERASCA", "LOMA DEL BALSAMO", "LORICA",
    "LOS CORDOBAS", "MAGANGUE", "MAJAGUAL", "MAMONAL",
    "MANAURE BALCON DEL CESAR", "MANDINGUILLA", "MANZANILLO", "MARACAYO",
    "MARIA LA BAJA", "MARIANGOLA", "MATA DE CAÑA", "MEMBRILLAL",
    "MOMIL", "MOMPOX", "MONTELIBANO", "MONTERIA",
    "MONTERREY", "MOÑITOS", "NUEVA COSPIQUE", "NUEVA GRANADA",
    "NUEVA LA LOMA", "NUEVA MONTERIA", "OVEJAS", "PAILITAS",
    "PANCEGUITAS", "PLANETA RICA", "POZO AZUL", "PRADERA",
    "PUEBLO NUEVO", "PUERTO BADEL", "PUERTO ESCONDIDO", "PUERTO LIBERTADOR",
    "RIO SINU", "RIO VIEJO", "SAHAGUN", "SALGUERO",
    "SAMPUES", "SAN ANDRES DE SOTAVENTO", "SAN ANTERO", "SAN BENITO DE ABAD",
    "SAN BERNARDO DEL VIENTO", "SAN CARLOS", "SAN ESTANISLAO", "SAN FELIPE",
    "SAN JACINTO", "SAN JUAN NEPOMUCENO", "SAN LUIS", "SAN MARCOS",
    "SAN MARTIN DE LOBA", "SAN ONOFRE", "SAN PEDRO", "SAN PELAYO",
    "SAN ROQUE", "SANTA ELENA", "SANTA INES", "SANTA LUCIA",
    "SANTA ROSA", "SANTA ROSA DEL SUR", "SANTA TERESA", "SEDE OPERATIVA BOSQUE",
    "SENA", "SIERRA FLOR", "SIMAÑA", "SIMITI",
    "SINCE", "SINCELEJO PLANTA", "SUCRE", "TALAIGUA NUEVO",
    "TAMALAMEQUE", "TERNERA", "TIERRALTA", "TOLU",
    "TOLU VIEJO", "TRES ESQUINAS", "TRES PALMAS", "VALENCIA",
    "VILLA ESTRELLA", "ZAMBRANO", "ZARAGOCILLA"
  ],

  materiales: [
    { descripcion: "Suministro de coraza", unidad: "Mts", grupo: "Accesorios" },
    { descripcion: "Suministro de radiadores", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Motoventiladores Tipo 1 FN-063", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Motoventiladores Tipo 2 FN-050", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Motoventiladores Tipo 3", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Motoventiladores Tipo 4", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Bombas de aceite", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Membrana tanque de expansión", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Cable protecciones mecánicas", unidad: "Mts", grupo: "Accesorios" },
    { descripcion: "Transformador de corriente 5A- Imagen térmica", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Silica Gel por Kg", unidad: "Kg", grupo: "Accesorios" },
    { descripcion: "Recipiente Silica Gel", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Desecador silica autoregenerable", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Relé de ruptura de membrana", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Relé de flujo", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Indicador de temperatura de aceite", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Indicador de temperatura devanados", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Indicador de nivel", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Gabinete de control", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Relé Buchholz", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Válvula de sobrepresión", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Junction block", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Buje 13,8 KV", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Buje 34,5 KV", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Buje 66/110 KV", unidad: "UND", grupo: "Accesorios" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de hasta 10 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T1", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 11 a 20 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T2", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 21 a 40 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T3", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 41 a 50 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T4", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 51 a 60 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T5", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 61 a 90 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T6", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 91 a 100 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T7", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 101 a 120 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T8", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 121 a 150 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T9", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) de conexión al STN capacidad final de 151 a 180 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T10", nivel: "Nivel 5 (conexión al STN)", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de hasta 20 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T19", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 21 a 40 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T20", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 41 a 50 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T21", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 51 a 60 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T22", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 61 a 90 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T23", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de 91 a 120 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T24", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) de conexión al STN capacidad final de más de 121 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N5T25", nivel: "Nivel 5 (conexión al STN)", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final hasta 5 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T1", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 5 a 10 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T2", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 11 a 15 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T3", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 16 a 20 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T4", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 21 a 30 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T5", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 31 a 40 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T6", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 41 a 50 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T7", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 51 a 60 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T8", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 61 a 80 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T9", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 81 a 100 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T10", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 4 capacidad final mayor a 100 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T11", nivel: "Nivel 4", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final hasta 5 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T12", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 6 a 10 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T13", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 11 a 20 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T14", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 21 a 30 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T15", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 31 a 40 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T16", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 41 a 50 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T17", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final de 51 a 60 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T18", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador tridevanado trifásico (OLTC) lado de alta en el nivel 4 capacidad final más de 60 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N4T19", nivel: "Nivel 4", tipo: "Tridevanado", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (NLTC) lado de alta en el nivel 3 capacidad final de 0.5 a 2.5 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T1", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "NLTC" },
    { descripcion: "Transformador trifásico (NLTC) lado de alta en el nivel 3 capacidad final de 2.6 a 6 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T2", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "NLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 6.1 a 10 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T3", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 11 a 15 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T4", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 16 a 20 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T5", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final de 21 a 30 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T6", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "OLTC" },
    { descripcion: "Transformador trifásico (OLTC) lado de alta en el nivel 3 capacidad final mayor a 31 MVA", unidad: "UND", grupo: "Transformadores · UC CREG 015-2018", codigo: "N3T7", nivel: "Nivel 3", tipo: "Dos devanados", cambiador: "OLTC" }
  ],

  /* --- Comportamiento -------------------------------------------------- */
  filasTablaPagina: 18,        // filas de la tabla de materiales por página
  maxOrdenesGuardadas: 500,    // tope del histórico acumulado (≈ 600 KB)
  prefijoArchivo: 'Orden'      // Orden_Entrada_00125_2026-08-26.pdf
};

/* ==========================================================================
   ▓▓▓ BLOQUE 2 — GEOMETRÍA DEL DOCUMENTO ▓▓▓
   Coordenadas en PUNTOS (pt) medidas directamente sobre el PDF modelo
   (A4 = 595,32 × 841,92 pt). Esta misma tabla alimenta la vista previa HTML
   y la exportación a PDF, por lo que ambas coinciden exactamente.
   Origen de coordenadas: esquina superior izquierda de la hoja.
   ========================================================================== */

const GEO = {
  pagina:   { w: 595.32, h: 841.92 },

  /* Marco exterior */
  caja:     { l: 37.2, r: 557.2, t: 58.4, b: 782.2 },

  /* Grosores de línea */
  lwGruesa: 1.45,     // marco y separadores principales
  lwFina:   0.75,     // subrayados de campo y filas de la tabla

  /* Banda del logotipo */
  bandaLogo:  { b: 108.7 },
  logo:       { x: 486.6, y: 65.6, w: 60.3, h: 35.0 },

  /* Título (enmarcado por doble filete arriba y abajo) */
  titulo:   { t1: 113.4, t2: 115.1, b1: 131.9, b2: 133.7, base: 130.1, size: 17.3 },

  /* Fila «ORDEN DE: … No. …» */
  orden: {
    base: 149.9, size: 10.6,
    lblOrden: 39.12, lblEntrada: 111.74, lblSalida: 280.25, lblNo: 452.86,
    chkEntrada: { x: 154.77, y: 136.96, w: 20.4, h: 16.8 },
    chkSalida:  { x: 312.18, y: 136.96, w: 20.4, h: 16.8 },
    cajaNo:     { x: 469.59, y: 136.92, w: 68.14, h: 17.28 },
    noBase: 150.8, noSize: 11.5
  },

  /* Fila «ZONA / FECHA / HORA» */
  zona: {
    base: 172.0, size: 10.6, ul: 175.28,
    lblZona: 39.12,  valZona: 78.50,  ulZona: [76.5, 273.3],
    lblFecha: 298.97, valFecha: 360.07, ulFecha: [332.3, 430.7],
    lblHora: 439.18, valHora: 484.30, ulHora: [470.1, 537.3]
  },

  /* Fila «ORIGEN / DESTINO» */
  origen: {
    base: 189.4, size: 10.6, ul: 192.8,
    lblOrigen: 39.12,  valOrigen: 98.18,  ulOrigen: [96.2, 273.3],
    lblDestino: 288.65, valDestino: 334.39, ulDestino: [332.3, 537.3]
  },

  /* Tabla de materiales */
  tabla: {
    t: 197.0,          // filete superior (grueso)
    hdrB: 213.0,       // filete inferior del encabezado (grueso)
    fila1B: 238.63,    // primera fila (más alta, igual que el modelo)
    filaH: 15.355,     // alto de las filas siguientes
    b: 500.4,          // filete inferior de la tabla (grueso)
    cols: [37.2, 76.42, 430.59, 489.62, 557.2],
    hdrBase: 210.0, hdrSize: 10.6,
    txtSize: 10.6,
    padDesc: 2.1       // sangría del texto de descripción respecto a la columna
  },

  /* Bloque «Motivo» — 4 renglones (rótulo + 3 líneas de texto) */
  motivo: {
    lblB: 517.0, l1B: 533.8, l2B: 550.3, l3B: 567.1,
    x: 39.12, size: 10.6,
    baseLbl: 515.1, base1: 530.5, base2: 547.1, base3: 563.8
  },

  /* Bloque de firmas */
  firmas: {
    lineaY: 617.0,
    // Caja de referencia para la firma digitalizada, sobre cada línea de firma.
    // La imagen conserva su proporción, se centra en la columna y nunca invade
    // el bloque «Motivo» ni la línea de firma (topeY / margenInf son los topes).
    imagen: { maxW: 150, maxH: 42, margenInf: 3.2, topeY: 569.5 },
    segs: [[36.5, 194.6], [214.3, 371.7], [391.4, 557.9]],
    colX: [39.12, 216.29, 393.43],
    rolBase: 626.9,      // AUTORIZADO POR / ENTREGADO POR / RECIBIDO POR
    nomBase: 637.9,      // NOMBRE: …
    filaB: 640.9,        // filete grueso
    cedBase: 650.6,      // CÉDULA: …
    cedB: 656.3,         // filete grueso
    size: 10.6,
    sangriaNombre: 47.1, // desplazamiento del valor tras «NOMBRE:»
    sangriaCedula: 39.8  // desplazamiento del valor tras «CÉDULA:»
  },

  /* Bloque «Control de vigilancia (portería)» */
  vigilancia: {
    tituloBase: 668.0, x: 39.12, size: 10.6,
    empresaBase: 686.7, empresaVal: 137.54, empresaUl: [96.2, 293.0], empresaUlY: 688.7,
    firmaY: 730.5, firmaSeg: [36.5, 194.6],
    nombreBase: 742.4, cedulaBase: 756.3
  },

  /* Pie de página */
  pie: {
    codBase: 766.0, codX: 553.4, edBase: 778.6, edX: 555.6, size: 9.6,
    pagBase: 778.6, pagX: 39.12, pagSize: 8.5
  }
};


/* ==========================================================================
   ▓▓▓ BLOQUE 3 — UTILIDADES GENERALES ▓▓▓
   ========================================================================== */

const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

/** Escapa texto para insertarlo con seguridad en HTML. */
function esc(txt) {
  return String(txt == null ? '' : txt)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Normaliza cadenas para comparar (sin tildes, sin espacios, minúsculas). */
function norm(txt) {
  return String(txt == null ? '' : txt)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Deja solo los dígitos de una cédula: '12.345.678' → '12345678'. */
function claveCedula(ced) {
  return String(ced == null ? '' : ced).replace(/\D+/g, '');
}

/** Devuelve la firma digitalizada registrada para una cédula, o null. */
function firmaDe(cedula) {
  const k = claveCedula(cedula);
  return (k && CONFIG.firmas && CONFIG.firmas[k]) ? CONFIG.firmas[k] : null;
}

/** Convierte 'AAAA-MM-DD' (valor nativo de <input type=date>) a 'DD/MM/AAAA'. */
function fechaAtexto(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [a, m, d] = iso.split('-');
  return d + '/' + m + '/' + a;
}

/** Normaliza la hora a 'HH:MM' (descarta segundos si el navegador los envía). */
function horaAtexto(v) {
  if (!v) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return '';
  return String(m[1]).padStart(2, '0') + ':' + m[2];
}

/** Formatea una cantidad: entero sin decimales, decimal con los que tenga (máx. 3). */
function fmtCantidad(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toFixed(3))).replace('.', ',');
}

/** Nombre de archivo: Orden_Entrada_00125_2026-08-26 */
function nombreArchivo(orden, ext) {
  const tipo = orden.tipo === 'ENTRADA' ? 'Entrada' : 'Salida';
  const num  = String(orden.numero || 'SIN-NUMERO').replace(/[^\w.-]+/g, '-');
  const fec  = orden.fechaISO || new Date().toISOString().slice(0, 10);
  return `${CONFIG.prefijoArchivo}_${tipo}_${num}_${fec}.${ext}`;
}

/* --------------------- Notificaciones y bloqueo de UI ------------------- */

function aviso(texto, tipo, ms) {
  const cont = $('#tostadas');
  if (!cont) return;
  const d = document.createElement('div');
  d.className = 'tostada' + (tipo ? ' ' + tipo : '');
  d.innerHTML = `<span>${esc(texto)}</span><span class="x" title="Cerrar">✕</span>`;
  d.querySelector('.x').onclick = () => d.remove();
  cont.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 250); }, ms || 4200);
}

function cargando(on, texto) {
  const c = $('#cargando');
  if (!c) return;
  if (texto) $('#txtCargando').textContent = texto;
  c.classList.toggle('ver', !!on);
}

/* --------------------------- Almacenamiento ---------------------------- */

const LS = {
  BORRADOR: 'ssee.orden.borrador.v1',
  LISTAS:   'ssee.orden.listas.v1',
  ORDENES:  'ssee.orden.historico.v1',

  disponible() {
    try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  },
  leer(clave, porDefecto) {
    try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto; }
    catch (e) { console.warn('No se pudo leer', clave, e); return porDefecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) {
      console.warn('No se pudo guardar', clave, e);
      aviso('No fue posible guardar en el almacenamiento local del navegador.', 'warn');
      return false;
    }
  },
  borrar(clave) { try { localStorage.removeItem(clave); } catch (e) { /* ignorado */ } }
};

/* ------------------------ Estado de las librerías ---------------------- */

const LIBS = {
  get jspdf()   { return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null; },
  get exceljs() { return window.ExcelJS || null; },
  get xlsx()    { return window.XLSX || null; },
  get saver()   { return window.saveAs || null; },

  /** Descarga un Blob con FileSaver o, si no está, con un enlace temporal. */
  descargar(blob, nombre) {
    if (this.saver) { this.saver(blob, nombre); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  },

  /** Pinta en la cabecera qué librerías se cargaron correctamente. */
  pintarEstado() {
    const cont = $('#estadoLibs');
    if (!cont) return;
    const items = [
      ['PDF',   !!this.jspdf],
      ['Excel', !!this.exceljs],
      ['Lector', !!this.xlsx]
    ];
    cont.innerHTML = items.map(([n, ok]) =>
      `<span class="chip-lib${ok ? '' : ' off'}" title="${ok ? 'Librería disponible' : 'Librería no disponible (¿sin conexión a internet?)'}">${n}</span>`
    ).join('');
  }
};

/* -------------------- Ajuste de texto a un ancho dado ------------------ */

/**
 * Parte un texto en líneas que quepan en `anchoPt`, midiendo con un canvas
 * (misma métrica aproximada que usa la vista previa y jsPDF con Helvetica).
 */
const _cv = document.createElement('canvas');
const _cx = _cv.getContext('2d');
const PX_A_PT = 72 / 96;          // measureText devuelve píxeles CSS, no puntos

function partirTexto(texto, anchoPt, sizePt, negrita) {
  const t = String(texto == null ? '' : texto).trim();
  if (!t) return [''];
  _cx.font = (negrita ? 'bold ' : '') + sizePt + 'pt Helvetica, Arial, sans-serif';
  const palabras = t.split(/\s+/);
  const lineas = [];
  let act = '';
  for (const p of palabras) {
    const cand = act ? act + ' ' + p : p;
    if (_cx.measureText(cand).width * PX_A_PT <= anchoPt || !act) act = cand;
    else { lineas.push(act); act = p; }
  }
  if (act) lineas.push(act);
  return lineas;
}


/* ==========================================================================
   ▓▓▓ BLOQUE 4 — ESTADO, FORMULARIO Y VALIDACIONES ▓▓▓
   ========================================================================== */

const estado = {
  items: [],                                   // [{descripcion, unidad, cantidad}]
  listas: {
    origenDestino: CONFIG.origenDestino.slice(),
    materiales:    CONFIG.materiales.slice(),
    fuenteOD:  'precargado',
    fuenteMat: 'precargado'
  },
  ordenes: [],                                 // histórico en localStorage
  libroImportado: null,                        // libro SheetJS pendiente de elegir hoja
  zoom: 1
};

/* ------------------------- Llenado de desplegables --------------------- */

/**
 * Llena un <select>. Si algún valor trae `grupo`, la lista se divide en
 * <optgroup> conservando el orden de aparición de los grupos.
 */
function opciones(sel, valores, textoVacio) {
  const prev = sel.value;
  sel.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = ''; o0.textContent = textoVacio || '— Seleccione —';
  sel.appendChild(o0);

  const crear = v => {
    const o = document.createElement('option');
    if (typeof v === 'string') { o.value = v; o.textContent = v; }
    else { o.value = v.valor; o.textContent = v.texto; if (v.datos) Object.assign(o.dataset, v.datos); }
    return o;
  };

  const conGrupo = valores.some(v => v && typeof v === 'object' && v.grupo);
  if (!conGrupo) {
    valores.forEach(v => sel.appendChild(crear(v)));
  } else {
    const grupos = new Map();
    valores.forEach(v => {
      const g = (v && v.grupo) || '';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(v);
    });
    grupos.forEach((lista, g) => {
      if (!g) { lista.forEach(v => sel.appendChild(crear(v))); return; }
      const og = document.createElement('optgroup');
      og.label = `${g}  (${lista.length})`;
      lista.forEach(v => og.appendChild(crear(v)));
      sel.appendChild(og);
    });
  }

  if (prev && Array.prototype.some.call(sel.querySelectorAll('option'), o => o.value === prev)) sel.value = prev;
}

function refrescarListas() {
  const od = estado.listas.origenDestino;

  opciones($('#origen'),  od);
  opciones($('#destino'), od);

  opciones($('#descripcion'), estado.listas.materiales.map(m => ({
    valor: m.descripcion,
    // El código va delante cuando existe: en los transformadores la UC es lo que identifica
    texto: (m.codigo ? m.codigo + '  ·  ' : '') + m.descripcion + (m.unidad ? '   [' + m.unidad + ']' : ''),
    grupo: m.grupo || '',
    datos: { unidad: m.unidad || '', codigo: m.codigo || '', referencia: m.referencia || '' }
  })));

  $('#cntOD').textContent  = od.length;
  $('#cntMat').textContent = estado.listas.materiales.length;
  $('#fteOD').textContent  = estado.listas.fuenteOD;
  $('#fteMat').textContent = estado.listas.fuenteMat;

  // Desglose por grupo bajo el contador de materiales
  const porGrupo = new Map();
  estado.listas.materiales.forEach(m => {
    const g = m.grupo || 'Sin grupo';
    porGrupo.set(g, (porGrupo.get(g) || 0) + 1);
  });
  const det = $('#detMat');
  if (det) {
    det.innerHTML = porGrupo.size > 1
      ? Array.from(porGrupo).map(([g, n]) => `${esc(g.split('·')[0].trim())}: <b>${n}</b>`).join(' · ')
      : '';
  }
}

function llenarFijos() {
  $('#logoApp').src = CONFIG.logo;
  $('#codDoc').textContent = CONFIG.documento.codigo;
  $('#edDoc').textContent  = CONFIG.documento.edicion;
  $('#capPagina').textContent = CONFIG.filasTablaPagina;

  $('#autorizado').value = `${CONFIG.autorizadoPor.nombre} — Cédula: ${CONFIG.autorizadoPor.cedula}`;
  if ($('#conFirmas')) $('#conFirmas').checked = true;

  $('#dlZonas').innerHTML = CONFIG.zonas.map(z => `<option value="${esc(z)}">`).join('');

  opciones($('#motivo'), CONFIG.motivos.concat([CONFIG.motivoOtro]));
  const marca = p => firmaDe(p.cedula) ? '  ✒' : '';
  opciones($('#entregado'), CONFIG.entregadoPor.map((p, i) => ({
    valor: String(i), texto: `${p.nombre}${marca(p)}`
  })));
  opciones($('#recibido'), CONFIG.recibidoPor.map((p, i) => ({
    valor: String(i), texto: `${p.nombre}${marca(p)}`
  })));

  pintarEstadoFirmas();
}

/** Resume en la interfaz qué responsables tienen firma digitalizada cargada. */
function pintarEstadoFirmas() {
  const cont = $('#estadoFirmas');
  if (!cont) return;
  const todos = [CONFIG.autorizadoPor].concat(CONFIG.entregadoPor, CONFIG.recibidoPor);
  const con = todos.filter(p => firmaDe(p.cedula));
  const sin = todos.filter(p => !firmaDe(p.cedula));
  cont.innerHTML =
    (con.length
      ? `<b>Con firma cargada (${con.length}):</b> ` + con.map(p => esc(p.nombre)).join(', ') + '. '
      : '<b>Todavía no hay firmas cargadas.</b> ') +
    (sin.length
      ? `<span style="color:#4A5A66">Sin firma (${sin.length}): ` + sin.map(p => esc(p.nombre)).join(', ') +
        ' — se deja el espacio en blanco para firmar a mano.</span>'
      : '');
}

/* --------------------- Motivo abierto y renglones ---------------------- */

/** ¿Está elegida la opción «Otro (especificar)»? */
function motivoEsOtro() { return $('#motivo').value === CONFIG.motivoOtro; }

/** Texto de motivo que realmente se imprime en el documento. */
function motivoFinal() {
  return motivoEsOtro() ? $('#motivoOtro').value.trim() : $('#motivo').value;
}

/** Muestra u oculta el campo de descripción según la opción elegida. */
function alternarMotivoOtro() {
  const otro = motivoEsOtro();
  $('#w-motivoOtro').hidden = !otro;
  if (!otro) marcarOK('motivoOtro');
  else setTimeout(() => $('#motivoOtro').focus(), 0);
  medirRenglones();
}

/**
 * El bloque «Motivo» del formato tiene exactamente 3 renglones. Aquí se calcula
 * cuántos ocupan el motivo y la nota con el ancho real del documento, para
 * avisar ANTES de exportar si algo se va a quedar fuera.
 */
function medirRenglones() {
  const el = $('#avisoRenglones');
  if (!el) return;
  const ancho = GEO.caja.r - GEO.motivo.x - 4;
  const mot = motivoFinal();
  const nota = $('#nota').value.trim();

  const lMot  = mot  ? partirTexto(mot, ancho, GEO.motivo.size, false).length : 0;
  const lNota = nota ? partirTexto('Nota: ' + nota, ancho, GEO.motivo.size, false).length : 0;
  const total = lMot + lNota;

  if (!total) { el.className = 'oms-aviso'; el.innerHTML = ''; return; }

  const detalle = `Motivo: ${lMot} · Nota: ${lNota}`;
  if (total <= 3) {
    el.className = 'oms-aviso ver ok';
    el.innerHTML = `Ocupa <b>${total} de los 3 renglones</b> del bloque «Motivo» del formato (${detalle}).`;
  } else {
    el.className = 'oms-aviso ver warn';
    el.innerHTML = `<b>Se pasa del espacio del formato:</b> necesita ${total} renglones y el bloque «Motivo» ` +
      `solo tiene 3 (${detalle}). Los renglones sobrantes <b>no se imprimirán</b>. Acorte el texto.`;
  }
}

/* ----------------------------- Ítems ----------------------------------- */

function pintarItems() {
  const tb = $('#cuerpoItems');
  if (!estado.items.length) {
    tb.innerHTML = '<tr class="vacia"><td colspan="5">Aún no hay materiales registrados. Agregue al menos uno.</td></tr>';
  } else {
    tb.innerHTML = estado.items.map((it, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td>${it.codigo ? `<b style="color:#005089">${esc(it.codigo)}</b> · ` : ''}${esc(it.descripcion)}</td>
        <td class="u">${esc(it.unidad || '')}</td>
        <td class="q">${esc(fmtCantidad(it.cantidad))}</td>
        <td class="acc"><button type="button" class="btn-quitar" data-i="${i}" title="Quitar ítem" aria-label="Quitar ítem ${i + 1}">✕</button></td>
      </tr>`).join('');
  }
  $('#numItems').textContent = estado.items.length;

  const paginas = Math.max(1, Math.ceil(estado.items.length / CONFIG.filasTablaPagina));
  $('#avisoPaginas').innerHTML = paginas > 1
    ? `<b style="color:#B26A00">El documento se generará en ${paginas} páginas.</b>` : '';

  if (estado.items.length) marcarOK('items');
  guardarBorrador();
}

function agregarItem() {
  const selDesc = $('#descripcion');
  const desc = selDesc.value.trim();
  const cant = $('#cantidad').value;

  let ok = true;
  if (!desc) { marcarError('descripcion'); ok = false; } else marcarOK('descripcion');
  const n = Number(String(cant).replace(',', '.'));
  if (!cant || !isFinite(n) || n <= 0) { marcarError('cantidad'); ok = false; } else marcarOK('cantidad');
  if (!ok) { aviso('Revise la descripción y la cantidad antes de agregar el ítem.', 'err'); return; }

  const op = selDesc.selectedOptions[0];
  const unidad = (op && op.dataset.unidad) || $('#unidad').value || '';
  const codigo = (op && op.dataset.codigo) || '';

  // Si el material ya existe con la misma unidad, se acumula la cantidad
  const ya = estado.items.find(x => norm(x.descripcion) === norm(desc) && norm(x.unidad) === norm(unidad));
  if (ya) {
    ya.cantidad = Number(ya.cantidad) + n;
    aviso(`Cantidad acumulada en el ítem existente: ${fmtCantidad(ya.cantidad)} ${unidad}.`, 'warn');
  } else {
    estado.items.push({ descripcion: desc, unidad, codigo, cantidad: n });
  }

  selDesc.value = ''; $('#unidad').value = ''; $('#cantidad').value = '';
  pintarItems();
  selDesc.focus();
}

/* --------------------------- Validaciones ------------------------------ */

function marcarError(id, mensaje) {
  const w = $('#w-' + id);
  if (!w) return;
  w.classList.add('error');
  if (mensaje) { const m = $('#e-' + id); if (m) m.textContent = mensaje; }
}
function marcarOK(id) { const w = $('#w-' + id); if (w) w.classList.remove('error'); }

/**
 * Valida el formulario completo.
 * @returns {{ok:boolean, errores:string[]}}
 */
function validar() {
  const errores = [];
  const campos = ['tipo', 'numero', 'zona', 'fecha', 'hora', 'origen', 'destino', 'motivo', 'motivoOtro', 'entregado', 'recibido', 'items'];
  campos.forEach(marcarOK);

  const tipo = ($$('input[name=tipo]').find(r => r.checked) || {}).value || '';
  if (!tipo) { marcarError('tipo'); errores.push('Debe seleccionar el tipo de orden (entrada o salida).'); }

  if (!$('#numero').value.trim()) { marcarError('numero'); errores.push('El número de orden no puede estar vacío.'); }
  if (!$('#zona').value.trim())   { marcarError('zona');   errores.push('Debe indicar la zona.'); }

  const f = $('#fecha').value;
  if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f) || isNaN(new Date(f + 'T00:00:00').getTime())) {
    marcarError('fecha'); errores.push('Debe seleccionar una fecha válida (DD/MM/AAAA).');
  }

  const h = $('#hora').value;
  if (!h || !/^\d{1,2}:\d{2}/.test(h)) { marcarError('hora'); errores.push('Debe seleccionar una hora válida (HH:MM).'); }

  if (!$('#origen').value)  { marcarError('origen');  errores.push('Debe seleccionar el origen.'); }
  if (!$('#destino').value) { marcarError('destino'); errores.push('Debe seleccionar el destino.'); }

  if (!estado.items.length) {
    marcarError('items');
    errores.push('Debe registrar al menos un material con su descripción y cantidad mayor que cero.');
  } else if (estado.items.some(i => !(Number(i.cantidad) > 0))) {
    marcarError('items'); errores.push('Todas las cantidades deben ser numéricas y mayores que cero.');
  }

  if (!$('#motivo').value) {
    marcarError('motivo'); errores.push('Debe seleccionar el motivo de entrada y/o salida.');
  } else if (motivoEsOtro() && !$('#motivoOtro').value.trim()) {
    marcarError('motivoOtro');
    errores.push('Eligió «Otro» como motivo: debe describirlo, porque ese texto es el que se imprime.');
  }
  if (!$('#entregado').value) { marcarError('entregado'); errores.push('Debe seleccionar quién entrega los materiales.'); }
  if (!$('#recibido').value)  { marcarError('recibido');  errores.push('Debe seleccionar quién recibe los materiales.'); }

  // Advertencia no bloqueante: origen y destino iguales
  if ($('#origen').value && $('#origen').value === $('#destino').value) {
    aviso('Advertencia: el origen y el destino son la misma sede.', 'warn', 6000);
  }

  return { ok: errores.length === 0, errores };
}

function mostrarErrores(errores) {
  aviso('No se puede continuar: ' + errores.length + (errores.length === 1 ? ' campo obligatorio pendiente.' : ' campos obligatorios pendientes.'), 'err', 6000);
  errores.slice(0, 4).forEach((e, i) => setTimeout(() => aviso(e, 'err', 7000), 120 * (i + 1)));
  const primero = $('.campo.error, #w-items.error');
  if (primero) primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* --------------------- Construcción del objeto orden ------------------- */

function leerOrden() {
  const tipo = ($$('input[name=tipo]').find(r => r.checked) || {}).value || '';
  const iEnt = $('#entregado').value, iRec = $('#recibido').value;
  const ent  = iEnt !== '' ? CONFIG.entregadoPor[Number(iEnt)] : null;
  const rec  = iRec !== '' ? CONFIG.recibidoPor[Number(iRec)]  : null;

  return {
    tipo,
    numero:   $('#numero').value.trim(),
    zona:     $('#zona').value.trim(),
    fechaISO: $('#fecha').value,
    fecha:    fechaAtexto($('#fecha').value),
    hora:     horaAtexto($('#hora').value),
    origen:   $('#origen').value,
    destino:  $('#destino').value,
    items:    estado.items.map(i => ({ ...i })),
    motivo:    motivoFinal(),                 // lo que se imprime
    motivoSel: $('#motivo').value,             // la opción elegida, para poder recargarla
    nota:      $('#nota').value.trim(),
    autorizado: { ...CONFIG.autorizadoPor },
    entregado:  ent ? { ...ent } : { nombre: '', cedula: '' },
    recibido:   rec ? { ...rec } : { nombre: '', cedula: '' },
    empresaVig: $('#empresaVig').value.trim(),
    conFirmas:  $('#conFirmas') ? $('#conFirmas').checked : true,
    guardadaEn: new Date().toISOString()
  };
}

function escribirOrden(o) {
  if (!o) return;
  $$('input[name=tipo]').forEach(r => { r.checked = (r.value === o.tipo); });
  $('#numero').value  = o.numero || '';
  $('#zona').value    = o.zona || '';
  $('#fecha').value   = o.fechaISO || '';
  $('#hora').value    = o.hora || '';
  const sel = o.motivoSel || o.motivo || '';
  const esOtro = sel === CONFIG.motivoOtro;
  $('#motivo').value = Array.prototype.some.call($('#motivo').querySelectorAll('option'), x => x.value === sel) ? sel : '';
  $('#motivoOtro').value = esOtro ? (o.motivo || '') : '';
  $('#w-motivoOtro').hidden = !esOtro;
  $('#nota').value    = o.nota || '';
  $('#empresaVig').value = o.empresaVig || '';
  if ($('#conFirmas')) $('#conFirmas').checked = (o.conFirmas !== false);

  // Origen/destino pueden no estar en la lista actual: se agregan si faltan
  [['#origen', o.origen], ['#destino', o.destino]].forEach(([sel, val]) => {
    if (!val) { $(sel).value = ''; return; }
    if (!Array.prototype.some.call($(sel).options, x => x.value === val)) {
      const op = document.createElement('option'); op.value = val; op.textContent = val;
      $(sel).appendChild(op);
    }
    $(sel).value = val;
  });

  const iE = CONFIG.entregadoPor.findIndex(p => p.cedula === (o.entregado || {}).cedula);
  const iR = CONFIG.recibidoPor.findIndex(p => p.cedula === (o.recibido || {}).cedula);
  $('#entregado').value = iE >= 0 ? String(iE) : '';
  $('#recibido').value  = iR >= 0 ? String(iR) : '';

  estado.items = (o.items || []).map(i => ({ ...i }));
  pintarItems();
}

/* ----------------------- Borrador y órdenes guardadas ------------------ */

let _tBorrador = null;
function guardarBorrador() {
  clearTimeout(_tBorrador);
  _tBorrador = setTimeout(() => LS.escribir(LS.BORRADOR, leerOrden()), 400);
}

function guardarOrden() {
  const v = validar();
  if (!v.ok) { mostrarErrores(v.errores); return; }
  const o = leerOrden();
  const i = estado.ordenes.findIndex(x => x.numero === o.numero && x.tipo === o.tipo);
  if (i >= 0) {
    if (!confirm(`Ya existe una orden de ${o.tipo.toLowerCase()} con el número ${o.numero}.\n\n¿Desea reemplazarla?`)) return;
    estado.ordenes[i] = o;
  } else {
    estado.ordenes.unshift(o);
    if (estado.ordenes.length > CONFIG.maxOrdenesGuardadas) estado.ordenes.length = CONFIG.maxOrdenesGuardadas;
  }
  LS.escribir(LS.ORDENES, estado.ordenes);
  pintarOrdenes();
  aviso(`Orden ${o.numero} guardada. Total acumulado: ${estado.ordenes.length}.`, 'ok');

  // Si hay un archivo de datos vinculado, se escribe también allí
  if (typeof DATOS !== 'undefined' && DATOS.handle) DATOS.escribir();
  if (typeof pintarAlmacenamiento === 'function') pintarAlmacenamiento();
}

function pintarOrdenes() {
  const cont = $('#listaOrdenes');
  $('#cntOrd').textContent = estado.ordenes.length;
  if (!estado.ordenes.length) {
    cont.innerHTML = '<p class="sin-datos">Todavía no hay órdenes guardadas en este equipo.</p>';
    return;
  }

  // Filtro del buscador (número, origen, destino o descripción de material)
  const q = norm(($('#buscarOrden') || {}).value || '');
  const visibles = !q ? estado.ordenes.map((o, i) => [o, i])
    : estado.ordenes.map((o, i) => [o, i]).filter(([o]) =>
        norm(o.numero).includes(q) || norm(o.origen).includes(q) ||
        norm(o.destino).includes(q) || norm(o.zona).includes(q) ||
        (o.items || []).some(it => norm(it.descripcion).includes(q)));

  if (!visibles.length) {
    cont.innerHTML = `<p class="sin-datos">Ninguna de las ${estado.ordenes.length} órdenes guardadas coincide con «${esc(q)}».</p>`;
    return;
  }

  cont.innerHTML = visibles.map(([o, i]) => `
    <div class="item-orden">
      <span class="badge ${o.tipo === 'ENTRADA' ? 'entrada' : 'salida'}">${esc(o.tipo)}</span>
      <span class="no">N.º ${esc(o.numero)}</span>
      <span class="meta">${esc(o.fecha)} ${esc(o.hora)} · ${esc(o.origen)} → ${esc(o.destino)} · ${o.items.length} ítem(s)</span>
      <span class="acciones">
        <button type="button" class="oms-btn mini" data-cargar="${i}">Cargar</button>
        <button type="button" class="oms-btn mini peligro" data-eliminar="${i}">Eliminar</button>
      </span>
    </div>`).join('') +
    (q ? `<p class="sin-datos">Mostrando ${visibles.length} de ${estado.ordenes.length} órdenes guardadas.</p>` : '');
}

/* ------------------------ Nueva orden / limpiar ------------------------ */

function formularioTieneDatos() {
  return !!($('#numero').value.trim() || $('#zona').value.trim() || $('#origen').value ||
            $('#destino').value || $('#motivo').value || $('#nota').value.trim() ||
            $('#motivoOtro').value.trim() ||
            estado.items.length || $$('input[name=tipo]').some(r => r.checked));
}

function limpiarFormulario(pedirConfirmacion, mensaje) {
  if (pedirConfirmacion && formularioTieneDatos()) {
    if (!confirm(mensaje || '¿Desea limpiar el formulario?\n\nSe perderán los datos diligenciados que no haya guardado.')) return false;
  }
  $('#formOrden').reset();
  estado.items = [];
  ['tipo', 'numero', 'zona', 'fecha', 'hora', 'origen', 'destino', 'motivo', 'motivoOtro', 'entregado', 'recibido', 'items', 'descripcion', 'cantidad'].forEach(marcarOK);
  $('#w-motivoOtro').hidden = true;
  if (typeof medirRenglones === 'function') medirRenglones();
  $('#autorizado').value = `${CONFIG.autorizadoPor.nombre} — Cédula: ${CONFIG.autorizadoPor.cedula}`;
  if ($('#conFirmas')) $('#conFirmas').checked = true;
  $('#unidad').value = '';
  pintarItems();
  LS.borrar(LS.BORRADOR);
  return true;
}

function nuevaOrden() {
  if (!limpiarFormulario(true, '¿Desea iniciar una nueva orden?\n\nSe perderán los datos diligenciados que no haya guardado.')) return;
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const aa = hoy.getFullYear();
  $('#fecha').value  = `${aa}-${mm}-${dd}`;
  $('#hora').value   = String(hoy.getHours()).padStart(2, '0') + ':' + String(hoy.getMinutes()).padStart(2, '0');
  $('#numero').value = `${dd}${mm}${aa}-01`;   // mismo criterio del formato modelo
  $('#numero').focus();
  $('#numero').select();
  aviso('Nueva orden iniciada. Se propuso número, fecha y hora actuales.', 'ok');
}


/* ==========================================================================
   ▓▓▓ BLOQUE 5 — MODELO DEL DOCUMENTO ▓▓▓
   --------------------------------------------------------------------------
   `construirPaginas()` traduce una orden a una lista de PRIMITIVAS de dibujo
   (líneas, rectángulos, textos, imágenes) expresadas en puntos sobre la hoja
   A4. Esas mismas primitivas alimentan:
        · la vista previa (SVG)          → BLOQUE 6
        · la exportación a PDF (jsPDF)   → BLOQUE 7
   De ese modo la vista previa y el PDF son geométricamente idénticos.
   ========================================================================== */

/** Ancho de un texto EN PUNTOS, con la métrica de Helvetica/Arial. */
function anchoTexto(txt, size, bold) {
  _cx.font = (bold ? 'bold ' : '') + size + 'pt Helvetica, Arial, sans-serif';
  return _cx.measureText(String(txt == null ? '' : txt)).width * PX_A_PT;
}

/** Reduce el tamaño de fuente hasta que el texto quepa en `maxW`. */
function ajustar(txt, maxW, size, bold, minimo) {
  let s = size;
  const min = minimo || 6;
  while (s > min && anchoTexto(txt, s, bold) > maxW) s -= 0.25;
  return s;
}

/**
 * Posición X del valor que va después de un rótulo.
 * Respeta la coordenada del formato modelo (medida con Calibri) pero la
 * desplaza si la fuente del PDF (Helvetica) hace que el rótulo sea más ancho,
 * de modo que rótulo y valor nunca se solapen.
 */
function trasRotulo(xRotulo, rotulo, size, negrita, xModelo) {
  return Math.max(xModelo, xRotulo + anchoTexto(rotulo, size, negrita) + 4);
}

/**
 * Calcula posición y tamaño de una firma digitalizada sobre la línea `i`.
 * Conserva la proporción de la imagen, aplica su `escala` propia y la recorta
 * al espacio realmente disponible (ancho de la columna y alto libre sobre la
 * línea de firma), de modo que nunca se salga de su casilla.
 */
function cajaFirma(fir, i) {
  const F = GEO.firmas, M = F.imagen;
  const seg = F.segs[i];
  const anchoDisp = (seg[1] - seg[0]) - 6;
  const altoDisp  = F.lineaY - M.margenInf - M.topeY;

  let h = M.maxH * (fir.escala || 1);
  let w = h * fir.rel;
  const k = Math.min(anchoDisp / w, M.maxW / w, altoDisp / h, 1);   // recorte de seguridad
  h *= k; w *= k;

  return {
    x: seg[0] + ((seg[1] - seg[0]) - w) / 2,
    y: F.lineaY - M.margenInf - h,
    w: w, h: h
  };
}

/* Constructores abreviados de primitivas */
const P = {
  linea: (x1, y, x2, w)       => ({ t: 'linea', x1, y1: y, x2, y2: y, w }),
  vert:  (x, y1, y2, w)       => ({ t: 'linea', x1: x, y1, x2: x, y2, w }),
  rect:  (x, y, w, h, lw)     => ({ t: 'rect', x, y, w, h, lw }),
  txt:   (x, y, s, size, opt) => Object.assign({ t: 'txt', x, y, s: String(s == null ? '' : s), size }, opt || {}),
  img:   (x, y, w, h, src)    => ({ t: 'img', x, y, w, h, src }),
  chk:   (c, marcado)         => ({ t: 'chk', x: c.x, y: c.y, w: c.w, h: c.h, marcado })
};

/**
 * Construye las páginas del documento.
 * @param {object} o  orden devuelta por leerOrden()
 * @returns {Array<Array<object>>} una lista de primitivas por página
 */
function construirPaginas(o) {
  const G = GEO;
  const L = G.caja.l, R = G.caja.r;
  const gruesa = 1.30, media = 1.00, fina = 0.70;
  const S = 10.6;                                  // tamaño base del cuerpo

  const porPagina = CONFIG.filasTablaPagina;
  const items = (o.items && o.items.length) ? o.items : [];
  const nPag  = Math.max(1, Math.ceil(items.length / porPagina));
  const paginas = [];

  for (let p = 0; p < nPag; p++) {
    const d = [];
    const lote = items.slice(p * porPagina, (p + 1) * porPagina);

    /* ---------- Banda del logotipo ---------- */
    if (CONFIG.logo) d.push(P.img(G.logo.x, G.logo.y, G.logo.w, G.logo.h, CONFIG.logo));
    d.push(P.linea(L, G.bandaLogo.b, R, gruesa));

    /* ---------- Título ---------- */
    d.push(P.linea(L, G.titulo.t1, R, fina));
    d.push(P.linea(L, G.titulo.t2, R, fina));
    d.push(P.linea(L, G.titulo.b1, R, fina));
    d.push(P.linea(L, G.titulo.b2, R, fina));
    const tSize = ajustar(CONFIG.documento.titulo, R - L - 16, G.titulo.size, true, 10);
    d.push(P.txt((L + R) / 2, G.titulo.base, CONFIG.documento.titulo, tSize, { b: 1, al: 'c' }));

    /* ---------- ORDEN DE / No. ---------- */
    const O = G.orden;
    d.push(P.txt(O.lblOrden,   O.base, 'ORDEN DE:', S, { b: 1 }));
    // Alineados a la derecha para no invadir la casilla, cualquiera que sea la fuente
    d.push(P.txt(O.chkEntrada.x - 3.5, O.base, 'ENTRADA', S, { al: 'r' }));
    d.push(P.txt(O.chkSalida.x  - 3.5, O.base, 'SALIDA',  S, { al: 'r' }));
    d.push(P.chk(O.chkEntrada, o.tipo === 'ENTRADA'));
    d.push(P.chk(O.chkSalida,  o.tipo === 'SALIDA'));
    d.push(P.txt(O.cajaNo.x - 4, O.base, 'No.', S, { b: 1, al: 'r' }));
    d.push(P.rect(O.cajaNo.x, O.cajaNo.y, O.cajaNo.w, O.cajaNo.h, media));
    const nSize = ajustar(o.numero || '', O.cajaNo.w - 6, O.noSize, true, 6.5);
    d.push(P.txt(O.cajaNo.x + O.cajaNo.w / 2, O.noBase, o.numero || '', nSize, { b: 1, al: 'c' }));

    /* ---------- ZONA / FECHA / HORA ---------- */
    const Z = G.zona;
    d.push(P.txt(Z.lblZona,  Z.base, 'ZONA:',  S, { b: 1 }));
    d.push(P.txt(Z.lblFecha, Z.base, 'FECHA:', S, { b: 1 }));
    d.push(P.txt(Z.lblHora,  Z.base, 'HORA:',  S, { b: 1 }));
    const xZona  = trasRotulo(Z.lblZona,  'ZONA:',  S, true, Z.valZona);
    const xFecha = trasRotulo(Z.lblFecha, 'FECHA:', S, true, Z.valFecha);
    const xHora  = trasRotulo(Z.lblHora,  'HORA:',  S, true, Z.valHora);
    d.push(P.txt(xZona,  Z.base, o.zona || '',  ajustar(o.zona || '',  Z.ulZona[1]  - xZona  - 2, S, false)));
    d.push(P.txt(xFecha, Z.base, o.fecha || '', ajustar(o.fecha || '', Z.ulFecha[1] - xFecha - 2, S, false)));
    d.push(P.txt(xHora,  Z.base, o.hora || '',  ajustar(o.hora || '',  Z.ulHora[1]  - xHora  - 2, S, false)));
    d.push(P.linea(Z.ulZona[0],  Z.ul, Z.ulZona[1],  fina));
    d.push(P.linea(Z.ulFecha[0], Z.ul, Z.ulFecha[1], fina));
    d.push(P.linea(Z.ulHora[0],  Z.ul, Z.ulHora[1],  fina));

    /* ---------- ORIGEN / DESTINO ---------- */
    const Or = G.origen;
    d.push(P.txt(Or.lblOrigen,  Or.base, 'ORIGEN:',  S, { b: 1 }));
    d.push(P.txt(Or.lblDestino, Or.base, 'DESTINO:', S, { b: 1 }));
    const xOri = trasRotulo(Or.lblOrigen,  'ORIGEN:',  S, true, Or.valOrigen);
    const xDes = trasRotulo(Or.lblDestino, 'DESTINO:', S, true, Or.valDestino);
    d.push(P.txt(xOri, Or.base, o.origen  || '', ajustar(o.origen  || '', Or.ulOrigen[1]  - xOri - 2, S, false)));
    d.push(P.txt(xDes, Or.base, o.destino || '', ajustar(o.destino || '', Or.ulDestino[1] - xDes - 2, S, false)));
    d.push(P.linea(Or.ulOrigen[0],  Or.ul, Or.ulOrigen[1],  fina));
    d.push(P.linea(Or.ulDestino[0], Or.ul, Or.ulDestino[1], fina));

    /* ---------- Tabla de materiales ---------- */
    const T = G.tabla, C = T.cols;
    d.push(P.linea(L, T.t,    R, gruesa));
    d.push(P.linea(L, T.hdrB, R, gruesa));
    d.push(P.txt((C[0] + C[1]) / 2, T.hdrBase, 'ITEM',     S, { b: 1, al: 'c' }));
    d.push(P.txt((C[1] + C[2]) / 2, T.hdrBase, 'DESCRIPCION DEL(OS) MATERIAL(ES)', S, { b: 1, al: 'c' }));
    d.push(P.txt((C[2] + C[3]) / 2, T.hdrBase, 'UNIDAD',   S, { b: 1, al: 'c' }));
    d.push(P.txt((C[3] + C[4]) / 2, T.hdrBase, 'CANTIDAD', S, { b: 1, al: 'c' }));

    // Límites verticales de cada una de las 18 filas
    const limites = [T.hdrB, T.fila1B];
    for (let k = 1; k <= 16; k++) limites.push(T.fila1B + k * T.filaH);
    limites.push(T.b);

    for (let k = 1; k < limites.length - 1; k++) d.push(P.linea(C[0], limites[k], C[4], fina));
    d.push(P.linea(L, T.b, R, gruesa));
    for (let c = 1; c <= 3; c++) d.push(P.vert(C[c], T.t, T.b, media));

    lote.forEach((it, i) => {
      const top = limites[i], bot = limites[i + 1];
      const base = (top + bot) / 2 + 0.35 * T.txtSize;
      const nro  = p * porPagina + i + 1;
      const xDesc = C[1] + T.padDesc;
      const anchoDesc = C[2] - xDesc - 3;
      const desc = (it.codigo ? it.codigo + ' · ' : '') + it.descripcion;   // el código identifica: va delante
      d.push(P.txt((C[0] + C[1]) / 2, base, String(nro), T.txtSize, { al: 'c' }));
      d.push(P.txt(xDesc, base, desc, ajustar(desc, anchoDesc, T.txtSize, false, 5.5)));
      d.push(P.txt((C[2] + C[3]) / 2, base, it.unidad || '', T.txtSize, { al: 'c' }));
      d.push(P.txt((C[3] + C[4]) / 2, base, fmtCantidad(it.cantidad), T.txtSize, { al: 'c' }));
    });

    /* ---------- Motivo / Nota ---------- */
    const M = G.motivo;
    d.push(P.linea(L, M.lblB, R, fina));
    d.push(P.linea(L, M.l1B,  R, fina));
    d.push(P.linea(L, M.l2B,  R, fina));
    d.push(P.linea(L, M.l3B,  R, gruesa));
    d.push(P.txt(M.x, M.baseLbl, 'Motivo Entrada y/o Salida de Materiales:', S, { b: 1 }));

    const anchoMot = R - M.x - 4;
    const rMot = [];                                    // hasta 3 renglones disponibles
    partirTexto(o.motivo || '', anchoMot, S, false).forEach(l => rMot.push(l));
    if (o.nota) partirTexto('Nota: ' + o.nota, anchoMot, S, false).forEach(l => rMot.push(l));
    const basesMot = [M.base1, M.base2, M.base3];
    rMot.slice(0, 3).forEach((linea, i) => {
      d.push(P.txt(M.x, basesMot[i], linea, ajustar(linea, anchoMot, S, false, 7)));
    });

    /* ---------- Firmas ---------- */
    const F = G.firmas;
    F.segs.forEach(sg => d.push(P.linea(sg[0], F.lineaY, sg[1], fina)));
    const personas = [
      { rol: 'AUTORIZADO POR:', p: o.autorizado },
      { rol: 'ENTREGADO POR:',  p: o.entregado  },
      { rol: 'RECIBIDO POR:',   p: o.recibido   }
    ];
    personas.forEach((pe, i) => {
      const x = F.colX[i];
      const anchoCol = (F.segs[i][1] - F.segs[i][0]) - (x - F.segs[i][0]) - 4;

      /* Firma digitalizada, si la persona tiene una registrada en CONFIG.firmas.
         Se escala conservando su proporción y se centra sobre la línea de firma. */
      if (o.conFirmas !== false) {
        const fir = firmaDe(pe.p && pe.p.cedula);
        if (fir) {
          const c = cajaFirma(fir, i);
          d.push(P.img(c.x, c.y, c.w, c.h, fir.src));
        }
      }

      d.push(P.txt(x, F.rolBase, pe.rol, F.size));
      d.push(P.txt(x, F.nomBase, 'NOMBRE:', F.size));
      d.push(P.txt(x, F.cedBase, 'CÉDULA:', F.size));
      const nom = (pe.p && pe.p.nombre) || '';
      const ced = (pe.p && pe.p.cedula) || '';
      const xNom = trasRotulo(x, 'NOMBRE:', F.size, false, x + F.sangriaNombre);
      const xCed = trasRotulo(x, 'CÉDULA:', F.size, false, x + F.sangriaCedula);
      if (nom) d.push(P.txt(xNom, F.nomBase, nom, ajustar(nom, F.segs[i][1] - xNom - 4, F.size, false, 6.5)));
      if (ced) d.push(P.txt(xCed, F.cedBase, ced, ajustar(ced, F.segs[i][1] - xCed - 4, F.size, false, 6.5)));
    });
    d.push(P.linea(L, F.filaB, R, gruesa));
    d.push(P.linea(L, F.cedB,  R, gruesa));

    /* ---------- Control de vigilancia (portería) ---------- */
    const V = G.vigilancia;
    d.push(P.txt(V.x, V.tituloBase,  'CONTROL DE VIGILANCIA (PORTERIA)', V.size, { b: 1 }));
    d.push(P.txt(V.x, V.empresaBase, 'EMPRESA:', V.size));
    if (o.empresaVig) {
      const xEmp = trasRotulo(V.x, 'EMPRESA:', V.size, false, V.empresaVal);
      d.push(P.txt(xEmp, V.empresaBase, o.empresaVig,
        ajustar(o.empresaVig, V.empresaUl[1] - xEmp - 2, V.size, false, 7)));
    }
    d.push(P.linea(V.empresaUl[0], V.empresaUlY, V.empresaUl[1], fina));
    d.push(P.linea(V.firmaSeg[0],  V.firmaY,     V.firmaSeg[1],  fina));
    d.push(P.txt(V.x, V.nombreBase, 'NOMBRE:', V.size));
    d.push(P.txt(V.x, V.cedulaBase, 'CÉDULA:', V.size));

    /* ---------- Pie ---------- */
    const Pi = G.pie;
    d.push(P.txt(Pi.codX, Pi.codBase, CONFIG.documento.codigo,  Pi.size, { al: 'r' }));
    d.push(P.txt(Pi.edX,  Pi.edBase,  CONFIG.documento.edicion, Pi.size, { al: 'r' }));
    if (nPag > 1) d.push(P.txt(Pi.pagX, Pi.pagBase, `Página ${p + 1} de ${nPag}`, Pi.pagSize));

    /* ---------- Marco exterior (siempre al final) ---------- */
    d.push(P.rect(L, G.caja.t, R - L, G.caja.b - G.caja.t, gruesa));

    paginas.push(d);
  }

  return paginas;
}


/* ==========================================================================
   ▓▓▓ BLOQUE 6 — VISTA PREVIA (SVG) ▓▓▓
   Cada página se dibuja como un SVG con viewBox en puntos, de modo que la
   posición de cada elemento coincide exactamente con la del PDF exportado.
   ========================================================================== */

const FUENTE_SVG = 'Helvetica, Arial, "Liberation Sans", sans-serif';

/** Convierte una lista de primitivas en el marcado SVG de una página A4. */
function paginaASVG(prims) {
  const W = GEO.pagina.w, H = GEO.pagina.h;
  const partes = [];

  prims.forEach(e => {
    switch (e.t) {
      case 'linea':
        partes.push(
          `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#000" stroke-width="${e.w}" shape-rendering="crispEdges"/>`
        );
        break;

      case 'rect':
        partes.push(
          `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="#000" stroke-width="${e.lw}" shape-rendering="crispEdges"/>`
        );
        break;

      case 'txt': {
        if (!e.s) break;
        const anchor = e.al === 'c' ? 'middle' : (e.al === 'r' ? 'end' : 'start');
        partes.push(
          `<text x="${e.x}" y="${e.y}" font-family='${FUENTE_SVG}' font-size="${e.size}"` +
          `${e.b ? ' font-weight="700"' : ''} text-anchor="${anchor}" fill="#000" ` +
          `xml:space="preserve">${esc(e.s)}</text>`
        );
        break;
      }

      case 'img':
        partes.push(
          `<image x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" href="${e.src}" preserveAspectRatio="xMidYMid meet"/>`
        );
        break;

      case 'chk': {
        // Casilla exterior + casilla interior (idéntico al formato modelo)
        const ix = e.x + 5.1, iw = 8.8, ih = 8.8, iy = e.y + (e.h - ih) / 2;
        partes.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="#000" stroke-width="0.9"/>`);
        partes.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="#000" stroke-width="0.7"/>`);
        if (e.marcado) {
          const p1 = [ix + 1.6, iy + 4.6], p2 = [ix + 3.5, iy + 6.8], p3 = [ix + 7.3, iy + 1.8];
          partes.push(
            `<polyline points="${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}" ` +
            `fill="none" stroke="#000" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>`
          );
        }
        break;
      }
    }
  });

  return `<svg class="hoja" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
         `width="${W}pt" height="${H}pt" role="img" aria-label="Vista previa de la orden">` +
         `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${partes.join('')}</svg>`;
}

/* ---------------------------- Modal ------------------------------------ */

function abrirVistaPrevia(ordenOpcional) {
  const o = ordenOpcional || leerOrden();
  const v = ordenOpcional ? { ok: true, errores: [] } : validar();
  if (!v.ok) { mostrarErrores(v.errores); return; }

  const paginas = construirPaginas(o);
  $('#cuerpoVista').innerHTML = paginas
    .map(p => `<div class="envoltura-hoja">${paginaASVG(p)}</div>`).join('');

  $('#tituloVista').textContent =
    `Vista previa — Orden de ${o.tipo.toLowerCase()} N.º ${o.numero}` +
    (paginas.length > 1 ? ` (${paginas.length} páginas)` : '');

  $('#modalVista').classList.add('ver');
  document.body.style.overflow = 'hidden';
  ajustarZoom();
}

function cerrarVistaPrevia() {
  $('#modalVista').classList.remove('ver');
  document.body.style.overflow = '';
}

/** Escala las hojas para que quepan en el ancho disponible. */
function ajustarZoom(delta) {
  const cuerpo = $('#cuerpoVista');
  if (!cuerpo) return;
  const anchoHojaPx = GEO.pagina.w * (96 / 72);          // 595,32 pt → px CSS
  const disponible  = cuerpo.clientWidth - 8;

  if (delta === undefined) estado.zoom = Math.min(1, disponible / anchoHojaPx);
  else estado.zoom = Math.min(2, Math.max(0.25, estado.zoom + delta));

  $$('.envoltura-hoja', cuerpo).forEach(w => {
    w.style.transform = `scale(${estado.zoom})`;
    w.style.height = (GEO.pagina.h * (96 / 72) * estado.zoom) + 'px';
    w.style.width  = anchoHojaPx + 'px';
  });
  $('#nivelZoom').textContent = Math.round(estado.zoom * 100) + ' %';
}


/* ==========================================================================
   ▓▓▓ BLOQUE 7 — EXPORTACIÓN A PDF (jsPDF, vectorial) ▓▓▓
   Se dibuja directamente en puntos sobre una hoja A4 vertical, con las mismas
   primitivas de la vista previa. El texto queda seleccionable y las líneas son
   vectoriales, por lo que la calidad de impresión es independiente del zoom.
   ========================================================================== */

function exportarPDF(ordenOpcional, soloDevolver) {
  // 1) Primero se valida el formulario (aunque falte la librería, el usuario
  //    debe ver qué campos obligatorios tiene pendientes).
  const o = ordenOpcional || leerOrden();
  if (!ordenOpcional) {
    const v = validar();
    if (!v.ok) { mostrarErrores(v.errores); return null; }
  }

  // 2) Después se comprueba la disponibilidad de jsPDF.
  const JsPDF = LIBS.jspdf;
  if (!JsPDF) {
    aviso('La librería de PDF (jsPDF) no está disponible. Verifique su conexión a internet y recargue la página.', 'err', 8000);
    return null;
  }

  try {
    cargando(true, 'Generando el PDF…');

    const doc = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({
      title:   `Orden de ${o.tipo.toLowerCase()} N.º ${o.numero}`,
      subject: CONFIG.documento.titulo,
      author:  o.autorizado.nombre,
      keywords: `${CONFIG.documento.codigo}, ${o.zona}, ${o.origen}, ${o.destino}`,
      creator: 'Módulo de Órdenes de Entrada y Salida de Materiales SSEE'
    });

    const paginas = construirPaginas(o);

    paginas.forEach((prims, idx) => {
      if (idx > 0) doc.addPage('a4', 'portrait');
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);

      prims.forEach(e => {
        switch (e.t) {

          case 'linea':
            doc.setLineWidth(e.w);
            doc.line(e.x1, e.y1, e.x2, e.y2);
            break;

          case 'rect':
            doc.setLineWidth(e.lw);
            doc.rect(e.x, e.y, e.w, e.h, 'S');
            break;

          case 'txt': {
            if (!e.s) break;
            doc.setFont('helvetica', e.b ? 'bold' : 'normal');
            doc.setFontSize(e.size);
            const align = e.al === 'c' ? 'center' : (e.al === 'r' ? 'right' : 'left');
            doc.text(e.s, e.x, e.y, { align, baseline: 'alphabetic' });
            break;
          }

          case 'img':
            try { doc.addImage(e.src, 'PNG', e.x, e.y, e.w, e.h, undefined, 'FAST'); }
            catch (err) { console.warn('No se pudo insertar el logotipo en el PDF:', err); }
            break;

          case 'chk': {
            const ix = e.x + 5.1, iw = 8.8, ih = 8.8, iy = e.y + (e.h - ih) / 2;
            doc.setLineWidth(0.9); doc.rect(e.x, e.y, e.w, e.h, 'S');
            doc.setLineWidth(0.7); doc.rect(ix, iy, iw, ih, 'S');
            if (e.marcado) {
              doc.setLineWidth(1.35);
              doc.setLineCap('round'); doc.setLineJoin('round');
              doc.lines([[1.9, 2.2], [3.8, -5.0]], ix + 1.6, iy + 4.6);
              doc.setLineCap('butt');  doc.setLineJoin('miter');
            }
            break;
          }
        }
      });
    });

    if (soloDevolver) { cargando(false); return doc; }

    const nombre = nombreArchivo(o, 'pdf');
    doc.save(nombre);
    cargando(false);
    aviso(`PDF generado: ${nombre}`, 'ok', 5000);
    return doc;

  } catch (err) {
    cargando(false);
    console.error('Error al generar el PDF:', err);
    aviso('Ocurrió un error al generar el PDF: ' + (err && err.message ? err.message : err), 'err', 8000);
    return null;
  }
}


/* ==========================================================================
   ▓▓▓ BLOQUE 8 — EXPORTACIÓN A EXCEL (.xlsx con ExcelJS) ▓▓▓
   --------------------------------------------------------------------------
   Se reproduce la retícula del formato modelo con una malla de 15 columnas
   cuyos límites coinciden con los del documento original, más las alturas de
   fila, combinaciones, bordes, tipografía, logotipo y configuración de
   impresión (A4 vertical con los márgenes del modelo).

   Límites de columna medidos sobre el PDF modelo (en puntos):
     A 36,5 | B 76,42 | C 96,2  | D 154,77 | E 175,16 | F 194,6  | G 273,3
     H 288,65 | I 312,18 | J 332,57 | K 371,7 | L 430,59 | M 469,59
     N 489,62 | O 537,73 | fin 557,9

   Se añade una hoja «Datos» con la misma información en formato tabular,
   pensada para consolidar varias órdenes en un solo libro.
   ========================================================================== */

/* Anchos en «caracteres» de Excel (px = redondeo(car·7 + 5); 1 pt = 4/3 px) */
const XLS_ANCHOS = [6.89, 3.05, 10.44, 3.17, 2.99, 14.28, 2.21, 3.77,
                    3.17, 6.74, 10.50, 6.71, 3.10, 8.45, 3.13];
const XLS_NCOL = 15;                                     // A … O

/* Límites de las 15 columnas en puntos (16 valores: inicio de A … fin de O) */
const XLS_LIMITES = [36.5, 76.42, 96.2, 154.77, 175.16, 194.6, 273.3, 288.65,
                     312.18, 332.57, 371.7, 430.59, 469.59, 489.62, 537.73, 557.9];

/** Convierte una coordenada X en puntos a { col, frac } para anclar imágenes. */
function anclaX(xPt) {
  for (let c = 0; c < XLS_LIMITES.length - 1; c++) {
    if (xPt < XLS_LIMITES[c + 1] || c === XLS_LIMITES.length - 2) {
      const ancho = XLS_LIMITES[c + 1] - XLS_LIMITES[c];
      return c + Math.max(0, Math.min(0.999, (xPt - XLS_LIMITES[c]) / ancho));
    }
  }
  return 0;
}

/* Alturas de fila en puntos (suman 720,4 pt < 725,4 pt útiles de un A4) */
const XLS_ALTOS = {
  logo: 50.3, hueco1: 6.4, titulo: 23.0, orden: 22.3, zona: 19.3, origen: 17.7,
  hueco2: 4.0, hdr: 16.0, fila1: 25.6, fila: 15.4, filaUlt: 15.4,
  motLbl: 16.6, mot1: 16.8, mot2: 16.5, mot3: 16.8,
  espFirma: 45.0, rol: 13.0, nombre: 13.5, cedula: 15.4,
  vigTit: 15.7, empresa: 17.0, espVig: 36.0, vigNom: 15.5, vigCed: 14.0,
  cod: 12.0, ed: 10.2
};

const FUENTE_XLS = 'Calibri';
const B_MED = { style: 'medium' }, B_FIN = { style: 'thin' }, B_DBL = { style: 'double' };

/** Aplica valor, fuente, alineación y bordes a una celda (opcionalmente combinada). */
function celda(ws, ref, valor, opt) {
  opt = opt || {};
  if (opt.merge) ws.mergeCells(opt.merge);
  const c = ws.getCell(ref);
  if (valor !== undefined && valor !== null) c.value = valor;
  c.font = { name: FUENTE_XLS, size: opt.size || 11, bold: !!opt.bold };
  c.alignment = {
    horizontal: opt.h || 'left', vertical: opt.v || 'middle',
    wrapText: !!opt.wrap, indent: opt.indent || 0
  };
  if (opt.borde) c.border = Object.assign({}, c.border, opt.borde);
  return c;
}

/** Añade (sin borrar los existentes) los mismos bordes a todo un rango. */
function bordeRango(ws, r1, c1, r2, c2, borde) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      cell.border = Object.assign({}, cell.border, borde);
    }
}

/** Subrayado de campo: borde inferior fino a lo largo de un rango. */
function subrayar(ws, fila, c1, c2, estilo) {
  bordeRango(ws, fila, c1, fila, c2, { bottom: estilo || B_FIN });
}

/** Bordes izquierdo y derecho del marco exterior en una fila. */
function marcoFila(ws, r) {
  const a = ws.getCell(r, 1), z = ws.getCell(r, XLS_NCOL);
  a.border = Object.assign({}, a.border, { left: B_MED });
  z.border = Object.assign({}, z.border, { right: B_MED });
}

/* ------------------------------ Exportación ---------------------------- */

function exportarExcel(ordenOpcional) {
  // 1) Validación previa del formulario.
  const o = ordenOpcional || leerOrden();
  if (!ordenOpcional) {
    const v = validar();
    if (!v.ok) { mostrarErrores(v.errores); return; }
  }

  // 2) Disponibilidad de ExcelJS.
  const ExcelJSLib = LIBS.exceljs;
  if (!ExcelJSLib) {
    aviso('La librería de Excel (ExcelJS) no está disponible. Verifique su conexión a internet y recargue la página.', 'err', 8000);
    return;
  }

  cargando(true, 'Generando el archivo de Excel…');

  try {
    const wb = new ExcelJSLib.Workbook();
    wb.creator = o.autorizado.nombre;
    wb.created = new Date();
    wb.title   = `Orden de ${o.tipo.toLowerCase()} N.º ${o.numero}`;

    // Ojo: addImage devuelve 0 para la primera imagen → comparar con null
    let idLogo = null;
    if (CONFIG.logo) {
      try { idLogo = wb.addImage({ base64: CONFIG.logo.split(',')[1], extension: 'png' }); }
      catch (e) { console.warn('No se pudo incrustar el logotipo en Excel:', e); idLogo = null; }
    }

    const porPagina = CONFIG.filasTablaPagina;
    const nPag = Math.max(1, Math.ceil((o.items.length || 1) / porPagina));
    for (let p = 0; p < nPag; p++) hojaOrden(wb, o, p, nPag, idLogo);
    hojaDatos(wb, o);

    wb.xlsx.writeBuffer().then(buf => {
      const nombre = nombreArchivo(o, 'xlsx');
      LIBS.descargar(new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), nombre);
      cargando(false);
      aviso(`Archivo de Excel generado: ${nombre}`, 'ok', 5000);
    }).catch(err => {
      cargando(false);
      console.error('Error al escribir el libro:', err);
      aviso('Ocurrió un error al escribir el archivo de Excel: ' + err.message, 'err', 8000);
    });

  } catch (err) {
    cargando(false);
    console.error('Error al generar el Excel:', err);
    aviso('Ocurrió un error al generar el archivo de Excel: ' + (err && err.message ? err.message : err), 'err', 8000);
  }
}

/* ------------------- Hoja con la réplica del formato ------------------- */

function hojaOrden(wb, o, p, nPag, idLogo) {
  const ws = wb.addWorksheet(nPag > 1 ? `Orden ${p + 1}` : 'Orden', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,                                   // A4
      orientation: 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.507, right: 0.520, top: 0.800, bottom: 0.818, header: 0, footer: 0 }
    }
  });

  ws.columns = XLS_ANCHOS.map(w => ({ width: w }));
  const A = XLS_ALTOS, NC = XLS_NCOL;
  const items = o.items.slice(p * CONFIG.filasTablaPagina, (p + 1) * CONFIG.filasTablaPagina);

  /* ---------- Fila 1 · banda del logotipo ---------- */
  ws.getRow(1).height = A.logo;
  celda(ws, 'A1', null, { merge: `A1:O1` });
  bordeRango(ws, 1, 1, 1, NC, { top: B_MED, bottom: B_MED });
  marcoFila(ws, 1);
  if (idLogo !== null && idLogo !== undefined) {
    ws.addImage(idLogo, {
      tl: { col: anclaX(GEO.logo.x), row: (GEO.logo.y - GEO.caja.t + 1.9) / A.logo },
      ext: { width: 60.3 * 4 / 3, height: 35.0 * 4 / 3 },
      editAs: 'oneCell'
    });
  }

  /* ---------- Fila 2 · hueco ---------- */
  ws.getRow(2).height = A.hueco1;
  celda(ws, 'A2', null, { merge: 'A2:O2' });
  marcoFila(ws, 2);

  /* ---------- Fila 3 · título ---------- */
  ws.getRow(3).height = A.titulo;
  celda(ws, 'A3', CONFIG.documento.titulo, { merge: 'A3:O3', size: 18, bold: true, h: 'center' });
  bordeRango(ws, 3, 1, 3, NC, { top: B_DBL, bottom: B_DBL });
  marcoFila(ws, 3);

  /* ---------- Fila 4 · ORDEN DE / casillas / No. ---------- */
  const cajaFina = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
  ws.getRow(4).height = A.orden;
  celda(ws, 'A4', 'ORDEN DE:', { bold: true });        // desborda sobre B (vacía)
  celda(ws, 'C4', 'ENTRADA', { h: 'right' });
  celda(ws, 'D4', o.tipo === 'ENTRADA' ? 'X' : '', { h: 'center', bold: true, borde: cajaFina });
  celda(ws, 'H4', 'SALIDA', { h: 'right' });           // desborda sobre G (vacía)
  celda(ws, 'I4', o.tipo === 'SALIDA' ? 'X' : '', { h: 'center', bold: true, borde: cajaFina });
  celda(ws, 'L4', 'No.', { bold: true, h: 'right' });
  celda(ws, 'M4', o.numero, { merge: 'M4:N4', bold: true, size: 12, h: 'center', borde: cajaFina });
  marcoFila(ws, 4);

  /* ---------- Fila 5 · ZONA / FECHA / HORA ---------- */
  ws.getRow(5).height = A.zona;
  celda(ws, 'A5', 'ZONA:', { bold: true });
  celda(ws, 'B5', o.zona, { merge: 'B5:F5', indent: 1 });
  celda(ws, 'G5', 'FECHA:', { merge: 'G5:I5', bold: true, h: 'right' });
  celda(ws, 'J5', o.fecha, { merge: 'J5:K5', h: 'center' });
  celda(ws, 'L5', 'HORA:', { bold: true, h: 'right' });
  celda(ws, 'M5', o.hora, { merge: 'M5:N5', h: 'center' });
  subrayar(ws, 5, 2, 6); subrayar(ws, 5, 10, 11); subrayar(ws, 5, 13, 14);
  marcoFila(ws, 5);

  /* ---------- Fila 6 · ORIGEN / DESTINO ---------- */
  ws.getRow(6).height = A.origen;
  celda(ws, 'A6', 'ORIGEN:', { bold: true });
  celda(ws, 'C6', o.origen, { merge: 'C6:F6', indent: 1 });
  celda(ws, 'G6', 'DESTINO:', { merge: 'G6:I6', bold: true, h: 'right' });
  celda(ws, 'J6', o.destino, { merge: 'J6:N6', indent: 1 });
  subrayar(ws, 6, 2, 6); subrayar(ws, 6, 10, 14);
  marcoFila(ws, 6);

  /* ---------- Fila 7 · hueco previo a la tabla ---------- */
  ws.getRow(7).height = A.hueco2;
  celda(ws, 'A7', null, { merge: 'A7:O7' });
  bordeRango(ws, 7, 1, 7, NC, { bottom: B_MED });
  marcoFila(ws, 7);

  /* ---------- Fila 8 · encabezado de la tabla ---------- */
  const bH = { top: B_MED, bottom: B_MED, left: B_MED, right: B_MED };
  ws.getRow(8).height = A.hdr;
  celda(ws, 'A8', 'ITEM', { h: 'center', bold: true, borde: bH });
  celda(ws, 'B8', 'DESCRIPCION DEL(OS) MATERIAL(ES)', { merge: 'B8:K8', h: 'center', bold: true, borde: bH });
  celda(ws, 'L8', 'UNIDAD',   { merge: 'L8:M8', h: 'center', bold: true, borde: bH });
  celda(ws, 'N8', 'CANTIDAD', { merge: 'N8:O8', h: 'center', bold: true, borde: bH });
  bordeRango(ws, 8, 1, 8, NC, { top: B_MED, bottom: B_MED });

  /* ---------- Filas 9…26 · cuerpo de la tabla (18 filas, como el modelo) ---------- */
  const F0 = 9, NF = CONFIG.filasTablaPagina;
  for (let i = 0; i < NF; i++) {
    const r = F0 + i;
    ws.getRow(r).height = i === 0 ? A.fila1 : (i === NF - 1 ? A.filaUlt : A.fila);
    const it = items[i];
    const b = { top: i === 0 ? B_MED : B_FIN, bottom: i === NF - 1 ? B_MED : B_FIN, left: B_MED, right: B_MED };

    celda(ws, `A${r}`, it ? (p * NF + i + 1) : null, { h: 'center', borde: b });
    ws.mergeCells(`B${r}:K${r}`);
    celda(ws, `B${r}`, it ? (it.codigo ? it.codigo + ' · ' : '') + it.descripcion : null, { indent: 1, borde: b });
    ws.mergeCells(`L${r}:M${r}`);
    celda(ws, `L${r}`, it ? (it.unidad || '') : null, { h: 'center', borde: b });
    ws.mergeCells(`N${r}:O${r}`);
    const cc = celda(ws, `N${r}`, it ? Number(it.cantidad) : null, { h: 'center', borde: b });
    if (it) cc.numFmt = Number.isInteger(Number(it.cantidad)) ? '0' : '0.###';

    // Filetes verticales internos de la tabla (columnas de la retícula)
    [[11, 'right'], [12, 'left'], [13, 'right'], [14, 'left']].forEach(([c, lado]) => {
      const cell = ws.getCell(r, c);
      cell.border = Object.assign({}, cell.border, { [lado]: B_MED });
    });
  }

  /* ---------- Motivo y nota ---------- */
  let r = F0 + NF;
  const bFila = { left: B_MED, right: B_MED, bottom: B_FIN };
  ws.getRow(r).height = A.motLbl;
  celda(ws, `A${r}`, 'Motivo Entrada y/o Salida de Materiales:', { merge: `A${r}:O${r}`, bold: true });
  bordeRango(ws, r, 1, r, NC, bFila);

  const anchoMotPt = GEO.caja.r - GEO.motivo.x - 4;
  const renglones = [];
  partirTexto(o.motivo || '', anchoMotPt, 10.6, false).forEach(l => renglones.push(l));
  if (o.nota) partirTexto('Nota: ' + o.nota, anchoMotPt, 10.6, false).forEach(l => renglones.push(l));

  [A.mot1, A.mot2, A.mot3].forEach((alto, i) => {
    r++;
    ws.getRow(r).height = alto;
    celda(ws, `A${r}`, renglones[i] || null, { merge: `A${r}:O${r}` });
    bordeRango(ws, r, 1, r, NC, i === 2 ? { left: B_MED, right: B_MED, bottom: B_MED } : bFila);
  });

  /* ---------- Espacio para las firmas manuscritas ---------- */
  const cols3 = [['A', 'E'], ['F', 'J'], ['K', 'O']];   // 36,5–194,6 | 194,6–371,7 | 371,7–557,9
  r++;
  const filaFirmas = r;
  ws.getRow(r).height = A.espFirma;
  cols3.forEach(([c1, c2]) => celda(ws, `${c1}${r}`, null, { merge: `${c1}${r}:${c2}${r}` }));
  bordeRango(ws, r, 1, r, NC, { bottom: B_FIN });
  marcoFila(ws, r);

  /* ---------- Rol / Nombre / Cédula ---------- */
  const pers = [
    ['AUTORIZADO POR:', o.autorizado],
    ['ENTREGADO POR:',  o.entregado],
    ['RECIBIDO POR:',   o.recibido]
  ];

  /* Firmas digitalizadas sobre la línea de firma, con la misma geometría del PDF */
  if (o.conFirmas !== false) {
    const M = GEO.firmas.imagen;
    pers.forEach((pe, i) => {
      const fir = firmaDe(pe[1] && pe[1].cedula);
      if (!fir) return;
      let id;
      try { id = wb.addImage({ base64: fir.src.split(',')[1], extension: 'png' }); }
      catch (e) { console.warn('No se pudo incrustar la firma en Excel:', e); return; }
      const c = cajaFirma(fir, i);          // misma geometría que la vista previa y el PDF
      ws.addImage(id, {
        tl: { col: anclaX(c.x), row: (filaFirmas - 1) + (A.espFirma - M.margenInf - c.h) / A.espFirma },
        ext: { width: c.w * 4 / 3, height: c.h * 4 / 3 },
        editAs: 'oneCell'
      });
    });
  }

  r++;
  ws.getRow(r).height = A.rol;
  cols3.forEach(([c1, c2], i) => celda(ws, `${c1}${r}`, pers[i][0], { merge: `${c1}${r}:${c2}${r}` }));
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.nombre;
  cols3.forEach(([c1, c2], i) =>
    celda(ws, `${c1}${r}`, 'NOMBRE:  ' + (pers[i][1].nombre || ''), { merge: `${c1}${r}:${c2}${r}` }));
  bordeRango(ws, r, 1, r, NC, { bottom: B_MED });
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.cedula;
  cols3.forEach(([c1, c2], i) =>
    celda(ws, `${c1}${r}`, 'CÉDULA:  ' + (pers[i][1].cedula || ''), { merge: `${c1}${r}:${c2}${r}` }));
  bordeRango(ws, r, 1, r, NC, { bottom: B_MED });
  marcoFila(ws, r);

  /* ---------- Control de vigilancia (portería) ---------- */
  r++;
  ws.getRow(r).height = A.vigTit;
  celda(ws, `A${r}`, 'CONTROL DE VIGILANCIA (PORTERIA)', { merge: `A${r}:O${r}`, bold: true });
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.empresa;
  celda(ws, `A${r}`, 'EMPRESA:', {});                   // desborda sobre B (vacía)
  celda(ws, `C${r}`, o.empresaVig || '', { merge: `C${r}:H${r}`, h: 'center' });
  subrayar(ws, r, 3, 8);
  marcoFila(ws, r);

  r++;                                                  // espacio de firma en portería
  ws.getRow(r).height = A.espVig;
  celda(ws, `A${r}`, null, { merge: `A${r}:E${r}` });
  subrayar(ws, r, 1, 5);
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.vigNom;
  celda(ws, `A${r}`, 'NOMBRE:', { merge: `A${r}:O${r}` });
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.vigCed;
  celda(ws, `A${r}`, 'CÉDULA:', { merge: `A${r}:O${r}` });
  marcoFila(ws, r);

  /* ---------- Pie ---------- */
  r++;
  ws.getRow(r).height = A.cod;
  celda(ws, `A${r}`, nPag > 1 ? `Página ${p + 1} de ${nPag}` : null, { merge: `A${r}:F${r}`, size: 8 });
  celda(ws, `G${r}`, CONFIG.documento.codigo, { merge: `G${r}:O${r}`, size: 10, h: 'right' });
  marcoFila(ws, r);

  r++;
  ws.getRow(r).height = A.ed;
  celda(ws, `A${r}`, CONFIG.documento.edicion, { merge: `A${r}:O${r}`, size: 10, h: 'right' });
  bordeRango(ws, r, 1, r, NC, { bottom: B_MED });
  marcoFila(ws, r);

  ws.pageSetup.printArea = `A1:O${r}`;
  return ws;
}

/* -------------------- Hoja «Datos» (formato tabular) ------------------- */

function hojaDatos(wb, o) {
  const ws = wb.addWorksheet('Datos', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const cab = ['Tipo de orden', 'No. de orden', 'Zona', 'Fecha', 'Hora', 'Origen', 'Destino',
    'Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Motivo', 'Nota',
    'Autorizado por', 'Cédula autoriza', 'Entregado por', 'Cédula entrega',
    'Recibido por', 'Cédula recibe', 'Empresa vigilancia'];
  const anchos = [13, 14, 12, 11, 7, 22, 22, 6, 34, 8, 9, 38, 32, 18, 15, 18, 15, 18, 15, 18];

  ws.columns = cab.map((t, i) => ({ header: t, key: 'k' + i, width: anchos[i] }));

  ws.getRow(1).height = 30;
  ws.getRow(1).eachCell(c => {
    c.font = { name: FUENTE_XLS, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006FB7' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
  });

  o.items.forEach((it, i) => {
    const fila = ws.addRow([
      o.tipo, o.numero, o.zona, o.fecha, o.hora, o.origen, o.destino,
      i + 1, it.descripcion, it.unidad || '', Number(it.cantidad),
      o.motivo, o.nota || '',
      o.autorizado.nombre, o.autorizado.cedula,
      o.entregado.nombre, o.entregado.cedula,
      o.recibido.nombre, o.recibido.cedula, o.empresaVig || ''
    ]);
    fila.eachCell(c => {
      c.font = { name: FUENTE_XLS, size: 10 };
      c.alignment = { vertical: 'top', wrapText: true };
      c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };
  return ws;
}


/* ==========================================================================
   ▓▓▓ BLOQUE 9 — IMPORTACIÓN DE LISTAS DESDE EXCEL / CSV (SheetJS) ▓▓▓
   --------------------------------------------------------------------------
   ESTRUCTURA ESPERADA DEL ARCHIVO (la del archivo OrigenDestino.xlsx):

     Hoja «Origen_Destino»     Hoja «Accesorios»
     ┌────────────────────┐    ┌──────────────────────────────┬─────────┐
     │ ORIGEN/DESTINO     │    │ Ítem                         │ Unidad  │
     ├────────────────────┤    ├──────────────────────────────┼─────────┤
     │ BOSQUE             │    │ Suministro de radiadores     │ UND     │
     │ SINCELEJO PLANTA   │    │ Motoventiladores Tipo 1      │ UND     │
     └────────────────────┘    └──────────────────────────────┴─────────┘

   También se aceptan encabezados llamados: Origen, Destino, Descripción,
   Material, Código, Referencia y Unidad, en cualquier hoja y en cualquier
   orden de columnas.
   ========================================================================== */

const ENCABEZADOS = {
  origenDestino: ['origen/destino', 'origen-destino', 'origendestino', 'origen destino',
                  'sede', 'subestacion', 'subestación', 'sitio', 'ubicacion', 'ubicación'],
  origen:      ['origen'],
  destino:     ['destino'],
  descripcion: ['descripcion', 'descripción', 'descripcion del material', 'item', 'ítem',
                'material', 'materiales', 'accesorio', 'accesorios', 'elemento'],
  // «DESCRIPCIÓN SEGÚN CREG 015-2018» y similares se reconocen por prefijo
  unidad:      ['unidad', 'und', 'un', 'u.m.', 'um', 'unidad de medida', 'unidad medida'],
  codigo:      ['codigo', 'código', 'cod', 'cod.', 'uc', 'u.c.'],
  referencia:  ['referencia', 'ref', 'ref.']
};

function rolDeEncabezado(txt) {
  const n = norm(txt);
  if (!n) return null;
  const plano = x => x.replace(/[.\s]/g, '');
  for (const rol of Object.keys(ENCABEZADOS)) {
    if (ENCABEZADOS[rol].some(h => n === h || plano(n) === plano(h))) return rol;
  }
  // Encabezados largos del tipo «DESCRIPCIÓN SEGÚN CREG 015-2018»
  if (n.startsWith('descripcion')) return 'descripcion';
  return null;
}

/** Grupo del desplegable según el nombre de la hoja. */
function grupoDeHoja(nombreHoja) {
  const n = norm(nombreHoja);
  if (/transformador/.test(n)) return 'Transformadores · UC CREG 015-2018';
  if (/accesorio|material|item/.test(n)) return 'Accesorios';
  return '';
}

/** Convierte una hoja SheetJS a matriz y localiza la fila de encabezados. */
function analizarHoja(libro, nombreHoja) {
  const hoja = libro.Sheets[nombreHoja];
  if (!hoja) return null;
  const filas = LIBS.xlsx.utils.sheet_to_json(hoja, { header: 1, blankrows: false, defval: '' });
  if (!filas.length) return null;

  let iCab = -1, roles = null;
  for (let i = 0; i < Math.min(8, filas.length); i++) {
    const r = (filas[i] || []).map(rolDeEncabezado);
    if (r.some(Boolean)) { iCab = i; roles = r; break; }
  }
  return { filas, iCab, roles, nombreHoja };
}

/** Extrae listas de una hoja ya analizada. */
function extraerDeHoja(an) {
  const res = { origenDestino: [], materiales: [], detalle: [] };
  if (!an) return res;

  const { filas, iCab, roles, nombreHoja } = an;
  const nHoja = norm(nombreHoja);

  /* Caso 1: hay encabezados reconocidos */
  if (iCab >= 0 && roles) {
    const idx = {};
    roles.forEach((rol, c) => { if (rol && idx[rol] === undefined) idx[rol] = c; });
    const cOD = idx.origenDestino, cOr = idx.origen, cDe = idx.destino;
    const cDesc = idx.descripcion, cUn = idx.unidad, cCod = idx.codigo, cRef = idx.referencia;

    for (let i = iCab + 1; i < filas.length; i++) {
      const f = filas[i] || [];
      [cOD, cOr, cDe].forEach(c => {
        if (c !== undefined && f[c] != null && String(f[c]).trim()) res.origenDestino.push(String(f[c]).trim());
      });
      if (cDesc !== undefined && f[cDesc] != null && String(f[cDesc]).trim()) {
        res.materiales.push({
          descripcion: String(f[cDesc]).trim(),
          unidad:      cUn  !== undefined && f[cUn]  != null ? String(f[cUn]).trim()  : 'UND',
          codigo:      cCod !== undefined && f[cCod] != null ? String(f[cCod]).trim() : '',
          referencia:  cRef !== undefined && f[cRef] != null ? String(f[cRef]).trim() : '',
          grupo:       grupoDeHoja(nombreHoja)
        });
      }
    }
    const nombres = roles.map((r, c) => r ? `«${filas[iCab][c]}» → ${r}` : null).filter(Boolean);
    res.detalle.push(`Hoja «${nombreHoja}»: ${nombres.join(', ')}`);
    return res;
  }

  /* Caso 2: sin encabezados reconocidos, pero el nombre de la hoja lo indica */
  const esOD  = /origen|destino|sede|subestac/.test(nHoja);
  const esMat = /accesorio|material|item|descrip|transformador/.test(nHoja);
  if (esOD || esMat) {
    for (let i = 1; i < filas.length; i++) {                 // se salta la fila 1 (título)
      const f = filas[i] || [];
      const v = f[0] != null ? String(f[0]).trim() : '';
      if (!v) continue;
      if (esOD) res.origenDestino.push(v);
      else res.materiales.push({ descripcion: v, unidad: f[1] != null ? String(f[1]).trim() : 'UND',
                                 codigo: '', referencia: '', grupo: grupoDeHoja(nombreHoja) });
    }
    res.detalle.push(`Hoja «${nombreHoja}»: se usó la primera columna (nombre de hoja reconocido).`);
  }
  return res;
}

/** Quita duplicados conservando el primer registro. */
function deduplicar(res) {
  const vistosOD = new Set(), od = [];
  res.origenDestino.forEach(v => { const k = norm(v); if (k && !vistosOD.has(k)) { vistosOD.add(k); od.push(v); } });

  const vistosM = new Set(), mat = [];
  res.materiales.forEach(m => {
    const k = norm(m.grupo) + '|' + norm(m.descripcion) + '|' + norm(m.unidad);
    if (norm(m.descripcion) && !vistosM.has(k)) { vistosM.add(k); mat.push(m); }
  });

  return { origenDestino: od.sort((a, b) => a.localeCompare(b, 'es')), materiales: mat, detalle: res.detalle };
}

function mostrarAvisoImport(clase, html) {
  const el = $('#avisoImport');
  el.className = 'oms-aviso ver' + clase;
  el.innerHTML = html;
}

/** Procesa un archivo seleccionado por el usuario. */
function procesarArchivo(file) {
  if (!file) return;
  if (!LIBS.xlsx) {
    mostrarAvisoImport('err', '<b>No se puede leer el archivo.</b> La librería de lectura (SheetJS) no está disponible. Verifique su conexión a internet y recargue la página.');
    return;
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['xlsx', 'xls', 'csv', 'txt'].includes(ext)) {
    mostrarAvisoImport('err', `<b>Formato no admitido.</b> El archivo «${esc(file.name)}» no es un libro de Excel (.xlsx, .xls) ni un archivo CSV.`);
    return;
  }

  cargando(true, 'Leyendo el archivo…');
  const lector = new FileReader();

  lector.onerror = () => {
    cargando(false);
    mostrarAvisoImport('err', '<b>No se pudo leer el archivo.</b> Compruebe que no esté abierto en otro programa y vuelva a intentarlo.');
  };

  lector.onload = ev => {
    try {
      const libro = LIBS.xlsx.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: false });
      estado.libroImportado = libro;

      // 1) Intento automático sobre todas las hojas
      let acum = { origenDestino: [], materiales: [], detalle: [] };
      libro.SheetNames.forEach(n => {
        const r = extraerDeHoja(analizarHoja(libro, n));
        acum.origenDestino.push(...r.origenDestino);
        acum.materiales.push(...r.materiales);
        acum.detalle.push(...r.detalle);
      });
      const res = deduplicar(acum);

      if (res.origenDestino.length || res.materiales.length) {
        aplicarListas(res, file.name);
        $('#selHojaWrap').hidden = true;
      } else {
        // 2) No se reconoció nada: se ofrece elegir la hoja manualmente
        const sel = $('#selHoja');
        sel.innerHTML = libro.SheetNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        $('#selHojaWrap').hidden = false;
        mostrarAvisoImport('warn',
          `<b>No se reconoció la estructura del archivo «${esc(file.name)}».</b>` +
          `<br>Seleccione abajo la hoja que contiene las listas y pulse «Cargar hoja seleccionada».` +
          `<br>Se esperan columnas con alguno de estos encabezados: ` +
          `<b>Origen/Destino, Origen, Destino, Descripción, Ítem, Material, Código, Referencia, Unidad</b>.`);
      }
    } catch (err) {
      console.error('Error al procesar el archivo:', err);
      mostrarAvisoImport('err', `<b>El archivo no se pudo interpretar.</b> ${esc(err.message || err)}`);
    } finally {
      cargando(false);
    }
  };

  lector.readAsArrayBuffer(file);
}

/** Carga la hoja elegida manualmente en el selector. */
function cargarHojaElegida() {
  if (!estado.libroImportado) return;
  const nombre = $('#selHoja').value;
  const an = analizarHoja(estado.libroImportado, nombre);
  if (!an) { mostrarAvisoImport('err', 'La hoja seleccionada está vacía.'); return; }

  // Se fuerza la lectura de la hoja aunque el nombre no sea reconocible
  let res = extraerDeHoja(an);
  if (!res.origenDestino.length && !res.materiales.length) {
    const { filas } = an;
    const inicio = an.iCab >= 0 ? an.iCab + 1 : 1;
    for (let i = inicio; i < filas.length; i++) {
      const f = filas[i] || [];
      const v = f[0] != null ? String(f[0]).trim() : '';
      if (!v) continue;
      const u = f[1] != null ? String(f[1]).trim() : '';
      // Si la segunda columna parece una unidad, se interpreta como material
      if (u && u.length <= 6) res.materiales.push({ descripcion: v, unidad: u, codigo: '', referencia: '', grupo: grupoDeHoja(nombre) });
      else res.origenDestino.push(v);
    }
    res.detalle.push(`Hoja «${nombre}»: lectura manual de las dos primeras columnas.`);
  }

  res = deduplicar(res);
  if (!res.origenDestino.length && !res.materiales.length) {
    mostrarAvisoImport('err', `<b>La hoja «${esc(nombre)}» no contiene datos utilizables.</b> Revise que la primera columna tenga los valores de la lista.`);
    return;
  }
  aplicarListas(res, `hoja «${nombre}»`);
}

/** Sustituye las listas activas y guarda en localStorage. */
function aplicarListas(res, fuente) {
  if (res.origenDestino.length) { estado.listas.origenDestino = res.origenDestino; estado.listas.fuenteOD = fuente; }
  if (res.materiales.length)    { estado.listas.materiales    = res.materiales;    estado.listas.fuenteMat = fuente; }

  refrescarListas();
  LS.escribir(LS.LISTAS, estado.listas);

  mostrarAvisoImport('ok',
    `<b>Listas cargadas correctamente desde ${esc(fuente)}.</b>` +
    `<ul>` +
    (res.origenDestino.length ? `<li>Origen / Destino: <b>${res.origenDestino.length}</b> registros únicos.</li>` : '') +
    (res.materiales.length ? `<li>Descripción de materiales: <b>${res.materiales.length}</b> registros únicos` +
        (() => {
          const g = new Map();
          res.materiales.forEach(m => g.set(m.grupo || 'sin grupo', (g.get(m.grupo || 'sin grupo') || 0) + 1));
          return g.size > 1 ? ' (' + Array.from(g).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ') + ')' : '';
        })() + '.</li>' : '') +
    (res.detalle.length ? `<li>${res.detalle.map(esc).join('</li><li>')}</li>` : '') +
    `</ul>`);
  aviso('Listas actualizadas.', 'ok');
}

function restaurarListas() {
  if (!confirm('¿Desea restaurar las listas precargadas en el código y descartar las importadas?')) return;
  estado.listas = {
    origenDestino: CONFIG.origenDestino.slice(),
    materiales:    CONFIG.materiales.slice(),
    fuenteOD: 'precargado', fuenteMat: 'precargado'
  };
  LS.borrar(LS.LISTAS);
  refrescarListas();
  $('#selHojaWrap').hidden = true;
  mostrarAvisoImport('ok', '<b>Se restauraron las listas precargadas.</b>');
  aviso('Listas precargadas restauradas.', 'ok');
}

/** Genera un libro de ejemplo con la estructura esperada. */
function descargarPlantilla() {
  if (!LIBS.exceljs) { aviso('La librería de Excel no está disponible.', 'err'); return; }
  cargando(true, 'Generando la plantilla…');
  try {
    const wb = new LIBS.exceljs.Workbook();

    const h1 = wb.addWorksheet('Origen_Destino');
    h1.columns = [{ header: 'ORIGEN/DESTINO', key: 'v', width: 42 }];
    estado.listas.origenDestino.forEach(v => h1.addRow([v]));

    const esTrafo = m => /transformador/i.test(m.grupo || '');

    const h2 = wb.addWorksheet('Accesorios');
    h2.columns = [
      { header: 'Ítem',   key: 'd', width: 46 },
      { header: 'Unidad', key: 'u', width: 12 },
      { header: 'Código', key: 'c', width: 16 }
    ];
    estado.listas.materiales.filter(m => !esTrafo(m))
      .forEach(m => h2.addRow([m.descripcion, m.unidad || '', m.codigo || '']));

    const h3 = wb.addWorksheet('Transformadores');
    h3.columns = [
      { header: 'UC',          key: 'uc', width: 10 },
      { header: 'DESCRIPCIÓN SEGÚN CREG 015-2018', key: 'd', width: 70 },
      { header: 'NIVEL DE TENSIÓN', key: 'n', width: 26 },
      { header: 'TIPO',        key: 't', width: 18 },
      { header: 'CAMBIADOR',   key: 'c', width: 14 }
    ];
    estado.listas.materiales.filter(esTrafo)
      .forEach(m => h3.addRow([m.codigo || '', m.descripcion, m.nivel || '', m.tipo || '', m.cambiador || '']));

    [h1, h2, h3].forEach(h => {
      h.getRow(1).eachCell(c => {
        c.font = { name: FUENTE_XLS, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006FB7' } };
        c.alignment = { horizontal: 'center' };
      });
      h.views = [{ state: 'frozen', ySplit: 1 }];
    });

    wb.xlsx.writeBuffer().then(buf => {
      LIBS.descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'Plantilla_Listas_Origen_Destino_Accesorios.xlsx');
      cargando(false);
      aviso('Plantilla descargada. Edítela y vuelva a importarla.', 'ok');
    });
  } catch (err) {
    cargando(false);
    console.error(err);
    aviso('No se pudo generar la plantilla: ' + err.message, 'err');
  }
}


/* ==========================================================================
   ▓▓▓ BLOQUE 11 — ALMACENAMIENTO Y RESPALDO ▓▓▓
   --------------------------------------------------------------------------
   Tres capas de persistencia, de menor a mayor robustez:

   1. localStorage (SIEMPRE ACTIVO, todos los navegadores)
      Guarda automáticamente borrador, listas e histórico. Los datos viven
      DENTRO DEL NAVEGADOR, no dentro del archivo HTML: si se borran los
      datos de navegación, se cambia de navegador o de equipo, se pierden.

   2. ARCHIVO DE DATOS VINCULADO (Chrome y Edge)
      El usuario elige una vez un archivo .json —en su disco o en una carpeta
      de red— y a partir de ahí cada «Guardar orden» lo escribe también allí.
      Los datos pasan a vivir en un archivo real que él controla, respalda y
      puede compartir. Antes de escribir se RELEE y FUSIONA, de modo que si
      dos personas usan el mismo archivo en una carpeta compartida ninguna
      borra el trabajo de la otra.

   3. COPIA DE SEGURIDAD MANUAL (.json) — todos los navegadores
      Exportar / restaurar a voluntad. Al restaurar también fusiona.

   La fusión usa como llave «TIPO|NÚMERO» y conserva la versión guardada más
   recientemente (campo `guardadaEn`).
   ========================================================================== */

const DATOS = {

  FORMATO: 'ordenes-ssee',
  VERSION: 1,
  DB: 'ssee.orden.fs', ALMACEN: 'handles', LLAVE: 'archivoDatos',

  handle: null,          // FileSystemFileHandle del archivo vinculado
  nombreArchivo: '',
  ultimaEscritura: null,
  permisoActual: null,   // 'granted' | 'prompt' | 'denied' — estado real, para no mentir en el panel
  recordado: true,       // false si el navegador no pudo memorizar el vínculo

  /** ¿El navegador admite vincular un archivo real? (Chrome / Edge) */
  get soportado() {
    return typeof window.showSaveFilePicker === 'function' &&
           typeof window.indexedDB === 'object' && window.isSecureContext;
  },

  /* ------------------- IndexedDB: guardar el handle -------------------- */

  _db() {
    return new Promise((res, rej) => {
      const s = indexedDB.open(this.DB, 1);
      s.onupgradeneeded = () => s.result.createObjectStore(this.ALMACEN);
      s.onsuccess = () => res(s.result);
      s.onerror  = () => rej(s.error);
    });
  },

  /** Guarda el handle. Devuelve true solo si de verdad quedó almacenado. */
  async _guardarHandle(h) {
    try {
      const db = await this._db();
      await new Promise((res, rej) => {
        const t = db.transaction(this.ALMACEN, 'readwrite');
        t.objectStore(this.ALMACEN).put(h, this.LLAVE);
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
      db.close();
      return true;
    } catch (e) {
      console.warn('No se pudo recordar el archivo vinculado:', e);
      return false;
    }
  },

  async _leerHandle() {
    try {
      const db = await this._db();
      const h = await new Promise((res, rej) => {
        const t = db.transaction(this.ALMACEN, 'readonly');
        const p = t.objectStore(this.ALMACEN).get(this.LLAVE);
        p.onsuccess = () => res(p.result || null); p.onerror = () => rej(p.error);
      });
      db.close();
      return h;
    } catch (e) { return null; }
  },

  async _olvidarHandle() {
    try {
      const db = await this._db();
      await new Promise(res => {
        const t = db.transaction(this.ALMACEN, 'readwrite');
        t.objectStore(this.ALMACEN).delete(this.LLAVE);
        t.oncomplete = res;
      });
      db.close();
    } catch (e) { /* ignorado */ }
  },

  /* ---------------------------- Permisos ------------------------------- */

  async permiso(pedir) {
    if (!this.handle) { this.permisoActual = null; return 'sin-archivo'; }
    const opts = { mode: 'readwrite' };
    try {
      let p = await this.handle.queryPermission(opts);
      if (p !== 'granted' && pedir) p = await this.handle.requestPermission(opts);
      this.permisoActual = p;
      return p;
    } catch (e) { this.permisoActual = 'denied'; return 'denied'; }
  },

  /* ------------------------ Paquete de datos --------------------------- */

  empaquetar() {
    return {
      formato: this.FORMATO,
      version: this.VERSION,
      actualizado: new Date().toISOString(),
      equipo: navigator.userAgent.slice(0, 120),
      ordenes: estado.ordenes,
      listas: {
        origenDestino: estado.listas.origenDestino,
        materiales: estado.listas.materiales,
        fuenteOD: estado.listas.fuenteOD,
        fuenteMat: estado.listas.fuenteMat
      }
    };
  },

  /** Llave de identidad de una orden: mismo tipo + mismo número = misma orden. */
  _llave(o) { return (o.tipo || '') + '|' + norm(o.numero || ''); },

  /**
   * Fusiona dos listas de órdenes conservando, para cada llave, la guardada
   * más recientemente. Devuelve { lista, nuevas, actualizadas }.
   */
  fusionarOrdenes(base, entrantes) {
    const mapa = new Map();
    (base || []).forEach(o => mapa.set(this._llave(o), o));
    let nuevas = 0, actualizadas = 0;

    (entrantes || []).forEach(o => {
      const k = this._llave(o);
      const ya = mapa.get(k);
      if (!ya) { mapa.set(k, o); nuevas++; return; }
      const tA = Date.parse(ya.guardadaEn || 0) || 0;
      const tB = Date.parse(o.guardadaEn || 0) || 0;
      if (tB > tA) { mapa.set(k, o); actualizadas++; }
    });

    const lista = Array.from(mapa.values())
      .sort((a, b) => (Date.parse(b.guardadaEn || 0) || 0) - (Date.parse(a.guardadaEn || 0) || 0));
    return { lista, nuevas, actualizadas };
  },

  /** Aplica un paquete leído (de archivo o de copia) al estado, fusionando. */
  aplicar(paquete, fusionarListas) {
    if (!paquete || paquete.formato !== this.FORMATO) {
      throw new Error('El archivo no tiene el formato esperado (falta «' + this.FORMATO + '»).');
    }
    const r = this.fusionarOrdenes(estado.ordenes, paquete.ordenes || []);
    estado.ordenes = r.lista.slice(0, CONFIG.maxOrdenesGuardadas);
    LS.escribir(LS.ORDENES, estado.ordenes);

    let listasCambiadas = false;
    if (fusionarListas && paquete.listas) {
      if ((paquete.listas.origenDestino || []).length) {
        estado.listas.origenDestino = paquete.listas.origenDestino;
        estado.listas.fuenteOD = paquete.listas.fuenteOD || 'copia de seguridad';
        listasCambiadas = true;
      }
      if ((paquete.listas.materiales || []).length) {
        estado.listas.materiales = paquete.listas.materiales;
        estado.listas.fuenteMat = paquete.listas.fuenteMat || 'copia de seguridad';
        listasCambiadas = true;
      }
      if (listasCambiadas) { LS.escribir(LS.LISTAS, estado.listas); refrescarListas(); }
    }

    pintarOrdenes(); pintarAlmacenamiento();
    return Object.assign(r, { listasCambiadas });
  },

  /* ------------------- Archivo de datos vinculado ---------------------- */

  async vincular() {
    if (!this.soportado) {
      aviso('Este navegador no permite vincular un archivo de datos. Use la copia de seguridad manual.', 'warn', 8000);
      return;
    }
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: 'Ordenes_SSEE_datos.json',
        types: [{ description: 'Datos del módulo de órdenes', accept: { 'application/json': ['.json'] } }]
      });
      this.handle = h; this.nombreArchivo = h.name;
      this.permisoActual = 'granted';
      this.recordado = await this._guardarHandle(h);
      if (!this.recordado) {
        aviso('El vínculo funciona ahora, pero este navegador no pudo memorizarlo: tendrá que volver a ' +
              'vincular el archivo cada vez que abra el módulo.', 'warn', 10000);
      }

      // Si el archivo ya tenía datos, se incorporan antes de escribir
      try {
        const txt = await (await h.getFile()).text();
        if (txt.trim()) {
          const r = this.aplicar(JSON.parse(txt), true);
          if (r.nuevas || r.actualizadas) {
            aviso(`Se incorporaron ${r.nuevas} orden(es) nueva(s) y ${r.actualizadas} actualizada(s) del archivo.`, 'ok', 7000);
          }
        }
      } catch (e) { /* archivo nuevo o vacío */ }

      await this.escribir(true);
      pintarAlmacenamiento();
      aviso(`Archivo de datos vinculado: ${h.name}. A partir de ahora cada orden guardada se escribe allí.`, 'ok', 8000);
    } catch (e) {
      if (e && e.name === 'AbortError') return;          // el usuario canceló
      console.error(e);
      aviso('No se pudo vincular el archivo: ' + (e.message || e), 'err', 8000);
    }
  },

  async desvincular() {
    if (!confirm('¿Desvincular el archivo de datos?\n\nEl archivo NO se borra: solo se deja de escribir en él automáticamente.')) return;
    this.handle = null; this.nombreArchivo = ''; this.ultimaEscritura = null;
    await this._olvidarHandle();
    pintarAlmacenamiento();
    aviso('Archivo desvinculado. Los datos siguen guardándose en este navegador.', 'ok');
  },

  /**
   * Escribe el paquete en el archivo vinculado, RELEYENDO Y FUSIONANDO antes
   * para no pisar cambios que otra persona (u otro equipo) haya guardado.
   */
  async escribir(silencioso) {
    if (!this.handle) return false;
    const perm = await this.permiso(false);
    if (perm !== 'granted') {
      if (!silencioso) {
        aviso('El navegador pide autorización para escribir en el archivo vinculado. Pulse «Sincronizar ahora».', 'warn', 8000);
      }
      pintarAlmacenamiento();
      return false;
    }
    try {
      // 1) Releer lo que haya en el archivo y fusionarlo con lo local
      try {
        const txt = await (await this.handle.getFile()).text();
        if (txt.trim()) {
          const remoto = JSON.parse(txt);
          if (remoto.formato === this.FORMATO) {
            const r = this.fusionarOrdenes(estado.ordenes, remoto.ordenes || []);
            estado.ordenes = r.lista.slice(0, CONFIG.maxOrdenesGuardadas);
            LS.escribir(LS.ORDENES, estado.ordenes);
            if (r.nuevas && !silencioso) {
              aviso(`Se incorporaron ${r.nuevas} orden(es) que había en el archivo.`, 'warn', 6000);
              pintarOrdenes();
            }
          }
        }
      } catch (e) { /* archivo vacío o ilegible: se sobrescribe */ }

      // 2) Escribir el paquete completo
      const w = await this.handle.createWritable();
      await w.write(JSON.stringify(this.empaquetar(), null, 1));
      await w.close();
      this.ultimaEscritura = new Date();
      pintarAlmacenamiento();
      return true;
    } catch (e) {
      console.error('Error al escribir el archivo de datos:', e);
      if (!silencioso) aviso('No se pudo escribir en el archivo vinculado: ' + (e.message || e), 'err', 8000);
      return false;
    }
  },

  /** Lee el archivo vinculado pidiendo permiso (requiere clic del usuario). */
  async sincronizar() {
    if (!this.handle) { aviso('No hay ningún archivo de datos vinculado.', 'warn'); return; }
    const perm = await this.permiso(true);
    if (perm !== 'granted') { aviso('No se concedió acceso al archivo de datos.', 'err', 7000); return; }
    try {
      cargando(true, 'Sincronizando con el archivo de datos…');
      const txt = await (await this.handle.getFile()).text();
      if (txt.trim()) {
        const r = this.aplicar(JSON.parse(txt), true);
        aviso(`Sincronizado: ${r.nuevas} nueva(s), ${r.actualizadas} actualizada(s). Total: ${estado.ordenes.length}.`, 'ok', 7000);
      } else {
        aviso('El archivo estaba vacío; se escribieron los datos de este equipo.', 'warn', 6000);
      }
      await this.escribir(true);
    } catch (e) {
      console.error(e);
      aviso('No se pudo leer el archivo: ' + (e.message || e), 'err', 8000);
    } finally { cargando(false); }
  },

  /** Recupera el archivo vinculado al abrir la página (sin pedir permiso aún). */
  async restaurarVinculo() {
    if (!this.soportado) return;
    const h = await this._leerHandle();
    if (!h) return;
    this.handle = h; this.nombreArchivo = h.name || 'archivo de datos';
    const perm = await this.permiso(false);
    pintarAlmacenamiento();
    if (perm === 'granted') await this.sincronizarSilencioso();
    else aviso('Hay un archivo de datos vinculado. Pulse «Sincronizar ahora» en la sección 7 para ' +
               'autorizar el acceso y cargar sus órdenes.', 'warn', 10000);
  },

  async sincronizarSilencioso() {
    try {
      const txt = await (await this.handle.getFile()).text();
      if (!txt.trim()) return;
      const r = this.aplicar(JSON.parse(txt), true);
      if (r.nuevas || r.actualizadas) {
        aviso(`Datos cargados del archivo vinculado: ${estado.ordenes.length} orden(es).`, 'ok', 6000);
      }
    } catch (e) { console.warn('No se pudo leer el archivo vinculado al iniciar:', e); }
  },

  /* --------------------- Copia de seguridad manual --------------------- */

  exportarCopia() {
    const fecha = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(this.empaquetar(), null, 1)], { type: 'application/json' });
    LIBS.descargar(blob, `Respaldo_Ordenes_SSEE_${fecha}.json`);
    aviso(`Copia de seguridad exportada con ${estado.ordenes.length} orden(es).`, 'ok', 6000);
  },

  restaurarCopia(file) {
    if (!file) return;
    const lector = new FileReader();
    lector.onerror = () => aviso('No se pudo leer el archivo de copia.', 'err');
    lector.onload = ev => {
      try {
        const r = this.aplicar(JSON.parse(ev.target.result), true);
        aviso(`Copia restaurada: ${r.nuevas} orden(es) nueva(s), ${r.actualizadas} actualizada(s). Total: ${estado.ordenes.length}.`, 'ok', 8000);
        if (this.handle) this.escribir(true);
      } catch (e) {
        console.error(e);
        aviso('El archivo no es una copia válida de este módulo: ' + (e.message || e), 'err', 9000);
      }
    };
    lector.readAsText(file);
  },

  /* ------------------------- Uso del almacenamiento -------------------- */

  bytesUsados() {
    try {
      let n = 0;
      [LS.BORRADOR, LS.LISTAS, LS.ORDENES].forEach(k => {
        const v = localStorage.getItem(k); if (v) n += v.length;
      });
      return n;
    } catch (e) { return 0; }
  }
};

/* ---------------------- Exportación consolidada ------------------------ */

/**
 * Exporta TODO el histórico a un Excel de una fila por ítem, pensado para
 * consolidar y filtrar los movimientos de material.
 */
function exportarHistoricoExcel() {
  if (!estado.ordenes.length) { aviso('No hay órdenes guardadas para exportar.', 'warn'); return; }
  const ExcelJSLib = LIBS.exceljs;
  if (!ExcelJSLib) { aviso('La librería de Excel no está disponible.', 'err', 8000); return; }

  cargando(true, 'Generando el histórico consolidado…');
  try {
    const wb = new ExcelJSLib.Workbook();
    wb.creator = CONFIG.autorizadoPor.nombre;
    wb.created = new Date();

    const ws = wb.addWorksheet('Movimientos', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    const cab = ['Tipo', 'No. de orden', 'Fecha', 'Hora', 'Zona', 'Origen', 'Destino',
      'Ítem', 'Código / UC', 'Descripción', 'Unidad', 'Cantidad', 'Motivo', 'Nota',
      'Autorizado por', 'Entregado por', 'Recibido por', 'Empresa vigilancia', 'Guardada el'];
    const anchos = [10, 15, 11, 7, 12, 22, 22, 6, 12, 36, 8, 10, 40, 30, 18, 18, 18, 18, 18];
    ws.columns = cab.map((t, i) => ({ header: t, key: 'k' + i, width: anchos[i] }));

    ws.getRow(1).height = 28;
    ws.getRow(1).eachCell(c => {
      c.font = { name: FUENTE_XLS, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006FB7' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
    });

    let filas = 0;
    // De la más antigua a la más reciente, que es como se lee un histórico
    estado.ordenes.slice().reverse().forEach(o => {
      (o.items || []).forEach((it, i) => {
        const f = ws.addRow([
          o.tipo, o.numero, o.fecha, o.hora, o.zona, o.origen, o.destino,
          i + 1, it.codigo || '', it.descripcion, it.unidad || '', Number(it.cantidad),
          o.motivo, o.nota || '',
          (o.autorizado || {}).nombre || '', (o.entregado || {}).nombre || '',
          (o.recibido || {}).nombre || '', o.empresaVig || '',
          o.guardadaEn ? o.guardadaEn.slice(0, 19).replace('T', ' ') : ''
        ]);
        f.eachCell(c => {
          c.font = { name: FUENTE_XLS, size: 10 };
          c.alignment = { vertical: 'top', wrapText: true };
          c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
        });
        f.getCell(1).font = { name: FUENTE_XLS, size: 10, bold: true,
          color: { argb: o.tipo === 'ENTRADA' ? 'FF2E7D32' : 'FFB26A00' } };
        filas++;
      });
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };

    // Hoja resumen: totales por material y por tipo
    const rs = wb.addWorksheet('Resumen por material');
    rs.columns = [
      { header: 'Código / UC', key: 'c0', width: 12 },
      { header: 'Descripción', key: 'd', width: 44 },
      { header: 'Unidad', key: 'u', width: 10 },
      { header: 'Entradas', key: 'e', width: 12 },
      { header: 'Salidas', key: 's', width: 12 },
      { header: 'Neto (E − S)', key: 'n', width: 14 },
      { header: 'N.º de órdenes', key: 'o', width: 14 }
    ];
    const acum = new Map();
    estado.ordenes.forEach(o => (o.items || []).forEach(it => {
      const k = norm(it.descripcion) + '|' + norm(it.unidad);
      const a = acum.get(k) || { c: it.codigo || '', d: it.descripcion, u: it.unidad || '', e: 0, s: 0, o: new Set() };
      if (o.tipo === 'ENTRADA') a.e += Number(it.cantidad) || 0; else a.s += Number(it.cantidad) || 0;
      a.o.add(o.tipo + '|' + o.numero);
      acum.set(k, a);
    }));
    Array.from(acum.values())
      .sort((a, b) => a.d.localeCompare(b.d, 'es'))
      .forEach(a => rs.addRow([a.c, a.d, a.u, a.e, a.s, a.e - a.s, a.o.size]));

    rs.getRow(1).height = 26;
    rs.getRow(1).eachCell(c => {
      c.font = { name: FUENTE_XLS, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006FB7' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
    });
    rs.eachRow((row, i) => { if (i > 1) row.eachCell(c => {
      c.font = { name: FUENTE_XLS, size: 10 };
      c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
    }); });
    rs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

    wb.xlsx.writeBuffer().then(buf => {
      const fecha = new Date().toISOString().slice(0, 10);
      LIBS.descargar(new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), `Historico_Ordenes_SSEE_${fecha}.xlsx`);
      cargando(false);
      aviso(`Histórico exportado: ${estado.ordenes.length} orden(es), ${filas} línea(s) de material.`, 'ok', 7000);
    }).catch(err => {
      cargando(false); console.error(err);
      aviso('Error al escribir el histórico: ' + err.message, 'err', 8000);
    });

  } catch (err) {
    cargando(false); console.error(err);
    aviso('Error al generar el histórico: ' + (err.message || err), 'err', 8000);
  }
}

/* ------------------------ Panel de almacenamiento ---------------------- */

function pintarAlmacenamiento() {
  const cont = $('#panelDatos');
  if (!cont) return;

  const kb = (DATOS.bytesUsados() / 1024).toFixed(1);
  const nOrd = estado.ordenes.length;
  const nItems = estado.ordenes.reduce((s, o) => s + ((o.items || []).length), 0);

  $('#dEstadoOrdenes').textContent = nOrd;
  $('#dEstadoItems').textContent = nItems;
  $('#dEstadoEspacio').textContent = kb + ' KB';
  $('#cntOrd').textContent = nOrd;

  const est = $('#dEstadoArchivo');
  const btnSync = $('#btnSincronizar');
  const btnDesv = $('#btnDesvincular');
  const btnVinc = $('#btnVincular');

  if (!DATOS.soportado) {
    est.className = 'oms-aviso ver warn';
    est.innerHTML = '<b>Este navegador no admite vincular un archivo de datos.</b> ' +
      'Funciona en Chrome y Edge. Aquí sus datos viven solo dentro del navegador: ' +
      'use la <b>copia de seguridad</b> con regularidad.';
    btnVinc.disabled = true; btnSync.hidden = true; btnDesv.hidden = true;
    return;
  }

  if (!DATOS.handle) {
    est.className = 'oms-aviso ver warn';
    est.innerHTML = '<b>Sin archivo de datos vinculado.</b> Los datos se guardan solo dentro de este ' +
      'navegador y en este equipo: se perderían al borrar los datos de navegación, al cambiar de ' +
      'navegador o al cambiar de computador. Vincule un archivo para que vivan en su disco.';
    btnVinc.disabled = false; btnSync.hidden = true; btnDesv.hidden = true;
    return;
  }

  btnVinc.disabled = false; btnSync.hidden = false; btnDesv.hidden = false;

  if (DATOS.permisoActual === 'denied') {
    est.className = 'oms-aviso ver err';
    est.innerHTML = `<b>Acceso denegado a</b> <code>${esc(DATOS.nombreArchivo)}</code>. ` +
      'No se está escribiendo nada en él. Pulse «Sincronizar ahora» para volver a autorizarlo, ' +
      'o vincule otro archivo.';
    return;
  }

  if (DATOS.permisoActual !== 'granted') {
    est.className = 'oms-aviso ver warn';
    est.innerHTML = `<b>Archivo vinculado pero pendiente de autorizar:</b> <code>${esc(DATOS.nombreArchivo)}</code>. ` +
      'Por seguridad, el navegador vuelve a pedir permiso en cada sesión. ' +
      '<b>Pulse «Sincronizar ahora»</b> para autorizarlo y cargar sus órdenes. Mientras tanto, ' +
      'los datos se siguen guardando dentro del navegador.';
    return;
  }

  const ult = DATOS.ultimaEscritura
    ? DATOS.ultimaEscritura.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'aún no en esta sesión';
  est.className = 'oms-aviso ver ok';
  est.innerHTML = `<b>Archivo de datos vinculado y autorizado:</b> <code>${esc(DATOS.nombreArchivo)}</code>. ` +
    `Cada orden que guarde se escribe también allí. Última escritura: ${ult}.` +
    (DATOS.recordado ? '' : '<br><b>Aviso:</b> este navegador no pudo memorizar el vínculo; tendrá que rehacerlo al reabrir.');
}


/* ==========================================================================
   ▓▓▓ BLOQUE 12 — INDICADORES ▓▓▓
   --------------------------------------------------------------------------
   Todo lo que se muestra aquí sale EXCLUSIVAMENTE de las órdenes guardadas
   (`estado.ordenes`), que ya se almacenan en localStorage, en el archivo de
   datos vinculado y en la copia de seguridad. No se calcula nada a partir de
   supuestos ni se completa ningún dato que el usuario no haya registrado.

   Tres reglas de honestidad que gobiernan este bloque:

   1. NUNCA se suman cantidades de unidades distintas. 4 UND + 12,5 Kg no son
      16,5 de nada. Los totales de material se agrupan SIEMPRE por unidad.
   2. El «neto E − S» NO es un inventario ni un stock: es la diferencia entre
      lo registrado como entrada y como salida en las órdenes guardadas.
   3. La vista es la de ESTE equipo. Si hay órdenes en otro computador sin
      sincronizar, o alguna no se pulsó «Guardar orden», no están aquí.
      El panel lo dice explícitamente.

   Color (paleta validada con el verificador de daltonismo):
     ENTRADA = #2a78d6 (azul)   ·   SALIDA = #eb6834 (naranja)
   El verde/naranja de marca que se usaba antes en las etiquetas fallaba la
   separación por deuteranopía (ΔE 2,5, indistinguibles) y el texto blanco
   sobre naranja quedaba en 3,20:1. Un mismo color significa lo mismo en todo
   el panel y en la lista de órdenes guardadas.
   ========================================================================== */

const VIZ = {
  ENTRADA: '#2a78d6',
  SALIDA:  '#eb6834',
  ejes:    '#C7D2DA',
  ink:     '#16222B',
  ink2:    '#4A5A66',
  gap:     2          // separación entre segmentos apilados, en px
};

/* ------------------------------- Filtros ------------------------------- */

const FILTROS = {
  CLAVE: 'ssee.orden.filtros.v1',
  desde: '', hasta: '', zona: '', tipo: '',

  leer() {
    const g = LS.leer(this.CLAVE, null);
    if (g) Object.assign(this, g);
  },
  guardar() {
    LS.escribir(this.CLAVE, { desde: this.desde, hasta: this.hasta, zona: this.zona, tipo: this.tipo });
  },
  desdeUI() {
    this.desde = $('#fDesde').value;
    this.hasta = $('#fHasta').value;
    this.zona  = $('#fZona').value;
    this.tipo  = $('#fTipo').value;
    this.guardar();
  },
  aUI() {
    $('#fDesde').value = this.desde || '';
    $('#fHasta').value = this.hasta || '';
    $('#fZona').value  = this.zona  || '';
    $('#fTipo').value  = this.tipo  || '';
  },
  limpiar() {
    this.desde = this.hasta = this.zona = this.tipo = '';
    this.guardar(); this.aUI();
  },
  activos() { return !!(this.desde || this.hasta || this.zona || this.tipo); }
};

/** Aplica los filtros al histórico. */
function ordenesFiltradas() {
  return estado.ordenes.filter(o => {
    if (FILTROS.tipo && o.tipo !== FILTROS.tipo) return false;
    if (FILTROS.zona && norm(o.zona) !== norm(FILTROS.zona)) return false;
    if (FILTROS.desde && (!o.fechaISO || o.fechaISO < FILTROS.desde)) return false;
    if (FILTROS.hasta && (!o.fechaISO || o.fechaISO > FILTROS.hasta)) return false;
    return true;
  });
}

/* ----------------------------- Agregación ------------------------------ */

/** Cuenta órdenes por una clave, separando entradas y salidas. */
function contarPor(ordenes, obtenerClave) {
  const m = new Map();
  ordenes.forEach(o => {
    const claves = obtenerClave(o);
    (Array.isArray(claves) ? claves : [claves]).forEach(k => {
      const clave = (k == null || String(k).trim() === '') ? '(sin dato)' : String(k).trim();
      const a = m.get(clave) || { clave, ENTRADA: 0, SALIDA: 0, total: 0 };
      if (o.tipo === 'ENTRADA') a.ENTRADA++; else if (o.tipo === 'SALIDA') a.SALIDA++;
      a.total++;
      m.set(clave, a);
    });
  });
  return Array.from(m.values()).sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave, 'es'));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function etiquetaMes(iso) {                      // '2026-08' → 'ago 26'
  const [a, m] = iso.split('-');
  return MESES[Number(m) - 1] + ' ' + a.slice(2);
}

/** Serie mensual completa: incluye los meses sin órdenes, para no falsear la tendencia. */
function porMes(ordenes) {
  const con = ordenes.filter(o => o.fechaISO);
  const sinFecha = ordenes.length - con.length;
  if (!con.length) return { serie: [], sinFecha };

  const m = new Map();
  con.forEach(o => {
    const k = o.fechaISO.slice(0, 7);
    const a = m.get(k) || { clave: k, ENTRADA: 0, SALIDA: 0, total: 0 };
    if (o.tipo === 'ENTRADA') a.ENTRADA++; else if (o.tipo === 'SALIDA') a.SALIDA++;
    a.total++; m.set(k, a);
  });

  const claves = Array.from(m.keys()).sort();
  const [aI, mI] = claves[0].split('-').map(Number);
  const [aF, mF] = claves[claves.length - 1].split('-').map(Number);
  const serie = [];
  for (let a = aI, mes = mI; a < aF || (a === aF && mes <= mF); mes === 12 ? (mes = 1, a++) : mes++) {
    const k = a + '-' + String(mes).padStart(2, '0');
    serie.push(m.get(k) || { clave: k, ENTRADA: 0, SALIDA: 0, total: 0 });
    if (serie.length > 120) break;                        // tope de seguridad: 10 años
  }
  return { serie: serie.map(x => Object.assign({}, x, { etiqueta: etiquetaMes(x.clave) })), sinFecha };
}

/** Material agregado por unidad. NUNCA mezcla unidades distintas. */
function porMaterial(ordenes) {
  const m = new Map();
  ordenes.forEach(o => (o.items || []).forEach(it => {
    const unidad = (it.unidad || '').trim() || '(sin unidad)';
    const k = norm(it.descripcion) + '|' + norm(unidad);
    const a = m.get(k) || {
      codigo: it.codigo || '', descripcion: it.descripcion, unidad,
      entradas: 0, salidas: 0, ordenes: new Set()
    };
    const q = Number(it.cantidad) || 0;
    if (o.tipo === 'ENTRADA') a.entradas += q; else if (o.tipo === 'SALIDA') a.salidas += q;
    a.ordenes.add(o.tipo + '|' + o.numero);
    m.set(k, a);
  }));
  return Array.from(m.values())
    .map(a => Object.assign({}, a, { neto: a.entradas - a.salidas, nOrdenes: a.ordenes.size }))
    .sort((a, b) => (b.entradas + b.salidas) - (a.entradas + a.salidas) ||
                    a.descripcion.localeCompare(b.descripcion, 'es'));
}

/** Calcula todo el panel de una vez. */
function calcularIndicadores() {
  const ord = ordenesFiltradas();
  const entradas = ord.filter(o => o.tipo === 'ENTRADA').length;
  const salidas  = ord.filter(o => o.tipo === 'SALIDA').length;
  const lineas   = ord.reduce((s, o) => s + ((o.items || []).length), 0);

  const sedes = new Set();
  ord.forEach(o => { if (o.origen) sedes.add(norm(o.origen)); if (o.destino) sedes.add(norm(o.destino)); });

  const fechas = ord.map(o => o.fechaISO).filter(Boolean).sort();

  return {
    ordenes: ord,
    total: ord.length, entradas, salidas, lineas,
    sedes: sedes.size,
    desde: fechas[0] || '', hasta: fechas[fechas.length - 1] || '',
    zona:    contarPor(ord, o => o.zona),
    motivo:  contarPor(ord, o => o.motivo),
    origen:  contarPor(ord, o => o.origen),
    destino: contarPor(ord, o => o.destino),
    entrega: contarPor(ord, o => (o.entregado || {}).nombre),
    recibe:  contarPor(ord, o => (o.recibido  || {}).nombre),
    mes:     porMes(ord),
    material: porMaterial(ord)
  };
}

/* ------------------------------- Gráficos ------------------------------ */

const nfmt = n => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });

/**
 * Escala de conteos: devuelve un tope y un número de divisiones tales que
 * TODAS las marcas del eje caen en enteros. Sin esto salían ejes como
 * «0 · 1 · 3 · 4 · 5» (5 dividido en 4 partes), que se leen mal.
 */
function escalaEntera(maxValor) {
  const max = Math.max(1, Math.ceil(maxValor));
  const pasos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  for (const paso of pasos) {
    const div = Math.ceil(max / paso);
    if (div <= 5) return { tope: paso * div, divisiones: div };
  }
  const paso = Math.pow(10, Math.ceil(Math.log10(max / 5)));
  const div = Math.ceil(max / paso);
  return { tope: paso * div, divisiones: div };
}

/** Marca de datos con el extremo redondeado, anclada a la línea base. */
function barraH(x, y, w, h, r, redondearFin) {
  const rr = Math.min(r, w, h / 2);
  if (w <= 0.5) return '';
  if (!redondearFin || w < rr * 2) return `<path d="M${x} ${y}h${w}v${h}h${-w}z"/>`;
  return `<path d="M${x} ${y}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - rr)}z"/>`;
}

/**
 * Barras horizontales apiladas ENTRADA/SALIDA.
 * Etiqueta directa del total al final de cada barra (no un número por segmento).
 */
function graficoBarrasH(datos, opts) {
  opts = opts || {};
  const filas = datos.slice(0, opts.tope || 12);
  if (!filas.length) return '<p class="sin-datos">Sin datos para los filtros aplicados.</p>';

  const anchoEtq = opts.anchoEtiqueta || 190;
  const altoFila = 26, gapFila = 8, padDer = 52, padSup = 4;
  const W = opts.ancho || 560, alturaBarra = 15;
  const maxCar = opts.maxCaracteres || 34;
  const H = padSup + filas.length * (altoFila + gapFila);
  const anchoPlot = W - anchoEtq - padDer;
  const { tope, divisiones: nDiv } = escalaEntera(Math.max(...filas.map(f => f.total)));
  const esc = v => (v / tope) * anchoPlot;

  let s = `<svg viewBox="0 0 ${W} ${H}" class="viz" style="max-width:${W}px" role="img" aria-label="${esc_(opts.titulo || '')}">`;

  // Rejilla discreta, continua (nunca punteada)
  for (let i = 0; i <= nDiv; i++) {
    const x = anchoEtq + (anchoPlot * i) / nDiv;
    s += `<line x1="${x}" y1="${padSup}" x2="${x}" y2="${H - 6}" stroke="${VIZ.ejes}" stroke-width="1"/>`;
    s += `<text x="${x}" y="${H - 0}" text-anchor="middle" class="viz-eje">${(tope * i) / nDiv}</text>`;
  }

  filas.forEach((f, i) => {
    const y = padSup + i * (altoFila + gapFila);
    const yb = y + (altoFila - alturaBarra) / 2;
    const etq = f.clave.length > maxCar ? f.clave.slice(0, maxCar - 1) + '…' : f.clave;

    s += `<text x="${anchoEtq - 10}" y="${y + altoFila / 2 + 4}" text-anchor="end" class="viz-etq">` +
         `<title>${esc_(f.clave)}</title>${esc_(etq)}</text>`;

    let x = anchoEtq;
    [['ENTRADA', VIZ.ENTRADA], ['SALIDA', VIZ.SALIDA]].forEach(([serie, color], k) => {
      const v = f[serie];
      if (!v) return;
      const w = esc(v) - (k > 0 ? VIZ.gap : 0);
      const ultimo = (serie === 'SALIDA') || !f.SALIDA;
      s += `<g fill="${color}" class="viz-marca" data-tip="${esc_(f.clave)}|${serie}: ${v} orden(es)">` +
           barraH(x + (k > 0 ? VIZ.gap : 0), yb, Math.max(w, 1), alturaBarra, 4, ultimo) + `</g>`;
      x += esc(v);
    });

    s += `<text x="${anchoEtq + esc(f.total) + 8}" y="${y + altoFila / 2 + 4}" class="viz-valor">${f.total}</text>`;
  });

  return s + '</svg>';
}

/** Columnas apiladas por mes. */
function graficoColumnas(serie, opts) {
  opts = opts || {};
  if (!serie.length) return '<p class="sin-datos">Sin datos con fecha para los filtros aplicados.</p>';

  const W = opts.ancho || 560, H = 240, padIzq = 34, padDer = 8, padSup = 12, padInf = 38;
  const plotW = W - padIzq - padDer, plotH = H - padSup - padInf;
  const { tope, divisiones: nDiv } = escalaEntera(Math.max(...serie.map(f => f.total)));
  const esc = v => (v / tope) * plotH;

  const paso_ = plotW / serie.length;
  const ancho = Math.min(42, paso_ * 0.6);

  let s = `<svg viewBox="0 0 ${W} ${H}" class="viz" style="max-width:${W}px" role="img" aria-label="${esc_(opts.titulo || '')}">`;

  for (let i = 0; i <= nDiv; i++) {
    const y = padSup + plotH - (plotH * i) / nDiv;
    s += `<line x1="${padIzq}" y1="${y}" x2="${W - padDer}" y2="${y}" stroke="${VIZ.ejes}" stroke-width="1"/>`;
    s += `<text x="${padIzq - 8}" y="${y + 4}" text-anchor="end" class="viz-eje">${(tope * i) / nDiv}</text>`;
  }

  serie.forEach((f, i) => {
    const cx = padIzq + paso_ * i + paso_ / 2;
    const x = cx - ancho / 2;
    let yb = padSup + plotH;

    [['SALIDA', VIZ.SALIDA], ['ENTRADA', VIZ.ENTRADA]].forEach(([serieN, color], k) => {
      const v = f[serieN];
      if (!v) return;
      const h = esc(v) - (k > 0 ? VIZ.gap : 0);
      const arriba = (serieN === 'ENTRADA') || !f.ENTRADA;
      const alto = Math.max(h, 1);
      const r = arriba ? Math.min(4, ancho / 2, alto / 2) : 0;
      s += `<g fill="${color}" class="viz-marca" data-tip="${esc_(f.etiqueta)}|${serieN}: ${v} orden(es)">` +
           (r
             ? `<path d="M${x} ${yb - alto + r}a${r} ${r} 0 0 1 ${r} ${-r}h${ancho - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${alto - r}h${-ancho}z"/>`
             : `<path d="M${x} ${yb - alto}h${ancho}v${alto}h${-ancho}z"/>`) + `</g>`;
      yb -= esc(v);
    });

    if (f.total) s += `<text x="${cx}" y="${padSup + plotH - esc(f.total) - 6}" text-anchor="middle" class="viz-valor">${f.total}</text>`;

    // Etiqueta de mes: una de cada n si hay muchos, para que no colisionen
    const cada = Math.ceil(serie.length / 14);
    if (i % cada === 0 || i === serie.length - 1) {
      s += `<text x="${cx}" y="${H - 18}" text-anchor="middle" class="viz-eje">${esc_(f.etiqueta)}</text>`;
    }
  });

  s += `<line x1="${padIzq}" y1="${padSup + plotH}" x2="${W - padDer}" y2="${padSup + plotH}" stroke="${VIZ.ejes}" stroke-width="1"/>`;
  return s + '</svg>';
}

/* Escape local para no chocar con `esc()` dentro de plantillas SVG */
function esc_(t) { return esc(t); }

/* ------------------------------ Pintado -------------------------------- */

function pintarIndicadores() {
  const d = calcularIndicadores();
  const totalHist = estado.ordenes.length;

  /* --- Alcance de los datos: lo primero, para que nadie lea de más --- */
  const alc = $('#vizAlcance');
  alc.className = 'oms-aviso ver' + (d.total ? 'ok' : 'warn');
  alc.innerHTML = d.total
    ? `Calculado sobre <b>${d.total}</b> ${d.total === 1 ? 'orden guardada' : 'órdenes guardadas'}` +
      (FILTROS.activos() ? ` (de ${totalHist} en el histórico, tras aplicar los filtros)` : ' en este equipo') +
      (d.desde ? ` · del <b>${fechaAtexto(d.desde)}</b> al <b>${fechaAtexto(d.hasta)}</b>` : '') +
      `. <span style="color:var(--tinta-2)">Solo incluye lo que se pulsó «Guardar orden» en este equipo.</span>`
    : (totalHist
        ? `Ninguna de las <b>${totalHist}</b> órdenes guardadas cumple los filtros aplicados.`
        : '<b>Todavía no hay órdenes guardadas.</b> Diligencie una orden y pulse «Guardar orden» para empezar a ver indicadores.');

  /* --- Tarjetas --- */
  $('#kOrdenes').textContent = d.total;
  $('#kOrdenesSub').innerHTML = d.total
    ? `<span class="pt pt-e"></span>${d.entradas} entrada(s) · <span class="pt pt-s"></span>${d.salidas} salida(s)`
    : '—';
  $('#kLineas').textContent = d.lineas;
  $('#kLineasSub').textContent = d.total ? (d.lineas / d.total).toFixed(1).replace('.', ',') + ' por orden' : '—';
  $('#kSedes').textContent = d.sedes;
  $('#kZonas').textContent = d.zona.length;

  /* --- Gráficos --- */
  $('#vizZona').innerHTML   = graficoBarrasH(d.zona,   { titulo: 'Órdenes por zona', anchoEtiqueta: 130, ancho: 560 });
  $('#vizMes').innerHTML    = graficoColumnas(d.mes.serie, { titulo: 'Órdenes por mes', ancho: 560 });
  $('#vizMesNota').innerHTML = d.mes.sinFecha
    ? `<b>${d.mes.sinFecha}</b> orden(es) sin fecha quedan fuera de este gráfico.` : '';
  $('#vizMotivo').innerHTML = graficoBarrasH(d.motivo, { titulo: 'Órdenes por motivo', anchoEtiqueta: 470,
                                                        maxCaracteres: 62, ancho: 1120, tope: 10 });
  $('#vizOrigen').innerHTML = graficoBarrasH(d.origen, { titulo: 'Sedes de origen', anchoEtiqueta: 160, ancho: 560, tope: 10 });
  $('#vizDestino').innerHTML = graficoBarrasH(d.destino, { titulo: 'Sedes de destino', anchoEtiqueta: 160, ancho: 560, tope: 10 });

  /* --- Tabla de materiales, agrupada por unidad --- */
  const tb = $('#vizMaterial');
  if (!d.material.length) {
    tb.innerHTML = '<p class="sin-datos">Sin materiales para los filtros aplicados.</p>';
  } else {
    const porUnidad = new Map();
    d.material.forEach(m => {
      if (!porUnidad.has(m.unidad)) porUnidad.set(m.unidad, []);
      porUnidad.get(m.unidad).push(m);
    });
    tb.innerHTML = Array.from(porUnidad).map(([u, lista]) => `
      <h4 class="viz-sub">Unidad: <b>${esc(u)}</b> <span class="viz-nota">(${lista.length} material(es))</span></h4>
      <table class="tabla-items tabla-viz">
        <thead><tr>
          <th>Código</th><th>Descripción</th>
          <th class="q">Entradas</th><th class="q">Salidas</th><th class="q">Neto (E − S)</th><th class="q">Órdenes</th>
        </tr></thead>
        <tbody>${lista.map(m => `
          <tr>
            <td class="cod">${esc(m.codigo || '—')}</td>
            <td>${esc(m.descripcion)}</td>
            <td class="q">${m.entradas ? nfmt(m.entradas) : '—'}</td>
            <td class="q">${m.salidas ? nfmt(m.salidas) : '—'}</td>
            <td class="q ${m.neto > 0 ? 'pos' : m.neto < 0 ? 'neg' : ''}">${nfmt(m.neto)}</td>
            <td class="q">${m.nOrdenes}</td>
          </tr>`).join('')}</tbody>
      </table>`).join('');
  }

  /* --- Responsables --- */
  const tablaResp = (lista, rotulo) => !lista.length
    ? `<p class="sin-datos">Sin datos de ${rotulo}.</p>`
    : `<table class="tabla-items tabla-viz"><thead><tr><th>${rotulo}</th>
       <th class="q">Entradas</th><th class="q">Salidas</th><th class="q">Total</th></tr></thead><tbody>` +
      lista.map(r => `<tr><td>${esc(r.clave)}</td><td class="q">${r.ENTRADA || '—'}</td>` +
        `<td class="q">${r.SALIDA || '—'}</td><td class="q"><b>${r.total}</b></td></tr>`).join('') +
      '</tbody></table>';
  $('#vizEntrega').innerHTML = tablaResp(d.entrega, 'Entregado por');
  $('#vizRecibe').innerHTML  = tablaResp(d.recibe,  'Recibido por');

  conectarTooltips();
  return d;
}

/* ------------------------- Tooltip compartido --------------------------- */

function conectarTooltips() {
  const tip = $('#vizTip');
  $$('#cuerpoViz .viz-marca').forEach(g => {
    g.addEventListener('mouseenter', ev => {
      const [t, v] = (g.dataset.tip || '').split('|');
      tip.innerHTML = `<b>${esc(t)}</b><br>${esc(v)}`;
      tip.classList.add('ver');
    });
    g.addEventListener('mousemove', ev => {
      const c = $('#cuerpoViz').getBoundingClientRect();
      tip.style.left = (ev.clientX - c.left + 14) + 'px';
      tip.style.top  = (ev.clientY - c.top - 10) + 'px';
    });
    g.addEventListener('mouseleave', () => tip.classList.remove('ver'));
  });
}

/* --------------------------- Modal y filtros ---------------------------- */

function abrirIndicadores() {
  // Las zonas del desplegable salen de lo realmente registrado
  const zonas = Array.from(new Set(estado.ordenes.map(o => (o.zona || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const sel = $('#fZona'), prev = FILTROS.zona;
  sel.innerHTML = '<option value="">Todas las zonas</option>' +
    zonas.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('');
  if (prev && zonas.some(z => norm(z) === norm(prev))) sel.value = prev; else if (prev) FILTROS.zona = '';

  FILTROS.aUI();
  pintarIndicadores();
  $('#modalViz').classList.add('ver');
  document.body.style.overflow = 'hidden';
}

function cerrarIndicadores() {
  $('#modalViz').classList.remove('ver');
  document.body.style.overflow = '';
}

/* --------------------- Exportación de los indicadores ------------------- */

function exportarIndicadoresExcel() {
  const ExcelJSLib = LIBS.exceljs;
  if (!ExcelJSLib) { aviso('La librería de Excel no está disponible.', 'err', 8000); return; }
  const d = calcularIndicadores();
  if (!d.total) { aviso('No hay órdenes que cumplan los filtros.', 'warn'); return; }

  cargando(true, 'Generando los indicadores…');
  try {
    const wb = new ExcelJSLib.Workbook();
    wb.creator = CONFIG.autorizadoPor.nombre; wb.created = new Date();

    const cabecera = (ws, n) => {
      ws.getRow(1).height = 26;
      ws.getRow(1).eachCell(c => {
        c.font = { name: FUENTE_XLS, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006FB7' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
      });
      ws.eachRow((r, i) => { if (i > 1) r.eachCell(c => {
        c.font = { name: FUENTE_XLS, size: 10 };
        c.border = { top: B_FIN, left: B_FIN, bottom: B_FIN, right: B_FIN };
      }); });
      if (n) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: n } };
    };

    /* Alcance — para que el archivo diga de qué está hablando */
    const wa = wb.addWorksheet('Alcance');
    wa.columns = [{ header: 'Concepto', width: 34 }, { header: 'Valor', width: 56 }];
    [['Generado el', new Date().toLocaleString('es-CO')],
     ['Órdenes incluidas', d.total],
     ['Órdenes en el histórico', estado.ordenes.length],
     ['Filtro · desde', FILTROS.desde ? fechaAtexto(FILTROS.desde) : '(sin filtro)'],
     ['Filtro · hasta', FILTROS.hasta ? fechaAtexto(FILTROS.hasta) : '(sin filtro)'],
     ['Filtro · zona', FILTROS.zona || '(todas)'],
     ['Filtro · tipo', FILTROS.tipo || '(todos)'],
     ['Periodo cubierto', d.desde ? fechaAtexto(d.desde) + ' a ' + fechaAtexto(d.hasta) : '(sin fechas)'],
     ['Entradas', d.entradas], ['Salidas', d.salidas],
     ['Líneas de material', d.lineas], ['Sedes involucradas', d.sedes],
     ['ADVERTENCIA', 'Las cantidades NO se suman entre unidades distintas.'],
     ['ADVERTENCIA', 'El neto E−S no es un inventario: es la diferencia entre lo registrado.'],
     ['ADVERTENCIA', 'Solo incluye órdenes guardadas en este equipo.']
    ].forEach(f => wa.addRow(f));
    cabecera(wa, 2);

    const hojaConteo = (nombre, lista, rotulo) => {
      const ws = wb.addWorksheet(nombre);
      ws.columns = [{ header: rotulo, width: 46 }, { header: 'Entradas', width: 12 },
                    { header: 'Salidas', width: 12 }, { header: 'Total', width: 12 }];
      lista.forEach(r => ws.addRow([r.clave, r.ENTRADA, r.SALIDA, r.total]));
      cabecera(ws, 4);
    };
    hojaConteo('Por zona', d.zona, 'Zona');
    hojaConteo('Por motivo', d.motivo, 'Motivo');
    hojaConteo('Por origen', d.origen, 'Sede de origen');
    hojaConteo('Por destino', d.destino, 'Sede de destino');
    hojaConteo('Entregado por', d.entrega, 'Entregado por');
    hojaConteo('Recibido por', d.recibe, 'Recibido por');

    const wm = wb.addWorksheet('Por mes');
    wm.columns = [{ header: 'Mes', width: 12 }, { header: 'Entradas', width: 12 },
                  { header: 'Salidas', width: 12 }, { header: 'Total', width: 12 }];
    d.mes.serie.forEach(r => wm.addRow([r.clave, r.ENTRADA, r.SALIDA, r.total]));
    cabecera(wm, 4);

    const wt = wb.addWorksheet('Por material');
    wt.columns = [{ header: 'Código / UC', width: 12 }, { header: 'Descripción', width: 46 },
                  { header: 'Unidad', width: 10 }, { header: 'Entradas', width: 12 },
                  { header: 'Salidas', width: 12 }, { header: 'Neto (E-S)', width: 12 },
                  { header: 'N.º de órdenes', width: 14 }];
    d.material.forEach(m => wt.addRow([m.codigo || '', m.descripcion, m.unidad,
                                       m.entradas, m.salidas, m.neto, m.nOrdenes]));
    cabecera(wt, 7);

    wb.xlsx.writeBuffer().then(buf => {
      const fecha = new Date().toISOString().slice(0, 10);
      LIBS.descargar(new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), `Indicadores_Ordenes_SSEE_${fecha}.xlsx`);
      cargando(false);
      aviso(`Indicadores exportados: ${d.total} orden(es) en 9 hojas.`, 'ok', 6000);
    }).catch(err => { cargando(false); console.error(err); aviso('Error al escribir: ' + err.message, 'err', 8000); });

  } catch (err) {
    cargando(false); console.error(err);
    aviso('Error al generar los indicadores: ' + (err.message || err), 'err', 8000);
  }
}


/* ==========================================================================
   ▓▓▓ BLOQUE 10 — ARRANQUE Y CONEXIÓN DE EVENTOS ▓▓▓
   ========================================================================== */

function borrarDatosLocales() {
  const extra = (typeof DATOS !== 'undefined' && DATOS.handle)
    ? '\n\nEl archivo de datos vinculado («' + DATOS.nombreArchivo + '») NO se borra: podrá recuperarlo desde él.'
    : '\n\nNo hay archivo de datos vinculado, así que esta acción es IRREVERSIBLE. Exporte antes una copia de seguridad.';
  if (!confirm('¿Desea borrar TODOS los datos guardados en este navegador?\n\n' +
               'Se eliminarán: el borrador actual, las listas importadas y el histórico de órdenes.' + extra)) return;
  LS.borrar(LS.BORRADOR); LS.borrar(LS.LISTAS); LS.borrar(LS.ORDENES);
  estado.ordenes = [];
  estado.listas = {
    origenDestino: CONFIG.origenDestino.slice(),
    materiales:    CONFIG.materiales.slice(),
    fuenteOD: 'precargado', fuenteMat: 'precargado'
  };
  refrescarListas(); pintarOrdenes(); pintarAlmacenamiento(); limpiarFormulario(false);
  aviso('Se borraron los datos de este navegador. El archivo de datos vinculado NO se tocó.', 'ok', 8000);
}

function conectarEventos() {

  /* --- Barra principal --- */
  $('#btnNueva').onclick   = nuevaOrden;
  $('#btnGuardar').onclick = guardarOrden;
  $('#btnVista').onclick   = () => abrirVistaPrevia();
  $('#btnExcel').onclick   = () => exportarExcel();
  $('#btnPdf').onclick     = () => exportarPDF();
  $('#btnLimpiar').onclick = () => {
    if (limpiarFormulario(true)) aviso('Formulario limpiado.', 'ok');
  };

  /* --- Modal de vista previa --- */
  $('#btnCerrarVista').onclick = cerrarVistaPrevia;
  $('#btnExcel2').onclick = () => exportarExcel();
  $('#btnPdf2').onclick   = () => exportarPDF();
  $('#btnImprimir').onclick = () => window.print();
  $('#btnZoomMas').onclick  = () => ajustarZoom(+0.1);
  $('#btnZoomMenos').onclick = () => ajustarZoom(-0.1);
  $('#modalVista').addEventListener('click', ev => { if (ev.target.id === 'modalVista') cerrarVistaPrevia(); });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if ($('#modalVista').classList.contains('ver')) cerrarVistaPrevia();
    if ($('#modalViz').classList.contains('ver')) cerrarIndicadores();
  });
  window.addEventListener('resize', () => {
    if ($('#modalVista').classList.contains('ver')) ajustarZoom();
  });

  /* --- Materiales --- */
  $('#btnAgregarItem').onclick = agregarItem;
  $('#descripcion').onchange = ev => {
    const op = ev.target.selectedOptions[0];
    $('#unidad').value = (op && op.dataset.unidad) || '';
    if (ev.target.value) marcarOK('descripcion');
  };
  $('#cantidad').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); agregarItem(); } });
  $('#cuerpoItems').addEventListener('click', ev => {
    const b = ev.target.closest('.btn-quitar');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (confirm(`¿Quitar el ítem ${i + 1} («${estado.items[i].descripcion}») de la orden?`)) {
      estado.items.splice(i, 1);
      pintarItems();
    }
  });

  /* --- Órdenes guardadas --- */
  $('#listaOrdenes').addEventListener('click', ev => {
    const bc = ev.target.closest('[data-cargar]');
    const be = ev.target.closest('[data-eliminar]');
    if (bc) {
      const o = estado.ordenes[Number(bc.dataset.cargar)];
      if (!o) return;
      if (formularioTieneDatos() && !confirm('Se reemplazarán los datos del formulario actual. ¿Continuar?')) return;
      escribirOrden(o);
      aviso(`Orden ${o.numero} cargada en el formulario.`, 'ok');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (be) {
      const i = Number(be.dataset.eliminar);
      const o = estado.ordenes[i];
      if (o && confirm(`¿Eliminar definitivamente la orden ${o.numero} del histórico local?`)) {
        estado.ordenes.splice(i, 1);
        LS.escribir(LS.ORDENES, estado.ordenes);
        pintarOrdenes();
        aviso('Orden eliminada del histórico.', 'ok');
      }
    }
  });

  /* --- Importación de listas --- */
  const zona = $('#zonaDrop'), input = $('#archivoListas');
  // El clic y el teclado los resuelve el <label for="archivoListas"> de forma
  // nativa: replicarlos aquí abriría el diálogo DOS veces. Solo queda el
  // arrastrar-y-soltar, que no tiene equivalente nativo.
  input.onchange = ev => { procesarArchivo(ev.target.files[0]); ev.target.value = ''; };
  ['dragenter', 'dragover'].forEach(e => zona.addEventListener(e, ev => {
    ev.preventDefault(); zona.classList.add('sobre');
  }));
  ['dragleave', 'drop'].forEach(e => zona.addEventListener(e, ev => {
    ev.preventDefault(); zona.classList.remove('sobre');
  }));
  zona.addEventListener('drop', ev => {
    if (ev.dataTransfer.files && ev.dataTransfer.files[0]) procesarArchivo(ev.dataTransfer.files[0]);
  });
  /* --- Indicadores --- */
  $('#btnIndicadores').onclick = abrirIndicadores;
  $('#btnCerrarViz').onclick   = cerrarIndicadores;
  $('#btnVizExcel').onclick    = exportarIndicadoresExcel;
  $('#btnLimpiarFiltros').onclick = () => { FILTROS.limpiar(); pintarIndicadores(); };
  ['fDesde', 'fHasta', 'fZona', 'fTipo'].forEach(id =>
    $('#' + id).addEventListener('change', () => { FILTROS.desdeUI(); pintarIndicadores(); }));
  $('#modalViz').addEventListener('click', ev => { if (ev.target.id === 'modalViz') cerrarIndicadores(); });

  /* --- Almacenamiento y respaldo --- */
  $('#btnVincular').onclick      = () => DATOS.vincular();
  $('#btnSincronizar').onclick   = () => DATOS.sincronizar();
  $('#btnDesvincular').onclick   = () => DATOS.desvincular();
  $('#btnExportarCopia').onclick = () => DATOS.exportarCopia();
  $('#btnRestaurarCopia').onclick = () => $('#archivoCopia').click();
  $('#archivoCopia').onchange    = ev => { DATOS.restaurarCopia(ev.target.files[0]); ev.target.value = ''; };
  $('#btnHistoricoExcel').onclick = exportarHistoricoExcel;
  $('#buscarOrden').addEventListener('input', pintarOrdenes);

  $('#btnCargarHoja').onclick     = cargarHojaElegida;
  $('#btnRestaurarListas').onclick = restaurarListas;
  $('#btnPlantilla').onclick       = descargarPlantilla;
  $('#btnBorrarLocal').onclick     = borrarDatosLocales;

  /* --- Validación en vivo y autoguardado del borrador --- */
  const idsCampo = ['numero', 'zona', 'fecha', 'hora', 'origen', 'destino', 'motivo', 'entregado', 'recibido'];
  idsCampo.forEach(id => {
    const el = $('#' + id);
    if (!el) return;
    el.addEventListener('input',  () => { if (el.value) marcarOK(id); guardarBorrador(); });
    el.addEventListener('change', () => { if (el.value) marcarOK(id); guardarBorrador(); });
  });
  ['nota', 'empresaVig'].forEach(id => $('#' + id).addEventListener('input', guardarBorrador));

  /* Motivo abierto: mostrar el campo y medir el espacio del bloque «Motivo» */
  $('#motivo').addEventListener('change', alternarMotivoOtro);
  $('#motivoOtro').addEventListener('input', () => {
    if ($('#motivoOtro').value.trim()) marcarOK('motivoOtro');
    medirRenglones(); guardarBorrador();
  });
  $('#nota').addEventListener('input', medirRenglones);
  $('#conFirmas').addEventListener('change', guardarBorrador);
  $$('input[name=tipo]').forEach(r => r.addEventListener('change', () => { marcarOK('tipo'); guardarBorrador(); }));
  $('#cantidad').addEventListener('input', () => { if ($('#cantidad').value) marcarOK('cantidad'); });

  /* --- El formulario nunca se envía de forma tradicional --- */
  $('#formOrden').addEventListener('submit', ev => { ev.preventDefault(); return false; });
  $('#formOrden').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA' && ev.target.type !== 'submit') {
      if (ev.target.id !== 'cantidad') ev.preventDefault();
    }
  });

  /* --- Atajos de teclado --- */
  document.addEventListener('keydown', ev => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === 's')      { ev.preventDefault(); guardarOrden(); }
    else if (k === 'p') { ev.preventDefault(); exportarPDF(); }
    else if (k === 'e') { ev.preventDefault(); exportarExcel(); }
    else if (k === 'q') { ev.preventDefault(); abrirVistaPrevia(); }
    else if (k === 'i') { ev.preventDefault(); abrirIndicadores(); }
  });

  /* --- Aviso al salir con datos sin guardar --- */
  window.addEventListener('beforeunload', ev => {
    if (formularioTieneDatos()) { ev.preventDefault(); ev.returnValue = ''; }
  });
}

function iniciar() {
  try {
    LIBS.pintarEstado();
    llenarFijos();

    // Listas guardadas previamente
    const guardadas = LS.leer(LS.LISTAS, null);
    if (guardadas && guardadas.origenDestino && guardadas.origenDestino.length) {
      estado.listas = Object.assign(estado.listas, guardadas);
    }
    refrescarListas();

    // Histórico de órdenes
    FILTROS.leer();
    estado.ordenes = LS.leer(LS.ORDENES, []) || [];
    pintarOrdenes();
    pintarAlmacenamiento();
    DATOS.restaurarVinculo();          // recupera el archivo vinculado, si lo hay

    // Borrador
    const b = LS.leer(LS.BORRADOR, null);
    if (b && (b.numero || (b.items && b.items.length))) {
      escribirOrden(b);
      aviso('Se recuperó la última orden diligenciada en este navegador.', 'warn', 6000);
    } else {
      pintarItems();
    }

    conectarEventos();
    alternarMotivoOtro();

    if (!LS.disponible()) {
      aviso('El navegador tiene bloqueado el almacenamiento local: no se guardarán borradores ni listas.', 'warn', 8000);
    }
    const faltan = [];
    if (!LIBS.jspdf)   faltan.push('PDF (jsPDF)');
    if (!LIBS.exceljs) faltan.push('Excel (ExcelJS)');
    if (!LIBS.xlsx)    faltan.push('lectura de archivos (SheetJS)');
    if (faltan.length) {
      aviso('No se pudieron cargar estas librerías: ' + faltan.join(', ') +
            '. Conéctese a internet y recargue la página para habilitar esas funciones.', 'warn', 10000);
    }

    console.log('%cMódulo de Órdenes SSEE listo.', 'color:#006FB7;font-weight:bold',
      `\n· Origen/Destino: ${estado.listas.origenDestino.length}` +
      `\n· Materiales: ${estado.listas.materiales.length}` +
      `\n· Órdenes guardadas: ${estado.ordenes.length}` +
      `\n· Archivo de datos: ${DATOS.soportado ? (DATOS.handle ? DATOS.nombreArchivo : 'sin vincular') : 'no admitido por este navegador'}`);

  } catch (err) {
    console.error('Error al iniciar el módulo:', err);
    alert('Ocurrió un error al iniciar el módulo:\n\n' + (err && err.message ? err.message : err));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
