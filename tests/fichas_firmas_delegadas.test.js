// Fichas Técnicas exportadas por un DELEGADO (`99 §119`): el custodio autoriza a Carlos o
// Jorge a sacar el PE.02081 con las firmas del directorio que marque. Lo puro: qué claves se
// leen, qué persona cabe en qué casilla (espejo EXACTO de la regla) y el contrato que la
// página le da al módulo de fichas. Nombres SINTÉTICOS: el repo es público.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DELEGABLES_FICHAS, PROPIAS_FICHAS, personasPorCasilla, delegacionFichasDe, puedeLeerDelegada, casillaDelegadaValida
} from '../assets/js/domain/fichas_firmas_delegadas.js';
import { IDS_EQUIPO, planDeEstampado } from '../assets/js/domain/firmas_equipo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leer = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
const REGLAS = leer('firestore.rules');
const LOTE = 'A'.repeat(20);
const H = 'e'.repeat(64);
const D = { custodio: 'u_custodio', custodioNombre: 'Custodio', personaPropia: 'CARLOS_MARTELO', personas: [...IDS_EQUIPO], lote: LOTE };

describe('la tabla «quién cabe en qué casilla» es la misma en la página y en la regla', () => {
  test('personasPorCasilla sale de la lista dictada', () => {
    assert.deepEqual(personasPorCasilla(), {
      elab: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS'],
      rev: ['JORGE_MIRANDA', 'MIGUEL_JIMENEZ'],
      apr: ['JORGE_MIRANDA', 'ERICK_VERGARA'],
      apr2: ['ERICK_VERGARA', 'JORGE_MIRANDA'],
      rec: ['ERICK_VERGARA']
    });
  });
  test('la expresión de `firmanteCabe` en firestore.rules acepta EXACTAMENTE esas parejas', () => {
    const m = REGLAS.match(/function firmanteCabe\(k, persona\) \{\s*return \(k \+ '\|' \+ persona\)\.matches\('([^']+)'\);/);
    assert.ok(m, 'no se encontró firmanteCabe en firestore.rules');
    const re = new RegExp(m[1]);
    const pc = personasPorCasilla();
    for (const k of ['elab', 'rev', 'apr', 'apr2', 'rec', 'otra']) {
      for (const p of [...IDS_EQUIPO, 'JUAN_CARDONA', '']) {
        assert.equal(re.test(k + '|' + p), (pc[k] || []).includes(p), k + '|' + p);
      }
    }
  });
  test('las cinco personas delegables y las dos «propias» son las mismas que exige la regla', () => {
    assert.deepEqual([...DELEGABLES_FICHAS], [...IDS_EQUIPO]);
    assert.match(REGLAS, /function delegablesFichas\(\) \{ return \['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS', 'JORGE_MIRANDA', 'ERICK_VERGARA'\]; \}/);
    assert.deepEqual([...PROPIAS_FICHAS], ['CARLOS_MARTELO', 'JORGE_RHENALS']);
    const bloque = REGLAS.slice(REGLAS.indexOf('match /firmas_delegados_fichas/{delegado}'));
    assert.match(bloque, /d\.personaPropia in \['CARLOS_MARTELO', 'JORGE_RHENALS'\]/);
  });
});

describe('la delegación leída de la base', () => {
  test('sirve solo la de Fichas, con lote y personas de la lista', () => {
    assert.deepEqual(delegacionFichasDe({ ...D, alcance: 'fichas', personas: ['ERICK_VERGARA', 'JUAN_CARDONA', 'MIGUEL_JIMENEZ'] }),
      { ...D, personas: ['MIGUEL_JIMENEZ', 'ERICK_VERGARA'] });
    assert.equal(delegacionFichasDe({ ...D, alcance: 'ordenes' }), null);
    assert.equal(delegacionFichasDe({ ...D, alcance: 'fichas', lote: 'corto' }), null);
    assert.equal(delegacionFichasDe({ ...D, alcance: 'fichas', personas: ['JUAN_CARDONA'] }), null);
    assert.equal(delegacionFichasDe({ ...D, alcance: 'fichas', custodio: '' }), null);
    assert.equal(delegacionFichasDe(null), null);
    assert.equal(delegacionFichasDe({ ...D, alcance: 'fichas', personaPropia: 'MIGUEL_JIMENEZ' }).personaPropia, '');
  });
  test('solo se piden al servidor las firmas que el permiso nombra', () => {
    const dos = { ...D, personas: ['MIGUEL_JIMENEZ', 'JORGE_MIRANDA'] };
    assert.ok(puedeLeerDelegada('JORGE_MIRANDA', dos));
    assert.ok(!puedeLeerDelegada('ERICK_VERGARA', dos));
    assert.ok(!puedeLeerDelegada('JUAN_CARDONA', D));
    assert.ok(!puedeLeerDelegada('MIGUEL_JIMENEZ', null));
  });
});

describe('las casillas que se registran (lo mismo que exige la regla, menos la huella del directorio)', () => {
  const c = (k, persona, origen = 'equipo', extra = {}) => ({ k, persona, nombre: 'NOMBRE', origen, huella: H, ...extra });
  test('del directorio: persona delegada y en SU casilla', () => {
    assert.ok(casillaDelegadaValida(c('rev', 'MIGUEL_JIMENEZ'), D));
    assert.ok(casillaDelegadaValida(c('apr2', 'JORGE_MIRANDA'), D));
    assert.ok(!casillaDelegadaValida(c('apr', 'MIGUEL_JIMENEZ'), D));
    assert.ok(!casillaDelegadaValida(c('elab', 'ERICK_VERGARA'), D));
    assert.ok(!casillaDelegadaValida(c('rev', 'JORGE_MIRANDA'), { ...D, personas: ['MIGUEL_JIMENEZ'] }));
    assert.ok(!casillaDelegadaValida(c('otra', 'MIGUEL_JIMENEZ'), D));
  });
  test('la propia: la de quien emite (su clave, o escrita a mano), nunca a nombre de otro', () => {
    assert.ok(casillaDelegadaValida(c('elab', 'CARLOS_MARTELO', 'propia'), D));
    assert.ok(casillaDelegadaValida(c('elab', '', 'propia'), D));
    assert.ok(!casillaDelegadaValida(c('rev', 'MIGUEL_JIMENEZ', 'propia'), D));
    assert.ok(!casillaDelegadaValida(c('elab', 'JORGE_RHENALS', 'propia'), D));
  });
  test('forma: huella de 64, nombre de hasta 80, origen conocido', () => {
    assert.ok(!casillaDelegadaValida(c('rev', 'MIGUEL_JIMENEZ', 'equipo', { huella: 'zz' }), D));
    assert.ok(!casillaDelegadaValida(c('rev', 'MIGUEL_JIMENEZ', 'equipo', { nombre: 'X'.repeat(81) }), D));
    assert.ok(!casillaDelegadaValida(c('rev', 'MIGUEL_JIMENEZ', 'otro'), D));
    assert.ok(!casillaDelegadaValida(null, D));
  });
  test('todo lo que el plan de la ficha estampa del directorio cabe en la regla', () => {
    // Plan por defecto (§89): el Ingeniero elabora y revisa; Jorge Miranda aprueba; Erick aprueba 2.º y recibe.
    const plan = planDeEstampado({}, 'NOMBRE DE OTRA SESION', { propia: false, equipo: IDS_EQUIPO });
    const del = plan.filter((x) => x.origen === 'equipo');
    assert.equal(del.length, 5);
    for (const x of del) assert.ok(casillaDelegadaValida({ k: x.k, persona: x.id, nombre: x.nombre, origen: 'equipo', huella: H }, D), x.k);
  });
});

describe('la página: el custodio manda y el módulo de fichas no cambia de contrato', () => {
  test('el módulo de fichas solo usa las cuatro funciones que el adaptador del delegado también tiene', () => {
    const panel = leer('assets', 'js', 'ui', 'fichas', 'panel.js');
    const usadas = new Set([...panel.matchAll(/cfg\.firmasEquipo\.([A-Za-z]+)/g)].map((m) => m[1]));
    assert.deepEqual([...usadas].sort(), ['disponible', 'leer', 'nuevaEmisionId', 'registrarEmision']);
    const datos = leer('assets', 'js', 'data', 'firmas_delegadas_fichas.js');
    for (const f of usadas) assert.match(datos, new RegExp('\\n    (async )?' + f + '\\('), f);
  });
  test('fichas-tecnicas.html: si es custodio usa su directorio; el delegado, solo si no lo es', () => {
    const html = leer('pages', 'fichas-tecnicas.html');
    assert.match(html, /const usaDelegado = \(\) => !esCustodio\(\) && !!\(delegadoFichas && delegadoFichas\.disponible\(\)\);/);
    assert.match(html, /disponible\(\) \{ return esCustodio\(\) \|\| usaDelegado\(\); \}/);
    assert.match(html, /import\('\.\.\/assets\/js\/data\/firmas_delegadas_fichas\.js'\)/);
    assert.match(html, /id="panelFirmasDelegadasFichas"/);
  });
});
