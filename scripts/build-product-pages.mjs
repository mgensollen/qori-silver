/**
 * One-off generator for static product detail pages (PDPs).
 * Run: node scripts/build-product-pages.mjs
 * Slugs must match server/product-urls.js (SITE_PRODUCT_SLUG) for PDP links + API `slug` field.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'products');
fs.mkdirSync(outDir, { recursive: true });

const STYLE_V = '20260511-20';
const ASSET_V = '20260511-20';
const MAIN_V = '20260511-20';
const CFG_V = '20260511-20';
const PRD_V = '20260511-20';

const products = [
  {
    slug: 'amaru-curb-necklace-bracelet',
    name: 'Amaru Curb Necklace & Bracelet',
    price: '310.00',
    priceDisplay: '$310.00',
    id: 'product-1',
    cat: 'Chains',
    catColor: 'var(--teal-lt)',
    mat: 'Weight: 19.88g · Length: 24 in',
    ogImageId: '1Q7cbapay_stg3aUSOOFYCEAUtgAFBj-I',
    metaDesc:
      'Shop the Amaru curb necklace and bracelet set by Qori Silver — handcrafted Peruvian sterling .95 silver, 19.88g, 24 in. Andean serpent motif. Free worldwide shipping.',
    intro:
      'The Amaru set is a signature Qori Silver curb chain necklace and bracelet in sterling .95, forged by hand in Peru. Named for the serpent of transformation in Andean mythology, it carries weight and polish that feel ancient yet utterly modern. Each link is finished slowly so the silver catches light the way high-altitude sun touches stone.',
    slides: [
      '1Q7cbapay_stg3aUSOOFYCEAUtgAFBj-I',
      '14lujjOhLTn-JP_K_69mdqvjax5Vu6xtk',
      '1z1nZoCXXWg5mrKu3AoiC_qof9jMCEGh6',
      '11FETbQITRSmb0Q417Ry9M_J8kdUKYivW',
    ],
  },
  {
    slug: 'inti-heavy-curb-set',
    name: 'Inti Heavy Curb Set',
    price: '479.00',
    priceDisplay: '$479.00',
    id: 'product-2',
    cat: 'Chains',
    catColor: 'var(--teal-lt)',
    mat: 'Weight: 30.74g · Length: 24 in',
    ogImageId: '1FgbwWt09dNokZY2BK9GqvxFlsby-z6o0',
    metaDesc:
      'Inti Heavy Curb Set — Qori Silver handcrafted Peruvian sterling .95 silver chains, 30.74g, 24 in. Bold curb links inspired by the Incan sun. Made to order with free worldwide shipping.',
    intro:
      'Our heaviest curb profile celebrates Inti, the sun — a substantial necklace and bracelet pairing in sterling .95 silver, handmade in Peru. Qori Silver artisans work the metal in stages so the curb keeps crisp edges and a soft inner glow. Designed to be worn daily and passed down.',
    slides: [
      '1FgbwWt09dNokZY2BK9GqvxFlsby-z6o0',
      '1QSyD-lrvdtWTGI_ylp1Uam7Ed4b7EkC1',
      '1yjZnRkMNTrbKIjyIcRG_1p08Kjzqhdw9',
      '1CyUoHbSbAz8X_dyclGvdnWyAw0AsTCVZ',
    ],
  },
  {
    slug: 'killa-curb-necklace',
    name: 'Killa Curb Necklace',
    price: '146.00',
    priceDisplay: '$146.00',
    id: 'product-3',
    cat: 'Chains',
    catColor: 'var(--teal-lt)',
    mat: 'Weight: 9.34g · Length: 21 in',
    ogImageId: '1Cc32F1VY1puvGfmGsFTCOlu06x3JRQNW',
    metaDesc:
      'Killa curb necklace in sterling .95 by Qori Silver — lightweight Peruvian handmade silver, 9.34g, 21 in. Named for the Andean moon. Free worldwide shipping.',
    intro:
      'Named for Killa, the moon, this slimmer curb necklace is Qori Silver’s answer to everyday Andean luxury: sterling .95 silver, light on the neck, rich in detail. Handcrafted in Peru with the same attention we give our heaviest sets — only quieter, for layering or standing alone.',
    slides: [
      '1Cc32F1VY1puvGfmGsFTCOlu06x3JRQNW',
      '10Nk783ddQLd39A3p851md0u7WFuGrl_m',
      '1cZ_7N0Nkke-W19m-7mcCUHQ9K4XoURZ8',
      '1LcWMBJlO5I2MWyslAbWKdCi3ugDGFUyO',
    ],
  },
  {
    slug: 'qori-figaro-necklace',
    name: 'Qori Figaro Necklace',
    price: '246.00',
    priceDisplay: '$246.00',
    id: 'product-4',
    cat: 'Chains',
    catColor: 'var(--teal-lt)',
    mat: 'Weight: 16.44g · Length: 24 in',
    ogImageId: '1ZuHb5cxfWde9hvr_d64XYFscpYd2D4F-',
    metaDesc:
      'Qori Figaro necklace in Peruvian sterling .95 — Qori Silver handmade Figaro chain, 16.44g, 24 in. Andean craft meets classic link rhythm. Free worldwide shipping.',
    intro:
      'The Figaro rhythm — elongated links alternating with trios — gets a Qori Silver treatment in sterling .95, finished by hand in Peru. This necklace carries our name in its pattern: structured, warm, and built to last generations with the right care.',
    slides: [
      '1ZuHb5cxfWde9hvr_d64XYFscpYd2D4F-',
      '1UHN7wWA4k9ABoHxXHBaAb4ClIJLRDf07',
      '1ce8nwg1jndM9NIn8uMFmDyuvpeaf7va4',
      '12HF1ozWcDrRklPh48EyfWol-CocNw4D6',
    ],
  },
  {
    slug: 'pachamama-clover-necklace',
    name: 'Pachamama Clover Necklace',
    price: '133.00',
    priceDisplay: '$133.00',
    id: 'product-5',
    cat: 'Chains',
    catColor: 'var(--gold-lt)',
    mat: 'Pendant: Sterling silver .95 · Length: 18 in',
    ogImageId: '1B_FQth2xZkdjVtp-jIRG_URVSx4mhzzD',
    metaDesc:
      'Pachamama clover necklace — Qori Silver sterling .95 pendant on an 18 in chain, handmade in Peru. Earth goddess inspiration. Free worldwide shipping.',
    intro:
      'A clover silhouette honors Pachamama — the earth — in sterling .95 silver, suspended on an 18-inch chain. Qori Silver combines symbolic Andean design with wearable scale so the piece feels ceremonial yet suited to daily life.',
    slides: [
      '1B_FQth2xZkdjVtp-jIRG_URVSx4mhzzD',
      '1YhM_Rwz99pk_QGQEdUYFLyKOWd6-y1rg',
      '1X0L9b08CwIly6zB449L2V1JYen8wB5st',
      '1VeO16cFy8WScwvy1w07Ep3QocCPaTeKx',
      '1_ndRlhcXreSdM4mkitEPXD5GdYnTvpqK',
    ],
  },
  {
    slug: 'inti-solar-disc-earrings',
    name: 'Inti Solar Disc Set',
    price: '52.00',
    priceDisplay: '$52.00',
    id: 'product-6',
    cat: 'Earrings',
    catColor: 'var(--cobalt-lt)',
    mat: 'Pendant: Sterling silver .95',
    ogImageId: '1jlIFc75pP_p1dEHoIqaX_M6Q8OumdcZJ',
    metaDesc:
      'Inti Solar Disc earrings — Qori Silver sterling .95 stud set inspired by the Incan sun. Handcrafted in Peru. Free worldwide shipping.',
    intro:
      'Solar discs in miniature: these earrings channel Inti’s radiance in sterling .95 silver, shaped and polished by Qori Silver artisans. A compact statement rooted in Andean cosmology — light you can wear close to the face.',
    slides: [
      '1jlIFc75pP_p1dEHoIqaX_M6Q8OumdcZJ',
      '1STJWmbrAJ8F6y0IkyBtIKsw4N0PyqAIv',
      '1t75IxGADJPi7VNXQgt4UGt9ckxRdOOSt',
      '1xidZUt_S33oUGIz8H0wYEBXo7xtyUgzL',
    ],
  },
  {
    slug: 'chakana-cross-earrings',
    name: 'Chakana Cross Set',
    price: '141.00',
    priceDisplay: '$141.00',
    id: 'product-7',
    cat: 'Earrings',
    catColor: 'var(--cobalt-lt)',
    mat: 'Pendant: Sterling silver .95',
    ogImageId: '1uLgG5G_RPSIXqntoVyrrWu0U1cu1cisR',
    metaDesc:
      'Chakana cross earrings — Qori Silver Andean cross stud set in sterling .95, handmade in Peru. Symbol of balance. Free worldwide shipping.',
    intro:
      'The Chakana — the Andean cross — maps worlds and directions. Qori Silver renders it as a refined earring set in sterling .95, hallmarked and finished by hand so geometry stays crisp and meaning stays close.',
    slides: [
      '1uLgG5G_RPSIXqntoVyrrWu0U1cu1cisR',
      '1BZfwgQbJpCda4QkFjY5LXbXA3QQ4xQeL',
      '1W-jDJ8WxMedBKZhiP8aDlPYN8X2J5AYG',
      '14EyOJhwwUBZed8UArnIsKI2uaf2ZTCiy',
    ],
  },
];

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function carouselHtml(p) {
  const slides = p.slides.map((id, i) => {
    const eager = i === 0 ? 'eager' : 'lazy';
    const alt = escHtml(p.name);
    return `            <div class="carousel-slide"><img src="https://drive.google.com/thumbnail?id=${id}&amp;sz=w800" srcset="https://drive.google.com/thumbnail?id=${id}&amp;sz=w480 480w, https://drive.google.com/thumbnail?id=${id}&amp;sz=w800 800w" sizes="(max-width: 768px) 100vw, 50vw" alt="${alt}" loading="${eager}" width="800" height="800"></div>`;
  });
  const dots = p.slides
    .map((_, i) => `            <button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Photo ${i + 1}"></button>`)
    .join('\n');
  return `        <div class="piece-img" data-carousel>
          <div class="carousel-track">
${slides.join('\n')}
          </div>
          <button class="carousel-prev" aria-label="Previous">&#8249;</button>
          <button class="carousel-next" aria-label="Next">&#8250;</button>
          <div class="carousel-dots">
${dots}
          </div>
        </div>`;
}

for (const p of products) {
  const canonical = `https://www.qorisilver.com/products/${p.slug}.html`;
  const og = `https://drive.google.com/thumbnail?id=${p.ogImageId}&sz=w1200`;
  const imageUrls = p.slides.map(
    (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
  );

  const ldGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.qorisilver.com/' },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://www.qorisilver.com/shop.html' },
          { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
        ],
      },
      {
        '@type': 'Product',
        '@id': `${canonical}#product`,
        name: p.name,
        description: p.metaDesc,
        url: canonical,
        image: imageUrls,
        brand: { '@type': 'Brand', name: 'Qori Silver' },
        material: 'Sterling Silver .95',
        category: p.cat,
        offers: {
          '@type': 'Offer',
          url: canonical,
          price: p.price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: 'Qori Silver' },
        },
      },
    ],
  };
  const ldJson = JSON.stringify(ldGraph, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg?v=${ASSET_V}">
  <title>${escHtml(p.name)} | Qori Silver — Peruvian Sterling Silver Jewelry</title>
  <meta name="description" content="${escHtml(p.metaDesc)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escHtml(p.name)} | Qori Silver">
  <meta property="og:description" content="${escHtml(p.metaDesc)}">
  <meta property="og:image" content="${og}">
  <meta property="og:site_name" content="Qori Silver">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(p.name)} | Qori Silver">
  <meta name="twitter:description" content="${escHtml(p.metaDesc)}">
  <meta name="twitter:image" content="${og}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&amp;family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css?v=${STYLE_V}">
</head>
<body>
  <nav class="navbar">
    <a href="../index.html" class="logo"><img src="../favicon.svg?v=${ASSET_V}" alt="" class="logo-mark" width="30" height="30">QORI <span>SILVER</span></a>
    <ul class="nav-links">
      <li><a href="../shop.html">Shop</a></li>
      <li><a href="../index.html#craftsmanship">Craftsmanship</a></li>
      <li><a href="../index.html#about">About</a></li>
    </ul>
    <div class="nav-right">
      <button class="nav-toggle" aria-label="Open menu">&#9776;</button>
      <a href="#" class="nav-cart" data-cart-open>Cart (0)</a>
    </div>
  </nav>

  <article class="product-detail" data-qori-product-detail data-qori-product-slug="${p.slug}" data-qori-product-id="${p.id}">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="../index.html">Home</a>
      <span aria-hidden="true"> / </span>
      <a href="../shop.html">Shop</a>
      <span aria-hidden="true"> / </span>
      <span aria-current="page" data-qori-detail-crumb>${escHtml(p.name)}</span>
    </nav>
    <div class="product-detail__grid">
      <div class="product-detail__gallery" data-qori-detail-gallery>
        <p class="muted" style="padding:3rem 1rem;text-align:center">Loading…</p>
      </div>
      <div class="product-detail__body">
        <h1 data-qori-detail-name>${escHtml(p.name)}</h1>
        <p class="product-detail__meta" data-qori-detail-meta></p>
        <p class="product-detail__price" data-qori-detail-price></p>
        <p class="piece-mat product-detail__mat" data-qori-detail-mat></p>
        <div class="product-detail__actions">
          <button class="btn-primary piece-add" type="button" data-add-to-cart disabled>Add to cart</button>
          <a class="product-detail__back" href="../shop.html">← All pieces</a>
        </div>
      </div>
    </div>
  </article>

  <div class="cart-overlay" data-cart-overlay></div>
  <aside class="cart-drawer" data-cart-drawer aria-label="Cart">
    <div class="cart-head">
      <div class="cart-title">Your Cart <span class="cart-pill" data-cart-count>0</span></div>
      <button class="cart-x" type="button" data-cart-close aria-label="Close cart">×</button>
    </div>
    <div class="cart-body">
      <div class="cart-items" data-cart-items></div>
    </div>
    <div class="cart-foot">
      <div class="cart-row">
        <span class="muted">Subtotal</span>
        <strong data-cart-subtotal>$0.00</strong>
      </div>
      <div class="cart-actions">
        <button class="btn-ghost cart-clear" type="button" data-cart-clear>Clear</button>
        <button class="btn-primary cart-checkout" type="button" data-cart-checkout>Checkout</button>
      </div>
    </div>
  </aside>

  <script src="../js/config.js?v=${CFG_V}"></script>
  <script src="../js/main.js?v=${MAIN_V}"></script>
  <script src="../js/products.js?v=${PRD_V}"></script>
  <script id="qori-product-ld" type="application/ld+json">
${ldJson}
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(outDir, `${p.slug}.html`), html, 'utf8');
  console.log('Wrote', p.slug);
}

console.log('Done', products.length, 'pages');
