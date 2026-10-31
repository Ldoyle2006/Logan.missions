import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { buildNewsletters } from "../newsletter-build.js";
import { loadNewsletters, renderNewsletterPage, renderArchive, renderEmail, renderPlainText, validSlug, SITE_ORIGIN, siteOrigin } from "../newsletter.js";
import { createBrevoClient, saveCampaignDraft, sendOwnerTest } from "../newsletter-brevo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), command = args[0];
const option = name => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1]; };
const slug = args[1]?.startsWith("--") ? undefined : args[1];
const envPath = path.resolve(root, option("env") || ".env");
let fileEnv = {};
try { fileEnv = parseEnv(await readFile(envPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const env = { ...fileEnv, ...process.env };
const origin = siteOrigin(env.NEWSLETTER_PUBLIC_URL || env.PUBLIC_FRONTEND_URL || SITE_ORIGIN);
const local = path.join(root, ".local", "newsletters");
const receiptPath = name => path.join(local, "campaigns", `${name}.json`);
async function getReceipt(name) { try { return JSON.parse(await readFile(receiptPath(name), "utf8")); } catch (error) { if (error.code === "ENOENT") return undefined; throw error; } }
async function exportPreview(item) {
  const directory = path.join(local, item.slug); await mkdir(directory, { recursive: true });
  const published = (await loadNewsletters(root)).filter(item => item.status === "published");
  await writeFile(path.join(directory, "web.html"), await renderNewsletterPage(root, item, published, { origin, preview: true }));
  await writeFile(path.join(directory, "email.html"), renderEmail(item, { origin, mailingAddress: env.NEWSLETTER_MAILING_ADDRESS }));
  await writeFile(path.join(directory, "email.txt"), renderPlainText(item, { origin }));
  await writeFile(path.join(directory, "archive.html"), await renderArchive(root, [item, ...published.filter(other => other.slug !== item.slug)], { origin, preview: true }));
  return directory;
}
async function main() {
  if (command === "build") { console.log(JSON.stringify(await buildNewsletters(root))); return; }
  if (command === "new") {
    if (!validSlug(slug)) throw new Error("Provide a lowercase hyphenated slug.");
    const template = JSON.parse(await readFile(path.join(root, "content", "newsletters", "learning-to-see-like-jesus.json"), "utf8"));
    template.slug = slug; template.title = "Add your newsletter title"; template.status = "draft"; template.featured = false;
    template.subtitle = "Add your subtitle"; template.description = "Add a short preview of your newsletter"; template.previewText = template.description;
    template.date = new Date().toISOString().slice(0, 7); template.subject = template.title;
    template.cover = { placeholder: "Add your personal cover photo." };
    template.introduction = [{ type: "placeholder", text: "Paste your opening note here." }];
    template.sections = [{ heading: "Your update", blocks: [{ type: "placeholder", text: "Paste your own update here." }] }, { heading: "Prayer Requests", blocks: [{ type: "prayers" }] }];
    template.prayerRequests = [];
    await writeFile(path.join(root, "content", "newsletters", `${slug}.json`), JSON.stringify(template, null, 2) + "\n", { flag: "wx" });
    console.log(`Created draft content/newsletters/${slug}.json`); return;
  }
  if (command === "photo") {
    if (!validSlug(slug) || !validSlug(option("name")) || !option("file") || !option("alt")) throw new Error("Use photo <slug> --file <photo> --name <hyphenated-name> --alt <description> [--caption <text>].");
    const { default: sharp } = await import("sharp");
    const source = path.resolve(root, option("file")), name = option("name");
    const directory = path.join(root, "public", "images", "newsletters", slug); await mkdir(directory, { recursive: true });
    for (const size of [480, 960, 1600]) {
      try { await stat(path.join(directory, `${name}-${size}.jpg`)); throw new Error(`Photo already exists: ${name}-${size}.jpg. Choose another name.`); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const sources = []; let largest;
    for (const size of [480, 960, 1600]) {
      const filename = `${name}-${size}.jpg`, destination = path.join(directory, filename);
      const result = await sharp(source, { limitInputPixels: 100_000_000 }).rotate().resize({ width: size, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(destination);
      sources.push({ src: `/images/newsletters/${slug}/${filename}`, width: result.width }); largest = result;
    }
    const uniqueSources = sources.filter((entry, index) => !sources.slice(index + 1).some(later => later.width === entry.width));
    console.log(JSON.stringify({ type: "image", src: sources.at(-1).src, alt: option("alt"), caption: option("caption") || "", width: largest.width, height: largest.height, sources: uniqueSources }, null, 2)); return;
  }
  if (command === "audit") {
    const client = createBrevoClient(env.BREVO_API_KEY);
    const [lists, senders] = await Promise.all([client("contacts/lists?limit=50&offset=0"), client("senders")]);
    console.log(JSON.stringify({ configuredListId: Number(env.BREVO_LIST_ID), lists: lists.lists?.map(l => ({ id: l.id, name: l.name, uniqueSubscribers: l.uniqueSubscribers })), senders: senders.senders?.map(s => ({ id: s.id, name: s.name, email: s.email, active: s.active })) }, null, 2)); return;
  }
  if (!["export", "preview", "campaign-draft", "test"].includes(command) || !validSlug(slug)) throw new Error("Commands: new <slug>, build, photo <slug>, audit, export <slug>, preview <slug>, campaign-draft <slug>, test <slug> --confirm-test. See docs/NEWSLETTERS.md.");
  const item = (await loadNewsletters(root)).find(item => item.slug === slug);
  if (!item) throw new Error("Newsletter not found.");
  const directory = await exportPreview(item);
  if (command === "export") { console.log(`Private web/email previews: ${directory}`); return; }
  if (command === "preview") {
    const port = Number(option("port") || 3011);
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid preview port.");
    const server = createServer(async (request, response) => {
      response.setHeader("X-Robots-Tag", "noindex, nofollow"); response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'");
      try {
        if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        if (["/mobile", "/mobile-email", "/mobile-archive"].includes(pathname)) {
          const target = pathname === "/mobile" ? "/" : pathname === "/mobile-email" ? "/email" : "/archive";
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>390px layout preview</title></head><body style="margin:0;background:#d8d9cf;font:14px Arial,sans-serif"><p>Private layout check · 390px mobile viewport</p><iframe title="Mobile newsletter preview" src="${target}" width="390" height="1200" style="display:block;max-width:100%;border:0;"></iframe></body></html>`); return;
        }
        const previews = { "/": "web.html", "/email": "email.html", "/text": "email.txt", "/archive": "archive.html", "/newsletters": "archive.html", [`/newsletters/${slug}`]: "web.html" };
        const filename = previews[pathname] ? path.join(directory, previews[pathname]) : path.resolve(root, "public", `.${pathname}`);
        if (!previews[pathname] && (!filename.startsWith(path.join(root, "public") + path.sep) || !/^\/(styles\.css|newsletters\.css|images\/newsletters\/)/.test(pathname))) { response.writeHead(404).end(); return; }
        let data = await readFile(filename);
        // A private browser preview can load unpublished local photos. The exported
        // campaign HTML retains absolute public URLs for real email clients.
        if (previews[pathname] === "email.html") data = Buffer.from(data.toString("utf8").replaceAll(`src="${origin}/images/newsletters/`, 'src="/images/newsletters/'));
        const type = filename.endsWith(".css") ? "text/css" : filename.endsWith(".txt") ? "text/plain" : filename.endsWith(".html") ? "text/html" : "image/jpeg";
        response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` }); response.end(request.method === "HEAD" ? undefined : data);
      } catch { response.writeHead(404).end("Not found"); }
    });
    server.listen(port, "127.0.0.1", () => console.log(`Private preview: http://127.0.0.1:${port}/ · Email: /email · Archive: /archive · Ctrl+C to stop.`)); return;
  }
  const client = createBrevoClient(env.BREVO_API_KEY);
  const receipt = await getReceipt(slug);
  if (command === "campaign-draft") {
    const saveReceipt = async value => { await mkdir(path.dirname(receiptPath(slug)), { recursive: true }); await writeFile(receiptPath(slug), JSON.stringify(value, null, 2)); };
    const { plainText, ...result } = await saveCampaignDraft(client, item, { ...env, NEWSLETTER_PUBLIC_URL: origin }, { receipt, saveReceipt });
    console.log(JSON.stringify(result, null, 2)); return;
  }
  console.log(JSON.stringify(await sendOwnerTest(client, receipt?.id, env, args.includes("--confirm-test")), null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
