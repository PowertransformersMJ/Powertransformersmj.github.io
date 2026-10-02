// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Importador · «Cargar solo los gases» (ppm de la última DGA) · `99 §131`
// ──────────────────────────────────────────────────────────────
// Toma la hoja TX_Potencia del archivo ya leído en la página, cruza cada fila con el parque por la matrícula y guarda
// SOLO `ultima_dga` en cada transformador. Primero SIMULA (no escribe) y muestra el resultado; el botón de carga se
// habilita solo después de simular ESE archivo. No toca calificaciones ni crea muestras. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { planCargaGases, HOJA_GASES } from '../domain/dga_ppm_excel.js';
import { escribirUltimasDga, isReady } from '../data/dga_ppm.js';
import { listarV2 } from '../data/transformadores.js';

const $ = (id) => document.getElementById(id);
const texto = (tag, t, estilo) => { const e = document.createElement(tag); e.textContent = t; if (estilo) e.style.cssText = estilo; return e; };

/** @param {() => ({hojas:Array<{hoja, filas}>, nombre:string} | null)} obtenerArchivo */
export function montarCargaGases(obtenerArchivo) {
  let plan = null; let hojasPlan = null;
  const msg = $('gasesMsg'); const btnSim = $('btnGasesDry'); const btnReal = $('btnGasesReal');
  if (!msg || !btnSim || !btnReal) return { reiniciar() {} };
  const decir = (...nodos) => { msg.textContent = ''; for (const n of nodos) if (n) msg.appendChild(n); };
  const reiniciar = () => { plan = null; hojasPlan = null; btnReal.disabled = true; decir(); };

  btnSim.addEventListener('click', async () => {
    const a = obtenerArchivo();
    if (!a) { decir(texto('p', 'Primero elija el archivo de Salud de Activos.', 'color:#ff5577')); return; }
    const hoja = a.hojas.find((h) => h.hoja === HOJA_GASES);
    if (!hoja) { decir(texto('p', 'El archivo no trae la hoja ' + HOJA_GASES + '.', 'color:#ff5577')); return; }
    btnReal.disabled = true;
    decir(texto('p', '⋯ Leyendo el parque y cruzando por matrícula…'));
    try {
      const parque = await listarV2({ limite: 500 });
      const ahora = obtenerArchivo();
      if (!ahora || ahora.hojas !== a.hojas) return; // se eligió otro archivo mientras se leía el parque
      plan = planCargaGases(hoja.filas, parque, { archivo: a.nombre, ahoraISO: new Date().toISOString() });
      hojasPlan = a.hojas;
      const lista = (titulo, xs) => (xs.length ? texto('p', titulo + ' (' + xs.length + '): ' + xs.slice(0, 40).join(', ') + (xs.length > 40 ? '…' : '')) : null);
      decir(
        texto('p', '✓ Simulación (no se escribió nada) · archivo ' + a.nombre, 'font-weight:700'),
        texto('p', 'Se guardarían los gases de ' + plan.escribir.length + ' transformadores.'),
        texto('p', 'Ya tienen los mismos gases: ' + plan.iguales.length + ' · Filas sin ningún gas: ' + plan.sinGases.length),
        lista('Matrículas del archivo que no casan con un único equipo del parque', plan.sinCoincidencia),
        lista('Matrículas repetidas en el archivo (no se escribe ninguna de sus filas: revíselas)', plan.repetidas),
        lista('Sin gases', plan.sinGases),
        texto('p', 'Solo se escribe el campo de la última DGA (ppm de H₂, CH₄, C₂H₄, C₂H₆, C₂H₂, CO y CO₂). Ninguna calificación cambia. El archivo no trae la fecha de toma: queda sin fecha.', 'opacity:.8'));
      btnReal.disabled = !plan.escribir.length;
    } catch (e) {
      console.warn('[importar-gases] simular', e);
      decir(texto('p', 'No se pudo simular: ' + ((e && e.message) || e), 'color:#ff5577'));
    }
  });

  btnReal.addEventListener('click', async () => {
    const a = obtenerArchivo();
    if (!plan || !a || a.hojas !== hojasPlan) { reiniciar(); decir(texto('p', 'Simule primero este archivo.', 'color:#ff5577')); return; }
    if (!isReady()) { decir(texto('p', 'Firebase no inicializado.', 'color:#ff5577')); return; }
    if (!confirm('¿Guardar los gases de ' + plan.escribir.length + ' transformadores? Solo cambia el campo de la última DGA; ninguna calificación.')) return;
    btnReal.disabled = true; btnSim.disabled = true;
    try {
      const s = window.__sgmSession;
      const out = await escribirUltimasDga(plan.escribir, { uid: s && s.user && s.user.uid, archivo: a.nombre,
        onProgress: ({ escritos, total }) => decir(texto('p', '⋯ Guardando ' + escritos + ' de ' + total + '…')) });
      decir(texto('p', '✓ Gases guardados en ' + out.escritos + ' transformadores.', 'font-weight:700'));
      plan = null;
    } catch (e) {
      console.warn('[importar-gases] cargar', e);
      decir(texto('p', 'No se pudo guardar: ' + ((e && e.message) || e) + '. Vuelva a simular.', 'color:#ff5577'));
    } finally { btnSim.disabled = false; }
  });

  return { reiniciar };
}
