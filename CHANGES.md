# Qori Silver — Changes Log
**Date:** 10 May 2026  
**Scope:** Copy consistency fixes + Full SEO implementation

---

## 1. Copy Consistency Fixes

### "Handcrafted in" — resolved
All three visible locations on the homepage (Hero eyebrow, Ticker, Footer) were inconsistent. Standardised to **"Handcrafted in Peru"** across:
- `index.html` — Hero, Ticker, Footer
- `care.html` — Footer
- `shipping.html` — Footer
- `shop.html` — Hero description (changed from "from Cusco, Peru" → "in Peru")

### "Since 1987" — removed
The ticker claimed "Since 1987" but the brand was founded in 2026. The segment was removed from the ticker in `index.html`.

### "Lifetime Warranty" — removed entirely
The ticker promoted a Lifetime Warranty that had no supporting policy page. Rather than create a policy the business cannot yet stand behind, all references were removed:
- Ticker segment deleted from `index.html`
- Footer links removed from `index.html`, `care.html`, `shipping.html`
- `warranty.html` (briefly created) was deleted
- Sitemap entry removed

---

## 2. SEO Implementation

### Strategy
- **Primary:** Long-tail keywords targeting Peruvian/Andean sterling silver jewelry (low competition, high purchase intent, realistic path to #1)
- **Opportunistic:** Moderate-volume informational keywords where boutique sites can compete (e.g. "how to clean sterling silver jewelry")

---

### 2a. Technical SEO

#### `robots.txt` — created
```
User-agent: *
Allow: /
Disallow: /success.html
Disallow: /cancel.html
Sitemap: https://www.qorisilver.com/sitemap.xml
```

#### `sitemap.xml` — created
All five indexable pages with priorities:
| Page | Priority | Changefreq |
|---|---|---|
| `/` (homepage) | 1.0 | weekly |
| `/shop.html` | 0.9 | weekly |
| `/care.html` | 0.6 | monthly |
| `/shipping.html` | 0.5 | monthly |

#### Canonical tags — added to all pages
Prevents duplicate-content penalties if the site is ever accessible at multiple URLs.

#### noindex — added to checkout pages
`cancel.html` and `success.html` now carry `<meta name="robots" content="noindex, nofollow">`. These pages have no SEO value and should not consume crawl budget.

---

### 2b. On-Page SEO

#### Title tags — optimised on all pages

| Page | Before | After |
|---|---|---|
| `index.html` | Qori Silver — Peruvian Fine Jewelry | Qori Silver \| Handcrafted Peruvian Sterling Silver Jewelry |
| `shop.html` | Qori Silver — Shop | Shop Peruvian Sterling Silver Jewelry \| Qori Silver — Made to Order |
| `care.html` | Care Guide — Qori Silver | How to Care for Sterling Silver Jewelry \| Qori Silver |
| `shipping.html` | Shipping & Returns — Qori Silver | Free Worldwide Shipping & 30-Day Returns \| Qori Silver |

#### Meta descriptions — added to all pages (previously missing on every page)

| Page | Meta Description |
|---|---|
| `index.html` | Shop handcrafted sterling silver jewelry from Peru. Qori Silver crafts Andean-inspired necklaces, bracelets and earrings in .95 silver — made to order with free worldwide shipping. |
| `shop.html` | Browse handcrafted Peruvian sterling silver necklaces, bracelets and earrings. Each piece is made to order in .95 silver, inspired by Andean and Inca symbols. Free worldwide shipping. |
| `care.html` | Complete guide to cleaning, storing and polishing sterling silver jewelry. Learn how to prevent tarnish, restore shine at home, and protect gemstone pieces. |
| `shipping.html` | Qori Silver ships worldwide for free on all orders. Not satisfied? Return any unworn piece within 30 days for a full refund — no questions asked. |

#### H1 tags — fixed on pages that had none

| Page | Issue | Fix |
|---|---|---|
| `care.html` | Had H2 as the main heading, no H1 | Changed to H1: "How to Care for Sterling Silver Jewelry" |
| `shipping.html` | Had H2 as the main heading, no H1 | Changed to H1: "Free Worldwide Shipping & 30-Day Returns" |
| `shop.html` | H1 was just "Shop" | Changed to H1: "Peruvian Sterling Silver Jewelry" |

#### Open Graph + Twitter Card tags — added to all pages
Ensures correct title, description, and image appear when the site is shared on social media or in messaging apps. The homepage and shop page use a product image; support pages use `summary` card format.

#### Keywords meta tags — added to all indexable pages
Targets: `Peruvian sterling silver jewelry`, `handcrafted silver jewelry Peru`, `Andean silver jewelry`, `Inca symbol jewelry`, `Chakana cross sterling silver`, `how to care for sterling silver jewelry`, and related phrases.

---

### 2c. Structured Data (JSON-LD / Schema.org)

#### `index.html` — Organization + WebSite schema
Tells Google who the brand is, where it is based, and what it sells. Enables Knowledge Panel eligibility.
```json
Organization: Qori Silver
  name, url, email, address (Cusco, PE), hasOfferCatalog → shop.html

WebSite: https://www.qorisilver.com/
  publisher → Organization
```

#### `shop.html` — ItemList + Product schema (all 7 products)
Each product includes name, description, brand, material, price, currency, and availability. Enables **rich snippets** in Google search results (price shown directly in the result).

| # | Product | Price |
|---|---|---|
| 1 | Amaru Curb Necklace & Bracelet | $310.00 |
| 2 | Inti Heavy Curb Set | $479.00 |
| 3 | Killa Curb Necklace & Bracelet | $146.00 |
| 4 | Qori Figaro Necklace & Bracelet | $246.00 |
| 5 | Pachamama Clover Necklace | $133.00 |
| 6 | Inti Solar Disc Earring Set | $52.00 |
| 7 | Chakana Cross Earring Set | $141.00 |

#### `care.html` — FAQPage schema
Wraps the four care guide sections as structured Q&A. Targets Google's **Featured Snippet / People Also Ask** boxes for queries like:
- "how do I clean sterling silver jewelry at home"
- "how should I store sterling silver jewelry"
- "why does sterling silver tarnish"
- "when should I remove sterling silver jewelry"

---

## 3. Files Changed

| File | Changes |
|---|---|
| `index.html` | Title, meta description, canonical, OG/Twitter tags, keywords; ticker "Since 1987" removed; ticker "Lifetime Warranty" removed; footer warranty link removed; Organization + WebSite JSON-LD added |
| `shop.html` | Title, meta description, canonical, OG/Twitter tags, keywords; H1 updated; hero description updated; Product ItemList JSON-LD added |
| `care.html` | Title, meta description, canonical, OG/Twitter tags, keywords; H2 → H1, heading text updated; footer warranty link removed; FAQPage JSON-LD added |
| `shipping.html` | Title, meta description, canonical, OG/Twitter tags, keywords; H2 → H1, heading text updated; footer warranty link removed |
| `cancel.html` | noindex, nofollow added |
| `success.html` | noindex, nofollow added |
| `robots.txt` | Created |
| `sitemap.xml` | Created |
| `warranty.html` | Created then deleted (warranty claim removed) |

---

## 4. Next Steps Recommended

1. **Submit sitemap to Google Search Console** — go to search.google.com/search-console, add the property `https://www.qorisilver.com/`, and submit `https://www.qorisilver.com/sitemap.xml` under the Sitemaps section.
2. **Replace OG/Twitter image** — currently using a Google Drive product thumbnail. Ideally upload a dedicated 1200×630px branded image to the server and update the `og:image` and `twitter:image` tags on all pages.
3. **Add a favicon** — no `<link rel="icon">` is present. A favicon improves brand recognition in search results and browser tabs.
4. **Google Business Profile** — if targeting local or travel-based shoppers (people visiting Cusco), claim and optimise a Google Business Profile.
5. **Backlinks** — the fastest way to climb rankings after technical SEO is inbound links. Target travel blogs about Peru, Andean culture sites, and ethical/artisan jewelry directories.
6. **Product page URLs** — currently all products live on one `shop.html` page. Individual product pages (e.g. `/amaru-curb-necklace.html`) would allow each product to rank independently and carry its own Product schema with reviews.
