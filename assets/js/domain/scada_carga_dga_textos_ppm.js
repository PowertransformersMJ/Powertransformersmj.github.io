// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · panel «Gases disueltos (DGA) y carga» · textos cuando el equipo YA TIENE
// las ppm de la última muestra · `99 §133`
// ──────────────────────────────────────────────────────────────────────────────
// Desde `§131` la plataforma guarda las partes por millón (ppm) de la última DGA (`ultima_dga`) y el panel «Triángulo
// de Duval», debajo de este, sugiere el tipo de defecto. Para un equipo CON ppm, tres ítems del catálogo
// (`scada_carga_dga_textos.js`, en BORRADOR) que mandaban a pedir esas ppm o no las mencionaban se reemplazan por estas
// variantes; sin ppm siguen los originales. El ítem del tipo de defecto de «Lo que este panel no puede saber» se
// reemplaza SIEMPRE (con o sin ppm): su original («La plataforma guarda calificaciones de 1 a 5») ya no es cierto.
// Pedido del Ingeniero 2026-10-02: «ajusta el texto del panel DGA sobre las ppm». El catálogo no se edita.
// Archivo NUEVO a propósito (L-102). Solo datos y funciones puras.
// ══════════════════════════════════════════════════════════════════════════════

/** Ítems del catálogo (por id) con su texto para un equipo que ya tiene las ppm de la última muestra. */
export const TEXTOS_CON_PPM = Object.freeze({
  'ADV-D-01': 'La calificación de gases Pobre o Muy Pobre señala dos causas posibles: un defecto interno o un papel envejecido o recalentado. Las partes por millón (ppm) de cada gas y su tendencia indican cuál de las dos es. Las de la última muestra están en el panel del triángulo de Duval, más abajo; la tendencia sale de comparar dos muestras con fecha de toma: el laboratorio la calcula con su historial y la muestra nueva la confirma. Si el defecto es térmico y está en una conexión o en un contacto por donde pasa la corriente, la carga alta lo agrava.',
  'ADV-G-TDGC': 'La calificación de gases combustibles (hidrógeno, metano, etano y etileno) está en 4 o 5, aunque la calificación global los promedia con el CO, el CO₂ y el acetileno. Estos gases provienen de un defecto en el aceite, térmico o eléctrico. Las partes por millón (ppm) de cada uno indican de cuál se trata: cuando hay gas suficiente, el panel del triángulo de Duval, más abajo, lo sugiere con las de la última muestra.',
  'ACC-DE-02': 'Las partes por millón (ppm) de la última muestra ya están en la plataforma (panel del triángulo de Duval, más abajo). Pedir al laboratorio el diagnóstico del tipo de defecto según IEC 60599 y la velocidad de generación entre muestras, y tomar una muestra nueva con su fecha de toma. Si se confirma un defecto interno activo, programar la inspección de la parte activa para localizarlo.',
});

/** «Lo que este panel no puede saber»: el ítem del tipo de defecto, según el equipo tenga o no las ppm cargadas. */
export const NO_PUEDE_SABER_TIPO = Object.freeze({
  prefijo: 'El tipo de defecto que produce los gases',
  conPpm: 'El tipo de defecto que produce los gases (térmico o eléctrico) y su temperatura. Este panel usa solo las calificaciones de 1 a 5; el panel del triángulo de Duval, más abajo, lo sugiere con las partes por millón (ppm) de la última muestra cuando hay gas suficiente. El diagnóstico completo de IEC 60599 lo hace el laboratorio y necesita la velocidad de generación entre dos muestras con fecha.',
  sinPpm: 'El tipo de defecto que produce los gases (térmico o eléctrico) y su temperatura. Este equipo aún no tiene en la plataforma las partes por millón (ppm) de cada gas; cuando se carguen, el panel del triángulo de Duval, más abajo, sugerirá el tipo de defecto si hay gas suficiente. El diagnóstico completo de IEC 60599 lo hace el laboratorio.',
});

/** Texto de un ítem del catálogo para este equipo. */
export function textoItem(it, conPpm) {
  return (conPpm && it && TEXTOS_CON_PPM[it.id]) || (it ? it.texto : '');
}

/** La lista «Lo que este panel no puede saber» con el ítem del tipo de defecto ajustado a si hay ppm. */
export function noPuedeSaber(lista, conPpm) {
  return (lista || []).map((t) => (typeof t === 'string' && t.startsWith(NO_PUEDE_SABER_TIPO.prefijo)
    ? (conPpm ? NO_PUEDE_SABER_TIPO.conPpm : NO_PUEDE_SABER_TIPO.sinPpm) : t));
}
