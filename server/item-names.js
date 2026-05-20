/**
 * Canonical display names from the public site (index.html featured pieces).
 * Stored in Supabase catalog_sheet.item_name and used for API / Stripe copy.
 */
export const WEBSITE_ITEM_NAMES = {
  'product-1': 'Amaru Necklace',
  'product-2': 'Inti Heavy Set',
  'product-3': 'Killa Necklace',
  'product-4': 'Qori Figaro Necklace',
  'product-5': 'Pachamama Clover Necklace',
  'product-6': 'Inti Solar Disc Set',
  'product-7': 'Chakana Cross Set',
};

export function websiteItemNameForProductId(siteProductId) {
  if (typeof siteProductId !== 'string') return '';
  return WEBSITE_ITEM_NAMES[siteProductId] || '';
}
