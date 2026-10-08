// Mapa geográfico de Colombia · Etapa 1 (2026-10-07): el parque resumido por territorio. SOLO datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DPTO_DANE, DANE_DE_DPTO, normal, bandaDe, coordenadaDe, fichaTx, pasaFiltros, resumenParque, buscarEnMapa,
  ZONA_EXCEPCIONES, zonaDeMunicipio, codigoMunicipio, municipioDeSubestacionMapa
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
