import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const app = express();
// Render/NGINX style deployments sit behind a proxy. Trust it so `req.protocol`
// and related helpers reflect `X-Forwarded-*` headers (https).
app.set('trust proxy', 1);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment.');
}

const stripe = new Stripe(stripeSecretKey);

const corsOrigin = process.env.CORS_ORIGIN || '';
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const origin = corsOrigin.trim();
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Stripe-Signature');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  return next();
});

// Stripe webhooks require the raw request body for signature verification.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET in environment.');

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing Stripe signature.');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err?.message || err);
    return res.status(400).send('Invalid signature.');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data?.object?.id;
      if (typeof sessionId !== 'string') throw new Error('Missing session id.');

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'payment_intent'],
      });

      const record = {
        createdAt: new Date().toISOString(),
        type: event.type,
        session: {
          id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          currency: session.currency,
          amount_subtotal: session.amount_subtotal,
          amount_total: session.amount_total,
          customer_details: session.customer_details,
          shipping_details: session.shipping_details,
          payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
          line_items: session.line_items?.data ?? null,
        },
      };

      await appendOrderRecord(record);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler failed:', err);
    return res.status(500).send('Webhook handler failed.');
  }
});

app.use(express.json({ limit: '64kb' }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
app.use(express.static(webRoot));

async function appendOrderRecord(record) {
  const dataDir = path.resolve(__dirname, '..', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  const outFile = path.join(dataDir, 'orders.jsonl');
  await fs.appendFile(outFile, `${JSON.stringify(record)}\n`, 'utf8');
}

function toCents(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (cents < 50) return null;
  return cents;
}

function normalizeOrigin(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/$/, '');
}

function getCheckoutReturnOrigin(req) {
  // Prefer an explicit env var for correctness (recommended for production).
  // Example: CHECKOUT_RETURN_ORIGIN=https://your-site.example.com
  const fromEnv = normalizeOrigin(process.env.CHECKOUT_RETURN_ORIGIN);
  if (fromEnv) return fromEnv;

  // Fall back to the browser-provided Origin header (works for SPAs/static sites).
  const fromHeader = normalizeOrigin(req.get('origin'));
  if (fromHeader) return fromHeader;

  // Last resort: derive from request URL (may be the API domain).
  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
}

// Easiest MVP (no webhooks):
// after redirect to /success.html?session_id=..., the browser calls this endpoint to persist the order.
app.post('/api/save-order-from-session', async (req, res) => {
  try {
    const sessionId = req.body?.session_id;
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return res.status(400).send('Missing or invalid session_id.');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(409).send('Session is not paid.');
    }

    const record = {
      createdAt: new Date().toISOString(),
      type: 'success_redirect_capture',
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        currency: session.currency,
        amount_subtotal: session.amount_subtotal,
        amount_total: session.amount_total,
        customer_details: session.customer_details,
        shipping_details: session.shipping_details,
        payment_intent: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
        line_items: session.line_items?.data ?? null,
      },
    };

    await appendOrderRecord(record);
    return res.json({ saved: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Failed to save order.');
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalized = items
      .filter((it) => it && typeof it.name === 'string')
      .map((it) => {
        const unitAmount = toCents(it.price);
        const quantity = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));
        return {
          name: it.name.slice(0, 200),
          unitAmount,
          quantity,
        };
      })
      .filter((it) => it.unitAmount !== null);

    if (normalized.length === 0) {
      return res.status(400).send('Cart is empty or invalid.');
    }

    const returnOrigin = getCheckoutReturnOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US'] },
      line_items: normalized.map((it) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: it.name },
          unit_amount: it.unitAmount,
        },
        quantity: it.quantity,
      })),
      success_url: `${returnOrigin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnOrigin}/cancel.html`,
      automatic_tax: { enabled: false },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session failed:', err);
    // Return a slightly more actionable message (safe: does not include secrets).
    return res.status(500).send(err?.message || 'Failed to create Stripe Checkout session.');
  }
});

// ── Products — Google Sheets CSV ─────────────────────────────────────────────
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1aaO-kSnl6fonfOcFhUkl3jNNDLF5_iWgxxFZtLviiZU/export?format=csv';
let _productsCache = null;
let _productsCacheAt = 0;

function parseCsvLine(line) {
  const out = [];
  let field = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(field); field = ''; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

function parseSheetPrice(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function driveFileId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/?]+)/);
  return m ? m[1] : null;
}

function parseImages(cell) {
  if (!cell) return [];
  return cell.split(',')
    .map(u => driveFileId(u.trim()))
    .filter(Boolean)
    .map(id => `https://drive.google.com/thumbnail?id=${id}&sz=w800`);
}

function parseProducts(csv) {
  const lines = csv.split('\n');
  const typeCounts = {};
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const c = parseCsvLine(line);
    const rowNum = c[0]?.trim();
    if (!rowNum || !/^\d+$/.test(rowNum)) continue;
    const type = c[2]?.trim() || '';
    const price = parseSheetPrice(c[9]);
    if (!type || price === null) continue;

    typeCounts[type] = (typeCounts[type] || 0) + 1;
    rows.push({ _n: Number(rowNum), type, weight: c[3]?.trim() || '', length: c[4]?.trim() || '', price, images: parseImages(c[1]) });
  }

  const seen = {};
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  return rows.map(r => {
    seen[r.type] = (seen[r.type] || 0) + 1;
    const nth = seen[r.type];
    const total = typeCounts[r.type];

    const name = r.type === 'Chain' && total > 1
      ? `Silver Chain ${numerals[nth - 1] || nth}`
      : r.type === 'Chain w/ Clover' ? 'Silver Chain with Clover'
      : r.type;

    const category = r.type.startsWith('Earring') ? 'Earrings' : 'Chains';
    const mat = [r.weight ? `${r.weight}g` : '', r.length || ''].filter(Boolean).join(' · ') || 'Sterling silver .925';

    return { id: `product-${r._n}`, name, category, price: r.price, material: mat, images: r.images };
  });
}

app.get('/api/products', async (req, res) => {
  try {
    if (_productsCache && Date.now() - _productsCacheAt < 5 * 60 * 1000) {
      return res.json(_productsCache);
    }
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Sheet fetch ${response.status}`);
    const products = parseProducts(await response.text());
    _productsCache = products;
    _productsCacheAt = Date.now();
    return res.json(products);
  } catch (err) {
    console.error('Products fetch error:', err?.message);
    if (_productsCache) return res.json(_productsCache);
    return res.status(502).json({ error: 'Could not load products.' });
  }
});

const port = Number(process.env.PORT || 4242);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

