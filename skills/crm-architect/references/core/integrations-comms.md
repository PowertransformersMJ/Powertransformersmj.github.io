# Core — Integrations & Communications

Wire the CRM to the outside world: email, WhatsApp, SMS/voice, calendar,
e-signature, payments, portals/ads, and a public API. **Every** third-party call
runs in Cloud Functions (tokens server-side); inbound events arrive via webhooks;
all messages log to the contact/deal/conversation.

## Table of contents
1. Principles
2. Email
3. WhatsApp Business
4. SMS & telephony
5. Calendar & scheduling
6. E-signature & documents
7. Payments
8. Lead capture: forms, ads, portals
9. Enrichment
10. Public API & webhooks
11. Integrations catalog (quick map)

---

## 1. Principles
- **Server-side credentials**: OAuth tokens / API keys in Functions/Secret
  Manager, encrypted, never in the client.
- **Log to the record**: inbound & outbound messages become `messages` under a
  `conversation` tied to the contact/lead/deal; activities for calls/meetings.
- **Webhooks**: idempotent (dedupe by external id), verify signatures, ack fast,
  process async (enqueue). Respect **consent + doNotContact** before sending.

## 2. Email
- **Two-way sync**: Gmail API (Google) / Microsoft Graph (Outlook) to read & send
  from the user's mailbox, logging threads to the CRM; or connect via IMAP/SMTP.
- **Transactional/bulk**: SendGrid / Mailgun / Postmark / **Resend** for
  templates, sequences, campaigns. Tracking: open/click pixels & link wrapping.
- **Deliverability**: configure SPF/DKIM/DMARC for the sending domain.
- Implementation: store OAuth tokens per user (Google/MS) in a secure subdoc;
  a Function sends and logs; a watch/push channel ingests inbound → `messages`.

## 3. WhatsApp Business
The dominant channel in LatAm. Use the **WhatsApp Business Cloud API** (Meta) or
a BSP (Twilio/360dialog).
[source: https://gurusup.com/blog/whatsapp-api-message-templates]
- **24-hour service window**: after a customer messages, you can reply freely for
  24h; outside it you must use a **pre-approved template**.
  [source: https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/]
- **Pricing (since Jul 2025)**: per-message, per category (marketing/utility/
  authentication/service) — not per 24h window. Budget accordingly.
  [source: https://chatarmin.com/en/blog/whats-app-business-api-integration]
- **Opt-in required**; respect consent. Templates need approval; support media,
  quick replies, buttons.
- Implementation: a `sendWhatsApp` Function (template or session message); an
  inbound **webhook** Function logs messages to `conversations/{id}/messages`,
  updates unread counts, and can trigger automation/AI auto-reply + handoff.

## 4. SMS & telephony
- **Twilio** (or local provider): SMS send/receive, **click-to-call**, call
  recording/logging, IVR, power/predictive dialer. Each call → an `activity`
  (direction, duration, recording URL, outcome). Optionally transcribe + summarize
  (`ai-features.md`).

## 5. Calendar & scheduling
- Google/Outlook calendar sync (two-way) for meetings; **booking links**
  (Calendly-style) with availability, round-robin, buffers, and reminders.
- Vertical: property showings, test-drive slots → calendar + reminders +
  no-show handling.

## 6. E-signature & documents
- **DocuSign / Dropbox Sign** for contracts, quotes, F&I/closing docs; status
  webhooks update the quote/deal. Document generation/merge (quote→PDF→sign).
  Store signed PDFs in Storage; link to the deal.

## 7. Payments
- **Stripe** (global) / local gateways (PSE/Wompi in Colombia): payment links,
  invoices, deposits/reservations, subscription billing. Webhooks reconcile
  payment status onto the deal/quote. Never handle card data directly — use
  hosted checkout/links.

## 8. Lead capture: forms, ads, portals
- **Web forms**: a Function endpoint creates a `lead` with source/UTM + consent.
- **Ad leads**: Meta/Google **Lead Ads** webhooks → `lead`.
- **Portals**: real estate (Fincaraíz, Metrocuadrado, Properati) and automotive
  (MercadoLibre, TuCarro) — ingest portal leads (email-parse/ADF/API) into
  `leads`, and **syndicate** listings/inventory out. Dealership internet leads
  often arrive as **ADF/XML** — parse into the CRM. (Verticals cover specifics.)

## 9. Enrichment
Optional providers (Clearbit/Apollo-style) or public-data lookups to fill
company/role/social; phone/email validation; dedup on ingest.

## 10. Public API & webhooks
- **REST API** (Functions): authenticated (API key / OAuth2), rate-limited,
  versioned, for partner integrations and the client's own apps.
- **Outbound webhooks**: let clients subscribe to CRM events (lead.created,
  deal.won). **Inbound webhooks** for everything in §2–§8. Idempotency + retries.
- **iPaaS**: Zapier/Make connectors via the API for the long tail.

## 11. Integrations catalog (quick map)

| Channel | Provider(s) | Auth | Key API | Log to |
|---|---|---|---|---|
| Email sync | Gmail API / MS Graph | OAuth2 (per user) | messages.send/watch | conversations |
| Email bulk | Resend/SendGrid/Mailgun | API key | send + webhooks | campaigns/messages |
| WhatsApp | Meta Cloud API / Twilio / 360dialog | token | messages + webhook | conversations |
| SMS/Voice | Twilio | key+token | Messages/Voice | activities/messages |
| Calendar | Google/Outlook | OAuth2 | events | activities |
| E-sign | DocuSign/Dropbox Sign | OAuth/key | envelopes + webhook | quotes/deals |
| Payments | Stripe / Wompi / PSE | key | checkout/links + webhook | deals/quotes |
| Ad leads | Meta/Google Lead Ads | OAuth | lead webhook | leads |
| Portals RE | Fincaraíz/Metrocuadrado/Properati | feed/API | listing sync + lead | properties/leads |
| Portals Auto | MercadoLibre/TuCarro | API/parse | inventory + ADF lead | vehicles/leads |
| Enrichment | Clearbit/Apollo/validation | key | lookup | contacts/leads |
