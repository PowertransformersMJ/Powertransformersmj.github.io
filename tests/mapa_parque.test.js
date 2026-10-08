// Mapa geográfico de Colombia · Etapa 1 (2026-10-07): el parque resumido por territorio. SOLO datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DPTO_DANE, DANE_DE_DPTO, normal, bandaDe, coordenadaDe, fichaTx, pasaFiltros, resumenParque, buscarEnMapa,
  ZONA_EXCEPCIONES, zonaDeMunicipio, codigoMunicipio, municipioDeSubestacionMapa,
  codigoSubestacion, etiquetaTx, indiceUbicaciones
} from '../assets/js/domain/mapa_parque.js';

const tx = (o) => ({ id: o.id || 'd' + Math.random().toString(36).slice(2, 7),
  identificacion: { codigo: o.codigo || 'TX', matricula: o.mat || 'T1', tipo_activo: o.tipo || 'POTENCIA', grupo: 'G1' },
  placa: { potencia_kva: o.kva == null ? 20000 : o.kva },
  ubicacion: { subestacionId: o.sid == null ? 'S1' : o.sid, subestacion_nombre: o.sub || 'ALFA', departamento: o.dep || 'bolivar',
    zona: o.zona || 'BOLIVAR', municipio: o.mun || '', latitud: o.lat == null ? '' : o.lat, longitud: o.lng == null ? '' : o.lng },
  salud_actual: o.hi === undefined ? { hi_final: 2 } : { hi_final: o.hi } });

test('códigos DANE de los 5 departamentos de AFINIA, en los dos sentidos', () => {
  assert.equal(DPTO_DANE['23'], 'cordoba');
  assert.equal(DANE_DE_DPTO.magdalena, '47');
  assert.equal(Object.keys(DPTO_DANE).length, 5);
});

test('banda oficial: 1…5 desde hi_final; fuera de rango o vacío → null (no se inventa)', () => {
  assert.equal(bandaDe(tx({ hi: 4 })), 4);
  assert.equal(bandaDe(tx({ hi: '3' })), 3);
  assert.equal(bandaDe(tx({ hi: null })), null);
  assert.equal(bandaDe(tx({ hi: 7 })), null);
  assert.equal(bandaDe({}), null);
  assert.equal(bandaDe(tx({ hi: 1.45 })), 1, 'decimal: se redondea como el Parque');
  assert.equal(bandaDe(tx({ hi: 2.5 })), 3);
});

test('coordenada: vacía, cero o fuera de rango → null; válida → [lat, lng]', () => {
  assert.equal(coordenadaDe(tx({})), null);
  assert.equal(coordenadaDe(tx({ lat: 0, lng: 0 })), null);
  assert.equal(coordenadaDe(tx({ lat: 95, lng: -75 })), null);
  assert.deepEqual(coordenadaDe(tx({ lat: '10.39', lng: '-75.5' })), [10.39, -75.5]);
});

test('ficha: departamento sin tildes, MVA desde kVA, zona en mayúsculas', () => {
  const f = fichaTx(tx({ dep: 'Córdoba', kva: 12500, zona: 'occidente' }));
  assert.equal(f.departamento, 'cordoba');
  assert.equal(f.mva, 12.5);
  assert.equal(f.zona, 'OCCIDENTE');
});

test('resumen: por departamento y zona, con subestaciones distintas y la PEOR banda', () => {
  const r = resumenParque([
    tx({ sid: 'S1', sub: 'ALFA', dep: 'bolivar', hi: 2 }),
    tx({ sid: 'S1', sub: 'ALFA', dep: 'bolivar', hi: 5 }),
    tx({ sid: 'S2', sub: 'BETA', dep: 'cesar', zona: 'ORIENTE', hi: null })
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.porDepartamento.bolivar.transformadores, 2);
  assert.equal(r.porDepartamento.bolivar.subestaciones, 1);
  assert.equal(r.porDepartamento.bolivar.peor, 5);
  assert.equal(r.porDepartamento.cesar.bandas.sin, 1);
  assert.equal(r.porZona.ORIENTE.transformadores, 1);
  assert.deepEqual(r.bandas, { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1, sin: 1 });
  assert.equal(r.subestaciones[0].nombre, 'ALFA', 'la de peor salud primero');
  assert.equal(r.subestaciones[0].tx[0].banda, 5, 'dentro, el de peor salud primero');
});

test('homónimos sin id no se mezclan entre departamentos', () => {
  const r = resumenParque([tx({ sid: '', sub: 'PUEBLO NUEVO', dep: 'bolivar' }), tx({ sid: '', sub: 'PUEBLO NUEVO', dep: 'cordoba' })]);
  assert.equal(r.subestaciones.length, 2);
});

test('ubicadas / sin ubicar: hoy, sin coordenadas, todas sin ubicar', () => {
  const r = resumenParque([tx({ sid: 'S1' }), tx({ sid: 'S2', lat: 10, lng: -75 })]);
  assert.equal(r.ubicadas, 1);
  assert.equal(r.sinUbicar, 1);
});

test('filtros: zona, departamento, banda (incluido «sin dato») y tipo', () => {
  const f = fichaTx(tx({ dep: 'sucre', zona: 'OCCIDENTE', hi: 4, tipo: 'TPT' }));
  assert.equal(pasaFiltros(f, { zona: 'OCCIDENTE' }), true);
  assert.equal(pasaFiltros(f, { departamento: 'cesar' }), false);
  assert.equal(pasaFiltros(f, { banda: '4' }), true);
  assert.equal(pasaFiltros(f, { banda: 'sin' }), false);
  assert.equal(pasaFiltros(f, { tipo: 'POTENCIA' }), false);
  const r = resumenParque([tx({ hi: 4 }), tx({ hi: 1 })], { banda: '4' });
  assert.equal(r.total, 1);
});

test('buscador: municipios primero, luego subestaciones y transformadores; sin tildes', () => {
  const r = resumenParque([tx({ sid: 'S1', sub: 'MONTERIA', mat: 'T1-A/M-MON', codigo: 'X1' })]);
  const mun = [{ cod: '23001', nom: 'MONTERÍA', dpto: '23' }, { cod: '13001', nom: 'CARTAGENA DE INDIAS', dpto: '13' }];
  const res = buscarEnMapa('monter', { municipios: mun, subestaciones: r.subestaciones });
  assert.deepEqual(res.map((x) => x.tipo), ['municipio', 'subestacion']);
  assert.equal(buscarEnMapa('t1-a/m', { municipios: mun, subestaciones: r.subestaciones })[0].tipo, 'transformador');
  assert.deepEqual(buscarEnMapa('m', { municipios: mun, subestaciones: r.subestaciones }), [], 'menos de 2 letras no busca');
});

test('la geografía del sitio: DANE MGN 2025, 33 departamentos y 138 municipios del área AFINIA con su DIVIPOLA', () => {
  const d = JSON.parse(readFileSync(new URL('../assets/geo/colombia-departamentos.topo.json', import.meta.url), 'utf8'));
  const a = JSON.parse(readFileSync(new URL('../assets/geo/afinia-servicio.topo.json', import.meta.url), 'utf8'));
  const r = JSON.parse(readFileSync(new URL('../assets/geo/rotulos.json', import.meta.url), 'utf8'));
  assert.equal(Object.values(d.objects)[0].geometries.length, 33);
  assert.equal(a.objects.mpios.geometries.length, 138);
  assert.deepEqual(a.objects.dptos.geometries.map((g) => g.properties.dpto).sort(), Object.keys(DPTO_DANE).sort());
  assert.ok(a.objects.mpios.geometries.every((g) => /^\d{5}$/.test(g.properties.cod)));
  for (const c of Object.keys(DPTO_DANE)) assert.ok(r.dptos[c], 'rótulo del departamento ' + c);
});

test('sin datos de activos en el repositorio público: la geografía solo trae límites y nombres', () => {
  const a = readFileSync(new URL('../assets/geo/afinia-servicio.topo.json', import.meta.url), 'utf8');
  assert.ok(!/subestaci|matricula|hi_final|latitud/i.test(a));
});

test('zona por municipio: el departamento manda, salvo las excepciones registradas (región de Loba → ORIENTE)', () => {
  assert.equal(zonaDeMunicipio('13001', '13'), 'BOLIVAR');
  assert.equal(zonaDeMunicipio('13667', '13'), 'ORIENTE');
  assert.equal(zonaDeMunicipio('70001', '70'), 'OCCIDENTE');
  assert.equal(zonaDeMunicipio('47245', '47'), 'ORIENTE');
  const a = JSON.parse(readFileSync(new URL('../assets/geo/afinia-servicio.topo.json', import.meta.url), 'utf8'));
  for (const g of a.objects.mpios.geometries) {
    assert.equal(g.properties.zona, zonaDeMunicipio(g.properties.cod, g.properties.dpto), 'la geografía sigue la misma regla: ' + g.properties.cod);
  }
  for (const cod of Object.keys(ZONA_EXCEPCIONES)) assert.ok(a.objects.mpios.geometries.some((g) => g.properties.cod === cod));
});

test('municipio DIVIPOLA desde la tabla oficial, sin adivinar', () => {
  const mun = [{ cod: '13001', nom: 'CARTAGENA DE INDIAS', dpto: '13' }, { cod: '23570', nom: 'PUEBLO NUEVO', dpto: '23' },
    { cod: '20570', nom: 'PUEBLO NUEVO', dpto: '20' }, { cod: '13468', nom: 'SANTA CRUZ DE MOMPOX', dpto: '13' }];
  assert.equal(codigoMunicipio('CARTAGENA', 'bolivar', mun), '13001', 'nombre como palabra inicial del DANE');
  assert.equal(codigoMunicipio('Pueblo Nuevo', 'cordoba', mun), '23570', 'homónimo: decide el departamento registrado');
  assert.equal(codigoMunicipio('Pueblo Nuevo', '', mun), null, 'homónimo sin departamento: no se adivina');
  assert.equal(codigoMunicipio('MOMPOS', 'bolivar', mun), '13468', 'alias conocido');
  assert.equal(codigoMunicipio('NINGUNO', 'bolivar', mun), null);
});

test('municipio de una S/E: manda el código de la matrícula (homónimos en otro departamento), luego el nombre', () => {
  // Tabla oficial (pública en el repo): VAA VALENCIA→VALLEDUPAR · VAC VALENCIA (CORDOBA)→VALENCIA · PLO PUEBLO NUEVO (MAGDALENA)→ARIGUANI.
  const mun = [{ cod: '23855', nom: 'VALENCIA', dpto: '23' }, { cod: '20001', nom: 'VALLEDUPAR', dpto: '20' },
    { cod: '47058', nom: 'ARIGUANÍ', dpto: '47' }, { cod: '23570', nom: 'PUEBLO NUEVO', dpto: '23' }, { cod: '23068', nom: 'AYAPEL', dpto: '23' }];
  const se = (nombre, departamento, ...mats) => ({ nombre, departamento, tx: mats.map((matricula) => ({ matricula })) });
  assert.equal(municipioDeSubestacionMapa(se('VALENCIA', 'cordoba', 'T1-M/M-VAC'), mun), '23855', 'el nombre solo la mandaría a Valledupar');
  assert.equal(municipioDeSubestacionMapa(se('VALENCIA', 'cesar', 'T1-M/M-VAA'), mun), '20001');
  assert.equal(municipioDeSubestacionMapa(se('PUEBLO NUEVO', 'magdalena', 'T1-M/M-PLO'), mun), '47058', 'no el Pueblo Nuevo de Córdoba');
  assert.equal(municipioDeSubestacionMapa(se('VALENCIA', 'cordoba', 'T1-M/M-VAC', 'T2-M/M-VAA'), mun), null, 'matrículas en conflicto: no se adivina');
  assert.equal(municipioDeSubestacionMapa(se('AYAPEL', 'cordoba', 'T1-M/M-AYAR'), mun), '23068', 'código fuera de la tabla: decide el nombre');
  assert.equal(municipioDeSubestacionMapa(se('LA SALVACION', 'cesar', 'T1-M/M-SLV'), mun), null, 'ni código ni nombre en la tabla');
});

/** Decodifica un polígono de TopoJSON cuantizado → anillos [lng, lat]. */
function anillos(topo, geom) {
  const { scale, translate } = topo.transform;
  const arco = (i) => {
    const a = topo.arcs[i < 0 ? ~i : i];
    let x = 0, y = 0;
    const pts = a.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
    return i < 0 ? pts.reverse() : pts;
  };
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  return polys.flatMap((p) => p.map((ring) => ring.flatMap(arco)));
}
function dentro([lat, lng], rings) {
  let n = 0;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) n++;
    }
  }
  return n % 2 === 1;
}

test('rótulos de los 5 departamentos de AFINIA caen DENTRO de su área de servicio (no en un municipio ajeno)', () => {
  const a = JSON.parse(readFileSync(new URL('../assets/geo/afinia-servicio.topo.json', import.meta.url), 'utf8'));
  const r = JSON.parse(readFileSync(new URL('../assets/geo/rotulos.json', import.meta.url), 'utf8'));
  for (const g of a.objects.dptos.geometries) {
    assert.ok(dentro(r.dptos[g.properties.dpto], anillos(a, g)), 'rótulo del departamento ' + g.properties.dpto);
  }
  const mp = a.objects.mpios.geometries.find((g) => g.properties.cod === '13001');
  assert.ok(dentro(r.mpios['13001'], anillos(a, mp)), 'rótulo de Cartagena dentro de Cartagena');
});

test('código de la S/E en la matrícula (la llave de /subestaciones) y rótulo corto del transformador', () => {
  assert.equal(codigoSubestacion('T1-M/M-VAC'), 'VAC');
  assert.equal(codigoSubestacion('T-KDR04'), 'KDR');
  assert.equal(codigoSubestacion('T1A-A/M-NMON'), 'NMON');
  assert.equal(codigoSubestacion('t2-m/m-plo'), 'PLO', 'minúsculas');
  assert.equal(codigoSubestacion(''), '');
  assert.equal(etiquetaTx('T1-M/M-VAC'), 'T1');
  assert.equal(etiquetaTx('T1A-A/M-NMON'), 'T1A');
  assert.equal(etiquetaTx('T-KDR04'), 'KDR04', 'sin número tras la T: la última parte');
  assert.equal(etiquetaTx('T3A/M-TER'), 'T3A', 'matrícula real sin guion tras la A');
  assert.equal(etiquetaTx(''), '');
});

test('posiciones de /subestaciones: solo coordenadas válidas dentro de Colombia y de S/E activas', () => {
  const fuente = { latitud: 8.2597, longitud: -76.1329, confianza: 'alta', verificacion: 'cae en Valencia (DANE)' };
  const idx = indiceUbicaciones([
    { id: 'VAC', latitud: 8.2597, longitud: -76.1329, nombre: 'VALENCIA', departamento: 'cordoba', ubicacion_fuente: fuente },
    { id: 'vaa', latitud: '10.2888', longitud: '-73.3992' },            // texto numérico y id en minúsculas
    { id: 'MAL', latitud: 40.4, longitud: -3.7 },                       // fuera de Colombia (Madrid)
    { id: 'CER', latitud: 0, longitud: 0 },                             // golfo de Guinea
    { id: 'VAC2', latitud: '', longitud: '' },                          // sin posición
    { id: 'NUL', latitud: null, longitud: -75 },
    { id: 'INA', latitud: 9, longitud: -75, activa: false },            // inactiva
    { latitud: 9, longitud: -75 }                                       // sin id
  ]);
  assert.deepEqual([...idx.keys()], ['VAC', 'VAA']);
  assert.deepEqual(idx.get('VAC').coordenada, [8.2597, -76.1329]);
  assert.equal(idx.get('VAC').confianza, 'alta');
  assert.equal(idx.get('VAC').editadaAMano, false);
  assert.deepEqual(indiceUbicaciones(null), new Map());
});

test('procedencia: si la posición se editó a mano, ya no se presume su confianza; los alias no le quitan la llave a un id', () => {
  const idx = indiceUbicaciones([
    { id: 'KDR', latitud: 10.36, longitud: -75.49, nombre: 'CANDELARIA', departamento: 'bolivar', codigos_alias: ['CDR', 'VAC'],
      ubicacion_fuente: { latitud: 10.358838, longitud: -75.485424, confianza: 'alta', verificacion: 'x' } },
    { id: 'VAC', latitud: 8.26, longitud: -76.13, nombre: 'VALENCIA', departamento: 'cordoba' }
  ]);
  assert.equal(idx.get('KDR').editadaAMano, true, 'la raíz ya no es la coordenada que respalda la fuente');
  assert.equal(idx.get('KDR').confianza, '');
  assert.equal(idx.get('CDR'), idx.get('KDR'), 'alias de la tabla de Fichas');
  assert.equal(idx.get('VAC').nombre, 'VALENCIA', 'un alias no pisa un id');
});

test('doble llave: el código Y el nombre + departamento registrados; si no casan, sin punto y «por revisar»', () => {
  const idx = indiceUbicaciones([{ id: 'VAC', latitud: 8.26, longitud: -76.13, nombre: 'VALENCIA', departamento: 'cordoba' }]);
  const r = resumenParque([
    tx({ sid: '', sub: 'VALENCIA', dep: 'cordoba', mat: 'T1-M/M-VAC' }),
    tx({ sid: '', sub: 'OTRA', dep: 'cordoba', mat: 'T1-M/M-VAC' })        // equipo trasladado sin cambiar su matrícula
  ], {}, idx);
  const por = (n) => r.subestaciones.find((s) => s.nombre === n);
  assert.deepEqual(por('VALENCIA').coordenada, [8.26, -76.13]);
  assert.equal(por('OTRA').coordenada, null);
  assert.match(por('OTRA').porRevisar, /VAC/);
  assert.equal(r.ubicadas, 1);
  // sin matrícula (Inventario la puede vaciar), el código del equipo hace de matrícula
  const sinMat = resumenParque([{ id: 'x', codigo: 'T1-M/M-VAC', identificacion: { codigo: 'T1-M/M-VAC', matricula: '' },
    ubicacion: { subestacion_nombre: 'VALENCIA', departamento: 'cordoba' } }], {}, idx);
  assert.equal(sinMat.ubicadas, 1);
});

test('resumen con posiciones: la S/E toma la de su código; homónimos con su propia posición; matrículas en conflicto → sin punto', () => {
  const idx = indiceUbicaciones([{ id: 'VAC', latitud: 8.26, longitud: -76.13, nombre: 'VALENCIA', departamento: 'cordoba' },
    { id: 'VAA', latitud: 10.29, longitud: -73.4, nombre: 'VALENCIA', departamento: 'cesar' }]);
  const r = resumenParque([
    tx({ sid: '', sub: 'VALENCIA', dep: 'cordoba', zona: 'OCCIDENTE', mat: 'T1-M/M-VAC' }),
    tx({ sid: '', sub: 'VALENCIA', dep: 'cesar', zona: 'ORIENTE', mat: 'T1-M/M-VAA' }),
    tx({ sid: '', sub: 'MIXTA', dep: 'sucre', zona: 'OCCIDENTE', mat: 'T1-M/M-VAC' }),
    tx({ sid: '', sub: 'MIXTA', dep: 'sucre', zona: 'OCCIDENTE', mat: 'T2-M/M-VAA' }),
    tx({ sid: '', sub: 'SIN DOC', dep: 'bolivar', mat: 'T1-M/M-ZZZ' })
  ], {}, idx);
  const por = (n, d) => r.subestaciones.find((s) => s.nombre === n && s.departamento === d);
  assert.deepEqual(por('VALENCIA', 'cordoba').coordenada, [8.26, -76.13]);
  assert.deepEqual(por('VALENCIA', 'cesar').coordenada, [10.29, -73.4]);
  assert.equal(por('VALENCIA', 'cordoba').codigo, 'VAC');
  assert.equal(por('MIXTA', 'sucre').codigo, '', 'dos códigos en la misma S/E: no se adivina');
  assert.equal(por('MIXTA', 'sucre').coordenada, null);
  assert.equal(por('SIN DOC', 'bolivar').coordenada, null);
  assert.equal(r.ubicadas, 2);
  assert.equal(r.sinUbicar, 2);
  assert.equal(por('VALENCIA', 'cordoba').tx[0].etiqueta, 'T1');
  // sin índice: igual que antes (la del equipo, si la trae)
  assert.equal(resumenParque([tx({ sid: '', mat: 'T1-M/M-VAC' })]).ubicadas, 0);
});

test('revisión adversarial: id automático de la página admin, códigos repetidos, coordenada suelta de un equipo y filtros', () => {
  // La página admin crea con id automático: manda el campo `codigo`.
  const auto = indiceUbicaciones([{ id: 'q8ZtR2mK1vLx', codigo: 'MON', nombre: 'MONTERIA', departamento: 'cordoba', latitud: 8.76, longitud: -75.87 }]);
  assert.ok(auto.has('MON'));
  assert.equal(auto.get('Q8ZTR2MK1VLX'), auto.get('MON'), 'el id queda como alias');
  // Dos documentos con el mismo código: no se elige uno a ciegas.
  const dobles = indiceUbicaciones([{ id: 'a', codigo: 'ABC', latitud: 9, longitud: -75 }, { id: 'b', codigo: 'ABC', latitud: 9.5, longitud: -75 }]);
  assert.equal(dobles.has('ABC'), false);
  // Con índice, la coordenada suelta de un equipo (aquí, en Madrid) no hace punto ni cuenta como validada.
  const idx = indiceUbicaciones([{ id: 'VAC', latitud: 8.26, longitud: -76.13, nombre: 'VALENCIA', departamento: 'cordoba' }]);
  const r = resumenParque([
    tx({ sid: '', sub: 'OTRA', dep: 'cordoba', mat: 'T1-M/M-XYZ', lat: 40.4, lng: -3.7 }),
    tx({ sid: '', sub: 'VALENCIA', dep: 'cordoba', mat: 'T1-M/M-VAC' })
  ], {}, idx);
  assert.equal(r.subestaciones.find((s) => s.nombre === 'OTRA').coordenada, null);
  assert.equal(r.ubicadas, 1);
  // El código de la S/E sale de TODOS sus equipos: filtrar por salud no le cambia el punto.
  const idx2 = indiceUbicaciones([{ id: 'ABC', latitud: 9, longitud: -75, nombre: 'X', departamento: 'bolivar' }]);
  const parque = [tx({ sid: '', sub: 'X', dep: 'bolivar', mat: 'T1-M/M-ABC', hi: 5 }), tx({ sid: '', sub: 'X', dep: 'bolivar', mat: 'T2-M/M-ABD', hi: 1 })];
  assert.equal(resumenParque(parque, {}, idx2).subestaciones[0].coordenada, null, 'matrículas en conflicto');
  assert.equal(resumenParque(parque, { banda: '5' }, idx2).subestaciones[0].coordenada, null, 'el filtro no resuelve el conflicto');
});


test('salud oficial: varias bandas a la vez (1…5 y «sin dato»); la banda suelta de antes sigue valiendo', () => {
  const p = [tx({ id: 'a', hi: 1 }), tx({ id: 'b', hi: 4 }), tx({ id: 'c', hi: 5 }), tx({ id: 'd', hi: null })];
  assert.equal(resumenParque(p, { bandas: ['4', '5'] }).total, 2);
  assert.equal(resumenParque(p, { bandas: ['1', 'sin'] }).total, 2);
  assert.equal(resumenParque(p, { bandas: [] }).total, 4, 'ninguna marcada = todas');
  assert.equal(resumenParque(p, { banda: '4' }).total, 1);
});

test('Cargabilidad SCADA: la cifra del mes por equipo, filtro por CRG (varias), «sin medición» y solo firmes', () => {
  const p = [tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c' }), tx({ id: 'd' })];
  const cargas = new Map([
    ['a', { pct: 95.2, crg: 5, clase: 'firme' }],
    ['b', { pct: 70, crg: 3, clase: 'provisional' }],
    ['c', { pct: null, crg: null, clase: 'nulo', motivo: 'sin homologación' }]
  ]);                                                  // «d» no está: sin medición
  const r = resumenParque(p, {}, null, cargas);
  const f = (id) => r.subestaciones[0].tx.find((x) => x.id === id);
  assert.equal(f('a').crg, 5); assert.equal(f('a').cargaClase, 'firme'); assert.equal(f('a').cargaPct, 95.2);
  assert.equal(f('b').cargaClase, 'provisional');
  assert.equal(f('c').crg, null); assert.equal(f('c').cargaMotivo, 'sin homologación');
  assert.equal(f('d').crg, null); assert.equal(f('d').cargaClase, 'nulo');
  assert.deepEqual(r.crgs, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1, sin: 2 });
  assert.equal(resumenParque(p, { crgs: ['5', '3'] }, null, cargas).total, 2);
  assert.equal(resumenParque(p, { crgs: ['sin'] }, null, cargas).total, 2);
  assert.equal(resumenParque(p, { soloFirmes: true }, null, cargas).total, 1);
  assert.equal(resumenParque(p, { crgs: ['3'], soloFirmes: true }, null, cargas).total, 0, 'la de CRG 3 es provisional');
  // un porcentaje sin calificación válida no inventa CRG
  assert.equal(resumenParque([tx({ id: 'x' })], {}, null, new Map([['x', { pct: 50, crg: 9 }]])).subestaciones[0].tx[0].crg, null);
});
