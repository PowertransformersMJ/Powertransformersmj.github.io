// Relectura de las Órdenes E/S en el tablero del contrato y en la pestaña Movimiento (2026-10-09).
// Defecto visto en producción: las órdenes se leían una vez por visita y los movimientos en vivo; al editar
// o eliminar una orden con el contrato abierto, la orden VIEJA en memoria inflaba las cifras hasta recargar.
// SOLO datos sintéticos (repositorio público).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firmaEnlazados, cambiaronEnlazados, releerAlVolver, horaCorta, textoLectura, crearRelector,
  RELEER_AL_VOLVER_MS, AGRUPAR_CAMBIOS_MS
} from '../assets/js/domain/contrato_relectura.js';
import { sanitizarMovimiento } from '../assets/js/domain/movimiento_schema.js';
import { calcularNexo } from '../assets/js/domain/ordenes_contrato_nexo.js';
import { planificarSincronizacion } from '../assets/js/domain/ordenes_movimientos_registro.js';

// ── Datos sintéticos ──
const CID = '4125000143';
const CAT = [{ codigo: 'S03', nombre: 'Motoventiladores Tipo 1 FN-063', unidad: 'Und', valor_unitario: 1000, marcas_disponibles: [] }];
const PARQUE = [{ id: 'doc-tx1', identificacion: { matricula: 'TX-1' }, ubicacion: { subestacion_nombre: 'ALFA', zona: 'BOLIVAR', departamento: 'bolivar' } }];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const orden = (o) => ({ clave: 'ENTRADA_N1', tipo: 'ENTRADA', numero: 'N1', fechaISO: '2026-03-01', creadoEn: 111, version: 1,
  zona: 'BOLIVAR', transformador: 'TX-1 · S/E ALFA', items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 3)], ...o });
const nexoDe = (ordenes, movimientos) => calcularNexo({ ordenes, catalogo: CAT, contratoId: CID, movimientos });
/** El movimiento enlazado que deja el registro automático para una orden. */
function registrado(o, codigo) {
  const p = planificarSincronizacion({ nexo: nexoDe([o], []), parque: PARQUE, catalogo: CAT, contratoId: CID }).porRegistrar[0];
  return { id: p.docId, ...sanitizarMovimiento({ ...p.payload, codigo }) };
}
const manual = (o) => ({ id: 'man-1', codigo: 'MOV-2026-0009', tipo: 'EGRESO', suministro_id: 'S03', cantidad: 1, contrato_id: CID, ...o });

/** Temporizador falso: los tiempos avanzan solo cuando la prueba lo dice. */
function relojFalso() {
  let ahora = 0, sig = 1;
  const pend = new Map();
  return {
    setTimeout(f, ms) { const id = sig++; pend.set(id, { f, en: ahora + ms }); return id; },
    clearTimeout(id) { pend.delete(id); },
    async avanzar(ms) {
      ahora += ms;
      for (const [id, x] of [...pend.entries()].sort((a, b) => a[1].en - b[1].en)) {
        if (x.en <= ahora) { pend.delete(id); x.f(); }
      }
      for (let i = 0; i < 10; i++) await null;   // deja correr las promesas
    },
    pendientes: () => pend.size
  };
}
const esperar = async () => { for (let i = 0; i < 20; i++) await null; };

// ── El defecto, reproducido con la cuenta real del nexo ──
test('el defecto: la orden VIEJA en memoria con el movimiento ya corregido infla lo «por registrar»; con la orden releída cuadra', () => {
  const o1 = orden();
  const o2 = orden({ version: 2, items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 2)] });   // editada: 3 → 2
  const m1 = registrado(o1, 'MOV-2026-0001');
  const m2 = registrado(o2, 'MOV-2026-0002');                                                  // el registro automático corrigió
  const viejo = nexoDe([o1], [m2]);
  assert.ok(viejo.totalPendiente > 0, 'con la orden vieja aparece algo «por registrar» que no existe');
  const fresco = nexoDe([o2], [m2]);
  assert.equal(fresco.totalPendiente, 0);
  assert.equal(fresco.resumenEstados.registrado, 1);
  // Y la huella del movimiento enlazado delata el cambio: eso dispara la relectura.
  assert.equal(cambiaronEnlazados(firmaEnlazados([m1]), firmaEnlazados([m2])), true);
});

test('el defecto con la orden ELIMINADA: el movimiento retirado + la orden vieja cuentan todo como pendiente; releída no queda nada', () => {
  const o1 = orden();
  const m1 = registrado(o1, 'MOV-2026-0001');
  assert.equal(nexoDe([o1], []).totalPendiente, 3000, 'orden vieja en memoria: 3 × $1.000 «por registrar»');
  assert.equal(nexoDe([], []).totalPendiente, 0);
  assert.equal(cambiaronEnlazados(firmaEnlazados([m1]), firmaEnlazados([])), true);
});

// ── (a) Huella de los movimientos enlazados ──
test('firmaEnlazados: solo cuentan los movimientos enlazados a una orden; los manuales no', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  assert.equal(firmaEnlazados([manual()]), '');
  assert.equal(firmaEnlazados([m, manual()]), firmaEnlazados([m]));
  assert.equal(firmaEnlazados([m, manual({ cantidad: 7 })]), firmaEnlazados([m, manual()]), 'editar un manual no relee órdenes');
});

test('firmaEnlazados: no depende del orden de llegada; cambia al crear, retirar o cambiar cantidad, código o versión', () => {
  const a = { ...registrado(orden(), 'MOV-2026-0001') };
  const b = { ...a, id: 'oes_otro', codigo: 'MOV-2026-0002', orden_es: { ...a.orden_es, clave: 'ENTRADA_N2', numero: 'N2' } };
  const f = firmaEnlazados([a, b]);
  assert.equal(firmaEnlazados([b, a]), f);
  assert.notEqual(firmaEnlazados([a]), f, 'retirado');
  assert.notEqual(firmaEnlazados([a, b, { ...b, id: 'oes_3' }]), f, 'creado');
  assert.notEqual(firmaEnlazados([a, { ...b, cantidad: 9 }]), f, 'cantidad');
  assert.notEqual(firmaEnlazados([a, { ...b, codigo: 'MOV-2026-0003' }]), f, 'corregido con el mismo id fijo (código nuevo)');
  assert.notEqual(firmaEnlazados([a, { ...b, orden_es: { ...b.orden_es, version: 5 } }]), f, 'versión de la orden');
});

test('firmaEnlazados: entradas raras no rompen', () => {
  assert.equal(firmaEnlazados(null), '');
  assert.equal(firmaEnlazados(undefined), '');
  assert.equal(firmaEnlazados([null, undefined, {}, { orden_es: 'texto' }]), '');
});

test('cambiaronEnlazados: la primera huella es el punto de partida (no relee); después, solo si cambió', () => {
  assert.equal(cambiaronEnlazados(null, 'x'), false);
  assert.equal(cambiaronEnlazados(undefined, 'x'), false);
  assert.equal(cambiaronEnlazados('x', null), false);
  assert.equal(cambiaronEnlazados('x', 'x'), false);
  assert.equal(cambiaronEnlazados('', ''), false);
  assert.equal(cambiaronEnlazados('', 'x'), true, 'de ningún enlazado a uno nuevo');
  assert.equal(cambiaronEnlazados('x', ''), true, 'se retiró el último');
});

// ── (b) Al volver a la pestaña ──
test('releerAlVolver: solo visible, sin lectura en curso, con una lectura previa y pasado más de un minuto', () => {
  const t0 = 1_000_000;
  const base = { visible: true, ultimaLecturaMs: t0, ahoraMs: t0 + RELEER_AL_VOLVER_MS + 1 };
  assert.equal(RELEER_AL_VOLVER_MS, 60_000);
  assert.equal(releerAlVolver(base), true);
  assert.equal(releerAlVolver({ ...base, ahoraMs: t0 + RELEER_AL_VOLVER_MS }), false, 'justo un minuto: todavía no');
  assert.equal(releerAlVolver({ ...base, ahoraMs: t0 + 5_000 }), false);
  assert.equal(releerAlVolver({ ...base, visible: false }), false, 'al ocultarse no se lee');
  assert.equal(releerAlVolver({ ...base, leyendo: true }), false, 'ya hay una lectura en curso');
  assert.equal(releerAlVolver({ ...base, ultimaLecturaMs: null }), false, 'sin lectura previa (página sin nexo o primera lectura en curso)');
  assert.equal(releerAlVolver({ ...base, ahoraMs: t0 - 10 }), false, 'reloj hacia atrás');
  assert.equal(releerAlVolver({ ...base, ahoraMs: t0 + 10_001, umbralMs: 10_000 }), true);
  assert.equal(releerAlVolver(), false);
});

// ── Sello «Órdenes leídas a las hh:mm» ──
test('horaCorta: hh:mm en 24 h con ceros; vacío si no hay hora', () => {
  assert.equal(horaCorta(new Date(2026, 9, 9, 7, 5).getTime()), '07:05');
  assert.equal(horaCorta(new Date(2026, 9, 9, 18, 42).getTime()), '18:42');
  assert.equal(horaCorta(null), '');
  assert.equal(horaCorta(NaN), '');
  assert.equal(horaCorta(undefined), '');
});

test('textoLectura: el sello dice la hora, si está leyendo y si la relectura falló, sin jerga', () => {
  const ms = new Date(2026, 9, 9, 9, 30).getTime();
  assert.equal(textoLectura({ leidasMs: ms }), 'Órdenes leídas a las 09:30');
  assert.equal(textoLectura({ leidasMs: ms, leyendo: true }), 'Actualizando las órdenes… (leídas a las 09:30)');
  assert.equal(textoLectura({ leyendo: true }), 'Leyendo las órdenes…');
  assert.match(textoLectura({ leidasMs: ms, error: 'sin conexión' }), /^No se pudieron volver a leer las órdenes \(sin conexión\)\. Se muestran las leídas a las 09:30\.$/);
  assert.equal(textoLectura({ error: 'sin conexión' }), 'No se pudieron leer las órdenes (sin conexión).');
  assert.equal(textoLectura(), '');
});

// ── El lector: agrupa, nunca lee dos veces a la vez y no pierde un cambio ──
test('crearRelector: varios cambios seguidos se juntan en UNA lectura', async () => {
  const reloj = relojFalso();
  let lecturas = 0;
  const r = crearRelector({ leer: async () => { lecturas++; }, temporizador: reloj });
  r.pedir(); await reloj.avanzar(500);
  r.pedir(); await reloj.avanzar(500);
  r.pedir();
  assert.equal(r.esperando(), true);
  await reloj.avanzar(AGRUPAR_CAMBIOS_MS - 1);
  assert.equal(lecturas, 0, 'cada cambio reinicia la espera');
  await reloj.avanzar(1);
  assert.equal(lecturas, 1);
  assert.equal(r.esperando(), false);
  assert.equal(r.leyendo(), false);
});

test('crearRelector: «ya» (botón Actualizar) lee enseguida y cancela la espera pendiente', async () => {
  const reloj = relojFalso();
  let lecturas = 0;
  const r = crearRelector({ leer: async () => { lecturas++; }, temporizador: reloj });
  r.pedir();
  await r.ya();
  assert.equal(lecturas, 1);
  assert.equal(reloj.pendientes(), 0);
  await reloj.avanzar(AGRUPAR_CAMBIOS_MS * 2);
  assert.equal(lecturas, 1, 'la espera cancelada no lee otra vez');
});

test('crearRelector: un cambio DURANTE la lectura provoca una (y solo una) lectura más; nunca dos a la vez', async () => {
  let enCurso = 0, maxEnCurso = 0, lecturas = 0;
  const soltar = [];
  const r = crearRelector({ leer: () => new Promise((res) => {
    lecturas++; enCurso++; maxEnCurso = Math.max(maxEnCurso, enCurso);
    soltar.push(() => { enCurso--; res(); });
  }) });
  const p = r.ya();
  await esperar();
  assert.equal(lecturas, 1);
  assert.equal(r.leyendo(), true);
  r.ya(); r.ya(); r.ya();                 // tres pedidos mientras lee
  soltar.shift()();
  await esperar();
  assert.equal(lecturas, 2, 'los pedidos durante la lectura se juntan en una más');
  soltar.shift()();
  await p;
  assert.equal(lecturas, 2);
  assert.equal(maxEnCurso, 1);
  assert.equal(r.leyendo(), false);
});

test('crearRelector: un error al leer no lo detiene (la siguiente lectura corre)', async () => {
  let n = 0;
  const r = crearRelector({ leer: async () => { n++; if (n === 1) throw new Error('falló'); } });
  await r.ya();
  assert.equal(r.leyendo(), false);
  await r.ya();
  assert.equal(n, 2);
});

test('crearRelector: una lectura que falla al instante no deja el lector trabado', async () => {
  let n = 0;
  const r = crearRelector({ leer: () => { n++; throw new Error('al instante'); } });
  await r.ya();
  assert.equal(r.leyendo(), false);
  await r.ya();
  assert.equal(n, 2);
});

test('crearRelector: «parar» (al salir de la página) cancela la espera y no lee más', async () => {
  const reloj = relojFalso();
  let lecturas = 0;
  const r = crearRelector({ leer: async () => { lecturas++; }, temporizador: reloj });
  r.pedir();
  r.parar();
  await reloj.avanzar(AGRUPAR_CAMBIOS_MS * 2);
  r.pedir();
  await r.ya();
  assert.equal(lecturas, 0);
  assert.throws(() => crearRelector({}), /falta leer/);
});

// ── Amarres con las páginas (free-tier y textos) ──
test('las páginas releen con la MISMA lectura acotada y sin oyentes en vivo sobre las órdenes', () => {
  const tablero = readFileSync(new URL('../assets/js/suministros-dashboard-public.js', import.meta.url), 'utf8');
  const mov = readFileSync(new URL('../assets/js/admin/admin-suministros-movimiento.js', import.meta.url), 'utf8');
  for (const [nombre, src] of [['tablero', tablero], ['Movimiento', mov]]) {
    assert.doesNotMatch(src, /suscribir\w*Ordenes|ordenes_materiales['"]\s*\)?\s*,?\s*onSnapshot|onSnapshot\([^)]*ordenes/i, `${nombre}: sin escucha en vivo de órdenes`);
    assert.match(src, /listarOrdenes\(\{\s*desde:[^}]*hasta:/, `${nombre}: lectura acotada a la vigencia`);
    assert.match(src, /import\(['"][./]+domain\/contrato_relectura\.js['"]\)/, `${nombre}: carga perezosa (L-102)`);
    assert.match(src, /visibilitychange/, `${nombre}: relee al volver a la pestaña`);
    assert.match(src, /btnActualizarOrdenes/, `${nombre}: botón «Actualizar»`);
  }
  for (const html of ['../pages/suministros-dashboard.html', '../admin/suministros-movimiento.html']) {
    const h = readFileSync(new URL(html, import.meta.url), 'utf8');
    assert.match(h, /<p id="nexoLectura" hidden/, `${html}: el sello nace oculto (con el JS viejo no aparece)`);
    assert.match(h, /id="btnActualizarOrdenes"[^>]*>Actualizar<\/button>/, `${html}: botón «Actualizar»`);
  }
});
