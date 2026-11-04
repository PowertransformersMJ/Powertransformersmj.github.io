// Cargabilidad SCADA — medida de un nivel por DIFERENCIA DE BARRA (pedido del Ingeniero 2026-11-04, `99 §208`), con datos
// SINTÉTICOS de la estación «EstDemo1»: dos transformadores comparten la barra de 66 kV; el T2 no tiene medida propia que
// sirva y su corriente sale de la barra = salidas (dos líneas y dos bancos de condensadores) − el T1, con P y Q.
// Lo que se exige: la resta FASORIAL (la de magnitudes inventa cientos de amperios con los bancos), las reglas hora por hora
// (hueco, salida abierta, restado puenteado o fuera del todo, tensión de respaldo, escala por hora), la guarda de sentidos
// SIN falsas alarmas cuando el T2 toma carga real, el piso de exactitud y su rótulo «≈ 0», el cuadre con la medida propia
// sobre el piso, el derivado aparte por el camino REAL del importador (L-118) y la cifra en la lista, y que la validación
// al guardar atrape cada error.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIF, especDiferenciaNivel, firmaDiferencia, componerDiferencia, revisarSentidos, sobrePiso, escalaFueraDeBanda, dentroDelPiso
} from '../assets/js/domain/scada_carga_diferencia.js';
import {
  SUMA, especSuma, claveSuma, objetivoConSumas, derivadosDelMes, componerSerieMes, componerResumen, estadoSumaNivel, derivadoDeMeses,
  erroresSuma, aliasTocaSuma, textoSuma, claveEnSumaAjena, cuadreSuma
} from '../assets/js/domain/scada_carga_suma.js';
import { crearAcumulador, acumularArchivo, armarMeses, procesarPuntoMes } from '../assets/js/domain/scada_carga_importacion.js';
import { fusionarHomologacion, leerFilasHomologacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { claveId } from '../assets/js/domain/scada_carga_csv.js';
import { CODIGO } from '../assets/js/domain/scada_carga_config.js';
import { filasLista } from '../assets/js/domain/scada_carga_vista.js';

const R3 = Math.sqrt(3);
const U0 = 67.45;
const iDe = (P, Q, U = U0) => 1000 * Math.hypot(P, Q) / (R3 * U);
const SAL = ['EDM601', 'EDM602', 'EDMBC1', 'EDMBC2'];   // dos líneas y dos bancos de la barra de 66 kV de EstDemo1
const CFG = { salidas: SAL, restar: ['swTrafo1'], invertir_p: [], invertir_q: ['EDMBC1', 'EDMBC2'],
  sentido_p: { swTrafo1: -1, EDM601: 1, EDM602: 1 }, sentido_q: { swTrafo1: -1, EDM601: 1, EDM602: 1, EDMBC1: -1, EDMBC2: -1 },
  barra_solo_estos: true, verificado: '2026-10' };
const SP = especDiferenciaNivel(CFG, 'EstDemo1', 'N66', 'S');

// ── Fixture de familias (sin el importador) ────────────────────────────────────
const N = 48;
function serie(val, cod) {
  const v = new Float32Array(N); const m = new Uint8Array(N); const b = new Uint8Array(N);
  for (let h = 0; h < N; h++) { const x = val(h); v[h] = x == null ? NaN : x; m[h] = cod(h); }
  return { v, m, b };
}
/**
 * Familias de una bahía: su P y Q por hora, la corriente que les corresponde (`fases` = factor por fase) y su tensión.
 * `abierta(h)` = corrientes en 9 y P = Q = 0; `cod(h, fam)` = código forzado; `facPQ(h)` = P y Q multiplicadas.
 */
function bahia(pq, op = {}) {
  const ab = (h) => !!(op.abierta && op.abierta(h));
  const U = (h) => (op.U ? op.U(h) : U0);
  const c = (h, F) => (op.cod ? op.cod(h, F) : null);
  const fam = {};
  ['IR', 'IS', 'IT'].forEach((F, k) => { fam[F] = serie((h) => (ab(h) ? 0 : (op.fases || [1, 1, 1])[k] * iDe(pq(h).P, pq(h).Q, U(h))), (h) => c(h, F) ?? (ab(h) ? CODIGO.DESENERGIZADO : 0)); });
  for (const F of ['URS', 'UST', 'UTR']) fam[F] = serie(U, (h) => c(h, F) ?? 0);
  const fac = (h) => (op.facPQ ? op.facPQ(h) : 1);
  fam.P = serie((h) => (ab(h) ? 0 : fac(h) * (op.signoP || 1) * pq(h).P), (h) => c(h, 'P') ?? 0);
  fam.Q = serie((h) => (ab(h) ? 0 : fac(h) * (op.signoQ || 1) * pq(h).Q), (h) => c(h, 'Q') ?? 0);
  return fam;
}
/** Carga de la barra por hora; los bancos ENTREGAN Q y el SCADA la da con el signo del generador (+). */
const carga = (h) => { const P1 = 20 + 8 * Math.sin(h / 4); const P2 = 12 + 3 * Math.cos(h / 5); return { P1, Q1: 0.5 * P1, P2, Q2: 0.4 * P2, Pb: 0.02, Qb: 3 }; };
const necesita = (h) => { const x = carga(h); return { P: x.P1 + x.P2 + 2 * x.Pb, Q: x.Q1 + x.Q2 - 2 * x.Qb }; };
/** La barra con el T2 llevando la fracción `s` de la carga (el T1 el resto); `mod` = opciones por elemento. */
function escenario(s = 0, mod = {}) {
  const fuera = s === 1 ? { abierta: () => true } : {};
  return {
    salidas: [
      bahia((h) => ({ P: carga(h).P1, Q: carga(h).Q1 }), mod.EDM601),
      bahia((h) => ({ P: carga(h).P2, Q: carga(h).Q2 }), mod.EDM602),
      bahia((h) => ({ P: carga(h).Pb, Q: carga(h).Qb }), mod.EDMBC1),
      bahia((h) => ({ P: carga(h).Pb, Q: carga(h).Qb }), mod.EDMBC2)],
    restar: [bahia((h) => ({ P: -(1 - s) * necesita(h).P, Q: -(1 - s) * necesita(h).Q }), { ...fuera, ...mod.swTrafo1 })],
    otrosRestar: [[bahia((h) => ({ P: (1 - s) * necesita(h).P, Q: (1 - s) * necesita(h).Q }), { U: () => 112, ...fuera, ...mod.alta })]],
    sp: SP, n: N
  };
}
const esperadaT2 = (s, h) => 1000 * s * Math.hypot(necesita(h).P, necesita(h).Q) / (R3 * U0);
/** La diferencia a mano en la hora h (P y Q de las familias, con sus signos), sin los elementos de `sin`. */
function aMano(esc, h, sin = []) {
  const els = [...SP.salidas.map((e, i) => [e, esc.salidas[i]]), ...SP.restar.map((e, i) => [e, esc.restar[i]])].filter(([e]) => !sin.includes(e));
  let dP = 0; let dQ = 0;
  for (const [e, f] of els) { dP -= f.P.v[h]; dQ -= (SP.invQ.includes(e.toLowerCase()) ? -1 : 1) * f.Q.v[h]; }
  return 1000 * Math.hypot(dP, dQ) / (R3 * U0);
}
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ': ' + a + ' frente a ' + b);

describe('la decisión: especDiferenciaNivel y la firma', () => {
  test('normaliza las listas y lleva su modo, sus cids y su firma con los sentidos', () => {
    assert.equal(SP.modo, 'diferencia');
    assert.deepEqual(SP.salidas, SAL); assert.deepEqual(SP.restar, ['swTrafo1']);
    assert.deepEqual(SP.elems, [...SAL, 'swTrafo1']);
    assert.deepEqual(SP.cidsRestar, [claveId('EstDemo1', 'swTrafo1')]);
    assert.deepEqual(SP.invQ, ['edmbc1', 'edmbc2']);
    assert.equal(SP.barraPropia, true); assert.deepEqual(SP.fases, ['IR', 'IS', 'IT']);
    assert.match(SP.firma, /^dif1\|N66\|S:edm601\+edm602\+edmbc1\+edmbc2\|R:swtrafo1\|iP:\|iQ:edmbc1\+edmbc2\|sP:edm601=1,edm602=1,swtrafo1=-1\|sQ:/);
    const otro = especDiferenciaNivel({ ...CFG, sentido_q: { ...CFG.sentido_q, EDM602: -1 } }, 'EstDemo1', 'N66', 'S');
    assert.notEqual(otro.firma, SP.firma, 'cambiar un sentido cambia la firma');
    assert.equal(especDiferenciaNivel({ ...CFG, salidas: ['EDM602', 'EDM601', 'edm601', 'EDMBC2', 'EDMBC1'] }, 'EstDemo1', 'N66', 'S').firma, SP.firma, 'el orden no la cambia');
    assert.equal(especDiferenciaNivel({ ...CFG, restar: [] }, 'EstDemo1', 'N66', 'S'), null);
    assert.equal(especDiferenciaNivel(CFG, 'EstDemo1', 'N66', null), null);
    assert.equal(firmaDiferencia('N66', {}), 'dif1|N66|S:|R:|iP:|iQ:|sP:|sQ:');
  });
});

describe('componerDiferencia: la resta fasorial y las reglas de cada hora', () => {
  test('bancos de condensadores: restar magnitudes da cientos de amperios falsos; la diferencia con P y Q, casi 0', () => {
    // Una hora como la real (anonimizada): el T1 alimenta toda la barra; los bancos entregan 8 Mvar cada uno.
    const uno = (P, Q) => { const f = {}; for (const F of ['IR', 'IS', 'IT']) f[F] = { v: Float32Array.of(iDe(P, Q)), m: Uint8Array.of(0), b: Uint8Array.of(0) };
      for (const F of ['URS', 'UST', 'UTR']) f[F] = { v: Float32Array.of(U0), m: Uint8Array.of(0), b: Uint8Array.of(0) };
      f.P = { v: Float32Array.of(P), m: Uint8Array.of(0), b: Uint8Array.of(0) }; f.Q = { v: Float32Array.of(Q), m: Uint8Array.of(0), b: Uint8Array.of(0) }; return f; };
    const sal = [uno(30.0, 15.0), uno(13.53, 6.1), uno(0.02, 8.0), uno(0.02, 8.0)]; const t1 = uno(-43.57, -5.6);
    const magnitudes = sal.reduce((a, f) => a + f.IR.v[0], 0) - t1.IR.v[0];
    assert.ok(magnitudes >= 150, 'la resta de magnitudes da ' + magnitudes.toFixed(1) + ' A');
    const c = componerDiferencia({ salidas: sal, restar: [t1], otrosRestar: [[]], sp: SP, n: 1 });
    assert.equal(c.fam.IR.m[0], 0);
    assert.ok(c.fam.IR.v[0] < 6, 'la diferencia da ' + c.fam.IR.v[0].toFixed(2) + ' A');
    assert.equal(c.fam.IS.v[0], c.fam.IR.v[0]); assert.equal(c.fam.IT.v[0], c.fam.IR.v[0]);
  });
  test('el T2 con 0, 30, 50, 70 y 100 % de la carga: la diferencia la recupera (error < 1 %) y los sentidos NO dan falsa alarma', () => {
    for (const s of [0, 0.3, 0.5, 0.7, 1]) {
      const c = componerDiferencia(escenario(s));
      assert.equal(c.sentidos.ok, true, 's = ' + s + ': ' + c.sentidos.fallan.join(', '));
      assert.equal(c.horas.completas, N, 's = ' + s);
      for (let h = 0; h < N; h++) {
        const e = esperadaT2(s, h);
        if (s === 0) assert.ok(c.fam.IR.v[h] < 0.05, 's = 0, hora ' + h + ': ' + c.fam.IR.v[h]);
        else cerca(c.fam.IR.v[h], e, 0.01 * e, 's = ' + s + ', hora ' + h);
      }
    }
  });
  test('los sentidos SÍ atrapan un signo volteado (T1 en P, un banco en Q, una línea en P): estado bloqueante', () => {
    assert.deepEqual(componerDiferencia(escenario(0.3, { swTrafo1: { signoP: -1 } })).sentidos.fallan, ['swTrafo1 (P)']);
    assert.deepEqual(componerDiferencia(escenario(0.3, { EDMBC1: { signoQ: -1 } })).sentidos.fallan, ['EDMBC1 (Q)']);
    assert.deepEqual(componerDiferencia(escenario(0.3, { EDM601: { signoP: -1 } })).sentidos.fallan, ['EDM601 (P)']);
    // Con menos de 24 horas en servicio no se juzga (el T1 fuera casi todo el mes: aunque su signo esté volteado).
    const casi = componerDiferencia(escenario(0.3, { swTrafo1: { signoP: -1, abierta: (h) => h >= 20 }, alta: { abierta: (h) => h >= 20 } }));
    assert.equal(casi.sentidos.ok, true);
    assert.deepEqual(revisarSentidos({}, SP), { ok: true, fallan: [] });
  });
  test('reglas de la hora: hueco, salida abierta, restado puenteado o fuera del todo, tensión de respaldo, todo fuera, congelado', () => {
    const esc = escenario(0.3, {
      EDM601: { cod: (h, F) => (h === 5 && F === 'P' ? CODIGO.BANDERA : (h === 15 && F === 'Q' ? CODIGO.CONGELADO : (h === 13 && F[0] === 'U' ? CODIGO.BANDERA : null))), abierta: (h) => h === 14 },
      EDM602: { abierta: (h) => h === 6 || h === 14, cod: (h, F) => (h === 13 && F[0] === 'U' ? CODIGO.BANDERA : null) },
      EDMBC1: { abierta: (h) => h === 14, cod: (h, F) => (h === 13 && F[0] === 'U' ? CODIGO.BANDERA : null) },
      EDMBC2: { abierta: (h) => h === 14, cod: (h, F) => (h === 13 && F[0] === 'U' ? CODIGO.BANDERA : null) },
      swTrafo1: { abierta: (h) => h === 10 || h === 11 || h === 14, cod: (h, F) => ((h === 12 || h === 13) && F[0] === 'U' ? CODIGO.BANDERA : null) },
      alta: { abierta: (h) => h === 11 || h === 14 }
    });
    const c = componerDiferencia(esc);
    const I = c.fam.IR;
    assert.equal(I.m[5], CODIGO.BANDERA, '(a) falta P de una salida → hueco con su código, nunca una diferencia parcial');
    assert.equal(I.m[6], 0, '(b) salida abierta aporta 0');
    cerca(I.v[6], aMano(esc, 6, ['EDM602']), 0.01, '(b)');
    assert.equal(I.m[10], CODIGO.CERO, '(c) el restado marca 0 en 66 kV mientras su 110 kV lleva carga → hueco (el 9 se anota 6)');
    assert.equal(I.m[11], 0, '(d) el restado fuera en TODOS sus devanados aporta 0');
    cerca(I.v[11], aMano(esc, 11, ['swTrafo1']), 0.01, '(d)');
    assert.equal(I.m[12], 0, '(e) sin tensión en el restado, la de un banco');
    assert.equal(I.m[13], CODIGO.BANDERA, '(e) sin tensión en ninguna bahía → hueco');
    assert.equal(I.m[14], CODIGO.DESENERGIZADO, '(f) todo fuera → fuera de servicio');
    assert.equal(I.v[14], 0);
    assert.equal(I.m[15], CODIGO.CONGELADO, '(h) Q congelada → hueco');
    assert.deepEqual(c.horas, { total: N, completas: N - 5, abiertas: 1, fueraServicio: 1, hueco: 4, restadoPuenteado: 1, escala: 0 });
    // Las tensiones del nivel son las del restado (copias): el desequilibrio de tensión es el real.
    assert.equal(c.fam.URS.m[12], CODIGO.BANDERA); assert.equal(c.fam.UST.v[0], esc.restar[0].UST.v[0]);
    assert.notEqual(c.fam.URS.v, esc.restar[0].URS.v, 'una copia, no la misma serie');
    // P y Q del nivel = la diferencia.
    cerca(-c.fam.P.v[20], 0.3 * necesita(20).P, 1e-3, 'P = ΔP');
  });
  test('escala por hora: P y Q ×1000 en 10 h → hueco con código 7; en más de la mitad → bloquea; una fase ×2 en el TC solo avisa', () => {
    const sano = componerDiferencia(escenario(0.3));
    const kw = componerDiferencia(escenario(0.3, { EDM601: { facPQ: (h) => (h >= 20 && h < 30 ? 1000 : 1) } }));
    for (let h = 0; h < N; h++) {
      if (h >= 20 && h < 30) assert.equal(kw.fam.IR.m[h], CODIGO.FUERA_ESCALA, 'hora ' + h);
      else assert.equal(kw.fam.IR.v[h], sano.fam.IR.v[h], 'hora ' + h);
    }
    assert.equal(kw.horas.escala, 10); assert.equal(kw.bloqueaEscala, false);
    assert.equal(componerDiferencia(escenario(0.3, { EDM601: { facPQ: (h) => (h < 30 ? 1000 : 1) } })).bloqueaEscala, true);
    const tc = componerDiferencia(escenario(0.3, { EDM601: { fases: [1, 2, 1] } }));
    assert.equal(tc.horas.escala, 0, 'la razón 1,33 no quita la hora (la diferencia no usa esa corriente)');
    assert.deepEqual(escalaFueraDeBanda(tc.escalaMes), ['EDM601 (1,33)']);
    assert.deepEqual(escalaFueraDeBanda(sano.escalaMes), []);
  });
  test('piso de exactitud y «≈ 0»: dentro del piso con el T2 en vacío; fuera con el 30 % de la barra', () => {
    const vacio = componerDiferencia(escenario(0)); const conCarga = componerDiferencia(escenario(0.3));
    assert.ok(vacio.piso.A > 0 && vacio.piso.flujoP99A > 0);
    const p99 = (c) => [...c.fam.IR.v].sort((a, b) => a - b)[Math.ceil(0.99 * N) - 1];
    assert.equal(dentroDelPiso(p99(vacio), vacio.piso), true);
    assert.equal(dentroDelPiso(p99(conCarga), conCarga.piso), false);
    assert.equal(dentroDelPiso(null, vacio.piso), false);
    assert.ok(conCarga.parte.p > 20, 'lo que se atribuye al T2 es su parte, no un error: ' + conCarga.parte.p);
  });
  test('cuadre con la medida propia SOLO sobre el piso: ruido contra ruido no da un «no cuadra» falso', () => {
    const vacio = componerDiferencia(escenario(0));
    const propia = (f) => { const x = bahia((h) => ({ P: 0, Q: 0 })); for (const F of ['IR', 'IS', 'IT']) for (let h = 0; h < N; h++) x[F].v[h] = f(h); return x; };
    assert.equal(cuadreSuma(sobrePiso(vacio.fam, vacio.piso.A), propia(() => 1)).veredicto, 'sin_contraste');
    const carga30 = componerDiferencia(escenario(0.3));
    assert.equal(cuadreSuma(sobrePiso(carga30.fam, carga30.piso.A), propia((h) => esperadaT2(0.3, h))).veredicto, 'ok');
    assert.equal(cuadreSuma(sobrePiso(carga30.fam, carga30.piso.A), propia((h) => 2 * esperadaT2(0.3, h))).veredicto, 'no_cuadra');
    const invalida = propia(() => 5); for (const F of ['IR', 'IS', 'IT']) invalida[F].m.fill(CODIGO.BANDERA);
    assert.equal(cuadreSuma(sobrePiso(carga30.fam, carga30.piso.A), invalida).veredicto, 'sin_contraste');
  });
});

// ── Camino REAL del importador (L-118): CSV → acumular → armar → procesar → derivados → lista ─────────────────────────
const MV = 'Mv' + 'Moment';
const pad = (x) => String(x).padStart(2, '0');
const cab = (d, m, a) => ',' + Array.from({ length: 24 }, (_, h) => d + '/' + pad(m) + '/' + String(a).slice(2) + ' ' + h + ':00').join(',');
const filaCsv = (nivel, elem, tok, vals) => '/' + 'EstDemo1'.padEnd(8) + '/' + nivel.padEnd(8) + '/' + elem.padEnd(8) + '/' + tok.padEnd(8) + '/' + MV + ',' + vals.join(',');
const txt = (x) => (x == null ? 'null' : x.toFixed(4));
const S_T2 = 0.3;
/** Valores de una hora: todo varía un poco (la limpieza marca «congelado» un valor que no cambia en 6 h). */
function horaReal(idx) {
  const U = (k) => U0 + 0.3 * Math.sin(idx / 7 + k);
  const P1 = 20 + 8 * Math.sin(idx / 9) + 0.05 * (idx % 7); const P2 = 12 + 3 * Math.cos(idx / 11) + 0.03 * (idx % 5);
  const Q1 = 0.5 * P1; const Q2 = 0.4 * P2; const Qb = 3 + 0.05 * Math.sin(idx / 3); const Pb = 0.02 + 0.001 * (idx % 5);
  const nP = P1 + P2 + 2 * Pb; const nQ = Q1 + Q2 - 2 * Qb;
  const b = (P, Q, k) => ({ 'I R': iDe(P, Q, U(k)), 'I S': iDe(P, Q, U(k)) * 1.002, 'I T': iDe(P, Q, U(k)) * 0.998, 'U RS': U(k), 'U ST': U(k) + 0.1, 'U TR': U(k) - 0.1, P, Q });
  return {
    '66kV': {
      EDM601: b(P1, Q1, 1), EDM602: b(P2, Q2, 2), EDMBC1: b(Pb, Qb, 3), EDMBC2: b(Pb, Qb, 4),
      swTrafo1: b(-(1 - S_T2) * nP, -(1 - S_T2) * nQ, 0),
      // La medida propia del T2 en 66 kV no sirve: sin corriente ni potencia (solo tensión).
      swTrafo2: { 'I R': null, 'I S': null, 'I T': null, 'U RS': U(5), 'U ST': U(5), 'U TR': U(5), P: null, Q: null }
    },
    '110kV': { swTrafo1: { ...b((1 - S_T2) * nP * 1.003, (1 - S_T2) * nQ * 1.05, 6), 'U RS': 112 + 0.2 * Math.sin(idx / 5), 'U ST': 112.1 + 0.2 * Math.sin(idx / 5), 'U TR': 111.9 + 0.2 * Math.sin(idx / 5) } }
  };
}
const MES = '2026-03';
function archivosMes() {
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const porHora = Array.from({ length: 24 }, (_, h) => horaReal((d - 1) * 24 + h));
    const lineas = [cab(d, 3, 2026)];
    for (const nivel of Object.keys(porHora[0])) for (const elem of Object.keys(porHora[0][nivel])) for (const tok of Object.keys(porHora[0][nivel][elem])) {
      lineas.push(filaCsv(nivel, elem, tok, porHora.map((x) => txt(x[nivel][elem][tok]))));
    }
    out.push({ nombre: 'x_average-202603' + pad(d) + '.csv', ruta: 'Mes/' + pad(d), texto: lineas.join('\n') });
  }
  return out;
}
const aoa = [['SUBESTACION', 'MATRICULA', 'swTrafo'], ['DEMO UNO', 'T1-X/X-DM1', '/EstDemo1/swTrafo1'], ['DEMO UNO', 'T2-X/X-DM1', '/EstDemo1/swTrafo2']];
const base = fusionarHomologacion(leerFilasHomologacion(aoa).filas, null).filas;
const [F1, F2] = Object.keys(base).sort((a, b) => (base[a].matricula < base[b].matricula ? -1 : 1));
const CID1 = claveId('EstDemo1', 'swTrafo1'); const CID2 = claveId('EstDemo1', 'swTrafo2');
const dec = (clave, mapa, extra = {}) => ({ tipo: 'usar', clave, mapa, niveles_vistos: Object.keys(mapa), nota: 'prueba de diferencia EstDemo1', clave_excel_vista: clave, avisos_vistos: [], ...extra });
const FILAS = {
  [F1]: { ...base[F1], decision: dec('/EstDemo1/swTrafo1', { N110: 'P', N66: 'S' }) },
  [F2]: { ...base[F2], decision: dec('/EstDemo1/swTrafo2', { N66: 'S' }, { diferencia: { N66: CFG } }) }
};
const txDe = (mat, A) => ({ id: mat, identificacion: { matricula: mat }, ubicacion: { subestacion_nombre: 'DEMO UNO', zona: 'ORIENTE' }, placa: { potencia_kva: 60000 },
  electrico: { tension_primaria_kv: 110, tension_secundaria_kv: 66, corriente_nominal_primaria_a: 315, corriente_nominal_secundaria_a: A } });
const A2 = 525;

function cargar(filas) {
  const acc = crearAcumulador();
  const obj = objetivoConSumas(filas);
  for (const a of archivosMes()) acumularArchivo(acc, { nombre: a.nombre, ruta: a.ruta, texto: a.texto, tamano: a.texto.length }, obj);
  const armados = armarMeses(acc, [MES]).get(MES);
  const porCid = {}; const resumen = {}; const puntos = {};
  for (const [cid, nuevo] of armados) {
    const p = procesarPuntoMes(nuevo, null, 'completar');
    resumen[cid] = p.resumen; porCid[cid] = { niveles: p.niveles };
    const meta = acc.puntos.get(cid);
    puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [MES] };
  }
  return { porCid, resumen, puntos };
}
const CARGA = cargar(FILAS);
const DER = derivadosDelMes({ mes: MES, porCid: CARGA.porCid, filas: FILAS });
const catalogo = { meses: { [MES]: { completo: true } }, puntos: CARGA.puntos };
const claves = { ...CARGA.resumen, ...DER };
const lista = (cl = claves, hom = FILAS, cat = catalogo) => filasLista({ parque: [txDe('T1-X/X-DM1', 525), txDe('T2-X/X-DM1', A2)], homologacion: { filas: hom }, catalogo: cat, resumenMes: { mes: MES, claves: cl } });
const filaT2 = (cl, hom, cat) => lista(cl, hom, cat).find((x) => x.matricula === 'T2-X/X-DM1');

describe('el camino real: importador → derivado aparte → lista', () => {
  test('el objetivo de la importación trae las salidas y el restado; especSuma lleva el nivel en modo diferencia', () => {
    const s = especSuma(FILAS[F2]);
    assert.equal(s.cid, CID2); assert.equal(s.porNivel.N66.modo, 'diferencia');
    for (const e of [...SAL, 'swTrafo1']) assert.ok(CARGA.porCid[claveId('EstDemo1', e)], e + ' llegó');
    assert.equal(especSuma(FILAS[F1]), null, 'el T1 no tiene suma ni diferencia');
  });
  test('el derivado del mes: tipo, versión, firma, huellas del T2 y del restado, horas, sentidos y veredicto', () => {
    const r = DER[claveSuma(CID2)].N66; const d = r.derivado;
    assert.equal(d.tipo, DIF.tipo); assert.equal(d.v, DIF.version); assert.equal(d.firma, SP.firma); assert.equal(d.estado, 'ok');
    assert.deepEqual(d.restar, ['swTrafo1']);
    assert.ok(d.base_r && d.base_r[CID1] && d.base_r[CID1].n > 700, 'huella del restado');
    assert.equal(d.horas.completas, 744); assert.equal(d.horas.restadoPuenteado, 0);
    assert.equal(d.sentidos.ok, true, (d.sentidos.fallan || []).join(', '));
    assert.equal(d.veredicto, 'sin_contraste', 'la medida propia del T2 no sirve: sin contraste');
    assert.ok(r.i.n >= 740 && r.i.p99 > 50, 'el resumen del nivel derivado: ' + r.i.n + ' h, p99 ' + r.i.p99);
    assert.equal(CARGA.resumen[CID2].N66.i.n, 0, 'la medida propia del T2 queda como vino');
  });
  test('la lista: el T2 tiene cifra provisional por diferencia de barra (≈ 30 % de la barra), el T1 no cambia', () => {
    const x = filaT2();
    const esperada = 100 * claves[claveSuma(CID2)].N66.i.p99 / A2;
    assert.ok(x.pct != null && Math.abs(x.pct - esperada) < 0.5, 'cifra ' + x.pct + ' frente a ' + esperada);
    assert.equal(x.clase, 'provisional');
    assert.ok(x.motivos.some((m) => /la diferencia de barra no se pudo contrastar con la medida propia del transformador/.test(m)), x.motivos.join(' · '));
    assert.ok(!x.motivos.some((m) => /≈ 0/.test(m)), 'con carga real no lleva el rótulo «≈ 0»');
    assert.ok(JSON.stringify(x).includes('66 kV · diferencia de barra'), 'el rótulo del nivel');
    assert.match(x.suma.texto, /^Secundario por diferencia de barra: EDM601 \+ EDM602 \+ EDMBC1 \+ EDMBC2 − swTrafo1 \(P y Q\)$/);
    const t1 = lista().find((y) => y.matricula === 'T1-X/X-DM1');
    const t1Sin = lista(CARGA.resumen, { [F1]: FILAS[F1] }).find((y) => y.matricula === 'T1-X/X-DM1');
    assert.equal(t1.pct, t1Sin.pct, 'el T1 da lo mismo con y sin la diferencia del T2');
  });
  test('el candado de lectura: restado recargado distinto → desfasado; otra firma; otra versión; otro transformador en la barra', () => {
    const sp = especSuma(FILAS[F2]).porNivel.N66;
    const otraHuella = { ...claves, [CID1]: { ...claves[CID1], N66: { ...claves[CID1].N66, i: { ...claves[CID1].N66.i, p99: 1 } } } };
    assert.equal(componerResumen(otraHuella, CID2, FILAS[F2]).N66.derivado.estado, 'desfasado');
    assert.equal(componerResumen(claves, CID2, FILAS[F2]).N66, claves[claveSuma(CID2)].N66, 'con todo en orden, el derivado guardado');
    const otroSentido = { ...FILAS[F2], decision: dec('/EstDemo1/swTrafo2', { N66: 'S' }, { diferencia: { N66: { ...CFG, sentido_q: { ...CFG.sentido_q, EDM602: -1 } } } }) };
    assert.equal(componerResumen(claves, CID2, otroSentido).N66.derivado.estado, 'otra_firma');
    const viejo = { ...claves, [claveSuma(CID2)]: { N66: { ...claves[claveSuma(CID2)].N66, derivado: { ...claves[claveSuma(CID2)].N66.derivado, v: 99 } } } };
    assert.equal(estadoSumaNivel(viejo[claveSuma(CID2)].N66, sp).estado, 'otra_version');
    // D5: el restado y la propia medida no cuentan; un TERCER transformador que mide 66 kV, sí.
    assert.equal(componerResumen(claves, CID2, FILAS[F2], catalogo.puntos).N66.derivado.estado, 'ok');
    const con3 = { ...catalogo.puntos, [claveId('EstDemo1', 'swTrafo3')]: { est: 'EstDemo1', elem: 'swTrafo3', niveles: { N66: true } } };
    const r3 = componerResumen(claves, CID2, FILAS[F2], con3).N66.derivado;
    assert.equal(r3.estado, 'barra_compartida'); assert.deepEqual(r3.otros, ['swTrafo3']);
    assert.match(estadoSumaNivel({ derivado: r3 }, sp).motivo, /la barra puede tener otra entrada y la diferencia de barra no se puede usar/);
  });
  test('las curvas al leer (detalle) dan el mismo derivado que el importador', () => {
    const spec = especSuma(FILAS[F2]);
    const circuitos = Object.fromEntries(spec.porNivel.N66.cids.map((c) => [c, CARGA.porCid[c]]));
    const r = componerSerieMes({ mes: MES, trafo: CARGA.porCid[CID2], circuitos, spec, guardadas: claves });
    assert.deepEqual(r.derivado.N66, DER[claveSuma(CID2)].N66.derivado);
    assert.equal(r.serie.niveles.N66.fam.IR.v.length, 744);
  });
  test('sentidos que cambiaron: el mes queda SIN cifra (también en el periodo), con su motivo', () => {
    const sp = especSuma(FILAS[F2]).porNivel.N66;
    const volteado = { ...CARGA.porCid, [CID1]: { niveles: { ...CARGA.porCid[CID1].niveles, N66: { ...CARGA.porCid[CID1].niveles.N66,
      fam: { ...CARGA.porCid[CID1].niveles.N66.fam, P: { ...CARGA.porCid[CID1].niveles.N66.fam.P, v: CARGA.porCid[CID1].niveles.N66.fam.P.v.map((x) => -x) } } } } } };
    const der = derivadosDelMes({ mes: MES, porCid: volteado, filas: FILAS });
    const r = der[claveSuma(CID2)].N66;
    assert.equal(r.derivado.estado, 'sentidos'); assert.deepEqual(r.derivado.sentidos.fallan, ['swTrafo1 (P)']);
    assert.deepEqual(r.i, { n: 0 }, 'sin resumen de cifra');
    const x = filaT2({ ...claves, [claveSuma(CID2)]: der[claveSuma(CID2)] });
    assert.equal(x.pct, null);
    assert.match(x.motivoNulo || '', /el sentido de la potencia de swTrafo1 \(P\) cambió frente al verificado/);
    const per = derivadoDeMeses([{ mes: '2026-02', derivado: DER[claveSuma(CID2)].N66.derivado }, { mes: MES, derivado: r.derivado }], sp);
    assert.equal(per.estado, 'sentidos'); assert.deepEqual(per.sentidos.fallan, ['swTrafo1 (P)']);
    assert.match(estadoSumaNivel({ i: { n: 0 }, derivado: per }, sp).motivo, /swTrafo1 \(P\)/);
  });
  test('derivadoDeMeses: todos bien → ok con lo peor; un mes sin derivado → falta; suma las horas propias de la diferencia', () => {
    const sp = especSuma(FILAS[F2]).porNivel.N66;
    const d = DER[claveSuma(CID2)].N66.derivado;
    const ok = derivadoDeMeses([{ mes: '2026-02', derivado: { ...d, horas: { ...d.horas, restadoPuenteado: 2, escala: 1 } } }, { mes: MES, derivado: d }], sp);
    assert.equal(ok.estado, 'ok'); assert.equal(ok.tipo, DIF.tipo); assert.equal(ok.veredicto, 'sin_contraste');
    assert.equal(ok.horas.completas, 2 * 744); assert.equal(ok.horas.restadoPuenteado, 2); assert.equal(ok.horas.escala, 1);
    assert.equal(ok.piso.A, d.piso.A);
    const falta = derivadoDeMeses([{ mes: '2026-02', derivado: null }, { mes: MES, derivado: d }], sp);
    assert.equal(falta.estado, 'falta'); assert.deepEqual(falta.meses, ['2026-02']);
    assert.match(estadoSumaNivel({ derivado: falta }, sp).motivo, /^falta calcular la diferencia de barra de febrero/);
  });
  test('T2 en vacío: la cifra lleva el rótulo «≈ 0 (dentro del error de la diferencia)» y la clase no cambia', () => {
    const sp = especSuma(FILAS[F2]).porNivel.N66;
    const d = DER[claveSuma(CID2)].N66;
    const vacio = { ...d, i: { ...d.i, p99: d.derivado.piso.A - 0.1 } };
    const e = estadoSumaNivel(vacio, sp);
    assert.equal(e.estado, 'ok'); assert.equal(e.casiCero, true);
    assert.match(e.aviso, /no se pudo contrastar con la medida propia del transformador · ≈ 0 \(dentro del error de la diferencia, piso \d+,?\d* A\)$/);
    assert.equal(estadoSumaNivel(d, sp).casiCero, false);
  });
});

describe('al guardar: erroresSuma con diferencia, claveEnSumaAjena, alias y textos', () => {
  const puntos = catalogo.puntos;
  const errDe = (cfg, extra = {}) => erroresSuma(FILAS[F2], dec('/EstDemo1/swTrafo2', { N66: 'S' }, { diferencia: { N66: cfg }, ...extra }), { filas: FILAS, puntos, filaId: F2 });
  test('la decisión buena se puede guardar', () => {
    assert.deepEqual(errDe(CFG), []);
  });
  test('cada error de la lista', () => {
    const tiene = (cfg, re, extra) => { const e = errDe(cfg, extra); assert.ok(e.some((x) => re.test(x)), re + ' → ' + e.join(' | ')); };
    tiene({ ...CFG, restar: ['EDM699'] }, /no es un transformador: solo se resta un transformador/);
    tiene({ ...CFG, salidas: [...SAL, 'swTrafo3'] }, /es un transformador: va en «restar»/);
    tiene({ ...CFG, salidas: [...SAL, 'swTrafo2'] }, /es la propia medida del transformador/);
    tiene({ ...CFG, salidas: ['EDM601', 'edm601 '] }, /está repetido/);
    tiene({ ...CFG, salidas: [...SAL, '/EstDemo2/EDM601'] }, /es de otra estación/);
    tiene({ ...CFG, salidas: [...SAL, 'EDM6/01'] }, /no es el nombre de una bahía/);
    tiene({ ...CFG, salidas: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] }, /más de 8 elementos/);
    tiene({ ...CFG, invertir_q: ['EDMBC9'] }, /El signo invertido de Q de «EDMBC9» no es de una bahía/);
    tiene({ ...CFG, sentido_p: { EDM699: 1 } }, /El sentido de P de «EDM699» no es de una bahía/);
    tiene({ ...CFG, sentido_p: { EDM601: 2 } }, /debe ser 1 o −1/);
    tiene({ ...CFG, barra_solo_estos: false }, /no tiene más bahías que las de la diferencia \(casilla obligatoria\)/);
    tiene({ ...CFG, salidas: [] }, /al menos una bahía de salida/);
    tiene(CFG, /a la vez por suma de circuitos y por diferencia de barra/, { suma: { N66: { de: ['EDM601'], fases: ['IR', 'IS', 'IT'], barra_propia: true } } });
    tiene(CFG, /trae medidas anteriores/, { previas: [{ hasta: '2026-01' }] });
    assert.ok(erroresSuma(FILAS[F2], dec('/EstDemo1/swTrafo2', {}, { diferencia: { N66: CFG } }), { filas: FILAS, puntos, filaId: F2 })
      .some((x) => /no está asignado a ningún devanado/.test(x)));
    // Una salida que es la medida de otra fila, o que ya está en la suma de otra fila.
    const otraFila = { X: { ...base[F1], id: 'X', matricula: 'T9-X/X-DM1', clave_excel: '/EstDemo1/EDM601', decision: dec('/EstDemo1/EDM601', { N66: 'S' }) } };
    assert.ok(erroresSuma(FILAS[F2], FILAS[F2].decision, { filas: { ...FILAS, ...otraFila }, puntos, filaId: F2 }).some((x) => /«EDM601» es la medida de otra fila \(T9-X\/X-DM1\)/.test(x)));
    // D5: un tercer transformador que mide 66 kV y no está en la diferencia.
    const con3 = { ...puntos, [claveId('EstDemo1', 'swTrafo3')]: { est: 'EstDemo1', elem: 'swTrafo3', niveles: { N66: true } } };
    assert.ok(erroresSuma(FILAS[F2], FILAS[F2].decision, { filas: FILAS, puntos: con3, filaId: F2 }).some((x) => /swTrafo3.*no está en la diferencia/.test(x)));
  });
  test('claveEnSumaAjena: el restado sigue siendo la medida de SU fila; una salida no puede ser la medida de otra', () => {
    assert.equal(claveEnSumaAjena('/EstDemo1/swTrafo1', FILAS, F1), null);
    assert.equal(claveEnSumaAjena('/EstDemo1/EDM601', FILAS, 'otra'), 'T2-X/X-DM1');
  });
  test('un alias sobre el restado o sobre una salida detiene la carga (es lo deseado)', () => {
    assert.throws(() => aliasTocaSuma([{ est: 'EstDemo1', de: 'swTrafo1', a: 'swTrafo1F' }], FILAS), /el alias lo cambiaría/);
    assert.throws(() => aliasTocaSuma([{ est: 'EstDemo1', de: 'EDMBC1', a: 'EDMBC9' }], FILAS), /el alias lo cambiaría/);
    assert.doesNotThrow(() => aliasTocaSuma([{ est: 'EstDemo1', de: 'swTrafo7', a: 'swTrafo8' }], FILAS));
  });
  test('textoSuma de un nivel con su derivado: lo que se atribuye, el piso y el cuadre con la medida propia', () => {
    const t = textoSuma(especSuma(FILAS[F2]), 'N66', { derivado: DER[claveSuma(CID2)].N66.derivado });
    assert.match(t, /^Secundario por diferencia de barra: .* · lo que se atribuye a este transformador: P \d+,\d\d % · Q \d+,\d\d % del flujo de la barra · piso de exactitud \d+,\d A$/);
  });
});

describe('L-102 y no regresión', () => {
  test('el archivo nuevo solo importa exportaciones ya publicadas (líneas exactas) y no importa la suma', () => {
    const src = readFileSync(new URL('../assets/js/domain/scada_carga_diferencia.js', import.meta.url), 'utf8');
    const imp = [...src.matchAll(/^import \{([^}]+)\} from '(\.[^']+)';/gm)].map((m) => m[2] + ':' + m[1].split(',').map((x) => x.trim()).sort().join(','));
    assert.deepEqual(imp.sort(), [
      './scada_carga_config.js:CODIGO,CODIGOS_VALIDOS,FAMILIAS_I,FAMILIAS_U,NIVELES',
      './scada_carga_csv.js:claveId,esElementoTransformador,normalizarTexto',
      './scada_carga_kpis.js:percentilOrdenado'
    ]);
  });
  test('sin decision.diferencia, especSuma no cambia (sin «modo») y una suma de circuitos sigue igual', () => {
    const suma = { ...FILAS[F1], decision: dec('/EstDemo1/swTrafo1', { N66: 'S' }, { suma: { N66: { de: ['EDM601', 'EDM602'], fases: ['IR', 'IS', 'IT'], barra_propia: true } } }) };
    const s = especSuma(suma).porNivel.N66;
    assert.equal(s.modo, undefined); assert.equal(s.firma, 'v' + SUMA.version + '|N66|estdemo1__edm601+estdemo1__edm602|IR,IS,IT');
    assert.deepEqual(Object.keys(s), ['nivel', 'devanado', 'elems', 'cids', 'fases', 'firma', 'barraPropia']);
  });
});
