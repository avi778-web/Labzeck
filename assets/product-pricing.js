(function attachProductPricing(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ProductPricing = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createProductPricing() {
  const products = {
    "Brochures": { base: 4, qty: [100, 250, 500, 1000, 2500, 5000] },
    "Posters & Banners": { base: 35, qty: [1, 2, 5, 10, 50], dimensions: { unit: "ft", referenceArea: 6 } },
    "Custom Mugs": { base: 199, qty: [1, 10, 50, 100, 500] },
    "Stickers & Labels": { base: 1.49, qty: [100, 500, 1000, 5000], dimensions: { unit: "in", referenceArea: 4 } },
    "Custom T-Shirts": { base: 299, qty: [5, 10, 25, 50, 100, 500] },
    "Roll-Up Banners": { base: 1299, qty: [1, 2, 5, 10], dimensions: { unit: "ft", referenceArea: 12 } },
    "Diaries & Notebooks": { base: 299, qty: [25, 50, 100, 500] },
    "Presentation Folders": { base: 349, qty: [100, 250, 500, 1000] },
    "Canvas Printing": { base: 799, qty: [1, 2, 5, 10], dimensions: { unit: "in", referenceArea: 216 } },
    "Fancy Boxes & Packaging": { base: 499, qty: [100, 500, 1000, 5000] },
    "Custom Heat Shrink Sleeve Labels": { base: 2.5, qty: [300, 500, 1000, 5000], tierPrices: { 300: 2.5, 500: 1.8, 1000: 1.2, 5000: 0.75 }, setupFee: 50 },
    "Custom Stand-Up Zip Lock Pouches": { base: 8.5, qty: [300, 500, 1000], tierPrices: { 300: 8.5, 500: 6.8, 1000: 5.2 } },
    "Custom Branded Packaging Tape": { base: 180, qty: [24, 48, 96], tierPrices: { 24: 180, 48: 150, 96: 115 } }
  };

  function getArea(productName, values, dimensions) {
    if (!dimensions) return 1;
    const customSize = /custom/i.test(String(values.size || ""));
    let width = Number(values.customWidth);
    let height = Number(values.customHeight);
    if (!customSize) {
      const match = String(values.size || "").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (match) {
        width = Number(match[1]);
        height = Number(match[2]);
      }
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return customSize ? null : 1;
    }
    return Math.max(1, (width * height) / dimensions.referenceArea);
  }

  function calculate(productName, values = {}) {
    const config = products[productName];
    if (!config) return null;
    const quantity = Math.max(1, Math.min(9999, Math.floor(Number(values.quantity) || config.qty[0] || 1)));
    const areaMultiplier = getArea(productName, values, config.dimensions);
    if (areaMultiplier === null) return null;

    const selectedText = Object.entries(values)
      .filter(([key]) => !["quantity", "customWidth", "customHeight", "sizeBreakdown", "pricingKey"].includes(key))
      .map(([, value]) => String(value))
      .join(" ")
      .toLowerCase();
    let optionMultiplier = 1;
    if (/250 gsm|museum|luxury|metallic|gift box/.test(selectedText)) optionMultiplier += 0.35;
    if (/double|both|full wrap/.test(selectedText)) optionMultiplier += 0.25;
    const designFee = values.design === "designer" ? 199 : 0;
    const tierQuantity = [...config.qty].reverse().find((value) => quantity >= value) || config.qty[0];
    const unitPrice = config.tierPrices?.[tierQuantity] || config.base;
    const total = Math.max(1, Math.round(unitPrice * quantity * optionMultiplier * areaMultiplier + (config.setupFee || 0) + designFee));
    const referenceTotal = Math.max(1, Math.round(config.base * quantity * optionMultiplier * areaMultiplier + (config.setupFee || 0) + designFee));
    return { total, quantity, areaMultiplier, unitPrice, bulkDiscount: Math.max(0, referenceTotal - total) };
  }

  return { products, calculate };
});
