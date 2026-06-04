# crm-architect — Design Spec

> Approved design for the `crm-architect` skill. Date: 2026-06-03.
> Built with the `skill-creator` tooling. Authored from research across the
> world's leading CRMs (Salesforce, HubSpot, Zoho, Dynamics 365, Pipedrive)
> and vertical leaders (BoldTrail/kvCORE, Follow Up Boss, Lofty for real
> estate; VinSolutions, DealerSocket, Tekion, Elead for dealerships).

## 1. Goal

A single, universal skill that takes Claude from zero to a production-grade
CRM web app, for **any industry**, with two deep vertical packs:
**real estate (inmobiliario)** and **automotive dealerships (concesionario,
used + new)**. It must contain "absolutely everything": domain knowledge,
data blueprints, ready-to-use code/templates, infrastructure, scalability,
and an extensibility path for new verticals.

## 2. Locked decisions (from user)

| Decision | Choice |
|---|---|
| What the skill produces | EVERYTHING: knowledge + blueprint + scaffolding + working code + infra + scalability |
| Reference stack | **Firebase + Firestore + Node.js (Cloud Functions) + GitHub** (the user's proven stack) |
| Verticals | (1) Real estate, (2) Automotive dealership, (3) Universal core + vertical packs, all segmented |
| Ambition | "Massive, never-before-built, the best in the world." Do not self-limit. |

## 3. Architecture (chosen over single-mega-file and multi-skill)

A SKILL.md **router** + layered references (core / verticals / benchmarks) +
`assets/templates/` (ready code) + `scripts/` (generators). This is the
official multi-domain skill pattern and scales cleanly.

```
crm-architect/
├── SKILL.md
├── docs/DESIGN-SPEC.md                 (this file)
├── references/
│   ├── 00-build-workflow.md
│   ├── core/  (data-model, modules-catalog, sales-pipeline-process,
│   │           automation-engine, ai-features, reporting-analytics,
│   │           ux-ui-design-system, integrations-comms,
│   │           security-rbac-compliance, architecture-firebase)
│   ├── verticals/ (real-estate, automotive-dealership, _extending-verticals)
│   └── benchmarks/ (world-class-crm-matrix)
├── assets/templates/ (firestore.rules, firestore.indexes.json,
│   schema.types.ts, seed.json, functions/, design-tokens.css,
│   components/, workflows-rules.schema.json, github-actions-deploy.yml,
│   env.example)
└── scripts/ (scaffold_crm.mjs, generate_module.mjs, validate_crm.mjs,
    checklist.md)
```

## 4. Build phases

- **F1 Foundation** — SKILL.md, 00-build-workflow, data-model, architecture-firebase, security-rbac-compliance
- **F2 Core** — modules-catalog, sales-pipeline-process, automation-engine, reporting-analytics, ux-ui-design-system, integrations-comms, ai-features
- **F3 Verticals** — real-estate, automotive-dealership, _extending-verticals, world-class-crm-matrix
- **F4 Templates & scripts** — all of `assets/templates/` and `scripts/`
- **F5 Polish** — cross-links, master checklist, optional eval for trigger tuning

## 5. Non-negotiable principles encoded in the skill

1. **Security-first & org-scoped multitenancy** — `orgId` in every doc/path; Firestore rules deny by default; RBAC via custom claims.
2. **Optimistic locking** — `_version` on mutable records.
3. **XSS-safe rendering** — escape user data; event delegation; no inline `onclick`.
4. **No secrets in the client** — all third-party API calls via Cloud Functions; secrets in Functions config/Secret Manager.
5. **Compliance** — consent + audit + data-subject rights (GDPR/CCPA) and Colombia **Ley 1581 Habeas Data** (prior/express/informed consent, 10-business-day responses, SIC).
6. **Accessibility (WCAG AA)** and **performance** (skeletons, virtualization, content-visibility, lazy-load, indexed queries).
7. **Spanish/LatAm UI by default** for Colombian clients, with locale specifics (estrato, Fasecolda, COP, portals).
8. **Progressive disclosure** — SKILL.md stays a concise router; depth lives in references; large refs have a table of contents.

## 6. Language policy

Skill instructions are written in English (clarity + execution quality +
ecosystem norm). The `description` triggers on Spanish AND English phrases.
Generated CRM UIs and LatAm specifics are Spanish. A full Spanish edition can
be produced on request.

## 7. Key research sources

Salesforce/HubSpot/Zoho AI agents 2026; HubSpot Breeze (GPT-5, Jan 2026);
BoldTrail/kvCORE vs Lofty; automotive CRM landscape (VinSolutions/DealerSocket/
Tekion); Salesforce object model; Firestore multi-tenant best practices;
Colombia Ley 1581 (Habeas Data, SIC); WhatsApp Business API per-message pricing
(Jul 2025). Full citations live inside each reference file.
