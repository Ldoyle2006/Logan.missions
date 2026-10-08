const methodInputs = document.querySelectorAll('input[name="giving-method"]');
const amountPanel = document.querySelector("#amount-panel");
const checkPanel = document.querySelector("#check-panel");
const offlineDetail = document.querySelector("#offline-detail");
const offlineMethodButtons = document.querySelectorAll(".offline-method");
const nextStepButton = document.querySelector("#next-step");
const paymentOptions = document.querySelector("#payment-options");
const paymentSummary = document.querySelector("#payment-summary");
const paymentDetail = document.querySelector("#payment-detail");
const changeGiftButton = document.querySelector("#change-gift");
const stripeMethodStatus = document.querySelector("#stripe-method-status");
const customAmount = document.querySelector("#custom-amount");
const amountOptions = document.querySelectorAll('input[name="giving-amount"]');
const choiceInputs = document.querySelectorAll(".giving-choice input[type='radio']");
const paymentMethodButtons = document.querySelectorAll(".payment-option");
let stripeConfigured = false;

function syncChoiceStyles() {
  for (const input of choiceInputs) {
    input.closest(".giving-choice").classList.toggle("is-selected", input.checked);
  }
}

function selectedGift() {
  const selectedAmount = document.querySelector('input[name="giving-amount"]:checked');
  const amount = selectedAmount.value === "custom"
    ? Number(customAmount.value)
    : Number(selectedAmount.value);
  const schedule = document.querySelector('input[name="giving-schedule"]:checked').value;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
  const scheduleLabel = {
    "one-time": "one-time",
    "bi-weekly": "bi-weekly",
    monthly: "monthly",
  }[schedule];

  return { amount, formattedAmount, schedule, scheduleLabel };
}

function showMethodDetails(method) {
  paymentDetail.replaceChildren();
  paymentDetail.hidden = false;

  for (const button of paymentMethodButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.method === method));
  }

  const copy = {
    venmo: "Give through your Venmo profile. Your amount and schedule selected here are not automatically applied.",
    cashapp: "Give through your Cash App profile. Your amount and schedule selected here are not automatically applied.",
    equipnet: "Give online through your EquipNet missionary page. Your amount and schedule selected here are not automatically applied.",
    stripe: "Stripe checkout is coming soon. I’ll connect the secure payment link here when it’s ready.",
  };

  const message = document.createElement("p");
  message.className = "payment-detail-message";
  message.textContent = copy[method];
  paymentDetail.append(message);

  if (method === "equipnet") {
    const onlineGiving = document.createElement("a");
    onlineGiving.className = "button button-dark giving-checkout";
    onlineGiving.href = "https://www.equipnet.org/missionaries/ldoyle";
    onlineGiving.target = "_blank";
    onlineGiving.rel = "noopener noreferrer";
    onlineGiving.append("Continue to EquipNet ", document.createTextNode("↗"));
    paymentDetail.append(onlineGiving);
  }

  if (method === "venmo") {
    const venmoGiving = document.createElement("a");
    venmoGiving.className = "button button-dark giving-checkout";
    venmoGiving.href = "https://venmo.com/u/Logan-Doyle-25";
    venmoGiving.target = "_blank";
    venmoGiving.rel = "noopener noreferrer";
    venmoGiving.append("Continue to Venmo ", document.createTextNode("↗"));
    paymentDetail.append(venmoGiving);
  }

  if (method === "cashapp") {
    const cashAppGiving = document.createElement("a");
    cashAppGiving.className = "button button-dark giving-checkout";
    cashAppGiving.href = "https://cash.app/$Logan12missions";
    cashAppGiving.target = "_blank";
    cashAppGiving.rel = "noopener noreferrer";
    cashAppGiving.append("Continue to Cash App ", document.createTextNode("↗"));
    paymentDetail.append(cashAppGiving);
  }

  if (method === "stripe" && stripeConfigured) {
    const checkout = document.createElement("a");
    checkout.className = "button button-dark giving-checkout";
    checkout.href = "/donate";
    checkout.append("Test Stripe checkout ", document.createTextNode("↗"));
    paymentDetail.append(checkout);
  }
}

for (const input of choiceInputs) {
  input.addEventListener("change", syncChoiceStyles);
}
syncChoiceStyles();

for (const input of methodInputs) {
  input.addEventListener("change", () => {
    const isOnline = input.value === "online";
    amountPanel.hidden = !isOnline;
    checkPanel.hidden = isOnline;
    paymentOptions.hidden = true;
    paymentDetail.hidden = true;
    paymentOptions.classList.remove("is-visible");
    offlineDetail.hidden = true;
    offlineDetail.replaceChildren();
    for (const button of offlineMethodButtons) button.setAttribute("aria-pressed", "false");
    if (isOnline) {
      amountPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      checkPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

for (const button of offlineMethodButtons) {
  button.addEventListener("click", () => {
    const method = button.dataset.offlineMethod;
    for (const option of offlineMethodButtons) {
      option.setAttribute("aria-pressed", String(option === button));
    }

    offlineDetail.replaceChildren();
    offlineDetail.hidden = false;

    if (method === "check") {
      const instructions = document.createElement("p");
      instructions.className = "payment-detail-message";
      instructions.append("Please make checks payable to ");
      const payee = document.createElement("strong");
      payee.textContent = "EquipNet";
      instructions.append(payee, ". Include my account number ");
      const account = document.createElement("strong");
      account.textContent = "Equip6310";
      instructions.append(account, " in the memo section on the face of your check.");

      const address = document.createElement("address");
      address.className = "mailing-address";
      address.append("Please mail checks to:", document.createElement("br"), "EquipNet", document.createElement("br"), "P.O. Box 860", document.createElement("br"), "Alamo, CA 94507");
      offlineDetail.append(instructions, address);
      return;
    }

    const bankInstructions = document.createElement("p");
    bankInstructions.className = "payment-detail-message";
    bankInstructions.textContent = "Would you prefer to give directly through your bank? Request my secure transfer instructions for one-time or recurring support.";
    const privacyNote = document.createElement("p");
    privacyNote.className = "payment-detail-message";
    privacyNote.textContent = "Banking details are shared privately and are not displayed publicly.";
    const requestDetails = document.createElement("a");
    requestDetails.className = "button button-coral giving-checkout";
    requestDetails.href = `mailto:Logan.missions@icloud.com?subject=${encodeURIComponent("Request Bank Transfer Details")}&body=${encodeURIComponent("Hi Logan,\n\nCould you please send me your secure bank transfer instructions for one-time or recurring mission support?\n\nThank you!")}`;
    requestDetails.textContent = "Request Bank Transfer Details";
    offlineDetail.append(bankInstructions, privacyNote, requestDetails);
  });
}

for (const input of amountOptions) {
  input.addEventListener("change", () => {
    const isCustom = input.value === "custom";
    customAmount.disabled = !isCustom;
    if (isCustom) customAmount.focus();
    syncChoiceStyles();
  });
}

customAmount.addEventListener("focus", () => {
  document.querySelector('input[name="giving-amount"][value="custom"]').checked = true;
  customAmount.disabled = false;
  syncChoiceStyles();
});

nextStepButton.addEventListener("click", () => {
  const selectedAmount = document.querySelector('input[name="giving-amount"]:checked');
  if (selectedAmount.value === "custom" && !customAmount.reportValidity()) return;

  const gift = selectedGift();
  if (!Number.isFinite(gift.amount) || gift.amount < 5) {
    customAmount.setCustomValidity("Enter a donation amount of at least $5.");
    customAmount.reportValidity();
    customAmount.addEventListener("input", () => customAmount.setCustomValidity(""), { once: true });
    return;
  }

  paymentSummary.textContent = `${gift.formattedAmount} · ${gift.scheduleLabel} gift`;
  paymentOptions.hidden = false;
  paymentOptions.classList.remove("is-visible");
  requestAnimationFrame(() => {
    paymentOptions.classList.add("is-visible");
    paymentOptions.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  paymentDetail.hidden = true;
  paymentDetail.replaceChildren();
  for (const button of paymentMethodButtons) button.setAttribute("aria-pressed", "false");
});

changeGiftButton.addEventListener("click", () => {
  paymentOptions.hidden = true;
  paymentOptions.classList.remove("is-visible");
  amountPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  nextStepButton.focus({ preventScroll: true });
});

for (const button of paymentMethodButtons) {
  button.addEventListener("click", () => showMethodDetails(button.dataset.method));
}

async function loadStripeStatus() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Stripe availability check returned an unsuccessful response.");
  }

  const config = await response.json();
  stripeConfigured = Boolean(config.donationsConfigured);
  stripeMethodStatus.textContent = stripeConfigured ? "Checkout available" : "Coming soon";
}

loadStripeStatus().catch((error) => {
  stripeMethodStatus.textContent = "Temporarily unavailable";
  console.error(error);
});
