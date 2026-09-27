// Beneficios de Mantenimiento con las 13 acciones del Ingeniero (`99 §105`).
// Los textos son los que él aprobó uno a uno (crudos y síntesis en la bóveda);
// aquí se prueba que el catálogo está completo, que se compone bien con una,
// varias o todas las acciones, y que no cruza las reglas del texto firmado.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { entradaDesdeFicha } from '../assets/js/domain/fichas_borrador.js';
import {
  ACCIONES_BENEFICIO, RESUMEN_BENEFICIOS, RESUMEN_BENEFICIOS_UNA,
  accionesEscogidas, renglonBeneficio, redaccionBeneficiosAcciones, accionBeneficio
} from '../assets/js/domain/beneficios_acciones_mtto.js';

const EQ = { matricula: 'T0-PRUEBA', mva: 10, subestacion: 'SUBESTACION DE PRUEBA' };
const textos = (a) => (a.elementos ? [a.inicio, a.cierre, ...a.elementos.map((e) => e.clausula)] : [a.texto]);

describe('Catálogo: las 13 acciones del Ingeniero, en su orden y con sus nombres', () => {
  test('13 acciones, nombres literales', () => {
    assert.deepEqual(ACCIONES_BENEFICIO.map((a) => a.nombre), [
      'Corrección integral de fugas',
      'Actualización de protecciones mecánicas',
      'Actualización y repotenciación del sistema de refrigeración',
      'Recuperación de aislamientos mediante termovacío del aceite',
      'Recuperación de aislamientos mediante regeneración del aceite',
      'Recuperación de aislamientos mediante secado de la parte activa',
      'Actualización de accesorios',
      'Actualización y/o retrofit de tablero de control',
      'Mantenimiento OLTC',
      'Mantenimiento mando motor',
      'Normalización de nivel de aceite',
      'Mantenimiento NLTC',
      'Toma de muestra de aceite para ADFQ/DGA/PCB'
    ]);
  });
  test('las listas del Ingeniero: 8 protecciones, radiadores y bujes, y las dos tecnologías del OLTC', () => {
    assert.deepEqual(accionBeneficio('PROT').elementos.map((e) => e.nombre), [
      'Termómetro de temperatura de devanado', 'Termómetro de temperatura de aceite', 'Indicador de nivel',
      'Válvula de alivio de presión', 'Relé de flujo', 'Relé Buchholz', 'Válvula de retención automática',
      'Relé de presión súbita'
    ]);
    assert.deepEqual(accionBeneficio('ACCES').elementos.map((e) => e.nombre), ['Radiadores', 'Bujes']);
    assert.deepEqual(accionBeneficio('OLTC').elementos.map((e) => e.nombre), ['Ruptor en aceite', 'Ruptor en vacío']);
  });
  test('reglas del texto firmado: sin cifras, sin «evita/elimina/garantiza», sin «estanqueidad», sin marcas', () => {
    const todos = [...ACCIONES_BENEFICIO.flatMap(textos), RESUMEN_BENEFICIOS, RESUMEN_BENEFICIOS_UNA];
    for (const t of todos) {
      assert.ok(t && t.length > 40, 'texto vacío o corto');
      assert.doesNotMatch(t, /\d/);
      assert.doesNotMatch(t, /\b(evita|elimina|garantiza)\b/i);
      assert.doesNotMatch(t, /estanqueidad/i);
      assert.doesNotMatch(t, /OILTAP|VACUTAP|Reinhausen|ABB/i);
    }
  });
  test('palabras del Ingeniero que quedaron literales', () => {
    const t = (id) => textos(accionBeneficio(id)).join(' ');
    assert.match(t('FUGAS'), /Recupera y comprueba la hermeticidad del transformador/);
    assert.match(t('FUGAS'), /desmedidamente/);
    assert.match(t('TERMOVACIO'), /minimizando las partes por millón \(ppm\) de agua en el medio aislante líquido/);
    assert.match(t('TERMOVACIO'), /dándole al transformador confiabilidad dieléctrica durante su operación/);
    assert.match(t('NLTC'), /reemplazo de la regleta de conmutación y la volanta/);
    assert.match(RESUMEN_BENEFICIOS, /son necesarias para prevenir el riesgo operativo de falla catastrófica/);
    assert.match(RESUMEN_BENEFICIOS, /SAIDI y SAIFI y riesgo de alteración del orden público/);
    assert.doesNotMatch(RESUMEN_BENEFICIOS, /\{USUARIOS\}/);
  });
});

describe('Composición del texto', () => {
  test('sin acciones escogidas no sale nada (§96)', () => {
    assert.equal(redaccionBeneficiosAcciones(EQ, null, []), '');
    assert.equal(redaccionBeneficiosAcciones(EQ, null, undefined), '');
    assert.equal(redaccionBeneficiosAcciones(EQ, null, ['NO_EXISTE', 'PROT:no_existe']), '');
  });
  test('una acción: apertura con los datos del equipo, un renglón y el resumen en SINGULAR', () => {
    const t = redaccionBeneficiosAcciones(EQ, null, ['FUGAS']);
    const [apertura, renglones, resumen] = t.split('\n\n');
    assert.match(apertura, /T0-PRUEBA, de 10 MVA, en la subestación SUBESTACION DE PRUEBA/);
    assert.equal(renglones, '· Corrección integral de fugas — ' + accionBeneficio('FUGAS').texto);
    assert.equal(resumen, RESUMEN_BENEFICIOS_UNA);
  });
  test('varias acciones: en el orden del catálogo aunque se marquen en otro, y resumen en PLURAL', () => {
    const t = redaccionBeneficiosAcciones(EQ, null, ['MUESTRAS', 'FUGAS', 'NLTC']);
    const renglones = t.split('\n\n')[1].split('\n');
    assert.deepEqual(renglones.map((r) => r.split(' — ')[0]),
      ['· Corrección integral de fugas', '· Mantenimiento NLTC', '· Toma de muestra de aceite para ADFQ/DGA/PCB']);
    assert.equal(t.split('\n\n')[2], RESUMEN_BENEFICIOS);
  });
  test('protecciones: entrada + solo las cláusulas escogidas, en el orden del catálogo, + cierre', () => {
    const p = accionBeneficio('PROT');
    const r = renglonBeneficio(p, ['rele_buchholz', 'termometro_devanado']);
    const devanado = p.elementos[0].clausula;
    const buchholz = p.elementos[5].clausula;
    assert.equal(r, '· Actualización de protecciones mecánicas — ' + p.inicio + ' ' + devanado + '; ' + buchholz + '. ' + p.cierre);
    // Por la selección guardada, igual.
    const t = redaccionBeneficiosAcciones(EQ, null, ['PROT:rele_buchholz', 'PROT:termometro_devanado']);
    assert.ok(t.includes(r));
  });
  test('una acción con elementos marcada sin ninguno cuenta con todos', () => {
    const x = accionesEscogidas(['ACCES']);
    assert.deepEqual(x[0].elementos, ['radiadores', 'bujes']);
  });
  test('OLTC: paridad de tecnologías — sin tecnología salen las dos; con una, solo esa', () => {
    const o = accionBeneficio('OLTC');
    const ambas = renglonBeneficio(o, []);
    assert.ok(ambas.includes(o.elementos[0].clausula) && ambas.includes(o.elementos[1].clausula));
    const solo = redaccionBeneficiosAcciones(EQ, null, ['OLTC:vacio']);
    assert.ok(solo.includes(o.elementos[1].clausula));
    assert.ok(!solo.includes(o.elementos[0].clausula));
  });
  test('las 13 con todos sus elementos se componen sin huecos', () => {
    const sel = ACCIONES_BENEFICIO.flatMap((a) => (a.elementos ? a.elementos.map((e) => a.id + ':' + e.id) : [a.id]));
    const t = redaccionBeneficiosAcciones(EQ, null, sel);
    assert.equal(t.split('\n\n')[1].split('\n').length, 13);
    assert.doesNotMatch(t, /\[PENDIENTE|undefined|null/);
  });
  test('sin datos del equipo se declara el hueco, no se deja la frase muda', () => {
    const t = redaccionBeneficiosAcciones({}, null, ['FUGAS']);
    assert.match(t, /\[PENDIENTE: MATRÍCULA\].*\[PENDIENTE: POTENCIA\].*\[PENDIENTE: SUBESTACIÓN\]/);
  });
  test('el borrador guarda completo el texto de las 13 acciones corregido a mano (revisión de §105)', () => {
    const sel = ACCIONES_BENEFICIO.flatMap((a) => (a.elementos ? a.elementos.map((e) => a.id + ':' + e.id) : [a.id]));
    const t = redaccionBeneficiosAcciones(EQ, null, sel) + '\nNota a mano del Ingeniero.';
    const e = entradaDesdeFicha({ equipo: { matricula: 'T0-PRUEBA', serie: 'S-0', subestacion: 'X' },
      plan: { beneficios_mtto: t, beneficios_mtto_ver: 'custom', benef_acc: sel }, ahoraISO: '2026-09-27T12:00:00.000Z' });
    assert.equal(e.plan.beneficios_mtto, t);
    assert.deepEqual(e.plan.benef_acc, sel);
  });
});
