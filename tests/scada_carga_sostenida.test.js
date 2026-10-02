// Cargabilidad SCADA (`99 §129`) — la marca «Sobrecarga sostenida» y «Pico aislado» de la LISTA, con datos SINTÉTICOS
// («EstDemo»). Lo que se exige: solo cuentan devanados con cifra válida y equipos con cifra; un nivel cuyo mes trae horas
// imposibles (> 3 × ampacidad) NO se marca con el resumen en bruto sino que queda «por verificar», y la curva del mes lo
// decide con la serie limpia (la del detalle). Casos que lo motivaron: T1-A/M-GBT, T1-M/M-PBN y T1-M/M-MAJ (8 meses reales).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasLista, filtrarFilas } from '../assets/js/domain/scada_carga_vista.js';
import { sobrecargaDeCurva, aplicarVerificacion } from '../assets/js/domain/scada_carga_sostenida.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { horasMes } from '../assets/js/domain/scada_carga_series.js';

const tx = {
  id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 20000 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837 },
};
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
const homologacion = { filas: fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas };
const cid = claveId('EstDemo1', 'swTrafo1');
const A_S = 837; const A_P = 335;
/** Resumen de un nivel en AMPERIOS: p99, máximo del mes y máximo sostenido 2 h (en bruto). */
const r = (p99, max, sost, n = 700) => ({ i: { n, p50: p99 * 0.7, p95: p99 * 0.95, p99, max, unaFalta: 0 }, sost: sost == null ? null : { v: sost }, cob: 0.95, rUI: 1 });
const fila = (niveles, mas = {}) => {
  const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [cid]: { niveles: Object.fromEntries(Object.keys(niveles).map((k) => [k, {}])) } } };
  return filasLista({ parque: [{ ...tx, ...mas }], homologacion, catalogo, resumenMes: { claves: { [cid]: niveles } } })[0];
};

describe('marca de la lista con el resumen del mes', () => {
  test('sin horas imposibles el resumen manda (igual que antes): sostenida firme', () => {
    const x = fila({ N13_8: r(0.97 * A_S, 1.10 * A_S, 1.05 * A_S) });
    assert.equal(x.clase, 'firme');
    assert.equal(x.sobrecargaSostenida, true); assert.equal(x.picoAislado, false);
    assert.deepEqual(x.sobrecargaPorVerificar, []);
    assert.deepEqual(filtrarFilas([x], { soloSostenida: true }).length, 1);
  });
  test('pico aislado sin ventana de 2 h, sin horas imposibles', () => {
    const x = fila({ N13_8: r(0.9 * A_S, 1.2 * A_S, 0.95 * A_S) });
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.picoAislado, true);
  });
  test('GBT: horas imposibles (máx > 3 × A) — el resumen en bruto NO marca; queda por verificar', () => {
    const x = fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) });
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.sobrecargaProvisional, false); assert.equal(x.picoAislado, false);
    assert.deepEqual(x.sobrecargaPorVerificar, [{ nivel: 'N13_8', devanado: 'S', A: A_S }]);
  });
  test('bordes del redondeo del resumen (0,001 A): lo que cae a medio paso de 3 × A o del 100 % va a la curva', () => {
    // Un máximo guardado de EXACTAMENTE 3 × A pudo ser 3 × A + 0,0004 (excluido en la curva): el resumen no decide.
    const tres = fila({ N13_8: r(0.97 * A_S, 3 * A_S, 1.05 * A_S) });
    assert.equal(tres.sobrecargaSostenida, false); assert.equal(tres.sobrecargaPorVerificar.length, 1);
    // Con margen claro bajo 3 × A, el resumen sí decide.
    const bajo = fila({ N13_8: r(0.97 * A_S, 3 * A_S - 0.01, 1.05 * A_S) });
    assert.equal(bajo.sobrecargaSostenida, true); assert.deepEqual(bajo.sobrecargaPorVerificar, []);
    // Ventana de 2 h guardada en EXACTAMENTE A (pudo ser A + 0,0004): va a la curva; con A − 0,01 es «no».
    const justo = fila({ N13_8: r(0.97 * A_S, 1.2 * A_S, A_S) });
    assert.equal(justo.sobrecargaSostenida, false); assert.equal(justo.sobrecargaPorVerificar.length, 1);
    const debajo = fila({ N13_8: r(0.97 * A_S, 0.99 * A_S, A_S - 0.01) });
    assert.equal(debajo.sobrecargaSostenida, false); assert.deepEqual(debajo.sobrecargaPorVerificar, []);
    // Ampacidad con decimales del parque: el medio paso se mide en amperios, no en porcentaje redondo.
    const dec = fila({ N13_8: r(0.9 * 506.42, 3 * 506.42, 0.95 * 506.42) }, { electrico: { ...tx.electrico, corriente_nominal_secundaria_a: 506.42 } });
    assert.equal(dec.sobrecargaPorVerificar.length, 1);
  });
  test('PBN: un devanado de escala sospechosa (cifra nula) no marca nada aunque su resumen pase del 100 %', () => {
    // Primario con p99 > 2,5 × A → ESCALA_I → su cifra es nula; el Secundario da la cifra del equipo.
    const x = fila({ N34_5: r(2.6 * A_P, 2.7 * A_P, 2.55 * A_P), N13_8: r(0.8 * A_S, 0.85 * A_S, 0.78 * A_S) });
    assert.ok(x.pct != null);
    assert.equal(x.niveles.find((n) => n.nivel === 'N34_5').pct, null);
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.sobrecargaProvisional, false); assert.equal(x.picoAislado, false);
    assert.deepEqual(x.sobrecargaPorVerificar, []);
  });
  test('sin cifra de equipo (homologación excluida, circuito…) no hay ninguna marca', () => {
    const excluida = { filas: Object.fromEntries(Object.entries(homologacion.filas).map(([k, f]) => [k, { ...f, decision: { tipo: 'no_usar' } }])) };
    const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} } } } };
    const [x] = filasLista({ parque: [tx], homologacion: excluida, catalogo, resumenMes: { claves: { [cid]: { N13_8: r(1.1 * A_S, 1.3 * A_S, 1.2 * A_S) } } } });
    assert.equal(x.pct, null);
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.sobrecargaProvisional, false); assert.equal(x.picoAislado, false);
    assert.deepEqual(x.sobrecargaPorVerificar, []);
  });
  test('si otro devanado limpio ya confirma la sobrecarga, no hace falta leer la curva', () => {
    const x = fila({ N34_5: r(0.9 * A_P, 4 * A_P, 0.9 * A_P), N13_8: r(1.02 * A_S, 1.1 * A_S, 1.05 * A_S) });
    assert.equal(x.sobrecargaSostenida, true); assert.deepEqual(x.sobrecargaPorVerificar, []);
  });
});

/** Curva sintética de un mes (marzo, 744 h) en un nivel: las 3 corrientes con el mismo valor por hora. */
function docMes(valores, nivel = 'N13_8') {
  const n = horasMes('2026-03');
  const fam = {};
  for (const f of ['IR', 'IS', 'IT']) {
    const v = new Float32Array(n); const m = new Uint8Array(n); const b = new Uint8Array(n);
    for (let h = 0; h < n; h++) v[h] = typeof valores === 'function' ? valores(h) : valores;
    fam[f] = { v, m, b };
  }
  return { estado: 'ok', serie: { niveles: { [nivel]: { fam } } } };
}

describe('verificación con la curva del mes (serie limpia)', () => {
  test('GBT: 3 horas imposibles y nada real sobre el 100 % → sin sobrecarga ni pico', () => {
    const doc = docMes((h) => (h >= 100 && h < 103 ? 11 * A_S : 0.5 * A_S));
    const res = sobrecargaDeCurva(doc, '2026-03', 'N13_8', A_S);
    assert.equal(res.horas, 0); assert.equal(res.excluidas, 3); assert.ok(res.max < 100);
    const x = aplicarVerificacion(fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) }), [res]);
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.picoAislado, false); assert.equal(x.verificacion, 'ok');
    assert.deepEqual(x.sobrecargaPorVerificar, []);
  });
  test('horas imposibles Y una sobrecarga real de 4 h → la curva la confirma', () => {
    const doc = docMes((h) => (h === 50 ? 9 * A_S : (h >= 200 && h < 204 ? 1.08 * A_S : 0.7 * A_S)));
    const res = sobrecargaDeCurva(doc, '2026-03', 'N13_8', A_S);
    assert.equal(res.horas, 4); assert.equal(res.excluidas, 1);
    const x = aplicarVerificacion(fila({ N13_8: r(0.9 * A_S, 9 * A_S, 1.08 * A_S) }), [res]);
    assert.equal(x.sobrecargaSostenida, true); assert.equal(x.picoAislado, false);
  });
  test('una hora real sobre el 100 % sin ventana de 2 h → pico aislado', () => {
    const doc = docMes((h) => (h === 50 ? 9 * A_S : (h === 300 ? 1.15 * A_S : 0.7 * A_S)));
    const x = aplicarVerificacion(fila({ N13_8: r(0.9 * A_S, 9 * A_S, 0.9 * A_S) }), [sobrecargaDeCurva(doc, '2026-03', 'N13_8', A_S)]);
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.picoAislado, true);
  });
  test('curva que no se pudo leer → «por confirmar», sin afirmar ni negar', () => {
    assert.equal(sobrecargaDeCurva({ estado: 'fallo' }, '2026-03', 'N13_8', A_S), null);
    // Una curva que no trae el nivel, o lo trae sin una sola hora válida, tampoco decide.
    assert.equal(sobrecargaDeCurva({ estado: 'ok', serie: { niveles: { N34_5: { fam: {} } } } }, '2026-03', 'N13_8', A_S), null);
    const vacia = docMes(0); for (const f of ['IR', 'IS', 'IT']) vacia.serie.niveles.N13_8.fam[f].m.fill(21);
    assert.equal(sobrecargaDeCurva(vacia, '2026-03', 'N13_8', A_S), null);
    const x = aplicarVerificacion(fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) }), [null]);
    assert.equal(x.verificacion, 'fallo'); assert.equal(x.sobrecargaSostenida, false); assert.equal(x.picoAislado, false);
    assert.deepEqual(x.sobrecargaPorVerificar, []);
  });
  test('la fila verificada es NUEVA (no se muta la del cálculo)', () => {
    const base = fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) });
    const x = aplicarVerificacion(base, [{ horas: 0, max: 50, excluidas: 3 }]);
    assert.notEqual(x, base); assert.equal(base.sobrecargaPorVerificar.length, 1);
  });
});

test('L-102: el archivo nuevo es puro y la lista lo carga con import() (no con import estático)', () => {
  const dom = readFileSync(new URL('../assets/js/domain/scada_carga_sostenida.js', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"][^'"]*\/data\//.test(dom));
  const lista = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
  assert.match(lista, /import\('\.\.\/\.\.\/domain\/scada_carga_sostenida\.js'\)/);
  assert.ok(!/^import .*scada_carga_sostenida/m.test(lista));
});

describe('detalle: «Máximo sostenido 2 h» con la serie limpia (`99 §130`)', () => {
  test('una hora imposible ya no da miles de amperios; sin horas imposibles el valor es el mismo de antes', async () => {
    const { maxSostenido, serieCargabilidad } = await import('../assets/js/domain/scada_carga_kpis.js');
    const limpio = (iF, A) => { const c = serieCargabilidad(iF, A); return maxSostenido(iF.map((v, h) => (Number.isFinite(c.serie[h]) ? v : NaN)), 2); };
    const A = 175;
    // GBT: dos horas seguidas a 10 × A en un mes de ~0,6 × A con un tramo real de 2 h a 0,6 × A.
    const gbt = Float32Array.from({ length: 200 }, (_, h) => (h === 40 || h === 41 ? 10 * A : 0.6 * A));
    assert.equal(Math.round(maxSostenido(gbt, 2).valor), 10 * A);
    assert.equal(Math.round(limpio(gbt, A).valor), Math.round(0.6 * A));
    // Sin horas imposibles: idéntico (valor e índice).
    const normal = Float32Array.from({ length: 200 }, (_, h) => (h >= 80 && h < 83 ? 1.1 * A : 0.7 * A));
    assert.deepEqual(limpio(normal, A), maxSostenido(normal, 2));
  });
  test('la fila del detalle usa la serie limpia (no el resumen en bruto) cuando hay ampacidad', () => {
    const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
    assert.match(src, /maxSostenido\(d\.iF\.map\(/);
    assert.ok(!/f\.sostenida\.valor/.test(src));
  });
});
