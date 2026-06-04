# Benchmarks — World-Class CRM Feature Matrix

The bar to clear. Use this to (a) sanity-check that a build covers table-stakes,
and (b) explain to clients how their CRM compares to the leaders. The point is
not to copy any one product but to ensure no critical capability is missing.

## The leaders (2026)
| Product | Known for |
|---|---|
| **Salesforce** Sales/Service Cloud + **Agentforce** | Deepest platform, customization, AppExchange, agentic AI (Atlas reasoning) |
| **HubSpot** + **Breeze** (GPT-5, Jan 2026) | Ease of use, free tier, native AI copilot/agents, marketing+sales+service |
| **Zoho CRM** + **Zia Agent Studio** | Value, 700+ actions, no/low-code agents, full suite |
| **Microsoft Dynamics 365 Sales** + Copilot | Enterprise, Microsoft/Power Platform ecosystem |
| **Pipedrive** | Simple, pipeline-first, SMB sales |
| **Freshsales** (Freddy), **monday CRM**, **Attio**, **Close** | Modern UX, niche strengths |

[source: https://www.digitalapplied.com/blog/crm-ai-agent-salesforce-hubspot-zoho-2026-guide]
[source: https://www.digitalapplied.com/blog/hubspot-vs-salesforce-2026-pricing-ai-features-comparison]

## Capability matrix (table-stakes ✓ / advanced ★)

| Capability | Salesforce | HubSpot | Zoho | Pipedrive | Your CRM target |
|---|---|---|---|---|---|
| Lead/contact/account/deal + custom fields/objects | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multiple pipelines + Kanban + path | ✓ | ✓ | ✓ | ✓ | ✓ |
| Activities, tasks, calendar, sequences | ✓ | ✓ | ✓ | ✓ | ✓ |
| Omnichannel inbox (email/WA/SMS/chat) | ✓ | ✓ | ✓ | ✓(add-ons) | ✓ |
| Email sync + tracking + templates | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workflow/automation builder | ✓(Flow) | ✓ | ✓(Blueprint) | ✓ | ✓ |
| Quotes/products/CPQ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reporting + dashboards + forecasting | ✓ | ✓ | ✓ | ✓ | ✓ |
| Predictive lead/deal scoring | ★ | ★ | ★ | ★ | ✓ (heuristic→ML) |
| AI copilot/assistant | ★Agentforce | ★Breeze | ★Zia | ★ | ✓ (Claude) |
| Agentic AI (autonomous agents) | ★ | ★ | ★ | ~ | ✓ (constrained) |
| Conversation/call intelligence | ★ | ★ | ★ | ~ | ✓ |
| Marketing (campaigns, landing, nurture) | ✓(MC) | ✓ | ✓ | ~ | ✓ (optional) |
| Service/tickets/KB/portal | ✓ | ✓ | ✓ | ~ | ✓ (optional) |
| Roles/permissions, audit, compliance | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mobile app + offline | ✓ | ✓ | ✓ | ✓ | ✓ (PWA) |
| Public API + webhooks + marketplace | ✓ | ✓ | ✓ | ✓ | ✓ (API+webhooks) |

## What makes a CRM "world-class" (the high-end signals)
1. **It disappears into the workflow** — fast, inline-editable, keyboard-driven,
   no busywork; the rep lives in the pipeline & inbox, not in data entry.
2. **Automation + AI do the grunt work** — assignment, follow-ups, scoring,
   drafting, summaries, NBA; the 2026 leap is **agentic** (it acts, not just suggests).
3. **One source of truth** — unified customer 360 across sales/service/marketing
   and every channel.
4. **Configurable, not custom-coded** — custom fields/objects/pipelines/automations
   by admins; serves any vertical from one platform.
5. **Trustworthy** — RBAC, audit, security, and compliance (GDPR/Habeas Data) by design.
6. **Insightful** — accurate forecasting and actionable analytics (and data
   hygiene to back it).
7. **Connected** — email/WhatsApp/calendar/e-sign/payments/portals + open API.

## How `crm-architect` clears the bar
- Core + vertical packs cover all table-stakes.
- Automation engine + AI layer (Claude) deliver the advanced/agentic tier
  pragmatically on Firebase, with a rules fallback (zero downtime).
- Config-driven custom fields/pipelines make it universal.
- Security/RBAC/compliance and the design system are first-class, not afterthoughts.

Gap-check any build against this matrix before calling it done; anything marked
✓ for the leaders that you skipped should be a deliberate, documented MVP cut —
not an oversight.
