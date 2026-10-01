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
// valor, y nada se toma de otra parte para rellenar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIN_DATO, textoODash, diagnosticoDe, condicionDe, fraseCarga, picoPrimario, tensionTexto
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

describe('diagnosticoDe — sin `diag` no se inventa un diagnóstico', () => {

  // 🔒 El error reportado: `d.diag` indefinido en una fila del parque.
  test('una fila del parque (sin diag) da las cinco calificaciones en null', () => {
    const f = parque();
    assert.equal(f.diag, undefined, 'la fila del parque no trae diag');
    assert.deepEqual(diagnosticoDe(f), { carg: null, edad: null, dga: null, fur: null, herm: null });
  });

  // Las calificaciones del registro (calif_crg, calif_edad…) NO se toman para
  // rellenar: tienen su propia escala y vocabulario oficial, y calif_crg tiene
  // deuda abierta (10 TODO-64.b / TODO-56). Mostrarlas aquí es decisión aparte.
  test('no toma calificaciones de salud_actual para rellenar', () => {
    const d = diagnosticoDe(parque());
    assert.equal(d.carg, null, 'calif_crg del registro no se cuela');
    assert.equal(d.edad, null, 'calif_edad del registro no se cuela');
  });

  test('una fila con diag (formato del archivo original) se respeta', () => {
    assert.deepEqual(diagnosticoDe({ diag: { carg: 4, edad: 2, dga: 1, fur: 3, herm: 5 } }),
      { carg: 4, edad: 2, dga: 1, fur: 3, herm: 5 });
  });

  test('lo que no es número no pasa por calificación', () => {
    assert.deepEqual(diagnosticoDe({ diag: { carg: '', edad: 'x', dga: {}, fur: true, herm: null } }),
      { carg: null, edad: null, dga: null, fur: null, herm: null });
    for (const d of [null, undefined, {}, { diag: null }, { diag: 'x' }]) {
      assert.deepEqual(diagnosticoDe(d), { carg: null, edad: null, dga: null, fur: null, herm: null });
    }
  });
});

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

describe('picoPrimario — sin medida del primario no hay curva', () => {

  // 🔒 La curva se dibujaba con `car || 0`: una línea en «0,0 A» que nadie midió.
  test('sin corriente medida en el primario devuelve null, no cero', () => {
    assert.equal(picoPrimario(parque()), null);
    assert.equal(picoPrimario({ P: { car: null } }), null);
    assert.equal(picoPrimario({}), null);
    assert.equal(picoPrimario(null), null);
  });

  test('con medida devuelve la corriente medida, también si es cero', () => {
    assert.equal(picoPrimario({ P: { car: 160.4 } }), 160.4);
    assert.equal(picoPrimario({ P: { car: 0 } }), 0, 'un cero medido sí es un dato');
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

  test('dentro de capacidad lo dice de los devanados medidos', () => {
    assert.match(fraseCarga(parque()), /dentro de su capacidad nominal en los devanados medidos/);
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
