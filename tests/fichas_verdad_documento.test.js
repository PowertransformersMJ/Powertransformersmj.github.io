// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Lo que el documento AFIRMA tiene que ser cierto
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// La ficha técnica no es una pantalla: es un papel que se firma y
// que sustenta plata ante el regulador. Una revisión de cuatro
// lentes sobre el segmento encontró cinco sitios donde el
// documento decía cosas que no eran ciertas, todas confirmadas
// leyendo el código:
//   1. el dinero tecleado con centavos entraba multiplicado por
//      cien —y sin el signo menos— al PE.02081;
//   2. la descripción de la unidad constructiva llamaba
//      «TRANSFORMADOR TRIFASICO» a un autotransformador
//      monofásico y a un tridevanado: familias distintas, con
//      precios distintos;
//   3. el 0 que la hoja de Salud de Activos usa como «no lo sé»
//      se imprimía como un ensayo de laboratorio real;
//   4. «la afectación alcanza 0 usuarios», en el párrafo que pide
//      la inversión;
//   5. el documento de Mantenimiento Especializado abría
//      proponiendo REPOSICIÓN DEL ACTIVO, sin casilla para
//      quitarla, contra la orden del 2026-09-09 (`99 §74.20`).
// Cada prueba de aquí fija una de esas cinco.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { montoCOP, buscarUC } from '../assets/js/domain/fichas_creg_uc.js';
import { descripcionUC } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { esInversion } from '../assets/js/domain/fichas_acciones.js';
import { accionesDeEquipo, seleccionAcciones } from '../assets/js/ui/fichas/panel.js';
import {
  modoDegradacion, redaccionAlcance, redaccionBeneficios,
  redaccionAlcanceMtto, redaccionBeneficiosMtto
} from '../assets/js/domain/fichas_diagnostico.js';

describe('montoCOP — el dinero que se firma', () => {
  test('el catálogo CREG (puntos de miles, sin decimales) se lee igual que siempre', () => {
    assert.equal(montoCOP('152.592.000'), 152592000);
    assert.equal(montoCOP('48.603.000'), 48603000);
  });

  test('los centavos NO multiplican por cien la cifra', () => {
    assert.equal(montoCOP('1.000.000,50'), 1000000.50);
    assert.equal(montoCOP('$ 500.000,00'), 500000);
    assert.equal(montoCOP('1,5'), 1.5);
  });

  test('el signo menos se respeta: una variación negativa es negativa', () => {
    assert.equal(montoCOP('-100'), -100);
    assert.equal(montoCOP('-1.000.000,50'), -1000000.50);
  });

  test('sin dígitos no hay monto (y el cero sigue siendo cero)', () => {
    assert.equal(montoCOP(''), null);
    assert.equal(montoCOP('abc'), null);
    assert.equal(montoCOP(null), null);
    assert.equal(montoCOP('0'), 0);
  });

  test('los centavos se truncan a dos, no se inventan más', () => {
    assert.equal(montoCOP('1.000,12345'), 1000.12);
  });
});

describe('descripcionUC — la familia de la unidad constructiva', () => {
  test('un autotransformador monofásico NO se describe como trifásico', () => {
    const d = descripcionUC({}, 'N5T11');
    assert.match(d, /AUTOTRANSFORMADOR MONOF/,
      'la celda D36 del PE.02081 debe decir la familia real de la UC');
    assert.doesNotMatch(d, /^TRANSFORMADOR TRIFASICO/);
  });

  test('un tridevanado NO se describe como bidevanado', () => {
    assert.match(descripcionUC({}, 'N5T19'), /TRIDEVANADO TRIF/);
  });

  test('el texto sale LITERAL del catálogo, que es lo que espera un revisor CREG', () => {
    const r = buscarUC('N5T11');
    assert.equal(descripcionUC({}, 'N5T11'), String(r.fila.desc).toUpperCase());
  });

  test('sin catálogo no se afirma la familia: no se inventa el «TRIFASICO»', () => {
    const d = descripcionUC({ reg_catalogo: 'OLTC', nivel: 'N4', banda: 'hasta 10 MVA' }, 'XXX');
    assert.doesNotMatch(d, /TRIFASICO/);
    assert.match(d, /^TRANSFORMADOR \(/);
  });
});

describe('El documento de Mantenimiento NO propone inversión (99 §74.20)', () => {
  // Equipo en condición 5, que es donde la línea base trae reposición.
  const EQUIPO = { potencia_kva: 20000, cond_int: 5, subestacion: 'PRUEBA', nivel: 'N4' };

  test('la línea base de la banda 5 SÍ contiene alguna acción de inversión', () => {
    const todas = accionesDeEquipo(EQUIPO);
    assert.ok(todas.some((a) => esInversion(a.txt)),
      'si esto falla, el escenario de la prueba dejó de existir y hay que rehacerla');
  });

  test('al abrir el documento de mantenimiento, ninguna acción de inversión viene marcada', () => {
    const sel = seleccionAcciones(EQUIPO, { plan: {} }, 'alcance_mtto');
    assert.deepEqual(sel.filter((a) => esInversion(a.txt)), [],
      'sin casilla para quitarla, entraba al alcance por defecto y no se podía sacar');
  });

  test('el PI conserva sus acciones de inversión: el filtro es SOLO del otro documento', () => {
    const sel = seleccionAcciones(EQUIPO, { plan: {} });
    assert.ok(sel.some((a) => esInversion(a.txt)),
      'la propuesta a Plan de Inversión es justo donde la inversión SÍ va');
  });
});

describe('El 0 de «no lo sé» deja de imprimirse como ensayo de laboratorio', () => {
  // Aceite calificado 4 de 5 por el ensayo físico-químico, pero SIN valores de
  // laboratorio cargados: la hoja los trae en 0, que es su relleno de ausencia.
  const EQUIPO = { mva: 20, cond_int: 3, subestacion: 'PRUEBA' };
  const CEROS = { eadfq: 4, erig: 4, eic: 4, rig: 0, hum: 0, tif: 0, nn: 0 };
  const MEDIDO = { eadfq: 4, erig: 4, eic: 4, rig: 32, hum: 0, tif: 0, nn: 0 };

  const evidenciaAceite = (diag) => {
    const md = modoDegradacion(EQUIPO, diag);
    const m = md && md.todos.find((x) => x.k === 'aceite');
    return m ? m.e : '';
  };

  test('una rigidez dieléctrica de 0 kV no se imprime como medida', () => {
    const e = evidenciaAceite(CEROS);
    assert.doesNotMatch(e, /rigidez dieléctrica de 0/);
    assert.doesNotMatch(e, /tensión interfacial de 0/);
  });

  test('sin nada medido cae en su texto honesto, que ya estaba escrito', () => {
    assert.match(evidenciaAceite(CEROS), /valores de laboratorio no cargados/);
  });

  test('lo que SÍ se midió se sigue imprimiendo', () => {
    const e = evidenciaAceite(MEDIDO);
    assert.match(e, /rigidez dieléctrica de 32/);
    assert.doesNotMatch(e, /humedad de 0/);
  });
});

describe('«La afectación alcanza 0 usuarios» no se escribe', () => {
  const SIN = { mva: 150, cond_int: 4, subestacion: 'PRUEBA', usuarios: 0 };
  const CON = { mva: 150, cond_int: 4, subestacion: 'PRUEBA', usuarios: 4200 };
  const DIAG = { eadfq: 3, erig: 3, eic: 3, eherm: 2, ecrg: 3, eedad: 4, fur: 900, efur: 4 };

  const textos = (e) => [
    redaccionAlcance(e, DIAG), redaccionBeneficios(e, DIAG),
    redaccionAlcanceMtto(e, DIAG), redaccionBeneficiosMtto(e, DIAG)
  ];

  test('con 0 usuarios, ninguno de los cuatro textos lo afirma', () => {
    for (const t of textos(SIN)) {
      assert.doesNotMatch(t, /0 usuarios/,
        'el argumento de una reposición no puede decir que no afecta a nadie');
    }
  });

  test('con usuarios de verdad, la frase se sigue escribiendo', () => {
    const t = textos(CON);
    assert.ok(t.some((x) => /4\.200 usuarios/.test(x) || /4200 usuarios/.test(x)),
      'el dato real es justo lo que sustenta el documento');
  });
});
