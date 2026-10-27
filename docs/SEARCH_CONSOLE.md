# Google Search Console setup — October 15, 2026

Canonical website: https://logan-missions.onrender.com/

## Initial findings

- Existing Search Console property is accessible and the public Google HTML verification file returns HTTP 200. Keep that file in place.
- The homepage's Google index report says URL is unknown to Google, with no referring sitemap or referring page detected.
- The existing October 14 live test says the homepage is available to Google and can be indexed. This is not proof it has been indexed.
- The deployed robots.txt and sitemap.xml initially returned HTTP 404. Public pages have descriptive titles and descriptions, but no explicit canonical links.

## Prepared changes

- Root XML sitemap lists the homepage, Vision, Giving, Shop and Privacy pages, using full canonical HTTPS addresses. No admin, API, checkout, success/cancel query or verification URLs are included.
- Root robots.txt allows crawling and points to the sitemap. Private administration still requires authentication and sends X-Robots-Tag: noindex, nofollow; robots.txt is not access control.
- All five public pages declare their preferred canonical URL. This also identifies the preferred homepage over /index.html and clean page addresses over donation return parameters.
- The server sends text/plain for robots.txt and application/xml for sitemap.xml.

## Hosting limitation

The owner explicitly chose to retain the free Render plans. Render's free web service sleeps after 15 idle minutes. While asleep, Render itself returns a disallow-all robots.txt response before the application runs; adding an allow rule to this repository cannot override that response. This can interfere with crawling even when a live test succeeds while the app is awake. No paid upgrade, background keep-alive service or hosting migration is authorized by this SEO task.

## Publication and submission

The owner explicitly approved publishing and Google submission on October 15, 2026. All 50 automated checks passed, including live HTTP serving of sitemap/robots files, canonical links and private-page noindex protection. Verify the deployed sitemap, robots file and canonical links; then submit sitemap.xml in the existing property's Sitemaps report. Request indexing of the canonical homepage once. If Google requests a CAPTCHA or sign-in, the owner must complete it. Do not repeatedly submit requests or promise a specific ranking/date.

Private runtime notes and submission receipts, when available, are kept in the ignored .local/ directory. Search Console's indexed status and sitemap reports may take time to update.

## Identity metadata without visible changes

The owner clarified that visible content and design must stay unchanged. The homepage now includes a non-executable JSON-LD data block identifying the existing site name, Logan Doyle, his YWAM affiliation, and the Instagram/Facebook profiles already linked publicly. The body markup, page title, visible wording, styles, forms and links are preserved. No social profiles are edited or contacted. This describes the site's existing identity; it does not assign search keywords or guarantee a ranking.

Google accepted the five-page sitemap with Success on October 15. The subsequent manual homepage request was refused because Google's daily quota was exhausted on October 15. That historical quota response does not establish the quota status on later days. Indexing and crawling remain Google's decisions, and free-host sleep limitations still apply.

## Follow-up audit — October 25, 2026

The owner again requested visibility for searches related to Logan and missions. Continue honoring the existing preference to keep visible website wording/design unchanged and retain free hosting. Target phrases for assessment are Logan Doyle missions, Logan missions, and Logan YWAM; these are search goals rather than ranking promises.

Direct live checks confirmed HTTP 200 for all five canonical public pages, sitemap.xml, robots.txt, and the existing Google verification file. Public pages had no noindex response header or meta directive. The homepage title still identifies Logan Doyle and YWAM, and its existing Person/WebSite identity data is present. Both the initial and final robots responses allowed crawling during this audit. Detailed results are private in `.local/seo-audit-2026-10-25.json`.

Public web searches did not surface the website in the returned results. This is not authoritative proof of its Google indexing status. Search Console's current URL Inspection and Page indexing report are needed to distinguish indexing from query ranking. The Windows browser automation connection was unavailable, so no current Search Console report was read, sitemap resubmitted, or indexing request completed. The owner was asked for the exact homepage Page indexing status.

Next diagnostic steps:

1. Inspect `https://logan-missions.onrender.com/` in the existing Search Console property. Record its exact Page indexing status, last crawl time, Google-selected canonical, and referring sitemap.
2. If blocked, compare the recorded Google crawl time/reason with the live test. Render documents that sleeping free web services return a platform-level disallow-all robots response; today's allowed response does not rule out that intermittent limitation.
3. If not indexed, run a live test and request homepage indexing once when eligible. Confirm sitemap status; resubmit only if the report indicates a problem or absence. Respect Google's response and quota rather than repeatedly requesting the same URL.
4. If indexed, inspect Performance queries/impressions for the target phrases before making relevance changes. Existing on-page identity already includes Logan Doyle and YWAM. Do not add hidden keyword stuffing, promise rankings, or change visible wording without a new owner instruction.

No website source changes, paid upgrades, hosting migration, social-profile edits, or scheduled keep-alive requests were made in this follow-up audit. Code-level additions to robots.txt cannot override Render's sleeping-service response.

References: [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [request crawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Render free hosting limits](https://render.com/docs/free).


## Confirmed Google crawl blocker — October 26, 2026

Desktop control became available and the existing Search Console property was inspected directly. The Page indexing report (last updated October 22) showed five known pages, zero indexed, all Discovered - currently not indexed. The homepage URL Inspection report recognized sitemap.xml and had no recorded crawl.

A fresh Google live test on October 26 at 1:35 PM (Search Console display) failed with URL is not available to Google / Page cannot be crawled: Blocked by robots.txt. The indexing-request control was disabled. No new indexing request was submitted.

Direct HTTP verification immediately afterward captured the sleeping service response: `User-agent: *` with `Disallow: /`. Fetching the homepage woke the application; its subsequent robots response changed to `Allow: /` and the existing sitemap URL. This confirms the platform-level sleeping-service robots response is a real active crawl blocker, not merely a hypothetical risk or missing metadata. Private evidence is in `.local/search-console-audit-2026-10-26.json` and `.local/google-indexing-block-2026-10-26.png`.

The owner was asked to choose between a free static public site at a new URL, a paid always-on Render service preserving the current URL, or retaining the current limitation. Instead of selecting yet, the owner asked about faster free hosting and popular inexpensive alternatives. No paid upgrade, frontend migration, new account, index submission, or visible website edit has been performed. Existing preferences to preserve the visible design and avoid charges remain in effect.

Potential free frontend options: Render Static Sites or Cloudflare Pages, with the existing payment/newsletter backend retained and routing/security/return URLs tested before cutover. A frontend-only move does not remove backend cold starts or the existing database expiry. The new public URL/canonical and Search Console property must be coordinated; do not imply the existing onrender hostname automatically follows a different host.
