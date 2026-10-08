-- Tablas salariales versionadas por empresa. Cada cotización conserva una instantánea para que una actualización posterior nunca cambie su costo.
create table if not exists public.labor_rate_tables (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  client_name text not null default '', name text not null, version text not null,
  activity_type text not null default 'general' check (activity_type in ('general', 'propias', 'no_propias')),
  rate_unit text not null default 'day' check (rate_unit in ('hour', 'day', 'month')),
  valid_from date not null, valid_to date, source_document text not null default '', notes text not null default '',
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, name, version), unique (id, company_id), check (valid_to is null or valid_to >= valid_from)
);
create table if not exists public.labor_rate_entries (
  id uuid primary key default gen_random_uuid(), labor_rate_table_id uuid not null, company_id uuid not null,
  code text not null, name text not null, level smallint check (level between 1 and 99),
  daily_basic_salary numeric(14,2) not null default 0 check (daily_basic_salary >= 0),
  transport_allowance numeric(14,2) not null default 0 check (transport_allowance >= 0),
  food_allowance numeric(14,2) not null default 0 check (food_allowance >= 0),
  non_salary_allowance numeric(14,2) not null default 0 check (non_salary_allowance >= 0),
  total_daily_rate numeric(14,2) not null default 0 check (total_daily_rate >= 0), notes text not null default '', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (labor_rate_table_id, code),
  foreign key (labor_rate_table_id, company_id) references public.labor_rate_tables(id, company_id) on delete cascade
);
create index if not exists labor_rate_tables_company_active_idx on public.labor_rate_tables(company_id, is_active, valid_from desc);
create index if not exists labor_rate_entries_table_sort_idx on public.labor_rate_entries(labor_rate_table_id, sort_order, name);
alter table public.labor_rate_tables enable row level security;
alter table public.labor_rate_entries enable row level security;
create policy labor_rate_tables_member_read on public.labor_rate_tables for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_tables.company_id));
create policy labor_rate_entries_member_read on public.labor_rate_entries for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_entries.company_id));
create policy labor_rate_tables_manager_write on public.labor_rate_tables for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_tables.company_id and r.code in ('administrator', 'resident_engineer', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_tables.company_id and r.code in ('administrator', 'resident_engineer', 'general_management')));
create policy labor_rate_entries_manager_write on public.labor_rate_entries for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_entries.company_id and r.code in ('administrator', 'resident_engineer', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_entries.company_id and r.code in ('administrator', 'resident_engineer', 'general_management')));
grant select, insert, update, delete on public.labor_rate_tables, public.labor_rate_entries to authenticated;
create trigger labor_rate_tables_updated before update on public.labor_rate_tables for each row execute function private.set_updated_at();
create trigger labor_rate_entries_updated before update on public.labor_rate_entries for each row execute function private.set_updated_at();
alter table public.quotes add column if not exists labor_rate_table_id uuid;
alter table public.quotes add column if not exists labor_rate_snapshot jsonb;
alter table public.quotes drop constraint if exists quotes_labor_rate_table_company_fkey;
alter table public.quotes add constraint quotes_labor_rate_table_company_fkey foreign key (labor_rate_table_id, company_id) references public.labor_rate_tables(id, company_id) on delete restrict;
insert into public.labor_rate_tables (company_id, client_name, name, version, activity_type, valid_from, valid_to, source_document)
select c.id, v.client_name, v.name, v.version, v.activity_type, v.valid_from, v.valid_to, v.source_document from public.companies c cross join (values
('OCENSA','OCENSA - actividades propias','2026-2027','propias',date '2026-07-01',date '2027-06-30','Tabla salarial OCENSA actividades propias'),
('OCENSA','OCENSA - actividades no propias','2026','no_propias',date '2026-01-01',date '2026-12-31','Tabla salarial OCENSA actividades no propias'),
('CENIT','CENIT - mínimos salariales','2026','general',date '2026-01-01',date '2026-12-31','Tabla salarial CENIT 2026'),
('ODC','ODC - mínimos salariales','2025','general',date '2025-01-01',date '2025-12-31','Matriz tabla mínimos salariales ODC 2025')) as v(client_name,name,version,activity_type,valid_from,valid_to,source_document)
on conflict (company_id,name,version) do nothing;
insert into public.labor_rate_entries (labor_rate_table_id,company_id,code,name,level,daily_basic_salary,transport_allowance,food_allowance,non_salary_allowance,total_daily_rate,sort_order)
select t.id,t.company_id,v.code,v.name,v.level,v.basic,v.transport,v.food,v.non_salary,v.total,v.level from public.labor_rate_tables t join (values
('OCENSA - actividades propias','2026-2027','N1','Nivel 1',1,114854,8303,34812,33418,191387),('OCENSA - actividades propias','2026-2027','N2','Nivel 2',2,132707,8303,34812,43707,219528),('OCENSA - actividades propias','2026-2027','N3','Nivel 3',3,139630,8303,34812,48244,230989),('OCENSA - actividades propias','2026-2027','N4','Nivel 4',4,164879,8303,34812,61746,269739),('OCENSA - actividades propias','2026-2027','N5','Nivel 5',5,184864,8303,34812,66282,294260),('OCENSA - actividades propias','2026-2027','N6','Nivel 6',6,203065,8303,34812,81663,327843),
('OCENSA - actividades no propias','2026','N1','Nivel 1',1,60581,8303,25658,0,94542),('OCENSA - actividades no propias','2026','N2','Nivel 2',2,64750,8303,25658,0,98711),('OCENSA - actividades no propias','2026','N3','Nivel 3',3,77100,8303,25658,0,111061),('OCENSA - actividades no propias','2026','N4','Nivel 4',4,79924,8303,25658,0,113885),('OCENSA - actividades no propias','2026','N5','Nivel 5',5,112890,8303,25658,0,146851),
('CENIT - mínimos salariales','2026','N1','Nivel 1',1,132003,8332,26051,50445,216831),('CENIT - mínimos salariales','2026','N2','Nivel 2',2,143148,8332,26051,54256,231787),('CENIT - mínimos salariales','2026','N3','Nivel 3',3,156200,8332,26051,57950,248533),('CENIT - mínimos salariales','2026','N4','Nivel 4',4,174455,8332,26051,66279,275117),('CENIT - mínimos salariales','2026','N5','Nivel 5',5,195210,8332,26051,71992,301585),
('ODC - mínimos salariales','2025','N1','Nivel 1',1,118532,6666,24571,0,149769),('ODC - mínimos salariales','2025','N2','Nivel 2',2,128539,6666,24571,0,159776),('ODC - mínimos salariales','2025','N3','Nivel 3',3,129599,6666,24571,0,160836),('ODC - mínimos salariales','2025','N4','Nivel 4',4,156650,6666,24571,0,187887),('ODC - mínimos salariales','2025','N5','Nivel 5',5,175283,6666,24571,0,206520)) as v(table_name,version,code,name,level,basic,transport,food,non_salary,total) on t.name=v.table_name and t.version=v.version
on conflict (labor_rate_table_id,code) do nothing;
create or replace function public.save_quote_with_history(p_company_id uuid, p_quote jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_quote_id uuid := (p_quote->>'id')::uuid;
  v_table_id uuid := nullif(p_quote->>'laborRateTableId', '')::uuid;
  v_actor text; v_entry jsonb; v_snapshot jsonb; v_previous_snapshot jsonb; v_previous_table uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.company_id = p_company_id) then raise exception 'No autorizado para esta empresa'; end if;
  if v_quote_id is null then raise exception 'La cotización no tiene identificador'; end if;
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Usuario') into v_actor from public.profiles p where p.id = auth.uid();
  select q.labor_rate_table_id, q.labor_rate_snapshot into v_previous_table, v_previous_snapshot from public.quotes q where q.id = v_quote_id and q.company_id = p_company_id;
  if v_table_id is not null and v_previous_table is not distinct from v_table_id and v_previous_snapshot is not null then
    v_snapshot := v_previous_snapshot;
  elsif v_table_id is not null then
    select jsonb_build_object('id', t.id, 'name', t.name, 'version', t.version, 'clientName', t.client_name, 'activityType', t.activity_type, 'rateUnit', t.rate_unit, 'validFrom', t.valid_from, 'validTo', t.valid_to, 'entries', coalesce(jsonb_agg(jsonb_build_object('code', e.code, 'name', e.name, 'level', e.level, 'dailyBasicSalary', e.daily_basic_salary, 'transportAllowance', e.transport_allowance, 'foodAllowance', e.food_allowance, 'nonSalaryAllowance', e.non_salary_allowance, 'totalDailyRate', e.total_daily_rate) order by e.sort_order, e.name) filter (where e.id is not null), '[]'::jsonb))
      into v_snapshot from public.labor_rate_tables t left join public.labor_rate_entries e on e.labor_rate_table_id = t.id
      where t.id = v_table_id and t.company_id = p_company_id group by t.id;
    if v_snapshot is null then raise exception 'La tabla salarial seleccionada no pertenece a la empresa'; end if;
  end if;
  insert into public.quotes as q (id, company_id, code, title, client, contact_name, contact_email, contact_phone, email_origin, status, responsible, estimated_value, revision, cost_breakdown, technical_visit, technical_visits, validity_days, sent_at, delivery_time_weeks, payment_terms, folder_url, received_at, deadline, next_action, project_id, notes, request_body, labor_rate_table_id, labor_rate_snapshot, created_at, updated_at)
  values (v_quote_id,p_company_id,p_quote->>'code',p_quote->>'title',p_quote->>'client',nullif(p_quote->>'contactName',''),nullif(p_quote->>'contactEmail',''),nullif(p_quote->>'contactPhone',''),nullif(p_quote->>'emailOrigin',''),p_quote->>'status',p_quote->>'responsible',nullif(p_quote->>'estimatedValue','')::numeric,coalesce((p_quote->>'revision')::int,0),p_quote->'costBreakdown',p_quote->'technicalVisit',p_quote->'technicalVisits',nullif(p_quote->>'validityDays','')::int,nullif(p_quote->>'sentAt','')::timestamptz,nullif(p_quote->>'deliveryTimeWeeks','')::int,nullif(p_quote->>'paymentTerms',''),nullif(p_quote->>'folderUrl',''),coalesce(nullif(p_quote->>'receivedAt','')::timestamptz,now()),nullif(p_quote->>'deadline','')::timestamptz,nullif(p_quote->>'nextAction',''),nullif(p_quote->>'projectId','')::uuid,nullif(p_quote->>'notes',''),p_quote->>'requestBody',v_table_id,v_snapshot,coalesce(nullif(p_quote->>'createdAt','')::timestamptz,now()),now())
  on conflict (id) do update set code=excluded.code,title=excluded.title,client=excluded.client,contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,email_origin=excluded.email_origin,status=excluded.status,responsible=excluded.responsible,estimated_value=excluded.estimated_value,revision=excluded.revision,cost_breakdown=excluded.cost_breakdown,technical_visit=excluded.technical_visit,technical_visits=excluded.technical_visits,validity_days=excluded.validity_days,sent_at=excluded.sent_at,delivery_time_weeks=excluded.delivery_time_weeks,payment_terms=excluded.payment_terms,folder_url=excluded.folder_url,deadline=excluded.deadline,next_action=excluded.next_action,project_id=excluded.project_id,notes=excluded.notes,request_body=excluded.request_body,labor_rate_table_id=excluded.labor_rate_table_id,labor_rate_snapshot=excluded.labor_rate_snapshot,updated_at=now() where q.company_id=p_company_id;
  for v_entry in select value from jsonb_array_elements(coalesce(p_quote->'history', '[]'::jsonb)) loop
    if nullif(v_entry->>'id','') is null or exists (select 1 from public.quote_history h where h.id=(v_entry->>'id')::uuid) then continue; end if;
    insert into public.quote_history (id,quote_id,company_id,from_status,to_status,changed_by,note,changed_at) values ((v_entry->>'id')::uuid,v_quote_id,p_company_id,nullif(v_entry->>'fromStatus',''),v_entry->>'toStatus',v_actor,nullif(v_entry->>'note',''),coalesce(nullif(v_entry->>'changedAt','')::timestamptz,now()));
  end loop;
end;
$$;
revoke all on function public.save_quote_with_history(uuid, jsonb) from public, anon;
grant execute on function public.save_quote_with_history(uuid, jsonb) to authenticated;
