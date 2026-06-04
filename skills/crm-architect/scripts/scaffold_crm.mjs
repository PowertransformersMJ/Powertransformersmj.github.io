#!/usr/bin/env node
/**
 * crm-architect — scaffold_crm.mjs
 * Generates a CRM project skeleton (folders + base files) on the Firebase stack.
 * Copies the rich templates from this skill's assets/templates where available.
 *
 * Usage:
 *   node scaffold_crm.mjs --name "Mi CRM" --vertical real_estate --out ../mi-crm
 *   --vertical: real_estate | automotive | generic
 */
import { mkdir, writeFile, readFile, cp, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const TPL = resolve(__dir, "../assets/templates");

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]);
  return a;
}, []));
const NAME = args.name || "CRM";
const VERTICAL = args.vertical || "generic";
const OUT = resolve(process.cwd(), args.out || "./crm-app");

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const w = async (p, c) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, c); console.log("  +", p.replace(OUT + "/", "")); };
const copyTpl = async (src, dest) => {
  const s = join(TPL, src);
  if (await exists(s)) { await mkdir(dirname(dest), { recursive: true }); await cp(s, dest, { recursive: true }); console.log("  +", dest.replace(OUT + "/", "")); }
};

const DIRS = [
  "public", "public/css", "public/js", "public/js/modules", "public/js/ai",
  "functions", "functions/lib", "data", "scripts", ".github/workflows",
];

console.log(`\nScaffolding "${NAME}" (${VERTICAL}) → ${OUT}\n`);
for (const d of DIRS) await mkdir(join(OUT, d), { recursive: true });

// ---- copy rich templates from the skill ----
await copyTpl("firestore.rules", join(OUT, "firestore.rules"));
await copyTpl("firestore.indexes.json", join(OUT, "firestore.indexes.json"));
await copyTpl("schema.types.ts", join(OUT, "public/js/schema.types.ts"));
await copyTpl("design-tokens.css", join(OUT, "public/css/design-tokens.css"));
await copyTpl("components/components.css", join(OUT, "public/css/components.css"));
await copyTpl("workflows-rules.schema.json", join(OUT, "data/workflows-rules.schema.json"));
await copyTpl("seed.json", join(OUT, "data/seed.json"));
await copyTpl("env.example", join(OUT, ".env.example"));
await copyTpl("github-actions-deploy.yml", join(OUT, ".github/workflows/deploy.yml"));
await copyTpl("functions/index.js", join(OUT, "functions/index.js"));
await copyTpl("functions/package.json", join(OUT, "functions/package.json"));

// ---- firebase.json ----
await w(join(OUT, "firebase.json"), JSON.stringify({
  hosting: { public: "public", ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
    rewrites: [{ source: "**", destination: "/index.html" }] },
  firestore: { rules: "firestore.rules", indexes: "firestore.indexes.json" },
  functions: { source: "functions" },
  emulators: { auth: { port: 9099 }, firestore: { port: 8080 }, functions: { port: 5001 }, ui: { enabled: true } }
}, null, 2));

await w(join(OUT, ".firebaserc"), JSON.stringify({ projects: { default: "your-project-id" } }, null, 2));

// ---- web shell ----
await w(join(OUT, "public/index.html"), `<!doctype html>
<html lang="es" data-theme="light">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${NAME}</title>
  <link rel="stylesheet" href="css/design-tokens.css">
  <link rel="stylesheet" href="css/components.css">
</head>
<body>
  <div class="crm-shell">
    <aside class="crm-shell__sidebar" id="sidebar"></aside>
    <header class="crm-shell__header" id="header"></header>
    <main class="crm-shell__main" id="main"><div class="crm-empty">Cargando…</div></main>
  </div>
  <script type="module" src="js/firebase-config.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>`);

await w(join(OUT, "public/js/firebase-config.js"), `// Fill from .env / Firebase console. Public config is safe (security = rules+claims).
export const firebaseConfig = {
  apiKey: "", authDomain: "", projectId: "your-project-id",
  storageBucket: "", messagingSenderId: "", appId: ""
};`);

await w(join(OUT, "public/js/app.js"), `// App entry. Init Firebase, auth gate, route to modules.
// Build screens per references/core/ux-ui-design-system.md (dashboard, list, kanban, detail).
console.log("${NAME} — wire auth, then render the dashboard.");`);

// ---- README ----
await w(join(OUT, "README.md"), `# ${NAME}

CRM (${VERTICAL}) built with the crm-architect skill on Firebase + Firestore + Functions.

## Next steps
1. Create the Firebase project; set \`.firebaserc\` project id + \`public/js/firebase-config.js\`.
2. \`cd functions && npm i\`  · set secrets: \`firebase functions:secrets:set LLM_API_KEY\` (etc).
3. \`firebase emulators:start\` to develop locally; load \`data/seed.json\`.
4. Deploy: push to main (GitHub Actions) or \`firebase deploy\`.
5. Follow the build workflow in the skill's references/00-build-workflow.md.

Deploy rules/indexes explicitly: \`firebase deploy --only firestore:rules,firestore:indexes\`.
`);

await w(join(OUT, ".gitignore"), `node_modules/\n.env\n.env.local\nfunctions/node_modules/\n*.log\n.firebase/\n`);

console.log(`\n✓ Scaffolded. Next: cd ${args.out || "./crm-app"} && (set firebase project) && firebase emulators:start\n`);
