#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Regenera la geografía del mapa (assets/geo/) desde el DANE (99 §152)
// ════════════════════════════════════════════════════════════════
// Fuente: DANE – Marco Geoestadístico Nacional (MGN) 2025, WGS84, municipios (1.122, código DIVIPOLA):
//   https://geoportal.dane.gov.co/descargas/mgn_2025/MGN2025_MPIO_GRAFICO.zip  (~72 MB)
// Cita exigida: «Fuente: DANE – Marco Geoestadístico Nacional 2025». Departamentos y zonas se DISUELVEN
// desde los municipios: comparten bordes exactos. Zonas AFINIA según domain/schema.js (BOLIVAR = Bolívar ·
// OCCIDENTE = Córdoba + Sucre · ORIENTE = Cesar + los 11 municipios del Magdalena del MO.00418): APROXIMADAS
// hasta validarlas.
//   node scripts/mapa-geo/construir.mjs <carpeta-de-trabajo-fuera-del-repo>
// Después: npm run test:unit (tests/mapa_parque.test.js amarra 33 departamentos, 138 municipios y 5 departamentos).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = process.argv[2];
if (!T) { console.error('uso: node scripts/mapa-geo/construir.mjs <carpeta-de-trabajo>'); process.exit(2); }
mkdirSync(T, { recursive: true });
const zip = join(T, 'MGN2025_MPIO_GRAFICO.zip');
if (!existsSync(zip)) execFileSync('curl', ['-L', '-o', zip, 'https://geoportal.dane.gov.co/descargas/mgn_2025/MGN2025_MPIO_GRAFICO.zip'], { stdio: 'inherit' });
// Huella del ZIP con el que se generó lo publicado (2026-10-07): si el DANE lo cambia, se avisa y no se sigue.
const SHA256_MGN2025 = 'a3c01393059be8f2947de5e0a828faa4c7a43119819a667a8124854340bc141f';
const huella = createHash('sha256').update(readFileSync(zip)).digest('hex');
if (huella !== SHA256_MGN2025 && !process.argv.includes('--acepto-otra-version')) {
  console.error(`✖ El ZIP del MGN no es el de 2026-10-07 (sha256 ${huella}). Revise la versión y repita con --acepto-otra-version.`);
  process.exit(1);
}
execFileSync('unzip', ['-o', '-q', zip, '-d', join(T, 'dane')]);
const buscar = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? buscar(join(d, e.name)) : (/MPIO.*\.shp$/i.test(e.name) ? [join(d, e.name)] : []));
const SRC = buscar(join(T, 'dane'))[0];
if (!SRC) throw new Error('no se encontró el shapefile de municipios');

const { MUNICIPIOS_MAGDALENA } = await import(join(REPO, 'assets/js/domain/schema.js'));
const { ZONA_EXCEPCIONES } = await import(join(REPO, 'assets/js/domain/mapa_parque.js'));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const MAG = JSON.stringify(MUNICIPIOS_MAGDALENA.map(norm));
const NORM = "nom.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().trim()";
const AFINIA = `['13','20','23','70'].indexOf(dpto) >= 0 || (dpto == '47' && ${MAG}.indexOf(${NORM}) >= 0)`;
// Misma regla que domain/mapa_parque.js#zonaDeMunicipio (departamento + excepciones por municipio).
const ZONA = `zona = ${JSON.stringify(ZONA_EXCEPCIONES)}[cod] || (dpto == '13' ? 'BOLIVAR' : (dpto == '23' || dpto == '70') ? 'OCCIDENTE' : 'ORIENTE')`;
const PREP = ['-each', 'cod=mpio_cdpmp, nom=mpio_cnmbr, dpto=dpto_ccdgo, dnom=dpto_cnmbr', '-filter-fields', 'cod,nom,dpto,dnom'];
const ms = (...a) => execFileSync('npx', ['-y', 'mapshaper@0.7.80', ...a], { cwd: T, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' } });

// 1) 33 departamentos (800 m)
ms(SRC, '-dissolve', 'dpto_ccdgo', 'copy-fields=dpto_cnmbr', '-rename-fields', 'cod=dpto_ccdgo,nom=dpto_cnmbr',
  '-simplify', 'interval=800', 'keep-shapes', '-filter-islands', 'min-area=2km2', 'remove-empty',
  '-o', 'colombia-departamentos.topo.json', 'format=topojson', 'quantization=1e5');
// 2) Área AFINIA: municipios (100 m) + departamentos + zonas, en UNA topología
ms(SRC, ...PREP, '-filter', AFINIA, '-each', ZONA, '-simplify', 'interval=100', 'keep-shapes', '-rename-layers', 'mpios',
  '-dissolve', 'dpto', '+', 'name=dptos', '-dissolve', 'zona', 'target=mpios', '+', 'name=zonas',
  '-o', 'afinia-servicio.topo.json', 'format=topojson', 'quantization=1e6', 'target=mpios,dptos,zonas');
// 3) 1.122 municipios del país (500 m)
ms(SRC, ...PREP, '-simplify', 'interval=500', 'keep-shapes', '-o', 'colombia-municipios.topo.json', 'format=topojson', 'quantization=1e5');
// 4) Puntos interiores para los rótulos
ms('colombia-departamentos.topo.json', '-points', 'inner', '-o', 'pts-dptos.json', 'format=geojson', 'precision=0.0001');
ms('afinia-servicio.topo.json', '-points', 'inner', 'target=mpios', '-o', 'pts-mpios.json', 'format=geojson', 'precision=0.0001');
// Los 5 departamentos de AFINIA se rotulan dentro de su ÁREA DE SERVICIO (Magdalena: sus 11 municipios), no del
// departamento completo: si no, el conteo del parque caería en un municipio que AFINIA no atiende.
ms('afinia-servicio.topo.json', '-points', 'inner', 'target=dptos', '-o', 'pts-dptos-afinia.json', 'format=geojson', 'precision=0.0001');
const pd = JSON.parse(readFileSync(join(T, 'pts-dptos.json'), 'utf8'));
const pm = JSON.parse(readFileSync(join(T, 'pts-mpios.json'), 'utf8'));
const punto = (f) => [+f.geometry.coordinates[1].toFixed(4), +f.geometry.coordinates[0].toFixed(4)];
const rot = { fuente: 'DANE MGN 2025 (puntos interiores calculados con mapshaper)', dptos: {}, mpios: {} };
for (const f of pd.features) rot.dptos[f.properties.cod] = punto(f);
for (const f of pm.features) if (f.properties && f.properties.cod) rot.mpios[f.properties.cod] = punto(f);
for (const f of JSON.parse(readFileSync(join(T, 'pts-dptos-afinia.json'), 'utf8')).features) rot.dptos[f.properties.dpto] = punto(f);
writeFileSync(join(T, 'rotulos.json'), JSON.stringify(rot));
for (const f of ['colombia-departamentos.topo.json', 'afinia-servicio.topo.json', 'colombia-municipios.topo.json', 'rotulos.json'])
  copyFileSync(join(T, f), join(REPO, 'assets/geo', f));
console.log('✅ assets/geo/ regenerado desde el MGN 2025 → npm run test:unit');
