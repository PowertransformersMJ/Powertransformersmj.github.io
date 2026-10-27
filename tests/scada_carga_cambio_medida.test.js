// Cargabilidad SCADA — CAMBIO DE MEDIDA de un transformador desde un mes (2026-10-26), con datos SINTÉTICOS («EstDemo»).
// Caso que lo motivó (nombres reales SOLO en la bóveda): una S/E con dos transformadores cuya barra de 13,8 kV se separó en
// mayo. Hasta abril el T1 llevaba los dos circuitos (su interruptor) y el T2 estaba sin carga; desde mayo cada uno se mide
// por su circuito. Lo que se exige: (1) sin medidas anteriores NADA cambia (misma fila, mismas cifras); (2) cada mes se
// calcula con la medida de ese mes; (3) «sin carga» = sin cifra con su motivo (nunca 0 % ni el circuito); (4) el periodo
// mira la configuración del último mes y lo de antes va aparte («vigente + lo anterior»); (5) validaciones de la escritura.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasLista, filtrarFilas } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import {
  filaDelMes, filasDelMes, segmentos, segmentoDelMes, mesesDelSegmento, puntoDelSegmento, tieneCambiosDeMedida, llavesPrevias,
  textoMes, mesSiguiente, textoVentana, motivoSinCarga, sobrecargaAntesDelCambio, decisionConCambio, erroresCambioMedida
} from '../assets/js/domain/scada_carga_cambio_medida.js';
import { fusionarHomologacion, leerFilasHomologacion, claveEfectiva } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';

const tx1 = { id: 't1', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 6500 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 109, corriente_nominal_secundaria_a: 272 } };
const tx2 = { id: 't2', identificacion: { matricula: 'T2-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 3000 },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 50.2, corriente_nominal_secundaria_a: 126 } };
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO UNO', 'T2-X/X-DM1', '/EstDemo1/EDM303']];
const homBase = () => fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const idDe = (filas, mat) => Object.keys(filas).find((k) => filas[k].matricula === mat);
const SW = claveId('EstDemo1', 'swTrafo1'); const C2 = claveId('EstDemo1', 'EDM302'); const C3 = claveId('EstDemo1', 'EDM303');
/** Resumen de un nivel en AMPERIOS: p99, máximo y máximo sostenido 2 h. */
// Con sus 90 horas más altas (`top`) y sus horas del mes, como los guarda el importador: el periodo los necesita.
const r = (p99, max, sost) => ({ i: { n: 700, p50: p99 * 0.7, p95: p99 * 0.95, p99, max, unaFalta: 0 }, sost: { v: sost }, cob: 0.95, rUI: 1,
  top: Array(90).fill(p99), horas: 720, servicio: 720 });
// Barra única (ene–abr): el interruptor del T1 lleva los dos circuitos (≈ 115 % de 272 A); el T2 sin carga. Desde jun:
// barras separadas, T1 = EDM302 (≈ 90 %), T2 = EDM303 (≈ 92 % de 126 A). La entrada de 34,5 kV es la del interruptor.
const resumenDe = (mes) => (mes <= '2026-04'
  ? { mes, claves: { [SW]: { N34_5: r(1.12 * 109, 1.2 * 109, 1.15 * 109), N13_8: r(1.12 * 272, 1.2 * 272, 1.15 * 272) }, [C3]: { N13_8: r(110, 120, 115) }, [C2]: { N13_8: r(200, 210, 205) } } }
  : { mes, claves: { [SW]: { N34_5: r(1.3 * 109, 1.35 * 109, 1.32 * 109) }, [C2]: { N13_8: r(0.9 * 272, 0.95 * 272, 0.92 * 272) }, [C3]: { N13_8: r(0.92 * 126, 0.95 * 126, 0.93 * 126) } } });
const MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-06', '2026-07', '2026-08'];
const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])),
  puntos: { [SW]: { niveles: { N34_5: {}, N13_8: {} }, meses: MESES }, [C2]: { niveles: { N13_8: {} }, meses: MESES }, [C3]: { niveles: { N13_8: {} }, meses: MESES } } };

const NOTA_T1 = 'Hasta abr-2026 una sola barra: el interruptor del T1 llevaba los dos circuitos (demo).';
const NOTA_T2 = 'Hasta abr-2026 el T2 estuvo sin carga: el T1 llevaba la barra (demo).';
/** La homologación con el cambio de medida registrado en las dos filas (como lo arma decisionConCambio). */
function homConCambio() {
  const filas = homBase();
  const i1 = idDe(filas, 'T1-X/X-DM1'); const i2 = idDe(filas, 'T2-X/X-DM1');
  filas[i1] = { ...filas[i1], decision: decisionConCambio(filas[i1], { hasta: '2026-04', antes: 'actual', nota: NOTA_T1,
    nueva: { tipo: 'usar', clave: '/EstDemo1/EDM302', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'Desde may-2026 el T1 alimenta solo su circuito (demo).', clave_excel_vista: '/EstDemo1/swTrafo1', avisos_vistos: ['CLAVE_CIRCUITO', 'DEVANADO_SIN_MEDIDA'] } }) };
  filas[i2] = { ...filas[i2], decision: decisionConCambio(filas[i2], { hasta: '2026-04', antes: 'sin_carga', nota: NOTA_T2,
    nueva: { tipo: 'usar', clave: '/EstDemo1/EDM303', mapa: { N13_8: 'S' }, niveles_vistos: ['N13_8'], nota: 'Desde may-2026 el T2 alimenta su circuito (demo).', clave_excel_vista: '/EstDemo1/EDM303', avisos_vistos: ['CLAVE_CIRCUITO', 'DEVANADO_SIN_MEDIDA'] } }) };
  return { filas, i1, i2 };
}
const lista = (filas, mes) => filasLista({ parque: [tx1, tx2], homologacion: { filas }, catalogo, resumenMes: resumenDe(mes) });
const fila = (xs, id) => xs.find((x) => x.id === id);

describe('sin medidas anteriores, nada cambia', () => {
  test('filaDelMes devuelve la MISMA fila y filasDelMes el MISMO objeto; un mapa vacío no es un cambio', () => {
    const filas = homBase(); const f = Object.values(filas)[0];
    assert.equal(filaDelMes(f, '2026-04'), f);
    assert.equal(filasDelMes(filas, '2026-04'), filas);
    assert.equal(segmentos(f).length, 1);
    assert.equal(tieneCambiosDeMedida({ previas: {} }), false);
    assert.equal(tieneCambiosDeMedida({ previas: [] }), false);
    assert.equal(tieneCambiosDeMedida({ previas: { 'no-es-mes': {} } }), false);
    const g = { ...f, decision: { tipo: 'usar', clave: f.clave_excel, previas: {} } };
    assert.equal(filaDelMes(g, '2026-04'), g);
  });
  test('la lista y el periodo dan lo mismo con «previas» vacías que sin ellas', () => {
    const a = homBase(); const b = homBase();
    for (const id of Object.keys(b)) b[id] = { ...b[id], decision: { tipo: 'usar', clave: b[id].clave_excel, nota: 'x', avisos_vistos: [], previas: {} } };
    for (const id of Object.keys(a)) a[id] = { ...a[id], decision: { tipo: 'usar', clave: a[id].clave_excel, nota: 'x', avisos_vistos: [] } };
    const quitar = (xs) => JSON.parse(JSON.stringify(xs, (k, v) => (k === 'previas' ? undefined : v)));
    for (const m of ['2026-03', '2026-07']) assert.deepEqual(quitar(lista(b, m)), quitar(lista(a, m)));
    const per = (filas) => filasPeriodo({ parque: [tx1, tx2], homologacion: { filas }, catalogo, meses: MESES,
      resumenes: Object.fromEntries(MESES.map((m) => [m, resumenDe(m)])), filasPorMes: Object.fromEntries(MESES.map((m) => [m, lista(filas, m)])) });
    assert.deepEqual(quitar(per(b)), quitar(per(a)));
  });
});

describe('la medida de cada mes', () => {
  test('llave = último mes en que rigió: abril usa la anterior, mayo en adelante la de hoy; cambio de año', () => {
    const { filas, i1, i2 } = homConCambio();
    assert.equal(claveEfectiva(filaDelMes(filas[i1], '2026-04')), '/EstDemo1/swTrafo1');
    assert.equal(claveEfectiva(filaDelMes(filas[i1], '2026-05')), '/EstDemo1/EDM302');
    assert.equal(claveEfectiva(filaDelMes(filas[i1], '2025-11')), '/EstDemo1/swTrafo1');
    assert.equal(claveEfectiva(filaDelMes(filas[i1], 'cualquiera')), '/EstDemo1/EDM302', 'sin mes válido: la de hoy');
    assert.equal(claveEfectiva(filaDelMes(filas[i2], '2026-04')), null, '«sin carga» nunca cae a la clave del Excel (el circuito)');
    assert.equal(mesSiguiente('2026-12'), '2027-01'); assert.equal(textoMes('2026-04'), 'abr-2026');
    const segs = segmentos(filas[i1]);
    assert.deepEqual(segs.map((s) => [s.desde, s.hasta, s.tipo]), [[null, '2026-04', 'medida'], ['2026-05', null, 'vigente']]);
    assert.equal(textoVentana(segs[0]), 'hasta abr-2026'); assert.equal(textoVentana(segs[1]), 'desde may-2026');
    assert.deepEqual(mesesDelSegmento(segs[1], MESES), ['2026-06', '2026-07', '2026-08']);
    assert.deepEqual(puntoDelSegmento(catalogo.puntos[SW], segs[0]).meses, ['2026-01', '2026-02', '2026-03', '2026-04']);
    assert.equal(puntoDelSegmento(catalogo.puntos[SW], segmentos(homBase()[i1])[0]), catalogo.puntos[SW]);
  });
  test('abril: el T1 por su interruptor (IGUAL que sin el cambio) y el T2 «sin carga» (sin cifra, sin el circuito)', () => {
    const { filas, i1, i2 } = homConCambio();
    const hoy = homBase();
    const antes = fila(lista(hoy, '2026-04'), 't1'); const con = fila(lista(filas, '2026-04'), 't1');
    assert.equal(con.claveId, SW); assert.equal(con.pct, antes.pct); assert.equal(con.sobrecargaSostenida, antes.sobrecargaSostenida);
    assert.ok(con.pct > 110 && con.sobrecargaSostenida, 'el T1 llevaba los dos circuitos');
    assert.equal(con.cambioMedida.tipo, 'medida'); assert.equal(con.cambioMedida.vigenteDesde, '2026-05');
    const t2 = fila(lista(filas, '2026-04'), 't2');
    assert.equal(t2.pct, null); assert.equal(t2.claveId, null); assert.equal(t2.sinCarga, true);
    assert.equal(t2.motivoNulo, motivoSinCarga({ hasta: '2026-04', nota: NOTA_T2 }));
    assert.match(t2.motivoNulo, /^sin carga hasta abr-2026 \(según el Ingeniero: /);
    assert.equal(t2.sobrecarga, null); assert.equal(t2.sobrecargaSostenida, false);
    // Sin el cambio, el T2 mostraba el circuito que en realidad era carga del T1 (el doble conteo).
    assert.ok(fila(lista(hoy, '2026-04'), 't2').pct == null, 'hoy: circuito sin confirmar');
  });
  test('julio: cada uno por su circuito; el T2 confirmado con su circuito', () => {
    const { filas } = homConCambio();
    const t1 = fila(lista(filas, '2026-07'), 't1'); const t2 = fila(lista(filas, '2026-07'), 't2');
    assert.equal(t1.claveId, C2); assert.ok(Math.abs(t1.pct - 90) < 0.5); assert.equal(t1.cambioMedida.tipo, 'vigente');
    assert.equal(t2.claveId, C3); assert.ok(Math.abs(t2.pct - 92) < 0.5); assert.equal(t2.estado, 'confirmada');
  });
});

describe('periodo: la configuración vigente y lo de antes aparte', () => {
  const per = (filas, meses) => filasPeriodo({ parque: [tx1, tx2], homologacion: { filas }, catalogo, meses,
    resumenes: Object.fromEntries(meses.map((m) => [m, resumenDe(m)])), filasPorMes: Object.fromEntries(meses.map((m) => [m, lista(filas, m)])) });
  test('ene–ago: la cifra del T1 es la de jun–ago (~90 %); su sobrecarga de ene–abr va en «sobrecargaAnterior»', () => {
    const { filas } = homConCambio();
    const t1 = fila(per(filas, MESES), 't1');
    assert.deepEqual(t1.periodo.meses, ['2026-06', '2026-07', '2026-08']);
    assert.ok(Math.abs(t1.pct - 90) < 0.5, 'cifra de la medida de hoy');
    assert.equal(t1.sobrecargaSostenida, false);
    assert.deepEqual(t1.cambioMedida.mesesAntes, ['2026-01', '2026-02', '2026-03', '2026-04']);
    assert.equal(t1.sobrecargaAnterior.tipo, 'firme'); assert.equal(t1.sobrecargaAnterior.meses, 4); assert.equal(t1.sobrecargaAnterior.hasta, '2026-04');
    assert.deepEqual(t1.sobrecargaAnterior.devanados.map((d) => d.devanado), ['P', 'S']);
    assert.equal(filtrarFilas([t1], { soloSostenida: true }).length, 1, 'el filtro lo trae (vigente + lo anterior)');
    // Sin RELACION_NIVELES falso: la relación se evalúa con UNA configuración.
    assert.ok(!t1.avisos.includes('RELACION_NIVELES'));
  });
  test('ene–ago: el T2 solo cuenta jun–ago (sin carga antes: ni hueco ni 0 %); ene–abr: «sin carga» en todo el periodo', () => {
    const { filas } = homConCambio();
    const t2 = fila(per(filas, MESES), 't2');
    assert.deepEqual(t2.periodo.meses, ['2026-06', '2026-07', '2026-08']);
    assert.ok(Math.abs(t2.pct - 92) < 0.5); assert.equal(t2.sobrecargaAnterior, undefined);
    const t2a = fila(per(filas, MESES.slice(0, 4)), 't2');
    assert.equal(t2a.pct, null); assert.equal(t2a.sinCarga, true); assert.match(t2a.motivoNulo, /^sin carga hasta abr-2026/);
    const t1a = fila(per(filas, MESES.slice(0, 4)), 't1');
    assert.equal(t1a.claveId, SW); assert.equal(t1a.sobrecargaSostenida, true); assert.deepEqual(t1a.cambioMedida.mesesAntes, []);
  });
  test('sobrecargaAntesDelCambio: firme si algún mes fue firme; null sin sobrecarga', () => {
    assert.equal(sobrecargaAntesDelCambio([null, { sobrecargaSostenida: false }]), null);
    const { filas } = homConCambio();
    const s = sobrecargaAntesDelCambio(['2026-01', '2026-02'].map((m) => fila(lista(filas, m), 't1')));
    assert.equal(s.tipo, 'firme'); assert.equal(s.meses, 2);
  });
});

describe('escritura: decisionConCambio y erroresCambioMedida', () => {
  test('decisionConCambio arma la decisión exacta y no muta nada', () => {
    const filas = Object.freeze(homBase());
    const f = Object.freeze({ ...Object.values(filas)[0], decision: Object.freeze({ tipo: 'usar', clave: '/EstDemo1/swTrafo1', nota: 'antes', avisos_vistos: [] }) });
    const d = decisionConCambio(f, { hasta: '2026-04', antes: 'actual', nota: 'nota de la medida anterior', nueva: { tipo: 'usar', clave: '/EstDemo1/EDM302', nota: 'hoy', previas: { x: 1 } } });
    assert.deepEqual(d, { tipo: 'usar', clave: '/EstDemo1/EDM302', nota: 'hoy',
      previas: { '2026-04': { tipo: 'medida', clave_excel: '/EstDemo1/swTrafo1', decision: { tipo: 'usar', clave: '/EstDemo1/swTrafo1', nota: 'antes', avisos_vistos: [] }, nota: 'nota de la medida anterior' } } });
    // Un segundo cambio conserva el primero.
    const g = { ...f, decision: d };
    const d2 = decisionConCambio(g, { hasta: '2026-09', antes: 'sin_carga', nota: 'en reserva desde oct (demo)', nueva: { tipo: 'usar', clave: '/EstDemo1/EDM302', nota: 'otra' } });
    assert.deepEqual(llavesPrevias(d2), ['2026-04', '2026-09']);
    assert.equal(d2.previas['2026-04'].clave_excel, '/EstDemo1/swTrafo1');
  });
  test('erroresCambioMedida: lo válido pasa; lo que la primera versión no admite se dice', () => {
    const { filas, i1, i2 } = homConCambio();
    assert.deepEqual(erroresCambioMedida(filas[i1], filas[i1].decision), []);
    assert.deepEqual(erroresCambioMedida(filas[i2], filas[i2].decision), []);
    const d = filas[i1].decision;
    assert.equal(erroresCambioMedida(filas[i1], { ...d, tipo: 'no_usar' }).length, 1);
    assert.equal(erroresCambioMedida(filas[i1], { ...d, suma: { N13_8: {} } }).length, 1);
    assert.ok(erroresCambioMedida(filas[i1], { ...d, previas: { 'abril': d.previas['2026-04'] } }).length >= 1);
    assert.equal(erroresCambioMedida(filas[i1], { ...d, previas: { '2026-04': { ...d.previas['2026-04'], nota: 'corta' } } }).length, 1);
    assert.equal(erroresCambioMedida(filas[i1], { ...d, previas: { '2026-04': { tipo: 'medida', clave_excel: '/EstDemo2/swTrafo1', decision: null, nota: 'otra estación (demo)' } } }).length, 1);
    assert.equal(erroresCambioMedida(filas[i1], { ...d, previas: { '2026-04': { tipo: 'medida', clave_excel: '/EstDemo1/EDM303', decision: null, nota: 'un circuito que no es el del Excel' } } }).length, 1);
    assert.deepEqual(erroresCambioMedida(filas[i1], { tipo: 'usar', clave: '/EstDemo1/swTrafo1' }), [], 'sin previas no hay nada que validar');
  });
});

describe('pantallas (lo que no corre en Node queda en el código)', () => {
  const src = (f) => readFileSync(new URL('../assets/js/' + f, import.meta.url), 'utf8');
  test('«Revisar» conserva las medidas anteriores y «Reabrir» pide un segundo clic', () => {
    const h = src('ui/scada-datos/homologacion.js');
    assert.match(h, /if \(tieneCambiosDeMedida\(f\.decision\)\) \{[\s\S]{0,400}decision\.previas = f\.decision\.previas;/);
    assert.match(h, /if \(tieneCambiosDeMedida\(f\.decision\) && !reabrirConfirmado\) \{/);
  });
  test('el detalle abre UNA configuración (la del mes pedido) y ofrece las otras', () => {
    const d = src('ui/cargabilidad-scada/detalle.js');
    assert.match(d, /const seg = filaBase \? segmentoDelMes\(filaBase, mes \|\| mesDe\(desde\) \|\| mesDe\(hasta\)\) : null;/);
    assert.match(d, /const punto = seg && segs\.length > 1 \? puntoDelSegmento\(puntoTodo, seg\) : puntoTodo;/);
    assert.match(d, /avisoCambioMedida\(a\)\);/);
  });
  test('la regla de Firestore impide que una confirmación pierda las medidas anteriores', () => {
    const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    assert.match(reglas, /&& previasSeConservan\(v, r\)\)\);/);
    assert.match(reglas, /r\.despues\.previas\.keys\(\)\.hasAll\(antes\.previas\.keys\(\)\)/);
  });
  test('L-102: los módulos publicados solo importan del archivo nuevo lo que existe', async () => {
    const m = await import('../assets/js/domain/scada_carga_cambio_medida.js');
    for (const [f, rx] of [['domain/scada_carga_vista.js', /import \{([^}]+)\} from '\.\/scada_carga_cambio_medida\.js'/], ['domain/scada_carga_periodo.js', /import \{([^}]+)\} from '\.\/scada_carga_cambio_medida\.js'/],
      ['ui/cargabilidad-scada/lista.js', /import \{([^}]+)\} from '\.\.\/\.\.\/domain\/scada_carga_cambio_medida\.js'/], ['ui/cargabilidad-scada/detalle.js', /import \{([^}]+)\} from '\.\.\/\.\.\/domain\/scada_carga_cambio_medida\.js'/],
      ['ui/scada-datos/homologacion.js', /import \{([^}]+)\} from '\.\.\/\.\.\/domain\/scada_carga_cambio_medida\.js'/]]) {
      const nombres = src(f).match(rx)[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      for (const n of nombres) assert.ok(n in m, f + ' importa «' + n + '», que no existe');
    }
  });
});
