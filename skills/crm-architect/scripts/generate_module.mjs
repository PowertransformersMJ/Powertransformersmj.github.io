#!/usr/bin/env node
/**
 * crm-architect — generate_module.mjs
 * Scaffolds a new entity/module: a JS module (list+form render stub), a Firestore
 * rules snippet, an index suggestion, and a TS type stub — wired to the universal
 * conventions (org-scoped, _version, audit). Use for custom or new-vertical objects.
 *
 * Usage:
 *   node generate_module.mjs --entity policy --fields "number:text,premium:currency,status:select" --out ../mi-crm
 */
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]);
  return a;
}, []));
const ENTITY = (args.entity || "").trim();
if (!ENTITY) { console.error("Need --entity <name> (singular, e.g. policy)"); process.exit(1); }
const OUT = resolve(process.cwd(), args.out || ".");
const COLL = ENTITY.endsWith("s") ? ENTITY : ENTITY + "s";
const Cap = ENTITY[0].toUpperCase() + ENTITY.slice(1);
const fields = (args.fields || "name:text").split(",").map(f => {
  const [key, type = "text"] = f.split(":"); return { key: key.trim(), type: type.trim() };
});
const w = async (p, c) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, c); console.log("  +", p); };

// ---- TS type stub ----
const tsFields = fields.map(f => `  ${f.key}?: ${({ number: "number", currency: "number", bool: "boolean", date: "string" })[f.type] || "string"};`).join("\n");
await w(join(OUT, `types/${ENTITY}.ts`),
`import type { SystemFields, ID } from "../schema.types";
export interface ${Cap} extends SystemFields {
  ownerId: ID; ownerName?: string;
${tsFields}
}\n`);

// ---- module stub (list + form render) ----
await w(join(OUT, `public/js/modules/${ENTITY}.js`),
`// ${Cap} module — org-scoped CRUD with _version locking + audit (via Functions).
// Render a list (crm-table) + form (crm-field). See ux-ui-design-system.md.
export const ${ENTITY}Schema = ${JSON.stringify(fields, null, 2)};

export function render${Cap}List(container, rows) {
  // build a .crm-table from rows; wire row click → detail; bulk actions; filters.
  // remember: escape user data before innerHTML.
}
export function ${ENTITY}FormFields() { return ${ENTITY}Schema; }
export function new${Cap}(orgId, ownerId) {
  return { orgId, ownerId, createdAt: Date.now(), _version: 1 };
}\n`);

// ---- rules snippet ----
const rulesSnippet =
`
      // ---- ${COLL} (generated) ----
      match /${COLL}/{id} {
        allow read:   if inOrg(orgId);
        allow create: if validCreate(orgId) && isEditor();
        allow update: if inOrg(orgId) && canWriteRecord() && validUpdate();
        allow delete: if inOrg(orgId) && isAdmin();
      }
`;
await w(join(OUT, `data/_rules-snippet-${COLL}.txt`),
`Paste inside the  match /orgs/{orgId} { … }  block of firestore.rules:\n${rulesSnippet}`);

// ---- index suggestion ----
await w(join(OUT, `data/_index-suggestion-${COLL}.json`), JSON.stringify({
  collectionGroup: COLL, queryScope: "COLLECTION",
  fields: [{ fieldPath: "ownerId", order: "ASCENDING" }, { fieldPath: "createdAt", order: "DESCENDING" }]
}, null, 2));

console.log(`\n✓ Module "${ENTITY}" generated.
  - Add the rules snippet to firestore.rules and the index to firestore.indexes.json.
  - Register the module in the app router/sidebar.
  - Add ${Cap} to schema.types.ts (or import types/${ENTITY}.ts).\n`);
