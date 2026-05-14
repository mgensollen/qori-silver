/**
 * Static PDP filename (no .html) per catalog site_product_id.
 * Used by /api/products for client links; keep in sync with scripts/build-product-pages.mjs.
 */
export const SITE_PRODUCT_SLUG = Object.freeze({
  'product-1': 'amaru-curb-necklace-bracelet',
  'product-2': 'inti-heavy-curb-set',
  'product-3': 'killa-curb-necklace',
  'product-4': 'qori-figaro-necklace',
  'product-5': 'pachamama-clover-necklace',
  'product-6': 'inti-solar-disc-earrings',
  'product-7': 'chakana-cross-earrings',
});

export function productSlugForSiteId(siteProductId) {
  if (typeof siteProductId !== 'string') return null;
  const id = siteProductId.trim();
  return SITE_PRODUCT_SLUG[id] || null;
}
