const signupForm = document.querySelector("#signup-form");
const formMessage = document.querySelector("#form-message");
const donationMessage = document.querySelector("#donation-message");

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function loadDonationStatus() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    setMessage(donationMessage, "Donation checkout is temporarily unavailable.", true);
    return;
  }

  const config = await response.json();
  if (!config.donationsConfigured) {
    document.querySelectorAll('a[href="/donate"]').forEach((link) => {
      link.setAttribute("aria-disabled", "true");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setMessage(donationMessage, "Giving will be available once the Stripe payment link is configured.");
      });
    });
  }
}

async function loadLinks() {
  const container = document.querySelector("#link-list");
  const response = await fetch("/links.json");
  if (!response.ok) throw new Error("The link list could not be loaded.");

  const data = await response.json();
  const links = Array.isArray(data.links) ? data.links : [];
  if (links.length === 0) return;

  container.replaceChildren();
  for (const item of links) {
    if (!item || typeof item.label !== "string" || typeof item.url !== "string") continue;
    let destination;
    try {
      destination = new URL(item.url);
    } catch {
      continue;
    }
    if (destination.protocol !== "https:" && destination.protocol !== "mailto:") continue;

    const anchor = document.createElement("a");
    anchor.className = "link-card";
    anchor.href = destination.toString();
    const number = document.createElement("span");
    number.className = "link-card-number";
    number.textContent = String(links.indexOf(item) + 1).padStart(2, "0");
    anchor.append(number);
    const copy = document.createElement("span");
    copy.className = "link-card-copy";
    const title = document.createElement("strong");
    title.textContent = item.label;
    const description = document.createElement("small");
    description.textContent = typeof item.description === "string" ? item.description : "";
    copy.append(title, description);
    const arrow = document.createElement("span");
    arrow.className = "link-card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    anchor.append(copy, arrow);
    if (destination.protocol === "https:") {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    container.append(anchor);
  }

  if (container.childElementCount === 0) {
    container.innerHTML = '<p class="empty-links">No links are configured yet. Add HTTPS or mailto links in <code>public/links.json</code>.</p>';
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(formMessage, "Sending your confirmation request…");
  const button = signupForm.querySelector('button[type="submit"]');
  button.disabled = true;

  const formData = new FormData(signupForm);
  const payload = {
    firstName: formData.get("firstName"),
    email: formData.get("email"),
    consent: formData.get("consent") === "on",
    website: formData.get("website"),
  };

  try {
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(formMessage, result.message || "Signup could not be completed. Please try again.", true);
      return;
    }
    setMessage(formMessage, result.message);
    signupForm.reset();
  } catch {
    setMessage(formMessage, "We could not reach the signup service. Please try again later.", true);
  } finally {
    button.disabled = false;
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("subscription") === "confirmed") {
  setMessage(formMessage, "Thanks for confirming! You’re on the update list.");
  document.querySelector("#updates").scrollIntoView({ behavior: "smooth" });
}

loadDonationStatus().catch(() => {
  setMessage(donationMessage, "Donation checkout is temporarily unavailable.", true);
});
loadLinks().catch(() => {
  document.querySelector("#link-list").innerHTML =
    '<p class="empty-links">The link list could not be loaded. Please try again later.</p>';
});
