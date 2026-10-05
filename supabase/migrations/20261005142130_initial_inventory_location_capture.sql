-- La carga inicial también certifica la ubicación física encontrada.
alter table public.physical_count_lines
  add column if not exists counted_location text;

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
    set location = coalesce(nullif(trim(line_row.counted_location), ''), location),
        unit_cost = coalesce(line_row.unit_cost, unit_cost),
        valuation_status = case when line_row.unit_cost is null then 'pending' else 'confirmed' end,
        initial_value_source = case when line_row.unit_cost is null then null else 'Carga inicial declarada' end,
        initial_value_set_at = case when line_row.unit_cost is null then null else now() end
    where id = line_row.stock_id;
  end loop;

  update public.physical_counts set status='approved',approved_by=auth.uid(),approved_at=now() where id=target_count;
end;
$$;
