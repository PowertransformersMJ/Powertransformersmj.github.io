// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · FIRMAR (Preparar → Revisar → Firmar)
// ──────────────────────────────────────────────────────────────────────────────
//   1. Preparar: relee la ODT del servidor, lee su habilitación y «Mi firma» (lector
//      propio que LANZA), compone EN MEMORIA el PDF con su firma y CONGELA la copia
//      (uid, imagen, huellas, estado, rev, declaración; L-112).
//   2. Revisar: pdf.js muestra ESOS bytes (las 2 páginas) con su huella.
//   3. Declaración exacta + casilla NO premarcada + contraseña: se reautentica
//      (reauthenticateWithCredential + getIdToken(true)), se comprueba que la cuenta
//      viva sigue siendo la de la copia, y se escribe el lote de 2 (acto + estado).
// Responsable (2026-11-21): la FECHA CIERRE ya NO se edita: es la fecha PREVISTA de la
// orden y se muestra fija, junto con «ODT GENERADA N° {nro}» que se estampa al componer.
// Si la fecha prevista todavía no llega (o no es válida), «Preparar mi firma» queda
// deshabilitado y se le dice desde cuándo podrá firmar. Si lo preparado viene de una pieza
// vieja de la caché (sin el compositor vigente ni el N.º de «ODT GENERADA»), no se muestra
// ni se firma: se pide recargar (L-102).
// Si cambia algo (otra cuenta en otra pestaña, la ODT avanzó, pasó el tiempo), se
// aborta y se vuelve a preparar. Si el lote no responde a tiempo, queda «pendiente»:
// se dice «NO repita» y se espera su desenlace, sin ofrecer otra firma.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ROL } from '../../domain/odt_afinia_rutas.js';
import { rolDe } from '../../domain/odt_afinia_estados.js';
import { fechaCierreDe, textoGenerada, ETIQUETA_GENERADA, avisoAntesDeFirmar, errorFirmaAlDia } from '../../domain/odt_afinia_cierre.js';
import { h, vaciar, aviso, mensajeDe, cargarPdfLib } from './comun.js';
import { prepararFirma, verificarAntesDeFirmar } from './preparar.js';
import { armarDeclaracion } from './declaracion.js';
import { pintarPdf } from './vista-pdf.js';

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, cuenta:object, sesion:object, odt:object, bytesV0:Uint8Array, actos:object,
 *          miFirmaOdt:()=>Promise<object>, alFirmar:(mensaje:string)=>void}} p
 */
export function montarFirmar(contenedor, { repo, cuenta, sesion, odt, bytesV0, actos, miFirmaOdt, alFirmar }) {
  const rol = rolDe(odt, sesion.uid);
  vaciar(contenedor);
  contenedor.appendChild(h('h3', { class: 'odt-subtitulo', text: 'Firmar como ' + ETIQUETA_ROL[rol] }));

  // Pie de cierre que estampa el Responsable: fijo, nada que escribir.
  const prevista = rol === 'responsable' ? fechaCierreDe(odt) : null;
  // Antes de la fecha prevista (o con una fecha inválida) el Responsable no puede firmar: se le dice desde
  // cuándo y no se le ofrece un botón que solo terminaría en ese mismo «no».
  const avisoFecha = rol === 'responsable' ? avisoAntesDeFirmar(odt) : null;
  const bloqueada = !!avisoFecha;
  const pieCierre = rol === 'responsable'
    ? h('section', { class: 'odt-pie-cierre', 'aria-label': 'Pie de cierre que se estampa con su firma' },
      h('p', { class: 'odt-mini', text: 'Con su firma se estampa el pie de cierre de la página 2 (no se edita):' }),
      h('dl', { class: 'odt-datos odt-datos--fila' },
        h('div', { class: 'odt-dato' }, h('dt', { text: '¿SE CIERRA LA ODT?' }), h('dd', { text: 'SI (X)' })),
        h('div', { class: 'odt-dato' }, h('dt', { text: 'FECHA CIERRE' }), h('dd', { text: (prevista || '—') + ' (fecha prevista de la orden)' })),
        h('div', { class: 'odt-dato odt-generada' }, h('dt', { text: ETIQUETA_GENERADA }), h('dd', { text: String(odt.nro || '—') }))))
    : null;
  const btnPreparar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Preparar mi firma', disabled: bloqueada });
  const estado = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
  const zonaVista = h('div', { class: 'odt-vista' });
  const zonaDecl = h('div', { class: 'odt-bloque' });

  // Sin nulos en append(): el navegador los pintaría como el texto «null» (99 §231.12).
  contenedor.append(...[
    h('p', { class: 'odt-parrafo', text: 'Primero se prepara la ODT con su firma, sin guardar nada. Revise las dos páginas; si está de acuerdo, acepte la declaración y escriba su contraseña.' }),
    pieCierre,
    avisoFecha ? aviso(avisoFecha, 'aviso') : null,
    h('div', { class: 'odt-acciones' }, btnPreparar),
    estado, zonaVista, zonaDecl].filter(Boolean));

  let congelado = null;
  const reiniciar = () => {
    congelado = null; vaciar(zonaVista); vaciar(zonaDecl);
    btnPreparar.textContent = 'Preparar mi firma'; btnPreparar.disabled = bloqueada;
  };

  btnPreparar.addEventListener('click', async () => {
    if (congelado) { reiniciar(); vaciar(estado); return; }
    if (bloqueada) return;
    btnPreparar.disabled = true;
    vaciar(estado); estado.appendChild(h('p', { class: 'odt-cargando', text: 'Preparando: leyendo la ODT, su habilitación y su firma…' }));
    try {
      const uidVivo = await cuenta.uidVivo();
      if (uidVivo !== sesion.uid) throw new Error('La sesión de esta pestaña cambió de cuenta. Recargue la página.');
      const [fresca, cta, hab, miFirma, PDFLib] = await Promise.all([
        repo.leerOdtDoc(odt.id), cuenta.estadoCuenta(), repo.leerHabilitacion(), miFirmaOdt(), cargarPdfLib()
      ]);
      if (fresca.estado !== odt.estado || fresca.rev !== odt.rev) throw new Error('La ODT cambió desde que la abrió. Recargue para ver su estado actual.');
      const preparado = await prepararFirma({
        odt: fresca, bytesV0, actos, sesion: { uid: sesion.uid, nombre: sesion.nombre }, correo: cta.correo,
        miFirma, habilitacion: hab, fechaCierre: rol === 'responsable' ? fechaCierreDe(fresca) : undefined, PDFLib
      });
      // L-102: un preparar.js viejo de la caché compone sin el compositor vigente (ni el N.º de «ODT GENERADA»):
      // no se muestra un pie que la vista no trae ni se ofrece firmar; se pide recargar.
      const errAlDia = errorFirmaAlDia(preparado);
      if (errAlDia) throw new Error(errAlDia);
      congelado = preparado;
      vaciar(estado);
      if (rol === 'responsable') {
        estado.appendChild(aviso('La firma del AZT se comprobó: al recomponer la ODT sale exactamente lo que el AZT vio. '
          + 'Con su firma quedan en el pie: X en SI, FECHA CIERRE ' + congelado.cierre.fecha + ' y ' + textoGenerada(congelado.nro) + '.', 'ok'));
      }
      const r = await pintarPdf(congelado.bytes, zonaVista, { titulo: 'Así queda la ODT con su firma (revise las 2 páginas):', huella: congelado.huellaVista });
      if (r.paginas !== 2) throw new Error('La ODT compuesta no tiene 2 páginas: no se firma.');
      btnPreparar.textContent = 'Cambiar algo y volver a preparar'; btnPreparar.disabled = false;
      pintarDeclaracion();
    } catch (e) {
      reiniciar();
      vaciar(estado); estado.appendChild(aviso(mensajeDe(e), 'error'));
    }
  });

  function pintarDeclaracion() {
    vaciar(zonaDecl);
    const c = congelado;
    let decl;
    decl = armarDeclaracion({
      texto: c.declaracion.texto,
      version: c.declaracion.version,
      etiquetaCasilla: 'Revisé las dos páginas y acepto esta declaración.',
      etiquetaBoton: 'Firmar',
      alConfirmar: async (clave) => {
        decl.estado.textContent = 'Comprobando su contraseña…';
        try {
          const token = await cuenta.reautenticar(clave, { uidEsperado: c.uid });
          const motivo = verificarAntesDeFirmar(c, { uidVivo: await cuenta.uidVivo(), token });
          if (motivo) { decl.estado.textContent = motivo; return; }
          decl.estado.textContent = 'Registrando su firma…';
          decl.bloquear(true);
          const r = await repo.firmar(c, token);
          const hecho = 'Su firma quedó registrada en la ODT N.º ' + c.nro + '.';
          if (r && r.estado === 'pendiente') {
            // El lote sigue en curso: NO se ofrece firmar otra vez (ni volver a preparar) hasta que termine.
            decl.estado.textContent = r.mensaje;
            btnPreparar.disabled = true;
            r.final.then(() => alFirmar(hecho), (e) => {
              btnPreparar.disabled = false; decl.bloquear(false);
              decl.estado.textContent = mensajeDe(e);
            });
            return;
          }
          alFirmar(hecho);
        } catch (e) {
          decl.bloquear(false);
          decl.estado.textContent = mensajeDe(e);
        }
      }
    });
    zonaDecl.appendChild(decl.raiz);
  }
}
