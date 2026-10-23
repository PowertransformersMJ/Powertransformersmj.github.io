// Carga vigente para el recálculo de salud (ADR-167): una muestra nueva no puede dejar al equipo sin cargabilidad.
// Datos sintéticos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargaActualDesdeTransformador, conservarFuenteCRG } from '../assets/js/domain/salud_carga_vigente.js';
import { snapshotSaludCompleto, fusionarConservandoCondicion, calcularCalifCRG } from '../assets/js/domain/salud_activos.js';

const tx = (salud = {}, e = {}) => ({
  fabricacion: { ano_fabricacion: 1997 },
  electrico: { corriente_nominal_primaria_a: 334.7, corriente_medida_primaria_a: 343, corriente_nominal_secundaria_a: 836.7, corriente_medida_secundaria_a: 857.43, ...e },
  salud_actual: { hi_final: 1.4, bucket: 'muy_bueno', condicion_fuente: 'excel', overrides_aplicados: ['_importacion_v2'], ...salud }
});

test('el % oficial manda sobre el cociente carga ÷ ampacidad', () => {
  const c = cargaActualDesdeTransformador(tx({ crg_pct_medido: 67.4 }));
  assert.equal(c.crg_pct, 67.4);
  assert.deepEqual(calcularCalifCRG(c), { calif: 3, crg_pct: 67.4 });
});

test('sin % oficial, sale el mayor cociente de los devanados (como el importador)', () => {
  const r = calcularCalifCRG(cargaActualDesdeTransformador(tx({}, { corriente_medida_secundaria_a: 500 })));
  assert.equal(r.calif, 5); assert.ok(Math.abs(r.crg_pct - 102.48) < 0.01);
  assert.deepEqual(calcularCalifCRG(cargaActualDesdeTransformador({})), { calif: null, crg_pct: null });
});

test('una muestra nueva conserva la cargabilidad, su fuente y la condición del Excel', () => {
  const t = tx({ crg_pct_medido: 67.4, calif_crg: 3, crg_fuente: 'scada', crg_periodo: '2026-09', crg_nota: 'lado 13,8 kV' });
  const snap = snapshotSaludCompleto({ transformador: t, cargaActual: cargaActualDesdeTransformador(t) });
  const vig = conservarFuenteCRG(t.salud_actual, fusionarConservandoCondicion(t.salud_actual, snap));
  assert.equal(vig.calif_crg, 3); assert.equal(vig.crg_pct_medido, 67.4);
  assert.equal(vig.crg_fuente, 'scada'); assert.equal(vig.crg_periodo, '2026-09'); assert.equal(vig.crg_nota, 'lado 13,8 kV');
  assert.equal(vig.hi_final, 1.4); assert.equal(vig.bucket, 'muy_bueno');
  // Antes del arreglo (sin carga) el motor la dejaba en nulo:
  assert.equal(snapshotSaludCompleto({ transformador: t }).calif_crg, null);
});

test('si el % cambió, la fuente vieja no se pega al nuevo', () => {
  const v = conservarFuenteCRG({ crg_pct_medido: 67.4, crg_fuente: 'scada' }, { crg_pct_medido: 80 });
  assert.equal(v.crg_fuente, undefined);
});

test('el trigger arma la carga y conserva la fuente (texto de functions/index.js)', () => {
  const src = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  assert.match(src, /cargaActual: cargaActualDesdeTransformador\(tx\)/);
  assert.match(src, /conservarFuenteCRG\(tx\.salud_actual, fusionarConservandoCondicion\(tx\.salud_actual, snap\)\)/);
});
