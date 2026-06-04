// Contrato IA ↔ schema · Pruebas Eléctricas.
//
// La Cloud Function extraerPruebasElectricasIA (functions/index.js) fuerza
// a Claude a llamar la herramienta `registrar_pruebas_electricas`, cuyo
// input ES la "bolsa de mediciones" que el shell pasa a sanitizarInforme().
// Este test fija ese contrato: un output representativo de la IA (tal cual
// el tool_use.input) debe sanitizarse a un informe válido con las
// calificaciones normativas correctas, SIN que la IA las calcule.
//
// Si el tool schema de la función y sanitizarInforme se desincronizan,
// este test falla. Es la red de seguridad de la integración (sin red ni
// Firebase: dominio puro, node --test).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarInforme, validarInforme, TIPOS_PRUEBA
} from '../assets/js/domain/pruebas_electricas_schema.js';

// Output representativo de Claude (forma exacta del tool_use.input que
// devuelve la Cloud Function en `mediciones`). Mezcla las 7 familias con
// valores en zonas de semáforo conocidas.
const TOOL_OUTPUT_IA = {
  ano: 2021,
  fecha: '12/05/2021',
  ejecutante: 'Applus',
  equipo: 'DOBLE M4100',
  serie_en_pdf: '200718',
  tipo_prueba: null, // el sistema lo infiere
  tand: [
    { code: 'CH',  entre: 'AT ↔ tierra', valor_pct: 0.23 }, // ≤0.5 → bueno
    { code: 'CHL', entre: 'AT ↔ MT',     valor_pct: 0.60 }, // 0.5–0.7 → normal
    { code: 'CL',  entre: 'MT ↔ tierra', valor_pct: 1.23 }  // >1 → excesivo
  ],
  excitacion: {
    devanado: 'AT', ref: 'N (H0)', tap: '3',
    delta_ext_pct: 8,
    fases: [
      { fase: 'A', valor: 12.4, term: 'H1–H0' },
      { fase: 'B', valor: 11.9, term: 'H2–H0' },
      { fase: 'C', valor: 12.1, term: 'H3–H0' }
    ]
  },
  relacion: [
    { devanado: 'AT', asociado: 'MT', tap: '3', desviacion_pct: 0.2,
      fases: [{ fase: 'A', valor: 3.19 }] } // ≤0.5 → OK
  ],
  resistencia: [
    { ano_tap: '2021 (3)', devanado: 'AT', conexion: 'fase–N', unidad: 'mΩ',
      delta_max_pct: 7.5, // >5 → verificar
      fases: [{ fase: 'A', valor: 412 }, { fase: 'B', valor: 401 }, { fase: 'C', valor: 443 }] }
  ],
  aislamiento: [
    { devanado: 'AT', asociado: 'Tierra', gohm: 0.6 } // <1 → bajo
  ],
  collar: {
    max_mw: 120, // ≥100 → alto
    bujes: [{ buje: 'H1', fase: 'A', devanado: 'AT', i_ua: 230, mw: 120 }]
  },
  drm: {
    conmutador: { fabricante: 'MR', tipo: 'V III 200', serial: '145981', posiciones: 21 },
    tiempo_min_ms: 45, tiempo_max_ms: 80, // 80 > 70 → fuera
    transiciones: []
  }
};

describe('IA → sanitizarInforme · contrato', () => {
  const inf = sanitizarInforme({
    unidadId: '200718', serie: '200718', ano: TOOL_OUTPUT_IA.ano,
    ...TOOL_OUTPUT_IA
  });

  test('el informe es válido (serie + año en rango)', () => {
    assert.deepEqual(validarInforme(inf), []);
  });

  test('conserva metadatos de identidad extraídos por la IA', () => {
    assert.equal(inf.ejecutante, 'Applus');
    assert.equal(inf.equipo, 'DOBLE M4100');
    assert.equal(inf.serie_en_pdf, '200718');
    assert.equal(inf.fecha, '12/05/2021');
    assert.equal(inf.ano, 2021);
  });

  test('infiere tipo_prueba = predictivo_completo (trae tan δ)', () => {
    assert.equal(inf.tipo_prueba, TIPOS_PRUEBA.PREDICTIVO_COMPLETO);
  });

  test('tan δ: deriva el semáforo desde el valor (la IA NO califica)', () => {
    const byCode = Object.fromEntries(inf.tand.map((t) => [t.code, t.calif]));
    assert.equal(byCode.CH, 'bueno');
    assert.equal(byCode.CHL, 'normal');
    assert.equal(byCode.CL, 'excesivo');
  });

  test('excitación: Δ=8% con I>50? no (I≈12mA) → límite 10 → normal', () => {
    assert.equal(inf.excitacion.calif, 'normal');
    assert.equal(inf.excitacion.fases.length, 3);
  });

  test('relación OK, resistencia verificar, aislamiento bajo, collar alto', () => {
    assert.equal(inf.relacion[0].calif, 'OK');
    assert.equal(inf.resistencia[0].calif, 'verificar');
    assert.equal(inf.aislamiento[0].calif, 'bajo');
    assert.equal(inf.collar.calif, 'alto');
  });

  test('DRM: ventana 45–80 ms → fuera (80 > 70)', () => {
    assert.equal(inf.drm.calif, 'fuera');
    assert.equal(inf.drm.conmutador.serial, '145981');
  });

  test('pdf.estado refleja extracción por IA cuando se provee', () => {
    const inf2 = sanitizarInforme({
      unidadId: '200718', serie: '200718', ...TOOL_OUTPUT_IA,
      pdf: { storagePath: 'pruebas_electricas/200718/x.pdf', filename: 'x.pdf', estado: 'extraido_ia' }
    });
    assert.equal(inf2.pdf.estado, 'extraido_ia');
  });
});

describe('IA → sanitizarInforme · robustez ante PDF parcial', () => {
  test('un informe con solo DRM se infiere drm_oltc y no rompe', () => {
    const soloDrm = {
      ano: 2024,
      drm: { conmutador: { serial: 'X' }, tiempo_min_ms: 50, tiempo_max_ms: 60, transiciones: [] }
    };
    const inf = sanitizarInforme({ unidadId: 'u', serie: 'u', ...soloDrm });
    assert.equal(inf.tipo_prueba, TIPOS_PRUEBA.DRM_OLTC);
    assert.equal(inf.drm.calif, 'OK');
    assert.deepEqual(inf.tand, []);
  });

  test('output vacío de la IA produce un informe vacío válido (con año)', () => {
    const inf = sanitizarInforme({ unidadId: 'u', serie: 'u', ano: 2020 });
    assert.deepEqual(validarInforme(inf), []);
    assert.deepEqual(inf.tand, []);
    assert.deepEqual(inf.aislamiento, []);
  });
});
