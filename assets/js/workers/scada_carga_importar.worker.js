// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · worker de importación · `99 §122`
// ──────────────────────────────────────────────────────────────
// Lee la carpeta del mes EN EL COMPUTADOR (los archivos no se suben), sin congelar la
// página. No usa Firebase: solo el dominio puro. Mensajes:
//   ← {tipo: 'analizar', archivos: [{file, ruta, nombre}], filas}      (filas = homologación)
//   → {tipo: 'progreso', hechos, total} … {tipo: 'analizado', …}
//   ← {tipo: 'procesar', meses, guardados: {'cid|mes': serie desempaquetada}, modo}
//   → {tipo: 'procesado', docs, resumen, catalogo, conteos, conflictos, sinCambios, derivados, versionSuma}
// Suma de circuitos (2026-10-24): 'analizar' también lee los circuitos de cada suma (medidas REALES con su nombre) y
// guarda las filas; 'procesar' calcula al final los resúmenes DERIVADOS ('<cid>--suma') con el dominio puro. Nunca toca
// el resumen del transformador, ni agrega una serie derivada, ni pone algo derivado en el catálogo.
// Archivo NUEVO (L-102). Worker de módulo.
// ══════════════════════════════════════════════════════════════

import {
  crearAcumulador, acumularArchivo, clasificarMeses, armarMeses, procesarPuntoMes, docSerie, docSinCambios, diasDelMes
} from '../domain/scada_carga_importacion.js';
import { empaquetar } from '../domain/scada_carga_series.js';
import { seLee } from '../domain/scada_carga_paquete.js';
import { objetivoConSumas, especSuma, derivadosDelMes, SUMA } from '../domain/scada_carga_suma.js';
// Bandera «Invalid» no confiable de un punto (2026-10-28): archivo NUEVO; sin marcas, se limpia como siempre.
import { puntosInvalidNoConfiable, conMarcaInvalid, VERSION_INVALID } from '../domain/scada_carga_invalid.js';
// Corriente con banda muerta de un punto (2026-10-28): archivo NUEVO; sin marcas, se limpia como siempre.
import { puntosBandaMuerta, conMarcaBandaMuerta, VERSION_BANDA_MUERTA } from '../domain/scada_carga_banda_muerta.js';

let acc = null;
let cancelado = false;
let filasAnalisis = {};   // la homologación con que se leyó la carpeta (las sumas se calculan con ella)

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
  filasAnalisis = filas || {};
  // Las estaciones y los puntos de siempre (objetivoImportacion) MÁS los circuitos de cada suma de circuitos.
  const objetivo = objetivoConSumas(filasAnalisis);
  const total = archivos.length;
  for (let i = 0; i < total; i++) {
    if (cancelado) { postMessage({ tipo: 'cancelado' }); return; }
    const a = archivos[i];
    const nombre = a.nombre || (a.file && a.file.name) || '';
    // Mismo criterio que el dominio (acumularArchivo): promedios, calidad y —para VER— máx, mín e instantáneo.
    const leer = seLee(nombre);
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
  // Puntos que entran en alguna suma (el transformador y sus circuitos): solo de ellos se guardan los niveles del mes.
  const specs = Object.values(filasAnalisis || {}).map(especSuma).filter(Boolean);
  const involucrados = new Set(specs.flatMap((s) => [s.cid, ...Object.values(s.porNivel).flatMap((x) => x.cids)]));
  const derivados = [];
  const conInvalid = puntosInvalidNoConfiable(filasAnalisis);
  const conBanda = puntosBandaMuerta(filasAnalisis);
  for (const [mes, porPunto] of armados) {
    resumen[mes] = {};
    const porCid = {};
    for (const [cid, nuevo] of porPunto) {
      const g = guardados ? guardados[cid + '|' + mes] || null : null;
      const op = {};
      if (conInvalid.has(cid)) op.aceptarInvalid = true;
      if (conBanda.has(cid)) op.bandaMuerta = conBanda.get(cid);
      let p = procesarPuntoMes(nuevo, g, modo, op);
      if (op.aceptarInvalid) p = conMarcaInvalid(p);
      if (op.bandaMuerta) p = conMarcaBandaMuerta(p, op.bandaMuerta);
      conflictos += p.conflictos;
      resumen[mes][cid] = p.resumen;
      if (involucrados.has(cid)) porCid[cid] = { niveles: p.niveles };
      for (const porFam of Object.values(p.conteos)) for (const c of Object.values(porFam)) for (const [k, v] of Object.entries(c)) conteos[k] = (conteos[k] || 0) + v;
      const meta = acc.puntos.get(cid);
      const doc = docSerie(cid, mes, meta, p.niveles);
      if (docSinCambios(doc, empaquetado(g))) sinCambios++;
      else docs.push(doc);
      if (!puntos[cid]) puntos[cid] = { clave: meta.clave, est: meta.est, elem: meta.elem, niveles: meta.niveles, meses: [] };
      puntos[cid].meses.push(mes);
    }
    // Resúmenes DERIVADOS del mes, aparte: claves '<cid>--suma' (el del transformador queda como vino).
    if (specs.length) {
      const der = derivadosDelMes({ mes, porCid, filas: filasAnalisis });
      Object.assign(resumen[mes], der);
      for (const [clave, porNivel] of Object.entries(der)) {
        for (const [nivel, r] of Object.entries(porNivel)) derivados.push({ mes, clave, nivel, base: r.derivado.base, resumen: r });
      }
    }
  }
  const catalogoMeses = {};
  for (const mes of meses) { const d = diasDelMes(acc, mes); catalogoMeses[mes] = { dias: d.mascara, nDias: d.dias, completo: d.completo }; }
  postMessage({ tipo: 'procesado', docs, resumen, catalogo: { meses: catalogoMeses, puntos }, conteos, conflictos, sinCambios, derivados, versionSuma: SUMA.version, versionInvalid: VERSION_INVALID, versionBandaMuerta: VERSION_BANDA_MUERTA });
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
