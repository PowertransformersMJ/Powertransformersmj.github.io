# Core — Security, RBAC & Compliance

How to lock down a multi-tenant CRM: roles & permissions, Firestore rules,
audit, auth hardening, and data-protection compliance (GDPR/CCPA + Colombia
**Ley 1581 / Habeas Data**). Security is non-negotiable — apply on every entity.

## Table of contents
1. Threat model & principles
2. Role model (RBAC)
3. Custom claims (orgId + role)
4. Firestore Security Rules patterns
5. Field-level & record-level control
6. Optimistic locking (`_version`)
7. Audit logging (immutable)
8. Auth hardening (2FA, sessions, devices)
9. Compliance: GDPR/CCPA essentials
10. Compliance: Colombia Ley 1581 (Habeas Data)
11. Consent & data-subject requests (implementation)
12. Storage rules & PII handling
13. Security checklist

---

## 1. Threat model & principles

- **Deny by default.** A rule that isn't written denies access.
- **Never trust the client.** Authorization lives in **rules + Functions**, not
  the UI. The UI only hides what the rules already forbid.
- **Tenant isolation is sacred.** One org must never read another's data.
- **Least privilege.** Each role gets the minimum. Sensitive ops (delete,
  export, role change) are gated and audited.
- **Secrets server-side only.** Third-party keys live in Functions/Secret Manager.

## 2. Role model (RBAC)

Default hierarchy (rename per client). Higher includes lower unless noted.

| Role | Can |
|---|---|
| `super_admin` | Everything in the org: manage users/roles, billing, config, delete, export, see all records. |
| `admin` | Manage config, automations, most records; manage non-admin users; no billing. |
| `manager` | Full access to their **team's** records; reassign owners; view team reports; no user mgmt. |
| `agent` / `salesperson` | CRUD on **records they own** + read shared; can't reassign or delete others' records. |
| `bdc` | Lead intake/qualification + messaging; sets appointments; limited record edits. |
| `viewer` | Read-only. |

Add `permissions[]` overrides on a user for fine exceptions. Define the matrix
per entity (read/create/update/delete/export) in `config/roles` so it's editable.

## 3. Custom claims (orgId + role)

```js
// Function (super_admin only): set a user's org + role into the ID token
await admin.auth().setCustomUserClaims(uid, { orgId, role });
// Mirror to orgs/{orgId}/users/{uid} for queries/UI.
// Client must refresh after a change:
await auth.currentUser.getIdToken(true);
```
Claims drive rules without an extra Firestore read. Keep them small (orgId,
role, maybe teamId). Re-mint on role change; revoke by suspending the user
(`status='suspended'` + a rule check + token revocation).

## 4. Firestore Security Rules patterns

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isSignedIn()      { return request.auth != null; }
    function org()             { return request.auth.token.orgId; }
    function role()            { return request.auth.token.role; }
    function inOrg(oid)        { return isSignedIn() && org() == oid; }
    function hasRole(roles)    { return isSignedIn() && role() in roles; }
    function isOwner(rsc)      { return rsc.data.ownerId == request.auth.uid; }
    function unchanged(f)      { return request.resource.data[f] == resource.data[f]; }
    function bumpsVersion()    { return request.resource.data._version == resource.data._version + 1; }

    match /orgs/{orgId} {
      allow read: if inOrg(orgId);
      allow write: if inOrg(orgId) && hasRole(['super_admin']);

      // Internal users
      match /users/{uid} {
        allow read:   if inOrg(orgId);
        allow write:  if inOrg(orgId) && hasRole(['super_admin','admin']);
      }

      // Generic business record (leads/contacts/deals/...)
      match /{coll}/{id} where coll in ['leads','contacts','accounts','deals','activities','quotes'] {
        allow read:   if inOrg(orgId);
        allow create: if inOrg(orgId) && hasRole(['super_admin','admin','manager','agent','bdc'])
                      && request.resource.data.orgId == orgId
                      && request.resource.data._version == 1;
        allow update: if inOrg(orgId) && (hasRole(['super_admin','admin','manager']) || isOwner(resource))
                      && (hasRole(['super_admin']) || bumpsVersion())
                      && unchanged('orgId') && unchanged('createdBy');
        allow delete: if inOrg(orgId) && hasRole(['super_admin','admin']);
      }

      // Immutable audit log: create-only
      match /auditLog/{id} {
        allow read:   if inOrg(orgId) && hasRole(['super_admin','admin']);
        allow create: if inOrg(orgId);
        allow update, delete: if false;
      }

      // Config: read all, write admin+
      match /config/{doc} {
        allow read:  if inOrg(orgId);
        allow write: if inOrg(orgId) && hasRole(['super_admin','admin']);
      }
    }
  }
}
```
Notes: the `match … where coll in […]` shorthand is illustrative — in real
rules, write a `match /{coll}/{id}` block and branch on `coll`, or repeat the
block per collection for clarity. **Test with the emulator**: a member passes,
another tenant is denied, cross-tenant collection-group reads are denied unless
admin. [source: https://wild.codes/candidate-toolkit-question/how-do-you-model-firestore-multi-tenant-data-for-speed-and-safety]

## 5. Field-level & record-level control

- **Record-level**: ownership (`ownerId`) + team (`teamId`) gate who can edit;
  managers see their team, agents see their own + shared.
- **Field-level**: enforce in rules with `unchanged('field')` (e.g., agents
  can't change `ownerId`, `score`, `stageId` jumps, or consent flags). Mirror in
  the UI by disabling those inputs.
- **Sharing**: an optional `sharedWith[]` array or a `shares` subcollection for
  cross-team visibility; rules check membership.

## 6. Optimistic locking (`_version`)

Mutable records carry `_version` (int). On update, the client sends
`_version + 1`; rules require `bumpsVersion()`. A stale client (someone else
saved first) fails the rule → the UI re-fetches and asks to retry. `super_admin`
may bypass. Prevents silent overwrites in concurrent editing.

## 7. Audit logging (immutable)

A Function trigger on `create|update|delete` of sensitive collections writes an
`auditLog` entry (`action, entityType, entityId, actor, changes[], ip, ts`).
`auditLog` is **create-only** (rule denies update/delete). Also log `login`,
`export`, and `consent_change`. For high-assurance clients, add a hash-chain
(each entry stores the hash of the previous) to make tampering detectable.

## 8. Auth hardening

- **2FA** (SMS or TOTP) required for `super_admin`/`admin`; optional others.
- **Session policy**: idle timeout, absolute max session, re-auth ("sudo") for
  critical actions (delete, role change, bulk export).
- **Trusted devices**, login-attempt rate limiting, lockout + auto-unlock.
- **Suspend = revoke**: `status='suspended'` + rule check + `revokeRefreshTokens`.
- Separate admin and public auth contexts if the same Firebase project serves
  both an internal CRM and a public site.

## 9. Compliance: GDPR / CCPA essentials

Applies when handling EU/CA residents. Provide:
- **Lawful basis + consent** records (what, when, how).
- **Data-subject rights**: access (export), rectification, **erasure**
  ("right to be forgotten"), restriction, portability, objection.
- **Retention**: purge or anonymize after a defined period (scheduled Function).
- **Breach readiness**, **DPA** with sub-processors, **privacy by design**.

## 10. Compliance: Colombia Ley 1581 (Habeas Data)

Colombia's framework is a **constitutional right**; stricter on consent than
GDPR. [source: https://secureprivacy.ai/blog/colombia-data-protection-law]
[source: https://www.recordinglaw.com/world-laws/world-data-privacy-laws/colombia-data-privacy-laws/]

- **Consent must be prior, express & informed** before collecting data. Silence
  or **pre-checked boxes do NOT count** — capture an explicit action.
- Inform the data subject of the **purpose**, their **rights**, and the
  **controller's identity** at capture time.
- Rights to **know, update, and rectify** (consultas y reclamos). Respond to
  **consultas within 10 business days** (reclamos within 15 business days,
  extendable). The authority is the **SIC** (Superintendencia de Industria y
  Comercio), Delegatura de Protección de Datos.
- Maintain an **aviso de privacidad / política de tratamiento** and (where
  required) register databases with the RNBD.
- Practical CRM impact: store, per contactable person, `consent {channels,
  purpose, askedAt, source, ip, policyVersion}`, expose self-service
  consult/rectify/delete, and log every consent change in `auditLog`.

## 11. Consent & data-subject requests (implementation)

- **Capture**: every lead/contact form has explicit, unticked consent
  checkboxes per channel (email/SMS/WhatsApp/calls) + a link to the privacy
  policy; store the consent object + policy version + IP + timestamp.
- **Honor**: automation and messaging Functions check `consent[channel]` and
  `doNotContact` before sending; block otherwise.
- **Requests**: a `dataRequests` collection + a Function that handles
  `access` (export the subject's data), `rectify`, and `forget`
  (delete/anonymize across leads/contacts/activities/conversations, keeping an
  audit stub). SLA timer per region (10 business days for CO).
- **Retention**: scheduled Function anonymizes/purges records past retention.

## 12. Storage rules & PII handling

- Storage paths scoped by `orgId`/role; private docs via **signed URLs** from
  Functions, not public.
- Minimize PII; encrypt especially sensitive fields (national ID/cédula,
  financials) at the field level (Web Crypto / KMS) when required.
- Never log full PII in Function logs; redact.

## 13. Security checklist

- [ ] Rules deny by default; every collection scoped by `orgId` + role.
- [ ] Custom claims mint on user create/role change; client refreshes token.
- [ ] `_version` enforced in rules + UI for mutable records.
- [ ] `auditLog` immutable; sensitive actions logged.
- [ ] 2FA on admins; re-auth on critical actions; suspend revokes access.
- [ ] No third-party secret in client; all external calls via Functions.
- [ ] Consent captured (explicit, per channel) + honored before messaging.
- [ ] Data-subject access/rectify/forget implemented; retention purge scheduled.
- [ ] Emulator rule tests pass (own org OK, other org denied, cross-tenant denied).
- [ ] Storage rules scope files; private files via signed URLs.
