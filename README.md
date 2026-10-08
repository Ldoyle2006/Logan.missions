# Mission update website starter

A lightweight Node.js website for missionary updates, a configurable link hub, Brevo double-opt-in newsletter signups, and Stripe-hosted donations. The site does not store payment details or newsletter subscriber records itself.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. From the project folder, run `npm start`.
4. Open `http://localhost:3000`.

The site runs without provider settings so you can edit and preview its content. Newsletter signup and donation checkout remain unavailable until their provider configuration is complete.

## Customize the site

- Edit `public/index.html` to add your name, mission, location, and story.
- The Give buttons open `public/giving.html`, where supporters can choose online giving or mailing a check. Update the check instructions there if your EquipNet details change. Online giving sends supporters to Stripe checkout only after `STRIPE_PAYMENT_LINK_URL` is configured.
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

Create a Stripe Payment Link in your Stripe dashboard, then set `STRIPE_PAYMENT_LINK_URL` in `.env`. Supporters can reach it from the online giving option on the Give page. The site redirects supporters to Stripe-hosted checkout; it never handles card or bank details. Test the link in Stripe's test mode before accepting live donations. Confirm any donation receipts, tax language, and fundraising disclosures with your organization.

## Brevo newsletter signup

1. Create a Brevo contact list for these updates.
2. Create and verify a double-opt-in email template in Brevo. The template should clearly identify you or your organization and explain why the recipient is receiving the confirmation request.
3. Create an API key with the minimum access needed for contacts and transactional email.
4. Set `BREVO_API_KEY`, `BREVO_LIST_ID`, and `BREVO_DOUBLE_OPT_IN_TEMPLATE_ID` in `.env`.
5. Set `PUBLIC_BASE_URL` to the exact public site origin (for local preview, `http://localhost:3000`; in production, use your HTTPS domain).
6. Confirm the full sign-up and unsubscribe flow before inviting people to subscribe.

The server sends the signup request to Brevo's double-opt-in endpoint. Subscribers are added to the configured list only after they confirm. Use Brevo to send updates and include its unsubscribe mechanism in each newsletter. Never put the API key in browser code or commit `.env`.

## Production

Deploy the Node server behind a hosting provider that supports Node.js 20+ and HTTPS. Configure the environment variables in the host's secret/environment settings rather than uploading `.env`. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin. The included in-memory signup rate limit is suitable only for a small starter deployment; use a shared rate limiter if running multiple server instances.
