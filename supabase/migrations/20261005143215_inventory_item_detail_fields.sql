-- Ficha técnica persistente para materiales, herramientas y equipos.
alter table public.inventory_items
  add column if not exists technical_reference text,
  add column if not exists model text,
  add column if not exists serial_number text,
  add column if not exists acquired_at date,
  add column if not exists warranty_until date,
  add column if not exists asset_condition text,
  add column if not exists purchase_unit text,
  add column if not exists units_per_purchase numeric(14,3),
  add column if not exists purchase_unit_cost numeric(14,2);
