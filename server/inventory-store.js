import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let _client;

/** When set, inventory is read/written in Postgres via Supabase instead of data/inventory.json */
export function inventoryUsesSupabase() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

function getClient() {
  if (!inventoryUsesSupabase()) return null;
  if (!_client) _client = createClient(supabaseUrl, supabaseServiceKey);
  return _client;
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
 * @param {string} inventoryFilePath
 * @param {(path: string, fallback: object) => Promise<object>} readJsonFile
 */
export async function readInventoryMap(inventoryFilePath, readJsonFile) {
  if (!inventoryUsesSupabase()) {
    return readJsonFile(inventoryFilePath, {});
  }
  const sb = getClient();
  const { data, error } = await sb.from('product_inventory').select('id, quantity');
  if (error) throw new Error(`Supabase product_inventory read: ${error.message}`);
  const out = {};
  for (const row of data || []) {
    if (row && typeof row.id === 'string') {
      const q = Number(row.quantity);
      out[row.id] = Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 0;
    }
  }
  return out;
}

/**
 * @param {string} inventoryFilePath
 * @param {Record<string, number>} inventory
 * @param {(path: string, value: object) => Promise<void>} writeJsonFile
 */
export async function writeInventoryMap(inventoryFilePath, inventory, writeJsonFile) {
  if (!inventoryUsesSupabase()) {
    await writeJsonFile(inventoryFilePath, inventory);
    return;
  }
  const sb = getClient();
  const rows = Object.entries(inventory).map(([id, quantity]) => ({
    id,
    quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
  }));
  if (rows.length === 0) return;
  const { error } = await sb.from('product_inventory').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Supabase product_inventory upsert: ${error.message}`);
}
