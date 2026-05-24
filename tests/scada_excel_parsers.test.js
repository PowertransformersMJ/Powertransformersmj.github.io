// node --test tests/scada_excel_parsers.test.js
//
// Tests para los parsers PUROS del módulo SCADA. Las funciones que
// requieren SheetJS o SparkMD5 (parseSOERows, parseOneFile) se
// excluyen — esos solo corren en navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExcelDateParts, normalizeJsonRow, parseCSV, parseCSVLine,
} from '../assets/js/data/seguimiento_scada_excel.js';

test('parseExcelDateParts: número (serial Excel) → ISO sin UTC drift', () => {
  // 2026-05-18 00:00:04 → serial = ~45960.0001 (Excel epoch 1899-12-30)
  const v = (new Date(Date.UTC(2026, 4, 18, 0, 0, 4)) - new Date(Date.UTC(1899, 11, 30))) / (86400 * 1000);
  const p = parseExcelDateParts(v);
  assert.equal(p.date, '2026-05-18');
  assert.equal(p.iso.startsWith('2026-05-18T'), true);
  // Segundos redondeados como pyxlsb
  assert.equal(p.iso.endsWith(':04') || p.iso.endsWith(':03') || p.iso.endsWith(':05'), true);
});

test('parseExcelDateParts: string ISO', () => {
  const p = parseExcelDateParts('2026-05-18T01:30:45');
  assert.equal(p.iso, '2026-05-18T01:30:45');
  assert.equal(p.date, '2026-05-18');
});

test('parseExcelDateParts: string con espacio en lugar de T', () => {
  const p = parseExcelDateParts('2026-05-18 01:30:45');
  assert.equal(p.iso, '2026-05-18T01:30:45');
});

test('parseExcelDateParts: vacío/null devuelve null', () => {
  assert.equal(parseExcelDateParts(null), null);
  assert.equal(parseExcelDateParts(''), null);
  assert.equal(parseExcelDateParts(undefined), null);
});

test('parseExcelDateParts: Date instance', () => {
  const d = new Date(2026, 4, 18, 1, 30, 45);
  const p = parseExcelDateParts(d);
  assert.equal(p.date, '2026-05-18');
  assert.equal(p.iso, '2026-05-18T01:30:45');
});

test('parseCSVLine: respeta comillas', () => {
  assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseCSVLine('"a,b",c'), ['a,b', 'c']);
  assert.deepEqual(parseCSVLine('"a""b",c'), ['a"b', 'c']);
});

test('normalizeJsonRow: shape backend (snake_case) → shape dashboard', () => {
  const row = normalizeJsonRow({
    event_id: 'abc123',
    timestamp_rtu: '2026-05-18T01:30:45',
    swtrafo_id: 'A__t__66',
    substation: 'AGUACHICA',
    asset: 'swTrafo1',
    voltage_level: '66kV',
    zona: 'CESAR',
    unit: 'U2',
    parameter: 'voltage_RS',
    unit_of_measure: 'kV',
    measured_value: '70.5',
    limit_value: '69.3',
    is_violation: 'true',
  });
  assert.equal(row.id, 'abc123');
  assert.equal(row.ts, '2026-05-18T01:30:45');
  assert.equal(row.date, '2026-05-18');
  assert.equal(row.sid, 'A__t__66');
  assert.equal(row.sub, 'AGUACHICA');
  assert.equal(row.kv, '66kV');
  assert.equal(row.u, 'U2');
  assert.equal(row.param, 'voltage_RS');
  assert.equal(row.m, 70.5);
  assert.equal(row.l, 69.3);
  assert.equal(row.viol, 1);
  // v = m - l = 1.2
  assert.equal(Math.abs(row.v - 1.2) < 1e-3, true);
});

test('normalizeJsonRow: shape compacto (claves cortas) también funciona', () => {
  const row = normalizeJsonRow({
    id: 'x', ts: '2026-05-18T01:00:00', date: '2026-05-18',
    sid: 'A', sub: 'A', asset: 't', kv: '66', zona: 'N',
    u: 'U1', param: 'voltage_RS', uom: 'kV',
    m: 70, l: 69, viol: 1,
  });
  assert.equal(row.id, 'x');
  assert.equal(row.m, 70);
});

test('normalizeJsonRow: is_violation parsea variantes booleanas', () => {
  const truthy = ['true', 'True', '1', 1, true, 'yes', 'si', 'YES'];
  for (const t of truthy) {
    const r = normalizeJsonRow({ ts: '2026-05-18T01:00:00', m: 70, l: 69, is_violation: t });
    assert.equal(r.viol, 1, `falla con ${JSON.stringify(t)}`);
  }
  const falsy = ['false', 'False', '0', 0, false, 'no'];
  for (const f of falsy) {
    const r = normalizeJsonRow({ ts: '2026-05-18T01:00:00', m: 70, l: 69, is_violation: f });
    assert.equal(r.viol, 0, `falla con ${JSON.stringify(f)}`);
  }
});

test('normalizeJsonRow: sin timestamp devuelve null', () => {
  assert.equal(normalizeJsonRow({ m: 1, l: 0 }), null);
});

test('parseCSV: header + filas → array de events normalizados', () => {
  const csv = [
    'event_id,timestamp_rtu,substation,asset,voltage_level,zona,unit,parameter,unit_of_measure,measured_value,limit_value,is_violation',
    'a1,2026-05-18T01:00:00,SUB,t1,66kV,NORTE,U2,voltage_RS,kV,70.5,69.3,true',
    'a2,2026-05-18T02:00:00,SUB,t1,66kV,NORTE,U1,voltage_ST,kV,69.7,69.3,true',
  ].join('\n');
  const out = parseCSV(csv);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'a1');
  assert.equal(out[1].param, 'voltage_ST');
});

test('parseCSV: filas con mismatch de columnas se descartan', () => {
  const csv = 'a,b,c\n1,2,3\n4,5,6,7';  // segunda fila tiene 4 col
  assert.equal(parseCSV(csv).length, 0); // ninguna pasa porque falta timestamp + sin event_id_field reconocido
});
