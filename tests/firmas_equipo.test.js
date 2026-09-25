// Firmas del EQUIPO estampadas por su custodio (`99 §99`). Dominio puro: quién
// es cada persona de la lista, qué firma lleva cada casilla y la declaración de
// la autorización. Sin firmas reales: el repositorio es público.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONAS_EQUIPO, IDS_EQUIPO, idDeNombreDeLista, personaDeCasilla, planDeEstampado,
  personasALeer, validarAutorizacion, folioDeEmision, nombreDePersona, hoyLocalISO
} from '../assets/js/domain/firmas_equipo.js';
import { FIRMANTES } from '../assets/js/domain/fichas_firmantes.js';

describe('La lista del equipo', () => {
  test('cubre a TODAS las personas de la lista dictada, con clave fija', () => {
    const nombres = new Set(Object.values(FIRMANTES).flat().map((p) => p.nombre));
    for (const n of nombres) assert.ok(idDeNombreDeLista(n), 'sin clave: ' + n);
    assert.deepEqual(IDS_EQUIPO, ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS', 'JORGE_MIRANDA', 'ERICK_VERGARA']);
    for (const id of IDS_EQUIPO) assert.match(id, /^[A-Z_]+$/);
  });

  test('los dos nombres dictados del Ingeniero son UNA persona; nada aproximado', () => {
    assert.equal(idDeNombreDeLista('MIGUEL A. JIMENEZ'), 'MIGUEL_JIMENEZ');
    assert.equal(idDeNombreDeLista('MIGUEL JIMENEZ'), 'MIGUEL_JIMENEZ');
    for (const n of ['Jorge Miranda', 'JORGE  MIRANDA', 'JORGE MIRANDA PEREZ', 'ERICK VERGARA DE LA A', '', null]) {
      assert.equal(idDeNombreDeLista(n), null, String(n));
    }
    assert.equal(nombreDePersona('ERICK_VERGARA'), 'ERICK VERGARA');
    assert.equal(PERSONAS_EQUIPO.length, 5);
  });
});

describe('Qué firma lleva cada casilla', () => {
  const TODO = { equipo: IDS_EQUIPO, propia: true };

  test('por defecto: la sesión del Ingeniero firma su casilla con la PROPIA; el resto sale del directorio (Recibe incluida)', () => {
    const p = planDeEstampado({}, 'Miguel Jimenez', TODO);
    assert.deepEqual(p.map((x) => [x.k, x.origen, x.id]), [
      ['elab', 'propia', 'MIGUEL_JIMENEZ'],
      ['rev', 'equipo', 'JORGE_MIRANDA'],
      ['apr', 'equipo', 'JORGE_MIRANDA'],
      ['apr2', 'equipo', 'ERICK_VERGARA'],
      ['rec', 'equipo', 'ERICK_VERGARA']
    ]);
  });

  test('«Otra persona» escrita IGUAL que alguien de la lista NUNCA recibe su firma del directorio', () => {
    const plan = { sel_rev: 'otro', nom_rev: 'JORGE MIRANDA', occ_rev: 'x' };
    assert.equal(personaDeCasilla('rev', plan), null);
    const rev = planDeEstampado(plan, 'Miguel Jimenez', TODO).find((x) => x.k === 'rev');
    assert.equal(rev.origen, null);
    assert.match(rev.motivo, /escrita a mano/);
  });

  test('la casilla de la sesión nunca usa el directorio, aunque falte su firma propia', () => {
    const p = planDeEstampado({}, 'Miguel Jimenez', { equipo: IDS_EQUIPO, propia: false });
    const elab = p.find((x) => x.k === 'elab');
    assert.equal(elab.origen, null);
    assert.match(elab.motivo, /firma propia/);
  });

  test('sin firma en el directorio: la casilla sale sin firma y lo dice', () => {
    const p = planDeEstampado({}, 'Miguel Jimenez', { equipo: ['ERICK_VERGARA'], propia: true });
    assert.deepEqual(p.filter((x) => x.origen).map((x) => x.k), ['elab', 'apr2', 'rec']);
    assert.match(p.find((x) => x.k === 'rev').motivo, /No hay firma suya/);
  });

  test('las personas que hay que leer del directorio: sin la de la sesión y sin repetir', () => {
    assert.deepEqual(personasALeer({}, 'Miguel Jimenez').sort(), ['ERICK_VERGARA', 'JORGE_MIRANDA']);
    assert.deepEqual(personasALeer({ nom_elab: 'CARLOS MARTELO' }, 'Miguel Jimenez').sort(), ['CARLOS_MARTELO', 'ERICK_VERGARA', 'JORGE_MIRANDA']);
    assert.deepEqual(personasALeer({ sel_rev: 'otro', nom_rev: 'JORGE MIRANDA' }, 'Jorge Miranda').sort(), ['ERICK_VERGARA', 'MIGUEL_JIMENEZ']);
  });
});

describe('La declaración de la autorización', () => {
  const HOY = '2026-09-25';
  test('fecha real no futura y medio de 3 a 200 caracteres', () => {
    assert.equal(validarAutorizacion({ fecha: '2026-09-20', medio: 'correo del 20/09/2026' }, HOY).ok, true);
    assert.equal(validarAutorizacion({ fecha: '2026-09-25', medio: 'acta' }, HOY).ok, true);
    for (const a of [{}, { fecha: '2026-02-30', medio: 'correo' }, { fecha: '20/09/2026', medio: 'correo' },
      { fecha: '2026-09-26', medio: 'correo' }, { fecha: '2026-09-20', medio: 'ok' }, { fecha: '2026-09-20', medio: 'x'.repeat(201) }]) {
      assert.equal(validarAutorizacion(a, HOY).ok, false, JSON.stringify(a).slice(0, 60));
    }
  });
});

describe('Folio', () => {
  test('folio corto y legible (va en el nombre del archivo; las firmas salen limpias)', () => {
    assert.equal(folioDeEmision('aB3dE5fG7hJ9kL1mN2pQ'), 'F-AB3DE5FG');
    assert.equal(folioDeEmision(''), 'F-');
  });
});

describe('«Hoy» en hora local', () => {
  test('a las 8 p. m. en Colombia (ya es mañana en UTC) hoy sigue siendo hoy', () => {
    const d = new Date(2026, 8, 25, 20, 0, 0);          // 25/09/2026 20:00 hora LOCAL
    assert.equal(hoyLocalISO(d), '2026-09-25');
    assert.equal(validarAutorizacion({ fecha: '2026-09-26', medio: 'Autorización verbal' }, hoyLocalISO(d)).ok, false);
    assert.equal(validarAutorizacion({ fecha: '2026-09-25', medio: 'Autorización verbal' }, hoyLocalISO(d)).ok, true);
  });
});
