// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El alcance ARGUMENTA, no enumera
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Encargo del Ingeniero (2026-09-10): «la descripción en el
// alcance la necesito en un contexto técnico, donde se argumentan
// las actividades que se van a desarrollar al activo». El texto
// las enumeraba —«comprende regeneración de aceite, pintura
// parcial y…»— sin decir de ninguna por qué se le hace al activo.
//
// El sustento se redactó por macroactividad y lo revisó un
// verificador de rigor normativo, que devolvió 48 correcciones
// sobre 36 actividades: una norma INVENTADA, dos que no
// aplicaban, una promesa de revertir lo irreversible y tres
// afirmaciones de dato. Estas pruebas son el cinturón que impide
// que eso vuelva a entrar.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SUSTENTO_ACCION, sustentoDeAccion } from '../assets/js/domain/acciones_tecnicas.js';
import { SUBACTIVIDADES_BASELINE } from '../assets/js/domain/catalogos_baseline.js';
import { redaccionAlcanceMtto } from '../assets/js/domain/fichas_diagnostico.js';
import { normalizarEquipo, seleccionAcciones } from '../assets/js/ui/fichas/panel.js';

// El cuerpo normativo que el proyecto USA. Nada fuera de aquí puede aparecer.
const NORMAS = [
  'IEC 60076-1', 'IEC 60076-7', 'IEC 60599', 'IEC 60422', 'IEC 60270', 'IEC 61198',
  'IEEE C57.104', 'IEEE C57.91', 'IEEE C57.152', 'ASTM D1816', 'ASTM D971', 'ASTM D974',
  'ASTM D5837', 'CIGRÉ 445', 'triángulo de Duval', 'NTC 3284',
  'MO.00418 §4.1.1', 'MO.00418 §4.1.2', 'MO.00418 §4.1.3', 'MO.00418 §4.2', 'MO.00418 §4.3',
];

describe('El catálogo de sustento técnico', () => {
  test('cubre todas las subactividades de la norma, con su código exacto', () => {
    for (const s of SUBACTIVIDADES_BASELINE) {
      assert.ok(SUSTENTO_ACCION[s.codigo], 'sin sustento: ' + s.codigo);
    }
  });

  test('no sobra ninguna: cada código existe en el catálogo oficial', () => {
    const oficiales = new Set(SUBACTIVIDADES_BASELINE.map((s) => s.codigo));
    for (const cod of Object.keys(SUSTENTO_ACCION)) {
      assert.ok(oficiales.has(cod), 'código que la norma no tiene: ' + cod);
    }
  });

  test('NINGUNA norma inventada: toda referencia sale del cuerpo que el proyecto usa', () => {
    for (const [cod, f] of Object.entries(SUSTENTO_ACCION)) {
      if (!f.referencia) continue;                       // vacía es una respuesta válida
      for (const tok of f.referencia.split('·').map((x) => x.trim()).filter(Boolean)) {
        assert.ok(NORMAS.includes(tok), `${cod} cita «${tok}», que no está en el cuerpo normativo`);
      }
    }
  });

  test('ningún sustento AFIRMA un valor medido: nombra la variable, no su cifra', () => {
    // Un «32 kV» en la plantilla sería un dato inventado para todo el parque.
    // El `%` y los MVA quedan FUERA del filtro a propósito: la norma define
    // bandas en porcentaje —la actividad SUB-C4-08 se llama literalmente «Plan
    // de mitigación sobrecarga 90-110 %»— y ese umbral es criterio, no una
    // medida de este activo. Lo que no puede aparecer es un valor de ensayo.
    const cifraConUnidad = /\d+([.,]\d+)?\s*(kV|kA|ppm|ppb|mN\/m|mgKOH|°C|A\b)/;
    for (const [cod, f] of Object.entries(SUSTENTO_ACCION)) {
      for (const campo of ['subsistema', 'motiva', 'resultado', 'noRevierte']) {
        assert.doesNotMatch(f[campo], cifraConUnidad, `${cod}.${campo} afirma una medida`);
      }
    }
  });

  test('lo que toca la celulosa NO promete devolverla', () => {
    const tocanPapel = ['SUB-C4-02', 'SUB-C3-07', 'SUB-C5-03'];   // secado y recuperación/regeneración de aislamientos
    for (const cod of tocanPapel) {
      const f = SUSTENTO_ACCION[cod];
      if (!f) continue;
      assert.ok(f.noRevierte, cod + ' toca el aislamiento sólido y no declara qué NO devuelve');
      assert.match(f.noRevierte + f.resultado, /polimerizaci|celulosa|vida|consumid|envejecimiento/i);
    }
  });

  test('todo tratamiento del aceite declara que reinicia la línea base', () => {
    for (const [cod, f] of Object.entries(SUSTENTO_ACCION)) {
      if (/regeneraci[oó]n de aceite|regeneraci[oó]n aceite|secado de aceite/i.test(f.nombre)) {
        assert.equal(f.reiniciaLineaBase, true, cod + ': el tratamiento del aceite deja gases y furanos en cero');
      }
    }
  });

  test('se resuelve por código, por nombre y sin tildes; y lo desconocido devuelve null', () => {
    assert.ok(sustentoDeAccion({ codigo: 'SUB-C4-01' }));
    assert.ok(sustentoDeAccion({ txt: 'Regeneración de aceite' }));
    assert.ok(sustentoDeAccion({ txt: 'REGENERACION DE ACEITE' }));
    assert.equal(sustentoDeAccion({ txt: 'PINTAR LA REJA DE LA ENTRADA' }), null);
    assert.equal(sustentoDeAccion(null), null);
  });
});

describe('El alcance del documento de mantenimiento', () => {
  const EQ = normalizarEquipo({
    potencia_kva: 33000, cond_int: 4, subestacion: 'MAMONAL',
    matricula: 'T1-M/M-MAM', usuarios: 9500
  });
  const conSel = (ids) => seleccionAcciones(EQ, { plan: { acc_sel: ids } }, 'alcance_mtto');

  test('argumenta cada actividad: subsistema, qué la motiva, qué deja y qué no devuelve', () => {
    const t = redaccionAlcanceMtto(EQ, EQ.diag, conSel(['REGENERACION-DE-ACEITE']));
    assert.match(t, /actúa sobre/);
    assert.match(t, /Al cierre,/);
    assert.match(t, /No restituye el grado de polimerización/);
    assert.match(t, /Referencia: IEC 60422/);
  });

  test('la advertencia de línea base va UNA vez, no en cada renglón', () => {
    const t = redaccionAlcanceMtto(EQ, EQ.diag, conSel(['REGENERACION-DE-ACEITE', 'SECADO-DE-ACEITE']));
    assert.equal((t.match(/Advertencia de línea base/g) || []).length, 1);
  });

  test('sin actividades escogidas NO se inventa un alcance', () => {
    const t = redaccionAlcanceMtto(EQ, EQ.diag, []);
    assert.doesNotMatch(t, /actividades contratadas/i);
    assert.ok(t.length > 0, 'el resto del alcance —condición y hallazgo— sí se escribe');
  });

  test('una actividad del plan registrado, sin ficha, se enumera pero NO se le inventa argumento', () => {
    const t = redaccionAlcanceMtto(EQ, EQ.diag, [{ txt: 'ACTIVIDAD PROPIA DEL CONTRATO 4125' }]);
    assert.match(t, /ACTIVIDAD PROPIA DEL CONTRATO 4125/);
    assert.match(t, /su sustento técnico se incorpora con el resultado del diagnóstico/);
    assert.doesNotMatch(t, /actúa sobre\s*\./);
  });

  test('llamarla sin el tercer argumento no rompe nada (contrato viejo)', () => {
    const t = redaccionAlcanceMtto(EQ, EQ.diag);
    assert.ok(t.length > 0);
    assert.doesNotMatch(t, /actividades contratadas/i);
  });
});
