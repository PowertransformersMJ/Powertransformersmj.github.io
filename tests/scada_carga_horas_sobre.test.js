// Cargabilidad SCADA — horas sobre el 100 %, máximo sin redondeo engañoso y orden por fuerza de la sobrecarga (2026-11-17),
// con datos SINTÉTICOS («EstDemo»). Lo vio el Ingeniero en vivo: con «Solo con sobrecarga sostenida» salían equipos con cifra
// bajo el 100 % (la cifra es el p99; la sostenida, 2 h seguidas sobre el 100 %). Aprobó («Sí, ajústalo») tres ajustes que
// NO cambian ninguna cifra, marca ni conteo. Lo que se exige, en las dos direcciones:
//   (1) con las horas más altas del mes (`top`) se dicen las horas sobre el 100 % («14 h en total…»; «90 h o más» si pasan
//       las 90); sin `top` usable (mes viejo, incompleto) no se dice nada y el texto es el de siempre;
//   (2) un máximo que pasa del 100 % por centésimas no se lee «100,0 %»: «100,04 %» (y 3 decimales si hace falta);
//   (3) con el filtro marcado y el orden de siempre, la lista va por fuerza (clase → máximo sostenido → horas → cifra →
//       matrícula); otra columna elegida manda; al desmarcar vuelve a la cifra; la nota explica el porqué.
// Revisión adversarial (2026-11-17), también en las dos direcciones: un mes con horas en servicio sin medir da «al menos»
// (y uno medido entero, la cuenta exacta); horas imposibles → sin horas; el desempate por horas es el del devanado que da la
// fuerza; desmarcar vuelve SIEMPRE a la cifra; la regla dice «2 h seguidas»; la historia usa el máximo sin redondeo engañoso.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  horasSobreDeNivel, nivelesConHoras, horasValidas, sumarHorasSobre, textoHorasSobre, pctSostenidaTxt,
  TEXTO_ORDEN_FUERZA, ordenConSostenida, fuerzaSobrecarga, horasSobrecarga, ordenarPorFuerza, notaSostenida
} from '../assets/js/domain/scada_carga_horas_sobre.js';
import { filasLista, filtrarFilas, ordenarFilas } from '../assets/js/domain/scada_carga_vista.js';
import { aplicarVerificacion } from '../assets/js/domain/scada_carga_sostenida.js';
import { sobrecargaDelPeriodo, textoDevanados, rotuloSobrecarga, csvSobrecarga, conteoSobrecarga } from '../assets/js/domain/scada_carga_sobrecarga.js';
import { sobrecargaAntesDelCambio } from '../assets/js/domain/scada_carga_cambio_medida.js';
import { dividirResumenNivel } from '../assets/js/domain/scada_carga_medida_comun.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';

// ── Datos sintéticos (EstDemo1) ────────────────────────────────────────────────
const tx = {
  id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 20000 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837 },
};
const A_S = 837; const A_P = 335;
const homo = (punto) => ({ filas: fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', punto]]).filas, null).filas });
const red = (x) => Math.round(x * 1000) / 1000;   // el importador guarda los amperios a 0,001 A
/** `top` de un mes como lo guarda el importador: las horas altas dadas (A) y, hasta completar 90, horas a `relleno` (A). */
const topCon = (altas, relleno, n = 700) => [...altas, ...Array(Math.max(0, 90 - altas.length)).fill(relleno)].sort((a, b) => b - a).slice(0, Math.min(90, n)).map(red);
/**
 * Resumen de un nivel en AMPERIOS con sus horas más altas. `pcts` = las horas altas del mes en % de la ampacidad `A`, de
 * mayor a menor; la cifra (p99, la 8.ª más alta con 700 h) y el máximo sostenido salen de ellas como en el importador.
 * `servicio` = horas en servicio del mes (por omisión, todas medidas: n); la cobertura es n ÷ servicio, como la guarda.
 */
function resumen(A, pcts, { relleno = 0.8, n = 700, servicio = n, sinTop = false, sost = null } = {}) {
  const altas = pcts.map((p) => (p / 100) * A);
  const top = topCon(altas, relleno * A, n);
  const k = n - (Math.ceil(0.99 * n) - 1);   // 1 = el máximo (rango más cercano, `estadisticas`)
  const p99 = top[k - 1];
  return { i: { n, p50: relleno * A * 0.9, p95: p99 * 0.97, p99, max: top[0], unaFalta: 0 }, sost: { v: red(sost != null ? (sost / 100) * A : top[1]) },
    horas: 744, servicio, cob: Math.round((n / servicio) * 1000) / 1000, rUI: 1, ...(sinTop ? {} : { top }) };
}
const fila = (niveles, { punto = '/EstDemo1/swTrafo1', elem = 'swTrafo1', mes = '2026-10' } = {}) => {
  const cid = claveId('EstDemo1', elem);
  const catalogo = { meses: { [mes]: { completo: true } }, puntos: { [cid]: { niveles: Object.fromEntries(Object.keys(niveles).map((k) => [k, {}])) } } };
  return filasLista({ parque: [tx], homologacion: homo(punto), catalogo, resumenMes: { mes, claves: { [cid]: niveles } } })[0];
};
// «Como MAM» (octubre): cifra 97,1 % y sostenida hasta 101,4 %; 5 horas del mes pasaron del 100 %.
const MAM = [101.4, 101.4, 100.8, 100.3, 100.1, 99.5, 98.4, 97.1, 96.0];

describe('(1) horas sobre el 100 %, contadas en las horas más altas del mes', () => {
  test('cuenta las que pasan del 100 % (seguidas o sueltas); la cifra y la marca no cambian', () => {
    const rS = resumen(A_S, MAM);
    assert.deepEqual(horasSobreDeNivel(rS, A_S), { horas: 5, cota: null });
    const x = fila({ N13_8: rS });
    assert.equal(Math.round(x.pct * 10) / 10, 97.1, 'la cifra (p99) queda bajo el 100 %');
    assert.equal(x.clase, 'firme'); assert.equal(x.sobrecargaSostenida, true); assert.equal(x.sobrecarga.tipo, 'firme');
    assert.deepEqual(x.sobrecarga.devanados[0].horasSobre, { horas: 5, cota: null });
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (5 h en total sobre el 100 %, hasta 101,4 %)');
    assert.equal(rotuloSobrecarga(x).texto, 'Sobrecarga sostenida (≥ 2 h seguidas sobre el 100 %) en el secundario 13,8 kV (5 h en total sobre el 100 %, hasta 101,4 %)');
    assert.deepEqual(csvSobrecarga(x), ['firme', 'secundario 13,8 kV (5 h en total sobre el 100 %, hasta 101,4 %)']);
    assert.equal(filtrarFilas([x], { soloSostenida: true }).length, 1);
  });
  test('SIN `top` (mes cargado antes de §159): ni una palabra de horas; el texto, la cifra y las marcas son los de siempre', () => {
    const con = fila({ N13_8: resumen(A_S, MAM) }); const sin = fila({ N13_8: resumen(A_S, MAM, { sinTop: true }) });
    assert.equal(sin.pct, con.pct); assert.equal(sin.clase, con.clase); assert.equal(sin.sobrecargaSostenida, con.sobrecargaSostenida);
    assert.deepEqual(conteoSobrecarga([sin]), conteoSobrecarga([con]));
    assert.equal(sin.niveles.some((n) => 'horasSobre' in n), false);
    assert.equal('horasSobre' in sin.sobrecarga.devanados[0], false);
    assert.equal(textoDevanados(sin.sobrecarga), 'en el secundario 13,8 kV (hasta 101,4 %)');
    assert.deepEqual(csvSobrecarga(sin), ['firme', 'secundario 13,8 kV (hasta 101,4 %)']);
  });
  test('las 90 guardadas pasan del 100 % → «90 h o más»; un mes con menos de 90 horas válidas da su cuenta exacta', () => {
    const r90 = resumen(A_S, Array(95).fill(112), { sost: 112 });
    assert.deepEqual(horasSobreDeNivel(r90, A_S), { horas: 90, cota: 'tope' });
    const x = fila({ N13_8: r90 });
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (90 h o más en total sobre el 100 %, hasta 112,0 %)');
    // 60 horas válidas en el mes (todas en `top`), 60 sobre el 100 %: se sabe exacto, sin «o más».
    assert.deepEqual(horasSobreDeNivel(resumen(A_S, Array(60).fill(105), { n: 60 }), A_S), { horas: 60, cota: null });
  });
  test('`top` incompleto, sin horas, sin ampacidad o de otra forma: null (nunca se inventa)', () => {
    const r0 = resumen(A_S, MAM);
    assert.equal(horasSobreDeNivel({ ...r0, top: r0.top.slice(0, 40) }, A_S), null, 'le faltan horas a `top`');
    assert.equal(horasSobreDeNivel({ ...r0, top: undefined }, A_S), null);
    assert.equal(horasSobreDeNivel({ ...r0, top: 'x' }, A_S), null);
    assert.equal(horasSobreDeNivel({ ...r0, i: { ...r0.i, n: 0 } }, A_S), null);
    assert.equal(horasSobreDeNivel(r0, 0), null); assert.equal(horasSobreDeNivel(r0, null), null);
    assert.equal(horasSobreDeNivel(null, A_S), null);
  });
  test('`top` en bytes de una versión vieja (Uint8Array o Bytes de Firestore) cuenta igual que la lista de números', () => {
    const r0 = resumen(A_S, MAM);
    const bytes = new Uint8Array(Float32Array.from(r0.top).buffer);
    assert.deepEqual(horasSobreDeNivel({ ...r0, top: bytes }, A_S), { horas: 5, cota: null });
    assert.deepEqual(horasSobreDeNivel({ ...r0, top: { toUint8Array: () => bytes } }, A_S), { horas: 5, cota: null });
  });
  test('medio paso de redondeo: una hora en el borde del 100 % no se da por buena → «al menos N h»', () => {
    const r0 = resumen(A_S, MAM);
    const borde = { ...r0, top: [...r0.top.slice(0, 5), red(A_S + 0.0004), ...r0.top.slice(5, 89)] };
    assert.deepEqual(horasSobreDeNivel(borde, A_S), { horas: 5, cota: 'borde' });
    assert.equal(textoHorasSobre({ horas: 5, cota: 'borde' }), 'al menos 5 h en total sobre el 100 %');
  });
  test('medida común: el `top` viene dividido como el p99 y la sostenida → las horas son las de la parte de este transformador', () => {
    const comun = resumen(2 * A_S, [104, 103, 102, 98], { relleno: 0.6 });   // los dos en paralelo, contra la placa de uno
    const parte = dividirResumenNivel(comun, 2);
    assert.deepEqual(horasSobreDeNivel(parte, A_S), { horas: 3, cota: null });
    assert.equal(horasSobreDeNivel(comun, A_S).horas, 90, 'sin dividir, todo pasaba: la parte es la que manda');
  });
  test('solo los niveles con alguna hora sobre el 100 % cambian; los demás quedan iguales (mismo objeto)', () => {
    const niveles = [{ nivel: 'N13_8', devanado: 'S', pct: 97, A: A_S }, { nivel: 'N34_5', devanado: 'P', pct: 60, A: A_P }, { nivel: 'N66', devanado: null, pct: null, A: null }];
    const res = { N13_8: resumen(A_S, MAM), N34_5: resumen(A_P, [70, 65]) };
    const out = nivelesConHoras(niveles, res);
    assert.deepEqual(out[0].horasSobre, { horas: 5, cota: null });
    assert.equal(out[1], niveles[1]); assert.equal(out[2], niveles[2]);
    assert.equal(nivelesConHoras(niveles, null), niveles);
  });
  test('la curva del mes decide un nivel con horas imposibles: sin horas (la curva no las da) y el texto de siempre', () => {
    const x0 = fila({ N13_8: { ...resumen(A_S, MAM), i: { ...resumen(A_S, MAM).i, max: 11 * A_S } } });
    assert.equal('horasSobre' in x0.niveles[0], false, 'horas imposibles: su `top` no se cuenta');
    const x = aplicarVerificacion(x0, [{ horas: 3, max: 120, excluidas: 2 }]);
    assert.equal(x.sobrecarga.devanados[0].curva, true);
    assert.equal('horasSobre' in x.sobrecarga.devanados[0], false);
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (confirmada con la curva del mes)');
  });
  test('guarda de las horas: un dato raro o menos de 2 h (contradice la regla) no se dice', () => {
    assert.equal(horasValidas(null), null); assert.equal(horasValidas({ horas: 'x' }), null); assert.equal(horasValidas({ horas: 1, cota: null }), null);
    assert.deepEqual(horasValidas({ horas: 2, cota: 'otra' }), { horas: 2, cota: null });
    assert.equal(textoHorasSobre(null), ''); assert.equal(textoHorasSobre({ horas: 0, cota: null }), '');
    assert.equal(textoHorasSobre({ horas: 1080, cota: null }), '1.080 h en total sobre el 100 %');
  });
  test('horas en servicio sin medir (huecos, mes en curso) → «al menos N h»; el mes medido entero → la cuenta exacta', () => {
    const parcial = resumen(A_S, MAM, { servicio: 744 });   // 700 medidas de 744 en servicio: 44 h que no se vieron
    assert.deepEqual(horasSobreDeNivel(parcial, A_S), { horas: 5, cota: 'parcial' });
    const x = fila({ N13_8: parcial }); const entero = fila({ N13_8: resumen(A_S, MAM) });
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (al menos 5 h en total sobre el 100 %, hasta 101,4 %)');
    assert.equal(textoDevanados(entero.sobrecarga), 'en el secundario 13,8 kV (5 h en total sobre el 100 %, hasta 101,4 %)');
    // La cifra, la clase, la marca y el conteo no dependen de eso.
    assert.equal(x.pct, entero.pct); assert.equal(x.clase, entero.clase); assert.equal(x.sobrecargaSostenida, entero.sobrecargaSostenida);
    assert.deepEqual(conteoSobrecarga([x]), conteoSobrecarga([entero]));
    // «90 h o más» ya dice que pueden ser más: no se cambia por «al menos».
    assert.deepEqual(horasSobreDeNivel(resumen(A_S, Array(95).fill(112), { sost: 112, servicio: 744 }), A_S), { horas: 90, cota: 'tope' });
    // Sin `servicio` (con `top` no debería faltar): la cobertura guardada; sin ninguna de las dos, no se da por completo.
    const sinServ = resumen(A_S, MAM); delete sinServ.servicio;
    assert.deepEqual(horasSobreDeNivel({ ...sinServ, cob: 1 }, A_S), { horas: 5, cota: null });
    assert.deepEqual(horasSobreDeNivel({ ...sinServ, cob: 0.94 }, A_S), { horas: 5, cota: 'parcial' });
    assert.deepEqual(horasSobreDeNivel({ ...sinServ, cob: null }, A_S), { horas: 5, cota: 'parcial' });
    assert.deepEqual(horasValidas({ horas: 5, cota: 'parcial' }), { horas: 5, cota: 'parcial' });
    assert.equal(textoHorasSobre({ horas: 5, cota: 'parcial' }), 'al menos 5 h en total sobre el 100 %');
    // Un nivel sin ninguna hora sobre el 100 % y con huecos queda igual que antes (el mismo objeto, nada pegado).
    const flojo = [{ nivel: 'N34_5', devanado: 'P', pct: 60, A: A_P }];
    assert.equal(nivelesConHoras(flojo, { N34_5: resumen(A_P, [70, 65], { servicio: 744 }) })[0], flojo[0]);
  });
  test('«como EDE»: cifra provisional por cobertura baja → sus horas son un mínimo («al menos»)', () => {
    const x = fila({ N13_8: resumen(A_S, [130, 130, 120, 110, 105, 101, 99, 97.9], { n: 220, servicio: 744 }) });
    assert.equal(x.clase, 'provisional'); assert.equal(x.sobrecarga.tipo, 'posible');
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (al menos 6 h en total sobre el 100 %, hasta 130,0 %)');
  });
  test('horas imposibles (> 3 × ampacidad) en el nivel: sin horas, con las mismas compuertas de calcularEquipo', () => {
    const r = { N13_8: resumen(A_S, MAM) };
    const tol = (100 * 0.0005) / A_S;
    const nv = (picoPct) => ({ nivel: 'N13_8', devanado: 'S', pct: 97, A: A_S, picoPct });
    const niveles = [nv(1100), nv(300 - tol / 2), nv(299.9), nv(101.4), nv(null)];
    const out = nivelesConHoras(niveles, r);
    assert.equal(out[0], niveles[0], 'imposibles: el mismo objeto, sin horas');
    assert.equal(out[1], niveles[1], 'en el borde del tope (medio paso de redondeo): tampoco se decide con el resumen');
    for (const i of [2, 3, 4]) assert.deepEqual(out[i].horasSobre, { horas: 5, cota: null }, 'pico ' + niveles[i].picoPct);
  });
});

describe('(1) varios meses: la suma por devanado de los meses con sostenida', () => {
  const mes = (pcts, o) => fila({ N13_8: resumen(A_S, pcts, o) });
  test('todos los meses con horas: la suma exacta; el máximo, el mayor de los meses', () => {
    const ms = [mes([106.2, 106.2, 104, 103, 101]), mes([104, 104, 102]), mes([90, 85])];
    const s = sobrecargaDelPeriodo({ ...ms[0], sobrecargaSostenida: true }, ms);
    assert.deepEqual(s.devanados[0].horasSobre, { horas: 8, cota: null });
    assert.equal(textoDevanados(s), 'secundario 13,8 kV en 2 meses (8 h en total sobre el 100 %; hasta 106,2 %)');
  });
  test('un mes sin `top` → «al menos»; un mes con las 90 → «o más»; ninguno con horas → el texto de siempre', () => {
    const a = mes([106.2, 106.2, 104, 103, 101]); const b = mes([104, 104, 102], { sinTop: true }); const c = mes(Array(95).fill(103), { sost: 103 });
    assert.equal(textoDevanados(sobrecargaDelPeriodo(a, [a, b])), 'secundario 13,8 kV en 2 meses (al menos 5 h en total sobre el 100 %; hasta 106,2 %)');
    assert.equal(textoDevanados(sobrecargaDelPeriodo(a, [a, c])), 'secundario 13,8 kV en 2 meses (95 h o más en total sobre el 100 %; hasta 106,2 %)');
    const b2 = mes([103, 103], { sinTop: true });
    assert.equal(textoDevanados(sobrecargaDelPeriodo(b, [b, b2])), 'secundario 13,8 kV en 2 meses (hasta 104,0 %)');
    assert.equal('horasSobre' in sobrecargaDelPeriodo(b, [b, b2]).devanados[0], false);
    assert.deepEqual(sumarHorasSobre([{ horas: 5, cota: null }, null]), { horas: 5, cota: 'falta' });
    assert.deepEqual(sumarHorasSobre([{ horas: 5, cota: 'borde' }, { horas: 3, cota: 'tope' }]), { horas: 8, cota: 'falta' });
    // Un mes con horas en servicio sin medir: la suma es un mínimo; con todos medidos enteros, exacta.
    const d = mes([104, 104, 102], { servicio: 744 });
    assert.equal(textoDevanados(sobrecargaDelPeriodo(a, [a, d])), 'secundario 13,8 kV en 2 meses (al menos 8 h en total sobre el 100 %; hasta 106,2 %)');
    assert.deepEqual(sumarHorasSobre([{ horas: 5, cota: null }, { horas: 3, cota: 'parcial' }]), { horas: 8, cota: 'falta' });
    assert.deepEqual(sumarHorasSobre([{ horas: 5, cota: null }, { horas: 3, cota: null }]), { horas: 8, cota: null });
    assert.equal(sumarHorasSobre([null, null]), null); assert.equal(sumarHorasSobre([]), null);
  });
  test('«Antes del cambio de medida» (como BEC): lleva las horas y el máximo sin redondeo engañoso', () => {
    const ms = [mes([100.04, 100.04, 100.02]), mes([103.5, 103.5, 101])];
    const a = sobrecargaAntesDelCambio(ms);
    assert.equal(a.tipo, 'firme');
    assert.equal(textoDevanados(a), 'secundario 13,8 kV en 2 meses (6 h en total sobre el 100 %; hasta 103,5 %)');
    const solo = sobrecargaAntesDelCambio([ms[0]]);
    assert.equal(textoDevanados(solo, { csv: true }), 'secundario 13,8 kV en 1 mes (3 h en total sobre el 100 %; hasta 100,04 %)');
  });
});

describe('(2) el máximo sostenido sin redondeo engañoso', () => {
  test('pasa del 100 % por centésimas: 2 decimales; por milésimas: 3; lo demás a 1 decimal', () => {
    assert.equal(pctSostenidaTxt(100.04), '100,04 %');
    assert.equal(pctSostenidaTxt(100.004), '100,004 %');
    assert.equal(pctSostenidaTxt(100.0004), '100,0004 %');
    assert.equal(pctSostenidaTxt(119.44), '119,4 %');
    assert.equal(pctSostenidaTxt(100.06), '100,1 %', 'a 1 decimal ya se ve que pasó');
    assert.equal(pctSostenidaTxt(100), '100,0 %'); assert.equal(pctSostenidaTxt(99.96), '100,0 %', 'no pasa: no se toca');
    assert.equal(pctSostenidaTxt(null), null);
  });
  test('en la lista («como SJN»: 95,0 % y «hasta 100,0 %» que en realidad pasó): «hasta 100,04 %»', () => {
    const x = fila({ N13_8: resumen(A_S, [100.04, 100.04, 99.6, 98.8, 97.5, 96.2, 95.6, 95.0, 94.0]) });
    assert.equal(Math.round(x.pct * 10) / 10, 95.0);
    assert.equal(x.sobrecargaSostenida, true);
    assert.equal(textoDevanados(x.sobrecarga), 'en el secundario 13,8 kV (2 h en total sobre el 100 %, hasta 100,04 %)');
    assert.deepEqual(csvSobrecarga(x), ['firme', 'secundario 13,8 kV (2 h en total sobre el 100 %, hasta 100,04 %)']);
  });
});

describe('(3) orden por fuerza de la sobrecarga y la nota del filtro', () => {
  const dev = (pct, horas, d = 'S') => ({ devanado: d, nombre: 'Secundario', nivel: 'N13_8', etiqueta: '13,8 kV', pct, ...(horas != null ? { horasSobre: { horas, cota: null } } : {}) });
  const x = (matricula, clase, pct, devs, extra = {}) => ({ matricula, clase, pct, sobrecargaSostenida: clase === 'firme', sobrecarga: { tipo: clase === 'firme' ? 'firme' : 'posible', devanados: devs }, ...extra });
  test('clase como siempre; dentro, el máximo sostenido del devanado más alto; luego horas, cifra y matrícula', () => {
    const filas = [
      x('F-MAM', 'firme', 97.1, [dev(101.4, 5)]),
      x('F-ALTA', 'firme', 120, [dev(105, 30)]),
      x('F-MAS-HORAS', 'firme', 98, [dev(104, 2, 'P'), dev(105, 40)]),
      x('F-CURVA', 'firme', 99, [dev(null, null)]),
      x('P-EDE', 'provisional', 97.9, [dev(130, 60)]),
      { matricula: 'N-CIRC', clase: 'nulo', pct: null, sobrecarga: { tipo: 'circuito', devanados: [dev(138, 10)] } },
      x('F-B', 'firme', 98, [dev(101.4, 5)]),
      x('F-A', 'firme', 98, [dev(101.4, 5)])
    ];
    assert.deepEqual(ordenarPorFuerza(filas).map((y) => y.matricula), ['F-MAS-HORAS', 'F-ALTA', 'F-A', 'F-B', 'F-MAM', 'F-CURVA', 'P-EDE', 'N-CIRC']);
    // Por la cifra (el orden de siempre) era otro: el de mayor cifra primero.
    assert.deepEqual(ordenarFilas(filas).map((y) => y.matricula).slice(0, 2), ['F-ALTA', 'F-CURVA']);
    assert.equal(fuerzaSobrecarga(filas[2]), 105); assert.equal(horasSobrecarga(filas[2]), 40);
    assert.equal(fuerzaSobrecarga(filas[3]), null); assert.equal(horasSobrecarga(filas[3]), null);
    assert.notEqual(ordenarPorFuerza(filas), filas, 'copia nueva');
  });
  test('desempate por horas: las del devanado que da la fuerza, no las de otro más flojo (revisión adversarial)', () => {
    const a = x('F-A', 'firme', 98, [dev(105, 3), dev(104, 80, 'P')]);
    const b = x('F-B', 'firme', 98, [dev(105, 20)]);
    assert.equal(horasSobrecarga(a), 3); assert.equal(horasSobrecarga(b), 20);
    assert.deepEqual(ordenarPorFuerza([a, b]).map((y) => y.matricula), ['F-B', 'F-A']);
    // Dos devanados empatados en la fuerza: el que más horas tiene.
    assert.equal(horasSobrecarga(x('F-C', 'firme', 98, [dev(105, 3), dev(105, 9, 'P')])), 9);
    // El devanado que da la fuerza sin horas (mes viejo): no se sabe, aunque otro más flojo las traiga.
    assert.equal(horasSobrecarga(x('F-D', 'firme', 98, [dev(105, null), dev(104, 80, 'P')])), null);
  });
  test('sin sobrecarga de hoy, la de antes del cambio de medida (la que la hace entrar al filtro); fila vieja sin campo → al final', () => {
    const bec = { matricula: 'F-BEC', clase: 'firme', pct: 91.5, sobrecarga: null, sobrecargaAnterior: { tipo: 'firme', meses: 2, devanados: [dev(103, 6)] } };
    const vieja = { matricula: 'F-VIEJA', clase: 'firme', pct: 99, sobrecargaSostenida: true };
    assert.equal(fuerzaSobrecarga(bec), 103); assert.equal(horasSobrecarga(bec), 6);
    assert.equal(fuerzaSobrecarga(vieja), null);
    assert.deepEqual(ordenarPorFuerza([vieja, x('F-1', 'firme', 97, [dev(101, 3)]), bec]).map((y) => y.matricula), ['F-BEC', 'F-1', 'F-VIEJA']);
  });
  test('marcar con el orden de siempre → por fuerza; con otra columna elegida, manda la elección; desmarcar → SIEMPRE la cifra', () => {
    assert.deepEqual(ordenConSostenida({ campo: 'pct', dir: 'desc' }, true), { campo: 'fuerza', dir: 'desc' });
    assert.deepEqual(ordenConSostenida(null, true), { campo: 'fuerza', dir: 'desc' });
    const eleccion = { campo: 'oficial', dir: 'desc' };
    assert.equal(ordenConSostenida(eleccion, true), eleccion);
    assert.deepEqual(ordenConSostenida({ campo: 'pct', dir: 'asc' }, true), { campo: 'pct', dir: 'asc' }, 'la cifra de menor a mayor también es una elección');
    assert.deepEqual(ordenConSostenida({ campo: 'fuerza', dir: 'desc' }, false), { campo: 'pct', dir: 'desc' });
    // Revisión adversarial: con el filtro marcado se pulsó otra columna → al desmarcar, la cifra (lo aprobado), y al volver
    // a marcar, la fuerza otra vez (antes la columna se quedaba y no había cómo volver a la fuerza, que no tiene cabecera).
    const alDesmarcar = ordenConSostenida(eleccion, false);
    assert.deepEqual(alDesmarcar, { campo: 'pct', dir: 'desc' });
    assert.deepEqual(ordenConSostenida(alDesmarcar, true), { campo: 'fuerza', dir: 'desc' });
    assert.notEqual(ordenConSostenida(eleccion, false), ordenConSostenida(eleccion, false), 'copia nueva cada vez');
    // El orden de respaldo de un modo sin la columna elegida (`ordenDelModo`): la fuerza con el filtro marcado; sin él, la cifra.
    assert.deepEqual(ordenConSostenida({ campo: 'pct', dir: 'desc' }, true), { campo: 'fuerza', dir: 'desc' });
    assert.deepEqual(ordenConSostenida({ campo: 'pct', dir: 'desc' }, false), { campo: 'pct', dir: 'desc' });
    assert.equal(TEXTO_ORDEN_FUERZA, 'fuerza de la sobrecarga (máximo sostenido 2 h)');
  });
  test('la nota: por qué la cifra puede quedar bajo el 100 % (un mes y varios meses)', () => {
    const m = notaSostenida(false); const p = notaSostenida(true);
    assert.equal(m.titulo, 'Cifra bajo el 100 % y aun así con sobrecarga sostenida: ');
    assert.match(m.texto, /^la cifra es el p99 del mes, que deja fuera su 1 % de horas más altas \(unas 7 en un mes completo\); la sobrecarga sostenida mira si hubo 2 h seguidas sobre el 100 % en cualquier momento del mes\./);
    assert.match(m.texto, /Las horas sobre el 100 % que se indican son todas las medidas en el mes, seguidas o sueltas\.$/);
    assert.equal(p.titulo, 'Carga del periodo bajo el 100 % y aun así con sobrecarga sostenida: ');
    assert.match(p.texto, /^la carga del periodo es el p99 de todas sus horas, que deja fuera su 1 % más alto \(unas 7 horas por cada mes\); la sobrecarga sostenida mira si hubo 2 h seguidas sobre el 100 % en algún mes\./);
    // Revisión adversarial: «esos meses» no decía cuáles; son los que suma `sobrecargaDelPeriodo`.
    assert.match(p.texto, /Las horas sobre el 100 % que se indican son todas las medidas en los meses con sobrecarga sostenida, seguidas o sueltas\.$/);
    assert.doesNotMatch(p.texto, /esos meses/);
  });
});

describe('la lista y L-102', () => {
  const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
  test('la lista: marcar o desmarcar cambia el orden con `ordenConSostenida`; «Quitar filtros» y el cambio de modo lo respetan', () => {
    const l = src('ui/cargabilidad-scada/lista.js');
    // La casilla: cambia el orden con `ordenConSostenida` y tiene la nota como descripción (lector de pantalla).
    assert.match(l, /chk\('csSost', f\.soloSostenida, \(v\) => \{ f\.soloSostenida = v; st\.orden = ordenConSostenida\(st\.orden, v\); \},\n\s+\{ 'aria-describedby': 'csNotaSost' \}\)/);
    assert.match(l, /const chk = \(id, valor, alCambiar, extra = \{\}\) => \{\n\s+const c = el\('input', \{ type: 'checkbox', id, checked: valor, \.\.\.extra \}\);/);
    assert.match(l, /if \(st\.orden\.campo === 'fuerza'\) return ordenarPorFuerza\(xs\);\n\s+return ordenarFilas\(xs, st\.orden\.campo, st\.orden\.dir\);/);
    assert.match(l, /'\. Ordenado por ' \+ \(st\.orden\.campo === 'fuerza' \? TEXTO_ORDEN_FUERZA/);
    // «Quitar filtros»: vuelve a la cifra SOLO si el filtro estaba marcado (si no, el orden elegido no se toca).
    assert.match(l, /onclick: \(\) => \{ const sost = st\.filtro\.soloSostenida; st\.filtro = \{ texto: '', zona: \[\], estado: '', crg: \[\], soloFirmes: false, soloSostenida: false, devSobre: \[\] \}; if \(sost\) st\.orden = ordenConSostenida\(st\.orden, false\); dibujar\(\);/);
    assert.doesNotMatch(l, /devSobre: \[\] \}; st\.orden = ordenConSostenida/, 'sin el filtro marcado, «Quitar filtros» no cambia el orden');
    // Cambio de modo: la fuerza sigue mientras el filtro esté marcado; una columna que no existe en el modo cae al orden de
    // siempre DEL FILTRO (la fuerza si está marcado; la cifra si no).
    assert.match(l, /if \(st\.orden\.campo === 'fuerza' && st\.filtro\.soloSostenida\) return;\n\s+if \(!cols\.some\(\(c\) => c\.campo && c\.campo === st\.orden\.campo\)\) st\.orden = ordenConSostenida\(\{ campo: 'pct', dir: 'desc' \}, st\.filtro\.soloSostenida\);/);
  });
  test('la lista: la nota se ve solo con el filtro marcado (oculta al desmarcar) y se repinta con la tabla', () => {
    const l = src('ui/cargabilidad-scada/lista.js');
    assert.match(l, /notaSost = el\('p', \{ class: 'cs-ayuda', id: 'csNotaSost', role: 'note', hidden: true \}\)/);
    assert.match(l, /if \(!st\.filtro\.soloSostenida\) \{ notaSost\.hidden = true; notaSost\.textContent = ''; return; \}/);
    assert.match(l, /const n = notaSostenida\(st\.modo === 'periodo' && !!st\.periodo\);\n\s+poner\(notaSost, el\('b', \{\}, n\.titulo\), n\.texto\);\n\s+notaSost\.hidden = false;/);
    assert.match(l, /contador\.textContent = todas\.length \+ ' de ' \+ st\.filas\.length \+ ' transformadores';\n\s+pintarNotaSostenida\(\);/);
  });
  test('el archivo NUEVO solo importa exportaciones publicadas (líneas exactas) y no importa la vista ni la sobrecarga (sin ciclo)', () => {
    const dom = src('domain/scada_carga_horas_sobre.js');
    assert.deepEqual([...dom.matchAll(/^import .*$/gm)].map((m) => m[0]), [
      "import { CALCULO } from './scada_carga_config.js';",
      "import { deBytesF32 } from './scada_carga_series.js';"
    ]);
    assert.doesNotMatch(dom, /\/[A-Z][a-z]+\/sw[A-Z]/, 'repo PÚBLICO: ningún nombre real de punto');
  });
  test('lo que importan del archivo nuevo la lista, la vista y la sobrecarga existe; lo demás que importan ya estaba publicado', async () => {
    const m = await import('../assets/js/domain/scada_carga_horas_sobre.js');
    for (const f of ['ui/cargabilidad-scada/lista.js', 'domain/scada_carga_vista.js', 'domain/scada_carga_sobrecarga.js', 'ui/cargabilidad-scada/historia.js']) {
      const linea = src(f).match(/^import \{([^}]+)\} from '[./]+(?:domain\/)?scada_carga_horas_sobre\.js';$/m);
      assert.ok(linea, f + ' importa el archivo nuevo');
      for (const n of linea[1].split(',').map((x) => x.trim()).filter(Boolean)) assert.ok(n in m, f + ' importa «' + n + '», que no existe');
    }
    // La lista no pide a la vista nada nuevo (un vista.js viejo en caché tumbaría la página).
    assert.match(src('ui/cargabilidad-scada/lista.js'), /^import \{ filasLista, filtrarFilas, ordenarFilas, mesPorDefecto \} from '\.\.\/\.\.\/domain\/scada_carga_vista\.js';$/m);
  });
  test('la historia (detalle: circuito sin confirmar) escribe el máximo sostenido sin redondeo engañoso', () => {
    const h = src('ui/cargabilidad-scada/historia.js');
    assert.match(h, /\(dc\.pct != null \? ' \(hasta ' \+ pctSostenidaTxt\(dc\.pct\) \+ '\)' : ''\)/);
    assert.doesNotMatch(h, /hasta ' \+ num\(dc\.pct/);
    assert.match(h, /^import \{ pctSostenidaTxt \} from '\.\.\/\.\.\/domain\/scada_carga_horas_sobre\.js';$/m);
  });
  test('los módulos cambiados compilan', () => {
    for (const f of ['ui/cargabilidad-scada/lista.js', 'domain/scada_carga_vista.js', 'domain/scada_carga_sobrecarga.js', 'domain/scada_carga_horas_sobre.js',
      'ui/cargabilidad-scada/historia.js']) {
      const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src(f), encoding: 'utf8' });
      assert.equal(r.status, 0, f + ': ' + r.stderr);
    }
  });
});
