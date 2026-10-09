# Mission update website starter

A lightweight Node.js website for missionary updates, a configurable link hub, Brevo newsletter signups, and Stripe Elements donations. The site does not store payment details or newsletter subscriber records itself.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. From the project folder, run `npm start`.
4. Open `http://localhost:3000`.

The site runs without provider settings so you can edit and preview its content. Newsletter signup and the embedded test-mode donation form remain unavailable until their provider configuration is complete.

## Customize the site

- Edit `public/index.html` to add your name, mission, location, and story.
- The Give buttons open `public/giving.html`, where supporters can choose an amount, schedule, and giving method, or mail a check. Update the check instructions there if your EquipNet details change. Stripe Elements securely collects payment details on the page for the selected gift amount and schedule.
- The Shop link opens `public/shop.html`, a merchandise concept preview. Product illustrations and prices are placeholders, and purchases are not enabled.
- Edit `public/links.json` to show multiple links. Example:

  ```json
  {
    "links": [
      {
        "label": "Prayer updates",
        "url": "https://your-site.example/prayer",
        "description": "Read the latest letter from the field."
      },
      {
        "label": "Get in touch",
        "url": "mailto:you@example.org",
        "description": "Send a note or prayer request."
      }
    ]
  }
  ```

  Link URLs must use HTTPS or `mailto:`.
- Replace the contact and organization placeholders in `public/privacy.html`, and have the final notice reviewed for your location and ministry.
- Replace the sample page title and description in `public/index.html`.

## Stripe donations

The Give page uses Stripe Elements to collect payment details on the site. The server creates one-time PaymentIntents and monthly or every-14-days Stripe Billing subscriptions. Monthly is the suggested selection; donors may choose another amount and frequency. Recurring terms are shown before checkout.

For test mode, configure these variables in `.env` or Render:

- `STRIPE_MODE=test`.
- `STRIPE_SECRET_KEY` — the test secret key (`sk_test_...`).
- `STRIPE_PUBLISHABLE_KEY` — its matching test publishable key (`pk_test_...`). The server returns this public key to the browser via `/api/config`.
- `STRIPE_WEBHOOK_SECRET` — the signing secret (`whsec_...`) for the test webhook endpoint.
- `PUBLIC_BASE_URL` — the canonical HTTPS site origin, such as `https://logan-missions.onrender.com`.

Live mode is supported in code, but is disabled unless `STRIPE_MODE=live`, matching live keys are configured, and `STRIPE_LIVE_MODE_APPROVED=true`. Do not set those live-mode values until Logan has explicitly approved activating live donations. Never put secret or webhook keys in browser code.

Create a Stripe webhook for the matching mode at `https://logan-missions.onrender.com/api/stripe-webhook`. Subscribe it to `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Keep the test and live webhook signing secrets separate; set only the secret for the configured mode in `STRIPE_WEBHOOK_SECRET`. The server verifies signatures against the raw request body and rejects events from the wrong mode.

Recurring subscriptions start in `incomplete` status, and the Payment Element confirms the initial invoice. The server uses a reusable Stripe Product for inline recurring Prices (the current Stripe API requires a Product ID; passing `product_data` directly to subscription Price data fails). The two-week schedule is a weekly Price with `interval_count: 2`. Webhook events report paid/failed invoices and subscription changes. Duplicate event IDs are suppressed in process memory; this starter has no persistent database, so webhook processing is intentionally limited to idempotent logging, not durable donation records. Do not treat an incomplete subscription as paid.

Run `npm test` for recurring subscription request and interval checks. This test suite does not replace end-to-end test-mode card, 3DS, failed-payment, cancellation, and Stripe Test Clock testing. Confirm those flows with Stripe test methods before any live launch. Confirm donation receipts, tax language, and fundraising disclosures with your organization.

`STRIPE_PAYMENT_LINK_URL` is retained only for the legacy `/donate` route, which accepts a Stripe test-mode link. The embedded amount and schedule flow does not use Payment Links.

## Brevo newsletter signup

1. Create a Brevo contact list for these updates.
2. Create an API key with the minimum access needed to create and update contacts.
3. Set `BREVO_API_KEY` and `BREVO_LIST_ID` in `.env` or your hosting provider's environment settings. Set `BREVO_LIST_ID` to `4` for the example contact list.
4. Confirm the full sign-up and unsubscribe flow before inviting people to subscribe.

The server adds subscribers directly to the configured Brevo contact list using the Contacts API; no confirmation email is sent. Use Brevo to send updates and include its unsubscribe mechanism in each newsletter. Never put the API key in browser code or commit `.env`.

## Production

Deploy the Node server behind a hosting provider that supports Node.js 20+ and HTTPS. Configure the environment variables in the host's secret/environment settings rather than uploading `.env`. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin to enable HSTS; it is not required for newsletter signup. The included in-memory signup rate limit is suitable only for a small starter deployment; use a shared rate limiter if running multiple server instances.
