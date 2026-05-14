-- Atomic inventory decrement — floors at 0, prevents overselling.
-- Run in Supabase → SQL Editor after 002/003.

-- For catalog_sheet (current schema)
create or replace function decrement_catalog_inventory(p_id text, p_qty integer)
returns void language sql security definer as $$
  update public.catalog_sheet
     set inventory = greatest(0, inventory - p_qty)
   where site_product_id = p_id;
$$;

-- For product_inventory (legacy schema from migration 001)
create or replace function decrement_product_inventory(p_id text, p_qty integer)
returns void language sql security definer as $$
  update public.product_inventory
     set quantity    = greatest(0, quantity - p_qty),
         updated_at  = now()
   where id = p_id;
$$;
