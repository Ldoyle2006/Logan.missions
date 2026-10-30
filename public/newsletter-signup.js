const form = document.querySelector("#signup-form");
if (form) form.addEventListener("submit", async event => {
  event.preventDefault();
  const message = form.querySelector("#form-message");
  const button = form.querySelector('button[type="submit"]');
  const show = (text, error = false) => { message.textContent = text; message.classList.toggle("is-error", error); };
  show("Adding you to the update list…"); button.disabled = true;
  const fields = new FormData(form);
  try {
    const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: fields.get("firstName"), email: fields.get("email"), consent: fields.get("consent") === "on", website: fields.get("website") }) });
    const result = await response.json();
    show(result.message || "Signup could not be completed. Please try again.", !response.ok);
    if (response.ok) form.reset();
  } catch { show("We could not reach the signup service. Please try again later.", true); }
  finally { button.disabled = false; }
});
