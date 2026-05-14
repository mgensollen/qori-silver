export const INVENTORY_DEFAULT_QTY = 1;

/**
 * Parse a single stored inventory cell (DB, file, sheet). Null/blank/invalid → null (unknown).
 * Important: Number(null) === 0 in JS — do not use Number() before checking null.
 */
export function parseStoredInventory(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

export function normalizeInventoryValue(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function mapInventoryForProducts(products, inventoryMap) {
  const next = {};
  for (const p of products) {
    const hasFile = Object.prototype.hasOwnProperty.call(inventoryMap, p.id);
    const fromSheet =
      p.sheetStock != null && Number.isFinite(Number(p.sheetStock))
        ? normalizeInventoryValue(p.sheetStock, INVENTORY_DEFAULT_QTY)
        : null;
    if (hasFile) {
      next[p.id] = normalizeInventoryValue(inventoryMap[p.id], INVENTORY_DEFAULT_QTY);
    } else if (fromSheet != null) {
      next[p.id] = fromSheet;
    } else {
      next[p.id] = INVENTORY_DEFAULT_QTY;
    }
  }
  return next;
}
