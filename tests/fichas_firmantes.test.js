// Quién firma el PE.02081 — la lista DICTADA por el Ingeniero (2026-09-23,
// `99 §89`) y la función que usan por igual la pantalla y el Excel.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRMANTES, CASILLAS_FIRMA, OTRA_PERSONA, firmanteDe, indicePorDefecto, casillasDeLaSesion, casillaEsDeLaSesion
} from '../assets/js/domain/fichas_firmantes.js';
import { tamanoFirma, FIRMA_PAPEL } from '../assets/js/domain/firmas_tamano.js';
import { tieneContenido } from '../assets/js/domain/fichas_borrador.js';

describe('La lista dictada, LITERAL (anti-paráfrasis)', () => {
  test('cada casilla con sus personas y cargos, letra por letra y en su orden', () => {
    const plano = (k) => FIRMANTES[k].map((p) => p.nombre + ' | ' + p.ocupacion);
    assert.deepEqual(plano('elab'), [
      'MIGUEL A. JIMENEZ | PROFESIONAL EN TRANSFORMADORES DE POTENCIA',
      'CARLOS MARTELO | ANALISTA DE TRANSFORMADORES AT',
      'JORGE RHENALS | ANALISTA DE TRANSFORMADORES AT'
    ]);
    assert.deepEqual(plano('rev'), [
      'JORGE MIRANDA | LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT',
      'MIGUEL JIMENEZ | PROFESIONAL EN TRANSFORMADORES DE POTENCIA'
    ]);
    assert.equal(plano('apr')[0], 'JORGE MIRANDA | LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT');
    assert.equal(plano('apr2')[0], 'ERICK VERGARA | JEFE OPERATIVA MANTENIMIENTO RED ALTA TENSION (E)');
    assert.deepEqual(plano('rec'), ['ERICK VERGARA | SUBGERENTE MANTENIMIENTO RED ALTA TENSION']);
    assert.deepEqual(CASILLAS_FIRMA, ['elab', 'rev', 'apr', 'apr2', 'rec']);
  });

  test('ni una cédula en la lista: el repo es público (`§70`, `§78`)', () => {
    for (const k of CASILLAS_FIRMA) {
      for (const p of FIRMANTES[k]) {
        assert.deepEqual(Object.keys(p).sort(), ['nombre', 'ocupacion']);
        assert.ok(!/\d{5,}/.test(p.nombre + p.ocupacion));
      }
    }
  });
});

describe('firmanteDe — lo que se imprime en cada casilla', () => {
  test('sin nada escrito: la primera persona de la casilla, con su cargo', () => {
    assert.deepEqual(firmanteDe('elab', {}), {
      nombre: 'MIGUEL A. JIMENEZ', ocupacion: 'PROFESIONAL EN TRANSFORMADORES DE POTENCIA', fecha: '', otra: false, indice: 0
    });
    assert.equal(firmanteDe('apr2', {}).nombre, 'ERICK VERGARA');
    assert.equal(firmanteDe('rec', {}).ocupacion, 'SUBGERENTE MANTENIMIENTO RED ALTA TENSION');
  });

  test('elegir otra persona de la lista trae SU cargo', () => {
    const f = firmanteDe('elab', { nom_elab: 'CARLOS MARTELO' });
    assert.equal(f.indice, 1);
    assert.equal(f.ocupacion, 'ANALISTA DE TRANSFORMADORES AT');
  });

  test('una ficha vieja con el nombre tecleado se reconoce sola (sin importar mayúsculas)', () => {
    const f = firmanteDe('rev', { nom_rev: '  miguel jimenez ' });
    assert.equal(f.indice, 1);
    assert.equal(f.nombre, 'MIGUEL JIMENEZ');
  });

  test('un nombre que no está en la lista, o «Otra persona», sale tal cual se escribió', () => {
    assert.deepEqual(firmanteDe('rec', { nom_rec: 'PERSONA DE PRUEBA', occ_rec: 'CARGO DE PRUEBA' }),
      { nombre: 'PERSONA DE PRUEBA', ocupacion: 'CARGO DE PRUEBA', fecha: '', otra: true, indice: -1 });
    assert.deepEqual(firmanteDe('elab', { sel_elab: OTRA_PERSONA, nom_elab: '', occ_elab: '' }),
      { nombre: '', ocupacion: '', fecha: '', otra: true, indice: -1 });
  });

  test('una persona de la lista lleva SIEMPRE su cargo dictado: un cargo viejo no se le pega; la fecha viaja', () => {
    // Revisión §89: una ficha vieja con solo el cargo tecleado imprimía «JORGE MIRANDA / Subgerente…».
    const f = firmanteDe('apr', { occ_apr: 'Subgerente Mantenimiento AT', fec_apr: ' 03/10/2026 ' });
    assert.equal(f.nombre, 'JORGE MIRANDA');
    assert.equal(f.ocupacion, 'LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT');
    assert.equal(f.fecha, '03/10/2026');
  });

  test('el segundo aprobador no repite a quien ya está en el primero', () => {
    // Ficha vieja: Aprobación tenía un solo campo y se tecleó «Erick Vergara».
    const vieja = { nom_apr: 'Erick Vergara', occ_apr: 'Subgerente Mantenimiento AT' };
    assert.equal(firmanteDe('apr', vieja).nombre, 'ERICK VERGARA');
    assert.equal(firmanteDe('apr2', vieja).nombre, 'JORGE MIRANDA');
    assert.equal(indicePorDefecto('apr2', vieja), 1);
    // Sin nada escrito, el orden dictado: Miranda y Vergara.
    assert.equal(firmanteDe('apr2', {}).nombre, 'ERICK VERGARA');
    // Si se elige explícitamente, manda la elección.
    assert.equal(firmanteDe('apr2', { nom_apr: 'ERICK VERGARA', nom_apr2: 'ERICK VERGARA' }).nombre, 'ERICK VERGARA');
  });

  test('«Otra persona» explícita con el nombre borrado NO vuelve sola a la persona por defecto', () => {
    // Revisión §89: se imprimía ERICK VERGARA con el cargo viejo de otra persona.
    assert.deepEqual(firmanteDe('rec', { sel_rec: OTRA_PERSONA, nom_rec: '', occ_rec: 'CARGO VIEJO DE PRUEBA' }),
      { nombre: '', ocupacion: 'CARGO VIEJO DE PRUEBA', fecha: '', otra: true, indice: -1 });
  });
});

describe('El borrador no cuenta como trabajo lo que no lo es (revisión §89)', () => {
  test('la marca «Otra persona» sin nombre escrito no es contenido; con nombre, sí', () => {
    assert.equal(tieneContenido({ plan: { sel_elab: OTRA_PERSONA, nom_elab: '', occ_elab: '' } }), false);
    assert.equal(tieneContenido({ plan: { sel_elab: OTRA_PERSONA, nom_elab: 'PERSONA DE PRUEBA' } }), true);
  });
});

describe('Firma estampada: solo en la casilla de quien tiene la sesión (`99 §98`)', () => {
  test('el Ingeniero firma en SU casilla con cualquiera de sus dos nombres dictados', () => {
    for (const perfil of ['Miguel Jiménez', 'MIGUEL JIMENEZ', 'Miguel A. Jiménez', ' miguel  a. jimenez ']) {
      assert.deepEqual(casillasDeLaSesion({}, perfil), ['elab'], perfil);
    }
    // Revisión con su nombre: firma en las dos.
    assert.deepEqual(casillasDeLaSesion({ nom_rev: 'MIGUEL JIMENEZ' }, 'Miguel Jimenez'), ['elab', 'rev']);
  });

  test('un nombre parecido NO firma: la regla no se afloja (iniciales, apellidos de más)', () => {
    for (const perfil of ['Miguel Jimenez Perez', 'Miguel Angel Jimenez', 'M. Jimenez', 'Jimenez', '', null]) {
      assert.deepEqual(casillasDeLaSesion({}, perfil), [], String(perfil));
    }
  });

  test('cada quien solo en las suyas; nadie en la del otro', () => {
    assert.deepEqual(casillasDeLaSesion({}, 'Jorge Miranda'), ['rev', 'apr']);
    assert.deepEqual(casillasDeLaSesion({}, 'Erick Vergara'), ['apr2', 'rec']);
    assert.deepEqual(casillasDeLaSesion({}, 'Carlos Martelo'), []);
    assert.deepEqual(casillasDeLaSesion({ nom_elab: 'CARLOS MARTELO' }, 'Carlos Martelo'), ['elab']);
    assert.equal(casillaEsDeLaSesion('elab', { nom_elab: 'CARLOS MARTELO' }, 'Miguel Jimenez'), false);
  });

  test('«Otra persona» firma solo con lo escrito TAL CUAL (sin los alias de la lista)', () => {
    const plan = { sel_elab: 'otro', nom_elab: 'Ana Pérez', occ_elab: 'Cargo' };
    assert.equal(casillaEsDeLaSesion('elab', plan, 'ANA PEREZ'), true);
    assert.equal(casillaEsDeLaSesion('elab', { sel_elab: 'otro', nom_elab: 'MIGUEL JIMENEZ' }, 'Miguel A. Jimenez'), false);
    // La Ñ no se confunde con la N (`§71.4`), tampoco pegada como «N» + tilde
    // combinable (NFD), que es como llega desde algunos PDF (revisión de §98).
    assert.equal(casillaEsDeLaSesion('elab', { sel_elab: 'otro', nom_elab: 'JUAN MUÑOZ' }, 'Juan Munoz'), false);
    const nfd = 'JUAN MUN\u0303OZ';
    assert.equal(casillaEsDeLaSesion('elab', { sel_elab: 'otro', nom_elab: nfd }, 'Juan Munoz'), false);
    assert.equal(casillaEsDeLaSesion('elab', { sel_elab: 'otro', nom_elab: nfd }, 'Juan Muñoz'), true);
    assert.equal(casillaEsDeLaSesion('elab', { sel_elab: 'otro', nom_elab: 'JUAN MUNOZ' }, 'Juan Mun\u0303oz'), false);
  });
});

describe('Tamaño de la firma estampada: mismo peso visual para todas (`99 §101`)', () => {
  const LIM = { area: FIRMA_PAPEL.areaPt2, altoMax: FIRMA_PAPEL.altoMaxPt, anchoMax: 148 };
  // Proporciones REALES de las cinco firmas cargadas el 2026-09-25 (ancho / alto).
  const REALES = [1.68, 2.5, 3.08, 3.44, 5.83];
  test('las firmas reales: misma superficie las que caben; la alta, al tope del renglón', () => {
    const umbral = LIM.area / (LIM.altoMax * LIM.altoMax);
    for (const rel of REALES) {
      const t = tamanoFirma(rel, LIM);
      assert.ok(t.alto <= LIM.altoMax && t.ancho <= LIM.anchoMax, 'dentro con rel ' + rel);
      if (rel >= umbral) assert.ok(Math.abs(t.ancho * t.alto - LIM.area) < 1, 'superficie con rel ' + rel);
      else assert.equal(t.alto, LIM.altoMax, 'la alta llega al renglón con rel ' + rel);
    }
  });
  test('una firma alta no pasa del renglón de «Firma:» (crece hasta él, no más)', () => {
    const t = tamanoFirma(1.68, LIM);
    assert.equal(t.alto, LIM.altoMax);
    assert.ok(Math.abs(t.ancho - 1.68 * LIM.altoMax) < 1e-9);
  });
  test('una firma muy ancha no se sale de la casilla: se achica sin deformarse', () => {
    const t = tamanoFirma(40, { ...LIM, anchoMax: 100 });
    assert.equal(t.ancho, 100);
    assert.ok(Math.abs(t.ancho / t.alto - 40) < 1e-9);
  });
  test('la ancha se ve más baja y la alta más angosta que antes (ya no gana la ancha)', () => {
    const ancha = tamanoFirma(5.83, LIM); const alta = tamanoFirma(1.68, LIM);
    assert.ok(ancha.ancho < 5.83 * 22, 'antes medía 128 pt de ancho');
    const antes = (5.83 * 22) / (1.68 * 22);
    assert.ok(ancha.ancho / alta.ancho < antes * 0.7, 'la diferencia de ancho entre las extremas baja al menos un 30 %');
  });
  test('proporción inválida: la de una firma típica', () => {
    assert.deepEqual(tamanoFirma(NaN, LIM), tamanoFirma(2.5, LIM));
  });
});
