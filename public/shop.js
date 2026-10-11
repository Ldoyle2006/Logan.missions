const shopStatus = document.querySelector("[data-shop-status]");
const cartCount = document.querySelector("[data-cart-count]");
const cartItemsContainer = document.querySelector("[data-cart-items]");
const cartTotal = document.querySelector("[data-cart-total]");
const checkoutButton = document.querySelector("[data-checkout]");
const shopProducts = new Map();
let cart = [];
let storageAvailable = true;

try {
  const savedCart = JSON.parse(localStorage.getItem("loganMissionsShopCart") || "[]");
  cart = Array.isArray(savedCart)
    ? savedCart.filter((item) =>
      item &&
      typeof item.variantId === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 10
    )
    : [];
} catch {
  storageAvailable = false;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
}

function saveCart() {
  try {
    localStorage.setItem("loganMissionsShopCart", JSON.stringify(cart));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function availableVariants(product) {
  return product.variants.filter((variant) => variant.available);
}

function renderProduct(product) {
  shopProducts.set(product.slug, product);
  const card = document.querySelector(`[data-product-slot="${CSS.escape(product.slug)}"]`);
  if (!card) return;

  const imageContainer = createElement("div", "collection-image-link");
  let productImage = null;
  if (product.image) {
    productImage = createElement("img", "collection-image");
    productImage.src = product.image;
    productImage.alt = `${product.name} product image`;
    productImage.loading = "lazy";
    imageContainer.append(productImage);
  } else {
    imageContainer.append(createElement("span", "shop-image-unavailable", "Product image unavailable"));
  }

  const details = createElement("div", "shop-product-info");
  const titleRow = createElement("div", "collection-product-row");
  titleRow.append(createElement("span", "", product.name));
  const price = createElement("span", "product-price");
  titleRow.append(price);
  details.append(titleRow);

  const form = createElement("form", "shop-product-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const variant = product.variants.find((item) => item.id === selectedVariantId);
    if (!variant || !variant.available) return;

    const existingItem = cart.find((item) => item.variantId === variant.id);
    if (existingItem) {
      const maxQuantity = variant.stock === null ? 10 : Math.min(10, variant.stock);
      if (existingItem.quantity >= maxQuantity) {
        shopStatus.textContent = `Only ${maxQuantity} of this option can be added right now.`;
        return;
      }
      existingItem.quantity += 1;
    } else {
      cart.push({ variantId: variant.id, quantity: 1 });
    }
    saveCart();
    renderCart();
    shopStatus.textContent = `${product.name} added to your cart.`;
  });

  const variants = product.variants;
  const colors = [...new Set(variants.map((variant) => variant.color || variant.name))];
  let selectedColor = colors.find((color) =>
    variants.some((variant) => (variant.color || variant.name) === color && variant.available)
  ) || colors[0];
  let selectedVariantId = variants.find((variant) =>
    (variant.color || variant.name) === selectedColor && variant.available
  )?.id || null;

  const colorLabel = createElement("label", "shop-option-label", "Color");
  const colorSelect = createElement("select", "shop-option-select");
  colorSelect.setAttribute("aria-label", `${product.name} color`);
  for (const color of colors) {
    const option = createElement("option");
    option.value = color;
    option.textContent = color;
    option.disabled = !variants.some((variant) =>
      (variant.color || variant.name) === color && variant.available
    );
    colorSelect.append(option);
  }
  colorSelect.value = selectedColor || "";
  colorLabel.append(colorSelect);
  form.append(colorLabel);

  const sizesForColor = () => variants.filter((variant) =>
    (variant.color || variant.name) === selectedColor
  );
  const initialSizes = sizesForColor();
  const hasSizeOptions = initialSizes.some((variant) => variant.size);
  let sizeSelect = null;
  if (hasSizeOptions) {
    const sizeLabel = createElement("label", "shop-option-label", "Size");
    sizeSelect = createElement("select", "shop-option-select");
    sizeSelect.setAttribute("aria-label", `${product.name} size`);
    sizeLabel.append(sizeSelect);
    form.append(sizeLabel);
  } else {
    const size = initialSizes.find((variant) => variant.size)?.size;
    if (size) form.append(createElement("p", "shop-size-note", `Size: ${size}`));
  }

  const addButton = createElement("button", "collection-button shop-add-button", "Add to cart");
  addButton.type = "submit";
  form.append(addButton);

  function updateSelection() {
    const colorVariants = sizesForColor();
    if (sizeSelect) {
      sizeSelect.replaceChildren();
      const sizes = [...new Set(colorVariants.map((variant) => variant.size).filter(Boolean))];
      for (const size of sizes) {
        const option = createElement("option");
        option.value = size;
        option.textContent = size;
        option.disabled = !colorVariants.some((variant) =>
          variant.size === size && variant.available
        );
        sizeSelect.append(option);
      }
      sizeSelect.value = sizes.find((size) =>
        colorVariants.some((variant) => variant.size === size && variant.available)
      ) || "";
    }

    const selectedSize = sizeSelect?.value;
    const selected = colorVariants.find((variant) =>
      variant.available && (!selectedSize || variant.size === selectedSize)
    );
    selectedVariantId = selected?.id || null;
    const displayVariant = selected || colorVariants[0];
    if (displayVariant) {
      price.textContent = formatPrice(displayVariant.price, displayVariant.currency);
      if (productImage && displayVariant.images[0]) {
        productImage.src = displayVariant.images[0];
      }
    } else {
      price.textContent = "";
    }
    addButton.disabled = !selectedVariantId || !product.available;
    if (!product.available) {
      addButton.textContent = "Sold out";
      addButton.disabled = true;
    } else {
      addButton.textContent = "Add to cart";
    }
  }

  colorSelect.addEventListener("change", () => {
    selectedColor = colorSelect.value;
    updateSelection();
  });
  sizeSelect?.addEventListener("change", updateSelection);
  updateSelection();
  details.append(form);
  card.replaceChildren(imageContainer, details);
}

function renderCart() {
  cartItemsContainer.replaceChildren();
  let subtotal = 0;
  let currency = "USD";
  let unavailableItem = false;
  let itemCount = 0;

  if (!cart.length) {
    cartItemsContainer.append(createElement("p", "", "Your cart is empty."));
  }

  for (const item of cart) {
    const product = [...shopProducts.values()].find((shopProduct) =>
      shopProduct.variants.some((variant) => variant.id === item.variantId)
    );
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    const row = createElement("div", "shop-cart-item");
    const itemDetails = createElement("div", "shop-cart-item-details");
    if (product && variant?.available) {
      itemDetails.append(createElement("strong", "", product.name));
      const options = [variant.color, variant.size].filter(Boolean).join(" · ");
      itemDetails.append(createElement("span", "", options || variant.name));
      subtotal += variant.price * item.quantity;
      currency = variant.currency;
      itemCount += item.quantity;
    } else {
      unavailableItem = true;
      itemDetails.append(createElement("strong", "", "Item no longer available"));
      itemDetails.append(createElement("span", "", "Remove it to continue."));
    }

    const quantity = createElement("span", "shop-cart-quantity", `Qty ${item.quantity}`);
    const removeButton = createElement("button", "shop-cart-remove", "Remove");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      cart = cart.filter((entry) => entry.variantId !== item.variantId);
      saveCart();
      renderCart();
    });
    row.append(itemDetails, quantity, removeButton);
    cartItemsContainer.append(row);
  }

  cartCount.textContent = `(${itemCount})`;
  cartTotal.textContent = `Subtotal: ${formatPrice(subtotal, currency)}`;
  checkoutButton.disabled = !cart.length || unavailableItem;
  if (!storageAvailable) {
    shopStatus.textContent = "Your browser does not allow saving this cart. You can still add items and check out in this visit.";
  }
}

function reconcileCartWithCatalog() {
  const availableVariants = new Map(
    [...shopProducts.values()].flatMap((product) =>
      product.variants
        .filter((variant) => product.available && variant.available)
        .map((variant) => [variant.id, variant])
    )
  );
  const previousCount = cart.length;
  cart = cart.filter((item) => {
    const variant = availableVariants.get(item.variantId);
    return variant && (variant.stock === null || item.quantity <= variant.stock);
  });
  if (cart.length !== previousCount) {
    saveCart();
    return true;
  }
  return false;
}

checkoutButton.addEventListener("click", async () => {
  checkoutButton.disabled = true;
  shopStatus.textContent = "Preparing your Fourthwall checkout…";
  try {
    const response = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(({ variantId, quantity }) => ({ variantId, quantity })),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Fourthwall checkout could not be prepared.");
    }

    const checkoutUrl = new URL(result.checkoutUrl);
    if (
      checkoutUrl.protocol !== "https:" ||
      checkoutUrl.hostname !== "logans-mission-shop.fourthwall.com" ||
      checkoutUrl.pathname !== "/checkout/"
    ) {
      throw new Error("Fourthwall returned an unexpected checkout address.");
    }
    window.location.assign(checkoutUrl.toString());
  } catch (error) {
    shopStatus.textContent = error.message;
    checkoutButton.disabled = !cart.length;
  }
});

async function loadShopCatalog() {
  try {
    const response = await fetch("/api/shop/catalog");
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "The Fourthwall product catalog could not be loaded.");
    }
    if (!Array.isArray(result.products)) {
      throw new Error("Fourthwall returned an invalid product catalog.");
    }

    for (const product of result.products) renderProduct(product);
    const removedUnavailableItems = reconcileCartWithCatalog();
    renderCart();
    shopStatus.textContent = removedUnavailableItems
      ? "An item that was no longer available was removed from your saved cart."
      : result.products.length
        ? "Product options and availability are current from Fourthwall. Payment and fulfillment happen at Fourthwall checkout."
        : "No public products are currently available in this shop.";
  } catch (error) {
    shopStatus.textContent = `${error.message} You can still browse the product cards and shop directly at Fourthwall.`;
    checkoutButton.disabled = true;
  }
}

loadShopCatalog();
