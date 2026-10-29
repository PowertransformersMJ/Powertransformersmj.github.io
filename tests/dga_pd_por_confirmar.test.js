// Triángulo de Duval — «PD POR CONFIRMAR (hidrógeno muy alto)» (decisión del Ingeniero 2026-10-28, punto 2) y aviso de
// ENERGUA en el panel de gases. Lo que se exige: el rótulo solo con zona PD concluyente y H₂ ≥ 2.000 ppm; el texto que
// chocaba («la carga no mueve este defecto» frente a «el gas del aceite crece con la temperatura») se reemplaza; el resto, igual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pdPorConfirmar, H2_PD_POR_CONFIRMAR, ROTULO_PD_POR_CONFIRMAR, TEXTO_TENDENCIA_PD_POR_CONFIRMAR } from '../assets/js/domain/dga_pd_por_confirmar.js';

const d = (zona, h2, estado = 'ok') => ({ estado, zona, ultima: { gases: { H2: h2, CH4: 5000, C2H4: 1, C2H2: 0 } } });

test('solo PD concluyente con 2.000 ppm de hidrógeno o más', () => {
  assert.equal(H2_PD_POR_CONFIRMAR, 2000);
  assert.equal(pdPorConfirmar(d('PD', 2000)), true);
  assert.equal(pdPorConfirmar(d('PD', 33854)), true);
  assert.equal(pdPorConfirmar(d('PD', 1999)), false);
  assert.equal(pdPorConfirmar(d('T1', 40000)), false);
  assert.equal(pdPorConfirmar(d('PD', 40000, 'no_concluyente')), false);
  assert.equal(pdPorConfirmar({ estado: 'ok', zona: 'PD', ultima: { gases: {} } }), false);
  assert.equal(pdPorConfirmar(null), false);
});

test('el rótulo y el texto dicen las dos posibilidades', () => {
  assert.equal(ROTULO_PD_POR_CONFIRMAR, 'PD por confirmar (hidrógeno muy alto)');
  assert.match(TEXTO_TENDENCIA_PD_POR_CONFIRMAR, /la carga no la mueve/);
  assert.match(TEXTO_TENDENCIA_PD_POR_CONFIRMAR, /crece con la temperatura/);
  assert.match(TEXTO_TENDENCIA_PD_POR_CONFIRMAR, /triángulos 4 y 5/);
});

test('pantallas: el panel de Duval usa el rótulo y el texto; el de gases, el aviso de ENERGUA', () => {
  const du = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-duval.js', import.meta.url), 'utf8');
  assert.match(du, /\(pdPorConfirmar\(d\) \? ROTULO_PD_POR_CONFIRMAR : info\.nombre\)/);
  assert.match(du, /const texto = pdPorConfirmar\(d\) \? TEXTO_TENDENCIA_PD_POR_CONFIRMAR : tend \? tend\.texto/);
  assert.match(du, /rs\[0\]\.origen === 'descarga' && pdPorConfirmar\(d\) \? ORIGEN_PD_POR_CONFIRMAR/);
  const dg = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-dga.js', import.meta.url), 'utf8');
  assert.match(dg, /textoTraspaso\(t\) \+ '\. Lo de este panel es información para '/);
  assert.match(dg, /    avisoTraspaso\(tx\),\n/);
});
