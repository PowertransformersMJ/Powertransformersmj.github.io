// Beneficios de las prácticas de mantenimiento escogidas (`99 §92`). Texto que
// se FIRMA: estas pruebas vigilan las reglas del sustento técnico sobre cada
// beneficio, la apertura y el cierre, y cómo se arma el texto.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENEFICIO_PRACTICA, APERTURA_BENEFICIOS, CIERRE_BENEFICIOS,
  APERTURA_BENEFICIOS_AMPLIA, CIERRE_BENEFICIOS_AMPLIO,
  redaccionBeneficiosPracticas, codigoDePractica
} from '../assets/js/domain/beneficios_practicas.js';
import { macroactividadesCatalogo, esInversion } from '../assets/js/domain/fichas_acciones.js';

const SUBS = macroactividadesCatalogo().flatMap((g) => (g.subs || []).map((s) => ({ ...s, macro: g.nombre })));
const NO_INVERSION = SUBS.filter((s) => !esInversion(s.nombre));
// Las reglas del texto que se firma valen para el BREVE que sale (`99 §95`) y
// para el amplio que lo sustenta (`§92`).
const TEXTOS = [APERTURA_BENEFICIOS, CIERRE_BENEFICIOS, APERTURA_BENEFICIOS_AMPLIA, CIERRE_BENEFICIOS_AMPLIO,
  ...Object.values(BENEFICIO_PRACTICA).flatMap((b) => [b.beneficio, b.beneficioAmplio])];
const palabras = (t) => t.trim().split(/\s+/).length;

describe('El catálogo de beneficios', () => {
  test('una entrada por cada práctica del MO.00418 que NO es inversión, y ninguna de inversión', () => {
    assert.deepEqual(Object.keys(BENEFICIO_PRACTICA).sort(), NO_INVERSION.map((s) => s.codigo).sort());
    for (const s of SUBS.filter((x) => esInversion(x.nombre))) assert.ok(!BENEFICIO_PRACTICA[s.codigo], s.codigo);
  });

  test('cada entrada dice la falla catastrófica que ayuda a prevenir, su beneficio BREVE y el amplio que lo sustenta', () => {
    for (const [cod, b] of Object.entries(BENEFICIO_PRACTICA)) {
      assert.ok(b.falla && b.falla.trim().length > 5, cod + ' sin falla');
      // Pedido del Ingeniero: «breve» (`99 §95`) y «términos más técnicos» (`§97`).
      const n = palabras(b.beneficio);
      assert.ok(n >= 15 && n <= 32, cod + ' breve: ' + n + ' palabras');
      assert.ok(/[.]$/.test(b.beneficio.trim()), cod + ': el breve cierra con punto');
      // El amplio de `§92`: tope 110 porque el cambiador de tomas (SUB-C3-05)
      // nombra OILTAP, VACUTAP y NLTC por separado.
      const m = palabras(b.beneficioAmplio);
      assert.ok(m >= 20 && m <= 110, cod + ' amplio: ' + m + ' palabras');
      assert.ok(n < m, cod + ': el breve es más corto que el amplio');
    }
  });

  test('el cambiador de tomas nombra SIEMPRE ambas tecnologías, también en breve', () => {
    for (const cod of ['SUB-C3-05', 'SUB-C4-04']) {
      assert.match(BENEFICIO_PRACTICA[cod].beneficio, /OILTAP/, cod);
      assert.match(BENEFICIO_PRACTICA[cod].beneficio, /VACUTAP/, cod);
    }
  });

  test('las prácticas de diagnóstico DETECTAN: su breve no dice que reduzcan el riesgo', () => {
    const diag = Object.keys(BENEFICIO_PRACTICA).filter((c) => /^SUB-(PSM|C2)-/.test(c));
    assert.ok(diag.length >= 10);
    for (const c of diag) assert.doesNotMatch(BENEFICIO_PRACTICA[c].beneficio, /\b(reduce|contiene|acota|disminuye)\b/i, c);
  });

  test('apertura y cierre breves', () => {
    assert.ok(palabras(APERTURA_BENEFICIOS) <= 40, 'apertura: ' + palabras(APERTURA_BENEFICIOS));
    assert.ok(palabras(CIERRE_BENEFICIOS) <= 35, 'cierre: ' + palabras(CIERRE_BENEFICIOS));
    assert.match(CIERRE_BENEFICIOS, /no se recupera/, 'el cierre conserva la salvedad de lo irreversible');
  });

  test('la apertura lleva los huecos del equipo y el cierre existe', () => {
    for (const h of ['{MATRICULA}', '{MVA}', '{SUB}']) assert.ok(APERTURA_BENEFICIOS.includes(h), h);
    assert.ok(!APERTURA_BENEFICIOS.includes('@@') && !CIERRE_BENEFICIOS.includes('@@'));
    assert.ok(CIERRE_BENEFICIOS.trim().length > 60);
  });
});

describe('Las reglas del texto que se firma', () => {
  test('ningún número ni valor medido', () => {
    for (const t of TEXTOS) assert.doesNotMatch(t, /\d/, t.slice(0, 80));
  });

  test('ninguna norma dentro del texto', () => {
    for (const t of TEXTOS) assert.doesNotMatch(t, /\b(IEC|IEEE|ASTM|CIGR[EÉ]|NTC|MO\.00418)\b/, t.slice(0, 80));
  });

  test('nada se promete que no se cumple', () => {
    const prohibido = /garantiz|elimina(r|n)? (el|todo) riesgo|evita(r|n)? (la|toda) falla|impide(n)? (la|toda) falla|rejuvenec/i;
    for (const t of TEXTOS) assert.doesNotMatch(t, prohibido, t.slice(0, 80));
  });

  test('lo irreversible no se devuelve: toda mención de devolver grado de polimerización o vida va NEGADA', () => {
    // «restituye la rigidez dieléctrica del aceite» es cierto y recuperable; lo
    // prohibido es prometer el grado de polimerización o la vida consumida.
    const re = /(restitu\w*|recuper\w*|devuel\w*|devolver)\s+(?:\S+\s+){0,4}?(el grado de polimerizaci|la vida|vida)/gi;
    for (const t of TEXTOS) {
      for (const m of t.matchAll(re)) {
        const antes = t.slice(Math.max(0, m.index - 14), m.index);
        assert.match(antes, /\b(sin|no|ni)\b/i, 'promesa sin negar: «' + t.slice(m.index - 14, m.index + m[0].length) + '»');
      }
    }
  });
});

describe('Cómo se arma el texto', () => {
  const EQ = { matricula: 'T1-PRUEBA', mva: 30, subestacion: 'SUBESTACION DE PRUEBA', cond_int: 3 };
  const practica = (cod) => {
    const s = SUBS.find((x) => x.codigo === cod);
    return { id: cod, txt: s.nombre };
  };

  test('sin prácticas escogidas NO sale nada: ni apertura, ni cierre, ni aviso (`99 §96`)', () => {
    for (const vacia of [[], null, undefined]) assert.equal(redaccionBeneficiosPracticas(EQ, null, vacia), '');
  });

  test('con una práctica, sale la apertura, su renglón y el cierre', () => {
    const t = redaccionBeneficiosPracticas(EQ, null, [practica('SUB-C3-01')]);
    assert.ok(t.startsWith('El transformador de potencia T1-PRUEBA'));
    assert.ok(t.includes(BENEFICIO_PRACTICA['SUB-C3-01'].beneficio));
    assert.ok(t.endsWith(CIERRE_BENEFICIOS));
  });

  test('la apertura se llena con matrícula, potencia y subestación', () => {
    const t = redaccionBeneficiosPracticas({ ...EQ, mva: 12.5 }, null, [practica('SUB-C3-01')]);
    assert.ok(!/\{(MATRICULA|MVA|SUB)\}/.test(t));
    if (APERTURA_BENEFICIOS.includes('{MATRICULA}')) assert.ok(t.includes('T1-PRUEBA'));
    if (APERTURA_BENEFICIOS.includes('{MVA}')) assert.ok(t.includes('12,5'));
    if (APERTURA_BENEFICIOS.includes('{SUB}')) assert.ok(t.includes('SUBESTACION DE PRUEBA'));
  });

  test('un renglón por práctica, en el orden del MO.00418 y SIN subtítulos de macroactividad (`99 §97`)', () => {
    const t = redaccionBeneficiosPracticas(EQ, null,
      [practica('SUB-C4-06'), practica('SUB-C3-05'), practica('SUB-C3-01'), practica('SUB-C2-01')]);
    for (const macro of new Set(SUBS.map((s) => s.macro))) {
      assert.ok(!t.split('\n').includes(macro), 'subtítulo que no debe salir: ' + macro);
    }
    const partes = t.split('\n\n');
    assert.equal(partes.length, 3, 'apertura, renglones y cierre');
    const renglones = partes[1].split('\n');
    assert.equal(renglones.length, 4);
    assert.ok(renglones.every((r) => r.startsWith('· ')));
    const i = (n) => t.indexOf('· ' + n + ' —');
    assert.ok(i(SUBS.find((s) => s.codigo === 'SUB-C2-01').nombre) < i('Corrección de fugas por accesorios'));
    assert.ok(i('Corrección de fugas por accesorios') < i('Mantenimiento preventivo OLTC/NLTC'));
    assert.ok(t.includes(BENEFICIO_PRACTICA['SUB-C4-06'].beneficio));
  });

  test('una acción que no está en el catálogo sale [PENDIENTE], no con un beneficio inventado', () => {
    const t = redaccionBeneficiosPracticas(EQ, null, [{ id: 'X', txt: 'Acción registrada rara' }]);
    assert.match(t, /· Acción registrada rara — \[PENDIENTE: beneficio de esta acción/);
  });

  test('«Pruebas eléctricas» existe en C1 y en C2: se resuelve por la condición del equipo', () => {
    assert.equal(codigoDePractica({ txt: 'Pruebas eléctricas' }, 1), 'SUB-PSM-02');
    assert.equal(codigoDePractica({ txt: 'Pruebas eléctricas' }, 2), 'SUB-C2-05');
    assert.equal(codigoDePractica({ txt: 'pruebas electricas' }, 2), 'SUB-C2-05');
    assert.equal(codigoDePractica({ txt: 'nada' }, 2), null);
  });

  test('sin potencia ni matrícula, el hueco se declara', () => {
    const t = redaccionBeneficiosPracticas({ subestacion: 'X', cond_int: 3 }, null, [practica('SUB-C3-01')]);
    if (APERTURA_BENEFICIOS.includes('{MVA}')) assert.match(t, /\[PENDIENTE: POTENCIA\]/);
    if (APERTURA_BENEFICIOS.includes('{MATRICULA}')) assert.match(t, /\[PENDIENTE: MATRÍCULA\]/);
  });
});
