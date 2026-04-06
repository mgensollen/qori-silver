/* ─────────────────────────────────────────
   QORI SILVER — Main JavaScript
   ───────────────────────────────────────── */

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

/* ── Cart counter (placeholder) ── */
let cartCount = 0;
const cartBtn = document.querySelector('.nav-cart');

document.querySelectorAll('.card-btn, .btn-primary').forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (btn.textContent.includes('Shop') || btn.textContent.includes('Explore')) {
      // placeholder — hook up to real cart logic here
    }
  });
});

/* ── Console welcome ── */
console.log('%cQori Silver', 'font-size:1.4rem;color:#C9A84C;font-family:serif');
console.log('%cHandcrafted in Cusco, Peru · Sterling .925', 'color:#4EC9B0;font-size:.85rem');
