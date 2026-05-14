/* ──────────────────────────────────────────
   QORI SILVER — Product grids from /api/products
   Order matches Supabase catalog_sheet (row_number). IDs + inventory match the table.
   ────────────────────────────────────────── */

const CAT_COLOR = {
  Chains: 'var(--teal-lt)',
  Earrings: 'var(--cobalt-lt)',
};

const PLACEHOLDER_SVG = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="none">
  <rect width="240" height="240" fill="#221D16"/>
  <circle cx="120" cy="120" r="78" stroke="#C9A84C" stroke-width="1.5" opacity=".35"/>
  <circle cx="120" cy="120" r="50" stroke="#1D8A7A" stroke-width="1" opacity=".25"/>
  <text x="120" y="128" text-anchor="middle" font-size="13" fill="#C9A84C" opacity=".45" font-family="serif" letter-spacing="3">QORI</text>
</svg>`;

const CANONICAL_ORIGIN = 'https://www.qorisilver.com';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPrice(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '$0.00';
  return `$${x.toFixed(2)}`;
}

function buildPieceCarousel(p) {
  const imgs = p.images || [];
  const alt = esc(p.name);

  if (imgs.length === 0) {
    return `<div class="piece-img" data-carousel style="">${PLACEHOLDER_SVG}</div>`;
  }

  if (imgs.length === 1) {
    return `<div class="piece-img" data-carousel style="">
      <div class="carousel-track">
        <div class="carousel-slide"><img src="${esc(imgs[0])}" alt="${alt}" loading="eager"></div>
      </div>
      <button class="carousel-prev" aria-label="Previous">&#8249;</button>
      <button class="carousel-next" aria-label="Next">&#8250;</button>
      <div class="carousel-dots"><button class="carousel-dot active" aria-label="Photo 1"></button></div>
    </div>`;
  }

  const slides = imgs.map((url, i) => `
            <div class="carousel-slide"><img src="${esc(url)}" alt="${alt}" loading="${i === 0 ? 'eager' : 'lazy'}"></div>`).join('');

  const dots = imgs.map((_, i) =>
    `            <button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Photo ${i + 1}"></button>`,
  ).join('\n');

  return `<div class="piece-img" data-carousel style="">
          <div class="carousel-track">
${slides}
          </div>
          <button class="carousel-prev" aria-label="Previous">&#8249;</button>
          <button class="carousel-next" aria-label="Next">&#8250;</button>
          <div class="carousel-dots">
${dots}
          </div>
        </div>`;
}

function buildPieceCard(p, linkBase) {
  const base = (linkBase || 'products/').replace(/\/?$/, '/');
  const slug = typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : '';
  const nameHtml = slug
    ? `<div class="piece-name"><a class="piece-name-link" href="${esc(base)}${esc(slug)}.html">${esc(p.name)}</a></div>`
    : `<div class="piece-name">${esc(p.name)}</div>`;
  const catColor = CAT_COLOR[p.category] || 'var(--gold)';
  const price = formatPrice(p.price);
  const mat = esc(p.material || '');

  return `
      <div class="piece">
        ${buildPieceCarousel(p)}
        <div class="piece-cat" style="color:${catColor}">${esc(p.category || '')}</div>
        ${nameHtml}
        <div class="piece-price">${price}</div>
        <div class="piece-mat">${mat}</div>
        <button class="piece-add" type="button"
          data-add-to-cart
          data-product-id="${esc(p.id)}"
          data-product-name="${esc(p.name)}"
          data-product-price="${Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : '0.00'}"
        >Add to cart</button>
      </div>`;
}

function initCarousels(container) {
  if (!container) return;

  container.querySelectorAll('[data-carousel]').forEach((el) => {
    const track = el.querySelector('.carousel-track');
    const slides = el.querySelectorAll('.carousel-slide');
    const dots = el.querySelectorAll('.carousel-dot');
    const total = slides.length;
    if (!track || total === 0) return;

    let cur = 0;

    function go(n) {
      cur = ((n % total) + total) % total;
      track.style.transform = `translateX(-${cur * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    }

    el.querySelector('.carousel-prev')?.addEventListener('click', (e) => { e.stopPropagation(); go(cur - 1); });
    el.querySelector('.carousel-next')?.addEventListener('click', (e) => { e.stopPropagation(); go(cur + 1); });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));

    let tx = 0;
    let ty = 0;
    el.addEventListener('touchstart', (e) => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        go(cur + (dx < 0 ? 1 : -1));
      }
    });
  });
}

function applyShopItemListLd(products) {
  const el = document.getElementById('qori-shop-itemlist-ld');
  if (!el || !Array.isArray(products)) return;

  const itemListElement = products.map((p, i) => {
    const slug = typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : '';
    const pdp = slug ? `${CANONICAL_ORIGIN}/products/${slug}.html` : `${CANONICAL_ORIGIN}/shop.html`;
    const desc = [p.material, p.category ? `${p.category} · Qori Silver` : 'Qori Silver'].filter(Boolean).join(' · ');
    const priceStr = Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : '0.00';
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        url: pdp,
        description: desc.slice(0, 500),
        brand: { '@type': 'Brand', name: 'Qori Silver' },
        material: 'Sterling Silver .95',
        offers: {
          '@type': 'Offer',
          price: priceStr,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: pdp,
        },
      },
    };
  });

  const doc = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Handcrafted Peruvian Sterling Silver Jewelry',
    url: `${CANONICAL_ORIGIN}/shop.html`,
    itemListElement,
  };
  el.textContent = JSON.stringify(doc);
}

function applyHomeCollectionItemListLd(products) {
  const el = document.getElementById('qori-site-ld-graph');
  if (!el || !Array.isArray(products)) return;
  try {
    const doc = JSON.parse(el.textContent);
    const graph = doc['@graph'];
    if (!Array.isArray(graph)) return;
    const page = graph.find((x) => x && x['@type'] === 'CollectionPage');
    if (!page?.mainEntity || page.mainEntity['@type'] !== 'ItemList') return;
    page.mainEntity.numberOfItems = products.length;
    page.mainEntity.itemListElement = products.map((p, i) => {
      const slug = typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : '';
      const url = slug ? `${CANONICAL_ORIGIN}/products/${slug}.html` : `${CANONICAL_ORIGIN}/shop.html`;
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        item: url,
      };
    });
    el.textContent = JSON.stringify(doc);
  } catch {
    /* keep static LD if parse fails */
  }
}

async function hydrateProductGrid(grid) {
  const apiBase = (window.QORI_API_BASE || '').replace(/\/$/, '');
  const linkBase = (grid.getAttribute('data-qori-product-link-base') || 'products/').trim() || 'products/';

  try {
    const res = await fetch(`${apiBase}/api/products`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();

    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">No products available right now.</p>';
      return;
    }

    grid.innerHTML = products.map((p) => buildPieceCard(p, linkBase)).join('\n');
    grid.dataset.qoriProductsReady = '1';

    initCarousels(grid);
    document.dispatchEvent(new CustomEvent('qori:shop-products-rendered'));

    applyShopItemListLd(products);
    applyHomeCollectionItemListLd(products);
  } catch (err) {
    console.error('Product grid load failed:', err);
    grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">Could not load products — please refresh.</p>';
  }
}

function initProductGrids() {
  document.querySelectorAll('[data-qori-products]').forEach((grid) => {
    hydrateProductGrid(grid);
  });
}

initProductGrids();
