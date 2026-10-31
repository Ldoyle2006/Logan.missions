# Site identity and waiting states

Public website: https://logan-missions.pages.dev/

The requested homepage title is `Logan Doyle | YWAM Missionary`. The preferred search site name is `Logan Missions`. The home page WebSite structured data and Open Graph metadata use that identity; other pages keep their own page titles. Google chooses its displayed title/site name and must recrawl before changes appear. A favicon is eligible, not guaranteed, in search results.

The favicon uses the site's existing globe/cross mark in cream on deep green. Public files: `/favicon.svg`, `/favicon.png` (96×96), `/apple-touch-icon.png` (180×180). Their links are present on every public page, including generated newsletters. No paid icon or AI-generated logo was used.

Render's free service can take about a minute to wake after 15 idle minutes. Its host-controlled loading page appears before this application can run, so repository changes cannot replace that initial page or remove the hosting delay. The Cloudflare public website already serves its pages immediately without waiting for Render; use that public address. A paid Render compute plan would remove the free-service spin-down limitation, but no plan or subscription was changed here.

For the actual checkout-request wait, the forms now display a Logan Missions card with the existing logo and respect reduced-motion settings. There is no artificial timer, page-covering loader, or extra delay. Errors remove the card and restore the existing retry controls. The Cloudflare proxy normalizes host HTML wake-up pages into JSON errors for its existing public API allowlist. Genuine HTTP error statuses remain intact; Stripe webhook routes and bodies are untouched.

Official references:
- https://render.com/docs/free#spinning-down-on-idle
- https://developers.google.com/search/docs/appearance/favicon-in-search
- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/appearance/site-names
