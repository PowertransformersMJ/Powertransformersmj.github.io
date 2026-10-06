// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · dónde reposan las guardadas
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Pedido del Ingeniero (2026-10-06): «me permites seleccionar en
// guardar orden, pero no logro apreciar donde reposan … quiero que me
// permita apreciarlas, verlas o descargarlas posterior a guardarlas».
// Las órdenes viven en el registro del equipo (Firestore, `§77`) y la
// lista estaba al final de la página con solo «Abrir» y «Eliminar».
// Estas pruebas fijan que la lista se encuentra y que cada orden se
// puede ver y descargar sin cargarla en el formulario.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/ordenes-materiales.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');

describe('las órdenes guardadas se encuentran', () => {
  test('la barra de arriba tiene «Órdenes guardadas» con su cuenta', () => {
    assert.match(html, /id="btnGuardadas"[\s\S]{0,600}Órdenes guardadas <b class="cuenta" id="cntGuardadas">/);
  });
  test('la sección dice qué es y dónde reposan', () => {
    assert.match(html, /Órdenes guardadas · registro del equipo<\/h2>/);
    assert.match(html, /Aquí reposan las órdenes guardadas en la base de datos de la plataforma/);
    assert.match(html, /Las que se guardaron sin conexión aparecen como «Pendiente»/);
  });
  test('el botón lleva a la lista', () => {
    assert.match(js, /function irAGuardadas\(ev\) \{[\s\S]{0,200}\$\('#panelRegistro'\)[\s\S]{0,900}window\.scrollTo\(\{ top: Math\.max\(0, y\)/);
    assert.match(js, /if \(btnG\) btnG\.addEventListener\('click', irAGuardadas\);/);
    // Es un enlace: sin JS (o con el JS viejo en caché, L-85) el ancla sola lleva a la sección.
    assert.match(html, /<a class="oms-btn" id="btnGuardadas" href="#panelRegistro"/);
  });
  test('el botón NO vuelve a leer el registro en cada clic (cuota gratuita)', () => {
    assert.match(js, /if \(REGISTRO\.estado !== 'ok' && REGISTRO\.estado !== 'cargando'\) cargarRegistro\(false\);/);
  });
  test('el teclado llega con la vista: se enfoca el título de la sección', () => {
    assert.match(html, /<h2 id="tituloGuardadas" tabindex="-1">/);
    assert.match(js, /t\.focus\(\{ preventScroll: true \}\)/);
  });
  test('al guardar, el aviso dice dónde quedó y la orden se resalta', () => {
    assert.match(js, /REGISTRO\.recien = \{ clave: orden\.clave, en: Date\.now\(\) \};/);
    assert.match(js, /Date\.now\(\) - REGISTRO\.recien\.en < 10 \* 60000/);   // dura unos minutos
    assert.match(js, /La encuentra en «Órdenes guardadas»/);
    assert.match(js, /item-orden\$\{recien \? ' recien' : ''\}/);
  });
});

describe('cada orden guardada se ve y se descarga sin tocar el formulario', () => {
  for (const [dato, texto] of [['data-ver', 'Ver'], ['data-pdf', 'PDF'], ['data-excel', 'Excel'], ['data-abrir', 'Editar']]) {
    test(`la fila trae «${texto}»`, () => assert.match(js, new RegExp(`${dato}="\\$\\{esc\\(o\\.clave\\)\\}"[^>]*>${texto}</button>`)));
  }
  test('Ver, PDF y Excel usan la orden escogida (no leen el formulario) y avisan si falla', () => {
    assert.match(js, /verla \? abrirVistaPrevia\(o\) : pdf \? exportarPDF\(o\) : exportarExcel\(o\)\)\.catch\(/);
  });
  test('cada botón dice de qué orden es (lector de pantalla)', () => {
    for (const t of ['Ver la orden', 'Descargar en PDF la orden', 'Descargar en Excel la orden', 'Editar la orden']) {
      assert.match(js, new RegExp(`aria-label="${t} \\$\\{nom\\}"`));
    }
  });
  test('las órdenes pendientes (sin conexión) también se ven y se descargan', () => {
    assert.match(js, /function filasPendientes\(zona\)/);
    for (const d of ['data-pver', 'data-ppdf', 'data-pexcel']) assert.match(js, new RegExp(`${d}="\\$\\{i\\}"`));
    assert.match(js, /cont\.innerHTML = pend \+ visibles\.map/);
    assert.match(js, /if \(REGISTRO\.estado !== 'ok'\) \{ cont\.innerHTML = pend; return; \}/);
  });
  test('con el HTML viejo en caché (L-85) el botón y la cuenta nuevos se buscan con guarda', () => {
    assert.doesNotMatch(js, /\$\('#btnGuardadas'\)\.onclick/);
    assert.doesNotMatch(js, /\$\('#cntGuardadas'\)\.textContent/);
  });
});
