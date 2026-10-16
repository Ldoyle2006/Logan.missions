# School funding: implementation and setup

## What changed

- `public/giving.html`: $2,000 monthly support target. Expandable living/ministry ($1,420), financial responsibilities/savings ($400), and annual travel home ($85) categories; total expenses $1,905 plus $95 flexibility. Health insurance is labeled estimated. No progress bars or future school savings in this budget. Existing one-time, monthly, every-two-week, offline and external giving options are retained.
- `public/vision.html`, `public/schools.js`, `public/styles.css`: exactly three independent school cards, responsive layout, designated amount/email dialog and Stripe Checkout handoff. BCC: September 2027/$8,300; Word by Heart: Date TBD/$5,000; SBS: Date TBD/$10,000. Unknown starting balances remain explicitly unknown. A striped, empty indicator denotes unknown progress, not confirmed zero.
- `school-store.js`: durable PostgreSQL JSONB ledger, one partition per Stripe mode, with database row locks and atomic commits for donations, requests, notification outbox and administrative audit records.
- `school-funding.js`: validated designated checkout, authoritative Stripe reconciliation, fees/refunds, offline gifts, starting funds, corrections and savings allocation history.
- `school-notifications.js`: Brevo transactional email outbox with duplicate protection and bounded retries.
- `admin-auth.js`, `private/`, `public/school-admin.js`: password login, one-hour server sessions, HttpOnly/SameSite cookies, same-origin write checks, private admin forms and donation records.
- `server.js`: integration into the existing Node server and `/api/stripe-webhook`; public aggregate endpoint, protected admin APIs, background email and fee reconciliation. General Stripe and Fourthwall routes remain in place.
- `stripe-donations.js`: explicitly labels existing general gifts `purpose=general_support`.
- `public/privacy.html`: explains private school records and administration cookies.
- `.env.example`, `scripts/admin-password.js`, dependencies and tests: setup and verification support.

See [PAYMENT_SETUP_STATUS.md](PAYMENT_SETUP_STATUS.md) for the latest actual account setup and provider test results. The owner approved production publication and real donation collection after sandbox verification. Deployment checks are recorded privately in `.local/live-launch-checks.json` when completed. No live charge or real bank transfer is used for testing. The existing Render service and its URL were verified in the dashboard.

## Required configuration

Set secrets in local `.env` or the host's secret settings. Never place them in `public/` or commit `.env`.

| Variable | Required value / purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Canonical origin only, e.g. `http://localhost:3000` locally or your HTTPS production origin. School and admin POST requests must originate here. |
| `DATABASE_URL` | PostgreSQL connection URI. Use Render Postgres's internal URL for a Render service in the same private network. For an external provider use its verified TLS settings/CA; do not disable certificate validation. |
| `STRIPE_MODE` | `test` during setup. Test and live records are separate. |
| `STRIPE_SECRET_KEY` | Matching `sk_test_...` key initially. |
| `STRIPE_WEBHOOK_SECRET` | Matching `whsec_...` signing secret for this endpoint/mode. A Stripe CLI forwarding secret differs from a Dashboard endpoint secret. |
| `STRIPE_LIVE_MODE_APPROVED` | Existing general-support live safeguard. Leave `false` during development. |
| `SCHOOL_LIVE_PAYMENTS_APPROVED` | New independent safeguard. Leave `false` until provider test payments pass and Logan explicitly approves live school payments. General support is unaffected by this flag. |
| `SCHOOL_ADMIN_PASSWORD_HASH` | Generated scrypt salt/hash from `node scripts/admin-password.js`. Store the generated password privately in a password manager. The script outputs credentials only when you run it; do not paste that output into chat or Git. |
| `BREVO_API_KEY` | Existing Brevo API key with transactional-send capability in addition to newsletter access. |
| `SCHOOL_NOTIFICATION_FROM` | Sender email verified with Brevo. |
| `SCHOOL_NOTIFICATION_TO` | Your private notification email. No recipient is assumed or hardcoded. |

Local sandbox credentials remain available for development. Live Stripe credentials, the production webhook signing secret, the existing free database’s internal URL, admin hash and verified Brevo configuration have been saved in Render using **Save only**. The owner has since approved launch: both live approval flags are true in Render and the live webhook is enabled. Local development remains in test mode. Brevo reports all eight sandbox notices delivered. Missing configuration continues to fail closed.

## Database and hosting

Provision persistent PostgreSQL before enabling designated payments. The application automatically creates `school_fundraising_ledger` and initializes the selected mode on startup. The database role needs create-table permission on first startup and SELECT/INSERT/UPDATE thereafter. Use a dedicated application database/role and enable backups and point-in-time recovery where supported. Record retention and backup access should reflect the private financial data it contains.

The owner chose to keep the free database until close to its **November 13, 2026** expiration. Upgrade or migrate before then. Free Postgres has no managed backups. Run `npm run ledger:backup` locally with the verified external `DATABASE_URL` to export both test and live records into ignored `.local/ledger-backups/`. Save private snapshots regularly and before upgrades/migrations; these exports are manual, not scheduled or a managed backup service. They contain donor information and must stay private.

The application stores no production donation files on the web host's disk. A single small JSONB ledger per mode is intentional for this personal site: row-level locking serializes financial changes and removes cross-record partial commits. It is not designed for high transaction volume; a future migration to normalized tables can preserve the existing records. Full audit history is retained in PostgreSQL; the screen shows the latest 200 actions.

Use **one Node web instance**. An always-on instance is recommended for prompt notices; the owner explicitly chose to retain the free plan until close to November 13, 2026. Sessions and login rate limits are in process memory (restarts sign the admin out); multiple instances need a shared session/rate-limit store before use. PostgreSQL financial locking already protects concurrent writes. The 30-second notification worker and five-minute pending-fee reconciliation worker run in this process. A sleeping/free host delays these jobs; use an always-on service or add an authenticated scheduled worker before relying on prompt email delivery. Monitor webhook failures and outbox entries needing review.

Public `/api/schools` returns **only the live partition's aggregate amounts and school settings**, even during test checkout. With no live partition/starting balances, public progress is unknown. The admin shows the currently configured test or live partition, with an explicit mode label. Test settings and funds are never promoted to live. Goals/dates and starting amounts must be entered separately for live use; the live checkout gate can stay disabled while those are prepared.

## Stripe webhook setup

Endpoint: `https://YOUR-HOST/api/stripe-webhook` (or local Stripe CLI forwarding).

Keep all existing general-support subscriptions and add:

```text
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
charge.succeeded
charge.updated
charge.refunded
refund.created
refund.updated
refund.failed
```

The original `checkout.session.expired`, invoice and subscription events remain supported for general-support logging. Replays of the same or different events for a payment reconcile the same PaymentIntent record; they do not increment a counter. A checkout request is stored before the Stripe API call, with the expected school, USD amount, email and UUID. Stripe Session and PaymentIntent metadata contain `purpose=school`, `school_id`, `donation_id`, and the mode-specific integration marker. Reconciliation verifies those values against the server record.

Raw request signatures and event mode are checked before processing. The handler fetches current PaymentIntent/charge/refund data under the database lock, avoiding stale out-of-order events. Only `succeeded` payments with the expected received amount and a paid/captured charge count. Delayed, failed or cancelled attempts never add funds. A successful HTTP redirect has no accounting side effects. Database or provider failures return an error so Stripe can retry; inspect and redeliver failed events in Stripe after resolving configuration/outages.

Public amount raised = confirmed starting funds + confirmed gross gifts + documented signed corrections − successful refunds. Refunded gifts keep their original donation IDs. Failed/pending refunds do not reduce totals until confirmed. Refund enumeration paginates all results. Fees use USD Stripe balance transactions for the charge and successful refunds, including retained fees; unknown fees remain pending. Non-USD settlement fees are never silently treated as USD and require a USD settlement account or a future explicit currency-conversion workflow. Pending fees are revisited automatically; the admin also has **Reconcile with Stripe**. Refund a Stripe payment in Stripe, then let the webhook/reconcile update it; the admin's refund form is for verified offline refunds and never sends a refund API request.

Disputed charges currently stop reconciliation and require manual review; this implementation does not automate dispute accounting. Monitor disputes in Stripe and record an audited correction only after confirming the outcome. No automated bank transfers are implemented.

Reference behavior was checked against [Stripe webhook guidance](https://docs.stripe.com/webhooks) and [Stripe event types](https://docs.stripe.com/api/events/types).

## Private administration

Visit `/school-admin`. There is no public navigation link. The initial page is a login form; the administrative HTML is outside `public/` and only served after authentication. Every private API checks authentication. All writes require the exact configured origin and JSON, and responses are not cached. The admin has no analytics scripts. Login attempts are rate limited, sessions expire after an hour, and HTTPS uses a Secure `__Host-` cookie. Rotate the password hash and restart to revoke all existing sessions.

1. Select the school. Confirm the ledger mode before changing anything.
2. Enter starting funds **excluding gifts already recorded in this ledger**. Enter 0 only if that is a verified balance; leave untouched if unknown. Starting funds are treated as net cash with no new fee, and are initially pending allocation. If already saved, record a completed transfer with an explanatory note.
3. Update the school goal or date, with an audit reason.
4. Add verified offline gifts with gross amount, known fee, actual receipt date, external receipt ID and verification note. A repeated submission uses the same operation ID and cannot count twice; separately entered offline gifts still need human receipt reconciliation.
5. Record corrections as new signed entries rather than rewriting Stripe history. Use an audit note to connect corrections to their original records. Offline refunds have their own action.
6. Select a donation and record only the amount **actually moved** to savings. Negative transfer amounts reverse an erroneous recorded transfer or record money returned from savings. The ledger records the action; it does not move money. A refund after a transfer leaves a visible negative pending balance / reconciliation-needed status until resolved.

Amounts received, confirmed net funds, transfers completed, pending amounts, and gifts with unknown fees are displayed separately. Unknown-fee gifts are excluded from confirmed-net summaries rather than treated as fee-free. Individual transfer records include timestamps and notes. Administrative operation IDs prevent duplicate submission; audit records retain starting-fund/settings changes, offline gifts, refunds, corrections and completed transfer entries.

## Notifications

Confirmed school gifts enqueue a private Brevo email atomically with the donation record. It includes the school, gross amount, refunds, known fees/net or “pending confirmation”, donation date and savings reminder. Offline gifts entered by the admin also notify; starting balances and generic corrections do not generate new-donation notices. Later fee/refund reconciliation can generate a separate accounting-update notice. Test emails are prefixed `[TEST]`.

When email settings are absent, entries remain queued; they are not marked sent. Each job has a persistent UUID idempotency key, and its payload is frozen before the first attempt. Automatic retries are limited to ten minutes, within [Brevo's documented duplicate-protection window](https://developers.brevo.com/changelog/2021/11/10). Ambiguous older attempts become `needs_review`, avoiding a second email after the key expires. Review Brevo transactional logs and record the outcome in the admin. The application does not automatically resend these uncertain old jobs. “Sent” records Brevo API acceptance, not guaranteed inbox delivery. Check sender verification, delivery logs, spam and bounces during acceptance testing.

## Run and inspect locally

```text
npm install
npm start
```

Use `.env` with `PUBLIC_BASE_URL=http://localhost:3000` (or match your configured `PORT`). Visit `/giving.html`, `/vision.html#future-training`, and `/school-admin`. Database/payment credentials are not needed for static page preview; they are needed for designated checkout and administration. Do not overwrite your existing `.env`; add the missing variables from `.env.example`.

## Verification completed

`npm test`: **50 tests passing**, including existing general Stripe and Fourthwall tests. New tests cover all school designations, reusable school products and catalog pagination, checkout validation, private/public data separation, unknown starting balances, concurrent duplicate events, failed/cancelled/delayed payments, provider amount/mode mismatches, general-support exclusion, partial/full refunds, pending/foreign fees, starting funds, offline gifts, corrections, audit entries, transfer completion/reversal, outbox retries and login protection. An explicitly rejected first email attempt (such as an invalid key) stays queued for configuration repair; ambiguous delivery attempts retain their bounded retry/review behavior.

HTTP integration tests exercise actual routes, real Stripe test-signature verification, invalid signatures, wrong mode, missing database, admin login/logout, protected HTML/API access, cross-origin rejection, and Giving/Vision content. Embedded PostgreSQL (PGlite, development dependency only) verifies SQL transactions, rollback, persistent disk records across reopen, mode separation and duplicate processing after reopen. Restricted local runtime initially blocked loopback access and the embedded database; the full suite passed when run with the needed local execution permission.

The automated tests mock Stripe and email APIs. Subsequent actual provider testing confirmed sandbox gifts for BCC ($5), Word by Heart ($7), and SBS ($9), a declined payment followed by successful retry, partial and full BCC refunds, and duplicate-event protection. Hosted PostgreSQL connectivity and private administration were verified. Native browser checks confirmed designated checkout and the Vision cards at desktop and narrow window widths. Brevo subsequently confirmed delivery of all eight sandbox notices. Live credentials were verified, the four live products were created, and the production webhook was staged disabled. A full mobile-device pass and production deployment remain pending; see the current status document.

## Reusable fund catalog

`npm run stripe:catalog` prepares one reusable general-support Product and one Product for each school in the configured Stripe account/mode. It creates no payments or subscriptions. The website chooses the donor's amount and billing schedule dynamically at checkout, so separate manual Payment Links are not needed for each preset. Product and payment metadata retain the school identifiers; these labels do not create bank accounts or route payouts to separate savings accounts. Test and live catalogs remain separate. Saved local catalog IDs are in the ignored `.local/` folder.

For local test webhooks, run `npm run stripe:listen` in a separate terminal. It reads the test key from `.env`, forwards only the relevant sandbox events to the local webhook, and saves the listener's signing secret without printing it. Restart the site after a newly saved secret. A production webhook uses its own signing secret and a publicly reachable HTTPS URL.

## Required acceptance test before live money

1. Provision a test database, generate the admin password, configure Stripe test credentials, and configure Brevo's sender/recipient. Keep both live-approval flags false.
2. Forward Stripe sandbox webhooks to the running local server, or configure the HTTPS test endpoint. Save the matching signing secret; restart the server.
3. Sign in at `/school-admin`, confirm **TEST**, and set test starting funds to 0 for each school.
4. From each Vision card, choose a distinct test amount. Confirm the school name and amount in Stripe Checkout. Complete payments using Stripe's documented test payment methods; never enter a real card to test.
5. Verify each PaymentIntent's school metadata, the matching private donation record, amount, fee/net and one notification. Only that school's test ledger changes. Public live trackers must not change for test payments.
6. Exercise decline, cancellation, authentication and delayed payment cases. They must not count before verified success. Visiting a success URL manually must do nothing.
7. Resend the same webhook and a second event for the same PaymentIntent; restart and resend again. Verify one donation and no duplicate new-donation email.
8. Make partial and full test refunds in Stripe. Verify only successful refunds reduce the matching school total; verify fees and savings reconciliation after any previously recorded transfer.
9. Test offline gifts, duplicate form submission, a documented correction, goals/dates, starting balance updates, transfer completion and reversal. Verify the audit history.
10. Check actual Brevo delivery and accounting updates, and sign out to verify private APIs and records are inaccessible.
11. Inspect Giving/Vision at phone and desktop widths, expand budget categories, open/close each school dialog with keyboard controls, and exercise existing general giving options.
12. Only after these checks and Logan's approval: switch to production database/mode/key/webhook settings, enter verified live starting funds, review the owner’s decision to retain free hosting until close to the database’s November 13, 2026 expiration, arrange private ledger exports while managed backups are unavailable, and explicitly enable `SCHOOL_LIVE_PAYMENTS_APPROVED=true` alongside the existing live flag. Deploy only with approval.
