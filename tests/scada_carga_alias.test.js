// Cargabilidad SCADA — alias de elemento: un nivel del transformador que el SCADA exporta
// con una errata en el nombre del elemento se suma al MISMO punto homologado. Datos SINTÉTICOS («EstDemo»).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { aplicarAliasElemento, validarAlias } from '../assets/js/domain/scada_carga_alias.js';
import { filtrarTexto, leerContenedor } from '../assets/js/domain/scada_carga_paquete.js';
import { crearAcumulador, acumularArchivo } from '../assets/js/domain/scada_carga_importacion.js';
import { objetivoImportacion, fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { empaquetar, leerAlias } from '../scripts/scada-empaquetar.mjs';

const MV = 'Mv' + 'Moment';
const cab = (d) => ',' + Array.from({ length: 24 }, (_, h) => d + '/09/26 ' + h + ':00').join(',');
const fila = (est, nivel, elem, tok, v) => '/' + est.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + Array(24).fill(v).join(',');
const ALIAS = [{ est: 'EstDemo1', de: 'swTafoX1', a: 'swTrafo1' }];
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO DOS', 'T1-X/X-DM2', '/EstDemo2/swTrafo1']];
const FILAS = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const OBJ = objetivoImportacion(FILAS);

/** Un archivo de corriente: el transformador en 110 y 34,5 kV con su nombre y el 13,8 kV con la errata; más otra estación. */
function archivo(d, extra = []) {
  return [cab(d),
    fila('EstDemo1', '110kV', 'swTrafo1', 'I R', 200),
    fila('EstDemo1', '34.5kV', 'swTrafo1', 'I R', 400),
    fila('EstDemo1', '13.8kV', 'swTafoX1', 'I R', 700),
    fila('EstDemo1', '13.8kV', 'EDM302', 'I R', 50),
    fila('EstDemo2', '13.8kV', 'swTafoX1', 'I R', 9), ...extra].join('\r\n');
}

describe('alias de elemento', () => {
  test('la fila con errata se escribe con el elemento homologado; lo demás sale igual', () => {
    const r = aplicarAliasElemento(archivo(1), ALIAS);
    assert.deepEqual([r.renombradas, r.descartadas], [1, 0]);
    const l = r.texto.split('\n');
    assert.ok(l.some((x) => /^\/EstDemo1 *\/13\.8kV *\/swTrafo1 *\/I R/.test(x) && x.includes(',700,')));
    assert.ok(l.some((x) => /^\/EstDemo2 *\/13\.8kV *\/swTafoX1/.test(x)), 'otra estación con el mismo nombre no se toca');
    assert.ok(l.slice(1, -1).every((x) => x.endsWith('\r')), 'se conserva el fin de línea');
    assert.equal(l.length, archivo(1).split('\n').length);
  });
  test('gana la fila real: si el archivo ya trae el homologado con ese nivel y variable, la del alias se descarta', () => {
    const r = aplicarAliasElemento(archivo(1, [fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', 701)]), ALIAS);
    assert.deepEqual([r.renombradas, r.descartadas], [0, 1]);
    assert.doesNotMatch(r.texto, /EstDemo1 *\/13\.8kV *\/swTafoX1/);
    assert.equal(r.texto.split('\n').filter((x) => /^\/EstDemo1 *\/13\.8kV *\/swTrafo1/.test(x)).length, 1);
  });
  test('la fila real que llega con horas vacías se completa con el alias, aunque venga DESPUÉS en el archivo', () => {
    const v = (a, b) => Array.from({ length: 24 }, (_, h) => (h < 12 ? a : b));
    const filaV = (elem, vals) => '/' + 'EstDemo1'.padEnd(8) + '/' + '13.8kV'.padEnd(8) + '/' + elem.padEnd(8) + '/' + 'I R'.padEnd(8) + '/' + MV + ',' + vals.join(',');
    const t = [cab(1), filaV('swTafoX1', v(700, 'null')), filaV('swTrafo1', v('null', 701))].join('\r\n');
    const r = aplicarAliasElemento(t, ALIAS);
    assert.deepEqual([r.renombradas, r.descartadas, r.horasRellenadas], [0, 1, 12]);
    const l = r.texto.split('\n').filter((x) => /EstDemo1 *\/13\.8kV/.test(x));
    assert.equal(l.length, 1, 'una sola fila para la medida');
    assert.match(l[0], /^\/EstDemo1 *\/13\.8kV *\/swTrafo1 *\//);
    const celdas = l[0].slice(l[0].indexOf(',') + 1).split(',');
    assert.deepEqual(celdas.map(Number), v(700, 701));
  });
  test('en las horas con valor gana la real; dos alias hacia la misma medida no la duplican', () => {
    const filaV = (elem, x) => fila('EstDemo1', '13.8kV', elem, 'I R', x);
    const r1 = aplicarAliasElemento([cab(1), filaV('swTafoX1', 700), filaV('swTrafo1', 701)].join('\r\n'), ALIAS);
    assert.deepEqual([r1.renombradas, r1.descartadas, r1.horasRellenadas], [0, 1, 0]);
    assert.ok(r1.texto.includes(',701,') && !r1.texto.includes(',700,'));
    const dos = [...ALIAS, { est: 'EstDemo1', de: 'swTrfooX1', a: 'swTrafo1' }];
    const r2 = aplicarAliasElemento([cab(1), filaV('swTafoX1', 700), filaV('swTrfooX1', 650)].join('\r\n'), dos);
    assert.deepEqual([r2.renombradas, r2.descartadas], [1, 1]);
    assert.equal(r2.texto.split('\n').filter((x) => /EstDemo1 *\/13\.8kV *\/swTrafo1/.test(x)).length, 1);
    assert.ok(r2.texto.includes(',700,') && !r2.texto.includes(',650,'), 'gana la primera');
  });
  test('archivo de calidad: la bandera real se conserva y solo se llenan las celdas vacías', () => {
    const filaQ = (elem, a, b) => '/' + 'EstDemo1'.padEnd(8) + '/' + '13.8kV'.padEnd(8) + '/' + elem.padEnd(8) + '/' + 'I R'.padEnd(8) + '/' + MV + ',' + Array.from({ length: 24 }, (_, h) => (h < 12 ? a : b)).join(',');
    const r = aplicarAliasElemento([cab(1), filaQ('swTrafo1', 'Actual', ''), filaQ('swTafoX1', 'Invalid', 'Actual')].join('\r\n'), ALIAS);
    const l = r.texto.split('\n').find((x) => /swTrafo1/.test(x));
    assert.ok(l.endsWith('\r'), 'conserva el fin de línea');
    assert.deepEqual(l.slice(l.indexOf(',') + 1).replace(/\r$/, '').split(','), Array(24).fill('Actual'));
    assert.equal(r.horasRellenadas, 12);
  });
  test('la página vuelve a validar los alias del manifiesto contra la homologación vigente (con decisiones)', () => {
    const src = readFileSync(new URL('../assets/js/ui/scada-datos/importar-mes.js', import.meta.url), 'utf8');
    assert.match(src, /import \{ validarAlias \} from '\.\.\/\.\.\/domain\/scada_carga_alias\.js'/);
    assert.match(src, /if \(Array\.isArray\(manifiesto\.alias\) && manifiesto\.alias\.length\) validarAlias\(manifiesto\.alias, filasHomologacion\(\)\)/);
    const conDecision = { ...FILAS };
    const id = Object.keys(conDecision).find((k) => conDecision[k].matricula === 'T1-X/X-DM1');
    conDecision[id] = { ...conDecision[id], decision: { tipo: 'usar', clave: '/EstDemo1/swTafoX1', mapa: { N13_8: 'S' } } };
    assert.throws(() => validarAlias(ALIAS, conDecision), /escondería|no es un punto homologado/);
  });
  test('sin alias el texto sale idéntico', () => {
    assert.equal(aplicarAliasElemento(archivo(1), []).texto, archivo(1));
  });
  test('el lector ve UN punto con los tres niveles; el elemento con errata no crea punto', () => {
    const acc = crearAcumulador();
    const set = new Set(OBJ.estaciones);
    for (const d of [1, 2]) {
      const texto = filtrarTexto(aplicarAliasElemento(archivo(d), ALIAS).texto, set);
      acumularArchivo(acc, { nombre: `ir_average-2026090${d}.csv`, ruta: `Septiembre/0${d}Septiembre/ir_average-2026090${d}.csv`, texto, tamano: texto.length }, OBJ);
    }
    const cid = claveId('EstDemo1', 'swTrafo1');
    assert.deepEqual(Object.keys(acc.puntos.get(cid).niveles).sort(), ['N110', 'N13_8', 'N34_5']);
    assert.equal(acc.dias.get(cid + '|N13_8|IR|2026-09-01').v[0], 700);
    assert.equal([...acc.puntos.keys()].some((k) => /swtafox1/.test(k)), false);
    assert.equal(acc.conflictos, 0);
  });
  test('validarAlias frena lo que no tendría efecto o escondería un punto', () => {
    assert.deepEqual(validarAlias(ALIAS, FILAS), ALIAS);
    assert.throws(() => validarAlias([{ est: 'EstOtra', de: 'a1', a: 'swTrafo1' }], FILAS), /no es una estación/);
    assert.throws(() => validarAlias([{ est: 'EstDemo1', de: 'swTafoX1', a: 'swTrafo9' }], FILAS), /no es un punto homologado/);
    assert.throws(() => validarAlias([{ est: 'EstDemo1', de: 'swTrafo1', a: 'swTrafo1' }], FILAS), /distintos/);
    const dos = fusionarHomologacion(leerFilasHomologacion([...aoa, ['DEMO UNO', 'T2-X/X-DM1', '/EstDemo1/swTrafo2']]).filas, null).filas;
    assert.throws(() => validarAlias([{ est: 'EstDemo1', de: 'swTrafo2', a: 'swTrafo1' }], dos), /escondería/);
    assert.throws(() => validarAlias([...ALIAS, ...ALIAS], FILAS), /dos alias/);
  });
  test('--alias: se lee «ESTACION/ELEMENTO=HOMOLOGADO» y se rechaza lo mal escrito', () => {
    assert.deepEqual(leerAlias(' EstDemo1/swTafoX1=swTrafo1 '), ALIAS);
    assert.deepEqual(leerAlias(''), []);
    assert.throws(() => leerAlias('EstDemo1=swTrafo1'), /ESTACION\/ELEMENTO=HOMOLOGADO/);
  });
  test('el empaquetador lo aplica, lo cuenta y lo anota en el manifiesto (sin alias, el manifiesto queda como antes)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scada-alias-'));
    try {
      const raiz = join(dir, 'Septiembre');
      for (const d of [1, 2]) { mkdirSync(join(raiz, '0' + d + 'Septiembre'), { recursive: true }); writeFileSync(join(raiz, '0' + d + 'Septiembre', `ir_average-2026090${d}.csv`), archivo(d)); }
      const r = empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones, alias: ALIAS, creado: '2026-10-24T00:00:00Z' });
      assert.deepEqual(r.alias, { renombradas: 2, descartadas: 0, horasRellenadas: 0 });
      const { manifiesto, archivos } = leerContenedor(new Uint8Array(gunzipSync(Buffer.concat(r.partes.map((p) => Buffer.from(p.bytes))))));
      assert.deepEqual(manifiesto.alias, ALIAS);
      assert.doesNotMatch(new TextDecoder().decode(archivos[0].contenido), /EstDemo1 *\/13\.8kV *\/swTafoX1/);
      const sin = empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones, creado: '2026-10-24T00:00:00Z' });
      assert.equal('alias' in leerContenedor(new Uint8Array(gunzipSync(Buffer.concat(sin.partes.map((p) => Buffer.from(p.bytes)))))).manifiesto, false);
      assert.throws(() => empaquetar({ carpeta: raiz, estaciones: OBJ.estaciones, alias: [{ est: 'EstOtra', de: 'x', a: 'y' }] }), /no es una estación/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('L-102: archivo nuevo que solo importa exportaciones ya publicadas', () => {
    const src = readFileSync(new URL('../assets/js/domain/scada_carga_alias.js', import.meta.url), 'utf8');
    assert.match(src, /import \{ normalizarTexto, nivelDe \} from '\.\/scada_carga_csv\.js'/);
    assert.match(src, /import \{ analizarClaveHomologada, claveEfectiva \} from '\.\/scada_carga_homologacion\.js'/);
    assert.equal((src.match(/^import /gm) || []).length, 2);
  });
});
