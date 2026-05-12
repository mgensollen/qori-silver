

/* ─────────────────────────────────────────
   QORI SILVER — Main JavaScript
   ───────────────────────────────────────── */

/* ── Tiny helpers ── */
function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function extractDriveId(url) {
  if (!url) return '';
  const byQuery = url.match(/[?&]id=([^&]+)/);
  if (byQuery?.[1]) return byQuery[1];
  const byPath = url.match(/\/d\/([^/]+)/);
  if (byPath?.[1]) return byPath[1];
  return '';
}

function driveFallbackSources(src) {
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

/* ── Sticky nav background on scroll ── */
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.style.background = 'rgba(12, 10, 7, 1)';
  } else {
    navbar.style.background = 'rgba(12, 10, 7, 0.97)';
  }
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

function getAvailableInventory(productId) {
  if (!inventoryById.has(productId)) return Number.POSITIVE_INFINITY;
  return Number(inventoryById.get(productId)) || 0;
}

function canAddQty(productId, nextQty) {
  return nextQty <= getAvailableInventory(productId);
}

function applyInventoryToButtons() {
  document.querySelectorAll('[data-add-to-cart]').forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    const id = el.getAttribute('data-product-id') || '';
    if (!id) return;
    const available = getAvailableInventory(id);
    const soldOut = available <= 0;
    const card = el.closest('.piece, .shop-card');
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
      msg.hidden = !soldOut;
      if (soldOut) {
        el.setAttribute('aria-describedby', soldOutId);
      } else {
        el.removeAttribute('aria-describedby');
      }
    }

    if (card) {
      card.classList.toggle('is-soldout', soldOut);
    }

    el.disabled = soldOut;
    el.textContent = soldOut ? 'Unavailable' : 'Add to cart';
  });
}

async function loadInventory() {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  try {
    const res = await fetch(`${apiBase}/api/products`);
    if (!res.ok) return;
    const products = await res.json();
    if (!Array.isArray(products)) return;
    inventoryById.clear();
    for (const p of products) {
      if (!p || typeof p.id !== 'string') continue;
      const qty = Number.isFinite(Number(p.inventory)) ? Math.max(0, Math.floor(Number(p.inventory))) : Number.POSITIVE_INFINITY;
      inventoryById.set(p.id, qty);
    }
    applyInventoryToButtons();
  } catch (err) {
    console.warn('Inventory load failed:', err);
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

  if (!cartItemsEl) return;

  if (cart.items.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Explore our collection and add a piece you love.</div>
      </div>
    `;
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

document.querySelectorAll('[data-add-to-cart]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const id = el.getAttribute('data-product-id') ?? 'test-item';
    const name = el.getAttribute('data-product-name') ?? 'Test Item';
    const price = Number.parseFloat(el.getAttribute('data-product-price') ?? '0') || 0;
    const previousQty = cart.items.find(i => i.id === id)?.qty || 0;

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

loadInventory();
loadStripeMode();

document.addEventListener('qori:shop-products-rendered', () => {
  loadInventory();
});

/* ── Console welcome ── */
console.log('%cQori Silver', 'font-size:1.4rem;color:#C9A84C;font-family:serif');
console.log('%cHandcrafted in Cusco, Peru · Sterling .925', 'color:#4EC9B0;font-size:.85rem');
