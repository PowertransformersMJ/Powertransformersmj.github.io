// Contrato del modelo flexible de bloques (domain/pruebas_electricas_bloques.js).
// Verifica forma, ACOTAMIENTO (caps de seguridad/escala) y robustez ante basura.
// Dominio puro: sin DOM ni Firestore. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarBloques, sanitizarBloque, sanitizarSerie, derivarTablaTAP, LIMITES, BLOQUES_SCHEMA_VERSION
} from '../assets/js/domain/pruebas_electricas_bloques.js';

// Bloque representativo de la IA: excitación 17 TAPs × 3 fases (curva de línea).
const EXCITACION_IA = {
  prueba: 'excitacion', titulo: 'Corriente de excitación', unidad: 'mA',
  eje_x: 'Posición del conmutador', grafica: 'linea', limite: 10, guia: 5,
  observaciones: 'Fases laterales A y C similares; comportamiento normal.',
  series: [
    { nombre: 'Fase A', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 17.964 + i })) },
    { nombre: 'Fase B', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 11.623 + i })) },
    { nombre: 'Fase C', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 18.525 + i })) }
  ],
  tabla: {
    columnas: ['TAP', 'Fase A (mA)', 'Fase B (mA)', 'Fase C (mA)', 'Desv. %'],
    filas: [['1', '17.964', '11.623', '18.525', '3.0'], ['17', '27.722', '18.841', '28.018', '1.06']]
  }
};

describe('sanitizarBloques · forma y versión', () => {
  const out = sanitizarBloques([EXCITACION_IA]);
  test('devuelve {schema_version, bloques}', () => {
    assert.equal(out.schema_version, BLOQUES_SCHEMA_VERSION);
    assert.equal(out.bloques.length, 1);
  });
  test('conserva la curva completa (17 puntos × 3 series)', () => {
    const b = out.bloques[0];
    assert.equal(b.series.length, 3);
    assert.equal(b.series[0].puntos.length, 17);
    assert.deepEqual(b.series[0].puntos[0], { x: 1, y: 17.964 });
    assert.equal(b.grafica, 'linea');
    assert.equal(b.limite, 10);
  });
  test('conserva la tabla de detalle', () => {
    assert.equal(out.bloques[0].tabla.columnas.length, 5);
    assert.equal(out.bloques[0].tabla.filas.length, 2);
  });
});

describe('sanitizarBloques · acotamiento (seguridad/escala)', () => {
  test('trunca bloques al tope', () => {
    const muchos = Array.from({ length: LIMITES.BLOQUES + 10 }, () => EXCITACION_IA);
    assert.equal(sanitizarBloques(muchos).bloques.length, LIMITES.BLOQUES);
  });
  test('trunca puntos por serie al tope', () => {
    const s = sanitizarSerie({ nombre: 'X', puntos: Array.from({ length: LIMITES.PUNTOS + 50 }, (_, i) => ({ x: i, y: i })) });
    assert.equal(s.puntos.length, LIMITES.PUNTOS);
  });
  test('trunca series al tope', () => {
    const b = sanitizarBloque({ titulo: 'T', series: Array.from({ length: LIMITES.SERIES + 5 }, () => ({ nombre: 'S', puntos: [{ x: 1, y: 1 }] })) });
    assert.equal(b.series.length, LIMITES.SERIES);
  });
});

describe('sanitizarBloques · robustez', () => {
  test('grafica inválida → cae a "linea"', () => {
    assert.equal(sanitizarBloque({ titulo: 'T', grafica: 'pastel', series: [{ nombre: 'a', puntos: [{ x: 1, y: 2 }] }] }).grafica, 'linea');
  });
  test('descarta bloques sin título o sin datos', () => {
    const out = sanitizarBloques([{ titulo: '', series: [] }, { titulo: 'Vacío', series: [], tabla: {} }, EXCITACION_IA]);
    assert.equal(out.bloques.length, 1);
  });
  test('x puede ser etiqueta (no numérica) — p.ej. par de devanados', () => {
    const b = sanitizarBloque({ titulo: 'Aislamiento', grafica: 'barra', series: [{ nombre: 'GΩ', puntos: [{ x: 'AT-MT', y: 6.01 }, { x: 'AT-BT', y: 6.17 }] }] });
    assert.equal(b.series[0].puntos[0].x, 'AT-MT');
    assert.equal(b.series[0].puntos[0].y, 6.01);
  });
  test('entrada basura no rompe (null/strings/números)', () => {
    assert.deepEqual(sanitizarBloques(null).bloques, []);
    assert.deepEqual(sanitizarBloques('x').bloques, []);
    assert.doesNotThrow(() => sanitizarBloques([null, 5, 'a', {}]));
  });
  test('coma decimal en y se normaliza a número', () => {
    const b = sanitizarBloque({ titulo: 'T', series: [{ nombre: 's', puntos: [{ x: 1, y: '0,51' }] }] });
    assert.equal(b.series[0].puntos[0].y, 0.51);
  });
  test('verificar=true marca el punto; se omite cuando falta o es false', () => {
    const b = sanitizarBloque({ titulo: 'T', grafica: 'barra', series: [{ nombre: 's', puntos: [
      { x: 1, y: 5, verificar: true },
      { x: 2, y: 6 },
      { x: 3, y: 7, verificar: false }
    ] }] });
    const pts = b.series[0].puntos;
    assert.equal(pts[0].verificar, true);
    assert.ok(!('verificar' in pts[1])); // punto limpio
    assert.ok(!('verificar' in pts[2])); // false no se persiste
  });
});

describe('derivarTablaTAP · tabla completa derivada de las series', () => {
  // Excitación: 3 fases (A y C laterales, B central-menor) + extra P(W).
  const exc = {
    prueba: 'excitacion', eje_x: 'Posición del TAP', limite_desbalance: 10,
    series: [
      { nombre: 'Fase A', puntos: [{ x: 1, y: 17.964, extra: { 'P (W)': 156.367 } }, { x: 2, y: 18.356, extra: { 'P (W)': 158.378 } }] },
      { nombre: 'Fase B', puntos: [{ x: 1, y: 11.623 }, { x: 2, y: 11.881 }] },
      { nombre: 'Fase C', puntos: [{ x: 1, y: 18.525, extra: { 'P (W)': 158.868 } }, { x: 2, y: 18.831, extra: { 'P (W)': 160.524 } }] }
    ]
  };

  test('columnas: TAP + fases + extra×fase + Desv. % (SIN columna de veredicto/Eval.)', () => {
    const t = derivarTablaTAP(exc);
    assert.deepEqual(t.columnas, [
      'Posición del TAP', 'Fase A', 'Fase B', 'Fase C',
      'P (W) · Fase A', 'P (W) · Fase B', 'P (W) · Fase C',
      'Desv. %'
    ]);
    assert.ok(!t.columnas.some((c) => /eval|veredicto|calific/i.test(c)));
  });

  test('Desviación de excitación = entre las DOS laterales mayores (no la central)', () => {
    const t = derivarTablaTAP(exc);
    const fila1 = t.filas[0];
    // laterales mayores C=18.525, A=17.964 → (18.525-17.964)/18.525*100 = 3.028%
    // (÷ la MAYOR, como el informe del laboratorio: TAP1 = 3.0%). Es la ÚLTIMA
    // columna: ya no hay "Eval." (el veredicto es del panel multi-norma, L-42).
    assert.equal(fila1[fila1.length - 1], 3.028);
  });

  test('extra se ubica en su columna por fase; fase sin extra queda vacía', () => {
    const t = derivarTablaTAP(exc);
    const fila1 = t.filas[0];
    assert.equal(fila1[4], 156.367); // P(W) Fase A
    assert.equal(fila1[5], '');      // P(W) Fase B (no traía extra)
    assert.equal(fila1[6], 158.868); // P(W) Fase C
  });

  test('la Desv. % es la última columna y es un DATO (no un veredicto "OK")', () => {
    const res = {
      prueba: 'resistencia', eje_x: 'TAP', limite_desbalance: 5,
      series: [
        { nombre: 'Fase A', puntos: [{ x: 1, y: 100 }] },
        { nombre: 'Fase B', puntos: [{ x: 1, y: 100 }] },
        { nombre: 'Fase C', puntos: [{ x: 1, y: 120 }] } // promedio ~106.7 → C se aparta ~12.5%
      ]
    };
    const t = derivarTablaTAP(res);
    assert.equal(t.columnas[t.columnas.length - 1], 'Desv. %');
    assert.ok(!t.columnas.some((c) => /eval|veredicto|calific/i.test(c)));
    const fila = t.filas[0];
    // la celda es el número de desviación, NO "OK"/"verificar"
    assert.equal(typeof fila[fila.length - 1], 'number');
  });

  test('sin umbral: columna Desv. % presente, sin columna de veredicto', () => {
    const t = derivarTablaTAP({ prueba: 'relacion', eje_x: 'TAP', series: exc.series.slice(0, 3) });
    assert.ok(t.columnas.includes('Desv. %'));
    assert.ok(!t.columnas.some((c) => /eval|veredicto|calific/i.test(c)));
  });

  test('serie única (sin fases): sin Desv. ni Eval.', () => {
    const t = derivarTablaTAP({ eje_x: 'Config', series: [{ nombre: 'DAR', puntos: [{ x: 'AT-MT', y: 1.2 }] }] });
    assert.deepEqual(t.columnas, ['Config', 'DAR']);
  });

  test('sin series → tabla vacía', () => {
    assert.deepEqual(derivarTablaTAP({ series: [] }), { columnas: [], filas: [] });
  });

  test('relación: Desv. usa el %DIF reportado (peor caso firmado), no el promedio', () => {
    const rel = {
      prueba: 'relacion', eje_x: 'TAP', limite_desbalance: 0.5,
      series: [
        { nombre: 'Fase A', puntos: [{ x: 6, y: 3.3057, extra: { '%DIF': -0.07 } }] },
        { nombre: 'Fase B', puntos: [{ x: 6, y: 3.3059, extra: { '%DIF': -0.06 } }] },
        { nombre: 'Fase C', puntos: [{ x: 6, y: 3.2663, extra: { '%DIF': -1.26 } }] }
      ]
    };
    const fila = derivarTablaTAP(rel).filas[0];
    // Desv. % es la ÚLTIMA columna (ya no hay "Eval."): el peor %DIF firmado.
    // El veredicto (|1.26| > 0.5 → fuera de norma) lo da el panel multi-norma.
    assert.equal(fila[fila.length - 1], -1.26);
  });
});
