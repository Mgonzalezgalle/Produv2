create or replace function public.append_legacy_operational_event(
  legacy_emp_id text,
  area_name text,
  action_name text,
  entity_type_name text,
  entity_identifier text default '',
  actor_data jsonb default '{}'::jsonb,
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
  normalized_area text;
  normalized_action text;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;
  if coalesce(trim(area_name), '') = '' then
    raise exception 'area_name_required';
  end if;
  if coalesce(trim(action_name), '') = '' then
    raise exception 'action_name_required';
  end if;
  if coalesce(trim(entity_type_name), '') = '' then
    raise exception 'entity_type_required';
  end if;

  normalized_area := trim(area_name);
  normalized_action := trim(action_name);

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
    normalized_area || '_' || normalized_action,
    entity_type_name,
    coalesce(entity_identifier, ''),
    coalesce(payload_data, '{}'::jsonb)
      || jsonb_build_object(
        'legacyEmpId', legacy_emp_id,
        'source', 'legacy_operational_event',
        'auditType', 'operational',
        'area', normalized_area,
        'actionName', normalized_action,
        'actor', coalesce(actor_data, '{}'::jsonb)
      )
  )
  returning * into next_log;

  return next_log;
end;
$$;

create or replace function public.get_legacy_operational_events(
  legacy_emp_id text,
  limit_count integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  events_data jsonb;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'area', coalesce(al.payload->>'area', split_part(al.action, '_', 1)),
        'action', coalesce(al.payload->>'actionName', al.action),
        'entityType', al.entity_type,
        'entityId', al.entity_id,
        'actor', coalesce(al.payload->'actor', 'null'::jsonb),
        'payload', al.payload,
        'createdAt', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into events_data
  from (
    select *
      from public.audit_logs
     where tenant_id = tenant_match.id
       and coalesce(payload->>'auditType', '') = 'operational'
     order by created_at desc
     limit greatest(coalesce(limit_count, 24), 1)
  ) al;

  return events_data;
end;
$$;

create or replace function public.get_legacy_tenant_platform_snapshot(
  legacy_emp_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  roles_data jsonb;
  users_data jsonb;
  identities_data jsonb;
  audit_data jsonb;
  operational_events_data jsonb;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  roles_data := public.get_legacy_tenant_custom_roles(legacy_emp_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', lus.legacy_user_id,
        'name', lus.full_name,
        'email', lus.email,
        'role', lus.role_key,
        'active', lus.active,
        'isCrew', lus.is_crew,
        'crewRole', lus.crew_role
      )
      order by lus.full_name
    ),
    '[]'::jsonb
  )
  into users_data
  from public.legacy_user_shadows lus
  where lus.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ic.legacy_user_id,
        'email', ic.email,
        'name', ic.full_name,
        'role', ic.target_role_key,
        'status', ic.status,
        'isCrew', ic.is_crew,
        'crewRole', ic.crew_role
      )
      order by ic.full_name
    ),
    '[]'::jsonb
  )
  into identities_data
  from public.identity_candidates ic
  where ic.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'entityType', al.entity_type,
        'entityId', al.entity_id,
        'payload', al.payload,
        'createdAt', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into audit_data
  from (
    select *
    from public.audit_logs
    where tenant_id = tenant_match.id
    order by created_at desc
    limit 12
  ) al;

  operational_events_data := public.get_legacy_operational_events(legacy_emp_id, 12);

  return jsonb_build_object(
    'tenant', to_jsonb(tenant_match),
    'customRoles', coalesce(roles_data, '[]'::jsonb),
    'userShadows', coalesce(users_data, '[]'::jsonb),
    'identityCandidates', coalesce(identities_data, '[]'::jsonb),
    'auditLogs', coalesce(audit_data, '[]'::jsonb),
    'operationalEvents', coalesce(operational_events_data, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.append_legacy_operational_event(text, text, text, text, text, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_legacy_operational_events(text, integer) to anon, authenticated, service_role;
grant execute on function public.get_legacy_tenant_platform_snapshot(text) to anon, authenticated, service_role;
