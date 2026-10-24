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
      assert.deepEqual(r.alias, { renombradas: 2, descartadas: 0 });
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
