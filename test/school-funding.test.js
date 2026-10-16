import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SchoolStore, initialLedger } from "../school-store.js";
import { createSchoolCheckout, processSchoolEvent, publicSchools, privateLedger, applyAdminAction, allocation } from "../school-funding.js";
import { deliverNotifications } from "../school-notifications.js";
import { createAdminAuth } from "../admin-auth.js";

function memoryStore() {
  let data = initialLedger(); let tail = Promise.resolve();
  return { mode: "test", async read() { await tail; return structuredClone(data); },
    transaction(work) { const task = tail.then(async () => { const copy = structuredClone(data); const result = await work(copy); data = copy; return structuredClone(result); }); tail = task.catch(() => {}); return task; } };
}
function provider() {
  const calls = []; let state;
  const stripe = {
    products: {
      async list() { return { data: [], has_more: false }; },
      async create(params) { return { id: `prod_school_${params.metadata.school_id}`, ...params }; },
    },
    checkout: { sessions: { async create(params, options) { calls.push({ params, options }); return { id: "cs_test_school", url: "https://checkout.stripe.com/c/pay/cs_test_school" }; } } },
    paymentIntents: { async retrieve() { return structuredClone(state.intent); } },
    refunds: { list() { return (async function* () { for (const refund of state.refunds) yield structuredClone(refund); })(); } },
  };
  return { stripe, calls, set(value) { state = value; } };
}
function event(type = "payment_intent.succeeded", overrides = {}) {
  return { id: randomUUID(), type, livemode: false, data: { object: { object: "payment_intent", id: "pi_school" } }, ...overrides };
}
async function prepared(schoolId = "bcc", store = memoryStore()) {
  const p = provider();
  const body = { schoolId, amount: 100, email: "donor@example.com", requestId: randomUUID() };
  await createSchoolCheckout(store, p.stripe, body, "https://missions.example", "test");
  const state = { intent: { id: "pi_school", livemode: false, status: "succeeded", currency: "usd", amount: 10000, amount_received: 10000,
    metadata: p.calls[0].params.metadata, latest_charge: { id: "ch_school", paid: true, captured: true, currency: "usd", created: 1700000000,
      balance_transaction: { currency: "usd", fee: 320 } } }, refunds: [] };
  p.set(state);
  return { store, ...p, body, state };
}
const admin = (action, extra = {}) => ({ action, schoolId: "bcc", requestId: randomUUID(), note: "Verified against receipt", ...extra });

test("all three school checkouts persist designation before Stripe; general subscriptions remain separate", async () => {
  for (const schoolId of ["bcc", "word_by_heart", "sbs"]) {
    const p = await prepared(schoolId);
    const { params, options } = p.calls[0];
    assert.equal(params.mode, "payment"); assert.equal(params.metadata.school_id, schoolId);
    assert.equal(params.payment_intent_data.metadata.school_id, schoolId);
    assert.equal(params.line_items[0].price_data.unit_amount, 10000);
    assert.equal(params.line_items[0].price_data.product, `prod_school_${schoolId}`);
    assert.match(params.success_url, new RegExp(`school=${schoolId}`));
    assert.match(options.idempotencyKey, /^school-test-/);
    assert.equal(Object.keys((await p.store.read()).donations).length, 0);
    await createSchoolCheckout(p.store, p.stripe, p.body, "https://missions.example", "test");
    assert.equal(p.calls.length, 1);
    await processSchoolEvent(p.store, p.stripe, event(), "test");
    await p.store.transaction(data => { for (const s of data.schools) s.startingKnown = true; });
    const totals = publicSchools(await p.store.read());
    assert.equal(totals.find(s => s.id === schoolId).raisedCents, 10000);
    assert.equal(totals.filter(s => s.id !== schoolId).reduce((t,s) => t+s.raisedCents,0), 0);
  }
});
test("unknown starting balances stay unknown; public projection never includes donor data", async () => {
  const p = await prepared(); await processSchoolEvent(p.store, p.stripe, event(), "test");
  const publicData = publicSchools(await p.store.read());
  assert.equal(publicData[0].raisedCents, null); assert.equal(publicData[0].percentage, null);
  assert.doesNotMatch(JSON.stringify(publicData), /donor@example|paymentId|pi_school|notification|transfer/);
});
test("rejects tampered school, amount, reused checkout ID and fractional cents before payment", async () => {
  const p = await prepared();
  for (const changes of [{ schoolId: "general" }, { amount: -1 }, { amount: 1.111 }, { amount: 4 }, { amount: Infinity }, { email: "bad" }, { requestId: "x" }, { amount: 200 }]) {
    await assert.rejects(createSchoolCheckout(p.store, p.stripe, { ...p.body, ...changes }, "https://missions.example", "test"));
  }
  assert.equal(p.calls.length, 1);
});
test("concurrent duplicate webhook events create one donation and notification", async () => {
  const p = await prepared();
  await Promise.all(Array.from({ length: 8 }, () => processSchoolEvent(p.store, p.stripe, event(), "test")));
  const data = await p.store.read();
  assert.equal(Object.keys(data.donations).length, 1); assert.equal(Object.keys(data.notifications).length, 1);
  assert.deepEqual(allocation(data.donations.pi_school), { netCents: 9680, transferredCents: 0, pendingCents: 9680, savingsStatus: "Pending Transfer" });
});
test("failed, cancelled and delayed unpaid checkout cannot increase totals; later success can", async () => {
  const p = await prepared();
  for (const status of ["requires_payment_method", "canceled", "processing"]) {
    p.state.intent.status = status;
    await processSchoolEvent(p.store, p.stripe, event("checkout.session.completed", { data: { object: { object: "checkout.session", payment_intent: "pi_school", payment_status: "unpaid" } } }), "test");
    assert.equal(Object.keys((await p.store.read()).donations).length, 0);
  }
  p.state.intent.status = "succeeded";
  await processSchoolEvent(p.store, p.stripe, event("checkout.session.async_payment_succeeded", { data: { object: { payment_intent: "pi_school" } } }), "test");
  assert.equal(Object.keys((await p.store.read()).donations).length, 1);
});
test("general support is ignored, mismatched metadata, mode or amount are rejected atomically", async () => {
  const p = await prepared();
  const original = structuredClone(p.state.intent);
  p.state.intent.metadata = { purpose: "general_support" };
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  assert.equal(Object.keys((await p.store.read()).donations).length, 0);
  for (const changes of [{ amount_received: 9000 }, { amount: 9000 }, { currency: "eur" }, { livemode: true }, { metadata: { ...original.metadata, school_id: "sbs" } }]) {
    p.state.intent = { ...structuredClone(original), ...changes };
    await assert.rejects(processSchoolEvent(p.store, p.stripe, event(), "test"));
    assert.equal(Object.keys((await p.store.read()).donations).length, 0);
  }
  await assert.rejects(processSchoolEvent(p.store, p.stripe, event(undefined, { livemode: true }), "test"));
});
test("current provider state handles out-of-order partial/full/failed refunds and retained fees", async () => {
  const p = await prepared();
  await p.store.transaction(data => applyAdminAction(data, admin("starting", { amount: 0 })));
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  p.state.refunds = [{ id: "re_one", status: "succeeded", amount: 4000, balance_transaction: { currency: "usd", fee: 0 } },
    { id: "re_failed", status: "failed", amount: 1000 }, { id: "re_pending", status: "pending", amount: 1000 }];
  await processSchoolEvent(p.store, p.stripe, event("charge.refunded", { data: { object: { payment_intent: "pi_school" } } }), "test");
  assert.equal(publicSchools(await p.store.read())[0].raisedCents, 6000);
  // Replay an old payment success: retrieve latest refunds, never resurrect funds.
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  assert.equal((await p.store.read()).donations.pi_school.refundedCents, 4000);
  p.state.refunds.push({ status: "succeeded", amount: 6000, balance_transaction: { currency: "usd", fee: 0 } });
  await processSchoolEvent(p.store, p.stripe, event("refund.updated", { data: { object: { payment_intent: "pi_school" } } }), "test");
  assert.equal(publicSchools(await p.store.read())[0].raisedCents, 0);
  assert.equal(allocation((await p.store.read()).donations.pi_school).pendingCents, -320);
});
test("fees remain pending until available; foreign settlement fees are not treated as USD", async () => {
  const p = await prepared(); p.state.intent.latest_charge.balance_transaction = null;
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  assert.equal(allocation((await p.store.read()).donations.pi_school).netCents, null);
  p.state.intent.latest_charge.balance_transaction = { currency: "nzd", fee: 500 };
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  assert.equal(allocation((await p.store.read()).donations.pi_school).netCents, null);
  p.state.intent.latest_charge.balance_transaction = { currency: "usd", fee: 320 };
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  assert.equal(allocation((await p.store.read()).donations.pi_school).netCents, 9680);
  assert.equal(Object.keys((await p.store.read()).notifications).length, 2);
});
test("admin starting funds, offline gifts, corrections, refunds and transfer reversals have an audit trail", () => {
  const data = initialLedger();
  const start = admin("starting", { amount: 20 }); applyAdminAction(data, start); applyAdminAction(data, start);
  const offline = admin("offline", { amount: 100, fee: 3, date: "2026-01-01" }); applyAdminAction(data, offline);
  const id = `manual-${offline.requestId}`;
  applyAdminAction(data, admin("transfer", { donationId: id, amount: 97 }));
  assert.equal(allocation(data.donations[id]).savingsStatus, "Transferred");
  applyAdminAction(data, admin("refund", { donationId: id, amount: 25 }));
  assert.equal(allocation(data.donations[id]).savingsStatus, "Reconciliation needed");
  applyAdminAction(data, admin("transfer", { donationId: id, amount: -25 }));
  assert.equal(allocation(data.donations[id]).savingsStatus, "Transferred");
  applyAdminAction(data, admin("correction", { amount: -5, date: "2026-01-01" }));
  applyAdminAction(data, admin("settings", { goal: 9000, date: "October 2027" }));
  assert.equal(publicSchools(data)[0].raisedCents, 9000); assert.equal(publicSchools(data)[0].goalCents, 900000);
  assert.equal(data.audit.length, 7);
  assert.throws(() => applyAdminAction(data, admin("transfer", { donationId: id, amount: 100 })));
  assert.throws(() => applyAdminAction(data, admin("refund", { donationId: id, amount: 100 })));
  assert.throws(() => applyAdminAction(data, { ...start, amount: 50 }));
  assert.throws(() => applyAdminAction(data, admin("offline", { amount: 5, fee: 0, date: "2026-02-30" })));
});
test("email outbox is persistent, idempotent, contains savings details and never reports unconfigured sends", async () => {
  const p = await prepared(); await processSchoolEvent(p.store, p.stripe, event(), "test");
  let calls = 0;
  const sent = async (_url, options) => { calls++; const body = JSON.parse(options.body); assert.match(body.subject, /^\[TEST\]/); assert.match(body.textContent, /100.00/); assert.match(body.textContent, /3.20/); assert.match(body.textContent, /96.80/); assert.match(body.textContent, /Mark the transfer complete/); return { ok: true, json: async () => ({ messageId: "email1" }) }; };
  await deliverNotifications(p.store, {}, sent); assert.equal(calls, 0);
  await deliverNotifications(p.store, { apiKey: "test", from: "from@example.com", to: "to@example.com" }, sent);
  await processSchoolEvent(p.store, p.stripe, event(), "test");
  await deliverNotifications(p.store, { apiKey: "test", from: "from@example.com", to: "to@example.com" }, sent);
  assert.equal(calls, 1); assert.equal(Object.values((await p.store.read()).notifications)[0].status, "sent");
});
test("uncertain email retries reuse the key and stop before its deduplication window expires", async () => {
  const p = await prepared(); await processSchoolEvent(p.store, p.stripe, event(), "test");
  const keys = []; const config = { apiKey: "test", from: "from@example.com", to: "to@example.com" };
  const timeout = async (_url, options) => { keys.push(JSON.parse(options.body).headers.idempotencyKey); throw new Error("timeout"); };
  await deliverNotifications(p.store, config, timeout, 100000);
  await deliverNotifications(p.store, config, timeout, 170000);
  await deliverNotifications(p.store, config, timeout, 800000);
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
  assert.equal(Object.values((await p.store.read()).notifications)[0].status, "needs_review");
});

test("an invalid email key leaves rejected notifications queued until configuration is repaired", async () => {
  const p = await prepared(); await processSchoolEvent(p.store, p.stripe, event(), "test");
  const config = { apiKey: "invalid", from: "from@example.com", to: "to@example.com" };
  const rejected = async () => ({ ok: false, status: 401, json: async () => ({ code: "unauthorized", message: "Key not found" }) });
  await deliverNotifications(p.store, config, rejected, 100000);
  let notification = Object.values((await p.store.read()).notifications)[0];
  assert.equal(notification.status, "pending"); assert.equal(notification.firstAttempt, undefined);
  assert.equal(notification.lastProviderStatus, 401);
  await deliverNotifications(p.store, { ...config, apiKey: "repaired" }, async () => ({ ok: true, status: 201, json: async () => ({ messageId: "accepted-after-repair" }) }), 1000000);
  notification = Object.values((await p.store.read()).notifications)[0];
  assert.equal(notification.status, "sent"); assert.equal(notification.providerMessageId, "accepted-after-repair");
});
test("private login uses expiring HttpOnly secure cookies, strict origin, logout and rate limiting", async () => {
  const salt = "12".repeat(16), password = "a sufficiently long test password";
  const auth = createAdminAuth(`${salt}:${scryptSync(password, salt, 64).toString("hex")}`, "https://missions.example");
  const req = { headers: { origin: "https://missions.example" }, socket: { remoteAddress: "127.0.0.1" } };
  assert.equal(auth.authenticated(req), false); assert.equal(auth.sameOrigin(req), true);
  assert.equal(auth.sameOrigin({ ...req, headers: { origin: "https://evil.example" } }), false);
  const login = await auth.login(req, password); assert.equal(login.status, 200);
  assert.match(login.cookie, /HttpOnly; SameSite=Strict; Max-Age=3600; Secure/);
  req.headers.cookie = login.cookie.split(";")[0]; assert.equal(auth.authenticated(req), true);
  auth.logout(req); assert.equal(auth.authenticated(req), false);
  for (let i=0;i<4;i++) assert.equal((await auth.login(req, "wrong")).status, 401);
  assert.equal((await auth.login(req, password)).status, 429);
});

test("PostgreSQL ledger persists across reopen; failed transactions roll back; test/live are separate", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mission-school-pg-"));
  let db = new PGlite(directory);
  const makePool = () => ({ on() {}, query: (...args) => db.query(...args),
    async connect() { return { query: (...args) => db.query(...args), release() {} }; }, async end() {} });
  try {
    let store = new SchoolStore(null, "test", makePool()); await store.initialize();
    const p = await prepared("bcc", store);
    await processSchoolEvent(store, p.stripe, event(), "test");
    await assert.rejects(store.transaction(data => { data.schools[0].goalCents = 1; throw new Error("rollback"); }));
    assert.equal((await store.read()).schools[0].goalCents, 830000);
    await db.close(); db = new PGlite(directory);
    store = new SchoolStore(null, "test", makePool()); await store.initialize();
    assert.equal((await store.read()).donations.pi_school.grossCents, 10000);
    await processSchoolEvent(store, p.stripe, event(), "test");
    assert.equal(Object.keys((await store.read()).donations).length, 1);
    const live = new SchoolStore(null, "live", makePool()); await live.initialize();
    assert.equal(Object.keys((await live.read()).donations).length, 0);
    assert.equal(privateLedger(await store.read()).donations[0].pendingCents, 9680);
  } finally {
    await db.close();
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith("mission-school-pg-")) throw new Error("Unexpected test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});
