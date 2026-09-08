// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La tensión terciaria llega al clasificador
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El tablero de Fichas Técnicas mostraba 39 discrepancias sobre el
// parque real. 30 de ellas NO eran del registro: `normalizarEquipo`
// buscaba la tensión terciaria en `kv_terc`, en la raíz y en
// `placa.*`, y en el documento v2 no está en ninguno de los tres —
// vive en `electrico.tension_terciaria_kv`. La proyección v1 sube al
// nivel raíz la primaria y la secundaria, pero NO la terciaria.
//
// Consecuencia: `kvTerc` era null para los 206 equipos, y como
// `clasificarUC` decide tridevanado/bidevanado SOLO por ella
// (`const tri = kvt != null && kvt > 0`), el parque entero se
// clasificaba como bidevanado. Aceptar esas «discrepancias» habría
// degradado 30 tridevanados reales a una familia de Unidades
// Constructivas de menor valor de reposición.
//
// Estas pruebas fijan la lectura por las cuatro rutas y —lo que de
// verdad importa— que un tridevanado con su terciaria registrada NO
// se clasifique como bidevanado.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEquipo } from '../assets/js/ui/fichas/panel.js';

/** Documento v2 tal y como llega de Firestore: la terciaria SOLO en `electrico`. */
function docV2({ terciaria = null } = {}) {
  return {
    id: 'tx-bayunca',
    codigo: 'TX-BYC',
    matricula: 'T1A-A/M-BYC',
    subestacion: 'BAYUNCA',
    potencia_kva: 60000,
    // La proyección v1 sube estas dos a la raíz…
    tension_primaria_kv: 66,
    tension_secundaria_kv: 34.5,
    identificacion: { codigo: 'TX-BYC', nombre: 'Bayunca T1', uucc: 'N4T18' },
    // …pero la terciaria se queda aquí dentro, y solo aquí.
    electrico: {
      tension_primaria_kv: 66,
      tension_secundaria_kv: 34.5,
      tension_terciaria_kv: terciaria
    }
  };
}

describe('normalizarEquipo — la tensión terciaria llega al clasificador', () => {

  // 🔒 EL INVARIANTE: es el caso real de BAYUNCA, BOSTON, EL CARMEN,
  // CODAZZI, MONTERÍA… 60 MVA a 66 kV con terciario de 13,8 kV.
  test('un tridevanado con terciaria en `electrico` NO se clasifica como bidevanado', () => {
    const e = normalizarEquipo(docV2({ terciaria: 13.8 }), 0);
    assert.equal(e.uucc_calculada, 'N4T18', 'debe caer en la familia TRIdevanado');
    assert.equal(e.uucc_registrada, 'N4T18');
    assert.equal(e.estado, 'CONCORDANTE',
      'con el dato completo, el registro y la norma coinciden: no es una discrepancia');
  });

  // La contra-prueba. Sin ella, una regresión que devolviera siempre
  // «tridevanado» pasaría el test de arriba sin que nadie se entere.
  test('sin terciaria SÍ es bidevanado, y entonces la discrepancia es real', () => {
    const e = normalizarEquipo(docV2({ terciaria: null }), 0);
    assert.equal(e.uucc_calculada, 'N4T8', 'sin tercer devanado, familia BIdevanado');
    assert.equal(e.estado, 'DISCREPANCIA');
  });

  test('una terciaria en 0 no cuenta como tercer devanado', () => {
    // «0» es el relleno habitual de «no tiene». Si contara, un bidevanado
    // saltaría a la familia tridevanado y a un presupuesto mayor.
    const e = normalizarEquipo(docV2({ terciaria: 0 }), 0);
    assert.equal(e.uucc_calculada, 'N4T8');
  });

  describe('las cuatro rutas de lectura siguen funcionando', () => {
    const casos = [
      { nombre: 'kv_terc (listado adjunto)', doc: { kv_terc: 13.8 } },
      { nombre: 'raíz tension_terciaria_kv', doc: { tension_terciaria_kv: 13.8 } },
      { nombre: 'electrico.tension_terciaria_kv (documento v2)', doc: { electrico: { tension_terciaria_kv: 13.8 } } },
      { nombre: 'placa.tension_terciaria_kv (fixtures antiguos)', doc: { placa: { tension_terciaria_kv: 13.8 } } }
    ];
    for (const c of casos) {
      test(c.nombre, () => {
        const e = normalizarEquipo({
          potencia_kva: 60000, tension_primaria_kv: 66,
          identificacion: { uucc: 'N4T18' }, ...c.doc
        }, 0);
        assert.equal(e.uucc_calculada, 'N4T18', 'la terciaria debe llegar al clasificador');
      });
    }
  });

  // La primaria y la secundaria hoy llegan por la raíz. Se leen también
  // desde `electrico` para que el día que la proyección v1 deje de
  // subirlas esto no se caiga en silencio.
  test('la primaria se lee también desde `electrico` si no está en la raíz', () => {
    const e = normalizarEquipo({
      potencia_kva: 60000,
      identificacion: { uucc: 'N4T18' },
      electrico: { tension_primaria_kv: 66, tension_terciaria_kv: 13.8 }
    }, 0);
    assert.equal(e.nivel, 'N4', 'sin primaria no habría nivel y no se podría clasificar');
    assert.equal(e.uucc_calculada, 'N4T18');
  });
});
