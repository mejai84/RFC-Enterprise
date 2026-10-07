-- Correccion posterior al primer despliegue de prestamos.
-- `inventory_tool_loans.code` es unico para toda la tabla, no por empresa.
-- El consecutivo debe calcularse globalmente para evitar una colision cuando
-- otra empresa cree el mismo codigo anual.

create or replace function public.create_tool_loan(
  target_project uuid,
  target_stock uuid,
  receiver_name text,
  target_expected_return date default null,
  loan_notes text default null,
  delivery_signature text default null
)
returns table (loan_id uuid, loan_code text)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_company uuid;
  target_branch uuid;
  tool_label text;
  available_now numeric;
  next_number integer;
  loan_year smallint := extract(year from current_date)::smallint;
  created_id uuid;
begin
  select p.company_id, coalesce(s.branch_id, p.branch_id)
    into target_company, target_branch
  from public.projects p
  join public.inventory_stock s on s.id = target_stock and s.company_id = p.company_id
  where p.id = target_project;

  if not found then
    raise exception 'La herramienta o la obra no pertenecen a la misma empresa';
  end if;
  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para prestar herramientas de esta empresa';
  end if;
  if nullif(trim(receiver_name), '') is null then
    raise exception 'Indica quien recibe la herramienta';
  end if;

  select coalesce(i.name, 'herramienta'), s.quantity
    into tool_label, available_now
  from public.inventory_stock s
  left join public.inventory_items i on i.id = s.item_id
  where s.id = target_stock;
  if available_now <= 0 then
    raise exception 'No hay unidades disponibles de %', tool_label;
  end if;

  -- El bloqueo es global porque `code` tambien lo es.
  perform pg_advisory_xact_lock(hashtextextended('inventory_tool_loan_code:' || loan_year::text, 0));
  select coalesce(max((substring(code from 'PRST-[0-9]{4}-([0-9]+)'))::int), 0)
    into next_number
  from public.inventory_tool_loans
  where code like 'PRST-' || loan_year::text || '-%';

  loan_code := 'PRST-' || loan_year::text || '-' || lpad((next_number + 1)::text, 3, '0');
  insert into public.inventory_tool_loans (
    company_id, branch_id, project_id, stock_id, code, worker_name,
    expected_return_date, notes, delivery_signature_data
  ) values (
    target_company, target_branch, target_project, target_stock, loan_code,
    trim(receiver_name), target_expected_return,
    nullif(trim(loan_notes), ''), nullif(trim(delivery_signature), '')
  ) returning id into created_id;

  loan_id := created_id;
  return next;
end;
$function$;

create or replace function public.return_tool_loan(
  target_loan uuid,
  return_notes text default null,
  return_signature text default null,
  final_status text default 'returned'
)
returns table (loan_code text, tool_name text)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_company uuid;
  previous_status text;
begin
  select l.company_id, l.status, l.code into target_company, previous_status, loan_code
  from public.inventory_tool_loans l where l.id = target_loan for update;
  if not found then raise exception 'El prestamo indicado no existe'; end if;
  if not private.inventory_manager_for(target_company) then raise exception 'No tienes permiso para registrar devoluciones de esta empresa'; end if;
  if previous_status <> 'active' then raise exception 'Este prestamo ya estaba en estado % y no admite otra devolucion.', previous_status; end if;
  if final_status not in ('returned', 'damaged') then raise exception 'El estado final debe ser returned o damaged'; end if;

  select coalesce(i.name, 'herramienta') into tool_name
  from public.inventory_stock s left join public.inventory_items i on i.id = s.item_id
  where s.id = (select stock_id from public.inventory_tool_loans where id = target_loan);

  update public.inventory_tool_loans
  set status = final_status,
      returned_at = now(),
      return_signature_data = nullif(trim(return_signature), ''),
      notes = nullif(case
        when nullif(trim(coalesce(notes, '')), '') is null then nullif(trim(return_notes), '')
        when nullif(trim(return_notes), '') is null then notes
        else notes || chr(10) || 'Devolucion: ' || trim(return_notes)
      end, ''),
      updated_at = now()
  where id = target_loan;
  return next;
end;
$function$;

revoke all on function public.create_tool_loan(uuid, uuid, text, date, text, text) from public, anon;
revoke all on function public.return_tool_loan(uuid, text, text, text) from public, anon;
grant execute on function public.create_tool_loan(uuid, uuid, text, date, text, text) to authenticated;
grant execute on function public.return_tool_loan(uuid, text, text, text) to authenticated;
