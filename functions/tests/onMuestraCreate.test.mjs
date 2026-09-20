// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Trigger onMuestraCreate contra el emulador (99 §80)
// ──────────────────────────────────────────────────────────────
// Una muestra nueva NO puede pisar la condición que fijó el archivo de Salud
// de Activos (decisión del Ingeniero, ratificada 2026-09-20). Hasta este
// cambio, el trigger reemplazaba `salud_actual` ENTERO y la borraba en
// silencio: ninguna prueba lo habría visto, porque el dominio por separado
// daba bien. Vive aquí (no en tests/) porque necesita firebase-admin y el
// emulador de Functions: `npm run test:trigger`. Datos inventados.
// ══════════════════════════════════════════════════════════════
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const app = initializeApp({ projectId: 'lordpowertransformersmj' });
const db = getFirestore(app);

const TX = 'TX-PRUEBA-TRIGGER';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarCambio(fn, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    const s = await db.collection('transformadores').doc(TX).get();
    const v = fn(s.data() || {});
    if (v) return v;
    await esperar(500);
  }
  return null;
}

before(async () => {
  await db.collection('transformadores').doc(TX).set({
    schema_version: 2,
    identificacion: { codigo: TX, nombre: 'Prueba trigger', tipo_activo: 'POTENCIA' },
    ubicacion: { departamento: 'bolivar', zona: '' },
    estado_servicio: 'operativo',
    placa: { potencia_kva: 10000 },
    fabricacion: { ano_fabricacion: 1998 },
    salud_actual: {
      hi_final: 4.6, bucket: 'muy_pobre',
      hi_recalculado: 2.1, bucket_recalculado: 'bueno',
      condicion_fuente: 'excel', overrides_aplicados: ['_importacion_v2'],
      ts_calculo: '2026-09-08T00:00:00.000Z'
    }
  });
});

after(async () => {
  await db.collection('transformadores').doc(TX).delete().catch(() => {});
});

test('una muestra nueva NO pisa la condición del Excel, y sí actualiza el recálculo', async () => {
  // El motor necesita las tres familias para dar su propio número.
  await db.collection('muestras').add({
    transformadorId: TX, tipo: 'ADFQ', fecha_muestra: '2026-09-18',
    rigidez_kv: 38, ti: 28, nn: 0.08
  });
  await db.collection('muestras').add({
    transformadorId: TX, tipo: 'FURANOS', fecha_muestra: '2026-09-19', ppb: 1200
  });
  await db.collection('muestras').add({
    transformadorId: TX, tipo: 'DGA', fecha_muestra: '2026-09-20',
    gases: { H2: 120, CH4: 40, C2H2: 3, C2H4: 60, C2H6: 25, CO: 900, CO2: 6000 }
  });

  const salud = await esperarCambio((d) => {
    const s = d.salud_actual || {};
    return (s.ts_calculo && s.ts_calculo !== '2026-09-08T00:00:00.000Z') ? s : null;
  });

  assert.ok(salud, 'el trigger no corrió: no cambió ts_calculo');
  assert.equal(salud.hi_final, 4.6, 'la condición del Excel debe seguir intacta');
  assert.equal(salud.bucket, 'muy_pobre');
  assert.equal(salud.condicion_fuente, 'excel');
  assert.ok(salud.hi_recalculado != null, 'el motor sí deja su número al lado');
  assert.notEqual(salud.hi_recalculado, 2.1, 'el recálculo se actualizó con las muestras nuevas');
  assert.notEqual(salud.hi_recalculado, salud.hi_final, 'motor y Excel difieren, y manda el Excel');
  assert.ok(salud.calif_c2h2 != null, 'las calificaciones de la muestra sí entran');

  const hist = await db.collection('transformadores').doc(TX).collection('historial_hi').get();
  assert.ok(hist.size >= 1, 'queda snapshot en el historial');
  assert.equal(hist.docs[0].data().hi_final, 4.6, 'el historial también respeta la condición del Excel');
});
