-- Legacy one-column inventory table (superseded by 002_catalog_sheet.sql).
-- New setups: run only supabase/migrations/002_catalog_sheet.sql
-- Run in Supabase → SQL Editor (or supabase db push).
-- Table used by the Node server when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.

create table if not exists public.product_inventory (
  id text primary key,
  quantity integer not null default 1 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.product_inventory is 'Per-product stock counts; server merges with Google Sheet defaults.';
