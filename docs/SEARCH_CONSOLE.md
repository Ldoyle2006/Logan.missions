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

Google accepted the five-page sitemap with Success on October 15. The subsequent manual homepage request was refused because Google's daily quota was exhausted. Do not repeat it today. Indexing and crawling remain Google's decisions, and free-host sleep limitations still apply.

References: [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [request crawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Render free hosting limits](https://render.com/docs/free).
