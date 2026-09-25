// Vista previa del Excel de Fichas (`99 §102`): se lee el MISMO .xlsx que se
// descargaría, con sus cinco hojas y lo que viaja oculto. Sin firmas reales.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';

import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import {
  calcularFormula, formatearValor, leerLibroParaVista, colIndice
} from '../assets/js/ui/fichas/vista-previa-excel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });

const EQUIPO = Object.freeze({
  subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA',
  departamento: 'DEPARTAMENTO DE PRUEBA', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3
});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function libro(estado) {
  const bytes = await exportarFichaPlanificacion(EQUIPO, estado, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
  return leerLibroParaVista(await JSZip.loadAsync(bytes));
}

describe('Fórmulas del PE.02081', () => {
  const hoja = { F36: 192852000, I36: undefined, J34: undefined, E20: 2, F11: 1549 };
  const leer = (_h, ref) => hoja[ref];
  test('las que escribe el exportador se calculan', () => {
    assert.equal(calcularFormula('F36+(30*49593000)', 'H', leer).valor, 192852000 + 30 * 49593000);
    assert.equal(calcularFormula('IF(COUNT(J34:J66)=0,"",SUM(J34:J66))', 'H', leer).valor, '');
    assert.equal(calcularFormula('SUM(F36,E20)', 'H', leer).valor, 192852002);
    assert.equal(calcularFormula('E20*$F$11', 'H', leer).valor, 3098);
    assert.equal(calcularFormula('+E20/4', 'H', leer).valor, 0.5);
  });
  test('una referencia a OTRO archivo no se calcula: se marca', () => {
    const r = calcularFormula("'[1]Ficha Técnica'!J37/1000000", 'Beneficios', leer);
    assert.equal(r.externa, true);
    assert.equal(r.valor, null);
  });
  test('lo que no entiende lo dice, no inventa un número', () => {
    assert.ok(calcularFormula('VLOOKUP(A1,B:C,2)', 'H', leer).error);
  });
});

describe('Formato de números como en Excel (es-CO)', () => {
  const PESOS = '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"??_);_(@_)';
  test('pesos con miles, fechas y general', () => {
    assert.equal(formatearValor(1680642000, PESOS, 172), '$ 1.680.642.000');
    assert.equal(formatearValor(44927, '', 14), '01/01/2023');
    assert.equal(formatearValor(30, '', 0), '30');
    assert.equal(formatearValor(0.25, '0.00%', 10), '25,00 %');
    assert.equal(colIndice('AB'), 27);
  });
});

describe('La vista previa lee el archivo que se descargaría', () => {
  test('las cinco hojas, en orden, con lo que escribe el sistema', async () => {
    const m = await libro({ plan: { proyecto: 'PROYECTO VISTA', alcance: 'Alcance de prueba.' } });
    assert.deepEqual(m.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Beneficios', 'Diagrama Actual', 'Diagrama Futuro', 'Anexo AT']);
    const ficha = m.hojas[0];
    const txt = ficha.celdas.map((c) => c.texto).join(' | ');
    assert.match(txt, /PROYECTO VISTA/);
    assert.match(txt, /Alcance de prueba\./);
    assert.ok(ficha.ancho > 500 && ficha.alto > 500, 'la hoja tiene tamaño de página');
    // Los cuadros de firma están, con sus textos.
    const textos = ficha.textos.flatMap((t) => t.parrafos.map((p) => p.texto)).join(' | ');
    assert.match(textos, /Nombre: MIGUEL A\. JIMENEZ/);
    assert.match(textos, /Fecha de Entrega/);
  });
  test('las firmas estampadas aparecen como imágenes en la hoja 1', async () => {
    const sin = await libro({ plan: {} });
    const con = await libro({ plan: {}, firmas: { elab: { dataUrl: PNG, rel: 2.5 } } });
    assert.equal(con.hojas[0].imagenes.length, sin.hojas[0].imagenes.length + 1);
    assert.ok(con.hojas[0].imagenes.some((i) => /firma-elab\.png$/.test(i.ruta) && i.src));
  });
  test('muestra lo que viaja OCULTO: vínculo externo, hoja fantasma, etiqueta, SharePoint, nombres rotos', async () => {
    const m = await libro({ plan: {} });
    const titulos = m.ocultos.map((o) => o.titulo).join(' | ');
    assert.match(titulos, /Vínculo a otro archivo/);
    const vinculo = m.ocultos.find((o) => /Vínculo/.test(o.titulo));
    assert.match(vinculo.detalle, /PE\.02081\.PE-FO\.03 Ficha tecnica\.xlsx/);
    assert.match(vinculo.nota, /Beneficios!K11/);
    assert.match(titulos, /Hojas que ya no existen/);
    assert.match(m.ocultos.find((o) => /ya no existen/.test(o.titulo)).detalle, /Anexos MT/);
    assert.match(titulos, /Etiqueta de clasificación/);
    assert.match(titulos, /SharePoint/);
    assert.match(titulos, /Nombres definidos rotos/);
    // La celda de Beneficios que depende del otro archivo queda marcada.
    const k11 = m.hojas[1].celdas.find((c) => c.ref === 'K11');
    assert.ok(k11 && k11.externa, 'K11 marcada como vínculo externo');
    // …y la que depende de ella (Relación B/C = K12/K11) también, no un «#¡VALOR!».
    const k14 = m.hojas[1].celdas.find((c) => c.ref === 'K14');
    assert.ok(k14 && k14.externa, 'K14 depende del vínculo externo');
  });
});

describe('Geometría de las celdas', () => {
  test('cada celda tiene alto y ancho en píxeles, y su alineación aparte', async () => {
    const m = await libro({ plan: {} });
    for (const c of m.hojas[0].celdas) {
      assert.ok(Number.isFinite(c.h) && Number.isFinite(c.w), c.ref + ' con medidas');
      assert.ok(['left', 'right', 'center', 'centerContinuous', 'justify', 'general', 'fill', 'distributed'].includes(c.alH), c.ref + ' alineación ' + c.alH);
    }
    const d9 = m.hojas[0].celdas.find((c) => c.ref === 'D9');
    assert.equal(d9.relleno, '#C6DEB5', 'la casilla verde de la plantilla');
    assert.ok(d9.h > 10);
  });
});

describe('Dibujos del Excel en su lugar', () => {
  test('en un grupo, cada parte va en su sitio (título arriba, valor debajo) y en su capa', async () => {
    const m = await libro({ plan: { fechaentrega: '15-12-2026 aprox' } });
    const t = m.hojas[0].textos;
    const titulo = t.find((x) => x.parrafos.some((p) => p.texto === 'Fecha de Entrega'));
    const valor = t.find((x) => x.parrafos.some((p) => /15-12-2026/.test(p.texto)));
    assert.ok(titulo && valor);
    assert.ok(valor.y > titulo.y, 'el valor va debajo del título');
    // Los huecos blancos de la plantilla van al fondo: antes que los cuadros de firma.
    const hueco = m.hojas[0].imagenes.find((i) => /image2\.png$/.test(i.ruta));
    const caja = t.find((x) => x.parrafos.some((p) => /^Nombre: MIGUEL/.test(p.texto)));
    assert.ok(hueco && caja && hueco.capa < caja.capa, 'el hueco blanco queda debajo del texto');
  });
});
