#!/usr/bin/env node
/**
 * Imports the Google Sheet CSV into Supabase public.catalog_sheet (full column mirror).
 * Merges quantities with existing DB values when present (same rules as the live server).
 *
 * Usage (repo root .env with Supabase keys):
 *   npm run seed-inventory
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, 'js', '.env') });

const { parseProducts, sheetCsvUrl } = await import('./sheet-products.js');
const { mapInventoryForProducts } = await import('./inventory-merge.js');
const { inventoryUsesSupabase, readInventoryMap } = await import('./inventory-store.js');
const { bootstrapCatalogFromCsv, fetchProductsFromCatalogSheet } = await import('./catalog-sheet-db.js');

const inventoryFile = path.join(projectRoot, 'data', 'inventory.json');

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function main() {
  if (!inventoryUsesSupabase()) {
    console.error(
      'Missing Supabase env. In .env at repo root set SUPABASE_SERVICE_ROLE_KEY and either SUPABASE_URL or SUPABASE_PROJECT_REF.',
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

  let current = {};
  try {
    current = await readInventoryMap(inventoryFile, readJsonFile);
  } catch {
    /* catalog_sheet may not exist yet — treat as empty inventory map */
  }
  const inventory = mapInventoryForProducts(products, current);
  await bootstrapCatalogFromCsv(inventory);

  const rows = await fetchProductsFromCatalogSheet();
  console.log(`Upserted catalog_sheet (${rows.length} rows).`);
  for (const p of rows) {
    console.log(`  ${p.id}\tinv=${p.sheetStock ?? '?'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
