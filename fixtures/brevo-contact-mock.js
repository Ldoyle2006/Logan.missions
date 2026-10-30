// Loaded only by the HTTP integration test process. Never imported by production.
import assert from "node:assert/strict";
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.brevo.com/v3/contacts");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["api-key"], "test-key-only");
  assert.deepEqual(JSON.parse(options.body), { email: "newsletter-test@example.test", attributes: { FIRSTNAME: "Newsletter test" }, listIds: [4], updateEnabled: true });
  return new Response('{"id":123}', { status: 201 });
};
