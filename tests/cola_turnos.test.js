// Cola de turnos de la Configuración del Informe de Brigada (`99 §163.15`): pruebas de COMPORTAMIENTO, con un
// «guardado» lento de mentira que imita el caso real (subir firmas o logos mientras se guarda).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearColaDeTurnos } from '../assets/js/domain/cola_turnos.js';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Configuración de mentira: un borrador, un servidor y un guardado lento que toma la foto al empezar (como Firestore). */
function escenario(msGuardado = 40) {
  const cola = crearColaDeTurnos();
  let borrador = { firmas: {} };
  let servidor = { firmas: {} };
  let enVuelo = 0; let maxEnVuelo = 0;
  const guardarAhora = async () => {
    enVuelo++; maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
    const foto = JSON.parse(JSON.stringify(borrador));
    await dormir(msGuardado);
    servidor = foto;
    borrador = JSON.parse(JSON.stringify(servidor));   // como la pantalla: tras guardar, el borrador es lo leído del servidor
    enVuelo--;
    return true;
  };
  return {
    cola,
    guardar: () => cola.enTurno(guardarAhora),
    enlazar: (clave, valor) => cola.enTurno(() => { borrador.firmas[clave] = valor; return guardarAhora(); }),
    servidor: () => servidor,
    maxEnVuelo: () => maxEnVuelo
  };
}

describe('cola de turnos', () => {
  test('corre una tarea a la vez y en el orden de llegada', async () => {
    const cola = crearColaDeTurnos(); const orden = []; let enVuelo = 0; let max = 0;
    const tarea = (n, ms) => () => cola.enTurno(async () => { enVuelo++; max = Math.max(max, enVuelo); await dormir(ms); orden.push(n); enVuelo--; return n; });
    const r = await Promise.all([tarea(1, 30)(), tarea(2, 5)(), tarea(3, 15)()]);
    assert.deepEqual(r, [1, 2, 3]);
    assert.deepEqual(orden, [1, 2, 3]);
    assert.equal(max, 1, 'nunca dos a la vez');
    assert.equal(cola.ocupada, false);
  });
  test('si una tarea falla, su llamador recibe el error y la siguiente igual corre', async () => {
    const cola = crearColaDeTurnos();
    const mala = cola.enTurno(async () => { await dormir(5); throw new Error('sin red'); });
    const buena = cola.enTurno(() => 'ok');
    await assert.rejects(mala, /sin red/);
    assert.equal(await buena, 'ok');
    assert.equal(cola.pendientes, 0);
  });
  test('«ocupada» mientras haya algo en curso o esperando', async () => {
    const cola = crearColaDeTurnos();
    const p = cola.enTurno(() => dormir(10));
    assert.equal(cola.ocupada, true);
    assert.equal(cola.pendientes, 1);
    await p; await dormir(0);
    assert.equal(cola.ocupada, false);
  });
});

describe('el caso real: imágenes que terminan de subir mientras se guarda (§163.15)', () => {
  test('el Ingeniero guarda y en medio terminan de subir DOS firmas: quedan las dos', async () => {
    const e = escenario(40);
    const manual = e.guardar();
    await dormir(5);
    const [a, b] = [e.enlazar('beto', 'firma-beto'), e.enlazar('carla', 'firma-carla')];
    assert.deepEqual(await Promise.all([manual, a, b]), [true, true, true]);
    assert.deepEqual(e.servidor().firmas, { beto: 'firma-beto', carla: 'firma-carla' });
    assert.equal(e.maxEnVuelo(), 1, 'nunca dos guardados a la vez');
  });
  test('cinco logos seguidos: quedan los cinco', async () => {
    const e = escenario(15);
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((k) => e.enlazar(k, 'logo-' + k)));
    assert.deepEqual(Object.keys(e.servidor().firmas).sort(), ['a', 'b', 'c', 'd', 'e']);
  });
  test('doble clic en «Guardar configuración» no deja la cola colgada', async () => {
    const e = escenario(10);
    const r = await Promise.race([Promise.all([e.guardar(), e.guardar(), e.enlazar('ana', 'firma-ana')]), dormir(2000).then(() => 'colgada')]);
    assert.notEqual(r, 'colgada');
    assert.equal(e.servidor().firmas.ana, 'firma-ana');
  });
});
