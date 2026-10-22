-- DASH-005: la referencia y la devolución se validan en el servidor.
-- No altera movimientos históricos ni ejecuta cambios fuera de la migración.
create or replace function public.register_inventory_movement(
  p_stock_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference text,
  p_project_id uuid default null,
  p_responsible_name text default null,
  p_notes text default null,
  p_operation_kind text default null,
  p_client_request_id uuid default null
)
returns table(
  movement_id uuid,
  quantity_before numeric,
  quantity_after numeric,
  unit_cost numeric,
  occurred_at timestamptz,
  operation_kind text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  stock_row public.inventory_stock%rowtype;
  saved_row public.inventory_movements%rowtype;
  resolved_cost numeric(14,2);
  resolved_kind text;
  resolved_reference text;
  next_number integer;
  net_dispatched numeric;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para registrar movimientos';
  end if;

  select * into stock_row from public.inventory_stock where id = p_stock_id for update;
  if not found then raise exception 'La existencia seleccionada no existe'; end if;
  if not private.inventory_can_manage_branch(stock_row.company_id, stock_row.branch_id) then
    raise exception 'No tienes permiso para registrar movimientos en esta sede';
  end if;

  if p_client_request_id is not null then
    select * into saved_row from public.inventory_movements movement
    where movement.company_id = stock_row.company_id
      and movement.client_request_id = p_client_request_id;
    if found then
      return query select saved_row.id, saved_row.quantity_before, saved_row.quantity_after,
        saved_row.unit_cost, saved_row.occurred_at, saved_row.operation_kind;
      return;
    end if;
  end if;

  if p_movement_type not in ('entry', 'exit', 'adjustment_in', 'adjustment_out') then
    raise exception 'Usa la operación de traslado para cambiar una ubicación';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;

  resolved_kind := coalesce(nullif(btrim(p_operation_kind), ''), case
    when p_movement_type = 'entry' then 'entry'
    when p_movement_type = 'exit' then 'exit'
    else 'adjustment'
  end);
  if (p_movement_type = 'entry' and resolved_kind not in ('entry', 'return'))
     or (p_movement_type = 'exit' and resolved_kind <> 'exit')
     or (p_movement_type in ('adjustment_in', 'adjustment_out') and resolved_kind <> 'adjustment') then
    raise exception 'El tipo operativo no corresponde al movimiento';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects project
    where project.id = p_project_id and project.company_id = stock_row.company_id
  ) then
    raise exception 'La obra seleccionada no pertenece a la empresa de la existencia';
  end if;

  if resolved_kind = 'return' then
    if p_project_id is null then raise exception 'La devolución debe indicar la obra de origen'; end if;
    select coalesce(sum(case
      when movement.operation_kind = 'exit' then movement.quantity
      when movement.operation_kind = 'return' then -movement.quantity
      else 0
    end), 0) into net_dispatched
    from public.inventory_movements movement
    where movement.stock_id = stock_row.id and movement.project_id = p_project_id;
    if p_quantity > net_dispatched then
      raise exception 'La devolución (%) supera el material neto despachado (%) para esta obra', p_quantity, net_dispatched;
    end if;
  end if;

  resolved_cost := coalesce(p_unit_cost, stock_row.unit_cost, 0);
  if resolved_cost < 0 then raise exception 'El costo unitario no puede ser negativo'; end if;

  resolved_reference := nullif(btrim(p_reference), '');
  if resolved_reference is null then
    perform pg_advisory_xact_lock(hashtextextended(stock_row.company_id::text || ':inventory-reference:' || to_char(current_date, 'YYYY'), 0));
    select coalesce(max((substring(movement.reference from 'MOV-[0-9]{4}-([0-9]+)'))::integer), 0) + 1
      into next_number
    from public.inventory_movements movement
    where movement.company_id = stock_row.company_id
      and movement.reference like 'MOV-' || to_char(current_date, 'YYYY') || '-%';
    resolved_reference := 'MOV-' || to_char(current_date, 'YYYY') || '-' || lpad(next_number::text, 5, '0');
  end if;

  insert into public.inventory_movements(
    stock_id, company_id, branch_id, project_id, movement_type, quantity,
    unit_cost, reference, notes, responsible_name, occurred_at, created_by,
    operation_kind, client_request_id
  ) values (
    stock_row.id, stock_row.company_id, stock_row.branch_id, p_project_id,
    p_movement_type, p_quantity, resolved_cost, resolved_reference,
    nullif(btrim(p_notes), ''), nullif(btrim(p_responsible_name), ''), now(), auth.uid(),
    resolved_kind, p_client_request_id
  ) returning * into saved_row;

  return query select saved_row.id, saved_row.quantity_before, saved_row.quantity_after,
    saved_row.unit_cost, saved_row.occurred_at, saved_row.operation_kind;
end;
$$;

revoke all on function public.register_inventory_movement(uuid, public.inventory_movement_type, numeric, numeric, text, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.register_inventory_movement(uuid, public.inventory_movement_type, numeric, numeric, text, uuid, text, text, text, uuid) to authenticated;