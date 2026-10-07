-- Una obra no puede iniciar desde una cotización si la versión vigente del
-- procedimiento y la matriz de riesgos no tiene aprobación del cliente.
create or replace function public.convert_quote_to_project(
  p_company_id uuid, p_branch_id uuid, p_quote_id uuid, p_project_type text,
  p_project_name text, p_client text, p_location text, p_material_budget numeric,
  p_start_date date, p_estimated_end_date date, p_note text
)
returns json
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_prefix text; v_code text; v_maxseq int; v_project_id uuid; v_changed_by text; v_quote_status text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.company_id = p_company_id) then raise exception 'No autorizado para esta empresa'; end if;
  select status into v_quote_status from public.quotes where id = p_quote_id and company_id = p_company_id for update;
  if v_quote_status is null then raise exception 'Cotización no encontrada'; end if;
  if exists (select 1 from public.quotes where id = p_quote_id and project_id is not null) then raise exception 'La cotización ya está vinculada a una obra'; end if;
  if v_quote_status <> 'confirmed' then raise exception 'La cotización debe estar confirmada antes de iniciar la obra'; end if;
  if (select count(*) from (
    select distinct on (document_type) document_type, status
    from public.quote_technical_documents
    where quote_id = p_quote_id and document_type in ('work_procedure', 'risk_matrix')
    order by document_type, version desc
  ) current_documents where status = 'approved') <> 2 then
    raise exception 'La versión vigente del procedimiento y la matriz de riesgos debe estar aprobada por el cliente';
  end if;
  v_prefix := case p_project_type when 'mantenimiento' then 'MANT' when 'alquiler' then 'ALQ' when 'emergencia' then 'EMER' when 'administracion' then 'ADM' when 'consultoria' then 'CONS' when 'otro' then 'OTRO' else 'OBRA' end;
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || to_char(p_start_date,'YYYYMMDD') || v_prefix, 0));
  select coalesce(max(cast(substring(code from length(v_prefix) + 11) as int)), 0) into v_maxseq from public.projects where company_id = p_company_id and code ~ ('^' || v_prefix || '-' || to_char(p_start_date,'YYYYMMDD') || '-[0-9]+$');
  v_code := v_prefix || '-' || to_char(p_start_date,'YYYYMMDD') || '-' || lpad((v_maxseq + 1)::text, 2, '0');
  insert into public.projects(company_id, branch_id, code, name, client, location, material_budget, status, start_date, estimated_end_date) values (p_company_id, p_branch_id, v_code, p_project_name, p_client, p_location, coalesce(p_material_budget, 0), 'active', p_start_date, p_estimated_end_date) returning id into v_project_id;
  select coalesce(p.display_name, p.email, 'Usuario') into v_changed_by from public.profiles p where p.id = auth.uid();
  update public.quotes set project_id = v_project_id, status = 'in_execution', updated_at = now() where id = p_quote_id;
  insert into public.quote_history(id, quote_id, company_id, from_status, to_status, changed_by, note, changed_at) values (gen_random_uuid(), p_quote_id, p_company_id, v_quote_status, 'in_execution', coalesce(v_changed_by, 'Usuario'), p_note, now());
  return json_build_object('projectId', v_project_id, 'code', v_code);
end;
$$;
