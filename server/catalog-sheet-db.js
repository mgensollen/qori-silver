import { getSupabaseClient, inventoryUsesSupabase } from './inventory-store.js';
import { parseCatalogSheetUpsertRows, parseImages, parseSheetPrice, sheetCsvUrl } from './sheet-products.js';
import { websiteItemNameForProductId } from './item-names.js';

export async function countCatalogRows() {
  if (!inventoryUsesSupabase()) return 0;
  const sb = getSupabaseClient();
  const { count, error } = await sb.from('catalog_sheet').select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Supabase catalog_sheet count: ${error.message}`);
  return count ?? 0;
}

function catalogRowsToProducts(rows) {
  if (!rows?.length) return [];
  const typeCounts = {};
  for (const row of rows) {
    const t = row.type || '';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const seen = {};
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  return rows.map((row) => {
    const type = row.type || '';
    seen[type] = (seen[type] || 0) + 1;
    const nth = seen[type];
    const total = typeCounts[type];

    const generatedName = type === 'Chain' && total > 1
      ? `Silver Chain ${numerals[nth - 1] || nth}`
      : type === 'Chain w/ Clover' ? 'Silver Chain with Clover'
      : type;

    const nameFromDb = row.item_name != null && String(row.item_name).trim()
      ? String(row.item_name).trim()
      : '';
    const name =
      nameFromDb
      || websiteItemNameForProductId(row.site_product_id)
      || generatedName;

    const category = type.startsWith('Earring') ? 'Earrings' : 'Chains';
    const wg = row.weight_grams || '';
    const li = row.length_inches || '';
    const mat = [wg ? `${wg}g` : '', li || ''].filter(Boolean).join(' · ') || 'Sterling silver .925';

    const price =
      parseSheetPrice(row.list_price)
      || parseSheetPrice(row.total_sale_list_price)
      || parseSheetPrice(row.total_price_paid_usd)
      || 0;

    const inv = Number(row.inventory);
    const sheetStock = Number.isFinite(inv) ? Math.max(0, Math.floor(inv)) : null;

    const product = {
      id: row.site_product_id,
      name,
      item_name: row.item_name != null && String(row.item_name).trim() ? String(row.item_name).trim() : null,
      category,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      material: mat,
      images: parseImages(row.picture || ''),
    };
    if (sheetStock != null) product.sheetStock = sheetStock;
    return product;
  });
}

export async function fetchProductsFromCatalogSheet() {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('catalog_sheet')
    .select('*')
    .order('row_number', { ascending: true });
  if (error) throw new Error(`Supabase catalog_sheet read: ${error.message}`);
  return catalogRowsToProducts(data || []);
}

/**
 * Full replace/insert of catalog rows (mirrors Google Sheet + optional inventory overrides).
 * @param {Record<string, number>} [inventoryOverride] site_product_id -> qty merged from file logic
 */
export async function upsertCatalogSheetRows(rows, inventoryOverride = null) {
  const sb = getSupabaseClient();
  if (!sb || !rows?.length) return;
  const ids = [...new Set(rows.map((r) => r.site_product_id))];
  const itemNameById = {};
  if (ids.length) {
    const { data: existing, error: exErr } = await sb
      .from('catalog_sheet')
      .select('site_product_id, item_name')
      .in('site_product_id', ids);
    if (exErr) throw new Error(`Supabase catalog_sheet item_name read: ${exErr.message}`);
    for (const row of existing || []) {
      if (row?.site_product_id) itemNameById[row.site_product_id] = row.item_name;
    }
  }
  const merged = rows.map((r) => {
    const o = inventoryOverride?.[r.site_product_id];
    const inv = o != null ? Math.max(0, Math.floor(Number(o) || 0)) : r.inventory;
    const fromCsv = r.item_name != null ? String(r.item_name).trim() : '';
    const fromDb =
      itemNameById[r.site_product_id] != null ? String(itemNameById[r.site_product_id]).trim() : '';
    const trimmedExisting = fromCsv || fromDb;
    const fromSite = websiteItemNameForProductId(r.site_product_id);
    const item_name = trimmedExisting || fromSite || null;
    return { ...r, inventory: inv, item_name: item_name || null };
  });
  const { error } = await sb.from('catalog_sheet').upsert(merged, { onConflict: 'row_number' });
  if (error) throw new Error(`Supabase catalog_sheet upsert: ${error.message}`);
}

/** Fetch latest Google Sheet CSV and upsert into Supabase (prices, types, etc.). */
export async function pullCatalogFromGoogleSheet(inventoryMap) {
  const res = await fetch(sheetCsvUrl());
  if (!res.ok) throw new Error(`Sheet fetch ${res.status}`);
  const rows = parseCatalogSheetUpsertRows(await res.text());
  await upsertCatalogSheetRows(rows, inventoryMap || null);
}

export async function bootstrapCatalogFromCsv(inventoryMap) {
  return pullCatalogFromGoogleSheet(inventoryMap);
}

/**
 * Update display names (Supabase only). Keys: site_product_id.
 * @param {Record<string, string>} patch
 * @param {Set<string>} validIds
 */
export async function updateCatalogItemNames(patch, validIds) {
  if (!inventoryUsesSupabase() || !patch) return 0;
  const sb = getSupabaseClient();
  if (!sb) return 0;
  let touched = 0;
  for (const [id, raw] of Object.entries(patch)) {
    if (!validIds.has(id)) continue;
    const name = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
    const { error } = await sb.from('catalog_sheet').update({ item_name: name || null }).eq('site_product_id', id);
    if (error) throw new Error(`Supabase catalog_sheet item_name: ${error.message}`);
    touched += 1;
  }
  return touched;
}
