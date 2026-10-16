# Payment setup status — October 15, 2026

## Agreed live arrangement

Use the existing **Logan Missions** Stripe account. There is no need for four Stripe accounts. Organize donations with four reusable Products and payment metadata:

| Fund | Identifier | Giving schedules |
| --- | --- | --- |
| Mission support for Logan Doyle | `general_support` | One-time, monthly, every two weeks |
| Bible Core Course on Location | `bcc` | One-time initially |
| Word by Heart | `word_by_heart` | One-time initially |
| School of Biblical Studies | `sbs` | One-time initially |

The school products are the practical catalog grouping requested as “folders.” The website's private ledger provides school balances and savings allocations. Products/designations do not create separate Stripe balances or automatically move funds to separate bank savings accounts.

For general support, a donor's selected amount is charged once, once per calendar month, or every 14 days (26 times per year), depending on the selected schedule. Recurring gifts continue until cancelled. The website already creates the appropriate Stripe Checkout payment/subscription; no separate manual Payment Link is needed for every amount.

## Completed

- Existing sandbox selected and connected with its test key. Account currency is USD.
- Official Stripe CLI installed as a development dependency; `npm run stripe:listen` forwards local test webhooks and privately saves the signing secret.
- Free Render PostgreSQL database `logan-school-test` created in Oregon and connected with verified TLS. It expires **November 13, 2026**. The owner explicitly chose to retain the free plan until close to that date; do not purchase an upgrade now. Upgrade or migrate before expiration to keep the ledger accessible.
- Private admin configured. Its generated local password is in the ignored `.local/admin-login.txt` file.
- Sandbox catalog prepared: general support plus three reusable school products. Catalog identifiers are in ignored `.local/stripe-catalog-test.json`.
- All **50 automated tests pass** after the reusable-product and email configuration-recovery changes.
- Actual sandbox payment records: BCC $5, Word by Heart $7, SBS $9. All three were assigned to the correct school. BCC has been fully refunded using one $2 refund plus the remaining $3.
- A declined Word by Heart attempt added no funds; successful retry recorded its gift.
- A confirmed test event was replayed three times without extra donation records or notification jobs.
- Known sandbox fees/net: initial BCC $0.45/$4.55; Word by Heart $0.50/$6.50; SBS $0.56/$8.44. These are observed test results, not a fee quote for future gifts.
- A simulated BCC savings allocation was entered with an explicit sandbox-only note. Refunds correctly marked it for reconciliation; no real bank transfer occurred.
- Actual general-support checkout creation verified one-time payment, monthly subscription, and two-week subscription schedules. Those unpaid test sessions were expired.
- Public live balances stay unknown until verified live starting amounts are entered; sandbox payments do not change them.
- Existing Brevo sender `Ldoyle2006@icloud.com` is marked Verified. Notification destination confirmed by the owner: `Logan.missions@icloud.com`. Both are saved locally.
- Live Stripe credentials verified: card payments and payouts are enabled. No legal, identity, banking or agreement information was submitted on the owner’s behalf.
- Live catalog prepared: general support, BCC, Word by Heart and SBS. Identifiers are saved privately in `.local/stripe-catalog-live.json`.
- Production snapshot webhook registered with 19 required payment/refund/subscription events and API version `2026-09-30.endive`. The endpoint is **enabled** for the owner-approved production launch. Its signing secret is stored only in ignored private configuration.
- New Brevo key verified and installed locally. All eight queued sandbox donation/accounting notices were accepted with HTTP 201, and Brevo activity reports confirmed **delivered** for all eight to `Logan.missions@icloud.com`. This confirms provider delivery, not inbox placement.
- Separate live database partition initialized with zero donation records and unconfirmed starting balances. Sandbox records were not copied.
- Production configuration saved in Render using **Save only**, with no deployment. The updated Brevo/Stripe keys, webhook signing secret, database internal URL and private admin configuration are present. Existing newsletter list and publishable-key settings were retained. Both live approval flags are now true in Render following explicit launch approval; local development stays in test mode.
- `npm run ledger:backup` provides a private local snapshot of both complete ledger partitions. It does not schedule automatic backups.

## Owner handoff and remaining work

The owner asked to complete legal identity, banking and agreement steps personally. Do not fill or submit them on the owner's behalf. The owner can hand technical work back after review.

1. Retain the current free Render web and PostgreSQL plans, as explicitly requested on October 15. No paid upgrade is authorized. Upgrade or migrate the database shortly before **November 13, 2026**; expiration makes it inaccessible. Render's free database has no managed backups. Keep private exports while using it for donation records.
2. Free web hosting sleeps after 15 minutes idle and can take about a minute to wake. Webhook processing and background notices can be delayed; signed webhook retries and the durable outbox protect normal redelivery. This is not an always-on delivery guarantee. The owner chose to defer hosting upgrades.
3. The owner explicitly approved pushing, deploying and enabling real donations on October 15. The webhook is enabled and both Render live approval flags are true. These settings take effect in the web service after deployment.
4. Enter verified live starting amounts in the private admin when known; leave unknown rather than assuming zero.
5. Verify the deployed commit, all six unpaid checkout flows, private-admin access and signed webhook handling. Never use a real card to test. The private `.local/live-launch-checks.json` file records the launch verification result when available.

Provider references: [Render free-instance limits](https://render.com/docs/free), [Brevo transactional activity](https://developers.brevo.com/reference/get-email-event-report).

Deployment was approved after staging. Verify release status in Render and the private launch-check record; a saved configuration alone does not confirm a successful deployment. No live payment, real refund or bank transfer was used for testing. No paid upgrades were purchased.
