import express from 'express';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import {
  inventoryUsesSupabase,
  inventoryStateEquals,
  readInventoryMap,
  writeInventoryMap,
  decrementInventoryItem,
} from './inventory-store.js';
import { parseProducts, sheetCsvUrl } from './sheet-products.js';
import {
  INVENTORY_DEFAULT_QTY,
  normalizeInventoryValue,
  mapInventoryForProducts,
} from './inventory-merge.js';
import { bootstrapCatalogFromCsv, countCatalogRows, fetchProductsFromCatalogSheet, updateCatalogItemNames } from './catalog-sheet-db.js';
import { runCatalogSync } from './catalog-sync.js';
import { productSlugForSiteId } from './product-urls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const app = express();
// Render/NGINX style deployments sit behind a proxy. Trust it so `req.protocol`
// and related helpers reflect `X-Forwarded-*` headers (https).
app.set('trust proxy', 1);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment.');
}

const stripe = new Stripe(stripeSecretKey);

const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || 'https://www.qorisilver.com,https://qorisilver.com,https://mgensollen.github.io')
    .split(',').map(s => s.trim()).filter(Boolean)
);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const reqOrigin = req.get('origin') || '';
    const allow = allowedOrigins.has(reqOrigin) ? reqOrigin : '*';
    res.setHeader('Access-Control-Allow-Origin', allow);
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
        expand: ['line_items', 'line_items.data.price.product', 'payment_intent'],
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
      await decrementInventoryFromSession(session);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler failed:', err);
    return res.status(500).send('Webhook handler failed.');
  }
});

app.use(express.json({ limit: '64kb' }));
const webRoot = path.resolve(__dirname, '..');
app.use(express.static(webRoot));

const dataDir = path.resolve(__dirname, '..', 'data');
const inventoryFile = path.join(dataDir, 'inventory.json');
const processedSessionsFile = path.join(dataDir, 'processed-sessions.json');
const stripeCatalogFile = path.join(dataDir, 'stripe-catalog.json');

async function appendOrderRecord(record) {
  await fs.mkdir(dataDir, { recursive: true });
  const outFile = path.join(dataDir, 'orders.jsonl');
  await fs.appendFile(outFile, `${JSON.stringify(record)}\n`, 'utf8');
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function toStripeUnitAmount(price) {
  const cents = toCents(price);
  if (cents === null) throw new Error('Invalid product price.');
  return cents;
}

function buildStripeProductDescription(product) {
  const parts = [
    `Category: ${product.category}`,
    product.material ? `Details: ${product.material}` : '',
  ].filter(Boolean);
  return parts.join(' | ').slice(0, 5000);
}

function normalizeStripeCatalog(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    out[id] = {
      stripeProductId: typeof value.stripeProductId === 'string' ? value.stripeProductId : '',
      stripePriceId: typeof value.stripePriceId === 'string' ? value.stripePriceId : '',
      unitAmount: Number.isFinite(Number(value.unitAmount)) ? Number(value.unitAmount) : null,
      syncedAt: typeof value.syncedAt === 'string' ? value.syncedAt : '',
    };
  }
  return out;
}

async function getStripeProductByMetadataId(siteProductId) {
  let startingAfter;
  while (true) {
    const page = await stripe.products.list({ limit: 100, active: true, starting_after: startingAfter });
    const hit = page.data.find((p) => p?.metadata?.site_product_id === siteProductId);
    if (hit) return hit;
    if (!page.has_more || page.data.length === 0) return null;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function ensureStripeProductAndPrice(product, catalog) {
  const existing = catalog[product.id] ?? {};
  const unitAmount = toStripeUnitAmount(product.price);
  let stripeProduct = null;

  if (existing.stripeProductId) {
    try {
      stripeProduct = await stripe.products.retrieve(existing.stripeProductId);
      if (stripeProduct.deleted) stripeProduct = null;
    } catch {
      stripeProduct = null;
    }
  }

  if (!stripeProduct) {
    stripeProduct = await getStripeProductByMetadataId(product.id);
  }

  if (!stripeProduct) {
    stripeProduct = await stripe.products.create({
      name: product.name,
      description: buildStripeProductDescription(product),
      metadata: {
        site_product_id: product.id,
      },
      images: Array.isArray(product.images) && product.images[0] ? [product.images[0]] : undefined,
    });
  } else {
    await stripe.products.update(stripeProduct.id, {
      name: product.name,
      description: buildStripeProductDescription(product),
      metadata: {
        ...stripeProduct.metadata,
        site_product_id: product.id,
      },
      images: Array.isArray(product.images) && product.images[0] ? [product.images[0]] : undefined,
    });
  }

  let stripePriceId = existing.stripePriceId || '';
  let mustCreatePrice = true;
  if (stripePriceId) {
    try {
      const oldPrice = await stripe.prices.retrieve(stripePriceId);
      mustCreatePrice = !oldPrice.active || oldPrice.unit_amount !== unitAmount || oldPrice.currency !== 'usd';
    } catch {
      mustCreatePrice = true;
    }
  }

  if (mustCreatePrice) {
    const newPrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: unitAmount,
      product: stripeProduct.id,
      metadata: { site_product_id: product.id },
    });
    stripePriceId = newPrice.id;
    await stripe.products.update(stripeProduct.id, { default_price: stripePriceId });
  }

  catalog[product.id] = {
    stripeProductId: stripeProduct.id,
    stripePriceId,
    unitAmount,
    syncedAt: new Date().toISOString(),
  };

  return catalog[product.id];
}

async function syncStripeCatalog(products) {
  const current = normalizeStripeCatalog(await readJsonFile(stripeCatalogFile, {}));
  const next = { ...current };
  for (const product of products) {
    await ensureStripeProductAndPrice(product, next);
  }
  await writeJsonFile(stripeCatalogFile, next);
  return next;
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

/** Base URL for Stripe return links (no trailing slash). Includes path for GitHub Pages project sites. */
function returnBaseFromReferer(referer) {
  if (!referer || typeof referer !== 'string') return '';
  try {
    const u = new URL(referer);
    if (!/^https?:$/i.test(u.protocol)) return '';
    let pathname = (u.pathname || '/').replace(/\/+$/, '');
    const lastSeg = pathname.split('/').pop() || '';
    if (lastSeg.includes('.')) {
      pathname = pathname.slice(0, pathname.lastIndexOf('/'));
    }
    return `${u.origin}${pathname}`;
  } catch {
    return '';
  }
}

function isAllowedReturnBase(base) {
  if (!base) return false;
  try {
    return allowedOrigins.has(new URL(base).origin);
  } catch {
    return false;
  }
}

function getCheckoutReturnOrigin(req, explicitBase) {
  // Prefer an explicit env var (recommended for production).
  // For GitHub *project* pages, include the repo path, e.g.
  // CHECKOUT_RETURN_ORIGIN=https://user.github.io/repo-name
  const fromEnv = normalizeOrigin(process.env.CHECKOUT_RETURN_ORIGIN);
  if (fromEnv) return fromEnv;

  const fromBody = typeof explicitBase === 'string' ? normalizeOrigin(explicitBase.trim()) : '';
  if (fromBody && isAllowedReturnBase(fromBody)) return fromBody;

  // GitHub Pages: Origin is only https://user.github.io — missing /repo breaks success.html.
  // Referer is often the full page URL (includes /repo/...), so derive the site base from it.
  const fromReferer = returnBaseFromReferer(req.get('referer'));
  if (fromReferer && isAllowedReturnBase(fromReferer)) return fromReferer;

  // Fall back to the browser-provided Origin header (OK for apex / www sites at domain root).
  const fromHeader = normalizeOrigin(req.get('origin'));
  if (fromHeader && isAllowedReturnBase(fromHeader)) return fromHeader;

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
      expand: ['line_items', 'line_items.data.price.product', 'payment_intent'],
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
    await decrementInventoryFromSession(session);
    return res.json({ saved: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Failed to save order.');
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const { products, inventory } = await getProductsWithInventory();
    const stripeCatalog = await syncStripeCatalog(products);
    const byId = new Map(products.map((p) => [p.id, p]));
    const requested = [];

    for (const item of items) {
      const id = typeof item?.id === 'string' ? item.id : '';
      const product = byId.get(id);
      if (!product) continue;
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1)));
      const unitAmount = toCents(product.price);
      if (unitAmount === null) continue;
      const stripeProduct = stripeCatalog[id];
      if (!stripeProduct?.stripePriceId) {
        return res.status(500).json({ error: `Stripe product sync failed for ${product.name}.` });
      }

      const available = normalizeInventoryValue(inventory[id], INVENTORY_DEFAULT_QTY);
      if (quantity > available) {
        return res.status(409).json({
          error: `Not enough inventory for ${product.name}.`,
          productId: id,
          available,
        });
      }

      requested.push({
        id,
        name: product.name.slice(0, 200),
        stripePriceId: stripeProduct.stripePriceId,
        quantity,
      });
    }

    if (requested.length === 0) {
      return res.status(400).send('Cart is empty or invalid.');
    }

    const returnOrigin = getCheckoutReturnOrigin(req, req.body?.return_base);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US'] },
      line_items: requested.map((it) => ({
        price: it.stripePriceId,
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

// ── Products — Google Sheets CSV (see server/sheet-products.js) ─────────────
let _productsCache = null;
let _productsCacheAt = 0;

function invalidateProductCache() {
  _productsCache = null;
  _productsCacheAt = 0;
}

async function fetchProducts() {
  // 30-second cache for all paths. Safe because invalidateProductCache() is called
  // by the Stripe webhook whenever a purchase decrements inventory.
  if (_productsCache && Date.now() - _productsCacheAt < 30 * 1000) {
    return _productsCache;
  }
  if (inventoryUsesSupabase()) {
    try {
      const fromDb = await fetchProductsFromCatalogSheet();
      if (fromDb.length > 0) {
        _productsCache = fromDb;
        _productsCacheAt = Date.now();
        return fromDb;
      }
    } catch (err) {
      console.warn('Supabase catalog_sheet read failed, using Google Sheet:', err?.message);
    }
    const response = await fetch(sheetCsvUrl());
    if (!response.ok) throw new Error(`Sheet fetch ${response.status}`);
    return parseProducts(await response.text());
  }
  const response = await fetch(sheetCsvUrl());
  if (!response.ok) throw new Error(`Sheet fetch ${response.status}`);
  const products = parseProducts(await response.text());
  _productsCache = products;
  _productsCacheAt = Date.now();
  return products;
}

async function getProductsWithInventory() {
  let products = await fetchProducts();
  let current = await readInventoryMap(inventoryFile, readJsonFile);

  if (inventoryUsesSupabase()) {
    // When Supabase is the inventory backend, never fall back to potentially stale
    // sheetStock values from the 5-minute product cache. readInventoryMap (live) is
    // the sole authority; products with NULL inventory default to INVENTORY_DEFAULT_QTY.
    const stripSheetStock = (ps) => ps.map(({ sheetStock, ...rest }) => rest);

    let inventory = mapInventoryForProducts(stripSheetStock(products), current);

    try {
      if ((await countCatalogRows()) === 0 && products.length > 0) {
        await bootstrapCatalogFromCsv(inventory);
        _productsCache = null;
        _productsCacheAt = 0;
        products = await fetchProducts();
        current = await readInventoryMap(inventoryFile, readJsonFile);
        inventory = mapInventoryForProducts(stripSheetStock(products), current);
      }
    } catch (err) {
      console.warn('catalog_sheet bootstrap:', err?.message);
    }
    if (!inventoryStateEquals(current, inventory)) {
      await writeInventoryMap(inventoryFile, inventory, writeJsonFile);
    }
    return { products, inventory };
  }

  let inventory = mapInventoryForProducts(products, current);
  if (!inventoryStateEquals(current, inventory)) {
    await writeInventoryMap(inventoryFile, inventory, writeJsonFile);
  }
  return { products, inventory };
}

async function markSessionProcessed(sessionId) {
  const processed = await readJsonFile(processedSessionsFile, []);
  const set = new Set(Array.isArray(processed) ? processed : []);
  if (set.has(sessionId)) return false;
  set.add(sessionId);
  await writeJsonFile(processedSessionsFile, [...set]);
  return true;
}

function normalizePurchasedItems(lineItems) {
  const totals = {};
  for (const line of lineItems ?? []) {
    const price = line?.price;
    const productObj =
      typeof price?.product === 'object' && price?.product && !Array.isArray(price.product)
        ? price.product
        : null;
    const siteFromMeta = productObj?.metadata?.site_product_id ?? price?.metadata?.site_product_id;
    const siteProductId = typeof siteFromMeta === 'string' ? siteFromMeta.trim() : '';
    const productMetaId =
      typeof productObj?.metadata?.product_id === 'string' ? productObj.metadata.product_id.trim() : '';
    const fallbackId =
      typeof productObj?.metadata?.id === 'string' ? productObj.metadata.id.trim() : '';
    /** Catalog ids are site_product_id (e.g. product-3). Prefer it so a shared legacy product_id cannot collapse many lines into one id. */
    const productId = siteProductId || productMetaId || fallbackId;
    if (!productId) continue;
    const qty = Math.max(1, Math.floor(Number(line?.quantity) || 1));
    totals[productId] = (totals[productId] || 0) + qty;
  }
  return totals;
}

async function decrementInventoryFromSession(session) {
  const sessionId = session?.id;
  if (typeof sessionId !== 'string') throw new Error('Missing session id.');

  const purchased = normalizePurchasedItems(session?.line_items?.data ?? []);
  const purchasedIds = Object.keys(purchased);
  if (purchasedIds.length === 0) return { updated: false, reason: 'no_product_ids' };

  const shouldProcess = await markSessionProcessed(sessionId);
  if (!shouldProcess) return { updated: false, reason: 'already_processed' };

  const { products } = await getProductsWithInventory();
  const catalogIds = new Set(products.map((p) => p.id));

  if (inventoryUsesSupabase()) {
    // ── Atomic path: one SQL UPDATE per line-item, floors at 0 ──────────
    let anyAtomic = false;
    for (const id of purchasedIds) {
      if (!catalogIds.has(id)) {
        console.warn(`Decrement skipped unknown id: ${id}`);
        continue;
      }
      const result = await decrementInventoryItem(id, purchased[id]);
      if (result !== null) {
        console.log(`Decremented ${id} by ${purchased[id]}, new qty: ${result}`);
        anyAtomic = true;
      }
    }
    if (anyAtomic) {
      invalidateProductCache();
      return { updated: true };
    }
    // RPC not yet deployed — fall through to JS read-modify-write below
  }

  // ── JS read-modify-write (fallback / non-Supabase) ───────────────────
  const current = await readInventoryMap(inventoryFile, readJsonFile);
  const inventory = mapInventoryForProducts(products, current);

  for (const id of purchasedIds) {
    if (!catalogIds.has(id)) continue;
    const next = normalizeInventoryValue(inventory[id], INVENTORY_DEFAULT_QTY) - purchased[id];
    inventory[id] = Math.max(0, next);
  }

  const inventoryOut = {};
  for (const p of products) inventoryOut[p.id] = inventory[p.id];
  await writeInventoryMap(inventoryFile, inventoryOut, writeJsonFile);
  invalidateProductCache();
  return { updated: true };
}

app.get('/api/products', async (req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    // When Supabase is active, read directly — no caching, no merging, no write-back.
    // catalog_sheet.inventory is the sole truth: 1 = available, 0 = sold out, NULL = sold out.
    if (inventoryUsesSupabase()) {
      const products = await fetchProductsFromCatalogSheet();
      return res.json(products.map((p) => {
        const { sheetStock, item_name, ...rest } = p;
        const slug = productSlugForSiteId(p.id);
        return {
          ...rest,
          slug,
          inventory: normalizeInventoryValue(sheetStock, 0),
        };
      }));
    }

    const { products, inventory } = await getProductsWithInventory();
    return res.json(products.map((p) => {
      const { sheetStock, item_name, ...rest } = p;
      const slug = productSlugForSiteId(p.id);
      return {
        ...rest,
        slug,
        inventory: normalizeInventoryValue(inventory[p.id], INVENTORY_DEFAULT_QTY),
      };
    }));
  } catch (err) {
    console.error('Products fetch error:', err?.message);
    return res.status(502).json({ error: 'Could not load products.' });
  }
});

// Lightweight ping — hit this every 10 min from UptimeRobot/cron-job.org to prevent cold starts
app.get('/api/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

app.get('/api/debug-inventory', async (_req, res) => {
  const usingSupabase = inventoryUsesSupabase();
  const result = { usingSupabase, products: [] };
  try {
    if (usingSupabase) {
      const products = await fetchProductsFromCatalogSheet();
      result.products = products.map(p => ({ id: p.id, supabaseInventory: p.sheetStock ?? null }));
    } else {
      result.note = 'Supabase not configured — reading from Google Sheet CSV + local file';
      const { products, inventory } = await getProductsWithInventory();
      result.products = products.map(p => ({ id: p.id, computedInventory: inventory[p.id] ?? null, sheetStock: p.sheetStock ?? null }));
    }
  } catch (e) {
    result.error = e.message;
  }
  res.json(result);
});

app.get('/api/inventory', async (req, res) => {
  try {
    const { products, inventory } = await getProductsWithInventory();
    const rows = products.map((p) => ({
      id: p.id,
      name: p.name,
      item_name: p.item_name ?? null,
      price: p.price,
      inventory: normalizeInventoryValue(inventory[p.id], INVENTORY_DEFAULT_QTY),
    }));
    return res.json(rows);
  } catch (err) {
    console.error('Inventory fetch error:', err?.message);
    return res.status(500).json({ error: 'Could not load inventory.' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const patch = req.body?.inventory;
    const namePatch = req.body?.item_names;
    const hasInv = patch && typeof patch === 'object' && !Array.isArray(patch);
    const hasNames = namePatch && typeof namePatch === 'object' && !Array.isArray(namePatch);
    if (!hasInv && !hasNames) {
      return res.status(400).json({ error: 'Expected inventory object and/or item_names object.' });
    }

    const { products, inventory } = await getProductsWithInventory();
    const validIds = new Set(products.map((p) => p.id));
    let touched = 0;
    if (hasInv) {
      for (const [id, value] of Object.entries(patch)) {
        if (!validIds.has(id)) continue;
        inventory[id] = normalizeInventoryValue(value, INVENTORY_DEFAULT_QTY);
        touched += 1;
      }
    }

    if (hasInv && touched === 0) {
      return res.status(400).json({ error: 'No valid product ids in inventory payload.' });
    }

    if (touched > 0) {
      await writeInventoryMap(inventoryFile, inventory, writeJsonFile);
    }

    let namesUpdated = 0;
    if (hasNames) {
      namesUpdated = await updateCatalogItemNames(namePatch, validIds);
    }

    if (touched > 0 || namesUpdated > 0) {
      invalidateProductCache();
    }
    return res.json({ updated: touched, item_names_updated: namesUpdated });
  } catch (err) {
    console.error('Inventory update error:', err?.message);
    return res.status(500).json({ error: 'Could not update inventory.' });
  }
});

app.post('/api/cron/catalog-sync', async (req, res) => {
  try {
    const expected = (process.env.CATALOG_SYNC_SECRET || '').trim();
    if (!expected) {
      return res.status(503).json({ error: 'CATALOG_SYNC_SECRET is not set (add it to enable scheduled sync).' });
    }
    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const headerTok = (req.get('x-catalog-sync-token') || '').trim();
    if (bearer !== expected && headerTok !== expected) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const pull = req.body?.pull !== false && req.query?.pull !== '0';
    const push = req.body?.push !== false && req.query?.push !== '0';

    const result = await runCatalogSync({ pull, push });
    if (pull) {
      invalidateProductCache();
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('catalog-sync cron error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Catalog sync failed.' });
  }
});

app.post('/api/stripe-sync-products', async (req, res) => {
  try {
    const expectedToken = (process.env.STRIPE_SYNC_TOKEN || '').trim();
    if (expectedToken) {
      const provided = (req.get('x-sync-token') || '').trim();
      if (!provided || provided !== expectedToken) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
    }

    const { products } = await getProductsWithInventory();
    const catalog = await syncStripeCatalog(products);
    return res.json({
      synced: products.length,
      catalogSize: Object.keys(catalog).length,
    });
  } catch (err) {
    console.error('Stripe sync error:', err?.message || err);
    return res.status(500).json({ error: 'Could not sync Stripe products.' });
  }
});

app.get('/api/stripe-mode', (req, res) => {
  const mode = stripeSecretKey.startsWith('sk_test_') ? 'test' : 'live';
  return res.json({ mode });
});

const port = Number(process.env.PORT || 4242);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(
    inventoryUsesSupabase()
      ? 'Inventory backend: Supabase Postgres (catalog_sheet)'
      : 'Inventory backend: data/inventory.json — set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL or SUPABASE_PROJECT_REF',
  );
});

