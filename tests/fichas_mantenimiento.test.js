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
  // se hace con él. El alcance ofrece TRES propuestas por banda; los beneficios,
  // una. Las quince del alcance son lo que el Ingeniero pidió poder escoger.
  test('el alcance trae tres propuestas por condición y los beneficios una', () => {
    for (const c of [1, 2, 3, 4, 5]) {
      assert.equal(ALCANCE_MTTO_OPC.filter((o) => o.cond === c).length, 3,
        `la condición ${c} no tiene sus tres propuestas de alcance`);
      assert.equal(BENEF_MTTO_OPC.filter((o) => o.cond === c).length, 1);
    }
    assert.equal(ALCANCE_MTTO_OPC.filter((o) => o.cond != null).length, 15);
  });

  test('las tres de cada banda son A, B y C, y no se repiten', () => {
    for (const c of [1, 2, 3, 4, 5]) {
      const ks = ALCANCE_MTTO_OPC.filter((o) => o.cond === c)
        .map((o) => (o.t.match(/^C\d·([ABC])/) || [])[1]);
      assert.deepEqual(ks, ['A', 'B', 'C'], `la condición ${c} no ofrece las tres variantes`);
      const textos = new Set(ALCANCE_MTTO_OPC.filter((o) => o.cond === c).map((o) => o.v));
      assert.equal(textos.size, 3, 'dos variantes de la misma banda son el mismo texto');
    }
  });

  test('las bandas van en orden y la automática cierra', () => {
    const conds = ALCANCE_MTTO_OPC.filter((o) => o.cond != null).map((o) => o.cond);
    assert.deepEqual([...new Set(conds)], [1, 2, 3, 4, 5]);
    assert.equal(ALCANCE_MTTO_OPC[ALCANCE_MTTO_OPC.length - 1].auto, 'alcance_mtto');
    assert.equal(BENEF_MTTO_OPC[BENEF_MTTO_OPC.length - 1].auto, 'beneficios_mtto');
  });

  // La lista es plegable: si la etiqueta no cabe de un vistazo, no sirve.
  test('las etiquetas son cortas y dicen de qué banda y variante son', () => {
    for (const o of [...ALCANCE_MTTO_OPC, ...BENEF_MTTO_OPC]) {
      assert.ok(o.t.length <= 42, `etiqueta demasiado larga para un desplegable: «${o.t}»`);
    }
    for (const o of ALCANCE_MTTO_OPC.filter((x) => x.cond != null)) {
      assert.match(o.t, /^C[1-5]·[ABC] · /, `«${o.t}» no dice su banda y variante`);
    }
  });

  // ── El hueco de las acciones ────────────────────────────────
  // La plantilla ENMARCA; la lista de actividades la pone el Ingeniero marcando
  // en la ficha. Que el hueco esté exactamente una vez es lo que hace que el
  // texto sea específico sin fabricar un plan.
  test('cada plantilla de alcance deja el hueco de las acciones, una sola vez', () => {
    for (const o of ALCANCE_MTTO_OPC.filter((x) => x.v)) {
      const n = (o.v.match(/\{ACCIONES\}/g) || []).length;
      assert.equal(n, 1, `«${o.t}» tiene ${n} huecos {ACCIONES}`);
    }
  });

  // 🔒 LA TRAMPA QUE CAZÓ LA CRÍTICA ADVERSARIAL: «comprende {ACCIONES},
  // ejecutadas sobre los subsistemas…» se lee bien con la lista de ejemplo y se
  // rompe con la real — «comprende muestreo de aceite, ejecutadas sobre…».
  // Un participio o adjetivo concordado justo detrás del hueco depende del
  // género y del número de una lista que cambia con cada equipo.
  test('detrás del hueco no queda un participio que tenga que concordar', () => {
    const trampa = /\{ACCIONES\}[,;]?\s+(?:[a-záéíóúñ]+(?:adas|idas|ados|idos))\b/;
    for (const o of ALCANCE_MTTO_OPC.filter((x) => x.v)) {
      assert.ok(!trampa.test(o.v),
        `«${o.t}» concuerda con la lista y se romperá en cuanto cambie: ` +
        (o.v.match(trampa) || [''])[0]);
    }
  });

  test('al sustituir una sola acción el texto sigue siendo legible', () => {
    for (const o of ALCANCE_MTTO_OPC.filter((x) => x.v)) {
      const rendido = o.v.replace('{ACCIONES}', 'muestreo de aceite');
      assert.ok(!/\{|\}/.test(rendido.replace(/\{(MVA|SUB)\}/g, '')),
        `«${o.t}» deja marcadores sin resolver`);
      assert.ok(!/\s,|\s\./.test(rendido), `«${o.t}» deja un espacio antes de la puntuación`);
    }
  });

  const escritas = [...ALCANCE_MTTO_OPC, ...BENEF_MTTO_OPC].filter((o) => o.v);

  // 🔒 EL INVARIANTE MÁS CARO: un documento de mantenimiento que proponga
  // reponer el activo es el documento equivocado, y se firma igual.
  // 🔒 EL INVARIANTE, reescrito por orden del Ingeniero (2026-09-09): «todo lo
  // referente a inversión queda en PI». Este documento programa mantenimiento;
  // ninguna de sus cinco bandas propone reponer, reemplazar ni retirar el
  // activo — ni siquiera la condición 5, que antes sí lo hacía. Lo que la
  // condición 5 hace ahora es SOSTENER hasta la salida y remitir la decisión.
  test('ninguna banda propone la inversión: eso es del PI', () => {
    const propone = /(?:se ejecuta|comprende|se propone|el alcance)[^.]{0,90}\b(reposici[óo]n del|reemplazo del|retiro programado|salida ordenada de servicio)/i;
    for (const o of escritas) {
      assert.ok(!propone.test(o.v), `«${o.t}» propone inversión, y eso vive en el PI`);
    }
  });

  test('la condición 5 remite la decisión al PI en lugar de tomarla', () => {
    const a5 = ALCANCE_MTTO_OPC.filter((o) => o.cond === 5);
    assert.equal(a5.length, 3);
    assert.ok(a5.some((o) => /propuesta a Plan de Inversión/i.test(o.v)),
      'alguna de las tres debe nombrar el documento al que se remite la decisión');
    for (const o of escritas.filter((x) => x.cond === 5)) {
      assert.match(o.v, /sosten|salida|expediente|Plan de Inversión/i,
        `«${o.t}» debe tratar el sostenimiento del activo hasta su salida`);
    }
  });

  test('la condición 4 documenta su costo, pero no lo compara contra la reposición', () => {
    // Comparar el costo de intervenir contra el valor de reposición es la
    // pregunta del PI. Aquí se documenta lo ejecutado y se remite.
    const b4 = BENEF_MTTO_OPC.find((o) => o.cond === 4);
    assert.ok(!/valor de reposición/i.test(b4.v));
    assert.match(b4.v, /propuesta a Plan de Inversión/i);
  });

  // La categoría INV tiene que seguir siendo reconocible: de ella depende que
  // la hoja pueda dejar esas acciones fuera del selector.
  test('las acciones de inversión siguen marcándose como tales', async () => {
    const { accionesDeEquipo } = await import('../assets/js/ui/fichas/panel.js');
    const disp = accionesDeEquipo({ potencia_kva: 20000, salud_actual: { hi_final: 5 } });
    assert.ok(disp.some((a) => a.cat === 'INV'),
      'si dejara de marcarse, el filtro de la hoja quedaría ciego');
    assert.ok(disp.some((a) => a.cat !== 'INV'),
      'y deben quedar acciones de sostenimiento que sí se pueden contratar aquí');
  });

  test('ninguna arranca con el encabezado del PI', () => {
    for (const o of escritas) {
      assert.ok(!/^El alcance del proyecto (consiste|comprende) en la (adquisici|reposici)/i.test(o.v),
        `«${o.t}» abre como abre el PI`);
    }
  });

  test('no fabrican cifras: los únicos huecos son {MVA}, {SUB} y {ACCIONES}', () => {
    const validos = new Set(['{MVA}', '{SUB}', '{ACCIONES}']);
    for (const o of escritas) {
      for (const m of (o.v.match(/\{[A-Z_]+\}/g) || [])) {
        assert.ok(validos.has(m), `«${o.t}» usa el marcador ${m}, que nadie resuelve`);
      }
    }
  });

  // «transformador de {MVA} de la subestación» rinde «transformador de 60 de la
  // subestación»: `mvaTxt` devuelve el número, no la unidad.
  test('la potencia nunca queda sin su unidad', () => {
    for (const o of escritas) {
      assert.ok(!/\{MVA\}(?! MVA)/.test(o.v), `«${o.t}» deja la potencia sin unidad`);
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

// ══════════════════════════════════════════════════════════════
// Una sola dirección de lectura: siempre de 1 a 5
// ──────────────────────────────────────────────────────────────
// La escala de salud aparece en cuatro sitios del módulo —la banda
// del tablero, la matriz de Analítica gerencial, la hoja «Salud y
// riesgo» y el desplegable de redacciones—. Las matrices se
// pintaban de 5 arriba a 1 abajo, que es la convención de una
// matriz de riesgo, y el resto de 1 a 5. Leerlas en direcciones
// opuestas dentro del mismo módulo obliga a releer el encabezado
// cada vez, y ahí es donde alguien confunde la banda buena con la
// mala. Orden del Ingeniero (2026-09-09): de 1 a 5 en todas.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';

describe('El orden de la escala de salud', () => {

  const FUENTES = [
    'assets/js/ui/fichas/panel.js',
    'assets/js/ui/fichas/vistas-gerenciales.js',
    'assets/js/domain/matriz_riesgo.js'
  ];

  // 🔒 EL INVARIANTE: ninguna enumeración de la escala va al revés.
  test('ninguna fuente recorre las condiciones de 5 a 1', () => {
    for (const f of FUENTES) {
      const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      assert.ok(!/\[\s*5\s*,\s*4\s*,\s*3\s*,\s*2\s*,\s*1\s*\]/.test(src),
        `${f} todavía enumera la escala de 5 a 1`);
    }
  });

  test('y sí la recorren de 1 a 5', () => {
    for (const f of FUENTES) {
      const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      assert.match(src, /\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*\]/,
        `${f} debería recorrer la escala de 1 a 5`);
    }
  });

  // El desplegable agrupa por banda: esas bandas también van en orden, y la
  // del equipo se distingue por su rótulo en vez de saltarse la fila.
  test('las bandas del desplegable salen en orden, no la del equipo primero', () => {
    const src = readFileSync(new URL('../assets/js/ui/fichas/panel.js', import.meta.url), 'utf8');
    assert.ok(!/\(a === rec \? -1 : b === rec \? 1 : a - b\)/.test(src),
      'el orden del desplegable seguía sacando de sitio la banda del equipo');
    assert.match(src, /\.sort\(\(a, b\) => a - b\)/);
  });
});

// ══════════════════════════════════════════════════════════════
// Qué significa cada banda para el riesgo y el suministro
// ──────────────────────────────────────────────────────────────
// «Pobre» no le dice a nadie qué pasa con el servicio. Cada banda
// lleva ahora una definición que sí lo dice — y que tiene una
// trampa evidente: la condición es UN SOLO EJE, la probabilidad
// de falla. La consecuencia la aporta la criticidad por usuarios
// aguas abajo. Una definición que dijera «riesgo alto» a secas
// sería FALSA: un activo en condición 5 que alimenta a poca gente
// cae en una celda de menor prioridad que uno en condición 4 que
// alimenta a una ciudad. Estas pruebas fijan eso, y que ninguna
// prometa lo que el índice no calcula.
// ══════════════════════════════════════════════════════════════

import {
  DEFINICION_CONDICION, definicionCondicion, NOMBRE_CONDICION
} from '../assets/js/ui/fichas/ficha-tecnica.js';

describe('Definición de cada estado de salud', () => {

  const TODAS = [1, 2, 3, 4, 5].map((c) => ({ c, d: DEFINICION_CONDICION[c] }));

  test('hay una por banda y ninguna vacía', () => {
    for (const { c, d } of TODAS) {
      assert.ok(d && d.length > 40, `la condición ${c} no tiene definición`);
    }
    assert.equal(definicionCondicion(null), '', 'sin dato no se inventa una');
    assert.equal(definicionCondicion(9), '');
  });

  // Van en una fila de tabla y en un tooltip: si no se leen de un vistazo,
  // no sirven para lo que se hicieron.
  test('se leen de un vistazo', () => {
    for (const { c, d } of TODAS) {
      const n = d.split(/\s+/).length;
      assert.ok(n <= 30, `la condición ${c} tiene ${n} palabras`);
    }
  });

  // 🔒 LA TRAMPA PRINCIPAL: la condición no es el riesgo, es un eje de dos.
  test('ninguna llama «riesgo» a la condición por sí sola', () => {
    for (const { c, d } of TODAS) {
      assert.ok(!/riesgo (alto|bajo|medio|crítico|muy alto|elevado)/i.test(d),
        `la condición ${c} presenta la banda como si fuera el riesgo completo`);
    }
  });

  test('todas atribuyen la consecuencia a la criticidad', () => {
    for (const { c, d } of TODAS) {
      assert.match(d, /criticidad/i, `la condición ${c} olvida el segundo eje`);
    }
  });

  // …pero no con la misma muletilla cinco veces: eso es un sello, no una idea.
  test('y cada una le da a la criticidad una función distinta', () => {
    const frases = TODAS.map(({ d }) => (d.match(/[^.;]*criticidad[^.;]*/i) || [''])[0].trim());
    assert.equal(new Set(frases).size, 5, 'la cláusula de criticidad se repite entre bandas');
  });

  test('no prometen lo que el índice no calcula', () => {
    // El HI no modela la red: no hay topología, ni N-1, ni transferencias, y la
    // cargabilidad pesa 0,05 en el ponderado. Una banda que viene de DGA (0,35)
    // y EDAD (0,30) no dice nada sobre si se puede transferir carga.
    for (const { c, d } of TODAS) {
      assert.ok(!/transferencia|contingencia|N-1|despacho|topolog/i.test(d),
        `la condición ${c} promete comportamiento de red que el índice no modela`);
    }
  });

  // Con EDAD pesando 0,30 un activo puede caer en la banda superior con
  // deterioro perfectamente detectable en una variable.
  test('la banda 1 no afirma que no haya deterioro', () => {
    assert.ok(!/sin deterioro/i.test(DEFINICION_CONDICION[1]),
      'el índice es ponderado: «sin deterioro» es una afirmación que no sostiene');
  });

  // La 4 mantiene el foco de mejora en su estrategia (recuperación de
  // aislamientos está en su línea base): no puede declarar cerrada la recuperación.
  test('la banda 4 no declara agotada la recuperación', () => {
    assert.ok(!/ya no recupera|no recupera margen|irrecuperable/i.test(DEFINICION_CONDICION[4]),
      'su estrategia todavía incluye mejora, y su línea base recuperación de aislamientos');
    assert.match(DEFINICION_CONDICION[4], /irreversible/i, 'pero sí dice qué se perdió');
  });

  test('las etiquetas oficiales del MO.00418 no se tocaron', () => {
    assert.deepEqual(NOMBRE_CONDICION,
      { 1: 'Muy bueno', 2: 'Bueno', 3: 'Medio', 4: 'Pobre', 5: 'Muy pobre' });
  });
});
