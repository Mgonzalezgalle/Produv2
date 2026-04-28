create or replace function public.get_legacy_storage_audit_logs(
  legacy_emp_id text,
  limit_count integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_limit integer;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_limit := greatest(1, least(coalesce(limit_count, 12), 50));

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', log_entry.id,
        'storageKey', log_entry.storage_key,
        'action', log_entry.action,
        'actorRole', log_entry.actor_role,
        'previous', log_entry.previous_summary,
        'next', log_entry.next_summary,
        'createdAt', log_entry.created_at
      )
      order by log_entry.created_at desc
    )
    from (
      select *
        from public.legacy_storage_audit_logs
       where storage_key like legacy_emp_id || ':%'
       order by created_at desc
       limit normalized_limit
    ) as log_entry
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_legacy_tenant_integration_credentials_snapshot(
  legacy_emp_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
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

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', credential.id,
        'provider', credential.provider,
        'environment', credential.environment,
        'status', credential.status,
        'secretConfigured', coalesce(nullif(credential.secret_ref, ''), '') <> '',
        'configKeys', (
          select coalesce(jsonb_agg(key_name order by key_name), '[]'::jsonb)
            from jsonb_object_keys(coalesce(credential.config, '{}'::jsonb)) as key_name
        ),
        'updatedAt', credential.updated_at
      )
      order by credential.provider, credential.environment
    )
    from public.integration_credentials credential
    where credential.tenant_id = tenant_match.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_legacy_storage_audit_logs(text, integer) to authenticated, service_role;
grant execute on function public.get_legacy_tenant_integration_credentials_snapshot(text) to authenticated, service_role;

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
  storage_audit_data jsonb;
  integration_credentials_data jsonb;
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

  storage_audit_data := public.get_legacy_storage_audit_logs(legacy_emp_id, 12);
  integration_credentials_data := public.get_legacy_tenant_integration_credentials_snapshot(legacy_emp_id);

  return jsonb_build_object(
    'tenant', to_jsonb(tenant_match),
    'customRoles', coalesce(roles_data, '[]'::jsonb),
    'userShadows', coalesce(users_data, '[]'::jsonb),
    'identityCandidates', coalesce(identities_data, '[]'::jsonb),
    'auditLogs', coalesce(audit_data, '[]'::jsonb),
    'storageAuditLogs', coalesce(storage_audit_data, '[]'::jsonb),
    'integrationCredentials', coalesce(integration_credentials_data, '[]'::jsonb)
  );
end;
$$;

