# Vertical — Extending to a New Vertical

The repeatable recipe to add ANY industry pack (health/clinics, legal,
insurance, education, recruiting, travel, hospitality, B2B SaaS, etc.) on top of
the universal core, in ~6 steps. The core never changes; you overlay a domain.

## The insight
Every vertical is the universal spine — People → Money(Deal) → Work → Automation
→ Insight — with **the "Deal" replaced by a domain object** and a few domain
entities and pipelines added. Identify those and you're 80% done.

## The 6-step recipe

### 1. Name the domain object (what "Deal" becomes)
Pick the central money/transaction object for the industry:
- Real estate → Transaction (+ Property). Dealership → Vehicle deal (+ Vehicle).
- Clinic → Appointment/Treatment (+ Patient). Legal → Case/Matter (+ Client).
- Insurance → Policy/Quote. Recruiting → Placement (+ Candidate/Job).
- Education → Enrollment (+ Student/Program). Travel → Booking (+ Trip).
Keep the universal `Deal` as the base; extend it with domain fields, or add a
parallel domain collection that references a Deal for the economics.

### 2. List the domain entities
Add the 1–3 collections the industry revolves around (the "inventory" and the
"events"). Examples: Property/Showing; Vehicle/TestDrive/TradeIn; Patient/
Appointment; Candidate/Job/Interview; Policy/Claim. Define fields + the Firestore
collections under `orgs/{orgId}/...` (see `core/data-model.md`).

### 3. Define the pipeline(s)
Write the stage list(s) as config (`config/pipelines`). Many verticals have 2+
(buyer/seller; sales/service; candidate/client). Each stage gets a probability +
exit criteria.

### 4. Map the lead sources & channels
Where do leads come from (industry portals, ad platforms, referrals, walk-ins)?
Which channels matter (WhatsApp dominates LatAm)? Add source enums + any
portal/ADF ingest + syndication.

### 5. Pick the domain modules & automations
From `core/modules-catalog.md`, select what applies and add domain specials:
matching/alerts (RE), appraisal/desking/F&I (auto), eligibility/claims
(insurance), interview scheduling (recruiting). Write the domain automations
(reminders, follow-ups, compliance steps).

### 6. Localize, comply, reuse the rest
Locale (language, currency, units), region compliance (Habeas Data/GDPR), and
reuse **unchanged**: activities, conversations/omnichannel, automation engine,
AI (scoring/copilot/NBA/summaries), reporting, RBAC, design system, integrations.

## Deliverables for a new vertical pack
1. A `references/verticals/<name>.md` (mirror the real-estate/dealership files:
   model, pipelines, modules, integrations, locale, checklist).
2. Domain types added to `assets/templates/schema.types.ts`.
3. Domain collections + rules + indexes.
4. Seed `config/pipelines` + `config/fields` for the domain.
5. A domain feature checklist (definition of done).

## Quality bar
The new pack must respect every core principle (org-scoping, RBAC, `_version`,
audit, consent, a11y, performance). If a "vertical need" seems to require
changing the core, first check whether `customFields` + a config pipeline +
an automation already cover it — they usually do.
