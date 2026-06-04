# Core — Sales Pipeline, Process & Forecasting

How to model pipelines, stages, qualification methodologies, forecasting and
quotas — the revenue engine of the CRM.

## Table of contents
1. Pipelines & stages
2. Qualification methodologies
3. Deal mechanics
4. Deal rotting & hygiene
5. Forecasting
6. Quotas, goals & leaderboards
7. Win/loss analysis
8. Vertical pipelines

---

## 1. Pipelines & stages

A pipeline is an ordered list of **stages**, each with a **win probability**.
Store as config (`config/pipelines`, see `data-model.md §5`) so each org/vertical
defines its own. A deal references `pipelineId` + `stageId`; `probability` and
`weightedAmount = amount × probability` derive from the stage.

Good stages are **buyer-action-based**, not vibes: each stage has an exit
criterion ("what must be true to advance"). Example generic B2B:
`New → Qualified → Discovery → Proposal → Negotiation → Won/Lost`.
Allow **multiple pipelines** (e.g., new-business vs renewals; buyer vs seller).
Support **required fields per stage** and **path guidance** (what to do now).

UI: **Kanban board** (drag cards between stages, column = stage, show weighted
totals + count + WIP) and a **list view** with stage filter. The Kanban is the
single most-used sales screen. [source: https://trailhead.salesforce.com/content/learn/modules/leads_opportunities_lightning_experience/visualize-success-with-path-and-kanban]

## 2. Qualification methodologies

Bake a framework into lead/deal fields so qualification is structured:
- **BANT**: Budget, Authority, Need, Timeline.
- **MEDDIC/MEDDPICC**: Metrics, Economic buyer, Decision criteria, Decision
  process, (Paper process), Identify pain, Champion, (Competition).
- **CHAMP, GPCT, SPICED** — alternatives.
Implement as `customFields` on the deal + a qualification score. Gate stage
advancement on key criteria. Lead **scoring** (fit + intent) decides routing &
priority — see `ai-features.md`.

## 3. Deal mechanics

- `amount`, `currency`, `expectedCloseDate`, `ownerId`, `pipelineId`, `stageId`,
  `status (open|won|lost)`, `probability`, `weightedAmount`, `nextStep`,
  `lostReason`, `contactRoles[]`, `lineItems[]`.
- **Contact roles** (decision maker, influencer, champion, economic buyer) give
  the M:N deal↔contact link (Salesforce "Opportunity Contact Roles").
  [source: https://www.salesforceben.com/introduction-to-salesforce-opportunity-contact-roles/]
- On stage change: recompute probability/weighted, write an activity, fire
  stage automations (tasks, notifications), stamp `stageChangedAt`.
- On won/lost: set `closedAt`, `status`, require `lostReason` on lost; roll up
  to forecasts & campaign attribution.

## 4. Deal rotting & hygiene

The #1 forecast killer is **bad CRM data hygiene**, not methodology.
[source: https://www.coevera.com/blog/sales-forecasting-in-crm-methods-templates-and-software-2026/]
- **Rotting**: flag deals idle > `pipeline.rottingDays` (no activity). A
  scheduled Function sets `rotting` (days idle) and notifies the owner/manager.
- Surface stalled deals, deals past close date, missing next steps, empty fields.
- Enforce required fields per stage; nudge owners; manager hygiene dashboard.

## 5. Forecasting

- **Weighted pipeline**: Σ(`amount × stageProbability`) by period — the baseline.
  [source: https://prospeo.io/s/crm-forecasting]
- **Category forecast**: commit / best-case / pipeline / omitted buckets.
- **AI win-probability** (per-deal): leaders compute it from stage, activity,
  age, engagement, and history (Einstein, Breeze). Implement a pragmatic version
  in `ai-features.md` (heuristic or logistic model) and store `aiWinProbability`.
  Model-driven forecasts beat gut feel by 20–50%.
  [source: https://www.superoffice.com/blog/predictive-sales-forecasting/]
- Present as: forecast vs quota by rep/team/period, bar chart by stage, trend.
- Compute via scheduled rollups into `counters`/summary docs (cheap reads);
  heavy historical modeling in BigQuery.

## 6. Quotas, goals & leaderboards

- Per-user/team **quota** + **goals** (deals, revenue, activities) per period.
- **Attainment %** = actual / quota. Leaderboards rank reps by revenue/activity.
- Store on the user; roll up actuals nightly; show on dashboards.

## 7. Win/loss analysis

- Capture `lostReason` (enum) + competitor on lost; win reason on won.
- Report win rate by source/stage/rep/reason; identify where deals die
  (funnel drop-off) and average **deal velocity** (time first-contact→close).

## 8. Vertical pipelines

Verticals ship domain pipelines (the spine is identical):
- **Real estate** — *buyer*: `New lead → Nurturing → Appointment → Showing →
  Offer → Under contract → Closed`; *seller/listing*: `Lead → Listing
  appointment → Listed → Under contract → Closed`. (`verticals/real-estate.md`)
- **Dealership** — `Up/Lead → Contacted → Appointment set → Showed → Test drive
  → Write-up/Desking → F&I → Sold/Delivered → Follow-up` (plus a BDC/internet
  sub-flow). (`verticals/automotive-dealership.md`)
