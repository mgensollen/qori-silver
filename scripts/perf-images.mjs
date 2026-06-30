/**
 * Performance pass: preconnect to the image host + bump asset cache versions.
 * Run: node scripts/perf-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '20260629-supa';

const PRECONNECT = [
  '<link rel="preconnect" href="https://drive.google.com" crossorigin>',
  '<link rel="dns-prefetch" href="https://drive.google.com">',
  '<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>',
  '<link rel="dns-prefetch" href="https://lh3.googleusercontent.com">',
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // 1) Add image-host preconnect right after the API preconnect (idempotent).
  if (!html.includes('href="https://drive.google.com"')) {
    const apiLine = /([ \t]*)<link rel="preconnect" href="https:\/\/qori-silver-api\.onrender\.com" crossorigin>/;
    const m = html.match(apiLine);
    if (m) {
      const indent = m[1] || '  ';
      const block = PRECONNECT.map((l) => `${indent}${l}`).join('\n');
      html = html.replace(apiLine, `${m[0]}\n${block}`);
    }
  }

  // 2) Unify cache-buster on all first-party assets.
  html = html
    .replace(/(main\.js\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(products\.js\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(config\.js\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(inventory-admin\.js\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(style\.css\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(favicon\.svg\?v=)[^\s"']+/g, `$1${VERSION}`);

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('updated', path.relative(root, file));
  }
}
