# Mission update website starter

A lightweight Node.js website for missionary updates, a configurable link hub, Brevo newsletter signups, and Stripe Checkout donations. Designated school gifts use a private PostgreSQL ledger for donation, refund, fee, and savings allocation records. Card details remain with Stripe; newsletter subscriber records remain with Brevo.

See [School funding setup and verification](docs/SCHOOL_FUNDING.md) for the new Giving/Vision features, private administration, environment variables, and required Stripe test-mode acceptance checks. The supplied project context is saved in [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md).

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. From the project folder, run `npm install`, then `npm start`.
4. Open `http://localhost:3000`.

The site runs without provider settings so you can edit and preview its content. Newsletter signup and Stripe Checkout donations remain unavailable until their provider configuration is complete.

## Customize the site

- Edit `public/index.html` to add your name, mission, location, and story.
- The Give buttons open `public/giving.html`, where supporters can choose an amount, schedule, and giving method, or mail a check. Update the check instructions there if your EquipNet details change. Stripe Checkout securely collects payment details on Stripe-hosted pages for the selected gift amount and schedule.
- The Shop link opens `public/shop.html`, with four Scripture-based collections and direct links to each hat on Fourthwall. Shoppers choose colors, add products to their cart, and check out on Fourthwall, which handles current options, payment, printing, fulfillment, and shipping. Shirts and hoodies appear as Coming Soon placeholders until they are actually listed in the shop.
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

The Give page sends supporters to Stripe-hosted Checkout. The server creates one-time payment Checkout Sessions and subscription Checkout Sessions with monthly or every-14-days recurring Prices. Preset gifts are $25, $50, $75, $100, $250, and $500; custom gifts from $5 to $999,999.99 are also accepted. Each option can be given once, monthly, or every 14 days. Recurring terms are shown before Checkout.

For test mode, configure these variables in `.env` or Render:

- `STRIPE_MODE=test`.
- `STRIPE_SECRET_KEY` — the test secret key (`sk_test_...`).
- `STRIPE_WEBHOOK_SECRET` — the signing secret (`whsec_...`) for the test webhook endpoint.
- `PUBLIC_BASE_URL` — the canonical HTTPS site origin, such as `https://logan-missions.onrender.com`.

Stripe Checkout is created server-side with the secret key; no publishable key is needed in the browser. Live mode is supported in code, but is disabled unless `STRIPE_MODE=live`, a live secret key is configured, and `STRIPE_LIVE_MODE_APPROVED=true`. Do not set those live-mode values until Logan has explicitly approved activating live donations. Never put secret or webhook keys in browser code.

Create a Stripe webhook for the matching mode at `https://logan-missions.onrender.com/api/stripe-webhook`. Subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Keep the test and live webhook signing secrets separate; set only the secret for the configured mode in `STRIPE_WEBHOOK_SECRET`. The server verifies signatures against the raw request body and rejects events from the wrong mode.

General-support checkout uses a reusable Stripe Product and inline Prices. The two-week schedule is a weekly Price with `interval_count: 2`. General-support events retain the original logging behavior. School checkout uses its own product descriptions, designation metadata, persistent records, and transaction-level duplicate protection. See the school setup guide for the additional webhook events. Neither an unpaid Checkout Session nor a success-page visit credits a school.

Run `npm test` for checkout request, amount, schedule, metadata, return URL, and validation checks using a mocked Stripe client. These tests do not call Stripe and do not replace end-to-end test-mode card, 3DS, failed-payment, cancellation, webhook-delivery, and Stripe Test Clock testing. Confirm those flows in Stripe test mode before any live launch. Confirm donation receipts, tax language, and fundraising disclosures with your organization.

`STRIPE_PAYMENT_LINK_URL` is retained only for the legacy `/donate` route, which accepts a Stripe test-mode link. The amount and schedule flow creates Checkout Sessions and does not use Payment Links.

## Brevo newsletter signup

1. Create a Brevo contact list for these updates.
2. Create an API key with the minimum access needed to create and update contacts.
3. Set `BREVO_API_KEY` and `BREVO_LIST_ID` in `.env` or your hosting provider's environment settings. Set `BREVO_LIST_ID` to `4` for the example contact list.
4. Confirm the full sign-up and unsubscribe flow before inviting people to subscribe.

The server adds subscribers directly to the configured Brevo contact list using the Contacts API; no confirmation email is sent. Use Brevo to send updates and include its unsubscribe mechanism in each newsletter. Never put the API key in browser code or commit `.env`.

## Fourthwall merchandise shop

The Shop page links directly to the four public hat listings at `logans-mission-shop.fourthwall.com`. Color selection, the cart, and checkout happen on Fourthwall. The page has no local cart, does not fetch the Storefront API, and works without a `FOURTHWALL_STOREFRONT_TOKEN`. Product links open in a new tab. Donation checkout remains a separate Stripe flow.

The existing server-side catalog and checkout API routes are retained for possible future use. They require `FOURTHWALL_STOREFRONT_TOKEN` in private environment settings; the public shop page does not use them. Never put the token in public JavaScript or commit `.env`.

## Merchandise

The four collections are Worthy of Hearing (Romans 10:14–15), Known by Name (Isaiah 43:1), Beyond Language (1 John 3:18), and The Way Is Open (Hebrews 10:19–22). Each currently has its matching public hat. T-shirts and hoodies are labeled Coming Soon until they exist as public Fourthwall products. Merchandise profits after product/platform costs support missionary work, including travel, Bible training, and living costs while serving. Purchases are not tax-deductible donations.

## Production

Deploy the Node server behind a hosting provider that supports Node.js 20+ and HTTPS. Configure the environment variables in the host's secret/environment settings rather than uploading `.env`. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin to enable HSTS; it is not required for newsletter signup. The included in-memory signup rate limit is suitable only for a small starter deployment; use a shared rate limiter if running multiple server instances.
