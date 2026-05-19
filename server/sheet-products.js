/** Default public CSV export (override with env SHEET_CSV_URL). */
export const DEFAULT_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1aaO-kSnl6fonfOcFhUkl3jNNDLF5_iWgxxFZtLviiZU/export?format=csv';

export function sheetCsvUrl() {
  const fromEnv = (process.env.SHEET_CSV_URL || '').trim();
  return fromEnv || DEFAULT_SHEET_CSV_URL;
}

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

export function parseSheetPrice(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function driveFileId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/?]+)/);
  return m ? m[1] : null;
}

export function parseImages(cell) {
  if (!cell) return [];
  return cell
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => {
      const driveId = driveFileId(u);
      if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
      if (/^https?:\/\//i.test(u)) return u;
      return null;
    })
    .filter(Boolean);
}

/** Header or row cells: index of stock column by common labels. */
export function findStockColumnIndex(c) {
  const labels = new Set(['inventory', 'stock', 'qty', 'quantity', 'available', 'inventario']);
  for (let i = 0; i < c.length; i++) {
    const h = (c[i] || '').trim().toLowerCase();
    if (labels.has(h)) return i;
  }
  return null;
}

/**
 * Raw rows that pass the same product filter as parseProducts (type + price in col 9).
 * @returns {{ rawRows: Array<{ _n: number, c: string[], type: string, weight: string, length: string, price: number, sheetStock: number|null }>, typeCounts: Record<string, number> }}
 */
function collectSheetProductableRows(csv) {
  const lines = csv.split('\n');
  let stockColIndex = null;
  const typeCounts = {};
  const rawRows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const c = parseCsvLine(line);
    const invIdx = findStockColumnIndex(c);
    if (invIdx != null) stockColIndex = invIdx;

    const rowNum = c[0]?.trim();
    if (!rowNum) continue;

    if (!/^\d+$/.test(rowNum)) continue;

    const type = c[2]?.trim() || '';
    const price = parseSheetPrice(c[9]);
    if (!type || price === null) continue;

    let sheetStock = null;
    if (stockColIndex != null && stockColIndex < c.length) {
      const raw = (c[stockColIndex] ?? '').trim();
      if (raw !== '') {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n)) sheetStock = Math.max(0, n);
      }
    }

    typeCounts[type] = (typeCounts[type] || 0) + 1;
    rawRows.push({
      _n: Number(rowNum),
      c,
      type,
      weight: c[3]?.trim() || '',
      length: c[4]?.trim() || '',
      price,
      sheetStock,
    });
  }

  return { rawRows, typeCounts };
}

export function parseProducts(csv) {
  const { rawRows, typeCounts } = collectSheetProductableRows(csv);
  const seen = {};
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  return rawRows.map((r) => {
    seen[r.type] = (seen[r.type] || 0) + 1;
    const nth = seen[r.type];
    const total = typeCounts[r.type];

    const name = r.type === 'Chain' && total > 1
      ? `Silver Chain ${numerals[nth - 1] || nth}`
      : r.type === 'Chain w/ Clover' ? 'Silver Chain with Clover'
      : r.type;

    const category = r.type.startsWith('Earring') ? 'Earrings' : 'Chains';
    const mat = [r.weight ? `${r.weight}g` : '', r.length || ''].filter(Boolean).join('  ') || 'Sterling silver .925';

    const product = {
      id: `product-${r._n}`,
      name,
      category,
      price: r.price,
      material: mat,
      images: parseImages(r.c[1]),
    };
    if (r.sheetStock != null) product.sheetStock = r.sheetStock;
    return product;
  });
}

/** Rows for Supabase `catalog_sheet` upsert (columns mirror the Google Sheet). */
export function parseCatalogSheetUpsertRows(csv) {
  const { rawRows } = collectSheetProductableRows(csv);
  return rawRows.map((r) => {
    const c = r.c;
    const inv = r.sheetStock != null ? r.sheetStock : 1;
    return {
      row_number: r._n,
      site_product_id: `product-${r._n}`,
      picture: (c[1] ?? '').trim(),
      type: (c[2] ?? '').trim(),
      weight_grams: (c[3] ?? '').trim(),
      length_inches: (c[4] ?? '').trim(),
      cost_per_gram_sol: (c[5] ?? '').trim(),
      cost_per_gram_usd: (c[6] ?? '').trim(),
      sale_price_per_gram: (c[7] ?? '').trim(),
      total_price_paid_sol: (c[8] ?? '').trim(),
      total_price_paid_usd: (c[9] ?? '').trim(),
      list_price: (c[10] ?? '').trim(),
      total_sale_list_price: (c[11] ?? '').trim(),
      profit: (c[12] ?? '').trim(),
      inventory: inv,
    };
  });
}
