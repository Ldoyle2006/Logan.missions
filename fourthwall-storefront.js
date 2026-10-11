const apiBaseUrl = "https://storefront-api.fourthwall.com/v1";
const shopDomain = "logans-mission-shop.fourthwall.com";

export const fourthwallCollections = [
  {
    slug: "worthy-of-hearing-hat",
    collectionId: "worthy-of-hearing",
  },
  {
    slug: "known-by-name-hat",
    collectionId: "known-by-name",
  },
  {
    slug: "beyond-language-hat",
    collectionId: "beyond-language",
  },
  {
    slug: "the-way-is-open-hat",
    collectionId: "the-way-is-open",
  },
];

export class FourthwallError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "FourthwallError";
    this.statusCode = statusCode;
  }
}

function isPublicHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "fourthwall.com" ||
        url.hostname.endsWith(".fourthwall.com") ||
        url.hostname === "fourthwall.dev" ||
        url.hostname.endsWith(".fourthwall.dev"));
  } catch {
    return false;
  }
}

function isVariantAvailable(variant) {
  return variant.stock?.type === "UNLIMITED" ||
    variant.stock?.type === "LIMITED" &&
      Number.isInteger(variant.stock.inStock) &&
      variant.stock.inStock > 0;
}

function toPublicProduct(product, collectionId) {
  if (
    !product ||
    product.type !== "PRODUCT" ||
    product.access?.type !== "PUBLIC" ||
    typeof product.slug !== "string" ||
    typeof product.name !== "string"
  ) {
    return null;
  }

  const images = Array.isArray(product.images)
    ? product.images
      .filter((image) => image && typeof image === "object")
      .map((image) => image.transformedUrl || image.url)
      .filter(isPublicHttpsUrl)
    : [];
  const variants = Array.isArray(product.variants)
    ? product.variants
      .filter((variant) =>
        variant &&
        typeof variant.id === "string" &&
        typeof variant.name === "string" &&
        typeof variant.unitPrice?.value === "number" &&
        variant.unitPrice?.currency === "USD"
      )
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        color: typeof variant.attributes?.color?.name === "string"
          ? variant.attributes.color.name
          : null,
        colorSwatch: typeof variant.attributes?.color?.swatch === "string"
          ? variant.attributes.color.swatch
          : null,
        size: typeof variant.attributes?.size?.name === "string"
          ? variant.attributes.size.name
          : null,
        price: variant.unitPrice.value,
        currency: variant.unitPrice.currency,
        available: isVariantAvailable(variant),
        stock: variant.stock?.type === "LIMITED" ? variant.stock.inStock : null,
        images: Array.isArray(variant.images)
          ? variant.images
            .filter((image) => image && typeof image === "object")
            .map((image) => image.transformedUrl || image.url)
            .filter(isPublicHttpsUrl)
          : [],
      }))
    : [];

  return {
    slug: product.slug,
    collectionId,
    name: product.name,
    image: images[0] || null,
    available: product.state?.type === "AVAILABLE" && variants.some((variant) => variant.available),
    variants,
  };
}

async function fetchJson(url, options, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new FourthwallError("Fourthwall could not be reached. Please try again.");
  }

  if (!response.ok) {
    throw new FourthwallError("Fourthwall could not complete the shop request. Please try again.");
  }

  try {
    return await response.json();
  } catch {
    throw new FourthwallError("Fourthwall returned an invalid shop response.");
  }
}

export async function getFourthwallCatalog(token, fetchImpl = fetch) {
  if (typeof token !== "string" || !token.trim()) {
    throw new FourthwallError("The Fourthwall Storefront API token is not configured.", 503);
  }
  token = token.trim();

  const products = await Promise.all(fourthwallCollections.map(async ({ slug, collectionId }) => {
    const url = new URL(`${apiBaseUrl}/products/${encodeURIComponent(slug)}`);
    url.searchParams.set("storefront_token", token);
    url.searchParams.set("currency", "USD");
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      throw new FourthwallError("Fourthwall could not be reached. Please try again.");
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new FourthwallError("Fourthwall could not load the product catalog. Please try again.");
    }

    let product;
    try {
      product = await response.json();
    } catch {
      throw new FourthwallError("Fourthwall returned an invalid product catalog.");
    }
    return toPublicProduct(product, collectionId);
  }));

  return products.filter(Boolean);
}

export async function createFourthwallCheckout(token, items, fetchImpl = fetch) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new FourthwallError("Add at least one item to your cart.", 400);
  }
  const selectedVariantIds = new Set();
  for (const item of items) {
    if (
      !item ||
      typeof item.variantId !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    ) {
      throw new FourthwallError("Choose a valid product and quantity.", 400);
    }
    if (selectedVariantIds.has(item.variantId)) {
      throw new FourthwallError("Remove duplicate items from your cart and try again.", 400);
    }
    selectedVariantIds.add(item.variantId);
  }

  const catalog = await getFourthwallCatalog(token, fetchImpl);
  const variants = new Map(
    catalog.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { ...variant, product }])
    )
  );
  const checkedItems = [];
  for (const item of items) {
    const variant = variants.get(item.variantId);
    if (
      !variant ||
      !variant.product.available ||
      !variant.available ||
      variant.stock !== null && item.quantity > variant.stock
    ) {
      throw new FourthwallError("A selected item is no longer available. Refresh the shop and try again.", 409);
    }
    checkedItems.push({ variantId: variant.id, quantity: item.quantity });
  }

  const url = new URL(`${apiBaseUrl}/carts`);
  url.searchParams.set("storefront_token", token);
  url.searchParams.set("currency", "USD");
  const cart = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: checkedItems }),
  }, fetchImpl);

  if (typeof cart.id !== "string" || !cart.id) {
    throw new FourthwallError("Fourthwall did not return a checkout cart.");
  }

  const checkoutUrl = new URL("/checkout/", `https://${shopDomain}`);
  checkoutUrl.searchParams.set("cartCurrency", "USD");
  checkoutUrl.searchParams.set("cartId", cart.id);
  return checkoutUrl.toString();
}
