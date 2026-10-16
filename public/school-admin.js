const adminMessage = document.querySelector("#admin-message");
const money = cents => cents === null ? "Pending confirmation" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
let ledger;
let adminBusy = false;
async function api(path, body) {
  const response = await fetch(`/api/school-admin/${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401 && !document.querySelector("#admin-login")) location.reload(); throw new Error(result.message); }
  return result;
}
function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
function line(parent, label, value) { parent.append(node("p", `${label}: ${value}`)); }
async function action(work) {
  if (adminBusy) return;
  adminBusy = true;
  const buttons = [...document.querySelectorAll("button")];
  const inputs = [...document.querySelectorAll("input, select, textarea")];
  buttons.forEach(b => b.disabled = true);
  inputs.forEach(b => b.disabled = true);
  try { await work(); }
  catch (error) { adminMessage.textContent = error.message; adminMessage.scrollIntoView({ block: "center" }); }
  finally { adminBusy = false; buttons.forEach(b => b.disabled = false); inputs.forEach(b => b.disabled = false); }
}
document.querySelector("#admin-login")?.addEventListener("submit", event => {
  event.preventDefault();
  const password = new FormData(event.target).get("password");
  action(async () => { await api("login", { password }); location.reload(); });
});
document.querySelector("#admin-logout")?.addEventListener("click", () => action(async () => { await api("logout", {}); location.reload(); }));
async function reloadLedger() { ledger = await api("ledger"); renderLedger(); }
function renderLedger() {
  const schoolId = document.querySelector("#admin-school").value;
  const school = ledger.schools.find(s => s.id === schoolId);
  const donations = ledger.donations.filter(d => d.schoolId === schoolId);
  document.querySelector("#admin-mode").textContent = `${ledger.mode.toUpperCase()} ledger. ${ledger.mode === "test" ? "Test gifts are hidden from public totals. Test settings are separate from live settings." : "Confirmed live totals appear on the Vision page once starting funds are confirmed."} ${ledger.notificationsConfigured ? "Email notifications configured." : "Email is not configured; notifications remain queued."}`;
  const summary = document.querySelector("#admin-summary"); summary.replaceChildren(node("h2", school.name));
  line(summary, "Goal / date", `${money(school.goalCents)} / ${school.date}`);
  line(summary, "Starting funds", school.startingKnown ? "Confirmed" : "Not yet confirmed — public balance remains unknown");
  line(summary, "Recorded gross funds less refunds (including adjustments)", money(donations.reduce((t,d) => t + d.grossCents - d.refundedCents, 0)));
  line(summary, "Confirmed net funds", money(donations.reduce((t,d) => t + (d.netCents ?? 0), 0)));
  line(summary, "Completed savings transfers", money(donations.reduce((t,d) => t + d.transferredCents, 0)));
  line(summary, "Pending net transfers / reconciliation", money(donations.reduce((t,d) => t + (d.pendingCents ?? 0), 0)));
  line(summary, "Gifts awaiting fee confirmation (excluded from net totals)", donations.filter(d => d.netCents === null).length);
  const settings = document.querySelector('[data-action="settings"]');
  settings.elements.goal.value = school.goalCents / 100; settings.elements.date.value = school.date;
  const starting = donations.find(d => d.source === "starting");
  document.querySelector('[data-action="starting"]').elements.amount.value = starting ? starting.grossCents / 100 : "";
  const list = document.querySelector("#admin-donations"); list.replaceChildren();
  const select = document.querySelector("#action-donation"); select.replaceChildren();
  for (const donation of donations.sort((a,b) => b.date.localeCompare(a.date))) {
    const card = node("article", undefined, "admin-panel");
    card.append(node("h3", `${money(donation.grossCents)} · ${donation.source}`));
    line(card, "Donation ID", donation.id); line(card, "Received", new Date(donation.date).toLocaleString());
    if (donation.donorEmail) line(card, "Receipt email (private)", donation.donorEmail);
    line(card, "Refunded", money(donation.refundedCents)); line(card, "Processing fees", money(donation.feeCents));
    line(card, "Net available", money(donation.netCents)); line(card, "Transferred", money(donation.transferredCents));
    line(card, "Pending / reconciliation", money(donation.pendingCents)); line(card, "Savings status", donation.savingsStatus);
    if (donation.note) line(card, "Note", donation.note);
    if (donation.transfers.length) { const transfers = node("details"); transfers.append(node("summary", "Completed transfer history")); donation.transfers.forEach(t => line(transfers, `${t.date} · ${money(t.amountCents)}`, t.note)); card.append(transfers); }
    if (donation.source === "stripe") {
      const button = node("button", "Reconcile with Stripe", "button button-dark"); button.type = "button";
      button.addEventListener("click", () => action(async () => { const result = await api("reconcile", { donationId: donation.id }); adminMessage.textContent = result.message; await reloadLedger(); })); card.append(button);
    }
    list.append(card);
    const option = node("option", `${donation.id} · ${money(donation.grossCents)}`); option.value = donation.id; select.append(option);
  }
  if (!donations.length) list.append(node("p", "No donations recorded for this school yet."));
  const notifications = document.querySelector("#admin-notifications"); notifications.replaceChildren();
  for (const n of ledger.notifications.filter(n => donations.some(d => d.id === n.donationId))) {
    const entry = node("p", `${n.subject} — ${n.status}${n.status !== "sent" && n.lastProviderStatus ? ` (Brevo HTTP ${n.lastProviderStatus})` : ""}`);
    if (n.status === "needs_review") {
      const button = node("button", "Record provider-log review"); button.type = "button";
      button.addEventListener("click", () => { const note = prompt("After checking Brevo delivery logs, record the outcome and any action taken:"); if (note) action(async () => { await api("action", { requestId: crypto.randomUUID(), action: "notification-reviewed", schoolId, notificationId: n.id, note }); await reloadLedger(); }); }); entry.append(button);
    }
    notifications.append(entry);
  }
  const audit = document.querySelector("#admin-audit"); audit.replaceChildren();
  ledger.audit.filter(a => a.schoolId === schoolId).forEach(a => audit.append(node("p", `${a.date} · ${a.action} · ${a.amountCents === undefined ? "" : money(a.amountCents)} · ${a.note}`)));
}
document.querySelector("#admin-school")?.addEventListener("change", renderLedger);
document.querySelectorAll("form[data-action], #donation-action").forEach(form => {
  let requestId = crypto.randomUUID();
  form.addEventListener("input", () => requestId = crypto.randomUUID());
  form.addEventListener("submit", event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    for (const field of ["amount", "fee", "goal"]) if (field in body) body[field] = Number(body[field]);
    Object.assign(body, { action: form.dataset.action || body.action, requestId, schoolId: document.querySelector("#admin-school").value });
    action(async () => { const result = await api("action", body); requestId = crypto.randomUUID(); adminMessage.textContent = result.message; form.reset(); await reloadLedger(); });
  });
});
if (document.querySelector("#admin-school")) action(reloadLedger);
