/**
 * Static SEO fallbacks on PDP shells (crawlers + no-JS); live catalog still hydrates via products.js.
 * Run: node scripts/seo-improve-pdps.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsDir = path.join(__dirname, '..', 'products');

const CATALOG = [
  { id: 'product-1', slug: 'amaru-curb-necklace-bracelet', name: 'Amaru Necklace' },
  { id: 'product-2', slug: 'inti-heavy-curb-set', name: 'Inti Heavy Set' },
  { id: 'product-3', slug: 'killa-curb-necklace', name: 'Killa Necklace' },
  { id: 'product-4', slug: 'qori-figaro-necklace', name: 'Qori Figaro Necklace' },
  { id: 'product-5', slug: 'pachamama-clover-necklace', name: 'Pachamama Clover Necklace' },
  { id: 'product-6', slug: 'inti-solar-disc-earrings', name: 'Inti Solar Disc Set' },
  { id: 'product-7', slug: 'chakana-cross-earrings', name: 'Chakana Cross Set' },
];

for (const p of CATALOG) {
  const file = path.join(productsDir, `${p.slug}.html`);
  let html = fs.readFileSync(file, 'utf8');

  html = html.replace(
    /<article class="product-detail" data-qori-product-detail data-qori-product-slug="[^"]+">/,
    `<article class="product-detail" data-qori-product-detail data-qori-product-slug="${p.slug}" data-qori-product-id="${p.id}">`,
  );
  html = html.replace(
    /<span aria-current="page" data-qori-detail-crumb>[^<]*<\/span>/,
    `<span aria-current="page" data-qori-detail-crumb>${p.name}</span>`,
  );
  html = html.replace(
    /<h1 data-qori-detail-name>[^<]*<\/h1>/,
    `<h1 data-qori-detail-name>${p.name}</h1>`,
  );

  fs.writeFileSync(file, html);
  console.log('seo fallback', p.slug);
}

export { CATALOG };
