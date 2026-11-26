// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Avisos de CUMPLIMIENTO DEL CIERRE: el RESUMEN DE NOTIFICACIONES en la base (adaptadores) · 99 §236
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): ver en SGM cuándo y cuántas veces se notificó. El resumen
// odt_afinia_config/cumplimiento_resumen lo escribe SOLO el servidor, con el Admin SDK (sin reglas). Las cuentas viven
// en assets/js/domain/odt_afinia_cumplimiento_resumen.js (copiada a ./domain/ por prepare-deploy.mjs e INYECTADA aquí
// como `logica`: este archivo no importa ./domain, que en las pruebas puede no existir). Aquí solo:
//   · preparar(t, {id, correo, marca}): DENTRO de la transacción en que un correo pasa a «enviado» (cerrar, en
//     cumplimiento_remitente.mjs) lee el resumen y qué N.º de ese correo ya salieron en OTRO correo enviado (consultas
//     «array-contains-any» por tandas de 30, solo el campo nros) y devuelve la escritura del resumen, que se hace
//     después de leer (en una transacción, primero se lee todo). Como el resumen se lee y se escribe en cada envío, dos
//     envíos a la vez se ordenan solos (uno espera o se repite): nada se cuenta dos veces. Si una lectura falla, lanza
//     un error marcado `deResumen` (cerrar registra el envío sin el resumen y lo deja «porRecalcular»).
//     Corrector ronda 1 (99 §236): ese error conserva el `code` del original, así el SDK repite la transacción cuando
//     el error es pasajero (ABORTED, UNAVAILABLE…) y solo uno definitivo llega al respaldo. Y si el resumen NO existe
//     o quedó «porRecalcular», no se suma sobre él: se calcula ENTERO desde los correos enviados (más este), en la
//     misma transacción, y se quita la marca. Así no queda corto cuando ya había envíos de antes del resumen, y una
//     suma fallida se corrige sola con el envío siguiente;
//   · marcarPorRecalcular(): el aviso de que a las cuentas puede faltarles un envío (lo corrige el recálculo);
//   · recalcular(): en UNA transacción, lee el resumen (así un envío que llegue a la vez espera) y todos los correos
//     enviados por páginas (solo umbral, nros y enviadoEn) y escribe el resumen entero. Lo llama el reproceso del
//     administrador (reprocesarAvisosCumplimiento, functions/index.js).
// Índices: la consulta de la transacción (estado == + nros array-contains-any) tiene su índice compuesto en
// firestore.indexes.json; la del recálculo (estado ==, orden por id) usa el automático.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════

const COL = Object.freeze({
  resumen: ['odt_afinia_config', 'cumplimiento_resumen'],
  correos: 'odt_afinia_correos'
});
const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * @param {{db:object, FieldValue:object, logica:object}} p
 *   logica: el módulo domain/odt_afinia_cumplimiento_resumen.js (sumarEnvio, recalcularResumen, nrosDistintos, enLotes,
 *   LOTE_CONTIENE, PAGINA_RECALCULO)
 */
export function crearOperacionesResumen({ db, FieldValue, logica }) {
  const L = logica;
  const ref = () => db.collection(COL.resumen[0]).doc(COL.resumen[1]);
  const correos = () => db.collection(COL.correos);
  /** Todos los correos enviados, por páginas, DENTRO de la transacción `t` (solo umbral, nros y enviadoEn). */
  async function leerEnviados(t) {
    const items = [];
    let ultimo = null;
    for (;;) {
      let q = correos().where('estado', '==', 'enviado').select('umbral', 'nros', 'enviadoEn').limit(L.PAGINA_RECALCULO);
      if (ultimo) q = q.startAfter(ultimo);
      const r = await t.get(q);
      for (const d of r.docs) items.push({ ...(d.data() || {}), id: d.id });
      if (r.docs.length < L.PAGINA_RECALCULO) break;
      ultimo = r.docs[r.docs.length - 1];
    }
    return items;
  }
  return {
    /**
     * Dentro de la transacción del envío: lee y devuelve la escritura del resumen (una función sin argumentos).
     * @param {object} t  la transacción
     * @param {{id:string, correo:{umbral:number, nros:string[]}, marca:any}} p  marca: la hora del envío (la misma
     *   del enviadoEn del correo)
     */
    async preparar(t, { id, correo, marca }) {
      try {
        const s = await t.get(ref());
        const previo = s.exists ? (s.data() || {}) : null;
        if (!previo || previo.porRecalcular === true) {
          // Corrector ronda 1: sin resumen (o con cuentas dudosas), el resumen entero: los enviados de antes + este.
          const antes = (await leerEnviados(t)).filter((d) => d.id !== id);
          const base = L.recalcularResumen(antes);
          const x = L.sumarEnvio(base, correo, new Set(antes.flatMap((d) => L.nrosDistintos(d.nros))));
          const cambios = {
            enviados: x.enviados, porUmbral: x.porUmbral, odtAvisadas: x.odtAvisadas, primerEnvioEn: base.primerEnvioEn || marca, ultimoEnvioEn: marca,
            porRecalcular: false, actualizadoEn: FieldValue.serverTimestamp()
          };
          return () => t.set(ref(), cambios, { merge: true });
        }
        const ya = new Set();
        for (const lote of L.enLotes(L.nrosDistintos(correo && correo.nros), L.LOTE_CONTIENE)) {
          const r = await t.get(correos().where('estado', '==', 'enviado').where('nros', 'array-contains-any', lote).select('nros'));
          for (const d of r.docs) {
            if (d.id === id) continue;
            for (const n of lista((d.data() || {}).nros)) if (lote.includes(n)) ya.add(n);
          }
        }
        const x = L.sumarEnvio(previo, correo, ya);
        const cambios = { enviados: x.enviados, porUmbral: x.porUmbral, odtAvisadas: x.odtAvisadas, ultimoEnvioEn: marca, actualizadoEn: FieldValue.serverTimestamp() };
        if (!previo || !previo.primerEnvioEn) cambios.primerEnvioEn = marca;
        return () => t.set(ref(), cambios, { merge: true });
      } catch (e) {
        const err = new Error('No se pudo sumar el envío al resumen de notificaciones: ' + String((e && (e.message || e.code)) || e).slice(0, 200));
        err.deResumen = true;
        // Corrector ronda 1: el código del original. El SDK decide por él si repite la transacción (un error sin
        // código no se repite e iría directo al respaldo, aunque solo fuera pasajero).
        if (e && e.code !== undefined) err.code = e.code;
        throw err;
      }
    },
    async marcarPorRecalcular() {
      await ref().set({ porRecalcular: true, actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
    },
    /** El resumen desde los correos enviados: {enviados, porUmbral, odtAvisadas}. */
    async recalcular() {
      return db.runTransaction(async (t) => {
        await t.get(ref());
        const x = L.recalcularResumen(await leerEnviados(t));
        t.set(ref(), {
          enviados: x.enviados, porUmbral: x.porUmbral, odtAvisadas: x.odtAvisadas, primerEnvioEn: x.primerEnvioEn, ultimoEnvioEn: x.ultimoEnvioEn,
          porRecalcular: false, actualizadoEn: FieldValue.serverTimestamp()
        });
        return { enviados: x.enviados, porUmbral: x.porUmbral, odtAvisadas: x.odtAvisadas };
      });
    }
  };
}
