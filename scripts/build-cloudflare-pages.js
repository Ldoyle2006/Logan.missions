import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { functionRoutes } from "../cloudflare/worker.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".cloudflare-dist");
const legacyOrigin = "https://logan-missions.onrender.com";
let site;
try { site = new URL(process.env.PUBLIC_SITE_URL); } catch { throw new Error("Set PUBLIC_SITE_URL to the final HTTPS public site origin before building."); }
if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash) throw new Error("PUBLIC_SITE_URL must be an HTTPS origin without a path or credentials.");
const origin = site.origin;
const cleanPaths = text => text.replace(/\/(giving|vision|shop|privacy)\.html(?=[?"'#<\s])/g, "/$1");
const files = [];
async function collect(directory, relative = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) { await collect(path.join(directory, entry.name), name); continue; }
    // Source camera photos are not website assets; only their optimized gallery versions ship.
    if (name.startsWith("images/mission/") && !name.endsWith(".web.jpg")) continue;
    if (name === "school-admin.js") continue;
    if (!/\.(html|css|js|json|txt|xml|jpg|jpeg|png|svg|webp|ico|woff2?)$/i.test(name)) continue;
    const data = await readFile(path.join(directory, entry.name));
    if (data.length > 25 * 1024 * 1024) throw new Error(`Cloudflare asset limit exceeded: ${name}`);
    files.push({ name, data });
  }
}
await collect(path.join(root, "public"));
// Refuse an output tree with stale files rather than silently publishing them.
await mkdir(output, { recursive: true });
const existing = await readdir(output);
if (existing.length) throw new Error("The .cloudflare-dist directory must be empty before building. Use a fresh build checkout or move the previous output aside.");
for (const { name, data } of files) {
  const destination = path.join(output, name);
  await mkdir(path.dirname(destination), { recursive: true });
  const isText = /\.(html|css|js|json|txt|xml)$/i.test(name);
  await writeFile(destination, isText ? cleanPaths(data.toString().replaceAll(legacyOrigin, origin)) : data);
}
await writeFile(path.join(output, "_worker.js"), await readFile(path.join(root, "cloudflare", "worker.js")));
await writeFile(path.join(output, "_routes.json"), JSON.stringify({ version: 1, include: functionRoutes, exclude: [] }, null, 2));
await writeFile(path.join(output, "404.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found</title><p>Page not found. <a href="/">Return home</a>.</p></html>');
await writeFile(path.join(output, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' https://www.googletagmanager.com https://www.clarity.ms; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://imgproxy.fourthwall.dev https://www.clarity.ms https://c.bing.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.clarity.ms https://*.clarity.ms https://c.bing.com; form-action 'self'; base-uri 'self'; frame-ancestors 'none'\n`);
console.log(`Cloudflare public package prepared: ${files.length} assets. Canonical origin: ${origin}. No secrets or private admin pages included.`);
