# Core — Reporting & Analytics

Dashboards, KPIs, reports and forecasting for the CRM, built cheaply on
Firestore (counters/rollups) with BigQuery for heavy analysis.

## Table of contents
1. Architecture (cheap & fast)
2. Dashboards
3. KPI catalog
4. Report builder
5. Funnel & conversion
6. Forecasting view
7. Agent/team performance
8. Source & campaign ROI
9. Export & scheduled reports

---

## 1. Architecture (cheap & fast)
Never `count()`/scan large collections on every dashboard load (cost + latency).
[source: https://www.netsuite.com/portal/resource/articles/crm/crm-dashboard.shtml]
- **Sharded counters + scheduled rollups**: maintain summary docs
  (`orgs/{orgId}/counters/*`, `analytics/*`) updated by triggers and nightly
  crons. Dashboards read a handful of summary docs → instant.
- **BigQuery** for heavy/historical/cross-entity analytics via the Firebase
  export; surface results back as summary docs or embedded charts.
- Time-series: write daily snapshots (pipeline value, counts) for trend charts.
- Data hygiene is the real bottleneck for accuracy — enforce required fields.

## 2. Dashboards
Role-aware home dashboards (Salesforce/HubSpot/monday style):
[source: https://monday.com/blog/crm-and-sales/crm-dashboards/]
- **KPI cards** (today's leads, open deals, weighted pipeline, win rate, tasks).
- **Pipeline summary** (value & count by stage; weighted total).
- **Activity feed** + **today's tasks/agenda**.
- **Leaderboards** (reps by revenue/activity).
- **Trends** (sales over time; lead volume; conversion).
- Per-role views: rep sees their numbers; manager sees team; exec sees org.

## 3. KPI catalog
Sales: new leads, MQL/SQL, conversion rate, open/won/lost deals, win rate,
**weighted pipeline**, average deal size, sales cycle length, **deal velocity**,
quota attainment, revenue (period/forecast), pipeline coverage.
Activity: calls/meetings/emails per rep, response time / **speed-to-lead**,
tasks completed/overdue, follow-up adherence.
Marketing: source volume, **source ROI**, campaign conversion, cost per lead.
Service (if used): tickets, first-response/resolution time, CSAT/NPS, SLA %.
Pipeline health: stalled deals, rotting, past-due close dates, missing fields.

## 4. Report builder
Let admins build reports: pick entity, columns, filters, group-by, aggregate
(sum/avg/count), sort, and a chart type (bar/line/pie/funnel/table). Save &
share report defs in `config/reports`. Run against rollups or BigQuery for big
ranges. Respect RBAC (a rep only sees permitted records).

## 5. Funnel & conversion
Funnel from lead → qualified → opportunity → won; show drop-off per stage and
conversion %. Identify where deals die. Track multi-touch attribution
(first/last/linear) via campaign members + UTM.

## 6. Forecasting view
Forecast vs quota by rep/team/period; weighted pipeline by stage (bar chart with
per-stage probability); category buckets (commit/best-case/pipeline); trend vs
prior periods; optional AI win-probability overlay (`ai-features.md`). Present
multiple stages with their win probabilities. [source: https://prospeo.io/s/crm-forecasting]

## 7. Agent/team performance
Per rep/team: leads handled, conversion, revenue, activity volume, response
time, SLA adherence, win rate, attainment. Medals/ranking. Drives coaching.

## 8. Source & campaign ROI
Leads & revenue by `source`/`campaign`; cost per lead; ROI = revenue ÷ spend.
Tells the client where to spend. Roll up onto campaign metrics + a source report.

## 9. Export & scheduled reports
CSV/Excel export (RFC-4180 escaping, UTF-8 BOM); PDF for exec summaries;
scheduled email of a dashboard/report (cron Function). Respect RBAC & consent on
any exported PII; log exports to `auditLog`.
