# Vertical — Real Estate CRM (Inmobiliario)

The real-estate pack: it adds a **Property/listing** domain object, buyer &
seller pipelines, property matching/alerts, showings, transactions, and portal/
MLS integration — on top of the universal core. Distilled from the leaders:
BoldTrail/kvCORE, Follow Up Boss, Lofty, BoomTown, Real Geeks, plus LatAm tools
(Wasi, EasyBroker) and Colombian portals (Fincaraíz, Metrocuadrado, Ciencuadras).
[source: https://boldtrail.com/blog/kvcore-vs-lofty/]

## Table of contents
1. What changes vs the core
2. Property / listing model
3. Contact specifics (buyers/sellers) & preferences
4. Pipelines (buyer & seller)
5. Property matching & alerts
6. Showings, open houses & tours
7. Transactions & closing
8. Lead sources, routing & speed-to-lead
9. Portals/MLS/IDX integration
10. Nurture, market reports & CMAs
11. Teams, agents & accountability
12. Colombia/LatAm specifics
13. Real-estate feature checklist

---

## 1. What changes vs the core
The "Deal" becomes a **Transaction** (a buyer purchase or a seller listing
sale), and a new core entity appears: the **Property/listing**. Contacts carry
buyer **search preferences** for matching. Everything else (activities,
conversations, automation, AI, reporting, RBAC, consent) is reused as-is.

## 2. Property / listing model — `orgs/{orgId}/properties/{id}`

| Field | Notes |
|---|---|
| `code`/`mls` | internal code + MLS/portal id |
| `type*` | casa, apartamento, lote, oficina, local, bodega, finca |
| `operation*` | venta, arriendo (rent), venta+arriendo |
| `status*` | disponible, reservado, vendido, arrendado, retirado |
| `price*`, `currency`, `pricePerM2`, `adminFee` | COP; admin fee for PH |
| `area`, `builtArea`, `lotArea` | m² |
| `bedrooms`, `bathrooms`, `parking`, `floors`, `stratum (estrato)` | CO: estrato 1–6 |
| `yearBuilt`, `condition` (nuevo/usado) | |
| `address`, `neighborhood`, `city`, `geo {lat,lng}` | map pin |
| `amenities[]` | piscina, gimnasio, ascensor, vigilancia, balcón… |
| `media {photos[], video, virtualTour, floorPlan}` | tour 360 |
| `ownerContactId`, `exclusive` (bool), `commission`, `coBroke` | listing owner + comm. |
| `listedAt`, `daysOnMarket`, `featured`, `tags[]`, `customFields` | aging |
| `legal {matricula, predial}` | CO docs (optional) |

Listing lifecycle: `captación → listed/disponible → reservado → vendido/
arrendado`. Track `daysOnMarket`, price changes (history), and showing count.

## 3. Contact specifics & preferences
Contacts have `type` ∈ buyer, seller, tenant, landlord, investor. **Buyer
preferences** drive matching — store on the contact:
`preferences { operation, types[], minPrice, maxPrice, city, neighborhoods[],
minBedrooms, minBathrooms, minArea, minParking, amenities[], stratum[],
moveTimeline }` plus behavioral signals (which listings they viewed/saved).

## 4. Pipelines (buyer & seller)
Ship two pipelines (config):
- **Buyer**: `Nuevo lead → Calificación → Cita → Visita (showing) → Oferta →
  Bajo contrato → Cerrado (ganado/perdido)`.
- **Seller/listing**: `Lead → Cita de captación → Listado → Promoción →
  Bajo contrato → Cerrado`.
A Transaction record carries the deal economics (price, commission, co-broke,
close date) and links buyer, seller, agent(s), and the property.

## 5. Property matching & alerts
The killer feature. Match buyers to listings:
- On new/updated listing → find buyers whose `preferences` match (operation,
  price range, city/neighborhood, beds/baths/area, amenities) → notify the
  agent and/or auto-send the buyer an alert (respecting consent).
- **Saved searches** + **new-listing alerts** (email/WhatsApp). Behavioral
  tracking: which listings a lead views adjusts follow-up (BoldTrail "Smart CRM"
  behavioral follow-up). [source: https://boldtrail.com/blog/kvcore-vs-lofty/]
- Implement matching as a scored query (criteria → candidates → rank by fit +
  recency); run on listing change and on preference change.

## 6. Showings, open houses & tours
`orgs/{orgId}/properties/{id}/showings/{sid}` (or a `showings` collection):
`propertyId, contactId, agentId, scheduledAt, status (scheduled/done/no_show/
cancelled), feedback, source`. Calendar + reminders + no-show automation. Open
houses (multi-attendee), tour routes (multiple properties in one trip).

## 7. Transactions & closing
Transaction record + a **checklist** of closing steps (offer, due diligence,
promesa de compraventa, financing, escritura, entrega) with tasks, documents
(e-sign), and **commission tracking** (split, co-broke, agent payout). Status
dashboard for deals under contract.

## 8. Lead sources, routing & speed-to-lead
Sources: portal leads (Fincaraíz/Metrocuadrado), website/IDX, Meta/Google lead
ads, sphere of influence, signs, referrals, home-valuation magnets. **Instant
response** is decisive — auto-reply within minutes + round-robin/ponds routing.
Follow Up Boss is built around fast lead routing + open-API integration.
[source: https://www.bounti.ai/real-estate-blog/best-crm-for-real-estate-agents]

## 9. Portals / MLS / IDX integration
- **US**: MLS via IDX feeds (BoldTrail connects 600+ MLSs); listings sync in,
  leads from IDX search captured.
- **LatAm/Colombia**: syndicate listings OUT to **Fincaraíz, Metrocuadrado,
  Ciencuadras, Properati, Mercado Libre Inmuebles**; ingest portal leads IN
  (email-parse/API) → `leads`. Tools like Wasi/EasyBroker publish to these from
  one place. [source: https://blog.mercately.com/crm-en-colombia-la-guia-para-el-sector-inmobiliario-y-empresarial/]
- Build a `portalSync` Function (push listing create/update/remove) + per-portal
  lead webhook/parser.

## 10. Nurture, market reports & CMAs
- **Drip campaigns** (buyer & seller nurture), market updates, price-drop alerts
  on saved listings, "are you still looking?" re-engagement.
- **Home valuation** lead magnets ("¿cuánto vale tu propiedad?") → seller leads.
- **CMA / market reports** (comparables) to win listings; automated periodic
  market emails to nurture the sphere.

## 11. Teams, agents & accountability
Brokerage/team structure, lead distribution & ponds, agent productivity &
accountability dashboards, lead-source ROI, back-office (commissions, agent
onboarding, billing — BoldTrail BackOffice). Manager view of every agent's
pipeline and response times.

## 12. Colombia/LatAm specifics
- **Estrato** (1–6) as a first-class field (pricing/segmentation).
- **Arriendo vs venta** as `operation`; admin fee (cuota de administración) for
  PH; predial/valorización context.
- Currency **COP**; areas in m²; portals listed in §9; **Habeas Data (Ley 1581)**
  consent on every lead (see `security-rbac-compliance.md`).
- Documents: matrícula inmobiliaria, certificado de tradición, promesa de
  compraventa, escritura.

## 13. Real-estate feature checklist
- [ ] Property/listing model + media + map + aging + price history.
- [ ] Buyer & seller pipelines.
- [ ] Buyer preferences + property matching + saved searches + new-listing alerts.
- [ ] Behavioral tracking adjusts follow-up.
- [ ] Showings/open houses scheduling + reminders + no-show flow.
- [ ] Transaction + closing checklist + commission/co-broke tracking.
- [ ] Speed-to-lead auto-response + routing/ponds.
- [ ] Portal syndication out + portal lead ingest in (Fincaraíz/Metrocuadrado…).
- [ ] Home-valuation magnet, CMA/market reports, nurture drips.
- [ ] Teams/agents, accountability dashboards, source ROI, back-office.
- [ ] Colombia: estrato, arriendo/venta, COP, Habeas Data, local docs.
