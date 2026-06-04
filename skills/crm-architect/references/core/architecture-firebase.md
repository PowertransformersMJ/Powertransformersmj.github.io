# Core — Firebase / Firestore Architecture

How to run a multi-tenant CRM on **Firebase Auth + Firestore + Cloud Functions
(Node) + Storage + Hosting/GitHub + Algolia + BigQuery**. Firestore best
practices per Google. [source: https://firebase.google.com/docs/firestore/best-practices]

## Table of contents
1. System diagram
2. Multitenancy model
3. Firestore modeling rules
4. Indexes & query limits
5. Cloud Functions topology
6. Search (Algolia/Typesense)
7. Reporting at scale (BigQuery)
8. Files & storage
9. Realtime & offline
10. Background jobs & scheduling
11. Performance, cost control & quotas
12. Hosting & deploy
13. Environments & secrets

---

## 1. System diagram

```
Browser (SPA/MPA)
  ├─ Firebase Auth (custom claims: orgId, role)
  ├─ Firestore SDK  ── onSnapshot/realtime, offline cache ──▶ Firestore (org-scoped)
  ├─ Storage SDK ──▶ Firebase Storage (photos, docs)
  └─ HTTPS callable / fetch ──▶ Cloud Functions (Node)
                                  ├─ Firestore triggers (automation, audit, fan-out)
                                  ├─ Scheduled (cron: rollups, drips, SLA, rotting)
                                  ├─ Callables (convertLead, score, copilot, quote PDF)
                                  ├─ HTTPS webhooks (WhatsApp, email, Stripe, portals)
                                  └─ Integrations (Gmail/Graph, Twilio, Claude API)
Firestore ── change stream ──▶ Algolia (search)   ── export ──▶ BigQuery (analytics)
```

## 2. Multitenancy model

**Org-scoped, shared-schema** is the right default: one Firestore, every doc
under `orgs/{orgId}/…`, `orgId` + `role` in the Firebase Auth **custom claims**.
[source: https://wild.codes/candidate-toolkit-question/how-do-you-model-firestore-multi-tenant-data-for-speed-and-safety]

- Security boundary = `orgs/{orgId}`. Rules check `request.auth.token.orgId == orgId`.
- Put `orgId` in every queryable path AND as a field (for collection-group queries).
- Mint claims in a Function on user creation/role change; client refreshes its
  token (`getIdToken(true)`) after claim changes.
- Single-company CRM = just one org. Same code scales to SaaS multi-tenant.
- Stronger isolation option: Firebase Auth **multi-tenancy (GCIP)** per org — only
  if a client demands hard auth separation; adds cost/complexity.

## 3. Firestore modeling rules

- Prefer **narrow documents + fan-out collections** over giant nested maps.
- **Denormalize read shapes**; store snapshots to avoid joins (Firestore has none).
- Subcollections for unbounded children (messages, members, activities-of-record).
- Keep a doc < 1 MiB; avoid arrays that grow unbounded (use a subcollection).
- Avoid monotonically increasing index keys (e.g., pure timestamp on a hot
  collection) → hotspots; add a shard/field or use distributed counters.
- Write the read first: design collections around the screens that query them.

## 4. Indexes & query limits

- Single-field indexes are automatic; **composite indexes** are required for
  multi-field filter+sort. Declare them in `firestore.indexes.json`.
- Firestore can't do `OR` across different fields (use `in`/array-contains-any,
  or multiple queries merged), no full-text, no joins, limited `!=`.
- Range/inequality on **one field per query**; that field must be the first
  `orderBy`. Plan composite indexes for every list view & filter combo.
- Use **cursors** (`startAfter`) for pagination, not `offset`.
- Common CRM composites: `leads (orgId==, ownerId==, status==, createdAt desc)`,
  `deals (orgId==, pipelineId==, stageId==, expectedCloseDate)`,
  `activities (orgId==, relatedTo.id==, createdAt desc)`,
  `conversations (orgId==, assignedTo==, lastMessageAt desc)`.

## 5. Cloud Functions topology

Organize Functions by concern (one file each), all Node 20+:
- `auth/` — onUserCreate (mint claims), setRole (callable, super_admin only).
- `triggers/` — onWrite audit logger; denormalization fan-out; `lastActivityAt`
  updater; automation dispatcher.
- `automation/` — rule evaluator (see `automation-engine.md`); idempotent;
  cycle-capped.
- `callables/` — `convertLead`, `scoreLead`, `generateQuotePdf`, `copilotChat`,
  `runReport`, `sendMessage`.
- `scheduled/` — cron: follow-up drips, SLA escalation, deal rotting, nightly
  rollups, portal/inventory sync, data-retention purges.
- `webhooks/` — WhatsApp inbound, email inbound, Stripe, e-sign, portal/ADF leads.
- `integrations/` — Gmail/Graph, Twilio, Claude API, Algolia sync, BigQuery export.

Patterns: **idempotency** (dedupe by event id / a `processed` flag), **retry with
backoff**, **structured logging**, **least privilege**, validate input, never
trust client. Keep functions small and single-purpose.

## 6. Search (Algolia / Typesense)

Firestore does equality/range, **not** full-text. For "search contacts/
properties/vehicles by anything": mirror tenant-scoped docs to **Algolia** (or
self-hosted **Typesense/Meilisearch**) via a Firestore trigger, storing only
`objectID` + minimal denormalized fields; rebuild views from Firestore by id.
[source: https://firebase.google.com/docs/firestore/best-practices]
Scope every index query by `orgId` (filter) so tenants never see each other.

## 7. Reporting at scale (BigQuery)

Don't run large cross-tenant aggregations in Firestore. Use the **Firebase →
BigQuery export** (or stream events) and run heavy analytics/forecasting there;
surface results back as summary docs. Keep live dashboards on **sharded
counters / scheduled rollups** in Firestore for cheap, instant reads.

## 8. Files & storage

Firebase Storage for photos (properties, vehicles), documents (contracts,
quotes), avatars. Path `orgs/{orgId}/{entity}/{id}/{file}`; Storage rules scope
by `orgId`/role. Generate **signed URLs** from Functions for private files;
compress/resize images client-side before upload; thumbnail via Function.

## 9. Realtime & offline

- `onSnapshot` powers live pipeline, inbox, presence, dashboards. Detach
  listeners on logout/route change to avoid leaks and `permission-denied` noise.
- Enable offline persistence for resilient field use (agents on the move).
- Use **optimistic UI** with `_version` checks; reconcile on snapshot.

## 10. Background jobs & scheduling

- `onSchedule` (Cloud Scheduler) for crons.
- **Cloud Tasks / Pub/Sub** for delayed actions (e.g., "send WhatsApp in 2h",
  drip steps, retries) — the automation engine enqueues tasks with an ETA.
- Batch writes (≤ 500) for migrations/rollups; chunk large jobs.

## 11. Performance, cost control & quotas

Firestore bills per **read/write/delete + storage + egress**. Control cost:
- Cache reads (client memory + localStorage/IndexedDB); avoid re-fetching.
- Paginate; never load whole collections; `limit` everything.
- Denormalize to cut read counts; aggregate with counters, not live `count()`.
- Avoid N+1 reads in lists (snapshot fields instead of per-row lookups).
- Set **budget alerts**; watch hot documents; shard counters/feeds.
- Rate-limit Functions and webhook endpoints; debounce expensive triggers.
[source: https://cloud.google.com/firestore/docs/understand-reads-writes-scale]

## 12. Hosting & deploy

- **Firebase Hosting** (recommended when you use Functions): SPA rewrites,
  CDN, preview channels, custom domain, SSL.
- **GitHub Pages** also works for the static front-end (Functions still on
  Firebase). The user's proven pattern: static site on Pages + Firebase backend.
- CI/CD: `assets/templates/github-actions-deploy.yml` deploys hosting + rules +
  indexes + functions on push to `main`; bump a `CACHE_VERSION` to invalidate
  clients (service worker / cache-manager).
- Always `firebase deploy --only firestore:rules,firestore:indexes` after
  changing rules/indexes; rules are NOT auto-applied from the repo.

## 13. Environments & secrets

- `dev` (emulators) → `staging` → `prod` projects (or aliases).
- **Firestore Emulator Suite** for rules tests + local Functions.
- Secrets in **Functions config / Secret Manager** (`firebase functions:secrets:set`),
  never in client code or the repo. `assets/templates/env.example` lists them.
- Public Firebase web config (apiKey etc.) is safe in the client; security comes
  from **rules + claims**, not from hiding the config.
