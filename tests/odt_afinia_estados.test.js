// Firma de ODT Afinia · máquina de estados y turno (dominio puro). Datos SINTÉTICOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS } from '../assets/js/domain/odt_afinia_rutas.js';
import {
  TRANSICIONES, rolEnTurno, rolDe, esMiTurno, yaFirmo, cambioFirma, puedeAnular, cambioAnular,
  errorFirmantes, grupoBandeja, bandeja, ETIQUETA_ESTADO
} from '../assets/js/domain/odt_afinia_estados.js';

const AZT = 'uid-azt-prueba';
const RESP = 'uid-resp-prueba';
const OTRO = 'uid-tercero-prueba';
const odt = (estado, rev = 0) => ({
  nro: '00000001', estado, rev,
  firmantes: { azt: { uid: AZT, nombre: 'Persona AZT', correo: 'azt@ejemplo.test' }, responsable: { uid: RESP, nombre: 'Persona Resp', correo: 'resp@ejemplo.test' } },
  lectores: [AZT, RESP]
});

describe('turno: primero el AZT, después el Responsable (D2)', () => {
  test('rolEnTurno por estado', () => {
    assert.equal(rolEnTurno(ESTADOS.PENDIENTE_AZT), 'azt');
    assert.equal(rolEnTurno(ESTADOS.PENDIENTE_RESPONSABLE), 'responsable');
    assert.equal(rolEnTurno(ESTADOS.LISTA), null);
    assert.equal(rolEnTurno(ESTADOS.ANULADA), null);
    assert.equal(rolEnTurno('OTRA_COSA'), null);
  });

  test('rolDe identifica por uid, nunca por nombre', () => {
    assert.equal(rolDe(odt(ESTADOS.PENDIENTE_AZT), AZT), 'azt');
    assert.equal(rolDe(odt(ESTADOS.PENDIENTE_AZT), RESP), 'responsable');
    assert.equal(rolDe(odt(ESTADOS.PENDIENTE_AZT), OTRO), null);
    assert.equal(rolDe(odt(ESTADOS.PENDIENTE_AZT), 'Persona AZT'), null);
    assert.equal(rolDe(odt(ESTADOS.PENDIENTE_AZT), null), null);
  });

  test('esMiTurno en cada estado', () => {
    assert.equal(esMiTurno(odt(ESTADOS.PENDIENTE_AZT), AZT), true);
    assert.equal(esMiTurno(odt(ESTADOS.PENDIENTE_AZT), RESP), false);
    assert.equal(esMiTurno(odt(ESTADOS.PENDIENTE_RESPONSABLE), RESP), true);
    assert.equal(esMiTurno(odt(ESTADOS.PENDIENTE_RESPONSABLE), AZT), false);
    assert.equal(esMiTurno(odt(ESTADOS.LISTA), RESP), false);
    assert.equal(esMiTurno(odt(ESTADOS.ANULADA), AZT), false);
    assert.equal(esMiTurno(odt(ESTADOS.PENDIENTE_AZT), OTRO), false);
  });

  test('yaFirmo se deduce del estado', () => {
    assert.equal(yaFirmo(odt(ESTADOS.PENDIENTE_AZT), 'azt'), false);
    assert.equal(yaFirmo(odt(ESTADOS.PENDIENTE_RESPONSABLE), 'azt'), true);
    assert.equal(yaFirmo(odt(ESTADOS.PENDIENTE_RESPONSABLE), 'responsable'), false);
    assert.equal(yaFirmo(odt(ESTADOS.LISTA), 'responsable'), true);
  });
});

describe('cambioFirma: solo estado y rev, un paso, solo el titular', () => {
  test('AZT en su turno → PENDIENTE_RESPONSABLE, rev+1', () => {
    assert.deepEqual(cambioFirma(odt(ESTADOS.PENDIENTE_AZT, 0), 'azt', AZT), { ok: true, cambios: { estado: ESTADOS.PENDIENTE_RESPONSABLE, rev: 1 } });
  });
  test('Responsable en su turno → LISTA, rev+1', () => {
    assert.deepEqual(cambioFirma(odt(ESTADOS.PENDIENTE_RESPONSABLE, 1), 'responsable', RESP), { ok: true, cambios: { estado: ESTADOS.LISTA, rev: 2 } });
  });
  test('las transiciones son exactamente dos', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(TRANSICIONES)), {
      azt: { de: 'PENDIENTE_AZT', a: 'PENDIENTE_RESPONSABLE' },
      responsable: { de: 'PENDIENTE_RESPONSABLE', a: 'LISTA' }
    });
  });
  const niega = [
    ['el Responsable antes que el AZT', odt(ESTADOS.PENDIENTE_AZT), 'responsable', RESP, 'estado'],
    ['el AZT dos veces', odt(ESTADOS.PENDIENTE_RESPONSABLE), 'azt', AZT, 'estado'],
    ['un tercero en la casilla del AZT', odt(ESTADOS.PENDIENTE_AZT), 'azt', OTRO, 'sin_permiso'],
    ['el Responsable en la casilla del AZT', odt(ESTADOS.PENDIENTE_AZT), 'azt', RESP, 'sin_permiso'],
    ['el AZT en la casilla del Responsable', odt(ESTADOS.PENDIENTE_RESPONSABLE), 'responsable', AZT, 'sin_permiso'],
    ['firmar una LISTA', odt(ESTADOS.LISTA), 'responsable', RESP, 'estado'],
    ['firmar una ANULADA', odt(ESTADOS.ANULADA), 'azt', AZT, 'estado'],
    ['sin sesión', odt(ESTADOS.PENDIENTE_AZT), 'azt', null, 'sin_permiso'],
    ['rol inventado', odt(ESTADOS.PENDIENTE_AZT), 'jefe', AZT, 'validacion'],
    ['ODT sin estado', {}, 'azt', AZT, 'no_existe']
  ];
  for (const [nombre, o, rol, uid, codigo] of niega) {
    test('niega: ' + nombre, () => {
      const r = cambioFirma(o, rol, uid);
      assert.equal(r.ok, false);
      assert.equal(r.codigo, codigo);
      assert.ok(r.mensaje.length > 10);
    });
  }
  test('una ODT con el mismo uid en las dos casillas no deja firmar al Responsable', () => {
    const o = odt(ESTADOS.PENDIENTE_RESPONSABLE);
    o.firmantes.responsable.uid = AZT;
    assert.equal(cambioFirma(o, 'responsable', AZT).ok, false);
  });
});

describe('anular: admin, con motivo, solo PENDIENTE_* (D6: una LISTA no se anula)', () => {
  const por = { uid: 'uid-admin-prueba', nombre: 'Admin de prueba' };
  test('desde PENDIENTE_* sí', () => {
    for (const e of [ESTADOS.PENDIENTE_AZT, ESTADOS.PENDIENTE_RESPONSABLE]) {
      const r = cambioAnular(odt(e, 3), { motivo: '  El PDF publicado no era el correcto.  ', por });
      assert.equal(r.ok, true, e);
      assert.deepEqual(r.cambios, { estado: ESTADOS.ANULADA, rev: 4, anulacion: { motivo: 'El PDF publicado no era el correcto.', por } });
    }
  });
  test('D6: una ODT LISTA no se anula', () => {
    assert.equal(puedeAnular(odt(ESTADOS.LISTA)), false);
    const r = cambioAnular(odt(ESTADOS.LISTA, 3), { motivo: 'El PDF publicado no era el correcto.', por });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 'estado');
    assert.match(r.mensaje, /lista no se anula/);
  });
  test('ANULADA no se vuelve a anular', () => {
    assert.equal(puedeAnular(odt(ESTADOS.ANULADA)), false);
    assert.equal(cambioAnular(odt(ESTADOS.ANULADA), { motivo: 'Motivo suficiente', por }).codigo, 'estado');
  });
  test('motivo de 10 a 500 caracteres y con quién anula', () => {
    const e = ESTADOS.PENDIENTE_RESPONSABLE;
    assert.equal(cambioAnular(odt(e), { motivo: 'corto', por }).codigo, 'validacion');
    assert.equal(cambioAnular(odt(e), { motivo: 'x'.repeat(501), por }).codigo, 'validacion');
    assert.equal(cambioAnular(odt(e), { motivo: 'x'.repeat(500), por }).ok, true);
    assert.equal(cambioAnular(odt(e), { motivo: 'x'.repeat(10), por }).ok, true);
    assert.equal(cambioAnular(odt(e), { motivo: 'Motivo suficiente' }).codigo, 'validacion');
  });
});

describe('errorFirmantes: los mismos «no» de la regla de publicar', () => {
  const f = (a, r) => ({ azt: a && { uid: a }, responsable: r && { uid: r } });
  test('dos personas distintas y el publicador nunca es AZT', () => {
    assert.equal(errorFirmantes(f(AZT, RESP), 'uid-admin-prueba'), null);
    assert.equal(errorFirmantes(f(AZT, RESP), RESP), null, 'el admin puede ser Responsable');
    assert.match(errorFirmantes(f(AZT, AZT), 'uid-admin-prueba'), /distintas/);
    assert.match(errorFirmantes(f(AZT, RESP), AZT), /no puede ser el AZT/);
    assert.match(errorFirmantes(f(null, RESP), 'x'), /Faltan/);
  });
});

describe('estados finales nuevos (2026-11-21): CERRADA y REEMPLAZADA salen de LISTA', () => {
  test('nadie está en turno; las dos firmas cuentan como hechas', () => {
    for (const e of [ESTADOS.CERRADA, ESTADOS.REEMPLAZADA]) {
      assert.equal(rolEnTurno(e), null, e);
      assert.equal(esMiTurno(odt(e), AZT), false);
      assert.equal(esMiTurno(odt(e), RESP), false);
      assert.equal(yaFirmo(odt(e), 'azt'), true, e);
      assert.equal(yaFirmo(odt(e), 'responsable'), true, e);
    }
  });
  test('ya no se firma (mensaje claro) ni se anula; las pendientes siguen igual', () => {
    const c = cambioFirma(odt(ESTADOS.CERRADA), 'responsable', RESP);
    assert.equal(c.ok, false); assert.equal(c.codigo, 'estado'); assert.match(c.mensaje, /cerrada en Afinia/);
    const r = cambioFirma(odt(ESTADOS.REEMPLAZADA), 'azt', AZT);
    assert.equal(r.ok, false); assert.equal(r.codigo, 'estado'); assert.match(r.mensaje, /reemplazada/);
    const por = { uid: 'uid-admin-prueba', nombre: 'Admin de prueba' };
    for (const e of [ESTADOS.CERRADA, ESTADOS.REEMPLAZADA]) {
      assert.equal(puedeAnular(odt(e)), false, e);
      const x = cambioAnular(odt(e, 3), { motivo: 'Motivo suficiente de prueba', por });
      assert.equal(x.ok, false); assert.equal(x.codigo, 'estado');
    }
    assert.match(cambioAnular(odt(ESTADOS.CERRADA), { motivo: 'Motivo suficiente de prueba', por }).mensaje, /cerrada en Afinia/);
    assert.match(cambioAnular(odt(ESTADOS.REEMPLAZADA), { motivo: 'Motivo suficiente de prueba', por }).mensaje, /reemplazada/);
    // Control: desde PENDIENTE_AZT sí se anula.
    assert.equal(cambioAnular(odt(ESTADOS.PENDIENTE_AZT), { motivo: 'Motivo suficiente de prueba', por }).ok, true);
  });
  test('etiquetas en pantalla', () => {
    assert.equal(ETIQUETA_ESTADO[ESTADOS.CERRADA], 'Cerrada en Afinia');
    assert.equal(ETIQUETA_ESTADO[ESTADOS.REEMPLAZADA], 'Reemplazada');
  });
});

describe('bandeja', () => {
  test('pestaña «Cerradas» y las REEMPLAZADAS con las anuladas; las dos cuentan en «firmadas por mí»', () => {
    const lista = [odt(ESTADOS.LISTA), odt(ESTADOS.CERRADA), odt(ESTADOS.REEMPLAZADA), odt(ESTADOS.ANULADA)];
    const b = bandeja(lista, AZT);
    assert.deepEqual([b.listas.length, b.cerradas.length, b.anuladas.length, b.enCurso.length, b.miTurno.length], [1, 1, 2, 0, 0]);
    assert.equal(b.firmadasPorMi.length, 3, 'LISTA, CERRADA y REEMPLAZADA: el AZT firmó las tres');
    assert.equal(grupoBandeja(odt(ESTADOS.CERRADA), OTRO), 'cerradas');
    assert.equal(grupoBandeja(odt(ESTADOS.REEMPLAZADA), OTRO), 'anuladas');
  });
  test('cada ODT en su pestaña y «firmadas por mí» cruzada', () => {
    const lista = [odt(ESTADOS.PENDIENTE_AZT), odt(ESTADOS.PENDIENTE_RESPONSABLE), odt(ESTADOS.LISTA), odt(ESTADOS.ANULADA)];
    const b = bandeja(lista, AZT);
    assert.deepEqual([b.miTurno.length, b.enCurso.length, b.listas.length, b.anuladas.length, b.firmadasPorMi.length], [1, 1, 1, 1, 2]);
    const r = bandeja(lista, RESP);
    assert.deepEqual([r.miTurno.length, r.enCurso.length, r.listas.length, r.anuladas.length, r.firmadasPorMi.length], [1, 1, 1, 1, 1]);
    assert.equal(grupoBandeja(odt(ESTADOS.PENDIENTE_AZT), OTRO), 'en_curso');
  });
  test('cada estado tiene su etiqueta', () => {
    for (const e of Object.values(ESTADOS)) assert.ok(ETIQUETA_ESTADO[e], e);
  });
});
