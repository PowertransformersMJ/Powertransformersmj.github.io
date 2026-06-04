#!/usr/bin/env node
/**
 * crm-architect — validate_crm.mjs
 * Lints a generated CRM project for the non-negotiables: required files present,
 * rules deny-by-default + org-scoping + _version, valid indexes JSON, no obvious
 * client-side secrets. Exit code 1 if any ERROR. Run before deploy.
 *
 * Usage: node validate_crm.mjs --dir ../mi-crm
 */
import { readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]);
  return a;
}, []));
const DIR = resolve(process.cwd(), args.dir || ".");
let errors = 0, warns = 0;
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m", m);
const err = (m) => { console.log("  \x1b[31m✗ ERROR\x1b[0m", m); errors++; };
const warn = (m) => { console.log("  \x1b[33m! warn\x1b[0m", m); warns++; };
const exists = async (p) => { try { await access(join(DIR, p)); return true; } catch { return false; } };
const read = async (p) => { try { return await readFile(join(DIR, p), "utf8"); } catch { return ""; } };

console.log(`\nValidating CRM project at ${DIR}\n`);

// 1) required files
for (const f of ["firebase.json", "firestore.rules", "firestore.indexes.json"]) {
  (await exists(f)) ? ok(`present: ${f}`) : err(`missing: ${f}`);
}

// 2) rules sanity
const rules = await read("firestore.rules");
if (rules) {
  /request\.auth\.token\.orgId|orgOf\(\)/.test(rules) ? ok("rules: org-scoping via token.orgId") : err("rules: no orgId scoping found");
  /_version/.test(rules) ? ok("rules: _version optimistic locking referenced") : warn("rules: no _version check found");
  /auditLog[\s\S]*?allow update, delete: if false/.test(rules) ? ok("rules: auditLog immutable") : warn("rules: auditLog not clearly immutable");
  /allow read, write: if true|allow write: if true;\s*\}\s*\}\s*$/.test(rules) ? err("rules: a blanket allow-true detected") : ok("rules: no blanket allow-true");
}

// 3) indexes valid JSON
try { const idx = JSON.parse(await read("firestore.indexes.json")); Array.isArray(idx.indexes) ? ok(`indexes: ${idx.indexes.length} composite index(es)`) : warn("indexes: no 'indexes' array"); }
catch { err("indexes: firestore.indexes.json is not valid JSON"); }

// 4) no obvious secrets in client
const clientDirs = ["public", "src"];
const SECRET = /(sk-ant-|AIza[0-9A-Za-z_-]{20,}|whatsapp_token|TWILIO_AUTH|STRIPE_SECRET|service_account|private_key)/i;
let scanned = 0;
async function scan(dir) {
  let entries = []; try { entries = await readdir(join(DIR, dir), { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") await scan(rel); }
    else if (/\.(js|mjs|ts|html|json)$/.test(e.name)) {
      scanned++; const c = await read(rel);
      // firebaseConfig apiKey (AIza...) in client is OK; flag other secrets
      if (SECRET.test(c) && !/firebaseConfig|firebase-config/.test(c)) err(`possible secret in client file: ${rel}`);
    }
  }
}
for (const d of clientDirs) await scan(d);
ok(`scanned ${scanned} client files for secrets`);

// 5) recommended files
for (const f of ["functions/index.js", ".env.example", ".github/workflows/deploy.yml"]) {
  (await exists(f)) ? ok(`present: ${f}`) : warn(`recommended missing: ${f}`);
}

console.log(`\n${errors ? "\x1b[31m" : "\x1b[32m"}Done: ${errors} error(s), ${warns} warning(s)\x1b[0m`);
console.log("Also run the manual checklist: scripts/checklist.md\n");
process.exit(errors ? 1 : 0);
