import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'products');
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(dir, name);
  let html = fs.readFileSync(file, 'utf8');
  html = html
    .replace(/products\.js\?v=[^\s"']+/g, 'products.js?v=20260521-seo')
    .replace(/config\.js\?v=[^\s"']+/g, 'config.js?v=20260521-bg');
  fs.writeFileSync(file, html);
  console.log('bumped', name);
}
