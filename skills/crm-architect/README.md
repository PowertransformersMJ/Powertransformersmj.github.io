# crm-architect

A universal skill for building **world-class CRM web apps** on **Firebase +
Firestore + Node (Cloud Functions) + GitHub**, for any industry — with deep
vertical packs for **real estate (inmobiliario)** and **auto dealerships
(concesionario, usados + nuevos)**.

It carries the distilled knowledge of the leading CRMs (Salesforce/Agentforce,
HubSpot/Breeze, Zoho/Zia, Dynamics, Pipedrive) and the vertical leaders
(BoldTrail/kvCORE, Follow Up Boss, Lofty; VinSolutions, DealerSocket, Tekion),
plus ready-to-use code (rules, schemas, Functions, UI, CI/CD).

## How it works
`SKILL.md` is a **router**. Read it first, then open only the reference files you
need for the current step. Use the templates and generators instead of writing
boilerplate.

```
crm-architect/
├── SKILL.md                         ← start here (router + workflow + stack)
├── docs/DESIGN-SPEC.md
├── references/
│   ├── 00-build-workflow.md         ← the 0→deploy process
│   ├── core/                        ← universal: data model, architecture,
│   │                                  security/compliance, modules, pipeline,
│   │                                  automation, AI, reporting, UX, integrations
│   ├── verticals/                   ← real-estate, automotive-dealership, extending
│   └── benchmarks/                  ← world-class feature matrix
├── assets/templates/                ← firestore.rules, indexes, schema.types.ts,
│                                       functions/, design-tokens.css, components/,
│                                       workflows schema, CI/CD, seed, env
└── scripts/                         ← scaffold_crm, generate_module, validate_crm, checklist
```

## Quick start (build a CRM)
1. Trigger the skill ("build me a CRM for …"); it runs `references/00-build-workflow.md`.
2. Scaffold: `node scripts/scaffold_crm.mjs --name "Mi CRM" --vertical real_estate --out ../mi-crm`.
3. Follow the workflow: data model → security → UI shell → modules → automation →
   AI → integrations → reporting → vertical pack → deploy.
4. Validate before shipping: `node scripts/validate_crm.mjs --dir ../mi-crm` + `scripts/checklist.md`.

## Principles (non-negotiable)
Org-scoped multitenancy · deny-by-default Firestore rules · RBAC via custom
claims · `_version` optimistic locking · immutable audit log · secrets
server-side only · consent + Habeas Data/GDPR · WCAG AA · performance by design ·
config-driven custom fields/pipelines so one skill builds any vertical.

## Stack
Firebase Auth · Firestore · Cloud Functions (Node) · Storage · Hosting/GitHub
Pages · Algolia/Typesense (search) · BigQuery (heavy analytics) · Anthropic
Claude API (AI). Default UI: Spanish for LatAm clients.

See `docs/DESIGN-SPEC.md` for the design rationale and research sources.
