# 00 — CRM Build Workflow (discovery → deploy)

The end-to-end process for building a CRM with this skill. Work top to bottom;
each phase points to the reference file with the depth. Don't skip discovery —
it prevents 80% of rework.

## Table of contents
1. Phase 0 — Discovery & scoping
2. Phase 1 — Project & infra setup
3. Phase 2 — Data model
4. Phase 3 — Security, RBAC & compliance
5. Phase 4 — UI shell & design system
6. Phase 5 — Core record screens (list / kanban / detail / forms)
7. Phase 6 — Modules (pipeline, activities, inbox, products/quotes)
8. Phase 7 — Automation engine
9. Phase 8 — AI layer
10. Phase 9 — Integrations & communications
11. Phase 10 — Reporting & dashboards
12. Phase 11 — Vertical pack
13. Phase 12 — Seed data, testing, deploy, monitoring
14. Build order cheat-sheet & MVP cut

---

## Phase 0 — Discovery & scoping

Ask (adapt to the user's technical level; pick defaults if they don't know):

- **Vertical**: real estate, dealership, or generic? (→ pick the vertical pack)
- **Who uses it**: roles (owner/super_admin, manager, agent/salesperson, viewer, BDC). How many users / orgs? Single company or multi-tenant SaaS?
- **Core objects**: what are they tracking — leads, contacts, deals, properties, vehicles? List the must-have entities.
- **Pipeline(s)**: what stages does a deal go through? (Real estate has separate buyer & seller pipelines; dealerships have a showroom + internet/BDC flow.)
- **Channels**: email? WhatsApp? phone? web forms? portal leads (Fincaraíz/MercadoLibre)?
- **Must-have modules** (from `core/modules-catalog.md`): rank them; cut to an MVP.
- **Integrations**: email sync, WhatsApp, calendar, e-sign, payments, portals.
- **AI**: lead scoring? a copilot/chatbot? next-best-action? summaries?
- **Compliance/region**: Colombia (Ley 1581) / GDPR / CCPA? Language (default Spanish for LatAm).
- **Brand**: colors, logo, name → feeds the design tokens.

**Output of Phase 0**: a one-page scope (entities, roles, pipelines, modules,
integrations, AI, compliance) + an MVP cut. Confirm with the user before coding.

> Tip: read `verticals/<chosen>.md` now to ground the entity list, and skim
> `benchmarks/world-class-crm-matrix.md` so you don't miss table-stakes features.

## Phase 1 — Project & infra setup

1. Create the Firebase project (Auth, Firestore, Storage, Functions, Hosting).
2. Create the GitHub repo; wire `assets/templates/github-actions-deploy.yml`.
3. Scaffold the app skeleton with `scripts/scaffold_crm.mjs` (folders, base
   `index.html`/SPA shell, `firebase-config.js`, Functions project, `.env`).
4. Enable Auth providers; set up custom-claims minting (a Function that sets
   `orgId` + `role` on a user). See `core/security-rbac-compliance.md`.
5. Decide hosting: Firebase Hosting (recommended for apps with Functions) or
   GitHub Pages (static + Functions on Firebase). Configure `firebase.json`.

Depth: `core/architecture-firebase.md`.

## Phase 2 — Data model

1. Start from the **universal spine** (`core/data-model.md`): Org, User, Lead,
   Contact, Account, Deal, Pipeline/Stage, Activity, Conversation/Message,
   Product/Quote, Campaign, Automation, AuditLog.
2. Apply the **vertical extension** (Property/Vehicle + domain objects).
3. Generate `schema.types.ts` (adapt `assets/templates/schema.types.ts`).
4. Define the **Firestore collection map** (org-scoped) + denormalized read
   shapes (e.g., store `ownerName` on the deal to avoid extra reads).
5. Write `firestore.indexes.json` for every composite query you'll run.
6. Plan search: which entities need full-text → mirror to Algolia/Typesense.

Depth: `core/data-model.md`, `core/architecture-firebase.md`.

## Phase 3 — Security, RBAC & compliance

1. Define the **role matrix** (who can read/write/delete which entity/field).
2. Write `firestore.rules`: deny by default; scope every rule by `orgId` from
   the auth token; enforce role; protect `auditLog` (create-only/immutable);
   field-level guards (e.g., only managers change `ownerId`).
3. Add `_version` optimistic-locking checks in rules + client.
4. Wire **audit logging** (Function trigger writes to `auditLog`).
5. Implement **consent + Habeas Data**: consent flags + timestamp + source on
   every contactable person; data-subject request handling (access/rectify/
   forget); retention policy. 2FA for privileged roles.
6. Test rules with the Firestore emulator (member passes, other tenant fails,
   cross-tenant collectionGroup denied).

Depth: `core/security-rbac-compliance.md`.

## Phase 4 — UI shell & design system

1. Drop in `assets/templates/design-tokens.css` and set brand colors.
2. Build the app shell: auth screens, top bar / sidebar nav, org switcher,
   global search (Cmd+K), notifications/bell, user menu.
3. Build the **dashboard/home**: KPI cards, pipeline summary, today's tasks,
   activity feed, leaderboards.
4. Establish the component library (`assets/templates/components/`): button,
   input, select, table, card, modal, drawer, tabs, badge, avatar, toggle,
   skeleton, toast, kanban card.

Depth: `core/ux-ui-design-system.md`.

## Phase 5 — Core record screens

For each primary entity (Lead, Contact, Deal, + vertical object) build:
1. **List/table view**: column config, filters, saved views, sort, bulk
   actions, inline edit, pagination/virtualization, density.
2. **Kanban/pipeline view** (for Deals + vertical pipelines): draggable cards,
   stage columns, weighted totals, WIP, rotting/stale flags.
3. **Record detail page**: highlights header + key actions, tabs, **activity
   timeline**, related lists/side panels, edit-in-place.
4. **Create/edit forms & wizards**: validation, optimistic save, conflict
   handling (`_version`), multi-step where needed.

Use `scripts/generate_module.mjs` to scaffold each entity's collection + UI +
rules + types together. Depth: `core/ux-ui-design-system.md`.

## Phase 6 — Modules

Build the modules ranked in Phase 0. Common ones (see `core/modules-catalog.md`):
- **Pipeline & deal management** (`core/sales-pipeline-process.md`)
- **Activities & tasks** (calendar, reminders, follow-up cadences)
- **Omnichannel inbox** (email/WhatsApp/SMS/chat unified) — needs Phase 9
- **Products & quotes / CPQ**
- **Campaigns / marketing**
- **Service/support tickets** (if relevant)
- **Lead capture** (web forms, portal/ads lead intake → `Lead`)

## Phase 7 — Automation engine

1. Build the rule runner: triggers (`onCreate`/`onUpdate`/`onWrite`,
   scheduled, inbound webhook), conditions/branching, actions (update, create,
   assign, notify, send message, call webhook, wait/delay).
2. Store rules as config in Firestore (`config/automations`); validate against
   `assets/templates/workflows-rules.schema.json`.
3. Implement core recipes: lead assignment/round-robin, follow-up reminders,
   stage-change tasks, SLA escalation, deal-rotting alerts, nurture drips.
4. Idempotency + cycle protection (cap executions per source event).

Depth: `core/automation-engine.md`.

## Phase 8 — AI layer

Pragmatic AI on Firebase + Claude API (all via Functions):
1. **Lead/deal scoring** (weighted rules first; optional ML later).
2. **Next-best-action** suggestions per record.
3. **Copilot/agent**: chat over CRM data (RAG + function-calling to do CRM
   actions), email/message drafting, call/thread **summaries**.
4. **Enrichment & dedup**, **smart routing**.

Depth: `core/ai-features.md`.

## Phase 9 — Integrations & communications

Wire the channels chosen in Phase 0, each via Cloud Functions (tokens stored
server-side, webhooks handled, messages logged to the record/conversation):
- **Email** (Gmail/Outlook sync or transactional via SendGrid/Resend)
- **WhatsApp** (Business Cloud API: templates, 24h window, opt-in)
- **SMS / telephony** (Twilio: click-to-call, logging)
- **Calendar** (Google/Outlook + booking links)
- **E-signature** (DocuSign/Dropbox Sign), **payments** (Stripe), **portals**.

Depth: `core/integrations-comms.md`.

## Phase 10 — Reporting & dashboards

1. Operational dashboards (KPI cards, pipeline, activity, leaderboards).
2. Reports (by user/source/stage; conversion; velocity; win rate).
3. **Forecasting** (weighted pipeline; optional AI win-probability).
4. Heavy/long-range analytics → export events to BigQuery.

Depth: `core/reporting-analytics.md`.

## Phase 11 — Vertical pack

Apply the full vertical (`verticals/real-estate.md` or
`verticals/automotive-dealership.md`): domain entities, domain pipelines,
domain modules (matching/alerts, showings; VIN/inventory, test drives, F&I,
trade-in, BDC), and domain integrations (MLS/portals; ADF leads, valuation).

## Phase 12 — Seed data, testing, deploy, monitoring

1. Load seed/demo data (`assets/templates/seed.json`).
2. Tests: rules (emulator), Functions (unit/integration), critical flows.
3. Deploy via GitHub Actions; verify rules + indexes deployed.
4. Monitoring & cost control: usage alerts, error logging, rate limits,
   Firestore read/write budgets (`core/architecture-firebase.md`).
5. Run `scripts/validate_crm.mjs` and `scripts/checklist.md`.

---

## Build-order cheat-sheet & MVP cut

**Always**: Phase 0 → 1 → 2 → 3 first. Never build UI before the model + rules.

**Fastest valuable MVP** (1 vertical, 1 pipeline):
`Org/User/auth/RBAC → Lead+Contact+Deal model & rules → dashboard + list +
kanban + detail + create form → 1 automation (lead assignment) + follow-up
reminders → WhatsApp OR email channel → 1 report → seed + deploy.`
Everything else (quotes, campaigns, AI copilot, extra integrations, full
reporting) is iteration 2+.
