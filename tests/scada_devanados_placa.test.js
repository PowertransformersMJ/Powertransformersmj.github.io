// La tabla «Devanados de placa» del detalle con los valores de la PLACA (pedido 2026-10-23: «si tomamos los valores de
// placa, ¿por qué calculas potencia? Donde sí debemos calcular corriente es en las placas que no traen ampacidad»).
// Datos SINTÉTICOS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasDevanadosPlaca } from '../assets/js/domain/scada_devanados_placa.js';

const dev = (d, kv, A, extra = {}) => ({ d, nombre: { P: 'Primario', S: 'Secundario', T: 'Terciario' }[d], kv, A, mva: Math.sqrt(3) * kv * A / 1000,
  conexion: 'linea', niveles: [kv + ' kV'], pct: null, iP99: null, manda: false, aviso: null, ...extra });

test('con placa: tensión, potencia (etapas) y corriente de la PLACA; la cargabilidad contra esa corriente', () => {
  const ds = [dev('P', 66, 290, { iP99: 270, pct: 93.1 }), dev('S', 13.8, 1670, { iP99: 1320, pct: 79.04, manda: true })];
  const lp = { P: { kva: [30000, 40000], nombres: ['ONAN', 'ONAF1'], kv: 67, A: [258.5, 344.7], origenA: ['calculada', 'impresa'] },
    S: { kva: [30000, 40000], nombres: ['ONAN', 'ONAF1'], kv: 13.8, A: [1255, 1673.5], origenA: ['impresa', 'impresa'] } };
  const [p, s] = filasDevanadosPlaca(ds, lp);
  assert.deepEqual(p.potencia, { mva: [30, 40], nombres: ['ONAN', 'ONAF'], origen: 'placa' });
  assert.equal(p.tension.kv, 67); assert.equal(p.tension.kvSistema, 66);
  assert.equal(p.ampacidad.A, 344.7); assert.equal(p.ampacidad.origen, 'impresa'); assert.equal(p.ampacidad.onan, 258.5); assert.equal(p.ampacidad.onanOrigen, 'calculada');
  assert.ok(Math.abs(p.pct - 100 * 270 / 344.7) < 1e-9);
  // La plataforma difiere más de 2 %: se anota su ampacidad y la cifra oficial (con ella).
  assert.equal(p.ampacidad.plataforma, 290); assert.equal(p.pctOficial, 93.1);
  // Secundario: la plataforma cuadra (±2 %) → sin nota.
  assert.equal(s.ampacidad.plataforma, null); assert.equal(s.pctOficial, null); assert.equal(s.manda, true);
});

test('la corriente solo es «calculada» cuando la placa no la graba; sin placa, los valores de la plataforma rotulados', () => {
  const ds = [dev('P', 34.5, 83.67), dev('S', 13.8, 209.18)];
  const lp = { P: { kva: [5000], nombres: ['ONAN'], kv: 34.5, A: [83.67], origenA: ['calculada'] }, S: { kva: [5000], nombres: ['ONAN'], kv: 13.8, A: null } };
  const [p, s] = filasDevanadosPlaca(ds, lp);
  assert.equal(p.ampacidad.origen, 'calculada'); assert.deepEqual(p.potencia.nombres, ['ONAN']); assert.equal(p.ampacidad.onan, null);
  assert.equal(s.tension.origen, 'plataforma'); assert.equal(s.potencia.origen, 'calculada'); assert.equal(s.ampacidad.origen, 'plataforma');
  const sin = filasDevanadosPlaca(ds, null);
  assert.ok(sin.every((f) => f.ampacidad.origen === 'plataforma' && f.potencia.origen === 'calculada'));
});

test('terciario de compensación: sin potencia de carga ni límite', () => {
  const [t] = filasDevanadosPlaca([dev('T', 13.8, null)], { T: { sinLimite: true, compensa: true, kv: 6.6, A: null } });
  assert.equal(t.potencia.compensacion, true); assert.equal(t.ampacidad.A, null); assert.equal(t.pct, null); assert.equal(t.tension.kv, 6.6);
});

test('el detalle usa la placa leída por su panel (sin leerla dos veces) y ya no titula «Potencia calculada»', () => {
  const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(det, /import \{ filasDevanadosPlaca \} from '\.\.\/\.\.\/domain\/scada_devanados_placa\.js'/);
  assert.match(det, /alLeer: \(placa\) =>/);
  assert.doesNotMatch(det, /'Potencia calculada'/);
  const pp = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/panel-placa.js', import.meta.url), 'utf8');
  assert.match(pp, /alLeer\(r\.hay \? r\.placa : null\)/);
});

test('la plataforma con la ONAN de la placa (ventilación fuera de servicio) se dice así, no «por corregir»', () => {
  const [p] = filasDevanadosPlaca([dev('P', 34.5, 83.67, { iP99: 80, pct: 95.6 })],
    { P: { kva: [5000, 6250], nombres: ['ONAN', 'ONAF1'], kv: 34.5, A: [83.67, 104.6], origenA: ['impresa', 'calculada'] } });
  assert.equal(p.ampacidad.plataforma, 83.67); assert.equal(p.ampacidad.plataformaEsOnan, true); assert.equal(p.pctOficial, 95.6);
});

test('respaldo: si el panel de placa no entrega la placa (versión en caché o falla), la tabla la lee por su cuenta', () => {
  const det = readFileSync(new URL('../assets/js/ui/cargabilidad-scada/detalle.js', import.meta.url), 'utf8');
  assert.match(det, /import \{ leerPlaca \} from '\.\.\/\.\.\/data\/placas_caracteristicas\.js'/);
  assert.match(det, /function placaParaTabla\(a\)/);
  assert.equal((det.match(/placaParaTabla\(actual\)/g) || []).length, 3, 'tras el panel, si falla el panel y si no carga su módulo');
});
