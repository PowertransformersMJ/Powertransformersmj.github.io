// Informe de Mantenimiento Brigada (F60-ADM) — modelo del informe: prellenado (decisión 10),
// potencia confirmada (decisión 8), acción opcional que NUNCA se toca (decisión 12) y faltantes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../assets/js/domain/informe_brigada_modelo.js';
import { ACTIVIDADES } from '../assets/js/domain/informe_brigada_plantilla.js';
import { txPrueba, accionPrueba, configPrueba, contenidoCompletoEjemplo, PERSONAS } from './informe_brigada_fixture.js';

const origenDe = (c, ruta) => c.origenes.find((o) => o.ruta === ruta);
const rutasFaltantes = (c, cfg) => M.faltantes(c, { config: cfg }).filter((f) => f.bloquea).map((f) => f.ruta);

describe('inventario → equipo', () => {
  test('lee las rutas del documento v2 en su orden (la matrícula nunca sale de «codigo»)', () => {
    const e = M.equipoDesdeInventario(txPrueba());
    assert.equal(e.transformador_id, 'tx-prueba-001');
    assert.equal(e.matricula, 'T9-Z/Z-PRU');
    assert.equal(e.serie, 'SERIE-PRUEBA-001', 'numero_serie va antes que placa.serial');
    assert.equal(e.subestacion, 'PRUEBA NORTE');
    assert.equal(e.zona, 'OCCIDENTE');
    assert.equal(e.departamento, 'cordoba');
    assert.equal(e.municipio, 'MUNICIPIO PRUEBA');
    assert.equal(e.fabricante, '');
    assert.equal(e.anio_fabricacion, 2019);
    assert.equal(e.potencia_kva, 14000);
    assert.equal(e.tension_primaria_kv, 34.5);
    assert.deepEqual(e.salud, { numero: 2, texto: 'bueno', fuente: 'excel', hi: 2.2 });
    const sinMat = M.equipoDesdeInventario({ identificacion: { codigo: 'SOLO-CODIGO' } });
    assert.equal(sinMat.matricula, '');
  });
  test('rutas planas (v1) como respaldo', () => {
    const e = M.equipoDesdeInventario({ matricula: 'M-PLANA', subestacion: 'SUB PLANA', marca: 'MARCA PLANA', serial: 'S-1', tension_primaria_kv: 13.2, anio_fab: 2001 });
    assert.equal(e.matricula, 'M-PLANA');
    assert.equal(e.fabricante, 'MARCA PLANA');
    assert.equal(e.serie, 'S-1');
    assert.equal(e.tension_primaria_kv, 13.2);
    assert.equal(e.anio_fabricacion, 2001);
  });
  test('salud fuera de 0,5–5,49 = sin calificación (nunca se inventa una condición)', () => {
    for (const hi of [0, 0.4, 5.6, null, 'x']) {
      const e = M.equipoDesdeInventario({ salud_actual: { hi_final: hi } });
      assert.equal(e.salud.numero, null, String(hi));
      assert.equal(e.salud.texto, '');
    }
    assert.equal(M.equipoDesdeInventario({ salud_actual: { hi_final: 4.6 } }).salud.numero, 5);
    assert.equal(M.equipoDesdeInventario({ salud_actual: { hi_final: 4.6 } }).salud.texto, 'muy pobre');
  });
});

describe('informe vacío', () => {
  test('toda actividad válida usa el único modelo (F60 de refrigeración); la vacía, corta, larga o de varias líneas no', () => {
    const c = M.informeVacio();
    assert.equal(c.esquema, 'ibr@1');
    assert.equal(c.modelo, 'F60-REFRIG@1');
    assert.equal(c.actividad, ACTIVIDADES[0]);
    // Pedido del Ingeniero (2026-10-26): la actividad se escoge de la lista o se escribe a mano.
    for (const a of [ACTIVIDADES[1], ACTIVIDADES[7], 'Cambio de bujes de baja tensión']) {
      const x = M.informeVacio({ actividad: a });
      assert.equal(x.modelo, 'F60-REFRIG@1', a);
      assert.equal(x.actividad, a);
      assert.deepEqual(x.portada, c.portada, 'la portada nace con los textos del modelo F60 (se ajustan en el editor)');
    }
    assert.equal(M.informeVacio({ actividad: '  Cambio   de bujes\u00a0de baja ' }).actividad, 'Cambio de bujes de baja', 'se guarda sin espacios sobrantes');
    assert.throws(() => M.informeVacio({ actividad: '' }), /Escriba la actividad/);
    assert.throws(() => M.informeVacio({ actividad: 'ab' }), /muy corta/);
    assert.throws(() => M.informeVacio({ actividad: 'x'.repeat(201) }), /muy larga/);
    assert.throws(() => M.informeVacio({ actividad: 'Primera línea\nSegunda línea' }), /una sola línea/);
  });
  test('prellenar con una actividad escrita a mano: mismo modelo y mismo prellenado que refrigeración', () => {
    const ref = M.prellenar({ equipo: txPrueba(), config: configPrueba() });
    const otra = M.prellenar({ equipo: txPrueba(), config: configPrueba(), actividad: ' Revisión  general del transformador ' });
    assert.equal(otra.actividad, 'Revisión general del transformador');
    assert.equal(otra.modelo, ref.modelo);
    assert.deepEqual({ ...otra, actividad: null }, { ...ref, actividad: null });
    assert.throws(() => M.prellenar({ equipo: txPrueba(), actividad: '  ' }), /Escriba la actividad/);
  });
  test('es JSON puro: sin undefined y sin listas dentro de listas (L-30)', () => {
    const c = M.informeVacio();
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
    const listaEnLista = (v) => (Array.isArray(v) ? v.some((x) => Array.isArray(x) || listaEnLista(x))
      : v && typeof v === 'object' ? Object.values(v).some(listaEnLista) : false);
    assert.equal(listaEnLista(c), false);
  });
  test('trae plantilla, 22 figuras, anexos y 60 Hz fijo', () => {
    const c = M.informeVacio();
    let n = 0;
    Object.values(c.figuras).forEach((gs) => gs.forEach((g) => { n += g.disposicion === '2x1' ? 2 : 1; }));
    assert.equal(n, 22);
    assert.deepEqual(c.anexos.map((a) => a.clave), ['consignacion', 'ficha_actual', 'ficha_nuevo', 'calculo']);
    assert.equal(c.equipo.frecuencia_hz, 60);
    assert.equal(M.estadoCampo(c, 'equipo.frecuencia_hz').fuente, 'fijo');
    assert.equal(c.conclusiones.length, 3);
    assert.equal(c.recomendaciones.length, 7);
    assert.ok(Object.values(c.textos).every((t) => t === null));
  });
});

describe('prellenar (decisión 10)', () => {
  test('sin acción: ONAF del inventario, ONAN vacía y potencia SIN confirmar', () => {
    const c = M.prellenar({ equipo: txPrueba(), config: configPrueba() });
    assert.equal(c.equipo.potencia_onaf_mva, 14);
    assert.equal(c.equipo.potencia_onan_mva, null);
    assert.equal(c.confirmaciones.potencia, false);
    assert.equal(origenDe(c, 'equipo.potencia_onaf_mva').fuente, 'inventario');
    assert.equal(c.equipo.tension_primaria_v, 34500);
    assert.equal(c.equipo.tension_secundaria_v, 13800);
    assert.equal(c.equipo.departamento, 'CÓRDOBA');
    assert.equal(c.equipo.subestacion, 'Prueba Norte');
    assert.equal(origenDe(c, 'equipo.subestacion').crudo, 'PRUEBA NORTE');
    assert.equal(c.portada.contrato, '9900000001');
    assert.equal(M.estadoCampo(c, 'portada.contrato').fuente, 'configuracion');
    assert.equal(M.estadoCampo(c, 'equipo.frecuencia_hz').fuente, 'fijo');
    assert.equal(M.estadoCampo(c, 'salud.numero').fuente, 'salud');
    assert.deepEqual(c.salud, { numero: 2, texto: 'bueno', fuente: 'excel' });
    assert.equal(c.ventiladores.accion_id, null);
    assert.equal(c.equipo.transformador_id, 'tx-prueba-001');
  });
  test('acepta el equipo ya normalizado', () => {
    const a = M.prellenar({ equipo: txPrueba() });
    const b = M.prellenar({ equipo: M.equipoDesdeInventario(txPrueba()) });
    assert.deepEqual(a, b);
  });
  test('con acción: las dos potencias y los ventiladores nuevos salen de la acción', () => {
    const c = M.prellenar({ equipo: txPrueba(), config: configPrueba(), accion: accionPrueba() });
    assert.equal(c.equipo.potencia_onan_mva, 10);
    assert.equal(c.equipo.potencia_onaf_mva, 14);
    assert.equal(origenDe(c, 'equipo.potencia_onan_mva').fuente, 'accion');
    assert.equal(c.confirmaciones.potencia, false);
    assert.deepEqual(c.ventiladores.nuevo, [{ marca: 'MARCA-PRUEBA', modelo: 'VX-100', cantidad: 4, cfm_unitario: 7000 }]);
    assert.equal(c.ventiladores.accion_id, 'accion-prueba-1');
    assert.equal(c.ventiladores.accion_fecha, '2026-03-10');
    assert.equal(c.tablas.material[0].descripcion, 'VENTILADOR MARCA-PRUEBA VX-100 (7000 CFM)');
    assert.equal(c.tablas.material[0].auto, true);
    assert.deepEqual(c.corrientes.filas.map((f) => f.ventilador), ['V1 VX-100', 'V2 VX-100', 'V3 VX-100', 'V4 VX-100']);
    assert.equal(c.corrientes.nominal.etiqueta, 'NOMINAL VX-100');
    const pie = c.figuras.montaje[4].figuras[0].pie;
    assert.equal(pie, 'Ventiladores VX-100 instalados');
  });
  test('la acción de entrada NO cambia (decisión 12)', () => {
    const accion = accionPrueba();
    const antes = structuredClone(accion);
    const c = M.prellenar({ equipo: txPrueba(), accion });
    M.cambiarCampo(c, 'ventiladores.nuevo.0.cantidad', 9);
    assert.deepEqual(accion, antes);
  });
  test('ventiladores del mismo modelo en la acción se suman en una fila', () => {
    const accion = accionPrueba();
    accion.mix.push({ marca: 'MARCA-PRUEBA', modelo: 'VX-100', cfm_unitario: 7000, cantidad: 2 }, { marca: 'OTRA', modelo: 'VZ-9', cfm_unitario: 6000, cantidad: 1 });
    const c = M.prellenar({ equipo: txPrueba(), accion });
    assert.deepEqual(c.ventiladores.nuevo.map((f) => [f.modelo, f.cantidad]), [['VX-100', 6], ['VZ-9', 1]]);
    assert.equal(c.corrientes.filas.length, 7);
    assert.equal(c.corrientes.filas[6].ventilador, 'V7 VZ-9');
  });
  test('ONAN y ONAF separadas del inventario, si existen', () => {
    const tx = txPrueba();
    tx.placa.potencia_onan_kva = 20000; tx.placa.potencia_onaf_kva = 25000;
    const c = M.prellenar({ equipo: tx });
    assert.equal(c.equipo.potencia_onan_mva, 20);
    assert.equal(c.equipo.potencia_onaf_mva, 25);
  });
  test('sin calificación de salud: queda el origen para avisarlo', () => {
    const tx = txPrueba(); tx.salud_actual.hi_final = 0;
    const c = M.prellenar({ equipo: tx });
    assert.equal(c.salud.numero, null);
    const f = M.faltantes(c);
    assert.ok(f.some((x) => x.ruta === 'salud.numero' && x.bloquea));
    assert.ok(f.some((x) => x.ruta === 'salud.numero' && !x.bloquea && /no trae calificación/.test(x.etiqueta)));
  });
});

describe('cambiar campos', () => {
  test('marca «cambiado» con el valor original a la vista y no muta la entrada', () => {
    const c = M.prellenar({ equipo: txPrueba() });
    const copia = structuredClone(c);
    const d = M.cambiarCampo(c, 'equipo.serie', 'SERIE-CORREGIDA');
    assert.deepEqual(c, copia);
    const e = M.estadoCampo(d, 'equipo.serie');
    assert.deepEqual(e, { fuente: 'inventario', original: 'SERIE-PRUEBA-001', cambiado: true, vacio: false });
    assert.equal(M.estadoCampo(c, 'equipo.serie').cambiado, false);
  });
  test('tocar ONAN u ONAF quita la confirmación de la potencia (decisión 8)', () => {
    let c = M.confirmarPotencia(M.prellenar({ equipo: txPrueba() }), true);
    assert.equal(c.confirmaciones.potencia, true);
    c = M.cambiarCampo(c, 'equipo.potencia_onan_mva', 10);
    assert.equal(c.confirmaciones.potencia, false);
    c = M.confirmarPotencia(c);
    c = M.cambiarCampo(c, 'equipo.potencia_onaf_mva', 14);
    assert.equal(c.confirmaciones.potencia, false);
  });
  test('rutas peligrosas o mal formadas se rechazan', () => {
    const c = M.informeVacio();
    assert.throws(() => M.cambiarCampo(c, '__proto__.x', 1));
    assert.throws(() => M.cambiarCampo(c, 'equipo..serie', 1));
    assert.throws(() => M.cambiarCampo(c, 'odt.x', 1));
  });
  test('un pie escrito a mano deja de seguir a los ventiladores', () => {
    let c = M.prellenar({ equipo: txPrueba(), accion: accionPrueba() });
    c = M.cambiarCampo(c, 'figuras.montaje.4.figuras.1.pie', 'Pie propio');
    c = M.cambiarCampo(c, 'ventiladores.nuevo.0.modelo', 'VX-200');
    assert.equal(c.figuras.montaje[4].figuras[0].pie, 'Ventiladores VX-200 instalados');
    assert.equal(c.figuras.montaje[4].figuras[1].pie, 'Pie propio');
    assert.equal(M.estadoCampo(c, 'figuras.montaje.4.figuras.0.pie').fuente, 'plantilla');
  });
  test('las mediciones de la Tabla 5 se conservan al regenerar; una fila medida que ya no corresponde pasa a «a mano»', () => {
    let c = M.prellenar({ equipo: txPrueba(), accion: accionPrueba() });
    c = M.cambiarCampo(c, 'corrientes.filas.0.r', 2.1);
    c = M.regenerarFilasAuto(c);
    assert.equal(c.corrientes.filas[0].r, 2.1);
    c = M.cambiarCampo(c, 'ventiladores.nuevo.0.cantidad', 2);
    assert.equal(c.corrientes.filas.length, 2);
    assert.equal(c.corrientes.filas[0].r, 2.1);
    c = M.cambiarCampo(c, 'ventiladores.nuevo.0.modelo', 'VX-200');
    assert.deepEqual(c.corrientes.filas.map((f) => [f.ventilador, f.auto]), [['V1 VX-200', true], ['V2 VX-200', true], ['V1 VX-100', false]]);
    assert.equal(c.corrientes.filas[2].r, 2.1, 'la medición no se pierde');
  });
  test('una fila automática de material escrita a mano ya no se regenera ni se duplica', () => {
    let c = M.prellenar({ equipo: txPrueba(), accion: accionPrueba() });
    c = M.cambiarCampo(c, 'tablas.material.0.cantidad', 5);
    assert.equal(c.tablas.material[0].auto, false);
    c = M.regenerarFilasAuto(c);
    assert.equal(c.tablas.material.filter((f) => /VX-100/.test(f.descripcion)).length, 1);
    assert.equal(c.tablas.material.find((f) => /VX-100/.test(f.descripcion)).cantidad, 5);
  });
  test('cambiar la DESCRIPCIÓN de la fila automática (código completo del modelo) no la duplica', () => {
    let c = M.prellenar({ equipo: txPrueba(), accion: accionPrueba() });
    const n = c.tablas.material.length;
    c = M.cambiarCampo(c, 'tablas.material.0.descripcion', 'VENTILADOR MARCA-PRUEBA VX-100-4DH (7000 CFM)');
    assert.equal(c.tablas.material.length, n, 'no aparece una fila nueva');
    assert.equal(c.tablas.material.filter((f) => /VX-100/.test(f.descripcion)).length, 1);
    assert.equal(c.tablas.material[0].auto, false);
    // primero la cantidad y después la descripción: tampoco se duplica
    let d = M.prellenar({ equipo: txPrueba(), accion: accionPrueba() });
    d = M.cambiarCampo(d, 'tablas.material.0.cantidad', 5);
    d = M.cambiarCampo(d, 'tablas.material.0.descripcion', 'VENTILADOR VX-100 CÓDIGO LARGO');
    d = M.regenerarFilasAuto(d);
    assert.equal(d.tablas.material.filter((f) => /VX-100/.test(f.descripcion)).length, 1);
    // si cambia el MODELO del ventilador nuevo, sí aparece la fila automática del modelo nuevo
    d = M.cambiarCampo(d, 'ventiladores.nuevo.0.modelo', 'VX-200');
    assert.equal(d.tablas.material.filter((f) => f.auto && /VX-200/.test(f.descripcion)).length, 1);
    assert.equal(d.tablas.material.filter((f) => /VX-100/.test(f.descripcion)).length, 1, 'la escrita a mano se conserva');
  });
  test('Tabla 4: lo «por persona» sigue al personal hasta que se escribe a mano', () => {
    let c = M.informeVacio();
    assert.equal(c.tablas.sst[0].cantidad, 3);
    c = M.cambiarCampo(c, 'personal.ingeniero', PERSONAS.ingeniero);
    c = M.cambiarCampo(c, 'personal.tecnicos', ['Técnico Prueba Dos', 'Técnico Prueba Tres', 'Técnico Prueba Cuatro']);
    assert.equal(c.tablas.sst[0].cantidad, 4);
    assert.equal(c.tablas.sst[5].cantidad, 1, 'la escalera no va por persona');
    c = M.cambiarCampo(c, 'tablas.sst.1.cantidad', 9);
    c = M.cambiarCampo(c, 'personal.tecnicos', ['Técnico Prueba Dos']);
    assert.equal(c.tablas.sst[0].cantidad, 2);
    assert.equal(c.tablas.sst[1].cantidad, 9);
  });
  test('firmas: un nombre escrito a mano suelta al firmante (su firma solo va con SU nombre)', () => {
    let c = M.asignarFirmante(M.informeVacio(), 'revisado', { clave: 'f-x', nombre: 'Firmante Prueba' });
    assert.deepEqual(c.firmas.revisado, { nombre: 'FIRMANTE PRUEBA', firmante: 'f-x' });
    c = M.cambiarCampo(c, 'firmas.revisado.nombre', 'OTRA PERSONA PRUEBA');
    assert.equal(c.firmas.revisado.firmante, null);
    c = M.asignarFirmante(c, 'revisado', null);
    assert.deepEqual(c.firmas.revisado, { nombre: '', firmante: null });
    assert.throws(() => M.asignarFirmante(c, 'otro', null));
  });
  test('condición de salud escrita a mano: trae su nombre de la escala', () => {
    const tx = txPrueba(); tx.salud_actual.hi_final = 0;
    let c = M.cambiarCampo(M.prellenar({ equipo: tx }), 'salud.numero', 3);
    assert.deepEqual(c.salud, { numero: 3, texto: 'medio', fuente: '' });
    assert.ok(!M.faltantes(c).some((f) => f.ruta.startsWith('salud.') && f.bloquea));
    c = M.cambiarCampo(c, 'salud.numero', null);
    assert.equal(c.salud.texto, '');
  });
  test('textos de plantilla: null = plantilla viva; texto = a mano (aviso)', () => {
    let c = M.prellenar({ equipo: txPrueba() });
    const e0 = M.estadoCampo(c, 'textos.intro_p2');
    assert.equal(e0.fuente, 'plantilla');
    assert.match(e0.original, /Subestación Prueba Norte/);
    c = M.cambiarCampo(c, 'textos.intro_p2', 'Texto propio.');
    assert.equal(M.estadoCampo(c, 'textos.intro_p2').fuente, 'manual');
    assert.ok(M.faltantes(c).some((f) => f.ruta === 'textos.intro_p2' && !f.bloquea));
    c = M.cambiarCampo(c, 'textos.intro_p2', '   ');
    assert.ok(M.faltantes(c).some((f) => f.ruta === 'textos.intro_p2' && f.bloquea));
  });
  test('fotos: ponerFoto, registrarArchivo y cuadrículas', () => {
    let c = M.informeVacio();
    c = M.registrarArchivo(c, 'aPrueba0000000000001', { almacen: 'local', mime: 'image/jpeg', ancho: 600, alto: 800, huella: 'ab'.repeat(32) });
    c = M.ponerFoto(c, { seccion: 'alcance', g: 0, f: 1, k: 0 }, 'aPrueba0000000000001');
    assert.equal(c.figuras.alcance[0].figuras[1].fotos[0].archivo, 'aPrueba0000000000001');
    assert.equal(c.archivos.aPrueba0000000000001.ancho, 600);
    assert.throws(() => M.ponerFoto(c, { seccion: 'alcance', g: 0, f: 1, k: 3 }, 'x'));
    assert.throws(() => M.registrarArchivo(c, '../malo', {}));
    c = M.agregarCuadricula(c, 'alcance', '2x2f');
    assert.equal(c.figuras.alcance[1].figuras[0].fotos.length, 4);
    assert.notEqual(c.figuras.alcance[1].id, c.figuras.alcance[0].id);
    c = M.moverCuadricula(c, 'alcance', 1, -1);
    assert.equal(c.figuras.alcance[0].disposicion, '2x2f');
    c = M.quitarCuadricula(c, 'alcance', 0);
    assert.equal(c.figuras.alcance.length, 1);
    c = M.agregarAnexoFicha(c);
    assert.deepEqual(c.anexos.map((a) => a.clave), ['consignacion', 'ficha_actual', 'ficha_nuevo', 'ficha_1', 'calculo']);
  });
});

describe('faltantes', () => {
  test('el informe vacío trae los obligatorios', () => {
    const r = rutasFaltantes(M.informeVacio(), null);
    for (const x of ['portada.contrato', 'config.marca.applus-encabezado', 'salud.numero', 'trabajo.fecha_inicio', 'trabajo.fecha_fin',
      'personal.ingeniero', 'personal.tecnicos', 'equipo.matricula', 'equipo.fabricante', 'equipo.potencia_onan_mva',
      'equipo.potencia_onaf_mva', 'confirmaciones.potencia', 'equipo.grupo_conexion', 'consignacion.numero', 'odt',
      'ventiladores.actual.0.modelo', 'ventiladores.nuevo.0.cfm_unitario', 'corrientes.filas', 'corrientes.nominal.r',
      'tablas.material.0.cantidad', 'figuras.alcance.0.figuras.0.fotos.0.archivo', 'anexos.0.archivo', 'anexos.1.ficha',
      'firmas.elaborado.nombre', 'firmas.aprobado.nombre']) {
      assert.ok(r.includes(x), 'falta en la lista: ' + x);
    }
  });
  test('el informe completo de ejemplo no tiene nada que bloquee', () => {
    const f = M.faltantes(contenidoCompletoEjemplo(), { config: configPrueba() });
    assert.deepEqual(f.filter((x) => x.bloquea), []);
  });
  test('sin los logos de marca no se emite', () => {
    const r = rutasFaltantes(contenidoCompletoEjemplo(), configPrueba({ conLogos: false }));
    assert.equal(r.filter((x) => x.startsWith('config.marca.')).length, 5);
  });
  test('reglas: fechas al revés, ONAN > ONAF, corriente sobre la nominal, foto sin registrar', () => {
    let c = contenidoCompletoEjemplo();
    c = M.cambiarCampo(c, 'trabajo.fecha_fin', '2026-03-01');
    c = M.cambiarCampo(c, 'equipo.potencia_onan_mva', 20);
    c = M.confirmarPotencia(c);
    c = M.cambiarCampo(c, 'corrientes.filas.1.s', 3.1);
    c = M.cambiarCampo(c, 'figuras.alcance.0.figuras.0.fotos.0.archivo', 'aNoRegistrada0000000');
    const f = M.faltantes(c, { config: configPrueba() });
    assert.ok(f.some((x) => x.bloquea && /anterior a la de inicio/.test(x.etiqueta)));
    assert.ok(f.some((x) => x.bloquea && /ONAN no puede ser mayor/.test(x.etiqueta)));
    assert.ok(f.some((x) => !x.bloquea && /supera la nominal/.test(x.etiqueta)));
    assert.ok(f.some((x) => x.bloquea && x.ruta === 'figuras.alcance.0.figuras.0.fotos.0.archivo' && /no está registrada/.test(x.etiqueta)));
  });
  test('cada faltante dice su sección (las del formulario)', () => {
    const validas = ['portada', 's1', 's2_1', 's2_2', 's2_3', 's3', 's4_1', 's4_2', 's4_3', 's4_4', 's4_final', 's5', 'anexos', 'firmas'];
    for (const f of M.faltantes(M.informeVacio())) {
      assert.ok(validas.includes(f.seccion), f.ruta + ' → ' + f.seccion);
      assert.equal(typeof f.etiqueta, 'string');
      assert.equal(typeof f.bloquea, 'boolean');
    }
  });
  test('la numeración de las fotos que faltan es la del papel', () => {
    const f = M.faltantes(M.informeVacio()).filter((x) => /fotos\.\d+\.archivo$/.test(x.ruta));
    assert.equal(f[0].etiqueta, 'Figura 1: falta la foto');
    assert.ok(f.some((x) => x.etiqueta === 'Figura 22: falta la foto'));
    assert.ok(f.some((x) => x.etiqueta === 'Figura 21, foto 4: falta la foto'));
  });
});

describe('identidad, huellas y editores', () => {
  test('jsonCanonico y huella: el orden de las claves no cambia la huella', async () => {
    assert.equal(M.jsonCanonico({ b: 1, a: [2, { d: null, c: 'x' }] }), '{"a":[2,{"c":"x","d":null}],"b":1}');
    const h1 = await M.huellaContenido({ a: 1, b: { c: 2, d: 3 } });
    const h2 = await M.huellaContenido({ b: { d: 3, c: 2 }, a: 1 });
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
    assert.notEqual(h1, await M.huellaContenido({ a: 1, b: { c: 2, d: 4 } }));
  });
  test('esEditor: solo los uid de la configuración', () => {
    const cfg = configPrueba();
    assert.equal(M.esEditor(cfg, 'uid-editor-1'), true);
    assert.equal(M.esEditor(cfg, 'uid-otro'), false);
    assert.equal(M.esEditor(cfg, ''), false);
    assert.equal(M.esEditor(null, 'uid-editor-1'), false);
  });
  test('nuevoId', () => {
    const id = M.nuevoId('a', 20);
    assert.match(id, /^a[A-Za-z0-9]{20}$/);
    assert.notEqual(M.nuevoId(), M.nuevoId());
  });
});

describe('correcciones de la revisión (pies, ajustes, faltantes locales y respaldo)', () => {
  test('pie «Conexión de ventiladores en Delta» (mayúscula como el modelo); el párrafo sigue con «delta»', () => {
    const c = M.informeVacio();
    const pies = c.figuras.montaje.flatMap((g) => g.figuras.map((f) => f.pie));
    assert.ok(pies.includes('Conexión de ventiladores en Delta'), pies.join(' | '));
    const e = M.cambiarCampo(c, 'ventiladores.conexion', 'estrella');
    assert.ok(e.figuras.montaje.flatMap((g) => g.figuras.map((f) => f.pie)).includes('Conexión de ventiladores en Estrella'));
    assert.match(M.textoPlantilla('montaje', c), /en configuración delta,/);
  });

  test('las cuadrículas de la plantilla nacen con el ajuste fino del modelo; una nueva, sin él', () => {
    const c = M.informeVacio();
    assert.deepEqual(c.figuras.alcance[0].ajuste, { alinearV: 'centro', sangriaPie: 35.5, dyPie: 3.1, altoPie: 16.7 });
    assert.deepEqual(c.figuras.ingreso[0].ajuste, { sangriaPie: 35.5, altoPie: 17 });
    assert.equal(c.figuras.condiciones_iniciales[0].ajuste, undefined);
    const n = M.agregarCuadricula(c, 'montaje', '2x1');
    assert.equal(n.figuras.montaje[n.figuras.montaje.length - 1].ajuste, undefined);
    assert.equal(M.ajusteLimpio({ x0: 10, anchosCol: [1, 2] }), null, 'fuera de rango: nada');
  });

  test('modo local: una imagen registrada que ya no está en la memoria cuenta como faltante (no se emite con «Foto pendiente»)', () => {
    const c = contenidoCompletoEjemplo();
    const cfg = configPrueba();
    assert.equal(M.faltantes(c, { config: cfg }).filter((f) => f.bloquea).length, 0);
    const ninguna = M.faltantes(c, { config: cfg, archivoDisponible: () => false }).filter((f) => f.bloquea);
    assert.ok(ninguna.some((f) => /se perdió al recargar/.test(f.etiqueta) && /\.fotos\.\d+\.archivo$/.test(f.ruta)));
    assert.ok(ninguna.some((f) => f.ruta.startsWith('config.marca.')), 'los logos locales también');
    assert.ok(ninguna.some((f) => f.ruta.startsWith('anexos.')), 'y los anexos');
    assert.equal(M.faltantes(c, { config: cfg, archivoDisponible: () => true }).filter((f) => f.bloquea).length, 0);
  });

  test('recuperar un respaldo: aplica SOLO lo mío y respeta lo de la otra persona', () => {
    const base = contenidoCompletoEjemplo();
    const mio = M.cambiarCampo(base, 'equipo.zona', 'ZONA-MIA');
    const actual = M.cambiarCampo(base, 'equipo.grupo_conexion', 'YNd1-OTRA-PERSONA');
    const f = M.fusionarRespaldo(base, mio, actual);
    assert.equal(f.contenido.equipo.zona, 'ZONA-MIA');
    assert.equal(f.contenido.equipo.grupo_conexion, 'YNd1-OTRA-PERSONA', 'el cambio de la otra persona NO se pierde');
    assert.deepEqual(f.choques, []);
  });

  test('recuperar: si las dos cambiaron el MISMO dato es un choque; sin permiso gana lo de la otra persona', () => {
    const base = contenidoCompletoEjemplo();
    const mio = M.cambiarCampo(base, 'equipo.serie', 'SERIE-MIA');
    const actual = M.cambiarCampo(base, 'equipo.serie', 'SERIE-OTRA');
    const f = M.fusionarRespaldo(base, mio, actual);
    assert.deepEqual(f.choques, ['equipo.serie']);
    assert.equal(f.contenido.equipo.serie, 'SERIE-OTRA');
    assert.equal(M.fusionarRespaldo(base, mio, actual, { ganaMio: true }).contenido.equipo.serie, 'SERIE-MIA');
  });

  test('recuperar: filas agregadas en una tabla cuentan como un cambio de la tabla entera', () => {
    const base = contenidoCompletoEjemplo();
    const mio = M.cambiarCampo(base, 'tablas.herramientas', base.tablas.herramientas.concat([{ descripcion: 'MULTÍMETRO PRUEBA', unidad: 'UND', cantidad: 1 }]));
    const f = M.fusionarRespaldo(base, mio, base);
    assert.equal(f.contenido.tablas.herramientas.length, base.tablas.herramientas.length + 1);
    assert.deepEqual(f.aplicadas, ['tablas.herramientas']);
  });

  test('recuperar un respaldo viejo sin base: todo lo distinto es choque y nada se aplica sin permiso', () => {
    const base = contenidoCompletoEjemplo();
    const mio = M.cambiarCampo(base, 'equipo.zona', 'ZONA-MIA');
    const f = M.fusionarRespaldo(null, mio, base);
    assert.ok(f.choques.includes('equipo.zona'));
    assert.equal(f.contenido.equipo.zona, base.equipo.zona);
  });
});

describe('tipo de mantenimiento (2026-10-15): correctivo, preventivo o predictivo', () => {
  test('por defecto CORRECTIVO; al cambiarlo, el título y «actividades …» concuerdan', async () => {
    const M = await import('../assets/js/domain/informe_brigada_modelo.js');
    const P = await import('../assets/js/domain/informe_brigada_plantilla.js');
    assert.deepEqual([...P.CLASES_MANTENIMIENTO], ['CORRECTIVO', 'PREVENTIVO', 'PREDICTIVO']);
    let c = M.informeVacio();
    assert.equal(c.portada.clase, 'CORRECTIVO');
    assert.match(M.textoPlantilla('obj_general', c), /actividades correctivas de mantenimiento menor/);
    assert.match(M.textoPlantilla('alcance', c), /^Se realizaron actividades correctivas de mantenimiento menor/);
    for (const [clase, palabra] of [['PREVENTIVO', 'preventivas'], ['PREDICTIVO', 'predictivas']]) {
      c = M.cambiarCampo(c, 'portada.clase', clase);
      assert.equal(M.variablesDelInforme(c).clase, clase);
      assert.match(M.textoPlantilla('obj_general', c), new RegExp('actividades ' + palabra + ' de mantenimiento menor'));
      assert.match(M.textoPlantilla('alcance', c), new RegExp('^Se realizaron actividades ' + palabra));
    }
  });
});

describe('firmantes por defecto de la configuración (2026-10-16)', () => {
  test('un informe NUEVO llega con Elaborado / Revisado / Aprobado de la configuración; se puede cambiar', async () => {
    const R = await import('../assets/js/domain/informe_brigada_rutas.js');
    const config = R.normalizarConfig({ firmantes: [
      { nombre: 'Ana Prueba', rol: 'elaborado' }, { nombre: 'Beto Ensayo', rol: 'revisado' },
      { nombre: 'Ciro Ficticio', rol: 'aprobado' }, { nombre: 'Dora Simulada', rol: 'otro' }] });
    assert.deepEqual(config.firmantes.map((f) => f.rol), ['elaborado', 'revisado', 'aprobado', '']);
    const c = M.prellenar({ equipo: txPrueba(), config });
    assert.deepEqual(c.firmas.elaborado, { nombre: 'ANA PRUEBA', firmante: 'f-ana-prueba' });
    assert.deepEqual(c.firmas.revisado, { nombre: 'BETO ENSAYO', firmante: 'f-beto-ensayo' });
    assert.deepEqual(c.firmas.aprobado, { nombre: 'CIRO FICTICIO', firmante: 'f-ciro-ficticio' });
    const c2 = M.asignarFirmante(c, 'revisado', null);
    assert.deepEqual(c2.firmas.revisado, { nombre: '', firmante: null });
    const sin = M.prellenar({ equipo: txPrueba(), config: R.normalizarConfig({}) });
    assert.equal((sin.firmas.elaborado || {}).nombre || '', '');
  });
});

