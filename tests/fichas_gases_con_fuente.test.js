// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Lo que el papel dice de los gases tiene fuente
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// CF-43 y CF-44 de la cola de Fichas (`99 §137`, TODO-73). El
// diagnóstico que se FIRMA decía tres cosas falsas sobre los gases
// —que el acetileno «solo» sale de un arco, que 500 ppm de etileno
// son la firma del punto caliente del devanado por carga y que hasta
// 99 ppm de etileno es «prácticamente ausente»— y le atribuía a IEEE
// C57.104, IEC 60599 y al triángulo de Duval unos cortes (15 · 500 ·
// 1.000/100 ppm) que ninguna de esas fuentes trae. El triángulo, de
// hecho, ni se calculaba.
//
// Los disparadores NO cambian (los mismos equipos reciben los mismos
// modos); cambia lo que se afirma de ellos. Estas pruebas impiden que
// las frases falsas vuelvan y que un corte del área se presente como
// norma.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { modoDegradacion, redaccionAlcance } from '../assets/js/domain/fichas_diagnostico.js';
import { BENEF_OPC } from '../assets/js/ui/fichas/panel.js';

const EQ = { subestacion: 'SUBESTACIÓN X', matricula: 'T1-X', potencia_kva: 20000, cond_int: 5, cond_lbl: 'Muy pobre' };
const modo = (diag, k) => modoDegradacion(EQ, diag).todos.find((m) => m.k === k);

describe('CF-43 · los mismos disparadores', () => {
  test('arco desde 15 ppm de acetileno, no antes', () => {
    assert.ok(modo({ c2h2: 15 }, 'arco'));
    assert.equal(modoDegradacion(EQ, { c2h2: 14.9 }), null);
  });
  test('térmico desde 500 ppm de etileno', () => {
    assert.ok(modo({ c2h4: 500 }, 'termico'));
    assert.equal(modoDegradacion(EQ, { c2h4: 499 }), null);
  });
  test('descargas con H₂ ≥ 1.000 y etileno < 100 (o sin dato)', () => {
    assert.ok(modo({ h2: 1000, c2h4: 99 }, 'descargas'));
    assert.ok(modo({ h2: 1000 }, 'descargas'));
    assert.ok(!modoDegradacion(EQ, { h2: 1000, c2h4: 100 }));
  });
});

describe('CF-43 · ninguna frase falsa llega al papel', () => {
  const textos = [
    modo({ c2h2: 57, c2h4: 3882, ch4: 2580 }, 'arco').e,
    modo({ c2h2: 57, c2h4: 3882, ch4: 2580 }, 'termico').e,
    modo({ h2: 36748, ch4: 23445, c2h4: 7.1 }, 'descargas').e,
    modo({ h2: 1200 }, 'descargas').e
  ];
  for (const malo of [/solo se genera por arco/, /hot-spot/, /punto más caliente/, /prácticamente ausente/, /sin etileno relevante/]) {
    test(`no dice ${malo}`, () => {
      for (const t of textos) assert.doesNotMatch(t, malo);
    });
  }

  test('el acetileno: principalmente arcos, también puntos muy calientes, y su franja del MO.00418', () => {
    const e = modo({ c2h2: 35 }, 'arco').e;
    assert.match(e, /principalmente por arcos eléctricos/);
    assert.match(e, /puntos calientes de muy alta temperatura/);
    assert.match(e, /calificación 5 del MO\.00418 \(C₂H₂ ≥ 7 ppm\)/);
  });

  test('el etileno: falla térmica localizada, sin prometer una temperatura que el valor absoluto no garantiza', () => {
    const e = modo({ c2h4: 610, ch4: 150 }, 'termico').e;
    assert.match(e, /gases propios de una falla térmica localizada/);
    assert.match(e, /por ejemplo en una conexión o un contacto defectuoso/);
    assert.doesNotMatch(e, /°C/);
  });

  test('los títulos no afirman más que el gas', () => {
    assert.equal(modo({ c2h4: 610 }, 'termico').t, 'Falla térmica localizada');
    assert.equal(modo({ c2h2: 35 }, 'arco').t, 'Descarga de alta energía (arco) o falla térmica severa');
  });

  test('no se nombra el triángulo de Duval en ninguna parte del diagnóstico (no se calcula aquí)', async () => {
    const { redaccionAlcanceMtto } = await import('../assets/js/domain/fichas_diagnostico.js');
    const d = { c2h2: 57, c2h4: 3882, ch4: 2580, h2: 1500 };
    assert.doesNotMatch(redaccionAlcance(EQ, d), /Duval/);
    assert.doesNotMatch(redaccionAlcanceMtto(EQ, d, []), /Duval/);
  });

  test('descargas: no atribuye 1.000 ppm de hidrógeno al gaseo propio del aceite', () => {
    assert.doesNotMatch(modo({ h2: 1500, c2h4: 5 }, 'descargas').e, /gaseo/);
  });

  test('descargas: el etileno se dice con su cifra y frente al hidrógeno', () => {
    assert.match(modo({ h2: 1500, c2h4: 99 }, 'descargas').e, /con etileno de 99,0 ppm, muy inferior al hidrógeno/);
    assert.match(modo({ h2: 1500, c2h4: 0 }, 'descargas').e, /sin dato de etileno en la muestra/);
  });
});

describe('CF-43 · el corte del área no se presenta como norma', () => {
  const casos = [
    ['arco', { c2h2: 35 }, /el umbral de 15 ppm es criterio del área/],
    ['termico', { c2h4: 610 }, /el umbral de 500 ppm de etileno es criterio del área/],
    ['descargas', { h2: 1500, c2h4: 5 }, /los umbrales de 1\.000 ppm de hidrógeno y 100 ppm de etileno son criterio del área/]
  ];
  for (const [k, diag, rotulo] of casos) {
    test(`${k}: rotula su umbral y no cita IEEE C57.104 ni Duval`, () => {
      const n = modo(diag, k).n;
      assert.match(n, rotulo);
      assert.match(n, /IEC 60599:2022 §4\.1/);
      assert.doesNotMatch(n, /IEEE C57\.104/);
      assert.doesNotMatch(n, /Duval/);
    });
  }

  test('el diagnóstico dominante del PI lleva la cita nueva', () => {
    const t = redaccionAlcance(EQ, { c2h2: 35 });
    assert.match(t, /conforme a MO\.00418\.DE-GAC-AX\.01 Ed\. 02, Tabla 3 · IEC 60599:2022 §4\.1; el umbral de 15 ppm es criterio del área\./);
  });
});

describe('CF-43 · el metano solo se escribe si se midió', () => {
  for (const ch4 of [undefined, null, '', 0, '0']) {
    test(`metano ${JSON.stringify(ch4)} no imprime cifra`, () => {
      assert.doesNotMatch(modo({ c2h4: 600, ch4 }, 'termico').e, /metano/);
      assert.doesNotMatch(modo({ h2: 1500, c2h4: 5, ch4 }, 'descargas').e, /metano/);
    });
  }
  test('metano medido sí sale', () => {
    assert.match(modo({ c2h4: 600, ch4: 300 }, 'termico').e, /y metano \(CH₄\) en 300 ppm/);
  });
});

describe('CF-44 · ISO 55001 como el sistema de la empresa', () => {
  test('el alcance automático del PI', () => {
    const t = redaccionAlcance(EQ, null);
    assert.match(t, /en el marco del sistema de gestión de activos de la empresa \(ISO 55001\), la reposición/);
    assert.doesNotMatch(t, /y en el marco de la gestión de activos \(ISO 55001\)/);
  });
  test('el beneficio V2 (redacción del Ingeniero) solo suma «de la empresa»', () => {
    const v2 = BENEF_OPC[1].v;
    assert.match(v2, /alineado con la política de gestión de activos de la empresa \(ISO 55001\)\./);
    assert.equal(BENEF_OPC.length, 5); // el índice de cada versión no se mueve (`99 §85.3`)
  });
});
