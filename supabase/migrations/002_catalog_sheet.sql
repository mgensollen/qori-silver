-- Full mirror of the Google Sheet product rows (one row per catalog item).
-- Replaces product_inventory: stock lives in catalog_sheet.inventory.
-- Run in Supabase SQL Editor after 001 (or on fresh projects run this only).

drop table if exists public.product_inventory;

create table if not exists public.catalog_sheet (
  row_number integer primary key,
  site_product_id text not null unique,
  picture text,
  type text,
  weight_grams text,
  length_inches text,
  cost_per_gram_sol text,
  cost_per_gram_usd text,
  sale_price_per_gram text,
  total_price_paid_sol text,
  total_price_paid_usd text,
  list_price text,
  total_sale_list_price text,
  profit text,
  inventory integer not null default 1 check (inventory >= 0)
);

comment on table public.catalog_sheet is 'Mirror of Google Sheet catalog + live inventory counts.';
