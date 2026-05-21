/**
 * Remove stale static JSON-LD from PDP shells (hydrated by products.js).
 * Run: node scripts/strip-product-ld.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsDir = path.join(__dirname, '..', 'products');
const placeholder = '{"@context":"https://schema.org","@graph":[]}';

for (const name of fs.readdirSync(productsDir)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(productsDir, name);
  let html = fs.readFileSync(file, 'utf8');
  const re = /<script id="qori-product-ld" type="application\/ld\+json">[\s\S]*?<\/script>/;
  if (!re.test(html)) continue;
  html = html.replace(re, `<script id="qori-product-ld" type="application/ld+json">\n${placeholder}\n  </script>`);
  fs.writeFileSync(file, html);
  console.log('stripped LD', name);
}
