import { randomUUID } from "node:crypto";
import { SCHOOL_DEFAULTS } from "./school-store.js";
import { getSchoolDonationProduct } from "./stripe-school-products.js";

export const isSchool = id => SCHOOL_DEFAULTS.some(s => s.id === id);
export const isUuid = id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const dollars = cents => cents === null ? "Pending confirmation" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export function invalid(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
export function cents(value, { signed = false, min = 0 } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 999999.99 ||
    (!signed && value < min) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    throw invalid("Enter a valid dollar amount with at most two decimal places.");
  }
  return Math.round(value * 100);
}
export function publicSchools(data) {
  return data.schools.map(school => {
    const raisedCents = Object.values(data.donations).filter(d => d.schoolId === school.id && d.status === "confirmed")
      .reduce((total, d) => total + d.grossCents - d.refundedCents, 0);
    return { id: school.id, name: school.name, date: school.date, goalCents: school.goalCents,
      raisedCents: school.startingKnown ? raisedCents : null,
      remainingCents: school.startingKnown ? Math.max(0, school.goalCents - raisedCents) : null,
      percentage: school.startingKnown ? Math.max(0, raisedCents / school.goalCents * 100) : null };
  });
}
export function allocation(d) {
  const netCents = d.status === "confirmed" && d.feeCents !== null ? d.grossCents - d.refundedCents - d.feeCents : null;
  const transferredCents = d.transfers.reduce((total, t) => total + t.amountCents, 0);
  return { netCents, transferredCents, pendingCents: netCents === null ? null : netCents - transferredCents,
    savingsStatus: netCents === null ? "Fees pending" : transferredCents > netCents ? "Reconciliation needed" :
      netCents === transferredCents ? (netCents === 0 ? "No transfer due" : "Transferred") : "Pending Transfer" };
}
export function privateLedger(data) {
  return { schools: data.schools, progress: publicSchools(data),
    donations: Object.values(data.donations).map(d => ({ ...d, ...allocation(d) })),
    notifications: Object.values(data.notifications).map(({ payload, ...n }) => n),
    audit: data.audit.slice(-200).reverse() };
}
function audit(data, action, details) { data.audit.push({ id: randomUUID(), date: new Date().toISOString(), actor: "admin", action, ...details }); }
function queueNotification(data, donation, kind = "donation") {
  const key = `${donation.id}:${kind}`;
  if (data.notifications[key]) return;
  const school = data.schools.find(s => s.id === donation.schoolId);
  const net = allocation(donation).netCents;
  data.notifications[key] = { id: key, idempotencyKey: randomUUID(), status: "pending", donationId: donation.id,
    subject: `${kind === "donation" ? "New donation" : "Donation accounting update"}: ${dollars(donation.grossCents)} towards ${school.name}`,
    text: `School: ${school.name}\nGross donation: ${dollars(donation.grossCents)}\nRefunds: ${dollars(donation.refundedCents)}\nProcessing fees: ${dollars(donation.feeCents)}\nNet amount available for savings: ${dollars(net)}\nDate of donation: ${donation.date}\n\nPlease allocate the available designated funds to your ${school.name} savings account. Review any refund or correction before transferring. A donation receipt does not mean the money has been transferred. Mark the transfer complete in the private school admin only after moving the funds.` };
}

export async function createSchoolCheckout(store, stripe, body, siteOrigin, mode) {
  if (!body || !isSchool(body.schoolId) || !isUuid(body.requestId) || typeof body.email !== "string" ||
      body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw invalid("Choose a school and enter a valid email address.");
  const amountCents = cents(body.amount, { min: 5 });
  const details = { schoolId: body.schoolId, amountCents, email: body.email.trim(), requestId: body.requestId };
  const record = await store.transaction(data => {
    const existing = data.checkouts[body.requestId];
    if (existing) {
      if (existing.schoolId !== details.schoolId || existing.amountCents !== amountCents || existing.email !== details.email) {
        throw invalid("This checkout request was already used. Start a new donation.");
      }
      if (Date.now() - Date.parse(existing.createdAt) > 23 * 60 * 60 * 1000) throw invalid("This checkout expired. Start a new donation.");
      return existing;
    }
    const record = { ...details, id: randomUUID(), createdAt: new Date().toISOString(), status: "checkout" };
    data.checkouts[body.requestId] = record;
    return record;
  });
  if (record.checkoutUrl) return { checkoutUrl: record.checkoutUrl };
  const school = SCHOOL_DEFAULTS.find(s => s.id === body.schoolId);
  const productId = await getSchoolDonationProduct(stripe, school.id);
  const metadata = { purpose: "school", school_id: school.id, donation_id: record.id, integration: `school_${mode}` };
  const session = await stripe.checkout.sessions.create({
    mode: "payment", customer_email: record.email, metadata,
    line_items: [{ price_data: { currency: "usd", unit_amount: amountCents, product: productId }, quantity: 1 }],
    payment_intent_data: { metadata, receipt_email: record.email, description: `Designated school donation: ${school.name}` },
    success_url: `${siteOrigin}/vision.html?school=${school.id}&donation=success#future-training`,
    cancel_url: `${siteOrigin}/vision.html?school=${school.id}&donation=cancelled#future-training`,
  }, { idempotencyKey: `school-${mode}-${record.id}` });
  const url = new URL(session.url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid Stripe checkout URL.");
  await store.transaction(data => Object.assign(data.checkouts[body.requestId], { checkoutUrl: url.toString(), sessionId: session.id }));
  return { checkoutUrl: url.toString() };
}

const objectId = value => typeof value === "string" ? value : value?.id;
export const schoolEventTypes = ["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled",
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "charge.succeeded", "charge.updated", "charge.refunded", "refund.created", "refund.updated", "refund.failed"];

export async function processSchoolEvent(store, stripe, event, mode) {
  if (!schoolEventTypes.includes(event.type)) return;
  if (event.livemode !== (mode === "live")) throw invalid("Payment mode mismatch.");
  const object = event.data.object;
  let paymentId = object.object === "payment_intent" ? object.id : objectId(object.payment_intent);
  if (!paymentId && object.object === "refund" && object.charge) {
    paymentId = objectId((await stripe.charges.retrieve(objectId(object.charge))).payment_intent);
  }
  if (!paymentId) return;
  return reconcileSchoolPayment(store, stripe, paymentId, mode);
}

export async function reconcileSchoolPayment(store, stripe, paymentId, mode) {
  // Fetch current provider state while holding the ledger lock. Old/out-of-order
  // webhook snapshots therefore cannot overwrite a newer payment or refund.
  return store.transaction(async data => {
    const intent = await stripe.paymentIntents.retrieve(paymentId, { expand: ["latest_charge.balance_transaction"] });
    if (intent.metadata?.purpose !== "school") return;
    if (intent.livemode !== (mode === "live") || intent.metadata.integration !== `school_${mode}`) throw new Error("School payment mode mismatch.");
    const checkout = Object.values(data.checkouts).find(c => c.id === intent.metadata.donation_id);
    if (!checkout || checkout.schoolId !== intent.metadata.school_id || intent.currency !== "usd" || intent.amount !== checkout.amountCents ||
      (checkout.paymentId && checkout.paymentId !== intent.id)) throw new Error("School payment does not match its server-side checkout record.");
    checkout.paymentId = intent.id;
    checkout.status = intent.status;
    if (intent.status !== "succeeded") return;
    if (intent.amount_received !== checkout.amountCents) throw new Error("School payment received amount mismatch.");
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge :
      await stripe.charges.retrieve(intent.latest_charge, { expand: ["balance_transaction"] });
    if (!charge?.paid || !charge.captured || charge.currency !== "usd" || charge.disputed) {
      // Disputes need a manual review; do not infer a savings transfer.
      throw new Error("School charge requires review.");
    }
    let refundedCents = 0;
    let feeCents = charge.balance_transaction?.currency === "usd" ? charge.balance_transaction.fee : null;
    for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100, expand: ["data.balance_transaction"] })) {
      if (refund.status !== "succeeded") continue;
      refundedCents += refund.amount;
      const balance = refund.balance_transaction;
      if (feeCents !== null && balance && typeof balance === "object" && balance.currency === "usd") feeCents += balance.fee;
      else feeCents = null;
    }
    if (!Number.isSafeInteger(feeCents)) feeCents = null;
    const previous = data.donations[intent.id];
    const donation = { id: intent.id, schoolId: checkout.schoolId, source: "stripe", status: "confirmed",
      date: new Date(charge.created * 1000).toISOString(), grossCents: intent.amount_received, refundedCents, feeCents,
      donorEmail: checkout.email, transfers: previous?.transfers || [], chargeId: charge.id,
      reconciledAt: new Date().toISOString() };
    data.donations[intent.id] = donation;
    if (!previous) queueNotification(data, donation);
    else if (previous.feeCents !== feeCents || previous.refundedCents !== refundedCents) {
      queueNotification(data, donation, `accounting-${refundedCents}-${feeCents}`);
    }
    return donation;
  });
}

export function applyAdminAction(data, body) {
  if (!body || !isUuid(body.requestId)) throw invalid("A valid operation ID is required.");
  const fingerprint = JSON.stringify(body);
  if (data.operations[body.requestId]) {
    if (data.operations[body.requestId] !== fingerprint) throw invalid("This operation ID was already used.");
    return;
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note || note.length > 1000) throw invalid("Add an audit note (1–1000 characters).");
  const school = data.schools.find(s => s.id === body.schoolId);
  if (!school) throw invalid("Choose a valid school.");
  if (body.action === "settings") {
    const goalCents = cents(body.goal, { min: 1 });
    if (typeof body.date !== "string" || !body.date.trim() || body.date.length > 100) throw invalid("Enter a date or Date TBD.");
    audit(data, "settings", { schoolId: school.id, before: { ...school }, note });
    school.goalCents = goalCents;
    school.date = body.date.trim();
  } else if (body.action === "starting") {
    const grossCents = cents(body.amount);
    const id = `starting-${school.id}`;
    const previous = data.donations[id];
    audit(data, "starting", { schoolId: school.id, before: previous?.grossCents ?? null, amountCents: grossCents, note });
    school.startingKnown = true;
    data.donations[id] = { id, schoolId: school.id, source: "starting", status: "confirmed", date: previous?.date || new Date().toISOString(),
      grossCents, refundedCents: 0, feeCents: 0, transfers: previous?.transfers || [], note };
  } else if (body.action === "offline" || body.action === "correction") {
    const grossCents = cents(body.amount, { signed: body.action === "correction", min: 0.01 });
    if (grossCents === 0) throw invalid("An adjustment must not be zero.");
    const feeCents = body.action === "offline" ? cents(body.fee ?? 0) : 0;
    if (body.action === "offline" && feeCents > grossCents) throw invalid("Fees cannot exceed the gift.");
    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) ||
      new Date(body.date).toISOString().slice(0,10) !== body.date || Date.parse(body.date) > Date.now()) throw invalid("Enter the actual received date, not a future date.");
    const id = `manual-${body.requestId}`;
    const donation = { id, schoolId: school.id, source: body.action, status: "confirmed", date: new Date(body.date).toISOString(),
      grossCents, refundedCents: 0, feeCents, transfers: [], note };
    data.donations[id] = donation;
    audit(data, body.action, { donationId: id, schoolId: school.id, amountCents: grossCents, note });
    if (body.action === "offline") queueNotification(data, donation);
  } else if (body.action === "refund" || body.action === "transfer") {
    const donation = data.donations[body.donationId];
    if (!donation || donation.schoolId !== school.id) throw invalid("Donation not found for this school.");
    if (body.action === "refund") {
      if (donation.source !== "offline") throw invalid("Refund Stripe payments in Stripe, then reconcile. Use corrections for other records.");
      const amountCents = cents(body.amount, { min: 0.01 });
      if (amountCents > donation.grossCents - donation.refundedCents) throw invalid("Refund exceeds the remaining gift.");
      donation.refundedCents += amountCents;
      audit(data, "offline refund", { donationId: donation.id, schoolId: school.id, amountCents, note });
    } else {
      const amountCents = cents(body.amount, { signed: true });
      const amounts = allocation(donation);
      if (!amountCents || amounts.netCents === null || (amountCents > 0 && amountCents > amounts.pendingCents) ||
          (amountCents < 0 && -amountCents > amounts.transferredCents)) throw invalid("Transfer exceeds confirmed net funds or reversal exceeds completed transfers.");
      donation.transfers.push({ id: body.requestId, amountCents, date: new Date().toISOString(), note });
      audit(data, "savings transfer recorded", { donationId: donation.id, schoolId: school.id, amountCents, note });
    }
  } else if (body.action === "notification-reviewed") {
    const notification = data.notifications[body.notificationId];
    if (!notification || notification.status !== "needs_review" || data.donations[notification.donationId]?.schoolId !== school.id) throw invalid("Notification is not awaiting review.");
    notification.status = "reviewed";
    audit(data, "notification reviewed in provider logs", { notificationId: notification.id, schoolId: school.id, note });
  } else throw invalid("Unknown administrative action.");
  data.operations[body.requestId] = fingerprint;
}
