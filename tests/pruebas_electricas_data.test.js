// Integración del DataService de Pruebas Eléctricas.
//
// NOTA de alcance: el data layer real (assets/js/data/pruebas_electricas.js)
// importa el SDK de Firestore/Storage desde el CDN de gstatic, que no es
// resoluble en Node sin red. Por eso aquí NO importamos ese módulo:
// probamos el CONTRATO que el DataService garantiza, con sus piezas
// importables y deterministas —
//   1) el schema de dominio que sanitiza/valida cada write,
//   2) la verificación de serie del flujo de carga (paso 3 del modal),
//   3) el fixture seed reconstruido con el MISMO schema, pasado por los
//      calificadores reales de la UI, para verificar que la cadena
//      datos → semáforo produce los estados del tablero original.
// Esto cubre la capa de procesamiento de datos sin requerir Firestore.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarUnidad, validarUnidad,
  sanitizarInforme, validarInforme,
  confirmarSerie, detectarAno, CONFIGS_TAND, TIPOS_PRUEBA, normalizarSerie
} from '../assets/js/domain/pruebas_electricas_schema.js';
import { calificarPrueba } from '../assets/js/ui/pruebas/semaforo.js';
import { informesSeed } from '../assets/js/data/pruebas_electricas_seed.js';

/* ─── Fixture de informes para los tests ──────────────────────────── */
// El data layer ya NO tiene seed de demostración (interfaz en tiempo
// real · solo datos reales). Este fixture es propio del test: ejercita
// el sanitizador del dominio y la calificación de la UI con un set
// representativo, sin acoplarse al data layer.
function seedInformes() {
  return [2012, 2014, 2020].map((ano, i) => sanitizarInforme({
    unidadId: '173523-15510', serie: '173523-15510', ano,
    tand: [
      { code: 'CH',  valor_pct: [0.39, 0.42, 0.146][i] },
      { code: 'CHL', valor_pct: [0.27, 0.34, 0.100][i] },
      { code: 'CL',  valor_pct: [1.23, 1.52, 0.192][i] },
      { code: 'CLT', valor_pct: [0.24, 0.32, 0.089][i] },
      { code: 'CT',  valor_pct: [0.49, 0.67, 0.334][i] },
      { code: 'CHT', valor_pct: [0.54, 0.66, 0.054][i] }
    ],
    excitacion:  { devanado: 'AT', delta_ext_pct: [4.41, 4.83, 3.02][i] },
    relacion:    [{ devanado: 'AT', asociado: 'MT', desviacion_pct: [0.13, 0.31, 0.23][i] }],
    resistencia: [
      { devanado: 'AT', delta_max_pct: [0.76, 0.22, 0.04][i], verificar: i === 2 },
      { devanado: 'MT', delta_max_pct: [0.95, 0.15, 0.20][i] },
      { devanado: 'BT', delta_max_pct: [1.01, 0.35, null][i], no_medido: i === 2 }
    ],
    aislamiento: i === 1
      ? [{ devanado: 'P', asociado: 'Tierra', gohm: 2.5 }]
      : [],
    collar:      { max_mw: [49, 56, 57.9][i] }
  }));
}

describe('sanitizarUnidad', () => {
  test('mapea campos y fija schema_version=2', () => {
    const u = sanitizarUnidad({ serie: ' 173523-15510 ', ano_fabricacion: '1998' });
    assert.equal(u.serie, '173523-15510');     // trim
    assert.equal(u.ano_fabricacion, 1998);     // int
    assert.equal(u.schema_version, 2);
  });
  test('campos ausentes caen a strings vacíos / null', () => {
    const u = sanitizarUnidad({});
    assert.equal(u.serie, '');
    assert.equal(u.ano_fabricacion, null);
    assert.equal(u.transformadorId, '');
  });
});

describe('validarUnidad', () => {
  test('exige serie', () => {
    assert.deepEqual(validarUnidad({ serie: '' }).length > 0, true);
    assert.deepEqual(validarUnidad({ serie: 'X' }), []);
  });
  test('rechaza año de fabricación fuera de rango', () => {
    assert.equal(validarUnidad({ serie: 'X', ano_fabricacion: 1800 }).length, 1);
    assert.equal(validarUnidad({ serie: 'X', ano_fabricacion: 2200 }).length, 1);
  });
});

describe('sanitizarInforme', () => {
  test('normaliza tand (uppercase code, coma decimal) y descarta vacíos', () => {
    const inf = sanitizarInforme({
      serie: 'S', ano: 2020,
      tand: [{ code: 'ch', valor_pct: '0,39' }, { code: '', valor_pct: 1 }]
    });
    assert.equal(inf.tand.length, 1);
    assert.equal(inf.tand[0].code, 'CH');
    assert.equal(inf.tand[0].valor_pct, 0.39);  // coma → punto
  });
  test('pdf.estado por defecto = cargado', () => {
    const inf = sanitizarInforme({ serie: 'S', ano: 2020 });
    assert.equal(inf.pdf.estado, 'cargado');
  });
  test('flag verificar se castea a bool', () => {
    const inf = sanitizarInforme({
      serie: 'S', ano: 2020,
      resistencia: [{ devanado: 'AT', verificar: 'true' }]
    });
    assert.equal(inf.resistencia[0].verificar, true);
  });
});

describe('validarInforme', () => {
  test('exige serie y año, valida rango de año', () => {
    assert.equal(validarInforme({ serie: '', ano: 2020 }).length, 1);
    assert.equal(validarInforme({ serie: 'S' }).length, 1);            // sin año
    assert.equal(validarInforme({ serie: 'S', ano: 1800 }).length, 1); // fuera de rango
    assert.deepEqual(validarInforme({ serie: 'S', ano: 2020 }), []);
  });
  test('rechaza tan δ negativa', () => {
    const errs = validarInforme({ serie: 'S', ano: 2020, tand: [{ code: 'CH', valor_pct: -1 }] });
    assert.equal(errs.length, 1);
  });
});

describe('confirmarSerie (paso 3 del flujo de carga)', () => {
  test('coincide ignorando espacios y guiones', () => {
    const r = confirmarSerie('173523-15510', 'Serie  173523 15510  Siemens');
    assert.equal(r.coincide, true);
    assert.equal(r.encontrada, true);
  });
  test('no coincide cuando el PDF trae otra serie', () => {
    const r = confirmarSerie('173523-15510', 'Equipo serie 999999');
    assert.equal(r.coincide, false);
  });
  test('serie vacía → no coincide', () => {
    assert.equal(confirmarSerie('', 'cualquier texto').coincide, false);
  });
});

describe('normalizarSerie (clave canónica para agrupar el mismo transformador)', () => {
  test('colapsa guiones y espacios a la misma clave', () => {
    assert.equal(normalizarSerie('173523-15510'), '17352315510');
    assert.equal(normalizarSerie('173523 15510'), '17352315510');
    assert.equal(normalizarSerie(' 173523-15510 '), '17352315510');
  });
  test('mismo serie con distinto formato → misma clave (no parte la tendencia)', () => {
    assert.equal(normalizarSerie('173523-15510'), normalizarSerie('17352315510'));
  });
  test('mayúsculas: normaliza el caso', () => {
    assert.equal(normalizarSerie('ab-12cd'), 'AB12CD');
  });
  test('series distintas → claves distintas', () => {
    assert.notEqual(normalizarSerie('173523-15510'), normalizarSerie('999999'));
  });
  test('vacío/nulo → cadena vacía', () => {
    assert.equal(normalizarSerie(''), '');
    assert.equal(normalizarSerie(null), '');
    assert.equal(normalizarSerie(undefined), '');
  });
});

describe('detectarAno (auto-detección del año por informe)', () => {
  test('prefijo YYMMDD en el nombre de archivo → año 20YY', () => {
    const r = detectarAno({ filename: '130823-pruebas.pdf' });
    assert.equal(r.ano, 2013);
    assert.equal(r.fuente, 'filename');
  });
  test('prefijo YYYYMMDD en el nombre de archivo → año exacto', () => {
    const r = detectarAno({ filename: '20250510 informe AT.pdf' });
    assert.equal(r.ano, 2025);
    assert.equal(r.fuente, 'filename');
  });
  test('el nombre de archivo gana sobre el texto del PDF', () => {
    const r = detectarAno({ filename: '200314-x.pdf', texto: 'fecha 01/01/1999' });
    assert.equal(r.ano, 2020);
    assert.equal(r.fuente, 'filename');
  });
  test('texto dd/mm/yyyy cuando el nombre no trae fecha', () => {
    const r = detectarAno({ filename: 'informe.pdf', texto: 'Realizado el 14/06/2021 en sitio' });
    assert.equal(r.ano, 2021);
    assert.equal(r.fuente, 'texto-fecha');
  });
  test('texto yyyy-mm-dd', () => {
    const r = detectarAno({ filename: 'x.pdf', texto: 'Fecha 2023-02-09' });
    assert.equal(r.ano, 2023);
    assert.equal(r.fuente, 'texto-fecha');
  });
  test('sin fecha completa → año suelto más reciente en rango', () => {
    const r = detectarAno({ texto: 'comparativa 2014 vs 2023 del activo' });
    assert.equal(r.ano, 2023);
    assert.equal(r.fuente, 'texto-ano');
  });
  test('prefijo de fecha inválida (mes 99) no se acepta', () => {
    const r = detectarAno({ filename: '139923-x.pdf', texto: '' });
    assert.equal(r.ano, null);
    assert.equal(r.fuente, null);
  });
  test('sin pistas → null', () => {
    const r = detectarAno({ filename: 'documento.pdf', texto: 'sin fechas aquí' });
    assert.equal(r.ano, null);
    assert.equal(r.fuente, null);
  });
});

describe('integración datos → semáforo (seed = tablero original)', () => {
  const informes = seedInformes();
  const byAno = (a) => informes.find((i) => i.ano === a);

  test('CL 2012/2014 fuera de norma se refleja en tan δ (peor celda roja)', () => {
    // CL=1.23 (2012) y 1.52 (2014) > 1.0 → la peor config de tand es roja
    assert.equal(calificarPrueba('tand', byAno(2012)).estado.clase, 'b-r');
    assert.equal(calificarPrueba('tand', byAno(2014)).estado.clase, 'b-r');
  });
  test('tan δ 2020 vuelve a verde (recuperación)', () => {
    assert.equal(calificarPrueba('tand', byAno(2020)).estado.clase, 'b-g');
  });
  test('resistencia 2020 marcada como verificar → ámbar', () => {
    assert.equal(calificarPrueba('resistencia', byAno(2020)).estado.clase, 'b-a');
    assert.equal(calificarPrueba('resistencia', byAno(2020)).texto, 'verificar');
  });
  test('aislamiento sin dato → neutral; con 2.5 GΩ → verde', () => {
    assert.equal(calificarPrueba('aislamiento', byAno(2012)).estado.clase, 'b-n');
    assert.equal(calificarPrueba('aislamiento', byAno(2014)).estado.clase, 'b-g');
  });
  test('collar siempre por debajo de 100 mW (verde toda la serie)', () => {
    informes.forEach((inf) => {
      assert.equal(calificarPrueba('collar', inf).estado.clase, 'b-g');
    });
  });
});

describe('CONFIGS_TAND congelado', () => {
  test('las 6 configuraciones de aislamiento del tablero', () => {
    assert.equal(CONFIGS_TAND.length, 6);
    assert.deepEqual(CONFIGS_TAND.map((c) => c.code),
      ['CH', 'CHL', 'CL', 'CLT', 'CT', 'CHT']);
  });
});

describe('sanitizarInforme · familia DRM (conmutador OLTC)', () => {
  // Informe estilo 2025: DRM del conmutador + TTR + R, SIN tan δ.
  const raw = {
    serie: '173523-15510', ano: 2025, tipo: 'base',
    tand: [], excitacion: {}, aislamiento: [], collar: {},
    relacion:    [{ devanado: 'AT', asociado: 'AT–MT/BT (TTR)', desviacion_pct: 0.40 }],
    resistencia: [{ devanado: 'Devanados (AT/MT/BT)', verificar: true }],
    drm: {
      conmutador: { fabricante: 'MR', tipo: 'V III 200 Y-76', serial: '145981',
                    posiciones: 21, operaciones: 383208, pos_nominal: 11,
                    tension_ui_v: 220, corriente_iu_a: 322, r_conmutacion_ohm: 1.1 },
      tiempo_min_ms: 56, tiempo_max_ms: 66, transiciones: []
    }
  };
  test('preserva la identidad del conmutador y la ventana de tiempos', () => {
    const s = sanitizarInforme(raw);
    assert.equal(s.drm.conmutador.serial, '145981');
    assert.equal(s.drm.conmutador.posiciones, 21);
    assert.equal(s.drm.conmutador.operaciones, 383208);
    assert.equal(s.drm.tiempo_min_ms, 56);
    assert.equal(s.drm.tiempo_max_ms, 66);
  });
  test('deriva los extremos desde las transiciones si faltan', () => {
    const s = sanitizarInforme({ ...raw, drm: {
      transiciones: [{ posicion: '10-11', tiempo_ms: 58 }, { posicion: '11-12', tiempo_ms: 64 }]
    }});
    assert.equal(s.drm.tiempo_min_ms, 58);
    assert.equal(s.drm.tiempo_max_ms, 64);
  });
  test('infiere tipo_prueba = mixto (rel + res + drm, sin tan δ)', () => {
    assert.equal(sanitizarInforme(raw).tipo_prueba, TIPOS_PRUEBA.MIXTO);
  });
  test('solo DRM → tipo_prueba = drm_oltc', () => {
    const s = sanitizarInforme({ serie: 'X', ano: 2025, drm: {
      conmutador: { serial: '145981' }, tiempo_min_ms: 56, tiempo_max_ms: 66
    }});
    assert.equal(s.tipo_prueba, TIPOS_PRUEBA.DRM_OLTC);
  });
});

describe('validarInforme · DRM', () => {
  test('rechaza tiempo de transición negativo', () => {
    const errs = validarInforme({ serie: 'X', ano: 2025, drm: { tiempo_min_ms: -5 } });
    assert.ok(errs.some((e) => /no puede ser negativo/.test(e)));
  });
  test('rechaza ventana invertida (máximo < mínimo)', () => {
    const errs = validarInforme({ serie: 'X', ano: 2025,
      drm: { tiempo_min_ms: 66, tiempo_max_ms: 56 } });
    assert.ok(errs.some((e) => /no puede ser menor que el mínimo/.test(e)));
  });
});

describe('informesSeed · informe real 2025 (DRM + TTR + R)', () => {
  const informes = informesSeed('173523-15510');
  const r2025 = informes.find((i) => i.ano === 2025);

  test('el seed incluye el informe 2025 sobre la misma serie', () => {
    assert.ok(r2025, 'debe existir el informe 2025');
    assert.equal(r2025.serie, '173523-15510');
  });
  test('conserva la identidad real del conmutador (sin inventar)', () => {
    assert.equal(r2025.drm.conmutador.serial, '145981');
    assert.equal(r2025.drm.conmutador.tipo, 'V III 200 Y-76');
    assert.equal(r2025.drm.tiempo_min_ms, 56);
    assert.equal(r2025.drm.tiempo_max_ms, 66);
  });
  test('no fabrica detalle por transición ni PDF inexistente', () => {
    assert.deepEqual(r2025.drm.transiciones, []);
    assert.equal(r2025.pdf.downloadURL, '');
    assert.equal(r2025.pdf.storagePath, '');
  });
  test('DRM 56–66 ms → ámbar (66 > guía 65)', () => {
    assert.equal(calificarPrueba('drm', r2025).estado.clase, 'b-a');
  });
  test('relación TTR 0.40% dentro de ±0.5% (= 80% del límite) → verde', () => {
    assert.equal(calificarPrueba('relacion', r2025).estado.clase, 'b-g');
  });
  test('resistencia marcada verificar → ámbar (número a confirmar)', () => {
    assert.equal(calificarPrueba('resistencia', r2025).estado.clase, 'b-a');
  });
  test('pruebas no medidas en 2025 (tan δ, excitación, collar) → neutral', () => {
    assert.equal(calificarPrueba('tand', r2025).estado.clase, 'b-n');
    assert.equal(calificarPrueba('excitacion', r2025).estado.clase, 'b-n');
    assert.equal(calificarPrueba('collar', r2025).estado.clase, 'b-n');
  });
});
