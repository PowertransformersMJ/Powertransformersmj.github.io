// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · worker de importación · `99 §122`
// ──────────────────────────────────────────────────────────────
// Lee la carpeta del mes EN EL COMPUTADOR (los archivos no se suben), sin congelar la
// página. No usa Firebase: solo el dominio puro. Mensajes:
//   ← {tipo: 'analizar', archivos: [{file, ruta, nombre}], filas}      (filas = homologación)
//   → {tipo: 'progreso', hechos, total} … {tipo: 'analizado', …}
//   ← {tipo: 'procesar', meses, guardados: {'cid|mes': serie desempaquetada}, modo}
//   → {tipo: 'procesado', docs, resumen, catalogo, conteos, conflictos, sinCambios}
// Archivo NUEVO (L-102). Worker de módulo.
// ══════════════════════════════════════════════════════════════

import { objetivoImportacion } from '../domain/scada_carga_homologacion.js';
import {
  crearAcumulador, acumularArchivo, clasificarMeses, armarMeses, procesarPuntoMes, docSerie, docSinCambios, diasDelMes
} from '../domain/scada_carga_importacion.js';
import { empaquetar } from '../domain/scada_carga_series.js';
import { estadisticoDeNombre } from '../domain/scada_carga_csv.js';

let acc = null;
let cancelado = false;

function empaquetado(guardado) {
  if (!guardado) return null;
  const out = { niveles: {} };
  for (const [nv, x] of Object.entries(guardado.niveles || {})) {
    out.niveles[nv] = { fam: {} };
    for (const [f, s] of Object.entries(x.fam || {})) out.niveles[nv].fam[f] = empaquetar(s);
  }
  return out;
}

async function analizar({ archivos, filas }) {
  cancelado = false;
  acc = crearAcumulador();
  const objetivo = objetivoImportacion(filas);
  const total = archivos.length;
  for (let i = 0; i < total; i++) {
    if (cancelado) { postMessage({ tipo: 'cancelado' }); return; }
    const a = archivos[i];
    const nombre = a.nombre || (a.file && a.file.name) || '';
    // Mismo criterio que el dominio (acumularArchivo): solo promedios y calidad se leen.
    const est = estadisticoDeNombre(nombre);
    const leer = /\.csv$/i.test(nombre) && (!est || est === 'average' || est === 'quality');
    let texto = '';
    try { if (leer && a.file.size) texto = await a.file.text(); } catch (e) { texto = ''; }
    // Un paquete preparado trae el tamaño ORIGINAL de cada archivo (los no leídos van vacíos):
    // así el informe de la carpeta cuenta igual que con la carpeta arrastrada.
    const tamano = Number.isFinite(a.tamano) ? a.tamano : (a.file ? a.file.size : 0);
    acumularArchivo(acc, { nombre, ruta: a.ruta || '', texto, tamano }, objetivo);
    if (i % 25 === 0 || i === total - 1) postMessage({ tipo: 'progreso', hechos: i + 1, total });
  }
  const meses = clasificarMeses(acc);
  postMessage({
    tipo: 'analizado', meses, archivos: acc.archivos, discrepancias: { fechaCarpeta: acc.discrepancias.fechaCarpeta, fechaNombre: acc.discrepancias.fechaNombre, ejemplos: acc.discrepancias.ejemplos },
    conflictos: acc.conflictos, invalidos: acc.invalidos, puntos: [...acc.puntos.entries()].map(([cid, p]) => ({ cid, clave: p.clave, est: p.est, elem: p.elem, niveles: p.niveles })),
    dias: Object.fromEntries(meses.map((m) => [m.mes, diasDelMes(acc, m.mes)]))
  });
}

function procesar({ meses, guardados, modo }) {
  const armados = armarMeses(acc, meses);
  const docs = []; const resumen = {}; const conteos = {}; let conflictos = 0; let sinCambios = 0;
  const puntos = {};
  for (const [mes, porPunto] of armados) {
    resumen[mes] = {};
    for (const [cid, nuevo] of porPunto) {
      const g = guardados ? guardados[cid + '|' + mes] || null : null;
      const p = procesarPuntoMes(nuevo, g, modo);
      conflictos += p.conflictos;
      resumen[mes][cid] = p.resumen;
      for (const porFam of Object.values(p.conteos)) for (const c of Object.values(porFam)) for (const [k, v] of Object.entries(c)) conteos[k] = (conteos[k] || 0) + v;
      const meta = acc.puntos.get(cid);
      const doc = docSerie(cid, mes, meta, p.niveles);
      if (docSinCambios(doc, empaquetado(g))) sinCambios++;
      else docs.push(doc);
      if (!puntos[cid]) puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [] };
      puntos[cid].meses.push(mes);
    }
  }
  const catalogoMeses = {};
  for (const mes of meses) { const d = diasDelMes(acc, mes); catalogoMeses[mes] = { dias: d.mascara, nDias: d.dias, completo: d.completo }; }
  postMessage({ tipo: 'procesado', docs, resumen, catalogo: { meses: catalogoMeses, puntos }, conteos, conflictos, sinCambios });
}

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.tipo === 'analizar') await analizar(m);
    else if (m.tipo === 'procesar') procesar(m);
    else if (m.tipo === 'cancelar') cancelado = true;
  } catch (e) {
    postMessage({ tipo: 'error', mensaje: (e && e.message) || String(e) });
  }
};
