import test from "node:test";
import assert from "node:assert/strict";
import { createPagesWorker } from "../cloudflare/worker.js";

const site = "https://logan-missions-preview.pages.dev";
const env = { PUBLIC_SITE_URL: site, ASSETS: { fetch: async () => new Response("static", { status: 200 }) } };

test("Google verification returns its exact public file directly without an HTML redirect", async () => {
  const worker = createPagesWorker(() => assert.fail("Verification must not contact Render"));
  const response = await worker.fetch(new Request(site + "/google9bcf900fc8b10803.html"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Location"), null);
  assert.equal(await response.text(), "google-site-verification: google9bcf900fc8b10803.html");
});

test("public pages and private admin paths never wake or proxy to the backend", async () => {
  const worker = createPagesWorker(() => assert.fail("Static requests must not contact Render"));
  for (const path of ["/", "/robots.txt", "/giving", "/school-admin", "/api/school-admin/ledger", "/api/stripe-webhook"]) {
    assert.equal(await (await worker.fetch(new Request(site + path), env)).text(), "static");
  }
});

test("proxy rejects cross-origin, unconfigured and preview-host form submissions before forwarding", async () => {
  const worker = createPagesWorker(() => assert.fail("Invalid submissions must not reach Render"));
  for (const [host, origin, config, status] of [
    [site, "https://attacker.example", env, 403],
    [site, site, { ASSETS: env.ASSETS }, 503],
    ["https://untrusted-preview.pages.dev", "https://untrusted-preview.pages.dev", env, 403],
  ]) {
    const request = new Request(host + "/api/schools/checkout", { method: "POST", headers: { Origin: origin }, body: "{}" });
    assert.equal((await worker.fetch(request, config)).status, status);
  }
});

test("public donation proxy preserves body and origin, strips credentials and never caches provider replies", async () => {
  const worker = createPagesWorker(async (url, options) => {
    assert.equal(url, "https://logan-missions.onrender.com/api/schools/checkout");
    assert.equal(options.headers.get("Origin"), site);
    assert.equal(options.headers.get("Cookie"), null);
    assert.equal(options.headers.get("Authorization"), null);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), { schoolId: "bcc", amount: 100 });
    assert.equal(options.redirect, "manual");
    return new Response('{"url":"https://checkout.stripe.com/example"}', { status: 200, headers: { "Set-Cookie": "private=secret", "Cache-Control": "public, max-age=3600" } });
  });
  const response = await worker.fetch(new Request(site + "/api/schools/checkout", { method: "POST",
    headers: { Origin: site, Cookie: "session=private", Authorization: "Bearer private", "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId: "bcc", amount: 100 }) }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("backend cold-start failures produce a retryable error without leaking secrets", async () => {
  const worker = createPagesWorker(async () => { throw new Error("sensitive upstream connection detail"); });
  const response = await worker.fetch(new Request(site + "/api/config"), env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /sensitive/);
});
