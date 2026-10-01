// Cargabilidad SCADA (`99 §122`) — paquete preparado de un mes y arreglos de la revisión del
// 2026-10-01, con datos SINTÉTICOS (estaciones «EstDemo»). Lo que se exige: el paquete entrega al
// lector EXACTAMENTE lo mismo que la carpeta (mismo acumulador, mismos conteos), y nada se pierde
// en silencio (partes que faltan, huella, estaciones que la homologación pide y el paquete no trae).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  PAQUETE, seLee, filtrarTexto, armarContenedor, leerContenedor, nombreParte, analizarNombreParte, partir, juntarPartes, estacionesFaltantes
} from '../assets/js/domain/scada_carga_paquete.js';
import { crearAcumulador, acumularArchivo } from '../assets/js/domain/scada_carga_importacion.js';
import {
  objetivoImportacion, avisosFila, conteosHomologacion, fusionarHomologacion, leerFilasHomologacion, filaId, mapaDeDecision
} from '../assets/js/domain/scada_carga_homologacion.js';
import { firmeza } from '../assets/js/domain/scada_carga_kpis.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { empaquetar } from '../scripts/scada-empaquetar.mjs';

const MV = 'Mv' + 'Moment';
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + String(m).padStart(2, '0') + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const fila = (est, nivel, elem, tok, vals) => '/' + est.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const rep = (x) => Array.from({ length: 24 }, (_, h) => (typeof x === 'function' ? x(h) : x));
const OBJ = objetivoImportacion({ r1: { clave_excel: '/EstDemo1/swTrafo1' }, r2: { clave_excel: '/EstDemo2/EDM302' } });
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Una carpeta de mes sintética: dos estaciones homologadas y una ajena, con \r\n, BOM, vacío, max y xls. */
function carpetaSintetica() {
  const out = [];
  for (const d of [1, 2]) {
    const dd = String(d).padStart(2, '0');
    out.push({ nombre: 'ir_average-202603' + dd + '.csv', ruta: 'Marzo/' + dd + 'Marzo/ir_average-202603' + dd + '.csv', texto:
      '﻿' + [cab(d, 3, 2026), fila('EstOtra', '13.8kV', 'swTrafo1', 'I R', rep(9)), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep((h) => 300 + h)),
        fila('EstDemo1', '13.8kV', 'OTRO301', 'I R', rep(7)), fila('EstDemo2', '13.8kV', 'EDM302', 'I R', rep(50)), fila('EstOtra', '34.5kV', 'X', 'I R', rep(1)), ''].join('\r\n') });
    out.push({ nombre: 'ir_quality-202603' + dd + '.csv', ruta: 'Marzo/' + dd + 'Marzo/ir_quality-202603' + dd + '.csv', texto:
      [cab(d, 3, 2026), fila('EstOtra', '13.8kV', 'swTrafo1', 'I R', rep('Invalid')), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep((h) => (h === 5 ? 'Invalid' : 'Actual')))].join('\n') });
  }
  out.push({ nombre: 'ir_average-20260303.csv', ruta: 'Marzo/03Marzo/ir_average-20260303.csv', texto: '' });
  out.push({ nombre: 'ir_max-20260301.csv', ruta: 'Marzo/01Marzo/ir_max-20260301.csv', texto: cab(1, 3, 2026) + '\n' + fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep(999)) });
  out.push({ nombre: 'P_average-20260301.xls', ruta: 'Marzo/01Marzo/P_average-20260301.xls', texto: 'binario' });
  out.push({ nombre: 'sin-estadistico-20260302.csv', ruta: 'Marzo/02Marzo/sin-estadistico-20260302.csv', texto: [cab(2, 3, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I S', rep(301))].join('\n') });
  return out.map((a) => ({ ...a, tamano: enc.encode(a.texto).length }));
}

/** Lo que hace el worker con una lista de archivos (lee solo los que seLee, con su tamaño). */
function acumular(lista) {
  const acc = crearAcumulador();
  for (const a of lista) acumularArchivo(acc, { nombre: a.nombre, ruta: a.ruta, texto: seLee(a.nombre) && a.tamano ? a.texto : '', tamano: a.tamano }, OBJ);
  return acc;
}
const canon = (acc) => JSON.stringify({
  dias: [...acc.dias.entries()].map(([k, d]) => [k, [...d.v].map(String), [...d.b], [...d.pv]]).sort(),
  puntos: [...acc.puntos.entries()].sort(), fechas: [...acc.fechas.entries()].sort(),
  archivos: acc.archivos, discrepancias: acc.discrepancias, conflictos: acc.conflictos, invalidos: acc.invalidos
});

describe('paquete preparado: formato', () => {
  test('qué lee el lector: CSV de promedio, calidad o sin estadístico; nada más', () => {
    assert.equal(seLee('ir_average-20260301.csv'), true);
    assert.equal(seLee('IR_Average-20260102.csv'), true);
    assert.equal(seLee('q_quality-20260301.csv'), true);
    assert.equal(seLee('sin-estadistico.csv'), true);
    assert.equal(seLee('ir_max-20260301.csv'), false);
    assert.equal(seLee('q_min_adm1-20260301.csv'), false);
    assert.equal(seLee('U_Current-20260101.csv'), false);
    assert.equal(seLee('P_average-20260101.xls'), false);
  });
  test('el filtro deja el encabezado y SOLO las filas de las estaciones dadas, línea por línea', () => {
    const t = carpetaSintetica()[0].texto;
    const f = filtrarTexto(t, new Set(OBJ.estaciones));
    const lineas = f.split('\n');
    assert.equal(lineas[0], t.split('\n')[0]);                       // encabezado intacto (con BOM y \r)
    assert.equal(lineas.length, 4);                                  // encabezado + 3 filas de EstDemo1/EstDemo2
    assert.ok(lineas.slice(1).every((l) => /EstDemo/.test(l) && l.endsWith('\r')));
  });
  test('contenedor de ida y vuelta, con marcas vacías y tamaño original', () => {
    const archivos = [
      { ruta: 'Marzo/01Marzo/a.csv', nombre: 'a.csv', tamano: 120, contenido: enc.encode('hola,1\nmundo,2') },
      { ruta: 'Marzo/01Marzo/b_max.csv', nombre: 'b_max.csv', tamano: 5000, contenido: null },
      { ruta: 'Marzo/01Marzo/c.csv', nombre: 'c.csv', tamano: 0, contenido: null }
    ];
    const c = armarContenedor({ carpeta: 'Marzo', creado: '2026-10-01T00:00:00Z', estaciones: ['estdemo2', 'estdemo1'] }, archivos);
    const r = leerContenedor(c);
    assert.equal(r.manifiesto.carpeta, 'Marzo');
    assert.deepEqual(r.manifiesto.estaciones, ['estdemo1', 'estdemo2']);
    assert.equal(dec.decode(r.archivos[0].contenido), 'hola,1\nmundo,2');
    assert.equal(r.archivos[1].tamano, 5000); assert.equal(r.archivos[1].contenido.length, 0);
    assert.throws(() => leerContenedor(c.subarray(0, c.length - 1)), /incompleto/);
    const extra = new Uint8Array(c.length + 1); extra.set(c);
    assert.throws(() => leerContenedor(extra), /bytes de más/);
    assert.throws(() => leerContenedor(enc.encode('OTRA COSA 1\n{}\n')), /No es un paquete/);
  });
  test('partes: nombre con la huella, juntar en orden, avisar las que faltan y no mezclar paquetes', () => {
    const bytes = new Uint8Array(25).map((_, i) => i);
    const sha = 'a'.repeat(64);
    const trozos = partir(bytes, 10);
    assert.deepEqual(trozos.map((t) => t.length), [10, 10, 5]);
    const nombres = trozos.map((_, k) => nombreParte('Marzo', k + 1, trozos.length, sha));
    assert.equal(nombres[0], 'scada-Marzo-p01de03-' + sha + PAQUETE.extension);
    assert.deepEqual(analizarNombreParte(nombres[2]), { carpeta: 'Marzo', i: 3, n: 3, sha });
    assert.equal(analizarNombreParte('scada-Marzo-p04de03-' + sha + '.sgmpaq'), null);
    assert.equal(analizarNombreParte('otra.csv'), null);
    const p = trozos.map((b, k) => ({ i: k + 1, n: 3, sha, bytes: b }));
    assert.deepEqual(juntarPartes([p[2], p[0]]).faltan, [2]);
    const j = juntarPartes([p[2], p[0], p[1]]);
    assert.equal(j.completo, true); assert.deepEqual([...j.bytes], [...bytes]);
    assert.throws(() => juntarPartes([p[0], { ...p[1], sha: 'b'.repeat(64) }]), /paquetes distintos/);
  });
  test('si la homologación vigente pide una estación que el paquete no trae, se detiene', () => {
    assert.deepEqual(estacionesFaltantes(['estdemo1', 'estdemo3'], ['estdemo1', 'estdemo2']), ['estdemo3']);
    assert.deepEqual(estacionesFaltantes(['estdemo1'], ['estdemo1', 'estdemo2']), []);
  });
});

describe('paquete preparado: el lector ve lo mismo que con la carpeta', () => {
  test('mismo acumulador y mismos conteos (filas ajenas fuera, marcas con el tamaño original)', () => {
    const original = carpetaSintetica();
    const set = new Set(OBJ.estaciones);
    const paquete = original.map((a) => ({ ...a, texto: seLee(a.nombre) && a.tamano ? filtrarTexto(a.texto, set) : '' }));
    assert.equal(canon(acumular(paquete)), canon(acumular(original)));
    const acc = acumular(original);
    assert.equal(acc.archivos.otrosEstadisticos, 1); assert.equal(acc.archivos.noCsv, 1); assert.equal(acc.archivos.vacios, 1);
  });
  test('el empaquetador de punta a punta: carpeta en disco → partes → mismo contenido filtrado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scada-paq-'));
    try {
      const raiz = join(dir, 'Marzo');
      for (const a of carpetaSintetica()) {
        const abs = join(dir, ...a.ruta.split('/'));
        mkdirSync(join(abs, '..'), { recursive: true });
        writeFileSync(abs, a.texto);
      }
      writeFileSync(join(raiz, '.DS_Store'), 'x');
      const r = empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones, creado: '2026-10-01T00:00:00Z' });
      const gz = Buffer.concat(r.partes.map((p) => Buffer.from(p.bytes)));
      assert.equal(createHash('sha256').update(gz).digest('hex'), r.sha);
      assert.ok(r.partes.every((p) => analizarNombreParte(p.nombre) && analizarNombreParte(p.nombre).sha === r.sha));
      const { manifiesto, archivos } = leerContenedor(new Uint8Array(gunzipSync(gz)));
      assert.equal(manifiesto.carpeta, 'Marzo');
      const esperado = carpetaSintetica().sort((a, b) => a.ruta.localeCompare(b.ruta));
      assert.deepEqual(archivos.map((a) => a.ruta).sort(), esperado.map((a) => a.ruta).sort());   // sin .DS_Store
      const porRuta = new Map(archivos.map((a) => [a.ruta, a]));
      const lista = esperado.map((a) => ({ ...a, texto: dec.decode(porRuta.get(a.ruta).contenido), tamano: porRuta.get(a.ruta).tamano }));
      assert.equal(canon(acumular(lista)), canon(acumular(esperado)));
      assert.throws(() => empaquetar({ carpeta: join(dir, '_otra'), estaciones: [] }), /no es un mes/);
      mkdirSync(join(raiz, '_bahia-x'), { recursive: true }); writeFileSync(join(raiz, '_bahia-x', 'a.csv'), 'x');
      assert.throws(() => empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones }), /no es de un mes/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('arreglos de la revisión del 2026-10-01', () => {
  const tx = { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
  const { filas } = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null);
  const f1 = filas[filaId('T1-X/X-DM1', 'DEMO UNO')];
  test('una decisión con mapa VACÍO (confirmada antes de cargar meses) no tapa el mapa automático', () => {
    const conteos = conteosHomologacion(filas);
    const conVacio = { ...f1, decision: { tipo: 'usar', mapa: {}, avisos_vistos: [] } };
    assert.equal(mapaDeDecision(conVacio), null);
    assert.equal(mapaDeDecision({ ...f1, decision: { tipo: 'usar', mapa: null } }), null);
    assert.deepEqual(mapaDeDecision({ ...f1, decision: { tipo: 'usar', mapa: { N13_8: 'S' } } }), { N13_8: 'S' });
    const r = avisosFila(conVacio, { ...conteos, tx, punto: { niveles: { N13_8: {}, N110: {} } } });
    assert.deepEqual(r.mapa, { N13_8: 'S' });
    assert.ok(r.avisos.includes('NIVEL_SIN_DEVANADO'));   // el nivel de 110 kV sigue avisándose
  });
  test('firmeza: con solo 2 fases en la mayoría de las horas la cifra no es firme', () => {
    const base = { estadoHomologacion: 'automatica', esCircuito: false, placa: { P: { kv: 34.5, A: 300 }, S: { kv: 13.8, A: 800 } }, mesesFallidos: [],
      devanados: [{ d: 'S', A: 800, pct: 80, cobertura: 0.95, n: 700, escala: 'ok', unaFalta: 0 }] };
    assert.equal(firmeza(base).firme, true);
    assert.equal(firmeza({ ...base, devanados: [{ ...base.devanados[0], unaFalta: 350 }] }).firme, true);      // la mitad justa: aún firme
    const f = firmeza({ ...base, devanados: [{ ...base.devanados[0], unaFalta: 351 }] });
    assert.equal(f.firme, false); assert.ok(f.motivos.includes('falta una fase en la mayoría de las horas'));
  });
  test('un nivel que aparece DESPUÉS de confirmar vuelve a pedir revisión (no queda fuera en silencio)', () => {
    const conteos = conteosHomologacion(filas);
    const dec = { tipo: 'usar', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], avisos_vistos: [] };
    const solo = avisosFila({ ...f1, decision: dec }, { ...conteos, tx, punto: { niveles: { N13_8: {} } } });
    assert.ok(!solo.avisos.includes('NIVEL_NO_REVISADO'));
    const nuevo = avisosFila({ ...f1, decision: dec }, { ...conteos, tx, punto: { niveles: { N13_8: {}, N34_5: {} } } });
    assert.ok(nuevo.avisos.includes('NIVEL_NO_REVISADO'));
    // Un nivel que se vio y se dejó en «No usar» no vuelve a pedir revisión.
    const visto = avisosFila({ ...f1, decision: { ...dec, niveles_vistos: ['N34_5', 'N13_8'] } }, { ...conteos, tx, punto: { niveles: { N13_8: {}, N34_5: {} } } });
    assert.ok(!visto.avisos.includes('NIVEL_NO_REVISADO'));
  });
  test('la lista pasa unaFalta a la firmeza: con 2 fases en la mayoría de las horas sale provisional', () => {
    const parque = [{ id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO' }, electrico: tx.electrico }];
    const cid = claveId('EstDemo1', 'swTrafo1');
    const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} } } } };
    const r = (unaFalta) => ({ claves: { [cid]: { N13_8: { i: { n: 700, p50: 400, p95: 600, p99: 640, max: 650, unaFalta }, sost: { v: 630 }, cob: 0.95, rUI: 1 } } } });
    assert.equal(filasLista({ parque, homologacion: { filas }, catalogo, resumenMes: r(10) })[0].clase, 'firme');
    const x = filasLista({ parque, homologacion: { filas }, catalogo, resumenMes: r(400) })[0];
    assert.equal(x.clase, 'provisional'); assert.ok(x.motivos.includes('falta una fase en la mayoría de las horas'));
  });
  test('con horas medidas en un nivel que no casa con la placa, el motivo lo dice (no «sin horas válidas»)', () => {
    const parque = [{ id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO' }, electrico: tx.electrico }];
    const cid = claveId('EstDemo1', 'swTrafo1');
    const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [cid]: { niveles: { N110: {} } } } };
    const resumenMes = { claves: { [cid]: { N110: { i: { n: 650, p50: 70, p95: 95, p99: 100, max: 105, unaFalta: 0 }, sost: { v: 98 }, cob: 0.9, rUI: 1 } } } };
    const [x] = filasLista({ parque, homologacion: { filas }, catalogo, resumenMes });
    assert.equal(x.pct, null);
    assert.equal(x.motivoNulo, 'el nivel medido no coincide con la placa');
    // La causa exacta: placa sin tensiones, o nivel que casa con dos devanados.
    const sinPlaca = filasLista({ parque: [{ ...parque[0], electrico: {} }], homologacion: { filas }, catalogo, resumenMes })[0];
    assert.equal(sinPlaca.motivoNulo, 'la placa del parque no trae tensiones');
    const amb = { ...parque[0], electrico: { tension_primaria_kv: 115, tension_secundaria_kv: 110, corriente_nominal_primaria_a: 100, corriente_nominal_secundaria_a: 105 } };
    const ambigua = filasLista({ parque: [amb], homologacion: { filas }, catalogo, resumenMes })[0];
    assert.equal(ambigua.motivoNulo, 'el nivel medido coincide con más de un devanado');
  });
});
