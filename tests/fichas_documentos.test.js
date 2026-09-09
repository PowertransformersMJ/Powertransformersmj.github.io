// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Al pulsar «Ficha» se elige QUÉ documento
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Hasta hoy «Ficha» abría directamente el formato PE.02081. El
// Ingeniero precisó que lo que ahí se propone es una **propuesta a Plan
// de Inversión (PI)** — un documento entre varios, no «la ficha» — y
// que hará falta otro: Mantenimiento Especializado · Salud de Activos.
//
// Nombrarlos bien no es cosmética: uno propone INVERSIÓN (reponer el
// activo) y el otro programará MANTENIMIENTO sobre el equipo en
// servicio. Confundirlos es confundir dos presupuestos distintos.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DOCUMENTOS_FICHA, HOJAS_FICHA } from '../assets/js/ui/fichas/panel.js';

describe('DOCUMENTOS_FICHA — los documentos que se emiten desde un equipo', () => {

  test('están los dos, con el PI marcado como listo', () => {
    const ids = DOCUMENTOS_FICHA.map((d) => d.id);
    assert.deepEqual([...ids].sort(), ['pi', 'salud']);
    const pi = DOCUMENTOS_FICHA.find((d) => d.id === 'pi');
    assert.equal(pi.listo, true, 'el PI existe y funciona hoy');
  });

  // 🔒 El que aún no existe NO puede anunciarse como disponible: alguien
  // podría dar por emitido un documento que no se ha construido.
  test('Salud de Activos está marcado como NO listo', () => {
    const s = DOCUMENTOS_FICHA.find((d) => d.id === 'salud');
    assert.equal(s.listo, false);
    assert.match(s.desc, /construcción/i, 'y lo dice en su propia descripción');
  });

  test('los nombres dicen qué es cada uno, sin ambigüedad', () => {
    const pi = DOCUMENTOS_FICHA.find((d) => d.id === 'pi');
    const sa = DOCUMENTOS_FICHA.find((d) => d.id === 'salud');
    assert.match(pi.lbl, /Plan de Inversión/);
    assert.match(pi.desc, /PE\.02081/, 'el PI conserva su formato oficial');
    assert.match(sa.lbl, /Mantenimiento Especializado/);
    assert.match(sa.lbl, /Salud de Activos/);
  });

  // Contra-prueba de no-regresión: el PI sigue teniendo sus seis hojas,
  // en el orden del formato oficial. El encargo era «mantén todo lo que
  // está sin dañar nada».
  test('el PI conserva sus seis hojas y su orden', () => {
    assert.equal(HOJAS_FICHA.length, 6);
    assert.deepEqual(HOJAS_FICHA.map((h) => h.id),
      ['ficha', 'benef', 'diagA', 'diagF', 'anexoAT', 'plan']);
  });
});
