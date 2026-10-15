-- Las tablas de Compras se exponen a usuarios autenticados únicamente para lectura.
-- RLS conserva el aislamiento por empresa; las escrituras ocurren por RPC.
grant select on table public.purchase_orders to authenticated;
grant select on table public.purchase_order_lines to authenticated;
grant select on table public.purchase_order_receipts to authenticated;
grant select on table public.purchase_order_receipt_lines to authenticated;
grant select on table public.quote_follow_ups to authenticated;