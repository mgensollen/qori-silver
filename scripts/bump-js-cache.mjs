/**
 * Bump cache-buster on main.js + products.js script tags.
 * Run: node scripts/bump-js-cache.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const FROM = '20260521-img';
const TO = '20260521-bg';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(p, out);
    } else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  const next = html
    .replaceAll(`js/main.js?v=${FROM}`, `js/main.js?v=${TO}`)
    .replaceAll(`js/products.js?v=${FROM}`, `js/products.js?v=${TO}`)
    .replaceAll(`../js/main.js?v=${FROM}`, `../js/main.js?v=${TO}`)
    .replaceAll(`../js/products.js?v=${FROM}`, `../js/products.js?v=${TO}`)
    .replaceAll(`css/style.css?v=${FROM}`, `css/style.css?v=${TO}`)
    .replaceAll(`../css/style.css?v=${FROM}`, `../css/style.css?v=${TO}`)
    .replaceAll(`css/style.css?v=20260519-07`, `css/style.css?v=${TO}`)
    .replaceAll(`../css/style.css?v=20260519-07`, `../css/style.css?v=${TO}`);
  if (next !== html) {
    fs.writeFileSync(file, next);
    console.log('bumped', path.relative(root, file));
  }
}
