// Contrato del modelo flexible de bloques (domain/pruebas_electricas_bloques.js).
// Verifica forma, ACOTAMIENTO (caps de seguridad/escala) y robustez ante basura.
// Dominio puro: sin DOM ni Firestore. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarBloques, sanitizarBloque, sanitizarSerie, derivarTablaTAP, LIMITES, BLOQUES_SCHEMA_VERSION,
  quitarColumnasVeredicto, derivarBushing, bloquesMultiAno, etiquetaFecha, ordenInforme
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

describe('quitarColumnasVeredicto (L-42 · ninguna columna OK/Correcto)', () => {
  test('quita por ENCABEZADO "Evaluación" (informe 2023)', () => {
    const t = { columnas: ['Buje', 'Tan δ medida (%)', 'Evaluación'], filas: [['H1', 0.42, 'OK'], ['H2', 0.45, 'OK']] };
    const r = quitarColumnasVeredicto(t);
    assert.deepEqual(r.columnas, ['Buje', 'Tan δ medida (%)']);
    assert.deepEqual(r.filas, [['H1', 0.42], ['H2', 0.45]]);
  });
  test('quita por ENCABEZADO "Resultado" (informe 2021 · Applus)', () => {
    const t = { columnas: ['Configuración', 'R (GΩ)', 'Resultado'], filas: [['AT-BT', 18.38, 'OK'], ['AT-T', 12.63, 'OK']] };
    const r = quitarColumnasVeredicto(t);
    assert.deepEqual(r.columnas, ['Configuración', 'R (GΩ)']);
  });
  test('quita por CONTENIDO aunque el encabezado sea raro (todas las celdas = veredicto)', () => {
    const t = { columnas: ['Devanado', 'Δ%', 'Dictamen X'], filas: [['AT', 0.5, 'Correcto'], ['BT', 0.52, 'Satisfactorio']] };
    const r = quitarColumnasVeredicto(t);
    assert.deepEqual(r.columnas, ['Devanado', 'Δ%']);
  });
  test('NO quita columnas de DATOS (Modo GST/UST, números)', () => {
    const t = { columnas: ['#', 'Modo', 'Cap (pF)', 'Tan δ (%)'], filas: [[1, 'GST', 5734, 0.18], [2, 'UST', 3500, 0.20]] };
    const r = quitarColumnasVeredicto(t);
    assert.deepEqual(r.columnas, ['#', 'Modo', 'Cap (pF)', 'Tan δ (%)']);
  });
  test('"A vigilar"/"Investigar" también cuentan como veredicto', () => {
    const t = { columnas: ['Buje', 'DF%', 'Estado'], filas: [['U', 0.61, 'A vigilar'], ['V', 0.79, 'Investigar']] };
    const r = quitarColumnasVeredicto(t);
    assert.deepEqual(r.columnas, ['Buje', 'DF%']);
  });
  test('sin columnas → devuelve igual', () => {
    assert.deepEqual(quitarColumnasVeredicto({ columnas: [], filas: [] }), { columnas: [], filas: [] });
  });
});

describe('derivarBushing · FP canónico (peor tan δ + peor ΔC1 vs placa) — ADR-016', () => {
  const bloqueBuje = (puntos) => ({ prueba: 'bushing', titulo: 'Bujes', series: [{ nombre: 'C1', puntos }] });

  test('sin bloques de buje → null', () => {
    assert.equal(derivarBushing([]), null);
    assert.equal(derivarBushing([{ prueba: 'excitacion', series: [] }]), null);
    assert.equal(derivarBushing(null), null);
  });

  test('toma el PEOR tan δ (y máx) entre puntos/series', () => {
    const r = derivarBushing([bloqueBuje([{ x: 1, y: 0.31 }, { x: 2, y: 0.55 }, { x: 3, y: 0.28 }])]);
    assert.equal(r.fp_max_pct, 0.55);
    assert.equal(r.dc1_max_pct, null); // sin capacitancias → sin ΔC1
  });

  test('ΔC1 = |medida - placa| / placa * 100, peor caso', () => {
    const r = derivarBushing([bloqueBuje([
      { x: 1, y: 0.3, extra: { 'Cap. placa (pF)': 400, 'Cap. medida (pF)': 404 } }, // 1.0%
      { x: 2, y: 0.3, extra: { 'Cap placa (pF)': 400, 'Cap medida (pF)': 410 } }     // 2.5% (alias sin punto)
    ])]);
    assert.equal(r.dc1_max_pct, 2.5);
    assert.equal(r.fp_max_pct, 0.3);
  });

  test('reconoce "buje" además de "bushing"; ignora placa 0 o no numérica', () => {
    const r = derivarBushing([{ prueba: 'Buje C1', series: [{ puntos: [
      { x: 1, y: 0.4, extra: { 'Cap. placa (pF)': 0, 'Cap. medida (pF)': 10 } },     // placa 0 → ignora ΔC1
      { x: 2, y: 0.2, extra: { 'Cap. placa (pF)': 'x', 'Cap. medida (pF)': 10 } }    // no numérica → ignora
    ] }] }]);
    assert.equal(r.fp_max_pct, 0.4);
    assert.equal(r.dc1_max_pct, null);
  });
});

describe('bloquesMultiAno · informe × fase superpuestos (conserva fases y NO colapsa años)', () => {
  const inf = (ano, fecha, bloques) => ({ ano, fecha, id: fecha, bloques });
  const exc = (vals) => ({ prueba: 'excitacion', titulo: 'Corriente de excitación', unidad: 'mA', eje_x: 'TAP', grafica: 'linea', limite: 30,
    series: [{ nombre: 'Fase A', puntos: vals.map((y, i) => ({ x: i + 1, y })) }] });

  test('una serie por (informe × fase); etiqueta con fecha; _rep único; ordenadas por año', () => {
    const out = bloquesMultiAno([
      inf(2023, '09/11/2023', [exc([20, 21])]),
      inf(2021, '18/01/2021', [exc([18, 19])])
    ]);
    assert.equal(out.length, 1);
    const b = out[0];
    assert.equal(b.series.length, 2);
    assert.deepEqual(b.series.map((s) => s.nombre), ['18/01/2021 · Fase A', '09/11/2023 · Fase A']);
    assert.deepEqual(b.series.map((s) => s._ano), ['2021', '2023']);
  });

  test('REGRESIÓN: DOS informes del MISMO año NO se colapsan (cada uno su serie/_rep)', () => {
    const out = bloquesMultiAno([
      inf(2021, '18/01/2021', [exc([18])]),
      inf(2021, '20/09/2021', [exc([19])])
    ]);
    const b = out[0];
    assert.equal(b.series.length, 2, 'ambos informes de 2021 deben aparecer');
    assert.deepEqual(b.series.map((s) => s._rep).sort(), ['18/01/2021', '20/09/2021']);
    assert.deepEqual(b.series.map((s) => s._repLabel).sort(), ['18/01/2021', '20/09/2021']);
    // mismos _ano pero _rep distintos → no colapsan
    assert.deepEqual([...new Set(b.series.map((s) => s._ano))], ['2021']);
    assert.equal(new Set(b.series.map((s) => s._rep)).size, 2);
  });

  test('CONSERVA todas las fases (NO reduce): valores reales por fase', () => {
    const multi = { prueba: 'excitacion', titulo: 'Exc', unidad: 'mA', grafica: 'linea',
      series: [
        { nombre: 'A', puntos: [{ x: 1, y: 10 }, { x: 2, y: 12 }] },
        { nombre: 'B', puntos: [{ x: 1, y: 15 }, { x: 2, y: 9 }] }
      ] };
    const out = bloquesMultiAno([{ ano: 2022, fecha: '01/01/2022', id: 'r1', bloques: [multi] }]);
    assert.equal(out[0].series.length, 2);
    const fa = out[0].series.find((s) => s._fase === 'A');
    const fb = out[0].series.find((s) => s._fase === 'B');
    assert.deepEqual(fa.puntos, [{ x: 1, y: 10 }, { x: 2, y: 12 }]);
    assert.deepEqual(fb.puntos, [{ x: 1, y: 15 }, { x: 2, y: 9 }]);
  });

  test('ADR-027: una prueba FUERA de las 7 familias (SFRA) SÍ se incluye como familia genérica propia', () => {
    const sfra = { prueba: 'sfra', titulo: 'SFRA — Respuesta en frecuencia', unidad: 'dB', eje_x: 'Hz',
      series: [{ nombre: 'Fase A', puntos: [{ x: 10, y: -2 }, { x: 100, y: -5 }] }] };
    const out = bloquesMultiAno([inf(2020, '01/01/2020', [exc([18]), sfra])]);
    const pruebas = out.map((b) => b.prueba).sort();
    assert.deepEqual(pruebas, ['excitacion', 'otros:sfra'], 'excitación + SFRA genérica');
    const gSfra = out.find((b) => b.prueba === 'otros:sfra');
    assert.equal(gSfra.titulo, 'SFRA — Respuesta en frecuencia', 'conserva el título legible del bloque');
    assert.equal(gSfra.series.length, 1);
    assert.equal(gSfra.series[0]._fase, 'Fase A');
  });

  test('ADR-027: la MISMA prueba genérica se superpone entre informes/años (no fragmenta)', () => {
    const sfra = (y) => ({ prueba: 'sfra', titulo: 'SFRA', unidad: 'dB',
      series: [{ nombre: 'Fase A', puntos: [{ x: 10, y }] }] });
    const out = bloquesMultiAno([
      inf(2021, '01/01/2021', [sfra(-2)]),
      inf(2023, '01/01/2023', [sfra(-4)])
    ]);
    assert.equal(out.length, 1, 'una sola gráfica SFRA');
    assert.equal(out[0].series.length, 2, 'ambos años superpuestos');
    assert.deepEqual(out[0].series.map((s) => s._ano), ['2021', '2023']);
  });

  test('bloque sin prueba NI título no crea familia fantasma', () => {
    const vacio = { series: [{ nombre: 'x', puntos: [{ x: 1, y: 1 }] }] };
    const out = bloquesMultiAno([inf(2020, '01/01/2020', [exc([18]), vacio])]);
    assert.deepEqual(out.map((b) => b.prueba), ['excitacion']);
  });

  test('ADR-028: sub-pruebas DISTINTAS de la misma familia NO se fusionan (relación AT/MT vs AT/BT → 2 gráficas)', () => {
    const relAtMt = { prueba: 'relacion', titulo: 'Relación de transformación AT/MT (T1=66 kV, T2=34.5 kV)', unidad: '', eje_x: 'TAP', grafica: 'linea',
      series: [{ nombre: 'Fase A', puntos: [{ x: 9, y: 3.1886 }] }] };
    const relAtBt = { prueba: 'relacion', titulo: 'Relación de transformación AT/BT (T1=66 kV, T2=13.8 kV)', unidad: '', eje_x: 'TAP', grafica: 'linea',
      series: [{ nombre: 'Fase A', puntos: [{ x: 9, y: 7.9777 }] }] };
    const out = bloquesMultiAno([inf(2024, '19/01/2024', [relAtMt, relAtBt])]);
    assert.equal(out.length, 2, 'dos gráficas de relación separadas (no una fusionada)');
    assert.ok(out.every((b) => b.prueba === 'relacion'));
    assert.ok(out.some((b) => /AT\/MT/.test(b.titulo)) && out.some((b) => /AT\/BT/.test(b.titulo)));
  });

  test('ADR-028: resistencia AT-por-TAP (Ω) y MT/BT (mΩ, barra) NO se mezclan (uds/escalas distintas)', () => {
    const resAt = { prueba: 'resistencia', titulo: 'Resistencia de devanados AT por TAP (referida a 75 °C)', unidad: 'Ω', grafica: 'linea',
      series: [{ nombre: 'Fase A', puntos: [{ x: 9, y: 1.378 }] }] };
    const resMtBt = { prueba: 'resistencia', titulo: 'Resistencia de devanados MT y BT (referida a 75 °C)', unidad: 'mΩ', grafica: 'barra',
      series: [{ nombre: 'MT - Fase A', puntos: [{ x: 'MT-A', y: 161.453 }] }] };
    const out = bloquesMultiAno([inf(2024, '19/01/2024', [resAt, resMtBt])]);
    assert.equal(out.length, 2, 'dos gráficas de resistencia separadas');
    const at = out.find((b) => /AT por TAP/.test(b.titulo));
    const mtbt = out.find((b) => /MT y BT/.test(b.titulo));
    assert.equal(at.unidad, 'Ω'); assert.equal(at.grafica, 'linea');
    assert.equal(mtbt.unidad, 'mΩ'); assert.equal(mtbt.grafica, 'barra');
  });

  test('ADR-028: dos informes del MISMO año se ordenan por FECHA real (no lexicográfica)', () => {
    const exc2 = (v) => ({ prueba: 'excitacion', titulo: 'Corriente de excitación AT', unidad: 'mA', grafica: 'linea',
      series: [{ nombre: 'Fase A', puntos: [{ x: 1, y: v }] }] });
    // 18/01/2022 (enero) debe ir ANTES que 02/05/2022 (mayo), aunque "02"<"18".
    const out = bloquesMultiAno([
      inf(2022, '02/05/2022', [exc2(20)]),
      inf(2022, '18/01/2022', [exc2(18)])
    ]);
    assert.deepEqual(out[0].series.map((s) => s._repLabel), ['18/01/2022', '02/05/2022'], 'enero antes que mayo');
  });

  test('ADR-028: la MISMA sub-prueba (mismo título) SÍ se superpone entre años', () => {
    const rel = (y, v) => ({ prueba: 'relacion', titulo: 'Relación de transformación AT/MT (T1=66 kV, T2=34.5 kV)', unidad: '', grafica: 'linea',
      series: [{ nombre: 'Fase A', puntos: [{ x: 9, y: v }] }] });
    const out = bloquesMultiAno([inf(2022, '01/01/2022', [rel(2022, 3.188)]), inf(2024, '19/01/2024', [rel(2024, 3.189)])]);
    assert.equal(out.length, 1, 'una sola gráfica AT/MT con ambos años');
    assert.equal(out[0].series.length, 2);
    assert.deepEqual(out[0].series.map((s) => s._ano), ['2022', '2024']);
  });

  test('ADR-027: análisis de ACEITE (DGA, gases disueltos, furanos) NO contamina el tablero ELÉCTRICO', () => {
    const aceite = [
      { prueba: 'dga', titulo: 'DGA · gases disueltos', series: [{ nombre: 'ppm', puntos: [{ x: 'H2', y: 12 }] }] },
      { prueba: 'analisis_aceite', titulo: 'Fisicoquímicos del aceite', series: [{ nombre: 'x', puntos: [{ x: 'Acidez', y: 0.02 }] }] },
      { prueba: 'furanos', titulo: 'Furanos (humedad del papel)', series: [{ nombre: 'x', puntos: [{ x: '2FAL', y: 0.5 }] }] }
    ];
    const out = bloquesMultiAno([inf(2020, '01/01/2020', [exc([18]), ...aceite])]);
    assert.deepEqual(out.map((b) => b.prueba), ['excitacion'], 'solo la prueba eléctrica; el aceite se excluye');
  });

  test('entrada vacía / basura no rompe', () => {
    assert.deepEqual(bloquesMultiAno([]), []);
    assert.deepEqual(bloquesMultiAno(null), []);
    assert.doesNotThrow(() => bloquesMultiAno([{ ano: 2020, bloques: null }, {}]));
  });
});

describe('etiquetaFecha · normaliza formatos dispares a DD/MM/YYYY', () => {
  test('DD/MM/YYYY se conserva (con padding)', () => {
    assert.equal(etiquetaFecha('18/01/2022'), '18/01/2022');
    assert.equal(etiquetaFecha('2/5/2022'), '02/05/2022');
  });
  test('YYYY/MM/DD → DD/MM/YYYY', () => {
    assert.equal(etiquetaFecha('2022/05/02'), '02/05/2022');
    assert.equal(etiquetaFecha('2024-01-19'), '19/01/2024');
  });
  test('con nombre de mes en español (orden flexible)', () => {
    assert.equal(etiquetaFecha('Enero 19 del 2024'), '19/01/2024');
    assert.equal(etiquetaFecha('19 de enero de 2024'), '19/01/2024');
  });
  test('desconocido → tal cual; vacío → año', () => {
    assert.equal(etiquetaFecha('s/f'), 's/f');
    assert.equal(etiquetaFecha('', 2023), '2023');
    assert.equal(etiquetaFecha(null, 2021), '2021');
  });
  test('el mismo día en formatos distintos colapsa a una etiqueta', () => {
    assert.equal(etiquetaFecha('2022/05/02'), etiquetaFecha('02/05/2022'));
  });
});
