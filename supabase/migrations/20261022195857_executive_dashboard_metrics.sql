-- Aggregates for the executive dashboard. The function is SECURITY INVOKER,
-- therefore table grants and RLS remain authoritative for every source table.
create or replace function public.get_executive_dashboard_metrics(
  p_from date default ((now() at time zone 'America/Bogota')::date - 180),
  p_to date default ((now() at time zone 'America/Bogota')::date),
  p_project_id uuid default null,
  p_client text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_can_quotes boolean;
  v_can_projects boolean;
  v_can_inventory boolean;
  v_can_attendance boolean;
  v_from date := coalesce(p_from, ((now() at time zone 'America/Bogota')::date - 180));
  v_to date := coalesce(p_to, (now() at time zone 'America/Bogota')::date);
  v_months jsonb;
  v_quote_statuses jsonb;
  v_project_statuses jsonb;
  v_critical_stock jsonb;
  v_attendance jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if v_from > v_to then raise exception 'El período inicial debe ser anterior al final'; end if;

  select company_id into v_company_id
  from public.user_roles
  where user_id = auth.uid()
  order by created_at nulls last
  limit 1;
  if v_company_id is null then raise exception 'La cuenta no tiene una empresa asignada'; end if;

  select
    exists (select 1 from public.my_effective_permissions() p where p.code in ('quotes.view','quotes.manage','dashboard.intelligence.view')),
    exists (select 1 from public.my_effective_permissions() p where p.code in ('projects.view','projects.manage','dashboard.intelligence.view')),
    exists (select 1 from public.my_effective_permissions() p where p.code in ('inventory.view','inventory.manage','dashboard.intelligence.view')),
    exists (select 1 from public.my_effective_permissions() p where p.code in ('attendance.team.view','dashboard.intelligence.view'))
  into v_can_quotes, v_can_projects, v_can_inventory, v_can_attendance;

  if v_can_quotes then
    select coalesce(jsonb_agg(jsonb_build_object('month', month_start::date, 'received', received, 'sent', sent, 'approved', approved) order by month_start), '[]'::jsonb)
    into v_months
    from (
      select month_start,
        (select count(*) from public.quotes q where q.company_id = v_company_id and (p_client is null or q.client = p_client) and q.received_at >= month_start and q.received_at < month_start + interval '1 month') as received,
        (select count(*) from public.quotes q where q.company_id = v_company_id and (p_client is null or q.client = p_client) and q.sent_at >= month_start and q.sent_at < month_start + interval '1 month') as sent,
        (select count(*) from public.quote_history h join public.quotes q on q.id = h.quote_id where h.company_id = v_company_id and (p_client is null or q.client = p_client) and h.to_status in ('confirmed','in_execution','work_completed','billing_pending','closed') and h.changed_at >= month_start and h.changed_at < month_start + interval '1 month') as approved
      from generate_series(date_trunc('month', v_from)::date, date_trunc('month', v_to)::date, interval '1 month') month_start
    ) monthly;

    select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', count, 'value', value) order by count desc, status), '[]'::jsonb)
    into v_quote_statuses
    from (
      select q.status, count(*)::int as count, coalesce(sum(q.estimated_value), 0)::numeric as value
      from public.quotes q
      where q.company_id = v_company_id
        and (p_client is null or q.client = p_client)
        and q.received_at::date between v_from and v_to
      group by q.status
    ) statuses;

    select jsonb_build_object(
      'following', count(*) filter (where status in ('received','in_review','estimating','sent','awaiting_response','revision_requested')),
      'approved_value', coalesce(sum(estimated_value) filter (where status in ('confirmed','in_execution','work_completed','billing_pending','closed')), 0),
      'conversion', case when count(*) filter (where status in ('confirmed','in_execution','work_completed','billing_pending','closed','lost')) = 0 then null else round(100.0 * count(*) filter (where status in ('confirmed','in_execution','work_completed','billing_pending','closed')) / count(*) filter (where status in ('confirmed','in_execution','work_completed','billing_pending','closed','lost')), 1) end
    ) into v_summary
    from public.quotes
    where company_id = v_company_id and (p_client is null or client = p_client) and received_at::date between v_from and v_to;
  else
    v_months := '[]'::jsonb; v_quote_statuses := '[]'::jsonb; v_summary := '{}'::jsonb;
  end if;

  if v_can_projects then
    select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', count) order by count desc, status), '[]'::jsonb)
    into v_project_statuses
    from (select status, count(*)::int as count from public.projects where company_id = v_company_id and (p_project_id is null or id = p_project_id) group by status) projects;
    v_summary := v_summary || jsonb_build_object('active_projects', (select count(*) from public.projects where company_id = v_company_id and status = 'active' and (p_project_id is null or id = p_project_id)));
  else v_project_statuses := '[]'::jsonb; end if;

  if v_can_inventory then
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'available', available, 'minimum', minimum, 'deficit', deficit) order by deficit desc, name), '[]'::jsonb)
    into v_critical_stock
    from (
      select i.name, s.quantity::numeric as available, s.minimum_quantity::numeric as minimum, greatest(s.minimum_quantity - s.quantity, 0)::numeric as deficit
      from public.inventory_stock s join public.inventory_items i on i.id = s.item_id
      where s.company_id = v_company_id and s.minimum_quantity is not null and s.quantity <= s.minimum_quantity
      order by greatest(s.minimum_quantity - s.quantity, 0) desc, i.name limit 12
    ) stock;
    v_summary := v_summary || jsonb_build_object('operational_alerts', jsonb_array_length(v_critical_stock));
  else v_critical_stock := '[]'::jsonb; end if;

  if v_can_attendance then
    select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'employees', employees) order by local_date), '[]'::jsonb)
    into v_attendance
    from (
      select local_date, count(distinct employee_id)::int as employees
      from public.workdays
      where company_id = v_company_id and local_date between v_from and v_to and (p_project_id is null or exists (select 1 from public.workday_segments s where s.workday_id = workdays.id and s.project_id = p_project_id))
      group by local_date
    ) attendance;
  else v_attendance := '[]'::jsonb; end if;

  return jsonb_build_object('period', jsonb_build_object('from', v_from, 'to', v_to, 'timezone', 'America/Bogota'), 'summary', v_summary, 'quotes_monthly', v_months, 'quote_statuses', v_quote_statuses, 'project_statuses', v_project_statuses, 'critical_inventory', v_critical_stock, 'attendance', v_attendance);
end;
$$;

revoke all on function public.get_executive_dashboard_metrics(date, date, uuid, text) from public, anon;
grant execute on function public.get_executive_dashboard_metrics(date, date, uuid, text) to authenticated;