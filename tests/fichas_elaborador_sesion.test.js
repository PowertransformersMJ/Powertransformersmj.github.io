// Fichas · «Elaboración» por defecto según la SESIÓN (`99 §120`): en la sesión de Carlos va
// CARLOS MARTELO y en la de Jorge, JORGE RHENALS (con su cargo y su firma); lo elegido a mano
// manda; sin sesión identificada, el primero de la lista, como antes. Nombres de perfil SINTÉTICOS.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fijarElaboradorDeLaSesion, elaboradorDeLaSesion } from '../assets/js/domain/fichas_elaborador_sesion.js';
import { firmanteDe, indicePorDefecto, OTRA_PERSONA, casillaEsDeLaSesion } from '../assets/js/domain/fichas_firmantes.js';
import { planDeEstampado, personasALeer, IDS_EQUIPO } from '../assets/js/domain/firmas_equipo.js';
import { casillaDelegadaValida } from '../assets/js/domain/fichas_firmas_delegadas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leer = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
afterEach(() => fijarElaboradorDeLaSesion(''));

describe('quién va en «Elaboración» sin que nadie lo elija', () => {
  test('sin sesión identificada: el primero de la lista (el Ingeniero), como siempre', () => {
    assert.equal(elaboradorDeLaSesion(), '');
    assert.equal(indicePorDefecto('elab', {}), 0);
    assert.equal(firmanteDe('elab', {}).nombre, 'MIGUEL A. JIMENEZ');
  });
  test('sesión de Carlos: CARLOS MARTELO con su cargo; sesión de Jorge: JORGE RHENALS', () => {
    fijarElaboradorDeLaSesion('CARLOS MARTELO');
    assert.deepEqual(firmanteDe('elab', {}), { nombre: 'CARLOS MARTELO', ocupacion: 'ANALISTA DE TRANSFORMADORES AT', fecha: '', otra: false, indice: 1 });
    fijarElaboradorDeLaSesion('JORGE RHENALS');
    assert.equal(indicePorDefecto('elab', {}), 2);
    assert.equal(firmanteDe('elab', { fec_elab: '01/10/2026' }).nombre, 'JORGE RHENALS');
  });
  test('alguien que no es de la lista de Elaboración, o vacío: el primero', () => {
    fijarElaboradorDeLaSesion('JORGE MIRANDA');
    assert.equal(firmanteDe('elab', {}).nombre, 'MIGUEL A. JIMENEZ');
    fijarElaboradorDeLaSesion('  carlos martelo ');
    assert.equal(firmanteDe('elab', {}).nombre, 'CARLOS MARTELO');
    fijarElaboradorDeLaSesion(null);
    assert.equal(firmanteDe('elab', {}).nombre, 'MIGUEL A. JIMENEZ');
  });
  test('lo elegido a mano manda: otra persona de la lista, u «Otra persona»', () => {
    fijarElaboradorDeLaSesion('CARLOS MARTELO');
    assert.equal(firmanteDe('elab', { nom_elab: 'MIGUEL A. JIMENEZ' }).nombre, 'MIGUEL A. JIMENEZ');
    assert.equal(firmanteDe('elab', { nom_elab: 'JORGE RHENALS' }).nombre, 'JORGE RHENALS');
    assert.equal(firmanteDe('elab', { sel_elab: OTRA_PERSONA, nom_elab: 'PERSONA DE PRUEBA' }).nombre, 'PERSONA DE PRUEBA');
  });
  test('las demás casillas no cambian', () => {
    fijarElaboradorDeLaSesion('CARLOS MARTELO');
    assert.equal(firmanteDe('rev', {}).nombre, 'JORGE MIRANDA');
    assert.equal(firmanteDe('apr', {}).nombre, 'JORGE MIRANDA');
    assert.equal(firmanteDe('apr2', {}).nombre, 'ERICK VERGARA');
    assert.equal(firmanteDe('rec', {}).nombre, 'ERICK VERGARA');
  });
});

describe('con sus firmas: la de Carlos va en SU casilla', () => {
  test('con «Mi firma», la página le da su nombre de la lista y su casilla es la de la sesión (firma propia)', () => {
    fijarElaboradorDeLaSesion('CARLOS MARTELO');
    assert.ok(casillaEsDeLaSesion('elab', {}, 'CARLOS MARTELO'));
    const plan = planDeEstampado({}, 'CARLOS MARTELO', { propia: true, equipo: IDS_EQUIPO });
    assert.deepEqual(plan.map((c) => c.k + ':' + c.origen), ['elab:propia', 'rev:equipo', 'apr:equipo', 'apr2:equipo', 'rec:equipo']);
    assert.ok(!personasALeer({}, 'CARLOS MARTELO').includes('CARLOS_MARTELO'));
  });
  test('sin «Mi firma» (nombre vacío), su casilla lleva su firma del directorio, y cabe en la regla del folio', () => {
    fijarElaboradorDeLaSesion('CARLOS MARTELO');
    const plan = planDeEstampado({}, '', { propia: false, equipo: IDS_EQUIPO });
    assert.deepEqual(plan[0], { k: 'elab', nombre: 'CARLOS MARTELO', origen: 'equipo', id: 'CARLOS_MARTELO', motivo: '' });
    assert.ok(personasALeer({}, '').includes('CARLOS_MARTELO'));
    const deleg = { custodio: 'u', personaPropia: 'CARLOS_MARTELO', personas: [...IDS_EQUIPO], lote: 'A'.repeat(20) };
    assert.ok(casillaDelegadaValida({ k: 'elab', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'equipo', huella: 'e'.repeat(64) }, deleg));
    assert.ok(casillaDelegadaValida({ k: 'elab', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'propia', huella: 'e'.repeat(64) }, deleg));
  });
});

describe('una descarga no cambia de elaborador a la mitad (revisión de §120)', () => {
  test('exportar, vista previa y emisión leen y estampan sobre el plan CONGELADO de esa descarga', () => {
    const panel = leer('assets', 'js', 'ui', 'fichas', 'panel.js');
    assert.match(panel, /function planCongelado\(P\) \{/);
    assert.match(panel, /function estadoParaExportar\(e, base = planCongelado\(estadoDe\(e\)\.plan\)\)/);
    assert.match(panel, /const base = planCongelado\(estadoDe\(eq\)\.plan\);\n      const estado = estadoParaExportar\(eq, base\);/);
    assert.match(panel, /const soloPropia = estadoParaExportar\(eq, base\);/);
    // Ningún camino de descarga vuelve a leer el plan VIVO para decidir las firmas.
    assert.doesNotMatch(panel, /leerFirmasEquipo\(estadoDe\(eq\)\.plan\)/);
    assert.doesNotMatch(panel, /planDeEstampado\(estadoDe\(eq\)\.plan/);
  });
});

describe('la página y el Excel usan el MISMO estado', () => {
  test('el Excel toma el firmante de fichas_firmantes.js (el mismo módulo que la pantalla)', () => {
    assert.match(leer('assets', 'js', 'ui', 'fichas', 'exportar-planificacion.js'), /import \{ firmanteDe \} from '\.\.\/\.\.\/domain\/fichas_firmantes\.js';/);
    assert.match(leer('assets', 'js', 'domain', 'fichas_firmantes.js'), /import \{ elaboradorDeLaSesion \} from '\.\/fichas_elaborador_sesion\.js';/);
  });
  test('fichas-tecnicas.html fija el elaborador con SU clave del permiso de Fichas, y la hoja abierta se repinta', () => {
    const html = leer('pages', 'fichas-tecnicas.html');
    assert.match(html, /import\('\.\.\/assets\/js\/domain\/fichas_elaborador_sesion\.js'\)/);
    assert.match(html, /fijarElaboradorDeLaSesion\(usaDelegado\(\) && typeof delegadoFichas\.nombreEnLaLista === 'function'/);
    assert.match(leer('assets', 'js', 'ui', 'fichas', 'panel.js'), /repintarFirmante\('elab'\);/);
  });
});
