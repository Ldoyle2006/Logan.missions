# Public hosting migration

## Status — October 26, 2026

Prepared locally, not published. Cloudflare account sign-in is complete. GitHub installation review is open with **Only select repositories → Ldoyle2006/Logan.missions** selected; the owner must approve its requested access before continuing. No paid plan, API token, or new deployment has been activated.

The owner authorized preparing free Cloudflare hosting to remove Render's sleeping-server Google crawl block while preserving visible content and design. Existing Stripe processing, webhooks, private administration, newsletter integration and donation records remain on Render.

## Cloudflare Pages project

- Connect only `Ldoyle2006/Logan.missions` using the official Cloudflare Workers and Pages GitHub app. Its installation requests metadata read access and read/write access to administration, checks, code, deployments and pull requests; review before approving.
- Build command: `npm run build:pages`.
- Build output directory: `.cloudflare-dist`.
- Framework preset: None. Root directory: repository root.
- Set `PUBLIC_SITE_URL` for production builds **and Functions runtime** to the actual assigned HTTPS Pages origin, with no path. Do not publish the local `https://frontend.example` validation build.
- Use the tested migration branch for initial setup; coordinate the eventual production branch with the owner. Preview host form submissions are intentionally rejected.
- Node version is pinned by `.node-version`. No Stripe, email, database or admin secrets belong in the public package or Cloudflare frontend environment.

The build copies only allowlisted assets from `public/`, optimized mission photos, generated canonical URLs/sitemap, security headers and the public API proxy. It excludes the private admin script, source camera photos and all files outside `public/`. A top-level 404 page prevents unknown/private paths falling back to the homepage. Google verification is served directly at its existing exact HTML path.

The build refuses stale output. For another local build, verify the absolute `.cloudflare-dist` path is inside this workspace and move that folder into ignored `.local/` first. Cloudflare builds should use a clean checkout.

## Render coordination and rollout

1. Review and deploy the backend compatibility changes. They are inert until configured; existing Render forms keep working.
2. Configure Render `PUBLIC_FRONTEND_URL` to the **exact** final Pages origin. Keep `PUBLIC_BASE_URL` pointing to the existing Render origin so private admin remains usable there. Keep `PUBLIC_FRONTEND_REDIRECT=false` during validation.
3. Publish the Pages project after owner approval. Check all five public pages, images/carousel, robots, sitemap, canonicals, Google verification and 404 responses. Confirm these static requests work without contacting Render.
4. Check public API responses, ordinary and school-specific checkout validation, Stripe success/cancel return origins and newsletter error handling. Use Stripe sandbox/test payments for end-to-end payment tests; never create a real charge as a smoke test. The live webhook URL remains `https://logan-missions.onrender.com/api/stripe-webhook`.
5. Test private administration on its original Render URL; public frontend origins must remain unable to log in or access private ledger endpoints.
6. Only after validation and owner approval, optionally set `PUBLIC_FRONTEND_REDIRECT=true` to send the old public page paths to the new canonical site. API/webhook/admin endpoints remain on Render.
7. Add and verify the new URL-prefix property in Google Search Console, submit its new sitemap, run a live crawl test and request homepage indexing once if eligible. Publishing does not establish that Google has indexed or ranked the site.

## Remaining service limits

Cloudflare static pages avoid Render cold starts. Donation/API requests still depend on the free Render backend and may wait while it wakes. Cloudflare Functions also have free-plan usage limits; static requests bypass Functions except for the exact verification path.

**The current free Render database still expires November 14, 2026 according to Render's email.** This frontend migration does not extend that deadline, preserve data after deletion or remove the need for a database decision. The owner previously chose to keep it. Do not upgrade or migrate it without authorization. Back up the private ledger before any database change.

Rollback: disable the optional Render public redirect and keep using the original Render website. Leave Stripe webhooks and private records unchanged. Do not delete the original service/database as part of this migration.

References: [Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [routing](https://developers.cloudflare.com/pages/functions/routing/), [pricing](https://developers.cloudflare.com/pages/functions/pricing/), [limits](https://developers.cloudflare.com/pages/platform/limits/), [Render free limits](https://render.com/docs/free).
