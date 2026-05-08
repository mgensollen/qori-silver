/* ──────────────────────────────────────────
   QORI SILVER — Dynamic product grid + carousel
   ────────────────────────────────────────── */

const CAT_COLOR = {
  Chains:   'var(--teal-lt)',
  Earrings: 'var(--cobalt-lt)',
};

const PLACEHOLDER_SVG = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="none">
  <rect width="240" height="240" fill="#221D16"/>
  <circle cx="120" cy="120" r="78" stroke="#C9A84C" stroke-width="1.5" opacity=".35"/>
  <circle cx="120" cy="120" r="50" stroke="#1D8A7A" stroke-width="1" opacity=".25"/>
  <text x="120" y="128" text-anchor="middle" font-size="13" fill="#C9A84C" opacity=".45" font-family="serif" letter-spacing="3">QORI</text>
</svg>`;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildImgSection(p) {
  const imgs = p.images || [];

  if (imgs.length === 0) {
    return `<div class="shop-img">${PLACEHOLDER_SVG}</div>`;
  }

  if (imgs.length === 1) {
    return `<div class="shop-img"><img src="${esc(imgs[0])}" alt="${esc(p.name)}" loading="lazy"></div>`;
  }

  const slides = imgs.map((url, i) => `
    <div class="carousel-slide">
      <img src="${esc(url)}" alt="${esc(p.name)} ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">
    </div>`).join('');

  const dots = imgs.map((_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Photo ${i + 1}"></button>`
  ).join('');

  return `
    <div class="shop-img" data-carousel>
      <div class="carousel-track">${slides}</div>
      <button class="carousel-prev" aria-label="Previous">&#8249;</button>
      <button class="carousel-next" aria-label="Next">&#8250;</button>
      <div class="carousel-dots">${dots}</div>
    </div>`;
}

function buildCard(p) {
  return `
    <article class="shop-card">
      ${buildImgSection(p)}
      <div class="shop-meta">
        <div class="piece-cat" style="color:${CAT_COLOR[p.category] || 'var(--gold)'}">${esc(p.category)}</div>
        <div class="piece-name">${esc(p.name)}</div>
        <div class="piece-price">$${p.price.toFixed(2)}</div>
        <div class="piece-mat">${esc(p.material)}</div>
        <button class="piece-add" type="button"
          data-add-to-cart
          data-product-id="${esc(p.id)}"
          data-product-name="${esc(p.name)}"
          data-product-price="${p.price}"
        >Add to cart</button>
      </div>
    </article>`;
}

function initCarousels(container) {
  if (!container) return;

  container.querySelectorAll('[data-carousel]').forEach(el => {
    const track = el.querySelector('.carousel-track');
    const slides = el.querySelectorAll('.carousel-slide');
    const dots   = el.querySelectorAll('.carousel-dot');
    const total  = slides.length;
    if (!track || total === 0) return;

    let cur = 0;

    function go(n) {
      cur = ((n % total) + total) % total;
      track.style.transform = `translateX(-${cur * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    }

    el.querySelector('.carousel-prev')?.addEventListener('click', e => { e.stopPropagation(); go(cur - 1); });
    el.querySelector('.carousel-next')?.addEventListener('click', e => { e.stopPropagation(); go(cur + 1); });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));

    // Touch swipe
    let tx = 0;
    let ty = 0;
    el.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        go(cur + (dx < 0 ? 1 : -1));
      }
    });
  });
}

async function loadProducts() {
  const grid = document.querySelector('.shop-grid');
  if (!grid) return;

  const apiBase = (window.QORI_API_BASE || '').replace(/\/$/, '');
  try {
    const res = await fetch(`${apiBase}/api/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();

    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">No products available right now.</p>';
      return;
    }

    grid.innerHTML = products.map(buildCard).join('');

    initCarousels(grid);
  } catch (err) {
    console.error('Product load failed:', err);
    grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.6;grid-column:1/-1">Could not load products — please refresh.</p>';
  }
}

loadProducts();
