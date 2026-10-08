// Cargabilidad SCADA (`99 §158`) — los equipos «sin medición»: el motivo dice la causa real y el relevo de una
// estación que el SCADA renombró conserva el punto y su historial. Datos SINTÉTICOS (estaciones «EstDemo»).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { aplicarRelevos, filtrarTexto, armarContenedor, leerContenedor } from '../assets/js/domain/scada_carga_paquete.js';
import { crearAcumulador, acumularArchivo } from '../assets/js/domain/scada_carga_importacion.js';
import { objetivoImportacion, fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { empaquetar, leerRelevos } from '../scripts/scada-empaquetar.mjs';

const MV = 'Mv' + 'Moment';
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + String(m).padStart(2, '0') + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const fila = (est, nivel, elem, tok, vals) => '/' + est.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const rep = (x) => Array.from({ length: 24 }, (_, h) => (typeof x === 'function' ? x(h) : x));
const enc = new TextEncoder();
const dec = new TextDecoder();
const RELEVO = [{ est: 'EstDemo1', nueva: 'EstDemo1F', desde: '2026-08-22' }];
const OBJ = objetivoImportacion({ r1: { clave_excel: '/EstDemo1/swTrafo1' }, r2: { clave_excel: '/EstDemo1/swTrafo2' } });

/** Un día del exporte: la estación vieja (viva hasta el 21) y la renombrada (viva desde el 22), más una ajena. */
function dia(d, extra = []) {
  return [cab(d, 8, 2026),
    fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep(d < 22 ? 200 + d : 0)),
    fila('EstDemo1F', '13.8kV', 'swTrafo1', 'I R', rep(d < 22 ? 2821 : 88)),
    fila('EstDemo1F', '13.8kV', 'swTrafo2', 'I R', rep(d < 22 ? 0 : 98)),
    fila('EstOtra', '13.8kV', 'swTrafo1', 'I R', rep(5)), ...extra].join('\r\n');
}

describe('relevo de estación (el SCADA renombró una estación)', () => {
  test('antes de la fecha manda la vieja y la nueva se descarta (puesta en servicio)', () => {
    const r = aplicarRelevos(dia(21), RELEVO);
    assert.equal(r.renombradas, 0); assert.equal(r.descartadas, 2);
    assert.match(r.texto, /EstDemo1 *\/13\.8kV *\/swTrafo1/);
    assert.doesNotMatch(r.texto, /EstDemo1F/);
    assert.match(r.texto, /EstOtra/);                 // lo ajeno no se toca
  });
  test('desde la fecha (inclusive) la nueva se escribe con el nombre de la vieja y la vieja se descarta', () => {
    const r = aplicarRelevos(dia(22), RELEVO);
    assert.equal(r.renombradas, 2); assert.equal(r.descartadas, 1);
    assert.doesNotMatch(r.texto, /EstDemo1F/);
    const lineas = r.texto.split('\n');
    assert.ok(lineas.some((l) => l.startsWith('/EstDemo1/13.8kV') && l.includes(',88,')));
    const t1 = lineas.filter((l) => /^\/EstDemo1 *\/13\.8kV *\/swTrafo1/.test(l));
    assert.equal(t1.length, 1); assert.ok(t1[0].includes(',88,'));   // queda UNA fila: la renombrada; la vieja (en cero) se fue
    assert.ok(lineas.slice(1, -1).every((l) => l.endsWith('\r')));   // se conserva el fin de línea
  });
  test('sin relevos o sin fecha legible en el encabezado, el texto sale idéntico', () => {
    assert.equal(aplicarRelevos(dia(22), []).texto, dia(22));
    const sinFecha = 'encabezado raro\n' + fila('EstDemo1F', '13.8kV', 'swTrafo1', 'I R', rep(1));
    assert.equal(aplicarRelevos(sinFecha, RELEVO).texto, sinFecha);
  });
  test('el lector ve UN solo punto con su historial: la vieja hasta el 21 y la nueva desde el 22', () => {
    const acc = crearAcumulador();
    const set = new Set(OBJ.estaciones);
    for (const d of [21, 22]) {
      const texto = filtrarTexto(aplicarRelevos(dia(d), RELEVO).texto, set);
      acumularArchivo(acc, { nombre: `ir_average-202608${d}.csv`, ruta: `Agosto/${d}Agosto/ir_average-202608${d}.csv`, texto, tamano: texto.length }, OBJ);
    }
    const cid1 = claveId('EstDemo1', 'swTrafo1'); const cid2 = claveId('EstDemo1', 'swTrafo2');
    assert.deepEqual([...acc.puntos.keys()].sort(), [cid1, cid2].sort());   // nada de «estdemo1f»
    assert.equal(acc.dias.get(cid1 + '|N13_8|IR|2026-08-21').v[0], 221);
    assert.equal(acc.dias.get(cid1 + '|N13_8|IR|2026-08-22').v[0], 88);
    assert.equal(acc.dias.get(cid2 + '|N13_8|IR|2026-08-22').v[0], 98);
    assert.equal(acc.dias.has(cid2 + '|N13_8|IR|2026-08-21'), false);
    assert.equal(acc.conflictos, 0);
  });
  test('el manifiesto anota los relevos solo si los hubo (un paquete sin relevos queda como antes)', () => {
    const a = [{ ruta: 'M/1/x.csv', nombre: 'x.csv', tamano: 1, contenido: enc.encode('a') }];
    const sin = leerContenedor(armarContenedor({ carpeta: 'M', creado: 'c', estaciones: ['b', 'a'] }, a)).manifiesto;
    assert.equal('relevos' in sin, false);
    const con = leerContenedor(armarContenedor({ carpeta: 'M', creado: 'c', estaciones: ['a'], relevos: RELEVO }, a)).manifiesto;
    assert.deepEqual(con.relevos, RELEVO);
  });
  test('--relevo: se lee «ESTACION=NUEVA@AAAA-MM-DD» y se rechaza lo mal escrito', () => {
    assert.deepEqual(leerRelevos(' EstDemo1=EstDemo1F@2026-08-22 , EstDemo2=EstDemo2B@2026-09-01'),
      [RELEVO[0], { est: 'EstDemo2', nueva: 'EstDemo2B', desde: '2026-09-01' }]);
    assert.deepEqual(leerRelevos(''), []);
    assert.throws(() => leerRelevos('EstDemo1=EstDemo1F'), /AAAA-MM-DD/);
    assert.throws(() => leerRelevos('EstDemo1=estdemo1@2026-08-22'), /distintas/);
  });
  test('el empaquetador de punta a punta aplica el relevo y lo cuenta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scada-relevo-'));
    try {
      const raiz = join(dir, 'Agosto');
      for (const d of [21, 22]) {
        mkdirSync(join(raiz, d + 'Agosto'), { recursive: true });
        writeFileSync(join(raiz, d + 'Agosto', `ir_average-202608${d}.csv`), dia(d));
      }
      const r = empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones, relevos: RELEVO, creado: '2026-10-08T00:00:00Z' });
      assert.deepEqual(r.relevos, { renombradas: 2, descartadas: 3 });
      const { manifiesto, archivos } = leerContenedor(new Uint8Array(gunzipSync(Buffer.concat(r.partes.map((p) => Buffer.from(p.bytes))))));
      assert.deepEqual(manifiesto.relevos, RELEVO);
      const t22 = dec.decode(archivos.find((a) => a.nombre.endsWith('22.csv')).contenido);
      assert.doesNotMatch(t22, /EstDemo1F|EstOtra/);
      assert.match(t22, /swTrafo2/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('equipo sin ninguna hora válida: el motivo dice la causa', () => {
  const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO' },
    electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']];
  const { filas } = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null);
  const cid = claveId('EstDemo1', 'swTrafo1');
  const catalogo = { meses: { '2026-09': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} } } } };
  const vacio = { n: 0, p50: null, p95: null, p98: null, p99: null, max: null, iMax: null, prom: null, unaFalta: 0 };
  const nivel = (o) => ({ i: vacio, sost: null, horas: 720, servicio: 720, des: 0, cob: 0, sMax: null, sP99: null, uProm: null, ...o });
  const motivo = (claves) => filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: { claves } })[0];
  test('el mes no trae su corriente (sin resumen, o solo tensiones): «no vino en el exporte del SCADA»', () => {
    const x = motivo({});
    assert.equal(x.pct, null); assert.equal(x.motivoNulo, 'no vino en el exporte del SCADA');
    assert.equal(motivo({ [cid]: { N13_8: nivel({ horas: 0, servicio: 0 }) } }).motivoNulo, 'no vino en el exporte del SCADA');
  });
  test('llega la potencia pero no la corriente: lo dice', () => {
    assert.equal(motivo({ [cid]: { N13_8: nivel({ sP99: 18.2, uProm: 13.6 }) } }).motivoNulo, 'sin corriente válida (sí llega la potencia)');
  });
  test('corriente en cero con tensión: «sin carga», no «sin medición»', () => {
    assert.equal(motivo({ [cid]: { N13_8: nivel({ servicio: 104, des: 616, uProm: 13.6 }) } }).motivoNulo, 'sin carga (fuera de servicio o en reserva)');
    // Pocas horas en cero con tensión no bastan para decir «sin carga».
    assert.equal(motivo({ [cid]: { N13_8: nivel({ servicio: 710, des: 10 }) } }).motivoNulo, 'medida congelada o marcada no válida por el SCADA');
  });
  test('lo demás: congelada o marcada no válida por el SCADA', () => {
    assert.equal(motivo({ [cid]: { N13_8: nivel({}) } }).motivoNulo, 'medida congelada o marcada no válida por el SCADA');
  });
  test('con horas válidas la cifra sale y no hay motivo (nada cambia para los que ya tenían cifra)', () => {
    const x = motivo({ [cid]: { N13_8: nivel({ i: { n: 700, p50: 400, p95: 600, p98: 620, p99: 640, max: 650, unaFalta: 0 }, sost: { v: 630 }, cob: 0.97, rUI: 1 }) } });
    assert.equal(x.motivoNulo, null); assert.ok(x.pct > 79 && x.pct < 81);
  });
});
