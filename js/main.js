/* ─────────────────────────────────────────
   QORI SILVER — Main JavaScript
   ───────────────────────────────────────── */

/* ── Tiny helpers ── */
function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

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
        <div class="cart-empty-sub">Add a test item to preview the checkout flow.</div>
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

function showFakeCheckout(total) {
  const existing = document.querySelector('[data-checkout-modal]');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.setAttribute('data-checkout-modal', 'true');
  modal.className = 'checkout-modal-overlay open';
  modal.innerHTML = `
    <div class="checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout (demo)">
      <div class="checkout-modal-head">
        <div class="checkout-modal-title">Checkout (Demo)</div>
        <button class="checkout-close" type="button" data-checkout-close aria-label="Close">×</button>
      </div>
      <div class="checkout-modal-body">
        <p>This is an MVP checkout preview (no payments yet).</p>
        <div class="checkout-total"><span>Total</span><strong>${money(total)}</strong></div>
        <div class="checkout-fields">
          <label>Full name <input type="text" placeholder="Jane Doe" /></label>
          <label>Email <input type="email" placeholder="jane@email.com" /></label>
          <label>Shipping address <input type="text" placeholder="123 Main St, Cusco" /></label>
        </div>
        <button class="btn-primary checkout-cta" type="button" data-checkout-submit>Place order (demo)</button>
        <div class="checkout-note">Later we’ll replace this with Shopify/Stripe/Snipcart.</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector('[data-checkout-close]')?.addEventListener('click', () => modal.remove());
  modal.querySelector('[data-checkout-submit]')?.addEventListener('click', () => {
    modal.remove();
    const cart = { items: [] };
    writeCart(cart);
    renderCart(cart);
    closeCart();
    alert('Demo order placed. (Cart cleared)');
  });
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

    cart = addItem(cart, { id, name, price });
    writeCart(cart);
    renderCart(cart);
    openCart();
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
  showFakeCheckout(cartSubtotal(cart));
});

/* ── Console welcome ── */
console.log('%cQori Silver', 'font-size:1.4rem;color:#C9A84C;font-family:serif');
console.log('%cHandcrafted in Cusco, Peru · Sterling .925', 'color:#4EC9B0;font-size:.85rem');
