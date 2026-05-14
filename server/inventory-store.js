import { createClient } from '@supabase/supabase-js';

let _client;

function supabaseUrl() {
  let u = (process.env.SUPABASE_URL || '').trim();
  if (u) {
    u = u.replace(/\/?rest\/v1\/?.*$/i, '').replace(/\/$/, '');
    return u;
  }
  const ref = (process.env.SUPABASE_PROJECT_REF || '').trim();
  if (!ref) return '';
  const host = ref.replace(/^https?:\/\//i, '').replace(/\.supabase\.co\/?.*$/i, '').split('/')[0].trim();
  if (!host || host.includes('.')) return '';
  return `https://${host}.supabase.co`;
}

function supabaseServiceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function inventoryUsesSupabase() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

function getClient() {
  if (!inventoryUsesSupabase()) return null;
  if (!_client) _client = createClient(supabaseUrl(), supabaseServiceKey());
  return _client;
}

export function getSupabaseClient() {
  return getClient();
}

export function inventoryStateEquals(a, b) {
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].sort();
  for (const k of keys) {
    const x = Number((a || {})[k]);
    const y = Number((b || {})[k]);
    if (!Number.isFinite(x) && !Number.isFinite(y)) continue;
    if (x !== y) return false;
  }
  return true;
}

/**
 * Read inventory from Supabase.
 * Tries catalog_sheet first (current schema), falls back to product_inventory (legacy).
 */
export async function readInventoryMap(inventoryFilePath, readJsonFile) {
  if (!inventoryUsesSupabase()) {
    return readJsonFile(inventoryFilePath, {});
  }
  const sb = getClient();

  // ── Try catalog_sheet (site_product_id, inventory) ──────────────────────
  try {
    const { data, error } = await sb
      .from('catalog_sheet')
      .select('site_product_id, inventory');
    if (!error && data?.length) {
      const out = {};
      for (const row of data) {
        if (row?.site_product_id) {
          const q = Number(row.inventory);
          out[row.site_product_id] = Number.isFinite(q) && q >= 0 ? Math.floor(q) : 0;
        }
      }
      if (Object.keys(out).length > 0) return out;
    }
  } catch (e) {
    console.warn('inventory-store: catalog_sheet read failed:', e?.message);
  }

  // ── Fall back to product_inventory (id, quantity) ────────────────────────
  try {
    const { data, error } = await sb
      .from('product_inventory')
      .select('id, quantity');
    if (!error && data?.length) {
      const out = {};
      for (const row of data) {
        if (row?.id) {
          const q = Number(row.quantity);
          out[row.id] = Number.isFinite(q) && q >= 0 ? Math.floor(q) : 0;
        }
      }
      console.log(`inventory-store: read ${Object.keys(out).length} rows from product_inventory (legacy)`);
      return out;
    }
  } catch (e) {
    console.warn('inventory-store: product_inventory read failed:', e?.message);
  }

  // ── Last resort: local file ──────────────────────────────────────────────
  console.warn('inventory-store: Supabase reads failed, falling back to local file');
  return readJsonFile(inventoryFilePath, {});
}

/**
 * Write updated inventory back to Supabase.
 * Mirrors the same priority: catalog_sheet → product_inventory → file.
 */
export async function writeInventoryMap(inventoryFilePath, inventory, writeJsonFile) {
  if (!inventoryUsesSupabase()) {
    await writeJsonFile(inventoryFilePath, inventory);
    return;
  }
  const sb = getClient();
  const entries = Object.entries(inventory);
  if (!entries.length) return;

  // ── Try catalog_sheet ────────────────────────────────────────────────────
  try {
    const { count, error: cntErr } = await sb
      .from('catalog_sheet')
      .select('*', { count: 'exact', head: true });
    if (!cntErr && count > 0) {
      for (const [site_product_id, inv] of entries) {
        const qty = Math.max(0, Math.floor(Number(inv) || 0));
        const { error } = await sb
          .from('catalog_sheet')
          .update({ inventory: qty })
          .eq('site_product_id', site_product_id);
        if (error) console.warn(`catalog_sheet update ${site_product_id}:`, error.message);
      }
      return;
    }
  } catch (e) {
    console.warn('inventory-store: catalog_sheet write failed:', e?.message);
  }

  // ── Fall back to product_inventory ───────────────────────────────────────
  try {
    for (const [id, qty] of entries) {
      const q = Math.max(0, Math.floor(Number(qty) || 0));
      const { error } = await sb
        .from('product_inventory')
        .upsert(
          { id, quantity: q, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) console.warn(`product_inventory upsert ${id}:`, error.message);
    }
    return;
  } catch (e) {
    console.warn('inventory-store: product_inventory write failed:', e?.message);
  }

  // ── Last resort ──────────────────────────────────────────────────────────
  await writeJsonFile(inventoryFilePath, inventory);
}

/**
 * Atomically decrement inventory for one product using a Supabase RPC (migration 004).
 * Falls back to read-modify-write if the RPC is not yet deployed.
 * Returns the new quantity, or null on failure.
 */
export async function decrementInventoryItem(siteProductId, qty = 1) {
  if (!inventoryUsesSupabase()) return null;
  const sb = getClient();
  const safeQty = Math.max(1, Math.floor(Number(qty) || 1));

  // ── Try atomic RPC on catalog_sheet ─────────────────────────────────────
  try {
    const { error } = await sb.rpc('decrement_catalog_inventory', {
      p_id: siteProductId,
      p_qty: safeQty,
    });
    if (!error) {
      const { data } = await sb
        .from('catalog_sheet')
        .select('inventory')
        .eq('site_product_id', siteProductId)
        .single();
      return data?.inventory ?? null;
    }
  } catch {}

  // ── Try atomic RPC on product_inventory (legacy) ─────────────────────────
  try {
    const { error } = await sb.rpc('decrement_product_inventory', {
      p_id: siteProductId,
      p_qty: safeQty,
    });
    if (!error) {
      const { data } = await sb
        .from('product_inventory')
        .select('quantity')
        .eq('id', siteProductId)
        .single();
      return data?.quantity ?? null;
    }
  } catch {}

  return null; // caller falls back to JS read-modify-write
}
