// «Salud y riesgo» con letra más grande en el Excel (`99 §115`, el Ingeniero,
// 2026-09-28: «procede» a agrandar el texto pequeño). Cada texto se mide con los
// anchos REALES de Arial (`anchos-arial.js`): con un promedio por letra,
// «Riesgo tolerable» salía más chico que antes (revisión adversarial).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { anchoArial } from '../assets/js/ui/fichas/anchos-arial.js';
import { svgSaludRiesgo } from '../assets/js/ui/fichas/salud-riesgo-excel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLORES = ['#1B8E3F', '#F5C518', '#EF7820', '#E53935'];
const VEREDICTOS = [
  // Los rótulos REALES de COLORES_CELDA (`matriz_riesgo.js`).
  ['Riesgo tolerable', 'Verde (OK) · MO.00418 Tabla 11'],
  ['Atención', 'Amarillo (atención) · MO.00418 Tabla 11'],
  ['Riesgo alto', 'Naranja (alta) · MO.00418 Tabla 11'],
  ['Riesgo crítico', 'Roja (crítica) · MO.00418 Tabla 11']
];
const modelo = (veredicto, sub, extra = {}) => ({
  titulo: 'Salud del activo y posición en la matriz de riesgo · SUBESTACION EJEMPLO A · T1-EJ-A',
  kpis: [
    { valor: '3', sub: 'Medio', etiqueta: 'Condición del activo' },
    { valor: '148.532', sub: 'criticidad Máxima', etiqueta: 'Usuarios aguas abajo' },
    { valor: '149,5', sub: 'MVA · banda ≥ 50 MVA', etiqueta: 'Capacidad comprometida' },
    { valor: veredicto, sub, etiqueta: 'Veredicto de riesgo' }
  ],
  definicion: 'Condición 3 · Medio. El activo, no el plan, fija la ventana de salida; el deterioro todavía se frena dentro del ciclo vigente. La criticidad separa el seguimiento de la intervención prioritaria.',
  columnas: ['Mínima', 'Menor', 'Moderada', 'Mayor', 'Máxima'].map((l, i) => ({ etiqueta: (i + 1) + ' · ' + l, rango: ['1–29.706 · 40 eq.', '29.707–59.412 · 20 eq.', '59.413–89.118 · 12 eq.', '89.119–118.824 · 7 eq.', '118.825–148.532 · 5 eq.'][i] })),
  filas: [1, 2, 3, 4, 5].map((f) => ({ nombre: ['1 · Muy bueno', '2 · Bueno', '3 · Medio', '4 · Pobre', '5 · Muy pobre'][f - 1], celdas: [0, 1, 2, 3, 4].map((i) => ({ hex: COLORES[(f + i) % 4], tinta: '#ffffff', aqui: f === 3 && i === 4 })) })),
  marca: { mva: '149,5 MVA', usuarios: '148.532 usuarios', punto: 5 }, hayMarca: true,
  leyenda: COLORES.map((hex, i) => ({ hex, texto: VEREDICTOS[i][0] })),
  puntos: [1, 2, 3, 4, 5], potenciaLeyenda: 'Tamaño del punto: potencia (< 5 MVA … ≥ 50 MVA)',
  avisoDato: '', ...extra
});
/** Cada texto del dibujo con su posición, tamaño, peso y ancla, y la escala con que entra al marco (1226 × 611). */
function textos(svg) {
  const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const escala = Math.min(1226 / W, 611 / H);
  const t = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
    x: +m[1], tam: +m[3], negrita: /font-weight/.test(m[4]), medio: /text-anchor="middle"/.test(m[4]),
    texto: m[5].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  }));
  return { W, H, escala, t };
}
// En papel la hoja sale al 70 %: pt = px × escala × 0,7 × 0,75.
const pt = (px, escala) => px * escala * 0.7 * 0.75;
// Antes (5855d48): dibujo de 1600 de ancho, limitado por el ancho ⇒ escala 1226/1600.
const ESCALA_ANTES = 1226 / 1600;

describe('Ancho real de un texto en Arial', () => {
  test('letra por letra (Helvetica/Arial, milésimas del tamaño) con 2 % de holgura', () => {
    // R722 i278 e556 s556 g611 o611 ␠278 t333 o611 l278 e556 r389 a556 b611 l278 e556 = 7780 (negrita)
    assert.equal(Math.round(anchoArial('Riesgo tolerable', 1000, true)), Math.round(7780 * 1.02));
    assert.equal(Math.round(anchoArial('148.532', 1000, false)), Math.round((6 * 556 + 278) * 1.02));
    // Con tilde o eñe, el ancho de su letra base; la «í» de Arial es más ancha que la «i».
    assert.equal(anchoArial('Ñá', 100, false), anchoArial('Na', 100, false));
    assert.ok(anchoArial('í', 100, false) > anchoArial('i', 100, false));
    // Una letra desconocida se cuenta ancha (nunca se queda corta).
    assert.equal(Math.round(anchoArial('✓', 1000, false)), 1020);
    assert.equal(anchoArial('', 20, true), 0);
    assert.equal(anchoArial(null, 20, true), 0);
    // Texto descompuesto (tilde suelta tras la letra): mide lo mismo que el compuesto.
    assert.equal(anchoArial('N\u0303a\u0301', 100, true), anchoArial('Ñá', 100, true));
    // El «·» con el ancho de Arial (333), no el de Helvetica (278).
    assert.equal(Math.round(anchoArial('·', 1000, false)), Math.round(333 * 1.02));
  });
});

describe('«Salud y riesgo»: letra más grande que antes y nada se sale', () => {
  for (const [veredicto, sub] of VEREDICTOS) {
    test('veredicto «' + veredicto + '»: sale igual o más grande que antes y la letra más chica pasa de ~5,2 a ≥ 6,5 pt', () => {
      const { t, escala } = textos(svgSaludRiesgo(modelo(veredicto, sub)).svg);
      const v = t.find((x) => x.texto === veredicto && x.tam > 20);
      assert.ok(v, 'está el veredicto');
      // Antes: 38 px fijos a escala 1226/1600.
      assert.ok(v.tam * escala >= 38 * ESCALA_ANTES - 0.01, veredicto + ': ' + v.tam + ' px × ' + escala.toFixed(3));
      // Su subtítulo, igual o más grande que antes (16 px a escala 1226/1600).
      const s = t.find((x) => x.texto === sub);
      assert.ok(s.tam * escala >= 16 * ESCALA_ANTES - 0.01, sub + ': ' + s.tam + ' px');
      const minimo = Math.min(...t.map((x) => pt(x.tam, escala)));
      assert.ok(minimo >= 6.5, 'la letra más chica sale a ' + minimo.toFixed(2) + ' pt');
    });
  }

  test('las tarjetas: cifra, subtítulo y título caben en su tarjeta', () => {
    for (const [veredicto, sub] of VEREDICTOS) {
      const m = modelo(veredicto, sub);
      const { W, t } = textos(svgSaludRiesgo(m).svg);
      const kw = (W - 2 * 20 - 14 * 3) / 4;
      const deTarjeta = new Set(m.kpis.flatMap((k) => [k.valor, k.sub, k.etiqueta]));
      // Las tarjetas van antes que la leyenda (que repite el veredicto): la primera vez de cada texto.
      const primero = new Map();
      for (const y of t) if (deTarjeta.has(y.texto) && !primero.has(y.texto)) primero.set(y.texto, y);
      const vistos = [...primero.values()];
      assert.equal(vistos.length, deTarjeta.size);
      for (const x of vistos) assert.ok(anchoArial(x.texto, x.tam, x.negrita) <= kw - 24 + 0.01, x.texto + ' a ' + x.tam + ' px no cabe');
    }
  });

  test('ningún texto pasa del borde derecho del dibujo, ni con aviso, sin dato o con un título largo', () => {
    const casos = [
      modelo(...VEREDICTOS[0], { avisoDato: 'Ojo con el dato de usuarios. 148.532 usuarios aguas abajo para un transformador de 2,5 MVA: más de 50.000 usuarios por MVA; revise el dato en Salud de Activos antes de firmar.' }),
      modelo('—', 'falta condición o usuarios', { marca: null, hayMarca: false, avisoSinDato: 'Este equipo no se puede situar en la matriz. Falta el número de usuarios aguas abajo: sin ese dato no hay posición que mostrar, y una casilla marcada al azar sería peor que ninguna.' }),
      modelo(...VEREDICTOS[3], { titulo: 'Salud del activo y posición en la matriz de riesgo · SUBESTACIÓN EL CARMEN DE BOLÍVAR NUEVA 110/34,5/13,8 KV · MWM-110-34.5-000123' })
    ];
    for (const m of casos) {
      const { W, t } = textos(svgSaludRiesgo(m).svg);
      for (const x of t.filter((y) => !y.medio)) {
        assert.ok(x.x + anchoArial(x.texto, x.tam, x.negrita) <= W - 20 + 0.5, '«' + x.texto.slice(0, 50) + '» se sale: ' + x.x + ' + ' + anchoArial(x.texto, x.tam, x.negrita).toFixed(1));
      }
    }
  });

  test('con el aviso de dato de usuarios (el dibujo crece) casi nada baja: veredicto ≥ 95 % de antes y la letra más chica ≥ 6,3 pt', () => {
    // Condición 5 con 1 usuario y ≥ 20 MVA: cae en Mínima (amarillo) y sale el aviso (revisión §115, ronda 2).
    const aviso = 'Dato de usuarios a confirmar: 1 usuario aguas abajo para un transformador de 30 MVA no es coherente; revise el dato en Salud de Activos antes de firmar esta ficha.';
    for (const [veredicto, sub] of VEREDICTOS) {
      const { t, escala } = textos(svgSaludRiesgo(modelo(veredicto, sub, { avisoDato: aviso })).svg);
      const v = t.find((x) => x.texto === veredicto && x.tam > 20);
      assert.ok(v.tam * escala >= 0.95 * 38 * ESCALA_ANTES, veredicto + ' con aviso');
      const minimo = Math.min(...t.map((x) => pt(x.tam, escala)));
      assert.ok(minimo >= 6.3, 'con aviso, la letra más chica sale a ' + minimo.toFixed(2) + ' pt (antes 5,2)');
    }
  });

  test('un título de largo habitual sale igual o más grande que antes', () => {
    const titulo = 'Salud del activo y posición en la matriz de riesgo · SUBESTACION EL CARMEN DE BOLIVAR · T1-M/M-CAZ';
    const { t, escala } = textos(svgSaludRiesgo(modelo(...VEREDICTOS[3], { titulo })).svg);
    const x = t.find((y) => y.texto === titulo);
    assert.ok(x.tam * escala >= 22 * ESCALA_ANTES - 0.01, x.tam + ' px × ' + escala.toFixed(3));
  });

  test('las etiquetas de columna y la marca caben en su casilla', () => {
    const { W, t } = textos(svgSaludRiesgo(modelo(...VEREDICTOS[3])).svg);
    const cw = (W - 2 * 20 - 290) / 5;
    for (const x of t.filter((y) => y.medio)) assert.ok(anchoArial(x.texto, x.tam, x.negrita) <= cw - 10 + 0.01, x.texto);
    const mva = t.find((x) => x.texto === '149,5 MVA'); const usu = t.find((x) => x.texto === '148.532 usuarios');
    assert.ok(anchoArial(mva.texto, mva.tam, true) <= cw - 54 + 0.01);
    assert.ok(anchoArial(usu.texto, usu.tam, false) <= cw - 54 + 0.01);
  });
});

describe('En la PANTALLA tampoco salen los dos párrafos (`99 §115`)', () => {
  const panel = readFileSync(resolve(__dirname, '..', 'assets', 'js', 'ui', 'fichas', 'panel.js'), 'utf8');
  const i = panel.indexOf('function hojaSaludRiesgo('); const j = panel.indexOf('function modeloSaludRiesgo(');
  test('la pestaña «Salud y riesgo» no pinta la «Lectura por potencia» ni «La casilla sale de la norma…»', () => {
    assert.ok(i > 0 && j > i);
    const cuerpo = panel.slice(i, j).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(cuerpo, /ftm-sr-lectura|Lectura por potencia|La casilla sale de la norma/);
    assert.match(cuerpo, /ftm-sr-leyenda/, 'la leyenda sigue');
  });
  test('el modelo del Excel sigue definiendo lo que usa para la lectura por potencia (su ausencia rompía la exportación)', () => {
    const k = panel.indexOf('\n  }\n', j);
    const cuerpo = panel.slice(j, k);
    if (/nivelPot\b/.test(cuerpo)) assert.match(cuerpo, /const nivelPot = /);
  });
});
