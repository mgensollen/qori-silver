/**
 * Add Google Analytics (analytics.js) + gtag preconnect to all public HTML pages.
 * Run: node scripts/add-analytics.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '20260629-ga';
const SKIP = new Set(['inventory.html']);

const PRECONNECT = [
  '<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>',
  '<link rel="dns-prefetch" href="https://www.googletagmanager.com">',
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

function jsPrefix(file) {
  return file.includes(`${path.sep}products${path.sep}`) ? '../js/' : 'js/';
}

for (const file of walk(root)) {
  const base = path.basename(file);
  if (SKIP.has(base)) continue;

  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const prefix = jsPrefix(file);

  if (!html.includes('googletagmanager.com')) {
    const anchor = /<meta name="viewport"[^>]*>/i;
    if (anchor.test(html)) {
      html = html.replace(anchor, (m) => `${m}\n  ${PRECONNECT.join('\n  ')}`);
    }
  }

  const configTag = `<script src="${prefix}config.js?v=${VERSION}"></script>`;
  const analyticsTag = `<script src="${prefix}analytics.js?v=${VERSION}"></script>`;

  if (!html.includes('analytics.js')) {
    if (html.includes('config.js')) {
      html = html.replace(
        new RegExp(`(<script src="${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}config\\.js\\?v=[^"]+"><\\/script>)`, 'i'),
        `$1\n  ${analyticsTag}`,
      );
    } else if (html.includes('</body>')) {
      html = html.replace('</body>', `  ${configTag}\n  ${analyticsTag}\n</body>`);
    }
  }

  html = html
    .replace(/(config\.js\?v=)[^\s"']+/g, `$1${VERSION}`)
    .replace(/(analytics\.js\?v=)[^\s"']+/g, `$1${VERSION}`);

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('updated', path.relative(root, file));
  }
}
