// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Recomendaciones / sugerencias de diagnóstico · dominio puro
// ──────────────────────────────────────────────────────────────
// Cuando el veredicto NO es un aprobado limpio (normas que divergen, valor fuera
// de rango, dato sospechoso/faltante o sin umbral duro), el tablero deja una
// SUGERENCIA accionable para investigar / determinar el estado del transformador,
// conforme a la skill `pruebas-electricas/*/references/04-diagnostico.md` +
// `_conocimiento/{diagnostico-integrado-bateria,gestion-mantenimiento-predictivo}.md`.
//
// Principio rector (batería integrada): un solo hallazgo = INVESTIGAR; dos o más
// CONVERGENTES = diagnóstico. El motor predictivo es la TENDENCIA, no el valor
// puntual (IEEE C57.152). Funciones puras, sin DOM. node --test.
// ══════════════════════════════════════════════════════════════

import { ESTADOS } from './pruebas_electricas_semaforo.js';

// Por familia: recomendación según el nivel del veredicto consolidado.
// aprueba (verde) · investigar (ámbar/naranja) · rechaza (rojo) · faltante (sin dato).
const RECOMENDACIONES = Object.freeze({
  tand: {
    aprueba: 'Dentro de norma; registrar FP₂₀ por modo (CH/CL/CHL), capacitancia y T como baseline. Re-ensayo rutinario (1–3 años).',
    investigar: 'Repetir con bujes limpios; medir IR/PI y agua en aceite (D1533); correr tip-up si falta; correlacionar con DGA y comparar histórico antes de escalar.',
    rechaza: 'FP₂₀ muy por encima del límite / tip-up fuerte: tratar según causa (secado si humedad, regeneración si aceite); si persiste, inspección interna.',
    faltante: 'Estabilizar T antes de corregir (usar factor del fabricante); verificar el modo GST/UST correcto antes de concluir.'
  },
  bushing: {
    aprueba: 'Dentro de norma; registrar FP₂₀, C1 y C2 como baseline y seguir la TENDENCIA de C1 (lo decisivo). Re-ensayo rutinario.',
    investigar: 'ΔC1 5–10% / ΔFP >50% de placa / hot-collar >0.1 W: repetir limpio, comparar fases homólogas, correr DGA y acortar el intervalo; planificar reemplazo si la deriva se confirma.',
    rechaza: 'ΔC1 >10% o C1 en ascenso (capa en corto) → RIESGO DE EXPLOSIÓN: sacar de servicio y reemplazar el buje (condena por sí solo, sin esperar convergencia).',
    faltante: 'Superficie sucia/húmeda (salinidad del Caribe) sube el FP por fuga externa: limpiar y repetir; verificar el cableado del tap (C1/C2).'
  },
  excitacion: {
    aprueba: 'Patrón 2+1 sano; registrar I_exc por fase/TAP y tensión de prueba como baseline.',
    investigar: 'Desmagnetizar y repetir (magnetismo residual es el falso positivo #1); medir TTR y resistencia de devanados — la excitación anómala SOLA solo es "investigar", se vuelve espira en corto al converger con TTR>0.5% y/o R desbalanceada en la misma fase.',
    rechaza: 'Espira en corto / defecto de núcleo confirmado por convergencia: no energizar; inspección interna / reparación.',
    faltante: 'Medir a la misma tensión que el dato de fábrica y desmagnetizar antes (sobre todo tras prueba DC).'
  },
  relacion: {
    aprueba: 'Dentro de ±0.5%; registrar relación teórica, %dev por fase/TAP y desfase como baseline.',
    investigar: 'Repetir con conexiones verificadas y núcleo desmagnetizado; medir excitación y R de devanados; si la desviación es uniforme en las 3 fases con el mismo signo, recalcular la relación teórica (factor √3 del grupo) — puede ser dato de placa, no falla.',
    rechaza: 'Espira en corto / devanado abierto / desfase errado: no energizar; inspección interna / reparación en fábrica.',
    faltante: 'Confirmar el grupo de conexión y la tensión declarada antes de concluir.'
  },
  resistencia: {
    aprueba: 'Desbalance dentro de norma; registrar Rs por fase/TAP, T de medida y Ts como baseline.',
    investigar: 'Verificar montaje Kelvin (4 hilos) y estabilización térmica; corregir a la misma Ts; reapretar conexiones accesibles; correlacionar con TTR, excitación y termografía bajo carga; comparar histórico.',
    rechaza: 'Devanado abierto / espira en corto / contacto del conmutador degradado: planificar intervención (reapriete u overhaul del LTC) o inspección interna.',
    faltante: 'La lectura "fluye" al inicio por inductancia: esperar estabilización y registrar la T del devanado; corriente de prueba ≤10% In; verificar el montaje Kelvin antes de condenar una fase.'
  },
  aislamiento: {
    aprueba: 'IR/PI dentro de norma; registrar IR₂₀, PI/DAR y T como baseline de tendencia.',
    investigar: 'Repetir con bujes limpios y terminal de guarda; medir FP/tan δ y agua en aceite (D1533); si pasa el piso NETA pero falla por clase, es aislamiento POBRE (no sano) — acortar intervalo y vigilar tendencia.',
    rechaza: 'PI<1.0 o IR muy por debajo del mínimo: no energizar; secado (vacío/calor) y reensayo; si persiste, inspección interna.',
    faltante: 'PI/DAR requiere la curva 30 s / 1 min / 10 min; verificar T estabilizada (top-oil) y el voltaje de prueba por clase (Tabla 100.5).'
  },
  collar: {
    aprueba: 'Pérdidas del collar dentro de norma; registrar como baseline del buje.',
    investigar: 'Pérdidas > 100 mW: repetir con superficie limpia y seca; comparar entre bujes; correr FP/C1 del buje y DGA.',
    rechaza: 'Pérdidas muy altas: planificar reemplazo del buje y revisar riesgo asociado.',
    faltante: 'Verificar el montaje del collar y la limpieza de la superficie antes de concluir.'
  },
  _generico: {
    aprueba: 'Dentro de norma; registrar el valor como baseline y mantener el seguimiento periódico (la tendencia manda sobre el valor puntual).',
    investigar: 'Resultado marginal o normas divergentes: correlacionar con las pruebas convergentes de la batería, comparar contra el histórico y acortar el intervalo de re-ensayo.',
    rechaza: 'Fuera de norma: priorizar según criticidad del activo × severidad; planificar la acción correctiva e inspección dirigida.',
    faltante: 'Dato insuficiente o sospechoso: confirmar la medición (método, temperatura, montaje) antes de emitir un veredicto.'
  }
});

function nivelDe(estado) {
  if (!estado || estado.nivel == null || estado.nivel < 0) return 'faltante';
  if (estado.nivel === 0) return 'aprueba';
  if (estado.nivel >= ESTADOS.ROJO.nivel) return 'rechaza';
  return 'investigar';
}

// Tipo de acción de mantenimiento por nivel de veredicto (taxonomía CBM/PdM):
//   aprueba → PREVENTIVA (rutina programada, prevenir antes del problema)
//   investigar → PREDICTIVA (basada en condición/tendencia, anticipar la falla)
//   rechaza → CORRECTIVA (corregir una falla ya presente)
//   faltante → DIAGNÓSTICA (confirmar la medición antes de concluir)
const TIPO_ACCION = Object.freeze({
  aprueba:    { tipo: 'preventiva',  etiqueta: 'Preventiva',  clase: 'b-g' },
  investigar: { tipo: 'predictiva',  etiqueta: 'Predictiva',  clase: 'b-a' },
  rechaza:    { tipo: 'correctiva',  etiqueta: 'Correctiva',  clase: 'b-r' },
  faltante:   { tipo: 'diagnostica', etiqueta: 'Diagnóstica', clase: 'b-n' }
});

function textoNivel(familia, nivel, divergen) {
  const set = RECOMENDACIONES[familia] || RECOMENDACIONES._generico;
  let txt = set[nivel] || RECOMENDACIONES._generico[nivel];
  if (divergen && nivel !== 'faltante') {
    txt = `Las normas divergen — prima el criterio más conservador. ${txt}`;
  }
  return txt;
}

/**
 * Recomendación de diagnóstico para una prueba según su veredicto consolidado.
 * @param {string} familia
 * @param {{estado:object, divergen?:boolean}} ctx  estado consolidado + si las normas divergen
 * @returns {string}
 */
export function recomendarPrueba(familia, ctx = {}) {
  return textoNivel(familia, nivelDe(ctx.estado), ctx.divergen);
}

/**
 * Acción de mantenimiento CLASIFICADA (predictiva/preventiva/correctiva/diagnóstica)
 * para una prueba, sensible a la TENDENCIA: una prueba verde pero que EMPEORA
 * notablemente (≥5% relativo informe a informe) sube a PREDICTIVA (vigilar la
 * deriva, IEEE C57.152: la tendencia manda sobre el valor puntual). Marca
 * `relevante` los cambios que merecen resalte (fuera de norma, marginal, o deriva).
 * @param {string} familia
 * @param {{estado:object, tendencia?:string, delta?:number, divergen?:boolean}} ctx
 * @returns {{tipo:string, etiqueta:string, clase:string, relevante:boolean, texto:string}}
 */
export function accionPrueba(familia, ctx = {}) {
  let nivel = nivelDe(ctx.estado);
  const empeoraFuerte = ctx.tendencia === 'empeora' && Math.abs(Number(ctx.delta) || 0) >= 5;
  if (nivel === 'aprueba' && empeoraFuerte) nivel = 'investigar';
  const t = TIPO_ACCION[nivel];
  return {
    tipo: t.tipo,
    etiqueta: t.etiqueta,
    clase: t.clase,
    relevante: nivel === 'rechaza' || nivel === 'investigar',
    texto: textoNivel(familia, nivel, ctx.divergen)
  };
}

export { RECOMENDACIONES, TIPO_ACCION };
