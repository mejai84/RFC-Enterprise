alter type public.inventory_movement_type add value if not exists 'transfer';
alter table public.inventory_movements drop constraint if exists inventory_movements_quantity_check;
alter table public.inventory_movements add constraint inventory_movements_quantity_check check (quantity >= 0);

create or replace function private.apply_inventory_movement()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare delta numeric(14,3); current_quantity numeric(14,3); current_cost numeric(14,2); current_status text; next_cost numeric(14,2);
begin
  select case new.movement_type when 'entry' then new.quantity when 'adjustment_in' then new.quantity when 'transfer' then 0 else -new.quantity end into delta;
  select quantity, unit_cost, valuation_status into current_quantity, current_cost, current_status from public.inventory_stock where id=new.stock_id and company_id=new.company_id and branch_id=new.branch_id for update;
  if not found then raise exception 'El movimiento no corresponde a la existencia seleccionada'; end if;
  next_cost := current_cost;
  if new.movement_type='entry' and new.unit_cost>0 and current_status='confirmed' then next_cost := case when current_quantity<=0 then new.unit_cost else round(((current_quantity*current_cost)+(new.quantity*new.unit_cost))/(current_quantity+new.quantity),2) end; end if;
  update public.inventory_stock set quantity=current_quantity+delta, unit_cost=next_cost where id=new.stock_id;
  return new;
end; $$;
