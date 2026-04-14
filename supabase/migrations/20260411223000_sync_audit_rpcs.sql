create or replace function public.append_legacy_sync_audit_log(
  legacy_emp_id text,
  action_name text,
  entity_type_name text,
  entity_identifier text default '',
  payload_data jsonb default '{}'::jsonb
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  next_log public.audit_logs;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;
  if coalesce(trim(action_name), '') = '' then
    raise exception 'action_name_required';
  end if;
  if coalesce(trim(entity_type_name), '') = '' then
    raise exception 'entity_type_required';
  end if;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  insert into public.audit_logs (
    tenant_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    tenant_match.id,
    action_name,
    entity_type_name,
    coalesce(entity_identifier, ''),
    coalesce(payload_data, '{}'::jsonb)
      || jsonb_build_object(
        'legacyEmpId', legacy_emp_id,
        'source', 'lab_supabase_sync'
      )
  )
  returning * into next_log;

  return next_log;
end;
$$;

grant execute on function public.append_legacy_sync_audit_log(text, text, text, text, jsonb) to anon, authenticated, service_role;
