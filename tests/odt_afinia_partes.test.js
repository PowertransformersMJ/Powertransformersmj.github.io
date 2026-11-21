// Firma de ODT Afinia · partir/unir el PDF en partes de ≤ 900 KB (exacto, con huellas) y
// presupuesto al publicar (v0 + 2 imágenes ≤ 5 × 900 KB). Bytes SINTÉTICOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  partir, unir, huella, huellasDePartes, prepararPartes, unirVerificado, presupuesto, partesPara, esPdf,
  TOPE_PARTE, PARTES_MAX, TOPE_PRESUPUESTO
} from '../assets/js/domain/odt_afinia_partes.js';

const KB = 1024;
const sha = (b) => createHash('sha256').update(b).digest('hex');
/** Bytes sintéticos que empiezan como PDF, de `n` bytes, con contenido variable. */
function pdfFalso(n) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) & 0xff;
  b.set([0x25, 0x50, 0x44, 0x46, 0x2d].slice(0, n)); // %PDF-
  return b;
}

describe('topes', () => {
  test('900 KB por parte, 5 partes', () => {
    assert.equal(TOPE_PARTE, 900 * KB);
    assert.equal(PARTES_MAX, 5);
    assert.equal(TOPE_PRESUPUESTO, 5 * 900 * KB);
  });
});

describe('partir / unir: exacto', () => {
  for (const n of [1, 5, 900 * KB - 1, 900 * KB, 900 * KB + 1, 2 * 900 * KB + 123, 5 * 900 * KB]) {
    test(n + ' bytes', () => {
      const b = pdfFalso(n);
      const ps = partir(b);
      assert.equal(ps.length, partesPara(n));
      assert.ok(ps.every((p) => p.length <= TOPE_PARTE && p.length > 0));
      const u = unir(ps);
      assert.equal(u.length, n);
      assert.equal(sha(u), sha(b));
    });
  }
  test('las partes son COPIAS (vaciar el original no las toca)', () => {
    const b = pdfFalso(1000);
    const ps = partir(b);
    const antes = sha(ps[0]);
    b.fill(0);
    assert.equal(sha(ps[0]), antes);
    assert.notEqual(ps[0].buffer, b.buffer);
  });
  test('vacío o más de 5 partes: lanza', () => {
    assert.throws(() => partir(new Uint8Array(0)), /nada/);
    assert.throws(() => partir(pdfFalso(5 * 900 * KB + 1)), /máximo es 5 partes/);
  });
  test('acepta ArrayBuffer', () => {
    const b = pdfFalso(3000);
    assert.equal(sha(unir(partir(b.buffer))), sha(b));
  });
});

describe('huellas', () => {
  test('huella = SHA-256 hex, igual a la de node:crypto', async () => {
    const b = pdfFalso(4321);
    assert.equal(await huella(b), sha(b));
  });
  test('prepararPartes: partes, huellas por parte, huella del total y tamaño', async () => {
    const b = pdfFalso(2 * 900 * KB + 10);
    const p = await prepararPartes(b);
    assert.equal(p.partes.length, 3);
    assert.deepEqual(p.huellasPartes, p.partes.map(sha));
    assert.equal(p.huella, sha(b));
    assert.equal(p.bytes, b.length);
    await assert.rejects(prepararPartes(new Uint8Array([1, 2, 3, 4, 5, 6])), /no es un PDF/);
  });
  test('con 1 parte la huella del total es la de la parte', async () => {
    const p = await prepararPartes(pdfFalso(5000));
    assert.equal(p.huella, p.huellasPartes[0]);
  });
  test('unirVerificado: pasa con todo en orden; lanza con una parte cambiada, faltante o tamaño distinto', async () => {
    const b = pdfFalso(900 * KB + 50);
    const p = await prepararPartes(b);
    const u = await unirVerificado(p.partes, p);
    assert.equal(sha(u), sha(b));
    const mala = p.partes.map((x) => x.slice()); mala[1][3] ^= 1;
    await assert.rejects(unirVerificado(mala, p), /parte 1/);
    await assert.rejects(unirVerificado([p.partes[0]], p), /Faltan partes/);
    await assert.rejects(unirVerificado(p.partes, { ...p, bytes: p.bytes + 1 }), /tamaño/);
    await assert.rejects(unirVerificado(p.partes, { ...p, huella: '0'.repeat(64) }), /no coincide con su huella/);
    assert.deepEqual(await huellasDePartes(p.partes), p.huellasPartes);
  });
  test('esPdf mira %PDF-', () => {
    assert.equal(esPdf(pdfFalso(10)), true);
    assert.equal(esPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false);
  });
});

describe('presupuesto al publicar: v0 + 2 imágenes ≤ 5 × 900 KB', () => {
  test('una ODT típica (≈ 380 KB) cabe y ocupa 1 parte', () => {
    assert.deepEqual(presupuesto(380 * KB), { ok: true, partes: 1, total: 380 * KB + 2 * 900 * KB, tope: 5 * 900 * KB });
  });
  test('justo en el tope pasa; un byte más no', () => {
    const max = 5 * 900 * KB - 2 * 900 * KB;
    assert.equal(presupuesto(max).ok, true);
    assert.equal(presupuesto(max).partes, 3);
    const r = presupuesto(max + 1);
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /pasaría de/);
  });
  test('con imágenes declaradas más chicas el tope cambia', () => {
    assert.equal(presupuesto(3.5 * 900 * KB, { imagenMax: 512 * KB }).ok, true);
    assert.equal(presupuesto(3.5 * 900 * KB).ok, false);
  });
  test('vacío no', () => {
    assert.equal(presupuesto(0).ok, false);
    assert.equal(presupuesto(NaN).ok, false);
  });
});
