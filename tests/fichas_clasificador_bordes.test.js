// Bordes del clasificador CREG — el corazón del módulo (ADR-066).
//
// `clasificarUC` lleva escrito "no cambiar el criterio sin decisión
// documentada" porque con él se auditó la flota entera: cambiar un `<=` por
// un `<` movería de banda a cada equipo que esté justo en el tope y
// reescribiría el veredicto de los 206 sin que nada se pusiera rojo.
// Estos tests congelan ese criterio.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  clasificarUC, nivelPorTension, hayAdvertencia, numeroES
} from '../assets/js/domain/fichas_creg_uc.js';

describe('clasificarUC — bordes de banda (criterio congelado)', () => {
  const uc = (kva) => clasificarUC(kva, 66, null, 'OLTC').uucc_calc;

  test('los topes de la Tabla 52 caen donde se auditó la flota', () => {
    assert.equal(uc(5000),   'N4T1');   // "hasta 5 MVA" incluye el 5
    assert.equal(uc(5001),   'N4T2');
    assert.equal(uc(10000),  'N4T2');
    assert.equal(uc(11000),  'N4T3');
    assert.equal(uc(15000),  'N4T3');
    assert.equal(uc(16000),  'N4T4');
    assert.equal(uc(20000),  'N4T4');
  });

  test('bordes de nivel de tensión', () => {
    assert.equal(nivelPorTension(57.5)[0],  'N4');
    assert.equal(nivelPorTension(57.49)[0], 'N3');
    assert.equal(nivelPorTension(30)[0],    'N3');
    assert.equal(nivelPorTension(29.99)[0], 'N2');
    assert.equal(nivelPorTension(220)[0],   'N5');
    assert.equal(nivelPorTension(500)[0],   'N6');
  });

  test('bajo el mínimo del nivel: se clasifica PERO con advertencia visible', () => {
    const r = clasificarUC(300, 34.5, null, 'NLTC');   // 0,3 MVA
    assert.ok(r.uucc_calc, 'debe proponer una banda');
    assert.ok(hayAdvertencia(r.notas), 'una interpretación debe abanderarse, no pasar por hecho');
  });

  test('niveles fuera del catálogo no fabrican código', () => {
    assert.equal(clasificarUC(5000, 13.8, null, 'NLTC').uucc_calc, null);   // N2
  });
});

describe('clasificarUC — datos sucios no clasifican en silencio', () => {
  // El Excel del parque entrega celdas como TEXTO ya formateado: en es-CO el
  // punto separa MILES. Antes "20.000" se leía como 20 kVA y el equipo caía
  // en la banda más pequeña SIN nota → discrepancia falsa en un acta firmable.
  test('"20.000" kVA son veinte mil, no veinte', () => {
    const r = clasificarUC('20.000', 66, null, 'OLTC');
    assert.equal(r.mva, 20);
    assert.equal(r.uucc_calc, 'N4T4');
  });

  test('"1.234,5" kVA respeta coma decimal y punto de miles', () => {
    assert.equal(numeroES('1.234,5'), 1234.5);
    assert.equal(numeroES('48.312'), 48312);
    assert.equal(numeroES('34.5'), 34.5);     // punto decimal suelto se respeta
    assert.equal(numeroES('34,5'), 34.5);
    assert.equal(numeroES('N/D'), null);
  });

  test('potencia ilegible se declara, no viaja como NaN', () => {
    const r = clasificarUC('N/D', 66, null, 'OLTC');
    assert.equal(r.uucc_calc, null);
    assert.ok(r.mva === null || Number.isFinite(r.mva), 'un NaN llegaría al Excel como "NaN"');
    assert.ok(r.notas.some((n) => /ilegible/i.test(n)), 'debe decir que no pudo leer la potencia');
  });

  test('potencia en cero no es una potencia válida', () => {
    const r = clasificarUC(0, 66, null, 'OLTC');
    assert.equal(r.uucc_calc, null);
    assert.ok(r.notas.some((n) => /cero o negativa/i.test(n)));
  });

  // Un 0 en la columna de terciario es el relleno de "no tiene". Aceptarlo
  // convertía un bidevanado en tridevanado: otra familia de UC y ~23% más de
  // presupuesto en el equipo del ejemplo.
  test('terciario en 0 NO convierte el equipo en tridevanado', () => {
    const conCero = clasificarUC(20000, 110, 0, 'OLTC');
    const sinTerc = clasificarUC(20000, 110, null, 'OLTC');
    assert.equal(conCero.devanado, 'bi');
    assert.equal(conCero.uucc_calc, sinTerc.uucc_calc);
    assert.ok(conCero.notas.some((n) => /terciaria/i.test(n)), 'debe dejar constancia');
  });

  test('un terciario real sí clasifica como tridevanado', () => {
    const r = clasificarUC(20000, 110, 13.8, 'OLTC');
    assert.equal(r.devanado, 'tri');
    assert.notEqual(r.uucc_calc, clasificarUC(20000, 110, null, 'OLTC').uucc_calc);
  });
});
