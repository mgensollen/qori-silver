function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const statusEl = document.getElementById('inv-status');
const tableBody = document.getElementById('inv-table-body');
const saveBtn = document.getElementById('inv-save');
const refreshBtn = document.getElementById('inv-refresh');
const inventoryInputs = new Map();
const itemNameInputs = new Map();

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--crimson-lt)' : 'var(--cream3)';
}

function rowHtml(p) {
  const storedName = p.item_name != null && String(p.item_name).trim() !== '' ? String(p.item_name).trim() : '';
  const cellStyle = 'padding:0.8rem;border-bottom:1px solid rgba(201,168,76,0.1)';
  return `
    <tr>
      <td style="${cellStyle}">
        <div class="piece-name">${escHtml(p.name)}</div>
        <div class="piece-mat">${escHtml(p.id)}</div>
      </td>
      <td style="${cellStyle}">
        <input data-item-name-id="${escAttr(p.id)}" type="text" maxlength="500" value="${escAttr(storedName)}" placeholder="${escAttr(p.name)}" style="width:100%;max-width:280px;padding:0.45rem;background:rgba(12,10,7,0.35);border:1px solid rgba(201,168,76,0.25);color:var(--cream)">
        <div class="piece-mat" style="margin-top:0.35rem">Shown on site when set; leave empty to use the default title.</div>
      </td>
      <td style="${cellStyle}">${money(p.price)}</td>
      <td style="${cellStyle}">
        <input data-inventory-id="${escAttr(p.id)}" type="number" min="0" step="1" value="${escAttr(String(p.inventory))}" style="width:120px;padding:0.45rem;background:rgba(12,10,7,0.35);border:1px solid rgba(201,168,76,0.25);color:var(--cream)">
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
    itemNameInputs.clear();
    tableBody.querySelectorAll('input[data-inventory-id]').forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      const id = el.getAttribute('data-inventory-id') || '';
      if (!id) return;
      inventoryInputs.set(id, el);
    });
    tableBody.querySelectorAll('input[data-item-name-id]').forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      const id = el.getAttribute('data-item-name-id') || '';
      if (!id) return;
      itemNameInputs.set(id, el);
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
  const item_names = {};
  for (const [id, input] of itemNameInputs.entries()) {
    item_names[id] = input.value.trim();
  }
  if (Object.keys(inventory).length === 0 && Object.keys(item_names).length === 0) {
    setStatus('Nothing to save.', true);
    return;
  }

  setStatus('Saving');
  try {
    const res = await fetch(`${apiBase}/api/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory, item_names }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const invPart = data.updated != null ? `${data.updated} qty` : '';
    const namePart = data.item_names_updated != null ? `${data.item_names_updated} names` : '';
    const summary = [invPart, namePart].filter(Boolean).join(', ');
    setStatus(summary ? `Saved (${summary}).` : 'Saved.');
  } catch (err) {
    setStatus(`Failed to save: ${err?.message || 'Unknown error'}`, true);
  }
}

saveBtn?.addEventListener('click', saveInventory);
refreshBtn?.addEventListener('click', loadInventory);
loadInventory();
