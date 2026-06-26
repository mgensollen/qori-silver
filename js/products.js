/* --
   QORI SILVER - Product grids from /api/products
   Order matches Supabase catalog_sheet (row_number). IDs + inventory match the table.
   -- */

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

/* Responsive image helpers - keep Drive bytes proportional to render size. */
const GRID_IMG_SIZES = '(max-width: 600px) 92vw, (max-width: 1000px) 46vw, 30vw';
const DETAIL_IMG_SIZES = '(max-width: 768px) 92vw, 46vw';

function isDriveThumb(url) {
  return /drive\.google\.com\/thumbnail/i.test(String(url));
}

function driveAtSize(url, w) {
  if (/([?&])sz=w\d+/i.test(url)) return url.replace(/([?&])sz=w\d+/i, `$1sz=w${w}`);
  return `${url}${url.includes('?') ? '&' : '?'}sz=w${w}`;
}

/**
 * Build an <img> tag. Only the LCP image (first slide of the first card / PDP hero)
 * loads eagerly with high priority; everything else is lazy so first paint stays fast.
 */
function imgMarkup(url, alt, { lcp, sizes, widths, baseW, defer }) {
  let src = url;
  let set = '';
  if (isDriveThumb(url)) {
    src = driveAtSize(url, baseW);
    set = widths.map((w) => `${driveAtSize(url, w)} ${w}w`).join(', ');
  }
  // Deferred (non-visible carousel) slides hold their URLs in data-* and are
  // hydrated on first interaction - they never fetch on initial page load.
  if (defer) {
    const ss = set ? ` data-srcset="${esc(set)}" sizes="${sizes}"` : '';
    return `<img data-src="${esc(src)}"${ss} alt="${alt}" loading="lazy" decoding="async" width="800" height="800">`;
  }
  const ss = set ? ` srcset="${esc(set)}" sizes="${sizes}"` : '';
  const loading = lcp ? 'eager' : 'lazy';
  const priority = lcp ? ' fetchpriority="high"' : '';
  return `<img src="${esc(src)}"${ss} alt="${alt}" loading="${loading}"${priority} decoding="async" width="800" height="800">`;
}

function buildPieceCarousel(p, opts = {}) {
  const detail = opts.context === 'detail';
  const sizes = detail ? DETAIL_IMG_SIZES : GRID_IMG_SIZES;
  const baseW = detail ? 800 : 400;
  const widths = detail ? [400, 600, 800, 1200] : [300, 400, 600, 800];
  const imgs = p.images || [];
  const alt = esc(p.name);

  // First slide of the first card (or the PDP hero) is the LCP candidate.
  // Remaining slides are deferred until the shopper interacts with the carousel.
  const first = (url) => imgMarkup(url, alt, { lcp: !!opts.lcp, sizes, widths, baseW });
  const rest = (url) => imgMarkup(url, alt, { lcp: false, sizes, widths, baseW, defer: true });

  if (imgs.length === 0) {
    return `<div class="piece-img" data-carousel style="">${PLACEHOLDER_SVG}</div>`;
  }

  if (imgs.length === 1) {
    return `<div class="piece-img" data-carousel style="">
      <div class="carousel-track">
        <div class="carousel-slide">${first(imgs[0])}</div>
      </div>
      <button class="carousel-prev" aria-label="Previous">&#8249;</button>
      <button class="carousel-next" aria-label="Next">&#8250;</button>
      <div class="carousel-dots"><button class="carousel-dot active" aria-label="Photo 1"></button></div>
    </div>`;
  }

  const slides = imgs.map((url, i) => `
            <div class="carousel-slide" style="left:${i * 100}%">${i === 0 ? first(url) : rest(url)}</div>`).join('');

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

function productHref(p, linkBase) {
  const base = (linkBase || 'products/').replace(/\/?$/, '/');
  const slug = productSlug(p);
  if (!slug) return '';
  const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : '';
  const qs = id ? `?id=${encodeURIComponent(id)}` : '';
  return `${base}${slug}.html${qs}`;
}

function buildPieceCard(p, linkBase, lcp) {
  const href = productHref(p, linkBase);
  const nameHtml = href
    ? `<div class="piece-name"><a class="piece-name-link" href="${esc(href)}">${esc(p.name)}</a></div>`
    : `<div class="piece-name">${esc(p.name)}</div>`;
  const catColor = CAT_COLOR[p.category] || 'var(--gold)';
  const price = formatPrice(p.price);
  const mat = esc(p.material || '');

  // Set sold-out state directly from the API inventory value at render time.
  // This means the correct state is visible immediately - no async JS required.
  const invNum = Number(p.inventory);
  const soldOut = Number.isFinite(invNum) && invNum <= 0;

  return `
      <div class="piece${soldOut ? ' is-soldout' : ''}">
        ${buildPieceCarousel(p, { context: 'grid', lcp: !!lcp })}
        <div class="piece-cat" style="color:${catColor}">${esc(p.category || '')}</div>
        ${nameHtml}
        <div class="piece-price">${price}</div>
        <div class="piece-mat">${mat}</div>
        ${soldOut ? `<div class="soldout-note"><span class="soldout-dot"></span>Sold out</div>` : ''}
        <button class="piece-add" type="button"
          data-add-to-cart
          data-product-id="${esc(p.id)}"
          data-product-name="${esc(p.name)}"
          data-product-price="${Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : '0.00'}"
          ${soldOut ? 'disabled' : ''}
        >${soldOut ? 'Unavailable' : 'Add to cart'}</button>
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

    // Swap deferred slide images (data-src -> src) only when needed.
    function hydrate(i) {
      const s = slides[((i % total) + total) % total];
      if (!s) return;
      s.querySelectorAll('img[data-src]').forEach((img) => {
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      });
    }
    function hydrateAll() {
      for (let i = 0; i < total; i++) hydrate(i);
    }
    // Preload the rest as soon as the shopper shows intent to browse this piece.
    el.addEventListener('pointerenter', hydrateAll, { once: true });
    el.addEventListener('touchstart', hydrateAll, { once: true, passive: true });

    // Force slide heights to match the container in pixels.
    // CSS percentage-height chains are unreliable on iOS Safari - reading
    // offsetHeight gives the real rendered pixel value with no ambiguity.
    function syncHeights() {
      const h = el.offsetHeight;
      if (h > 0) slides.forEach((s) => { s.style.height = h + 'px'; });
    }
    syncHeights();
    window.addEventListener('resize', syncHeights, { passive: true });

    let cur = 0;

    function go(n) {
      cur = ((n % total) + total) % total;
      hydrate(cur);
      hydrate(cur + 1);
      hydrate(cur - 1);
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
    const desc = [p.material, p.category ? `${p.category}  Qori Silver` : 'Qori Silver'].filter(Boolean).join('  ');
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

/* -- Shared product catalog (homepage grid + product pages) -- */
const PRODUCTS_CACHE_KEY = 'qori_products_v2';
const SELECTED_PRODUCT_KEY = 'qori_selected_product_v1';
const PRODUCTS_CACHE_TTL = 5 * 60 * 1000; // 5 min
let catalogFetchPromise = null;

function readProductsCache() {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const { at, products } = JSON.parse(raw);
    if (!Array.isArray(products) || Date.now() - at > PRODUCTS_CACHE_TTL) return null;
    return products;
  } catch { return null; }
}

function writeProductsCache(products) {
  try { localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ at: Date.now(), products })); } catch {}
}

function notifyProductsReady(products) {
  document.dispatchEvent(new CustomEvent('qori:shop-products-rendered', { detail: { products } }));
}

async function fetchProductsFromApi() {
  const apiBase = (window.QORI_API_BASE || '').replace(/\/$/, '');
  const res = await fetch(`${apiBase}/api/products`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const products = await res.json();
  if (!Array.isArray(products)) throw new Error('Invalid products payload');
  return products;
}

/** One in-flight request; returns cache immediately when available (SWR). */
async function loadProductsCatalog() {
  const cached = readProductsCache();

  const runFetch = () => {
    if (!catalogFetchPromise) {
      catalogFetchPromise = fetchProductsFromApi()
        .then((products) => {
          writeProductsCache(products);
          return products;
        })
        .finally(() => { catalogFetchPromise = null; });
    }
    return catalogFetchPromise;
  };

  if (cached?.length) {
    runFetch()
      .then((fresh) => {
        if (JSON.stringify(cached) !== JSON.stringify(fresh)) {
          document.dispatchEvent(new CustomEvent('qori:products-catalog-changed', { detail: { products: fresh } }));
        }
      })
      .catch((err) => console.error('Product catalog refresh failed:', err));
    return cached;
  }

  return runFetch();
}

function slugFromPagePath() {
  const m = (window.location.pathname || '').match(/\/([^/]+)\.html$/i);
  return m ? m[1] : '';
}

function productSlug(p) {
  return typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : '';
}

function resolveDetailTarget(root) {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || root.getAttribute('data-qori-product-id') || '').trim();
  const slugAttr = (root.getAttribute('data-qori-product-slug') || '').trim();
  const slug = slugAttr || slugFromPagePath();
  return { id, slug };
}

function applyProductDetailMeta(p) {
  if (!p) return;
  const title = `${p.name} | Qori Silver`;
  const desc = `${p.name} — ${p.material || 'Handcrafted Peruvian sterling .95'} · Qori Silver. Free worldwide shipping.`;
  document.title = `${p.name} | Qori Silver — Peruvian Sterling Silver Jewelry`;

  [
    ['name', 'description', desc],
    ['property', 'og:title', title],
    ['property', 'og:description', desc.slice(0, 300)],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', desc.slice(0, 300)],
  ].forEach(([attr, key, val]) => {
    const el = document.querySelector(`meta[${attr}="${key}"]`);
    if (el && val) el.setAttribute('content', val);
  });

  const img = (p.images || [])[0];
  if (img) {
    const ogUrl = img.includes('sz=w') ? img.replace(/sz=w\d+/i, 'sz=w1200') : img;
    const og = document.querySelector('meta[property="og:image"]');
    const tw = document.querySelector('meta[name="twitter:image"]');
    if (og) og.setAttribute('content', ogUrl);
    if (tw) tw.setAttribute('content', ogUrl);
  }
}

function findProductForDetail(products, { id, slug }) {
  if (!Array.isArray(products)) return null;
  if (id) {
    const byId = products.find((x) => x.id === id);
    if (byId) return byId;
  }
  if (slug) return products.find((x) => productSlug(x) === slug) || null;
  return null;
}

function saveSelectedProduct(p) {
  try { sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(p)); } catch {}
}

function readSelectedProduct(id, slug) {
  try {
    const raw = sessionStorage.getItem(SELECTED_PRODUCT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    if (id && p.id === id) return p;
    if (slug && productSlug(p) === slug) return p;
    return null;
  } catch { return null; }
}

function wireGridProductLinks(grid, products) {
  grid.querySelectorAll('.piece').forEach((piece) => {
    const btn = piece.querySelector('[data-add-to-cart]');
    const id = btn?.getAttribute('data-product-id')?.trim();
    if (!id) return;
    const p = products.find((x) => x.id === id);
    if (!p) return;
    piece.querySelectorAll('a.piece-name-link').forEach((a) => {
      a.addEventListener('click', () => saveSelectedProduct(p));
    });
  });
}

function applyProductDetailLd(p) {
  const el = document.getElementById('qori-product-ld');
  if (!el || !p) return;
  const slug = productSlug(p);
  const pageUrl = slug ? `${CANONICAL_ORIGIN}/products/${slug}.html` : `${CANONICAL_ORIGIN}/shop.html`;
  const imgs = (p.images || []).filter(Boolean);
  const priceStr = Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : '0.00';
  const invNum = Number(p.inventory);
  const availability = Number.isFinite(invNum) && invNum <= 0
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';
  const desc = [p.material, p.category ? `${p.category} — Qori Silver` : 'Qori Silver'].filter(Boolean).join(' · ');

  const doc = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${CANONICAL_ORIGIN}/shop.html` },
          { '@type': 'ListItem', position: 3, name: p.name, item: pageUrl },
        ],
      },
      {
        '@type': 'Product',
        '@id': `${pageUrl}#product`,
        name: p.name,
        description: desc.slice(0, 500),
        url: pageUrl,
        image: imgs.length ? imgs : undefined,
        brand: { '@type': 'Brand', name: 'Qori Silver' },
        material: 'Sterling Silver .95',
        category: p.category || undefined,
        offers: {
          '@type': 'Offer',
          url: pageUrl,
          price: priceStr,
          priceCurrency: 'USD',
          availability,
          seller: { '@type': 'Organization', name: 'Qori Silver' },
        },
      },
    ],
  };
  el.textContent = JSON.stringify(doc);
}

function renderProductDetail(root, p) {
  const slug = productSlug(p);
  const catColor = CAT_COLOR[p.category] || 'var(--gold)';
  const price = formatPrice(p.price);
  const invNum = Number(p.inventory);
  const soldOut = Number.isFinite(invNum) && invNum <= 0;

  root.classList.toggle('is-soldout', soldOut);
  root.dataset.qoriDetailReady = '1';
  if (slug) root.dataset.qoriDetailSlug = slug;

  const gallery = root.querySelector('[data-qori-detail-gallery]');
  if (gallery) {
    gallery.innerHTML = buildPieceCarousel(p, { context: 'detail', lcp: true });
    initCarousels(gallery);
  }

  const h1 = root.querySelector('[data-qori-detail-name]');
  if (h1) h1.textContent = p.name;

  const meta = root.querySelector('[data-qori-detail-meta]');
  if (meta) meta.innerHTML = `<span style="color:${catColor}">${esc(p.category || '')}</span>`;

  const priceEl = root.querySelector('[data-qori-detail-price]');
  if (priceEl) priceEl.textContent = price;

  const matLine = root.querySelector('[data-qori-detail-mat]');
  if (matLine) matLine.textContent = p.material || '';

  const crumb = root.querySelector('[data-qori-detail-crumb]');
  if (crumb) crumb.textContent = p.name;

  const btn = root.querySelector('[data-add-to-cart]');
  if (btn) {
    btn.setAttribute('data-product-id', p.id);
    btn.setAttribute('data-product-name', p.name);
    btn.setAttribute('data-product-price', Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : '0.00');
    btn.disabled = soldOut;
    btn.textContent = soldOut ? 'Unavailable' : 'Add to cart';
  }

  applyProductDetailMeta(p);
  applyProductDetailLd(p);
}

function renderGridProducts(grid, products, linkBase) {
  grid.innerHTML = products.map((p, i) => buildPieceCard(p, linkBase, i === 0)).join('\n');
  grid.dataset.qoriProductsReady = '1';
  initCarousels(grid);
  wireGridProductLinks(grid, products);
  notifyProductsReady(products);
  applyShopItemListLd(products);
  applyHomeCollectionItemListLd(products);
}

async function hydrateProductGrid(grid) {
  const linkBase = (grid.getAttribute('data-qori-product-link-base') || 'products/').trim() || 'products/';

  try {
    const products = await loadProductsCatalog();
    if (!Array.isArray(products) || products.length === 0) {
      if (!grid.dataset.qoriProductsReady) {
        grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">No products available right now.</p>';
      }
      return;
    }
    const prevJson = grid.dataset.qoriProductsJson || '';
    const nextJson = JSON.stringify(products);
    if (prevJson !== nextJson) {
      grid.dataset.qoriProductsJson = nextJson;
      renderGridProducts(grid, products, linkBase);
    } else if (!grid.dataset.qoriProductsReady) {
      renderGridProducts(grid, products, linkBase);
    } else {
      notifyProductsReady(products);
    }
  } catch (err) {
    console.error('Product grid load failed:', err);
    if (!grid.dataset.qoriProductsReady) {
      grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">Could not load products — please refresh.</p>';
    }
  }
}

function shouldRerenderDetail(root, p, { id, slug }) {
  const prevJson = root.dataset.qoriDetailJson || '';
  const nextJson = JSON.stringify(p);
  const key = id || slug || '';
  const prevKey = root.dataset.qoriDetailKey || '';
  return prevJson !== nextJson || prevKey !== key || !root.dataset.qoriDetailReady;
}

function applyDetailRender(root, p, { id, slug }) {
  root.dataset.qoriDetailJson = JSON.stringify(p);
  root.dataset.qoriDetailKey = id || slug || '';
  renderProductDetail(root, p);
}

async function hydrateProductDetail(root) {
  const target = resolveDetailTarget(root);
  const { id, slug } = target;
  if (!id && !slug) return;

  const snap = readSelectedProduct(id, slug);
  if (snap && shouldRerenderDetail(root, snap, target)) {
    applyDetailRender(root, snap, target);
  }

  try {
    const products = await loadProductsCatalog();
    const p = findProductForDetail(products, target);
    if (!p) {
      if (!root.dataset.qoriDetailReady) {
        const gallery = root.querySelector('[data-qori-detail-gallery]');
        if (gallery) gallery.innerHTML = '<p class="muted" style="padding:3rem 1rem;text-align:center">Product not found.</p>';
      }
      return;
    }

    if (shouldRerenderDetail(root, p, target)) {
      applyDetailRender(root, p, target);
    }
    notifyProductsReady(products);
  } catch (err) {
    console.error('Product detail load failed:', err);
    if (!root.dataset.qoriDetailReady) {
      const gallery = root.querySelector('[data-qori-detail-gallery]');
      if (gallery) {
        gallery.innerHTML = '<p class="muted" style="padding:3rem 1rem;text-align:center">Could not load product — please refresh.</p>';
      }
    }
  }
}

function initProductGrids() {
  document.querySelectorAll('[data-qori-products]').forEach((grid) => {
    hydrateProductGrid(grid);
  });
}

function initProductDetails() {
  document.querySelectorAll('[data-qori-product-detail]').forEach((root) => {
    hydrateProductDetail(root);
  });
}

document.addEventListener('qori:products-catalog-changed', (e) => {
  const products = e.detail?.products;
  if (!Array.isArray(products) || !products.length) return;

  document.querySelectorAll('[data-qori-products]').forEach((grid) => {
    const linkBase = (grid.getAttribute('data-qori-product-link-base') || 'products/').trim() || 'products/';
    grid.dataset.qoriProductsJson = JSON.stringify(products);
    renderGridProducts(grid, products, linkBase);
  });

  document.querySelectorAll('[data-qori-product-detail]').forEach((root) => {
    const target = resolveDetailTarget(root);
    const p = findProductForDetail(products, target);
    if (p && shouldRerenderDetail(root, p, target)) {
      applyDetailRender(root, p, target);
    }
  });

  notifyProductsReady(products);
});

initProductGrids();
initProductDetails();
