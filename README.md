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

The Give page uses Stripe Elements to securely collect payment details in the page. The Node server creates one-time PaymentIntents and monthly or every-two-weeks Billing subscriptions. Configure all of the following in `.env` for local test mode or in Render's server environment:

- `STRIPE_SECRET_KEY` — a test-mode secret key (`sk_test_...`).
- `STRIPE_PUBLISHABLE_KEY` — the matching test-mode publishable key (`pk_test_...`). This key is returned to the browser only by `/api/config`.
- `STRIPE_WEBHOOK_SECRET` — the signing secret for a test-mode webhook endpoint.
- `PUBLIC_BASE_URL` — the canonical site origin, such as `https://logan-missions.onrender.com`.

Live-mode secret and publishable keys are rejected by the integration. Stripe test mode must be fully verified before any separate approval to enable live payments. Configure a Stripe webhook at `https://your-site.example/api/stripe-webhook` for `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`; put its test-mode signing secret in `STRIPE_WEBHOOK_SECRET`. The webhook signature is verified against the raw request body, and payment/subscription confirmations are recorded in the Node service logs. The website never receives card numbers. Test payment and recurring billing flows with Stripe's test cards before considering a live-mode launch. Confirm any donation receipts, tax language, and fundraising disclosures with your organization.

`STRIPE_PAYMENT_LINK_URL` is retained only for the legacy `/donate` route, which accepts a Stripe test-mode link. The embedded amount and schedule flow does not use Payment Links.

## Brevo newsletter signup

1. Create a Brevo contact list for these updates.
2. Create an API key with the minimum access needed to create and update contacts.
3. Set `BREVO_API_KEY` and `BREVO_LIST_ID` in `.env` or your hosting provider's environment settings. Set `BREVO_LIST_ID` to `4` for the example contact list.
4. Confirm the full sign-up and unsubscribe flow before inviting people to subscribe.

The server adds subscribers directly to the configured Brevo contact list using the Contacts API; no confirmation email is sent. Use Brevo to send updates and include its unsubscribe mechanism in each newsletter. Never put the API key in browser code or commit `.env`.

## Production

Deploy the Node server behind a hosting provider that supports Node.js 20+ and HTTPS. Configure the environment variables in the host's secret/environment settings rather than uploading `.env`. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin to enable HSTS; it is not required for newsletter signup. The included in-memory signup rate limit is suitable only for a small starter deployment; use a shared rate limiter if running multiple server instances.
