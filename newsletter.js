// Newsletter content is data, never executable HTML. Shared by website and email builders.
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const SITE_ORIGIN = "https://logan-missions.pages.dev";
export const escapeHtml = value => String(value ?? "").replace(/[&<>"'{}]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "{": "&#123;", "}": "&#125;" }[c]));
export function siteOrigin(value = SITE_ORIGIN) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use an HTTPS public site origin without a path.");
  return url.origin;
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validSlug(slug) { return typeof slug === "string" && slug.length <= 100 && slugPattern.test(slug); }
function text(value, field, max = 10000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Provide ${field} (up to ${max} characters).`);
}
export function imagePath(value) {
  if (typeof value !== "string" || !/^\/images\/newsletters\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(value)) throw new Error("Newsletter images must use optimized files in /images/newsletters/<slug>/.");
  return value;
}
export function linkUrl(value, origin = SITE_ORIGIN) {
  if (typeof value !== "string" || /[\s<>"'{}]/.test(value)) throw new Error("Invalid newsletter link.");
  const url = new URL(value, siteOrigin(origin));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Newsletter links must use HTTPS.");
  return url.href;
}
function validateImage(image, published) {
  if (!image || typeof image !== "object") throw new Error("Provide an image or a labeled draft placeholder.");
  if (image.placeholder) {
    text(image.placeholder, "photo placeholder", 500);
    if (published) throw new Error("Replace all photo placeholders before publication.");
    return;
  }
  imagePath(image.src); text(image.alt, "image alt text", 500);
  if (image.caption !== undefined && typeof image.caption !== "string") throw new Error("Image captions must be text.");
  if (![image.width, image.height].every(n => Number.isInteger(n) && n > 0 && n <= 12000)) throw new Error("Provide image width and height.");
  if (image.sources !== undefined && (!Array.isArray(image.sources) || image.sources.length > 6)) throw new Error("Invalid responsive image sources.");
  for (const source of image.sources || []) {
    imagePath(source.src);
    if (!Number.isInteger(source.width) || source.width < 1 || source.width > 12000) throw new Error("Invalid image source width.");
  }
}
export function validateNewsletter(item) {
  if (!item || item.schemaVersion !== 1 || !validSlug(item.slug)) throw new Error("Use schemaVersion 1 and a lowercase, hyphenated slug.");
  for (const field of ["title", "description", "subject", "previewText", "signature"]) text(item[field], field, field === "signature" ? 300 : 1000);
  if (item.subtitle !== undefined && typeof item.subtitle !== "string") throw new Error("Subtitle must be text.");
  if (!["draft", "published"].includes(item.status)) throw new Error("Status must be draft or published.");
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(item.date || "")) throw new Error("Date must be YYYY-MM or YYYY-MM-DD.");
  const parsedDate = new Date(`${item.date.length === 7 ? item.date + "-01" : item.date}T12:00:00Z`);
  if (!Number.isFinite(parsedDate.valueOf()) || !parsedDate.toISOString().startsWith(item.date)) throw new Error("Invalid calendar date.");
  const published = item.status === "published";
  if (published && item.date.length !== 10) throw new Error("Set the actual publication day (YYYY-MM-DD) before publishing.");
  if (!Array.isArray(item.introduction) || !item.introduction.length || !Array.isArray(item.sections) || !item.sections.length || item.sections.length > 50) throw new Error("Provide an introduction and newsletter sections.");
  if (!Array.isArray(item.prayerRequests) || item.prayerRequests.length > 50 || item.prayerRequests.some(p => typeof p !== "string" || !p.trim() || p.length > 2000)) throw new Error("Prayer requests must be a list of text items.");
  validateImage(item.cover, published);
  function blocks(values) {
    if (!Array.isArray(values) || !values.length || values.length > 100) throw new Error("Each section needs content blocks.");
    for (const block of values) {
      if (!block || typeof block !== "object") throw new Error("Invalid content block.");
      switch (block.type) {
        case "paragraph": text(block.text, "paragraph"); break;
        case "quote": text(block.text, "quotation"); if (block.reference !== undefined) text(block.reference, "quotation reference", 300); break;
        case "placeholder": text(block.text, "placeholder"); if (published) throw new Error("Replace all text placeholders before publication."); break;
        case "image": validateImage(block, published); break;
        case "gallery":
          if (!Array.isArray(block.images) || block.images.length < 2 || block.images.length > 12) throw new Error("Galleries need 2–12 images.");
          block.images.forEach(image => validateImage(image, published)); break;
        case "prayers": if (published && !item.prayerRequests.length) throw new Error("Add your prayer requests before publishing."); break;
        case "link": text(block.text, "link label", 500); linkUrl(block.href); break;
        default: throw new Error(`Unsupported block type: ${block.type}`);
      }
    }
  }
  blocks(item.introduction);
  for (const section of item.sections) { text(section.heading, "section heading", 300); blocks(section.blocks); }
  return item;
}
export async function loadNewsletters(root) {
  const directory = path.join(root, "content", "newsletters");
  const items = [];
  for (const name of (await readdir(directory)).filter(n => n.endsWith(".json"))) {
    const item = validateNewsletter(JSON.parse(await readFile(path.join(directory, name), "utf8")));
    await validatePhotoAssets(root, item);
    if (name !== `${item.slug}.json`) throw new Error("Newsletter filename must match its slug.");
    if (items.some(other => other.slug === item.slug)) throw new Error("Duplicate newsletter slug.");
    items.push(item);
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
export async function validatePhotoAssets(root, item) {
  const photos = [item.cover, ...item.introduction, ...item.sections.flatMap(s => s.blocks)].flatMap(block => block.type === "gallery" ? block.images : block.src || block.placeholder ? [block] : []);
  for (const photo of photos) {
    if (!photo.src) continue;
    for (const src of new Set([photo.src, ...(photo.sources || []).map(s => s.src)])) {
      const target = path.resolve(root, "public", `.${imagePath(src)}`);
      const actual = await realpath(target);
      const allowed = await realpath(path.join(root, "public", "images", "newsletters"));
      if (!actual.startsWith(allowed + path.sep)) throw new Error("Newsletter photo resolves outside its public image folder.");
      const info = await stat(actual);
      if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error("Newsletter photos must be optimized image files below 2 MB.");
    }
  }
}
export function dateLabel(item) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", ...(item.date.length === 10 ? { day: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${item.date.length === 7 ? item.date + "-01" : item.date}T12:00:00Z`));
}
export const newsletterPath = item => `/newsletters/${item.slug}`;
export function hasPlaceholders(item) { return JSON.stringify(item).includes('"placeholder"') || item.sections.some(s => s.blocks.some(b => b.type === "prayers")) && !item.prayerRequests.length; }
export function renderPhoto(image, { origin = SITE_ORIGIN, email = false, hero = false } = {}) {
  const e = escapeHtml;
  if (image.placeholder) return email
    ? `<div style="padding:44px 20px;background-color:#e7e2d4;border:1px dashed #6b766b;color:#364b3e;text-align:center;font:16px/1.6 Arial,sans-serif;">PHOTO PLACEHOLDER<br>${e(image.placeholder)}</div>`
    : `<div class="letter-photo-placeholder" role="img" aria-label="${e(image.placeholder)}"><span>PHOTO PLACEHOLDER</span><p>${e(image.placeholder)}</p></div>`;
  const src = email ? new URL(image.src, siteOrigin(origin)).href : image.src;
  const caption = image.caption ? (email ? `<p style="margin:10px 0 24px;color:#56675c;font:italic 14px/1.6 Georgia,serif;">${e(image.caption)}</p>` : `<figcaption>${e(image.caption)}</figcaption>`) : "";
  const img = `<img src="${e(src)}" alt="${e(image.alt)}" width="${email ? 624 : image.width}"${email ? '' : ` height="${image.height}"`}${!email && image.sources?.length ? ` srcset="${image.sources.map(s => `${e(s.src)} ${s.width}w`).join(", ")}" sizes="(max-width: 700px) 100vw, 960px"` : ""} ${email ? 'style="display:block;border:0;width:100%;max-width:624px;height:auto;"' : `loading="${hero ? "eager" : "lazy"}" decoding="async"`} />`;
  return email ? `${img}${caption}` : `<figure class="letter-photo${image.width < image.height ? " letter-photo-portrait" : ""}">${img}${caption}</figure>`;
}
export function renderBlocks(blocks, item, { origin = SITE_ORIGIN, email = false } = {}) {
  const e = escapeHtml;
  const p = text => `<p${email ? ' style="margin:0 0 22px;font:17px/1.8 Georgia,serif;color:#24352d;"' : ""}>${e(text).replace(/\n/g, "<br>")}</p>`;
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph": return p(block.text);
      case "placeholder": return email ? `<div style="margin:16px 0;padding:18px;border:1px dashed #6b766b;background-color:#f0ecdf;color:#364b3e;font:15px/1.6 Arial,sans-serif;"><strong>TEXT PLACEHOLDER</strong><br>${e(block.text)}</div>` : `<div class="letter-text-placeholder"><strong>TEXT PLACEHOLDER</strong><p>${e(block.text)}</p></div>`;
      case "quote": return `<blockquote${email ? ' style="margin:28px 0;padding:18px 24px;border-left:3px solid #d8755b;background-color:#eee8d9;font:italic 22px/1.6 Georgia,serif;color:#314d40;"' : ""}>${e(block.text)}${block.reference ? `<cite${email ? ' style="display:block;margin-top:12px;font:13px/1.5 Arial,sans-serif;"' : ""}>${e(block.reference)}</cite>` : ""}</blockquote>`;
      case "image": return renderPhoto(block, { origin, email });
      case "gallery": return email
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${block.images.filter((_,index) => index % 2 === 0).map((_, row) => `<tr>${block.images.slice(row * 2, row * 2 + 2).map(img => `<td class="photo-cell" valign="top" width="50%" style="padding:6px;">${renderPhoto(img, { origin, email })}</td>`).join("")}</tr>`).join("")}</table>`
        : `<div class="letter-gallery">${block.images.map(img => renderPhoto(img, { origin })).join("")}</div>`;
      case "prayers": return item.prayerRequests.length ? `<ul${email ? ' style="padding-left:24px;font:17px/1.8 Georgia,serif;color:#24352d;"' : ' class="letter-prayers"'}>${item.prayerRequests.map(request => `<li>${e(request)}</li>`).join("")}</ul>` : p("PRAYER REQUEST PLACEHOLDER — add your own prayer requests.");
      case "link": return `<p><a href="${e(linkUrl(block.href, origin))}"${email ? ' style="color:#314d40;font:17px/1.8 Georgia,serif;text-decoration:underline;"' : ""}>${e(block.text)}</a></p>`;
    }
  }).join("\n");
}
export function renderLetterContent(item, options = {}) {
  return renderBlocks(item.introduction, item, options) + item.sections.map(section => `<section${options.email ? '' : ' class="letter-section"'}><h2${options.email ? ' style="margin:36px 0 18px;font:bold 27px/1.3 Georgia,serif;color:#314d40;"' : ""}>${escapeHtml(section.heading)}</h2>${renderBlocks(section.blocks, item, options)}</section>`).join("\n");
}

export function subscriptionSection() {
  return `<section class="letter-subscribe" id="subscribe" data-clarity-mask aria-labelledby="letter-subscribe-title"><p class="eyebrow">LETTERS FROM THE JOURNEY</p><h2 id="letter-subscribe-title">Get the next letter.</h2><p>Occasional updates and ways to pray alongside me.</p><form id="signup-form"><div class="form-row"><label class="visually-hidden" for="first-name">First name (optional)</label><input id="first-name" name="firstName" type="text" autocomplete="given-name" maxlength="80" placeholder="First name (optional)"><label class="visually-hidden" for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="Your email address" required><button class="button button-coral" type="submit">Sign me up</button></div><div class="consent-row"><input id="consent" name="consent" type="checkbox" required><label for="consent">I agree to receive occasional email updates. I can unsubscribe at any time.</label></div><div class="honeypot" aria-hidden="true"><label for="website">Leave this field empty</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></div><p class="form-message" id="form-message" role="status" aria-live="polite"></p></form><p class="privacy-note">Your address is used only for these updates. <a href="/privacy.html">Read the privacy note</a>.</p></section>`;
}
export async function websiteShell(root, title, description, pathname, content, { origin = SITE_ORIGIN, preview = false } = {}) {
  const existing = await readFile(path.join(root, "public", "privacy.html"), "utf8");
  let header = existing.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
  const footer = existing.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error("Existing website header/footer could not be found.");
  header = header.replace(' aria-current="page"', "");
  if (!header.includes('href="/newsletters"')) header = header.replace('<a href="/#updates">Updates</a>', '<a href="/#updates">Updates</a>\n          <a href="/newsletters">Newsletters</a>');
  header = header.replace('href="/newsletters"', 'href="/newsletters" aria-current="page"');
  return `<!-- GENERATED_NEWSLETTER -->\n<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Logan Missions</title><meta name="description" content="${escapeHtml(description)}">${preview ? '<meta name="robots" content="noindex,nofollow">' : ""}<link rel="canonical" href="${escapeHtml(siteOrigin(origin) + pathname)}"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/newsletters.css">${preview ? "" : '<script src="/analytics-consent.js" defer></script><script src="/newsletter-signup.js" type="module"></script>'}</head><body><a class="skip-link" href="#main">Skip to content</a>${header}<main id="main" class="letters-page">${content}</main>${footer}</body></html>`;
}
export async function renderNewsletterPage(root, item, published, options = {}) {
  validateNewsletter(item);
  const e = escapeHtml, index = published.findIndex(other => other.slug === item.slug);
  const next = index > 0 ? published[index - 1] : null, previous = index >= 0 ? published[index + 1] : null;
  const draftNotice = item.status === "draft" ? '<aside class="letter-draft-banner"><strong>PRIVATE DRAFT — NOT PUBLISHED</strong><p>Text and photo placeholders are for your review. No newsletter has been sent.</p></aside>' : "";
  const content = `${draftNotice}<header class="letter-heading section-wrap"><a class="text-link" href="/newsletters">← All newsletters</a><p class="eyebrow">LETTERS FROM THE JOURNEY</p><h1>${e(item.title)}</h1><time datetime="${e(item.date)}">${e(dateLabel(item))}</time>${item.subtitle ? `<p class="letter-subtitle">${e(item.subtitle)}</p>` : ""}</header><div class="letter-cover section-wrap">${renderPhoto(item.cover, { ...options, hero: true })}</div><article class="letter-paper"><div class="letter-body">${renderLetterContent(item, options)}${item.supportLink ? '<p class="letter-support"><a href="/giving.html">Partner with the ministry →</a></p>' : ""}<p class="letter-signature">${e(item.signature)}</p><p class="letter-share"><a href="${e((options.origin || SITE_ORIGIN) + newsletterPath(item))}">Share this newsletter</a></p><nav class="letter-pagination" aria-label="More newsletters">${previous ? `<a href="${newsletterPath(previous)}">← ${e(previous.title)}</a>` : ""}${next ? `<a href="${newsletterPath(next)}">${e(next.title)} →</a>` : ""}</nav></div></article><div class="section-wrap">${subscriptionSection()}</div>`;
  return websiteShell(root, item.title, item.description, newsletterPath(item), content, { ...options, preview: item.status === "draft" || options.preview });
}
export async function renderArchive(root, published, options = {}) {
  const e = escapeHtml;
  const featured = published.find(item => item.featured) || published[0];
  const card = (item, large = false) => `<article class="letter-card${large ? " letter-featured" : ""}"><a class="letter-card-photo" href="${newsletterPath(item)}" aria-label="Read ${e(item.title)}">${renderPhoto(item.cover, { hero: large })}</a><div class="letter-card-copy"><p class="eyebrow">${large ? "LATEST LETTER" : "FIELD NOTES"}</p><time datetime="${e(item.date)}">${e(dateLabel(item))}</time><h2><a href="${newsletterPath(item)}">${e(item.title)}</a></h2><p>${e(item.description)}</p><a class="button button-coral" href="${newsletterPath(item)}">Read Newsletter</a></div></article>`;
  const content = `<div class="section-wrap"><header class="letter-archive-heading"><p class="eyebrow">LETTERS FROM THE JOURNEY</p><h1>Newsletters</h1><p>Updates, prayer requests, and glimpses of life in missions.</p></header>${featured ? card(featured, true) : '<section class="letter-empty"><h2>A letter is on its way.</h2><p>The first newsletter is being prepared. Subscribe below and I’ll send it to you when it’s ready.</p></section>'}${published.length ? `<section class="letter-archive" aria-labelledby="archive-title"><h2 id="archive-title">All letters</h2><div class="letter-card-grid">${published.map(item => card(item)).join("")}</div></section>` : ""}${subscriptionSection()}</div>`;
  return websiteShell(root, "Newsletters", "Read Logan Doyle’s missionary newsletters, browse past updates, and subscribe for prayer requests and stories from the journey.", "/newsletters", content, options);
}
export function renderEmail(item, { origin = SITE_ORIGIN, senderName = "Logan Missions", mailingAddress = "" } = {}) {
  validateNewsletter(item); origin = siteOrigin(origin);
  const e = escapeHtml, webUrl = origin + newsletterPath(item);
  const notice = item.status === "draft" || hasPlaceholders(item) ? '<p style="padding:16px;border:2px dashed #d8755b;font:14px/1.5 Arial,sans-serif;color:#20372d;">DRAFT CONTENT — FOR REVIEW ONLY. Replace all text and photo placeholders before sending to supporters. The website version is not yet published.</p>' : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(item.title)}</title><style>@media only screen and (max-width:600px){.email-pad{padding:24px 20px!important}.photo-cell{display:block!important;width:100%!important;box-sizing:border-box!important}.email-title{font-size:34px!important}}</style></head><body style="margin:0;padding:0;background-color:#20372d;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${e(item.previewText)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#20372d;"><tr><td align="center" style="padding:24px 8px;"><!--[if mso]><table role="presentation" width="680"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background-color:#f5efe0;"><tr><td class="email-pad" style="padding:36px 28px;background-color:#314d40;color:#f5efe0;"><p style="margin:0 0 18px;font:12px/1.4 Arial,sans-serif;letter-spacing:3px;">LOGAN DOYLE · MISSION UPDATES</p><p style="margin:0;font:14px/1.5 Arial,sans-serif;">${e(dateLabel(item))}</p><h1 class="email-title" style="margin:16px 0;font:normal 42px/1.15 Georgia,serif;">${e(item.title)}</h1><p style="margin:0;font:17px/1.7 Georgia,serif;">${e(item.subtitle || item.description)}</p></td></tr><tr><td class="email-pad" style="padding:28px;">${notice}${renderPhoto(item.cover, { origin, email: true, hero: true })}<div style="padding-top:24px;">${renderLetterContent(item, { origin, email: true })}</div>${item.supportLink ? `<p style="margin:30px 0;"><a href="${origin}/giving" style="display:inline-block;padding:14px 22px;background-color:#d8755b;color:#ffffff;text-decoration:none;font:bold 15px/1.4 Arial,sans-serif;">Partner with the ministry</a></p>` : ""}<p style="margin:32px 0;font:italic 26px/1.5 Georgia,serif;color:#314d40;">${e(item.signature)}</p></td></tr><tr><td class="email-pad" style="padding:28px;border-top:1px solid #c5c7b7;color:#405748;font:13px/1.8 Arial,sans-serif;"><p><a href="${webUrl}" style="color:#314d40;">Read on the website / share this letter</a><br><a href="${origin}/newsletters#subscribe" style="color:#314d40;">Subscribe to future letters</a></p><p>You are receiving missionary updates from ${e(senderName)}.</p>${mailingAddress ? `<p>${e(mailingAddress)}</p>` : ""}<p><a href="{{ unsubscribe }}" style="color:#314d40;text-decoration:underline;">Unsubscribe from missionary updates</a></p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
export function renderPlainText(item, { origin = SITE_ORIGIN } = {}) {
  const render = block => {
    if (["paragraph", "placeholder"].includes(block.type)) return (block.type === "placeholder" ? "TEXT PLACEHOLDER: " : "") + block.text;
    if (block.type === "quote") return `${block.text}${block.reference ? "\n— " + block.reference : ""}`;
    if (block.type === "link") return `${block.text}: ${linkUrl(block.href, origin)}`;
    if (block.type === "prayers") return item.prayerRequests.length ? item.prayerRequests.map(p => `• ${p}`).join("\n") : "PRAYER REQUEST PLACEHOLDER";
    const photo = image => image.placeholder ? `PHOTO PLACEHOLDER: ${image.placeholder}` : `${image.caption || image.alt}\n${new URL(image.src, origin).href}`;
    return block.type === "gallery" ? block.images.map(photo).join("\n\n") : photo(block);
  };
  return [item.status === "draft" ? "DRAFT CONTENT — FOR REVIEW ONLY" : "", item.title, dateLabel(item), item.subtitle || "", ...item.introduction.map(render), ...item.sections.flatMap(s => [s.heading, ...s.blocks.map(render)]), item.signature, `Read/share: ${origin + newsletterPath(item)}`, `Subscribe: ${origin}/newsletters#subscribe`, ...(item.supportLink ? [`Support: ${origin}/giving`] : []), "Unsubscribe: {{ unsubscribe }}"].filter(Boolean).join("\n\n") + "\n";
}
