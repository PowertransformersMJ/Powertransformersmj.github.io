// Cargabilidad SCADA — MES CASI SIN MEDIDA (decisión del Ingeniero 2026-10-28: Maracayo T1, su medida murió el 26-jun), con
// datos SINTÉTICOS («EstDemo»). Lo que se exige: un mes que midió menos de 72 h, teniendo al menos 72 en servicio, cuenta como
// NO medido (no hunde la cobertura) y sigue exigiéndose la mitad de los meses; uno con menos de 72 h en servicio, o bien
// medido, cuenta como siempre; si es la regla nueva la que vuelve firme al equipo y la cifra o la sobrecarga dependen de esos
// meses, queda provisional. Igual en el detalle. Casos de la revisión adversarial 2026-10-28 incluidos.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estadisticas } from '../assets/js/domain/scada_carga_kpis.js';
import { firmezaDeMeses } from '../assets/js/domain/scada_carga_firmeza_periodo.js';
import { firmezaDelRango } from '../assets/js/domain/scada_carga_firmeza_rango.js';
import { mesCasiSinMedida, motivoMesCasiSinMedida, reglaDeAntes, MOTIVO_MES_CASI_SIN_MEDIDA } from '../assets/js/domain/scada_carga_mes_casi_sin_medida.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';
import { filasPeriodo } from '../assets/js/domain/scada_carga_periodo.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { TOP_HORAS } from '../assets/js/domain/scada_carga_importacion.js';
import { ventanaDeMes, horasMes } from '../assets/js/domain/scada_carga_series.js';
import { FAMILIAS, CODIGO } from '../assets/js/domain/scada_carga_config.js';

describe('la regla', () => {
  test('casi sin medida = midió algo, menos de 72 h, con al menos 72 h en servicio', () => {
    assert.equal(mesCasiSinMedida(30, 744), true);
    assert.equal(mesCasiSinMedida(30, 72), true);
    assert.equal(mesCasiSinMedida(70, 80), false, '70 de 80 h: poco servicio pero bien medido, no es una medida caída');
    assert.equal(mesCasiSinMedida(71, 100), false, 'midió más de la mitad de lo que estuvo en servicio');
    assert.equal(mesCasiSinMedida(72, 744), false, '72 h ya es un mes medido');
    assert.equal(mesCasiSinMedida(0, 744), false, 'sin ninguna hora es «no midió», como siempre');
    assert.equal(mesCasiSinMedida(30, 50), false, 'con menos de 72 h en servicio no podía medir más: cuenta como siempre');
  });
  test('firmezaDeMeses: no cuenta como medido ni hunde la cobertura', () => {
    const r = firmezaDeMeses([{ n: 600, servicio: 720 }, { n: 30, servicio: 744 }, { n: 10, servicio: 744 }, { n: 0, servicio: 0, horas: 0 }]);
    assert.equal(r.mesesMedidos, 1);
    assert.equal(r.coberturaFirmeza, 600 / 720);
    assert.equal(r.nMedido, 600);
  });
  test('con menos de 72 h en servicio el mes cuenta como siempre', () => {
    const r = firmezaDeMeses([{ n: 600, servicio: 720 }, { n: 30, servicio: 50 }]);
    assert.equal(r.mesesMedidos, 2);
    assert.equal(r.coberturaFirmeza, 630 / 770);
  });
  test('el motivo: solo si la regla nueva lo vuelve firme Y la cifra o la sobrecarga dependen de esos meses', () => {
    const d = (pct, pctSinMesesCasi, extra = {}) => ({ pct, A: 800, ...(pctSinMesesCasi !== undefined ? { pctSinMesesCasi } : {}), ...extra });
    const M = MOTIVO_MES_CASI_SIN_MEDIDA;
    assert.equal(motivoMesCasiSinMedida([d(60, 55)], 60, false), M);
    assert.equal(motivoMesCasiSinMedida([d(60, 55)], 60, true), null, 'con la regla de antes ya era firme (Puerto Escondido): nada cambia');
    assert.equal(motivoMesCasiSinMedida([d(60, 60)], 60, false), null, 'sin ellos la cifra es la misma');
    assert.equal(motivoMesCasiSinMedida([d(60, 60.00005)], 60, false), null, 'dentro del medio paso de redondeo');
    assert.equal(motivoMesCasiSinMedida([d(60, null)], 60, false), M, 'sin ellos no queda cifra');
    assert.equal(motivoMesCasiSinMedida([d(70), d(60, 50)], 70, false), null, 'el devanado que no da la cifra no cambia la cifra');
    assert.equal(motivoMesCasiSinMedida([d(70, 50), d(65)], 70, false), M, 'sin ellos la cifra pasa al otro devanado y baja');
    assert.equal(motivoMesCasiSinMedida([d(60)], 60, false), null, 'sin meses casi sin medida, nada');
    assert.equal(motivoMesCasiSinMedida([d(70), d(40, 40, { sobre: 1, sobreSinMesesCasi: 0 })], 70, false), M, 'la sobrecarga sale de esos meses');
    assert.equal(motivoMesCasiSinMedida([d(70), d(40, 40, { sobre: 1, sobreSinMesesCasi: 1 })], 70, false), null);
  });
  test('reglaDeAntes cuenta los meses casi sin medida como medidos', () => {
    assert.deepEqual(reglaDeAntes({ d: 'S', coberturaFirmeza: 0.8, mesesMedidos: 5, coberturaConCasi: 0.45, mesesMedidosConCasi: 9 }),
      { d: 'S', coberturaFirmeza: 0.45, mesesMedidos: 9, coberturaConCasi: 0.45, mesesMedidosConCasi: 9 });
    const x = { d: 'P', coberturaFirmeza: 0.9 };
    assert.equal(reglaDeAntes(x), x);
  });
  test('firmezaDeMeses deja la cobertura de la regla de antes solo si hubo meses casi sin medida', () => {
    const r = firmezaDeMeses([{ n: 600, servicio: 720 }, { n: 30, servicio: 744 }]);
    assert.equal(r.coberturaConCasi, 630 / 1464); assert.equal(r.mesesMedidosConCasi, 2);
    assert.equal('coberturaConCasi' in firmezaDeMeses([{ n: 600, servicio: 720 }]), false);
  });
});

// ── Periodo de la lista con UN nivel (13,8 kV → secundario, ampacidad 800 A) ─────────────────────────────────────────
const tx = { id: 'a', identificacion: { matricula: 'T1-X/X-DM1' }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' },
  electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 300, corriente_nominal_secundaria_a: 800 } };
const { filas } = fusionarHomologacion(leerFilasHomologacion([['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1']]).filas, null);
const cid = claveId('EstDemo1', 'swTrafo1');
const red = (x) => Math.round(x * 1000) / 1000;
/** Resumen de un nivel: `n` horas válidas de `base`–`base+39` A en un mes de 720 h en servicio. */
function nivelR(n, base = 400) {
  const v = Array.from({ length: n }, (_, h) => Math.fround(base + (h % 40)));
  const e = estadisticas(Float32Array.from(v));
  return { i: { n: e.n, p50: red(e.p50), p95: red(e.p95), p98: red(e.p98), p99: red(e.p99), max: red(e.max), iMax: 0, prom: red(e.prom), unaFalta: 0 },
    sost: null, horas: 720, servicio: 720, des: 0, cob: Math.round((n / 720) * 1000) / 1000, sMax: null, sP99: null,
    rUI: 1, uProm: 13.6, sP: 1, flujoInverso: 0, desde: 0, top: [...Float32Array.from([...v].sort((a, b) => b - a).slice(0, TOP_HORAS))] };
}
const MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
function periodoDe(porMes) {
  const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: { N13_8: {} }, meses: MESES } } };
  const resumenes = Object.fromEntries(MESES.map((m) => [m, { mes: m, claves: { [cid]: { N13_8: porMes[m] } } }]));
  const fpm = Object.fromEntries(MESES.map((m) => [m, filasLista({ parque: [tx], homologacion: { filas }, catalogo, resumenMes: resumenes[m] })]));
  return filasPeriodo({ parque: [tx], homologacion: { filas }, catalogo, meses: MESES, resumenes, filasPorMes: fpm })[0];
}

describe('periodo de la lista (el caso Maracayo: 5 meses bien medidos y 4 con la medida caída)', () => {
  test('los meses casi sin medida ya no hunden la cobertura: firme', () => {
    const p = periodoDe(Object.fromEntries(MESES.map((m, k) => [m, k < 5 ? nivelR(600) : nivelR(k === 8 ? 40 : 3)])));
    const s = p.devanados.find((d) => d.d === 'S');
    assert.equal(s.mesesMedidos, 5); assert.equal(s.mesesTotal, 9);
    assert.ok(s.coberturaFirmeza > 0.8, String(s.coberturaFirmeza));
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
  test('sigue exigiendo la mitad de los meses: 4 de 9 bien medidos → provisional', () => {
    const p = periodoDe(Object.fromEntries(MESES.map((m, k) => [m, k < 4 ? nivelR(600) : nivelR(20)])));
    assert.equal(p.firme, false);
    assert.ok(p.motivos.includes('midió menos de la mitad de los meses'), p.motivos.join('; '));
  });
  test('si la cifra sale de un mes casi sin medida → provisional con su motivo', () => {
    const p = periodoDe(Object.fromEntries(MESES.map((m, k) => [m, k < 5 ? nivelR(600) : nivelR(40, k === 6 ? 700 : 300)])));
    assert.equal(p.firme, false);
    assert.ok(p.motivos.includes(MOTIVO_MES_CASI_SIN_MEDIDA), p.motivos.join('; '));
  });
});

describe('el detalle cuenta igual (rango de meses completos)', () => {
  test('firmezaDelRango: el mes casi sin medida no cuenta y deja el p99 sin él', () => {
    const meses = ['2026-01', '2026-02', '2026-03'];
    const desde = ventanaDeMes(meses[0]).desde;
    const H = meses.reduce((a, m) => a + horasMes(m), 0);
    const fam = {};
    for (const f of FAMILIAS) {
      const v = new Float32Array(H).fill(NaN); const m = new Uint8Array(H).fill(CODIGO.SIN_ARCHIVO);
      fam[f] = { v, m, b: new Uint8Array(H) };
    }
    // Enero y febrero: 600 h válidas; marzo: 30 h válidas, el resto «Not Renewed» (en servicio, sin medida buena).
    let k0 = 0;
    meses.forEach((mes, i) => {
      const hm = horasMes(mes);
      for (let h = 0; h < hm; h++) {
        const buena = i < 2 ? h < 600 : h < 30;
        for (const f of FAMILIAS) {
          fam[f].v[k0 + h] = f[0] === 'I' ? Math.fround((i === 2 ? 600 : 400) + (h % 40)) : (f[0] === 'U' ? 13.8 + (h % 3) / 100 : 5 + (h % 7));
          fam[f].m[k0 + h] = buena ? CODIGO.VALIDO : CODIGO.BANDERA;
        }
      }
      k0 += hm;
    });
    const t = Float64Array.from({ length: H }, (_, h) => desde + h * 3600e3);
    const r = firmezaDelRango({ N13_8: { t, fam } }, [{ nivel: 'N13_8', devanado: 'S', A: 800 }], meses, desde);
    assert.equal(r.S.mesesMedidos, 2); assert.equal(r.S.mesesTotal, 3);
    assert.ok(r.S.sinMesesCasi.p99 < 440, String(r.S.sinMesesCasi.p99), 'sin marzo (600–639 A) el p99 es el de enero y febrero');
    assert.ok(r.S.sinMesesCasi.max < 440);
    assert.equal(r.S.mesesMedidosConCasi, 3);
  });
});

// ── Casos de la revisión adversarial 2026-10-28 con DOS niveles medidos ────────────────────────────────────────────
function periodo2(txX, porNivel) {
  const nvs = Object.keys(porNivel);
  const catalogo = { meses: Object.fromEntries(MESES.map((m) => [m, { completo: true }])), puntos: { [cid]: { niveles: Object.fromEntries(nvs.map((nv) => [nv, {}])), meses: MESES } } };
  const resumenes = Object.fromEntries(MESES.map((m, k) => [m, { mes: m, claves: { [cid]: Object.fromEntries(nvs.map((nv) => [nv, porNivel[nv][k]])) } }]));
  const fpm = Object.fromEntries(MESES.map((m) => [m, filasLista({ parque: [txX], homologacion: { filas }, catalogo, resumenMes: resumenes[m] })]));
  return filasPeriodo({ parque: [txX], homologacion: { filas }, catalogo, meses: MESES, resumenes, filasPorMes: fpm })[0];
}
const conSost = (r, v) => ({ ...r, sost: { v, idx: 0 } });

describe('revisión adversarial: el equipo completo y la sobrecarga', () => {
  test('dos devanados: una sobrecarga que solo traen los meses casi sin medida del otro devanado no sale firme', () => {
    // S da la cifra (~55 %) y mide bien los 9 meses; P (A = 400 A, ~50 %, relación 2,5 con S) mide 5 meses y 4 casi sin
    // medida, uno con una sostenida de 420 A (105 %). Con la regla de antes P «medía poco» y su sobrecarga dejaba
    // provisional; sin el resguardo, la regla nueva lo daba por firme con «sobrecarga sostenida».
    const tx2 = { ...tx, electrico: { ...tx.electrico, corriente_nominal_primaria_a: 400 } };
    const P = MESES.map((m, k) => (k < 5 ? nivelR(600, 160) : (k === 6 ? conSost(nivelR(30, 160), 420) : nivelR(30, 160))));
    const S = MESES.map(() => nivelR(600, 400));
    const p = periodo2(tx2, { N34_5: P, N13_8: S });
    assert.equal(p.firme, false);
    assert.ok(p.motivos.includes(MOTIVO_MES_CASI_SIN_MEDIDA), p.motivos.join('; '));
    // Control: sin esa sostenida, firme.
    const q = periodo2(tx2, { N34_5: MESES.map((m, k) => nivelR(k < 5 ? 600 : 30, 160)), N13_8: S });
    assert.equal(q.firme, true, q.motivos.join('; '));
  });
  test('tridevanado: la regla nueva rescata al primario, pero la cifra del secundario sale de sus meses casi sin medida', () => {
    const tx3 = { ...tx, electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 34.5, tension_terciaria_kv: 13.8,
      corriente_nominal_primaria_a: 200, corriente_nominal_secundaria_a: 600, corriente_nominal_terciaria_a: 800 } };
    const P = MESES.map((m, k) => nivelR(k < 5 ? 600 : 30, 80));
    const S = (alto) => MESES.map((m, k) => (k < 7 ? nivelR(600, 300) : nivelR(40, alto)));
    const p = periodo2(tx3, { N110: P, N34_5: S(380) });
    assert.ok(p.motivos.includes(MOTIVO_MES_CASI_SIN_MEDIDA), p.motivos.join('; '));
    // Control: si esos meses del secundario no suben la cifra, el resguardo no actúa.
    assert.ok(!periodo2(tx3, { N110: P, N34_5: S(300) }).motivos.includes(MOTIVO_MES_CASI_SIN_MEDIDA));
  });
  test('un equipo con poco servicio pero bien medido sigue firme (70 de 80 h no es una medida caída)', () => {
    const poco = { ...nivelR(70), servicio: 80, des: 640, cob: 0.875 };
    const p = periodoDe(Object.fromEntries(MESES.map((m, k) => [m, k < 2 ? nivelR(700) : poco])));
    const s = p.devanados.find((d) => d.d === 'S');
    assert.equal(s.mesesMedidos, 9);
    assert.equal(p.firme, true, p.motivos.join('; '));
  });
});
