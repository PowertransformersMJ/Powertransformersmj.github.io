// node --test tests/cargabilidad_filtros.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFiltros, listarUnicos, filtrosVacios, normalizarZonas } from '../assets/js/domain/cargabilidad_filtros.js';

// Helper para construir un trafo con cmax y devanados
function tx(id, sub, zona, dep, grupo, cmax, extra = {}) {
  return {
    id, sub, zona, dep, grupo, cmax,
    P: { pct: cmax,  car: 100, amp: 100, l1: 100, l2: 110 },
    S: { pct: null,  car: null, amp: null, l1: null, l2: null },
    T: { pct: null,  car: null, amp: null, l1: null, l2: null },
    ...extra,
  };
}

const DATA = [
  tx('T1', 'AGUAS BLANCAS', 'ORIENTE',  'CESAR',     'G1', 55),  // ok
  tx('T2', 'ALGARROBO',     'ORIENTE',  'MAGDALENA', 'G1', 92),  // avi
  tx('T3', 'ANIMAS BAJAS',  'BOLIVAR',  'BOLIVAR',   'G1', 97),  // ale
  tx('T4', 'CALAMAR',       'BOLIVAR',  'BOLIVAR',   'G2', 120), // cri
  tx('T5', 'SANTA MARTA',   'OCCIDENTE','MAGDALENA', 'G3', null), // nd
];

test('filtrosVacios devuelve estructura completa con 4 severidades activas', () => {
  const f = filtrosVacios();
  assert.equal(f.q, '');
  // La zona pasó de una a VARIAS (2026-09-09). Vacío = TODAS, no ninguna:
  // es lo contrario del criterio de las severidades, que arrancan las cuatro
  // marcadas — y por eso conviene que la prueba lo diga en voz alta.
  assert.ok(f.zona instanceof Set);
  assert.equal(f.zona.size, 0);
  assert.equal(f.dep, '');
  assert.equal(f.grupo, '');
  assert.equal(f.dev, 'all');
  assert.equal(f.sev.size, 4);
  assert.ok(f.sev.has('cri'));
  assert.ok(f.sev.has('ale'));
  assert.ok(f.sev.has('avi'));
  assert.ok(f.sev.has('ok'));
});

// 🔒 Cada llamada tiene que devolver Sets NUEVOS. `store.toggleZona` y
// `store.toggleSev` mutan el Set EN SITIO, y `resetFiltros()` confía en recibir
// uno virgen: si `filtrosVacios()` devolviera siempre la misma instancia, el
// botón «Limpiar» dejaría el filtro tal como estaba. Sin esta prueba, hoistear
// el Set a constante de módulo pasaba la suite entera en verde.
test('filtrosVacios devuelve Sets nuevos en cada llamada', () => {
  const a = filtrosVacios();
  const b = filtrosVacios();
  assert.notEqual(a.zona, b.zona, 'de esto depende que «Limpiar» limpie la zona');
  assert.notEqual(a.sev,  b.sev,  'y que devuelva las cuatro severidades');
  a.zona.add('BOLIVAR');
  a.sev.delete('cri');
  const c = filtrosVacios();
  assert.equal(c.zona.size, 0, 'mutar un resultado no puede contaminar el siguiente');
  assert.equal(c.sev.size, 4);
});

test('aplicarFiltros sin filtros devuelve todos (incluyendo nd bajo ok)', () => {
  const out = aplicarFiltros(DATA, filtrosVacios());
  assert.equal(out.length, 5);
});

test('aplicarFiltros con zona devuelve solo coincidencias', () => {
  const f = { ...filtrosVacios(), zona: new Set(['BOLIVAR']) };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T3', 'T4']);
});

// ── Zona múltiple ──────────────────────────────────────────────
// Encargo del Ingeniero: poder ver dos o tres zonas a la vez sin renunciar a
// las demás columnas del filtro.

test('aplicarFiltros con VARIAS zonas devuelve la unión', () => {
  const f = { ...filtrosVacios(), zona: new Set(['BOLIVAR', 'OCCIDENTE']) };
  const out = aplicarFiltros(DATA, f);
  assert.deepEqual(out.map(d => d.id).sort(), ['T3', 'T4', 'T5']);
});

// 🔒 EL INVARIANTE que más caro sale equivocar: un Set vacío significa «sin
// acotar». Si se leyera como «ninguna zona», el tablero mostraría cero equipos
// al abrirlo y parecería que el parque está vacío.
test('sin zonas marcadas se ven TODAS, no ninguna', () => {
  assert.equal(aplicarFiltros(DATA, { ...filtrosVacios(), zona: new Set() }).length, 5);
  assert.equal(aplicarFiltros(DATA, { ...filtrosVacios(), zona: [] }).length, 5);
  assert.equal(aplicarFiltros(DATA, { ...filtrosVacios(), zona: '' }).length, 5);
});

// Compatibilidad: cualquier llamada antigua pasaba una cadena. Si dejara de
// entenderse, filtraría de más EN SILENCIO — el peor modo de fallo posible.
test('una zona en cadena sigue funcionando', () => {
  const out = aplicarFiltros(DATA, { ...filtrosVacios(), zona: 'BOLIVAR' });
  assert.deepEqual(out.map(d => d.id).sort(), ['T3', 'T4']);
  assert.deepEqual(
    aplicarFiltros(DATA, { ...filtrosVacios(), zona: ['BOLIVAR', 'ORIENTE'] }).map(d => d.id).sort(),
    ['T1', 'T2', 'T3', 'T4']);
});

test('normalizarZonas acepta las cuatro formas y no inventa zonas', () => {
  assert.equal(normalizarZonas(new Set(['A'])).size, 1);
  assert.equal(normalizarZonas(['A', 'B']).size, 2);
  assert.equal(normalizarZonas('A').size, 1);
  assert.equal(normalizarZonas('').size, 0);
  assert.equal(normalizarZonas(null).size, 0);
  assert.equal(normalizarZonas(undefined).size, 0);
  assert.equal(normalizarZonas(['A', '', null]).size, 1, 'los huecos no cuentan como zona');
});

test('la zona se combina con los demás filtros, no los reemplaza', () => {
  const f = { ...filtrosVacios(), zona: new Set(['BOLIVAR', 'OCCIDENTE']), grupo: 'G1' };
  const out = aplicarFiltros(DATA, f);
  assert.deepEqual(out.map(d => d.id).sort(), ['T3'],
    'T4 es G2 y T5 es G3: la zona amplía el universo, el grupo lo vuelve a acotar');
});

test('aplicarFiltros con dep filtra por departamento exacto', () => {
  const f = { ...filtrosVacios(), dep: 'MAGDALENA' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T2', 'T5']);
});

test('aplicarFiltros con grupo filtra exacto', () => {
  const f = { ...filtrosVacios(), grupo: 'G2' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con q busca en sub/id/dep (case-insensitive)', () => {
  const f = { ...filtrosVacios(), q: 'cala' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con q busca por matrícula', () => {
  const f = { ...filtrosVacios(), q: 't1' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T1');
});

test('aplicarFiltros con sev excluye severidades desactivadas', () => {
  const f = { ...filtrosVacios(), sev: new Set(['cri']) };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');  // único cri
});

test('aplicarFiltros: nd (sin dato) cuenta como ok', () => {
  // Solo ok activo → debe incluir T1 (ok) y T5 (nd)
  const f = { ...filtrosVacios(), sev: new Set(['ok']) };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T1', 'T5']);
});

test('aplicarFiltros: sin ok activo, nd se filtra fuera', () => {
  const f = { ...filtrosVacios(), sev: new Set(['cri', 'ale', 'avi']) };
  const out = aplicarFiltros(DATA, f);
  // T1 (ok) y T5 (nd) ambos descartados
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(d => d.id).sort(), ['T2', 'T3', 'T4']);
});

test('aplicarFiltros con dev específico exige pct no nulo en ese devanado', () => {
  // T1 tiene P.pct=55 y S.pct=null → filtrado por dev=S debe excluirlo
  const f = { ...filtrosVacios(), dev: 'S' };
  const out = aplicarFiltros(DATA, f);
  // Ninguno tiene S.pct asignado en el mock
  assert.equal(out.length, 0);
});

test('aplicarFiltros combina múltiples criterios', () => {
  const f = {
    ...filtrosVacios(),
    zona: 'BOLIVAR',
    sev: new Set(['cri']),
  };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con input no-array devuelve []', () => {
  assert.deepEqual(aplicarFiltros(null, filtrosVacios()), []);
  assert.deepEqual(aplicarFiltros(undefined, filtrosVacios()), []);
});

test('aplicarFiltros con filtros undefined devuelve VACÍO, no todo', () => {
  // La aserción anterior era `Array.isArray(out)`, que no falsifica nada:
  // `aplicarFiltros` siempre devuelve un array. Lo que hay que fijar es la
  // ASIMETRÍA de los dos criterios, porque invertir cualquiera de los dos
  // haría mentir al tablero sobre el tamaño del parque:
  //   · severidades → un Set vacío significa NINGUNA (sin chips, no se ve nada);
  //   · zonas       → un Set vacío significa TODAS (sin chips, se ve el parque).
  // Sin filtros no hay severidades activas, así que no pasa ninguna fila.
  assert.deepEqual(aplicarFiltros(DATA, undefined), []);
  assert.equal(aplicarFiltros(DATA, { ...filtrosVacios(), zona: new Set() }).length, DATA.length);
});

test('listarUnicos devuelve valores únicos ordenados', () => {
  assert.deepEqual(listarUnicos(DATA, 'zona'), ['BOLIVAR', 'OCCIDENTE', 'ORIENTE']);
  assert.deepEqual(listarUnicos(DATA, 'dep'),  ['BOLIVAR', 'CESAR', 'MAGDALENA']);
  assert.deepEqual(listarUnicos(DATA, 'grupo'), ['G1', 'G2', 'G3']);
});

test('listarUnicos descarta "N/D" y "N/A" y vacíos', () => {
  const data = [
    { x: 'A' }, { x: 'B' }, { x: 'N/D' }, { x: 'N/A' }, { x: '' }, { x: null }, { x: 'A' },
  ];
  assert.deepEqual(listarUnicos(data, 'x'), ['A', 'B']);
});

test('listarUnicos con input no-array devuelve []', () => {
  assert.deepEqual(listarUnicos(null, 'zona'), []);
});
