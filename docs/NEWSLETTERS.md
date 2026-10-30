# Newsletter workflow

The public website and Brevo campaign use the same content in `content/newsletters/<slug>.json`. No new hosting service, paid plan, database, admin login or public email credential is needed.

## Current first letter

**Learning to See Like Jesus**, October 2026, is a **draft**, with the requested seven sections and labeled text/photo placeholders. No ministry story or photo has been invented. The available `newsletter 1029/iCloud Photos` files were videos, so they have not been used as newsletter photographs.

The public `/newsletters` archive shows an honest empty state until a complete letter is published. Draft titles, pages and JSON are excluded from the public archive, sitemap and Cloudflare package. Drafts can be reviewed on localhost only; they are not private URLs on the public website.

The first Brevo campaign was created and read back successfully: **campaign ID 3**, name **Logan Missions | learning-to-see-like-jesus**, status **draft**, audience **list 4**, verified sender **ID 1 — Logan Missions, Ldoyle2006@icloud.com**. It has no schedule. No test or subscriber email has been sent by this implementation. The free account does not permit campaign tags; the tool uses the exact campaign name and private receipt for identification instead.

## One-time configuration

Keep secrets in `.env` or a private file passed with `--env`. Never put a key in a newsletter JSON, public asset, terminal argument, or Git commit.

```dotenv
BREVO_API_KEY=<existing private key>
BREVO_LIST_ID=4
NEWSLETTER_SENDER_ID=1
NEWSLETTER_PUBLIC_URL=https://logan-missions.pages.dev
NEWSLETTER_REPLY_TO=Logan.missions@icloud.com
NEWSLETTER_TEST_TO=Logan.missions@icloud.com
NEWSLETTER_MAILING_ADDRESS=
```

Run `npm run newsletter -- audit` to recheck the list and active sender. An October 29 audit found list 4 with 53 contacts; the saved website environment still named list 2, which was absent from that account's lists. Local private settings have been corrected to 4. **Before the production signup is declared fixed, verify Render's `BREVO_LIST_ID=4` setting and redeploy.** A local environment file is not automatically uploaded to Render. Contacts have not been imported, merged, resubscribed or added by this work. Confirm the intended recipients opted in before approving a send; list membership alone is not evidence of consent.

Confirm the public mailing/contact information required by your Brevo campaign settings before sending. The private home address supplied in chat has not been inserted into the template or public site.

## 1. Write the letter

Edit `content/newsletters/learning-to-see-like-jesus.json`, or start another draft:

```powershell
npm run newsletter -- new my-next-letter
```

Keep `status` as `draft` while writing. Fill in title, subtitle, description, subject, previewText and signature. The first draft's date is `2026-10`, which displays October 2026; when publishing, set the actual full publication date (`YYYY-MM-DD`). JSON text must use escaped quotes/newlines as appropriate. Plain paragraphs are text, never raw HTML.

Supported section blocks:

```json
{"heading":"Your section","blocks":[
  {"type":"paragraph","text":"Paste your own words here."},
  {"type":"quote","text":"Your chosen quotation or Bible verse.","reference":"Add the reference and translation"},
  {"type":"link","text":"Read more","href":"https://example.com/"},
  {"type":"prayers"}
]}
```

Put prayer items in the top-level `prayerRequests` array. Keep `supportLink: true` for the existing Giving link, or set it to false. `featured: true` selects a featured letter; if several are featured, the newest is selected. All published letters also appear in the archive. Previous/next links use published chronology.

## 2. Add your photographs

Keep originals outside `public/`, such as `.local/newsletter-originals/`. Import a JPEG or PNG (or another format supported by the installed Sharp build):

```powershell
npm run newsletter -- photo learning-to-see-like-jesus --file ".local/newsletter-originals/kona.jpg" --name kona-morning --alt "Your accurate description of the photograph" --caption "Your own caption"
```

This makes 480/960/1600px JPEG variants under `public/images/newsletters/<slug>/`, rotates according to camera orientation, removes embedded metadata, and prints an image block. Paste that block into the desired section. For `cover`, use the same object without the `type` property. For a two-column gallery use `{"type":"gallery","images":[<image object>,<image object>]}`. Portrait images retain their proportions; full-width photos fit the editorial column. Small originals are not enlarged. The website uses responsive `srcset`; email uses an absolute image URL. Never include private originals or video files in the public package.

Deploy the optimized photos before testing an email with actual images: an inbox cannot load your localhost images. Newsletter builds reject missing images, paths outside the newsletter image directory, and image files larger than 2 MB. HEIC support depends on the installed decoder; if needed, export photos from iCloud as JPEG first. MOV files must be exported as actual still photographs by the owner; the tool does not choose or invent stills from videos.

## 3. Preview website and full email

```powershell
npm run newsletter -- preview learning-to-see-like-jesus
```

Open `http://127.0.0.1:3011/` for the draft, `/archive` for the featured/archive preview, `/email` for the full email, and `/text` for plain text. `/mobile`, `/mobile-email` and `/mobile-archive` show 390px layout checks. These previews bind only to localhost, disable analytics, block form/API submissions and use noindex headers. Stop with Ctrl+C.

To generate files without starting a server:

```powershell
npm run newsletter -- export learning-to-see-like-jesus
```

The outputs are ignored private files in `.local/newsletters/<slug>/`: `web.html`, `archive.html`, `email.html`, `email.txt`. Preview/export never publishes or sends anything.

## 4. Publish the website version

Replace every placeholder, add your own photos/alt text and prayer requests, set the real date and change `status` to `published`. Then run:

```powershell
npm run newsletter -- build
npm test
```

The generator updates `public/newsletters.html`, individual `/newsletters/<slug>` pages and sitemap entries. Changing a letter back to `draft` removes only its generated public page on the next build. The frontend must be redeployed for public changes to take effect. Until that redeployment, the previously deployed version remains public.

The normal Render startup generates newsletter pages. Cloudflare's existing `npm run build:pages` generates them before packaging, uses its configured canonical origin, and preserves all existing public API forwarding and analytics consent. Cloudflare currently deploys `codex/cloudflare-public-site`; Render deploys `main`. Coordinate the same approved release to both branches. Existing project instructions require owner approval before pushing/deploying. Keep raw photos, `designs/`, contact CSVs, `.local/` and unrelated draft blog pages out of the release commit.

## 5. Create/update a Brevo draft

```powershell
npm run newsletter -- campaign-draft learning-to-see-like-jesus
```

For the current private production credentials, use `--env .local/newsletter.env`. This uses Brevo **email campaigns**, not transactional mail. It checks that list 4 exists and sender 1 is active, creates an unscheduled draft or updates only the matching unsent draft, and reads it back to verify status and audience. Private receipts live in `.local/newsletters/campaigns/`. Do not delete those receipts casually. If a write's outcome is uncertain, inspect Brevo before retrying; the tool checks the exact campaign name and fails rather than create duplicates when the result is ambiguous. Sent or scheduled campaigns are never updated by this tool.

The HTML contains the entire letter, inline styles, absolute photo links, preheader, website/share link and `{{ unsubscribe }}`. Brevo resolves the unsubscribe token for each recipient. It does not work as a literal link in a browser preview. The tool also exports `email.txt`; Brevo's campaign-create API does not expose a `textContent` field, so the file is not passed as an unsupported API field. Check the delivered multipart/plain-text version in your test inbox if required.

## 6. Send a test only to yourself

After checking `NEWSLETTER_TEST_TO`:

```powershell
npm run newsletter -- test learning-to-see-like-jesus --confirm-test
```

This calls only Brevo's campaign `sendTest` endpoint with a nonempty array containing exactly your configured address. An empty array is forbidden because Brevo treats it as its entire test list. The address may need to be added to Brevo's test recipients first. This action sends one real test email, so run it only when you intend that. Verify phone/desktop inbox rendering, images, reply-to, preheader, footer and unsubscribe handling. Browser layout checks do not guarantee every Outlook/Gmail/Apple Mail rendering detail.

## 7. Final review and approval

Inspect campaign 3 in Brevo. Verify final content, public web version, all photo URLs, sender, reply-to, intended opt-in recipients and footer information. **Do not send or schedule to list 4 without Logan's explicit approval of that campaign.** This tool deliberately has no mass-send or scheduling command. The owner can approve and send through Brevo after review.

## Verification performed

- 68 automated tests passed initially, including publication/draft isolation, stale-page cleanup, XSS/template escaping, previous/next navigation, owner-only test safety, campaign reuse and all existing donation/ledger/merchandise tests.
- HTTP integration test submits a consented signup through the real application route to a mocked Brevo contact endpoint, verifying list 4 and expected fields. No real contact was added and no real donation was made by the tests.
- Browser checks cover the actual draft and full email at desktop/mobile widths. Final test count and release status are recorded when verification completes.
- Actual Brevo draft ID 3 was created and read back as draft with list 4 and sender 1. No campaign was sent or scheduled. No test email was sent.

References: [Brevo campaign creation](https://developers.brevo.com/reference/create-email-campaign), [campaign test endpoint](https://developers.brevo.com/reference/send-test-email), [managed unsubscribe placeholder](https://help.brevo.com/hc/en-us/articles/209553645-Insert-a-custom-unsubscribe-link-in-your-emails).
