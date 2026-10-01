-- Security Hardening Migration: 2026-09-21
-- Harden private helper functions with pg_temp in search_path and tight execution privileges.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.apply_inventory_movement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  delta numeric(14,3);
begin
  select case new.movement_type
    when 'entry' then new.quantity
    when 'adjustment_in' then new.quantity
    else -new.quantity
  end into delta;

  update public.inventory_stock
  set quantity = quantity + delta
  where id = new.stock_id
    and company_id = new.company_id
    and branch_id = new.branch_id;

  if not found then
    raise exception 'El movimiento no corresponde a la existencia seleccionada';
  end if;

  return new;
end;
$$;
