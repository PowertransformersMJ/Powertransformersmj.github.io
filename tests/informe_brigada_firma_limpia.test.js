// Firma de un tercero en el Informe de Brigada (`99 §163.14`, L-145): limpieza del fondo igual que Fichas, y la
// firma estampada centrada bajo la fecha, con el mismo peso visual y dentro de su caja.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  FIRMA_LIMPIA, alfaDeFirma, limpiarFondo, recorteDeFirma, medidasDeTrabajo, pppImpresa, quitarVelo
} from '../assets/js/domain/informe_brigada_firma_limpia.js';
import { FIRMA_PORTADA, FIRMA_POSICION } from '../assets/js/domain/informe_brigada_documento.js';
import { anchoTextoPt } from '../assets/js/domain/informe_brigada_docx.js';
import { tamanoFirma } from '../assets/js/domain/firmas_tamano.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FICHAS = readFileSync(resolve(AQUI, '../assets/js/ui/fichas/firmas-equipo.js'), 'utf8');
const IMAGENES = readFileSync(resolve(AQUI, '../assets/js/ui/informe-brigada/imagenes.js'), 'utf8');
const PAPEL = readFileSync(resolve(AQUI, '../assets/js/ui/informe-brigada/papel.js'), 'utf8');

/** Imagen RGBA de prueba: fondo de luminancia `fondo` y un rectángulo de trazo de luminancia `tinta`. */
function imagen(W, H, { fondo = 252, tinta = 30, caja = [10, 5, 30, 14] } = {}) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = x >= caja[0] && x <= caja[2] && y >= caja[1] && y <= caja[3] ? tinta : fondo;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
  return d;
}

describe('firma limpia: la MISMA matemática de Fichas (L-145)', () => {
  test('los números son los de firmas-equipo.js (si Fichas cambia, esta prueba avisa)', () => {
    assert.match(FICHAS, /const ANCHO_MAX = 1200;/);
    assert.match(FICHAS, /const ALTO_MAX = 400;/);
    assert.match(FICHAS, /const TOPE_BYTES = 512 \* 1024;/);
    assert.match(FICHAS, /Math\.min\(1, 2400 \/ img\.naturalWidth\)/);
    assert.match(FICHAS, /lum >= 235 \? 0 : \(lum <= 120 \? 255 : Math\.round\(255 \* \(235 - lum\) \/ 115\)\)/);
    assert.match(FICHAS, /if \(a > 40\)/);
    assert.match(FICHAS, /Math\.round\(Math\.max\(maxX - minX, maxY - minY\) \* 0\.03\) \+ 2/);
    assert.deepEqual(
      [FIRMA_LIMPIA.claro, FIRMA_LIMPIA.oscuro, FIRMA_LIMPIA.alfaTrazo, FIRMA_LIMPIA.margen, FIRMA_LIMPIA.margenPx,
        FIRMA_LIMPIA.anchoTrabajo, FIRMA_LIMPIA.anchoMax, FIRMA_LIMPIA.altoMax, FIRMA_LIMPIA.tope],
      [235, 120, 40, 0.03, 2, 2400, 1200, 400, 512 * 1024]);
  });
  test('alfa: fondo claro transparente, tinta oscura plena, grises intermedios proporcionales', () => {
    assert.equal(alfaDeFirma(255, 255, 255), 0);
    assert.equal(alfaDeFirma(235, 235, 235), 0);
    assert.equal(alfaDeFirma(120, 120, 120), 255);
    assert.equal(alfaDeFirma(0, 0, 0), 255);
    assert.equal(alfaDeFirma(177, 177, 177), Math.round(255 * (235 - 177) / 115));
    assert.equal(alfaDeFirma(0, 0, 0, 100), 100, 'nunca sube el alfa que ya traía');
  });
  test('limpiarFondo: deja el fondo en alfa 0, conserva el color del trazo y da su caja', () => {
    const d = imagen(40, 20);
    const caja = limpiarFondo(d, 40, 20);
    assert.deepEqual(caja, { minX: 10, minY: 5, maxX: 30, maxY: 14 });
    assert.equal(d[3], 0);
    const i = (8 * 40 + 15) * 4;
    assert.deepEqual([d[i], d[i + 3]], [30, 255]);
  });
  test('sin trazo (todo claro) → null: la pantalla lo dice en vez de subir una imagen vacía', () => {
    assert.equal(limpiarFondo(imagen(20, 10, { tinta: 250 }), 20, 10), null);
  });
  test('recorte: margen de 3 % + 2 px, sin salirse de la imagen y SIN ampliar', () => {
    const r = recorteDeFirma({ minX: 10, minY: 5, maxX: 30, maxY: 14 }, 40, 20);
    // m = round(20 · 0,03) + 2 = 3
    assert.deepEqual(r, { x: 7, y: 2, w: 27, h: 16, ancho: 27, alto: 16 });
    const borde = recorteDeFirma({ minX: 6, minY: 0, maxX: 153, maxY: 101 }, 156, 110);   // caja medida del trazo de Johan
    assert.deepEqual([borde.x, borde.y, borde.w, borde.h, borde.ancho, borde.alto], [0, 0, 156, 108, 156, 108],
      'la firma de 156 × 110 (§163.12) sale de 156 × 108, como en Fichas');
  });
  test('una imagen enorme se acota a 1200 × 400 conservando la proporción', () => {
    const r = recorteDeFirma({ minX: 0, minY: 0, maxX: 2399, maxY: 599 }, 2400, 600);
    assert.ok(r.ancho <= 1200 && r.alto <= 400);
    assert.ok(Math.abs(r.ancho / r.alto - r.w / r.h) < 0.01);
    assert.deepEqual(medidasDeTrabajo(4800, 1000), { ancho: 2400, alto: 500 });
    assert.deepEqual(medidasDeTrabajo(572, 129), { ancho: 572, alto: 129 }, 'nunca agranda');
  });
  test('quitarVelo: lleva a 0 solo lo que no cuenta como trazo (alfa ≤ 40)', () => {
    const d = new Uint8ClampedArray([9, 9, 9, 40, 9, 9, 9, 41, 9, 9, 9, 3, 9, 9, 9, 255]);
    quitarVelo(d);
    assert.deepEqual([d[3], d[7], d[11], d[15]], [0, 41, 0, 255]);
  });
  test('el botón «Cargar firma» usa ESTA limpieza (guarda del código: si alguien vuelve al redibujo viejo, falla)', () => {
    const ini = IMAGENES.indexOf('export async function prepararFirma');
    const fin = IMAGENES.indexOf('export function prepararLogo');
    assert.ok(ini > 0 && fin > ini, 'prepararFirma antes de prepararLogo');
    const cuerpo = IMAGENES.slice(ini, fin);
    const pasos = ['FL.limpiarFondo(px.data, m0.ancho, m0.alto)', 'g0.putImageData(px, 0, 0)', 'FL.recorteDeFirma(caja, m0.ancho, m0.alto)',
      'drawImage(c0, r.x, r.y, r.w, r.h, 0, 0, r.ancho, r.alto)', 'FL.quitarVelo(px.data)', 'FL.pppImpresa(r.ancho, r.alto, FIRMA_PORTADA)'];
    let desde = 0;
    for (const p of pasos) { const k = cuerpo.indexOf(p, desde); assert.ok(k >= 0, 'falta o está fuera de orden: ' + p); desde = k; }
    assert.ok(!cuerpo.includes('prepararPng('), 'la firma ya no pasa por el redibujo viejo');
  });
  test('el papel centra la firma con firmaXPt (o con el centro de la fecha) y comprime un nombre largo ante ella', () => {
    assert.ok(PAPEL.includes('left:${PT(Number.isFinite(f.firmaXPt) ? f.firmaXPt : (FIRMA_POSICION.xCentro || 270.5) - tam.ancho / 2)}'));
    assert.ok(PAPEL.includes('const finNombre = f.firmaRef && Number.isFinite(f.firmaXPt) ? Math.min(XM - 3, f.firmaXPt - 3) : XM - 3;'));
  });
  test('ppp al imprimir: la de 156 px (Johan) pasa de 200; una de 60 px no', () => {
    assert.ok(pppImpresa(156, 108, FIRMA_PORTADA) > 250);
    assert.ok(pppImpresa(60, 40, FIRMA_PORTADA) < 200);
    assert.equal(pppImpresa(0, 10, FIRMA_PORTADA), 0);
  });
});

describe('firma estampada: centrada bajo la fecha, mismo peso visual, dentro de su caja (§163.14)', () => {
  test('el centro de la fecha «dd/mm/aaaa» está en x = 270,5 pt (medida de Arial Narrow 10)', () => {
    const anchoFecha = anchoTextoPt('16/10/2026', { tam: 10, negrita: false, angosta: true }) / 1.03;   // sin la holgura del 3 %
    assert.ok(Math.abs(FIRMA_POSICION.xFecha + anchoFecha / 2 - FIRMA_POSICION.xCentro) < 0.05, 'centro ' + (FIRMA_POSICION.xFecha + anchoFecha / 2));
  });
  test('la caja es de 92 × 26 pt y la superficie de 1600 pt² (opción A de su maqueta)', () => {
    assert.deepEqual({ ...FIRMA_PORTADA }, { area: 1600, altoMax: 26, anchoMax: 92 });
  });
  test('cualquier proporción: dentro de la caja, sin tocar la línea que divide la portada ni «Revisado por:»', () => {
    const XM = 321.6;                     // línea que divide la portada (papel.js)
    const yTextoSiguiente = 611.4 + 2.1;  // tinta de «Revisado por:» bajo la línea de «Elaborado» (la más estrecha)
    for (const rel of [0.3, 0.8, 1, 1.444, 2, 2.5, 3.453, 4.434, 6, 10, 25]) {
      const t = tamanoFirma(rel, FIRMA_PORTADA);
      const x = FIRMA_POSICION.xCentro - t.ancho / 2;
      assert.ok(t.ancho <= 92 + 1e-9 && t.alto <= 26 + 1e-9, `proporción ${rel}: ${t.ancho} × ${t.alto}`);
      assert.ok(t.ancho * t.alto <= 1600 + 1e-6, `proporción ${rel}: superficie`);
      assert.ok(x + t.ancho <= XM - 5 + 1e-9, `proporción ${rel}: a 5 pt o más de la división`);
      assert.ok(571.1 + FIRMA_POSICION.dyFirma + t.alto <= yTextoSiguiente - 4.9, `proporción ${rel}: lejos de «Revisado por:»`);
    }
  });
  test('las tres firmas reales del informe quedan con el mismo peso o topadas por el alto', () => {
    const [carlos, david, johan] = [625 / 181, 572 / 129, 156 / 108].map((r) => tamanoFirma(r, FIRMA_PORTADA));
    assert.ok(Math.abs(carlos.ancho * carlos.alto - 1600) < 1e-6 && Math.abs(david.ancho * david.alto - 1600) < 1e-6);
    assert.equal(johan.alto, 26, 'la casi cuadrada la topa el alto');
  });
});
