// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: KPIs y analítica RAM (Fase 8)
// Agregaciones cliente-side sobre `transformadores` + `ordenes`.
// No persiste nada: recalcula bajo demanda desde Firestore.
// ══════════════════════════════════════════════════════════════

import { listar as listarTransformadores, departamentoLabel }
  from './transformadores.js';
import { listar as listarOrdenes } from './ordenes.js';
import { isFirebaseConfigured } from '../firebase-init.js';
import {
  LIMITE_TRANSFORMADORES, LIMITE_ORDENES, LIMITE_EXPORT, diagnosticoLectura
} from '../domain/limites_lectura.js';
import { computeFromDatasets } from '../domain/kpis_compute.js';

// `computeFromDatasets` es cálculo puro y ya vive en el dominio, donde los
// tests pueden importarlo sin arrastrar Firebase. Se re-exporta aquí con el
// mismo nombre para no tocar ningún llamador (ADR-063).
export { computeFromDatasets };

export function isReady() { return isFirebaseConfigured; }

// ── Agregación principal ──
// Devuelve un snapshot listo para renderizar en el dashboard.
export async function computeDashboard() {
  // Topes EXPLÍCITOS: el tablero agrega el parque y las órdenes, y sin
  // `limit()` cada apertura costaba N lecturas facturables. El porqué de
  // los números está en domain/limites_lectura.js.
  const [trafos, ords] = await Promise.all([
    listarTransformadores({ limite: LIMITE_TRANSFORMADORES }),
    listarOrdenes({ limite: LIMITE_ORDENES })
  ]);
  const snap = computeFromDatasets(trafos, ords);
  // Trazabilidad: si alguna lectura se pegó al tope, el tablero está
  // mostrando una foto parcial y debe poder decirlo (no se oculta).
  snap.lecturas = [
    diagnosticoLectura('transformadores', trafos.length, LIMITE_TRANSFORMADORES),
    diagnosticoLectura('ordenes', ords.length, LIMITE_ORDENES)
  ];
  return snap;
}

// ── Export CSV (plano de órdenes con nombre legible de transformador) ──
export async function exportarOrdenesCSV() {
  // Un export SÍ quiere el universo, pero tampoco puede ser infinito:
  // techo duro de descarga puntual (domain/limites_lectura.js).
  const [trafos, ords] = await Promise.all([
    listarTransformadores({ limite: LIMITE_EXPORT }),
    listarOrdenes({ limite: LIMITE_EXPORT })
  ]);
  const trafoById = new Map(trafos.map((t) => [t.id, t]));
  const headers = [
    'codigo','titulo','transformador_codigo','transformador_nombre','departamento',
    'tipo','prioridad','estado','tecnico',
    'fecha_programada','fecha_inicio','fecha_cierre','duracion_horas'
  ];
  const rows = ords.map((o) => {
    const t = trafoById.get(o.transformadorId) || {};
    return [
      o.codigo, o.titulo,
      t.codigo || o.transformadorCodigo || '',
      t.nombre || '',
      departamentoLabel(t.departamento || ''),
      o.tipo, o.prioridad, o.estado, o.tecnico || '',
      o.fecha_programada || '', o.fecha_inicio || '', o.fecha_cierre || '',
      o.duracion_horas ?? ''
    ];
  });
  const esc = (v) => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
