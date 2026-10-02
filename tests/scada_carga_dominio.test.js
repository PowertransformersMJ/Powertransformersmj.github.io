// Cargabilidad SCADA (`99 §122`) — dominio puro con datos SINTÉTICOS (estaciones «EstDemo»).
// Cada caso reproduce algo MEDIDO en los exportes reales: fecha del encabezado distinta de la
// carpeta, variable dentro de la clave, centinelas, tensiones en otra escala, congelados,
// equipos fuera de servicio, duplicados, días sueltos y homologaciones dudosas.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaDeEncabezado, analizarClaveFila, nivelDe, valorDeCelda, banderaDeCelda, leerArchivo, claveId, fechaDeCarpeta, estadisticoDeNombre
} from '../assets/js/domain/scada_carga_csv.js';
import { codigoCelda, limpiarNivel, esCentinela, validos } from '../assets/js/domain/scada_carga_limpieza.js';
import {
  horasMes, t0Mes, msInicio, aBytesF32, deBytesF32, fusionarCrudo, recortarRango, mesesDelRango, empaquetar, desempaquetar, ventanaDeMes
} from '../assets/js/domain/scada_carga_series.js';
import {
  percentilOrdenado, estadisticas, iFaseMax, maxSostenido, horasSostenidasSobre, resumenFisico, cargabilidad, atribuirEscala, califCRG,
  firmeza, mideLaCarga, factorPotencia, desbalanceI
} from '../assets/js/domain/scada_carga_kpis.js';
import {
  leerFilasHomologacion, fusionarHomologacion, mapaNivelDevanado, avisosFila, estadoEfectivo, conteosHomologacion, objetivoImportacion,
  filaId, placaDe
} from '../assets/js/domain/scada_carga_homologacion.js';
import {
  crearAcumulador, acumularArchivo, clasificarMeses, armarMeses, procesarPuntoMes, docSerie, docSinCambios, informeSimulacion, diasDelMes,
  fundirCatalogo, fundirResumen
} from '../assets/js/domain/scada_carga_importacion.js';
import { filasLista, ordenarFilas, filtrarFilas, mesPorDefecto } from '../assets/js/domain/scada_carga_vista.js';
import { parseFechaHoraCO, aInputCO, intervaloCO, validarRango, rangoDeMes } from '../assets/js/domain/scada_carga_fecha.js';
import { CODIGO } from '../assets/js/domain/scada_carga_config.js';

const MV = 'Mv' + 'Moment';
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + String(m).padStart(2, '0') + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const fila = (est, nivel, elem, tok, vals) => '/' + est.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const rep = (x) => Array.from({ length: 24 }, (_, h) => (typeof x === 'function' ? x(h) : x));
const OBJ = objetivoImportacion({ r1: { clave_excel: '/EstDemo1/swTrafo1' }, r2: { clave_excel: '/EstDemo2/EDM302' } });

describe('CSV del exporte', () => {
  test('la fecha sale del ENCABEZADO; el nombre y la carpeta solo sirven de diagnóstico', () => {
    assert.deepEqual(fechaDeEncabezado(cab(7, 1, 2026)).fecha, '2026-01-07');
    assert.equal(fechaDeEncabezado(',1/01/26 0:00,1/01/26 2:00').ok, false);
    assert.equal(fechaDeEncabezado(cab(31, 2, 2026)).ok, false);
    assert.equal(fechaDeCarpeta('Agosto/12Agosto/x.csv', 2026), '2026-08-12');
    assert.equal(fechaDeCarpeta('Julio/25julio/x.csv', 2026), '2026-07-25');
    assert.equal(estadisticoDeNombre('Q_average_20260101.csv'), 'average');
    assert.equal(estadisticoDeNombre('urs_min_adm1-20260310.csv'), 'min');
  });
  test('la clave de fila (ancho fijo) y el token de la variable', () => {
    const k = analizarClaveFila('/EstDemo1/13.8kV  /swTrafo1/I R     /' + MV);
    assert.deepEqual([k.est, k.nivel, k.elem, k.familia], ['EstDemo1', 'N13_8', 'swTrafo1', 'IR']);
    assert.equal(analizarClaveFila('/EstDemo1/34KV    /swTrafo1/U RS    /' + MV).familia, 'URS');
    assert.equal(nivelDe('34.5KV'), 'N34_5'); assert.equal(nivelDe('34kV'), 'N34_5'); assert.equal(nivelDe('110kV'), 'N110'); assert.equal(nivelDe('Cartagen'), null);
    assert.equal(claveId('EstDemoñ', 'swTrafo1'), 'estdemon__swtrafo1');
  });
  test('celdas: vacío, null, notación científica, banderas', () => {
    assert.ok(Number.isNaN(valorDeCelda('null'))); assert.ok(Number.isNaN(valorDeCelda(''))); assert.ok(Number.isNaN(valorDeCelda('abc')));
    assert.equal(valorDeCelda('5.6E-7'), Math.fround(5.6e-7));
    assert.equal(banderaDeCelda('Actual'), 1); assert.equal(banderaDeCelda('HIS - Not collected'), 4); assert.equal(banderaDeCelda('raro'), 7);
  });
  test('solo las filas del objetivo, con la variable de la CLAVE', () => {
    const txt = [cab(10, 3, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep(10)), fila('EstDemo1', '13.8kV', 'swTrafo2', 'I S', rep(11)),
      fila('EstDemo1', '13.8kV', 'EDM305', 'I R', rep(1)), fila('EstDemo9', '13.8kV', 'swTrafo1', 'I R', rep(9))].join('\n');
    const r = leerArchivo(txt, OBJ, { estadistico: 'average' });
    assert.equal(r.fecha, '2026-03-10');
    assert.deepEqual(r.filas.map((f) => f.elem + ':' + f.familia), ['swTrafo1:IR', 'swTrafo2:IS']);
    const q = leerArchivo([cab(10, 3, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep('Invalid'))].join('\n'), OBJ, { estadistico: null });
    assert.equal(q.tipo, 'quality'); assert.equal(q.filas[0].banderas[0], 2);
  });
});

describe('limpieza', () => {
  test('pasada de celda en su orden', () => {
    assert.equal(codigoCelda(NaN, 1, 'IR', 13.8, true), CODIGO.NULO);
    assert.equal(codigoCelda(5, 1, 'IR', 13.8, false), CODIGO.SIN_ARCHIVO);
    assert.equal(codigoCelda(50, 2, 'IR', 13.8, true), CODIGO.BANDERA);
    assert.equal(codigoCelda(50, 0, 'IR', 13.8, true), CODIGO.VALIDO);   // sin archivo de calidad (enero 1-12)
    assert.equal(codigoCelda(32767, 1, 'IR', 13.8, true), CODIGO.CENTINELA);
    assert.equal(codigoCelda(-2147483648, 1, 'P', 13.8, true), CODIGO.CENTINELA);
    assert.equal(codigoCelda(32.767, 1, 'URS', 34.5, true), CODIGO.CENTINELA);   // plausible en 34,5 kV, pero es el tope
    assert.equal(codigoCelda(32293, 1, 'URS', 34.5, true), CODIGO.FUERA_ESCALA);  // en voltios
    assert.equal(codigoCelda(1000, 1, 'URS', 34.5, true), CODIGO.FUERA_ESCALA);
    assert.equal(codigoCelda(0, 1, 'IR', 13.8, true), CODIGO.CERO);
    assert.equal(codigoCelda(3000, 1, 'IR', 13.8, true), CODIGO.VALIDO);         // un 3000 aislado se conserva
    assert.ok(esCentinela(160.74801636));
  });
  const nivel = (gen) => {
    const n = 48; const fams = {};
    for (const f of ['IR', 'IS', 'IT', 'URS', 'UST', 'UTR', 'P', 'Q']) {
      fams[f] = { v: new Float32Array(n), b: new Uint8Array(n).fill(1), presente: new Uint8Array(n).fill(1) };
      for (let h = 0; h < n; h++) fams[f].v[h] = Math.fround(gen(f, h));
    }
    return fams;
  };
  test('fuera de servicio: corriente en cero con tensión presente (no es hueco)', () => {
    const l = limpiarNivel(nivel((f, h) => (f[0] === 'I' ? (h < 10 ? 0 : 50 + (h % 5)) : f[0] === 'U' ? 13.7 + h * 0.001 : (h < 10 ? 0 : 1 + h * 0.01))), 13.8);
    assert.equal(l.IR.m[3], CODIGO.DESENERGIZADO); assert.equal(l.P.m[3], CODIGO.DESENERGIZADO); assert.equal(l.IR.m[20], CODIGO.VALIDO);
  });
  test('congelado ≥ 6 h en I/P/Q; tensión quieta con corriente que varía = retenida (válida)', () => {
    const l = limpiarNivel(nivel((f, h) => (f === 'P' ? 0.798 : f[0] === 'U' ? 13.8 : 40 + (h % 7) * 3)), 13.8);
    assert.equal(l.P.m[5], CODIGO.CONGELADO);
    assert.equal(l.URS.m[5], CODIGO.RETENIDO);
    assert.ok(Number.isFinite(validos(l.URS)[5]));
    const l2 = limpiarNivel(nivel((f) => (f[0] === 'U' ? 13.8 : f[0] === 'I' ? 40 : 1)), 13.8);
    assert.equal(l2.IR.m[5], CODIGO.CONGELADO); assert.equal(l2.URS.m[5], CODIGO.CONGELADO);
  });
});

describe('series mensuales', () => {
  test('calendario por rótulo y convención «la hora que termina en el rótulo»', () => {
    assert.equal(horasMes('2026-02'), 672); assert.equal(horasMes('2026-07'), 744);
    assert.equal(t0Mes('2026-03'), Date.UTC(2026, 2, 1, 5));
    assert.equal(msInicio('2026-03', 0), Date.UTC(2026, 2, 1, 4));   // 0:00 del día 1 = 23:00–24:00 del día anterior
  });
  test('empaque Float32 ida y vuelta, con NaN', () => {
    const a = new Float32Array([1.5, NaN, -3, 0]);
    const b = deBytesF32(aBytesF32(a));
    assert.equal(b[0], 1.5); assert.ok(Number.isNaN(b[1])); assert.equal(b[2], -3);
    const s = desempaquetar(empaquetar({ v: a, m: new Uint8Array([0, 2, 0, 6]), b: new Uint8Array([1, 0, 1, 1]) }));
    assert.deepEqual([...s.m], [0, 2, 0, 6]);
  });
  test('fusión: completar no pisa; reemplazar solo las horas nuevas; nada se borra', () => {
    const g = { v: new Float32Array([1, 2, NaN]), m: new Uint8Array([0, 0, 1]), b: new Uint8Array([1, 1, 0]) };
    const t = { v: new Float32Array([9, NaN, 3]), b: new Uint8Array([1, 0, 1]), presente: new Uint8Array([1, 0, 1]) };
    const c = fusionarCrudo(g, t, 'completar');
    assert.deepEqual([...c.v].slice(0, 3), [1, 2, 3]); assert.equal(c.conflictos, 1); assert.equal(c.nuevas, 1);
    const r = fusionarCrudo(g, t, 'reemplazar');
    assert.deepEqual([...r.v], [9, 2, 3]);
  });
  test('un rango une meses; un mes que no se pudo leer se marca 20, uno sin datos 21', () => {
    const { desde } = rangoDeMes('2026-03');
    const hasta = desde + 48 * 3600e3;
    const serie = { v: new Float32Array(744).fill(5), m: new Uint8Array(744), b: new Uint8Array(744).fill(1) };
    const r = recortarRango({ '2026-03': { estado: 'ok', series: { IR: serie } } }, ['IR'], desde, hasta);
    assert.equal(r.fam.IR.v[0], 5);
    const f = recortarRango({ '2026-03': { estado: 'fallo' } }, ['IR'], desde, hasta);
    assert.equal(f.fam.IR.m[0], 20); assert.deepEqual(f.mesesFallidos, ['2026-03']);
    assert.deepEqual(mesesDelRango(desde, hasta), ['2026-03']);
  });
});

describe('cálculos', () => {
  test('percentil por rango más cercano y estadísticos (vacío no es cero)', () => {
    const o = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentilOrdenado(o, 0.99), 99); assert.equal(percentilOrdenado(o, 0.5), 50);
    assert.equal(estadisticas(new Float32Array([NaN, NaN])).p99, null);
  });
  const fam = (iR, iS, iT) => ({
    IR: { v: new Float32Array(iR), m: new Uint8Array(iR.length), b: new Uint8Array(iR.length) },
    IS: { v: new Float32Array(iS), m: new Uint8Array(iS.length), b: new Uint8Array(iS.length) },
    IT: { v: new Float32Array(iT), m: new Uint8Array(iT.length).map((_, i) => (Number.isNaN(iT[i]) ? 2 : 0)), b: new Uint8Array(iT.length) }
  });
  test('fase más cargada con al menos 2 fases válidas', () => {
    const r = iFaseMax(fam([10, 20], [30, 5], [NaN, NaN]));
    assert.deepEqual([...r.serie], [30, 20]); assert.equal(r.unaFalta, 2);
  });
  test('sobrecarga sostenida (≥ 2 h) frente a un pico aislado', () => {
    assert.deepEqual(maxSostenido([50, 120, 60, 110, 115, 40], 2), { valor: 110, idx: 3 });
    assert.deepEqual(horasSostenidasSobre([50, 120, 60, 110, 115, 40], 100, 2), { horas: 2, primera: 3, ultima: 4 });
  });
  test('cargabilidad = estadístico / ampacidad; escala sospechosa; CRG con las bandas ratificadas', () => {
    const r = { i: { n: 500, p50: 100, p99: 180, max: 200 }, rUI: 1.0 };
    assert.equal(cargabilidad(r, 200, 'p99'), 90);
    assert.equal(cargabilidad(r, null), null);
    assert.equal(atribuirEscala(r, 200), 'ok');
    assert.equal(atribuirEscala({ i: { n: 500, p50: 900, p99: 1000 }, rUI: 1 }, 200), 'ESCALA_I');
    assert.equal(atribuirEscala({ i: { n: 500, p50: 100, p99: 180 }, rUI: 24 }, 200), 'ESCALA_PQ');
    assert.deepEqual([60, 60.000001, 65, 75, 90, 90.000001].map((p) => califCRG(p)), [1, 2, 2, 3, 4, 5]);
    assert.equal(califCRG(null), null);
  });
  test('tridevanado: se necesita el primario, o el secundario y el terciario a la vez', () => {
    const tri = { P: { kv: 110, A: 300 }, S: { kv: 34.5, A: 600 }, T: { kv: 13.8, A: 800 } };
    assert.ok(!mideLaCarga(tri, ['S'])); assert.ok(mideLaCarga(tri, ['S', 'T'])); assert.ok(mideLaCarga(tri, ['P']));
    const dos = { P: { kv: 34.5, A: 300 }, S: { kv: 13.8, A: 800 }, T: { kv: null, A: null } };
    assert.ok(mideLaCarga(dos, ['S']));
  });
  test('firmeza: cada motivo', () => {
    const base = { estadoHomologacion: 'automatica', esCircuito: false, placa: { P: { kv: 34.5, A: 300 }, S: { kv: 13.8, A: 800 }, T: {} }, devanados: [{ d: 'S', A: 800, pct: 70, cobertura: 0.9, n: 600, escala: 'ok' }] };
    assert.deepEqual(firmeza(base), { firme: true, motivos: [] });
    assert.ok(firmeza({ ...base, estadoHomologacion: 'pendiente' }).motivos.includes('homologación por confirmar'));
    assert.ok(firmeza({ ...base, devanados: [{ ...base.devanados[0], cobertura: 0.3 }] }).motivos.includes('cobertura menor al 50 %'));
    assert.ok(firmeza({ ...base, devanados: [{ ...base.devanados[0], n: 10 }] }).motivos.includes('menos de 72 horas válidas'));
    assert.ok(firmeza({ ...base, mesesFallidos: ['2026-06'] }).motivos.includes('un mes del rango no se pudo leer'));
  });
  test('factor de potencia y desbalance', () => {
    const f = { P: { v: new Float32Array([0.95, -0.9]), m: new Uint8Array(2), b: new Uint8Array(2) }, Q: { v: new Float32Array([0.312, 0.4]), m: new Uint8Array(2), b: new Uint8Array(2) } };
    const fp = factorPotencia(f, 1);
    assert.ok(Math.abs(fp.serie[0] - 0.95) < 0.01); assert.ok(fp.min < 0.95);
    const d = desbalanceI(fam([100], [100], [130]), 300);
    assert.ok(Math.abs(d[0] - 18.18) < 0.1);
  });
});

describe('homologación', () => {
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo (IR_Average)'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO DOS', 'T2-X/X-DM2', '/EstDemo2/EDM302'],
    ['DEMO TRES', 'T3-X/X-DM3', 'NO ENCONTRADO'], ['DEMO CUATRO', 'T1-X/X-DM2', '/EstDemo2/EDM302']];
  test('lee la hoja, normaliza la clave y funde con la vigente sin perder decisiones', () => {
    const r = leerFilasHomologacion(aoa);
    assert.equal(r.filas.length, 4); assert.equal(r.filas[2].clave, null);
    const v1 = fusionarHomologacion(r.filas, null);
    assert.equal(v1.nuevas, 4);
    const id = filaId('T1-X/X-DM1', 'DEMO UNO');
    v1.filas[id].decision = { tipo: 'usar', avisos_vistos: [] };
    const v2 = fusionarHomologacion(r.filas.slice(1), { filas: v1.filas });
    assert.equal(v2.filas[id].retirada, true); assert.ok(v2.filas[id].decision);
  });
  test('avisos por regla y estado efectivo', () => {
    const { filas } = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null);
    const conteos = conteosHomologacion(filas);
    const tx = { electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
    const f2 = filas[filaId('T2-X/X-DM2', 'DEMO DOS')];
    const a2 = avisosFila(f2, { ...conteos, tx, punto: { niveles: { N13_8: {} } } }).avisos;
    assert.ok(a2.includes('CLAVE_CIRCUITO') && a2.includes('CLAVE_COMPARTIDA'));
    assert.equal(estadoEfectivo(f2, a2), 'pendiente');
    const confirmada = { ...f2, decision: { tipo: 'usar', avisos_vistos: ['CLAVE_CIRCUITO', 'CLAVE_COMPARTIDA'] } };
    assert.equal(estadoEfectivo(confirmada, a2), 'confirmada');
    assert.equal(estadoEfectivo({ ...f2, decision: { tipo: 'no_usar' } }, a2), 'excluida');
    const f3 = filas[filaId('T3-X/X-DM3', 'DEMO TRES')];
    assert.ok(avisosFila(f3, { ...conteos, tx: null, punto: null }).avisos.includes('NO_ENCONTRADO'));
  });
  test('nivel → devanado por la tensión de placa (±10 %); un nivel sin devanado se avisa', () => {
    const placa = placaDe({ electrico: { tension_primaria_kv: 66, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 200, corriente_nominal_secundaria_a: 900 } });
    const m = mapaNivelDevanado(['N110', 'N13_8'], placa);
    assert.deepEqual(m.mapa, { N13_8: 'S' }); assert.deepEqual(m.sinDevanado, ['N110']); assert.deepEqual(m.sinMedida, ['P']);
  });
});

describe('importación de punta a punta (carpeta sintética)', () => {
  const archivos = () => {
    const out = [];
    for (const d of [1, 2, 3]) {
      out.push({ nombre: 'ir_average-202603' + String(d).padStart(2, '0') + '.csv', ruta: 'Marzo/' + String(d).padStart(2, '0') + 'Marzo', texto:
        [cab(d, 3, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep((h) => 300 + h)), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I S', rep((h) => 290 + h)),
          fila('EstDemo1', '13.8kV', 'swTrafo1', 'I T', rep((h) => 280 + h)), fila('EstDemo1', '34.5kV', 'swTrafo1', 'I R', rep((h) => 120 + h))].join('\n') });
      out.push({ nombre: 'ir_quality-202603' + String(d).padStart(2, '0') + '.csv', ruta: 'Marzo/' + String(d).padStart(2, '0') + 'Marzo', texto:
        [cab(d, 3, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep((h) => (h === 5 ? 'Invalid' : 'Actual')))].join('\n') });
    }
    // Un día de julio traspapelado en la carpeta de marzo, un archivo vacío, un max y un xls.
    out.push({ nombre: 'ir_average-20260330.csv', ruta: 'Marzo/30Marzo', texto: [cab(29, 7, 2026), fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep(5))].join('\n') });
    out.push({ nombre: 'ir_average-20260304.csv', ruta: 'Marzo/04Marzo', texto: '', tamano: 0 });
    out.push({ nombre: 'ir_max-20260301.csv', ruta: 'Marzo/01Marzo', texto: cab(1, 3, 2026) });
    out.push({ nombre: 'P_average-20260301.xls', ruta: 'Marzo/01Marzo', texto: 'x' });
    return out.map((a) => ({ tamano: a.tamano == null ? a.texto.length : a.tamano, ...a }));
  };
  test('acumula, clasifica meses, limpia, resume y es idempotente', () => {
    const acc = crearAcumulador();
    for (const a of archivos()) acumularArchivo(acc, a, OBJ);
    assert.equal(acc.archivos.average, 4); assert.equal(acc.archivos.quality, 3);
    assert.equal(acc.archivos.vacios, 1); assert.equal(acc.archivos.max, 1); assert.equal(acc.archivos.otrosEstadisticos, 0); assert.equal(acc.archivos.noCsv, 1);   // §126: el máx se lee (solo para ver)
    assert.equal(acc.discrepancias.fechaCarpeta, 1);
    const meses = clasificarMeses(acc);
    assert.deepEqual(meses.map((m) => m.mes + ':' + m.marcado), ['2026-03:true', '2026-07:false']);
    const armados = armarMeses(acc, ['2026-03']);
    const cid = claveId('EstDemo1', 'swTrafo1');
    const p = procesarPuntoMes(armados.get('2026-03').get(cid), null);
    assert.deepEqual(Object.keys(p.niveles).sort(), ['N13_8', 'N34_5']);
    assert.equal(p.niveles.N13_8.fam.IR.m[5], CODIGO.BANDERA);                // la bandera Invalid de la hora 5
    assert.equal(p.niveles.N13_8.fam.IR.m[3 * 24], CODIGO.SIN_ARCHIVO);       // día 4: archivo vacío
    // La hora 5 pierde la fase R (bandera), pero S y T siguen: con 2 fases válidas la hora cuenta.
    assert.equal(p.resumen.N13_8.i.n, 3 * 24); assert.equal(p.resumen.N13_8.i.unaFalta, 3);   // la hora 5 de cada uno de los 3 días
    assert.equal(p.resumen.N34_5.i.n, 0);   // ese nivel solo trae una fase: no alcanza
    const doc = docSerie(cid, '2026-03', acc.puntos.get(cid), p.niveles);
    assert.equal(doc.n, 744);
    // Idempotencia: volver a procesar con lo guardado da los mismos bytes.
    const guardado = { niveles: {} };
    for (const [nv, x] of Object.entries(doc.niveles)) { guardado.niveles[nv] = { fam: {} }; for (const [f, s] of Object.entries(x.fam)) guardado.niveles[nv].fam[f] = desempaquetar(s); }
    const p2 = procesarPuntoMes(armados.get('2026-03').get(cid), guardado);
    assert.equal(p2.conflictos, 0);
    assert.ok(docSinCambios(docSerie(cid, '2026-03', acc.puntos.get(cid), p2.niveles), doc));
    assert.deepEqual(diasDelMes(acc, '2026-03').dias, 3);
    const inf = informeSimulacion({ acc, meses, clavesHomologadas: [cid, claveId('EstDemo2', 'EDM302')], puntosHallados: new Set([cid]), conflictos: 0, homologacionVigente: true });
    assert.equal(inf.veredicto, 'listo_con_avisos');
    assert.equal(informeSimulacion({ acc, meses, clavesHomologadas: [cid], puntosHallados: new Set(), conflictos: 0, homologacionVigente: false }).veredicto, 'bloqueado');
  });
});

describe('lista', () => {
  const txs = [
    { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'BOLIVAR' }, placa: { potencia_kva: 20000 },
      electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 335, corriente_nominal_secundaria_a: 837, corriente_medida_secundaria_a: 700 },
      salud_actual: { crg_pct_medido: 84 } },
    { id: 'b', identificacion: { matricula: 'T2-X/X-DM2' }, ubicacion: { subestacion_nombre: 'DEMO DOS', zona: 'ORIENTE' }, electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_secundaria_a: 400 } },
    { id: 'c', identificacion: { matricula: 'T9-X/X-NADA' }, ubicacion: { subestacion_nombre: 'SIN DATOS' } }
  ];
  const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO DOS', 'T2-X/X-DM2', '/EstDemo2/EDM302']];
  const homologacion = { filas: fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas };
  const c1 = claveId('EstDemo1', 'swTrafo1'); const c2 = claveId('EstDemo2', 'EDM302');
  const catalogo = { meses: { '2026-03': { completo: true }, '2026-04': { completo: false } }, puntos: { [c1]: { niveles: { N13_8: {}, N34_5: {} } }, [c2]: { niveles: { N13_8: {} } } } };
  const r = (p99, n = 700) => ({ i: { n, p50: p99 * 0.7, p95: p99 * 0.95, p99, max: p99 * 1.05 }, sost: { v: p99 * 0.98 }, cob: 0.95, rUI: 1 });
  const resumenMes = { claves: { [c1]: { N13_8: r(753), N34_5: r(300) }, [c2]: { N13_8: r(200) } } };
  test('firme, provisional (circuito sin confirmar → sin número) y nulo; la oficial al lado', () => {
    const f = filasLista({ parque: txs, homologacion, catalogo, resumenMes });
    const a = f.find((x) => x.id === 'a');
    assert.equal(a.clase, 'firme'); assert.equal(Math.round(a.pct), 90); assert.equal(a.crg, 4); assert.equal(a.devMax, 'S');
    assert.equal(a.oficial.pct, 84); assert.ok(a.delta != null);
    const b = f.find((x) => x.id === 'b');
    assert.equal(b.pct, null); assert.equal(b.motivoNulo, 'se mide un circuito, no el transformador');
    const c = f.find((x) => x.id === 'c');
    assert.equal(c.clase, 'nulo'); assert.equal(c.estado, 'sin_homologacion');
    assert.deepEqual(ordenarFilas(f).map((x) => x.id), ['a', 'b', 'c']);
    assert.deepEqual(filtrarFilas(f, { texto: 'demo uno' }).map((x) => x.id), ['a']);
    assert.equal(mesPorDefecto(catalogo), '2026-03');
  });
});

describe('lista: filtros de varias opciones (zona y CRG)', () => {
  const filas = [
    { id: 'a', matricula: 'A', subestacion: 'S1', zona: 'ORIENTE', departamento: '', crg: 5, estado: 'automatica', clase: 'firme' },
    { id: 'b', matricula: 'B', subestacion: 'S2', zona: 'OCCIDENTE', departamento: '', crg: 3, estado: 'automatica', clase: 'firme' },
    { id: 'c', matricula: 'C', subestacion: 'S3', zona: 'BOLIVAR', departamento: '', crg: 1, estado: 'pendiente', clase: 'provisional' },
    { id: 'd', matricula: 'D', subestacion: 'S4', zona: 'ORIENTE', departamento: '', crg: null, estado: 'automatica', clase: 'nulo' }
  ];
  const ids = (f) => filtrarFilas(filas, f).map((x) => x.id);
  test('varias zonas y varias calificaciones a la vez; vacío = todas; un texto suelto sigue valiendo', () => {
    assert.deepEqual(ids({ zona: ['ORIENTE', 'BOLIVAR'] }), ['a', 'c', 'd']);
    assert.deepEqual(ids({ crg: ['5', '1'] }), ['a', 'c']);
    assert.deepEqual(ids({ crg: [5, 3] }), ['a', 'b']);
    assert.deepEqual(ids({ zona: ['ORIENTE'], crg: ['5', '3'] }), ['a']);
    assert.deepEqual(ids({ zona: [], crg: [] }), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids({ zona: 'OCCIDENTE', crg: '' }), ['b']);   // el filtro de antes (un solo valor)
  });
});

describe('fecha y hora de Colombia', () => {
  test('parseo y formato no dependen de la zona del computador', () => {
    const ms = parseFechaHoraCO('2026-08-14T18:00');
    assert.equal(ms, Date.UTC(2026, 7, 14, 23));
    assert.equal(aInputCO(ms), '2026-08-14T18:00');
    assert.equal(intervaloCO(ms), '14-ago-2026 18:00–19:00');
    assert.equal(parseFechaHoraCO('2026-02-30T10:00'), null);
  });
  test('validación del rango', () => {
    assert.equal(validarRango({ desde: 10, hasta: 5 }).ok, false);
    assert.equal(validarRango({ desde: null, hasta: 5 }).errores[0].campo, 'desde');
    assert.equal(validarRango({ desde: 1, hasta: 2 }).ok, true);
  });
});

describe('revisión adversarial de §122 (ventana del mes, fusión, homologación)', () => {
  test('la ventana de un mes es la que resume la lista: 744 h, un solo documento, del rótulo 00:00 del 1 al 23:00 del último día', () => {
    const w = ventanaDeMes('2026-08');
    assert.equal((w.hasta - w.desde) / 3600e3, 744);
    assert.equal(w.desde, msInicio('2026-08', 0));
    assert.equal(aInputCO(w.desde + 3600e3), '2026-08-01T00:00');
    assert.equal(aInputCO(w.hasta), '2026-08-31T23:00');
    assert.deepEqual(mesesDelRango(w.desde, w.hasta), ['2026-08']);
    assert.deepEqual(mesesDelRango(w.desde, w.hasta + 3600e3), ['2026-08', '2026-09']);
    assert.deepEqual(mesesDelRango(w.desde, w.desde), []);
  });
  test('un mes que no se pudo leer solo cuenta si alguna de sus horas cae en el rango', () => {
    const w = ventanaDeMes('2026-03');
    const r = recortarRango({ '2026-03': { estado: 'ok', series: {} }, '2026-04': { estado: 'fallo' } }, ['IR'], w.desde, w.hasta);
    assert.deepEqual(r.mesesFallidos, []);
    const r2 = recortarRango({ '2026-04': { estado: 'fallo' } }, ['IR'], w.desde, w.hasta + 3600e3);
    assert.deepEqual(r2.mesesFallidos, ['2026-04']);
  });
  test('«reemplazar» no pisa con una celda vacía ni con un valor tope; la bandera de calidad no se pierde', () => {
    const g = { v: new Float32Array([100, 200, 300, 400]), m: new Uint8Array(4), b: new Uint8Array([1, 2, 0, 1]) };
    const t = { v: new Float32Array([NaN, 210, 300, 32767]), b: new Uint8Array([0, 0, 2, 0]), presente: new Uint8Array([1, 1, 1, 1]) };
    const r = fusionarCrudo(g, t, 'reemplazar');
    assert.deepEqual([...r.v], [100, 210, 300, 400]);
    assert.deepEqual([...r.b], [1, 2, 2, 1]);
    const c = fusionarCrudo(g, t, 'completar');
    assert.deepEqual([...c.v], [100, 200, 300, 400]);
    assert.equal(c.b[2], 2);   // la calidad que llegó después marca la hora
    const soloCalidad = fusionarCrudo(g, { v: new Float32Array(4).fill(NaN), b: new Uint8Array([0, 0, 3, 0]), presente: new Uint8Array(4) }, 'completar');
    assert.equal(soloCalidad.b[2], 3);
  });
  test('una tilde o un espacio de más en la subestación no cambian la fila ni pierden la confirmación', () => {
    assert.equal(filaId('T1-X/X-DM1', 'Subestacion  Demo'), filaId('T1-X/X-DM1', 'SUBESTACIÓN DEMO'));
    const dec = { tipo: 'usar', nota: 'confirmada en el banco', avisos_vistos: [] };
    const vig = { filas: { rviejo: { matricula: 'T9-X/X-DM9', subestacion: 'NOMBRE VIEJO', clave_excel: '/EstDemo9/swTrafo1', decision: dec } } };
    const f = fusionarHomologacion([{ orden: 1, subestacion: 'NOMBRE NUEVO', matricula: 'T9-X/X-DM9', texto: '/EstDemo9/swTrafo1', clave: { est: 'EstDemo9', elem: 'swTrafo1' } }], vig);
    const nueva = f.filas[filaId('T9-X/X-DM9', 'NOMBRE NUEVO')];
    assert.deepEqual(nueva.decision, dec);
    assert.equal(f.filas.rviejo.retirada, true);
  });
  test('catálogo y resumen se funden: nada de lo guardado se quita', () => {
    const g = { meses: { '2026-03': { dias: '1100' } }, puntos: { a__b: { clave: '/A/b', est: 'A', elem: 'b', niveles: { N13_8: { kv: 13.8 } }, meses: ['2026-03'] } } };
    const n = { meses: { '2026-03': { dias: '0011' }, '2026-04': { dias: '1111' } }, puntos: { a__b: { clave: '/A/b', est: 'A', elem: 'b', niveles: { N34_5: { kv: 34.5 } }, meses: ['2026-04'] }, c__d: { clave: '/C/d', est: 'C', elem: 'd', niveles: {}, meses: ['2026-04'] } } };
    const f = fundirCatalogo(g, n);
    assert.equal(f.meses['2026-03'].dias, '1111');
    assert.deepEqual(Object.keys(f.puntos).sort(), ['a__b', 'c__d']);
    assert.deepEqual(f.puntos.a__b.meses, ['2026-03', '2026-04']);
    assert.deepEqual(Object.keys(f.puntos.a__b.niveles).sort(), ['N13_8', 'N34_5']);
    assert.deepEqual(Object.keys(fundirResumen({ x: 1, y: 2 }, { y: 3, z: 4 })).sort(), ['x', 'y', 'z']);
  });
});
