// Firma de ODT Afinia · «POR SUBSANAR» (decisión del Ingeniero del 2026-11-21) · DOMINIO puro:
//   · el formato de líneas de «Registrar ODT por subsanar» (prefijos, viñetas, vacías, largos, tope de 40);
//   · las transiciones de un punto (quién, desde qué estado, nota) y la separación de funciones;
//   · conteos, «Lista para publicar», contador «de su lado», orden de la lista, próximo id, integridad;
//   · el amarre de constantes con el bloque «Por subsanar · ODT Afinia» de firestore.rules (si el bloque se
//     renombra o desaparece, la prueba FALLA).
// Datos INVENTADOS (repo público): uids y nombres de prueba, N.º 0000000x.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  COL_OBS, ESTADOS_OBS, ESTADOS_PUNTO, QUIEN, ETIQUETA_QUIEN, ETIQUETA_PUNTO, TOPES_OBS, ID_PUNTOS, ACCIONES, LISTA_PARA_PUBLICAR,
  esIdPunto, leerLinea, parsearPuntos, errorTextoPunto, erroresRegistro, contar, listaParaPublicar, textoConteo,
  pendientesDeMiLado, ordenarLista, siguienteIdPunto, revisarIntegridad, rastroOrdenado, ultimaEntrada, textoCambio,
  motivoNoPuede, accionesPara, errorNota, transicionPunto, errorResolver, esAztDe
} from '../assets/js/domain/odt_afinia_obs.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGLAS = readFileSync(resolve(RAIZ, 'firestore.rules'), 'utf8');

const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', esAdmin: false };
const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', esAdmin: true, legacy: false };
const ADMIN2 = { uid: 'uid-admin2-prueba', nombre: 'Admin Dos De Prueba', esAdmin: true, legacy: false };
const TERCERO = { uid: 'uid-tercero-prueba', nombre: 'Tercero De Prueba', esAdmin: false };

const obsDe = (resumen, extra = {}) => ({ id: 'O'.repeat(20), nro: '00000001', estado: 'ABIERTA', lectores: [AZT.uid], resumen, ...extra });
const punto = (id, estado, rev = 0, rastro = {}) => ({ id: String(id), estado, rev, rastro, texto: 'Falta la foto del antes', quien: 'contratista' });

describe('formato de líneas de «Registrar ODT por subsanar»', () => {
  test('uno por línea; prefijos Contratista:, AZT:, Responsable: (mayúsculas o minúsculas); sin prefijo = contratista', () => {
    const r = parsearPuntos([
      'Falta el registro fotográfico del antes',
      'AZT: Diligenciar el control previo',
      'responsable : Firmar la ODT en la casilla',
      'CONTRATISTA:Corregir la consignación'
    ].join('\n'));
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.puntos.map((p) => [p.quien, p.texto]), [
      ['contratista', 'Falta el registro fotográfico del antes'],
      ['azt', 'Diligenciar el control previo'],
      ['responsable', 'Firmar la ODT en la casilla'],
      ['contratista', 'Corregir la consignación']
    ]);
    assert.deepEqual(r.puntos.map((p) => p.linea), [1, 2, 3, 4]);
  });
  test('líneas vacías no cuentan; viñetas y numeración del comienzo se quitan; espacios seguidos quedan en uno', () => {
    const r = parsearPuntos('\n- Falta la foto del después\n\n• AZT: Revisar   el\tcontrol previo\r\n1. Responsable: Firmar la ODT\n2) Corregir la fecha\n*  \n   \n');
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.puntos.map((p) => [p.quien, p.texto, p.linea]), [
      ['contratista', 'Falta la foto del después', 2],
      ['azt', 'Revisar el control previo', 4],
      ['responsable', 'Firmar la ODT', 5],
      ['contratista', 'Corregir la fecha', 6]
    ]);
  });
  test('un número sin punto ni paréntesis NO es numeración («3 fotos …» queda igual)', () => {
    assert.deepEqual(leerLinea('3 fotos sin fecha'), { texto: '3 fotos sin fecha', quien: 'contratista' });
    assert.deepEqual(leerLinea('Azt:  x'), { texto: 'x', quien: 'azt' });
    assert.equal(leerLinea('   '), null);
    assert.equal(leerLinea('-'), null, 'una viñeta sola es una línea vacía');
    // Un prefijo que no es de la lista NO se lee como prefijo: queda en el texto y le toca al contratista.
    assert.deepEqual(leerLinea('Interventoría: revisar'), { texto: 'Interventoría: revisar', quien: 'contratista' });
  });
  test('errores con su línea: corto, largo, prefijo sin texto; vacío; más de 40', () => {
    const r = parsearPuntos('ok\nAZT:\n' + 'x'.repeat(601));
    assert.deepEqual(r.puntos, []);
    assert.equal(r.errores.length, 3);
    assert.match(r.errores[0], /^Línea 1: .*al menos 5/);
    assert.match(r.errores[1], /^Línea 2: Después de «AZT:» falta el punto\./);
    assert.match(r.errores[2], /^Línea 3: .*hasta 600 caracteres \(tiene 601\)/);
    assert.deepEqual(parsearPuntos('  \n\n').errores, ['Escriba al menos un punto (uno por línea).']);
    const muchos = parsearPuntos(Array.from({ length: 41 }, (_, i) => 'Punto de prueba ' + i).join('\n'));
    assert.equal(muchos.puntos.length, 41);
    assert.match(muchos.errores.at(-1), /Son 41 puntos: el máximo es 40/);
    assert.deepEqual(parsearPuntos(Array.from({ length: 40 }, (_, i) => 'Punto de prueba ' + i).join('\n')).errores, []);
    // Bordes exactos: 5 y 600 pasan.
    assert.equal(errorTextoPunto('abcde'), null);
    assert.equal(errorTextoPunto('y'.repeat(600)), null);
    assert.ok(errorTextoPunto('abcd'));
  });
});

describe('registro: errores del formulario en llano', () => {
  const bien = { nro: '00000001', subestacion: 'S/E Prueba', equipo: '', fechaPrevista: '15/11/2026', aztUid: AZT.uid };
  test('un formulario correcto no tiene errores (equipo opcional)', () => {
    assert.deepEqual(erroresRegistro(bien, parsearPuntos('Falta la foto del antes'), ADMIN), []);
  });
  test('N.º, subestación, equipo, fecha, AZT y quien registra = AZT', () => {
    const e = erroresRegistro({ nro: '123', subestacion: 'S', equipo: 'e'.repeat(161), fechaPrevista: '31/02/2026', aztUid: '' }, null, ADMIN);
    assert.equal(e.length, 5);
    assert.match(e.join(' | '), /8 dígitos.*subestación.*160.*fecha real.*AZT asignado/);
    assert.deepEqual(erroresRegistro({ ...bien, aztUid: ADMIN.uid }, null, ADMIN), ['Quien registra la ODT no puede ser su AZT asignado.']);
    assert.deepEqual(erroresRegistro(bien, parsearPuntos(''), ADMIN), ['Escriba al menos un punto (uno por línea).']);
  });
});

describe('conteos, «Lista para publicar» y contador de la pestaña', () => {
  test('contar y textoConteo salen del resumen de la obs', () => {
    const o = obsDe({ 0: 'PENDIENTE', 1: 'SUBSANADO', 2: 'VERIFICADO', 3: 'VERIFICADO' });
    assert.deepEqual(contar(o), { pendientes: 1, subsanados: 1, verificados: 2, total: 4 });
    assert.equal(textoConteo(o), 'Pendientes 1 · Subsanados por verificar 1 · Verificados 2');
    assert.deepEqual(contar({}), { pendientes: 0, subsanados: 0, verificados: 0, total: 0 });
  });
  test('lista para publicar: ABIERTA, con puntos y TODOS verificados (una RESUELTA no)', () => {
    assert.equal(listaParaPublicar(obsDe({ 0: 'VERIFICADO', 1: 'VERIFICADO' })), true);
    assert.equal(listaParaPublicar(obsDe({ 0: 'VERIFICADO', 1: 'SUBSANADO' })), false);
    assert.equal(listaParaPublicar(obsDe({})), false);
    assert.equal(listaParaPublicar(obsDe({ 0: 'VERIFICADO' }, { estado: 'RESUELTA' })), false);
    assert.equal(LISTA_PARA_PUBLICAR, 'Lista para publicar');
  });
  test('«de su lado»: al AZT, sus pendientes; al admin, los subsanados; las RESUELTAS no cuentan', () => {
    const lista = [
      obsDe({ 0: 'PENDIENTE', 1: 'PENDIENTE', 2: 'SUBSANADO' }),
      obsDe({ 0: 'PENDIENTE', 1: 'SUBSANADO' }, { lectores: ['otro-uid'] }),
      obsDe({ 0: 'PENDIENTE', 1: 'SUBSANADO' }, { estado: 'RESUELTA' })
    ];
    assert.equal(pendientesDeMiLado(lista, AZT), 2);
    assert.equal(pendientesDeMiLado(lista, ADMIN), 2);
    assert.equal(pendientesDeMiLado(lista, TERCERO), 0);
    assert.equal(pendientesDeMiLado([], AZT), 0);
  });
  test('orden: abiertas con trabajo, luego las listas para publicar, al final las resueltas (cada grupo, la más reciente primero)', () => {
    const a = obsDe({ 0: 'PENDIENTE' }, { nro: '00000001', creadoEnMs: 1 });
    const b = obsDe({ 0: 'VERIFICADO' }, { nro: '00000002', creadoEnMs: 3 });
    const c = obsDe({ 0: 'PENDIENTE' }, { nro: '00000003', estado: 'RESUELTA', creadoEnMs: 5 });
    const d = obsDe({ 0: 'SUBSANADO' }, { nro: '00000004', creadoEnMs: 4 });
    assert.deepEqual(ordenarLista([a, b, c, d]).map((o) => o.nro), ['00000004', '00000001', '00000002', '00000003']);
  });
  test('próximo id libre para «Agregar punto» y tope de 40', () => {
    assert.equal(siguienteIdPunto(obsDe({ 0: 'PENDIENTE', 1: 'VERIFICADO' })), '2');
    assert.equal(siguienteIdPunto(obsDe({})), '0');
    assert.equal(siguienteIdPunto(obsDe(Object.fromEntries(ID_PUNTOS.map((k) => [k, 'PENDIENTE'])))), null);
  });
  test('integridad: un punto del resumen sin documento, o con otro estado, se avisa', () => {
    const o = obsDe({ 0: 'PENDIENTE', 1: 'SUBSANADO', 2: 'PENDIENTE' });
    assert.deepEqual(revisarIntegridad(o, [punto(0, 'PENDIENTE'), punto(1, 'SUBSANADO'), punto(2, 'PENDIENTE')]), []);
    const av = revisarIntegridad(o, [punto(0, 'PENDIENTE'), punto(1, 'VERIFICADO'), punto(5, 'PENDIENTE')]);
    assert.equal(av.length, 3);
    assert.match(av.join(' | '), /punto 2 no cuadra.*Falta el punto 3.*punto 6 no está en el resumen/);
  });
});

describe('transiciones de un punto (las reglas exigen lo mismo)', () => {
  const o = obsDe({ 0: 'PENDIENTE', 1: 'SUBSANADO' });
  const subsanadoPor = (u) => punto(1, 'SUBSANADO', 1, { 1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Se tomó la foto', por: { uid: u.uid, nombre: u.nombre } } });
  test('AZT asignado: PENDIENTE → SUBSANADO con nota de 3 a 500; nadie más', () => {
    const p = punto(0, 'PENDIENTE');
    assert.deepEqual(accionesPara(o, p, AZT), ['subsanar']);
    assert.deepEqual(accionesPara(o, p, ADMIN), [], 'el admin no marca subsanado');
    assert.deepEqual(accionesPara(o, p, TERCERO), []);
    const t = transicionPunto(o, p, 'subsanar', { nota: '  Se subió la foto  ', sesion: AZT });
    assert.deepEqual(t, { ok: true, estado: 'SUBSANADO', rev: 1, entrada: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Se subió la foto' } });
    assert.equal(transicionPunto(o, p, 'subsanar', { nota: 'ok', sesion: AZT }).codigo, 'validacion');
    assert.match(errorNota('subsanar', ''), /qué se hizo/);
    assert.equal(errorNota('subsanar', 'abc'), null);
    assert.match(errorNota('subsanar', 'n'.repeat(501)), /hasta 500/);
    assert.match(motivoNoPuede(o, p, 'subsanar', TERCERO), /Solo el AZT asignado/);
  });
  test('admin: SUBSANADO → VERIFICADO (nota opcional) o → PENDIENTE (devolver, motivo obligatorio)', () => {
    const p = subsanadoPor(AZT);
    assert.deepEqual(accionesPara(o, p, ADMIN), ['verificar', 'devolver']);
    assert.deepEqual(accionesPara(o, p, AZT), []);
    const v = transicionPunto(o, p, 'verificar', { nota: '', sesion: ADMIN });
    assert.deepEqual(v, { ok: true, estado: 'VERIFICADO', rev: 2, entrada: { de: 'SUBSANADO', a: 'VERIFICADO', nota: '' } });
    assert.equal(transicionPunto(o, p, 'devolver', { nota: '', sesion: ADMIN }).ok, false);
    assert.match(errorNota('devolver', 'no'), /motivo de la devolución/);
    assert.equal(transicionPunto(o, p, 'devolver', { nota: 'La foto no tiene fecha', sesion: ADMIN }).estado, 'PENDIENTE');
    // Desde PENDIENTE o VERIFICADO no se verifica ni se devuelve.
    assert.match(motivoNoPuede(o, punto(0, 'PENDIENTE'), 'verificar', ADMIN), /ya no está «Subsanado · por verificar»/);
    assert.deepEqual(accionesPara(o, punto(0, 'VERIFICADO', 2), ADMIN), []);
  });
  test('separación de funciones: quien lo marcó subsanado no lo verifica ni lo devuelve', () => {
    const p = subsanadoPor(ADMIN2);
    assert.deepEqual(accionesPara(o, p, ADMIN2), []);
    assert.match(motivoNoPuede(o, p, 'verificar', ADMIN2), /lo verifica o lo devuelve otro administrador/);
    assert.deepEqual(accionesPara(o, p, ADMIN), ['verificar', 'devolver']);
  });
  test('una obs RESUELTA no acepta cambios; un admin sin perfil (legacy) tampoco; tope de 50 cambios', () => {
    const r = obsDe({ 0: 'PENDIENTE' }, { estado: 'RESUELTA' });
    assert.match(motivoNoPuede(r, punto(0, 'PENDIENTE'), 'subsanar', AZT), /resuelta/);
    assert.deepEqual(accionesPara(o, subsanadoPor(AZT), { ...ADMIN, legacy: true }), []);
    assert.match(motivoNoPuede(o, punto(0, 'PENDIENTE', 50), 'subsanar', AZT), /máximo de 50 cambios/);
    assert.equal(motivoNoPuede(o, punto(0, 'PENDIENTE', 49), 'subsanar', AZT), null);
  });
  test('rastro: en orden por rev, la última entrada y el texto del cambio', () => {
    const p = punto(0, 'SUBSANADO', 3, {
      3: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'De nuevo' }, 1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Primera' },
      2: { de: 'SUBSANADO', a: 'PENDIENTE', nota: 'Sin fecha' }
    });
    assert.deepEqual(rastroOrdenado(p).map((e) => [e.rev, e.nota]), [[1, 'Primera'], [2, 'Sin fecha'], [3, 'De nuevo']]);
    assert.equal(ultimaEntrada(p).nota, 'De nuevo');
    assert.equal(ultimaEntrada(punto(0, 'PENDIENTE')), null);
    assert.equal(textoCambio({ de: 'PENDIENTE', a: 'SUBSANADO' }), 'Pendiente → Subsanado · por verificar');
  });
  test('dar por resuelta: solo ABIERTA y con nota 3-500', () => {
    assert.equal(errorResolver(o, 'La ODT ya no va'), null);
    assert.match(errorResolver(o, 'no'), /por qué se da por resuelta/);
    assert.match(errorResolver({ ...o, estado: 'RESUELTA' }, 'La ODT ya no va'), /ya está resuelta/);
  });
  test('esAztDe mira los lectores (identidad por uid, nunca por nombre)', () => {
    assert.equal(esAztDe(o, AZT.uid), true);
    assert.equal(esAztDe(o, 'Azt De Prueba'), false);
    assert.equal(esAztDe(null, AZT.uid), false);
  });
});

describe('constantes y su amarre con el bloque «Por subsanar · ODT Afinia» de firestore.rules', () => {
  const i = REGLAS.indexOf('// Por subsanar · ODT Afinia');
  const j = REGLAS.indexOf('// ── Resto: cerrado por defecto ──', i);
  const BLOQUE = i > 0 && j > i ? REGLAS.slice(i, j) : '';
  test('el bloque existe (si se renombra o desaparece, FALLA)', () => {
    assert.ok(BLOQUE.length > 1000, 'no encontré el bloque «Por subsanar · ODT Afinia» en firestore.rules');
  });
  test('colecciones, estados, a quién le toca y etiquetas', () => {
    assert.deepEqual({ ...COL_OBS }, { obs: 'odt_afinia_obs', puntos: 'puntos', nro: 'odt_afinia_obs_nro' });
    assert.match(BLOQUE, /match \/odt_afinia_obs\/\{id\}/);
    assert.match(BLOQUE, /match \/puntos\/\{k\}/);
    assert.match(BLOQUE, /match \/odt_afinia_obs_nro\/\{nro\}/);
    assert.deepEqual({ ...ESTADOS_OBS }, { ABIERTA: 'ABIERTA', RESUELTA: 'RESUELTA' });
    assert.deepEqual({ ...ESTADOS_PUNTO }, { PENDIENTE: 'PENDIENTE', SUBSANADO: 'SUBSANADO', VERIFICADO: 'VERIFICADO' });
    for (const e of [...Object.values(ESTADOS_OBS), ...Object.values(ESTADOS_PUNTO)]) assert.ok(BLOQUE.includes("'" + e + "'"), e);
    assert.deepEqual([...QUIEN], ['contratista', 'azt', 'responsable']);
    assert.ok(BLOQUE.includes("d.quien in ['contratista', 'azt', 'responsable']"));
    assert.deepEqual({ ...ETIQUETA_QUIEN }, { contratista: 'Contratista', azt: 'AZT', responsable: 'Responsable' });
    assert.equal(ETIQUETA_PUNTO.SUBSANADO, 'Subsanado · por verificar');
  });
  test('topes iguales a los de la regla', () => {
    assert.deepEqual({ ...TOPES_OBS }, { puntosMax: 40, textoMin: 5, textoMax: 600, notaMin: 3, notaMax: 500, subestacionMin: 2, subestacionMax: 80, equipoMax: 160, listado: 50, revMax: 50 });
    for (const x of ['odtTexto(d.texto, 5, 600)', 'odtTexto(d.subestacion, 2, 80)', 'odtTexto(d.equipo, 0, 160)', 'n.rev <= 50',
      'odtTexto(n.rastro[r].nota, minNota, 500)', 'odtObsCambio(3)', 'odtObsCambio(0)', 'odtTexto(n.resolucion.nota, 3, 500)',
      'request.query.limit <= 50', 'request.query.limit <= 40', 'd.resumen.size() <= 40']) assert.ok(BLOQUE.includes(x), x);
    assert.equal(ACCIONES.subsanar.notaMin, 3); assert.equal(ACCIONES.verificar.notaMin, 0); assert.equal(ACCIONES.devolver.notaMin, 3);
  });
  test('ids de los puntos: \'0\'..\'39\', con la misma expresión que la regla', () => {
    assert.equal(ID_PUNTOS.length, 40);
    assert.equal(ID_PUNTOS[0], '0'); assert.equal(ID_PUNTOS[39], '39');
    for (const k of ID_PUNTOS) assert.ok(esIdPunto(k), k);
    for (const k of ['40', '-1', '00', '01', 'a', '', '1.0', '0/x']) assert.ok(!esIdPunto(k), k);
    assert.ok(BLOQUE.includes("k.matches('^([0-9]|[1-3][0-9])$')"));
    const lista = /function odtObsIds\(\) \{\s*return \[([\s\S]*?)\];/.exec(BLOQUE);
    assert.ok(lista, 'odtObsIds en la regla');
    assert.deepEqual([...lista[1].matchAll(/'(\d+)'/g)].map((m) => m[1]), [...ID_PUNTOS]);
  });
});
