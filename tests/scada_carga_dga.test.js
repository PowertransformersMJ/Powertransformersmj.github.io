// Cargabilidad SCADA (`99 §127`) — «Gases disueltos (DGA) y carga». Calificaciones de EJEMPLO (no son de un
// equipo real). Lo que se exige: la tabla es la que ratificó el Ingeniero, el panel solo actúa cerca o por
// encima de la capacidad, la sobrecarga sale de la serie LIMPIA (las horas de escala imposible no cuentan),
// sin carga medida no hay nivel, y el CO/CO₂ alto no sube el nivel (solo el texto del papel).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MATRIZ_ATENCION, NIVELES_ATENCION, SEVERA_PCT, leerGases, columnaGases, entradaCarga, franjaCarga,
  nivelAtencion, aplica, cruceDgaCarga, palabraCondicion, origenGases, filasCarga
} from '../assets/js/domain/scada_carga_dga.js';
import { CATALOGO_DGA, TEXTO_CARGA_NORMAL } from '../assets/js/domain/scada_carga_dga_textos.js';
import { SUBACTIVIDADES_BASELINE } from '../assets/js/domain/catalogos_baseline.js';
import { calcularEvalDGA } from '../assets/js/domain/salud_activos.js';
import { serieCargabilidad, horasSostenidasSobre } from '../assets/js/domain/scada_carga_kpis.js';
import { calificacionesDe } from '../assets/js/domain/cargabilidad_diagnostico.js';
import { filaCargabilidad } from '../assets/js/domain/cargabilidad_parque.js';

const tx = (sa, extra = {}) => ({ id: 'tx-ejemplo', identificacion: { matricula: 'T1-EJEMPLO' }, salud_actual: sa, ...extra });
const g = (dga, tdgc, co, co2, c2h2) => leerGases(tx({ eval_dga: dga, calif_tdgc: tdgc, calif_co: co, calif_co2: co2, calif_c2h2: c2h2 }));
/** Gases COHERENTES: la DGA oficial es la de la regla oficial sobre los cuatro grupos (como la guarda Salud de Activos). */
const gc = (tdgc, co, co2, c2h2) => g(calcularEvalDGA({ calif_tdgc: tdgc, calif_co: co, calif_co2: co2, calif_c2h2: c2h2 }), tdgc, co, co2, c2h2);

describe('leerGases', () => {
  test('lee las calificaciones 1–5 y descarta lo que no es calificación', () => {
    const x = leerGases(tx({ eval_dga: '3', calif_tdgc: 0, calif_co: 6, calif_co2: 'x', calif_c2h2: 2, ts_calculo: '2026-09-09T01:49:55.471Z' }));
    assert.equal(x.dga, 3); assert.equal(x.tdgc, null); assert.equal(x.co, null); assert.equal(x.co2, null); assert.equal(x.c2h2, 2);
    assert.equal(x.grupos, 1); assert.equal(x.origen, 'salud_activos');
    assert.equal('fechaCalculo' in x, false, 'la fecha del cálculo no se ofrece como fecha de la muestra');
  });
  test('sin salud_actual: todo nulo, nunca un 1 por defecto', () => {
    const x = leerGases({ id: 'sin' });
    assert.deepEqual([x.dga, x.tdgc, x.co, x.co2, x.c2h2, x.grupos], [null, null, null, null, null, 0]);
  });
  test('la DGA oficial es la misma que muestra Salud de Activos (calificacionesDe ∘ filaCargabilidad)', () => {
    const t = tx({ eval_dga: 4, calif_tdgc: 5 }, { electrico: { corriente_nominal_primaria_a: 100 } });
    const oficial = calificacionesDe(filaCargabilidad(t)).find((c) => c.k === 'dga').valor;
    assert.equal(leerGases(t).dga, oficial);
  });
  test('palabra oficial de la escala', () => { assert.equal(palabraCondicion(5), 'Muy Pobre'); assert.equal(palabraCondicion(null), '—'); });
});

describe('columnaGases', () => {
  test('A / B / C / D por la DGA oficial redondeada', () => {
    assert.equal(columnaGases(g(null)).col, 'A');
    assert.equal(columnaGases(g(1)).col, 'B');
    assert.equal(columnaGases(g(2.4)).col, 'B');
    assert.equal(columnaGases(g(2.6)).col, 'C');
    assert.equal(columnaGases(g(3)).col, 'C');
    assert.equal(columnaGases(g(4)).col, 'D');
    assert.equal(columnaGases(g(5)).col, 'D');
  });
  test('acetileno en 5 va a su columna E aunque el promedio sea bueno', () => {
    const c = columnaGases(g(2, 1, 1, 1, 5));
    assert.equal(c.col, 'E'); assert.equal(c.acetileno, true);
  });
  test('combustibles 4–5 escondidos por el promedio suben UNA columna', () => {
    assert.deepEqual([columnaGases(g(2, 4)).col, columnaGases(g(2, 4)).subio], ['C', true]);
    assert.deepEqual([columnaGases(g(3, 5)).col, columnaGases(g(3, 5)).subio], ['D', true]);
    assert.deepEqual([columnaGases(g(4, 5)).col, columnaGases(g(4, 5)).subio], ['D', false]);
  });
  test('el CO y el CO₂ pesan a través del promedio oficial (sin ajuste extra) y activan el texto del papel en 4–5', () => {
    // TDGC 1, CO 5, CO₂ 5, C₂H₂ 1 → promedio 3 → C, por el papel (no por combustibles).
    const x = gc(1, 5, 5, 1); const c = columnaGases(x);
    assert.equal(x.dga, 3); assert.equal(c.col, 'C'); assert.equal(c.papel, true); assert.equal(c.subio, false);
    assert.deepEqual([...origenGases(x).familias], ['papel']);
    // TDGC 2, CO 5, CO₂ 5, C₂H₂ 2 → 3,5 → 4 → D por el papel.
    assert.equal(columnaGases(gc(2, 5, 5, 2)).col, 'D');
    assert.equal(columnaGases(gc(1, 3, 3, 1)).papel, false, 'CO/CO₂ en 3 no activan el texto del papel');
  });
  test('sin eval_dga pero con grupos: se calcula con la regla oficial y se dice', () => {
    const x = leerGases(tx({ calif_tdgc: 5, calif_co: 2, calif_co2: 2, calif_c2h2: 1 }));
    assert.equal(x.dga, 3); assert.equal(x.dgaCalculada, true);
    assert.equal(columnaGases(x).col, 'D', 'combustibles 5 suben la C a D');
  });
});

describe('franjaCarga', () => {
  const e = (o) => ({ pct: 80, crg: 4, clase: 'firme', horasSobre100: 0, max2h: 70, picoMax: 85, ...o });
  test('sin cifra no hay fila (y se dice por qué)', () => {
    const f = franjaCarga(e({ pct: null, motivoNulo: 'sin datos SCADA cargados' }));
    assert.equal(f.fila, null); assert.equal(f.motivo, 'sin datos SCADA cargados');
  });
  test('CRG 1–3 = carga normal (el panel no actúa)', () => {
    for (const crg of [1, 2, 3]) assert.equal(franjaCarga(e({ crg, pct: 60 })).fila, 'R0');
  });
  test('CRG 4 → R1, CRG 5 → R2', () => {
    assert.equal(franjaCarga(e({ crg: 4 })).fila, 'R1');
    assert.equal(franjaCarga(e({ crg: 5, pct: 95 })).fila, 'R2');
  });
  test('2 h seguidas sobre el 100 % → R3 aunque la CRG sea baja (es superar la capacidad)', () => {
    assert.equal(franjaCarga(e({ crg: 5, horasSobre100: 2, max2h: 104 })).fila, 'R3');
    assert.equal(franjaCarga(e({ crg: 2, pct: 62, horasSobre100: 2, max2h: 101 })).fila, 'R3');
  });
  test('R4 solo por encima del 130 % sostenido 2 h y con cifra FIRME', () => {
    assert.equal(SEVERA_PCT, 130);
    assert.equal(franjaCarga(e({ crg: 5, horasSobre100: 5, max2h: 130 })).fila, 'R3');
    assert.equal(franjaCarga(e({ crg: 5, horasSobre100: 5, max2h: 130.01 })).fila, 'R4');
    const p = franjaCarga(e({ crg: 5, clase: 'provisional', horasSobre100: 5, max2h: 160 }));
    assert.equal(p.fila, 'R3'); assert.equal(p.severaSinConfirmar, true);
  });
  test('un error de escala de 2,6 × la ampacidad en un mes al 60 % no da R4 si la cifra no es firme', () => {
    const A = 100; const serie = Array.from({ length: 200 }, () => 60); serie[50] = 260; serie[51] = 262;
    const carga = serieCargabilidad(Float32Array.from(serie), A);
    const en = entradaCarga({ pct: 60, crg: 1, clase: 'provisional', motivoNulo: null, devMax: 'S', niveles: [{ nivel: 'N13', devanado: 'S', pct: 60 }] },
      { N13: { carga, sobre: horasSostenidasSobre(carga.serie, 100, 2) } });
    assert.equal(franjaCarga(en).fila, 'R3'); assert.equal(franjaCarga(en).severaSinConfirmar, true);
  });
  test('pico sobre el 100 % sin ventana de 2 h se marca, sin cambiar de fila', () => {
    const f = franjaCarga(e({ crg: 5, pct: 95, picoMax: 104 }));
    assert.equal(f.fila, 'R2'); assert.equal(f.pico, true);
  });
});

describe('entradaCarga (serie LIMPIA, solo devanados con cifra)', () => {
  const nivel = (serieI, A) => {
    const carga = serieCargabilidad(Float32Array.from(serieI), A);
    return { carga, sobre: horasSostenidasSobre(carga.serie, 100, 2) };
  };
  const calc = (niveles, o = {}) => ({ pct: 80, crg: 4, clase: 'firme', motivoNulo: null, devMax: 'S', niveles, ...o });
  test('dos horas de escala imposible (5 × ampacidad) NO dan sobrecarga', () => {
    const A = 100;
    const pn = { N13: nivel([80, 500, 500, 70, 60], A) };
    const en = entradaCarga(calc([{ nivel: 'N13', devanado: 'S', pct: 80 }]), pn);
    assert.equal(en.horasSobre100, 0);
    assert.equal(franjaCarga(en).fila, 'R1');
  });
  test('un devanado con escala sospechosa (cifra nula) no cuenta', () => {
    const pn = { N66: nivel([200, 210, 220], 100), N13: nivel([80, 82, 79], 100) };
    const en = entradaCarga(calc([{ nivel: 'N66', devanado: 'P', pct: null }, { nivel: 'N13', devanado: 'S', pct: 82 }]), pn);
    assert.equal(en.horasSobre100, 0); assert.equal(Math.round(en.max2h), 80);
  });
  test('toma el mayor entre los devanados válidos', () => {
    const pn = { N66: nivel([90, 105, 106, 90], 100), N13: nivel([140, 140, 80], 100) };
    const en = entradaCarga(calc([{ nivel: 'N66', devanado: 'P', pct: 106 }, { nivel: 'N13', devanado: 'S', pct: 140 }]), pn);
    assert.equal(en.horasSobre100, 2); assert.equal(Math.round(en.max2h), 140);
    assert.equal(franjaCarga(en).fila, 'R4');
  });
  test('sin cifra de equipo: no lee nada y la fila es nula', () => {
    const en = entradaCarga(calc([], { pct: null, motivoNulo: 'escala de la corriente sospechosa' }), {});
    assert.equal(franjaCarga(en).fila, null);
  });
});

describe('tabla de niveles (ratificada 2026-10-01)', () => {
  test('las 20 celdas', () => {
    assert.deepEqual(MATRIZ_ATENCION, {
      R1: { A: 3, B: 2, C: 3, D: 4, E: 4 },
      R2: { A: 4, B: 3, C: 4, D: 5, E: 5 },
      R3: { A: 4, B: 4, C: 5, D: 5, E: 5 },
      R4: { A: 5, B: 5, C: 5, D: 5, E: 5 },
    });
  });
  test('monotonía: nunca baja al subir de fila ni al empeorar los gases (B → C → D)', () => {
    const filas = ['R1', 'R2', 'R3', 'R4'];
    for (const c of ['A', 'B', 'C', 'D', 'E']) for (let i = 1; i < filas.length; i++) assert.ok(MATRIZ_ATENCION[filas[i]][c] >= MATRIZ_ATENCION[filas[i - 1]][c]);
    for (const f of filas) { const m = MATRIZ_ATENCION[f]; assert.ok(m.B <= m.C && m.C <= m.D && m.D <= m.E); }
  });
  test('número y palabra; provisional si la cifra no es firme', () => {
    assert.deepEqual(nivelAtencion('R3', 'C', 'firme'), { n: 5, palabra: 'Inmediato', provisional: false });
    assert.equal(nivelAtencion('R1', 'B', 'provisional').provisional, true);
    assert.equal(nivelAtencion('R0', 'B', 'firme'), null);
    assert.equal(NIVELES_ATENCION.length, 5);
  });
});

describe('cruce y selección del catálogo', () => {
  const cat = {
    adversidades: [
      { id: 'ADV-1', filas: ['R1', 'R2'], columnas: ['A', 'B', 'C', 'D', 'E'], grupo: '' },
      { id: 'ADV-P', filas: ['R2', 'R3', 'R4'], columnas: ['B', 'C', 'D', 'E'], grupo: 'co_co2' },
      { id: 'ADV-E', filas: ['R1', 'R2', 'R3', 'R4'], columnas: ['E'], grupo: 'c2h2' },
    ],
    acciones: [{ id: 'ACC-1', filas: ['R2'], columnas: ['C'], grupo: '' }],
  };
  const entrada = { pct: 95, crg: 5, clase: 'firme', horasSobre100: 0, max2h: 92, picoMax: 97 };
  test('elige por fila, columna y grupo', () => {
    const r = cruceDgaCarga(tx({ eval_dga: 3, calif_co: 4 }), entrada, cat);
    assert.equal(r.franja.fila, 'R2'); assert.equal(r.columna.col, 'C'); assert.equal(r.nivel.n, 4);
    assert.deepEqual(r.adversidades.map((x) => x.id), ['ADV-1', 'ADV-P']);
    assert.deepEqual(r.acciones.map((x) => x.id), ['ACC-1']);
  });
  test('carga normal: sin nivel y sin textos, pero con los gases', () => {
    const r = cruceDgaCarga(tx({ eval_dga: 5, calif_c2h2: 5 }), { ...entrada, pct: 50, crg: 1, max2h: 48, picoMax: 52 }, cat);
    assert.equal(r.franja.fila, 'R0'); assert.equal(r.nivel, null); assert.equal(r.adversidades.length, 0); assert.equal(r.gases.c2h2, 5);
  });
  test('sin medición: sin nivel', () => {
    const r = cruceDgaCarga(tx({ eval_dga: 2 }), { pct: null, motivoNulo: 'sin datos SCADA cargados' }, cat);
    assert.equal(r.nivel, null); assert.equal(r.franja.motivo, 'sin datos SCADA cargados');
  });
  test('aplica() exige el grupo cuando lo declara', () => {
    assert.equal(aplica(cat.adversidades[2], 'R1', { col: 'E', acetileno: true }), true);
    assert.equal(aplica(cat.adversidades[1], 'R2', { col: 'B', papel: false }), false);
  });
});

describe('catálogo de textos', () => {
  const todos = [...CATALOGO_DGA.adversidades, ...CATALOGO_DGA.acciones];
  test('cada ítem tiene fuente, filas y columnas válidas y un grupo conocido', () => {
    assert.ok(CATALOGO_DGA.adversidades.length >= 10 && CATALOGO_DGA.acciones.length >= 10);
    for (const it of todos) {
      assert.ok(it.fuente && it.fuente.length > 5, it.id);
      assert.ok(it.filas.length && it.filas.every((f) => ['R1', 'R2', 'R3', 'R4'].includes(f)), it.id);
      assert.ok(it.columnas.length && it.columnas.every((c) => 'ABCDE'.includes(c)), it.id);
      assert.ok(['', 'c2h2', 'tdgc', 'co_co2'].includes(it.grupo), it.id);
    }
    assert.equal(new Set(todos.map((x) => x.id)).size, todos.length, 'ids únicos');
  });
  test('redacción: «prevenir» y no «evitar»; sin «estanqueidad»; nada promete que «no falle»', () => {
    for (const it of todos) {
      assert.ok(!/\bevit(ar|a|e|amos)\b/i.test(it.texto), it.id);
      assert.ok(!/estanqueidad/i.test(it.texto), it.id);
      assert.ok(!/no fall/i.test(it.texto), it.id);
      assert.ok(!/fuera de norma/i.test(it.texto), it.id);
    }
  });
  test('cada código SUB-… citado existe en el catálogo MO.00418 con ese nombre', () => {
    const nombres = new Map(SUBACTIVIDADES_BASELINE.map((x) => [x.codigo || x.id || x.value, x.nombre || x.label]));
    for (const it of todos) {
      for (const m of it.fuente.matchAll(/(SUB-[A-Z0-9]+-[A-Z0-9]+)(?: «([^»]+)»)?/g)) {
        assert.ok(nombres.has(m[1]), it.id + ' cita ' + m[1] + ' que no existe');
        if (m[2]) assert.equal(nombres.get(m[1]), m[2], it.id + ' nombre de ' + m[1]);
      }
    }
  });
  test('SUB-C4-07 nunca aparece como prueba preventiva y la pintura nunca como limpieza de radiadores', () => {
    for (const it of todos) {
      if (/SUB-C4-07/.test(it.texto)) assert.match(it.texto, /fuera de servicio|desviad/, it.id);
      assert.ok(!/radiador[^.]*SUB-C(4-03|5-01)/i.test(it.fuente), it.id);
    }
  });
  test('cada fila R1–R4 tiene adversidades y acciones para cada columna', () => {
    for (const f of ['R1', 'R2', 'R3', 'R4']) for (const c of 'ABCDE') {
      const cg = { col: c, papel: false, combustibles: false, acetileno: c === 'E' };
      assert.ok(CATALOGO_DGA.adversidades.some((it) => aplica(it, f, cg)), 'adversidad ' + f + c);
      assert.ok(CATALOGO_DGA.acciones.some((it) => aplica(it, f, cg)), 'acción ' + f + c);
    }
  });
  test('rótulos de las filas con las bandas vigentes', () => {
    assert.match(filasCarga(null).R1, /75 %/);
    assert.match(filasCarga({ crg: { c4_min_excl: 70, c5_min_excl: 85 } }).R2, /85 %/);
    assert.match(TEXTO_CARGA_NORMAL, /\{umbral\}/);
  });
});

test('guardia de pureza: el dominio nuevo no toca Firebase ni la capa de datos', () => {
  const src = readFileSync(new URL('../assets/js/domain/scada_carga_dga.js', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"][^'"]*\/data\//.test(src)); assert.ok(!/firebase/i.test(src.replace(/\/\/.*$/gm, '')));
});
