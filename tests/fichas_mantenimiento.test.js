// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El documento de Mantenimiento Especializado
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Al pulsar «Ficha» hay ahora dos documentos que se parecen en el
// papel y dicen cosas OPUESTAS: el PI propone REPONER el activo y
// el de Mantenimiento Especializado propone INTERVENIR el que
// sigue en servicio. Compartir la pantalla es barato; confundir
// los textos sale carísimo, porque son documentos que se firman.
//
// Estas pruebas fijan las tres cosas que no pueden torcerse:
//   1. cada documento guarda SU redacción (elegir en uno no pisa
//      lo que el otro ya tenía escrito), y el PI sigue intacto;
//   2. las redacciones de mantenimiento no hablan de reponer ni
//      inventan cifras: solo {MVA} y {SUB};
//   3. lo que el mantenimiento NO revierte se dice, no se calla.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOJAS_FICHA, HOJAS_SALUD, hojasDe,
  ALCANCE_OPC, BENEF_OPC, ALCANCE_MTTO_OPC, BENEF_MTTO_OPC,
  opcionesRedaccion
} from '../assets/js/ui/fichas/panel.js';
import {
  redaccionAlcanceMtto, redaccionBeneficiosMtto, modoDegradacion
} from '../assets/js/domain/fichas_diagnostico.js';

/** Equipo real de referencia: 60 MVA, 38 años, 120.000 usuarios, condición 5. */
const EQUIPO = Object.freeze({
  subestacion: 'BAYUNCA', matricula: 'T1', mva: 60,
  edad: 38, anio_fab: 1988, usuarios: 120000, cond_int: 5, cond_lbl: 'Muy pobre'
});

/** Papel despolimerizado: 2-FAL alto y la curva de Chendong lo confirma. */
const DIAG_PAPEL = Object.freeze({ fur: 3200, efur: 5, crg: 95 });
/** Aceite degradado: es el modo que el mantenimiento SÍ corrige. */
const DIAG_ACEITE = Object.freeze({ rig: 38, hum: 2.1, tif: 18.5, nn: 0.18, eadfq: 4, erig: 4 });

describe('Las hojas de cada documento', () => {

  test('el de mantenimiento lleva la hoja «Salud y riesgo»', () => {
    const ids = HOJAS_SALUD.map((h) => h.id);
    assert.ok(ids.includes('salud'), 'es la hoja que el Ingeniero pidió añadir');
    assert.equal(ids[2], 'salud',
      'va tercera: la evidencia justo después de qué se hace y para qué, no de anexo al final');
  });

  // 🔒 EL INVARIANTE que pidió el dueño: «mantén todo lo que está sin dañar nada».
  test('el PI no cambió: sus hojas son exactamente las de antes', () => {
    assert.deepEqual(HOJAS_FICHA.map((h) => h.id),
      ['ficha', 'benef', 'diagA', 'diagF', 'anexoAT', 'plan']);
    assert.ok(!HOJAS_FICHA.some((h) => h.id === 'salud'),
      'la hoja nueva es del documento nuevo; el PI se queda como estaba');
  });

  test('hojasDe enruta por documento y no se cae con uno desconocido', () => {
    assert.equal(hojasDe('salud'), HOJAS_SALUD);
    assert.equal(hojasDe('pi'), HOJAS_FICHA);
    assert.equal(hojasDe(undefined), HOJAS_FICHA, 'sin documento, el de siempre');
  });
});

describe('Catálogos de redacción — uno por documento', () => {

  // 🔒 El eje del documento de mantenimiento NO es el ángulo del argumento
  // —ese es el del PI— sino la CONDICIÓN del activo, que es lo que decide qué
  // se hace con él. Una propuesta por banda, en orden de deterioro.
  test('hay una propuesta por condición de salud, en orden', () => {
    for (const cat of [ALCANCE_MTTO_OPC, BENEF_MTTO_OPC]) {
      const conds = cat.filter((o) => o.cond != null).map((o) => o.cond);
      assert.deepEqual(conds, [1, 2, 3, 4, 5], 'faltan bandas o están desordenadas');
    }
  });

  test('la última es automática y se ancla en los datos medidos', () => {
    assert.equal(ALCANCE_MTTO_OPC[ALCANCE_MTTO_OPC.length - 1].auto, 'alcance_mtto');
    assert.equal(BENEF_MTTO_OPC[BENEF_MTTO_OPC.length - 1].auto, 'beneficios_mtto');
    assert.ok(ALCANCE_MTTO_OPC.every((o) => o.cond != null || o.auto),
      'toda opción es de una condición o es la automática');
  });

  // La lista es plegable: si la etiqueta no cabe de un vistazo, no sirve.
  test('las etiquetas son cortas y dicen la decisión, no el argumento', () => {
    for (const o of [...ALCANCE_MTTO_OPC, ...BENEF_MTTO_OPC]) {
      assert.ok(o.t.length <= 42, `etiqueta demasiado larga para un desplegable: «${o.t}»`);
    }
    assert.match(ALCANCE_MTTO_OPC[0].t, /^C1 · /);
    assert.match(ALCANCE_MTTO_OPC[4].t, /^C5 · /);
  });

  // Cada banda propone una decisión DISTINTA, no la misma con más intensidad.
  test('la progresión de decisión va de conservar a reemplazar', () => {
    const verbos = [/vigilar/i, /controlar|seguir/i, /recuperar/i, /intervenir/i, /reemplazar|retirar/i];
    ALCANCE_MTTO_OPC.filter((o) => o.cond != null).forEach((o, i) => {
      assert.match(o.t, verbos[i], `la condición ${o.cond} no anuncia su decisión`);
    });
  });

  // 🔒 Si los dos documentos compartieran la clave del estado, elegir una
  // redacción en uno borraría la del otro sin avisar.
  test('opcionesRedaccion devuelve el catálogo del campo, no el del vecino', () => {
    assert.equal(opcionesRedaccion('alcance'), ALCANCE_OPC);
    assert.equal(opcionesRedaccion('beneficios'), BENEF_OPC);
    assert.equal(opcionesRedaccion('alcance_mtto'), ALCANCE_MTTO_OPC);
    assert.equal(opcionesRedaccion('beneficios_mtto'), BENEF_MTTO_OPC);
  });

  test('un campo desconocido devuelve lista vacía, no revienta', () => {
    assert.deepEqual(opcionesRedaccion('inventado'), []);
    assert.deepEqual(opcionesRedaccion(undefined), []);
  });

  const escritas = [...ALCANCE_MTTO_OPC, ...BENEF_MTTO_OPC].filter((o) => o.v);

  // 🔒 EL INVARIANTE MÁS CARO: un documento de mantenimiento que proponga
  // reponer el activo es el documento equivocado, y se firma igual.
  // 🔒 EL INVARIANTE MÁS CARO, ahora acotado: proponer reponer es correcto en la
  // condición 5 —es su decisión— y es el documento equivocado en las otras
  // cuatro, donde el activo sigue en servicio y se interviene.
  test('solo la condición 5 propone la salida del activo', () => {
    // Lo prohibido es PROPONER que el transformador salga de servicio. No lo es
    // nombrar el reemplazo de un buje o de un componente (condición 4 lo hace, y
    // es correcto), ni usar «valor de reposición» como referencia de costo para
    // comparar contra la intervención — que es exactamente la comparación que
    // esa banda tiene que dejar documentada.
    const proponeSalida = /salida ordenada|retiro programado|reposici[óo]n por una unidad|reemplazo por otro activo/i;
    // El alcance PROPONE la salida; los beneficios describen sus efectos, con
    // otro vocabulario. Se acepta cualquiera de las dos formas en la banda 5.
    const hablaDeSalida = /salida ordenada|retiro programado|sustituci[óo]n|activo entrante|equipo retirado/i;
    for (const o of escritas) {
      if (o.cond === 5) {
        assert.match(o.v, hablaDeSalida, 'la condición 5 debe tratar la salida del activo');
      } else {
        assert.ok(!proponeSalida.test(o.v),
          `«${o.t}» propone la salida del activo, y en esa banda sigue en servicio`);
      }
    }
  });

  test('la condición 4 sí puede nombrar reemplazo de componentes y valor de reposición', () => {
    const a4 = ALCANCE_MTTO_OPC.find((o) => o.cond === 4);
    const b4 = BENEF_MTTO_OPC.find((o) => o.cond === 4);
    assert.match(a4.v, /reemplazo de bujes/i, 'es una actividad del correctivo mayor, no una reposición');
    assert.match(b4.v, /valor de reposición/i, 'la comparación de costo es el insumo de la decisión siguiente');
  });

  // El texto del PI arranca por «reposición»; el de mantenimiento, por el trabajo.
  test('ninguna arranca con el encabezado del PI', () => {
    for (const o of escritas) {
      assert.ok(!/^El alcance del proyecto (consiste|comprende) en la (adquisici|reposici)/i.test(o.v),
        `«${o.t}» abre como abre el PI`);
    }
  });

  test('no fabrican cifras: los únicos huecos son {MVA} y {SUB}', () => {
    for (const o of escritas) {
      const marcas = o.v.match(/\{[A-Z_]+\}/g) || [];
      for (const m of marcas) {
        assert.ok(m === '{MVA}' || m === '{SUB}', `«${o.t}» usa el marcador ${m}, que nadie resuelve`);
      }
    }
  });

  test('los beneficios vienen en viñetas, como los del PI', () => {
    for (const o of BENEF_MTTO_OPC.filter((x) => x.v)) {
      assert.ok(o.v.startsWith('· '), `«${o.t}» debería arrancar en viñeta`);
      assert.ok(o.v.split('\n').length >= 4, `«${o.t}» trae muy pocas viñetas`);
    }
  });

  test('el PI conserva sus redacciones intactas', () => {
    assert.equal(ALCANCE_OPC.length, 5);
    assert.equal(BENEF_OPC.length, 5);
    assert.match(ALCANCE_OPC[0].v, /reposición del transformador/,
      'el alcance del PI SÍ habla de reponer: es su razón de ser');
  });
});

describe('Redacción automática del mantenimiento (V5)', () => {

  test('el alcance parte del hallazgo medido y propone trabajo, no compra', () => {
    const t = redaccionAlcanceMtto(EQUIPO, DIAG_ACEITE);
    assert.match(t, /mantenimiento especializado/);
    assert.match(t, /BAYUNCA/);
    assert.match(t, /aceite dieléctrico/i, 'debe nombrar el hallazgo que gobierna la intervención');
    assert.ok(!/reposición|reponer/i.test(t));
  });

  // 🔒 LA REGLA QUE SOSTIENE EL DOCUMENTO: la celulosa no se recupera. Si el
  // papel está despolimerizado, prometer «recuperación» sería vender lo que
  // ningún mantenimiento entrega — y el documento se cae ante el regulador.
  test('cuando el hallazgo es el papel, dice que NO se revierte', () => {
    assert.equal(modoDegradacion(EQUIPO, DIAG_PAPEL).dominante.k, 'papel');
    const t = redaccionAlcanceMtto(EQUIPO, DIAG_PAPEL);
    assert.match(t, /NO se revierte con mantenimiento/);
    assert.match(t, /no devuelve al activo la vida de aislamiento ya consumida/);
  });

  test('y en los beneficios tampoco promete recuperar lo que no se recupera', () => {
    const b = redaccionBeneficiosMtto(EQUIPO, DIAG_PAPEL);
    assert.ok(!/Recuperación efectiva de la condición/.test(b),
      'con el papel agotado no hay recuperación que ofrecer');
    assert.match(b, /Contención del deterioro y tiempo de decisión/);
    assert.ok(!/reinicia la curva de vida/.test(b), 'eso solo lo da un activo nuevo');
  });

  test('con un hallazgo reversible sí ofrece mejora medible', () => {
    const b = redaccionBeneficiosMtto(EQUIPO, DIAG_ACEITE);
    assert.match(b, /Recuperación efectiva de la condición/);
    assert.match(b, /mejora medible del índice de salud/);
  });

  test('sin ensayos no inventa un diagnóstico', () => {
    const t = redaccionAlcanceMtto(EQUIPO, null);
    assert.match(t, /No se identifican modos de degradación activos/);
    assert.ok(!/2-FAL|etileno|acetileno/.test(t), 'no puede citar medidas que no tiene');
  });

  test('la cargabilidad al límite cambia la programación, no el diagnóstico', () => {
    const t = redaccionAlcanceMtto(EQUIPO, DIAG_PAPEL);      // crg 95 %
    assert.match(t, /95 % de su capacidad nominal/);
    assert.match(t, /indisponibilidad coordinada/);
  });

  test('sin usuarios registrados no se inventa la afectación', () => {
    const t = redaccionAlcanceMtto({ ...EQUIPO, usuarios: null }, DIAG_ACEITE);
    assert.ok(!/usuarios/.test(t));
  });
});

// ══════════════════════════════════════════════════════════════
// La evidencia no puede salir con el hueco a la vista
// ──────────────────────────────────────────────────────────────
// Las calificaciones (1–5) llegan siempre desde `salud_actual`; los
// valores MEDIDOS viven en `det`/`ensayos`, que hoy no se cargan en
// el activo. `modoDegradacion` dispara por calificación pero
// redactaba con los valores, así que en producción salía «rigidez
// dieléctrica de  kV, humedad de  %» — en un papel que se firma.
// Afecta por igual al PI (su V5 ya se emite así) y al documento de
// mantenimiento, porque los dos beben de la misma función.
// ══════════════════════════════════════════════════════════════

describe('modoDegradacion — solo se enumera lo que se midió', () => {

  // 🔒 EL INVARIANTE: ninguna evidencia con un número en blanco.
  test('sin valores de laboratorio no quedan huecos entre la cifra y la unidad', () => {
    const md = modoDegradacion(EQUIPO, { eadfq: 4 });
    assert.equal(md.dominante.k, 'aceite');
    assert.ok(!/de\s+(kV|%|mN\/m|mgKOH\/g|ppm)/.test(md.dominante.e),
      `evidencia con hueco: «${md.dominante.e}»`);
    assert.match(md.dominante.e, /calificación 4 de 5/,
      'se dice de dónde sale el hallazgo en vez de fingir una medida');
  });

  test('con parte de los valores enumera esos y calla los que faltan', () => {
    const e = modoDegradacion(EQUIPO, { eadfq: 4, rig: 38, nn: 0.18 }).dominante.e;
    assert.match(e, /rigidez dieléctrica de 38 kV/);
    assert.match(e, /0,18 mgKOH\/g/);
    assert.ok(!/humedad|tensión interfacial/.test(e), 'no se midieron: no se nombran');
  });

  test('la cargabilidad también: cifra si la hay, calificación si no', () => {
    assert.match(modoDegradacion(EQUIPO, { ecrg: 5 }).dominante.e, /calificación 5 de 5 en cargabilidad/);
    assert.match(modoDegradacion(EQUIPO, { ecrg: 5, crg: 97 }).dominante.e, /cargabilidad del 97 %/);
  });

  test('descargas parciales sin etileno no imprime un paréntesis vacío', () => {
    const e = modoDegradacion(EQUIPO, { h2: 1200 }).dominante.e;
    assert.equal(modoDegradacion(EQUIPO, { h2: 1200 }).dominante.k, 'descargas');
    assert.ok(!/\(\s*ppm\)/.test(e), `paréntesis vacío: «${e}»`);
    assert.match(e, /sin etileno relevante/);
  });

  // El PI comparte esta función: el arreglo tiene que servirle igual.
  test('el alcance del PI hereda el arreglo', async () => {
    const { redaccionAlcance } = await import('../assets/js/domain/fichas_diagnostico.js');
    const t = redaccionAlcance(EQUIPO, { eadfq: 4 });
    assert.ok(!/de\s+(kV|%|mN\/m|mgKOH\/g)/.test(t), `el PI sigue con hueco: «${t}»`);
  });
});

// ══════════════════════════════════════════════════════════════
// El veredicto de riesgo habla en castellano, no en códigos
// ──────────────────────────────────────────────────────────────
// `colorCelda` devuelve VRD/AMRL/NAR/ROJ y `COLORES_CELDA` guarda
// OBJETOS ({hex,label}), no cadenas de color. La primera versión de
// la hoja los trató como si fueran texto: el veredicto salía «VRD» y
// el fondo de la casilla, «[object Object]». Estas pruebas fijan las
// dos claves para que un cambio de vocabulario en el dominio no
// vuelva a colarse hasta la pantalla.
// ══════════════════════════════════════════════════════════════

import { COLORES_CELDA, colorCelda, NIVELES_ORDEN } from '../assets/js/domain/matriz_riesgo.js';

describe('Matriz de riesgo — el contrato que consume la hoja', () => {

  test('los códigos de color son los cuatro esperados', () => {
    assert.deepEqual(Object.keys(COLORES_CELDA).sort(), ['AMRL', 'NAR', 'ROJ', 'VRD']);
  });

  // 🔒 Si esto deja de ser un objeto con `hex`, la casilla se pinta con basura.
  test('cada color trae hex y label, no una cadena suelta', () => {
    for (const [k, v] of Object.entries(COLORES_CELDA)) {
      assert.equal(typeof v, 'object', `${k} debería ser objeto`);
      assert.match(v.hex, /^#[0-9A-Fa-f]{6}$/, `${k}.hex no es un color`);
      assert.ok(v.label && v.label.length, `${k} sin etiqueta`);
    }
  });

  test('colorCelda devuelve una de esas claves para toda la matriz', () => {
    for (const hi of [1, 2, 3, 4, 5]) {
      for (const n of NIVELES_ORDEN) {
        const c = colorCelda(hi, n);
        assert.ok(COLORES_CELDA[c], `condición ${hi} × ${n} devolvió «${c}», que no está en el catálogo`);
      }
    }
  });
});
