-- The previous trigger referenced NEW/OLD fields that do not exist on every
-- table it audits. Convert rows to JSON so the shared trigger is type-safe.
create or replace function private.audit_employee_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company uuid;
  target_employee uuid;
  event_row jsonb;
begin
  event_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_table_name = 'employees' then
    target_company := (event_row ->> 'company_id')::uuid;
    target_employee := (event_row ->> 'id')::uuid;
  else
    target_employee := (event_row ->> 'employee_id')::uuid;
    select company_id into target_company from public.employees where id = target_employee;
  end if;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    target_company,
    auth.uid(),
    tg_table_name,
    target_employee,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.audit_employee_change() from public, anon, authenticated;
