/**
 * crm-architect — Cloud Functions skeleton (Firebase Functions v2, Node 20).
 * A STARTING POINT covering the key server-side concerns. Split into modules
 * (auth/, triggers/, automation/, callables/, webhooks/, integrations/) as it
 * grows — see references/core/architecture-firebase.md §5.
 *
 * Secrets: set with `firebase functions:secrets:set NAME`. Never in client.
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();
const LLM_API_KEY = defineSecret("LLM_API_KEY");
const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");

// ---- helpers ----------------------------------------------------------------
const requireAuth = (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return req.auth;
};
const requireRole = (req, roles) => {
  const a = requireAuth(req);
  if (!roles.includes(a.token.role)) throw new HttpsError("permission-denied", "Insufficient role.");
  return a;
};
const orgPath = (orgId) => db.collection("orgs").doc(orgId);

// =============================================================================
// AUTH — mint custom claims (orgId + role). Call from an admin UI / onboarding.
// =============================================================================
export const setUserRole = onCall(async (req) => {
  const a = requireRole(req, ["super_admin"]);
  const { uid, orgId, role } = req.data;
  if (a.token.orgId !== orgId) throw new HttpsError("permission-denied", "Cross-org denied.");
  await getAuth().setCustomUserClaims(uid, { orgId, role });
  await orgPath(orgId).collection("users").doc(uid).set(
    { role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true }; // client must call getIdToken(true) to refresh.
});

// =============================================================================
// AUDIT — immutable log on writes to sensitive collections.
// =============================================================================
const AUDITED = ["leads", "contacts", "accounts", "deals", "quotes", "properties", "vehicles"];
export const auditWrites = onDocumentWritten("orgs/{orgId}/{coll}/{id}", async (event) => {
  const { orgId, coll, id } = event.params;
  if (!AUDITED.includes(coll)) return;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const action = !before ? "create" : !after ? "delete" : "update";
  const changes = [];
  if (before && after) for (const k of Object.keys(after))
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      changes.push({ field: k, from: before[k] ?? null, to: after[k] ?? null });
  await orgPath(orgId).collection("auditLog").add({
    action, entityType: coll, entityId: id,
    entityName: (after || before)?.name || (after || before)?.fullName || id,
    actorId: (after || before)?.updatedBy || (after || before)?.createdBy || "system",
    changes, timestamp: FieldValue.serverTimestamp(),
  });
});

// =============================================================================
// AUTOMATION — dispatcher: evaluate enabled rules on record writes.
// Cycle protection: skip automation-caused writes; cap per source event.
// =============================================================================
const AUTOMATABLE = ["leads", "contacts", "deals", "conversations"];
export const automationDispatch = onDocumentWritten("orgs/{orgId}/{coll}/{id}", async (event) => {
  const { orgId, coll, id } = event.params;
  if (!AUTOMATABLE.includes(coll)) return;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after || after._automation) return; // skip deletes & self-caused writes
  const eventType = !before ? "onCreate" : "onUpdate";

  const cfg = await orgPath(orgId).collection("config").doc("automations").get();
  const rules = (cfg.data()?.rules || []).filter(r => r.enabled && r.entity === coll.replace(/s$/, ""));
  for (const rule of rules) {
    if (rule.trigger?.type !== eventType) continue;
    if (rule.trigger.field && eventType === "onUpdate"
        && JSON.stringify(before?.[rule.trigger.field]) === JSON.stringify(after[rule.trigger.field])) continue;
    if (!evalConditions(rule.conditions, after, before)) continue;
    await runActions(orgId, coll, id, after, rule);
  }
});

function evalConditions(group, rec, prev) {
  if (!group) return true;
  const test = (c) => {
    const v = rec?.[c.field];
    switch (c.op) {
      case "eq": return v === c.value;        case "neq": return v !== c.value;
      case "gt": return v > c.value;          case "lt": return v < c.value;
      case "gte": return v >= c.value;        case "lte": return v <= c.value;
      case "in": return Array.isArray(c.value) && c.value.includes(v);
      case "contains": return Array.isArray(v) && v.includes(c.value);
      case "isEmpty": return v == null || v === "";
      case "changed": return prev && prev[c.field] !== v;
      case "changedTo": return prev && prev[c.field] !== v && v === c.value;
      default: return false;
    }
  };
  if (group.all) return group.all.every(test);
  if (group.any) return group.any.some(test);
  return true;
}

async function runActions(orgId, coll, id, rec, rule) {
  const ref = orgPath(orgId).collection(coll).doc(id);
  const log = { ruleId: rule.id, ruleName: rule.name, entityId: id, ts: FieldValue.serverTimestamp(), actions: [] };
  for (const act of rule.actions) {
    try {
      switch (act.type) {
        case "updateField":
          await ref.set({ [act.field]: act.value, _automation: true }, { merge: true }); break;
        case "assignOwner": {
          const owner = await pickOwner(orgId, act); // round-robin/load-based
          await ref.set({ ownerId: owner.uid, ownerName: owner.name, assignedAt: FieldValue.serverTimestamp(), _automation: true }, { merge: true });
          break; }
        case "createTask":
          await orgPath(orgId).collection("activities").add({
            orgId, type: "task", subject: act.subject, status: "open",
            relatedTo: { type: coll.replace(/s$/, ""), id, name: rec.name || rec.fullName || id },
            ownerId: act.assignTo === "owner" ? rec.ownerId : act.assignTo,
            dueAt: new Date(Date.now() + (act.dueInMin || 60) * 60000),
            createdAt: FieldValue.serverTimestamp(), createdBy: "automation", _version: 1 });
          break;
        case "sendWhatsApp": /* enqueue/send via integration (see whatsappSend) */ break;
        case "addTag":
          await ref.set({ tags: FieldValue.arrayUnion(act.value), _automation: true }, { merge: true }); break;
        // case "wait": enqueue a Cloud Task with ETA (see architecture-firebase.md §10)
        default: break;
      }
      log.actions.push({ type: act.type, outcome: "ok" });
    } catch (e) { log.actions.push({ type: act.type, outcome: "error", error: String(e) }); }
  }
  await orgPath(orgId).collection("automationLog").add(log);
}

async function pickOwner(orgId, act) {
  // simplistic round-robin among active users in a pool/team
  const snap = await orgPath(orgId).collection("users")
    .where("status", "==", "active").get();
  const pool = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => !act.pool || u.teamId === act.pool || u.role === "agent");
  if (!pool.length) return { uid: "unassigned", name: "Sin asignar" };
  const cRef = orgPath(orgId).collection("counters").doc("roundRobin");
  const idx = await db.runTransaction(async (t) => {
    const c = await t.get(cRef); const n = ((c.data()?.[act.pool || "default"] || 0) + 1);
    t.set(cRef, { [act.pool || "default"]: n }, { merge: true }); return n;
  });
  return pool[idx % pool.length];
}

// =============================================================================
// CALLABLE — convert a lead into Contact (+ Account) (+ Deal). Idempotent.
// =============================================================================
export const convertLead = onCall(async (req) => {
  const a = requireRole(req, ["super_admin", "admin", "manager", "agent", "bdc"]);
  const { leadId, createDeal, pipelineId } = req.data;
  const orgId = a.token.orgId;
  const leadRef = orgPath(orgId).collection("leads").doc(leadId);
  return db.runTransaction(async (t) => {
    const lead = (await t.get(leadRef)).data();
    if (!lead) throw new HttpsError("not-found", "Lead not found.");
    if (lead.convertedTo?.contactId) return lead.convertedTo; // idempotent
    const contactRef = orgPath(orgId).collection("contacts").doc();
    t.set(contactRef, {
      orgId, firstName: lead.firstName, lastName: lead.lastName, fullName: lead.fullName,
      email: lead.email, phone: lead.phone, ownerId: lead.ownerId, ownerName: lead.ownerName,
      lifecycleStage: "sql", consent: lead.consent || null,
      createdAt: FieldValue.serverTimestamp(), createdBy: a.uid, _version: 1 });
    let dealRef = null;
    if (createDeal) {
      dealRef = orgPath(orgId).collection("deals").doc();
      t.set(dealRef, {
        orgId, name: `Deal ${lead.fullName || lead.lastName}`, primaryContactId: contactRef.id,
        primaryContactName: lead.fullName, pipelineId: pipelineId || "sales", stageId: "new",
        status: "open", ownerId: lead.ownerId, ownerName: lead.ownerName, source: lead.source,
        createdAt: FieldValue.serverTimestamp(), createdBy: a.uid, _version: 1 });
    }
    const convertedTo = { contactId: contactRef.id, dealId: dealRef?.id || null };
    t.set(leadRef, { status: "converted", convertedTo, convertedAt: FieldValue.serverTimestamp(),
      updatedBy: a.uid, _version: (lead._version || 1) + 1 }, { merge: true });
    return convertedTo;
  });
});

// =============================================================================
// CALLABLE — explainable lead scoring (heuristic v1; swap for ML later).
// =============================================================================
export const scoreLead = onCall(async (req) => {
  const a = requireAuth(req);
  const { leadId } = req.data; const orgId = a.token.orgId;
  const ref = orgPath(orgId).collection("leads").doc(leadId);
  const lead = (await ref.get()).data();
  if (!lead) throw new HttpsError("not-found", "Lead not found.");
  const f = [];
  const add = (key, label, pts) => f.push({ key, label, points: pts });
  add("source", "Calidad de fuente", { referral: 25, web_form: 15, whatsapp: 18, ads: 12, portal: 15, walk_in: 20 }[lead.source] || 8);
  if (lead.email) add("email", "Tiene email", 8);
  if (lead.phone) add("phone", "Tiene teléfono", 10);
  if (lead.company) add("company", "Empresa", 8);
  if (lead.lastContactedAt) add("recency", "Contactado recientemente", 10);
  const score = Math.max(0, Math.min(100, f.reduce((s, x) => s + x.points, 0)));
  const rating = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  await ref.set({ score, scoreBreakdown: f, rating, _automation: true }, { merge: true });
  return { score, rating, breakdown: f };
});

// =============================================================================
// WEBHOOK — WhatsApp inbound (Meta Cloud API). Verify + log to conversation.
// =============================================================================
export const whatsappWebhook = onRequest({ secrets: [WHATSAPP_TOKEN] }, async (req, res) => {
  if (req.method === "GET") { // verification handshake
    const verify = process.env.WHATSAPP_VERIFY_TOKEN;
    if (req.query["hub.verify_token"] === verify) return res.status(200).send(req.query["hub.challenge"]);
    return res.sendStatus(403);
  }
  // TODO verify X-Hub-Signature-256 with WHATSAPP_APP_SECRET before trusting body
  const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
  const msg = entry?.messages?.[0];
  if (msg) {
    // Map phone → org/contact (lookup), then log under conversations/{id}/messages
    // const { orgId, conversationId } = await resolveConversation(entry.metadata, msg.from);
    // await orgPath(orgId).collection("conversations").doc(conversationId)
    //   .collection("messages").add({ from: "contact", text: msg.text?.body, channel: "whatsapp",
    //     direction: "inbound", timestamp: FieldValue.serverTimestamp(), externalId: msg.id });
  }
  res.sendStatus(200); // ack fast; process async
});

// CALLABLE — send WhatsApp (template or session message). Honor consent first.
export const whatsappSend = onCall({ secrets: [WHATSAPP_TOKEN] }, async (req) => {
  requireRole(req, ["super_admin", "admin", "manager", "agent", "bdc"]);
  const { to, template, text } = req.data;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const body = template
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: "es" } } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  return { ok: r.ok };
});

// =============================================================================
// CALLABLE — AI copilot (RAG + tools). Grounded in CRM data; rules fallback.
// =============================================================================
export const copilotChat = onCall({ secrets: [LLM_API_KEY] }, async (req) => {
  const a = requireAuth(req);
  const { messages, contextRefs } = req.data; const orgId = a.token.orgId;
  // 1) RAG: load the referenced records (contact/deal/history) to ground the answer
  // 2) Compose a system prompt with that context + the org's tone/instructions
  // 3) Call Claude with tools (createTask, updateDeal, searchContacts...) executed
  //    under THIS user's permissions; validate args; cap steps; log every turn.
  if (!LLM_API_KEY.value()) return { text: "AI no configurada.", source: "fallback" };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": LLM_API_KEY.value(), "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 600,
      system: [{ type: "text", text: "Eres el copiloto del CRM. Responde solo con datos provistos.", cache_control: { type: "ephemeral" } }],
      messages }) });
  const data = await r.json();
  return { text: data?.content?.[0]?.text || "", source: "llm" };
});

// =============================================================================
// SCHEDULED — deal rotting + follow-up reminders (runs hourly).
// =============================================================================
export const hygieneSweep = onSchedule("every 60 minutes", async () => {
  const orgs = await db.collection("orgs").get();
  for (const org of orgs.docs) {
    const cfg = (await org.ref.collection("config").doc("pipelines").get()).data();
    const rottingDays = cfg?.pipelines?.[0]?.rottingDays || 14;
    const cutoff = Date.now() - rottingDays * 86400000;
    const stale = await org.ref.collection("deals").where("status", "==", "open")
      .where("lastActivityAt", "<", new Date(cutoff)).get();
    for (const d of stale.docs) {
      const days = Math.floor((Date.now() - (d.data().lastActivityAt?.toMillis?.() || cutoff)) / 86400000);
      await d.ref.set({ rotting: days, _automation: true }, { merge: true });
      // optionally notify the owner here
    }
  }
});
