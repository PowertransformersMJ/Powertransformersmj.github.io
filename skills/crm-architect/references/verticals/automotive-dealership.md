# Vertical — Automotive Dealership CRM (Concesionario)

The dealership pack (used + new vehicles): adds a **Vehicle/inventory** object,
the showroom + BDC sales process, test drives, trade-in appraisal, desking &
F&I, equity mining, and service — on top of the universal core. Distilled from
VinSolutions (Cox), DealerSocket, Elead (CDK), Tekion, DealerCenter, AutoRaptor;
plus LatAm/used context (Kavak, MercadoLibre Vehículos, TuCarro).
[source: https://monday.com/blog/crm-and-sales/crm-for-automotive-industry/]
[source: https://www.vinsolutions.com/]

## Table of contents
1. What changes vs the core
2. Vehicle / inventory model (new + used)
3. Lead/customer specifics & sources (ADF)
4. Sales process / showroom pipeline
5. BDC & internet leads
6. Test drives
7. Trade-in & appraisal
8. Desking & F&I
9. Equity mining / data mining
10. Service & parts CRM
11. Inventory merchandising & syndication
12. Reporting (dealership KPIs)
13. DMS / OEM integration
14. Colombia/LatAm specifics
15. Dealership feature checklist

---

## 1. What changes vs the core
The "Deal" becomes a **vehicle deal** (a specific customer buying a specific
vehicle, with trade-in + financing). A new core entity appears: the **Vehicle**
(inventory). Customer 360 unifies sales + service history. Everything else is
reused. VinSolutions' value prop is exactly this unified customer record.

## 2. Vehicle / inventory model — `orgs/{orgId}/vehicles/{id}`

| Field | Notes |
|---|---|
| `vin` | 17-char; **VIN decode** auto-fills make/model/year/trim/options |
| `stockNumber`, `condition*` | new / used / certified (CPO) |
| `make, model, year, trim, bodyType` | sedán, SUV, pickup, hatchback, camioneta |
| `mileage`/`odometer` | km (used) |
| `transmission, fuel, engine, drivetrain, doors, seats, color, interior` | |
| `price, cost, msrp, currency` | COP; cost is internal |
| `status*` | disponible, reservado, vendido, en preparación |
| `location/lot`, `photos[]`, `features[]`, `description` | merchandising |
| `history {carfax, owners, accidents}` | used-car history |
| `daysInInventory`/`aging`, `floorplan`, `certifications[]` | aging cost |
| `consignment` (bool) + `consignorContactId` | used-car consignment |
| `customFields` | |

VIN decode (NHTSA/provider) auto-populates specs; aging drives pricing/markdown.

## 3. Lead/customer specifics & sources (ADF)
- Lead types: **up/walk-in**, **internet lead**, phone lead.
- Sources: AutoTrader, Cars.com, CarGurus, OEM sites; LatAm: **MercadoLibre,
  TuCarro, CarroYa**; website, referrals.
- **ADF/XML** is the standard internet-lead format — parse inbound ADF emails/
  posts into `leads` automatically (mapping vehicle of interest, source, contact).
  [source: http://blog.autoconx.com/blog/how-to-speak-dealer-terminology]
- De-dup across sales + service; a customer may be a prospect and a service
  customer at once.

## 4. Sales process / showroom pipeline
Dealership stages (config): `Up/Lead → Contacted → Appointment set → Showed →
Test drive → Trade appraisal → Write-up/Desking → F&I → Sold/Delivered →
Follow-up`. **Up system** (logging walk-ins), **sales manager TO** (turn-over to
a closer), required steps per stage. Separate showroom vs internet flows that
merge into the same deal.

## 5. BDC & internet leads
The **BDC** (Business Development Center) handles internet/phone leads with one
goal: **set appointments**. [source: http://blog.autoconx.com/blog/how-to-speak-dealer-terminology]
- Speed-to-lead auto-responders (SMS/email/WhatsApp) within minutes; round-robin
  to BDC agents; appointment-setting scripts/templates; appointment-show tracking.
- Heavy **texting** workflow (auto + manual), call logging, OEM-compliant comms.

## 6. Test drives — `orgs/{orgId}/testDrives/{id}`
`vehicleId, contactId, salespersonId, scheduledAt, status, licenseCaptured,
route, feedback`. Schedule + reminders + no-show flow; log to the deal & timeline.

## 7. Trade-in & appraisal — `orgs/{orgId}/tradeIns/{id}`
`contactId, dealId, vehicle {vin, make, model, year, mileage, condition, color},
valuation {source, wholesale, retail, offer}, photos[], status, payoff, equity`.
Valuation sources: KBB/Black Book (US); **LatAm: Fasecolda guide, revista Motor**.
Equity = value − payoff; drives upgrade conversations. AI/automated appraisal +
BDC outreach lifts trade conversion. [source: https://www.openpr.com/news/4519771/how-bdc-sales-in-car-service-improves-trade-in-lead-conversion]

## 8. Desking & F&I
- **Desking**: structure the deal — selling price, trade allowance, payoff,
  down payment, taxes/fees, and **financing scenarios** (term × rate → monthly
  payment); present multiple options to the customer. Built into VinSolutions/
  DealerSocket/Tekion.
- **F&I** (Finance & Insurance): credit application, lender submission/decision,
  finance products (warranty, GAP, insurance), contracts + e-sign, compliance.
- Model a `deal.fi { tradeInId, downPayment, term, apr, monthlyPayment, lender,
  products[], status }`; generate the desk sheet/quote PDF.

## 9. Equity mining / data mining
Scan the customer base for who's in a position to upgrade: loan near payoff,
positive equity, lease maturing, high mileage, service visits. Surface as NBA/
campaign → BDC outreach. CDK/VinSolutions ship equity-mining tools; it's a top
ROI feature. [source: https://www.vinsolutions.com/resources/blog/how-data-mining-creates-resale-opportunities/]

## 10. Service & parts CRM
- Service appointments (`serviceAppointments`), declined-service follow-up,
  recall notifications, multi-point inspection, service-to-sales handoff.
- Service drive is a prime equity-mining/upgrade source — link service visits to
  sales opportunities. [source: https://frikintech.com/solutions/solutions-for-car-dealers/]

## 11. Inventory merchandising & syndication
Manage inventory (photos, descriptions, pricing/markdown by aging), syndicate to
marketplaces (AutoTrader/Cars.com; **MercadoLibre/TuCarro/CarroYa**), and capture
leads back per vehicle. Cars Commerce/Tekion unify CRM + inventory.

## 12. Reporting (dealership KPIs)
Sales by salesperson, **close ratio**, lead-source ROI, appointment-set/show
ratios, BDC metrics, **inventory turn/aging**, gross profit (front/back),
F&I penetration & PVR, response time. Manager dashboards by store/rooftop.

## 13. DMS / OEM integration
- **DMS** (Dealer Management System) integration for accounting/inventory/
  deals (Tekion unifies DMS+CRM); OEM/manufacturer reporting & compliance.
- Two-way: pull inventory & customers from DMS, push deals/sales back.

## 14. Colombia/LatAm specifics
- **Fasecolda code** (vehicle valuation/insurance reference) + revista Motor for
  used pricing; **RUNT** registration; **traspaso** (title transfer);
  **peritaje** (inspection); **SOAT/tecnomecánica**; **consignación** (used-car
  consignment) as an inventory type; financing via local banks; **MercadoLibre/
  TuCarro/CarroYa** as lead+listing channels; currency **COP**; **Habeas Data**
  consent on every lead.

## 15. Dealership feature checklist
- [ ] Vehicle/inventory model + VIN decode + aging + new/used/CPO + consignment.
- [ ] ADF internet-lead parsing + multi-source dedup.
- [ ] Showroom pipeline + up system + manager TO + BDC internet flow.
- [ ] Speed-to-lead auto-response (SMS/WhatsApp) + appointment setting + show tracking.
- [ ] Test-drive scheduling + reminders + no-show.
- [ ] Trade-in appraisal + valuation (Fasecolda/Motor) + equity calc.
- [ ] Desking (financing scenarios) + F&I (credit, lenders, products, e-sign).
- [ ] Equity mining / data mining → upgrade campaigns.
- [ ] Service appointments + declined-service follow-up + service-to-sales.
- [ ] Inventory merchandising + syndication (MercadoLibre/TuCarro) + per-vehicle leads.
- [ ] Dealership KPIs (close ratio, turn/aging, F&I PVR, BDC, source ROI).
- [ ] DMS/OEM integration; Colombia: Fasecolda, RUNT, traspaso, SOAT, Habeas Data.
