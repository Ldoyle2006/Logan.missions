import test from "node:test";
import assert from "node:assert/strict";
import { getSchoolDonationProduct } from "../stripe-school-products.js";

test("reuses the designated school's existing Stripe product", async () => {
  const stripe = { products: {
    async list() { return { data: [
      { id: "prod_general", metadata: { purpose: "recurring_donations", integration: "logan_missions" } },
      { id: "prod_bcc", metadata: { purpose: "school", integration: "logan_missions", school_id: "bcc" } },
    ] }; },
    async create() { assert.fail("A duplicate school product must not be created"); },
  } };
  assert.equal(await getSchoolDonationProduct(stripe, "bcc"), "prod_bcc");
});
test("creates each school's product with its own designation and stable idempotency key", async () => {
  for (const schoolId of ["bcc", "word_by_heart", "sbs"]) {
    const stripe = { products: {
      async list() { return { data: [], has_more: false }; },
      async create(params, options) {
        assert.equal(params.metadata.school_id, schoolId);
        assert.equal(params.metadata.purpose, "school");
        assert.equal(options.idempotencyKey, `logan-missions-school-product-${schoolId}-v1`);
        return { id: `prod_${schoolId}` };
      },
    } };
    assert.equal(await getSchoolDonationProduct(stripe, schoolId), `prod_${schoolId}`);
  }
});
test("finds school products beyond the first catalog page", async () => {
  const stripe = { products: {
    async list(params) { return params.starting_after
      ? { data: [{ id: "prod_sbs", metadata: { integration: "logan_missions", purpose: "school", school_id: "sbs" } }], has_more: false }
      : { data: [{ id: "prod_other", metadata: {} }], has_more: true }; },
    async create() { assert.fail("Existing product on the next page should be reused"); },
  } };
  assert.equal(await getSchoolDonationProduct(stripe, "sbs"), "prod_sbs");
});
test("rejects an unknown school before calling Stripe", async () => {
  await assert.rejects(getSchoolDonationProduct({}, "unknown"), /Unknown school/);
});
