// Ventana de detalle de Cargabilidad — lo que afirma de UN equipo.
//
// El clic en una fila de la tabla priorizada no abría nada: la ventana leía
// `d.diag.carg` y NINGUNA fuente viva trae `diag` —ni las filas del parque
// real ni el baseline de demostración—, así que reventaba antes de mostrarse.
// Detrás de ese error había más: la refrigeración salía «[object Object]»,
// la curva del primario se dibujaba en «0,0 A» sin medida, la frase decía
// «dentro de su capacidad» sin dato y la condición «medio» salía en verde.
//
// La regla que fijan estas pruebas: lo que falta se muestra «—», nunca un
// valor, y nada se toma de otra parte para rellenar. El «Diagnóstico» (sin
// `diag` → «—»; desde `99 §124`, las calificaciones de Salud de Activos) se
// prueba en tests/cargabilidad_diagnostico.test.js; la curva de ejemplo se
// retiró (§124).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIN_DATO, textoODash, condicionDe, fraseCarga, tensionTexto,
  estadoDevanado, devanadoReferencia, lecturaSobrecarga
} from '../assets/js/domain/cargabilidad_detalle.js';
import { filaCargabilidad } from '../assets/js/domain/cargabilidad_parque.js';
import { recompute } from '../assets/js/domain/cargabilidad_severidad.js';

// Un equipo con la FORMA real de /transformadores (v2): la refrigeración es un
// grupo de datos vacío, la condición es la clave del bucket y el primario no
// tiene medida (solo el secundario). Nombres inventados.
const parque = (extra = {}) => recompute(filaCargabilidad({
  identificacion: { matricula: 'EJ-1', uucc: 'N3T2', grupo: '' },
  ubicacion: { subestacion_nombre: 'EJEMPLO', departamento: 'sucre' },
  placa: { potencia_kva: 12500 },
  refrigeracion: { tipo_refrigeracion: '', cantidad_radiadores: null },
  electrico: {
    tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8,
    corriente_nominal_secundaria_a: 523, corriente_medida_secundaria_a: 455
  },
  salud_actual: { bucket: 'medio', calif_crg: 3, calif_edad: 4 },
  ...extra
}));

describe('condicionDe — la condición con su nombre oficial, no la clave cruda', () => {

  // 🔒 Salía «medio» en verde: la ventana pintaba de verde toda condición
  // que no dijera «OBSOLETO», también «muy_pobre».
  test('la clave del bucket sale con su nombre y su color oficiales', () => {
    assert.deepEqual(condicionDe('muy_pobre'), { texto: 'Muy Pobre', color: '#E53935' });
    assert.deepEqual(condicionDe('medio'), { texto: 'Medio', color: '#F5C518' });
    assert.deepEqual(condicionDe('muy_bueno'), { texto: 'Muy Bueno', color: '#1B8E3F' });
  });

  test('sin condición, o «N/D», muestra «—» sin color de juicio', () => {
    for (const c of ['', '  ', 'N/D', null, undefined, {}]) {
      assert.deepEqual(condicionDe(c), { texto: SIN_DATO, color: null });
    }
  });

  test('un texto que no es clave se muestra tal cual; OBSOLETO conserva su rojo', () => {
    assert.deepEqual(condicionDe('REGULAR'), { texto: 'REGULAR', color: null });
    assert.deepEqual(condicionDe('OBSOLETO'), { texto: 'OBSOLETO', color: 'var(--cri)' });
  });
});

describe('fraseCarga — solo afirma lo que sostienen los datos', () => {

  test('sin medida no dice que el equipo opera bien', () => {
    assert.match(fraseCarga({ cmax: null }), /Sin corriente medida/);
    assert.match(fraseCarga(null), /Sin corriente medida/);
  });

  // 🔒 Decía «supera … y el 1er límite SCADA» aunque el equipo no tuviera
  // límite SCADA: las filas del parque traen l1 = null.
  test('en sobrecarga sin límite SCADA no menciona el límite', () => {
    const f = parque({ electrico: {
      corriente_nominal_primaria_a: 131.2, corriente_medida_primaria_a: 160.4,
      corriente_nominal_secundaria_a: 418.4, corriente_medida_secundaria_a: 300
    } });
    const t = fraseCarga(f);
    assert.match(t, /primario supera su ampacidad nominal/);
    assert.doesNotMatch(t, /límite SCADA/);
  });

  test('con límite SCADA conocido y superado, sí lo dice', () => {
    const d = recompute({ P: { amp: 33, car: 40, l1: 32, l2: 33.7 }, S: { amp: null, car: null }, T: {} });
    assert.match(fraseCarga(d), /supera su ampacidad nominal y el 1er límite SCADA/);
  });

  test('nombra el devanado que de verdad supera la ampacidad', () => {
    const f = parque({ electrico: {
      corriente_nominal_primaria_a: 100, corriente_medida_primaria_a: 50,
      corriente_nominal_secundaria_a: 100, corriente_medida_secundaria_a: 130
    } });
    assert.match(fraseCarga(f), /secundario supera/);
  });

  test('dentro de capacidad lo dice solo de los devanados con medida y ampacidad', () => {
    assert.match(fraseCarga(parque()), /dentro de su capacidad nominal en los devanados con medida y ampacidad\.$/);
  });

  // 🔒 Ningún campo dice que la medida sea un pico ni de qué hora es.
  test('no afirma «pico de demanda»: habla de la medida registrada', () => {
    const d = recompute({ P: { amp: 100, car: 130 }, S: {}, T: {} });
    assert.doesNotMatch(fraseCarga(d), /pico de demanda/);
    assert.match(fraseCarga(d), /en la medida registrada/);
  });

  // 🔒 Un terciario con 40 A medidos y sin ampacidad no entra en cmax: decir
  // que «los devanados medidos» están bien lo daba por evaluado.
  test('avisa del devanado con corriente pero sin ampacidad', () => {
    const d = recompute({ P: { amp: 100, car: 60 }, S: { amp: 200, car: 50 }, T: { amp: null, car: 40 } });
    assert.match(fraseCarga(d), /El terciario tiene corriente medida pero no ampacidad: no se pudo evaluar\./);
    const dos = recompute({ P: { amp: 100, car: 60 }, S: { amp: null, car: 50 }, T: { amp: null, car: 40 } });
    assert.match(fraseCarga(dos), /El secundario y el terciario tienen corriente medida pero no ampacidad/);
  });
});

describe('estadoDevanado — qué se sabe de cada devanado (no todo es «N/A»)', () => {

  test('corriente y ampacidad: medido', () => {
    assert.equal(estadoDevanado({ P: { amp: 100, car: 60 } }, 'P'), 'medido');
    assert.equal(estadoDevanado({ P: { amp: 100, car: 0 } }, 'P'), 'medido', 'un cero medido es dato');
  });

  // 🔒 Los 40 A medidos de un devanado sin ampacidad no pueden esconderse.
  test('corriente sin ampacidad: sin_ampacidad (la corriente se muestra)', () => {
    assert.equal(estadoDevanado({ T: { amp: null, car: 40 }, vt: '34.5' }, 'T'), 'sin_ampacidad');
    assert.equal(estadoDevanado({ S: { amp: 0, car: 40 } }, 'S'), 'sin_ampacidad', 'ampacidad cero no sirve');
  });

  test('ampacidad sin corriente: sin_medida', () => {
    assert.equal(estadoDevanado({ P: { amp: 100, car: null } }, 'P'), 'sin_medida');
    assert.equal(estadoDevanado(parque(), 'P'), 'sin_dato', 'la fila de ejemplo no trae nada del primario');
  });

  test('terciario de un equipo sin tensión terciaria: no aplica; si la hay: sin dato', () => {
    assert.equal(estadoDevanado(parque(), 'T'), 'no_aplica');
    assert.equal(estadoDevanado({ T: {}, vt: '34.5' }, 'T'), 'sin_dato');
    assert.equal(estadoDevanado({ P: {} }, 'P'), 'sin_dato', 'el primario nunca «no aplica»');
    assert.equal(estadoDevanado(null, 'P'), 'sin_dato');
  });
});

describe('devanadoReferencia — la caja y la sobrecarga miran al devanado más cargado', () => {

  // 🔒 Con el secundario sobrecargado la caja salía verde «con margen en primario».
  test('con el secundario más cargado, la referencia es el secundario', () => {
    const d = recompute({ P: { amp: 33, car: 30 }, S: { amp: 83, car: 90 }, T: {} });
    assert.equal(devanadoReferencia(d), 'S');
  });

  test('sin devanado dominante, el primario', () => {
    assert.equal(devanadoReferencia({ dev: null }), 'P');
    assert.equal(devanadoReferencia(null), 'P');
  });
});

describe('lecturaSobrecarga — el factor medido no se confunde con el escalón de la tabla', () => {

  // 🔒 La tarjeta decía «Factor 1.1×» con 102 % medido.
  test('separa el factor medido del escalón de la tabla', () => {
    const l = lecturaSobrecarga({ car: 102, amp: 100 });
    assert.equal(l.pct, 102, 'lo que se muestra es la carga medida');
    assert.equal(l.factor, 1.02);
    assert.equal(l.escalon, 1.1);
    assert.equal(l.fueraDeTabla, false);
    assert.equal(typeof l.minutos, 'number');
  });

  // 🔒 Con 180 % daba «5 min» del escalón 1,5 y un envejecimiento extrapolado.
  test('por encima del último escalón no da minutos ni envejecimiento', () => {
    const l = lecturaSobrecarga({ car: 180, amp: 100 });
    assert.equal(l.factor, 1.8);
    assert.equal(l.tope, 1.5, 'el último escalón sale de la propia tabla');
    assert.equal(l.fueraDeTabla, true);
    assert.equal(l.minutos, null);
    assert.equal(l.envejecimiento, null);
  });

  // 🔒 Con 100,3 % el factor redondeado decía «1,00×» bajo «Sobrecarga»; con
  // 150,4 %, «1,50× por encima del 1,50×». El porcentaje no se contradice.
  test('cerca de los bordes el porcentaje medido no se contradice', () => {
    assert.equal(lecturaSobrecarga({ car: 100.3, amp: 100 }).pct, 100.3);
    const borde = lecturaSobrecarga({ car: 150.4, amp: 100 });
    assert.equal(borde.pct, 150.4);
    assert.equal(borde.fueraDeTabla, true);
    assert.equal(lecturaSobrecarga({ car: 150, amp: 100 }).fueraDeTabla, false, '150 % justo está en la tabla');
  });

  test('sin sobrecarga o sin dato: null (no hay nada que estimar)', () => {
    for (const o of [{ car: 99, amp: 100 }, { car: 100, amp: 100 }, { car: null, amp: 100 },
      { car: 120, amp: null }, { car: 120, amp: 0 }, null, undefined]) {
      assert.equal(lecturaSobrecarga(o), null, JSON.stringify(o));
    }
  });
});

describe('tensionTexto y textoODash — un hueco es «—»', () => {

  test('tensiones completas como antes; terciaria solo si existe', () => {
    assert.equal(tensionTexto({ vp: '34.5', vs: '13.8', vt: 'N/A' }), '34.5 / 13.8 kV');
    assert.equal(tensionTexto({ vp: '110', vs: '13.8', vt: '34.5' }), '110 / 13.8 / 34.5 kV');
  });

  test('sin ninguna tensión, «—» (no « /  kV»)', () => {
    assert.equal(tensionTexto({ vp: '', vs: '', vt: 'N/A' }), SIN_DATO);
    assert.equal(tensionTexto({}), SIN_DATO);
    assert.equal(tensionTexto({ vp: '34.5', vs: '', vt: 'N/A' }), '34.5 / — kV');
  });

  test('vacío, nulo u objeto se muestran «—»', () => {
    for (const v of ['', '   ', null, undefined, {}, []]) assert.equal(textoODash(v), SIN_DATO);
    assert.equal(textoODash('G2'), 'G2');
    assert.equal(textoODash(0), '0');
  });
});
