# Core — CRM Module & Feature Catalog

The exhaustive menu of capabilities found across world-class CRMs (Salesforce,
HubSpot, Zoho, Dynamics 365, Pipedrive, Freshsales, monday). Use it in Phase 0
to choose and rank modules, and as the feature bar so you never miss
table-stakes functionality. Each module notes its core features and the
Firebase building blocks. The full leader matrix lives in
`benchmarks/world-class-crm-matrix.md`.

## How to use
Pick the modules for the build, rank them, cut an MVP. Each module = a set of
collections + screens + Functions. Most CRMs ship Sales + Activities + Reporting
as the core; everything else is opt-in by client/vertical.

## Table of contents
1. Contact & lead management
2. Sales / pipeline / deals
3. Activities & productivity
4. Communications & omnichannel inbox
5. Marketing
6. Quotes / products / CPQ
7. Service / support
8. Automation & workflows
9. AI & intelligence
10. Reporting & analytics
11. Admin / platform / customization
12. Mobile & collaboration
13. MVP recipes

---

## 1. Contact & lead management
- Lead capture: web forms, landing pages, portal/ad-lead intake, import (CSV),
  manual, API/webhook. De-duplication & merge. Lead source tracking + UTM.
- Lead qualification: scoring (rules/AI), rating (hot/warm/cold), routing &
  assignment (round-robin, territory, load-based), SLAs for first response.
- Contact 360: unified profile, timeline of every interaction, related deals/
  activities/messages, social/enrichment, lifecycle stage, tags, segments.
- Account/household management (B2B/B2C), hierarchy, primary contact.
- Lists & segmentation (static + dynamic/smart lists by criteria).
- Consent & DNC flags per channel (see compliance).
*Building blocks*: `leads`, `contacts`, `accounts`, `config/fields`, dedup
Function, scoring Function, assignment automation.

## 2. Sales / pipeline / deals
- Multiple pipelines; configurable stages with probabilities; Kanban + list.
- Deal management: amount, close date, owner, products, next step, contact roles.
- Forecasting (weighted pipeline + AI win-probability), quotas/goals, leaderboards.
- Stage automation, deal rotting/stale alerts, required fields per stage, path
  guidance. Territory management. Win/loss reasons + analysis.
*Building blocks*: `deals`, `config/pipelines`, kanban UI, forecast rollups,
rotting scheduled Function. Depth: `sales-pipeline-process.md`.

## 3. Activities & productivity
- Tasks, calls, meetings, notes, reminders; calendar; follow-up cadences/
  sequences; bulk task creation; activity timeline on every record.
- Email/meeting scheduler & booking links; templates & snippets; mail-merge.
- Today/agenda view, overdue surfacing, my-work queue ("attend next").
*Building blocks*: `activities`, scheduler integration, reminder cron,
cadence automation.

## 4. Communications & omnichannel inbox
- Unified inbox across email, WhatsApp, SMS, web chat, Messenger/IG.
- Two-way email sync + tracking (opens/clicks); shared team inbox; assignment.
- Templates/quick replies; canned responses; conversation status & SLAs;
  message logging to the contact/deal; click-to-call & call logging.
*Building blocks*: `conversations`/`messages`, channel webhooks + send Functions,
inbox UI. Depth: `integrations-comms.md`.

## 5. Marketing
- Email campaigns + drip/nurture; landing pages & forms; segmentation; A/B;
  attribution & UTM; ads lead capture (Meta/Google Lead Ads); event/webinar.
- Campaign object + members + metrics rollup; subscription/preference center.
*Building blocks*: `campaigns`/`members`, send Functions, attribution on leads.

## 6. Quotes / products / CPQ
- Product catalog + price books; quote builder with line items, discounts, tax;
  quote PDF; e-signature; approval flows; convert quote→order.
*Building blocks*: `products`, `quotes`, PDF Function, e-sign integration.

## 7. Service / support (optional)
- Tickets/cases, SLAs & escalation, knowledge base, customer portal, CSAT/NPS,
  omnichannel support, macros. Reuse the conversation + activity model.
*Building blocks*: `tickets`, SLA cron, KB collection, portal auth.

## 8. Automation & workflows
- Visual rule builder: triggers (record change, time, inbound), conditions/
  branching, actions (update, create, assign, notify, send, webhook, wait).
- Recipes: assignment, nurturing, stage tasks, SLA escalation, rotting,
  re-engagement, post-sale onboarding, birthday/anniversary.
- Approval processes & state machines (e.g., Zoho Blueprint).
*Building blocks*: `config/automations`, rule engine Functions, Cloud Tasks for
delays. Depth: `automation-engine.md`.

## 9. AI & intelligence
- Predictive lead/deal scoring; win-probability forecasting; **next-best-action**;
  conversation/call intelligence + transcription; sentiment; email/content
  generation; record/thread **summaries**; enrichment & dedup; smart routing;
  **AI copilot/agent** that answers and acts (agentic). 2026 leaders: Salesforce
  **Agentforce**, HubSpot **Breeze** (GPT-5, Jan 2026), Zoho **Zia Agent Studio**.
  [source: https://www.digitalapplied.com/blog/crm-ai-agent-salesforce-hubspot-zoho-2026-guide]
*Building blocks*: Claude API via Functions + heuristics. Depth: `ai-features.md`.

## 10. Reporting & analytics
- Dashboards (KPI cards, charts, activity feed, leaderboards); custom report
  builder; pipeline & funnel; conversion, velocity, win rate; forecasting;
  source ROI; agent performance; goal tracking; scheduled/exported reports.
*Building blocks*: counters/rollups, BigQuery for heavy. Depth: `reporting-analytics.md`.

## 11. Admin / platform / customization
- Custom fields & objects; custom layouts/views; roles & permissions; audit log;
  data import/export & dedup; sandbox; API & webhooks; marketplace/integrations;
  automation builder; localization; branding/theming; usage & billing.
*Building blocks*: `config/fields`, `config/roles`, audit, import Functions, API.

## 12. Mobile & collaboration
- Responsive/mobile app (PWA), offline, push notifications; @mentions, notes,
  shared views, presence, real-time collaboration, activity feed.
*Building blocks*: PWA shell, FCM push, presence (RTDB/Firestore), comments.

## 13. MVP recipes

**Generic sales CRM MVP**: leads + contacts + deals (1 pipeline) · dashboard +
list + kanban + detail + forms · activities + reminders · 1 automation
(assignment) · email **or** WhatsApp · 1 report.

**Real-estate MVP**: contacts (buyers/sellers) + properties + buyer & seller
pipelines · property matching/alerts · showings · WhatsApp · portal lead intake.

**Dealership MVP**: leads + vehicles (inventory) + sales pipeline · test-drive
scheduling · trade-in capture · WhatsApp/SMS · BDC lead-response automation.

Everything beyond MVP (quotes, marketing, AI copilot, service, full reporting,
more integrations) is iteration 2+.
