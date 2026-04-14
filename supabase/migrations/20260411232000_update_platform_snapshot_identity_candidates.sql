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

  return jsonb_build_object(
    'tenant', to_jsonb(tenant_match),
    'customRoles', coalesce(roles_data, '[]'::jsonb),
    'userShadows', coalesce(users_data, '[]'::jsonb),
    'identityCandidates', coalesce(identities_data, '[]'::jsonb),
    'auditLogs', coalesce(audit_data, '[]'::jsonb)
  );
end;
$$;
