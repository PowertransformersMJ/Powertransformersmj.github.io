// Devanados de placa por transformador en Cargabilidad SCADA (pedido del Ingeniero, 2026-10-22): tensión, ampacidad,
// potencia CALCULADA del devanado (√3 × kV × A; monofásico kV × A o fase-neutro) y la carga que el SCADA mide de cada
// uno, solo si el equipo tiene cifra. Datos sintéticos (ningún equipo real del parque).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  devanadosDe, potenciaDevanadoMva, potenciaYConexion, potenciaPlacaKva, causaNoCuadra, FACTOR_NO_CUADRA, TEXTO_AVISO_DEVANADO,
  kvTexto, ampTexto, mvaTexto, pctTexto, CSV_DEV_CAB, csvDevanados
} from '../assets/js/domain/scada_carga_devanados.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { leerFilasHomologacion, fusionarHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';

const tx3 = { placa: { potencia_kva: 40000 }, electrico: {
  tension_primaria_kv: 110, corriente_nominal_primaria_a: 200,
  tension_secundaria_kv: 34.5, corriente_nominal_secundaria_a: 250,
  tension_terciaria_kv: 13.8, corriente_nominal_terciaria_a: 1500 } };

test('potencia del devanado: trifásico √3·kV·A y monofásico kV·A', () => {
  assert.equal(Math.round(potenciaDevanadoMva(66, 400) * 100) / 100, 45.73);
  assert.equal(Math.round(potenciaDevanadoMva(13.8, 30, 1) * 1000) / 1000, 0.414);
  assert.equal(potenciaDevanadoMva(null, 400), null);
  assert.equal(potenciaDevanadoMva(66, 0), null);
});

test('monofásico: se toma kV·A o kV·A/√3 (fase-neutro), la que cuadra con la placa', () => {
  // 0,3 MVA monofásico: primario 34,5 kV entre fases (8,7 A), secundario 13,8/√3 kV fase-neutro (37,7 A).
  const p = potenciaYConexion(34.5, 8.7, 1, 0.3); const s = potenciaYConexion(13.8, 37.7, 1, 0.3);
  assert.equal(p.conexion, 'monofasico'); assert.equal(Math.round(p.mva * 100) / 100, 0.3);
  assert.equal(s.conexion, 'fase_neutro'); assert.equal(Math.round(s.mva * 100) / 100, 0.3);
  assert.equal(potenciaYConexion(13.8, 37.7, 1, null).conexion, 'monofasico');   // sin placa no se adivina
  assert.equal(potenciaYConexion(13.8, 37.7, 3, 0.3).conexion, 'trifasico');
  const tx = { placa: { potencia_kva: 300 }, electrico: { fases: 1, tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 8.7, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 37.7 } };
  assert.ok(devanadosDe(tx, null).every((d) => d.aviso === null));               // ya no avisa en falso
});

test('potencia de placa: la mayor de sus etapas', () => {
  assert.equal(potenciaPlacaKva({ placa: { potencia_kva: 40000, potencia_onaf_kva: 45000 } }), 45000);
  assert.equal(potenciaPlacaKva({ placa: {} }), null);
  assert.equal(potenciaPlacaKva(null), null);
});

test('tres devanados: cada uno con su potencia (la placa solo da una)', () => {
  const ds = devanadosDe(tx3, null);
  assert.deepEqual(ds.map((d) => d.d), ['P', 'S', 'T']);
  assert.deepEqual(ds.map((d) => Math.round(d.mva)), [38, 15, 36]);
  assert.deepEqual(ds.map((d) => d.nombre), ['Primario', 'Secundario', 'Terciario']);
  assert.ok(ds.every((d) => d.aviso === null && d.pct === null && d.manda === false && d.niveles.length === 0 && d.conexion === 'trifasico'));
});

test('sin terciario registrado: no aparece', () => {
  const tx = { placa: { potencia_kva: 45000 }, electrico: { tension_primaria_kv: 66, corriente_nominal_primaria_a: 400, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 1900 } };
  assert.deepEqual(devanadosDe(tx, null).map((d) => d.d), ['P', 'S']);
});

test('avisos con su causa: errata ×10, parece monofásico, otra potencia, sin tensión, sin ampacidad', () => {
  const tx = { placa: { potencia_kva: 20000 }, electrico: {
    tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 335,
    tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 8400,
    corriente_nominal_terciaria_a: 1300 } };
  const ds = devanadosDe(tx, null);
  assert.equal(ds[0].aviso, null);
  assert.equal(ds[1].aviso, 'errata_x10');
  assert.equal(ds[2].aviso, 'sin_tension'); assert.equal(ds[2].mva, null);
  assert.equal(devanadosDe({ electrico: { tension_primaria_kv: 66 } }, null)[0].aviso, 'sin_ampacidad');
  assert.equal(causaNoCuadra(1.73, null), 'parece_monofasico');
  assert.equal(causaNoCuadra(3, undefined), 'parece_monofasico');
  assert.equal(causaNoCuadra(1.73, 1), 'no_cuadra_placa');
  assert.equal(causaNoCuadra(2.2, null), 'no_cuadra_placa');
  assert.equal(causaNoCuadra(10.2, null), 'errata_x10');
  for (const k of ['sin_tension', 'sin_ampacidad', 'errata_x10', 'parece_monofasico', 'no_cuadra_placa']) assert.ok(TEXTO_AVISO_DEVANADO[k]);
});

test('el umbral del aviso es generoso: ONAF sobre placa ONAN (×1,2) no avisa', () => {
  const tx = { placa: { potencia_kva: 12500 }, electrico: { tension_primaria_kv: 34.5, corriente_nominal_primaria_a: 250 } };
  assert.ok(devanadosDe(tx, null)[0].mva / 12.5 < FACTOR_NO_CUADRA);
  assert.equal(devanadosDe(tx, null)[0].aviso, null);
});

test('con la medida del SCADA: carga, corriente p99 y el devanado que da la cifra', () => {
  const calc = { pct: 82, devMax: 'T', niveles: [
    { nivel: 'N110', etiqueta: '110 kV', devanado: 'P', pct: 50 },
    { nivel: 'N13_8', etiqueta: '13,8 kV', devanado: 'T', pct: 82 },
    { nivel: 'N34_5', etiqueta: '34,5 kV', devanado: null, pct: null }] };
  const [P, S, T] = devanadosDe(tx3, calc);
  assert.equal(P.pct, 50); assert.equal(P.iP99, 100); assert.deepEqual(P.niveles, ['110 kV']); assert.equal(P.manda, false);
  assert.equal(S.pct, null); assert.equal(S.iP99, null); assert.deepEqual(S.niveles, []);
  assert.equal(T.pct, 82); assert.ok(T.manda); assert.equal(Math.round(T.iP99), 1230);
});

test('sin cifra de equipo (circuito, excluida, sin homologación) los devanados tampoco dan carga', () => {
  const ds = devanadosDe(tx3, { pct: null, devMax: 'P', niveles: [{ nivel: 'N110', etiqueta: '110 kV', devanado: 'P', pct: 50 }] });
  assert.ok(ds.every((d) => !d.manda && d.pct === null && d.iP99 === null));
  assert.deepEqual(ds[0].niveles, ['110 kV']);   // sí se dice qué nivel lo mide
});

test('dos niveles en el mismo devanado: manda el de mayor carga, nunca se suman', () => {
  const ds = devanadosDe(tx3, { pct: 70, devMax: 'P', niveles: [
    { nivel: 'a', etiqueta: 'A', devanado: 'P', pct: 30 }, { nivel: 'b', etiqueta: 'B', devanado: 'P', pct: 70 }] });
  assert.equal(ds[0].pct, 70);
  assert.deepEqual(ds[0].niveles, ['A', 'B']);
});

test('formato: tensión, ampacidad, potencia y carga', () => {
  assert.equal(kvTexto(110), '110'); assert.equal(kvTexto(13.8), '13,8');
  assert.equal(ampTexto(7.24), '7,2'); assert.equal(ampTexto(1500), '1.500');
  assert.equal(mvaTexto(0.25), '0,25'); assert.equal(mvaTexto(44.8), '44,8');
  assert.equal(pctTexto(89.6), '89,6');
});

test('CSV: 12 columnas fijas; vacías si el devanado falta o la fila viene de un módulo viejo', () => {
  assert.equal(CSV_DEV_CAB.length, 12);
  assert.equal(csvDevanados(devanadosDe(tx3, null)).length, 12);
  assert.equal(csvDevanados(undefined).length, 12);
  // Forma interna de calcularEquipo (sin `nombre`): no se confunde con la de placa.
  assert.deepEqual(csvDevanados([{ d: 'P', A: 300, pct: 90 }]), Array(12).fill(null));
  assert.ok(CSV_DEV_CAB.includes('Primario_potencia_calc_MVA'));
});

test('integración con la lista: campo propio, «da la cifra» = devMax y sin carga en el circuito sin confirmar', () => {
  const txs = [
    { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO' }, placa: { potencia_kva: 20000 },
      electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837 } },
    { id: 'b', identificacion: { matricula: 'T2-X/X-DM2' }, ubicacion: { subestacion_nombre: 'DEMO DOS' }, electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 400 } }
  ];
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO DOS', 'T2-X/X-DM2', '/EstDemo2/EDM302']];
  const homologacion = { filas: fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas };
  const c1 = claveId('EstDemo1', 'swTrafo1'); const c2 = claveId('EstDemo2', 'EDM302');
  const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [c1]: { niveles: { N13_8: {}, N34_5: {} } }, [c2]: { niveles: { N13_8: {} } } } };
  const r = (p99) => ({ i: { n: 700, p50: p99 * 0.7, p95: p99 * 0.95, p99, max: p99 * 1.05 }, sost: { v: p99 * 0.98 }, cob: 0.95, rUI: 1 });
  const f = filasLista({ parque: txs, homologacion, catalogo, resumenMes: { claves: { [c1]: { N13_8: r(753), N34_5: r(300) }, [c2]: { N13_8: r(200) } } } });
  const a = f.find((x) => x.id === 'a'); const b = f.find((x) => x.id === 'b');
  assert.ok(Array.isArray(a.devanados) && a.devanados.every((d) => !d.nombre));   // el de calcularEquipo no se pisa
  assert.deepEqual(a.devanadosPlaca.filter((d) => d.manda).map((d) => d.d), [a.devMax]);
  assert.equal(b.pct, null);
  assert.ok(b.devanadosPlaca.every((d) => d.pct === null && !d.manda));
});

test('L-102: el detalle no pide a lista.js exportaciones nuevas (un lista.js viejo en caché tumbaría la página)', () => {
  const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  const m = src.match(/import \{([^}]*)\} from '\.\/lista\.js'/);
  assert.ok(m);
  assert.deepEqual(m[1].split(',').map((x) => x.trim()).sort(), ['chipCifra', 'textoBandas']);
});

test('los módulos de pantalla que tocan los devanados compilan (las pruebas de dominio no los cargan)', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const f of ['lista.js', 'detalle.js']) {
    const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/' + f, import.meta.url), 'utf8');
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' });
    assert.equal(r.status, 0, f + ': ' + r.stderr);
  }
});
