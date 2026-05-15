

/* ─────────────────────────────────────────
   QORI SILVER — Main JavaScript
   ───────────────────────────────────────── */

/* ── Tiny helpers ── */
function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function extractDriveId(url) {
  if (!url) return '';
  if (/res\.cloudinary\.com\//i.test(url)) return '';
  if (/\.supabase\.co\/storage\//i.test(url)) return '';
  const byQuery = url.match(/[?&]id=([^&]+)/);
  if (byQuery?.[1]) return byQuery[1];
  const byPath = url.match(/\/d\/([^/]+)/);
  if (byPath?.[1]) return byPath[1];
  return '';
}

function driveFallbackSources(src) {
  if (!src) return [];
  if (/res\.cloudinary\.com\//i.test(src)) return [];
  if (/\.supabase\.co\/storage\//i.test(src)) return [];
  const id = extractDriveId(src);
  if (!id) return [];
  return [
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w1400`,
  ];
}

function attachImageFallback(img) {
  if (!(img instanceof HTMLImageElement)) return;
  if (img.dataset.fallbackAttached === '1') return;
  img.dataset.fallbackAttached = '1';

  img.addEventListener('error', () => {
    const queue = img.dataset.fallbackQueue ? JSON.parse(img.dataset.fallbackQueue) : driveFallbackSources(img.currentSrc || img.src);
    if (!queue.length) return;
    const next = queue.shift();
    img.dataset.fallbackQueue = JSON.stringify(queue);
    if (next && next !== img.src) img.src = next;
  });

  // If this image is already broken, immediately try fallback.
  if (img.complete && img.naturalWidth === 0) {
    const queue = driveFallbackSources(img.currentSrc || img.src);
    const next = queue.shift();
    img.dataset.fallbackQueue = JSON.stringify(queue);
    if (next && next !== img.src) img.src = next;
  }
}

function setupImageFallbacks() {
  document.querySelectorAll('img').forEach(attachImageFallback);
  document.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement) attachImageFallback(e.target);
  }, true);
}

setupImageFallbacks();

/* ── Mobile nav toggle ── */
const navToggle = document.querySelector('.nav-toggle');
const navLinks  = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

/* ── Sticky nav — always light (parchment) ── */
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (!navbar) return;
  navbar.style.background = window.scrollY > 60
    ? 'rgba(255,252,248,1)'
    : 'rgba(255,252,248,0.97)';
});

/* ── Page Tabs ── */
function activateTab(tabId) {
  document.querySelectorAll('.page-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-section').forEach(p =>
    p.classList.toggle('active', p.id === 'tab-' + tabId));
  history.replaceState(null, '', '#' + tabId);

  // Init carousels only once per panel — skip if already done
  const panel = document.getElementById('tab-' + tabId);
  if (panel && !panel.dataset.carouselsReady) {
    panel.querySelectorAll('.pieces-grid').forEach(g => initCarousels(g));
    panel.dataset.carouselsReady = '1';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.page-tab').forEach(btn =>
    btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  document.querySelectorAll('[data-tab-target]').forEach(link =>
    link.addEventListener('click', e => {
      e.preventDefault();
      const tabId = link.dataset.tabTarget;
      activateTab(tabId);

      // Scroll user to the tab content, cleared below the sticky navbar + tab bar
      const panel = document.getElementById('tab-' + tabId);
      if (panel) {
        const navH  = document.querySelector('.navbar')?.offsetHeight  || 0;
        const tabsH = document.getElementById('page-tabs')?.offsetHeight || 0;
        const top   = panel.getBoundingClientRect().top + window.pageYOffset - navH - tabsH - 8;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }));

  const hash = location.hash.replace('#', '');
  if (['shop','craftsmanship','about'].includes(hash)) activateTab(hash);
});

/* ── Lightbox ── */
document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const lbImg  = lb.querySelector('.lightbox-img');
  const lbPrev = lb.querySelector('.lightbox-prev');
  const lbNext = lb.querySelector('.lightbox-next');
  let imgs = [], idx = 0;

  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    lbImg.src = imgs[idx];
  }
  function open(sources, i) {
    imgs = sources; show(i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.carousel-slide img, .piece-img > img');
    if (!img) return;
    const track = img.closest('.carousel-track, .piece-img');
    const all = [...(track?.querySelectorAll('img') || [img])].map(i => i.src);
    const ci  = all.indexOf(img.src);
    open(all, ci < 0 ? 0 : ci);
  });

  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  lb.querySelector('.lightbox-close')?.addEventListener('click', close);
  lbPrev?.addEventListener('click', () => show(idx - 1));
  lbNext?.addEventListener('click', () => show(idx + 1));
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
});

/* ── Smooth reveal on scroll ── */
const revealElements = document.querySelectorAll(
  '.col-card, .piece, .cb, .sec-title, .eyebrow'
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealElements.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = `opacity 0.6s ease ${i * 0.05}s, transform 0.6s ease ${i * 0.05}s`;
  revealObserver.observe(el);
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.revealed').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
});

// Add .revealed class via CSS
const style = document.createElement('style');
style.textContent = '.revealed { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(style);

/* ── Cart (MVP) ── */
const cartBtn = document.querySelector('.nav-cart');

const cartDrawer = document.querySelector('[data-cart-drawer]');
const cartOverlay = document.querySelector('[data-cart-overlay]');
const cartItemsEl = document.querySelector('[data-cart-items]');
const cartSubtotalEl = document.querySelector('[data-cart-subtotal]');
const cartCountEl = document.querySelector('[data-cart-count]');
let stripeMode = '';
const inventoryById = new Map();
/** After first successful GET /api/products for inventory; avoids false "sold out" before data arrives. */
let inventoryFromApiReady = false;
/** True after /api/products fetch throws or non-OK (buttons stay disabled). */
let inventoryLoadFailed = false;

function ensureStripeModeBadge() {
  const cartFoot = document.querySelector('.cart-foot');
  if (!cartFoot) return null;
  let badge = cartFoot.querySelector('[data-stripe-mode-badge]');
  if (!badge) {
    badge = document.createElement('div');
    badge.setAttribute('data-stripe-mode-badge', '1');
    badge.className = 'stripe-mode-badge';
    badge.hidden = true;
    const cartActions = cartFoot.querySelector('.cart-actions');
    if (cartActions) {
      cartFoot.insertBefore(badge, cartActions);
    } else {
      cartFoot.appendChild(badge);
    }
  }
  return badge;
}

function renderStripeModeBadge(mode) {
  const badge = ensureStripeModeBadge();
  if (!badge) return;
  if (mode === 'test') {
    badge.textContent = 'Stripe Test Mode';
    badge.classList.add('is-test');
    badge.classList.remove('is-live');
    badge.hidden = false;
    return;
  }
  if (mode === 'live') {
    badge.textContent = 'Stripe Live Mode';
    badge.classList.add('is-live');
    badge.classList.remove('is-test');
    badge.hidden = false;
    return;
  }
  badge.hidden = true;
}

async function loadStripeMode() {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  try {
    const res = await fetch(`${apiBase}/api/stripe-mode`);
    if (!res.ok) return;
    const data = await res.json();
    stripeMode = data?.mode === 'test' ? 'test' : data?.mode === 'live' ? 'live' : '';
    renderStripeModeBadge(stripeMode);
  } catch (err) {
    console.warn('Stripe mode check failed:', err);
  }
}

function getServerInventory(productId) {
  if (!inventoryFromApiReady) return null;
  if (!inventoryById.has(productId)) return 0;
  const raw = inventoryById.get(productId);
  if (raw === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/** Units left to sell after what is already in the cart (server truth minus this browser's cart). */
function getAvailableInventory(productId) {
  const server = getServerInventory(productId);
  if (server === null) return null;
  if (server === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  const inCart = cart.items.find((i) => i.id === productId)?.qty || 0;
  return Math.max(0, server - inCart);
}

function canAddQty(productId, nextQty) {
  const avail = getAvailableInventory(productId);
  if (avail === null) return false;
  if (avail === Number.POSITIVE_INFINITY) return true;
  return nextQty <= avail;
}

function applyInventoryToButtons() {
  document.querySelectorAll('[data-add-to-cart]').forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    const id = (el.getAttribute('data-product-id') || '').trim();
    if (!id) return;
    const serverInv = getServerInventory(id);
    const remaining = getAvailableInventory(id);
    const inCart = cart.items.find((i) => i.id === id)?.qty || 0;

    if (serverInv === null) {
      const card = el.closest('.piece, .shop-card, .product-detail');
      if (card) card.classList.remove('is-soldout');
      const parent = el.parentElement;
      if (parent) {
        const msg = parent.querySelector(`[data-soldout-for="${id}"]`);
        if (msg) msg.hidden = true;
      }
      el.disabled = true;
      el.textContent = inventoryLoadFailed ? 'Unavailable' : 'Loading…';
      el.removeAttribute('aria-describedby');
      return;
    }

    const trulyGone = serverInv <= 0;
    const cannotAddMore = remaining !== null && remaining <= 0;
    const atCartCap = !trulyGone && cannotAddMore && inCart > 0;
    const card = el.closest('.piece, .shop-card, .product-detail');
    const soldOutId = `soldout-${id}`;
    const parent = el.parentElement;

    if (parent) {
      let msg = parent.querySelector(`[data-soldout-for="${id}"]`);
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'soldout-note';
        msg.setAttribute('data-soldout-for', id);
        msg.id = soldOutId;
        msg.innerHTML = '<span class="soldout-dot"></span>Sold out';
        msg.hidden = true;
        parent.insertBefore(msg, el);
      }
      msg.hidden = !trulyGone;
      if (trulyGone) {
        el.setAttribute('aria-describedby', soldOutId);
      } else {
        el.removeAttribute('aria-describedby');
      }
    }

    if (card) {
      card.classList.toggle('is-soldout', trulyGone);
    }

    el.disabled = cannotAddMore;
    if (trulyGone) {
      el.textContent = 'Unavailable';
    } else if (atCartCap) {
      el.textContent = 'In your cart';
    } else {
      el.textContent = 'Add to cart';
    }
  });
}

/** Clamp cart quantities to server stock after inventory loads (fixes stale localStorage). */
function reconcileCartWithInventory() {
  if (!inventoryFromApiReady || inventoryById.size === 0) return;
  const next = [];
  for (const it of cart.items) {
    if (!inventoryById.has(it.id)) continue;
    const capRaw = inventoryById.get(it.id);
    if (capRaw === Number.POSITIVE_INFINITY) {
      next.push(it);
      continue;
    }
    const cap = Math.max(0, Number.isFinite(Number(capRaw)) ? Math.floor(Number(capRaw)) : 0);
    const q = Math.min(it.qty, cap);
    if (q > 0) next.push({ ...it, qty: q });
  }
  const same =
    next.length === cart.items.length
    && next.every((it, i) => it.id === cart.items[i].id && it.qty === cart.items[i].qty);
  if (same) return;
  cart = { items: next };
  writeCart(cart);
  renderCart(cart);
}

async function loadInventory(preloadedProducts) {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  inventoryLoadFailed = false;
  try {
    let products;
    if (Array.isArray(preloadedProducts)) {
      products = preloadedProducts;
    } else {
      const res = await fetch(`${apiBase}/api/products`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      products = await res.json();
    }
    if (!Array.isArray(products)) throw new Error('Invalid products payload');
    const next = new Map();
    for (const p of products) {
      if (!p || typeof p.id !== 'string') continue;
      const id = p.id.trim();
      if (!id) continue;
      const raw = p.inventory;
      let qty;
      if (raw === null || raw === undefined || raw === '') {
        qty = Number.POSITIVE_INFINITY;
      } else {
        const n = Number(raw);
        qty = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : Number.POSITIVE_INFINITY;
      }
      next.set(id, qty);
    }
    inventoryById.clear();
    for (const [k, v] of next) inventoryById.set(k, v);
    inventoryFromApiReady = true;
    reconcileCartWithInventory();
    applyInventoryToButtons();
  } catch (err) {
    console.warn('Inventory load failed:', err);
    inventoryFromApiReady = false;
    inventoryLoadFailed = true;
    inventoryById.clear();
    applyInventoryToButtons();
  }
}

function readCart() {
  const raw = window.localStorage.getItem('qori_cart');
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return {
      items: parsed.items
        .filter(i => i && typeof i.id === 'string')
        .map(i => ({
          id: i.id,
          name: typeof i.name === 'string' ? i.name : 'Item',
          price: Number.isFinite(Number(i.price)) ? Number(i.price) : 0,
          qty: Number.isFinite(Number(i.qty)) && Number(i.qty) > 0 ? Math.floor(Number(i.qty)) : 1,
        })),
    };
  } catch {
    return { items: [] };
  }
}

function writeCart(cart) {
  window.localStorage.setItem('qori_cart', JSON.stringify(cart));
}

function cartCount(cart) {
  return cart.items.reduce((sum, it) => sum + it.qty, 0);
}

function cartSubtotal(cart) {
  return cart.items.reduce((sum, it) => sum + it.qty * it.price, 0);
}

function renderCartBadge(cart) {
  const n = cartCount(cart);
  if (cartBtn) cartBtn.textContent = `Cart (${n})`;
  if (cartCountEl) cartCountEl.textContent = String(n);
}

function openCart() {
  if (cartDrawer) cartDrawer.classList.add('open');
  if (cartOverlay) cartOverlay.classList.add('open');
}

function closeCart() {
  if (cartDrawer) cartDrawer.classList.remove('open');
  if (cartOverlay) cartOverlay.classList.remove('open');
}

function setQty(cart, id, qty) {
  const nextQty = Math.max(0, qty);
  const idx = cart.items.findIndex(i => i.id === id);
  if (idx === -1) return cart;
  if (nextQty === 0) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].qty = nextQty;
  }
  return cart;
}

function addItem(cart, item) {
  const existing = cart.items.find(i => i.id === item.id);
  const nextQty = existing ? existing.qty + 1 : 1;
  if (!canAddQty(item.id, nextQty)) return cart;
  if (existing) {
    existing.qty += 1;
  } else {
    cart.items.unshift({ ...item, qty: 1 });
  }
  return cart;
}

function renderCart(cart) {
  renderCartBadge(cart);

  if (cartSubtotalEl) cartSubtotalEl.textContent = money(cartSubtotal(cart));

  if (!cartItemsEl) {
    applyInventoryToButtons();
    return;
  }

  if (cart.items.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Explore our collection and add a piece you love.</div>
      </div>
    `;
    applyInventoryToButtons();
    return;
  }

  cartItemsEl.innerHTML = cart.items.map(it => `
    <div class="cart-item" data-cart-item="${it.id}">
      <div class="cart-item-main">
        <div class="cart-item-name">${it.name}</div>
        <div class="cart-item-meta">${money(it.price)} · <span class="muted">each</span></div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" type="button" data-cart-dec data-id="${it.id}" aria-label="Decrease quantity">−</button>
        <div class="qty">${it.qty}</div>
        <button class="qty-btn" type="button" data-cart-inc data-id="${it.id}" aria-label="Increase quantity">+</button>
        <button class="remove-btn" type="button" data-cart-remove data-id="${it.id}">Remove</button>
      </div>
    </div>
  `).join('');
  applyInventoryToButtons();
}

function computeCheckoutReturnBase() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length && /\.[a-zA-Z0-9]+$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return window.location.origin + (parts.length ? `/${parts.join('/')}` : '');
}

async function startStripeCheckout(cart) {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  const items = (cart?.items ?? []).map(it => ({
    id: it.id,
    name: it.name,
    price: it.price,
    qty: it.qty,
  }));

  const res = await fetch(`${apiBase}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      return_base: computeCheckoutReturnBase(),
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Checkout failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error('Checkout failed (missing redirect URL).');
  window.location.assign(data.url);
}

// Init + global wiring
let cart = readCart();
renderCart(cart);

document.querySelectorAll('[data-cart-open]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
  });
});

document.querySelectorAll('[data-cart-close]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    closeCart();
  });
});

cartOverlay?.addEventListener('click', closeCart);

document.addEventListener('click', (e) => {
  const el = e.target instanceof Element ? e.target.closest('[data-add-to-cart]') : null;
  if (!el || !(el instanceof HTMLButtonElement)) return;
  e.preventDefault();
  if (!inventoryFromApiReady) {
    alert(inventoryLoadFailed ? 'Could not load stock. Please refresh the page.' : 'Still loading availability — try again in a moment.');
    return;
  }
  const id = (el.getAttribute('data-product-id') ?? 'test-item').trim();
  const name = el.getAttribute('data-product-name') ?? 'Test Item';
  const price = Number.parseFloat(el.getAttribute('data-product-price') ?? '0') || 0;
  const previousQty = cart.items.find(i => i.id === id)?.qty || 0;

  if (!canAddQty(id, previousQty + 1)) {
    alert(getServerInventory(id) === 0 ? 'This item is sold out.' : 'This item is out of stock.');
    return;
  }

  cart = addItem(cart, { id, name, price });
  writeCart(cart);
  renderCart(cart);
  const nextQty = cart.items.find(i => i.id === id)?.qty || 0;
  if (nextQty > previousQty) {
    openCart();
  } else {
    alert('This item is out of stock.');
  }
});

cartItemsEl?.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.getAttribute('data-id');
  if (!id) return;

  if (target.hasAttribute('data-cart-inc')) {
    const item = cart.items.find(i => i.id === id);
    if (!item) return;
    if (!canAddQty(id, item.qty + 1)) {
      alert('This item is out of stock.');
      return;
    }
    cart = setQty(cart, id, item.qty + 1);
  } else if (target.hasAttribute('data-cart-dec')) {
    const item = cart.items.find(i => i.id === id);
    if (!item) return;
    cart = setQty(cart, id, item.qty - 1);
  } else if (target.hasAttribute('data-cart-remove')) {
    cart = setQty(cart, id, 0);
  } else {
    return;
  }

  writeCart(cart);
  renderCart(cart);
});

document.querySelector('[data-cart-clear]')?.addEventListener('click', (e) => {
  e.preventDefault();
  cart = { items: [] };
  writeCart(cart);
  renderCart(cart);
});

document.querySelector('[data-cart-checkout]')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (cart.items.length === 0) return;
  startStripeCheckout(cart).catch((err) => {
    console.error('Checkout error:', err);
    alert(`Checkout failed: ${err?.message || 'Unknown error'}. Check the browser console for details.`);
  });
});

if (!document.querySelector('[data-qori-products]')) {
  loadInventory();
}
loadStripeMode();

document.addEventListener('qori:shop-products-rendered', (e) => {
  loadInventory(e.detail?.products);
});

/* ── Console welcome ── */
console.log('%cQori Silver', 'font-size:1.4rem;color:#C9A84C;font-family:serif');
console.log('%cHandcrafted in Cusco, Peru · Sterling .95', 'color:#4EC9B0;font-size:.85rem');
