# Mission update website starter

A lightweight Node.js website for missionary updates, a configurable link hub, Brevo newsletter signups, and Stripe-hosted donations. The site does not store payment details or newsletter subscriber records itself.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. From the project folder, run `npm start`.
4. Open `http://localhost:3000`.

The site runs without provider settings so you can edit and preview its content. Newsletter signup and donation checkout remain unavailable until their provider configuration is complete.

## Customize the site

- Edit `public/index.html` to add your name, mission, location, and story.
- The Give buttons open `public/giving.html`, where supporters can choose an amount, schedule, and giving method, or mail a check. Update the check instructions there if your EquipNet details change. Stripe checkout creates a secure session for the selected gift amount and schedule.
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

Set `STRIPE_SECRET_KEY` in `.env` or your hosting provider's server-side environment settings, and set `PUBLIC_BASE_URL` to the canonical site URL. The server creates Stripe Checkout Sessions using the selected one-time, bi-weekly, or monthly amount. Supporters enter their email and payment details on Stripe; the site never handles or stores card details. Keep the secret key server-side and never add it to browser code or commit it. Test with a Stripe test-mode secret key before switching to a live key. Confirm any donation receipts, tax language, and fundraising disclosures with your organization.

`STRIPE_PAYMENT_LINK_URL` remains supported by the legacy `/donate` redirect, but the amount and schedule selector uses `STRIPE_SECRET_KEY` to create an amount-specific checkout session.

## Brevo newsletter signup

1. Create a Brevo contact list for these updates.
2. Create an API key with the minimum access needed to create and update contacts.
3. Set `BREVO_API_KEY` and `BREVO_LIST_ID` in `.env` or your hosting provider's environment settings. Set `BREVO_LIST_ID` to `4` for the example contact list.
4. Confirm the full sign-up and unsubscribe flow before inviting people to subscribe.

The server adds subscribers directly to the configured Brevo contact list using the Contacts API; no confirmation email is sent. Use Brevo to send updates and include its unsubscribe mechanism in each newsletter. Never put the API key in browser code or commit `.env`.

## Production

Deploy the Node server behind a hosting provider that supports Node.js 20+ and HTTPS. Configure the environment variables in the host's secret/environment settings rather than uploading `.env`. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin to enable HSTS; it is not required for newsletter signup. The included in-memory signup rate limit is suitable only for a small starter deployment; use a shared rate limiter if running multiple server instances.
