#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · preparar el paquete de un mes · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Uso:
//   node scripts/scada-empaquetar.mjs --carpeta "<ruta>/Agosto" --homologacion "<ruta>.xlsx" --salida "<dir>"
// Lee la carpeta del mes EN ESTE COMPUTADOR, deja solo lo que la página usa (formato en
// assets/js/domain/scada_carga_paquete.js), comprime, parte en trozos de ≤ 9 MB y los escribe
// en --salida (FUERA del repo: llevan datos reales). La página «Datos SCADA» los recibe en
// «Cargar mes → Paquete preparado» y sigue con el mismo análisis, simulación y guardado.
// No escribe en la base ni usa la red. No modifica los archivos originales.
// ══════════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, basename, resolve, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { leerFilasHomologacion, fusionarHomologacion, objetivoImportacion } from '../assets/js/domain/scada_carga_homologacion.js';
import { PAQUETE, seLee, filtrarTexto, aplicarRelevos, armarContenedor, partir, nombreParte } from '../assets/js/domain/scada_carga_paquete.js';
import { normalizarTexto } from '../assets/js/domain/scada_carga_csv.js';

const REPO = resolve(new URL('..', import.meta.url).pathname);

function argumento(nombre) {
  const i = process.argv.indexOf('--' + nombre);
  return i > 0 ? process.argv[i + 1] : null;
}

/** Archivos de la carpeta, recursivo y en orden estable: [{abs, ruta}] con ruta 'Mes/día/archivo'. */
function recorrer(raiz) {
  const base = basename(raiz);
  const out = [];
  const ir = (dir) => {
    for (const n of readdirSync(dir).sort()) {
      if (n === '.DS_Store') continue;
      const abs = join(dir, n);
      const st = statSync(abs);
      // Mismo criterio que la página: una subcarpeta «_…» no es de un mes (en la carpeta madre hay datos de otro proyecto).
      if (st.isDirectory() && n.startsWith('_')) throw new Error('La carpeta trae la subcarpeta «' + n + '», que no es de un mes: empaquete solo la carpeta del mes.');
      if (st.isDirectory()) ir(abs);
      else if (st.isFile()) out.push({ abs, ruta: [base, ...relative(raiz, abs).split(sep)].join('/'), nombre: n, tamano: st.size });
    }
  };
  ir(raiz);
  return out;
}

/** Estaciones de la homologación, leídas del Excel con las MISMAS opciones que la página. */
export function estacionesDelExcel(rutaExcel) {
  const require = createRequire(join(REPO, 'package.json'));
  const XLSX = require('xlsx');
  const wb = XLSX.read(readFileSync(rutaExcel), { type: 'buffer' });
  const hoja = wb.SheetNames.find((n) => /homolog/i.test(n)) || wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: false, defval: '' });
  const r = leerFilasHomologacion(aoa);
  if (!r.ok) throw new Error(r.motivo);
  return objetivoImportacion(fusionarHomologacion(r.filas, null).filas).estaciones;
}

/**
 * Relevos de estación de `--relevo` (`99 §158`): «ESTACION=NUEVA@AAAA-MM-DD», varios separados por coma.
 * Desde esa fecha, las filas de NUEVA se leen como de ESTACION (el SCADA la renombró). Lo confirma el Ingeniero.
 */
export function leerRelevos(texto) {
  return String(texto || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^([^=@]+)=([^=@]+)@(\d{4}-\d{2}-\d{2})$/);
    if (!m) throw new Error('--relevo «' + x + '»: se escribe ESTACION=NUEVA@AAAA-MM-DD.');
    const est = m[1].trim(); const nueva = m[2].trim();
    if (!est || !nueva || normalizarTexto(est) === normalizarTexto(nueva)) throw new Error('--relevo «' + x + '»: la estación y la nueva deben ser distintas.');
    return { est, nueva, desde: m[3] };
  });
}

/** Prepara el paquete de una carpeta de mes. Devuelve el informe y los trozos (sin escribirlos). */
export function empaquetar({ carpeta, estaciones, relevos = [], creado = new Date().toISOString(), parteMax = PAQUETE.parteMaxBytes }) {
  const raiz = resolve(carpeta);
  const nombreCarpeta = basename(raiz);
  if (/^_/.test(nombreCarpeta)) throw new Error('La carpeta empieza por «_»: no es un mes.');
  const set = new Set(estaciones);
  const enc = new TextEncoder();
  const archivos = [];
  let bytesOrigen = 0; let leidos = 0; let renombradas = 0; let descartadas = 0;
  for (const f of recorrer(raiz)) {
    bytesOrigen += f.tamano;
    let contenido = null;
    if (seLee(f.nombre) && f.tamano) {
      let texto = readFileSync(f.abs, 'utf8');
      if (relevos.length) { const r = aplicarRelevos(texto, relevos); texto = r.texto; renombradas += r.renombradas; descartadas += r.descartadas; }
      contenido = enc.encode(filtrarTexto(texto, set));
      leidos++;
    }
    archivos.push({ ruta: f.ruta, nombre: f.nombre, tamano: f.tamano, contenido });
  }
  const contenedor = armarContenedor({ carpeta: nombreCarpeta, creado, estaciones, relevos, origen: { archivos: archivos.length, bytes: bytesOrigen } }, archivos);
  const gz = new Uint8Array(gzipSync(contenedor, { level: 9 }));
  const sha = createHash('sha256').update(gz).digest('hex');
  const trozos = partir(gz, Math.min(parteMax, PAQUETE.parteMaxBytes));
  if (trozos.length > 99) throw new Error('El paquete daría ' + trozos.length + ' partes (máximo 99): ¿es la carpeta de UN mes?');
  const partes = trozos.map((bytes, k) => ({ nombre: nombreParte(nombreCarpeta, k + 1, trozos.length, sha), bytes }));
  return {
    carpeta: nombreCarpeta, archivos: archivos.length, leidos, bytesOrigen, relevos: { renombradas, descartadas },
    bytesContenedor: contenedor.length, bytesComprimido: gz.length, sha, partes
  };
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (esPrincipal) {
  const carpeta = argumento('carpeta'); const excel = argumento('homologacion'); const salida = argumento('salida');
  if (!carpeta || !excel || !salida) {
    console.error('Uso: node scripts/scada-empaquetar.mjs --carpeta "<mes>" --homologacion "<excel>" --salida "<dir fuera del repo>"');
    process.exit(2);
  }
  // La salida no puede quedar en el repo PÚBLICO (ni su raíz, ni con otras mayúsculas: el disco del Mac no las distingue).
  mkdirSync(salida, { recursive: true });
  const real = (x) => realpathSync(x).toLowerCase();
  if (real(salida) === real(REPO) || real(salida).startsWith(real(REPO) + sep)) { console.error('La salida no puede quedar dentro del repo: los paquetes llevan datos reales.'); process.exit(2); }
  // --extra "est1,est2": estaciones de más (p. ej. una clave confirmada en la página hacia otra estación).
  const extra = String(argumento('extra') || '').split(',').map(normalizarTexto).filter(Boolean);
  const est = [...new Set([...estacionesDelExcel(excel), ...extra])];
  // --parte-kb: trozos más chicos (solo para probar el armado de varias partes).
  const kb = Number(argumento('parte-kb')) || 0;
  // --relevo "ESTACION=NUEVA@AAAA-MM-DD": estación que el SCADA renombró (§158; nombres reales solo aquí, nunca en el repo).
  const relevos = leerRelevos(argumento('relevo'));
  const r = empaquetar({ carpeta, estaciones: est, relevos, ...(kb > 0 ? { parteMax: kb * 1024 } : {}) });
  mkdirSync(salida, { recursive: true });
  for (const p of r.partes) writeFileSync(join(salida, p.nombre), p.bytes);
  const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
  console.log(`${r.carpeta}: ${r.archivos} archivos (${mb(r.bytesOrigen)}), ${r.leidos} leídos; paquete ${mb(r.bytesContenedor)} → ${mb(r.bytesComprimido)} comprimido en ${r.partes.length} parte(s) de ≤ ${mb(PAQUETE.parteMaxBytes)}; ${est.length} estaciones; sha ${r.sha.slice(0, 12)}…`);
  for (const p of r.partes) console.log('  ' + p.nombre + '  ' + mb(p.bytes.length));
  if (relevos.length) console.log(`  relevos: ${relevos.length} · filas renombradas ${r.relevos.renombradas} · descartadas ${r.relevos.descartadas}`);
}
