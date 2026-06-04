# Production-Ready CRM Checklist (Definition of Done)

Run through this before shipping a CRM built with `crm-architect`. Anything skipped
should be a deliberate, documented MVP cut — not an oversight. Cross-check the
feature bar in `references/benchmarks/world-class-crm-matrix.md`.

## 0. Discovery
- [ ] Scope captured: vertical, roles, entities, pipelines, modules, integrations, AI, compliance, locale.
- [ ] MVP cut agreed with the client.

## 1. Data & architecture
- [ ] Universal model + vertical extension implemented (`data-model.md`).
- [ ] Org-scoped collections; `orgId` on every doc.
- [ ] `firestore.indexes.json` covers every composite query; deployed.
- [ ] `schema.types.ts` matches the live model.
- [ ] Search plan (Algolia/Typesense) if full-text needed.
- [ ] BigQuery export wired if heavy reporting needed.

## 2. Security, RBAC & compliance
- [ ] Rules deny by default; scoped by `orgId` + role; **emulator tests pass**
      (own org OK, other org denied, cross-tenant collection-group denied).
- [ ] Custom claims (`orgId`,`role`) minted on user create/role change; client refreshes token.
- [ ] `_version` optimistic locking enforced in rules + UI.
- [ ] `auditLog` immutable; sensitive actions logged.
- [ ] 2FA on admins; re-auth on critical actions; suspend revokes access.
- [ ] No third-party secret in the client; all external calls via Functions.
- [ ] Consent captured (explicit, per channel) + honored before any message.
- [ ] Data-subject access/rectify/forget implemented; retention purge scheduled.
- [ ] Habeas Data / GDPR notices in place (locale-appropriate).
- [ ] Storage rules scope files; private files via signed URLs.

## 3. Core app
- [ ] App shell: nav, global search, quick-create, notifications, org switcher, Cmd+K.
- [ ] Dashboard (KPIs, pipeline, tasks, activity feed) — role-aware.
- [ ] List/table views: filters, saved views, sort, inline edit, bulk actions, pagination/virtualization.
- [ ] Kanban/pipeline: drag-drop, weighted totals, rotting flags.
- [ ] Record detail: highlights, tabs, activity timeline, related lists, edit-in-place.
- [ ] Create/edit forms + wizards: validation, optimistic save, `_version` conflict handling.

## 4. Modules
- [ ] Lead/contact/deal management (+ vertical objects: property/vehicle).
- [ ] Activities & tasks + reminders + calendar.
- [ ] Omnichannel inbox (chosen channels) logging to records.
- [ ] At least one pipeline with stages + forecasting.
- [ ] Quotes/products if in scope.

## 5. Automation & AI
- [ ] Rule engine live; idempotent; cycle-protected; `automationLog` written.
- [ ] Core recipes: lead assignment, follow-up reminders, stage tasks, rotting, SLA.
- [ ] Lead scoring (explainable) re-scored on events.
- [ ] At least one AI feature if in scope (copilot/NBA/summaries) with guardrails + rules fallback.

## 6. Integrations
- [ ] Each channel wired via Functions (tokens server-side, webhooks verified, idempotent).
- [ ] WhatsApp: templates approved, 24h window respected, opt-in checked.
- [ ] Email deliverability (SPF/DKIM/DMARC) if sending.
- [ ] Payments/e-sign/portals if in scope; webhooks reconcile to records.

## 7. Reporting
- [ ] Dashboards via counters/rollups (no live scans of big collections).
- [ ] Key reports: conversion, win rate, velocity, source ROI, agent performance.
- [ ] Forecast view (weighted pipeline; AI win-probability if available).
- [ ] Export (CSV/PDF) with RBAC + consent + audit.

## 8. UX, a11y & performance
- [ ] Component library from tokens; light/dark/high-contrast; brandable.
- [ ] Loading skeletons, empty states, error states everywhere.
- [ ] WCAG AA: keyboard, focus management, ARIA, contrast, reduced-motion.
- [ ] Big lists paginated/virtualized; queries indexed; listeners detached on unmount.
- [ ] Mobile/responsive (PWA) with drawers/bottom-sheets; offline-friendly.

## 9. Ops & deploy
- [ ] Seed/demo data loads.
- [ ] Tests: rules (emulator), Functions (unit/integration), critical flows.
- [ ] CI/CD deploys hosting + rules + indexes + functions; cache invalidation on deploy.
- [ ] Monitoring + error logging + usage/cost budget alerts + rate limits.
- [ ] `scripts/validate_crm.mjs` passes.

## 10. Handover
- [ ] Admin can manage users/roles, pipelines, custom fields, automations.
- [ ] Docs/runbook for the client; backup/export path; support plan.
