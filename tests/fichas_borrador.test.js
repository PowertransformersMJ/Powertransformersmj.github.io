// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El borrador de la ficha no se pierde ni se pisa (99 §83)
// ──────────────────────────────────────────────────────────────
// Cada prueba de aquí es un fallo que el comité marcó BLOQUEANTE sobre el
// diseño. Los datos son INVENTADOS a propósito: está prohibido copiar un
// borrador real del navegador del Ingeniero a un archivo del repo público.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION, TOPE_EQUIPOS, DIAS_VIDA,
  documentoVacio, entradaDesdeFicha, leerDocumento, fusionar, serializar,
  emparejar, resumenParaBanda, tieneContenido, soloLoTocado
} from '../assets/js/domain/fichas_borrador.js';
import { semillaDiagramas } from '../assets/js/ui/fichas/unifilar.js';
import { identidadDeEquipo, mismaIdentidad } from '../assets/js/domain/fichas_identidad.js';

const AHORA = '2026-09-22T15:00:00.000Z';
const AYER = '2026-09-21T15:00:00.000Z';
const HACE40DIAS = '2026-08-13T15:00:00.000Z';

const TX1 = { fila: 7, codigo: 'M-DEMO', matricula: 'T1-A/M-DEMO', serie: 'S-101', subestacion: 'SUBESTACION DEMO' };
const TX2 = { fila: 8, codigo: 'M-DEMO', matricula: 'T4-A/M-DEMO', serie: 'S-102', subestacion: 'SUBESTACION DEMO' };

const conTexto = (equipo, texto, iso = AHORA) => entradaDesdeFicha({
  equipo, plan: { proyecto: texto, alcance_ver: 2, acc_sel: ['SUB-C3-M1'] },
  anexo: { obs: 'NOTA DE PRUEBA' }, diagramas: {}, ahoraISO: iso
});

describe('qué se guarda y qué no', () => {
  test('sin matrícula ni serie NO se guarda: no habría cómo devolverlo a su equipo', () => {
    assert.equal(entradaDesdeFicha({ equipo: { codigo: 'M-DEMO', fila: 3 }, plan: { proyecto: 'X' }, ahoraISO: AHORA }), null);
    assert.equal(identidadDeEquipo({ codigo: 'M-DEMO', subestacion: 'SUBESTACION DEMO' }), null);
  });

  test('una ficha en blanco no se guarda', () => {
    assert.equal(entradaDesdeFicha({ equipo: TX1, plan: {}, anexo: {}, diagramas: {}, ahoraISO: AHORA }), null);
    assert.equal(entradaDesdeFicha({ equipo: TX1, plan: { proyecto: '   ' }, ahoraISO: AHORA }), null);
  });

  test('elegir una redacción y dejarla vacía NO es una ficha redactada', () => {
    assert.equal(entradaDesdeFicha({ equipo: TX1, plan: { alcance: '', alcance_ver: 'custom' }, ahoraISO: AHORA }), null);
  });

  // 🔒 `99 §85`: abrir la ficha deja escrita la redacción del formato. Ese texto
  // lo compuso el MÓDULO y se rehace solo con su `_ver`, así que no puede
  // contar como trabajo: si contara, la ficha aparecería «ocupada» y el
  // borrador guardado del Ingeniero se saltaría al restaurar.
  test('el texto que compone el módulo no es trabajo del Ingeniero', () => {
    assert.equal(entradaDesdeFicha({ equipo: TX1, plan: { alcance: 'TEXTO COMPUESTO', alcance_ver: 2 }, ahoraISO: AHORA }), null,
      'solo el texto sembrado: no hay nada que guardar');
    // Lo que él escribe a mano SÍ cuenta, y se guarda.
    const suyo = entradaDesdeFicha({ equipo: TX1, plan: { alcance: 'LO QUE YO ESCRIBÍ', alcance_ver: 'custom' }, ahoraISO: AHORA });
    assert.ok(suyo && suyo.plan.alcance === 'LO QUE YO ESCRIBÍ');
    // Y marcar acciones también: ahí la versión elegida viaja con ellas.
    const conAcciones = entradaDesdeFicha({ equipo: TX1, plan: { alcance: 'TEXTO COMPUESTO', alcance_ver: 2, acc_sel: ['SUB-C3-M1'] }, ahoraISO: AHORA });
    assert.ok(conAcciones, 'marcar acciones es trabajo suyo');
    assert.equal(conAcciones.plan.alcance_ver, 2, 'la versión elegida se guarda con ellas');
  });

  test('el diagrama solo también cuenta como trabajo', () => {
    const e = entradaDesdeFicha({ equipo: TX1, plan: {}, anexo: {}, diagramas: { actual: { notas: 'NOTA' } }, ahoraISO: AHORA });
    assert.ok(e && tieneContenido(e));
  });

  test('se guarda lo TECLEADO tal cual, sin reinterpretar la cifra', () => {
    const e = entradaDesdeFicha({ equipo: TX1, plan: { presu_real: '1.234.567,89' }, ahoraISO: AHORA });
    assert.equal(e.plan.presu_real, '1.234.567,89');
  });

  test('no se cuela nada del parque ni basura de otro tipo', () => {
    const e = entradaDesdeFicha({
      equipo: TX1,
      plan: { proyecto: 'X', equipos: { uno: 1 }, fn: () => 1, nulo: null, ver: 3, ok: true },
      ahoraISO: AHORA
    });
    assert.deepEqual(Object.keys(e.plan).sort(), ['ok', 'proyecto', 'ver']);
  });

  test('la subestación se guarda para MOSTRARLA, nunca como identidad', () => {
    const e = conTexto(TX1);
    assert.equal(e.clave, 'M:T1-A/M-DEMO');
    assert.equal(e.subestacion, 'SUBESTACION DEMO');
  });
});

describe('guardar es FUSIONAR contra el disco, nunca volcar la memoria', () => {
  test('una sesión recién abierta NO borra las fichas de ayer', () => {
    const disco = fusionar(documentoVacio('u1'), [conTexto(TX1, 'DE AYER', AYER), conTexto(TX2, 'DE AYER', AYER)], { uid: 'u1', ahoraISO: AYER });
    assert.equal(Object.keys(disco.equipos).length, 2);
    // Hoy se abre la pantalla (memoria vacía) y se escribe SOLO en un equipo nuevo.
    const TX3 = { matricula: 'T2-A/M-OTRA', serie: 'S-200', subestacion: 'OTRA DEMO' };
    const despues = fusionar(disco, [conTexto(TX3, 'DE HOY')], { uid: 'u1', ahoraISO: AHORA });
    assert.equal(Object.keys(despues.equipos).length, 3, 'las dos de ayer siguen ahí');
    assert.equal(despues.equipos['M:T1-A/M-DEMO'].plan.proyecto, 'DE AYER');
  });

  test('un mapa vacío jamás se traduce en un borrado (adjuntar listado a mitad de redacción)', () => {
    const disco = fusionar(documentoVacio('u1'), [conTexto(TX1, 'MEDIA PAGINA', AYER)], { uid: 'u1', ahoraISO: AYER });
    const trasClear = fusionar(disco, [], { uid: 'u1', ahoraISO: AHORA });
    assert.equal(Object.keys(trasClear.equipos).length, 1);
    assert.equal(trasClear.equipos['M:T1-A/M-DEMO'].plan.proyecto, 'MEDIA PAGINA');
  });

  test('entre dos versiones del mismo equipo gana la más nueva, no la última en llegar', () => {
    const disco = fusionar(documentoVacio('u1'), [conTexto(TX1, 'NUEVO', AHORA)], { uid: 'u1', ahoraISO: AHORA });
    const conVieja = fusionar(disco, [conTexto(TX1, 'VIEJO', AYER)], { uid: 'u1', ahoraISO: AHORA });
    assert.equal(conVieja.equipos['M:T1-A/M-DEMO'].plan.proyecto, 'NUEVO', 'la pestaña vieja no pisa a la nueva');
  });
});

describe('lo que vuelve del disco es entrada NO confiable', () => {
  test('un JSON roto o de forma inesperada no rompe la pantalla', () => {
    for (const crudo of ['{', 'null', '[]', '"texto"', '{"v":1}']) {
      const r = leerDocumento(crudo, { uid: 'u1', ahoraISO: AHORA });
      assert.ok(['corrupto', 'vacio'].includes(r.estado), crudo + ' → ' + r.estado);
      assert.equal(r.doc, null);
    }
    assert.equal(leerDocumento(null, {}).estado, 'vacio');
  });

  test('un borrador de una versión MÁS NUEVA no se lee ni se pisa', () => {
    const r = leerDocumento(JSON.stringify({ v: VERSION + 1, equipos: {} }), { uid: 'u1', ahoraISO: AHORA });
    assert.equal(r.estado, 'futuro');
  });

  test('el borrador de otro usuario del mismo computador no se muestra', () => {
    const doc = fusionar(documentoVacio('otro'), [conTexto(TX1)], { uid: 'otro', ahoraISO: AHORA });
    const r = leerDocumento(serializar(doc), { uid: 'yo', ahoraISO: AHORA });
    assert.equal(r.estado, 'ajeno');
    assert.equal(r.doc, null);
  });

  test('__proto__ y compañía no contaminan nada', () => {
    const veneno = '{"v":1,"equipos":{"__proto__":{"matricula":"X","plan":{"a":"b"}},'
      + '"M:T1-A/M-DEMO":{"matricula":"T1-A/M-DEMO","plan":{"__proto__":{"x":1},"constructor":"y","ok":"si"}}}}';
    const r = leerDocumento(veneno, { uid: '', ahoraISO: AHORA });
    assert.equal(r.estado, 'ok');
    assert.equal(({}).x, undefined, 'el prototipo global sigue limpio');
    assert.deepEqual(Object.keys(r.doc.equipos), ['M:T1-A/M-DEMO']);
    assert.deepEqual(Object.keys(r.doc.equipos['M:T1-A/M-DEMO'].plan), ['ok']);
  });

  test('los caracteres de control se limpian y el campo tiene tope', () => {
    const largo = 'A'.repeat(9000);
    const e = entradaDesdeFicha({ equipo: TX1, plan: { a: 'ho\u0000la', b: largo }, ahoraISO: AHORA });
    assert.equal(e.plan.a, 'hola');
    assert.equal(e.plan.b.length, 8000);
  });
});

describe('caducidad y topes', () => {
  test('lo de hace más de 30 días se descarta al abrir, y se dice cuántos', () => {
    const doc = fusionar(documentoVacio('u1'), [conTexto(TX1, 'VIEJO', HACE40DIAS), conTexto(TX2, 'RECIENTE', AYER)], { uid: 'u1', ahoraISO: AHORA });
    const r = leerDocumento(serializar(doc), { uid: 'u1', ahoraISO: AHORA });
    assert.equal(r.caducados, 1);
    assert.deepEqual(Object.keys(r.doc.equipos), ['M:T4-A/M-DEMO']);
    assert.ok(DIAS_VIDA === 30);
  });

  test('al pasarse del tope de equipos se sacrifica el más viejo', () => {
    let doc = documentoVacio('u1');
    for (let i = 0; i < TOPE_EQUIPOS + 3; i++) {
      const eq = { matricula: 'TX-' + String(i).padStart(3, '0'), serie: 'S-' + i, subestacion: 'DEMO' };
      const iso = new Date(Date.parse(AYER) + i * 60000).toISOString();
      doc = fusionar(doc, [conTexto(eq, 'F' + i, iso)], { uid: 'u1', ahoraISO: iso });
    }
    assert.equal(Object.keys(doc.equipos).length, TOPE_EQUIPOS);
    ['M:TX-000', 'M:TX-001', 'M:TX-002'].forEach((k) => assert.equal(doc.equipos[k], undefined, k + ' era de los más viejos'));
    assert.ok(doc.equipos['M:TX-042'], 'el más nuevo sigue');
    // El contador es de ESTE guardado, para poder avisarlo en pantalla: se
    // sacrifica uno por cada ficha nueva que entra pasado el tope.
    assert.equal(doc.evicciones, 1);
  });
});

describe('restaurar no puede equivocarse de equipo (la lección §82)', () => {
  const docDe = (...entradas) => fusionar(documentoVacio('u1'), entradas, { uid: 'u1', ahoraISO: AHORA });

  test('dos TX de la misma subestación NO se confunden', () => {
    const doc = docDe(conTexto(TX1, 'FICHA DEL T1'));
    const r = emparejar(doc, [TX1, TX2], () => false);
    assert.equal(r.aplicables.length, 1);
    assert.equal(r.aplicables[0].equipo.matricula, 'T1-A/M-DEMO');
    assert.equal(mismaIdentidad(identidadDeEquipo(TX1), identidadDeEquipo(TX2)), false);
  });

  test('si el equipo repuso su matrícula pero la serie es otra, NO se restaura', () => {
    const doc = docDe(conTexto(TX1, 'FICHA VIEJA'));
    const repuesto = { matricula: 'T1-A/M-DEMO', serie: 'S-999', subestacion: 'SUBESTACION DEMO' };
    const r = emparejar(doc, [repuesto], () => false);
    assert.equal(r.aplicables.length, 0);
    assert.equal(r.sinUbicar.length, 1);
  });

  test('si calza con más de un equipo no se aplica a ninguno', () => {
    const doc = docDe(conTexto(TX1, 'FICHA'));
    const clonado = { matricula: 'T1-A/M-DEMO', subestacion: 'OTRA' };
    const r = emparejar(doc, [{ matricula: 'T1-A/M-DEMO', serie: '', subestacion: 'SUBESTACION DEMO' }, clonado], () => false);
    assert.equal(r.aplicables.length, 0);
    assert.equal(r.ambiguos.length, 1);
  });

  test('restaurar NO pisa lo que se acaba de escribir hoy', () => {
    const doc = docDe(conTexto(TX1, 'DE AYER'), conTexto(TX2, 'DE AYER'));
    const r = emparejar(doc, [TX1, TX2], (eq) => eq.matricula === 'T1-A/M-DEMO');
    assert.equal(r.ocupados.length, 1, 'la que ya tiene texto se omite');
    assert.equal(r.aplicables.length, 1);
    assert.equal(r.aplicables[0].equipo.matricula, 'T4-A/M-DEMO');
  });

  test('el equipo que no está en la lista cargada se conserva, no se tira', () => {
    const doc = docDe(conTexto(TX1, 'FICHA'), conTexto(TX2, 'FICHA'));
    const r = emparejar(doc, [TX1], () => false);
    assert.equal(r.aplicables.length, 1);
    assert.equal(r.sinUbicar.length, 1);
    assert.equal(r.sinUbicar[0].matricula, 'T4-A/M-DEMO');
  });

  test('la matrícula se compara normalizada (espacios y minúsculas)', () => {
    const doc = docDe(conTexto(TX1, 'FICHA'));
    const igual = { matricula: '  t1-a/m-demo ', serie: 's-101', subestacion: 'otra' };
    assert.equal(emparejar(doc, [igual], () => false).aplicables.length, 1);
  });
});

describe('lo que puede decir la banda', () => {
  test('identifica por equipo y fecha, nunca por plata ni por quién firma', () => {
    const doc = fusionar(documentoVacio('u1'), [
      entradaDesdeFicha({ equipo: TX1, plan: { presu_real: '9.999.999', nom_elab: 'NOMBRE DE PRUEBA' }, ahoraISO: AYER }),
      conTexto(TX2, 'X', AHORA)
    ], { uid: 'u1', ahoraISO: AHORA });
    const b = resumenParaBanda(doc);
    assert.equal(b.total, 2);
    assert.equal(b.equipos[0].matricula, 'T4-A/M-DEMO', 'lo más reciente primero');
    const texto = JSON.stringify(b);
    assert.ok(!texto.includes('9.999.999'), 'el presupuesto NO sale en la banda');
    assert.ok(!texto.includes('NOMBRE DE PRUEBA'), 'los firmantes NO salen en la banda');
  });
});


describe('del diagrama solo viaja lo que el Ingeniero cambió (99 §83.7)', () => {
  const EQ = { matricula: 'T1-A/M-DEMO', serie: 'S-101', subestacion: 'SUBESTACION DEMO',
               potencia_kva: 40000, kv_prim: 66, kv_sec: 13.8, regulacion: 'OLTC' };

  test('un diagrama intacto NO se guarda: es la placa del parque, no trabajo', () => {
    const sem = semillaDiagramas(EQ);
    assert.deepEqual(soloLoTocado(sem, sem), {});
    // …y por tanto una ficha en blanco sigue sin guardarse
    assert.equal(entradaDesdeFicha({ equipo: EQ, plan: {}, anexo: {}, diagramas: soloLoTocado(sem, sem), ahoraISO: AHORA }), null);
  });

  test('lo que se aparta de la placa SÍ viaja, y solo eso', () => {
    const sem = semillaDiagramas(EQ);
    const vivo = JSON.parse(JSON.stringify(sem));
    vivo.futuro.potONAF = '60';
    vivo.futuro.notas = 'PROPUESTA DE PRUEBA';
    const d = soloLoTocado(vivo, sem);
    assert.deepEqual(Object.keys(d), ['futuro']);
    assert.deepEqual(d.futuro, { potONAF: '60', notas: 'PROPUESTA DE PRUEBA' });
    assert.equal(d.futuro.kvPrim, undefined, 'la tensión de placa no se guarda');
  });

  test('una ficha cuyo único trabajo es el diagrama cuenta como trabajo', () => {
    const sem = semillaDiagramas(EQ);
    const vivo = JSON.parse(JSON.stringify(sem));
    vivo.actual.notas = 'NOTA DE PRUEBA';
    const e = entradaDesdeFicha({ equipo: EQ, plan: {}, anexo: {}, diagramas: soloLoTocado(vivo, sem), ahoraISO: AHORA });
    assert.ok(e, 'debe guardarse');
    assert.ok(tieneContenido(e), 'y debe contar como escrita, para que restaurar no la pise');
  });
});
