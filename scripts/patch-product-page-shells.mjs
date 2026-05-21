/**
 * One-off: replace static PDP bodies with shells hydrated by js/products.js.
 * Run: node scripts/patch-product-page-shells.mjs
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
const SLUGS = CATALOG.map((c) => c.slug);

function shell(slug) {
  const row = CATALOG.find((c) => c.slug === slug);
  const id = row?.id || '';
  const name = row?.name || 'Product';
  return `  <article class="product-detail" data-qori-product-detail data-qori-product-slug="${slug}" data-qori-product-id="${id}">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="../index.html">Home</a>
      <span aria-hidden="true"> / </span>
      <a href="../shop.html">Shop</a>
      <span aria-hidden="true"> / </span>
      <span aria-current="page" data-qori-detail-crumb>${name}</span>
    </nav>
    <div class="product-detail__grid">
      <div class="product-detail__gallery" data-qori-detail-gallery>
        <p class="muted" style="padding:3rem 1rem;text-align:center">Loading…</p>
      </div>
      <div class="product-detail__body">
        <h1 data-qori-detail-name>${name}</h1>
        <p class="product-detail__meta" data-qori-detail-meta></p>
        <p class="product-detail__price" data-qori-detail-price></p>
        <p class="piece-mat product-detail__mat" data-qori-detail-mat></p>
        <div class="product-detail__actions">
          <button class="btn-primary piece-add" type="button" data-add-to-cart disabled>Add to cart</button>
          <a class="product-detail__back" href="../shop.html">← All pieces</a>
        </div>
      </div>
    </div>
  </article>`;
}

for (const slug of SLUGS) {
  const file = path.join(productsDir, `${slug}.html`);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<article class="product-detail"[\s\S]*?<\/article>/, shell(slug));
  html = html.replace(
    /\s*<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>\s*/g,
    '\n',
  );
  if (!html.includes('id="qori-product-ld"')) {
    html = html.replace(
      /<script type="application\/ld\+json">/,
      '<script id="qori-product-ld" type="application/ld+json">',
    );
  }
  fs.writeFileSync(file, html);
  console.log('patched', slug);
}
