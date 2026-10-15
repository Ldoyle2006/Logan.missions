const schoolDialog = document.querySelector("#school-checkout");
const schoolForm = document.querySelector("#school-donation-form");
const schoolMessage = document.querySelector("#school-form-message");
const schoolSubmit = document.querySelector("#school-submit");
const schoolStatus = document.querySelector("#school-checkout-status");
const schoolMoney = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value / 100);
let selectedSchool;
let schoolConfig;
let schoolRequestId;
let schoolSubmitting = false;
function showSchoolStatus(message) { schoolStatus.textContent = message; schoolStatus.hidden = false; }
const returnStatus = new URLSearchParams(location.search).get("donation");
if (returnStatus === "success") showSchoolStatus("Thank you for supporting this vision. Funding progress updates only after Stripe confirms payment; returning here does not confirm a gift.");
if (returnStatus === "cancelled") showSchoolStatus("Checkout was closed. If you did not complete payment, no donation has been recorded.");

async function loadSchoolProgress() {
  try {
    const response = await fetch("/api/schools", { cache: "no-store" });
    if (!response.ok) throw new Error();
    schoolConfig = await response.json();
    for (const school of schoolConfig.schools) {
      const card = document.querySelector(`[data-school="${school.id}"]`);
      if (!card) continue;
      card.querySelector(".school-date").textContent = school.date;
      card.querySelector("[data-goal]").textContent = schoolMoney(school.goalCents);
      if (school.raisedCents === null) continue;
      card.querySelector("[data-raised]").textContent = schoolMoney(school.raisedCents);
      card.querySelector("[data-remaining]").textContent = schoolMoney(school.remainingCents);
      card.querySelector("[data-percentage]").textContent = `${school.percentage.toFixed(1)}% funded`;
      const progress = card.querySelector(".school-progress");
      progress.setAttribute("aria-label", `${school.name} funding`);
      progress.setAttribute("aria-valuenow", Math.min(100, school.percentage));
      progress.setAttribute("aria-valuetext", `${school.percentage.toFixed(1)}% funded`);
      progress.firstElementChild.style.width = `${Math.min(100, school.percentage)}%`;
    }
  } catch { showSchoolStatus("Current funding progress is temporarily unavailable. Please check back soon."); }
}
document.querySelectorAll("[data-school-give]").forEach(button => button.addEventListener("click", () => {
  selectedSchool = button.dataset.schoolGive;
  schoolRequestId = crypto.randomUUID();
  document.querySelector("#school-checkout-title").textContent = document.querySelector(`[data-school="${selectedSchool}"] h3`).textContent;
  document.querySelector("#school-test-notice").hidden = schoolConfig?.checkoutMode !== "test";
  schoolMessage.textContent = schoolConfig?.checkoutEnabled ? "" : "Designated school checkout is not configured yet. Please check back soon.";
  schoolSubmit.disabled = !schoolConfig?.checkoutEnabled;
  schoolDialog.showModal();
}));
document.querySelector("#close-school-checkout").addEventListener("click", () => { if (!schoolSubmitting) schoolDialog.close(); });
schoolDialog.addEventListener("cancel", event => { if (schoolSubmitting) event.preventDefault(); });
schoolForm.addEventListener("input", () => { if (!schoolSubmitting) schoolRequestId = crypto.randomUUID(); });
schoolForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (schoolSubmitting) return;
  const fields = new FormData(schoolForm);
  schoolSubmitting = true;
  for (const element of schoolForm.elements) element.disabled = true;
  schoolMessage.textContent = "Preparing your designated checkout…";
  try {
    const response = await fetch("/api/schools/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: selectedSchool, requestId: schoolRequestId, amount: Number(fields.get("amount")), email: fields.get("email").trim() }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Checkout could not be prepared.");
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout address.");
    location.assign(url.toString());
  } catch (error) { schoolMessage.textContent = error.message; }
  finally { schoolSubmitting = false; for (const element of schoolForm.elements) element.disabled = false; }
});
loadSchoolProgress();
setInterval(() => { if (!document.hidden && !schoolDialog.open) loadSchoolProgress(); }, 60_000);
