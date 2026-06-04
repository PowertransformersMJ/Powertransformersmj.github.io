---
name: crm-architect
description: >-
  Build CRM web apps on Firebase + Firestore + Node/Cloud Functions + GitHub
  for any industry, with deep packs for real estate (CRM inmobiliario) and auto
  dealerships (CRM de concesionario, usados y nuevos). Covers the data model,
  modules, sales pipeline, automation, AI (scoring, copilot, NBA), reporting,
  integrations (email, WhatsApp, calendar, e-sign, payments) and RBAC +
  GDPR/Ley 1581 compliance, plus ready Firestore rules, schemas, Functions, UI
  and CI/CD. Use whenever someone wants to build, design, scaffold or extend a
  CRM, sales/lead/contact/pipeline system, CRM inmobiliario, CRM de
  concesionario, or any customer/client/lead management app — incl. "sistema de
  gestión de clientes", "gestor de leads", "pipeline de ventas", or tracking
  customers, properties, vehicles or deals; also adding CRM modules to an app.
  Not for merely recommending CRM tools or building plain marketing pages. Be
  eager: most "manage clients/leads/sales" requests are CRM requests.
---

# CRM Builder

Build world-class CRM web apps on **Firebase + Firestore + Node (Cloud
Functions) + GitHub**. This skill carries the distilled knowledge of the
leading CRMs (Salesforce, HubSpot, Zoho, Dynamics 365, Pipedrive) and two
deep vertical packs (real estate, automotive dealership), plus ready-to-use
code. It is a **router**: read this file, then open only the reference files
you need for the current step.

## 0. How to use this skill (start here)

1. **Identify the job.** New CRM from scratch? Add a module to an existing CRM?
   Design only? Pick the vertical (real estate / dealership / generic).
2. **Run the build workflow.** Follow `references/00-build-workflow.md` — the
   end-to-end process from discovery to deploy. Don't skip discovery.
3. **Pull references on demand** using the index in §4. Read a file right
   before you implement that concern; don't load everything at once.
4. **Use the templates and generators** in `assets/templates/` and `scripts/`
   instead of writing boilerplate by hand. Adapt, don't reinvent.
5. **Hold the quality bar** in §5 on every file you write. Run
   `scripts/validate_crm.mjs` and `scripts/checklist.md` before calling it done.

> If the user is non-technical, explain choices plainly and pick sane defaults.
> If they're technical, move fast and surface trade-offs. Match their language
> (Spanish ↔ English). Generated CRM UIs default to **Spanish for LatAm clients**.

## 1. What a "world-class" CRM is (mental model)

Every serious CRM is the same spine wearing different clothes:

> **People & orgs** (leads, contacts, accounts) → **money** (deals/opportunities
> moving through a **pipeline**) → **work** (activities, tasks, communications)
> → **automation** (rules/workflows + AI) → **insight** (reporting/forecasting),
> all governed by **roles/permissions** and connected to **channels**
> (email, WhatsApp, phone, calendar).

A vertical (real estate, dealership) **replaces the "deal" object with a
domain object** (a property listing, a vehicle deal) and adds domain entities
(properties, vehicles, showings, test drives, trade-ins) — but the spine is
identical. This is why one skill builds them all. See
`references/benchmarks/world-class-crm-matrix.md` for the feature bar.

## 2. The canonical stack (defaults)

| Layer | Default | Notes |
|---|---|---|
| Auth | Firebase Auth (email/pass, Google, phone 2FA) | Custom claims carry `orgId` + `role` |
| Database | Cloud Firestore | Org-scoped, denormalized read shapes, `_version` locking |
| Backend | Cloud Functions (Node 20+) | All third-party calls + automation + AI run here |
| Storage | Firebase Storage | Files, photos, documents; signed URLs |
| Hosting | Firebase Hosting **or** GitHub Pages | Static SPA/MPA; CI/CD via GitHub Actions |
| Search | Firestore for filters; **Algolia/Typesense** for full-text | Firestore is not a search engine |
| Analytics | Firestore aggregates; **BigQuery export** for heavy reporting | Don't run big cross-tenant scans in Firestore |
| AI | **Anthropic Claude API** (via Functions) + local heuristics | Scoring, copilot, NBA, summaries, RAG |
| Realtime | Firestore `onSnapshot` | Live inbox, pipeline, presence |
| Frontend | HTML/CSS/JS (vanilla) **or** React | Vanilla is the proven default; React optional |

Full architecture, collection map, indexes, scaling and cost control:
`references/core/architecture-firebase.md`.

## 3. Universal data spine (quick reference)

Memorize this; details and fields in `references/core/data-model.md`.

| Entity | Is | Firestore (org-scoped) |
|---|---|---|
| `Org` / tenant | The company using the CRM | `orgs/{orgId}` |
| `User` | An internal user (agent/manager/admin) | `orgs/{orgId}/users/{uid}` |
| `Lead` | Unqualified potential customer | `orgs/{orgId}/leads/{id}` |
| `Contact` | A known person | `orgs/{orgId}/contacts/{id}` |
| `Account` | A company/household (optional B2C) | `orgs/{orgId}/accounts/{id}` |
| `Deal`/`Opportunity` | A revenue event in a pipeline | `orgs/{orgId}/deals/{id}` |
| `Pipeline` / `Stage` | Sales process config | `orgs/{orgId}/config/pipelines` |
| `Activity` | Task / call / meeting / note / email | `orgs/{orgId}/activities/{id}` |
| `Conversation`/`Message` | Omnichannel thread (email/WA/SMS/chat) | `orgs/{orgId}/conversations/{id}/messages/{mid}` |
| `Product` / `Quote` | Catalog + quotes/CPQ | `orgs/{orgId}/products`, `/quotes` |
| `Campaign` | Marketing campaign + members | `orgs/{orgId}/campaigns/{id}` |
| `Automation` rule | Trigger→condition→action config | `orgs/{orgId}/config/automations` |
| `AuditLog` | Immutable change log | `orgs/{orgId}/auditLog/{id}` |

**Vertical objects** layer on top:
- Real estate → `Property`/listing, `Showing`, buyer/seller pipelines, `Transaction`.
- Dealership → `Vehicle` (inventory/VIN), `TestDrive`, `TradeIn`, F&I `Deal`, `ServiceAppointment`.

## 4. Reference index — read on demand

| File | Read when you are… |
|---|---|
| `references/00-build-workflow.md` | …starting any CRM build (the master process) |
| `references/core/data-model.md` | …designing entities, fields, relationships, lifecycle |
| `references/core/architecture-firebase.md` | …setting up Firestore, Functions, indexes, search, scale |
| `references/core/security-rbac-compliance.md` | …writing rules, roles, audit, 2FA, consent/Habeas Data |
| `references/core/modules-catalog.md` | …deciding which features/modules to build |
| `references/core/sales-pipeline-process.md` | …building pipelines, stages, forecasting, quotas |
| `references/core/automation-engine.md` | …building the rules/workflow engine + recipes |
| `references/core/ai-features.md` | …adding lead scoring, copilot/agent, NBA, summaries |
| `references/core/reporting-analytics.md` | …building dashboards, KPIs, reports, forecasts |
| `references/core/ux-ui-design-system.md` | …building the UI: screens, components, tokens, a11y |
| `references/core/integrations-comms.md` | …wiring email, WhatsApp, telephony, calendar, e-sign, payments |
| `references/core/code-patterns.md` | …you need ready code: cursor pagination, optimistic UI, lead routing, virtual scroll, WhatsApp link, triggers |
| `references/verticals/real-estate.md` | …building a CRM inmobiliario |
| `references/verticals/automotive-dealership.md` | …building a CRM de concesionario |
| `references/verticals/_extending-verticals.md` | …creating a NEW vertical pack |
| `references/benchmarks/world-class-crm-matrix.md` | …checking the feature bar vs leaders |

Templates: `assets/templates/`. Generators & checklists: `scripts/`.

## 5. Non-negotiable quality bar (apply to every file)

**Security**
- Org-scoped multitenancy: every doc carries `orgId`; every query is scoped; rules **deny by default**.
- RBAC via Firebase custom claims (`orgId`, `role`); enforce role at the rule level AND the UI level.
- `_version` optimistic locking on mutable records; reject stale writes.
- **No secrets in the client.** Every third-party API (email, WhatsApp, Stripe, Claude) is called from Cloud Functions; secrets in Functions config / Secret Manager.
- Escape all user data before inserting into HTML (`escapeHtml`); use event delegation with `data-action`; never inline `onclick` with interpolated data.
- Immutable `auditLog` for create/update/delete on sensitive records.

**Compliance**
- Consent capture + audit for every contactable person. Support data-subject rights (access, rectify, delete/forget) and retention.
- Colombia **Ley 1581 (Habeas Data)**: consent must be **prior, express, informed**; respond to requests within **10 business days**; SIC is the authority. GDPR/CCPA when applicable. See `security-rbac-compliance.md`.

**UX & performance**
- WCAG AA: keyboard nav, focus management, ARIA for tables/menus/dialogs, contrast, `prefers-reduced-motion`.
- Big lists: pagination or virtualization; skeleton loaders; `content-visibility`; lazy-load heavy modules; indexed queries only (no client-side full scans).
- Optimistic UI + toasts; empty states; error states; loading states for every async action.

**Code health**
- Small, single-purpose modules with clear interfaces. No file does too much.
- Idempotent Cloud Functions; cycle/loop protection in the automation engine.
- Cache-aware deploys (version bump invalidates clients).

## 6. Templates & generators (don't hand-roll boilerplate)

| Asset | Use |
|---|---|
| `assets/templates/firestore.rules` | Org-scoped RBAC rules starter |
| `assets/templates/firestore.indexes.json` | Composite indexes for core queries |
| `assets/templates/schema.types.ts` | TypeScript types for the universal model + verticals |
| `assets/templates/functions/` | Cloud Functions skeletons (triggers, automation, AI, webhooks, integrations) |
| `assets/templates/design-tokens.css` | Design-system tokens (color/space/type/shadow/themes) |
| `assets/templates/components/` | UI component snippets (table, kanban, detail, modal, dashboard) |
| `assets/templates/workflows-rules.schema.json` | Automation rule config schema |
| `assets/templates/ai-prompts.md` | Ready Claude prompt templates (extraction, summary, NBA, sentiment) |
| `assets/templates/github-actions-deploy.yml` | CI/CD deploy pipeline |
| `assets/templates/env.example` | Required env vars / secrets |
| `scripts/scaffold_crm.mjs` | Generate the project skeleton |
| `scripts/generate_module.mjs` | Generate an entity/module (collection + UI + rules + types) |
| `scripts/validate_crm.mjs` | Validate rules/indexes/model + completeness |
| `scripts/checklist.md` | "Production-ready CRM" checklist (definition of done) |

## 7. Definition of done

A CRM built with this skill is done when: discovery captured; data model +
indexes deployed; rules deny-by-default and pass emulator tests; auth + RBAC +
audit working; core screens (dashboard, list, kanban, detail, forms) built and
accessible; at least one automation + one report live; chosen integrations
wired via Functions (no client secrets); consent/compliance handled;
seed/demo data loads; CI/CD deploys; `validate_crm.mjs` and `checklist.md`
pass. Then tune the description with `skill-creator` if needed.
