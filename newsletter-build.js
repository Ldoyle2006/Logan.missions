import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { loadNewsletters, renderArchive, renderNewsletterPage, newsletterPath, siteOrigin } from "./newsletter.js";

export async function buildNewsletters(root, { origin = "https://logan-missions.onrender.com" } = {}) {
  origin = siteOrigin(origin);
  const all = await loadNewsletters(root);
  const published = all.filter(item => item.status === "published");
  const publicDir = path.join(root, "public"), letterDir = path.join(publicDir, "newsletters");
  await mkdir(letterDir, { recursive: true });
  // Remove only this generator's stale output, e.g. when a letter becomes a draft.
  for (const name of await readdir(letterDir)) {
    if (!name.endsWith(".html") || published.some(item => `${item.slug}.html` === name)) continue;
    const target = path.join(letterDir, name);
    if ((await readFile(target, "utf8")).startsWith("<!-- GENERATED_NEWSLETTER -->")) await unlink(target);
  }
  await writeFile(path.join(publicDir, "newsletters.html"), await renderArchive(root, published, { origin }));
  for (const item of published) await writeFile(path.join(letterDir, `${item.slug}.html`), await renderNewsletterPage(root, item, published, { origin }));
  const sitemapPath = path.join(publicDir, "sitemap.xml");
  const existing = (await readFile(sitemapPath, "utf8")).replace(/\s*<url>\s*<loc>[^<]*\/newsletters(?:\.html|\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g, "");
  const entries = ["/newsletters", ...published.map(newsletterPath)].map(url => `  <url><loc>${origin}${url}</loc></url>`).join("\n");
  await writeFile(sitemapPath, existing.replace(/\s*<\/urlset>/, `\n${entries}\n</urlset>`));
  return { published: published.length, drafts: all.length - published.length };
}
