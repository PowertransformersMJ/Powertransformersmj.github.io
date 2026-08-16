// Guardia anti-fuga de datos de cliente.
//
// `assets/` se publica en GitHub Pages y el repositorio es PÚBLICO.
// El módulo del catálogo de transformadores llegó a llevar el parque
// completo de AFINIA incrustado (series, matrículas, subestaciones):
// cualquiera podía descargarlo sin login. Ahora es un LECTOR de
// Firestore y debe permanecer así.
//
// Este test falla si alguien vuelve a incrustar registros reales.
// Los patrones que busca son ESTRUCTURALES (forma de una matrícula,
// claves JSON del Excel maestro): no contiene ni un solo dato real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  TRANSFORMADORES_AFINIA,
  mapearDocV2ACatalogo,
  catalogoEnCache,
  limpiarCacheCatalogo,
  buscarPorMatricula,
  cargarTransformadoresAfinia
} from '../assets/js/data/refrigeracion-transformadores-afinia.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = join(RAIZ, 'assets/js/data/refrigeracion-transformadores-afinia.js');
const FUENTE = readFileSync(RUTA, 'utf8');

// ── 1. El archivo publicado no lleva datos incrustados ──────────

test('el módulo no contiene matrículas incrustadas', () => {
  // Forma de una matrícula del parque: T<n>[letra]-<X>/<Y>-<SIGLA>
  const patronMatricula = /\bT\d+[A-Z]?-[A-Z]+\/[A-Z]+-[A-Z]{2,}/g;
  const hits = FUENTE.match(patronMatricula) || [];
  assert.deepEqual(hits, [], `Matrículas incrustadas detectadas: ${hits.length}`);
});

test('el módulo no contiene registros del Excel maestro', () => {
  // Registros como {"SERIE":"…","POTENCIA (KVA)":"…", …}
  const patronRegistro = /\{\s*"(SERIE|MATRICULA|SUBESTACION|ZONA|DEPARTAMENTO|REFRIGERACION|POTENCIA \(KVA\))"\s*:/g;
  const hits = FUENTE.match(patronRegistro) || [];
  assert.deepEqual(hits, [], `Registros incrustados detectados: ${hits.length}`);

  // Ninguna clave canónica en formato JSON (comillas dobles + dos puntos).
  const patronClave = /"(SERIE|MATRICULA|SUBESTACION|DEPARTAMENTO|REFRIGERACION)"\s*:\s*"/g;
  assert.deepEqual(FUENTE.match(patronClave) || [], []);
});

test('el módulo se mantiene liviano y sin líneas-volcado', () => {
  // El archivo con los 206 registros pesaba ~37 KB en una sola línea.
  assert.ok(FUENTE.length < 12000, `El módulo pesa ${FUENTE.length} bytes: revisá si volvieron los datos.`);
  const lineaLarga = FUENTE.split('\n').find((l) => l.length > 200);
  assert.equal(lineaLarga, undefined, 'Hay una línea >200 chars: huele a volcado de datos.');
});

test('TRANSFORMADORES_AFINIA queda vacío y congelado (solo compat)', () => {
  assert.ok(Array.isArray(TRANSFORMADORES_AFINIA));
  assert.equal(TRANSFORMADORES_AFINIA.length, 0);
  assert.ok(Object.isFrozen(TRANSFORMADORES_AFINIA));
});

// ── 2. El mapeo Firestore → catálogo (dominio puro) ─────────────
// Datos FICTICIOS a propósito: SUBESTACIÓN A / TX-A-01.

test('mapea un documento v2 completo a la fila canónica', () => {
  const fila = mapearDocV2ACatalogo({
    identificacion: { codigo: 'TX-A-01', matricula: 'TX-A-01', grupo: 'G2' },
    placa:          { serial: 'SN-DEMO-1', potencia_kva: 10000 },
    ubicacion:      { subestacion_nombre: 'Subestación A', zona: 'BOLIVAR', departamento: 'bolivar' },
    refrigeracion:  { tipo_refrigeracion: 'ONAF' }
  });

  assert.equal(fila.MATRICULA, 'TX-A-01');
  assert.equal(fila.SERIE, 'SN-DEMO-1');
  assert.equal(fila['POTENCIA (KVA)'], '10000');
  assert.equal(fila.GRUPO, 'G2');
  assert.equal(fila.SUBESTACION, 'SUBESTACIÓN A');
  assert.equal(fila.ZONA, 'BOLIVAR');
  assert.equal(fila.DEPARTAMENTO, 'BOLIVAR');
  assert.equal(fila.REFRIGERACION, 'ONAF');
});

test('deja GRUPO y REFRIGERACION VACÍOS cuando Firestore no los trae', () => {
  // Es la situación real hoy: la migración v1→v2 y el importador
  // escriben `refrigeracion: {}`. Preferimos vacío a dato fabricado.
  const fila = mapearDocV2ACatalogo({
    identificacion: { codigo: 'TX-A-02' },
    placa:          { serial: 'SN-DEMO-2', potencia_kva: 6500 },
    ubicacion:      { subestacion_nombre: 'Subestación B', departamento: 'cesar' },
    refrigeracion:  {}
  });

  assert.equal(fila.GRUPO, '');
  assert.equal(fila.REFRIGERACION, '');
  // La zona SÍ es derivable del departamento (regla de dominio).
  assert.equal(fila.ZONA, 'ORIENTE');
  assert.equal(fila.MATRICULA, 'TX-A-02');
});

test('acepta la proyección plana v1 del nivel raíz', () => {
  const fila = mapearDocV2ACatalogo({
    codigo: 'TX-A-03',
    serial: 'SN-DEMO-3',
    potencia_kva: 2500,
    subestacion: 'Subestación C',
    departamento: 'sucre'
  });

  assert.equal(fila.MATRICULA, 'TX-A-03');
  assert.equal(fila.SERIE, 'SN-DEMO-3');
  assert.equal(fila.SUBESTACION, 'SUBESTACIÓN C');
  assert.equal(fila.ZONA, 'OCCIDENTE');
  assert.equal(fila['POTENCIA (KVA)'], '2500');
});

test('no revienta con documentos vacíos o nulos', () => {
  for (const entrada of [null, undefined, {}]) {
    const fila = mapearDocV2ACatalogo(entrada);
    assert.equal(fila.MATRICULA, '');
    assert.equal(fila['POTENCIA (KVA)'], '');
    assert.equal(fila.ZONA, '');
  }
});

// ── 3. Contrato del lector ──────────────────────────────────────

test('el lector expone la API esperada y la caché arranca vacía', () => {
  assert.equal(typeof cargarTransformadoresAfinia, 'function');
  assert.equal(typeof buscarPorMatricula, 'function');
  limpiarCacheCatalogo();
  assert.deepEqual(catalogoEnCache(), []);
});

test('buscarPorMatricula devuelve null sin matrícula (sin tocar la red)', async () => {
  assert.equal(await buscarPorMatricula(''), null);
  assert.equal(await buscarPorMatricula(null), null);
});
