// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Las acciones que componen el alcance
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El alcance del documento de Mantenimiento Especializado dejó de
// ser un texto cerrado: el Ingeniero marca QUÉ acciones se
// ejecutan y la redacción se compone con esa selección. Eso mete
// en un documento que se firma una lista que viene de dos sitios
// que NO valen lo mismo:
//   · lo REGISTRADO para el equipo en Salud de Activos;
//   · la LÍNEA BASE de su condición, cuando no tiene nada
//     registrado — y entonces es referencial, no un plan aprobado;
//   · el CATÁLOGO oficial de la banda, que se ofrece para añadir.
// Confundirlos es presentar como plan de récord algo que nadie
// aprobó. Estas pruebas fijan esa frontera y la composición del
// texto que sale de ella.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  accionesDisponibles, seleccionPorDefecto, prosaAcciones,
  catalogoCondicion, idAccion, normalizarAccion
} from '../assets/js/domain/fichas_acciones.js';
import { esInversion } from '../assets/js/domain/fichas_acciones.js';
import { clasificarAccion } from '../assets/js/ui/fichas/ficha-tecnica.js';
import { accionesDeEquipo, seleccionAcciones } from '../assets/js/ui/fichas/panel.js';

describe('catalogoCondicion — las subactividades oficiales de cada banda', () => {

  test('cada condición trae las suyas y ninguna vacía', () => {
    for (const c of [1, 2, 3, 4, 5]) {
      const l = catalogoCondicion(c);
      assert.ok(l.length >= 5, `la condición ${c} trae solo ${l.length} subactividades`);
      assert.ok(l.every((x) => x.nombre && x.codigo), 'toda subactividad tiene código y nombre');
    }
  });

  // 🔒 El encargo prohíbe desarrollar frecuencias de mantenimiento, y el
  // catálogo las lleva en el nombre («Muestreo de aceite (semestral)»).
  test('el nombre sale sin la periodicidad entre paréntesis', () => {
    for (const c of [1, 2, 3, 4, 5]) {
      for (const x of catalogoCondicion(c)) {
        assert.ok(!/\((semestral|anual|mensual|trimestral|quincenal)\)/i.test(x.nombre),
          `«${x.nombre}» arrastra su periodicidad`);
      }
    }
  });

  test('sin condición no hay catálogo, y no revienta', () => {
    assert.deepEqual(catalogoCondicion(null), []);
    assert.deepEqual(catalogoCondicion(undefined), []);
  });
});

describe('accionesDisponibles — de dónde sale cada renglón', () => {

  const REG = [{ s: 'INSPECCION TERMOGRAFICA', cat: 'DIAG' }, { s: 'MUESTREO DE ACEITE', cat: 'DIAG' }];

  test('lo registrado va primero y marcado como tal', () => {
    const l = accionesDisponibles(3, REG, false, clasificarAccion);
    assert.equal(l[0].origen, 'registro');
    assert.equal(l[1].origen, 'registro');
    assert.ok(l.slice(2).every((a) => a.origen === 'catalogo'));
  });

  // 🔒 EL INVARIANTE: una línea base NO es un plan registrado. Presentarla
  // como tal sería fabricar un plan aprobado que nadie aprobó.
  test('la línea base se marca distinto del registro', () => {
    const l = accionesDisponibles(3, REG, true, clasificarAccion);
    assert.ok(l.filter((a) => a.origen !== 'catalogo').every((a) => a.origen === 'base'));
    assert.ok(!l.some((a) => a.origen === 'registro'));
  });

  // 🔒 EL INVARIANTE CARO: el registro dice «PLAN DE MITIGACION POR SOBRECARGA»
  // y el catálogo «Plan de mitigación sobrecarga 90-110 %». Son la MISMA acción
  // con otra redacción; ofrecer las dos, una marcada y otra no, invita a
  // contratar dos veces el mismo trabajo en un documento que se firma.
  test('la misma acción escrita de dos formas se ofrece una sola vez', () => {
    const l = accionesDisponibles(4, [{ s: 'PLAN DE MITIGACION POR SOBRECARGA' }], true, clasificarAccion);
    const mit = l.filter((a) => /mitigaci[óo]n.*sobrecarga/i.test(a.txt));
    assert.equal(mit.length, 1, `se ofrecieron ${mit.length}: ${mit.map((x) => x.txt).join(' / ')}`);
    assert.equal(mit[0].origen, 'base', 'gana la redacción del plan del equipo');
  });

  // La contra-prueba: si el criterio fuera demasiado laxo colapsaría acciones
  // que de verdad son distintas, y el alcance perdería trabajo contratable.
  test('no colapsa acciones que solo comparten la primera palabra', () => {
    const l = accionesDisponibles(3, [], true, clasificarAccion);
    const nombres = l.map((a) => a.txt);
    for (const par of [['accesorios', 'tablero'], ['caudal de refrigeración', 'capacidad sistema']]) {
      assert.ok(nombres.some((n) => n.toLowerCase().includes(par[0])), `falta «${par[0]}»`);
      assert.ok(nombres.some((n) => n.toLowerCase().includes(par[1])), `falta «${par[1]}»`);
    }
    const c5 = accionesDisponibles(5, [], true, clasificarAccion).map((a) => a.txt);
    assert.ok(c5.some((n) => /pintura total/i.test(n)));
  });

  test('una acción que ya está registrada no se repite desde el catálogo', () => {
    const l = accionesDisponibles(3, [{ s: 'CORRECCION DE FUGAS POR ACCESORIOS' }], false, clasificarAccion);
    const fugas = l.filter((a) => /fugas/i.test(a.txt));
    assert.equal(fugas.length, 1, 'la del catálogo viene acentuada y es la misma acción');
    assert.equal(fugas[0].origen, 'registro');
  });

  // Que una subactividad sea de mitigación lo dice el catálogo, no el nombre.
  test('las de mitigación se clasifican como MIT por su marca de catálogo', () => {
    const l = accionesDisponibles(4, [], true, clasificarAccion);
    const rep = l.find((a) => /repotenciaci/i.test(a.txt));
    assert.ok(rep, 'la repotenciación es una subactividad de la condición 4');
    assert.equal(rep.cat, 'MIT');
    assert.equal(rep.mitigacion, true);
  });

  test('sin condición y sin registro, la lista queda vacía', () => {
    assert.deepEqual(accionesDisponibles(null, [], true, clasificarAccion), []);
  });

  test('los ids son estables y no dependen de la posición', () => {
    const a = accionesDisponibles(3, REG, false, clasificarAccion);
    const b = accionesDisponibles(3, [...REG].reverse(), false, clasificarAccion);
    assert.deepEqual(new Set(a.map((x) => x.id)), new Set(b.map((x) => x.id)));
    assert.equal(idAccion('Corrección de fugas'), idAccion('CORRECCION DE FUGAS'));
  });

  test('por defecto se marca lo del equipo, no el catálogo entero', () => {
    const l = accionesDisponibles(3, REG, false, clasificarAccion);
    const def = seleccionPorDefecto(l);
    assert.equal(def.length, 2, 'solo las dos del plan del equipo');
    assert.ok(l.filter((a) => a.origen === 'catalogo').every((a) => !def.includes(a.id)));
  });
});

describe('prosaAcciones — la lista tal como entra en la frase', () => {

  test('enumera en minúscula y cierra con «y»', () => {
    const t = prosaAcciones([{ txt: 'INSPECCION TERMOGRAFICA' }, { txt: 'MUESTREO DE ACEITE' },
      { txt: 'Corrección de fugas por accesorios' }]);
    assert.equal(t, 'inspeccion termografica, muestreo de aceite y corrección de fugas por accesorios');
  });

  test('una sola acción no lleva coma ni «y»', () => {
    assert.equal(prosaAcciones([{ txt: 'SECADO DE ACEITE' }]), 'secado de aceite');
  });

  // 🔒 Bajar todo a minúscula convertiría «(PI)» en «(pi)» dentro de un
  // documento oficial. Las siglas se respetan.
  test('las siglas se conservan en mayúscula', () => {
    assert.match(prosaAcciones([{ txt: 'PROPUESTA A PLAN DE INVERSION (PI)' }]), /\(PI\)$/);
    assert.match(prosaAcciones([{ txt: 'Mantenimiento preventivo OLTC/NLTC' }]), /OLTC/);
  });

  test('sin acciones devuelve cadena vacía, no un hueco raro', () => {
    assert.equal(prosaAcciones([]), '');
    assert.equal(prosaAcciones(null), '');
  });
});

describe('clasificarAccion — el catálogo viene acentuado, el registro no', () => {

  // 🔒 LA CICATRIZ: el clasificador comparaba sin normalizar, así que
  // «Regeneración aceite» del catálogo no casaba con /REGENERACION/ y caía a
  // «diagnóstico». Media docena de actividades quedaban mal categorizadas.
  test('clasifica igual con tilde y sin tilde', () => {
    assert.equal(clasificarAccion('Regeneración aceite'), 'MEJ');
    assert.equal(clasificarAccion('REGENERACION ACEITE'), 'MEJ');
    assert.equal(clasificarAccion('Corrección de fugas por accesorios'), 'CORR');
    assert.equal(clasificarAccion('Recuperación aislamientos'), 'MEJ');
  });

  // No-regresión: las cadenas que YA llegaban de Salud de Activos siguen igual.
  test('las acciones registradas de siempre no cambian de categoría', () => {
    assert.equal(clasificarAccion('PROPUESTA A PLAN DE INVERSION (PI)'), 'INV');
    assert.equal(clasificarAccion('PLAN DE MITIGACION POR SOBRECARGA'), 'MIT');
    assert.equal(clasificarAccion('RECUPERACION DE AISLAMIENTOS'), 'MEJ');
    assert.equal(clasificarAccion('CORRECCION DE FUGAS POR ACCESORIOS'), 'CORR');
    assert.equal(clasificarAccion('INSPECCION TERMOGRAFICA'), 'DIAG');
    assert.equal(clasificarAccion('INSTALACION DE UNIDAD DE TRANSFORMACION ADICIONAL'), 'INV');
  });

  // Aumentar el caudal de refrigeración no mueve capital de reposición.
  test('solo el aumento de capacidad de TRANSFORMACIÓN es inversión', () => {
    assert.equal(clasificarAccion('Aumento de capacidad de transformación'), 'INV');
    assert.equal(clasificarAccion('Aumento de capacidad sistema refrigeración'), 'MEJ');
    assert.equal(clasificarAccion('Aumento de caudal de refrigeración'), 'MEJ');
  });
});

describe('El equipo y su selección', () => {

  const EQUIPO = { potencia_kva: 60000, tension_primaria_kv: 110, salud_actual: { hi_final: 3 } };

  test('un equipo sin acciones registradas recibe la línea base de su condición', () => {
    const l = accionesDeEquipo(EQUIPO);
    assert.ok(l.length > 0);
    assert.ok(l.some((a) => a.origen === 'base'), 'sin registro, la base; y rotulada como tal');
  });

  test('la selección guardada manda sobre la de por defecto', () => {
    const disp = accionesDeEquipo(EQUIPO);
    const uno = disp[disp.length - 1].id;                 // uno del catálogo
    const sel = seleccionAcciones(EQUIPO, { plan: { acc_sel: [uno] } });
    assert.equal(sel.length, 1);
    assert.equal(sel[0].id, uno);
  });

  test('una selección vacía guardada se respeta: no se repuebla sola', () => {
    assert.deepEqual(seleccionAcciones(EQUIPO, { plan: { acc_sel: [] } }), [],
      'si el Ingeniero desmarcó todo, no se le vuelve a marcar');
  });

  test('sin nada guardado se parte del plan del equipo', () => {
    const sel = seleccionAcciones(EQUIPO, { plan: {} });
    assert.ok(sel.length > 0);
    assert.ok(sel.every((a) => a.origen !== 'catalogo'));
  });

  test('un equipo sin condición no ofrece acciones', () => {
    assert.deepEqual(accionesDeEquipo({ potencia_kva: 1000 }), []);
  });
});

// ══════════════════════════════════════════════════════════════
// Qué es inversión — y qué solo lo parece
// ──────────────────────────────────────────────────────────────
// Orden del Ingeniero (2026-09-09): «todo lo referente a inversión
// queda en PI». El documento de Mantenimiento Especializado deja
// esas acciones fuera del selector. La frontera NO puede apoyarse
// en la categoría funcional: `clasificarAccion` mandaba a «INV»
// cualquier cosa que dijera «reemplazo», y con eso el filtro se
// llevaba por delante el reemplazo de bujes y de componentes
// defectuosos — que son correctivo mayor, trabajo contratable en
// este documento. Perder trabajo real del alcance es tan grave
// como colar inversión donde no va.
// ══════════════════════════════════════════════════════════════

describe('esInversion — crear o sustituir capacidad de transformación', () => {

  test('lo que sí es inversión', () => {
    for (const t of ['Propuesta a Plan de Inversión (PI)', 'PROPUESTA A PLAN DE INVERSION (PI)',
      'Aumento de capacidad de transformación', 'Instalación unidad de transformación adicional',
      'INSTALACION DE UNIDAD DE TRANSFORMACION ADICIONAL', 'Repotenciación de unidad de transformación',
      'Reposición del transformador']) {
      assert.ok(esInversion(t), `«${t}» debería quedar fuera del documento de mantenimiento`);
    }
  });

  // 🔒 LA CONTRA-PRUEBA, que es la que de verdad protege: reemplazar un buje no
  // es reponer el activo, y sacarlo del selector le quitaría al alcance un
  // frente de trabajo real del correctivo mayor.
  test('lo que NO es inversión y se queda', () => {
    for (const t of ['Reemplazo de bushings', 'Reemplazo o reparación componentes defectuosos',
      'Movimiento estratégico de transformadores', 'Pintura total', 'Regeneración de aceite',
      'Mantenimiento OLTC con despiece', 'Retrofit de protecciones mecánicas y tableros',
      'Aumento de capacidad sistema refrigeración']) {
      assert.ok(!esInversion(t), `«${t}» es mantenimiento y debe poder contratarse aquí`);
    }
  });

  test('el clasificador ya no manda a inversión el reemplazo de un componente', () => {
    assert.equal(clasificarAccion('Reemplazo de bushings'), 'CORR');
    assert.equal(clasificarAccion('Reemplazo o reparación componentes defectuosos'), 'CORR');
    assert.equal(clasificarAccion('REPOSICION DEL TRANSFORMADOR'), 'INV');
    assert.equal(clasificarAccion('PROPUESTA A PLAN DE INVERSION (PI)'), 'INV');
  });

  test('en cada banda queda trabajo de mantenimiento contratable', () => {
    for (const c of [1, 2, 3, 4, 5]) {
      const quedan = accionesDisponibles(c, [], true, clasificarAccion)
        .filter((a) => !esInversion(a.txt));
      assert.ok(quedan.length >= 3,
        `la condición ${c} se queda con ${quedan.length} acciones tras excluir la inversión`);
    }
  });
});
