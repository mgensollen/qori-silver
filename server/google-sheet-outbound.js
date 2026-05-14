import { google } from 'googleapis';
import { getSupabaseClient, inventoryUsesSupabase } from './inventory-store.js';
import { findStockColumnIndex, sheetCsvUrl } from './sheet-products.js';

function spreadsheetIdFromEnv() {
  const id = (process.env.GOOGLE_SHEET_SPREADSHEET_ID || '').trim();
  if (id) return id;
  const url = sheetCsvUrl();
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : '';
}

function columnLetterToIndex(letter) {
  const L = String(letter || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (!L) return null;
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    n = n * 26 + (L.charCodeAt(i) - 64);
  }
  return n - 1;
}

function columnIndexToLetter(idx) {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function sheetsClient() {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) {
    throw new Error(
      'Set GOOGLE_SERVICE_ACCOUNT_JSON to a service-account JSON string (share the spreadsheet with its client_email as Editor).',
    );
  }
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Write catalog_sheet.inventory back to the Google Sheet (same row_number = sheet row index).
 */
export async function pushInventoryToGoogleSheet() {
  if (!inventoryUsesSupabase()) {
    throw new Error('Supabase is required to push inventory from catalog_sheet.');
  }
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase client unavailable.');

  const spreadsheetId = spreadsheetIdFromEnv();
  if (!spreadsheetId) {
    throw new Error('Set GOOGLE_SHEET_SPREADSHEET_ID or a SHEET_CSV_URL that includes the spreadsheet id.');
  }

  const tabRaw = (process.env.GOOGLE_SHEET_TAB_NAME || '').trim();
  const tab = tabRaw || 'Sheet1';

  const { data: rows, error } = await sb
    .from('catalog_sheet')
    .select('row_number, inventory')
    .order('row_number', { ascending: true });
  if (error) throw new Error(`Supabase catalog_sheet read: ${error.message}`);
  if (!rows?.length) return { updated: 0, reason: 'no_rows' };

  const sheets = await sheetsClient();

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab.replace(/'/g, "''")}'!1:1`,
  });
  const headers = headerRes.data.values?.[0] || [];
  let colIdx = findStockColumnIndex(headers);
  const letterEnv = (process.env.GOOGLE_SHEET_INVENTORY_COLUMN_LETTER || '').trim();
  if (colIdx == null && letterEnv) {
    colIdx = columnLetterToIndex(letterEnv);
  }
  if (colIdx == null) {
    throw new Error(
      'Could not detect an Inventory column in row 1. Add a header like "Inventory" or set GOOGLE_SHEET_INVENTORY_COLUMN_LETTER (e.g. M).',
    );
  }
  const colLetter = columnIndexToLetter(colIdx);
  const safeTab = tab.replace(/'/g, "''");

  const data = rows.map((r) => ({
    range: `'${safeTab}'!${colLetter}${r.row_number}`,
    values: [[Math.max(0, Math.floor(Number(r.inventory) || 0))]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });

  return { updated: data.length };
}
