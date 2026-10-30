import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNewsletter, renderEmail, renderPlainText, renderNewsletterPage, SITE_ORIGIN, imagePath } from "../newsletter.js";
import { buildNewsletters } from "../newsletter-build.js";
import { createBrevoClient, saveCampaignDraft, sendOwnerTest } from "../newsletter-brevo.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const draft = {
  schemaVersion: 1, slug: "learning-to-see-like-jesus", title: "Layout test letter", date: "2026-10", status: "draft", description: "Test description", subject: "Test subject", previewText: "Test preheader", signature: "Test author",
  cover: { placeholder: "Test cover" }, introduction: [{ type: "placeholder", text: "Test introduction" }], sections: [{ heading: "Test section", blocks: [{ type: "placeholder", text: "Test paragraph" }, { type: "prayers" }] }], prayerRequests: []
};
function published() {
  return { ...structuredClone(draft), status: "published", date: "2026-10-29", cover: { src: "/images/newsletters/test-letter/photo.jpg", alt: "Layout test fixture", width: 960, height: 640 }, introduction: [{ type: "paragraph", text: "Test introduction — not a ministry story." }], sections: [{ heading: "Test section", blocks: [{ type: "paragraph", text: "Test paragraph." }, { type: "prayers" }] }], prayerRequests: ["Test prayer request."] };
}
test("placeholder content and incomplete dates cannot be published", () => {
  assert.equal(validateNewsletter(draft).status, "draft");
  assert.throws(() => validateNewsletter({ ...draft, status: "published" }), /publication day/);
  assert.throws(() => validateNewsletter({ ...draft, status: "published", date: "2026-10-29" }), /placeholder/);
  assert.throws(() => validateNewsletter({ ...published(), date: "2026-02-30" }), /calendar/);
  assert.throws(() => validateNewsletter({ ...published(), slug: "../../secret" }), /slug/);
  assert.throws(() => imagePath("/images/newsletters/test-letter/../../secret.jpg"));
});
test("website and full email render the same content safely, with managed unsubscribe and absolute image URLs", async () => {
  const item = published();
  item.introduction[0].text = '<script>alert("x")</script> {{ contact.EMAIL }}';
  const html = renderEmail(item), plain = renderPlainText(item);
  const web = await renderNewsletterPage(root, item, [item]);
  for (const output of [html, web]) {
    assert.match(output, /&lt;script&gt;/); assert.doesNotMatch(output, /<script>alert/);
    assert.match(output, /&#123;&#123; contact.EMAIL &#125;&#125;/);
    assert.match(output, /Test paragraph/); assert.match(output, /Test prayer request/);
  }
  assert.match(html, /href="\{\{ unsubscribe \}\}"/);
  assert.match(html, /src="https:\/\/logan-missions.pages.dev\/images\/newsletters\/test-letter\/photo.jpg"/);
  assert.match(html, /role="presentation"/); assert.match(html, /style="/); assert.doesNotMatch(html, /<script/);
  assert.match(plain, /Test paragraph/); assert.match(plain, /Unsubscribe: \{\{ unsubscribe \}\}/);
  assert.match(web, /data-clarity-mask/); assert.match(web, /id="signup-form"/);
  assert.match(renderEmail(draft), /DRAFT CONTENT/); assert.match(renderEmail(draft), /PHOTO PLACEHOLDER/);
});
test("previous and next links follow published chronology, excluding unrelated drafts", async () => {
  const older = { ...published(), slug: "older-letter", date: "2026-09-01" };
  const newer = { ...published(), slug: "newer-letter", date: "2026-11-01" };
  const html = await renderNewsletterPage(root, published(), [newer, published(), older]);
  assert.match(html, /href="\/newsletters\/older-letter"/); assert.match(html, /href="\/newsletters\/newer-letter"/);
});
test("publication builder excludes drafts, updates archive/sitemap and removes only stale generated pages", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "logan-newsletters-"));
  try {
    await mkdir(path.join(temporary, "content/newsletters"), { recursive: true });
    await mkdir(path.join(temporary, "public/newsletters"), { recursive: true });
    await mkdir(path.join(temporary, "public/images/newsletters/test-letter"), { recursive: true });
    await cp(new URL("../public/privacy.html", import.meta.url), path.join(temporary, "public/privacy.html"));
    await writeFile(path.join(temporary, "public/sitemap.xml"), '<urlset><url><loc>https://logan-missions.onrender.com/</loc></url></urlset>');
    const content = path.join(temporary, "content/newsletters/learning-to-see-like-jesus.json");
    await writeFile(content, JSON.stringify(draft));
    assert.deepEqual(await buildNewsletters(temporary), { published: 0, drafts: 1 });
    assert.doesNotMatch(await readFile(path.join(temporary, "public/newsletters.html"), "utf8"), /Layout test letter|PHOTO PLACEHOLDER/);
    assert.doesNotMatch(await readFile(path.join(temporary, "public/sitemap.xml"), "utf8"), /learning-to-see/);
    await writeFile(path.join(temporary, "public/images/newsletters/test-letter/photo.jpg"), "fixture");
    await writeFile(content, JSON.stringify(published()));
    assert.deepEqual(await buildNewsletters(temporary), { published: 1, drafts: 0 });
    assert.match(await readFile(path.join(temporary, "public/newsletters.html"), "utf8"), /Read Newsletter/);
    assert.match(await readFile(path.join(temporary, "public/sitemap.xml"), "utf8"), /newsletters\/learning-to-see/);
    await writeFile(path.join(temporary, "public/newsletters/keep.html"), "An unrelated file");
    await writeFile(content, JSON.stringify(draft)); await buildNewsletters(temporary);
    await assert.rejects(readFile(path.join(temporary, "public/newsletters/learning-to-see-like-jesus.html")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(temporary, "public/newsletters/keep.html"), "utf8"), "An unrelated file");
  } finally {
    // This exact mkdtemp directory is owned by this test, never a computed project path.
    const { rm } = await import("node:fs/promises");
    if (!temporary.startsWith(path.join(tmpdir(), "logan-newsletters-"))) throw new Error("Unexpected temporary path.");
    await rm(temporary, { recursive: true, force: true });
  }
});
function provider() {
  const calls = []; let campaign;
  const client = async (route, options = {}) => {
    calls.push({ route, ...options });
    if (route.startsWith("contacts/lists")) return { lists: [{ id: 4 }] };
    if (route === "senders") return { senders: [{ id: 1, active: true, name: "Logan Missions", email: "owner@example.test" }] };
    if (route.startsWith("emailCampaigns?")) return { campaigns: campaign ? [campaign] : [] };
    if (options.method === "POST" && route === "emailCampaigns") { campaign = { ...options.body, id: 12, status: "draft", recipients: { lists: [4] } }; return { id: 12 }; }
    if (route === "emailCampaigns/12" && options.method === "PUT") { campaign = { ...campaign, ...options.body, recipients: { lists: [4] } }; return null; }
    if (route === "emailCampaigns/12") return campaign;
    if (route === "emailCampaigns/12/sendTest") return null;
    assert.fail(`Unexpected route: ${route}`);
  };
  return { calls, client, get campaign() { return campaign; } };
}
const env = { BREVO_LIST_ID: "4", NEWSLETTER_SENDER_ID: "1", NEWSLETTER_PUBLIC_URL: SITE_ORIGIN, NEWSLETTER_TEST_TO: "owner@example.test" };
test("Brevo creates only an unscheduled draft for the verified audience; repeat calls reuse it", async () => {
  const fake = provider(); let receipt;
  const result = await saveCampaignDraft(fake.client, draft, env, { saveReceipt: async r => { receipt = r; } });
  assert.equal(result.state, "draft"); assert.equal(receipt.id, 12);
  await saveCampaignDraft(fake.client, draft, env, { receipt, saveReceipt: async () => {} });
  assert.equal(fake.calls.filter(c => c.route === "emailCampaigns" && c.method === "POST").length, 1);
  const payload = fake.calls.find(c => c.method === "POST").body;
  assert.deepEqual(payload.recipients.listIds, [4]); assert.deepEqual(payload.sender, { id: 1 });
  assert.ok(!("scheduledAt" in payload)); assert.ok(!("sendAtBestTime" in payload));
  assert.ok(fake.calls.every(c => !/sendNow|smtp|status/.test(c.route)));
  fake.campaign.status = "sent";
  await assert.rejects(saveCampaignDraft(fake.client, draft, env, { receipt }), /unsent draft/);
});
test("missing audiences, inactive senders and uncertain creations fail closed", async () => {
  const fake = provider();
  await assert.rejects(saveCampaignDraft(fake.client, draft, { ...env, BREVO_LIST_ID: "2" }), /list was not found/);
  await assert.rejects(saveCampaignDraft(fake.client, draft, { ...env, NEWSLETTER_SENDER_ID: "99" }), /sender/);
  await assert.rejects(saveCampaignDraft(fake.client, draft, env, { receipt: { slug: draft.slug, state: "creating" } }), /uncertain/);
  assert.ok(fake.calls.every(c => !c.method));
});
test("owner tests require explicit confirmation and exactly one configured recipient", async () => {
  const fake = provider(); await saveCampaignDraft(fake.client, draft, env);
  await assert.rejects(sendOwnerTest(fake.client, 12, env), /confirm-test/);
  await assert.rejects(sendOwnerTest(fake.client, 12, { ...env, NEWSLETTER_TEST_TO: "" }, true), /Empty recipient/);
  await sendOwnerTest(fake.client, 12, env, true);
  assert.deepEqual(fake.calls.find(c => c.route.endsWith("sendTest")).body, { emailTo: ["owner@example.test"] });
});
test("API client denies sending/scheduling routes and never includes credentials in errors", async () => {
  const client = createBrevoClient("secret-test-value", async () => new Response("private provider detail", { status: 401 }));
  await assert.rejects(client("emailCampaigns/1/sendNow", { method: "POST" }), /Unsupported/);
  await assert.rejects(client("emailCampaigns", { method: "POST", body: { scheduledAt: "tomorrow" } }), /disabled/);
  await assert.rejects(client("senders"), error => /HTTP 401/.test(error.message) && !/secret-test-value|private provider detail/.test(error.message));
});
