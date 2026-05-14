/**
 * CLI / cron: Sheet → Supabase → (optional) Sheet inventory column.
 * Usage: npm run sync-catalog
 * Env: same as server (.env). Optional: SYNC_PULL=0 or SYNC_PUSH=0 to skip one side.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCatalogSync } from './catalog-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const pull = process.env.SYNC_PULL !== '0' && process.env.SYNC_PULL !== 'false';
const push = process.env.SYNC_PUSH !== '0' && process.env.SYNC_PUSH !== 'false';

try {
  const result = await runCatalogSync({ pull, push });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (e) {
  console.error(e?.message || e);
  process.exit(1);
}
