// Informe de Mantenimiento Brigada (F60-ADM) · capa de datos PURA:
// ids, rutas, topes, configuración y cambios de estado (rev, emitir, anular).
// Datos INVENTADOS: ningún nombre, serie, matrícula ni contrato real.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ESQUEMA, MODELO_REFRIGERACION, ACTIVIDAD_REFRIGERACION, COL, ALMACEN_POR_DEFECTO, CLAVES_MARCA, TOPES, LIMITES,
  ErrorIBR, errorDesdeFirebase, esSinPermiso, idAleatorio, nuevoIdArchivo, nuevoIdLocal,
  rutaArchivo, rutaLogo, rutaFirma, rutaFicha, rutaParteFicha, idBin, rutaBin, idFicha, claveFirmante, slug,
  esRutaFirma, rutaAdmitidaPara, topeDe, validarBinario, mimePorBytes, jpegConMetadatos, pngConMetadatos, imagenConMetadatos,
  normalizarConfig, configParaGuardar, configDePrueba, esEditorDe, aIso, documentoAInforme, documentoAVersion, documentoAFicha,
  normalizarEquipoRef, resumenAccion, ordenarPorActualizado, hayListaEnLista, prepararContenido, errorMotivo,
  firmasParaEmitir, planCrear, planGuardar, planCorregir, planEmitir, planAnular, topeConsulta
} from '../assets/js/domain/informe_brigada_rutas.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const H = 'ab'.repeat(32);
const H2 = 'cd'.repeat(32);

/** Bloque de reglas del informe (desde su cabecera hasta el cierre por defecto). */
function bloque(archivo, inicio) {
  const t = leer(archivo);
  const i = t.indexOf(inicio);
  const j = t.indexOf('// ── Resto: cerrado por defecto ──', i);
  assert.ok(i > 0 && j > i, 'no encontré el bloque del informe en ' + archivo);
  return t.slice(i, j);
}
const REGLAS_FS = bloque('firestore.rules', 'Informe de Mantenimiento Brigada · formato F60-ADM');
const REGLAS_ST = bloque('storage.rules', 'Informe de Mantenimiento Brigada · F60-ADM');

/* ── JPEG y PNG sintéticos (sin datos de nadie) ─────────────────────────────── */
const APP0 = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const SOS = [0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x11, 0x22, 0x33, 0xFF, 0xD9];
const exif = [0xFF, 0xE1, 0x00, 0x0E, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x08];
const xmp = [0xFF, 0xE1, 0x00, 0x08, 0x68, 0x74, 0x74, 0x70, 0x3A, 0x2F];
const jpeg = (...seg) => new Uint8Array([0xFF, 0xD8, ...APP0, ...seg.flat(), ...SOS]);
const PNG_MIN = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
function pngCon(tipo, datos) {
  const cuerpo = Buffer.from(datos, 'latin1');
  const trozo = Buffer.alloc(12 + cuerpo.length);
  trozo.writeUInt32BE(cuerpo.length, 0);
  trozo.write(tipo, 4, 'latin1');
  cuerpo.copy(trozo, 8);
  // IHDR termina en el byte 33: el bloque nuevo va justo después.
  return new Uint8Array(Buffer.concat([Buffer.from(PNG_MIN.subarray(0, 33)), trozo, Buffer.from(PNG_MIN.subarray(33))]));
}

/* ── un informe de prueba (inventado) ───────────────────────────────────────── */
const EQUIPO = { transformador_id: 'tx-prueba-1', matricula: 'T9-Z/Z-PRU', subestacion: 'Prueba Norte', serie: 'SERIE-PRUEBA-001' };
const CONTENIDO = {
  esquema: 'ibr@1', equipo: { matricula: 'T9-Z/Z-PRU' }, odt: ['ODT-PRUEBA-1'],
  firmas: {
    elaborado: { nombre: 'INGENIERO PRUEBA UNO', firmante: 'f-ingeniero-prueba-uno' },
    revisado: { nombre: 'REVISOR PRUEBA DOS', firmante: 'f-revisor-prueba-dos' },
    aprobado: { nombre: 'Aprobador Cambiado A Mano', firmante: 'f-aprobador-prueba-tres' }
  }
};
const FIRMA = (clave) => ({ almacen: 'storage', ruta: `informes_brigada_marca/firmas/${clave}/${H}`, huella: H, mime: 'image/png', ancho: 400, alto: 150, autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } });
const CONFIG = {
  editores: ['uid-editor-1'],
  contrato_defecto: '9900000001',
  firmantes: [
    { clave: 'f-ingeniero-prueba-uno', nombre: 'Ingeniero Prueba Uno', firma: FIRMA('f-ingeniero-prueba-uno') },
    { clave: 'f-revisor-prueba-dos', nombre: 'REVISOR PRUEBA DOS', firma: null },
    { clave: 'f-aprobador-prueba-tres', nombre: 'APROBADOR PRUEBA TRES', firma: FIRMA('f-aprobador-prueba-tres') }
  ]
};
const borrador = (extra = {}) => ({ ...planCrear({ equipo_ref: EQUIPO, actividad: ACTIVIDAD_REFRIGERACION, contenido: CONTENIDO }), ...extra });
const codigo = (fn, cod) => assert.throws(fn, (e) => e instanceof ErrorIBR && e.codigo === cod);

describe('ids y rutas', () => {
  test('ids aleatorios: alfabeto, largo y sin repetirse', () => {
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
      const a = nuevoIdArchivo();
      assert.match(a, /^a[A-Za-z0-9]{20}$/);
      vistos.add(a);
    }
    assert.equal(vistos.size, 2000);
    assert.match(nuevoIdLocal(), /^local-[A-Za-z0-9]{16}$/);
    assert.equal(idAleatorio(7).length, 7);
  });

  test('rutas de Storage y Firestore', () => {
    const a = nuevoIdArchivo();
    assert.equal(rutaArchivo('Inf123', a), `informes_brigada/Inf123/archivos/${a}`);
    assert.equal(rutaArchivo('local-AbC', a), `informes_brigada/local-AbC/archivos/${a}`);
    assert.equal(rutaLogo('applus-portada', H), `informes_brigada_marca/logos/applus-portada/${H}`);
    assert.equal(rutaFirma('f-ana', H), `informes_brigada_marca/firmas/f-ana/${H}`);
    assert.equal(rutaFicha('ficha_x_y_12345678'), 'informes_brigada_marca/fichas/ficha_x_y_12345678');
    assert.equal(rutaParteFicha('ficha_x_y_12345678'), 'informes_brigada_fichas/ficha_x_y_12345678/partes/0');
    codigo(() => rutaArchivo('../otro', a), 'validacion');
    codigo(() => rutaArchivo('Inf123', 'a123'), 'validacion');
    codigo(() => rutaLogo('logo-inventado', H), 'validacion');
    codigo(() => rutaLogo('applus-portada', 'xyz'), 'validacion');
    codigo(() => rutaFirma('F-MAYUS', H), 'validacion');
    codigo(() => rutaFicha('Ficha Con Espacios'), 'validacion');
  });

  test('idBin cumple la expresión de la regla y queda atado a clase, clave y huella', () => {
    const re = /b\.matches\('(\^\(logo\|firma\)_[^']+)'\)/.exec(REGLAS_FS);
    assert.ok(re, 'la regla de informes_brigada_bin debe validar el id');
    const regla = new RegExp(re[1]);
    for (const k of CLAVES_MARCA) assert.match(idBin('logo', k, H), regla);
    assert.equal(idBin('firma', 'f-ana-prueba', H), 'firma_f-ana-prueba_' + H.slice(0, 16));
    assert.match(idBin('firma', claveFirmante('Ñandú Peña Muñoz de la Torre Larguísimo Apellido Compuesto'), H), regla);
    assert.equal(rutaBin(idBin('logo', 'afinia-portada', H)), 'informes_brigada_bin/logo_afinia-portada_' + H.slice(0, 16));
    codigo(() => idBin('logo', 'otra', H), 'validacion');
    codigo(() => idBin('foto', 'x1', H), 'validacion');
  });

  test('idFicha y claveFirmante: sin tildes, en minúscula y dentro del tope', () => {
    const f = idFicha('Marca Prueba Ñ', 'VX-100 Ünico', H);
    assert.equal(f, 'ficha_marca-prueba-n_vx-100-unico_' + H.slice(0, 8));
    const larga = idFicha('M'.repeat(90), 'N'.repeat(90), H);
    assert.ok(larga.length <= 80);
    assert.match(larga, /^[a-z0-9_-]{3,80}$/);
    assert.equal(idFicha('', '', H), 'ficha_x_x_' + H.slice(0, 8));
    assert.equal(claveFirmante('  José Pérez  Ñoño '), 'f-jose-perez-nono');
    assert.ok(claveFirmante('A'.repeat(100)).length <= 40);
    assert.equal(claveFirmante(''), 'f-sin-nombre');
    assert.ok(!claveFirmante('Nombre Muy Largo Para Probar El Corte Exacto Ya').endsWith('-'));
    assert.equal(slug('Ácido-ÑU  x'), 'acido-nu-x');
  });

  test('las firmas se reconocen por su ruta, y cada ref solo admite su carpeta', () => {
    const a = nuevoIdArchivo();
    const firma = `informes_brigada_marca/firmas/f-ana/${H}`;
    assert.ok(esRutaFirma(firma));
    assert.ok(esRutaFirma('informes_brigada_bin/firma_f-ana_' + H.slice(0, 16)));
    assert.ok(!esRutaFirma('informes_brigada_bin/logo_applus-portada_' + H.slice(0, 16)));
    assert.ok(rutaAdmitidaPara('archivo:' + a, rutaArchivo('Inf1', a)));
    assert.ok(!rutaAdmitidaPara('archivo:' + a, firma), 'una «foto» de borrador NO puede apuntar a una firma');
    assert.ok(!rutaAdmitidaPara('marca:applus-portada', firma));
    assert.ok(rutaAdmitidaPara('firma:elaborado', firma));
    assert.ok(rutaAdmitidaPara('marca:applus-portada', rutaLogo('applus-portada', H)));
    assert.ok(rutaAdmitidaPara('ficha:ficha_nuevo', rutaParteFicha('ficha_x_y_12345678')));
    assert.ok(!rutaAdmitidaPara('ficha:ficha_nuevo', 'contratos/c1/contrato.pdf'));
    assert.ok(!rutaAdmitidaPara('otro:x', rutaLogo('applus-portada', H)));
  });
});

describe('binarios: tipo real, topes y metadatos de cámara', () => {
  test('topes por clase y por almacén (los de las reglas)', () => {
    assert.equal(topeDe('archivo', 'storage'), 700 * 1024);
    assert.equal(topeDe('archivo', 'firestore'), 700 * 1024);
    assert.equal(topeDe('logo', 'storage'), 1024 * 1024);
    assert.equal(topeDe('logo', 'firestore'), 900 * 1024);
    assert.equal(topeDe('firma', 'storage'), 512 * 1024);
    assert.equal(topeDe('ficha', 'storage'), 2 * 1024 * 1024);
    assert.equal(topeDe('ficha', 'firestore'), 900 * 1024);
  });

  test('validarBinario: tipo, tamaño, medidas y huella', () => {
    const ok = { mime: 'image/jpeg', tamano: 140 * 1024, ancho: 1600, alto: 1200, huella: H };
    assert.deepEqual(validarBinario('archivo', ok), []);
    assert.equal(validarBinario('archivo', { ...ok, tamano: 700 * 1024 }).length, 0);
    assert.match(validarBinario('archivo', { ...ok, tamano: 700 * 1024 + 1 })[0], /máximo/);
    assert.match(validarBinario('archivo', { ...ok, mime: 'image/gif' })[0], /JPG o PNG/);
    assert.match(validarBinario('firma', { ...ok, mime: 'image/jpeg', tamano: 1000 })[0], /PNG/);
    assert.equal(validarBinario('firma', { ...ok, mime: 'image/png', tamano: 1000 }).length, 0);
    assert.ok(validarBinario('archivo', { ...ok, ancho: 4001 }).length > 0);
    assert.ok(validarBinario('archivo', { ...ok, huella: 'ABC' }).length > 0);
    assert.ok(validarBinario('archivo', { ...ok, tamano: 0 }).length > 0);
    assert.ok(validarBinario('logo', { ...ok, tamano: 950 * 1024 }, 'firestore').length > 0);
    assert.equal(validarBinario('logo', { ...ok, tamano: 950 * 1024 }, 'storage').length, 0);
    assert.deepEqual(validarBinario('video', ok), ['Clase de archivo desconocida.']);
  });

  test('tipo real por los bytes, nunca por lo que diga el nombre', () => {
    assert.equal(mimePorBytes(jpeg()), 'image/jpeg');
    assert.equal(mimePorBytes(PNG_MIN), 'image/png');
    assert.equal(mimePorBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0])), null);
  });

  test('un JPEG con Exif o XMP (ahí viaja el GPS) se detecta; uno limpio no', () => {
    assert.equal(jpegConMetadatos(jpeg()), false);
    assert.equal(jpegConMetadatos(jpeg(exif)), true);
    assert.equal(jpegConMetadatos(jpeg(xmp)), true);
    assert.equal(jpegConMetadatos(new Uint8Array([0xFF, 0xD8, 0x00, 0x00, 0x00])), true, 'roto = sospechoso');
    assert.equal(jpegConMetadatos(new Uint8Array([0x00])), true);
    // un segmento DQT corriente no es metadato
    assert.equal(jpegConMetadatos(jpeg([0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00])), false);
    assert.equal(imagenConMetadatos(jpeg(exif)), true);
  });

  test('un PNG con eXIf o XMP se detecta; uno limpio no', () => {
    assert.equal(pngConMetadatos(PNG_MIN), false);
    assert.equal(pngConMetadatos(pngCon('eXIf', 'MM\0*')), true);
    assert.equal(pngConMetadatos(pngCon('iTXt', 'XML:com.adobe.xmp\0\0\0\0\0<x/>')), true);
    assert.equal(pngConMetadatos(pngCon('tEXt', 'Software\0Prueba')), false);
    assert.equal(imagenConMetadatos(PNG_MIN), false);
    assert.equal(imagenConMetadatos(new Uint8Array(16)), true);
  });
});

describe('configuración (editores por uid; nunca nombres en el código)', () => {
  test('normalizarConfig pone los valores por defecto', () => {
    const c = normalizarConfig(undefined);
    assert.deepEqual(c.editores, []);
    assert.equal(c.almacen, ALMACEN_POR_DEFECTO);
    assert.deepEqual(Object.keys(c.marca), [...CLAVES_MARCA]);
    assert.ok(Object.values(c.marca).every((v) => v === null));
    const d = normalizarConfig({ editores: ['u1', 'u1', '', 'u2'], almacen: 'otro', firmantes: [{ nombre: 'ana prueba' }] });
    assert.deepEqual(d.editores, ['u1', 'u2']);
    assert.equal(d.almacen, ALMACEN_POR_DEFECTO);
    assert.equal(ALMACEN_POR_DEFECTO, 'firestore', 'por defecto Firestore: Storage niega descargas al navegador (L-29)');
    assert.equal(d.firmantes[0].nombre, 'ANA PRUEBA');
    assert.equal(d.firmantes[0].clave, 'f-ana-prueba');
    assert.equal(configDePrueba('uid-x').almacen, 'local');
    assert.deepEqual(configDePrueba('uid-x').editores, ['uid-x']);
  });

  test('personal de 2.2: listas sin vacíos ni repetidos (ignora mayúsculas y tildes) y van a lo que se guarda', () => {
    const c = normalizarConfig({ ingenieros: ['  Ana   Prueba ', 'ana prueba', '', 'Beto Ensayo'], tecnicos: ['Ciro Ficticio', 'CIRO FICTÍCIO', 'Dora Simulada'] });
    assert.deepEqual(c.ingenieros, ['Ana Prueba', 'Beto Ensayo']);
    assert.deepEqual(c.tecnicos, ['Ciro Ficticio', 'Dora Simulada']);
    assert.deepEqual(normalizarConfig(undefined).ingenieros, []);
    assert.deepEqual(normalizarConfig({ tecnicos: 'no-lista' }).tecnicos, []);
    const { payload, errores } = configParaGuardar({ editores: ['u1'], ingenieros: ['Ana Prueba'], tecnicos: ['Ciro Ficticio'] });
    assert.deepEqual(errores, []);
    assert.deepEqual(payload.ingenieros, ['Ana Prueba']);
    assert.deepEqual(payload.tecnicos, ['Ciro Ficticio']);
    const largo = configParaGuardar({ tecnicos: ['x'.repeat(61)] });
    assert.ok(largo.errores.some((e) => /demasiado largo/.test(e)));
    const muchos = configParaGuardar({ ingenieros: Array.from({ length: 31 }, (_, i) => 'Persona ' + i) });
    assert.ok(muchos.errores.some((e) => /Máximo 30 ingenieros/.test(e)));
  });

  test('configParaGuardar rechaza lo que la regla negaría', () => {
    assert.deepEqual(configParaGuardar(CONFIG).errores, []);
    const p = configParaGuardar(CONFIG).payload;
    assert.deepEqual(Object.keys(p).sort(), ['almacen', 'contrato_defecto', 'editores', 'firmantes', 'ingenieros', 'marca', 'tecnicos']);
    assert.ok(configParaGuardar({ editores: Array.from({ length: 11 }, (_, i) => 'u' + i) }).errores.length);
    assert.ok(configParaGuardar({ contrato_defecto: '1'.repeat(21) }).errores.length);
    assert.ok(configParaGuardar({ almacen: 'local' }).errores.length);
    const sinAut = { firmantes: [{ nombre: 'X Prueba', firma: { ...FIRMA('f-x-prueba'), autorizacion: { fecha: '', medio: '' } } }] };
    assert.match(configParaGuardar(sinAut).errores.join(' '), /autorización/);
    const repetidos = { firmantes: [{ nombre: 'Uno Prueba' }, { nombre: 'uno prueba' }] };
    assert.match(configParaGuardar(repetidos).errores.join(' '), /misma clave/);
  });

  test('esEditorDe', () => {
    assert.equal(esEditorDe(CONFIG, 'uid-editor-1'), true);
    assert.equal(esEditorDe(CONFIG, 'uid-otro'), false);
    assert.equal(esEditorDe(CONFIG, ''), false);
    assert.equal(esEditorDe(null, 'uid-editor-1'), false);
  });
});

describe('documentos y datos de entrada', () => {
  test('aIso entiende Timestamp, Date, {seconds} y texto', () => {
    assert.equal(aIso(null), null);
    assert.equal(aIso('2026-10-14T00:00:00.000Z'), '2026-10-14T00:00:00.000Z');
    assert.equal(aIso(new Date(Date.UTC(2026, 9, 14))), '2026-10-14T00:00:00.000Z');
    assert.equal(aIso({ toDate: () => new Date(Date.UTC(2026, 0, 2)) }), '2026-01-02T00:00:00.000Z');
    assert.equal(aIso({ seconds: 0, nanoseconds: 5e6 }), '1970-01-01T00:00:00.005Z');
    assert.equal(aIso({}), null);
  });

  test('documentoAInforme / AVersion / AFicha', () => {
    const inf = documentoAInforme('X1', { ...borrador(), creadoEn: { seconds: 1 }, actualizadoEn: { seconds: 2 }, emitidoEn: { seconds: 3 }, emitidoPor: { uid: 'u', nombre: 'n', extra: 1 } });
    assert.equal(inf.id, 'X1');
    assert.equal(inf.creadoEn, '1970-01-01T00:00:01.000Z');
    assert.deepEqual(inf.emitidoPor, { uid: 'u', nombre: 'n' });
    assert.equal(inf.emitidoEn, '1970-01-01T00:00:03.000Z');
    assert.equal('emitidoPor' in documentoAInforme('X2', borrador()), false);
    const v = documentoAVersion('2', { version: 2, huella: H, en: { seconds: 4 } });
    assert.equal(v.version, 2);
    assert.equal(v.en, '1970-01-01T00:00:04.000Z');
    const f = documentoAFicha('ficha_a_b_12345678', { titulo: 'T', bytes: 'NO DEBE PASAR', almacen: 'firestore' });
    assert.equal('bytes' in f, false);
  });

  test('equipo_ref: identidad mínima', () => {
    assert.deepEqual(normalizarEquipoRef(EQUIPO).errores, []);
    assert.ok(normalizarEquipoRef({ matricula: '' }).errores.length);
    assert.ok(normalizarEquipoRef({ matricula: 'M'.repeat(41) }).errores.length);
    assert.deepEqual(Object.keys(normalizarEquipoRef({ matricula: 'A', basura: 1 }).equipo_ref).sort(), ['matricula', 'serie', 'subestacion', 'transformador_id']);
  });

  test('resumenAccion copia lo justo y NO modifica la acción (decisión 12)', () => {
    const accion = { id: 'acc-1', fecha_accion: '2026-03-15', estado_accion: 'ejecutada', accion_descripcion: 'Cambio de ventiladores de prueba', kva_onan: 10000, kva_onaf: '14000',
      mix: [{ key: 'k', marca: 'MARCA-PRUEBA', modelo: 'VX-100', cfm_unitario: 7000, cantidad: 4, ubicacion: { lado: 'A' } }], evaluacion: { x: 1 } };
    const antes = structuredClone(accion);
    const r = resumenAccion(accion);
    assert.deepEqual(accion, antes);
    assert.deepEqual(r, { id: 'acc-1', fecha_accion: '2026-03-15', estado_accion: 'ejecutada', accion_descripcion: 'Cambio de ventiladores de prueba', kva_onan: 10000, kva_onaf: 14000,
      mix: [{ marca: 'MARCA-PRUEBA', modelo: 'VX-100', cfm_unitario: 7000, cantidad: 4 }] });
    assert.deepEqual(resumenAccion({ kva_onan: '' }).kva_onan, null);
  });

  test('ordenarPorActualizado y topeConsulta', () => {
    const l = ordenarPorActualizado([{ actualizadoEn: '2026-01-01' }, { actualizadoEn: '2026-03-01' }, { actualizadoEn: null }]);
    assert.deepEqual(l.map((x) => x.actualizadoEn), ['2026-03-01', '2026-01-01', null]);
    assert.equal(topeConsulta(undefined, 100, 200), 100);
    assert.equal(topeConsulta(999, 100, 200), 200);
    assert.equal(topeConsulta(-1, 50, 200), 50);
  });
});

describe('contenido: que Firestore lo acepte', () => {
  test('sin listas dentro de listas (L-30)', () => {
    assert.equal(hayListaEnLista({ a: [1, { b: [2] }] }), false);
    assert.equal(hayListaEnLista({ a: [[1]] }), true);
    assert.equal(hayListaEnLista([{ x: [{ y: [[0]] }] }]), true);
    codigo(() => prepararContenido({ figuras: { alcance: [[1, 2]] } }), 'validacion');
  });

  test('prepararContenido deja JSON puro y respeta el tope del documento', () => {
    const c = prepararContenido({ a: undefined, b: 1, f: new Date(0), l: [undefined] });
    assert.deepEqual(c, { b: 1, f: '1970-01-01T00:00:00.000Z', l: [null] });
    codigo(() => prepararContenido(null), 'validacion');
    codigo(() => prepararContenido([1]), 'validacion');
    codigo(() => prepararContenido({ t: 'x'.repeat(TOPES.contenido) }), 'validacion');
    const ciclo = {}; ciclo.yo = ciclo;
    codigo(() => prepararContenido(ciclo), 'validacion');
  });

  test('motivo de emisión: libre en la v1, ≥ 10 desde la v2', () => {
    assert.equal(errorMotivo(1, ''), null);
    assert.match(errorMotivo(2, 'corto'), /versión 2/);
    assert.equal(errorMotivo(2, 'Corrige la fecha de ejecución'), null);
    assert.match(errorMotivo(1, 'x'.repeat(501)), /máximo/);
  });
});

describe('cambios de estado (los mismos que exige firestore.rules)', () => {
  test('crear: toda actividad válida (de la lista o escrita a mano) con el único modelo; borrador, v0, rev 1', () => {
    const b = borrador();
    assert.equal(b.esquema, ESQUEMA);
    assert.equal(b.modelo, MODELO_REFRIGERACION);
    assert.equal(b.actividad, ACTIVIDAD_REFRIGERACION);
    assert.equal(b.estado, 'borrador');
    assert.equal(b.version, 0);
    assert.equal(b.rev, 1);
    assert.equal(b.anulacion, null);
    // Pedido del Ingeniero (2026-10-26): otra actividad de la lista o una escrita a mano también crean, con el F60.
    const psm = planCrear({ equipo_ref: EQUIPO, actividad: 'Mantenimiento de rutina PSM.', contenido: CONTENIDO });
    assert.equal(psm.actividad, 'Mantenimiento de rutina PSM.');
    assert.equal(psm.modelo, MODELO_REFRIGERACION);
    const mano = planCrear({ equipo_ref: EQUIPO, actividad: '  Cambio de  bujes\tde baja tensión ', contenido: CONTENIDO });
    assert.equal(mano.actividad, 'Cambio de bujes de baja tensión', 'se guarda normalizada: así la regla la acepta');
    assert.equal(planCrear({ equipo_ref: EQUIPO, actividad: 'x'.repeat(200), contenido: CONTENIDO }).actividad.length, 200);
    for (const mala of ['', '   ', 'ab', 'x'.repeat(201), 'Primera línea\nSegunda línea', 'Con\u0007control', undefined, null, 42]) {
      codigo(() => planCrear({ equipo_ref: EQUIPO, actividad: mala, contenido: CONTENIDO }), 'validacion');
    }
    codigo(() => planCrear({ equipo_ref: EQUIPO, actividad: ACTIVIDAD_REFRIGERACION, modelo: 'OTRO@1', contenido: CONTENIDO }), 'validacion');
    codigo(() => planCrear({ equipo_ref: { matricula: '' }, actividad: ACTIVIDAD_REFRIGERACION, contenido: CONTENIDO }), 'validacion');
  });

  test('guardar: rev + 1; con otro rev es un CHOQUE; emitido no se guarda', () => {
    const b = borrador();
    assert.equal(planGuardar(b, { contenido: { x: 1 }, revEsperada: 1 }).rev, 2);
    codigo(() => planGuardar(b, { contenido: { x: 1 }, revEsperada: 2 }), 'conflicto');
    codigo(() => planGuardar(b, { contenido: { x: 1 } }), 'conflicto');
    codigo(() => planGuardar(null, { contenido: { x: 1 }, revEsperada: 1 }), 'no_existe');
    codigo(() => planGuardar({ ...b, estado: 'emitido' }, { contenido: { x: 1 }, revEsperada: 1 }), 'estado');
    codigo(() => planGuardar({ ...b, estado: 'anulado' }, { contenido: { x: 1 }, revEsperada: 1 }), 'estado');
  });

  test('emitir: versión + 1 con copia congelada; motivo desde la v2; huella obligatoria', () => {
    const b = borrador();
    const p = planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: H });
    assert.deepEqual(p.informe, { estado: 'emitido', version: 1, rev: 2, contenido: p.version.contenido });
    assert.equal(p.version.version, 1);
    assert.deepEqual(p.version.contenido, p.informe.contenido);
    assert.deepEqual(Object.keys(p.version.marca), [...CLAVES_MARCA]);
    codigo(() => planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: 'x' }), 'validacion');
    codigo(() => planEmitir({ ...b, version: 1 }, { contenido: CONTENIDO, revEsperada: 1, huella: H, motivo: 'corto' }), 'validacion');
    assert.equal(planEmitir({ ...b, version: 1 }, { contenido: CONTENIDO, revEsperada: 1, huella: H, motivo: 'Corrige la tabla 5' }).informe.version, 2);
    codigo(() => planEmitir({ ...b, estado: 'emitido' }, { contenido: CONTENIDO, revEsperada: 1, huella: H }), 'estado');
  });

  test('firmas: solo se estampan si el nombre de la línea es el del firmante y hay imagen (decisión 4)', () => {
    const f = firmasParaEmitir(CONTENIDO, normalizarConfig(CONFIG));
    // elaborado: firma y nombre coinciden (sin importar mayúsculas)
    // revisado: firmante sin imagen → no
    // aprobado: el nombre se cambió a mano → no
    assert.deepEqual(f.map((x) => x.rol), ['elaborado']);
    const b = borrador();
    const p = planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: H, firmas: f });
    assert.equal(p.version.firmas.length, 1);
    assert.equal(p.version.firmas[0].firma.huella, H);
    // una firma que no corresponde a la línea se rechaza
    const ajena = [{ rol: 'aprobado', clave: 'f-aprobador-prueba-tres', nombre: 'APROBADOR PRUEBA TRES', firma: FIRMA('f-aprobador-prueba-tres') }];
    codigo(() => planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: H, firmas: ajena }), 'validacion');
    // una «firma» que apunta a otra carpeta se rechaza
    const desviada = [{ ...f[0], firma: { ...f[0].firma, ruta: 'contratos/c1/x.pdf' } }];
    codigo(() => planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: H, firmas: desviada }), 'validacion');
    codigo(() => planEmitir(b, { contenido: CONTENIDO, revEsperada: 1, huella: H, firmas: [f[0], f[0]] }), 'validacion');
  });

  test('corregir: solo un emitido, vuelve a borrador con rev + 1', () => {
    const e = { ...borrador(), estado: 'emitido', version: 1, rev: 2 };
    assert.deepEqual(planCorregir(e, { revEsperada: 2 }), { estado: 'borrador', rev: 3 });
    codigo(() => planCorregir(borrador(), { revEsperada: 1 }), 'estado');
    codigo(() => planCorregir(e, { revEsperada: 1 }), 'conflicto');
  });

  test('anular: motivo de 10 a 500; lo anulado queda congelado', () => {
    const b = borrador();
    assert.deepEqual(planAnular(b, { revEsperada: 1, motivo: '  Equipo equivocado  ' }), { estado: 'anulado', rev: 2, anulacion: { motivo: 'Equipo equivocado' } });
    codigo(() => planAnular(b, { revEsperada: 1, motivo: 'nueve car' }), 'validacion');
    codigo(() => planAnular({ ...b, estado: 'anulado' }, { revEsperada: 1, motivo: 'Motivo suficiente' }), 'estado');
  });
});

describe('errores', () => {
  test('errorDesdeFirebase traduce los códigos', () => {
    assert.equal(errorDesdeFirebase({ code: 'permission-denied' }).codigo, 'sin_permiso');
    assert.equal(errorDesdeFirebase({ code: 'storage/unauthorized' }).codigo, 'sin_permiso');
    assert.equal(errorDesdeFirebase({ code: 'storage/object-not-found' }).codigo, 'no_existe');
    assert.equal(errorDesdeFirebase({ code: 'aborted' }).codigo, 'conflicto');
    assert.equal(errorDesdeFirebase({ code: 'unavailable' }).codigo, 'red');
    assert.equal(errorDesdeFirebase(new Error('x')).codigo, 'desconocido', 'una falla del programa NO se disfraza de «sin conexión» (revisión de flujo)');
    assert.equal(errorDesdeFirebase({ code: 'internal', message: 'algo' }).codigo, 'desconocido');
    assert.equal(errorDesdeFirebase(new TypeError('Failed to fetch')).codigo, 'red');
    assert.equal(errorDesdeFirebase({ code: 'auth/network-request-failed' }).codigo, 'red');
    const propio = new ErrorIBR('estado');
    assert.equal(errorDesdeFirebase(propio), propio);
    assert.ok(esSinPermiso({ code: 'permission-denied' }));
    assert.ok(!esSinPermiso({ code: 'unavailable' }));
  });
});

describe('amarres: las constantes son las de las reglas y las de la plataforma', () => {
  test('la actividad es el texto EXACTO de la lista de motivos (ordenes-materiales.js)', () => {
    const t = leer('assets/js/ordenes-materiales.js');
    const m = /motivos:\s*\[([\s\S]*?)\]/.exec(t);
    assert.ok(m);
    const motivos = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.equal(motivos[0], ACTIVIDAD_REFRIGERACION);
  });

  test('firestore.rules exige el mismo esquema, modelo, actividad y topes', () => {
    assert.ok(REGLAS_FS.includes(`'${ESQUEMA}'`));
    assert.ok(REGLAS_FS.includes(`'${MODELO_REFRIGERACION}'`));
    // La actividad (2026-10-26): ya no el texto fijo de refrigeración sino la regla de informe_brigada_actividad.js
    // (el patrón y los topes se amarran en tests/informe_brigada_actividad.test.js).
    assert.ok(REGLAS_FS.includes('&& ibrActividad(request.resource.data.actividad)'));
    assert.ok(!REGLAS_FS.includes(`actividad == '${ACTIVIDAD_REFRIGERACION}'`));
    assert.ok(REGLAS_FS.includes('700 * 1024'));
    assert.ok(REGLAS_FS.includes('900 * 1024'));
    assert.ok(REGLAS_FS.includes(`size() <= ${LIMITES.editores}`));
    assert.ok(REGLAS_FS.includes(`contrato_defecto.size() <= ${LIMITES.contrato}`));
    assert.ok(REGLAS_FS.includes(`request.query.limit <= ${LIMITES.listado}`));
    assert.ok(REGLAS_FS.includes(`request.query.limit <= ${LIMITES.versiones}`));
    assert.ok(REGLAS_FS.includes(`request.query.limit <= ${LIMITES.fichas}`));
    for (const k of CLAVES_MARCA) assert.ok(REGLAS_FS.includes(`'${k}'`), k);
    for (const c of Object.values(COL)) if (c !== 'general') assert.ok(REGLAS_FS.includes(c), c);
  });

  test('storage.rules usa los mismos topes, claves y SOLO `get` (nadie lista)', () => {
    assert.ok(REGLAS_ST.includes(`<= ${TOPES.archivo / 1024} * 1024`));
    assert.ok(REGLAS_ST.includes('<= 1024 * 1024'));
    assert.ok(REGLAS_ST.includes(`<= ${TOPES.firma / 1024} * 1024`));
    assert.ok(REGLAS_ST.includes('<= 2 * 1024 * 1024'));
    for (const k of CLAVES_MARCA) assert.ok(REGLAS_ST.includes(`'${k}'`), k);
    assert.ok(!/allow read/.test(REGLAS_ST), 'en Storage `read` incluye listar: el bloque usa `get`');
    assert.ok(!/allow (read|write|get|create|update|delete)[^;]*if true/.test(REGLAS_ST + REGLAS_FS), 'nada abierto a todos');
    assert.ok(!/allow delete:\s*if\s+(?!false|hasProfile|ibrEditor)\S/.test(REGLAS_FS), 'borra solo un admin o un editor antes de emitir');
  });

  test('las claves de marca son las de la plantilla (si la plantilla ya existe)', { skip: !existsSync(resolve(RAIZ, 'assets/js/domain/informe_brigada_plantilla.js')) }, async () => {
    const p = await import('../assets/js/domain/informe_brigada_plantilla.js');
    if (p.MARCA_CLAVES) assert.deepEqual([...p.MARCA_CLAVES], [...CLAVES_MARCA]);
    if (p.ACTIVIDAD_REFRIGERACION) assert.equal(p.ACTIVIDAD_REFRIGERACION, ACTIVIDAD_REFRIGERACION);
  });
});
