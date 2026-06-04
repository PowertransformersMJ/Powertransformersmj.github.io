# Core — Automation / Workflow Engine

A config-driven rules engine on Firebase that powers world-class automation
(Salesforce Flow, HubSpot Workflows, Zoho Blueprint equivalents). Triggers →
conditions → actions, with delays, branching, idempotency and loop protection.

## Table of contents
1. Engine model
2. Triggers
3. Conditions
4. Actions
5. Rule config schema
6. Firebase implementation
7. Delays, waits & scheduling
8. Idempotency & cycle protection
9. Core recipes
10. State machines & approvals
11. Testing & observability

---

## 1. Engine model

A **rule** = `trigger` + optional `conditions` + ordered `actions`. Rules live
in `orgs/{orgId}/config/automations` (editable by admins, validated against
`assets/templates/workflows-rules.schema.json`). A central **dispatcher**
Function evaluates rules when their trigger fires.
[source: https://monday.com/blog/crm-and-sales/lead-generation-automation/]

## 2. Triggers
- **Record events**: `onCreate`, `onUpdate` (optionally on specific field
  change), `onDelete`, `onStageChange`, `onStatusChange`.
- **Time-based**: scheduled (cron), or relative ("3 days before close date",
  "2h after no reply", "on birthday").
- **Inbound**: form submission, inbound message (WhatsApp/email), webhook, portal
  lead (ADF), score crosses threshold.
- **Manual**: run-on-demand / bulk apply to a list.

## 3. Conditions
Boolean tree (AND/OR groups) over the record + context:
`field op value` where op ∈ `eq, neq, gt, lt, gte, lte, in, contains,
isEmpty, changed, changedTo, before, after`. Support segment membership,
role/ownership, and "previous value" comparisons (for `onUpdate`). Branching:
if/else paths so one trigger routes to different actions.

## 4. Actions
- **Data**: update field(s), create record, delete, convert lead, assign owner
  (round-robin / load-based / territory), add/remove tag, change stage/status.
- **Communication**: send email / WhatsApp template / SMS, create activity/task,
  set reminder, notify user (in-app/push/Slack).
- **Flow**: wait/delay, branch, call webhook (outbound), enqueue another rule,
  start/stop a sequence, recalculate score.
- **AI**: summarize, draft reply, score, suggest next-best-action.

## 5. Rule config schema (shape)

```jsonc
{
  "id": "lead-assign-rr",
  "name": "Asignar leads nuevos (round-robin)",
  "enabled": true,
  "entity": "lead",
  "trigger": { "type": "onCreate" },
  "conditions": { "all": [ { "field": "status", "op": "eq", "value": "new" } ] },
  "actions": [
    { "type": "assignOwner", "strategy": "roundRobin", "pool": "sales" },
    { "type": "createTask", "subject": "Llamar al nuevo lead", "dueInMin": 30,
      "assignTo": "owner" },
    { "type": "sendWhatsApp", "template": "bienvenida", "to": "lead.phone" }
  ],
  "limits": { "maxPerHour": 1000 }
}
```

## 6. Firebase implementation
- A **Firestore trigger** (`onWrite` on each automatable collection) calls the
  **dispatcher**: load enabled rules for that entity+event, evaluate conditions,
  execute actions. Keep the dispatcher generic; actions are small handlers.
- Time-based rules: a `onSchedule` cron scans for matching records (e.g., "no
  reply 2h") and enqueues actions.
- Outbound/3rd-party actions (send message, webhook) run server-side with stored
  credentials. Log every execution to `automationLog` (rule, record, outcome).
- See `architecture-firebase.md §5` for the Functions topology.

## 7. Delays, waits & scheduling
Use **Cloud Tasks** (or Pub/Sub with delay, or a `scheduledActions` collection +
cron) to run an action at a future ETA: "send follow-up in 2h", drip step N+1,
SLA escalation. Each queued task stores the rule id, record id, and dedupe key.

## 8. Idempotency & cycle protection
- **Idempotency**: dedupe by `(ruleId, recordId, eventId)`; mark processed.
- **Cycle protection**: a rule action that updates a record can re-trigger
  `onUpdate`. Cap executions **per source event** (e.g., ≤ 10) and skip
  self-caused updates (tag writes with an `_automation` marker / compare actor).
  This is the exact bug class that breaks naive engines — guard it.

## 9. Core recipes (ship these)
- **Lead assignment**: round-robin / territory / load-based on create.
- **Speed-to-lead**: instant auto-reply + task within minutes (first response
  SLA drives conversion). [source: https://www.formaloo.com/blog/lead-scoring-automation]
- **Nurture drip**: multi-step sequence with waits + exit on reply/conversion.
- **Stage tasks**: create the right task when a deal enters a stage.
- **SLA escalation**: if a conversation/lead isn't handled in X, notify manager.
- **Deal rotting**: alert owner when a deal is idle > rottingDays.
- **Re-engagement / win-back**: cold lead after N days → campaign.
- **Post-sale onboarding**: on `won`, kick off onboarding tasks.
- **Birthday/anniversary**, **appointment reminders**, **review requests**.

## 10. State machines & approvals
Some processes are stateful (Zoho **Blueprint**): a record moves through defined
**transitions** with required fields/approvals at each step. Model as a
`process` config (states + allowed transitions + guards) and enforce in rules +
UI. Approval flows: an approval request record + approver actions + audit.

## 11. Testing & observability
- Test rules in a sandbox/emulator before enabling; dry-run mode (log, don't act).
- `automationLog` for every execution (inputs, decision, actions, errors) — an
  admin "what fired and why" view. Alert on action failures; retry with backoff.
