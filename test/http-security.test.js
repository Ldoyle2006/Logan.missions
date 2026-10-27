import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { scryptSync } from "node:crypto";
import { createServer } from "node:net";
import Stripe from "stripe";

test("HTTP pages, admin protection, same-origin checks and raw Stripe signature verification", async () => {
  const probe = createServer(); await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const password = "integration-test-password-only", salt = "34".repeat(16);
  const webhookSecret = "whsec_integration_test_only";
  const child = spawn(process.execPath, ["server.js"], { cwd: new URL("..", import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: String(port), PUBLIC_BASE_URL: origin, PUBLIC_FRONTEND_URL: "https://frontend.example", PUBLIC_FRONTEND_REDIRECT: "false", DATABASE_URL: "", STRIPE_MODE: "test", STRIPE_LIVE_MODE_APPROVED: "false",
      STRIPE_SECRET_KEY: "sk_test_integration_only", STRIPE_WEBHOOK_SECRET: webhookSecret,
      SCHOOL_ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, SCHOOL_NOTIFICATION_FROM: "", SCHOOL_NOTIFICATION_TO: "" },
    stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Server did not start")), 15000);
      child.stdout.on("data", chunk => { if (chunk.toString().includes("listening")) { clearTimeout(timer); resolve(); } });
      child.on("error", reject); child.on("exit", code => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
    });
    const giving = await (await fetch(`${origin}/giving.html`)).text();
    assert.match(giving, /\$1,905\/month/); assert.match(giving, /\$2,000\/month/);
    assert.doesNotMatch(giving, /budget-bar|role="progressbar"|Future Bible school savings/);
    for (const schedule of ["monthly", "bi-weekly", "one-time"]) assert.match(giving, new RegExp(`value="${schedule}"`));
    const vision = await (await fetch(`${origin}/vision.html`)).text();
    assert.equal((vision.match(/class="school-card"/g) || []).length, 3);
    assert.match(vision, /Funding progress not yet updated/);
    const robots = await fetch(`${origin}/robots.txt`);
    assert.equal(robots.status, 200); assert.match(robots.headers.get("content-type"), /^text\/plain/);
    assert.match(await robots.text(), /Sitemap: https:\/\/logan-missions\.onrender\.com\/sitemap\.xml/);
    const sitemap = await fetch(`${origin}/sitemap.xml`);
    assert.equal(sitemap.status, 200); assert.match(sitemap.headers.get("content-type"), /^application\/xml/);
    const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
    assert.equal(locations.length, 5);
    for (const location of locations) {
      assert.equal(location.origin, "https://logan-missions.onrender.com");
      assert.equal(location.search, ""); assert.equal(location.hash, "");
      const page = await fetch(`${origin}${location.pathname}`);
      assert.equal(page.status, 200);
      assert.ok((await page.text()).includes(`<link rel="canonical" href="${location.href}">`));
    }
    assert.equal((await fetch(`${origin}/api/school-admin/ledger`)).status, 401);
    assert.equal((await fetch(`${origin}/api/school-admin/runtime`)).status, 401);
    assert.equal((await fetch(`${origin}/private/school-admin.html`)).status, 404);
    const loginPage = await fetch(`${origin}/school-admin`);
    assert.equal(loginPage.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(loginPage.headers.get("cache-control"), "no-store");
    assert.match(await loginPage.text(), /id="admin-login"/);
    const post = (route, body, headers = {}) => fetch(`${origin}${route}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...headers }, body: JSON.stringify(body) });
    assert.equal((await post("/api/school-admin/login", { password }, { Origin: "https://attacker.example" })).status, 403);
    assert.equal((await post("/api/school-admin/login", { password }, { Origin: "https://frontend.example" })).status, 403);
    assert.equal((await post("/api/create-checkout-session", {}, { Origin: "https://frontend.example" })).status, 400);
    assert.equal((await post("/api/schools/checkout", {}, { Origin: "https://frontend.example" })).status, 503);
    const signedIn = await post("/api/school-admin/login", { password }); assert.equal(signedIn.status, 200);
    const cookie = signedIn.headers.get("set-cookie").split(";")[0];
    const runtimeResponse = await fetch(`${origin}/api/school-admin/runtime`, { headers: { Cookie: cookie } });
    assert.equal(runtimeResponse.status, 200);
    assert.equal(runtimeResponse.headers.get("cache-control"), "no-store");
    assert.equal(runtimeResponse.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal((await runtimeResponse.json()).nodeVersion, process.version);
    const privatePage = await (await fetch(`${origin}/school-admin`, { headers: { Cookie: cookie } })).text();
    assert.match(privatePage, /Donations and savings allocations/); assert.doesNotMatch(privatePage, /analytics-consent/);
    assert.equal((await fetch(`${origin}/api/school-admin/ledger`, { headers: { Cookie: cookie } })).status, 503);
    const publicData = await (await fetch(`${origin}/api/schools`)).json();
    assert.equal(publicData.checkoutEnabled, false); assert.equal(publicData.schools[0].raisedCents, null);
    assert.equal((await post("/api/schools/checkout", { schoolId: "bcc", amount: 100 })).status, 503);
    assert.equal((await post("/api/schools/checkout", {}, { Origin: "https://attacker.example" })).status, 403);
    const stripe = new Stripe("sk_test_signature_only");
    async function webhook(event, signatureOverride) {
      const payload = JSON.stringify(event);
      const signature = signatureOverride ?? stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
      return fetch(`${origin}/api/stripe-webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload });
    }
    assert.equal((await webhook({ id: "evt_test", livemode: false, type: "test.ignored", data: { object: {} } })).status, 200);
    assert.equal((await webhook({ livemode: false }, "invalid")).status, 400);
    assert.equal((await webhook({ id: "evt_live", livemode: true })).status, 400);
    assert.equal((await webhook({ id: "evt_school", livemode: false, type: "payment_intent.succeeded", data: { object: { metadata: { purpose: "school" } } } })).status, 503);
    assert.equal((await post("/api/school-admin/logout", {}, { Cookie: cookie })).status, 200);
    assert.equal((await fetch(`${origin}/api/school-admin/ledger`, { headers: { Cookie: cookie } })).status, 401);
  } finally { child.kill(); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve)); }
});
