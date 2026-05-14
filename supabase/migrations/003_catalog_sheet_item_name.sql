-- Display name from the website (overrides sheet "Type" naming in the API).
alter table public.catalog_sheet
  add column if not exists item_name text;

comment on column public.catalog_sheet.item_name is 'Public-facing product title; falls back to generated name if null.';
