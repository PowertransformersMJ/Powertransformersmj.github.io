// Firma de ODT Afinia · textos EXACTOS del acuerdo y de las declaraciones v1, y fechas de Bogotá.
// Las cadenas esperadas se escriben aquí A MANO (no se arman con el módulo): si una
// coma cambia en el código, esta prueba lo dice. Datos SINTÉTICOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VERSIONES } from '../assets/js/domain/odt_afinia_rutas.js';
import {
  textoAcuerdo, declaracionAzt, declaracionResponsable, declaracion, literales, PLANTILLAS,
  fechaBogota, esFechaDMA, ordenDMA, errorFechaCierre, nombreArchivo, ZONA_HORARIA
} from '../assets/js/domain/odt_afinia_textos.js';

const nombre = 'Persona De Prueba';
const correo = 'persona@ejemplo.test';
const nro = '00000001';

describe('textos v1 carácter a carácter', () => {
  test('acuerdo de habilitación', () => {
    assert.equal(textoAcuerdo({ nombre, correo }),
      'Yo, Persona De Prueba, con mi cuenta personal persona@ejemplo.test, acepto firmar electrónicamente las ODT de Afinia en SGM. Mi firma solo se estampa desde mi propia cuenta y con mi contraseña personal, que no comparto.');
  });
  test('declaración del AZT', () => {
    assert.equal(declaracionAzt({ nombre, correo, nro }),
      'Yo, Persona De Prueba, con mi cuenta personal persona@ejemplo.test, declaro que revisé las dos páginas de la ODT N.º 00000001 y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.');
  });
  test('declaración del Responsable', () => {
    assert.equal(declaracionResponsable({ nombre, correo, nro, fecha: '20/11/2026' }),
      'Yo, Persona De Prueba, con mi cuenta personal persona@ejemplo.test, declaro que revisé las dos páginas de la ODT N.º 00000001, verifiqué la firma del AZT y, como RESPONSABLE O.D.T., la firmo y la cierro con fecha 20/11/2026. Esta firma equivale a mi firma manuscrita.');
  });
  test('declaracion(rol) devuelve versión y texto', () => {
    assert.deepEqual(declaracion('azt', { nombre, correo, nro }), { version: 'odt-azt-v1', texto: declaracionAzt({ nombre, correo, nro }) });
    assert.equal(declaracion('responsable', { nombre, correo, nro, fecha: '01/01/2026' }).version, 'odt-resp-v1');
    assert.throws(() => declaracion('jefe', {}), /Rol desconocido/);
  });
  test('las cadenas están en NFC (una tilde compuesta distinta no casaría con la regla)', () => {
    for (const v of Object.values(VERSIONES)) for (const l of literales(v)) assert.equal(l, l.normalize('NFC'));
  });
  test('los literales, unidos a los datos, dan el texto (fragmentos para la prueba de reglas)', () => {
    assert.deepEqual(literales(VERSIONES.azt), ['Yo, ', ', con mi cuenta personal ', ', declaro que revisé las dos páginas de la ODT N.º ', ' y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.']);
    assert.equal(PLANTILLAS[VERSIONES.responsable].length, 9);
    assert.equal(PLANTILLAS[VERSIONES.acuerdo].length, 5);
  });
  test('sin nombre, correo, N.º o fecha válidos, no se arma (lanza)', () => {
    assert.throws(() => textoAcuerdo({ nombre: '  ', correo }), /nombre/);
    assert.throws(() => textoAcuerdo({ nombre }), /correo/);
    assert.throws(() => declaracionAzt({ nombre, correo, nro: '1234567' }), /8 dígitos/);
    assert.throws(() => declaracionAzt({ nombre, correo, nro: 12345678 }), /8 dígitos/);
    assert.throws(() => declaracionResponsable({ nombre, correo, nro, fecha: '2026-11-20' }), /dd\/mm\/aaaa/);
    assert.throws(() => declaracionResponsable({ nombre, correo, nro, fecha: '31/02/2026' }), /dd\/mm\/aaaa/);
  });
});

describe('fecha en la hora de Bogotá', () => {
  test('zona horaria fija', () => assert.equal(ZONA_HORARIA, 'America/Bogota'));
  test('23:30 de Bogotá sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    assert.equal(fechaBogota(new Date('2026-11-21T04:30:00Z')), '20/11/2026');
    assert.equal(fechaBogota(new Date('2026-11-21T05:00:00Z')), '21/11/2026');
    assert.equal(fechaBogota(new Date('2026-01-01T04:59:59Z')), '31/12/2025');
  });
  test('esFechaDMA y ordenDMA', () => {
    assert.equal(esFechaDMA('29/02/2028'), true);
    assert.equal(esFechaDMA('29/02/2027'), false);
    assert.equal(esFechaDMA('1/2/2026'), false);
    assert.equal(esFechaDMA('00/01/2026'), false);
    assert.equal(ordenDMA('05/03/2026'), 20260305);
    assert.ok(Number.isNaN(ordenDMA('xx')));
  });
  test('errorFechaCierre: ≤ hoy (Bogotá) y ≥ fecha del trabajo', () => {
    const ahora = new Date('2026-11-21T04:30:00Z'); // 20/11/2026 en Bogotá
    assert.equal(errorFechaCierre('20/11/2026', { fechaTrabajo: '18/11/2026', ahora }), null);
    assert.equal(errorFechaCierre('18/11/2026', { fechaTrabajo: '18/11/2026', ahora }), null);
    assert.match(errorFechaCierre('21/11/2026', { fechaTrabajo: '18/11/2026', ahora }), /posterior a hoy/);
    assert.match(errorFechaCierre('17/11/2026', { fechaTrabajo: '18/11/2026', ahora }), /anterior a la fecha del trabajo/);
    assert.match(errorFechaCierre('2026-11-20', { ahora }), /dd\/mm\/aaaa/);
    assert.match(errorFechaCierre('19/11/2026', { fechaTrabajo: '2026-11-18', ahora }), /no es una fecha válida/);
  });
  test('nombre del archivo', () => {
    assert.equal(nombreArchivo('00000001'), 'ODT_00000001_firmada.pdf');
    assert.throws(() => nombreArchivo('1'), /8 dígitos/);
  });
});
