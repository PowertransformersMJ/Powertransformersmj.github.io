// Hoja «Salud y riesgo» en el Excel de Mantenimiento, en lugar del «Anexo AT»
// (`99 §107`, decisión del Ingeniero). El PI conserva su Anexo AT.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { leerLibroParaVista } from '../assets/js/ui/fichas/vista-previa-excel.js';
import { svgSaludRiesgo, cajaSaludRiesgo, AVISO_SIN_IMAGEN } from '../assets/js/ui/fichas/salud-riesgo-excel.js';
import { calcularRangosCriticidad, nivelPorUsuarios } from '../assets/js/domain/matriz_riesgo.js';
import { HOJAS_SALUD, HOJAS_FICHA } from '../assets/js/ui/fichas/panel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });
const EQ = { subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA', zona: 'OCCIDENTE', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3 };
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const COLORES = ['#1B8E3F', '#F5C518', '#EF7820', '#E53935'];
const MODELO = Object.freeze({
  titulo: 'Salud del activo y posición en la matriz de riesgo · SUBESTACION DE PRUEBA · T0-PRUEBA',
  kpis: [
    { valor: '3', sub: 'Medio', etiqueta: 'Condición del activo', tinta: '#EF7820', rol: 'fila 3 de la matriz' },
    { valor: '12.345', sub: 'criticidad Moderada', etiqueta: 'Usuarios aguas abajo', rol: 'columna Moderada' },
    { valor: '30', sub: 'MVA · banda 20 – 49,9 MVA', etiqueta: 'Capacidad comprometida', rol: 'se muestra: no mueve la casilla' },
    { valor: 'Riesgo alto', sub: 'Naranja (alta) · MO.00418 Tabla 11', etiqueta: 'Veredicto de riesgo', tinta: '#EF7820', rol: 'resultado de fila × columna' }
  ],
  definicion: 'Condición 3 · Medio. Definición de prueba.',
  columnas: ['Mínima', 'Menor', 'Moderada', 'Mayor', 'Máxima'].map((l, i) => ({ etiqueta: (i + 1) + ' · ' + l, rango: '1–2 · 3 eq.' })),
  filas: [1, 2, 3, 4, 5].map((f) => ({ nombre: f + ' · Fila', celdas: [0, 1, 2, 3, 4].map((i) => ({ hex: COLORES[(f + i) % 4], tinta: '#ffffff', aqui: f === 3 && i === 2 })) })),
  marca: { mva: '30 MVA', usuarios: '12.345 usuarios', punto: 4 }, hayMarca: true,
  leyenda: COLORES.map((hex, i) => ({ hex, texto: ['Riesgo tolerable', 'Atención', 'Riesgo alto', 'Riesgo crítico'][i] })),
  puntos: [1, 2, 3, 4, 5], potenciaLeyenda: 'Tamaño del punto: potencia (< 5 MVA … ≥ 50 MVA)',
  avisoDato: '', lectura: 'Lectura por potencia (informativa, no normativa).', nota: 'La casilla sale de la norma.'
});
async function libro(estado) {
  const b = await exportarFichaPlanificacion(EQ, estado, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
  return JSZip.loadAsync(b);
}

describe('En pantalla', () => {
  test('Mantenimiento ya no tiene la pestaña «Anexo AT»; el PI sí', () => {
    assert.ok(!HOJAS_SALUD.some((h) => h.id === 'anexoAT'));
    assert.ok(HOJAS_SALUD.some((h) => h.id === 'salud'));
    assert.ok(HOJAS_FICHA.some((h) => h.id === 'anexoAT'));
  });
});

describe('El dibujo', () => {
  test('SVG con las cuatro cifras, las 25 casillas a color, el recuadro del equipo y la leyenda', () => {
    const { svg, w, h } = svgSaludRiesgo(MODELO);
    assert.ok(w > 0 && h > 0);
    assert.equal((svg.match(/<text/g) || []).length, (svg.match(/<\/text>/g) || []).length);
    for (const c of COLORES) assert.ok(svg.includes('fill="' + c + '"'), c);
    assert.match(svg, /stroke="#10202c" stroke-width="6"/);
    assert.match(svg, /Riesgo alto/);
    assert.match(svg, /Recuadro: posición de este equipo/);
    assert.match(svg, /12\.345 usuarios/);
  });
  test('el marco de la hoja de diagramas tiene tamaño apaisado', async () => {
    const z = await JSZip.loadAsync(readFileSync(PLANTILLA));
    const c = cajaSaludRiesgo(await z.file('xl/worksheets/sheet3.xml').async('string'));
    assert.ok(c.w > c.h && c.h > 300, JSON.stringify(c));
  });
});

describe('En el Excel', () => {
  test('Mantenimiento: «Salud y riesgo» en el lugar del «Anexo AT», con su imagen dentro del área y sin datos ocultos', async () => {
    const z = await libro({ plan: { proyecto: 'P' }, saludRiesgo: { ...MODELO, png: PNG } });
    const m = await leerLibroParaVista(z);
    assert.deepEqual(m.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Beneficios', 'Diagrama Actual', 'Diagrama Futuro', 'Salud y riesgo']);
    const sr = m.hojas[4];
    assert.equal(sr.area, 'B2:R56');
    assert.ok(sr.imagenes.some((i) => /image8\.png$/.test(i.ruta)), 'la imagen de la matriz');
    assert.ok(sr.celdas.some((c) => c.texto === 'SALUD Y RIESGO'));
    assert.ok(sr.celdas.some((c) => c.texto === 'Pág. 5 de 5'));
    assert.deepEqual(m.ocultos, []);
    const wb = await z.file('xl/workbook.xml').async('string');
    assert.doesNotMatch(wb, /Anexo AT/);
    assert.match(wb, /<definedName name="_xlnm\.Print_Area" localSheetId="4">'Salud y riesgo'!\$B\$2:\$R\$56<\/definedName>/);
    assert.ok(z.file('xl/media/image8.png'));
  });
  test('el PI (sin modelo) conserva su «Anexo AT»', async () => {
    const m = await leerLibroParaVista(await libro({ plan: { proyecto: 'P' } }));
    assert.equal(m.hojas[4].nombre, 'Anexo AT');
  });
  // Revisión §107: antes, sin imagen volvía el Anexo AT en silencio — lo contrario de lo pedido.
  test('si no hay imagen (sin navegador), la hoja «Salud y riesgo» sale con su aviso, sin Anexo AT, y se le avisa a quien descarga', async () => {
    const avisos = [];
    const b = await exportarFichaPlanificacion(EQ, { plan: { proyecto: 'P' }, saludRiesgo: MODELO },
      { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array', avisos });
    const z = await JSZip.loadAsync(b);
    const m = await leerLibroParaVista(z);
    assert.equal(m.hojas[4].nombre, 'Salud y riesgo');
    assert.ok(m.hojas[4].celdas.some((c) => c.texto === AVISO_SIN_IMAGEN));
    assert.deepEqual(m.ocultos, []);
    assert.doesNotMatch(await z.file('xl/workbook.xml').async('string'), /Anexo AT/);
    assert.equal(z.file('xl/media/image8.png'), null);
    assert.doesNotMatch(await z.file('xl/drawings/_rels/drawing6.xml.rels').async('string'), /image8/);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /no se pudo dibujar/);
  });
  test('con imagen no hay aviso', async () => {
    const avisos = [];
    await exportarFichaPlanificacion(EQ, { plan: { proyecto: 'P' }, saludRiesgo: { ...MODELO, png: PNG } },
      { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array', avisos });
    assert.deepEqual(avisos, []);
  });
});

describe('El dibujo no se rompe ni sugiere lo que no hay (revisión §107)', () => {
  test('un carácter de control en la subestación no deja el dibujo mal formado', () => {
    const { svg } = svgSaludRiesgo({ ...MODELO, titulo: 'Salud · S/E X\u000bY\u0001 · T1' });
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    assert.match(svg, /S\/E XY · T1/);
  });
  test('sin MVA (punto null) no se dibuja punto en la casilla; la leyenda conserva sus cinco', () => {
    const conPunto = svgSaludRiesgo(MODELO).svg.match(/<circle\b/g).length;
    const sinPunto = svgSaludRiesgo({ ...MODELO, marca: { ...MODELO.marca, mva: 'sin MVA', punto: null } }).svg.match(/<circle\b/g).length;
    assert.equal(conPunto, 6);
    assert.equal(sinPunto, 5);
  });
  test('sin dato de usuarios el equipo no cae en ninguna columna (antes: «Mínima» con veredicto)', () => {
    const r = calcularRangosCriticidad(48312);
    assert.equal(nivelPorUsuarios(null, r), null);
    assert.equal(nivelPorUsuarios(undefined, r), null);
    assert.equal(nivelPorUsuarios('', r), null);
    assert.equal(nivelPorUsuarios('  ', r), null);
    assert.equal(nivelPorUsuarios(0, r), 'minima');
    assert.equal(nivelPorUsuarios('0', r), 'minima');
    assert.equal(nivelPorUsuarios(20000, r), 'moderada');
  });
});

describe('Sin identificadores repetidos', () => {
  test('la hoja clonada no repite el identificador interno de «Diagrama Actual»', async () => {
    const z = await libro({ plan: { proyecto: 'P' }, saludRiesgo: { ...MODELO, png: PNG } });
    const uid = async (n) => ((await z.file(n).async('string')).match(/<worksheet\b[^>]*\sxr:uid="([^"]+)"/) || [])[1];
    const u3 = await uid('xl/worksheets/sheet3.xml'); const u6 = await uid('xl/worksheets/sheet6.xml');
    assert.ok(u3);
    assert.notEqual(u6, u3);
  });
});
