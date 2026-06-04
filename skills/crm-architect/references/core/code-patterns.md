# Core — Ready-to-Use CRM Code Patterns

Concrete, battle-tested snippets for the hot paths of a CRM on the Firebase
stack. Adapt the collection paths to the org-scoped model
(`orgs/{orgId}/…`, see `data-model.md`). Field names are shown in English; for
LatAm clients you may use Spanish equivalents (`estado`, `etapa`,
`valor_estimado`, `motivo_perdida`) — pick one convention per project and keep it
consistent.

## Table of contents
1. Cursor pagination (never load whole collections)
2. Optimistic UI + `_version` transaction (drag deal between stages)
3. Round-robin lead routing with load balancing
4. Virtual scrolling (large tables)
5. WhatsApp click-to-chat link
6. Stage-change email automation trigger
7. Sentiment enrichment on new message
8. UI shell grid + 360° flyout + micro-animations

---

## 1. Cursor pagination
```typescript
interface QueryRequest {
  filters: { ownerId?: string; stageId?: string; ratingTier?: string; search?: string };
  limit: number;           // cap at 50
  cursor?: string;         // last doc id from the previous batch
}
```
```javascript
// orgs/{orgId}/contacts — index: ownerId ASC, updatedAt DESC (firestore.indexes.json)
let q = db.collection(`orgs/${orgId}/contacts`);
if (filters.ownerId) q = q.where('ownerId', '==', filters.ownerId);
if (filters.ratingTier) q = q.where('rating', '==', filters.ratingTier);
q = q.orderBy('updatedAt', 'desc').limit(req.limit);
if (req.cursor) q = q.startAfter(await db.doc(`orgs/${orgId}/contacts/${req.cursor}`).get());
```
Use `startAfter` cursors, never `offset`. Every filter combo needs a composite index.

## 2. Optimistic UI + `_version` transaction
Drag-and-drop a deal to a new stage: update the DOM instantly, write in a
transaction that bumps `_version`, roll back on failure.
```javascript
async function moveDealToStage(orgId, dealId, newStageId, prevStageId) {
  UI.updateDealStageInDOM(dealId, newStageId);              // 1) optimistic
  try {
    const ref = db.doc(`orgs/${orgId}/deals/${dealId}`);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error('Deal no existe');
      const v = snap.data()._version || 1;
      t.update(ref, { stageId: newStageId, _version: v + 1,
        stageChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp() });
    });
    UI.showToast('Trato actualizado', 'success');
  } catch (e) {
    UI.updateDealStageInDOM(dealId, prevStageId);            // 2) rollback
    UI.showToast('No se pudo actualizar. Reintentá.', 'danger');
  }
}
```

## 3. Round-robin lead routing with load balancing
Assign a new lead to the active agent with the fewest open hot leads.
```javascript
async function routeNewLead(orgId, leadId) {
  const agentsSnap = await db.collection(`orgs/${orgId}/users`)
    .where('role', '==', 'agent').where('status', '==', 'active').get();
  const agents = agentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!agents.length) return null;                           // → unassigned queue
  const loads = await Promise.all(agents.map(async (a) => {
    const open = await db.collection(`orgs/${orgId}/leads`)
      .where('ownerId', '==', a.id).where('rating', '==', 'hot').get();
    return { id: a.id, name: a.name, count: open.size };
  }));
  loads.sort((x, y) => x.count - y.count);
  const sel = loads[0];
  await db.doc(`orgs/${orgId}/leads/${leadId}`).update({
    ownerId: sel.id, ownerName: sel.name, assignedAt: FieldValue.serverTimestamp(), _automation: true });
  return sel;
}
```

## 4. Virtual scrolling (large tables)
Render only the rows in the viewport (+buffer) so 10k rows stay smooth.
```javascript
class VirtualList {
  constructor(container, rowHeight, renderRow) {
    this.c = container; this.h = rowHeight; this.render = renderRow; this.data = [];
    this.c.addEventListener('scroll', () => this.onScroll());
  }
  setData(data) { this.data = data; this.c.style.height = `${data.length * this.h}px`; this.onScroll(); }
  onScroll() {
    const top = this.c.scrollTop, vh = this.c.clientHeight;
    const start = Math.floor(top / this.h);
    const end = Math.min(this.data.length - 1, Math.ceil((top + vh) / this.h));
    this.c.innerHTML = '';
    for (let i = start; i <= end; i++) {
      const row = this.render(this.data[i]);
      row.style.position = 'absolute'; row.style.top = `${i * this.h}px`;
      this.c.appendChild(row);
    }
  }
}
```

## 5. WhatsApp click-to-chat link
Never show raw numbers — open a pre-filled, contextual chat. (For the official
Business API + 24h window/templates, see `integrations-comms.md`.)
```javascript
function getWhatsAppLink(phone, name, interest) {
  const clean = (phone || '').replace(/[^0-9]/g, '');
  const msg = `Hola ${name}, doy seguimiento a tu consulta sobre *${interest}*. ¿Hablamos ahora?`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}
```

## 6. Stage-change email automation trigger
Cloud Function: when a deal enters "proposal", queue a templated email
(Firebase "Trigger Email" extension reads the `mail` collection).
```javascript
export const onProposalStage = onDocumentUpdated('orgs/{orgId}/deals/{dealId}', async (e) => {
  const b = e.data.before.data(), a = e.data.after.data();
  if (b.stageId !== 'proposal' && a.stageId === 'proposal') {
    const c = (await db.doc(`orgs/${e.params.orgId}/contacts/${a.primaryContactId}`).get()).data();
    if (!c?.email || c?.consent?.email === false) return;     // honor consent
    await db.collection(`orgs/${e.params.orgId}/mail`).add({
      to: c.email,
      message: { subject: `Propuesta comercial — ${a.name}`,
        html: `<p>Hola ${c.firstName || c.fullName}, adjunto la cotización para <b>${a.name}</b>.</p>` }
    });
  }
});
```

## 7. Sentiment enrichment on new message
Trigger on each inbound message: classify sentiment/urgency via Claude and
nudge the lead score. (LLM call server-side; prompt in `assets/templates/ai-prompts.md`.)
```javascript
export const enrichSentiment = onDocumentCreated(
  'orgs/{orgId}/conversations/{cid}/messages/{mid}', async (e) => {
    const m = e.data.data();
    if (m.from !== 'contact') return;
    const { sentiment, urgency } = await callClaudeSentiment(m.text);   // {positivo|negativo, alta|baja}
    await e.data.ref.update({ sentiment });
    const cRef = db.doc(`orgs/${e.params.orgId}/contacts/${m.contactId}`);
    const score = (await cRef.get()).data()?.score ?? 50;
    let s = score;
    if (sentiment === 'positivo') s = Math.min(100, s + 5);
    if (sentiment === 'negativo') s = Math.max(0, s - 10);
    if (urgency === 'alta') s = Math.min(100, s + 10);
    if (s !== score) await cRef.update({ score: s, _automation: true });
  });
```

## 8. UI shell grid + 360° flyout + micro-animations
Workspace grid (no framework) — see also `assets/templates/components/components.css`:
```css
.crm-layout { display:grid; grid-template-columns:240px 1fr; grid-template-rows:64px 1fr;
  grid-template-areas:"sidebar topbar" "sidebar content"; height:100vh; }
.sidebar{grid-area:sidebar} .topbar{grid-area:topbar} .content{grid-area:content;overflow-y:auto;padding:24px}
```
360° contact flyout (slides from the right; tabs: Resumen/Comms/Actividad/Red/AI):
```css
.crm-detail-panel{position:fixed;top:0;right:-500px;width:500px;height:100vh;
  background:var(--surface);box-shadow:-8px 0 32px rgba(0,0,0,.25);
  transition:right .35s cubic-bezier(.16,1,.3,1);z-index:var(--z-drawer)}
.crm-detail-panel.open{right:0}
```
Micro-animations: card drag → lift `box-shadow:0 8px 24px rgba(0,0,0,.15)` + `scale(1.02)`;
task complete → left-to-right strikethrough + checkbox bounce; AI score change → flash
the badge green (up) or red (down). Respect `prefers-reduced-motion`.
