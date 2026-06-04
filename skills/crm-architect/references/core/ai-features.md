# Core — AI Features

The AI layer of a 2026 world-class CRM, implemented pragmatically on Firebase +
the **Anthropic Claude API** (all server-side via Functions) plus lightweight
heuristics/ML. The market has shifted from copilots to **agentic AI** — agents
that qualify, draft, schedule and update the CRM autonomously (Salesforce
**Agentforce**, HubSpot **Breeze** on GPT-5, Zoho **Zia Agent Studio**).
[source: https://www.digitalapplied.com/blog/crm-ai-agent-salesforce-hubspot-zoho-2026-guide]
[source: https://syncbricks.com/hubspot-breeze-ai-complete-guide-2026/]

## Table of contents
1. Principles & architecture
2. Lead/deal scoring
3. Win-probability & forecasting
4. Next-best-action (NBA)
5. AI copilot (RAG + function-calling)
6. Agentic AI (autonomous agents)
7. Conversation & call intelligence
8. Content generation & summaries
9. Enrichment, dedup & smart routing
10. Cost, safety & guardrails
11. AI feature checklist

---

## 1. Principles & architecture
- **Server-side only**: the Claude API key lives in Functions/Secret Manager;
  the browser never calls the LLM directly.
- **Heuristics first, LLM where it adds value**: scoring/routing can be weighted
  rules (instant, free, explainable); use the LLM for language tasks (drafting,
  summarizing, classification, the copilot/agent).
- **Ground every answer** in CRM data (RAG) — never let the model invent records.
- **Provider abstraction**: wrap the LLM behind one `ai/llm.js` module so the
  model is swappable; **fallback to rules** if the LLM is unavailable (zero
  downtime). Cache/prompt-cache to cut cost.
- **Human-in-the-loop by default**: AI suggests; a person approves — until the
  client explicitly opts into autonomous actions.

## 2. Lead/deal scoring
Two signals: **fit** (how well they match your ICP — firmographics/criteria) and
**intent/engagement** (opens, replies, site/listing views, recency, frequency).
- **Pragmatic model**: weighted score 0–100 from explainable factors
  (source quality, budget/fit, engagement recency & volume, profile completeness,
  sentiment). Re-score on every relevant event (real-time), not nightly.
  [source: https://www.gohighlevel.com/post/how-ai-powered-crms-prioritize-leads-in-real-time]
- **Upgrade path**: train a logistic-regression/decision-tree on your own won/
  lost history (in BigQuery or a Function) and register it behind the same
  interface. Store `score`, `scoreBreakdown[]`, `rating`.
- Scores drive routing, priority, and automation thresholds.

**Reference multi-factor formula** (explainable, normalized 0–100 — proven in production; tune weights per business):

| Factor | Weight | Cap / signal |
|---|---|---|
| Engagement | 20% | interactions with assets (e.g. favoritos ×1.5, vistas ×0.5) |
| Interactions count | 15% | total inquiries/comms (cap ~6) |
| Economic capacity | 25% | budget/income from financing forms |
| Recency | 10% | activity ≤30 days; decay ~3.3%/idle day |
| Frequency | 10% | distinct active days/month (cap ~8) |
| Profile age | 10% | tenure of the relationship (cap ~60 days) |
| Intent depth | 10% | formal actions (test drive, contract request) |

Tiers: **🔥 hot ≥70** (alert agent, contact <15 min) · **🟧 warm 40–69** (weekly nurture) · **🟦 cold <40** (retargeting). Ready Claude prompts for extraction/summary/NBA/sentiment: `assets/templates/ai-prompts.md`. Wire-up code: `references/core/code-patterns.md`.

## 3. Win-probability & forecasting
Per-deal probability from stage, age, activity, engagement, amount and history
(what Einstein/Breeze do). Pragmatic v1: blend stage base-rate with engagement
& rotting signals; store `aiWinProbability`. Roll into weighted forecast
(`sales-pipeline-process.md §5`). Model-driven beats gut feel by 20–50%.

## 4. Next-best-action (NBA)
For each contact/deal, suggest the single highest-value next step (call now,
send quote, book showing, escalate, re-engage) ranked by score + recency +
intent + stage. Implement as heuristic rules first; surface as an actionable
card ("Aceptar / Editar") — never silent. Mirrors HubSpot/Salesforce NBA.

## 5. AI copilot (RAG + function-calling)
A chat assistant over the org's CRM data:
- **RAG**: retrieve the relevant records (contact, deal, history, KB FAQs) and
  put them in the system prompt; optionally embeddings for semantic search over
  notes/KB. Always answer from retrieved data.
- **Function-calling**: expose CRM actions as tools (`createTask`, `logActivity`,
  `updateDeal`, `searchContacts`, `sendMessage`, `scheduleMeeting`). The model
  proposes a tool call; the Function executes it under the user's permissions.
- **Two modes**: internal copilot (for agents) and customer-facing assistant
  (website chat that captures/qualifies leads, answers FAQs, books appointments,
  and hands off to a human). Rate-limit per session; log every turn.

## 6. Agentic AI (autonomous agents)
The 2026 frontier: agents that complete multi-step jobs ("qualify this lead,
draft outreach, schedule follow-up, update the pipeline") with minimal human
input. Implement as a constrained loop: plan → call CRM tools → observe →
continue, with **hard limits** (max steps, allowed tools, approval gates for
risky actions like sending or deleting), full audit, and a kill switch. Start
with one narrow agent (e.g., inbound-lead qualifier) before broadening.

## 7. Conversation & call intelligence
- Transcribe calls (Whisper/provider), then LLM-summarize: topics, sentiment,
  objections, action items, next steps; auto-log to the record.
- Real-time agent assist (suggested replies in the inbox), sentiment flags that
  escalate negative threads to a human.

## 8. Content generation & summaries
- Draft emails/WhatsApp replies in the brand voice (templates + LLM fill).
- **Summaries**: account/deal/thread/call summaries for fast context and handoffs
  (HubSpot/Salesforce ship these). Generate on demand or every N messages.
- Meeting notes, proposal text, listing/vehicle descriptions (vertical).

## 9. Enrichment, dedup & smart routing
- Enrichment: fill missing company/role/social from a provider or public data.
- Dedup: fuzzy-match on email/phone/name; suggest merges.
- Smart routing: assign to the best-fit/lowest-load agent using score + skills.

## 10. Cost, safety & guardrails
- **Prompt caching** + small models for cheap tasks; cap tokens; rate-limit per
  user/session/day; fall back to rules on quota/outage.
- **Grounding & whitelisting**: constrain outputs (e.g., only whitelisted CTAs/
  tools); validate tool args; never expose secrets; redact PII in prompts where
  possible; respect consent before any AI-sent message.
- **Confidence & review**: low-confidence → ask a human. Log AI decisions for audit.

## 11. AI feature checklist
- [ ] Server-side LLM via Functions; key in Secret Manager; rules fallback.
- [ ] Lead/deal scoring (explainable) re-scored on events.
- [ ] Win-probability → weighted forecast.
- [ ] NBA cards (suggest, not silent).
- [ ] Copilot with RAG + function-calling under user permissions.
- [ ] Summaries (deal/thread/call) + draft replies in brand voice.
- [ ] Conversation intelligence (sentiment, escalation).
- [ ] Enrichment/dedup/smart routing.
- [ ] Guardrails: limits, grounding, consent, audit, kill switch.
