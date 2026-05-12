export const INVENTORY_DEFAULT_QTY = 1;

export function normalizeInventoryValue(value, fallback = 0) {
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
