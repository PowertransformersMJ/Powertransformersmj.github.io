// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: editar un transformador desde el
// formulario de admin/inventario.html (ADR-154)
// ──────────────────────────────────────────────────────────────
// Funciones PURAS. El formulario muestra ~20 casillas de un
// documento que tiene muchas más (matrícula, condición de salud,
// año de fabricación, corrientes, usuarios…). Antes se guardaba el
// documento ENTERO que el sanitizador reconstruye con esas casillas
// y, como en Firestore una sección escrita completa REEMPLAZA a la
// guardada, la primera edición borraba todo lo que el formulario no
// muestra (simulado sobre los 208 equipos de producción, solo
// lectura, 2026-10-08: los 208 perdían matrícula y condición).
//
// Regla: se escribe CAMPO POR CAMPO y solo lo que el usuario cambió.
// «Cambió» se mide entre la foto del formulario al abrirlo (`inicial`,
// tomada de lo que QUEDÓ en pantalla, con las conversiones del
// navegador) y el formulario al guardar (`actual`). Lo que no se tocó
// no se escribe, así que tampoco se puede dañar.
// ══════════════════════════════════════════════════════════════

import {
  sanitizarTransformador, validarTransformador, proyeccionV1
} from './transformador_schema.js';

const txt = (v) => (v == null ? '' : String(v));

/**
 * Lo que el formulario muestra al abrir un equipo, casilla por casilla
 * (texto, como lo guardan los <input>). Lee la proyección v1 de la raíz
 * —como siempre— salvo el estado: «fallado» solo existe en
 * `estado_servicio` (la raíz lo proyecta como «retirado»).
 */
export function valoresFormulario(t) {
  const d = t || {};
  const id = d.identificacion || {};
  const ub = d.ubicacion || {};
  return {
    codigo:                txt(d.codigo),
    nombre:                txt(d.nombre),
    departamento:          txt(d.departamento),
    estado:                txt(d.estado_servicio || d.estado || 'operativo'),
    municipio:             txt(d.municipio),
    subestacion:           txt(d.subestacion),
    potencia_kva:          txt(d.potencia_kva),
    tension_primaria_kv:   txt(d.tension_primaria_kv),
    tension_secundaria_kv: txt(d.tension_secundaria_kv),
    marca:                 txt(d.marca),
    modelo:                txt(d.modelo),
    serial:                txt(d.serial),
    fecha_fabricacion:     txt(d.fecha_fabricacion),
    fecha_instalacion:     txt(d.fecha_instalacion),
    latitud:               txt(d.latitud),
    longitud:              txt(d.longitud),
    observaciones:         txt(d.observaciones),
    tipo_activo:           txt(id.tipo_activo || 'POTENCIA'),
    uucc:                  txt(id.uucc),
    grupo:                 txt(id.grupo),
    zona:                  txt(ub.zona)
  };
}

/**
 * Casillas del formulario → entrada del sanitizador. Misma forma que
 * siempre armó `readForm` (plano v1 + secciones explícitas); la usa
 * también el alta de un equipo nuevo.
 */
export function entradaDesdeFormulario(v) {
  return {
    codigo: v.codigo,
    nombre: v.nombre,
    departamento: v.departamento,
    estado: v.estado,
    estado_servicio: v.estado,
    municipio: v.municipio,
    subestacion: v.subestacion,
    potencia_kva: v.potencia_kva,
    tension_primaria_kv: v.tension_primaria_kv,
    tension_secundaria_kv: v.tension_secundaria_kv,
    marca: v.marca,
    modelo: v.modelo,
    serial: v.serial,
    fecha_fabricacion: v.fecha_fabricacion,
    fecha_instalacion: v.fecha_instalacion,
    latitud: v.latitud,
    longitud: v.longitud,
    observaciones: v.observaciones,
    // v2 explicit sections (sanitizer reconcilia con flat)
    identificacion: {
      codigo:      v.codigo,
      nombre:      v.nombre,
      tipo_activo: v.tipo_activo,
      uucc:        v.uucc,
      grupo:       v.grupo
    },
    ubicacion: {
      departamento: v.departamento,
      zona:         v.zona,
      municipio:    v.municipio,
      subestacion_nombre: v.subestacion,
      latitud:      v.latitud,
      longitud:     v.longitud
    }
  };
}

// Hojas de un documento como rutas con punto ('placa.marca'). Los arreglos
// son hojas: se comparan y se escriben enteros.
function hojas(obj, prefijo = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const ruta = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) hojas(v, ruta, out);
    else out[ruta] = v;
  }
  return out;
}
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Qué escribir al guardar una edición.
 *
 * @param {object} inicial — `entradaDesdeFormulario` al ABRIR el equipo.
 * @param {object} actual  — `entradaDesdeFormulario` al GUARDAR.
 * @returns {{ parche: object, diff: object, errores: string[], cambios: number }}
 *   `parche`: claves con punto para `updateDoc` (cada una toca SOLO ese
 *   campo) + la proyección v1 de la raíz de lo que cambió. Vacío si no
 *   cambió nada. `diff`: antes/después por campo, para la bitácora.
 *   `errores`: las mismas validaciones de siempre sobre el formulario.
 */
export function parcheEdicionInventario(inicial, actual) {
  const antes = sanitizarTransformador(inicial);
  const despues = sanitizarTransformador(actual);
  const errores = validarTransformador(despues);

  // Ambos lados salen del MISMO formulario: lo que el formulario no
  // muestra vale lo mismo (el valor por defecto) en los dos y nunca entra.
  const ha = hojas(antes);
  const hd = hojas(despues);
  const parche = {};
  const diff = {};
  for (const ruta of Object.keys(hd)) {
    if (igual(ha[ruta], hd[ruta])) continue;
    parche[ruta] = hd[ruta];
    diff[ruta] = { antes: ha[ruta] ?? null, despues: hd[ruta] ?? null };
  }
  // La raíz (proyección v1) acompaña a su sección para que las vistas
  // viejas que la leen vean el cambio.
  const v1a = proyeccionV1(antes);
  const v1d = proyeccionV1(despues);
  for (const k of Object.keys(v1d)) {
    if (!igual(v1a[k], v1d[k])) parche[k] = v1d[k];
  }
  return { parche, diff, errores, cambios: Object.keys(diff).length };
}
