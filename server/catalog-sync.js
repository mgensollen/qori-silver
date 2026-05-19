import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { inventoryUsesSupabase, readInventoryMap } from './inventory-store.js';
import { pullCatalogFromGoogleSheet } from './catalog-sheet-db.js';
import { pushInventoryToGoogleSheet } from './google-sheet-outbound.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inventoryFile = path.join(repoRoot, 'data', 'inventory.json');

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e?.code === 'ENOENT') return fallbackValue;
    throw e;
  }
}

/**
 * Google Sheet -> Supabase. Keeps current Supabase inventory (and merged item_name logic in upsert).
 */
export async function runPullCatalogFromGoogleSheet() {
  if (!inventoryUsesSupabase()) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for catalog sync.');
  }
  const map = await readInventoryMap(inventoryFile, readJsonFile);
  await pullCatalogFromGoogleSheet(map);
}

/**
 * Supabase -> Google Sheet inventory column (requires GOOGLE_SERVICE_ACCOUNT_JSON).
 */
export async function runPushInventoryToGoogleSheet() {
  return pushInventoryToGoogleSheet();
}

/**
 * @param {{ pull?: boolean, push?: boolean }} opts
 */
export async function runCatalogSync(opts = {}) {
  const pull = opts.pull !== false;
  const push = opts.push !== false;
  const out = { pull: false, push: false, pushSkipped: null };

  if (pull) {
    await runPullCatalogFromGoogleSheet();
    out.pull = true;
  }

  if (push) {
    if (!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()) {
      out.pushSkipped = 'GOOGLE_SERVICE_ACCOUNT_JSON not set';
    } else {
      const r = await runPushInventoryToGoogleSheet();
      out.push = true;
      out.pushResult = r;
    }
  }

  return out;
}
