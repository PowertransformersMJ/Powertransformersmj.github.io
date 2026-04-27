// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Contratos · selector (M2 + M7 v2.4 + polish 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Página índice del módulo Contratos. Muestra una jerarquía de
// 2 niveles:
//   1. Categoría de contrato (línea contractual / concepto del servicio)
//   2. Números de contrato individuales dentro de esa categoría
//
// Inicialmente hardcodeada con la categoría "Suministro de Elementos
// y Accesorios para Transformadores de Potencia" que agrupa los
// contratos 4123000081 y 4125000143. Cuando se registren más
// categorías o números en /contratos, la lista se hará dinámica.
//
// El estado real de cada contrato (origen='firestore'|'semilla' y
// con_datos=true|false) se calcula leyendo /contratos/{id}: si el
// doc existe → origen='firestore'; si tiene `ultima_importacion` →
// con_datos=true. Esto evita que el tag SIN DATOS quede pegado en
// contratos que ya fueron importados (bug reportado 2026-04-27 PM).
// ══════════════════════════════════════════════════════════════

import {
  collection, query, where, onSnapshot, doc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from './firebase-init.js';

// Estructura semilla: 1 categoría con 2 contratos. Los flags
// origen/con_datos se sobrescriben con los del doc Firestore si
// existe (ver suscribirContratos abajo).
const CATEGORIAS_SEMILLA = [
  {
    id: 'sum-tx',
    nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
    nombre_corto: 'Elementos & Accesorios TX',
    contratos: [
      {
        id: '4123000081',
        numero: '4123000081',
        nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
        estado: 'activo',
        origen: 'semilla',
        con_datos: true
      },
      {
        id: '4125000143',
        numero: '4125000143',
        nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
        estado: 'activo',
        origen: 'semilla',
        con_datos: true
      }
    ]
  }
];

const $ = (id) => document.getElementById(id);
const grid = $('contratosGrid');

let unsub = null;

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderCard(c) {
  const numero = c.numero || c.id;
  const nombre = c.nombre || 'Contrato sin descripción';
  const estado = (c.estado || 'activo').toUpperCase();
  const isActivo = estado === 'ACTIVO' || estado === 'VIGENTE';
  // Solo mostrar SIN DATOS si está EXPLÍCITAMENTE en false. Los
  // contratos que ya tienen ultima_importacion en Firestore quedan
  // con con_datos=true automáticamente.
  const sinDatosTag = c.con_datos === false
    ? '<span class="contrato-pendiente-tag" title="Pendiente de importar Excel">SIN DATOS</span>'
    : '';
  return `
    <a class="contrato-card ${isActivo ? '' : 'is-cerrado'} ${c.con_datos === false ? 'is-pendiente' : ''}" href="contrato.html?id=${encodeURIComponent(c.id)}">
      <div class="contrato-card-head">
        <div class="contrato-icon">
          <i data-lucide="file-text"></i>
        </div>
        <div class="contrato-numero">
          <code>${escHtml(numero)}</code>
          ${sinDatosTag}
        </div>
        <span class="contrato-estado-pill estado-${escHtml(estado.toLowerCase())}">${escHtml(estado)}</span>
      </div>
      <div class="contrato-card-body">
        <h3>${escHtml(nombre)}</h3>
      </div>
      <div class="contrato-card-foot">
        <span>${c.con_datos === false ? 'Importar Excel' : 'Abrir contrato'}</span>
        <i data-lucide="arrow-right"></i>
      </div>
    </a>
  `;
}

function renderCategoria(cat) {
  return `
    <section class="categoria-section">
      <header class="categoria-header">
        <h2>${escHtml(cat.nombre)}</h2>
        <p class="categoria-subtitle">${cat.contratos.length} contrato${cat.contratos.length === 1 ? '' : 's'} registrado${cat.contratos.length === 1 ? '' : 's'} en esta línea contractual.</p>
      </header>
      <div class="contratos-grid">
        ${cat.contratos.map(renderCard).join('')}
      </div>
    </section>
  `;
}

function render(categorias) {
  if (!categorias || categorias.length === 0) {
    grid.innerHTML = '<div class="contrato-empty">No hay categorías de contrato registradas todavía.</div>';
    return;
  }
  grid.innerHTML = categorias.map(renderCategoria).join('');
  window.sgmRefreshIcons?.();
}

/**
 * Aplica el estado real de Firestore a la categoría semilla.
 * Para cada contrato semilla: si /contratos/{id} existe, se usa su
 * `estado` y se calcula `con_datos` desde `ultima_importacion`.
 * Si no existe, se mantienen los flags semilla por defecto.
 */
function aplicarEstadoFirestore(categoriaSemilla, docsFirestore) {
  const cat = { ...categoriaSemilla, contratos: [...categoriaSemilla.contratos] };
  const docsById = new Map(docsFirestore.map((d) => [d.id, d]));
  cat.contratos = cat.contratos.map((c) => {
    const fd = docsById.get(c.id);
    if (!fd) return c;
    return {
      ...c,
      origen: 'firestore',
      estado: fd.estado || c.estado,
      con_datos: !!fd.ultima_importacion || c.con_datos === true
    };
  });
  // Inyectar contratos de Firestore que no estén en la semilla.
  const idsSemilla = new Set(categoriaSemilla.contratos.map((c) => c.id));
  for (const fd of docsFirestore) {
    if (!idsSemilla.has(fd.id)) {
      cat.contratos.push({
        id: fd.id,
        numero: fd.codigo || fd.numero || fd.id,
        nombre: fd.alcance || fd.nombre || cat.nombre,
        estado: fd.estado || 'activo',
        origen: 'firestore',
        con_datos: !!fd.ultima_importacion
      });
    }
  }
  return cat;
}

function arrancar() {
  if (!isFirebaseConfigured) {
    render(CATEGORIAS_SEMILLA);
    return;
  }
  const db = getDbSafe();
  if (!db) {
    render(CATEGORIAS_SEMILLA);
    return;
  }
  // Suscripción a /contratos: refresca el estado real de cada
  // contrato (existencia, ultima_importacion, estado) y mergea con
  // la categoría semilla. Cada vez que el importador escribe
  // /contratos/{id} (al final de una importación), el doc cambia
  // y este onSnapshot lo refleja.
  try {
    unsub = onSnapshot(
      collection(db, 'contratos'),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cat = aplicarEstadoFirestore(CATEGORIAS_SEMILLA[0], docs);
        render([cat]);
      },
      (err) => {
        console.warn('[contratos] suscripción falló:', err);
        render(CATEGORIAS_SEMILLA);
      }
    );
  } catch (err) {
    console.warn('[contratos] no se pudo suscribir:', err);
    render(CATEGORIAS_SEMILLA);
  }
}

window.addEventListener('beforeunload', () => {
  if (unsub) try { unsub(); } catch (_) {}
});

arrancar();
