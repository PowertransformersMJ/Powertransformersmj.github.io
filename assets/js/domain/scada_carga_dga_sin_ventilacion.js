// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · panel «Gases disueltos (DGA) y carga» SIN textos de ventilación · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Orden del Ingeniero: «no mezcles cargabilidad con ventilacion son dos cosas diferentes» → «Quitarlos de Cargabilidad».
// Los textos del panel que hablan de ventiladores salen de Cargabilidad (van al frente de refrigeración, TODO-80): dos ítems
// enteros, dos frases sueltas y un renglón de «Lo que este panel no puede saber». Como con las variantes de ppm
// (`scada_carga_dga_textos_ppm.js`), el catálogo NO se edita: aquí se filtra lo que el panel muestra. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** Ítems del catálogo que salen enteros: «si fallan los ventiladores…» y «verificar el sistema de enfriamiento…». */
export const QUITAR_VENTILACION = Object.freeze(['ADV-R1-02', 'ACC-R1-02']);

/** Frases de ventilación que salen de otros ítems (el resto del texto queda igual). */
export const FRASES_VENTILACION = Object.freeze({
  'ADV-R1-03': ' La salida de una etapa de ventilación deja además al equipo sin reserva.',
  'ACC-R2-01': ' Si el equipo tiene ventiladores, el plan incluye arrancarlos antes de la franja de máxima demanda, porque el aceite tarda horas en calentarse.'
});

/** El renglón de «Lo que este panel no puede saber» que sale. */
export const PREFIJO_NO_PUEDE_SABER_VENTILACION = 'Si los ventiladores estaban en marcha';

/** Los ítems del cruce sin los de ventilación y sin sus frases (copias: el catálogo no cambia). */
export function sinVentilacion(items) {
  return (items || []).filter((it) => it && !QUITAR_VENTILACION.includes(it.id)).map((it) => {
    const f = FRASES_VENTILACION[it.id];
    return f && typeof it.texto === 'string' && it.texto.includes(f) ? { ...it, texto: it.texto.replace(f, '') } : it;
  });
}

/** «Lo que este panel no puede saber» sin el renglón de los ventiladores. */
export function noPuedeSaberSinVentilacion(lista) {
  return (lista || []).filter((t) => !(typeof t === 'string' && t.startsWith(PREFIJO_NO_PUEDE_SABER_VENTILACION)));
}
