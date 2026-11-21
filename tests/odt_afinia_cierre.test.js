// Firma de ODT Afinia · CIERRE (decisiones del Ingeniero del 2026-11-21), dominio puro:
//   · compositor: sin compositor = @1 (mismos bytes que siempre); @2 estampa el N.º en «ODT GENERADA N°»;
//   · FECHA CIERRE = la fecha prevista de la orden;
//   · REEMPLAZAR (solo LISTA, con motivo) y REGISTRAR EL CIERRE EN AFINIA (solo LISTA, fecha y soporte);
//   · descargas en LISTA y CERRADA; N.º libre tras ANULADA o REEMPLAZADA.
// Cada regla en las dos direcciones (pasa lo correcto, se niega lo incorrecto). Datos SINTÉTICOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPOSITOR_V1, COMPOSITOR_V2, COMPOSITORES, COMPOSITOR_VIGENTE, versionDeComposicion, estampaGenerada,
  ETIQUETA_GENERADA, textoGenerada, fechaCierreDe, MSG_RECARGAR, MSG_RECARGAR_FIRMA,
  cierreDelResponsable, errorFirmaAlDia, avisoAntesDeFirmar,
  ESTADOS_CIERRE, ETIQUETA_ESTADO_CIERRE, ESTADOS_DESCARGABLES, ESTADOS_QUE_LIBERAN_NRO,
  puedeDescargar, liberaNro, puedeReemplazar, puedeCerrarAfinia, esFinal, etiquetaEstado, mensajeNroOcupado,
  cambioReemplazar, SOPORTE, errorCierreAfinia, cambioCerrarAfinia, textoCierreAfinia
} from '../assets/js/domain/odt_afinia_cierre.js';
import { COMPOSITOR, ESTADOS } from '../assets/js/domain/odt_afinia_rutas.js';

const odt = (estado, rev = 2, fechaTrabajo = '10/11/2026') => ({ nro: '00000001', estado, rev, fechaTrabajo });
const por = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba' };
const AHORA = new Date('2026-11-21T15:00:00Z');   // 21/11/2026 en Bogotá

describe('compositor: la versión la decide el acto del Responsable', () => {
  test('@1 y @2; el vigente es @2 y coincide con rutas.COMPOSITOR', () => {
    assert.deepEqual([...COMPOSITORES], ['odt-afinia@1', 'odt-afinia@2']);
    assert.equal(COMPOSITOR_VIGENTE, COMPOSITOR_V2);
    assert.equal(COMPOSITOR, COMPOSITOR_VIGENTE);
  });
  test('sin compositor (llamada de antes) = @1; @1 y @2 tal cual; otro → lanza', () => {
    assert.equal(versionDeComposicion(undefined), COMPOSITOR_V1);
    assert.equal(versionDeComposicion(null), COMPOSITOR_V1);
    assert.equal(versionDeComposicion('odt-afinia@1'), COMPOSITOR_V1);
    assert.equal(versionDeComposicion('odt-afinia@2'), COMPOSITOR_V2);
    for (const x of ['odt-afinia@3', '', 'ODT-AFINIA@2', 2]) assert.throws(() => versionDeComposicion(x), /Compositor desconocido/, String(x));
  });
  test('solo @2 estampa «ODT GENERADA N°»', () => {
    assert.equal(estampaGenerada(COMPOSITOR_V2), true);
    assert.equal(estampaGenerada(COMPOSITOR_V1), false);
    assert.equal(estampaGenerada(undefined), false);
  });
  test('textoGenerada y fecha de cierre = la prevista', () => {
    assert.equal(ETIQUETA_GENERADA, 'ODT GENERADA N°');
    assert.equal(textoGenerada('00000001'), 'ODT GENERADA N° 00000001');
    assert.throws(() => textoGenerada('1234567'), /8 dígitos/);
    assert.equal(fechaCierreDe(odt(ESTADOS.PENDIENTE_RESPONSABLE)), '10/11/2026');
    assert.equal(fechaCierreDe({}), null);
    assert.match(MSG_RECARGAR, /Recargue/);
  });
  test('recargar: el mensaje general no habla de «preparar» (Ver, Descargar, Publicar, Reemplazar, Cerrar); el de la firma sí', () => {
    assert.match(MSG_RECARGAR, /Cmd \+ Shift \+ R .*vuelva a intentarlo\.$/);
    assert.ok(!/prepar/i.test(MSG_RECARGAR), MSG_RECARGAR);
    assert.match(MSG_RECARGAR_FIRMA, /Cmd \+ Shift \+ R .*prepare de nuevo su firma\.$/);
  });
});

describe('pie del Responsable con @2: {si, fecha, generada} y la guarda de caché mezclada (L-102)', () => {
  const nro = '00000001';
  const nuevoResp = () => ({ rol: 'responsable', compositor: 'odt-afinia@2', nro, cierre: { si: true, fecha: '10/11/2026', generada: nro } });
  test('cierreDelResponsable: X en SI, la fecha que se le pasa y el N.º de la ODT; sin N.º válido lanza', () => {
    assert.deepEqual(cierreDelResponsable({ nro }, '10/11/2026'), { si: true, fecha: '10/11/2026', generada: nro });
    assert.throws(() => cierreDelResponsable({ nro: '123' }, '10/11/2026'), /8 dígitos/);
    assert.throws(() => cierreDelResponsable(null, '10/11/2026'), /8 dígitos/);
  });
  test('errorFirmaAlDia: la copia y el acto nuevos pasan (Responsable y AZT)', () => {
    assert.equal(errorFirmaAlDia(nuevoResp()), null);
    assert.equal(errorFirmaAlDia(nuevoResp(), nuevoResp()), null);
    const azt = { rol: 'azt', compositor: 'odt-afinia@2', nro };
    assert.equal(errorFirmaAlDia(azt, { ...azt }), null);
  });
  test('errorFirmaAlDia: una copia de un preparar.js viejo (sin compositor, cierre de 2 claves) → recargar y preparar de nuevo', () => {
    const vieja = { rol: 'responsable', nro, cierre: { si: true, fecha: '10/11/2026' } };
    assert.equal(errorFirmaAlDia(vieja), MSG_RECARGAR_FIRMA);
    assert.equal(errorFirmaAlDia({ ...vieja, compositor: 'odt-afinia@2' }), MSG_RECARGAR_FIRMA, 'con compositor pero sin «ODT GENERADA»');
    assert.equal(errorFirmaAlDia({ rol: 'azt', nro }), MSG_RECARGAR_FIRMA, 'el AZT sin compositor tampoco');
    assert.equal(errorFirmaAlDia({ ...nuevoResp(), compositor: 'odt-afinia@1' }), MSG_RECARGAR_FIRMA, 'ninguna firma nueva con @1');
    assert.equal(errorFirmaAlDia(null), MSG_RECARGAR_FIRMA);
  });
  test('errorFirmaAlDia: copia nueva pero acto de un odt_afinia_lotes.js viejo (compositor @2 del rutas nuevo, cierre SIN generada) → no se escribe', () => {
    const actoViejo = { rol: 'responsable', compositor: 'odt-afinia@2', nro, cierre: { si: true, fecha: '10/11/2026' } };
    assert.equal(errorFirmaAlDia(nuevoResp(), actoViejo), MSG_RECARGAR_FIRMA);
    assert.equal(errorFirmaAlDia(nuevoResp(), { ...actoViejo, cierre: { ...actoViejo.cierre, generada: '00000002' } }), MSG_RECARGAR_FIRMA, 'otro N.º');
    assert.equal(errorFirmaAlDia(nuevoResp(), { ...actoViejo, compositor: 'odt-afinia@1', cierre: nuevoResp().cierre }), MSG_RECARGAR_FIRMA, 'rutas viejo: @1');
  });
  test('avisoAntesDeFirmar: con la prevista ya cumplida (o hoy) no hay aviso; en el futuro se le dice desde cuándo; inválida → que avise', () => {
    assert.equal(avisoAntesDeFirmar({ fechaTrabajo: '21/11/2026' }, AHORA), null, 'hoy');
    assert.equal(avisoAntesDeFirmar({ fechaTrabajo: '10/11/2026' }, AHORA), null, 'pasada');
    assert.equal(avisoAntesDeFirmar({ fechaTrabajo: '22/11/2026' }, AHORA),
      'Todavía no puede firmar: la fecha prevista de la orden es el 22/11/2026. Podrá firmar y cerrar la ODT desde ese día.');
    for (const f of ['31/02/2026', '2026-11-10', undefined]) assert.match(avisoAntesDeFirmar({ fechaTrabajo: f }, AHORA), /no es una fecha válida.*Avise al administrador/, String(f));
  });
});

describe('estados nuevos: descargas y N.º libre', () => {
  test('constantes y etiquetas', () => {
    assert.deepEqual({ ...ESTADOS_CIERRE }, { CERRADA: 'CERRADA', REEMPLAZADA: 'REEMPLAZADA' });
    assert.equal(ESTADOS.CERRADA, ESTADOS_CIERRE.CERRADA);
    assert.equal(ESTADOS.REEMPLAZADA, ESTADOS_CIERRE.REEMPLAZADA);
    assert.deepEqual([...ESTADOS_DESCARGABLES], ['LISTA', 'CERRADA']);
    assert.deepEqual([...ESTADOS_QUE_LIBERAN_NRO], ['ANULADA', 'REEMPLAZADA']);
    assert.equal(ETIQUETA_ESTADO_CIERRE.CERRADA, 'Cerrada en Afinia');
    assert.equal(etiquetaEstado('CERRADA'), 'Cerrada en Afinia');
    assert.equal(etiquetaEstado('LISTA', { LISTA: 'Lista para descargar' }), 'Lista para descargar');
    assert.equal(etiquetaEstado('OTRO'), 'OTRO');
  });
  test('se descarga en LISTA y CERRADA; no en REEMPLAZADA, ANULADA ni pendiente', () => {
    for (const e of ['LISTA', 'CERRADA']) assert.equal(puedeDescargar(odt(e)), true, e);
    for (const e of ['REEMPLAZADA', 'ANULADA', 'PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE']) assert.equal(puedeDescargar(odt(e)), false, e);
    assert.equal(puedeDescargar(null), false);
  });
  test('el N.º queda libre tras ANULADA o REEMPLAZADA; con la vigente pendiente, LISTA o CERRADA, no (y se dice por qué)', () => {
    for (const e of ['ANULADA', 'REEMPLAZADA']) { assert.equal(liberaNro(e), true, e); assert.equal(mensajeNroOcupado(e), null); }
    for (const e of ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'LISTA', 'CERRADA', null]) assert.equal(liberaNro(e), false, String(e));
    assert.match(mensajeNroOcupado('LISTA'), /reemplácela/);
    assert.match(mensajeNroOcupado('CERRADA'), /cerrada en Afinia/);
    assert.match(mensajeNroOcupado('PENDIENTE_AZT'), /anúlela/);
    assert.match(mensajeNroOcupado(null), /vigente/);
  });
  test('estados finales', () => {
    for (const e of ['ANULADA', 'REEMPLAZADA', 'CERRADA']) assert.equal(esFinal(e), true, e);
    for (const e of ['LISTA', 'PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE']) assert.equal(esFinal(e), false, e);
  });
});

describe('reemplazar: solo una LISTA, con motivo de 10 a 500, quién', () => {
  test('desde LISTA pasa: REEMPLAZADA, rev+1, motivo recortado y quién tal cual', () => {
    const r = cambioReemplazar(odt('LISTA', 2), { motivo: '  El PDF publicado traía la consignación equivocada.  ', por });
    assert.equal(r.ok, true);
    assert.deepEqual(r.cambios, { estado: 'REEMPLAZADA', rev: 3, reemplazo: { motivo: 'El PDF publicado traía la consignación equivocada.', por } });
    assert.equal(puedeReemplazar(odt('LISTA')), true);
  });
  test('desde PENDIENTE_*, ANULADA, CERRADA o REEMPLAZADA se niega con su mensaje', () => {
    for (const e of ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'ANULADA', 'CERRADA', 'REEMPLAZADA']) {
      assert.equal(puedeReemplazar(odt(e)), false, e);
      const r = cambioReemplazar(odt(e), { motivo: 'Motivo suficiente de prueba', por });
      assert.equal(r.ok, false, e); assert.equal(r.codigo, 'estado', e);
    }
    assert.match(cambioReemplazar(odt('CERRADA'), { motivo: 'Motivo suficiente de prueba', por }).mensaje, /cerrada en Afinia/);
    assert.match(cambioReemplazar(odt('PENDIENTE_AZT'), { motivo: 'Motivo suficiente de prueba', por }).mensaje, /Solo una ODT LISTA/);
  });
  test('motivo corto, largo o sin quién → no; 10 y 500 exactos → sí', () => {
    const L = odt('LISTA');
    assert.equal(cambioReemplazar(L, { motivo: 'corto', por }).codigo, 'validacion');
    assert.equal(cambioReemplazar(L, { motivo: 'x'.repeat(501), por }).codigo, 'validacion');
    assert.equal(cambioReemplazar(L, { motivo: 'Motivo suficiente de prueba' }).codigo, 'validacion');
    assert.equal(cambioReemplazar(L, { motivo: 'x'.repeat(10), por }).ok, true);
    assert.equal(cambioReemplazar(L, { motivo: 'x'.repeat(500), por }).ok, true);
    // El nombre va TAL CUAL (la regla lo compara con el del perfil, también vacío).
    assert.deepEqual(cambioReemplazar(L, { motivo: 'Motivo suficiente de prueba', por: { uid: 'u' } }).cambios.reemplazo.por, { uid: 'u', nombre: '' });
  });
});

describe('registrar el cierre en Afinia: solo una LISTA; fecha entre la prevista y hoy; soporte 3-120', () => {
  const ok = { fecha: '15/11/2026', soporte: 'SOPORTE_ODT_PRUEBA_01', por, ahora: AHORA };
  test('desde LISTA pasa: CERRADA, rev+1, {fecha, soporte, por}', () => {
    const r = cambioCerrarAfinia(odt('LISTA', 2), ok);
    assert.equal(r.ok, true);
    assert.deepEqual(r.cambios, { estado: 'CERRADA', rev: 3, cierreAfinia: { fecha: '15/11/2026', soporte: 'SOPORTE_ODT_PRUEBA_01', por } });
    // Bordes: el día previsto y hoy.
    assert.equal(cambioCerrarAfinia(odt('LISTA'), { ...ok, fecha: '10/11/2026' }).ok, true);
    assert.equal(cambioCerrarAfinia(odt('LISTA'), { ...ok, fecha: '21/11/2026' }).ok, true);
    assert.equal(puedeCerrarAfinia(odt('LISTA')), true);
  });
  test('desde PENDIENTE_*, ANULADA, REEMPLAZADA o CERRADA se niega', () => {
    for (const e of ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'ANULADA', 'REEMPLAZADA', 'CERRADA']) {
      assert.equal(puedeCerrarAfinia(odt(e)), false, e);
      const r = cambioCerrarAfinia(odt(e), ok);
      assert.equal(r.ok, false, e); assert.equal(r.codigo, 'estado', e);
    }
    assert.match(cambioCerrarAfinia(odt('REEMPLAZADA'), ok).mensaje, /reemplazada/);
  });
  test('fecha futura, anterior a la prevista, inexistente o mal escrita → no; soporte corto o largo → no', () => {
    const L = odt('LISTA');
    assert.match(cambioCerrarAfinia(L, { ...ok, fecha: '22/11/2026' }).mensaje, /posterior a hoy/);
    assert.match(cambioCerrarAfinia(L, { ...ok, fecha: '09/11/2026' }).mensaje, /anterior a la fecha prevista/);
    assert.match(cambioCerrarAfinia(L, { ...ok, fecha: '31/02/2026' }).mensaje, /fecha real/);
    assert.match(cambioCerrarAfinia(L, { ...ok, fecha: '2026-11-15' }).mensaje, /dd\/mm\/aaaa/);
    assert.match(cambioCerrarAfinia(L, { ...ok, soporte: 'ab' }).mensaje, /soporte/);
    assert.match(cambioCerrarAfinia(L, { ...ok, soporte: 'S'.repeat(121) }).mensaje, /soporte/);
    assert.equal(cambioCerrarAfinia(L, { ...ok, soporte: 'S'.repeat(SOPORTE.max) }).ok, true);
    assert.equal(cambioCerrarAfinia(L, { ...ok, soporte: 'abc' }).ok, true);
    assert.equal(cambioCerrarAfinia(L, { ...ok, por: null }).codigo, 'validacion');
    assert.equal(errorCierreAfinia({ fecha: '15/11/2026', soporte: 'SOPORTE' }, { fechaTrabajo: '10/11/2026', ahora: AHORA }), null);
  });
  test('textoCierreAfinia: «Cerrada en Afinia el … · soporte … · registró …»', () => {
    assert.equal(textoCierreAfinia({ fecha: '15/11/2026', soporte: 'SOPORTE_ODT_PRUEBA_01', por }),
      'Cerrada en Afinia el 15/11/2026 · soporte SOPORTE_ODT_PRUEBA_01 · registró Admin De Prueba');
    assert.equal(textoCierreAfinia(null), '');
  });
});
