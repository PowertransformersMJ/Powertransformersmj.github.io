// Pruebas del dominio de firmas personales (ADR-071).
// Lo que se blinda aquí NO es una comodidad: es la regla que impide que el
// sitio sirva para estampar la firma de otra persona.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BYTES, TIPO_REQUERIDO, esPngPorBytes,
  validarArchivoFirma, normalizarNombre, firmaAplicaA, motivoSinFirma
} from '../assets/js/domain/firmas.js';

const archivo = (type, size) => ({ type, size });

describe('validarArchivoFirma', () => {
  test('acepta un PNG dentro del tope', () => {
    assert.equal(validarArchivoFirma(archivo('image/png', 40 * 1024)).ok, true);
  });

  test('rechaza un JPG y explica POR QUÉ (taparía la línea de firma)', () => {
    const r = validarArchivoFirma(archivo('image/jpeg', 40 * 1024));
    assert.equal(r.ok, false);
    assert.match(r.motivo, /transparente/i);
    assert.match(r.motivo, /fondo blanco/i);
  });

  test('rechaza por encima del tope (900 KB, cabe en un documento de Firestore) y dice qué hacer', () => {
    const r = validarArchivoFirma(archivo('image/png', MAX_BYTES + 1));
    assert.equal(r.ok, false);
    assert.match(r.motivo, /recórtela/i);
    assert.match(r.motivo, /900 KB/);
  });

  test('el tope es inclusivo: exactamente 900 KB entra', () => {
    assert.equal(MAX_BYTES, 900 * 1024);
    assert.equal(validarArchivoFirma(archivo('image/png', MAX_BYTES)).ok, true);
  });

  test('rechaza archivo vacío, nulo y de tamaño no numérico', () => {
    assert.equal(validarArchivoFirma(null).ok, false);
    assert.equal(validarArchivoFirma(archivo('image/png', 0)).ok, false);
    assert.equal(validarArchivoFirma(archivo('image/png', NaN)).ok, false);
  });

  test('el tipo se compara sin distinguir mayúsculas', () => {
    assert.equal(validarArchivoFirma(archivo('IMAGE/PNG', 1024)).ok, true);
  });

  test('TIPO_REQUERIDO es PNG y no otra cosa', () => {
    assert.equal(TIPO_REQUERIDO, 'image/png');
  });
});

describe('normalizarNombre', () => {
  test('quita tildes, colapsa espacios y sube a mayúsculas', () => {
    assert.equal(normalizarNombre('  Miguel  Jiménez '), 'MIGUEL JIMENEZ');
  });

  test('tolera nulo, indefinido y no-cadena', () => {
    assert.equal(normalizarNombre(null), '');
    assert.equal(normalizarNombre(undefined), '');
    assert.equal(normalizarNombre(123), '123');
  });

  test('la ñ NO se convierte en n: son personas distintas', () => {
    assert.notEqual(normalizarNombre('MUÑOZ'), normalizarNombre('MUNOZ'));
  });
});

describe('firmaAplicaA — la regla que impide firmar por otro', () => {
  test('estampa cuando la línea es la de quien tiene la sesión', () => {
    assert.equal(firmaAplicaA('MIGUEL JIMENEZ', 'Miguel Jiménez'), true);
  });

  test('NO estampa en la línea de otra persona', () => {
    assert.equal(firmaAplicaA('CARLOS MARTELO', 'Miguel Jiménez'), false);
  });

  test('sin sesión no estampa nada', () => {
    assert.equal(firmaAplicaA('MIGUEL JIMENEZ', ''), false);
    assert.equal(firmaAplicaA('MIGUEL JIMENEZ', null), false);
  });

  test('una línea sin nombre nunca recibe firma', () => {
    assert.equal(firmaAplicaA('', 'Miguel Jiménez'), false);
    assert.equal(firmaAplicaA('   ', 'Miguel Jiménez'), false);
  });

  test('dos nombres vacíos no se consideran iguales', () => {
    assert.equal(firmaAplicaA('', ''), false);
  });

  test('un nombre que solo CONTIENE al otro no basta', () => {
    // "MIGUEL JIMENEZ PEREZ" no es "MIGUEL JIMENEZ": la coincidencia es exacta.
    assert.equal(firmaAplicaA('MIGUEL JIMENEZ PEREZ', 'Miguel Jiménez'), false);
  });
});

describe('motivoSinFirma — un hueco siempre se explica (L-69)', () => {
  test('sin sesión', () => {
    assert.match(motivoSinFirma({ haySesion: false }), /sesión/i);
  });

  test('la línea es de otra persona', () => {
    const m = motivoSinFirma({ haySesion: true, esMiLinea: false, hayFirmaPropia: true });
    assert.match(m, /nombrada en esta línea/i);
  });

  test('es mi línea pero aún no cargué mi firma', () => {
    const m = motivoSinFirma({ haySesion: true, esMiLinea: true, hayFirmaPropia: false });
    assert.match(m, /Mi firma/);
  });

  test('cuando sí se puede firmar, no hay motivo que mostrar', () => {
    assert.equal(motivoSinFirma({ haySesion: true, esMiLinea: true, hayFirmaPropia: true }), '');
  });
});

describe('PNG por su contenido (`99 §100`)', () => {
  test('reconoce la firma de 8 bytes del PNG y rechaza lo demás', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    assert.equal(esPngPorBytes(png), true);
    assert.equal(esPngPorBytes(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0])), false);   // JPEG
    assert.equal(esPngPorBytes(png.slice(0, 8)), false);                                           // solo cabecera
    assert.equal(esPngPorBytes(null), false);
  });
});
