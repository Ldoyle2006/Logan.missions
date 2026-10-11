import test from "node:test";
import assert from "node:assert/strict";
import {
  createFourthwallCheckout,
  FourthwallError,
  fourthwallCollections,
  getFourthwallCatalog,
} from "../fourthwall-storefront.js";

function product(overrides = {}, variantId = "550e8400-e29b-41d4-a716-446655440000") {
  return {
    type: "PRODUCT",
    slug: "worthy-of-hearing-hat",
    name: "Worthy of Hearing hat",
    state: { type: "AVAILABLE" },
    access: { type: "PUBLIC" },
    images: [{ url: "https://imgproxy.fourthwall.dev/product.jpg" }],
    variants: [{
      id: variantId,
      name: "Black, One size",
      unitPrice: { value: 29.99, currency: "USD" },
      attributes: {
        color: { name: "Black", swatch: "#000000" },
        size: { name: "One size fits most" },
      },
      stock: { type: "UNLIMITED" },
      images: [],
    }],
    ...overrides,
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createCatalogFetch(products = new Map()) {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url: new URL(url), options });
    const slug = decodeURIComponent(new URL(url).pathname.split("/").at(-1));
    const name = slug === "worthy-of-hearing-hat" ? "Worthy of Hearing hat" : slug;
    return response(products.get(slug) || product({ slug, name }, `variant-${slug}`));
  };
  return { calls, fetchStub };
}

test("loads the four configured public product pages with USD prices", async () => {
  const { calls, fetchStub } = createCatalogFetch();
  const catalog = await getFourthwallCatalog("ptkn_test", fetchStub);

  assert.equal(calls.length, 4);
  assert.deepEqual(catalog.map((entry) => entry.collectionId), fourthwallCollections.map((entry) => entry.collectionId));
  assert.equal(catalog[0].name, "Worthy of Hearing hat");
  assert.equal(catalog[0].image, "https://imgproxy.fourthwall.dev/product.jpg");
  assert.equal(catalog[0].variants[0].color, "Black");
  assert.equal(catalog[0].variants[0].size, "One size fits most");
  assert.equal(catalog[0].variants[0].price, 29.99);
  assert.equal(catalog[0].available, true);
  assert(calls.every(({ url }) => url.hostname === "storefront-api.fourthwall.com"));
  assert(calls.every(({ url }) => url.searchParams.get("storefront_token") === "ptkn_test"));
});

test("does not mark sold-out products or out-of-stock variants as available", async () => {
  const soldOut = product({
    slug: "known-by-name-hat",
    state: { type: "SOLD_OUT" },
    variants: [{
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Stone, One size",
      unitPrice: { value: 29.99, currency: "USD" },
      attributes: { color: { name: "Stone", swatch: "#aaaaaa" } },
      stock: { type: "LIMITED", inStock: 0 },
      images: [],
    }],
  });
  const { fetchStub } = createCatalogFetch(new Map([["known-by-name-hat", soldOut]]));
  const catalog = await getFourthwallCatalog("ptkn_test", fetchStub);
  const entry = catalog.find((item) => item.slug === "known-by-name-hat");

  assert.equal(entry.available, false);
  assert.equal(entry.variants[0].available, false);
  assert.equal(entry.variants[0].stock, 0);
});

test("rejects catalog access without a Storefront API token", async () => {
  await assert.rejects(
    getFourthwallCatalog("", async () => assert.fail("Fetch must not run without a token")),
    (error) => error instanceof FourthwallError && error.statusCode === 503,
  );
});

test("creates a Fourthwall hosted checkout cart using only available catalog variants", async () => {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    calls.push({ url: parsedUrl, options });
    if (parsedUrl.pathname === "/v1/carts") return response({ id: "fourthwall-cart-123" });
    const slug = decodeURIComponent(parsedUrl.pathname.split("/").at(-1));
    return response(product(
      { slug, name: slug },
      slug === "worthy-of-hearing-hat" ? "550e8400-e29b-41d4-a716-446655440000" : `variant-${slug}`,
    ));
  };

  const checkoutUrl = await createFourthwallCheckout(
    "ptkn_test",
    [{ variantId: "550e8400-e29b-41d4-a716-446655440000", quantity: 2 }],
    fetchStub,
  );
  const cartRequest = calls.at(-1);

  assert.equal(checkoutUrl, "https://logans-mission-shop.fourthwall.com/checkout/?cartCurrency=USD&cartId=fourthwall-cart-123");
  assert.equal(cartRequest.options.method, "POST");
  assert.deepEqual(JSON.parse(cartRequest.options.body), {
    items: [{ variantId: "550e8400-e29b-41d4-a716-446655440000", quantity: 2 }],
  });
  assert.equal(cartRequest.url.searchParams.get("storefront_token"), "ptkn_test");
  assert.equal(new URL(checkoutUrl).searchParams.has("storefront_token"), false);
});

test("rejects unavailable variants without creating a cart", async () => {
  const calls = [];
  const soldOut = product({
    state: { type: "SOLD_OUT" },
    variants: [{
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Black, One size",
      unitPrice: { value: 29.99, currency: "USD" },
      attributes: { color: { name: "Black", swatch: "#000000" } },
      stock: { type: "LIMITED", inStock: 0 },
      images: [],
    }],
  });
  const fetchStub = async (url) => {
    const parsedUrl = new URL(url);
    calls.push(parsedUrl);
    if (parsedUrl.pathname === "/v1/carts") return response({ id: "should-not-exist" });
    const slug = decodeURIComponent(parsedUrl.pathname.split("/").at(-1));
    return response(soldOut.slug === slug
      ? soldOut
      : product({ slug, name: slug }, `variant-${slug}`));
  };

  await assert.rejects(
    createFourthwallCheckout(
      "ptkn_test",
      [{ variantId: "550e8400-e29b-41d4-a716-446655440000", quantity: 1 }],
      fetchStub,
    ),
    (error) => error instanceof FourthwallError && error.statusCode === 409,
  );
  assert.equal(calls.some((url) => url.pathname === "/v1/carts"), false);
});

test("rejects invalid checkout cart items before contacting Fourthwall", async () => {
  await assert.rejects(
    createFourthwallCheckout("ptkn_test", [{ variantId: "invalid", quantity: 0 }]),
    (error) => error instanceof FourthwallError && error.statusCode === 400,
  );
});
