-- La cantidad fisica puede cargarse antes de conocer el costo historico.
alter table public.inventory_stock
  add column if not exists valuation_status text not null default 'confirmed'
    check (valuation_status in ('pending', 'confirmed')),
  add column if not exists initial_value_source text,
  add column if not exists initial_value_set_at timestamptz;

alter table public.physical_count_lines alter column unit_cost drop not null;
alter table public.physical_count_lines alter column unit_cost drop default;

-- El conteo inicial conserva una cantidad sin inventar un costo. Esa existencia
-- queda pendiente de valorar hasta que un responsable registre su primer valor.
create or replace function public.approve_initial_inventory_count(target_count uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare count_row public.physical_counts%rowtype; line_row record; movement_kind public.inventory_movement_type;
begin
  select * into count_row from public.physical_counts where id = target_count for update;
  if not found then raise exception 'Conteo no encontrado'; end if;
  if not private.inventory_manager_for(count_row.company_id) then raise exception 'No autorizado para aprobar conteos'; end if;
  if count_row.status <> 'draft' then raise exception 'El conteo ya fue procesado'; end if;

  for line_row in select * from public.physical_count_lines where count_id = target_count loop
    if line_row.counted_quantity <> line_row.system_quantity then
      movement_kind := case when line_row.counted_quantity > line_row.system_quantity then 'adjustment_in' else 'adjustment_out' end;
      insert into public.inventory_movements(stock_id,company_id,branch_id,movement_type,quantity,reference,notes,count_session_id,unit_cost)
      select s.id,s.company_id,s.branch_id,movement_kind,abs(line_row.counted_quantity-line_row.system_quantity),
        'INV-INICIAL-'||to_char(now(),'YYYYMMDD'),'Carga inicial aprobada',target_count,coalesce(line_row.unit_cost, 0)
      from public.inventory_stock s where s.id=line_row.stock_id;
    end if;

    update public.inventory_stock
    set unit_cost = coalesce(line_row.unit_cost, unit_cost),
        valuation_status = case when line_row.unit_cost is null then 'pending' else 'confirmed' end,
        initial_value_source = case when line_row.unit_cost is null then null else 'Carga inicial declarada' end,
        initial_value_set_at = case when line_row.unit_cost is null then null else now() end
    where id = line_row.stock_id;
  end loop;

  update public.physical_counts set status='approved',approved_by=auth.uid(),approved_at=now() where id=target_count;
end;
$$;

-- Solo se permite una primera valoración explícita de una existencia pendiente.
create or replace function public.set_initial_inventory_value(target_stock uuid, value_cop numeric, source_note text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare stock_company uuid;
begin
  select company_id into stock_company from public.inventory_stock where id = target_stock for update;
  if stock_company is null then raise exception 'Existencia no encontrada'; end if;
  if not private.inventory_manager_for(stock_company) then raise exception 'No autorizado para valorar inventario'; end if;
  if value_cop < 0 or nullif(trim(source_note), '') is null then raise exception 'Indica un valor válido y la fuente del valor'; end if;

  update public.inventory_stock
  set unit_cost = value_cop,
      valuation_status = 'confirmed',
      initial_value_source = trim(source_note),
      initial_value_set_at = now()
  where id = target_stock and valuation_status = 'pending';
  if not found then raise exception 'El primer valor ya fue definido para esta existencia'; end if;
end;
$$;

revoke all on function public.set_initial_inventory_value(uuid, numeric, text) from public, anon;
grant execute on function public.set_initial_inventory_value(uuid, numeric, text) to authenticated;

-- En compras posteriores, las existencias ya valoradas usan promedio ponderado.
create or replace function private.apply_inventory_movement()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare delta numeric(14,3); current_quantity numeric(14,3); current_cost numeric(14,2); current_status text; next_cost numeric(14,2);
begin
  select case new.movement_type when 'entry' then new.quantity when 'adjustment_in' then new.quantity else -new.quantity end into delta;

  select quantity, unit_cost, valuation_status into current_quantity, current_cost, current_status
  from public.inventory_stock
  where id = new.stock_id and company_id = new.company_id and branch_id = new.branch_id
  for update;
  if not found then raise exception 'El movimiento no corresponde a la existencia seleccionada'; end if;

  next_cost := current_cost;
  if new.movement_type = 'entry' and new.unit_cost > 0 and current_status = 'confirmed' then
    if current_quantity <= 0 then next_cost := new.unit_cost;
    else next_cost := round(((current_quantity * current_cost) + (new.quantity * new.unit_cost)) / (current_quantity + new.quantity), 2);
    end if;
  end if;

  update public.inventory_stock set quantity = current_quantity + delta, unit_cost = next_cost where id = new.stock_id;
  return new;
end;
$$;
