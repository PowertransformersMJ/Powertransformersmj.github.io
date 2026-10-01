// Cargabilidad SCADA (`99 §126`) — máximo, mínimo e instantáneo de cada hora, con datos SINTÉTICOS
// (estaciones «EstDemo»). Lo que se exige: se guardan y se leen de punta a punta, un mes ya cargado
// SIN ellos los recibe con «Completar» sin cambiar ni un byte de lo que había, y la CIFRA (resumen,
// valor, código y bandera) es idéntica con y sin extras: son solo para ver.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearAcumulador, acumularArchivo, armarMeses, procesarPuntoMes, docSerie, docSinCambios, planLotes, tamanoDoc } from '../assets/js/domain/scada_carga_importacion.js';
import { empaquetar, desempaquetar, fusionarCrudo, recortarRango, ventanaDeMes } from '../assets/js/domain/scada_carga_series.js';
import { extrasVisibles } from '../assets/js/domain/scada_carga_extras.js';
import { objetivoImportacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO } from '../assets/js/domain/scada_carga_config.js';

const MV = 'Mv' + 'Moment';
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + String(m).padStart(2, '0') + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const fila = (est, nivel, elem, tok, vals) => '/' + est.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const rep = (x) => Array.from({ length: 24 }, (_, h) => (typeof x === 'function' ? x(h) : x));
const OBJ = objetivoImportacion({ r1: { clave_excel: '/EstDemo1/swTrafo1' } });
const CID = claveId('EstDemo1', 'swTrafo1');

/** Dos días de marzo: promedio, calidad y extras de las 3 corrientes; una estación con SOLO máximos. */
function carpeta({ conExtras = true } = {}) {
  const out = [];
  for (const d of [1, 2]) {
    const dd = String(d).padStart(2, '0');
    const arch = (est, filas) => out.push({ nombre: 'x_' + est + '-202603' + dd + '.csv', ruta: 'Marzo/' + dd + 'Marzo', texto: [cab(d, 3, 2026), ...filas].join('\n') });
    for (const [tok, base] of [['I R', 300], ['I S', 290], ['I T', 280]]) {
      arch('average', [fila('EstDemo1', '13.8kV', 'swTrafo1', tok, rep((h) => base + h))]);
      if (!conExtras) continue;
      arch('max', [fila('EstDemo1', '13.8kV', 'swTrafo1', tok, rep((h) => (h === 7 ? 32767 : base + h + 9))), fila('EstSolo', '13.8kV', 'swTrafo1', tok, rep(1))]);
      arch('min', [fila('EstDemo1', '13.8kV', 'swTrafo1', tok, rep((h) => base + h - 8))]);
      arch('current', [fila('EstDemo1', '13.8kV', 'swTrafo1', tok, rep((h) => base + h + 1))]);
    }
    arch('quality', [fila('EstDemo1', '13.8kV', 'swTrafo1', 'I R', rep((h) => (h === 5 ? 'Invalid' : 'Actual')))]);
  }
  return out.map((a) => ({ ...a, tamano: a.texto.length }));
}
function procesar(lista, guardado = null, modo = 'completar') {
  const acc = crearAcumulador();
  const obj = objetivoImportacion({ r1: { clave_excel: '/EstDemo1/swTrafo1' }, r2: { clave_excel: '/EstSolo/swTrafo1' } });
  for (const a of lista) acumularArchivo(acc, a, obj);
  const armados = armarMeses(acc, ['2026-03']);
  return { acc, armados, p: procesarPuntoMes(armados.get('2026-03').get(CID), guardado, modo) };
}
const guardadoDe = (doc) => {
  const g = { niveles: {} };
  for (const [nv, x] of Object.entries(doc.niveles)) { g.niveles[nv] = { fam: {} }; for (const [f, s] of Object.entries(x.fam)) g.niveles[nv].fam[f] = desempaquetar(s); }
  return g;
};

describe('extras: máximo, mínimo e instantáneo de cada hora', () => {
  test('se leen, se arman por hora y viajan hasta el documento; un punto que solo trae extras no se crea', () => {
    const { acc, armados, p } = procesar(carpeta());
    assert.equal(acc.archivos.max, 6); assert.equal(acc.archivos.min, 6); assert.equal(acc.archivos.current, 6);
    assert.equal(armados.get('2026-03').has(claveId('EstSolo', 'swTrafo1')), false);
    const ir = p.niveles.N13_8.fam.IR;
    assert.equal(ir.max[3], 312); assert.equal(ir.min[3], 295); assert.equal(ir.ins[3], 304);   // 300 + h(3) + 9 / − 8 / + 1
    assert.ok(Number.isNaN(ir.max[3 * 24]));   // día 4: sin archivo
    const doc = docSerie(CID, '2026-03', acc.puntos.get(CID), p.niveles);
    const g = desempaquetar(doc.niveles.N13_8.fam.IR);
    assert.equal(g.max[3], 312); assert.equal(g.ins[3], 304);
  });
  test('la CIFRA es idéntica con y sin extras (resumen, valor, código y bandera)', () => {
    const con = procesar(carpeta()).p; const sin = procesar(carpeta({ conExtras: false })).p;
    assert.deepEqual(con.resumen, sin.resumen);
    for (const f of ['IR', 'IS', 'IT']) {
      const a = empaquetar(con.niveles.N13_8.fam[f]); const b = empaquetar(sin.niveles.N13_8.fam[f]);
      for (const k of ['v', 'm', 'b']) assert.deepEqual([...a[k]], [...b[k]]);
      assert.ok(a.max && !b.max);
    }
  });
  test('«Completar» sobre un mes guardado SIN extras: los agrega y no cambia ni un byte de lo que había', () => {
    const r0 = procesar(carpeta({ conExtras: false }));
    const doc0 = docSerie(CID, '2026-03', r0.acc.puntos.get(CID), r0.p.niveles);
    const r1 = procesar(carpeta(), guardadoDe(doc0), 'completar');
    const doc1 = docSerie(CID, '2026-03', r1.acc.puntos.get(CID), r1.p.niveles);
    assert.equal(docSinCambios(doc1, doc0), false);   // hay extras nuevos: se reescribe
    for (const f of ['IR', 'IS', 'IT']) for (const k of ['v', 'm', 'b']) assert.deepEqual([...doc1.niveles.N13_8.fam[f][k]], [...doc0.niveles.N13_8.fam[f][k]]);
    assert.deepEqual(r1.p.resumen, r0.p.resumen);
    const r2 = procesar(carpeta(), guardadoDe(doc1), 'completar');
    assert.equal(docSinCambios(docSerie(CID, '2026-03', r2.acc.puntos.get(CID), r2.p.niveles), doc1), true);   // idempotente
  });
  test('fusión de extras: siguen a la exportación del promedio de cada hora (nunca se mezclan dos)', () => {
    const n = 4;
    const nuevo = { v: new Float32Array(n).fill(1), b: new Uint8Array(n), presente: new Uint8Array(n).fill(1), max: Float32Array.from([9, NaN, 32767, 7]) };
    const guardado = { v: new Float32Array(n).fill(1), m: new Uint8Array(n), b: new Uint8Array(n), max: Float32Array.from([5, 6, 8, NaN]) };
    const txt = (a) => Array.from(a, String);
    // Mismo promedio: lo guardado manda y lo vacío se llena.
    assert.deepEqual(txt(fusionarCrudo(guardado, nuevo, 'completar').max), ['5', '6', '8', '7']);
    // Reemplazar con un promedio real: la hora es de la exportación nueva, extras incluidos.
    assert.deepEqual(txt(fusionarCrudo(guardado, nuevo, 'reemplazar').max), ['9', 'NaN', '32767', '7']);
    // Conflicto en «completar»: se queda el promedio guardado (500) y con él su extra (no el 310 de la otra exportación).
    const g2 = { v: Float32Array.from([500]), m: new Uint8Array(1), b: new Uint8Array(1), max: Float32Array.from([NaN]) };
    const n2 = { v: Float32Array.from([300]), b: new Uint8Array(1), presente: Uint8Array.from([1]), max: Float32Array.from([310]) };
    assert.ok(Number.isNaN(fusionarCrudo(g2, n2, 'completar').max[0]));
    // Reemplazar con un promedio vacío o tope: no pisa el promedio y tampoco su extra.
    const n3 = { v: Float32Array.from([32767]), b: new Uint8Array(1), presente: Uint8Array.from([1]), max: Float32Array.from([210]) };
    assert.ok(Number.isNaN(fusionarCrudo(g2, n3, 'reemplazar').max[0]));
    // Hora que no estaba guardada: todo de la nueva.
    const g4 = { v: Float32Array.from([NaN]), m: Uint8Array.from([CODIGO.SIN_ARCHIVO]), b: new Uint8Array(1) };
    assert.equal(fusionarCrudo(g4, n2, 'completar').max[0], 310);
    assert.equal(fusionarCrudo({ ...guardado, max: undefined }, { ...nuevo, max: undefined }, 'completar').max, undefined);
  });
  test('empaque: un extra todo vacío no se guarda; lotes también por bytes', () => {
    const s = { v: new Float32Array(3), m: new Uint8Array(3), b: new Uint8Array(3), max: new Float32Array(3).fill(NaN), min: Float32Array.from([1, 2, 3]) };
    const e = empaquetar(s);
    assert.equal(e.max, undefined); assert.equal(e.min.length, 12);
    const doc = (k) => ({ niveles: { N13_8: { fam: { IR: { v: new Uint8Array(k), m: new Uint8Array(k / 4), b: new Uint8Array(k / 4) } } } } });
    const docs = [doc(400000), doc(400000), doc(400000), doc(4000)];
    assert.ok(tamanoDoc(docs[0]) > 400000);
    assert.deepEqual(planLotes(docs, 8, 1000000).map((l) => l.length), [1, 1, 2]);   // ~600 KB cada uno: no caben dos por lote
    assert.ok(planLotes(docs, 8, 1000000).every((l) => l.reduce((t, d) => t + tamanoDoc(d), 0) <= 1000000 || l.length === 1));
    assert.deepEqual(planLotes(docs.slice(3).concat(docs.slice(3)), 8, 1000000).map((l) => l.length), [2]);
  });
  test('el rango une los extras de cada mes; al VER se ocultan topes, horas sin promedio válido e imposibles', () => {
    const { acc, p } = procesar(carpeta());
    const doc = docSerie(CID, '2026-03', acc.puntos.get(CID), p.niveles);
    const g = guardadoDe(doc);
    const w = ventanaDeMes('2026-03');
    const rec = recortarRango({ '2026-03': { estado: 'ok', series: g.niveles.N13_8.fam } }, ['IR', 'IS', 'IT'], w.desde, w.hasta);
    assert.equal(rec.fam.IR.max[3], 312);
    const vis = extrasVisibles(rec.fam, 13.8, 400);
    assert.ok(Number.isNaN(vis.series.IR.max[7]));   // 32767: tope del sistema
    assert.ok(Number.isNaN(vis.series.IR.max[5]));   // la hora 5 trae la bandera Invalid: el promedio no es válido
    assert.equal(vis.series.IR.max[3], 312); assert.equal(vis.series.IS.min[3], 285);
    assert.ok(vis.ocultos >= 2); assert.equal(vis.hay.max, true); assert.equal(vis.hay.ins, true);
    // Corriente por encima de 3 × la ampacidad: escala imposible, no se muestra.
    assert.equal(extrasVisibles(rec.fam, 13.8, 100).series.IR.max, undefined);   // todos > 300 A: ninguno se muestra
    // Tensión fuera de [0,5; 1,5] × kV.
    const u = { URS: { v: Float32Array.from([13.9, 13.8]), m: new Uint8Array([CODIGO.VALIDO, CODIGO.VALIDO]), max: Float32Array.from([14.2, 138]) } };
    const vu = extrasVisibles(u, 13.8);
    assert.equal(vu.series.URS.max[0].toFixed(1), '14.2'); assert.ok(Number.isNaN(vu.series.URS.max[1]));
    // Una caída de tensión dentro de la hora SÍ se muestra (es lo que el mínimo enseña); una negativa no.
    const caida = extrasVisibles({ URS: { v: Float32Array.from([13.9, 13.8]), m: new Uint8Array(2), min: Float32Array.from([0, -1]) } }, 13.8);
    assert.equal(caida.series.URS.min[0], 0); assert.ok(Number.isNaN(caida.series.URS.min[1]));
    // Guardado pero todo oculto: se distingue de «no guardado».
    const oculto = extrasVisibles(rec.fam, 13.8, 50);   // tope 150 A: todas las corrientes quedan ocultas
    assert.equal(oculto.hay.max, undefined); assert.equal(oculto.guardados.max, true);
  });
});
