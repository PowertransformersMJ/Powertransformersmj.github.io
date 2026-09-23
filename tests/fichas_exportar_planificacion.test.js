// Pruebas del EXPORTADOR de la Ficha de Planificación (PE.02081) contra la
// PLANTILLA OFICIAL REAL (`assets/plantillas/PE-02081-planificacion.xlsx`).
//
// Hasta el 2026-09-23 el exportador no tenía ni una prueba (cola de Fichas,
// paquete «que no vuelva a pasar»). Esta nace con CF-05: el «Valor Real
// Total» y el «Sistema» que el Ingeniero teclea en la ficha se quedaban en la
// pantalla y el Excel firmado salía con J36/K36 en blanco.
//
// Equipo de prueba FICTICIO: el repo es público.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import {
  celdasFichaPlan,
  pendientesFichaPlan,
  exportarFichaPlanificacion
} from '../assets/js/ui/fichas/exportar-planificacion.js';
import { celdaCSV } from '../assets/js/ui/fichas/evaluacion-masiva.js';
import { FIRMAS } from '../assets/js/ui/fichas/panel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
const HOJA = 'xl/worksheets/sheet1.xml';

// El módulo carga JSZip del CDN; en Node se inyecta el del paquete.
before(() => { globalThis.__sgmJSZip = JSZip; });

const EQUIPO = Object.freeze({
  subestacion: 'SUBESTACION DE PRUEBA',
  serie: 'S-0001',
  matricula: 'T0-PRUEBA',
  departamento: 'DEPARTAMENTO DE PRUEBA',
  mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3
});

const celda = (mapa, ref) => mapa.find((m) => m.cell === ref);

/** Exporta con la plantilla real y devuelve { xml de la hoja 1, hoja leída por SheetJS }. */
async function exportar(plan, equipo = EQUIPO) {
  const plantillaBuffer = readFileSync(PLANTILLA);
  const bytes = await exportarFichaPlanificacion(equipo, { plan }, { plantillaBuffer, tipoSalida: 'uint8array' });
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file(HOJA).async('string');
  const wb = XLSX.read(bytes, { type: 'array' });
  return { xml, hoja: wb.Sheets[wb.SheetNames[0]] };
}

/** Todas las celdas de una hoja como { ref: xml-de-la-celda }. */
function celdasXml(xml) {
  const out = {};
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) out[m[1]] = m[0];
  return out;
}

describe('CF-05 · el Valor Real y el Sistema llegan al Excel que se firma', () => {
  test('el mapa de la hoja 1 incluye J36 (Valor Real Total) y K36 (Sistema)', () => {
    const mapa = celdasFichaPlan(EQUIPO, { plan: { presu_real: '2.100.000.000', presu_sistema: 'STR' } });
    assert.deepEqual(
      { val: celda(mapa, 'J36').val, numeric: celda(mapa, 'J36').numeric, pend: celda(mapa, 'J36').pend },
      { val: 2100000000, numeric: true, pend: false }
    );
    assert.equal(celda(mapa, 'K36').val, 'STR');
    assert.equal(celda(mapa, 'K36').clear, false);
  });

  test('el dinero se lee con montoCOP: los puntos son miles y la coma, decimales', () => {
    // Con parseFloat, «2.100.000.000» sería 2,1 y «1.234.567,89» sería 1,234.
    const v = (texto) => celda(celdasFichaPlan(EQUIPO, { plan: { presu_real: texto } }), 'J36').val;
    assert.equal(v('2.100.000.000'), 2100000000);
    assert.equal(v('1.234.567,89'), 1234567.89);
    assert.equal(v('$ 500.000'), 500000);
  });

  test('estado cero: sin Valor Real no se inventa cifra (CF-06: [PENDIENTE]); sin Sistema, en blanco', () => {
    for (const plan of [{}, { presu_real: '', presu_sistema: '' }, { presu_real: '   ', presu_sistema: '   ' }]) {
      const mapa = celdasFichaPlan(EQUIPO, { plan });
      assert.equal(celda(mapa, 'J36').val, '[PENDIENTE]', JSON.stringify(plan));
      assert.equal(celda(mapa, 'J36').numeric, false, JSON.stringify(plan));
      assert.equal(celda(mapa, 'K36').clear, true, JSON.stringify(plan));
    }
  });

  test('en el archivo: J36 es un NÚMERO con el formato de pesos de la plantilla, K36 texto', async () => {
    const { xml, hoja } = await exportar({ presu_real: '1.234.567,89', presu_sistema: '  STR  ' });
    const c = celdasXml(xml);
    // El estilo 255 (pesos, casilla desbloqueada) y el 72 (centrado) son los de la plantilla.
    assert.equal(c.J36, '<c r="J36" s="255"><v>1234567.89</v></c>');
    assert.match(c.K36, /^<c r="K36" s="72" t="inlineStr">/);
    assert.equal(hoja.J36.v, 1234567.89);
    assert.equal(hoja.J36.t, 'n');
    assert.equal(hoja.K36.v, 'STR');
    // El TOTAL DEL PROYECTO real sigue siendo la fórmula de la plantilla y
    // SIN valor en caché: Excel lo recalcula al abrir con J36 dentro.
    assert.equal(c.J78, '<c r="J78" s="58"><f>SUM(J34:J66)</f></c>');
  });

  test('en el archivo, estado cero: J36 y su total dicen [PENDIENTE] (no «0»); K36 queda vacía', async () => {
    const { hoja } = await exportar({});
    assert.equal(hoja.J36.v, '[PENDIENTE]');
    assert.equal(hoja.J78.v, '[PENDIENTE]');
    assert.equal(hoja.J78.f, undefined, 'el total pendiente no puede seguir siendo SUM (daría 0)');
    assert.ok(!hoja.K36 || hoja.K36.v === '' || hoja.K36.v == null, 'K36 debería quedar vacía');
  });

  test('fuera del mapa, la hoja 1 sale IDÉNTICA a la plantilla (celda por celda)', async () => {
    const plantilla = await JSZip.loadAsync(readFileSync(PLANTILLA));
    const antes = celdasXml(await plantilla.file(HOJA).async('string'));
    const { xml } = await exportar({ presu_real: '2.100.000.000', presu_sistema: 'STR' });
    const despues = celdasXml(xml);
    const mapa = new Set(celdasFichaPlan(EQUIPO, { plan: {} }).map((m) => m.cell));
    const recalculadas = new Set(['I78', 'J78']);   // solo pierden el valor en caché
    const cambiadas = Object.keys(antes)
      .filter((ref) => !mapa.has(ref) && !recalculadas.has(ref) && antes[ref] !== despues[ref]);
    assert.deepEqual(cambiadas, []);
    assert.deepEqual(Object.keys(despues).filter((ref) => !(ref in antes)), [], 'no se crean celdas nuevas');
  });
});

describe('CF-06 · el dinero que falta dice [PENDIENTE] en el Excel, y se avisa antes de descargar', () => {
  const COMPLETO = Object.freeze({
    proyecto: 'PROYECTO DE PRUEBA', municipio: 'MUNICIPIO DE PRUEBA',
    alcance: 'Alcance de prueba.', beneficios: 'Beneficios de prueba.',
    presu_real: '2.100.000.000', presu_sistema: 'STR'
  });
  const SIN_POTENCIA = Object.freeze({ ...EQUIPO, mva: null });

  test('UC fuera del catálogo: F36, I36 e I78 dicen [PENDIENTE], ninguna es número ni SUM', async () => {
    const { xml, hoja } = await exportar({ ...COMPLETO, presu_ucc: 'ZZ999' });
    for (const ref of ['F36', 'I36', 'I78']) {
      assert.equal(hoja[ref].v, '[PENDIENTE]', ref);
      assert.equal(hoja[ref].t, 's', ref);
      assert.equal(hoja[ref].f, undefined, ref);
    }
    // Conservan el estilo de la plantilla (pesos / miles, centrado).
    const c = celdasXml(xml);
    assert.match(c.F36, /^<c r="F36" s="254" t="inlineStr">/);
    assert.match(c.I36, /^<c r="I36" s="254" t="inlineStr">/);
    assert.match(c.I78, /^<c r="I78" s="58" t="inlineStr">/);
    // El Valor Real, que sí se tecleó, sigue con su cifra y su total vivo.
    assert.equal(hoja.J36.v, 2100000000);
    assert.equal(c.J78, '<c r="J78" s="58"><f>SUM(J34:J66)</f></c>');
  });

  test('sin potencia: F36 conserva el costo de instalación y solo I36/I78 quedan [PENDIENTE]', async () => {
    const { hoja } = await exportar({ ...COMPLETO, presu_ucc: 'N4T5' }, SIN_POTENCIA);
    assert.equal(hoja.F36.t, 'n');
    assert.ok(hoja.F36.v > 0);
    assert.equal(hoja.I36.v, '[PENDIENTE]');
    assert.equal(hoja.I78.v, '[PENDIENTE]');
  });

  test('con todo el dato, I36 es la fórmula viva e I78 la SUM de la plantilla, intacta', async () => {
    const { xml } = await exportar(COMPLETO);
    const c = celdasXml(xml);
    assert.match(c.I36, /^<c r="I36" s="254"><f>F36\+\(30\*\d+\)<\/f><\/c>$/);
    assert.equal(c.I78, '<c r="I78" s="58"><f>SUM(I34:I66)</f></c>');
  });

  test('ficha completa ⇒ no hay nada que avisar', () => {
    assert.deepEqual(pendientesFichaPlan(EQUIPO, { plan: COMPLETO }), []);
  });

  test('el aviso dice cada motivo una vez, con los campos que afecta; los totales van al final, en su línea', () => {
    const p = pendientesFichaPlan(EQUIPO, { plan: { ...COMPLETO, presu_ucc: 'ZZ999', presu_real: '' } });
    assert.deepEqual(p, [
      { campos: ['Valor CREG Unitario', 'Valor CREG Total'],
        motivo: 'La UC no está en el catálogo CREG 015/2018 (Tablas 51 y 52).' },
      { campos: ['Valor Real Total'], motivo: 'No se ha tecleado el Valor Real Total.' },
      { campos: ['TOTAL DEL PROYECTO (CREG)', 'TOTAL DEL PROYECTO (real)'],
        motivo: 'Queda [PENDIENTE] mientras su línea no tenga cifra.' }
    ]);
  });

  test('sin potencia, el aviso lo dice con el motivo del dominio', () => {
    const p = pendientesFichaPlan(SIN_POTENCIA, { plan: { ...COMPLETO, presu_ucc: 'N4T5' } });
    assert.deepEqual(p, [
      { campos: ['Valor CREG Total'], motivo: 'Falta la potencia del proyecto en MVA.' },
      { campos: ['TOTAL DEL PROYECTO (CREG)'], motivo: 'Queda [PENDIENTE] mientras su línea no tenga cifra.' }
    ]);
  });

  test('la cuenta del aviso es la MISMA que las casillas [PENDIENTE] del papel (revisión §87)', async () => {
    const escenarios = [
      [EQUIPO, {}],
      [EQUIPO, { ...COMPLETO }],
      [EQUIPO, { ...COMPLETO, presu_real: '' }],
      [EQUIPO, { ...COMPLETO, presu_ucc: 'ZZ999' }],
      [EQUIPO, { ...COMPLETO, presu_real: '2.100 millones' }],
      [EQUIPO, { ...COMPLETO, presu_unit: '192 millones' }],
      [SIN_POTENCIA, { ...COMPLETO, presu_ucc: 'N4T5', proyecto: '' }]
    ];
    for (const [equipo, plan] of escenarios) {
      const aviso = pendientesFichaPlan(equipo, { plan }).reduce((n, f) => n + f.campos.length, 0);
      const { hoja } = await exportar(plan, equipo);
      const enPapel = Object.keys(hoja).filter((ref) => ref[0] !== '!'
        && typeof hoja[ref].v === 'string' && hoja[ref].v.startsWith('[PENDIENTE')).length;
      assert.equal(aviso, enPapel, JSON.stringify(plan));
    }
  });
  test('los textos que faltan también entran al aviso; un campo de puros espacios cuenta como vacío', () => {
    const p = pendientesFichaPlan(EQUIPO, { plan: { ...COMPLETO, proyecto: '   ', alcance: '' } });
    assert.deepEqual(p.map((x) => x.campos[0]), ['Proyecto', 'Alcance']);
    const mapa = celdasFichaPlan(EQUIPO, { plan: { ...COMPLETO, proyecto: '   ' } });
    assert.equal(celda(mapa, 'D8').val, '[PENDIENTE: NOMBRE DEL PROYECTO]');
  });

});

describe('Revisión §87 · el dinero tecleado se lee sin adivinar (pantalla y papel)', () => {
  const COMPLETO = Object.freeze({
    proyecto: 'PROYECTO DE PRUEBA', municipio: 'MUNICIPIO DE PRUEBA',
    alcance: 'Alcance de prueba.', beneficios: 'Beneficios de prueba.', presu_sistema: 'STR'
  });

  for (const texto of ['2.100 millones', '$2.100 MM', '2,1 mil millones', '2,100,000,000',
    '1850000000.50', 'aprox 2 mil millones', '1.5 millones', '=2.100.000.000*1,19', 'USD 500.000']) {
    test('«' + texto + '» no se firma como otra cifra: J36 y su total dicen [PENDIENTE] y el aviso lo cita', async () => {
      const { hoja } = await exportar({ ...COMPLETO, presu_real: texto });
      assert.equal(hoja.J36.v, '[PENDIENTE]');
      assert.equal(hoja.J78.v, '[PENDIENTE]');
      const p = pendientesFichaPlan(EQUIPO, { plan: { ...COMPLETO, presu_real: texto } });
      const real = p.find((f) => f.campos.includes('Valor Real Total'));
      assert.ok(real, 'el aviso debe listar el Valor Real');
      assert.match(real.motivo, /no se puede leer como cifra/);
      assert.ok(real.motivo.includes(texto.slice(0, 20)), 'el aviso cita lo tecleado');
    });
  }

  for (const [texto, valor] of [['2.100.000.000', 2100000000], ['2100000000', 2100000000],
    ['$ 2.100.000.000', 2100000000], ['1.000.000,50', 1000000.5], ['12.500', 12500], ['0', 0]]) {
    test('«' + texto + '» sí es una cifra colombiana y se firma tal cual: ' + valor, async () => {
      const { hoja } = await exportar({ ...COMPLETO, presu_real: texto });
      assert.equal(hoja.J36.t, 'n');
      assert.equal(hoja.J36.v, valor);
    });
  }

  test('un Valor CREG Unitario tecleado que no es cifra NO cae en silencio al catálogo', async () => {
    const plan = { ...COMPLETO, presu_real: '1', presu_unit: '192 millones' };
    const { hoja } = await exportar(plan);
    for (const ref of ['F36', 'I36', 'I78']) assert.equal(hoja[ref].v, '[PENDIENTE]', ref);
    const p = pendientesFichaPlan(EQUIPO, { plan });
    assert.match(p[0].motivo, /Valor CREG Unitario tecleado no se puede leer como cifra/);
  });
});

describe('CF-32 · lo que se teclea NUNCA se vuelve fórmula en el Excel (candado)', () => {
  // Verificado el 2026-09-23 (99 §87): el exportador escribe todo texto como
  // celda de TEXTO (`t="inlineStr"`), y ni LibreOffice ni SheetJS lo evalúan
  // aunque empiece por = + - @. El riesgo de «fórmula viva» es del CSV: la
  // evaluación masiva lo neutralizaba al inicio de la celda pero no detrás de un
  // retorno de carro suelto (lo cerró la revisión de §87, prueba de abajo; y esa
  // revisión destapó también el «$», otra prueba de abajo). Anteponer un apóstrofo, como
  // proponía la cola, NO protege nada en un .xlsx y SÍ imprime «'» en el papel
  // firmado. Este candado falla si alguien convierte el texto en fórmula… o si
  // le mete el apóstrofo.
  const PELIGROSOS = Object.freeze({
    proyecto: '=SUM(2,3)', municipio: '-4+10', alcance: '=HYPERLINK("http://ejemplo.invalid","clic")',
    beneficios: '@SUM(1,1)', presu_sistema: '=10*10', presu_desc: '+7*6', presu_real: '100'
  });
  const ANEXO = Object.freeze({ observacion: "=CMD|' /C calc'!A0", grupo: '=2*2' });

  test('las únicas fórmulas del libro son las del presupuesto; el texto sale literal, sin apóstrofo', async () => {
    const plantillaBuffer = readFileSync(PLANTILLA);
    const bytes = await exportarFichaPlanificacion(
      { ...EQUIPO, subestacion: '=1+1', departamento: '+2+3' },
      { plan: PELIGROSOS, anexo: ANEXO },
      { plantillaBuffer, tipoSalida: 'uint8array' });
    const zip = await JSZip.loadAsync(bytes);
    const hoja1 = await zip.file(HOJA).async('string');
    const anexo = await zip.file('xl/worksheets/sheet6.xml').async('string');
    const formulas = (xml) => [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>/g)].map((m) => m[1]);
    assert.deepEqual(formulas(hoja1).sort(), ['I36', 'I78', 'J78']);
    assert.deepEqual(formulas(anexo), []);

    const wb = XLSX.read(bytes, { type: 'array' });
    const h = wb.Sheets[wb.SheetNames[0]];
    const esperado = { D8: '=SUM(2,3)', D14: '-4+10', B17: PELIGROSOS.alcance, B23: '@SUM(1,1)',
      D36: '+7*6', K36: '=10*10', H13: '=1+1', D13: '+2+3' };
    for (const [ref, texto] of Object.entries(esperado)) {
      assert.equal(h[ref].t, 's', ref);
      assert.equal(h[ref].v, texto, ref + ' debe salir literal (sin apóstrofo)');
    }
    const a = wb.Sheets['Anexo AT'] || wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]];
    assert.equal(a.O11.v, ANEXO.observacion);
    assert.equal(a.F11.v, '=2*2');
  });

  // La revisión de §87 encontró el hueco del candado: un «$» delante de « " < > & ' `»
  // era una ORDEN de String.replace ($&, $`, $') y cambiaba el texto o rompía el XML.
  test('un «$» tecleado sale literal en todas las vías de texto, y el archivo sigue siendo válido', async () => {
    const plan = {
      proyecto: 'Proyecto $` fin', alcance: 'Tope $<5 millones', beneficios: "Ahorro $& fin y $' más",
      presu_sistema: 'STR "$"', presu_desc: 'Cotizado en US$"', presu_real: '1',
      fechaentrega: "01/10/2026 $'", anioentrada: '2027 $`'
    };
    const anexo = { observacion: 'Cotizado en US$" y $$' };
    const bytes = await exportarFichaPlanificacion(EQUIPO, { plan, anexo },
      { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
    const zip = await JSZip.loadAsync(bytes);
    for (const parte of [HOJA, 'xl/worksheets/sheet6.xml', 'xl/drawings/drawing1.xml']) {
      const xml = await zip.file(parte).async('string');
      assert.equal((xml.match(/<\?xml/g) || []).length, 1, parte + ': una sola declaración XML');
      assert.ok(!/<a:t>[^<]*<a:t>/.test(xml), parte + ': sin cuadros de texto anidados');
    }
    const h = XLSX.read(bytes, { type: 'array' });
    const hoja = h.Sheets[h.SheetNames[0]];
    assert.equal(hoja.D8.v, plan.proyecto);
    assert.equal(hoja.B17.v, plan.alcance);
    assert.equal(hoja.B23.v, plan.beneficios);
    assert.equal(hoja.K36.v, plan.presu_sistema);
    assert.equal(hoja.D36.v, plan.presu_desc);
    assert.equal(h.Sheets['Anexo AT'].O11.v, anexo.observacion);
    const dibujo = await zip.file('xl/drawings/drawing1.xml').async('string');
    assert.ok(dibujo.includes('<a:t>01/10/2026 $&#39;</a:t>'), 'fecha literal');
    assert.ok(dibujo.includes('<a:t>2027 $`</a:t>'), 'año literal');
  });

  test('CSV de la evaluación masiva: la fórmula no revive ni al inicio ni detrás de un salto de línea', () => {
    assert.equal(celdaCSV('=1+1'), "'=1+1");
    assert.equal(celdaCSV('@SUM(1,1)'), "'@SUM(1,1)");
    // El \r suelto partía la fila y dejaba «=1+1» al inicio de una celda nueva.
    assert.equal(celdaCSV('SE PRUEBA\r=1+1'), '"SE PRUEBA\r=1+1"');
    assert.equal(celdaCSV('SE PRUEBA\n=1+1'), '"SE PRUEBA\n=1+1"');
    assert.equal(celdaCSV('a;b'), '"a;b"');
    assert.equal(celdaCSV('di "x"'), '"di ""x"""');
    assert.equal(celdaCSV('normal'), 'normal');
    assert.equal(celdaCSV(null), '');
  });
});

describe('§88 · el cuadro de firmas de la pantalla es el de la plantilla PE.02081', () => {
  test('cuatro cuadros, Aprobación con dos firmantes, y cada ocupación LITERAL de la plantilla', async () => {
    const zip = await JSZip.loadAsync(readFileSync(PLANTILLA));
    const dibujo = await zip.file('xl/drawings/drawing1.xml').async('string');
    // Un renglón del cuadro puede venir partido en varios <a:t>: se leen por párrafo.
    const textos = [...dibujo.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map((p) => [...p[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('').trim());
    assert.deepEqual([...new Set(FIRMAS.map((f) => f.rol))], ['Elaboración', 'Revisión', 'Aprobación', 'Recibe']);
    assert.equal(FIRMAS.filter((f) => f.rol === 'Aprobación').length, 2);
    for (const rol of ['Elaboración', 'Revisión', 'Aprobación', 'Recibe']) assert.ok(textos.includes(rol), rol);
    for (const f of FIRMAS) {
      assert.ok(textos.includes(('Ocupación: ' + f.ocupacion).trim()), f.k + ': «' + f.ocupacion + '» no está en la plantilla');
    }
    // Cinco firmantes en la plantilla = cinco «Nombre:» en el dibujo.
    assert.equal(textos.filter((t) => t === 'Nombre:').length, FIRMAS.length);
  });
});
