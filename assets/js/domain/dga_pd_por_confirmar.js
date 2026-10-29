// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Triángulo de Duval · «PD POR CONFIRMAR (hidrógeno muy alto)» (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (punto 2 de la página del 27-oct, «procede con las recomendadas»): los equipos que el triángulo 1
// pone en descargas parciales (PD) con 2.000 ppm de hidrógeno o más se rotulan «PD por confirmar (hidrógeno muy alto)»: el
// triángulo 1 no separa una descarga parcial del gas que produce el propio aceite a temperatura de servicio (IEEE
// C57.104-2019 §4.1). Y se arregla el texto que chocaba: decía que la carga no mueve ese defecto, mientras el panel mismo
// dice que el gas del aceite crece con la temperatura. Hasta la lectura del laboratorio (informes originales, muestra
// nueva, triángulos 4 y 5) no se da por cierto ninguno de los dos. Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** Hidrógeno (ppm) desde el que una zona PD se da «por confirmar». */
export const H2_PD_POR_CONFIRMAR = 2000;

export const ROTULO_PD_POR_CONFIRMAR = 'PD por confirmar (hidrógeno muy alto)';

export const TEXTO_TENDENCIA_PD_POR_CONFIRMAR = 'Si es una descarga parcial, la carga no la mueve: depende de la tensión. Pero con tanto hidrógeno '
  + 'puede ser gas del propio aceite a temperatura de servicio, sin falla (IEEE C57.104-2019 §4.1), y ese sí crece con la temperatura. '
  + 'El triángulo 1 no los separa: hace falta la lectura del laboratorio (informes originales, una muestra nueva y los triángulos 4 y 5).';

/** Para la tabla de ritmos: el origen de los gases de descarga cuando la zona PD está por confirmar. */
export const ORIGEN_PD_POR_CONFIRMAR = 'descarga (× 1) o gas del propio aceite (crece con la temperatura): por confirmar';

/** ¿La zona de Duval del equipo es PD con hidrógeno muy alto? (`d` = `duvalDeEquipo`; solo con zona concluyente) */
export function pdPorConfirmar(d) {
  const h2 = d && d.ultima && d.ultima.gases ? d.ultima.gases.H2 : null;
  return !!(d && d.estado === 'ok' && d.zona === 'PD' && typeof h2 === 'number' && h2 >= H2_PD_POR_CONFIRMAR);
}
