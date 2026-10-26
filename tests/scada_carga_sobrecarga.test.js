// Cargabilidad SCADA — sobrecarga sostenida POR DEVANADO (2026-10-26), con datos SINTÉTICOS («EstDemo»).
// Pedido del Ingeniero: «ubique los equipos sobrecargados, sea el devanado primario, secundario o terciario; hay equipos
// sobrecargados que no estás catalogando». Lo que se exige: (1) se nombra el devanado (y el que se sobrecarga puede no ser
// el que da la cifra); (2) cuentan y se filtran las firmes, las posibles (cifra provisional) y las de un circuito sin
// confirmar, cada una con su tipo; (3) las marcas de siempre NO cambian (misma compuerta de `calcularEquipo`, `99 §129`).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasLista, filtrarFilas } from '../assets/js/domain/scada_carga_vista.js';
import { aplicarVerificacion } from '../assets/js/domain/scada_carga_sostenida.js';
import {
  sobrecargaDeMes, sobrecargaDelPeriodo, tieneSobrecarga, conteoSobrecarga, textoDevanados, esCircuitoSinConfirmar,
  rotuloSobrecarga, csvSobrecarga, CSV_SOBRECARGA_CAB
} from '../assets/js/domain/scada_carga_sobrecarga.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';

const tx = {
  id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 20000 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837 },
};
const A_S = 837; const A_P = 335;
const homo = (punto) => ({ filas: fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', punto]]).filas, null).filas });
/** Resumen de un nivel en AMPERIOS: p99, máximo del mes y máximo sostenido 2 h (en bruto). */
const r = (p99, max, sost, cob = 0.95) => ({ i: { n: 700, p50: p99 * 0.7, p95: p99 * 0.95, p99, max, unaFalta: 0 }, sost: sost == null ? null : { v: sost }, cob, rUI: 1 });
const fila = (niveles, { punto = '/EstDemo1/swTrafo1', elem = 'swTrafo1', mes = '2026-03' } = {}) => {
  const cid = claveId('EstDemo1', elem);
  const catalogo = { meses: { [mes]: { completo: true } }, puntos: { [cid]: { niveles: Object.fromEntries(Object.keys(niveles).map((k) => [k, {}])) } } };
  return filasLista({ parque: [tx], homologacion: homo(punto), catalogo, resumenMes: { mes, claves: { [cid]: niveles } } })[0];
};
const circuito = (niveles) => fila(niveles, { punto: '/EstDemo1/CIR301', elem: 'CIR301' });

describe('qué devanado se sobrecarga (un mes)', () => {
  test('dos devanados sobre el 100 %: se nombran los dos, en orden primario → secundario, con su máximo sostenido', () => {
    const x = fila({ N34_5: r(1.02 * A_P, 1.2 * A_P, 1.10 * A_P), N13_8: r(1.0 * A_S, 1.15 * A_S, 1.05 * A_S) });
    assert.equal(x.sobrecargaSostenida, true);
    assert.equal(x.sobrecarga.tipo, 'firme');
    assert.deepEqual(x.sobrecarga.devanados.map((d) => [d.devanado, d.nivel, Math.round(d.pct)]), [['P', 'N34_5', 110], ['S', 'N13_8', 105]]);
    assert.equal(textoDevanados(x.sobrecarga), 'en el primario 34,5 kV (hasta 110,0 %) y el secundario 13,8 kV (hasta 105,0 %)');
  });
  test('la cifra la da un devanado y la sobrecarga es de OTRO: se nombra el que se sobrecarga (caso Panceguitas)', () => {
    // Primario con p99 más alto pero sin 2 h seguidas sobre el 100 %; el secundario sí las tiene.
    const x = fila({ N34_5: r(1.04 * A_P, 1.06 * A_P, 0.99 * A_P), N13_8: r(1.0 * A_S, 1.1 * A_S, 1.03 * A_S) });
    assert.equal(x.devMax, 'P');
    assert.deepEqual(x.sobrecarga.devanados.map((d) => d.devanado), ['S']);
  });
  test('cifra provisional: tipo «posible», entra al filtro y al conteo', () => {
    const x = fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.1 * A_S, 0.3) });
    assert.equal(x.clase, 'provisional');
    assert.equal(x.sobrecargaProvisional, true); assert.equal(x.sobrecargaSostenida, false);
    assert.equal(x.sobrecarga.tipo, 'posible');
    assert.equal(filtrarFilas([x], { soloSostenida: true }).length, 1, 'antes el filtro la dejaba fuera');
  });
  test('circuito sin confirmar: sin cifra, sin las marcas de siempre, pero con «circuito» y su devanado', () => {
    const x = circuito({ N13_8: r(1.0 * A_S, 1.4 * A_S, 1.38 * A_S) });
    assert.equal(x.pct, null);
    assert.equal(x.motivoNulo, 'se mide un circuito, no el transformador');
    assert.equal(esCircuitoSinConfirmar(x), true);
    assert.equal(x.sobrecargaSostenida, false); assert.equal(x.sobrecargaProvisional, false); assert.equal(x.picoAislado, false);
    assert.equal(x.sobrecarga.tipo, 'circuito');
    assert.deepEqual(x.sobrecarga.devanados.map((d) => [d.devanado, Math.round(d.pct)]), [['S', 138]]);
    assert.equal(filtrarFilas([x], { soloSostenida: true }).length, 1);
  });
  test('circuito sin confirmar bajo el 100 %, o con horas imposibles: nada', () => {
    assert.equal(circuito({ N13_8: r(0.8 * A_S, 0.95 * A_S, 0.9 * A_S) }).sobrecarga, null);
    assert.equal(circuito({ N13_8: r(1.0 * A_S, 11 * A_S, 9 * A_S) }).sobrecarga, null);
  });
  test('homologación excluida: ni marca ni «circuito»', () => {
    const cid = claveId('EstDemo1', 'swTrafo1');
    const h = homo('/EstDemo1/swTrafo1');
    const excl = { filas: Object.fromEntries(Object.entries(h.filas).map(([k, f]) => [k, { ...f, decision: { tipo: 'no_usar' } }])) };
    const catalogo = { meses: { '2026-03': { completo: true } }, puntos: { [cid]: { niveles: { N13_8: {} } } } };
    const [x] = filasLista({ parque: [tx], homologacion: excl, catalogo, resumenMes: { claves: { [cid]: { N13_8: r(1.1 * A_S, 1.3 * A_S, 1.2 * A_S) } } } });
    assert.equal(x.sobrecarga, null);
    assert.equal(tieneSobrecarga(x), false);
  });
  test('la curva del mes decide un nivel con horas imposibles: se nombra su devanado («confirmada con la curva»)', () => {
    const x0 = fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) });
    assert.equal(x0.sobrecarga, null);
    const x = aplicarVerificacion(x0, [{ horas: 3, max: 120, excluidas: 2 }]);
    assert.equal(x.sobrecargaSostenida, true);
    assert.equal(x.sobrecarga.tipo, 'firme');
    assert.deepEqual(x.sobrecarga.devanados.map((d) => [d.devanado, d.pct, d.curva]), [['S', null, true]]);
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (confirmada con la curva del mes)');
    // La curva dice que no: sin sobrecarga y sin devanado.
    assert.equal(aplicarVerificacion(x0, [{ horas: 0, max: 90, excluidas: 2 }]).sobrecarga, null);
  });
});

describe('no cambia ninguna marca de antes (misma compuerta)', () => {
  test('con cifra: hay «sobrecarga» ⇔ había sostenida firme o provisional, y siempre con devanado', () => {
    const vals = [0.9, 0.995, 1.0, 1.001, 1.05, 1.3];
    let vistos = 0;
    for (const sp of vals) for (const ss of vals) for (const cob of [0.95, 0.3]) {
      const x = fila({ N34_5: r(0.95 * A_P, 1.4 * A_P, sp * A_P, cob), N13_8: r(0.97 * A_S, 1.4 * A_S, ss * A_S, cob) });
      if (x.pct == null || x.sobrecargaPorVerificar.length) continue;
      vistos++;
      const antes = x.sobrecargaSostenida || x.sobrecargaProvisional;
      assert.equal(!!x.sobrecarga, antes, `sp=${sp} ss=${ss} cob=${cob}`);
      if (antes) assert.ok(x.sobrecarga.devanados.length > 0);
    }
    assert.ok(vistos > 40);
  });
});

describe('periodo y conteo', () => {
  test('por devanado y en cuántos meses (ordenado por meses); el tipo sale de la fila del periodo', () => {
    const m1 = fila({ N34_5: r(1.02 * A_P, 1.2 * A_P, 1.10 * A_P), N13_8: r(1.0 * A_S, 1.15 * A_S, 1.05 * A_S) });
    const m2 = fila({ N34_5: r(0.9 * A_P, 0.95 * A_P, 0.9 * A_P), N13_8: r(1.0 * A_S, 1.2 * A_S, 1.08 * A_S) });
    const m3 = fila({ N34_5: r(0.9 * A_P, 0.95 * A_P, 0.9 * A_P), N13_8: r(0.9 * A_S, 0.95 * A_S, 0.9 * A_S) });
    const s = sobrecargaDelPeriodo({ ...m1, sobrecargaSostenida: true }, [m1, m2, null, m3]);
    assert.equal(s.tipo, 'firme'); assert.equal(s.meses, 2);
    assert.deepEqual(s.devanados.map((d) => [d.devanado, d.meses, Math.round(d.pct)]), [['S', 2, 108], ['P', 1, 110]]);
    assert.equal(textoDevanados(s), 'secundario 13,8 kV en 2 meses (hasta 108,0 %) y primario 34,5 kV en 1 mes (hasta 110,0 %)');
    assert.equal(sobrecargaDelPeriodo({ ...m3 }, [m3]), null);
  });
  test('circuito sin confirmar en el periodo: «circuito» con sus meses', () => {
    const c1 = circuito({ N13_8: r(1.0 * A_S, 1.4 * A_S, 1.38 * A_S) });
    const c2 = circuito({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.08 * A_S) });
    const s = sobrecargaDelPeriodo({ ...c2 }, [c1, c2]);
    assert.equal(s.tipo, 'circuito'); assert.equal(s.devanados[0].meses, 2); assert.equal(Math.round(s.devanados[0].pct), 138);
  });
  test('conteo por tipo; una fila de un dominio viejo (sin `sobrecarga`) cuenta por sus marcas de siempre', () => {
    const firme = fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.1 * A_S) });
    const posible = fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.1 * A_S, 0.3) });
    const circ = circuito({ N13_8: r(1.0 * A_S, 1.4 * A_S, 1.38 * A_S) });
    const nada = fila({ N13_8: r(0.8 * A_S, 0.9 * A_S, 0.85 * A_S) });
    const vieja = { sobrecargaSostenida: true };
    assert.deepEqual(conteoSobrecarga([firme, posible, circ, nada, vieja]), { firme: 2, posible: 1, sin_cifra: 0, circuito: 1, total: 4 });
    assert.equal(filtrarFilas([firme, posible, circ, nada], { soloSostenida: true }).length, 3);
  });
});

// Revisión adversarial (2026-10-26): lo que encontró y su arreglo.
describe('revisión adversarial', () => {
  const m = (sost) => fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, sost * A_S) });
  test('periodo SIN cifra cuyos meses fueron FIRMES: «sin_cifra», no «posible (cifra provisional)»; dice la clase de sus meses', () => {
    const e = m(1.038); const f = m(1.03);
    assert.equal(e.sobrecarga.tipo, 'firme'); assert.equal(f.sobrecarga.tipo, 'firme');
    // Así queda la fila del periodo cuando a un mes le faltan sus horas más altas: sin cifra, clase nula, marca «provisional».
    const per = { ...e, pct: null, clase: 'nulo', motivoNulo: 'falta preparar 2026-02', sobrecargaSostenida: false, sobrecargaProvisional: true, periodo: { mesesSostenida: 2 } };
    per.sobrecarga = sobrecargaDelPeriodo(per, [e, f]);
    assert.equal(per.sobrecarga.tipo, 'sin_cifra');
    assert.deepEqual(per.sobrecarga.porClase, { firme: 2, posible: 0, circuito: 0 });
    const rt = rotuloSobrecarga(per);
    assert.equal(rt.severo, false);
    assert.doesNotMatch(rt.texto, /provisional/);
    assert.equal(rt.texto, 'Sobrecarga sostenida (≥ 2 h sobre el 100 %) en 2 meses (2 con cifra firme): secundario 13,8 kV en 2 meses (hasta 103,8 %)');
    assert.match(rt.nota, /El periodo no tiene cifra/);
    assert.deepEqual(conteoSobrecarga([per]), { firme: 0, posible: 0, sin_cifra: 1, circuito: 0, total: 1 });
    assert.deepEqual(csvSobrecarga(per), ['periodo sin cifra (meses con sobrecarga)', 'secundario 13,8 kV en 2 meses (hasta 103,8 %)']);
    // Una fila vieja (dominio en caché, sin `sobrecarga`) con la misma marca cae en el mismo tipo.
    assert.equal(rotuloSobrecarga({ ...per, sobrecarga: undefined }).tipo, 'sin_cifra');
  });
  test('periodo provisional con meses firmes: «posible» y lo dice', () => {
    const e = m(1.05);
    const per = { ...e, clase: 'provisional', sobrecargaSostenida: false, sobrecargaProvisional: true, periodo: { mesesSostenida: 1 } };
    per.sobrecarga = sobrecargaDelPeriodo(per, [e]);
    assert.equal(per.sobrecarga.tipo, 'posible');
    assert.equal(rotuloSobrecarga(per).texto, 'Posible sobrecarga sostenida (cifra provisional) en 1 mes (1 con cifra firme): secundario 13,8 kV en 1 mes (hasta 105,0 %)');
  });
  test('dos niveles en el MISMO devanado: el devanado cuenta una vez por mes (manda el de mayor máximo sostenido)', () => {
    const x = fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.05 * A_S) });
    const doble = { ...x, niveles: [...x.niveles, { ...x.niveles[0], nivel: 'N34_5', sostenidaPct: 108 }] };
    const s1 = sobrecargaDeMes(doble);
    assert.deepEqual(s1.devanados.map((d) => [d.devanado, d.nivel, d.pct]), [['S', 'N34_5', 108]]);
    const sp = sobrecargaDelPeriodo(doble, [doble]);
    assert.equal(sp.devanados[0].meses, 1);
  });
  test('la curva se dice también en el periodo (sola o junto a meses medidos)', () => {
    const x0 = fila({ N13_8: r(0.6 * A_S, 11 * A_S, 9.28 * A_S) });
    const c = aplicarVerificacion(x0, [{ horas: 3, max: 120, excluidas: 2 }]);
    const medido = m(1.06);
    const solo = sobrecargaDelPeriodo(c, [c]);
    assert.equal(textoDevanados(solo), 'secundario 13,8 kV en 1 mes (confirmada con la curva)');
    const mixto = sobrecargaDelPeriodo(medido, [c, medido]);
    assert.equal(textoDevanados(mixto), 'secundario 13,8 kV en 2 meses (hasta 106,0 %; 1 mes confirmado con la curva)');
  });
  test('rótulos de un mes: firme con color; posible y circuito neutros; CSV sin artículos', () => {
    const x = fila({ N34_5: r(1.02 * A_P, 1.2 * A_P, 1.10 * A_P), N13_8: r(1.0 * A_S, 1.15 * A_S, 1.05 * A_S) });
    const rf = rotuloSobrecarga(x);
    assert.equal(rf.severo, true);
    assert.equal(rf.texto, 'Sobrecarga sostenida (≥ 2 h sobre el 100 %) en el primario 34,5 kV (hasta 110,0 %) y el secundario 13,8 kV (hasta 105,0 %)');
    assert.deepEqual(csvSobrecarga(x), ['firme', 'primario 34,5 kV (hasta 110,0 %); secundario 13,8 kV (hasta 105,0 %)']);
    const rp = rotuloSobrecarga(fila({ N13_8: r(1.0 * A_S, 1.2 * A_S, 1.1 * A_S, 0.3) }));
    assert.equal(rp.severo, false); assert.match(rp.texto, /^Posible sobrecarga sostenida \(cifra provisional\) en el secundario/);
    const rc = rotuloSobrecarga(circuito({ N13_8: r(1.0 * A_S, 1.4 * A_S, 1.38 * A_S) }));
    assert.equal(rc.severo, false); assert.match(rc.nota, /única salida/);
    assert.equal(rotuloSobrecarga(fila({ N13_8: r(0.8 * A_S, 0.9 * A_S, 0.85 * A_S) })), null);
    assert.deepEqual(csvSobrecarga(fila({ N13_8: r(0.8 * A_S, 0.9 * A_S, 0.85 * A_S) })), ['', '']);
    assert.deepEqual(CSV_SOBRECARGA_CAB, ['Sobrecarga_sostenida_tipo', 'Sobrecarga_sostenida_devanados']);
  });
  test('la lista usa los rótulos del dominio (y nada de color en lo que no es firme)', () => {
    const l = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/lista.js', import.meta.url), 'utf8');
    assert.match(l, /el\('span', \{ class: r\.severo \? 'cs-sub cs-sostenida' : 'cs-sub' \}, r\.texto\)/);
    assert.match(l, /cs\.sin_cifra \? cs\.sin_cifra \+ ' sin cifra del periodo' : null/);
    assert.equal((l.match(/marcaSobrecarga\(td, x\)/g) || []).length, 3, 'la función y sus dos usos: con cifra y sin cifra');
    // `td.append(…, null)` escribe el texto «null» en la celda (lo vio la vista previa, 2026-10-26): nunca un null al append nativo.
    assert.doesNotMatch(l, /td\.append\([^;]*: null\)/);
  });
});
