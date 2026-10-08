// Editar un transformador desde admin/inventario.html NO borra lo que el
// formulario no muestra (ADR-154).
//
// El formulario arma solo ~20 casillas. Antes, `actualizar` escribía el
// documento ENTERO que el sanitizador reconstruye con esas casillas, y en
// Firestore una sección escrita completa REEMPLAZA a la guardada: la primera
// edición dejaba la matrícula vacía, la condición de salud en blanco, el año
// de fabricación en null… en los 208 equipos (simulado sobre producción, solo
// lectura, 2026-10-08). Ahora se escribe CAMPO POR CAMPO solo lo que cambió.
//
// `aplicarUpdate` reproduce la regla de `updateDoc`: una clave con punto
// ('placa.marca') toca solo ese campo; una clave sin punto reemplaza el valor
// entero. Que Firestore se comporta así lo prueba contra el emulador
// `tests-rules/inventario_edicion.rules.test.js`.
//
// Datos 100 % SINTÉTICOS (ningún equipo real).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  valoresFormulario, entradaDesdeFormulario, parcheEdicionInventario
} from '../assets/js/domain/inventario_edicion.js';

const clonar = (o) => JSON.parse(JSON.stringify(o));
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);

function aplicarUpdate(docPrevio, data) {
  const d = clonar(docPrevio);
  for (const [clave, valor] of Object.entries(data)) {
    const partes = clave.split('.');
    let nodo = d;
    for (const p of partes.slice(0, -1)) {
      if (nodo[p] == null || typeof nodo[p] !== 'object') nodo[p] = {};
      nodo = nodo[p];
    }
    nodo[partes[partes.length - 1]] = valor;
  }
  return d;
}

// Equipo sintético con TODAS las secciones llenas, como lo deja el importador.
function equipoSintetico() {
  return {
    id: 'tx-sintetico-01',
    schema_version: 2,
    estado_servicio: 'operativo',
    estados_especiales: ['operacion_temporal_controlada'],
    identificacion: {
      codigo: 'TX-PRUEBA-01', matricula: 'T9-M/M-ZZZ', nombre: 'Equipo de prueba',
      tipo_activo: 'POTENCIA', uucc: 'N4T1', grupo: 'G2', origen_extra: 'lo-puso-otro-modulo'
    },
    placa: {
      marca: 'MARCA-X', modelo: 'MOD-1', serial: 'SER-0001', norma_fabricacion: 'IEC 60076',
      numero_fabrica: 'NF-77', potencia_kva: 25000, potencia_onan_kva: 20000,
      potencia_onaf_kva: 25000, potencia_ofaf_kva: null
    },
    ubicacion: {
      departamento: 'bolivar', municipio: 'Municipio Ficticio', zona: 'BOLIVAR',
      subestacionId: 'SE-ZZZ', subestacion_nombre: 'S/E Ficticia', direccion: 'Km 0',
      latitud: 10.1, longitud: -75.2
    },
    electrico: {
      tension_primaria_kv: 66, tension_secundaria_kv: 13.8, tension_terciaria_kv: null,
      corriente_nominal_primaria_a: 218.7, corriente_nominal_secundaria_a: 1045.9,
      corriente_nominal_terciaria_a: null, corriente_medida_primaria_a: 150,
      corriente_medida_secundaria_a: 700, corriente_medida_terciaria_a: null,
      fases: 3, grupo_conexion: 'Dyn1', impedancia_cc_pct: 8.5,
      tap_cambiador: 'OLTC-X', tap_actual: 9, tipo_tap: 'OLTC'
    },
    mecanico: { peso_total_kg: 42000, peso_aceite_kg: 9000, volumen_aceite_l: 10200, tipo_tanque: 'Conservador', bushings_tipo: 'OIP' },
    refrigeracion: { tipo_refrigeracion: 'ONAF', cantidad_radiadores: 8, cantidad_ventiladores: 6, cantidad_bombas: 0 },
    protecciones: {
      'relé_diferencial': true, rele_sobrecorriente: true, rele_buchholz: true,
      dps_instalado: true, telecontrol_scada: true, scada_operativo: false, observaciones_pyt: 'ok'
    },
    fabricacion: { ano_fabricacion: 1998, fecha_fabricacion: '1998-04-01', pais_fabricacion: 'Ficticia' },
    servicio: {
      fecha_instalacion: '1999-01-15', fecha_energizacion: '1999-02-01', horas_operacion: 200000,
      observaciones: 'nota previa', usuarios_aguas_abajo: 12000
    },
    salud_actual: {
      ts_calculo: '2026-09-08T00:00:00.000Z', calif_tdgc: 2, calif_co: 1, calif_co2: 1, calif_c2h2: 1,
      eval_dga: 1.4, calif_rd: 2, calif_ic: 2, eval_adfq: 2, calif_fur: 3, dp_estimado: 450,
      vida_utilizada_pct: 60, vida_remanente_pct: 40, calif_crg: 2, crg_pct_medido: 71,
      calif_edad: 4, edad_anos: 28, calif_her: 2, ubicacion_fuga_dominante: '', calif_pyt: 2,
      hi_bruto: 2.3, hi_final: 3.1, bucket: 'pobre', hi_recalculado: 2.3, bucket_recalculado: 'bueno',
      condicion_fuente: 'excel', overrides_aplicados: ['_importacion_v2'], fin_vida_util_papel: false
    },
    criticidad: { usuarios_aguas_abajo: 12000, nivel: '', ts_calculo: '' },
    restricciones_operativas: null,
    repuesto: { estado: 'N/A', serial_repuesto: null, notas: '' },
    ultima_dga: { H2: 10, CH4: 5, C2H4: 1, C2H6: 2, C2H2: 0, CO: 300, CO2: 2500 },
    // Proyección v1 en la raíz (la escribe cada alta/importación).
    codigo: 'TX-PRUEBA-01', nombre: 'Equipo de prueba', departamento: 'bolivar',
    municipio: 'Municipio Ficticio', subestacion: 'S/E Ficticia', potencia_kva: 25000,
    tension_primaria_kv: 66, tension_secundaria_kv: 13.8, marca: 'MARCA-X', modelo: 'MOD-1',
    serial: 'SER-0001', fecha_fabricacion: '1998-04-01', fecha_instalacion: '1999-01-15',
    estado: 'operativo', latitud: 10.1, longitud: -75.2, observaciones: 'nota previa', re: 'N/A'
  };
}

// Lo que hace la página: llena el formulario con el equipo (fillForm), toma la
// foto de cómo quedó (inicial), el usuario cambia casillas y se lee (actual).
function editar(prev, cambios) {
  const inicial = entradaDesdeFormulario(valoresFormulario(prev));
  const actual = entradaDesdeFormulario({ ...valoresFormulario(prev), ...cambios });
  return parcheEdicionInventario(inicial, actual);
}

describe('inventario — editar no borra lo que el formulario no muestra (ADR-154)', () => {
  test('abrir y guardar sin tocar nada NO escribe nada', () => {
    const r = editar(equipoSintetico(), {});
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.parche, {});
    assert.equal(r.cambios, 0);
  });

  test('cambiar solo la marca escribe la marca (sección y raíz) y nada más', () => {
    const prev = equipoSintetico();
    const r = editar(prev, { marca: 'MARCA-NUEVA' });
    assert.deepEqual(Object.keys(r.parche).sort(), ['marca', 'placa.marca']);
    const despues = aplicarUpdate(prev, r.parche);
    assert.equal(despues.placa.marca, 'MARCA-NUEVA');
    assert.equal(despues.marca, 'MARCA-NUEVA');
    // Lo que el formulario NO muestra sigue intacto:
    assert.equal(despues.identificacion.matricula, 'T9-M/M-ZZZ');
    assert.equal(despues.ubicacion.subestacionId, 'SE-ZZZ');
    assert.deepEqual(despues.salud_actual, prev.salud_actual);
    assert.equal(despues.fabricacion.ano_fabricacion, 1998);
    assert.deepEqual(despues.electrico, prev.electrico);
    assert.deepEqual(despues.criticidad, prev.criticidad);
    assert.deepEqual(despues.estados_especiales, prev.estados_especiales);
    assert.equal(despues.identificacion.origen_extra, 'lo-puso-otro-modulo');
    // Y todo lo demás, idéntico salvo la marca:
    const esperado = clonar(prev); esperado.placa.marca = 'MARCA-NUEVA'; esperado.marca = 'MARCA-NUEVA';
    assert.deepEqual(despues, esperado);
  });

  test('cada casilla del formulario, si se cambia, se guarda en su sección y en la raíz', () => {
    const casos = [
      ['codigo', 'tx-prueba-02', 'identificacion.codigo', 'TX-PRUEBA-02', 'codigo'],
      ['nombre', 'Otro nombre', 'identificacion.nombre', 'Otro nombre', 'nombre'],
      ['estado', 'mantenimiento', 'estado_servicio', 'mantenimiento', 'estado'],
      ['tipo_activo', 'RESPALDO', 'identificacion.tipo_activo', 'RESPALDO', null],
      ['uucc', 'N5T10', 'identificacion.uucc', 'N5T10', null],
      ['grupo', 'G3', 'identificacion.grupo', 'G3', null],
      ['departamento', 'cesar', 'ubicacion.departamento', 'cesar', 'departamento'],
      ['zona', 'ORIENTE', 'ubicacion.zona', 'ORIENTE', null],
      ['municipio', 'Otro municipio', 'ubicacion.municipio', 'Otro municipio', 'municipio'],
      ['subestacion', 'S/E Otra', 'ubicacion.subestacion_nombre', 'S/E Otra', 'subestacion'],
      ['latitud', '9.5', 'ubicacion.latitud', 9.5, 'latitud'],
      ['longitud', '-74.9', 'ubicacion.longitud', -74.9, 'longitud'],
      ['potencia_kva', '40000', 'placa.potencia_kva', 40000, 'potencia_kva'],
      ['tension_primaria_kv', '110', 'electrico.tension_primaria_kv', 110, 'tension_primaria_kv'],
      ['tension_secundaria_kv', '34.5', 'electrico.tension_secundaria_kv', 34.5, 'tension_secundaria_kv'],
      ['marca', 'M2', 'placa.marca', 'M2', 'marca'],
      ['modelo', 'MOD-2', 'placa.modelo', 'MOD-2', 'modelo'],
      ['serial', 'SER-2', 'placa.serial', 'SER-2', 'serial'],
      ['fecha_fabricacion', '1997-01-01', 'fabricacion.fecha_fabricacion', '1997-01-01', 'fecha_fabricacion'],
      ['fecha_instalacion', '2000-01-01', 'servicio.fecha_instalacion', '2000-01-01', 'fecha_instalacion'],
      ['observaciones', 'nota nueva', 'servicio.observaciones', 'nota nueva', 'observaciones']
    ];
    // Cada casilla del formulario tiene su caso (si alguien agrega una y no la
    // cubre aquí, esta prueba lo dice).
    assert.deepEqual(casos.map((c) => c[0]).sort(), Object.keys(valoresFormulario(equipoSintetico())).sort());
    for (const [casilla, nuevo, ruta, guardado, raiz] of casos) {
      const prev = equipoSintetico();
      const r = editar(prev, { [casilla]: nuevo });
      assert.deepEqual(r.errores, [], casilla);
      // Se escribe esa casilla (sección + su copia en la raíz) y NADA más.
      assert.deepEqual(Object.keys(r.parche).sort(), [ruta, raiz].filter(Boolean).sort(), casilla);
      const despues = aplicarUpdate(prev, r.parche);
      assert.deepEqual(leer(despues, ruta), guardado, `${casilla} → ${ruta}`);
      if (raiz) assert.deepEqual(despues[raiz], guardado, `${casilla} → raíz ${raiz}`);
      assert.equal(despues.identificacion.matricula, 'T9-M/M-ZZZ', casilla);
      assert.deepEqual(despues.salud_actual, prev.salud_actual, casilla);
    }
  });

  test('borrar a propósito una casilla SÍ se guarda (vacío)', () => {
    const prev = equipoSintetico();
    const r = editar(prev, { observaciones: '' });
    const despues = aplicarUpdate(prev, r.parche);
    assert.equal(despues.servicio.observaciones, '');
    assert.equal(despues.observaciones, '');
    assert.equal(despues.identificacion.matricula, 'T9-M/M-ZZZ');
  });

  test('un valor guardado que el filtro no acepta y nadie tocó se conserva (UUCC fuera de catálogo)', () => {
    const prev = equipoSintetico();
    prev.identificacion.uucc = 'N9T99';
    const r = editar(prev, { marca: 'M3' });
    const despues = aplicarUpdate(prev, r.parche);
    assert.equal(despues.identificacion.uucc, 'N9T99');
  });

  test('una casilla que el navegador deja vacía al abrir (fecha en otro formato) no borra lo guardado', () => {
    const prev = equipoSintetico();
    prev.fabricacion.fecha_fabricacion = '01/04/1998';
    prev.fecha_fabricacion = '01/04/1998';
    // El <input type="date"> no acepta ese formato: al abrir queda vacío, y la
    // foto inicial se toma de lo que QUEDÓ en pantalla, no del documento.
    const pantalla = { ...valoresFormulario(prev), fecha_fabricacion: '' };
    const inicial = entradaDesdeFormulario(pantalla);
    const actual = entradaDesdeFormulario({ ...pantalla, marca: 'M4' });
    const despues = aplicarUpdate(prev, parcheEdicionInventario(inicial, actual).parche);
    assert.equal(despues.fabricacion.fecha_fabricacion, '01/04/1998');
    assert.equal(despues.placa.marca, 'M4');
  });

  test('un equipo «fallado» se muestra como fallado, no como «retirado»', () => {
    const prev = equipoSintetico();
    prev.estado_servicio = 'fallado';
    prev.estado = 'retirado';   // la proyección v1 no conoce «fallado»
    assert.equal(valoresFormulario(prev).estado, 'fallado');
    const r = editar(prev, {});
    assert.deepEqual(r.parche, {});
  });

  test('las validaciones siguen saliendo (código vacío)', () => {
    const r = editar(equipoSintetico(), { codigo: '' });
    assert.ok(r.errores.some((e) => /codigo/.test(e)));
  });

  test('el diff para la bitácora trae antes y después de cada campo cambiado', () => {
    const r = editar(equipoSintetico(), { marca: 'M5', potencia_kva: '30000' });
    assert.deepEqual(r.diff, {
      'placa.marca': { antes: 'MARCA-X', despues: 'M5' },
      'placa.potencia_kva': { antes: 25000, despues: 30000 }
    });
    assert.equal(r.cambios, 2);
  });

  test('entradaDesdeFormulario conserva la forma de siempre (alta de un equipo nuevo)', () => {
    const e = entradaDesdeFormulario(valoresFormulario(equipoSintetico()));
    assert.equal(e.estado, e.estado_servicio);
    assert.equal(e.identificacion.codigo, e.codigo);
    assert.equal(e.ubicacion.subestacion_nombre, e.subestacion);
    assert.deepEqual(Object.keys(e.identificacion).sort(), ['codigo', 'grupo', 'nombre', 'tipo_activo', 'uucc']);
    assert.deepEqual(Object.keys(e.ubicacion).sort(),
      ['departamento', 'latitud', 'longitud', 'municipio', 'subestacion_nombre', 'zona']);
  });
});
