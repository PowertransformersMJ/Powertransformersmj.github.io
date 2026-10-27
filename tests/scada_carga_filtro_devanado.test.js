// Cargabilidad SCADA — filtro «Devanado sobrecargado» (2026-10-27), con datos SINTÉTICOS («EstDemo»).
// Pedido del Ingeniero: «sí, agrega el filtro por devanado». Lo que se exige: entra el equipo cuya sobrecarga sostenida
// (o la de antes de un cambio de medida) está en un devanado elegido; sin elegir, nada cambia; sin sobrecarga no entra.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasLista, filtrarFilas } from '../assets/js/domain/scada_carga_vista.js';
import { devanadosSobrecargados, pasaFiltroDevanado, conteoPorDevanado, DEVANADOS_FILTRO } from '../assets/js/domain/scada_carga_filtro_devanado.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';

const tx = (id, mat, est) => ({ id, identificacion: { matricula: mat }, ubicacion: { subestacion_nombre: est, zona: 'BOLIVAR' }, placa: { potencia_kva: 20000 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837 } });
const parque = [tx('a', 'T1-X/X-DM1', 'DEMO UNO'), tx('b', 'T1-X/X-DM2', 'DEMO DOS'), tx('c', 'T1-X/X-DM3', 'DEMO TRES')];
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO DOS', 'T1-X/X-DM2', '/EstDemo2/swTrafo1'], ['DEMO TRES', 'T1-X/X-DM3', '/EstDemo3/swTrafo1']];
const homologacion = { filas: fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas };
const r = (p99, max, sost) => ({ i: { n: 700, p50: p99 * 0.7, p95: p99 * 0.95, p99, max, unaFalta: 0 }, sost: { v: sost }, cob: 0.95, rUI: 1 });
const c1 = claveId('EstDemo1', 'swTrafo1'); const c2 = claveId('EstDemo2', 'swTrafo1'); const c3 = claveId('EstDemo3', 'swTrafo1');
const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [c1]: { niveles: { N34_5: {}, N13_8: {} } }, [c2]: { niveles: { N34_5: {}, N13_8: {} } }, [c3]: { niveles: { N13_8: {} } } } };
// a: primario sobrecargado · b: secundario sobrecargado · c: sin sobrecarga.
const claves = {
  [c1]: { N34_5: r(1.02 * 335, 1.2 * 335, 1.08 * 335), N13_8: r(0.9 * 837, 0.95 * 837, 0.92 * 837) },
  [c2]: { N34_5: r(0.9 * 335, 0.95 * 335, 0.92 * 335), N13_8: r(1.0 * 837, 1.2 * 837, 1.06 * 837) },
  [c3]: { N13_8: r(0.8 * 837, 0.85 * 837, 0.82 * 837) }
};
const filas = filasLista({ parque, homologacion, catalogo, resumenMes: { mes: '2026-03', claves } });
const mats = (xs) => xs.map((x) => x.matricula).sort();

describe('filtro «Devanado sobrecargado»', () => {
  test('cada fila dice sus devanados con sobrecarga; sin sobrecarga, ninguno', () => {
    assert.deepEqual(filas.map(devanadosSobrecargados), [['P'], ['S'], []]);
    assert.deepEqual(conteoPorDevanado(filas), { P: 1, S: 1, T: 0 });
    assert.deepEqual(DEVANADOS_FILTRO.map(([d]) => d), ['P', 'S', 'T']);
  });
  test('elegir devanados filtra; sin elegir no cambia nada; se combina con los demás filtros', () => {
    assert.deepEqual(mats(filtrarFilas(filas, { devSobre: ['P'] })), ['T1-X/X-DM1']);
    assert.deepEqual(mats(filtrarFilas(filas, { devSobre: ['S'] })), ['T1-X/X-DM2']);
    assert.deepEqual(mats(filtrarFilas(filas, { devSobre: ['P', 'S'] })), ['T1-X/X-DM1', 'T1-X/X-DM2']);
    assert.deepEqual(filtrarFilas(filas, { devSobre: ['T'] }), []);
    assert.equal(filtrarFilas(filas, { devSobre: [] }).length, 3);
    assert.equal(filtrarFilas(filas, {}).length, 3);
    assert.deepEqual(mats(filtrarFilas(filas, { devSobre: ['S'], texto: 'DM1' })), []);
  });
  test('la sobrecarga de ANTES de un cambio de medida también cuenta; una fila sin el campo (caché vieja) no entra', () => {
    const conAnterior = { matricula: 'X', sobrecarga: null, sobrecargaAnterior: { tipo: 'firme', devanados: [{ devanado: 'T' }] } };
    assert.deepEqual(devanadosSobrecargados(conAnterior), ['T']);
    assert.equal(pasaFiltroDevanado(conAnterior, ['T']), true);
    assert.equal(pasaFiltroDevanado({ matricula: 'vieja', sobrecargaSostenida: true }, ['P']), false);
    assert.equal(pasaFiltroDevanado({ matricula: 'vieja', sobrecargaSostenida: true }, []), true);
  });
  test('la lista: filtro con su rótulo y sus conteos, «Todos» y «Quitar filtros» lo limpia', () => {
    const l = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
    assert.match(l, /el\('span', \{ id: 'csDevSobre-rotulo' \}, 'Devanado sobrecargado'\), multi\('csDevSobre', f\.devSobre \|\| \[\],/);
    assert.match(l, /DEVANADOS_FILTRO\.map\(\(\[d, n\]\) => \[d, n \+ ' \(' \+ conteoDev\[d\] \+ '\)'\]\), \(v\) => \{ f\.devSobre = v; \}, 'Todos',/);
    // Revisión adversarial: el devanado se filtra también desde el archivo nuevo (un vista.js viejo en caché no lo conoce),
    // resumen en masculino («Los tres», «… elegidos») y el rótulo visible nombra al grupo para un lector de pantalla.
    assert.match(l, /filtrarFilas\(st\.filas \|\| \[\], st\.filtro\)\.filter\(\(x\) => pasaFiltroDevanado\(x, st\.filtro\.devSobre\)\)/);
    assert.match(l, /todasMarcadas: 'Los tres', elegidas: ' elegidos', rotuloId: 'csDevSobre-rotulo'/);
    assert.equal((l.match(/soloSostenida: false, devSobre: \[\] \}/g) || []).length, 2, 'estado inicial y «Quitar filtros»');
    const v = readFileSync(new URL('../assets/js/domain/scada_carga_vista.js', import.meta.url), 'utf8');
    assert.match(v, /if \(!pasaFiltroDevanado\(x, f\.devSobre\)\) return false;/);
  });
});
