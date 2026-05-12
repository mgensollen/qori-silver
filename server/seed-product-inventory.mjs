#!/usr/bin/env node
/**
 * Fetches the Google Sheet catalog, merges inventory (DB + sheet defaults),
 * and upserts every product row into Supabase product_inventory.
 *
 * Usage (from repo root, with .env containing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   npm run seed-inventory
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const { parseProducts, sheetCsvUrl } = await import('./sheet-products.js');
const { mapInventoryForProducts } = await import('./inventory-merge.js');
const { inventoryUsesSupabase, readInventoryMap, writeInventoryMap } = await import('./inventory-store.js');

const inventoryFile = path.join(projectRoot, 'data', 'inventory.json');

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function noopWriteJson() {}

async function main() {
  if (!inventoryUsesSupabase()) {
    console.error(
      'Missing Supabase env. In .env at repo root set SUPABASE_SERVICE_ROLE_KEY and either SUPABASE_URL (https://xxx.supabase.co) or SUPABASE_PROJECT_REF (xxx).',
    );
    console.error(`(looked for .env at ${path.join(projectRoot, '.env')})`);
    process.exit(1);
  }

  const url = sheetCsvUrl();
  console.log('Fetching sheet:', url);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Sheet HTTP ${res.status}`);
    process.exit(1);
  }
  const products = parseProducts(await res.text());
  if (!products.length) {
    console.error('No products parsed from CSV.');
    process.exit(1);
  }

  const current = await readInventoryMap(inventoryFile, readJsonFile);
  const inventory = mapInventoryForProducts(products, current);
  await writeInventoryMap(inventoryFile, inventory, noopWriteJson);

  console.log(`Upserted ${Object.keys(inventory).length} rows into product_inventory.`);
  for (const p of products) {
    console.log(`  ${p.id}\t${inventory[p.id]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
