function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

const statusEl = document.getElementById('inv-status');
const tableBody = document.getElementById('inv-table-body');
const saveBtn = document.getElementById('inv-save');
const refreshBtn = document.getElementById('inv-refresh');
const inventoryInputs = new Map();

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--crimson-lt)' : 'var(--cream3)';
}

function rowHtml(p) {
  return `
    <tr>
      <td style="padding:0.8rem;border-bottom:1px solid rgba(201,168,76,0.1)">
        <div class="piece-name">${p.name}</div>
        <div class="piece-mat">${p.id}</div>
      </td>
      <td style="padding:0.8rem;border-bottom:1px solid rgba(201,168,76,0.1)">${money(p.price)}</td>
      <td style="padding:0.8rem;border-bottom:1px solid rgba(201,168,76,0.1)">
        <input data-inventory-id="${p.id}" type="number" min="0" step="1" value="${p.inventory}" style="width:120px;padding:0.45rem;background:rgba(12,10,7,0.35);border:1px solid rgba(201,168,76,0.25);color:var(--cream)">
      </td>
    </tr>
  `;
}

async function loadInventory() {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  setStatus('Loading inventory...');
  try {
    const res = await fetch(`${apiBase}/api/inventory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Invalid payload.');
    if (!tableBody) return;
    tableBody.innerHTML = rows.map(rowHtml).join('');
    inventoryInputs.clear();
    tableBody.querySelectorAll('input[data-inventory-id]').forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      const id = el.getAttribute('data-inventory-id') || '';
      if (!id) return;
      inventoryInputs.set(id, el);
    });
    setStatus(`Loaded ${rows.length} products.`);
  } catch (err) {
    setStatus(`Failed to load inventory: ${err?.message || 'Unknown error'}`, true);
  }
}

async function saveInventory() {
  const apiBase = (window.QORI_API_BASE || '').toString().replace(/\/$/, '');
  const inventory = {};
  for (const [id, input] of inventoryInputs.entries()) {
    const qty = Math.max(0, Math.floor(Number(input.value) || 0));
    inventory[id] = qty;
  }
  if (Object.keys(inventory).length === 0) {
    setStatus('Nothing to save.', true);
    return;
  }

  setStatus('Saving inventory...');
  try {
    const res = await fetch(`${apiBase}/api/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    setStatus(`Saved inventory (${data.updated ?? 0} products).`);
  } catch (err) {
    setStatus(`Failed to save inventory: ${err?.message || 'Unknown error'}`, true);
  }
}

saveBtn?.addEventListener('click', saveInventory);
refreshBtn?.addEventListener('click', loadInventory);
loadInventory();
