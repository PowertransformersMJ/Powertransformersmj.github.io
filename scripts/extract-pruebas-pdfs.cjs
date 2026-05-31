// Extrae los 3 PDFs reales embebidos (base64) del tablero de referencia
// y los escribe a assets/docs/pruebas/{serie}/. Uso único / one-shot.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(
  path.join(ROOT, 'Tablero Dinamico de Pruebas Electricas.html'),
  'utf8'
);

const start = html.indexOf('const PDFS={');
const end = html.indexOf('\n};', start);
const block = html.slice(start, end);

const re = /(r20\d\d):\{name:'([^']+)',b64:"([A-Za-z0-9+/=]+)"\}/g;
const outDir = path.join(ROOT, 'assets/docs/pruebas/173523-15510');
fs.mkdirSync(outDir, { recursive: true });

let m;
let count = 0;
while ((m = re.exec(block))) {
  const key = m[1];
  const name = m[2];
  const b64 = m[3];
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(key, '->', name, buf.length, 'bytes');
  count++;
}
console.log('total', count);
