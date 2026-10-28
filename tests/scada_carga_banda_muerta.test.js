// Cargabilidad SCADA — CORRIENTE CON BANDA MUERTA de un punto (decisión del Ingeniero 2026-10-28: Tres Palmas), con datos
// SINTÉTICOS («EstDemo»). Lo que se exige: con la marca, una corriente repetida con bandera buena vale («retenida») solo si
// la tensión del nivel se movió en el tramo; sin la marca, en otro nivel, con la tensión quieta o con bandera mala, todo como
// siempre; un mes guardado se vuelve a limpiar sin las carpetas; un limpiador viejo se detiene; la cifra es firme solo con
// un escalón de hasta 5 puntos; el importador y el diálogo usan la marca.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limpiarNivel } from '../assets/js/domain/scada_carga_limpieza.js';
import { procesarPuntoMes, TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';
import {
  bandaMuerta, puntosBandaMuerta, conMarcaBandaMuerta, reprocesarConMarcas, motivoBandaMuerta, MOTIVO_BANDA_MUERTA, TOPE_BANDA_MUERTA_PCT
} from '../assets/js/domain/scada_carga_banda_muerta.js';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO, BANDERA, FAMILIAS } from '../assets/js/domain/scada_carga_config.js';

const N = 48;
const PASO = 0.9765625;
/**
 * Un nivel crudo con corriente en escalones gruesos: IR quieta 24 h y 24 h, IS en tramos de 12 h, IT quieta las 48 h. La
 * tensión se mueve en las horas 0–35 y queda quieta en 36–47. P y Q se mueven siempre. Todo con bandera «Actual».
 */
function crudo(kv = 13.8) {
  const fams = {};
  for (const f of FAMILIAS) {
    const v = new Float32Array(N); const b = new Uint8Array(N).fill(BANDERA.ACTUAL); const presente = new Uint8Array(N).fill(1);
    for (let h = 0; h < N; h++) {
      if (f === 'IR') v[h] = Math.fround(PASO * (h < 24 ? 4 : 5));
      else if (f === 'IS') v[h] = Math.fround(PASO * (Math.floor(h / 12) % 2 ? 8 : 7));
      else if (f === 'IT') v[h] = Math.fround(PASO * 6);
      else if (f[0] === 'U') v[h] = h < 36 ? kv + (h % 3) / 100 : kv + 0.01;
      else v[h] = Math.fround(0.1 + (h % 5) / 100);
    }
    fams[f] = { v, b, presente };
  }
  return fams;
}
const codigos = (out, f) => [...out[f].m];
const todos = (m, a, z, c) => m.slice(a, z).every((x) => x === c);

describe('limpieza con banda muerta', () => {
  test('sin la marca, la corriente repetida es «congelada» (como siempre)', () => {
    const out = limpiarNivel(crudo(), 13.8);
    for (const f of ['IR', 'IS', 'IT']) assert.ok(todos(codigos(out, f), 0, N, CODIGO.CONGELADO), f);
  });
  test('con la marca, vale si la tensión se movió en el tramo; si la tensión quedó quieta, sigue congelada', () => {
    const c = crudo();
    const out = limpiarNivel(c, 13.8, { bandaMuerta: true });
    assert.ok(todos(codigos(out, 'IR'), 0, N, CODIGO.RETENIDO), 'IR: en los dos tramos la tensión se movió');
    assert.ok(todos(codigos(out, 'IT'), 0, N, CODIGO.RETENIDO), 'IT: la tensión se movió dentro de las 48 h');
    const is = codigos(out, 'IS');
    assert.ok(todos(is, 0, 36, CODIGO.RETENIDO), 'IS: tramos con la tensión moviéndose');
    assert.ok(todos(is, 36, 48, CODIGO.CONGELADO), 'IS 36–47: la tensión quieta → congelada');
    assert.ok(todos(codigos(out, 'P'), 0, N, CODIGO.VALIDO), 'P y Q no cambian');
    assert.deepEqual([...out.IR.v], [...c.IR.v], 'el valor crudo no cambia');
  });
  test('la bandera mala sigue fuera: «Not Renewed» no se vuelve válida', () => {
    const c = crudo();
    for (const f of FAMILIAS) for (let h = 6; h < 18; h++) c[f].b[h] = BANDERA.NOT_RENEWED;
    const m = codigos(limpiarNivel(c, 13.8, { bandaMuerta: true }), 'IR');
    assert.ok(todos(m, 6, 18, CODIGO.BANDERA));
    assert.ok(todos(m, 18, 48, CODIGO.RETENIDO));
  });
  test('sin tensión medida no hay con qué ver que la medida está viva: congelada', () => {
    const c = crudo();
    for (const f of ['URS', 'UST', 'UTR']) c[f].b.fill(BANDERA.NOT_RENEWED);
    assert.ok(todos(codigos(limpiarNivel(c, 13.8, { bandaMuerta: true }), 'IT'), 0, N, CODIGO.CONGELADO));
  });
  test('procesarPuntoMes: la marca vale SOLO en sus niveles', () => {
    const p = procesarPuntoMes({ N13_8: crudo(13.8), N34_5: crudo(34.5) }, null, 'completar', { bandaMuerta: ['N13_8'] });
    assert.ok(todos([...p.niveles.N13_8.fam.IT.m], 0, N, CODIGO.RETENIDO));
    assert.ok(todos([...p.niveles.N34_5.fam.IT.m], 0, N, CODIGO.CONGELADO));
    assert.equal(p.resumen.N34_5.i.n, 0);
    assert.ok(p.resumen.N13_8.i.n > 0);
  });
});

describe('volver a limpiar un mes ya guardado y el limpiador viejo', () => {
  test('mismo resultado que haberlo importado con la marca, con el rastro de las horas aceptadas', () => {
    const guardado = procesarPuntoMes({ N13_8: crudo() }, null, 'completar');
    const conMarca = conMarcaBandaMuerta(procesarPuntoMes({ N13_8: crudo() }, null, 'completar', { bandaMuerta: ['N13_8'] }), ['N13_8']);
    const r = reprocesarConMarcas({ niveles: guardado.niveles }, { bandaMuerta: ['N13_8'] });
    assert.deepEqual(r.resumen, conMarca.resumen);
    assert.equal(r.resumen.N13_8.bandaMuertaAceptadas, N);
    for (const f of FAMILIAS) assert.deepEqual([...r.niveles.N13_8.fam[f].m], [...conMarca.niveles.N13_8.fam[f].m], f);
  });
  test('sin marcas, volver a limpiar no cambia nada', () => {
    const g = procesarPuntoMes({ N13_8: crudo() }, null, 'completar');
    assert.deepEqual(reprocesarConMarcas({ niveles: g.niveles }, {}).resumen, g.resumen);
  });
  test('un limpiador viejo (que ignora la marca) se detiene en vez de guardar lo de siempre', () => {
    const viejo = procesarPuntoMes({ N13_8: crudo() }, null, 'completar');
    assert.throws(() => conMarcaBandaMuerta(viejo, ['N13_8']), /versión anterior/);
  });
  test('con la tensión quieta todo el mes, lo congelado es legítimo: no se detiene', () => {
    const c = crudo();
    for (const f of ['URS', 'UST', 'UTR']) c[f].v.fill(13.81);
    const p = conMarcaBandaMuerta(procesarPuntoMes({ N13_8: c }, null, 'completar', { bandaMuerta: ['N13_8'] }), ['N13_8']);
    assert.equal(p.resumen.N13_8.bandaMuertaAceptadas, 0);
  });
});

describe('la marca en la homologación', () => {
  const fila = (decision, extra = {}) => ({ clave_excel: '/EstDemo1/swTrafo1', decision, ...extra });
  test('solo con «usar» y un escalón positivo por nivel', () => {
    assert.equal(bandaMuerta(fila({ tipo: 'usar', banda_muerta: { N13_8: 0.977 } }), 'N13_8'), 0.977);
    assert.equal(bandaMuerta(fila({ tipo: 'usar', banda_muerta: { N13_8: 0.977 } }), 'N34_5'), null);
    assert.equal(bandaMuerta(fila({ tipo: 'no_usar', banda_muerta: { N13_8: 0.977 } }), 'N13_8'), null);
    assert.equal(bandaMuerta(fila({ tipo: 'usar', banda_muerta: { N13_8: '0.977' } }), 'N13_8'), null);
    assert.equal(bandaMuerta(fila({ tipo: 'usar', banda_muerta: { N13_8: 0 } }), 'N13_8'), null);
  });
  test('los puntos marcados juntan los niveles de sus filas; una fila retirada no cuenta', () => {
    const filas = {
      a: fila({ tipo: 'usar', banda_muerta: { N13_8: 0.977 } }),
      b: fila({ tipo: 'usar', banda_muerta: { N34_5: 1 } }),
      c: fila({ tipo: 'usar', banda_muerta: { N13_8: 0.977 } }, { clave_excel: '/EstDemo2/swTrafo1', retirada: true }),
      d: fila({ tipo: 'usar' }, { clave_excel: '/EstDemo3/swTrafo1' })
    };
    const p = puntosBandaMuerta(filas);
    assert.deepEqual([...p.entries()], [[claveId('EstDemo1', 'swTrafo1'), ['N13_8', 'N34_5']]]);
  });
});

describe('la cifra: firme solo con un escalón de hasta 5 puntos', () => {
  const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
    electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 12.6, corriente_nominal_secundaria_a: 31.37 } };
  const cid = claveId('EstDemo1', 'swTrafo1');
  const red = (x) => Math.round(x * 1000) / 1000;
  const v = Array.from({ length: 600 }, (_, h) => Math.fround(PASO * (8 + (h % 3))));
  const e = estadisticas(Float32Array.from(v));
  const nivel = { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 },
    sost: null, horas: 720, servicio: 720, des: 0, cob: e.n / 720, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0,
    top: [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
  const catalogo = { meses: { '2026-01': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} }, meses: ['2026-01'] } } };
  function filaCon(extra) {
    const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
    const id = Object.keys(filas)[0];
    filas[id] = { ...filas[id], decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo1', mapa: { N13_8: 'S', N34_5: null }, niveles_vistos: ['N13_8'], nota: 'demo', avisos_vistos: [], ...extra } };
    return filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: { mes: '2026-01', claves: { [cid]: { N13_8: nivel } } } })[0];
  }
  test('escalón de 0,977 A sobre 31,37 A (3,1 puntos): firme, la misma cifra y el escalón a la vista', () => {
    const sin = filaCon({}); const con = filaCon({ banda_muerta: { N13_8: 0.977 } });
    assert.equal(con.firme, true, con.motivos.join('; '));
    assert.equal(con.pct, sin.pct);
    const n = con.niveles.find((x) => x.nivel === 'N13_8');
    assert.equal(n.bandaMuerta, 0.977);
    assert.ok(Math.abs(n.bandaMuertaPct - 3.114) < 0.01, String(n.bandaMuertaPct));
  });
  test('escalón de 2 A (6,4 puntos): provisional con su motivo', () => {
    const x = filaCon({ banda_muerta: { N13_8: 2 } });
    assert.equal(x.firme, false);
    assert.deepEqual(x.motivos, [MOTIVO_BANDA_MUERTA]);
  });
  test('el motivo mira solo devanados con cifra y exige un número dentro del tope', () => {
    assert.equal(TOPE_BANDA_MUERTA_PCT, 5);
    assert.equal(motivoBandaMuerta([{ pct: 30, bandaMuertaPct: 5 }]), null);
    assert.equal(motivoBandaMuerta([{ pct: 30, bandaMuertaPct: 5.01 }]), MOTIVO_BANDA_MUERTA);
    assert.equal(motivoBandaMuerta([{ pct: 30, bandaMuertaPct: null }]), MOTIVO_BANDA_MUERTA, 'sin ampacidad no se puede medir el escalón');
    assert.equal(motivoBandaMuerta([{ pct: null, bandaMuertaPct: 9 }]), null);
    assert.equal(motivoBandaMuerta([{ pct: 30 }]), null, 'sin marca, nada');
  });
});

test('pantallas: el importador, el lector y el diálogo usan la marca (lo que no corre en Node queda en el código)', () => {
  const w = readFileSync(new URL('../assets/js/workers/scada_carga_importar.worker.js', import.meta.url), 'utf8');
  assert.match(w, /if \(conBanda\.has\(cid\)\) op\.bandaMuerta = conBanda\.get\(cid\);/);
  assert.match(w, /if \(op\.bandaMuerta\) p = conMarcaBandaMuerta\(p, op\.bandaMuerta\);/);
  const im = readFileSync(new URL('../assets/js/ui/scada-datos/importar-mes.js', import.meta.url), 'utf8');
  assert.match(im, /puntosBandaMuerta\(filasVigentes\(\)\)\.size && procesado\.versionBandaMuerta == null/);
  assert.match(im, /JSON\.stringify\(\[\.\.\.puntosBandaMuerta\(filasVigentes\(\)\)\.entries\(\)\]/);
  const h = readFileSync(new URL('../assets/js/ui/scada-datos/homologacion.js', import.meta.url), 'utf8');
  assert.match(h, /if \(Object\.keys\(bm\)\.length\) decision\.banda_muerta = bm;/);
  const d = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(d, /corriente con banda muerta: el valor repetido cuenta como válido si la tensión se movió/);
});
