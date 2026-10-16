// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · CONFIGURACIÓN (solo administrador)
// ──────────────────────────────────────────────────────────────
// Lo que el informe necesita una sola vez y vive en
// `informes_brigada_config/general` (nunca en el código):
//   · quiénes ARMAN el informe (por uid; se escogen de la lista de usuarios,
//     decisión 3);
//   · el contrato por defecto (decisión 10);
//   · el almacén de imágenes: Storage (decisión 5) o, como contingencia,
//     Firestore (L-29 / `99 §100`: en producción Storage ha negado descargas);
//   · los 5 logos de la marca (decisión 6: se cargan aquí, no van al repo);
//   · los firmantes y sus firmas, con la autorización del titular (decisión 4).
// Las reglas del servidor vuelven a exigir que quien guarde sea administrador.
// ══════════════════════════════════════════════════════════════

const HOY = () => new Date().toISOString().slice(0, 10);

/**
 * Avisos al cargar un logo (no impiden cargarlo):
 *  · el papel y el Word lo ESTIRAN a su recuadro del formato (como el modelo); si la proporción es
 *    otra, se dice cuánto se deforma;
 *  · el logo del encabezado se monta sobre la dirección «Bogotá D.C.»: si no es transparente, la tapa.
 */
export function avisosLogo(clave, prep, geometria) {
  const g = geometria && geometria[clave];
  const out = [];
  if (g && prep && prep.ancho > 0 && prep.alto > 0) {
    const r = (prep.ancho / prep.alto) / (g.w / g.h);
    const pct = Math.round(Math.abs(r - 1) * 100);
    if (pct >= 3) out.push('Este logo tiene otra proporción que su recuadro del formato: se ' + (r < 1 ? 'ensancha' : 'angosta') + ' ' + pct + ' % para llenarlo, como en el modelo. Si se ve deformado, cargue uno recortado a ' + g.w + ' × ' + g.h + ' pt.');
  }
  if (clave === 'applus-encabezado' && prep && prep.transparente === false) {
    out.push('El logo del encabezado no tiene fondo transparente: en el papel y en el Word tapará la dirección «Bogotá D.C.». Use el PNG transparente de Applus.');
  }
  return out;
}

/**
 * @param {HTMLElement} cont
 * @param {{ ctx, configInicial: object, alGuardar: (config) => void }} o
 * @returns {{ alAbrir: () => void }}
 */
export function montarConfiguracion(cont, { ctx, configInicial, alGuardar }) {
  const dep = ctx.dep;
  const F = dep.formulario;
  const P = dep.plantilla;
  const esc = F.escaparHtml;
  const copia = (x) => JSON.parse(JSON.stringify(x == null ? null : x));

  let borrador = normal(configInicial);
  let usuarios = null;        // null = sin leer
  let errorUsuarios = '';
  let ocupado = false;
  let sucio = false;

  function normal(c) {
    const x = copia(c) || {};
    const marca = {};
    for (const k of (P.MARCA_CLAVES || [])) marca[k] = (x.marca && x.marca[k]) || null;
    return {
      editores: Array.isArray(x.editores) ? x.editores.slice() : [],
      contrato_defecto: String(x.contrato_defecto || ''),
      almacen: x.almacen === 'storage' ? 'storage' : 'firestore',
      firmantes: Array.isArray(x.firmantes) ? x.firmantes : [],
      ingenieros: Array.isArray(x.ingenieros) ? x.ingenieros.slice() : [],
      tecnicos: Array.isArray(x.tecnicos) ? x.tecnicos.slice() : [],
      marca
    };
  }

  const almacenParaSubir = () => dep.almacen.crearAlmacen({ modo: ctx.modo === 'local' ? 'local' : borrador.almacen });

  function pintar() {
    const geo = P.MARCA_GEOMETRIA || {};
    const listaUsuarios = usuarios === null
      ? '<p class="ibr-tenue">' + (errorUsuarios ? esc(errorUsuarios) : 'Leyendo usuarios…') + '</p>'
      : '<ul class="ibr-cfg-usuarios">' + usuarios.map((u) => '<li><label class="ibr-casilla"><input type="checkbox" data-cfg-editor="' + esc(u.uid) + '"'
        + (borrador.editores.includes(u.uid) ? ' checked' : '') + '> ' + esc(u.nombre || 'Sin nombre') + ' <span class="ibr-tenue">· ' + esc(u.rol || 'sin rol')
        + (u.activo ? '' : ' · inactivo') + '</span></label></li>').join('')
        + borrador.editores.filter((uid) => !usuarios.some((u) => u.uid === uid)).map((uid) => '<li><label class="ibr-casilla"><input type="checkbox" checked data-cfg-editor="' + esc(uid) + '"> '
          + '<span class="ibr-tenue">Usuario que ya no está en la lista (' + esc(uid.slice(0, 6)) + '…)</span></label></li>').join('')
        + '</ul>';

    const logos = (P.MARCA_CLAVES || []).map((k) => {
      const m = borrador.marca[k];
      return '<li class="ibr-cfg-logo"><div><b>' + esc((geo[k] && geo[k].nombre) || k) + '</b>'
        + '<div class="ibr-mini">' + (m ? '✓ Cargado · ' + esc(m.mime) + ' · ' + esc(m.ancho) + ' × ' + esc(m.alto) + ' px · ' + esc(m.almacen) : '○ Pendiente: el papel muestra «Logo pendiente»') + '</div></div>'
        + '<label class="ibr-btn ibr-btn--chico">' + (m ? 'Cambiar' : 'Cargar') + '<input class="ibr-sr" type="file" accept="image/png,image/jpeg" data-cfg-logo="' + esc(k) + '" aria-label="Logo ' + esc(k) + '"></label></li>';
    }).join('');

    const firmantes = borrador.firmantes.map((f, i) => {
      const fi = f.firma;
      return '<li class="ibr-cfg-firmante"><div><b>' + esc(f.nombre) + '</b>' + (f.cargo ? ' <span class="ibr-tenue">· ' + esc(f.cargo) + '</span>' : '')
        + '<div class="ibr-mini">' + (fi ? '✓ Firma registrada · autorizada el ' + esc(dep.formato.fechaDMA(fi.autorizacion && fi.autorizacion.fecha)) + ' por ' + esc((fi.autorizacion && fi.autorizacion.medio) || '—') : '○ Sin firma: su línea se firma a mano') + '</div></div>'
        + '<label class="ibr-casilla">Línea por defecto en informes nuevos: <select class="ibr-select" data-cfg-rol="' + i + '" aria-label="Línea por defecto de ' + esc(f.nombre) + '">'
        +   [['', '— ninguna —'], ['elaborado', 'Elaborado por'], ['revisado', 'Revisado por'], ['aprobado', 'Aprobado por']]
              .map(([v, t]) => '<option value="' + v + '"' + ((f.rol || '') === v ? ' selected' : '') + '>' + t + '</option>').join('')
        + '</select></label>'
        + '<div class="ibr-hueco-botones">'
        + '<button type="button" class="ibr-btn ibr-btn--chico" data-cfg-firma="' + i + '">' + (fi ? 'Cambiar firma' : 'Cargar firma') + '</button>'
        + '<button type="button" class="ibr-btn ibr-btn--chico ibr-btn--peligro" data-cfg-quitar-firmante="' + i + '">Quitar</button>'
        + '</div>'
        + '<div class="ibr-cfg-firma-form" data-cfg-firma-form="' + i + '" hidden>'
        + '<label class="ibr-campo"><span class="ibr-campo-et">Imagen de la firma (PNG con fondo transparente)</span><input class="ibr-input" type="file" accept="image/png" data-cfg-firma-archivo="' + i + '"></label>'
        + '<label class="ibr-campo"><span class="ibr-campo-et">Fecha en que el titular autorizó usarla</span><input class="ibr-input" type="date" data-cfg-firma-fecha="' + i + '" value="' + HOY() + '"></label>'
        + '<label class="ibr-campo"><span class="ibr-campo-et">Medio de la autorización (correo, acta…)</span><input class="ibr-input" type="text" data-cfg-firma-medio="' + i + '" placeholder="Correo del 14/10/2026"></label>'
        + '<button type="button" class="ibr-btn ibr-btn--primario ibr-btn--chico" data-cfg-firma-subir="' + i + '">Subir firma</button>'
        + '</div></li>';
    }).join('');

    cont.innerHTML = ''
      + '<div class="ibr-cfg">'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Quiénes arman el informe</h3>'
      +   '<p class="ibr-ayuda">Solo ellos crean, editan y emiten. Los demás del equipo los ven. Se guardan por usuario (uid), nunca por nombre en el código.</p>'
      +   listaUsuarios + '</section>'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Personal del informe (2.2)</h3>'
      +   '<p class="ibr-ayuda">Son las listas desplegables de «Ingeniero» y «Técnicos». Un nombre por renglón, sin «Ing.»: la lista lo antepone y el párrafo ya dice «el ingeniero …».</p>'
      +   '<div class="ibr-cfg-personas">'
      +     '<label class="ibr-campo"><span class="ibr-campo-et">Ingenieros</span><textarea class="ibr-input" rows="4" data-cfg-personas="ingenieros" aria-label="Ingenieros, uno por renglón">' + esc(borrador.ingenieros.join('\n')) + '</textarea></label>'
      +     '<label class="ibr-campo"><span class="ibr-campo-et">Técnicos</span><textarea class="ibr-input" rows="6" data-cfg-personas="tecnicos" aria-label="Técnicos, uno por renglón">' + esc(borrador.tecnicos.join('\n')) + '</textarea></label>'
      +   '</div></section>'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Contrato por defecto</h3>'
      +   '<input class="ibr-input" type="text" maxlength="20" data-cfg-contrato value="' + esc(borrador.contrato_defecto) + '" aria-label="Contrato por defecto">'
      +   '<p class="ibr-ayuda">Llega lleno en cada informe nuevo y se puede cambiar en cada uno.</p></section>'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Dónde se guardan las imágenes</h3>'
      +   '<label class="ibr-casilla"><input type="radio" name="ibrCfgAlmacen" value="firestore"' + (borrador.almacen === 'firestore' ? ' checked' : '') + '> Firestore (lo vigente)</label> '
      +   '<label class="ibr-casilla"><input type="radio" name="ibrCfgAlmacen" value="storage"' + (borrador.almacen === 'storage' ? ' checked' : '') + '> Storage (no usar: el navegador no puede leerlo)</label>'
      +   '<p class="ibr-ayuda">Las fotos, los logos y las fichas se guardan en Firestore: en producción Storage niega las descargas al navegador (lección L-29) y las imágenes quedarían ilegibles. Las firmas de terceros van SIEMPRE a Firestore. Las imágenes ya guardadas se siguen leyendo de donde quedaron.</p></section>'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Logos de la marca</h3>'
      +   '<p class="ibr-ayuda">Applus, «Together beyond standards» y AFINIA, tal cual el formato. Se cargan una vez; no viven en el código.</p>'
      +   '<ul class="ibr-cfg-lista">' + logos + '</ul></section>'
      + '<section class="ibr-cfg-bloque"><h3 class="ibr-sub">Firmantes</h3>'
      +   '<p class="ibr-banda ibr-banda--aviso">Las firmas solo se estampan al EMITIR, y solo si el nombre de la línea es el del firmante. En borrador, nunca.</p>'
      +   (firmantes ? '<ul class="ibr-cfg-lista">' + firmantes + '</ul>' : '<p class="ibr-tenue">Sin firmantes.</p>')
      +   '<div class="ibr-cfg-nuevo"><input class="ibr-input" type="text" data-cfg-nuevo-nombre placeholder="NOMBRE DEL FIRMANTE" aria-label="Nombre del firmante">'
      +   '<input class="ibr-input" type="text" data-cfg-nuevo-cargo placeholder="Cargo" aria-label="Cargo del firmante">'
      +   '<button type="button" class="ibr-btn ibr-btn--chico" data-cfg-agregar-firmante>＋ Agregar firmante</button></div></section>'
      + '<div class="ibr-cfg-pie"><button type="button" class="ibr-btn ibr-btn--primario" data-cfg-guardar>Guardar configuración</button>'
      +   '<span class="ibr-ayuda" data-cfg-estado role="status">' + (sucio ? 'Hay cambios sin guardar.' : '') + '</span></div>'
      + '</div>';
  }

  const estado = (t) => { const el = cont.querySelector('[data-cfg-estado]'); if (el) el.textContent = t; };
  const marcarSucio = () => { sucio = true; estado('Hay cambios sin guardar.'); };

  async function guardar({ silencioso = false } = {}) {
    if (ocupado) return false;
    ocupado = true;
    estado('Guardando…');
    try {
      await ctx.repo.guardarConfig(borrador);
      const r = await ctx.repo.leerConfig();
      const nueva = (r && r.config) || borrador;
      borrador = normal(nueva);
      sucio = false;
      alGuardar(nueva);
      pintar();
      estado('Configuración guardada.');
      if (!silencioso) ctx.avisar('Configuración del informe guardada.', 'ok');
      return true;
    } catch (err) {
      estado('No se pudo guardar: ' + ((err && err.message) || err));
      return false;
    } finally {
      ocupado = false;
    }
  }

  cont.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.matches('[data-cfg-editor]')) {
      const uid = el.getAttribute('data-cfg-editor');
      borrador.editores = el.checked ? [...new Set(borrador.editores.concat([uid]))] : borrador.editores.filter((x) => x !== uid);
      marcarSucio();
      return;
    }
    if (el.matches('[data-cfg-contrato]')) { borrador.contrato_defecto = el.value.trim(); marcarSucio(); return; }
    if (el.matches('[data-cfg-rol]')) {
      // Una línea la ocupa un solo firmante: si otro la tenía, queda sin línea.
      const i = Number(el.getAttribute('data-cfg-rol'));
      const rol = ['elaborado', 'revisado', 'aprobado'].includes(el.value) ? el.value : '';
      borrador.firmantes = borrador.firmantes.map((f, j) => (j === i ? { ...f, rol } : (rol && f.rol === rol ? { ...f, rol: '' } : f)));
      marcarSucio(); pintar(); return;
    }
    if (el.matches('[data-cfg-personas]')) {
      const k = el.getAttribute('data-cfg-personas');
      if (k === 'ingenieros' || k === 'tecnicos') { borrador[k] = el.value.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean); marcarSucio(); }
      return;
    }
    if (el.name === 'ibrCfgAlmacen') { borrador.almacen = el.value === 'storage' ? 'storage' : 'firestore'; marcarSucio(); return; }
    if (el.matches('[data-cfg-logo]')) {
      const clave = el.getAttribute('data-cfg-logo');
      const archivo = el.files && el.files[0];
      el.value = '';
      if (!archivo) return;
      if (ocupado) { estado('Espere: se está guardando la configuración; vuelva a escoger el logo en un momento.'); return; }
      estado('Preparando el logo…');
      try {
        const IM = await dep.cargar('imagenes');
        const prep = await IM.prepararLogo(archivo);
        estado('Subiendo el logo…');
        const meta = await almacenParaSubir().subirLogo(clave, prep.blob, { mime: prep.mime, ancho: prep.ancho, alto: prep.alto, tamano: prep.tamano, huella: prep.huella }, ctx.autor());
        borrador.marca[clave] = meta;
        // Solo se dice «cargado» si la configuración quedó guardada (si no, el estado ya explica qué falló).
        if (await guardar({ silencioso: true })) {
          ctx.avisar('Logo cargado.', 'ok');
          avisosLogo(clave, prep, P.MARCA_GEOMETRIA).forEach((t) => ctx.avisar(t, 'aviso', 0));
        }
      } catch (err) {
        estado('No se pudo cargar el logo: ' + ((err && err.message) || err));
      }
    }
  });

  cont.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('[data-cfg-guardar]')) { guardar(); return; }
    if (t.closest('[data-cfg-agregar-firmante]')) {
      const nombre = cont.querySelector('[data-cfg-nuevo-nombre]').value.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-CO');
      const cargo = cont.querySelector('[data-cfg-nuevo-cargo]').value.replace(/\s+/g, ' ').trim();
      if (!nombre) { estado('Escriba el nombre del firmante.'); return; }
      const clave = dep.rutas.claveFirmante(nombre);
      if (borrador.firmantes.some((f) => f.clave === clave)) { estado('Ya hay un firmante con ese nombre.'); return; }
      borrador.firmantes = borrador.firmantes.concat([{ clave, nombre, cargo, firma: null }]);
      sucio = true;
      pintar();
      estado('Firmante agregado: falta «Guardar configuración».');
      return;
    }
    const q = t.closest('[data-cfg-quitar-firmante]');
    if (q) {
      const i = Number(q.getAttribute('data-cfg-quitar-firmante'));
      borrador.firmantes = borrador.firmantes.filter((_, k) => k !== i);
      sucio = true;
      pintar();
      estado('Firmante quitado: falta «Guardar configuración». Los informes ya emitidos conservan su firma.');
      return;
    }
    const abrir = t.closest('[data-cfg-firma]');
    if (abrir) {
      const form = cont.querySelector('[data-cfg-firma-form="' + abrir.getAttribute('data-cfg-firma') + '"]');
      if (form) form.hidden = !form.hidden;
      return;
    }
    const sub = t.closest('[data-cfg-firma-subir]');
    if (sub && ocupado) { estado('Espere: se está guardando la configuración.'); return; }
    if (sub && !ocupado) {
      const i = Number(sub.getAttribute('data-cfg-firma-subir'));
      const f = borrador.firmantes[i];
      const archivo = (cont.querySelector('[data-cfg-firma-archivo="' + i + '"]').files || [])[0];
      const fecha = cont.querySelector('[data-cfg-firma-fecha="' + i + '"]').value;
      const medio = cont.querySelector('[data-cfg-firma-medio="' + i + '"]').value.trim();
      if (!f) return;
      if (!archivo) { estado('Escoja la imagen PNG de la firma.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || medio.length < 3) { estado('Escriba la fecha y el medio con que el titular autorizó usar su firma.'); return; }
      sub.disabled = true;
      try {
        estado('Preparando la firma…');
        const IM = await dep.cargar('imagenes');
        const prep = await IM.prepararFirma(archivo);
        estado('Subiendo la firma…');
        const meta = await almacenParaSubir().subirFirma(f.clave, prep.blob,
          { mime: prep.mime, ancho: prep.ancho, alto: prep.alto, tamano: prep.tamano, huella: prep.huella, autorizacion: { fecha, medio } }, ctx.autor());
        borrador.firmantes = borrador.firmantes.map((x, k) => (k === i ? { ...x, firma: { ...meta, autorizacion: meta.autorizacion || { fecha, medio } } } : x));
        if (await guardar({ silencioso: true })) ctx.avisar('Firma de ' + f.nombre + ' registrada. Se estampa solo al emitir.', 'ok');
        else sub.disabled = false;
      } catch (err) {
        estado('No se pudo cargar la firma: ' + ((err && err.message) || err));
        sub.disabled = false;
      }
    }
  });

  async function leerUsuarios() {
    if (usuarios !== null) return;
    try {
      usuarios = await ctx.repo.listarUsuarios();
      errorUsuarios = '';
    } catch (err) {
      usuarios = null;
      errorUsuarios = 'No se pudo leer la lista de usuarios: ' + ((err && err.message) || err);
    }
    const abiertos = [...cont.querySelectorAll('[data-cfg-firma-form]')].filter((x) => !x.hidden).map((x) => x.getAttribute('data-cfg-firma-form'));
    pintar();
    abiertos.forEach((i) => { const x = cont.querySelector('[data-cfg-firma-form="' + i + '"]'); if (x) x.hidden = false; });
  }

  pintar();
  return {
    alAbrir() { leerUsuarios(); }
  };
}
