/**
 * Move catalog images from Google Drive to Supabase Storage, using the
 * Drive URLs already stored in catalog_sheet.picture.
 *
 * For each image it uploads several width variants (pulled straight from
 * Drive at each size) named  <product-id>/<n>-<width>.jpg  e.g.
 *   product-1/1-400.jpg, product-1/1-800.jpg, product-1/1-1200.jpg, product-1/1-1600.jpg
 * and stores the 1200px URL in `picture`. The frontend builds a responsive
 * srcset by swapping the width in the filename - no paid image transforms needed.
 *
 * Already-migrated rows (non-Drive URLs) are left untouched, so re-running is safe.
 * Use --dry-run first to preview without writing anything.
 *
 * Usage:
 *   node server/migrate-images-to-supabase.mjs --dry-run
 *   node server/migrate-images-to-supabase.mjs
 *   node server/migrate-images-to-supabase.mjs --bucket=product-images
 *
 * Env (.env): SUPABASE_URL (or SUPABASE_PROJECT_REF) + SUPABASE_SERVICE_ROLE_KEY
 */
import dotenv from 'dotenv';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseClient, inventoryUsesSupabase } from './inventory-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BUCKET = (args.find((a) => a.startsWith('--bucket='))?.split('=')[1] || 'product-images').trim();

// Width variants to generate. MUST match SUPABASE_WIDTHS in js/products.js.
const WIDTHS = [400, 800, 1200, 1600];
const CANONICAL_W = 1200; // URL stored in the picture column (used for OG + fallback)

function driveFileId(url) {
  if (!url) return null;
  const byPath = url.match(/\/(?:file\/)?d\/([^/?]+)/); // .../file/d/<id>/...  or .../d/<id>
  if (byPath?.[1]) return byPath[1];
  const byQuery = url.match(/[?&]id=([^&]+)/); // ...?id=<id>  or ...thumbnail?id=<id>
  if (byQuery?.[1]) return byQuery[1];
  return null;
}

function isAlreadyHosted(url) {
  return /\.supabase\.co\/storage\//i.test(url) || /res\.cloudinary\.com\//i.test(url);
}

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 qori-migrate' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 6) {
          res.resume();
          return resolve(download(res.headers.location, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }));
      })
      .on('error', reject);
  });
}

function extFor(contentType) {
  if (/png/i.test(contentType)) return 'png';
  if (/webp/i.test(contentType)) return 'webp';
  if (/gif/i.test(contentType)) return 'gif';
  return 'jpg';
}

async function ensureBucket(sb) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket: ${error.message}`);
  console.log(`Created public bucket "${BUCKET}"`);
}

/** Upload every width variant for one source image. Returns the canonical public URL. */
async function migrateOneImage(sb, fileId, productId, index) {
  let canonicalUrl = null;
  for (const w of WIDTHS) {
    const sourceUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${w}`;
    const { buffer, contentType } = await download(sourceUrl);
    const ext = extFor(contentType);
    const objectPath = `${productId}/${index}-${w}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    if (w === CANONICAL_W) canonicalUrl = publicUrl;
    console.log(`  ${productId} #${index} @${w}px: ${Math.round(buffer.length / 1024)}KB`);
  }
  return canonicalUrl;
}

async function main() {
  if (!inventoryUsesSupabase()) {
    console.error('Supabase is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  const sb = getSupabaseClient();
  if (!DRY_RUN) await ensureBucket(sb);

  const { data: rows, error } = await sb
    .from('catalog_sheet')
    .select('row_number, site_product_id, picture')
    .order('row_number', { ascending: true });
  if (error) throw new Error(`read catalog_sheet: ${error.message}`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows || []) {
    const id = String(row.site_product_id || '').trim();
    const urls = String(row.picture || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (!id || urls.length === 0) {
      skipped++;
      continue;
    }

    const newUrls = [];
    let changed = false;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const n = i + 1;
      if (isAlreadyHosted(url)) {
        newUrls.push(url);
        continue;
      }
      const fileId = driveFileId(url);
      if (!fileId) {
        newUrls.push(url); // unknown URL - keep rather than lose it
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry-run] ${id} #${n}: would upload ${WIDTHS.join('/')}px from Drive ${fileId}`);
        newUrls.push(`<supabase:${BUCKET}/${id}/${n}-${CANONICAL_W}.jpg>`);
        changed = true;
        continue;
      }

      try {
        const canonicalUrl = await migrateOneImage(sb, fileId, id, n);
        newUrls.push(canonicalUrl || url);
        changed = true;
      } catch (e) {
        console.warn(`  ${id} #${n}: FAILED (${e.message}) - keeping original URL`);
        newUrls.push(url);
      }
    }

    if (changed && !DRY_RUN) {
      const { error: updErr } = await sb
        .from('catalog_sheet')
        .update({ picture: newUrls.join(', ') })
        .eq('row_number', row.row_number);
      if (updErr) {
        console.warn(`${id}: column update FAILED (${updErr.message})`);
      } else {
        migrated++;
        console.log(`${id}: picture -> ${newUrls.join(', ')}`);
      }
    } else if (changed && DRY_RUN) {
      console.log(`[dry-run] ${id}: new picture = ${newUrls.join(', ')}`);
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Rows changed: ${migrated}, unchanged: ${skipped}. Bucket: ${BUCKET}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
