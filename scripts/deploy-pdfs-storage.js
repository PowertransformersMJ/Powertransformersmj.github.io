#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Deploy PDFs contractuales a Firebase Storage
// (Fase 4 · 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Sube los PDFs de `assets/docs/contratos/{cid}/*.pdf` al bucket
// gs://sgm-transpower.appspot.com/contratos/{cid}/{slug}.pdf usando
// el Admin SDK con service-account credentials.
//
// USO desde la Mac del director:
//   1. Asegurar que firebase-admin esté instalado:
//        cd /ruta/al/repo
//        npm install firebase-admin --save-dev
//   2. Tener service-account.json descargado de Firebase Console →
//      Project Settings → Service Accounts → Generate new private key
//   3. Ejecutar:
//        node scripts/deploy-pdfs-storage.js \
//          --service-account ~/Desktop/service-account.json \
//          [--contrato 4123000081]   (opcional, default: todos)
//          [--dry-run]               (opcional, solo lista lo que subiría)
//
// El script genera URLs públicas con tokens y las inyecta en
// /contratos/{cid}.documentos_contractuales[] de Firestore para
// que la página pages/contrato-info.html las consuma como override.
//
// IDEMPOTENCIA: si un archivo ya existe en Storage con el mismo md5
// el script lo skipea. Re-ejecutar es seguro.
// ══════════════════════════════════════════════════════════════

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── CLI args ───────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    'service-account': { type: 'string' },
    'contrato':        { type: 'string', multiple: true, default: [] },
    'dry-run':         { type: 'boolean', default: false },
    'help':            { type: 'boolean', default: false }
  }
});

if (values.help) {
  console.log(`
Uso: node scripts/deploy-pdfs-storage.js [opciones]

Opciones:
  --service-account <path>   Path al service-account.json (REQUERIDO)
  --contrato <id>            Solo subir un contrato (repetible). Default: todos
  --dry-run                  Listar lo que se subiría sin subir
  --help                     Esta ayuda
`);
  process.exit(0);
}

const SA_PATH = values['service-account'];
if (!SA_PATH || !existsSync(SA_PATH)) {
  console.error('ERROR: --service-account es requerido y debe ser un archivo válido.');
  process.exit(1);
}

const DRY_RUN = !!values['dry-run'];
const CONTRATOS_FILTER = values.contrato || [];

// ── firebase-admin lazy import ─────────────────────────────────
async function loadAdmin() {
  let admin;
  try {
    admin = await import('firebase-admin');
  } catch (err) {
    console.error('ERROR: firebase-admin no está instalado.');
    console.error('  Ejecutar: npm install firebase-admin --save-dev');
    process.exit(1);
  }
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
  const app = admin.default.initializeApp({
    credential: admin.default.credential.cert(sa),
    storageBucket: `${sa.project_id}.appspot.com`
  });
  return { admin: admin.default, app };
}

function md5File(path) {
  const buf = readFileSync(path);
  return createHash('md5').update(buf).digest('hex');
}

async function subirContrato(admin, cid) {
  const dir = join(REPO_ROOT, 'assets/docs/contratos', cid);
  if (!existsSync(dir)) {
    console.warn(`  ⚠ ${cid}: carpeta no existe (${dir})`);
    return null;
  }

  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.warn(`  ⚠ ${cid}: manifest.json no existe`);
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const bucket = admin.storage().bucket();
  const fs = admin.firestore();

  const docsConURLs = [];
  for (const item of manifest.documentos) {
    const localPath = join(dir, item.archivo);
    if (!existsSync(localPath)) {
      console.warn(`    ⚠ ${item.archivo}: no encontrado, skip`);
      continue;
    }
    const remotePath = `contratos/${cid}/${item.archivo}`;
    const localMd5 = md5File(localPath);
    const fileRef = bucket.file(remotePath);

    let needUpload = true;
    try {
      const [meta] = await fileRef.getMetadata();
      // Cloud Storage devuelve md5Hash en base64; convertir a hex
      const remoteMd5 = Buffer.from(meta.md5Hash, 'base64').toString('hex');
      if (remoteMd5 === localMd5) {
        needUpload = false;
        console.log(`    = ${item.archivo} (idéntico md5)`);
      }
    } catch (_) { /* not found */ }

    if (needUpload && !DRY_RUN) {
      console.log(`    + ${item.archivo} (${(item.peso_bytes/1024/1024).toFixed(1)} MB)`);
      await fileRef.save(readFileSync(localPath), {
        metadata: { contentType: 'application/pdf' },
        resumable: false
      });
    } else if (needUpload) {
      console.log(`    [dry-run] subiría ${item.archivo}`);
    }

    // Generar URL firmada (10 años) o usar URL pública vía makePublic
    // según la regla. Para Firebase Storage default rules con tokens
    // largos, usamos getDownloadURL via getSignedUrl con expires lejano.
    let url = '';
    if (!DRY_RUN) {
      const [signed] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '01-01-2100' // ~76 años, prácticamente permanente
      });
      url = signed;
    }

    docsConURLs.push({
      titulo: item.titulo,
      archivo: item.archivo,
      categoria: item.categoria,
      peso_bytes: item.peso_bytes,
      url
    });
  }

  // Persistir el array en /contratos/{cid}.documentos_contractuales
  if (!DRY_RUN && docsConURLs.length > 0) {
    await fs.collection('contratos').doc(cid).set(
      {
        documentos_contractuales: docsConURLs,
        documentos_contractuales_updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    console.log(`    ✓ Firestore: documentos_contractuales actualizado en /contratos/${cid}`);
  }

  return docsConURLs;
}

async function main() {
  console.log('═══ Deploy PDFs contractuales → Firebase Storage ═══');
  console.log(`  service-account: ${SA_PATH}`);
  console.log(`  dry-run: ${DRY_RUN}`);
  console.log();

  const { admin } = await loadAdmin();

  const todosContratos = readdirSync(join(REPO_ROOT, 'assets/docs/contratos'))
    .filter((d) => /^\d{8,14}$/.test(d));
  const aProcesar = CONTRATOS_FILTER.length > 0
    ? CONTRATOS_FILTER
    : todosContratos;

  for (const cid of aProcesar) {
    console.log(`▶ ${cid}`);
    await subirContrato(admin, cid);
  }

  console.log();
  console.log('═══ Listo ═══');
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
