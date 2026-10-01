// Simulación de «tiempo real» de Cargabilidad — al detenerla vuelve lo MEDIDO.
//
// El botón activa una SIMULACIÓN (no hay telemetría conectada): cada 4 s mueve
// la corriente de cada devanado. Al detenerla se quedaba el último valor
// simulado, y la tabla («I medida») y la ventana de detalle lo seguían
// mostrando como si fuera la medida. Estas pruebas fijan que al detenerla
// cada corriente vuelve a su valor medido y su porcentaje con ella.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { store } from '../assets/js/ui/cargabilidad/state.js';
import { toggleLive, detenerLive, fijarBase } from '../assets/js/ui/cargabilidad/live.js';
import { recomputeAll } from '../assets/js/domain/cargabilidad_severidad.js';

const filas = () => recomputeAll(fijarBase([
  { id: 'A', P: { amp: 100, car: 97 }, S: { amp: 200, car: 50 }, T: { amp: null, car: null } },
  { id: 'B', P: { amp: 50, car: 20 }, S: { amp: null, car: null }, T: { amp: null, car: null } },
]));

// Lo que haría el temporizador: corrientes simuladas distintas de las medidas.
function simular(rows) {
  rows[0].P.car = 105.56; rows[0].S.car = 61.2; rows[1].P.car = 23.4;
  recomputeAll(rows);
}

after(() => detenerLive());

describe('toggleLive — al detener la simulación vuelve la medida', () => {

  test('al apagarla cada corriente y su porcentaje vuelven a lo medido', () => {
    store.setRows(filas(), 'parque');
    assert.equal(toggleLive(), true, 'enciende');
    simular(store.state.rows);
    assert.equal(store.state.rows[0].P.pct, 105.6, 'durante la simulación el valor es otro');
    assert.equal(toggleLive(), false, 'apaga');
    const [a, b] = store.state.rows;
    assert.equal(a.P.car, 97); assert.equal(a.P.pct, 97);
    assert.equal(a.S.car, 50); assert.equal(b.P.car, 20);
    assert.equal(a.cmax, 97, 'el máximo del equipo también vuelve');
  });

  test('un devanado sin medida sigue sin medida (no se inventa un cero)', () => {
    store.setRows(filas(), 'parque');
    toggleLive(); simular(store.state.rows); toggleLive();
    assert.equal(store.state.rows[0].T.car, null);
    assert.equal(store.state.rows[1].S.car, null);
  });

  test('detenerLive también devuelve lo medido', () => {
    store.setRows(filas(), 'parque');
    toggleLive(); simular(store.state.rows);
    detenerLive();
    assert.equal(store.state.live, false);
    assert.equal(store.state.rows[0].P.car, 97);
  });
});
