// Cargabilidad SCADA — MES A MES y ACUMULADO a la fecha de un equipo (pedido del Ingeniero 2026-10-23), con datos
// SINTÉTICOS (estación «EstDemo»). Lo que se exige: el mes = la lista en «Un mes»; el acumulado = la lista en «Varios
// meses» desde el primer mes del punto (p99 EXACTO de todas las horas, nunca el promedio); el promedio simple solo informa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { devanadosDe } from '../assets/js/domain/scada_carga_devanados.js';
import { serieMensualEquipo, mesesDelEquipo } from '../assets/js/domain/scada_carga_mensual.js';

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const f32 = (x) => Math.fround(x);
const red = (x) => Math.round(x * 1000) / 1000;
const top90 = (v) => [...v].sort((a, b) => b - a).slice(0, TOP_HORAS);
const nivel = (v) => {
  const e = estadisticas(Float32Array.from(v));
  return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 },
    sost: null, horas: 720, servicio: 720, des: 0, cob: e.n / 720, sMax: null, sP99: null, rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0, top: top90(v) };
};
const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
const homologacion = { filas };
const cid = claveId('EstDemo1', 'swTrafo1');
const r = azar(11);
const MESES = ['2026-01', '2026-02', '2026-03', '2026-04'];
// Marzo sin datos del punto (como mayo en Lorica); la carga sube mes a mes.
const horas = { '2026-01': Array.from({ length: 700 }, () => f32(380 + r() * 150)), '2026-02': Array.from({ length: 650 }, () => f32(430 + r() * 150)),
  '2026-04': Array.from({ length: 690 }, () => f32(470 + r() * 160)) };
const resumenes = Object.fromEntries(MESES.map((m) => [m, { mes: m, claves: horas[m] ? { [cid]: { N13_8: nivel(horas[m]) } } : {} }]));
const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: ['2026-01', '2026-02', '2026-04'] } } };
const punto = catalogo.puntos[cid];
const serie = serieMensualEquipo({ tx, homologacion, catalogo, punto, resumenes });

test('los meses del equipo: los que el parque cargó desde el primero del punto (con su hueco)', () => {
  assert.deepEqual(mesesDelEquipo(catalogo, punto), MESES);
  assert.deepEqual(mesesDelEquipo({ meses: { '2025-12': {}, ...catalogo.meses } }, punto), MESES);
  assert.deepEqual(serie.map((x) => x.mes), MESES);
});

test('cada mes = la cifra de la lista en «Un mes»', () => {
  for (const m of MESES) {
    const x = filasLista({ parque: [tx], homologacion, catalogo, resumenMes: resumenes[m] })[0];
    const s = serie.find((y) => y.mes === m).mensual;
    assert.equal(s.pct, x.pct); assert.equal(s.crg, x.crg); assert.equal(s.clase, x.clase); assert.equal(s.motivoNulo, x.motivoNulo);
  }
  assert.equal(serie[2].mensual.pct, null, 'marzo sin datos del punto no tiene cifra');
});

test('el acumulado = «Varios meses» desde el primer mes: p99 EXACTO de todas las horas a la fecha', () => {
  for (let k = 1; k < MESES.length; k++) {
    const tramo = MESES.slice(0, k + 1);
    const p = filasPeriodo({ parque: [tx], homologacion, catalogo, meses: tramo, resumenes, filasPorMes: {} })[0];
    assert.equal(serie[k].acumulado.pct, p.pct, 'hasta ' + MESES[k]);
    assert.equal(serie[k].acumulado.desde, '2026-01'); assert.equal(serie[k].acumulado.nMeses, k + 1);
  }
  const todas = [...horas['2026-01'], ...horas['2026-02'], ...horas['2026-04']];
  assert.equal(serie[3].acumulado.pct, (100 * red(estadisticas(Float32Array.from(todas)).p99)) / 800);
  assert.equal(serie[0].acumulado.pct, serie[0].mensual.pct, 'el primer mes acumulado es el mismo mes');
});

test('el promedio simple de las cifras mensuales es otra cosa (solo referencia) y queda por debajo con carga creciente', () => {
  const s = serie[3];
  const meses = [serie[0], serie[1], serie[3]].map((x) => x.mensual.pct);
  assert.equal(s.promedio.nMeses, 3);
  assert.ok(Math.abs(s.promedio.pct - meses.reduce((a, b) => a + b, 0) / 3) < 1e-9);
  assert.ok(s.promedio.pct < s.acumulado.pct);
});

test('tope de 12 meses en el acumulado, como «Varios meses»', () => {
  const muchos = Array.from({ length: 14 }, (_, k) => '2025-' + String(k + 1).padStart(2, '0')).map((m, k) => (k < 12 ? m : '2026-0' + (k - 11)));
  const res = Object.fromEntries(muchos.map((m) => [m, { mes: m, claves: { [cid]: { N13_8: nivel(horas['2026-01']) } } }]));
  const cat = { meses: Object.fromEntries(muchos.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: muchos } } };
  const s = serieMensualEquipo({ tx, homologacion, catalogo: cat, punto: cat.puntos[cid], resumenes: res });
  assert.equal(s[13].acumulado.nMeses, 12); assert.equal(s[13].acumulado.desde, muchos[2]);
});

test('un mes que no se pudo LEER deja sin cifra todo acumulado que lo contenga (como «Varios meses»), nunca firme', () => {
  const s = serieMensualEquipo({ tx, homologacion, catalogo, punto, resumenes: { ...resumenes, '2026-02': null } });
  assert.equal(s[1].leido, false); assert.equal(s[1].mensual.pct, null); assert.equal(s[1].acumulado.pct, null);
  assert.equal(s[0].acumulado.pct, s[0].mensual.pct, 'enero, antes del fallo, sí tiene su acumulado');
  for (const k of [2, 3]) {
    assert.equal(s[k].acumulado.pct, null); assert.equal(s[k].acumulado.firme, false);
    assert.match(s[k].acumulado.motivoNulo, /no se pudo leer 2026-02/); assert.equal(s[k].promedio.pct, null);
  }
  assert.equal(s[3].mensual.pct != null, true, 'el mes en sí sigue con su cifra');
});

test('un resumen que no existe (vacío) cuenta como mes sin datos del exporte, como en la lista', () => {
  const s = serieMensualEquipo({ tx, homologacion, catalogo, punto, resumenes: { ...resumenes, '2026-02': { mes: '2026-02', claves: {} } } });
  const lista = filasLista({ parque: [tx], homologacion, catalogo, resumenMes: { mes: '2026-02', claves: {} } })[0];
  assert.equal(s[1].leido, true); assert.equal(s[1].mensual.motivoNulo, lista.motivoNulo);
  const p = filasPeriodo({ parque: [tx], homologacion, catalogo, meses: MESES, resumenes: { ...resumenes, '2026-02': { mes: '2026-02', claves: {} } }, filasPorMes: {} })[0];
  assert.equal(s[3].acumulado.pct, p.pct); assert.equal(s[3].acumulado.firme, !!p.firme);
});

test('L-102: archivo nuevo que solo importa funciones ya publicadas', () => {
  const src = readFileSync(new URL('../assets/js/domain/scada_carga_mensual.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ filasLista \} from '\.\/scada_carga_vista\.js'/);
  assert.match(src, /import \{ filasPeriodo, MAX_MESES_PERIODO \} from '\.\/scada_carga_periodo\.js'/);
});

test('un mes que el parque no cargó sale como hueco con su motivo (no se esconde)', () => {
  const sinMarzo = { ...catalogo, meses: { '2026-01': { completo: true }, '2026-02': { completo: true }, '2026-04': { completo: true } } };
  const s = serieMensualEquipo({ tx, homologacion, catalogo: sinMarzo, punto, resumenes });
  assert.deepEqual(s.map((x) => x.mes), MESES);
  assert.equal(s[2].cargado, false); assert.match(s[2].mensual.motivoNulo, /no está cargado/);
  assert.equal(s[3].acumulado.nMeses, 3, 'el acumulado de abril usa enero, febrero y abril');
});

test('el tope de 12 cuenta meses de CALENDARIO: un hueco dentro del rango no alarga el tramo', () => {
  const cal = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'];
  const cargados = cal.filter((m) => m !== '2025-06');
  const res = Object.fromEntries(cargados.map((m) => [m, { mes: m, claves: { [cid]: { N13_8: nivel(horas['2026-01']) } } }]));
  const cat = { meses: Object.fromEntries(cargados.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: cargados } } };
  const s = serieMensualEquipo({ tx, homologacion, catalogo: cat, punto: cat.puntos[cid], resumenes: res });
  const ene26 = s.find((x) => x.mes === '2026-01');
  assert.equal(ene26.acumulado.desde, '2025-02'); assert.equal(ene26.acumulado.nMeses, 11);
});

test('cada devanado con sus límites: los de devanadosDe sobre la MISMA fila del mes y del acumulado', () => {
  for (const k of [0, 1, 3]) {
    const m = MESES[k];
    const x = filasLista({ parque: [tx], homologacion, catalogo, resumenMes: resumenes[m] })[0];
    assert.deepEqual(serie[k].mensual.devanados, devanadosDe(tx, x));
    const p = k === 0 ? x : filasPeriodo({ parque: [tx], homologacion, catalogo, meses: MESES.slice(0, k + 1), resumenes, filasPorMes: {} })[0];
    assert.deepEqual(serie[k].acumulado.devanados, devanadosDe(tx, p));
  }
  const sec = serie[3].acumulado.devanados.find((d) => d.d === 'S');
  assert.equal(sec.A, 800); assert.equal(sec.kv, 13.8); assert.ok(Math.abs(sec.mva - Math.sqrt(3) * 13.8 * 800 / 1000) < 1e-9);
  assert.ok(Math.abs(sec.iP99 - sec.pct * 800 / 100) < 1e-9);
  const pri = serie[3].acumulado.devanados.find((d) => d.d === 'P');
  assert.equal(pri.pct, null, 'el primario no se mide: sin carga, con sus límites');
  assert.equal(pri.A, 300);
  // Un mes sin datos: devanados con sus límites y sin carga.
  assert.ok(serie[2].mensual.devanados.every((d) => d.pct == null && d.A > 0));
});

test('L-102 y compilación: el bloque por devanado es un archivo nuevo cargado con import() desde «mes a mes»', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const f of ['ui/cargabilidad-scada/panel-mensual.js', 'ui/cargabilidad-scada/panel-devanados-mes.js']) {
    const src = readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' });
    assert.equal(r.status, 0, f + ': ' + r.stderr);
  }
  const mensual = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-mensual.js', import.meta.url), 'utf8');
  assert.match(mensual, /import\('\.\/panel-devanados-mes\.js'\)/);
  assert.doesNotMatch(mensual, /^import .*panel-devanados-mes/m);
});

test('bloque por devanado: lógica en el dominio (probada aparte), textos con el límite real de la placa, MVA equivalentes', () => {
  const src = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-devanados-mes.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ limitesDePlaca \} from '\.\.\/\.\.\/domain\/placa_etapas\.js'/);
  assert.match(src, /import \{ umbralesDevanado, motivoSinCifra, estadoDevanados, pctDe \} from '\.\.\/\.\.\/domain\/scada_devanados_mes\.js'/);
  assert.match(src, /import \{ leerPlaca \} from '\.\.\/\.\.\/data\/placas_caracteristicas\.js'/);
  // Ningún «% de ONAF» fijo: el nombre del límite sale de la placa (ONAN si solo trae una etapa) — `tests/scada_devanados_mes.test.js`.
  assert.doesNotMatch(src, /' % de ONAF'|'% de ONAF|\? 'ONAF' :/);
  assert.match(src, /' % de ' \+ u\.tope/);
  assert.match(src, /const MVA_EQ = 'MVA equivalentes'/);
  assert.match(src, /fixedrange: true/);
  assert.match(src, /no es la ' \+ u\.tope \+ ' de la placa/);
  assert.match(src, /if \(difA\) return el\('span', \{ class: 'chip chip--provisional' \}, 'Con la ampacidad de la plataforma: '/, 'ampacidad ≠ placa: chip neutro con la cifra de la plataforma');
  assert.match(src, /const dudosa = AVISO_PLACA\.has\(base\.aviso\) \|\| u\.difA;/);
  assert.match(src, /insidetextfont: \{ color: d === 'S' \? '#1d2b44' : '#ffffff' \}/, 'texto legible sobre el ámbar');
  assert.match(src, /bgcolor: 'rgba\(255,255,255,0\.85\)'/, 'rótulos de los umbrales con fondo');
  assert.match(src, /const ORIGEN_A = \{ impresa: 'impresa en la placa', calculada: 'calculada de la placa', plataforma: 'de la plataforma' \}/, 'cada corriente límite dice de dónde sale');
  assert.match(src, /PLANO de placa del fabricante/); assert.match(src, /marcado «futuro»/);
  assert.match(src, /'ninguno \(terciario de compensación\)'/);
  const men = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-mensual.js', import.meta.url), 'utf8');
  assert.match(men, /pintarDevanadosMes\(devNodo, \{ serie, mat: a\.mat, tx: a\.tx,/);
});

test('importaciones: cada nombre importado por los módulos de «mes a mes» existe en el módulo que lo exporta', () => {
  const base = new URL('../assets/js/', import.meta.url);
  const archivos = ['ui/cargabilidad-scada/panel-mensual.js', 'ui/cargabilidad-scada/panel-devanados-mes.js',
    'domain/scada_carga_mensual.js', 'domain/placa_etapas.js', 'domain/scada_devanados_mes.js',
    'ui/cargabilidad-scada/detalle.js', 'ui/cargabilidad-scada/panel-placa.js', 'domain/scada_devanados_placa.js',
    'domain/scada_umbrales_detalle.js'];
  for (const f of archivos) {
    const src = readFileSync(new URL(f, base), 'utf8');
    for (const m of src.matchAll(/^import \{([^}]+)\} from '(\.[^']+)';/gm)) {
      const destino = readFileSync(new URL(m[2], new URL(f, base)), 'utf8');
      for (const nombre of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        const exporta = new RegExp('export (?:async )?(?:function\\*?|const|let|class) ' + nombre + '\\b').test(destino)
          || new RegExp('export \\{[^}]*\\b' + nombre + '\\b').test(destino);
        assert.ok(exporta, f + ' importa «' + nombre + '» de ' + m[2] + ', que no lo exporta');
      }
    }
  }
});
